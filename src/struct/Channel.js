'use strict';

const Base = require('./Base');
const User = require('./User');
const { ChannelTypes } = require('../constants');

/**
 * Represents a Channel
 * @extends Base
 */
class Channel extends Base {
  constructor(client, data) {
    super(client, data.id);

    /**
     * The name of this channel
     * @type {Snowflake}
     */
    this.name = data.name;

    /**
     * The type of this channel
     * @type {ChannelType}
     */
    this.type = ChannelTypes[data.type];

    /**
     * The topic of this channel, if it has one
     * <info>This is only present if fetched via {@link RPCClient#getChannel}</info>
     * @type {?string}
     */
    this.topic = data.topic || null;

    /**
     * The bitrate of this channel
     * <info>This is only present if fetched via {@link RPCClient#getChannel}</info>
     * @type {?number}
     */
    this.bitrate = data.bitrate || null;

    /**
     * The user limit of this channel
     * <info>This is only present if fetched via {@link RPCClient#getChannel}</info>
     * @type {?number}
     */
    this.userLimit = data.userLimit || null;

    /**
     * The position of this channel
     * <info>This is only present if fetched via {@link RPCClient#getChannel}</info>
     * @type {?number}
     */
    this.position = data.position || null;

    /**
     * The Guild ID of this channel
     * <info>This is only present if fetched via {@link RPCClient#getChannel},
     * or if the type is not `dm` or `group`</info>
     * @type {?string}
     */
    this.guildId = data.guildId || null;

    /**
     * Voice States for this channel
     * <info>This is only present if fetched via {@link RPCClient#getChannel}</info>
     * @type {?VoiceState[]}
     */
    this.voiceStates = data.voice_states ? data.voice_states.map((state) => ({
      nick: state.nick,
      volume: state.volume,
      pan: state.pan,
      serverMute: state.voice_state.mute,
      serverDeaf: state.voice_state.deaf,
      selfMute: state.voice_state.self_mute,
      selfDeaf: state.voice_state.self_deaf,
      user: new User(state.user),
    })) : null;
  }

  /**
   * Get the guild this channel belongs to.
   * @param {number} timeout Request timeout
   * @returns {Guild}
   */
  getGuild(timeout) {
    return this.client.getGuild(this.id, timeout);
  }
}

module.exports = Channel;
