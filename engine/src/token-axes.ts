// SPDX-License-Identifier: MPL-2.0
/**
 * Theme groups and what they mean (plans/319).
 *
 * A Tokens Studio `$themes` array lists options, each with an optional `group`
 * string. There is no group object, so a group's meaning travels on its entries:
 *
 *   { "name": "Persimmon", "group": "colourway", "selectedTokenSets": { ... },
 *     "$extensions": { "com.suse.lolly": { "axis": { "kind": "colourway" } } } }
 *
 * `kind` and `rotation` describe the whole group and every entry that states them
 * must agree. `canonical` and `window` describe one option. A document whose theme
 * entries cannot carry extensions may state the group facts once at its root:
 *
 *   "$extensions": { "com.suse.lolly": { "themeAxes": {
 *     "colourway": { "kind": "colourway", "canonical": "pine", "rotation": "cycle" } } } }
 *
 * An entry's own annotation wins over the root, and a disagreement is reported.
 * `lock` is reserved for a later version and is kept in the source untouched.
 *
 * Pure and bounded: the document is never modified, and only the first 512 theme
 * entries are read, matching the selection resolver.
 */
import { TOKEN_AXIS_KINDS } from '@lolly-tools/core/host-v1';
import type { TokenAxisKind, TokenDiagnostic } from './bridge/host-v1.ts';
import { TOKEN_EXT } from './token-ext.ts';

type Rec = Record<string, unknown>;
const record = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);

/** How a series picks a colourway for each new artefact. See `pickColourway` in colourway.ts. */
export type RotationPolicy = 'canonical' | 'cycle' | 'by-key' | 'shuffle' | 'by-date';
export const ROTATION_POLICIES: readonly RotationPolicy[] = Object.freeze(['canonical', 'cycle', 'by-key', 'shuffle', 'by-date']);

/** An option's date window, inclusive at both ends, as ISO dates (`2026-12-01`). */
export interface AxisWindow { from?: string; to?: string }

export interface TokenAxisOption {
  id: string;
  name: string;
  canonical: boolean;
  window?: AxisWindow;
}

export interface TokenAxis {
  /** The source group id; `''` for themes with no group. */
  group: string;
  /** The declared kind, or null when the group declares none. */
  kind: TokenAxisKind | null;
  /** The canonical option's id: the one marked canonical, else the first authored. */
  canonical: string;
  /** The group's default rotation policy, or null when none is declared. */
  rotation: RotationPolicy | null;
  /** Options in authored order. */
  options: TokenAxisOption[];
}

/** One `$themes` entry, as the resolver reads the entry. `raw` is the source object, never copied. */
export interface ThemeEntry { id: string; name: string; raw: Rec }

export const MAX_THEME_ENTRIES = 512;

/** A group id as people read it in a message. */
export const groupLabel = (group: string): string => group || 'Themes';

/**
 * The document's theme entries grouped by `group`, in authored order. Entries with
 * no id or name, and duplicate ids within a group, are skipped and reported.
 */
export function parseThemeGroups(doc: unknown): { groups: Map<string, ThemeEntry[]>; diagnostics: TokenDiagnostic[] } {
  const diagnostics: TokenDiagnostic[] = [];
  const issue = (message: string): void => { diagnostics.push({ code: 'selection', path: '', message }); };
  const raw = record(doc) && Array.isArray(doc.$themes) ? doc.$themes : [];
  if (raw.length > MAX_THEME_ENTRIES) diagnostics.push({ code: 'limit', path: '', message: `Only the first ${MAX_THEME_ENTRIES} themes were inspected.` });
  const groups = new Map<string, ThemeEntry[]>();
  for (const t of raw.slice(0, MAX_THEME_ENTRIES)) {
    if (!record(t)) continue;
    const group = typeof t.group === 'string' ? t.group : '';
    const id = typeof t.id === 'string' ? t.id : typeof t.name === 'string' ? t.name : '';
    if (!id) { issue('A theme has no id or name.'); continue; }
    const list = groups.get(group) ?? [];
    if (list.some(o => o.id === id)) { issue(`Duplicate theme id ${id} in ${groupLabel(group)}.`); continue; }
    list.push({ id, name: typeof t.name === 'string' ? t.name : id, raw: t });
    groups.set(group, list);
  }
  return { groups, diagnostics };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:$|T)/;

function readWindow(v: unknown, where: string, issue: (code: TokenDiagnostic['code'], message: string) => void): AxisWindow | undefined {
  if (v === undefined) return undefined;
  if (!record(v)) { issue('type', `${where} has a window that is not an object; it is ignored.`); return undefined; }
  const out: AxisWindow = {};
  for (const end of ['from', 'to'] as const) {
    const value = v[end];
    if (value === undefined) continue;
    if (typeof value !== 'string' || !ISO_DATE.test(value)) { issue('type', `${where} has a window ${end} that is not an ISO date; that end is ignored.`); continue; }
    out[end] = value.slice(0, 10);
  }
  if (out.from && out.to && out.from > out.to) { issue('type', `${where} has a window that ends before it starts; it is ignored.`); return undefined; }
  return out.from || out.to ? out : undefined;
}

/** The `axis` object on one theme entry, or undefined. */
function entryAxis(raw: Rec): Rec | undefined {
  const ext = record(raw.$extensions) ? raw.$extensions[TOKEN_EXT] : undefined;
  return record(ext) && record(ext.axis) ? ext.axis : undefined;
}

/** The root `themeAxes` map, or an empty object. */
function rootAxes(doc: unknown): Rec {
  const ext = record(doc) && record(doc.$extensions) ? doc.$extensions[TOKEN_EXT] : undefined;
  return record(ext) && record(ext.themeAxes) ? ext.themeAxes : {};
}

/**
 * Each group's meaning, read from its entries and the root fallback. A group with
 * no annotation gets `kind: null`, `rotation: null` and its first option as
 * canonical, which is exactly how every group behaved before kinds existed.
 */
export function describeAxes(doc: unknown, groups: Map<string, ThemeEntry[]>): { axes: TokenAxis[]; diagnostics: TokenDiagnostic[] } {
  const diagnostics: TokenDiagnostic[] = [];
  const issue = (code: TokenDiagnostic['code'], message: string): void => { diagnostics.push({ code, path: '', message }); };
  const root = rootAxes(doc);
  const axes: TokenAxis[] = [];
  for (const [group, entries] of groups) {
    const label = groupLabel(group);
    const fallback = record(root[group]) ? root[group] as Rec : {};
    let kind: TokenAxisKind | null = null;
    let rotation: RotationPolicy | null = null;
    let kindFrom = '', rotationFrom = '';
    const takeKind = (v: unknown, from: string): void => {
      if (v === undefined) return;
      if (typeof v !== 'string') { issue('type', `${from} declares a kind that is not text; it is ignored.`); return; }
      if (!(TOKEN_AXIS_KINDS as readonly string[]).includes(v)) { issue('unsupported', `${from} declares the kind ${v}, which this version does not know; ${label} is treated as a plain theme group.`); return; }
      if (kind === null) { kind = v as TokenAxisKind; kindFrom = from; return; }
      if (kind !== v) issue('selection', `${from} declares the kind ${v} but ${kindFrom} declares ${kind}; ${kind} is effective.`);
    };
    const takeRotation = (v: unknown, from: string): void => {
      if (v === undefined) return;
      if (typeof v !== 'string' || !(ROTATION_POLICIES as readonly string[]).includes(v)) { issue('unsupported', `${from} declares a rotation this version does not know; it is ignored.`); return; }
      if (rotation === null) { rotation = v as RotationPolicy; rotationFrom = from; return; }
      if (rotation !== v) issue('selection', `${from} declares the rotation ${v} but ${rotationFrom} declares ${rotation}; ${rotation} is effective.`);
    };
    const options: TokenAxisOption[] = [];
    for (const entry of entries) {
      const axis = entryAxis(entry.raw);
      const where = `The theme ${entry.name} in ${label}`;
      if (axis) { takeKind(axis.kind, where); takeRotation(axis.rotation, where); }
      const option: TokenAxisOption = { id: entry.id, name: entry.name, canonical: axis?.canonical === true };
      const window = axis ? readWindow(axis.window, where, issue) : undefined;
      if (window) option.window = window;
      options.push(option);
    }
    takeKind(fallback.kind, `The document's axis entry for ${label}`);
    takeRotation(fallback.rotation, `The document's axis entry for ${label}`);
    const marked = options.filter(o => o.canonical);
    if (marked.length > 1) issue('selection', `${label} marks ${marked.length} themes as canonical; ${marked[0]!.name} is effective.`);
    let canonical = marked[0]?.id;
    if (!canonical && typeof fallback.canonical === 'string') {
      if (options.some(o => o.id === fallback.canonical)) canonical = fallback.canonical;
      else issue('selection', `The document's axis entry for ${label} names the canonical theme ${fallback.canonical}, which ${label} does not declare.`);
    }
    canonical ??= options[0]!.id;
    for (const o of options) o.canonical = o.id === canonical;
    axes.push({ group, kind, canonical, rotation, options });
  }
  return { axes, diagnostics };
}

/** Every theme group in the document with its meaning, plus what was wrong with the annotations. */
export function readTokenAxes(doc: unknown): { axes: TokenAxis[]; diagnostics: TokenDiagnostic[] } {
  const parsed = parseThemeGroups(doc);
  const described = describeAxes(doc, parsed.groups);
  return { axes: described.axes, diagnostics: [...parsed.diagnostics, ...described.diagnostics] };
}

/** The first group of a kind, or null. A second group of the same kind is ignored here; `readTokenAxes` lists every group. */
export function axisOfKind(axes: readonly TokenAxis[], kind: TokenAxisKind): TokenAxis | null {
  return axes.find(a => a.kind === kind) ?? null;
}

/**
 * The group that holds light and dark: the one declared `mode`, else the
 * ungrouped `''` group when it declares no other kind. Every pack Lolly ships, and
 * every document the studio writes before plans/319, keeps light and dark there.
 */
export function modeAxis(axes: readonly TokenAxis[]): TokenAxis | null {
  return axisOfKind(axes, 'mode') ?? axes.find(a => a.group === '' && a.kind === null) ?? null;
}
