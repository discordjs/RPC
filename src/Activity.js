const { resolveString } = require('discord.js');

/**
 * An activity constructor
 */
class Activity {
  constructor(data = {}) {
    this.setup(data);
  }

  setup(data) {
    /**
     * The top text on the right side
     * @type {?string}
     */
    this.details = data.details;

    /**
     * The bottom text on the right side
     * @type {?string}
     */
    this.state = data.state;

    /**
     * The time the activity started
     * @type {?number}
     */
    this.startTimestamp = data.startTimestamp;

    /**
     * The time the activity ends
     * @type {?number}
     */
    this.endTimestamp = data.endTimestamp;

    /**
     * The large image's key
     * @type {?string}
     */
    this.largeImageKey = data.largeImageKey;

    /**
     * The small image's key
     * @type {?string}
     */
    this.smallImageKey = data.smallImageKey;

    /**
     * The large image's text
     * @type {?string}
     */
    this.largeImageText = data.largeImageText;

    /**
     * The small image's text
     * @type {?string}
     */
    this.smallImageText = data.smallImageText;
    /**
     * The ID of the party
     * @type {?string}
     */
    this.partyId = data.partyId;

    /**
     * The current size of people in the party
     * @type {?number}
     */
    this.partySize = data.partySize;

    /**
     * The maximum size of people in the party
     * @type {?number}
     */
    this.partyMax = data.partyMax;

    /**
     * The secret to join and spectate the party
     * @type {?string}
     */
    this.matchSecret = data.matchSecret;

    /**
     * The secret to spectate the party
     * @type {?string}
     */
    this.spectateSecret = data.spectateSecret;

    /**
     * The secret to join the party
     * @type {?string}
     */
    this.joinSecret = data.joinSecret;

    /**
     * Whether or not the party session has a specific beginning and ending
     * @type {?boolean}
     */
    this.instance = data.instance;
  }

  /**
   * Set the top text on the right side
   * @param {string} details What the player is currently doing
   * @returns {Activity}
   */
  setDetails(details) {
    details = resolveString(details);
    if (details.length > 128) throw new RangeError('ACTIVITY_DETAILS');
    this.details = details;
    return this;
  }

  /**
   * Set the bottom text on the right side
   * @param {string} state The user's current party status
   * @returns {Activity}
   */
  setState(state) {
    state = resolveString(state);
    if (state.length > 128) throw new RangeError('ACTIVITY_STATE');
    this.state = state;
    return this;
  }

  /**
   * Sets the time the activity started
   * @param {number|Date} [timestamp=current date] Unix timestamp for the start of the game
   * @returns {Activity}
   */
  setStartTimestamp(timestamp = new Date()) {
    this.startTimestamp = timestamp;
    return this;
  }

  /**
   * Sets the time the activity ends
   * @param {number|Date} timestamp Unix timestamp for when the game will end
   * @returns {Activity}
   */
  setEndTimestamp(timestamp) {
    this.endTimestamp = timestamp;
    return this;
  }

  /**
   * Set both the timestamps in one function
   * @param {number|Date} start Unix timestamp for when the game will end
   * @param {number|Date} [end] Unix timestamp for the start of the game
   */
  setTimestamps(start, end) {
    this.startTimestamp = start;
    this.endTimestamp = end;
    return this;
  }

  /**
   * Sets the info for the large image
   * @param {string} key Name of the uploaded image for the large profile artwork
   * @param {string} [text] Tooltip for the large image key
   * @returns {Activity}
   */
  setLargeImage(key, text) {
    if (key.length > 32) throw new RangeError('ACTIVITY_LARGE_IMAGE_KEY');
    if (text.length > 128) throw new RangeError('ACTIVITY_LARGE_IMAGE_TEXT');
    this.largeImageKey = key;
    this.largeImageText = text;
    return this;
  }

  /**
   * Sets the info for the small image
   * @param {string} key Name of the uploaded image for the small profile artwork
   * @param {string} [text] Tooltip for the small image key
   * @returns {Activity}
   */
  setSmallImage(key, text) {
    if (key.length > 32) throw new RangeError('ACTIVITY_SMALL_IMAGE_KEY');
    if (text.length > 128) throw new RangeError('ACTIVITY_SMALL_IMAGE_TEXT');
    this.smallImageKey = key;
    this.smallImageText = text;
    return this;
  }

  /**
   * Sets the party info
   * @param {string} id ID of the player's party, lobby, or group
   * @param {number} [size] Current size of the player's party, lobby, or group
   * @param {number} [max] Maximum size of the player's party, lobby, or group
   * @returns {Activity}
   */
  setParty(id, size, max) {
    if (id.length > 128) throw new RangeError('ACTIVITY_PARTY_ID');
    this.partyId = id;
    this.partySize = size;
    this.partyMax = max;
    return this;
  }

  /**
   * Sets the match secret for spectate and join
   * @param {string} secret Unique hashed string for Spectate and Join
   * @returns {Activity}
   */
  setMatchSecret(secret) {
    if (secret.length > 128) throw new RangeError('ACTIVITY_MATCH_SECRET');
    this.matchSecret = secret;
    return this;
  }

  /**
   * Sets the join secret
   * @param {string} secret Unique hashed string for chat invitations and Ask to Join
   * @returns {Activity}
   */
  setJoinSecret(secret) {
    if (secret.length > 128) throw new RangeError('ACTIVITY_JOIN_SECRET');
    this.joinSecret = secret;
    return this;
  }

  /**
   * Sets the spectate secret
   * @param {string} secret Whether or not the session has a specific beginning and end
   * @returns {Activity}
   */
  setSpectateSecret(secret) {
    if (secret.length > 128) throw new RangeError('ACTIVITY_SPECTATE_SECRET');
    this.spectateSecret = secret;
    return this;
  }

  /**
   * Sets the instance property
   * @param {boolean} instance
   * @returns {Activity}
   */
  setInstance(instance) {
    this.instance = instance;
    return this;
  }
}

module.exports = Activity;