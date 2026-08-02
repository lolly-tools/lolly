// SPDX-License-Identifier: MPL-2.0
/**
 * c2pa-extract.ts contract tests: the READ side of the C2PA path: the byte
 * grammar that turns an arbitrary file back into a manifest store, and the
 * JUMBF/CBOR grammar that turns a store back into its named parts.
 * Run with: node --test tests/c2pa-extract.test.ts
 *
 * This module was split out of the verify path so reviewers had one file to
 * point at, but no suite named it: every existing case reached it through the
 * `c2pa-verify.ts` re-exports (tests/c2pa-verify.test.ts,
 * tests/c2pa-jpeg-segments.test.ts) or through the full `verifyC2pa` report
 * (tests/c2pa-formats.test.ts). Those suites are left untouched and still own
 * the embed → verify loop; the cases here re-express the extraction-shaped ones
 * against c2pa-extract's OWN exports, and add the byte-grammar surface the
 * report-level tests cannot reach directly: per-format extraction, malformed
 * and truncated manifest stores, multi-manifest stores, and trailing data.
 *
 * CONTRACT (from reading the module):
 *   * Every entry in `EXTRACTORS` returns `{ manifest }`, or `null` when the
 *     container carries no credential, or THROWS a named reason when a
 *     credential IS declared but cannot be read. Returning a short or guessed
 *     manifest is never an option: a half-read store would either fail the hash
 *     binding confusingly or, worse, verify while describing other bytes.
 *   * `extractC2paStore` is the fail-closed wrapper around that: sniff, extract,
 *     and turn ANY throw into `null`. Callers that need the reason use the
 *     extractor (or verifyC2pa, which reports `credential.unreadable`).
 *   * `parseC2paStore` reads the ACTIVE manifest, the LAST manifest superbox in
 *     the store. Ingredient/parent manifests come earlier and are walked
 *     separately by `collectActionChain`.
 *   * Bounds are checked BEFORE every read: an out-of-range Uint8Array read is
 *     `undefined`, which NaN-poisons offset arithmetic into an unbreakable loop.
 *     A hang escapes the caller's try/catch, so these must throw instead.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  EXTRACTORS, aiKind, bmffTopBoxes, collectActionChain, decodeCbor, extractC2paFromPdf,
  extractC2paStore, parseC2paStore, prepareC2paIngredient, prepareC2paIngredientFromStore, sniffFormat,
} from '../engine/src/c2pa-extract.ts';
import { attachC2paStore, embedC2paInPdf } from '../engine/src/c2pa-containers.ts';
import { embedC2pa, encodeCbor } from '../engine/src/c2pa.ts';
import { packTiff } from '../engine/src/tiff.ts';

// ─── fixture helpers ──────────────────────────────────────────────────────────

const bytesOf = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
const binOf = (b: Uint8Array): string => Array.from(b, (x) => String.fromCharCode(x)).join('');

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
const u32be = (n: number): Uint8Array => Uint8Array.of(n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
const u32le = (n: number): Uint8Array => Uint8Array.of(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff);
const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((v, i) => v === b[i]);

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

const PNG_SIG = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
const tinyPng = (): Uint8Array => concat([
  PNG_SIG,
  pngChunk('IHDR', Uint8Array.of(0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0, 0, 0)),
  pngChunk('IDAT', Uint8Array.of(1, 2, 3)),
  pngChunk('IEND', new Uint8Array(0)),
]);

const APP0 = concat([Uint8Array.of(0xff, 0xe0, 0x00, 0x10), bytesOf('JFIF\0'), Uint8Array.of(1, 1, 0, 0, 1, 0, 1, 0, 0)]);
const tinyJpeg = (): Uint8Array => concat([Uint8Array.of(0xff, 0xd8), APP0, Uint8Array.of(0xff, 0xd9)]);

const tinyGif = (): Uint8Array => concat([bytesOf('GIF87a'), Uint8Array.of(1, 0, 1, 0, 0, 0, 0), Uint8Array.of(0x3b)]);
const tinySvg = (): Uint8Array => bytesOf('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>');
const tinyTiff = (): Uint8Array => packTiff(Uint8Array.of(48, 186, 120), { width: 1, height: 1, samplesPerPixel: 3, dpi: 72 });
const tinyWebp = (): Uint8Array => {
  const body = concat([bytesOf('WEBP'), bytesOf('VP8 '), u32le(2), Uint8Array.of(0, 0)]);
  return concat([bytesOf('RIFF'), u32le(body.length), body]);
};

const mp4box = (type: string, ...parts: Uint8Array[]): Uint8Array => {
  const p = concat(parts);
  return concat([u32be(8 + p.length), bytesOf(type), p]);
};
const tinyMp4 = (): Uint8Array => concat([
  mp4box('ftyp', bytesOf('isom'), u32be(0x200), bytesOf('isommp42')),
  mp4box('moov', mp4box('mvhd', new Uint8Array(40))),
  mp4box('mdat', bytesOf('fake-video-payload')),
]);

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
const knownSegment = (payload: Uint8Array): Uint8Array =>
  concat([EBML_HEAD, SEG_ID, Uint8Array.of(0x40 | (payload.length >> 8), payload.length & 0xff), payload]);
const tinyWebm = (): Uint8Array => knownSegment(concat([
  eb([0x15, 0x49, 0xa9, 0x66], new Uint8Array(6)),               // Info
  eb([0x1f, 0x43, 0xb6, 0x75], bytesOf('fake-cluster-data')),    // Cluster
]));
// Same magic, but the DocType names matroska → sniffs as mkv, same extractor.
// Unknown-size, unindexed Segment: the shape the placer appends to at EOF.
const UNKNOWN_8 = Uint8Array.of(0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff);
const tinyMkv = (): Uint8Array => {
  const headPayload = eb([0x42, 0x82], bytesOf('matroska'));
  const head = concat([Uint8Array.of(0x1a, 0x45, 0xdf, 0xa3), ebVint(headPayload.length), headPayload]);
  return concat([head, SEG_ID, UNKNOWN_8, eb([0x15, 0x49, 0xa9, 0x66], new Uint8Array(6))]);
};

const buildTestPdf = (): Uint8Array => {
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets: number[] = [];
  const push = (s: string): void => { offsets.push(out.length); out += s; };
  push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n');
  const xrefOff = out.length;
  out += 'xref\n0 4\n0000000000 65535 f \n';
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xrefOff}\n%%EOF\n`;
  return bytesOf(out);
};

// ─── JUMBF store builder (mirrors the writer's isoBox/jumbfSuperbox) ──────────

const JUMBF_UUID_SUFFIX = [0x00, 0x11, 0x00, 0x10, 0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71];
const boxUuid = (fourcc: string): Uint8Array => concat([bytesOf(fourcc), Uint8Array.from(JUMBF_UUID_SUFFIX)]);
const isoBox = (type: string, ...payloads: Uint8Array[]): Uint8Array => {
  const body = concat(payloads);
  return concat([u32be(8 + body.length), bytesOf(type), body]);
};
// jumd payload = UUID(16) + toggles(1) + NUL-terminated label.
const superbox = (fourcc: string, label: string, ...children: Uint8Array[]): Uint8Array =>
  isoBox('jumb', isoBox('jumd', boxUuid(fourcc), Uint8Array.of(0x03), bytesOf(label), Uint8Array.of(0)), ...children);
const cborAssertion = (label: string, value: unknown): Uint8Array =>
  superbox('cbor', label, isoBox('cbor', encodeCbor(value)));

/** A structurally complete manifest superbox: assertion store + claim + signature. */
function manifestBox(label: string, { actions = [] as unknown[], title = 'Fixture', generator = 'Lolly' } = {}): Uint8Array {
  return superbox('c2ma', label,
    superbox('c2as', 'c2pa.assertions', cborAssertion('c2pa.actions.v2', new Map<unknown, unknown>([['actions', actions]]))),
    superbox('c2cl', 'c2pa.claim.v2', isoBox('cbor', encodeCbor(new Map<unknown, unknown>([
      ['dc:title', title],
      ['claim_generator_info', new Map<unknown, unknown>([['name', generator]])],
    ])))),
    superbox('c2cs', 'c2pa.signature', isoBox('cbor', Uint8Array.of(0xf6))),
  );
}
const storeOf = (...manifests: Uint8Array[]): Uint8Array => superbox('c2pa', 'c2pa', ...manifests);
const action = (name: string, extra: Array<[string, unknown]> = []): Map<unknown, unknown> =>
  new Map<unknown, unknown>([['action', name], ...extra]);

// One real signed store, used where structure alone is not enough.
const signedSvg = embedC2pa(tinySvg(), 'svg', { title: 'Real Store', claimGenerator: 'Lolly lolly.tools' });
const realStore = signedSvg.then((out) => extractC2paStore(out)!.store);

// ─── sniffing ─────────────────────────────────────────────────────────────────

test('sniffFormat maps magic bytes to the extractor key, and refuses to guess', () => {
  assert.equal(sniffFormat(tinyPng()), 'png');
  assert.equal(sniffFormat(tinyJpeg()), 'jpeg');
  assert.equal(sniffFormat(tinyGif()), 'gif');
  assert.equal(sniffFormat(tinySvg()), 'svg');
  assert.equal(sniffFormat(tinyTiff()), 'tiff');
  assert.equal(sniffFormat(tinyWebp()), 'webp');
  assert.equal(sniffFormat(tinyMp4()), 'mp4');
  assert.equal(sniffFormat(tinyWebm()), 'webm');
  assert.equal(sniffFormat(tinyMkv()), 'mkv');
  assert.equal(sniffFormat(buildTestPdf()), 'pdf');
  // Every sniffed name has an extractor: the two tables cannot drift apart.
  for (const fmt of ['png', 'jpeg', 'gif', 'svg', 'tiff', 'webp', 'mp4', 'webm', 'mkv', 'pdf'] as const) {
    assert.equal(typeof EXTRACTORS[fmt], 'function', `${fmt} is dispatchable`);
  }
  // No guessing: unknown bytes, and anything too short to hold magic at all.
  assert.equal(sniffFormat(bytesOf('definitely not any container we know')), null);
  assert.equal(sniffFormat(bytesOf('%PDF')), null, 'under 12 bytes is not sniffed');
  assert.equal(sniffFormat(new Uint8Array(0)), null);
  // Image-sequence BMFF brands are photos, not mp4, so they keep the honest null.
  assert.equal(sniffFormat(mp4box('ftyp', bytesOf('avif'), u32be(0))), null);
  assert.equal(sniffFormat(mp4box('ftyp', bytesOf('heic'), u32be(0))), null);
});

// ─── extraction per supported format ─────────────────────────────────────────

const CONTAINERS: Array<[string, () => Uint8Array, keyof typeof EXTRACTORS]> = [
  ['png', tinyPng, 'png'],
  ['jpg', tinyJpeg, 'jpeg'],
  ['gif', tinyGif, 'gif'],
  ['svg', tinySvg, 'svg'],
  ['tiff', tinyTiff, 'tiff'],
  ['webp', tinyWebp, 'webp'],
  ['mp4', tinyMp4, 'mp4'],
  ['webm', tinyWebm, 'webm'],
];

test('a real store round-trips out of every non-PDF container, byte-for-byte', async () => {
  const store = await realStore;
  for (const [fmt, fixture, key] of CONTAINERS) {
    const carrier = attachC2paStore(fixture(), fmt, store);
    const ex = EXTRACTORS[key](carrier);
    assert.ok(ex, `${fmt}: the extractor finds the store`);
    assert.ok(sameBytes(ex.manifest, store), `${fmt}: store is byte-identical after the round-trip`);
    // ...and the same store parses to the same named parts either way.
    assert.equal(parseC2paStore(ex.manifest).manifestLabel, parseC2paStore(store).manifestLabel);
  }
});

test('the mkv alias shares the webm extractor: same attachment, same bytes out', async () => {
  const store = await realStore;
  // placeWebm is keyed on 'webm'; the resulting file still sniffs by DocType.
  const carrier = attachC2paStore(tinyMkv(), 'webm', store);
  assert.equal(sniffFormat(carrier), 'mkv');
  assert.equal(EXTRACTORS.mkv, EXTRACTORS.webm, 'mkv dispatches to the Matroska reader');
  assert.ok(sameBytes(EXTRACTORS.mkv(carrier)!.manifest, store));
});

test('an uncredentialed container is null, never an invented manifest', () => {
  for (const [fmt, fixture, key] of CONTAINERS) {
    assert.equal(EXTRACTORS[key](fixture()), null, `${fmt}: no credential means null`);
    assert.equal(extractC2paStore(fixture()), null, `${fmt}: and the wrapper agrees`);
  }
  assert.equal(extractC2paFromPdf(buildTestPdf()), null);
  // An empty <c2pa:manifest> element counts as absent, not as a broken one.
  assert.equal(EXTRACTORS.svg(bytesOf('<svg xmlns="http://www.w3.org/2000/svg"><metadata><c2pa:manifest>  </c2pa:manifest></metadata></svg>')), null);
});

test('jpeg: a store far over the 64 KB segment limit reassembles from its APP11 chain', async () => {
  // The multi-segment path is the one place extraction is not a single slice:
  // the box is split across APP11 segments that repeat the JUMBF LBox/TBox.
  const big = await embedC2pa(tinyJpeg(), 'jpg', {
    title: 'Big',
    environment: { tool: 'Fixture', format: 'jpg', surface: 'test', engine: 'node', os: 'test', blob: 'x'.repeat(140000) },
  });
  let segments = 0;
  for (let i = 2; i + 4 <= big.length; ) {
    if (big[i] !== 0xff) break;
    const marker = big[i + 1]!;
    const end = i + 2 + ((big[i + 2]! << 8) | big[i + 3]!);
    if (marker === 0xeb) segments++;
    if (marker === 0xd9) break;
    i = end;
  }
  assert.ok(segments >= 3, `the manifest really did split (${segments} APP11 segments)`);
  const ex = EXTRACTORS.jpeg(big);
  assert.ok(ex, 'reassembled');
  // Reassembly is only correct if the result is still a parseable store whose
  // declared JUMBF length matches the bytes recovered.
  const declared = (ex.manifest[0]! << 24 | ex.manifest[1]! << 16 | ex.manifest[2]! << 8 | ex.manifest[3]!) >>> 0;
  assert.equal(declared, ex.manifest.length, 'outer LBox agrees with the reassembled length');
  assert.equal(parseC2paStore(ex.manifest).claimVersion, 2);
});

test('gif: a store over 255 bytes rejoins from its sub-blocks', async () => {
  const store = await realStore;
  assert.ok(store.length > 255, 'the fixture store really needs splitting');
  assert.ok(sameBytes(EXTRACTORS.gif(attachC2paStore(tinyGif(), 'gif', store))!.manifest, store));
});

test('pdf: the manifest is read from the /EF stream at the offset the layout promised', async () => {
  const base = buildTestPdf();
  const pdf = await embedC2paInPdf(base, { title: 'PDF Store' });
  const found = extractC2paFromPdf(pdf);
  assert.ok(found, 'the embedded file is located');
  assert.ok(found.start >= base.length, 'the manifest lives in the appended revision');
  // The offset is the same one the hard binding excluded. The two must agree, or
  // the credential describes bytes it does not cover.
  const hd = decodeCbor(parseC2paStore(found.manifest).assertions.find((a) => a.label === 'c2pa.hash.data')!.content);
  assert.ok(hd instanceof Map);
  const exclusion = (hd.get('exclusions') as Array<Map<unknown, unknown>>)[0]!;
  assert.equal(exclusion.get('start'), found.start);
  assert.equal(exclusion.get('length'), found.manifest.length);
});

test('pdf: a declared credential that cannot be read throws instead of returning a guess', async () => {
  const pdf = await embedC2paInPdf(buildTestPdf(), { title: 'Unreadable' });
  const bin = binOf(pdf);
  const patched = (from: RegExp, to: string): Uint8Array => {
    assert.match(bin, from, 'the fixture really carries the entry being broken');
    return bytesOf(bin.replace(from, to));
  };
  // An indirect /Length cannot be resolved without a full object graph.
  assert.throws(() => extractC2paFromPdf(patched(/\/Length \d+ >>/, '/Length 9 0 R >>')), /indirect \/Length/);
  // A compressed stream is not the raw JUMBF store.
  assert.throws(() => extractC2paFromPdf(patched(/\/Subtype \/application#2Fc2pa/, '/Filter /FlateDecode')), /compressed; cannot read/);
  // A filespec whose /EF reference is gone.
  assert.throws(() => extractC2paFromPdf(patched(/\/EF << \/F \d+ 0 R >>/, '/EF << /Q null >>')), /no readable \/EF stream/);
  // A /Length that outruns the file: refused, never a short manifest.
  assert.throws(() => extractC2paFromPdf(patched(/\/Length \d+ >>/, '/Length 999999 >>')), /overruns the file/);
  // Not a PDF at all is a different, earlier refusal.
  assert.throws(() => extractC2paFromPdf(bytesOf('nope')), /not a PDF file/);
});

test('a declared-but-unreadable credential throws from the extractor and fails closed in the wrapper', async () => {
  const store = await realStore;
  // PNG: a caBX chunk whose length runs past EOF.
  const badPng = concat([PNG_SIG, pngChunk('IHDR', new Uint8Array(13)), u32be(9999), bytesOf('caBX'), bytesOf('short')]);
  assert.throws(() => EXTRACTORS.png(badPng), /malformed PNG chunk/);
  assert.equal(extractC2paStore(badPng), null, 'the wrapper turns the reason into a null');

  // GIF: magic bytes and nothing else that parses (the /verify honest-failure case).
  assert.throws(() => EXTRACTORS.gif(bytesOf('GIF89a definitely not a real gif')));
  assert.equal(extractC2paStore(bytesOf('GIF89a definitely not a real gif')), null);

  // TIFF: a real C2PA IFD entry whose value now runs past the (clipped) EOF.
  const clippedTiff = attachC2paStore(tinyTiff(), 'tiff', store).slice(0, -1);
  assert.throws(() => EXTRACTORS.tiff(clippedTiff), /TIFF C2PA value overruns the file/);
  assert.equal(extractC2paStore(clippedTiff), null);

  // WebP: a chunk size past EOF (the shared RIFF walk, so WAV reports the same way).
  const badWebp = concat([bytesOf('RIFF'), u32le(20), bytesOf('WEBP'), bytesOf('C2PA'), u32le(9999)]);
  assert.throws(() => EXTRACTORS.webp(badWebp), /malformed RIFF chunk/);

  // WAV: the identical truncation through the wav extractor route.
  const badWav = concat([bytesOf('RIFF'), u32le(20), bytesOf('WAVE'), bytesOf('C2PA'), u32le(9999)]);
  assert.throws(() => EXTRACTORS.wav(badWav), /malformed RIFF chunk/);
  assert.equal(extractC2paStore(badWav), null);

  // Matroska: an attachment declared with our mime type but no data.
  const emptyAttachment = knownSegment(eb([0x19, 0x41, 0xa4, 0x69], eb([0x61, 0xa7], concat([
    eb([0x46, 0x60], bytesOf('application/c2pa')),
    eb([0x46, 0x5c], new Uint8Array(0)),
  ]))));
  assert.throws(() => EXTRACTORS.webm(emptyAttachment), /attachment has no data/);
  assert.equal(extractC2paStore(emptyAttachment), null);
});

test('every truncation of a credentialed container throws or returns null, never hangs, never a TypeError', async () => {
  // An out-of-range Uint8Array read yields undefined, which NaN-poisons the walk
  // into an infinite loop; a hang escapes the caller's try/catch and freezes the
  // tab, and /valid takes arbitrary files. Only a throw or a null is acceptable.
  const store = await realStore;
  for (const [fmt, fixture, key] of CONTAINERS) {
    const carrier = attachC2paStore(fixture(), fmt, store);
    for (let n = 0; n < carrier.length; n += 7) {
      const cut = carrier.subarray(0, n);
      try {
        const ex = EXTRACTORS[key](cut);
        if (ex) assert.ok(ex.manifest instanceof Uint8Array, `${fmt}@${n}: a manifest is bytes`);
      } catch (e) {
        assert.ok(e instanceof Error, `${fmt}@${n}: threw a real Error`);
        assert.ok(!(e instanceof TypeError), `${fmt}@${n}: not a TypeError (${(e as Error).message})`);
      }
      // The wrapper never throws at all, whatever the extractor decided.
      assert.doesNotThrow(() => extractC2paStore(cut), `${fmt}@${n}: wrapper fails closed`);
    }
  }
});

test('trailing data past a container end is neither consumed nor mistaken for a credential', async () => {
  const store = await realStore;
  const junk = bytesOf('\n\n<!-- appended by some pipeline -->\n');
  for (const [fmt, fixture, key] of CONTAINERS) {
    const carrier = attachC2paStore(fixture(), fmt, store);
    const withTail = concat([carrier, junk]);
    if (fmt === 'mp4') {
      // In BMFF every top-level byte is a box, so appended junk IS structure:
      // a trailing box whose declared size overruns. Refused, never skipped.
      assert.throws(() => EXTRACTORS.mp4(withTail), /malformed MP4 box/);
      assert.equal(extractC2paStore(withTail), null);
      continue;
    }
    // Everything else measures its own extent (a known-size Matroska Segment
    // included), so the tail is simply outside the walk.
    const ex = EXTRACTORS[key](withTail);
    assert.ok(ex, `${fmt}: the credential still reads`);
    assert.ok(sameBytes(ex.manifest, store), `${fmt}: and the trailing bytes are not part of it`);
  }
  // Trailing junk on an UNcredentialed container invents nothing either.
  assert.equal(extractC2paStore(concat([tinyPng(), junk])), null);
});

// ─── store grammar: parseC2paStore ───────────────────────────────────────────

test('parseC2paStore names the parts of a well-formed store', async () => {
  const parts = parseC2paStore(await realStore);
  assert.match(parts.manifestLabel, /^urn:uuid:[0-9a-f-]{36}$/);
  assert.equal(parts.claimVersion, 2);
  assert.ok(parts.claimBytes.length > 0);
  assert.ok(parts.signatureBytes.length > 0);
  const labels = parts.assertions.map((a) => a.label);
  assert.ok(labels.includes('c2pa.actions.v2'), labels.join(','));
  assert.ok(labels.includes('c2pa.hash.data'), labels.join(','));
  // A hashed URI covers the assertion superbox PAYLOAD (past the 8-byte header),
  // so `payload` must be exactly `content` plus its own jumd/box framing.
  for (const a of parts.assertions) {
    assert.ok(a.payload.length > a.content.length, `${a.label}: payload wraps content`);
    const at = binOf(a.payload).indexOf(binOf(a.content));
    assert.ok(at > 0, `${a.label}: content sits inside the hashed payload`);
  }
});

test('parseC2paStore builds the same parts from a hand-built store as from a signed one', () => {
  const parts = parseC2paStore(storeOf(manifestBox('urn:uuid:hand-built', { actions: [action('c2pa.created')] })));
  assert.equal(parts.manifestLabel, 'urn:uuid:hand-built');
  assert.equal(parts.claimVersion, 2);
  assert.deepEqual(parts.assertions.map((a) => a.label), ['c2pa.actions.v2']);
});

test('a v1 claim label reports claimVersion 1 (foreign 1.x stores still read)', () => {
  const v1 = storeOf(superbox('c2ma', 'urn:uuid:legacy',
    superbox('c2as', 'c2pa.assertions'),
    superbox('c2cl', 'c2pa.claim', isoBox('cbor', encodeCbor(new Map([['claim_generator', 'Older/1.0']])))),
    superbox('c2cs', 'c2pa.signature', isoBox('cbor', Uint8Array.of(0xf6))),
  ));
  const parts = parseC2paStore(v1);
  assert.equal(parts.claimVersion, 1);
  assert.deepEqual(parts.assertions, []);
});

test('a malformed or truncated manifest store is refused with a named reason', async () => {
  // Empty input, and a box header that cannot even be read.
  assert.throws(() => parseC2paStore(new Uint8Array(0)), /empty manifest store/);
  assert.throws(() => parseC2paStore(Uint8Array.of(0, 0, 0)), /truncated box header/);
  // A declared length that overruns its container, and a nonsense length under
  // the 8-byte header (which would otherwise loop forever on i += 0).
  assert.throws(() => parseC2paStore(concat([u32be(9999), bytesOf('jumb')])), /box jumb overruns its container/);
  assert.throws(() => parseC2paStore(concat([u32be(0), bytesOf('jumb')])), /box jumb overruns its container/);
  // The right shape, the wrong roles.
  assert.throws(() => parseC2paStore(isoBox('jumd', new Uint8Array(17))), /expected superbox, got jumd/);
  assert.throws(() => parseC2paStore(isoBox('jumb', isoBox('cbor', new Uint8Array(4)))), /missing description box/);
  assert.throws(() => parseC2paStore(superbox('c2pa', 'not-c2pa')), /store label is 'not-c2pa'/);
  assert.throws(() => parseC2paStore(superbox('c2pa', 'c2pa')), /store has no manifest/);
  // Structurally fine, but the parts a verifier must have are missing.
  const noClaim = storeOf(superbox('c2ma', 'urn:uuid:x', superbox('c2as', 'c2pa.assertions')));
  assert.throws(() => parseC2paStore(noClaim), /manifest has no claim/);
  const noSig = storeOf(superbox('c2ma', 'urn:uuid:x',
    superbox('c2cl', 'c2pa.claim.v2', isoBox('cbor', encodeCbor(new Map())))));
  assert.throws(() => parseC2paStore(noSig), /no claim signature/);

  // A REAL store truncated at any point is refused the same way, with no partial
  // parse, and specifically never a TypeError from an out-of-range read.
  const store = await realStore;
  for (let n = 1; n < store.length; n += 11) {
    assert.throws(() => parseC2paStore(store.subarray(0, n)), (e: unknown) => {
      assert.ok(e instanceof Error && !(e instanceof TypeError), `truncation at ${n}: ${String(e)}`);
      return true;
    });
  }
});

test('decodeCbor refuses trailing bytes after the item rather than reading a prefix', () => {
  assert.deepEqual(decodeCbor(encodeCbor([1, 2, 3])), [1, 2, 3]);
  assert.throws(() => decodeCbor(concat([encodeCbor([1, 2, 3]), Uint8Array.of(0x01)])), /trailing bytes after item/);
  assert.throws(() => decodeCbor(new Uint8Array(0)));
});

// ─── multiple manifests in one store ─────────────────────────────────────────

test('parseC2paStore reads the ACTIVE manifest: the last superbox in the store', () => {
  const store = storeOf(
    manifestBox('urn:uuid:ingredient-1', { title: 'Source', generator: 'SomeImageModel/1.0' }),
    manifestBox('urn:uuid:ingredient-2', { title: 'Intermediate' }),
    manifestBox('urn:uuid:active', { title: 'Delivered' }),
  );
  const parts = parseC2paStore(store);
  assert.equal(parts.manifestLabel, 'urn:uuid:active');
  const claim = decodeCbor(parts.claimBytes);
  assert.ok(claim instanceof Map);
  assert.equal(claim.get('dc:title'), 'Delivered');
});

test('collectActionChain walks EVERY manifest, oldest parent first, and de-duplicates', () => {
  const AI = 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia';
  const store = storeOf(
    manifestBox('urn:uuid:parent', {
      generator: 'SomeImageModel/1.0',
      actions: [action('c2pa.created', [['digitalSourceType', AI], ['when', '2026-01-01T00:00:00Z']])],
    }),
    manifestBox('urn:uuid:active', {
      generator: 'Lolly',
      actions: [
        // The parent's step recorded again, verbatim: one row, not two.
        action('c2pa.created', [['digitalSourceType', AI], ['when', '2026-01-01T00:00:00Z']]),
        action('c2pa.color_adjustments', [['description', "Applied 'Forest'"], ['when', '2026-02-02T00:00:00Z']]),
      ],
    }),
  );
  const chain = collectActionChain(store);
  assert.deepEqual(chain.map((s) => s.action), ['c2pa.created', 'c2pa.color_adjustments']);
  assert.equal(chain[0]!.generator, 'SomeImageModel/1.0', 'the step keeps the manifest that recorded it');
  assert.equal(chain[1]!.generator, 'Lolly');
  assert.equal(aiKind(chain[0]!.digitalSourceType), 'generated');
  assert.equal(aiKind(chain[1]!.digitalSourceType), undefined);
  // aiKind reads the slug, not the whole URL, and never invents a kind.
  assert.equal(aiKind('compositeWithTrainedAlgorithmicMedia'), 'composite');
  assert.equal(aiKind(undefined), undefined);
  assert.equal(aiKind(42), undefined);
});

test('collectActionChain is a display nicety: an unreadable manifest is skipped, never fatal', () => {
  // A junk sibling box between two good manifests.
  const store = superbox('c2pa', 'c2pa',
    manifestBox('urn:uuid:a', { actions: [action('c2pa.created')] }),
    isoBox('jumb', isoBox('cbor', new Uint8Array(4))),         // no jumd → unparseable
    superbox('c2ma', 'urn:uuid:opaque', superbox('c2as', 'c2pa.assertions',
      superbox('cbor', 'c2pa.actions.v2', isoBox('cbor', bytesOf('not cbor at all'))))),
    manifestBox('urn:uuid:b', { actions: [action('c2pa.published')] }),
  );
  assert.deepEqual(collectActionChain(store).map((s) => s.action), ['c2pa.created', 'c2pa.published']);
  // A store that is not a store at all yields an empty chain, not a throw.
  assert.deepEqual(collectActionChain(new Uint8Array(0)), []);
  assert.deepEqual(collectActionChain(bytesOf('junk')), []);
  assert.deepEqual(collectActionChain(superbox('c2pa', 'not-c2pa')), []);
});

test('prepareC2paIngredient copies every manifest box verbatim and names the active one', async () => {
  const AI = 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia';
  const aiSource = await embedC2pa(tinySvg(), 'svg', {
    title: 'AI artwork',
    claimGenerator: 'SomeImageModel/1.0',
    actions: [{ action: 'c2pa.created', digitalSourceType: AI }],
  });
  const ing = prepareC2paIngredient(aiSource);
  assert.ok(ing, 'a credentialed file reads back as an ingredient');
  assert.equal(ing.format, 'svg');
  assert.equal(ing.title, 'AI artwork');
  assert.equal(ing.activeLabel, parseC2paStore(extractC2paStore(aiSource)!.store).manifestLabel);
  assert.equal(ing.digitalSourceType, AI, 'the AI origin cannot be laundered away by re-stamping');
  // The boxes are the store's own bytes, so the ingredient's signatures survive.
  const store = extractC2paStore(aiSource)!.store;
  assert.equal(ing.manifestBoxes.length, 1);
  assert.ok(binOf(store).includes(binOf(ing.manifestBoxes[0]!)), 'the box is a verbatim slice of the store');

  // A multi-manifest store hands over ALL of its manifests, active last.
  const multi = prepareC2paIngredientFromStore(storeOf(
    manifestBox('urn:uuid:one'), manifestBox('urn:uuid:two'), manifestBox('urn:uuid:three'),
  ), 'png');
  assert.ok(multi);
  assert.equal(multi.manifestBoxes.length, 3);
  assert.equal(multi.activeLabel, 'urn:uuid:three');
  assert.equal(multi.format, 'png');
});

test('prepareC2paIngredient* return null rather than a half-read ingredient', () => {
  assert.equal(prepareC2paIngredient(tinySvg()), null, 'no credential, nothing to preserve');
  assert.equal(prepareC2paIngredient('nope' as unknown as Uint8Array), null);
  assert.equal(prepareC2paIngredientFromStore('nope' as unknown as Uint8Array, 'png'), null);
  assert.equal(prepareC2paIngredientFromStore(new Uint8Array(0), 'png'), null);
  assert.equal(prepareC2paIngredientFromStore(superbox('c2pa', 'c2pa'), 'png'), null, 'no manifests');
  assert.equal(prepareC2paIngredientFromStore(superbox('c2pa', 'not-c2pa', manifestBox('urn:uuid:x')), 'png'), null);
  // A manifest whose claim cannot be parsed is not partially adopted.
  const noClaim = storeOf(superbox('c2ma', 'urn:uuid:x', superbox('c2as', 'c2pa.assertions')));
  assert.equal(prepareC2paIngredientFromStore(noClaim, 'png'), null);
});

test('more than one manifest STORE in one file is ambiguous and refused', async () => {
  const store = await realStore;
  // PNG: two caBX chunks. Which one describes the pixels? Neither answer is safe.
  const two = concat([
    PNG_SIG,
    pngChunk('IHDR', Uint8Array.of(0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0, 0, 0)),
    pngChunk('caBX', store), pngChunk('caBX', store),
    pngChunk('IEND', new Uint8Array(0)),
  ]);
  assert.throws(() => EXTRACTORS.png(two), /more than one caBX chunk/);
  assert.equal(extractC2paStore(two), null);

  // MP4: two trailing C2PA uuid boxes.
  const stampedMp4 = attachC2paStore(tinyMp4(), 'mp4', store);
  const c2paBox = stampedMp4.subarray(tinyMp4().length);
  assert.throws(() => EXTRACTORS.mp4(concat([stampedMp4, c2paBox])), /more than one C2PA manifest box/);

  // Matroska: two attachments carrying our mime type.
  const attach = (data: Uint8Array): Uint8Array => eb([0x61, 0xa7], concat([
    eb([0x46, 0x60], bytesOf('application/c2pa')),
    eb([0x46, 0x5c], data),
  ]));
  const twoAttachments = knownSegment(eb([0x19, 0x41, 0xa4, 0x69], concat([attach(store), attach(store)])));
  assert.throws(() => EXTRACTORS.webm(twoAttachments), /more than one C2PA attachment/);
});

// ─── BMFF box walker (shared by the reader and the binding) ───────────────────

test('bmffTopBoxes reads the sizes a foreign file may legitimately use', () => {
  const plain = bmffTopBoxes(tinyMp4());
  assert.deepEqual(plain.map((b) => b.type), ['ftyp', 'moov', 'mdat']);
  assert.deepEqual(plain.map((b) => b.hdr), [8, 8, 8]);
  assert.equal(plain[0]!.off, 0);
  assert.equal(plain[1]!.off, plain[0]!.size);

  // size === 1 → 64-bit largesize, 16-byte header. Reading must handle it even
  // though the writer refuses to rewrite one.
  const large = concat([u32be(1), bytesOf('mdat'), u32be(0), u32be(24), bytesOf('12345678')]);
  const big = bmffTopBoxes(large);
  assert.deepEqual(big.map((b) => [b.type, b.size, b.hdr]), [['mdat', 24, 16]]);

  // size === 0 → "to end of file", last box only.
  const toEof = concat([mp4box('ftyp', bytesOf('isom'), u32be(0)), u32be(0), bytesOf('mdat'), bytesOf('tail')]);
  const eof = bmffTopBoxes(toEof);
  assert.equal(eof[1]!.type, 'mdat');
  assert.equal(eof[1]!.off + eof[1]!.size, toEof.length);

  // Every malformed shape is a throw, so no offset arithmetic runs on garbage.
  assert.throws(() => bmffTopBoxes(Uint8Array.of(0, 0, 0)), /truncated MP4 box header/);
  assert.throws(() => bmffTopBoxes(concat([u32be(1), bytesOf('mdat'), u32be(0)])), /truncated MP4 box header/);
  assert.throws(() => bmffTopBoxes(concat([u32be(999), bytesOf('mdat')])), /malformed MP4 box/);
  assert.throws(() => bmffTopBoxes(concat([u32be(4), bytesOf('mdat')])), /malformed MP4 box/, 'size under the header length');
  assert.throws(
    () => bmffTopBoxes(concat([u32be(1), bytesOf('mdat'), u32be(0xffffffff), u32be(0xffffffff)])),
    /malformed MP4 box size/,
  );
});
