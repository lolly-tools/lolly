// SPDX-License-Identifier: MPL-2.0
/**
 * Colourways: several lead colours in one design system (plans/319).
 *
 * A colourway is a bundle (a lead, the colour that sits on it, and a partner)
 * chosen per artefact. It is a theme group whose kind is `colourway`, and it is
 * encoded by INDIRECTION so that it composes with light and dark instead of
 * multiplying them:
 *
 *   colourway/pine       color.colourway.light.primary   = {color.brand.pine}
 *                        color.colourway.dark.primary    = {color.brand.jungle}
 *   colourway/persimmon  color.colourway.light.primary   = #e05a2b
 *                        color.colourway.dark.primary    = #ff8a5c
 *   light                color.semantic.primary          = {color.colourway.light.primary}
 *   dark                 color.semantic.primary          = {color.colourway.dark.primary}
 *
 * Set precedence follows set order, not groups, so a colourway set that wrote
 * `color.semantic.primary` itself would give one value to both looks. With the
 * indirection every pairing of look and colourway resolves through ordinary
 * aliases, and no set is needed per pairing.
 *
 * Everything here is pure: documents are cloned, never modified, and nothing reads
 * a clock or a random source. `pickColourway` takes its date, seed and index from
 * the caller, so the same inputs pick the same colourway on every host.
 *
 * The rule that keeps artefacts stable: a series resolves its policy when it makes
 * each artefact and stores the resolved choice (`__tokenSelection`, `_themes`),
 * never the policy. Adding a colourway changes what a policy would pick for NEW
 * work and nothing that already exists.
 */
import { createTokenSet, isAlias } from './tokens.ts';
import { parseColor } from './css-color.ts';
import { TOKEN_EXT } from './token-ext.ts';
import { readTokenAxes, axisOfKind, modeAxis, type TokenAxis, type RotationPolicy } from './token-axes.ts';
import { resolveTokenSelection } from './token-selection.ts';

type Rec = Record<string, unknown>;
const record = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);

/** The group id the studio writes for colourways. Imported documents may use another, declared by `kind`. */
export const COLOURWAY_GROUP = 'colourway';

/** The semantic slots every colourway re-points. */
export const COLOURWAY_ROLES = Object.freeze(['primary', 'on-primary', 'secondary'] as const);
export type ColourwayRole = (typeof COLOURWAY_ROLES)[number] | 'surface';

/** The token set that holds one colourway's colours. */
export const colourwaySetName = (id: string): string => `colourway/${id}`;

/** The path a colourway's colour for one look and role lives at. */
export const colourwayPath = (mode: string, role: string): string => `color.colourway.${mode}.${role}`;

/** A colourway id: lowercase letters, digits and hyphens, starting with a letter or digit. */
export const COLOURWAY_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** The document's colourway group, or null when it has none. */
export function colourwayAxis(doc: unknown): TokenAxis | null {
  return axisOfKind(readTokenAxes(doc).axes, 'colourway');
}

/** The axis's options with the canonical one first and the rest in authored order. */
export function canonicalFirst(axis: TokenAxis): TokenAxis['options'] {
  const canonical = axis.options.find(o => o.id === axis.canonical);
  return canonical ? [canonical, ...axis.options.filter(o => o !== canonical)] : [...axis.options];
}

// ─── The family ───────────────────────────────────────────────────────────────

export interface ColourwayLead {
  id: string;
  name: string;
  canonical: boolean;
  /** The role's resolved colour as a hex string. */
  value: string;
}

/**
 * Every colourway's colour for one role, canonical first: the family a chart, an
 * audiogram or a gradient can draw several leads from. `role` is a semantic slot
 * name (`primary`, `secondary`, ...) or a full token path. The other groups keep
 * `selection`, so the family follows the look (light or dark) the caller is in.
 *
 * Reads `color.semantic.<role>`, not the colourway primitives, so a document that
 * encodes colourways its own way (an imported Tokens Studio file that overrides
 * the slot in each colourway set) still yields its family. A colourway whose role
 * does not resolve to a colour is left out.
 */
export function colourwayFamily(doc: unknown, role = 'primary', selection: Record<string, string> = {}): ColourwayLead[] {
  const axis = colourwayAxis(doc);
  if (!axis) return [];
  const path = role.includes('.') ? role : `color.semantic.${role}`;
  const out: ColourwayLead[] = [];
  for (const option of canonicalFirst(axis)) {
    const swatch = createTokenSet(doc, { selection: { ...selection, [axis.group]: option.id } }).colors().find(s => s.path === path);
    if (swatch?.value) out.push({ id: option.id, name: option.name, canonical: option.canonical, value: swatch.value });
  }
  return out;
}

// ─── Rotation ────────────────────────────────────────────────────────────────

export interface RotationContext {
  /** Which artefact in the series this is, from 0. Used by `cycle` and `shuffle`. */
  index?: number;
  /** The series seed for `shuffle`. Text or a number; the same seed gives the same order. */
  seed?: number | string;
  /** The value `by-key` hashes: a speaker, a product, a team. */
  key?: string;
  /** An ISO date (`2026-12-01`) for `by-date`. The caller supplies it; the engine reads no clock. */
  date?: string;
}

export interface ColourwayPick { group: string; option: string }

/** 32-bit FNV-1a over UTF-16 code units, the same hash `photo-look.ts` uses. */
export function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32: a small seeded generator with identical output on every JavaScript engine. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const nonNegativeIndex = (index: number | undefined): number =>
  Number.isFinite(index) && (index as number) > 0 ? Math.floor(index as number) : 0;

/**
 * The colourway a policy picks for one artefact in a series.
 *
 * | Policy      | Picks                                                                   |
 * |-------------|-------------------------------------------------------------------------|
 * | `canonical` | the canonical colourway, always                                         |
 * | `cycle`     | colourway `index mod n`, canonical first                                |
 * | `by-key`    | a stable hash of `key`, so the same key always gets the same colourway  |
 * | `shuffle`   | a seeded order per round of `n`, so none repeats until all have been used |
 * | `by-date`   | the first colourway whose window contains `date`, else canonical        |
 *
 * A missing key, seed or date falls back to the canonical colourway. Store what
 * this returns; never store the policy in place of the choice.
 */
export function pickColourway(axis: TokenAxis, policy: RotationPolicy, ctx: RotationContext = {}): ColourwayPick {
  const options = canonicalFirst(axis);
  if (!options.length) throw new Error('pickColourway: the colourway group has no options.');
  const pick = (i: number): ColourwayPick => ({ group: axis.group, option: options[i]!.id });
  const n = options.length;
  const index = nonNegativeIndex(ctx.index);
  switch (policy) {
    case 'cycle':
      return pick(index % n);
    case 'by-key':
      return ctx.key ? pick(fnv1a(ctx.key) % n) : pick(0);
    case 'shuffle': {
      if (ctx.seed === undefined || ctx.seed === '') return pick(0);
      const base = typeof ctx.seed === 'number' ? ctx.seed >>> 0 : fnv1a(ctx.seed);
      const round = Math.floor(index / n);
      const rand = mulberry32((base ^ Math.imul(round + 1, 0x9e3779b1)) >>> 0);
      const order = options.map((_, i) => i);
      for (let i = n - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        [order[i], order[j]] = [order[j]!, order[i]!];
      }
      return pick(order[index % n]!);
    }
    case 'by-date': {
      const date = typeof ctx.date === 'string' ? ctx.date.slice(0, 10) : '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return pick(0);
      // Authored order, not canonical-first: a campaign window is an authored list.
      const hit = axis.options.find(o => o.window && (!o.window.from || o.window.from <= date) && (!o.window.to || date <= o.window.to));
      return hit ? { group: axis.group, option: hit.id } : pick(0);
    }
    default:
      return pick(0);
  }
}

/** A selection with one colourway chosen. The other groups' choices are kept. */
export function withColourway(selection: Readonly<Record<string, string>> | null | undefined, pick: ColourwayPick): Record<string, string> {
  return { ...(selection ?? {}), [pick.group]: pick.option };
}

// ─── Authoring ───────────────────────────────────────────────────────────────

export type ColourwayEdit = { ok: true; doc: Rec } | { ok: false; reasons: string[] };

/** Colour-specific data that must stay with the colour, not with a slot every colourway shares. */
const COLOUR_DATA = ['cmyk', 'spot', 'faces'] as const;

/**
 * The most selections the before/after check resolves. Each is one look times one
 * combination of the other groups' options; a document with more is refused
 * rather than checked partly.
 */
export const MAX_CHECKED_SELECTIONS = 256;

function nodeAt(root: unknown, path: string): Rec | undefined {
  let node: unknown = root;
  for (const seg of path.split('.')) {
    if (!record(node)) return undefined;
    node = node[seg];
  }
  return record(node) && '$value' in node ? node : undefined;
}

function ensureGroupAt(root: Rec, segs: readonly string[]): Rec {
  let node = root;
  for (const seg of segs) {
    if (!record(node[seg])) node[seg] = {};
    node = node[seg] as Rec;
  }
  return node;
}

function setNodeAt(root: Rec, path: string, value: Rec): void {
  const segs = path.split('.');
  ensureGroupAt(root, segs.slice(0, -1))[segs[segs.length - 1]!] = value;
}

/** The set order the resolver uses: `$metadata.tokenSetOrder`, then the remaining sets as they appear. */
function setOrder(doc: Rec): string[] {
  const keys = Object.keys(doc).filter(k => !k.startsWith('$') && record(doc[k]));
  const meta = record(doc.$metadata) ? doc.$metadata : {};
  const order = Array.isArray(meta.tokenSetOrder) ? meta.tokenSetOrder.filter((s): s is string => typeof s === 'string' && keys.includes(s)) : [];
  return [...new Set([...order, ...keys])];
}

const enabledSets = (raw: Rec): string[] =>
  record(raw.selectedTokenSets) ? Object.entries(raw.selectedTokenSets).filter(([, status]) => status && status !== 'disabled').map(([set]) => set) : [];

const groupOf = (t: Rec): string => (typeof t.group === 'string' ? t.group : '');
const optionIdOf = (t: Rec): string => (typeof t.id === 'string' ? t.id : typeof t.name === 'string' ? t.name : '');
const themeEntries = (doc: Rec): Rec[] => (Array.isArray(doc.$themes) ? doc.$themes.filter(record) : []);

/** The one set a colourway option turns on, or null when it turns on none or several. */
function colourwaySetOf(doc: Rec, axis: TokenAxis, option: string): string | null {
  const entry = themeEntries(doc).find(t => groupOf(t) === axis.group && optionIdOf(t) === option);
  const sets = entry ? enabledSets(entry) : [];
  return sets.length === 1 ? sets[0]! : null;
}

/**
 * Every selection the before/after check resolves: each look, times every
 * combination of the other groups' options. `groups` are the groups that exist in
 * the document BEFORE the edit; a group the edit adds keeps its default, which is
 * the canonical option. Null when there are more than `MAX_CHECKED_SELECTIONS`.
 */
function checkedSelections(axes: readonly TokenAxis[], mode: TokenAxis): Record<string, string>[] | null {
  let combos: Record<string, string>[] = [{}];
  for (const axis of axes) {
    if (axis.group === mode.group) continue;
    combos = combos.flatMap(c => axis.options.map(o => ({ ...c, [axis.group]: o.id })));
    if (combos.length * mode.options.length > MAX_CHECKED_SELECTIONS) return null;
  }
  return mode.options.flatMap(o => combos.map(c => ({ ...c, [mode.group]: o.id })));
}

/** Every resolved token of the document under each selection, for the before/after check. */
function snapshotSelections(doc: unknown, selections: readonly Record<string, string>[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const selection of selections) {
    const key = JSON.stringify(Object.entries(selection).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    for (const e of createTokenSet(doc, { selection }).query()) {
      out.set(`${key}\0${e.path}`, JSON.stringify([e.type, e.value, e.description ?? null, e.extensions ?? null]));
    }
  }
  return out;
}

/** Reasons the edit changed what an existing selection resolves to; empty when nothing changed. */
function unchanged(before: unknown, after: unknown, selections: readonly Record<string, string>[], verb: string): string[] {
  const was = snapshotSelections(before, selections), now = snapshotSelections(after, selections);
  const changed = [...new Set([...was].filter(([key, value]) => now.get(key) !== value).map(([key]) => key.split('\0')[1]!))];
  return changed.length ? [`${verb} would change ${changed.slice(0, 3).join(', ')}${changed.length > 3 ? ` and ${changed.length - 3} more` : ''}.`] : [];
}

interface ModeSlot {
  mode: string;
  /** The set the link is written into: the winning set when this look owns it, else this look's last own set. */
  own: string;
  /** The set whose definition of the slot wins in this look today. */
  winner: string;
  node: Rec;
}

/**
 * Where each look defines one slot, or the reasons the slot cannot be re-pointed
 * by a colourway without changing what any artefact shows today.
 *
 * A slot qualifies when, in every look, it comes from that look's own set (one the
 * look turns on and no other look does) or from a set every look shares, and no
 * set another theme group turns on defines the slot. The last rule is what makes the
 * result independent of the other groups' choices.
 */
function locateSlot(doc: Rec, role: string, mode: TokenAxis): { slots: ModeSlot[] } | { reasons: string[] } {
  const path = `color.semantic.${role}`;
  const order = setOrder(doc);
  const entries = themeEntries(doc);
  const modeEntries = entries.filter(t => groupOf(t) === mode.group);
  const enabledBy = new Map(modeEntries.map(t => [optionIdOf(t), enabledSets(t)]));
  const shared = order.filter(set => [...enabledBy.values()].every(sets => sets.includes(set)));
  const reasons: string[] = [];
  const foreign = [...new Set(entries.filter(t => groupOf(t) !== mode.group).flatMap(enabledSets))].filter(set => nodeAt(doc[set], path));
  if (foreign.length) return { reasons: [`${path} is also set by ${foreign.join(', ')}, which another theme group turns on, so a colourway cannot re-point it.`] };
  const slots: ModeSlot[] = [];
  const base = resolveTokenSelection(doc).choices;
  for (const option of mode.options) {
    const mine = enabledBy.get(option.id) ?? [];
    const others = [...enabledBy].filter(([id]) => id !== option.id).flatMap(([, sets]) => sets);
    const owned = order.filter(set => mine.includes(set) && !others.includes(set));
    const active = resolveTokenSelection(doc, { selection: { ...base, [mode.group]: option.id } }).sets;
    const winner = active.filter(set => nodeAt(doc[set], path)).at(-1);
    if (!winner) { reasons.push(`The ${option.name} theme does not define ${path}.`); continue; }
    let own: string | undefined;
    if (owned.includes(winner)) own = winner;
    else if (shared.includes(winner)) {
      own = owned.at(-1);
      if (!own) { reasons.push(`The ${option.name} theme has no token set of its own to hold the ${role} link.`); continue; }
      if (order.indexOf(own) < order.indexOf(winner)) { reasons.push(`The ${own} set comes before ${winner}, so a link written there would not take effect.`); continue; }
    } else { reasons.push(`${path} in the ${option.name} theme comes from the ${winner} set, which this theme does not own and not every theme shares.`); continue; }
    const node = nodeAt(doc[winner], path)!;
    const ext = record(node.$extensions) ? node.$extensions[TOKEN_EXT] : undefined;
    const carried = record(ext) ? COLOUR_DATA.filter(k => ext[k] !== undefined) : [];
    if (carried.length) { reasons.push(`${path} in the ${option.name} theme carries its own ${carried.join(' and ')}. Move the colour to a named colour first, so each colourway keeps its own print data.`); continue; }
    slots.push({ mode: option.id, own, winner, node });
  }
  return reasons.length ? { reasons } : { slots };
}

/** Is this slot already pointed at its colourway primitive in every look? */
function isLifted(doc: Rec, role: string, mode: TokenAxis): boolean {
  const base = resolveTokenSelection(doc).choices;
  return mode.options.every(option => {
    const active = resolveTokenSelection(doc, { selection: { ...base, [mode.group]: option.id } }).sets;
    const winner = active.filter(set => nodeAt(doc[set], `color.semantic.${role}`)).at(-1);
    return winner !== undefined && nodeAt(doc[winner], `color.semantic.${role}`)!.$value === `{${colourwayPath(option.id, role)}}`;
  });
}

/**
 * Point one slot at its colourway primitive in every look, copying today's value
 * into every colourway that lacks one. Each colourway's primitive goes into the one
 * set that colourway turns on; a colourway that turns on none or several refuses.
 */
function liftRole(next: Rec, role: string, mode: TokenAxis, colourways: TokenAxis): string[] {
  if (isLifted(next, role, mode)) return [];
  const located = locateSlot(next, role, mode);
  if ('reasons' in located) return located.reasons;
  const sets = new Map<string, string>();
  for (const option of colourways.options) {
    const set = colourwaySetOf(next, colourways, option.id);
    if (!set) return [`The ${option.name} colourway turns on no token set or several, so Lolly cannot add its ${role}.`];
    sets.set(option.id, set);
  }
  for (const slot of located.slots) {
    const target = colourwayPath(slot.mode, role);
    for (const option of colourways.options) {
      const set = sets.get(option.id)!;
      if (!record(next[set])) next[set] = {};
      if (!nodeAt(next[set], target)) {
        const primitive: Rec = { $value: structuredClone(slot.node.$value) };
        if (typeof slot.node.$type === 'string') primitive.$type = slot.node.$type;
        setNodeAt(next[set] as Rec, target, primitive);
        (ensureGroupAt(next[set] as Rec, ['color', 'colourway'])).$type ??= 'color';
      }
    }
    const link: Rec = { ...structuredClone(slot.node), $value: `{${target}}` };
    setNodeAt(next[slot.own] as Rec, `color.semantic.${role}`, link);
  }
  return [];
}

function annotate(entry: Rec, axis: Rec): void {
  if (!record(entry.$extensions)) entry.$extensions = {};
  const ext = entry.$extensions as Rec;
  if (!record(ext[TOKEN_EXT])) ext[TOKEN_EXT] = {};
  const mine = ext[TOKEN_EXT] as Rec;
  mine.axis = { ...(record(mine.axis) ? mine.axis : {}), ...axis };
}

function themeIds(doc: Rec): Set<string> {
  return new Set(themeEntries(doc).flatMap(t => [t.id, t.name].filter((v): v is string => typeof v === 'string')));
}

const tooMany = (verb: string): string[] => [`The design system has more than ${MAX_CHECKED_SELECTIONS} combinations of themes, so ${verb} cannot check that nothing changes.`];

export interface LiftOptions {
  /** The canonical colourway's id. Default `main`. */
  id?: string;
  /** The canonical colourway's display name. Default `Main`. */
  name?: string;
  /**
   * Re-point the surface too, so each colourway can carry a tinted background.
   * Default false. Rebuild palette sets it when the document it replaces had
   * already re-pointed its surface, so the colourways it keeps still link.
   */
  surface?: boolean;
}

/**
 * Turn a design system with one lead into one with a canonical colourway, ready
 * for a second lead. The current primary, on-primary and secondary of each look
 * move into `colourway/<id>` and the looks' slots become links to them.
 *
 * Nothing an artefact shows changes: the function resolves every token in every
 * look, under every combination of the document's other theme groups, before and
 * after, and refuses the edit if a single value, type, description or extension
 * differs. A document that already has a colourway group is returned unchanged.
 * With `surface: true` the surface moves into the colourway as well, under the
 * same check.
 *
 * Refused, with reasons, when the document has no light/dark group, when a look
 * has no token set of its own, when another theme group sets a slot, when a slot
 * carries its own CMYK, spot or colour-face data, or when the document has more
 * than `MAX_CHECKED_SELECTIONS` selections to check.
 */
export function liftToColourways(doc: unknown, opts: LiftOptions = {}): ColourwayEdit {
  if (!record(doc) || !Array.isArray(doc.$themes) || !doc.$themes.length) return { ok: false, reasons: ['Colourways need a design system with light and dark themes.'] };
  const { axes } = readTokenAxes(doc);
  if (axisOfKind(axes, 'colourway')) return { ok: true, doc: structuredClone(doc) };
  const mode = modeAxis(axes);
  if (!mode) return { ok: false, reasons: ['Mark which theme group holds light and dark before adding colourways.'] };
  const id = opts.id ?? 'main';
  const name = opts.name?.trim() || 'Main';
  if (!COLOURWAY_ID.test(id)) return { ok: false, reasons: [`${id} is not a usable colourway id: use lowercase letters, digits and hyphens.`] };
  if (themeIds(doc).has(id)) return { ok: false, reasons: [`The design system already has a theme called ${id}.`] };
  const selections = checkedSelections(axes, mode);
  if (!selections) return { ok: false, reasons: tooMany('lifting') };

  const next = structuredClone(doc);
  for (const entry of themeEntries(next)) if (groupOf(entry) === mode.group && !mode.kind) annotate(entry, { kind: 'mode' });
  const set = colourwaySetName(id);
  next[set] = {};
  const canonical: Rec = { id, name, group: COLOURWAY_GROUP, selectedTokenSets: { [set]: 'enabled' } };
  annotate(canonical, { kind: 'colourway', canonical: true });
  (next.$themes as unknown[]).push(canonical);
  if (record(next.$metadata) && Array.isArray(next.$metadata.tokenSetOrder)) next.$metadata.tokenSetOrder = [...next.$metadata.tokenSetOrder, set];
  const colourways: TokenAxis = { group: COLOURWAY_GROUP, kind: 'colourway', canonical: id, rotation: null, options: [{ id, name, canonical: true }] };

  const lifting: ColourwayRole[] = opts.surface ? [...COLOURWAY_ROLES, 'surface'] : [...COLOURWAY_ROLES];
  const reasons = lifting.flatMap(role => liftRole(next, role, mode, colourways));
  if (reasons.length) return { ok: false, reasons };
  // The guarantee, checked rather than assumed: every selection resolves exactly as before.
  const changed = unchanged(doc, next, selections, 'Lifting');
  return changed.length ? { ok: false, reasons: changed } : { ok: true, doc: next };
}

/** One look's colours for a colourway. Each value is a colour or a `{token.path}` link. */
export type ColourwayValues = Partial<Record<ColourwayRole, string>> & Record<(typeof COLOURWAY_ROLES)[number], string>;

export interface AddColourwayOptions {
  id: string;
  name: string;
  /** The colours for every look, keyed by the look's theme id (`light`, `dark`). */
  values: Record<string, ColourwayValues>;
  /** Used when the document has no colourway group yet. */
  lift?: LiftOptions;
}

const usableColour = (v: unknown): v is string => typeof v === 'string' && (isAlias(v) || parseColor(v) !== null);

/**
 * Add a colourway. Lifts the document first when it has a single lead. A
 * `surface` value re-points the surface too; every existing colourway keeps the
 * surface it had, and a later colourway that gives none keeps the canonical one.
 * The new colourway goes last; the canonical one stays first.
 *
 * Refused when the document already encodes colourways some other way (its slots
 * do not link to `color.colourway.*`, or a colourway turns on more than one set):
 * Lolly can select those colourways but not add to them. After the edit, every
 * existing look and colourway pairing must resolve exactly as before, and every
 * role of every pairing must resolve to a colour.
 */
export function addColourway(doc: unknown, opts: AddColourwayOptions): ColourwayEdit {
  const lifted = liftToColourways(doc, opts.lift);
  if (!lifted.ok) return lifted;
  const next = lifted.doc;
  const { axes } = readTokenAxes(next);
  const mode = modeAxis(axes);
  const colourways = axisOfKind(axes, 'colourway');
  if (!mode || !colourways) return { ok: false, reasons: ['Colourways need a design system with light and dark themes.'] };
  const reasons: string[] = [];
  const foreign = COLOURWAY_ROLES.filter(role => !isLifted(next, role, mode));
  const unset = colourways.options.filter(o => colourwaySetOf(next, colourways, o.id) === null);
  if (foreign.length || unset.length) {
    return { ok: false, reasons: ['This design system encodes its colourways its own way, so Lolly can choose between them but cannot add one.'] };
  }
  reasons.push(...idReasons(next, opts.id), ...nameReasons(next, colourways, opts.name));
  for (const option of mode.options) {
    const values = opts.values[option.id];
    if (!values) { reasons.push(`Give the ${option.name} colours for ${opts.name}.`); continue; }
    for (const role of COLOURWAY_ROLES) if (!usableColour(values[role])) reasons.push(`The ${option.name} ${role} for ${opts.name} is not a colour.`);
    if (values.surface !== undefined && !usableColour(values.surface)) reasons.push(`The ${option.name} surface for ${opts.name} is not a colour.`);
  }
  if (reasons.length) return { ok: false, reasons };
  const selections = checkedSelections(axes, mode);
  if (!selections) return { ok: false, reasons: tooMany('adding a colourway') };
  const before = structuredClone(next);

  const roles: ColourwayRole[] = [...COLOURWAY_ROLES];
  const tinted = mode.options.some(option => opts.values[option.id]!.surface !== undefined);
  if (tinted || isLifted(next, 'surface', mode)) {
    const surfaceReasons = liftRole(next, 'surface', mode, colourways);
    if (surfaceReasons.length) return { ok: false, reasons: surfaceReasons };
    roles.push('surface');
  }
  const canonicalSet = colourwaySetOf(next, colourways, colourways.canonical)!;
  const set = colourwaySetName(opts.id);
  if (record(next[set])) return { ok: false, reasons: [`The design system already has a token set called ${set}.`] };
  const body: Rec = { color: { $type: 'color', colourway: {} } };
  for (const option of mode.options) {
    const values = opts.values[option.id]!;
    for (const role of roles) {
      // A colourway that gives no surface keeps the canonical one.
      const value = values[role] ?? nodeAt(next[canonicalSet], colourwayPath(option.id, role))?.$value;
      setNodeAt(body, colourwayPath(option.id, role), { $value: structuredClone(value) });
    }
  }
  next[set] = body;
  const entry: Rec = { id: opts.id, name: opts.name.trim(), group: colourways.group, selectedTokenSets: { [set]: 'enabled' } };
  annotate(entry, { kind: 'colourway' });
  (next.$themes as unknown[]).push(entry);
  if (record(next.$metadata) && Array.isArray(next.$metadata.tokenSetOrder)) next.$metadata.tokenSetOrder = [...next.$metadata.tokenSetOrder, set];

  // Existing pairings are untouched (a surface lift may have rewritten their links)...
  const changed = unchanged(before, next, selections, 'Adding this colourway');
  if (changed.length) return { ok: false, reasons: changed };
  // ...and every role of every pairing, the new colourway's included, is a colour.
  const broken = unresolvedRoles(next, mode, colourways.group, [...colourways.options, { id: opts.id, name: opts.name.trim() }], roles);
  return broken.length ? { ok: false, reasons: broken } : { ok: true, doc: next };
}

/** Reasons a pairing of look and colourway leaves a role without a colour; empty when every role resolves. */
function unresolvedRoles(doc: Rec, mode: TokenAxis, group: string, options: ReadonlyArray<{ id: string; name: string }>, roles: readonly ColourwayRole[]): string[] {
  for (const look of mode.options) {
    for (const option of options) {
      const set = createTokenSet(doc, { selection: { [mode.group]: look.id, [group]: option.id } });
      for (const role of roles) {
        const value = set.resolve(`color.semantic.${role}`);
        if (typeof value !== 'string' || isAlias(value)) return [`The ${option.name} ${role} in the ${look.name} theme would not resolve to a colour.`];
      }
    }
  }
  return [];
}

// ─── Editing the colourways a document already has ──────────────────────────
//
// The same discipline as the lift and the add: work on a clone, change only what
// the edit names, then resolve every token under every explicit selection before
// and after, and refuse the edit when anything a remaining choice draws moved.
// A selection that leaves the colourway out falls to the canonical one, so making
// a different colourway canonical changes that default on purpose; every explicit
// choice still resolves as before.

/** The longest colourway name the editing functions accept. */
export const MAX_COLOURWAY_NAME = 80;

const FOREIGN_ENCODING = 'This design system encodes its colourways its own way, so Lolly can choose between them but cannot change them.';

function idReasons(doc: Rec, id: string): string[] {
  if (!COLOURWAY_ID.test(id)) return [`${id} is not a usable colourway id: use lowercase letters, digits and hyphens.`];
  return themeIds(doc).has(id) ? [`The design system already has a theme called ${id}.`] : [];
}

/**
 * Reasons a colourway may not take a name. A theme request (`colors({ theme })`)
 * matches an option by id or by name, so a colourway called "light" would answer
 * a request for the light look. Names are compared without regard to case, so
 * two colourways never differ only in capitals either. `except` is the
 * colourway being renamed.
 */
function nameReasons(doc: Rec, colourways: TokenAxis, name: string, except?: string): string[] {
  const wanted = name.trim();
  if (!wanted) return ['A colourway needs a name.'];
  if (wanted.length > MAX_COLOURWAY_NAME) return [`A colourway name can have at most ${MAX_COLOURWAY_NAME} characters.`];
  const lower = wanted.toLowerCase();
  for (const entry of themeEntries(doc)) {
    const own = groupOf(entry) === colourways.group;
    if (own && optionIdOf(entry) === except) continue;
    const taken = [entry.id, entry.name].some(v => typeof v === 'string' && v.trim().toLowerCase() === lower);
    if (!taken) continue;
    return [own ? `Another colourway is already called ${wanted}.` : `The design system already has a theme called ${wanted}, so a colourway cannot use that name.`];
  }
  return [];
}

/**
 * Every explicit selection of the given groups: one option from each, every
 * combination. Null when there are more than `MAX_CHECKED_SELECTIONS`, so an
 * edit is refused rather than checked partly.
 */
function everySelection(axes: readonly TokenAxis[]): Record<string, string>[] | null {
  let combos: Record<string, string>[] = [{}];
  for (const axis of axes) {
    combos = combos.flatMap(c => axis.options.map(o => ({ ...c, [axis.group]: o.id })));
    if (combos.length > MAX_CHECKED_SELECTIONS) return null;
  }
  return combos;
}

interface Editable { next: Rec; axes: TokenAxis[]; colourways: TokenAxis }

/**
 * A clone of the document and its colourway group, or the reasons it cannot be
 * edited. `encoded` also requires the encoding Lolly writes (every colourway turns
 * on one set of its own, and every look links its primary, on-primary and
 * secondary to `color.colourway.*`), which removing and duplicating need because
 * they move whole sets. Renaming, reordering and choosing the canonical colourway
 * touch only `$themes`, so they work on any colourway group.
 */
function editable(doc: unknown, encoded: boolean): Editable | { reasons: string[] } {
  if (!record(doc)) return { reasons: ['This design system has no colourways yet.'] };
  const { axes } = readTokenAxes(doc);
  const colourways = axisOfKind(axes, 'colourway');
  if (!colourways) return { reasons: ['This design system has no colourways yet.'] };
  if (encoded) {
    const mode = modeAxis(axes);
    if (!mode) return { reasons: ['Colourways need a design system with light and dark themes.'] };
    const foreign = COLOURWAY_ROLES.some(role => !isLifted(doc, role, mode)) || colourways.options.some(o => colourwaySetOf(doc, colourways, o.id) === null);
    if (foreign) return { reasons: [FOREIGN_ENCODING] };
  }
  return { next: structuredClone(doc), axes, colourways };
}

/** The before/after check every edit below ends with. */
function checked(before: unknown, next: Rec, axes: readonly TokenAxis[], verb: string): ColourwayEdit {
  const selections = everySelection(axes);
  if (!selections) return { ok: false, reasons: tooMany(verb.toLowerCase()) };
  const changed = unchanged(before, next, selections, verb);
  return changed.length ? { ok: false, reasons: changed } : { ok: true, doc: next };
}

/** The first `$themes` entry of a group with an option id. */
const entryOf = (doc: Rec, group: string, id: string): Rec | undefined =>
  themeEntries(doc).find(t => groupOf(t) === group && optionIdOf(t) === id);

/**
 * Put a group's entries in a new order. The entries keep the positions the group
 * already holds in `$themes`, so the order of other groups is untouched. A
 * duplicate entry the resolver skips stays where it is.
 */
function placeEntries(doc: Rec, group: string, order: readonly string[]): void {
  const list = doc.$themes as unknown[];
  const firsts = new Map<string, number>();
  list.forEach((t, i) => {
    if (!record(t) || groupOf(t) !== group) return;
    const id = optionIdOf(t);
    if (id && !firsts.has(id)) firsts.set(id, i);
  });
  const slots = [...firsts.values()].sort((a, b) => a - b);
  const entries = order.map(id => list[firsts.get(id)!]);
  slots.forEach((slot, i) => { list[slot] = entries[i]; });
}

/** The axis annotation on one entry, created when absent. */
function axisAnnotation(entry: Rec): Rec {
  annotate(entry, {});
  return ((entry.$extensions as Rec)[TOKEN_EXT] as Rec).axis as Rec;
}

/**
 * Give a colourway a new display name. Its id never changes: ids are what
 * artefacts store. When the entry has no `id` of its own (the resolver then uses
 * its name as the id), the old name is written as the id first, so a stored
 * choice keeps pointing at the same colourway. A stored `activeThemes` entry that
 * used the old name is rewritten to the id for the same reason.
 *
 * Refused for an empty or overlong name, or one that another theme already uses
 * as an id or a name (see `nameReasons`).
 */
export function renameColourway(doc: unknown, id: string, name: string): ColourwayEdit {
  const found = editable(doc, false);
  if ('reasons' in found) return { ok: false, reasons: found.reasons };
  const { next, axes, colourways } = found;
  if (!colourways.options.some(o => o.id === id)) return { ok: false, reasons: [`${id} is not a colourway in this design system.`] };
  const reasons = nameReasons(next, colourways, name, id);
  if (reasons.length) return { ok: false, reasons };
  const entry = entryOf(next, colourways.group, id)!;
  const oldName = typeof entry.name === 'string' ? entry.name : id;
  if (typeof entry.id !== 'string') entry.id = id;
  entry.name = name.trim();
  // `activeThemes` matches by id or by name; a stored name would stop matching.
  const meta = record(next.$metadata) ? next.$metadata as Rec : null;
  if (meta && Array.isArray(meta.activeThemes) && oldName !== id) {
    const group = colourways.group;
    meta.activeThemes = meta.activeThemes.map(t => (t === oldName ? id : t === `${group}/${oldName}` ? `${group}/${id}` : t));
  }
  return checked(doc, next, axes, 'Renaming this colourway');
}

/**
 * Put the colourways in a new order: `order` lists every colourway id once. The
 * canonical colourway stays first, because the first option is also the canonical
 * one for a reader that ignores the mark (plans/319, axis meaning); to put another
 * colourway first, make it canonical. Only `$themes` changes; set order is left
 * alone, since one colourway set is on at a time and their order decides nothing.
 */
export function reorderColourways(doc: unknown, order: readonly string[]): ColourwayEdit {
  const found = editable(doc, false);
  if ('reasons' in found) return { ok: false, reasons: found.reasons };
  const { next, axes, colourways } = found;
  const ids = colourways.options.map(o => o.id);
  if (order.length !== ids.length || new Set(order).size !== order.length || order.some(id => !ids.includes(id))) {
    return { ok: false, reasons: ['Name every colourway exactly once.'] };
  }
  if (order[0] !== colourways.canonical) return { ok: false, reasons: ['The canonical colourway stays first. Make another colourway canonical to put that one first.'] };
  placeEntries(next, colourways.group, order);
  return checked(doc, next, axes, 'Reordering the colourways');
}

/**
 * Make a colourway the canonical one: the colourway an artefact uses when it
 * chooses none, the one the app's own colours follow. The mark moves to its entry
 * (and to the document's root `themeAxes` entry, when the group states its
 * canonical there) and the entry moves first, so the mark and the first-option
 * rule agree. Every artefact that stored a colourway keeps that colourway.
 */
export function setCanonicalColourway(doc: unknown, id: string): ColourwayEdit {
  const found = editable(doc, false);
  if ('reasons' in found) return { ok: false, reasons: found.reasons };
  const { next, axes, colourways } = found;
  if (!colourways.options.some(o => o.id === id)) return { ok: false, reasons: [`${id} is not a colourway in this design system.`] };
  for (const entry of themeEntries(next)) {
    if (groupOf(entry) !== colourways.group) continue;
    const mine = optionIdOf(entry) === id;
    const axis = record(entry.$extensions) && record((entry.$extensions as Rec)[TOKEN_EXT]) ? ((entry.$extensions as Rec)[TOKEN_EXT] as Rec).axis : undefined;
    if (mine) axisAnnotation(entry).canonical = true;
    else if (record(axis)) delete axis.canonical;
  }
  const root = record(next.$extensions) && record((next.$extensions as Rec)[TOKEN_EXT]) ? ((next.$extensions as Rec)[TOKEN_EXT] as Rec).themeAxes : undefined;
  if (record(root) && record(root[colourways.group]) && typeof (root[colourways.group] as Rec).canonical === 'string') (root[colourways.group] as Rec).canonical = id;
  placeEntries(next, colourways.group, [id, ...colourways.options.map(o => o.id).filter(o => o !== id)]);
  return checked(doc, next, axes, 'Choosing the canonical colourway');
}

/**
 * Remove a colourway: its `$themes` entry, and its set unless another theme also
 * turns that set on. A stored choice of it (`$metadata.activeThemeSelection`,
 * `activeThemes`) is cleared, so the document falls back to the canonical
 * colourway rather than naming one that is gone. An artefact that stored this
 * colourway now draws the canonical one, which the resolver reports.
 *
 * Refused for the canonical colourway (make another one canonical first) and on a
 * document that encodes colourways its own way. Every pairing of the remaining
 * colourways must resolve exactly as before.
 */
export function removeColourway(doc: unknown, id: string): ColourwayEdit {
  const found = editable(doc, true);
  if ('reasons' in found) return { ok: false, reasons: found.reasons };
  const { next, colourways } = found;
  const option = colourways.options.find(o => o.id === id);
  if (!option) return { ok: false, reasons: [`${id} is not a colourway in this design system.`] };
  if (id === colourways.canonical) return { ok: false, reasons: [`Make another colourway canonical before removing ${option.name}.`] };
  const set = colourwaySetOf(next, colourways, id)!;
  const entry = entryOf(next, colourways.group, id)!;
  next.$themes = (next.$themes as unknown[]).filter(t => t !== entry);
  const shared = themeEntries(next).some(t => enabledSets(t).includes(set));
  const meta = record(next.$metadata) ? next.$metadata as Rec : null;
  if (!shared) {
    delete next[set];
    if (meta && Array.isArray(meta.tokenSetOrder)) meta.tokenSetOrder = meta.tokenSetOrder.filter(s => s !== set);
    if (meta && Array.isArray(meta.activeSets)) meta.activeSets = meta.activeSets.filter(s => s !== set);
  }
  if (meta && record(meta.activeThemeSelection) && meta.activeThemeSelection[colourways.group] === id) delete meta.activeThemeSelection[colourways.group];
  if (meta && Array.isArray(meta.activeThemes)) {
    const names = new Set([id, option.name, `${colourways.group}/${id}`, `${colourways.group}/${option.name}`]);
    meta.activeThemes = meta.activeThemes.filter(t => !(typeof t === 'string' && names.has(t)));
  }
  // Checked over what is left: every remaining pairing must draw what it drew.
  return checked(doc, next, readTokenAxes(next).axes, 'Removing this colourway');
}

export interface DuplicateColourwayOptions {
  /** The copy's id. */
  id: string;
  /** The copy's display name. */
  name: string;
}

/**
 * Copy a colourway under a new id and name: its set is cloned whole (links
 * included, so a copy of a colourway that follows a ramp step follows the same
 * step) and the copy goes last. Refused on a document that encodes colourways
 * its own way, and when the id or name is taken. Every existing pairing must
 * resolve exactly as before, and every role of the copy must resolve to a colour.
 */
export function duplicateColourway(doc: unknown, id: string, opts: DuplicateColourwayOptions): ColourwayEdit {
  const found = editable(doc, true);
  if ('reasons' in found) return { ok: false, reasons: found.reasons };
  const { next, axes, colourways } = found;
  const mode = modeAxis(axes)!;
  if (!colourways.options.some(o => o.id === id)) return { ok: false, reasons: [`${id} is not a colourway in this design system.`] };
  const reasons = [...idReasons(next, opts.id), ...nameReasons(next, colourways, opts.name)];
  if (reasons.length) return { ok: false, reasons };
  const set = colourwaySetName(opts.id);
  if (record(next[set])) return { ok: false, reasons: [`The design system already has a token set called ${set}.`] };
  next[set] = structuredClone(next[colourwaySetOf(next, colourways, id)!]);
  const entry: Rec = { id: opts.id, name: opts.name.trim(), group: colourways.group, selectedTokenSets: { [set]: 'enabled' } };
  annotate(entry, { kind: 'colourway' });
  (next.$themes as unknown[]).push(entry);
  if (record(next.$metadata) && Array.isArray(next.$metadata.tokenSetOrder)) next.$metadata.tokenSetOrder = [...next.$metadata.tokenSetOrder, set];
  const result = checked(doc, next, axes, 'Copying this colourway');
  if (!result.ok) return result;
  const roles: ColourwayRole[] = isLifted(next, 'surface', mode) ? [...COLOURWAY_ROLES, 'surface'] : [...COLOURWAY_ROLES];
  const broken = unresolvedRoles(next, mode, colourways.group, [{ id: opts.id, name: opts.name.trim() }], roles);
  return broken.length ? { ok: false, reasons: broken } : result;
}

/**
 * Whether Lolly can add, copy and remove colourways in this document, and why
 * not. A document with no colourway group answers with the lift's own reasons,
 * so a caller can say why the first extra lead cannot be added before trying.
 */
export function colourwaysEditable(doc: unknown): { ok: true } | { ok: false; reasons: string[] } {
  if (!colourwayAxis(doc)) {
    const lifted = liftToColourways(doc);
    return lifted.ok ? { ok: true } : { ok: false, reasons: lifted.reasons };
  }
  const found = editable(doc, true);
  return 'reasons' in found ? { ok: false, reasons: found.reasons } : { ok: true };
}

/**
 * The roles every look links to the colourways: `primary`, `on-primary` and
 * `secondary`, plus `surface` once a colourway has tinted the surface. Empty when the
 * document has no colourway group or no light and dark group.
 */
export function colourwayRolesOf(doc: unknown): ColourwayRole[] {
  if (!record(doc) || !colourwayAxis(doc)) return [];
  const mode = modeAxis(readTokenAxes(doc).axes);
  if (!mode) return [];
  return ([...COLOURWAY_ROLES, 'surface'] as ColourwayRole[]).filter(role => isLifted(doc, role, mode));
}
