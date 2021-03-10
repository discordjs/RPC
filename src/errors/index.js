'use strict';

const errorMessages = {
  INVALID_TYPE: (prop, expected, found) =>
    `Recieved '${prop}' is expected to be ${expected}${found ? ` Recieved ${found}` : ''}.`,
  CONNECTION_CLOSED: 'Connection closed.',
  CONNECTION_TIMEOUT: 'Connection timed out.',
  COULD_NOT_CONNECT: 'Couldn\'t connect.',
  COULD_NOT_FIND_ENDPOINT: 'Couldn\'t find the RPC API Endpoint.',
  TIMESTAMP_TOO_LARGE: (name) => `'${name}' Must fit into a unix timestamp.`,
  NOT_CONNECTED: 'The client isn\'t connected',
};

const makeError = (BaseClass) => {
  class RPCError extends BaseClass {
    constructor(code, ...args) {
      const message = errorMessages[code] || code;
      super(typeof message === 'function' ? message(...args) : message);

      this.code = code;
    }

    get name() {
      return errorMessages[this.code] ? `${super.name} [${this.code}]` : super.name;
    }
  }

  return RPCError;
};

exports.Error = makeError(Error);
exports.TypeError = makeError(TypeError);
exports.RangeError = makeError(RangeError);
