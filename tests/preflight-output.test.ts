// SPDX-License-Identifier: MPL-2.0
/**
 * The export report - engine/src/preflight-output.ts.
 *
 * Each comparison is exercised both ways: it fires when the file differs from
 * the request and stays silent when it matches. Three properties get their own
 * section at the end, because they are the reason the module exists:
 *   - measured values come from the bytes, and a request is never echoed back
 *     as an actual value;
 *   - an unread value is a gap, not a pass;
 *   - totality: hostile requests and facts degrade, they never throw.
 *
 * Run with: node --test tests/preflight-output.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { compareExport, exportRequestFromJob, verifyExport, EXPORT_REPORT_STATEMENTS } from '../engine/src/preflight-output.ts';
import type { ExportRequest, ExportReport } from '../engine/src/preflight-output.ts';
import { inspectOutput } from '../engine/src/output-facts.ts';
import { computePrintGeometry } from '../engine/src/print-marks.ts';
import { packApng } from '../engine/src/apng.ts';
import { packTiff } from '../engine/src/tiff.ts';
import { storeZip } from '../engine/src/zip.ts';
import { attachC2paStore } from '../engine/src/c2pa-containers.ts';
import type { PreflightJob } from '../engine/src/preflight.ts';
import type { Finding } from '@lolly-tools/core';
import {
  bytesOf, encryptedPdf, fakeStore, gif, jpeg, mp4, pdf, rgbPng, rgbaPng,
} from './helpers/output-fixtures.ts';

const px = (value: number) => ({ value, unit: 'px' as const });
const mm = (value: number) => ({ value, unit: 'mm' as const });
const ids = (r: { findings: readonly Finding[] }): string[] => r.findings.map(f => f.id);
const find = (r: { findings: readonly Finding[] }, id: string): Finding | undefined => r.findings.find(f => f.id === id);
const row = (r: ExportReport, property: string) => {
  const found = r.checks.find(c => c.property === property);
  assert.ok(found, `a ${property} row`);
  return found;
};

const baseJob = (over: Partial<PreflightJob['settings']> = {}, stage: PreflightJob['stage'] = { known: false, why: 'needs-mount' }): PreflightJob => ({
  source: 'test',
  manifest: { id: 'test-tool', render: { width: 1200, height: 630, formats: ['png', 'pdf', 'mp4'] } },
  settings: {
    format: 'png',
    size: { width: px(1200), height: px(630), dpi: 300, declaredBy: 'url', unitDeclared: true },
    bleed: { known: true, value: null },
    marks: { known: true, value: null },
    pressProfile: { known: true, value: null },
    ...over,
  },
  palette: { known: false, why: 'not-resolved' },
  stage,
});

// ─── the request ────────────────────────────────────────────────────────────

test('exportRequestFromJob: a typed size is a request; a manifest size is not', () => {
  const typed = exportRequestFromJob(baseJob());
  assert.deepEqual(typed.size, { width: px(1200), height: px(630), dpi: 300 });
  const manifest = exportRequestFromJob(baseJob({ size: { width: px(1200), height: px(630), dpi: 300, declaredBy: 'manifest', unitDeclared: false } }));
  assert.equal(manifest.size, undefined);
  // A physical size whose unit the source never stated is a collector bug, not a request.
  const unstated = exportRequestFromJob(baseJob({ size: { width: mm(210), height: mm(297), dpi: 300, declaredBy: 'url', unitDeclared: false } }));
  assert.equal(unstated.size, undefined);
});

test('exportRequestFromJob: credential, password, HDR, boards and contact sheets carry over; extra wins', () => {
  const r = exportRequestFromJob(
    baseJob({ format: 'PNG', c2pa: { known: true, value: true }, password: true, hdr: true, cuts: 4 }, { known: true, value: { isSequence: true, durationMs: 4000, pageBoxes: 3 } }),
    { alpha: 'transparent', password: undefined },
  );
  assert.equal(r.format, 'png');
  assert.equal(r.credential, true);
  assert.equal(r.password, undefined);
  assert.equal(r.hdr, true);
  assert.equal(r.boards, 3);
  assert.equal(r.archive, true);
  assert.equal(r.alpha, 'transparent');
  assert.equal(r.durationMs, undefined, 'a still format takes no duration from the stage');
  const motion = exportRequestFromJob(baseJob({ format: 'mp4' }, { known: true, value: { isSequence: true, durationMs: 4000 } }));
  assert.equal(motion.durationMs, 4000);
  assert.equal(exportRequestFromJob(baseJob({ c2pa: { known: false, why: 'not-carried' } })).credential, undefined);
});

// ─── format, bytes and binding ──────────────────────────────────────────────

test('the report is bound to the exact bytes: one changed byte changes the digest', async () => {
  const bytes = rgbaPng({ text: true });
  const report = await verifyExport({ format: 'png' }, bytes);
  assert.equal(report.$format, 'lolly-export-report');
  assert.equal(report.formatVersion, 1);
  assert.equal(report.output.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(report.output.bytes, bytes.length);
  const changed = bytes.slice();
  changed[changed.length - 5]! ^= 1;
  assert.notEqual((await verifyExport({ format: 'png' }, changed)).output.sha256, report.output.sha256);
  assert.deepEqual(report.statements, EXPORT_REPORT_STATEMENTS);
});

test('format: a PNG under an AVIF request differs; a PNG under a PNG request matches', async () => {
  const wrong = await verifyExport({ format: 'avif' }, rgbaPng());
  assert.equal(row(wrong, 'format').state, 'differs');
  assert.equal(find(wrong, 'output.format-differs')?.severity, 'warn');
  const right = await verifyExport({ format: 'png' }, rgbaPng());
  assert.equal(row(right, 'format').state, 'match');
  assert.ok(!ids(right).includes('output.format-differs'));
});

test('format: a format with no signature is a named gap, not a pass', async () => {
  const r = await verifyExport({ format: 'csv' }, bytesOf('a,b\n1,2\n'));
  assert.equal(row(r, 'format').state, 'unchecked');
  const gap = find(r, 'output.unverified');
  assert.equal(gap?.needs, 'not-computable');
  assert.equal(gap?.severity, 'info');
});

test('format: an archive request compares the ZIP container instead of the member format', async () => {
  const r = await verifyExport({ format: 'png', archive: true, size: { width: px(4), height: px(3), dpi: 96 } }, storeZip([{ name: 'a.png', bytes: rgbaPng() }]));
  assert.equal(row(r, 'format').state, 'match');
  assert.ok(!ids(r).includes('output.size-differs'));
});

test('bytes: over a byte limit is an error; within it matches; no limit is reported only', async () => {
  const bytes = rgbaPng();
  const over = await verifyExport({ format: 'png', maxBytes: 10 }, bytes);
  assert.equal(find(over, 'output.over-byte-budget')?.severity, 'error');
  assert.equal(row(await verifyExport({ format: 'png', maxBytes: 1_000_000 }, bytes), 'bytes').state, 'match');
  assert.equal(row(await verifyExport({ format: 'png' }, bytes), 'bytes').state, 'reported');
});

// ─── size, pages and resolution ─────────────────────────────────────────────

test('raster size: a different pixel count is a warning; the same count matches', async () => {
  const off = await verifyExport({ format: 'png', size: { width: px(8), height: px(6), dpi: 96 } }, rgbaPng());
  assert.equal(row(off, 'width').state, 'differs');
  const f = find(off, 'output.size-differs');
  assert.equal(f?.severity, 'warn');
  assert.match(f!.message, /4 x 3 pixels; 8 x 6 was requested/);
  const on = await verifyExport({ format: 'png', size: { width: px(4), height: px(3), dpi: 96 } }, rgbaPng());
  assert.equal(row(on, 'width').state, 'match');
  assert.ok(!ids(on).includes('output.size-differs'));
});

test('raster size: no request reports the measured size and compares nothing', async () => {
  const r = await verifyExport({ format: 'png' }, rgbaPng());
  assert.equal(row(r, 'width').state, 'reported');
  assert.deepEqual(row(r, 'width').requested, { known: false, why: 'not-set' });
  assert.deepEqual(row(r, 'width').actual, { known: true, value: 4 });
});

test('raster size: several boards make the request describe one board, so it is not compared', async () => {
  const r = await verifyExport({ format: 'png', boards: 3, size: { width: px(800), height: px(600), dpi: 96 } }, rgbaPng());
  assert.equal(row(r, 'width').state, 'unchecked');
  assert.ok(!ids(r).includes('output.size-differs'));
  assert.equal(r.findings.filter(f => f.id === 'output.unverified').length, 1);
});

test('resolution: recorded DPI is compared with a physical request, and its absence is a warning', async () => {
  const size = (dpi: number) => ({ width: mm(25.4 * 4 / dpi), height: mm(25.4 * 3 / dpi), dpi });
  assert.equal(row(await verifyExport({ format: 'png', size: size(300) }, rgbaPng({ dpi: 300 })), 'dpi').state, 'match');
  const differs = await verifyExport({ format: 'png', size: size(150) }, rgbaPng({ dpi: 300 }));
  assert.equal(find(differs, 'output.dpi-differs')?.severity, 'warn');
  const missing = await verifyExport({ format: 'png', size: size(300) }, rgbaPng());
  assert.equal(find(missing, 'output.dpi-missing')?.severity, 'warn');
  // A pixel request asks for no resolution, so none is compared.
  assert.equal(row(await verifyExport({ format: 'png', size: { width: px(4), height: px(3), dpi: 300 } }, rgbaPng({ dpi: 72 })), 'dpi').state, 'reported');
});

test('page size: a PDF page is compared in points; A4 matches A4 and not 100 mm', async () => {
  const a4 = await pdf();
  const match = await verifyExport({ format: 'pdf', size: { width: mm(210), height: mm(297), dpi: 300 } }, a4);
  assert.equal(row(match, 'page-width').state, 'match');
  assert.ok(!ids(match).includes('output.page-size-differs'));
  const off = await verifyExport({ format: 'pdf', size: { width: mm(100), height: mm(100), dpi: 300 } }, a4);
  const f = find(off, 'output.page-size-differs');
  assert.equal(f?.severity, 'warn');
  assert.match(f!.message, /210 x 297 mm; 100 x 100 mm was requested/);
});

test('page size: with bleed and marks and no TrimBox, the expected page is the print geometry media box', async () => {
  const trim = { w: (210 / 25.4) * 72, h: (297 / 25.4) * 72 };
  const marks = { crop: true };
  const geo = computePrintGeometry({ trimWpt: trim.w, trimHpt: trim.h, bleedPt: (3 / 25.4) * 72, marks });
  const bytes = await pdf({ size: [geo.page.w, geo.page.h] });
  const r = await verifyExport({ format: 'pdf-cmyk', size: { width: mm(210), height: mm(297), dpi: 300 }, bleed: mm(3), marks }, bytes);
  assert.equal(row(r, 'page-width').state, 'match');
  assert.equal(row(r, 'page-height').state, 'match');
});

test('page size: a TrimBox is compared with the trim, not with the media box', async () => {
  const bytes = await pdf({ trim: true, size: [595.28 + 18, 841.89 + 18] });
  const r = await verifyExport({ format: 'pdf', size: { width: mm(210), height: mm(297), dpi: 300 }, bleed: mm(3) }, bytes);
  assert.equal(row(r, 'page-width').state, 'match');
  assert.equal(row(r, 'page-width').basis, 'pdf.page.TrimBox');
});

test('pages: a different count warns, an equal count matches, an unread count is a gap', async () => {
  const two = await pdf({ pages: 2 });
  assert.equal(find(await verifyExport({ format: 'pdf', pages: 3 }, two), 'output.pages-differ')?.severity, 'warn');
  assert.equal(row(await verifyExport({ format: 'pdf', pages: 2 }, two), 'pages').state, 'match');
  const broken = bytesOf('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n');
  const gap = await verifyExport({ format: 'pdf', pages: 1 }, broken);
  assert.equal(row(gap, 'pages').state, 'unchecked');
  assert.equal(find(gap, 'output.unverified')?.needs, 'not-resolved');
});

// ─── timing ─────────────────────────────────────────────────────────────────

test('duration: a video within tolerance matches; a different length warns', async () => {
  assert.equal(row(await verifyExport({ format: 'mp4', durationMs: 5050 }, mp4()), 'duration').state, 'match');
  const long = await verifyExport({ format: 'mp4', durationMs: 8000 }, mp4());
  const f = find(long, 'output.duration-differs');
  assert.equal(f?.severity, 'warn');
  assert.match(f!.message, /runs 5 s; 8 s was requested/);
});

test('duration: an animated raster allows its frame-delay rounding', async () => {
  // GIF delays are whole centiseconds, so a 15 fps clip runs about 5 percent long.
  assert.equal(row(await verifyExport({ format: 'gif', durationMs: 190 }, gif()), 'duration').state, 'match');
  assert.equal(row(await verifyExport({ format: 'apng', durationMs: 1000 }, packApng([rgbaPng(), rgbaPng()], { delayMs: 500 })), 'frames').state, 'match');
});

test('frames: a single frame under an animated request is a flattened animation', async () => {
  const r = await verifyExport({ format: 'gif', durationMs: 2000 }, gif(1));
  assert.equal(row(r, 'frames').state, 'differs');
  assert.equal(find(r, 'output.animation-flattened')?.severity, 'warn');
  assert.ok(!ids(await verifyExport({ format: 'gif', durationMs: 200 }, gif())).includes('output.animation-flattened'));
  // A still format carries no timing, so a stray length is not compared or reported as a gap.
  const still = await verifyExport({ format: 'png', durationMs: 5000 }, rgbaPng());
  assert.ok(!still.checks.some(c => c.property === 'duration' && c.requested.known));
  assert.ok(!still.findings.some(f => f.evidence?.property === 'duration'));
});

// ─── pixels, colour and HDR ─────────────────────────────────────────────────

test('alpha: a transparent request in a file without an alpha channel warns', async () => {
  assert.equal(find(await verifyExport({ format: 'png', alpha: 'transparent' }, rgbPng()), 'output.alpha-lost')?.severity, 'warn');
  assert.equal(find(await verifyExport({ format: 'jpg', alpha: 'transparent' }, jpeg()), 'output.alpha-lost')?.severity, 'warn');
  assert.equal(row(await verifyExport({ format: 'png', alpha: 'transparent' }, rgbaPng()), 'alpha').state, 'match');
  // An alpha channel can be fully opaque, so an opaque request does not object to one.
  assert.equal(row(await verifyExport({ format: 'png', alpha: 'opaque' }, rgbaPng()), 'alpha').state, 'match');
});

test('colour: a separation request in RGB is an error, mixed colour a warning, CMYK a match', async () => {
  const rgbPdf = await verifyExport({ format: 'pdf-cmyk' }, await pdf({ colour: 'rgb' }));
  assert.equal(find(rgbPdf, 'output.colour-model-differs')?.severity, 'error');
  assert.equal(row(await verifyExport({ format: 'pdf-cmyk' }, await pdf({ colour: 'cmyk' })), 'colour').state, 'match');
  const tiff = await verifyExport({ format: 'cmyk-tiff' }, packTiff(new Uint8Array(12), { width: 2, height: 2 }));
  assert.equal(find(tiff, 'output.colour-model-differs')?.severity, 'error');
  const mixed = compareExport({ format: 'pdf-cmyk' }, { ...inspectOutput(await pdf()), colour: { known: true, value: 'mixed' } });
  assert.equal(find(mixed, 'output.colour-model-differs')?.severity, 'warn');
  // An RGB format asks for no colour model, so nothing is compared.
  assert.equal(row(await verifyExport({ format: 'pdf' }, await pdf()), 'colour').state, 'reported');
});

test('HDR: a request without PQ signalling warns; with it, matches', async () => {
  assert.equal(find(await verifyExport({ format: 'png', hdr: true }, rgbaPng()), 'output.hdr-not-signalled')?.severity, 'warn');
  assert.equal(row(await verifyExport({ format: 'png', hdr: true }, rgbaPng({ cicp: true })), 'hdr').state, 'match');
  assert.equal(row(await verifyExport({ format: 'mp4', hdr: true }, mp4(16)), 'hdr').state, 'match');
});

// ─── credential, encryption and fonts ───────────────────────────────────────

test('credential: requested and absent warns; requested and present matches without claiming verification', async () => {
  const missing = await verifyExport({ format: 'png', credential: true }, rgbaPng());
  assert.equal(find(missing, 'output.credential-missing')?.severity, 'warn');
  const present = await verifyExport({ format: 'png', credential: true }, attachC2paStore(rgbaPng(), 'png', fakeStore()));
  assert.equal(row(present, 'credential').state, 'match');
  assert.ok(!present.findings.some(f => f.id.startsWith('output.credential')));
  assert.ok(present.statements.some(s => /has not been verified/.test(s)));
  const unrequested = await verifyExport({ format: 'png', credential: false }, attachC2paStore(rgbaPng(), 'png', fakeStore()));
  assert.equal(find(unrequested, 'output.credential-present')?.severity, 'info');
});

test('encryption: a password with an unencrypted file is an error; an encrypted file matches', async () => {
  assert.equal(find(await verifyExport({ format: 'pdf', password: true }, await pdf()), 'output.encryption-missing')?.severity, 'error');
  assert.equal(row(await verifyExport({ format: 'pdf', password: true }, encryptedPdf()), 'encryption').state, 'match');
  // Lolly encrypts PDF and ZIP only, so a password beside a PNG was never part of that export.
  const png = await verifyExport({ format: 'png', password: true }, rgbaPng());
  assert.ok(!png.checks.some(c => c.property === 'encryption' && c.requested.known));
  assert.ok(!ids(png).includes('output.encryption-missing'));
});

test('fonts: unembedded standard faces are a note in PDF and a warning in PDF/X', async () => {
  const bytes = await pdf({ text: true });
  assert.equal(find(await verifyExport({ format: 'pdf' }, bytes), 'output.fonts-not-embedded')?.severity, 'info');
  assert.equal(find(await verifyExport({ format: 'pdf-cmyk' }, await pdf({ text: true, colour: 'cmyk' })), 'output.fonts-not-embedded')?.severity, 'warn');
  assert.ok(!ids(await verifyExport({ format: 'pdf' }, await pdf())).includes('output.fonts-not-embedded'));
});

test('SVG live text is stated as a note, with the embedded face count', async () => {
  const r = await verifyExport({ format: 'svg' }, bytesOf('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><text>a</text><text>b</text></svg>'));
  const f = find(r, 'output.live-text');
  assert.equal(f?.severity, 'info');
  assert.equal(f?.evidence?.liveText, 2);
});

// ─── the properties the module exists for ───────────────────────────────────

test('a requested value is never echoed back as a measured one', async () => {
  const r = await verifyExport({ format: 'mp4', durationMs: 4000, size: { width: px(1920), height: px(1080), dpi: 96 } }, mp4());
  assert.deepEqual(row(r, 'duration').actual, { known: true, value: 5000 });
  assert.deepEqual(row(r, 'width').actual, { known: true, value: 640 });
  assert.equal(r.requested.durationMs, 4000);
  assert.equal(r.requested.width, 1920);
});

test('gap invariant: every finding with needs is info and carries no count, and gaps lists them all', async () => {
  const r = await verifyExport({ format: 'pdf', pages: 2, credential: true, size: { width: px(10), height: px(10), dpi: 96 } }, bytesOf('%PDF-1.4\n'));
  assert.ok(r.gaps.length > 0);
  for (const f of r.findings) if (f.needs) { assert.equal(f.severity, 'info'); assert.equal(f.count, undefined); }
  assert.deepEqual(r.gaps, r.findings.filter(f => f.needs));
});

test('findings are severity-ordered and stable across runs', async () => {
  const bytes = rgbPng();
  const req: ExportRequest = { format: 'png', maxBytes: 1, alpha: 'transparent', credential: true, size: { width: px(9), height: px(9), dpi: 96 } };
  const a = await verifyExport(req, bytes), b = await verifyExport(req, bytes);
  assert.deepEqual(a, b);
  const rank = { error: 0, warn: 1, info: 2 } as const;
  for (let i = 1; i < a.findings.length; i++) assert.ok(rank[a.findings[i - 1]!.severity] <= rank[a.findings[i]!.severity]);
});

test('totality: hostile requests and facts degrade instead of throwing', async () => {
  const bytes = rgbaPng();
  for (const req of [null, undefined, 42, 'png', { format: 7 }, { format: 'png', size: { width: 'x', height: null, dpi: -1 } }, { format: 'pdf', bleed: { value: Number.NaN, unit: 'mm' }, marks: 'crop' }]) {
    const r = await verifyExport(req as unknown as ExportRequest, bytes);
    assert.equal(r.$format, 'lolly-export-report');
  }
  const broken = { ...inspectOutput(bytes), width: null } as unknown as ReturnType<typeof inspectOutput>;
  const out = compareExport({ format: 'png', size: { width: px(4), height: px(3), dpi: 96 } }, broken);
  assert.ok(out.findings.some(f => f.id === 'check.incomplete'));
});
