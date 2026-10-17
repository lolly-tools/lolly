// SPDX-License-Identifier: MPL-2.0
/**
 * IDML and Premiere packages carry their source credits as a readable companion
 * (CREDITS.txt plus credits.json), measured from the delivered bytes. The Lottie
 * package has the same check in design-lottie.test.ts; these two pin the other
 * package routes, so the rights coverage register can name them.
 * Run: node --test tests/rights-package-companion.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { AttributionPlanV1, AttributionReceiptV1 } from '@lolly-tools/core/rights-v1';
import type { AssetRef, HostV1 } from '../packages/core/src/host-v1.ts';
import { exportDesignIdml } from '../engine/src/design-idml.ts';
import { exportDesignPremiere } from '../engine/src/design-premiere.ts';
import { checkCompanionReadback } from '../engine/src/rights-companion.ts';
import { readZip, storeZip } from '../engine/src/zip.ts';

const plan: AttributionPlanV1 = {
  required: [{ work: 'example', required: true, credit: 'Example by Artist, CC BY 4.0', licence: 'CC-BY-4.0', noticeText: 'Original notice' }],
  optional: [], changes: [], channels: ['readable-companion'], humanActions: [], unresolved: [], rulesVersion: '1', profileVersions: {},
};
const host = { assets: { bytes: async () => new Uint8Array([1, 2, 3]) }, log() {} } as unknown as HostV1;
const snapshot = (boxes: object[], receipts: AttributionReceiptV1[]) => ({
  sourceDocument: { toolId: 'design', values: { boxes, projectFps: '30' } },
  rights: { plan, fingerprint: 'test', onReceipt: (receipt: AttributionReceiptV1) => receipts.push(receipt) },
});

/** The same package with CREDITS.txt taken out, as a recipient might do when repacking the archive. */
async function withoutCredits(blob: Blob): Promise<Uint8Array> {
  return storeZip(readZip(new Uint8Array(await blob.arrayBuffer())).filter(entry => entry.name !== 'CREDITS.txt'));
}

test('IDML package credits are measured from the delivered bytes, and a package missing them never confirms', async () => {
  const receipts: AttributionReceiptV1[] = [];
  const blob = await exportDesignIdml(snapshot([{ id: 'box', kind: 'box', x: 0, y: 0, w: 100, h: 50, bg: '#ff0000', opacity: 100 }], receipts), host);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0]!.state, 'readback-confirmed');
  assert.deepEqual(receipts[0]!.observed, ['example']);
  assert.ok(receipts[0]!.checks.every(check => check.ok), JSON.stringify(receipts[0]!.checks));
  const receipt = await checkCompanionReadback(await withoutCredits(blob), plan, 'test');
  assert.equal(receipt.state, 'written');
  assert.deepEqual(receipt.observed, []);
  assert.equal(receipt.remaining[0]?.code, 'attribution.delivery-missing');
});

test('Premiere package credits are measured from the delivered bytes, and a package missing them never confirms', async () => {
  const receipts: AttributionReceiptV1[] = [];
  const video: AssetRef = { source: 'user', id: 'user/video', type: 'video', format: 'mp4', url: 'unused', width: 1920, height: 1080 };
  const blob = await exportDesignPremiere(snapshot([{ id: 'v', kind: 'image', image: video, start: 0, dur: 2, lane: 'seq', mute: true, opacity: 100 }], receipts), host);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0]!.state, 'readback-confirmed');
  assert.deepEqual(receipts[0]!.observed, ['example']);
  assert.ok(receipts[0]!.checks.every(check => check.ok), JSON.stringify(receipts[0]!.checks));
  const receipt = await checkCompanionReadback(await withoutCredits(blob), plan, 'test');
  assert.equal(receipt.state, 'written');
  assert.deepEqual(receipt.observed, []);
  assert.equal(receipt.remaining[0]?.code, 'attribution.delivery-missing');
});
