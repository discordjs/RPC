const EventEmitter = require('events');
const { WebSocket } = require('discord.js');

class WebSocketTransport extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.ws = null;
    this.tries = 0;
    this.client_id = null;
    this.origin = null;
  }

  connect(options, tries = this.tries) {
    if (this.connected)
      return;
    const port = 6463 + (tries % 10);
    this.hostAndPort = `127.0.0.1:${port}`;
    const cid = this.client.clientID;
    const ws = this.ws = WebSocket.create(
      `ws://${this.hostAndPort}/`,
      { v: 1, client_id: cid || null },
      typeof window === 'undefined' ? { origin: this.client.options._login.origin } : undefined
    );
    ws.onopen = this.onOpen.bind(this);
    ws.onclose = ws.onerror = this.onClose.bind(this);
    ws.onmessage = this.onMessage.bind(this);
  }

  send(data) {
    if (!this.ws)
      return;
    this.ws.send(WebSocket.pack(data));
  }

  close() {
    if (!this.ws)
      return;
    this.ws.close();
  }

  ping() {} // eslint-disable-line no-empty-function

  onMessage(event) {
    this.emit('message', WebSocket.unpack(event.data));
  }

  onOpen() {
    this.client.rest.endpoint = `http://${this.hostAndPort}`;
    this.client.rest.versioned = false;
    this.emit('open');
  }

  onClose(e) {
    try {
      this.ws.close();
    } catch (err) {} // eslint-disable-line no-empty
    const derr = e.code >= 4000 && e.code < 5000;
    if (!e.code || derr)
      this.emit('close', e);
    if (!derr)
      setTimeout(() => this.connect(undefined, e.code === 1006 ? ++this.tries : 0), 250);
  }
}

module.exports = WebSocketTransport;
module.exports.encode = WebSocket.pack;
module.exports.decode = WebSocket.unpack;
