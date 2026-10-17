// SPDX-License-Identifier: MPL-2.0
/**
 * The tool sidebar's Design system section, views/tool/theme-section.ts (plans/319 A4).
 *
 * What these pin: the section stays hidden, and its control unloaded, while the
 * design system offers nothing to choose; it appears when a choice arrives
 * without a remount; it opens on its first show only for a colourway and never
 * reopens a fold the person closed; a switch re-seeds the colour field's
 * swatches from the scoped host; and a destroyed section stops listening.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/tool/theme-section.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
for (const k of ['window', 'document', 'HTMLElement', 'HTMLButtonElement', 'HTMLSelectElement', 'HTMLDetailsElement', 'Element', 'Node', 'Event', 'KeyboardEvent', 'MouseEvent', 'CustomEvent', 'localStorage']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}

const themeChoices = await import('../../components/theme-choices.ts');
const { mountThemeSection, opensByDefault, refreshThemeSwatches } = await import('./theme-section.ts');
const { COLOURWAY, MODE, fakeThemeController } = await import('../__fixtures__/theme-groups.ts');

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const load = async () => themeChoices;

function sectionRoot(): HTMLElement {
  const root = document.createElement('div');
  document.body.append(root);
  root.innerHTML = '<details class="input-section" id="theme-section" hidden><summary class="input-section-summary">Design system</summary><div class="input-section-body" id="theme-section-body"></div></details>';
  return root;
}

test('the section stays hidden with nothing to choose, and appears when a design-system switch brings choices', async () => {
  const root = sectionRoot();
  const section = root.querySelector<HTMLDetailsElement>('#theme-section')!;
  const f = fakeThemeController([]);
  let loads = 0;
  const mounted = mountThemeSection({ root, controller: f.controller, load: async () => { loads++; return themeChoices; } });
  await flush();
  assert.equal(section.hidden, true);
  assert.equal(loads, 0, 'the control is not even loaded');
  assert.equal(root.querySelector('#theme-section-body')!.childElementCount, 0);
  f.replace([MODE]);
  await flush();
  assert.equal(section.hidden, false);
  assert.equal(section.open, false, 'light and dark alone open folded');
  assert.equal(loads, 1);
  f.replace([]);
  assert.equal(section.hidden, true);
  mounted.destroy();
});

test('the section opens on its first show when there is a colourway to pick, and leaves the fold to the person after', async () => {
  assert.equal(opensByDefault([MODE]), false);
  assert.equal(opensByDefault([MODE, COLOURWAY]), true);
  const root = sectionRoot();
  const section = root.querySelector<HTMLDetailsElement>('#theme-section')!;
  const f = fakeThemeController([MODE, COLOURWAY]);
  const mounted = mountThemeSection({ root, controller: f.controller, load });
  await flush();
  assert.equal(section.hidden, false);
  assert.equal(section.open, true);
  section.open = false;
  f.setFromElsewhere('', 'dark');
  assert.equal(section.open, false, 'a redraw never reopens a section the person folded');
  mounted.destroy();
  assert.equal(f.listeners.size, 0, 'a destroyed section and its control stop listening');
  assert.equal(root.querySelector('#theme-section-body')!.childElementCount, 0);
});

test('a view with no sidebar (an editor layout) mounts nothing and never loads the control', async () => {
  const root = document.createElement('div');
  const f = fakeThemeController([MODE, COLOURWAY]);
  let loads = 0;
  const mounted = mountThemeSection({ root, controller: f.controller, load: async () => { loads++; return themeChoices; } });
  await flush();
  assert.equal(loads, 0);
  mounted.destroy();
});

test('a control that fails to load leaves the section hidden and tries again on the next change', async () => {
  const root = sectionRoot();
  const section = root.querySelector<HTMLDetailsElement>('#theme-section')!;
  const f = fakeThemeController([MODE]);
  let attempts = 0;
  const warn = console.warn;
  console.warn = () => {};
  try {
    mountThemeSection({
      root, controller: f.controller,
      load: async () => { attempts++; if (attempts === 1) throw new Error('offline'); return themeChoices; },
    });
    await flush();
    assert.equal(section.hidden, true, 'no half-drawn section');
    f.setFromElsewhere('', 'dark');
    await flush();
  } finally { console.warn = warn; }
  assert.equal(attempts, 2);
  assert.equal(section.hidden, false);
});

test('a switch re-seeds the colour field swatches from the scoped host and redraws the open grids', async () => {
  const seeded: unknown[] = [];
  const redrawn: unknown[] = [];
  const scope = document.createElement('div');
  const sink = { setSwatches: (list: unknown) => seeded.push(list), refreshSwatches: (el: HTMLElement) => redrawn.push(el) };
  const scoped = { tokens: { colors: async () => [{ path: 'color.semantic.primary', name: 'Primary', group: 'Semantic', value: '#c2410c', ref: '{color.semantic.primary}', cmyk: null, spot: null }] } };
  await refreshThemeSwatches(scoped as never, scope, sink);
  assert.deepEqual((seeded[0] as Array<{ value: string; ref: string; label: string }>).map((s) => [s.value, s.ref, s.label]), [['#c2410c', '{color.semantic.primary}', 'Primary']]);
  assert.deepEqual(redrawn, [scope]);
  await refreshThemeSwatches({ tokens: { colors: async () => [] } } as never, scope, sink);
  assert.equal(seeded.length, 1, 'an empty answer keeps the swatches standing');
  await refreshThemeSwatches(scoped as never, null, sink);
  assert.equal(seeded.length, 2, 'the mount seeds with no grid to redraw');
  assert.equal(redrawn.length, 1);
});
