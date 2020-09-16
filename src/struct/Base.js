'use strict';

/**
 * Base class for structures
 * @abstract
 * @private
 */
class Base {
  constructor(client) {
    /**
     * @type {RPCClient}
     * @name Base#client
     */
    Object.defineProperty(this, 'client', { value: client });
  }
}

module.exports = Base;
