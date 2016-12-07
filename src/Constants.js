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
  'SELECT_VOICE_CHANNEL',

  'BROWSER_INVITE'
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

// stolen from discord.js
const Endpoints = module.exports.Endpoints = {
  // general
  login: '/auth/login',
  logout: '/auth/logout',
  gateway: '/gateway',
  botGateway: '/gateway/bot',
  invite: (id) => `/invite/${id}`,
  inviteLink: (id) => `https://discord.gg/${id}`,
  CDN: 'https://cdn.discordapp.com',

  // users
  user: (userID) => `/users/${userID}`,
  userChannels: (userID) => `${Endpoints.user(userID)}/channels`,
  userProfile: (userID) => `${Endpoints.user(userID)}/profile`,
  avatar: (userID, avatar) => userID === '1' ? avatar : `${Endpoints.user(userID)}/avatars/${avatar}.jpg`,
  me: '/users/@me',
  meGuild: (guildID) => `${Endpoints.me}/guilds/${guildID}`,
  relationships: (userID) => `${Endpoints.user(userID)}/relationships`,
  note: (userID) => `${Endpoints.me}/notes/${userID}`,

  // guilds
  guilds: '/guilds',
  guild: (guildID) => `${Endpoints.guilds}/${guildID}`,
  guildIcon: (guildID, hash) => `${Endpoints.guild(guildID)}/icons/${hash}.jpg`,
  guildPrune: (guildID) => `${Endpoints.guild(guildID)}/prune`,
  guildEmbed: (guildID) => `${Endpoints.guild(guildID)}/embed`,
  guildInvites: (guildID) => `${Endpoints.guild(guildID)}/invites`,
  guildRoles: (guildID) => `${Endpoints.guild(guildID)}/roles`,
  guildRole: (guildID, roleID) => `${Endpoints.guildRoles(guildID)}/${roleID}`,
  guildBans: (guildID) => `${Endpoints.guild(guildID)}/bans`,
  guildIntegrations: (guildID) => `${Endpoints.guild(guildID)}/integrations`,
  guildMembers: (guildID) => `${Endpoints.guild(guildID)}/members`,
  guildMember: (guildID, memberID) => `${Endpoints.guildMembers(guildID)}/${memberID}`,
  guildMemberRole: (guildID, memberID, roleID) => `${Endpoints.guildMember(guildID, memberID)}/roles/${roleID}}`,
  stupidInconsistentGuildEndpoint: (guildID) => `${Endpoints.guildMember(guildID, '@me')}/nick`,
  guildChannels: (guildID) => `${Endpoints.guild(guildID)}/channels`,
  guildEmojis: (guildID) => `${Endpoints.guild(guildID)}/emojis`,

  // channels
  channels: '/channels',
  channel: (channelID) => `${Endpoints.channels}/${channelID}`,
  channelMessages: (channelID) => `${Endpoints.channel(channelID)}/messages`,
  channelInvites: (channelID) => `${Endpoints.channel(channelID)}/invites`,
  channelTyping: (channelID) => `${Endpoints.channel(channelID)}/typing`,
  channelPermissions: (channelID) => `${Endpoints.channel(channelID)}/permissions`,
  channelMessage: (channelID, messageID) => `${Endpoints.channelMessages(channelID)}/${messageID}`,
  channelWebhooks: (channelID) => `${Endpoints.channel(channelID)}/webhooks`,

  // message reactions
  messageReactions: (channelID, messageID) => `${Endpoints.channelMessage(channelID, messageID)}/reactions`,
  messageReaction: (channel, msg, emoji, limit) => `${Endpoints.messageReactions(channel, msg)}/${emoji}${limit ? `?limit=${limit}` : ''}`,
  selfMessageReaction: (channel, msg, emoji, limit) => `${Endpoints.messageReaction(channel, msg, emoji, limit)}/@me`,
  userMessageReaction: (channel, msg, emoji, limit, id) => `${Endpoints.messageReaction(channel, msg, emoji, limit)}/${id}`,

  // webhooks
  webhook: (webhookID, token) => `/webhooks/${webhookID}${token ? `/${token}` : ''}`,

  // oauth
  myApplication: '/oauth2/applications/@me',
  getApp: (id) => `/oauth2/authorize?client_id=${id}`
};
