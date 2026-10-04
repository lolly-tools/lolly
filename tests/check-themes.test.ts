// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly check` per theme (plan 291 W4): linked colours resolve in the theme checked
 * before the brand and Verify families read them, `--themes` checks every theme named
 * in one report with `theme` on each of those findings, and a link that does not
 * resolve in a theme is a warning there.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/check-themes.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { checkFile, CheckInputError } from '../packages/node-shell/src/check.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { normaliseDesignColourRefs } from '../engine/src/token-block-bindings.ts';
import type { InputValue } from '../engine/src/inputs.ts';
import { packageDesign } from '../packages/node-shell/src/design-lolly.ts';
import type { CheckRenderSessionV1 } from '../packages/node-shell/src/check.ts';

const doc = {
  $themes: [
    { name: 'light', selectedTokenSets: { base: 'enabled', light: 'enabled' } },
    { name: 'dark', selectedTokenSets: { base: 'enabled', dark: 'enabled' } },
  ],
  base: { color: { $type: 'color', ramp: { n1: { $value: '#1d1d1d' }, n4: { $value: '#6f6f6f' }, n7: { $value: '#dcdbdc' }, n9: { $value: '#ffffff' } } } },
  // `color.role.quiet` exists in the light set only, so a link to it does not resolve in dark.
  light: { color: { $type: 'color', semantic: { text: { $value: '{color.ramp.n1}' }, surface: { $value: '{color.ramp.n9}' } }, role: { quiet: { $value: '{color.ramp.n4}' } } } },
  dark: { color: { $type: 'color', semantic: { text: { $value: '{color.ramp.n9}' }, surface: { $value: '{color.ramp.n1}' } } } },
};
const rows = normaliseDesignColourRefs([
  { id: 's1', kind: 'frame', name: 'One', x: 0, y: 0, w: 1920, h: 1080, rot: 0, shape: 'rect', bg: '{color.semantic.surface}', clipChildren: true },
  { id: 't1', kind: 'text', frame: 's1', x: 100, y: 100, w: 900, h: 120, rot: 0, text: 'A heading that reads in both themes', fontSize: 64, weight: '500', font: 'sans', fg: '{color.semantic.text}' },
  { id: 't2', kind: 'text', frame: 's1', x: 100, y: 300, w: 900, h: 60, rot: 0, text: 'A caption', fontSize: 28, weight: '400', font: 'sans', fg: '{color.role.quiet}' },
] as InputValue[], ['bg', 'fg', 'stroke'], createTokenSet(doc, {}));
const bytes = new TextEncoder().encode(JSON.stringify({ boxes: rows }));
const base = { designSystem: { doc, origin: 'file' as const }, browser: 'off' as const, textMeasure: false };

test('one report checks every theme named, and each brand and Verify finding says which', async () => {
  const report = await checkFile(bytes, 'themes.json', { ...base, themes: ['light', 'dark'] });
  assert.equal(report.families.brand.state, 'ran');
  assert.match(report.families.brand.reason ?? '', /In the light theme: .* In the dark theme: /);
  const themed = report.findings.filter((f) => f.family === 'brand' || f.family === 'verify');
  for (const f of themed) assert.ok(f.theme === 'light' || f.theme === 'dark', `${f.code} carries its theme`);
  const unresolved = report.findings.filter((f) => f.code === 'brand.token-link.unresolved');
  assert.deepEqual(unresolved.map((f) => [f.theme, f.layerId]), [['dark', 't2']]);
  assert.match(unresolved[0]!.message, /fg \{color\.role\.quiet\}/);
  // `all` is the design system's declared themes.
  const all = await checkFile(bytes, 'themes.json', { ...base, themes: 'all' });
  assert.deepEqual(all.findings.map((f) => [f.code, f.theme]), report.findings.map((f) => [f.code, f.theme]));
});

test('one theme reads that theme\'s colours and leaves findings untagged', async () => {
  const dark = await checkFile(bytes, 'themes.json', { ...base, theme: 'dark' });
  assert.ok(dark.findings.some((f) => f.code === 'brand.token-link.unresolved' && f.theme === undefined));
  const light = await checkFile(bytes, 'themes.json', { ...base, theme: 'light' });
  assert.equal(light.findings.some((f) => f.code === 'brand.token-link.unresolved'), false);
  const single = await checkFile(bytes, 'themes.json', { ...base, themes: ['dark'] });
  assert.deepEqual(single.findings, dark.findings);
});

test('an unknown theme, both options at once, or themes without a design system are refused', async () => {
  await assert.rejects(checkFile(bytes, 'themes.json', { ...base, themes: ['light', 'sepia'] }), (err: Error) => err instanceof CheckInputError && /no theme "sepia"/.test(err.message));
  await assert.rejects(checkFile(bytes, 'themes.json', { ...base, theme: 'dark', themes: ['light'] }), CheckInputError);
  await assert.rejects(checkFile(bytes, 'themes.json', { browser: 'off', themes: ['light', 'dark'] }), CheckInputError);
});

test('an authored reference that does not resolve is a structure finding with its pointer', async () => {
  const authored = new TextEncoder().encode(JSON.stringify({ boxes: [rows[0], { id: 'x', $in: 's1', kind: 'text', text: 'y', fg: '{color.role.none}' }] }));
  const report = await checkFile(authored, 'authored.json', base);
  const invalid = report.findings.find((f) => f.code === 'design.authoring.invalid');
  assert.ok(invalid, JSON.stringify(report.findings.map((f) => f.code)));
  assert.equal(invalid.path, '/boxes/1/fg');
});

test('lolly check --themes runs from the command line and prints each finding\'s theme', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-check-themes-'));
  try {
    writeFileSync(join(dir, 'doc.json'), bytes);
    writeFileSync(join(dir, 'tokens.json'), JSON.stringify(doc));
    const run = (extra: string[]) => spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', 'check', join(dir, 'doc.json'), `--file=${join(dir, 'tokens.json')}`, '--browser=off', ...extra], {
      cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 90_000,
      env: { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: join(dir, 'state'), NO_COLOR: '1' },
    });
    const json = run(['--themes=light,dark', '--json']);
    const report = JSON.parse(json.stdout).result as { findings: Array<{ code: string; theme?: string }> };
    assert.deepEqual(report.findings.filter((f) => f.code === 'brand.token-link.unresolved').map((f) => f.theme), ['dark']);
    const text = run(['--themes=all']);
    assert.match(text.stdout, /brand\.token-link\.unresolved .*\(dark\)/);
    const bad = run(['--themes=light,sepia', '--json']);
    assert.equal(bad.status, 2, bad.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a document saved in a theme is checked in that theme by every family when none is asked for', async () => {
  // Saved dark: `color.role.quiet` only exists in light, so the dark document warns about that link.
  const darkRows = normaliseDesignColourRefs(rows.map((r) => ({ ...(r as Record<string, unknown>), tokenLinks: undefined, bg: (r as Record<string, unknown>).id === 's1' ? '{color.semantic.surface}' : undefined, fg: (r as Record<string, unknown>).id === 't1' ? '{color.semantic.text}' : (r as Record<string, unknown>).id === 't2' ? '#6f6f6f' : undefined })) as InputValue[], ['bg', 'fg', 'stroke'], createTokenSet(doc, { theme: 'dark' }));
  const t2 = darkRows[2] as Record<string, unknown>;
  t2.tokenLinks = JSON.stringify({ fg: { ref: '{color.role.quiet}', value: '#6f6f6f', status: 'linked' } });
  const { bytes: packed } = await packageDesign({ values: { boxes: darkRows, __tokenSelection: { '': 'dark' } } }, { label: 'dark', exportedAt: '2026-10-03T00:00:00.000Z', catalog: null });
  let session: CheckRenderSessionV1 | undefined;
  const renderChecks = async (s: CheckRenderSessionV1) => { session = s; return { kind: 'no-hook' as const, reason: 'stub' }; };
  const saved = await checkFile(packed, 'dark.lolly', { ...base, browser: 'auto', renderChecks });
  const asked = await checkFile(packed, 'dark.lolly', { ...base, theme: 'dark' });
  const codes = (r: typeof saved) => r.findings.filter((f) => f.family === 'brand' || f.family === 'verify').map((f) => `${f.code} ${f.layerId ?? ''}`).sort();
  assert.deepEqual(codes(saved), codes(asked));
  assert.ok(saved.findings.some((f) => f.code === 'brand.token-link.unresolved' && f.layerId === 't2'));
  assert.match(saved.families.structure.reason ?? '', /saved in the dark theme/);
  // The render family opened the page in the same theme.
  assert.deepEqual(session?.tokenSelection, { '': 'dark' });
  // An explicit theme still wins over the saved one.
  const light = await checkFile(packed, 'dark.lolly', { ...base, theme: 'light' });
  assert.equal(light.findings.some((f) => f.code === 'brand.token-link.unresolved'), false);
  // A JSON session with the same saved choice reads the same way.
  const json = new TextEncoder().encode(JSON.stringify({ boxes: darkRows, __tokenSelection: { '': 'dark' } }));
  assert.deepEqual(codes(await checkFile(json, 'dark.json', base)), codes(asked));
});
