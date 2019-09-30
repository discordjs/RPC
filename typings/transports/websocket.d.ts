import {EventEmitter} from 'events'
import * as ws from 'ws'
import {RPCClient} from "../client";

declare const websocket: ws | WebSocket;

declare function pack(d: object): string
declare function unpack(d: string): object

declare class WebSocketTransport extends EventEmitter {
    public client: RPCClient;
    public ws?: WebSocket;
    public tries: number;
    constructor(client: RPCClient)
    public connect(options: object, tries?: number): Promise<void>
    public send(data: any): void
    public close(): void
    public ping(): void
    public onMessage(event: Event): void
    public onOpen(): void
    public onClose(e: Error): void
}
