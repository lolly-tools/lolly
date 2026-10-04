// SPDX-License-Identifier: MPL-2.0
/**
 * The `#/open` route through a real web shell (plan 291 W8): a packaged synthetic Design
 * deck opens with no drop event and no chooser click, the page reaches the tool with
 * the saved session's slot and shows the deck's label as its name, and the same open
 * exports the deck through the URL-mode export.
 *
 * Gated on LOLLY_EXPORT_TEST_URL, a running web shell (for example the Vite dev server);
 * the helpers drive it through `base`, as `lolly run` does through LOLLY_WEB_BASE.
 *
 *   LOLLY_EXPORT_TEST_URL=http://127.0.0.1:5173 node --import ./tests/css-stub.mjs --test tests/open-route.browser.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { strFromU8, unzipSync } from 'fflate';
import { readFileSync } from 'node:fs';

import { buildDesignLolly } from '../packages/node-shell/src/rebrand/pipeline.ts';
import { closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { settleEditor } from '../packages/node-shell/src/open-session.ts';
import { closeWebShell, exportDesignSessionThemesViaWebShell, exportDesignSessionViaWebShell, openLollyViaWebShell, renderDesignViaSession } from '../packages/node-shell/src/webshell-render.ts';

const origin = process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'set LOLLY_EXPORT_TEST_URL';
const LABEL = 'Open route synthetic deck';

/** Two frames, a heading on each: synthetic text only, no brand material. */
async function syntheticDeck(): Promise<Uint8Array> {
  const boxes = [
    { id: 'one', kind: 'frame', name: 'One', x: 0, y: 0, w: 1920, h: 1080, rot: 0, shape: 'rect', bg: '#ffffff', order: 0 },
    { id: 'one-title', kind: 'text', frame: 'one', x: 120, y: 120, w: 1200, h: 160, rot: 0, text: 'First frame', fontSize: 72, weight: '500', fg: '#111111', align: 'left', valign: 'top', pad: 0 },
    { id: 'two', kind: 'frame', name: 'Two', x: 2080, y: 0, w: 1920, h: 1080, rot: 0, shape: 'rect', bg: '#f4f4f4', order: 1 },
    { id: 'two-title', kind: 'text', frame: 'two', x: 2200, y: 120, w: 1200, h: 160, rot: 0, text: 'Second frame', fontSize: 72, weight: '500', fg: '#111111', align: 'left', valign: 'top', pad: 0 },
  ];
  const { bytes } = await buildDesignLolly({
    session: {
      values: {
        boxes, transition: 'fade', __toolId: 'design', __label: LABEL, __export_filename: LABEL,
        __export_width: '1920', __export_height: '1080', __export_unit: 'px',
      },
      mediaRefs: [],
    },
    media: new Map(),
    name: LABEL,
    exportedAt: '2026-10-03T00:00:00.000Z',
  });
  return bytes;
}

test('#/open opens a packaged deck on its slot with its label, and exports it as PPTX', { skip, timeout: 300_000 }, async () => {
  const bytes = await syntheticDeck();
  try {
    const opened = await openLollyViaWebShell(bytes, { name: 'synthetic.lolly', base: origin });
    try {
      assert.equal(opened.toolId, 'design');
      assert.ok(opened.slot.length > 0);
      assert.equal(new URL(opened.page.url()).origin, new URL(origin!).origin);
      const name = await opened.page.locator('[data-action="filename"]').first()
        .evaluate((el) => (el as HTMLInputElement).value || (el as HTMLInputElement).placeholder);
      assert.equal(name, LABEL);
    } finally {
      await opened.close();
    }

    const pptx = await exportDesignSessionViaWebShell(bytes, { name: 'synthetic.lolly', format: 'pptx', base: origin });
    assert.match(pptx.filename, /\.pptx$/);
    const parts = unzipSync(pptx.bytes);
    const slides = Object.keys(parts).filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path));
    assert.equal(slides.length, 2);
  } finally {
    await closeWebShell();
    await closeBrowser();
  }
});

test('#/open refuses a source from another origin before anything is fetched', { skip, timeout: 120_000 }, async () => {
  const { getBrowser } = await import('../packages/node-shell/src/browsers.ts');
  const browser = await getBrowser();
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  try {
    const requested: string[] = [];
    for (const source of [
      '//example.invalid/x.lolly', 'data:application/zip;base64,UEsFBg==', 'https://example.invalid/x.lolly',
      // Dot segments the URL parser resolves into a protocol-relative `//host` path.
      '/.//example.invalid/x.lolly', '/a/..//example.invalid/x.lolly', '/%2e//example.invalid/x.lolly',
    ]) {
      const page = await ctx.newPage();
      page.on('request', (request) => { requested.push(request.url()); });
      await page.goto(`${origin}/#/open?lolly=${encodeURIComponent(source)}`, { waitUntil: 'load' });
      await page.locator('[data-open-route="failed"]').waitFor({ state: 'visible', timeout: 60_000 });
      assert.equal(new URL(page.url()).hash, '#/open');
      await page.close();
    }
    assert.deepEqual(requested.filter((url) => url.includes('example.invalid') || url.startsWith('data:application/zip')), []);
  } finally {
    await ctx.close();
    await closeBrowser();
  }
});

test('#/open survives duplicate route events after removing its source address', { skip, timeout: 120_000 }, async () => {
  const { getBrowser } = await import('../packages/node-shell/src/browsers.ts');
  const browser = await getBrowser();
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  let release!: () => void;
  const responseReady = new Promise<void>((resolve) => { release = resolve; });
  try {
    const bytes = await syntheticDeck();
    const page = await ctx.newPage();
    let requested!: () => void;
    const requestStarted = new Promise<void>((resolve) => { requested = resolve; });
    await page.route('**/__duplicate-navigation.lolly', async (route) => {
      requested();
      await responseReady;
      await route.fulfill({ status: 200, body: Buffer.from(bytes), contentType: 'application/vnd.lolly+zip' });
    });
    await page.goto(`${origin}/#/open?lolly=%2F__duplicate-navigation.lolly`, { waitUntil: 'load' });
    await requestStarted;
    assert.equal(new URL(page.url()).hash, '#/open');
    await page.evaluate(() => window.dispatchEvent(new PopStateEvent('popstate')));
    // Let the router process the duplicate while the file is still in flight.
    await page.waitForTimeout(200);
    release();
    await settleEditor(page, 60_000);
    assert.match(new URL(page.url()).hash, /^#\/tool\/design\?slot=/);
    assert.equal(await page.locator('[data-open-route="failed"]').count(), 0);
  } finally {
    release();
    await ctx.close();
    await closeBrowser();
  }
});

test('a deck whose picture would need an address over the browser\'s 2 MiB cap exports through the session (plan 291 W9)', { skip, timeout: 300_000 }, async () => {
  const { default: sharp } = await import('sharp');
  // Noise does not compress, so this PNG stays near its raw size: about 1.6 MB, which
  // inlined in an address (base64 and percent-encoded twice) is over 2,400,000 characters.
  const raw = Buffer.alloc(760 * 700 * 3);
  let seed = 7;
  for (let i = 0; i < raw.length; i += 1) { seed = (seed * 1103515245 + 12345) >>> 0; raw[i] = seed >>> 24; }
  const png = await sharp(raw, { raw: { width: 760, height: 700, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
  const picture = `data:image/png;base64,${png.toString('base64')}`;
  assert.ok(picture.length * 1.15 > 2_097_152, `${picture.length} characters inlined`);
  const boxes = [
    { id: 'one', kind: 'frame', name: 'One', x: 0, y: 0, w: 1920, h: 1080, rot: 0, shape: 'rect', bg: '#ffffff', order: 0 },
    { id: 'one-photo', kind: 'image', frame: 'one', x: 0, y: 0, w: 1920, h: 1080, rot: 0, image: picture, fit: 'cover' },
    { id: 'one-title', kind: 'text', frame: 'one', x: 120, y: 120, w: 1200, h: 160, rot: 0, text: 'Large picture', fontSize: 72, weight: '500', fg: '#111111', align: 'left', valign: 'top', pad: 0 },
  ];
  try {
    const out = await renderDesignViaSession({ boxes }, 'pptx', {}, { label: 'Large picture', base: origin });
    assert.equal(out.mime, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    const parts = unzipSync(out.bytes);
    const media = Object.entries(parts).filter(([path]) => path.startsWith('ppt/media/'));
    assert.ok(media.some(([, bytes]) => bytes.length > 1_000_000), `a picture travelled whole: ${media.map(([p, b]) => `${p} ${b.length}`).join(', ')}`);
  } finally {
    await closeWebShell();
    await closeBrowser();
  }
});

test('one opened session exports once per theme, each in its own theme (plan 291 M4)', { skip, timeout: 300_000 }, async () => {
  const boxes = [
    { id: 'one', kind: 'frame', name: 'One', x: 0, y: 0, w: 640, h: 360, rot: 0, shape: 'rect', bg: '#ffffff', order: 0 },
    { id: 'one-title', kind: 'text', frame: 'one', x: 40, y: 40, w: 560, h: 120, rot: 0, text: 'Themed text', fontSize: 48, weight: '500', fg: 'var(--brand-text, #111111)', align: 'left', valign: 'top', pad: 0 },
  ];
  const { bytes } = await buildDesignLolly({
    session: { values: { boxes, __toolId: 'design', __label: 'Themes', __export_width: '640', __export_height: '360', __export_unit: 'px' }, mediaRefs: [] },
    media: new Map(), name: 'Themes', exportedAt: '2026-10-03T00:00:00.000Z',
  });
  try {
    const [light, dark] = await exportDesignSessionThemesViaWebShell(bytes, {
      name: 'themes.lolly', format: 'png', base: origin, c2pa: false, imprint: false, tokenSelections: [{ '': 'light' }, { '': 'dark' }],
    });
    assert.ok(light && dark);
    assert.notDeepEqual(light.bytes, dark.bytes, 'the dark export paints the brand text in its dark value');
  } finally {
    await closeWebShell();
    await closeBrowser();
  }
});

test('a session exported with a design system of its own resolves its links in that system (plan 291 M4)', { skip, timeout: 300_000 }, async () => {
  // The public fixture's primary, linked from a rect, against whatever the page's profile says.
  const doc = JSON.parse(readFileSync(new URL('./fixtures/recreate/tokens.json', import.meta.url), 'utf8')) as Record<string, unknown>;
  const boxes = [
    { id: 'one', kind: 'frame', name: 'One', x: 0, y: 0, w: 640, h: 360, rot: 0, shape: 'rect', bg: '#ffffff', order: 0 },
    { id: 'chip', kind: 'rect', frame: 'one', x: 40, y: 40, w: 300, h: 200, rot: 0, bg: '#13294b', tokenLinks: JSON.stringify({ bg: { ref: '{color.semantic.primary}', value: '#13294b' } }) },
  ];
  const { bytes } = await buildDesignLolly({
    session: { values: { boxes, __toolId: 'design', __label: 'Own system', __export_width: '640', __export_height: '360', __export_unit: 'px' }, mediaRefs: [] },
    media: new Map(), name: 'Own system', exportedAt: '2026-10-03T00:00:00.000Z',
  });
  const fills = (pptx: Uint8Array): string[] => {
    const xml = strFromU8(unzipSync(pptx)['ppt/slides/slide1.xml']!);
    return [...new Set([...xml.matchAll(/srgbClr val="([0-9A-Fa-f]{6})"/g)].map((m) => m[1]!.toLowerCase()))];
  };
  try {
    const own = await exportDesignSessionViaWebShell(bytes, { name: 'own.lolly', format: 'pptx', base: origin, c2pa: false, imprint: false, designSystem: doc });
    assert.ok(fills(own.bytes).includes('13294b'), `the linked rect keeps the given system's primary: ${fills(own.bytes).join(' ')}`);
    const profile = await exportDesignSessionViaWebShell(bytes, { name: 'profile.lolly', format: 'pptx', base: origin, c2pa: false, imprint: false });
    assert.ok(!fills(profile.bytes).includes('13294b'), 'without one, the page resolves the link in its profile system');
  } finally {
    await closeWebShell();
    await closeBrowser();
  }
});
