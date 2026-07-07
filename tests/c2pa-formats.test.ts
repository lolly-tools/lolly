/**
 * Multi-format C2PA embed → verify round-trips.
 * Run with: node --test tests/c2pa-formats.test.ts
 *
 * One minimal hand-built container per format (structure-valid: enough
 * chunk/segment/IFD grammar for the embedder and verifier — pixel data is not
 * decoded by either). Each format round-trips through embedC2pa → verifyC2pa,
 * then takes a byte-flip outside the manifest to prove the hard binding
 * catches content tamper in that container. c2patool (the c2pa-rs CLI) is the
 * external ground truth for these embeddings — see the byte-recipe comments in
 * engine/src/c2pa.js; these tests keep the loop closed offline.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { embedC2pa, C2PA_FORMATS } from '../engine/src/c2pa.ts';
import { verifyC2pa, sniffFormat } from '../engine/src/c2pa-verify.ts';
import { packTiff } from '../engine/src/tiff.ts';

const bytesOf = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
const u32be = (n: number): Uint8Array => Uint8Array.of(n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
const u32le = (n: number): Uint8Array => Uint8Array.of(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff);

// CRC-32 for PNG chunk assembly (fixture-side only).
const CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (b: Uint8Array): number => { let c = 0xffffffff; for (const x of b) c = CRC_T[(c ^ x) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const pngChunk = (type: string, data: Uint8Array): Uint8Array => {
  const td = concat([bytesOf(type), data]);
  return concat([u32be(data.length), td, u32be(crc32(td))]);
};

function tinyPng(): Uint8Array {
  // 1×1 grayscale; IDAT = zlib stored block (filter byte + 1 pixel byte).
  const ihdr = Uint8Array.of(0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0, 0, 0);
  const idat = Uint8Array.of(0x78, 0x01, 0x01, 0x02, 0x00, 0xfd, 0xff, 0x00, 0x7b, 0x00, 0x7c, 0x00, 0xf8);
  return concat([Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10), pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', new Uint8Array(0))]);
}

function tinyJpeg(): Uint8Array {
  // SOI + JFIF APP0 + EOI — segment grammar only, no scan data.
  const app0 = concat([Uint8Array.of(0xff, 0xe0, 0x00, 0x10), bytesOf('JFIF\0'), Uint8Array.of(1, 1, 0, 0, 1, 0, 1, 0, 0)]);
  return concat([Uint8Array.of(0xff, 0xd8), app0, Uint8Array.of(0xff, 0xd9)]);
}

function tinyGif({ gct = false }: { gct?: boolean } = {}): Uint8Array {
  // Header + LSD (+ optional 2-entry GCT) + trailer; no frames needed.
  const packed = gct ? 0x80 : 0x00; // GCT flag, size bits 000 → 2 entries
  return concat([
    bytesOf('GIF87a'),
    Uint8Array.of(1, 0, 1, 0, packed, 0, 0),
    gct ? Uint8Array.of(0, 0, 0, 255, 255, 255) : new Uint8Array(0),
    Uint8Array.of(0x3b),
  ]);
}

const tinySvg = (): Uint8Array => bytesOf('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#30ba78"/></svg>');

const tinyTiff = (): Uint8Array => packTiff(Uint8Array.of(48, 186, 120), { width: 1, height: 1, samplesPerPixel: 3, dpi: 72 });

function tinyWebp(): Uint8Array {
  const vp8 = concat([bytesOf('VP8 '), u32le(2), Uint8Array.of(0, 0)]);
  const body = concat([bytesOf('WEBP'), vp8]);
  return concat([bytesOf('RIFF'), u32le(body.length), body]);
}

// MP4: ftyp + moov(mvhd) + mdat — the same synthetic shape video-meta.test.js
// uses. Neither the embedder nor c2patool decodes samples; box grammar is all
// the BMFF binding hashes.
const mp4box = (type: string, ...parts: Uint8Array[]): Uint8Array => { const p = concat(parts); return concat([u32be(8 + p.length), bytesOf(type), p]); };
const tinyMp4 = (): Uint8Array => concat([
  mp4box('ftyp', bytesOf('isom'), u32be(0x200), bytesOf('isommp42')),
  mp4box('moov', mp4box('mvhd', new Uint8Array(100))),
  mp4box('mdat', bytesOf('fake-video-payload')),
]);

// WebM fixtures (EBML). eb() emits id + minimal size VINT + payload.
const ebVint = (n: number): Uint8Array => {
  let w = 1;
  while (w < 8 && n > 2 ** (7 * w) - 2) w++;
  const out = new Uint8Array(w);
  let v = n;
  for (let i = w - 1; i >= 0; i--) { out[i] = v & 0xff; v = Math.floor(v / 256); }
  out[0] = out[0]! | (0x80 >> (w - 1));
  return out;
};
const eb = (id: number[], payload: Uint8Array): Uint8Array => concat([Uint8Array.from(id), ebVint(payload.length), payload]);
const EBML_HEAD = concat([Uint8Array.of(0x1a, 0x45, 0xdf, 0xa3, 0x84), eb([0x42, 0x86], Uint8Array.of(1))]);
const SEG_ID = Uint8Array.of(0x18, 0x53, 0x80, 0x67);
const UNKNOWN_8 = Uint8Array.of(0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff);

// Finalised recording (what a MediaRecorder blob is once Chrome closes it):
// known-size Segment with SeekHead + reserved Void + Info + Cluster + Cues.
// The Segment size is a 2-byte VINT so the in-place patch has headroom.
function tinyWebm(): Uint8Array {
  const seek = (id: number[], pos: number): Uint8Array => eb([0x4d, 0xbb], concat([eb([0x53, 0xab], Uint8Array.from(id)), eb([0x53, 0xac], Uint8Array.of(pos))]));
  const payload = concat([
    eb([0x11, 0x4d, 0x9b, 0x74], concat([seek([0x15, 0x49, 0xa9, 0x66], 60), seek([0x1c, 0x53, 0xbb, 0x6b], 100)])),
    concat([Uint8Array.of(0xec, 0x80 | 40), new Uint8Array(40)]), // reserved Void
    eb([0x15, 0x49, 0xa9, 0x66], new Uint8Array(10)),             // Info
    eb([0x1f, 0x43, 0xb6, 0x75], bytesOf('fake-cluster-data')),   // Cluster
    eb([0x1c, 0x53, 0xbb, 0x6b], new Uint8Array(8)),              // Cues
  ]);
  return concat([EBML_HEAD, SEG_ID, Uint8Array.of(0x40 | (payload.length >> 8), payload.length & 0xff), payload]);
}

// Streaming shape (a live MediaRecorder chunk): unknown-size Segment, no
// index, unknown-size Cluster running to EOF.
const tinyWebmStreaming = (): Uint8Array => concat([
  EBML_HEAD, SEG_ID, UNKNOWN_8,
  eb([0x15, 0x49, 0xa9, 0x66], new Uint8Array(6)),
  Uint8Array.of(0x1f, 0x43, 0xb6, 0x75), UNKNOWN_8, bytesOf('live-cluster-bytes'),
]);

const OPTS = {
  title: 'Fixture',
  claimGenerator: 'Lolly lolly.tools',
  generatorInfo: { name: 'Lolly', version: '1.9.0' },
  environment: { tool: 'Fixture Tool', format: '', surface: 'test', engine: 'node', os: 'test' },
  author: { name: 'Testy McTestface' },
};

const CASES: Array<[string, Uint8Array]> = [
  ['png', tinyPng()],
  ['apng', tinyPng()],
  ['jpg', tinyJpeg()],
  ['gif', tinyGif()],
  ['svg', tinySvg()],
  ['tiff', tinyTiff()],
  ['cmyk-tiff', tinyTiff()],
  ['webp', tinyWebp()],
  ['mp4', tinyMp4()],
  ['webm', tinyWebm()],
];

for (const [fmt, fixture] of CASES) {
  test(`${fmt}: embed → verify round-trip, then tamper breaks the binding`, async () => {
    assert.ok(C2PA_FORMATS.includes(fmt), `${fmt} is declared stampable`);
    const out = await embedC2pa(fixture, fmt, { ...OPTS, environment: { ...OPTS.environment, format: fmt } });
    const report = await verifyC2pa(out);
    assert.equal(report.state, 'valid', JSON.stringify(report.checks));
    assert.equal(report.madeWithLolly, true);
    assert.equal(report.environment?.format, fmt);
    assert.equal(report.author?.name, 'Testy McTestface');
    assert.equal(report.claim?.generatorInfo?.name, 'Lolly');

    // Flip one byte of the ORIGINAL container content (never the inserted
    // manifest block): the hard binding must fail, nothing else. mp4 carries
    // the BMFF binding, everything else the byte-range data hash.
    const tampered = out.slice();
    const target = fixtureTamperOffset(fmt, fixture, out);
    tampered[target] = tampered[target]! ^ 0x01;
    const broken = await verifyC2pa(tampered);
    assert.equal(broken.state, 'invalid', `${fmt} tamper at ${target}`);
    const wantCode = fmt === 'mp4' ? 'assertion.bmffHash.mismatch' : 'assertion.dataHash.mismatch';
    assert.ok(broken.checks.some((c) => c.code === wantCode && !c.ok), JSON.stringify(broken.checks));
  });
}

// A byte guaranteed to be original content in the stamped file: the LAST byte
// of the output equals the last byte of every fixture container here (all
// placers insert before the trailer except tiff/webp, which append — for those
// the FIRST content byte past the header is used). The video placers append
// too, but keep every original offset: a byte near the fixture's end lands
// inside mdat / the Cues payload — hashed original content in both bindings.
function fixtureTamperOffset(fmt: string, fixture: Uint8Array, out: Uint8Array): number {
  if (fmt === 'tiff' || fmt === 'cmyk-tiff' || fmt === 'webp') return 20;
  if (fmt === 'mp4' || fmt === 'webm') return fixture.length - 3;
  return out.length - 1;
}

test('gif with a global color table keeps the preamble intact', async () => {
  const out = await embedC2pa(tinyGif({ gct: true }), 'gif', OPTS);
  assert.equal(out[4], 0x39, 'version forced to 89a');
  const report = await verifyC2pa(out);
  assert.equal(report.state, 'valid');
});

test('jpeg manifests over 64000 bytes split into APP11 segments and reassemble', async () => {
  const big = { ...OPTS, environment: { ...OPTS.environment, blob: 'x'.repeat(70000) } };
  const out = await embedC2pa(tinyJpeg(), 'jpg', big);
  const report = await verifyC2pa(out);
  assert.equal(report.state, 'valid', JSON.stringify(report.checks.filter((c) => !c.ok)));
  assert.equal((report.environment!.blob as string).length, 70000);
});

test('svg with an existing metadata element gains the manifest inside it', async () => {
  const svg = bytesOf('<svg xmlns="http://www.w3.org/2000/svg"><metadata><x/></metadata><rect/></svg>');
  const out = await embedC2pa(svg, 'svg', OPTS);
  const text = new TextDecoder().decode(out);
  assert.match(text, /<metadata><c2pa:manifest>[A-Za-z0-9+/=]+<\/c2pa:manifest><x\/><\/metadata>/);
  assert.match(text, /xmlns:c2pa="http:\/\/c2pa\.org\/manifest"/);
  assert.equal((await verifyC2pa(out)).state, 'valid');
});

test('re-stamping replaces the credential instead of stacking a second one', async () => {
  for (const [fmt, fixture] of [['png', tinyPng()], ['gif', tinyGif()], ['webp', tinyWebp()], ['jpg', tinyJpeg()], ['svg', tinySvg()], ['mp4', tinyMp4()], ['webm', tinyWebm()]] as Array<[string, Uint8Array]>) {
    const once = await embedC2pa(fixture, fmt, OPTS);
    const twice = await embedC2pa(once, fmt, { ...OPTS, title: 'Second Pass' });
    const report = await verifyC2pa(twice);
    assert.equal(report.state, 'valid', `${fmt} re-stamp`);
    assert.equal(report.claim?.title, 'Second Pass', `${fmt} newest credential wins`);
  }
});

test('sniffFormat identifies every container', () => {
  assert.equal(sniffFormat(tinyPng()), 'png');
  assert.equal(sniffFormat(tinyJpeg()), 'jpeg');
  assert.equal(sniffFormat(tinyGif()), 'gif');
  assert.equal(sniffFormat(tinySvg()), 'svg');
  assert.equal(sniffFormat(tinyTiff()), 'tiff');
  assert.equal(sniffFormat(tinyWebp()), 'webp');
  assert.equal(sniffFormat(tinyMp4()), 'mp4');
  assert.equal(sniffFormat(tinyWebm()), 'webm');
  assert.equal(sniffFormat(bytesOf('%PDF-1.4 minimal........')), 'pdf');
  assert.equal(sniffFormat(bytesOf('no container at all here')), null);
});

// ─── video containers (mp4 = BMFF binding, webm = Matroska attachment) ────────

test('mp4: manifest rides in a trailing C2PA uuid box; original boxes never move', async () => {
  const fixture = tinyMp4();
  const out = await embedC2pa(fixture, 'mp4', OPTS);
  // Every original byte is a prefix: no stco/co64 offset can have gone stale.
  assert.deepEqual(out.subarray(0, fixture.length), fixture);
  // Independent walk: last top-level box is a uuid box with the C2PA usertype.
  const readU32 = (b: Uint8Array, o: number): number => (b[o]! << 24 | b[o + 1]! << 16 | b[o + 2]! << 8 | b[o + 3]!) >>> 0;
  let off = 0, last: number | null = null;
  while (off < out.length) { last = off; off += readU32(out, off); }
  assert.equal(String.fromCharCode(...out.subarray(last! + 4, last! + 8)), 'uuid');
  const usertype = Array.from(out.subarray(last! + 8, last! + 24), (b) => b.toString(16).padStart(2, '0')).join('');
  assert.equal(usertype, 'd8fec3d61b0e483c92975828877ec481');
  assert.equal(String.fromCharCode(...out.subarray(last! + 28, last! + 36)), 'manifest');
});

test('webm: attachment is SeekHead-indexed via the reserved Void, no byte moves', async () => {
  const fixture = tinyWebm();
  const out = await embedC2pa(fixture, 'webm', OPTS);
  assert.equal((await verifyC2pa(out)).state, 'valid');
  // The Void absorbed the new Seek entry, so nothing shifted: the Cluster's
  // payload sits at the same absolute offset as in the fixture.
  const indexOfBytes = (hay: Uint8Array, needle: Uint8Array): number => {
    outer: for (let i = 0; i + needle.length <= hay.length; i++) {
      for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
      return i;
    }
    return -1;
  };
  assert.equal(indexOfBytes(out, bytesOf('fake-cluster-data')), indexOfBytes(fixture, bytesOf('fake-cluster-data')));
  // SeekHead now carries an Attachments entry (SeekID 0x1941A469).
  assert.notEqual(indexOfBytes(out, Uint8Array.of(0x53, 0xab, 0x84, 0x19, 0x41, 0xa4, 0x69)), -1);
});

test('webm: streaming (unknown-size, unindexed) gets the attachment before the first Cluster', async () => {
  const fixture = tinyWebmStreaming();
  const out = await embedC2pa(fixture, 'webm', OPTS);
  const report = await verifyC2pa(out);
  assert.equal(report.state, 'valid', JSON.stringify(report.checks));
  const indexOfBytes = (hay: Uint8Array, needle: Uint8Array): number => {
    outer: for (let i = 0; i + needle.length <= hay.length; i++) {
      for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
      return i;
    }
    return -1;
  };
  const attachments = indexOfBytes(out, Uint8Array.of(0x19, 0x41, 0xa4, 0x69));
  const cluster = indexOfBytes(out, Uint8Array.of(0x1f, 0x43, 0xb6, 0x75));
  assert.ok(attachments !== -1 && attachments < cluster, 'attachment sits before the first Cluster');

  // Tamper the (shifted) cluster bytes — the data hash must catch it.
  const tampered = out.slice();
  tampered[out.length - 1] = tampered[out.length - 1]! ^ 0x01;
  assert.equal((await verifyC2pa(tampered)).state, 'invalid');
});

test('mp4/webm: truncated or malformed containers neither hang nor throw out of verifyC2pa', async () => {
  const cases: Array<[string, Uint8Array]> = [
    ['mp4', concat([u32be(100), bytesOf('ftypisom')])],                   // box size overruns EOF
    ['mp4', concat([u32be(1), bytesOf('ftyp'), u32be(0)])],               // 64-bit largesize, truncated
    ['webm', concat([EBML_HEAD, SEG_ID, Uint8Array.of(0x41, 0x00), bytesOf('x')])], // Segment size overruns EOF
    ['webm', concat([EBML_HEAD, SEG_ID, Uint8Array.of(0x84), Uint8Array.of(0x00, 0x00, 0x00, 0x00)])], // zero id byte
  ];
  for (const [fmt, bytes] of cases) {
    const report = await verifyC2pa(bytes);
    assert.equal(report.state, 'invalid', `${fmt} → ${report.state}`);
    assert.equal(report.checks[0]!.code, 'credential.unreadable');
    await assert.rejects(() => embedC2pa(bytes, fmt, OPTS), /malformed|truncated|not an MP4|not a WebM/i);
  }
  // Wrong container for the format key throws cleanly too.
  await assert.rejects(() => embedC2pa(tinyPng(), 'mp4', OPTS), /not an MP4|malformed/i);
  await assert.rejects(() => embedC2pa(tinyPng(), 'webm', OPTS), /not a WebM/i);
});

test('mkv DocType sniffs as mkv and takes the same attachment', async () => {
  const headPayload = eb([0x42, 0x82], bytesOf('matroska'));
  const mkvHead = concat([Uint8Array.of(0x1a, 0x45, 0xdf, 0xa3), ebVint(headPayload.length), headPayload]);
  const fixture = concat([mkvHead, SEG_ID, UNKNOWN_8, eb([0x15, 0x49, 0xa9, 0x66], new Uint8Array(6))]);
  assert.equal(sniffFormat(fixture), 'mkv');
  const out = await embedC2pa(fixture, 'webm', OPTS);
  const report = await verifyC2pa(out);
  assert.equal(report.format, 'mkv');
  assert.equal(report.state, 'valid', JSON.stringify(report.checks));
});

// ── review-hardening regressions (video) ──────────────────────────────────────

test('mp4: a non-trailing C2PA uuid box (c2patool placement) is refused, never silently corrupted', async () => {
  // c2patool writes its uuid box right after ftyp and patches stco/co64;
  // stripping it without that patching would shift mdat and break playback
  // while still verifying Valid. The placer must throw instead.
  const uuid = concat([
    u32be(8 + 16 + 4 + 9 + 8 + 4), bytesOf('uuid'),
    Uint8Array.of(0xd8, 0xfe, 0xc3, 0xd6, 0x1b, 0x0e, 0x48, 0x3c, 0x92, 0x97, 0x58, 0x28, 0x87, 0x7e, 0xc4, 0x81),
    new Uint8Array(4), bytesOf('manifest\0'), new Uint8Array(8), bytesOf('fake'),
  ]);
  const parts = tinyMp4();
  const withMidUuid = concat([parts.subarray(0, 24), uuid, parts.subarray(24)]); // after ftyp (24 bytes)
  await assert.rejects(() => embedC2pa(withMidUuid, 'mp4', OPTS), /not the last box/);
});

test('mp4: a to-EOF (size 0) last box is finalised so the credential stays discoverable', async () => {
  const sized = tinyMp4();
  const zeroed = sized.slice();
  // mdat is the last box: zero its size field → "extends to end of file"
  const mdatOff = sized.length - (8 + 'fake-video-payload'.length);
  zeroed.set(u32be(0), mdatOff);
  const out = await embedC2pa(zeroed, 'mp4', OPTS);
  const report = await verifyC2pa(out);
  assert.equal(report.state, 'valid', JSON.stringify(report.checks));
  // the size field was rewritten to the real extent
  assert.deepEqual(Array.from(out.subarray(mdatOff, mdatOff + 4)), Array.from(u32be(8 + 'fake-video-payload'.length)));
});

test('webm: crafted oversized Attachments size VINT neither hangs nor corrupts', async () => {
  // Attachments element declaring ~2^42 bytes in a 40-byte file: the byte-scan
  // must clamp to the file end (a near-infinite loop escapes try/catch).
  const bogus = concat([
    EBML_HEAD, SEG_ID, UNKNOWN_8,
    Uint8Array.of(0x19, 0x41, 0xa4, 0x69), Uint8Array.of(0x01, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00),
    bytesOf('xyz'),
  ]);
  await assert.rejects(() => embedC2pa(bogus, 'webm', OPTS), /already has attachments|malformed|unsupported/);
  const report = await verifyC2pa(bogus);
  assert.equal(report.state, 'invalid');
});

test('webm: unknown-size Segment with an index anywhere is refused (positions would go stale)', async () => {
  // Known-size Clusters followed by Cues, inside an unknown-size Segment: the
  // guard must look past the first Cluster.
  const shape = concat([
    EBML_HEAD, SEG_ID, UNKNOWN_8,
    eb([0x15, 0x49, 0xa9, 0x66], new Uint8Array(6)),          // Info
    eb([0x1f, 0x43, 0xb6, 0x75], bytesOf('cluster-one')),     // Cluster (known size)
    eb([0x1f, 0x43, 0xb6, 0x75], bytesOf('cluster-two')),     // Cluster (known size)
    eb([0x1c, 0x53, 0xbb, 0x6b], new Uint8Array(8)),          // Cues
  ]);
  await assert.rejects(() => embedC2pa(shape, 'webm', OPTS), /unknown-size Segment with an index/);
});

test('webm: a file that already has (foreign) attachments is refused', async () => {
  const cover = eb([0x19, 0x41, 0xa4, 0x69], eb([0x61, 0xa7], concat([
    eb([0x46, 0x6e], bytesOf('cover.jpg')),
    eb([0x46, 0x60], bytesOf('image/jpeg')),
    eb([0x46, 0xae], Uint8Array.of(7)),
    eb([0x46, 0x5c], bytesOf('jpegbytes')),
  ])));
  const payload = concat([eb([0x15, 0x49, 0xa9, 0x66], new Uint8Array(6)), cover]);
  const known = concat([EBML_HEAD, SEG_ID, Uint8Array.of(0x40 | (payload.length >> 8), payload.length & 0xff), payload]);
  await assert.rejects(() => embedC2pa(known, 'webm', OPTS), /already has attachments/);
  const streaming = concat([EBML_HEAD, SEG_ID, UNKNOWN_8, cover]);
  await assert.rejects(() => embedC2pa(streaming, 'webm', OPTS), /already has attachments/);
});

test('webm: EOF append is refused when an unmeasurable element would hide it', async () => {
  // Unknown-size NON-Cluster child: an attachment appended past it would be
  // invisible to the verifier's child walk — better no credential than a
  // silently unverifiable one.
  const shape = concat([
    EBML_HEAD, SEG_ID, UNKNOWN_8,
    Uint8Array.of(0x12, 0x54, 0xc3, 0x67), UNKNOWN_8, bytesOf('tag-soup'), // unknown-size Tags
  ]);
  await assert.rejects(() => embedC2pa(shape, 'webm', OPTS), /unmeasurable Segment tail/);
});

test('avif/heic sniff as unrecognised, not mp4', () => {
  const avif = concat([u32be(24), bytesOf('ftyp'), bytesOf('avif'), u32be(0), bytesOf('avifmif1')]);
  assert.equal(sniffFormat(avif), null);
  const heic = concat([u32be(24), bytesOf('ftyp'), bytesOf('heic'), u32be(0), bytesOf('mif1heic')]);
  assert.equal(sniffFormat(heic), null);
});

const which = (tool: string): boolean => spawnSync('which', [tool], { encoding: 'utf8' }).status === 0;

test('c2patool validates the mp4 BMFF binding end-to-end', { skip: !which('c2patool') && 'c2patool not installed' }, async (t) => {
  const out = await embedC2pa(tinyMp4(), 'mp4', OPTS);
  const file = join(mkdtempSync(join(tmpdir(), 'c2pa-')), 'stamped.mp4');
  writeFileSync(file, out);
  const res = spawnSync('c2patool', [file], { encoding: 'utf8' });
  const text = ((res.stdout || '') + (res.stderr || '')).trim();
  t.diagnostic(`c2patool exit ${res.status}`);
  assert.match(text, /"validation_state":\s*"Valid"/, `c2patool did not validate the BMFF binding: ${text.slice(0, 2000)}`);
  assert.match(text, /assertion\.bmffHash\.match/, 'BMFF hash was not checked');
});

// ─── review-hardening regressions ────────────────────────────────────────────
// /valid accepts arbitrary bytes: truncation and crafted claims must produce
// honest reports (or clean throws from the embedder) — never hangs or
// uncaught TypeErrors. These byte layouts previously NaN-poisoned the GIF
// walk into an infinite loop and escaped verifyC2pa as exceptions.

test('truncated GIFs neither hang nor throw out of verifyC2pa', async () => {
  const cases = [
    // extension sub-block chain reaches EOF without a 0x00 terminator
    concat([bytesOf('GIF89a'), Uint8Array.of(1, 0, 1, 0, 0, 0, 0), Uint8Array.of(0x21, 0xfe, 0x05), bytesOf('abcde')]),
    // GCT present, then an extension introducer right at EOF
    concat([bytesOf('GIF89a'), Uint8Array.of(1, 0, 1, 0, 0x80, 0, 0), Uint8Array.of(0, 0, 0, 255, 255, 255), Uint8Array.of(0x21, 0xf9)]),
  ];
  for (const gif of cases) {
    const report = await verifyC2pa(gif);
    assert.equal(report.state, 'invalid');
    assert.equal(report.checks[0]!.code, 'credential.unreadable');
    await assert.rejects(() => embedC2pa(gif, 'gif', OPTS), /truncated GIF/);
  }
});

test('crafted claims with malformed assertion refs report invalid, never throw', async () => {
  const { encodeCbor, CborTag } = await import('../engine/src/c2pa.ts');
  const te2 = new TextEncoder();
  const SUFFIX = [0x00, 0x11, 0x00, 0x10, 0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71];
  const isoBox = (type: string, ...payloads: Uint8Array[]): Uint8Array => {
    const body = concat(payloads);
    const out = new Uint8Array(8 + body.length);
    new DataView(out.buffer).setUint32(0, out.length);
    out.set(te2.encode(type), 4);
    out.set(body, 8);
    return out;
  };
  const superbox = (fourcc: string, label: string, ...children: Uint8Array[]): Uint8Array => isoBox('jumb',
    isoBox('jumd', Uint8Array.of(...te2.encode(fourcc), ...SUFFIX), Uint8Array.of(3), te2.encode(label), Uint8Array.of(0)),
    ...children);
  const buildStore = (assertions: unknown[]): Uint8Array => {
    const claim = encodeCbor({
      'dc:title': 'Crafted', 'dc:format': 'image/png', instanceID: 'urn:uuid:0',
      claim_generator: 'Evil', signature: 'self#jumbf=c2pa.signature', assertions, alg: 'sha256',
    });
    const cose = encodeCbor(new CborTag(18, [new Uint8Array(3), new Map(), null, new Uint8Array(64)]));
    return superbox('c2pa', 'c2pa', superbox('c2ma', 'urn:uuid:0',
      superbox('c2as', 'c2pa.assertions', superbox('cbor', 'c2pa.actions', isoBox('cbor', encodeCbor({ actions: [] })))),
      superbox('c2cl', 'c2pa.claim', isoBox('cbor', claim)),
      superbox('c2cs', 'c2pa.signature', isoBox('cbor', cose))));
  };
  const wrapInPng = (store: Uint8Array): Uint8Array => {
    const png = tinyPng();
    return concat([png.subarray(0, 33), pngChunk('caBX', store), png.subarray(33)]);
  };
  // non-map ref, and a map ref that names a real assertion but has no hash
  for (const assertions of [['foo'], [{ url: 'self#jumbf=c2pa.assertions/c2pa.actions' }]]) {
    const report = await verifyC2pa(wrapInPng(buildStore(assertions)));
    assert.equal(report.state, 'invalid');
    assert.ok(report.checks.some((c) => !c.ok && c.code === 'assertion.hashedURI.mismatch'),
      JSON.stringify(report.checks));
  }
});
