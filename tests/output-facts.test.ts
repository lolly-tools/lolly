// SPDX-License-Identifier: MPL-2.0
/**
 * Output facts - engine/src/output-facts.ts.
 *
 * Every fixture comes from tests/helpers/output-fixtures.ts, built from the
 * engine's own writers or hand-assembled headers, so no binary file is needed.
 * Each reader is checked for what it reads, and for what it refuses to state:
 * a fact the bytes do not carry must come back unknown, never as zero or false.
 *
 * Run with: node --test tests/output-facts.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { inspectOutput } from '../engine/src/output-facts.ts';
import type { OutputFacts } from '../engine/src/output-facts.ts';
import { packApng } from '../engine/src/apng.ts';
import { packTiff } from '../engine/src/tiff.ts';
import { storeZip } from '../engine/src/zip.ts';
import { attachC2paStore } from '../engine/src/c2pa-containers.ts';
import {
  bytesOf, encryptedPdf, fakeStore, gif, jpeg, mp4, pdf, rgbPng, rgbaPng, webm, webp,
} from './helpers/output-fixtures.ts';

const isUnknown = (f: { known: boolean }, label: string): void => assert.equal(f.known, false, `${label} must be unknown`);
const value = <T>(f: { known: true; value: T } | { known: false }, label: string): T => {
  assert.equal(f.known, true, `${label} must be known`);
  return (f as { value: T }).value;
};

// ─── raster ─────────────────────────────────────────────────────────────────

test('PNG: size, alpha, resolution, metadata, colour, frames from the chunk table', () => {
  const f = inspectOutput(rgbaPng({ dpi: 300, text: true }));
  assert.equal(f.container, 'png');
  assert.equal(value(f.width, 'width'), 4);
  assert.equal(value(f.height, 'height'), 3);
  assert.equal(value(f.alpha, 'alpha'), true);
  assert.ok(Math.abs(value(f.dpi, 'dpi') - 300) < 0.01);
  assert.equal(value(f.metadata, 'metadata'), true);
  assert.equal(value(f.colour, 'colour'), 'rgb');
  assert.equal(value(f.frames, 'frames'), 1);
  assert.equal(value(f.hdr, 'hdr'), false);
  assert.equal(value(f.credential, 'credential'), false);
  assert.equal(f.basis.width, 'png.IHDR');
});

test('PNG without pHYs: the resolution is unknown, not zero, and RGB has no alpha', () => {
  const f = inspectOutput(rgbPng());
  assert.deepEqual(f.dpi, { known: false, why: 'not-set' });
  assert.equal(value(f.alpha, 'alpha'), false);
  assert.equal(value(f.metadata, 'metadata'), false);
});

test('PNG cICP with the PQ transfer is HDR', () => {
  assert.equal(value(inspectOutput(rgbaPng({ cicp: true })).hdr, 'hdr'), true);
});

test('APNG: frame count from acTL and duration from the fcTL delays', () => {
  const f = inspectOutput(packApng([rgbaPng(), rgbaPng()], { delayMs: 500 }));
  assert.equal(f.container, 'apng');
  assert.equal(value(f.frames, 'frames'), 2);
  assert.equal(value(f.durationMs, 'duration'), 1000);
});

test('a placed C2PA store is reported present; presence is all the reader claims', () => {
  const f = inspectOutput(attachC2paStore(rgbaPng(), 'png', fakeStore()));
  assert.equal(value(f.credential, 'credential'), true);
  assert.equal(f.basis.credential, 'png.c2pa-store');
});

test('JPEG: SOF size and components, JFIF density, never an alpha channel', () => {
  const f = inspectOutput(jpeg({ dpi: 150 }));
  assert.equal(f.container, 'jpg');
  assert.equal(value(f.width, 'width'), 3);
  assert.equal(value(f.height, 'height'), 2);
  assert.equal(value(f.dpi, 'dpi'), 150);
  assert.equal(value(f.alpha, 'alpha'), false);
  assert.equal(value(f.colour, 'colour'), 'rgb');
  assert.equal(value(inspectOutput(jpeg({ components: 4 })).colour, 'cmyk colour'), 'cmyk');
  assert.deepEqual(inspectOutput(jpeg()).dpi, { known: false, why: 'not-set' });
});

test('GIF: frames, summed delays and the transparency flag from the block walk', () => {
  const f = inspectOutput(gif());
  assert.equal(value(f.width, 'width'), 5);
  assert.equal(value(f.frames, 'frames'), 2);
  assert.equal(value(f.durationMs, 'duration'), 200);
  assert.equal(value(f.alpha, 'alpha'), true);
  assert.equal(value(f.colour, 'colour'), 'indexed');
  const one = inspectOutput(gif(1));
  assert.equal(value(one.frames, 'frames'), 1);
  isUnknown(one.durationMs, 'single-frame duration');
});

test('GIF without a trailer: frames and alpha are unread, and the limit is recorded', () => {
  const bytes = gif();
  const f = inspectOutput(bytes.subarray(0, bytes.length - 1));
  isUnknown(f.frames, 'frames');
  assert.ok(f.limits.includes('gif-truncated'));
});

test('WebP: VP8X canvas size and the alpha flag; WebP records no resolution', () => {
  const f = inspectOutput(webp());
  assert.equal(value(f.width, 'width'), 7);
  assert.equal(value(f.height, 'height'), 5);
  assert.equal(value(f.alpha, 'alpha'), true);
  assert.deepEqual(f.dpi, { known: false, why: 'not-computable' });
});

test('TIFF: size, resolution and the colour model from IFD0', () => {
  const f = inspectOutput(packTiff(new Uint8Array(2 * 2 * 3), { width: 2, height: 2, dpi: 300 }));
  assert.equal(f.container, 'tiff');
  assert.equal(value(f.width, 'width'), 2);
  assert.equal(value(f.dpi, 'dpi'), 300);
  assert.equal(value(f.colour, 'colour'), 'rgb');
  assert.equal(value(f.alpha, 'alpha'), false);
  const sep = inspectOutput(packTiff(new Uint8Array(2 * 2 * 4), { width: 2, height: 2, samplesPerPixel: 4, photometric: 5 }));
  assert.equal(value(sep.colour, 'cmyk colour'), 'cmyk');
});

// ─── motion ─────────────────────────────────────────────────────────────────

test('MP4: duration from mvhd, size from tkhd, frames from stsz, HDR from the nclx transfer', () => {
  const f = inspectOutput(mp4(16));
  assert.equal(f.container, 'mp4');
  assert.equal(value(f.durationMs, 'duration'), 5000);
  assert.equal(value(f.width, 'width'), 640);
  assert.equal(value(f.height, 'height'), 360);
  assert.equal(value(f.frames, 'frames'), 150);
  assert.equal(value(f.hdr, 'hdr'), true);
  assert.equal(value(inspectOutput(mp4(1)).hdr, 'sdr'), false);
});

test('WebM: Duration scaled by TimecodeScale, and the video track size', () => {
  const f = inspectOutput(webm());
  assert.equal(f.container, 'webm');
  assert.equal(value(f.durationMs, 'duration'), 5000);
  assert.equal(value(f.width, 'width'), 320);
  assert.equal(value(f.height, 'height'), 240);
  isUnknown(f.frames, 'frames');
});

// ─── vector and documents ───────────────────────────────────────────────────

test('SVG in physical units: the page in points, live text, embedded rasters', () => {
  const f = inspectOutput(bytesOf('<svg xmlns="http://www.w3.org/2000/svg" stroke-width="4" width="210mm" height="297mm" viewBox="0 0 793.7 1122.5"><text>Hi</text><image href="data:image/png;base64,AA"/></svg>'));
  assert.equal(f.container, 'svg');
  const page = value(f.page, 'page');
  assert.ok(Math.abs(page.width - 595.28) < 0.02 && Math.abs(page.height - 841.89) < 0.02, JSON.stringify(page));
  isUnknown(f.width, 'pixel width of a physical SVG');
  assert.equal(value(f.nature, 'nature'), 'mixed');
  assert.equal(value(f.liveText, 'live text'), 1);
  assert.equal(value(f.fontFaces, 'font faces'), 0);
  assert.deepEqual(f.alpha, { known: false, why: 'needs-render' });
});

test('SVG in pixels: the pixel size, and vector when there is no image element', () => {
  const f = inspectOutput(bytesOf('<svg xmlns="http://www.w3.org/2000/svg" width="1200px" height="630"><rect width="10" height="10"/></svg>'));
  assert.equal(value(f.width, 'width'), 1200);
  assert.equal(value(f.height, 'height'), 630);
  assert.equal(value(f.nature, 'nature'), 'vector');
  assert.equal(value(f.liveText, 'live text'), 0);
});

test('EPS: the high-resolution bounding box and process colour operators', () => {
  const f = inspectOutput(bytesOf('%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 595 842\n%%HiResBoundingBox: 0 0 595.28 841.89\n%%Title: x\n0 0 0 1 setcmykcolor\n'));
  assert.equal(f.container, 'eps');
  assert.equal(value(f.page, 'page').width, 595.28);
  assert.equal(value(f.colour, 'colour'), 'cmyk');
});

test('PDF with compressed object streams: pages, page size, fonts, colour and metadata', async () => {
  const f = inspectOutput(await pdf({ objectStreams: true, pages: 2, text: true }));
  assert.equal(f.container, 'pdf');
  assert.equal(value(f.pages, 'pages'), 2);
  const page = value(f.page, 'page');
  assert.equal(page.box, 'MediaBox');
  assert.ok(Math.abs(page.width - 595.28) < 0.01 && page.uniform);
  assert.deepEqual(value(f.fonts, 'fonts'), { declared: 1, embedded: 0, standard: 1 });
  assert.equal(value(f.colour, 'colour'), 'rgb');
  assert.equal(value(f.metadata, 'metadata'), true);
  assert.equal(value(f.encrypted, 'encrypted'), false);
  assert.equal(value(f.nature, 'nature'), 'vector');
});

test('PDF: TrimBox wins over MediaBox, and CMYK operators read as CMYK', async () => {
  const f = inspectOutput(await pdf({ objectStreams: false, trim: true, colour: 'cmyk' }));
  const page = value(f.page, 'page');
  assert.equal(page.box, 'TrimBox');
  assert.ok(Math.abs(page.width - (595.28 - 18)) < 0.01);
  assert.equal(value(f.colour, 'colour'), 'cmyk');
});

test('PDF: an /Encrypt trailer entry is reported as encrypted', () => {
  const f = inspectOutput(encryptedPdf());
  assert.equal(value(f.encrypted, 'encrypted'), true);
  assert.equal(value(f.pages, 'pages'), 1);
  assert.equal(value(f.page, 'page').width, 200);
});

test('ZIP: an archive, with encryption read from the central directory flags', () => {
  const plain = storeZip([{ name: 'a.txt', bytes: bytesOf('hello') }]);
  const f = inspectOutput(plain);
  assert.equal(f.container, 'zip');
  assert.equal(value(f.nature, 'nature'), 'archive');
  assert.equal(value(f.encrypted, 'encrypted'), false);
  const locked = plain.slice();
  for (let i = 0; i + 4 <= locked.length; i++) {
    if (locked[i] === 0x50 && locked[i + 1] === 0x4b && locked[i + 2] === 0x01 && locked[i + 3] === 0x02) locked[i + 8]! |= 1;
  }
  assert.equal(value(inspectOutput(locked).encrypted, 'encrypted'), true);
});

// ─── honesty and totality ───────────────────────────────────────────────────

test('an unrecognised file states its size and nothing else', () => {
  const f = inspectOutput(bytesOf('name,value\nA,1\n'));
  assert.equal(f.container, null);
  assert.equal(f.bytes, 15);
  for (const key of ['width', 'height', 'page', 'pages', 'alpha', 'colour', 'credential', 'encrypted'] as const) {
    assert.deepEqual(f[key], { known: false, why: 'not-computable' }, key);
  }
});

test('every truncation of every fixture is read without throwing', async () => {
  const fixtures: Uint8Array[] = [
    rgbaPng({ dpi: 300, text: true }), packApng([rgbaPng(), rgbaPng()], { delayMs: 40 }), jpeg(), gif(), webp(),
    packTiff(new Uint8Array(12), { width: 2, height: 2, dpi: 72 }), mp4(16), webm(), encryptedPdf(),
    await pdf({ objectStreams: true }), storeZip([{ name: 'a', bytes: bytesOf('x') }]),
  ];
  for (const bytes of fixtures) {
    const step = Math.max(1, Math.floor(bytes.length / 120));
    for (let n = 0; n <= bytes.length; n += step) {
      const f: OutputFacts = inspectOutput(bytes.subarray(0, n));
      assert.equal(f.bytes, n);
    }
  }
});

test('hostile input: corrupted bytes and non-buffers degrade instead of throwing', () => {
  const base = rgbaPng({ text: true });
  for (let seed = 1; seed < 200; seed++) {
    const copy = base.slice();
    for (let k = 0; k < 6; k++) copy[(seed * 7919 + k * 104729) % copy.length] = (seed * 31 + k) & 255;
    inspectOutput(copy);
  }
  const f = inspectOutput('not bytes' as unknown as Uint8Array);
  assert.equal(f.bytes, 0);
  assert.equal(f.container, null);
});
