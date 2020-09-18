'use strict';

const EventEmitter = require('events');
const { setTimeout, clearTimeout } = require('timers');
const fetch = require('node-fetch');
const transports = require('./transports');
const { RPCCommands, RPCEvents, RelationshipTypes } = require('./constants');
const { pid: getPid, uuid } = require('./util');

function subKey(event, args) {
  return `${event}${JSON.stringify(args)}`;
}

/**
 * @typedef {string} Snowflake A Twitter snowflake, except the epoch is 2015-01-01T00:00:00.000Z
 * {@link https://discord.com/developers/docs/reference#snowflakes}
 */

/**
 * @typedef {Object} BaseApplication
 * @prop {string} name The application name
 * @prop {Snowflake} application_id The application ID
 */

/**
 * @typedef {Object} RPCClientOptions
 * @prop {'ipc' | 'websocket'} transport RPC transport
 * @prop {string} [origin] Origin - Used for `websocket` transport
 */

/**
 * The main hub for interacting with Discord RPC
 * @extends {EventEmitter}
 */
class RPCClient extends EventEmitter {
  /**
   * @param {RPCClientOptions} [options] Options for the client
   * You must provide a transport
   */
  constructor(options = {}) {
    super();

    /**
     * Options for this client
     * @type {RPCClientOptions}
     */
    this.options = options;

    /**
     * The access token for the connected user
     * @type {?string}
     */
    this.accessToken = null;

    /**
     * The client ID
     * @type {?Snowflake}
     */
    this.clientId = null;

    /**
     * Application used in this client
     * @type {?Object<string, *>}
     */
    this.application = null;

    /**
     * User user in this application
     * @type {?Object<string, *>}
     */
    this.user = null;

    const Transport = transports[options.transport];
    if (!Transport) {
      throw new TypeError('RPC_INVALID_TRANSPORT', options.transport);
    }

    this.fetch = (method, path, { data, query } = {}) =>
      fetch(`${this.fetch.endpoint}${path}${query ? new URLSearchParams(query) : ''}`, {
        method,
        body: data,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }).then(async (r) => {
        const body = await r.json();
        if (!r.ok) {
          const e = new Error(r.status);
          e.body = body;
          throw e;
        }
        return body;
      });

    this.fetch.endpoint = 'https://discord.com/api';

    /**
     * The transport used
     * @type {RPCTransport}
     * @private
     */
    this.transport = new Transport(this);
    this.transport.on('message', this._onRpcMessage.bind(this));

    /**
     * @typedef {Object} ExpectedRequest
     * @prop {function(Object<string, *>): undefined} resolve
     * @prop {function(Error): undefined} reject
     */
    /**
     * Map of nonces being expected from the transport
     * @type {Map<string, ExpectedRequest>}
     * @private
     */
    this._expecting = new Map();

    /**
     * Map of current subscriptions
     * @type {Map<string, SubscriptionCallback>}
     * @private
     */
    this._subscriptions = new Map();

    /**
     * The connection promise
     * @type {?Promise<RPCClient>}
     * @private
     */
    this._connectPromise = undefined;
  }

  /**
   * Search and connect to RPC.
   * @param {Snowflake} clientId The client ID
   * @returns {Promise<RPCClient>}
   */
  connect(clientId) {
    if (this._connectPromise) {
      return this._connectPromise;
    }
    this._connectPromise = new Promise((resolve, reject) => {
      this.clientId = clientId;
      const timeout = setTimeout(() => reject(new Error('RPC_CONNECTION_TIMEOUT')), 10e3);
      timeout.unref();
      this.once('connected', () => {
        clearTimeout(timeout);
        resolve(this);
      });
      this.transport.once('close', () => {
        this._expecting.forEach((e) => {
          e.reject(new Error('connection closed'));
        });
        this.emit('disconnected');
        reject(new Error('connection closed'));
      });
      this.transport.connect().catch(reject);
    });
    return this._connectPromise;
  }

  /**
   * @typedef {Object} RPCLoginOptions RPC Login options
   * @prop {Snowflake} clientId Client ID
   * @prop {string} [clientSecret] Client secret
   * @prop {string} [accessToken] Access token
   * @prop {string} [rpcToken] RPC token
   * @prop {string} [redirectUri] Token endpoint
   * @prop {string[]} [scopes] Scopes to authorize with
   */

  /**
   * Performs authentication flow. Automatically calls Client#connect if needed.
   * @param {RPCLoginOptions} options Options for authentication.
   * At least one property must be provided to perform login.
   * @example client.login({ clientId: '1234567', clientSecret: 'abcdef123' });
   * @returns {Promise<RPCClient>}
   */
  async login(options) {
    let { clientId, accessToken } = options;
    await this.connect(clientId);
    if (!options.scopes) {
      this.emit('ready');
      return this;
    }
    if (!accessToken) {
      accessToken = await this.authorize(options);
    }
    return this.authenticate(accessToken);
  }

  /**
   * Make a request to the RPC server.
   * @param {string} command The command to send
   * @param {Object<string, *>} [args] Arguments
   * @param {string} [event] Event
   * @returns {Promise<Object<string, *>>}
   * @private
   */
  request(command, args, event) {
    return new Promise((resolve, reject) => {
      const nonce = uuid();
      this.transport.send({ cmd: command, args, evt: event, nonce });
      this._expecting.set(nonce, { resolve, reject });
    });
  }

  /**
   * Message handler.
   * @param {Object} message The message recieved
   * @param {Object<string, *>} [message.args] The message arguments
   * @param {string} message.cmd The command sent
   * @param {string} message.evt The event
   * @param {Object<string, *>} message.data The data for this message
   * @param {?string} message.nonce The nonce
   * @private
   */
  _onRpcMessage(message) {
    if (message.cmd === RPCCommands.DISPATCH && message.evt === RPCEvents.READY) {
      if (message.data.user) {
        this.user = message.data.user;
      }
      this.emit('connected');
    } else if (this._expecting.has(message.nonce)) {
      const { resolve, reject } = this._expecting.get(message.nonce);
      if (message.evt === RPCEvents.ERROR) {
        const e = new Error(message.data.message);
        e.code = message.data.code;
        e.data = message.data;
        reject(e);
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
   * Send a request to authorize.
   * @param {Object} options options
   * @param {string} options.clientSecret Client secret
   * @param {string} options.redirectUri Redirect URI
   * @param {string|true} [options.rpcToken] RPC Token, pass `true` to automatically fetch
   * @param {string[]} options.scopes Authorization scopes
   * @returns {Promise<string>} The access token
   * @private
   */
  async authorize({ scopes, clientSecret, rpcToken, redirectUri } = {}) {
    if (clientSecret && rpcToken === true) {
      const body = await this.fetch('POST', '/oauth2/token/rpc', {
        data: new URLSearchParams({
          client_id: this.clientId,
          client_secret: clientSecret,
        }),
      });
      rpcToken = body.rpc_token;
    }

    const { code } = await this.request('AUTHORIZE', {
      scopes,
      client_id: this.clientId,
      rpc_token: rpcToken,
    });

    const response = await this.fetch('POST', '/oauth2/token', {
      data: new URLSearchParams({
        client_id: this.clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    return response.access_token;
  }

  /**
   * Makes an authentication request.
   * @param {string} accessToken Access token
   * @returns {Promise<RPCClient>}
   * @private
   */
  authenticate(accessToken) {
    return this.request('AUTHENTICATE', { access_token: accessToken })
      .then(({ application, user }) => {
        this.accessToken = accessToken;
        this.application = application;
        this.user = user;
        this.emit('ready');
        return this;
      });
  }


  /**
   * Fetch a guild.
   * @param {Snowflake} id Guild ID
   * @param {number} [timeout] Timeout request
   * @returns {Promise<Object<string, *>>}
   */
  getGuild(id, timeout) {
    return this.request(RPCCommands.GET_GUILD, { guild_id: id, timeout });
  }

  /**
   * Fetch all guilds.
   * @param {number} [timeout] Timeout request
   * @returns {Promise<Object<string, *>[]>}
   */
  getGuilds(timeout) {
    return this.request(RPCCommands.GET_GUILDS, { timeout });
  }

  /**
   * Get a channel.
   * @param {Snowflake} id Channel ID
   * @param {number} [timeout] Timeout request
   * @returns {Promise<Object<string, *>>}
   */
  getChannel(id, timeout) {
    return this.request(RPCCommands.GET_CHANNEL, { channel_id: id, timeout });
  }

  /**
   * Get all channels.
   * @param {Snowflake} [id] Guild ID
   * @param {number} [timeout] Timeout request
   * @returns {Promise<Object<string, *>[]>}
   */
  async getChannels(id, timeout) {
    const { channels } = await this.request(RPCCommands.GET_CHANNELS, {
      timeout,
      guild_id: id,
    });
    return channels;
  }

  /**
   * @typedef {Object} CertifiedDevice
   * @prop {string} type One of `audioinput`, `audiooutput`, `videoinput`
   * @prop {string} uuid This device's Windows UUID
   * @prop {Object} vendor Vendor information
   * @prop {string} vendor.name Vendor's name
   * @prop {string} vendor.url Vendor's url
   * @prop {Object} model Model information
   * @prop {string} model.name Model's name
   * @prop {string} model.url Model's url
   * @prop {string[]} related Array of related product's Windows UUIDs
   * @prop {boolean} [echoCancellation] If the device has echo cancellation
   * @prop {boolean} [noiseSuppression] If the device has noise suppression
   * @prop {boolean} [automaticGainControl] If the device has automatic gain control
   * @prop {boolean} [hardwareMute] If the device has a hardware mute
   */

  /**
   * Tell discord which devices are certified
   * @param {CertifiedDevice[]} devices Certified devices to send to discord
   * @returns {Promise<undefined>}
   */
  setCertifiedDevices(devices) {
    return this.request(RPCCommands.SET_CERTIFIED_DEVICES, {
      devices: devices.map((d) => ({
        type: d.type,
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
   * @typedef {Object} UserVoiceSettings
   * @prop {Snowflake} user_id ID of the user these settings apply to
   * @prop {Object} [pan] Pan settings
   * @prop {number} [pan.left] Left pan, set between 0.0 and 1
   * @prop {number} [pan.right] Right pan, set between 0.0 and 1
   * @prop {number} [volume] The volume
   * @prop {boolean} [mute] If the user is muted
   */

  /**
   * Set the voice settings for a user, by id.
   * @param {Snowflake} id ID of the user to set
   * @param {UserVoiceSettings} settings Settings
   * @returns {Promise<UserVoiceSettings>}
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
   * Move the user to a voice channel.
   * @param {Snowflake} id ID of the voice channel
   * @param {Object} [options] Options
   * @param {number} [options.timeout] Timeout for the command
   * @param {boolean} [options.force] Force this move. This should only be done if you
   * have explicit permission from the user.
   * @returns {Promise<Object<string, *>}
   */
  selectVoiceChannel(id, { timeout, force = false } = {}) {
    return this.request(RPCCommands.SELECT_VOICE_CHANNEL, { channel_id: id, timeout, force });
  }

  /**
   * Move the user to a text channel.
   * @param {Snowflake} id ID of the voice channel
   * @param {Object} [options] Options
   * @param {number} [options.timeout] Timeout for the command
   * @returns {Promise<Object<string, *>>}
   */
  selectTextChannel(id, { timeout } = {}) {
    return this.request(RPCCommands.SELECT_TEXT_CHANNEL, { channel_id: id, timeout });
  }

  /**
   * @typedef {Object} AvailableDevice
   * @prop {string} id The ID of this device
   * @prop {string} name The name of this device
   */

  /**
   * @typedef {Object} ShortcutKeyCombo
   * @prop {number} type The type, {@link https://discord.com/developers/docs/topics/rpc#getvoicesettings-key-types}
   * @prop {number} code The key code
   * @prop {string} name The key name
   */

  /**
   * @typedef {Object} VoiceSettings Voice settings
   * @prop {boolean} [automaticGainControl] Automatic gain control
   * @prop {boolean} [echoCancellation] Echo cancellation
   * @prop {boolean} [noiseSuppression] Noise suppresion
   * @prop {boolean} [qos] State of voice quality of service
   * @prop {boolean} [silenceWarning] State of silence warning notice
   * @prop {boolean} [deaf] Whether the user is deafened
   * @prop {boolean} [mute] Whether the user is muted
   * @prop {Object} [input] Input settings
   * @prop {string} [input.device] Device ID
   * @prop {number} [input.volume] Volume (min: 0, max: 100)
   * @prop {AvailableDevice[]} [input.availableDevices] Available devices
   * <info>This is read-only</info>
   * @prop {Object} [output] Output settings
   * @prop {string} [output.device] Device ID
   * @prop {number} [output.volume] Volume (min: 0, max: 200)
   * @prop {AvailableDevice[]} [output.availableDevices] Available devices
   * <info>This is read-only</info>
   * @prop {Object} [mode] Voice mode settings
   * @prop {string} [mode.type] The type, `PUSH_TO_TALK` or `VOICE_ACTIVITY`
   * @prop {boolean} [mode.autoThreshold] Whether automatic voice threshold is enabled
   * @prop {number} [mode.delay] The Push To Talk delay in milliseconds (min: 0, max: 2000)
   * @prop {ShortcutKeyCombo} [mode.shortcut] The shortcut key combination for PTT
   */

  /**
   * Get current voice settings.
   * @returns {Promise<VoiceSettings>}
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
          shortcut: s.mode.shortcut,
          delay: s.mode.delay,
        },
      }));
  }

  /**
   * Set current voice settings, overriding the current settings until this session disconnects.
   * This also locks the settings for any other rpc sessions which may be connected.
   * @param {VoiceSettings} settings The new settings to use
   * @returns {Promise<Object<string, *>>} The new settigns
   */
  setVoiceSettings(settings) {
    return this.request(RPCCommands.SET_VOICE_SETTINGS, {
      automatic_gain_control: settings.automaticGainControl,
      echo_cancellation: settings.echoCancellation,
      noise_suppression: settings.noiseSuppression,
      qos: settings.qos,
      silence_warning: settings.silenceWarning,
      deaf: settings.deaf,
      mute: settings.mute,
      input: settings.input ? {
        device_id: settings.input.device,
        volume: settings.input.volume,
      } : undefined,
      output: settings.output ? {
        device_id: settings.output.device,
        volume: settings.output.volume,
      } : undefined,
      mode: settings.mode ? {
        mode: settings.mode.type,
        auto_threshold: settings.mode.autoThreshold,
        threshold: settings.mode.threshold,
        shortcut: settings.mode.shortcut,
        delay: settings.mode.delay,
      } : undefined,
    });
  }

  /**
   * @callback ShortcutCallback
   * @param {ShortcutKeyCombo} shortcut
   * @param {function(): undefined} stop
   */

  /**
   * Capture a shortcut using the client.
   * The callback takes (key, stop) where `stop` is a function that will stop capturing.
   * This `stop` function must be called before disconnecting or else the user will have
   * to restart their client.
   * @param {ShortcutCallback} callback Callback handling keys
   * @returns {Promise<function(): undefined>}
   */
  captureShortcut(callback) {
    const subid = subKey(RPCEvents.CAPTURE_SHORTCUT_CHANGE);
    const stop = () => {
      this._subscriptions.delete(subid);
      return this.request(RPCCommands.CAPTURE_SHORTCUT, { action: 'STOP' });
    };
    this._subscriptions.set(subid, ({ shortcut }) => {
      callback(shortcut, stop);
    });
    return this.request(RPCCommands.CAPTURE_SHORTCUT, { action: 'START' })
      .then(() => stop);
  }

  /**
   * @typedef {Object} Presence
   * @prop {string} [state] The state
   * @prop {string} [details] Details
   * @prop {boolean} [instance] Whether or not the activity is in a game session
   * @prop {Object} [timestamps] Timestamps
   * @prop {number} [timestamps.start] The start of this activity (unix timestamp in ms)
   * @prop {number} [timestamps.end] The end of this activity (unix timestamp in ms)
   * @prop {Object} [assets] Assets for this activity
   * @prop {string} [assets.largeImage] The asset name for the large image
   * @prop {string} [assets.smallImage] The asset name for the small image
   * @prop {string} [assets.largeText] The hover text for the large image
   * @prop {string} [assets.smallText] The hover text for the small image
   * @prop {Object} [party] The party
   * @prop {string} [party.id] The party ID
   * @prop {[number, number]} [party.size] The size of this party, [current size, max size]
   * @prop {Object} [secrets] The secrets for this party
   * @prop {string} [secrets.join] The join secret
   * @prop {string} [secrets.spectate] The spectate secret
   * @prop {string} [secrets.match] The match secret
   */

  /**
   * Sets the presence for the logged in user.
   * @param {object} args The rich presence to pass.
   * @param {number} [pid] The application's process ID. Defaults to the executing process' PID.
   * @returns {Promise<Presence & BaseApplication>}
   */
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
        timestamps.start = Math.round(timestamps.start.getTime());
      }
      if (timestamps.end instanceof Date) {
        timestamps.end = Math.round(timestamps.end.getTime());
      }
      if (timestamps.start > 2147483647000) {
        throw new RangeError('timestamps.start must fit into a unix timestamp');
      }
      if (timestamps.end > 2147483647000) {
        throw new RangeError('timestamps.end must fit into a unix timestamp');
      }
    }
    if (
      args.largeImageKey || args.largeImageText
      || args.smallImageKey || args.smallImageText
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
   * Clears the currently set presence, if any.
   * @param {number} [pid] The application's process ID. Defaults to the executing process' PID.
   * @returns {Promise<undefined>}
   */
  clearActivity(pid = getPid()) {
    return this.request(RPCCommands.SET_ACTIVITY, {
      pid,
    });
  }

  /**
   * Invite a user to join the game the RPC user is currently playing.
   * @param {Snowflake} user The user to invite
   * @returns {Promise<undefined>}
   */
  sendJoinInvite(user) {
    return this.request(RPCCommands.SEND_ACTIVITY_JOIN_INVITE, {
      user_id: user.id || user,
    });
  }

  /**
   * Request to join the game the user is playing.
   * @param {Snowflake} user The user whose game you want to request to join
   * @returns {Promise<never>}
   * @deprecated This command was removed
   */
  sendJoinRequest(user) {
    return this.request(RPCCommands.SEND_ACTIVITY_JOIN_REQUEST, {
      user_id: user.id || user,
    });
  }

  /**
   * Reject a join request from a user.
   * @param {Snowflake} user The user whose request you wish to reject
   * @returns {Promise<never>}
   * @deprecated This command was removed
   */
  closeJoinRequest(user) {
    return this.request(RPCCommands.CLOSE_ACTIVITY_JOIN_REQUEST, {
      user_id: user.id || user,
    });
  }

  /**
   * Create a lobby.
   * @param {number} type The lobby type
   * @param {number} capacity The lobby capacity
   * @param {Object<string, *>} metadata The lobby metadata
   * @returns {Promise<Object>} The lobby
   */
  createLobby(type, capacity, metadata) {
    return this.request(RPCCommands.CREATE_LOBBY, {
      type,
      capacity,
      metadata,
    });
  }

  /**
   * Update a lobby.
   * @param {Snowflake} lobby The lobby ID
   * @param {Object} [options] Options for updating the lobby
   * @param {number} [options.type] The new lobby type
   * @param {Snowflake} [options.owner] The new lobby owner
   * @param {number} [options.capacity] The new lobby capacity
   * @param {Object<string, *>} [options.metadata] The new lobby metadata
   * @returns {Promise<undefined>}
   */
  updateLobby(lobby, { type, owner, capacity, metadata } = {}) {
    return this.request(RPCCommands.UPDATE_LOBBY, {
      id: lobby.id || lobby,
      type,
      owner_id: (owner && owner.id) || owner,
      capacity,
      metadata,
    });
  }

  /**
   * Delete a lobby.
   * @param {Snowflake} lobby The lobby ID
   * @returns {Promise<undefined>}
   */
  deleteLobby(lobby) {
    return this.request(RPCCommands.DELETE_LOBBY, {
      id: lobby.id || lobby,
    });
  }

  /**
   * Connect to a lobby.
   * @param {Snowflake} id The lobby ID
   * @param {string} secret The lobby join secrets
   * @returns {Promise<Object<string, *>>} The lobby
   */
  connectToLobby(id, secret) {
    return this.request(RPCCommands.CONNECT_TO_LOBBY, {
      id,
      secret,
    });
  }

  /**
   * Send the connected user to a lobby.
   * @param {Snowflake} lobby The lobby ID
   * @param {Object<string, *>} data Data
   * @returns {Promise<undefined>}
   */
  sendToLobby(lobby, data) {
    return this.request(RPCCommands.SEND_TO_LOBBY, {
      id: lobby.id || lobby,
      data,
    });
  }

  /**
   * Disconnect the connected user from a lobby.
   * @param {Snowflake} lobby The lobby ID
   * @returns {Promise<undefined>}
   */
  disconnectFromLobby(lobby) {
    return this.request(RPCCommands.DISCONNECT_FROM_LOBBY, {
      id: lobby.id || lobby,
    });
  }

  /**
   * Update a lobby member.
   * @param {Snowflake} lobby The lobby ID
   * @param {Snowflake} user The lobby member ID
   * @param {Object<string, *>} metadata Metadata
   * @returns {Promise<undefined>}
   */
  updateLobbyMember(lobby, user, metadata) {
    return this.request(RPCCommands.UPDATE_LOBBY_MEMBER, {
      lobby_id: lobby.id || lobby,
      user_id: user.id || user,
      metadata,
    });
  }

  /**
   * Get relationships for the connected user.
   * @returns {Object<string, *>[]} The relationships
   */
  getRelationships() {
    const types = Object.keys(RelationshipTypes);
    return this.request(RPCCommands.GET_RELATIONSHIPS)
      .then((o) => o.relationships.map((r) => ({
        ...r,
        type: types[r.type],
      })));
  }

  /**
   * @callback SubscriptionCallback
   * @param {Object<string, *>} data The data
   */

  /**
   * @typedef {Object} Subscription
   * @prop {function(): undefined} unsubcribe Unsubcribe from the event
   */

  /**
   * Subscribe to an event.
   * @param {string} event Name of event e.g. `MESSAGE_CREATE`
   * @param {Object} [args] Args for event e.g. `{ channel_id: '1234' }`
   * @param {SubscriptionCallback} callback Callback when an event for the subscription is triggered
   * @returns {Promise<Subscription>}
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
   * Destroy the client.
   * @returns {Promise<undefined>}
   */
  async destroy() {
    await this.transport.close();
  }
}

module.exports = RPCClient;
