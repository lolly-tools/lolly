// SPDX-License-Identifier: MPL-2.0
/**
 * rondo-render.test.ts - the main-thread client for the rondocode render worker.
 *
 * What this proves, with a stand-in `Worker` (Node has none), is the part of the
 * client a browser pass cannot easily force: a render that runs past its budget
 * is stopped by TERMINATING the worker, the job is rejected by name, and the next
 * render spawns a fresh worker. Also that renders are queued one at a time, cached
 * by (song, seconds), shared while in flight, and that the words a person reads
 * follow the renderer's codes.
 *
 * The stand-in runs packages/rondo's REAL `renderRondo` for the happy path, so the
 * cache is exercised with real PCM. The real worker module, QuickJS's WebAssembly
 * inside a Vite worker chunk, is covered by the browser pass, not here.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderRondo } from '@lolly-tools/rondo';

import {
  renderRondoSong, renderBudgetMs, rondoTargetSec, songFromBytes, _resetRondoRender, RondoRenderError,
  type RondoSong,
} from './rondo-render.ts';
import { rondoCreditLine, rondoFailureSentence, rondoFindingSentence } from './rondo-words.ts';
import { rondoSourceBytes } from '../../../../engine/src/rondo-source.ts';

const stageSource = readFileSync(
  fileURLToPath(new URL('../../../../packages/rondo/generated/stage.js', import.meta.url)), 'utf8');

const TINY: RondoSong = {
  lang: 'js',
  code: `const beep = synth(({ note, gate, adsr, sine }) => sine(note.freq).mul(adsr(gate, { a: 0.01, d: 0.1, s: 0.5, r: 0.1 })))
p('beep', note('c4 e4 g4 c5').sound('beep'))
setCps(1)`,
};

// ── a stand-in Worker ───────────────────────────────────────────────────────

type Mode = 'render' | 'hang' | 'manual';
let mode: Mode = 'render';
/** In 'manual' mode a posted render waits here until the test sends its answer. */
let held: (() => void)[] = [];
const realSetTimeout = setTimeout;

class FakeWorker {
  static all: FakeWorker[] = [];
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  posted: Record<string, unknown>[] = [];
  terminated = false;
  readonly url: URL;
  readonly opts: { type?: string };
  constructor(url: URL, opts: { type?: string }) { this.url = url; this.opts = opts; FakeWorker.all.push(this); }
  postMessage(msg: Record<string, unknown>): void {
    this.posted.push(msg);
    if (mode === 'hang') return;                     // a synchronous render that never ends
    const answer = async (): Promise<void> => {
      if (this.terminated) return;
      const { id, code, lang, seconds, probe } = msg as { id: number; code: string; lang: 'js'; seconds?: number; probe?: boolean };
      if (probe) { this.onmessage?.({ data: { id, ok: true } }); return; }
      try {
        const pcm = await renderRondo({ source: code, lang, ...(seconds !== undefined ? { seconds } : {}) }, { stageSource });
        if (!this.terminated) this.onmessage?.({ data: { id, pcm } });
      } catch (err) {
        const e = err as { name?: string; code?: string; message?: string };
        if (!this.terminated) this.onmessage?.({ data: { id, error: { name: e.name ?? 'Error', code: e.code ?? 'rondo.error', message: e.message ?? '' } } });
      }
    };
    if (mode === 'manual') held.push(() => { void answer(); });
    else setImmediate(() => { void answer(); });
  }
  terminate(): void { this.terminated = true; }
}

(globalThis as { Worker?: unknown }).Worker = FakeWorker;

beforeEach(() => {
  _resetRondoRender();
  FakeWorker.all = [];
  mode = 'render';
  held = [];
});

/** Let pending event-loop callbacks run; this does not await a thread-pool digest. */
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await new Promise<void>((r) => setImmediate(r));
}

/** Wait, in real time, until `cond` holds. The client's SHA-256 digest finishes on
 *  the thread pool, so a fixed number of event-loop turns is not enough on a busy
 *  machine to be sure a job has been posted. */
async function until(cond: () => boolean, what: string, ms = 10_000): Promise<void> {
  const end = Date.now() + ms;
  while (!cond() && Date.now() < end) await new Promise<void>((r) => realSetTimeout(r, 5));
  assert.ok(cond(), `timed out waiting for ${what}`);
}

// ── the worker and its stop ─────────────────────────────────────────────────

test('the worker is a module worker on rondo-worker.ts, spawned on first use', async () => {
  assert.equal(FakeWorker.all.length, 0, 'nothing is spawned at import');
  const r = await renderRondoSong(TINY, { seconds: 1 });
  assert.equal(FakeWorker.all.length, 1);
  assert.match(FakeWorker.all[0]!.url.href, /rondo-worker\.ts$/);
  assert.equal(FakeWorker.all[0]!.opts.type, 'module');
  assert.equal(r.left.length, 48_000);
  assert.equal(r.run.executionClass, 'vm');
});

test('a render past its wall-clock budget is stopped by terminating the worker, and the next spawns a fresh one', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  mode = 'hang';
  const stuck = renderRondoSong(TINY, { seconds: 2 });
  const caught = stuck.catch((e: unknown) => e);
  let clocksMocked = true;
  try {
    await until(() => FakeWorker.all.length === 1 && FakeWorker.all[0]!.posted.length === 1,
      'the budgeted render to be posted');
    assert.equal(FakeWorker.all.length, 1);
    assert.equal(FakeWorker.all[0]!.posted.length, 1, 'the render was posted');
    t.mock.timers.tick(renderBudgetMs(2) - 1);
    await settle();
    assert.equal(FakeWorker.all[0]!.terminated, false, 'not stopped before its budget');
    t.mock.timers.tick(2);
    const err = await caught as RondoRenderError;
    assert.ok(err instanceof RondoRenderError);
    assert.equal(err.code, 'rondo.timeout');
    assert.equal(FakeWorker.all[0]!.terminated, true, 'the only stop that always works');
    t.mock.timers.reset(); clocksMocked = false;

    mode = 'render';
    const next = await renderRondoSong(TINY, { seconds: 1 });
    assert.equal(FakeWorker.all.length, 2, 'a fresh worker for the next render');
    assert.equal(next.left.length, 48_000);
  } finally {
    // Drain this owned request even if setup fails before its digest reaches the queue.
    mode = 'render';
    if (clocksMocked) { t.mock.timers.tick(renderBudgetMs(2) + 1); t.mock.timers.reset(); }
    await caught;
    _resetRondoRender();
  }
});

test('worker readiness waits for a digest held beyond twenty event-loop turns', async t => {
  const originalDigest = crypto.subtle.digest.bind(crypto.subtle);
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  t.mock.method(crypto.subtle, 'digest', async (algorithm: AlgorithmIdentifier, data: BufferSource) => {
    await gate;
    return originalDigest(algorithm, data);
  });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  mode = 'hang';
  const caught = renderRondoSong(TINY, { seconds: 2 }).catch((error: unknown) => error);
  try {
    await settle();
    assert.equal(FakeWorker.all.length, 0, 'event-loop turns do not finish the held digest');
    release();
    await until(() => FakeWorker.all.length === 1 && FakeWorker.all[0]!.posted.length === 1,
      'the render after the held digest');
    t.mock.timers.tick(renderBudgetMs(2) - 1);
    assert.equal(FakeWorker.all[0]!.terminated, false);
    t.mock.timers.tick(2);
    const error = await caught;
    assert.ok(error instanceof RondoRenderError);
    assert.equal(error.code, 'rondo.timeout');
    assert.equal(FakeWorker.all[0]!.terminated, true);
  } finally {
    release(); mode = 'render';
    t.mock.timers.tick(renderBudgetMs(2) + 1); t.mock.timers.reset();
    await caught;
    _resetRondoRender();
  }
});

test('renders run one at a time, in order', async () => {
  mode = 'manual';
  // Each call digests its song before it joins the queue, so two calls made at once
  // can join in either order. The second call is made once the first is posted.
  const a = renderRondoSong(TINY, { seconds: 1 });
  await until(() => held.length === 1, 'the first render to be posted');
  const b = renderRondoSong(TINY, { seconds: 1.5 });
  await settle();
  assert.equal(FakeWorker.all[0]!.posted.length, 1, 'the second waits for the first');
  held.shift()!();
  await a;
  await until(() => held.length === 1, 'the second render to be posted');
  held.shift()!();
  await b;
  assert.equal(FakeWorker.all[0]!.posted.length, 2);
  assert.deepEqual(FakeWorker.all[0]!.posted.map((m) => m.seconds), [1, 1.5]);
});

test('a render is cached by song and length, and shared while in flight', async () => {
  const [x, y] = await Promise.all([renderRondoSong(TINY, { seconds: 1 }), renderRondoSong(TINY, { seconds: 1 })]);
  assert.equal(x, y, 'two callers in flight share one render');
  const z = await renderRondoSong({ ...TINY, name: 'renamed' }, { seconds: 1 });
  assert.equal(z, x, 'the name does not decide the bytes');
  await renderRondoSong(TINY, { seconds: 2 });
  await renderRondoSong({ ...TINY, lang: 'auto' }, { seconds: 1 });
  assert.equal(FakeWorker.all[0]!.posted.length, 3, 'a new length or language is a new render');
});

test('a failed render is not cached, and says why', async () => {
  const broken: RondoSong = { lang: 'js', code: 'p( this is not javascript' };
  await assert.rejects(renderRondoSong(broken, { seconds: 1 }), (e: RondoRenderError) => e.code === 'rondo.compile' || e.code === 'rondo.evaluate');
  await assert.rejects(renderRondoSong(broken, { seconds: 1 }));
  assert.equal(FakeWorker.all[0]!.posted.length, 2, 'tried again, not answered from a cache');
});

// ── reading songs and the grid ──────────────────────────────────────────────

test('stored bytes, a .rondo file and junk read as a song or as nothing', () => {
  const canonical = rondoSourceBytes({ schemaVersion: 1, format: 'rondocode', name: 'Beep', lang: 'js', code: TINY.code });
  assert.deepEqual(songFromBytes(canonical), { code: TINY.code, lang: 'js', name: 'Beep' });
  const rondo = songFromBytes(new TextEncoder().encode('play x\n  c4\n'), 'riff.rondo');
  assert.equal(rondo?.lang, 'rondo');
  assert.equal(rondo?.name, 'riff');
  assert.equal(songFromBytes(new TextEncoder().encode('{"name":1}')), null);
  assert.equal(songFromBytes(new Uint8Array([0xff, 0xfe, 0x00])), null);
});

test('the budget grows with the length asked, and an open length gets the ceiling', () => {
  assert.ok(renderBudgetMs(10) < renderBudgetMs(60));
  assert.equal(renderBudgetMs(undefined), renderBudgetMs(600));
  assert.equal(rondoTargetSec(Number.NaN), 1);
});

// ── the words ───────────────────────────────────────────────────────────────

test('findings and failures read as plain sentences from their codes', () => {
  const mic = rondoFindingSentence({ code: 'rondo.part.mic', message: 'x', parts: ['talkbox', 'breath'] });
  assert.match(mic, /live microphone/);
  assert.match(mic, /talkbox, breath/);
  const many = rondoFindingSentence({ code: 'rondo.part.sample', message: 'x', parts: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] });
  assert.match(many, /a, b, c, d, e, f and 2 more/);
  assert.equal(rondoFindingSentence({ code: 'rondo.warning', message: 'Line 4: unused', parts: [] }), 'Line 4: unused');
  assert.match(rondoFailureSentence({ code: 'rondo.timeout' }), /too long/);
  assert.match(rondoFailureSentence({ code: 'rondo.compile', diagnostics: [{ message: 'Unexpected token', line: 3 }] }), /Line 3: Unexpected token/);
  assert.match(rondoFailureSentence(new Error('anything')), /could not be rendered/);
  assert.match(rondoCreditLine(), /rondocode/);
  assert.match(rondoCreditLine(), /sandbox/);
});
