// SPDX-License-Identifier: MPL-2.0
//
// Cropping a genAI asset from the catalog must PRESERVE its synthetic-content provenance - 
// both the genAI flag AND the "previous journey inside Lolly" (the action/ingredient chain).
// This is Andy's #1 provenance rule: never destroy genAI credentials on an edit.
//
// The catalog crop re-encodes to a canvas → a FRESH raster with no C2PA, so the only carrier
// of the source's genAI-ness + journey is the ingredient the sign step embeds. The web-shell
// glue (views/catalog.ts: downloadCrop → downloadSigned → sourceIngredients →
// prepareC2paIngredientFromStore → stampDerivedC2pa → embedC2pa) builds that ingredient from
// the source's stored credential and passes it to embedC2pa. This pins the ENGINE half of
// that path - the part that actually round-trips the manifest boxes and source type - with a
// genAI source that carries a multi-step Lolly journey, and a control proving the drop is real
// when the ingredient is omitted.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  embedC2pa, GENERATED_SOURCE_TYPE,
  extractC2paStore, prepareC2paIngredient, prepareC2paIngredientFromStore, collectIngredients,
} from '../engine/src/index.ts';
import { collectActionChain } from '../engine/src/c2pa-extract.ts';

// ── minimal PNG fixture (matches tests/c2pa-formats.test.ts) ──────────────────
const bytesOf = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
const concat = (arrs: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; } return out;
};
const u32be = (n: number): Uint8Array => Uint8Array.of((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b: Uint8Array): number => { let c = 0xffffffff; for (const x of b) c = CRC_T[(c ^ x) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const pngChunk = (type: string, data: Uint8Array): Uint8Array => { const td = concat([bytesOf(type), data]); return concat([u32be(data.length), td, u32be(crc32(td))]); };
function tinyPng(): Uint8Array {
  const ihdr = Uint8Array.of(0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0, 0, 0);
  const idat = Uint8Array.of(0x78, 0x01, 0x01, 0x02, 0x00, 0xfd, 0xff, 0x00, 0x7b, 0x00, 0x7c, 0x00, 0xf8);
  return concat([Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10), pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', new Uint8Array(0))]);
}

const chainOf = (store: Uint8Array): string[] => collectActionChain(store).map((s) => String(s.action));
const chainHasGenAi = (store: Uint8Array): boolean =>
  collectActionChain(store).some((s) => String(s.digitalSourceType ?? '') === GENERATED_SOURCE_TYPE);

// Build a genAI catalog asset that already carries a multi-step Lolly journey:
//   created (trainedAlgorithmicMedia) → opened → color_adjustments
async function makeGenAiAssetWithJourney(): Promise<Uint8Array> {
  const generated = await embedC2pa(tinyPng(), 'png', {
    title: 'AI-generated koala',
    actions: [{ action: 'c2pa.created', digitalSourceType: GENERATED_SOURCE_TYPE }],
  });
  // A prior Lolly edit opens the generated original and recolours it.
  const priorIngredient = prepareC2paIngredient(generated);
  assert.ok(priorIngredient, 'the generated source is itself credentialed');
  return embedC2pa(tinyPng(), 'png', {
    title: 'Recoloured koala',
    actions: [{ action: 'c2pa.color_adjustments' }],
    ingredients: [priorIngredient!],
  });
}

test('catalog crop preserves the genAI flag AND the full Lolly journey', async () => {
  const asset = await makeGenAiAssetWithJourney();
  const srcEx = extractC2paStore(asset);
  assert.ok(srcEx, 'the catalog asset is credentialed');
  const srcChain = chainOf(srcEx!.store);
  assert.ok(chainHasGenAi(srcEx!.store), 'baseline: the asset is genAI-flagged before cropping');
  assert.ok(srcChain.length >= 3, 'baseline: the asset carries a multi-step journey');

  // Exactly what sourceIngredients() builds from the stored credential.
  const cropIngredient = prepareC2paIngredientFromStore(srcEx!.store, srcEx!.format);
  assert.ok(cropIngredient, 'the crop can prepare an ingredient from the source store');
  assert.equal(String(cropIngredient!.digitalSourceType), GENERATED_SOURCE_TYPE,
    'the prepared ingredient keeps the genAI source type');
  assert.ok((cropIngredient!.manifestBoxes?.length ?? 0) >= 1, 'the ingredient carries the source manifest boxes');

  // The crop: a fresh no-metadata raster + a c2pa.cropped action + the source ingredient.
  const cropped = await embedC2pa(tinyPng(), 'png', {
    title: 'Koala (cropped)',
    actions: [{ action: 'c2pa.cropped' }],
    ingredients: [cropIngredient!],
  });

  const outEx = extractC2paStore(cropped);
  assert.ok(outEx, 'the cropped download is still credentialed');
  const outChain = chainOf(outEx!.store);

  // The genAI flag must survive the crop.
  assert.ok(chainHasGenAi(outEx!.store), 'the genAI flag survives the crop (would read as human-made otherwise)');
  // The entire prior journey must survive verbatim as the chain PREFIX (nothing dropped)…
  assert.deepEqual(outChain.slice(0, srcChain.length), srcChain,
    'the prior Lolly journey is preserved verbatim, not overwritten');
  // …with the crop recorded on top (opened the source, then cropped).
  assert.ok(outChain.slice(srcChain.length).includes('c2pa.opened'), 'the crop opens the source as an ingredient');
  assert.equal(outChain.at(-1), 'c2pa.cropped', 'the crop action is recorded last');
  // The source manifests are embedded, not orphaned.
  const outOwn = collectIngredients(cropped)[0];
  assert.ok((outOwn?.manifestBoxes?.length ?? 0) > (cropIngredient!.manifestBoxes?.length ?? 0),
    'the output store embeds the source manifests plus the new crop manifest');
});

test('control: cropping WITHOUT carrying the ingredient loses the genAI flag (the bug this guards)', async () => {
  const asset = await makeGenAiAssetWithJourney();
  assert.ok(chainHasGenAi(extractC2paStore(asset)!.store), 'baseline genAI-flagged');

  // The pre-fix behaviour: a plain re-sign of the cropped raster with NO ingredient.
  const droppedCrop = await embedC2pa(tinyPng(), 'png', {
    title: 'Koala (cropped, no ingredient)',
    actions: [{ action: 'c2pa.created' }],
  });
  const outEx = extractC2paStore(droppedCrop);
  assert.ok(outEx, 'still credentialed');
  assert.ok(!chainHasGenAi(outEx!.store),
    'without the carried ingredient the genAI flag is GONE — proving the ingredient is what preserves it');
});
