// SPDX-License-Identifier: MPL-2.0
/**
 * The only real proof that Penpot accepts what the writer emits: build a `.penpot`
 * from a Design box fixture (boards, a dashed-stroke rect with a shadow, a rotated
 * gradient ellipse, markdown text, a picture, a pill with backdrop blur, a scratch
 * box) plus a brand token document, import it through `import-binfile` into a
 * project, read the file back and count what arrived, then trash it.
 *
 * Gated (skip-with-reason) on PENPOT_PAT + PENPOT_PROJECT so `npm test` never
 * touches the network; run it by hand before a release:
 *
 *   PENPOT_PAT=<token> PENPOT_PROJECT=<project uuid> node --test tests/penpot-live-import.test.ts
 *
 * The validator in penpot-file.test.ts ports Penpot's schema; this test asks Penpot.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync } from 'fflate';
import { buildPenpotEntries, boxesToPenpotDoc, parsePenpotImportStream, penpotUuid } from '../engine/src/penpot-file.ts';

const PAT = process.env.PENPOT_PAT;
const PROJECT = process.env.PENPOT_PROJECT;
const BASE = (process.env.PENPOT_ORIGIN ?? 'https://design.penpot.app') + '/api/rpc/command/';
const skip = !PAT || !PROJECT ? 'set PENPOT_PAT and PENPOT_PROJECT to run the live import' : false;

const PNG_1PX = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVQIW2P8z8DwnwEIGBmQAFgAAG8DAv2NB5kAAAAASUVORK5CYII=', 'base64'));

const TOKENS = {
  $metadata: { tokenSetOrder: ['base', 'light'] },
  $themes: [{ name: 'light', selectedTokenSets: { base: 'enabled', light: 'enabled' } }],
  base: { color: { $type: 'color', ramp: { primary: { 1: { $value: '#0c322c' }, 4: { $value: '#30ba78' } } } }, font: { $type: 'fontFamily', brand: { $value: 'SUSE' } }, asset: { logo: { $type: 'asset', $value: 'lolly/logo/primary' } } },
  light: { color: { $type: 'color', semantic: { primary: { $value: '{color.ramp.primary.4}' }, text: { $value: '{color.ramp.primary.1}' } } } },
};

const BOXES = [
  { id: 'f1', kind: 'frame', name: 'Cover', x: 0, y: 0, w: 800, h: 450, bg: '#123456', order: 0, clipChildren: true },
  { id: 'f2', kind: 'frame', name: 'Second', x: 900, y: 0, w: 400, h: 400, bg: 'var(--brand-surface, #ffffff)', order: 1 },
  { id: 'b1', kind: 'box', frame: 'f1', x: 40, y: 40, w: 200, h: 120, shape: 'rounded', radius: 24, bg: '#30ba78', stroke: '#0c322c', strokeW: 4, strokeDash: 'dashed', strokeDashLen: 12, strokeGapLen: 6, shadow: 'box', shadowColor: '#00000055', shadowX: 4, shadowY: 8, shadowBlur: 12 },
  { id: 'b2', kind: 'box', frame: 'f1', x: 300, y: 40, w: 160, h: 160, shape: 'ellipse', grad: 'lin.srgb_90_ff0000-0_0000ff-100', rot: 30, opacity: 80, blend: 'multiply', blur: 2 },
  { id: 't1', kind: 'text', frame: 'f1', x: 40, y: 220, w: 500, h: 120, text: 'Hello **Penpot**\n- {#ff8800 w700|orange} item', fg: '#ffffff', fontSize: 40, font: 'sans', weight: 600, align: 'left', valign: 'top', lineHeight: 1.2 },
  { id: 'i1', kind: 'image', frame: 'f1', x: 600, y: 40, w: 150, h: 150, image: { type: 'raster', url: 'dot.png' }, fit: 'cover', shape: 'rounded', radius: 12 },
  { id: 'p1', kind: 'box', frame: 'f2', x: 950, y: 50, w: 300, h: 300, shape: 'pill', bg: '#ffcc00', bgBlur: 8 },
  { id: 's1', kind: 'box', frame: '', x: 1400, y: 100, w: 80, h: 80, shape: 'rect', bg: '#00ff00' },
  { id: 'a1', kind: 'audio', frame: 'f1', x: 0, y: 0, w: 10, h: 10 },
];

async function rpc(cmd: string, body: unknown): Promise<unknown> {
  const res = await fetch(BASE + cmd, {
    method: 'POST',
    headers: { Authorization: `Token ${PAT}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.status === 204 ? null : res.json();
}

test('live: Penpot imports a Design-boxes archive with its tokens, colours and typography', { skip, timeout: 90_000 }, async () => {
  const doc = boxesToPenpotDoc(BOXES, {
    name: 'Lolly live-import test', canvas: { w: 1920, h: 1080 }, fonts: { sans: 'SUSE', mono: 'SUSE Mono' },
    mediaFor: (b) => (b.id === 'i1' ? { id: penpotUuid(), name: 'dot', mtype: 'image/png', width: 2, height: 2, bytes: PNG_1PX } : null),
    tokens: TOKENS,
    palette: [{ name: 'Jungle', path: 'Brand', color: '#30ba78' }, { name: 'Pine', path: 'Brand', color: '#0c322c' }],
    typographies: [{ name: 'Brand', path: 'Brand', fontFamily: 'SUSE', fontWeight: 400, fontSize: 16, lineHeight: 1.2 }],
  });
  const build = buildPenpotEntries(doc);
  assert.deepEqual(build.warnings, []);
  const files: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(build.entries)) files[k] = typeof v === 'string' ? new TextEncoder().encode(v) : v;
  const zip = zipSync(files);

  const form = new FormData();
  form.append('project-id', PROJECT!);
  form.append('name', doc.name);
  form.append('version', '3');
  form.append('file', new Blob([zip], { type: 'application/zip' }), 'lolly-live-import.penpot');
  const res = await fetch(BASE + 'import-binfile', { method: 'POST', headers: { Authorization: `Token ${PAT}`, Accept: 'application/json' }, body: form });
  assert.equal(res.status, 200);
  const parsed = parsePenpotImportStream(await res.text());
  assert.equal(parsed.error, null, `import error: ${parsed.error}`);
  assert.equal(parsed.fileIds.length, 1);
  assert.ok(parsed.sections.includes('tokens-lib'), 'tokens.json was read');
  const fileId = parsed.fileIds[0]!;

  try {
    const file = await rpc('get-file', { id: fileId }) as { data?: { pagesIndex?: Record<string, { objects?: Record<string, { type: string; name: string }> }>; colors?: Record<string, unknown>; typographies?: Record<string, unknown>; tokensLib?: unknown } };
    const data = file.data ?? {};
    const pages = Object.values(data.pagesIndex ?? {});
    assert.equal(pages.length, 1);
    const objs = Object.values(pages[0]!.objects ?? {});
    const census: Record<string, number> = {};
    for (const o of objs) census[o.type] = (census[o.type] ?? 0) + 1;
    // Root frame + 2 boards; rounded rect, image rect, pill, scratch = 4 rects; the ellipse; the text; the audio box is gone.
    assert.deepEqual(census, { frame: 3, rect: 4, circle: 1, text: 1 });
    assert.equal(Object.keys(data.colors ?? {}).length, 2);
    assert.equal(Object.keys(data.typographies ?? {}).length, 1);
    assert.ok(data.tokensLib, 'the file carries a tokens lib');
  } finally {
    await rpc('delete-file', { id: fileId });
  }
});
