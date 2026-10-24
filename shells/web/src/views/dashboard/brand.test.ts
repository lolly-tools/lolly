// SPDX-License-Identifier: MPL-2.0
/**
 * views/dashboard/brand.ts: the Settings Design system tab as a read of the
 * active design system. Pinned against the two shipped fixtures (Lolly Demo and
 * the lolly-start starter): no illustration survives, every registry page is
 * addressed by its own flag, the logo files arrive after paint, and the panel
 * refreshes in place exactly once per switch.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/dashboard/brand.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createTokenSet } from '@lolly/engine';

const dom = new JSDOM('<!doctype html><html><body><main id="view"></main></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.CustomEvent = dom.window.CustomEvent as unknown as typeof CustomEvent;
globalThis.Event = dom.window.Event as unknown as typeof Event;
const copied: string[] = [];
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { clipboard: { writeText: async (value: string) => { copied.push(value); } }, language: 'en' },
});
// jsdom lays nothing out and has no scrollIntoView, which the tab only asks for.
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView(): void }).scrollIntoView = () => {};

const { readBrandPanelInput, brandPanelHtml, mountBrandPanel } = await import('./brand.ts');
const { DASH_SECTIONS, dashFlag } = await import('../../lib/dashboard-registry.ts');
const { DESIGN_SYSTEM_CHANGED_EVENT } = await import('../../lib/design-system/switch.ts');
const { getExcludedSwatches } = await import('../../lib/brand-exclusions.ts');
const { colourCountOf } = await import('../../lib/design-system/preview.ts');

type Doc = Record<string, unknown>;
const fixture = (rel: string): Doc => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8')) as Doc;
const DEMO = fixture('../../../../../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json');
const START = fixture('../../../../../brands/lolly-start/catalog/assets/lolly/tokens/brand.json');

const record = (label: string, extra: Record<string, unknown> = {}) => ({
  id: 'shipped', label, ns: 'lolly/', headId: 'lolly/tokens/demo', source: { kind: 'local', from: 'app' }, locked: false, createdAt: 1, lastUsedAt: 1, ...extra,
});

/**
 * A host over one doc. `raw` counts its reads; `gate` (when set) holds a read
 * until the test releases it, so the order reads resolve in can be chosen.
 */
function hostFor(doc: Doc, opts: { label?: string; locked?: boolean; radius?: string | null; missingLogos?: boolean; systems?: Array<ReturnType<typeof record>> } = {}) {
  const state = { doc, raws: 0, gates: [] as Array<() => void>, hold: false, activeId: 'shipped' };
  const excluded = (d: Doc): Set<string> => new Set(getExcludedSwatches(d));
  const host = {
    profile: { get: async () => ({}) },
    tokens: {
      colors: async () => createTokenSet(state.doc).colors().filter(c => !excluded(state.doc).has(c.path)),
      raw: async () => {
        state.raws++;
        const doc = state.doc;
        if (state.hold) await new Promise<void>(resolve => state.gates.push(resolve));
        return doc;
      },
      isLocked: async () => !!opts.locked,
      resolve: async (ref: string) => (ref === '{shape.radius}' ? opts.radius ?? '12px' : null),
      activeRecord: async () => opts.systems?.find(r => r.id === state.activeId) ?? record(opts.label ?? 'Lolly Demo', { locked: !!opts.locked }),
    },
    assets: {
      get: async (id: string) => {
        if (opts.missingLogos) throw new Error('missing');
        return { url: `/catalog/${id}.svg` };
      },
      _findMetaByType: async () => null,
      _getBlob: async (id: string) => new Blob([JSON.stringify(id === 'lolly/tokens/demo' ? DEMO : START)]),
    },
    // A registry only when the test hands one over: the strip shows with two or more systems.
    ...(opts.systems ? { designSystems: { visible: async () => [...opts.systems!], activeId: async () => state.activeId } } : {}),
  };
  return { host, state };
}

const flush = async (): Promise<void> => { for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 0)); };

async function mounted(doc: Doc, opts: Parameters<typeof hostFor>[1] = {}) {
  const { host, state } = hostFor(doc, opts);
  const input = await readBrandPanelInput(host as never);
  const view = document.querySelector<HTMLElement>('#view')!;
  view.innerHTML = `<section data-dash-panel="brand">${brandPanelHtml(input)}</section>`;
  const panel = view.querySelector<HTMLElement>('[data-dash-panel="brand"]')!;
  const brand = mountBrandPanel(panel, host as never, input);
  return { host, state, input, panel, brand };
}

test('no illustration is left on the tab, and none of their modules is imported', async () => {
  const { panel, brand } = await mounted(DEMO);
  const html = panel.innerHTML;
  for (const gone of ['dash-wheel', 'brand-seal', 'type-demo', 'td-', 'dash-ink', 'dash-hero', 'dash-readout']) {
    assert.ok(!html.includes(gone), `no ${gone} in the markup`);
  }
  const src = readFileSync(new URL('./brand.ts', import.meta.url), 'utf8');
  for (const mod of ['palette-wheel', 'brand-seal', 'type-demo']) assert.ok(!src.includes(`lib/${mod}`), `brand.ts does not import ${mod}`);
  brand.teardown();
});

test('every Design system registry page is on the tab, addressed by its own flag', async () => {
  const { panel, brand } = await mounted(DEMO);
  for (const s of DASH_SECTIONS.filter(row => row.tab === 'brand' && row.flag)) {
    const el = panel.querySelector<HTMLElement>(`#${s.id}`);
    assert.ok(el, `${s.id} is rendered`);
    assert.equal(el.dataset.flag, dashFlag(s.id), `${s.id} carries dashFlag(${s.id})`);
  }
  // The retired sections are aliases on the pages that replaced them.
  assert.ok(panel.querySelector('#dash-brand')!.getAttribute('data-flag')!.split(' ').includes('dash-lock'));
  assert.ok(panel.querySelector('#dash-palette')!.getAttribute('data-flag')!.split(' ').includes('dash-palette-wheel'));
  brand.teardown();
});

test('Lolly Demo reads as its own material: names, both looks, faces, logos and colourways', async () => {
  const { panel, brand } = await mounted(DEMO);
  const cover = panel.querySelector<HTMLElement>('#dash-brand')!;
  assert.ok(cover.classList.contains('ds-look'));
  assert.match(cover.getAttribute('style') ?? '', /--cv-l-primary:#033633;.*--cv-d-primary:#50c369/);
  assert.equal(cover.querySelector('h2')!.textContent, 'Lolly Demo');
  assert.equal(cover.querySelector('.ds-issue-standfirst')!.textContent,
    "Lolly Demo, Lolly's own design system and the first one built on Lolly. Its palette is Opal: every colour is a treat or a piece of nature, remembered by name and never by number; a tint keeps its parent's name.");
  assert.deepEqual([...cover.querySelectorAll('.ds-issue-contents a')].map(a => a.textContent),
    ['33 colours', '3 typefaces', '7 logos', '6 colourways', 'Tokens', 'Print & CMYK']);
  assert.ok(cover.querySelector('a.ds-issue-edit[href="#/start"]'), 'an editable system links to Design System Setup');
  assert.equal(cover.querySelector('.ds-issue-lock'), null);

  const lead = [...panel.querySelectorAll('#dash-palette .ds-leads-mode')][0]!;
  assert.deepEqual([...lead.querySelectorAll('.ds-lead-name')].map(n => n.textContent), ['Sugar', 'Liquorice', 'Spearmint', 'Bunyapine']);
  const chips = [...panel.querySelectorAll<HTMLElement>('#dash-palette .ds-chip-grid .ds-chip')];
  assert.equal(chips.length, 33, 'every named colour as a chip');
  assert.ok(chips.every(c => c.querySelector('.ds-chip-fill') && c.querySelector('.ds-chip-name') && c.querySelector('button.ds-hex[data-copy]')), 'each chip is a fill, a name and a hex that copies');
  assert.equal(panel.querySelectorAll('#dash-palette .ds-role').length, 37, 'the colour roles, folded');
  assert.equal(panel.querySelectorAll('#dash-typedemo .ds-type-row').length, 4);
  assert.deepEqual([...panel.querySelectorAll('#dash-typedemo .ds-type-family')].map(f => f.textContent), ['Outfit', 'SUSE', 'SUSE', 'SUSE Mono']);
  assert.equal(panel.querySelectorAll('#dash-logos [data-logo-id]').length, 7);
  assert.deepEqual([...panel.querySelectorAll('#dash-colourways .ds-colourway-name')].map(n => n.textContent),
    ['Spearmint', 'Morning', 'Spring', 'Beach', 'Afternoon', 'Midnight']);
  assert.equal(panel.querySelectorAll('#dash-colourways .ds-colourway-default').length, 1, 'one Default');
  assert.ok(panel.querySelector('#dash-tokens .dash-token-shape'), 'the radius chip');
  brand.teardown();
});

test('the starter shows its one Neutral ramp, its logo files and no Colourways page', async () => {
  const { panel, brand } = await mounted(START, { label: 'Lolly Starter' });
  assert.equal(panel.querySelector('#dash-colourways'), null, 'no colourways, no page');
  assert.equal(panel.querySelector('#dash-palette .ds-chip-grid'), null, 'no named colours');
  const band = panel.querySelector('#dash-palette .ds-band')!;
  assert.equal(band.querySelectorAll('.ds-band-step').length, 9);
  assert.match(band.closest('.ds-band-block')!.querySelector('h3')!.textContent ?? '', /Neutral\s+9/);
  assert.equal(panel.querySelectorAll('#dash-logos [data-logo-id]').length, 4, 'its four logo files');
  assert.equal(panel.querySelector('#dash-typedemo .ds-type-row--display .ds-type-follows')?.textContent, 'Same face as Text');
  assert.ok(!panel.querySelector('.ds-issue-contents')!.textContent!.includes('colourway'));
  brand.teardown();
});

test('a read-only system says so on its cover and offers no edit', async () => {
  const { panel, brand } = await mounted(DEMO, { locked: true });
  const lock = panel.querySelector('#dash-brand .ds-issue-lock');
  assert.ok(lock, 'the lock line');
  assert.ok(lock.querySelector('a[href="#/settings?focus=design-systems-section"]'), 'it links to Preferences');
  assert.equal(panel.querySelector('.ds-issue-edit'), null);
  assert.equal(panel.querySelector('#dash-typedemo a[href="#/start?tab=type"]'), null, 'no Manage fonts link');
  brand.teardown();
});

test('the doc\'s own words are text, never markup', async () => {
  const doc = { ...START, $description: 'Bold <script>alert(1)</script> claims. Second line.' };
  const { panel, brand } = await mounted(doc, { label: '<img src=x onerror=alert(1)>' });
  assert.equal(panel.querySelector('script'), null);
  assert.equal(panel.querySelectorAll('img[onerror]').length, 0);
  assert.equal(panel.querySelector('#dash-brand-h')!.textContent, '<img src=x onerror=alert(1)>');
  assert.match(panel.querySelector('.ds-issue-standfirst')!.textContent ?? '', /<script>alert\(1\)<\/script>/);
  brand.teardown();
});

test('after paint the cover gets one logo per distinct file, each naming the themes it serves', async () => {
  const { panel, brand } = await mounted(DEMO);
  await flush();
  const logos = [...panel.querySelectorAll<HTMLImageElement>('#dash-brand .ds-issue-logo')];
  assert.deepEqual(logos.map(img => [img.getAttribute('src'), img.dataset.looks]), [
    ['/catalog/lolly/logo/horizontal.svg', 'light'],
    ['/catalog/lolly/logo/horizontal-reverse.svg', 'dark'],
    ['/catalog/lolly/logo/horizontal-on-brand.svg', 'brand'],
  ]);
  assert.ok(logos.every(img => img.alt === ''), 'the system name printed next to the logo carries the meaning');
  const files = [...panel.querySelectorAll<HTMLImageElement>('#dash-logos .ds-logo-img')];
  assert.ok(files.every(img => !img.hidden && img.getAttribute('src')?.startsWith('/catalog/')));
  assert.equal(panel.dataset.issueReady, '1');
  brand.teardown();
});

test('logo files that cannot be found take the Logos page with them, and the nameplate frees its space', async () => {
  const { panel, brand } = await mounted(DEMO, { missingLogos: true });
  await flush();
  assert.equal(panel.querySelector<HTMLElement>('#dash-logos')!.hidden, true);
  const plate = panel.querySelector<HTMLElement>('[data-issue-nameplate]')!;
  assert.equal(plate.children.length, 0);
  assert.equal(plate.hasAttribute('data-reserve'), false);
  assert.equal(panel.dataset.issueReady, '1');
  brand.teardown();
});

test('one design-system change, one read; a stale read never paints; a torn-down panel never reads', async () => {
  const { panel, state, brand } = await mounted(DEMO);
  await flush();
  const before = state.raws;
  window.dispatchEvent(new CustomEvent(DESIGN_SYSTEM_CHANGED_EVENT));
  await flush();
  assert.equal(state.raws, before + 1, 'one event, one read');

  // Two quick switches whose reads resolve in the wrong order: only the newer paints.
  state.hold = true;
  state.doc = { ...DEMO };
  window.dispatchEvent(new CustomEvent(DESIGN_SYSTEM_CHANGED_EVENT));
  await flush();
  state.doc = START;
  window.dispatchEvent(new CustomEvent(DESIGN_SYSTEM_CHANGED_EVENT));
  await flush();
  assert.equal(state.gates.length, 2);
  state.hold = false;
  state.gates[1]!();
  await flush();
  assert.equal(panel.querySelector('#dash-colourways'), null, 'the newer read (the starter) painted');
  state.gates[0]!();
  await flush();
  assert.equal(panel.querySelector('#dash-colourways'), null, 'the older read (Lolly Demo) was dropped');

  brand.teardown();
  const after = state.raws;
  window.dispatchEvent(new CustomEvent(DESIGN_SYSTEM_CHANGED_EVENT));
  await flush();
  assert.equal(state.raws, after, 'no read after teardown');
});

test('a refresh keeps focus inside the tab when it was there', async () => {
  const { panel, brand } = await mounted(DEMO);
  panel.querySelector<HTMLElement>('.ds-hex')!.focus();
  await brand.refresh();
  assert.equal(document.activeElement, panel.querySelector('#dash-brand-h'));
  brand.teardown();
});

test('a copy writes the value and says so once, on the polite status line', async () => {
  const { panel, brand } = await mounted(DEMO);
  const hex = [...panel.querySelectorAll<HTMLButtonElement>('#dash-palette .ds-hex')].find(b => b.dataset.copy === '#033633')!;
  assert.equal(hex.getAttribute('aria-label'), 'Copy Spearmint #033633');
  hex.click();
  await flush();
  assert.equal(copied.at(-1), '#033633');
  const status = panel.querySelector<HTMLElement>('[data-issue-status]')!;
  assert.equal(status.getAttribute('role'), 'status');
  assert.equal(status.textContent, 'Copied #033633');
  brand.teardown();
});

test('a contents link moves focus to its page title; a modified click is left to the browser', async () => {
  const { panel, brand } = await mounted(DEMO);
  const link = panel.querySelector<HTMLAnchorElement>('a[data-issue-jump="dash-typedemo"]')!;
  assert.equal(link.getAttribute('href'), '#/settings?dash-typedemo');
  const plain = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  link.dispatchEvent(plain);
  assert.equal(plain.defaultPrevented, true);
  assert.equal(document.activeElement, panel.querySelector('#dash-typedemo-h'));

  const print = panel.querySelector<HTMLAnchorElement>('a[data-issue-jump="dash-print"]')!;
  print.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  assert.equal(panel.querySelector<HTMLDetailsElement>('#dash-print')!.open, true, 'the print fold opens');

  const modified = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true });
  link.dispatchEvent(modified);
  assert.equal(modified.defaultPrevented, false);
  brand.teardown();
});

test('the design systems strip sits above the cover, draws the active system from the same read, and follows a switch in place', async () => {
  const systems = [record('Lolly Demo'), record('Lolly Starter', { id: 'lolly-starter', headId: 'user/ds/lolly-starter/tokens/brand' })];
  const { panel, state, brand } = await mounted(DEMO, { systems });
  const strip = panel.querySelector<HTMLElement>('[data-ds-strip]')!;
  assert.equal(strip.hidden, false, 'two systems, so the strip shows at first paint');
  assert.ok(strip.compareDocumentPosition(panel.querySelector('#dash-brand')!) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING, 'above the cover');
  const pressed = (): string[] => [...strip.querySelectorAll<HTMLElement>('.ds-strip-item[aria-pressed="true"]')].map(b => b.dataset.dsId!);
  assert.deepEqual(pressed(), ['shipped']);
  const activeCover = strip.querySelector<HTMLElement>('[data-ds-id="shipped"] .ds-cover')!;
  assert.match(activeCover.getAttribute('style') ?? '', /--cv-l-primary:#033633;.*--cv-d-primary:#50c369/, 'painted from the issue model');
  assert.equal(strip.querySelector('[data-ds-id="shipped"] .ds-strip-sub')!.textContent, '33 colours · 6 colourways');
  await flush();
  assert.deepEqual([...strip.querySelectorAll<HTMLImageElement>('[data-ds-id="shipped"] img.ds-cover-logo')].map(img => [img.getAttribute('src'), img.dataset.looks]), [
    ['/catalog/lolly/logo/horizontal.svg', 'light'],
    ['/catalog/lolly/logo/horizontal-reverse.svg', 'dark'],
    ['/catalog/lolly/logo/horizontal-on-brand.svg', 'brand'],
  ], 'the active logos arrive after paint, from the read the cover already made');
  assert.equal(strip.dataset.ready, '1');
  assert.equal(panel.dataset.issueReady, '1', 'the tab is ready once the strip has read its covers');

  // A switch made elsewhere (the account menu): one read, the strip and the issue follow in place.
  const before = state.raws;
  state.activeId = 'lolly-starter';
  state.doc = START;
  window.dispatchEvent(new CustomEvent(DESIGN_SYSTEM_CHANGED_EVENT));
  await flush();
  assert.equal(state.raws, before + 1, 'one event, one read');
  assert.deepEqual(pressed(), ['lolly-starter']);
  assert.equal(panel.querySelector('#dash-brand-h')!.textContent, 'Lolly Starter');
  assert.match(strip.querySelector('[data-ds-id="shipped"] .ds-cover')!.getAttribute('style') ?? '', /--cv-l-primary:#033633/, 'the system before keeps its own cover');
  brand.teardown();
});

test('with one design system the strip stays out of the tab', async () => {
  const { panel, brand } = await mounted(DEMO, { systems: [record('Lolly Demo')] });
  const strip = panel.querySelector<HTMLElement>('[data-ds-strip]')!;
  assert.equal(strip.hidden, true);
  assert.equal(strip.childElementCount, 0);
  brand.teardown();
});

test('the Colour page shows colour, not print data; the inks stay in the Print & CMYK fold', async () => {
  const { panel, brand } = await mounted(DEMO);
  const colour = panel.querySelector<HTMLElement>('#dash-palette')!;
  assert.equal(colour.querySelectorAll('.plat-swatch, .plat-chip-flag, .plat-swatch-cmyk').length, 0, 'no ink flag, spot code or CMYK line on the Colour page');
  assert.doesNotMatch(colour.textContent ?? '', /\bSPOT\b|\bC \d+ M \d+/, 'no print values in its text');
  assert.equal(panel.querySelectorAll('#dash-print .plat-swatch').length, 33, 'every locked ink is in the print fold');
  brand.teardown();
});

test('the tab counts colours from the head it reads, as the strip and the Preferences row do', async () => {
  for (const doc of [DEMO, START]) {
    const { host } = hostFor(doc);
    const input = await readBrandPanelInput(host as never);
    assert.equal(input.model.facts.colours, colourCountOf(doc), 'the engine-backed render surface and the head agree');
  }
  // A published version (or a ?designv= override) puts a different render
  // surface under host.tokens.colors(); the tab still counts the head.
  const { host } = hostFor(DEMO);
  host.tokens.colors = async () => createTokenSet(START).colors();
  const input = await readBrandPanelInput(host as never);
  assert.equal(input.model.facts.colours, colourCountOf(DEMO));
  assert.equal(input.model.colours.named.length, 33);
});

test('a gradient whose stops differ per look draws one preview for each, whatever the case of the mode ids', async () => {
  const doc = {
    base: {
      color: { $type: 'color', brand: { ink: { $value: '#101010' }, paper: { $value: '#fafafa' }, mint: { $value: '#033633' }, apple: { $value: '#50c369' } } },
      gradient: { fade: { $type: 'gradient', $value: [{ color: '{color.semantic.primary}', position: 0 }, { color: '{color.brand.paper}', position: 1 }] } },
    },
    Light: { color: { $type: 'color', semantic: { primary: { $value: '{color.brand.mint}' }, surface: { $value: '{color.brand.paper}' } } } },
    Dark: { color: { $type: 'color', semantic: { primary: { $value: '{color.brand.apple}' }, surface: { $value: '{color.brand.ink}' } } } },
    $themes: [
      { name: 'Light', selectedTokenSets: { base: 'enabled', Light: 'enabled' }, $extensions: { 'com.suse.lolly': { axis: { kind: 'mode' } } } },
      { name: 'Dark', selectedTokenSets: { base: 'enabled', Dark: 'enabled' }, $extensions: { 'com.suse.lolly': { axis: { kind: 'mode' } } } },
    ],
  };
  const { panel, brand } = await mounted(doc);
  const grads = [...panel.querySelectorAll<HTMLElement>('#dash-tokens .dash-token-grad')];
  assert.deepEqual(grads.map(g => g.dataset.looks), ['light brand', 'dark']);
  assert.match(grads[0]!.getAttribute('style') ?? '', /#033633/, 'the light look starts on its primary');
  assert.match(grads[1]!.getAttribute('style') ?? '', /#50c369/, 'the dark look starts on its own');
  brand.teardown();
});

test('the cover eyebrow is plain text in one piece per fact, and the full note is a fold with a chevron', async () => {
  const { host } = hostFor(DEMO);
  host.tokens.activeRecord = async () => record('Lolly Demo', { id: 'acme', source: { kind: 'file', publisher: "O'Brien & Co" } });
  const input = await readBrandPanelInput(host as never);
  const view = document.querySelector<HTMLElement>('#view')!;
  view.innerHTML = `<section data-dash-panel="brand">${brandPanelHtml(input)}</section>`;
  const panel = view.querySelector<HTMLElement>('[data-dash-panel="brand"]')!;
  const brand = mountBrandPanel(panel, host as never, input);
  const parts = [...panel.querySelectorAll('.ds-issue-eyebrow > span')].map(p => p.textContent);
  assert.deepEqual(parts, ['Design system', "From a file by O'Brien & Co", 'Light and dark'], 'escaped once, so the name reads as written');
  const more = panel.querySelector<HTMLDetailsElement>('.ds-issue-more')!;
  assert.ok(more.querySelector('summary .ds-issue-chev'), 'the same turning chevron as the other folds');
  brand.teardown();
});
