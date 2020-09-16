'use strict';

const Base = require('./Base');

/**
 * Represents a Guild
 * @extends Base
 */
class Guild extends Base {
  constructor(client, data) {
    super(client);

    /**
     * The ID of this guild
     * @type {Snowflake}
     */
    this.id = data.id;

    /**
     * The name of this guild
     * @type {string}
     */
    this.name = data.name;

    /**
     * The icon URL of this guild, if it has one
     * @type {?string}
     */
    this.iconURL = data.icon_url || null;

    /**
     * The vanity URL code for this guild, if it has one
     * <info>only present if fetched from {@link RPCClient#getGuild}</info>
     * @type {?string}
     */
    this.vanityURLCode = data.vanity_url_code;
  }

  /**
   * Gets all the channels for this guild.
   * @param {number} [timeout] Request timeout
   * @returns {Channel[]}
   */
  getChannels(timeout) {
    return this.client.getChannels(this.id, timeout);
  }
}

module.exports = Guild;
