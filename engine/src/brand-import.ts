// SPDX-License-Identifier: MPL-2.0
/**
 * Brand token ingestion. Container extraction for the three shapes Penpot
 * (and Tokens Studio) use to export the SAME token document:
 *
 *   1. Monolithic `tokens.json`: the whole Tokens-Studio/DTCG doc in one file
 *      (`coerceTokensDoc`).
 *   2. One-file-per-set: `$metadata.json` plus `$themes.json` at the root, and
 *      every other `<set name>.json`, where a `/` in the set name is a real
 *      subdirectory (`Color theme/Muted` → `Color theme/Muted.json`). File
 *      content is the unwrapped set body (`assembleTokenSetFiles`).
 *   3. A `.penpot` project zip: `manifest.json` lists files, and each file's
 *      token doc (shape 1) lives at `files/<id>/tokens.json`
 *      (`extractPenpotProject`).
 *
 * Each helper reassembles its container back into the single document shape
 * `tokens.ts` `createTokenSet` already consumes (top-level sets, `$themes`,
 * `$metadata.tokenSetOrder`, `{dotted.path}` aliases, `$type` inheritance).
 * This module handles *containers only*, never token semantics.
 *
 * PURE and platform-agnostic like the rest of the engine: no node:fs/node:path,
 * no DOM, no network. All IO stays in the caller: `assembleTokenSetFiles`
 * takes already-parsed JSON, and `extractPenpotProject` takes already-unzipped
 * path→bytes entries (fflate's `unzipSync` shape), the same way design-map.ts
 * takes pre-parsed design JSON. Extraction never throws on bad input; problems
 * accumulate in `warnings`, and the worst case is `doc: null`.
 *
 * Deliberate v1 non-goals:
 *   - No math-expression evaluation: a Tokens-Studio value like
 *     `"{scale.base}*1.5"` passes through untouched (it is not a whole-value
 *     alias, so createTokenSet keeps it verbatim).
 *   - No plural→canonical `$type` remapping (`colors`→`color` etc.);
 *     createTokenSet consumes the doc as-is and `.colors()` only needs
 *     resolvable `color` tokens.
 *   - No zip inflation - the shell/script that has the archive inflates it.
 */

import { createTokenSet, tokenSetNames } from './tokens.ts';
import { collectPenpotFontUsage } from './design-map.ts';
import type { PenpotFontUsage } from './design-map.ts';

type UnknownRecord = Record<string, unknown>;
const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

// ── Hostile-container budgets ────────────────────────────────────────────────────────────────
// These are deliberately above the web source router's ordinary 10 MB token
// document / 200 set-file policy. The engine still needs its own last line of
// defence because CLI, scripts and future shells can call these helpers
// directly, and a Penpot project contains many JSON parts rather than one.

/** Maximum bytes in one already-inflated Penpot JSON part. */
export const BRAND_IMPORT_MAX_PART_BYTES = 16 * 1024 * 1024;
/** Maximum UTF-16 code units when a caller supplies an already-decoded part. */
export const BRAND_IMPORT_MAX_PART_CHARS = 16 * 1024 * 1024;
/** Maximum aggregate bytes/code units parsed during one project census. */
export const BRAND_IMPORT_MAX_JSON_UNITS = 64 * 1024 * 1024;
/** Maximum archive members considered, including media members we ignore. */
export const BRAND_IMPORT_MAX_ENTRIES = 50_000;
/** Maximum page-shape JSON parts walked by either usage census. */
export const BRAND_IMPORT_MAX_PAGE_PARTS = 25_000;
/** Maximum token documents merged out of one Penpot project. */
export const BRAND_IMPORT_MAX_TOKEN_DOCS = 512;
/** Maximum loose set files, far above the web importer's ordinary 200. */
export const BRAND_IMPORT_MAX_SET_FILES = 2_048;
/** Maximum distinct top-level token sets in any assembled document. */
export const BRAND_IMPORT_MAX_TOKEN_SETS = 4_096;
/** Maximum values visited across the parsed JSON used by one operation. */
export const BRAND_IMPORT_MAX_NODES = 1_000_000;
/** Maximum array/object nesting. Token documents are normally under 10 deep. */
export const BRAND_IMPORT_MAX_DEPTH = 64;

interface StructureBudget { nodes: number }
interface ParseBudget {
  units: number;
  structure: StructureBudget;
  /** A limit violation refuses the whole operation; malformed JSON only skips one part. */
  refused: boolean;
}

const newParseBudget = (): ParseBudget => ({ units: 0, structure: { nodes: 0 }, refused: false });

/**
 * Iterative, cycle-aware preflight before any recursive consumer sees parsed
 * JSON. Shared references are counted each time (matching the work a serializer
 * would do); only a reference encountered again on its active ancestor chain is
 * a cycle. The try/catch keeps the public never-throw contract even when a
 * direct JS caller supplies getters/proxies rather than JSON.parse output.
 */
function structureIssue(value: unknown, budget: StructureBudget): string | null {
  type Frame = { value: unknown; depth: number; leave?: object };
  const active = new WeakSet<object>();
  const stack: Frame[] = [{ value, depth: 0 }];
  try {
    while (stack.length) {
      const frame = stack.pop()!;
      if (frame.leave) {
        active.delete(frame.leave);
        continue;
      }
      budget.nodes++;
      if (budget.nodes > BRAND_IMPORT_MAX_NODES) {
        return `JSON structure exceeds ${BRAND_IMPORT_MAX_NODES.toLocaleString('en')} values`;
      }
      if (frame.depth > BRAND_IMPORT_MAX_DEPTH) {
        return `JSON structure exceeds ${BRAND_IMPORT_MAX_DEPTH} levels`;
      }
      if (typeof frame.value !== 'object' || frame.value === null) continue;
      if (active.has(frame.value)) return 'JSON structure contains a cycle';
      active.add(frame.value);
      stack.push({ value: undefined, depth: frame.depth, leave: frame.value });
      const children = Array.isArray(frame.value)
        ? frame.value
        : Object.keys(frame.value).map((key) => (frame.value as UnknownRecord)[key]);
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push({ value: children[i], depth: frame.depth + 1 });
      }
    }
    return null;
  } catch {
    return 'JSON structure could not be inspected safely';
  }
}

function topLevelSetIssue(doc: UnknownRecord): string | null {
  try {
    const count = Object.keys(doc).filter((key) => key !== '$themes' && key !== '$metadata').length;
    return count > BRAND_IMPORT_MAX_TOKEN_SETS
      ? `token document carries more than ${BRAND_IMPORT_MAX_TOKEN_SETS.toLocaleString('en')} top-level sets`
      : null;
  } catch {
    return 'token document keys could not be inspected safely';
  }
}

/** The result of pulling a token document out of one of the three containers. */
export interface TokensExtraction {
  /** Reassembled Tokens-Studio/DTCG document, or null when nothing usable was found. */
  doc: Record<string, unknown> | null;
  /** Per-entry parse failures, set collisions, missing tokens.json, … - never fatal. */
  warnings: string[];
  /** Which container shape produced the document. */
  source: 'dtcg' | 'tokens-studio' | 'token-set-files' | 'penpot-project';
}

// Key-order-insensitive equality for "same set exported twice?" checks - JSON
// from different files may serialise identical bodies with different key order,
// and a false "differs" warning is worse than the O(n log n) sort.
function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (isRecord(v)) {
    const keys = Object.keys(v).sort();
    return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'undefined';
}

/**
 * Classify an already-parsed monolithic token document (container shape 1).
 * `source` is 'tokens-studio' when the doc carries `$themes`/`$metadata`
 * (top-level keys are sets), plain 'dtcg' otherwise (one implicit set).
 * Anything but a plain object → `doc: null` with a warning.
 */
export function coerceTokensDoc(json: unknown): TokensExtraction {
  if (!isRecord(json)) {
    return {
      doc: null,
      warnings: [`tokens document is ${json === null ? 'null' : Array.isArray(json) ? 'an array' : `a ${typeof json}`}, expected an object`],
      source: 'dtcg',
    };
  }
  const studio = '$themes' in json || '$metadata' in json;
  const issue = topLevelSetIssue(json) ?? structureIssue(json, { nodes: 0 });
  if (issue) return { doc: null, warnings: [issue], source: studio ? 'tokens-studio' : 'dtcg' };
  return { doc: json, warnings: [], source: studio ? 'tokens-studio' : 'dtcg' };
}

/**
 * Reassemble a one-file-per-set export (container shape 2) into one document.
 *
 * @param files POSIX relative path → already-parsed JSON (caller does the IO).
 *   `$metadata.json` / `$themes.json` (root only) become `$metadata` / `$themes`;
 *   every other `*.json` becomes the set named by its path minus `.json` -
 *   subdirectories are part of the set name (`Color theme/Muted.json` → set
 *   `Color theme/Muted`). Non-.json keys and malformed bodies are skipped with
 *   a warning. Set ordering is irrelevant here: layering order comes from
 *   `$metadata.tokenSetOrder`, not object key order.
 */
export function assembleTokenSetFiles(files: Record<string, unknown>): TokensExtraction {
  const warnings: string[] = [];
  let paths: string[];
  try {
    paths = Object.keys(files);
  } catch {
    return { doc: null, warnings: ['token set file list could not be inspected safely'], source: 'token-set-files' };
  }
  if (paths.length > BRAND_IMPORT_MAX_SET_FILES) {
    return {
      doc: null,
      warnings: [`token export carries more than ${BRAND_IMPORT_MAX_SET_FILES.toLocaleString('en')} files`],
      source: 'token-set-files',
    };
  }
  // Null-prototype accumulator: a set legitimately named "__proto__" (its file
  // is attacker-/user-controlled) must become an own key, not a prototype swap.
  const doc: UnknownRecord = Object.create(null);
  const structure = { nodes: 0 };
  let setCount = 0;
  for (const path of paths) {
    let body: unknown;
    try {
      body = files[path];
    } catch {
      warnings.push(`${path}: body could not be read safely - ignored`);
      continue;
    }
    if (path === '$metadata.json') {
      if (isRecord(body)) {
        const issue = structureIssue(body, structure);
        if (issue) return { doc: null, warnings: [...warnings, `${path}: ${issue}`], source: 'token-set-files' };
        doc.$metadata = body;
      }
      else warnings.push(`$metadata.json is not an object - ignored`);
      continue;
    }
    if (path === '$themes.json') {
      if (Array.isArray(body)) {
        const issue = structureIssue(body, structure);
        if (issue) return { doc: null, warnings: [...warnings, `${path}: ${issue}`], source: 'token-set-files' };
        doc.$themes = body;
      }
      else warnings.push(`$themes.json is not an array - ignored`);
      continue;
    }
    if (!path.endsWith('.json')) {
      warnings.push(`${path}: not a .json file - ignored`);
      continue;
    }
    if (!isRecord(body)) {
      warnings.push(`${path}: set body is not an object - ignored`);
      continue;
    }
    const issue = structureIssue(body, structure);
    if (issue) return { doc: null, warnings: [...warnings, `${path}: ${issue}`], source: 'token-set-files' };
    if (setCount >= BRAND_IMPORT_MAX_TOKEN_SETS) {
      return {
        doc: null,
        warnings: [...warnings, `token export carries more than ${BRAND_IMPORT_MAX_TOKEN_SETS.toLocaleString('en')} sets`],
        source: 'token-set-files',
      };
    }
    doc[path.slice(0, -'.json'.length)] = body;
    setCount++;
  }
  // $themes/$metadata alone carry no tokens; a doc without a single set is unusable.
  if (!setCount) {
    warnings.push('no token set files found');
    return { doc: null, warnings, source: 'token-set-files' };
  }
  return { doc, warnings, source: 'token-set-files' };
}

const decoder = /* lazily shared; TextDecoder is a web+node global */ new TextDecoder();
const asText = (v: Uint8Array | string): string => (typeof v === 'string' ? v : decoder.decode(v));

function parseEntry(
  entries: Record<string, Uint8Array | string>, path: string, warnings: string[], budget: ParseBudget,
): unknown {
  const raw = entries[path];
  if (raw === undefined) return undefined;
  const units = raw.length;
  const partLimit = typeof raw === 'string' ? BRAND_IMPORT_MAX_PART_CHARS : BRAND_IMPORT_MAX_PART_BYTES;
  if (units > partLimit) {
    warnings.push(`${path}: JSON part exceeds ${partLimit.toLocaleString('en')} ${typeof raw === 'string' ? 'characters' : 'bytes'}`);
    budget.refused = true;
    return undefined;
  }
  if (budget.units + units > BRAND_IMPORT_MAX_JSON_UNITS) {
    warnings.push(`${path}: project JSON exceeds the ${BRAND_IMPORT_MAX_JSON_UNITS.toLocaleString('en')} unit aggregate limit`);
    budget.refused = true;
    return undefined;
  }
  budget.units += units;
  try {
    const parsed: unknown = JSON.parse(asText(raw));
    const issue = structureIssue(parsed, budget.structure);
    if (issue) {
      warnings.push(`${path}: ${issue}`);
      budget.refused = true;
      return undefined;
    }
    return parsed;
  } catch (e) {
    warnings.push(`${path}: ${e instanceof Error ? e.message : 'unparseable JSON'}`);
    return undefined;
  }
}

function penpotEntryPaths(
  entries: Record<string, Uint8Array | string>, warnings: string[], budget: ParseBudget,
): string[] {
  try {
    const paths = Object.keys(entries);
    if (paths.length > BRAND_IMPORT_MAX_ENTRIES) {
      warnings.push(`project carries more than ${BRAND_IMPORT_MAX_ENTRIES.toLocaleString('en')} archive entries`);
      budget.refused = true;
      return [];
    }
    return paths;
  } catch {
    warnings.push('project entry list could not be inspected safely');
    budget.refused = true;
    return [];
  }
}

/**
 * Extract and merge every token document from an unzipped `.penpot` project
 * (container shape 3).
 *
 * @param entries archive path → bytes (fflate's `unzipSync` shape) or → string.
 *   The zip is inflated by the CALLER; this stays IO-free.
 *
 * `manifest.json` (`{type:'penpot/export-files', files:[{id,…}]}`) fixes which
 * token docs exist and their order: `files/<id>/tokens.json` per entry. A
 * missing/unparseable manifest is a warning, then we fall back to scanning for
 * any `files/*\/tokens.json` (sorted, for determinism).
 *
 * Merge rule when several files carry tokens: for each top-level set key, the
 * later file wins. Warn when a colliding set's body actually differs
 * (key-order-insensitive compare, so identical re-exports stay silent).
 * `$themes`/`$metadata` come from the FIRST doc that carries a MEANINGFUL one.
 * Themes name sets by key, so first-wins keeps them pointing at the doc that
 * defined those keys first. An empty block does not count as meaningful:
 * Penpot writes an empty `$themes: []` alongside real sets, and an empty
 * first block must not hide a later file's real themes. Conflicting
 * meaningful blocks produce a warning and the later one is dropped.
 */
export function extractPenpotProject(entries: Record<string, Uint8Array | string>): TokensExtraction {
  const warnings: string[] = [];
  const budget = newParseBudget();
  const entryPaths = penpotEntryPaths(entries, warnings, budget);
  if (budget.refused) return { doc: null, warnings, source: 'penpot-project' };

  // Resolve the ordered list of per-file token doc paths.
  let tokenPaths: string[] = [];
  const manifest = parseEntry(entries, 'manifest.json', warnings, budget);
  if (budget.refused) return { doc: null, warnings, source: 'penpot-project' };
  const manifestFiles = isRecord(manifest) && Array.isArray(manifest.files) ? manifest.files : null;
  if (manifestFiles) {
    if (manifestFiles.length > BRAND_IMPORT_MAX_ENTRIES) {
      warnings.push(`manifest carries more than ${BRAND_IMPORT_MAX_ENTRIES.toLocaleString('en')} file records`);
      return { doc: null, warnings, source: 'penpot-project' };
    }
    const seen = new Set<string>();
    for (const f of manifestFiles) {
      if (!isRecord(f) || typeof f.id !== 'string') continue;
      const p = `files/${f.id}/tokens.json`;
      if (p in entries && !seen.has(p)) {
        tokenPaths.push(p);
        seen.add(p);
      } else if (Array.isArray(f.features) && f.features.includes('design-tokens/v1')) {
        // Only noisy when the manifest *promised* tokens; files without the
        // feature routinely have no tokens.json and that is not a defect.
        warnings.push(`${p}: declared design-tokens/v1 but has no tokens.json`);
      }
    }
  } else {
    warnings.push(
      manifest === undefined
        ? 'manifest.json missing or unparseable - scanning for files/*/tokens.json'
        : 'manifest.json is not a penpot/export-files manifest - scanning for files/*/tokens.json',
    );
    tokenPaths = entryPaths
      .filter(p => /^files\/[^/]+\/tokens\.json$/.test(p))
      .sort();
  }
  if (tokenPaths.length > BRAND_IMPORT_MAX_TOKEN_DOCS) {
    warnings.push(`project carries more than ${BRAND_IMPORT_MAX_TOKEN_DOCS.toLocaleString('en')} token documents`);
    return { doc: null, warnings, source: 'penpot-project' };
  }

  // Merge the docs in order. Sets: last writer wins. $themes/$metadata: first wins.
  let doc: UnknownRecord | null = null;
  const setNames = new Set<string>();
  for (const path of tokenPaths) {
    const parsed = parseEntry(entries, path, warnings, budget);
    if (budget.refused) return { doc: null, warnings, source: 'penpot-project' };
    if (parsed === undefined) continue;
    if (!isRecord(parsed)) {
      warnings.push(`${path}: token document is not an object - ignored`);
      continue;
    }
    // Null-prototype (see assembleTokenSetFiles): a "__proto__" set key must
    // merge as an own key, never mutate the prototype.
    if (!doc) doc = Object.create(null) as UnknownRecord;
    for (const [key, value] of Object.entries(parsed)) {
      if (key === '$themes' || key === '$metadata') {
        // First MEANINGFUL block wins - an empty `$themes: []` / `$metadata: {}`
        // (Penpot writes these alongside real sets) counts as absent.
        const meaningful = (v: unknown) =>
          key === '$themes' ? Array.isArray(v) && v.length > 0 : isRecord(v) && Object.keys(v).length > 0;
        if (!meaningful(doc[key])) doc[key] = value;
        else if (meaningful(value) && stableStringify(doc[key]) !== stableStringify(value)) {
          warnings.push(`${path}: ${key} differs from an earlier file's - keeping the first`);
        }
        continue;
      }
      if (!setNames.has(key)) {
        if (setNames.size >= BRAND_IMPORT_MAX_TOKEN_SETS) {
          warnings.push(`project carries more than ${BRAND_IMPORT_MAX_TOKEN_SETS.toLocaleString('en')} distinct token sets`);
          return { doc: null, warnings, source: 'penpot-project' };
        }
        setNames.add(key);
      }
      if (Object.hasOwn(doc, key) && stableStringify(doc[key]) !== stableStringify(value)) {
        warnings.push(`${path}: set "${key}" collides with an earlier file's - later file wins`);
      }
      doc[key] = value;
    }
  }

  if (!doc) {
    warnings.push('no tokens.json found in the project');
    return { doc: null, warnings, source: 'penpot-project' };
  }
  return { doc, warnings, source: 'penpot-project' };
}

// ── Usage scan - a token-LESS Penpot project's paints, gradients and fonts ───
// The counterpart to extractPenpotProject. When a project declares no design
// tokens (the common case; see the ':declared design-tokens/v1 but has no
// tokens.json' warning above), the file's actual usage is the only brand
// signal available. scanPenpotUsage walks every page-shape JSON and tallies
// every paint source, so a shell can PROPOSE brand roles from what the
// designer really used. This is container walking only: it does no colour
// theory; role picking is shell policy.

/** One colour's tally across every paint source, #RRGGBB uppercase. */
export interface PenpotUsageColor {
  hex: string;
  /** Shape-level fill paints (`fills[].fillColor`). */
  fills: number;
  /** Shape-level stroke paints (`strokes[].strokeColor`). */
  strokes: number;
  /** Text-leaf fill paints inside `content` trees. */
  textRuns: number;
  /** Gradient stop occurrences (fill AND stroke gradients, per paint). */
  gradientStops: number;
  /** Sum of the four. */
  total: number;
}

/** One distinct gradient (deduped by type + stop signature) with its paint count. */
export interface PenpotUsageGradient {
  type: 'linear' | 'radial';
  stops: { color: string; offset: number; opacity: number }[];
  /** How many paints across the project use this exact gradient. */
  count: number;
  /**
   * Modal per-paint angle: `round(atan2(dx, -dy))` in CSS degrees computed on
   * the RAW endpoint fractions - deliberately aspect-IGNORANT, unlike
   * `penpotGradientToSpec`'s pixel-space angle, because no shape box exists at
   * census level and the modal over many differently-sized shapes only means
   * something in the shared fraction space. Ties break toward the smaller
   * angle. Always 0 for radial.
   */
  angle: number;
}

/** Everything scanPenpotUsage learns from a project's pages. */
export interface PenpotUsage {
  /** Sorted by total desc, then hex asc. */
  colors: PenpotUsageColor[];
  /** Sorted by count desc, then signature asc. */
  gradients: PenpotUsageGradient[];
  /** collectPenpotFontUsage aggregated across every text shape, `fontId` verbatim. */
  fonts: PenpotFontUsage[];
}

const HEX6_RE = /^#[0-9a-fA-F]{6}$/;
const normHex = (v: unknown): string | null => {
  const s = String(v ?? '').trim();
  return HEX6_RE.test(s) ? s.toUpperCase() : null;
};
const numOr = (v: unknown, d: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
// Shape/leaf keys arrive camelCase (binfile-v3), kebab, or keyworded (":key")
// depending on the exporter - same tolerance as design-map's internal reader.
const kebabOf = (k: string): string => k.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
function pv(o: unknown, camel: string): unknown {
  if (!isRecord(o)) return undefined;
  if (o[camel] !== undefined) return o[camel];
  const kb = kebabOf(camel);
  if (o[kb] !== undefined) return o[kb];
  if (o[`:${kb}`] !== undefined) return o[`:${kb}`];
  return undefined;
}

/**
 * Tally every paint source in an unzipped `.penpot` project: shape fills,
 * strokes, text-run leaf fills, gradient stops (from both `fillColorGradient`
 * and `strokeColorGradient`), distinct gradients, and font usage.
 *
 * @param entries archive path → bytes (fflate's `unzipSync` shape) or → string,
 *   exactly like `extractPenpotProject` - the caller inflates the zip.
 *
 * Page-shape paths come from the manifest's file ids
 * (`files/<id>/pages/<pid>/<sid>.json`); a missing/unusable manifest falls back
 * to scanning every matching path (sorted, for determinism). Colours normalise
 * through `/^#[0-9a-fA-F]{6}$/` to uppercase; anything else is dropped. HIDDEN
 * shapes are counted - the per-shape `hidden` flag is not consulted - so the
 * census matches a whole-file audit rather than one render of it. Never throws
 * on bad input; unusable entries are simply skipped.
 */
/**
 * The ordered page-shape entry paths of an unzipped `.penpot` project:
 * `files/<id>/pages/<pid>/<sid>.json`, file order from the manifest. A
 * missing/unusable manifest falls back to scanning every matching path
 * (sorted, for determinism).
 *
 * Shared by every page walker so two censuses of the same archive can never
 * disagree about which shapes exist.
 */
function penpotPagePaths(
  entries: Record<string, Uint8Array | string>, warnings: string[], budget: ParseBudget,
): string[] {
  const entryPaths = penpotEntryPaths(entries, warnings, budget);
  if (budget.refused) return [];
  const manifest = parseEntry(entries, 'manifest.json', warnings, budget);
  if (budget.refused) return [];
  const manifestFiles = isRecord(manifest) && Array.isArray(manifest.files) ? manifest.files : null;
  const pagePathRe = /^files\/([^/]+)\/pages\/[^/]+\/[^/]+\.json$/;
  const candidates: Array<{ path: string; fileId: string }> = [];
  for (const path of entryPaths) {
    const match = pagePathRe.exec(path);
    if (!match) continue;
    if (candidates.length >= BRAND_IMPORT_MAX_PAGE_PARTS) {
      warnings.push(`project carries more than ${BRAND_IMPORT_MAX_PAGE_PARTS.toLocaleString('en')} page-shape parts`);
      budget.refused = true;
      return [];
    }
    candidates.push({ path, fileId: match[1]! });
  }
  if (!manifestFiles) {
    return candidates.map((entry) => entry.path).sort();
  }
  if (manifestFiles.length > BRAND_IMPORT_MAX_ENTRIES) {
    warnings.push(`manifest carries more than ${BRAND_IMPORT_MAX_ENTRIES.toLocaleString('en')} file records`);
    budget.refused = true;
    return [];
  }
  // Preserve manifest file order and lexical path order without the previous
  // O(manifest files × archive entries) nested scan.
  const fileOrder = new Map<string, number>();
  for (const [index, file] of manifestFiles.entries()) {
    if (isRecord(file) && typeof file.id === 'string' && !fileOrder.has(file.id)) fileOrder.set(file.id, index);
  }
  return candidates
    .filter((entry) => fileOrder.has(entry.fileId))
    .sort((a, b) => (fileOrder.get(a.fileId)! - fileOrder.get(b.fileId)!) || a.path.localeCompare(b.path))
    .map((entry) => entry.path);
}

export function scanPenpotUsage(entries: Record<string, Uint8Array | string>): PenpotUsage {
  const warnings: string[] = []; // parseEntry's sink - a census has no warning channel
  const budget = newParseBudget();
  const pagePaths = penpotPagePaths(entries, warnings, budget);
  if (budget.refused) return { colors: [], gradients: [], fonts: [] };

  interface Tally { fills: number; strokes: number; textRuns: number; gradientStops: number }
  const colors = new Map<string, Tally>();
  const bump = (hex: string | null, key: keyof Tally): void => {
    if (!hex) return;
    let t = colors.get(hex);
    if (!t) { t = { fills: 0, strokes: 0, textRuns: 0, gradientStops: 0 }; colors.set(hex, t); }
    t[key]++;
  };

  interface GradVariant {
    type: 'linear' | 'radial';
    stops: { color: string; offset: number; opacity: number }[];
    count: number;
    angles: Map<number, number>;
  }
  const gradients = new Map<string, GradVariant>();

  const seeGradient = (g: unknown): void => {
    if (!isRecord(g)) return;
    const rawStops = Array.isArray(g.stops) ? g.stops : [];
    const stops: { color: string; offset: number; opacity: number }[] = [];
    let usable = rawStops.length >= 2;
    for (const raw of rawStops) {
      const st = isRecord(raw) ? raw : null;
      const color = normHex(st ? pv(st, 'color') : undefined);
      if (color) bump(color, 'gradientStops');
      if (!st || !color) { usable = false; continue; }
      stops.push({ color, offset: numOr(pv(st, 'offset'), 0), opacity: numOr(pv(st, 'opacity'), 1) });
    }
    if (!usable) return;
    const type: 'linear' | 'radial' = String(pv(g, 'type') ?? '') === 'radial' ? 'radial' : 'linear';
    const sig = `${type}|${stops.map(s => `${s.color}@${s.offset.toFixed(4)}/${s.opacity.toFixed(4)}`).join('|')}`;
    // Aspect-ignorant angle on the raw endpoint fractions (see PenpotUsageGradient).
    let angle = 0;
    if (type === 'linear') {
      const dx = numOr(pv(g, 'endX'), 1) - numOr(pv(g, 'startX'), 0);
      const dy = numOr(pv(g, 'endY'), 1) - numOr(pv(g, 'startY'), 0);
      angle = Math.round(((Math.atan2(dx, -dy) * 180 / Math.PI) + 360) % 360) % 360;
    }
    let v = gradients.get(sig);
    if (!v) { v = { type, stops, count: 0, angles: new Map() }; gradients.set(sig, v); }
    v.count++;
    v.angles.set(angle, (v.angles.get(angle) ?? 0) + 1);
  };

  const seePaints = (list: unknown, colorKey: 'fillColor' | 'strokeColor', gradKey: 'fillColorGradient' | 'strokeColorGradient', tally: 'fills' | 'strokes' | 'textRuns'): void => {
    if (!Array.isArray(list)) return;
    for (const p of list) {
      if (!isRecord(p)) continue;
      bump(normHex(pv(p, colorKey)), tally);
      seeGradient(pv(p, gradKey));
    }
  };

  const fonts = new Map<string, PenpotFontUsage>();

  const walkText = (n: unknown): void => {
    if (Array.isArray(n)) { for (const c of n) walkText(c); return; }
    if (!isRecord(n)) return;
    // A leaf carries `text` + `fills`; its fill paints are the text-run census.
    if (pv(n, 'text') !== undefined && Array.isArray(pv(n, 'fills'))) {
      seePaints(pv(n, 'fills'), 'fillColor', 'fillColorGradient', 'textRuns');
    }
    walkText(pv(n, 'children'));
  };

  for (const path of pagePaths) {
    const shape = parseEntry(entries, path, warnings, budget);
    if (budget.refused) return { colors: [], gradients: [], fonts: [] };
    if (!isRecord(shape)) continue;
    seePaints(pv(shape, 'fills'), 'fillColor', 'fillColorGradient', 'fills');
    seePaints(pv(shape, 'strokes'), 'strokeColor', 'strokeColorGradient', 'strokes');
    const content = pv(shape, 'content');
    if (String(pv(shape, 'type') ?? '') === 'text' && content != null) {
      walkText(content);
      for (const u of collectPenpotFontUsage(content)) {
        const key = `${u.fontId}|${u.fontVariantId}|${u.fontStyle}`;
        const cur = fonts.get(key);
        if (cur) cur.runs += u.runs;
        else fonts.set(key, { ...u });
      }
    }
  }

  const colorRows: PenpotUsageColor[] = [...colors.entries()]
    .map(([hex, t]) => ({ hex, ...t, total: t.fills + t.strokes + t.textRuns + t.gradientStops }))
    .sort((a, b) => (b.total - a.total) || (a.hex < b.hex ? -1 : a.hex > b.hex ? 1 : 0));

  const gradientRows: PenpotUsageGradient[] = [...gradients.entries()]
    .map(([sig, v]) => {
      // Modal angle; ties break toward the smaller angle.
      let angle = 0, best = -1;
      for (const [a, n] of v.angles) {
        if (n > best || (n === best && a < angle)) { angle = a; best = n; }
      }
      return { sig, row: { type: v.type, stops: v.stops, count: v.count, angle } };
    })
    .sort((a, b) => (b.row.count - a.row.count) || (a.sig < b.sig ? -1 : a.sig > b.sig ? 1 : 0))
    .map(e => e.row);

  return { colors: colorRows, gradients: gradientRows, fonts: [...fonts.values()] };
}

// ── Applied-token census - which DECLARED tokens the designer actually used ──
// The third walker over the same archive, and the one that makes a token-first
// import possible. extractPenpotProject says WHICH tokens a file declares,
// scanPenpotUsage says which raw colours it paints, and this walker says which
// declared token is attached to which kind of attribute, and how often. A
// shell can then propose brand roles from the designer's own names ("the
// token they put on the most fills is the surface") instead of guessing from
// hexes.
//
// Penpot writes the attachment on each shape as `appliedTokens`, a flat map of
// shape-attribute name → token name (`{"fill": "brand.primary", "r1": "rad.md"}`
// - dotted token paths joining straight to createTokenSet's flattened names).
// Attribute names arrive camelCase in binfile-v3; kebab and ":key" spellings
// are accepted for the same reason scanPenpotUsage's pv() accepts them.

/** One declared token's applied-attribute tally across a project's shapes. */
export interface PenpotAppliedToken {
  /** Token name exactly as the file wrote it - a dotted path into the doc. */
  name: string;
  /** `fill` on a non-text shape - the surface/primary signal. */
  fills: number;
  /** `strokeColor` and `shadow` - the secondary colour signal. */
  strokes: number;
  /** `fill` on a text shape - the text-role signal. Disjoint from `fills`. */
  text: number;
  /** `typography`, `fontFamily`, `fontSize`, `fontWeight`, … - the type signal. */
  type: number;
  /** Corner radii, padding/margin, row/column gap - the geometry signal. */
  geometry: number;
  /** Sum of the five. */
  total: number;
}

type AppliedClass = 'fills' | 'strokes' | 'text' | 'type' | 'geometry';

const TYPE_ATTRS = new Set([
  'typography', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
  'lineHeight', 'letterSpacing', 'textCase', 'textDecoration',
]);
const GEOMETRY_ATTRS = new Set(['rowGap', 'columnGap', 'spacing', 'width', 'height', 'x', 'y']);

/** Attribute name → which signal it feeds, or null when we don't model it. */
function appliedClassOf(attr: string, isText: boolean): AppliedClass | null {
  if (attr === 'fill') return isText ? 'text' : 'fills';
  if (attr === 'strokeColor' || attr === 'shadow') return 'strokes';
  if (TYPE_ATTRS.has(attr)) return 'type';
  if (GEOMETRY_ATTRS.has(attr)) return 'geometry';
  // r1..r4 (corner radii), p1..p4 (padding), m1..m4 (margin), plus the long
  // padding*/margin* spellings.
  if (/^[rpm][1-4]$/.test(attr)) return 'geometry';
  if (attr.startsWith('padding') || attr.startsWith('margin')) return 'geometry';
  return null;
}

// ":stroke-color" / "stroke-color" / "strokeColor" all name the same attribute.
function camelOf(k: string): string {
  return k.replace(/^:/, '').replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Tally every `appliedTokens` reference across an unzipped `.penpot` project's
 * page shapes.
 *
 * @param entries archive path → bytes (fflate's `unzipSync` shape) or → string,
 *   exactly like `extractPenpotProject` and `scanPenpotUsage` - the caller
 *   inflates the zip.
 *
 * Rows sort by total desc, then name asc. HIDDEN shapes are counted, the same
 * whole-file-audit stance as `scanPenpotUsage`. Attributes we don't model are
 * skipped (they never reach `total`), so a future Penpot attribute can only
 * under-count, never corrupt a row. Token names are file-controlled, so the
 * accumulator is a `Map` and never an object literal. Never throws: an archive
 * with no shapes, no manifest, or no applied tokens returns `[]`.
 */
export function scanPenpotAppliedTokens(entries: Record<string, Uint8Array | string>): PenpotAppliedToken[] {
  const warnings: string[] = [];
  const budget = newParseBudget();
  const rows = new Map<string, Omit<PenpotAppliedToken, 'name' | 'total'>>();

  const bump = (name: string, cls: AppliedClass): void => {
    let r = rows.get(name);
    if (!r) { r = { fills: 0, strokes: 0, text: 0, type: 0, geometry: 0 }; rows.set(name, r); }
    r[cls]++;
  };

  for (const path of penpotPagePaths(entries, warnings, budget)) {
    const shape = parseEntry(entries, path, warnings, budget);
    if (budget.refused) return [];
    if (!isRecord(shape)) continue;
    const applied = pv(shape, 'appliedTokens');
    if (!isRecord(applied)) continue;
    const isText = String(pv(shape, 'type') ?? '') === 'text';
    for (const [rawAttr, rawName] of Object.entries(applied)) {
      if (typeof rawName !== 'string' || !rawName) continue;
      const cls = appliedClassOf(camelOf(rawAttr), isText);
      if (cls) bump(rawName, cls);
    }
  }

  return [...rows.entries()]
    .map(([name, r]) => ({ name, ...r, total: r.fills + r.strokes + r.text + r.type + r.geometry }))
    .sort((a, b) => (b.total - a.total) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * Cheap import-preview stats for a reassembled document - what a shell shows
 * before the user commits ("14 sets · 4 themes · 391 tokens, 120 colours").
 *
 * `sets` lists top-level non-$ keys only when the doc is LAYERED - a non-empty
 * `$themes`, or the `$metadata.tokenSetOrder` a themeless Penpot export writes
 * (`tokenSetNames`, so this mirrors createTokenSet's set detection exactly);
 * a plain DTCG doc is one implicit set → `[]`. Counts come from
 * `createTokenSet(doc)` unthemed, so they reflect the default theme's active
 * layering, exactly what an import would resolve.
 */
export function summarizeTokensDoc(doc: unknown): {
  sets: string[];
  themes: { name: string; group: string | null }[];
  tokenCount: number;
  colorCount: number;
} {
  const sets = tokenSetNames(doc) ?? [];
  const ts = createTokenSet(doc);
  return { sets, themes: ts.themes(), tokenCount: ts.size, colorCount: ts.colors().length };
}
