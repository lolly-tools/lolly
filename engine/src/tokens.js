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
 * Colour values: read every form Penpot can emit (hex, rgb/rgba, hsl/hsla, and
 * the DTCG colour *object*), normalise to a hex string for the rest of the app
 * (which already speaks `#rrggbb` / `#rrggbbaa` / `transparent`). CMYK print
 * anchors ride in `$extensions` under the SUSE vendor key — DTCG reserves
 * `$extensions` for exactly this, and Penpot round-trips it untouched.
 */

// Vendor extension namespace for Lolly-specific token metadata (CMYK anchors,
// swatch grouping hints). Reverse-domain per the DTCG `$extensions` convention.
export const TOKEN_EXT = 'com.suse.lolly';

const ALIAS_RE = /^\{([^{}]+)\}$/;

/** True when `v` is a whole-value DTCG alias string like `"{color.brand.jungle}"`. */
export function isAlias(v) {
  return typeof v === 'string' && ALIAS_RE.test(v.trim());
}

/** The dotted path inside an alias string, or null if `v` isn't an alias. */
export function aliasPath(v) {
  const m = ALIAS_RE.exec(String(v).trim());
  return m ? m[1] : null;
}

/**
 * A token-backed input value: a reference plus the hex it last resolved to. The
 * reference keeps the value canonical (a token edit propagates everywhere); the
 * cached `value` is the graceful fallback when the token is gone on this device.
 */
export function isTokenValue(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v) && typeof v.ref === 'string';
}

// ─── Document → flat resolved map ─────────────────────────────────────────────

// Walk a group tree, emitting one entry per token (an object with `$value`),
// carrying the nearest declared `$type` down to its descendants.
function flattenGroup(node, inheritedType, prefix, out) {
  if (!node || typeof node !== 'object') return;
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$')) continue; // group-level metadata ($type/$description/…)
    if (!child || typeof child !== 'object') continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if ('$value' in child) {
      out.set(path, {
        path,
        type: child.$type ?? inheritedType ?? null,
        value: child.$value,
        description: child.$description ?? null,
        extensions: child.$extensions ?? null,
      });
    } else {
      flattenGroup(child, child.$type ?? inheritedType, path, out);
    }
  }
}

// Which top-level sets are active (and in what order) for the chosen theme.
function activeSets(doc, theme) {
  const setKeys = Object.keys(doc).filter(k => !k.startsWith('$'));
  const order = Array.isArray(doc.$metadata?.tokenSetOrder) ? doc.$metadata.tokenSetOrder : null;
  const themes = Array.isArray(doc.$themes) ? doc.$themes : null;
  if (!themes || !themes.length) return setKeys; // caller handles the no-themes case
  const chosen = (theme && themes.find(t => t.name === theme || t.id === theme)) || themes[0];
  const sel = chosen?.selectedTokenSets ?? {};
  let active = setKeys.filter(s => sel[s] && sel[s] !== 'disabled');
  if (!active.length) active = setKeys; // theme names no sets → fall back to all
  if (order) active = order.filter(s => active.includes(s));
  return active;
}

function buildMergedMap(doc, theme) {
  const out = new Map();
  const themes = Array.isArray(doc.$themes) ? doc.$themes : null;
  if (!themes || !themes.length) {
    flattenGroup(doc, null, '', out); // whole document is one implicit set
    return out;
  }
  for (const setName of activeSets(doc, theme)) {
    const setNode = doc[setName];
    if (setNode && typeof setNode === 'object') {
      flattenGroup(setNode, setNode.$type ?? null, '', out); // set name is NOT part of the path
    }
  }
  return out;
}

// Resolve `{path}` aliases in place, following chains, leaving cycles untouched.
function resolveAliases(map) {
  const resolving = new Set();
  function resolve(path) {
    const e = map.get(path);
    if (!e) return undefined;
    if (e._done) return e.value;
    if (resolving.has(path)) return e.value; // cycle — stop, keep raw
    resolving.add(path);
    if (isAlias(e.value)) {
      const target = aliasPath(e.value);
      const tv = resolve(target);
      if (tv !== undefined) {
        e.value = tv;
        if (e.type == null) { const te = map.get(target); if (te) e.type = te.type; }
      }
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
 * @param {object} doc  a DTCG document (or null/garbage → an empty set)
 * @param {{ theme?: string }} [opts]
 */
export function createTokenSet(doc, { theme } = {}) {
  const map = doc && typeof doc === 'object'
    ? resolveAliases(buildMergedMap(doc, theme))
    : new Map();

  return {
    get size() { return map.size; },
    has: (path) => map.has(path),
    get: (path) => (map.has(path) ? { ...map.get(path) } : undefined),
    /** Resolve a `{path}` alias or a bare dotted path to its concrete value. */
    resolve(ref) {
      const e = map.get(isAlias(ref) ? aliasPath(ref) : ref);
      return e ? e.value : undefined;
    },
    /** All tokens, optionally filtered by `$type`. */
    query({ type } = {}) {
      let out = [...map.values()];
      if (type) out = out.filter(e => e.type === type);
      return out.map(e => ({ ...e }));
    },
    /** Colour tokens as picker-ready swatches (hex value, label, group, CMYK). */
    colors() {
      return [...map.values()].filter(e => e.type === 'color').map(toSwatch);
    },
    /** Theme names declared in the document. */
    themes() {
      return Array.isArray(doc?.$themes)
        ? doc.$themes.map(t => ({ name: t.name ?? t.id ?? '', group: t.group ?? null }))
        : [];
    },
  };
}

function toSwatch(e) {
  const segs = e.path.split('.');
  const ext = e.extensions?.[TOKEN_EXT] ?? null;
  return {
    ref: `{${e.path}}`,
    path: e.path,
    name: e.description || prettify(segs[segs.length - 1]),
    group: ext?.group ?? (segs.length > 1 ? prettify(segs[segs.length - 2]) : null),
    value: colorToHex(e.value),
    description: e.description ?? null,
    cmyk: Array.isArray(ext?.cmyk) ? ext.cmyk : null,
  };
}

function prettify(slug) {
  return String(slug).replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Resolve a stored input value to a concrete colour string for hydration/display.
 * Accepts a token value object ({ref, value}), a bare alias string, or a plain
 * colour string (returned untouched — existing tools are unaffected).
 */
export function resolveColorValue(tokenSet, stored) {
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
export function colorToHex(value) {
  if (value == null) return value;
  if (typeof value === 'object' && !Array.isArray(value)) {
    if (typeof value.hex === 'string') return normHex(value.hex);
    if (Array.isArray(value.components)) {
      const [r, g, b] = value.components; // srgb components, 0–1
      return rgbaToHex(r * 255, g * 255, b * 255, value.alpha == null ? 1 : value.alpha);
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
    const p = m[1].split(/[,/]/).map(x => x.trim());
    return rgbaToHex(num(p[0]), num(p[1]), num(p[2]), p[3] != null ? alpha(p[3]) : 1);
  }
  if ((m = /^hsla?\(([^)]+)\)$/i.exec(s))) {
    const p = m[1].split(/[,/]/).map(x => x.trim());
    const [r, g, b] = hslToRgb(num(p[0]), pct(p[1]), pct(p[2]));
    return rgbaToHex(r, g, b, p[3] != null ? alpha(p[3]) : 1);
  }
  return s; // a named CSS colour or something we don't parse — leave it alone
}

function normHex(s) {
  let h = s.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(h) || /^#[0-9a-f]{4}$/.test(h)) {
    h = '#' + h.slice(1).split('').map(c => c + c).join('');
  }
  return h;
}

function rgbaToHex(r, g, b, a = 1) {
  const h = n => Math.max(0, Math.min(255, Math.round(Number(n) || 0))).toString(16).padStart(2, '0');
  const base = `#${h(r)}${h(g)}${h(b)}`;
  return a >= 1 ? base : base + h(a * 255);
}

function num(x) { return parseFloat(x); }
function pct(x) { return (parseFloat(x) || 0) / 100; }
function alpha(x) { const n = parseFloat(x); return String(x).includes('%') ? n / 100 : n; }

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) { const v = l * 255; return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const c = t => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [c(h + 1 / 3) * 255, c(h) * 255, c(h - 1 / 3) * 255];
}
