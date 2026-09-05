// SPDX-License-Identifier: MPL-2.0
/**
 * Chrome-token codegen drift gate (plans/172 P4).
 *
 * shells/web/design/chrome-tokens.json is the DTCG source of truth for the
 * non-colour chrome axes; scripts/gen-chrome-tokens.ts emits the marked block
 * in shells/web/src/styles/tokens.css. Two failure modes, both silent without
 * this file: a JSON edit without a regeneration (the app keeps yesterday's
 * values while Penpot shows today's), and a hand-edit inside the markers (the
 * next regeneration erases it). Same pattern as the api/ bundle gate: rebuild,
 * diff, fail on mismatch.
 *
 * Run directly:  node --test tests/chrome-tokens.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

import {
  emitBlock, emitSemanticBlock, lollyUiTokens, regenerate, regenerateUiSemantics,
  TOKENS_JSON, TOKENS_CSS, MARK_START, MARK_END, UI_MARK_START, UI_MARK_END,
  UI_SEMANTICS_JSON,
} from '../scripts/gen-chrome-tokens.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const doc = JSON.parse(readFileSync(TOKENS_JSON, 'utf8'));
const semantics = JSON.parse(readFileSync(UI_SEMANTICS_JSON, 'utf8'));
const css = readFileSync(TOKENS_CSS, 'utf8');

test('chrome-tokens.json is a structurally valid DTCG document', () => {
  const schema = JSON.parse(readFileSync(resolve(repoRoot, 'schemas/tokens.schema.json'), 'utf8'));
  const ajv = new Ajv({ strict: false });
  const validate = ajv.compile(schema);
  assert.ok(validate(doc), `schema violations: ${JSON.stringify(validate.errors, null, 2)}`);
});

test('tokens.css carries exactly the block the JSON generates (no drift either way)', () => {
  assert.equal(regenerate(css, doc), css,
    'the @generated-chrome-tokens block differs from what chrome-tokens.json generates - ' +
    'run `npm run gen:chrome-tokens` (JSON edited) or move your hand-edit into the JSON (block edited)');
});

test('tokens.css carries exactly the semantic alias block (no drift either way)', () => {
  assert.equal(regenerateUiSemantics(css, semantics), css,
    'the @generated-ui-semantics block differs from ui-semantics.json - run npm run gen:chrome-tokens');
});

test('the markers exist once each, in order', () => {
  assert.equal(css.split(MARK_START).length - 1, 1, 'exactly one start marker');
  assert.equal(css.split(MARK_END).length - 1, 1, 'exactly one end marker');
  assert.ok(css.indexOf(MARK_START) < css.indexOf(MARK_END));
  assert.equal(css.split(UI_MARK_START).length - 1, 1, 'exactly one UI start marker');
  assert.equal(css.split(UI_MARK_END).length - 1, 1, 'exactly one UI end marker');
  assert.ok(css.indexOf(UI_MARK_START) < css.indexOf(UI_MARK_END));
});

test('the canonical Lolly UI document is valid DTCG and keeps semantic references', () => {
  const schema = JSON.parse(readFileSync(resolve(repoRoot, 'schemas/tokens.schema.json'), 'utf8'));
  const ajv = new Ajv({ strict: false });
  const canonical = lollyUiTokens(doc, semantics);
  assert.ok(ajv.compile(schema)(canonical), 'canonical Lolly UI document must be valid DTCG');
  assert.equal((canonical as any).lolly.ui.radius.control.$value, '{lolly.foundation.radius.sm}');
  assert.equal((canonical as any).lolly.ui.radius.choice.$value, '{lolly.foundation.radius.xs}');
  assert.equal((canonical as any).lolly.ui.color.surface.overlay.$value, '#ffffff');
  assert.equal((canonical as any).lolly.ui.color.selection.surface.$value, '#0c322c1f');
  assert.equal((canonical as any).lolly.ui.elevation.overlay.$value, '{lolly.foundation.elevation.5}');
  const block = emitSemanticBlock(semantics);
  assert.match(block, /--ui-radius-control: var\(--radius-sm\)/);
  assert.match(block, /--ui-color-selection-surface: hsl\(var\(--primary\) \/ .12\)/);
  assert.match(block, /--ui-edge-default: var\(--edge\)/);
  assert.match(block, /--ui-effect-bevel: var\(--bevel\)/);
  assert.match(block, /--ui-effect-focus-halo: var\(--ring-focus\)/);
});

test('every emitted token the migration relies on is present', () => {
  const block = emitBlock(doc);
  for (const name of [
    '--font-brand', '--font-mono',
    '--edge', '--edge-faint', '--edge-strong',
    '--shadow-1', '--shadow-2', '--shadow-3', '--shadow-4', '--shadow-5',
    '--bevel', '--ring-focus', '--ring-focus-strong',
    '--radius-xs', '--radius-sm', '--radius-md', '--radius-lg', '--radius-pill', '--radius-round',
    '--fs-2xs', '--fs-xs', '--fs-sm', '--fs-md', '--fs-lg', '--fs-xl',
    '--sp-1', '--sp-2', '--sp-3', '--sp-4', '--sp-5', '--sp-6', '--sp-7', '--sp-8',
    '--dur-1', '--dur-2', '--dur-3', '--ease-out', '--ease-spring',
    '--z-chrome', '--z-overlay', '--z-toast', '--z-max',
  ]) {
    assert.ok(block.includes(`${name}: `), `generated block is missing ${name} - call sites migrated to it (plans/172 P2) would fall back to nothing`);
  }
});

test('the radius scale is derived from the one brand shape source, including zero', () => {
  const block = emitBlock(doc);
  assert.match(block, /--radius-xs: calc\(var\(--radius\) \* \.25\);/);
  assert.match(block, /--radius-sm: calc\(var\(--radius\) \* \.5\);/);
  assert.match(block, /--radius-md: calc\(var\(--radius\) \* \.75\);/);
  assert.match(block, /--radius-lg: var\(--radius\);/);
  // Crucially this cannot stay `999px`: when shape.radius is 0, pills and
  // circles must collapse to straight corners with every other component.
  assert.match(block, /--radius-pill: calc\(var\(--radius\) \* 999\);/);
  assert.match(block, /--radius-round: calc\(var\(--radius\) \* 999\);/);
});

test('the spacing scale is derived from one brand rhythm source', () => {
  const block = emitBlock(doc);
  assert.match(block, /--sp-1: calc\(var\(--space\) \* \.25\);/);
  assert.match(block, /--sp-4: var\(--space\);/);
  assert.match(block, /--sp-8: calc\(var\(--space\) \* 3\);/);
});

test('the a11y multiplier rides every type-scale token, and only inside the declaration', () => {
  // The largeText contract (a11y-prefs-contract.test.ts): the multiplier is
  // scaled ONCE, at token declaration. The generator must therefore wrap every
  // fs.* dimension - a bare px emission would silently drop largeText for every
  // call site migrated from calc(Npx * var(--a11y-fs)) to var(--fs-*).
  const block = emitBlock(doc);
  for (const m of block.matchAll(/--fs-[\w-]+: (.+);/g)) {
    assert.match(m[1]!, /^calc\(\d+(?:\.\d+)?px \* var\(--a11y-fs\)\)$/,
      `${m[0]}: fs tokens must be calc(<px> * var(--a11y-fs))`);
  }
});
