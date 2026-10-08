// SPDX-License-Identifier: MPL-2.0
/**
 * Rondocode songs through node-shell's host.audio (plan 301 phase C).
 *
 * A song is code from someone else. On Node it renders in a `worker_threads`
 * Worker (src/rondo.ts, src/rondo-worker.ts) whose song code runs in QuickJS, the
 * `vm` execution class. Pinned here:
 *
 *   1. Every way a song arrives decodes to audio: its `.rondo.json` bytes, a
 *      rondocode share link, a `.rondo` file and a `rondo` asset ref, with the
 *      parts it cannot play named and the execution class recorded.
 *   2. The Worker renders upstream's bytes: a natural-length decode matches the
 *      golden hash packages/rondo recorded from upstream's own render.
 *   3. Containment from the parent's side: `while (true) {}` ends with
 *      `rondo.vm.timeout` while this thread keeps running; a render that overruns
 *      the wall clock is terminated, and its thread is gone; a song past the cap,
 *      a spent budget and a full queue are refused by name.
 *
 * Run with: node --test packages/node-shell/test/rondo-audio.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'fflate';
import { rondoSourceBytes, type RondoSourceV1 } from '@lolly/engine';

import { createNodeAudioAPI, decodeAudioSource, prerenderSongInputs } from '../src/audio.ts';
import {
  LOCAL_RONDO_CAPS, RondoAudioError, clearRondoCache, liveRondoWorkers, renderRondoSong,
  type ComputedAudioRun, type RondoCaps,
} from '../src/rondo.ts';

const REPO = fileURLToPath(new URL('../../..', import.meta.url));
const fixtures = new URL('../../rondo/test/fixtures/', import.meta.url);
const { examples } = JSON.parse(readFileSync(new URL('examples.json', fixtures), 'utf8')) as {
  examples: { name: string; js: string; rondo?: string }[];
};
const golden = JSON.parse(readFileSync(new URL('golden.json', fixtures), 'utf8')) as {
  pcm: Record<string, { js?: string; rondo?: string }>;
};
const example = (name: string): { name: string; js: string; rondo?: string } => {
  const e = examples.find(x => x.name === name);
  assert.ok(e, `fixture has the "${name}" example`);
  return e;
};

const b64url = (b: Uint8Array): string => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
/** A rondocode share link in the raw-deflate (`d`) scheme, as upstream writes one without its dictionary. */
const shareLink = (name: string, code: string): string =>
  `https://rondocode.com/#s=d${b64url(deflateSync(new TextEncoder().encode(JSON.stringify({ n: name, c: code }))))}`;
const song = (name: string, code: string, lang: RondoSourceV1['lang'] = 'js'): RondoSourceV1 =>
  ({ schemaVersion: 1, format: 'rondocode', name, lang, code });

const peakOf = (ch: Float32Array): number => {
  let p = 0;
  for (const x of ch) p = Math.max(p, Math.abs(x));
  return p;
};

const codeOf = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
  } catch (e) {
    assert.ok(e instanceof RondoAudioError, `a RondoAudioError, not ${(e as Error)?.name}: ${(e as Error)?.message}`);
    return e.code;
  }
  assert.fail('the render was expected to fail');
};

const liveMic = example('live mic');
const acid = example('acid');

test('a song decodes from its .rondo.json bytes: audio, the silent parts by name, the vm class', async () => {
  const runs: ComputedAudioRun[] = [];
  const audio = createNodeAudioAPI({ repoRoot: REPO, onRun: r => runs.push(r) });
  const out = await audio.decode!(rondoSourceBytes(song('Acid', acid.js)), { seconds: 1 });
  assert.equal(out.sampleRate, 48_000);
  assert.equal(out.channels.length, 2);
  assert.equal(out.channels[0]!.length, 48_000);
  assert.equal(out.seconds, 1);
  assert.ok(peakOf(out.channels[0]!) > 0.01, 'the song is audible');
  assert.deepEqual(out.findings, []);
  assert.equal(out.run?.executionClass, 'vm');
  assert.equal(out.run?.source, 'rondocode');
  assert.match(out.run?.version ?? '', /^[0-9a-f]{12}\+lolly\.\d+$/);
  assert.equal(typeof out.run?.seed, 'number');

  // Every part of 'live mic' plays the microphone, so the render is silent, and
  // the answer says so by name rather than passing the silence off as the song.
  const mic = await audio.decode!(rondoSourceBytes(song('Live mic', liveMic.js)), { seconds: 1 });
  assert.equal(peakOf(mic.channels[0]!), 0);
  assert.deepEqual(mic.findings.find(f => f.code === 'rondo.part.mic')?.parts, ['breath', 'talkbox']);
  assert.equal(mic.run?.executionClass, 'vm');

  assert.deepEqual(runs.map(r => r.name), ['Acid', 'Live mic']);
  assert.ok(runs.every(r => r.run.executionClass === 'vm'));
  assert.deepEqual(runs[1]!.findings.map(f => f.code), ['rondo.part.mic']);
});

test('a song decodes from a rondocode share link, with nothing fetched', async () => {
  const runs: ComputedAudioRun[] = [];
  const audio = createNodeAudioAPI({ repoRoot: REPO, onRun: r => runs.push(r) });
  const out = await audio.decode!(shareLink('Acid', acid.js), { seconds: 1 });
  assert.ok(peakOf(out.channels[1]!) > 0.01, 'the song is audible');
  assert.equal(out.run?.executionClass, 'vm');
  const mic = await audio.decode!(shareLink('Live mic', liveMic.js), { seconds: 1 });
  assert.ok(mic.findings.some(f => f.code === 'rondo.part.mic' && f.parts.includes('talkbox')));
  assert.deepEqual(runs.map(r => r.name), ['Acid', 'Live mic']);
});

test('a .rondo file and a rondo asset ref decode too, and analyse reads the same song', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-rondo-'));
  try {
    const path = join(dir, 'acid.rondo');
    await writeFile(path, acid.rondo!);
    const fromFile = await decodeAudioSource(path, { repoRoot: REPO }, { seconds: 0.5 });
    assert.equal(fromFile.channels[0]!.length, 24_000);
    assert.equal(fromFile.run?.executionClass, 'vm');

    const ref = {
      source: 'user' as const, id: 'acid.rondo', type: 'audio' as const, format: 'rondo',
      url: `data:application/json;base64,${Buffer.from(rondoSourceBytes(song('acid', acid.rondo!, 'rondo'))).toString('base64')}`,
    };
    const fromRef = await decodeAudioSource(ref, { repoRoot: REPO }, { seconds: 0.5 });
    assert.deepEqual(fromRef.channels[0], fromFile.channels[0], 'the same song gives the same samples');

    const runs: ComputedAudioRun[] = [];
    const audio = createNodeAudioAPI({ repoRoot: REPO, onRun: r => runs.push(r) });
    const a = await audio.analyse(ref, { fps: 10 });
    assert.ok(a.duration > 1);
    assert.ok(a.peaks.some(p => p > 0));
    await audio.analyse(ref, { fps: 20 });
    assert.equal(runs.length, 2);
    assert.equal(runs[0]!.key, runs[1]!.key, 'one render, reported with one key');
    assert.equal(runs[1]!.cached, true, 'the second analysis reuses the render');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('the Worker renders upstream\'s bytes: a natural-length decode matches the golden render', async () => {
  // 'wobble' has no arrangement, so its natural length is upstream's 8-cycle bounce,
  // exactly what packages/rondo's golden.json recorded from upstream's own render.
  const want = golden.pcm.wobble?.js;
  assert.ok(want, 'golden hash for wobble');
  clearRondoCache();
  const out = await decodeAudioSource(rondoSourceBytes(song('wobble', example('wobble').js)), { repoRoot: REPO });
  const [l, r] = out.channels as [Float32Array, Float32Array];
  const hash = createHash('sha256')
    .update(new Uint8Array(l.buffer, l.byteOffset, l.byteLength))
    .update(new Uint8Array(r.buffer, r.byteOffset, r.byteLength))
    .digest('hex');
  assert.equal(hash, want);
});

test('while (true) {} ends with rondo.vm.timeout, and this thread keeps running throughout', async () => {
  const caps: RondoCaps = { ...LOCAL_RONDO_CAPS, vmLimits: { prepareBudgetMs: 400 } };
  let ticks = 0;
  const timer = setInterval(() => { ticks += 1; }, 10);
  const started = Date.now();
  try {
    const code = await codeOf(renderRondoSong(song('hostile', 'while (true) {}'), { seconds: 1, caps }));
    assert.equal(code, 'rondo.vm.timeout');
  } finally {
    clearInterval(timer);
  }
  const elapsed = Date.now() - started;
  // The parent's event loop was never blocked: about one tick per 10 ms elapsed.
  assert.ok(ticks >= Math.floor(elapsed / 10 / 3), `${ticks} ticks in ${elapsed} ms`);
  // And it can still render.
  const ok = await renderRondoSong(song('after', acid.js), { seconds: 0.25 });
  assert.equal(ok.channels[0].length, 12_000);
});

test('a render that overruns the wall clock is terminated, and its thread is gone', async () => {
  // 'real room' stages in about a second and then spends tens of seconds in the
  // synchronous DSP render, the part only terminating the thread can stop.
  clearRondoCache();
  const caps: RondoCaps = { ...LOCAL_RONDO_CAPS, timeoutMs: 2_500 };
  const started = Date.now();
  const err = await renderRondoSong(song('real room', example('real room').js), { seconds: 30, caps }).then(
    () => null,
    (e: unknown) => e,
  );
  const elapsed = Date.now() - started;
  assert.ok(err instanceof RondoAudioError);
  assert.equal(err.code, 'rondo.vm.timeout');
  assert.match(err.message, /2\.5 s time limit/);
  assert.ok(elapsed < 6_000, `refused after ${elapsed} ms`);
  const deadline = Date.now() + 3_000;
  while (liveRondoWorkers() > 0 && Date.now() < deadline) await new Promise(r => setTimeout(r, 20));
  assert.equal(liveRondoWorkers(), 0, 'the render thread exited');
});

test('limits are refused by name before anything runs: length, budget, queue', async () => {
  const small: RondoCaps = { ...LOCAL_RONDO_CAPS, maxSeconds: 5 };
  assert.equal(await codeOf(renderRondoSong(song('long', liveMic.js), { seconds: 6, caps: small })), 'rondo.limits.seconds');
  assert.equal(await codeOf(renderRondoSong(song('bad', liveMic.js), { seconds: -1 })), 'rondo.limits.seconds');

  const budgeted: RondoCaps = { ...LOCAL_RONDO_CAPS, budgetMs: 1_000 };
  assert.equal(
    await codeOf(renderRondoSong(song('spent', liveMic.js), { seconds: 1, caps: budgeted, budget: { spentMs: 1_000 } })),
    'rondo.limits.budget',
  );

  clearRondoCache();
  const single: RondoCaps = { ...LOCAL_RONDO_CAPS, maxConcurrent: 1, maxQueued: 0 };
  const first = renderRondoSong(song('first', acid.js), { seconds: 0.5, caps: single });
  const second = renderRondoSong(song('second', example('wobble').js), { seconds: 0.5, caps: single });
  assert.equal(await codeOf(second), 'rondo.busy');
  assert.equal((await first).channels[0].length, 24_000);
});

test('an unreadable song is refused by name; a codec Node lacks still is', async () => {
  const audio = createNodeAudioAPI({ repoRoot: REPO });
  await assert.rejects(
    audio.decode!('https://rondocode.com/#s=zAAAA'),
    (e: unknown) => e instanceof RondoAudioError && e.code === 'rondo.source.invalid',
  );
  await assert.rejects(audio.decode!('/nowhere/clip.mp3'), /mp3 needs a platform codec/);
  const thrown = await codeOf(audio.decode!(rondoSourceBytes(song('broken', 'p(')), { seconds: 1 }));
  assert.match(thrown, /^rondo\.(compile|evaluate)$/);
});

test('a song in a tool input renders before the tool mounts, so the hook reads the finished render', async () => {
  clearRondoCache();
  const runs: ComputedAudioRun[] = [];
  const audio = createNodeAudioAPI({ repoRoot: REPO, onRun: r => runs.push(r) });
  const link = shareLink('Acid', acid.js);
  const fileBytes = new TextEncoder().encode(acid.rondo!);
  await prerenderSongInputs(
    [{ id: 'audio', type: 'asset', assetType: 'audio' }, { id: 'source', type: 'file' }, { id: 'title', type: 'text' }],
    { audio: { source: 'library', id: link, _unresolved: true }, source: { name: 'acid.rondo', bytes: fileBytes }, title: 'x' },
    { audio },
  );
  assert.equal(runs.length, 2, 'the link and the file each rendered once');
  assert.ok(runs.every(r => !r.cached));
  await audio.analyse(link);
  assert.equal(runs.at(-1)?.cached, true, 'the hook\'s call finds the render');
});

test('a song that failed is not rendered again for the next caller', async () => {
  clearRondoCache();
  const caps: RondoCaps = { ...LOCAL_RONDO_CAPS, vmLimits: { prepareBudgetMs: 300 } };
  const hostile = song('hostile', 'while (true) {}');
  assert.equal(await codeOf(renderRondoSong(hostile, { seconds: 1, caps })), 'rondo.vm.timeout');
  const started = Date.now();
  assert.equal(await codeOf(renderRondoSong(hostile, { seconds: 1, caps })), 'rondo.vm.timeout');
  assert.ok(Date.now() - started < 100, 'answered from the kept failure, no second render');
});
