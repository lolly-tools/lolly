// SPDX-License-Identifier: MPL-2.0
/**
 * The new-asset picker's Templates tab (plans/245 scope 3).
 *
 * Two halves. The pure half exercises views/picker-templates.ts and the card that
 * renders one entry: what matches a query, what the pane says when nothing does, and
 * that a card carries both controls. The live half drives the REAL openPicker in jsdom
 * with a collect source, so "the tab lists the same entries" is read off the rendered
 * DOM, the way views/picker-initial-tab.test.ts reads its panes.
 *
 * Run directly:  node --test shells/web/src/views/picker-templates.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import { matchesPickerTemplate, templatesPaneHtml } from './picker-templates.ts';
import { templateCard, type PickerTemplate } from './picker-cards.ts';

// picker.ts imports its own stylesheet (the lazy-view pattern), which Node cannot load.
registerHooks({
  load(url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) {
    if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export default {};' };
    return next(url, ctx);
  },
} as Parameters<typeof registerHooks>[0]);

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true, url: 'https://lolly.test/' });
dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
const W = dom.window as unknown as typeof globalThis & { MouseEvent: typeof MouseEvent };
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

const { openPicker } = await import('./picker.ts');

// ── fixtures ──────────────────────────────────────────────────────────────────

const TEMPLATES: PickerTemplate[] = [
  { ref: 'user:t1', name: 'Quarterly deck', toolId: 'chart', toolName: 'Chart', own: true, description: 'Our numbers' },
  { ref: 'chart:bars', name: 'Bar chart', toolId: 'chart', toolName: 'Chart', own: false },
  { ref: 'qr-code:poster', name: 'Poster code', toolId: 'qr-code', toolName: 'QR Code', own: false },
];

const TOOLS = [
  { id: 'qr-code', name: 'QR Code', exportable: true, formats: ['svg', 'png'] },
  { id: 'chart', name: 'Chart', exportable: true, formats: ['svg', 'png'] },
];

function makeHost() {
  return {
    capabilities: [],
    log() {},
    profile: { get: async () => ({}), set: async () => {} },
    state: { list: async () => [], load: async () => null, save: async () => {}, delete: async () => {} },
    compose: { render: async () => null, renderUrl: async () => null, _describeUrl: async () => null },
    assets: {
      query: async () => [],
      get: async () => null,
      isAvailable: async () => true,
      _listUserAssets: async () => [],
      _userAssetsCount: async () => 0,
      _deleteUserAsset: async () => {},
      _iconThemes: async () => [],
      _photoTreatments: async () => [],
      _uploadUserAsset: async () => {},
    },
  };
}

/** Let the picker's async work (profile, query, sessions, the template list) finish. */
async function settle(): Promise<void> {
  for (let i = 0; i < 8; i++) await new Promise<void>(r => setTimeout(r, 0));
}

interface Opened {
  panel: HTMLElement;
  opened: string[];
  added: string[];
  tab(id: string): HTMLButtonElement | null;
  showTemplates(): void;
  cards(): HTMLElement[];
  names(): string[];
  search(text: string): Promise<void>;
  done: Promise<unknown>;
}

async function openCollect(templates: PickerTemplate[] | null = TEMPLATES): Promise<Opened> {
  (dom.window as unknown as Record<string, unknown>).__toolIndex = { tools: TOOLS };
  const opened: string[] = [];
  const added: string[] = [];
  const collect: Record<string, unknown> = {
    folderName: 'Campaign',
    tools: TOOLS,
    onAsset: async () => ({ ok: true }),
    onSession: async () => ({ ok: true }),
    onOpenTool: () => {},
    onQuickAddTool: async () => ({ ok: true }),
  };
  if (templates) {
    collect.templates = {
      list: async () => templates,
      onOpen: (ref: string) => { opened.push(ref); },
      onQuickAdd: async (ref: string) => { added.push(ref); return { ok: true }; },
    };
  }
  const done = openPicker(makeHost() as never, { collect } as never);
  await settle();
  const panel = dom.window.document.querySelector<HTMLElement>('.asset-picker-panel');
  assert.ok(panel, 'the picker mounted a panel');
  const pane = (): HTMLElement | null => panel!.querySelector<HTMLElement>('.asset-picker-pane[data-pane="templates"]');
  return {
    panel: panel!,
    opened,
    added,
    tab: (id) => panel!.querySelector<HTMLButtonElement>(`.asset-picker-tab[data-tab="${id}"]`),
    showTemplates() {
      panel!.querySelector<HTMLButtonElement>('.asset-picker-tab[data-tab="templates"]')!
        .dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
    },
    cards: () => [...(pane()?.querySelectorAll<HTMLElement>('[data-template-ref]') ?? [])],
    names: () => [...(pane()?.querySelectorAll<HTMLElement>('.asset-picker-name') ?? [])].map(el => el.textContent ?? ''),
    async search(text: string) {
      const field = panel!.querySelector<HTMLInputElement>('.asset-picker-search')!;
      field.value = text;
      field.dispatchEvent(new W.Event('input', { bubbles: true }));
      await settle();
      await new Promise<void>(r => setTimeout(r, 250));   // the shared search debounce
    },
    done,
  };
}

// ── the pure half ─────────────────────────────────────────────────────────────

test('a query matches a template by name, description, tool name or tool id', () => {
  const [own, bars] = [TEMPLATES[0]!, TEMPLATES[1]!];
  assert.equal(matchesPickerTemplate(own, ''), true, 'no query keeps everything');
  assert.equal(matchesPickerTemplate(own, 'quarterly'), true);
  assert.equal(matchesPickerTemplate(own, 'numbers'), true, 'the description is searched');
  assert.equal(matchesPickerTemplate(bars, 'chart'), true, 'so is the tool');
  assert.equal(matchesPickerTemplate(bars, 'qr'), false);
  assert.equal(matchesPickerTemplate(own, 'quarterly chart'), true, 'tokens are ANDed');
  assert.equal(matchesPickerTemplate(own, 'quarterly poster'), false);
});

test('the pane says what it is doing: loading, empty, no matches, or the grid', () => {
  assert.match(templatesPaneHtml(null, ''), /asset-picker-loading/, 'null is "still loading"');
  assert.match(templatesPaneHtml([], ''), /No templates yet/, 'nothing saved reads as an invitation');
  assert.match(templatesPaneHtml(TEMPLATES, 'zzz'), /No templates match/, 'a dead query says so');
  const html = templatesPaneHtml(TEMPLATES, '');
  assert.match(html, /asset-picker-toolgrid/, 'the grid is the Tools pane\'s grid, so the two panes match');
  assert.equal(html.match(/data-template-ref=/g)?.length, 3, 'one card per template');
});

test('a template card carries both intents, and names its tool', () => {
  const card = templateCard(TEMPLATES[0]!, true);
  assert.match(card, /data-template-ref="user:t1"/, 'the primary opens the tool seeded from it');
  assert.match(card, /data-quickadd-template="user:t1"/, 'and "+ Add" files a project without opening');
  assert.match(card, /Quarterly deck/);
  assert.match(card, /Chart/, 'the tool is on the card, since the tab spans every tool');
  assert.doesNotMatch(templateCard(TEMPLATES[0]!, false), /data-quickadd-template/,
    'outside a collect flow there is nothing to add to');
});

// ── the live half ─────────────────────────────────────────────────────────────

test('the picker grows a Templates tab only when the caller has templates to offer', async () => {
  const withOut = await openCollect(null);
  assert.equal(withOut.tab('templates'), null, 'no source, no tab');
  assert.equal(withOut.panel.querySelector('.asset-picker-pane[data-pane="templates"]'), null, 'and no pane');
  withOut.panel.querySelector<HTMLButtonElement>('.asset-picker-close')!.dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
  await withOut.done;
  await settle();

  const picker = await openCollect();
  assert.ok(picker.tab('templates'), 'the tab is there');
  assert.equal(picker.tab('templates')!.textContent, 'Templates');
  assert.equal(picker.tab('tools')!.compareDocumentPosition(picker.tab('templates')!) & 4, 4,
    'and it follows Tools - a blank tool is the common intent');
  picker.panel.querySelector<HTMLButtonElement>('.asset-picker-close')!.dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
  await picker.done;
  await settle();
});

test('the tab lists the source\'s entries, filters with the search field, and acts on a pick', async () => {
  const picker = await openCollect();
  picker.showTemplates();
  assert.deepEqual(picker.names(), ['Quarterly deck', 'Bar chart', 'Poster code'],
    'every template the source offers, in its order (yours first)');

  await picker.search('poster');
  assert.deepEqual(picker.names(), ['Poster code'], 'the field filters the pane it is over');
  await picker.search('');

  const quick = picker.panel.querySelector<HTMLElement>('[data-quickadd-template="chart:bars"]')!;
  quick.dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
  await settle();
  assert.deepEqual(picker.added, ['chart:bars'], '"+ Add" files a project from that template');
  assert.ok(picker.panel.isConnected, 'and the dialog stays open for another add');

  picker.panel.querySelector<HTMLElement>('[data-template-ref="user:t1"]')!
    .dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
  await settle();
  assert.deepEqual(picker.opened, ['user:t1'], 'the card itself opens the tool seeded from the template');
  assert.equal(await picker.done, null, 'which navigates, so the picker closes');
  await settle();
});
