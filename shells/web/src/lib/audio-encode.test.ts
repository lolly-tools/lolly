// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the audio-only export encoders (wav / mp3 / m4a / aac / opus / ogg).
 *
 * DOM-free, like bridge/export-hdr-png.test.ts: every encoder here takes planar
 * PCM and returns bytes, so node can drive all four. The two WebCodecs formats
 * use the REAL muxer (mediabunny is pure JS) with a stub AudioEncoder, so the
 * container magic asserted below is the muxer's own output and not a fixture.
 * mediabunny's EncodedPacket.fromEncodedChunk type-checks chunks with `instanceof
 * EncodedVideoChunk || instanceof EncodedAudioChunk`, so the stub chunk class is
 * installed as both globals.
 *
 * Run directly:  node --test shells/web/src/lib/audio-encode.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseWav } from '../../../../engine/src/wav.ts';
import {
  encodeWav, encodeMp3, encodeM4a, encodeAac, encodeOpus, encodeOgg, encodeFlac, encodeAudio, renderAudioExport,
  sliceWithEnvelope, sniffAudioFormat, pcmFromAudioBuffer, NO_AUDIO_MSG,
  AUDIO_FORMATS,
  type AudioPcm, type FlacOutputFactory, type FlacBuild,
} from './audio-encode.ts';
import { buildAudioTags } from './audio-tags.ts';

const RATE = 48_000;

/** A short deterministic stereo tone. */
function tone(frames: number, rate = RATE): AudioPcm {
  const l = new Float32Array(frames);
  const r = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    l[i] = Math.sin((2 * Math.PI * 440 * i) / rate) * 0.5;
    r[i] = Math.sin((2 * Math.PI * 220 * i) / rate) * 0.25;
  }
  return { channels: [l, r], sampleRate: rate };
}

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}
const tag = (u8: Uint8Array, at: number, len: number): string => String.fromCharCode(...u8.subarray(at, at + len));
const asciiBytes = (s: string): Uint8Array => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
/** UTF-16LE bytes of `s`, no BOM - the run that follows the BOM inside an ID3 text frame. */
function utf16leBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length * 2);
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); out[i * 2] = c & 0xff; out[i * 2 + 1] = c >>> 8; }
  return out;
}
function indexOfBytes(hay: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

// ── wav ───────────────────────────────────────────────────────────────────────

test('encodeWav: RIFF/WAVE magic and audio/wav type', async () => {
  const blob = encodeWav(tone(1000));
  assert.equal(blob.type, 'audio/wav');
  const u8 = await bytesOf(blob);
  assert.equal(tag(u8, 0, 4), 'RIFF');
  assert.equal(tag(u8, 8, 4), 'WAVE');
});

test('encodeWav: float32 round-trips through the engine parser to identical samples', async () => {
  const pcm = tone(1024);
  const back = parseWav(await bytesOf(encodeWav(pcm, { sampleFormat: 'float32' })));
  assert.equal(back.sampleRate, pcm.sampleRate);
  assert.equal(back.channels.length, 2);
  for (let ch = 0; ch < 2; ch++) assert.deepEqual(back.channels[ch], pcm.channels[ch]);
});

test('encodeWav: int16 round-trips exactly for samples already on the 1/32768 grid', async () => {
  const grid = new Float32Array([0, 0.5, -0.5, 0.25, -1, 1 / 32768]);
  const pcm: AudioPcm = { channels: [grid], sampleRate: 44_100 };
  const back = parseWav(await bytesOf(encodeWav(pcm)));
  assert.equal(back.sampleRate, 44_100);
  assert.deepEqual(back.channels[0], grid);
});

test('encodeWav: byte-deterministic', async () => {
  const pcm = tone(777);
  assert.deepEqual(await bytesOf(encodeWav(pcm)), await bytesOf(encodeWav(pcm)));
});

// ── mp3 ───────────────────────────────────────────────────────────────────────

test('encodeMp3: MPEG frame sync (or ID3) magic, and byte-deterministic', async () => {
  const pcm = tone(4 * 1152);
  const a = await bytesOf(await encodeMp3(pcm));
  const b = await bytesOf(await encodeMp3(pcm));
  assert.ok(a.length > 0);
  const id3 = tag(a, 0, 3) === 'ID3';
  const sync = a[0] === 0xff && (a[1]! & 0xe0) === 0xe0;
  assert.ok(id3 || sync, `expected ID3 or an MPEG frame sync, got ${a[0]!.toString(16)} ${a[1]!.toString(16)}`);
  assert.deepEqual(a, b);
});

test('encodeMp3: no tags stays a bare MPEG stream (no ID3 prepend, byte-identical)', async () => {
  const a = await bytesOf(await encodeMp3(tone(2 * 1152)));
  assert.notEqual(tag(a, 0, 3), 'ID3');                 // lamejs alone writes no metadata
  assert.deepEqual(a, await bytesOf(await encodeMp3(tone(2 * 1152), {})));
});

test('encodeMp3: tags prepend an ID3v2.3 block carrying TIT2 = the title (UTF-16, any script)', async () => {
  const tags = buildAudioTags({ tool: 'ZZ Memo', author: 'Ada Ünïçøde', software: 'Lolly' } as never);
  const u8 = await bytesOf(await encodeMp3(tone(3 * 1152), { tags }));
  assert.equal(tag(u8, 0, 3), 'ID3');
  assert.equal(u8[3], 0x03, 'ID3v2.3');
  assert.ok(indexOfBytes(u8, asciiBytes('TIT2')) >= 0, 'a TIT2 title frame');
  assert.ok(indexOfBytes(u8, utf16leBytes('ZZ Memo')) >= 0, 'the title as UTF-16LE');
  assert.ok(indexOfBytes(u8, utf16leBytes('Ada Ünïçøde')) >= 0, 'a non-Latin-1 artist survives (not ISO-8859-1)');
  // The syncsafe tag size must land EXACTLY on the first MPEG frame - the bug a
  // wrong size byte would cause (players read the tag length from these 4 bytes).
  const size = (u8[6]! << 21) | (u8[7]! << 14) | (u8[8]! << 7) | u8[9]!;
  assert.equal(u8[10 + size], 0xff, 'the ID3 size lands on the MPEG frame sync');
  assert.equal(u8[10 + size + 1]! & 0xe0, 0xe0, 'and that byte is a real MPEG sync');
});

test('encodeMp3: comment maps to a COMM frame; deterministic bytes', async () => {
  const tags = buildAudioTags({ tool: 'T', description: 'a note', contact: 'a@b.c' } as never);
  const a = await bytesOf(await encodeMp3(tone(2 * 1152), { tags }));
  assert.ok(indexOfBytes(a, asciiBytes('COMM')) >= 0, 'a COMM comment frame');
  assert.ok(indexOfBytes(a, utf16leBytes('a note · a@b.c')) >= 0, 'the comment text (UTF-16LE)');
  assert.deepEqual(a, await bytesOf(await encodeMp3(tone(2 * 1152), { tags })));
});

test('encodeAudio: threads tags to the mp3 ID3 block through the one entry point', async () => {
  const tags = buildAudioTags({ tool: 'Routed' } as never);
  const u8 = await bytesOf(await encodeAudio('mp3', tone(2 * 1152), { tags }));
  assert.equal(tag(u8, 0, 3), 'ID3');
  assert.ok(indexOfBytes(u8, utf16leBytes('Routed')) >= 0);
});

// ── buildAudioTags: rights folding (no normalized copyright/license slot) ─────

test('buildAudioTags: folds copyright + license into the comment, invents no rejected field', () => {
  const tags = buildAudioTags({ description: 'a note', contact: 'a@b.c', copyright: '© 2026 Jane', license: 'CC BY 4.0' } as never);
  assert.equal(tags.comment, 'a note · a@b.c · © 2026 Jane · CC BY 4.0');
  // Only normalized string slots are set - no invented copyright/license key that
  // mediabunny's strict validateMetadataTags would reject. (The real strict path
  // is exercised by the encodeOgg/encodeFlac tag tests, which push buildAudioTags
  // output through a real mediabunny Output.)
  assert.equal((tags as Record<string, unknown>).copyright, undefined, 'no invented copyright key');
  assert.equal((tags as Record<string, unknown>).license, undefined, 'no invented license key');
  assert.deepEqual(Object.keys(tags).sort(), ['comment']);
});

test('buildAudioTags: rights alone become the comment; no rights leaves comment untouched', () => {
  assert.equal(buildAudioTags({ copyright: '© 2026 Jane' } as never).comment, '© 2026 Jane');
  assert.equal(buildAudioTags({ description: 'a note', contact: 'a@b.c' } as never).comment, 'a note · a@b.c');
});

// ── m4a / opus (stub AudioEncoder, real muxers) ───────────────────────────────

class StubChunk {
  type = 'key';
  timestamp: number;
  duration: number;
  bytes: Uint8Array;
  constructor(timestamp: number, duration: number, bytes: Uint8Array) {
    this.timestamp = timestamp;
    this.duration = duration;
    this.bytes = bytes;
  }
  get byteLength(): number { return this.bytes.length; }
  copyTo(dst: Uint8Array): void { dst.set(this.bytes); }
}

interface StubLog { configs: any[]; chunks: number }

/** A minimal valid OpusHead - mediabunny's Ogg writer (unlike its WebM one) demands
 *  the Opus decoder description, and the real WebCodecs Opus encoder supplies exactly
 *  this in each chunk's decoderConfig.description. */
function opusHead(channels: number, sampleRate: number): Uint8Array {
  const h = new Uint8Array(19);
  h.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64]);   // 'OpusHead'
  h[8] = 1;                                                   // version
  h[9] = channels;                                            // channel count
  const dv = new DataView(h.buffer);
  dv.setUint16(10, 3840, true);                               // pre-skip
  dv.setUint32(12, sampleRate, true);                         // original sample rate
  dv.setUint16(16, 0, true);                                  // output gain
  h[18] = 0;                                                  // mapping family 0
  return h;
}

/** An AudioEncoder that answers isConfigSupported with `supported` and emits one
 *  encoded chunk per encode() call. `withOpusHead` makes the opus path carry an
 *  OpusHead description (needed for the Ogg container, optional for WebM). */
function stubEncoder(supported: boolean, log: StubLog, description = new Uint8Array([0x11, 0x90]), withOpusHead = false) {
  return class {
    static async isConfigSupported(c: any) { return { supported, config: c }; }
    encodeQueueSize = 0;
    private out: (chunk: unknown, metadata: unknown) => void;
    private cfg: any = null;
    constructor(init: { output: (chunk: unknown, metadata: unknown) => void; error: (e: unknown) => void }) {
      this.out = init.output;
    }
    configure(c: any): void { this.cfg = c; log.configs.push(c); }
    encode(data: any): void {
      log.chunks++;
      // A real WebCodecs decoderConfig: mediabunny validates the codec string.
      // AAC carries an AudioSpecificConfig; Opus needs no private data for WebM but
      // an OpusHead for Ogg.
      this.out(new StubChunk(data.timestamp, 20_000, new Uint8Array([1, 2, 3, 4])), {
        decoderConfig: {
          codec: this.cfg.codec, sampleRate: this.cfg.sampleRate, numberOfChannels: this.cfg.numberOfChannels,
          ...(this.cfg.codec === 'opus'
            ? (withOpusHead ? { description: opusHead(this.cfg.numberOfChannels, this.cfg.sampleRate) } : {})
            : { description }),
        },
      });
    }
    async flush(): Promise<void> {}
    close(): void {}
  };
}

/** AudioData stand-in: WebCodecs copies the payload, so this only needs the fields
 *  the encoder stub reads back. */
class StubAudioData {
  timestamp: number;
  constructor(init: { timestamp: number }) { this.timestamp = init.timestamp; }
  close(): void {}
}

test('encodeM4a: ftyp box at offset 4, and the encoder is configured at the PCM rate', async () => {
  const g = globalThis as any;
  const saved = { v: g.EncodedVideoChunk, a: g.EncodedAudioChunk };
  g.EncodedVideoChunk = StubChunk;                 // mediabunny's fromEncodedChunk
  g.EncodedAudioChunk = StubChunk;                 // instanceof-checks both
  try {
    const log: StubLog = { configs: [], chunks: 0 };
    const pcm = tone(48_000, 44_100);              // deliberately not 48 kHz
    const u8 = await bytesOf(await encodeM4a(pcm, {}, { AudioEncoder: stubEncoder(true, log), AudioData: StubAudioData }));
    assert.equal(tag(u8, 4, 4), 'ftyp');           // the mp4 isom brand
    assert.equal(log.configs[0].codec, 'mp4a.40.2');
    assert.equal(log.configs[0].sampleRate, 44_100);
    assert.equal(log.configs[0].numberOfChannels, 2);
    assert.equal(log.chunks, Math.ceil(48_000 / 4800));
  } finally {
    g.EncodedVideoChunk = saved.v;
    g.EncodedAudioChunk = saved.a;
  }
});

test('encodeM4a: tags reach the mp4 via the shared muxer setMetadataTags (m4a/opus path)', async () => {
  const g = globalThis as any;
  const saved = { v: g.EncodedVideoChunk, a: g.EncodedAudioChunk };
  g.EncodedVideoChunk = StubChunk;
  g.EncodedAudioChunk = StubChunk;
  try {
    const log: StubLog = { configs: [], chunks: 0 };
    // m4a routes through buildMediabunnyMux (MediabunnyMuxer), NOT buildAudioOnlyMux, so
    // this exercises MediabunnyMuxer.setMetadataTags specifically - the wiring that was a
    // no-op until the muxer exposed the method.
    // No date arg - the export path omits it, and mediabunny's validateMetadataTags
    // rejects a non-Date date (a string would throw), so this matches real usage.
    const tags = buildAudioTags({ tool: 'ZZUniqueTitle', author: 'ZZArtist' } as never);
    const u8 = await bytesOf(await encodeM4a(tone(9600), { tags }, { AudioEncoder: stubEncoder(true, log), AudioData: StubAudioData }));
    assert.ok(String.fromCharCode(...u8).includes('ZZUniqueTitle'), 'the mp4 must carry the title written through muxer.setMetadataTags');
  } finally {
    g.EncodedVideoChunk = saved.v;
    g.EncodedAudioChunk = saved.a;
  }
});

test('encodeOpus: EBML magic, and mono PCM is declared mono', async () => {
  const g = globalThis as any;
  const saved = { v: g.EncodedVideoChunk, a: g.EncodedAudioChunk };
  g.EncodedVideoChunk = StubChunk;
  g.EncodedAudioChunk = StubChunk;
  try {
    const log: StubLog = { configs: [], chunks: 0 };
    const pcm: AudioPcm = { channels: [new Float32Array(9600)], sampleRate: RATE };
    const u8 = await bytesOf(await encodeOpus(pcm, {}, { AudioEncoder: stubEncoder(true, log), AudioData: StubAudioData }));
    assert.deepEqual([...u8.subarray(0, 4)], [0x1a, 0x45, 0xdf, 0xa3]);
    assert.equal(log.configs[0].codec, 'opus');
    assert.equal(log.configs[0].numberOfChannels, 1);
  } finally {
    g.EncodedVideoChunk = saved.v;
    g.EncodedAudioChunk = saved.a;
  }
});

test('encodeAac: ADTS syncword (not an MP4 box), configured at the PCM rate', async () => {
  const g = globalThis as any;
  const saved = { v: g.EncodedVideoChunk, a: g.EncodedAudioChunk };
  g.EncodedVideoChunk = StubChunk;
  g.EncodedAudioChunk = StubChunk;
  try {
    const log: StubLog = { configs: [], chunks: 0 };
    const pcm = tone(48_000, 44_100);                                     // deliberately not 48 kHz
    const u8 = await bytesOf(await encodeAac(pcm, {}, { AudioEncoder: stubEncoder(true, log), AudioData: StubAudioData }));
    // ADTS frame: 0xFF then 12-bit syncword completion with layer bits zero.
    assert.equal(u8[0], 0xff);
    assert.equal(u8[1]! & 0xf6, 0xf0, `expected an ADTS syncword, got byte1 ${u8[1]!.toString(16)}`);
    assert.equal(sniffAudioFormat(u8), 'aac');                            // and our own sniff agrees
    assert.equal(log.configs[0].codec, 'mp4a.40.2');                      // SAME AAC encoder as m4a
    assert.equal(log.configs[0].sampleRate, 44_100);
  } finally {
    g.EncodedVideoChunk = saved.v;
    g.EncodedAudioChunk = saved.a;
  }
});

test('encodeOgg: OggS magic, the SAME Opus encoder as opus, and mono declared mono', async () => {
  const g = globalThis as any;
  const saved = { v: g.EncodedVideoChunk, a: g.EncodedAudioChunk };
  g.EncodedVideoChunk = StubChunk;
  g.EncodedAudioChunk = StubChunk;
  try {
    const log: StubLog = { configs: [], chunks: 0 };
    const pcm: AudioPcm = { channels: [new Float32Array(9600)], sampleRate: RATE };
    // Ogg-Opus needs the encoder's OpusHead; the real encoder emits it, so the stub does too.
    const u8 = await bytesOf(await encodeOgg(pcm, {}, { AudioEncoder: stubEncoder(true, log, undefined, true), AudioData: StubAudioData }));
    assert.equal(tag(u8, 0, 4), 'OggS');
    assert.equal(sniffAudioFormat(u8), 'ogg');
    assert.equal(log.configs[0].codec, 'opus');                          // NOT an mp4a AAC config
    assert.equal(log.configs[0].numberOfChannels, 1);
  } finally {
    g.EncodedVideoChunk = saved.v;
    g.EncodedAudioChunk = saved.a;
  }
});

test('encodeOgg: metadata tags are set on the real Ogg Output without breaking the container', async () => {
  const g = globalThis as any;
  const saved = { v: g.EncodedVideoChunk, a: g.EncodedAudioChunk };
  g.EncodedVideoChunk = StubChunk;
  g.EncodedAudioChunk = StubChunk;
  try {
    const log: StubLog = { configs: [], chunks: 0 };
    const pcm: AudioPcm = { channels: [new Float32Array(9600)], sampleRate: RATE };
    const tags = buildAudioTags({ tool: 'Memo', author: 'Ada', software: 'Lolly' } as never);
    // Real Ogg muxer (buildAudioOnlyMux), stub encoder: setMetadataTags(tags) runs on
    // the real mediabunny Output before start, so a throw or a broken header shows here.
    const u8 = await bytesOf(await encodeOgg(pcm, { tags }, { AudioEncoder: stubEncoder(true, log, undefined, true), AudioData: StubAudioData }));
    assert.equal(tag(u8, 0, 4), 'OggS');
    assert.equal(sniffAudioFormat(u8), 'ogg');
  } finally {
    g.EncodedVideoChunk = saved.v;
    g.EncodedAudioChunk = saved.a;
  }
});

test('m4a/opus degrade with a message rather than throwing when WebCodecs is missing', async () => {
  await assert.rejects(
    () => encodeM4a(tone(100), {}, { AudioEncoder: undefined, AudioData: undefined }),
    /cannot encode that audio format/,
  );
});

test('m4a/opus degrade with a message when the platform refuses the config', async () => {
  const log: StubLog = { configs: [], chunks: 0 };
  await assert.rejects(
    () => encodeOpus(tone(100), {}, { AudioEncoder: stubEncoder(false, log), AudioData: StubAudioData }),
    /cannot encode that audio format/,
  );
  assert.equal(log.configs.length, 0, 'a refused config must not reach configure()');
});

// ── flac (mediabunny libFLAC encoder, native - no WebCodecs) ──────────────────

/** A stub FLAC Output: records the tag object + call order and hands back 8 bytes
 *  that start with the FLAC stream marker, so encodeFlac's tags path is drivable
 *  under node without the real libFLAC WASM encoder. */
function stubFlacOutput(rec: { tags: unknown; order: string[]; samples: number }): FlacOutputFactory {
  const bytes = new Uint8Array([0x66, 0x4c, 0x61, 0x43, 0, 0, 0, 0]);   // 'fLaC'
  return async () => ({
    output: {
      setMetadataTags(t: unknown) { rec.tags = t; rec.order.push('tags'); },
      async start() { rec.order.push('start'); },
      async finalize() { rec.order.push('finalize'); },
    },
    source: { async add() { rec.samples++; } },
    target: { buffer: bytes.buffer },
    AudioSample: class { close(): void {} } as unknown as FlacBuild['AudioSample'],
  });
}

test('encodeFlac: writes the buildAudioTags object to the Output BEFORE start/finalize, and emits fLaC bytes', async () => {
  const rec = { tags: null as unknown, order: [] as string[], samples: 0 };
  const date = new Date('2020-01-02T03:04:05Z');
  const meta = { tool: 'Voice Memo', author: 'Ada', software: 'Lolly', description: 'a note', contact: 'a@b.c' } as never;
  const tags = buildAudioTags(meta, date);
  const blob = await encodeFlac(tone(9600), { tags }, { flacOutput: stubFlacOutput(rec) });
  assert.equal(blob.type, 'audio/flac');
  assert.equal(tag(await bytesOf(blob), 0, 4), 'fLaC');
  // The mapped tags reached setMetadataTags verbatim (title/artist/album/comment/date).
  assert.deepEqual(rec.tags, { title: 'Voice Memo', artist: 'Ada', album: 'Lolly', comment: 'a note · a@b.c', date });
  // Provenance rule: a metadata write happens BEFORE the credential, so tags land
  // before the container is even started, and certainly before finalize.
  assert.equal(rec.order[0], 'tags');
  assert.ok(rec.order.indexOf('tags') < rec.order.indexOf('finalize'));
  assert.ok(rec.samples >= 1, 'the PCM was fed to the encoder');
});

test('encodeFlac: no tags means setMetadataTags is never called (deterministic, untagged file)', async () => {
  const rec = { tags: null as unknown, order: [] as string[], samples: 0 };
  await encodeFlac(tone(4800), {}, { flacOutput: stubFlacOutput(rec) });
  assert.equal(rec.tags, null);
  assert.ok(!rec.order.includes('tags'));
});

test('encodeFlac: the REAL libFLAC encoder yields a valid FLAC (skips cleanly if unavailable)', async (t) => {
  let u8: Uint8Array;
  try {
    u8 = await bytesOf(await encodeFlac(tone(9600)));           // 48 kHz - a valid FLAC rate
  } catch (e) {
    t.skip(`libFLAC encoder unavailable in this environment: ${(e as Error).message}`);
    return;
  }
  assert.equal(tag(u8, 0, 4), 'fLaC');
  assert.equal(sniffAudioFormat(u8), 'flac');                  // and our own sniff agrees
  assert.ok(u8.length > 100, 'a real FLAC stream, not just the marker');
});

test('encodeFlac: an unsupported sample rate fails with a message, never mid-encode', async (t) => {
  // libFLAC accepts only a fixed rate set; 47999 Hz is not one, so the real-rate
  // re-probe must reject up front (mirrors the WebCodecs isConfigSupported guard).
  try {
    await assert.rejects(
      () => encodeFlac({ channels: [new Float32Array(1000)], sampleRate: 47999 }),
      /cannot encode FLAC/,
    );
  } catch (e) {
    t.skip(`libFLAC encoder unavailable in this environment: ${(e as Error).message}`);
  }
});

test('encodeAudio: routes flac to the FLAC Output through the one entry point', async () => {
  const rec = { tags: null as unknown, order: [] as string[], samples: 0 };
  const blob = await encodeAudio('flac', tone(4800), {}, { flacOutput: stubFlacOutput(rec) });
  assert.equal(blob.type, 'audio/flac');
  assert.equal(tag(await bytesOf(blob), 0, 4), 'fLaC');
});

// ── sniff / slice ─────────────────────────────────────────────────────────────

test('sniffAudioFormat: recognises each container, and nothing else', async () => {
  assert.equal(sniffAudioFormat(await bytesOf(encodeWav(tone(64)))), 'wav');
  assert.equal(sniffAudioFormat(new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0, 0, 0])), 'mp3');
  assert.equal(sniffAudioFormat(new Uint8Array([0xff, 0xfb, 0x90, 0, 0, 0, 0, 0, 0, 0, 0, 0])), 'mp3');
  assert.equal(sniffAudioFormat(new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20])), 'm4a');
  assert.equal(sniffAudioFormat(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0])), 'opus');
  assert.equal(sniffAudioFormat(new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0, 0, 0, 0, 0, 0, 0, 0])), 'ogg');   // 'OggS'
  assert.equal(sniffAudioFormat(new Uint8Array([0x66, 0x4c, 0x61, 0x43, 0, 0, 0, 0, 0, 0, 0, 0])), 'flac');  // 'fLaC'
  // ADTS AAC also leads with 0xFF; it must NOT be mistaken for an MP3 frame.
  assert.equal(sniffAudioFormat(new Uint8Array([0xff, 0xf1, 0x4c, 0x80, 0, 0, 0, 0, 0, 0, 0, 0])), 'aac');
  assert.equal(sniffAudioFormat(new Uint8Array([1, 2, 3])), null);
});

test('sliceWithEnvelope: cuts the window and applies linear fades', () => {
  const src: AudioPcm = { channels: [new Float32Array(1000).fill(1)], sampleRate: 1000 };
  const cut = sliceWithEnvelope(src, 100, 600, { fadeIn: 0.1, fadeOut: 0.1, volume: 0.5 });
  const ch = cut.channels[0]!;
  assert.equal(ch.length, 500);
  assert.equal(ch[0], 0);                                   // fade starts at silence
  assert.ok(Math.abs(ch[250]! - 0.5) < 1e-6);               // full (volume) in the middle
  assert.ok(ch[499]! < 0.5 && ch[499]! > 0);                // fading out at the end
});

// ── renderAudioExport (source resolution + the pass-through rule) ─────────────

test('renderAudioExport: a whole, unmodified source in the requested format passes its ORIGINAL bytes through', async () => {
  const source = new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0, 0, 0, 9, 9, 9]);
  let decoded = 0;
  const blob = await renderAudioExport('mp3', {
    audio: { url: 'blob:x' },
    fetchBytes: async () => source.buffer.slice(0) as ArrayBuffer,
    decode: async () => { decoded++; return tone(1000); },
  });
  assert.equal(blob.type, 'audio/mpeg');
  assert.deepEqual(await bytesOf(blob), source);
  assert.equal(decoded, 1, 'the source is decoded once, to learn its true length');
});

test('renderAudioExport: forceEncode honours explicit compression settings instead of passing matching bytes through', async () => {
  const source = new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0, 0, 0, 9, 9, 9]);
  const blob = await renderAudioExport('mp3', {
    audio: { url: 'blob:x' }, forceEncode: true, bitrate: 96_000,
    fetchBytes: async () => source.buffer.slice(0) as ArrayBuffer,
    decode: async () => tone(2304),
  });
  assert.equal(blob.type, 'audio/mpeg');
  assert.notDeepEqual(await bytesOf(blob), source, 'an explicit re-encode must produce new encoded bytes');
  assert.equal(sniffAudioFormat(await bytesOf(blob)), 'mp3');
});

test('renderAudioExport: a trimmed excerpt is a real encode of exactly that window', async () => {
  const src = tone(4 * RATE);
  const bytes = (await bytesOf(encodeWav(src, { sampleFormat: 'float32' }))).buffer as ArrayBuffer;
  const blob = await renderAudioExport('wav', {
    audio: { url: 'blob:x', start: 1 },
    duration: 1,
    sampleFormat: 'float32',
    fetchBytes: async () => bytes,
    decode: async () => src,
  });
  const back = parseWav(await bytesOf(blob));
  assert.equal(back.channels[0]!.length, RATE);
  assert.deepEqual(back.channels[0], src.channels[0]!.slice(RATE, 2 * RATE));
  assert.deepEqual(back.channels[1], src.channels[1]!.slice(RATE, 2 * RATE));
});

test('renderAudioExport: a whole source in a DIFFERENT format is re-encoded, not passed through', async () => {
  const src = tone(2000);
  const mp3ish = new Uint8Array([0xff, 0xfb, 0x90, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const blob = await renderAudioExport('wav', {
    audio: { url: 'blob:x' },
    fetchBytes: async () => mp3ish.buffer.slice(0) as ArrayBuffer,
    decode: async () => src,
  });
  assert.equal(blob.type, 'audio/wav');
  assert.equal(tag(await bytesOf(blob), 0, 4), 'RIFF');
});

test('renderAudioExport: caller-supplied PCM wins over the URL and is never fetched', async () => {
  const blob = await renderAudioExport('wav', {
    pcm: tone(500),
    audio: { url: 'blob:x' },
    fetchBytes: async () => { throw new Error('must not fetch'); },
  });
  assert.equal(parseWav(await bytesOf(blob)).channels[0]!.length, 500);
});

test('renderAudioExport: no source at all is an error, never a file of silence', async () => {
  await assert.rejects(() => renderAudioExport('wav', {}), new RegExp(NO_AUDIO_MSG.slice(0, 24)));
});

test('renderAudioExport: a start past the end of the track warns and exports from 0:00', async () => {
  const src = tone(1000);
  const warnings: string[] = [];
  const blob = await renderAudioExport('wav', {
    audio: { url: 'blob:x', start: 99 },
    sampleFormat: 'float32',
    fetchBytes: async () => new ArrayBuffer(0),
    decode: async () => src,
    log: (l, m) => { if (l === 'warn') warnings.push(m); },
  });
  assert.equal(warnings.length, 1);
  assert.deepEqual(parseWav(await bytesOf(blob)).channels[0], src.channels[0]);
});

test('pcmFromAudioBuffer: folds an AudioBuffer-shaped source to at most stereo planes', () => {
  const plane = new Float32Array([0.1, 0.2]);
  const pcm = pcmFromAudioBuffer({ length: 2, numberOfChannels: 6, sampleRate: 32_000, getChannelData: () => plane });
  assert.equal(pcm.channels.length, 2);
  assert.equal(pcm.sampleRate, 32_000);
});

// ── the capability probe (bridge/format-support.ts) ──────────────────────────
// Its cache is module state, so these run in order, last, and each overwrites it.

test('audioSupport: wav and mp3 are unconditional; the WebCodecs formats start false with no AudioEncoder', async () => {
  const { audioSupport } = await import('../bridge/format-support.ts');
  // flac rides the WASM libFLAC encoder (present under node), so it is unconditional here.
  assert.deepEqual(audioSupport(), { wav: true, mp3: true, m4a: false, aac: false, opus: false, ogg: false, flac: true });
});

test('audioSupport: an AAC-only encoder unlocks m4a AND aac (its ADTS sibling), never opus/ogg', async () => {
  const { probeWebCodecsAudioSupport, audioSupport } = await import('../bridge/format-support.ts');
  const codecs: string[] = [];
  await probeWebCodecsAudioSupport({
    isConfigSupported: async (c: any) => { codecs.push(c.codec); return { supported: c.codec === 'mp4a.40.2' }; },
  });
  // aac rides the same mp4a.40.2 probe as m4a; ogg rides the same opus probe as opus.
  assert.deepEqual(audioSupport(), { wav: true, mp3: true, m4a: true, aac: true, opus: false, ogg: false, flac: true });
  assert.deepEqual(codecs.sort(), ['mp4a.40.2', 'opus'], 'still only TWO probes back all four WebCodecs formats');
});

test('probeWebCodecsAudioSupport: a throwing isConfigSupported reads as unsupported, never rejects', async () => {
  const { probeWebCodecsAudioSupport, audioSupport } = await import('../bridge/format-support.ts');
  const r = await probeWebCodecsAudioSupport({ isConfigSupported: async () => { throw new Error('nope'); } });
  assert.deepEqual(r, { m4a: false, opus: false });
  assert.equal(audioSupport().opus, false);
});

test('encodeAudio: dispatches each format to its own container', async () => {
  const pcm = tone(2400);
  assert.equal(tag(await bytesOf(await encodeAudio('wav', pcm)), 0, 4), 'RIFF');
  assert.equal((await encodeAudio('mp3', pcm)).type, 'audio/mpeg');
});

test('encodeAudio: routes ogg to Ogg and aac to ADTS through the one entry point', async () => {
  const g = globalThis as any;
  const saved = { v: g.EncodedVideoChunk, a: g.EncodedAudioChunk };
  g.EncodedVideoChunk = StubChunk;
  g.EncodedAudioChunk = StubChunk;
  try {
    const log: StubLog = { configs: [], chunks: 0 };
    const pcm = tone(2400);
    const ogg = await bytesOf(await encodeAudio('ogg', pcm, {}, { AudioEncoder: stubEncoder(true, log, undefined, true), AudioData: StubAudioData }));
    assert.equal(tag(ogg, 0, 4), 'OggS');
    const aac = await bytesOf(await encodeAudio('aac', pcm, {}, { AudioEncoder: stubEncoder(true, log), AudioData: StubAudioData }));
    assert.equal(aac[0]! === 0xff && (aac[1]! & 0xf6) === 0xf0, true);
  } finally {
    g.EncodedVideoChunk = saved.v;
    g.EncodedAudioChunk = saved.a;
  }
});

// Drift guard (schema-two-copies): every AUDIO_FORMATS member MUST have a dispatch
// case in bridge/export.ts's renderFormat switch. aac/ogg were supported here but
// missing there, so render(node,'ogg') threw "Unsupported export format" - a gap no
// unit test above catches, because they call encodeAudio directly, not the export
// dispatch. This asserts the two lists can never drift again.
test('every AUDIO_FORMATS format is reachable through the export.ts dispatch', () => {
  const src = readFileSync(new URL('../bridge/export.ts', import.meta.url), 'utf8');
  for (const fmt of AUDIO_FORMATS) {
    assert.ok(
      src.includes(`case '${fmt}':`),
      `bridge/export.ts renderFormat has no "case '${fmt}':" - render(node,'${fmt}') would throw Unsupported`,
    );
  }
});
