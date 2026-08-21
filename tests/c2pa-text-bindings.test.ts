// SPDX-License-Identifier: MPL-2.0
/**
 * C2PA 2.4 TEXT BINDINGS - the read side: section A.7 (HTML documents), section A.8
 * (unstructured text / Unicode variation selectors) and section A.9 (structured text /
 * ASCII armour), plus the sniff order that has to place them without any magic
 * bytes to key on.
 * Run with: node --test "tests/c2pa-text-bindings.test.ts"
 *
 * These three bindings have NO reference implementation to conform against - 
 * c2pa-rs 0.90 implements none of them and c2patool cannot read one - so unlike
 * every other C2PA suite here, nothing can be cross-checked against another
 * tool's bytes. The substitute is spec literalism: fixtures are built from the
 * spec's own pseudocode (never from the engine's helpers, which would make an
 * encoder bug invisible), and every offset a case asserts is written out as
 * arithmetic in a comment so a reviewer can check it against the quoted rule
 * rather than against the implementation.
 *
 * CONTRACT (from section A.7/section A.8/section A.9 and section 15.12.1.3, and from reading the module):
 *   * `sniffFormat` gains 'html' | 'code' | 'text'. 'html' keys on the document;
 *     'code' and 'text' key on finding the CARRIER (armour delimiters / the
 *     wrapper), never on guessing the host language.
 *   * `EXTRACTORS.html|code|text` keep the legacy per-format contract:
 *     `{ manifest }`, or null for "nothing here", or a THROW when a credential
 *     is declared and cannot be read.
 *   * `extractC2paDetailed` never throws and never fetches: it returns the
 *     external URL, the spec's exclusions, every section A.8 wrapper, and a status.
 *   * section A.8 offsets are byte offsets in the NFC-NORMALIZED UTF-8 encoding, not in
 *     the bytes handed in (section A.8.7.3).
 *   * Bounds: a hostile paste is a bounded refusal. The one allocation sized by
 *     an input-chosen field (manifestLength) is checked against the remaining
 *     text before it is made.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  EXTRACTORS, C2PA_TEXT_STATUS, extractC2paDetailed, extractC2paStore, parseC2paStore, sniffFormat,
  type C2paTextWrapper,
} from '../engine/src/c2pa-extract.ts';
import { embedC2pa } from '../engine/src/c2pa.ts';

// ─── fixture helpers ──────────────────────────────────────────────────────────

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
const latin1 = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((v, i) => v === b[i]);
const b64 = (b: Uint8Array): string => Buffer.from(b).toString('base64');

/** A stand-in manifest store. The text bindings are CARRIERS - none of them
 *  parses the store - so a byte pattern is a stricter fixture than a real store:
 *  it round-trips exactly and includes the values the codec special-cases
 *  (0x00 and 0x0f sit in the low selector block, 0x10 and 0xff in the high one). */
const fakeStore = (n = 24): Uint8Array => Uint8Array.from({ length: n }, (_, i) => (i * 37 + 3) & 0xff);
const STORE_EDGES = Uint8Array.of(0x00, 0x0f, 0x10, 0xff, 0x80, 0x01);

// ── section A.8 codec, transcribed from the spec's own pseudocode ──
//
//   function byteToVariationSelector(byte b) {
//       if (b >= 0 && b <= 15)   { return U+FE00 + b; }
//       else if (b >= 16 && b <= 255) { return U+E0100 + (b - 16); }
//   }
//
// Deliberately NOT imported from the engine: a fixture built with the code under
// test cannot catch that code being wrong about the spec.
const specByteToVs = (b: number): number => (b >= 0 && b <= 15 ? 0xfe00 + b : 0xe0100 + (b - 16));
const vsRun = (bytes: readonly number[]): string => bytes.map((b) => String.fromCodePoint(specByteToVs(b))).join('');

/** section A.8.2.2: magic u64 "C2PATXT\0", version u8, manifestLength u32, jumbf bytes. */
function wrapperBytes(store: Uint8Array, { version = 1, declaredLength = store.length } = {}): number[] {
  return [
    0x43, 0x32, 0x50, 0x41, 0x54, 0x58, 0x54, 0x00,
    version,
    (declaredLength >>> 24) & 0xff, (declaredLength >>> 16) & 0xff, (declaredLength >>> 8) & 0xff, declaredLength & 0xff,
    ...store,
  ];
}
/** section A.8.4.1: "prefixed with a single Zero-Width No-Break Space (U+FEFF)". */
const wrapperText = (store: Uint8Array, opts?: { version?: number; declaredLength?: number }): string =>
  '\uFEFF' + vsRun(wrapperBytes(store, opts));

/** UTF-8 byte length of one wrapper's U+FEFF + selectors: U+FEFF is 3 bytes,
 *  a low selector (bytes 0-15) is 3, a high selector (bytes 16-255) is 4. */
const wrapperByteLength = (payload: readonly number[]): number =>
  3 + payload.reduce((n, b) => n + (b <= 15 ? 3 : 4), 0);

const ARMOR_BEGIN = '-----BEGIN C2PA MANIFEST-----';
const ARMOR_END = '-----END C2PA MANIFEST-----';

// ═══ sniff order ══════════════════════════════════════════════════════════════

test('sniffFormat: an HTML document is html, even when it opens with an inline <svg>', () => {
  // The bug this ordering exists to fix (plan 105 section 0): the loose `<svg` scan sat
  // in front, so a page with an inline icon sniffed as 'svg' and got fed to the
  // SVG reader, which looks for a <c2pa:manifest> element HTML never carries.
  const early = '<!DOCTYPE html>\n<html><head><title>x</title></head><body>'
    + '<svg viewBox="0 0 1 1"><rect width="1" height="1"/></svg></body></html>';
  assert.equal(sniffFormat(utf8(early)), 'html');

  // ...and one whose <svg> lands past the 4 KB head window used to sniff as
  // NOTHING at all, which read to the user as "this format can't carry a
  // credential" about a format that now can.
  const late = '<!DOCTYPE html>\n<html><head><title>x</title></head><body>\n'
    + `<p>${'padding '.repeat(700)}</p>\n<svg viewBox="0 0 1 1"/></body></html>`;
  assert.ok(late.indexOf('<svg') > 4096, 'the fixture really does hide its <svg> past the head window');
  assert.equal(sniffFormat(utf8(late)), 'html');
});

test('sniffFormat: html is case-insensitive, and tolerates a BOM and leading whitespace', () => {
  assert.equal(sniffFormat(utf8('<!DOCTYPE HTML><html></html>')), 'html');
  assert.equal(sniffFormat(utf8('<!doctype   html>\n<html></html>')), 'html');
  assert.equal(sniffFormat(utf8('\uFEFF\n\n  <!DOCTYPE html>\n<html></html>')), 'html');
  // No doctype at all - the root element alone is enough.
  assert.equal(sniffFormat(utf8('<html lang="en"><body>hello there</body></html>')), 'html');
  // ...but only as a real tag: a word that merely starts with "html" is not one.
  assert.equal(sniffFormat(utf8('<htmlish>nope, not a document at all here</htmlish>')), null);
});

test('sniffFormat: an SVG stays svg, including one that embeds XHTML in a foreignObject', () => {
  const plain = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
  assert.equal(sniffFormat(utf8(plain)), 'svg', 'the existing SVG sniff is unchanged');
  // Whichever root element comes FIRST wins. An SVG may legitimately carry an
  // <html> inside a foreignObject and is still an SVG.
  const foreign = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject>'
    + '<html xmlns="http://www.w3.org/1999/xhtml"><body>text</body></html></foreignObject></svg>';
  assert.equal(sniffFormat(utf8(foreign)), 'svg');
});

test('sniffFormat: code and text key on the carrier, never on the language', () => {
  // Plain source code carries nothing to find - and must NOT be claimed.
  assert.equal(sniffFormat(utf8('function hello() { return 42; }\nhello();\n')), null);
  assert.equal(sniffFormat(utf8('# A markdown document\n\nWith some ordinary prose in it.\n')), null);

  // section A.9.3.1, start of file (the spec's "strongly recommended" placement).
  const atStart = `// ${ARMOR_BEGIN} https://example.com/m.c2pa ${ARMOR_END}\nconst x = 1;\n`;
  assert.equal(sniffFormat(utf8(atStart)), 'code');
  // section A.9.3.1, end of file (when line 1 is reserved - here, a shebang).
  const atEnd = `#!/usr/bin/env node\nconsole.log(1);\n// ${ARMOR_BEGIN} https://example.com/m.c2pa ${ARMOR_END}\n`;
  assert.equal(sniffFormat(utf8(atEnd)), 'code');

  // section A.8: the wrapper at the end of the visible text.
  assert.equal(sniffFormat(utf8('Some quoted prose.' + wrapperText(fakeStore()))), 'text');
});

test('sniffFormat: a mid-file carrier is found in a small text file, and not paid for on a binary one', () => {
  // Both sniff windows are 4 KB head + 64 KB tail, so a carrier stranded in the
  // middle of a >68 KB file is only reachable by the bounded whole-file pass.
  const filler = 'lorem ipsum dolor sit amet, consectetur adipiscing elit\n'.repeat(2600);
  assert.ok(filler.length > 4096 + 64 * 1024, 'the filler really does exceed head+tail');
  const midArmor = filler + `// ${ARMOR_BEGIN} https://example.com/m.c2pa ${ARMOR_END}\n` + filler;
  assert.equal(sniffFormat(utf8(midArmor)), 'code');

  // The same bytes with a NUL early in the file are a binary blob: the whole-file
  // pass is skipped, so an unrecognised upload never pays for a full scan.
  const binaryHead = utf8(' BINARY ' + midArmor.slice(0, 4096));
  const binary = new Uint8Array(binaryHead.length + utf8(midArmor).length);
  binary.set(binaryHead, 0);
  binary.set(utf8(midArmor), binaryHead.length);
  assert.equal(sniffFormat(binary), null);
});

test('sniffFormat: existing answers are untouched - no text sniff claims a binary container', () => {
  const png = new Uint8Array(32);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  assert.equal(sniffFormat(png), 'png');
  assert.equal(sniffFormat(latin1('%PDF-1.4 minimal........')), 'pdf');
  assert.equal(sniffFormat(latin1('definitely not any container we know')), null);
  assert.equal(sniffFormat(new Uint8Array(0)), null);
  assert.equal(sniffFormat(latin1('%PDF')), null, 'under 12 bytes is still not sniffed');
});

// ═══ section A.7 - HTML documents ════════════════════════════════════════════════════

test('section A.7.1.1: an inline <script type="application/c2pa"> yields the store and the whole-element exclusion', () => {
  const store = fakeStore(30);
  // Hand-laid so every offset below is arithmetic on known lengths.
  const head = '<!DOCTYPE html>\n<html>\n<head>\n';          // 15 + 1 + 6 + 1 + 7 = 30 bytes
  assert.equal(head.length, 30, 'head prelude is 30 bytes');
  const open = '<script type="application/c2pa">';           // 32 bytes
  assert.equal(open.length, 32);
  const payload = `\n  ${b64(store)}\n`;                     // LF + 2 spaces + base64 + LF
  const close = '</script>';                                 // 9 bytes
  const doc = `${head}${open}${payload}${close}\n</head>\n<body><p>Content here.</p></body>\n</html>\n`;

  const ex = EXTRACTORS.html(utf8(doc));
  assert.ok(ex, 'the inline form extracts');
  assert.ok(sameBytes(ex.manifest, store), 'the store round-trips byte-for-byte');

  const detailed = extractC2paDetailed(utf8(doc))!;
  assert.equal(detailed.format, 'html');
  // section A.7.1.3: ONE exclusion covering the entire element, `<script` through
  // `</script>` INCLUSIVE. start = 30 (the `<` of `<script`);
  // length = 32 (open tag) + payload + 9 (`</script>`).
  assert.deepEqual(detailed.exclusions, [{ start: 30, length: 32 + payload.length + 9 }]);
  assert.equal(detailed.exclusions![0]!.start, doc.indexOf('<script'));
  assert.equal(
    detailed.exclusions![0]!.start + detailed.exclusions![0]!.length,
    doc.indexOf('</script>') + '</script>'.length,
    'the exclusion ends exactly at the end of the closing tag',
  );
  assert.equal(detailed.status, undefined);
  assert.equal(detailed.externalUrl, undefined);
});

test('section A.7.1.1: leading/trailing whitespace is stripped before decoding, and a wrapped payload still decodes', () => {
  const store = fakeStore(90);
  const wrapped = (b64(store).match(/.{1,40}/g) ?? []).join('\n      ');
  const doc = `<!DOCTYPE html><html><head><script type='application/c2pa'>\n      ${wrapped}\n   </script></head><body></body></html>`;
  assert.ok(wrapped.includes('\n'), 'the fixture really is line-wrapped base64');
  assert.ok(sameBytes(EXTRACTORS.html(utf8(doc))!.manifest, store));
});

test('section A.7.1.2: the <link> form reports a URL, embeds nothing, and declares NO exclusion', () => {
  const doc = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n'
    + '<link rel="c2pa-manifest"\n      href="https://fabrikam.com/manifest.c2pa"\n      type="application/c2pa">\n'
    + '</head>\n<body><p>Content here.</p></body>\n</html>\n';
  assert.equal(EXTRACTORS.html(utf8(doc)), null, 'nothing is embedded, so there is no store');
  const d = extractC2paDetailed(utf8(doc))!;
  assert.equal(d.externalUrl, 'https://fabrikam.com/manifest.c2pa');
  assert.equal(d.store, null);
  // section A.7.1.3: "the data hash assertion shall have no exclusion range" - an empty
  // array says that positively, where undefined would only mean "not computed".
  assert.deepEqual(d.exclusions, []);
  // THE ENGINE NEVER FETCHES: reporting the URL is the whole of its job here.
  assert.equal(d.status, undefined);
});

test('section A.7.1.2: rel is matched as a TOKEN, and type is not required for discovery', () => {
  const doc = (rel: string): Uint8Array =>
    utf8(`<!DOCTYPE html><html><head><link rel="${rel}" href="/m.c2pa"></head><body>x</body></html>`);
  // "the validator shall match on the rel attribute alone" - no type= here.
  assert.equal(extractC2paDetailed(doc('c2pa-manifest'))!.externalUrl, '/m.c2pa');
  assert.equal(extractC2paDetailed(doc('C2PA-Manifest'))!.externalUrl, '/m.c2pa', 'rel keywords are ASCII case-insensitive');
  assert.equal(extractC2paDetailed(doc('alternate c2pa-manifest'))!.externalUrl, '/m.c2pa', 'rel is a token list');
  // A neighbouring keyword that merely CONTAINS the token is not the token.
  assert.equal(extractC2paDetailed(doc('c2pa-manifest-preview'))!.externalUrl, undefined);
  assert.equal(extractC2paDetailed(doc('stylesheet'))!.externalUrl, undefined);
});

test('section A.7.1.2: a reference the engine will not hand to a fetcher is reported, not returned', () => {
  const doc = (href: string): Uint8Array =>
    utf8(`<!DOCTYPE html><html><head><link rel="c2pa-manifest" href="${href}"></head><body>x</body></html>`);
  for (const hostile of ['javascript:alert(1)', '//evil.example/m.c2pa', 'file:///etc/passwd', 'not a url']) {
    const d = extractC2paDetailed(doc(hostile))!;
    assert.equal(d.externalUrl, undefined, `${hostile} is not offered as fetchable`);
    assert.equal(d.status, C2PA_TEXT_STATUS.unsupportedReference);
  }
  // Root-relative with a SINGLE slash is fine - same rule /verify's ?src= uses.
  assert.equal(extractC2paDetailed(doc('/info/mastheads/a.c2pa'))!.externalUrl, '/info/mastheads/a.c2pa');
});

test('section A.7.1: more than one association refuses the document - never first-wins', () => {
  const store = fakeStore();
  const twoScripts = `<!DOCTYPE html><html><head>`
    + `<script type="application/c2pa">${b64(store)}</script>`
    + `<script type="application/c2pa">${b64(fakeStore(8))}</script>`
    + `</head><body>x</body></html>`;
  assert.throws(() => EXTRACTORS.html(utf8(twoScripts)), /at most one/);
  assert.equal(extractC2paDetailed(utf8(twoScripts))!.status, C2PA_TEXT_STATUS.htmlMultipleManifests);

  // "...shall not contain both a script element and a link element" (section A.7.1).
  const both = `<!DOCTYPE html><html><head>`
    + `<script type="application/c2pa">${b64(store)}</script>`
    + `<link rel="c2pa-manifest" href="https://example.com/m.c2pa">`
    + `</head><body>x</body></html>`;
  assert.throws(() => EXTRACTORS.html(utf8(both)), /at most one/);
  const d = extractC2paDetailed(utf8(both))!;
  assert.equal(d.status, C2PA_TEXT_STATUS.htmlMultipleManifests);
  assert.equal(d.store, null, 'a decoy appended to a signed page must not win');
});

test('section A.7: an ordinary HTML page carries no credential, and says so without inventing one', () => {
  const doc = utf8('<!DOCTYPE html><html><head><title>x</title>'
    + '<script type="application/ld+json">{"@type":"WebPage"}</script>'
    + '<script src="/app.js"></script></head><body><p>hi</p></body></html>');
  assert.equal(EXTRACTORS.html(doc), null);
  const d = extractC2paDetailed(doc)!;
  assert.deepEqual({ format: d.format, store: d.store, status: d.status }, { format: 'html', store: null, status: undefined });
});

test('section A.7: a truncated paste and a corrupt payload both fail loudly', () => {
  const cut = utf8(`<!DOCTYPE html><html><head><script type="application/c2pa">${b64(fakeStore())}`);
  assert.throws(() => EXTRACTORS.html(cut), /no closing tag/);
  assert.equal(extractC2paDetailed(cut)!.status, C2PA_TEXT_STATUS.htmlUnterminatedScript);

  const junk = utf8('<!DOCTYPE html><html><head><script type="application/c2pa">not~base64!</script></head><body>x</body></html>');
  assert.throws(() => EXTRACTORS.html(junk), /not valid base64/);
  assert.equal(extractC2paDetailed(junk)!.status, C2PA_TEXT_STATUS.malformedBase64);

  // An EMPTY element is absent, not broken - the same call the SVG reader makes.
  const empty = utf8('<!DOCTYPE html><html><head><script type="application/c2pa">   </script></head><body>x</body></html>');
  assert.equal(EXTRACTORS.html(empty), null);
  assert.equal(extractC2paDetailed(empty)!.status, undefined);
});

// ═══ section A.9 - structured text (ASCII armour) ════════════════════════════════════

test('section A.9.3.1 + section A.9.4: a start-of-file comment line excludes { 0, block incl. terminator }', () => {
  const store = fakeStore(21);
  const ref = `data:application/c2pa;base64,${b64(store)}`;
  const line = `// ${ARMOR_BEGIN} ${ref} ${ARMOR_END}`;
  const file = `${line}\nconst x = 1;\nexport default x;\n`;

  assert.ok(sameBytes(EXTRACTORS.code(utf8(file))!.manifest, store), 'the data: URI form decodes inline');
  const d = extractC2paDetailed(utf8(file))!;
  assert.equal(d.format, 'code');
  // section A.9.4, block at the beginning: start 0, length = the block's bytes INCLUDING
  // its trailing line terminator = line.length + 1 (the LF).
  assert.deepEqual(d.exclusions, [{ start: 0, length: line.length + 1 }]);
  assert.equal(d.externalUrl, undefined);
  assert.equal(d.status, undefined);
});

test('section A.9.4: an end-of-file block excludes from the newline BEFORE it, to EOF - CRLF included', () => {
  const ref = 'https://fabrikam.com/manifests/a1b2c3.c2pa';
  const body = '#!/usr/bin/env node\r\nconsole.log(1);\r\n';
  const line = `// ${ARMOR_BEGIN} ${ref} ${ARMOR_END}`;
  const file = `${body}${line}`;                 // no trailing terminator: the block IS the last line

  const d = extractC2paDetailed(utf8(file))!;
  // section A.9.4, block at the end: "start: byte offset of the newline character
  // preceding the manifest block". body ends "...\r\n", so the LF is at
  // body.length - 1 and the CR at body.length - 2 stays inside the hashed
  // content. Spec-literal, and deliberately not "tidied" to swallow the CR.
  assert.deepEqual(d.exclusions, [{ start: body.length - 1, length: file.length - (body.length - 1) }]);
  assert.equal(utf8(file)[body.length - 1], 0x0a, 'the exclusion really does start on the LF');
  assert.equal(utf8(file)[body.length - 2], 0x0d, 'and the CR of the CRLF is left in the hashed content');
  // A URL reference: reported, never fetched, and the block is STILL excluded
  // (unlike section A.7's link form, the armour block is bytes inside the file).
  assert.equal(d.externalUrl, ref);
  assert.equal(d.store, null);
  assert.equal(EXTRACTORS.code(utf8(file)), null);
});

test('section A.9.4: a file that is ONLY the manifest block excludes the whole file', () => {
  const line = `# ${ARMOR_BEGIN} https://example.com/m.c2pa ${ARMOR_END}\n`;
  const d = extractC2paDetailed(utf8(line))!;
  assert.deepEqual(d.exclusions, [{ start: 0, length: line.length }]);
});

test('section A.9.3.2: the front-matter form excludes BEGIN..END, and not the host format fences', () => {
  const store = fakeStore(12);
  const fm = `---\n${ARMOR_BEGIN}\ndata:application/c2pa;base64,${b64(store)}\n${ARMOR_END}\ntitle: My Document\n---\n`;
  const file = `${fm}\n# Heading\n\nBody text.\n`;
  assert.ok(sameBytes(EXTRACTORS.code(utf8(file))!.manifest, store));

  const d = extractC2paDetailed(utf8(file))!;
  // The block spans the BEGIN line through the END line inclusive. The opening
  // `---\n` is 4 bytes of host format, so start = 4; the block ends after the
  // END delimiter's own LF.
  const start = 4;
  const end = file.indexOf(ARMOR_END) + ARMOR_END.length + 1;
  assert.deepEqual(d.exclusions, [{ start, length: end - start }]);
  assert.equal(
    file.slice(start, end),
    `${ARMOR_BEGIN}\ndata:application/c2pa;base64,${b64(store)}\n${ARMOR_END}\n`,
    'the excluded bytes are exactly the block - the --- fences stay in the hash',
  );
});

test('section A.9.3.1: every comment style in the spec table reaches the same reference', () => {
  const ref = 'https://fabrikam.com/manifests/a1b2c3.c2pa';
  const lines = [
    `# ${ARMOR_BEGIN} ${ref} ${ARMOR_END}`,                    // Python
    `// ${ARMOR_BEGIN} ${ref} ${ARMOR_END}`,                   // JavaScript
    `-- ${ARMOR_BEGIN} ${ref} ${ARMOR_END}`,                   // SQL
    `/* ${ARMOR_BEGIN} ${ref} ${ARMOR_END} */`,                // CSS
    `/*! ${ARMOR_BEGIN} ${ref} ${ARMOR_END} */`,               // CSS, preservation hint
    `<!-- ${ARMOR_BEGIN} ${ref} ${ARMOR_END} -->`,             // Markdown
    `; ${ARMOR_BEGIN} ${ref} ${ARMOR_END}`,                    // INI
  ];
  for (const line of lines) {
    const file = `${line}\nbody\n`;
    const d = extractC2paDetailed(utf8(file))!;
    assert.equal(d.externalUrl, ref, `${line.slice(0, 4)} → the reference is read without knowing the comment syntax`);
    // The whole comment LINE is excluded, suffix included (section A.9.4).
    assert.deepEqual(d.exclusions, [{ start: 0, length: line.length + 1 }]);
  }
});

test('section A.9.5: half a block, an empty reference and an unsupported reference are each named', () => {
  const only = utf8(`// ${ARMOR_BEGIN} https://example.com/m.c2pa\nconst x = 1;\n`);
  assert.equal(EXTRACTORS.code(only), null, 'a half-present block is not a credential');
  assert.equal(extractC2paDetailed(only)!.status, C2PA_TEXT_STATUS.structuredTextNoManifest);

  // Prose that QUOTES the delimiter (this repo's own plan does) must not read as
  // a damaged credential - hence a status, not a throw.
  assert.doesNotThrow(() => EXTRACTORS.code(only));

  const empty = utf8(`// ${ARMOR_BEGIN}  ${ARMOR_END}\nconst x = 1;\n`);
  assert.equal(extractC2paDetailed(empty)!.status, C2PA_TEXT_STATUS.structuredTextEmptyReference);

  const hostile = utf8(`// ${ARMOR_BEGIN} javascript:alert(1) ${ARMOR_END}\n`);
  const d = extractC2paDetailed(hostile)!;
  assert.equal(d.status, C2PA_TEXT_STATUS.unsupportedReference);
  assert.equal(d.externalUrl, undefined);

  const badData = utf8(`// ${ARMOR_BEGIN} data:application/c2pa;base64,not~valid! ${ARMOR_END}\n`);
  assert.throws(() => EXTRACTORS.code(badData), /not valid base64/);
  assert.equal(extractC2paDetailed(badData)!.status, C2PA_TEXT_STATUS.malformedBase64);
});

test('section A.9.3: two blocks refuse the file', () => {
  const ref = 'https://example.com/m.c2pa';
  const file = utf8(`// ${ARMOR_BEGIN} ${ref} ${ARMOR_END}\nconst x = 1;\n// ${ARMOR_BEGIN} ${ref} ${ARMOR_END}\n`);
  assert.throws(() => EXTRACTORS.code(file), /at most one/);
  assert.equal(extractC2paDetailed(file)!.status, C2PA_TEXT_STATUS.structuredTextMultipleReferences);
});

// ═══ section A.8 - unstructured text (variation selectors) ═══════════════════════════

test('section A.8.3.1: the byte→selector mapping is the spec table, and the magic has a fixed byte prefix', () => {
  // The four boundaries of the two blocks.
  assert.equal(specByteToVs(0), 0xfe00);
  assert.equal(specByteToVs(15), 0xfe0f);
  assert.equal(specByteToVs(16), 0xe0100);
  assert.equal(specByteToVs(255), 0xe01ef);
  // The 16-byte block is BMP (3 UTF-8 bytes each); the 240-byte block is
  // supplementary (4 bytes each). That asymmetry is what every offset below has
  // to account for.
  assert.equal(utf8(String.fromCodePoint(specByteToVs(15))).length, 3);
  assert.equal(utf8(String.fromCodePoint(specByteToVs(16))).length, 4);

  // Every wrapper therefore starts with the same 7 bytes: U+FEFF (EF BB BF) then
  // the selector for the magic's first byte 0x43 = 67 → U+E0100 + 51 = U+E0133
  // → F3 A0 84 B3. That is the sequence the sniffer looks for.
  const prefix = utf8(wrapperText(fakeStore())).subarray(0, 7);
  assert.deepEqual(Array.from(prefix), [0xef, 0xbb, 0xbf, 0xf3, 0xa0, 0x84, 0xb3]);
});

test('section A.8: a wrapper at the end of visible text round-trips, with hand-computed NFC byte offsets', () => {
  const store = STORE_EDGES;                                   // 00 0f 10 ff 80 01
  const visible = 'Hello, world.';                             // 13 ASCII bytes
  const bytes = utf8(visible + wrapperText(store));

  assert.equal(sniffFormat(bytes), 'text');
  assert.ok(sameBytes(EXTRACTORS.text(bytes)!.manifest, store), 'the store round-trips byte-for-byte');

  const d = extractC2paDetailed(bytes)!;
  assert.equal(d.text!.wrappers.length, 1);
  const w = d.text!.wrappers[0]!;
  // start  = 13   (the U+FEFF, straight after the visible text)
  // selectorStart = 13 + 3 = 16   (U+FEFF is three UTF-8 bytes)
  assert.equal(w.start, 13);
  assert.equal(w.selectorStart, 16);
  // end: the payload is magic(8) + version(1) + length(4) + store(6) = 19 bytes.
  // A selector for a byte ≤ 15 is U+FE00+b - BMP, 3 UTF-8 bytes; one for a byte
  // ≥ 16 is U+E0100+(b−16) - supplementary, 4 UTF-8 bytes:
  //   magic   43 32 50 41 54 58 54 00 → seven high (28) + one low (3)  = 31
  //   version 01                      → low                            =  3
  //   length  00 00 00 06             → four low                       = 12
  //   store   00 0f 10 ff 80 01       → three low (9) + three high (12) = 21
  // total selectors = 31 + 3 + 12 + 21 = 67 bytes, after the 3-byte U+FEFF.
  const payload = wrapperBytes(store);
  assert.equal(wrapperByteLength(payload), 3 + 67);
  assert.equal(w.end, 13 + 3 + 67);
  assert.equal(w.runEnd, w.end, 'the run holds nothing beyond the wrapper');
  assert.equal(w.version, 1);
  assert.equal(w.status, undefined);
  // The reported exclusion covers U+FEFF + selectors (see C2paTextWrapper on the
  // spec's ambiguity); selectorStart is on the wrapper for the other reading.
  assert.deepEqual(d.exclusions, [{ start: 13, length: 3 + 67 }]);
  // ...and the normalized text is exactly the bytes the hash pipeline sees.
  assert.equal(d.text!.nfc.slice(0, visible.length), visible);
  assert.equal(utf8(d.text!.nfc).length, 13 + 3 + 67);
});

test('section A.8.7.3: offsets are measured AFTER NFC - a decomposed é ahead of the wrapper shifts them', () => {
  const store = fakeStore(4);
  // "café" written decomposed: c a f e + U+0301 = 4 + 2 = 6 UTF-8 bytes.
  // NFC composes it to c a f é = 3 + 2 = 5 bytes. So every offset moves by one.
  const decomposed = 'café';
  const composed = 'café';
  assert.equal(utf8(decomposed).length, 6);
  assert.equal(utf8(composed).length, 5);
  assert.equal(decomposed.normalize('NFC'), composed);

  const wrapper = wrapperText(store);
  const dRaw = extractC2paDetailed(utf8(decomposed + wrapper))!;
  const dNfc = extractC2paDetailed(utf8(composed + wrapper))!;

  assert.equal(dRaw.text!.nfc, dNfc.text!.nfc, 'both spellings normalize to the same text');
  assert.equal(dRaw.text!.wrappers[0]!.start, 5, 'the offset is in NFC bytes (5), not raw bytes (6)');
  assert.deepEqual(dRaw.exclusions, dNfc.exclusions, 'and both spellings hash identically');
  assert.ok(sameBytes(dRaw.store!, store));
  assert.ok(sameBytes(dNfc.store!, store));
});

test('section A.8: the wrapper itself is NFC-invariant - normalizing never rewrites the payload', () => {
  // Variation selectors and U+FEFF are all ccc=0 with no decompositions, so NFC
  // can neither reorder nor recompose them. If that were ever false, the offsets
  // above would be measuring a different string than the one carrying the store.
  const store = fakeStore(64);
  const wrapper = wrapperText(store);
  assert.equal(wrapper.normalize('NFC'), wrapper);
  assert.equal(wrapper.normalize('NFD'), wrapper);
});

test('section A.8.4.2: a U+FEFF whose selectors are not the magic is not a wrapper at all', () => {
  // An emoji + skin-tone-style variation sequence after a BOM is ordinary text.
  const bytes = utf8('\uFEFFHeading❤️ and more prose here to read.');
  const d = extractC2paDetailed(bytes);
  // No carrier → not sniffed as text at all, and the detailed read says nothing.
  assert.equal(sniffFormat(bytes), null);
  assert.equal(d, null);
  // Fed the format explicitly, the reader still finds no wrapper (and no status).
  const forced = extractC2paDetailed(bytes, 'text')!;
  assert.deepEqual({ store: forced.store, status: forced.status, n: forced.text!.wrappers.length }, { store: null, status: undefined, n: 0 });
});

test('section A.8: a leading BOM at offset 0 is data, not an encoding hint', () => {
  // TextDecoder eats a leading U+FEFF by default, which would both shift every
  // offset by three AND hide a wrapper placed at the very start of the file.
  const store = fakeStore(5);
  const bytes = utf8(wrapperText(store) + 'trailing visible text');
  const d = extractC2paDetailed(bytes)!;
  assert.equal(d.text!.wrappers[0]!.start, 0);
  assert.equal(d.text!.wrappers[0]!.selectorStart, 3);
  assert.ok(sameBytes(d.store!, store));
  assert.equal(d.text!.nfc.charCodeAt(0), 0xfeff, 'the BOM survives into the hashed text');
});

test('section 15.12.1.3.2: a corrupt wrapper is named, never half-read', () => {
  const store = fakeStore(10);
  const cases: Array<[string, Uint8Array, RegExp]> = [
    // section A.8.2.3 defines version 1 only.
    ['version 2', utf8('text' + wrapperText(store, { version: 2 })), /version 2 is not supported/],
    // manifestLength larger than the text can possibly hold - the allocation
    // guard, and the reason it is derived from the input length.
    ['absurd length', utf8('text' + wrapperText(store, { declaredLength: 0xffffffff })), /more than the remaining text can hold/],
    // A plausible length whose selectors were cut off mid-payload.
    ['truncated payload', utf8('text' + wrapperText(store).slice(0, -4)), /truncated at manifest byte/],
  ];
  for (const [name, bytes, message] of cases) {
    assert.throws(() => EXTRACTORS.text(bytes), message, name);
    const d = extractC2paDetailed(bytes)!;
    assert.equal(d.store, null, `${name}: nothing is returned`);
    assert.equal(d.status, C2PA_TEXT_STATUS.textCorruptedWrapper, name);
    assert.match(d.text!.wrappers[0]!.reason!, message, `${name}: section 15.12.1.3.2 asks for specifics`);
  }
});

test('section A.8: a wrapper that ends the text immediately after its magic is corrupt, not a crash', () => {
  const bare = utf8('prose\uFEFF' + vsRun([0x43, 0x32, 0x50, 0x41, 0x54, 0x58, 0x54, 0x00]));
  const d = extractC2paDetailed(bare)!;
  assert.equal(d.status, C2PA_TEXT_STATUS.textCorruptedWrapper);
  assert.match(d.text!.wrappers[0]!.reason!, /ends immediately after its magic/);
  // ...and one byte further in, inside manifestLength.
  const midLen = utf8('prose\uFEFF' + vsRun([0x43, 0x32, 0x50, 0x41, 0x54, 0x58, 0x54, 0x00, 0x01, 0x00, 0x00]));
  assert.match(extractC2paDetailed(midLen)!.text!.wrappers[0]!.reason!, /inside manifestLength \(2 of 4 bytes\)/);
});

test('section A.8.4.1 + section 15.12.1.3.1: multiple wrappers are ALL reported, and selection is left to the exclusions', () => {
  const first = fakeStore(6);
  const second = STORE_EDGES;
  const bytes = utf8('Part one.' + wrapperText(first) + ' Part two.' + wrapperText(second));
  const d = extractC2paDetailed(bytes)!;

  assert.equal(d.text!.wrappers.length, 2);
  assert.equal(d.status, C2PA_TEXT_STATUS.textMultipleWrappers);
  assert.ok(sameBytes(d.text!.wrappers[0]!.store!, first));
  assert.ok(sameBytes(d.text!.wrappers[1]!.store!, second));
  // Both ranges are usable as-is: wrapper 2 starts after wrapper 1's end plus
  // " Part two." (10 bytes).
  assert.equal(d.text!.wrappers[1]!.start, d.text!.wrappers[0]!.end + 10);
  // Extraction does NOT get to pick - section A.8.4.1 hands that to the assertion's
  // exclusions - so this is a notice, not a throw, and the legacy extractor
  // deterministically answers with the first.
  assert.doesNotThrow(() => EXTRACTORS.text(bytes));
  assert.ok(sameBytes(EXTRACTORS.text(bytes)!.manifest, first));
});

test('section A.8: trailing selectors beyond the wrapper are visible as runEnd > end', () => {
  const store = fakeStore(3);
  const junk = vsRun([0x01, 0x02, 0xfe]);                       // two low (3 bytes) + one high (4)
  const bytes = utf8('x' + wrapperText(store) + junk);
  const w = extractC2paDetailed(bytes)!.text!.wrappers[0]!;
  assert.equal(w.runEnd - w.end, 3 + 3 + 4, 'the three stray selectors are outside the wrapper');
  assert.ok(sameBytes(w.store!, store), 'and do not corrupt it');
});

// ═══ the detailed contract, and byte-compatibility with what was already there ═

test('extractC2paDetailed: a superset of extractC2paStore, never a second code path', async () => {
  // A REAL signed store, through a binary container, to prove the legacy formats
  // pass straight through rather than into a text branch.
  const signed = await embedC2pa(utf8('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4"/></svg>'), 'svg', {
    title: 'Text bindings', claimGenerator: 'Lolly lolly.tools',
  });
  const legacy = extractC2paStore(signed)!;
  const detailed = extractC2paDetailed(signed)!;
  assert.equal(detailed.format, legacy.format);
  assert.equal(detailed.format, 'svg');
  assert.ok(sameBytes(detailed.store!, legacy.store));
  assert.equal(detailed.status, undefined);

  // The same real store, carried by each of the three text bindings, still parses.
  const carriers: Array<[string, Uint8Array]> = [
    ['html', utf8(`<!DOCTYPE html><html><head><script type="application/c2pa">${b64(legacy.store)}</script></head><body>x</body></html>`)],
    ['code', utf8(`// ${ARMOR_BEGIN} data:application/c2pa;base64,${b64(legacy.store)} ${ARMOR_END}\nconst x = 1;\n`)],
    ['text', utf8('A signed paragraph.' + wrapperText(legacy.store))],
  ];
  for (const [format, bytes] of carriers) {
    assert.equal(sniffFormat(bytes), format, `${format}: sniffed`);
    const out = extractC2paStore(bytes)!;
    assert.equal(out.format, format);
    assert.ok(sameBytes(out.store, legacy.store), `${format}: the store survives the carrier byte-for-byte`);
    assert.equal(parseC2paStore(out.store).manifestLabel, parseC2paStore(legacy.store).manifestLabel);
  }
});

test('extractC2paDetailed: null means "not a format we read", not "no credential"', () => {
  assert.equal(extractC2paDetailed(utf8('just some prose, nothing to find in it')), null);
  assert.equal(extractC2paDetailed(null as unknown as Uint8Array), null);
  assert.equal(extractC2paDetailed(new Uint8Array(0)), null);
  // A known format with nothing in it is a DIFFERENT answer, and a useful one.
  const bare = utf8('<!DOCTYPE html><html><head></head><body>hi</body></html>');
  assert.deepEqual(extractC2paDetailed(bare), { store: null, format: 'html' });
});

test('extractC2paDetailed: never throws, whatever the carrier does', () => {
  const throwers = [
    utf8(`<!DOCTYPE html><html><head><script type="application/c2pa">${'!'.repeat(40)}</script></head><body>x</body></html>`),
    utf8(`// ${ARMOR_BEGIN} data:application/c2pa;base64,%%%% ${ARMOR_END}\n`),
    utf8('t' + wrapperText(fakeStore(), { version: 9 })),
  ];
  for (const bytes of throwers) {
    assert.throws(() => EXTRACTORS[sniffFormat(bytes)!]!(bytes), 'the legacy extractor still throws');
    const d = extractC2paDetailed(bytes)!;
    assert.ok(d.status, 'and the detailed read reports it instead');
    assert.equal(d.store, null);
  }
  // A malformed BINARY container reaches the same shape via the legacy path.
  const badPng = new Uint8Array(64);
  badPng.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  badPng.set([0xff, 0xff, 0xff, 0xff], 8);                       // a chunk length that overruns
  const d = extractC2paDetailed(badPng)!;
  assert.equal(d.format, 'png');
  assert.equal(d.status, C2PA_TEXT_STATUS.credentialUnreadable);
  assert.match(d.detail!, /malformed PNG chunk/);
});

// ═══ hostile input: /verify is a public drop target, and after M2 a TEXT one ═══

test('bounds: a hostile text paste is a bounded refusal, not a hang', () => {
  const budget = 5000;

  // A megabyte of variation selectors behind one BOM: the magic check has to bail
  // after EIGHT selectors, or this is a megabyte of work per BOM.
  const t0 = Date.now();
  const longRun = utf8('\uFEFF' + String.fromCodePoint(0xfe00).repeat(400_000));
  assert.equal(extractC2paDetailed(longRun, 'text')!.text!.wrappers.length, 0);
  assert.ok(Date.now() - t0 < budget, 'a long selector run is bailed out of, not walked');

  // Many BOMs, each followed by a short non-magic run.
  const t1 = Date.now();
  const manyBoms = utf8(('\uFEFF' + String.fromCodePoint(0xfe0a).repeat(6)).repeat(50_000));
  assert.equal(extractC2paDetailed(manyBoms, 'text')!.text!.wrappers.length, 0);
  assert.ok(Date.now() - t1 < budget, 'a field of decoy BOMs stays linear');

  // Far more wrappers than section A.8 permits: collected up to the cap, then stopped.
  const t2 = Date.now();
  const swarm = utf8(('pad' + wrapperText(fakeStore(2))).repeat(4000));
  const d = extractC2paDetailed(swarm, 'text')!;
  assert.ok(d.text!.wrappers.length <= 32, 'wrapper collection is capped');
  assert.equal(d.status, C2PA_TEXT_STATUS.textMultipleWrappers);
  assert.ok(Date.now() - t2 < budget, 'a wrapper swarm is capped, not counted');

  // A wrapper claiming 4 GiB of manifest must be refused BEFORE anything is
  // allocated from that number.
  const bomb = utf8('x' + wrapperText(new Uint8Array(4), { declaredLength: 0xffffffff }));
  assert.equal(extractC2paDetailed(bomb)!.status, C2PA_TEXT_STATUS.textCorruptedWrapper);
});

test('bounds: hostile HTML and armour are bounded too', () => {
  const budget = 5000;

  // Ten thousand unterminated <script> opens: tag collection is capped, and the
  // close-tag search never rescans from the top.
  const t0 = Date.now();
  const tagStorm = utf8('<!DOCTYPE html><html><head>' + '<script type="application/c2pa">'.repeat(10_000));
  assert.ok(extractC2paDetailed(tagStorm)!.status, 'a tag storm is reported, not walked forever');
  assert.ok(Date.now() - t0 < budget);

  // An attribute soup with no closing `>` at all.
  const unclosed = utf8('<!DOCTYPE html><html><head><script type="application/c2pa" ' + 'a="b" '.repeat(20_000));
  assert.doesNotThrow(() => extractC2paDetailed(unclosed));

  // Thousands of armour delimiters: counting stops at "more than one".
  const t1 = Date.now();
  const armourStorm = utf8(`${ARMOR_BEGIN} x ${ARMOR_END}\n`.repeat(20_000));
  assert.equal(extractC2paDetailed(armourStorm)!.status, C2PA_TEXT_STATUS.structuredTextMultipleReferences);
  assert.ok(Date.now() - t1 < budget);

  // Nested/overlapping delimiters: still just "more than one".
  const nested = utf8(`// ${ARMOR_BEGIN} ${ARMOR_BEGIN} data:application/c2pa;base64,AAAA ${ARMOR_END} ${ARMOR_END}\n`);
  assert.equal(extractC2paDetailed(nested)!.status, C2PA_TEXT_STATUS.structuredTextMultipleReferences);
});

test('bounds: an oversized text asset is a cheap refusal, not a decode', () => {
  // 17 MB - one byte past the reader cap. It must not be decoded into a string.
  const huge = new Uint8Array(16 * 1024 * 1024 + 1).fill(0x61);
  const t0 = Date.now();
  const d = extractC2paDetailed(huge, 'text')!;
  assert.equal(d.status, C2PA_TEXT_STATUS.tooLarge);
  assert.equal(d.store, null);
  assert.equal(d.text, undefined);
  assert.ok(Date.now() - t0 < 5000);
});

test('every status this module emits is a distinct, stable string', () => {
  // These ride in saved reports and are matched literally by the surfaces, so
  // pin them byte-for-byte - the same rule tests/c2pa-verdict.test.ts applies to
  // C2PA_CHECK. Spec codes first, Lolly extensions namespaced after.
  assert.deepEqual({ ...C2PA_TEXT_STATUS }, {
    htmlMultipleManifests: 'manifest.html.multipleManifests',
    structuredTextMultipleReferences: 'manifest.structuredText.multipleReferences',
    structuredTextNoManifest: 'manifest.structuredText.noManifest',
    structuredTextEmptyReference: 'manifest.structuredText.emptyReference',
    textCorruptedWrapper: 'manifest.text.corruptedWrapper',
    textMultipleWrappers: 'manifest.text.multipleWrappers',
    credentialUnreadable: 'credential.unreadable',
    unsupportedReference: 'lolly.manifest.unsupportedReference',
    malformedBase64: 'lolly.manifest.malformedBase64',
    htmlUnterminatedScript: 'lolly.html.unterminatedScript',
    tooLarge: 'lolly.text.tooLarge',
  });
  const values = Object.values(C2PA_TEXT_STATUS);
  assert.equal(new Set(values).size, values.length, 'no two states share a code');
  for (const v of values) {
    assert.ok(/^(manifest|assertion|credential|lolly)\./.test(v), `${v} is namespaced`);
  }
});

test('the section A.8 wrapper shape is complete enough for the hash pipeline to work from', () => {
  // Builder B's section 15.12.1.3.1 pipeline needs exactly this: the normalized text,
  // every wrapper, and each wrapper's range in that text's encoding. Pin the
  // shape so a later edit cannot quietly drop a field the pipeline reads.
  const d = extractC2paDetailed(utf8('body' + wrapperText(fakeStore(3))))!;
  const w: C2paTextWrapper = d.text!.wrappers[0]!;
  assert.deepEqual(Object.keys(w).sort(), ['end', 'runEnd', 'selectorStart', 'start', 'store', 'version']);
  // Removing [start, end) from the NFC text leaves exactly the visible content - 
  // which is what gets hashed.
  const nfcBytes = utf8(d.text!.nfc);
  const kept = new Uint8Array(nfcBytes.length - (w.end - w.start));
  kept.set(nfcBytes.subarray(0, w.start), 0);
  kept.set(nfcBytes.subarray(w.end), w.start);
  assert.equal(new TextDecoder().decode(kept), 'body');
});

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICATION (Builder B) - section 15.12.1.3 text data hash, section A.7/section A.9 byte-range
// bindings, section 15.12.1.3.4 fragment honesty, section 18.28 ai-disclosure, specVersion.
//
// Everything below goes through the real `verifyC2pa`, against REAL signed
// stores built by the real writer. Nothing stubs the crypto: each fixture signs
// a hash it computed itself from the spec's own rule, so a test failing means
// the verifier and the spec disagree, not that two mocks drifted.
//
// The self-referential bit these fixtures have to solve: a section A.7/section A.8/section A.9
// exclusion's LENGTH is the length of the carrier, and the carrier contains the
// store, whose size depends on the numbers in that exclusion. The hash never
// does (the excluded bytes are removed before hashing), so each signer below
// iterates the length to a fixed point and asserts it converged.
// ═══════════════════════════════════════════════════════════════════════════════

import { verifyC2pa, type C2paReport } from '../engine/src/c2pa-verify.ts';
import { buildC2paManifest, generateSigner, encodeCbor, type Signer, type Exclusion } from '../engine/src/c2pa.ts';
import { C2PA_CHECK } from '../engine/src/c2pa-verdict.ts';
import { sha256 } from '../engine/src/bytes.ts';

const codesOf = (r: C2paReport): string[] => r.checks.map((c) => c.code);
const failedCodes = (r: C2paReport): string[] => r.checks.filter((c) => !c.ok).map((c) => c.code);
/** Every failure except the designed "no pinned trust anchor" marker. */
const realFailures = (r: C2paReport): string[] =>
  failedCodes(r).filter((c) => c !== C2PA_CHECK.signingCredentialUntrusted);

// One signer, one set of dates, fixed labels: the store's SIZE has to be a pure
// function of the exclusion numbers or the fixed-point loops below could oscillate.
const SIGN_DATES = { signedAt: '2026-08-11T09:00:00Z', notBefore: '2026-08-01T00:00:00Z', notAfter: '2036-08-01T00:00:00Z' };
let SIGNER: Signer | null = null;
const fixedSigner = async (): Promise<Signer> => (SIGNER ??= await generateSigner(SIGN_DATES));

async function storeFor(hash: Uint8Array, exclusions: Exclusion[], format: string): Promise<Uint8Array> {
  return buildC2paManifest({
    title: 'A signed text', claimGenerator: 'Lolly lolly.tools',
    generatorInfo: { version: '1.0', specVersion: '2.4.0' },
    assetHash: { exclusions, hash },
    format,
    dates: SIGN_DATES,
    signer: await fixedSigner(),
    manifestLabel: 'urn:uuid:11111111-2222-4333-8444-555555555555',
    instanceId: 'xmp:iid:11111111-2222-4333-8444-555555555556',
  });
}

/**
 * Resolve the self-reference: the exclusion's LENGTH is the carrier's encoded
 * length, the carrier encodes the store, and the store contains that very
 * length. `render(store)` measures the carrier a given store produces.
 *
 * Plain iteration to a fixed point CANNOT converge for section A.8. A wrapper byte
 * ≤ 0x0F encodes to a three-byte variation selector and one above it to four,
 * so the wrapper's length depends on the store's byte MIX, not just its size - 
 * and ECDSA signs with a fresh nonce every call, so two stores of identical
 * size encode to slightly different lengths. So: probe twice to learn the
 * length this store's byte mix lands near (the second probe carries a
 * realistic length field, so its CBOR width is the final one), then hold that
 * number FIXED and re-sign until a store hits it exactly. ~10-30 signatures,
 * hard-bounded, and exact when it returns. The base64 carriers (section A.7/section A.9)
 * depend only on the store's size, so for them the first attempt always wins.
 */
async function landOn(
  mk: (length: number) => Promise<Uint8Array>, cost: (store: Uint8Array) => number,
): Promise<{ store: Uint8Array; length: number }> {
  // Probe once for the ballpark, then once more so the length field carried in
  // the probe has its final CBOR width.
  let target = cost(await mk(cost(await mk(0))));
  const seen = new Map<number, number>();
  for (let i = 0; i < 2000; i++) {
    const store = await mk(target);
    const landed = cost(store);
    if (landed === target) return { store, length: target };
    seen.set(landed, (seen.get(landed) ?? 0) + 1);
    // A single probe can land in the tail of the byte-mix distribution, and
    // re-signing forever at a tail value never hits it. Every 25 misses, re-aim
    // at the value this store's byte mix actually favours (the samples all come
    // from the same distribution, so the estimate only sharpens).
    if (i % 25 === 24) target = [...seen].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0];
  }
  throw new Error('no store encoded to the target carrier length in 2000 tries - fixture bug, not a verifier bug');
}

async function fixedPoint(
  hash: Uint8Array, start: number, format: string, render: (store: Uint8Array) => number,
): Promise<{ store: Uint8Array; exclusion: Exclusion }> {
  const { store, length } = await landOn((n) => storeFor(hash, [{ start, length: n }], format), render);
  return { store, exclusion: { start, length } };
}

// ── section A.8 fixtures ─────────────────────────────────────────────────────────────

/** Sign `visible` (NFC'd), then hang the wrapper off the end of it - section A.8.4.1's
 *  "single contiguous block at the end of the visible text". */
async function signUnstructured(visible: string, opts: { selectorsOnly?: boolean } = {}) {
  const nfc = visible.normalize('NFC');
  const base = utf8(nfc).length;
  // The two readings section A.8 never chooses between: an exclusion starting at the
  // U+FEFF prefix, or at the first variation selector three bytes later. They
  // are NOT interchangeable - under the second, the U+FEFF stays INSIDE the
  // hashed text - so the fixture has to hash whichever one it declares. That
  // asymmetry is the reason the verifier reports which convention matched
  // rather than quietly accepting either against one hash.
  const hash = await sha256(utf8(nfc + (opts.selectorsOnly ? '\ufeff' : '')));
  const start = base + (opts.selectorsOnly ? 3 : 0);
  const { store, exclusion } = await fixedPoint(hash, start, 'text/plain', (s) =>
    wrapperByteLength(wrapperBytes(s)) - (opts.selectorsOnly ? 3 : 0));
  return { store, exclusion, nfc, bytes: utf8(nfc + wrapperText(store)) };
}

// ── section A.7 fixtures ─────────────────────────────────────────────────────────────

const SCRIPT_OPEN = '<script type="application/c2pa">';
const SCRIPT_CLOSE = '</script>';

/** section A.7.1.3: ONE exclusion, `<script` through `</script>` inclusive; the hash
 *  covers the rest of the document as stored. `carve` (test-only) inflates the
 *  exclusion backwards over extra document bytes - the forgery shape. */
async function signHtml(prefix: string, suffix: string, carve = 0) {
  const hash = await sha256(utf8(prefix.slice(0, prefix.length - carve) + suffix));
  const start = prefix.length - carve;
  const { store, exclusion } = await fixedPoint(hash, start, 'text/html', (s) =>
    carve + SCRIPT_OPEN.length + b64(s).length + SCRIPT_CLOSE.length);
  return { store, exclusion, bytes: utf8(prefix + SCRIPT_OPEN + b64(store) + SCRIPT_CLOSE + suffix) };
}

// ── section A.9 fixtures ─────────────────────────────────────────────────────────────

/** section A.9.4 start-of-file case: `start: 0`, `length: the block including its
 *  trailing line terminator`. The hash covers the body only. */
async function signStructured(body: string) {
  const hash = await sha256(utf8(body));
  const line = (s: Uint8Array): string => `// ${ARMOR_BEGIN} data:application/c2pa;base64,${b64(s)} ${ARMOR_END}\n`;
  const { store, exclusion } = await fixedPoint(hash, 0, 'text/javascript', (s) => line(s).length);
  return { store, exclusion, bytes: utf8(line(store) + body) };
}

// ═══ section 15.12.1.3.1 - the text data hash ════════════════════════════════════════

test('section 15.12.1.3: a signed section A.8 text verifies, and says so in the spec\'s own terms', async () => {
  const { bytes, exclusion } = await signUnstructured('The quick brown fox jumps over the lazy dog.');
  const r = await verifyC2pa(bytes);
  assert.equal(r.format, 'text');
  assert.equal(r.found, true);
  assert.equal(r.state, 'valid', `failures: ${realFailures(r).join(', ')}`);
  assert.ok(codesOf(r).includes(C2PA_CHECK.assertionDataHashMatch));
  assert.deepEqual(r.textBinding, {
    kind: 'text', wrappers: 1, matchedWrappers: 1, exclusionsFrom: 'wrapper',
  });
  // The store really was carried by the wrapper, not by anything else.
  assert.equal(exclusion.start, utf8('The quick brown fox jumps over the lazy dog.').length);
});

test('section A.8.7.3: NFC FIRST, then offsets - composed and decomposed é sign identically', async () => {
  // The headline ordering test. "café" spelled two ways, in front of the SAME
  // wrapper: decomposed (e + U+0301) is one UTF-8 byte longer than composed (é),
  // so a validator that measured offsets in the file's own bytes would place the
  // exclusion one byte off for one of the two spellings and hash the wrong text.
  const composed = 'A caf\u00e9 note.';         // \u00e9, 2 UTF-8 bytes
  const decomposed = 'A cafe\u0301 note.';      // e + U+0301, 3 UTF-8 bytes
  assert.equal(decomposed.normalize('NFC'), composed, 'the two spellings are the same text');
  assert.equal(utf8(decomposed).length, utf8(composed).length + 1, 'and they are NOT the same bytes');

  const { store, exclusion } = await signUnstructured(composed);
  assert.equal(exclusion.start, utf8(composed).length, 'the offset is measured in the NFC encoding');

  // ONE store, TWO byte-level spellings of the same asset. Both must verify.
  for (const [name, spelling] of [['composed', composed], ['decomposed', decomposed]] as const) {
    const bytes = utf8(spelling + wrapperText(store));
    const r = await verifyC2pa(bytes);
    assert.equal(r.state, 'valid', `${name}: ${realFailures(r).join(', ')}`);
    assert.ok(codesOf(r).includes(C2PA_CHECK.assertionDataHashMatch), name);
    // …and extraction agrees the wrapper sits at the NFC offset, not the raw one.
    assert.equal(extractC2paDetailed(bytes, 'text')!.text!.wrappers[0]!.start, utf8(composed).length, name);
  }
});

test('section A.8: an exclusion may start at the U+FEFF prefix or at the first selector', async () => {
  // section A.8.6.1 says the exclusions "correspond to the location of the wrapper";
  // section A.8.4.1 calls U+FEFF a PREFIX TO the wrapper and section A.8.2.2's struct begins at
  // the magic. The spec never resolves it, so both readings are honoured and the
  // report says which one the producer used. Neither is looser: each removes
  // wrapper bytes only, and the producer had to hash whichever it chose.
  for (const selectorsOnly of [false, true]) {
    const { bytes } = await signUnstructured('Two readings, one wrapper.', { selectorsOnly });
    const r = await verifyC2pa(bytes);
    assert.equal(r.state, 'valid', `selectorsOnly=${selectorsOnly}: ${realFailures(r).join(', ')}`);
    assert.equal(r.textBinding!.exclusionsFrom, selectorsOnly ? 'selectors' : 'wrapper');
  }
});

test('section 15.12.1.3.1 step 6: the remainder is re-normalized after the wrapper comes out', async () => {
  // The one input where "normalize once, up front" and the spec's literal
  // remove-then-normalize step order disagree: a combining mark sitting AFTER the
  // wrapper. In the whole text the wrapper blocks composition (variation
  // selectors are ccc=0), so NFC leaves "e" + wrapper + U+0301 alone - but once
  // the wrapper is removed the two become adjacent and NFC composes them to "é".
  // section A.8.4.1 makes this unreachable for a conformant producer (the wrapper goes
  // at the END of the visible text); it is pinned so the choice can never drift
  // silently. HASHED: "é" (2 bytes), not "e" + U+0301 (3).
  const hash = await sha256(utf8('\u00e9'));
  const { store, exclusion } = await fixedPoint(hash, 1, 'text/plain', (s) => wrapperByteLength(wrapperBytes(s)));
  const bytes = utf8('e' + wrapperText(store) + '\u0301');
  assert.equal(extractC2paDetailed(bytes, 'text')!.text!.wrappers[0]!.start, exclusion.start, 'the wrapper is where the fixture says');

  const r = await verifyC2pa(bytes);
  assert.equal(r.state, 'valid', `re-normalization is what makes this hash match: ${realFailures(r).join(', ')}`);

  // And the counter-proof: the un-renormalized remainder hashes to something else.
  const naive = await sha256(utf8('e\u0301'));
  assert.notEqual(Buffer.from(naive).toString('hex'), Buffer.from(hash).toString('hex'));
});

test('section 15.12.1.3.1: edited visible text is a MISMATCH - present-and-broken, not absent', async () => {
  const { store } = await signUnstructured('The quick brown fox.');
  // Same byte length, one letter different: the wrapper still sits at the offset
  // the exclusion names, so this exercises the hash, not the exclusion matching.
  const r = await verifyC2pa(utf8('The quick brown FOX.' + wrapperText(store)));
  assert.equal(r.found, true, 'a credential IS here');
  assert.equal(r.state, 'invalid');
  assert.deepEqual(realFailures(r), [C2PA_CHECK.assertionDataHashMismatch]);
  assert.equal(r.textBinding!.matchedWrappers, 1);
  assert.notEqual(r.textBinding!.fragment, true, 'an edit is not a fragment claim');

  // The contrast that makes the row meaningful: no manifest at all.
  const none = await verifyC2pa(utf8('The quick brown fox.'));
  assert.equal(none.found, false);
  assert.equal(none.state, 'none');
  assert.equal(none.checks.length, 0);
});

test('section 15.12.1.3.1 step 3: exclusions naming no wrapper are MALFORMED, not a mismatch', async () => {
  // A crafted assertion that excludes a byte range which is not a wrapper is how
  // a forger would carve unbound content out of a signed text (section A.8.7.3:
  // "validate that excluded regions correspond exactly to wrapper boundaries").
  const store = await storeFor(await sha256(utf8('body')), [{ start: 2, length: 9 }], 'text/plain');
  const r = await verifyC2pa(utf8('body' + wrapperText(store)));
  assert.equal(r.found, true);
  assert.deepEqual(realFailures(r), [C2PA_CHECK.assertionDataHashMalformed]);
  assert.match(r.checks.find((c) => c.code === C2PA_CHECK.assertionDataHashMalformed)!.explanation, /does not correspond to a C2PATextManifestWrapper/);
  assert.equal(r.textBinding!.wrappers, 1);
  assert.equal(r.textBinding!.matchedWrappers, undefined, 'nothing was selected');
});

test('section 15.12.1.3.1 step 4: two wrappers matching the exclusions → multipleWrappers', async () => {
  // section A.8.4.1 says a validator MAY meet several wrappers and that the exclusions
  // choose; the failure is specifically "more than one MATCHES", which is why
  // extraction reports multiplicity as a notice and only validation rejects.
  // The same store twice, so the FIRST wrapper still parses - this has to reach
  // the hard-binding step, not die at "the credential is malformed".
  const visible = 'Part one.';
  const startA = utf8(visible).length;
  const hash = await sha256(utf8(visible));                    // both wrappers are excluded
  const { store } = await landOn(
    (w) => storeFor(hash, [{ start: startA, length: w }, { start: startA + w, length: w }], 'text/plain'),
    (s) => wrapperByteLength(wrapperBytes(s)));
  const r = await verifyC2pa(utf8(visible + wrapperText(store) + wrapperText(store)));
  assert.equal(r.textBinding!.wrappers, 2);
  assert.equal(r.textBinding!.matchedWrappers, 2);
  assert.deepEqual(realFailures(r), [C2PA_CHECK.manifestTextMultipleWrappers]);
  assert.equal(r.state, 'invalid');
});

// ═══ section 15.12.1.3.2 / section 15.12.1.3.4 - corrupt wrappers and fragments ═════════════

test('section 15.12.1.3.4: a truncated wrapper reads as a FRAGMENT of a larger signed text', async () => {
  const { store } = await signUnstructured('A long signed paragraph that someone only copied part of.');
  const whole = wrapperText(store);
  // Copy-paste that stopped early: the visible text is intact, the invisible
  // wrapper is not. This is the shape section 15.12.1.3.4 asks validators to name.
  const r = await verifyC2pa(utf8('A long signed paragraph that someone only copied part of.' + whole.slice(0, -20)));
  assert.equal(r.found, true, 'a wrapper WAS here - this is not "no credential"');
  assert.equal(r.state, 'invalid');
  assert.deepEqual(failedCodes(r), [C2PA_CHECK.manifestTextCorruptedWrapper]);
  assert.equal(r.textBinding!.fragment, true);
  assert.equal(r.textBinding!.status, C2PA_TEXT_STATUS.textCorruptedWrapper);
  assert.match(r.reason!, /truncated|more than the remaining text can hold/);
});

test('section 15.12.1.3.2: an unsupported wrapper VERSION is corrupt, but never called a fragment', async () => {
  // Version 2 may be perfectly complete and simply newer than this verifier.
  // "Your text looks truncated" would be a guess dressed up as a finding.
  const r = await verifyC2pa(utf8('Some text.' + wrapperText(fakeStore(12), { version: 2 })));
  assert.deepEqual(failedCodes(r), [C2PA_CHECK.manifestTextCorruptedWrapper]);
  assert.equal(r.textBinding!.fragment, undefined);
  assert.match(r.reason!, /version 2 is not supported/);
});

test('section 15.12.1.3.4: an exclusion past the end of the text is the other fragment shape', async () => {
  // The signed original was LONGER than this copy: the wrapper survived the
  // paste (it sits at the end) but the visible text in front of it was cut, so
  // the offsets the assertion recorded now point past the end of what we hold.
  const { store } = await signUnstructured('A whole paragraph of signed prose, of which this is only the start.');
  const r = await verifyC2pa(utf8('A whole' + wrapperText(store)));
  assert.equal(r.found, true);
  assert.deepEqual(realFailures(r), [C2PA_CHECK.assertionDataHashMalformed]);
  assert.equal(r.textBinding!.fragment, true);
  assert.match(r.checks.find((c) => c.code === C2PA_CHECK.assertionDataHashMalformed)!.explanation, /signed text was longer than this copy/);
});

// ═══ section A.7 - HTML documents ════════════════════════════════════════════════════

const HTML_PREFIX = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Example</title>\n';
const HTML_SUFFIX = '\n</head>\n<body>\n<p>Content here.</p>\n</body>\n</html>\n';

test('section A.7.1.3: a signed HTML document verifies over its bytes as stored', async () => {
  const { bytes } = await signHtml(HTML_PREFIX, HTML_SUFFIX);
  const r = await verifyC2pa(bytes);
  assert.equal(r.format, 'html');
  assert.equal(r.state, 'valid', realFailures(r).join(', '));
  assert.ok(codesOf(r).includes(C2PA_CHECK.assertionDataHashMatch));
  assert.deepEqual(r.textBinding, { kind: 'html' });
  assert.equal(r.specVersion, '2.4.0');
});

test('section A.7.1.3: re-serialization invalidates BY DESIGN, and stays distinguishable from absent', async () => {
  const { bytes } = await signHtml(HTML_PREFIX, HTML_SUFFIX);
  // One byte outside the script element, same length - a formatter's quote-style
  // or whitespace change is the same class of edit, just messier to hand-build.
  const edited = bytes.slice();
  edited[bytesIndexOf(edited, 'Content here.')] = 0x63;          // 'C' -> 'c'

  const r = await verifyC2pa(edited);
  assert.equal(r.found, true, 'the manifest is still right there');
  assert.equal(r.state, 'invalid');
  assert.deepEqual(realFailures(r), [C2PA_CHECK.assertionDataHashMismatch]);
  assert.ok(r.claim, 'and its CONTENT is still readable and shown');
});

test('section A.7.1.2: a <link> reference is manifest.inaccessible - the engine never fetches', async () => {
  const doc = utf8(`${HTML_PREFIX}<link rel="c2pa-manifest" href="https://fabrikam.example/manifest.c2pa" type="application/c2pa">${HTML_SUFFIX}`);
  const r = await verifyC2pa(doc);
  assert.equal(r.found, true, 'an association IS declared - "no credential" would be a lie');
  assert.equal(r.state, 'invalid', 'and nothing about these bytes could be checked');
  assert.deepEqual(failedCodes(r), [C2PA_CHECK.manifestInaccessible]);
  assert.equal(r.textBinding!.manifestUrl, 'https://fabrikam.example/manifest.c2pa');
  assert.match(r.reason!, /never fetches/);
});

test('section A.7.1.4: two manifest elements refuse the document, first-wins never happens', async () => {
  const two = utf8(`${HTML_PREFIX}${SCRIPT_OPEN}AAAA${SCRIPT_CLOSE}\n<link rel="c2pa-manifest" href="https://a.example/m.c2pa">${HTML_SUFFIX}`);
  const r = await verifyC2pa(two);
  assert.equal(r.found, true);
  assert.deepEqual(failedCodes(r), [C2PA_CHECK.manifestHtmlMultipleManifests]);
  assert.equal(r.textBinding!.status, C2PA_TEXT_STATUS.htmlMultipleManifests);
});

test('section A.7.1.3: an exclusion wider than the <script> element is refused, hash or no hash', async () => {
  // The forgery this check exists for: the exclusion swallows a paragraph as
  // WELL as the manifest element, so those bytes are unbound - and the hash the
  // page ships is computed over the remainder, so it MATCHES. Without the
  // conformance check this file would read "valid" with unbound content in it.
  const secret = '<p>UNBOUND CONTENT</p>\n';
  const { bytes } = await signHtml(HTML_PREFIX + secret, HTML_SUFFIX, secret.length);
  const r = await verifyC2pa(bytes);
  assert.equal(r.state, 'invalid');
  assert.deepEqual(realFailures(r), [C2PA_CHECK.assertionDataHashAdditionalExclusions]);
  assert.match(r.checks.find((c) => !c.ok && c.code === C2PA_CHECK.assertionDataHashAdditionalExclusions)!.explanation, /section A\.7\.1\.3/);
});

// ═══ section A.9 - structured text ═══════════════════════════════════════════════════

test('section A.9.4: a signed armour block at the start of a file verifies', async () => {
  const { bytes } = await signStructured('export const answer = 42;\n');
  const r = await verifyC2pa(bytes);
  assert.equal(r.format, 'code');
  assert.equal(r.state, 'valid', realFailures(r).join(', '));
  assert.deepEqual(r.textBinding, { kind: 'structuredText' });
});

test('section A.9.4: editing the body breaks the binding; the block itself is excluded', async () => {
  const { store, bytes } = await signStructured('export const answer = 42;\n');
  assert.ok(store.length > 0);
  const edited = bytes.slice();
  edited[bytesIndexOf(edited, 'answer = 42') + 9] = 0x35;        // 4 -> 5
  const r = await verifyC2pa(edited);
  assert.deepEqual(realFailures(r), [C2PA_CHECK.assertionDataHashMismatch]);
  assert.equal(r.found, true);
});

test('section A.9.3/section A.9.5: multiple blocks, an empty reference and a bad reference each get their own code', async () => {
  const two = utf8(`# ${ARMOR_BEGIN} https://a.example/m.c2pa ${ARMOR_END}\nx = 1\n# ${ARMOR_BEGIN} https://b.example/m.c2pa ${ARMOR_END}\n`);
  assert.deepEqual(failedCodes(await verifyC2pa(two)), [C2PA_CHECK.manifestStructuredTextMultipleReferences]);

  const empty = utf8(`# ${ARMOR_BEGIN}   ${ARMOR_END}\nx = 1\n`);
  assert.deepEqual(failedCodes(await verifyC2pa(empty)), [C2PA_CHECK.manifestStructuredTextEmptyReference]);

  const bad = utf8(`# ${ARMOR_BEGIN} javascript:alert(1) ${ARMOR_END}\nx = 1\n`);
  const r = await verifyC2pa(bad);
  assert.deepEqual(failedCodes(r), [C2PA_CHECK.manifestStructuredTextMalformedReference]);
  assert.equal(r.textBinding!.manifestUrl, undefined, 'a refused reference is never handed to a fetcher');
});

test('section A.9.3: a URL reference is manifest.inaccessible, with the URL carried up', async () => {
  const r = await verifyC2pa(utf8(`// ${ARMOR_BEGIN} https://fabrikam.example/a1b2c3.c2pa ${ARMOR_END}\nconst x = 1;\n`));
  assert.equal(r.found, true);
  assert.deepEqual(failedCodes(r), [C2PA_CHECK.manifestInaccessible]);
  assert.equal(r.textBinding!.manifestUrl, 'https://fabrikam.example/a1b2c3.c2pa');
});

test('section A.9.5 DEVIATION: half a delimiter is "no credential", not a broken one', async () => {
  // Spec-literal would be a manifest.structuredText.noManifest FAILURE. But this
  // file only sniffed as structured text BECAUSE one delimiter appeared in it - 
  // and prose that quotes `-----BEGIN C2PA MANIFEST-----` (this repo's own plans
  // do) is byte-identical to a damaged block. Calling that a broken credential is
  // the louder lie, so the status is reported and the verdict is withheld.
  const prose = utf8(`Docs: a manifest block opens with ${ARMOR_BEGIN} and closes with the matching END line.\n`);
  assert.equal(sniffFormat(prose), 'code');
  const r = await verifyC2pa(prose);
  assert.equal(r.found, false);
  assert.equal(r.state, 'none');
  assert.deepEqual(r.checks, []);
  assert.equal(r.textBinding!.status, C2PA_TEXT_STATUS.structuredTextNoManifest);
  assert.match(r.reason!, /delimiters are not both present/);
});

// ═══ section 18.28 c2pa.ai-disclosure - every format, liberal, never a failure ═══════

// ISO 19566-5 boxes: [u32 length][4cc type][payload]. Adding an assertion means
// appending one superbox to c2pa.assertions and growing exactly the three boxes
// that contain it. Written here rather than imported so the test does not depend
// on the writer gaining an "extra assertions" option it does not have.
const cat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const u32be = (n: number): Uint8Array => Uint8Array.of((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
const fourcc = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0));
const isoBox = (type: string, ...parts: Uint8Array[]): Uint8Array => {
  const body = cat(...parts);
  return cat(u32be(8 + body.length), fourcc(type), body);
};
const JUMBF_UUID_SUFFIX = Uint8Array.of(0x00, 0x11, 0x00, 0x10, 0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71);
const cborAssertionBox = (label: string, content: Uint8Array): Uint8Array => isoBox('jumb',
  isoBox('jumd', cat(fourcc('cbor'), JUMBF_UUID_SUFFIX), Uint8Array.of(0x03), utf8(label), Uint8Array.of(0)),
  isoBox('cbor', content));

interface Box { type: string; start: number; payloadStart: number; end: number }
function childBoxes(b: Uint8Array, start: number, end: number): Box[] {
  const out: Box[] = [];
  const dv = new DataView(b.buffer, b.byteOffset);
  for (let i = start; i + 8 <= end; ) {
    const len = dv.getUint32(i);
    if (len < 8 || i + len > end) break;
    out.push({ type: String.fromCharCode(b[i + 4]!, b[i + 5]!, b[i + 6]!, b[i + 7]!), start: i, payloadStart: i + 8, end: i + len });
    i += len;
  }
  return out;
}
function boxLabel(b: Uint8Array, box: Box): string {
  const jumd = childBoxes(b, box.payloadStart, box.end)[0]!;
  const rest = b.slice(jumd.payloadStart + 17, jumd.end);          // uuid(16) + toggles(1)
  const nul = rest.indexOf(0);
  return new TextDecoder().decode(nul >= 0 ? rest.slice(0, nul) : rest);
}
/** Append an assertion to the ACTIVE manifest's assertion store. The claim does
 *  not reference it, which is exactly right: unreferenced assertions are not
 *  hashed-URI checked, so this adds a fact without forging one. */
function withAssertion(store: Uint8Array, label: string, content: Uint8Array): Uint8Array {
  const top = childBoxes(store, 0, store.length)[0]!;
  const manifests = childBoxes(store, top.payloadStart, top.end).filter((k) => k.type === 'jumb');
  const manifest = manifests[manifests.length - 1]!;
  const assertions = childBoxes(store, manifest.payloadStart, manifest.end)
    .filter((k) => k.type === 'jumb').find((k) => boxLabel(store, k) === 'c2pa.assertions')!;
  const box = cborAssertionBox(label, content);
  const out = cat(store.subarray(0, assertions.end), box, store.subarray(assertions.end));
  const src = new DataView(store.buffer, store.byteOffset);
  const dst = new DataView(out.buffer);
  for (const b of [top, manifest, assertions]) dst.setUint32(b.start, src.getUint32(b.start) + box.length);
  return out;
}

/** Sign `visible`, then splice `extra` assertions into the store BEFORE the
 *  carrier is built - the wrapper is excluded from the hash, so its size may
 *  change freely as long as the exclusion length follows. */
async function signUnstructuredWith(visible: string, label: string, content: Uint8Array) {
  const nfc = visible.normalize('NFC');
  const hash = await sha256(utf8(nfc));
  const start = utf8(nfc).length;
  const { store } = await landOn(
    async (length) => withAssertion(await storeFor(hash, [{ start, length }], 'text/plain'), label, content),
    (s) => wrapperByteLength(wrapperBytes(s)));
  return utf8(nfc + wrapperText(store));
}

test('section 18.28: c2pa.ai-disclosure is read, on an otherwise ordinary intact credential', async () => {
  // section 18.28.4's own example, field for field.
  const disclosure = encodeCbor({
    modelType: 'c2pa.types.model.huggingface.transformers',
    modelName: 'Llama 2 70B Chat',
    modelIdentifier: 'pkg:huggingface/meta-llama/Llama-2-70b-chat-hf@main',
    contentProfile: { humanOversightLevel: 'fully_autonomous' },
    scientificDomain: 'astro-ph.CO',                              // a bare string, as the spec's example ships it
  });
  const bytes = await signUnstructuredWith('Generated prose.', 'c2pa.ai-disclosure', disclosure);
  const r = await verifyC2pa(bytes);
  assert.equal(r.state, 'valid', realFailures(r).join(', '));
  assert.deepEqual(r.aiDisclosure, {
    modelType: 'c2pa.types.model.huggingface.transformers',
    modelName: 'Llama 2 70B Chat',
    modelIdentifier: 'pkg:huggingface/meta-llama/Llama-2-70b-chat-hf@main',
    oversight: 'fully_autonomous',
    scientificDomain: ['astro-ph.CO'],
  });
  // It is claim CONTENT, not a verdict: nothing about the ladder moved.
  assert.equal(r.aiGenerated, undefined, 'ai-disclosure is not digitalSourceType');
  assert.equal(r.madeWithLolly, true);
});

test('section 18.28: a malformed or partial disclosure is ABSENT, never a failure', async () => {
  const cases: Array<[string, Uint8Array]> = [
    ['not a map', encodeCbor(['modelType', 'x'])],
    ['empty map', encodeCbor({})],
    ['no recognised field', encodeCbor({ modelFrontier: true, harmEvaluation: { a: 1 } })],
    ['garbage bytes', Uint8Array.of(0xff, 0xfe, 0xfd, 0x00, 0x7f)],
    ['modelType absent (required by the CDDL, tolerated on read)', encodeCbor({ modelName: 'Some Model' })],
  ];
  for (const [name, content] of cases) {
    const r = await verifyC2pa(await signUnstructuredWith('Prose.', 'c2pa.ai-disclosure', content));
    assert.equal(r.state, 'valid', `${name}: a bad disclosure must never break a good file`);
    assert.ok(!realFailures(r).length, name);
    if (name.startsWith('modelType absent')) assert.deepEqual(r.aiDisclosure, { modelName: 'Some Model' }, name);
    else assert.equal(r.aiDisclosure, undefined, name);
  }
});

test('section 18.28: a multi-instance label (c2pa.ai-disclosure__1) is read too', async () => {
  const bytes = await signUnstructuredWith('Prose.', 'c2pa.ai-disclosure__1', encodeCbor({ modelType: 'c2pa.types.model.custom' }));
  assert.deepEqual((await verifyC2pa(bytes)).aiDisclosure, { modelType: 'c2pa.types.model.custom' });
});

test('section 18.28 applies to EVERY format, not just the text bindings', async () => {
  // The standalone win: this upgrades image/PDF verification the day any
  // generator adopts the assertion. Proven through a binary container.
  const svg = utf8('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4"/></svg>');
  const signed = await embedC2pa(svg, 'svg', { title: 'Disclosed', claimGenerator: 'Lolly lolly.tools' });
  const plain = await verifyC2pa(signed);
  assert.equal(plain.aiDisclosure, undefined, 'absent when the assertion is absent');
  assert.equal(plain.format, 'svg');
  // Carry the SAME store, plus a disclosure, through a text binding: the read is
  // format-independent because it happens on the parsed store, not the carrier.
  const store = withAssertion(extractC2paStore(signed)!.store, 'c2pa.ai-disclosure', encodeCbor({ modelType: 'c2pa.types.model.other' }));
  const carried = utf8(`// ${ARMOR_BEGIN} data:application/c2pa;base64,${b64(store)} ${ARMOR_END}\nconst x = 1;\n`);
  assert.deepEqual((await verifyC2pa(carried)).aiDisclosure, { modelType: 'c2pa.types.model.other' });
});

// ═══ claim_generator_info.specVersion (2.4 moved it out of the claim) ═════════

test('specVersion is read from claim_generator_info, and from the deprecated claim field', async () => {
  const { bytes } = await signUnstructured('Versioned.');
  const r = await verifyC2pa(bytes);
  assert.equal(r.specVersion, '2.4.0');
  assert.equal(r.claim!.generatorInfo!.specVersion, '2.4.0', 'and it stays visible where it lives');

  // A store with no specVersion anywhere reports none - never a guess.
  const svg = utf8('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4"/></svg>');
  const signed = await embedC2pa(svg, 'svg', { title: 'No version', claimGenerator: 'Lolly lolly.tools' });
  assert.equal((await verifyC2pa(signed)).specVersion, undefined);
});

// ── a tiny byte-search helper the HTML/armour edits above lean on ─────────────
function bytesIndexOf(hay: Uint8Array, needle: string): number {
  const n = Uint8Array.from(needle, (c) => c.charCodeAt(0));
  outer: for (let i = 0; i + n.length <= hay.length; i++) {
    for (let j = 0; j < n.length; j++) if (hay[i + j] !== n[j]) continue outer;
    return i;
  }
  return -1;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOSTILE FIXTURE CORPUS - recipe from plans/105-m1-brief.md's corpus task.
//
// This section is APPENDED ONLY: nothing above is edited. Every case here is a
// completion test, not a correctness test: /verify is a public drop target for
// hostile bytes, and after M2 it is a hostile TEXT target too, so the one
// property that actually matters is "this call returns, quickly, without
// throwing, and never reports a forged/garbage input as valid". Where a case
// exposes a real defect rather than confirming a refusal, the assertion is
// loosened to the honest bar and the defect is written up in
// plans/105-m1/corpus-findings.md with a TODO comment pointing at it, per the
// corpus task's instructions - no engine code is touched from this file.
//
// Every test below is wrapped in a wall-clock budget so a hang fails the run
// instead of freezing it.
// ═══════════════════════════════════════════════════════════════════════════════

/** Runs `fn`, failing the assertion (not the process) if it takes longer than
 *  `budgetMs`. `fn` itself is still synchronous/awaited inline - this is a
 *  tripwire for "the call actually returned", not a preemptive kill. */
async function withBudget<T>(budgetMs: number, fn: () => T | Promise<T>): Promise<T> {
  const start = Date.now();
  const result = await fn();
  const elapsed = Date.now() - start;
  assert.ok(elapsed < budgetMs, `must complete within ${budgetMs}ms, took ${elapsed}ms`);
  return result;
}

/** Never throws; wraps the outcome so a test can assert "no uncaught throw"
 *  while still inspecting what happened. */
async function safely<T>(fn: () => T | Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    return { ok: false, error };
  }
}

/** verifyC2pa must never report a hostile/garbage fixture as valid. */
function assertNeverValid(outcome: Awaited<ReturnType<typeof safely<C2paReport>>>, label: string): void {
  assert.equal(outcome.ok, true, `${label}: verifyC2pa must not throw - ${!outcome.ok ? outcome.error : ''}`);
  if (outcome.ok) assert.notEqual(outcome.value.state, 'valid', `${label}: a hostile fixture must never verify`);
}

// ── (1) truncated section A.8 wrapper at every boundary ───────────────────────────────

test('hostile section A.8: wrapper truncated mid-magic, mid-version/length, and mid-payload', async () => {
  const store = fakeStore(40);
  const full = wrapperBytes(store); // magic(8) + version(1) + length(4) + payload(40)
  const boundaries = [1, 4, 7, 8, 9, 10, 12, 13, 20, 40, 52]; // spans magic through mid-payload
  for (const cut of boundaries) {
    const truncated = full.slice(0, cut);
    const bytes = utf8('Some visible prose.') as Uint8Array;
    const withTail = new Uint8Array(bytes.length + 3 + truncated.length * 4); // generous upper bound
    withTail.set(bytes, 0);
    const text = 'Some visible prose.' + '\uFEFF' + vsRun(truncated);
    const asBytes = utf8(text);
    await withBudget(2000, () => {
      const sniff = sniffFormat(asBytes);
      // A run this short may or may not clear the wrapper-signature check; either
      // answer is fine, but it must never throw.
      assert.ok(sniff === 'text' || sniff === null, `cut=${cut}: unexpected sniff ${sniff}`);
    });
    const detailed = await safely(() => extractC2paDetailed(asBytes, 'text'));
    assert.equal(detailed.ok, true, `cut=${cut}: extractC2paDetailed must not throw`);
    if (detailed.ok && detailed.value) {
      // Present-but-unusable must be reported honestly, never as a readable store.
      const w = detailed.value.text?.wrappers ?? [];
      for (const wrapper of w) {
        if (!wrapper.store) assert.ok(wrapper.status, `cut=${cut}: an unreadable wrapper must carry a status`);
      }
    }
    // Legacy contract (per the module's own header comment): null = nothing
    // here, or a THROW when a credential is declared but cannot be read. A
    // throw is therefore an allowed, honest outcome for a truncated wrapper - 
    // the hostile bar is "a well-formed Error, not a hang or a raw crash".
    const legacy = await safely(() => EXTRACTORS.text?.(asBytes));
    if (!legacy.ok) assert.ok(legacy.error instanceof Error, `cut=${cut}: a legacy throw must be a proper Error`);
  }
});

// ── (2) 2 MB variation-selector runs ────────────────────────────────────────────

test('hostile section A.8: a 2 MB run of variation selectors with no U+FEFF is inert', async () => {
  // No BOM prefix at all - must sniff null and never be mistaken for a wrapper.
  const bigRun = vsRun(Array.from({ length: 500_000 }, (_, i) => i & 0xff));
  const bytes = utf8('prefix text ' + bigRun);
  await withBudget(5000, () => {
    assert.equal(sniffFormat(bytes), null, 'no U+FEFF prefix means no wrapper, however long the run');
  });
  const detailed = await safely(() => extractC2paDetailed(bytes, 'text'));
  assert.equal(detailed.ok, true, 'must not throw even when forced to treat it as text');
});

test('hostile section A.8: U+FEFF followed by a 2 MB run of garbage-magic selectors', async () => {
  // U+FEFF present, but the first 8 decoded bytes never match "C2PATXT\0".
  const garbage = Array.from({ length: 500_000 }, (_, i) => (i * 91 + 5) & 0xff);
  // Make sure it does not coincidentally start with the real magic bytes.
  const magic = [0x43, 0x32, 0x50, 0x41, 0x54, 0x58, 0x54, 0x00];
  if (magic.every((b, i) => garbage[i] === b)) garbage[0] = (garbage[0]! + 1) & 0xff;
  const bytes = utf8('\uFEFF' + vsRun(garbage));
  const sniffOutcome = await safely(() => withBudget(5000, () => sniffFormat(bytes)));
  assert.equal(sniffOutcome.ok, true, 'sniffFormat must not throw on a 2 MB garbage-magic run');
  if (sniffOutcome.ok) assert.equal(sniffOutcome.value, null, 'garbage magic behind a real BOM must not sniff as text');
  const detailed = await safely(() => withBudget(5000, () => extractC2paDetailed(bytes, 'text')));
  assert.equal(detailed.ok, true, 'extractC2paDetailed must not throw on garbage magic');
});

// ── (3) section A.9 armour edge shapes ─────────────────────────────────────────────────

test('hostile section A.9: only BEGIN, only END, two blocks, a non-base64 data URI, and a 4 MB EOF-exact block', async () => {
  const onlyBegin = utf8(`// ${ARMOR_BEGIN}\nconst x = 1;\n`);
  const onlyEnd = utf8(`// ${ARMOR_END}\nconst x = 1;\n`);
  const twoBlocks = utf8(
    `// ${ARMOR_BEGIN} https://example.com/a.c2pa ${ARMOR_END}\n` +
    `// ${ARMOR_BEGIN} https://example.com/b.c2pa ${ARMOR_END}\n`,
  );
  const notBase64 = utf8(`// ${ARMOR_BEGIN} data:application/c2pa;base64,not~valid~base64!! ${ARMOR_END}\n`);

  for (const [label, bytes] of [
    ['only BEGIN', onlyBegin], ['only END', onlyEnd], ['two blocks', twoBlocks], ['non-base64 data URI', notBase64],
  ] as const) {
    await withBudget(2000, () => {
      const sniff = safelySync(() => sniffFormat(bytes));
      assert.equal(sniff.ok, true, `${label}: sniffFormat must not throw`);
    });
    const detailed = await safely(() => extractC2paDetailed(bytes, 'code'));
    assert.equal(detailed.ok, true, `${label}: extractC2paDetailed must not throw`);
    const outcome = await safely(() => verifyC2pa(bytes));
    assertNeverValid(outcome, label);
  }

  // A 4 MB file with the armour landing exactly at EOF, no trailing newline - 
  // also exercises the "full scan only for files ≤ 4 MB" boundary from the brief.
  const filler = 'x'.repeat(4 * 1024 * 1024 - 200);
  const eofExact = utf8(`${filler}// ${ARMOR_BEGIN} https://example.com/m.c2pa ${ARMOR_END}`);
  await withBudget(5000, () => {
    const sniff = safelySync(() => sniffFormat(eofExact));
    assert.equal(sniff.ok, true, '4 MB EOF-exact armour: sniffFormat must not throw');
  });
  const eofOutcome = await safely(() => withBudget(5000, () => verifyC2pa(eofExact)));
  assert.equal(eofOutcome.ok, true, '4 MB EOF-exact armour: verifyC2pa must not throw or hang');
});

function safelySync<T>(fn: () => T): { ok: true; value: T } | { ok: false; error: unknown } {
  try {
    return { ok: true, value: fn() };
  } catch (error) {
    return { ok: false, error };
  }
}

// ── (4) section A.7 HTML hostile shapes ────────────────────────────────────────────────

test('hostile section A.7: two scripts, an unclosed script, a script after 1 MB of body, and an empty href link', async () => {
  const store = fakeStore(20);
  const twoScripts = utf8(
    '<!DOCTYPE html><html><head>' +
      `${SCRIPT_OPEN}${b64(store)}${SCRIPT_CLOSE}` +
      `${SCRIPT_OPEN}${b64(store)}${SCRIPT_CLOSE}` +
      '</head><body></body></html>',
  );
  const unclosed = utf8(`<!DOCTYPE html><html><head>${SCRIPT_OPEN}${b64(store)}</head><body>no closing tag here</body>`);
  const paddedBody = 'y'.repeat(1024 * 1024);
  const afterPadding = utf8(
    `<!DOCTYPE html><html><head><title>t</title></head><body>${paddedBody}` +
      `${SCRIPT_OPEN}${b64(store)}${SCRIPT_CLOSE}</body></html>`,
  );
  const emptyHrefLink = utf8('<!DOCTYPE html><html><head><link rel="c2pa-manifest" href=""></head><body></body></html>');

  for (const [label, bytes] of [
    ['two scripts', twoScripts], ['unclosed script', unclosed],
    ['script after 1 MB body', afterPadding], ['empty href link', emptyHrefLink],
  ] as const) {
    await withBudget(5000, () => {
      const sniff = safelySync(() => sniffFormat(bytes));
      assert.equal(sniff.ok, true, `${label}: sniffFormat must not throw`);
      assert.equal(sniff.ok && sniff.value, 'html', `${label}: still a real HTML document`);
    });
    const detailed = await safely(() => extractC2paDetailed(bytes, 'html'));
    assert.equal(detailed.ok, true, `${label}: extractC2paDetailed must not throw`);
    const outcome = await safely(() => verifyC2pa(bytes));
    assertNeverValid(outcome, label);
  }
});

// ── (5) SVG inside an HTML doc, before and after the 4 KB sniff boundary ────────

test('hostile sniff: an inline <svg> inside HTML, once before and once after the 4 KB head window', async () => {
  const early = utf8('<!DOCTYPE html><html><head></head><body><svg viewBox="0 0 1 1"><rect width="1" height="1"/></svg></body></html>');
  await withBudget(1000, () => {
    assert.equal(sniffFormat(early), 'html', 'an early inline <svg> must not steal the sniff from its host document');
  });

  const filler = '<!-- padding --> '.repeat(400);
  const late = utf8(
    `<!DOCTYPE html><html><head><title>t</title></head><body>${filler}` +
      '<svg viewBox="0 0 1 1"><rect width="1" height="1"/></svg></body></html>',
  );
  assert.ok(late.length > 4096, 'the late <svg> fixture really does exceed the 4 KB head window');
  await withBudget(1000, () => {
    assert.equal(sniffFormat(late), 'html', 'the doctype at byte 0 still wins even with the <svg> past 4 KB');
  });
});

// ── (6) declared exclusion ranges: out of order / overlapping / past EOF ───────

test('hostile exclusions: out of order, overlapping, and past-EOF ranges never verify - html, code, text', async () => {
  const cases: Array<{ label: string; exclusions: Exclusion[] }> = [
    { label: 'out of order', exclusions: [{ start: 50, length: 5 }, { start: 0, length: 5 }] },
    { label: 'overlapping', exclusions: [{ start: 0, length: 20 }, { start: 10, length: 20 }] },
    { label: 'past EOF', exclusions: [{ start: 0, length: 10_000_000 }] },
    { label: 'negative start', exclusions: [{ start: -5, length: 5 }] },
    { label: 'zero-length flood', exclusions: Array.from({ length: 5000 }, (_, i) => ({ start: i, length: 0 })) },
  ];

  for (const { label, exclusions } of cases) {
    // ── html ──
    {
      const hash = await sha256(utf8('irrelevant'));
      const store = await storeFor(hash, exclusions, 'text/html');
      const bytes = utf8(`<!DOCTYPE html><html><head>${SCRIPT_OPEN}${b64(store)}${SCRIPT_CLOSE}</head><body>hi</body></html>`);
      const outcome = await safely(() => withBudget(3000, () => verifyC2pa(bytes)));
      assertNeverValid(outcome, `html/${label}`);
    }
    // ── code (section A.9) ──
    {
      const hash = await sha256(utf8('irrelevant'));
      const store = await storeFor(hash, exclusions, 'text/javascript');
      const bytes = utf8(`// ${ARMOR_BEGIN} data:application/c2pa;base64,${b64(store)} ${ARMOR_END}\nconst x = 1;\n`);
      const outcome = await safely(() => withBudget(3000, () => verifyC2pa(bytes)));
      assertNeverValid(outcome, `code/${label}`);
    }
    // ── text (section A.8) ──
    {
      const hash = await sha256(utf8('irrelevant'));
      const store = await storeFor(hash, exclusions, 'text/plain');
      const bytes = utf8('Some visible prose.' + wrapperText(store));
      const outcome = await safely(() => withBudget(3000, () => verifyC2pa(bytes)));
      assertNeverValid(outcome, `text/${label}`);
    }
  }
});

// ── contract: none of the above ever produced an honest report that CLAIMS valid ──

test('hostile corpus contract: every branch above returns a report, never an unhandled rejection', async () => {
  // A cross-check pass: feed a grab-bag of the ugliest bytes straight at every
  // public entry point back to back, with one shared budget, and confirm the
  // whole batch completes. This is the "nothing hangs, in aggregate" guard.
  const inputs: Uint8Array[] = [
    new Uint8Array(0),
    Uint8Array.of(0xff, 0xfe, 0xfd),
    utf8('\uFEFF'), // BOM alone, no selectors at all
    utf8(ARMOR_BEGIN), // delimiter fragment with nothing else
    utf8(ARMOR_END),
    utf8('<html'), // truncated root tag, no closing bracket ever
    utf8('<script type="application/c2pa">' + 'A'.repeat(200_000)), // huge unterminated script
  ];
  await withBudget(5000, () => {
    for (const bytes of inputs) {
      const sniff = safelySync(() => sniffFormat(bytes));
      assert.equal(sniff.ok, true, 'sniffFormat must not throw on any grab-bag input');
    }
  });
  for (const bytes of inputs) {
    const outcome = await safely(() => withBudget(3000, () => verifyC2pa(bytes)));
    assert.equal(outcome.ok, true, 'verifyC2pa must not throw on any grab-bag input');
    if (outcome.ok) assert.notEqual(outcome.value.state, 'valid', 'grab-bag garbage must never verify');
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SKEPTIC-PASS REGRESSIONS (105-M1)
//
// One test per finding from plans/105-m1/findings-{spec-conformance,hostile-bounds,
// regression-api}.md. Each names its finding id so a future edit that re-breaks
// the behaviour says which review found it and where the reasoning is written up.
// ═══════════════════════════════════════════════════════════════════════════════

// ── sniff precedence: a carrier that DECODED outranks a marker that guessed ───

test('S1 - a section A.8 credential survives text that merely QUOTES the section A.9 delimiter', () => {
  // Either armour delimiter ALONE used to win 'code', and 'code' with half a
  // block is a no-credential answer - so appending one line to someone's signed
  // text erased their credential instead of failing loudly. Every support
  // article about C2PA, and this repo's own plans, contain that string.
  const signed = 'Prose.' + wrapperText(fakeStore());
  assert.equal(sniffFormat(utf8(signed)), 'text');
  assert.equal(sniffFormat(utf8(`Prose that mentions ${ARMOR_BEGIN} in passing.` + wrapperText(fakeStore()))), 'text');
  assert.equal(sniffFormat(utf8(`Prose that mentions ${ARMOR_END} in passing.` + wrapperText(fakeStore()))), 'text');

  // A COMPLETE pair is a carrier that was actually found, and still wins.
  const both = `// ${ARMOR_BEGIN} https://a.example/m.c2pa ${ARMOR_END}\n` + 'Prose.' + wrapperText(fakeStore());
  assert.equal(sniffFormat(utf8(both)), 'code');
  // …and half a block with no wrapper anywhere is still 'code', so section A.9.5's
  // no-manifest report can still be made.
  assert.equal(sniffFormat(utf8(`Docs: a block opens with ${ARMOR_BEGIN} and closes with the matching END line.\n`)), 'code');
});

test('S5 - an <html> marker does not outrank a complete section A.9 block in a source file', () => {
  const armour = `// ${ARMOR_BEGIN} data:application/c2pa;base64,${b64(fakeStore(8))} ${ARMOR_END}\n`;
  // A signed .js whose body holds an HTML template string. Which side of the
  // 4 KB head window that string fell on used to decide whether the file
  // verified at all - and the store's own size moves that boundary.
  const early = armour + 'const tpl = "<html><body>hi</body></html>";\n';
  const late = armour + `const pad = "${'x'.repeat(6000)}";\nconst tpl = "<html></html>";\n`;
  assert.equal(sniffFormat(utf8(early)), 'code');
  assert.equal(sniffFormat(utf8(late)), 'code');
  assert.ok(sameBytes(extractC2paDetailed(utf8(early))!.store!, fakeStore(8)));

  // A real HTML document that carries its own section A.7 element still wins, even
  // when it also quotes an armour block (a docs page about section A.9 does exactly
  // that) - section A.9.2 excludes text/html from the structured-text method.
  const page = `<!DOCTYPE html><html><head><script type="application/c2pa">${b64(fakeStore(8))}</script></head>`
    + `<body><pre>${ARMOR_BEGIN} ref ${ARMOR_END}</pre></body></html>`;
  assert.equal(sniffFormat(utf8(page)), 'html');
});

test('F1/M2 - an SVG whose leading comment mentions <html> keeps its credential', async () => {
  // "First marker wins" was a TEXT comparison over the first 4 KB, so anything
  // that may legally precede an SVG root - prolog, DOCTYPE, comments - could
  // take the file. A valid credential then read as state:'none', i.e. /verify
  // saying "this file carries no manifest" about a file carrying a good one:
  // the worst direction a verifier can be wrong in.
  const svg = '<?xml version="1.0"?>\n<!-- do not open this in <html> -->\n'
    + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
  const signed = await embedC2pa(utf8(svg), 'svg', { title: 'Commented', claimGenerator: 'Lolly lolly.tools' });
  assert.equal(sniffFormat(signed), 'svg');
  const r = await verifyC2pa(signed);
  assert.equal(r.format, 'svg');
  assert.equal(r.state, 'valid', realFailures(r).join(', '));

  // The mirror case: an HTML page whose head comment mentions <svg> is HTML.
  const page = '<!DOCTYPE html>\n<html><head><!-- the <svg> logo lives in /assets --></head><body>hi</body></html>';
  assert.equal(sniffFormat(utf8(page)), 'html');
  // And the foreignObject case the original rule existed for still holds.
  const foreign = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject>'
    + '<html xmlns="http://www.w3.org/1999/xhtml"><body>text</body></html></foreignObject></svg>';
  assert.equal(sniffFormat(utf8(foreign)), 'svg');
});

// ── section A.7 discovery is scoped to <head> ───────────────────────────────────────

test('S3 - section A.7.1.4 scopes discovery to <head>: a body decoy cannot refuse the document', async () => {
  const { bytes } = await signHtml(HTML_PREFIX, HTML_SUFFIX);
  // A second association inside an HTML COMMENT in the body. A spec validator
  // parses the head, finds exactly one element, and validates the page; counting
  // body matches turned that into a one-line denial of verification for anyone
  // who can put a comment (or a UGC block) into the page.
  const decoyed = utf8(new TextDecoder('latin1').decode(bytes)
    + '<!-- <link rel="c2pa-manifest" href="https://evil.example/m.c2pa"> -->');
  const d = extractC2paDetailed(decoyed)!;
  assert.equal(d.status, undefined, 'the head element is still the document\'s one association');
  assert.ok(d.store, 'and its store is still returned');

  const r = await verifyC2pa(decoyed);
  assert.equal(r.found, true);
  // The bytes really did change, so the honest answer is "changed after
  // signing" - a hash RESULT, not a refusal to look.
  assert.deepEqual(realFailures(r), [C2PA_CHECK.assertionDataHashMismatch]);

  // With nothing in the head, body finds are still reported (and two of them are
  // still ambiguous, so still refused).
  const bodyOnly = utf8(`${HTML_PREFIX}</head><body><template>${SCRIPT_OPEN}AAAA${SCRIPT_CLOSE}</template></body></html>`);
  const one = extractC2paDetailed(bodyOnly)!;
  assert.ok(one.store, 'an out-of-head manifest is reported, not hidden');
  assert.match(one.detail!, /outside <head>/);
  const twoInBody = utf8(`${HTML_PREFIX}</head><body>${SCRIPT_OPEN}AAAA${SCRIPT_CLOSE}`
    + `<link rel="c2pa-manifest" href="https://a.example/m.c2pa"></body></html>`);
  assert.equal(extractC2paDetailed(twoInBody)!.status, C2PA_TEXT_STATUS.htmlMultipleManifests);
});

test('N1 - a filler-tag prefix cannot push a second association out of view', () => {
  // The old cap counted TAGS SCANNED, so 4096 decoy <script> tags in front of a
  // real second association made the document read as having one. The cap now
  // counts MATCHES, and the scan is linear, so the decoys cost nothing and
  // change nothing.
  const filler = '<script defer></script>'.repeat(5000);
  const doc = utf8(`<!DOCTYPE html><html><head>${filler}${SCRIPT_OPEN}AAAA${SCRIPT_CLOSE}`
    + `${SCRIPT_OPEN}BBBB${SCRIPT_CLOSE}</head><body>x</body></html>`);
  assert.equal(extractC2paDetailed(doc)!.status, C2PA_TEXT_STATUS.htmlMultipleManifests);
});

// ── external references ──────────────────────────────────────────────────────

test('S4 - every syntactically valid reference is REPORTED; only schemes are refused', () => {
  // Reporting is not fetching (the engine never fetches). Refusing the
  // same-directory sidecar - the least risky reference there is, and the natural
  // output of "write the page, write the manifest beside it" - while waving
  // through any cross-origin https host was a filter that broke section A.7.1.2's
  // PREFERRED form without buying the safety it claimed. A refused reference is
  // also invisible: no URL for the shell to even display.
  const link = (href: string): string =>
    `<!DOCTYPE html><html><head><link rel="c2pa-manifest" href="${href}"></head><body>x</body></html>`;
  for (const href of ['https://x.example/m.c2pa', 'http://x.example/m.c2pa', '/info/m.c2pa', 'm.c2pa', './m.c2pa', '../m.c2pa']) {
    assert.equal(extractC2paDetailed(utf8(link(href)))!.externalUrl, href, href);
  }
  for (const href of ['//x.example/m.c2pa', 'javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,x']) {
    const d = extractC2paDetailed(utf8(link(href)))!;
    assert.equal(d.externalUrl, undefined, href);
    assert.equal(d.status, C2PA_TEXT_STATUS.unsupportedReference, href);
    // …and the link form's "no exclusion" answer is still positive, not absent.
    assert.deepEqual(d.exclusions, [], href);
  }
  // Same rule for the section A.9 URL form.
  const armour = (ref: string): Uint8Array => utf8(`// ${ARMOR_BEGIN} ${ref} ${ARMOR_END}\nx\n`);
  assert.equal(extractC2paDetailed(armour('./sidecar.c2pa'))!.externalUrl, './sidecar.c2pa');
  assert.equal(extractC2paDetailed(armour('//evil.example/x'))!.status, C2PA_TEXT_STATUS.unsupportedReference);
});

test('S9 - a section A.9 data: URI may carry RFC 2397 media-type parameters', () => {
  const store = fakeStore(6);
  const block = (ref: string): Uint8Array => utf8(`// ${ARMOR_BEGIN} ${ref} ${ARMOR_END}\nconst x = 1;\n`);
  for (const ref of [
    `data:application/c2pa;base64,${b64(store)}`,
    `data:application/c2pa;charset=utf-8;base64,${b64(store)}`,
    `DATA:APPLICATION/C2PA;BASE64,${b64(store)}`,
  ]) {
    const d = extractC2paDetailed(block(ref))!;
    assert.ok(d.store && sameBytes(d.store, store), ref);
  }
  // Not base64 at all → not the inline form; falls through to the URL branch,
  // which is what "neither a data: URI nor a URL" should mean.
  assert.equal(extractC2paDetailed(block(`data:application/c2pa,${b64(store)}`))!.status, C2PA_TEXT_STATUS.unsupportedReference);
});

// ── section A.8 wrapper selection is the exclusions' job ────────────────────────────

/** Same shape as storeFor, with the title as a parameter - so two wrappers in
 *  one text carry visibly DIFFERENT manifests and the report can be checked
 *  against the one that actually binds these bytes. */
async function storeTitled(title: string, hash: Uint8Array, exclusions: Exclusion[]): Promise<Uint8Array> {
  return buildC2paManifest({
    title, claimGenerator: 'Lolly lolly.tools',
    generatorInfo: { version: '1.0', specVersion: '2.4.0' },
    assetHash: { exclusions, hash },
    format: 'text/plain',
    dates: SIGN_DATES,
    signer: await fixedSigner(),
    manifestLabel: 'urn:uuid:11111111-2222-4333-8444-555555555555',
    instanceId: 'xmp:iid:11111111-2222-4333-8444-555555555556',
  });
}

test('S2 - section A.8.4.1: the assertion\'s exclusions select the wrapper, not document order', async () => {
  // The re-signed text section A.8.4.1 anticipates ("validators may encounter multiple
  // wrappers"): signed, then EDITED, then re-signed by appending a new wrapper
  // without removing the stale one. The stale wrapper's recorded offsets no
  // longer name where it now sits, so it is not the wrapper these exclusions
  // select - but extraction handed its store onward anyway, which reported an
  // intact credential as INVALID and printed the stale claim's title, signer and
  // date as facts about the current text.
  const draft = 'Draft one.';
  const current = 'Draft one, revised and longer.';
  const stale = await landOn(
    (n) => storeTitled('OLD DRAFT', new Uint8Array(32), [{ start: utf8(draft).length, length: n }]),
    (s) => wrapperByteLength(wrapperBytes(s)));
  const staleText = wrapperText(stale.store);
  const staleLen = wrapperByteLength(wrapperBytes(stale.store));
  assert.notEqual(utf8(draft).length, utf8(current).length, 'the edit really moved the wrapper');

  // The fresh signature covers the current text INCLUDING the stale wrapper - 
  // which is what a conformant re-signer does (it excludes only its own).
  const freshHash = await sha256(utf8(current + staleText));
  const freshStart = utf8(current).length + staleLen;
  const fresh = await landOn(
    (n) => storeTitled('CURRENT', freshHash, [{ start: freshStart, length: n }]),
    (s) => wrapperByteLength(wrapperBytes(s)));

  const bytes = utf8(current + staleText + wrapperText(fresh.store));
  const r = await verifyC2pa(bytes);
  assert.equal(r.textBinding!.wrappers, 2);
  assert.equal(r.textBinding!.selectedWrapper, 2, 'the SECOND wrapper is the one its exclusions name');
  assert.equal(r.claim!.title, 'CURRENT', 'and the report describes THAT manifest, not the stale one');
  assert.equal(r.state, 'valid', realFailures(r).join(', '));
  assert.ok(codesOf(r).includes(C2PA_CHECK.assertionDataHashMatch));
});

test('S11 - hitting the wrapper cap is SAID, so the refusal stays true', async () => {
  const swarm = utf8(('pad' + wrapperText(fakeStore(2))).repeat(4000));
  const d = extractC2paDetailed(swarm, 'text')!;
  assert.equal(d.text!.wrappers.length, 32);
  assert.equal(d.text!.truncated, true, 'the list is a floor, not a count');
  // A text within the cap never carries the flag.
  const { bytes } = await signUnstructured('One wrapper only.');
  assert.equal(extractC2paDetailed(bytes, 'text')!.text!.truncated, undefined);
  assert.equal((await verifyC2pa(bytes)).textBinding!.wrappersTruncated, undefined);
});

test('N2 - "looks like a fragment" needs a wrapper, not just a crafted offset', async () => {
  // A self-signed assertion can declare start: 1e15 on a text with no wrapper in
  // it at all. The verdict is invalid either way; what must not happen is the
  // report repeating a sentence the attacker wrote.
  const store = await storeFor(await sha256(utf8('body')), [{ start: 1e9, length: 4 }], 'text/plain');
  const doc = utf8(`// ${ARMOR_BEGIN} data:application/c2pa;base64,${b64(store)} ${ARMOR_END}\nbody\n`);
  const r = await verifyC2pa(doc);
  assert.equal(r.state, 'invalid');
  assert.notEqual(r.textBinding!.fragment, true, 'no wrapper was found, so no fragment claim');
});

// ── section A.7.1.3 / section A.9.4 exclusion conformance: two facts, not one ──────────────

/** section A.7 signed the way Lolly's own SVG placer does it: the exclusion covers the
 *  BASE64 TEXT only, so the `<script …>`/`</script>` bytes are inside the hash.
 *  Non-conforming per section A.7.1.3 - and strictly more strongly bound. */
async function signHtmlNarrow(prefix: string, suffix: string) {
  const hash = await sha256(utf8(prefix + SCRIPT_OPEN + SCRIPT_CLOSE + suffix));
  const start = prefix.length + SCRIPT_OPEN.length;
  const { store, exclusion } = await fixedPoint(hash, start, 'text/html', (s) => b64(s).length);
  return { store, exclusion, bytes: utf8(prefix + SCRIPT_OPEN + b64(store) + SCRIPT_CLOSE + suffix) };
}

test('S6 - a NARROWER exclusion is non-conformance, not "content outside the credential"', async () => {
  // One check, one message, `assertion.dataHash.additionalExclusionsPresent`
  // ("exclusion ranges other than the C2PA Manifest Store") - for an exclusion
  // that excludes LESS. Nothing additional was excluded, the sentence asserted
  // weaker coverage where the file is more strongly bound, and the hash never
  // ran, so the report could not say whether the bytes were intact.
  const { bytes } = await signHtmlNarrow(HTML_PREFIX, HTML_SUFFIX);
  const r = await verifyC2pa(bytes);
  assert.equal(r.textBinding!.exclusionsConform, 'narrower');
  assert.ok(!realFailures(r).length, `nothing to accuse: ${realFailures(r).join(', ')}`);
  assert.equal(r.state, 'valid');
  const row = r.checks.find((c) => c.code === C2PA_CHECK.assertionDataHashMatch)!;
  assert.match(row.explanation, /narrower than the spec requires/);

  // …and the same file with one byte changed outside the carrier is now
  // distinguishable: non-conforming AND changed.
  const edited = bytes.slice();
  edited[bytesIndexOf(edited, 'Content here.')] = 0x63;
  const r2 = await verifyC2pa(edited);
  assert.equal(r2.textBinding!.exclusionsConform, 'narrower');
  assert.deepEqual(realFailures(r2), [C2PA_CHECK.assertionDataHashMismatch]);

  // The WIDER shape - the actual forgery - keeps its refusal AND now reports the
  // hash beside it, so "non-conforming but intact" reads differently from
  // "non-conforming and changed".
  const secret = '<p>UNBOUND CONTENT</p>\n';
  const wide = await signHtml(HTML_PREFIX + secret, HTML_SUFFIX, secret.length);
  const r3 = await verifyC2pa(wide.bytes);
  assert.equal(r3.textBinding!.exclusionsConform, 'other');
  assert.deepEqual(realFailures(r3), [C2PA_CHECK.assertionDataHashAdditionalExclusions]);
  assert.ok(codesOf(r3).includes(C2PA_CHECK.assertionDataHashMatch), 'the hash RAN and is reported');
});

/** section A.9.4's end-of-file case, signed under the reading `sep` implies: the
 *  exclusion starts at the first byte of the newline that precedes the block. */
async function signStructuredAtEnd(body: string, sep: string, tail: string) {
  const hash = await sha256(utf8(body));
  const line = (s: Uint8Array): string => `// ${ARMOR_BEGIN} data:application/c2pa;base64,${b64(s)} ${ARMOR_END}${sep === '\r\n' ? '\r\n' : '\n'}`;
  const { store, exclusion } = await fixedPoint(hash, body.length, 'text/javascript',
    (s) => sep.length + line(s).length + tail.length);
  return { store, exclusion, bytes: utf8(body + sep + line(store) + tail) };
}

test('S7 - section A.9.4\'s one-byte-ambiguous end-of-file newline: both readings are honoured', async () => {
  // "the newline character preceding the manifest block" reads as the LF alone
  // or as the CRLF pair; and a trailing blank line flips the same file from the
  // end-of-file rule to the middle-of-file one. Either disagreement is ONE byte,
  // and it used to produce a message asserting the file had unbound content in
  // it, with no hash result at all. Lolly is the first section A.9 implementation in the
  // wild, so its reading must not become normative by accident.
  const crlf = await signStructuredAtEnd('const x = 1;', '\r\n', '');
  const rc = await verifyC2pa(crlf.bytes);
  assert.equal(rc.format, 'code');
  assert.equal(rc.textBinding!.exclusionsConform, undefined, 'the CRLF-pair reading conforms');
  assert.equal(rc.state, 'valid', realFailures(rc).join(', '));

  const blank = await signStructuredAtEnd('const x = 1;', '\n', '\n');
  const rb = await verifyC2pa(blank.bytes);
  assert.equal(rb.textBinding!.exclusionsConform, undefined, 'the end-of-file reading conforms despite the trailing blank line');
  assert.equal(rb.state, 'valid', realFailures(rb).join(', '));
});

test('S8 - malformed exclusion ranges on html/code are MALFORMED, not a mismatch', async () => {
  // section 15.12.1 assigns assertion.dataHash.malformed to out-of-order, overlapping
  // and negative ranges. The shared byte-range branch reported `mismatch`, which
  // says "the bytes changed" about an assertion that is simply broken. Binary
  // containers keep their pre-existing wording; the two new formats do not.
  const store = await storeFor(await sha256(utf8('x')), [{ start: 0, length: 40 }, { start: 20, length: 40 }], 'text/html');
  const doc = utf8(`${HTML_PREFIX}${SCRIPT_OPEN}${b64(store)}${SCRIPT_CLOSE}${HTML_SUFFIX}`);
  const r = await verifyC2pa(doc);
  assert.deepEqual(realFailures(r), [C2PA_CHECK.assertionDataHashMalformed]);
  assert.match(r.checks.find((c) => c.code === C2PA_CHECK.assertionDataHashMalformed)!.explanation, /out of order or out of range/);

  // A binary container's wording is untouched.
  const svg = utf8('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4"/></svg>');
  const signed = await embedC2pa(svg, 'svg', { title: 'Fine', claimGenerator: 'Lolly lolly.tools' });
  assert.equal((await verifyC2pa(signed)).state, 'valid');
});

// ── section 18.28: every disclosure, and versioned labels ───────────────────────────

test('S10 - section 18.28 reads ALL disclosures, and tolerates a versioned label', async () => {
  // "full disclosure of the AI MODELS used" is plural, and section 1558 labels repeats
  // `label__1`, `label__2` - a two-model pipeline that disclosed both had its
  // second disclosure dropped in silence.
  const nfc = 'Two models made this.';
  const hash = await sha256(utf8(nfc));
  const start = utf8(nfc).length;
  const { store } = await landOn(
    async (length) => withAssertion(
      withAssertion(await storeFor(hash, [{ start, length }], 'text/plain'),
        'c2pa.ai-disclosure__1', encodeCbor({ modelType: 'c2pa.types.model.first' })),
      'c2pa.ai-disclosure__2', encodeCbor({ modelType: 'c2pa.types.model.second' })),
    (s) => wrapperByteLength(wrapperBytes(s)));
  const r = await verifyC2pa(utf8(nfc + wrapperText(store)));
  assert.equal(r.state, 'valid', realFailures(r).join(', '));
  assert.deepEqual(r.aiDisclosure, { modelType: 'c2pa.types.model.first' }, 'the first is still where it always was');
  assert.deepEqual(r.aiDisclosures, [
    { modelType: 'c2pa.types.model.first' },
    { modelType: 'c2pa.types.model.second' },
  ]);

  // A future versioned label matches too; a single disclosure keeps the old shape.
  const one = await signUnstructuredWith('Prose.', 'c2pa.ai-disclosure.v2', encodeCbor({ modelType: 'c2pa.types.model.v2' }));
  const r2 = await verifyC2pa(one);
  assert.deepEqual(r2.aiDisclosure, { modelType: 'c2pa.types.model.v2' });
  assert.equal(r2.aiDisclosures, undefined, 'no array unless there is more than one');

  // A label that merely STARTS with the name is not a disclosure.
  const decoy = await signUnstructuredWith('Prose.', 'c2pa.ai-disclosure-notes', encodeCbor({ modelType: 'nope' }));
  assert.equal((await verifyC2pa(decoy)).aiDisclosure, undefined);
});

// ── bounds ───────────────────────────────────────────────────────────────────

test('H1 - a >-free tail of <script/<link tokens is LINEAR, in both scanners', async () => {
  // `<name(?=[\s/>])([^>]*)>` is linear only when a `>` exists later in the
  // string. In a `>`-free tail every start position scanned to EOF and
  // backtracked to EOF: 128 KB took 937 ms, 1 MiB took 76 s, synchronously, with
  // nothing to catch. The suite's old "tag storm" missed it because every tag in
  // it contained a `>`, which is the one shape that stays linear.
  const budget = 4000;
  for (const token of ['<script ', '<link ']) {
    const t = Date.now();
    const doc = utf8('<html \n' + token.repeat(40_000));       // ~320 KB, no `>` after the first line
    assert.doesNotThrow(() => extractC2paDetailed(doc, 'html'));
    assert.ok(Date.now() - t < budget, `${token}: ${Date.now() - t} ms`);
  }
  // The same defect lived in the </script search, reachable with ONE c2pa script.
  const t1 = Date.now();
  const unclosed = utf8(`<html \n${SCRIPT_OPEN}AAAA` + 'x'.repeat(400_000));
  assert.equal(extractC2paDetailed(unclosed, 'html')!.status, C2PA_TEXT_STATUS.htmlUnterminatedScript);
  assert.ok(Date.now() - t1 < budget, `close-tag search: ${Date.now() - t1} ms`);

  // …and through the public entry point, which is where /verify meets a paste.
  const t2 = Date.now();
  const r = await verifyC2pa(utf8('<html \n' + '<script '.repeat(40_000)));
  assert.notEqual(r.state, 'valid');
  assert.ok(Date.now() - t2 < budget, `verifyC2pa: ${Date.now() - t2} ms`);
});

test('H2 - past the reader\'s size cap is "we declined to look", not a broken credential', async () => {
  // A 17 MiB saved web page with no C2PA anywhere in it was reported as
  // found:true / invalid / credential.unreadable - a verdict manufactured from
  // FILE SIZE alone. Large single-file HTML (saved pages, inlined-base64
  // reports, exported dashboards) crosses 16 MiB routinely.
  const html = utf8('<!doctype html><html><body>' + 'a'.repeat(17 * 1024 * 1024) + '</body></html>');
  const r = await verifyC2pa(html);
  assert.equal(r.found, false);
  assert.equal(r.state, 'none');
  assert.deepEqual(r.checks, [], 'no credential verdict of any kind');
  assert.equal(r.textBinding!.status, C2PA_TEXT_STATUS.tooLarge, 'and nothing is hidden');
  assert.match(r.reason!, /no Content Credentials read - .*cap at/);

  // Long prose that merely QUOTES the armour delimiter is the same story.
  const prose = utf8(`Docs about ${ARMOR_BEGIN}.\n` + 'b'.repeat(17 * 1024 * 1024));
  const r2 = await verifyC2pa(prose);
  assert.equal(r2.found, false);
  assert.equal(r2.state, 'none');
});

test('M1 - section A.8 allocation is bounded by each wrapper\'s OWN selector run', async () => {
  // The bound was derived from the input length (right instinct) but
  // re-evaluated PER WRAPPER, so 32 headers at the front of a large paste each
  // declared "almost the whole file": 508 MiB of ArrayBuffer from a 15 MiB
  // paste, in 13 ms, on a public drop target. A wrapper's payload cannot be
  // longer than its own selector run, and runs are disjoint.
  const header = '\uFEFF' + vsRun([0x43, 0x32, 0x50, 0x41, 0x54, 0x58, 0x54, 0x00, 1, 0x00, 0xf2, 0x9f, 0x00]) + 'X';
  const paste = utf8(header.repeat(40) + 'y'.repeat(8 * 1024 * 1024));
  const before = process.memoryUsage().external;
  const t = Date.now();
  const d = extractC2paDetailed(paste, 'text')!;
  const grew = (process.memoryUsage().external - before) / (1024 * 1024);
  assert.equal(d.status, C2PA_TEXT_STATUS.textCorruptedWrapper);
  assert.equal(d.text!.wrappers.every((w) => w.store === null), true, 'every header is refused');
  assert.ok(grew < 8 * 32, `external memory grew ${grew.toFixed(0)} MiB - the per-wrapper bound is back`);
  assert.ok(Date.now() - t < 4000);
});

test('F2/M3 - a caller-supplied prototype key is not a format', () => {
  // extractC2paDetailed is the first extraction entry point whose `format` comes
  // from the CALLER - exactly what a paste/?src= surface will hand it. Both
  // dispatch tables are object literals, so a bare lookup resolved
  // Object.prototype members: `constructor`/`toString` returned an object whose
  // `store` was undefined (neither a store nor null), and
  // `valueOf`/`hasOwnProperty`/`__proto__` THREW out of a function documented
  // NEVER THROWS.
  const bytes = utf8('just some plain text, nothing to find in it');
  for (const key of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf', 'isPrototypeOf', 'nope']) {
    let out: unknown;
    assert.doesNotThrow(() => { out = extractC2paDetailed(bytes, key as never); }, key);
    assert.equal(out, null, `${key}: an unknown format is null, per the docblock`);
  }
  // Real formats are unaffected.
  assert.equal(extractC2paDetailed(bytes, 'text')!.format, 'text');
  assert.equal(extractC2paDetailed(bytes, 'png')!.store, null);
});

test('H1 (follow-up) - a `<` inside a tag is an attribute character, not a second element', () => {
  // The linear scanner walks every `<`, so it must not re-enter a tag it has
  // already consumed: `<script <script type="application/c2pa">` is ONE element
  // to a browser (`<script` is a bare attribute name), and reading it as two
  // would turn "the bytes changed" into "the document is refused" for anyone who
  // can prepend eight characters.
  const doc = utf8(`${HTML_PREFIX}<script ${SCRIPT_OPEN}AAAA${SCRIPT_CLOSE}${HTML_SUFFIX}`);
  const d = extractC2paDetailed(doc)!;
  assert.notEqual(d.status, C2PA_TEXT_STATUS.htmlMultipleManifests, 'one element, not two');
  // Two REAL elements are still two.
  const two = utf8(`${HTML_PREFIX}${SCRIPT_OPEN}AAAA${SCRIPT_CLOSE}${SCRIPT_OPEN}BBBB${SCRIPT_CLOSE}${HTML_SUFFIX}`);
  assert.equal(extractC2paDetailed(two)!.status, C2PA_TEXT_STATUS.htmlMultipleManifests);
});

// ═══ section 7 (plans/105 M2) - verifying against an EXTERNAL manifest ═══════════════
//
// section A.7.1.2 (`<link rel="c2pa-manifest">`) and section A.9.3 let a text asset REFERENCE
// its credential instead of carrying it, and section A.7.1.4 makes resolving that
// reference explicitly optional for a validator. The engine's answer has always
// been "the credential is over there, and I do not fetch" - correct, and a dead
// end for the document that actually has one. `verifyC2pa(bytes, {
// externalManifest })` (1.116.0) closes the loop by letting the CALLER do the
// fetching under its own policy: the web shell only for a same-origin address,
// only on an explicit click. The engine still performs no network I/O.
//
// What is worth pinning here is not the hash pipeline - section A.7.1.3's link form is
// a whole-document hash with no exclusions, which every fixture above already
// exercises - but the four properties that make the option safe: it changes
// nothing when unused, it can never SHADOW an embedded credential, its use is
// visible in the report, and a wrong or unreadable sidecar fails visibly instead
// of passing or throwing.

/** A section A.7.1.2 link-form document plus the sidecar store that binds it. No
 *  fixed point to solve: the link form declares NO exclusion (the hash covers
 *  the document as stored, and the `<link>` element is part of it), so the store
 *  can be signed over the finished bytes in one pass. */
async function linkFormDoc(href = '/creds/doc.c2pa'): Promise<{ bytes: Uint8Array; store: Uint8Array }> {
  const bytes = utf8(`${HTML_PREFIX}<link rel="c2pa-manifest" href="${href}">${HTML_SUFFIX}`);
  return { bytes, store: await storeFor(await sha256(bytes), [], 'text/html') };
}

test('section 7: without the option, an external reference is reported and NOT fetched (1.115.0, unchanged)', async () => {
  const { bytes } = await linkFormDoc();
  const r = await verifyC2pa(bytes);
  // Asserted here so the new option cannot quietly become a default for a
  // caller that passed nothing.
  assert.equal(r.found, true);
  assert.equal(r.state, 'invalid');
  assert.equal(r.textBinding?.manifestUrl, '/creds/doc.c2pa');
  assert.equal(r.textBinding?.externalManifestUsed, undefined);
  assert.deepEqual(codesOf(r), [C2PA_CHECK.manifestInaccessible]);
});

test('section 7: a caller-fetched sidecar verifies the document, and the report SAYS it was external', async () => {
  const { bytes, store } = await linkFormDoc();
  const r = await verifyC2pa(bytes, { externalManifest: store });
  assert.equal(r.state, 'valid', realFailures(r).join(', '));
  assert.ok(codesOf(r).includes(C2PA_CHECK.assertionDataHashMatch));
  assert.ok(codesOf(r).includes(C2PA_CHECK.claimSignatureValidated));
  // The flag is the whole point: "these bytes match a credential served from
  // over there" must never be printable as "the credential inside this document
  // is intact". The URL stays too, so a saved report says WHICH credential.
  assert.equal(r.textBinding?.externalManifestUsed, true);
  assert.equal(r.textBinding?.manifestUrl, '/creds/doc.c2pa');
  assert.equal(r.claim?.title, 'A signed text');
});

test('section 7: a sidecar that binds different bytes is a MISMATCH, not a pass', async () => {
  const { store } = await linkFormDoc();
  const edited = utf8(`${HTML_PREFIX}<link rel="c2pa-manifest" href="/creds/doc.c2pa">${HTML_SUFFIX.replace('Content here.', 'Content HERE.')}`);
  const r = await verifyC2pa(edited, { externalManifest: store });
  assert.equal(r.state, 'invalid');
  assert.ok(failedCodes(r).includes(C2PA_CHECK.assertionDataHashMismatch));
  // The claim's own signature is still fine - only the binding failed, which is
  // exactly the distinction a reader needs.
  assert.ok(codesOf(r).includes(C2PA_CHECK.claimSignatureValidated));
  assert.equal(r.textBinding?.externalManifestUsed, true);
});

test('section 7: an EMBEDDED credential is never shadowed by a caller-supplied one', async () => {
  // The dangerous shape, and the reason the option is only read when the asset
  // carries no store of its own: a document that DOES embed its manifest must be
  // verified against THAT manifest, whatever the caller passes alongside.
  const { bytes, exclusion } = await signHtml(HTML_PREFIX, HTML_SUFFIX);
  const { store: foreign } = await linkFormDoc();
  const r = await verifyC2pa(bytes, { externalManifest: foreign });
  assert.equal(r.state, 'valid', realFailures(r).join(', '));
  assert.equal(r.textBinding?.externalManifestUsed, undefined, 'the embedded store won');
  assert.ok(exclusion.length > 0);
});

test('section 7: an unreadable sidecar fails visibly; an empty one is "nothing was fetched"', async () => {
  const { bytes } = await linkFormDoc();
  const junk = await verifyC2pa(bytes, { externalManifest: fakeStore(64) });
  assert.equal(junk.state, 'invalid');
  assert.ok(failedCodes(junk).includes(C2PA_CHECK.credentialUnreadable));
  assert.equal(junk.textBinding?.externalManifestUsed, true, 'we say we used it, and that it did not read');
  // Zero bytes is not a credential - falling through to the honest 1.115.0
  // answer beats reporting an unreadable one about a fetch that returned nothing.
  const empty = await verifyC2pa(bytes, { externalManifest: new Uint8Array(0) });
  assert.deepEqual(codesOf(empty), [C2PA_CHECK.manifestInaccessible]);
  assert.equal(empty.textBinding?.externalManifestUsed, undefined);
});

test('section 7: the option is inert on any asset that does not reference an external manifest', async () => {
  // The option RESOLVES a reference the asset made; it never attaches one. A
  // text with no credential stays "no Content Credentials" even while the caller
  // is holding a perfectly good store.
  const { store } = await linkFormDoc();
  const plain = await verifyC2pa(utf8('just some prose, carrying nothing at all'), { externalManifest: store });
  assert.equal(plain.found, false);
  assert.equal(plain.state, 'none');
  assert.equal(plain.textBinding?.externalManifestUsed, undefined);

  // ...and a section A.9 block that IS in the file is the credential, not the sidecar.
  const { bytes } = await signStructured('const answer = 42;\n');
  const armoured = await verifyC2pa(bytes, { externalManifest: store });
  assert.equal(armoured.state, 'valid', realFailures(armoured).join(', '));
  assert.equal(armoured.textBinding?.externalManifestUsed, undefined);
});
