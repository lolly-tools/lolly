// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  forensicTextFindings,
  forensicLayoutFindings,
  forensicRasterCards,
  forensicReport,
  verifyForensicReport,
  forensicModelWindows,
  forensicLanguage,
} from '../engine/src/forensic.ts';
import type { ForensicPage } from '../engine/src/forensic.ts';
const page = (text = ''): ForensicPage => ({
  id: '1',
  width: 600,
  height: 400,
  text,
  complete: true,
  source: 'digital',
  lines: [],
  shapes: [],
});
const numbered = (n: number, prefix = '# ') =>
  Array.from(
    { length: n },
    (_, i) => `${prefix}${String(i + 1).padStart(2, '0')} Product ${i + 1}`
  ).join('\n');
test('decorative sequences require a complete short list and retain literal offsets', () => {
  const p = page(numbered(4)),
    f = forensicTextFindings(p).find((f) => f.rule === 'decorative-numbering')!;
  assert.equal(f.measurements.count, 4);
  assert.equal(f.locations.length, 4);
  assert.equal(p.text.slice(f.locations[1]!.span!.index, f.locations[1]!.span!.index + 4), '# 02');
  for (const n of [1, 10, 12])
    assert.equal(
      forensicTextFindings(page(numbered(n))).some((f) => f.rule === 'decorative-numbering'),
      false
    );
  assert.equal(
    forensicTextFindings({ ...p, complete: false }).some((f) => f.rule === 'decorative-numbering'),
    false
  );
  assert.equal(
    forensicTextFindings(page('1. One\n2. Two\n3. Three')).some(
      (f) => f.rule === 'decorative-numbering'
    ),
    false
  );
  assert.equal(
    forensicTextFindings({ ...page('# 1 One\n# 2 Two'), docKind: 'markdown' }).some(
      (f) => f.rule === 'decorative-numbering'
    ),
    false
  );
  assert.equal(
    forensicTextFindings(page('# 01 Step one\n# 02 Step two')).find(
      (f) => f.rule === 'decorative-numbering'
    )!.contribution,
    'context-excluded'
  );
});
test('eyebrows need no redundancy; confidence and explanatory context remain explicit', () => {
  const p = page();
  p.lines = [
    {
      text: 'Growth strategy',
      confidence: 0.9,
      size: 14,
      box: { x: 30, y: 40, width: 110, height: 16 },
    },
    {
      text: 'Our growth strategy',
      confidence: 0.9,
      size: 30,
      box: { x: 30, y: 65, width: 280, height: 36 },
    },
  ];
  const f = forensicLayoutFindings(p)[0]!;
  assert.equal(f.rule, 'redundant-eyebrow');
  assert.equal(f.locations.length, 2);
  p.lines[0]!.text = 'NEWS';
  assert.equal(forensicLayoutFindings(p)[0]!.contribution, 'weak-clue');
  p.text = 'Eyebrow headings explained';
  assert.equal(forensicLayoutFindings(p)[0]!.contribution, 'context-excluded');
  p.text = '';
  p.lines[0]!.confidence = 0.4;
  assert.equal(forensicLayoutFindings(p).length, 0);
  p.lines[0]!.confidence = 0.9;
  p.lines[1]!.box.x = 300;
  assert.equal(forensicLayoutFindings(p).length, 0);
});
function raster(round: boolean, edge: boolean, full = false) {
  const width = 300,
    height = 200,
    data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 40; y < 150; y++)
    for (let x = 40; x < 250; x++) {
      const dx = Math.max(55 - x, x - 234, 0),
        dy = Math.max(55 - y, y - 134, 0);
      if (round && dx * dx + dy * dy > 225) continue;
      const accent = edge && (x < 48 || (full && (x > 241 || y < 48 || y > 141))),
        i = (y * width + x) * 4;
      data[i] = accent ? 20 : 235;
      data[i + 1] = accent ? 170 : 235;
      data[i + 2] = accent ? 90 : 235;
    }
  return { data, width, height };
}
test('raster accent cards localize rounded bodies, reject square and complete borders', () => {
  const p = raster(true, true),
    s = forensicRasterCards(p.data, p.width, p.height);
  assert.equal(s.length, 1);
  assert.ok(Math.abs(s[0]!.box.x - 40) < 2);
  assert.ok(Math.abs(s[0]!.box.width - 210) < 2);
  for (const [round, accent, full] of [
    [false, true, false],
    [true, false, false],
    [true, true, true],
  ]) {
    const n = raster(round!, accent!, full!);
    assert.equal(forensicRasterCards(n.data, n.width, n.height).length, 0);
  }
  assert.throws(() => forensicRasterCards(new Uint8ClampedArray(1), 1, 1));
});
test('one repeated card family cannot become strong evidence; report binds exact bytes', async () => {
  const p = page();
  p.shapes = Array.from({ length: 40 }, (_, i) => ({
    box: { x: i, y: 40, width: 200, height: 80 },
    radius: 12,
    fill: '#eee',
    accent: { edge: 'left' as const, width: 5, colour: '#2a5' },
  }));
  const bytes = new Uint8Array([1, 2, 3]),
    r = await forensicReport(bytes, [p], []);
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0]!.locations.length, 40);
  assert.equal(r.evidence.families, 1);
  assert.notEqual(r.evidence.band, 'strong');
  assert.equal(r.likelihood.state, 'unavailable');
  assert.equal(await verifyForensicReport(r, bytes), true);
  assert.equal(await verifyForensicReport(r, new Uint8Array([1, 2, 4])), false);
  assert.equal(
    await verifyForensicReport({ ...r, evidence: { ...r.evidence, score: 100 } }, bytes),
    false
  );
});
test('windows measure tokens, cover the tail, and report sampled gaps', async () => {
  const text = 'The team has a report with all of the findings and our review. '.repeat(100);
  const measure = (s: string) => s.length + 2;
  const full = await forensicModelWindows(
    text,
    512,
    measure,
    async (s) => (s.includes('review') ? 0.8 : 0.2),
    32
  );
  assert.equal(full.complete, true);
  assert.ok(full.windows.every((w) => w.tokens <= 512));
  assert.equal(full.windows.at(-1)!.index + full.windows.at(-1)!.length, text.length);
  const sampled = await forensicModelWindows(text, 512, measure, async () => 0.3, 2);
  assert.equal(sampled.complete, false);
  assert.equal(sampled.windows[0]!.index, 0);
  assert.equal(sampled.windows.at(-1)!.index + sampled.windows.at(-1)!.length, text.length);
  assert.equal(forensicLanguage(text), 'english');
  assert.equal(
    forensicLanguage(
      'Le rapport est dans une section et les données sont pour la revue. '.repeat(8)
    ),
    'other-or-uncertain'
  );
});
test('a list continued across pages cannot be miscounted as fewer than ten items', async () => {
  const bytes = new Uint8Array([4]),
    a = page(numbered(6)),
    b = {
      ...page(
        Array.from({ length: 6 }, (_, i) => `# ${String(i + 7).padStart(2, '0')} Product`).join(
          '\n'
        )
      ),
      id: '2',
    };
  const full = await forensicReport(bytes, [a, b], []);
  assert.equal(
    full.findings.some((f) => f.rule === 'decorative-numbering'),
    false
  );
  const partial = await forensicReport(
    bytes,
    [a, { ...b, text: '', complete: false }],
    [{ collector: 'page', page: '2', state: 'failed', reason: 'Unread', version: 'test' }]
  );
  assert.equal(
    partial.findings.some((f) => f.rule === 'decorative-numbering'),
    false
  );
  const short = await forensicReport(
    bytes,
    [page('# 01 First'), { ...page('# 02 Second'), id: '2' }],
    []
  );
  const f = short.findings.find((f) => f.rule === 'decorative-numbering')!;
  assert.deepEqual(
    f.locations.map((l) => l.page),
    ['1', '2']
  );
});
test('a calibration requires a matching population and reviewed release evidence', async () => {
  const { applyForensicCalibration, FORENSIC_VERSION } = await import('../engine/src/forensic.ts');
  const { productionDigest } = await import('../engine/src/production/contract.ts');
  const bytes = new Uint8Array([8]);
  const r = await forensicReport(
    bytes,
    [
      page(
        'The report is for the team and it has a section with the findings from our work. '.repeat(
          6
        )
      ),
    ],
    [
      {
        collector: 'native-text',
        page: '1',
        state: 'completed',
        reason: 'Original text',
        version: 'test',
      },
    ],
    [],
    [],
    [],
    'text'
  );
  const body = {
    id: 'synthetic-contract-test',
    version: 'test/1',
    rulesVersion: FORENSIC_VERSION,
    target: 'substantive-generative-contribution' as const,
    population: 'Synthetic gate fixture; never shipped',
    prior: 0.5,
    formats: ['text' as const],
    modalities: ['text' as const],
    sources: ['digital' as const],
    modelIds: [],
    modelVersions: [],
    features: ['coverage.partial'],
    weights: [0],
    intercept: 0,
    gates: {
      preregistrationSha256: 'a'.repeat(64),
      minDocuments: 500,
      maxEce: 0.05,
      maxFalsePositiveUpper95: 0.05,
      minRecall: 0.5,
      maxBrier: 0.25,
    },
    evaluation: {
      holdoutSha256: 'b'.repeat(64),
      documents: 1000,
      humanDocuments: 500,
      aiDocuments: 500,
      brier: 0.1,
      logLoss: 0.3,
      ece: 0.02,
      falsePositiveRate: 0.01,
      falsePositiveUpper95: 0.03,
      recall: 0.7,
      released: true,
    },
  };
  const artifact = { ...body, sha256: await productionDigest(body) };
  assert.equal((await applyForensicCalibration(r, artifact)).likelihood.state, 'calibrated');
  for (const changes of [
    { evaluation: { ...body.evaluation, released: false } },
    { rulesVersion: 'different' },
    { formats: ['pdf' as const] },
    { evaluation: { ...body.evaluation, ece: 0.3 } },
    { evaluation: { ...body.evaluation, humanDocuments: 38 } },
  ]) {
    const changed = { ...body, ...changes };
    assert.equal(
      (await applyForensicCalibration(r, { ...changed, sha256: await productionDigest(changed) }))
        .likelihood.state,
      'unavailable'
    );
  }
  const unread = { ...r, pages: r.pages.map((p) => ({ ...p, complete: false })) };
  assert.equal((await applyForensicCalibration(unread, artifact)).likelihood.state, 'unavailable');
});

test('an imported report rejects malformed display fields even with a recomputed digest', async () => {
  const { productionDigest } = await import('../engine/src/production/contract.ts');
  const bytes = new TextEncoder().encode('source'),
    report = await forensicReport(bytes, [page(numbered(3))], []);
  for (const change of [
    (r: typeof report) => {
      Reflect.set(r.evidence, 'score', '<img src=x onerror=alert(1)>');
    },
    (r: typeof report) => {
      r.findings[0]!.locations[0]!.span = { index: 100_000, length: 1 };
    },
    (r: typeof report) => {
      Reflect.set(r, 'likelihood', null);
    },
    (r: typeof report) => {
      Reflect.set(r.findings[0]!, 'alternatives', 'not an array');
    },
  ]) {
    const altered = structuredClone(report);
    change(altered);
    const { reportSha256: _prior, ...body } = altered;
    altered.reportSha256 = await productionDigest(body);
    assert.equal(await verifyForensicReport(altered, bytes), false);
  }
});
