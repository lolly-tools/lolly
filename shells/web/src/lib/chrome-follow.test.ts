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
