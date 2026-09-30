// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { sha256Hex } from '../engine/src/bytes.ts';
import { acceptProduction, applyProductionPatch, compareProductionPixels, inspectProduction, parseProductionContract, productionDigest, productionProblems, runProductionRepairs, type ProductionContract, type ProductionPixels } from '../engine/src/production.ts';
import { inspectProductionBytes } from '../packages/node-shell/src/production.ts';
const pdfSkip = ['pdfinfo', 'pdftotext', 'pdftoppm'].some(command => spawnSync(command, ['-v']).error) && 'Install Poppler executables for PDF production readback.';
const contract: ProductionContract = { profile: 'lolly/production-still-v1', id: 'legal-card', revision: '1', format: 'svg', width: 200, height: 100, pages: 1, alpha: 'any', requirements: [{ id: 'legal', kind: 'text', location: 'legal', expected: '£125 per year' }] };
const svg = (text = '£125 per year') => new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><text id="legal">${text}</text></svg>`);

test('final SVG: exact protected copy, byte binding and complete coverage', async () => {
  const bytes = svg(), report = await inspectProductionBytes(bytes, contract);
  assert.deepEqual(await productionProblems(report, bytes, contract), []);
  assert.ok((await productionProblems(report, svg('£12 per year'), contract)).includes('artifact-digest-mismatch'));
  const omitted = { ...report, checks: report.checks.slice(0, -1) }; const { reportSha256: _, ...body } = omitted; omitted.reportSha256 = await productionDigest(body);
  assert.ok((await productionProblems(omitted, bytes, contract)).includes('check-coverage-incomplete'));
  const changed = await inspectProductionBytes(svg('£12 per year'), contract);
  assert.equal(changed.checks.find(c => c.id === 'requirement.legal')!.state, 'fail');
  assert.equal(changed.checks.find(c => c.id === 'requirement.legal')!.location, 'legal');
});
test('missing and duplicate IDs, flattened facts, thrown collectors and budgets never pass', async () => {
  const missing = await inspectProductionBytes(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"/>'), contract);
  assert.equal(missing.checks.at(-1)!.state, 'fail');
  const duplicate = await inspectProductionBytes(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><text id="legal">£125 per year</text><text id="legal">£125 per year</text></svg>'), contract);
  assert.equal(duplicate.checks.at(-1)!.state, 'undetermined');
  const failed = await inspectProduction(svg(), contract, async () => { throw new Error('decoder'); });
  assert.ok(failed.checks.every(c => c.state === 'undetermined'));
  const bounded = await inspectProduction(new Uint8Array(32 * 1024 * 1024 + 1), contract, async () => { throw new Error('must not run'); });
  assert.ok(bounded.limitations.includes('artifact-byte-budget-exceeded'));
});
test('strict contract rejects misspellings, duplicate requirements and invalid comparison regions', () => {
  assert.throws(() => parseProductionContract({ ...contract, widht: 20 }));
  assert.throws(() => parseProductionContract({ ...contract, requirements: [...contract.requirements, ...contract.requirements] }));
  assert.throws(() => parseProductionContract({ ...contract, comparison: { referenceSha256: '0'.repeat(64), channelTolerance: 2, maxChangedFraction: .01, regions: [{ id: 'legal', x: 0, y: 0, width: 999, height: 1, minSsim: .99, maxInkDelta: 0 }] } }));
});
function pixels(width: number, height: number, value = 255): ProductionPixels { const rgba = new Uint8Array(width * height * 4); rgba.fill(value); for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255; return { width, height, rgba }; }
test('native calibration: declared rounding band passes; a small critical loss fails the region', () => {
  const reference = pixels(1000, 10), rounded = pixels(1000, 10, 254), removed = pixels(1000, 10);
  for (let i = 0; i < 10 * 4; i += 4) for (let c = 0; c < 3; c++) { reference.rgba[i + c] = 0; rounded.rgba[i + c] = 1; }
  const policy = { referenceSha256: '0'.repeat(64), channelTolerance: 2, maxChangedFraction: .01, regions: [{ id: 'legal', x: 0, y: 0, width: 10, height: 1, minSsim: .8, maxInkDelta: .01 }] };
  assert.ok(compareProductionPixels(reference, rounded, policy).every(c => c.state === 'pass'));
  const loss = compareProductionPixels(reference, removed, policy);
  assert.equal(loss[0]!.state, 'pass'); assert.equal(loss[2]!.state, 'fail');
  const alpha = pixels(1000, 10); alpha.rgba[3] = 0;
  assert.equal(compareProductionPixels(removed, alpha, { ...policy, channelTolerance: 0, maxChangedFraction: 0 })[0]!.state, 'fail');
  assert.equal(compareProductionPixels(reference, pixels(10, 1), policy)[0]!.state, 'fail');
});
test('real PNG readback preserves alpha and cannot infer protected copy', async () => {
  const sharp = (await import('sharp')).default;
  const bytes = new Uint8Array(await sharp({ create: { width: 200, height: 100, channels: 4, background: '#00000000' } }).png().toBuffer());
  const c = { ...contract, format: 'png' as const, alpha: 'opaque' as const };
  const report = await inspectProductionBytes(bytes, c);
  assert.equal(report.checks.find(c => c.id === 'alpha')!.state, 'fail');
  assert.equal(report.checks.at(-1)!.state, 'undetermined');
});
test('reference digest mismatch cannot borrow a prior comparison pass', async () => {
  const c = { ...contract, requirements: [], comparison: { referenceSha256: await sha256Hex(svg()), channelTolerance: 0, maxChangedFraction: 0, regions: [] } };
  const report = await inspectProduction(svg(), c, async () => ({ format: 'svg', readable: true, width: 200, height: 100, pages: 1, pixels: pixels(200, 100), limitations: [] }), { reference: svg('other') });
  assert.equal(report.checks.at(-1)!.state, 'undetermined');
});
test('bounded repairs preserve copy, reject stale source/findings, stop cycles, and survive serialization', async () => {
  const inputs = { layout: 'short', copy: '£125 per year' }, report = await inspectProductionBytes(svg(''), contract);
  const patch = { sourceSha256: await productionDigest(inputs), reportSha256: report.reportSha256, findingSha256: await productionDigest(report.checks.at(-1)), findingId: 'requirement.legal', input: 'layout', before: 'short', after: 'long' };
  const policy = { protected: ['copy'], permitted: { layout: ['short', 'long'] }, maxAttempts: 2 };
  const changed = await applyProductionPatch(inputs, JSON.parse(JSON.stringify(report)), patch, policy);
  assert.deepEqual(changed, { ...inputs, layout: 'long' });
  await assert.rejects(applyProductionPatch(changed, report, patch, policy), /stale/);
  await assert.rejects(applyProductionPatch(inputs, report, { ...patch, input: 'copy', before: inputs.copy, after: 'free' }, policy), /protected/);
  const run = await runProductionRepairs(inputs, policy, { render: async value => ({ bytes: svg(value.layout === 'long' ? String(value.copy) : ''), contract, report: await inspectProductionBytes(svg(value.layout === 'long' ? String(value.copy) : ''), contract) }), propose: async () => patch });
  assert.equal(run.stopped, 'verified'); assert.equal(run.attempts.length, 2);
  const stalled = await runProductionRepairs(inputs, policy, { render: async () => ({ report, bytes: svg(''), contract }), propose: async () => patch });
  assert.equal(stalled.stopped, 'no-progress'); assert.equal(stalled.attempts.length, 2);
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(runProductionRepairs(inputs, policy, { render: async () => ({ report, bytes: svg(''), contract }), propose: async () => null }, cancelled.signal), /abort/i);
});
test('acceptance cannot waive protected copy or unknown coverage; measured failures remain failures', async () => {
  const authority = { kind: 'local-person' as const, id: 'person', decisionRef: 'review-1' };
  const report = await inspectProductionBytes(svg('bad'), contract), check = report.checks.at(-1)!;
  await assert.rejects(acceptProduction(report, svg('bad'), contract, authority, [{ findingId: check.id, findingSha256: await productionDigest(check), reason: 'looks fine' }]), /Cannot except/);
  const good = await inspectProductionBytes(svg(), contract);
  const accepted = await acceptProduction(good, svg(), contract, authority);
  assert.equal(accepted.reportSha256, good.reportSha256);
});
test('PDF readback measures page geometry and extracted copy independently', { skip: pdfSkip }, async () => {
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const pdf = await PDFDocument.create(); const page = pdf.addPage([150, 75]);
  page.drawText('Legal 125', { x: 10, y: 20, size: 12, font: await pdf.embedFont(StandardFonts.Helvetica) });
  const bytes = await pdf.save();
  const c: ProductionContract = { ...contract, format: 'pdf', requirements: [{ id: 'legal', kind: 'text', location: 'page:1', expected: 'Legal 125' }], alpha: 'opaque' };
  const report = await inspectProductionBytes(bytes, c);
  assert.deepEqual(await productionProblems(report, bytes, c), []);
  assert.ok(report.records?.pdfBoxes);
  const mismatch = await inspectProductionBytes(bytes, { ...c, width: 201 });
  assert.equal(mismatch.checks.find(c => c.id === 'width')!.state, 'fail');
});
test('local creative exceptions bind exact failed measurements and cannot erase them', async () => {
  const bytes = svg(), c = { ...contract, comparison: { referenceSha256: await sha256Hex(bytes), channelTolerance: 0, maxChangedFraction: 0, regions: [] } };
  let calls = 0;
  const report = await inspectProduction(bytes, c, async () => ({ format: 'svg', readable: true, width: 200, height: 100, pages: 1, text: { legal: '£125 per year' }, pixels: pixels(200, 100, calls++ ? 255 : 0), limitations: [] }), { reference: bytes });
  const check = report.checks.at(-1)!; assert.equal(check.state, 'fail');
  const accepted = await acceptProduction(report, bytes, c, { kind: 'local-person', id: 'reviewer', decisionRef: 'review-7' }, [{ findingId: check.id, findingSha256: await productionDigest(check), reason: 'Explicitly approved this alternate background.' }]);
  assert.equal(accepted.exceptions.length, 1); assert.equal(check.state, 'fail');
  await assert.rejects(acceptProduction(report, svg('changed'), c, accepted.authority, accepted.exceptions), /current/);
});
test('supplied resource and source snapshots are required facts, not derived output claims', async () => {
  const c = { ...contract, sourceSha256: '1'.repeat(64), requirements: [{ id: 'logo', kind: 'resource' as const, location: 'brand/logo', expected: '2'.repeat(64) }] };
  const report = await inspectProduction(svg(), c, async () => ({ format: 'svg', readable: true, width: 200, height: 100, pages: 1, limitations: [] }), { resolved: { sourceSha256: '1'.repeat(64), resources: { 'brand/logo': '3'.repeat(64) } } });
  assert.equal(report.checks.find(c => c.id === 'source')!.state, 'pass');
  assert.equal(report.checks.at(-1)!.state, 'fail');
});
test('PDF three-part fixture: metadata variation passes; changed protected numbers fail', { skip: pdfSkip }, async () => {
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const make = async (copy: string, title: string) => { const pdf = await PDFDocument.create(); pdf.setTitle(title); const page = pdf.addPage([150, 75]); page.drawText(copy, { x: 10, y: 20, size: 12, font: await pdf.embedFont(StandardFonts.Helvetica) }); return pdf.save(); };
  const reference = await make('Legal 125', 'Reference'), variant = await make('Legal 125', 'Independent metadata');
  const c: ProductionContract = { ...contract, format: 'pdf', requirements: [{ id: 'legal', kind: 'text', location: 'page:1', expected: 'Legal 125' }], comparison: { referenceSha256: await sha256Hex(reference), channelTolerance: 0, maxChangedFraction: 0, regions: [{ id: 'legal', x: 0, y: 50, width: 150, height: 40, minSsim: 1, maxInkDelta: 0 }] } };
  assert.notEqual(await sha256Hex(reference), await sha256Hex(variant));
  const report = await inspectProductionBytes(variant, c, reference); assert.deepEqual(await productionProblems(report, variant, c), []);
  const broken = await make('Legal 12', 'Missing numeral'), failed = await inspectProductionBytes(broken, c, reference);
  assert.equal(failed.checks.find(c => c.id === 'requirement.legal')!.state, 'fail');
  assert.equal(failed.checks.find(c => c.id === 'appearance.legal.ink')!.state, 'fail');
});
test('saved local acceptance survives restart, but cannot be promoted to a governed decision', async () => {
  const { verifyProductionAcceptance } = await import('../engine/src/production.ts');
  const bytes = svg(), report = await inspectProductionBytes(bytes, contract);
  const acceptance = await acceptProduction(report, bytes, contract, { kind: 'local-person', id: 'reviewer', decisionRef: 'review-9' });
  await verifyProductionAcceptance(JSON.parse(JSON.stringify(acceptance)), report, bytes, contract);
  await assert.rejects(verifyProductionAcceptance(acceptance, report, svg('different'), contract), /current/);
  await assert.rejects(acceptProduction(report, bytes, contract, { kind: 'work-approval', id: 'claim', decisionRef: 'forged' }), /authorized Work/);
});
test('an unavailable required source is an unresolved attempt, not a malformed report', async () => {
  const c = { ...contract, sourceSha256: '0'.repeat(64) }, bytes = svg();
  const report = await inspectProductionBytes(bytes, c);
  const result = await runProductionRepairs({ layout: 'short' }, { protected: [], permitted: { layout: ['long'] }, maxAttempts: 1 }, {
    render: async () => ({ bytes, report, contract: c }), propose: async () => null,
  });
  assert.equal(result.stopped, 'unresolved'); assert.equal(result.attempts[0]!.report.checks.find(c => c.id === 'source')!.state, 'undetermined');
});
test('repairs stop when a passed requirement regresses even if the failure count improves', async () => {
  const c: ProductionContract = { ...contract, requirements: ['legal', 'title', 'logo'].map(id => ({ id, kind: 'text', location: id, expected: id })) };
  const render = async (inputs: Record<string, unknown>) => {
    const content = inputs.layout === 'short' ? '<text id="logo">logo</text>' : '<text id="legal">legal</text><text id="title">title</text>';
    const bytes = new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">${content}</svg>`);
    return { bytes, contract: c, report: await inspectProductionBytes(bytes, c) };
  };
  const plan = { protected: [], permitted: { layout: ['short', 'long', 'other'] }, maxAttempts: 3, when: [{ findingId: 'requirement.legal', input: 'layout' }] };
  const { proposeProductionPatch } = await import('../engine/src/production.ts');
  const result = await runProductionRepairs({ layout: 'short' }, plan, { render, propose: (inputs, report) => proposeProductionPatch(inputs, report, plan) });
  assert.equal(result.stopped, 'regression');
  assert.equal(result.attempts.length, 2);
  assert.equal(result.attempts[0]!.report.checks.filter(c => c.state === 'fail').length, 2);
  assert.equal(result.attempts[1]!.report.checks.filter(c => c.state === 'fail').length, 1);
  assert.equal(result.attempts[1]!.report.checks.find(c => c.id === 'requirement.logo')!.state, 'fail');
});
test('protected structured inputs preserve JSON types and need real runtime observations', async () => {
  const { productionInputFacts } = await import('../engine/src/production.ts');
  const data = [{ label: 'Revenue', value: 125, unit: 'GBP' }];
  const c: ProductionContract = { ...contract, requirements: [{ id: 'data', kind: 'input', location: 'rows', expected: await productionDigest(data) }] };
  const bytes = svg();
  const absent = await inspectProductionBytes(bytes, c);
  assert.equal(absent.checks.at(-1)!.state, 'undetermined');
  const inspect = async (value: unknown) => inspectProduction(bytes, c, async () => ({ format: 'svg', readable: true, width: 200, height: 100, pages: 1, limitations: [] }), { resolved: { inputs: await productionInputFacts([{ id: 'rows', value }], c) } });
  const report = await inspect(data);
  assert.deepEqual(await productionProblems(report, bytes, c), []);
  assert.equal((await inspect([{ label: 'Revenue', value: '125', unit: 'GBP' }])).checks.at(-1)!.state, 'fail');
  assert.equal((await inspect([{ label: 'Revenue', value: 125, unit: 'EUR' }])).checks.at(-1)!.state, 'fail');
  assert.doesNotMatch(JSON.stringify(report), /Revenue|GBP/);
  assert.equal(Object.keys(await productionInputFacts([{ id: 'rows', value: data }, { id: 'rows', value: data }], c)).length, 0);
  assert.equal(Object.keys(await productionInputFacts([{ id: 'rows', value: '😀'.repeat(300_000) }], c)).length, 0);
  assert.equal(Object.keys(await productionInputFacts([{ id: 'rows', value: new Array(2) }], c)).length, 0);
  const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
  assert.equal(Object.keys(await productionInputFacts([{ id: 'rows', value: cyclic }], c)).length, 0);
});
test('a repair plan cannot override a contract-protected input', async () => {
  const { productionInputFacts, proposeProductionPatch } = await import('../engine/src/production.ts');
  const c: ProductionContract = { ...contract, requirements: [{ id: 'data', kind: 'input', location: 'rows', expected: await productionDigest([125]) }] };
  const plan = { protected: [], permitted: { rows: [[12], [125]] }, maxAttempts: 1, when: [{ findingId: 'requirement.data', input: 'rows' }] };
  const run = await runProductionRepairs({ rows: [12] }, plan, {
    render: async inputs => ({ bytes: svg(), contract: c, report: await inspectProduction(svg(), c, async () => ({ format: 'svg', readable: true, width: 200, height: 100, pages: 1, limitations: [] }), { resolved: { inputs: await productionInputFacts([{ id: 'rows', value: inputs.rows }], c) } }) }),
    propose: (inputs, report) => proposeProductionPatch(inputs, report, plan),
  });
  assert.equal(run.stopped, 'protected-input');
  assert.equal(run.attempts.length, 1);
  assert.deepEqual(run.inputs, { rows: [12] });
});
