const RPCClient = require('./RPCClient');
const EventEmitter = require('events').EventEmitter;

class Client extends EventEmitter {
  constructor ({ OAUTH2_CLIENT_ID } = {}) {
    super();
    this.rpc = new RPCClient({ OAUTH2_CLIENT_ID });
    this.rpc.evts.on('READY', () => {
      this.user = this.rpc.user;
      this.application = this.rpc.application;
      this.emit('ready');
    });
    this.rpc.evts.on('ERROR', (err) => this.emit('error', err));
    this.rest = this.rpc.rest;
  }

  getGuild (id, timeout) {
    return new Promise((resolve, reject) => {
      this.rpc.request('GET_GUILD', { guild_id: id, timeout }, (err, res) => {
        if (err) reject(err);
        resolve(res.data);
      });
    });
  }

  getGuilds () {
    return new Promise((resolve, reject) => {
      this.rpc.request('GET_GUILDS', {}, (err, res) => {
        if (err) reject(err);
        resolve(res.data.guilds);
      });
    });
  }

  getChannel (id, timeout) {
    return new Promise((resolve, reject) => {
      this.rpc.request('GET_CHANNEL', { channel_id: id, timeout }, (err, res) => {
        if (err) reject(err);
        resolve(res.data);
      });
    });
  }

  getChannels () {
    return new Promise((resolve, reject) => {
      this.rpc.request('GET_CHANNELS', {}, (err, res) => {
        if (err) reject(err);
        resolve(res.data.channels);
      });
    });
  }

  setUserVoiceSettings (args) {
    return new Promise((resolve, reject) => {
      this.rpc.request('SET_USER_VOICE_SETTINGS', args, (err, res) => {
        if (err) reject(err);
        resolve(res.data);
      });
    });
  }

  selectVoiceChannel (id, timeout, force = false) {
    return new Promise((resolve, reject) => {
      this.rpc.request('SELECT_VOICE_CHANNEL', { channel_id: id, timeout, force }, (err, res) => {
        if (err) reject(err);
        resolve(res.data);
      });
    });
  }

  selectTextChannel (id, timeout, force = false) {
    return new Promise((resolve, reject) => {
      this.rpc.request('SELECT_TEXT_CHANNEL', { channel_id: id, timeout, force }, (err, res) => {
        if (err) reject(err);
        resolve(res.data);
      });
    });
  }

  getVoiceSettings () {
    return new Promise((resolve, reject) => {
      this.rpc.request('GET_VOICE_SETTINGS', {}, (err, res) => {
        if (err) reject(err);
        resolve(res.data);
      });
    });
  }

  setVoiceSettings (args) {
    return new Promise((resolve, reject) => {
      this.rpc.request('SET_VOICE_SETTINGS', args, (err, res) => {
        if (err) reject(err);
        resolve(res.data);
      });
    });
  }

  subscribe (event, args, callback) {
    return this.rpc.subscribe(event, args, callback);
  }

  unsubscribe (event, args, callback) {
    return this.rpc.unsubscribe(event, args, callback);
  }

  connect (token) {
    return this.rpc.connect(token);
  }
}

module.exports = Client;
