// SPDX-License-Identifier: MPL-2.0
/**
 * The browser half of the history round-trip gate (plan 277 P4). The
 * Node half (scripts/tool-history-audit.ts, tests/history-round-trip.test.ts)
 * replays what history stores through the engine; these cases need the app's own
 * chrome and its real upload store:
 *
 *   1. mount at defaults files nothing: a fresh document tool left alone for 10 s
 *      writes no state row (hidden slots included);
 *   2. the real app reopens what it stored: one tracked edit that changes no tool
 *      input (the export file name, or the Design top bar's name) files the
 *      creation; after a reload the same edit writes the record again, and the two
 *      records must match;
 *   3. an upload is stored by reference and version: a real versioned user asset
 *      in the first image input is stored as its id and pin with no url, and the
 *      reopened record holds the same reference.
 *
 * The app enrols tools by its own manifest rule (views/tool-history-adapters.ts),
 * which the gate imports too, so the lane serves the app as it is and checks the
 * real module. Countdown has no inputs, so it has no controller and nothing to
 * keep; Jump and Text keep history without the export bar's file name, so the
 * tracked edit this lane makes is not there for them and they are reported as
 * not measured here (tests/history-adapters.browser.test.ts edits their inputs).
 *
 * Two differences are stated as notes, never hidden: a token colour's cached face
 * refreshed on reopen (the ref must match), and an emoji artwork pin present in one
 * write and missing from the other, because that write came before the emoji pass
 * finished (one list must be empty; two different pins still fail). Outcomes that say nothing about history are kept
 * apart from failures: a tool this dev server's profile does not serve, and a page
 * too busy to write within 60 s (headless software rendering of the WebGL tools)
 * with no refusal on screen. A reload the test did not ask for (the dev server is
 * shared, and a file edit elsewhere reloads every page) retries the tool once.
 *
 * A tool that fails here must have an entry in the exceptions map, as in the Node
 * half. LOLLY_HISTORY_AUDIT_OUT=<file> writes every verdict as JSON, and
 * LOLLY_HISTORY_AUDIT_ONLY=<id,id> audits just those tools.
 *
 * Run: LOLLY_HISTORY_TEST_URL=http://localhost:5173 node --import ./tests/css-stub.mjs --test tests/history-round-trip.browser.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromium, type Browser, type Page } from 'playwright';
import { AUDIT_PNG, AUDIT_SVG, PACKS, firstDifference, packTools, readExceptions, setAsideTokenCaches, type PackTool } from '../scripts/tool-history-audit.ts';
import { historyParticipation } from '../shells/web/src/views/tool-history-adapters.ts';

const origin = process.env.LOLLY_HISTORY_TEST_URL;
const skip = origin ? false : 'LOLLY_HISTORY_TEST_URL not set (serve the web shell and point it here)';
if (origin) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));

const QUIET_MS = 10_000;
const WRITE_WAIT_MS = 60_000;
const WORKERS = 4;
const EDIT = 'History audit';
const OPENER = '[data-history-open], [data-topbar="history"]';
const EDIT_CONTROL = '[data-topbar="name"], [data-action="filename"]';
const REFUSAL = /could not save|History is paused|History needs|too large for automatic history|storage is full/i;
const exceptions = readExceptions();
const community = packTools(PACKS[0]!);
const enrolled = community.filter(t => historyParticipation(t.manifest, false).localHistory);
const only = process.env.LOLLY_HISTORY_AUDIT_ONLY?.split(',').filter(Boolean);
const audited = only ? enrolled.filter(t => only.includes(t.id)) : enrolled;

type Outcome = 'identical' | 'differs' | 'refused' | 'no-controller' | 'no-edit' | 'not-served' | 'unmeasured';
interface StateRow { slot: string; updatedAt: string; data: Record<string, unknown> }
interface AppVerdict {
  id: string;
  filesNothing: boolean | null;
  filed?: string[];
  roundTrip: Outcome;
  detail?: string;
  notes: string[];
  historyButton?: boolean;
  retried?: boolean;
  pageErrors: string[];
}
/** A fresh browser context whose reloads the test can tell from its own. */
async function openPage(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let loads = 0, requested = 0;
  page.on('load', () => { loads++; });
  return {
    page, errors,
    go: async (url: string) => { requested++; await page.goto(url, { waitUntil: 'load', timeout: 60_000 }); },
    reload: async () => { requested++; await page.reload({ waitUntil: 'load', timeout: 60_000 }); },
    unrequestedReloads: () => loads - requested,
    close: () => context.close(),
  };
}
type Session = Awaited<ReturnType<typeof openPage>>;

const rows = (page: Page): Promise<StateRow[]> => page.evaluate(async () => {
  const path = '/src/bridge/db.ts';
  const db = await (await import(path)).openDB();
  return (await db.getAll('state') as StateRow[]).map(r => ({ slot: r.slot, updatedAt: r.updatedAt, data: r.data }));
});

/** A tool with nothing to keep: no inputs, so no controller (Countdown). */
const noController = (tool: PackTool): boolean => !(tool.manifest.inputs ?? []).length;
/** Still on the tool's own page (not redirected home because the profile lacks the tool). */
const onTool = (page: Page, tool: PackTool): boolean => new URL(page.url()).pathname.split('/').includes(tool.id);
/** The app rewrites `/#/tool/<id>` to the tool's own path once the route resolves;
 *  a tool this profile does not serve is sent back home instead. */
async function served(page: Page, tool: PackTool): Promise<boolean> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (onTool(page, tool)) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

/** Wait for the tool view and its edit control, then close the template chooser a
 *  blank open shows (and nothing else). Resolves whether the edit control exists. */
async function mounted(page: Page, tool: PackTool): Promise<boolean> {
  // Attached, not visible: Text hides the tool content behind its own workspace.
  await page.locator('#tool-canvas, .tool-canvas, #tool-content').first().waitFor({ state: 'attached', timeout: 60_000 });
  const editable = noController(tool) ? false
    : await page.locator(EDIT_CONTROL).first().waitFor({ state: 'attached', timeout: 30_000 }).then(() => true, () => false);
  await page.waitForTimeout(editable ? 500 : 1500);
  const chooser = page.locator('.tmpl-chooser-panel');
  if (await chooser.count()) {
    await page.keyboard.press('Escape');
    await chooser.first().waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  }
  return editable;
}

/** A tracked edit that changes no tool input: the Design top bar's name, else the
 *  export file name. The bar can re-render under load, so a missing field is tried
 *  again for a few seconds before the edit counts as impossible. */
async function trackedEdit(page: Page): Promise<void> {
  for (let tries = 0; tries < 10; tries++) {
    await page.locator(EDIT_CONTROL).first().waitFor({ state: 'attached', timeout: 30_000 });
    if (await page.locator('[data-topbar="name"]').count()) { await page.locator('[data-topbar="name"]').first().fill(EDIT); return; }
    const done = await page.evaluate(value => {
      const field = document.querySelector<HTMLInputElement>('[data-action="filename"]');
      if (!field) return false;
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, EDIT);
    if (done) return;
    await page.waitForTimeout(500);
  }
  throw new Error('the edit control kept disappearing before it could be edited');
}

async function waitForRow(page: Page, want: (row: StateRow) => boolean): Promise<StateRow | null> {
  const deadline = Date.now() + WRITE_WAIT_MS;
  while (Date.now() < deadline) {
    const hit = (await rows(page)).find(want);
    if (hit) return hit;
    await page.waitForTimeout(500);
  }
  return null;
}

/** Nothing was written in time: a refusal on screen is a failure; silence is a busy page. */
async function nothingWritten(page: Page, verdict: AppVerdict, when: string): Promise<void> {
  const toasts = await page.locator('.undo-toast').allTextContents().catch(() => [] as string[]);
  const refusal = toasts.find(t => REFUSAL.test(t));
  verdict.roundTrip = refusal ? 'refused' : 'unmeasured';
  verdict.detail = refusal ? `${when}: ${refusal.trim()}` : `${when}: nothing written within ${WRITE_WAIT_MS / 1000} s and no refusal on screen (the page was busy)`;
}

const edited = (row: StateRow): boolean => row.data.__export_filename === EDIT || row.data.__label === EDIT;
const colorInputs = (tool: PackTool): Set<string> => new Set((tool.manifest.inputs ?? []).filter(i => i.type === 'color').map(i => i.id));

/** Compare two records, setting aside only what the notes above describe. */
function compareRecords(tool: PackTool, first: Record<string, unknown>, second: Record<string, unknown>, verdict: AppVerdict): void {
  const caches = setAsideTokenCaches(first, second, colorInputs(tool));
  const a = { ...caches.stored }, b = { ...caches.reopened };
  const firstPins = Array.isArray(a.__emojiAssets) ? a.__emojiAssets : [], secondPins = Array.isArray(b.__emojiAssets) ? b.__emojiAssets : [];
  if (!firstPins.length !== !secondPins.length) {
    verdict.notes.push(`emoji artwork pin in one write and not the other (${firstPins.length} then ${secondPins.length}): the write without it came before the emoji pass finished`);
    delete a.__emojiAssets; delete b.__emojiAssets;
  }
  if (caches.refreshed.length) verdict.notes.push(`token colour cache refreshed on reopen: ${caches.refreshed.join(', ')}`);
  const diff = firstDifference(a, b);
  verdict.roundTrip = diff ? 'differs' : 'identical';
  if (diff) verdict.detail = `the reopened record differs: ${diff}`;
}

/** File the creation with one tracked edit, reload, edit again, and compare the records. */
async function reopenMatches(s: Session, tool: PackTool, verdict: AppVerdict, editable: boolean): Promise<StateRow | null> {
  const { page } = s;
  if (noController(tool)) { verdict.roundTrip = 'no-controller'; return null; }
  if (!editable) { verdict.roundTrip = 'no-edit'; verdict.detail = 'neither the export file name nor a top bar name appeared'; return null; }
  verdict.historyButton = (await page.locator(OPENER).count()) > 0;
  await trackedEdit(page);
  const first = await waitForRow(page, edited);
  if (!first) { await nothingWritten(page, verdict, 'the first edit'); return null; }
  await s.reload();
  await mounted(page, tool);
  await trackedEdit(page);
  const second = await waitForRow(page, row => row.slot === first.slot && row.updatedAt !== first.updatedAt);
  if (!second) { await nothingWritten(page, verdict, 'the edit after the reload'); return first; }
  compareRecords(tool, first.data, second.data, verdict);
  return second;
}

/** Run one tool, once more if the page reloaded without being asked to. */
async function attempt(browser: Browser, tool: PackTool, body: (s: Session, verdict: AppVerdict) => Promise<void>): Promise<AppVerdict> {
  let verdict!: AppVerdict;
  for (let round = 0; round < 2; round++) {
    verdict = { id: tool.id, filesNothing: null, roundTrip: 'unmeasured', notes: [], pageErrors: [], ...(round ? { retried: true } : {}) };
    const s = await openPage(browser);
    let transient = false;
    try {
      await body(s, verdict);
    } catch (error) {
      const message = (error as Error).message.split('\n')[0]!;
      transient = /context was destroyed|navigation|Target .*closed/i.test(message);
      verdict.roundTrip = 'unmeasured'; verdict.detail = message;
    } finally {
      verdict.pageErrors = [...new Set(s.errors)];
      transient ||= s.unrequestedReloads() > 0;
      await s.close();
    }
    if (!transient) break;
    verdict.notes.push('the page reloaded without being asked to (a file edit elsewhere on the shared dev server)');
  }
  return verdict;
}

async function pool<T, R>(items: readonly T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await work(items[i]!); }
  }));
  return out;
}

const results: { defaults?: AppVerdict[]; uploads?: AppVerdict[] } = {};
function report(): void {
  if (process.env.LOLLY_HISTORY_AUDIT_OUT) writeFileSync(process.env.LOLLY_HISTORY_AUDIT_OUT, `${JSON.stringify({ enrolled: enrolled.map(t => t.id), ...results }, null, 2)}\n`);
}
const failing = (v: AppVerdict): boolean => v.filesNothing === false || v.roundTrip === 'differs' || v.roundTrip === 'refused';
const describe = (v: AppVerdict): string => `${v.id}: ${v.filesNothing === false ? `filed at defaults (${v.filed?.join(', ')}); ` : ''}${v.roundTrip}${v.detail ? ` (${v.detail})` : ''}`;

test('every document tool files nothing at defaults, then reopens as it was stored, in the real app', { skip, timeout: 1_800_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    results.defaults = await pool(audited, WORKERS, tool => attempt(browser, tool, async (s, verdict) => {
      await s.go(`${origin}/#/tool/${tool.id}`);
      if (!(await served(s.page, tool))) { verdict.roundTrip = 'not-served'; verdict.detail = `this dev server's profile does not serve ${tool.id}`; return; }
      const editable = await mounted(s.page, tool);
      await s.page.waitForTimeout(QUIET_MS);
      if (!onTool(s.page, tool)) throw new Error(`left the tool during the quiet period, for ${s.page.url()}`);
      const quiet = await rows(s.page);
      verdict.filesNothing = quiet.length === 0;
      if (noController(tool)) verdict.notes.push('no inputs, so no controller and nothing that could file');
      if (quiet.length) verdict.filed = quiet.map(r => r.slot);
      else await reopenMatches(s, tool, verdict, editable);
    }));
  } finally { await browser.close(); report(); }
  const unlisted = results.defaults.filter(v => failing(v) && !(v.id in exceptions));
  assert.deepEqual(unlisted.map(describe), [], 'fails in the real app with no entry in the exceptions map');
});

test('an upload is stored by reference and version, and reopens as it was stored, in the real app', { skip, timeout: 1_200_000 }, async () => {
  const withImage = audited.flatMap(tool => {
    const input = (tool.manifest.inputs ?? []).find(i => i.type === 'asset' && [undefined, 'any', 'image', 'raster', 'vector'].includes(i.assetType));
    return input ? [{ tool, input: input as { id: string; assetType?: string; urlKey?: string } }] : [];
  });
  if (!only) assert.ok(withImage.length >= 15, `${withImage.length} tools with an image input`);
  const browser = await chromium.launch({ headless: true });
  try {
    results.uploads = await pool(withImage, WORKERS, ({ tool, input }) => attempt(browser, tool, async (s, verdict) => {
      const raster = input.assetType === 'raster';
      const uploadId = raster ? 'user/upload/history-audit-png' : 'user/upload/history-audit-svg';
      await s.go(`${origin}/#/history`);
      const bytes = Buffer.from(raster ? AUDIT_PNG : AUDIT_SVG).toString('base64');
      await s.page.evaluate(async ({ uploadId, raster, bytes }) => {
        const dbPath = '/src/bridge/db.ts', assetPath = '/src/bridge/asset-history.ts';
        const db = await (await import(dbPath)).openDB();
        const blob = new Blob([Uint8Array.from(atob(bytes), c => c.charCodeAt(0))], { type: raster ? 'image/png' : 'image/svg+xml' });
        await (await import(assetPath)).writeVersionedUserAsset(db, { id: uploadId, version: 'v1', format: raster ? 'png' : 'svg', type: raster ? 'raster' : 'vector', blob });
      }, { uploadId, raster, bytes });
      await s.go(`${origin}/#/tool/${tool.id}?${input.urlKey ?? input.id}=${encodeURIComponent(uploadId)}`);
      if (!(await served(s.page, tool))) { verdict.roundTrip = 'not-served'; verdict.detail = `this dev server's profile does not serve ${tool.id}`; return; }
      const second = await reopenMatches(s, tool, verdict, await mounted(s.page, tool));
      if (verdict.roundTrip !== 'identical') return;
      const ref = second?.data[input.id] as Record<string, unknown> | undefined;
      const pin = { version: 'v1', format: raster ? 'png' : 'svg' };
      const problems = [
        ...(ref?.id !== uploadId || ref?.source !== 'user' ? [`the record holds ${JSON.stringify(ref)?.slice(0, 160)}, not the upload`] : []),
        ...(firstDifference(pin, ref?.pin) ? [`the pin is ${JSON.stringify(ref?.pin)}`] : []),
        ...(ref && 'url' in ref ? ['the record keeps a url for the upload'] : []),
      ];
      if (problems.length) { verdict.roundTrip = 'differs'; verdict.detail = problems.join('; '); }
    }));
  } finally { await browser.close(); report(); }
  const unlisted = results.uploads.filter(v => failing(v) && !(v.id in exceptions));
  assert.deepEqual(unlisted.map(describe), [], 'an upload does not round-trip in the real app, and the tool has no entry in the exceptions map');
});
