// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CameraRawMeta } from '@lolly-tools/node-shell/camera-raw';
import { cameraRawColourNotice, cameraRawImportReport } from './camera-raw-upload.ts';

const base = {
  schema: 1, format: 'DNG', make: 'Google', model: 'Pixel 4a', width: 4016, height: 3008, iso: 55, exposureTime: 0.01, fNumber: 1.7,
  baselineExposure: 0.2, orientation: 1, orientationApplied: true, whiteBalance: null, cfa: 'RGGB', demosaic: 'ahd', encoding: 'srgb-8-rgba',
  previewOnly: false, warnings: [],
  color: { exact: true, label: 'exact colour', method: 'dng-matrices', deltaE: null, deltaEFallback: null, cameraToXyzD50: null, analogBalance: null, calibrations: [] },
} as unknown as CameraRawMeta;
const withColour = (color: Partial<CameraRawMeta['color']>, rest: Partial<CameraRawMeta> = {}): CameraRawMeta => ({ ...base, ...rest, color: { ...base.color, ...color } });

test('a DNG is reported as exact colour with its camera and size', () => {
  assert.equal(cameraRawImportReport(base), 'DNG from Google Pixel 4a, 4016×3008. Exact colour from the matrices in the DNG file.');
});

test('a fitted raw says approximate colour and how far the fit is from the camera JPEG', () => {
  const meta = withColour({ exact: false, label: 'approximate colour', method: 'embedded-jpeg-fit', deltaE: 4.24 }, { format: 'NEF', make: 'NIKON CORPORATION', model: 'NIKON D70' });
  assert.match(cameraRawColourNotice(meta), /^Approximate colour: fitted to the camera’s embedded JPEG \(mean difference 4\.2 ΔE\)\.$/);
  assert.match(cameraRawImportReport(meta), /^NEF from NIKON CORPORATION NIKON D70, 4016×3008\. Approximate colour/);
});

test('a preview and a file with no fit are also labelled approximate colour', () => {
  assert.match(cameraRawColourNotice(withColour({ exact: false, method: 'camera-jpeg' }, { previewOnly: true })), /^Approximate colour: this is the camera’s embedded JPEG preview, not the raw sensor data\.$/);
  assert.match(cameraRawColourNotice(withColour({ exact: false, method: 'neutral-fallback' })), /^Approximate colour: this format has no embedded colour matrices\.$/);
  assert.match(cameraRawColourNotice(withColour({ exact: false, method: 'embedded-jpeg-fit', deltaE: null })), /^Approximate colour: fitted to the camera’s embedded JPEG\.$/);
});

test('a monochrome sensor is not called approximate', () => {
  assert.equal(cameraRawColourNotice(withColour({ exact: true, method: 'monochrome' })), 'Monochrome sensor data.');
});
