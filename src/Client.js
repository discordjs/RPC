'use strict';

const { setTimeout, clearTimeout } = require('timers');
const request = require('snekfetch');
const transports = require('./transports');
const { RPCCommands, RPCEvents } = require('./Constants');
const { pid: getPid } = require('./Util');

const Collection = require('discord.js/src/util/Collection');
const Constants = require('discord.js/src/util/Constants');
const Snowflake = require('discord.js/src/util/Snowflake');
const ClientApplication = require('discord.js/src/structures/ClientApplication');
const Guild = require('discord.js/src/structures/Guild');
const Channel = require('discord.js/src/structures/Channel');
const User = require('discord.js/src/structures/User');
const BaseClient = require('discord.js/src/client/BaseClient');
const { Error, TypeError } = require('discord.js/src/errors');

const Lobby = require('./Lobby');

function createCache(create) {
  return {
    has: () => false,
    delete: () => false,
    get: () => undefined,
    create,
  };
}

function subKey(event, args) {
  return `${event}${JSON.stringify(args)}`;
}

/**
 * @typedef {RPCClientOptions}
 * @extends {ClientOptions}
 * @prop {string} transport RPC transport. one of `ipc` or `websocket`
 */

/**
 * The main hub for interacting with Discord RPC
 * @extends {BaseClient}
 */
class RPCClient extends BaseClient {
  /**
   * @param {RPCClientOptions} [options] Options for the client
   * You must provide a transport
   */
  constructor(options = {}) {
    super(Object.assign({ _tokenType: 'Bearer' }, options));
    this.accessToken = null;
    this.clientID = null;

    /**
     * Application used in this client
     * @type {?ClientApplication}
     */
    this.application = null;

    /**
     * User used in this application
     * @type {?User}
     */
    this.user = null;

    const Transport = transports[options.transport];
    if (!Transport) {
      throw new TypeError('RPC_INVALID_TRANSPORT', options.transport);
    }


    /**
     * Raw transport userd
     * @type {RPCTransport}
     */
    this.transport = new Transport(this);
    this.transport.on('message', this._onRpcMessage.bind(this));

    /**
     * Map of nonces being expected from the transport
     * @type {Map}
     * @private
     */
    this._expecting = new Map();

    /**
     * Map of current subscriptions
     * @type {Map}
     * @private
     */
    this._subscriptions = new Map();

    this.users = createCache((data) => new User(this, data));
    this.channels = createCache((data, guild) => Channel.create(this, data, guild));
    this.guilds = createCache((data) => new Guild(this, data));
  }

  /**
   * @typedef {RPCLoginOptions}
   * @param {string} [clientSecret] Client secret
   * @param {string} [accessToken] Access token
   * @param {string} [rpcToken] RPC token
   * @param {string} [tokenEndpoint] Token endpoint
   * @param {string[]} [scopes] Scopes to authorize with
   */

  /**
   * Log in
   * @param {string} clientID Client ID
   * @param {RPCLoginOptions} options Options for authentication.
   * At least one property must be provided to perform login.
   * @example client.login('1234567', { clientSecret: 'abcdef123' });
   * @returns {Promise<RPCClient>}
   */
  login(clientID, options) {
    return new Promise((resolve, reject) => {
      this.clientID = clientID;
      this.options._login = options || {};
      const timeout = setTimeout(() => reject(new Error('RPC_CONNECTION_TIMEOUT')), 10e3);
      timeout.unref();
      this.once('connected', () => {
        clearTimeout(timeout);
        resolve(this);
      });
      this.transport.once('close', reject);
      this.transport.connect({ client_id: this.clientID });
    }).then(() => {
      if (!options) {
        this.emit('ready');
        return this;
      }
      if (options.accessToken) {
        return this.authenticate(options.accessToken);
      }
      return this.authorize(options);
    });
  }

  /**
   * Request
   * @param {string} cmd Command
   * @param {Object} [args={}] Arguments
   * @param {string} [evt] Event
   * @returns {Promise}
   * @private
   */
  request(cmd, args, evt) {
    return new Promise((resolve, reject) => {
      const nonce = Snowflake.generate();
      this.transport.send({ cmd, args, evt, nonce });
      this._expecting.set(nonce, { resolve, reject });
    });
  }

  /**
   * Message handler
   * @param {Object} message message
   * @private
   */
  _onRpcMessage(message) {
    if (message.cmd === RPCCommands.DISPATCH && message.evt === RPCEvents.READY) {
      this.emit('connected');
      if (message.data.user) {
        this.user = this.users.create(message.data.user);
      }
    } else if (this._expecting.has(message.nonce)) {
      const { resolve, reject } = this._expecting.get(message.nonce);
      if (message.evt === 'ERROR') {
        reject(new Error('RPC_CLIENT_ERROR', `${message.data.code} ${message.data.message}`));
      } else {
        resolve(message.data);
      }
      this._expecting.delete(message.nonce);
    } else {
      const subid = subKey(message.evt, message.args);
      if (!this._subscriptions.has(subid)) {
        return;
      }
      this._subscriptions.get(subid)(message.data);
    }
  }

  /**
   * Authorize
   * @param {Object} options options
   * @returns {Promise}
   * @private
   */
  async authorize({ rpcToken, scopes, clientSecret, tokenEndpoint }) {
    if (tokenEndpoint && !rpcToken) {
      rpcToken = await request.get(tokenEndpoint).then((r) => r.body.rpc_token);
    } else if (clientSecret && rpcToken === true) {
      rpcToken = await this.api.oauth2.token.rpc.post({
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: {
          client_id: this.clientID,
          client_secret: clientSecret,
        },
      });
    }

    const { code } = await this.request('AUTHORIZE', {
      client_id: this.clientID,
      scopes,
      rpc_token: rpcToken,
    });

    if (tokenEndpoint) {
      const r = await request.post(tokenEndpoint).send({ code });
      return this.authenticate(r.body.access_token);
    } else if (clientSecret) {
      const { access_token: accessToken } = await this.api.oauth2.token.post({
        query: {
          client_id: this.clientID,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
        },
        auth: false,
      });
      return this.authenticate(accessToken);
    }

    return { code };
  }

  /**
   * Authenticate
   * @param {string} accessToken access token
   * @returns {Promise}
   * @private
   */
  authenticate(accessToken) {
    this.accessToken = accessToken;
    return this.request('AUTHENTICATE', { access_token: accessToken })
      .then(({ application, user }) => {
        this.application = new ClientApplication(this, application);
        if (this.user) {
          this.user._patch(user);
        } else {
          this.user = this.users.create(user);
        }
        this.emit('ready');
        return this;
      });
  }


  /**
   * Fetch a guild
   * @param {Snowflake} id Guild ID
   * @param {number} [timeout] Timeout request
   * @returns {Promise<Guild>}
   */
  getGuild(id, timeout) {
    return this.request(RPCCommands.GET_GUILD, { guild_id: id, timeout })
      .then((guild) => this.guilds.create(guild));
  }

  /**
   * Fetch all guilds
   * @param {number} [timeout] Timeout request
   * @returns {Promise<Collection<Snowflake, Guild>>}
   */
  getGuilds(timeout) {
    return this.request(RPCCommands.GET_GUILDS, { timeout })
      .then(({ guilds }) => {
        const c = new Collection();
        for (const guild of guilds) {
          c.set(guild.id, this.guilds.create(guild));
        }
        return c;
      });
  }

  /**
   * Get a channel
   * @param {Snowflake} id Channel id
   * @param {number} [timeout] Timeout request
   * @returns {Promise<Channel>}
   */
  getChannel(id, timeout) {
    return this.request(RPCCommands.GET_CHANNEL, { channel_id: id, timeout })
      .then((channel) => {
        if (channel.guild_id) {
          return this.getGuild(channel.guild_id);
        }

        return Channel.create(this, channel);
      });
  }

  /**
   * Get all channels
   * @param {number} [timeout] Timeout request
   * @returns {Promise<Collection<Snowflake, Channel>>}
   */
  getChannels(timeout) {
    return this.request(RPCCommands.GET_CHANNELS, { timeout })
      .then(async ({ channels }) => {
        const guilds = new Collection();
        const c = new Collection();
        for (const channel of channels) {
          const { guild_id: guildId } = channel;

          if (guildId && !guilds.has(guildId)) {
            // eslint-disable-next-line no-await-in-loop
            guilds.set(guildId, await this.getGuild(guildId));
          }
          c.set(channel.id, this.channels.create(channel, guilds.get(channel.guild_id)));
        }
        return c;
      });
  }

  /**
   * @typedef {CertifiedDevice}
   * @prop {string} type One of `AUDIO_INPUT`, `AUDIO_OUTPUT`, `VIDEO_INPUT`
   * @prop {string} uuid This device's Windows UUID
   * @prop {object} vendor Vendor information
   * @prop {string} vendor.name Vendor's name
   * @prop {string} vendor.url Vendor's url
   * @prop {object} model Model information
   * @prop {string} model.name Model's name
   * @prop {string} model.url Model's url
   * @prop {string[]} related Array of related product's Windows UUIDs
   * @prop {boolean} echoCancellation If the device has echo cancellation
   * @prop {boolean} noiseSuppression If the device has noise suppression
   * @prop {boolean} automaticGainControl If the device has automatic gain control
   * @prop {boolean} hardwareMute If the device has a hardware mute
   */

  /**
   * Tell discord which devices are certified
   * @param {CertifiedDevice[]} devices Certified devices to send to discord
   * @returns {Promise}
   */
  setCertifiedDevices(devices) {
    return this.request(RPCCommands.SET_CERTIFIED_DEVICES, {
      devices: devices.map((d) => ({
        type: Constants.DeviceTypes[d.type],
        id: d.uuid,
        vendor: d.vendor,
        model: d.model,
        related: d.related,
        echo_cancellation: d.echoCancellation,
        noise_suppression: d.noiseSuppression,
        automatic_gain_control: d.automaticGainControl,
        hardware_mute: d.hardwareMute,
      })),
    });
  }

  /**
   * @typedef {UserVoiceSettings}
   * @prop {Snowflake} id ID of the user these settings apply to
   * @prop {?Object} [pan] Pan settings, an object with `left` and `right` set between
   * 0.0 and 1.0, inclusive
   * @prop {?number} [volume=100] The volume
   * @prop {bool} [mute] If the user is muted
   */

  /**
   * Set the voice settings for a uer, by id
   * @param {Snowflake} id ID of the user to set
   * @param {UserVoiceSettings} settings Settings
   * @returns {Promise}
   */
  setUserVoiceSettings(id, settings) {
    return this.request(RPCCommands.SET_USER_VOICE_SETTINGS, {
      user_id: id,
      pan: settings.pan,
      mute: settings.mute,
      volume: settings.volume,
    });
  }

  /**
   * Move the user to a voice channel
   * @param {Snowflake} id ID of the voice channel
   * @param {Object} [options] Options
   * @param {number} [options.timeout] Timeout for the command
   * @param {boolean} [options.force] Force this move. This should only be done if you
   * have explicit permission from the user.
   * @returns {Promise}
   */
  selectVoiceChannel(id, { timeout, force = false } = {}) {
    return this.request(RPCCommands.SELECT_VOICE_CHANNEL, { channel_id: id, timeout, force });
  }

  /**
   * Move the user to a text channel
   * @param {Snowflake} id ID of the voice channel
   * @param {Object} [options] Options
   * @param {number} [options.timeout] Timeout for the command
   * @param {boolean} [options.force] Force this move. This should only be done if you
   * have explicit permission from the user.
   * @returns {Promise}
   */
  selectTextChannel(id, { timeout, force = false } = {}) {
    return this.request(RPCCommands.SELECT_TEXT_CHANNEL, { channel_id: id, timeout, force });
  }

  /**
   * Get current voice settings
   * @returns {Promise}
   */
  getVoiceSettings() {
    return this.request(RPCCommands.GET_VOICE_SETTINGS)
      .then((s) => ({
        automaticGainControl: s.automatic_gain_control,
        echoCancellation: s.echo_cancellation,
        noiseSuppression: s.noise_suppression,
        qos: s.qos,
        silenceWarning: s.silence_warning,
        deaf: s.deaf,
        mute: s.mute,
        input: {
          availableDevices: s.input.available_devices,
          device: s.input.device_id,
          volume: s.input.volume,
        },
        output: {
          availableDevices: s.output.available_devices,
          device: s.output.device_id,
          volume: s.output.volume,
        },
        mode: {
          type: s.mode.type,
          autoThreshold: s.mode.auto_threshold,
          threshold: s.mode.threshold,
          shortcut: s.mode.shortcut.map((sc) => ({
            name: sc.name,
            code: sc.code,
            type: Object.keys(Constants.KeyTypes)[sc.type],
          })),
          delay: s.mode.delay,
        },
      }));
  }

  /**
   * Set current voice settings, overriding the current settings until this session disconnects.
   * This also locks the settings for any other rpc sessions which may be connected.
   * @param {Object} args Settings
   * @returns {Promise}
   */
  setVoiceSettings(args) {
    return this.request(RPCCommands.SET_VOICE_SETTINGS, {
      automatic_gain_control: args.automaticGainControl,
      echo_cancellation: args.echoCancellation,
      noise_suppression: args.noiseSuppression,
      qos: args.qos,
      silence_warning: args.silenceWarning,
      deaf: args.deaf,
      mute: args.mute,
      input: args.input ? {
        device_id: args.input.device,
        volume: args.input.volume,
      } : undefined,
      output: args.output ? {
        device_id: args.output.device,
        volume: args.output.volume,
      } : undefined,
      mode: args.mode ? {
        mode: args.mode.type,
        auto_threshold: args.mode.autoThreshold,
        threshold: args.mode.threshold,
        shortcut: args.mode.shortcut.map((sc) => ({
          name: sc.name,
          code: sc.code,
          type: Constants.KeyTypes[sc.type.toUpperCase()],
        })),
        delay: args.mode.delay,
      } : undefined,
    });
  }

  /**
   * Capture a shortcut using the client
   * The callback takes (key, stop) where `stop` is a function that will stop capturing.
   * This `stop` function must be called before disconnecting or else the user will have
   * to restart their client.
   * @param {Function} callback Callback handling keys
   * @returns {Promise<Function>}
   */
  captureShortcut(callback) {
    const subid = subKey(RPCEvents.CAPTURE_SHORTCUT_CHANGE);
    const stop = () => {
      this._subscriptions.delete(subid);
      return this.request(RPCCommands.CAPTURE_SHORTCUT, { action: 'STOP' });
    };
    this._subscriptions.set(subid, ({ shortcut }) => {
      const keys = shortcut.map((sc) => ({
        name: sc.name,
        code: sc.code,
        type: Object.keys(Constants.KeyTypes)[sc.type],
      }));
      callback(keys, stop);
    });
    return this.request(RPCCommands.CAPTURE_SHORTCUT, { action: 'START' })
      .then(() => stop);
  }

  setActivity(args = {}, pid = getPid()) {
    let timestamps;
    let assets;
    let party;
    let secrets;
    if (args.startTimestamp || args.endTimestamp) {
      timestamps = {
        start: args.startTimestamp,
        end: args.endTimestamp,
      };
      if (timestamps.start instanceof Date) {
        timestamps.start = Math.round(timestamps.start.getTime() / 1000);
      }
      if (timestamps.end instanceof Date) {
        timestamps.end = Math.round(timestamps.end.getTime() / 1000);
      }
    }
    if (
      args.largeImageKey || args.largeImageText ||
      args.smallImageKey || args.smallImageText
    ) {
      assets = {
        large_image: args.largeImageKey,
        large_text: args.largeImageText,
        small_image: args.smallImageKey,
        small_text: args.smallImageText,
      };
    }
    if (args.partySize || args.partyId || args.partyMax) {
      party = { id: args.partyId };
      if (args.partySize || args.partyMax) {
        party.size = [args.partySize, args.partyMax];
      }
    }
    if (args.matchSecret || args.joinSecret || args.spectateSecret) {
      secrets = {
        match: args.matchSecret,
        join: args.joinSecret,
        spectate: args.spectateSecret,
      };
    }

    return this.request(RPCCommands.SET_ACTIVITY, {
      pid,
      activity: {
        state: args.state,
        details: args.details,
        timestamps,
        assets,
        party,
        secrets,
        instance: !!args.instance,
      },
    });
  }

  /**
   * Clears the currently set presence, if any. This will hide the "Playing X" message
   * displayed below the user's name.
   * @param {number} [pid] The application's process ID. Defaults to the executing process' PID.
   * @returns {Promise}
   */
  clearActivity(pid = getPid()) {
    return this.request(RPCCommands.SET_ACTIVITY, {
      pid,
    });
  }

  /**
   * Invite a user to join the game the RPC user is currently playing
   * @param {User} user The user to invite
   * @returns {Promise}
   */
  sendJoinInvite(user) {
    return this.request(RPCCommands.SEND_ACTIVITY_JOIN_INVITE, {
      user_id: user.id || user,
    });
  }

  /**
   * Request to join the game the user is playing
   * @param {User} user The user whose game you want to request to join
   * @returns {Promise}
   */
  sendJoinRequest(user) {
    return this.request(RPCCommands.SEND_ACTIVITY_JOIN_REQUEST, {
      user_id: user.id || user,
    });
  }

  /**
   * Reject a join request from a user
   * @param {User} user The user whose request you wish to reject
   * @returns {Promise}
   */
  closeJoinRequest(user) {
    return this.request(RPCCommands.CLOSE_ACTIVITY_JOIN_REQUEST, {
      user_id: user.id || user,
    });
  }

  async createLobby(type, capacity, metadata) {
    const data = await this.request(RPCCommands.CREATE_LOBBY, {
      type: Lobby.Types[type.toUpperCase()] || type,
      capacity,
      metadata,
    });

    return new Lobby(this, data);
  }

  async updateLobby(lobby, { type, owner, capacity, metadata } = {}) {
    const data = await this.request(RPCCommands.UPDATE_LOBBY, {
      id: lobby.id || lobby,
      type: type !== undefined ? Lobby.Types[type.toUpperCase()] || type : undefined,
      owner_id: (owner && owner.id) || owner,
      capacity,
      metadata,
    });

    return new Lobby(this, data);
  }

  deleteLobby(lobby) {
    return this.request(RPCCommands.DELETE_LOBBY, {
      id: lobby.id || lobby,
    });
  }

  async connectToLobby(id, secret) {
    const data = await this.request(RPCCommands.CONNECT_TO_LOBBY, {
      id,
      secret,
    });

    return new Lobby(this, data);
  }

  sendToLobby(lobby, data) {
    return this.request(RPCCommands.SEND_TO_LOBBY, {
      id: lobby.id || lobby,
      data,
    });
  }

  disconnectFromLobby(lobby) {
    return this.request(RPCCommands.DISCONNECT_FROM_LOBBY, {
      id: lobby.id || lobby,
    });
  }

  updateLobbyMember(lobby, user, metadata) {
    return this.request(RPCCommands.UPDATE_LOBBY_MEMBER, {
      lobby_id: lobby.id || lobby,
      user_id: user.id || user,
      metadata,
    });
  }

  /**
   * Subscribe to an event
   * @param {string} event Name of event e.g. `MESSAGE_CREATE`
   * @param {Object} [args] Args for event e.g. `{ channel_id: '1234' }`
   * @param {Function} callback Callback when an event for the subscription is triggered
   * @returns {Promise<Object>}
   */
  subscribe(event, args, callback) {
    if (!callback && typeof args === 'function') {
      callback = args;
      args = undefined;
    }
    return this.request(RPCCommands.SUBSCRIBE, args, event).then(() => {
      const subid = subKey(event, args);
      this._subscriptions.set(subid, callback);
      return {
        unsubscribe: () => this.request(RPCCommands.UNSUBSCRIBE, args, event)
          .then(() => this._subscriptions.delete(subid)),
      };
    });
  }

  /**
   * Destroy the client
   */
  async destroy() {
    super.destroy();
    this.transport.close();
  }
}

module.exports = RPCClient;
