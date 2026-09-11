// SPDX-License-Identifier: MPL-2.0
/**
 * The dashboard destination registry - drift guards in BOTH directions
 * (plans/99 M2):
 *
 *  1. Registry ⇄ views/dashboard.ts: the view must render every data-flag via
 *     registry interpolation (dashFlag) - a hand-rolled `data-flag="…"` literal
 *     or a `flag: '…'` option re-introduces the pre-registry drift and fails
 *     here, whatever mechanical form it takes.
 *  2. Registry ⇄ lib/capabilities-data.ts: the capability-group rows are a
 *     deliberate distilled COPY (that module is lazy-loaded by design, so the
 *     registry cannot import it) - this is the two-copies guard that keeps the
 *     copy honest.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/dashboard-registry.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

// jsdom globals BEFORE the dynamic imports (capabilities-data's import graph
// expects a window) - the search-bar.test.ts convention.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

const { DASH_SECTIONS, dashFlag, dashHref } = await import('./dashboard-registry.ts');
const { CAPABILITY_SECTIONS } = await import('../lib/capabilities-data.ts');

const DASHBOARD_SRC = readFileSync(fileURLToPath(new URL('./dashboard.ts', import.meta.url)), 'utf8');

test('registry invariants: unique ids, tab rows are exactly the flagless ones', () => {
  const ids = DASH_SECTIONS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'ids unique');
  const tabRows = DASH_SECTIONS.filter((s) => !s.flag);
  assert.deepEqual(tabRows.map((s) => s.tab), ['device', 'brand', 'caps', 'activity'], 'tab rows in bar order');
  for (const row of tabRows) assert.ok(row.id.startsWith('dpanel-'), `${row.id} names its panel`);
  // Every entry belongs to a real tab.
  const tabKeys = new Set(tabRows.map((s) => s.tab));
  for (const s of DASH_SECTIONS) assert.ok(s.tab && tabKeys.has(s.tab), `${s.id} has a valid tab`);
});

test('dashFlag answers every registered id (appending the id as its unique token) and is inert on unknowns', () => {
  // The id rides along as a flag token so dashHref's `#/d?<id>` resolves to
  // exactly this section - keyword tokens collide across sections ('print',
  // 'color') and applyDeepLink takes the first DOM-order owner.
  assert.equal(dashFlag('dash-storage'), 'storage dash-storage');
  assert.equal(dashFlag('nope'), '');
});

test('dashHref: sections by their unique id, tabs by ?tab=', () => {
  assert.equal(dashHref(DASH_SECTIONS.find((s) => s.id === 'dash-sound')!), '#/d?dash-sound');
  assert.equal(dashHref(DASH_SECTIONS.find((s) => s.id === 'dpanel-brand')!), '#/d?tab=brand');
});

// ── Direction 1: the view renders FROM the registry ──────────────────────────

test('dashboard.ts imports the registry and interpolates every data-flag', () => {
  assert.ok(DASHBOARD_SRC.includes("from './dashboard-registry.ts'"), 'imports the registry');
  // Every data-flag attribute in the source is template interpolation - a NEW
  // hand-rolled `data-flag="lock brand …"` literal fails this scan.
  const literal = DASHBOARD_SRC.match(/data-flag="(?!\$\{)[^"]*"/);
  assert.equal(literal, null, `literal data-flag found: ${literal?.[0] ?? ''}`);
  // And no collapse()/refPanel() call site smuggles a flag string back in as an
  // option literal (the option must come from dashFlag(...)).
  const flagOption = DASHBOARD_SRC.match(/\bflag:\s*['"`]/);
  assert.equal(flagOption, null, `literal flag: option found: ${flagOption?.[0] ?? ''}`);
});

test('every dash-* registry section is wired in dashboard.ts via dashFlag(id)', () => {
  for (const s of DASH_SECTIONS) {
    if (!s.flag || !s.id.startsWith('dash-')) continue; // tabs; cap groups render from capabilities-data
    assert.ok(DASHBOARD_SRC.includes(`dashFlag('${s.id}')`), `dashboard.ts interpolates ${s.id}`);
    assert.ok(DASHBOARD_SRC.includes(`'${s.id}'`), `dashboard.ts renders a section id ${s.id}`);
  }
});

test('the tab bar derives from the registry (no second label list)', () => {
  assert.ok(/const DASH_TABS[^=]*=\s*\n?\s*DASH_SECTIONS\.filter/.test(DASHBOARD_SRC), 'DASH_TABS derived from DASH_SECTIONS');
});

// ── Direction 2: the capability-group copy matches its source ────────────────

test('cap-* rows mirror lib/capabilities-data.ts exactly (id, flag, title, order)', () => {
  const copied = DASH_SECTIONS.filter((s) => s.id.startsWith('cap-'))
    .map((s) => ({ id: s.id, flag: s.flag, title: s.label }));
  const source = CAPABILITY_SECTIONS.map((s) => ({ id: s.id, flag: s.flag, title: s.title }));
  assert.deepEqual(copied, source);
  for (const s of DASH_SECTIONS.filter((x) => x.id.startsWith('cap-'))) {
    assert.equal(s.tab, 'caps', `${s.id} lives on the caps tab`);
  }
});
