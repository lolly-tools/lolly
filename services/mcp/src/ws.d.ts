// SPDX-License-Identifier: MPL-2.0
// ws ships no type declarations (no @types/ws); the live bridge (live-bridge.ts)
// touches only the server surface below, so declare exactly that. This is an
// ambient module declaration, like jsdom.d.ts.
declare module 'ws' {
  import type { IncomingMessage } from 'node:http';
  import type { AddressInfo } from 'node:net';

  export class WebSocket {
    /** The client side, used by the tests to stand in for a tab. */
    constructor(address: string, options?: { origin?: string });
    static readonly OPEN: number;
    readonly readyState: number;
    send(data: string, cb?: (error?: Error) => void): void;
    close(code?: number, reason?: string): void;
    terminate(): void;
    on(event: 'message', listener: (data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => void): this;
    on(event: 'close', listener: (code: number, reason: Buffer) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'open', listener: () => void): this;
    on(event: 'unexpected-response', listener: (req: unknown, res: IncomingMessage) => void): this;
  }

  export interface VerifyClientInfo { origin: string; secure: boolean; req: IncomingMessage }

  export interface ServerOptions {
    host?: string;
    port?: number;
    maxPayload?: number;
    perMessageDeflate?: boolean;
    verifyClient?: (info: VerifyClientInfo, callback: (result: boolean, code?: number, message?: string) => void) => void;
  }

  export class WebSocketServer {
    constructor(options: ServerOptions, callback?: () => void);
    readonly clients: Set<WebSocket>;
    address(): AddressInfo | string | null;
    close(cb?: (error?: Error) => void): void;
    on(event: 'connection', listener: (socket: WebSocket, req: IncomingMessage) => void): this;
    on(event: 'listening', listener: () => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
  }
}
