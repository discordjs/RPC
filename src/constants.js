'use strict';

/**
 * @param {string[]} arr
 * @returns {Record<string, string>}
 * @private
 */
function keyMirror(arr) {
  const tmp = {};
  for (const value of arr) {
    tmp[value] = value;
  }
  return tmp;
}

exports.API_BASE_URL = 'https://discord.com/api';
exports.CDN_URL = 'https://cdn.discordapp.com';

exports.browser = typeof window !== 'undefined';

exports.RPCCommands = keyMirror([
  'AUTHENTICATE',
  'AUTHORIZE',
  'CAPTURE_SHORTCUT',
  'CLOSE_ACTIVITY_REQUEST',
  'DISPATCH',
  'GET_CHANNEL',
  'GET_CHANNELS',
  'GET_GUILD',
  'GET_GUILDS',
  'GET_SELECTED_VOICE_CHANNEL',
  'GET_VOICE_SETTINGS',
  'SELECT_TEXT_CHANNEL',
  'SELECT_VOICE_CHANNEL',
  'SEND_ACTIVITY_JOIN_INVITE',
  'SET_ACTIVITY',
  'SET_CERTIFIED_DEVICES',
  'SET_USER_VOICE_SETTINGS',
  'SET_VOICE_SETTINGS',
  'SUBSCRIBE',
  'UNSUBSCRIBE',
]);

exports.RPCEvents = keyMirror([
  'ACTIVITY_JOIN',
  'ACTIVITY_JOIN_REQUEST',
  'ACTIVITY_SPECTATE',
  'CAPTURE_SHORTCUT_CHANGE',
  'CHANNEL_CREATE',
  'ERROR',
  'GUILD_CREATE',
  'GUILD_STATUS',
  'MESSAGE_CREATE',
  'MESSAGE_DELETE',
  'MESSAGE_UPDATE',
  'NOTIFICATION_CREATE',
  'READY',
  'SPEAKING_START',
  'SPEAKING_STOP',
  'VOICE_CHANNEL_SELECT',
  'VOICE_CONNECTION_STATUS',
  'VOICE_SETTINGS_UPDATE',
  'VOICE_STATE_CREATE',
  'VOICE_STATE_DELETE',
  'VOICE_STATE_UPDATE',
]);

exports.RPCErrors = {
  UNKNOWN_ERROR: 1000,
  INVALID_PAYLOAD: 4000,
  INVALID_COMMAND: 4002,
  INVALID_GUILD: 4003,
  INVALID_EVENT: 4004,
  INVALID_CHANNEL: 4005,
  INVALID_PERMISSIONS: 4006,
  INVALID_CLIENT_ID: 4007,
  INVALID_ORIGIN: 4008,
  INVALID_TOKEN: 4009,
  INVALID_USER: 4010,
  OAUTH2_ERROR: 5000,
  SELECT_CHANNEL_TIMEOUT: 5001,
  GET_GUILD_TIMEOUT: 5002,
  SELECT_VOICE_FORCE_REQUIRED: 5003,
  CAPTURE_SHORTCUT_ALREADY_LISTENING: 5004,
};

exports.RPCCloseCodes = {
  CLOSE_NORMAL: 1000,
  CLOSE_UNSUPPORTED: 1003,
  CLOSE_ABNORMAL: 1006,
  INVALID_CLIENTID: 4000,
  INVALID_ORIGIN: 4001,
  RATELIMITED: 4002,
  TOKEN_REVOKED: 4003,
  INVALID_VERSION: 4004,
  INVALID_ENCODING: 4005,
};

/**
 * @typedef {string} ChannelType Channel type, one of
 * `text` - Text Channel
 * `dm` - DM Channel
 * `voice` - Voice Channel
 * `group` - Group Channel
 * `category` - Category Channel
 * `news` - News Channel
 * `store` - Store Channel
 */
exports.ChannelTypes = ['text', 'dm', 'voice', 'group', 'category', 'news', 'store'];

exports.UserFlags = {
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
