// SPDX-License-Identifier: MPL-2.0
/**
 * SPIKE, plan 324 section 8: the measurement harness for the pinned-certificate
 * transport. NOT SHIPPED. Loaded only by pairing-spike.ts when the native side
 * reports `bench: true` (LOLLY_PAIRING_SPIKE_BENCH=1 on a `pairing-spike` build).
 * Results go to the launching terminal through `pairing_spike_log`.
 *
 * It needs `/spike-bench/{b1k,b64k,b1m,b16m}.bin` and `/spike-bench/img.png`
 * on the paired origin (the spike's Caddy front serves them).
 */
import { PairedSocket, pairedOrigin, schemeBaseFor } from './pairing-spike.ts';
import { COLLAB_OP_VERSION } from '../org/collab-protocol.ts';

interface Internals {
  invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
  convertFileSrc?(path: string, protocol?: string): string;
}

const tauri = (): Internals => (window as unknown as { __TAURI_INTERNALS__: Internals }).__TAURI_INTERNALS__;
const log = (line: unknown): Promise<void> => tauri().invoke('pairing_spike_log', { line: JSON.stringify(line) });

/** WebKit coarsens performance.now() to 1 ms, so the mean over a batch is the
 *  figure to read for small requests; median and p90 are kept for the shape. */
function stats(samples: number[]): { n: number; mean: number; median: number; p90: number } {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (q: number): number => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? NaN;
  const round = (v: number): number => Math.round(v * 100) / 100;
  const mean = sorted.reduce((a, b) => a + b, 0) / Math.max(1, sorted.length);
  return { n: sorted.length, mean: round(mean), median: round(at(0.5)), p90: round(at(0.9)) };
}

async function timed(n: number, run: (i: number) => Promise<number | undefined>): Promise<{ js: number[]; native: number[] }> {
  const js: number[] = [];
  const native: number[] = [];
  await run(-1); // warm the connection and the code path
  for (let i = 0; i < n; i++) {
    const t = performance.now();
    const nativeMs = await run(i);
    js.push(performance.now() - t);
    if (typeof nativeMs === 'number' && Number.isFinite(nativeMs)) native.push(nativeMs);
  }
  return { js, native };
}

export async function runPairingSpikeBench(): Promise<void> {
  const fetchFn = window.fetch;
  const scheme = schemeBaseFor(tauri().convertFileSrc?.bind(tauri()));
  await log({ bench: 'start', scheme, origin: pairedOrigin(), pageOrigin: location.origin, ua: navigator.userAgent });
  const files: Array<[string, number]> = [['b1k.bin', 200], ['b64k.bin', 200], ['b1m.bin', 40], ['b16m.bin', 8]];
  for (const [file, n] of files) {
    const path = `/spike-bench/${file}`;
    const viaScheme = await timed(n, async (i) => {
      const r = await fetchFn(`${scheme}${path}?i=${i}`, { credentials: 'omit', cache: 'no-store' });
      await r.arrayBuffer();
      return Number(r.headers.get('x-pairing-spike-native-ms'));
    });
    const preflighted = await timed(n, async (i) => {
      const r = await fetchFn(`${scheme}${path}?p=${i}`, { credentials: 'omit', cache: 'no-store', headers: { 'x-lolly-client': 'tauri bench' } });
      await r.arrayBuffer();
      return Number(r.headers.get('x-pairing-spike-native-ms'));
    });
    const ipcRaw = await timed(n, async () => {
      const body = await tauri().invoke<ArrayBuffer>('pairing_spike_fetch_ipc', { path });
      if (!(body instanceof ArrayBuffer)) throw new Error('raw IPC did not return bytes');
      return undefined;
    });
    const ipcJson = await timed(Math.min(n, 6), async () => {
      const body = await tauri().invoke<number[]>('pairing_spike_fetch_json', { path });
      Uint8Array.from(body);
      return undefined;
    });
    await log({
      case: file,
      schemeFetch: stats(viaScheme.js), schemeNativeShare: stats(viaScheme.native),
      schemeFetchWithPreflight: stats(preflighted.js),
      ipcRawBytes: stats(ipcRaw.js),
      ipcJsonArray: stats(ipcJson.js),
    });
  }
  // <img> through the scheme: load plus decode.
  const img = await timed(100, (i) => new Promise<undefined>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(undefined);
    el.onerror = () => reject(new Error('img failed'));
    el.src = `${scheme}/spike-bench/img.png?img=${i}`;
  }));
  await log({ case: 'img.png 64 KiB <img>', load: stats(img.js) });
  // CSS background-image through the scheme.
  const css = await new Promise<string>((resolve) => {
    const probe = new Image();
    const div = document.createElement('div');
    div.style.cssText = `position:fixed;left:-9999px;width:10px;height:10px;background-image:url("${scheme}/spike-bench/img.png?css=1")`;
    document.body.append(div);
    probe.onload = () => { div.remove(); resolve('loaded'); };
    probe.onerror = () => { div.remove(); resolve('failed'); };
    probe.src = `${scheme}/spike-bench/img.png?css=1`;
  });
  await log({ case: 'css url()', result: css });
  // A state-changing request from the app document reaches the server (the
  // scheme refuses one from any other origin; see the Rust unit test).
  const post = await fetchFn(`${scheme}/api/v1/auth/device`, { method: 'POST', credentials: 'omit' });
  await log({ case: 'POST from the app document', status: post.status });
  // The socket: open, then wait for the server's answer.
  const socketResult = await new Promise<Record<string, unknown>>((resolve) => {
    const t = performance.now();
    const url = `${(pairedOrigin() ?? '').replace(/^https:/, 'wss:')}/ws/collab/bench-${Date.now()}`;
    try {
      const socket = new PairedSocket(url);
      const timer = setTimeout(() => resolve({ outcome: 'timeout' }), 10000);
      socket.onopen = () => { clearTimeout(timer); resolve({ outcome: 'open', ms: performance.now() - t }); socket.close(); };
      socket.onerror = (e) => { (socket as unknown as { err?: unknown }).err = e; };
      socket.onclose = (e) => {
        clearTimeout(timer);
        resolve({ outcome: 'closed', code: e.code, ms: Math.round((performance.now() - t) * 100) / 100, error: (socket as unknown as { err?: { message?: string } }).err?.message });
      };
    } catch (error) {
      resolve({ outcome: 'threw', error: String(error) });
    }
  });
  await log({ case: 'collab socket, no session', ...socketResult });
  // A real room: project, session, one-use ticket (org/native-socket.ts's
  // flow), then open, join and time the join-ack round trip.
  const api = async (path: string, body: unknown): Promise<Record<string, unknown>> => {
    const r = await fetchFn(`${scheme}${path}`, { method: 'POST', credentials: 'omit', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return await r.json() as Record<string, unknown>;
  };
  try {
    const project = await api('/api/v1/projects', { name: 'Pairing spike room' });
    const session = await api(`/api/v1/projects/${String(project.id)}/sessions`, { toolId: 'qr-code', inputs: { url: 'https://lolly.tools' } });
    const sessionId = String((session.session as { id?: string } | undefined)?.id ?? session.id);
    const joins: number[] = [];
    let opened: number[] = [];
    for (let i = 0; i < 5; i++) {
      const ticket = await api(`/api/v1/collab/sessions/${encodeURIComponent(sessionId)}/socket-ticket`, {});
      const result = await new Promise<{ open: number; ack: number } | { error: string }>((resolve) => {
        const t0 = performance.now();
        let t1 = 0;
        const socket = new PairedSocket(`${(pairedOrigin() ?? '').replace(/^https:/, 'wss:')}/ws/collab/${encodeURIComponent(sessionId)}`, ['lolly-collab-v1', `lolly-ticket.${String(ticket.ticket)}`]);
        const timer = setTimeout(() => resolve({ error: 'timeout' }), 10000);
        socket.onopen = () => { t1 = performance.now(); socket.send(JSON.stringify({ t: 'join', opVersion: COLLAB_OP_VERSION, presenceVersion: 1, receipts: 1, interactionVersion: 1 })); };
        socket.onmessage = (ev) => {
          const frame = JSON.parse(String(ev.data)) as { t?: string };
          if (frame.t === 'join-ack') { clearTimeout(timer); resolve({ open: t1 - t0, ack: performance.now() - t1 }); socket.close(1000, 'bench'); }
        };
        socket.onclose = (ev) => { clearTimeout(timer); resolve({ error: `closed ${ev.code} ${ev.reason ?? ''}` }); };
      });
      if ('error' in result) { await log({ case: 'collab socket, signed in', error: result.error, sessionId }); break; }
      opened = [...opened, result.open];
      joins.push(result.ack);
    }
    if (joins.length) await log({ case: 'collab socket, signed in (ticket)', open: stats(opened), joinAckRoundTrip: stats(joins) });
  } catch (error) {
    await log({ case: 'collab socket, signed in', error: String(error) });
  }
  await log({ bench: 'done' });
}
