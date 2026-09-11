// SPDX-License-Identifier: MPL-2.0
/**
 * The spotlight settings provider, over the REAL registries (plans/99 section 2b) - 
 * no fixtures: NAV_SECTIONS, the feature-flag consts and DASH_SECTIONS are the
 * data the shipped provider searches, so these tests double as drift guards
 * (a renamed section that stops matching its own label fails here).
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/search/providers/settings.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

// jsdom globals BEFORE the dynamic imports (the provider pulls views/profile.ts,
// whose import graph expects a window) - the search-bar.test.ts convention.
const dom = new JSDOM('<!doctype html><html><body><main id="view"></main></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

const { createSettingsProvider } = await import('./settings.ts');
const { tokenize } = await import('../match.ts');
const { NAV_SECTIONS } = await import('../../../views/profile.ts');
const { DASH_SECTIONS } = await import('../../../views/dashboard-registry.ts');

const provider = createSettingsProvider();
const search = (q: string, limit = 50) => provider.search(tokenize(q), limit);

test('provider registers as the settings group', () => {
  assert.equal(provider.id, 'settings');
});

test("'contrast' surfaces the Accessibility destinations", async () => {
  const hits = await search('contrast');
  // The pref itself (title match) outranks the section (keyword match) - both land
  // on the same deep link, so either row serves the intent.
  assert.ok(hits.some((h) => h.href === '#/profile?focus=a11y-section'), 'a11y-section hit present');
  assert.equal(hits[0]!.href, '#/profile?focus=a11y-section');
  assert.equal(hits[0]!.title, 'High contrast');
});

test("'jelly' surfaces the Jelly flag by name", async () => {
  const hits = await search('jelly');
  const flagHit = hits.find((h) => h.title === 'Jelly effects');
  assert.ok(flagHit, 'the individual flag is a hit');
  assert.equal(flagHit!.href, '#/profile?focus=feature-flags-section');
  assert.equal(flagHit!.subtitle, 'Feature flags');
});

test("'focus music' surfaces Neurospicy Mode (pill match, AND across tokens)", async () => {
  const hits = await search('focus music');
  assert.ok(hits.some((h) => h.title === 'Neurospicy Mode'), 'pill "focus music" carries the flag');
});

test("'palette' surfaces the dashboard colour section, addressed by its unique id", async () => {
  const hits = await search('palette');
  // Keyword-addressed hrefs ('#/d?color') collided across sections and
  // applyDeepLink resolved them to the first DOM owner - hrefs are id-keyed now.
  assert.ok(
    hits.some((h) => h.subtitle === 'Dashboard' && h.href === '#/d?dash-palette'),
    'a Dashboard hit deep-linking the colour palette section by id',
  );
});

test("'storage' surfaces both the profile card and the dashboard glance", async () => {
  const hits = await search('storage');
  assert.ok(hits.some((h) => h.href === '#/profile?focus=storage-section'));
  assert.ok(hits.some((h) => h.href === '#/d?dash-storage'));
});

test("'dark mode' reaches Appearance via its keywords (multi-word AND)", async () => {
  const hits = await search('dark mode');
  assert.ok(hits.some((h) => h.href === '#/profile?focus=appearance-section'));
});

test('every NAV_SECTIONS entry round-trips its own label into its focus href', async () => {
  for (const s of NAV_SECTIONS) {
    const hits = await search(s.label);
    assert.ok(
      hits.some((h) => h.href === `#/profile?focus=${s.id}`),
      `searching '${s.label}' finds #/profile?focus=${s.id}`,
    );
  }
});

test('tab-level dashboard entries deep-link by ?tab=', async () => {
  const hits = await search('capabilities');
  assert.ok(hits.some((h) => h.href === '#/d?tab=caps'));
});

test('hits respect the limit and arrive best-score-first with icon markup', async () => {
  const hits = await search('colour', 3);
  assert.ok(hits.length > 0 && hits.length <= 3);
  for (let i = 1; i < hits.length; i++) assert.ok(hits[i - 1]!.score >= hits[i]!.score, 'descending scores');
  for (const h of hits) assert.ok(h.icon.includes('<svg'), 'row glyph is inline SVG');
});

test('no match means an empty result, never a throw', async () => {
  assert.deepEqual(await search('zzzzqqqq'), []);
});

// ── Drift pins ───────────────────────────────────────────────────────────────

const PROFILE_SRC = readFileSync(fileURLToPath(new URL('../../../views/profile.ts', import.meta.url)), 'utf8');
const SETTINGS_SRC = readFileSync(fileURLToPath(new URL('./settings.ts', import.meta.url)), 'utf8');

test('the four a11y pref labels are copies of the profile card rows (A11Y_ROWS)', () => {
  // settings.ts carries its own copy (profile keeps A11Y_ROWS inside mountProfile);
  // this pins the copy to the source so a reword there fails here.
  for (const label of ['Reduce motion', 'Hide colourful previews', 'High contrast', 'Large text']) {
    assert.ok(SETTINGS_SRC.includes(`label: '${label}'`), `settings.ts lists '${label}'`);
    assert.ok(PROFILE_SRC.includes(`label: '${label}'`), `profile.ts A11Y_ROWS still names '${label}'`);
  }
});

test('every dashboard hit href takes a deep-link form applyDeepLink understands', async () => {
  // Flagged entries deep-link by their OWN unique id (dashFlag plants the id as
  // a flag token, so applyDeepLink resolves it exactly - keyword tokens collide
  // across sections); flagless (tab) entries by ?tab=<key> from a registry tab row.
  const tabKeys = new Set(DASH_SECTIONS.filter((s) => !s.flag).map((s) => s.tab));
  const dashHits = (await search('a', 500)).filter((h) => h.subtitle === 'Dashboard');
  for (const h of dashHits) {
    const m = /^#\/d\?(tab=)?([a-z-]+)$/.exec(h.href);
    assert.ok(m, `${h.href} is a #/d deep link`);
    if (m![1]) assert.ok(tabKeys.has(m![2]!), `${h.href} names a registry tab`);
    else assert.ok(DASH_SECTIONS.some((s) => s.id === m![2]), `${h.href} names a registry section id`);
  }
});
