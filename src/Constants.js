const keyMirror = (arr) => {
  let tmp = {};
  for (const value of arr) tmp[value] = value;
  return tmp;
}

module.exports.RPCCommands = keyMirror([
  'DISPATCH',

  'AUTHORIZE',
  'AUTHENTICATE',

  'GET_GUILD',
  'GET_GUILDS',
  'GET_CHANNEL',
  'GET_CHANNELS',

  'SUBSCRIBE',
  'UNSUBSCRIBE',

  'SET_LOCAL_VOLUME',
  'SELECT_VOICE_CHANNEL'
]);

module.exports.RPCEvents = keyMirror([
  'GUILD_STATUS',

  'VOICE_STATE_CREATE',
  'VOICE_STATE_DELETE',
  'VOICE_STATE_UPDATE',
  'SPEAKING_START',
  'SPEAKING_STOP',

  'MESSAGE_CREATE',
  'MESSAGE_UPDATE',
  'MESSAGE_DELETE',

  'READY',
  'ERROR'
]);

module.exports.RPCErrors = {
  UNKNOWN_ERROR: 1000,

  INVALID_PAYLOAD: 4000,
  INVALID_VERSION: 4001,
  INVALID_COMMAND: 4002,
  INVALID_GUILD: 4003,
  INVALID_EVENT: 4004,
  INVALID_CHANNEL: 4005,
  INVALID_PERMISSIONS: 4006,
  INVALID_CLIENTID: 4007,
  INVALID_ORIGIN: 4008,
  INVALID_TOKEN: 4009,
  INVALID_USER: 4010,

  OAUTH2_ERROR: 5000
};

module.exports.RPCCloseCodes = {
  INVALID_CLIENTID: 4000,
  INVALID_ORIGIN: 4001,
  RATELIMITED: 4002,
  TOKEN_REVOKED: 4003
};

module.exports.ChannelTypes = {
  DM: 1,
  GROUP_DM: 3,
  GUILD_TEXT: 0,
  GUILD_VOICE: 2
};

module.exports.Endpoints = {
  channelMessages: (cID) => `/channels/${cID}/messages`,
  channelMessage: (cID, mID) => `/channels/${cID}/messages/${mID}`
}
