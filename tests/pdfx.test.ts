/**
 * PDF/X-4 metadata authority contract tests.
 * Run with: node --test tests/pdfx.test.ts
 *
 * pdfx.js is pure string/descriptor logic — no pdf bytes — so these assertions
 * read the XMP/PDF conventions independently of the builder: packet framing
 * (xpacket begin/end='w' + writable padding), required properties + namespace
 * URIs, XML escaping, Info-dict date shape, and the OutputIntent descriptors.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PDFX_VERSION,
  buildPdfXXmp,
  formatPdfDate,
  makeDocumentId,
  pdfxOutputIntentSpec,
} from '../engine/src/pdfx.ts';

const OPTS = {
  title: 'Quarterly Poster',
  createDate: '2026-07-02T09:30:00Z',
  modifyDate: '2026-07-02T10:00:00Z',
  creatorTool: 'Lolly qr-code',
  producer: 'Lolly',
  documentId: makeDocumentId('doc-seed'),
  instanceId: makeDocumentId('instance-seed'),
};

// Nano well-formedness check: strip PIs, then walk tags with a stack. Enough
// for output we generate ourselves (escaped values ⇒ no '>' inside attributes).
function assertBalancedXml(xml: string): void {
  const body = xml.replace(/<\?[\s\S]*?\?>/g, '');
  const tagRe = /<(\/?)([A-Za-z_][\w.:-]*)[^>]*?(\/?)>/g;
  const stack: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(body)) !== null) {
    const [, close, name, selfClose] = m;
    if (selfClose) continue;
    if (close) {
      assert.equal(stack.pop(), name, `closing </${name}> matches opener`);
    } else {
      stack.push(name as string);
    }
  }
  assert.deepEqual(stack, [], 'all tags closed');
}

test('pdfx: PDFX_VERSION is the X-4 conformance string', () => {
  assert.equal(PDFX_VERSION, 'PDF/X-4');
});

test('pdfx: XMP packet framing — begin, writable end marker, padding', () => {
  const xmp = buildPdfXXmp(OPTS);
  assert.ok(xmp.startsWith('<?xpacket begin='), 'starts with xpacket begin');
  assert.ok(xmp.includes('W5M0MpCehiHzreSzNTczkc9d'), 'carries the fixed xpacket id');
  assert.ok(xmp.endsWith("<?xpacket end='w'?>"), "ends with end='w' marker");
  // Writable padding: a whitespace run of roughly 2KB between </x:xmpmeta> and the
  // end marker so editors can rewrite the packet in place.
  const pad = xmp.slice(xmp.indexOf('</x:xmpmeta>') + '</x:xmpmeta>'.length, xmp.lastIndexOf('<?xpacket'));
  assert.ok(/^\s+$/.test(pad), 'padding is whitespace only');
  assert.ok(pad.length >= 1500, `padding is ~2KB (got ${pad.length})`);
});

test('pdfx: XMP is balanced XML', () => {
  assertBalancedXml(buildPdfXXmp(OPTS));
});

test('pdfx: XMP carries every required property and namespace', () => {
  const xmp = buildPdfXXmp(OPTS);
  // Namespace URIs.
  for (const ns of [
    'adobe:ns:meta/',
    'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'http://purl.org/dc/elements/1.1/',
    'http://ns.adobe.com/xap/1.0/',
    'http://ns.adobe.com/xap/1.0/mm/',
    'http://ns.adobe.com/pdf/1.3/',
    'http://www.npes.org/pdfx/ns/id/',
  ]) assert.ok(xmp.includes(ns), `declares namespace ${ns}`);
  // Properties with the caller's values.
  assert.ok(xmp.includes('<rdf:li xml:lang="x-default">Quarterly Poster</rdf:li>'), 'dc:title x-default');
  assert.ok(xmp.includes('<xmp:CreateDate>2026-07-02T09:30:00Z</xmp:CreateDate>'), 'CreateDate');
  assert.ok(xmp.includes('<xmp:ModifyDate>2026-07-02T10:00:00Z</xmp:ModifyDate>'), 'ModifyDate');
  assert.ok(xmp.includes('<xmp:CreatorTool>Lolly qr-code</xmp:CreatorTool>'), 'CreatorTool');
  assert.ok(xmp.includes('<pdf:Producer>Lolly</pdf:Producer>'), 'Producer');
  assert.ok(xmp.includes('<pdf:Trapped>False</pdf:Trapped>'), 'Trapped defaults to False');
  assert.ok(xmp.includes(`<pdfxid:GTS_PDFXVersion>${PDFX_VERSION}</pdfxid:GTS_PDFXVersion>`), 'GTS_PDFXVersion');
  assert.ok(xmp.includes(`<xmpMM:DocumentID>${OPTS.documentId}</xmpMM:DocumentID>`), 'DocumentID');
  assert.ok(xmp.includes(`<xmpMM:InstanceID>${OPTS.instanceId}</xmpMM:InstanceID>`), 'InstanceID');
});

test('pdfx: XMP defaults — modifyDate mirrors createDate, ids generated, createDate required', () => {
  const xmp = buildPdfXXmp({ createDate: '2026-01-01T00:00:00Z' });
  assert.ok(xmp.includes('<xmp:ModifyDate>2026-01-01T00:00:00Z</xmp:ModifyDate>'), 'modifyDate falls back to createDate');
  assert.match(xmp, /<xmpMM:DocumentID>uuid:[0-9a-f-]{36}<\/xmpMM:DocumentID>/, 'DocumentID auto-generated');
  assert.throws(() => buildPdfXXmp({}), TypeError, 'createDate is required');
});

test('pdfx: XMP escapes markup in interpolated values', () => {
  const xmp = buildPdfXXmp({
    ...OPTS,
    title: 'A <b>&"bold"</b> \'title\'',
    creatorTool: 'Tool <&>',
  });
  assert.ok(!xmp.includes('<b>'), 'raw markup does not survive');
  assert.ok(xmp.includes('A &lt;b&gt;&amp;&quot;bold&quot;&lt;/b&gt; &#39;title&#39;'), 'title escaped');
  assert.ok(xmp.includes('<xmp:CreatorTool>Tool &lt;&amp;&gt;</xmp:CreatorTool>'), 'creatorTool escaped');
  assertBalancedXml(xmp);
});

test('pdfx: formatPdfDate produces the Info-dict D: shape', () => {
  const d = new Date(2026, 6, 2, 9, 5, 7); // local time, month is 0-based
  const s = formatPdfDate(d);
  assert.match(s, /^D:\d{14}[+\-Z]/, 'D: + 14 digits + offset marker');
  assert.match(s, /^D:\d{14}[+\-]\d{2}'\d{2}'$/, "full local-offset form +HH'mm'");
  assert.ok(s.startsWith('D:20260702090507'), 'local date components in order');
  assert.equal(formatPdfDate('2026-07-02T09:05:07'), s, 'string input parses to the same instant');
  assert.throws(() => formatPdfDate('not a date'), TypeError);
});

test('pdfx: makeDocumentId — seeded is deterministic, unseeded is not', () => {
  const shape = /^uuid:[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const a = makeDocumentId('tool:qr-code|2026');
  assert.match(a, shape);
  assert.equal(makeDocumentId('tool:qr-code|2026'), a, 'same seed → same id');
  assert.notEqual(makeDocumentId('tool:qr-code|2027'), a, 'different seed → different id');
  const r1 = makeDocumentId();
  const r2 = makeDocumentId();
  assert.match(r1, /^uuid:[0-9a-f-]{36}$/i);
  assert.notEqual(r1, r2, 'unseeded ids are unique');
});

test('pdfx: output intent spec — srgb embeds the ICC profile', () => {
  const spec = pdfxOutputIntentSpec('srgb');
  assert.equal(spec.subtype, 'GTS_PDFX');
  assert.equal(spec.identifier, 'sRGB IEC61966-2.1');
  assert.equal(spec.registry, 'http://www.color.org');
  assert.ok(spec.iccBytes instanceof Uint8Array && spec.iccBytes.length > 0, 'ICC bytes embedded');
  assert.equal(spec.components, 3);
});

test('pdfx: output intent spec — CMYK conditions are registry-name only', () => {
  const spec = pdfxOutputIntentSpec('fogra39');
  assert.equal(spec.subtype, 'GTS_PDFX');
  assert.equal(spec.identifier, 'FOGRA39');
  assert.ok(spec.info.includes('FOGRA39'), 'Info names the condition');
  assert.equal(spec.registry, 'http://www.color.org');
  assert.equal(spec.iccBytes, null, 'no CMYK ICC bytes ship in the repo');
  assert.equal(spec.components, 4);
  // Unknown condition names fall back to the default rather than emitting junk.
  assert.equal(pdfxOutputIntentSpec('not-a-condition').identifier, 'FOGRA39');
  // Callers may override the human-readable Info string.
  assert.equal(pdfxOutputIntentSpec('swop', { info: 'Press X' }).info, 'Press X');
});

test('pdfx: the engine public surface re-exports the pdfx API', async () => {
  // The web shell imports these from '@lolly/engine' (its pdf-lib export pass),
  // so the index re-export is load-bearing, not cosmetic.
  const engine = await import('../engine/src/index.ts');
  assert.equal(engine.PDFX_VERSION, PDFX_VERSION);
  assert.equal(engine.buildPdfXXmp, buildPdfXXmp);
  assert.equal(engine.formatPdfDate, formatPdfDate);
  assert.equal(engine.makeDocumentId, makeDocumentId);
  assert.equal(engine.pdfxOutputIntentSpec, pdfxOutputIntentSpec);
});
