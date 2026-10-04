// SPDX-License-Identifier: MPL-2.0
/**
 * The render family of `lolly check` through a real web shell (plan 291 W1): the trap
 * document opens in the Design editor, `window.lolly.document.check()` runs the
 * mounted audit on the painted canvas, and the findings come back on their layers.
 *
 * Gated on LOLLY_EXPORT_TEST_URL, a running web shell built with the check hook
 * (for example the Vite dev server). The CLI's browser tier drives it through
 * LOLLY_WEB_BASE, as `lolly check` does when that is set.
 *
 *   LOLLY_EXPORT_TEST_URL=http://127.0.0.1:5173 node --import ./tests/css-stub.mjs --test tests/check-render.browser.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { checkFile } from '../packages/node-shell/src/check.ts';
import { closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { closeWebShell } from '../packages/node-shell/src/webshell-render.ts';
import { readToolManifest } from '../packages/node-shell/src/content-roots.ts';

const origin = process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'set LOLLY_EXPORT_TEST_URL';
const TRAP = new Uint8Array(readFileSync(new URL('./fixtures/check/trap.boxes.json', import.meta.url)));

test('the page hook reports the clipped headline, the pale caption and the caption over a picture', { skip, timeout: 180_000 }, async () => {
  const before = process.env.LOLLY_WEB_BASE;
  process.env.LOLLY_WEB_BASE = origin;
  try {
    const report = await checkFile(TRAP, 'trap.boxes.json', { browser: 'require', designManifest: readToolManifest('design') });
    assert.equal(report.families.render.state, 'ran', report.families.render.reason ?? '');
    const render = report.findings.filter((f) => f.family === 'render');
    const byLayer = new Map(render.map((f) => [f.layerId, f]));
    assert.equal(byLayer.get('overflow')?.code, 'design.text.overflow');
    assert.equal(byLayer.get('caption-low')?.code, 'design.text.contrast-low');
    assert.equal(byLayer.get('caption-photo')?.code, 'design.text.contrast-review');
    assert.equal(byLayer.get('caption-photo')?.needs, 'visual-check');
    for (const f of render) {
      assert.equal(f.artboardId, 'slide');
      assert.ok(f.box, `${f.layerId} has a box`);
    }
    assert.match(report.families.render.reason ?? '', /Checked \d+ text layers for clipping/);
    assert.notEqual(report.exitCode, 3);
  } finally {
    if (before === undefined) delete process.env.LOLLY_WEB_BASE;
    else process.env.LOLLY_WEB_BASE = before;
    await closeWebShell();
    await closeBrowser();
  }
});

/** A `width` x `height` PNG whose pixel (x, y) is `pick(x, y)`, as a data: URL. */
async function pngDataUrl(width: number, height: number, pick: (x: number, y: number) => [number, number, number]): Promise<string> {
  const { deflateSync, crc32 } = await import('node:zlib');
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++) raw.set(pick(x, y), y * (width * 3 + 1) + 1 + x * 3);
  }
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  return `data:image/png;base64,${png.toString('base64')}`;
}

test('dark ink over a dark photo is measured as low contrast; light ink over it and text over a mixed photo stay visual checks (plan 291 M4)', { skip, timeout: 180_000 }, async () => {
  const before = process.env.LOLLY_WEB_BASE;
  process.env.LOLLY_WEB_BASE = origin;
  try {
    const dark = await pngDataUrl(96, 54, (x, y) => [18 + ((x * 7 + y * 3) % 9), 34 + ((x + y) % 7), 30 + ((x * 3) % 5)]);
    const mixed = await pngDataUrl(96, 54, (x) => (x < 48 ? [240, 242, 240] : [18, 34, 30]));
    const text = (id: string, y: number, fg: string, extra: Record<string, unknown> = {}) => ({
      id, kind: 'text', frame: 'slide', x: 120, y, w: 1400, h: 90, rot: 0, text: 'Are we sleepwalking into lock-in', fontSize: 64, weight: '500', fg,
      align: 'left', valign: 'middle', lineHeight: 1.12, font: 'sans', pad: 0, shape: 'rect', ...extra,
    });
    const doc = {
      boxes: [
        { id: 'slide', kind: 'frame', name: 'Photo slide', x: 0, y: 0, w: 1920, h: 1080, rot: 0, shape: 'rect', bg: '#ffffff', order: 0, clipChildren: true },
        { id: 'photo', kind: 'image', frame: 'slide', x: 0, y: 0, w: 1920, h: 700, rot: 0, image: dark, fit: 'cover', imgpos: 'center', shape: 'rect' },
        { id: 'photo-mixed', kind: 'image', frame: 'slide', x: 0, y: 700, w: 1920, h: 380, rot: 0, image: mixed, fit: 'fill', imgpos: 'center', shape: 'rect' },
        text('title-navy', 120, '#0c322c'),
        text('title-white', 360, '#ffffff'),
        text('caption-mixed', 860, '#0c322c', { x: 0, w: 1920, align: 'center' }),
      ],
    };
    const bytes = new TextEncoder().encode(JSON.stringify(doc));
    const report = await checkFile(bytes, 'photo-contrast.boxes.json', { browser: 'require', designManifest: readToolManifest('design') });
    assert.equal(report.families.render.state, 'ran', report.families.render.reason ?? '');
    const byLayer = new Map(report.findings.filter((f) => f.family === 'render' && /contrast/.test(f.code)).map((f) => [f.layerId, f]));
    const navy = byLayer.get('title-navy');
    assert.equal(navy?.code, 'design.text.contrast-low', 'navy over the dark photo is measured');
    assert.equal(navy?.severity, 'warn');
    assert.equal(navy?.evidence?.reason, 'sampled-background');
    assert.ok(Number(navy?.evidence?.ratio) < 3, `measured ${navy?.evidence?.ratio}:1`);
    assert.match(navy?.message ?? '', /with the picture under it/);
    assert.equal(byLayer.get('title-white')?.code, 'design.text.contrast-review', 'white over the dark photo passes the measurement and keeps its note');
    assert.equal(byLayer.get('caption-mixed')?.code, 'design.text.contrast-review', 'half light, half dark stays a visual check');
  } finally {
    if (before === undefined) delete process.env.LOLLY_WEB_BASE;
    else process.env.LOLLY_WEB_BASE = before;
    await closeWebShell();
    await closeBrowser();
  }
});
