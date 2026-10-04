// SPDX-License-Identifier: MPL-2.0
/**
 * The Node half of `lolly compose` (plan 291 W6, @lolly-tools/node-shell/design-compose):
 * fitting (a slot that clips is reported; `shrink` steps it down in whole px, never
 * below the smallest size the master sets for its role), the pictures a document names
 * (an inventory picture by its `photo:<sha12>` key, a placeholder nothing supplies
 * noted), and the master ladder with no design system at all. Public lolly-start
 * profile; the text is synthetic.
 */
process.env.LOLLY_PROFILE ??= 'lolly-start';

import assert from 'node:assert/strict';
import test from 'node:test';

import type { ContentInventoryV1 } from '@lolly-tools/core';
import { composeDesign, parseComposeSize, resolveComposeMaster } from '../packages/node-shell/src/design-compose.ts';

const line = (i: number): string => `- Synthetic line ${i} about orders, returns and what customers keep using every week`;

function bodyRow(doc: Record<string, unknown>, id: string): Record<string, unknown> {
  const row = (doc.boxes as Array<Record<string, unknown>>).find((b) => b.id === id);
  assert.ok(row, `no row ${id}`);
  return row;
}

test('parseComposeSize reads WIDTHxHEIGHT and refuses anything else', () => {
  assert.deepEqual(parseComposeSize('1920x1080'), { width: 1920, height: 1080 });
  assert.deepEqual(parseComposeSize(' 1280 × 720 '), { width: 1280, height: 720 });
  for (const bad of ['1920', '0x10', 'wide', '1920x1080x3', '99999x10']) assert.equal(parseComposeSize(bad), null, bad);
});

test('fit report records a clipping slot and leaves its size; shrink steps it down until it fits', async () => {
  const spec = { slides: [{ archetype: 'content', slots: { title: 'A heading', body: Array.from({ length: 17 }, (_, i) => line(i)).join('\n') } }] };
  const reported = await composeDesign(spec, { designSystem: { doc: null, origin: null } });
  const before = reported.report.slides[0]!.fit!.find((f) => f.layerId === 's01.body')!;
  assert.equal(before.overflow, true, 'the body clips at the master size');
  assert.equal(before.shrunk, undefined);
  assert.ok(reported.report.notes.some((n) => n.code === 'compose.fit.overflow' && /compose with fit shrink/.test(n.message)));
  const size = Number(bodyRow(reported.document, 's01.body').fontSize);

  const shrunk = await composeDesign(spec, { designSystem: { doc: null, origin: null }, fit: 'shrink' });
  const after = shrunk.report.slides[0]!.fit!.find((f) => f.layerId === 's01.body')!;
  assert.equal(after.shrunk, true);
  assert.equal(after.overflow, false, 'one step size that fits exists above the floor');
  assert.ok(after.fontSize! < size && Number.isInteger(after.fontSize), `${after.fontSize} is a smaller whole size than ${size}`);
  assert.equal(bodyRow(shrunk.document, 's01.body').fontSize, after.fontSize);
  assert.ok(!shrunk.report.notes.some((n) => n.code === 'compose.fit.overflow'));
});

test('shrink stops at the master\'s smallest size for the role and says what still clips', async () => {
  const spec = { slides: [{ archetype: 'content', slots: { title: 'A heading', body: Array.from({ length: 40 }, (_, i) => line(i)).join('\n') } }] };
  const { report, document } = await composeDesign(spec, { designSystem: { doc: null, origin: null }, fit: 'shrink' });
  const fit = report.slides[0]!.fit!.find((f) => f.layerId === 's01.body')!;
  assert.equal(fit.overflow, true);
  assert.equal(fit.shrunk, true);
  assert.equal(bodyRow(document, 's01.body').fontSize, fit.fontSize);
  assert.ok(report.notes.some((n) => n.code === 'compose.fit.overflow' && n.path === '/slides/0' && /the smallest the master sets for body/.test(n.message)));
});

test('with no design system the ladder ends at the neutral master, and says so', async () => {
  const resolved = await resolveComposeMaster({ designSystem: { doc: null, origin: null } });
  assert.equal(resolved.origin, 'neutral');
  assert.equal(resolved.master.id, 'lolly/slides/neutral');
  assert.ok(resolved.notes.some((n) => n.code === 'compose.master.neutral'));
  const profile = await resolveComposeMaster();
  assert.equal(profile.origin, 'catalog');
});

const SHA = 'ab'.repeat(32);
const INVENTORY: ContentInventoryV1 = {
  version: 'lolly/content-inventory-v1',
  source: { name: 'synthetic.pptx', sha256: 'cd'.repeat(32), bytes: 1, kind: 'pptx', slides: 1, width: 1280, height: 720 },
  media: [{ ref: `user/media/${SHA}`, sha256: SHA, mime: 'image/png', bytes: 68, width: 4, height: 3, file: `/tmp/media/${SHA}.png` }],
  warnings: [],
  slides: [{ number: 1, text: [], tables: [], notes: null, pictures: [], charts: [], objects: [] }],
} as unknown as ContentInventoryV1;

test('the pictures a document names: an inventory picture by its photo key, a placeholder nothing supplies noted', async () => {
  const spec = { slides: [{ archetype: 'visual', slots: { title: 'A picture', visual: `photo:${SHA.slice(0, 12)}` } }, { archetype: 'visual', slots: { title: 'Another', visual: 'photo:cover' } }] };
  const { assets, report } = await composeDesign(spec, { inventory: INVENTORY, designSystem: { doc: null, origin: null } });
  assert.deepEqual(assets, [{ key: `photo:${SHA.slice(0, 12)}`, sha256: SHA, name: `${SHA}.png`, mime: 'image/png', file: `/tmp/media/${SHA}.png` }]);
  assert.ok(report.notes.some((n) => n.code === 'compose.asset.needed' && /--asset=photo:cover=<file>/.test(n.message)));
});

test('a spec that is not one is refused with its code', async () => {
  await assert.rejects(composeDesign({ slides: [] }), (err: Error & { code?: string }) => err.code === 'spec.invalid');
  await assert.rejects(composeDesign('nope'), (err: Error & { code?: string }) => err.code === 'spec.invalid');
  await assert.rejects(composeDesign({ slides: [{ archetype: 'contnet' }] }), (err: Error & { code?: string }) => err.code === 'spec.invalid' && /^\/slides\/0\/archetype/.test(err.message));
  await assert.rejects(composeDesign({ slides: [{ archetype: 'title' }] }, { inventory: { version: 'x' } }), (err: Error & { code?: string }) => err.code === 'inventory.invalid');
});

test('a vector picture the suggestion keys resolves when the package reads the same source deck', async () => {
  // tests/fixtures/rebrand/vector.pptx holds drawings (svgBlip) as well as rasters: the
  // inventory keys each drawing by its own SVG part, so `lolly package --source` must
  // read the deck the same way or the CLI's own next step fails with media.missing.
  const { existsSync, readFileSync } = await import('node:fs');
  const path = new URL('./fixtures/rebrand/vector.pptx', import.meta.url);
  if (!existsSync(path)) return;
  const { suggestCompose } = await import('../packages/node-shell/src/design-compose.ts');
  const { packageDesign } = await import('../packages/node-shell/src/design-lolly.ts');
  const source = { bytes: new Uint8Array(readFileSync(path)), name: 'vector.pptx' };
  const suggested = await suggestCompose({ source, designSystem: { doc: null, origin: null } });
  const svgKeys = suggested.assets.filter((a) => a.mime === 'image/svg+xml').map((a) => a.key);
  assert.ok(svgKeys.length > 0, 'the fixture keys at least one drawing by its SVG');
  const composed = await composeDesign(suggested.spec, { source, designSystem: { doc: null, origin: null } });
  assert.ok(!composed.report.notes.some((n) => n.code === 'compose.asset.needed'), 'compose finds every picture it names');
  const packaged = await packageDesign(composed.document, { source: { bytes: new Uint8Array(readFileSync(path)), name: 'vector.pptx' } });
  assert.ok(packaged.bytes.length > 0);
  assert.ok(!packaged.report.warnings.some((w) => w.code === 'media.missing'), 'no picture is left without bytes');
});

test('a measuring budget leaves the slots past it unmeasured, and shrink spends from the same budget', async () => {
  const body = Array.from({ length: 17 }, (_, i) => line(i)).join('\n');
  const spec = { slides: [{ archetype: 'content', slots: { title: 'A heading', body } }, { archetype: 'content', slots: { title: 'Second heading', body: 'A short body' } }] };
  const none = { designSystem: { doc: null, origin: null } } as const;
  const open = await composeDesign(spec, none);
  assert.deepEqual(open.unmeasured, [], 'with no budget every slot is measured');

  // Room for the first slide's two slots and nothing more.
  const room = 'A heading'.length + body.length;
  const capped = await composeDesign(spec, { ...none, maxUnits: room });
  assert.deepEqual([...capped.unmeasured].sort(), ['s02.body', 's02.title']);
  assert.equal(capped.report.slides[1]!.fit, undefined, 'a slot past the budget has no fit entry');
  assert.ok(capped.report.notes.some((n) => n.code === 'compose.fit.unmeasured' && new RegExp(`measuring budget of ${room} characters`).test(n.message)));

  // Shrink measures again for every step, from the same budget: none is left here, so the
  // clipping body keeps its size and the note says why.
  const shrunk = await composeDesign(spec, { ...none, maxUnits: room, fit: 'shrink' });
  const fit = shrunk.report.slides[0]!.fit!.find((f) => f.layerId === 's01.body')!;
  assert.equal(fit.overflow, true);
  assert.equal(fit.shrunk, undefined);
  assert.equal(bodyRow(shrunk.document, 's01.body').fontSize, bodyRow(open.document, 's01.body').fontSize);
  assert.ok(shrunk.report.notes.some((n) => n.code === 'compose.fit.overflow' && /measuring budget/.test(n.message)));
});
