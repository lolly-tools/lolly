// SPDX-License-Identifier: MPL-2.0
/**
 * An MCP render that placed emoji artwork must record the pack's rights (plan 252).
 *
 * The MCP host is the CLI's Node bridge, whose `host.export.render` ignores
 * `opts.ingredients`, so the stamp at the end of `render` is the only place a
 * source ingredient can be written. This pins that seam: what `renderTierA`
 * hands back reaches the credential as one `componentOf` ingredient with the
 * pack's own licence, rather than being dropped on the floor.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Resvg } from '@resvg/resvg-js';
import { render, rightsResult, stampC2pa } from '../src/render.ts';
import { evaluateCreativeUses } from '../../../engine/src/rights-evaluate.ts';
import type { CreativeWorkRecordV1, RightsEvaluationV1 } from '../../../packages/core/src/rights-v1.ts';
import type { ToolManifest } from '../../../engine/src/loader.ts';
import type { C2paSourceIngredient } from '../../../engine/src/c2pa.ts';
import { verifyC2pa } from '../../../engine/src/c2pa-verify.ts';

const manifest = {
  id: 'emoji-mcp-stamp', name: 'Emoji stamp', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
  render: { width: 32, height: 32, formats: ['png'] },
  inputs: [],
} as unknown as ToolManifest;

/** A real PNG container, because the credential is embedded into one. */
function png(): Uint8Array {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#123456"/></svg>';
  return new Uint8Array(new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng());
}

/** One glyph's artwork, shaped exactly as `emojiSourceIngredients` writes it. */
const grinning: C2paSourceIngredient = {
  credential: 'none',
  title: 'grinning face (Twemoji Color 17.0.3)',
  format: 'image/svg+xml',
  relationship: 'componentOf',
  url: 'https://raw.githubusercontent.com/jdecked/twemoji/v17.0.3/assets/svg/1f600.svg',
  // url and hash travel together or not at all: the pair is what binds the
  // credential to the exact upstream bytes.
  hash: new Uint8Array(32).fill(7),
  rights: {
    creator: 'Twemoji', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Twemoji by Twitter, licensed CC BY 4.0',
    sourceUrl: 'https://raw.githubusercontent.com/jdecked/twemoji/v17.0.3/assets/svg/1f600.svg',
    modifications: [],
    sourceHash: `sha256:${'07'.repeat(32)}`,
    usedHash: `sha256:${'1a'.repeat(32)}`,
  },
};

test('an MCP stamp records the emoji artwork a render placed', async () => {
  const opts = { c2pa: { on: true, days: null } };
  const stamped = await stampC2pa(png(), 'png', manifest, {}, opts, [grinning]);
  const report = await verifyC2pa(stamped);

  assert.equal(report.state, 'valid');
  assert.equal(report.ingredients?.length, 1, 'the placed artwork is recorded');
  const record = report.ingredients![0]!;
  assert.equal(record.relationship, 'componentOf');
  assert.equal(record.credentialed, false, 'recorded by the exporter, not signed by the source');
  assert.match(record.title ?? '', /grinning face/);
  assert.equal(record.rights?.license, 'CC BY 4.0');
});

test('a render that placed nothing records no ingredient', async () => {
  const opts = { c2pa: { on: true, days: null } };
  const stamped = await stampC2pa(png(), 'png', manifest, {}, opts);
  const report = await verifyC2pa(stamped);

  assert.equal(report.state, 'valid');
  assert.equal((report.ingredients ?? []).length, 0, 'no ingredient is invented');
});

/**
 * The rights half of a render result (plan 253): the same evaluation the CLI and
 * the app make, and a `creditsInFile` that is MEASURED from the delivered bytes
 * rather than assumed from the stamp having been attempted.
 */

const SOURCE_URL = 'https://raw.githubusercontent.com/jdecked/twemoji/v17.0.3/assets/svg/1f600.svg';

/** The work the ingredient below records, declared exactly as the pack declares
 *  it: the readback compares the plan's licence against the one the credential
 *  carries, so the two spellings have to be the one spelling. */
const placedWork: CreativeWorkRecordV1 = {
  id: 'community/emoji/twemoji/color/1f600',
  title: 'grinning face (Twemoji Color 17.0.3)',
  creators: [{ name: 'Twemoji', role: 'creator' }],
  sourceUrl: SOURCE_URL,
  sourceHash: `sha256:${'07'.repeat(32)}`,
  rights: [{ declaration: 'CC-BY-4.0', url: 'https://creativecommons.org/licenses/by/4.0/', assertedBy: 'catalog', evidence: 'catalog-entry', status: 'parsed' }],
};

/** The same glyph as `grinning` above, with the pack's canonical declaration. */
const placed: C2paSourceIngredient = {
  ...grinning,
  rights: { ...grinning.rights!, license: 'CC-BY-4.0' },
};

function evaluation(): RightsEvaluationV1 {
  return evaluateCreativeUses({
    works: [placedWork],
    uses: [{ work: placedWork.id, role: 'incorporated', operations: ['placed'] }],
    context: {
      operation: 'render',
      delivery: { format: 'png', route: 'file-with-c2pa', canCarryCredential: true, canCarryReadableCredit: true },
      audience: 'unknown',
    },
  });
}

test('the render result says credits are in the file only after reading them back', async () => {
  const opts = { c2pa: { on: true, days: null } };
  const stamped = await stampC2pa(png(), 'png', manifest, {}, opts, [placed]);
  const result = await rightsResult(evaluation(), stamped);

  assert.equal(result.status, 'ready');
  assert.deepEqual(result.issues, []);
  assert.match(result.credits, /grinning face/);
  assert.match(result.credits, /CC BY 4\.0/);
  assert.equal(result.creditsInFile, true);
  assert.match(result.fingerprint, /^sha256:[0-9a-f]{64}$/);
});

test('a file that records no source never reports its credits as delivered', async () => {
  const opts = { c2pa: { on: true, days: null } };
  const withoutSource = await stampC2pa(png(), 'png', manifest, {}, opts);
  const result = await rightsResult(evaluation(), withoutSource);

  assert.equal(result.creditsInFile, false, 'a credential with no ingredient is not a delivered credit');
  assert.match(result.credits, /grinning face/, 'the credit is still there to deliver another way');

  // And unreadable bytes are not a confirmed delivery either.
  assert.equal((await rightsResult(evaluation(), new Uint8Array([1, 2, 3]))).creditsInFile, false);
});

test('a render with no recorded source carries an empty rights answer, not an invented one', async () => {
  const result = await render('qr-code', 'url=https://example.org', { format: 'svg', c2pa: { on: true, days: null }, noBrowser: true });
  assert.equal(result.tier, 'A');
  assert.ok(result.rights, 'a browser-free render always answers');
  assert.equal(result.rights.status, 'ready');
  assert.equal(result.rights.credits, '');
  assert.equal(result.rights.creditsInFile, false);
  assert.deepEqual(result.rights.issues, []);
});

test('an MCP stamp records a Design page drawn from the operations: its credentialed picture and its route (plan 326)', async () => {
  const { embedC2pa, prepareC2paIngredientFromStore, extractC2paStore } = await import('../../../engine/src/index.ts');
  const signed = await embedC2pa(png(), 'png', { title: 'Source picture', claimGenerator: 'Lolly test' });
  const store = extractC2paStore(signed)!;
  const picture = { ...prepareC2paIngredientFromStore(store.store, store.format)!, relationship: 'componentOf' as const };
  const opts = { c2pa: { on: true, days: null } };
  const stamped = await stampC2pa(png(), 'png', manifest, {}, opts, [], null, { pictures: [picture as never], route: { route: 'operations', renderer: 'design-draw-v0' } });
  const report = await verifyC2pa(stamped);
  assert.equal(report.state, 'valid');
  assert.equal(report.environment?.route, 'operations');
  assert.equal(report.environment?.renderer, 'design-draw-v0');
  assert.ok((report.ingredients ?? []).some((i) => i.relationship === 'componentOf' && i.credentialed), 'the picture\'s own credential is carried');
});
