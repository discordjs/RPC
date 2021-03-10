'use strict';

const net = require('net');
const EventEmitter = require('events');
const fetch = require('node-fetch');
const { uuid } = require('../util');
const { Error } = require('../errors');

const OPCodes = {
  HANDSHAKE: 0,
  FRAME: 1,
  CLOSE: 2,
  PING: 3,
  PONG: 4,
};

const getIPCPath = (id) => {
  if (process.platform === 'win32') {
    return `\\\\?\\pipe\\discord-ipc-${id}`;
  }
  const { env: { XDG_RUNTIME_DIR, TMPDIR, TMP, TEMP } } = process;
  const prefix = XDG_RUNTIME_DIR || TMPDIR || TMP || TEMP || '/tmp';
  return `${prefix.replace(/\/$/, '')}/discord-ipc-${id}`;
};

const getIPC = (id = 0) => new Promise((resolve, reject) => {
  const path = getIPCPath(id);
  const onError = () => {
    if (id < 10) {
      resolve(getIPC(id + 1));
    } else {
      reject(new Error('COULD_NOT_CONNECT'));
    }
  };
  const socket = net.createConnection(path, () => {
    socket.removeListener('error', onError);
    resolve(socket);
  });
  socket.once('error', onError);
});

const findEndpoint = async (tries = 0) => {
  if (tries > 30) {
    throw new Error('COULD_NOT_FIND_ENDPOINT');
  }
  const endpoint = `http://127.0.0.1:${6463 + (tries % 10)}`;
  try {
    const response = await fetch(endpoint);
    if (response.status === 404) {
      return endpoint;
    }
  } catch { } // eslint-disable-line no-empty
  return findEndpoint(tries + 1);
};

const encode = (op, data) => {
  data = JSON.stringify(data);
  const length = Buffer.byteLength(data);
  const packet = Buffer.alloc(length + 8);
  packet.writeInt32LE(op, 0);
  packet.writeInt32LE(length, 4);
  packet.write(data, 8, length);
  return packet;
};

const decode = (socket) => {
  let op;
  let jsonString = '';

  const read = () => {
    const packet = socket.read();
    if (!packet) {
      return null;
    }
    let part;

    if (jsonString === '') {
      op = packet.readInt32LE(0);
      const length = packet.readInt32LE(4);
      part = packet.slice(8, length + 8);
    } else {
      part = packet.toString();
    }

    jsonString += part;

    try {
      const data = JSON.parse(jsonString);
      return { data, op };
    } catch {
      return read();
    }
  };

  return read();
};

class IPCTransport extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.socket = null;
  }

  async connect() {
    const socket = this.socket = await getIPC();

    socket.on('close', this.onClose.bind(this));
    socket.on('error', this.onClose.bind(this));
    this.emit('open');
    socket.write(encode(OPCodes.HANDSHAKE, {
      v: 1,
      client_id: this.client.clientId,
    }));
    socket.pause();
    socket.on('readable', () => {
      const decoded = decode(socket);
      if (!decoded) {
        return;
      }
      const { data, op } = decoded;
      switch (op) {
        case OPCodes.PING:
          this.send(data, OPCodes.PONG);
          break;
        case OPCodes.FRAME:
          if (!data) {
            return;
          }
          if (data.cmd === 'AUTHORIZE' && data.evt !== 'ERROR') {
            findEndpoint()
              .then((endpoint) => {
                this.client.request.endpoint = endpoint;
              })
              .catch((error) => {
                this.client.emit('error', error);
              });
          }
          this.emit('message', data);
          break;
        case OPCodes.CLOSE:
          this.emit('close', data);
          break;
        default:
          break;
      }
    });
  }

  onClose(event) {
    this.emit('close', event);
  }

  send(data, op = OPCodes.FRAME) {
    this.socket.write(encode(op, data));
  }

  async close() {
    return new Promise((resolve) => {
      this.once('close', () => {
        resolve();
      });
      this.send({}, OPCodes.CLOSE);
      this.socket.end();
    });
  }

  ping() {
    this.send(uuid(), OPCodes.PING);
  }
}

module.exports = IPCTransport;
module.exports.encode = encode;
module.exports.decode = decode;
