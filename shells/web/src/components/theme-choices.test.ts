// SPDX-License-Identifier: MPL-2.0
/**
 * The design system's choices for one document (components/theme-choices.ts),
 * plans/319 A4. The sidebar section around the control has its own suite,
 * views/tool/theme-section.test.ts.
 *
 * What these pin: a colourway draws as named swatch dots coloured through the
 * CSSOM, the mode as a segmented radio group, anything else as a labelled select;
 * every control is a keyboard radio group with one tab stop; a press reaches the
 * shared controller, and a change made elsewhere (the Design inspector) redraws
 * this control.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/components/theme-choices.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
for (const k of ['window', 'document', 'HTMLElement', 'HTMLButtonElement', 'HTMLSelectElement', 'HTMLDetailsElement', 'Element', 'Node', 'Event', 'KeyboardEvent', 'MouseEvent', 'CustomEvent', 'localStorage']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}

const themeChoices = await import('./theme-choices.ts');
const { mountThemeChoices, rowKind } = themeChoices;
import { COLOURWAY, DENSITY, MODE, fakeThemeController as fakeController } from '../views/__fixtures__/theme-groups.ts';

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const host = (): HTMLElement => { const el = document.createElement('div'); document.body.append(el); return el; };
const radios = (el: HTMLElement, row: number): HTMLButtonElement[] => [...el.querySelectorAll<HTMLButtonElement>(`[role="radio"][data-theme-row="${row}"]`)];
const key = (target: Element, k: string): void => { target.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); };

test('each kind of group draws as the smallest control that says what it is', () => {
  assert.equal(rowKind(COLOURWAY), 'swatches');
  assert.equal(rowKind(MODE), 'segments');
  assert.equal(rowKind(DENSITY), 'select');
  assert.equal(rowKind({ ...COLOURWAY, options: COLOURWAY.options.map(({ swatch: _s, ...o }) => o) }), 'segments', 'a colourway whose colours are unreadable falls back to names');
  const many = { ...MODE, options: Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, label: `M${i}`, canonical: i === 0 })) };
  assert.equal(rowKind(many), 'select');
  const hostile = { ...COLOURWAY, options: [{ id: 'x', label: 'X', canonical: true, swatch: { lead: 'red;background:url(//x)', partner: null } }, COLOURWAY.options[1]!] };
  assert.equal(rowKind(hostile), 'segments', 'a value that is not a plain hex colour is never drawn as one');
});

test('a colourway is a radio group of named dots coloured through the CSSOM, with the chosen name beside them', () => {
  const el = host();
  const f = fakeController([COLOURWAY, MODE, DENSITY]);
  const control = mountThemeChoices(el, f.controller);
  const group = el.querySelector<HTMLElement>('.theme-swatches')!;
  assert.equal(group.getAttribute('role'), 'radiogroup');
  const labelId = group.getAttribute('aria-labelledby')!;
  assert.equal(el.querySelector(`#${labelId}`)?.textContent, 'Colourway');
  const dots = radios(el, 0);
  assert.deepEqual(dots.map((d) => d.getAttribute('aria-label')), ['Pine', 'Persimmon', 'Water<hole>']);
  assert.deepEqual(dots.map((d) => d.getAttribute('aria-checked')), ['true', 'false', 'false']);
  assert.deepEqual(dots.map((d) => d.tabIndex), [0, -1, -1], 'one tab stop per group');
  assert.equal(dots[1]!.style.getPropertyValue('--theme-swatch-lead'), '#c2410c');
  assert.equal(dots[2]!.style.getPropertyValue('--theme-swatch-partner'), '#2453ff', 'no partner draws the lead alone');
  assert.match(dots[1]!.getAttribute('style') ?? '', /^--theme-swatch-lead: #c2410c; --theme-swatch-partner: #7c2d12;$/, 'only the two custom properties, set through the CSSOM');
  assert.equal(el.querySelector('hole'), null, 'labels are escaped, so a name never becomes markup');
  assert.ok(!el.innerHTML.includes('persimmon'), 'option ids never reach the markup');
  assert.equal(el.querySelector('.theme-swatch-name')?.textContent, 'Pine');
  assert.equal(el.querySelectorAll('.help-tip-btn').length, 1, 'one tip, on the first row');
  const modeGroup = el.querySelectorAll('[role="radiogroup"]')[1]!;
  assert.ok(modeGroup.classList.contains('badge-select--segmented'));
  assert.deepEqual(radios(el, 1).map((b) => b.textContent), ['Light', 'Dark']);
  const select = el.querySelector<HTMLSelectElement>('select[data-theme-row="2"]')!;
  assert.equal(el.querySelector(`#${select.getAttribute('aria-labelledby')}`)?.textContent, 'Density');
  control.destroy();
  assert.equal(el.childElementCount, 0);
  assert.equal(f.listeners.size, 0, 'a destroyed control stops listening');
});

test('a press, an arrow key and a select change each reach the controller once', async () => {
  const el = host();
  const f = fakeController([COLOURWAY, MODE, DENSITY]);
  mountThemeChoices(el, f.controller);
  radios(el, 0)[1]!.click();
  await flush();
  assert.deepEqual(f.chosen, [['colourway', 'persimmon']]);
  assert.equal(radios(el, 0)[1]!.getAttribute('aria-checked'), 'true');
  assert.equal(el.querySelector('.theme-swatch-name')?.textContent, 'Persimmon');
  radios(el, 0)[1]!.click();
  await flush();
  assert.equal(f.chosen.length, 1, 'the colourway already shown asks for nothing');

  radios(el, 1)[0]!.focus();
  key(radios(el, 1)[0]!, 'ArrowRight');
  await flush();
  assert.deepEqual(f.chosen.at(-1), ['', 'dark']);
  assert.equal(document.activeElement, radios(el, 1)[1], 'focus follows the choice through the redraw');
  key(radios(el, 1)[1]!, 'Home');
  await flush();
  assert.deepEqual(f.chosen.at(-1), ['', 'light']);
  key(radios(el, 0)[1]!, 'End');
  await flush();
  assert.deepEqual(f.chosen.at(-1), ['colourway', 'waterhole']);

  const select = el.querySelector<HTMLSelectElement>('select[data-theme-row="2"]')!;
  select.value = '1';
  select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await flush();
  assert.deepEqual(f.chosen.at(-1), ['spacing', 'tight']);
});

test('a choice made in another surface redraws this one, and a refused choice puts the row back', async () => {
  const el = host();
  const f = fakeController([COLOURWAY]);
  mountThemeChoices(el, f.controller);
  f.setFromElsewhere('colourway', 'waterhole');
  assert.equal(radios(el, 0)[2]!.getAttribute('aria-checked'), 'true');

  const refusing = fakeController([COLOURWAY], { fail: true });
  const other = host();
  mountThemeChoices(other, refusing.controller);
  const warn = console.warn;
  console.warn = () => {};
  try {
    radios(other, 0)[1]!.click();
    assert.equal(radios(other, 0)[1]!.getAttribute('aria-checked'), 'true', 'the press shows at once');
    await flush();
  } finally { console.warn = warn; }
  assert.equal(radios(other, 0)[0]!.getAttribute('aria-checked'), 'true', 'and goes back when the switch fails');
});

test('the section tip opens from its button and closes with Escape, inside the control\'s own wiring', () => {
  const el = host();
  const f = fakeController([COLOURWAY, MODE]);
  const control = mountThemeChoices(el, f.controller);
  const button = el.querySelector<HTMLButtonElement>('.help-tip-btn')!;
  const pop = el.querySelector<HTMLElement>('.help-tip-pop')!;
  assert.equal(pop.hidden, true);
  button.click();
  assert.equal(pop.hidden, false, 'the sidebar wires tips in #tool-inputs only, so this control wires its own');
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  key(button, 'Escape');
  assert.equal(pop.hidden, true);
  assert.equal(f.chosen.length, 0, 'the tip never chooses anything');
  control.destroy();
  assert.equal((el as HTMLElement & { _helpTipsWired?: boolean })._helpTipsWired, undefined, 'a destroyed control drops its tip wiring');
});
