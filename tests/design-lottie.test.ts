// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMockHost } from '@lolly-tools/core';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { exportDesignLottie } from '../engine/src/design-lottie.ts';
import { readLottie } from '../engine/src/dotlottie.ts';
import { parseUrlState, serializeUrlState } from '../engine/src/url-mode.ts';
import { lottiePackage } from './helpers/lottie-fixtures.ts';
import { buildLollyFile, ingestLollyFile } from '../shells/web/src/lib/lolly-pack.ts';
import type { BeamAssetRecord, BeamPackHost } from '../shells/web/src/lib/beam-pack.ts';
import type { AttributionPlanV1, AttributionReceiptV1 } from '@lolly-tools/core/rights-v1';
import { checkCompanionReadback } from '../engine/src/rights-companion.ts';
import { readZip, storeZip } from '../engine/src/zip.ts';
import { appendLottieEdit, applyLottieEdits, lottieLayers } from '../engine/src/lottie-edit.ts';

const tool = await loadTool('design', path => readFile(new URL(`../community/${path}`, import.meta.url), 'utf8'));
const source = lottiePackage('2');
const ref: AssetRef = { source: 'user', id: 'user/animation', type: 'lottie', format: 'lottie', url: 'memory:animation', width: 64, height: 64 };
function hostForTest() {
  const host = createMockHost();
  host.geom = makeGeomApi();
  host.assets.get = async () => ref;
  host.assets.bytes = async () => source;
  host.export.render = async (_node, format, opts) => {
    assert.equal(format, 'lottie');
    return exportDesignLottie(opts!, host);
  };
  return host;
}
test('actual Design runtime exports edited selection, native shapes and outer keys through the shared compiler', async () => {
  const host = hostForTest();
  const runtime = await createRuntime(tool, host, { background: 'transparent', projectFps: '60', boxes: [
    { id: 'clip', kind: 'image', image: ref, animationId: 'animation-0', x: 0, y: 0, w: 64, h: 64, start: 0.25, dur: 0.75, clipIn: 0.25, speed: 2, kf: 't0_x0_o1*t750_x20_o0', fit: 'contain' },
    { id: 'rect', kind: 'box', x: 0, y: 50, w: 64, h: 10, bg: '#00ff00', start: 0, dur: 1 },
  ] });
  try {
    assert.deepEqual(runtime.hookErrors, []);
    assert.match(runtime.getHydrated(), /data-lottie-animation="animation-0"/);
    const blob = await runtime.export({} as Element, 'lottie', { width: 64, height: 64, c2pa: false });
    assert.equal(blob.type, 'application/zip+dotlottie');
    const animation = readLottie(new Uint8Array(await blob.arrayBuffer())).animations[0]!.animation;
    assert.equal(animation.fr, 60); assert.equal(animation.op, 60);
    assert.equal(animation.layers.length, 2);
    assert.deepEqual(animation.layers.map(layer => [layer.ip, layer.op]), [[0, 60], [15, 60]]);
    assert.equal(animation.layers[0]!.ty, 4);
    // Compact URLs keep the instance choice separately from the source asset id.
    const query = serializeUrlState(runtime.getModel());
    const parsed = parseUrlState(query, tool.manifest);
    assert.equal((parsed.values.boxes as { animationId: string }[])[0]!.animationId, 'animation-0');
    const reopened = await createRuntime(tool, hostForTest(), parsed.values);
    try {
      const again = await reopened.export({} as Element, 'lottie', { width: 64, height: 64, c2pa: false, embedMeta: false });
      assert.equal(readLottie(new Uint8Array(await again.arrayBuffer())).animations[0]!.animation.op, 60);
    } finally { reopened.destroy(); }
  } finally { runtime.destroy(); }
});
test('unsupported visible content fails before a file is created, while hidden content stays hidden', async () => {
  const host = hostForTest();
  const options = { sourceDocument: { toolId: 'design', values: { background: 'transparent', boxes: [{ id: 'words', kind: 'text', text: 'Hello', w: 40, h: 40 }] } } };
  await assert.rejects(exportDesignLottie(options, host), /words: text/);
  options.sourceDocument.values.boxes = [{ ...options.sourceDocument.values.boxes[0]!, hidden: true } as typeof options.sourceDocument.values.boxes[0]];
  const blob = await exportDesignLottie(options, host);
  assert.equal(readLottie(new Uint8Array(await blob.arrayBuffer())).animations[0]!.animation.layers.length, 0);
});

test('portable documents carry one intact multi-animation source and preserve both instance choices on a fresh host', async () => {
  const animationEdits = await appendLottieEdit(readLottie(source).animations[0]!.animation, '', { target: { asset: '', index: 0 }, kind: 'layer', patch: { nm: 'Portable internal edit' } });
  const session = { __toolId: 'design', boxes: [
    { id: 'first', image: ref, animationId: 'animation-0', animationEdits, start: 0, dur: 1, clipIn: 0.2, speed: 1.5 },
    { id: 'second', image: ref, animationId: 'animation-1', start: 0.5, dur: 1 },
  ] };
  const built = await buildLollyFile({ session, toolId: 'design', userAssets: [{ id: ref.id, type: 'lottie', format: 'lottie', blob: new Blob([source as BlobPart], { type: 'application/zip+dotlottie' }), meta: { lottieAnimationId: 'animation-1' } }] });
  const assets = new Map<string, BeamAssetRecord>(), slots = new Map<string, unknown>();
  const host: BeamPackHost = {
    state: { list: async () => [], load: async id => slots.get(id) ?? null, save: async (id, value) => { slots.set(id, value); }, delete: async id => { slots.delete(id); } },
    assets: { _exportUserAssets: async () => [...assets.values()], _uploadUserAsset: async record => { assets.set(record.id, record); }, _getUserRecord: async id => assets.get(id) ?? null, _deleteUserAsset: async id => { assets.delete(id); } },
  };
  const received = await ingestLollyFile(new Uint8Array(await built.blob.arrayBuffer()), host);
  assert.equal(assets.size, 1);
  const asset = [...assets.values()][0]!;
  assert.ok(asset.blob);
  assert.deepEqual(new Uint8Array(await asset.blob.arrayBuffer()), source);
  assert.equal(readLottie(new Uint8Array(await asset.blob.arrayBuffer())).animations.length, 2);
  const resumed = received.session as typeof session;
  assert.deepEqual(resumed.boxes.map(box => box.animationId), ['animation-0', 'animation-1']);
  assert.ok(resumed.boxes.every(box => box.image.id === asset.id));
  assert.equal(resumed.boxes[0]!.speed, 1.5);
  assert.equal(resumed.boxes[0]!.clipIn, 0.2);
  assert.equal((await applyLottieEdits(readLottie(new Uint8Array(await asset.blob.arrayBuffer())).animations[0]!.animation, resumed.boxes[0]!.animationEdits!)).layers[0]!.nm, 'Portable internal edit');
});

test('internal revisions survive the actual runtime, compact URLs and headless export', async () => {
  const animationEdits = await appendLottieEdit(readLottie(source).animations[0]!.animation, '', { target: { asset: '', index: 0 }, kind: 'layer', patch: { nm: 'Instance revision' } });
  const runtime = await createRuntime(tool, hostForTest(), { background: 'transparent', boxes: [
    { id: 'clip', kind: 'image', image: ref, animationId: 'animation-0', animationEdits, x: 0, y: 0, w: 64, h: 64, start: 0, dur: 1, fit: 'contain' },
  ] });
  try {
    assert.match(runtime.getHydrated(), /data-lottie-edits=/);
    const parsed = parseUrlState(serializeUrlState(runtime.getModel(), { keepUserIds: true }), tool.manifest);
    assert.equal((parsed.values.boxes as { animationEdits: string }[])[0]!.animationEdits, animationEdits);
    const reopened = await createRuntime(tool, hostForTest(), parsed.values);
    try {
      const blob = await reopened.export({} as Element, 'lottie', { width: 64, height: 64, c2pa: false });
      const output = readLottie(new Uint8Array(await blob.arrayBuffer())).animations[0]!.animation;
      assert.ok(lottieLayers(output).some(layer => layer.name === 'Instance revision'), JSON.stringify(output));
    } finally { reopened.destroy(); }
  } finally { runtime.destroy(); }
});

test('package credits are measured from delivered bytes and missing credits never confirm delivery', async () => {
  const plan: AttributionPlanV1 = { required: [{ work: 'example', required: true, credit: 'Example by Artist, CC BY 4.0', licence: 'CC-BY-4.0', noticeText: 'Original notice' }], optional: [], changes: [], channels: ['readable-companion'], humanActions: [], unresolved: [], rulesVersion: '1', profileVersions: {} };
  const receipts: AttributionReceiptV1[] = [];
  const blob = await exportDesignLottie({ sourceDocument: { toolId: 'design', values: { background: 'transparent', boxes: [] } }, rights: { plan, fingerprint: 'test', onReceipt: receipt => receipts.push(receipt) } }, hostForTest());
  assert.equal(receipts[0]?.state, 'readback-confirmed');
  assert.deepEqual(receipts[0]?.observed, ['example']);
  assert.ok(receipts[0]?.checks.every(check => check.ok));
  const missing = storeZip(readZip(new Uint8Array(await blob.arrayBuffer())).filter(entry => entry.name !== 'CREDITS.txt'));
  const receipt = await checkCompanionReadback(missing, plan, 'test');
  assert.equal(receipt.state, 'written');
  assert.equal(receipt.remaining[0]?.code, 'attribution.delivery-missing');
});

test('sequence in/out points and an explicit output rate share the movie export timing contract', async () => {
  const blob = await exportDesignLottie({ fps: 50, sourceDocument: { toolId: 'design', values: { projectFps: '24', sequenceMarks: 'v1|i,250|o,750', background: 'transparent', boxes: [{ id: 'shape', kind: 'box', x: 0, y: 0, w: 32, h: 32, bg: '#ff0000', start: 0, dur: 1 }] } } }, hostForTest());
  const animation = readLottie(new Uint8Array(await blob.arrayBuffer())).animations[0]!.animation;
  assert.equal(animation.fr, 50);
  assert.equal(animation.op, 25);
  const inner = animation.assets!.find(asset => Array.isArray(asset.layers) && asset.layers.some(layer => (layer as { tm?: unknown }).tm));
  assert.ok(inner);
});

test('the real CLI forwards an explicit fps override through native dotLottie export', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lolly-lottie-cli-'));
  try {
    const output = join(directory, 'sequence.lottie');
    execFileSync(process.execPath, [fileURLToPath(new URL('../shells/cli/bin/lolly.ts', import.meta.url)), 'design', '--background=transparent', '--projectFps=24', '--fps=50', '--width=64', '--height=64', '--export=lottie', `--output=${output}`, '--boxes=[{"id":"square","kind":"box","x":0,"y":0,"w":64,"h":64,"bg":"#f00","start":0,"dur":1}]'], { env: { ...process.env, LOLLY_PROFILE: 'lolly-start' }, stdio: 'pipe' });
    const animation = readLottie(new Uint8Array(await readFile(output))).animations[0]!.animation;
    assert.deepEqual([animation.w, animation.h, animation.fr, animation.op], [64, 64, 50, 50]);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('independent vector paint is refused before its colours or transforms can be lost', async () => {
  const host = hostForTest();
  await assert.rejects(exportDesignLottie({ sourceDocument: { toolId: 'design', values: { boxes: [
    { id: 'outlined-heading', kind: 'path', x: 0, y: 0, w: 100, h: 40, pathPaint: '{"version":1}', bg: '#000000' },
  ] } } }, host), /outlined-heading: independent vector paint/);
});


test('native vector evaluation retains the detached authored snapshot while token reads are pending', async () => {
  const box = { id: 'frozen', kind: 'box', shape: 'rounded', x: 3, y: 4, w: 20, h: 10, radius: 16, bg: '{color.semantic.primary}', opacity: 60 };
  const host = hostForTest();
  host.tokens = { get: async () => createTokenSet({}), colors: async () => [], themes: async () => [],
    resolve: async () => { box.x = 999; box.radius = 999; box.opacity = 1; return '#ff0000'; } };
  const blob = await exportDesignLottie({ sourceDocument: { toolId: 'design', values: { background: 'transparent', boxes: [box] } } }, host);
  const layer = readLottie(new Uint8Array(await blob.arrayBuffer())).animations[0]!.animation.layers[0]!;
  assert.equal(box.x, 999, 'the external source changed during IO');
  const position = (layer.ks as { p: { x: { k: number }; y: { k: number }; z: { k: number } } }).p;
  assert.deepEqual([position.x.k, position.y.k, position.z.k], [13, 9, 0]);
  assert.equal((layer.ks as { o: { k: number } }).o.k, 60);
  assert.equal(((layer.shapes as { r?: { k: number } }[])[0]!).r!.k, 16);
});
