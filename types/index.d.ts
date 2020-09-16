type DualRecord<T> = Record<T, T>;

declare module 'discord-rpc' {

  export const Constants: {
    API_BASE_URL: string;
    browser: boolean;
    ChannelTypes: ['text', 'dm', 'voice', 'group', 'category', 'news', 'store']
    RPCCommands: DualRecord<RPCCommand>;
    RPCEvents: DualRecord<RPCEvent>;
    RPCErrors: {
      UNKNOWN_ERROR: 1000;
      INVALID_PAYLOAD: 4000;
      INVALID_COMMAND: 4002;
      INVALID_GUILD: 4003;
      INVALID_EVENT: 4004;
      INVALID_CHANNEL: 4005;
      INVALID_PERMISSIONS: 4006;
      INVALID_CLIENT_ID: 4007;
      INVALID_ORIGIN: 4008;
      INVALID_TOKEN: 4009;
      INVALID_USER: 4010;
      OAUTH2_ERROR: 5000;
      SELECT_CHANNEL_TIMEOUT: 5001;
      GET_GUILD_TIMEOUT: 5002;
      SELECT_VOICE_FORCE_REQUIRED: 5003;
      CAPTURE_SHORTCUT_ALREADY_LISTENING: 5004;
    };
    RPCCloseCodes: {
      CLOSE_NORMAL: 1000;
      CLOSE_UNSUPPORTED: 1003;
      CLOSE_ABNORMAL: 1006;
      INVALID_CLIENTID: 4000;
      INVALID_ORIGIN: 4001;
      RATELIMITED: 4002;
      TOKEN_REVOKED: 4003;
      INVALID_VERSION: 4004;
      INVALID_ENCODING: 4005;
    };
    UserFlags: Record<UserFlagString, number>;
  }

  class Base {
    public readonly client: RPCClient;
    public id: string;
  }

  export class Channel {
    public bitrate: number;
    public guildId: string;
    public name: string;
    public position: number;
    public topic: string | null;
    public type: ChannelType;
    public userLimit: number;
    public voiceStates: VoiceState[];

    public getGuild(timeout?: number): Promise<Guild>;
  }

  export class Guild {
    public iconURL: string | null;
    public name: string;
    public vanityURLCode: string | null;

    public getChannels(timeout?: number): Promise<Channel[]>;
  }

  export class User {
    public avatar: string;
    public bot: boolean;
    public discriminator: string;
    public flags: UserFlags;
    public premiumType: 0 | 1 | 2 | null;
    public readonly tag: string;
    public username: string;
  }

  export class UserFlags {
    public readonly array: UserFlagsString[];
    public bitfield: number;

    public has(bit: number | UserFlagsString | UserFlagsString[]): boolean;
  }

  type ChannelType = (typeof Constants.ChannelTypes)[number];

  type RPCCommand =
    | 'AUTHENTICATE'
    | 'AUTHORIZE'
    | 'CAPTURE_SHORTCUT'
    | 'CLOSE_ACTIVITY_REQUEST'
    | 'DISPATCH'
    | 'GET_CHANNEL'
    | 'GET_CHANNELS'
    | 'GET_GUILD'
    | 'GET_GUILDS'
    | 'GET_SELECTED_VOICE_CHANNEL'
    | 'GET_VOICE_SETTINGS'
    | 'SELECT_TEXT_CHANNEL'
    | 'SELECT_VOICE_CHANNEL'
    | 'SEND_ACTIVITY_JOIN_INVITE'
    | 'SET_ACTIVITY'
    | 'SET_CERTIFIED_DEVICES'
    | 'SET_USER_VOICE_SETTINGS'
    | 'SET_VOICE_SETTINGS'
    | 'SUBSCRIBE'
    | 'UNSUBSCRIBE';

  type RPCEvent =
    | 'ACTIVITY_JOIN'
    | 'ACTIVITY_JOIN_REQUEST'
    | 'ACTIVITY_SPECTATE'
    | 'CAPTURE_SHORTCUT_CHANGE'
    | 'CHANNEL_CREATE'
    | 'ERROR'
    | 'GUILD_CREATE'
    | 'GUILD_STATUS'
    | 'MESSAGE_CREATE'
    | 'MESSAGE_DELETE'
    | 'MESSAGE_UPDATE'
    | 'NOTIFICATION_CREATE'
    | 'READY'
    | 'SPEAKING_START'
    | 'SPEAKING_STOP'
    | 'VOICE_CHANNEL_SELECT'
    | 'VOICE_CONNECTION_STATUS'
    | 'VOICE_SETTINGS_UPDATE'
    | 'VOICE_STATE_CREATE'
    | 'VOICE_STATE_DELETE'
    | 'VOICE_STATE_UPDATE'

  type UserFlagsString =
    | 'DISCORD_EMPLOYEE'
    | 'DISCORD_PARTNER'
    | 'HYPESQUAD_EVENTS'
    | 'BUGHUNTER_LEVEL_1'
    | 'HOUSE_BRAVERY'
    | 'HOUSE_BRILLIANCE'
    | 'HOUSE_BALANCE'
    | 'EARLY_SUPPORTER'
    | 'TEAM_USER'
    | 'SYSTEM'
    | 'BUGHUNTER_LEVEL_2'
    | 'VERIFIED_BOT'
    | 'VERIFIED_DEVELOPER'
}