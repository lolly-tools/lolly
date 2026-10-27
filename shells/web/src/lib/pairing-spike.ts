// SPDX-License-Identifier: MPL-2.0
/**
 * SPIKE, plan 324 section 8: the apps paired with a home server that holds its
 * own self-signed certificate. NOT SHIPPED. Everything here is inert unless the
 * frontend was built with `VITE_PAIRING_SPIKE=1` AND the desktop shell was built
 * with the Rust `pairing-spike` feature (which registers the `lolly-instance`
 * scheme and the `pairing_spike_*` commands). In a normal build Vite folds the
 * gate to false: what remains is an inert stub of about 700 bytes with no
 * command name, no scheme and no bench chunk, and a normal native build
 * answers no `pairing_spike_*` call.
 *
 * The idea: the webview never talks to the paired server. Rust holds a client
 * that trusts exactly one certificate (by SHA-256 fingerprint) for exactly one
 * origin, plus the session cookie. The page reaches it through a custom scheme,
 * so `fetch`, `<img>`, `srcset`, CSS `url()`, `<video>` and `FontFace` all
 * work, because the scheme handler answers every loader the same way.
 *
 *   https://192.168.1.20:8443/catalog/x.png
 *     becomes lolly-instance://localhost/catalog/x.png       (macOS, iOS, Linux)
 *     or http://lolly-instance.localhost/catalog/x.png        (Windows, Android)
 *
 * WebSockets cannot ride a custom scheme, so the collaboration socket is a
 * Rust tungstenite client behind the same verifier, bridged with a channel
 * (`PairedSocket`, the `CollabSocket` shape collab-provider already uses).
 *
 * The instance base stays the real https origin: identity, the stored session
 * binding and every origin comparison keep using that origin. Only the transport form
 * changes, at `instancePath` (URLs that reach the DOM) and `transportFetch`.
 */

export const SCHEME = 'lolly-instance';

declare global {
  interface ImportMetaEnv {
    readonly VITE_PAIRING_SPIKE?: string;
  }
}

/** Compile-time gate. Vite replaces the expression, so a normal build keeps none of the body. */
export const PAIRING_SPIKE_BUILD: boolean = import.meta.env?.VITE_PAIRING_SPIKE === '1';

export interface PairState {
  origin: string;
  fingerprint: string;
  keyId?: string | null;
  signedIn: boolean;
  servedKeyId?: string | null;
  handshakeMs?: number | null;
  bench?: boolean;
  trace?: boolean;
}

interface SpikeInternals {
  invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
  transformCallback?(cb: (raw: unknown) => void, once?: boolean): number;
  unregisterCallback?(id: number): void;
  convertFileSrc?(path: string, protocol?: string): string;
}

let paired: { origin: string; schemeBase: string } | null = null;
let nativeFetch: typeof fetch | null = null;

function internals(): SpikeInternals | null {
  const value = typeof window === 'undefined' ? undefined : (window as { __TAURI_INTERNALS__?: SpikeInternals }).__TAURI_INTERNALS__;
  return typeof value?.invoke === 'function' ? value : null;
}

/** The scheme's base for this platform, in the form Tauri itself builds. */
export function schemeBaseFor(convert?: (path: string, protocol?: string) => string): string {
  const made = convert ? convert('', SCHEME) : `${SCHEME}://localhost/`;
  return made.replace(/\/+$/, '');
}

/**
 * Asks the native side whether this app is paired. Returns null (spike off)
 * in every build without both halves. Called once from initInstanceBase.
 */
export async function initPairingSpike(): Promise<PairState | null> {
  if (!PAIRING_SPIKE_BUILD) return null;
  const tauri = internals();
  if (!tauri) return null;
  let state: PairState | null;
  try { state = await tauri.invoke<PairState | null>('pairing_spike_state'); } catch { return null; }
  if (!state?.origin) return null;
  activate(state.origin, schemeBaseFor(tauri.convertFileSrc?.bind(tauri)));
  if (state.bench !== undefined) forwardConsole(tauri, state.trace === true);
  if (state.bench) {
    setTimeout(() => {
      void import('./pairing-spike-bench.ts').then((m) => m.runPairingSpikeBench()).catch((error: unknown) =>
        tauri.invoke('pairing_spike_log', { line: `bench failed: ${String(error)}` }));
    }, 12000);
  }
  return state;
}

/** Spike diagnostics: page errors and warnings reach the launching terminal. */
function forwardConsole(tauri: SpikeInternals, all: boolean): void {
  const send = (kind: string, args: unknown[]): void => {
    const line = args.map((a) => a instanceof Error ? `${a.name}: ${a.message}` : typeof a === 'string' ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })()).join(' ');
    void tauri.invoke('pairing_spike_log', { line: `console.${kind} ${line}`.slice(0, 2000) }).catch(() => undefined);
  };
  for (const kind of all ? ['error', 'warn', 'info', 'log'] as const : ['error', 'warn'] as const) {
    const original = console[kind].bind(console);
    console[kind] = (...args: unknown[]) => { send(kind, args); original(...args); };
  }
  window.addEventListener('error', (e) => send('uncaught', [e.message, `${e.filename}:${e.lineno}`]));
  window.addEventListener('unhandledrejection', (e) => send('unhandledrejection', [e.reason]));
}

/** Test seam and the activation step: from here on, paired-origin URLs travel by the scheme. */
export function activate(origin: string, schemeBase: string): void {
  paired = { origin: new URL(origin).origin, schemeBase };
  installFetchShim();
}

export function _resetForTests(): void { paired = null; }

export function pairedOrigin(): string | null { return paired?.origin ?? null; }

export function isPairedScheme(url: string): boolean {
  return !!paired && (url === paired.schemeBase || url.startsWith(`${paired.schemeBase}/`));
}

/** https://<paired origin>/x becomes <scheme base>/x. Any other URL is returned unchanged. */
export function toPairedTransport(url: string): string {
  if (!paired) return url;
  if (url === paired.origin) return paired.schemeBase;
  if (url.startsWith(`${paired.origin}/`) || url.startsWith(`${paired.origin}?`)) {
    return paired.schemeBase + url.slice(paired.origin.length);
  }
  return url;
}

/** <scheme base>/x becomes https://<paired origin>/x, for Response.url and anything shown or shared. */
export function fromPairedTransport(url: string): string {
  if (!paired || !isPairedScheme(url)) return url;
  return paired.origin + url.slice(paired.schemeBase.length);
}

/**
 * Every fetch of a paired-origin URL, whoever makes it (the class B sites in
 * the inventory call the global fetch with an absolute instance URL), goes
 * through the scheme. Installed once, only while paired.
 */
function installFetchShim(): void {
  if (nativeFetch || typeof window === 'undefined') return;
  nativeFetch = window.fetch.bind(window);
  const original = nativeFetch;
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (paired && (url.startsWith(`${paired.origin}/`) || url === paired.origin || isPairedScheme(url))) {
      return pairedFetch(input instanceof Request ? input : url, init);
    }
    return original(input, init);
  }) as typeof fetch;
}

/** fetch() through the pinned native client. Response.url reads as the real origin. */
export async function pairedFetch(input: string | Request, init?: RequestInit): Promise<Response> {
  const go = nativeFetch ?? fetch;
  const url = typeof input === 'string' ? input : input.url;
  const transport = toPairedTransport(url);
  // A Request cannot be re-targeted by URL alone; copy the fields fetch reads.
  const base: RequestInit = typeof input === 'string' ? {} : {
    method: input.method,
    headers: input.headers,
    body: input.method === 'GET' || input.method === 'HEAD' ? undefined : await input.arrayBuffer(),
    signal: input.signal,
    cache: input.cache,
  };
  // Cookies never cross the scheme: Rust holds and attaches the session.
  const response = await go(transport, { ...base, ...init, credentials: 'omit' });
  try { Object.defineProperty(response, 'url', { value: fromPairedTransport(response.url || transport) }); } catch { /* read-only on this engine */ }
  return response;
}

/** The device-code sign-in parks `lw_session=<value>` here so <img> loads carry the session too. */
export async function pairedSetSession(cookiePair: string | null): Promise<void> {
  const tauri = internals();
  if (!paired || !tauri) return;
  await tauri.invoke('pairing_spike_set_session', { cookie: cookiePair });
}

// ── The collaboration socket ────────────────────────────────────────────────

type SocketEvent =
  | { kind: 'open'; protocol: string }
  | { kind: 'message'; data: string }
  | { kind: 'close'; code: number; reason: string }
  | { kind: 'error'; message: string };

/**
 * The `CollabSocket` slice (org/collab-protocol.ts) over the Rust bridge.
 * Frames arrive through a Tauri channel in order; sends are commands.
 */
export class PairedSocket {
  readyState = 0;
  protocol = '';
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data?: unknown }) => void) | null = null;
  onclose: ((ev: { code?: number; reason?: string }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  #id: number | null = null;
  #queued: string[] = [];
  #closeAsked: [number, string] | null = null;
  #callback: number | null = null;

  constructor(url: string, protocols?: string[]) {
    const tauri = internals();
    if (!tauri?.transformCallback || !paired) throw new Error('paired socket unavailable');
    const target = new URL(url.replace(/^wss:/, 'https:'));
    if (target.origin !== paired.origin) throw new Error('not the paired origin');
    let next = 0;
    const pending = new Map<number, SocketEvent>();
    this.#callback = tauri.transformCallback((raw) => {
      const { index, message, end } = raw as { index: number; message?: SocketEvent; end?: boolean };
      // The channel's end marker arrives after the last event: release the callback then.
      if (end) { if (this.#callback !== null) tauri.unregisterCallback?.(this.#callback); return; }
      pending.set(index, message as SocketEvent);
      while (pending.has(next)) {
        const event = pending.get(next) as SocketEvent;
        pending.delete(next);
        next += 1;
        this.#deliver(event);
      }
    });
    tauri.invoke<number>('pairing_spike_ws_open', {
      path: target.pathname + target.search,
      protocols: protocols ?? [],
      onEvent: `__CHANNEL__:${this.#callback}`,
    }).then((id) => {
      this.#id = id;
      for (const data of this.#queued.splice(0)) void tauri.invoke('pairing_spike_ws_send', { id, data });
      if (this.#closeAsked) void tauri.invoke('pairing_spike_ws_close', { id, code: this.#closeAsked[0], reason: this.#closeAsked[1] });
    }, (error: unknown) => {
      this.#deliver({ kind: 'error', message: String(error) });
      this.#deliver({ kind: 'close', code: 1006, reason: '' });
    });
  }

  #deliver(event: SocketEvent): void {
    if (event.kind === 'open') { this.readyState = 1; this.protocol = event.protocol; this.onopen?.({}); return; }
    if (event.kind === 'message') { this.onmessage?.({ data: event.data }); return; }
    if (event.kind === 'error') { this.onerror?.({ message: event.message }); return; }
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.onclose?.({ code: event.code, reason: event.reason });
  }

  send(data: string): void {
    if (this.readyState !== 1) throw new Error('socket not open');
    const tauri = internals();
    if (this.#id === null) { this.#queued.push(data); return; }
    void tauri?.invoke('pairing_spike_ws_send', { id: this.#id, data });
  }

  close(code = 1000, reason = ''): void {
    if (this.readyState >= 2) return;
    this.readyState = 2;
    const tauri = internals();
    if (this.#id === null) { this.#closeAsked = [code, reason]; return; }
    void tauri?.invoke('pairing_spike_ws_close', { id: this.#id, code, reason });
  }
}

/** The socket constructor to use for `url`, or null to keep the platform WebSocket. */
export function pairedSocketCtor(url: string): (new (url: string, protocols?: string[]) => PairedSocket) | null {
  if (!paired) return null;
  try {
    return new URL(url.replace(/^wss:/, 'https:')).origin === paired.origin ? PairedSocket : null;
  } catch { return null; }
}

// ── The QR payload ──────────────────────────────────────────────────────────

export interface PairingLink { origin: string; fingerprint: string; keyId: string | null }

/**
 * `lolly://pair?v=1&u=<https origin>&fp=<base64url SHA-256>&kid=<catalogue keyId>`.
 * lolly:// is already registered by both apps, so a phone's camera opens the
 * app straight from the appliance's screen. Mirrors parse_pairing_link in Rust.
 */
export function parsePairingLink(raw: string): PairingLink {
  const url = new URL(raw.trim());
  if (url.protocol !== 'lolly:' || url.host !== 'pair') throw new Error('Not a Lolly pairing link');
  if (url.searchParams.get('v') !== '1') throw new Error('This pairing code needs a newer Lolly');
  const u = new URL(url.searchParams.get('u') ?? '');
  if (u.protocol !== 'https:' || u.username || u.password || u.pathname !== '/' || u.search || u.hash) {
    throw new Error('A paired server must be a plain https origin');
  }
  const fp = url.searchParams.get('fp') ?? '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(fp)) throw new Error('The certificate fingerprint must be a SHA-256 digest');
  const kid = url.searchParams.get('kid');
  if (kid !== null && !/^[A-Za-z0-9_-]{1,64}$/.test(kid)) throw new Error('Invalid catalogue key id');
  return { origin: u.origin, fingerprint: fp, keyId: kid };
}
