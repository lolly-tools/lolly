// SPDX-License-Identifier: MPL-2.0
/**
 * The render family of `checkFile` in a document made for more than one theme (plan
 * 291 M4): with `themes`, the page is opened once per theme, in that theme, and each
 * render finding says which theme it was painted in; an uploaded picture that carries
 * a photo look (`user/media/<sha256>?treatment=<look>`) counts as carried when the
 * file holds its bytes.
 *
 * The page hook is a stub, as in tests/check-file.test.ts, so no web shell is needed.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/check-render-themes.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strToU8, zipSync } from 'fflate';

import { checkFile, type CheckFileOptionsV1, type CheckRenderAnswerV1, type CheckRenderSessionV1 } from '../packages/node-shell/src/check.ts';
import { readToolManifest } from '../packages/node-shell/src/content-roots.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TRAP = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/check/trap.boxes.json'), 'utf8')) as Record<string, unknown>[];
const TOKENS = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/design-brief/tokens.json'), 'utf8')) as Record<string, unknown>;
const THEMED = { ...structuredClone(TOKENS), $themes: [{ name: 'light' }, { name: 'dark' }] };
const DESIGN_MANIFEST = readToolManifest('design', undefined);

/** The page's answer: one clipped-text finding on the trap's overflow layer. */
function answer(): CheckRenderAnswerV1 {
  const index = TRAP.findIndex((r) => r.id === 'overflow');
  return {
    kind: 'answered',
    value: {
      format: 'lolly-design-check-page',
      version: 1,
      toolId: 'design',
      layers: TRAP.length,
      painted: TRAP.length,
      structure: [],
      settled: true,
      mounted: {
        findings: [{ id: 'design.text.overflow', severity: 'warn', path: `/boxes/${index}/text`, evidence: { name: 'An unexpectedly long headline' }, message: 'English fallback', layerId: 'overflow' }],
        checked: { overflow: 11, contrast: 11, fonts: 11 },
        manualContrastReview: 0,
      },
    },
  };
}

const options = (extra: CheckFileOptionsV1): CheckFileOptionsV1 => ({
  designSystem: { doc: THEMED, origin: 'file' },
  designManifest: DESIGN_MANIFEST,
  ...extra,
});

test('with themes, the page is opened in each theme and its findings say which', async () => {
  const sessions: CheckRenderSessionV1[] = [];
  const report = await checkFile(new TextEncoder().encode(JSON.stringify(TRAP)), 'trap.boxes.json', options({
    themes: ['light', 'dark'],
    renderChecks: async (s) => { sessions.push(s); return answer(); },
  }));
  assert.deepEqual(sessions.map((s) => s.tokenSelection), [{ '': 'light' }, { '': 'dark' }]);
  assert.equal(report.families.render.state, 'ran');
  const overflow = report.findings.filter((f) => f.family === 'render' && f.code === 'design.text.overflow');
  assert.deepEqual(overflow.map((f) => f.theme), ['light', 'dark']);
  assert.match(report.families.render.reason ?? '', /In the light theme: .*In the dark theme: /);
});

test('one theme, or none, opens the page once and tags nothing', async () => {
  const sessions: CheckRenderSessionV1[] = [];
  const report = await checkFile(new TextEncoder().encode(JSON.stringify(TRAP)), 'trap.boxes.json', options({
    renderChecks: async (s) => { sessions.push(s); return answer(); },
  }));
  assert.equal(sessions.length, 1);
  assert.ok(report.findings.filter((f) => f.family === 'render').every((f) => f.theme === undefined));
});

test('an upload with a photo look is carried when the file holds its bytes', async () => {
  const hex = 'cd'.repeat(32);
  const boxes = TRAP.map((row) => (row.id === 'photo' ? { ...row, image: { id: `user/media/${hex}?treatment=tone`, source: 'user' } } : row));
  const manifest = { format: 'lolly-share', formatVersion: 1, minReader: 1, kind: 'session', tool: { id: 'design', version: '1' } };
  const bytes = zipSync({
    'manifest.json': strToU8(JSON.stringify(manifest)),
    'session.json': strToU8(JSON.stringify({ boxes, __toolId: 'design' })),
    [`assets/uploads/${hex}.jpg`]: new Uint8Array(2048),
  });
  const report = await checkFile(bytes, 'looked.lolly', options({ renderChecks: async () => answer() }));
  assert.equal(report.families.render.state, 'ran');
  assert.doesNotMatch(report.families.render.reason ?? '', /painted empty/);
});

test('a --file or terminal design system travels to the page the render family checks; the profile\'s does not', async () => {
  const sessions: CheckRenderSessionV1[] = [];
  const report = await checkFile(new TextEncoder().encode(JSON.stringify(TRAP)), 'trap.boxes.json', options({
    renderChecks: async (s) => { sessions.push(s); return answer(); },
  }));
  assert.deepEqual(sessions[0]!.designSystem, THEMED, 'the page resolves links in the system checked against');
  assert.match(report.families.render.reason ?? '', /--file design system/);
  sessions.length = 0;
  await checkFile(new TextEncoder().encode(JSON.stringify(TRAP)), 'trap.boxes.json', {
    ...options({ renderChecks: async (s) => { sessions.push(s); return answer(); } }),
    designSystem: { doc: THEMED, origin: 'terminal' },
  });
  assert.deepEqual(sessions[0]!.designSystem, THEMED);
  sessions.length = 0;
  await checkFile(new TextEncoder().encode(JSON.stringify(TRAP)), 'trap.boxes.json', {
    ...options({ renderChecks: async (s) => { sessions.push(s); return answer(); } }),
    designSystem: { doc: THEMED, origin: 'profile', profile: 'lolly-start' },
  });
  assert.equal(sessions[0]!.designSystem, undefined, 'the page holds the profile system already');
});
