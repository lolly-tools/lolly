// SPDX-License-Identifier: MPL-2.0
/**
 * cover.ts: the small cover the Settings strip and the Preferences rows share.
 * Pins that only plain hex reaches its style attribute, one logo element per
 * distinct file with the app themes it serves, the monogram for the themes
 * with no logo, the row band's extra colours and the image-error fallback.
 * Run:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/design-system/cover.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { coverHtml, coverVars, wireCoverImages, type CoverPreview } from './cover.ts';
import type { CoverLooks } from './preview.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
const doc = dom.window.document;

const LOOKS: CoverLooks = {
  light: { surface: '#ffffff', ink: '#09141a', primary: '#033633', onPrimary: '#ffffff', secondary: '#008657' },
  dark: { surface: '#09141a', ink: '#ffffff', primary: '#50c369', onPrimary: '#09141a', secondary: '#008657' },
};

const preview = (over: Partial<CoverPreview> = {}): CoverPreview => ({
  looks: LOOKS, logos: {}, monogram: 'L', display: "'Outfit', ui-sans-serif, sans-serif", colors: ['#033633', '#008657', '#50c369', '#ace1ad', '#edf6e0', '#444f05'], ...over,
});

function mount(html: string): HTMLElement {
  const host = doc.createElement('div');
  host.innerHTML = html;
  return host.firstElementChild as HTMLElement;
}

const varsOf = (el: HTMLElement): Map<string, string> => new Map((el.getAttribute('style') ?? '').split(';').filter(Boolean).map(d => {
  const at = d.indexOf(':');
  return [d.slice(0, at), d.slice(at + 1)] as [string, string];
}));

test('both looks travel as variables, and only plain hex reaches the style attribute', () => {
  const vars = coverVars(LOOKS);
  assert.match(vars, /--cv-l-surface:#ffffff/);
  assert.match(vars, /--cv-d-primary:#50c369/);
  const evil = 'red;background:url(x)';
  const bad = coverVars({
    light: { surface: evil, ink: '#09141a', primary: 'url(x)', onPrimary: '#fff', secondary: '#008657' },
    dark: { surface: evil, ink: '#ffffff', primary: '#50c369', onPrimary: 'expression(1)', secondary: '#008657' },
  });
  assert.doesNotMatch(bad, /url|red|expression|background/);
  for (const decl of bad.split(';')) assert.match(decl, /^--cv-[ld]-[a-z-]+:#[0-9a-f]{6,8}$/, decl);
  assert.match(bad, /--cv-l-surface:#ffffff/, 'a light slot that is not hex takes plain white');
  assert.doesNotMatch(bad, /--cv-d-surface/, 'a dark slot that is not hex is left out, so the light one shows');
  assert.doesNotMatch(coverVars({ light: LOOKS.light }), /--cv-d-/, 'no dark look, no dark variables');
});

test('a thumbnail carries one logo per distinct file, each naming the app themes it serves', () => {
  const el = mount(coverHtml(preview({ logos: { light: '/l.svg', dark: '/rev.svg', brand: '/rev.svg' } }), 'thumb'));
  assert.equal(el.className, 'ds-cover ds-cover--thumb ds-look');
  assert.equal(el.getAttribute('aria-hidden'), 'true');
  assert.equal(el.querySelector('[aria-label]'), null, 'nothing inside claims a name of its own');
  assert.deepEqual([...el.querySelectorAll('img.ds-cover-logo')].map(img => [img.getAttribute('src'), img.getAttribute('data-looks'), img.getAttribute('alt')]),
    [['/l.svg', 'light', ''], ['/rev.svg', 'dark brand', '']]);
  assert.equal(el.querySelector<HTMLElement>('.ds-cover-mono')!.dataset.looks, '');
  assert.equal(el.querySelectorAll('.ds-cover-band i').length, 2, 'a thumbnail band is the primary and the secondary only');
  for (const [name, value] of varsOf(el)) assert.match(value, /^#[0-9a-f]{6,8}$/, name);
});

test('the monogram stands in for every theme with no logo, and a system with no dark look shows its light logo in dark', () => {
  const none = mount(coverHtml(preview(), 'thumb'));
  assert.equal(none.querySelectorAll('img').length, 0);
  assert.equal(none.querySelector<HTMLElement>('.ds-cover-mono')!.dataset.looks, 'light dark brand');
  assert.equal(none.querySelector('.ds-cover-mono')!.textContent, 'L');

  const lightOnly = mount(coverHtml(preview({ looks: { light: LOOKS.light }, logos: { light: '/l.svg', dark: '/rev.svg' } }), 'thumb'));
  assert.deepEqual([...lightOnly.querySelectorAll('img')].map(img => [img.getAttribute('src'), img.getAttribute('data-looks')]), [['/l.svg', 'light dark']],
    'the reverse form would vanish on the light ground the dark theme falls back to');
  assert.equal(lightOnly.querySelector<HTMLElement>('.ds-cover-mono')!.dataset.looks, 'brand');
});

test('a logo URL with an unsafe scheme never reaches the markup', () => {
  const el = mount(coverHtml(preview({ logos: { light: 'javascript:alert(1)', dark: 'data:text/html,<b>x</b>', brand: 'blob:https://lolly.tools/1' } }), 'thumb'));
  assert.deepEqual([...el.querySelectorAll('img')].map(img => img.getAttribute('src')), ['blob:https://lolly.tools/1']);
  assert.equal(el.querySelector<HTMLElement>('.ds-cover-mono')!.dataset.looks, 'light dark');
});

test('a row band adds up to four more of the system colours, never repeating a ground, primary or secondary', () => {
  const el = mount(coverHtml(preview({ colors: ['#033633', '#ffffff', '#008657', '#50c369', '#ace1ad', '#edf6e0', '#444f05', '#123456', '#654321'] }), 'row'));
  assert.equal(el.className, 'ds-cover ds-cover--row ds-look');
  const extra = [...el.querySelectorAll<HTMLElement>('.ds-cover-band i[style]')].map(i => i.getAttribute('style'));
  assert.deepEqual(extra, ['--sw:#ace1ad', '--sw:#edf6e0', '--sw:#444f05', '--sw:#123456']);
  assert.equal(el.querySelectorAll('.ds-cover-band i').length, 6);
  const sly = mount(coverHtml(preview({ colors: ['#033633', 'red;x:url(y)', '#abcdef'] }), 'row'));
  assert.deepEqual([...sly.querySelectorAll('.ds-cover-band i[style]')].map(i => i.getAttribute('style')), ['--sw:#abcdef']);
});

test('the display face is used only where the browser holds it: always for the active system', () => {
  const active = mount(coverHtml(preview(), 'thumb', { active: true }));
  assert.equal(varsOf(active).get('--cv-font'), "'Outfit', ui-sans-serif, sans-serif");
  const inactive = mount(coverHtml(preview(), 'thumb'));
  assert.equal(varsOf(inactive).has('--cv-font'), false, 'an unregistered face falls back to the shell text face in CSS');
});

test('a logo that fails to load leaves, and the monogram takes over its themes', () => {
  const holder = doc.createElement('div');
  holder.innerHTML = coverHtml(preview({ logos: { light: '/l.svg', dark: '/rev.svg', brand: '/rev.svg' } }), 'thumb');
  wireCoverImages(holder);
  holder.querySelector('img[data-looks="dark brand"]')!.dispatchEvent(new dom.window.Event('error'));
  assert.equal(holder.querySelectorAll('img').length, 1);
  assert.equal(holder.querySelector<HTMLElement>('.ds-cover-mono')!.dataset.looks, 'dark brand');
  holder.querySelector('img')!.dispatchEvent(new dom.window.Event('error'));
  assert.equal(holder.querySelector<HTMLElement>('.ds-cover-mono')!.dataset.looks, 'light dark brand', 'themes stay in their fixed order');
});
