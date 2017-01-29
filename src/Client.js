const RPCClient = require('./RPCClient');
const EventEmitter = require('events').EventEmitter;

class Client extends EventEmitter {
  constructor(options) {
    super();
    this.rpc = new RPCClient(options);
    this.rpc.evts.on('READY', () => {
      this.user = this.rpc.user;
      this.application = this.rpc.application;
      this.emit('ready');
    });
    this.rpc.evts.on('ERROR', (err) => this.emit('error', err));
    this.rest = this.rpc.rest;
  }

  getGuild(id, timeout) {
    return new Promise((resolve, reject) => {
      this.rpc.request('GET_GUILD', { guild_id: id, timeout }, (err, res) => {
        if (err) reject(err);
        resolve(res);
      });
    });
  }

  getGuilds() {
    return new Promise((resolve, reject) => {
      this.rpc.request('GET_GUILDS', {}, (err, res) => {
        if (err) reject(err);
        resolve(res.guilds);
      });
    });
  }

  getChannel(id, timeout) {
    return new Promise((resolve, reject) => {
      this.rpc.request('GET_CHANNEL', { channel_id: id, timeout }, (err, res) => {
        if (err) reject(err);
        resolve(res);
      });
    });
  }

  getChannels() {
    return new Promise((resolve, reject) => {
      this.rpc.request('GET_CHANNELS', {}, (err, res) => {
        if (err) reject(err);
        resolve(res.channels);
      });
    });
  }

  setUserVoiceSettings(args) {
    return new Promise((resolve, reject) => {
      this.rpc.request('SET_USER_VOICE_SETTINGS', args, (err, res) => {
        if (err) reject(err);
        resolve(res);
      });
    });
  }

  selectVoiceChannel(id, timeout, force = false) {
    return new Promise((resolve, reject) => {
      this.rpc.request('SELECT_VOICE_CHANNEL', { channel_id: id, timeout, force }, (err, res) => {
        if (err) reject(err);
        resolve(res);
      });
    });
  }

  selectTextChannel(id, timeout, force = false) {
    return new Promise((resolve, reject) => {
      this.rpc.request('SELECT_TEXT_CHANNEL', { channel_id: id, timeout, force }, (err, res) => {
        if (err) reject(err);
        resolve(res);
      });
    });
  }

  getVoiceSettings() {
    return new Promise((resolve, reject) => {
      this.rpc.request('GET_VOICE_SETTINGS', {}, (err, res) => {
        if (err) reject(err);
        resolve(res);
      });
    });
  }

  setVoiceSettings(args) {
    return new Promise((resolve, reject) => {
      this.rpc.request('SET_VOICE_SETTINGS', args, (err, res) => {
        if (err) reject(err);
        resolve(res);
      });
    });
  }

  subscribe(event, args, callback) {
    return this.rpc.subscribe(event, args, callback);
  }

  unsubscribe(event, args, callback) {
    return this.rpc.unsubscribe(event, args, callback);
  }

  connect(token) {
    return this.rpc.connect(token);
  }
}

module.exports = Client;
