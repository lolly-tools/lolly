// SPDX-License-Identifier: MPL-2.0
/**
 * Accessibility preferences - the runtime half of lib/a11y-prefs.ts: attribute
 * application, the localStorage FOUC mirror, profile persistence, and the
 * prefersReducedMotion OR.
 *
 * Run directly:  node --test shells/web/src/lib/a11y-prefs.test.ts
 *
 * jsdom with a real origin (localStorage throws SecurityError on the default
 * opaque `about:blank` origin, and the mirror is half of what's under test).
 * matchMedia isn't implemented by jsdom, so it's a controllable stub here - 
 * which is also how the "no matchMedia at all" CLI/jsdom case gets exercised.
 *
 * All four prefs are pure attribute switches here - the visual half is CSS
 * gated on the attribute (largeText scales chrome type through the `--a11y-fs`
 * multiplier), so nothing below asserts a rendered size. The CSS side's shape is
 * pinned statically in a11y-prefs-contract.test.ts.
 *
 * The invariant these tests exist for is ADDITIVITY: with nothing turned on
 * there must be no data-a11y-* attribute and no mirror key, so not one selector
 * matches and the regular experience is byte-identical. Every case therefore
 * asserts the OFF state as carefully as the ON state.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

// Controllable reduced-motion switch (jsdom has no matchMedia). Default: off, so
// the attribute path is what a positive assertion is proving unless a test says
// otherwise. `undefined` means "no matchMedia in this realm" (CLI/jsdom).
let osReduceMotion: boolean | undefined = false;
function installMatchMedia(): void {
  if (osReduceMotion === undefined) {
    (globalThis as { matchMedia?: unknown }).matchMedia = undefined;
    return;
  }
  // `matches` is a GETTER, because a real MediaQueryList is live: it re-reads the
  // current OS state on every access, which is exactly why a11y-prefs.ts is
  // allowed to match the query once and cache the list (three rAF loops call
  // prefersReducedMotion() per frame). A snapshot stub would let a cached list
  // answer stale and hide that contract instead of holding the module to it.
  globalThis.matchMedia = ((q: string) => ({
    get matches() { return /reduce/.test(q) ? osReduceMotion === true : false; },
    media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    onchange: null, dispatchEvent: () => false,
  })) as unknown as typeof globalThis.matchMedia;
}
installMatchMedia();

const {
  A11Y_STORE_KEY, applyA11yPrefs, currentA11yPrefs, hydrateA11yPrefs, setA11yPref, prefersReducedMotion,
} = await import('./a11y-prefs.ts');

/** The four attributes as they appear in HTML, for direct attribute reads. */
const ATTR = { reduceMotion: 'data-a11y-motion', highContrast: 'data-a11y-contrast', largeText: 'data-a11y-text', hidePreviews: 'data-a11y-previews' } as const;
const VALUE = { reduceMotion: 'reduce', highContrast: 'high', largeText: 'large', hidePreviews: 'hidden' } as const;
type Key = keyof typeof ATTR;
const KEYS: Key[] = ['reduceMotion', 'highContrast', 'largeText', 'hidePreviews'];

/** Back to a pristine document: no prefs, no mirror, OS motion pref off. */
function reset(): void {
  for (const attr of Object.values(ATTR)) document.documentElement.removeAttribute(attr);
  localStorage.clear();
  osReduceMotion = false;
  installMatchMedia();
}

/** Which of the four attributes are present on <html>, with their values. */
function liveAttrs(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, attr] of Object.entries(ATTR)) {
    const v = document.documentElement.getAttribute(attr);
    if (v !== null) out[key] = v;
  }
  return out;
}

function mirror(): unknown {
  const raw = localStorage.getItem(A11Y_STORE_KEY);
  return raw === null ? null : JSON.parse(raw);
}

// ── Additivity: the dormant default ──────────────────────────────────────────

test('nothing on: no data-a11y-* attribute, no mirror key, every pref reads false', () => {
  reset();
  assert.deepEqual(liveAttrs(), {});
  assert.equal(localStorage.getItem(A11Y_STORE_KEY), null);
  assert.deepEqual(currentA11yPrefs(), { reduceMotion: false, highContrast: false, largeText: false, hidePreviews: false });
});

test('applying an all-off object is indistinguishable from never applying anything', () => {
  reset();
  applyA11yPrefs({ reduceMotion: false, highContrast: false, largeText: false, hidePreviews: false });
  assert.deepEqual(liveAttrs(), {});
  assert.equal(localStorage.getItem(A11Y_STORE_KEY), null);
  applyA11yPrefs(undefined);
  assert.deepEqual(liveAttrs(), {});
  assert.equal(localStorage.getItem(A11Y_STORE_KEY), null);
  assert.equal(document.documentElement.outerHTML.includes('data-a11y'), false);
});

// ── apply / current round-trip ───────────────────────────────────────────────

test('each pref sets EXACTLY its own attribute, to its own value', () => {
  for (const key of KEYS) {
    reset();
    applyA11yPrefs({ [key]: true });
    assert.deepEqual(liveAttrs(), { [key]: VALUE[key] }, `${key} must not switch a sibling attribute`);
    assert.equal(currentA11yPrefs()[key], true);
    for (const other of KEYS) if (other !== key) assert.equal(currentA11yPrefs()[other], false);
  }
});

test('all four on, then each cleared in turn: attributes are removed, not blanked', () => {
  reset();
  applyA11yPrefs({ reduceMotion: true, highContrast: true, largeText: true, hidePreviews: true });
  assert.deepEqual(liveAttrs(), { reduceMotion: 'reduce', highContrast: 'high', largeText: 'large', hidePreviews: 'hidden' });
  applyA11yPrefs({ highContrast: true });
  assert.deepEqual(liveAttrs(), { highContrast: 'high' });
  // An empty-string attribute would still match [data-a11y-text] presence
  // selectors, so removal (not `=""`) is the contract.
  assert.equal(document.documentElement.hasAttribute(ATTR.largeText), false);
  applyA11yPrefs({});
  assert.deepEqual(liveAttrs(), {});
});

test('currentA11yPrefs reads the live DOM, including attributes set by the FOUC script', () => {
  reset();
  // Exactly what index.html's inline script does before any module runs.
  document.documentElement.dataset.a11yText = 'large';
  assert.deepEqual(currentA11yPrefs(), { reduceMotion: false, highContrast: false, largeText: true, hidePreviews: false });
});

test('an unexpected attribute value is not treated as on (only the exact token counts)', () => {
  reset();
  document.documentElement.setAttribute(ATTR.reduceMotion, 'yes');
  assert.equal(currentA11yPrefs().reduceMotion, false);
});

// ── The localStorage FOUC mirror ─────────────────────────────────────────────

test('the mirror carries only the prefs that are ON, and is REMOVED when none are', () => {
  reset();
  applyA11yPrefs({ largeText: true, highContrast: true });
  assert.deepEqual(mirror(), { highContrast: true, largeText: true });
  applyA11yPrefs({ largeText: true });
  assert.deepEqual(mirror(), { largeText: true });
  applyA11yPrefs({});
  assert.equal(localStorage.getItem(A11Y_STORE_KEY), null, 'a stale {} mirror would survive a cache clear as noise');
});

test('the mirror round-trips through currentA11yPrefs (what the FOUC script re-applies)', () => {
  reset();
  applyA11yPrefs({ reduceMotion: true, largeText: true });
  const stored = mirror() as Record<string, boolean>;
  reset(); // new page load: attributes gone, mirror is all the boot script has
  applyA11yPrefs(stored);
  assert.deepEqual(currentA11yPrefs(), { reduceMotion: true, highContrast: false, largeText: true, hidePreviews: false });
});

test('blocked storage does not stop the attributes from applying', () => {
  reset();
  const real = Object.getOwnPropertyDescriptor(dom.window, 'localStorage');
  const throwing = { setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); }, getItem: () => null };
  globalThis.localStorage = throwing as unknown as Storage;
  try {
    applyA11yPrefs({ highContrast: true });
    assert.deepEqual(liveAttrs(), { highContrast: 'high' });
    applyA11yPrefs({});
    assert.deepEqual(liveAttrs(), {});
  } finally {
    globalThis.localStorage = dom.window.localStorage;
    assert.ok(real, 'jsdom window kept its own localStorage');
  }
});

// ── hydrateA11yPrefs (boot reconciliation) ───────────────────────────────────

test('hydrate with an explicit object is authoritative - it corrects mirror drift', () => {
  reset();
  applyA11yPrefs({ largeText: true });            // what the FOUC mirror applied
  hydrateA11yPrefs({ highContrast: true });        // what the canonical profile says
  assert.deepEqual(liveAttrs(), { highContrast: 'high' });
  assert.deepEqual(mirror(), { highContrast: true });
});

test('hydrate with an explicit all-off object clears a stale device mirror', () => {
  reset();
  applyA11yPrefs({ reduceMotion: true });
  hydrateA11yPrefs({});
  assert.deepEqual(liveAttrs(), {});
  assert.equal(localStorage.getItem(A11Y_STORE_KEY), null);
});

test('hydrate(undefined) is a NO-OP: an untouched profile never clobbers the device mirror', () => {
  reset();
  applyA11yPrefs({ reduceMotion: true, largeText: true });
  const before = liveAttrs();
  const beforeMirror = mirror();
  hydrateA11yPrefs(undefined);
  // Deliberate, documented behaviour: profiles saved before the a11y field
  // existed must not silently switch a user's prefs back off mid-migration.
  assert.deepEqual(liveAttrs(), before);
  assert.deepEqual(mirror(), beforeMirror);
});

// ── setA11yPref ──────────────────────────────────────────────────────────────

/** A host recording what it was asked to persist. */
function stubHost(opts: { profile?: object; rejectGet?: boolean; rejectSet?: boolean; noSet?: boolean } = {}) {
  const writes: object[] = [];
  const host = {
    profile: {
      get: async () => {
        if (opts.rejectGet) throw new Error('profile read failed');
        return opts.profile ?? { firstname: 'Ada' };
      },
      set: opts.noSet ? undefined : async (p: object) => {
        if (opts.rejectSet) throw new Error('quota exceeded');
        writes.push(p);
      },
    },
  };
  return { host, writes };
}

test('setA11yPref applies immediately and persists { ...profile, a11y } once', async () => {
  reset();
  const { host, writes } = stubHost({ profile: { firstname: 'Ada', theme: 'dark' } });
  await setA11yPref(host, 'largeText', true);
  assert.deepEqual(liveAttrs(), { largeText: 'large' });
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0], {
    firstname: 'Ada', theme: 'dark',
    a11y: { reduceMotion: false, highContrast: false, largeText: true, hidePreviews: false },
  });
});

test('setA11yPref merges onto the prefs already in force, and can turn one back off', async () => {
  reset();
  const { host, writes } = stubHost();
  await setA11yPref(host, 'reduceMotion', true);
  await setA11yPref(host, 'highContrast', true);
  assert.deepEqual(liveAttrs(), { reduceMotion: 'reduce', highContrast: 'high' });
  await setA11yPref(host, 'reduceMotion', false);
  assert.deepEqual(liveAttrs(), { highContrast: 'high' });
  assert.deepEqual((writes.at(-1) as { a11y: unknown }).a11y, { reduceMotion: false, highContrast: true, largeText: false, hidePreviews: false });
});

test('a REJECTED profile write still leaves the pref applied (persistence is best-effort)', async () => {
  reset();
  const { host } = stubHost({ rejectSet: true });
  await setA11yPref(host, 'highContrast', true); // must not reject
  assert.deepEqual(liveAttrs(), { highContrast: 'high' }, 'the user flipped a switch; the switch must stay flipped');
  assert.deepEqual(mirror(), { highContrast: true }, 'the mirror is written before the profile hop, so it survives too');
});

test('a rejected profile READ, and a host with no profile.set, are both survivable', async () => {
  reset();
  await setA11yPref(stubHost({ rejectGet: true }).host, 'largeText', true);
  assert.deepEqual(liveAttrs(), { largeText: 'large' });
  reset();
  await setA11yPref(stubHost({ noSet: true }).host, 'reduceMotion', true);
  assert.deepEqual(liveAttrs(), { reduceMotion: 'reduce' });
});

// ── prefersReducedMotion ─────────────────────────────────────────────────────

test('prefersReducedMotion ORs the app attribute with the OS query', () => {
  reset();
  assert.equal(prefersReducedMotion(), false, 'neither signal');

  applyA11yPrefs({ reduceMotion: true });
  assert.equal(prefersReducedMotion(), true, 'attribute alone');

  reset();
  osReduceMotion = true; installMatchMedia();
  assert.equal(prefersReducedMotion(), true, 'OS query alone');

  applyA11yPrefs({ reduceMotion: true });
  assert.equal(prefersReducedMotion(), true, 'both');

  // The app pref is additive-only: it can turn motion DOWN, never override an
  // OS "reduce" back up.
  applyA11yPrefs({ reduceMotion: false });
  assert.equal(prefersReducedMotion(), true, 'app pref off must not defeat the OS preference');
});

test('the matched OS query is not a snapshot: a mid-session toggle is still seen', () => {
  reset();
  assert.equal(prefersReducedMotion(), false, 'first call - this is what matches (and caches) the query');
  // a11y-prefs.ts matches the query ONCE and keeps the MediaQueryList, because
  // three rAF loops call this per frame and the user paying for a fresh parse at
  // 60Hz would be the one with no preferences set. That is only correct while the
  // cached list is read LIVE: caching `.matches` instead would freeze the OS
  // preference at whatever it was on the first call of the session.
  osReduceMotion = true; installMatchMedia();
  assert.equal(prefersReducedMotion(), true, 'the OS turned reduce-motion ON after the query was matched');
  osReduceMotion = false; installMatchMedia();
  assert.equal(prefersReducedMotion(), false, 'and back off again');
});

test('prefersReducedMotion does not throw where matchMedia does not exist (CLI/jsdom)', async () => {
  reset();
  osReduceMotion = undefined; installMatchMedia();
  // A FRESH module instance: the query is matched lazily and then cached, so the
  // module already loaded above holds a list from when matchMedia existed. Only
  // an instance that first runs in a realm without matchMedia exercises the
  // absent-API branch - the one a CLI/bare-Node import actually takes.
  const bare = await import(`./a11y-prefs.ts?no-matchmedia=${Date.now()}`) as typeof import('./a11y-prefs.ts');
  assert.equal(bare.prefersReducedMotion(), false);
  bare.applyA11yPrefs({ reduceMotion: true });
  assert.equal(bare.prefersReducedMotion(), true, 'the attribute alone still answers without matchMedia');
  reset();
});

test('the other prefs do not leak into the motion signal', () => {
  reset();
  applyA11yPrefs({ highContrast: true, largeText: true, hidePreviews: true });
  assert.equal(prefersReducedMotion(), false);
});
