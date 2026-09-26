// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ALL_FIGURES, figureInputs, figureRoute, figureSlug, figureVariants, sourceInput } from '../scripts/build-spec-diagrams.ts';
import { artBindingState, stripArtManifest } from '../scripts/sign-docs-art.ts';
import { diagramRecipes } from '../docs/diagram-recipes.ts';

test('every published diagram opens with its source and styling, bound into its signed file', async () => {
  const recipes = diagramRecipes();
  assert.equal(Object.keys(recipes).length, ALL_FIGURES.length);
  for (const fig of ALL_FIGURES) {
    const slug = figureSlug(fig);
    const route = recipes[slug]?.route;
    assert.equal(route, figureRoute(fig), fig.name);
    const query = new URLSearchParams(route!.split('?')[1]);
    assert.deepEqual(Object.fromEntries(query), figureInputs(fig), fig.name);
    assert.equal(query.get('source'), fig.lang);
    assert.equal(query.get('arrowHead'), 'open');
    assert.ok(query.get(sourceInput(fig))!.length > 30, `${fig.name}: source is present`);
    const bytes = readFileSync(new URL(`../docs/${slug}.svg`, import.meta.url));
    assert.equal((await artBindingState(bytes)).bound, true, `${fig.name}: binding and signature validate`);
    const artwork = stripArtManifest(bytes.toString(), 'svg');
    const stored = /<lolly:recipe\b[^>]*>(.*?)<\/lolly:recipe>/.exec(artwork)?.[1];
    assert.equal(stored?.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'), route, fig.name);
  }
});

test('a dark twin is its own signed file, rendered from the same source in the dark theme', async () => {
  const twins = ALL_FIGURES.filter(fig => figureVariants(fig).includes('dark'));
  assert.ok(twins.length > 0, 'at least one set renders dark twins');
  for (const fig of twins) {
    const route = figureRoute(fig, 'dark');
    const query = new URLSearchParams(route.split('?')[1]);
    assert.equal(query.get('colourMode'), 'dark', fig.name);
    assert.notEqual(route, figureRoute(fig), `${fig.name}: the twin has its own recipe`);
    const bytes = readFileSync(new URL(`../docs/${figureSlug(fig)}.dark.svg`, import.meta.url));
    assert.equal((await artBindingState(bytes)).bound, true, `${fig.name}: the twin's binding and signature validate`);
    const stored = /<lolly:recipe\b[^>]*>(.*?)<\/lolly:recipe>/.exec(stripArtManifest(bytes.toString(), 'svg'))?.[1];
    assert.equal(stored?.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'), route, fig.name);
  }
});

test('editing a published recipe invalidates its file binding', async () => {
  const bytes = readFileSync(new URL('../docs/diagrams/document-model/four-records.svg', import.meta.url));
  const changed = Buffer.from(bytes.toString().replace('title=Four+records', 'title=Five+records'));
  assert.notDeepEqual(changed, bytes);
  assert.equal((await artBindingState(changed)).bound, false);
});
