'use strict';

/**
 * Base class for structures
 * @abstract
 * @private
 */
class Base {
  constructor(client, id) {
    /**
     * @type {RPCClient}
     * @name Base#client
     */
    Object.defineProperty(this, 'client', { value: client });

    /**
     * The id of this structure
     * @type {Snowflake}
     */
    this.id = id;
  }
}

module.exports = Base;
