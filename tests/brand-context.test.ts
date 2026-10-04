// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { brandContext, contextTokens } from '../engine/src/brand-context.ts';
import { checkBrandDesign, applyBrandFix } from '../engine/src/brand-check.ts';
import { summarizeBrandStyles, readBrandStyleEvidence } from '../engine/src/brand-evidence.ts';
import { TOKEN_EXT } from '../engine/src/tokens.ts';
import { extractSite } from '../shells/web/src/lib/design-system/extract-site.ts';
import { scanWebsite } from '../shells/web/src/lib/design-system/sources/website.ts';
import { referenceReport } from '../shells/web/src/lib/design-system/reference-look.ts';
import { brandCheckRows } from '../shells/web/src/views/brand-check-rows.ts';

const doc = {
  color: { red: { $type: 'color', $value: '#CC3322' }, ink: { $type: 'color', $value: '#112233' }, primary: { $type: 'color', $value: '{color.red}' } },
  font: { brand: { $type: 'fontFamily', $value: 'Example Sans' } },
  asset: { logo: { $type: 'string', $value: 'example/logo/primary' } },
};
test('brand context resolves aliases and preserves the portable token document without a quality verdict', () => {
  const context = brandContext(doc, { name: 'Example' });
  assert.equal(context.colors.find(c => c.path === 'color.primary')?.value.toLowerCase(), '#cc3322');
  assert.deepEqual(context.fonts, [{ path: 'font.brand', value: 'Example Sans' }]);
  assert.equal(context.coverage.styles, 'unavailable');
  assert.deepEqual(contextTokens(JSON.parse(JSON.stringify(context))), doc);
  assert.deepEqual(contextTokens({ format: 'lolly-reference', version: 1, proposedTokens: doc }), doc);
  assert.equal('score' in context, false);
  assert.equal(context.source, null);
});
test('style evidence bounds values, removes unknown fields and distinguishes missing evidence', () => {
  const evidence = summarizeBrandStyles('computed', [
    { property: 'font-size', value: '24px' }, { property: 'font-size', value: '24px' },
    { property: 'padding-left', value: '16px' }, { property: 'body-text', value: 'secret' },
    { property: 'font-family', value: 'url(https://example.com/font)' },
    { property: 'font-family', value: '<script>bad</script>' },
    { property: 'gap', value: 'var(--secret)' },
  ], 2);
  assert.deepEqual(evidence.values.find(v => v.property === 'font-size'), { property: 'font-size', value: '24px', count: 2 });
  assert.equal(evidence.values.length, 2);
  assert.ok(evidence.missing.includes('font-family'));
  assert.equal(readBrandStyleEvidence({ ...evidence, mode: 'inferred' }), null);
  assert.equal(summarizeBrandStyles('declared', Array.from({ length: 3000 }, () => ({ property: 'gap', value: '8px' }))).truncated, true);
  assert.ok(!JSON.stringify(evidence).includes('secret'));
});
test('saved declarations and extension measurements share one evidence format without false native measurements', async () => {
  const html = '<style>body{color:#112233;background:#fff;font-family:Example Sans;font-size:18px}button{background:#cc3322;border-radius:12px;gap:8px}</style>';
  const declared = extractSite({ html }).census;
  assert.equal(declared.styles?.mode, 'declared');
  assert.equal(declared.styles?.values.find(v => v.property === 'border-top-left-radius')?.value, '12px');
  const styles = summarizeBrandStyles('computed', [{ property: 'font-size', value: '24px' }], 10);
  const fetchSite = async () => ({ html, cssTexts: [], assets: [], finalUrl: 'https://example.com', styles });
  const extension = await scanWebsite({ kind: 'extension', label: 'extension', fetchSite }, 'https://example.com');
  const native = await scanWebsite({ kind: 'native', label: 'native', fetchSite }, 'https://example.com');
  assert.equal(extension.kind, 'scanned'); assert.equal(native.kind, 'scanned');
  if (extension.kind !== 'scanned' || native.kind !== 'scanned') return;
  assert.deepEqual(extension.census.styles, styles);
  assert.equal(native.census.styles?.mode, 'declared');
  const report = referenceReport(extension.census, 'Example', { method: 'website', label: 'example.com' });
  assert.equal(report.context?.styles?.mode, 'computed');
  assert.equal(report.context?.source?.label, 'example.com');
  assert.ok(!JSON.stringify(report).includes('<style>'));
});
test('brand checks separate custom values from unknown references and offer one guarded change', () => {
  const boxes = [
    { id: 'a', bg: '#ca3020', text: 'Hi', font: 'Other Sans', fg: '{color.ink}', image: 'example/logo/primary' },
    { id: 'b', bg: '{color.missing}', image: 'user/photo' },
    { id: 'c', image: 'example/other/thing' },
    { id: 'locked', bg: '#ca3020', locked: true },
    { id: 'hidden', bg: '#00ff00', hidden: true },
  ];
  const before = structuredClone(boxes);
  const report = checkBrandDesign(boxes, doc);
  const color = report.findings.find(f => f.layerId === 'a' && f.field === 'bg')!;
  assert.equal(color.status, 'review');
  assert.equal(report.findings.find(f => f.layerId === 'b' && f.kind === 'reference')?.status, 'unknown');
  // An upload (`user/...`) is the author's own media: counted, never reviewed as a catalog asset (plan 291).
  assert.ok(!report.findings.some(f => f.layerId === 'b' && f.kind === 'asset'));
  assert.equal(report.uploads, 1);
  // A catalog-style id the design system does not declare is still an asset to review.
  assert.deepEqual(report.findings.filter(f => f.kind === 'asset').map(f => [f.layerId, f.status, f.value]), [['c', 'review', 'example/other/thing']]);
  assert.ok(report.findings.find(f => f.layerId === 'a' && f.kind === 'font')?.fix);
  assert.equal(report.findings.find(f => f.layerId === 'locked')?.fix, undefined);
  assert.ok(!report.findings.some(f => f.layerId === 'hidden'));
  assert.ok(color.fix);
  const next = applyBrandFix(boxes, color.fix)!;
  assert.equal(checkBrandDesign(next, doc).findings.some(f => f.layerId === 'a' && f.field === 'bg'), false);
  assert.deepEqual(boxes, before);
  assert.equal(applyBrandFix([{ ...boxes[0], bg: '#abcdef' }], color.fix), null);
  assert.equal(applyBrandFix([{ ...boxes[0], locked: true }], color.fix), null);
  assert.equal(applyBrandFix([boxes[0], boxes[0]], color.fix), null);
});
test('recorded evidence is revalidated and missing brand rules never become a pass', () => {
  const context = brandContext({ ...doc, $extensions: { [TOKEN_EXT]: { reference: { method: 'files', label: 'Example', sha256: 'not-a-hash', html: 'secret', styles: {} } } } });
  assert.equal(context.source?.sha256, undefined);
  assert.equal(context.styles, null);
  assert.ok(!JSON.stringify(context.source).includes('secret'));
  const report = checkBrandDesign([{ id: 'a', text: 'Hello', font: 'sans', bg: '#123456', image: 'unknown' }], {});
  assert.deepEqual(report.checked, { colors: 0, fonts: 0, assets: 0 });
  assert.ok(report.findings.every(f => f.status === 'unknown'));
});

test('an asynchronous brand fix preserves newer edits and refuses a newer lock', async () => {
  for (const locked of [false, true]) {
    let boxes: Record<string, unknown>[] = [{ id: 'a', bg: '#ca3020', x: 0 }];
    let finish!: () => void;
    const waiting = new Promise<void>(resolve => { finish = resolve; });
    let reads = 0;
    let writes = 0;
    const rows = await brandCheckRows({
      boxes: () => boxes,
      snapshot: async () => {
        if (++reads > 1) await waiting;
        return { document: doc, system: null, version: 'latest', selection: {} };
      },
      write: next => { boxes = next; writes++; },
    });
    const action = rows.find(row => row.action)?.action;
    assert.ok(action);
    const running = action.run();
    boxes = [{ ...boxes[0], x: 120, locked }];
    finish();
    if (locked) await assert.rejects(running, /changed/);
    else await running;
    assert.equal(boxes[0]?.x, 120);
    assert.equal(writes, locked ? 0 : 1);
  }
});

test('a transparent token never wins the nearest-colour search', () => {
  // The SUSE tokens list color.brand.transparent first; its distance to any opaque colour
  // is NaN, which made every layer colour, exact brand values included, a review item
  // suggesting "transparent".
  const withClear = { color: { clear: { $type: 'color', $value: 'transparent' }, ...doc.color } };
  const report = checkBrandDesign([
    { id: 'exact', bg: '#cc3322' },
    { id: 'near', bg: '#cc3323' },
  ], withClear);
  assert.equal(report.findings.some(f => f.layerId === 'exact'), false, 'an exact brand value is on brand');
  const near = report.findings.find(f => f.layerId === 'near');
  assert.equal(near?.suggestion?.toLowerCase(), '#cc3322', 'a near miss is pointed at the brand colour, not at transparent');
});
