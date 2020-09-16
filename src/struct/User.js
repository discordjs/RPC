'use strict';

const Base = require('./Base');
const UserFlags = require('./UserFlags');

/**
 * Represents a user
 * @extends Base
 */
class User extends Base {
  constructor(client, data) {
    super(client, data.id);

    /**
     * The username of this user
     * @type {string}
     */
    this.username = data.username;

    /**
     * The discriminator of this user
     * @type {string}
     */
    this.discriminator = data.discriminator;

    /**
     * The avatar hash of this user, if they have one
     * @type {?string}
     */
    this.avatar = data.avatar;

    /**
     * Whether or not this user is a bot
     * @type {boolean}
     */
    this.bot = data.bot;

    /**
     * The flags for this user
     * @type {UserFlags}
     */
    this.flags = new UserFlags(typeof data.flags === 'number' ? data.flags : data.public_flags);

    /**
     * The premium (Nitro) type of this user
     * 0 - None
     * 1 - Nitro Classic
     * 2 - Nitro
     * @type {?(0 | 1 | 2)}
     */
    this.premiumType = data.premium_type || null;
  }

  /**
   * Get this user's avatar URL.
   * @param {number} [size] The size
   * @returns {?string}
   */
  avatarURL(size) {
    if (!this.avatar) {
      return null;
    }
    return `${this.client.cdnURL}/avatars/${this.id}/${this.avatar}.${
      this.avatar.startsWith('a_') ? 'gif' : 'png'
    }${size ? `?size=${size}` : ''}`;
  }

  /**
   * This user's default avatar URL.
   * @type {string}
   * @readonly
   */
  get defaultAvatarURL() {
    return `${this.client.cdnURL}/embed/avatars/${this.discriminator % 5}`;
  }

  /**
   * This user's discord tag, username#discriminator
   * @type {string}
   * @readonly
   */
  get tag() {
    return `${this.username}#${this.discriminator}`;
  }
}

module.exports = User;
