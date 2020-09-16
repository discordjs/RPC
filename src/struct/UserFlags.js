'use strict';

const FLAGS = {
  DISCORD_EMPLOYEE: 1 << 0,
  DISCORD_PARTNER: 1 << 1,
  HYPESQUAD_EVENTS: 1 << 2,
  BUGHUNTER_LEVEL_1: 1 << 3,
  HOUSE_BRAVERY: 1 << 6,
  HOUSE_BRILLIANCE: 1 << 7,
  HOUSE_BALANCE: 1 << 8,
  EARLY_SUPPORTER: 1 << 9,
  TEAM_USER: 1 << 10,
  SYSTEM: 1 << 12,
  BUGHUNTER_LEVEL_2: 1 << 14,
  VERIFIED_BOT: 1 << 16,
  VERIFIED_DEVELOPER: 1 << 17,
};

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
