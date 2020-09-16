import { Input } from "electron";

type DualRecord<T> = Record<T, T>;

declare module 'discord-rpc' {
  import EventEmitter from 'events';

  export const Constants: {
    API_BASE_URL: string;
    browser: boolean;
    ChannelTypes: ['text', 'dm', 'voice', 'group', 'category', 'news', 'store'];
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
    public id: Snowflake;
  }

  export class Channel extends Base {
    public bitrate: number;
    public guildId: Snowflake;
    public name: string;
    public position: number;
    public topic: string | null;
    public type: ChannelType;
    public userLimit: number;
    public voiceStates: VoiceState[];

    public getGuild(timeout?: number): Promise<Guild>;
  }

  export class Guild extends Base {
    public iconURL: string | null;
    public name: string;
    public vanityURLCode: string | null;

    public getChannels(timeout?: number): Promise<Channel[]>;
  }

  class RPCClient extends EventEmitter {
    public constructor(options: RPCClientOptions);
    private config: RPCConfig | null;
    private transport: Transport | null;
    private _connectPromise: Promise<this> | null;
    private _expecting: Map<string, {
      reject: (err: Error | string) => void;
      resolve: (data: object) => void
    }>

    public accessToken: string | null;
    public readonly apiURL: string;
    public application: ClientApplication | null;
    public clientId: Snowflake | null;
    public readonly cdnURL: string;
    public options: RPCClientOptions;
    public user: User | null;

    public on(event: RPCEvent, listener: (data: Record<string, any>) => void): this;
    public on(event: 'error', listener: (error: Error) => void): this;
    public on(event: 'ready', listener: () => void): this;
    public on(event: 'disconnected', listener: () => void): this;

    public captureShortcut<T>(callback: (key: any, stop: (param: T) => Promise<void>) => void): Promise<T>;
    public clearActivity(pid?: number): Promise<void>;
    public closeJoinRequest(user: User | Snowflake): Promise<void>;
    public connect(clientId: Snowflake): Promise<this>;
    public destroy(): void;
    public getChannel(id: Snowflake, timeout?: number): Promise<Channel>;
    public getChannels(guildId: Snowflake, timeout?: number): Promise<Channel[]>;
    public getGuild(id: Snowflake, timeout?: number): Promise<Guild>;
    public getGuilds(timeout?: number): Promise<PartialGuild[]>;
    public getVoiceSettings(): Promise<VoiceSettings>;
    public login(options: RPCLoginOptions): Promise<this>;
    public selectTextChannel(id: Snowflake, timeout?: number): Promise<Channel>;
    public selectVoiceChannel(id: Snowflake, options: { force?: boolean; timeout?: number }): Promise<Channel>;
    public sendJoinInvite(user: User | Snowflake): Promise<void>;
    public sendJoinRequest(user: User | Snowflake): Promise<void>;
    public setActivity(data: PresenceData, pid?: number): Promise<void>;
    public setCertifiedDevices(devices: CertifiedDevice[]): Promise<void>;
    public setUserVoiceSettings(id: Snowflake, settings: Partial<UserVoiceSettings>): Promise<UserVoiceSettings>;
    public setVoiceSettings(settings: Partial<VoiceSettings>): Promise<VoiceSettings>;
    public subscribe(
      event: RPCEvent,
      args: Record<string, string>,
      callback: (data: Record<string, string>) => void
    ): Promise<() => Promise<this>>;

    private authenticate(accessToken: string): Promise<this>;
    private authorize(options: Omit<RPCLoginOptions, 'clientId' | 'accessToken'>): Promise<string>;
    private fetch(
      method: string,
      path: string,
      options?: {
        data?: object;
        query?: URLSearchParams | string | [string, string][] | object
      }
    ): Promise<object>;
    private request(cmd: RPCCommand, args?: Record<string, any>, event?: RPCEvent): Promise<object>;
  }

  export { RPCClient as Client };

  export class User extends Base {
    public avatar: string;
    public bot: boolean;
    public readonly defaultAvatarURL: string;
    public discriminator: string;
    public flags: UserFlags;
    public premiumType: 0 | 1 | 2 | null;
    public readonly tag: string;
    public username: string;

    public avatarURL(size?: number): string | null;
  }

  export class UserFlags {
    public readonly array: UserFlagsString[];
    public bitfield: number;

    public has(bit: number | UserFlagsString | UserFlagsString[]): boolean;
  }

  // Transports
  interface Transport {
    connect(): Promise<void>;
    onClose(): void;
    ping(): void;
    close(): void;
    send(data: object): void;
  }

  type ChannelType = (typeof Constants.ChannelTypes)[number];

  interface CertifiedDevice {
    type: 'audioinput' | 'audiooutput' | `videoinput`;
    id: string;
    vendor: { name: string; url: string };
    model: { name: string; url: string };
    related: string[];
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
    automaticGainControl?: boolean;
    hardwareMute?: boolean;
  }

  type DateResolvable = Date | string | number;

  interface PresenceData {
    state?: string;
    details?: string;
    instance?: boolean;
    timestamps?: {
      start?: DateResolvable;
      end?: DateResolvable
    };
    assets?: {
      largeImage?: string;
      smallImage?: string;
      largeImageText?: string;
      smallImageText?: string;
    };
    party?: {
      id: string;
      size?: [number, number];
    };
    secrets?: {
      join?: string;
      spectate?: string;
      match?: string;
    }
  }

  interface RPCConfig {
    cdn_host: string;
    api_endpoint: string;
    enviroment: string;
  }

  interface RPCLoginOptions {
    clientId: Snowflake;
    clientSecret?: string;
    accessToken?: string;
    rpcToken?: string | true;
    redirectUri?: string;
    scopes?: string[];
  }

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
    | 'VOICE_STATE_UPDATE';

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
    | 'VERIFIED_DEVELOPER';

  interface UserVoiceSettings {
    user_id: Snowflake;
    pan: { left: number; right: number };
    volume: number;
    mute: boolean;
  }

  interface ShortcutKeyCombo {
    type: number;
    code: number;
    name: string;
  }

  interface VoiceSettings {
    automaticGainControl: boolean;
    echoCancellation: boolean;
    noiseSuppression: boolean;
    qos: boolean;
    silenceWarning: boolean;
    deaf: boolean;
    mute: boolean;
    input: {
      device: string;
      volume: number;
      availableDevices: AvailableDevice
    };
    output: {
      device: string;
      volume: number;
      availableDevices: AvailableDevice
    };
    mode: {
      type: string;
      autoThreshold: boolean;
      delay: number;
      shortcut?: ShortcutKeyCombo[];
    };
  }

  type Snowflake = string;

  // Partials
  interface PartialGuild extends Guild {
    vanityURLCode: null;
  }
}
