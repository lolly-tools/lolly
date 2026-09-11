// SPDX-License-Identifier: MPL-2.0
/**
 * WP-C - extract audio from a video (lib/extract-audio.ts).
 *
 * Run directly:  node --test shells/web/src/lib/extract-audio.test.ts
 *
 * jsdom with a real origin so the modal/i18n chain the module pulls in never
 * trips on `about:blank`. The decode + Opus encode are driven through the
 * injectable deps, so the maths runs under node with no Web Audio / WebCodecs.
 *
 * What is pinned here:
 *   - the size + duration caps (refusal messages),
 *   - a synthetic PCM buffer round-trips through the WAV writer,
 *   - the Opus branch routes to the injected encoder,
 *   - the duration cap throws before an encode,
 *   - the saved record: type 'audio', the right format, aiGenerated carried,
 *     and 'renders' ONLY on the download path,
 *   - the CONTRACT that the catalog "Extract audio" action is video-only.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import type { DecodedPcm, ExtractAudioAssetRecordInput } from './extract-audio.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
// jsdom ships no showModal/close on <dialog> - stub them to the minimum mountModal
// needs (an `open` attribute it toggles, then removes the node on close), the same
// way lib/save-dialog.test.ts does.
const Dlg = dom.window.HTMLDialogElement.prototype as unknown as { showModal(): void; close(): void };
Dlg.showModal = function (this: HTMLElement) { this.setAttribute('open', ''); };
Dlg.close = function (this: HTMLElement) { this.removeAttribute('open'); };

const {
  EXTRACT_AUDIO_MAX_BYTES, EXTRACT_AUDIO_MAX_SECONDS,
  extractAudioSizeRefusal, extractAudioDurationRefusal, extractAudioIds,
  extractAudioBlob, extractAudioToAsset, startExtractAudioJob, openExtractAudioDialog,
} = await import('./extract-audio.ts');
const { __resetJobsForTest, jobsSnapshot, cancelJob } = await import('./jobs.ts');

// ── caps ──────────────────────────────────────────────────────────────────────

test('size cap: refuses above EXTRACT_AUDIO_MAX_BYTES, allows at/below', () => {
  assert.equal(extractAudioSizeRefusal(1024), null);
  assert.equal(extractAudioSizeRefusal(EXTRACT_AUDIO_MAX_BYTES), null);
  const msg = extractAudioSizeRefusal(EXTRACT_AUDIO_MAX_BYTES + 1);
  assert.ok(msg && /too large/i.test(msg));
});

test('duration cap: refuses above EXTRACT_AUDIO_MAX_SECONDS, allows at/below', () => {
  assert.equal(extractAudioDurationRefusal(10), null);
  assert.equal(extractAudioDurationRefusal(EXTRACT_AUDIO_MAX_SECONDS), null);
  const msg = extractAudioDurationRefusal(EXTRACT_AUDIO_MAX_SECONDS + 1);
  assert.ok(msg && /too long/i.test(msg));
});

test('extractAudioIds: file-safe id under user/audio and a display name', () => {
  const { id, name } = extractAudioIds('My Clip (Final).mp4', 'wav', 1700000000000);
  assert.match(id, /^user\/audio\/1700000000000-my-clip-final\.wav$/);
  assert.match(name, /My Clip \(Final\)/);
  // Falls back when the name is empty of word characters.
  const { id: id2 } = extractAudioIds('.webm', 'opus', 1);
  assert.match(id2, /^user\/audio\/1-audio\.opus$/); // ".webm" strips to "" -> "audio"
});

// ── round-trip ──────────────────────────────────────────────────────────────

/** Read a 16-bit PCM WAV blob back to planar float channels for comparison. */
async function parseWav(blob: Blob): Promise<{ sampleRate: number; channels: number; left: Float32Array; right: Float32Array }> {
  const dv = new DataView(await blob.arrayBuffer());
  const tag = (o: number, n: number) => String.fromCharCode(...new Uint8Array(dv.buffer, o, n));
  assert.equal(tag(0, 4), 'RIFF');
  assert.equal(tag(8, 4), 'WAVE');
  const channels = dv.getUint16(22, true);
  const sampleRate = dv.getUint32(24, true);
  const bits = dv.getUint16(34, true);
  assert.equal(bits, 16);
  const dataLen = dv.getUint32(40, true);
  const frames = dataLen / (channels * 2);
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  let o = 44;
  for (let i = 0; i < frames; i++) {
    left[i] = dv.getInt16(o, true) / 0x7fff; o += 2;
    right[i] = channels === 2 ? dv.getInt16(o, true) / 0x7fff : left[i]!; o += channels === 2 ? 2 : 0;
  }
  return { sampleRate, channels, left, right };
}

test('extractAudioBlob (wav): a synthetic PCM buffer round-trips through the WAV writer', async () => {
  const left = Float32Array.from([0, 0.5, -0.5, 1, -1]);
  const right = Float32Array.from([0.25, -0.25, 0.75, -0.75, 0]);
  const decode = async (): Promise<DecodedPcm> => ({ channels: [left, right], sampleRate: 44100 });
  const out = await extractAudioBlob(new ArrayBuffer(0), 'wav', { decode });
  assert.equal(out.format, 'wav');
  assert.equal(out.mime, 'audio/wav');
  assert.ok(Math.abs(out.durationSec - 5 / 44100) < 1e-9);

  const parsed = await parseWav(out.blob);
  assert.equal(parsed.sampleRate, 44100);
  assert.equal(parsed.channels, 2);
  // 16-bit quantisation tolerance.
  for (let i = 0; i < left.length; i++) {
    assert.ok(Math.abs(parsed.left[i]! - left[i]!) < 2e-4, `left[${i}]`);
    assert.ok(Math.abs(parsed.right[i]! - right[i]!) < 2e-4, `right[${i}]`);
  }
});

test('extractAudioBlob (wav): a mono source folds to both planes', async () => {
  const mono = Float32Array.from([0.1, -0.2, 0.3]);
  const decode = async (): Promise<DecodedPcm> => ({ channels: [mono], sampleRate: 48000 });
  const out = await extractAudioBlob(new ArrayBuffer(0), 'wav', { decode });
  const parsed = await parseWav(out.blob);
  for (let i = 0; i < mono.length; i++) {
    assert.ok(Math.abs(parsed.left[i]! - mono[i]!) < 2e-4);
    assert.ok(Math.abs(parsed.right[i]! - mono[i]!) < 2e-4);
  }
});

test('extractAudioBlob (opus): routes to the injected encoder with the decoded PCM', async () => {
  const left = Float32Array.from([0.1, 0.2]);
  const decode = async (): Promise<DecodedPcm> => ({ channels: [left], sampleRate: 48000 });
  const seen: Array<{ channels: Float32Array[]; sampleRate: number }> = [];
  const encodeOpusPcm = async (pcm: { channels: Float32Array[]; sampleRate: number }): Promise<Blob> => {
    seen.push(pcm);
    return new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' });
  };
  const out = await extractAudioBlob(new ArrayBuffer(0), 'opus', { decode, encodeOpusPcm });
  assert.equal(out.format, 'opus');
  assert.equal(out.mime, 'audio/webm');
  assert.equal(seen.length, 1);
  assert.equal(seen[0]!.sampleRate, 48000);
  assert.equal(seen[0]!.channels[0], left);
});

test('extractAudioBlob: refuses a track longer than the duration cap, before any encode', async () => {
  // A tiny buffer at a fractional rate makes duration exceed the cap without allocating anything.
  const decode = async (): Promise<DecodedPcm> => ({ channels: [new Float32Array(10)], sampleRate: 10 / (EXTRACT_AUDIO_MAX_SECONDS + 100) });
  let encoderCalled = false;
  await assert.rejects(
    () => extractAudioBlob(new ArrayBuffer(0), 'opus', { decode, encodeOpusPcm: async () => { encoderCalled = true; return new Blob(); } }),
    /too long/i,
  );
  assert.equal(encoderCalled, false);
});

// ── save path ────────────────────────────────────────────────────────────────

function makeHost() {
  const store: ExtractAudioAssetRecordInput[] = [];
  const host = {
    assets: {
      async _uploadUserAsset(rec: ExtractAudioAssetRecordInput) { store.push(rec); },
      async get(id: string) { return { id, type: 'audio', url: `blob:${id}`, source: 'user', meta: {} } as unknown; },
    },
    log() {},
  };
  return { host, store };
}

const decode3 = async (): Promise<DecodedPcm> => ({ channels: [Float32Array.from([0, 0.5, -0.5])], sampleRate: 48000 });

test('extractAudioToAsset (catalog): saves an audio asset WITHOUT the renders tag', async () => {
  const { host, store } = makeHost();
  const src = new Blob([new Uint8Array([0])], { type: 'video/mp4' });
  const ref = await extractAudioToAsset(host as never, {
    source: src, sourceName: 'clip.mp4', format: 'wav', deps: { decode: decode3 },
  });
  assert.ok(ref);
  assert.equal(store.length, 1);
  const rec = store[0]!;
  assert.equal(rec.type, 'audio');
  assert.equal(rec.format, 'wav');
  assert.match(rec.id, /^user\/audio\//);
  const tags = (rec.meta?.tags as string[] | undefined) ?? [];
  assert.equal(tags.includes('renders'), false, 'a catalog-side extraction is NOT a render');
  assert.equal(typeof rec.meta?.durationMs, 'number');
});

test('extractAudioToAsset (download path): tags renders, and carries aiGenerated', async () => {
  const { host, store } = makeHost();
  const src = new Blob([new Uint8Array([0])], { type: 'video/mp4' });
  await extractAudioToAsset(host as never, {
    source: src, sourceName: 'clip.mp4', format: 'wav',
    fromDownloadPath: true, aiGenerated: 'partial', deps: { decode: decode3 },
  });
  const rec = store[0]!;
  assert.deepEqual(rec.meta?.tags, ['renders']);
  assert.equal(rec.aiGenerated, 'partial');
});

// ── stream copy is the primary path (WP-E) ───────────────────────────────────
//
// When the injected copy returns a RemuxResult the pipeline saves that container and
// never touches the decoder; when it returns null the pipeline falls back to decode +
// re-encode; and a cancel from the copy aborts without writing anything.

test('extractAudioToAsset: a successful stream copy saves the copied container, no decode', async () => {
  const { host, store } = makeHost();
  const src = new Blob([new Uint8Array([1, 2, 3])], { type: 'video/mp4' });
  let decodeCalled = false;
  const remux = { blob: new Blob([new Uint8Array([9, 9, 9])], { type: 'audio/mp4' }),
    codec: 'aac', ext: 'm4a', mime: 'audio/mp4', c2paFormat: 'm4a', durationSec: 2.5 };
  const notes: Array<string | undefined> = [];
  const ref = await extractAudioToAsset(host as never, {
    source: src, sourceName: 'clip.mp4', format: 'wav',
    deps: {
      decode: async () => { decodeCalled = true; return { channels: [new Float32Array(1)], sampleRate: 48000 }; },
      streamCopy: async (_input: Blob, cctx: { onProgress?: (d: number, t: number, n?: string) => void; copyNote?: string }) => {
        cctx.onProgress?.(0, 0, cctx.copyNote);
        return remux as never;
      },
    },
  }, { onProgress: (_d, _t, n) => { notes.push(n); } });
  assert.ok(ref);
  assert.equal(decodeCalled, false, 'the lossless copy path skips the decoder entirely');
  const rec = store[0]!;
  assert.equal(rec.type, 'audio');
  assert.equal(rec.format, 'm4a', 'the asset takes the copied container extension');
  assert.match(rec.id, /^user\/audio\/\d+-clip\.m4a$/);
  assert.equal(rec.meta?.durationMs, 2500, 'the duration comes from the copied track');
  assert.ok(notes.includes('Copying the sound track…'), 'the copy stage is reported');
  assert.ok(!notes.includes('Decoding the sound track…'), 'no decode note on the copy path');
  assert.ok(notes.includes('Saving…'));
});

test('extractAudioToAsset: a null stream copy falls back to decode + re-encode', async () => {
  const { host, store } = makeHost();
  const src = new Blob([new Uint8Array([0])], { type: 'video/mp4' });
  let decodeCalled = false;
  await extractAudioToAsset(host as never, {
    source: src, sourceName: 'clip.webm', format: 'wav',
    deps: {
      decode: async () => { decodeCalled = true; return { channels: [Float32Array.from([0, 0.5, -0.5])], sampleRate: 48000 }; },
      streamCopy: async () => null,   // a mismatch: fall back to the decode path
    },
  });
  assert.equal(decodeCalled, true, 'a mismatch decodes and re-encodes');
  const rec = store[0]!;
  assert.equal(rec.format, 'wav', 'the fallback saves the user-chosen format');
  assert.match(rec.id, /\.wav$/);
});

test('extractAudioToAsset: a cancel from the stream copy aborts and writes nothing', async () => {
  const { host, store } = makeHost();
  const src = new Blob([new Uint8Array([0])], { type: 'video/mp4' });
  await assert.rejects(
    () => extractAudioToAsset(host as never, {
      source: src, sourceName: 'clip.mp4', format: 'wav',
      deps: {
        decode: decode3,
        streamCopy: async () => { throw Object.assign(new Error('cancelled'), { name: 'AbortError' }); },
      },
    }),
    (e: Error) => e.name === 'AbortError',
    'a copy-stage cancel surfaces as an AbortError, not a fall-back',
  );
  assert.equal(store.length, 0, 'nothing is written when the copy is cancelled');
});

test('extractAudioToAsset: refuses a source larger than the byte cap', async () => {
  const { host, store } = makeHost();
  // A blob whose arrayBuffer reports a byteLength over the cap, without allocating it -
  // the size gate reads the decoded bytes' byteLength, so a fake buffer proves the refusal.
  const huge = { async arrayBuffer() { return { byteLength: EXTRACT_AUDIO_MAX_BYTES + 1 } as ArrayBuffer; } };
  Object.setPrototypeOf(huge, Blob.prototype);
  await assert.rejects(
    () => extractAudioToAsset(host as never, { source: huge as unknown as Blob, sourceName: 'big.mp4', format: 'wav', deps: { decode: decode3 } }),
    /too large/i,
  );
  assert.equal(store.length, 0);
});

test('extractAudioToAsset: refuses from the source SIZE before reading it into memory', async () => {
  const { host, store } = makeHost();
  // A Blob whose own `size` is over the cap and whose arrayBuffer() must never run:
  // the pre-read size gate refuses before the whole file is allocated.
  let read = false;
  const huge = {
    size: EXTRACT_AUDIO_MAX_BYTES + 1,
    async arrayBuffer() { read = true; return new ArrayBuffer(0); },
  };
  Object.setPrototypeOf(huge, Blob.prototype);
  await assert.rejects(
    () => extractAudioToAsset(host as never, { source: huge as unknown as Blob, sourceName: 'big.mp4', format: 'wav', deps: { decode: decode3 } }),
    /too large/i,
  );
  assert.equal(read, false, 'refused before reading the source into memory');
  assert.equal(store.length, 0);
});

// ── cancellation: what it REALLY does (WP-F) ─────────────────────────────────
//
// There is no abortable decoder here. `decodeAudioData` and the WebCodecs
// AudioEncoder both run to completion once started, so the honest contract is:
// the source FETCH is aborted outright, and past that the pipeline is
// COOPERATIVE - it checks between stages and stops before anything is written.
// These pin that contract so nobody later "fixes" it into a promise it can't keep.

test('cancel aborts the source FETCH - the one stage that can really be interrupted', async () => {
  const { host } = makeHost();
  const seen: Array<AbortSignal | undefined> = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    seen.push(init?.signal ?? undefined);
    return {
      ok: true,
      headers: { get: () => null },
      async arrayBuffer() { return new ArrayBuffer(4); },
    } as unknown as Response;
  }) as typeof fetch;
  try {
    const ctl = new AbortController();
    await extractAudioToAsset(host as never, {
      source: 'https://lolly.tools/clip.mp4', sourceName: 'clip.mp4', format: 'wav', deps: { decode: decode3 },
    }, { signal: ctl.signal });
    assert.ok(seen.length >= 2, 'the size HEAD and the body GET both went out');
    for (const s of seen) assert.ok(s, 'every fetch this pipeline makes carries the signal');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a cancel during the decode does NOT stop the decode - but nothing is saved', async () => {
  const { host, store } = makeHost();
  let cancelled = false;
  let decodeFinished = false;
  // The real shape: decodeAudioData cannot be interrupted, so the decode runs to
  // completion and the cancel is only observed on the far side of it.
  const decode = async (): Promise<DecodedPcm> => {
    cancelled = true;                       // the user hits ✕ while the decode is in flight
    await Promise.resolve();
    decodeFinished = true;
    return { channels: [Float32Array.from([0, 0.5, -0.5])], sampleRate: 48000 };
  };
  const src = new Blob([new Uint8Array([0])], { type: 'video/mp4' });
  await assert.rejects(
    () => extractAudioToAsset(host as never, { source: src, sourceName: 'clip.mp4', format: 'wav', deps: { decode } },
      { isCancelled: () => cancelled }),
    (e: Error) => e.name === 'AbortError',
    'a cancel surfaces as an AbortError, not as a failure',
  );
  assert.equal(decodeFinished, true, 'honest: the decode already in flight still finished');
  assert.equal(store.length, 0, 'but NOTHING was written - no stamp, no asset, no catalog entry');
});

test('a cancel that lands after the encode still writes nothing', async () => {
  const { host, store } = makeHost();
  let cancelled = false;
  const src = new Blob([new Uint8Array([0])], { type: 'video/mp4' });
  await assert.rejects(
    () => extractAudioToAsset(host as never, {
      source: src, sourceName: 'clip.mp4', format: 'opus',
      deps: { decode: decode3, encodeOpusPcm: async () => { cancelled = true; return new Blob([new Uint8Array(3)]); } },
    }, { isCancelled: () => cancelled }),
    (e: Error) => e.name === 'AbortError',
  );
  assert.equal(store.length, 0, 'the last check sits immediately before the save, so a late cancel still lands');
});

test('every stage reports the INDETERMINATE form - no invented percentages', async () => {
  const { host } = makeHost();
  const notes: Array<[number, number, string | undefined]> = [];
  const src = new Blob([new Uint8Array([0])], { type: 'video/mp4' });
  await extractAudioToAsset(host as never, { source: src, sourceName: 'clip.mp4', format: 'wav', deps: { decode: decode3 } },
    { onProgress: (d, t, n) => { notes.push([d, t, n]); } });
  // decodeAudioData resolves once with nothing in between, and the WebCodecs encoder
  // exposes no completion count - so a bar would be a lie and the toast pulses instead.
  for (const [done, total] of notes) {
    assert.equal(done, 0);
    assert.equal(total, 0, 'total <= 0 is lib/jobs.ts\'s indeterminate contract');
  }
  assert.deepEqual(notes.map((n) => n[2]),
    ['Reading the video…', 'Decoding the sound track…', 'Encoding the audio…', 'Saving…'],
    'the user is told which stage is running, in order');
});

// ── the job wrapper ──────────────────────────────────────────────────────────

test('startExtractAudioJob registers a cancellable heavy job and hands back the saved ref', async () => {
  __resetJobsForTest();
  const { host, store } = makeHost();
  const src = new Blob([new Uint8Array([0])], { type: 'video/mp4' });
  let landed = false;
  const job = startExtractAudioJob(host as never, {
    source: src, sourceName: 'clip.mp4', format: 'wav', deps: { decode: decode3 },
  }, { onComplete: () => { landed = true; } });

  const listed = jobsSnapshot().find((j) => j.id === job.id)!;
  assert.equal(listed.title, 'Extracting audio', 'the toast names the operation');
  assert.equal(listed.heavy, true, 'a whole-file decode claims the single heavy slot');
  assert.equal(listed.cancellable, true, 'so the toast shows its ✕');

  for (let i = 0; i < 50 && jobsSnapshot().find((j) => j.id === job.id)!.status !== 'done'; i++) {
    await new Promise<void>((r) => setTimeout(r, 0));
  }
  assert.equal(jobsSnapshot().find((j) => j.id === job.id)!.status, 'done');
  assert.equal(store.length, 1, 'the asset landed');
  assert.equal(landed, true, 'onComplete fired with the saved audio');
  __resetJobsForTest();
});

test('cancelling the job saves nothing and is not reported as a failure', async () => {
  __resetJobsForTest();
  const { host, store } = makeHost();
  const src = new Blob([new Uint8Array([0])], { type: 'video/mp4' });
  let failed = false;
  let completed = false;
  // A decode that never settles until the job is cancelled out from under it.
  const decode = (): Promise<DecodedPcm> => new Promise(() => {});
  const job = startExtractAudioJob(host as never, {
    source: src, sourceName: 'clip.mp4', format: 'wav', deps: { decode },
  }, { onComplete: () => { completed = true; }, onError: () => { failed = true; } });

  await job.started;
  cancelJob(job.id);
  for (let i = 0; i < 20; i++) await new Promise<void>((r) => setTimeout(r, 0));

  assert.equal(jobsSnapshot().find((j) => j.id === job.id)!.status, 'cancelled');
  assert.equal(store.length, 0);
  assert.equal(completed, false);
  assert.equal(failed, false, 'a cancel is not a failure - no error toast, no onError');
  __resetJobsForTest();
});

// ── the dialog hands off (it no longer sits and waits) ───────────────────────

test('Go ENQUEUES a job and CLOSES the dialog - it never waits on the extraction', async () => {
  __resetJobsForTest();
  const { host } = makeHost();
  const src = new Blob([new Uint8Array([0])], { type: 'video/mp4' });
  let resolved = false;
  const closed = openExtractAudioDialog(host as never, { source: src, sourceName: 'clip.mp4' })
    .then(() => { resolved = true; });

  const dlg = document.querySelector<HTMLDialogElement>('dialog.extract-audio-modal')!;
  assert.ok(dlg, 'the dialog mounted');
  dlg.querySelector<HTMLButtonElement>('[data-act="go"]')!.click();

  // The job is registered SYNCHRONOUSLY on the click - nothing here awaits a decode.
  const listed = jobsSnapshot().find((j) => j.title === 'Extracting audio');
  assert.ok(listed, 'the click enqueued the background job');
  assert.equal(resolved, false, 'and the dialog is mid hand-off, not resolved on a saved asset');
  assert.ok(dlg.querySelector('[data-status]')!.textContent!.includes('background'),
    'the hand-off message says where the work went');

  await new Promise<void>((r) => setTimeout(r, 1100));   // the 900ms hand-off window
  await closed;
  assert.equal(resolved, true, 'the dialog resolved on CLOSING, never on a result');
  assert.equal(document.querySelector('dialog.extract-audio-modal'), null, 'and it is gone from the DOM');
  __resetJobsForTest();
});

// ── contract: the catalog action is video-only ────────────────────────────────

test('catalog "Extract audio" is gated on ref.type === video', () => {
  const catDir = fileURLToPath(new URL('../views/catalog/', import.meta.url));
  const catalog = [readFileSync(fileURLToPath(new URL('../views/catalog.ts', import.meta.url)), 'utf8'), ...readdirSync(catDir).filter((n) => n.endsWith('.ts')).sort().map((n) => readFileSync(join(catDir, n), 'utf8'))].join('\n');
  // The gate variable exists and requires the video type.
  const gate = catalog.match(/const canExtractAudio = ([^;]*);/s);
  assert.ok(gate, 'canExtractAudio gate is present');
  assert.match(gate![1]!, /ref\.type === 'video'/, 'gate requires a video asset');
  // The button + dispatch only ever appear behind that gate.
  assert.match(catalog, /canExtractAudio \? `<button[^`]*data-act="extract-audio"/);
  assert.match(catalog, /act === 'extract-audio'/);
});
