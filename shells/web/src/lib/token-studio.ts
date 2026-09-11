// SPDX-License-Identifier: MPL-2.0
/**
 * Token studio - pure DTCG surgery for the brand's NON-colour primitives
 * (spacing, sizing, stroke widths, opacity, rotation, plain numbers, shadows)
 * plus gradient colour tokens. The non-swatch counterpart to brand-doc.ts:
 * everything here is a pure function over the raw tokens document so it can be
 * unit tested without a browser (token-studio.test.ts). Nothing in this module
 * imports the DOM, the bridge, or any component.
 *
 * Group scheme - each kind owns one top-level group (written under `base` when
 * the doc is layered, mirroring brand-doc's addSwatch):
 *
 *   spacing  → space.<slug>     $type dimension   $value CSS length ('8px', '0.5rem')
 *   sizing   → size.<slug>      $type dimension
 *   stroke   → stroke.<slug>    $type dimension
 *   opacity  → opacity.<slug>   $type number      $value 0–1 (clamped)
 *   rotation → rotation.<slug>  $type number      degrees, normalised to -360..360 (sign kept)
 *   number   → number.<slug>    $type number
 *   shadow   → shadow.<slug>    $type shadow      $value { color, offsetX, offsetY, blur, spread } strings
 *   gradient → gradient.<slug>  $type gradient    $value [{ color, position }…] stops (positions 0–1,
 *                                                 sorted) + optional $extensions[TOKEN_EXT].angle for CSS
 *
 * Leaves are classified by that group segment (set prefix stripped) - a leaf
 * under any other group (`color.*`, `font.*`, `asset.*`, `shape.radius`, …)
 * is simply not a studio token. `shape.radius` in particular stays on the
 * existing setBrandRadius path, and colour swatches stay brand-doc.ts's.
 */

import { colorToHex, isAlias, aliasPath, TOKEN_EXT } from '@lolly/engine';
import { isRec, leafAt, prettify } from './brand-doc.ts';

type Rec = Record<string, unknown>;

export type StudioKind = 'spacing' | 'sizing' | 'stroke' | 'opacity' | 'rotation' | 'number' | 'shadow' | 'gradient';

export interface GradientStop { color: string; position: number }

export interface StudioToken {
  /** JSON key path to the leaf group (the object holding `$value`). */
  path: string[];
  /** Canonical dotted token key, set prefix stripped (`space.gutter`). */
  key: string;
  kind: StudioKind;
  /** Label shown in editors ($description, else a prettified leaf key). */
  name: string;
  /** The stored `$value`, untouched. */
  raw: unknown;
  /** Gradient only: the CSS angle from `$extensions[TOKEN_EXT].angle`, when set. */
  angle?: number;
}

/** Top-level DTCG token sets a derived brand uses (mirrors brand-doc). */
const SET_KEYS = new Set(['base', 'light', 'dark']);

/** Each kind's group segment + the DTCG $type its group and leaves carry. */
const KIND_HOME: Record<StudioKind, { group: string; type: string }> = {
  spacing: { group: 'space', type: 'dimension' },
  sizing: { group: 'size', type: 'dimension' },
  stroke: { group: 'stroke', type: 'dimension' },
  opacity: { group: 'opacity', type: 'number' },
  rotation: { group: 'rotation', type: 'number' },
  number: { group: 'number', type: 'number' },
  shadow: { group: 'shadow', type: 'shadow' },
  gradient: { group: 'gradient', type: 'gradient' },
};

const GROUP_KIND = new Map<string, StudioKind>();
for (const k of Object.keys(KIND_HOME) as StudioKind[]) GROUP_KIND.set(KIND_HOME[k].group, k);

/** Every group segment the studio owns - the brand editor carries these across
 *  a palette re-derive (deriveBrandTokens only rebuilds colour; a fresh doc
 *  must not silently drop the user's spacing/shadows/gradients). */
export const STUDIO_GROUPS: readonly string[] = [...GROUP_KIND.keys()];

/** The kind the group segment at `path` claims, or null when unmanaged. */
function kindAt(path: string[]): StudioKind | null {
  const rest = SET_KEYS.has(path[0] ?? '') ? path.slice(1) : path;
  return rest.length >= 2 ? GROUP_KIND.get(rest[0] ?? '') ?? null : null;
}

// ── Per-kind value normalisation ─────────────────────────────────────────────
// Every write funnels through these: a value either normalises to the kind's
// canonical stored form or the write is refused - a studio token never holds a
// value its previews can't render.

/** Finite number from a number or numeric string, else undefined. */
function toNum(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v.trim()))) return Number(v.trim());
  return undefined;
}

const DIM_RE = /^([+-]?\d*\.?\d+)(px|rem|em|pt|pc|in|cm|mm|q|ch|ex|lh|vw|vh|vmin|vmax|%)$/i;

/** A CSS length string. Bare numbers (and numeric strings) become `px`. */
function normDimension(v: unknown): string | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return `${v}px`;
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  if (/^[+-]?\d*\.?\d+$/.test(s)) return `${Number(s)}px`;
  const m = DIM_RE.exec(s);
  return m ? `${Number(m[1])}${m[2]!.toLowerCase()}` : undefined;
}

/** 0–1, clamped. Accepts a percent string ('85%' → 0.85). */
function normOpacity(v: unknown): number | undefined {
  const pct = typeof v === 'string' && v.trim().endsWith('%');
  const n = toNum(pct ? (v as string).trim().slice(0, -1) : v);
  if (n === undefined) return undefined;
  return Math.min(1, Math.max(0, pct ? n / 100 : n));
}

/** Degrees, normalised to -360..360 - sign kept (never clamped positive), a
 *  full turn either way passes through, anything beyond wraps. */
function normRotation(v: unknown): number | undefined {
  const n = toNum(typeof v === 'string' ? v.trim().replace(/(?:deg|°)$/i, '') : v);
  if (n === undefined) return undefined;
  if (n === 360 || n === -360) return n;
  const r = n % 360;
  return r === 0 ? 0 : r; // never store -0
}

/** The DTCG shadow shape - all five fields stored as strings. */
interface ShadowValue { color: string; offsetX: string; offsetY: string; blur: string; spread: string }

/** Full-replacement shadow: colour must be readable (colorToHex), dimensions
 *  normalise like any studio length and default to '0px' when omitted. */
function normShadow(v: unknown): ShadowValue | undefined {
  if (!isRec(v)) return undefined;
  const color = typeof v.color === 'string' ? v.color.trim() : '';
  if (!color || colorToHex(color) == null) return undefined;
  const dim = (x: unknown): string | undefined => (x === undefined ? '0px' : normDimension(x));
  const offsetX = dim(v.offsetX), offsetY = dim(v.offsetY), blur = dim(v.blur), spread = dim(v.spread);
  if (offsetX === undefined || offsetY === undefined || blur === undefined || spread === undefined) return undefined;
  return { color, offsetX, offsetY, blur, spread };
}

/** Gradient stops: a colour is either a literal colorToHex can read OR a
 *  `{path}` alias into the palette (resolved at render time - resolveStopHex);
 *  anything else, or a non-numeric position, DROPS the stop. Survivors are
 *  clamped to 0–1 and sorted. The stored colour string stays as authored
 *  (oklch() and alias refs survive verbatim; hex is for CSS) - this is the one
 *  write gate every gradient edit funnels through, so an angle-only edit
 *  round-trips alias stops unchanged. */
function normStops(v: unknown): GradientStop[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const stops: GradientStop[] = [];
  for (const s of v) {
    if (!isRec(s) || typeof s.color !== 'string') continue;
    const color = s.color.trim();
    if (!color || (!isAlias(color) && colorToHex(color) == null)) continue;
    const p = toNum(s.position);
    if (p === undefined) continue;
    stops.push({ color, position: Math.min(1, Math.max(0, p)) });
  }
  stops.sort((a, b) => a.position - b.position);
  return stops.length ? stops : undefined;
}

/** A gradient write's value is EITHER a bare stop array OR `{ stops, angle? }` - 
 *  both accepted everywhere a gradient value is taken. The bare-array form (and
 *  an object without a numeric `angle`) leaves any stored angle untouched. */
function readGradientInput(v: unknown): { stops: GradientStop[]; angle: number | undefined } | undefined {
  const src = Array.isArray(v) ? v : isRec(v) && Array.isArray(v.stops) ? v.stops : undefined;
  const stops = src === undefined ? undefined : normStops(src);
  if (!stops) return undefined;
  const angle = Array.isArray(v) ? undefined : normRotation((v as Rec).angle);
  return { stops, angle };
}

// ── Vendor-extension angle (gradients) ───────────────────────────────────────

/** The gradient leaf's stored CSS angle, or null when unset. */
function readAngle(leaf: Rec): number | null {
  const ext = isRec(leaf.$extensions) ? (leaf.$extensions as Rec)[TOKEN_EXT] : null;
  return isRec(ext) && typeof ext.angle === 'number' && Number.isFinite(ext.angle) ? ext.angle : null;
}

/** Write the angle into the DTCG `$extensions` vendor namespace (TOKEN_EXT),
 *  creating the scaffolding when absent - same shape as the print locks. */
function writeAngle(leaf: Rec, angle: number): void {
  const ext = (isRec(leaf.$extensions) ? leaf.$extensions : (leaf.$extensions = {} as Rec)) as Rec;
  const ns = (isRec(ext[TOKEN_EXT]) ? ext[TOKEN_EXT] : (ext[TOKEN_EXT] = {} as Rec)) as Rec;
  ns.angle = angle;
}

// ── Read ─────────────────────────────────────────────────────────────────────

/**
 * Every studio-managed token in `doc`, in document order.
 *
 * A leaf qualifies when its group segment (first path segment after any
 * base/light/dark set prefix) is one of the studio homes AND its effective
 * DTCG $type (own or inherited, when present at all) agrees with that kind - 
 * so `color.*`, `font.*`, `asset.*` and `shape.radius` never surface here,
 * and neither does a mislabeled leaf squatting in a studio group.
 */
export function listStudioTokens(doc: unknown): StudioToken[] {
  const out: StudioToken[] = [];
  const walk = (node: unknown, path: string[], inherited: string | null): void => {
    if (!isRec(node)) return;
    const type = typeof node.$type === 'string' ? node.$type : inherited;
    if ('$value' in node) {
      const t = toToken(path, node, type);
      if (t) out.push(t);
      return;
    }
    for (const k of Object.keys(node)) {
      if (k.startsWith('$')) continue;
      walk(node[k], [...path, k], type);
    }
  };
  walk(doc, [], null);
  return out;
}

function toToken(path: string[], leaf: Rec, effType: string | null): StudioToken | null {
  const kind = kindAt(path);
  if (!kind) return null;
  if (effType && effType !== KIND_HOME[kind].type) return null;
  const rest = SET_KEYS.has(path[0] ?? '') ? path.slice(1) : path;
  const leafKey = path[path.length - 1] ?? '';
  const desc = leaf.$description;
  const t: StudioToken = {
    path,
    key: rest.join('.'),
    kind,
    name: typeof desc === 'string' && desc ? desc : prettify(leafKey),
    raw: leaf.$value,
  };
  if (kind === 'gradient') {
    const angle = readAngle(leaf);
    if (angle !== null) t.angle = angle;
  }
  return t;
}

// ── Write ────────────────────────────────────────────────────────────────────

/**
 * Add a token under its kind's group, creating the group (and `base`, on a
 * multi-set doc) when absent so the very first token has somewhere to live.
 * Slugs collide-safely. The value normalises per kind first - an unusable
 * value returns null without touching the doc. Returns the new leaf's JSON
 * path so the caller can select it.
 */
export function addStudioToken(doc: unknown, kind: StudioKind, name: string, value: unknown): string[] | null {
  if (!isRec(doc)) return null;
  let stored: unknown;
  let angle: number | undefined;
  if (kind === 'gradient') {
    const g = readGradientInput(value);
    if (!g) return null;
    stored = g.stops; angle = g.angle;
  } else {
    stored = normalizeScalar(kind, value);
    if (stored === undefined) return null;
  }
  const home = KIND_HOME[kind];
  const multiSet = [...SET_KEYS].some(k => k in doc);
  const base = multiSet
    ? (isRec(doc.base) ? doc.base : (doc.base = {} as Rec)) as Rec
    : doc;
  const group = (isRec(base[home.group]) ? base[home.group] : (base[home.group] = { $type: home.type } as Rec)) as Rec;
  if (!('$type' in group)) group.$type = home.type;

  const slugBase = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || kind;
  let slug = slugBase;
  for (let i = 2; slug in group; i++) slug = `${slugBase}-${i}`;
  const leaf: Rec = { $value: stored, $description: name.trim() || prettify(slug), $type: home.type };
  if (angle !== undefined) writeAngle(leaf, angle);
  group[slug] = leaf;
  return [...(multiSet ? ['base'] : []), home.group, slug];
}

/** The non-gradient kinds' shared normalise dispatch (undefined = refused). */
function normalizeScalar(kind: Exclude<StudioKind, 'gradient'>, value: unknown): unknown {
  switch (kind) {
    case 'spacing': case 'sizing': case 'stroke': return normDimension(value);
    case 'opacity': return normOpacity(value);
    case 'rotation': return normRotation(value);
    case 'number': return toNum(value);
    case 'shadow': return normShadow(value);
  }
}

/**
 * Replace the token at `path`'s `$value`, validated + normalised for the kind
 * its group claims (an unmanaged path, or a value that won't normalise, is a
 * refused write - `false`, doc untouched). Gradient values take either shape
 * `readGradientInput` accepts; a numeric `angle` in the object form also
 * updates `$extensions[TOKEN_EXT].angle`, otherwise the stored angle stays.
 */
export function setStudioTokenValue(doc: unknown, path: string[], value: unknown): boolean {
  const kind = kindAt(path);
  const leaf = leafAt(doc, path);
  if (!kind || !leaf || !('$value' in leaf)) return false;
  if (kind === 'gradient') {
    const g = readGradientInput(value);
    if (!g) return false;
    leaf.$value = g.stops;
    if (g.angle !== undefined) writeAngle(leaf, g.angle);
    return true;
  }
  const norm = normalizeScalar(kind, value);
  if (norm === undefined) return false;
  leaf.$value = norm;
  return true;
}

/** Rename a token (its `$description` - the label editors show); clearing it
 *  removes the key so the name falls back to the prettified leaf key. */
export function renameStudioToken(doc: unknown, path: string[], name: string): boolean {
  const leaf = leafAt(doc, path);
  if (!leaf || !('$value' in leaf)) return false;
  const t = name.trim();
  if (t) leaf.$description = t; else delete leaf.$description;
  return true;
}

/**
 * Remove a token, then prune now-empty ancestor groups (objects left holding
 * only $-metadata) along its path - including the emptied `base.<group>` - 
 * stopping short of the doc root and of a top-level set (`base` survives).
 */
export function deleteStudioToken(doc: unknown, path: string[]): boolean {
  const parent = leafAt(doc, path.slice(0, -1));
  const leaf = path[path.length - 1];
  if (!parent || leaf === undefined || !(leaf in parent)) return false;
  delete parent[leaf];
  for (let end = path.length - 1; end >= 1; end--) {
    const gPath = path.slice(0, end);
    if (gPath.length === 1 && SET_KEYS.has(gPath[0]!)) break;
    const g = leafAt(doc, gPath);
    if (!g || Object.keys(g).some(k => !k.startsWith('$'))) break;
    const gParent = leafAt(doc, gPath.slice(0, -1));
    if (!gParent) break;
    delete gParent[gPath[gPath.length - 1]!];
  }
  return true;
}

// ── Gradient alias integrity (write-time materialisation) ────────────────────
// Stops prefer `{path}` aliases into the palette so a recoloured swatch flows
// into every gradient - but a swatch DELETE, or a re-derive that rebuilds the
// ramps, can orphan those refs, and an exported brand pack must never carry a
// dangling alias. These run at the write chokepoints (brand-editor's swatch
// delete / re-derive apply) to pin affected stops to their last-resolved hex;
// gradientCss's render-time dropping stays only a last-resort guard.

/** How many gradient stops alias the token at dotted path `key`. */
export function gradientAliasRefCount(doc: unknown, key: string): number {
  let n = 0;
  for (const t of listStudioTokens(doc)) {
    if (t.kind !== 'gradient' || !Array.isArray(t.raw)) continue;
    for (const s of t.raw) if (isRec(s) && aliasPath(s.color) === key) n++;
  }
  return n;
}

/**
 * Rewrite alias stop colours to concrete values: every alias `shouldPin`
 * approves is replaced by `resolveTo(ref)`'s answer (a null or unreadable
 * answer leaves the stop alone - the render guard still covers it). Returns
 * how many stops were pinned.
 */
export function materializeGradientAliases(
  doc: unknown,
  shouldPin: (ref: string) => boolean,
  resolveTo: (ref: string) => string | null,
): number {
  let n = 0;
  for (const t of listStudioTokens(doc)) {
    if (t.kind !== 'gradient' || !Array.isArray(t.raw)) continue;
    let changed = false;
    const next = (t.raw as unknown[]).map((s) => {
      if (!isRec(s) || typeof s.color !== 'string' || !isAlias(s.color) || !shouldPin(s.color)) return s;
      const hex = resolveTo(s.color);
      if (!hex || colorToHex(hex) == null) return s;
      changed = true; n++;
      return { ...s, color: hex };
    });
    if (changed) setStudioTokenValue(doc, t.path, next);
  }
  return n;
}

// ── Presentation helpers ─────────────────────────────────────────────────────

/** A sensible neutral seed value for a freshly added token of `kind`. */
export function defaultValueFor(kind: StudioKind): unknown {
  switch (kind) {
    case 'spacing': return '16px';
    case 'sizing': return '48px';
    case 'stroke': return '2px';
    case 'opacity': return 0.8;
    case 'rotation': return 0;
    case 'number': return 1;
    case 'shadow': return { color: '#00000040', offsetX: '0px', offsetY: '2px', blur: '8px', spread: '0px' };
    case 'gradient': return {
      stops: [{ color: '#808080', position: 0 }, { color: '#80808000', position: 1 }],
      angle: 135,
    };
  }
}

/** Trim float noise for display + CSS ('0.30000000000000004' → '0.3'). */
const fmtNum = (n: number): string => String(Math.round(n * 100) / 100);

/**
 * A stop's concrete CSS colour: a `{path}` alias goes through `resolve` (no
 * resolver, or one that can't answer → null), a literal through colorToHex.
 * EITHER WAY the output re-validates via colorToHex before it may reach a
 * style attribute - the resolver is caller-supplied and the doc is untrusted,
 * so junk/non-string answers must die here, not render.
 */
export function resolveStopHex(stop: GradientStop, resolve?: (ref: string) => unknown): string | null {
  if (isAlias(stop.color)) {
    if (!resolve) return null;
    try { return colorToHex(resolve(stop.color)) ?? null; } catch { return null; }
  }
  return colorToHex(stop.color) ?? null;
}

export interface GradientCssOptions {
  /** Answers `{path}` alias stop colours (a TokenSet.resolve or equivalent). */
  resolve?: (ref: string) => unknown;
  /** 'oklch' emits `linear-gradient(<angle>deg in oklch, …)` - perceptual
   *  interpolation between the stops. Default 'srgb' (the plain form). */
  space?: 'srgb' | 'oklch';
}

/**
 * A gradient token's stops as a CSS `linear-gradient(<angle>deg, …)`. Safe by
 * construction: every stop colour passes through colorToHex (token values come
 * from untrusted imported documents and this lands in inline styles), invalid
 * stops drop - an alias stop the resolver can't answer drops too, the render-
 * time last resort behind the write-time materialisation - and no renderable
 * stops at all → ''. Accepts the raw `$value` stop array or the
 * `{ stops, angle }` object; an explicit `angle` argument wins over an
 * embedded one, and the CSS default (180 = to bottom) fills in last. A single
 * surviving stop renders flat (duplicated to keep the CSS valid).
 */
export function gradientCss(value: unknown, angle?: number, opts: GradientCssOptions = {}): string {
  const src = Array.isArray(value) ? value : isRec(value) && Array.isArray(value.stops) ? value.stops : undefined;
  const stops = src === undefined ? undefined : normStops(src);
  if (!stops) return '';
  const a = angle ?? (isRec(value) ? toNum(value.angle) : undefined) ?? 180;
  const parts: Array<{ hex: string; pos: number }> = [];
  for (const s of stops) {
    const hex = resolveStopHex(s, opts.resolve);
    if (hex != null) parts.push({ hex, pos: s.position });
  }
  if (!parts.length) return '';
  if (parts.length === 1) parts.push({ hex: parts[0]!.hex, pos: 1 });
  const space = opts.space === 'oklch' ? ' in oklch' : '';
  return `linear-gradient(${fmtNum(a)}deg${space}, ${parts.map(p => `${p.hex} ${fmtNum(p.pos * 100)}%`).join(', ')})`;
}

/** '0px'/'0.0rem'/'0' compress to '0' for the shorthand shadow display. */
const zeroless = (v: unknown): string => {
  const s = typeof v === 'number' ? `${v}px` : typeof v === 'string' ? v.trim() : v === undefined ? '0' : String(v);
  return /^[+-]?0(?:\.0+)?(?:[a-z%]+)?$/i.test(s) ? '0' : s;
};

/** Short display string for a studio token's value ('8px', '0.8', '45°',
 *  shadows as CSS-ish shorthand '0 2px 8px', gradients as '135° · 2 stops'). */
export function formatStudioValue(t: StudioToken): string {
  switch (t.kind) {
    case 'spacing': case 'sizing': case 'stroke':
      return typeof t.raw === 'number' ? `${t.raw}px` : String(t.raw ?? '');
    case 'opacity': case 'number': {
      const n = toNum(t.raw);
      return n === undefined ? String(t.raw ?? '') : fmtNum(n);
    }
    case 'rotation': {
      const n = toNum(t.raw);
      return n === undefined ? String(t.raw ?? '') : `${fmtNum(n)}°`;
    }
    case 'shadow': {
      // Callers inject this straight into a style="box-shadow:…" attribute, and
      // an IMPORTED doc's shadow never passed normShadow - so every field must
      // re-validate as a plain length here or the whole readout is refused
      // ('0px; position:fixed' must not ride a display string into live CSS).
      if (!isRec(t.raw)) return '';
      const dims = [t.raw.offsetX, t.raw.offsetY, t.raw.blur, t.raw.spread].map(normDimension);
      if (dims.some(d => d === undefined)) return '';
      const bits = [zeroless(dims[0]), zeroless(dims[1]), zeroless(dims[2])];
      const spread = zeroless(dims[3]);
      if (spread !== '0') bits.push(spread);
      return bits.join(' ');
    }
    case 'gradient': {
      const n = Array.isArray(t.raw) ? t.raw.length : 0;
      return `${fmtNum(t.angle ?? 180)}° · ${n} stop${n === 1 ? '' : 's'}`;
    }
  }
}
