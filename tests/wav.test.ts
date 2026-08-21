// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packWav, parseWav } from '../engine/src/wav.ts';

/**
 * Build a WAV file byte-for-byte. `write` receives a DataView over the data chunk
 * and the bytes-per-sample so each depth's test can fill it in its own format.
 */
function wav(opts: {
  tag?: number;
  channels?: number;
  sampleRate?: number;
  bits?: number;
  frames: number;
  write?: (view: DataView, bytesPerSample: number, channels: number) => void;
  /** Insert an unknown chunk before `fmt ` - the real-world case (LIST/INFO tags). */
  extraChunk?: string;
  /** Emit a WAVE_FORMAT_EXTENSIBLE fmt chunk carrying `tag` in its GUID. */
  extensible?: boolean;
}): Uint8Array {
  const tag = opts.tag ?? 1;
  const channels = opts.channels ?? 1;
  const sampleRate = opts.sampleRate ?? 44100;
  const bits = opts.bits ?? 16;
  const bps = bits >> 3;
  const dataLen = opts.frames * bps * channels;
  const fmtLen = opts.extensible ? 40 : 16;
  const extraLen = opts.extraChunk ? 8 + 4 : 0;
  const total = 12 + 8 + fmtLen + extraLen + 8 + dataLen;

  const u8 = new Uint8Array(total);
  const v = new DataView(u8.buffer);
  const put = (at: number, s: string): void => {
    for (let i = 0; i < s.length; i++) u8[at + i] = s.charCodeAt(i);
  };

  put(0, 'RIFF');
  v.setUint32(4, total - 8, true);
  put(8, 'WAVE');

  let at = 12;
  if (opts.extraChunk) {
    put(at, opts.extraChunk);
    v.setUint32(at + 4, 4, true);
    at += 12;
  }
  put(at, 'fmt ');
  v.setUint32(at + 4, fmtLen, true);
  v.setUint16(at + 8, opts.extensible ? 0xfffe : tag, true);
  v.setUint16(at + 10, channels, true);
  v.setUint32(at + 12, sampleRate, true);
  v.setUint32(at + 16, sampleRate * bps * channels, true); // byte rate
  v.setUint16(at + 20, bps * channels, true); // block align
  v.setUint16(at + 22, bits, true);
  if (opts.extensible) {
    v.setUint16(at + 24, 22, true); // cbSize
    v.setUint16(at + 26, bits, true); // valid bits
    v.setUint32(at + 28, 0, true); // channel mask
    v.setUint16(at + 32, tag, true); // the real format tag, first 2 bytes of the GUID
  }
  at += 8 + fmtLen;

  put(at, 'data');
  v.setUint32(at + 4, dataLen, true);
  const dataAt = at + 8;
  if (opts.write) opts.write(new DataView(u8.buffer, dataAt, dataLen), bps, channels);
  return u8;
}

test('16-bit PCM mono decodes to normalised floats', () => {
  const u8 = wav({
    frames: 4,
    write: (v) => {
      v.setInt16(0, 0, true);
      v.setInt16(2, 16384, true);
      v.setInt16(4, -16384, true);
      v.setInt16(6, 32767, true);
    },
  });
  const { channels, sampleRate } = parseWav(u8);
  assert.equal(sampleRate, 44100);
  assert.equal(channels.length, 1);
  assert.equal(channels[0]!.length, 4);
  assert.equal(channels[0]![0], 0);
  assert.ok(Math.abs(channels[0]![1]! - 0.5) < 1e-6);
  assert.ok(Math.abs(channels[0]![2]! + 0.5) < 1e-6);
  assert.ok(Math.abs(channels[0]![3]! - 1) < 1e-4);
});

test('stereo interleaving is de-interleaved into separate channels', () => {
  const u8 = wav({
    channels: 2,
    frames: 3,
    write: (v) => {
      // L, R, L, R, L, R
      const vals = [8192, -8192, 16384, -16384, 32767, -32768];
      vals.forEach((n, i) => v.setInt16(i * 2, n, true));
    },
  });
  const { channels } = parseWav(u8);
  assert.equal(channels.length, 2);
  assert.equal(channels[0]!.length, 3);
  assert.ok(channels[0]!.every((s) => s > 0), 'left is all positive');
  assert.ok(channels[1]!.every((s) => s < 0), 'right is all negative');
});

test('8-bit PCM is unsigned with 128 as silence', () => {
  const u8 = wav({
    bits: 8,
    frames: 3,
    write: (v) => {
      v.setUint8(0, 128);
      v.setUint8(1, 255);
      v.setUint8(2, 0);
    },
  });
  const { channels } = parseWav(u8);
  assert.equal(channels[0]![0], 0);
  assert.ok(channels[0]![1]! > 0.99);
  assert.equal(channels[0]![2], -1);
});

test('24-bit PCM sign-extends correctly', () => {
  const u8 = wav({
    bits: 24,
    frames: 3,
    write: (v) => {
      const put24 = (at: number, n: number): void => {
        const x = n < 0 ? n + 0x1000000 : n;
        v.setUint8(at, x & 0xff);
        v.setUint8(at + 1, (x >> 8) & 0xff);
        v.setUint8(at + 2, (x >> 16) & 0xff);
      };
      put24(0, 0);
      put24(3, 4194304); // +0.5
      put24(6, -4194304); // −0.5
    },
  });
  const { channels } = parseWav(u8);
  assert.equal(channels[0]![0], 0);
  assert.ok(Math.abs(channels[0]![1]! - 0.5) < 1e-6);
  assert.ok(Math.abs(channels[0]![2]! + 0.5) < 1e-6, `expected −0.5, got ${channels[0]![2]}`);
});

test('32-bit PCM and 32-bit float both decode', () => {
  const pcm = parseWav(wav({
    bits: 32,
    frames: 2,
    write: (v) => {
      v.setInt32(0, 1073741824, true); // +0.5
      v.setInt32(4, -1073741824, true);
    },
  }));
  assert.ok(Math.abs(pcm.channels[0]![0]! - 0.5) < 1e-6);
  assert.ok(Math.abs(pcm.channels[0]![1]! + 0.5) < 1e-6);

  const flt = parseWav(wav({
    tag: 3,
    bits: 32,
    frames: 2,
    write: (v) => {
      v.setFloat32(0, 0.25, true);
      v.setFloat32(4, -0.75, true);
    },
  }));
  assert.ok(Math.abs(flt.channels[0]![0]! - 0.25) < 1e-6);
  assert.ok(Math.abs(flt.channels[0]![1]! + 0.75) < 1e-6);
});

test('a float WAV hotter than full scale is passed through, not clamped', () => {
  const { channels } = parseWav(wav({
    tag: 3,
    bits: 32,
    frames: 1,
    write: (v) => v.setFloat32(0, 1.4, true),
  }));
  assert.ok(Math.abs(channels[0]![0]! - 1.4) < 1e-6, 'a hot master still reads hot');
});

test('WAVE_FORMAT_EXTENSIBLE resolves its real format tag from the GUID', () => {
  const { channels } = parseWav(wav({
    tag: 3, // float, hidden behind 0xfffe
    extensible: true,
    bits: 32,
    frames: 1,
    write: (v) => v.setFloat32(0, 0.5, true),
  }));
  // Read as integer PCM this would be a meaningless near-zero, not 0.5.
  assert.ok(Math.abs(channels[0]![0]! - 0.5) < 1e-6);
});

test('an unknown chunk before fmt is skipped, not fatal', () => {
  const { channels } = parseWav(wav({
    extraChunk: 'LIST',
    frames: 2,
    write: (v) => {
      v.setInt16(0, 16384, true);
      v.setInt16(2, 16384, true);
    },
  }));
  assert.equal(channels[0]!.length, 2);
});

// ─── Untrusted input ──────────────────────────────────────────────────────────

test('non-WAV and truncated input is refused by name', () => {
  assert.throws(() => parseWav(new Uint8Array(0)), /too short/);
  assert.throws(() => parseWav(new Uint8Array(64)), /not a RIFF/);
  const good = wav({ frames: 8, write: (v) => v.setInt16(0, 1000, true) });
  assert.throws(() => parseWav(good.subarray(0, 20)), /too short|not a RIFF|truncated|no data/);
});

test('a compressed payload in a RIFF skin is refused, never read as PCM', () => {
  // 0x0011 = IMA ADPCM. Read as PCM this would decode to full-scale noise, which as
  // an audiogram would look like a perfectly plausible loud track.
  assert.throws(() => parseWav(wav({ tag: 0x0011, frames: 4 })), /unsupported format tag/);
  assert.throws(() => parseWav(wav({ tag: 7, frames: 4 })), /µ-law|A-law|companded/);
  assert.throws(() => parseWav(wav({ tag: 6, frames: 4 })), /µ-law|A-law|companded/);
});

test('a lying chunk size cannot read past the buffer or loop forever', () => {
  const u8 = wav({ frames: 4, write: (v) => v.setInt16(0, 1000, true) });
  const v = new DataView(u8.buffer);

  // data chunk claiming far more than the file holds → decode what is actually there.
  const big = u8.slice();
  new DataView(big.buffer).setUint32(12 + 8 + 16 + 4, 0xffff_0000, true);
  const decoded = parseWav(big);
  assert.ok(decoded.channels[0]!.length > 0 && decoded.channels[0]!.length <= 4);

  // fmt chunk declaring size 0 → the walk must still terminate.
  const zero = u8.slice();
  new DataView(zero.buffer).setUint32(16, 0, true);
  assert.throws(() => parseWav(zero), /fmt|channel count|no data|sample rate/);

  // A size that overflows 32 bits must not walk backwards.
  const wrap = u8.slice();
  new DataView(wrap.buffer).setUint32(16, 0xffff_ffff, true);
  assert.throws(() => parseWav(wrap), /truncated|no data|fmt/);
  assert.equal(v.getUint32(4, true), u8.byteLength - 8, 'fixture RIFF size is sane');
});

test('absurd channel counts and bit depths are refused', () => {
  assert.throws(() => parseWav(wav({ channels: 0, frames: 4 })), /channel count/);
  assert.throws(() => parseWav(wav({ channels: 64, frames: 4 })), /channel count/);
  assert.throws(() => parseWav(wav({ bits: 12, frames: 4 })), /bit depth/);
  assert.throws(() => parseWav(wav({ tag: 3, bits: 16, frames: 4 })), /float bit depth/);
  assert.throws(() => parseWav(wav({ sampleRate: 0, frames: 4 })), /sample rate/);
});

test('a data chunk with no complete frame is refused', () => {
  // 2 channels × 16-bit = 4 bytes a frame; declare 2 bytes of data.
  const u8 = wav({ channels: 2, frames: 1 });
  new DataView(u8.buffer).setUint32(12 + 8 + 16 + 4, 2, true);
  assert.throws(() => parseWav(u8), /no complete frames/);
});

test('fuzz: random bytes never crash the parser in an unexpected way', () => {
  // Deterministic PRNG so a failure reproduces.
  let s = 20260728;
  const rnd = (): number => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < 400; i++) {
    const n = 8 + Math.floor(rnd() * 200);
    const u8 = new Uint8Array(n);
    for (let b = 0; b < n; b++) u8[b] = Math.floor(rnd() * 256);
    // Half the cases get a valid RIFF/WAVE preamble so the walk is actually entered.
    if (i % 2 === 0 && n >= 44) {
      const put = (at: number, str: string): void => {
        for (let k = 0; k < str.length; k++) u8[at + k] = str.charCodeAt(k);
      };
      put(0, 'RIFF');
      put(8, 'WAVE');
    }
    try {
      const out = parseWav(u8);
      assert.ok(out.channels.length > 0 && out.sampleRate > 0, `case ${i} returned a degenerate result`);
      for (const ch of out.channels) {
        assert.ok(ch.every((x) => Number.isFinite(x)), `case ${i} produced non-finite samples`);
      }
    } catch (err) {
      assert.ok(err instanceof Error && /^wav: /.test(err.message), `case ${i} threw an unowned error: ${String(err)}`);
    }
  }
});

// ---------------------------------------------------------------------------
// packWav - the writer half. parseWav is the oracle: whatever we write, the
// reader above must get back.
// ---------------------------------------------------------------------------

const ascii = (u8: Uint8Array, at: number, n: number): string =>
  Array.from(u8.subarray(at, at + n), (b) => String.fromCharCode(b)).join('');

test('packWav round-trips 16-bit mono through parseWav', () => {
  // Values on the 1/32768 grid, so int16 quantisation is a no-op and the
  // comparison can be exact rather than approximate.
  const src = new Float32Array([0, 0.5, -0.5, 1024 / 32768, -1 / 32768]);
  const out = parseWav(packWav({ channels: [src], sampleRate: 48000 }));
  assert.equal(out.sampleRate, 48000);
  assert.equal(out.channels.length, 1);
  assert.deepEqual(Array.from(out.channels[0]!), Array.from(src));
});

test('packWav round-trips 16-bit stereo, keeping channels distinct', () => {
  const left = new Float32Array([0.25, -0.25, 0]);
  const right = new Float32Array([-0.75, 0.75, 0.5]);
  const out = parseWav(packWav({ channels: [left, right], sampleRate: 44100 }));
  assert.equal(out.channels.length, 2);
  assert.deepEqual(Array.from(out.channels[0]!), Array.from(left));
  assert.deepEqual(Array.from(out.channels[1]!), Array.from(right));
});

test('packWav round-trips float32 mono bit-exactly', () => {
  // Deliberately NOT on the int16 grid - the point of the float path is that
  // nothing is quantised.
  const src = new Float32Array([0, 0.1, -0.1, 1 / 3, -0.0000001]);
  const bytes = packWav({ channels: [src], sampleRate: 22050 }, { format: 'float32' });
  const out = parseWav(bytes);
  assert.equal(out.sampleRate, 22050);
  assert.deepEqual(Array.from(out.channels[0]!), Array.from(src));
});

test('packWav round-trips float32 stereo', () => {
  const left = new Float32Array([0.1, -0.2]);
  const right = new Float32Array([1 / 3, -1 / 7]);
  const out = parseWav(packWav({ channels: [left, right], sampleRate: 8000 }, { format: 'float32' }));
  assert.equal(out.channels.length, 2);
  assert.deepEqual(Array.from(out.channels[0]!), Array.from(left));
  assert.deepEqual(Array.from(out.channels[1]!), Array.from(right));
});

test('packWav writes exact 16-bit header bytes (RIFF sizes are an off-by-8 trap)', () => {
  const u8 = packWav({ channels: [new Float32Array([0, 0.5]), new Float32Array([0, -0.5])], sampleRate: 44100 });
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  assert.equal(u8.byteLength, 44 + 2 * 2 * 2); // 44-byte header + 2 frames x 2ch x 2 bytes
  assert.equal(ascii(u8, 0, 4), 'RIFF');
  assert.equal(v.getUint32(4, true), u8.byteLength - 8); // NOT the file length
  assert.equal(ascii(u8, 8, 4), 'WAVE');
  assert.equal(ascii(u8, 12, 4), 'fmt ');
  assert.equal(v.getUint32(16, true), 16);      // PCM fmt chunk size
  assert.equal(v.getUint16(20, true), 1);       // wFormatTag = WAVE_FORMAT_PCM
  assert.equal(v.getUint16(22, true), 2);       // nChannels
  assert.equal(v.getUint32(24, true), 44100);   // nSamplesPerSec
  assert.equal(v.getUint32(28, true), 44100 * 4); // nAvgBytesPerSec
  assert.equal(v.getUint16(32, true), 4);       // nBlockAlign
  assert.equal(v.getUint16(34, true), 16);      // wBitsPerSample
  assert.equal(ascii(u8, 36, 4), 'data');
  assert.equal(v.getUint32(40, true), 8);       // data payload only
  // Interleaved: frame 0 = L,R then frame 1 = L,R.
  assert.equal(v.getInt16(44, true), 0);
  assert.equal(v.getInt16(46, true), 0);
  assert.equal(v.getInt16(48, true), 16384);
  assert.equal(v.getInt16(50, true), -16384);
});

test('packWav float32 carries the spec-required cbSize and fact chunk', () => {
  const u8 = packWav({ channels: [new Float32Array([0.5])], sampleRate: 48000 }, { format: 'float32' });
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  assert.equal(u8.byteLength, 58 + 4);
  assert.equal(v.getUint32(4, true), u8.byteLength - 8);
  assert.equal(ascii(u8, 12, 4), 'fmt ');
  assert.equal(v.getUint32(16, true), 18);      // extended fmt: 16 + cbSize
  assert.equal(v.getUint16(20, true), 3);       // wFormatTag = WAVE_FORMAT_IEEE_FLOAT
  assert.equal(v.getUint16(34, true), 32);      // wBitsPerSample
  assert.equal(v.getUint16(36, true), 0);       // cbSize: no extension follows
  assert.equal(ascii(u8, 38, 4), 'fact');
  assert.equal(v.getUint32(42, true), 4);
  assert.equal(v.getUint32(46, true), 1);       // dwSampleLength = frames
  assert.equal(ascii(u8, 50, 4), 'data');
  assert.equal(v.getUint32(54, true), 4);
  assert.equal(v.getFloat32(58, true), 0.5);
});

test('packWav accepts a 0-sample buffer; parseWav refuses to read it back', () => {
  const u8 = packWav({ channels: [new Float32Array(0)], sampleRate: 44100 });
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  assert.equal(u8.byteLength, 44);          // a complete, valid header
  assert.equal(v.getUint32(4, true), 36);
  assert.equal(v.getUint32(40, true), 0);   // empty data chunk
  // Documented policy: an empty decode is a worse answer than an error.
  assert.throws(() => parseWav(u8), /no complete frames/);
});

test('packWav clips int16 output rather than wrapping', () => {
  // POLICY: out-of-range input clamps to -1..1 before scaling. Symmetric x32768
  // with a 32767 ceiling, so +1.0 comes back as 0.99997 and -1.0 is exact.
  const u8 = packWav({ channels: [new Float32Array([2, -2, 1, -1, 1.0001])], sampleRate: 8000 });
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  assert.equal(v.getInt16(44, true), 32767);
  assert.equal(v.getInt16(46, true), -32768);
  assert.equal(v.getInt16(48, true), 32767);
  assert.equal(v.getInt16(50, true), -32768);
  assert.equal(v.getInt16(52, true), 32767);
  const back = parseWav(u8).channels[0]!;
  assert.ok(back.every((x) => x >= -1 && x <= 1), 'clipped output must stay in range');
  assert.equal(back[3], -1);
});

test('packWav float32 does NOT clip - a hot master stays hot', () => {
  const src = new Float32Array([2, -2]);
  const out = parseWav(packWav({ channels: [src], sampleRate: 8000 }, { format: 'float32' }));
  assert.deepEqual(Array.from(out.channels[0]!), [2, -2]);
});

test('packWav is byte-deterministic', () => {
  const make = (): Float32Array => new Float32Array([0.1, -0.2, 0.3, 0.4]);
  const audio = { channels: [make(), make()], sampleRate: 32000 };
  assert.deepEqual(packWav(audio), packWav(audio));
  assert.deepEqual(
    packWav(audio, { format: 'float32' }),
    packWav({ channels: [make(), make()], sampleRate: 32000 }, { format: 'float32' }),
  );
});

test('packWav negative control: different samples produce different bytes', () => {
  const a = packWav({ channels: [new Float32Array([0.5, 0.25])], sampleRate: 8000 });
  const b = packWav({ channels: [new Float32Array([0.5, 0.26])], sampleRate: 8000 });
  assert.equal(a.byteLength, b.byteLength);
  assert.notDeepEqual(a, b);
  // Rate and channel layout are in the header, so those differ too.
  assert.notDeepEqual(a, packWav({ channels: [new Float32Array([0.5, 0.25])], sampleRate: 8001 }));
});

test('packWav rejects input it cannot honestly encode', () => {
  assert.throws(() => packWav({ channels: [], sampleRate: 44100 }), /channel count/);
  assert.throws(
    () => packWav({ channels: [new Float32Array(2), new Float32Array(3)], sampleRate: 44100 }),
    /differ in length/,
  );
  assert.throws(() => packWav({ channels: [new Float32Array(2)], sampleRate: 0 }), /sample rate/);
  assert.throws(() => packWav({ channels: [new Float32Array(2)], sampleRate: 44100.5 }), /sample rate/);
});

// ── Chunk-walking under provenance chunks (C2PA + LIST/INFO) ─────────────────
// A generated clip now carries a top-level C2PA chunk and LIST/INFO tags
// (engine c2pa-containers placeWav + riff-meta embedWavInfo). The parser walks
// chunks rather than assuming fmt-then-data adjacency, so a headless analyse
// (CLI/MCP audiogram renders through packages/node-shell) must read the exact
// same numbers off the extended file as off the bare one.

test('C2PA + LIST/INFO chunks do not change a headless analyse by one bit', async () => {
  const { embedC2pa } = await import('../engine/src/c2pa.ts');
  const { embedWavInfo } = await import('../engine/src/riff-meta.ts');
  const { createNodeAudioAPI } = await import('../packages/node-shell/src/audio.ts');
  const { fileURLToPath } = await import('node:url');
  const repoRoot = fileURLToPath(new URL('..', import.meta.url));

  const bare = wav({
    frames: 2048,
    sampleRate: 24000,
    write: (v) => {
      for (let i = 0; i < 2048; i++) v.setInt16(i * 2, Math.round(Math.sin(i / 8) * 20000), true);
    },
  });
  const extended = await embedC2pa(
    embedWavInfo(bare, { title: 'Clip', comment: 'Synthetic voice' }),
    'wav',
    { title: 'Clip', claimGenerator: 'Lolly lolly.tools' },
  );
  assert.ok(extended.length > bare.length, 'the extended file really carries extra chunks');

  const audio = createNodeAudioAPI({ repoRoot });
  const a = await audio.analyse(bare, { fps: 10 });
  const b = await audio.analyse(extended, { fps: 10 });
  assert.deepEqual(JSON.parse(JSON.stringify(b)), JSON.parse(JSON.stringify(a)), 'identical analysis through the extra chunks');
});
