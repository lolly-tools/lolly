// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CAMERA_RAW_MAX_INPUT, CameraRawError, cameraRawReportLine, describeCameraRawColour, describeCameraRawError,
  hasCameraRawSignature, isCameraRawName, looksLikeCameraRaw, createCameraRawKernel,
} from '../packages/node-shell/src/camera-raw.ts';
import { loadCameraRawKernel } from '../packages/node-shell/src/camera-raw-node.ts';
import { buildDng } from './camera-raw-fixtures.ts';

const wasmUrl = new URL('../packages/node-shell/wasm/camera-raw/camera-raw.wasm', import.meta.url);
const grey = (v: number) => () => [v, v, v] as [number, number, number];
const near = (got: number, want: number, tolerance: number, what = '') => assert.ok(Math.abs(got - want) <= tolerance, `${what} ${got} is not within ${tolerance} of ${want}`);

test('names and signatures are recognised without decoding', () => {
  for (const n of ['a.dng', 'A.DNG', 'IMG_1.CR2', 'x.cr3', 'a.nef', 'a.nrw', 'a.arw', 'a.sr2', 'a.pef', 'a.orf', 'a.rw2', 'a.raf']) assert.equal(isCameraRawName(n), true, n);
  for (const n of ['a.jpg', 'a.tiff', 'dng', 'a.dng.txt', undefined]) assert.equal(isCameraRawName(n), false, String(n));
  const dng = buildDng({ width: 4, height: 4, scene: grey(0.5) });
  assert.equal(hasCameraRawSignature(dng), true);
  assert.equal(hasCameraRawSignature(new TextEncoder().encode('FUJIFILMCCD-RAW 0201')), true);
  const cr3 = new Uint8Array(16); cr3.set(new TextEncoder().encode('ftypcrx '), 4);
  assert.equal(hasCameraRawSignature(cr3), true);
  assert.equal(hasCameraRawSignature(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), false);
  assert.equal(looksLikeCameraRaw(dng, 'photo.dng'), true);
  assert.equal(looksLikeCameraRaw(dng, 'photo.tif'), false, 'a plain TIFF is not raw by signature alone');
  assert.equal(looksLikeCameraRaw(dng, 'blob', 'image/x-adobe-dng'), true);
});

test('the module has no imports and exposes only the raw ABI', async () => {
  const module = await WebAssembly.compile(new Uint8Array(await readFile(wasmUrl)));
  assert.deepEqual(WebAssembly.Module.imports(module), []);
  const names = WebAssembly.Module.exports(module).map(e => e.name).filter(n => !n.startsWith('__')).sort();
  assert.deepEqual(names, ['camera_raw_alloc', 'camera_raw_free', 'camera_raw_message_len', 'camera_raw_message_ptr', 'camera_raw_meta_len', 'camera_raw_meta_ptr', 'camera_raw_release', 'camera_raw_result_len', 'camera_raw_result_ptr', 'camera_raw_run', 'memory']);
});

test('a DNG develops with its own matrices and reports exact colour and the capture facts', async () => {
  const kernel = await loadCameraRawKernel();
  const file = buildDng({ width: 64, height: 48, scene: grey(0.2), make: 'Lolly Test', model: 'Fixture One', iso: 400, exposureTime: [1, 250], fNumber: [28, 10], baselineExposure: 0 });
  const image = kernel.developLinear(file);
  const m = image.meta;
  assert.equal(image.width, 64); assert.equal(image.height, 48);
  assert.equal(image.linear16!.length, 64 * 48 * 3);
  assert.equal(m.format, 'DNG'); assert.equal(m.make, 'Lolly Test'); assert.equal(m.model, 'Fixture One');
  assert.equal(m.iso, 400); near(m.exposureTime!, 0.004, 1e-9); near(m.fNumber!, 2.8, 1e-9);
  assert.equal(m.color.exact, true); assert.equal(m.color.label, 'exact colour'); assert.equal(m.color.method, 'dng-matrices');
  assert.equal(m.encoding, 'linear-prophoto-16'); assert.equal(m.previewOnly, false); assert.equal(m.cfa, 'RGGB');
  assert.equal(m.whiteBalance?.source, 'as-shot'); assert.deepEqual(m.whiteBalance?.multipliers, [1, 1, 1]);
  assert.equal(m.color.calibrations.length, 1);
  const c = m.color.calibrations[0]!;
  near(c.temperature, 6504, 1, 'illuminant');
  near(c.colorMatrix[0]!, 3.2405, 1e-3); near(c.colorMatrix[4]!, 1.876, 1e-3); assert.equal(c.cameraCalibration.length, 9);
  // A neutral 0.2 patch stays neutral and keeps its linear value (within one code of rounding).
  for (let i = 0; i < image.linear16!.length; i += 3 * 97) {
    for (let k = 0; k < 3; k++) near(image.linear16![i + k]!, 0.2 * 65535, 4, `sample ${i + k}`);
  }
  assert.equal(describeCameraRawColour(m), 'Exact colour from the matrices in the DNG file');
  assert.match(cameraRawReportLine(m), /^DNG from Lolly Test Fixture One\. 64×48\. Exact colour/);
});

test('display output is sRGB 8-bit and the same picture as the linear output', async () => {
  const kernel = await loadCameraRawKernel();
  const file = buildDng({ width: 32, height: 32, scene: grey(0.2) });
  const shown = kernel.developDisplay(file);
  assert.equal(shown.meta.encoding, 'srgb-8-rgba');
  assert.equal(shown.rgba8!.length, 32 * 32 * 4);
  // sRGB encoding of linear 0.2 is 0.4845, or 124 of 255.
  for (let i = 0; i < shown.rgba8!.length; i += 4 * 61) {
    near(shown.rgba8![i]!, 124, 1); near(shown.rgba8![i + 1]!, 124, 1); near(shown.rgba8![i + 2]!, 124, 1); assert.equal(shown.rgba8![i + 3], 255);
  }
});

test('colour passes through the matrices: a red patch is red, a blue patch is blue', async () => {
  const kernel = await loadCameraRawKernel();
  const file = buildDng({ width: 64, height: 32, scene: x => (x < 32 ? [0.7, 0.05, 0.05] : [0.05, 0.05, 0.7]) });
  const shown = kernel.developDisplay(file);
  const at = (x: number, y: number) => [...shown.rgba8!.subarray((y * 64 + x) * 4, (y * 64 + x) * 4 + 3)];
  const left = at(8, 16), right = at(56, 16);
  assert.ok(left[0]! > left[1]! + 80 && left[0]! > left[2]! + 80, `left ${left}`);
  assert.ok(right[2]! > right[0]! + 80 && right[2]! > right[1]! + 80, `right ${right}`);
});

test('an as-shot white balance neutralises a cast and baseline exposure scales the result', async () => {
  const kernel = await loadCameraRawKernel();
  // The scene is warm; the file's AsShotNeutral says so, so the balanced result is neutral.
  const warm = buildDng({ width: 32, height: 32, scene: () => [0.5, 0.4, 0.2], asShotNeutral: [0.5 / 0.5, 0.4 / 0.5, 0.2 / 0.5] });
  const img = kernel.developLinear(warm);
  const px = [...img.linear16!.subarray(0, 3)];
  near(px[0]!, px[1]!, 40, 'r vs g'); near(px[1]!, px[2]!, 40, 'g vs b');
  assert.equal(img.meta.whiteBalance?.source, 'as-shot');
  const base = kernel.developLinear(buildDng({ width: 16, height: 16, scene: grey(0.1) })).linear16![0]!;
  const lifted = kernel.developLinear(buildDng({ width: 16, height: 16, scene: grey(0.1), baselineExposure: 1 }));
  near(lifted.linear16![0]!, base * 2, 8, 'one stop up'); near(lifted.meta.baselineExposure!, 1, 1e-3);
});

test('orientation is applied to the pixels and reported', async () => {
  const kernel = await loadCameraRawKernel();
  // Left half red, right half blue. Orientation 6 turns the picture a quarter clockwise: left becomes top.
  const scene = (x: number): [number, number, number] => (x < 32 ? [0.7, 0.05, 0.05] : [0.05, 0.05, 0.7]);
  const turned = kernel.developDisplay(buildDng({ width: 64, height: 32, scene, orientation: 6 }));
  assert.equal(turned.width, 32); assert.equal(turned.height, 64);
  assert.equal(turned.meta.orientation, 6); assert.equal(turned.meta.orientationApplied, true);
  const at = (y: number) => turned.rgba8!.subarray((y * 32 + 16) * 4, (y * 32 + 16) * 4 + 3);
  assert.ok(at(8)[0]! > at(8)[2]! + 80, 'top is red');
  assert.ok(at(56)[2]! > at(56)[0]! + 80, 'bottom is blue');
  const upright = kernel.developDisplay(buildDng({ width: 64, height: 32, scene, orientation: 1 }));
  assert.equal(upright.width, 64);
});

test('output is deterministic across runs and across fresh instances', async () => {
  const wasm = new Uint8Array(await readFile(wasmUrl));
  const file = buildDng({ width: 48, height: 40, scene: (x, y) => [x / 48, y / 40, 0.3] });
  const a = (await createCameraRawKernel(wasm)).developLinear(file, 'best');
  const b = (await createCameraRawKernel(wasm)).developLinear(file, 'best');
  const k = await createCameraRawKernel(wasm);
  const c = k.developLinear(file, 'best'); const d = k.developLinear(file, 'best');
  assert.deepEqual(a.linear16, b.linear16); assert.deepEqual(c.linear16, d.linear16); assert.deepEqual(a.linear16, c.linear16);
  assert.equal(JSON.stringify(a.meta), JSON.stringify(b.meta));
  // The quality choices differ only in demosaic, not in size or metadata other than the method.
  const fast = k.developLinear(file, 'fast');
  assert.equal(fast.width, a.width); assert.equal(fast.meta.demosaic, 'bilinear'); assert.equal(a.meta.demosaic, 'ahd');
});

test('a file without colour matrices is labelled approximate colour, never exact', async () => {
  const kernel = await loadCameraRawKernel();
  // A TIFF/EP style raw: no DNG tags, so no matrices and no embedded JPEG to fit against.
  const nef = buildDng({ width: 32, height: 32, scene: grey(0.3), dng: false, make: 'NIKON CORPORATION', model: 'NIKON D-TEST' });
  const image = kernel.developDisplay(nef);
  assert.equal(image.meta.format, 'NEF');
  assert.equal(image.meta.color.exact, false); assert.equal(image.meta.color.label, 'approximate colour');
  assert.equal(image.meta.color.method, 'neutral-fallback');
  assert.ok(image.meta.warnings.some(w => /Approximate colour/.test(w)), image.meta.warnings.join(' | '));
  assert.match(describeCameraRawColour(image.meta), /^Approximate colour/);
  assert.match(cameraRawReportLine(image.meta), /Approximate colour/);
});

test('probe reads the format and capture facts without developing', async () => {
  const kernel = await loadCameraRawKernel();
  const meta = kernel.probe(buildDng({ width: 16, height: 16, scene: grey(0.5), make: 'Canon', model: 'EOS Fixture', iso: 1600, exposureTime: [1, 60] }));
  assert.equal(meta.format, 'DNG'); assert.equal(meta.make, 'Canon'); assert.equal(meta.iso, 1600); near(meta.exposureTime!, 1 / 60, 1e-9); assert.equal(meta.encoding, 'none');
  assert.throws(() => kernel.probe(new TextEncoder().encode('just some text in a file')), (e: unknown) => e instanceof CameraRawError && e.code === 'not-raw');
});

test('empty, non-raw and oversized input are refused with a clear message and the kernel stays usable', async () => {
  const kernel = await loadCameraRawKernel();
  assert.throws(() => kernel.developDisplay(new Uint8Array()), (e: unknown) => e instanceof CameraRawError && e.code === 'failed' && /empty/.test(e.message));
  assert.throws(() => kernel.developDisplay(new TextEncoder().encode('%PDF-1.7 not raw')), (e: unknown) => e instanceof CameraRawError && e.code === 'not-raw');
  assert.throws(() => kernel.developDisplay(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0])), (e: unknown) => e instanceof CameraRawError && e.code === 'not-raw');
  assert.throws(() => kernel.developDisplay(new Uint8Array(CAMERA_RAW_MAX_INPUT + 1)), (e: unknown) => e instanceof CameraRawError && e.code === 'limit' && /smaller than 192 MB/.test(e.message));
  assert.equal(kernel.dead, false);
  assert.equal(kernel.developDisplay(buildDng({ width: 8, height: 8, scene: grey(0.5) })).width, 8);
});

test('the 512 MiB memory cap refuses a sensor that cannot be developed, with the numbers in the message', async () => {
  const kernel = await loadCameraRawKernel();
  // 7000 x 7000 = 49 MP of 16-bit data is 98 MB on disk; developing it needs about 100 + 98 + 294 + 24 MiB.
  const size = 7000;
  const big = buildDng({ width: size, height: size, scene: grey(0.4) });
  assert.throws(() => kernel.developLinear(big), (e: unknown) => {
    assert.ok(e instanceof CameraRawError); assert.equal(e.code, 'limit');
    assert.match(e.message, /49 megapixel/); assert.match(e.message, /512 MiB/);
    assert.match(describeCameraRawError(e), /smaller size/);
    return true;
  });
  assert.equal(kernel.dead, false, 'a refusal is clean, not a crash');
  // A header that declares far more pixels than the module will ever hold is refused before any allocation.
  const declared = buildDng({ width: 16, height: 16, scene: grey(0.4), declare: { width: 30000, height: 30000 }, noData: true });
  assert.throws(() => kernel.developLinear(declared), (e: unknown) => e instanceof CameraRawError && (e.code === 'limit' || e.code === 'failed'));
  assert.equal(kernel.dead, false);
});

test('a bounded file just under the cap develops', async () => {
  const kernel = await createCameraRawKernel(new Uint8Array(await readFile(wasmUrl)));
  const file = buildDng({ width: 4000, height: 3000, scene: (x, y) => [(x % 256) / 256, (y % 256) / 256, 0.25] });
  const t = performance.now();
  const image = kernel.developDisplay(file, 'fast');
  assert.equal(image.width, 4000);
  assert.ok(kernel.memoryBytes <= 512 * 1024 * 1024, `peak ${kernel.memoryBytes}`);
  assert.ok(performance.now() - t < 60_000);
});

test('truncated and corrupted files fail with a typed error, never a crash', async () => {
  const kernel = await loadCameraRawKernel();
  const file = buildDng({ width: 32, height: 24, scene: (x, y) => [x / 32, y / 24, 0.5], iso: 200, exposureTime: [1, 100] });
  let seed = 12345;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const cases: Uint8Array[] = [];
  for (let n = 0; n < file.length; n += Math.max(1, Math.floor(file.length / 60))) cases.push(file.subarray(0, n));
  for (let i = 0; i < 120; i++) {
    const copy = file.slice();
    for (let k = 0; k < 1 + (i % 6); k++) copy[Math.floor(rand() * Math.min(copy.length, 700))] = Math.floor(rand() * 256);
    cases.push(copy);
  }
  for (const c of cases) {
    try { kernel.developDisplay(c); }
    catch (e) { assert.ok(e instanceof CameraRawError, String(e)); assert.notEqual(e.code, 'crashed'); }
  }
  assert.equal(kernel.dead, false);
});

test('error wording points to a way forward', () => {
  assert.match(describeCameraRawError(new CameraRawError('limit', 'Too big.')), /DNG at a smaller size|JPEG/);
  assert.match(describeCameraRawError(new CameraRawError('unsupported', 'x')), /Export a DNG or a JPEG/);
  assert.match(describeCameraRawError(new CameraRawError('failed', 'bad')), /could not be read on this device/);
});
