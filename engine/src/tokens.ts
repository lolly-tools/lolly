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
// A single-theme or single-axis (one `group`) doc composes exactly one theme — identical to
// the old `named ?? themes[0]` behaviour, so nothing regresses.
function chosenThemes(themes: UnknownRecord[], meta: UnknownRecord, theme: string | undefined): UnknownRecord[] {
  if (themes.length <= 1) return themes;
  const groupOf = (t: UnknownRecord): string => (typeof t.group === 'string' ? t.group : '');
  const byGroup = new Map<string, UnknownRecord[]>();
  for (const t of themes) { const g = groupOf(t); const list = byGroup.get(g); if (list) list.push(t); else byGroup.set(g, [t]); }
  if (byGroup.size <= 1) return theme ? [themes.find(t => t.name === theme || t.id === theme) ?? themes[0]!] : [themes[0]!];

  const requested = theme ? themes.find(t => t.name === theme || t.id === theme) : undefined;
  if (requested) {
    const rg = groupOf(requested);
    const out = [requested];
    for (const [g, list] of byGroup) if (g !== rg && list[0]) out.push(list[0]);
    return out;
  }
  const activeNames = Array.isArray(meta.activeThemes)
    ? meta.activeThemes.filter((x): x is string => typeof x === 'string') : [];
  if (activeNames.length) {
    const active = themes.filter(t => activeNames.includes(String(t.name)) || activeNames.includes(String(t.id)));
    if (active.length) return active;
  }
  const out: UnknownRecord[] = [];
  for (const [, list] of byGroup) if (list[0]) out.push(list[0]);
  return out.length ? out : [themes[0]!];
}

// Which top-level sets are active (and in what order). Unions the selectedTokenSets across
// every COMPOSED theme (see chosenThemes) so a multi-axis doc resolves fully; a 'source' set
// counts (it backs alias resolution), 'disabled' does not. Order comes from the global
// $metadata.tokenSetOrder (later overrides earlier).
function activeSets(doc: UnknownRecord, theme: string | undefined): string[] {
  const setKeys = Object.keys(doc).filter(k => !k.startsWith('$'));
  const meta = isRecord(doc.$metadata) ? doc.$metadata : {};
  const order = Array.isArray(meta.tokenSetOrder) ? meta.tokenSetOrder : null;
  const themes = Array.isArray(doc.$themes) ? doc.$themes.filter(isRecord) : null;
  if (!themes || !themes.length) return setKeys; // caller handles the no-themes case
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
  const themes = Array.isArray(doc.$themes) ? doc.$themes : null;
  if (!themes || !themes.length) {
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
    value: colorToHex(e.value) ?? '',
    description: e.description ?? null,
    cmyk: ext && isNumberArray(ext.cmyk) ? ext.cmyk : null,
    spot: ext && isSpotColor(ext.spot) ? ext.spot : null,
  };
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
  let m;
  if ((m = /^rgba?\(([^)]+)\)$/i.exec(s))) {
    const p = (m[1] ?? '').split(/[,/]/).map(x => x.trim());
    return rgbaToHex(num(p[0]), num(p[1]), num(p[2]), p[3] != null ? alpha(p[3]) : 1);
  }
  if ((m = /^hsla?\(([^)]+)\)$/i.exec(s))) {
    const p = (m[1] ?? '').split(/[,/]/).map(x => x.trim());
    const [r, g, b] = hslToRgb(num(p[0]), pct(p[1]), pct(p[2]));
    return rgbaToHex(r, g, b, p[3] != null ? alpha(p[3]) : 1);
  }
  if (/^(?:ok)?lch\(/i.test(s)) {
    // oklch()/lch() — the OKLCH-native brand-token format. The conversion math
    // is brand-derive.ts's (single source of truth), never duplicated here.
    const ok = parseOklch(s);
    if (ok) return oklchToHex(ok);
  }
  // A plain colour ident ("rebeccapurple") passes through untouched. Anything
  // else must NOT flow on verbatim: token values come from untrusted imported
  // documents and colorToHex's output lands in inline style attributes, so a
  // string like "red;background:url(//evil)" or "expression(alert(1))" would
  // otherwise inject live CSS declarations. Idents only; the rest is "no colour".
  return /^[a-z][a-z0-9-]*$/i.test(s) ? s : null;
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

function num(x: string | undefined): number { return parseFloat(x ?? ''); }
function pct(x: string | undefined): number { return (parseFloat(x ?? '') || 0) / 100; }
function alpha(x: string): number { const n = parseFloat(x); return String(x).includes('%') ? n / 100 : n; }

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) { const v = l * 255; return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const c = (t: number): number => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [c(h + 1 / 3) * 255, c(h) * 255, c(h - 1 / 3) * 255];
}
