// SPDX-License-Identifier: MPL-2.0
// Sign's "Add today's date" was set in Helvetica on the page preview and in the signed PDF,
// whatever the design system. Tools set their words in the design system's faces, so the
// preview draws the date in that face and the file carries it as outlines in that face, stamped
// through host.pdf.stamp's `paths`. A host that predates stamped paths ignores them and
// counts fewer stamps; the date then goes in as text, so it is never lost.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const HOOKS = new URL('../community/sign/hooks.js', import.meta.url);
const PDF = new TextEncoder().encode('%PDF-1.7\n%stand-in\n');
const modelAt = (x: number) => [
  { id: 'source', value: { bytes: PDF, name: 'contract.pdf', size: PDF.length } },
  { id: 'signature', value: { url: 'data:image/png;base64,AA==' } },
  { id: 'signatureInk', value: '' },
  { id: 'page', value: 1 },
  { id: 'position', value: { x, y: 620, width: 144 } },
  { id: 'initials', value: null },
  { id: 'date', value: true },
  { id: 'seal', value: false },
  { id: 'lock', value: false },
];
const model = modelAt(72);

type StampOpts = { images: unknown[]; texts?: Array<Record<string, unknown>>; paths?: Array<Record<string, unknown>> };
function stubHost(opts: { paths: boolean; text: boolean; advance?: number }) {
  const stamps: StampOpts[] = [];
  const host = {
    profile: { get: async () => ({}) },
    raster: { decode: async () => ({}), encode: async () => ({ bytes: new Uint8Array([1]), width: 600, height: 180 }) },
    tokens: { resolve: async (ref: string) => (ref === '{font.brand}' ? "'Probe Face', SUSE" : 'SUSE Mono') },
    pdf: {
      pages: async () => ({ pages: [{ page: 1, svg: '<svg/>', widthPt: 612, heightPt: 792 }], totalPages: 1 }),
      stamp: async (bytes: Uint8Array, o: StampOpts) => {
        stamps.push(o);
        return { bytes, pages: 1, stamps: o.images.length + (o.texts?.length ?? 0) + (opts.paths ? o.paths?.length ?? 0 : 0) };
      },
    },
    ...(opts.text ? { text: {
      fontUrl: async (family: string) => (family === 'Probe Face' ? { url: 'blob:http://localhost/probe' } : null),
      toPath: async (o: { text: string; fontSize: number }) => ({ d: `M0 0L${o.fontSize} 0L${o.fontSize} -${o.fontSize}Z`, advanceWidth: opts.advance ?? 50, notdef: 0 }),
    } } : {}),
  };
  return { host, stamps };
}
async function sign(opts: { paths: boolean; text: boolean; advance?: number }, m = model) {
  const src = await readFile(HOOKS, 'utf8');
  const { host, stamps } = stubHost(opts);
  const hooks = new Function('host', `${src}\nreturn { exportFile, onInit };`)(host) as {
    exportFile: (ctx: unknown) => Promise<{ bytes: Uint8Array }>; onInit: (ctx: unknown) => Promise<Record<string, unknown>>;
  };
  await hooks.exportFile({ model: m, host, opts: {} });
  return { stamps, preview: await hooks.onInit({ model: m, host }) };
}

test('the signed PDF carries the date as outlines in the design system\'s face', async () => {
  const { stamps } = await sign({ paths: true, text: true });
  assert.equal(stamps.length, 1);
  assert.deepEqual(stamps[0]!.texts, [], 'no Helvetica text');
  const path = stamps[0]!.paths?.[0];
  assert.ok(path, 'the date is a stamped path');
  assert.equal(path.page, 1);
  assert.equal(path.color, '#141414');
  // Shaped at the date's size, with the baseline one size below the top of the date's box.
  assert.match(String(path.d), /^M0 0L10 0/);
  assert.equal(path.y, 620 + 180 * 144 / 600 + 5 + 10);
});

test('the page preview sets the date in the design system\'s face', async () => {
  const { preview } = await sign({ paths: true, text: true });
  assert.equal(preview.dateFont, "'Probe Face', SUSE, sans-serif");
  const template = await readFile(new URL('../community/sign/template.html', import.meta.url), 'utf8');
  assert.match(template, /font-family="\{\{dateFont\}\}"/);
  assert.doesNotMatch(template, /Helvetica/);
});

test('a host that predates stamped paths, or cannot shape text, still stamps the date', async () => {
  for (const opts of [{ paths: false, text: true }, { paths: true, text: false }]) {
    const { stamps } = await sign(opts);
    const last = stamps.at(-1)!;
    assert.equal(last.texts?.length, 1, JSON.stringify(opts));
    assert.equal(last.paths, undefined);
  }
});

test('a date wider than the room the layout keeps moves left to stay on the page, in the preview and the file', async () => {
  // The signature group sits at the page's right edge (612 - 144 = 468); a 200-point-wide
  // date would end at 668, so it starts at 612 - 200 = 412 in both.
  const { stamps, preview } = await sign({ paths: true, text: true, advance: 200 }, modelAt(600));
  assert.equal(stamps[0]!.paths?.[0]?.x, 412);
  assert.equal((preview.dateMark as { x: number }).x, 412);
});
