'use strict';

const EventEmitter = require('events');
const { setTimeout, clearTimeout } = require('timers');
const fetch = require('node-fetch');
const transports = require('./transports');
const { BASE_API_URL, RPCCommands, RPCEvents, RelationshipTypes } = require('./constants');
const { pid: getPid, uuid } = require('./util');
const { Error, TypeError, RangeError } = require('./errors');

const subKey = (event, args) => `${event}${JSON.stringify(args)}`;

const formatVoiceSettings = (data) => ({
  automaticGainControl: data.automatic_gain_control,
  echoCancellation: data.echo_cancellation,
  noiseSuppression: data.noise_suppression,
  qos: data.qos,
  silenceWarning: data.silence_warning,
  deaf: data.deaf,
  mute: data.mute,
  input: {
    availableDevices: data.input.available_devices,
    device: data.input.device_id,
    volume: data.input.volume,
  },
  output: {
    availableDevices: data.output.available_devices,
    device: data.output.device_id,
    volume: data.output.volume,
  },
  mode: {
    type: data.mode.type,
    autoThreshold: data.mode.auto_threshold,
    threshold: data.mode.threshold,
    shortcut: data.mode.shortcut,
    delay: data.mode.delay,
  },
});

/**
 * @typedef {RPCClientOptions}
 * @extends {ClientOptions}
 * @prop {string} transport RPC transport. one of `ipc` or `websocket`
 */

/**
 * The main hub for interacting with Discord RPC
 * @extends {BaseClient}
 */
class RPCClient extends EventEmitter {
  /**
   * @param {RPCClientOptions} [options] Options for the client.
   * You must provide a transport
   */
  constructor(options = {}) {
    super();

    this.options = options;

    this.accessToken = null;
    this.clientId = null;

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
      throw new TypeError('INVALID_TYPE', 'options.transport', '\'ipc\' or \'websocket\'', options.transport);
    }

    /**
     * Raw transport userd
     * @type {RPCTransport}
     * @private
     */
    this.transport = new Transport(this);
    this._onRpcClose = this._onRpcClose.bind(this);
    this._onRpcMessage = this._onRpcMessage.bind(this);

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

    this._connectPromise = null;

    /**
     * Whether or not the client is connected
     * @type {boolean}
     */
    this.connected = false;
  }

  /**
   * @typedef {Object} RequestOptions
   * @prop {Record<string, any>} [data] Request data
   * @prop {string|[string, string][]|URLSearchParams} [query] Request query
   */

  /**
   * Makes an API Request.
   * @param {string} method Request method
   * @param {string} path Request path
   * @param {RequestOptions} [options] Request Options
   */
  async fetch(method, path, { data, query } = {}) {
    const response = await fetch(`${BASE_API_URL}/${path}${query ? `?${new URLSearchParams(query)}` : ''}`, {
      method,
      body: data,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
    const body = await response.json();
    if (!response.ok) {
      const error = new Error(response.status);
      error.body = body;
      throw error;
    }
    return body;
  }

  /**
   * Search and connect to RPC
   */
  connect(clientId) {
    if (this._connectPromise) {
      return this._connectPromise;
    }
    this._connectPromise = new Promise((resolve, reject) => {
      /* eslint-disable no-use-before-define */
      const removeListeners = () => {
        this.transport.off('close', onClose);
        this.off('connected', onConnect);
        this.off('destroyed', onClose);
        clearTimeout(timeout);
      };
      /* eslint-enable no-use-before-define */
      const onConnect = (() => {
        this.connected = true;
        removeListeners();
        resolve(this);
      });
      const onClose = (error) => {
        removeListeners();
        this.destroy();
        reject(error || new Error('CONNECTION_CLOSED'));
      };
      this.once('destroyed', onClose);
      this.once('connected', onConnect);
      this.transport.once('close', onClose);
      this._setupListeners();

      this.clientId = clientId;
      this.transport.connect().catch(onClose);
      const timeout = setTimeout(onClose, 10e3).unref();
    });
    return this._connectPromise;
  }

  /**
   * @typedef {RPCLoginOptions}
   * @param {string} clientId Client ID
   * @param {string} [clientSecret] Client secret
   * @param {string} [accessToken] Access token
   * @param {string} [rpcToken] RPC token
   * @param {string} [tokenEndpoint] Token endpoint
   * @param {string[]} [scopes] Scopes to authorize with
   */

  /**
   * Performs authentication flow. Automatically calls Client#connect if needed.
   * @param {RPCLoginOptions} options Options for authentication.
   * At least one property must be provided to perform login.
   * @example client.login({ clientId: '1234567', clientSecret: 'abcdef123' });
   * @returns {Promise<RPCClient>}
   */
  async login(options = {}) {
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
   * Request
   * @param {string} cmd Command
   * @param {Object} [args={}] Arguments
   * @param {string} [evt] Event
   * @returns {Promise}
   * @private
   */
  request(command, args, event) {
    if (!this.connected) {
      return Promise.reject(new Error('NOT_CONNECTED'));
    }
    return new Promise((resolve, reject) => {
      const nonce = uuid();
      this.transport.send({ cmd: command, args, evt: event, nonce });
      this._expecting.set(nonce, { resolve, reject });
    });
  }

  /**
   * Add event listeners to transport
   * @private
   */
  _setupListeners() {
    this.transport.on('message', this._onRpcMessage);
    this.transport.once('close', this._onRpcClose);
  }

  /**
   * Remove all attached event listeners on transport
   * @param {boolean} [emitClose=false] Whether to emit the `close` event rather than clearing it
   * @private
   */
  _removeListeners(emitClose = false) {
    this.transport.off('message', this._onRpcMessage);
    if (emitClose) {
      this.transport.emit('close');
    } else {
      this.transport.off('close', this._onRpcClose);
    }
  }

  /**
   * RPC Close handler.
   * @private
   */
  _onRpcClose() {
    for (const { reject } of this._expecting) {
      reject(new Error('CONNECTION_CLOSED'));
    }
    this._expecting.clear();
  }

  /**
   * Message handler
   * @param {Object} message message
   * @private
   */
  _onRpcMessage({ args, cmd: command, data, evt: event, nonce }) {
    if (nonce && this._expecting.has(nonce)) {
      const { resolve, reject } = this._expecting.get(nonce);
      if (event === 'ERROR') {
        const error = new Error(data.message);
        error.code = data.code;
        error.data = data;
        reject(error);
      } else {
        resolve(data);
      }
      this._expecting.delete(nonce);
    } else if (command === RPCCommands.DISPATCH) {
      if (event === RPCEvents.READY) {
        if (data.user) {
          this.user = data.user;
        }
        this.emit('connected');
        return;
      }
      const subId = subKey(event, args);
      if (!this._subscriptions.has(subId)) {
        return;
      }
      this._subscriptions.get(subId)(args);
    }
  }

  /**
   * Authorize
   * @param {Object} options options
   * @returns {Promise}
   * @private
   */
  async authorize({ scopes, clientSecret, rpcToken, redirectUri } = {}) {
    if (clientSecret && rpcToken === true) {
      const body = await this.fetch('POST', 'oauth2/token/rpc', {
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

    const response = await this.fetch('POST', 'oauth2/token', {
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
   * Authenticate
   * @param {string} accessToken access token
   * @returns {Promise}
   * @private
   */
  async authenticate(accessToken) {
    const { application, user } = await this.request('AUTHENTICATE', { access_token: accessToken });
    this.accessToken = accessToken;
    this.application = application;
    this.user = user;
    this.emit('ready');
    return this;
  }


  /**
   * Fetch a guild
   * @param {Snowflake} id Guild ID
   * @param {number} [timeout] Timeout request
   * @returns {Promise<Guild>}
   */
  getGuild(id, timeout) {
    return this.request(RPCCommands.GET_GUILD, { guild_id: id, timeout });
  }

  /**
   * Fetch all guilds
   * @param {number} [timeout] Timeout request
   * @returns {Promise<Collection<Snowflake, Guild>>}
   */
  async getGuilds(timeout) {
    const { guilds } = await this.request(RPCCommands.GET_GUILDS, { timeout });
    return guilds;
  }

  /**
   * Get a channel
   * @param {Snowflake} id Channel ID
   * @param {number} [timeout] Timeout request
   * @returns {Promise<Channel>}
   */
  getChannel(id, timeout) {
    return this.request(RPCCommands.GET_CHANNEL, { channel_id: id, timeout });
  }

  /**
   * Get all channels
   * @param {Snowflake} [id] Guild ID
   * @param {number} [timeout] Timeout request
   * @returns {Promise<Collection<Snowflake, Channel>>}
   */
  async getChannels(id, timeout) {
    const { channels } = await this.request(RPCCommands.GET_CHANNELS, {
      timeout,
      guild_id: id,
    });
    return channels;
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
      devices: devices.map((data) => ({
        type: data.type,
        id: data.uuid,
        vendor: data.vendor,
        model: data.model,
        related: data.related,
        echo_cancellation: data.echoCancellation,
        noise_suppression: data.noiseSuppression,
        automatic_gain_control: data.automaticGainControl,
        hardware_mute: data.hardwareMute,
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
   * Set the voice settings for a user, by id
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
   * have explicit permission from the user.
   * @returns {Promise}
   */
  selectTextChannel(id, { timeout } = {}) {
    return this.request(RPCCommands.SELECT_TEXT_CHANNEL, { channel_id: id, timeout });
  }

  /**
   * Get current voice settings
   * @returns {Promise}
   */
  async getVoiceSettings() {
    const data = await this.request(RPCCommands.GET_VOICE_SETTINGS);
    return formatVoiceSettings(data);
  }

  /**
   * Set current voice settings, overriding the current settings until this session disconnects.
   * This also locks the settings for any other rpc sessions which may be connected.
   * @param {Object} args Settings
   * @returns {Promise}
   */
  async setVoiceSettings(args) {
    const data = await this.request(RPCCommands.SET_VOICE_SETTINGS, {
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
        shortcut: args.mode.shortcut,
        delay: args.mode.delay,
      } : undefined,
    });
    return formatVoiceSettings(data);
  }

  /**
   * Capture a shortcut using the client
   * The callback takes (key, stop) where `stop` is a function that will stop capturing.
   * This `stop` function must be called before disconnecting or else the user will have
   * to restart their client.
   * @param {Function} callback Callback handling keys
   * @returns {Promise<Function>}
   */
  async captureShortcut(callback) {
    const subId = subKey(RPCEvents.CAPTURE_SHORTCUT_CHANGE);
    const stop = () => {
      this._subscriptions.delete(subId);
      return this.request(RPCCommands.CAPTURE_SHORTCUT, { action: 'STOP' });
    };
    this._subscriptions.set(subId, ({ shortcut }) => {
      callback(shortcut, stop);
    });
    await this.request(RPCCommands.CAPTURE_SHORTCUT, { action: 'START' });
    return stop;
  }

  /**
   * @typedef {Date|number|string} DateResolvable
   */

  /**
   * @typedef {Object} PresenceButton
   * @prop {string} label The label for the button
   * @prop {string} url The URL opened when the button is clicked
   */

  /**
   * @typedef {Object} PresenceData
   * @prop {DateResolvable} [endTimestamp] End of the activity
   * @prop {DateResolvable} [startTimestamp] Start of this activity
   * @prop {string} [largeImageKey] The asset name for the large image
   * @prop {string} [largeImageText] The hover text for the large image
   * @prop {string} [smallImageKey] The asset name for the small image
   * @prop {string} [smallImageText] The hover text for the small image
   * @prop {string} [partyId] The party ID
   * @prop {number} [partyMax] The party max
   * @prop {number} [partySize] The party size
   * @prop {string} [joinSecret] The join secret
   * @prop {string} [matchSecret] The match secret
   * @prop {string} [spectateSecret] The spectate secret
   * @prop {boolean} [instance] Whether this activity is an instanced game session
   * @prop {PresenceButton[]} [buttons] Buttons for the Presence
   */

  /**
   * Sets the presence for the logged in user.
   * @param {PresenceData} data The rich presence to pass.
   * @param {number} [pid] The application's process ID. Defaults to the executing process' PID.
   * @returns {Promise}
   */
  setActivity(data = {}, pid = getPid()) {
    const activity = {
      instance: Boolean(data.instance),
    };

    if ('buttons' in data) {
      activity.buttons = data.buttons;
    }

    const timestamps = activity.timestamps = {};
    if ('endTimestamp' in data) {
      const timestamp = timestamps.end = new Date(data.endTimestamp).getTime();
      if (timestamp > 2147483647000) {
        throw new RangeError('TIMESTAMP_TOO_LARGE', 'args.endTimestamp');
      }
    }
    if ('startTimestamp' in data) {
      const timestamp = timestamps.start = new Date(data.startTimestamp).getTime();
      if (timestamp > 2147483647000) {
        throw new RangeError('TIMESTAMP_TOO_LARGE', 'args.startTimestamp');
      }
    }

    const assets = activity.assets = {};
    if ('largeImageKey' in data) {
      assets.large_image = data.largeImageKey;
    }
    if ('largeImageText' in data) {
      assets.large_text = data.largeImageText;
    }
    if ('smallImageKey' in data) {
      assets.small_image = data.smallImageKey;
    }
    if ('smallImageText' in data) {
      assets.small_text = data.smallImageText;
    }

    const party = activity.party = {};
    if ('partyId' in data) {
      party.id = data.partyId;
    }
    if ('partyMax' in data && 'partySize' in data) {
      party.size = [data.partySize, data.partyMax];
    }

    const secrets = activity.secrets = {};
    if ('joinSecret' in data) {
      secrets.join = data.joinSecret;
    }
    if ('matchSecret' in data) {
      secrets.match = data.matchSecret;
    }
    if ('spectateSecret' in data) {
      secrets.spectate = data.spectateSecret;
    }

    return this.request(RPCCommands.SET_ACTIVITY, {
      pid,
      activity,
    });
  }

  /**
   * Clears the currently set presence, if any. This will hide the "Playing X" message
   * displayed below the user's name.
   * @param {number} [pid] The application's process ID. Defaults to the executing process' PID.
   * @returns {Promise}
   */
  async clearActivity(pid = getPid()) {
    await this.request(RPCCommands.SET_ACTIVITY, {
      pid,
    });
  }

  /**
   * Invite a user to join the game the RPC user is currently playing
   * @param {User} user The user to invite
   * @returns {Promise}
   */
  async sendJoinInvite(user) {
    await this.request(RPCCommands.SEND_ACTIVITY_JOIN_INVITE, {
      user_id: user.id || user,
    });
  }

  /**
   * Request to join the game the user is playing
   * @param {User} user The user whose game you want to request to join
   * @returns {Promise}
   */
  async sendJoinRequest(user) {
    await this.request(RPCCommands.SEND_ACTIVITY_JOIN_REQUEST, {
      user_id: user.id || user,
    });
  }

  /**
   * Reject a join request from a user
   * @param {User} user The user whose request you wish to reject
   * @returns {Promise}
   */
  async closeJoinRequest(user) {
    await this.request(RPCCommands.CLOSE_ACTIVITY_JOIN_REQUEST, {
      user_id: user.id || user,
    });
  }

  createLobby(type, capacity, metadata) {
    return this.request(RPCCommands.CREATE_LOBBY, {
      type,
      capacity,
      metadata,
    });
  }

  async updateLobby(lobby, { type, owner, capacity, metadata } = {}) {
    await this.request(RPCCommands.UPDATE_LOBBY, {
      id: lobby.id || lobby,
      type,
      owner_id: (owner && owner.id) || owner,
      capacity,
      metadata,
    });
  }

  async deleteLobby(lobby) {
    await this.request(RPCCommands.DELETE_LOBBY, {
      id: lobby.id || lobby,
    });
  }

  connectToLobby(id, secret) {
    return this.request(RPCCommands.CONNECT_TO_LOBBY, {
      id,
      secret,
    });
  }

  async sendToLobby(lobby, data) {
    await this.request(RPCCommands.SEND_TO_LOBBY, {
      lobby_id: lobby.id || lobby,
      data,
    });
  }

  async disconnectFromLobby(lobby) {
    await this.request(RPCCommands.DISCONNECT_FROM_LOBBY, {
      id: lobby.id || lobby,
    });
  }

  async updateLobbyMember(lobby, user, metadata) {
    await this.request(RPCCommands.UPDATE_LOBBY_MEMBER, {
      lobby_id: lobby.id || lobby,
      user_id: user.id || user,
      metadata,
    });
  }

  async getRelationships() {
    const types = Object.keys(RelationshipTypes);
    const { relationships } = await this.request(RPCCommands.GET_RELATIONSHIPS);
    return relationships.map((data) => ({
      ...data,
      type: types[data.type],
    }));
  }

  /**
   * Subscribe to an event
   * @param {string} event Name of event e.g. `MESSAGE_CREATE`
   * @param {Object} [args] Args for event e.g. `{ channel_id: '1234' }`
   * @param {Function} callback Callback when an event for the subscription is triggered
   * @returns {Promise<Object>}
   */
  async subscribe(event, args, callback) {
    if (!callback && typeof args === 'function') {
      callback = args;
      args = undefined;
    }
    await this.request(RPCCommands.SUBSCRIBE, args, event);
    const subId = subKey(event, args);
    this._subscriptions.set(subId, callback);
    return {
      unsubscribe: async () => {
        await this.request(RPCCommands.UNSUBSCRIBE, args, event);
        this._subscriptions.delete(subId);
      },
    };
  }

  /**
   * Destroy the client
   */
  async destroy() {
    await this.transport.close();
    this._removeListeners(true);
    this.emit('destroyed');
  }
}

module.exports = RPCClient;
