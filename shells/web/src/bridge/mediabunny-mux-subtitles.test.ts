// SPDX-License-Identifier: MPL-2.0
/**
 * The muxer's subtitle-track seam, against a FAKE mediabunny (plans/180 M-B).
 *
 * bridge/subtitle-track.test.ts already proves the finished bytes carry a `wvtt` /
 * `S_TEXT/WEBVTT` track when a VTT is threaded through, and none when it isn't.
 * What a byte scan cannot see is the ORDER, and the order is the whole contract
 * mediabunny imposes:
 *
 *   • `addSubtitleTrack` must run BEFORE `output.start()` - a track declared after
 *     the output has started throws;
 *   • the VTT document is fed to the source AFTER start, once, verbatim - it is one
 *     whole document, not a cue at a time;
 *   • no VTT (absent, empty) ⇒ the track is never even declared, which is what keeps
 *     a caption-less render byte-for-byte identical to what it always produced;
 *   • the container has the last word: a format that lists no 'webvtt' in
 *     getSupportedSubtitleCodecs() gets no subtitle track, whatever was asked for.
 *
 * `buildMediabunnyMux` reaches the library through a lazy `import('mediabunny')`,
 * so the fake is installed as a module RESOLVE hook that answers that one specifier
 * with a data: URL module - the same registerHooks idiom the view suites use for
 * '.js' specifiers and CSS. It lives in its own file (not mediabunny-mux.test.ts)
 * precisely because the hook is process-wide: the OPFS suite next door must keep
 * running against the real library.
 *
 * Run:  node --import ./tests/css-stub.mjs --test shells/web/src/bridge/mediabunny-mux-subtitles.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// ── the fake ─────────────────────────────────────────────────────────────────
// Only the surface buildMediabunnyMux drives, and every call appended to one
// ordered log on globalThis, which IS the assertion subject. `__lollyNoSubs` lets a
// test say "this container carries no subtitle codec" without a second fake.
const FAKE_MEDIABUNNY = `
const log = () => (globalThis.__lollyMuxLog ??= []);
const codecs = () => (globalThis.__lollyNoSubs ? [] : ['webvtt']);
export class BufferTarget { constructor() { this.buffer = new ArrayBuffer(0); } }
export class StreamTarget { constructor(writable) { this.writable = writable; } }
export class Mp4OutputFormat {
  constructor(opts) { this.opts = opts; }
  getSupportedSubtitleCodecs() { return codecs(); }
}
export class WebMOutputFormat {
  getSupportedSubtitleCodecs() { return codecs(); }
}
export class EncodedVideoPacketSource { constructor(codec) { this.codec = codec; } async add() {} }
export class EncodedAudioPacketSource { constructor(codec) { this.codec = codec; } async add() {} }
export class TextSubtitleSource {
  constructor(codec) { this.codec = codec; log().push(['subtitle-source', codec]); }
  async add(text) { log().push(['subtitle-add', text]); }
}
export class EncodedPacket {
  static fromEncodedChunk() { return new EncodedPacket(); }
  constructor() { this.timestamp = 0; this.duration = 0; }
  clone() { return this; }
}
export class Output {
  constructor({ format, target }) { this.format = format; this.target = target; }
  addVideoTrack() { log().push(['track', 'video']); }
  addAudioTrack() { log().push(['track', 'audio']); }
  addSubtitleTrack() { log().push(['track', 'subtitle']); }
  setMetadataTags() { log().push(['tags']); }
  async start() { log().push(['start']); }
  async finalize() { log().push(['finalize']); }
}
`;

registerHooks({
  resolve(spec: string, ctx: unknown, next: (s: string, c: unknown) => unknown) {
    if (spec === 'mediabunny') {
      return { url: `data:text/javascript,${encodeURIComponent(FAKE_MEDIABUNNY)}`, shortCircuit: true };
    }
    return next(spec, ctx);
  },
} as Parameters<typeof registerHooks>[0]);

const { buildMediabunnyMux } = await import('./mediabunny-mux.ts');

const VTT = `WEBVTT

00:00:00.000 --> 00:00:02.000
Slide one, spoken.

00:00:02.400 --> 00:00:05.000
And the second line.
`;

type LogEntry = [string, unknown?];
const logOf = (): LogEntry[] => ((globalThis as Record<string, unknown>).__lollyMuxLog as LogEntry[]) ?? [];

/** Build + finalize a muxer with no packets at all (a declared-but-empty video track
 *  finalizes fine) and return the fake's ordered call log. */
async function run(spec: Parameters<typeof buildMediabunnyMux>[0]): Promise<LogEntry[]> {
  (globalThis as Record<string, unknown>).__lollyMuxLog = [];
  const { muxer } = await buildMediabunnyMux(spec);
  await muxer.finalize();
  return logOf();
}

const mp4 = { container: 'mp4' as const, video: 'avc' };
const webm = { container: 'webm' as const, video: 'V_VP9' };

test('a subtitle track is declared before start(), and the VTT is fed once after it', async () => {
  const log = await run({ ...mp4, subtitlesVtt: VTT });
  const names = log.map((e) => `${e[0]}${e[0] === 'track' ? `:${e[1]}` : ''}`);
  assert.deepEqual(names, ['track:video', 'subtitle-source', 'track:subtitle', 'start', 'subtitle-add', 'finalize'],
    'declare the track before start, feed the document after it, then finalize');
  const added = log.filter((e) => e[0] === 'subtitle-add');
  assert.equal(added.length, 1, 'the whole document goes in one add, not one cue at a time');
  assert.equal(added[0]![1], VTT, 'the VTT reaches mediabunny verbatim');
});

test('webm gets the same track (the container both formats support)', async () => {
  const log = await run({ ...webm, subtitlesVtt: VTT });
  assert.ok(log.some((e) => e[0] === 'track' && e[1] === 'subtitle'), 'WebM carries a WebVTT track too');
});

test('no subtitle track without a VTT - absent on either container, or an empty string', async () => {
  for (const spec of [{ ...mp4 }, { ...mp4, subtitlesVtt: '' }, { ...webm }]) {
    const log = await run(spec);
    assert.ok(!log.some((e) => e[0] === 'track' && e[1] === 'subtitle'),
      `no captions must add no subtitle track: ${JSON.stringify(spec)}`);
    assert.ok(!log.some((e) => e[0] === 'subtitle-source'), 'the source is not even constructed');
  }
});

test('a container that lists no webvtt codec gets no track, however loudly it was asked for', async () => {
  (globalThis as Record<string, unknown>).__lollyNoSubs = true;
  try {
    const log = await run({ ...mp4, subtitlesVtt: VTT });
    assert.ok(!log.some((e) => e[0] === 'track' && e[1] === 'subtitle'), 'the format has the last word');
    assert.ok(log.some((e) => e[0] === 'finalize'), 'and the export still finishes normally');
  } finally {
    delete (globalThis as Record<string, unknown>).__lollyNoSubs;
  }
});

test('an audio-only export can carry captions too (no video track declared)', async () => {
  const log = await run({ container: 'webm', audio: 'A_OPUS', subtitlesVtt: VTT });
  const names = log.map((e) => `${e[0]}${e[0] === 'track' ? `:${e[1]}` : ''}`);
  assert.deepEqual(names, ['track:audio', 'subtitle-source', 'track:subtitle', 'start', 'subtitle-add', 'finalize']);
});
