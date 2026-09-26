// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { FIGURES, figureInputs, figureRoute } from '../scripts/build-spec-diagrams.ts';
import { artBindingState, stripArtManifest } from '../scripts/sign-docs-art.ts';
import { diagramRecipes } from '../docs/diagram-recipes.ts';

test('every published diagram opens with its source and styling, bound into its signed file', async () => {
  const recipes = diagramRecipes();
  assert.equal(Object.keys(recipes).length, FIGURES.length);
  for (const fig of FIGURES) {
    const slug = `diagrams/document-model/${fig.name}`;
    const route = recipes[slug]?.route;
    assert.equal(route, figureRoute(fig), fig.name);
    const query = new URLSearchParams(route!.split('?')[1]);
    assert.deepEqual(Object.fromEntries(query), figureInputs(fig), fig.name);
    assert.equal(query.get('source'), fig.lang);
    assert.equal(query.get('arrowHead'), 'open');
    assert.ok(query.get(fig.lang)!.length > 30, `${fig.name}: source is present`);
    const bytes = readFileSync(new URL(`../docs/${slug}.svg`, import.meta.url));
    assert.equal((await artBindingState(bytes)).bound, true, `${fig.name}: binding and signature validate`);
    const artwork = stripArtManifest(bytes.toString(), 'svg');
    const stored = /<lolly:recipe\b[^>]*>(.*?)<\/lolly:recipe>/.exec(artwork)?.[1];
    assert.equal(stored?.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'), route, fig.name);
  }
});

test('editing a published recipe invalidates its file binding', async () => {
  const bytes = readFileSync(new URL('../docs/diagrams/document-model/four-records.svg', import.meta.url));
  const changed = Buffer.from(bytes.toString().replace('title=Four+records', 'title=Five+records'));
  assert.notDeepEqual(changed, bytes);
  assert.equal((await artBindingState(changed)).bound, false);
});
