
'use strict';

const { RPCEvents } = require('./constants');

/**
 * @typedef {SubscriptionFilter}
 * @type {function}
 * @param {object} args
 * @param {object} data
 * @returns {boolean}
 */

/**
 * @type {SubscriptionFilter}
 */
const guildStatusFilter = (args, data) => (
  args
  && data && data.guild
  && args.guild_id === data.guild.id
);
/**
 * @type {SubscriptionFilter}
 */
const messageFilter = (args, data) => (
  args
  && data
  && args.channel_id === data.channel_id
);

/**
 * @typedef SubscriptionFilters
 * @type {object.<RPCEvent, SubscriptionFilter>}
 */

/**
 * @type {SubscriptionFilters}
 */
const subscriptionFilters = {
  [RPCEvents.GUILD_STATUS]: guildStatusFilter,
  /* VOICE_STATE_CREATE/VOICE_STATE_UPDATE/VOICE_STATE_DELETE
   * should have a check, but returned data does not have channel_id
   */
  [RPCEvents.MESSAGE_CREATE]: messageFilter,
  [RPCEvents.MESSAGE_UPDATE]: messageFilter,
  [RPCEvents.MESSAGE_DELETE]: messageFilter,
  /* SPEAKING_START/SPEAKING_END should have checks,
   * but no channel_id exists in payload
   */
};

/**
 * Manager for subscription arguments/callbacks
 */
class SubscriptionManager {
  constructor() {
    /**
     * Map of subscriptions
     * @type {Map}
     * @private
     */
    this._subscriptions = new Map();
  }

  /**
   * Register a callback to an event
   * @param {string} evt Name of event
   * @param {object} [args] Args for event
   * @param {function} callback event callback
   * @returns {function} deregistration function
   */
  register(evt, args, callback) {
    if (!callback && typeof args === 'function') {
      callback = args;
      args = undefined;
    }
    if (!this._subscriptions.has(evt)) {
      this._subscriptions.set(evt, []);
    }
    this._subscriptions.get(evt)
      .push({ args, callback });

    return () => this.deregister(evt, args, callback);
  }

  /**
   * @param {string} evt Name of event
   * @param {object} [args] Registered args
   * @param {function} callback Registered callback
   * @private
   */
  deregister(evt, args, callback) {
    if (!callback && typeof args === 'function') {
      callback = args;
      args = undefined;
    }

    if (this._subscriptions.has(evt)) {
      const subs = this._subscriptions.get(evt);
      this._subscriptions.set(
        evt,
        subs.filter((sub) => !(sub.args === args && sub.callback === callback)),
      );
    }
  }

  /**
   * Fire callbacks for a given message
   * @param {string} evt Event name
   * @param {Object} data Event data
   */
  fire(evt, data) {
    if (this._subscriptions.has(evt)) {
      let subs = this._subscriptions.get(evt);

      // if possible, only fire matching subscriptions based on registration args
      const filter = subscriptionFilters[evt];
      if (filter) {
        subs = subs.filter(({ args }) => filter(args, data));
      }
      subs.forEach(({ callback }) => callback(data));
    }
  }
}

module.exports = SubscriptionManager;
