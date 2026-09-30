// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { createTokenSet, TOKEN_EXT } from '@lolly/engine';
import { extractSavedPage } from './sources/saved-page.ts';
import { referenceLook, referenceReport } from './reference-look.ts';

const input = [{ name: 'brand.css', text: 'body{background:#fafafa;color:#102030;font-family:Secret Font}button{background:#ee5533}a{color:#2078cc}' }];
const evidence = { method: 'files', label: 'Example' } as const;

test('reference proposal reuses token colours, preserves font inheritance and does not mutate observations', async () => {
  const { census } = await extractSavedPage(input);
  const before = structuredClone(census);
  const look = referenceLook(census, 'Example', evidence);
  assert.deepEqual(census, before);
  assert.equal(look.roles.primary, '#EE5533', 'a tied neutral fill leaves the saturated accent available');
  const tokens = createTokenSet(look.doc, { theme: look.roles.surfaceLook });
  assert.equal(tokens.query({ type: 'fontFamily' }).length, 0);
  assert.equal(tokens.colors().find(c => c.path === 'color.semantic.primary')?.value, look.preview.primary);
  assert.ok(Number.isFinite(look.contrast.text) && look.contrast.text >= 4.5);
  assert.ok(Number.isFinite(look.contrast.action) && look.contrast.action >= 4.5);
  const changed = referenceLook(census, 'Example', evidence, '#2078cc');
  assert.notEqual(changed.preview.primary, look.preview.primary);
  assert.notDeepEqual(changed.doc, look.doc);
  assert.throws(() => referenceLook(census, 'Example', evidence, '#dead00'), /Choose/);
});

test('context is reproducible and carries observations separately from generated tokens', async () => {
  const { census, sha256 } = await extractSavedPage(input);
  const report = referenceReport(census, 'Example', { ...evidence, sha256 });
  assert.deepEqual(report, referenceReport(census, 'Example', { ...evidence, sha256 }));
  assert.equal(report.observations.fonts[0]?.family, 'Secret Font');
  assert.equal(report.source.sha256, sha256);
  const extensions = report.proposedTokens!.$extensions as Record<string, { reference: { sha256: string } }>;
  assert.equal(extensions[TOKEN_EXT]!.reference.sha256, sha256);
  assert.ok(!JSON.stringify(report).includes(input[0]!.text));
  assert.ok(report.coverage.notAssessed.includes('subjective quality'));
});

test('font-only input yields observations without inventing a palette', async () => {
  const { census } = await extractSavedPage([{ name: 'type.css', text: 'h1{font-family:Example}' }]);
  const report = referenceReport(census, 'Type', evidence);
  assert.equal(report.proposedTokens, null);
  assert.equal(report.checks, null);
  assert.equal(report.observations.fonts.length, 1);
});

test('light and dark previews resolve the selected mode without rewriting the source or proposal', async () => {
  const { census } = await extractSavedPage(input);
  const light = referenceLook(census, 'Example', evidence, '#2078cc', 'light');
  const dark = referenceLook(census, 'Example', evidence, '#2078cc', 'dark');
  assert.deepEqual(light.doc, dark.doc);
  assert.notEqual(light.preview.surface, dark.preview.surface);
  for (const [mode, look] of [['light', light], ['dark', dark]] as const) {
    assert.equal(createTokenSet(look.doc, { theme: mode }).colors().find(c => c.path === 'color.semantic.surface')?.value, look.preview.surface);
    assert.ok(look.contrast.text >= 4.5);
  }
});
