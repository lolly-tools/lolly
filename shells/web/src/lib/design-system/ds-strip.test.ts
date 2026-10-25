// SPDX-License-Identifier: MPL-2.0
/**
 * lib/design-system/ds-strip.ts: the design systems strip on the Settings
 * Design system tab. Pinned here: the APG toolbar (one tab stop, arrows that
 * move and never switch, RTL), the in-place switch with Undo, the busy state
 * that keeps the focus, the one remount a base change needs, and names drawn
 * before any cover has been read.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/design-system/ds-strip.test.ts
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><button id="outside">outside</button></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.CustomEvent = dom.window.CustomEvent as unknown as typeof CustomEvent;
globalThis.Event = dom.window.Event as unknown as typeof Event;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
// jsdom lays nothing out and has no scrollIntoView; record what the strip asks for.
const scrolled: Array<{ id: string | undefined; opts: unknown }> = [];
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView(o: unknown): void }).scrollIntoView = function (this: HTMLElement, opts: unknown) {
  scrolled.push({ id: this.dataset.dsId, opts });
};

const { mountDsStrip } = await import('./ds-strip.ts');
const { DESIGN_SYSTEM_CHANGED_EVENT } = await import('./switch.ts');
const { flushUndoToasts } = await import('../undo-toast.ts');
const { colourCountOf, PREVIEW_HEAD_RETRY_MS } = await import('./preview.ts');

type Doc = Record<string, unknown>;
const fixture = (rel: string): Doc => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8')) as Doc;
const DEMO = fixture('../../../../../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json');
const START = fixture('../../../../../brands/lolly-start/catalog/assets/lolly/tokens/brand.json');

interface Rec {
  id: string; label: string; ns: string; headId: string; locked: boolean; createdAt: number; lastUsedAt: number;
  source: Record<string, unknown>;
}
const rec = (id: string, label: string, extra: Partial<Rec> = {}): Rec => ({
  id, label, ns: `user/ds/${id}/`, headId: `user/ds/${id}/tokens/brand`, source: { kind: 'local', from: 'app' }, locked: false, createdAt: 1, lastUsedAt: 1, ...extra,
});
const DEMO_REC = rec('shipped', 'Lolly Demo', { ns: '', headId: 'lolly/tokens/demo', source: { kind: 'shipped' } });
const STARTER_REC = rec('lolly-starter', 'Lolly Starter');
const ACME_REC = rec('acme', 'Acme', { locked: true });
const HOSTED_REC = rec('hosted', 'Hosted', { source: { kind: 'hosted', instance: 'https://brand.example', packUrl: null, signature: 'verified' } });

/** The doc each head holds. */
const heads: Record<string, Doc> = { 'lolly/tokens/demo': DEMO };
const docFor = (headId: string): Doc => heads[headId] ?? START;

/**
 * A registry over `records`. `holdSwitch` and `holdReads` keep setActive and
 * the head reads waiting until the test releases them.
 */
function hostFor(records: Rec[], activeId = records[0]!.id) {
  const state = {
    current: activeId,
    switched: [] as string[],
    reads: [] as string[],
    holdSwitch: false,
    holdReads: false,
    failSwitch: null as Error | null,
    gates: [] as Array<() => void>,
    release(): void { for (const go of state.gates.splice(0)) go(); },
  };
  const wait = (): Promise<void> => new Promise<void>(resolve => state.gates.push(resolve));
  const host = {
    designSystems: {
      list: async () => [...records],
      visible: async () => [...records],
      activeId: async () => state.current,
      active: async () => records.find(r => r.id === state.current)!,
      setActive: async (id: string) => {
        if (state.holdSwitch) await wait();
        if (state.failSwitch) throw state.failSwitch;
        state.current = id;
        state.switched.push(id);
      },
      bust: () => {},
    },
    assets: {
      _getBlob: async (id: string) => {
        state.reads.push(id);
        if (state.holdReads) await wait();
        return new Blob([JSON.stringify(docFor(id))]);
      },
      get: async (id: string) => ({ url: `/catalog/${id}.svg` }),
    },
  };
  return { host, state };
}

const settle = async (): Promise<void> => { for (let i = 0; i < 30; i++) await new Promise(resolve => setTimeout(resolve, 0)); };

/** A cover for the active system, as the tab draws it from what it already read. */
const activeCover = (label: string) => ({
  label, monogram: label[0]!, display: 'var(--font-display, var(--font-brand))', colors: ['#033633', '#008657'], colorCount: 33, colourways: 6,
  looks: { light: { surface: '#ffffff', ink: '#09141a', primary: '#033633', onPrimary: '#ffffff', secondary: '#008657' } },
  logos: {},
});

const teardowns: Array<() => void> = [];
const remounts: Event[] = [];
const onRemount = (e: Event): void => { remounts.push(e); };
window.addEventListener('lolly:remount', onRemount);

function mount(records: Rec[], opts: { activeId?: string; withRecords?: boolean; switchOptions?: Record<string, unknown> } = {}) {
  const { host, state } = hostFor(records, opts.activeId);
  const el = document.createElement('div');
  el.className = 'ds-strip';
  el.setAttribute('data-ds-strip', '');
  el.hidden = true;
  document.body.append(el);
  const activeId = opts.activeId ?? records[0]!.id;
  const strip = mountDsStrip(el, host as never, {
    activeId,
    activeCover: activeCover(records.find(r => r.id === activeId)?.label ?? ''),
    ...(opts.withRecords === false ? {} : { records: records as never }),
    ...(opts.switchOptions ? { switchOptions: opts.switchOptions as never } : {}),
  });
  // Stand in for the tab: a switch made anywhere redraws the strip in place.
  const onChanged = (e: Event): void => {
    const id = (e as CustomEvent<{ id: string }>).detail.id;
    void strip.refresh(id, activeCover(records.find(r => r.id === id)?.label ?? ''), records as never);
  };
  window.addEventListener(DESIGN_SYSTEM_CHANGED_EVENT, onChanged);
  teardowns.push(() => { window.removeEventListener(DESIGN_SYSTEM_CHANGED_EVENT, onChanged); strip.teardown(); el.remove(); });
  const items = (): HTMLButtonElement[] => [...el.querySelectorAll<HTMLButtonElement>('.ds-strip-item')];
  const item = (id: string): HTMLButtonElement => items().find(b => b.dataset.dsId === id)!;
  const toolbar = (): HTMLElement => el.querySelector<HTMLElement>('[role="toolbar"]')!;
  return { el, host, state, strip, items, item, toolbar };
}

const key = (target: Element, k: string): KeyboardEvent => {
  const e = new dom.window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
  target.dispatchEvent(e);
  return e as unknown as KeyboardEvent;
};

afterEach(() => {
  for (const down of teardowns.splice(0)) down();
  flushUndoToasts();
  remounts.length = 0;
  scrolled.length = 0;
});

test('nothing renders with one visible system', async () => {
  const one = mount([DEMO_REC]);
  assert.equal(one.el.hidden, true);
  assert.equal(one.el.childElementCount, 0, 'no markup at all, not a hidden toolbar');
  const read = mount([DEMO_REC], { withRecords: false });
  await settle();
  assert.equal(read.el.hidden, true, 'the same when the strip asks the registry itself');
  assert.equal(read.el.childElementCount, 0);
});

test('one tab stop on the pressed item, aria-pressed on the active item only, and labels that stay put', async () => {
  const s = mount([DEMO_REC, STARTER_REC, ACME_REC]);
  await settle();
  assert.equal(s.el.hidden, false);
  const bar = s.toolbar();
  assert.equal(bar.getAttribute('aria-labelledby'), s.el.querySelector('.ds-strip-title')!.id);
  assert.equal(s.el.querySelector('.ds-strip-title')!.textContent, 'Design systems');
  assert.equal(s.el.querySelector<HTMLAnchorElement>('.ds-strip-manage')!.getAttribute('href'), '#/settings?focus=design-systems-section');
  assert.deepEqual(s.items().map(b => b.getAttribute('aria-pressed')), ['true', 'false', 'false']);
  const stops = s.items().filter(b => b.getAttribute('tabindex') === '0');
  assert.equal(stops.length, 1);
  assert.equal(stops[0], s.item('shipped'), 'the pressed item is the one tab stop');
  for (const b of s.items()) {
    assert.equal(b.type, 'button');
    assert.equal(b.querySelector('.ds-cover')!.getAttribute('aria-hidden'), 'true', 'the cover is hidden from assistive technology');
    const sub = s.el.querySelector<HTMLElement>(`#${b.getAttribute('aria-describedby')}`)!;
    assert.ok(b.contains(sub) && sub.getAttribute('aria-hidden') === 'true', 'the counts are the description, not the name');
    assert.equal(b.querySelector('.ds-strip-label')!.textContent, ({ shipped: 'Lolly Demo', 'lolly-starter': 'Lolly Starter', acme: 'Acme' } as Record<string, string>)[b.dataset.dsId!]);
  }
  assert.equal(s.item('shipped').querySelector('.ds-strip-sub')!.textContent, '33 colours · 6 colourways');
  assert.equal(s.item('lolly-starter').querySelector('.ds-strip-sub')!.textContent, `${colourCountOf(START)} colours`, 'one colourway count is left out');
  assert.equal(s.item('acme').querySelector('.ds-strip-sub')!.textContent, `${colourCountOf(START)} colours · Read-only`);
  assert.equal(s.el.querySelectorAll(':disabled').length, 0);
});

test('the arrow keys, Home and End move the focus and never switch; in RTL the arrows swap', async () => {
  const s = mount([DEMO_REC, STARTER_REC, ACME_REC]);
  await settle();
  const [a, b, c] = s.items() as [HTMLButtonElement, HTMLButtonElement, HTMLButtonElement];
  a.focus();
  assert.ok(key(a, 'ArrowRight').defaultPrevented);
  assert.equal(document.activeElement, b);
  assert.equal(b.tabIndex, 0, 'the tab stop follows the focus');
  assert.equal(a.tabIndex, -1);
  assert.deepEqual(scrolled.at(-1), { id: 'lolly-starter', opts: { inline: 'nearest', block: 'nearest', behavior: 'smooth' } });
  key(b, 'ArrowRight');
  assert.equal(document.activeElement, c);
  key(c, 'ArrowRight');
  assert.equal(document.activeElement, a, 'Right wraps to the first');
  key(a, 'ArrowLeft');
  assert.equal(document.activeElement, c, 'Left wraps to the last');
  key(c, 'Home');
  assert.equal(document.activeElement, a);
  key(a, 'End');
  assert.equal(document.activeElement, c);
  s.toolbar().style.direction = 'rtl';
  key(c, 'ArrowRight');
  assert.equal(document.activeElement, b, 'in RTL, Right goes back');
  key(b, 'ArrowLeft');
  assert.equal(document.activeElement, c, 'and Left goes on');
  document.documentElement.dataset.a11yMotion = 'reduce';
  key(c, 'Home');
  assert.equal((scrolled.at(-1)!.opts as { behavior: string }).behavior, 'auto', 'Reduce motion scrolls without the glide');
  delete document.documentElement.dataset.a11yMotion;
  document.querySelector<HTMLElement>('#outside')!.focus();
  assert.deepEqual(s.items().map(i => i.tabIndex), [0, -1, -1], 'leaving the strip puts the tab stop back on the pressed item');
  await settle();
  assert.deepEqual(s.state.switched, [], 'no arrow switched anything');
  assert.equal(s.item('shipped').getAttribute('aria-pressed'), 'true');
});

test('activating an inactive item switches in place, says so, and Undo switches back', async () => {
  const s = mount([DEMO_REC, STARTER_REC]);
  await settle();
  const starter = s.item('lolly-starter');
  starter.focus();
  starter.click(); // what Enter and Space do on a native button
  await settle();
  assert.deepEqual(s.state.switched, ['lolly-starter'], 'setActive ran once');
  assert.equal(remounts.length, 0, 'no remount: the tab redraws in place');
  const toast = [...document.querySelectorAll<HTMLElement>('.undo-toast')].at(-1)!;
  assert.equal(toast.querySelector('.undo-toast-msg')!.textContent, 'Using Lolly Starter.');
  assert.equal(s.item('lolly-starter').getAttribute('aria-pressed'), 'true');
  assert.equal(s.item('shipped').getAttribute('aria-pressed'), 'false');
  assert.equal(document.activeElement, s.item('lolly-starter'), 'the focus is on the item now pressed');
  assert.equal(s.item('lolly-starter').tabIndex, 0);
  // A press on Undo puts the focus on the notice's button, which then goes.
  const undo = toast.querySelector<HTMLButtonElement>('.undo-toast-btn')!;
  undo.focus();
  undo.click();
  await settle();
  assert.deepEqual(s.state.switched, ['lolly-starter', 'shipped'], 'Undo goes back to the system in use before');
  assert.equal(remounts.length, 0, 'and Undo redraws in place too');
  assert.equal(s.item('shipped').getAttribute('aria-pressed'), 'true');
  assert.equal(document.activeElement, s.item('shipped'), 'the focus lands on the item Undo pressed, not on the page');
  assert.equal(s.item('shipped').tabIndex, 0);
});

test('flipping between systems keeps one notice, whose Undo goes back one step', async () => {
  const s = mount([DEMO_REC, STARTER_REC]);
  await settle();
  s.item('lolly-starter').click();
  await settle();
  s.item('shipped').click();
  await settle();
  const toasts = [...document.querySelectorAll<HTMLElement>('.undo-toast')];
  assert.equal(toasts.length, 1, 'the earlier notice went when the next switch came');
  assert.equal(toasts[0]!.querySelector('.undo-toast-msg')!.textContent, 'Using Lolly Demo.');
  toasts[0]!.querySelector<HTMLButtonElement>('.undo-toast-btn')!.click();
  await settle();
  assert.deepEqual(s.state.switched, ['lolly-starter', 'shipped', 'lolly-starter'], 'Undo goes back to the system before the latest switch');
  assert.equal(document.querySelectorAll('.undo-toast').length, 0);
});

test('Undo that moves the instance base back remounts once, and the next strip takes the focus', async () => {
  const records = [DEMO_REC, HOSTED_REC];
  const bases: Array<string | null> = [];
  const s = mount(records, { activeId: 'hosted', switchOptions: { setBase: async (url: string | null) => { bases.push(url); }, resync: async () => {} } });
  await settle();
  s.item('shipped').focus();
  s.item('shipped').click();
  await settle();
  assert.equal(remounts.length, 0, 'leaving a hosted system for a local one keeps the base');
  const undo = document.querySelector<HTMLButtonElement>('.undo-toast .undo-toast-btn')!;
  undo.focus();
  undo.click();
  await settle();
  assert.deepEqual(bases, ['https://brand.example'], 'Undo took the base back to the hosted system');
  assert.equal(remounts.length, 1, 'so the view remounts once, as the switch forward would');
  for (const down of teardowns.splice(0)) down();
  const next = mount(records, { activeId: 'hosted' });
  assert.equal(document.activeElement, next.item('hosted'), 'the new strip focuses the system Undo chose');
});

test('activating the pressed item does nothing', async () => {
  const s = mount([DEMO_REC, STARTER_REC]);
  await settle();
  const before = document.querySelectorAll('.undo-toast').length;
  s.item('shipped').click();
  await settle();
  assert.deepEqual(s.state.switched, []);
  assert.equal(s.toolbar().hasAttribute('aria-busy'), false);
  assert.equal(document.querySelectorAll('.undo-toast').length, before, 'no notice');
});

test('while a switch runs the items read as unavailable, keep the focus and ignore a second press', async () => {
  const s = mount([DEMO_REC, STARTER_REC, ACME_REC]);
  await settle();
  s.state.holdSwitch = true;
  const starter = s.item('lolly-starter');
  starter.focus();
  starter.click();
  await settle();
  assert.equal(s.toolbar().getAttribute('aria-busy'), 'true');
  assert.ok(s.items().every(b => b.getAttribute('aria-disabled') === 'true'), 'every item reads as unavailable');
  assert.equal(s.el.querySelectorAll(':disabled').length, 0, 'and none is disabled, so the focus stays');
  assert.equal(document.activeElement, starter);
  assert.equal(s.el.querySelector('[data-ds-strip-status]')!.textContent, 'Loading design system…');
  s.item('acme').click();
  await settle();
  s.state.holdSwitch = false;
  s.state.release();
  await settle();
  assert.deepEqual(s.state.switched, ['lolly-starter'], 'the second press was ignored');
  assert.equal(s.toolbar().hasAttribute('aria-busy'), false);
  assert.equal(s.el.querySelectorAll('[aria-disabled]').length, 0);
  assert.equal(s.el.querySelector('[data-ds-strip-status]')!.textContent, '');
  assert.equal(document.activeElement, s.item('lolly-starter'));
});

test('a failed switch says why and leaves the focus where it was', async () => {
  const s = mount([DEMO_REC, STARTER_REC]);
  await settle();
  s.state.failSwitch = new Error('Storage unavailable');
  const starter = s.item('lolly-starter');
  starter.focus();
  starter.click();
  await settle();
  const status = s.el.querySelector<HTMLElement>('[data-ds-strip-status]')!;
  assert.equal(status.textContent, 'Storage unavailable');
  assert.equal(status.classList.contains('visually-hidden'), false, 'the reason shows under the strip, not only to a screen reader');
  assert.ok(status.classList.contains('ds-strip-note'));
  assert.equal(s.toolbar().hasAttribute('aria-busy'), false);
  assert.equal(s.el.querySelectorAll('[aria-disabled]').length, 0);
  assert.equal(document.activeElement, starter);
  assert.equal(s.item('shipped').getAttribute('aria-pressed'), 'true', 'nothing changed');
});

test('a switch that moves the instance base remounts once, and the next strip takes the focus back', async () => {
  const records = [DEMO_REC, HOSTED_REC, STARTER_REC];
  const bases: Array<string | null> = [];
  const s = mount(records, { switchOptions: { setBase: async (url: string | null) => { bases.push(url); }, resync: async () => {} } });
  await settle();
  s.item('hosted').focus();
  s.item('hosted').click();
  await settle();
  assert.deepEqual(bases, ['https://brand.example'], 'the base followed the hosted record');
  assert.equal(remounts.length, 1, 'exactly one remount');
  // The remount: the old view goes and a new strip mounts with the hosted system active.
  for (const down of teardowns.splice(0)) down();
  document.querySelector<HTMLElement>('#outside')!.focus();
  const next = mount(records, { activeId: 'hosted' });
  assert.equal(document.activeElement, next.item('hosted'), 'the new strip focuses the system just chosen');
  const again = mount(records, { activeId: 'hosted' });
  assert.notEqual(document.activeElement, again.item('hosted'), 'once only');
  assert.equal(remounts.length, 1);
});

test('names render before any cover is read, and data-ready marks when every preview has settled', async () => {
  const { host, state } = hostFor([DEMO_REC, STARTER_REC, ACME_REC]);
  state.holdReads = true;
  const el = document.createElement('div');
  el.setAttribute('data-ds-strip', '');
  document.body.append(el);
  const strip = mountDsStrip(el, host as never, { activeId: 'shipped', activeCover: activeCover('Lolly Demo'), records: [DEMO_REC, STARTER_REC, ACME_REC] as never });
  teardowns.push(() => { strip.teardown(); el.remove(); });
  const names = (): string[] => [...el.querySelectorAll('.ds-strip-label')].map(n => n.textContent ?? '');
  assert.deepEqual(names(), ['Lolly Demo', 'Lolly Starter', 'Acme'], 'drawn in the same task as the mount');
  assert.ok(el.querySelector('[data-ds-id="shipped"] .ds-cover.ds-look'), 'the active cover comes from what the tab read');
  assert.equal(el.querySelectorAll('.ds-cover.is-pending').length, 2, 'the others hold a plate of the same size');
  assert.equal(el.dataset.ready, undefined);
  await settle();
  assert.deepEqual(state.reads.sort(), ['user/ds/acme/tokens/brand', 'user/ds/lolly-starter/tokens/brand'], 'only the inactive systems are read');
  state.holdReads = false;
  state.release();
  await strip.settled();
  assert.equal(el.querySelectorAll('.ds-cover.is-pending').length, 0, 'each cover swapped in once its preview was read');
  assert.equal(el.querySelector('[data-ds-id="acme"] .ds-cover-mono')!.textContent, 'A');
  assert.equal(el.dataset.ready, '1');
});

test('a refresh keeps the covers already read and reads again only the two systems that changed', async () => {
  const s = mount([DEMO_REC, STARTER_REC, ACME_REC]);
  await s.strip.settled();
  assert.deepEqual(s.state.reads.sort(), ['user/ds/acme/tokens/brand', 'user/ds/lolly-starter/tokens/brand']);
  s.state.reads.length = 0;
  s.item('lolly-starter').click();
  await settle();
  await s.strip.settled();
  assert.deepEqual(s.state.reads, ['lolly/tokens/demo'], 'the system that was active is read from its head; Acme is not read again');
  assert.equal(s.el.querySelector('[data-ds-id="shipped"] .ds-cover.is-pending'), null, 'its last cover stayed up while it was read');
  assert.equal(s.item('shipped').querySelector('.ds-strip-sub')!.textContent, `${colourCountOf(DEMO)} colours · 6 colourways`);
  s.strip.setCover('lolly-starter', { ...activeCover('Lolly Starter'), logos: { light: '/catalog/x.svg' } });
  assert.equal(s.item('lolly-starter').querySelector('img.ds-cover-logo')!.getAttribute('src'), '/catalog/x.svg', 'the active logo swaps in after paint');
});

test('a system whose head is not written yet keeps its plate and no count, and is read again', async () => {
  const saved = PREVIEW_HEAD_RETRY_MS.splice(0, PREVIEW_HEAD_RETRY_MS.length, 1, 1);
  try {
    const records = [DEMO_REC, STARTER_REC];
    const { host, state } = hostFor(records);
    let written = false;
    const real = host.assets._getBlob;
    host.assets._getBlob = async (id: string) => {
      if (id !== STARTER_REC.headId || written) return real(id);
      state.reads.push(id);
      return null as never;
    };
    const el = document.createElement('div');
    el.setAttribute('data-ds-strip', '');
    document.body.append(el);
    const strip = mountDsStrip(el, host as never, { activeId: 'shipped', activeCover: activeCover('Lolly Demo'), records: records as never });
    teardowns.push(() => { strip.teardown(); el.remove(); });
    await strip.settled();
    const starter = (): HTMLElement => el.querySelector<HTMLElement>('[data-ds-id="lolly-starter"]')!;
    assert.ok(starter().querySelector('.ds-cover.is-pending'), 'the plain plate stays: no blank cover is shown as the system');
    assert.equal(starter().querySelector('.ds-strip-sub')!.textContent, '', 'and no count, never "0 colours"');
    assert.equal(state.reads.filter(id => id === STARTER_REC.headId).length, 3, 'read, then read again after each pause');
    assert.equal(el.dataset.ready, '1', 'the strip still settles');
    written = true;
    await strip.refresh('shipped', activeCover('Lolly Demo'), records as never);
    await strip.settled();
    assert.equal(starter().querySelector('.ds-cover.is-pending'), null, 'the next draw read it again and drew it');
    assert.equal(starter().querySelector('.ds-strip-sub')!.textContent, `${colourCountOf(START)} colours`);
  } finally { PREVIEW_HEAD_RETRY_MS.splice(0, PREVIEW_HEAD_RETRY_MS.length, ...saved); }
});

test('a head written a moment after its record is drawn in the same mount', async () => {
  const saved = PREVIEW_HEAD_RETRY_MS.splice(0, PREVIEW_HEAD_RETRY_MS.length, 1, 1);
  try {
    const records = [DEMO_REC, STARTER_REC];
    const { host } = hostFor(records);
    let misses = 1;
    const real = host.assets._getBlob;
    host.assets._getBlob = async (id: string) => (id === STARTER_REC.headId && misses-- > 0 ? null : real(id)) as never;
    const el = document.createElement('div');
    el.setAttribute('data-ds-strip', '');
    document.body.append(el);
    const strip = mountDsStrip(el, host as never, { activeId: 'shipped', activeCover: activeCover('Lolly Demo'), records: records as never });
    teardowns.push(() => { strip.teardown(); el.remove(); });
    await strip.settled();
    assert.equal(el.querySelector('[data-ds-id="lolly-starter"] .ds-cover.is-pending'), null);
    assert.equal(el.querySelector('[data-ds-id="lolly-starter"] .ds-strip-sub')!.textContent, `${colourCountOf(START)} colours`);
  } finally { PREVIEW_HEAD_RETRY_MS.splice(0, PREVIEW_HEAD_RETRY_MS.length, ...saved); }
});

test('the system switched away from is not drawn in the incoming display face while it is read again', async () => {
  const fonts = Object.getOwnPropertyDescriptor(document, 'fonts');
  Object.defineProperty(document, 'fonts', { configurable: true, value: [{ family: 'Outfit' }] });
  try {
    const s = mount([DEMO_REC, STARTER_REC]);
    await s.strip.settled();
    s.strip.setCover('shipped', { ...activeCover('Lolly Demo'), families: ['Outfit'] });
    assert.match(s.item('shipped').querySelector('.ds-cover')!.getAttribute('style') ?? '', /--cv-font:var\(--font-display/, 'the active cover uses the live display face');
    s.state.holdReads = true;
    s.item('lolly-starter').click();
    await settle();
    assert.doesNotMatch(s.item('shipped').querySelector('.ds-cover')!.getAttribute('style') ?? '', /--cv-font/, 'the outgoing cover falls back to the text face');
    s.state.holdReads = false;
    s.state.release();
    await s.strip.settled();
  } finally {
    if (fonts) Object.defineProperty(document, 'fonts', fonts);
    else delete (document as unknown as { fonts?: unknown }).fonts;
  }
});
