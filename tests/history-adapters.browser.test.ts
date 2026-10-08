// SPDX-License-Identifier: MPL-2.0
/**
 * Automatic recovery and version history in the real app, one tool at a time (plan
 * 277 P4): a visit files nothing; the first real edit files the creation; History
 * opens and shows the checkpoint; a named version survives a reload that reopens the
 * stored document; a second edit and "Open as a copy" of the older version give two
 * creations with the right values.
 *
 * Every community tool the manifest rule enrols is walked. Seven have hand-written
 * fixtures (the tools that had history first, with thumbnails required). The rest get
 * a generated one: the first text, number or select input in the manifest, edited in
 * the sidebar. Tools without a sidebar are edited where their document is named: the
 * Design top bar, the export sheet's file name (Sandbox, Doc Studio), or the Text
 * workspace's editor. Countdown has no inputs, so it is checked for filing nothing.
 *
 * Run: LOLLY_HISTORY_TEST_URL=http://localhost:5173 node --import ./tests/css-stub.mjs --test tests/history-adapters.browser.test.ts
 * LOLLY_HISTORY_ADAPTERS_ONLY=<id,id> narrows the walk.
 */
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, type Page } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PACKS, packTools, type PackTool } from '../scripts/tool-history-audit.ts';
import { historyParticipation } from '../shells/web/src/views/tool-history-adapters.ts';
import { shellSettled } from './helpers/shell-settled.ts';

const origin = process.env.LOLLY_HISTORY_TEST_URL;
const skip = origin ? false : 'LOLLY_HISTORY_TEST_URL not set (serve the web shell and point it here)';
if (origin) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));
const opener = '[data-history-open], [data-topbar="history"]';

type Value = string | number;
interface Fixture {
  id: string;
  selector: string;
  /** The saved record's key the edit writes. */
  key: string;
  first: Value;
  second: Value;
  /** How the control takes a value: typed, picked from a list, a row of option buttons
   *  (`selector` is the group), a number (a slider moved by its arrow keys, else a
   *  field set in place), set in place (a field inside a closed export sheet), or a
   *  table cell (Enter starts editing). */
  edit?: 'fill' | 'select' | 'radio' | 'number' | 'set' | 'table';
  /** A number input's step, for the arrow keys. */
  step?: number;
  /** A button to press before editing (Text opens its writing tab). */
  before?: string;
  /** Hand-written fixtures hold the stricter bar the first tools shipped with: a
   *  thumbnail on the checkpoint and no page error at all. */
  strict?: boolean;
}

const handWritten: Fixture[] = [
  { id: 'gradient', selector: 'select[data-input-id="blend"]', key: 'blend', first: 'multiply', second: 'screen', edit: 'select', strict: true },
  { id: 'chart', selector: 'textarea[data-input-id="data"], [data-input-id="data"] textarea', key: 'data', first: 'Quarter,Revenue\nQ1,17\nQ2,29', second: 'Quarter,Revenue\nQ1,28\nQ2,42', strict: true },
  { id: 'snippet', selector: 'textarea[data-input-id="code"], [data-input-id="code"] textarea', key: 'code', first: 'const launch = "autumn";', second: 'const launch = "winter";', strict: true },
  { id: 'qr-code', selector: 'input[data-input-id="url"], [data-input-id="url"] input', key: 'url', first: 'https://example.test/autumn', second: 'https://example.test/winter', strict: true },
  { id: 'org-chart', selector: '[data-topbar="name"]', key: '__label', first: 'Autumn team', second: 'Winter team', strict: true },
  { id: 'pricing-table', selector: '[data-field-id="data:t:0:1"]', key: 'data', first: '$19', second: '$29', edit: 'table', strict: true },
  { id: 'wordmark', selector: 'input[data-input-id="text"], [data-input-id="text"] input', key: 'text', first: 'Autumn', second: 'Winter', strict: true },
  // Tools whose document has no sidebar control.
  { id: 'design', selector: '[data-topbar="name"]', key: '__label', first: 'Autumn deck', second: 'Winter deck' },
  { id: 'text-helper', selector: '[data-editor] textarea', key: 'body', first: 'Autumn notes', second: 'Winter notes', before: '[data-mode="text"]' },
];
/** The export sheet's file name: a tracked document setting every export bar has. */
const fileName = (id: string): Fixture => ({ id, selector: '[data-action="filename"]', key: '__export_filename', first: 'autumn-history', second: 'winter-history', edit: 'set' });

interface InputLike { id: string; type?: string; default?: unknown; min?: number; max?: number; step?: number; options?: unknown; showIf?: unknown; group?: string; hidden?: boolean; display?: string; maxLength?: number }

/** Two values the input takes that differ from its default and from each other. */
function twoValues(input: InputLike): [Value, Value] | null {
  if (input.type === 'text' || input.type === 'longtext') {
    const cut = (text: string): string => (input.maxLength && input.maxLength > 0 ? text.slice(0, input.maxLength) : text);
    return [cut('Autumn history'), cut('Winter history')];
  }
  if (input.type === 'number') {
    const base = typeof input.default === 'number' ? input.default : input.min ?? 0;
    const step = input.step && input.step > 0 ? input.step : 1;
    const fits = (n: number): boolean => (input.min === undefined || n >= input.min) && (input.max === undefined || n <= input.max);
    const picks = [base + step, base + 2 * step, base - step, base - 2 * step].map(n => Number(n.toFixed(6))).filter(fits);
    return picks.length >= 2 ? [picks[0]!, picks[1]!] : null;
  }
  if (input.type === 'select' && Array.isArray(input.options)) {
    const values = input.options.map(o => (o && typeof o === 'object' ? (o as { value?: unknown }).value : o))
      .filter((v): v is Value => (typeof v === 'string' || typeof v === 'number') && v !== input.default);
    // A two-way switch goes to its other value and back.
    const back = typeof input.default === 'string' || typeof input.default === 'number' ? input.default : undefined;
    return values.length >= 2 ? [values[0]!, values[1]!] : values.length === 1 && back !== undefined ? [values[0]!, back] : null;
  }
  return null;
}

/** The generated fixture for a tool: its first text, number or select input. */
function generatedFixture(tool: PackTool): Fixture | null {
  const render = (tool.manifest.render ?? {}) as { sidebar?: boolean; layout?: string };
  if (render.sidebar === false || render.layout === 'document') return fileName(tool.id);
  for (const raw of tool.manifest.inputs ?? []) {
    const input = raw as InputLike;
    if (input.showIf || input.hidden || input.group === 'export') continue;
    const values = twoValues(input);
    if (!values) continue;
    const id = input.id;
    // A segmented or badged select is a row of option buttons, not a <select>.
    const buttons = input.type === 'select' && (input.display === 'segmented'
      || (Array.isArray(input.options) && input.options.some(o => !!o && typeof o === 'object' && 'badge' in o)));
    if (buttons) return { id: tool.id, selector: `[data-badge-select="${id}"]`, key: id, first: values[0], second: values[1], edit: 'radio' };
    if (input.type === 'number') {
      return { id: tool.id, selector: `[data-input-id="${id}"][role="slider"], input[data-input-id="${id}"], [data-input-id="${id}"] input`,
        key: id, first: values[0], second: values[1], edit: 'number', step: input.step && input.step > 0 ? input.step : 1 };
    }
    const selector = input.type === 'select' ? `select[data-input-id="${id}"], [data-input-id="${id}"] select`
      : input.type === 'longtext' ? `textarea[data-input-id="${id}"], [data-input-id="${id}"] textarea`
      : `input[data-input-id="${id}"], [data-input-id="${id}"] input`;
    return { id: tool.id, selector, key: id, first: values[0], second: values[1], edit: input.type === 'select' ? 'select' : 'fill' };
  }
  return null;
}

const enrolled = packTools(PACKS[0]!).filter(tool => historyParticipation(tool.manifest, false).localHistory);
/** A document tool with no inputs has nothing to keep and no controller. */
const nothingToKeep = enrolled.filter(tool => !(tool.manifest.inputs ?? []).length);
const fixtures: Fixture[] = enrolled.filter(tool => !nothingToKeep.includes(tool)).flatMap(tool => {
  const fixture = handWritten.find(f => f.id === tool.id) ?? generatedFixture(tool);
  return fixture ? [fixture] : [];
});
const only = process.env.LOLLY_HISTORY_ADAPTERS_ONLY?.split(',').filter(Boolean);
const walked = only ? fixtures.filter(f => only.includes(f.id)) : fixtures;

test('every enrolled community tool has a fixture, or has nothing to keep', () => {
  const covered = new Set([...fixtures.map(f => f.id), ...nothingToKeep.map(t => t.id)]);
  assert.deepEqual(enrolled.map(t => t.id).filter(id => !covered.has(id)), [], 'give the tool a hand-written fixture');
  assert.ok(fixtures.length >= 45, `${fixtures.length} fixtures`);
  assert.deepEqual(nothingToKeep.map(t => t.id), ['countdown-timer']);
});

/** True once the tool's History control shows; false when the visit was sent home
 *  because this server's profile has no such tool. */
async function served(page: Page, id: string): Promise<boolean> {
  // The app rewrites `/#/tool/<id>` to the tool's own path once the route resolves.
  const deadline = Date.now() + 30_000;
  while (!new URL(page.url()).pathname.split('/').includes(id)) {
    if (Date.now() > deadline) return false;
    await page.waitForTimeout(250);
  }
  await page.locator(opener).first().waitFor({ timeout: 60_000 });
  await dismiss(page);
  return true;
}

/** Close what opens over a fresh visit: the template chooser, and the walkthrough a
 *  tool shows once per device (a modal dialog that makes the view inert). */
async function dismiss(page: Page): Promise<void> {
  await page.waitForTimeout(800);
  for (let i = 0; i < 4 && await page.locator('dialog[open], .tmpl-chooser-panel').count(); i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
}

async function saved(page: Page, key: string, expected: Value, table = false): Promise<void> {
  await page.waitForFunction(async ({ key, expected, table }) => {
    const path = '/src/lib/host-ref.ts', slot = history.state?.lollyHistory?.slot;
    if (!slot) return false;
    const state = (await import(path)).getHostRef().state;
    const record = await state.load(slot), value = table ? record?.[key]?.rows?.[0]?.[1] : record?.[key];
    return value === expected;
  }, { key, expected, table }, { timeout: 30_000 });
}
async function reveal(page: Page, selector: string): Promise<void> {
  await page.locator(selector).first().evaluate(el => {
    for (let parent: Node | null = el; parent; parent = parent.parentNode ?? (parent instanceof ShadowRoot ? parent.host : null)) if (parent instanceof HTMLDetailsElement) parent.open = true;
  });
}
async function edit(page: Page, fixture: Fixture, value: Value): Promise<void> {
  if (fixture.before) {
    const button = page.locator(fixture.before).first();
    if ((await button.getAttribute('aria-selected')) !== 'true') await button.click();
  }
  await page.locator(fixture.selector).first().waitFor({ state: 'attached' });
  await reveal(page, fixture.selector);
  const control = page.locator(fixture.selector).first();
  if (fixture.edit === 'select') await control.selectOption(String(value));
  else if (fixture.edit === 'radio') await control.locator(`[data-badge-value="${String(value)}"]`).click();
  else if (fixture.edit === 'table') { await control.click(); await page.keyboard.press('Enter'); await control.fill(String(value)); await page.keyboard.press('Enter'); }
  else if (fixture.edit === 'number' && (await control.getAttribute('role')) === 'slider') {
    // A slider takes its arrow keys, one step each, as a person would move the thumb.
    const now = Number(await control.getAttribute('aria-valuenow'));
    const steps = Math.round((Number(value) - now) / (fixture.step ?? 1));
    await control.scrollIntoViewIfNeeded(); await control.focus();
    for (let i = 0; i < Math.abs(steps); i++) await page.keyboard.press(steps > 0 ? 'ArrowRight' : 'ArrowLeft');
  }
  else if (fixture.edit === 'set' || fixture.edit === 'number') {
    await control.evaluate((el, next) => {
      (el as HTMLInputElement).value = next;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, String(value));
  } else await control.fill(String(value));
}
async function shown(page: Page, fixture: Fixture): Promise<string> {
  if (fixture.before) {
    const button = page.locator(fixture.before).first();
    if ((await button.getAttribute('aria-selected')) !== 'true') await button.click();
  }
  await page.locator(fixture.selector).first().waitFor({ state: 'attached' });
  await reveal(page, fixture.selector);
  const control = page.locator(fixture.selector).first();
  if (fixture.edit === 'radio') return (await control.locator('[aria-checked="true"]').getAttribute('data-badge-value')) ?? '';
  if ((await control.getAttribute('role')) === 'slider') return (await control.getAttribute('aria-valuenow')) ?? '';
  return control.inputValue();
}
const picked = (fixture: Fixture, record: Record<string, unknown>): unknown =>
  fixture.edit === 'table' ? (record[fixture.key] as { rows: unknown[][] }).rows[0]![1] : record[fixture.key];

// One test with a subtest per tool, so a run without a server skips one identity.
test('every enrolled community tool: the first edit files it, a checkpoint appears in History, a reload reopens it, and an older version opens as a copy', { skip, timeout: 7_200_000 }, async (walk) => {
  for (const fixture of walked) await walk.test(fixture.id, { timeout: 300_000 }, t => walkOne(t, fixture));
});

async function walkOne(t: TestContext, fixture: Fixture): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  // The WebGL tools render in software in headless Chromium and keep the main thread
  // busy (plan 277 P4 phase 0, finding 4), so each step gets a generous wait.
  page.setDefaultTimeout(45_000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`${origin}/#/tool/${fixture.id}`, { waitUntil: 'load' });
    // A profile without the tool sends the visit home; that says nothing about history.
    if (!(await served(page, fixture.id))) { t.skip(`this server's profile does not serve ${fixture.id}`); return; }
    // A visit and onInit/render activity must not manufacture a saved creation.
    await page.waitForTimeout(2100);
    assert.equal(await page.evaluate(async () => { const path = '/src/lib/host-ref.ts'; return (await (await import(path)).getHostRef().state.list()).length; }), 0);
    await edit(page, fixture, fixture.first); await saved(page, fixture.key, fixture.first, fixture.edit === 'table');
    await page.locator(opener).first().click();
    await page.locator('.revision-history-entry').first().waitFor({ timeout: 90_000 });
    // The preview waits for a pause and an idle moment after the checkpoint (PREVIEW_TIMING).
    const thumbnail = await page.locator('.revision-history-entry img:not([hidden])').first().waitFor({ timeout: 30_000 }).then(() => true, () => false);
    if (fixture.strict) assert.ok(thumbnail, 'the checkpoint has its thumbnail');
    else if (!thumbnail) t.diagnostic(`${fixture.id}: the checkpoint has no thumbnail yet (capture is best effort)`);
    // Keep the first version: automatic checkpoints in the same minute may be
    // compacted, while a named milestone must remain available for this copy.
    await page.locator('.revision-history-entry').first().getByRole('button', { name: 'Name version', exact: true }).click();
    await page.getByRole('textbox', { name: 'Milestone name' }).fill('Initial version');
    await page.getByRole('button', { name: 'Keep milestone', exact: true }).click();
    await page.locator('.revision-history-entry strong', { hasText: 'Initial version' }).waitFor();
    const original = await page.evaluate(async () => {
      const path = '/src/lib/host-ref.ts', state = (await import(path)).getHostRef().state, slot = history.state.lollyHistory.slot;
      const entry = (await state.history.list({ slot })).entries[0];
      return { slot, id: entry.id, data: await state.history.read(entry.id), head: await state.history.head(slot) };
    });
    assert.equal(picked(fixture, original.data), fixture.first);
    if (fixture.id === 'org-chart') assert.ok(original.data.boxes.length > 0);
    await page.reload({ waitUntil: 'load' }); await page.locator(opener).first().waitFor({ timeout: 60_000 }); await dismiss(page);
    assert.equal(await shown(page, fixture), String(fixture.first), 'the reload reopens the stored document');
    assert.equal(await page.evaluate(() => history.state.lollyHistory.slot), original.slot);
    await edit(page, fixture, fixture.second);
    // Navigation flushes the latest edits without waiting a minute.
    await page.locator(opener).first().click();
    await page.getByRole('link', { name: 'Open app history', exact: true }).click();
    await page.waitForFunction(async ({ slot, key, value, table }) => {
      const path = '/src/lib/host-ref.ts', state = (await import(path)).getHostRef().state;
      const data = await state.load(slot); return (table ? data?.[key]?.rows?.[0]?.[1] : data?.[key]) === value && (await state.history.list({ slot })).entries.length >= 2;
    }, { slot: original.slot, key: fixture.key, value: fixture.second, table: fixture.edit === 'table' }, { timeout: 30_000 });
    await page.locator('.app-history > header').getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.locator('.app-history-row').getByRole('button', { name: 'Versions', exact: true }).click();
    await page.locator('.revision-history-entry', { has: page.locator('strong', { hasText: 'Initial version' }) }).getByRole('button', { name: 'Open as a copy', exact: true }).click();
    await page.locator(opener).first().waitFor({ timeout: 60_000 }); await dismiss(page);
    // A copy is renamed "<name> (copy)", so a document name is checked in the record below.
    const named = fixture.key === '__label' || fixture.key === '__export_filename';
    if (!named) assert.equal(await shown(page, fixture), String(fixture.first), 'the copy holds the older version');
    const final = await page.evaluate(async (original) => {
      const path = '/src/lib/host-ref.ts', state = (await import(path)).getHostRef().state;
      const rows = await state.list();
      const copy = rows.find((row: { slot: string }) => row.slot !== original.slot);
      return { rows: rows.length, copy: await state.load(copy.slot), source: await state.history.read(original.id), latest: await state.load(original.slot) };
    }, original);
    assert.equal(final.rows, 2); assert.deepEqual(final.source, original.data);
    assert.equal(picked(fixture, final.latest), fixture.second);
    assert.equal(final.copy.__toolId, fixture.id);
    const historyErrors = errors.filter(message => /histor|revision|checkpoint|recovery/i.test(message));
    if (fixture.strict) assert.deepEqual(errors, []);
    else {
      assert.deepEqual(historyErrors, []);
      for (const message of errors) t.diagnostic(`${fixture.id}: page error outside history: ${message.split('\n')[0]}`);
    }
  } finally { await browser.close(); }
}

for (const tool of nothingToKeep) test(`${tool.id}: a tool with nothing to keep files nothing and offers no History`, { skip, timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await page.goto(`${origin}/#/tool/${tool.id}`, { waitUntil: 'load' });
    await page.locator('#tool-canvas, .tool-canvas, #tool-content').first().waitFor({ timeout: 60_000 });
    await page.waitForTimeout(2100);
    assert.equal(await page.evaluate(async () => { const path = '/src/lib/host-ref.ts'; return (await (await import(path)).getHostRef().state.list()).length; }), 0);
    assert.equal(await page.locator(opener).count(), 0);
  } finally { await browser.close(); }
});

test('Snippet history retains an uploaded icon version after replacement and mobile history stays reachable', { skip, timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await page.goto(`${origin}/#/history`, { waitUntil: 'networkidle' }); await shellSettled(page);
    await page.evaluate(async () => {
      const dbPath = '/src/bridge/db.ts', assetPath = '/src/bridge/asset-history.ts';
      const db = await (await import(dbPath)).openDB();
      await (await import(assetPath)).writeVersionedUserAsset(db, { id: 'user/upload/history-icon', version: 'v1', format: 'svg', type: 'vector',
        blob: new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="green"/></svg>'], { type: 'image/svg+xml' }) });
    });
    await page.goto(`${origin}/#/tool/snippet?titleIcon=user%2Fupload%2Fhistory-icon`, { waitUntil: 'networkidle' }); await shellSettled(page);
    await page.locator(opener).waitFor();
    await page.locator('textarea[data-input-id="code"], [data-input-id="code"] textarea').fill('const history = "kept";');
    await saved(page, 'code', 'const history = "kept";');
    await page.locator(opener).click(); await page.locator('.revision-history-entry img:not([hidden])').first().waitFor();
    const result = await page.evaluate(async () => {
      const hostPath = '/src/lib/host-ref.ts', dbPath = '/src/bridge/db.ts', assetPath = '/src/bridge/asset-history.ts';
      const host = (await import(hostPath)).getHostRef(), db = await (await import(dbPath)).openDB();
      const entry = (await host.state.history.list({ slot: history.state.lollyHistory.slot })).entries[0];
      const data = await host.state.history.read(entry.id);
      await (await import(assetPath)).writeVersionedUserAsset(db, { id: 'user/upload/history-icon', version: 'v2', format: 'svg', type: 'vector',
        blob: new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="red"/></svg>'], { type: 'image/svg+xml' }) });
      const blocked = await host.assets._removeUserAssetVersion('user/upload/history-icon', 'v1').then(() => '', (error: Error) => error.message);
      return { pin: data.titleIcon.pin, bytes: await (await host.assets._getBlob('user/upload/history-icon', data.titleIcon.pin)).text(), blocked };
    });
    assert.deepEqual(result.pin, { version: 'v1', format: 'svg' }); assert.match(result.bytes, /circle/); assert.match(result.blocked, /used by a saved creation/);
    const shots = new URL('../plans/221-history-mockups/', import.meta.url); await mkdir(shots, { recursive: true });
    await page.screenshot({ path: fileURLToPath(new URL('build-history-snippet-desktop.png', shots)) });
    await page.locator('.revision-history-panel').getByRole('button', { name: 'Close', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator(opener).click(); await page.locator('.revision-history-panel').waitFor();
    await page.locator('.revision-history-entry img:not([hidden])').first().waitFor();
    assert.ok(await page.locator('.revision-history-panel').evaluate(el => el.scrollWidth <= el.clientWidth));
    assert.equal(await page.locator('#view').evaluate(el => el instanceof HTMLElement && el.inert), true);
    assert.equal(await page.locator('#render-pill').evaluate(el => {
      const box = el.getBoundingClientRect(); return !!document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest('.revision-history-panel');
    }), true, 'the floating export controls must stay below the sheet');
    await page.screenshot({ path: fileURLToPath(new URL('build-history-snippet-mobile.png', shots)) });
    await page.locator('.revision-history-panel').getByRole('button', { name: 'Close', exact: true }).click();
    assert.equal(await page.locator('#view').evaluate(el => el instanceof HTMLElement && el.inert), false);
  } finally { await browser.close(); }
});
