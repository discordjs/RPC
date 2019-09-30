import {RPCClient} from "../client";
import {Socket} from "net";
import {EventEmitter} from "events";

declare enum OPCodes {
    HANDSHAKE = 0,
    FRAME = 1,
    CLOSE = 2,
    PING = 3,
    PONG = 4
}

declare const working: {
    full: string,
    op?: OPCodes
};


declare function getIPCPath(id: number): string
declare function getIPC(id?: number): Promise<Socket>
declare function findEndpoint(tries?: number): Promise<number>
declare function encode(op: OPCodes, data: string): Buffer
declare function decode(socket: Socket, callback: ((obj: { op: OPCodes, data: object }) => void)): void


declare class IPCTransport extends EventEmitter {
    private client: RPCClient;
    private socket?: Socket;
    constructor(client: RPCClient)
    public connect(): Promise<void>
    public onClose(e: Error | boolean)
    public send(data: any, op?: OPCodes): void
    public close(): void
    public ping(): void
}
