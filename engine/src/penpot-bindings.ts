// SPDX-License-Identifier: MPL-2.0
/**
 * Applied-token bindings for the `.penpot` writer (plans/222).
 *
 * Penpot's token model attaches a property→token-name map (`appliedTokens`, stored
 * camelCase) to a shape, so editing the named token in Penpot re-paints the bound
 * property. This module is the writer's guard on that map: it says which native
 * property keys exist, which token TYPE each may carry, which shape types each
 * applies to, and it drops a binding that names a token Penpot's DTCG reader would
 * not keep (an unsupported `$type`, a missing leaf) - because an applied reference
 * to a token `penpotTokensJson()` discarded would dangle on import.
 *
 * The type names below are the MAPPED Penpot spellings - the values
 * `penpot-file.ts`'s `TOKEN_TYPE_MAP` writes into `tokens.json` (e.g. DTCG
 * `fontSize` becomes `fontSizes`, `borderRadius` stays `borderRadius`). The token
 * type index this module builds is read straight off the already-filtered
 * `tokens.json`, so a binding is type-checked against exactly what shipped.
 *
 * The baseline six properties (`fill`, `strokeColor`, `r1`-`r4`, `fontSize`,
 * `fontFamily`) are the ones the `/components/` download already round-trips
 * through a real Penpot import (shells/web `component-penpot.ts`); the additive
 * ones (`strokeWidth`, `rotation`, `opacity`, `fontWeight`, `letterSpacing`) share
 * Penpot's `token-attributes` vocabulary and a supported DTCG type, but their live
 * behaviour is verified against a real import (plans/222 section 4) before being
 * advertised as proven.
 *
 * DOM-free and dependency-free: fully node:test-able.
 */

const isRec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export interface PenpotBindableProp {
  /** Mapped Penpot token types this property accepts (the spellings tokens.json carries). */
  types: ReadonlySet<string>;
  /** Penpot shape types (as the writer spells them: frame/rect/circle/path/text/group). */
  shapes: ReadonlySet<string>;
}

const S = (...v: string[]): ReadonlySet<string> => new Set(v);
const PAINTABLE = S('frame', 'rect', 'circle', 'path', 'text');
const ALL = S('frame', 'rect', 'circle', 'path', 'text', 'group');
const TEXT = S('text');
const CORNERED = S('frame', 'rect');

/**
 * Native, type-checked applied-token properties. A property NOT listed here is
 * dropped rather than emitted, because Penpot import validates the map and an
 * unknown attribute (or one attached to the wrong shape) is a refused archive.
 */
export const PENPOT_BINDABLE: Readonly<Record<string, PenpotBindableProp>> = Object.freeze({
  // ── baseline: proven through the /components/ import ──
  fill: { types: S('color'), shapes: PAINTABLE },
  strokeColor: { types: S('color'), shapes: PAINTABLE },
  r1: { types: S('borderRadius', 'dimension', 'number'), shapes: CORNERED },
  r2: { types: S('borderRadius', 'dimension', 'number'), shapes: CORNERED },
  r3: { types: S('borderRadius', 'dimension', 'number'), shapes: CORNERED },
  r4: { types: S('borderRadius', 'dimension', 'number'), shapes: CORNERED },
  fontSize: { types: S('fontSizes', 'dimension', 'number'), shapes: TEXT },
  fontFamily: { types: S('fontFamilies'), shapes: TEXT },
  // ── additive: supported DTCG type + Penpot attribute, pending live proof ──
  strokeWidth: { types: S('borderWidth', 'dimension', 'sizing', 'number'), shapes: PAINTABLE },
  rotation: { types: S('rotation', 'number'), shapes: ALL },
  opacity: { types: S('opacity', 'number'), shapes: ALL },
  fontWeight: { types: S('fontWeights', 'number'), shapes: TEXT },
  letterSpacing: { types: S('letterSpacing', 'dimension', 'number'), shapes: TEXT },
});

/** Every property Penpot may carry in an `appliedTokens` map, for callers building one. */
export const PENPOT_BINDABLE_PROPS: readonly string[] = Object.freeze(Object.keys(PENPOT_BINDABLE));

/** Dotted token name → the set of Penpot `$type`s it carries (a name can live in
 *  more than one set, at more than one type). Built from a filtered tokens.json. */
export type TokenTypeIndex = Map<string, Set<string>>;

/**
 * Walk a `penpotTokensJson()` result (sets → groups → leaves) into an index of
 * every token's dotted name → its `$type`s. The name EXCLUDES the set name, which
 * is how Penpot's `appliedTokens` reference it (the name is unique across the
 * active sets, not per-set). A `null`/empty doc yields an empty index.
 */
export function buildTokenTypeIndex(filtered: Record<string, unknown> | null | undefined): TokenTypeIndex {
  const index: TokenTypeIndex = new Map();
  if (!isRec(filtered)) return index;
  const walk = (node: Record<string, unknown>, path: string): void => {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('$') || !isRec(v)) continue;
      const p = path ? `${path}.${k}` : k;
      if ('$value' in v) {
        const t = typeof v.$type === 'string' ? v.$type : '';
        if (!t) continue;
        let set = index.get(p);
        if (!set) { set = new Set(); index.set(p, set); }
        set.add(t);
      } else {
        walk(v, p);
      }
    }
  };
  for (const [setName, set] of Object.entries(filtered)) {
    if (setName.startsWith('$') || !isRec(set)) continue;
    walk(set, '');
  }
  return index;
}

/** A dotted token name safe to reference: no empty segment, no `$`/brace/dot inside
 *  a segment, and no prototype-poisoning key (the map is third-party data). */
export function isSafeTokenPath(p: unknown): p is string {
  if (typeof p !== 'string' || !p || p.length > 512) return false;
  const segs = p.split('.');
  for (const s of segs) {
    if (!s || s.length > 128) return false;
    if (/[${}\s]/.test(s)) return false;
    if (s === '__proto__' || s === 'prototype' || s === 'constructor') return false;
  }
  return true;
}

/**
 * Validate one shape's applied-token map for a Penpot shape `type`. Keeps only
 * bindings whose property is native, applies to this shape type, names a
 * type-safe token path, and points at a token the filtered `index` still holds
 * with a compatible type. Everything dropped is reported through `warn` (never
 * thrown) so a bad binding degrades to a plain painted property instead of a
 * refused archive. Returns `undefined` when nothing survives, so the caller omits
 * the field entirely.
 */
export function sanitizeAppliedTokens(
  penpotShapeType: string,
  applied: unknown,
  index: TokenTypeIndex,
  warn?: (s: string) => void,
): Record<string, string> | undefined {
  if (!isRec(applied)) return undefined;
  const out: Record<string, string> = {};
  let kept = 0;
  for (const [prop, val] of Object.entries(applied)) {
    const spec = PENPOT_BINDABLE[prop];
    if (!spec) { warn?.(`applied token '${prop}' is not a bindable property; dropped`); continue; }
    if (!spec.shapes.has(penpotShapeType)) { warn?.(`applied token '${prop}' does not apply to a ${penpotShapeType}; dropped`); continue; }
    if (!isSafeTokenPath(val)) { warn?.(`applied token '${prop}' names an unusable token path; dropped`); continue; }
    const types = index.get(val);
    if (!types?.size) { warn?.(`applied token '${prop}' → {${val}} resolves to no surviving token; dropped`); continue; }
    let compat = false;
    for (const t of types) if (spec.types.has(t)) { compat = true; break; }
    if (!compat) { warn?.(`applied token '${prop}' → {${val}} is ${[...types].join('/')}, not one ${prop} can carry; dropped`); continue; }
    out[prop] = val;
    kept++;
  }
  return kept ? out : undefined;
}

export interface PenpotTokenClosure {
  /** `owner → {ref}` for a reference whose leaf does not exist in the doc. */
  dangling: string[];
  /** `a → b → a` for each alias cycle found. */
  cycles: string[];
}

/**
 * Check alias closure of a filtered tokens.json: every `{alias}` a token's value
 * names must resolve to a leaf that exists, and no chain may cycle. Cross-set
 * references count (a name is resolved across the whole doc, as Penpot does).
 * Bounded and non-throwing - a report, for the caller's export summary, not a
 * gate on the archive.
 */
export function penpotTokenClosure(filtered: Record<string, unknown> | null | undefined): PenpotTokenClosure {
  const dangling: string[] = [];
  const cycles: string[] = [];
  if (!isRec(filtered)) return { dangling, cycles };
  const value = new Map<string, unknown>();
  const walk = (node: Record<string, unknown>, path: string): void => {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('$') || !isRec(v)) continue;
      const p = path ? `${path}.${k}` : k;
      if ('$value' in v) { if (!value.has(p)) value.set(p, v.$value); }
      else walk(v, p);
    }
  };
  for (const [setName, set] of Object.entries(filtered)) {
    if (setName.startsWith('$') || !isRec(set)) continue;
    walk(set, '');
  }
  const refsOf = (v: unknown): string[] => {
    if (typeof v !== 'string') return [];
    const out: string[] = [];
    const re = /\{([^{}]+)\}/g;
    let m = re.exec(v);
    while (m) { out.push(m[1]!.trim()); m = re.exec(v); }
    return out;
  };
  for (const [p, v] of value) for (const ref of refsOf(v)) if (!value.has(ref)) dangling.push(`${p} → {${ref}}`);

  // Cycle detection over the alias graph (grey = on the current stack).
  const WHITE = 0, GREY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];
  const visit = (p: string): void => {
    color.set(p, GREY); stack.push(p);
    for (const ref of refsOf(value.get(p))) {
      if (!value.has(ref)) continue;
      const c = color.get(ref) ?? WHITE;
      if (c === GREY) {
        const from = stack.indexOf(ref);
        cycles.push([...stack.slice(from), ref].join(' → '));
      } else if (c === WHITE) visit(ref);
    }
    stack.pop(); color.set(p, BLACK);
  };
  for (const p of value.keys()) if ((color.get(p) ?? WHITE) === WHITE) visit(p);

  return {
    dangling: [...new Set(dangling)].slice(0, 200),
    cycles: [...new Set(cycles)].slice(0, 200),
  };
}
