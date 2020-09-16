'use strict';

const EventEmitter = require('events');
const { setTimeout, clearTimeout } = require('timers');
const fetch = require('node-fetch');
const transports = require('./transports');
const { API_BASE_URL, RPCCommands, RPCEvents } = require('./constants');
const { pid: getPid, uuid } = require('./util');
const { Channel, Guild, User } = require('./struct');

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
      throw new TypeError('RPC_INVALID_TRANSPORT', options.transport);
    }

    /**
     * Raw transport used
     * @type {RPCTransport}
     * @private
     */
    this.transport = new Transport(this);
    this.transport.on('message', this._onRpcMessage.bind(this));

    /**
     * Map of nonces being expected from the transport
     * @type {Map}
     * @private
     */
    this._expecting = new Map();

    this._connectPromise = undefined;
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
    const response = await fetch(`${API_BASE_URL}/${path}${query ? `?${new URLSearchParams(query)}` : ''}`, {
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
   */
  connect(clientId) {
    if (this._connectPromise) {
      return this._connectPromise;
    }
    this._connectPromise = new Promise((resolve, reject) => {
      this.clientId = clientId;
      const timeout = setTimeout(() => reject(new Error('RPC_CONNECTION_TIMEOUT')), 10e3);
      timeout.unref();
      let resolved = false;
      const onConnect = () => {
        clearTimeout(timeout);
        resolve(this);
        resolved = true;
      };
      this.once('connected', onConnect);
      this.transport.once('close', () => {
        this._expecting.forEach((e) => {
          e.reject(new Error('connection closed'));
        });
        this.emit('disconnected');
        this.off('connected', onConnect);
        // prevent the promise resolving twice
        if (!resolved) {
          reject(new Error('connection closed'));
        }
      });
      this.transport.connect().catch(reject);
    });
    return this._connectPromise;
  }

  /**
   * @typedef {Object} RPCLoginOptions
   * @param {string} clientId Client ID
   * @param {string} [clientSecret] Client secret
   * @param {string} [accessToken] Access token
   * @param {string} [rpcToken] RPC token
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
   * Make a request.
   * @param {string} cmd The Command to send
   * @param {Object} [args={}] Arguments for the command
   * @param {string} [evt] The event to send
   * @returns {Promise}
   * @private
   */
  request(cmd, args, evt) {
    return new Promise((resolve, reject) => {
      const nonce = uuid();
      this.transport.send({ cmd, args, evt, nonce });
      this._expecting.set(nonce, { resolve, reject });
    });
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
    this.application = application;
    this.user = user;
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
   * @prop {?Object} [pan] Pan settings, an object with `left` and `right` set between
   * 0.0 and 1.0, inclusive
   * @prop {?number} [volume=100] The volume
   * @prop {bool} [mute] If the user is muted
   */

  /**
   * Set the voice settings for a uer, by id.
   * @param {Snowflake} id ID of the user to set
   * @param {UserVoiceSettings} settings Settings
   * @returns {Promise}
   */
  setUserVoiceSettings(id, settings) {
    settings.user_id = id;
    return this.request(RPCCommands.SET_USER_VOICE_SETTINGS, settings);
  }

  /**
   * Move the user to a voice channel.
   * @param {Snowflake} id ID of the voice channel
   * @param {Object} [options] Options
   * @param {number} [options.timeout] Timeout for the command
   * @param {boolean} [options.force=false] Force this move
   * <info>This should only be done if you have explicit permission from the user.</info>
   * @returns {Promise}
   */
  selectVoiceChannel(id, { timeout, force = false } = {}) {
    return this.request(RPCCommands.SELECT_VOICE_CHANNEL, { channel_id: id, timeout, force });
  }

  /**
   * Move the user to a text channel.
   * @param {Snowflake} id ID of the voice channel
   * @param {Object} [options] Options
   * @param {number} [options.timeout] Timeout for the command
   * @returns {Promise}
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
   * @param {Partial<VoiceSettings>} settings Settings
   * @returns {Promise}
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
   * @param {ShortcutKeyCombo} key The key combination pressed
   * @param {() => Promise<void>} stop Stop capturing shortcuts
   */

  /**
   * Capture a shortcut using the client,
   * The callback takes (key, stop) where `stop` is a function that will stop capturing.
   * This `stop` function must be called before disconnecting or else the user will have
   * to restart their client.
   * @param {ShortcutCallback} callback Callback handling keys
   * @returns {Promise<Function>}
   */
  captureShortcut(callback) {
    return new Promise((resolve, reject) => {
      const stop = async (resolvePromise = true) => {
        // eslint-disable-next-line no-use-before-define
        this.off(RPCEvents.CAPTURE_SHORTCUT, handler);
        await this.request(RPCCommands.CAPTURE_SHORTCUT, { action: 'STOP' });
        if (resolvePromise) {
          resolve();
        }
      };
      const handler = async (data) => {
        try {
          await callback(data, stop);
        } catch (error) {
          stop(false);
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
   * @param {Function|SubscriptionCallback} [callback] Callback the subscription event is triggered
   * @returns {Promise<() => this)>} Function to unsubscribe from the event
   */
  async subscribe(event, args, callback) {
    if (!callback && typeof args === 'function') {
      callback = args;
      args = undefined;
    }
    await this.request(RPCCommands.SUBSCRIBE, args, event);
    const handler = (data) => {
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
        callback(data);
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
