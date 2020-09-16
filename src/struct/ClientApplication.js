'use strict';

const Base = require('./Base');

class ClientApplication extends Base {
  constructor(client, data) {
    super(client);

    /**
     * The id of this application
     * @type {Snowflake}
     */
    this.id = data.id;

    /**
     * The name of this application
     * @type {string}
     */
    this.name = data.name;

    /**
     * The icon of this application
     * @type {?string}
     */
    this.icon = data.icon;

    /**
     * The description of this application
     * @type {string}
     */
    this.description = data.description;

    /**
     * The summary of this application
     * @type {string}
     */
    this.summary = data.summary;
  }

  /**
   * Get the icon URL of this applicaiton.
   * @param {number} [size] The size
   */
  iconURL(size) {
    if (!this.icon) {
      return null;
    }
    return `${this.client.cdnURL}/app-icons/${this.id}/${this.icon}.webp${size ? `?size=${size}` : ''}`;
  }
}

module.exports = ClientApplication;
