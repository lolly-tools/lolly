// SPDX-License-Identifier: MPL-2.0
/**
 * A tool's `browser-free.json`: the evidence that the Node shells' browser-free raster
 * route (resvg) draws the tool the way the browser tier does. It sits beside `tool.json`
 * as `intents.json` does, and like that file it is optional and loading a tool never reads
 * it, so the web shell, the desktop and mobile apps and every older engine are untouched.
 * Only the Node hosts read it (`toolAdmission` in resvg-admission.ts), through the
 * content-roots resolver.
 *
 * `scripts/tool-browser-free.ts --verify --write` writes it: the cases measured, the bands,
 * the date, the web shell commit and the renderers compared, and the verdict. It records
 * the tool's version and a digest of the files that decide its drawing (`tool.json`,
 * `template.html`, `styles.css`, `hooks.js`), so a record that no longer describes the tool
 * admits nothing until the script runs again; `validate:catalog` reports such a record as
 * a warning, so a tool edit is never blocked by a missing browser. Shape: schemas/
 * browser-free-v1.schema.json. A signed catalog covers the file like every other file in
 * the tool's folder (scripts/sign-catalog.ts).
 */
import { createHash } from 'node:crypto';
import { closeSync, fstatSync, openSync, readFileSync, readSync } from 'node:fs';
import { readToolManifestText, toolFile } from './content-roots.ts';

export const BROWSER_FREE_FILE = 'browser-free.json';
export const BROWSER_FREE_RECORD_VERSION = 1;
/** A file this many bytes or larger is not a record (the eight measured tools' records are under 8 KB). */
export const BROWSER_FREE_MAX_BYTES = 64_000;

export type BrowserFreeCaseResult = 'inside' | 'outside' | 'refused' | 'error';

/** schemas/browser-free-v1.schema.json. */
export interface BrowserFreeRecordV1 {
  version: 1;
  /** The tool the record describes, as it was when measured. */
  tool: { id: string; version: string; digest: string };
  /** `resvg`: the route may draw this tool; `browser`: it may not. */
  verdict: 'resvg' | 'browser';
  measured: {
    /** ISO date of the run. */
    date: string;
    /** The content profile the cases ran under. */
    profile: string;
    /** The commit the compared web shell was built from. */
    webShell: string;
    renderers: { resvg: string; engine: string; chromium: string };
    /** The plan 326 bands the comparison applied. */
    bands: { threshold: number; fillThreshold: number; regionShare: number; inkShare: number; inkShift: number; gradientLevels: number };
  };
  cases: Array<{ name: string; args: string[]; result: BrowserFreeCaseResult; detail?: string }>;
}

/**
 * The digest a record is measured against: the files that decide the tool's drawing, read
 * by `read` (null for one the tool lacks). One algorithm for the writer, the reader and
 * validate-catalog.
 */
export function digestToolSources(read: (name: string) => string | null): string {
  const hash = createHash('sha256');
  for (const name of ['tool.json', 'template.html', 'styles.css', 'hooks.js']) {
    const text = read(name);
    hash.update(`${name}\n${text === null ? '\u0000absent' : text}\n`);
  }
  return hash.digest('hex');
}

/** The digest of a tool in the active profile, through the content-roots resolver. */
export function toolSourceDigest(id: string): string {
  return digestToolSources((name) => {
    if (name === 'tool.json') return toolFile(id, name) ? readToolManifestText(id) : null;
    const path = toolFile(id, name);
    return path ? readFileSync(path, 'utf8') : null;
  });
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const onlyKeys = (v: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(v).every((k) => keys.includes(k));
const shortString = (v: unknown, max: number, min = 0): boolean => typeof v === 'string' && v.length >= min && v.length <= max;
const BAND_KEYS = ['threshold', 'fillThreshold', 'regionShare', 'inkShare', 'inkShift', 'gradientLevels'] as const;
const RESULTS: readonly string[] = ['inside', 'outside', 'refused', 'error'];

/**
 * Why a parsed value is not a version 1 record, or null when it is one. The same rules as
 * schemas/browser-free-v1.schema.json, checked here because a shell reads the file at
 * render time and must not trust one that `validate:catalog` never saw.
 */
export function browserFreeRecordProblem(value: unknown): string | null {
  if (!isObject(value) || value.version !== BROWSER_FREE_RECORD_VERSION) return `is not a version ${BROWSER_FREE_RECORD_VERSION} record`;
  if (!onlyKeys(value, ['version', 'tool', 'verdict', 'measured', 'cases'])) return 'has a key a record does not carry';
  const { tool, verdict, measured, cases } = value;
  if (!isObject(tool) || !onlyKeys(tool, ['id', 'version', 'digest'])
    || typeof tool.id !== 'string' || !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(tool.id)
    || !shortString(tool.version, 40, 1) || typeof tool.digest !== 'string' || !/^[0-9a-f]{64}$/.test(tool.digest)) return 'does not say which tool it measured';
  if (verdict !== 'resvg' && verdict !== 'browser') return 'has no verdict';
  if (!isObject(measured) || !onlyKeys(measured, ['date', 'profile', 'webShell', 'renderers', 'bands'])
    || typeof measured.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(measured.date)
    || !shortString(measured.profile, 80) || !shortString(measured.webShell, 80)) return 'does not say when and against what it was measured';
  const { renderers, bands } = measured;
  if (!isObject(renderers) || !onlyKeys(renderers, ['resvg', 'engine', 'chromium'])
    || !shortString(renderers.resvg, 40) || !shortString(renderers.engine, 40) || !shortString(renderers.chromium, 80)) return 'does not list the renderers it compared';
  if (!isObject(bands) || !onlyKeys(bands, BAND_KEYS) || !BAND_KEYS.every((k) => typeof bands[k] === 'number' && Number.isFinite(bands[k]))) return 'does not list the bands it applied';
  if (!Array.isArray(cases) || cases.length < 1 || cases.length > 200) return 'lists no cases';
  for (const c of cases) {
    if (!isObject(c) || !onlyKeys(c, ['name', 'args', 'result', 'detail']) || !shortString(c.name, 120)
      || !Array.isArray(c.args) || c.args.length > 40 || !c.args.every((arg) => shortString(arg, 16000))
      || typeof c.result !== 'string' || !RESULTS.includes(c.result)
      || (c.detail !== undefined && !shortString(c.detail, 2000))) return 'has a case that is not a measured case';
  }
  return null;
}

/** Read a record's text: the record, or why it is not one. */
export function parseBrowserFreeRecord(text: string): { record: BrowserFreeRecordV1 } | { problem: string } {
  if (text.length >= BROWSER_FREE_MAX_BYTES) return { problem: `${BROWSER_FREE_FILE} is larger than a record` };
  let value: unknown;
  try { value = JSON.parse(text); } catch (err) { return { problem: `${BROWSER_FREE_FILE} is not JSON (${(err as Error).message})` }; }
  const problem = browserFreeRecordProblem(value);
  return problem ? { problem: `${BROWSER_FREE_FILE} ${problem}` } : { record: value as unknown as BrowserFreeRecordV1 };
}

/**
 * A record file's text, read no further than the record limit: a file that size or larger
 * is refused from its size alone, so a large file never reaches memory.
 */
export function readBrowserFreeText(path: string): { text: string } | { problem: string } {
  const fd = openSync(path, 'r');
  try {
    const { size } = fstatSync(fd);
    if (size >= BROWSER_FREE_MAX_BYTES) return { problem: `${BROWSER_FREE_FILE} is larger than a record` };
    const buffer = Buffer.alloc(size);
    let read = 0;
    while (read < size) {
      const n = readSync(fd, buffer, read, size - read, read);
      if (n === 0) break;
      read += n;
    }
    return { text: buffer.subarray(0, read).toString('utf8') };
  } finally {
    closeSync(fd);
  }
}

/**
 * Whether a record admits the tool as it is now: the verdict is `resvg`, and the record was
 * measured against this tool, this version and these files. `stale` says why one that once
 * admitted the tool no longer does.
 */
export function browserFreeStatus(record: BrowserFreeRecordV1, tool: { id: string; version: string; digest: string }): { admitted: boolean; stale?: string } {
  if (record.tool.id !== tool.id) return { admitted: false, stale: `the record is for the ${record.tool.id} tool` };
  if (record.verdict !== 'resvg') return { admitted: false };
  // A resvg verdict stands only on its own cases: at least one drawn inside, none outside.
  if (!record.cases.some((c) => c.result === 'inside') || record.cases.some((c) => c.result === 'outside' || c.result === 'error')) {
    return { admitted: false, stale: 'the record\'s cases do not support its verdict' };
  }
  if (record.tool.version !== tool.version) return { admitted: false, stale: `the record was measured on version ${record.tool.version}, and the tool is now ${tool.version}` };
  if (record.tool.digest !== tool.digest) return { admitted: false, stale: 'the tool\'s files changed since the record was measured' };
  return { admitted: true };
}

/** The record beside a tool in the active profile, read through the resolver: null when the tool has none. */
export function readBrowserFreeRecord(id: string): { record: BrowserFreeRecordV1 } | { problem: string } | null {
  // A tool the active profile does not hold (a folder loaded from a path) has no record here.
  let path: string | null;
  try { path = toolFile(id, BROWSER_FREE_FILE); } catch { return null; }
  if (!path) return null;
  try {
    const read = readBrowserFreeText(path);
    return 'problem' in read ? read : parseBrowserFreeRecord(read.text);
  } catch (err) {
    return { problem: `${BROWSER_FREE_FILE} could not be read (${(err as Error).message})` };
  }
}
