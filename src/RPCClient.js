/*
  Stolen from Discord's StreamKit Overlay by ```Macdja38
  Modified by Gus Caplan
*/

const WebSocket = typeof window !== 'undefined' ? window.WebSocket : require('ws'); // eslint-disable-line no-undef
const EventEmitter = require('events').EventEmitter;
const { RPCCommands, RPCEvents, RPCErrors } = require('./Constants');
const superagent = require('superagent');
const lodash = require('lodash');
const uuid = require('uuid').v4;
const RESTClient = require('./RESTClient');

function getEventName (cmd, nonce, evt) {
  return `${cmd}:${nonce || evt}`;
}

class RPCClient {
  constructor (options) {
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
    this.rest = new RESTClient(this);
  }

  connect (accessToken = this.accessToken, tries = 0) {
    if (this.connected) return;
    this.accessToken = accessToken;
    const port = 6463 + (tries % 10);
    this.hostAndPort = `${uuid()}.discordapp.io:${port}`;
    this.socket = new WebSocket(`wss://${this.hostAndPort}/?v=1&client_id=${this.OAUTH2_CLIENT_ID}`); // eslint-disable-line
    this.socket.onopen = this._handleOpen.bind(this);
    this.socket.onclose = this._handleClose.bind(this);
    this.socket.onmessage = this._handleMessage.bind(this);
  }

  disconnect (callback) {
    if (!this.connected) return;
    this.requestedDisconnect = true;
    this.socket.close();
    if (callback) callback();
  }

  reconnect () {
    if (!this.connected) return;
    this.socket.close();
  }

  authenticate () {
    if (this.authenticated) return;
    if (!this.accessToken) {
      this.authorize();
      return;
    }
    this.request('AUTHENTICATE', {
      access_token: this.accessToken
    }, (e, r) => {
      if (e && e.code === RPCErrors.INVALID_TOKEN) {
        this.authorize();
        return;
      }
      this.authenticated = true;
      this.flushQueue();
      this.activeSubscriptions.forEach(s => this.subscribe(s.evt, s.args, s.callback));
    });
  }

  flushQueue () {
    const queue = this.queue;
    this.queue = [];
    queue.forEach(c => c());
  }

  authorize () {
    if (this.authenticated) return;
    superagent
      .get(`${this.API_ENDPOINT}/token`)
      .then(r => {
        if (!r.ok || !r.body.rpc_token) {
          throw new Error('no rpc token');
        }
        return this.request('AUTHORIZE', {
          client_id: this.OAUTH2_CLIENT_ID,
          scopes: ['rpc', 'rpc.api'],
          rpc_token: r.body.rpc_token
        });
      })
      .then(r => superagent
        .post(`${this.API_ENDPOINT}/token`)
        .send({
          code: r.code
        })
      )
      .then(r => {
        if (!r.ok) {
          throw new Error('no access token');
        }
        this.accessToken = r.body.access_token;
        this.authenticate();
      })
      .catch(e => {
        setTimeout(this.authorize.bind(this), 3000);
      });
  }

  request (cmd, args, evt, callback) {
    if (typeof evt === 'function') {
      callback = evt;
      evt = undefined;
    }
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.ready || (!this.authenticated && ['AUTHORIZE', 'AUTHENTICATE'].indexOf(cmd) === -1)) {
        this.queue.push(() => this.request(cmd, args, evt, callback));
        return;
      }
      const nonce = uuid();
      this.evts.once(getEventName(RPCCommands.DISPATCH, nonce), (err, res) => {
        if (callback) callback(err, res);
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      });
      this.socket.send(JSON.stringify({
        cmd,
        args,
        evt,
        nonce
      }));
    });
  }

  subscribe (evt, args, callback) {
    this.request(RPCCommands.SUBSCRIBE, args, evt, error => {
      if (error) {
        if (callback) callback(error);
        return;
      }
      // on reconnect we resub to events, so don't dup listens
      if (!this.activeSubscriptions.find(s => {
        return callback === s.callback;
      })) {
        this.activeSubscriptions.push({
          evt,
          args,
          callback
        });
        this.evts.on(getEventName(RPCCommands.DISPATCH, null, evt), d => { if (callback) callback(null, d); });
      }
    });
  }

  unsubscribe (evt, args, callback) {
    this.request(RPCCommands.UNSUBSCRIBE, args, evt, error => {
      if (error) {
        if (callback) callback(error);
        return;
      }
      lodash.remove(this.activeSubscriptions, s => {
        return evt === s.evt && lodash.isEqual(args, s.args);
      });
      const eventName = getEventName(RPCCommands.DISPATCH, null, evt);
      this.evts.listeners(eventName).forEach(cb => {
        this.evts.removeListener(eventName, cb);
      });
      if (callback) callback();
    });
  }

  _handleOpen () {
    this.connected = true;
    this.authenticate();
  }

  _handleClose (e) {
    this.connected = false;
    this.authenticated = false;
    this.ready = false;
    console.error('WS Closed:', e);
    if (this.requestedDisconnect) {
      this.requestedDisconnect = false;
      return;
    }
    try {
      this.socket.close();
    } catch (e) {}
    setTimeout(() => this.connect(null, e.code === 1006 ? ++this.connectionTries : 0), 250);
  }

  _handleMessage (message) {
    let payload = null;
    try {
      payload = JSON.parse(message.data);
    } catch (e) {
      console.error('Payload not JSON:', payload);
      return;
    }
    let {
      cmd,
      evt,
      nonce,
      data
    } = payload;

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
        console.error('Dispatched Error', data);
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
