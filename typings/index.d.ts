declare module 'discord-rpc' {

	import {
		Collection,
		Snowflake,
		ClientApplication,
		Guild,
		Channel,
		User,
		BaseClient,
		ClientOptions
	} from 'discord.js';

	export class Client extends BaseClient {
		public constructor(options: RPCClientOptions);
		public accessToken?: string;
		public clientID?: string;
		public application?: ClientApplication;
		public user?: User;
		public transport: RPCTransport;
		private _expecting: Map<string, any>;
		private _subscriptions: Map<string, any>;
		private users: createCache<User>;
		private channels: createCache<Channel>;
		private guilds: createCache<Guild>;

		public login(clientID: string, options: RPCLoginOptions): Promise<Client>;
		public getGuild(id: Snowflake, timeout?: number): Promise<Guild>;
		public getGuilds(timeout?: number): Promise<Collection<Snowflake, Guild>>;
		public getChannel(id: string, timeout?: number): Promise<Channel>;
		public getChannels(timeout?: number): Promise<Collection<Snowflake, Guild>>;
		public setUserVoiceSettings(id: Snowflake, settings?: UserVoiceSettings): Promise<any>;
		public selectVoiceChannel(id: Snowflake, options?: { timeout?: number, force?: boolean }): Promise<any>;
		public selectTextChannel(id: Snowflake, options?: { timeout?: number, force?: boolean }): Promise<any>;
		public getVoiceSettings(): Promise<any>;
		public setVoiceSettings(args: Object): Promise<any>;
		public captureShortcut(callback: Function): Promise<Function>;
		public setActivity(args?: Object, pid?: number): Promise<any>;
		public sendJoinInvite(user: User | Snowflake): Promise<any>;
		public sendJoinRequest(user: User | Snowflake): Promise<any>;
		public closeJoinRequest(user: User | Snowflake): Promise<any>;
		public subscribe(event: string, args?: Object, callback: Function): Promise<Object>;
		public destroy(): Promise<void>;

		private request(cmd: string, args: Object, evt: string): Promise<any>;
		private _onRpcMessage(message: Object): void;
		private authorize(options: Object): Promise<any>;
		private authenticate(accessToken: string): Promise<any>;
	}

	export function register(id: string): any;

	type Util = {
		pid?: number;
		register: (id: string) => any;
	};

	// Types
	export type RPCClientOptions = {
		transport: string;
	} & ClientOptions;

	export type RPCLoginOptions = {
		clientSecret?: string;
		accessToken?: string;
		rpcToken?: string;
		tokenEndpoint?: string;
	};

	export type UserVoiceSettings = {
		id: Snowflake;
		pan?: Object;
		volume?: number;
		mute?: boolean;
	};

	type createCache<T> = {
		has(): false;
		delete(): false;
		get(): undefined;
		create: (data: any) => T;
	};

}
