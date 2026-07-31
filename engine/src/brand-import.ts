// SPDX-License-Identifier: MPL-2.0
/**
 * Brand token ingestion — container extraction for the three shapes Penpot
 * (and Tokens Studio) export the SAME token document in:
 *
 *   1. Monolithic `tokens.json` — the whole Tokens-Studio/DTCG doc in one file
 *      (`coerceTokensDoc`).
 *   2. One-file-per-set — `$metadata.json` + `$themes.json` at the root, every
 *      other `<set name>.json` where a `/` in the set name is a real
 *      subdirectory (`Color theme/Muted` → `Color theme/Muted.json`), file
 *      content = the unwrapped set body (`assembleTokenSetFiles`).
 *   3. A `.penpot` project zip — `manifest.json` lists files, each file's token
 *      doc (shape 1) lives at `files/<id>/tokens.json` (`extractPenpotProject`).
 *
 * Each helper reassembles its container back into the single document shape
 * `tokens.ts` `createTokenSet` already consumes (top-level sets + `$themes` +
 * `$metadata.tokenSetOrder`, `{dotted.path}` aliases, `$type` inheritance) —
 * this module owns *containers only*, never token semantics.
 *
 * PURE and platform-agnostic like the rest of the engine: no node:fs/node:path,
 * no DOM, no network. All IO stays in the caller — `assembleTokenSetFiles`
 * takes already-parsed JSON and `extractPenpotProject` takes already-unzipped
 * path→bytes entries (fflate's `unzipSync` shape), mirroring how design-map.ts
 * takes pre-parsed design JSON. Extraction never throws on bad input; problems
 * accumulate in `warnings` and the worst case is `doc: null`.
 *
 * Deliberate v1 non-goals:
 *   - No math-expression evaluation: a Tokens-Studio value like
 *     `"{scale.base}*1.5"` passes through untouched (it is not a whole-value
 *     alias, so createTokenSet keeps it verbatim).
 *   - No plural→canonical `$type` remapping (`colors`→`color` etc.);
 *     createTokenSet consumes the doc as-is and `.colors()` only needs
 *     resolvable `color` tokens.
 *   - No zip inflation — the shell/script that has the archive inflates it.
 */

import { createTokenSet, tokenSetNames } from './tokens.ts';
import { collectPenpotFontUsage } from './design-map.ts';
import type { PenpotFontUsage } from './design-map.ts';

type UnknownRecord = Record<string, unknown>;
const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** The result of pulling a token document out of one of the three containers. */
export interface TokensExtraction {
  /** Reassembled Tokens-Studio/DTCG document, or null when nothing usable was found. */
  doc: Record<string, unknown> | null;
  /** Per-entry parse failures, set collisions, missing tokens.json, … — never fatal. */
  warnings: string[];
  /** Which container shape produced the document. */
  source: 'dtcg' | 'tokens-studio' | 'token-set-files' | 'penpot-project';
}

// Key-order-insensitive equality for "same set exported twice?" checks — JSON
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
  return { doc: json, warnings: [], source: studio ? 'tokens-studio' : 'dtcg' };
}

/**
 * Reassemble a one-file-per-set export (container shape 2) into one document.
 *
 * @param files POSIX relative path → already-parsed JSON (caller does the IO).
 *   `$metadata.json` / `$themes.json` (root only) become `$metadata` / `$themes`;
 *   every other `*.json` becomes the set named by its path minus `.json` —
 *   subdirectories are part of the set name (`Color theme/Muted.json` → set
 *   `Color theme/Muted`). Non-.json keys and malformed bodies are skipped with
 *   a warning. Set ordering is irrelevant here: layering order comes from
 *   `$metadata.tokenSetOrder`, not object key order.
 */
export function assembleTokenSetFiles(files: Record<string, unknown>): TokensExtraction {
  const warnings: string[] = [];
  // Null-prototype accumulator: a set legitimately named "__proto__" (its file
  // is attacker-/user-controlled) must become an own key, not a prototype swap.
  const doc: UnknownRecord = Object.create(null);
  let setCount = 0;
  for (const [path, body] of Object.entries(files)) {
    if (path === '$metadata.json') {
      if (isRecord(body)) doc.$metadata = body;
      else warnings.push(`$metadata.json is not an object — ignored`);
      continue;
    }
    if (path === '$themes.json') {
      if (Array.isArray(body)) doc.$themes = body;
      else warnings.push(`$themes.json is not an array — ignored`);
      continue;
    }
    if (!path.endsWith('.json')) {
      warnings.push(`${path}: not a .json file — ignored`);
      continue;
    }
    if (!isRecord(body)) {
      warnings.push(`${path}: set body is not an object — ignored`);
      continue;
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

function parseEntry(entries: Record<string, Uint8Array | string>, path: string, warnings: string[]): unknown {
  const raw = entries[path];
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(asText(raw));
  } catch (e) {
    warnings.push(`${path}: ${e instanceof Error ? e.message : 'unparseable JSON'}`);
    return undefined;
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
 * Merge semantics when several files carry tokens: later file wins per
 * top-level set key, with a warning when a colliding set's body actually
 * differs (key-order-insensitive compare — identical re-exports stay silent).
 * `$themes`/`$metadata` come from the FIRST doc carrying a MEANINGFUL one —
 * themes name sets by key, and first-wins keeps them pointing at the doc that
 * defined those keys first. Presence isn't usefulness: Penpot writes an empty
 * `$themes: []` alongside real sets, and an empty first block must not shadow
 * a later file's real themes. Conflicting meaningful blocks warn (dropped).
 */
export function extractPenpotProject(entries: Record<string, Uint8Array | string>): TokensExtraction {
  const warnings: string[] = [];

  // Resolve the ordered list of per-file token doc paths.
  let tokenPaths: string[] = [];
  const manifest = parseEntry(entries, 'manifest.json', warnings);
  const manifestFiles = isRecord(manifest) && Array.isArray(manifest.files) ? manifest.files : null;
  if (manifestFiles) {
    for (const f of manifestFiles) {
      if (!isRecord(f) || typeof f.id !== 'string') continue;
      const p = `files/${f.id}/tokens.json`;
      if (p in entries) {
        tokenPaths.push(p);
      } else if (Array.isArray(f.features) && f.features.includes('design-tokens/v1')) {
        // Only noisy when the manifest *promised* tokens; files without the
        // feature routinely have no tokens.json and that is not a defect.
        warnings.push(`${p}: declared design-tokens/v1 but has no tokens.json`);
      }
    }
  } else {
    warnings.push(
      manifest === undefined
        ? 'manifest.json missing or unparseable — scanning for files/*/tokens.json'
        : 'manifest.json is not a penpot/export-files manifest — scanning for files/*/tokens.json',
    );
    tokenPaths = Object.keys(entries)
      .filter(p => /^files\/[^/]+\/tokens\.json$/.test(p))
      .sort();
  }

  // Merge the docs in order. Sets: last writer wins. $themes/$metadata: first wins.
  let doc: UnknownRecord | null = null;
  for (const path of tokenPaths) {
    const parsed = parseEntry(entries, path, warnings);
    if (parsed === undefined) continue;
    if (!isRecord(parsed)) {
      warnings.push(`${path}: token document is not an object — ignored`);
      continue;
    }
    if (!doc) {
      // Null-prototype (see assembleTokenSetFiles): a "__proto__" set key from
      // a later file must merge as an own key, never mutate the prototype.
      doc = Object.assign(Object.create(null) as UnknownRecord, parsed);
      continue;
    }
    for (const [key, value] of Object.entries(parsed)) {
      if (key === '$themes' || key === '$metadata') {
        // First MEANINGFUL block wins — an empty `$themes: []` / `$metadata: {}`
        // (Penpot writes these alongside real sets) counts as absent.
        const meaningful = (v: unknown) =>
          key === '$themes' ? Array.isArray(v) && v.length > 0 : isRecord(v) && Object.keys(v).length > 0;
        if (!meaningful(doc[key])) doc[key] = value;
        else if (meaningful(value) && stableStringify(doc[key]) !== stableStringify(value)) {
          warnings.push(`${path}: ${key} differs from an earlier file's — keeping the first`);
        }
        continue;
      }
      if (Object.hasOwn(doc, key) && stableStringify(doc[key]) !== stableStringify(value)) {
        warnings.push(`${path}: set "${key}" collides with an earlier file's — later file wins`);
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

// ── Usage scan — a token-LESS Penpot project's paints, gradients and fonts ───
// The dual of extractPenpotProject: when a project declares no design tokens
// (the common case — see the ':declared design-tokens/v1 but has no tokens.json'
// warning above), the file's actual usage is the only brand signal there is.
// scanPenpotUsage walks every page-shape JSON and tallies every paint source so
// a shell can PROPOSE brand roles from what the designer really used. Container
// walking only, still: no colour theory here — role picking is shell policy.

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
   * the RAW endpoint fractions — deliberately aspect-IGNORANT, unlike
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
// depending on the exporter — same tolerance as design-map's internal reader.
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
 *   exactly like `extractPenpotProject` — the caller inflates the zip.
 *
 * Page-shape paths come from the manifest's file ids
 * (`files/<id>/pages/<pid>/<sid>.json`); a missing/unusable manifest falls back
 * to scanning every matching path (sorted, for determinism). Colours normalise
 * through `/^#[0-9a-fA-F]{6}$/` to uppercase; anything else is dropped. HIDDEN
 * shapes are counted — the per-shape `hidden` flag is not consulted — so the
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
function penpotPagePaths(entries: Record<string, Uint8Array | string>): string[] {
  const warnings: string[] = []; // parseEntry's sink — a census has no warning channel
  const pageShapeRe = /^[^/]+\/[^/]+\.json$/;
  const manifest = parseEntry(entries, 'manifest.json', warnings);
  const manifestFiles = isRecord(manifest) && Array.isArray(manifest.files) ? manifest.files : null;
  if (!manifestFiles) {
    return Object.keys(entries)
      .filter(p => /^files\/[^/]+\/pages\/[^/]+\/[^/]+\.json$/.test(p))
      .sort();
  }
  const pagePaths: string[] = [];
  const sortedKeys = Object.keys(entries).sort();
  for (const f of manifestFiles) {
    if (!isRecord(f) || typeof f.id !== 'string') continue;
    const prefix = `files/${f.id}/pages/`;
    for (const p of sortedKeys) {
      if (p.startsWith(prefix) && pageShapeRe.test(p.slice(prefix.length))) pagePaths.push(p);
    }
  }
  return pagePaths;
}

export function scanPenpotUsage(entries: Record<string, Uint8Array | string>): PenpotUsage {
  const warnings: string[] = []; // parseEntry's sink — a census has no warning channel
  const pagePaths = penpotPagePaths(entries);

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
    const shape = parseEntry(entries, path, warnings);
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

// ── Applied-token census — which DECLARED tokens the designer actually used ──
// The third walker over the same archive, and the one that makes a token-first
// import possible: extractPenpotProject says WHICH tokens a file declares,
// scanPenpotUsage says which raw colours it paints, and this says which
// declared token is attached to which kind of attribute, how often. A shell can
// then propose brand roles from the designer's own names ("the token they put
// on the most fills is the surface") instead of guessing from hexes.
//
// Penpot writes the attachment on each shape as `appliedTokens`, a flat map of
// shape-attribute name → token name (`{"fill": "brand.primary", "r1": "rad.md"}`
// — dotted token paths joining straight to createTokenSet's flattened names).
// Attribute names arrive camelCase in binfile-v3; kebab and ":key" spellings
// are accepted for the same reason scanPenpotUsage's pv() accepts them.

/** One declared token's applied-attribute tally across a project's shapes. */
export interface PenpotAppliedToken {
  /** Token name exactly as the file wrote it — a dotted path into the doc. */
  name: string;
  /** `fill` on a non-text shape — the surface/primary signal. */
  fills: number;
  /** `strokeColor` and `shadow` — the secondary colour signal. */
  strokes: number;
  /** `fill` on a text shape — the text-role signal. Disjoint from `fills`. */
  text: number;
  /** `typography`, `fontFamily`, `fontSize`, `fontWeight`, … — the type signal. */
  type: number;
  /** Corner radii, padding/margin, row/column gap — the geometry signal. */
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
 *   exactly like `extractPenpotProject` and `scanPenpotUsage` — the caller
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
  const rows = new Map<string, Omit<PenpotAppliedToken, 'name' | 'total'>>();

  const bump = (name: string, cls: AppliedClass): void => {
    let r = rows.get(name);
    if (!r) { r = { fills: 0, strokes: 0, text: 0, type: 0, geometry: 0 }; rows.set(name, r); }
    r[cls]++;
  };

  for (const path of penpotPagePaths(entries)) {
    const shape = parseEntry(entries, path, warnings);
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
 * Cheap import-preview stats for a reassembled document — what a shell shows
 * before the user commits ("14 sets · 4 themes · 391 tokens, 120 colours").
 *
 * `sets` lists top-level non-$ keys only when the doc is LAYERED — a non-empty
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
