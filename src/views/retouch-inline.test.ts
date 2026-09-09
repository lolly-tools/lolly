// SPDX-License-Identifier: MPL-2.0
/**
 * Retouch inline-mode contract (plan 124 WP-E) - source-scan pins, since the
 * mode is DOM-heavy and its behaviour is browser-verified. What must never
 * drift: the provenance stance (a plain edit with the original as ingredient,
 * never ORIGINATING an AI-generated flag but always PROPAGATING the source's),
 * the inline-mode shape (the crop pattern: preview classes, Escape backs out
 * of the mode and never a committing save), and the one-primary-action UX.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const mode = readFileSync(join(here, 'retouch-inline.ts'), 'utf8');
// catalog.ts is an orchestrator plus feature modules under catalog/ (2026-09-09 split)
const catalog = [readFileSync(join(here, 'catalog.ts'), 'utf8'), ...readdirSync(join(here, 'catalog')).filter((n) => n.endsWith('.ts')).sort().map((n) => readFileSync(join(here, 'catalog', n), 'utf8'))].join('\n');

test('provenance: a deterministic edit with the original as ingredient', () => {
  assert.match(mode, /stampDerivedC2pa/, 'the save path stamps a credential');
  assert.match(mode, /'c2pa\.edited'/, 'the action is a plain edit');
  assert.match(mode, /Content-aware fill \(on-device\)/, 'the action names the operation honestly');
  assert.match(mode, /prepareC2paIngredientFromStore/, 'the original rides as an ingredient');
  // The fill itself never ORIGINATES an AI-generated claim - but the SOURCE's
  // flag must ride onto the copy, or retouching a Gen-AI image would launder
  // its disclosure out of the library (2026-08-19 review finding).
  assert.match(mode, /aiGenerated: srcAi/, 'the source flag propagates, no laundering');
  assert.ok(!/aiGenerated:\s*'(partial|full)'/.test(mode), 'the fill never claims AI generation itself');
});

test('the name rule holds: Retouch, and the banned phrase appears nowhere', () => {
  const banned = ['watermark', 'Watermark'];
  for (const w of banned) assert.ok(!mode.includes(w), `"${w}" must not appear in the mode (plan 124 rule)`);
});

test('inline mode, not a window: mounts into the preview, no overlay of its own', () => {
  assert.ok(!/rt-overlay|rt-backdrop|rt-panel|trapFocus/.test(mode),
    'the mode owns no window chrome - the detail modal is the window');
  assert.match(mode, /env\.stage\.appendChild\(work\)/, 'the work mounts into the preview');
  assert.match(mode, /rt-bar-actions/, 'Cancel + the primary live IN the top bar, not down the body');
  assert.match(mode, /role="toolbar"/, 'the tools are a toolbar on top of the stage');
});

test('the catalog drives it like crop: mode classes, Escape consult, close reap', () => {
  assert.match(catalog, /is-retouching/, 'the preview + dialog carry the mode class');
  assert.match(catalog, /if \((?:dt\.)?inlineRetouch\) \{\s*\n\s*if \(e\.key === 'Escape'\)[\s\S]{0,120}busy\(\)/, 'Escape exits the mode only when not busy');
  assert.match(catalog, /inlineRetouch\?\.exit\(\)/, 'the modal close reaps a live session');
  assert.match(catalog, /enterInlineRetouch/, 'the action enters the inline mode');
});

test('one morphing primary action + one-step undo (the easy-flow shape)', () => {
  assert.match(mode, /dataset\.mode = saveMode \? 'save' : 'fill'/, 'the primary button morphs Fill/Save');
  assert.match(mode, /undoState/, 'a fill can be undone');
  assert.match(mode, /touch|pointerdown/, 'painting is pointer-event driven');
});

test('the worker transfer keeps the undo copy intact', () => {
  // runInpaint TRANSFERS its buffers; the fill must hand it a COPY and keep the
  // read ImageData as the undo state, or undo restores a detached buffer.
  assert.match(mode, /new Uint8ClampedArray\(img\.data\)/);
});

test('catalog offers Retouch on static rasters with no capability gate', () => {
  assert.match(catalog, /const canRetouch = zoomable && ref\.type === 'raster' && !ref\.meta\?\.animated/);
  assert.match(catalog, /data-act="retouch"/);
});
