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
import { readFileSync } from 'node:fs';
import { readToolManifestText, toolFile } from './content-roots.ts';

export const BROWSER_FREE_FILE = 'browser-free.json';
export const BROWSER_FREE_RECORD_VERSION = 1;
/** Text this size or larger is not a record (the six measured tools' records are under 8 KB). */
export const BROWSER_FREE_MAX_CHARS = 64_000;

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

/** Read a record's text: the record, or why it is not one. Shape only; the schema says the rest. */
export function parseBrowserFreeRecord(text: string): { record: BrowserFreeRecordV1 } | { problem: string } {
  if (text.length >= BROWSER_FREE_MAX_CHARS) return { problem: `${BROWSER_FREE_FILE} is larger than a record` };
  let value: unknown;
  try { value = JSON.parse(text); } catch (err) { return { problem: `${BROWSER_FREE_FILE} is not JSON (${(err as Error).message})` }; }
  const r = value as Partial<BrowserFreeRecordV1> | null;
  if (!r || typeof r !== 'object' || r.version !== BROWSER_FREE_RECORD_VERSION) return { problem: `${BROWSER_FREE_FILE} is not a version ${BROWSER_FREE_RECORD_VERSION} record` };
  if (!r.tool || typeof r.tool.id !== 'string' || typeof r.tool.version !== 'string' || typeof r.tool.digest !== 'string') return { problem: `${BROWSER_FREE_FILE} does not say which tool it measured` };
  if (r.verdict !== 'resvg' && r.verdict !== 'browser') return { problem: `${BROWSER_FREE_FILE} has no verdict` };
  if (!Array.isArray(r.cases)) return { problem: `${BROWSER_FREE_FILE} lists no cases` };
  return { record: r as BrowserFreeRecordV1 };
}

/**
 * Whether a record admits the tool as it is now: the verdict is `resvg`, and the record was
 * measured against this tool, this version and these files. `stale` says why one that once
 * admitted the tool no longer does.
 */
export function browserFreeStatus(record: BrowserFreeRecordV1, tool: { id: string; version: string; digest: string }): { admitted: boolean; stale?: string } {
  if (record.tool.id !== tool.id) return { admitted: false, stale: `the record names the ${record.tool.id} tool` };
  if (record.verdict !== 'resvg') return { admitted: false };
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
  try { return parseBrowserFreeRecord(readFileSync(path, 'utf8')); } catch (err) { return { problem: `${BROWSER_FREE_FILE} could not be read (${(err as Error).message})` }; }
}
