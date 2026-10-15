// SPDX-License-Identifier: MPL-2.0
/**
 * "Interface follows the design system" - the pref, and the painter it gates.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/chrome-follow.test.ts"
 *
 * jsdom supplies the document applyChromeBrandVars writes into, plus a
 * localStorage the mirror can use. The host is a stub of the one slice the
 * painter reads (`tokens.resolve`), so the whole colour path runs for real - the
 * point of the off case is that the injected <style> is GONE, not skipped.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
// The logo tint decodes a bitmap it can never load here; the painter already
// treats a failure as "no tinted logo", and this keeps the rejection quiet.
(globalThis as { Image?: unknown }).Image = undefined;

const {
  FOLLOW_DS_KEY, chromeFollowsDesignSystem, setChromeFollowMirror, hydrateChromeFollow, setChromeFollow,
} = await import('./chrome-follow.ts');
const { applyChromeBrandVars, ACCENT_CACHE_KEY } = await import('../brand-vars.ts');

/** A design system with one resolvable primary per theme. */
function stubHost(): Parameters<typeof applyChromeBrandVars>[0] {
  return {
    tokens: {
      resolve: async (ref: string) => (ref === '{color.semantic.primary}' ? '#e0452b'
        : ref === '{color.semantic.on-primary}' ? '#ffffff' : null),
      colors: async () => [{ value: '#e0452b' }],
    },
  } as unknown as Parameters<typeof applyChromeBrandVars>[0];
}

const styleEl = (): HTMLElement | null => document.getElementById('brand-chrome-vars');
const brandPrimary = (): string => document.documentElement.style.getPropertyValue('--brand-primary');

test('the default is to follow, and only OFF is ever stored', () => {
  localStorage.removeItem(FOLLOW_DS_KEY);
  assert.equal(chromeFollowsDesignSystem(), true, 'an untouched device follows');
  setChromeFollowMirror(false);
  assert.equal(localStorage.getItem(FOLLOW_DS_KEY), '0');
  assert.equal(chromeFollowsDesignSystem(), false);
  setChromeFollowMirror(true);
  assert.equal(localStorage.getItem(FOLLOW_DS_KEY), null, 'following leaves no key behind');
});

test('ON: the chrome accent is injected and the primary is exposed', async () => {
  setChromeFollowMirror(true);
  await applyChromeBrandVars(stubHost());
  assert.ok(styleEl(), 'the brand-chrome-vars style is in the head');
  assert.match(styleEl()!.textContent ?? '', /--primary:/);
  assert.equal(brandPrimary(), '#e0452b');
  // The static /info landing reads the accent from this mirror (lib/covers-flow.ts
  // opens the Cover Flow on the cover nearest it), so it must carry the same hex.
  assert.equal(localStorage.getItem(ACCENT_CACHE_KEY), '#e0452b');
});

test('OFF: the injected style is removed and the app\'s own accent stands', async () => {
  setChromeFollowMirror(true);
  await applyChromeBrandVars(stubHost());
  assert.ok(styleEl(), 'painted first, so the off pass has something to undo');
  setChromeFollowMirror(false);
  await applyChromeBrandVars(stubHost());
  assert.equal(styleEl(), null, 'no chrome override');
  assert.equal(brandPrimary(), '', '--brand-primary is removed, not blanked');
  assert.equal(document.documentElement.style.getPropertyValue('--brand-warn'), '');
  assert.equal(localStorage.getItem(ACCENT_CACHE_KEY), null, 'the accent mirror goes with it');
});

test('OFF leaves the brand FONTS alone - a face is not an accent', async () => {
  const host = {
    tokens: {
      resolve: async (ref: string) => (ref === '{font.brand}' ? 'Inter'
        : ref === '{shape.radius}' ? '0.75rem' : null),
      colors: async () => [],
    },
  } as unknown as Parameters<typeof applyChromeBrandVars>[0];
  setChromeFollowMirror(false);
  await applyChromeBrandVars(host);
  assert.match(document.documentElement.style.getPropertyValue('--font-brand'), /Inter/);
  assert.equal(document.documentElement.style.getPropertyValue('--radius'), '0.75rem');
  assert.equal(styleEl(), null);
});

test('turning it back on repaints the accent through the same painter', async () => {
  setChromeFollowMirror(false);
  await applyChromeBrandVars(stubHost());
  assert.equal(styleEl(), null);
  setChromeFollowMirror(true);
  await applyChromeBrandVars(stubHost());
  assert.ok(styleEl(), 'the accent comes back on the same gesture');
});

test('hydrate: the profile is canonical, and an absent value changes nothing', () => {
  setChromeFollowMirror(true);
  assert.equal(hydrateChromeFollow(undefined), false, 'a profile that never carried it says nothing');
  assert.equal(chromeFollowsDesignSystem(), true);
  assert.equal(hydrateChromeFollow(false), true, 'the mirror moved, so the caller repaints');
  assert.equal(chromeFollowsDesignSystem(), false);
  assert.equal(hydrateChromeFollow(false), false, 'agreeing costs nothing');
});

test('setChromeFollow writes the mirror first, then the profile', async () => {
  setChromeFollowMirror(true);
  let saved: Record<string, unknown> | null = null;
  const host = {
    profile: {
      get: async () => ({ firstname: 'Ada', appearance: { somethingElse: 1 } }),
      set: async (p: Record<string, unknown>) => { saved = p; },
    },
  };
  await setChromeFollow(host, false);
  assert.equal(chromeFollowsDesignSystem(), false, 'the next paint reads the new answer');
  assert.deepEqual(saved, { firstname: 'Ada', appearance: { somethingElse: 1, followDesignSystem: false } });
});

test('a profile that refuses the write still leaves the chrome right', async () => {
  setChromeFollowMirror(true);
  const host = { profile: { get: async () => { throw new Error('no profile'); } } };
  await setChromeFollow(host, false);
  assert.equal(chromeFollowsDesignSystem(), false);
});

// ── A pack's own chrome rides the same painter ───────────────────────────────

const { CHROME_CACHE_KEY, applyChromeAccent } = await import('../brand-vars.ts');

/** A design system with a primary, a warm swatch and, per theme, a `color.chrome.*` group. */
function chromeHost(chrome: Record<'light' | 'dark', Record<string, string>>): Parameters<typeof applyChromeBrandVars>[0] {
  return {
    tokens: {
      resolve: async (ref: string, opts: { theme?: string } = {}) => {
        if (ref === '{color.semantic.primary}') return '#e0452b';
        if (ref === '{color.semantic.on-primary}') return '#ffffff';
        const slot = /^\{color\.chrome\.([a-z-]+)\}$/.exec(ref)?.[1];
        const theme = opts.theme === 'dark' ? 'dark' : 'light';
        return slot ? chrome[theme][slot] ?? null : null;
      },
      colors: async () => [{ value: '#e0452b' }],
      themes: async () => [{ name: 'light' }, { name: 'dark' }],
    },
  } as unknown as Parameters<typeof applyChromeBrandVars>[0];
}
const inlineWarn = (): string => document.documentElement.style.getPropertyValue('--brand-warn');

test('ON with pack chrome: the mirror holds the exact sheet, and a declared unsaved colour leaves no inline warn', async () => {
  setChromeFollowMirror(true);
  await applyChromeBrandVars(chromeHost({
    light: { page: '#fcfaf6', unsaved: '#b57c0a' },
    dark: { page: '#09141a', unsaved: '#fac044' },
  }));
  const css = styleEl()?.textContent ?? '';
  assert.match(css, /--background: /, 'the pack chrome is in the sheet');
  assert.match(css, /\[data-theme="dark"\] \{\n {2}--brand-warn: #fac044;/);
  assert.equal(localStorage.getItem(CHROME_CACHE_KEY), css, 'the pre-paint mirror is the sheet, character for character');
  assert.equal(inlineWarn(), '', 'the unsaved colour lives in the sheet, per theme, not inline');
  assert.equal(document.documentElement.style.getPropertyValue('--brand-warn-ink'), '');
});

test('a theme the pack leaves without an unsaved colour takes the warm pick in the sheet', async () => {
  setChromeFollowMirror(true);
  await applyChromeBrandVars(chromeHost({ light: { page: '#fcfaf6', unsaved: '#b57c0a' }, dark: {} }));
  const css = styleEl()?.textContent ?? '';
  assert.match(css, /:root:not\(\[data-theme="dark"\]\):not\(\[data-theme="brand"\]\), \[data-theme="light"\] \{\n {2}--brand-warn: #b57c0a;/);
  assert.match(css, /\[data-theme="dark"\] \{\n {2}--brand-warn: #e0452b;/, 'dark takes the warm pick');
  assert.equal(inlineWarn(), '');
});

test('a paint from outside the app\'s own pass (a draft preview, the console) leaves the pre-paint mirror alone', async () => {
  setChromeFollowMirror(true);
  await applyChromeBrandVars(chromeHost({ light: { page: '#fcfaf6' }, dark: { page: '#09141a' } }));
  const mirrored = localStorage.getItem(CHROME_CACHE_KEY);
  assert.ok(mirrored, 'the app\'s own paint is mirrored');
  const preview = applyChromeAccent({ primary: '#6d28d9', onPrimary: '#ffffff' }, { primary: '#a678ff', onPrimary: '#000000' });
  assert.ok(preview.length > 0);
  assert.equal(styleEl()?.textContent, preview, 'the preview is painted, and its text returned');
  assert.equal(localStorage.getItem(CHROME_CACHE_KEY), mirrored, 'the next visit still opens on the installed system');
  assert.equal(applyChromeAccent({ primary: null, onPrimary: null }, { primary: null, onPrimary: null }), '');
  assert.equal(styleEl(), null, 'a preview with nothing to paint removes the sheet');
  assert.equal(localStorage.getItem(CHROME_CACHE_KEY), mirrored, 'and leaves the mirror too');
});

test('a pack with chrome but no unsaved colour keeps the inline warm pick', async () => {
  setChromeFollowMirror(true);
  await applyChromeBrandVars(chromeHost({ light: { page: '#fcfaf6' }, dark: { page: '#09141a' } }));
  assert.ok(!(styleEl()?.textContent ?? '').includes('--brand-warn'));
  assert.equal(inlineWarn(), '#e0452b');
});

test('OFF with pack chrome: the sheet, its mirror and the inline warn all go', async () => {
  setChromeFollowMirror(true);
  await applyChromeBrandVars(chromeHost({ light: { page: '#fcfaf6', unsaved: '#b57c0a' }, dark: { page: '#09141a' } }));
  assert.ok(localStorage.getItem(CHROME_CACHE_KEY), 'painted first, so the off pass has a mirror to clear');
  setChromeFollowMirror(false);
  await applyChromeBrandVars(chromeHost({ light: { page: '#fcfaf6', unsaved: '#b57c0a' }, dark: { page: '#09141a' } }));
  assert.equal(styleEl(), null);
  assert.equal(localStorage.getItem(CHROME_CACHE_KEY), null);
  assert.equal(inlineWarn(), '');
});

test('the address bar colour follows the page the sheet paints, and a paint with no meta or no computed style is harmless', async () => {
  setChromeFollowMirror(true);
  // No getComputedStyle at all (this file installs none): still no throw.
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = '#033633';
  document.head.appendChild(meta);
  document.documentElement.dataset.theme = 'light';
  await applyChromeBrandVars(chromeHost({ light: { page: '#fcfaf6' }, dark: { page: '#09141a' } }));
  assert.equal(meta.content, '#ffffff', 'without a computed style the static light colour stands in');
  assert.equal(brandPrimary(), '#e0452b', 'and the rest of the paint still ran');
  // With jsdom's computed style the meta takes the live page triple.
  (globalThis as { getComputedStyle?: unknown }).getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  try {
    await applyChromeBrandVars(chromeHost({ light: { page: '#fcfaf6' }, dark: { page: '#09141a' } }));
    const live = dom.window.getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
    assert.equal(meta.content, live ? `hsl(${live})` : '#ffffff');
  } finally {
    delete (globalThis as { getComputedStyle?: unknown }).getComputedStyle;
    meta.remove();
  }
});
