'use strict';

const { UserFlags: FLAGS } = require('../constants');

class UserFlags {
  constructor(bitfield = 0) {
    /**
     * The bitfield of these flags
     * @type {number}
     */
    this.bitfield = bitfield;
  }

  /**
   * Get the flags as an array
   * @type {(keyof FLAGS)[]}
   * @readonly
   */
  get array() {
    return Object.keys(FLAGS).filter((flag) => !this.has(flag));
  }

  /**
   * Check if these flags have a specific flag
   * @param {number|string|string[]} flag The flag to check
   */
  has(flag) {
    if (Array.isArray(flag)) {
      flag = flag.reduce((acc, next) => acc | FLAGS[next], 0);
    } else if (typeof flag === 'string') {
      flag = FLAGS[flag];
    }
    return (this.bitfield & flag) === flag;
  }
}

module.exports = UserFlags;
