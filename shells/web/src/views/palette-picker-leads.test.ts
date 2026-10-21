// SPDX-License-Identifier: MPL-2.0
/**
 * The `palette` colour control (plans/319). A colour input that declares a
 * `palette` renders the shared colour field, not the text box that stood in for
 * it, and `palette: "colourway-leads"` offers the design system's colourway leads
 * through a swatch source the sidebar provides from the document's live choices.
 *
 * A scan, like input-section-fold.test.ts and block-row-id.test.ts, because
 * tool-inputs.ts cannot be imported outside Vite. The control and its wiring live
 * in tool-input-colours.ts, which is imported here for real. The behaviour behind
 * the wiring (the source, its re-read on open, the list built from the family) is
 * exercised in components/color-field.test.ts.
 *
 * Run directly:  node --test shells/web/src/views/palette-picker-leads.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(import.meta.dirname, 'tool-inputs.ts'), 'utf8');
const COLOURS = readFileSync(resolve(import.meta.dirname, 'tool-input-colours.ts'), 'utf8');
const VALIDATOR = readFileSync(resolve(import.meta.dirname, '../../../../scripts/validate-catalog.ts'), 'utf8');

test('a palette colour input renders the colour field, with the leads source for colourway-leads', async () => {
  const branch = SRC.match(/case 'palette-picker':([\s\S]*?)case 'asset-picker'/)?.[1] ?? '';
  assert.ok(branch, 'the control switch has a palette-picker branch');
  assert.doesNotMatch(branch, /stub/, 'the text-box stand-in is gone');
  assert.match(branch, /return paletteFieldHtml\(id, input\);/);
  const { paletteFieldHtml } = await import('./tool-input-colours.ts');
  const { colorFieldHtml, LEADS_SWATCH_SOURCE } = await import('../components/color-field.ts');
  const leads = paletteFieldHtml('accent', { value: '#c2410c', palette: LEADS_SWATCH_SOURCE, swatchesOnly: true });
  assert.equal(leads, colorFieldHtml('accent', '#c2410c', { swatchesOnly: true, swatchSource: LEADS_SWATCH_SOURCE }));
  assert.match(leads, /data-swatch-source="colourway-leads"/);
  assert.equal(paletteFieldHtml('accent', { value: '#c2410c', palette: 'acme/palette/inks' }), colorFieldHtml('accent', '#c2410c', { swatchesOnly: false }),
    'a palette asset id gets the ordinary colour field');
});

test('the palette control is treated as the colour control it now is', () => {
  assert.match(SRC, /\['blocks', 'vector', 'asset-picker', 'file-picker', 'color-picker', 'palette-picker', 'table'\]\.includes\(/,
    'a composite row, so its label never proxies clicks into the popover');
  assert.match(SRC, /input\?\.control === 'color-picker' \|\| input\?\.control === 'palette-picker'\) return;/,
    'and the generic input listener leaves it to the field\'s own wiring');
});

test('the leads source is provided only when a leads field is on the panel, through the runtime\'s live choices', () => {
  assert.match(SRC, /wireToolColourFields\(el, \{ runtime, host, panelModel, liveInput, onDirty, onInteract: \(on\) => \{ _sliderDragging = on; \} \}\);/,
    'renderInputs wires every colour field through the shared module');
  const block = COLOURS.match(/if \(w\.panelModel\.some\(\(i\) => i\.control === 'palette-picker' && i\.palette === LEADS_SWATCH_SOURCE\)\) \{([\s\S]*?)\n {2}\}/)?.[1] ?? '';
  assert.ok(block, 'gated on a leads field being rendered');
  assert.match(block, /liveThemedHost\(w\.host, runtime\)/);
  assert.match(block, /provideSwatchSource\(LEADS_SWATCH_SOURCE, \(\) => colourwayLeadSwatches\(live\.tokens\)\)/);
});

test('the catalog validator accepts colourway-leads where it expects a palette asset id', () => {
  assert.match(VALIDATOR, /input\.type === 'color' && input\.palette && input\.palette !== 'colourway-leads'/);
});
