// SPDX-License-Identifier: MPL-2.0
/**
 * A `_themes` choice a tool ignores is reported in the render's warnings, never
 * dropped in silence (plans/319 A4, manifest `tokenAxes`).
 *
 * The browser-free tier reads the runtime's own `ignoredTokenChoices`; the browser
 * tier's runtime lives in the web shell, so the server makes the same decision
 * again from the manifest, the request and the token document. These pin both
 * seams against the public Lolly Start design system lifted to two colourways,
 * the fixture shape tests/colourway.test.ts uses, plus one real render of a tool
 * that declares no `tokenAxes`, which must say nothing.
 *
 * Run with: node --test services/mcp/test/theme-choice-notes.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ignoredThemeNotes, render, themeChoiceNotes } from '../src/render.ts';
import { addColourway, liftToColourways } from '../../../engine/src/colourway.ts';

type Rec = Record<string, unknown>;

function colourwayDoc(): Rec {
  const start = JSON.parse(readFileSync(new URL('../../../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url), 'utf8')) as Rec;
  const lifted = liftToColourways(start, { id: 'main', name: 'Main' });
  assert.ok(lifted.ok);
  const added = addColourway(lifted.doc, { id: 'persimmon', name: 'Persimmon', values: {
    light: { primary: '#c2410c', 'on-primary': '#ffffff', secondary: '#7c2d12' },
    dark: { primary: '#fb923c', 'on-primary': '#111111', secondary: '#fed7aa' },
  } });
  assert.ok(added.ok);
  return added.doc;
}

const RAMP = { name: 'Ramp', tokenAxes: { colourway: 'ignore' as const } };

test('a colourway the tool ignores comes back as one plain note naming the request and what was used', () => {
  const notes = themeChoiceNotes(RAMP, colourwayDoc(), { '': 'dark', colourway: 'persimmon' });
  assert.deepEqual(notes, ['Ramp ignores the colourway, so persimmon was not applied. It renders in main, the canonical option.']);
});

test('nothing is said when the tool ignores nothing, the request names no choice, or asks for the canonical one', () => {
  const doc = colourwayDoc();
  assert.deepEqual(themeChoiceNotes({ name: 'Chart' }, doc, { colourway: 'persimmon' }), [], 'a tool that follows the colourway');
  assert.deepEqual(themeChoiceNotes(RAMP, doc, undefined), []);
  assert.deepEqual(themeChoiceNotes(RAMP, doc, {}), []);
  assert.deepEqual(themeChoiceNotes(RAMP, doc, { colourway: 'main' }), [], 'the canonical colourway is what the tool draws anyway');
  assert.deepEqual(themeChoiceNotes(RAMP, doc, { '': 'dark' }), [], 'the mode the tool still follows');
  assert.deepEqual(themeChoiceNotes(RAMP, null, { colourway: 'persimmon' }), [], 'no design system, no decision');
});

test('the runtime\'s own list reads as the same sentences', () => {
  assert.deepEqual(ignoredThemeNotes(undefined, 'Ramp'), []);
  assert.deepEqual(
    ignoredThemeNotes([{ group: '', kind: 'mode', canonical: 'light', requested: 'dark' }], 'Print'),
    ['Print ignores the mode, so dark was not applied. It renders in light, the canonical option.'],
  );
});

test('a real render of a tool that declares no tokenAxes reports no ignored theme', async () => {
  const result = await render('jump', `heading=${encodeURIComponent('Theme probe')}&_themes=${encodeURIComponent('{"":"dark"}')}`, { format: 'html', noBrowser: true });
  assert.equal(result.tier.startsWith('A'), true);
  assert.deepEqual(result.warnings.filter((w) => w.includes('was not applied')), []);
});
