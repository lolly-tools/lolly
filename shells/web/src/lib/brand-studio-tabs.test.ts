// SPDX-License-Identifier: MPL-2.0
// The Tokens room through its DOM: what it draws for a full, a sparse and an
// empty system, and that its sliders write through the editor's own document.
// Run with node --import ./tests/css-stub.mjs --test <this file>.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import type { HostV1 } from '@lolly-tools/core/host-v1';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost:5173/#/start?area=tokens', pretendToBeVisual: true });
const original = new Map<string, PropertyDescriptor | undefined>();
const setGlobal = (key: string, value: unknown): void => {
  original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
};
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'HTMLDetailsElement', 'HTMLFormElement', 'Element', 'Node', 'getComputedStyle', 'location', 'localStorage', 'sessionStorage', 'CustomEvent', 'MutationObserver', 'Event', 'MouseEvent', 'KeyboardEvent', 'FocusEvent', 'SubmitEvent', 'navigator', 'history', 'requestAnimationFrame', 'cancelAnimationFrame', 'DOMRect', 'AbortController', 'AbortSignal', 'FormData']) setGlobal(key, (dom.window as unknown as Record<string, unknown>)[key]);
(dom.window as unknown as { matchMedia: unknown }).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
setGlobal('matchMedia', (dom.window as unknown as { matchMedia: unknown }).matchMedia);
setGlobal('CSS', { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, c => `\\${c}`), supports: () => false });
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
after(() => {
  for (const [key, desc] of original) { if (desc) Object.defineProperty(globalThis, key, desc); else delete (globalThis as Record<string, unknown>)[key]; }
  dom.window.close();
});

const { mountTokensPanel, tokensRoomModel } = await import('./brand-studio-tabs.ts');
const { walkSwatches } = await import('./brand-doc.ts');
const { colorIdentity } = await import('./design-system/ownership.ts');
type Ctx = Parameters<typeof mountTokensPanel>[1];

const DEMO = JSON.parse(readFileSync(new URL('../../../../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json', import.meta.url), 'utf8')) as Record<string, unknown>;
const NEUTRALS = ['#1d1d1d', '#3e3e3e', '#525252', '#6f6f6f', '#999999', '#bababa', '#dcdbdc', '#efefef', '#ffffff'];
const neutralDoc = (): Record<string, unknown> => ({
  color: { ramp: { neutral: Object.fromEntries(NEUTRALS.map((hex, i) => [String(i + 1), { $type: 'color', $value: hex }])) } },
});
const colourOnly = (): Record<string, unknown> => ({ color: { brand: { teal: { $type: 'color', $value: '#127a7a', $description: 'Teal' } } } });

function mount(initial: Record<string, unknown>, starter: ReadonlySet<string> = new Set()) {
  let doc = structuredClone(initial);
  const calls = { setDoc: 0, persist: [] as boolean[], notify: 0, undo: [] as string[], clipboard: [] as string[] };
  const host = {
    clipboard: { writeText: async (text: string) => { calls.clipboard.push(text); } },
    tokens: { active: async () => ({ id: 'test', label: 'Test system' }) },
  } as unknown as HostV1;
  const ctx: Ctx = {
    host,
    doc: () => doc,
    setDoc: next => { calls.setDoc++; doc = next; },
    persist: immediate => { calls.persist.push(!!immediate); },
    notify: () => { calls.notify++; },
    pushUndo: label => { calls.undo.push(label); },
    swatches: () => walkSwatches(doc, 'light'),
    starterIds: () => starter,
  };
  const el = document.createElement('div');
  el.className = 'be-tokens';
  document.body.appendChild(el);
  const panel = mountTokensPanel(el, ctx);
  const $ = <T extends HTMLElement = HTMLElement>(sel: string): T | null => el.querySelector<T>(sel);
  return { el, panel, ctx, calls, $, done: () => { panel.teardown(); el.remove(); } };
}
const tick = (ms = 30): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

test('Lolly Demo: tiles and sections carry the system’s counts', () => {
  const m = mount(DEMO);
  try {
    const n = (id: string): string => m.$(`[data-tk-jump="${id}"] .tk-tile-n`)!.textContent!;
    const colours = walkSwatches(DEMO, 'light').length;
    assert.equal(n('color'), String(colours));
    assert.equal(n('type'), '4');
    assert.equal(n('logos'), '9');
    assert.equal(n('shape'), '2');
    assert.equal(n('all'), '93');
    for (const id of ['color', 'type', 'logos', 'shape', 'more']) assert.ok(m.$(`[data-tk-sec="${id}"]`), id);
    assert.match(m.$('[data-tk-jump="type"]')!.getAttribute('aria-label')!, /^Type: 4$/);
    assert.equal(m.el.querySelectorAll('[data-tk-sec="type"] .tk-row').length, 4);
    assert.equal(m.el.querySelectorAll('[data-tk-sec="logos"] .tk-row').length, 9);
    assert.ok(m.$('[data-tk-pairs="light"]'), 'the contrast pairs lead the Colours section');
    assert.equal(m.$<HTMLElement>('[data-tk-example]')!.hidden, false);
    assert.match(m.$('[data-tk-example]')!.textContent!, /^For example, Primary is Spearmint, #033633\.$/);
    for (const fold of ['ui', 'inspect']) assert.equal(m.$<HTMLDetailsElement>(`[data-tk-adv="${fold}"]`)!.open, false, `${fold} starts closed`);
  } finally { m.done(); }
});

test('an empty system shows one room card, and Shape, More tokens and both folds stay', () => {
  const m = mount({});
  try {
    const card = m.$('.tk-empty--room')!;
    assert.ok(card);
    assert.match(card.textContent!, /Nothing here yet\./);
    assert.equal(card.querySelectorAll('a.be-btn, button').length, 3, 'Pick a colour, Choose a face, Add from…');
    assert.equal(m.$('[data-tk-overview]'), null);
    for (const id of ['color', 'type', 'logos']) assert.equal(m.$(`[data-tk-sec="${id}"]`), null, id);
    assert.ok(m.$('[data-tk-sec="shape"]'));
    assert.ok(m.$('[data-tk-sec="more"]'));
    assert.ok(m.$('[data-tk-adv="ui"]'));
    assert.ok(m.$('[data-tk-adv="inspect"]'));
    assert.equal(m.$<HTMLElement>('[data-tk-example]')!.hidden, true);
    assert.equal(m.$('[data-tk-radius-own]')!.textContent, 'Lolly default');
  } finally { m.done(); }
});

test('a colour-only system draws its one colour and the Type and Logos blank states', () => {
  const m = mount(colourOnly());
  try {
    assert.equal(m.el.querySelectorAll('[data-tk-sec="color"] .tk-color').length, 1);
    assert.match(m.$('[data-tk-body="type"] .tk-empty')!.textContent!, /No typeface chosen yet\. Lolly uses SUSE until you pick one\./);
    assert.equal(m.$<HTMLAnchorElement>('[data-tk-body="type"] .tk-empty a')!.getAttribute('href'), '#/start?area=type');
    assert.match(m.$('[data-tk-body="logos"] .tk-empty')!.textContent!, /No logos yet\. Drop a logo file and Lolly suggests its slot\./);
    assert.equal(m.$<HTMLAnchorElement>('[data-tk-body="logos"] .tk-empty a')!.getAttribute('href'), '#/start?area=logos');
    assert.equal(m.$('[data-tk-sec="type"] .tk-sec-act'), null, 'no Edit in Type beside its own blank state');
  } finally { m.done(); }
});

test('only the starter neutrals: the starter group with its note, no pairs, and the head opens that group', () => {
  const starter = new Set(walkSwatches(neutralDoc(), 'light').map(s => colorIdentity(s.key, s.raw)));
  const m = mount(neutralDoc(), starter);
  try {
    assert.match(m.$('[data-tk-sec="color"] .tk-group-name')!.textContent!, /^Neutrals · starter · 9$/);
    assert.match(m.$('[data-tk-sec="color"] .tk-group-note')!.textContent!, /Lolly's ink and paper/);
    assert.equal(m.el.querySelectorAll('[data-tk-sec="color"] .stu-chip').length, 9);
    assert.equal(m.$('[data-tk-pairs]'), null);
    assert.equal(m.$<HTMLAnchorElement>('[data-tk-sec="color"] .tk-sec-act')!.getAttribute('href'), '#/start?area=color&group=neutral');
    assert.equal(tokensRoomModel(neutralDoc(), starter).starterOnly, true);
  } finally { m.done(); }
});

test('space.base lives on its slider, never in More tokens', () => {
  const doc = { ...colourOnly(), space: { $type: 'dimension', base: { $type: 'dimension', $value: '0.75rem' }, gutter: { $type: 'dimension', $value: '16px', $description: 'Gutter' } } };
  const m = mount(doc);
  try {
    const names = [...m.el.querySelectorAll('[data-tok-row] .be-tok-name')].map(n => n.textContent);
    assert.deepEqual(names, ['Gutter']);
    assert.equal(m.$('[data-tk-jump="more"] .tk-tile-n')!.textContent, '1');
    assert.equal(m.$('[data-be-space-value]')!.textContent, '0.75rem');
    assert.equal(m.$('[data-tk-space-own]')!.textContent, 'Yours');
  } finally { m.done(); }
});

test('a slider drag pushes one undo step and writes through the editor’s document', () => {
  const m = mount(colourOnly());
  try {
    const slider = m.$<HTMLInputElement>('[data-be-radius-slider]')!;
    slider.value = '0.3'; slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.value = '0.25'; slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    assert.deepEqual(m.calls.undo, ['Rounded corners']);
    assert.equal(m.calls.setDoc, 1);
    assert.equal(((m.ctx.doc().shape as Record<string, unknown>).radius as Record<string, unknown>).$value, '0.25rem');
    assert.ok(m.calls.persist.length >= 1);
    assert.equal(m.$('[data-tk-radius-own]')!.textContent, 'Yours');
    // A second drag is a second undo step.
    slider.value = '0.5'; slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    assert.equal(m.calls.undo.length, 2);
  } finally { m.done(); }
});

test('a slider write survives the next edit from the same room (the lost update)', () => {
  const m = mount(colourOnly());
  try {
    const slider = m.$<HTMLInputElement>('[data-be-radius-slider]')!;
    slider.value = '0.25'; slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    m.$<HTMLInputElement>('[data-tok-add-name]')!.value = 'Gutter';
    m.$<HTMLFormElement>('[data-tok-add]')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const saved = JSON.stringify(m.ctx.doc());
    assert.match(saved, /"radius":\{"\$type":"dimension","\$value":"0\.25rem"\}/);
    assert.match(saved, /"gutter":/);
  } finally { m.done(); }
});

test('Copy writes the reference and says so', async () => {
  const m = mount(colourOnly());
  try {
    m.$<HTMLButtonElement>('[data-tk-sec="color"] [data-tk-copy]')!.click();
    await tick(60);
    assert.deepEqual(m.calls.clipboard, ['{color.brand.teal}']);
    const said = [...document.querySelectorAll('[aria-live="polite"]')].map(r => r.textContent).join(' ');
    assert.match(said, /Copied \{color\.brand\.teal\}/);
  } finally { m.done(); }
});

test('Add from… asks the studio for its importer', () => {
  const m = mount(colourOnly());
  let asked = 0;
  const listen = (): void => { asked++; };
  document.addEventListener('lolly:start-import', listen);
  try {
    m.$<HTMLButtonElement>('.tk-actions [data-tk-import]')!.click();
    assert.equal(asked, 1);
  } finally { document.removeEventListener('lolly:start-import', listen); m.done(); }
});

test('the inspect fold mounts the workspace on first open, not before', async () => {
  const m = mount(colourOnly());
  try {
    assert.equal(m.$('[data-tk-workspace]')!.children.length, 0);
    const fold = m.$<HTMLDetailsElement>('[data-tk-adv="inspect"]')!;
    fold.open = true; fold.dispatchEvent(new Event('toggle'));
    await tick();
    assert.ok(m.$('[data-tk-workspace] [data-tw-list]'));
    assert.equal(m.$('[data-tk-workspace] .section-header-title')!.textContent, 'All tokens');
  } finally { m.done(); }
});

test('a token name already taken is refused in words', () => {
  const m = mount(colourOnly());
  try {
    const add = (name: string): void => {
      m.$<HTMLInputElement>('[data-tok-add-name]')!.value = name;
      m.$<HTMLFormElement>('[data-tok-add]')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    };
    add('Gutter');
    add('gutter');
    assert.equal(m.$('[data-tok-err]')!.textContent, 'You already have a token called gutter.');
    assert.equal(m.el.querySelectorAll('[data-tok-row]').length, 1);
  } finally { m.done(); }
});

test('a refused More tokens value is marked on its row and put back on blur', () => {
  const m = mount({ ...colourOnly(), space: { $type: 'dimension', gutter: { $type: 'dimension', $value: '16px', $description: 'Gutter' } } });
  try {
    const field = m.$<HTMLInputElement>('[data-tok-input="dimension"]')!;
    field.value = '1.5re'; field.dispatchEvent(new Event('change', { bubbles: true }));
    assert.equal(field.getAttribute('aria-invalid'), 'true');
    assert.match(m.$('[data-tok-row] .tk-row-err')!.textContent!, /use a CSS length like 8px or 0\.5rem/);
    field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    assert.equal(field.value, '16px');
    assert.equal(field.hasAttribute('aria-invalid'), false);
    assert.equal(m.$('[data-tok-row] .tk-row-err'), null);
  } finally { m.done(); }
});
