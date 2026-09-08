// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { previewContextSignature } from '../lib/preview-context.ts';
const previewSig = async (values: unknown) => JSON.stringify([values, await previewContextSignature({} as Parameters<typeof previewContextSignature>[0])]);
import { openTemplateChooser, parseTemplates, templateValuesById } from './template-chooser.ts';

test('template chooser modal layers above the portalled edge dock', () => {
  const css = readFileSync(new URL('../styles/template-chooser.css', import.meta.url), 'utf8');
  const backdrop = css.match(/\.tmpl-chooser-backdrop\s*\{[^}]*\}/)?.[0] ?? '';
  const panel = css.match(/\.tmpl-chooser-panel\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(backdrop, /z-index:\s*100001/, 'the scrim covers the dock and blocks its controls');
  assert.match(panel, /z-index:\s*100002/, 'the dialog stays above its scrim');
});

test('template preset chips remain legible and touch-sized on mobile', () => {
  const css = readFileSync(new URL('../styles/template-chooser.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /font-size:\s*calc\(9px/, 'preset labels no longer render at 9px');
  const mobile = css.slice(css.lastIndexOf('@media (max-width: 640px)'));
  const preset = mobile.match(/\.tmpl-chooser-preset\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(preset, /min-height:\s*44px/, 'preset buttons meet the mobile touch target');
  assert.match(preset, /font-size:\s*var\(--fs-sm\)/, 'preset labels use the chrome type scale');
  assert.ok(
    css.lastIndexOf('@media (max-width: 640px)') > css.indexOf('.tmpl-chooser-preset {'),
    'responsive overrides come after equal-specificity base rules',
  );
});

// A manifest `templates[]` as it arrives off the loaded manifest (typed unknown[]).
const RAW = [
  {
    id: 'poster',
    name: 'Poster',
    category: 'Poster',
    description: 'One frame filling the canvas.',
    values: { boxes: [{ id: 'frame', kind: 'frame', x: 0, y: 0, w: 1080, h: 1080 }] },
  },
  {
    id: 'carousel',
    name: 'Carousel',
    category: 'Carousel',
    values: {
      boxes: [
        { id: 'slide1', kind: 'frame', x: 0 },
        { id: 'slide2', kind: 'frame', x: 1120 },
        { id: 'slide3', kind: 'frame', x: 2240 },
      ],
    },
  },
];

test('parseTemplates: keeps well-formed entries and their full values seed', () => {
  const parsed = parseTemplates(RAW);
  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed.map(t => t.id), ['poster', 'carousel']);
  assert.equal(parsed[0]!.name, 'Poster');
  assert.equal(parsed[0]!.category, 'Poster');
  // values passes through verbatim - any size, read directly into the fresh session.
  const boxes = (parsed[1]!.values.boxes as unknown[]);
  assert.equal(boxes.length, 3);
});

test('parseTemplates: drops malformed entries rather than throwing', () => {
  const parsed = parseTemplates([
    { id: 'ok', name: 'OK', values: {} },
    { name: 'no-id', values: {} },      // missing id
    { id: 'no-name', values: {} },      // missing name
    { id: 'dup', name: 'A', values: {} },
    { id: 'dup', name: 'B', values: {} }, // duplicate id - first wins
    null,
    'nonsense',
    { id: 'bad-values', name: 'Bad', values: [1, 2] }, // array values → {}
  ]);
  assert.deepEqual(parsed.map(t => t.id), ['ok', 'dup', 'bad-values']);
  assert.equal(parsed.find(t => t.id === 'dup')!.name, 'A');
  assert.deepEqual(parsed.find(t => t.id === 'bad-values')!.values, {});
});

test('parseTemplates: metadata-only entries (from the synced index, NO values) parse with an empty seed', () => {
  // The index now carries id/name/category/description/thumb only - the heavy `values`
  // is fetched on demand. Such entries must still populate the chooser grid.
  const parsed = parseTemplates([
    { id: 'poster', name: 'Poster', category: 'Poster', description: 'A poster.' },
    { id: 'video', name: 'Video', category: 'Video', thumb: '/tools/x/t.svg' },
  ]);
  assert.deepEqual(parsed.map(t => t.id), ['poster', 'video']);
  assert.deepEqual(parsed[0]!.values, {}, 'no inline values → empty seed (fetched later)');
  assert.equal(parsed[0]!.category, 'Poster');
  assert.equal(parsed[1]!.thumb, '/tools/x/t.svg');
});

test('parseTemplates: non-array input is empty (a tool without templates[])', () => {
  assert.deepEqual(parseTemplates(undefined), []);
  assert.deepEqual(parseTemplates(null), []);
  assert.deepEqual(parseTemplates({}), []);
});

test('templateValuesById: resolves the reserved ?template=<id> seed, null on miss', () => {
  const seed = templateValuesById(RAW, 'carousel');
  assert.ok(seed);
  assert.equal((seed!.boxes as unknown[]).length, 3);
  assert.equal(templateValuesById(RAW, 'nope'), null);
  assert.equal(templateValuesById(undefined, 'poster'), null);
});

// ── Eager preview enqueue on open ────────────────────────────────────────────
// Regression guard for the "tiles show only glyphs" defect: the preview drain must
// NOT be gated solely on the IntersectionObserver firing. Here the IO is stubbed to
// NEVER deliver an intersecting entry, yet on open every non-blank template must still
// be enqueued and drained. If the drain were IO-gated (the old code), zero previews
// would be requested and the tiles would stay glyphs.
//
// No module mocking (the harness runs without --experimental-test-module-mocks): the
// REAL renderFeaturedVariant runs, driven down its cache-HIT branch by a stub
// host.previews.get that returns a matching entry - so it returns a thumbnail instantly
// without loading the engine, and this also exercises the real keyPrefix='template'
// cache-key + fall-through (no early null return). Spying on get() proves each template
// was enqueued: renderVariantAt calls get exactly once per drained template.

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
// finish() restores focus to the opener via an `instanceof HTMLElement` check - only the
// tests that actually settle the chooser (close/select) reach it.
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.MutationObserver = dom.window.MutationObserver;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.CSS = (dom.window.CSS ?? {}) as unknown as typeof globalThis.CSS;
if (typeof (globalThis.CSS as { escape?: unknown })?.escape !== 'function') {
  (globalThis.CSS as unknown as { escape: (s: string) => string }) = { escape: (s) => s };
}
globalThis.matchMedia = ((q: string) => ({
  matches: false, media: q, addEventListener() {}, removeEventListener() {},
  addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false,
})) as unknown as typeof globalThis.matchMedia;
// A stub that RECORDS observed tiles but NEVER invokes the callback → proves previews
// do not depend on the IO firing.
const observed: string[] = [];
globalThis.IntersectionObserver = class {
  constructor(_cb: unknown, _opts?: unknown) {}
  observe(el: Element) { observed.push((el as HTMLElement).dataset?.templateId ?? ''); }
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
} as unknown as typeof globalThis.IntersectionObserver;

const THUMB = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';

test('openTemplateChooser: eagerly renders a preview for every non-blank template even when the IntersectionObserver never fires', async () => {
  observed.length = 0;
  const inline: Record<string, Record<string, unknown>> = {
    poster: { boxes: [{ id: 'a' }] },
    carousel: { boxes: [{ id: 'b' }] },
  };
  const templates = parseTemplates([
    { id: 'poster', name: 'Poster', category: 'Poster', values: inline.poster },
    { id: 'carousel', name: 'Carousel', category: 'Carousel', values: inline.carousel },
  ]);
  // Spy host: previews.get records the cache key the drain probes for each template, and
  // returns a HIT (sig === JSON.stringify(values)) so renderFeaturedVariant returns THUMB
  // without importing the render engine.
  const getKeys: string[] = [];
  const host = {
    previews: {
      get: async (key: string) => {
        getKeys.push(key);
        const id = key.match(/^template:design:(.+):svg$/)?.[1];
        const values = id ? inline[id] : undefined;
        return values ? { sig: await previewSig(values), thumb: THUMB } : null;
      },
      put: async () => {},
    },
  } as never;

  // Fire-and-forget: the returned promise only settles on select/close, which we never do.
  void openTemplateChooser({
    toolName: 'Design', toolId: 'design', templates, host, formats: ['svg', 'png'],
  });
  // Drain is serial + async (dynamic import of featured-render, then per-template render).
  for (let i = 0; i < 200 && getKeys.length < 2; i++) await new Promise(r => setTimeout(r, 0));

  // Both templates were drained (get probed once each) - vector-first svg key, 'template'
  // namespace - and none for the Blank tile.
  assert.deepEqual(
    getKeys.slice().sort(),
    ['template:design:carousel:svg', 'template:design:poster:svg'],
    'both non-blank templates were enqueued + drained (get probed per template)',
  );
  // The IO was still wired for off-screen prioritisation, but it never fired - so the
  // previews above are attributable solely to the eager enqueue.
  assert.ok(observed.includes('poster') && observed.includes('carousel'), 'tiles are still observed');
  assert.ok(!observed.includes('__blank__'), 'the Blank tile is never observed');

  // And the rendered thumbnail was actually swapped into each tile's media slot.
  await new Promise(r => setTimeout(r, 0));
  const img = document.querySelector<HTMLImageElement>(
    '.tmpl-chooser-tile[data-template-id="poster"] .tmpl-chooser-tile-media img.tmpl-chooser-tile-thumb',
  );
  assert.ok(img && img.src === THUMB, 'the live preview <img> replaced the glyph');
  document.querySelector<HTMLButtonElement>('.tmpl-chooser-close')?.click();
});

test('openTemplateChooser: refreshes previews when the mounted brand scope arrives late', async () => {
  document.body.innerHTML = '<div id="tool-content"></div>';
  const brandRoot = document.getElementById('tool-content')!;
  const values = { boxes: [{ id: 'a' }] };
  const templates = parseTemplates([{ id: 'poster', name: 'Poster', values }]);
  const brandThumb = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"><rect fill="red"/></svg>';
  const getKeys: string[] = [];
  const host = {
    previews: {
      get: async (key: string) => {
        getKeys.push(key);
        if (key.startsWith('template:')) {
          brandRoot.style.setProperty('--brand-primary', '#d40000');
        }
        return {
          sig: await previewSig(values),
          thumb: key.startsWith('template@') ? brandThumb : THUMB,
        };
      },
      put: async () => {},
    },
  } as never;

  void openTemplateChooser({
    toolName: 'Design', toolId: 'design', templates, host, formats: ['svg'],
  });
  for (let i = 0; i < 200 && !getKeys.some((key) => key.startsWith('template@')); i++) {
    await new Promise(r => setTimeout(r, 0));
  }
  assert.ok(getKeys.some((key) => key.startsWith('template@')), 'the new brand gets its own preview namespace');
  const img = document.querySelector<HTMLImageElement>('.tmpl-chooser-tile-media img');
  assert.equal(img?.src, brandThumb, 'the late neutral result cannot overwrite the brand-correct preview');
  document.querySelector<HTMLButtonElement>('.tmpl-chooser-close')?.click();
});

// ── The drain shares the main thread with a live mount ───────────────────────
// views/tool.ts no longer awaits this chooser: the tool mounts UNDERNEATH the modal.
// So each preview - a real off-screen mount + walker export, ~1 s apiece - must yield
// before it runs, or it starves exactly the first paint the change exists to let through
// and holds a tile click behind however many renders are still queued.

test('openTemplateChooser: yields to idle before the render chunk and between renders', async () => {
  const idleTimeouts: (number | undefined)[] = [];
  const realRic = (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback;
  (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback =
    (cb: () => void, opts?: { timeout: number }) => { idleTimeouts.push(opts?.timeout); setTimeout(cb, 0); return 0; };
  try {
    const inline: Record<string, Record<string, unknown>> = { a: { boxes: [] }, b: { boxes: [] } };
    const templates = parseTemplates([
      { id: 'a', name: 'A', values: inline.a },
      { id: 'b', name: 'B', values: inline.b },
    ]);
    const getKeys: string[] = [];
    let idleBeforeFirstRender = -1;
    const host = {
      previews: {
        get: async (key: string) => {
          if (!getKeys.length) idleBeforeFirstRender = idleTimeouts.length;
          getKeys.push(key);
          const id = key.match(/^template:t:(.+):svg$/)?.[1];
          const values = id ? inline[id] : undefined;
          return values ? { sig: await previewSig(values), thumb: THUMB } : null;
        },
        put: async () => {},
      },
    } as never;

    void openTemplateChooser({ toolName: 'T', toolId: 't', templates, host, formats: ['svg'] });
    for (let i = 0; i < 200 && getKeys.length < 2; i++) await new Promise(r => setTimeout(r, 0));

    assert.equal(getKeys.length, 2, 'both templates still render - the yield defers, it never drops');
    assert.ok(idleBeforeFirstRender >= 1,
      'the first render waits for an idle gap (so the render-engine chunk is not even fetched during the mount burst)');
    assert.ok(idleTimeouts.length >= 2, 'and a second yield separates the two renders');
    assert.ok(idleTimeouts.every(t => typeof t === 'number' && t > 0),
      'every yield carries a timeout, so a permanently busy tab still shows its previews');
    document.querySelector<HTMLButtonElement>('.tmpl-chooser-close')?.click();
  } finally {
    if (realRic === undefined) delete (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback;
    else (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback = realRic;
  }
});

test('openTemplateChooser: settling cancels the rest of the preview queue', async () => {
  // Picking a tile (or closing) hands the mount its seed - every preview still queued is
  // now work nobody will see, competing with the render that seed is about to trigger.
  const inline: Record<string, Record<string, unknown>> = { a: { boxes: [] }, b: { boxes: [] }, c: { boxes: [] } };
  const templates = parseTemplates(
    ['a', 'b', 'c'].map(id => ({ id, name: id.toUpperCase(), values: inline[id] })),
  );
  const getKeys: string[] = [];
  const host = {
    previews: {
      get: async (key: string) => {
        getKeys.push(key);
        // Close the chooser DURING the first render - deterministic, no timing race.
        if (getKeys.length === 1) document.querySelector<HTMLElement>('.tmpl-chooser-close')!.click();
        const id = key.match(/^template:t2:(.+):svg$/)?.[1];
        const values = id ? inline[id] : undefined;
        return values ? { sig: await previewSig(values), thumb: THUMB } : null;
      },
      put: async () => {},
    },
  } as never;

  const seed = await openTemplateChooser({ toolName: 'T', toolId: 't2', templates, host, formats: ['svg'] });
  assert.deepEqual(seed, {}, 'closing resolves a blank seed');
  for (let i = 0; i < 50; i++) await new Promise(r => setTimeout(r, 0));
  assert.equal(getKeys.length, 1, 'the queued b/c previews were abandoned the moment the chooser settled');
  document.querySelector<HTMLButtonElement>('.tmpl-chooser-close')?.click();
});

// ── onOpen: the navigate-away close handle ───────────────────────────────────
// views/tool.ts never awaits this chooser, so it is the only thing that can reach
// back into an already-open modal when the view underneath is torn down first - see
// tool-template-mount.test.ts for the wiring on the caller's side.

test('openTemplateChooser: onOpen hands back a close that removes the modal and resolves blank', async () => {
  const templates = parseTemplates([{ id: 'poster', name: 'Poster', values: { boxes: [] } }]);
  let close: (() => void) | undefined;
  const opener = document.createElement('button');
  document.body.appendChild(opener);
  opener.focus();

  const pick = openTemplateChooser({
    toolName: 'T', toolId: 't3', templates,
    onOpen: c => { close = c; },
  });

  assert.equal(typeof close, 'function', 'onOpen fired synchronously with a close handle');
  assert.ok(document.querySelector('.tmpl-chooser-modal'), 'the modal is in the document while open');

  close!();
  assert.deepEqual(await pick, {}, 'a forced close resolves exactly like Escape/backdrop/×');
  assert.equal(document.querySelector('.tmpl-chooser-modal'), null, 'and takes the modal out of the document');

  // Idempotent both ways: calling close again, or a tile click racing in afterward,
  // must not double-resolve or throw - the same guarantee a stray Escape already had.
  assert.doesNotThrow(() => close!());
  opener.remove();
});

test('openTemplateChooser: a pick that lands first makes a later close a no-op', async () => {
  // The inverse race: the user actually chose a tile (or Escaped) before any navigation.
  // The close handle onOpen armed must not resolve the promise a second time, or a
  // caller storing it (views/tool.ts's templatePickClose) could stomp a real selection.
  const templates = parseTemplates([{ id: 'poster', name: 'Poster', values: { boxes: [1] } }]);
  let close: (() => void) | undefined;
  const pick = openTemplateChooser({ toolName: 'T', toolId: 't4', templates, onOpen: c => { close = c; } });
  document.querySelector<HTMLElement>('.tmpl-chooser-close')!.click();   // settles it blank, for real
  assert.deepEqual(await pick, {});
  assert.doesNotThrow(() => close!());   // arriving after settle - must not throw or re-resolve
});

test('openTemplateChooser: with no host it renders glyph tiles and requests NO previews', async () => {
  const getKeys: string[] = [];
  const templates = parseTemplates([{ id: 'poster', name: 'Poster', values: { boxes: [] } }]);
  // No host → the whole preview block is skipped; a glyph tile is the graceful fallback.
  void openTemplateChooser({ toolName: 'Design', toolId: 'design', templates });
  await new Promise(r => setTimeout(r, 10));
  assert.equal(getKeys.length, 0, 'offline (no host) never renders a live preview');
  const tile = document.querySelector('.tmpl-chooser-tile[data-template-id="poster"] .tmpl-chooser-tile-icon');
  assert.ok(tile, 'a glyph icon is shown as the fallback media');
  document.querySelector<HTMLButtonElement>('.tmpl-chooser-close')?.click();
});

// ── Surface 1: user-template-only tools populate the chooser ──────────────────
// views/tool.ts merges each saved UserTemplate as a TemplateVariant under the
// "Your templates" category (their values ride inline). The chooser must render those
// tiles like any other, so a tool whose ONLY starting points are user-saved is reachable.

test('openTemplateChooser: renders a user template (category "Your templates") as an ordinary tile', async () => {
  // Zero built-in templates, one user-saved one - exactly what a user-template-only tool
  // hands the chooser. No host, so the glyph-tile fallback stands in for a live preview.
  const templates = parseTemplates([
    { id: 'ut-1', name: 'My saved deck', category: 'Your templates', values: { boxes: [{ id: 'a' }] } },
  ]);
  void openTemplateChooser({ toolName: 'Design', toolId: 'design', templates });
  await new Promise(r => setTimeout(r, 0));
  assert.ok(document.querySelector('.tmpl-chooser-modal'), 'the chooser opened for a user-template-only set');
  const tile = document.querySelector<HTMLElement>('.tmpl-chooser-tile[data-template-id="ut-1"]');
  assert.ok(tile, 'the user template renders as a tile');
  assert.equal(tile!.dataset.category, 'Your templates', 'grouped under the Your templates category');
  assert.match(tile!.textContent ?? '', /My saved deck/, 'shows the saved template name');
  document.querySelector<HTMLButtonElement>('.tmpl-chooser-close')?.click();
});

test('openTemplateChooser: "Your templates" shows as a filter chip beside built-in categories', async () => {
  // Built-in + user templates → more than one category → the filter chip bar renders, with
  // "Your templates" among the chips (a single-category set has nothing to filter, so no bar).
  const templates = parseTemplates([
    { id: 'poster', name: 'Poster', category: 'Poster', values: { boxes: [] } },
    { id: 'ut-1', name: 'My saved deck', category: 'Your templates', values: { boxes: [] } },
  ]);
  void openTemplateChooser({ toolName: 'Design', toolId: 'design', templates });
  await new Promise(r => setTimeout(r, 0));
  const chips = Array.from(document.querySelectorAll<HTMLElement>('.tmpl-chooser-filter')).map(c => c.dataset.filter);
  assert.ok(chips.includes('Your templates'), 'a Your templates filter chip is present alongside the built-in one');
  document.querySelector<HTMLButtonElement>('.tmpl-chooser-close')?.click();
});

// ── Presets (plans/142): a template's curated variants ───────────────────────

test('parseTemplates: carries well-formed presets and drops malformed ones', () => {
  const parsed = parseTemplates([
    {
      id: 'poster', name: 'Poster', values: { w: 1080 },
      presets: [
        { id: 'story', name: 'Story', values: { w: 1080, h: 1920 } },
        { id: 'story', name: 'Dup id', values: {} },          // duplicate id - first wins
        { name: 'no-id', values: {} },                        // dropped
        { id: 'no-name', values: {} },                        // dropped
        { id: 'meta-only', name: 'Meta only' },               // metadata-only → values {}
      ],
    },
    { id: 'plain', name: 'Plain', values: {} },               // no presets → key absent
  ]);
  const poster = parsed.find(v => v.id === 'poster')!;
  assert.deepEqual(poster.presets!.map(p => p.id), ['story', 'meta-only']);
  assert.equal(poster.presets![0]!.name, 'Story', 'first id wins on a duplicate');
  assert.deepEqual(poster.presets![1]!.values, {}, 'a metadata-only preset parses with an empty overlay');
  assert.equal(parsed.find(v => v.id === 'plain')!.presets, undefined);
});

test('templateValuesById: merges the named preset overlay over the base (shallow, preset wins)', () => {
  const raw = [{
    id: 'poster', name: 'Poster', values: { w: 1080, h: 1080, bg: '#fff' },
    presets: [{ id: 'story', name: 'Story', values: { h: 1920 } }],
  }];
  assert.deepEqual(templateValuesById(raw, 'poster'), { w: 1080, h: 1080, bg: '#fff' }, 'no preset → base alone');
  assert.deepEqual(templateValuesById(raw, 'poster', 'story'), { w: 1080, h: 1920, bg: '#fff' },
    'the overlay replaces per input id and the rest of the base survives');
  assert.deepEqual(templateValuesById(raw, 'poster', 'nope'), { w: 1080, h: 1080, bg: '#fff' },
    'an unknown preset id applies the base alone - a stale link still opens something sensible');
  assert.equal(templateValuesById(raw, 'missing', 'story'), null, 'an unknown template id stays null');
});

test('openTemplateChooser: preset chips render inside the tile and pick base + overlay', async () => {
  const templates = parseTemplates([{
    id: 'poster', name: 'Poster', values: { w: 1080, h: 1080 },
    presets: [{ id: 'story', name: 'Story', values: { h: 1920 } }],
  }]);
  const pick = openTemplateChooser({ toolName: 'Design', toolId: 'design', templates });
  await new Promise(r => setTimeout(r, 0));
  const tile = document.querySelector<HTMLElement>('.tmpl-chooser-tile[data-template-id="poster"]');
  assert.ok(tile, 'the template tile renders');
  assert.equal(tile!.getAttribute('role'), 'button', 'a tile with chips is a div[role=button], never nested buttons');
  const chip = tile!.querySelector<HTMLButtonElement>('.tmpl-chooser-preset[data-preset-id="story"]');
  assert.ok(chip, 'the preset chip renders inside the tile');
  chip!.click();
  assert.deepEqual(await pick, { w: 1080, h: 1920 }, 'chip pick = base merged with the preset overlay');
});

test('openTemplateChooser: the tile itself still picks the template BASE when chips are present', async () => {
  const templates = parseTemplates([{
    id: 'poster', name: 'Poster', values: { w: 1080, h: 1080 },
    presets: [{ id: 'story', name: 'Story', values: { h: 1920 } }],
  }]);
  const pick = openTemplateChooser({ toolName: 'Design', toolId: 'design', templates });
  await new Promise(r => setTimeout(r, 0));
  document.querySelector<HTMLElement>('.tmpl-chooser-tile[data-template-id="poster"] .tmpl-chooser-tile-name')!.click();
  assert.deepEqual(await pick, { w: 1080, h: 1080 }, 'a click outside the chips is the base pick');
});
