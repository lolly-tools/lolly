// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
import type { EmojiAPI } from '@lolly-tools/core/host-v1';
import type { EmojiPackManifestV1, EmojiPackPinV1 } from '@lolly-tools/core/emoji-v1';
import { applyEmojiCategories, filterEmojiSet, loadEmojiSet } from '../lib/emoji-set.ts';
import { emojiCategoryValue } from '../lib/emoji-categories.ts';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://lolly.tools/' });
for (const key of ['window', 'document', 'DOMParser', 'HTMLElement', 'Element', 'Event', 'KeyboardEvent', 'localStorage']) {
  (globalThis as Record<string, unknown>)[key] = (dom.window as unknown as Record<string, unknown>)[key];
}
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

class Observer {
  static latest: Observer;
  targets = new Set<Element>();
  callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) { this.callback = callback; Observer.latest = this; }
  observe(target: Element): void { this.targets.add(target); }
  unobserve(target: Element): void { this.targets.delete(target); }
  disconnect(): void { this.targets.clear(); }
  reveal(target: Element): void {
    this.callback([{ target, isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}
globalThis.IntersectionObserver = Observer as unknown as typeof IntersectionObserver;

const { mountEmojiSetBrowser } = await import('./emoji-set-browser.ts');
const fixture = (name: string): Buffer => readFileSync(new URL(`../../../../tests/fixtures/emoji/twemoji/${name}`, import.meta.url));

function pack() {
  const manifest = JSON.parse(fixture('manifest.json').toString()) as EmojiPackManifestV1;
  const glyph = manifest.glyphs[0]!;
  manifest.glyphs = [
    glyph,
    { ...glyph, meaning: { kind: 'unicode', key: '1f44d-1f3fd' }, label: 'thumbs up: medium skin tone' },
    { ...glyph, meaning: { kind: 'custom', id: 'test/logo' }, label: 'Custom <logo>' },
  ];
  const bytes = new TextEncoder().encode(JSON.stringify(manifest));
  const pin: EmojiPackPinV1 = { id: manifest.id, pin: { version: manifest.version }, checksum: `sha256:${createHash('sha256').update(bytes).digest('hex')}` };
  let reads = 0;
  const api: EmojiAPI = {
    sets: async () => [], manifest: async () => bytes,
    artwork: async () => { reads++; return new Uint8Array(fixture('1f600.svg')); },
    parseXml: source => new DOMParser().parseFromString(source, 'image/svg+xml'),
  };
  return { api, pin, bytes, reads: () => reads };
}

/**
 * The same fixture pack, carrying ONE single-ink glyph: black line art on nothing,
 * which is the shape OpenMoji Black and Fluent High Contrast ship in. Written here
 * rather than added to tests/fixtures because it is two paths and the manifest has
 * to be re-checksummed around it anyway.
 */
const MONO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">'
  + '<circle cx="18" cy="18" r="15" fill="none" stroke="#000000" stroke-width="2"/>'
  + '<path d="M12 22 h12" stroke="#000" fill="none"/></svg>';

function monoPack() {
  const manifest = JSON.parse(fixture('manifest.json').toString()) as EmojiPackManifestV1;
  const art = new TextEncoder().encode(MONO_SVG);
  const checksum = `sha256:${createHash('sha256').update(art).digest('hex')}`;
  const glyph = manifest.glyphs[0]!;
  manifest.glyphs = [{ ...glyph, asset: { ...glyph.asset, checksum }, sourceChecksum: checksum }];
  const bytes = new TextEncoder().encode(JSON.stringify(manifest));
  const pin: EmojiPackPinV1 = { id: manifest.id, pin: { version: manifest.version }, checksum: `sha256:${createHash('sha256').update(bytes).digest('hex')}` };
  const api: EmojiAPI = {
    sets: async () => [], manifest: async () => bytes,
    artwork: async () => new Uint8Array(art),
    parseXml: source => new DOMParser().parseFromString(source, 'image/svg+xml'),
  };
  return { api, pin };
}

async function until(check: () => boolean): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.ok(check(), 'async rendering completed');
}

test('the admitted set includes custom symbols and skin tones, searchable by label, sequence and code', async () => {
  const { api, pin } = pack();
  const set = await loadEmojiSet(api, pin);
  try {
    assert.equal(set.entries.length, 3);
    assert.equal(filterEmojiSet(set.entries, 'medium thumb', 'tones')[0]?.key, '1f44d-1f3fd');
    assert.equal(filterEmojiSet(set.entries, '\u{1f600}', 'all')[0]?.key, '1f600');
    assert.equal(filterEmojiSet(set.entries, 'U+1F600', 'all')[0]?.key, '1f600');
    assert.equal(filterEmojiSet(set.entries, 'logo', 'custom')[0]?.key, 'test/logo');
    assert.equal(filterEmojiSet(set.entries, 'logo', 'emoji').length, 0);
  } finally { set.destroy(); }
});

test('only admitted artwork is drawn and object URLs are revoked on close', async () => {
  const { api, pin, reads } = pack();
  const set = await loadEmojiSet(api, pin);
  assert.equal(reads(), 0);
  const entry = set.entries[0]!;
  const url = await set.url(entry);
  assert.ok(url);
  assert.match(await (await fetch(url)).text(), /^<svg/);
  assert.equal(await set.url(entry), url);
  assert.equal(reads(), 1);
  set.destroy();
  await assert.rejects(fetch(url));
  assert.equal(await set.url(entry), null);
  const bad = await loadEmojiSet({ ...api, artwork: async () => new TextEncoder().encode('<svg/>') }, pin);
  assert.equal(await bad.url(bad.entries[0]!), null);
  bad.destroy();
  await assert.rejects(loadEmojiSet(api, { ...pin, checksum: `sha256:${'0'.repeat(64)}` }));
});

test('the browser supports full-set search, lazy artwork, keyboard selection, copy and empty results', async () => {
  const { api, pin, reads } = pack();
  const container = document.createElement('div');
  document.body.append(container);
  const copied: string[] = [];
  const browser = mountEmojiSetBrowser(container, { emoji: api, clipboard: { writeText: async value => { copied.push(value); } } }, pin);
  try {
    await browser.ready;
    const cells = () => [...container.querySelectorAll<HTMLButtonElement>('.emoji-set-cell')];
    assert.equal(cells().length, 3);
    assert.match(container.querySelector('.emoji-set-count')!.textContent!, /3 of 3/);
    await until(() => !!cells()[0]!.querySelector('img'));
    assert.equal(reads(), 1, 'offscreen glyphs are not prepared');
    Observer.latest.reveal(cells()[1]!);
    await until(() => !!cells()[1]!.querySelector('img'));
    assert.equal(reads(), 2);
    const first = cells()[0]!;
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    assert.equal(document.activeElement, cells()[1]);
    assert.equal(cells()[1]!.getAttribute('aria-pressed'), 'true');
    container.querySelector<HTMLButtonElement>('.emoji-set-info button')!.click();
    await until(() => copied.length === 1);
    assert.equal(copied[0], '\u{1f44d}\u{1f3fd}');
    const filter = container.querySelector('select')!;
    filter.value = 'custom'; filter.dispatchEvent(new Event('change'));
    assert.equal(cells().length, 1);
    cells()[0]!.click();
    assert.equal(container.querySelector('.emoji-set-info strong')!.textContent, 'Custom <logo>');
    assert.equal(container.querySelector('logo'), null);
    container.querySelector<HTMLButtonElement>('.emoji-set-info button')!.click();
    await until(() => copied.length === 2);
    assert.equal(copied[1], 'test/logo');
    const search = container.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'no match'; search.dispatchEvent(new Event('input'));
    assert.equal(cells().length, 0);
    assert.equal(container.querySelector<HTMLElement>('.emoji-set-empty')!.hidden, false);
    filter.value = 'all'; filter.dispatchEvent(new Event('change'));
    search.value = 'U+1F600'; search.dispatchEvent(new Event('input'));
    assert.equal(cells()[0]?.dataset.key, '1f600');
  } finally { browser.destroy(); container.remove(); }
  assert.equal(Observer.latest.targets.size, 0);
});

test('closing during a manifest or artwork request cannot paint a retired browser', async () => {
  const { api, pin, bytes } = pack();
  let resolve!: (bytes: Uint8Array) => void;
  const container = document.createElement('div');
  document.body.append(container);
  const browser = mountEmojiSetBrowser(container, {
    emoji: { ...api, manifest: () => new Promise(done => { resolve = done; }) },
    clipboard: { writeText: async () => {} },
  }, pin);
  browser.destroy(); resolve(bytes);
  await browser.ready;
  assert.equal(container.childElementCount, 0);
  let finish!: (bytes: Uint8Array) => void;
  const set = await loadEmojiSet({ ...api, artwork: () => new Promise(done => { finish = done; }) }, pin);
  const pending = set.url(set.entries[0]!);
  set.destroy(); finish(new Uint8Array(fixture('1f600.svg')));
  assert.equal(await pending, null);
  container.remove();
});

test('an unavailable pack shows a recoverable state without substituting system emoji', async () => {
  const { api, pin, bytes } = pack();
  let available = false;
  const container = document.createElement('div');
  const browser = mountEmojiSetBrowser(container, {
    emoji: { ...api, manifest: async () => available ? bytes : null }, clipboard: { writeText: async () => {} },
  }, pin);
  try {
    await browser.ready;
    assert.equal(container.querySelectorAll('.emoji-set-cell').length, 0);
    assert.match(container.querySelector('.emoji-set-empty')!.textContent!, /could not be loaded/);
    available = true;
    container.querySelector<HTMLButtonElement>('.emoji-set-empty button')!.click();
    await until(() => container.querySelectorAll('.emoji-set-cell').length === 3);
  } finally { browser.destroy(); }
});

test('single-ink artwork is bound to the text colour and drawn inline, so a theme switch keeps it legible', async () => {
  const { api, pin } = monoPack();
  const set = await loadEmojiSet(api, pin);
  try {
    const art = (await set.art(set.entries[0]!))!;
    assert.ok(art.ink, 'a monochrome glyph comes back with inline markup');
    assert.match(art.ink!, /currentColor/, 'its black paints follow the surrounding text');
    assert.doesNotMatch(art.ink!, /#000/, 'no black paint is left pinned to the artwork');
    assert.equal(await set.url(set.entries[0]!), art.url, 'the blob URL is still there and still memoised');
  } finally { set.destroy(); }

  // Colour artwork keeps the <img> path: it carries its own palette and has nothing
  // to inherit, so nothing about it changes.
  const colour = await loadEmojiSet(pack().api, pack().pin);
  try {
    assert.equal((await colour.art(colour.entries[0]!))!.ink, null);
  } finally { colour.destroy(); }
});

test('the ink glyph reaches the grid as an inline svg, not an img', async () => {
  const { api, pin } = monoPack();
  const container = document.createElement('div');
  document.body.append(container);
  const browser = mountEmojiSetBrowser(container, { emoji: api, clipboard: { writeText: async () => {} } }, pin);
  try {
    await browser.ready;
    const cell = container.querySelector<HTMLButtonElement>('.emoji-set-cell')!;
    await until(() => !!cell.querySelector('svg'));
    assert.equal(cell.querySelector('img'), null, 'an <img> would render in its own document and inherit no colour');
    assert.ok(cell.classList.contains('is-ink'), 'the cell says so, which is what drops the filled plate');
    assert.equal(cell.querySelector('svg')!.getAttribute('aria-hidden'), 'true');
    const large = container.querySelector<HTMLElement>('.emoji-set-large')!;
    await until(() => !!large.querySelector('svg'));
    assert.ok(large.classList.contains('is-ink'));
  } finally { browser.destroy(); container.remove(); }
});

test('a category narrows the same list the glyph kinds do, and a custom symbol is in none of them', () => {
  const entries = [
    { key: '1f600', kind: 'emoji', search: 'grinning face', glyph: {}, text: '\u{1f600}' },
    { key: '1f355', kind: 'emoji', search: 'pizza', glyph: {}, text: '\u{1f355}' },
    { key: 'test/logo', kind: 'custom', search: 'logo', glyph: {}, text: '' },
  ] as unknown as Parameters<typeof applyEmojiCategories>[0];
  applyEmojiCategories(entries, new Map([['1f600', 'face-emotion'], ['1f355', 'food-drink']] as const));
  assert.deepEqual(filterEmojiSet(entries, '', emojiCategoryValue('food-drink')).map(e => e.key), ['1f355']);
  assert.deepEqual(filterEmojiSet(entries, '', emojiCategoryValue('flags')).map(e => e.key), []);
  assert.deepEqual(filterEmojiSet(entries, 'pizza', emojiCategoryValue('food-drink')).map(e => e.key), ['1f355']);
  assert.deepEqual(filterEmojiSet(entries, 'grinning', emojiCategoryValue('food-drink')).map(e => e.key), []);
  // The kind axis is untouched by any of that, and every glyph is still in 'all'.
  assert.equal(filterEmojiSet(entries, '', 'all').length, 3);
  assert.deepEqual(filterEmojiSet(entries, '', 'custom').map(e => e.key), ['test/logo']);
});
