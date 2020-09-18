'use strict';

module.exports = {
  ipc: require('./ipc'),
  websocket: require('./websocket'),
};

/**
 * @typedef {IPCTransport | WebSocketTransport} RPCTransport
 * Transport for communicating with the RPC server
 */
