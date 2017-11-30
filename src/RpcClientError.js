const kCode = Symbol('RpcClientErrorCode');

class RpcClientError extends Error {
  constructor({ message, code }) {
    super(message);
    this[kCode] = code;
  }

  get code() {
    return this[kCode];
  }
}

module.exports = RpcClientError;
