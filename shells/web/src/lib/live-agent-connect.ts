// SPDX-License-Identifier: MPL-2.0
/**
 * The tab's side of a web pairing (plans/289 D1). The agent's local MCP server listens
 * on loopback and gives the agent a code; the person types the code here; the tab
 * connects to `ws://127.0.0.1:<port>`, sends the code as its first frame, and from
 * then on answers each request through a live session (lib/live-agent.ts).
 *
 * The tab never listens and never connects anywhere but loopback: the port comes
 * from the code and the host is fixed.
 */

import { LIVE_LIMITS } from '@lolly-tools/core';
import { createLiveSession, type LiveEditor, type LiveSession, type LiveSessionOpts } from './live-agent.ts';

export interface PairingCode { port: number; secret: string }

/**
 * Read a typed code: the port, then eight characters in two groups ("52817-K7QF-9XMB").
 * Case, spaces and look-alike letters (O for 0, I and L for 1) are forgiven.
 */
export function parsePairingCode(text: string): PairingCode | null {
  const m = /^\s*(\d{2,5})\s*[-\s]\s*([0-9a-z]{4})\s*[-\s]?\s*([0-9a-z]{4})\s*$/i.exec(text);
  if (!m) return null;
  const port = Number(m[1]);
  if (port < 1024 || port > 65_535) return null;
  const secret = `${m[2]}${m[3]}`.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1');
  return { port, secret };
}

/** The part of the browser WebSocket this module uses, so tests can stand one in. */
export interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code: number; reason: string }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

export interface AgentLink {
  session: LiveSession;
  /** End the link from the editor. */
  disconnect(): void;
}

export interface PairOpts extends LiveSessionOpts {
  /** Called once when the link ends, from either side, with the reason. */
  onEnd?(reason: 'person' | 'agent' | 'idle' | 'error'): void;
  makeSocket?: (url: string) => SocketLike;
  /** How long to wait for the agent to accept the code. */
  pairTimeoutMs?: number;
}

/** Why a pairing did not start; the dialog words each one for the person. */
export type PairFailure = 'timeout' | 'unreachable' | 'wrong-code' | 'closed';

export class PairError extends Error {
  readonly reason: PairFailure;
  constructor(reason: PairFailure) { super(reason); this.reason = reason; }
}

function browserSocket(url: string): SocketLike {
  const socket = new WebSocket(url);
  const adapter: SocketLike = {
    get readyState() { return socket.readyState; },
    send: data => socket.send(data), close: (code, reason) => socket.close(code, reason),
    onopen: null, onmessage: null, onclose: null, onerror: null,
  };
  socket.addEventListener('open', event => adapter.onopen?.(event));
  socket.addEventListener('message', event => adapter.onmessage?.({ data: event.data }));
  socket.addEventListener('close', event => adapter.onclose?.({ code: event.code, reason: event.reason }));
  socket.addEventListener('error', event => adapter.onerror?.(event));
  return adapter;
}

/**
 * Pair with an agent. Resolves with the live link once the agent accepted the code;
 * rejects with a PairError naming why it did not.
 */
export function pairWithAgent(code: PairingCode, editor: LiveEditor, opts: PairOpts = {}): Promise<AgentLink> {
  const socket = (opts.makeSocket ?? browserSocket)(`ws://127.0.0.1:${code.port}`);
  const session = createLiveSession(editor, opts);
  let paired = false;
  let ended = false;
  let idleTimer: ReturnType<typeof setInterval> | null = null;
  const end = (reason: 'person' | 'agent' | 'idle' | 'error'): void => {
    if (ended) return;
    ended = true;
    session.close();
    if (idleTimer) clearInterval(idleTimer);
    try { socket.close(1000, reason); } catch { /* already closed */ }
    if (paired) opts.onEnd?.(reason);
  };
  return new Promise<AgentLink>((resolve, reject) => {
    const fail = (reason: PairFailure): void => {
      if (paired) return;
      ended = true;
      clearTimeout(timer);
      try { socket.close(); } catch { /* already closed */ }
      reject(new PairError(reason));
    };
    const timer = setTimeout(() => fail('timeout'), opts.pairTimeoutMs ?? 10_000);
    socket.onopen = () => socket.send(JSON.stringify({ pair: code.secret }));
    socket.onerror = () => fail('unreachable');
    socket.onclose = (ev) => {
      if (!paired) { fail(ev.reason === 'Wrong code' ? 'wrong-code' : 'closed'); return; }
      end('agent');
    };
    socket.onmessage = (ev) => {
      if (typeof ev.data !== 'string' || ev.data.length > LIVE_LIMITS.maxRequestBytes) return;
      if (!paired) {
        let value: unknown;
        try { value = JSON.parse(ev.data); } catch { value = null; }
        if (value && typeof value === 'object' && (value as { paired?: unknown }).paired === true) {
          paired = true;
          clearTimeout(timer);
          idleTimer = setInterval(() => { if (session.idleFor() > LIVE_LIMITS.idleMs) end('idle'); }, 60_000);
          resolve({ session, disconnect: () => end('person') });
        }
        return;
      }
      void session.handle(ev.data).then((reply) => {
        if (!ended && socket.readyState === 1) socket.send(reply);
      });
    };
  });
}
