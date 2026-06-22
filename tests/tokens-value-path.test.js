/**
 * Token-backed colour values through the engine value path: URL serialize/parse
 * and template hydration. Confirms a token reference survives a shared link and
 * that the template only ever sees a resolved colour string — while plain colour
 * values are completely unaffected.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUrlState, serializeUrlState } from '../engine/src/url-mode.js';
import { modelToValues, modelForHooks } from '../engine/src/inputs.js';

const MANIFEST = { inputs: [{ id: 'bg', type: 'color' }, { id: 'fg', type: 'color' }] };

test('parseUrlState reads a {token} alias as an unresolved token value', () => {
  const { values } = parseUrlState('bg={color.brand.jungle}&fg=%23123456', MANIFEST);
  assert.deepEqual(values.bg, { ref: '{color.brand.jungle}', _unresolved: true });
  assert.equal(values.fg, '#123456'); // a plain colour is untouched
});

test('serializeUrlState writes a token-backed colour as its reference', () => {
  const model = [
    { id: 'bg', type: 'color', value: { ref: '{color.brand.jungle}', value: '#30ba78' } },
    { id: 'fg', type: 'color', value: '#123456' },
  ];
  const params = new URLSearchParams(serializeUrlState(model));
  assert.equal(params.get('bg'), '{color.brand.jungle}'); // canonical ref, re-resolves at the destination
  assert.equal(params.get('fg'), '#123456');
});

test('modelToValues hydrates a token-backed colour as its cached hex', () => {
  const model = [
    { id: 'bg', type: 'color', value: { ref: '{color.brand.jungle}', value: '#30ba78' } },
    { id: 'fg', type: 'color', value: '#123456' },
    // An AssetRef carries no `ref`, so it must pass through untouched (the template
    // extracts its url via the {{asset}} helper, not as a flat value).
    { id: 'logo', type: 'asset', value: { source: 'library', id: 'suse/logo/primary', url: 'blob:x' } },
  ];
  const v = modelToValues(model);
  assert.equal(v.bg, '#30ba78');           // token → resolved hex string
  assert.equal(v.fg, '#123456');           // plain colour unchanged
  assert.equal(v.logo.id, 'suse/logo/primary'); // asset object preserved
});

test('modelForHooks flattens token-backed colours so hooks never see the {ref,value} object', () => {
  const model = [
    { id: 'roadColor', type: 'color', value: { ref: '{color.brand.jungle}', value: '#30ba78' } },
    { id: 'background', type: 'color', value: '#123456' },
    { id: 'logo', type: 'asset', value: { source: 'library', id: 'suse/logo/primary', url: 'blob:x' } },
  ];
  const hookModel = modelForHooks(model);

  // The shape a hook actually reads: Object.fromEntries(model.map(i => [i.id, i.value])).
  const inputs = Object.fromEntries(hookModel.map(i => [i.id, i.value]));
  assert.equal(inputs.roadColor, '#30ba78'); // token object → plain hex (was throwing on .trim())
  assert.equal(inputs.background, '#123456');
  // The common hook idiom must not throw on a token-backed colour.
  assert.doesNotThrow(() => (inputs.roadColor || '').trim());

  // AssetRefs (no `ref`) and plain values pass through untouched, and the source
  // model is never mutated — its canonical token object survives for persistence.
  assert.equal(inputs.logo.id, 'suse/logo/primary');
  assert.deepEqual(model[0].value, { ref: '{color.brand.jungle}', value: '#30ba78' });
});
