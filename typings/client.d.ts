import {Channel, ClientOptions, Collection, Guild, OAuth2Application, Snowflake, User} from "discord.js";
import {EventEmitter} from 'events';
import {WebSocketTransport} from "./transports/websocket";
import {IPCTransport} from "./transports/ipc";
declare type RichPresenceArgs = {
    startTimestamp?: number;
    endTimestamp?: number;
    largeImageKey?: string;
    largeImageText?: string;
    smallImageKey?: string;
    smallImageText?: string;
    partySize?: number;
    partyMax?: number;
    matchSecret?: string;
    joinSecret?: string;
    spectateSecret?: string;
    partyId?: string;
    state?: string;
    details?: string
    instance?: number
}

declare type RPCLoginOptions = {
    clientId?: string;
    clientSecret?: string;
}

declare type AuthOptions = {
    scopes?: string
    clientSecret?: string
    rpcToken?: string
    redirectUri?: string
}

declare type SelectChannelOptions = {
    timeout?: number;
    force?: boolean
}

declare interface RPCClientOptions extends ClientOptions {
    transport: 'websocket' | 'ipc'
}

declare type UserVoiceSettings = {
    id: Snowflake
    pan: {
        left: number,
        right: number
    }
    volume: number;
    mute: boolean;
}
declare type ClientApplication = OAuth2Application;
declare type CertifiedDevice = {
    type: 'AUDIO_INPUT' | 'AUDIO_OUTPUT' | 'VIDEO_INPUT';
    uuid: string;
    vendor: {
        name: string,
        url: string,
    };
    model: {
        name: string,
        url: string
    };
    related: string[];
    echoCancellation: boolean;
    noiseSuppression: boolean;
    automaticGainControl: boolean;
    hardwareMute: boolean;
}


export declare class RPCClient extends EventEmitter {
    private _expecting: Map<string, { resolve: Function, reject: Function}>;
    private _subscriptions: Map<string, string>;
    public application: ClientApplication;
    private transport: WebSocketTransport | IPCTransport;
    public user: User;
    constructor(options?: RPCClientOptions)
    private _onRpcMessage(message?: object): void
    private authenticate(accessToken: string): Promise<void>
    private authorize(option: AuthOptions): Promise<void>
    public captureShortcut(callback: (shortcut: string, stop: () => void) => void): Promise<Function>
    public clearActivity(pid?: number): Promise<void>
    public closeJoinRequest(user: User): Promise<void>
    public connection(): void
    public destroy(): void
    public getChannel(id: Snowflake, timeout?: number): Promise<Channel>
    public getChannels(id?: Snowflake[], timeout?: number): Promise<Collection<Snowflake, Channel>>
    public getGuild(id: Snowflake, timeout?: number): Guild
    public getGuilds(timeout?: number): Collection<Snowflake, Guild>
    public getVoiceSettings(): Promise<void>
    public login(options: RPCLoginOptions): Promise<RPCClient>
    private request(cmd: string, args?: object, evt?: string): Promise<void>
    public selectTextChannel(id: Snowflake, options?: SelectChannelOptions): Promise<void>
    public selectVoiceChannel(id: Snowflake, options?: SelectChannelOptions): Promise<void>
    public sendJoinInvite(user: User): Promise<void>
    public sendJoinRequest(user: User): Promise<void>
    public setActivity(args?: RichPresenceArgs, pid?: number): Promise<void>
    public setCertifiedDevices(devices: CertifiedDevice[])
    public setUserVoiceSettings(id: Snowflake, settings: UserVoiceSettings): Promise<void>
    public setVoiceSettings(args: object): Promise<void>
    public subscribe(event: string, args: object, callback: Function): Promise<Object>
}
