/*
  Stolen from Discord's StreamKit Overlay by ```Macdja38
  Modified by Gus Caplan
*/

const EventEmitter = require('events').EventEmitter;
const { RPCCommands, RPCEvents, RPCErrors } = require('./Constants');
const superagent = require('superagent');
const deepEqual = require('deep-equal');
const uuid = require('uuid').v4;
const RESTClient = require('./RESTClient');

let WebSocket, erlpack;
let serialize = JSON.stringify;
if (typeof window !== 'undefined') {
  WebSocket = window.WebSocket; // eslint-disable-line no-undef
  serialize = JSON.stringify;
} else {
  WebSocket = require('ws');
  try {
    erlpack = require('erlpack');
    serialize = erlpack.pack;
  } catch (err) {
    erlpack = null;
    serialize = JSON.stringify;
  }
}

const getEventName = (cmd, nonce, evt) => `${cmd}:${nonce || evt}`;

class RPCClient {
  constructor(options) {
    this.evts = new EventEmitter();
    this.activeSubscriptions = [];
    this.queue = [];
    this.connected = false;
    this.ready = false;
    this.requestedDisconnect = false;
    this.connectionTries = 0;
    this.socket = null;
    this.config = {};
    this.OAUTH2_CLIENT_ID = options.OAUTH2_CLIENT_ID;
    this.API_ENDPOINT = options.API_ENDPOINT || '';
    this.ORIGIN = options.ORIGIN;
    this.rest = new RESTClient(this);
  }

  connect(accessToken = this.accessToken, tries = 0) {
    if (this.connected) return;
    this.accessToken = accessToken;
    const port = 6463 + (tries % 10);
    this.hostAndPort = `${uuid()}.discordapp.io:${port}`;
    this.socket = new WebSocket(
      `wss://${this.hostAndPort}/?v=1&encoding=${erlpack ? 'etf' : 'json'}&client_id=${this.OAUTH2_CLIENT_ID}`,
      typeof window === 'undefined' ? { origin: this.ORIGIN } : null
    );
    this.socket.onopen = this._handleOpen.bind(this);
    this.socket.onclose = this._handleClose.bind(this);
    this.socket.onmessage = this._handleMessage.bind(this);
  }

  disconnect(callback) {
    if (!this.connected) return;
    this.requestedDisconnect = true;
    this.socket.close();
    if (callback) callback();
  }

  reconnect() {
    if (!this.connected) return;
    this.socket.close();
  }

  authenticate() {
    if (this.authenticated) return;
    if (!this.accessToken) {
      this.authorize();
      return;
    }
    this.request('AUTHENTICATE', {
      access_token: this.accessToken,
    }, (e) => {
      if (e && e.code === RPCErrors.INVALID_TOKEN) {
        this.authorize();
        return;
      }
      this.authenticated = true;
      this.flushQueue();
      this.activeSubscriptions.forEach(s => this.subscribe(s.evt, s.args, s.callback));
    });
  }

  flushQueue() {
    const queue = this.queue;
    this.queue = [];
    queue.forEach(c => c());
  }

  authorize() {
    if (this.authenticated) return;
    superagent
      .get(`${this.API_ENDPOINT}/token`)
      .then(r => {
        if (!r.ok || !r.body.rpc_token) throw new Error('no rpc token');
        return this.request('AUTHORIZE', {
          client_id: this.OAUTH2_CLIENT_ID,
          scopes: ['rpc', 'rpc.api'],
          rpc_token: r.body.rpc_token,
        });
      })
      .then(r => superagent
        .post(`${this.API_ENDPOINT}/token`)
        .send({ code: r.code })
      )
      .then(r => {
        if (!r.ok) throw new Error('no access token');
        this.accessToken = r.body.access_token;
        this.authenticate();
      })
      .catch(() => {
        setTimeout(this.authorize.bind(this), 3000);
      });
  }

  request(cmd, args, evt, callback) {
    if (typeof evt === 'function') {
      callback = evt;
      evt = undefined;
    }
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.ready || (!this.authenticated && !['AUTHORIZE', 'AUTHENTICATE'].includes(cmd))) {
        this.queue.push(() => this.request(cmd, args, evt, callback));
        return;
      }
      const nonce = uuid();
      this.evts.once(getEventName(RPCCommands.DISPATCH, nonce), (err, res) => {
        if (callback) callback(err, res);
        if (err) reject(err);
        else resolve(res);
      });
      this.socket.send(serialize({ cmd, args, evt, nonce }));
    });
  }

  subscribe(evt, args, callback) {
    this.request(RPCCommands.SUBSCRIBE, args, evt, error => {
      if (error) {
        if (callback) callback(error);
        return;
      }
      // on reconnect we resub to events, so don't dup listens
      if (!this.activeSubscriptions.find(s => callback === s.callback)) {
        this.activeSubscriptions.push({ evt, args, callback });
        this.evts.on(getEventName(RPCCommands.DISPATCH, null, evt), d => { if (callback) callback(null, d); });
      }
    });
  }

  unsubscribe(evt, args, callback) {
    this.request(RPCCommands.UNSUBSCRIBE, args, evt, error => {
      if (error) {
        if (callback) callback(error);
        return;
      }
      for (const i in this.activeSubscriptions) {
        const s = this.activeSubscriptions[i];
        if (evt === s.evt && deepEqual(args, s.args)) this.activeSubscriptions.splice(i, 1);
      }
      const eventName = getEventName(RPCCommands.DISPATCH, null, evt);
      for (const cb of this.evts.listeners(eventName)) {
        this.evts.removeListener(eventName, cb);
      }
      // this.evts.listeners(eventName).forEach(cb => {
      //   this.evts.removeListener(eventName, cb);
      // });
      if (callback) callback();
    });
  }

  _handleOpen() {
    this.connected = true;
    this.authenticate();
  }

  _handleClose(e) {
    this.connected = false;
    this.authenticated = false;
    this.ready = false;
    this.emit('ERROR', e);
    if (this.requestedDisconnect) {
      this.requestedDisconnect = false;
      return;
    }
    try {
      this.socket.close();
    } catch (err) {} // eslint-disable-line no-empty
    setTimeout(() => this.connect(null, e.code === 1006 ? ++this.connectionTries : 0), 250);
  }

  _handleMessage(message) {
    let payload = null;
    try {
      payload = (erlpack ? erlpack.unpack : JSON.stringify)(message.data);
    } catch (e) {
      this.emit('ERROR', `Payload not JSON:\n${payload}`);
      return;
    }
    let { cmd, evt, nonce, data } = payload;

    if (cmd === RPCCommands.AUTHENTICATE) {
      if (evt === RPCEvents.ERROR) {
        this.evts.emit('ERROR', data);
        return;
      }
      this.user = data.user;
      this.application = data.application;
      this.evts.emit('READY', data);
    }
    if (cmd === RPCCommands.DISPATCH) {
      if (evt === RPCEvents.READY) {
        this.config = data.config;
        this.ready = true;
        this.flushQueue();
        return;
      }
      if (evt === RPCEvents.ERROR) {
        this.evts.emit('ERROR', data);
        this.socket.close();
        return;
      }
      this.evts.emit(getEventName(RPCCommands.DISPATCH, null, evt), data);
      return;
    }
    let error = null;
    if (evt === RPCEvents.ERROR) {
      error = new Error(data.message);
      error.code = data.code;
      data = null;
    }
    this.evts.emit(getEventName(RPCCommands.DISPATCH, nonce), error, data);
  }
}
module.exports = RPCClient;
