// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { makeColorApi } from '../engine/src/color-tools.ts';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { addColourway, liftToColourways } from '../engine/src/colourway.ts';
import { parseUrlState, serializeUrlState } from '../engine/src/url-mode.ts';
import { tokenBindingsOf } from '../engine/src/inputs.ts';
import { analyseIsolation } from '../scripts/tool-isolation.ts';
import { baseHost } from './helpers/host.ts';

const ids = ['brief', 'scorecard', 'email', 'week', 'quote', 'pricing-table', 'battlecards',
  'link-card', 'stationery', 'wayfinding-signage', 'calendar-ics', 'logo-wall', 'doc-studio', 'multi-page-pdf'];
const fetchTool = (path: string) => readFile(new URL('../community/' + path, import.meta.url), 'utf8');
const start = JSON.parse(await readFile(new URL('../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url), 'utf8'));
const lifted = liftToColourways(start, { id: 'main', name: 'Main' });
assert.ok(lifted.ok);
const added = addColourway(lifted.doc, { id: 'plum', name: 'Plum', values: {
  light: { primary: '#701a75', 'on-primary': '#ffffff', secondary: '#a21caf' },
  dark: { primary: '#e879f9', 'on-primary': '#111111', secondary: '#f0abfc' },
} });
assert.ok(added.ok);
const doc = added.doc;

function host() {
  return baseHost({
    color: makeColorApi(),
    assets: { get: async () => null, query: async () => [] },
    tokens: {
      get: async (opts = {}) => createTokenSet(doc, opts),
      resolve: async (path: string, opts = {}) => createTokenSet(doc, opts).resolve(path),
      snapshot: async () => ({ document: doc, system: null, version: null, selection: { choices: {} } }),
    },
  });
}

for (const id of ids) {
  const tool = await loadTool(id, fetchTool);
  test(`${id}: treatments follow colourways and modes without breaking linked inputs`, async () => {
    const rt = await createRuntime(tool, host(), { transparentBg: false });
    try {
      const links = tokenBindingsOf(rt.getModel());
      const colour = (key: string) => rt.getHydratedString('{{' + key + '}}');
      // Logo Wall renders a native SVG and publishes its palette through the drawn rect.
      const fill = () => id === 'logo-wall'
        ? new JSDOM(rt.getHydrated() as string).window.document.querySelector('svg > rect')?.getAttribute('fill')
        : id === 'doc-studio' || id === 'multi-page-pdf'
          ? rt.getHydratedString('{{docStyle}}')
          : colour('surfaceGround');
      const first = fill();
      await rt.setTokenSelection({ colourway: 'plum', '': 'light' });
      assert.deepEqual(rt.hookErrors, []);
      assert.notEqual(fill(), first, 'a colourway changes the artwork');
      const plum = fill();
      await rt.setTokenSelection({ colourway: 'plum', '': 'dark' });
      assert.deepEqual(rt.hookErrors, []);
      assert.notEqual(fill(), plum, 'the selected dark mode reaches the artwork');
      for (const ground of ['tint', 'lead', 'ink', 'surface']) {
        await rt.setInput('ground', ground);
        assert.deepEqual(rt.hookErrors, []);
        const html = rt.getHydrated() as string;
        assert.ok(!html.includes('{color.semantic.'), 'no unresolved token appears in the artwork');
        if (!['logo-wall', 'doc-studio', 'multi-page-pdf'].includes(id)) {
          const contrast = makeColorApi().contrast(colour('surfaceInk'), colour('surfacePaper'));
          assert.ok(contrast >= 4.5, `${ground}: body contrast ${contrast}`);
          assert.ok(makeColorApi().contrast(colour('surfaceOnAccent'), colour('surfaceAccent')) >= 4.5);
        }
      }
      const state = parseUrlState(serializeUrlState(rt.getModel()), tool.manifest);
      assert.equal(state.values.ground, 'surface');
      assert.deepEqual(tokenBindingsOf(rt.getModel()), links);
    } finally { rt.destroy(); }
  });
}

test('shared hooks remain usable in an isolated executor and without token or colour APIs', async () => {
  for (const id of ids) {
    const tool = await loadTool(id, fetchTool);
    if (tool.manifest.isolate) assert.ok(analyseIsolation(tool.hooksSource!).clean, id);
    const rt = await createRuntime(tool, baseHost({ assets: { get: async () => null, query: async () => [] } }));
    assert.deepEqual(rt.hookErrors, [], id);
    assert.ok((rt.getHydrated() as string).length > 100, id);
    rt.destroy();
  }
});

test('surface treatment keeps explicit colours and transparent exports', async () => {
  const tool = await loadTool('brief', fetchTool);
  const rt = await createRuntime(tool, host(), { ground: 'surface', background: '#123456', ink: '#ffffff', accent: '#ffff00' });
  assert.equal(rt.getHydratedString('{{surfacePaper}}'), '#123456');
  assert.equal(rt.getHydratedString('{{surfaceInk}}'), '#ffffff');
  await rt.setInput('ground', 'lead');
  assert.equal(rt.getHydratedString('{{surfacePaper}}'), '#ffff00');
  assert.ok(makeColorApi().contrast(rt.getHydratedString('{{surfaceInk}}'), '#ffff00') >= 4.5);
  rt.destroy();
  const card = await loadTool('link-card', fetchTool);
  const transparent = await createRuntime(card, host(), { ground: 'lead', transparentBg: true });
  assert.equal(transparent.getHydratedString('{{surfaceGround}}'), 'transparent');
  assert.equal(transparent.getHydratedString('{{surfacePaper}}'), createTokenSet(doc).resolve('{color.semantic.primary}'));
  transparent.destroy();
});

test('motion reads the design system durations and curves, including a zero duration', async () => {
  const tool = await loadTool('scorecard', fetchTool);
  let ms = 0;
  const rt = await createRuntime(tool, baseHost({ tokens: { resolve: async (path: string) => ({
    '{motion.duration.long}': { value: ms, unit: 'ms' },
    '{motion.curve.emphasised}': [0.3, 0.8, 0.2, 1],
  })[path] } }));
  assert.equal(rt.getHydratedString('{{surfaceEnterSeconds}}'), '0');
  assert.equal(rt.getHydratedString('{{surfaceCurve}}'), '0.3,0.8,0.2,1');
  ms = 1250;
  await rt.setInput('motion', 'rise');
  assert.equal(rt.getHydratedString('{{surfaceEnterSeconds}}'), '1.25');
  rt.destroy();
});
