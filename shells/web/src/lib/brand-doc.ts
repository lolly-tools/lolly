// SPDX-License-Identifier: MPL-2.0
/**
 * Brand document surgery - the pure, DOM-free half of the brand editor.
 *
 * The editor treats the installed DTCG document (host.tokens.raw()) as the
 * single source of truth for the palette: every colour leaf is a swatch, and
 * "recolour / rename / delete / add" are just writes to that document, which is
 * then re-installed wholesale through installUserTokens.
 *
 * Everything here is a pure function over a plain object so it can be unit
 * tested without a browser (see brand-doc.test.ts). Nothing in this module
 * imports the DOM, the bridge, or any component.
 *
 * Shape notes: a derived brand (engine deriveBrandTokens) is multi-set - 
 * `base` holds the ramps + spectrum, and `light` / `dark` each hold the seven
 * `color.semantic.*` ROLES, which are `{alias}` references into the ramps. An
 * imported Tokens-Studio/W3C export may be single-set with colour leaves at any
 * depth, so the walker addresses leaves by JSON key path rather than assuming
 * a fixed layout.
 */

import {
  colorToHex, TOKEN_EXT, readFaces, writeFace,
  parseOklch, formatOklch, sampleCurve, defaultColorCurve, serializeCurve,
  solveLightnessForApca, hexToOklch, oklchToHex, clipToGamut,
} from '@lolly/engine';
import type { StoredFace, Oklch, ColorCurve, ColorCurveJSON, CurvePoint } from '@lolly/engine';
import type { SpotColor } from '@lolly-tools/core/host-v1';
// The exclusion READ lives in a leaf module so the boot-path tokens bridge can
// filter excluded swatches without importing this (engine-barrel-heavy) file;
// re-exported here so studio callers keep their single brand-doc import.
import { getExcludedSwatches } from './brand-exclusions.ts';
export { getExcludedSwatches };

type Rec = Record<string, unknown>;

export const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
/** `{color.ramp.primary.5}` - a reference, not a literal colour. */
export const isAliasStr = (v: unknown): v is string => typeof v === 'string' && /^\{[^}]+\}$/.test(v.trim());
const isColorString = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && (isAliasStr(v) || colorToHex(v) !== null);
const isNumberArray = (v: unknown): v is number[] => Array.isArray(v) && v.every(n => typeof n === 'number');
const isSpotColor = (v: unknown): v is SpotColor => {
  if (!isRec(v) || typeof v.name !== 'string') return false;
  return v.book === undefined || typeof v.book === 'string';
};
/** Kept deliberately in step with `readSpotColor` in engine/src/tokens.ts - that
 *  one gates the READ side, this one the WRITE side (`readPrintLock`), and a
 *  divergence means a lock the editor stores reads back differently everywhere
 *  else. `finish` is checked as a plain string because `FinishKind` is an open
 *  union, and a non-string one drops just that field rather than the ink. */
const readSpotColor = (v: unknown): SpotColor | null => {
  if (!isSpotColor(v)) return null;
  if (v.finish === undefined || typeof v.finish === 'string') return v;
  const { finish: _malformed, ...rest } = v as SpotColor & Rec;
  return rest as SpotColor;
};

/** A swatch's print-export lock. `cmyk` and `spot` are independent - a token
 *  may carry either, both, or neither (absent fields, not present at all, when
 *  not locked): `cmyk` is the process-colour fallback used for preview,
 *  non-PDF export, and the Separation alternate-space value regardless of
 *  whether a spot is also set, so locking a named ink never discards a
 *  separately-tuned CMYK build. Absent entirely means auto-convert from
 *  `$value` at export. */
export type PrintLock = { cmyk?: [number, number, number, number]; spot?: SpotColor };

/** Read whichever of `cmyk`/`spot` are present on a leaf's vendor extension, or
 *  null if neither is. */
function readPrintLock(leaf: Rec | null): PrintLock | null {
  const ext = leaf && isRec(leaf.$extensions) ? (leaf.$extensions as Rec)[TOKEN_EXT] : null;
  if (!isRec(ext)) return null;
  const lock: PrintLock = {};
  if (isNumberArray(ext.cmyk) && ext.cmyk.length === 4) lock.cmyk = ext.cmyk as [number, number, number, number];
  const spot = readSpotColor(ext.spot);
  if (spot) lock.spot = spot;
  return lock.cmyk || lock.spot ? lock : null;
}

export const prettify = (s: string): string => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

/** Top-level DTCG token sets a derived brand uses. */
const SET_KEYS = new Set(['base', 'light', 'dark']);

/** One editable colour leaf, located in the raw doc. */
export interface BrandSwatch {
  /** JSON key path to the leaf group (the object holding `$value`). */
  path: string[];
  /** Canonical dotted token key, set prefix stripped (`color.ramp.primary.5`). */
  key: string;
  /** Display bucket: a ramp family, `Spectrum`, `Custom`, or `Roles · Light`. */
  group: string;
  /** Label shown on the tile ($description, else a prettified leaf key). */
  name: string;
  /** The stored `$value` - may be an `oklch()` string or a `{alias}`. */
  raw: string;
  /** Resolved sRGB hex for the tile ('' when it can't be resolved, e.g. an alias). */
  hex: string;
  isAlias: boolean;
  kind: 'ramp' | 'spectrum' | 'custom' | 'semantic' | 'other';
  /** Top-level set (base/light/dark) when the doc is multi-set, else null. */
  set: string | null;
  /** Only swatches the user owns are removable; ramps + roles are structural. */
  deletable: boolean;
  /** Pinned print-export value (CMYK or spot), or null when auto-converted from `hex`. */
  lock: PrintLock | null;
}

/**
 * Every colour leaf in `doc`, in document order.
 *
 * A semantic ROLE exists once per theme set, so a multi-set doc would otherwise
 * surface `primary`/`surface`/… twice. `theme` picks which set's roles to show
 * (defaulting to light); ramps + spectrum live in `base` and are always shown.
 *
 * `resolve` (the caller's TokenSet, typically) supplies the displayable colour
 * for leaves whose `$value` is an `{alias}` - every semantic role is one, so
 * without it those tiles would render blank. It is optional so this module stays
 * pure and unit-testable.
 */
export function walkSwatches(
  doc: unknown, theme = 'light', resolve?: (key: string) => unknown,
): BrandSwatch[] {
  const out: BrandSwatch[] = [];
  const multiSet = isRec(doc) && [...SET_KEYS].some(k => k in doc);
  const wantSet = theme === 'dark' ? 'dark' : 'light';
  // Where a custom swatch tagged "Roles" files: the CURRENT theme's Roles
  // section. The tag is stored theme-less by contract - a persisted
  // "Roles · Light" would strand the swatch under a phantom stale-theme
  // section the moment the app theme flips (toSwatch tolerates legacy
  // suffixed tags by mapping them here too).
  const rolesGroup = `Roles · ${multiSet ? prettify(wantSet) : 'Theme'}`;
  // The DTCG `$type` in force, inherited from the nearest ancestor that states one.
  // It is the discriminator because `isColorString` alone is NOT one: colorToHex
  // passes an unrecognised bare ident straight through, so `colorToHex('SUSE')`
  // is 'SUSE' and `colorToHex('Outfit')` is 'Outfit'. Without this, a
  // `$type: "fontFamily"` leaf whose value is a single-word family surfaced as a
  // phantom colour tile in the Colour room - brands/suse has done exactly that
  // (`color.font.brand`, hex "SUSE") since it gained font tokens, and the starter
  // pack would have joined it on 2026-08-10 when its own font tokens landed.
  // A doc that states NO type still walks as before (imported docs often don't),
  // so this only ever removes leaves a brand explicitly declared non-colour.
  const walk = (node: unknown, path: string[], inherited?: string): void => {
    if (!isRec(node)) return;
    const type = typeof node.$type === 'string' ? node.$type : inherited;
    if (isColorString(node.$value)) {
      if (type === undefined || type === 'color') {
        out.push(toSwatch(path, node.$value, node.$description, node.$extensions, resolve, rolesGroup));
      }
      return;
    }
    for (const k of Object.keys(node)) {
      if (k.startsWith('$')) continue;
      walk(node[k], [...path, k], type);
    }
  };
  walk(doc, []);
  if (!multiSet) return out;
  return out.filter(s => s.kind !== 'semantic' || s.set === wantSet);
}

function toSwatch(
  path: string[], raw: string, desc: unknown, extensions: unknown,
  resolve?: (key: string) => unknown, rolesGroup?: string,
): BrandSwatch {
  const set = SET_KEYS.has(path[0] ?? '') ? path[0]! : null;
  const rest = set ? path.slice(1) : path;
  const key = (rest[0] === 'color' ? rest : ['color', ...rest]).join('.');
  const leaf = path[path.length - 1] ?? '';
  const at = (seg: string): number => path.indexOf(seg);
  let kind: BrandSwatch['kind'] = 'other';
  let group = prettify(path[path.length - 2] ?? 'Colour');
  let deletable = true;
  if (at('ramp') >= 0) {
    // Ramp steps (primary/neutral/secondary shades) are user-deletable - the shade
    // count is theirs to shape (a semantic role aliasing a deleted step just falls
    // back to a blank chip until re-derived, same as any dangling alias).
    kind = 'ramp'; deletable = true;
    group = prettify(path[at('ramp') + 1] ?? 'Ramp');
  } else if (at('spectrum') >= 0) { kind = 'spectrum'; group = 'Spectrum'; }
  else if (at('custom') >= 0) { kind = 'custom'; group = 'Custom'; }
  else if (at('semantic') >= 0) {
    kind = 'semantic'; deletable = false;
    group = `Roles · ${set ? prettify(set) : 'Theme'}`;
  }
  const isAlias = isAliasStr(raw);
  // A literal resolves directly; an {alias} needs the caller's token set (a role
  // otherwise has no colour of its own to show).
  let hex = colorToHex(raw) ?? '';
  if (!hex && isAlias && resolve) {
    try { hex = colorToHex(resolve(key)) ?? ''; } catch { /* unresolvable → blank chip */ }
  }
  // A per-group "+ Add" on a derived section (Primary/Neutral/…) creates a
  // CUSTOM swatch tagged with that section's heading (addSwatch's displayGroup)
  // - the tag only relabels where the tile renders, never what the token is.
  const extNs = isRec(extensions) ? (extensions as Rec)[TOKEN_EXT] : null;
  let groupTag = isRec(extNs) && typeof (extNs as Rec).group === 'string' ? String((extNs as Rec).group) : null;
  // A "Roles" tag means "the current theme's Roles section", never a section
  // of its own - the walker passes the live label (a legacy theme-suffixed
  // "Roles · Light" tag maps there too, instead of stranding the swatch under
  // a stale-theme heading with its own duplicate + Add).
  if (groupTag && /^roles(\s*·.*)?$/i.test(groupTag)) groupTag = rolesGroup ?? groupTag;
  return {
    path, key, group: groupTag || group,
    name: typeof desc === 'string' && desc ? desc : prettify(leaf),
    raw, hex, isAlias, kind, set, deletable,
    lock: readPrintLock({ $extensions: extensions } as Rec),
  };
}

/** The object at a JSON key path, or null. */
export function leafAt(doc: unknown, path: string[]): Rec | null {
  let node: unknown = doc;
  for (const seg of path) { if (!isRec(node)) return null; node = node[seg]; }
  return isRec(node) ? node : null;
}

/** Recolour a swatch. Writing a literal detaches an `{alias}` role from its ramp. */
export function setSwatchValue(doc: unknown, path: string[], hex: string): boolean {
  const leaf = leafAt(doc, path);
  if (!leaf) return false;
  leaf.$value = hex;
  return true;
}

/** Rename a swatch (its `$description` - the label pickers show). */
export function setSwatchName(doc: unknown, path: string[], name: string): boolean {
  const leaf = leafAt(doc, path);
  if (!leaf) return false;
  const t = name.trim();
  if (t) leaf.$description = t; else delete leaf.$description;
  return true;
}

/** Remove a swatch from its parent group. */
export function deleteSwatch(doc: unknown, path: string[]): boolean {
  const parent = leafAt(doc, path.slice(0, -1));
  const leaf = path[path.length - 1];
  if (!parent || leaf === undefined || !(leaf in parent)) return false;
  delete parent[leaf];
  return true;
}

/**
 * Point `color.semantic.<role>` (both the light and dark sets, when present) at
 * a different ramp step - how the brand editor's neutral/secondary swatch
 * picker overrides a fresh `deriveBrandTokens` doc before install. `secondary`
 * already carries such an alias (the engine hardcodes step 5); `neutral` has no
 * slot of its own today, so this simply adds one, in the same shape.
 */
export function setSemanticRampAlias(doc: unknown, role: 'neutral' | 'secondary', step: number): void {
  if (!isRec(doc)) return;
  for (const set of ['light', 'dark']) {
    const semantic = leafAt(doc, [set, 'color', 'semantic']);
    if (semantic) semantic[role] = { $value: `{color.ramp.${role}.${step}}` };
  }
}

// ── Print (CMYK / spot) override - any swatch ────────────────────────────────
// "Auto-convert until you lock one": a swatch's screen colour ($value) is the
// source of truth (sRGB/OKLCH), and print/PDF-CMYK export auto-converts it - 
// UNLESS a print value is locked here, which the export palette then substitutes
// exactly. The lock rides in the DTCG `$extensions` vendor namespace (TOKEN_EXT)
// as EITHER `cmyk` (a plain process-ink anchor) OR `spot` (a named spot/Pantone
// colour with a CMYK equivalent for preview/fallback) - never both; setting one
// clears the other. tokens.colors() already surfaces both as `.cmyk`/`.spot`,
// which the CMYK export and the Separation tint-transform's alternate space read.

/** JSON path to the primary ramp's anchor swatch - the MIDDLE step (the brand
 *  colour), computed from however many steps the ramp carries (5 on a 9-step
 *  ramp, 3 on a 5-step ramp; = the engine's `at(0.5)`). Null if absent. A
 *  re-derive rebuilds the ramp, so the editor re-applies its lock after deriving. */
export function primaryAnchorPath(doc: unknown): string[] | null {
  const multiSet = isRec(doc) && [...SET_KEYS].some(k => k in doc);
  const groupPath = multiSet ? ['base', 'color', 'ramp', 'primary'] : ['color', 'ramp', 'primary'];
  const group = leafAt(doc, groupPath);
  if (!group) return null;
  const steps = Object.keys(group).filter(k => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
  if (!steps.length) return null;
  const anchor = Math.round((steps.length - 1) / 2) + 1;
  const step = steps.includes(anchor) ? anchor : steps[Math.floor(steps.length / 2)]!;
  return [...groupPath, String(step)];
}

/** The swatch at `path`'s pinned print lock (cmyk and/or spot), or null when
 *  neither is set. */
export function getSwatchPrintOverride(doc: unknown, path: string[]): PrintLock | null {
  return readPrintLock(leafAt(doc, path));
}

// ── Per-space faces (the generalisation of the print lock) ───────────────────
// A swatch's overrides for every space and press it can be expressed in, keyed
// by target id (`gamutSourceId`: a CSS space name, or `icc:<digest>:<intent>`).
// The shape, the read/write and the rules live in the engine (color-faces.ts)
// so the export walkers can consult them; these two are just the doc plumbing.
//
// Deliberately NOT a migration of `cmyk`/`spot`. Those are a shipped contract
// that brand packs in the wild already carry and that `tokens.colors()` already
// surfaces, so rewriting them on read would churn every pack the moment it was
// opened. They coexist: a CMYK build set through the print lock stays where it
// is, and a face is what a target-specific override becomes from here.

/** The swatch at `path`'s per-target overrides. Empty when it has none. */
export function getSwatchFaces(doc: unknown, path: string[]): Map<string, StoredFace> {
  const leaf = leafAt(doc, path);
  const ext = leaf && isRec(leaf.$extensions) ? (leaf.$extensions as Rec)[TOKEN_EXT] : null;
  return readFaces(ext);
}

/** Set (or clear, with null) one target's override on the swatch at `path`. */
export function setSwatchFace(
  doc: unknown, path: string[], target: string, face: StoredFace | null,
): boolean {
  const leaf = leafAt(doc, path);
  if (!leaf) return false;
  if (face === null) {
    const ext = isRec(leaf.$extensions) ? (leaf.$extensions as Rec) : null;
    const ns = ext && isRec(ext[TOKEN_EXT]) ? (ext[TOKEN_EXT] as Rec) : null;
    if (ns) { writeFace(ns as Record<string, unknown>, target, null); cleanupExt(leaf); }
    return true;
  }
  const ext = (isRec(leaf.$extensions) ? leaf.$extensions : (leaf.$extensions = {} as Rec)) as Rec;
  const ns = (isRec(ext[TOKEN_EXT]) ? ext[TOKEN_EXT] : (ext[TOKEN_EXT] = {} as Rec)) as Rec;
  writeFace(ns as Record<string, unknown>, target, face);
  return true;
}

/** Deletes the vendor extension entry once both `cmyk` and `spot` are gone,
 *  and `$extensions` itself once it's the only thing left in it. */
function cleanupExt(leaf: Rec): void {
  const ext = isRec(leaf.$extensions) ? (leaf.$extensions as Rec) : null;
  if (!ext || !isRec(ext[TOKEN_EXT])) return;
  if (Object.keys(ext[TOKEN_EXT] as Rec).length === 0) delete ext[TOKEN_EXT];
  if (Object.keys(ext).length === 0) delete leaf.$extensions;
}

/** Lock (or clear, with null) the swatch at `path`'s process-CMYK print value.
 *  Independent of `setSwatchSpotLock` - locking or clearing one never touches
 *  the other, so a token can carry a CMYK fallback alongside a spot lock. */
export function setSwatchCmykLock(doc: unknown, path: string[], cmyk: [number, number, number, number] | null): boolean {
  const leaf = leafAt(doc, path);
  if (!leaf) return false;
  if (cmyk === null) {
    const ext = isRec(leaf.$extensions) ? (leaf.$extensions as Rec) : null;
    if (ext && isRec(ext[TOKEN_EXT])) { delete (ext[TOKEN_EXT] as Rec).cmyk; cleanupExt(leaf); }
    return true;
  }
  const ext = (isRec(leaf.$extensions) ? leaf.$extensions : (leaf.$extensions = {} as Rec)) as Rec;
  const ns = (isRec(ext[TOKEN_EXT]) ? ext[TOKEN_EXT] : (ext[TOKEN_EXT] = {} as Rec)) as Rec;
  const clamp = (n: number): number => Math.round(Math.min(100, Math.max(0, n)));
  ns.cmyk = cmyk.map(clamp);
  return true;
}

/** Lock (or clear, with null) the swatch at `path`'s named spot/Pantone ink.
 *  Independent of `setSwatchCmykLock` (see its doc comment). */
export function setSwatchSpotLock(doc: unknown, path: string[], spot: SpotColor | null): boolean {
  const leaf = leafAt(doc, path);
  if (!leaf) return false;
  if (spot === null) {
    const ext = isRec(leaf.$extensions) ? (leaf.$extensions as Rec) : null;
    if (ext && isRec(ext[TOKEN_EXT])) { delete (ext[TOKEN_EXT] as Rec).spot; cleanupExt(leaf); }
    return true;
  }
  const ext = (isRec(leaf.$extensions) ? leaf.$extensions : (leaf.$extensions = {} as Rec)) as Rec;
  const ns = (isRec(ext[TOKEN_EXT]) ? ext[TOKEN_EXT] : (ext[TOKEN_EXT] = {} as Rec)) as Rec;
  // Field-by-field, not a spread of `spot`: the extension namespace is written
  // into the persisted brand doc, so only known keys are allowed through. Any
  // new SpotColor field must be added HERE too or it is silently dropped.
  ns.spot = { name: spot.name, ...(spot.book ? { book: spot.book } : {}), ...(spot.finish ? { finish: spot.finish } : {}) };
  return true;
}

/**
 * Add a swatch under the `spectrum` or `custom` colour group, creating the group
 * (and `base.color`, on a multi-set doc) when absent so the very first custom
 * swatch has somewhere to live. Slugs collide-safely. Returns the new leaf's
 * JSON path so the caller can select it.
 *
 * `displayGroup` tags the new leaf's vendor extension with a section heading - 
 * how a per-group "+ Add" on a derived section (Primary/Neutral/Roles…) files a
 * CUSTOM swatch under that heading in the palette grid without pretending it's
 * a derived step (walkSwatches reads the tag back as the swatch's `group`).
 */
export function addSwatch(
  doc: unknown, group: 'spectrum' | 'custom', name: string, hex: string,
  opts: { displayGroup?: string } = {},
): string[] | null {
  if (!isRec(doc)) return null;
  const multiSet = [...SET_KEYS].some(k => k in doc);
  const base = multiSet
    ? (isRec(doc.base) ? doc.base : (doc.base = {} as Rec)) as Rec
    : doc;
  const color = (isRec(base.color) ? base.color : (base.color = { $type: 'color' } as Rec)) as Rec;
  if (!('$type' in color)) color.$type = 'color';
  const bucket = (isRec(color[group]) ? color[group] : (color[group] = {} as Rec)) as Rec;

  const slugBase = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'swatch';
  let slug = slugBase;
  for (let i = 2; slug in bucket; i++) slug = `${slugBase}-${i}`;
  bucket[slug] = {
    $value: hex, $description: name.trim() || prettify(slug), $type: 'color',
    ...(opts.displayGroup ? { $extensions: { [TOKEN_EXT]: { group: opts.displayGroup } } } : {}),
  };
  return [...(multiSet ? ['base'] : []), 'color', group, slug];
}

/**
 * Re-file the swatch at `path` under a display heading - the write behind the
 * bulk bar's "Move to" (plan 182 section 5.5).
 *
 * The SAME `$extensions` vendor tag {@link addSwatch} writes, read back by
 * `walkSwatches` as the swatch's `group`: a move relabels where a tile renders
 * and never what the token is, so a ramp step keeps deriving and a custom
 * swatch keeps its key. `null` drops the tag, sending the swatch back to the
 * heading its path implies. The tag is stored theme-less by contract, so a
 * caller passing a live heading strips the "· Light" suffix first.
 */
export function setSwatchGroup(doc: unknown, path: string[], group: string | null): boolean {
  const leaf = leafAt(doc, path);
  if (!leaf) return false;
  const name = group?.trim() ?? '';
  if (!name) {
    const ext = isRec(leaf.$extensions) ? (leaf.$extensions as Rec) : null;
    if (ext && isRec(ext[TOKEN_EXT])) { delete (ext[TOKEN_EXT] as Rec).group; cleanupExt(leaf); }
    return true;
  }
  const ext = (isRec(leaf.$extensions) ? leaf.$extensions : (leaf.$extensions = {} as Rec)) as Rec;
  const ns = (isRec(ext[TOKEN_EXT]) ? ext[TOKEN_EXT] : (ext[TOKEN_EXT] = {} as Rec)) as Rec;
  ns.group = name;
  return true;
}

// ── Swatch exclusions - "delete" for derived leaves ──────────────────────────
// Derived ramp steps (and the theme roles) are structural: the ramp stays
// derived, so deleting one from the palette means HIDING it, not removing the
// token. The exclusion list is the doc-level `$extensions` vendor entry
// `excluded` - an array of canonical swatch keys (`color.ramp.primary.2`).
// Excluded swatches disappear from the palette grid + picker swatches, while
// the tokens keep resolving (semantic roles and gradient aliases that point at
// an excluded step never dangle). A re-derive carries the list forward but
// clears entries whose step no longer exists (see the editor's derive flow).

/** Add (or, with `excluded: false`, remove) a swatch key on the exclusion list.
 *  An emptied list cleans its `$extensions` entry away entirely. */
export function setSwatchExcluded(doc: unknown, key: string, excluded: boolean): boolean {
  if (!isRec(doc)) return false;
  const cur = getExcludedSwatches(doc);
  const next = excluded ? (cur.includes(key) ? cur : [...cur, key]) : cur.filter(k => k !== key);
  if (!next.length) {
    const ext = isRec(doc.$extensions) ? (doc.$extensions as Rec) : null;
    if (ext && isRec(ext[TOKEN_EXT])) { delete (ext[TOKEN_EXT] as Rec).excluded; cleanupExt(doc); }
    return true;
  }
  const ext = (isRec(doc.$extensions) ? doc.$extensions : (doc.$extensions = {} as Rec)) as Rec;
  const ns = (isRec(ext[TOKEN_EXT]) ? ext[TOKEN_EXT] : (ext[TOKEN_EXT] = {} as Rec)) as Rec;
  ns.excluded = next;
  return true;
}

// ── Per-ramp tonal curve - the editable master behind a ramp's baked steps ────
// A ramp's tonal curve (engine ColorCurve: per-channel L/C/H control points over
// tone position t) rides in the ramp GROUP node's DTCG `$extensions` vendor
// namespace as a serialized ColorCurveJSON OBJECT - the same doc-level pattern
// as `excluded`. The BAKED step literals stay the source of truth for the
// runtime and tools (they read colours, never a curve); the curve is only the
// editor's re-editable superset. A ramp with no stored curve is pure-derive and
// byte-identical to today - nothing here writes a curve until the user edits one.
//
// Group-level `$extensions` is invisible to walkSwatches (its walker skips every
// `$`-prefixed key), so the curve never surfaces as a phantom swatch.

export type RampId = 'primary' | 'neutral' | 'secondary';
/** Per-ramp curves the editor has tuned - sparse: only edited ramps appear. */
export type RampCurves = Partial<Record<RampId, ColorCurve>>;
/** The three ramps a brand derives, in derive order. */
export const RAMP_IDS: readonly RampId[] = ['primary', 'neutral', 'secondary'];

/** JSON path to a ramp's GROUP node - `base.color.ramp.<ramp>` on a multi-set
 *  derived doc, `color.ramp.<ramp>` on a single-set import - multiSet-detected
 *  exactly like primaryAnchorPath. */
function rampGroupPath(doc: unknown, ramp: string): string[] {
  const multiSet = isRec(doc) && [...SET_KEYS].some(k => k in doc);
  return multiSet ? ['base', 'color', 'ramp', ramp] : ['color', 'ramp', ramp];
}

/** A stored curve must at least be a v1 record carrying L/C/H point arrays;
 *  anything else (a hand-edited or truncated doc) reads back as "no curve". */
function isCurveJSON(v: unknown): v is ColorCurveJSON {
  return isRec(v) && (v as Rec).version === 1
    && Array.isArray((v as Rec).L) && Array.isArray((v as Rec).C) && Array.isArray((v as Rec).H);
}

/** The ramp's stored tonal curve (the raw ColorCurveJSON object), or null. */
export function getRampCurve(doc: unknown, ramp: string): ColorCurveJSON | null {
  const group = leafAt(doc, rampGroupPath(doc, ramp));
  const ext = group && isRec(group.$extensions) ? (group.$extensions as Rec)[TOKEN_EXT] : null;
  const curve = isRec(ext) ? (ext as Rec).curve : null;
  return isCurveJSON(curve) ? curve : null;
}

/** Store (or clear, with null) a ramp's tonal curve on its group node's vendor
 *  extension. Written as the serialized ColorCurveJSON OBJECT (installUserTokens
 *  JSON.stringify's the whole doc, so it persists verbatim); cleared with the
 *  same cleanupExt discipline setSwatchExcluded uses, so a removed curve leaves
 *  the group node byte-identical to a ramp that never had one (its `$description`
 *  and steps are untouched). */
export function setRampCurve(doc: unknown, ramp: string, curve: ColorCurve | null): boolean {
  const group = leafAt(doc, rampGroupPath(doc, ramp));
  if (!group) return false;
  if (curve === null) {
    const ext = isRec(group.$extensions) ? (group.$extensions as Rec) : null;
    if (ext && isRec(ext[TOKEN_EXT])) { delete (ext[TOKEN_EXT] as Rec).curve; cleanupExt(group); }
    return true;
  }
  const ext = (isRec(group.$extensions) ? group.$extensions : (group.$extensions = {} as Rec)) as Rec;
  const ns = (isRec(ext[TOKEN_EXT]) ? ext[TOKEN_EXT] : (ext[TOKEN_EXT] = {} as Rec)) as Rec;
  // Store the plain, version-tagged JSON object via the engine's canonical
  // serializer, so a persisted curve round-trips exactly through deserializeCurve.
  ns.curve = JSON.parse(serializeCurve(curve)) as ColorCurveJSON;
  return true;
}

// stepT mirrors color-curve.ts's own control-point placement (one point per
// stop; a single centre step at 0.5 for n === 1), so a curve seeded here samples
// back to the exact stored values at the same length.
const seedStepT = (i: number, n: number): number => (n <= 1 ? 0.5 : i / (n - 1));

/** Seed an editable curve from a ramp's CURRENT step tokens - read at full OKLCH
 *  precision (parseOklch, never a hex round-trip) so re-baking the seed at the
 *  same shade count reproduces a DERIVED ramp byte-for-byte (deriveBrandTokens
 *  emits its step literals with the same formatOklch, and formatOklch∘parseOklch
 *  is a fixed point on that form). Falls back to the engine's defaultColorCurve
 *  (today's derive) only when a ramp has no parseable oklch() steps. */
export function seedRampCurve(doc: unknown, ramp: string, steps: number): ColorCurve {
  const group = leafAt(doc, rampGroupPath(doc, ramp));
  const stops: Oklch[] = [];
  if (group) {
    const keys = Object.keys(group).filter(k => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
    for (const k of keys) {
      const leaf = group[String(k)];
      const val = isRec(leaf) ? (leaf as Rec).$value : null;
      const c = typeof val === 'string' ? parseOklch(val) : null;
      if (c) stops.push(c);
    }
  }
  if (stops.length) {
    const n = stops.length;
    const L: CurvePoint[] = [], C: CurvePoint[] = [], H: CurvePoint[] = [];
    for (let i = 0; i < n; i++) {
      const t = seedStepT(i, n);
      L.push({ t, v: stops[i]!.l });
      C.push({ t, v: stops[i]!.c });
      H.push({ t, v: stops[i]!.h });
    }
    return { L: { points: L }, C: { points: C }, H: { points: H } };
  }
  // No oklch steps to seed from → today's derive from a neutral mid-tone (a
  // defensive edge only; a real derived/installed ramp always parses).
  return defaultColorCurve({ l: 0.62, c: 0.12, h: 250 }, Math.max(1, Math.floor(steps)));
}

const clamp01Curve = (n: number): number => Math.min(1, Math.max(0, n));
const wrap360 = (h: number): number => ((h % 360) + 360) % 360;

/** Shift a curve by the primary's per-channel delta (pOld → pNew) - the
 *  re-anchor a primary edit runs when a ramp already carries a hand-tuned curve,
 *  so the curve TRACKS the new brand colour instead of being silently dropped
 *  (the user gets an explicit "Rebuild from colour" to return to the pure
 *  derive). H is an additive rotation mod 360 - a wrap across 0° is handled by
 *  the arithmetic itself, so the choice of delta representative is immaterial; L
 *  is additive, clamped to [0,1]; C is additive, clamped to ≥ 0. Any resulting
 *  out-of-gamut stop is the bake's problem (oklchToHex gamut-maps), not this
 *  shift's. */
export function reanchorCurve(curve: ColorCurve, pOld: Oklch, pNew: Oklch): ColorCurve {
  const dL = pNew.l - pOld.l, dC = pNew.c - pOld.c, dH = pNew.h - pOld.h;
  return {
    L: { points: curve.L.points.map(p => ({ t: p.t, v: clamp01Curve(p.v + dL) })) },
    C: { points: curve.C.points.map(p => ({ t: p.t, v: Math.max(0, p.v + dC) })) },
    H: { points: curve.H.points.map(p => ({ t: p.t, v: wrap360(p.v + dH) })) },
  };
}

/**
 * Rotate a ramp's whole tonal curve bodily around the hue wheel - shift EVERY H
 * control point by `degrees` (wrapped mod 360), leaving L and C untouched. The
 * shell dual of the engine's `rotateRampHue` (which rotates a baked ramp's hex
 * stops): this rotates the editable master so the rotation persists and stays
 * hand-editable afterwards. One control point per existing point - no resample,
 * so the curve's shape is unchanged, only its hues turn. Gamut is the bake's
 * problem (`oklchToHex` gamut-maps at emit time), exactly like `rotateRampHue`.
 *
 * Pure: a fresh curve is returned, the input never mutated. A ±360° rotation is
 * an identity on the control points (wrap360 is a fixed point at full turns), so
 * the transform composes cleanly and undoes exactly.
 */
export function rotateCurveHue(curve: ColorCurve, degrees: number): ColorCurve {
  return {
    L: { points: curve.L.points.map(p => ({ t: p.t, v: p.v })) },
    C: { points: curve.C.points.map(p => ({ t: p.t, v: p.v })) },
    H: { points: curve.H.points.map(p => ({ t: p.t, v: wrap360(p.v + degrees) })) },
  };
}

/**
 * Apply per-ramp tonal curves onto a doc IN PLACE - the editor's authority seam.
 * For each EDITED ramp: regenerate its oklch() step literals from the curve
 * (sampleCurve → formatOklch, the identical literal form deriveBrandTokens
 * emits) and re-stamp the curve extension so a persist / re-derive carries it.
 *
 * A ramp with NO curve is skipped entirely, so an empty `curves` map is a
 * deep-equal no-op and a curve-less brand stays BYTE-IDENTICAL to today's pure
 * derive - the essential guarantee. `steps` sets how many literals are baked;
 * the CURVE is the master and is resampled to that count (curve resolution is
 * independent of the shade count).
 */
export function overlayRampCurves(doc: unknown, curves: RampCurves, steps: number): void {
  const n = Math.max(1, Math.floor(steps));
  for (const ramp of RAMP_IDS) {
    const curve = curves[ramp];
    if (!curve) continue; // untouched ramp → pure derive (byte-identical no-op)
    const group = leafAt(doc, rampGroupPath(doc, ramp));
    if (!group) continue;
    const stops = sampleCurve(curve, n);
    for (let i = 0; i < n; i++) {
      const leaf = group[String(i + 1)];
      const stop = stops[i];
      if (isRec(leaf) && stop) (leaf as Rec).$value = formatOklch(stop);
    }
    setRampCurve(doc, ramp, curve); // re-stamp so the curve survives persist + re-derive
  }
}

// ── Contrast-lock - a CURVE TRANSFORM, not a parallel ramp system ─────────────
// "Contrast-lock" retones a ramp so each step hits a per-step APCA target against
// a background, KEEPING that step's hue and chroma. It PRODUCES an ordinary
// ColorCurve, which the editor then hands to the exact same machinery every other
// curve rides (setRampCurve / overlayRampCurves / reanchorCurve / the curve
// editor) - a one-shot transform, hand-editable and persisted afterwards like any
// curve. The target math is shared verbatim with the Palette Lab tool
// (community/color-palette/hooks.js `_targets`/`_fitTargets`/`_parseLc`) so both
// surfaces agree on what "even / text-first / ui" means.

/** The kind of contrast-lock target span. */
export type ContrastLockPreset = 'even' | 'text' | 'ui';

// Each preset is a [lowLc, highLc] APCA-Lc span sampled dark→light across the
// ramp. Identical to color-palette/hooks.js `CURVES`: 'even' spreads the whole
// legibility range, 'text' keeps every step body-readable, 'ui' stays in the
// non-text band for borders/fills/disabled states.
const CONTRAST_LOCK_SPANS: Record<ContrastLockPreset, readonly [number, number]> = {
  even: [15, 90],
  text: [45, 100],
  ui: [8, 66],
};

// One-decimal rounding - hooks.js `_r1`, kept so the numbers match to the digit.
const lcRound1 = (n: number): number => Math.round(n * 10) / 10;

/** A comma list of Lc magnitudes → a clean numeric array (blank/junk dropped).
 *  Mirrors color-palette/hooks.js `_parseLc`. */
function parseLcTargets(s: string): number[] {
  if (s == null) return [];
  return String(s).split(',')
    .map(x => Number(String(x).trim()))
    .filter(n => Number.isFinite(n) && n >= 0);
}

/** Resample an arbitrary target list to exactly `steps` entries by linear
 *  interpolation (a single value fills every step; an exact-length list is
 *  unchanged). Mirrors color-palette/hooks.js `_fitTargets`. */
function fitLcTargets(list: number[], steps: number): number[] {
  if (list.length === 1) {
    const flat: number[] = [];
    for (let i = 0; i < steps; i++) flat.push(list[0]!);
    return flat;
  }
  const out: number[] = [];
  for (let j = 0; j < steps; j++) {
    const t = steps <= 1 ? 0 : j / (steps - 1);
    const pos = t * (list.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(list.length - 1, lo + 1);
    out.push(lcRound1(list[lo]! + (list[hi]! - list[lo]!) * (pos - lo)));
  }
  return out;
}

/**
 * The per-step APCA-Lc target array: a non-empty `custom` comma list wins (parsed
 * + linearly resampled to `steps`), else the named `preset` span sampled dark→
 * light across `steps`. Kept in exact step with color-palette/hooks.js `_targets`
 * so the brand editor's contrast-lock and the Palette Lab tool speak the same
 * numbers.
 */
export function contrastTargets(preset: ContrastLockPreset, steps: number, custom = ''): number[] {
  const n = Math.max(1, Math.floor(steps));
  // "non-empty custom wins, else the preset" - the ONE place this corrects a
  // latent tool bug: hooks.js `_parseLc('')` returns [0] (because Number('') === 0),
  // so the tool's own default empty `lcTargets` would zero every step. The tool's
  // help ("Overrides the curve when set") intends empty → preset, so guard it here.
  // Everything numeric below stays byte-identical to `_parseLc`/`_fitTargets`.
  const trimmed = (custom ?? '').trim();
  const list = trimmed ? parseLcTargets(trimmed) : [];
  if (list.length) return fitLcTargets(list, n);
  const ends = CONTRAST_LOCK_SPANS[preset] ?? CONTRAST_LOCK_SPANS.even;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = n <= 1 ? 0 : i / (n - 1);
    out.push(lcRound1(ends[0] + (ends[1] - ends[0]) * t));
  }
  return out;
}

/** The result of a contrast-lock: the retoned ColorCurve plus how many steps
 *  could NOT reach their target (the solver capped them at the closest tone). */
export interface ContrastLockResult {
  curve: ColorCurve;
  /** Count of steps whose target magnitude exceeded what that hue/chroma can
   *  carry on the background - the solver returned `reachable === false`. */
  unreachable: number;
}

/**
 * Retone `current` so each of its `steps` stops hits `targets[i]` APCA-Lc against
 * `bgHex`, KEEPING that stop's hue and chroma. Samples `current` to `steps` OKLCH
 * stops (engine `sampleCurve`) and, per stop, inverts APCA via
 * `solveLightnessForApca(stop.h, stop.c, targets[i], bgHex)` - using the solver's
 * returned `{l, chroma, hue}` (already gamut-clamped at the solved lightness) - 
 * then assembles an ordinary ColorCurve (one control point per step at t = i/(n-1),
 * a single centre at 0.5 for n === 1, matching `seedRampCurve`'s `seedStepT`).
 *
 * The result is just a curve: the caller sets it as the ramp's curve and it
 * behaves like any other (drag, re-anchor, Rebuild-from-colour) from then on.
 */
export function contrastLockCurve(
  current: ColorCurve, steps: number, targets: number[], bgHex: string,
): ContrastLockResult {
  const n = Math.max(1, Math.floor(steps));
  const stops = sampleCurve(current, n);
  const L: CurvePoint[] = [], C: CurvePoint[] = [], H: CurvePoint[] = [];
  let unreachable = 0;
  const lastTarget = targets.length ? targets[targets.length - 1]! : 0;
  for (let i = 0; i < n; i++) {
    const stop = stops[i] ?? { l: 0.5, c: 0, h: 0 };
    const target = targets[i] ?? lastTarget;
    const r = solveLightnessForApca(stop.h, stop.c, target, bgHex);
    if (!r.reachable) unreachable++;
    const t = seedStepT(i, n);
    L.push({ t, v: r.l });
    C.push({ t, v: r.chroma });
    H.push({ t, v: r.hue });
  }
  return { curve: { L: { points: L }, C: { points: C }, H: { points: H } }, unreachable };
}

// ── Keyboard channel nudging (palette grid) ─────────────────────────────────────

/** One arrow-press step per OKLCH channel - the huetone-style nudge the palette
 *  grid drives from the keyboard. Shift multiplies these by {@link NUDGE_BIG}. */
export const NUDGE_STEP: Record<'L' | 'C' | 'H', number> = { L: 0.02, C: 0.01, H: 2 };
/** Shift-held multiplier - a coarse jump for getting close fast. */
export const NUDGE_BIG = 5;

/**
 * Nudge one OKLCH channel of a hex colour by one keyboard step and return the
 * resulting hex - the pure maths behind the palette grid's L/C/H arrow-nudging.
 *
 *   hexToOklch → step the armed channel → clipToGamut('srgb') → oklchToHex
 *
 * L is clamped to [0,1] and C to ≥0; H WRAPS at 360 (it is cyclic, unlike a
 * curve-editor control point on a bounded 0–360 axis). Alpha rides through
 * untouched (clipToGamut and oklchToHex both preserve it), so a translucent
 * brand swatch stays translucent. An unparseable hex is returned unchanged, so
 * a caller can nudge unconditionally.
 *
 * The result is always in sRGB - clipToGamut holds L and H and gives up chroma,
 * and oklchToHex gamut-maps whatever remains - so a nudged swatch is a real,
 * displayable colour every step of the way.
 */
export function nudgeSwatch(hex: string, channel: 'L' | 'C' | 'H', dir: 1 | -1, big: boolean): string {
  const o = hexToOklch(hex);
  if (!o) return hex;
  const step = NUDGE_STEP[channel] * (big ? NUDGE_BIG : 1) * dir;
  const next: Oklch = { ...o };
  if (channel === 'L') next.l = Math.min(1, Math.max(0, o.l + step));
  else if (channel === 'C') next.c = Math.max(0, o.c + step);
  else next.h = ((o.h + step) % 360 + 360) % 360;
  // clipToGamut spreads its input, so alpha survives even though its return type
  // is {l,c,h}; layer it back over `next` to keep the type an Oklch for oklchToHex.
  const clipped = clipToGamut(next, 'srgb');
  return oklchToHex({ ...next, ...clipped });
}
