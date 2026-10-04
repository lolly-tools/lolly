// SPDX-License-Identifier: MPL-2.0
/**
 * A one-artboard still export paints that artboard's own `bg` (plan 291 M3b, export-bg).
 *
 * `lolly run <session.lolly> --export=png --s=<frame>` and the web's URL-mode export of
 * one artboard (`#/tool/design?slot=…&s=<frame>&format=png&export=1`) hand a single
 * `[data-pdf-page]` page to the raster path. Design exports with a transparent backdrop
 * by default, and the raster path cleared the root's own background to get it, so the
 * page's fill went with it: the PNG came out transparent and the JPG black, while the
 * same frame in a whole-deck export kept its colour. A document with no artboards still
 * exports with alpha, as before.
 *
 * Gated on LOLLY_EXPORT_TEST_URL, a running web shell (for example the Vite dev server):
 *
 *   LOLLY_EXPORT_TEST_URL=http://127.0.0.1:5173 node --import ./tests/css-stub.mjs --test tests/design-frame-export-bg.browser.test.ts
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import { buildDesignLolly } from '../packages/node-shell/src/rebrand/pipeline.ts';
import { closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { closeWebShell, exportDesignSessionViaWebShell, type DesignSessionExportFormat } from '../packages/node-shell/src/webshell-render.ts';

const origin = process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'set LOLLY_EXPORT_TEST_URL';
const sharp = createRequire(import.meta.url)('sharp') as (input: Uint8Array) => {
  ensureAlpha(): { raw(): { toBuffer(o: { resolveWithObject: true }): Promise<{ data: Buffer; info: { width: number; height: number } }> } };
};

/** Synthetic material only: two coloured artboards with a heading each, or one loose heading. */
async function session(framed: boolean): Promise<Uint8Array> {
  const label = framed ? 'Frame background synthetic deck' : 'Unframed synthetic design';
  const boxes = framed
    ? [
        { id: 'one', kind: 'frame', name: 'One', x: 0, y: 0, w: 640, h: 360, rot: 0, shape: 'rect', bg: '#f2e8d5', order: 0 },
        { id: 'one-title', kind: 'text', frame: 'one', x: 40, y: 40, w: 400, h: 60, rot: 0, text: 'First', fontSize: 40, weight: '500', fg: '#111111', align: 'left', valign: 'top', pad: 0 },
        { id: 'two', kind: 'frame', name: 'Two', x: 700, y: 0, w: 640, h: 360, rot: 0, shape: 'rect', bg: '#1f6f8b', order: 1 },
        { id: 'two-title', kind: 'text', frame: 'two', x: 740, y: 40, w: 400, h: 60, rot: 0, text: 'Second', fontSize: 40, weight: '500', fg: '#ffffff', align: 'left', valign: 'top', pad: 0 },
      ]
    : [
        { id: 'title', kind: 'text', x: 200, y: 140, w: 240, h: 60, rot: 0, text: 'Loose', fontSize: 40, weight: '500', fg: '#111111', align: 'left', valign: 'top', pad: 0 },
      ];
  const { bytes } = await buildDesignLolly({
    session: {
      values: {
        boxes, __toolId: 'design', __label: label, __export_filename: label,
        __export_width: '640', __export_height: '360', __export_unit: 'px',
      },
      mediaRefs: [],
    },
    media: new Map(),
    name: label,
    exportedAt: '2026-10-03T00:00:00.000Z',
  });
  return bytes;
}

async function cornerPixel(format: DesignSessionExportFormat, bytes: Uint8Array, frame?: string): Promise<{ rgba: number[]; width: number; height: number }> {
  const out = await exportDesignSessionViaWebShell(bytes, { name: 'synthetic.lolly', format, frame, base: origin, c2pa: false, imprint: false });
  const { data, info } = await sharp(out.bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const at = (5 * info.width + 5) * 4;
  return { rgba: [...data.subarray(at, at + 4)], width: info.width, height: info.height };
}

/** Within a few levels per channel: JPEG and colour management move a solid fill slightly. */
function near(actual: number[], expected: number[], label: string): void {
  const off = actual.map((v, i) => Math.abs(v - expected[i]!));
  assert.ok(off.every((d) => d <= 6), `${label}: got rgba(${actual.join(', ')}), expected about rgba(${expected.join(', ')})`);
}

test('one artboard exported as PNG and JPG paints its own bg', { skip, timeout: 600_000 }, async () => {
  const bytes = await session(true);
  try {
    const png = await cornerPixel('png', bytes, 'two');
    assert.deepEqual([png.width, png.height], [640, 360]);
    near(png.rgba, [0x1f, 0x6f, 0x8b, 255], 'PNG of frame two');

    const jpg = await cornerPixel('jpeg', bytes, 'two');
    near(jpg.rgba, [0x1f, 0x6f, 0x8b, 255], 'JPG of frame two');

    const first = await cornerPixel('png', bytes, 'one');
    near(first.rgba, [0xf2, 0xe8, 0xd5, 255], 'PNG of frame one');
  } finally {
    await closeWebShell();
    await closeBrowser();
  }
});

test('a design with no artboards still exports its PNG with a transparent backdrop', { skip, timeout: 300_000 }, async () => {
  const bytes = await session(false);
  try {
    const png = await cornerPixel('png', bytes);
    assert.equal(png.rgba[3], 0, `the corner of an unframed export should stay transparent, got rgba(${png.rgba.join(', ')})`);
  } finally {
    await closeWebShell();
    await closeBrowser();
  }
});
