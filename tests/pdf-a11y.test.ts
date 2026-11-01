// SPDX-License-Identifier: MPL-2.0
/**
 * The PDF accessibility check: the committed module, its wording and the baseline of what it
 * finds in Lolly's own PDF writers.
 *
 * The checker's own 34 rule tests run with `cargo test` in `packages/node-shell/wasm/pdf-a11y`.
 * These tests go through the shipped `.wasm` the way every shell does, so they cover the
 * transport, the not-applicable logic and the report words as well.
 *
 * The baseline in `fixtures/pdf-a11y-baseline.json` records what the checker finds in PDFs
 * written by Lolly's own code today. It is a record, not a target: it is not tuned to pass, and
 * most files fail the tagging checks because the writers add no tags yet. Rewrite it with
 * `UPDATE_PDF_A11Y_BASELINE=1 node --test tests/pdf-a11y.test.ts` and review the diff.
 *
 * Run with: node --test tests/pdf-a11y.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { checkPdfAccessibility } from '../packages/node-shell/src/pdf-a11y-node.ts';
import { PdfAccessibilityError } from '../packages/node-shell/src/pdf-a11y.ts';
import {
  PDF_ACCESSIBILITY_RULE_IDS, PDF_ACCESSIBILITY_STATEMENTS, pdfAccessibilityText, summarisePdfAccessibility,
} from '../engine/src/pdf-accessibility.ts';
import { verifyExport } from '../engine/src/preflight-output.ts';
import { createPdfDoc } from '../shells/web/src/bridge/export-pdf-doc.ts';
import { imagesToPdf } from '../packages/node-shell/src/pdf-images.ts';
import { lockPdf, organizePdf } from '../packages/node-shell/src/pdf.ts';

const BASELINE = fileURLToPath(new URL('./fixtures/pdf-a11y-baseline.json', import.meta.url));
const enc = new TextEncoder();

/** A PDF from object bodies (object n is bodies[n - 1]). */
function pdf(bodies: string[], trailer = ''): Uint8Array {
  let out = '%PDF-1.7\n';
  const offsets: number[] = [];
  bodies.forEach((b, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${b}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer << /Size ${bodies.length + 1} /Root 1 0 R ${trailer} >>\nstartxref\n${xref}\n%%EOF\n`;
  return enc.encode(out);
}
const stream = (data: string) => `<< /Length ${data.length} >>\nstream\n${data}\nendstream`;

/** A one-page tagged PDF whose structure children are `kids` (objects 6 onward). */
function tagged(content: string, kids: string[], extraRoot = ''): Uint8Array {
  const refs = kids.map((_, i) => `${6 + i} 0 R`).join(' ');
  return pdf([
    `<< /Type /Catalog /Pages 2 0 R /StructTreeRoot 5 0 R /MarkInfo << /Marked true >> /Lang (en) ${extraRoot} >>`,
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> >> >> >>',
    stream(content),
    `<< /Type /StructTreeRoot /K [${refs}] >>`,
    ...kids,
  ]);
}
/** A Lolly PDF locked with an open password, as the Lock utility writes the file. */
async function lockPdfForTest(): Promise<Uint8Array> {
  const base = await writer(d => { d.text('Locked', 20, 40); });
  return (await lockPdf(base, 'secret')).bytes;
}
const status = (r: Awaited<ReturnType<typeof checkPdfAccessibility>>, id: string) => r.rules.find(x => x.id === id)!;

// ── The module and its words ────────────────────────────────────────────────

test('the engine words every check the module reports, and only those', async () => {
  const r = await checkPdfAccessibility(pdf(['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [] /Count 0 >>']));
  assert.deepEqual(r.rules.map(x => x.id), [...PDF_ACCESSIBILITY_RULE_IDS]);
  assert.equal(r.rules.length, 32);
});

test('an untagged page fails the tag checks and the structure checks do not apply', async () => {
  const r = await checkPdfAccessibility(pdf([
    '<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>', stream('0 0 10 10 re f'),
  ]));
  assert.equal(status(r, 'tagged-pdf').status, 'failed');
  assert.equal(status(r, 'tagged-content').status, 'failed');
  for (const id of ['table-rows', 'figures-alt-text', 'heading-nesting', 'list-items']) assert.equal(status(r, id).applies, false, id);
  const rows = summarisePdfAccessibility(r).rows;
  assert.equal(rows.find(x => x.id === 'table-headers')!.outcome, 'not-applicable', 'nothing to look at is not a pass');
  assert.equal(rows.find(x => x.id === 'tagged-pdf')!.outcome, 'fail');
  assert.equal(rows.find(x => x.id === 'color-contrast')!.outcome, 'needs-person');
});

test('a figure without alternate text fails and one with it passes', async () => {
  const content = '/Figure << /MCID 0 >> BDC 0 0 10 10 re f EMC';
  const bare = await checkPdfAccessibility(tagged(content, ['<< /S /Figure /Pg 3 0 R /K 0 >>']));
  assert.equal(status(bare, 'figures-alt-text').status, 'failed');
  assert.equal(status(bare, 'figures-alt-text').findings[0]!.page, 1, 'pages count from 1');
  const described = await checkPdfAccessibility(tagged(content, ['<< /S /Figure /Pg 3 0 R /K 0 /Alt (A red square) >>']));
  assert.equal(status(described, 'figures-alt-text').status, 'passed');
  assert.equal(status(described, 'figures-alt-text').applies, true);
  assert.equal(status(described, 'tagged-content').status, 'passed');
});

test('table and heading checks fire on the structure they read', async () => {
  const content = '/H1 << /MCID 0 >> BDC 0 0 1 1 re f EMC /H3 << /MCID 1 >> BDC 2 0 1 1 re f EMC /TH << /MCID 2 >> BDC 4 0 1 1 re f EMC';
  const r = await checkPdfAccessibility(tagged(content, [
    '<< /S /H1 /Pg 3 0 R /K 0 >>', '<< /S /H3 /Pg 3 0 R /K 1 >>', '<< /S /Table /Pg 3 0 R /K 9 0 R >>', '<< /S /TR /Pg 3 0 R /K 10 0 R >>', '<< /S /TD /Pg 3 0 R /K 2 >>',
  ].map((x, i) => (i === 2 ? '<< /S /Table /Pg 3 0 R /K [9 0 R] >>' : i === 3 ? '<< /S /TR /Pg 3 0 R /K [10 0 R] >>' : x))));
  assert.equal(status(r, 'heading-nesting').status, 'failed');
  assert.equal(status(r, 'table-summary').status, 'failed');
  assert.equal(status(r, 'table-headers').status, 'failed');
  assert.equal(status(r, 'list-items').applies, false);
});

test('files the module cannot read are refused by name, never reported as a pass', async () => {
  await assert.rejects(checkPdfAccessibility(enc.encode('hello, not a pdf')), (e: unknown) => e instanceof PdfAccessibilityError && e.code === 'not-pdf');
  await assert.rejects(checkPdfAccessibility(new Uint8Array(0)), (e: unknown) => e instanceof PdfAccessibilityError && e.code === 'not-pdf');
  const locked = await lockPdfForTest();
  await assert.rejects(checkPdfAccessibility(locked), (e: unknown) => e instanceof PdfAccessibilityError && e.code === 'encrypted');
  const head = pdf(['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [] /Count 0 >>']).slice(0, 60);
  await assert.doesNotReject(checkPdfAccessibility(head).catch((e: unknown) => { if (!(e instanceof PdfAccessibilityError)) throw e; }), 'a truncated file ends in a named refusal or a report, never a crash');
});

test('the report never renders a verdict', async () => {
  const text = pdfAccessibilityText(summarisePdfAccessibility(await checkPdfAccessibility(tagged('0 0 1 1 re f', []))));
  for (const word of ['accessible', 'compliant', 'conforms', 'conformant', 'PASSED ALL']) assert.ok(!text.toLowerCase().includes(word.toLowerCase()), `report says "${word}"`);
  assert.match(text, /A person still needs to check the file/);
  assert.ok(PDF_ACCESSIBILITY_STATEMENTS.every(s => !/[—§]/.test(s)));
});

test('verifyExport adds the checks to a PDF export report and nothing to other formats', async () => {
  const doc = await createPdfDoc({ format: [200, 100] });
  doc.rect(0, 0, 10, 10, 'F');
  const bytes = new Uint8Array(await doc.output('arraybuffer') as ArrayBuffer);
  const report = await verifyExport({ format: 'pdf' }, bytes, { pdfAccessibility: checkPdfAccessibility });
  assert.ok(report.pdfAccessibility);
  assert.equal(report.pdfAccessibility.rows.length, 32);
  assert.ok(report.checks.some(c => c.property === 'pdf-accessibility' && c.state === 'reported'));
  assert.ok(report.statements.some(s => /not a PDF\/UA conformance test/.test(s)));
  assert.ok(report.findings.every(f => f.severity === 'info' || !/pdf-accessibility/.test(f.id)), 'the checks inform and never warn');
  const without = await verifyExport({ format: 'pdf' }, bytes);
  assert.equal(without.pdfAccessibility, undefined);
  const failing = await verifyExport({ format: 'pdf' }, bytes, { pdfAccessibility: async () => { throw new Error('boom'); } });
  assert.ok(failing.gaps.some(g => g.id === 'check.incomplete'), 'a reader that throws becomes a named gap');
});

// ── Lolly's own PDFs: the baseline ──────────────────────────────────────────

function png(width: number, height: number): Uint8Array {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Uint8Array) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Uint8Array) => {
    const body = new Uint8Array(4 + data.length); body.set(enc.encode(type)); body.set(data, 4);
    const out = new Uint8Array(12 + data.length); const v = new DataView(out.buffer);
    v.setUint32(0, data.length); out.set(body, 4); v.setUint32(8 + data.length, crc(body)); return out;
  };
  const ihdr = new Uint8Array(13); const iv = new DataView(ihdr.buffer); iv.setUint32(0, width); iv.setUint32(4, height); ihdr[8] = 8; ihdr[9] = 2;
  const raw = new Uint8Array((width * 3 + 1) * height); for (let y = 0; y < height; y++) for (let x = 0; x < width * 3; x++) raw[y * (width * 3 + 1) + 1 + x] = (x * 7 + y * 3) & 255;
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array(0))];
  return Uint8Array.from(parts.flatMap(p => [...p]));
}

async function writer(build: (doc: Awaited<ReturnType<typeof createPdfDoc>>) => void, title?: string): Promise<Uint8Array> {
  const doc = await createPdfDoc({ format: [300, 200] });
  if (title) doc.setProperties({ title, author: 'Lolly' });
  build(doc);
  return new Uint8Array(await doc.output('arraybuffer') as ArrayBuffer);
}

async function producers(): Promise<Record<string, Uint8Array>> {
  const text = await writer(d => { d.setFontSize(14); d.text('Hello from Lolly', 20, 60); d.setFillColor(0, 90, 160); d.rect(10, 80, 120, 40, 'F'); }, 'Baseline text page');
  const two = await writer(d => { d.text('Page one', 20, 40); d.addPage(); d.text('Page two', 20, 40); }, 'Two pages');
  return {
    'writer-text-with-title': text,
    'writer-vector-only': await writer(d => { d.setFillColor(200, 40, 40); d.circle(60, 60, 30, 'F'); d.line(0, 0, 300, 200); }),
    'writer-two-pages': two,
    'images-to-pdf': (await imagesToPdf([{ bytes: png(32, 24) }])).bytes,
    'organize-rotate': (await organizePdf(text, { operation: 'rotate', rotation: 90 })).bytes!,
  };
}

test('the findings in Lolly\'s own PDFs match the recorded baseline', async () => {
  const files = await producers();
  const current: Record<string, Record<string, string>> = {};
  for (const [name, bytes] of Object.entries(files)) {
    const summary = summarisePdfAccessibility(await checkPdfAccessibility(bytes));
    current[name] = Object.fromEntries(summary.rows.map(r => [r.id, r.outcome]));
  }
  const locked = await lockPdfForTest();
  const refusal = await checkPdfAccessibility(locked).then(() => 'checked', (e: unknown) => (e instanceof PdfAccessibilityError ? e.code : 'error'));
  const next = { note: 'What the PDF accessibility check finds in PDFs written by Lolly code today. A record, not a target.', refusals: { 'lock-pdf': refusal }, files: current };
  if (process.env.UPDATE_PDF_A11Y_BASELINE === '1') writeFileSync(BASELINE, JSON.stringify(next, null, 2) + '\n');
  assert.deepEqual(next, JSON.parse(readFileSync(BASELINE, 'utf8')),
    'the checker or a Lolly PDF writer changed what is found; review the difference, then rewrite the baseline with UPDATE_PDF_A11Y_BASELINE=1');
  assert.equal(refusal, 'encrypted');
});
