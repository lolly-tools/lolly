// SPDX-License-Identifier: MPL-2.0
/**
 * Settings > Appearance: your colourway (components/colourway-pref.ts, plans/331).
 *
 * What these pin, on the public Lolly Demo design system: the row is the sidebar's
 * colourway control, one dot per colourway in the app's look, with the canonical
 * one named as the design system's default; a press saves the choice for the
 * active design system and repaints the chrome; choosing the canonical colourway
 * stores nothing; a stale choice shows the canonical colourway; a design system
 * without colourways shows no row; and the chrome painter itself then paints the
 * chosen colourway's lead.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/components/colourway-pref.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://lolly.tools/' });
for (const k of ['window', 'document', 'HTMLElement', 'HTMLButtonElement', 'HTMLSelectElement', 'HTMLDetailsElement', 'Element', 'Node', 'Event', 'KeyboardEvent', 'MouseEvent', 'CustomEvent', 'localStorage']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
// The logo tint decodes a bitmap it can never load here; the painter treats that as no tint.
(globalThis as { Image?: unknown }).Image = undefined;

const { colourwayPrefGroup, mountColourwayPref } = await import('./colourway-pref.ts');
const { applyChromeBrandVars } = await import('../brand-vars.ts');
const { createTokenSet } = await import('../../../../engine/src/tokens.ts');

const demo = JSON.parse(readFileSync(new URL('../../../../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json', import.meta.url), 'utf8'));
const start = JSON.parse(readFileSync(new URL('../../../../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url), 'utf8'));
const COLOURWAYS = ['spearmint', 'morning', 'spring', 'beach', 'afternoon', 'midnight'];

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const leadOf = (colourway: string, look: 'light' | 'dark'): string =>
  String(createTokenSet(demo, { theme: look, selection: { colourway } }).resolve('color.semantic.primary')).toLowerCase();

function fakeHost(profile: Record<string, unknown> = {}, document: unknown = demo) {
  let record = structuredClone(profile);
  return {
    get record() { return record; },
    profile: { get: async () => record, set: async (next: object) => { record = structuredClone(next) as Record<string, unknown>; } },
    tokens: { active: async () => ({ id: 'shipped' }), snapshot: async () => ({ document }) },
  };
}

function mount(host: ReturnType<typeof fakeHost>, look: 'light' | 'dark' = 'light') {
  const el = document.createElement('div');
  document.body.append(el);
  const seen = { visible: null as boolean | null, names: [] as Array<string | null>, repaints: 0 };
  const control = mountColourwayPref(el, {
    host, look: () => look,
    repaint: async () => { seen.repaints += 1; },
    onVisible: (visible) => { seen.visible = visible; },
    onChange: (name) => { seen.names.push(name); },
  });
  return { el, control, seen };
}

const dots = (el: HTMLElement): HTMLButtonElement[] => [...el.querySelectorAll<HTMLButtonElement>('.theme-swatch')];
const shownName = (el: HTMLElement): string => el.querySelector('.theme-swatch-name')?.textContent ?? '';

test('the row offers every colourway in the look the app is in, the canonical one named as the default', async () => {
  const { el, control, seen } = mount(fakeHost());
  await control.ready;
  assert.equal(seen.visible, true);
  assert.equal(el.querySelector('.theme-choice-label')?.textContent?.trim(), 'Your colourway');
  assert.equal(dots(el).length, COLOURWAYS.length);
  assert.equal(dots(el)[0]!.getAttribute('aria-checked'), 'true', 'the canonical colourway is in force');
  assert.equal(shownName(el), 'Spearmint (design system default)');
  assert.equal(dots(el)[5]!.getAttribute('aria-label'), 'Midnight');
  dots(el).forEach((dot, i) => { assert.equal(dot.style.getPropertyValue('--theme-swatch-lead'), leadOf(COLOURWAYS[i]!, 'light')); });
  assert.match(el.querySelector('.help-tip-pop')?.textContent ?? '', /where new work starts/);
  control.destroy();
});

test('in the dark look every dot shows that colourway\'s dark lead', async () => {
  const { el, control } = mount(fakeHost(), 'dark');
  await control.ready;
  dots(el).forEach((dot, i) => { assert.equal(dot.style.getPropertyValue('--theme-swatch-lead'), leadOf(COLOURWAYS[i]!, 'dark')); });
  control.destroy();
});

test('a press saves the choice for the active design system and repaints the chrome', async () => {
  const host = fakeHost({ firstname: 'Ada' });
  const { el, control, seen } = mount(host);
  await control.ready;
  dots(el)[5]!.click();
  await flush(); await flush();
  assert.deepEqual(host.record.colourways, { shipped: 'midnight' });
  assert.equal(host.record.firstname, 'Ada');
  assert.equal(seen.repaints, 1);
  assert.equal(seen.names.at(-1), 'Midnight');
  assert.equal(dots(el)[5]!.getAttribute('aria-checked'), 'true');
  assert.equal(shownName(el), 'Midnight');
  // Back to the design system's own: the profile stores nothing.
  dots(el)[0]!.click();
  await flush(); await flush();
  assert.equal('colourways' in host.record, false);
  assert.equal(seen.names.at(-1), null);
  assert.equal(seen.repaints, 2);
  control.destroy();
});

test('a colourway the design system no longer offers shows the canonical one, and saves nothing', async () => {
  const host = fakeHost({ colourways: { shipped: 'persimmon' } });
  const { el, control, seen } = mount(host);
  await control.ready;
  assert.equal(dots(el)[0]!.getAttribute('aria-checked'), 'true');
  assert.equal(seen.names.at(-1), null);
  assert.deepEqual(host.record.colourways, { shipped: 'persimmon' }, 'reading never rewrites the profile');
  control.destroy();
});

test('a design system with no colourways shows no row', async () => {
  const { el, control, seen } = mount(fakeHost({}, start));
  await control.ready;
  assert.equal(seen.visible, false);
  assert.equal(dots(el).length, 0);
  assert.equal(colourwayPrefGroup(start, null, 'light'), null);
  assert.equal(colourwayPrefGroup(null, 'midnight', 'light'), null);
  control.destroy();
});

test('a design-system switch reads the design system and the choice again', async () => {
  let document: unknown = start;
  const host = { ...fakeHost({ colourways: { shipped: 'beach' } }) };
  host.tokens = { active: async () => ({ id: 'shipped' }), snapshot: async () => ({ document }) };
  const { el, control, seen } = mount(host);
  await control.ready;
  assert.equal(seen.visible, false);
  document = demo;
  window.dispatchEvent(new CustomEvent('lolly:design-system-changed'));
  await flush(); await flush();
  assert.equal(seen.visible, true);
  assert.equal(dots(el)[3]!.getAttribute('aria-checked'), 'true');
  assert.equal(seen.names.at(-1), 'Beach');
  control.destroy();
});

test('the chrome painter paints the chosen colourway, and the canonical one without a choice', async () => {
  const surface = (selection?: Record<string, string>) => ({
    resolve: async (ref: string, opts?: { theme?: string; selection?: Record<string, string> }) => createTokenSet(demo, { ...opts, selection: opts?.selection ?? selection }).resolve(ref),
    colors: async (opts?: { theme?: string; selection?: Record<string, string> }) => createTokenSet(demo, { ...opts, selection: opts?.selection ?? selection }).colors(),
    themes: async () => createTokenSet(demo).themes(),
    active: async () => ({ id: 'shipped' }),
  });
  const brandPrimary = (): string => document.documentElement.style.getPropertyValue('--brand-primary');
  // The open artefact chose Beach (the route's selection); the person chose Midnight.
  await applyChromeBrandVars({ tokens: surface({ colourway: 'beach' }), profile: { get: async () => ({ colourways: { shipped: 'midnight' } }) } });
  assert.equal(brandPrimary().toLowerCase(), leadOf('midnight', 'light'));
  await applyChromeBrandVars({ tokens: surface({ colourway: 'beach' }), profile: { get: async () => ({}) } });
  assert.equal(brandPrimary().toLowerCase(), leadOf('spearmint', 'light'));
  await applyChromeBrandVars({ tokens: surface({ colourway: 'beach' }) });
  assert.equal(brandPrimary().toLowerCase(), leadOf('spearmint', 'light'), 'a host with no profile keeps the canonical colourway');
});
