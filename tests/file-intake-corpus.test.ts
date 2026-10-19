// SPDX-License-Identifier: MPL-2.0
/**
 * Every fixture in the file-lifecycle corpus (tests/fixtures/file-lifecycle) through
 * every door a file comes in by, with the peak memory of each run recorded (plan 203,
 * rank 1 acceptance and section 18).
 *
 * The doors are the real entry functions, driven under jsdom with an in-memory host:
 *
 *   gallery-drop   openDropChooser, as the gallery's drop handler calls it; the
 *                  harness takes "Unpack" or "Add to your library" when offered
 *   picker         the asset picker's upload: PDFs and decks go to their page
 *                  importers, everything else to storeUserUpload
 *   utility-input  cappedFileRef against Strip Hidden Data's file input
 *   utility-convert  validateConvertFiles and convertSourceKind, the Convert view's intake
 *   pwa-launch     openLaunchedFiles, the installed app's launchQueue consumer
 *   pwa-share      initShareTargetFileIntake over a stubbed share inbox
 *   desktop-open   routeEvents for a double-clicked file (desktop_read_file)
 *   desktop-verb   routeEvents for the Dolphin "Strip data" verb, then the tool's seed read
 *   ios-open       initDeepLinkIntake over a stubbed native queue (48 MiB native limit)
 *   android-share  initShareTargetIngest over a stubbed LollyShare bridge (48 MiB limit)
 *   lolly-import   openLollyFile, for .lolly files; the harness takes the lead choice
 *
 * Doors that end at the "What should Lolly do?" sheet cancel it there: past the
 * choice, every one of them runs the gallery's code. What each door asked, chose,
 * stored, refused and said is compared with outcomes.json, the corpus's known
 * outputs. After a deliberate behaviour change, rewrite that file and review the diff:
 *
 *   LOLLY_UPDATE_INTAKE_OUTCOMES=1 node --import ./tests/css-stub.mjs --test tests/file-intake-corpus.test.ts
 *
 * Peak memory is the highest resident set size a worker thread samples every
 * millisecond during a run, less the resident set size when the run started.
 * Adversarial fixtures run first and are held to a budget; the rest are recorded.
 * Memory the allocator keeps after a large run can hide part of a later run's peak,
 * so figures after the first large run are lower bounds. To save the measurements:
 *
 *   LOLLY_INTAKE_MEMORY_REPORT=<file.json> node --import ./tests/css-stub.mjs --test tests/file-intake-corpus.test.ts
 */
/// <reference path="../shells/web/src/vendor.d.ts" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import v8 from 'node:v8';
import vm from 'node:vm';
import { Worker } from 'node:worker_threads';
import { JSDOM } from 'jsdom';

// ── a document for the shell modules, before any of them load ─────────────────

const dom = new JSDOM('<!doctype html><html><body><div id="view"></div></body></html>', { url: 'https://lolly.tools/#/' });
const g = globalThis as unknown as Record<string, unknown>;
for (const key of ['window', 'document', 'history', 'location', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MutationObserver', 'HTMLDialogElement', 'DOMParser', 'XMLSerializer']) {
  Object.defineProperty(g, key, { value: (dom.window as unknown as Record<string, unknown>)[key], configurable: true, writable: true });
}
for (const key of ['localStorage', 'sessionStorage']) {
  Object.defineProperty(g, key, { value: (dom.window as unknown as Record<string, unknown>)[key], configurable: true, writable: true });
}
g.requestAnimationFrame = (fn: () => void) => setTimeout(fn, 0);
const dialogProto = dom.window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
dialogProto.showModal = function showModal(this: { open: boolean }): void { this.open = true; };
dialogProto.close = function close(this: { open: boolean }): void { this.open = false; };
// jsdom loads no media, so a metadata probe would wait out its timeout on every clip.
// Report the media as unreadable at once, as a browser does for a codec it lacks.
const mediaProto = dom.window.HTMLMediaElement.prototype as unknown as Record<string, unknown>;
Object.defineProperty(mediaProto, 'src', {
  configurable: true,
  get(this: Element) { return this.getAttribute('src') ?? ''; },
  set(this: Element, value: string) {
    this.setAttribute('src', value);
    setTimeout(() => this.dispatchEvent(new dom.window.Event('error')), 0);
  },
});
mediaProto.load = function load(): void { /* nothing to load */ };
// A script inside a corpus file must never run. Anything that reaches alert() fails the suite.
let executed = 0;
g.alert = dom.window.alert = () => { executed++; };

const { CORPUS } = await import('./fixtures/file-lifecycle/corpus.ts');
type Fixture = (typeof CORPUS)[number];
const dropRouter = await import('../shells/web/src/lib/drop-router.ts');
const picker = await import('../shells/web/src/views/picker.ts');
const { routeEvents } = await import('../shells/web/src/lib/linux-desktop-boot.ts');
const { cappedFileRef } = await import('../shells/web/src/lib/file-input-ref.ts');
const { convertSourceKind } = await import('../shells/web/src/lib/convert-codecs.ts');
const { validateConvertFiles } = await import('../shells/web/src/lib/file-conversion.ts');
const { MAX_ARCHIVE_TOTAL_BYTES, MAX_ARCHIVE_ZIP_ENTRIES } = await import('../shells/web/src/lib/archive-ingest.ts');
const { readToolManifest } = await import('@lolly-tools/node-shell/content-roots');

const toolIndex = JSON.parse(fs.readFileSync(new URL('../brands/lolly-start/catalog/tools/index.json', import.meta.url), 'utf8')) as { tools: Array<{ id: string }> };
(dom.window as unknown as { __toolIndex: unknown }).__toolIndex = { tools: toolIndex.tools.map((t) => ({ id: t.id })) };
const stripInput = (readToolManifest('strip-data') as { inputs: Array<{ id: string; type: string; maxSize?: number }> }).inputs.find((i) => i.type === 'file')!;

const MiB = 1024 * 1024;
const NATIVE_OPEN_MAX = 48 * MiB;     // MainActivity MAX_SHARE_BYTES and tauri-mobile MAX_OPEN_FILE_BYTES
const ADVERSARIAL_PEAK = 64 * MiB;
// Nested archives expand inside the shared 256 MiB budget, and each expanded member is
// copied once into a File before its own limit refuses it, so the peak can near twice that.
const PEAK_BUDGET: Record<string, number> = { 'bomb-nested-bytes': 2 * MAX_ARCHIVE_TOTAL_BYTES + 32 * MiB };
const OUTCOMES = new URL('./fixtures/file-lifecycle/outcomes.json', import.meta.url);
const README = new URL('./fixtures/file-lifecycle/README.md', import.meta.url);

// ── what a run saw ────────────────────────────────────────────────────────────

/** What one door did with one file. Absent keys did not happen. */
interface Outcome {
  /** Each question Lolly asked, as `tag | title | choices`. */
  asked?: string[];
  /** The choice the harness made. */
  chose?: string;
  /** Library records written, counted by `type/format`. */
  stored?: Record<string, number>;
  /** Saved sessions written. */
  sessions?: number;
  /** Bytes read into a utility's file input. */
  read?: number;
  /** The kind the Convert view detected. */
  kind?: string;
  /** The error the door threw. */
  refused?: string;
  /** What the native shell did instead of delivering the file. */
  native?: string;
  /** Screen-reader announcements, in order. */
  said?: string[];
}

const settle = (ms = 0): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Live regions and dialogs, observed for one run at a time. */
class Observer {
  said: string[] = [];
  asked: string[] = [];
  private seen = new WeakSet<Element>();
  constructor() {
    new dom.window.MutationObserver((records) => {
      for (const record of records) {
        const node = record.target.nodeType === 1 ? record.target as Element : record.target.parentElement;
        const text = node?.closest('[aria-live]')?.textContent?.trim();
        if (text && this.said[this.said.length - 1] !== text) this.said.push(text);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  }
  reset(): void {
    for (const region of document.querySelectorAll('[aria-live]')) region.textContent = '';
    // Once-only nudges (the library milestones) remember themselves here; every run starts clean.
    localStorage.clear();
    this.said = [];
    this.asked = [];
  }
  /** Open dialogs this run has not answered yet. */
  fresh(): HTMLDialogElement[] {
    return [...document.querySelectorAll('dialog')].filter((d) => (d as HTMLDialogElement).open && !this.seen.has(d)) as HTMLDialogElement[];
  }
  describe(d: HTMLDialogElement): { tag: string; choices: string[] } {
    this.seen.add(d);
    const tag = d.dataset.dialogTag ?? '';
    const title = d.getAttribute('aria-label') ?? d.querySelector('h2, h3')?.textContent?.trim() ?? '';
    const choices = [...d.querySelectorAll('[data-choice], [data-scope]')].map((b) => b.getAttribute('data-choice') ?? `scope:${b.getAttribute('data-scope')}`);
    this.asked.push(`${tag || '-'} | ${title} | ${choices.join(',')}`);
    return { tag, choices };
  }
}
const observer = new Observer();

/** Which choice a door takes when Lolly asks; null cancels. */
type Policy = (d: HTMLDialogElement, choices: string[]) => string | null;
const cancelAll: Policy = () => null;
const ingest: Policy = (d, choices) => {
  if (d.dataset.dialogTag !== 'drop-chooser') return null;
  if (choices.includes('unpack')) return 'unpack';
  const library = d.querySelector('[data-choice="library"]');
  return library?.textContent?.trim() === 'Add to your library' ? 'library' : null;
};
const leadChoice: Policy = (d, choices) => (d.dataset.dialogTag === 'lolly-intake' ? choices[0] ?? null : null);

function answer(d: HTMLDialogElement, choice: string | null): void {
  const button = choice ? d.querySelector<HTMLElement>(`[data-choice="${choice}"]`) : null;
  if (button) { button.click(); return; }
  d.dispatchEvent(new dom.window.Event('cancel', { cancelable: true }));
}

/**
 * Drive a run to the end: answer each dialog it opens by `policy`, until `done`
 * settles. A door that does not expose its completion passes `quiet`, and the run
 * ends once something was asked or said and no dialog stays open.
 */
async function drive(policy: Policy, done: Promise<unknown> | null, chose: { value?: string }, tick?: () => void): Promise<void> {
  let finished = false;
  done?.then(() => { finished = true; }, () => { finished = true; });
  let quietTicks = 0;
  for (let i = 0; i < 20_000 && !finished; i++) {
    for (const d of observer.fresh()) {
      const { choices } = observer.describe(d);
      const choice = policy(d, choices);
      if (choice) chose.value = choice;
      answer(d, choice);
    }
    tick?.();
    await settle(i < 50 ? 0 : 1);
    if (!done) {
      const signalled = observer.asked.length > 0 || observer.said.length > 0;
      const open = [...document.querySelectorAll('dialog')].some((d) => (d as HTMLDialogElement).open);
      quietTicks = signalled && !open ? quietTicks + 1 : 0;
      if (quietTicks > 20) finished = true;
    }
  }
  if (!finished) throw new Error('the run did not finish');
}

// ── an in-memory host ─────────────────────────────────────────────────────────

interface Stored { id: string; type?: string; format?: string; meta?: { name?: string }; blob?: Blob }
function makeHost() {
  const records: Stored[] = [];
  const sessions = new Map<string, unknown>();
  const host = {
    log() { /* quiet */ },
    profile: { async get() { return {}; }, async set() { /* nothing to keep */ } },
    state: {
      async list() { return [...sessions.keys()].map((slot) => ({ slot })); },
      async load(slot: string) { return sessions.get(slot) ?? null; },
      async save(slot: string, data: unknown) { sessions.set(slot, data); },
      async delete(slot: string) { sessions.delete(slot); },
    },
    assets: {
      async _listUserAssets() { return []; },
      async _userAssetsCount() { return records.length; },
      async _uploadUserAsset(rec: Stored) { records.push(rec); },
      async _exportUserAssets() { return records; },
      async _getUserRecord(id: string) { return records.find((r) => r.id === id) ?? null; },
      async _importUserAsset(rec: Stored) { records.push(rec); },
      async _deleteUserAsset() { /* nothing to remove */ },
      async _iconThemes() { return []; },
      async _photoTreatments() { return []; },
      async get(id: string) { return { id, url: '' }; },
    },
    export: { async download() { /* not under test */ }, async file() { /* not under test */ } },
  };
  return { host, records, sessions };
}
const tally = (records: readonly Stored[]): Record<string, number> | undefined => {
  if (!records.length) return undefined;
  const out: Record<string, number> = {};
  for (const r of records) { const key = `${r.type ?? '?'}/${r.format ?? '?'}`; out[key] = (out[key] ?? 0) + 1; }
  return out;
};

// ── the doors ─────────────────────────────────────────────────────────────────

type HostShape = Parameters<typeof dropRouter.openDropChooser>[1];
interface Run { outcome: Outcome; records: Stored[] }
type Door = (file: File) => Promise<Run>;

/**
 * Shared tail of every run: what was asked and said, plus the door's own facts. A
 * notice can open just after a door returns (the library milestone nudge is not
 * awaited), so dialogs are answered until none has appeared for a while.
 */
async function finish(outcome: Outcome, records: Stored[], sessions = 0): Promise<Run> {
  // The first milestone is 20 saved files; below that a short wait is enough.
  const patience = records.length >= 20 ? 10 : 2;
  for (let idle = 0, i = 0; idle < patience && i < 500; i++) {
    const fresh = observer.fresh();
    for (const d of fresh) { observer.describe(d); answer(d, null); }
    idle = fresh.length ? 0 : idle + 1;
    await settle(1);
  }
  const stored = tally(records);
  return {
    records,
    outcome: {
      ...(observer.asked.length ? { asked: [...observer.asked] } : {}),
      ...outcome,
      ...(stored ? { stored } : {}),
      ...(sessions ? { sessions } : {}),
      ...(observer.said.length ? { said: [...observer.said] } : {}),
    },
  };
}

/** A door that hands its file to the drop chooser and cancels the sheet. */
function chooserDoor(start: (file: File, host: HostShape) => Promise<unknown> | null, opts: { tick?: () => void } = {}): Door {
  return async (file) => {
    const { host, records } = makeHost();
    const chose: { value?: string } = {};
    await drive(cancelAll, start(file, host as unknown as HostShape), chose, opts.tick);
    return finish({}, records);
  };
}

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const DOORS: Record<string, Door> = {
  'gallery-drop': async (file) => {
    const { host, records } = makeHost();
    const chose: { value?: string } = {};
    await drive(ingest, dropRouter.openDropChooser([file], host as unknown as HostShape), chose);
    return finish(chose.value ? { chose: chose.value } : {}, records);
  },
  picker: async (file) => {
    // The upload button's own order (views/picker.ts): a PDF or deck goes to its page
    // importer, which is not part of intake; everything else is stored.
    if (picker.isPdfUpload(file)) return finish({ chose: 'pdf-pages' }, []);
    if (picker.isPptxUpload(file)) return finish({ chose: 'deck-slides' }, []);
    const { host, records } = makeHost();
    const chose: { value?: string } = {};
    let refused: string | undefined;
    const done = picker.storeUserUpload(host as unknown as Parameters<typeof picker.storeUserUpload>[0], file)
      .catch((err: unknown) => { refused = errorText(err); });
    await drive(cancelAll, done, chose);
    return finish(refused ? { refused } : {}, records);
  },
  'utility-input': async (file) => {
    const ref = await cappedFileRef(file, stripInput);
    return finish(ref ? { read: ref.bytes.length } : { refused: 'over the input limit' }, []);
  },
  'utility-convert': async (file) => {
    try {
      validateConvertFiles([file]);
      return finish({ kind: (await convertSourceKind(file)).kind }, []);
    } catch (err) {
      return finish({ refused: errorText(err) }, []);
    }
  },
  'pwa-launch': chooserDoor((file, host) => dropRouter.openLaunchedFiles({ files: [{ getFile: async () => file }] }, host)),
  'pwa-share': chooserDoor((file, host) => {
    const key = new Request('https://lolly.tools/__share/0');
    const headers: Record<string, string> = { 'x-lolly-share-name': encodeURIComponent(file.name) };
    if (file.type) headers['content-type'] = file.type;
    let parked = true;
    g.caches = {
      async open() {
        return {
          async keys() { return parked ? [key] : []; },
          async match() { return parked ? new Response(file, { headers }) : undefined; },
          async delete() { parked = false; return true; },
        };
      },
    };
    return dropRouter.initShareTargetFileIntake(host).finally(() => { delete g.caches; });
  }),
  'desktop-open': chooserDoor((file, host) => routeEvents([{ kind: 'openFile', value: `/home/ada/Downloads/${file.name}` }], {
    invoke: async (cmd: string) => (cmd === 'desktop_read_file' ? new Uint8Array(await file.arrayBuffer()) : []),
    openFiles: (files: File[]) => dropRouter.openDropChooser(files, host),
  })),
  'desktop-verb': async (file) => {
    await routeEvents([{ kind: 'openUtilityFile', value: `/home/ada/Downloads/${file.name}`, target: 'strip-data' }], {
      invoke: async (cmd: string) => (cmd === 'desktop_read_file' ? new Uint8Array(await file.arrayBuffer()) : []),
      openUtilityFile: (target, handed) => dropRouter.openFileInUtility(target, handed),
    });
    // What views/tool/setup.ts seedDirect does when the tool mounts.
    const handed = dropRouter.takePendingToolFile('strip-data');
    const ref = handed ? await cappedFileRef(handed, stripInput) : null;
    return finish(ref ? { read: ref.bytes.length } : { refused: handed ? 'over the input limit' : 'not handed over' }, []);
  },
  'ios-open': async (file) => {
    const { host, records } = makeHost();
    const chose: { value?: string } = {};
    let polls = 0;
    let markDone!: () => void;
    const done = new Promise<void>((resolve) => { markDone = resolve; });
    let tick: (() => void) | undefined;
    const win = dom.window as unknown as { setInterval: unknown; clearInterval: unknown };
    const saved = { setInterval: win.setInterval, clearInterval: win.clearInterval };
    win.setInterval = (fn: () => void) => { tick = fn; return 1; };
    win.clearInterval = () => { tick = undefined; };
    g.__TAURI_INTERNALS__ = {
      invoke: async (cmd: string) => {
        if (cmd === 'mobile_poll_events') {
          if (polls++ === 0) return [file.size > NATIVE_OPEN_MAX ? { kind: 'openFileError', value: file.name } : { kind: 'openFile', value: '1' }];
          markDone();
          throw new Error('mobile_poll_events is not available');
        }
        if (cmd === 'mobile_take_open_file') return { name: file.name, mime: file.type, bytes: new Uint8Array(await file.arrayBuffer()) };
        return null;
      },
    };
    try {
      dropRouter.initDeepLinkIntake(host as unknown as HostShape);
      await drive(cancelAll, done, chose, () => tick?.());
    } finally {
      delete g.__TAURI_INTERNALS__;
      win.setInterval = saved.setInterval;
      win.clearInterval = saved.clearInterval;
    }
    return finish(file.size > NATIVE_OPEN_MAX ? { native: 'refused over 48 MiB' } : {}, records);
  },
  'android-share': async (file) => {
    if (file.size > NATIVE_OPEN_MAX) return finish({ native: 'refused over 48 MiB' }, []);
    const { host, records } = makeHost();
    const chose: { value?: string } = {};
    const bytes = new Uint8Array(await file.arrayBuffer());
    const chunks = Math.ceil(bytes.length / MiB);
    // MainActivity's resolveShareMime: a malformed or blank type becomes octet-stream.
    const mime = /^[\w.+-]+\/[\w.+-]+$/.test(file.type) ? file.type : 'application/octet-stream';
    let pending = true;
    (dom.window as unknown as { LollyShare?: unknown }).LollyShare = {
      sharedFilePoll: () => (pending ? JSON.stringify({ name: file.name, mime, chunks }) : ''),
      sharedFileChunk: (i: number) => Buffer.from(bytes.subarray(i * MiB, (i + 1) * MiB)).toString('base64'),
      sharedFileConsumed: () => { pending = false; },
    };
    try {
      dropRouter.initShareTargetIngest(host as unknown as HostShape);
      await drive(cancelAll, null, chose);
    } finally {
      delete (dom.window as unknown as { LollyShare?: unknown }).LollyShare;
    }
    return finish({}, records);
  },
  'lolly-import': async (file) => {
    const { host, records, sessions } = makeHost();
    const chose: { value?: string } = {};
    await drive(leadChoice, dropRouter.openLollyFile(file, host as unknown as HostShape), chose);
    return finish(chose.value ? { chose: chose.value } : {}, records, sessions.size);
  },
};

/** The .lolly door applies to files the router hands to the .lolly intake. */
const isLollyFile = (f: Fixture): boolean => /\.lolly$/i.test(f.name) || f.type === 'application/vnd.lolly+zip' || f.id === 'lolly-encrypted-sync-copy';
const doorsFor = (f: Fixture): string[] => Object.keys(DOORS).filter((door) => door !== 'lolly-import' || isLollyFile(f));

// ── peak memory ───────────────────────────────────────────────────────────────

let gc: () => void = () => {};
try { v8.setFlagsFromString('--expose-gc'); gc = vm.runInNewContext('gc') as () => void; } catch { /* measured without a collection first */ }

const SAMPLER = `
const { workerData } = require('node:worker_threads');
const cell = new BigInt64Array(workerData);
const tick = () => {
  const rss = BigInt(process.memoryUsage.rss());
  if (rss > Atomics.load(cell, 0)) Atomics.store(cell, 0, rss);
  if (Atomics.load(cell, 1) === 0n) setTimeout(tick, 1);
};
tick();`;

class PeakMeter {
  private cell = new BigInt64Array(new SharedArrayBuffer(16));
  private worker = new Worker(SAMPLER, { eval: true, workerData: this.cell.buffer });
  async measure<T>(run: () => Promise<T>, collect: boolean): Promise<{ value: T; peak: number }> {
    if (collect) { gc(); await settle(5); }
    const start = process.memoryUsage.rss();
    Atomics.store(this.cell, 0, BigInt(start));
    const value = await run();
    await settle(3);
    return { value, peak: Math.max(0, Number(Atomics.load(this.cell, 0)) - start) };
  }
  async stop(): Promise<void> { Atomics.store(this.cell, 1, 1n); await this.worker.terminate(); }
}

// ── the run ───────────────────────────────────────────────────────────────────

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lolly-intake-corpus-'));
const ctx = {
  async sparse(name: string, head: Uint8Array, size: number): Promise<Blob> {
    const file = path.join(scratch, name);
    fs.writeFileSync(file, head);
    fs.truncateSync(file, size);
    return fs.openAsBlob(file);
  },
};

interface Measured { fixture: string; door: string; inputBytes: number; peakBytes: number; outcome: Outcome; records: Stored[] }
const results: Measured[] = [];
// Adversarial inputs first, while nothing earlier has grown the heap; the nested
// archives that legitimately expand inside their budget go last among them.
const order = [...CORPUS].sort((a, b) => rank(a) - rank(b));
function rank(f: Fixture): number { return f.adversarial ? (f.id === 'bomb-nested-bytes' ? 1 : 0) : 2; }

const meter = new PeakMeter();
try {
  for (const f of order) {
    const blob = await f.build(ctx);
    for (const door of doorsFor(f)) {
      observer.reset();
      // A fresh File per run: no door can see what another door did to the bytes.
      const file = new File([blob], f.name, { type: f.type });
      const { value, peak } = await meter.measure(() => DOORS[door]!(file), !!f.adversarial);
      results.push({ fixture: f.id, door, inputBytes: blob.size, peakBytes: peak, outcome: value.outcome, records: value.records });
    }
  }
} finally {
  await meter.stop();
  fs.rmSync(scratch, { recursive: true, force: true });
}

const outcomes: Record<string, Record<string, Outcome>> = {};
for (const f of CORPUS) {
  outcomes[f.id] = {};
  for (const door of doorsFor(f)) outcomes[f.id]![door] = results.find((r) => r.fixture === f.id && r.door === door)!.outcome;
}
if (process.env.LOLLY_UPDATE_INTAKE_OUTCOMES === '1') fs.writeFileSync(OUTCOMES, `${JSON.stringify(outcomes, null, 2)}\n`);
if (process.env.LOLLY_INTAKE_MEMORY_REPORT) {
  fs.writeFileSync(process.env.LOLLY_INTAKE_MEMORY_REPORT, `${JSON.stringify({
    node: process.version, platform: `${process.platform}-${process.arch}`,
    method: 'peak resident set size above the start of each run, sampled every millisecond',
    runs: results.map(({ fixture, door, inputBytes, peakBytes }) => ({ fixture, door, inputBytes, peakBytes })),
  }, null, 2)}\n`);
}
const result = (fixture: string, door: string): Measured => {
  const found = results.find((r) => r.fixture === fixture && r.door === door);
  assert.ok(found, `${fixture} did not run through ${door}`);
  return found!;
};
const mib = (n: number): string => (n / MiB).toFixed(1);

// ── what must hold ────────────────────────────────────────────────────────────

test('the corpus is documented, sourced and redistributable', () => {
  const whole = fs.readFileSync(README, 'utf8');
  const readme = whole.slice(whole.indexOf('## The fixtures'));
  assert.ok(readme.length < whole.length, 'README has a fixtures table');
  const ids = CORPUS.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length, 'fixture ids are unique');
  for (const f of CORPUS) {
    assert.ok(f.holds.trim() && f.source.trim(), `${f.id} says what it holds and where it came from`);
    assert.match(f.source, /MPL-2\.0|MIT|CC BY 4\.0/, `${f.id} states a licence that allows redistribution`);
    assert.ok(readme.includes(`| \`${f.id}\` |`), `README lists ${f.id}`);
  }
  const listed = [...readme.matchAll(/^\| `([a-z0-9-]+)` \|/gm)].map((m) => m[1]);
  assert.deepEqual(listed.filter((id) => !ids.includes(id!)), [], 'README lists no fixture the corpus lacks');
  for (const family of ['corrupt-archive', 'bomb', 'misleading', 'active-content', 'non-latin-name', 'icc-hdr', 'multi-sheet', 'third-party', 'signed', 'layered', 'animated', 'long-name', 'oversize', 'missing-dependency', 'ordinary'] as const) {
    assert.ok(CORPUS.some((f) => f.families.includes(family)), `the corpus holds a ${family} fixture`);
  }
});

test('every fixture runs through every door it can reach', () => {
  for (const f of CORPUS) {
    for (const door of doorsFor(f)) result(f.id, door);
  }
  assert.ok(doorsFor(CORPUS.find((f) => f.id === 'lolly-shared-design')!).includes('lolly-import'));
});

test('each door does what the corpus records for each fixture', () => {
  const known = JSON.parse(fs.readFileSync(OUTCOMES, 'utf8')) as typeof outcomes;
  assert.deepEqual(Object.keys(known).sort(), Object.keys(outcomes).sort(), 'outcomes.json covers exactly the corpus');
  // Every difference at once, so one run shows the whole extent of a change.
  const differ: string[] = [];
  for (const f of CORPUS) {
    for (const door of doorsFor(f)) {
      try {
        assert.deepEqual(outcomes[f.id]![door], known[f.id]?.[door]);
      } catch (err) {
        differ.push(`${f.id} through ${door}: ${errorText(err)}`);
      }
    }
  }
  if (differ.length) assert.fail(`${differ.length} runs differ from outcomes.json\n\n${differ.join('\n\n')}`);
});

test('adversarial files stay inside their memory budget on every door', (t) => {
  for (const r of results.filter((r) => CORPUS.find((f) => f.id === r.fixture)!.adversarial)) {
    const budget = PEAK_BUDGET[r.fixture] ?? ADVERSARIAL_PEAK;
    assert.ok(r.peakBytes <= budget, `${r.fixture} through ${r.door} peaked at ${mib(r.peakBytes)} MiB (budget ${mib(budget)} MiB)`);
  }
  // The measurements themselves, per door: the largest peak and the fixture that caused the peak.
  for (const door of Object.keys(DOORS)) {
    const runs = results.filter((r) => r.door === door);
    const top = runs.reduce((a, b) => (b.peakBytes > a.peakBytes ? b : a));
    t.diagnostic(`${door}: ${runs.length} runs, highest peak ${mib(top.peakBytes)} MiB (${top.fixture})`);
  }
});

test('a drop sniff reads a declared bomb without inflating it', () => {
  // The chooser's classification once inflated a 420 KB zip to 400 MiB to learn it was
  // not a dotLottie. Every chooser door shares that sniff.
  for (const door of ['gallery-drop', 'pwa-launch', 'pwa-share', 'desktop-open', 'ios-open', 'android-share']) {
    const r = result('bomb-flat-zip', door);
    assert.ok(r.peakBytes < ADVERSARIAL_PEAK, `${door} peaked at ${mib(r.peakBytes)} MiB on a 420 KB zip`);
  }
  assert.deepEqual(result('bomb-flat-zip', 'gallery-drop').records, [], 'nothing from the bomb reaches the library');
});

test('archives inside archives spend one shared budget', () => {
  // The gallery unpacks the folders that fit; the picker's own unpack skips archives
  // inside an archive altogether.
  assert.ok(result('bomb-nested-count', 'gallery-drop').records.length > 0, 'gallery-drop imports the folders that fit');
  for (const door of ['gallery-drop', 'picker']) {
    const notes = result('bomb-nested-count', door).records.length;
    assert.ok(notes <= MAX_ARCHIVE_ZIP_ENTRIES, `${door} imported ${notes} notes, over the ${MAX_ARCHIVE_ZIP_ENTRIES}-entry budget`);
  }
  const unpacked = result('bomb-nested-bytes', 'gallery-drop').outcome.said ?? [];
  assert.ok(unpacked.some((line) => /import limit|exhausted its archive expansion limit/.test(line)),
    'the parts past the shared budget are refused, not expanded');
});

test('archive member paths never escape, and damaged archives import nothing', () => {
  const names = result('zip-traversal', 'gallery-drop').records.map((r) => r.meta?.name ?? r.id);
  assert.ok(names.length > 0);
  for (const name of names) assert.doesNotMatch(String(name), /[\\/]|^\.\.?$/, `${name} keeps only its base name`);
  for (const id of ['zip-truncated', 'zip-crc-mismatch', 'zip-encrypted-flag', 'zip64-sentinel', 'targz-truncated', 'tar-bad-checksum', 'bomb-lying-size']) {
    assert.deepEqual(result(id, 'gallery-drop').records, [], `${id} unpacks nothing from the gallery`);
    // The picker unpacks only a .zip; any other file it keeps whole, as one opaque record.
    assert.ok(result(id, 'picker').records.length <= 1, `${id} unpacks nothing through the picker`);
  }
});

test('an office file named .zip is never unpacked into its parts', () => {
  const r = result('xlsx-as-zip', 'gallery-drop');
  assert.ok(!r.records.some((rec) => /\.xml$/i.test(String(rec.meta?.name ?? rec.id))), 'no XML part becomes a library file');
});

test('no corpus file runs a script, and an SVG is stored without one', async () => {
  assert.equal(executed, 0);
  for (const door of ['gallery-drop', 'picker']) {
    const [record] = result('svg-script', door).records;
    assert.equal(record?.type, 'vector', door);
    const svg = await record!.blob!.text();
    assert.match(svg, /<svg[\s>]/, door);
    assert.doesNotMatch(svg, /<script|onload/i, `${door} stored the SVG with its script`);
  }
});

test('a file over a utility limit never fills the utility, whichever door hands it over', (t) => {
  const picked = result('oversize-clip', 'utility-input');
  assert.equal(picked.outcome.read, undefined);
  assert.ok(picked.peakBytes < 32 * MiB, `the picker read ${mib(picked.peakBytes)} MiB before refusing`);
  // A desktop verb arrives as bytes read by the native side, so the file is in memory
  // before the input's limit can refuse the file. The tool never receives the file.
  const verb = result('oversize-clip', 'desktop-verb');
  assert.equal(verb.outcome.read, undefined);
  t.diagnostic(`desktop-verb holds ${mib(verb.peakBytes)} MiB for a ${mib(verb.inputBytes)} MiB file before the limit refuses it`);
  for (const door of ['ios-open', 'android-share']) assert.equal(result('oversize-clip', door).outcome.native, 'refused over 48 MiB');
});

test('doors that deliver the same file ask the same first question', (t) => {
  const first = (fixture: string, door: string): string | undefined => result(fixture, door).outcome.asked?.[0];
  for (const f of CORPUS) {
    const gallery = first(f.id, 'gallery-drop');
    // These hand over the name, type and bytes unchanged.
    for (const door of ['pwa-launch', 'pwa-share']) assert.equal(first(f.id, door), gallery, `${f.id}: ${door} and gallery-drop`);
    // iOS hands over the same file too, up to its native open limit.
    if (f.id !== 'oversize-clip') assert.equal(first(f.id, 'ios-open'), gallery, `${f.id}: ios-open and gallery-drop`);
    // The desktop drops the MIME type and Android replaces a blank one, so their
    // questions can differ; record where they do.
    for (const door of ['desktop-open', 'android-share']) {
      const asked = first(f.id, door);
      if (f.id !== 'oversize-clip' && asked !== gallery) t.diagnostic(`${f.id}: ${door} asks "${asked}", gallery-drop asks "${gallery}"`);
    }
  }
});
