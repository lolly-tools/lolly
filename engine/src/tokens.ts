// SPDX-License-Identifier: MPL-2.0
/**
 * Design tokens — a platform-agnostic DTCG model.
 *
 * This is the engine's single source of truth for *token semantics*, the way
 * inputs.js owns input semantics and units.js owns physical units. It parses a
 * W3C Design Tokens (DTCG) document — the format Penpot imports/exports — and
 * resolves it into a flat lookup that shells and tools consume. It knows DTCG and
 * nothing else: no DOM, no storage, no SUSE. The brand *content* (the actual
 * token values) lives in the catalog as a `tokens` asset; this is only the engine
 * that interprets it.
 *
 * What it understands (the subset Penpot/Tokens-Studio interop needs):
 *   - `$value` / `$type` / `$description` / `$extensions` on tokens.
 *   - Groups (objects without `$value`) with `$type` inherited by descendants.
 *   - `{dotted.path}` aliases between tokens, including chains (cycle-safe).
 *   - `$themes` + `$metadata.tokenSetOrder`: top-level keys are *sets*, a theme
 *     selects + orders sets, later sets override earlier (Tokens-Studio layering).
 *     A document with no `$themes` is treated as one implicit set (paths keep
 *     their `color.brand.x` shape; there is no set prefix).
 *
 * Colour values: read every form Penpot can emit (hex, rgb/rgba, hsl/hsla,
 * oklch/lch — the lolly-start brand-token format — and the DTCG colour
 * *object*), normalise to a hex string for the rest of the app (which already
 * speaks `#rrggbb` / `#rrggbbaa` / `transparent`). CMYK print anchors ride in
 * `$extensions` under the SUSE vendor key — DTCG reserves `$extensions` for
 * exactly this, and Penpot round-trips it untouched.
 */

import type { TokenSet, TokenEntry, ColorSwatch, SpotColor } from './bridge/host-v1.ts';
import { parseOklch, oklchToHex } from './brand-derive.ts';
import { parseColor, colorToHexString } from './css-color.ts';
import { readFaces } from './color-faces.ts';

// Vendor extension namespace for Lolly-specific token metadata (CMYK anchors,
// swatch grouping hints). Reverse-domain per the DTCG `$extensions` convention.
export const TOKEN_EXT = 'com.suse.lolly';

const ALIAS_RE = /^\{([^{}]+)\}$/;

// A DTCG document arrives as untrusted JSON; everything is narrowed on read.
type UnknownRecord = Record<string, unknown>;
const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const isNumberArray = (v: unknown): v is number[] =>
  Array.isArray(v) && v.every(n => typeof n === 'number');
const isSpotColor = (v: unknown): v is SpotColor => {
  if (!isRecord(v) || typeof v.name !== 'string') return false;
  return v.book === undefined || typeof v.book === 'string';
};
/**
 * A spot lock read off `$extensions`, or null when there isn't a usable one.
 *
 * `finish` is validated as a PLAIN STRING, never against `FinishKind`'s members:
 * the union is deliberately open (a brand declares its own finishes on its own
 * tokens), so a finish this build has never heard of must degrade to "a process
 * I can't render" rather than invalidate the ink.
 *
 * A `finish` that is not a string at all (a number, an object, a null out of a
 * hand-edited doc) drops JUST THAT FIELD — total-function tolerance, the same
 * way every other reader in this file degrades: rejecting the whole spot would
 * also lose `name`, the one field every consumer, including the PDF
 * /Separation emitter, actually needs. The ordinary paths (no finish, or a
 * string one) return the stored object BY REFERENCE exactly as before, so any
 * other extension a brand carries on its spot object still passes through
 * untouched.
 */
const readSpotColor = (v: unknown): SpotColor | null => {
  if (!isSpotColor(v)) return null;
  if (v.finish === undefined || typeof v.finish === 'string') return v;
  const { finish: _malformed, ...rest } = v as SpotColor & UnknownRecord;
  return rest as SpotColor;
};

/**
 * A token-backed input value: a reference plus the value it last resolved to.
 * The reference keeps the value canonical (a token edit propagates everywhere);
 * the cached `value` is the graceful fallback when the token is gone on this
 * device.
 */
export interface TokenValue {
  ref: string;
  value?: unknown;
}

/** A whole-value DTCG alias string like `"{color.brand.jungle}"`. */
export type AliasRef = `{${string}}`;

/** True when `v` is a whole-value DTCG alias string like `"{color.brand.jungle}"`. */
export function isAlias(v: unknown): v is AliasRef {
  return typeof v === 'string' && ALIAS_RE.test(v.trim());
}

/** The dotted path inside an alias string, or null if `v` isn't an alias. */
export function aliasPath(v: unknown): string | null {
  const m = ALIAS_RE.exec(String(v).trim());
  return m ? (m[1] ?? null) : null;
}

/** True when `v` is a token-backed input value (see {@link TokenValue}). */
export function isTokenValue(v: unknown): v is TokenValue {
  return isRecord(v) && typeof v.ref === 'string';
}

// ─── Document → flat resolved map ─────────────────────────────────────────────

// The in-progress entry: a TokenEntry plus a transient alias-resolution marker.
type MutableEntry = TokenEntry & { _done?: boolean };

// Walk a group tree, emitting one entry per token (an object with `$value`),
// carrying the nearest declared `$type` down to its descendants.
function flattenGroup(
  node: unknown,
  inheritedType: string | null,
  prefix: string,
  out: Map<string, MutableEntry>,
): void {
  if (!isRecord(node)) return;
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$')) continue; // group-level metadata ($type/$description/…)
    if (!isRecord(child)) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if ('$value' in child) {
      out.set(path, {
        path,
        type: strOrNull(child.$type) ?? inheritedType,
        value: child.$value,
        description: strOrNull(child.$description),
        extensions: isRecord(child.$extensions) ? child.$extensions : null,
      });
    } else {
      flattenGroup(child, strOrNull(child.$type) ?? inheritedType, path, out);
    }
  }
}

// The theme entries to COMPOSE for `theme`. Tokens-Studio themes can be grouped into
// independent AXES via a `group` field (e.g. "mode", "brand", "density"); a single theme
// entry only enables its OWN axis's sets, so composing just one leaves cross-axis aliases
// ({alias} into a set another axis enables) dangling. Selection precedence:
//   1. an explicit `theme` wins for its own group; the DEFAULT (first) theme fills each
//      OTHER group, so the named theme's cross-axis aliases still resolve;
//   2. else `$metadata.activeThemes` (Tokens-Studio's "active theme per axis"), if present;
//   3. else one theme per group (the first of each).
// A single-theme or single-axis (one `group`) doc composes exactly one theme — the first,
// unless `activeThemes` names one of them, which is the designer's own ON state and the
// reason Penpot writes the field at all.
function chosenThemes(themes: UnknownRecord[], meta: UnknownRecord, theme: string | undefined): UnknownRecord[] {
  if (themes.length <= 1) return themes;
  const groupOf = (t: UnknownRecord): string => (typeof t.group === 'string' ? t.group : '');
  const byGroup = new Map<string, UnknownRecord[]>();
  for (const t of themes) { const g = groupOf(t); const list = byGroup.get(g); if (list) list.push(t); else byGroup.set(g, [t]); }
  const activeNames = Array.isArray(meta.activeThemes)
    ? meta.activeThemes.filter((x): x is string => typeof x === 'string') : [];
  // A grouped theme can be named in activeThemes as "group/name" as well as bare.
  const isActive = (t: UnknownRecord): boolean => {
    const g = groupOf(t);
    for (const key of ['name', 'id'] as const) {
      const v = t[key];
      if (typeof v !== 'string') continue;
      if (activeNames.includes(v)) return true;
      if (g && activeNames.includes(`${g}/${v}`)) return true;
    }
    return false;
  };
  if (byGroup.size <= 1) {
    if (theme) return [themes.find(t => t.name === theme || t.id === theme) ?? themes[0]!];
    // No explicit theme: honour the doc's own active theme before falling back
    // to "the first one wins". Only bites docs that carry activeThemes.
    if (activeNames.length) {
      const active = themes.find(isActive);
      if (active) return [active];
    }
    return [themes[0]!];
  }

  const requested = theme ? themes.find(t => t.name === theme || t.id === theme) : undefined;
  if (requested) {
    const rg = groupOf(requested);
    const out = [requested];
    for (const [g, list] of byGroup) if (g !== rg && list[0]) out.push(list[0]);
    return out;
  }
  if (activeNames.length) {
    const active = themes.filter(isActive);
    if (active.length) return active;
  }
  const out: UnknownRecord[] = [];
  for (const [, list] of byGroup) if (list[0]) out.push(list[0]);
  return out.length ? out : [themes[0]!];
}

/**
 * The top-level keys of `doc` that are token SETS, or `null` when the document
 * is one implicit set (a plain DTCG file, whose top-level keys are groups and
 * therefore part of every token's path).
 *
 * Two signals mark a layered (Tokens-Studio shaped) document, and either is
 * enough:
 *   - a non-empty `$themes` array, or
 *   - a non-empty `$metadata.tokenSetOrder` naming top-level objects.
 *
 * The second is not a nicety. A real Penpot export (2.17.1, `design-tokens/v1`)
 * of a file whose designer never created a theme writes exactly:
 *   `{ "Global": {…}, "$themes": [], "$metadata": { "tokenSetOrder": ["Global"],
 *      "activeThemes": [], "activeSets": ["Global"] } }`
 * — an EMPTY `$themes` beside a real set. Reading `$themes` alone made "Global"
 * a group, so `brand.primary` flattened to `Global.brand.primary` and no longer
 * joined to the `appliedTokens: {"fill": "brand.primary"}` Penpot writes on the
 * shapes, silently dropping the token-first role proposal back to hex guessing.
 * `tokenSetOrder` is a Tokens-Studio/Penpot key with no DTCG meaning, and every
 * entry is required to name an existing top-level object, so a plain DTCG doc
 * can never be mistaken for a layered one.
 *
 * @param doc a parsed token document.
 * @returns the set keys, or null for a single-implicit-set document.
 */
export function tokenSetNames(doc: unknown): string[] | null {
  if (!isRecord(doc)) return null;
  const setKeys = Object.keys(doc).filter(k => !k.startsWith('$'));
  if (!setKeys.length) return null;
  if (Array.isArray(doc.$themes) && doc.$themes.length > 0) return setKeys;
  const meta = isRecord(doc.$metadata) ? doc.$metadata : null;
  const order = meta && Array.isArray(meta.tokenSetOrder) ? meta.tokenSetOrder : null;
  if (order && order.length && order.every(s => typeof s === 'string' && isRecord(doc[s]))) {
    return setKeys;
  }
  return null;
}

// Which top-level sets are active (and in what order). Unions the selectedTokenSets across
// every COMPOSED theme (see chosenThemes) so a multi-axis doc resolves fully; a 'source' set
// counts (it backs alias resolution), 'disabled' does not. Order comes from the global
// $metadata.tokenSetOrder (later overrides earlier).
function activeSets(doc: UnknownRecord, theme: string | undefined): string[] {
  const setKeys = tokenSetNames(doc) ?? [];
  const meta = isRecord(doc.$metadata) ? doc.$metadata : {};
  const order = Array.isArray(meta.tokenSetOrder) ? meta.tokenSetOrder : null;
  const themes = Array.isArray(doc.$themes) ? doc.$themes.filter(isRecord) : null;
  if (!themes || !themes.length) {
    // Themeless-but-layered (Penpot's `$themes: []`): tokenSetOrder IS the layering.
    return order
      ? order.filter((s): s is string => typeof s === 'string' && setKeys.includes(s))
      : setKeys;
  }
  const active = new Set<string>();
  for (const t of chosenThemes(themes, meta, theme)) {
    const sel = isRecord(t.selectedTokenSets) ? t.selectedTokenSets : {};
    for (const s of setKeys) { const v = sel[s]; if (v && v !== 'disabled') active.add(s); }
  }
  let out = setKeys.filter(s => active.has(s));
  if (!out.length) out = setKeys; // themes name no sets → fall back to all
  if (order) out = order.filter((s): s is string => typeof s === 'string' && out.includes(s));
  return out;
}

function buildMergedMap(doc: UnknownRecord, theme: string | undefined): Map<string, MutableEntry> {
  const out = new Map<string, MutableEntry>();
  if (!tokenSetNames(doc)) {
    flattenGroup(doc, null, '', out); // whole document is one implicit set
    return out;
  }
  for (const setName of activeSets(doc, theme)) {
    const setNode = doc[setName];
    if (isRecord(setNode)) {
      flattenGroup(setNode, strOrNull(setNode.$type), '', out); // set name is NOT part of the path
    }
  }
  return out;
}

// Resolve `{path}` aliases in place, following chains, leaving cycles untouched.
// Gradient-typed tokens additionally get scoped composite resolution: aliases
// nested in their stops (`$value[].color`) resolve through the same cycle-safe
// walk — into a NEW array, since the raw stop objects belong to the caller's doc.
function resolveAliases(map: Map<string, MutableEntry>): Map<string, MutableEntry> {
  const resolving = new Set<string>();
  function resolve(path: string): unknown {
    const e = map.get(path);
    if (!e) return undefined;
    if (e._done) return e.value;
    if (resolving.has(path)) return e.value; // cycle — stop, keep raw
    resolving.add(path);
    if (isAlias(e.value)) {
      const target = aliasPath(e.value);
      if (target != null) {
        const tv = resolve(target);
        if (tv !== undefined) {
          e.value = tv;
          if (e.type == null) { const te = map.get(target); if (te) e.type = te.type; }
        }
      }
    } else if (e.type === 'gradient' && Array.isArray(e.value)) {
      let changed = false;
      const stops = e.value.map((s): unknown => {
        if (!isRecord(s) || !isAlias(s.color)) return s;
        const target = aliasPath(s.color);
        const tv = target != null ? resolve(target) : undefined;
        // Unresolvable — or a cycle's still-alias value — stays as authored,
        // exactly like a whole-value alias would.
        if (tv === undefined || isAlias(tv)) return s;
        changed = true;
        return { ...s, color: tv };
      });
      if (changed) e.value = stops;
    }
    e._done = true;
    resolving.delete(path);
    return e.value;
  }
  for (const path of [...map.keys()]) resolve(path);
  for (const e of map.values()) delete e._done;
  return map;
}

// ─── Public: a resolved token set ─────────────────────────────────────────────

/**
 * Parse a DTCG document into a resolved token set for the given theme.
 * @param doc  a DTCG document (or null/garbage → an empty set)
 * @param opts optional theme selection
 */
export function createTokenSet(doc: unknown, { theme }: { theme?: string } = {}): TokenSet {
  const map = isRecord(doc)
    ? resolveAliases(buildMergedMap(doc, theme))
    : new Map<string, MutableEntry>();

  return {
    get size() { return map.size; },
    has: (path: string) => map.has(path),
    get: (path: string) => {
      const e = map.get(path);
      return e ? { ...e } : undefined;
    },
    /** Resolve a `{path}` alias or a bare dotted path to its concrete value. */
    resolve(ref: string): unknown {
      const key = isAlias(ref) ? aliasPath(ref) : ref;
      const e = key != null ? map.get(key) : undefined;
      return e ? e.value : undefined;
    },
    /** All tokens, optionally filtered by `$type`. */
    query({ type }: { type?: string } = {}): TokenEntry[] {
      let out = [...map.values()];
      if (type) out = out.filter(e => e.type === type);
      return out.map(e => ({ ...e }));
    },
    /** Colour tokens as picker-ready swatches (hex value, label, group, CMYK). */
    colors(): ColorSwatch[] {
      return [...map.values()].filter(e => e.type === 'color').map(toSwatch);
    },
    /** Theme names declared in the document. */
    themes(): { name: string; group: string | null }[] {
      const themesArr = isRecord(doc) && Array.isArray(doc.$themes) ? doc.$themes : null;
      if (!themesArr) return [];
      return themesArr.map((t) => {
        const r = isRecord(t) ? t : {};
        return {
          name: strOrNull(r.name) ?? strOrNull(r.id) ?? '',
          group: strOrNull(r.group),
        };
      });
    },
  };
}

function toSwatch(e: TokenEntry): ColorSwatch {
  const segs = e.path.split('.');
  const leaf = segs[segs.length - 1] ?? '';
  const extRaw = e.extensions ? e.extensions[TOKEN_EXT] : null;
  const ext = isRecord(extRaw) ? extRaw : null;
  return {
    ref: `{${e.path}}`,
    path: e.path,
    name: e.description || prettify(leaf),
    group: (ext ? strOrNull(ext.group) : null) ??
      (segs.length > 1 ? prettify(segs[segs.length - 2] ?? '') : null),
    // toSwatch is only called on e.type === 'color' (see swatches()), so colorToHex
    // returns a real hex here; '' is a contract-satisfying fallback (ColorSwatch.value
    // is a non-null string) that a malformed colour value can never actually hit.
    //
    // An AUTHORED sRGB face wins over the automatic bake — this is Phase 9 of
    // plans/60-color-spaces.md, and it is one line here rather than a change per
    // export path because every consumer of a brand colour funnels through this
    // field. The reason it must win: the automatic §14.2 gamut map picks the
    // nearest reproducible colour by ΔE, and a brand will often prefer a
    // DIFFERENT sRGB green — one that reads as the same brand colour to a human
    // even though it is not the closest by measurement. Left unhonoured, the
    // override would be decoration.
    //
    // Only sRGB, deliberately. A wider face cannot be substituted into a field
    // typed as a hex without being baked itself, which would throw away exactly
    // what it was authored to carry; `faces` below carries those untouched for a
    // consumer that can use them.
    value: srgbFace(ext) ?? colorToHex(e.value) ?? '',
    description: e.description ?? null,
    cmyk: ext && isNumberArray(ext.cmyk) ? ext.cmyk : null,
    spot: ext ? readSpotColor(ext.spot) : null,
    ...(ext ? facesOf(ext) : {}),
  };
}

/**
 * The authored sRGB override as a hex, or null.
 *
 * Re-serialised through `colorToHex` rather than passed through verbatim: a face
 * is stored in whatever notation its author typed (`oklch(...)`, a named colour,
 * a hex), and `ColorSwatch.value` is contractually a hex string. A face that will
 * not parse is IGNORED rather than emitted — a malformed override must not be
 * able to make a brand colour render as nothing.
 */
function srgbFace(ext: Record<string, unknown> | null): string | null {
  if (!ext) return null;
  const face = readFaces(ext).get('srgb');
  if (!face || typeof face.value !== 'string') return null;
  return colorToHex(face.value) ?? null;
}

/** The `faces` field, present only when the token actually has overrides — an
 *  empty object on every swatch would be noise in every serialised payload. */
function facesOf(ext: Record<string, unknown>): { faces?: Record<string, string | number[]> } {
  const stored = readFaces(ext);
  if (!stored.size) return {};
  const faces: Record<string, string | number[]> = {};
  for (const [target, f] of stored) faces[target] = f.value;
  return { faces };
}

function prettify(slug: string): string {
  return String(slug).replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Resolve a stored input value to a concrete colour string for hydration/display.
 * Accepts a token value object ({ref, value}), a bare alias string, or a plain
 * colour string (returned untouched — existing tools are unaffected).
 */
export function resolveColorValue(
  tokenSet: Pick<TokenSet, 'resolve'> | null | undefined,
  stored: unknown,
): unknown {
  if (isTokenValue(stored)) {
    const r = tokenSet?.resolve(stored.ref);
    return r !== undefined ? colorToHex(r) : colorToHex(stored.value);
  }
  if (isAlias(stored)) {
    const r = tokenSet?.resolve(stored);
    return r !== undefined ? colorToHex(r) : undefined;
  }
  return stored; // plain colour string (or non-string) — leave exactly as-is
}

// ─── Typography composites ───────────────────────────────────────────────────

/**
 * The font families named by a typography-ish token value.
 *
 * Penpot exports a `$type: "typography"` composite whose `$value` uses PLURAL
 * keys (`fontFamilies`, `fontSizes`, `fontWeights`, …); Tokens Studio and
 * hand-authored docs use the singular ones, and a family itself can be a
 * string, a comma-joined stack, or an array (Penpot stores split families).
 * A bare string `$value` is a whole-token alias or a family name outright.
 *
 * Families only, deliberately: sizes, weights and line heights carry units and
 * scales this function has no business guessing at. Returns `[]` for anything
 * unreadable, deduped, in the order the value declares them, aliases dropped.
 */
export function typographyFamilies(value: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const take = (v: unknown): void => {
    if (Array.isArray(v)) { for (const item of v) take(item); return; }
    if (typeof v !== 'string' || isAlias(v)) return;
    // A stack ("Work Sans, sans-serif") names its families in order.
    for (const part of v.split(',')) {
      const fam = part.trim().replace(/^['"]+|['"]+$/g, '').trim();
      if (!fam || seen.has(fam)) continue;
      seen.add(fam);
      out.push(fam);
    }
  };
  if (typeof value === 'string' || Array.isArray(value)) { take(value); return out; }
  if (!isRecord(value)) return out;
  take(value.fontFamilies ?? value.fontFamily);
  return out;
}

// ─── Colour normalisation ─────────────────────────────────────────────────────

/** Normalise any DTCG/CSS colour form Penpot can emit to a hex string. */
export function colorToHex(value: unknown): string | null | undefined {
  if (value == null) return value as null | undefined;
  if (isRecord(value)) {
    if (typeof value.hex === 'string') return normHex(value.hex);
    if (Array.isArray(value.components)) {
      const [r, g, b] = value.components; // srgb components, 0–1
      return rgbaToHex(Number(r) * 255, Number(g) * 255, Number(b) * 255,
        value.alpha == null ? 1 : Number(value.alpha));
    }
    // An object we can't read as a colour must NOT flow on verbatim — it would
    // stringify to "[object Object]" in a swatch and render an <input type=color>
    // blank. Return null so callers treat it as "no colour".
    return null;
  }
  const s = String(value).trim();
  if (s.toLowerCase() === 'transparent') return 'transparent';
  if (s.startsWith('#')) return normHex(s);
  if (/^(?:ok)?lch\(/i.test(s)) {
    // oklch()/lch() — the OKLCH-native brand-token format. The conversion math
    // is brand-derive.ts's (single source of truth), never duplicated here.
    // Deliberately NOT routed through css-color.ts: oklchToHex's chroma-reduction
    // gamut mapping is what every stored brand token was authored against, and
    // unifying the two mappers is a decision of its own (plans/60-color-spaces.md
    // Phase 2), not a side effect of fixing the parsers.
    const ok = parseOklch(s);
    if (ok) return oklchToHex(ok);
  }
  // A plain colour ident ("rebeccapurple") passes through untouched — callers
  // (extractSvgColors) rely on getting the name back verbatim, and it is already
  // a safe CSS value. Checked BEFORE the parser, which would resolve it to hex.
  if (/^[a-z][a-z0-9-]*$/i.test(s)) return s;
  // Every other CSS colour form goes through the engine's CSS Color 4 parser:
  // rgb()/hsl() in either syntax, hwb(), lab(), oklab(), color(<space> …). It
  // returns a structured value or null, never a passthrough string, so the
  // injection guard below is inherent: token values come from untrusted imported
  // documents and colorToHex's output lands in inline style attributes, where
  // "red;background:url(//evil)" or "expression(alert(1))" would otherwise
  // inject live CSS declarations. Unreadable input is "no colour".
  const parsed = parseColor(s);
  return parsed ? colorToHexString(parsed) : null;
}

// Strict hex only: expand #rgb/#rgba, reject anything that isn't a pure
// 6/8-digit hex afterwards — "#fff;background:url(//x)" must not pass through.
function normHex(s: string): string | null {
  let h = s.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(h) || /^#[0-9a-f]{4}$/.test(h)) {
    h = '#' + h.slice(1).split('').map(c => c + c).join('');
  }
  return /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/.test(h) ? h : null;
}

function rgbaToHex(r: number, g: number, b: number, a = 1): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(Number(n) || 0))).toString(16).padStart(2, '0');
  const base = `#${h(r)}${h(g)}${h(b)}`;
  return a >= 1 ? base : base + h(a * 255);
}

