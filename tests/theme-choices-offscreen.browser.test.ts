// SPDX-License-Identifier: MPL-2.0
/**
 * Theme choices hold off the tool view's own canvas (plans/319 A6).
 *
 * A session saved in dark, or in a colourway, used to lose that choice in four
 * places: a multi-edit card drew the app's own colours, a batch row's stage painted
 * the design system's default (its runtime had the choices, from the token context
 * the row carries), a Design document export painted its stage from the unscoped
 * bridge (which follows the address bar, so a framed tool drew the default) and a
 * composed child ignored the document it was placed in. Each is checked here
 * through the real web shell with plain light and dark and with two colourways: the
 * page starts on the public Lolly Start system with a Persimmon colourway added, the
 * way an automation driver hands a page its design system.
 *
 * The probe is a Design box filled with `var(--brand-primary, #000000)`, the
 * documented brand-inheritance path, so its colour is whatever the canvas was painted.
 * A second page starts on the same system set to dark Persimmon, for a document that
 * made no choice of its own and draws in the design system's.
 *
 *   LOLLY_EXPORT_TEST_URL=http://127.0.0.1:5173 node --import ./tests/css-stub.mjs --test tests/theme-choices-offscreen.browser.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import { chromium, type Browser, type Page } from 'playwright';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { addColourway, type ColourwayValues } from '../engine/src/colourway.ts';

/** shells/web/src/bridge/tokens.ts `AUTOMATION_DESIGN_SYSTEM_GLOBAL`, read once at boot. */
const AUTOMATION_DESIGN_SYSTEM_GLOBAL = '__lollyAutomationDesignSystem';

const origin = process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'set LOLLY_EXPORT_TEST_URL';

const PERSIMMON: Record<string, ColourwayValues> = {
  light: { primary: '#c2410c', 'on-primary': '#ffffff', secondary: '#7c2d12' },
  dark: { primary: '#fb923c', 'on-primary': '#111111', secondary: '#fed7aa' },
};
const DOC = (() => {
  const start = JSON.parse(readFileSync(new URL('../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url), 'utf8'));
  const result = addColourway(start, { id: 'persimmon', name: 'Persimmon', values: PERSIMMON });
  if (!result.ok) throw new Error(result.reasons.join(' '));
  return result.doc;
})();

/** The same system with its stored choices set to dark Persimmon. */
const STORED_DOC = (() => {
  const doc = structuredClone(DOC) as Record<string, unknown>;
  doc.$metadata = { ...(doc.$metadata as object ?? {}), activeThemeSelection: { '': 'dark', colourway: 'persimmon' } };
  return doc;
})();

type Choices = Record<string, string> | undefined;
/** `color.semantic.primary` as the system resolves it under `choices`. */
const primary = (choices: Choices): string =>
  createTokenSet(DOC, choices ? { selection: choices } : {}).colors().find(s => s.path === 'color.semantic.primary')!.value.toLowerCase();
/** Every semantic colour of one look. Another look's primary can be one of them (dark's
 *  surface is light's primary), and a render may paint that colour for its own reasons. */
const semantics = (choices: Choices): Set<string> =>
  new Set(createTokenSet(DOC, choices ? { selection: choices } : {}).colors().filter(s => s.path.startsWith('color.semantic.')).map(s => String(s.value).toLowerCase()));
/** The looks whose primary would give a wrong render away: a colour this look does not use itself. */
const telltales = (choices: Choices): Choices[] =>
  [DEFAULT, DARK, PERSIMMON_LIGHT, PERSIMMON_DARK].filter(other => !semantics(choices).has(primary(other)));
const rgb = (hex: string): string => {
  const n = Number.parseInt(hex.replace('#', '').slice(0, 6), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};
/** Whether an SVG export painted `hex`, in either spelling the walker writes. */
const paints = (svg: string, hex: string): boolean => {
  const [r, g, b] = rgb(hex).slice(4, -1).split(', ');
  return svg.toLowerCase().includes(hex) || new RegExp(`rgb\\(\\s*${r}\\s*,\\s*${g}\\s*,\\s*${b}\\s*\\)`).test(svg);
};

const DEFAULT: Choices = undefined;
const DARK: Choices = { '': 'dark' };
const PERSIMMON_LIGHT: Choices = { '': 'light', colourway: 'persimmon' };
const PERSIMMON_DARK: Choices = { '': 'dark', colourway: 'persimmon' };

const BOXES = [
  { id: 'f', kind: 'frame', name: 'Board', x: 0, y: 0, w: 400, h: 240, rot: 0, shape: 'rect', bg: '#777777', order: 0 },
  { id: 'swatch', kind: 'box', frame: 'f', x: 40, y: 40, w: 200, h: 120, rot: 0, bg: 'var(--brand-primary, #000000)' },
];

/** A Design page holding a tool link with no theme of its own: a QR code whose ink is linked
 *  to the primary role, so its colour says which choices it was composed in. */
const QR_CHILD = `https://lolly.tools/tool/qr-code.svg?${new URLSearchParams({ url: 'https://example.com', color: '{color.semantic.primary}', w: '240', h: '240' })}`;
const COMPOSED_BOXES = [
  { id: 'p', kind: 'frame', name: 'Page', x: 0, y: 0, w: 800, h: 480, rot: 0, shape: 'rect', bg: '#777777', order: 0 },
  { id: 'pic', kind: 'image', frame: 'p', x: 0, y: 0, w: 240, h: 240, rot: 0, image: { id: QR_CHILD }, fit: 'contain' },
];

describe('theme choices off the tool view canvas', { skip }, () => {
  let browser: Browser;
  let page: Page;
  let storedPage: Page;

  /** A page whose design system is `doc`, opened on Design. */
  async function openOn(doc: unknown): Promise<Page> {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(([key, d]) => { (globalThis as Record<string, unknown>)[key as string] = d; }, [AUTOMATION_DESIGN_SYSTEM_GLOBAL, doc] as const);
    const opened = await context.newPage();
    opened.setDefaultTimeout(60_000);
    await opened.goto(`${origin}/t/design?c2pa=0&imprint=0`);
    await opened.locator('#tool-canvas [data-penpot-doc]').waitFor({ state: 'attached', timeout: 120_000 });
    return opened;
  }

  before(async () => {
    // The four looks differ, or nothing below would prove anything.
    assert.equal(new Set([DEFAULT, DARK, PERSIMMON_LIGHT, PERSIMMON_DARK].map(primary)).size, 4);
    browser = await chromium.launch({ headless: true, args: webGpuLaunchArgs('software') });
    page = await openOn(DOC);
    storedPage = await openOn(STORED_DOC);
  });
  after(async () => { await browser?.close(); });

  test('a batch row renders in the theme its session was saved in', { timeout: 180_000 }, async () => {
    const svgs = await page.evaluate(async ({ boxes, cases }) => {
      const [exports, rows, hosts] = await Promise.all(['/src/pro/render-export.ts', '/src/pro/folder-rows.ts', '/src/lib/host-ref.ts'].map(path => import(path)));
      const host = hosts.getHostRef();
      const out: string[] = [];
      for (const choices of cases) {
        // The path a folder export takes: the saved record becomes a row, the row renders.
        const session = { boxes, __toolId: 'design', __label: 'Probe', ...(choices ? { __tokenSelection: choices } : {}) };
        const row = rows.rowFromToolSession(session);
        const { blob } = await exports.renderRowToBlob(row, host, { format: 'svg', c2pa: false, watermark: false, embedMeta: false });
        out.push(await blob.text());
      }
      return out;
    }, { boxes: BOXES, cases: [DEFAULT, DARK, PERSIMMON_LIGHT, PERSIMMON_DARK] });
    [DEFAULT, DARK, PERSIMMON_LIGHT, PERSIMMON_DARK].forEach((choices, i) => {
      assert.ok(paints(svgs[i]!, primary(choices)), `${JSON.stringify(choices)} paints ${primary(choices)}`);
      for (const other of telltales(choices)) {
        assert.ok(!paints(svgs[i]!, primary(other)), `${JSON.stringify(choices)} does not paint ${JSON.stringify(other)}`);
      }
    });
  });

  test('a document export paints its stage in the document\'s choices, whatever the address says', { timeout: 120_000 }, async () => {
    // A framed tool never writes its theme choices into its address, so the address
    // can name a different look from the document's. The address here says light.
    const painted = await page.evaluate(async ({ boxes, cases, stale }) => {
      const [tools, runtimes, exports, hosts] = await Promise.all(['/src/bridge/tool-loader.ts', '/src/lib/mount-runtime.ts', '/src/pro/render-export.ts', '/src/lib/host-ref.ts'].map(path => import(path)));
      const host = hosts.getHostRef(), tool = await tools.getTool('design');
      const address = location.href;
      history.replaceState(history.state, '', `${location.pathname}?c2pa=0&imprint=0&_themes=${encodeURIComponent(JSON.stringify(stale))}`);
      const out: Array<{ stage: string; box: string }> = [];
      try { for (const choices of cases) {
        const source = await runtimes.createToolRuntime(tool, host, { boxes }, choices ? { tokenSelection: choices } : {});
        const mounted = await exports.mountDocumentExport(tool, host, source, { width: 400, height: 240 });
        try {
          const box = mounted.canvas.querySelector('[style*="--brand-primary"]') as HTMLElement | null;
          out.push({ stage: mounted.canvas.style.getPropertyValue('--brand-primary').trim().toLowerCase(), box: box ? getComputedStyle(box).backgroundColor : 'missing' });
        } finally { mounted.destroy(); source.destroy(); }
      } } finally { history.replaceState(history.state, '', address); }
      return out;
    }, { boxes: BOXES, cases: [DARK, PERSIMMON_DARK], stale: { '': 'light' } });
    assert.deepEqual(painted, [
      { stage: primary(DARK), box: rgb(primary(DARK)) },
      { stage: primary(PERSIMMON_DARK), box: rgb(primary(PERSIMMON_DARK)) },
    ]);
  });

  test('a composed child draws in the document\'s choices, and a link\'s own _themes wins for its groups', { timeout: 180_000 }, async () => {
    const result = await page.evaluate(async ({ boxes, inherited, own }) => {
      const [hosts, themes, url] = await Promise.all(['/src/lib/host-ref.ts', '/src/lib/theme-choices.ts', '/src/lib/share-privacy.ts'].map(path => import(path)));
      const host = themes.withComposeSelection(hosts.getHostRef(), () => inherited);
      const text = async (ref: { url: string } | null) => ref ? (await fetch(ref.url)).text() : 'missing';
      const plain = await text(await host.compose.render({ toolId: 'design', inputs: { boxes }, format: 'svg', width: 400, height: 240, thumbnail: false }));
      const query = url.shareUrlState([{ id: 'boxes', type: 'blocks', value: boxes }], { tokenSelection: own });
      const linked = await host.compose.renderUrl(`https://lolly.tools/tool/design.svg?${query}`, { format: 'svg', width: 400, height: 240, thumbnail: false });
      return { plain, linked: await text(linked), id: linked?.id ?? '' };
    }, { boxes: BOXES, inherited: PERSIMMON_DARK, own: { '': 'light' } });
    assert.ok(paints(result.plain, primary(PERSIMMON_DARK)), 'a child with no choices of its own inherits the document\'s');
    assert.ok(paints(result.linked, primary(PERSIMMON_LIGHT)), 'the link names light; the document still supplies the colourway');
    assert.match(decodeURIComponent(result.id), /_themes=\{"":"light"\}/, 'the link\'s own choices stay in its id');
    assert.doesNotMatch(decodeURIComponent(result.id), /persimmon/, 'inherited choices never enter the id');
  });

  test('multi-edit paints each card in its own session\'s choices', { timeout: 180_000 }, async () => {
    const cases = [DEFAULT, DARK, PERSIMMON_DARK];
    const slots = await page.evaluate(async ({ boxes, cases }) => {
      const path = '/src/lib/host-ref.ts', hosts = await import(path);
      const state = hosts.getHostRef().state;
      const out: string[] = [];
      for (const [i, choices] of cases.entries()) {
        const slot = `design:${Date.now()}${i}`;
        await state.save(slot, { boxes, __toolId: 'design', __label: `Theme probe ${i}`, ...(choices ? { __tokenSelection: choices } : {}) });
        out.push(slot);
      }
      return out;
    }, { boxes: BOXES, cases });
    await page.goto(`${origin}/#/multi?s=${slots.map(encodeURIComponent).join(',')}`);
    for (let i = 0; i < cases.length; i++) {
      await page.locator(`#me-c${i} [style*="--brand-primary"]`).first().waitFor({ state: 'attached', timeout: 120_000 });
    }
    const painted = await page.evaluate((n) => Array.from({ length: n }, (_, i) => {
      const cell = document.getElementById(`me-c${i}`)!;
      const box = cell.querySelector('[style*="--brand-primary"]') as HTMLElement;
      return { cell: cell.style.getPropertyValue('--brand-primary').trim().toLowerCase(), box: getComputedStyle(box).backgroundColor };
    }), cases.length);
    assert.deepEqual(painted, cases.map(choices => ({ cell: primary(choices), box: rgb(primary(choices)) })));
  });

  test('multi-edit composes each card\'s tool links in its own session\'s choices', { timeout: 180_000 }, async () => {
    // The same child in two sessions that differ only in light or dark: one picture
    // would mean the compose cache, or the boot host, answered for both.
    const cases = [PERSIMMON_LIGHT, PERSIMMON_DARK];
    const slots = await page.evaluate(async ({ boxes, cases }) => {
      const path = '/src/lib/host-ref.ts', hosts = await import(path);
      const out: string[] = [];
      for (const [i, choices] of cases.entries()) {
        const slot = `design:${Date.now()}c${i}`;
        await hosts.getHostRef().state.save(slot, { boxes, __toolId: 'design', __label: `Composed probe ${i}`, __tokenSelection: choices });
        out.push(slot);
      }
      return out;
    }, { boxes: COMPOSED_BOXES, cases });
    await page.goto(`${origin}/#/multi?s=${slots.map(encodeURIComponent).join(',')}`);
    const sources = await page.waitForFunction((n) => {
      const found = Array.from({ length: n }, (_, i) =>
        [...document.querySelectorAll<HTMLImageElement>(`#me-c${i} img`)].find(el => el.src.startsWith('data:image/svg'))?.src ?? null);
      return found.every(Boolean) ? found : null;
    }, cases.length, { timeout: 120_000, polling: 250 });
    const texts = await page.evaluate(async (urls) => Promise.all(urls.map(async (url) => (await fetch(url)).text())), await sources.jsonValue() as string[]);
    cases.forEach((choices, i) => {
      assert.ok(paints(texts[i]!, primary(choices)), `card ${i} composes its child in ${JSON.stringify(choices)}`);
      for (const other of telltales(choices)) assert.ok(!paints(texts[i]!, primary(other)), `card ${i} does not compose it in ${JSON.stringify(other)}`);
    });
  });

  test('a link that names some groups, in a document that made no choice, takes the design system\'s for the rest', { timeout: 180_000 }, async () => {
    // The system is set to dark Persimmon and the document chooses nothing, so it draws
    // dark Persimmon. A child link that names light alone used to come out light in the
    // canonical colourway: its choice replaced the stored one whole.
    const result = await storedPage.evaluate(async ({ boxes, own }) => {
      const [hosts, exports, embed, url] = await Promise.all(['/src/lib/host-ref.ts', '/src/pro/render-export.ts', '/src/bridge/embed.ts', '/src/lib/share-privacy.ts'].map(path => import(path)));
      const host = hosts.getHostRef();
      const text = async (u: string | null | undefined) => u ? (await fetch(u)).text() : 'missing';
      const query = url.shareUrlState([{ id: 'boxes', type: 'blocks', value: boxes }], { tokenSelection: own });
      const src = `https://lolly.tools/tool/design.svg?${query}&w=400&h=240`;
      const plain = await host.compose.render({ toolId: 'design', inputs: { boxes }, format: 'svg', width: 400, height: 240, thumbnail: false });
      // A pasted link through the shell host itself, as a picker hands it over.
      const linked = await host.compose.renderUrl(src, { format: 'svg', width: 400, height: 240, thumbnail: false });
      // The same link written into a template, on the stage of a row with no choices.
      const embedded = await embed.resolveLollyToolUrl(src, { host: exports.documentHosts(host, undefined).canvas });
      return { plain: await text(plain?.url), linked: await text(linked?.url), embedded: await text(embedded), id: linked?.id ?? '' };
    }, { boxes: BOXES, own: { '': 'light' } });
    assert.ok(paints(result.plain, primary(PERSIMMON_DARK)), 'a child with no choices draws in the stored dark Persimmon');
    for (const [name, svg] of [['the pasted link', result.linked], ['the template embed', result.embedded]] as const) {
      assert.ok(paints(svg, primary(PERSIMMON_LIGHT)), `${name} is light, and still Persimmon`);
      for (const other of telltales(PERSIMMON_LIGHT)) assert.ok(!paints(svg, primary(other)), `${name} is not ${JSON.stringify(other)}`);
    }
    assert.match(decodeURIComponent(result.id), /_themes=\{"":"light"\}/, 'the link keeps only its own choice in its id');
    assert.doesNotMatch(decodeURIComponent(result.id), /persimmon/);
  });

  test('a page render and a live template preview paint in the choices they were handed', { timeout: 240_000 }, async () => {
    const cases = [DEFAULT, DARK, PERSIMMON_LIGHT, PERSIMMON_DARK];
    const out = await page.evaluate(async ({ boxes, cases }) => {
      const [exports, hosts] = await Promise.all(['/src/pro/render-export.ts', '/src/lib/host-ref.ts'].map(path => import(path)));
      const host = hosts.getHostRef();
      const results: Array<{ page: string; stage: string; box: string }> = [];
      for (const [i, choices] of cases.entries()) {
        // A row carries its choices on itself or among a saved session's values; both are read.
        const saved = choices ? { __tokenSelection: choices } : {};
        const row = i % 2 ? { toolId: 'design', values: { boxes, ...saved } } : { toolId: 'design', values: { boxes }, ...(choices ? { tokenSelection: choices } : {}) };
        const { pages } = await exports.renderToolPages(row, host, { format: 'svg' });
        const motion = await exports.mountTemplateMotion(host, 'design', { boxes, ...saved }, { width: 400, height: 240 });
        try {
          const box = motion.canvas.querySelector('[style*="--brand-primary"]') as HTMLElement | null;
          results.push({ page: await pages[0].text(), stage: motion.canvas.style.getPropertyValue('--brand-primary').trim().toLowerCase(), box: box ? getComputedStyle(box).backgroundColor : 'missing' });
        } finally { motion.destroy(); }
      }
      return results;
    }, { boxes: BOXES, cases });
    cases.forEach((choices, i) => {
      const label = JSON.stringify(choices) ?? 'no choices';
      assert.ok(paints(out[i]!.page, primary(choices)), `renderToolPages, ${label}, paints ${primary(choices)}`);
      for (const other of telltales(choices)) assert.ok(!paints(out[i]!.page, primary(other)), `renderToolPages, ${label}, does not paint ${JSON.stringify(other)}`);
      assert.deepEqual({ stage: out[i]!.stage, box: out[i]!.box }, { stage: primary(choices), box: rgb(primary(choices)) }, `mountTemplateMotion, ${label}`);
    });
  });

  test('multi-edit composes a tool link written into a card\'s template in that session\'s choices', { timeout: 180_000 }, async () => {
    // Stationery's letter body is markdown, so `![QR](link)` puts a literal embed in the
    // template: the path views/multi-edit.ts hydrates with its own host, not the runtime's.
    const cases = [PERSIMMON_LIGHT, PERSIMMON_DARK];
    const slots = await page.evaluate(async ({ body, cases }) => {
      const path = '/src/lib/host-ref.ts', hosts = await import(path);
      const out: string[] = [];
      for (const [i, choices] of cases.entries()) {
        const slot = `stationery:${Date.now()}e${i}`;
        await hosts.getHostRef().state.save(slot, { piece: 'letterhead', body, __toolId: 'stationery', __label: `Embed probe ${i}`, __tokenSelection: choices });
        out.push(slot);
      }
      return out;
    }, { body: `![QR](${QR_CHILD})`, cases });
    await page.goto(`${origin}/#/multi?s=${slots.map(encodeURIComponent).join(',')}`);
    const sources = await page.waitForFunction((n) => {
      const found = Array.from({ length: n }, (_, i) => {
        const src = document.querySelector(`#me-c${i} img.md-image`)?.getAttribute('src') ?? '';
        return src && !src.startsWith('data:image/gif') ? src : null;
      });
      return found.every(Boolean) ? found : null;
    }, cases.length, { timeout: 120_000, polling: 250 });
    const texts = await page.evaluate(async (urls) => Promise.all(urls.map(async (url) => (await fetch(url)).text())), await sources.jsonValue() as string[]);
    cases.forEach((choices, i) => {
      assert.ok(paints(texts[i]!, primary(choices)), `card ${i} composes the embed in ${JSON.stringify(choices)}`);
      for (const other of telltales(choices)) assert.ok(!paints(texts[i]!, primary(other)), `card ${i} does not compose it in ${JSON.stringify(other)}`);
    });
  });

  test('a reopened session composes its tool links in the theme it was saved in', { timeout: 180_000 }, async () => {
    // The child link carries no theme. Its slot link carries no `_themes` either, so the
    // address only learns the session's choice after the runtime is built, and the
    // child is composed before that. It used to come out in the default theme.
    const parent = COMPOSED_BOXES;
    const slot = await page.evaluate(async ({ boxes, choices }) => {
      const path = '/src/lib/host-ref.ts', hosts = await import(path);
      const slot = `design:${Date.now()}`;
      await hosts.getHostRef().state.save(slot, { boxes, __toolId: 'design', __label: 'Composed theme probe', __tokenSelection: choices });
      return slot;
    }, { boxes: parent, choices: PERSIMMON_DARK });
    await page.goto(`${origin}/#/tool/design?slot=${encodeURIComponent(slot)}`);
    const src = await page.waitForFunction(() =>
      [...document.querySelectorAll<HTMLImageElement>('#tool-canvas img')].find(el => el.src.startsWith('data:image/svg'))?.src ?? null,
    undefined, { timeout: 120_000, polling: 250 });
    const text = await page.evaluate(async (url) => (await fetch(url)).text(), await src.jsonValue() as string);
    assert.ok(paints(text, primary(PERSIMMON_DARK)), `the child's ink is Persimmon in dark (${primary(PERSIMMON_DARK)})`);
    const others = telltales(PERSIMMON_DARK);
    assert.ok(others.length > 0, 'at least one other look gives a wrong render away');
    for (const other of others) assert.ok(!paints(text, primary(other)), `and not on ${JSON.stringify(other)}`);
  });
});
