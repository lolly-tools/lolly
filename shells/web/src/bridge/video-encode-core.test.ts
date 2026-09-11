// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the STREAMING encode+mux session (createStreamingMux) and the
 * BUFFERED path (encodeMuxWebCodecs).
 *
 * WebCodecs doesn't exist in node, so the session is driven through its injection
 * seam: stub VideoEncoder / AudioEncoder / VideoFrame / AudioData classes plus a
 * stub muxer factory. That covers everything except the actual codec - frame
 * timing, keyframe cadence, backpressure, VideoFrame lifetime, flush ordering,
 * abort teardown and post-finalize rejection are all exercised here rather than
 * only in a browser.
 *
 * Run directly:  node --test shells/web/src/bridge/video-encode-core.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStreamingMux, encodeMuxWebCodecs, HIGH_WATER, type EncodeAudio, type EncodePick, type EncodeOpts } from './video-encode-core.ts';
import { HDR_VF_COLORSPACE } from './video-shared.ts';
import type { SeekableSink, SeekableSinkFactory } from './mediabunny-mux.ts';
import { videoFrameSchedule } from './video-mime.ts';

// ── Stubs ─────────────────────────────────────────────────────────────────────

interface FrameLog { src: unknown; timestamp: number; duration: number; closes: number; init: any }

/** Every VideoFrame the session constructs, in order - so a leak or a double
 *  close is directly assertable. `init` is the whole VideoFrameInit so the HDR tests
 *  can assert the buffer ctor's format/codedWidth/codedHeight/colorSpace. */
let frameLog: FrameLog[] = [];

class StubVideoFrame {
  rec: FrameLog;
  constructor(src: unknown, init: { timestamp: number; duration: number }) {
    this.rec = { src, timestamp: init.timestamp, duration: init.duration, closes: 0, init };
    frameLog.push(this.rec);
  }
  close(): void { this.rec.closes++; }
}

let audioLog: { timestamp: number; numberOfFrames: number; sample: number; closes: number }[] = [];

class StubAudioData {
  rec: { timestamp: number; numberOfFrames: number; sample: number; closes: number };
  constructor(init: any) {
    this.rec = { timestamp: init.timestamp, numberOfFrames: init.numberOfFrames, sample: init.data[0], closes: 0 };
    audioLog.push(this.rec);
  }
  close(): void { this.rec.closes++; }
}

/** Minimal VideoEncoder/AudioEncoder shape: records calls, supports 'dequeue'. */
class StubEncoder {
  static instances: StubEncoder[] = [];
  config: any = null;
  encodes: { frame: any; opts: any }[] = [];
  flushed = 0;
  closed = 0;
  encodeQueueSize = 0;
  order: string[];
  listeners: (() => void)[] = [];
  cb: { output: (c: unknown, m: unknown) => void; error: (e: unknown) => void };
  constructor(cb: any, order: string[] = []) { this.cb = cb; this.order = order; StubEncoder.instances.push(this); }
  configure(c: any): void { this.config = c; }
  encode(frame: any, opts?: any): void { this.encodes.push({ frame, opts }); }
  addEventListener(_type: string, fn: () => void): void { this.listeners.push(fn); }
  removeEventListener(_type: string, fn: () => void): void {
    const i = this.listeners.indexOf(fn);
    if (i >= 0) this.listeners.splice(i, 1);
  }
  dispatchDequeue(): void { for (const fn of [...this.listeners]) fn(); }
  async flush(): Promise<void> { this.flushed++; this.order.push(`flush:${this.tag}`); }
  close(): void { this.closed++; this.order.push(`close:${this.tag}`); }
  tag = 'enc';
}

class StubMuxer {
  video: unknown[] = [];
  audio: unknown[] = [];
  /** Interleave record across BOTH streams, in the order chunks were fed. */
  fed: string[] = [];
  finalized = 0;
  order: string[];
  constructor(order: string[]) { this.order = order; }
  addVideoChunk(c: unknown): void { this.video.push(c); this.fed.push(`v:${(c as { timestamp?: number } | null)?.timestamp ?? '?'}`); }
  addAudioChunk(c: unknown): void { this.audio.push(c); this.fed.push(`a:${(c as { timestamp?: number } | null)?.timestamp ?? '?'}`); }
  async finalize(): Promise<void> { this.finalized++; this.order.push('mux:finalize'); }
}

function stubAudioBuffer(length: number, channels = 2, sampleRate = 48_000): any {
  const data = Array.from({ length: channels }, (_, ch) => {
    const arr = new Float32Array(length);
    for (let i = 0; i < length; i++) arr[i] = ch + i / 1e6;
    return arr;
  });
  return { length, numberOfChannels: channels, sampleRate, getChannelData: (ch: number) => data[ch]! };
}

const PICK_WEBM: EncodePick = { container: 'webm', codec: 'vp09.00.10.08', muxCodec: 'V_VP9' };
const PICK_MP4: EncodePick = { container: 'mp4', codec: 'avc1.42001f', muxCodec: 'avc' };

interface Harness {
  order: string[];
  muxer: StubMuxer;
  video: StubEncoder;
  audio: StubEncoder | null;
  target: { buffer: ArrayBuffer };
}

function harness(opts: Partial<EncodeOpts> = {}, pick: EncodePick = PICK_WEBM) {
  frameLog = [];
  audioLog = [];
  StubEncoder.instances = [];
  const order: string[] = [];
  const muxer = new StubMuxer(order);
  const target = { buffer: new ArrayBuffer(8) };
  const o: EncodeOpts = { width: 640, height: 360, fps: 24, bitrate: 1_000_000, ...opts };
  const h: Harness = { order, muxer, video: null as any, audio: null, target };
  const session = createStreamingMux(pick, o, {
    muxerFactory: async () => ({ muxer, target, type: pick.container === 'mp4' ? 'video/mp4' : 'video/webm' }),
    VideoEncoder: class extends StubEncoder {
      constructor(cb: any) { super(cb, order); this.tag = 'video'; h.video = this; }
    },
    AudioEncoder: class extends StubEncoder {
      constructor(cb: any) { super(cb, order); this.tag = 'audio'; h.audio = this; }
    },
    VideoFrame: StubVideoFrame,
    AudioData: StubAudioData,
  });
  return { session, h };
}

const AUDIO = { channels: [], sampleRate: 48_000, numberOfChannels: 2, codec: 'opus', muxCodec: 'A_OPUS', bitrate: 128_000 };

/** Let pending microtasks + one macrotask turn run, without reaching the 25ms
 *  dequeue fallback timer. */
const tick = (): Promise<void> => new Promise<void>((r) => setImmediate(r));

// ── Tests ─────────────────────────────────────────────────────────────────────

test('createStreamingMux: encodes each frame once and closes every VideoFrame exactly once', async () => {
  const { session, h } = harness();
  const mux = await session;
  const canvas = { tag: 'canvas' } as any;
  for (let i = 0; i < 5; i++) await mux.addFrame(canvas, Math.round(i * 1e6 / 24));

  assert.equal(h.video.encodes.length, 5);
  assert.equal(frameLog.length, 5);
  assert.deepEqual(frameLog.map((f) => f.closes), [1, 1, 1, 1, 1]);
  assert.deepEqual(frameLog.map((f) => f.src), Array(5).fill(canvas));
});

test('createStreamingMux: timestamps + keyframe cadence match videoFrameSchedule', async () => {
  const fps = 24;
  const { session, h } = harness({ fps });
  const mux = await session;
  const want = videoFrameSchedule(50, fps);
  for (const t of want) await mux.addFrame({} as any, t.timestampUs);

  assert.deepEqual(frameLog.map((f) => f.timestamp), want.map((t) => t.timestampUs));
  assert.deepEqual(frameLog.map((f) => f.duration), want.map((t) => t.durationUs));
  assert.deepEqual(h.video.encodes.map((e) => e.opts.keyFrame), want.map((t) => t.keyFrame));
  // keyEvery = round(24*2) = 48 → frames 0 and 48 only
  assert.deepEqual(
    h.video.encodes.map((e, i) => (e.opts.keyFrame ? i : -1)).filter((i) => i >= 0),
    [0, 48],
  );
});

test('createStreamingMux: addFrame awaits while encodeQueueSize > HIGH_WATER, resumes on dequeue', async () => {
  const { session, h } = harness();
  const mux = await session;

  h.video.encodeQueueSize = HIGH_WATER + 1;
  let settled = false;
  const p = mux.addFrame({} as any, 0).then(() => { settled = true; });

  await tick(); await tick();
  assert.equal(settled, false, 'addFrame must not resolve while the encoder queue is above the high-water mark');
  assert.equal(h.video.encodes.length, 1, 'the frame is handed to the encoder before the wait');
  assert.equal(frameLog[0]!.closes, 1, 'and closed before the wait - never held across backpressure');

  // A dequeue that does not drop the queue below the mark keeps us waiting.
  h.video.dispatchDequeue();
  await tick(); await tick();
  assert.equal(settled, false);

  h.video.encodeQueueSize = 0;
  h.video.dispatchDequeue();
  await p;
  assert.equal(settled, true);
  assert.equal(h.video.listeners.length, 0, 'every dequeue listener is removed again');
});

test('createStreamingMux: at most HIGH_WATER+1 frames are alive at once', async () => {
  const { session, h } = harness();
  const mux = await session;
  // The encoder drains one slot per encode; the session must never run ahead of it.
  let live = 0, peak = 0;
  const origEncode = h.video.encode.bind(h.video);
  h.video.encode = (frame: any, opts: any) => {
    live++; peak = Math.max(peak, live);
    h.video.encodeQueueSize = live;
    origEncode(frame, opts);
    queueMicrotask(() => { live = Math.max(0, live - 1); h.video.encodeQueueSize = live; h.video.dispatchDequeue(); });
  };
  for (let i = 0; i < 40; i++) await mux.addFrame({} as any, i * 1000);
  assert.ok(peak <= HIGH_WATER + 1, `peak in-flight ${peak} exceeded HIGH_WATER+1 (${HIGH_WATER + 1})`);
  assert.deepEqual([...new Set(frameLog.map((f) => f.closes))], [1]);
});

test('createStreamingMux: finalize flushes video, then audio, then the muxer, and returns a Blob', async () => {
  const { session, h } = harness({ audio: AUDIO });
  const mux = await session;
  await mux.addFrame({} as any, 0);
  const blob = await mux.finalize();

  assert.deepEqual(h.order, ['flush:video', 'close:video', 'flush:audio', 'close:audio', 'mux:finalize']);
  assert.equal(h.muxer.finalized, 1);
  assert.equal(blob.type, 'video/webm');
  assert.equal(blob.size, 8);
});

test('createStreamingMux: mp4 pins avc format, webm does not', async () => {
  const a = harness({}, PICK_MP4);
  await a.session;
  assert.deepEqual(a.h.video.config.avc, { format: 'avc' });
  assert.equal(a.h.video.config.codec, 'avc1.42001f');

  const b = harness({}, PICK_WEBM);
  await b.session;
  assert.equal(b.h.video.config.avc, undefined);
});

test('createStreamingMux: addFrame/addAudio/finalize after finalize reject cleanly', async () => {
  const { session } = harness({ audio: AUDIO });
  const mux = await session;
  await mux.addFrame({} as any, 0);
  await mux.finalize();

  await assert.rejects(() => mux.addFrame({} as any, 1000), /streaming mux is closed/);
  await assert.rejects(() => mux.addAudio(stubAudioBuffer(100)), /streaming mux is closed/);
  await assert.rejects(() => mux.finalize(), /streaming mux is closed/);
  assert.equal(frameLog.length, 1, 'a rejected addFrame must not construct a VideoFrame');
});

test('createStreamingMux: abort after N frames leaves nothing pending and never finalizes', async () => {
  const { session, h } = harness({ audio: AUDIO });
  const mux = await session;
  for (let i = 0; i < 3; i++) await mux.addFrame({} as any, i * 1000);

  await mux.abort(new Error('cancelled'));

  assert.equal(h.video.closed, 1);
  assert.equal(h.audio!.closed, 1);
  assert.equal(h.video.flushed, 0, 'abort must not flush - the output is being discarded');
  assert.equal(h.muxer.finalized, 0);
  assert.deepEqual([...new Set(frameLog.map((f) => f.closes))], [1], 'no VideoFrame leaked past abort');
  assert.equal(h.video.listeners.length, 0);

  await mux.abort();                                    // idempotent
  assert.equal(h.video.closed, 1);
  await assert.rejects(() => mux.addFrame({} as any, 0), /streaming mux is closed/);
});

test('createStreamingMux: an encoder error surfaces on the next addFrame and on finalize', async () => {
  const { session, h } = harness();
  const mux = await session;
  await mux.addFrame({} as any, 0);
  h.video.cb.error(new Error('encoder exploded'));

  await assert.rejects(() => mux.addFrame({} as any, 1000), /encoder exploded/);
  await assert.rejects(() => mux.finalize(), /encoder exploded/);
  assert.equal(h.muxer.finalized, 0, 'a failed session must not produce a container');
});

test('createStreamingMux: chunks are held back and reach the muxer only at finalize', async () => {
  // Feeding the muxer from the output callbacks made the audio/video interleave
  // depend on scheduler load (tied timestamps every 0.1s at 30fps), so the same
  // render could hash differently. The callbacks queue; finalize() drains.
  const { session, h } = harness();
  const mux = await session;
  await mux.addFrame({} as any, 0);
  h.video.cb.output({ chunk: 1, timestamp: 0 }, { meta: true });
  assert.deepEqual(h.muxer.video, [], 'nothing reaches the muxer mid-run');
  await mux.finalize();
  assert.deepEqual(h.muxer.video, [{ chunk: 1, timestamp: 0 }]);
});

test('createStreamingMux: finalize interleaves streams canonically - ascending timestamp, video first on a tie', async () => {
  const { session, h } = harness({ audio: AUDIO });
  const mux = await session;
  await mux.addFrame({} as any, 0);
  // Adversarial ARRIVAL order: audio arrives first, out of timestamp order, with
  // one exact tie at 100000µs. The muxer must still see one canonical order.
  h.audio!.cb.output({ chunk: 'a@100000', timestamp: 100_000 }, undefined);
  h.audio!.cb.output({ chunk: 'a@200000', timestamp: 200_000 }, undefined);
  h.video.cb.output({ chunk: 'v@66667', timestamp: 66_667 }, undefined);
  h.video.cb.output({ chunk: 'v@100000', timestamp: 100_000 }, undefined);
  h.video.cb.output({ chunk: 'v@133333', timestamp: 133_333 }, undefined);
  await mux.finalize();
  assert.deepEqual(h.muxer.fed, ['v:66667', 'v:100000', 'a:100000', 'v:133333', 'a:200000'],
    'one canonical interleave regardless of arrival order - video wins the tie');
  assert.deepEqual(h.muxer.video.map((c: any) => c.chunk), ['v@66667', 'v@100000', 'v@133333'], 'per-stream emit order is preserved');
  assert.deepEqual(h.muxer.audio.map((c: any) => c.chunk), ['a@100000', 'a@200000']);
});

test('createStreamingMux: addAudio chunks PCM and continues timestamps across buffers', async () => {
  const { session, h } = harness({ audio: AUDIO });
  const mux = await session;

  await mux.addAudio(stubAudioBuffer(11_000));          // 4800 + 4800 + 1400
  await mux.addAudio(stubAudioBuffer(4800));

  assert.deepEqual(audioLog.map((a) => a.numberOfFrames), [4800, 4800, 1400, 4800]);
  const us = (frames: number): number => Math.round((frames / 48_000) * 1e6);
  assert.deepEqual(audioLog.map((a) => a.timestamp), [us(0), us(4800), us(9600), us(11_000)]);
  assert.deepEqual([...new Set(audioLog.map((a) => a.closes))], [1], 'every AudioData is closed exactly once');
  assert.equal(h.audio!.encodes.length, 4);
});

test('createStreamingMux: addAudio without a declared audio track rejects; empty buffer is a no-op', async () => {
  const { session } = harness();                        // no opts.audio
  const mux = await session;
  await assert.rejects(() => mux.addAudio(stubAudioBuffer(100)), /no audio track/);

  const withAudio = harness({ audio: AUDIO });
  const m2 = await withAudio.session;
  await m2.addAudio(stubAudioBuffer(0));
  assert.equal(audioLog.length, 0);
});

// ── Buffered path (encodeMuxWebCodecs) ────────────────────────────────────────
// No injection seam here: the function reads the WebCodecs GLOBALS and builds the
// REAL muxer (mediabunny - pure JS, importable in node). So the stub encoders are
// installed on globalThis for the duration of a run, and they emit chunks shaped
// like EncodedVideo/AudioChunk THROUGH real muxing - the returned bytes are a
// genuine container, assertable by structural marker.

/** mediabunny's EncodedPacket.fromEncodedChunk gates on `chunk instanceof
 *  EncodedVideoChunk || chunk instanceof EncodedAudioChunk` - free globals it
 *  resolves at call time, so installing these classes satisfies it. */
class FakeVideoChunk {
  type: string; timestamp: number; duration: number; bytes: Uint8Array;
  constructor(init: { type: string; timestamp: number; duration: number; bytes: Uint8Array }) {
    this.type = init.type; this.timestamp = init.timestamp; this.duration = init.duration; this.bytes = init.bytes;
  }
  get byteLength(): number { return this.bytes.length; }
  copyTo(dst: Uint8Array): void { dst.set(this.bytes); }
}
class FakeAudioChunk extends FakeVideoChunk {}

/** Deterministic payload so the muxed bytes are content-addressable (and
 *  perturbable - the negative control flips it). */
let videoPayload = 0x5c;

class EmittingVideoEncoder extends StubEncoder {
  override encode(frame: any, opts?: any): void {
    super.encode(frame, opts);
    const id = ((frame.rec.src as { id?: number }).id ?? 0) & 0xff;
    this.cb.output(
      new FakeVideoChunk({
        type: opts?.keyFrame ? 'key' : 'delta',
        timestamp: frame.rec.timestamp, duration: frame.rec.duration,
        bytes: new Uint8Array([id, videoPayload, 0xc3, 0xd4, 0xe5]),
      }),
      // A real WebCodecs decoderConfig: mediabunny validates the codec string and,
      // for AVC, needs an avcC in the description (a placeholder is embedded as-is).
      {
        decoderConfig: {
          codec: this.config.codec, codedWidth: this.config.width, codedHeight: this.config.height,
          ...(this.config.avc ? { description: new Uint8Array(24) } : {}),
        },
      },
    );
  }
}

class EmittingAudioEncoder extends StubEncoder {
  override encode(data: any): void {
    super.encode(data, undefined);
    this.cb.output(
      new FakeAudioChunk({
        type: 'key',
        timestamp: data.rec.timestamp,
        duration: Math.round((data.rec.numberOfFrames / 48_000) * 1e6),
        bytes: new Uint8Array([0xa0, data.rec.numberOfFrames & 0xff, 0x01, 0x02]),
      }),
      // Opus needs no codec-private data; AAC carries an AudioSpecificConfig.
      {
        decoderConfig: {
          codec: this.config.codec, sampleRate: this.config.sampleRate, numberOfChannels: this.config.numberOfChannels,
          ...(this.config.codec === 'opus' ? {} : { description: new Uint8Array([0x11, 0x90]) }),
        },
      },
    );
  }
}

function installGlobals(stubs: Record<string, unknown>): () => void {
  const g = globalThis as any;
  const saved = new Map<string, unknown>(Object.keys(stubs).map((k) => [k, g[k]]));
  for (const [k, v] of Object.entries(stubs)) g[k] = v;
  return () => { for (const [k, v] of saved) { if (v === undefined) delete g[k]; else g[k] = v; } };
}

const fakeFrames = (n: number): ImageBitmap[] =>
  Array.from({ length: n }, (_, id) => ({ id }) as unknown as ImageBitmap);

async function runBuffered(opts: {
  pick?: EncodePick; n?: number; fps?: number; audio?: EncodeAudio | null; VideoEncoder?: unknown;
  target?: 'buffer' | 'opfs'; seekableSink?: SeekableSinkFactory;
  colorSpace?: VideoColorSpaceInit; frameFormat?: 'RGBA' | 'I420P10';
  frames?: Array<ImageBitmap | { data: BufferSource }>;
} = {}): Promise<{ buffer: ArrayBuffer; type: string }> {
  frameLog = []; audioLog = []; StubEncoder.instances = [];
  const restore = installGlobals({
    VideoEncoder: opts.VideoEncoder ?? EmittingVideoEncoder,
    AudioEncoder: EmittingAudioEncoder,
    VideoFrame: StubVideoFrame,
    AudioData: StubAudioData,
    EncodedVideoChunk: FakeVideoChunk,
    EncodedAudioChunk: FakeAudioChunk,
  });
  try {
    return await encodeMuxWebCodecs(opts.frames ?? fakeFrames(opts.n ?? 3), opts.pick ?? PICK_WEBM, {
      width: 640, height: 360, fps: opts.fps ?? 24, bitrate: 1_000_000, audio: opts.audio ?? null,
      target: opts.target, seekableSink: opts.seekableSink,
      colorSpace: opts.colorSpace, frameFormat: opts.frameFormat,
    });
  } finally { restore(); }
}

/** Raw-RGBA-buffer frames, the shape the HDR capture path pushes. */
const bufferFrames = (n: number): Array<{ data: BufferSource }> =>
  Array.from({ length: n }, () => ({ data: new Uint8ClampedArray(16) }));

/**
 * An in-memory stand-in for the OPFS seekable writable (step A3). It honours the
 * POSITIONED writes mediabunny's `fastStart:false` MP4 uses to backpatch the trailing
 * `moov`, so the bytes read back are exactly what a real OPFS file would hold - the
 * StreamTarget path is exercised end to end without a browser.
 */
function memSeekableSink(): { factory: SeekableSinkFactory; bytes(): Uint8Array; closed(): boolean } {
  let buf = new Uint8Array(0);
  let max = 0;
  let didClose = false;
  const factory: SeekableSinkFactory = async () => {
    const writable = new WritableStream<{ type: 'write'; data: Uint8Array; position: number }>({
      write(chunk) {
        const end = chunk.position + chunk.data.length;
        if (end > buf.length) { const grown = new Uint8Array(end); grown.set(buf); buf = grown; }
        buf.set(chunk.data, chunk.position);
        if (end > max) max = end;
      },
      close() { didClose = true; },
    });
    return { writable, result: async (): Promise<Blob> => new Blob([buf.subarray(0, max)]) } as unknown as SeekableSink;
  };
  return { factory, bytes: () => buf.subarray(0, max), closed: () => didClose };
}

function bufferedAudio(length: number, mp4 = false): EncodeAudio {
  const ch = (o: number): Float32Array => {
    const a = new Float32Array(length);
    for (let i = 0; i < length; i++) a[i] = o + i / 1e6;
    return a;
  };
  return {
    channels: [ch(0), ch(1)], sampleRate: 48_000, numberOfChannels: 2, bitrate: 128_000,
    codec: mp4 ? 'mp4a.40.2' : 'opus', muxCodec: mp4 ? 'aac' : 'A_OPUS',
  };
}

function indexOfBytes(hay: Uint8Array, needle: number[]): number {
  outer: for (let i = 0; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

test('encodeMuxWebCodecs: timestamps + keyframe cadence match videoFrameSchedule; every frame closed once', async () => {
  const fps = 24;
  await runBuffered({ n: 50, fps });
  const want = videoFrameSchedule(50, fps);
  assert.deepEqual(frameLog.map((f) => f.timestamp), want.map((t) => t.timestampUs));
  assert.deepEqual(frameLog.map((f) => f.duration), want.map((t) => t.durationUs));
  const enc = StubEncoder.instances[0]!;
  assert.deepEqual(enc.encodes.map((e) => e.opts.keyFrame), want.map((t) => t.keyFrame));
  assert.deepEqual(enc.encodes.map((e, i) => (e.opts.keyFrame ? i : -1)).filter((i) => i >= 0), [0, 48]);
  assert.deepEqual([...new Set(frameLog.map((f) => f.closes))], [1], 'every VideoFrame closed exactly once');
  assert.deepEqual(frameLog.map((f) => (f.src as { id: number }).id), want.map((t) => t.index), 'frames encoded in schedule order');
});

test('encodeMuxWebCodecs: mp4 pick pins avc config and returns real video/mp4 bytes (ftyp)', async () => {
  const a = await runBuffered({ pick: PICK_MP4 });
  assert.equal(a.type, 'video/mp4');
  const cfg = StubEncoder.instances[0]!.config;
  assert.equal(cfg.codec, 'avc1.42001f');
  assert.deepEqual(cfg.avc, { format: 'avc' });
  const bytes = new Uint8Array(a.buffer);
  // Non-vacuity: a real container, not an empty buffer - sized, properly
  // marked, and carrying the stub chunk payload in its mdat.
  assert.ok(bytes.length > 200, `mp4 output too small (${bytes.length} bytes)`);
  assert.deepEqual([...bytes.subarray(4, 8)], [0x66, 0x74, 0x79, 0x70], 'ftyp box marker');
  assert.ok(indexOfBytes(bytes, [0x00, videoPayload, 0xc3, 0xd4, 0xe5]) >= 0, 'frame 0 payload reaches the mdat');

  // Negative control: a perturbed frame payload must change the muxed bytes.
  videoPayload = 0x7e;
  try {
    const b = await runBuffered({ pick: PICK_MP4 });
    assert.notDeepEqual([...new Uint8Array(b.buffer)], [...bytes], 'perturbed payload must produce different bytes');
  } finally { videoPayload = 0x5c; }
});

test('encodeMuxWebCodecs: webm pick returns real video/webm bytes (EBML magic), no avc pin', async () => {
  const r = await runBuffered({ pick: PICK_WEBM });
  assert.equal(r.type, 'video/webm');
  assert.equal(StubEncoder.instances[0]!.config.avc, undefined);
  const bytes = new Uint8Array(r.buffer);
  assert.ok(bytes.length > 100, `webm output too small (${bytes.length} bytes)`);
  assert.deepEqual([...bytes.subarray(0, 4)], [0x1a, 0x45, 0xdf, 0xa3], 'EBML header magic');
  assert.ok(indexOfBytes(bytes, [0x00, videoPayload, 0xc3, 0xd4, 0xe5]) >= 0, 'frame 0 payload reaches the cluster');
});

test('encodeMuxWebCodecs: audio track chunks PCM on the schedule; absent audio constructs no AudioEncoder', async () => {
  await runBuffered({ audio: bufferedAudio(11_000) });  // 4800 + 4800 + 1400
  const aEnc = StubEncoder.instances.find((e) => e instanceof EmittingAudioEncoder)!;
  assert.ok(aEnc, 'an AudioEncoder is constructed for a declared track');
  assert.deepEqual(
    { codec: aEnc.config.codec, sampleRate: aEnc.config.sampleRate, numberOfChannels: aEnc.config.numberOfChannels, bitrate: aEnc.config.bitrate },
    { codec: 'opus', sampleRate: 48_000, numberOfChannels: 2, bitrate: 128_000 },
  );
  assert.deepEqual(audioLog.map((a) => a.numberOfFrames), [4800, 4800, 1400]);
  const us = (frames: number): number => Math.round((frames / 48_000) * 1e6);
  assert.deepEqual(audioLog.map((a) => a.timestamp), [us(0), us(4800), us(9600)]);
  assert.deepEqual([...new Set(audioLog.map((a) => a.closes))], [1], 'every AudioData closed exactly once');
  assert.equal(aEnc.flushed, 1);

  await runBuffered({});                                // no audio
  assert.equal(StubEncoder.instances.some((e) => e instanceof EmittingAudioEncoder), false);
  assert.equal(audioLog.length, 0);
});

test('encodeMuxWebCodecs: an encoder error rejects and stops feeding frames', async () => {
  class FailingEncoder extends EmittingVideoEncoder {
    override encode(frame: any, opts?: any): void {
      super.encode(frame, opts);
      if (this.encodes.length === 3) this.cb.error(new Error('encoder exploded'));
    }
  }
  await assert.rejects(() => runBuffered({ n: 10, VideoEncoder: FailingEncoder }), /encoder exploded/);
  assert.equal(StubEncoder.instances[0]!.encodes.length, 3, 'the loop stops at the failing frame');
  assert.deepEqual([...new Set(frameLog.map((f) => f.closes))], [1], 'no VideoFrame leaked past the failure');

  class StringFailEncoder extends EmittingVideoEncoder {
    override encode(frame: any, opts?: any): void { super.encode(frame, opts); this.cb.error('boom'); }
  }
  await assert.rejects(() => runBuffered({ VideoEncoder: StringFailEncoder }), /VideoEncoder error/);
});

test('encodeMuxWebCodecs: a muxer rejection inside the output callback propagates', async () => {
  class BadChunkEncoder extends StubEncoder {
    override encode(frame: any, opts?: any): void {
      super.encode(frame, opts);
      this.cb.output({ not: 'a chunk' }, undefined);     // real muxer throws its instanceof TypeError
    }
  }
  await assert.rejects(() => runBuffered({ VideoEncoder: BadChunkEncoder }), /EncodedVideoChunk/);
});

// ── Step A3: StreamTarget → seekable sink (OPFS in the browser) ────────────────
// The default path is BufferTarget and is covered by every case above; here the
// SAME real mediabunny muxer is pointed at a StreamTarget over an injected in-memory
// SEEKABLE sink, so `fastStart:false` (MP4) and the streaming WebM writer are driven
// end to end and the finalized artifact is read back and checked for completeness -
// exactly the browser sanity check the plan asks for, but deterministic and in node.

test('encodeMuxWebCodecs: mp4 over a StreamTarget/OPFS sink reads back a complete, seekable container', async () => {
  const sink = memSeekableSink();
  const r = await runBuffered({ pick: PICK_MP4, n: 6, target: 'opfs', seekableSink: sink.factory });
  assert.equal(r.type, 'video/mp4');
  assert.ok(sink.closed(), 'the writable must be closed (committing the file) at finalize');
  const bytes = new Uint8Array(r.buffer);
  // Read back from the sink == what finalize returned: a real, complete container.
  assert.deepEqual([...bytes], [...sink.bytes()], 'the returned bytes are exactly the file on the sink');
  assert.ok(bytes.length > 200, `opfs mp4 too small (${bytes.length} bytes) - likely truncated`);
  assert.deepEqual([...bytes.subarray(4, 8)], [0x66, 0x74, 0x79, 0x70], 'leading ftyp box');
  // fastStart:false streams the mdat and BACKPATCHES the moov at the end via seek -
  // so a positioned write placed the moov, and it is present (not lost to truncation).
  assert.ok(indexOfBytes(bytes, [0x6d, 0x6f, 0x6f, 0x76]) >= 0, 'moov box present (backpatched at the end)');
  assert.ok(indexOfBytes(bytes, [0x00, videoPayload, 0xc3, 0xd4, 0xe5]) >= 0, 'frame 0 payload reached the mdat');
});

test('encodeMuxWebCodecs: webm over a StreamTarget/OPFS sink reads back a complete container', async () => {
  const sink = memSeekableSink();
  const r = await runBuffered({ pick: PICK_WEBM, n: 6, target: 'opfs', seekableSink: sink.factory });
  assert.equal(r.type, 'video/webm');
  assert.ok(sink.closed(), 'the writable must be closed at finalize');
  const bytes = new Uint8Array(r.buffer);
  assert.deepEqual([...bytes], [...sink.bytes()], 'the returned bytes are exactly the file on the sink');
  assert.ok(bytes.length > 100, `opfs webm too small (${bytes.length} bytes)`);
  assert.deepEqual([...bytes.subarray(0, 4)], [0x1a, 0x45, 0xdf, 0xa3], 'EBML header magic');
  assert.ok(indexOfBytes(bytes, [0x00, videoPayload, 0xc3, 0xd4, 0xe5]) >= 0, 'frame 0 payload reached the cluster');
});

test('encodeMuxWebCodecs: the OPFS sink carries the audio track too', async () => {
  const sink = memSeekableSink();
  const r = await runBuffered({ pick: PICK_WEBM, n: 6, audio: bufferedAudio(11_000), target: 'opfs', seekableSink: sink.factory });
  const bytes = new Uint8Array(r.buffer);
  assert.deepEqual([...bytes.subarray(0, 4)], [0x1a, 0x45, 0xdf, 0xa3], 'EBML header magic');
  // The audio encoder's payload marker (see EmittingAudioEncoder) must reach the file.
  assert.ok(indexOfBytes(bytes, [0xa0]) >= 0 && bytes.length > 200, 'audio + video muxed into the streamed file');
});

// ── Step A4 / STOP GATE 4: provenance over the moov-at-end (fastStart:false) MP4 ──
// The plan's A4 stamps the streamed OPFS container through the shell's existing
// provenance chain; A3's return contract already routes the OPFS bytes into it (the
// File IS a Blob, and renderSequence/renderFormat stamp whatever finalize returns).
// The critical risk is STOP GATE 4: the MP4 written by fastStart:false has its
// `moov` at the END, and the container-metadata embedder must accept that layout
// rather than reject it. `embedMp4Meta` (engine/src/video-meta.ts) explicitly does -
// it finds `moov` wherever it sits and only patches chunk offsets when `mdat` follows
// it - so this proves the streamed layout is stampable, not just muxable.
test('gate 4: engine provenance embeds into the OPFS fastStart:false MP4 (moov-at-end, ftyp leading)', async () => {
  const { embedMp4Meta } = await import('@lolly/engine');
  const sink = memSeekableSink();
  const r = await runBuffered({ pick: PICK_MP4, n: 6, target: 'opfs', seekableSink: sink.factory });
  const bytes = new Uint8Array(r.buffer);
  const MOOV = [0x6d, 0x6f, 0x6f, 0x76], MDAT = [0x6d, 0x64, 0x61, 0x74], UDTA = [0x75, 0x64, 0x74, 0x61];
  assert.deepEqual([...bytes.subarray(4, 8)], [0x66, 0x74, 0x79, 0x70], 'leading ftyp (the stamp placer requires it)');
  const moovAt = indexOfBytes(bytes, MOOV);
  const mdatAt = indexOfBytes(bytes, MDAT);
  assert.ok(mdatAt >= 0 && moovAt >= 0 && mdatAt < moovAt, 'fastStart:false put mdat FIRST and moov at the END');
  assert.equal(indexOfBytes(bytes, UDTA), -1, 'no provenance udta before stamping');
  const tags = { title: 'Seq', artist: 'Lolly', date: new Date(0).toISOString(), comment: 'c', encoder: 'Lolly', encodedBy: 'Lolly', publisher: 'Lolly' };
  const out = new Uint8Array(embedMp4Meta(bytes, tags));
  assert.notEqual(out.length, bytes.length, 'provenance was embedded - the moov-at-end layout was ACCEPTED, not rejected');
  assert.ok(indexOfBytes(out, UDTA) >= 0, 'the udta box landed inside the trailing moov');
  assert.ok(indexOfBytes(out, [0x00, videoPayload, 0xc3, 0xd4, 0xe5]) >= 0, 'frame payload survived the stamp');
});

// ── Plan 154 WP-2: HDR 10-bit output ──────────────────────────────────────────
// The buffered encode grows one seam: when o.colorSpace is set, frames arrive as raw
// RGBA buffers and are built via the BUFFER VideoFrame ctor (image-source VideoFrameInit
// has no colorSpace field), and the muxed track's decoderConfig.colorSpace is FORCE-SET
// so mediabunny writes a colr/nclx box. colorSpace UNSET is the exact SDR path.

test('encodeMuxWebCodecs: colorSpace set builds each frame via the buffer ctor carrying colorSpace + format', async () => {
  const frames = bufferFrames(3);
  await runBuffered({ pick: PICK_MP4, frames, colorSpace: HDR_VF_COLORSPACE, frameFormat: 'RGBA' });
  assert.equal(frameLog.length, 3);
  for (let i = 0; i < 3; i++) {
    const init = frameLog[i]!.init;
    assert.equal(init.format, 'RGBA', 'buffer ctor gets the pixel format');
    assert.equal(init.codedWidth, 640);
    assert.equal(init.codedHeight, 360);
    assert.deepEqual(init.colorSpace, HDR_VF_COLORSPACE, 'the PQ colorSpace rides the frame');
    assert.equal(frameLog[i]!.src, frames[i]!.data, 'the FIRST ctor arg is the RGBA buffer, not an image source');
  }
  // frameFormat defaults to RGBA when omitted (export.ts always passes it, the core defaults it).
  await runBuffered({ pick: PICK_MP4, frames: bufferFrames(1), colorSpace: HDR_VF_COLORSPACE });
  assert.equal(frameLog[0]!.init.format, 'RGBA', 'frameFormat defaults to RGBA');
});

test('encodeMuxWebCodecs: frameFormat I420P10 (WP-2 Phase 2) builds the buffer ctor with the packed 10-bit planes', async () => {
  // The Phase-2 true-10-bit source: frames arrive as packed I420P10 Uint16 planes
  // (Y ++ U ++ V), and the SAME buffer VideoFrame ctor carries format:'I420P10' + the
  // PQ colorSpace. The seam is format-agnostic; this locks the 10-bit case explicitly.
  const planes = Array.from({ length: 3 }, () => ({ data: new Uint16Array(640 * 360 + 2 * 320 * 180) }));
  await runBuffered({ pick: PICK_MP4, frames: planes, colorSpace: HDR_VF_COLORSPACE, frameFormat: 'I420P10' });
  assert.equal(frameLog.length, 3);
  for (let i = 0; i < 3; i++) {
    const init = frameLog[i]!.init;
    assert.equal(init.format, 'I420P10', 'the Phase-2 seam passes I420P10 to the buffer ctor');
    assert.equal(init.codedWidth, 640);
    assert.equal(init.codedHeight, 360);
    assert.deepEqual(init.colorSpace, HDR_VF_COLORSPACE, 'the PQ colorSpace still rides the frame');
    assert.equal(frameLog[i]!.src, planes[i]!.data, 'the FIRST ctor arg is the packed I420P10 Uint16 buffer');
  }
});

test('encodeMuxWebCodecs: the video output callback force-sets decoderConfig.colorSpace, and mediabunny writes a colr/nclx box', async () => {
  // Captures the metadata object each chunk is emitted with; the core's output callback
  // mutates it IN PLACE (force-set), so after the run every captured meta shows the tag.
  // The stub emits the full encoder-config shape; the core only touches colorSpace.
  const emitted: Array<{ decoderConfig?: { colorSpace?: VideoColorSpaceInit; [k: string]: unknown } }> = [];
  class CapturingEncoder extends StubEncoder {
    override encode(frame: any, opts?: any): void {
      super.encode(frame, opts);
      const meta = { decoderConfig: { codec: this.config.codec, codedWidth: this.config.width, codedHeight: this.config.height, description: new Uint8Array(24) } };
      emitted.push(meta);
      this.cb.output(new FakeVideoChunk({
        type: opts?.keyFrame ? 'key' : 'delta',
        timestamp: frame.rec.timestamp, duration: frame.rec.duration,
        bytes: new Uint8Array([0, videoPayload, 0xc3, 0xd4, 0xe5]),
      }), meta);
    }
  }
  const r = await runBuffered({ pick: PICK_MP4, n: 3, frames: bufferFrames(3), VideoEncoder: CapturingEncoder, colorSpace: HDR_VF_COLORSPACE, frameFormat: 'RGBA' });
  assert.ok(emitted.length >= 1, 'at least one chunk was emitted');
  for (const m of emitted) assert.deepEqual(m.decoderConfig!.colorSpace, HDR_VF_COLORSPACE, 'colorSpace was force-set on the muxed metadata');
  const bytes = new Uint8Array(r.buffer);
  assert.equal(r.type, 'video/mp4');
  assert.ok(indexOfBytes(bytes, [0x63, 0x6f, 0x6c, 0x72]) >= 0, 'colr box present in the mp4 (colorSpaceIsComplete fired)');
  assert.ok(indexOfBytes(bytes, [0x6e, 0x63, 0x6c, 0x78]) >= 0, 'nclx colour type inside the colr box');
});

test('encodeMuxWebCodecs: colorSpace UNSET keeps the image-source ctor and writes no colr box (SDR path unchanged)', async () => {
  const r = await runBuffered({ pick: PICK_MP4, n: 3 });     // no colorSpace/frameFormat
  for (const f of frameLog) {
    assert.equal(f.init.colorSpace, undefined, 'no colorSpace on the frame init');
    assert.equal(f.init.format, undefined, 'image-source ctor - no explicit pixel format');
  }
  const bytes = new Uint8Array(r.buffer);
  assert.equal(indexOfBytes(bytes, [0x6e, 0x63, 0x6c, 0x78]), -1, 'no nclx colr box on the SDR path');
});

// ── Plan 154 STREAMING HDR: createStreamingMux carries colorSpace too ──────────
// The sequence/viz/audiogram exports run through the STREAMING encoder, not the buffered
// one. It grows the SAME seam: opts.colorSpace set ⇒ each frame is built via the BUFFER
// VideoFrame ctor from a raw RGBA buffer, and the video output callback FORCE-SETS the
// muxed decoderConfig.colorSpace so a colr/nclx box is written. colorSpace UNSET is the
// exact SDR path (the sequence-render browser goldens set no opts.hdr - byte-identical).

test('createStreamingMux: colorSpace set builds each frame via the buffer ctor carrying colorSpace + format', async () => {
  const { session } = harness({ colorSpace: HDR_VF_COLORSPACE, frameFormat: 'RGBA' }, PICK_MP4);
  const mux = await session;
  const frames = [{ data: new Uint8ClampedArray(16) }, { data: new Uint8ClampedArray(16) }];
  for (let i = 0; i < frames.length; i++) await mux.addFrame(frames[i] as any, i * 1000);
  assert.equal(frameLog.length, 2);
  for (let i = 0; i < 2; i++) {
    const init = frameLog[i]!.init;
    assert.equal(init.format, 'RGBA', 'buffer ctor gets the pixel format');
    assert.equal(init.codedWidth, 640);
    assert.equal(init.codedHeight, 360);
    assert.deepEqual(init.colorSpace, HDR_VF_COLORSPACE, 'the PQ colorSpace rides the frame');
    assert.equal(frameLog[i]!.src, frames[i]!.data, 'the FIRST ctor arg is the RGBA buffer, not the {data} wrapper');
  }
  // frameFormat defaults to RGBA when omitted (the sequence path always passes it, the core defaults it).
  const b = harness({ colorSpace: HDR_VF_COLORSPACE }, PICK_MP4);
  const m2 = await b.session;
  await m2.addFrame({ data: new Uint8ClampedArray(16) } as any, 0);
  assert.equal(frameLog[0]!.init.format, 'RGBA', 'frameFormat defaults to RGBA');
});

test('createStreamingMux: colorSpace set force-sets decoderConfig.colorSpace on the muxed metadata', async () => {
  const { session, h } = harness({ colorSpace: HDR_VF_COLORSPACE }, PICK_MP4);
  await session;
  const meta = { decoderConfig: { codec: 'av01.0.08M.10', codedWidth: 640, codedHeight: 360 } as { colorSpace?: VideoColorSpaceInit; [k: string]: unknown } };
  h.video.cb.output({ chunk: 1, timestamp: 0 }, meta);
  assert.deepEqual(meta.decoderConfig.colorSpace, HDR_VF_COLORSPACE, 'colorSpace force-set on the muxed metadata');
  // Chromium omits decoderConfig on non-keyframe chunks - the guard must not throw.
  assert.doesNotThrow(() => h.video.cb.output({ chunk: 2, timestamp: 1000 }, undefined));
  assert.doesNotThrow(() => h.video.cb.output({ chunk: 3, timestamp: 2000 }, {}));
});

test('createStreamingMux: colorSpace UNSET keeps the image-source ctor and never touches metadata (SDR byte-identical)', async () => {
  const { session, h } = harness({}, PICK_MP4);              // no colorSpace/frameFormat
  const mux = await session;
  const canvas = { tag: 'canvas' } as any;
  await mux.addFrame(canvas, 0);
  assert.equal(frameLog[0]!.src, canvas, 'image-source ctor gets the canvas itself, not a buffer');
  assert.equal(frameLog[0]!.init.format, undefined, 'no explicit pixel format');
  assert.equal(frameLog[0]!.init.colorSpace, undefined, 'no colorSpace on the frame init');
  assert.equal(frameLog[0]!.init.codedWidth, undefined, 'image-source ctor - no codedWidth');
  const meta = { decoderConfig: { codec: 'avc1.42001f' } as { colorSpace?: VideoColorSpaceInit } };
  h.video.cb.output({ chunk: 1, timestamp: 0 }, meta);
  assert.equal(meta.decoderConfig.colorSpace, undefined, 'the SDR output callback leaves metadata untouched');
});
