// SPDX-License-Identifier: MPL-2.0
/**
 * The asset picker's INITIAL TAB - `PickerOpts.initialTab`.
 *
 * The picker already opened on a non-Library pane in exactly one hard-coded case (collect
 * mode → Tools). `initialTab` turns that into something a caller can ask for per add-kind,
 * which is what lets "add a tool" land on the tool grid and "add audio" land on the
 * type-filtered library. The three claims worth locking down are the ones a hard-coded
 * default never had to make:
 *   - the requested pane is the one actually SHOWING (not merely the tab that looks
 *     selected - the markup bakes Library in, so a missed switch is invisible in ARIA);
 *   - it is a DEFAULT, not a lock - the strip still works afterwards;
 *   - a tab this pick doesn't offer degrades to Library instead of opening an empty pane.
 *
 * Everything runs against the real `openPicker` in jsdom with a real (in-memory) host, so
 * "the Tools pane is open" is read off the rendered DOM.
 *
 * Run directly:  node --test shells/web/src/views/picker-initial-tab.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import type { AssetRef } from '@lolly-tools/core/host-v1';

// picker.ts imports its own stylesheet (the lazy-view pattern). Node has no idea what a
// .css module is; Vite is what resolves it for real.
registerHooks({
  load(url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) {
    if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export default {};' };
    return next(url, ctx);
  },
} as Parameters<typeof registerHooks>[0]);

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true, url: 'https://lolly.test/' });
dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
const W = dom.window as unknown as typeof globalThis & { MouseEvent: typeof MouseEvent; KeyboardEvent: typeof KeyboardEvent };
for (const k of [
  'window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'HTMLImageElement',
  'Element', 'Node', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'DOMParser',
  'getComputedStyle', 'MutationObserver', 'IntersectionObserver',
]) {
  const v = (dom.window as unknown as Record<string, unknown>)[k];
  if (v !== undefined) (globalThis as Record<string, unknown>)[k] = v;
}
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => dom.window.requestAnimationFrame(cb)) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = ((h: number) => dom.window.cancelAnimationFrame(h)) as typeof cancelAnimationFrame;
(globalThis as Record<string, unknown>).matchMedia = (q: string) =>
  ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
(globalThis as Record<string, unknown>).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
if (!(globalThis as Record<string, unknown>).IntersectionObserver) {
  (globalThis as Record<string, unknown>).IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
}

const { openPicker } = await import('./picker.ts');

// ── fixture ───────────────────────────────────────────────────────────────────

const asset = (id: string, type = 'raster'): AssetRef => ({
  id, type, url: `blob:${id}`, meta: { name: id, tags: ['photo'] },
} as unknown as AssetRef);

/** Two tools that pass isEmbeddable (exportable + an image format), so the Tools tab exists. */
const TOOLS = [
  { id: 'qr-code', name: 'QR Code', exportable: true, formats: ['svg', 'png'] },
  { id: 'chart-creator', name: 'Chart Creator', exportable: true, formats: ['svg', 'png'] },
];

function setToolIndex(tools: unknown[]): void {
  (dom.window as unknown as Record<string, unknown>).__toolIndex = { tools };
}

function makeHost(assets: AssetRef[], userAssets: AssetRef[] = []) {
  return {
    capabilities: [],
    log() {},
    profile: { get: async () => ({}), set: async () => {} },
    state: { list: async () => [], load: async () => null, save: async () => {}, delete: async () => {} },
    compose: {
      render: async () => null,
      renderUrl: async () => null,
      _describeUrl: async () => null,
    },
    assets: {
      query: async () => assets,
      get: async (id: string) => assets.find(a => a.id === id) ?? null,
      isAvailable: async () => true,
      _listUserAssets: async () => userAssets,
      _userAssetsCount: async () => 0,
      _deleteUserAsset: async () => {},
      _iconThemes: async () => [],
      _photoTreatments: async () => [],
      _uploadUserAsset: async () => {},
    },
  };
}

/** Let the picker's async render (profile + query + sessions) land. */
async function settle(): Promise<void> {
  for (let i = 0; i < 6; i++) await new Promise<void>(r => setTimeout(r, 0));
}

interface Open {
  panel: HTMLElement;
  /** data-pane of the ONE visible pane. */
  visiblePane(): string | null;
  tab(id: string): HTMLButtonElement | null;
  selectedTab(): string | null;
  close(): Promise<void>;
}

async function open(
  opts: Record<string, unknown>,
  assets: AssetRef[] = [asset('a/one'), asset('a/two')],
  userAssets: AssetRef[] = [],
): Promise<Open> {
  const done = openPicker(makeHost(assets, userAssets) as never, opts as never);
  await settle();
  const panel = dom.window.document.querySelector<HTMLElement>('.asset-picker-panel');
  assert.ok(panel, 'the picker mounted a panel');
  return {
    panel: panel!,
    visiblePane() {
      const shown = [...panel!.querySelectorAll<HTMLElement>('.asset-picker-pane')].filter(p => !p.hidden);
      assert.equal(shown.length, 1, `exactly one pane is visible (saw ${shown.length})`);
      return shown[0]!.dataset.pane ?? null;
    },
    tab: (id: string) => panel!.querySelector<HTMLButtonElement>(`.asset-picker-tab[data-tab="${id}"]`),
    selectedTab() {
      return panel!.querySelector<HTMLElement>('.asset-picker-tab[aria-selected="true"]')?.dataset.tab ?? null;
    },
    async close() {
      panel!.querySelector<HTMLButtonElement>('.asset-picker-close')!.dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
      assert.equal(await done, null, 'closing the picker resolves null');
      await settle();
    },
  };
}

test('native dismissal removes the picker and allows a fresh picker to open', async () => {
  const done = openPicker(makeHost([]) as never);
  await settle();
  const dialog = document.querySelector<HTMLDialogElement>('.asset-picker-dialog')!;
  assert.ok(dialog.open);
  assert.ok(dialog.querySelector('.asset-picker-panel'));
  dialog.dispatchEvent(new W.Event('cancel', { cancelable: true }));
  assert.equal(await done, null);
  assert.equal(document.querySelector('.asset-picker-modal'), null);
  assert.equal(document.querySelector('.asset-picker-dialog'), null);
  const next = await open({});
  await next.close();
});

test('cancelling a nested camera keeps the picker open and stops a late camera stream', async (ctx) => {
  const { openWebcamCapture } = await import('./picker-webcam.ts');
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let permit!: (stream: MediaStream) => void;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    mediaDevices: { getUserMedia: () => new Promise<MediaStream>(resolve => { permit = resolve; }) },
  } });
  ctx.after(() => { if (previous) Object.defineProperty(globalThis, 'navigator', previous); });
  const picker = await open({});
  const camera = openWebcamCapture(async () => { throw new Error('no capture expected'); }, () => {});
  document.querySelector('.webcam-capture-dialog')!.dispatchEvent(new W.Event('cancel', { cancelable: true }));
  assert.equal(await camera, null);
  assert.ok(document.querySelector<HTMLDialogElement>('.asset-picker-dialog')!.open);
  let stops = 0;
  permit({ getTracks: () => [{ stop() { stops++; } }] } as unknown as MediaStream);
  await settle();
  assert.equal(stops, 1, 'a camera granted after dismissal is immediately released');
  await picker.close();
});

// ── the requested tab opens ───────────────────────────────────────────────────

test('initialTab: tools opens ON the Tools pane, not just with the tab selected', async () => {
  setToolIndex(TOOLS);
  const p = await open({ allowUpload: true, initialTab: 'tools' });
  assert.equal(p.visiblePane(), 'tools', 'the Tools pane is the visible one');
  assert.equal(p.selectedTab(), 'tools');
  // The pane really rendered its grid - a switch that only flipped `hidden` would
  // leave the tool cards absent.
  const cards = p.panel.querySelectorAll('.asset-picker-toolgrid [data-tool-id]');
  assert.equal(cards.length, TOOLS.length, 'every embeddable tool has a card');
  await p.close();
});

test('a typed library pick opens on Library with only the matching assets rendered', async () => {
  setToolIndex(TOOLS);
  // What free-canvas sends for the Audio add-kind: type narrows the query, initialTab
  // keeps the pane on the library so the narrowed set is what the user sees.
  const audio = asset('music/bed', 'audio');
  const p = await open({ allowUpload: true, type: 'audio', initialTab: 'library' }, [audio]);
  assert.equal(p.visiblePane(), 'library');
  const ids = [...p.panel.querySelectorAll<HTMLElement>('.asset-picker-library [data-asset-id]')]
    .map(c => c.dataset.assetId);
  assert.deepEqual(ids, ['music/bed'], 'the library shows the audio asset and nothing else');
  await p.close();
});

// ── absence preserves today's behaviour ───────────────────────────────────────

test('no initialTab keeps the historical default: Library for a slot-fill pick', async () => {
  setToolIndex(TOOLS);
  const p = await open({ allowUpload: true });
  assert.equal(p.visiblePane(), 'library');
  assert.equal(p.selectedTab(), 'library');
  assert.ok(p.tab('tools'), 'the Tools tab still exists - it just is not the one open');
  await p.close();
});

test('no initialTab keeps the historical default: collect mode still opens on Tools', async () => {
  setToolIndex(TOOLS);
  const p = await open({
    allowUpload: true,
    collect: {
      folderName: 'Campaign',
      tools: TOOLS,
      onAsset: async () => true, onSession: async () => true,
      onOpenTool() {}, onQuickAddTool: async () => true,
    },
  });
  assert.equal(p.visiblePane(), 'tools');
  await p.close();
});

// ── graceful degradation ──────────────────────────────────────────────────────

test('initialTab: tools degrades to Library when this pick offers no tools', async () => {
  setToolIndex([]);                       // nothing embeddable → no Tools tab at all
  const p = await open({ allowUpload: true, initialTab: 'tools' });
  assert.equal(p.tab('tools'), null, 'there is no Tools tab to open');
  assert.equal(p.visiblePane(), 'library', 'so the pick falls back to the library');
  assert.equal(p.selectedTab(), 'library');
  await p.close();
});

test('an unknown initialTab is ignored rather than honoured into an empty pane', async () => {
  setToolIndex(TOOLS);
  const p = await open({ allowUpload: true, initialTab: 'nonsense' });
  assert.equal(p.visiblePane(), 'library');
  await p.close();
});

// ── a default, never a lock ───────────────────────────────────────────────────

test('the user can switch away from the requested tab immediately', async () => {
  setToolIndex(TOOLS);
  const p = await open({ allowUpload: true, initialTab: 'tools' });
  assert.equal(p.visiblePane(), 'tools');
  p.tab('library')!.dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
  await settle();
  assert.equal(p.visiblePane(), 'library', 'clicking Library switches to it');
  assert.equal(p.selectedTab(), 'library');
  // …and back again, so the seeded default left no one-way state behind.
  p.tab('tools')!.dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
  await settle();
  assert.equal(p.visiblePane(), 'tools');
  await p.close();
});


// ── the user rail is not all pictures ─────────────────────────────────────────

test('an untyped pick tiles only the user assets that HAVE a picture', async () => {
  setToolIndex(TOOLS);
  // The user-asset rail is universal storage: fonts, tokens and (1.73) ICC profiles
  // ride it beside uploaded images. An untyped pick used to accept every type, so a
  // profile tiled as a broken image with a delete button that removed the bytes
  // behind the Colour Lab's back.
  const mine = [
    asset('user/images/photo', 'raster'),
    asset('user/profiles/0c8a584b288a306e', 'profile'),
    asset('user/fonts/inter', 'font'),
  ];
  const p = await open({ allowUpload: true }, [], mine);
  const ids = [...p.panel.querySelectorAll<HTMLElement>('.asset-picker-card-user [data-asset-id]')]
    .map(c => c.dataset.assetId);
  assert.deepEqual(ids, ['user/images/photo'],
    `only the image tiles: ${ids.join()}`);
  assert.equal(p.panel.querySelector('[data-delete-id="user/profiles/0c8a584b288a306e"]'), null,
    'and nothing offers to delete a profile from here');
  await p.close();
});


// ── a 3-D model tile is never a blank <img> at its .glb (plan 216 item 9) ─────

test('a 3-D model with no baked still tiles as a glyph, not a broken <img> of its .glb', async () => {
  setToolIndex(TOOLS);
  const model = { id: 'Lolly/02-3d', type: 'model', url: 'blob:model.glb', meta: { name: '3D scene', tags: ['3d'] } } as unknown as AssetRef;
  const p = await open({ allowUpload: true, type: 'model' }, [model]);
  const cardHtml = p.panel.querySelector('.asset-picker-library [data-asset-id="Lolly/02-3d"]')!.outerHTML;
  assert.doesNotMatch(cardHtml, /<img[^>]+blob:model\.glb/, 'no <img> pointed at the raw .glb (that is the blank tile)');
  assert.ok(p.panel.querySelector('.asset-picker-library [data-asset-id="Lolly/02-3d"] .asset-picker-thumb-stub svg'), 'a box glyph stands in for the missing preview');
  await p.close();
});

test('a 3-D model WITH a baked still paints that still', async () => {
  setToolIndex(TOOLS);
  const model = { id: 'Lolly/03-3d', type: 'model', url: 'blob:model.glb', meta: { name: 'Posed scene', tags: ['3d'], posterUrl: 'blob:baked-still.png' } } as unknown as AssetRef;
  const p = await open({ allowUpload: true, type: 'model' }, [model]);
  const cardHtml = p.panel.querySelector('.asset-picker-library [data-asset-id="Lolly/03-3d"]')!.outerHTML;
  assert.match(cardHtml, /<img[^>]+blob:baked-still\.png/, 'the baked still is the thumbnail');
  assert.doesNotMatch(cardHtml, /blob:model\.glb/, 'and never the raw model url');
  await p.close();
});

// ── uploads live on their own "Private assets" tab, not inside the Catalog ─────

test('user uploads render on the uploads pane, not the library pane', async () => {
  setToolIndex(TOOLS);
  const mine = [asset('user/images/photo', 'raster')];
  const p = await open({ allowUpload: true }, [asset('a/one')], mine);
  assert.ok(p.tab('uploads'), 'allowUpload gives a Private assets tab');
  // The card is in the uploads pane's section, not the catalog library section.
  const inUploads = p.panel.querySelector('[data-pane="uploads"] [data-asset-id="user/images/photo"]');
  assert.ok(inUploads, 'the upload tiles in the uploads pane');
  assert.equal(p.panel.querySelector('.asset-picker-library [data-asset-id="user/images/photo"]'), null,
    'and NOT inside the catalog library section');
  // Switching to the tab shows that pane and only that pane.
  p.tab('uploads')!.dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
  await settle();
  assert.equal(p.visiblePane(), 'uploads');
  await p.close();
});

test('no uploads tab when the pick disallows upload', async () => {
  setToolIndex(TOOLS);
  const p = await open({ allowUpload: false }, [asset('a/one')]);
  assert.equal(p.tab('uploads'), null, 'no upload → no Private assets tab');
  await p.close();
});

// ── the upload classifier: code files are text assets ─────────────────────────
// APPENDED (2026-08-18): storeUserUpload's classifier claims and its ingest-time
// AI-signal note. These ride this suite for its jsdom + real-picker-module setup;
// the picker module above is already imported, so the dynamic import below is a
// cache hit, not a re-evaluation.

const { storeUserUpload } = await import('./picker.ts');
const { LEXICON_VERSION } = await import('@lolly/engine');

test('the real upload path refuses an oversized ZIP directory before storing an asset', async () => {
  const { storeZip } = await import('@lolly/engine');
  const bytes = storeZip(Array.from({ length: 801 }, (_, i) => ({ name: `${i}.txt`, bytes: new Uint8Array([65]) })));
  const { host, stored } = makeUploadHost();
  await assert.rejects(storeUserUpload(host as never, new File([bytes as BlobPart], 'many.zip'), { skipDupCheck: true }), /limit|maximum/);
  assert.equal(stored.length, 0);
});

test('dotLottie ingestion bounds image-reference expansion through the real upload path', async () => {
  const { storeZip } = await import('@lolly/engine');
  const animation = { layers: [], assets: Array.from({ length: 1001 }, () => ({ p: 'a.png', u: 'images/', e: 0 })) };
  const bytes = storeZip([{ name: 'animations/a.json', bytes: new TextEncoder().encode(JSON.stringify(animation)) }, { name: 'images/a.png', bytes: new Uint8Array([1]) }]);
  const { host, stored } = makeUploadHost();
  await assert.rejects(storeUserUpload(host as never, new File([bytes as BlobPart], 'many.lottie'), { skipDupCheck: true }), /too many image references/);
  assert.equal(stored.length, 0);
});

interface StoredRecord { id: string; type: string; format: string; meta?: Record<string, unknown> }

/** A host whose _uploadUserAsset CAPTURES the record, so a test reads what was stored. */
function makeUploadHost(): { stored: StoredRecord[]; host: unknown } {
  const stored: StoredRecord[] = [];
  return {
    stored,
    host: {
      capabilities: [],
      log() {},
      profile: { get: async () => ({}), set: async () => {} },
      state: { list: async () => [], load: async () => null, save: async () => {}, delete: async () => {} },
      assets: {
        query: async () => [],
        get: async (id: string) => ({ id, source: 'user', type: stored[0]?.type ?? 'text', format: stored[0]?.format ?? 'txt', url: 'blob:stub' }),
        isAvailable: async () => true,
        _listUserAssets: async () => [],
        _userAssetsCount: async () => stored.length,
        _deleteUserAsset: async () => {},
        _uploadUserAsset: async (r: StoredRecord) => { stored.push(r); },
      },
    },
  };
}

test('a source-code upload stores as a text asset carrying its aiSignals note from birth', async () => {
  const { stored, host } = makeUploadHost();
  const file = new File(['def main():\n    print("hello")\n'], 'script.py', { type: 'text/x-python' });
  await storeUserUpload(host as never, file);
  assert.equal(stored.length, 1, 'one record stored');
  const rec = stored[0]!;
  assert.equal(rec.type, 'text', 'code is a first-class text asset, not a bin raster');
  assert.equal(rec.format, 'py', 'format is the REAL extension');
  const sig = rec.meta?.aiSignals as Record<string, unknown> | undefined;
  assert.ok(sig, 'the AI-writing note is persisted on meta at ingest');
  assert.equal(sig.v, LEXICON_VERSION, 'keyed to the lexicon that produced it');
  assert.equal(sig.source, 'digital');
  assert.ok(['none', 'weak', 'notable', 'strong'].includes(sig.band as string), `band is a real band: ${String(sig.band)}`);
  assert.equal(typeof sig.score, 'number');
});

test('a TypeScript file stamped video/mp2t (Chromium mime map) is released to the text path', async () => {
  const { stored, host } = makeUploadHost();
  // Chromium's secondary mime mappings hand a dragged .ts over as video/mp2t. The
  // bytes are source code - no 0x47 sync at the 188-byte packet boundary, no mp4/webm
  // container magic - so the probe demotes video's MIME-only claim.
  const file = new File(['export const x: number = 1;\n'], 'component.ts', { type: 'video/mp2t' });
  await storeUserUpload(host as never, file);
  const rec = stored[0]!;
  assert.equal(rec.type, 'text', 'a mislabelled source file is text, not video');
  assert.equal(rec.format, 'ts');
  assert.ok(rec.meta?.aiSignals, 'the note rides the widened path too');
});

test('a real MPEG transport stream named .ts is never stored as text', async () => {
  const { stored, host } = makeUploadHost();
  // Sync byte 0x47 at offsets 0 and 188 - the transport-stream packet signature the
  // probe keys on. Blank MIME, so video never claims it either; it keeps today's
  // raster fall-through (and its aiSignals-free record) rather than becoming "text".
  const bytes = new Uint8Array(200);
  bytes[0] = 0x47;
  bytes[188] = 0x47;
  const file = new File([bytes], 'capture.ts', { type: '' });
  await storeUserUpload(host as never, file);
  const rec = stored[0]!;
  assert.notEqual(rec.type, 'text', 'stream bytes must not be classified as text');
  assert.equal(rec.meta?.aiSignals, undefined, 'no AI-writing note on a non-text asset');
});
