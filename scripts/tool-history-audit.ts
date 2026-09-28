// SPDX-License-Identifier: MPL-2.0
/**
 * tool-history-audit - the evidence gate for automatic recovery and version
 * history in every tool (plan 277 P4; built in phase 0, shipped with phase 1).
 * It changes nothing in the app.
 *
 *   node scripts/tool-history-audit.ts                  # community pack: census, static read, round trips
 *   node scripts/tool-history-audit.ts --all            # + the private SUSE pack when it is mounted
 *   node scripts/tool-history-audit.ts --only=qr-code,design
 *   node scripts/tool-history-audit.ts --census         # class counts per pack, no renders
 *   node scripts/tool-history-audit.ts --json           # verdicts as JSON on stdout
 *
 * It replays what history stores, not what `lolly smoke` renders. For every tool
 * the manifest rule enrols (class A, the document tools, and class B, which the
 * rule admits once a file input's bytes are left out in phase 4):
 *   1. mount the tool at its defaults in the CLI host (jsdom, the engine path every
 *      shell shares), stamp row ids as the tool view does, and wait for its hooks
 *      to settle (see settleRuntime);
 *   2. take the snapshot Save and automatic history take (snapshotSession in
 *      views/tool-session-snapshot.ts) and write it as an automatic checkpoint
 *      through the real state bridge and revision store over an in-memory
 *      IndexedDB, so pinRevisionAssets and canonicalRevisionData run exactly as
 *      they do in a commit;
 *   3. reopen the slot through openToolSession (views/tool-session-open.ts), which
 *      reads the record back and hands its values to createRuntime, where
 *      resolveInitialValue and resolveAssetRefs rebuild the model;
 *   4. compare: the hydrated markup must be byte-identical to the markup the edited
 *      runtime showed, and the reopened document, canonicalised again, must equal
 *      what was stored.
 * Then it edits the first input of each type to a second value and fills the first
 * image input from each asset source (a catalog id, an upload, a plain http(s) URL
 * from a local server, a Lolly tool link, a data: URL and a baked ref), repeating
 * steps 2 to 4 after each. Every edit starts from the reopened runtime, so editing
 * after a reopen is covered as well. One more case per tool: a record saved before
 * history adopts (saved through the state bridge with no revision store, reopened
 * with one, adopted by the automatic-history controller, edited and saved; the save
 * must be recorded as a revision with the edit in the record). The case "mount at
 * defaults files nothing" needs the app's own chrome, so it runs in the browser
 * lane (tests/history-round-trip.browser.test.ts) with the real upload store.
 *
 * Clock and randomness. Both mounts run with the clock pinned to one instant and
 * Math.random reseeded before every hook call, so the comparison is "same inputs,
 * same output", which is what history has to guarantee. Afterwards the last stored
 * document is reopened a day later; a render or a value that changes then is
 * reported as clock-dependent and does not block eligibility (a saved session
 * reopens the same way today). The static read lists hooks that read the clock or
 * randomness, or make temporary blob: URLs or raw bytes.
 *
 * A tool that fails is kept out of automatic history by an entry with a written
 * reason in shells/web/src/views/tool-history-exceptions.json (plan 277 P4,
 * decision 7: CI stays green and the map only shrinks). The exit code and
 * tests/history-round-trip.test.ts fail both ways: a failing tool with no entry,
 * and an entry for a tool that now passes.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import { format } from 'node:util';
import type { AddressInfo } from 'node:net';
import type { IDBPDatabase } from 'idb';
import { JSDOM, VirtualConsole } from 'jsdom';

import { createRuntime, inRealmHookExecutor, type HookExecutor, type Hooks, type Runtime } from '../engine/src/runtime.ts';
import { fileInputPaths, historyClass as manifestHistoryClass, type HistoryClass, type HistoryManifest } from '../shells/web/src/views/tool-history-adapters.ts';
import { loadTool, type LoadedTool, type ToolManifest } from '../engine/src/loader.ts';
import { parseUrlState } from '../engine/src/url-mode.ts';
import { bakeAssetRef } from '../engine/src/bake.ts';
import { isTokenValue } from '../engine/src/tokens.ts';
import type { InputValue } from '../engine/src/inputs.ts';
import type { UrlState } from '../engine/src/url-mode.ts';
import type { RevisionCursor } from '../shells/web/src/bridge/revision-records.ts';
import type { AssetRef, HostV1 } from '../packages/core/src/host-v1.ts';
import { contentRoots, readAssetIndex, readToolText, type ContentRoots } from '../packages/node-shell/src/content-roots.ts';
import { createCliBridge } from '../shells/cli/src/bridge.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Where the reasoned exclusions live. Phase 1's manifest rule reads the same file. */
export const EXCEPTIONS_PATH = join(ROOT, 'shells/web/src/views/tool-history-exceptions.json');

// ── The rule: which history class a manifest falls in ───────────────────────

/**
 * The four classes of plan 277 P4 section 2, from the discriminators the code
 * already uses. `document` (class A) is what phase 1 enrols; `side-file` (class B)
 * joins in phase 4 once a file input's bytes are left out of the snapshot;
 * `settings` (class C, the on-device utilities that remove the action bar) keep
 * their settings by file fingerprint in phase 5; `recording` (class D) pauses
 * checkpoints during a capture from phase 4. The rule itself is the app's own
 * (views/tool-history-adapters.ts), so the gate audits exactly what the app enrols.
 */
export type { HistoryClass };
export const CLASS_LETTER: Readonly<Record<HistoryClass, 'A' | 'B' | 'C' | 'D'>> = { document: 'A', 'side-file': 'B', settings: 'C', recording: 'D' };

interface InputSpecLike { id: string; type?: string; fields?: readonly InputSpecLike[]; default?: unknown; min?: number; max?: number; step?: number; options?: unknown; assetType?: string; label?: string; multiple?: boolean }
export interface ManifestLike {
  id: string;
  inputs?: readonly InputSpecLike[];
  capabilities?: readonly string[];
  render?: { actions?: readonly string[]; export?: boolean; formats?: readonly string[] };
  hooks?: unknown;
}

/** A `file` input at any depth (blocks fields included). */
export function hasFileInput(inputs: readonly InputSpecLike[] | undefined): boolean {
  return fileInputPaths(inputs).length > 0;
}

/** The class a manifest falls in, by the app's rule. Sandbox, whose author removed
 *  Save, is a document tool (Andy's decision on the review's open question (a)). */
export function historyClass(manifest: ManifestLike): HistoryClass {
  return manifestHistoryClass(manifest);
}

/** The classes the round-trip gate covers: what the rule enrols now or in phase 4. */
export const GATED_CLASSES: ReadonlySet<HistoryClass> = new Set(['document', 'side-file']);

// ── Packs and the census ────────────────────────────────────────────────────

export interface Pack { name: 'community' | 'suse'; dir: string; profile: string }
/** CI runs a public clone, where only the community pack exists; its profile is
 *  lolly-start. The SUSE pack is a private submodule, audited with --all. */
export const PACKS: readonly Pack[] = [
  { name: 'community', dir: 'community', profile: 'lolly-start' },
  { name: 'suse', dir: 'brands/suse/tools', profile: 'suse' },
];

export function packMounted(pack: Pack): boolean {
  return existsSync(join(ROOT, pack.dir));
}

export interface PackTool { id: string; pack: Pack['name']; manifest: ManifestLike; dir: string; hooks: string | null; historyClass: HistoryClass }

/** Every manifest in a pack, sorted by id. */
export function packTools(pack: Pack): PackTool[] {
  const abs = join(ROOT, pack.dir);
  if (!existsSync(abs)) return [];
  const out: PackTool[] = [];
  for (const name of readdirSync(abs).sort()) {
    const dir = join(abs, name);
    if (name.startsWith('_') || name.startsWith('.') || !statSync(dir).isDirectory() || !existsSync(join(dir, 'tool.json'))) continue;
    const manifest = JSON.parse(readFileSync(join(dir, 'tool.json'), 'utf8')) as ManifestLike;
    const hooksPath = join(dir, 'hooks.js');
    out.push({ id: manifest.id ?? name, pack: pack.name, manifest, dir, hooks: existsSync(hooksPath) ? readFileSync(hooksPath, 'utf8') : null, historyClass: historyClass(manifest) });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export type ClassCounts = Record<'A' | 'B' | 'C' | 'D', number>;
export interface PackCensus { pack: Pack['name']; counts: ClassCounts; ids: Record<'A' | 'B' | 'C' | 'D', string[]>; overlays: string[] }

/**
 * Class counts per pack. A SUSE manifest whose id a community tool already has
 * (3d, 3d-studio) is an overlay of that tool, listed in `overlays` and not counted
 * again, so the SUSE line reads "what this pack adds".
 */
export function census(opts: { all?: boolean } = {}): PackCensus[] {
  const seen = new Set<string>();
  const result: PackCensus[] = [];
  for (const pack of PACKS) {
    if (pack.name !== 'community' && (!opts.all || !packMounted(pack))) continue;
    const ids: PackCensus['ids'] = { A: [], B: [], C: [], D: [] };
    const overlays: string[] = [];
    for (const tool of packTools(pack)) {
      if (seen.has(tool.id)) { overlays.push(tool.id); continue; }
      seen.add(tool.id);
      ids[CLASS_LETTER[tool.historyClass]].push(tool.id);
    }
    result.push({ pack: pack.name, counts: { A: ids.A.length, B: ids.B.length, C: ids.C.length, D: ids.D.length }, ids, overlays });
  }
  return result;
}

// ── The static read ─────────────────────────────────────────────────────────

export interface DeterminismAnalysis {
  /** Reads of the clock or of randomness, first line of each. */
  clock: { name: string; line: number }[];
  /** Temporary blob: URLs or raw bytes a hook makes, first line of each. */
  transient: { name: string; line: number }[];
}

const CLOCK_READS: readonly [string, RegExp][] = [
  ['Date.now', /(?<![\w$.])Date\s*\.\s*now\s*\(/],
  ['new Date()', /(?<![\w$.])new\s+Date\s*\(\s*\)/],
  ['Math.random', /(?<![\w$.])Math\s*\.\s*random\s*\(/],
  ['performance.now', /(?<![\w$.])performance\s*\.\s*now\s*\(/],
  ['crypto.randomUUID', /(?<![\w$])crypto\s*\.\s*randomUUID\s*\(/],
  ['crypto.getRandomValues', /(?<![\w$])crypto\s*\.\s*getRandomValues\s*\(/],
];
const TRANSIENT_VALUES: readonly [string, RegExp][] = [
  ['URL.createObjectURL', /(?<![\w$.])URL\s*\.\s*createObjectURL\s*\(/],
  ['new Uint8Array', /(?<![\w$.])new\s+Uint8(?:Clamped)?Array\s*\(/],
  ['new ArrayBuffer', /(?<![\w$.])new\s+ArrayBuffer\s*\(/],
  ['new Blob', /(?<![\w$.])new\s+Blob\s*\(/],
  ['new File', /(?<![\w$.])new\s+File\s*\(/],
];

/** Comments become spaces and each string literal becomes `0` plus spaces, so a
 *  mention in prose is not a use, `new Date("2026-01-01")` still has an argument,
 *  and every line number stays where it was (the reading of tool-isolation.ts). */
function codeOnly(src: string): string {
  const blank = (m: string): string => m.replace(/[^\n]/g, ' ');
  return src
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:\\])\/\/[^\n]*/g, (_m, pre: string) => pre)
    .replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, (m) => `0${blank(m.slice(1))}`);
}

/**
 * Which hooks read the clock or randomness, and which make temporary blob: URLs
 * or bytes. Comments and string literals are ignored. A hit says the hook COULD
 * put such a value into an input; the round trip and the clock check say whether
 * it does.
 */
export function analyseDeterminism(hooksSource: string | null | undefined): DeterminismAnalysis {
  const src = codeOnly(hooksSource ?? '');
  const find = (table: readonly [string, RegExp][]) => table.flatMap(([name, re]) => {
    const m = re.exec(src);
    return m ? [{ name, line: src.slice(0, m.index).split('\n').length }] : [];
  });
  return { clock: find(CLOCK_READS), transient: find(TRANSIENT_VALUES) };
}

// ── The exceptions map ──────────────────────────────────────────────────────

/** `{ "<tool id>": "<why it is kept out of automatic history>" }`. */
export function readExceptions(path = EXCEPTIONS_PATH): Record<string, string> {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as { exceptions?: Record<string, unknown> };
  const out: Record<string, string> = {};
  for (const [id, reason] of Object.entries(raw.exceptions ?? {})) out[id] = typeof reason === 'string' ? reason : '';
  return out;
}

/** The two ways the gate and the map can disagree. */
export function compareWithExceptions(verdicts: readonly Pick<ToolVerdict, 'id' | 'ok'>[], exceptions: Readonly<Record<string, string>>): { unlisted: string[]; stale: string[] } {
  return {
    // A SUSE overlay shares its community tool's id, so an id appears once.
    unlisted: [...new Set(verdicts.filter(v => !v.ok && !(v.id in exceptions)).map(v => v.id))],
    stale: [...new Set(verdicts.filter(v => v.ok && v.id in exceptions).map(v => v.id))]
      .filter(id => verdicts.every(v => v.id !== id || v.ok)),
  };
}

// ── Determinism for the round trips ─────────────────────────────────────────

/** The instant both mounts see. Any fixed time works; this one is a weekday morning. */
export const AUDIT_NOW = Date.UTC(2026, 2, 17, 9, 30, 0);
/** How far the clock moves for the clock-dependence check: a day, an hour, a minute. */
const CLOCK_STEP = 86_400_000 + 3_600_000 + 60_000;

interface Determinism { setNow(ms: number): void; reseed(): void; restore(): void }

/** Pin the clock and replace Math.random with a seeded generator (mulberry32). */
function installDeterminism(): Determinism {
  const RealDate = Date;
  const realRandom = Math.random;
  let now = AUDIT_NOW;
  let state = 0;
  class PinnedDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(now);
      else super(...(args as [string | number | Date]));
    }
    static override now(): number { return now; }
  }
  globalThis.Date = PinnedDate as DateConstructor;
  const reseed = (): void => { state = 0x5eed1234; };
  reseed();
  Math.random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    setNow: (ms) => { now = ms; },
    reseed,
    restore: () => { globalThis.Date = RealDate; Math.random = realRandom; },
  };
}

/** The hooks whose results the runtime applies to the model, late ones included. */
const MODEL_HOOKS: ReadonlySet<string> = new Set(['onInit', 'onInput']);

/** An in-realm executor that knows when the tool's hooks are done. */
export interface TrackedExecutor {
  executor: HookExecutor;
  /** Resolves once no onInit or onInput call is still running, one task later. */
  idle(): Promise<void>;
}

/**
 * The in-realm executor, reseeding the generator before every hook call (when a
 * reseed is given) so a hook that draws random numbers draws the same ones for the
 * same inputs, and keeping every onInit/onInput result that is still pending.
 *
 * That record is what `idle()` waits on, and it is what lets the gate run on an engine
 * without `runtime.whenSettled()` (1.226): the runtime races a slow hook against its
 * budget and applies the late patch in the promise callbacks behind the hook's own
 * result, so once every result has settled and one task has passed, the model is what
 * whenSettled would report. It can wait longer than whenSettled, for a run a newer one
 * superseded, but it never stops sooner, so the verdicts are the same.
 */
export function trackedExecutor(reseed?: () => void): TrackedExecutor {
  const pending = new Set<Promise<unknown>>();
  const executor: HookExecutor = async (tool, host) => {
    const hooks = await inRealmHookExecutor(tool, host);
    const wrapped: Record<string, unknown> = { ...hooks };
    for (const [name, fn] of Object.entries(hooks)) {
      if (typeof fn !== 'function' || name === 'dispose') continue;
      wrapped[name] = (...args: unknown[]) => {
        reseed?.();
        const out: unknown = (fn as (...a: unknown[]) => unknown).apply(hooks, args);
        if (MODEL_HOOKS.has(name) && out !== null && typeof out === 'object' && typeof Reflect.get(out, 'then') === 'function') {
          const settled = Promise.resolve(out).then(() => {}, () => {});
          pending.add(settled);
          void settled.then(() => pending.delete(settled));
        }
        return out;
      };
    }
    return wrapped as unknown as Hooks;
  };
  const idle = async (): Promise<void> => {
    while (pending.size) await Promise.all([...pending]);
    await new Promise<void>(done => setTimeout(done, 0));
  };
  return { executor, idle };
}

/** A runtime from engine 1.226 on, which says when its newest hook run is done. */
interface SettlingRuntime { whenSettled(): Promise<void> }
function reportsSettled(runtime: object): runtime is SettlingRuntime {
  return typeof Reflect.get(runtime, 'whenSettled') === 'function';
}

/** Wait until the runtime's hooks have applied everything they will apply: its own
 *  whenSettled() where the engine has one, else the tracked executor's record. */
export function settleRuntime(runtime: Runtime, tracked: TrackedExecutor): Promise<void> {
  return reportsSettled(runtime) ? runtime.whenSettled() : tracked.idle();
}

// ── Fixtures: one image of each kind, served and uploaded ──────────────────

function png(width: number, height: number, rgba: [number, number, number, number]): Uint8Array {
  const chunk = (type: string, data: Uint8Array): Buffer => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 6; header[10] = 0; header[11] = 0; header[12] = 0;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) rows.set(rgba, y * (width * 4 + 1) + 1 + x * 4);
  return new Uint8Array(Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', new Uint8Array(0)),
  ]));
}
/** The images the asset cases use, also handed to the browser lane's upload case. */
export const AUDIT_PNG = png(8, 8, [31, 122, 92, 255]);
export const AUDIT_SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" fill="#1f7a5c"/><circle cx="20" cy="20" r="12" fill="#f2c14e"/></svg>');
/** A tenth of a second of a quiet 440 Hz tone, 16-bit mono PCM. */
function wav(samples = 800, rate = 8000): Uint8Array {
  const b = Buffer.alloc(44 + samples * 2);
  b.write('RIFF', 0, 'latin1'); b.writeUInt32LE(36 + samples * 2, 4); b.write('WAVE', 8, 'latin1');
  b.write('fmt ', 12, 'latin1'); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36, 'latin1'); b.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) b.writeInt16LE(Math.round(2000 * Math.sin((2 * Math.PI * 440 * i) / rate)), 44 + i * 2);
  return new Uint8Array(b);
}
const AUDIT_WAV = wav();
const AUDIT_LOTTIE = new TextEncoder().encode(JSON.stringify({ v: '5.7.0', fr: 30, ip: 0, op: 30, w: 100, h: 100, nm: 'history-audit', ddd: 0, assets: [], layers: [] }));
const dataUrl = (bytes: Uint8Array, mime: string): string => `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
/** A tool link as the asset picker takes one, rendered again on open: a QR code,
 *  or for the QR Code tool itself a gradient, since a tool that embeds itself is
 *  stopped by the compose cycle guard (a separate question from history). */
export const AUDIT_TOOL_LINKS: readonly string[] = [
  'https://lolly.tools/tool/qr-code.svg?payload=url&url=https%3A%2F%2Fexample.com%2Fhistory-audit',
  'https://lolly.tools/tool/gradient.svg?mode=linear&count=3',
];
export function auditToolLink(toolId: string): string {
  return AUDIT_TOOL_LINKS.find(link => !link.includes(`/tool/${toolId}.`)) ?? AUDIT_TOOL_LINKS[0]!;
}

interface Upload { id: string; version: string; format: string; type: 'raster' | 'vector' | 'audio' | 'lottie'; bytes: Uint8Array; mime: string }
const UPLOADS: readonly Upload[] = [
  { id: 'user/upload/history-audit-png', version: 'v1', format: 'png', type: 'raster', bytes: AUDIT_PNG, mime: 'image/png' },
  { id: 'user/upload/history-audit-svg', version: 'v1', format: 'svg', type: 'vector', bytes: AUDIT_SVG, mime: 'image/svg+xml' },
  { id: 'user/upload/history-audit-wav', version: 'v1', format: 'wav', type: 'audio', bytes: AUDIT_WAV, mime: 'audio/wav' },
  { id: 'user/upload/history-audit-lottie', version: 'v1', format: 'json', type: 'lottie', bytes: AUDIT_LOTTIE, mime: 'application/json' },
];
const upload = (type: Upload['type']): Upload => UPLOADS.find(u => u.type === type)!;

/** A local server for the plain http(s) case, so the gate needs no network. */
async function serveFixtures(): Promise<{ server: Server; origin: string }> {
  const server = createServer((req, res) => {
    if (req.url === '/history-audit.png') { res.writeHead(200, { 'content-type': 'image/png' }); res.end(AUDIT_PNG); return; }
    if (req.url === '/history-audit.svg') { res.writeHead(200, { 'content-type': 'image/svg+xml' }); res.end(AUDIT_SVG); return; }
    if (req.url === '/history-audit.wav') { res.writeHead(200, { 'content-type': 'audio/wav' }); res.end(AUDIT_WAV); return; }
    res.writeHead(404); res.end();
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  return { server, origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

/**
 * The CLI host, shaped like the web host where history can tell the difference.
 * The web keeps one page-local `blob:` URL per remote id (bridge/url-asset.ts) and
 * per upload version (bridge/assets.ts toAssetRef); the CLI inlines a `data:` URL
 * for a fetched file and has no upload store. So: an http(s) id resolves to
 * `{ source: 'remote', url: blob: }`, and `user/` ids resolve from an in-memory
 * upload store with version checks, as the web does. One blob: URL per id for the
 * whole run keeps the two renders comparable byte for byte; a blob: URL is a
 * page-local name, so this changes nothing history stores.
 */
function webShapedHost(host: HostV1, logs: string[]): HostV1 {
  const blobs = new Map<string, string>();
  const blobUrl = (key: string, bytes: Uint8Array, mime: string): string => {
    let url = blobs.get(key);
    if (!url) { url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime })); blobs.set(key, url); }
    return url;
  };
  const get = host.assets.get.bind(host.assets);
  return {
    ...host,
    log: (level, message, context) => { if (level !== 'debug') logs.push(`${level}: ${message}${context ? ` ${JSON.stringify(context)}` : ''}`); },
    assets: {
      ...host.assets,
      async get(id, opts) {
        const upload = UPLOADS.find(u => u.id === id);
        if (upload) {
          if (opts?.version && opts.version !== upload.version) throw new Error(`Asset version unavailable: ${id} (${opts.version})`);
          return { source: 'user', id, type: upload.type, format: upload.format, url: blobUrl(`user:${id}:${upload.format}:${upload.version}`, upload.bytes, upload.mime), version: upload.version, meta: { name: `${id.split('/').pop()}.${upload.format}` } } as AssetRef;
        }
        const ref = await get(id, opts);
        if (/^https?:\/\//i.test(id) && ref.source === 'remote' && typeof ref.url === 'string' && ref.url.startsWith('data:')) {
          const mime = /^data:([^;,]+)/.exec(ref.url)?.[1] ?? 'application/octet-stream';
          const bytes = new Uint8Array(await (await fetch(ref.url)).arrayBuffer());
          return { source: 'remote', id, type: ref.type, format: ref.format, url: blobUrl(`remote:${id}`, bytes, mime) } as AssetRef;
        }
        return ref;
      },
    },
  } as HostV1;
}

// ── One tool ────────────────────────────────────────────────────────────────

export type CaseOutcome = 'identical' | 'differs' | 'refused' | 'error' | 'skipped';
export interface CaseResult {
  name: string;
  outcome: CaseOutcome;
  detail?: string;
  /** A difference the verdict accepts, stated rather than hidden. */
  note?: string;
  ms?: number;
}
export interface ToolVerdict {
  id: string;
  pack: Pack['name'];
  historyClass: HistoryClass;
  /** Every case identical or skipped, and the adopt case recorded the save. */
  ok: boolean;
  cases: CaseResult[];
  adopt: CaseResult;
  /** What moving the clock a day forward changes on reopen (informational). */
  clock: 'none' | 'render' | 'values' | 'render+values' | 'unknown';
  static: DeterminismAnalysis;
  /** Bytes of canonical JSON the defaults snapshot stores. */
  storedBytes?: number;
  logs: string[];
  ms: number;
}

/**
 * openToolSession's, snapshotSession's and createAutomaticHistory's signatures, as
 * the gate calls them. The three modules are loaded by a computed specifier: they
 * import the tool view or the app's strings (a type import counts), and a literal
 * import would pull the whole web shell, with its Vite-only types, into the scripts
 * and tests type programs. tsc -p shells/web checks the modules themselves.
 */
type OpenToolSession = (state: unknown, manifest: HistoryManifest, url: UrlState, carriedSlot?: string | null) =>
  Promise<{ url: UrlState; values: Record<string, InputValue>; cursor?: RevisionCursor }>;
type SnapshotSession = (el: HTMLElement | null, manifest: ToolManifest, runtime: unknown, experience: { sessionMeta?: () => Record<string, unknown> },
  readBleed: (el: Element | null) => string, readMarks: (el: Element | null) => string) => Record<string, unknown>;
type SavedRecord = Record<string, unknown>;
type CreateAutomaticHistory = (opts: {
  history: NonNullable<WebState['history']>; initial?: RevisionCursor; toolId: string;
  getSlot(): string | null; setSlot(slot: string): void; snapshot(): SavedRecord;
  load(slot: string): Promise<SavedRecord | null>; capture(): Promise<string | null>;
  store?(slot: string, data: SavedRecord): Promise<void>; saved(): void; failure?(message: string): void;
}) => { save(slot: string, data: SavedRecord): Promise<'recorded' | 'stored'>; status(): string; dispose(): void };
const SESSION_OPEN = '../shells/web/src/views/tool-session-open.ts';
const SESSION_SNAPSHOT = '../shells/web/src/views/tool-session-snapshot.ts';
const AUTOMATIC_HISTORY = '../shells/web/src/views/automatic-history.ts';

/** The pieces of the web shell the replay runs through, loaded once. */
interface WebModules {
  memoryDb: typeof import('../shells/web/src/bridge/idb-memory.test-utils.ts').memoryDb;
  createStateAPI: typeof import('../shells/web/src/bridge/state.ts').createStateAPI;
  createRevisionStore: typeof import('../shells/web/src/bridge/revision-history.ts').createRevisionStore;
  canonicalRevisionData: typeof import('../shells/web/src/bridge/revision-snapshot.ts').canonicalRevisionData;
  pinRevisionAssets: typeof import('../shells/web/src/bridge/revision-asset-pins.ts').pinRevisionAssets;
  snapshotSession: SnapshotSession;
  openToolSession: OpenToolSession;
  createAutomaticHistory: CreateAutomaticHistory;
  migrateBlockRowIds: typeof import('../shells/web/src/lib/row-id.ts').migrateBlockRowIds;
}
let webModules: Promise<WebModules> | undefined;
function loadWebModules(): Promise<WebModules> {
  webModules ??= (async () => ({
    memoryDb: (await import('../shells/web/src/bridge/idb-memory.test-utils.ts')).memoryDb,
    createStateAPI: (await import('../shells/web/src/bridge/state.ts')).createStateAPI,
    createRevisionStore: (await import('../shells/web/src/bridge/revision-history.ts')).createRevisionStore,
    canonicalRevisionData: (await import('../shells/web/src/bridge/revision-snapshot.ts')).canonicalRevisionData,
    pinRevisionAssets: (await import('../shells/web/src/bridge/revision-asset-pins.ts')).pinRevisionAssets,
    snapshotSession: (await import(new URL(SESSION_SNAPSHOT, import.meta.url).href) as { snapshotSession: SnapshotSession }).snapshotSession,
    openToolSession: (await import(new URL(SESSION_OPEN, import.meta.url).href) as { openToolSession: OpenToolSession }).openToolSession,
    createAutomaticHistory: (await import(new URL(AUTOMATIC_HISTORY, import.meta.url).href) as { createAutomaticHistory: CreateAutomaticHistory }).createAutomaticHistory,
    migrateBlockRowIds: (await import('../shells/web/src/lib/row-id.ts')).migrateBlockRowIds,
  }))();
  return webModules;
}

type SavedData = Record<string, unknown>;
type WebState = ReturnType<WebModules['createStateAPI']>;

/** First difference between two values, as a path and both sides. */
export function firstDifference(a: unknown, b: unknown, path = ''): string | null {
  if (Object.is(a, b)) return null;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') {
    const show = (v: unknown): string => { const s = JSON.stringify(v); return s === undefined ? 'undefined' : s.length > 120 ? `${s.slice(0, 117)}...` : s; };
    return `${path || '(root)'}: ${show(a)} became ${show(b)}`;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return `${path || '(root)'}: array/object mismatch`;
  const keys = [...new Set([...Object.keys(a as object), ...Object.keys(b as object)])].sort();
  for (const key of keys) {
    const diff = firstDifference((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], path ? `${path}.${key}` : key);
    if (diff) return diff;
  }
  return null;
}

/** JSON with every object's keys in sorted order, as canonicalRevisionData writes
 *  them; `dropUploadPins` also leaves out the version pin of an upload reference. */
export function sortedJson(value: unknown, dropUploadPins = false): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (!v || typeof v !== 'object') return v;
    const record = v as Record<string, unknown>;
    const upload = dropUploadPins && record.source === 'user' && typeof record.id === 'string' && record.id.startsWith('user/');
    return Object.fromEntries(Object.keys(record).sort().filter(k => !(upload && k === 'pin')).map(k => [k, sort(record[k])]));
  };
  return JSON.stringify(sort(value));
}

/**
 * The markup with the JSON a template embeds (a script element's text, or an
 * attribute value that parses as a JSON object or array) rewritten with sorted
 * keys, and nothing else changed. canonicalRevisionData sorts object keys, so a
 * template that embeds an input as JSON shows the stored (sorted) order after a
 * reopen. Arrays keep their order, so rows and lists still compare exactly. With
 * `dropUploadPins`, the version pin pinRevisionAssets adds to an upload reference
 * (plan 221) is left out too, for a template that embeds the whole reference.
 */
export function normaliseEmbeddedJson(markup: string, doc: Document, dropUploadPins = false): string {
  const template = doc.createElement('template');
  template.innerHTML = markup;
  const parsed = (text: string): unknown => {
    const t = text.trim();
    if (!t.startsWith('{') && !t.startsWith('[')) return undefined;
    try { return JSON.parse(t); } catch { return undefined; }
  };
  for (const el of template.content.querySelectorAll('*')) {
    if (el.localName === 'script') { const v = parsed(el.textContent ?? ''); if (v !== undefined) el.textContent = sortedJson(v, dropUploadPins); }
    for (const attr of [...el.attributes]) { const v = parsed(attr.value); if (v !== undefined) el.setAttribute(attr.name, sortedJson(v, dropUploadPins)); }
  }
  return template.innerHTML;
}

/**
 * Set aside the one value the engine refreshes on every mount by contract: the
 * cached face of a token-backed colour input (`{ ref, value }`, re-resolved by
 * resolveTokenRefs so a token edit or the editing range carries through). The
 * `ref` must still match exactly; a refreshed `value` is returned as a note.
 */
export function setAsideTokenCaches(stored: Record<string, unknown>, reopened: Record<string, unknown>, colorInputs: ReadonlySet<string>): { stored: Record<string, unknown>; reopened: Record<string, unknown>; refreshed: string[] } {
  const a = { ...stored }, b = { ...reopened }, refreshed: string[] = [];
  for (const id of colorInputs) {
    const x = stored[id], y = reopened[id];
    if (!isTokenValue(x) || !isTokenValue(y) || x.ref !== y.ref || JSON.stringify(x.value) === JSON.stringify(y.value)) continue;
    refreshed.push(`${id} ${x.ref} ${JSON.stringify(x.value)} became ${JSON.stringify(y.value)}`);
    a[id] = { ...x, value: null }; b[id] = { ...y, value: null };
  }
  return { stored: a, reopened: b, refreshed };
}

/** Where two renders part, with a little context from each. */
export function renderDifference(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const clip = (s: string): string => JSON.stringify(s.slice(Math.max(0, i - 40), i + 60));
  return `markup differs at byte ${i} of ${a.length}/${b.length}: ${clip(a)} became ${clip(b)}`;
}

const MOUNT_TIMEOUT_MS = 45_000;
function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([promise, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(`${what} did not finish within ${ms / 1000} s`)), ms); })])
    .finally(() => clearTimeout(timer));
}

/** The second value an edit writes, per input type; undefined when there is none. */
export function secondValue(input: InputSpecLike, current: unknown): InputValue | undefined {
  const differ = (a: InputValue, b: InputValue): InputValue => (JSON.stringify(current) === JSON.stringify(a) ? b : a);
  switch (input.type) {
    case 'text': return differ('History audit', 'History audit, again');
    case 'longtext': return differ('History audit\nA second line.', 'History audit');
    case 'url': return differ('https://example.com/history-audit', 'https://example.com/history-audit/again');
    case 'boolean': return !current;
    case 'color': return differ('#1f7a5c', '#a33b63');
    case 'date': return differ('2027-03-14', '2027-04-02');
    case 'time': return differ('09:30', '16:45');
    case 'datetime-local': return differ('2027-03-14T09:30', '2027-04-02T16:45');
    case 'number': {
      const n = typeof current === 'number' ? current : Number(input.default ?? 0);
      const step = input.step && input.step > 0 ? input.step : 1;
      const up = n + step, down = n - step;
      if (input.max === undefined || up <= input.max) return up;
      if (input.min === undefined || down >= input.min) return down;
      return undefined;
    }
    case 'select': {
      const options = Array.isArray(input.options) ? input.options : [];
      for (const option of options) {
        const value = option && typeof option === 'object' ? (option as { value?: unknown }).value : option;
        if (value !== undefined && value !== current && (typeof value === 'string' || typeof value === 'number')) return value as InputValue;
      }
      return undefined;
    }
    case 'vector': {
      const field = input.fields?.[0];
      if (!field || !current || typeof current !== 'object') return undefined;
      const n = Number((current as Record<string, unknown>)[field.id] ?? field.default ?? 0);
      const step = field.step && field.step > 0 ? field.step : 1;
      const next = field.max === undefined || n + step <= field.max ? n + step : n - step;
      return { ...(current as Record<string, number>), [field.id]: next };
    }
    case 'table': {
      const table = current && typeof current === 'object' ? current as { columns?: unknown[]; rows?: unknown[][] } : {};
      const columns = Array.isArray(table.columns) ? table.columns : [];
      const rows = Array.isArray(table.rows) ? table.rows.map(r => (Array.isArray(r) ? [...r] : [])) : [];
      // A table with no columns yet gets its first column, as the table editor adds one.
      if (!columns.length) return { columns: ['History audit'], rows: [['History audit']] } as InputValue;
      if (!rows.length) rows.push(columns.map(() => ''));
      rows[0]![0] = rows[0]![0] === 'History audit' ? 'History audit, again' : 'History audit';
      return { ...table, columns, rows } as InputValue;
    }
    case 'blocks': {
      // The first row's first text field, else its first other field with a second
      // value; an empty input gets a row first, as "Add" does.
      const fields = input.fields ?? [];
      const rows = Array.isArray(current) ? current.map(r => (r && typeof r === 'object' ? { ...(r as object) } : r)) as Record<string, unknown>[] : [];
      if (!rows.length) rows.push(blankRow(fields));
      const row = rows[0]!;
      const typed = (f: InputSpecLike): InputSpecLike => ({ ...f, type: f.type ?? 'text' });
      const ordered = [...fields.filter(f => ['text', 'longtext'].includes(f.type ?? 'text')), ...fields.filter(f => !['text', 'longtext'].includes(f.type ?? 'text'))];
      for (const field of ordered) {
        if (['asset', 'blocks', 'file'].includes(field.type ?? 'text')) continue;
        const next = secondValue(typed(field), row[field.id] ?? field.default);
        if (next === undefined) continue;
        row[field.id] = next;
        return rows as InputValue;
      }
      return undefined;
    }
    default: return undefined;
  }
}

/** A new blocks row with each field at its default, as "Add" makes one. */
export function blankRow(fields: readonly InputSpecLike[]): Record<string, unknown> {
  const blank = (type: string | undefined): unknown => type === 'boolean' ? false : type === 'number' ? 0 : type === 'color' ? '#000000' : type === 'asset' || type === 'select' ? null : '';
  return Object.fromEntries(fields.map(f => [f.id, f.default ?? blank(f.type)]));
}

/** Input types edited once each (the first input of each), in this order. */
const EDITED_TYPES = ['text', 'longtext', 'url', 'number', 'boolean', 'select', 'color', 'date', 'time', 'datetime-local', 'vector', 'table', 'blocks'] as const;
type AssetKind = 'image' | 'audio' | 'lottie';
const ASSET_KINDS: Readonly<Record<AssetKind, ReadonlySet<string | undefined>>> = {
  image: new Set([undefined, 'any', 'image', 'raster', 'vector']),
  audio: new Set(['audio']),
  lottie: new Set(['lottie']),
};
interface AssetSlot { input: InputSpecLike; field?: InputSpecLike; assetType?: string; kind: AssetKind }

/** Where the asset cases put their asset: the first image input (top level, then a
 *  blocks field, adding a row when the input is empty), else the first audio input,
 *  else the first Lottie input. Video inputs belong to the recording tools. */
export function assetSlot(manifest: ManifestLike): AssetSlot | null {
  for (const kind of ['image', 'audio', 'lottie'] as const) {
    const accepts = ASSET_KINDS[kind];
    for (const input of manifest.inputs ?? []) if (input.type === 'asset' && accepts.has(input.assetType)) return { input, assetType: input.assetType, kind };
    for (const input of manifest.inputs ?? []) {
      const field = input.type === 'blocks' ? (input.fields ?? []).find(f => f.type === 'asset' && accepts.has(f.assetType)) : undefined;
      if (field) return { input, field, assetType: field.assetType, kind };
    }
  }
  return null;
}

export interface AuditOptions {
  /** Origin of the local fixture server; without a server the http(s) case is skipped. */
  fixtureOrigin?: string;
  /** Read a tool file (`<id>/tool.json`, `<id>/hooks.js`, ...). Defaults to the
   *  pack's content roots; the tests hand in synthetic tools this way. */
  fetchFile?: (path: string) => Promise<string>;
}

interface Mounted { runtime: Runtime; tool: LoadedTool }

/**
 * Audit one tool. The caller owns determinism (installDeterminism) and sets
 * LOLLY_PROFILE for the pack before calling.
 */
async function auditOne(tool: PackTool, roots: ContentRoots, det: Determinism, opts: AuditOptions): Promise<ToolVerdict> {
  const started = performance.now();
  const web = await loadWebModules();
  const logs: string[] = [];
  const verdict: ToolVerdict = { id: tool.id, pack: tool.pack, historyClass: tool.historyClass, ok: false, cases: [], adopt: { name: 'a record saved before history adopts', outcome: 'skipped' }, clock: 'unknown', static: analyseDeterminism(tool.hooks), logs, ms: 0 };

  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="canvas"></div></body></html>', { url: 'http://localhost/', virtualConsole: new VirtualConsole() });
  const globals = globalThis as unknown as Record<string, unknown>;
  globals.window = dom.window;
  globals.document = dom.window.document;
  globals.Element = dom.window.Element;
  Object.defineProperty(globalThis, 'location', { value: dom.window.location, configurable: true, writable: true });

  const loaded = await loadTool(tool.id, opts.fetchFile ?? (path => readToolText(path, roots)));
  const manifest = loaded.manifest as ToolManifest;
  const baseHost = await createCliBridge({ dom: dom as never, profile: {}, networkAllowlist: manifest.network?.allowlist });
  const host = webShapedHost(baseHost as HostV1, logs);
  const tracked = trackedExecutor(det.reseed);
  const settle = (runtime: Runtime): Promise<void> => settleRuntime(runtime, tracked);
  const experience = { sessionMeta: () => (tool.id === 'design' ? { __workspace_intent: 'general' } : {}) };
  const colorInputs = new Set((manifest.inputs ?? []).filter(i => i.type === 'color').map(i => i.id));

  const mount = async (values: Record<string, InputValue>): Promise<Mounted> => {
    det.reseed();
    const runtime = await withTimeout(createRuntime(loaded, host, values, { hookExecutor: tracked.executor }), MOUNT_TIMEOUT_MS, 'mounting');
    await withTimeout((async () => { await web.migrateBlockRowIds(runtime); await settle(runtime); })(), MOUNT_TIMEOUT_MS, 'settling');
    return { runtime, tool: loaded };
  };
  const snapshot = (runtime: Runtime): SavedData =>
    web.snapshotSession(null, manifest, runtime as never, experience as never, () => '', () => '') as SavedData;

  const { db } = web.memoryDb();
  const state: WebState = web.createStateAPI(db as never, web.createRevisionStore(db as unknown as IDBPDatabase));
  let slotCounter = 0;

  /** Store the live runtime's snapshot, reopen it, compare. Returns the reopened
   *  runtime (the base for the next edit) or null when nothing could be stored. */
  const roundTrip = async (name: string, live: Runtime): Promise<Mounted | null> => {
    const t0 = performance.now();
    const liveRender = live.getHydrated();
    const data = snapshot(live);
    const slot = `${tool.id}:history-audit-${++slotCounter}`;
    try {
      await state.history!.checkpoint(slot, data as never, { reason: 'automatic', expectedHead: null });
    } catch (error) {
      verdict.cases.push({ name, outcome: 'refused', detail: `history refused the snapshot: ${(error as Error).message}`, ms: performance.now() - t0 });
      return null;
    }
    const stored = await state.load(slot) as SavedData;
    if (slotCounter === 1) verdict.storedBytes = new TextEncoder().encode(JSON.stringify(stored)).byteLength;
    let reopened: Mounted;
    try {
      const opened = await web.openToolSession(state, manifest, parseUrlState(`slot=${encodeURIComponent(slot)}`, manifest));
      reopened = await mount(opened.values);
    } catch (error) {
      verdict.cases.push({ name, outcome: 'error', detail: `reopening failed: ${(error as Error).message}`, ms: performance.now() - t0 });
      return null;
    }
    let again: SavedData;
    try {
      again = web.canonicalRevisionData(web.pinRevisionAssets(snapshot(reopened.runtime) as never)) as SavedData;
    } catch (error) {
      verdict.cases.push({ name, outcome: 'refused', detail: `the reopened document cannot be stored again: ${(error as Error).message}`, ms: performance.now() - t0 });
      return reopened;
    }
    const caches = setAsideTokenCaches(stored, again, colorInputs);
    const valueDiff = firstDifference(caches.stored, caches.reopened);
    const render = reopened.runtime.getHydrated();
    const doc = dom.window.document;
    const keyOrderOnly = render !== liveRender && normaliseEmbeddedJson(render, doc) === normaliseEmbeddedJson(liveRender, doc);
    const pinOnly = render !== liveRender && !keyOrderOnly && normaliseEmbeddedJson(render, doc, true) === normaliseEmbeddedJson(liveRender, doc, true);
    const dropped = reopened.runtime.droppedAssets.map(d => `${d.inputId} (${d.reason})`);
    const problems = [
      ...(valueDiff ? [`the reopened document differs: ${valueDiff}`] : []),
      ...(render !== liveRender && !keyOrderOnly && !pinOnly ? [renderDifference(liveRender, render)] : []),
      ...(dropped.length ? [`assets dropped on reopen: ${dropped.join(', ')}`] : []),
    ];
    verdict.cases.push({ name, outcome: problems.length ? 'differs' : 'identical', ...(problems.length ? { detail: problems.join('; ') } : {}),
      ...(keyOrderOnly || pinOnly || caches.refreshed.length ? { note: [
        ...(keyOrderOnly || pinOnly ? ['embedded JSON shows sorted keys after a reopen; arrays and every other byte match'] : []),
        ...(pinOnly ? ['the reopened upload carries the version pin history adds'] : []),
        ...(caches.refreshed.length ? [`token colour cache refreshed on reopen (the ref is kept): ${caches.refreshed.join(', ')}`] : []),
      ].join('; ') } : {}), ms: performance.now() - t0 });
    return reopened;
  };

  let base: Mounted | null = null;
  try {
    base = await mount({});
  } catch (error) {
    verdict.cases.push({ name: 'defaults', outcome: 'error', detail: `the tool did not mount headlessly: ${(error as Error).message}` });
  }
  const retire = (m: Mounted | null): void => { try { m?.runtime.destroy(); } catch { /* already torn down */ } };

  if (base) {
    let current: Mounted = base;
    /** Apply an edit to the current runtime, round-trip it, and move on from the
     *  reopened runtime (or from the edited one when nothing could be stored). */
    const step = async (name: string, edit: (rt: Runtime) => Promise<void>, restore?: (rt: Runtime) => Promise<void>): Promise<void> => {
      try {
        // A row the app adds carries its id from birth (lib/row-id.ts), so a row an
        // edit adds is stamped the same way before the snapshot.
        await withTimeout((async () => { await edit(current.runtime); await web.migrateBlockRowIds(current.runtime); await settle(current.runtime); })(), MOUNT_TIMEOUT_MS, 'the edit');
      } catch (error) {
        verdict.cases.push({ name, outcome: 'error', detail: `the edit failed: ${(error as Error).message}` });
        return;
      }
      const next = await roundTrip(name, current.runtime);
      if (next) { retire(current); current = next; }
      else if (restore) await restore(current.runtime).catch(() => {});
    };

    const first = await roundTrip('defaults', current.runtime);
    if (first) { retire(current); current = first; }

    // The first input of each type, edited to a second value.
    const inputs = manifest.inputs ?? [];
    for (const type of EDITED_TYPES) {
      const input = inputs.find(i => i.type === type) as InputSpecLike | undefined;
      if (!input) continue;
      const value = secondValue(input, current.runtime.getModel().find(m => m.id === input.id)?.value);
      if (value === undefined) { verdict.cases.push({ name: `${type} ${input.id}`, outcome: 'skipped', detail: 'no second value to write' }); continue; }
      await step(`${type} ${input.id}`, rt => rt.setInput(input.id, value));
    }

    // The first image input (else audio, else Lottie), filled from each asset source.
    const slotFor = assetSlot(tool.manifest);
    if (slotFor) {
      const where = slotFor.field ? `${slotFor.input.id}[0].${slotFor.field.id}` : slotFor.input.id;
      const raster = slotFor.assetType === 'raster', vector = slotFor.assetType === 'vector';
      const put = (ref: unknown) => async (rt: Runtime): Promise<void> => {
        if (!slotFor.field) { await rt.setInput(slotFor.input.id, ref as InputValue); return; }
        const rows = (rt.getModel().find(m => m.id === slotFor.input.id)?.value as Record<string, unknown>[] | undefined) ?? [];
        const withRow = rows.length ? rows : [blankRow(slotFor.input.fields ?? [])];
        await rt.setInput(slotFor.input.id, withRow.map((row, i) => (i === 0 ? { ...row, [slotFor.field!.id]: ref } : row)) as InputValue);
      };
      const previous = (): unknown => current.runtime.getModel().find(m => m.id === slotFor.input.id)?.value;
      const catalogTypes = slotFor.kind === 'audio' ? ['audio'] : slotFor.kind === 'lottie' ? ['lottie'] : raster ? ['raster'] : vector ? ['vector'] : ['raster', 'vector'];
      const catalog = (readAssetIndex(roots).assets as { id: string; type: string }[]).find(a => catalogTypes.includes(a.type));
      const notImage = slotFor.kind === 'image' ? undefined : `this ${slotFor.kind} input takes no image`;
      const rasterOnly = raster ? 'this input takes raster only, and a tool link renders SVG headlessly' : undefined;
      const noUrl = slotFor.kind === 'lottie' ? 'a Lottie comes from the catalog or an upload; the URL resolver takes images, audio and video' : undefined;
      const fileKind = slotFor.kind === 'audio' ? 'wav' : vector ? 'svg' : 'png';
      const sources: [string, () => Promise<unknown> | unknown, string?][] = [
        ['catalog id', async () => (catalog ? host.assets.get(catalog.id) : undefined), catalog ? undefined : `no catalog asset of type ${catalogTypes.join(' or ')} in this profile`],
        ['upload', async () => host.assets.get(upload(slotFor.kind === 'audio' ? 'audio' : slotFor.kind === 'lottie' ? 'lottie' : vector ? 'vector' : 'raster').id)],
        ['http(s) URL', async () => host.assets.get(`${opts.fixtureOrigin}/history-audit.${fileKind}`), noUrl ?? (opts.fixtureOrigin ? undefined : 'no fixture server')],
        ['tool link', async () => host.compose?.renderUrl?.(auditToolLink(tool.id)), notImage ?? rasterOnly],
        ['data: URL', async () => host.assets.get(slotFor.kind === 'audio' ? dataUrl(AUDIT_WAV, 'audio/wav') : raster ? dataUrl(AUDIT_PNG, 'image/png') : dataUrl(AUDIT_SVG, 'image/svg+xml')), noUrl],
        ['baked ref', async () => { const ref = await host.compose?.renderUrl?.(auditToolLink(tool.id)); return ref ? bakeAssetRef(ref, { now: AUDIT_NOW }) : undefined; }, notImage ?? rasterOnly],
      ];
      for (const [label, make, skip] of sources) {
        const name = `asset ${where} from ${label}`;
        if (skip) { verdict.cases.push({ name, outcome: 'skipped', detail: skip }); continue; }
        let ref: unknown;
        try { ref = await make(); } catch (error) { verdict.cases.push({ name, outcome: 'error', detail: `the source did not resolve: ${(error as Error).message}` }); continue; }
        if (!ref) { verdict.cases.push({ name, outcome: 'error', detail: 'the source resolved to nothing' }); continue; }
        const before = previous();
        await step(name, put(ref), rt => rt.setInput(slotFor.input.id, before as InputValue));
      }
    }

    // Class B: what history would store with the side file loaded.
    if (tool.historyClass === 'side-file') {
      const file = (manifest.inputs ?? []).find(i => i.type === 'file');
      if (file) {
        const value = { __file: true, name: 'history-audit.bin', mime: 'application/octet-stream', size: 8, bytes: new Uint8Array(8), url: null };
        await step(`file ${file.id} loaded`, rt => rt.setInput(file.id, (file.multiple ? [value] : value) as unknown as InputValue), rt => rt.setInput(file.id, (file.multiple ? [] : null) as InputValue));
      }
    }

    // Informational: the last stored document reopened a day later.
    try {
      const last = snapshot(current.runtime);
      const slot = `${tool.id}:history-audit-clock`;
      await state.history!.checkpoint(slot, last as never, { reason: 'automatic', expectedHead: null });
      const stored = await state.load(slot) as SavedData;
      const opened = await web.openToolSession(state, manifest, parseUrlState(`slot=${encodeURIComponent(slot)}`, manifest));
      const sameDay = await mount(opened.values);
      det.setNow(AUDIT_NOW + CLOCK_STEP);
      const later = await mount(opened.values);
      det.setNow(AUDIT_NOW);
      const renderMoved = later.runtime.getHydrated() !== sameDay.runtime.getHydrated();
      const laterCaches = setAsideTokenCaches(stored, web.canonicalRevisionData(web.pinRevisionAssets(snapshot(later.runtime) as never)) as SavedData, colorInputs);
      const valuesMoved = firstDifference(laterCaches.stored, laterCaches.reopened) !== null;
      verdict.clock = renderMoved && valuesMoved ? 'render+values' : renderMoved ? 'render' : valuesMoved ? 'values' : 'none';
      retire(sameDay); retire(later);
    } catch {
      det.setNow(AUDIT_NOW);
      verdict.clock = 'unknown';
    }
    retire(current);
  }

  // A record saved before history adopts, then an edit saved through the controller.
  verdict.adopt = await adoptCase(tool, manifest, mount, settle, snapshot, web).catch(error => ({ name: verdict.adopt.name, outcome: 'error' as const, detail: (error as Error).message }));

  verdict.ok = verdict.cases.length > 0 && verdict.cases.every(c => c.outcome === 'identical' || c.outcome === 'skipped') && (verdict.adopt.outcome === 'identical' || verdict.adopt.outcome === 'skipped');
  verdict.ms = performance.now() - started;
  dom.window.close();
  return verdict;
}

/**
 * Save through a state bridge that has no revision store, as a session saved
 * before history existed; reopen with the store; let the controller adopt it;
 * edit; Save. The save must be recorded as a revision (`recorded`, not written
 * around a paused history as `stored`) and the record must hold the edit.
 */
async function adoptCase(tool: PackTool, manifest: ToolManifest, mount: (v: Record<string, InputValue>) => Promise<Mounted>,
  settle: (rt: Runtime) => Promise<void>, snapshot: (rt: Runtime) => SavedData, web: WebModules): Promise<CaseResult> {
  const name = 'a record saved before history adopts';
  const t0 = performance.now();
  const editable = (manifest.inputs ?? []).map(i => i as InputSpecLike).filter(i => EDITED_TYPES.includes(i.type as typeof EDITED_TYPES[number]));
  if (!editable.length) return { name, outcome: 'skipped', detail: 'no input of an edited type' };
  const { db } = web.memoryDb();
  const legacy = web.createStateAPI(db as never);
  const slot = `${tool.id}:history-audit-legacy`;
  const first = await mount({});
  const saved = snapshot(first.runtime);
  first.runtime.destroy();
  await legacy.save(slot, saved as never);
  const state = web.createStateAPI(db as never, web.createRevisionStore(db as unknown as IDBPDatabase));
  const opened = await web.openToolSession(state, manifest, parseUrlState(`slot=${encodeURIComponent(slot)}`, manifest));
  const reopened = await mount(opened.values);
  const failures: string[] = [];
  let active: string | null = slot;
  const controller = web.createAutomaticHistory({
    history: state.history!, ...(opened.cursor ? { initial: opened.cursor } : {}), toolId: tool.id,
    getSlot: () => active, setSlot: next => { active = next; }, snapshot: () => snapshot(reopened.runtime) as never,
    load: s => state.load(s), capture: async () => null, saved() {}, store: (s, d) => state.save(s, d),
    failure: message => { failures.push(message); },
  });
  try {
    await new Promise(done => setTimeout(done, 0));
    const model = reopened.runtime.getModel();
    const choice = editable.map(input => ({ input, value: secondValue(input, model.find(m => m.id === input.id)?.value) })).find(c => c.value !== undefined);
    if (!choice) return { name, outcome: 'skipped', detail: 'no input has a second value to write' };
    await reopened.runtime.setInput(choice.input.id, choice.value!);
    await web.migrateBlockRowIds(reopened.runtime);
    await settle(reopened.runtime);
    const outcome = await controller.save(slot, snapshot(reopened.runtime) as never);
    const record = await state.load(slot) as SavedData;
    const before = web.canonicalRevisionData(web.pinRevisionAssets(saved as never));
    const expected = web.canonicalRevisionData(web.pinRevisionAssets(snapshot(reopened.runtime) as never));
    const entries = (await state.history!.list({ slot })).entries.length;
    const problems = [
      ...(outcome !== 'recorded' ? [`Save was ${outcome}, not recorded as a revision (${controller.status()})`] : []),
      ...(failures.length ? [`history reported: ${failures.join(' / ')}`] : []),
      ...(firstDifference(before, record) === null ? ['the record still holds the old save'] : []),
      ...(firstDifference(expected, record) ? [`the record is not the saved edit: ${firstDifference(expected, record)}`] : []),
      ...(entries < 2 ? [`${entries} revision(s) after adopt and save, expected 2`] : []),
    ];
    return { name, outcome: problems.length ? 'differs' : 'identical', ...(problems.length ? { detail: problems.join('; ') } : {}), ms: performance.now() - t0 };
  } finally {
    controller.dispose();
    reopened.runtime.destroy();
  }
}

/**
 * The snapshot Save and automatic history take of a tool at its defaults, mounted
 * the way the gate mounts it (CLI host, row ids stamped, hooks settled). The
 * snapshot bench measures these. Community tools read the lolly-start profile.
 */
export async function snapshotAtDefaults(toolId: string, opts: { profile?: string } = {}): Promise<Record<string, unknown>> {
  const web = await loadWebModules();
  const profile = opts.profile ?? PACKS[0]!.profile;
  const priorProfile = process.env.LOLLY_PROFILE;
  process.env.LOLLY_PROFILE = profile;
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="canvas"></div></body></html>', { url: 'http://localhost/', virtualConsole: new VirtualConsole() });
  const globals = globalThis as unknown as Record<string, unknown>;
  globals.window = dom.window; globals.document = dom.window.document; globals.Element = dom.window.Element;
  try {
    const loaded = await loadTool(toolId, path => readToolText(path, contentRoots({ profile })));
    const base = await createCliBridge({ dom: dom as never, profile: {}, networkAllowlist: loaded.manifest.network?.allowlist });
    const tracked = trackedExecutor();
    const runtime = await createRuntime(loaded, webShapedHost(base as HostV1, []), {}, { hookExecutor: tracked.executor });
    await web.migrateBlockRowIds(runtime);
    await settleRuntime(runtime, tracked);
    const data = web.snapshotSession(null, loaded.manifest, runtime as never, { sessionMeta: () => (toolId === 'design' ? { __workspace_intent: 'general' } : {}) } as never, () => '', () => '') as Record<string, unknown>;
    runtime.destroy();
    return data;
  } finally {
    if (priorProfile === undefined) delete process.env.LOLLY_PROFILE; else process.env.LOLLY_PROFILE = priorProfile;
    dom.window.close();
  }
}

/** The verdict for a tool the gate could not audit at all. */
function unauditable(tool: PackTool, error: Error): ToolVerdict {
  return {
    id: tool.id, pack: tool.pack, historyClass: tool.historyClass, ok: false,
    cases: [{ name: 'defaults', outcome: 'error', detail: error.message }],
    adopt: { name: 'a record saved before history adopts', outcome: 'skipped' }, clock: 'unknown',
    static: analyseDeterminism(tool.hooks), logs: [], ms: 0,
  };
}

/** Audit one tool outside a pack walk (the tests use it for synthetic tools). */
export async function auditTool(tool: PackTool, opts: Pick<AuditOptions, 'fetchFile'> & { profile?: string } = {}): Promise<ToolVerdict> {
  const det = installDeterminism();
  const { server, origin } = await serveFixtures();
  const priorProfile = process.env.LOLLY_PROFILE;
  const profile = opts.profile ?? PACKS[0]!.profile;
  process.env.LOLLY_PROFILE = profile;
  try {
    return await auditOne(tool, contentRoots({ profile }), det, { fixtureOrigin: origin, ...(opts.fetchFile ? { fetchFile: opts.fetchFile } : {}) })
      .catch((error: Error) => unauditable(tool, error));
  } finally {
    if (priorProfile === undefined) delete process.env.LOLLY_PROFILE; else process.env.LOLLY_PROFILE = priorProfile;
    det.restore();
    await new Promise<void>(close => server.close(() => close()));
  }
}

/** Audit every gated tool in the requested packs. */
export async function auditTools(opts: { all?: boolean; only?: readonly string[]; onVerdict?: (v: ToolVerdict) => void } = {}): Promise<ToolVerdict[]> {
  const det = installDeterminism();
  const { server, origin } = await serveFixtures();
  const priorProfile = process.env.LOLLY_PROFILE;
  const verdicts: ToolVerdict[] = [];
  const done = new Set<string>();
  try {
    for (const pack of PACKS) {
      if (pack.name !== 'community' && (!opts.all || !packMounted(pack))) continue;
      process.env.LOLLY_PROFILE = pack.profile;
      const roots = contentRoots({ profile: pack.profile });
      for (const tool of packTools(pack)) {
        if (!GATED_CLASSES.has(tool.historyClass)) continue;
        if (opts.only && !opts.only.includes(tool.id)) continue;
        // A SUSE overlay of a community id is audited as its own pack's tool.
        const key = `${pack.name}:${tool.id}`;
        if (done.has(key)) continue;
        done.add(key);
        const verdict = await auditOne(tool, roots, det, { fixtureOrigin: origin }).catch((error: Error) => unauditable(tool, error));
        verdicts.push(verdict);
        opts.onVerdict?.(verdict);
      }
    }
  } finally {
    if (priorProfile === undefined) delete process.env.LOLLY_PROFILE; else process.env.LOLLY_PROFILE = priorProfile;
    det.restore();
    await new Promise<void>(close => server.close(() => close()));
  }
  return verdicts;
}

/** One report line per tool. */
export function verdictLine(v: ToolVerdict, exceptions: Readonly<Record<string, string>>): string {
  const listed = v.id in exceptions;
  const mark = v.ok ? (listed ? '-' : '✓') : (listed ? '=' : '✗');
  const counted = v.cases.filter(c => c.outcome === 'identical').length;
  const failure = [...v.cases, v.adopt].find(c => c.outcome !== 'identical' && c.outcome !== 'skipped');
  const clock = v.clock === 'none' ? '' : ` clock:${v.clock}`;
  const reads = v.static.clock.length ? ` reads:${v.static.clock.map(c => c.name).join(',')}` : '';
  const notes = v.cases.filter(c => c.note).length;
  const noted = notes ? ` notes:${notes}` : '';
  return `${mark} ${v.id.padEnd(22)} ${CLASS_LETTER[v.historyClass]} ${v.pack.padEnd(9)} ${String(counted).padStart(2)} identical${clock}${reads}${noted}${failure ? `  ${failure.name}: ${failure.outcome}${failure.detail ? ` (${failure.detail})` : ''}` : ''}`;
}

export async function run(argv = process.argv.slice(2)): Promise<number> {
  const all = argv.includes('--all');
  const json = argv.includes('--json');
  const only = argv.find(a => a.startsWith('--only='))?.slice('--only='.length).split(',').filter(Boolean);
  const out = (line: string): void => { (json ? process.stderr : process.stdout).write(`${line}\n`); };
  // With --json, stdout carries the verdicts alone: the engine's catalog notice and
  // any hook's console output go to stderr with the progress lines.
  if (json) for (const level of ['log', 'info', 'debug'] as const) console[level] = (...args: unknown[]) => { process.stderr.write(`${format(...args)}\n`); };
  const packs = census({ all });
  for (const p of packs) out(`census ${p.pack.padEnd(9)} A ${p.counts.A}  B ${p.counts.B}  C ${p.counts.C}  D ${p.counts.D}${p.overlays.length ? `  (overlays of community tools: ${p.overlays.join(', ')})` : ''}`);
  if (all && !packMounted(PACKS[1]!)) out('census suse      not mounted (a public clone): nothing to add');
  if (argv.includes('--census')) return 0;
  const exceptions = readExceptions();
  const verdicts = await auditTools({ all, ...(only ? { only } : {}), onVerdict: v => out(verdictLine(v, exceptions)) });
  const { unlisted, stale } = compareWithExceptions(verdicts, only ? Object.fromEntries(Object.entries(exceptions).filter(([id]) => only.includes(id))) : exceptions);
  const failing = verdicts.filter(v => !v.ok).length;
  out(`\n${verdicts.length} tool(s) audited: ${verdicts.length - failing} round-trip identically, ${failing} do not.`);
  for (const id of unlisted) out(`✗ ${id} fails and is not in ${EXCEPTIONS_PATH.slice(ROOT.length + 1)}: add it with the reason above, or fix the tool.`);
  for (const id of stale) out(`✗ ${id} is in the exceptions map but now round-trips: remove its entry (the map only shrinks).`);
  if (json) process.stdout.write(`${JSON.stringify({ census: packs, verdicts }, null, 2)}\n`);
  return unlisted.length || stale.length ? 1 : 0;
}

const invoked = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invoked) {
  // Hooks may leave timers behind; the report is complete once run() resolves.
  run().then(code => process.exit(code), error => { console.error(error); process.exit(2); });
}
