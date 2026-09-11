// SPDX-License-Identifier: MPL-2.0
/**
 * text-doc-export.ts against the contract it promises: one block parser
 * feeding four emitters. Parser subset pins (headings, nested lists, fences,
 * quotes, rules, inline runs, the href scheme gate, CRLF), the
 * escaped-by-construction HTML page, RTF escaping and \uN? unicode, the DOCX
 * and ODT packages (unzipped and inspected via the shell's own zip wrapper),
 * the ODT stored-first mimetype rule, and byte-determinism of both archives
 * (the fixed zip mtime, pinned down to the DOS timestamp bytes).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMdBlocks, mdToStandaloneHtml, mdToRtf, mdToDocxBlob, mdToOdtBlob, type MdBlock, type MdRun } from './text-doc-export.ts';
import { unzipAsync } from './zip.ts';

const bytesOf = async (b: Blob): Promise<Uint8Array> => new Uint8Array(await b.arrayBuffer());
const utf8 = (b: Uint8Array): string => new TextDecoder().decode(b);

function runsOf(b: MdBlock | undefined): MdRun[] {
  if (!b || !('runs' in b)) throw new Error('expected a block with runs');
  return b.runs;
}

// ── parser ────────────────────────────────────────────────────────────────────

test('parser: ATX headings become heading blocks with the right level', () => {
  assert.deepEqual(parseMdBlocks('# One\n\n### Three\n\n###### Six'), [
    { kind: 'heading', level: 1, runs: [{ text: 'One' }] },
    { kind: 'heading', level: 3, runs: [{ text: 'Three' }] },
    { kind: 'heading', level: 6, runs: [{ text: 'Six' }] },
  ]);
});

test('parser: bullets nest by 2-space indentation, each item its own block', () => {
  assert.deepEqual(parseMdBlocks('- top\n  - mid\n    - deep\n* star\n+ plus'), [
    { kind: 'bullet', level: 0, runs: [{ text: 'top' }] },
    { kind: 'bullet', level: 1, runs: [{ text: 'mid' }] },
    { kind: 'bullet', level: 2, runs: [{ text: 'deep' }] },
    { kind: 'bullet', level: 0, runs: [{ text: 'star' }] },
    { kind: 'bullet', level: 0, runs: [{ text: 'plus' }] },
  ]);
});

test('parser: ordered items accept both 1. and 1) markers', () => {
  assert.deepEqual(parseMdBlocks('1. first\n2. second\n3) paren'), [
    { kind: 'ordered', level: 0, runs: [{ text: 'first' }] },
    { kind: 'ordered', level: 0, runs: [{ text: 'second' }] },
    { kind: 'ordered', level: 0, runs: [{ text: 'paren' }] },
  ]);
});

test('parser: fenced code is verbatim - no inline parsing, language ignored', () => {
  assert.deepEqual(parseMdBlocks('```js\n**not bold** <b>\n    indented\n```'), [
    { kind: 'code', text: '**not bold** <b>\n    indented' },
  ]);
});

test('parser: consecutive quote lines join into one quote block', () => {
  assert.deepEqual(parseMdBlocks('> stay **calm**\n> and carry on'), [
    { kind: 'quote', runs: [{ text: 'stay ' }, { text: 'calm', bold: true }, { text: ' and carry on' }] },
  ]);
});

test('parser: --- and *** are rules, not lists or emphasis', () => {
  assert.deepEqual(parseMdBlocks('---\n\n***'), [{ kind: 'rule' }, { kind: 'rule' }]);
});

test('parser: inline bold/italic/code/strike/link runs', () => {
  const blocks = parseMdBlocks('plain **bold** *ital* `co de` ~~gone~~ [go](https://x.y/a)');
  assert.equal(blocks.length, 1);
  assert.deepEqual(runsOf(blocks[0]), [
    { text: 'plain ' },
    { text: 'bold', bold: true },
    { text: ' ' },
    { text: 'ital', italic: true },
    { text: ' ' },
    { text: 'co de', code: true },
    { text: ' ' },
    { text: 'gone', strike: true },
    { text: ' ' },
    { text: 'go', href: 'https://x.y/a' },
  ]);
});

test('parser: nested emphasis inherits the outer flags', () => {
  assert.deepEqual(runsOf(parseMdBlocks('**bold _both_**')[0]), [
    { text: 'bold ', bold: true },
    { text: 'both', bold: true, italic: true },
  ]);
});

test('parser: a javascript: href is dropped, text kept; mailto survives', () => {
  assert.deepEqual(parseMdBlocks('[x](javascript:alert%281%29) then [ok](mailto:a@b.c)'), [
    { kind: 'para', runs: [{ text: 'x then ' }, { text: 'ok', href: 'mailto:a@b.c' }] },
  ]);
});

test('parser: plain prose becomes para blocks, lines joined with a space', () => {
  assert.deepEqual(parseMdBlocks('line one\nline two\n\nsecond para'), [
    { kind: 'para', runs: [{ text: 'line one line two' }] },
    { kind: 'para', runs: [{ text: 'second para' }] },
  ]);
});

test('parser: CRLF input parses the same as LF', () => {
  assert.deepEqual(parseMdBlocks('# Head\r\n\r\nbody one\r\nbody two\r\n'), [
    { kind: 'heading', level: 1, runs: [{ text: 'Head' }] },
    { kind: 'para', runs: [{ text: 'body one body two' }] },
  ]);
});

// ── HTML ──────────────────────────────────────────────────────────────────────

test('html: source markup arrives escaped - no script tag survives', () => {
  const page = mdToStandaloneHtml('<script>alert(1)</script>', 'Safe & Sound <T>');
  assert.ok(!page.includes('<script'), 'no live script tag anywhere');
  assert.ok(page.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(page.includes('<title>Safe &amp; Sound &lt;T&gt;</title>'));
  assert.ok(page.startsWith('<!doctype html><html><head><meta charset="utf-8"><title>'));
});

test('html: a vetted https link becomes a real anchor', () => {
  const page = mdToStandaloneHtml('[go](https://example.com/a?b=1)', 'T');
  assert.ok(page.includes('<a href="https://example.com/a?b=1">go</a>'));
});

test('html: a brand font stack is preferenced ahead of the system fallback, sanitised', () => {
  const page = mdToStandaloneHtml('hello', 'T', { fontStack: "'SUSE', ui-sans-serif", monoStack: "'SUSE Mono'" });
  assert.ok(page.includes(`body{font-family:'SUSE', ui-sans-serif,system-ui`), 'brand stack leads, system stack follows');
  assert.ok(page.includes(`code,pre{font-family:'SUSE Mono',ui-monospace`));
  // A hostile stack cannot break out of the style block.
  const evil = mdToStandaloneHtml('hello', 'T', { fontStack: 'X;}</style><script>alert(1)</script>' });
  assert.ok(!evil.includes('<script'), 'style-breaking characters are stripped');
  // No stack at all keeps the plain system default.
  const plain = mdToStandaloneHtml('hello', 'T');
  assert.ok(plain.includes('body{font-family:system-ui'));
});

test('html: contiguous list items group into nested lists', () => {
  const page = mdToStandaloneHtml('- a\n  - b\n- c\n\n1. one\n2. two', 'T');
  assert.ok(page.includes('<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>'));
  assert.ok(page.includes('<ol><li>one</li><li>two</li></ol>'));
});

// ── RTF ───────────────────────────────────────────────────────────────────────

test('rtf: escapes braces and backslashes, toggles bold, encodes non-ASCII', () => {
  const rtf = mdToRtf('braces { } and back \\ slash\n\n**bold** run\n\naccent é dash \u2014');
  assert.ok(rtf.startsWith('{\\rtf1\\ansi\\deff0'));
  assert.ok(rtf.includes('braces \\{ \\} and back \\\\ slash'));
  assert.ok(rtf.includes('\\b bold\\b0 '));
  assert.ok(rtf.includes('\\u233?'), 'e-acute as signed 16-bit \\uN?');
  assert.ok(rtf.includes('\\u8212?'), 'em dash as signed 16-bit \\uN?');
});

test('rtf: ordered items renumber per contiguous run at a level', () => {
  const rtf = mdToRtf('1. a\n2. b\n\nbreak\n\n7. c\n8. d');
  assert.ok(rtf.includes(' 1. a'));
  assert.ok(rtf.includes(' 2. b'));
  assert.ok(rtf.includes(' 1. c'), 'authored as 7. but numbered from 1 in its own run');
  assert.ok(rtf.includes(' 2. d'));
  assert.ok(mdToRtf('- dot').includes("\\'95\\tab dot"));
});

// ── DOCX ──────────────────────────────────────────────────────────────────────

test('docx: minimal OOXML package with escaped text and preserved spaces', async () => {
  const blob = await mdToDocxBlob('# Fish & Chips\n\nbody text', 'T');
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const bytes = await bytesOf(blob);
  assert.equal(bytes[0], 0x50, 'P');
  assert.equal(bytes[1], 0x4b, 'K');
  const files = await unzipAsync(bytes);
  assert.ok(files['[Content_Types].xml'], 'content types part present');
  assert.ok(files['_rels/.rels'], 'root rels present');
  const doc = files['word/document.xml'];
  assert.ok(doc, 'word/document.xml present');
  const xml = utf8(doc);
  assert.ok(xml.includes('Fish &amp; Chips'));
  assert.ok(xml.includes('xml:space="preserve"'));
  assert.ok(xml.includes('<w:sz w:val="48"/>'), 'h1 at 48 half-points');
  assert.ok(xml.includes('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>'), 'A4 sectPr');
});

// ── ODT ───────────────────────────────────────────────────────────────────────

test('odt: mimetype stored first at offset 30, content.xml carries the text', async () => {
  const blob = await mdToOdtBlob('# Hello ODT\n\n- item one', 'T');
  assert.equal(blob.type, 'application/vnd.oasis.opendocument.text');
  const bytes = await bytesOf(blob);
  assert.equal(bytes[0], 0x50, 'P');
  assert.equal(bytes[1], 0x4b, 'K');
  // The stored-first-entry rule: a local file header is 30 bytes, then the
  // entry name, then (only because the entry is stored with no extra field)
  // its bytes - so the name and the mimetype read as contiguous ASCII.
  assert.equal(utf8(bytes.slice(30, 30 + 47)), 'mimetypeapplication/vnd.oasis.opendocument.text');
  const files = await unzipAsync(bytes);
  assert.ok(files['META-INF/manifest.xml'], 'manifest present');
  const content = files['content.xml'];
  assert.ok(content, 'content.xml present');
  const xml = utf8(content);
  assert.ok(xml.includes('Hello ODT'));
  assert.ok(xml.includes('text:outline-level="1"'));
  assert.ok(xml.includes('text:style-name="L0"'), 'level-0 list paragraph style');
});

// ── determinism ───────────────────────────────────────────────────────────────

test('determinism: DOCX and ODT are byte-identical across runs', async () => {
  const md = '# Same\n\n1. a\n2. b\n\n```\ncode\n```';
  const d1 = await bytesOf(await mdToDocxBlob(md, 'T'));
  const d2 = await bytesOf(await mdToDocxBlob(md, 'T'));
  assert.deepEqual(d1, d2, 'DOCX bytes stable');
  const o1 = await bytesOf(await mdToOdtBlob(md, 'T'));
  const o2 = await bytesOf(await mdToOdtBlob(md, 'T'));
  assert.deepEqual(o1, o2, 'ODT bytes stable');
  // Two immediate runs could agree even on a wall-clock mtime, so pin the DOS
  // timestamp itself: fflate writes mod time+date as one LE u32 at offset 10
  // of the first local header, and the fixed 2000-01-01 00:00 stamp encodes
  // as 0x28210000 (bytes 00 00 21 28).
  for (const bytes of [d1, o1]) {
    assert.equal(bytes[10], 0x00);
    assert.equal(bytes[11], 0x00);
    assert.equal(bytes[12], 0x21);
    assert.equal(bytes[13], 0x28);
  }
});
