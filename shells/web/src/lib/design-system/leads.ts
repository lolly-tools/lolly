// SPDX-License-Identifier: MPL-2.0
/**
 * Leads: the Brand Studio's view of a design system's colourways (plans/319 A2).
 *
 * Every word a person reads says colourway. The studio's code calls the colour
 * that fills the primary role in one colourway its LEAD, because that is the
 * thing the Colours room edits. One lead is canonical: the colourway an artefact
 * uses when it chooses none, the one the app's own colours follow, and the one
 * Rebuild palette re-derives from the starting colour.
 *
 * The encoding is the engine's (engine/src/colourway.ts): each colourway turns on
 * one set, `colourway/<id>`, holding `color.colourway.<mode>.<role>`, and the
 * light and dark sets link `color.semantic.<role>` to those paths. So a role a
 * colourway re-points has TWO addresses: the mode's slot, which is a link every
 * lead shares, and the lead's own primitive, which holds the colour. A studio
 * write must go to the second; writing a colour into the first would cut every
 * lead loose from that role in that mode. `leadSlotPath` is the one place that
 * maps the first address to the second, and roles.ts and brand-doc.ts both call
 * `leadSlotPath` for that.
 *
 * THE EDITING CONTEXT. A studio surface edits one lead in one mode at a time,
 * `{ lead, mode }`. A null or unknown `lead` means the canonical lead, so a
 * surface that knows nothing about leads (every one written before plans/319)
 * edits exactly what it edited before, and on a design system with one lead the
 * context changes nothing at all. A bare string is shorthand for `{ mode }`.
 *
 * Pure and DOM-free: every edit is an engine function that clones the document
 * and checks, before and after, that nothing an existing choice draws has moved.
 */
import {
  COLOURWAY_GROUP, COLOURWAY_ROLES, addColourway, canonicalFirst, colorToHex, colourwayAxis, colourwayPath,
  colourwayRolesOf, colourwaysEditable, createTokenSet, deriveColourwaySlots, duplicateColourway,
  isAlias, liftToColourways, modeAxis, readTokenAxes, removeColourway, renameColourway,
  reorderColourways, setCanonicalColourway, TOKEN_EXT,
} from '@lolly/engine';
import type { BrandDeriveOptions, ColourwayEdit, ColourwayRole, ColourwayValues, TokenAxis } from '@lolly/engine';
import type { TokenResolveOptions, TokenSet } from '@lolly-tools/core/host-v1';
import { nameColor } from '../color-namer.ts';

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

// ── The editing context ──────────────────────────────────────────────────────

/** One lead in one mode: what a studio surface reads and writes. */
export interface EditContext {
  /** The colourway option id, or null for the canonical lead. */
  lead?: string | null;
  /** The light/dark theme id (`light`, `dark`). */
  mode: string;
}

/** What callers may hand in: a context, a bare mode, or nothing (light). */
export type EditContextInput = EditContext | string | null | undefined;

/** A whole context from any input. `mode` fills in a missing mode. */
export function editContextOf(input: EditContextInput, mode = 'light'): EditContext {
  if (typeof input === 'string') return { lead: null, mode: input || mode };
  if (isRec(input)) return { lead: typeof input.lead === 'string' ? input.lead : null, mode: typeof input.mode === 'string' && input.mode ? input.mode : mode };
  return { lead: null, mode };
}

/** Does the document have colourways at all? */
export const hasLeads = (doc: unknown): boolean => colourwayAxis(doc) !== null;

/** The lead a context names: that option when the document has it, else the canonical one. Null without colourways. */
export function resolveLead(doc: unknown, lead?: string | null): string | null {
  const axis = colourwayAxis(doc);
  if (!axis) return null;
  return lead && axis.options.some(o => o.id === lead) ? lead : axis.canonical;
}

/**
 * Token read options for one lead in one mode. Without colourways this is
 * `{ theme: mode }`, byte for byte what the studio passed before leads existed.
 * With them, the colourway group is pinned to the lead, so a stored choice (the
 * render surface writes the route's `_themes` into the document) can never make
 * the studio show a different lead from the one it edits. The document's other
 * stored choices are kept.
 */
export function leadSelection(doc: unknown, ctx: EditContextInput): TokenResolveOptions {
  const { mode, lead } = editContextOf(ctx);
  const axis = colourwayAxis(doc);
  if (!axis) return { theme: mode };
  const meta = isRec(doc) && isRec(doc.$metadata) ? doc.$metadata : null;
  const stored = meta && isRec(meta.activeThemeSelection) ? meta.activeThemeSelection : {};
  const kept = Object.fromEntries(Object.entries(stored).filter((e): e is [string, string] => typeof e[1] === 'string'));
  return { theme: mode, selection: { ...kept, [axis.group]: resolveLead(doc, lead)! } };
}

/** A token set for one lead in one mode. */
export function leadTokenSet(doc: unknown, ctx: EditContextInput): TokenSet {
  return createTokenSet(doc, leadSelection(doc, ctx));
}

// ── Where a lead keeps its colours ───────────────────────────────────────────

const enabledSets = (entry: Rec): string[] =>
  isRec(entry.selectedTokenSets)
    ? Object.entries(entry.selectedTokenSets).filter(([, status]) => status && status !== 'disabled').map(([set]) => set)
    : [];
const groupOf = (t: Rec): string => (typeof t.group === 'string' ? t.group : '');
const optionIdOf = (t: Rec): string => (typeof t.id === 'string' ? t.id : typeof t.name === 'string' ? t.name : '');
const themeEntries = (doc: unknown): Rec[] => (isRec(doc) && Array.isArray(doc.$themes) ? doc.$themes.filter(isRec) : []);

/** The one set a lead turns on, or null when it turns on none or several (an encoding Lolly does not write). */
function leadSetOf(doc: unknown, axis: TokenAxis, lead: string): string | null {
  const entry = themeEntries(doc).find(t => groupOf(t) === axis.group && optionIdOf(t) === lead);
  const sets = entry ? enabledSets(entry) : [];
  return sets.length === 1 && isRec((doc as Rec)[sets[0]!]) ? sets[0]! : null;
}

/**
 * Every set the colourways turn on, except a set some other theme also turns on.
 * These hold one lead's colours each, so the palette walkers never list their
 * leaves as tiles: a role reaches them through `leadSlotPath` instead.
 */
export function colourwaySetsOf(doc: unknown): Set<string> {
  const axis = colourwayAxis(doc);
  if (!axis) return new Set();
  const entries = themeEntries(doc);
  const mine = new Set(entries.filter(t => groupOf(t) === axis.group).flatMap(enabledSets));
  for (const t of entries) if (groupOf(t) !== axis.group) for (const set of enabledSets(t)) mine.delete(set);
  return mine;
}

/** Is this dotted key one lead's own colour (`color.colourway.light.primary`) rather than a palette colour? */
export const isColourwayKey = (key: string): boolean => /^color\.colourway\./.test(key);

/**
 * A resolved colour list (`host.tokens.colors()`) without the leads' own
 * colours. The canonical lead's set is on by default, so its colours ride the
 * list beside the roles they fill; they are a lead's roles, not swatches to
 * pick from or count.
 */
export function withoutLeadColours<T extends { path?: string }>(list: readonly T[]): T[] {
  return list.filter(c => !isColourwayKey(c.path ?? ''));
}

const LINK = /^\{\s*color\.colourway\.([^.{}\s]+)\.([^.{}\s]+)\s*\}$/;

/** Is a slot's stored value the colourway link for this role (`{color.colourway.<mode>.<role>}`)? */
export function isColourwayLink(value: unknown, role: string): boolean {
  if (typeof value !== 'string') return false;
  const m = LINK.exec(value.trim());
  return !!m && m[2] === role;
}

/**
 * The JSON key path of the colour a mode's slot links to, for one lead: the
 * mode's `color.semantic.<role>` holds `{color.colourway.<mode>.<role>}`, and
 * this answers `[<lead's set>, 'color', 'colourway', <mode>, <role>]`. Null when
 * the slot is not that link, or when the lead has no single set of its own (a
 * file that encodes colourways its own way). A caller that gets null for a
 * value `isColourwayLink` accepts must treat the slot as read-only.
 */
export function leadSlotPath(doc: unknown, slotValue: unknown, role: string, lead?: string | null): string[] | null {
  if (!isColourwayLink(slotValue, role)) return null;
  const axis = colourwayAxis(doc);
  if (!axis) return null;
  const set = leadSetOf(doc, axis, resolveLead(doc, lead)!);
  if (!set) return null;
  const mode = LINK.exec((slotValue as string).trim())![1]!;
  return [set, 'color', 'colourway', mode, role];
}

/**
 * Lead × mode to token path: where one role's colour lives for one lead in one
 * mode, as a JSON key path (`[set, 'color', 'colourway', mode, role]`). Null
 * when the role is not one the colourways re-point (it lives in the mode's own
 * set, where roles.ts finds it), or when the lead has no single set of its own.
 */
export function leadRolePath(doc: unknown, role: string, ctx: EditContextInput): string[] | null {
  const axis = colourwayAxis(doc);
  if (!axis || !colourwayRolesOf(doc).includes(role as ColourwayRole)) return null;
  const { mode, lead } = editContextOf(ctx);
  const set = leadSetOf(doc, axis, resolveLead(doc, lead)!);
  return set ? [set, ...colourwayPath(mode, role).split('.')] : null;
}

// ── Reading ──────────────────────────────────────────────────────────────────

/** One lead's colours in one mode, as hex. '' for a role that does not resolve. */
export interface LeadColours {
  primary: string;
  'on-primary': string;
  secondary: string;
  /** Present when the colourways re-point the surface. */
  surface?: string;
}

export interface Lead {
  id: string;
  name: string;
  canonical: boolean;
  /** The set holding this lead's colours, or null on a file that encodes colourways its own way. */
  set: string | null;
  /** Colours per mode id. */
  colours: Record<string, LeadColours>;
}

/** The light/dark looks a lead has colours for, in authored order. */
export function leadModes(doc: unknown): Array<{ id: string; name: string }> {
  return (modeAxis(readTokenAxes(doc).axes)?.options ?? []).map(o => ({ id: o.id, name: o.name }));
}

const hexOf = (v: unknown): string => {
  const hex = colorToHex(v);
  return typeof hex === 'string' && hex.startsWith('#') ? hex : '';
};

/**
 * Every lead, canonical first, with its colours in every mode. Read through the
 * semantic slots, so a file that encodes its colourways its own way lists its
 * leads too. Empty when the document has no colourways.
 */
export function listLeads(doc: unknown): Lead[] {
  const axis = colourwayAxis(doc);
  if (!axis) return [];
  const modes = leadModes(doc);
  const tinted = colourwayRolesOf(doc).includes('surface');
  return canonicalFirst(axis).map(option => {
    const colours: Record<string, LeadColours> = {};
    for (const mode of modes) {
      const set = leadTokenSet(doc, { lead: option.id, mode: mode.id });
      const read = (role: string): string => hexOf(set.resolve(`color.semantic.${role}`));
      colours[mode.id] = { primary: read('primary'), 'on-primary': read('on-primary'), secondary: read('secondary'), ...(tinted ? { surface: read('surface') } : {}) };
    }
    return { id: option.id, name: option.name, canonical: option.canonical, set: leadSetOf(doc, axis, option.id), colours };
  });
}

/** The canonical lead, or null when the document has no colourways. */
export const canonicalLead = (doc: unknown): Lead | null => listLeads(doc)[0] ?? null;

/**
 * Can the studio edit leads in this document, and if not, why not. A document
 * with one lead answers with whether the studio's own lift (`liftLeads`, which
 * picks an id no theme uses) would succeed, so the room can say why before a
 * person tries to add a second lead.
 */
export function leadsEditable(doc: unknown): { ok: true } | { ok: false; reasons: string[] } {
  if (hasLeads(doc)) return colourwaysEditable(doc);
  const lifted = liftLeads(doc);
  return lifted.ok ? { ok: true } : { ok: false, reasons: lifted.reasons };
}

// ── Names and ids ────────────────────────────────────────────────────────────

/** Every theme id and name in the document, lower-cased: what a new name or id must avoid. */
function takenNames(doc: unknown): Set<string> {
  return new Set(themeEntries(doc).flatMap(t => [t.id, t.name]).filter((v): v is string => typeof v === 'string').map(v => v.trim().toLowerCase()));
}

/** `name`, or `name 2`, `name 3`... whichever no theme in the document uses yet. */
export function uniqueLeadName(doc: unknown, name: string): string {
  const base = name.trim() || 'Colourway';
  const taken = takenNames(doc);
  if (!taken.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base} ${i}`.toLowerCase())) return `${base} ${i}`;
}

/** A permanent id from a display name: lowercase letters, digits and hyphens, unused by any theme. */
export function uniqueLeadId(doc: unknown, name: string): string {
  const slug = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'lead';
  const taken = takenNames(doc);
  if (!taken.has(slug)) return slug;
  for (let i = 2; ; i++) if (!taken.has(`${slug}-${i}`)) return `${slug}-${i}`;
}

/** The canonical lead's default name before there are leads: the name of the primary colour. */
function defaultCanonicalName(doc: unknown): string {
  const hex = hexOf(createTokenSet(doc, { theme: 'light' }).resolve('color.semantic.primary'));
  return hex ? nameColor(hex) : 'Main';
}

// ── Editing ──────────────────────────────────────────────────────────────────

/** An edit's result. `id` is the lead an add or a copy created. */
export type LeadEdit = { ok: true; doc: Rec; id?: string } | { ok: false; reasons: string[] };

export interface LiftLeadOptions { id?: string; name?: string }

/**
 * Turn a single-lead design system into one with a canonical lead, ready for a
 * second. The canonical lead is named after its primary colour unless a name is
 * given. Nothing any look resolves to changes (the engine checks). A document
 * that already has colourways comes back as an unchanged copy.
 */
export function liftLeads(doc: unknown, opts: LiftLeadOptions = {}): ColourwayEdit {
  if (colourwayAxis(doc)) return liftToColourways(doc);
  const name = opts.name?.trim() || uniqueLeadName(doc, defaultCanonicalName(doc));
  return liftToColourways(doc, { id: opts.id ?? uniqueLeadId(doc, name), name });
}

export interface AddLeadOptions {
  /** The new lead colour, in any notation the engine parses. */
  colour: string;
  /** Display name. Default: the colour's name. */
  name?: string;
  /** Permanent id. Default: from the name. */
  id?: string;
  /** Derivation controls for the on-lead and partner, as the Generate wing sets them. */
  scheme?: BrandDeriveOptions['scheme'];
  contrast?: BrandDeriveOptions['contrast'];
  foreground?: BrandDeriveOptions['foreground'];
  /** Ramp division count. Default: the document's own primary ramp's step count. */
  steps?: number;
  /** The canonical lead's id and name when the document still has one lead. */
  canonical?: LiftLeadOptions;
}

/** How many steps the document's primary ramp carries, or undefined when it has none. */
function rampSteps(doc: unknown): number | undefined {
  try {
    const n = createTokenSet(doc).query({ type: 'color' }).filter(t => /^color\.ramp\.primary\.\d+$/.test(t.path)).length;
    return n || undefined;
  } catch { return undefined; }
}

/**
 * Add a lead from one colour. Its on-lead and partner in each mode come from
 * `deriveColourwaySlots`, the same values a whole design system derived from that
 * colour would use; the surface, text and ramps stay the system's own. A design
 * system with one lead is lifted first. The new lead goes last.
 */
export function addLead(doc: unknown, opts: AddLeadOptions): LeadEdit {
  let base: unknown = doc;
  if (!colourwayAxis(doc)) {
    const lifted = liftLeads(doc, opts.canonical);
    if (!lifted.ok) return lifted;
    base = lifted.doc;
  }
  const modes = leadModes(base);
  const steps = opts.steps ?? rampSteps(base);
  const values: Record<string, ColourwayValues> = {};
  try {
    for (const mode of modes) {
      const look = /dark/i.test(mode.id) || /dark/i.test(mode.name) ? 'dark' : 'light';
      values[mode.id] = deriveColourwaySlots(opts.colour, { mode: look, scheme: opts.scheme, contrast: opts.contrast, foreground: opts.foreground, steps });
    }
  } catch {
    return { ok: false, reasons: [`${opts.colour} is not a colour Lolly can read.`] };
  }
  const name = opts.name?.trim() || uniqueLeadName(base, hexOf(opts.colour) ? nameColor(hexOf(opts.colour)) : 'Colourway');
  const id = opts.id ?? uniqueLeadId(base, name);
  const result = addColourway(base, { id, name, values });
  return result.ok ? { ...result, id } : result;
}

/** Copy a lead under a new name (default: the source's name with a number) and id. */
export function duplicateLead(doc: unknown, id: string, opts: { name?: string; id?: string } = {}): LeadEdit {
  const source = colourwayAxis(doc)?.options.find(o => o.id === id);
  if (!source) return { ok: false, reasons: [`${id} is not a colourway in this design system.`] };
  const name = opts.name?.trim() || uniqueLeadName(doc, source.name);
  const copy = opts.id ?? uniqueLeadId(doc, name);
  const result = duplicateColourway(doc, id, { id: copy, name });
  return result.ok ? { ...result, id: copy } : result;
}

/** Rename a lead. Only its display name changes; the id is permanent. */
export const renameLead = (doc: unknown, id: string, name: string): ColourwayEdit => renameColourway(doc, id, name);

/** Remove a lead. Refused for the canonical one. */
export const removeLead = (doc: unknown, id: string): ColourwayEdit => removeColourway(doc, id);

/** Put the leads in a new order, canonical first. */
export const reorderLeads = (doc: unknown, order: readonly string[]): ColourwayEdit => reorderColourways(doc, order);

/** Make a lead canonical. It moves first. */
export const setCanonicalLead = (doc: unknown, id: string): ColourwayEdit => setCanonicalColourway(doc, id);

// ── Rebuild palette ──────────────────────────────────────────────────────────

export type LeadCarry =
  | {
    ok: true;
    doc: Rec;
    /** The canonical lead, re-derived with the palette; null when there were no leads. */
    canonical: { id: string; name: string } | null;
    /** Every other lead, carried as it was, in order. */
    kept: Array<{ id: string; name: string }>;
    /** Colours of kept leads that followed a rebuilt shade and were pinned to the colour they had. */
    pinned: number;
  }
  | { ok: false; reasons: string[] };

/**
 * Carry every lead from the document a Rebuild palette replaces into the freshly
 * derived one (plans/319 A2).
 *
 * The rebuild re-derives the CANONICAL lead, exactly as it re-derives the primary
 * of a design system with one lead: the fresh document is lifted with the
 * canonical lead's id and name, so its new primary, on-primary and secondary
 * become that lead's colours. Every other lead is kept as it was: its set is
 * copied whole, its `$themes` entry is copied with every annotation (window,
 * rotation), the lead order and the set order are kept, a stored colourway
 * choice is kept, and a surface the colourways re-pointed stays re-pointed.
 * A kept lead whose colour followed a
 * shade the rebuild changed (a copy of the canonical lead links to
 * `{color.ramp.primary.5}`, say) is pinned to the colour it had, so the other
 * leads look exactly as they did. Refused, with reasons, on a document whose
 * colourways Lolly cannot edit; the caller keeps the old document then.
 */
export function carryLeads(from: unknown, to: unknown): LeadCarry {
  const axis = colourwayAxis(from);
  if (!axis || !isRec(from) || !isRec(to)) return { ok: true, doc: to as Rec, canonical: null, kept: [], pinned: 0 };
  const editableFrom = colourwaysEditable(from);
  if (!editableFrom.ok) return editableFrom;
  const fromMode = modeAxis(readTokenAxes(from).axes)!;
  const toMode = modeAxis(readTokenAxes(to).axes);
  if (!toMode || toMode.options.map(o => o.id).join('\0') !== fromMode.options.map(o => o.id).join('\0')) {
    return { ok: false, reasons: ['The rebuilt palette has different looks from the design system it replaces, so its colourways cannot be kept.'] };
  }
  const canonical = axis.options.find(o => o.id === axis.canonical)!;
  const roles = colourwayRolesOf(from);
  const lifted = liftToColourways(to, { id: canonical.id, name: canonical.name, surface: roles.includes('surface') });
  if (!lifted.ok) return lifted;
  const next = lifted.doc;
  const liftedEntry = themeEntries(next).find(t => groupOf(t) === COLOURWAY_GROUP && optionIdOf(t) === canonical.id);
  const canonicalSet = liftedEntry ? enabledSets(liftedEntry)[0]! : '';

  // The leads' entries, in their authored order, with every annotation they carried.
  const seen = new Set<string>();
  const entries: Rec[] = [];
  for (const entry of themeEntries(from)) {
    const id = optionIdOf(entry);
    if (groupOf(entry) !== axis.group || !id || seen.has(id)) continue;
    seen.add(id);
    const copy = structuredClone(entry);
    if (id === canonical.id) copy.selectedTokenSets = { [canonicalSet]: 'enabled' };
    entries.push(copy);
  }
  next.$themes = [...(next.$themes as unknown[]).filter(t => t !== liftedEntry), ...entries];

  // Every other lead's set, copied whole, in the order the old document kept them.
  const kept: Array<{ id: string; name: string; set: string }> = [];
  for (const option of canonicalFirst(axis)) {
    if (option.id === canonical.id) continue;
    const set = leadSetOf(from, axis, option.id)!;
    if (set === canonicalSet || isRec(next[set])) return { ok: false, reasons: [`The rebuilt palette already has a token set called ${set}.`] };
    next[set] = structuredClone(from[set]);
    kept.push({ id: option.id, name: option.name, set });
  }
  // The colourway sets keep the order they had among themselves, after every
  // other set (the canonical one under the set name the fresh lift chose).
  const fromMeta = isRec(from.$metadata) ? from.$metadata : {};
  const oldOrder = Array.isArray(fromMeta.tokenSetOrder) ? fromMeta.tokenSetOrder.filter((s): s is string => typeof s === 'string') : [];
  const fromCanonicalSet = leadSetOf(from, axis, canonical.id);
  const leadSetNames = [canonicalSet, ...kept.map(k => k.set)];
  const rank = (set: string): number => {
    const i = oldOrder.indexOf(set === canonicalSet && fromCanonicalSet ? fromCanonicalSet : set);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  if (isRec(next.$metadata) && Array.isArray(next.$metadata.tokenSetOrder)) {
    const others = next.$metadata.tokenSetOrder.filter(s => !leadSetNames.includes(s as string));
    next.$metadata.tokenSetOrder = [...others, ...[...leadSetNames].sort((a, b) => rank(a) - rank(b))];
  }

  // A stored colourway choice stays: the resolver reads it before the canonical
  // lead, so dropping it would change what an artefact that chose nothing draws.
  // Only the colourway group's choice is carried; the rest of the rebuilt
  // document's metadata is the derive's own, as it is with one lead.
  const meta = (): Rec => childRec(next, '$metadata');
  const storedChoice = isRec(fromMeta.activeThemeSelection) ? fromMeta.activeThemeSelection[axis.group] : undefined;
  if (typeof storedChoice === 'string') {
    const m = meta();
    m.activeThemeSelection = { ...(isRec(m.activeThemeSelection) ? m.activeThemeSelection : {}), [axis.group]: storedChoice };
  }
  if (Array.isArray(fromMeta.activeThemes)) {
    const names = new Set(axis.options.flatMap(o => [o.id, o.name, `${axis.group}/${o.id}`, `${axis.group}/${o.name}`]));
    const carriedThemes = fromMeta.activeThemes.filter((t): t is string => typeof t === 'string' && names.has(t));
    if (carriedThemes.length) {
      const m = meta();
      m.activeThemes = [...(Array.isArray(m.activeThemes) ? m.activeThemes : []), ...carriedThemes];
    }
  }

  // A group that states its meaning at the document root keeps the statement.
  const fromRoot = isRec(from.$extensions) && isRec(from.$extensions[TOKEN_EXT]) ? (from.$extensions[TOKEN_EXT] as Rec).themeAxes : undefined;
  if (isRec(fromRoot) && isRec(fromRoot[axis.group])) {
    childRec(childRec(childRec(next, '$extensions'), TOKEN_EXT), 'themeAxes')[axis.group] = structuredClone(fromRoot[axis.group]);
  }

  // A kept lead that followed a rebuilt shade keeps the colour it had.
  let pinned = 0;
  const pinRoles: readonly string[] = roles.length ? roles : COLOURWAY_ROLES;
  for (const lead of kept) {
    for (const mode of toMode.options) {
      const was = createTokenSet(from, { selection: { [fromMode.group]: mode.id, [axis.group]: lead.id } });
      const now = createTokenSet(next, { selection: { [toMode.group]: mode.id, [axis.group]: lead.id } });
      for (const role of pinRoles) {
        const before = was.resolve(`color.semantic.${role}`);
        if (typeof before !== 'string' || isAlias(before) || now.resolve(`color.semantic.${role}`) === before) continue;
        const leaf = leafAt(next, [lead.set, ...colourwayPath(mode.id, role).split('.')]);
        if (!leaf) continue;
        leaf.$value = before;
        pinned++;
      }
    }
  }
  return { ok: true, doc: next, canonical: { id: canonical.id, name: canonical.name }, kept: kept.map(({ id, name }) => ({ id, name })), pinned };
}

/** The object under `key`, created when the parent has none. */
function childRec(parent: Rec, key: string): Rec {
  if (!isRec(parent[key])) parent[key] = {};
  return parent[key] as Rec;
}

/** The object at a JSON key path, or null. */
function leafAt(doc: unknown, path: readonly string[]): Rec | null {
  let node: unknown = doc;
  for (const seg of path) { if (!isRec(node)) return null; node = node[seg]; }
  return isRec(node) ? node : null;
}
