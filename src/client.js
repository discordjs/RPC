'use strict';

const EventEmitter = require('events');
const { setTimeout, clearTimeout } = require('timers');
const fetch = require('node-fetch');
const transports = require('./transports');
const { API_BASE_URL, RPCCommands, RPCEvents, CDN_URL } = require('./constants');
const { pid: getPid, uuid } = require('./util');
const { ClientApplication, Channel, Guild, User } = require('./struct');

const _formatVoiceSettings = (data) => ({
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
 * @typedef {string} Snowflake A Twitter snowflake, except the epoch is 2015-01-01T00:00:00.000Z
 * {@link https://discord.com/developers/docs/reference#snowflakes}
 */

/**
 * @typedef {Object} RPCClientOptions
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

    /**
     * The config recieved after connecting
     * @type {?Object}
     * @private
     */
    this.config = null;

    /**
     * Options for this client
     * @type {RPCClientOptions}
     */
    this.options = options;

    /**
     * The connected user's OAuth2 Token
     * @type {?string}
     * @name RPCClient#accessToken
     */
    Object.defineProperty(this, 'accessToken', { value: null, writable: true });

    /**
     * The client ID used
     * @type {?string}
     */
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
      throw new TypeError('RPC_INVALID_TRANSPORT', options.transport);
    }

    /**
     * Raw transport used
     * @type {IPCTransport|WebSocketTransport}
     * @private
     */
    this.transport = new Transport(this);
    this.transport.on('message', this._onRpcMessage.bind(this));
    this.transport.on('close', this._onRpcClose.bind(this));

    /**
     * Map of nonces being expected from the transport
     * @type {Map<string, object}
     * @private
     */
    this._expecting = new Map();

    /**
     * The connection promise
     * @type {?Promise<this>}
     * @private
     */
    this._connectPromise = null;
  }

  /**
   * The Discord API base URL
   * @type {string}
   * @readonly
   */
  get apiURL() {
    if (this.config && this.config.api_endpoint) {
      return `https:${this.config.api_endpoint}`;
    }
    return API_BASE_URL;
  }

  /**
   * The Discord CDN base url
   * @type {string}
   * @readonly
   */
  get cdnURL() {
    if (this.config && this.config.cdn_url) {
      return `https://${this.config.cdn_url}`;
    }
    return CDN_URL;
  }

  /**
   * Makes an API request.
   * @param {string} method The HTTP method to use
   * @param {string} path The endpoint for this request
   * @param {Object} [options] Options for this request
   * @param {Object} [options.data] JSON Data for this request
   * @param {URLSearchParams|[string, string][]|Object} [options.query] Query data for this request
   * @private
   */
  async fetch(method, path, { data, query } = {}) {
    const response = await fetch(`${this.apiURL}/${path}${query ? `?${new URLSearchParams(query)}` : ''}`, {
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
   * Search and connect to RPC.
   * @param {string} clientId Client ID
   * @returns {Promise<this>}
   */
  connect(clientId) {
    if (this._connectPromise) {
      return this._connectPromise;
    }
    this._connectPromise = new Promise((resolve, reject) => {
      /* eslint-disable no-use-before-define */
      const onConnect = () => {
        this.clientId = clientId;
        this.transport.off('close', onClose);
        clearTimeout(timeout);
        resolve(this);
      };
      const onClose = () => {
        this._expecting.forEach((expecting) => {
          expecting.reject(new Error('Connection Closed'));
        });
        this.off('connect', onConnect);
        clearTimeout(timeout);
        reject(new Error('Connection Closed'));
      };
      /* eslint-enable no-use-before-define */
      this.transport.on('close', onClose);
      const timeout = setTimeout(() => {
        this.transport.off('close', onClose);
        onClose();
      }, 10e3).unref();
    });
    return this._connectPromise;
  }

  /**
   * @typedef {Object} RPCLoginOptions
   * @param {string} clientId Client ID
   * @param {string} [clientSecret] Client secret
   * @param {string} [accessToken] Access token
   * @param {string|true} [rpcToken] RPC token
   * @param {string} [redirectUri] Login callback endpoint
   * @param {string[]} [scopes] Scopes to authorize with
   */

  /**
   * Performs authentication flow. Automatically calls Client#connect if needed.
   * @param {RPCLoginOptions} options Options for authentication.
   * At least one property must be provided to perform login.
   * @example client.login({ clientId: '1234567', clientSecret: 'abcdef123' });
   * @returns {Promise<this>}
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
   * Make a request.
   * @param {string} command The Command to send
   * @param {Object} [args={}] Arguments for the command
   * @param {string} [event] The event to send
   * @returns {Promise<object>}
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
   * @private
   */
  _onRpcClose() {
    for (const { reject } of this._expecting) {
      reject(new Error('Connection Closed'));
    }
    this._expecting.clear();
  }

  /**
   * Message handler.
   * @param {Object} message The message recieved
   * @param {string} message.cmd The command recieved
   * @param {string} message.evt The event recieved
   * @param {Object} message.data Data recieved
   * @param {?string} message.nonce Nonce of the request
   * @private
   */
  _onRpcMessage({ cmd: command, evt: event, data, nonce }) {
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
          this.user = new User(this, data.user);
        }
        if (data.config) {
          this.config = data.config;
        }
        this.emit('connected');
      }
      this.emit(event, data);
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
  async authorize({ clientSecret, redirectUri, rpcToken, scopes } = {}) {
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
   * Authenticate.
   * @param {string} accessToken access token
   * @returns {Promise<this>}
   * @private
   */
  async authenticate(accessToken) {
    const { application, user } = await this.request('AUTHENTICATE', { access_token: accessToken });
    this.accessToken = accessToken;
    this.application = new ClientApplication(this, application);
    this.user = new User(this, user);
    this.emit('ready');
    return this;
  }

  /**
   * Fetch a guild.
   * @param {Snowflake} id Guild ID
   * @param {number} [timeout] Request timeout
   * @returns {Promise<Guild>}
   */
  async getGuild(id, timeout) {
    const data = await this.request(RPCCommands.GET_GUILD, { guild_id: id, timeout });
    return new Guild(this, data);
  }

  /**
   * Fetch all guilds.
   * @param {number} [timeout] Request timeout
   * @returns {Promise<PartialGuild[]>}
   */
  async getGuilds(timeout) {
    const { guilds } = await this.request(RPCCommands.GET_GUILDS, { timeout });
    return guilds.map((data) => new Guild(this, data));
  }

  /**
   * Get a channel.
   * @param {Snowflake} id Channel ID
   * @param {number} [timeout] Request timeout
   * @returns {Promise<Channel>}
   */
  async getChannel(id, timeout) {
    const data = this.request(RPCCommands.GET_CHANNEL, { channel_id: id, timeout });
    return new Channel(this, data);
  }

  /**
   * Get all channels.
   * @param {Snowflake} [id] Guild ID
   * @param {number} [timeout] Request timeout
   * @returns {Promise<Collection<Snowflake, Channel>>}
   */
  async getChannels(id, timeout) {
    const { channels } = await this.request(RPCCommands.GET_CHANNELS, {
      timeout,
      guild_id: id,
    });
    return channels.map((data) => new Channel(this, data));
  }

  /**
   * @typedef {Object} CertifiedDevice
   * @prop {string} type One of `audioinput`, `audiooutput`, `videoinput`
   * @prop {string} uuid This device's Windows UUID
   * @prop {object} vendor Vendor information
   * @prop {string} vendor.name Vendor's name
   * @prop {string} vendor.url Vendor's url
   * @prop {object} model Model information
   * @prop {string} model.name Model's name
   * @prop {string} model.url Model's url
   * @prop {string[]} related Array of related product's Windows UUIDs
   * @prop {boolean} [echoCancellation] If the device has echo cancellation
   * @prop {boolean} [noiseSuppression] If the device has noise suppression
   * @prop {boolean} [automaticGainControl] If the device has automatic gain control
   * @prop {boolean} [hardwareMute] If the device has a hardware mute
   */

  /**
   * Tell discord which devices are certified.
   * @param {CertifiedDevice[]} devices Certified devices to send to discord
   * @returns {Promise<void>}
   */
  async setCertifiedDevices(devices) {
    await this.request(RPCCommands.SET_CERTIFIED_DEVICES, {
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
    settings.user_id = id;
    return this.request(RPCCommands.SET_USER_VOICE_SETTINGS, settings);
  }

  /**
   * Move the user to a voice channel.
   * @param {Snowflake} id ID of the voice channel
   * @param {Object} [options] Options
   * @param {boolean} [options.force=false] Force this move
   * @param {number} [options.timeout] Timeout for the command
   * <info>This should only be done if you have explicit permission from the user.</info>
   * @returns {Promise<Channel>}
   */
  async selectVoiceChannel(id, { force = false, timeout } = {}) {
    const data = await this.request(RPCCommands.SELECT_VOICE_CHANNEL, {
      channel_id: id, timeout, force,
    });
    return new Channel(this, data);
  }

  /**
   * Move the user to a text channel.
   * @param {Snowflake} id ID of the voice channel
   * @param {number} timeout Request timeout
   * @returns {Promise<Channel>}
   */
  async selectTextChannel(id, timeout) {
    const data = await this.request(RPCCommands.SELECT_TEXT_CHANNEL, { channel_id: id, timeout });
    return new Channel(this, data);
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
   * @prop {boolean} automaticGainControl Automatic gain control
   * @prop {boolean} echoCancellation Echo cancellation
   * @prop {boolean} noiseSuppression Noise suppresion
   * @prop {boolean} qos State of voice quality of service
   * @prop {boolean} silenceWarning State of silence warning notice
   * @prop {boolean} deaf Whether the user is deafened
   * @prop {boolean} mute Whether the user is muted
   * @prop {Object} input Input settings
   * @prop {string} input.device Device ID
   * @prop {number} input.volume Volume (min: 0, max: 100)
   * @prop {AvailableDevice[]} input.availableDevices Available devices
   * <info>This is read-only</info>
   * @prop {Object} output Output settings
   * @prop {string} output.device Device ID
   * @prop {number} output.volume Volume (min: 0, max: 200)
   * @prop {AvailableDevice[]} output.availableDevices Available devices
   * <info>This is read-only</info>
   * @prop {Object} mode Voice mode settings
   * @prop {string} mode.type The type, `PUSH_TO_TALK` or `VOICE_ACTIVITY`
   * @prop {boolean} mode.autoThreshold Whether automatic voice threshold is enabled
   * @prop {number} mode.delay The Push To Talk delay in milliseconds (min: 0, max: 2000)
   * @prop {ShortcutKeyCombo} [mode.shortcut] The shortcut key combination for PTT
   */

  /**
   * Get current voice settings.
   * @returns {Promise<VoiceSettings>}
   */
  async getVoiceSettings() {
    const data = await this.request(RPCCommands.GET_VOICE_SETTINGS);
    return _formatVoiceSettings(data);
  }

  /**
   * Set current voice settings, overriding the current settings until this session disconnects.
   * This also locks the settings for any other rpc sessions which may be connected.
   * @param {Partial<VoiceSettings>} settings Settings
   * @returns {Promise<VoiceSettings>}
   */
  async setVoiceSettings(settings) {
    const data = await this.request(RPCCommands.SET_VOICE_SETTINGS, {
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
    return _formatVoiceSettings(data);
  }

  /**
   * @callback ShortcutCallback
   * @param {ShortcutKeyCombo} key The key combination pressed
   * @param {(param: any) => Promise<void>} stop Stop capturing shortcuts
   */

  /**
   * Capture a shortcut using the client,
   * The callback takes (key, stop) where `stop` is a function that will stop capturing.
   * This `stop` function must be called before disconnecting or else the user will have
   * to restart their client.
   * @param {ShortcutCallback} callback Callback handling keys
   * @returns {Promise<any>} Resolves with the first parameter to the `stop` function
   * once caputuring has finished
   */
  captureShortcut(callback) {
    return new Promise((resolve, reject) => {
      let resolvePromise = true;
      const stop = async (param) => {
        // eslint-disable-next-line no-use-before-define
        this.off(RPCEvents.CAPTURE_SHORTCUT, handler);
        await this.request(RPCCommands.CAPTURE_SHORTCUT, { action: 'STOP' });
        if (resolvePromise) {
          resolve(param);
        }
      };
      const handler = async (data) => {
        try {
          await callback(data, stop);
        } catch (error) {
          resolvePromise = false;
          stop();
          reject(error);
        }
      };
      this.on(RPCEvents.CAPTURE_SHORTCUT_CHANGE, handler);
      this.request(RPCCommands.CAPTURE_SHORTCUT, { action: 'START' });
    });
  }

  /**
   * @typedef {Date|number|string} DateResolvable
   */

  /**
   * @typedef {Object} PresenceData
   * @prop {string} [state] The state
   * @prop {string} [details] Details
   * @prop {boolean} [instance] Whether or not the activity is in a game session
   * @prop {Object} [timestamps] Timestamps
   * @prop {DateResolvable} [timestamps.start] The start of this activity
   * @prop {DateResolvable} [timestamps.end] The end of this activity
   * @prop {Object} [assets] Assets for this activity
   * @prop {string} [assets.largeImage] The asset name for the large image
   * @prop {string} [assets.smallImage] The asset name for the small image
   * @prop {string} [assets.largeImageText] The hover text for the large image
   * @prop {string} [assets.smallImageText] The hover text for the small image
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
   * @param {PresenceData} data The rich presence to pass.
   * @param {number} [pid] The application's process ID. Defaults to the executing process' PID.
   * @returns {Promise<void>}
   */
  async setActivity(data, pid = getPid()) {
    const activity = {};
    if (typeof data.assets === 'object') {
      const assets = activity.assets = {};
      if (data.assets.largeImage) {
        assets.large_image = data.assets.largeImage;
        assets.large_image_text = data.assets.largeImageText;
      }
      if (data.assets.smallImage) {
        assets.small_image = data.assets.smallImage;
        assets.small_image_text = data.assets.smallImageText;
      }
    }
    if (typeof data.details === 'string') {
      activity.details = data.details;
    }
    if (typeof data.instance === 'boolean') {
      activity.instance = data.instance;
    }
    if (typeof data.party === 'object') {
      activity.party = data.party;
    }
    if (typeof data.secrets === 'object') {
      activity.secrets = data.secrets;
    }
    if (typeof data.state === 'string') {
      activity.state = data.state;
    }
    if (typeof data.timestamps === 'object') {
      const timestamps = activity.timestamps = {};
      if (typeof data.timestamps.start !== 'undefined') {
        const start = timestamps.start = new Date(data.timestamps.start).getTime();
        if (start > 2147483647000) {
          throw new RangeError('timestamps.start must fit into a unix timestamp');
        }
      }
      if (typeof data.timestamps.end !== 'undefined') {
        const end = timestamps.end = new Date(data.timestamps.end).getTime();
        if (end > 2147483647000) {
          throw new RangeError('timestamps.end must fit into a unix timestamp');
        }
      }
    }
    await this.request(RPCCommands.SET_ACTIVITY, {
      pid,
      activity,
    });
  }

  /**
   * Clears the currently set presence, if any.
   * @param {number} [pid] The application's process ID. Defaults to the executing process' PID.
   * @returns {Promise<void>}
   */
  async clearActivity(pid = getPid()) {
    await this.request(RPCCommands.SET_ACTIVITY, {
      pid,
    });
  }

  /**
   * Invite a user to join the game the RPC user is currently playing.
   * @param {User|Snowflake} user The user to invite
   * @returns {Promise<void>}
   */
  async sendJoinInvite(user) {
    await this.request(RPCCommands.SEND_ACTIVITY_JOIN_INVITE, {
      user_id: user.id || user,
    });
  }

  /**
   * Request to join the game the user is playing.
   * @param {User|Snowflake} user The user whose game you want to request to join
   * @returns {Promise<void>}
   */
  async sendJoinRequest(user) {
    await this.request(RPCCommands.SEND_ACTIVITY_JOIN_INVITE, {
      user_id: user.id || user,
    });
  }

  /**
   * Reject a join request from a user.
   * @param {User|Snowflake} user The user whose request you wish to reject
   * @returns {Promise<void>}
   */
  async closeJoinRequest(user) {
    await this.request(RPCCommands.CLOSE_ACTIVITY_REQUEST, {
      user_id: user.id || user,
    });
  }

  /**
   * @callback SubscriptionCallback
   * @param {Object} data The callback data
   */

  /**
   * Subscribe to an event.
   * @param {string} event Name of the event e.g. `MESSAGE_CREATE`
   * @param {Object|SubscriptionCallback} [args] Args for the event e.g. `{ channel_id: '1234' }`
   * @param {SubscriptionCallback} [callback] Callback the subscription event is triggered
   * @returns {Promise<() => Promise<this>)>} Function to unsubscribe from the event
   */
  async subscribe(event, args, callback) {
    if (!callback && typeof args === 'function') {
      callback = args;
      args = undefined;
    }
    await this.request(RPCCommands.SUBSCRIBE, args, event);
    const handler = async (data) => {
      try {
        if (!data) {
          return;
        }
        const keyEquals = (key, argsKey = key) => {
          let value;
          if (key.includes('.')) {
            value = key.split('.').reduce((acc, next) => acc && acc[next], data);
          } else {
            value = data[key];
          }
          return value && args[argsKey] && value === args[argsKey];
        };
        if (
          keyEquals('channel_id') || keyEquals('channel.id', 'channel_id')
        || keyEquals('guild.id', 'guild_id') || keyEquals('guild_id')
        ) {
          await callback(data);
        }
      } catch (error) {
        this.emit('error', error);
      }
    };
    this.on(event, handler);
    return async () => {
      this.off(event, handler);
      await this.request(RPCCommands.UNSUBSCRIBE, args, event);
      return this;
    };
  }

  /**
   * Destroy the client
   */
  destroy() {
    this.transport.close();
  }
}

module.exports = RPCClient;
