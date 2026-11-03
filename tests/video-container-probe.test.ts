// SPDX-License-Identifier: MPL-2.0
/**
 * Fixtures for the video container probe are built here, byte by byte, from the
 * published layouts (ISO/IEC 14496-12 boxes, SMPTE ST 377-1 KLV). They hold
 * container headers and sample entries only: no compressed frames.
 *
 * Optional cross-check on a machine with ffmpeg (nothing here depends on it):
 *   ffmpeg -f lavfi -i color=c=black:s=64x64:r=25 -frames:v 2 -c:v prores_ks -profile:v 3 x.mov
 *   ffmpeg -f lavfi -i color=c=black:s=64x64:r=25 -frames:v 2 -c:v dnxhd -profile:v dnxhr_hq -pix_fmt yuv422p x.mxf
 * then probeVideoContainer(bytesProbeSource(readFileSync(...))) names the same codec.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bytesProbeSource, formatTimecode, probeVideoContainer, VideoProbeError,
} from '../engine/src/video-container-probe.ts';

const cat = (...p: Uint8Array[]): Uint8Array => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };
const be32 = (n: number): Uint8Array => Uint8Array.of((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
const be16 = (n: number): Uint8Array => Uint8Array.of((n >>> 8) & 255, n & 255);
const ascii = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0));
const zeros = (n: number): Uint8Array => new Uint8Array(n);
const box = (type: string, ...body: Uint8Array[]): Uint8Array => { const b = cat(...body); return cat(be32(8 + b.length), ascii(type), b); };
const full = (type: string, ...body: Uint8Array[]): Uint8Array => box(type, zeros(4), ...body);

function videoEntry(code: string, w: number, h: number, ...kids: Uint8Array[]): Uint8Array {
  return box(code, zeros(6), be16(1), zeros(16), be16(w), be16(h), be32(0x480000), be32(0x480000), zeros(4), be16(1), zeros(32), be16(24), be16(0xffff), ...kids);
}
function audioEntry(code: string, ch: number, bits: number, rate: number, ...kids: Uint8Array[]): Uint8Array {
  return box(code, zeros(6), be16(1), zeros(8), be16(ch), be16(bits), zeros(4), be32(rate * 65536), ...kids);
}
function trak(handler: string, entry: Uint8Array, opts: { scale?: number; deltas?: Array<[number, number]>; extra?: Uint8Array[] } = {}): Uint8Array {
  const scale = opts.scale ?? 25000;
  const stts = opts.deltas ? full('stts', be32(opts.deltas.length), ...opts.deltas.map(([c, d]) => cat(be32(c), be32(d)))) : zeros(0);
  const stbl = box('stbl', full('stsd', be32(1), entry), stts, ...(opts.extra ?? []));
  return box('trak', box('mdia', full('mdhd', zeros(8), be32(scale), be32(scale * 2), zeros(4)), full('hdlr', zeros(4), ascii(handler), zeros(12)), box('minf', stbl)));
}
function movie(brand: string, ...traks: Uint8Array[]): Uint8Array {
  const mvhd = full('mvhd', zeros(8), be32(1000), be32(2000), zeros(80));
  return cat(box('ftyp', ascii(brand), be32(0), ascii(brand)), box('mdat', zeros(16)), box('moov', mvhd, ...traks));
}
const probe = (b: Uint8Array) => probeVideoContainer(bytesProbeSource(b));

test('ProRes 422 HQ in a MOV is named with profile, size and rate', async () => {
  const p = await probe(movie('qt  ', trak('vide', videoEntry('apch', 1920, 1080), { deltas: [[50, 1000]], scale: 25000 })));
  assert.equal(p?.container, 'mov');
  assert.equal(p?.video[0]?.family, 'prores');
  assert.equal(p?.video[0]?.profile, '422 HQ');
  assert.equal(p?.video[0]?.label, 'Apple ProRes 422 HQ');
  assert.equal(p?.video[0]?.width, 1920);
  assert.equal(p?.video[0]?.frameRate, 25);
  assert.equal(p?.video[0]?.patentPool, true);
  assert.equal(p?.durationSeconds, 2);
});

test('ProRes 4444 and every profile code', async () => {
  for (const [code, profile] of [['apco', 'Proxy'], ['apcs', 'LT'], ['apcn', '422'], ['ap4h', '4444'], ['ap4x', '4444 XQ']] as const) {
    const p = await probe(movie('qt  ', trak('vide', videoEntry(code, 64, 64))));
    assert.equal(p?.video[0]?.profile, profile);
  }
});

test('H.264 and HEVC give WebCodecs strings from their config records', async () => {
  const avcC = box('avcC', Uint8Array.of(1, 100, 0, 40, 0xff, 0xe0));
  const h = await probe(movie('isom', trak('vide', videoEntry('avc1', 1280, 720, avcC))));
  assert.equal(h?.container, 'mp4');
  assert.equal(h?.video[0]?.webcodecs, 'avc1.640028');
  assert.equal(h?.video[0]?.profile, 'High');
  const hvcC = box('hvcC', Uint8Array.of(1, 1, 0x60, 0, 0, 0, 0x90, 0, 0, 0, 0, 0, 93, 0xf0, 0, 0xfc, 0xfd, 0xfa, 0xfa));
  const e = await probe(movie('isom', trak('vide', videoEntry('hvc1', 3840, 2160, hvcC))));
  assert.equal(e?.video[0]?.family, 'hevc');
  assert.match(e?.video[0]?.webcodecs ?? '', /^hvc1\.1\.6\.L93\.90$/);
});

test('AV1 and DNx sample entries', async () => {
  const av1C = box('av1C', Uint8Array.of(0x81, 0x08, 0x4c, 0));
  const a = await probe(movie('isom', trak('vide', videoEntry('av01', 640, 360, av1C))));
  assert.equal(a?.video[0]?.webcodecs, 'av01.0.08M.10');
  assert.equal(a?.video[0]?.patentPool, false);
  const d = await probe(movie('qt  ', trak('vide', videoEntry('AVdh', 1920, 1080))));
  assert.equal(d?.video[0]?.family, 'dnx');
  assert.equal(d?.video[0]?.webcodecs, null);
});

test('audio tracks: AAC with esds, PCM, channels and rate', async () => {
  const esds = full('esds', Uint8Array.of(3, 25, 0, 1, 0, 4, 17, 0x40, 0x15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 2, 0x12, 0x10));
  const p = await probe(movie('isom',
    trak('vide', videoEntry('apcn', 64, 64)),
    trak('soun', audioEntry('mp4a', 2, 16, 48000, esds)),
    trak('soun', audioEntry('sowt', 8, 16, 48000))));
  assert.equal(p?.audio.length, 2);
  assert.deepEqual([p?.audio[0]?.label, p?.audio[0]?.webcodecs, p?.audio[0]?.channels, p?.audio[0]?.sampleRate], ['AAC', 'mp4a.40.2', 2, 48000]);
  assert.equal(p?.audio[0]?.patentPool, true);
  assert.deepEqual([p?.audio[1]?.codec, p?.audio[1]?.channels, p?.audio[1]?.patentPool], ['pcm', 8, false]);
});

test('timecode track: start frame, drop frame', async () => {
  const tmcdEntry = box('tmcd', zeros(6), be16(1), zeros(4), be32(1), be32(30000), be32(1001), Uint8Array.of(30, 0));
  const moovLess = movie('qt  ', trak('tmcd', tmcdEntry, { extra: [full('stco', be32(1), be32(0))] }));
  // the sample sits in mdat: patch the first four mdat payload bytes to frame 1800
  const bytes = moovLess.slice();
  const at = 8 + 12 + 8;
  bytes.set(be32(1800), at);
  // chunk offset: ftyp is 8+4+4+4 = 20 bytes, then the mdat header is 8 more
  const p = await probe(patchStco(bytes, 28));
  assert.equal(p?.timecode, '00:01:00;02');
});
function patchStco(b: Uint8Array, offset: number): Uint8Array {
  const out = b.slice();
  for (let i = 0; i + 8 < out.length; i++) {
    if (out[i] === 0x73 && out[i + 1] === 0x74 && out[i + 2] === 0x63 && out[i + 3] === 0x6f) { out.set(be32(offset), i + 12); return out; }
  }
  throw new Error('no stco');
}

test('formatTimecode', () => {
  assert.equal(formatTimecode(90, 25, false), '00:00:03:15');
  assert.equal(formatTimecode(1800, 30, true), '00:01:00;02');
  assert.equal(formatTimecode(17982, 30, true), '00:10:00;00');
  assert.equal(formatTimecode(-1, 25, false), null);
});

// ── MXF ──
const PFX = [0x06, 0x0e, 0x2b, 0x34];
const ul = (...rest: number[]): Uint8Array => Uint8Array.from([...PFX, ...rest]);
const ber = (n: number): Uint8Array => cat(Uint8Array.of(0x83), Uint8Array.of((n >> 16) & 255, (n >> 8) & 255, n & 255));
const klv = (key: Uint8Array, value: Uint8Array): Uint8Array => cat(key, ber(value.length), value);
const tag = (t: number, v: Uint8Array): Uint8Array => cat(be16(t), be16(v.length), v);
const rat = (n: number, d: number): Uint8Array => cat(be32(n), be32(d));
const set = (kind: number, ...tags: Uint8Array[]): Uint8Array => klv(ul(0x02, 0x53, 0x01, 0x01, 0x0d, 0x01, 0x01, 0x01, 0x01, 0x01, kind, 0x00), cat(...tags));
function partition(headerBytes: number, op: number[]): Uint8Array {
  // major, minor, KAG, this, previous, footer, header byte count, index byte count, index SID, body offset, body SID, pattern, essence batch
  const pack = cat(be16(1), be16(3), be32(1), zeros(24), zeros(4), be32(headerBytes), zeros(8), zeros(4), zeros(8), zeros(4), ul(...op), be32(0), be32(16));
  return klv(ul(0x02, 0x05, 0x01, 0x01, 0x0d, 0x01, 0x02, 0x01, 0x01, 0x02, 0x04, 0x00), pack);
}
function mxf(picture: Uint8Array, opts: { opA?: boolean; layoutExtra?: Uint8Array[]; sound?: boolean; runIn?: number } = {}): Uint8Array {
  const meta = cat(
    set(0x28, tag(0x3c0a, zeros(16)), tag(0x3203, be32(1920)), tag(0x3202, be32(1080)), tag(0x3001, rat(25, 1)), tag(0x3201, picture), tag(0x3301, be32(10)), tag(0x3002, cat(zeros(4), be32(50)))),
    ...(opts.sound ? [set(0x48, tag(0x3d03, rat(48000, 1)), tag(0x3d07, be32(2)), tag(0x3d01, be32(24)))] : []),
    set(0x14, tag(0x1501, cat(zeros(4), be32(90000))), tag(0x1502, be16(25)), tag(0x1503, Uint8Array.of(0))),
  );
  const op = opts.opA === false ? [0x04, 0x01, 0x01, 0x09, 0x0d, 0x01, 0x02, 0x01, 0x10, 0x00, 0x00, 0x00] : [0x04, 0x01, 0x01, 0x09, 0x0d, 0x01, 0x02, 0x01, 0x01, 0x01, 0x00, 0x00];
  return cat(zeros(opts.runIn ?? 0), partition(meta.length, op), meta);
}
const vc3 = (cid: number): Uint8Array => ul(0x04, 0x01, 0x01, 0x0a, 0x04, 0x01, 0x02, 0x02, 0x71, cid - 1234, 0, 0);
const proresUl = (profile: number): Uint8Array => ul(0x04, 0x01, 0x01, 0x0d, 0x04, 0x01, 0x02, 0x02, 0x03, 0x06, profile, 0);

test('OP1a MXF with DNxHR HQ: codec, size, rate, timecode, audio', async () => {
  const p = await probe(mxf(vc3(1272), { sound: true }));
  assert.equal(p?.container, 'mxf');
  assert.equal(p?.brand, 'OP1a');
  assert.equal(p?.video[0]?.family, 'dnx');
  assert.equal(p?.video[0]?.profile, 'DNxHR HQ');
  assert.equal(p?.video[0]?.width, 1920);
  assert.equal(p?.video[0]?.frameRate, 25);
  assert.equal(p?.video[0]?.bitDepth, 10);
  assert.equal(p?.timecode, '01:00:00:00');
  assert.equal(p?.durationSeconds, 2);
  assert.deepEqual([p?.audio[0]?.channels, p?.audio[0]?.sampleRate, p?.audio[0]?.bitDepth], [2, 48000, 24]);
});

test('DNxHD CID, ProRes in MXF, OP-Atom and a run-in', async () => {
  assert.equal((await probe(mxf(vc3(1237))))?.video[0]?.profile, 'DNxHD CID 1237');
  assert.equal((await probe(mxf(proresUl(4))))?.video[0]?.label, 'Apple ProRes 422 HQ');
  const atom = await probe(mxf(vc3(1274), { opA: false, runIn: 100 }));
  assert.equal(atom?.brand, 'OP-Atom');
  assert.equal(atom?.video[0]?.profile, 'DNxHR LB');
});

test('not a video container answers null', async () => {
  assert.equal(await probe(ascii('hello world, this is text')), null);
  assert.equal(await probe(new Uint8Array(4)), null);
});

test('malformed and truncated input is refused with a code', async () => {
  const good = movie('qt  ', trak('vide', videoEntry('apch', 64, 64)));
  await assert.rejects(probe(good.subarray(0, good.length - 20)), VideoProbeError);
  const bad = good.slice();
  bad.set(be32(0x7fffffff), 0);
  await assert.rejects(probe(bad), (e: unknown) => e instanceof VideoProbeError);
  const m = mxf(vc3(1272));
  await assert.rejects(probe(m.subarray(0, m.length - 30)), VideoProbeError);
});

test('every truncation of a valid file either probes or throws VideoProbeError', async () => {
  for (const file of [movie('qt  ', trak('vide', videoEntry('ap4h', 64, 64), { deltas: [[10, 1000]] })), mxf(proresUl(5), { sound: true })]) {
    for (let n = 0; n < file.length; n += 3) {
      try { await probe(file.subarray(0, n)); } catch (e) { assert.ok(e instanceof VideoProbeError, String(e)); }
    }
  }
});
