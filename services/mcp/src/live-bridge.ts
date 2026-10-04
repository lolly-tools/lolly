// SPDX-License-Identifier: MPL-2.0
/**
 * The agent end of `live-v1` (plans/289 D1): how a local MCP server reaches a Design
 * editor the person has open. Two ways in, one verb set:
 *
 *   - DESKTOP. The app, with Allow AI control on, listens on loopback and writes
 *     `live.json` (port and a per-launch token, mode 0600) to its data directory.
 *     Each request is one framed call carrying the token
 *     (@lolly-tools/node-shell/desktop-renderer `callLiveServer`).
 *   - WEB. A page cannot listen, so this server does: a WebSocket on 127.0.0.1 at a
 *     random port, and a pairing code the person types into Design (Lolly menu,
 *     Connect an AI agent). The code is the port plus eight random characters. The
 *     tab connects, sends the code as its first frame, and from then on answers each
 *     request the bridge sends.
 *
 * What protects the web pairing: the socket binds loopback only and refuses any
 * other peer; the `Origin` header must be Lolly's own site (or one named in
 * LOLLY_LIVE_ORIGINS, or a localhost page for development) before a frame is read;
 * the code is single use and three wrong codes end the pairing; one tab at a time;
 * no compression; a 16 MB frame cap. Only stdio starts this. The hosted server
 * never does, because its process is not on the person's machine.
 */

import { randomInt, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { WebSocket, WebSocketServer } from 'ws';
import { LIVE_ERRORS, LIVE_LIMITS, LIVE_PROTOCOL, type LiveReplyV1 } from '@lolly-tools/core';
import { callLiveServer, readLiveServer, type RenderServer } from '@lolly-tools/node-shell/desktop-renderer';

/** The sites whose pages may pair, before LOLLY_LIVE_ORIGINS adds a self-hosted one. */
export const LIVE_DEFAULT_ORIGINS = ['https://lolly.tools', 'https://www.lolly.tools'] as const;

const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const PAIR_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 60_000;

export class LiveBridgeError extends Error {
  readonly code?: number;
  constructor(message: string, code?: number) {
    super(message);
    if (code !== undefined) this.code = code;
  }
}

/** May a page from this origin pair? Lolly's own site, a named self-hosted one, or localhost. */
export function liveOriginAllowed(origin: string | undefined, extra: readonly string[] = []): boolean {
  if (!origin) return false;
  if ((LIVE_DEFAULT_ORIGINS as readonly string[]).includes(origin) || extra.includes(origin)) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/.test(origin);
}

/** The origins LOLLY_LIVE_ORIGINS names, comma separated, each a bare origin. */
export function extraOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.LOLLY_LIVE_ORIGINS ?? '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter((s) => /^https?:\/\/[^/\s]+$/.test(s));
}

/** Normalise a typed secret: case folded, look-alikes mapped, separators dropped. */
export function normaliseSecret(text: string): string {
  return text.toUpperCase().replace(/[\s-]+/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
}

function mintSecret(): string {
  let out = '';
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

const sameSecret = (a: string, b: string): boolean => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

const loopbackPeer = (req: IncomingMessage): boolean => {
  const addr = req.socket.remoteAddress ?? '';
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
};

export type LiveSurface = 'desktop' | 'web';

export interface LiveStatus {
  state: 'idle' | 'pairing' | 'connected';
  surface?: LiveSurface;
  code?: string;
  /** What the editor said in hello: tool, engine. */
  editor?: { tool: string; engine: string };
  /** Why the last connection ended, if one did. */
  ended?: string;
}

export interface LiveBridgeOpts {
  env?: NodeJS.ProcessEnv;
  /** The name the editor shows in its connected pill. */
  clientName?: () => string;
  /** Read the desktop advert (tests inject one). */
  readDesktop?: () => RenderServer | null;
  log?: (line: string) => void;
}

export class LiveBridge {
  private wss: WebSocketServer | null = null;
  private socket: WebSocket | null = null;
  private secret = '';
  private code = '';
  private attempts = 0;
  private desktop: RenderServer | null = null;
  private editor: LiveStatus['editor'];
  private ended = '';
  private seq = 0;
  private readonly pending = new Map<number, { resolve: (r: LiveReplyV1) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  private readonly waiters = new Set<() => void>();

  private readonly opts: LiveBridgeOpts;

  constructor(opts: LiveBridgeOpts = {}) { this.opts = opts; }

  status(): LiveStatus {
    if (this.desktop) return { state: 'connected', surface: 'desktop', ...(this.editor ? { editor: this.editor } : {}) };
    if (this.socket) return { state: 'connected', surface: 'web', ...(this.editor ? { editor: this.editor } : {}) };
    if (this.wss) return { state: 'pairing', surface: 'web', code: this.code };
    return { state: 'idle', ...(this.ended ? { ended: this.ended } : {}) };
  }

  /**
   * Connect to the desktop app when it is listening (or when asked for it), else
   * open a web pairing and return its code. Ends any earlier connection first.
   */
  async connect(prefer: 'auto' | LiveSurface = 'auto'): Promise<LiveStatus> {
    this.close('A new connection was started.');
    this.ended = '';
    if (prefer !== 'web') {
      const server = (this.opts.readDesktop ?? (() => readLiveServer({ env: this.opts.env })))();
      if (server) {
        this.desktop = server;
        try {
          await this.hello();
          return this.status();
        } catch (error) {
          this.desktop = null;
          if (prefer === 'desktop') throw error;
        }
      } else if (prefer === 'desktop') {
        throw new LiveBridgeError('The Lolly app is not listening. In the app, turn on Settings > Allow AI control, then try again.');
      }
    }
    await this.listen();
    return this.status();
  }

  /** Wait up to `ms` for a pairing to finish. Resolves to the status either way. */
  async waitConnected(ms: number): Promise<LiveStatus> {
    if (this.status().state !== 'pairing' || ms <= 0) return this.status();
    await new Promise<void>((resolve) => {
      const done = (): void => { clearTimeout(timer); this.waiters.delete(done); resolve(); };
      const timer = setTimeout(done, ms);
      this.waiters.add(done);
    });
    return this.status();
  }

  /** One live-v1 request; the result, or a LiveBridgeError carrying the editor's message. */
  async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.desktop && !this.socket) {
      throw new LiveBridgeError(this.wss
        ? `Not paired yet. Ask the person to open Design, choose Connect an AI agent in the Lolly menu and type ${this.code}.`
        : 'Not connected. Call lolly_live_connect first.');
    }
    let reply = await this.send(method, params);
    // The desktop app answers from whichever Design view is open; after the person
    // opens another one, that view's session has not heard hello yet. Say it again
    // once, then retry. A person's Disconnect refuses hello too, so it still holds.
    if (reply.error?.code === LIVE_ERRORS.notReady && this.desktop && method !== 'hello') {
      const again = await this.send('hello', { protocol: LIVE_PROTOCOL, client: this.opts.clientName?.() || 'AI agent' });
      if (!again.error) reply = await this.send(method, params);
    }
    if (reply.error) throw new LiveBridgeError(reply.error.message, reply.error.code);
    return reply.result;
  }

  close(reason = 'The agent disconnected.'): void {
    for (const [, p] of this.pending) { clearTimeout(p.timer); p.reject(new LiveBridgeError(reason)); }
    this.pending.clear();
    if (this.socket) { try { this.socket.close(1000, 'closed'); } catch { /* already gone */ } }
    this.socket = null;
    if (this.wss) this.wss.close();
    this.wss = null;
    if (this.desktop || this.code) this.ended = reason;
    this.desktop = null;
    this.code = '';
    this.secret = '';
    this.editor = undefined;
    this.wake();
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private wake(): void { for (const w of [...this.waiters]) w(); }

  private async hello(): Promise<void> {
    const result = await this.request('hello', { protocol: LIVE_PROTOCOL, client: this.opts.clientName?.() || 'AI agent' }) as { tool?: unknown; engine?: unknown };
    this.editor = { tool: String(result?.tool ?? ''), engine: String(result?.engine ?? '') };
  }

  private send(method: string, params?: Record<string, unknown>): Promise<LiveReplyV1> {
    const id = ++this.seq;
    const request = { jsonrpc: '2.0', id, method, ...(params ? { params } : {}) };
    const text = JSON.stringify(request);
    if (text.length > LIVE_LIMITS.maxRequestBytes) return Promise.reject(new LiveBridgeError('The request is larger than the 4 MB limit.'));
    if (this.desktop) {
      return callLiveServer(this.desktop, request, REQUEST_TIMEOUT_MS, LIVE_LIMITS.maxReplyBytes).then((reply) => {
        const r = reply as LiveReplyV1 & { ok?: boolean; error?: unknown };
        if (r && typeof r === 'object' && r.ok === false) throw new LiveBridgeError(String((r as { error?: unknown }).error ?? 'The app refused the request.'));
        return r;
      }, (error: Error) => {
        this.close(`The Lolly app stopped answering: ${error.message}`);
        throw new LiveBridgeError(error.message);
      });
    }
    const socket = this.socket!;
    return new Promise<LiveReplyV1>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new LiveBridgeError(`The editor did not answer ${method} within ${REQUEST_TIMEOUT_MS / 1000} s.`));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      socket.send(text, (error) => {
        if (!error) return;
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new LiveBridgeError(`Could not reach the tab: ${error.message}`));
      });
    });
  }

  private async listen(): Promise<void> {
    const { WebSocketServer } = await import('ws');
    const origins = extraOrigins(this.opts.env);
    const wss = new WebSocketServer({
      host: '127.0.0.1',
      port: 0,
      maxPayload: LIVE_LIMITS.maxReplyBytes,
      perMessageDeflate: false,
      verifyClient: (info, done) => {
        if (!loopbackPeer(info.req)) return done(false, 403, 'Loopback only');
        if (!liveOriginAllowed(info.origin, origins)) return done(false, 403, 'This site may not pair');
        if (this.socket) return done(false, 409, 'Already paired');
        done(true);
      },
    });
    await new Promise<void>((resolve, reject) => {
      wss.on('listening', () => resolve());
      wss.on('error', reject);
    });
    const address = wss.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    this.wss = wss;
    this.secret = mintSecret();
    this.code = `${port}-${this.secret.slice(0, 4)}-${this.secret.slice(4)}`;
    this.attempts = 0;
    wss.on('connection', (socket) => this.admit(wss, socket));
    this.opts.log?.(`lolly-mcp: live pairing open on 127.0.0.1:${port}`);
  }

  private admit(wss: WebSocketServer, socket: WebSocket): void {
    let paired = false;
    const pairTimer = setTimeout(() => { if (!paired) socket.close(1008, 'No code'); }, PAIR_TIMEOUT_MS);
    socket.on('message', (data, isBinary) => {
      const text = isBinary ? '' : Buffer.isBuffer(data) ? data.toString('utf8') : Array.isArray(data) ? Buffer.concat(data).toString('utf8') : Buffer.from(data).toString('utf8');
      let value: unknown;
      try { value = JSON.parse(text); } catch { value = null; }
      if (!paired) {
        clearTimeout(pairTimer);
        const given = value && typeof value === 'object' && typeof (value as { pair?: unknown }).pair === 'string' ? normaliseSecret((value as { pair: string }).pair) : '';
        if (this.wss === wss && !this.socket && this.secret && sameSecret(given, this.secret)) {
          paired = true;
          this.socket = socket;
          this.secret = ''; // single use
          socket.send(JSON.stringify({ paired: true }));
          void this.hello().then(() => this.wake(), (error: Error) => this.close(`The editor refused hello: ${error.message}`));
          return;
        }
        this.attempts++;
        socket.close(1008, 'Wrong code');
        if (this.attempts >= LIVE_LIMITS.maxCodeAttempts && this.wss === wss) this.close('Three wrong codes ended the pairing. Call lolly_live_connect for a new code.');
        return;
      }
      const reply = value as LiveReplyV1 | null;
      const id = reply && typeof reply === 'object' && typeof reply.id === 'number' ? reply.id : null;
      const waiting = id === null ? undefined : this.pending.get(id);
      if (!waiting) return;
      clearTimeout(waiting.timer);
      this.pending.delete(id!);
      waiting.resolve(reply!);
    });
    socket.on('close', () => {
      clearTimeout(pairTimer);
      if (paired && this.socket === socket) {
        this.socket = null;
        this.close('The tab disconnected.');
      }
    });
    socket.on('error', () => { /* close follows */ });
  }
}
