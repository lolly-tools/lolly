// SPDX-License-Identifier: MPL-2.0
/**
 * What the Colour roles table shows (plans/352 R2), with no DOM: every word, value and
 * rule the room needs, computed from the document and the colourway being looked at.
 *
 * The design system says what its colours are called and what each is for. The table
 * leads with those words, and the engine's slots appear only as the answer to "how does
 * Lolly read this?", in language of their own: Lead colour, Partner colour, Background,
 * Text, Quiet text, Hairlines, By name only. That is what stops a brand's "secondary"
 * being confused with Lolly's slot, so a bare "Primary" or "Secondary" never appears in
 * that column.
 *
 * Three states come from `readColourRoles`. `default` shows the shipped words and writes
 * nothing until someone changes them. `declared` shows the system's own. `undeclared`
 * shows the shipped words and offers the file's hand-written colours for naming.
 *
 * Labels and descriptions come from a token file, so they are inert text everywhere:
 * never a key on a plain object, always escaped where they are drawn.
 */
import { colorToHex, colourRolesEditable, colourRoleTable, colourwayAxis, TOKEN_EXT } from '@lolly/engine';
import { BINDABLE_COLOUR_SLOTS, DEFAULT_COLOUR_VOCABULARY, MAX_ROLE_DESCRIPTION, MAX_ROLE_LABEL } from '../../../../../engine/src/colour-roles.ts';
import type { ColourRoleCell, ColourRoleEdit, ColourRoleSpec, ColourRoleUse } from '../../../../../engine/src/colour-roles.ts';
import type { ColourRoleV1, ColourSlotV1 } from '@lolly-tools/core/brand-system-v1';
import { t, tRaw } from '../../i18n.ts';
import { walkSwatches } from '../brand-doc.ts';
import { leadTokenSet } from './leads.ts';
import { roleContrast, roleReadouts } from './roles.ts';
import type { RoleContrast, RoleId } from './roles.ts';

export { MAX_ROLE_DESCRIPTION, MAX_ROLE_LABEL };

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A slot a role can fill. */
export type SlotId = Exclude<ColourSlotV1, 'on-primary'>;

// ── How Lolly reads a slot ───────────────────────────────────────────────────

/** A slot in the table's own language. Called per render, so a language switch repaints. */
export function slotWord(slot: SlotId): string {
  switch (slot) {
    case 'primary': return t('Lead colour');
    case 'secondary': return t('Partner colour');
    case 'surface': return t('Background');
    case 'text': return t('Text');
    case 'muted': return t('Quiet text');
    case 'edge': return t('Hairlines');
  }
}

/** One line on what follows from reading a role as this slot. */
export function slotLine(slot: SlotId): string {
  switch (slot) {
    case 'primary': return t('Big shapes, buttons, the colour a tool leads with.');
    case 'secondary': return t('The second colour a tool reaches for.');
    case 'surface': return t('Sits behind everything else.');
    case 'text': return t('Headings and body text.');
    case 'muted': return t('Captions and small print.');
    case 'edge': return t('Rules, borders and dividers.');
  }
}

export const byNameWord = (): string => t('By name only');
export const byNameLine = (): string => t('No tool picks this by itself. Offered in colour fields and Design.');

// ── The model ────────────────────────────────────────────────────────────────

export interface RoleValueCell {
  mode: string;
  /** The look's name, in the document's words. */
  modeName: string;
  /** Resolved hex, '' when this role has no colour here. */
  hex: string;
  /** The colour's name or its value, '' when it has none. */
  text: string;
  /** The value as stored: a literal, or a `{path}` to a named colour. Undefined for a shipped word. */
  stored?: string;
  /** The palette colour this value points at, or null for a literal. */
  ref: string | null;
  /** The look this one follows by an alias, by name, or null. */
  sameAs: string | null;
  /** The sentence saying where a copied value came from, or null once somebody chose one. */
  copied: string | null;
  /** The sample chip: the role's colour with its on-colour, or a surface with the role's colour as ink. */
  chipBg: string;
  chipFg: string;
  /** How the table describes the colour on top. '' when this colour is drawn on the surface instead. */
  onWord: string;
  /** The longer sentence behind `onWord`. */
  onTitle: string;
  contrast: RoleContrast | null;
}

export interface RoleTableRow {
  /** Stable across renders: the role's id, or the slot's on a row of shipped words. */
  key: string;
  /** A row of shipped words writes through the slot, and has no id of its own yet. */
  shipped: boolean;
  label: string;
  description: string;
  cells: RoleValueCell[];
  /** The slots this role fills, in table order. */
  slots: SlotId[];
  /** The role is a slot by its own id: its reading cannot be moved. */
  fixed: boolean;
  /** The record says this role fills a slot and the colours do not link to it yet. */
  unwritten: SlotId[];
}

export interface UnfilledSlot {
  slot: SlotId;
  word: string;
  line: string;
  /** One colour per look. */
  colours: Array<{ mode: string; modeName: string; hex: string }>;
}

export interface HandWrittenColour {
  id: string;
  /** The token's name made readable, offered as a starting word. */
  label: string;
  colours: Array<{ mode: string; modeName: string; hex: string }>;
}

export interface ColourRolesModel {
  state: 'default' | 'declared' | 'undeclared';
  /** Edits are possible. A read-only view passes false whatever the file says. */
  editable: boolean;
  /** Why edits are refused, for a file that cannot take them. '' on a read-only view, whose page says so. */
  refusal: string;
  colourway: { id: string; name: string; canonical: boolean } | null;
  modes: Array<{ id: string; name: string }>;
  rows: RoleTableRow[];
  /** Slots nothing fills, each keeping what the system defines. */
  unfilled: UnfilledSlot[];
  /** The file's own colours nothing declares, ready to be named. */
  handWritten: HandWrittenColour[];
  /** Tokens whose name cannot be a role id: shown, and left alone. */
  unusable: string[];
  /** Everything odd in the file, each as one plain sentence. */
  issues: string[];
  /** Which slot each role fills, for the reading control. */
  slotHolders: ReadonlyMap<SlotId, { roleId: string; label: string; self: boolean }>;
}

const hexOf = (value: unknown): string => {
  const hex = colorToHex(value);
  return typeof hex === 'string' && hex.startsWith('#') ? hex : '';
};

/** A display name for a look. `light` and `dark` are translated; anything else is the file's. */
export function lookName(mode: { id: string; name: string }): string {
  const key = (mode.name || mode.id).toLowerCase();
  if (key === 'light') return t('Light');
  if (key === 'dark') return t('Dark');
  return mode.name || mode.id;
}

/** "Same as light": a state of its own in the table, in sentence case. */
export function sameAsWords(look: string): string {
  if (look === t('Light')) return t('Same as light');
  if (look === t('Dark')) return t('Same as dark');
  return tRaw('Same as {look}', { look });
}

/** `{a.b.c}`'s target, or null for a literal. */
const aliasTarget = (value: unknown): string | null => {
  const m = typeof value === 'string' ? /^\{([^}]+)\}$/.exec(value.trim()) : null;
  return m ? m[1]!.trim() : null;
};

const prettyPath = (path: string): string => {
  const leaf = path.split('.').at(-1) ?? path;
  return leaf.replace(/[-_]+/g, ' ').replace(/^\w/, c => c.toUpperCase());
};

const onWords = (origin: ColourRoleCell['onColour']['origin']): { word: string; title: string } => {
  switch (origin) {
    case 'derived': return { word: t('Derived'), title: t('Lolly works out the colour that sits on this one and keeps it current.') };
    case 'stated': return { word: t('Stated'), title: t('The file states the colour that sits on this one, and that colour stays.') };
    case 'computed': return { word: t('Derived'), title: t('Lolly works this out from the colour. It is stored once this role is edited.') };
    case 'none': return { word: '', title: '' };
  }
};

/** The Lc is always shown. A hairline is meant to sit far under the text floor, so it is never painted as a warning. */
const quiet = (contrast: RoleContrast | null, slots: readonly string[]): RoleContrast | null =>
  contrast && slots.includes('edge') ? { ...contrast, weak: false } : contrast;

export interface ColourRolesModelOptions {
  /** The colourway to read, null for the canonical one. */
  colourway?: string | null;
  /** False draws no controls, whatever the file allows. */
  readOnly?: boolean;
}

/** Everything the table draws. Never writes, and never throws on a file it cannot read. */
export function colourRolesModel(doc: unknown, opts: ColourRolesModelOptions = {}): ColourRolesModel {
  const table = colourRoleTable(doc, opts.colourway ?? null);
  const { reading } = table;
  const lead = table.colourway?.id ?? null;
  const modes = table.modes.length ? table.modes : [{ id: 'light', name: 'light' }];
  const editableNow = colourRolesEditable(doc);
  const axis = colourwayAxis(doc);
  const canonicalName = axis?.options.find(o => o.id === axis.canonical)?.name ?? '';
  const sets = new Map(modes.map(m => [m.id, leadTokenSet(doc, { lead, mode: m.id })]));
  const surfaceOf = (mode: string): string => {
    try { return hexOf(sets.get(mode)?.resolve('color.semantic.surface')) || '#ffffff'; } catch { return '#ffffff'; }
  };
  const swatchNames = new Map<string, string>();
  try {
    const set = sets.get(modes[0]!.id);
    for (const s of walkSwatches(doc, { lead, mode: modes[0]!.id }, set ? (key: string) => set.resolve(key) : undefined)) swatchNames.set(s.key, s.name);
  } catch { /* a malformed document shows values rather than names */ }
  const nameOf = (stored: string | undefined, hex: string): string => {
    const target = aliasTarget(stored);
    if (!target) return hex;
    return swatchNames.get(target) ?? (prettyPath(target) || hex);
  };
  const modeNames = new Map(modes.map(m => [m.id, lookName(m)]));

  const roleCell = (row: { role: ColourRoleV1 }, cell: ColourRoleCell): RoleValueCell => {
    const { word, title } = cell.against === 'surface' ? { word: '', title: '' } : onWords(cell.onColour.origin);
    const copied = !cell.seeded ? null
      : table.colourway && !table.colourway.canonical && canonicalName ? tRaw('Copied from {name}. Choose a colour to make this one its own.', { name: canonicalName })
        : t('Copied from the partner colour. Choose a colour to make this one its own.');
    return {
      mode: cell.mode,
      modeName: modeNames.get(cell.mode) ?? cell.mode,
      hex: cell.hex,
      text: nameOf(cell.stored, cell.hex),
      ...(cell.stored !== undefined ? { stored: cell.stored } : {}),
      ref: aliasTarget(cell.stored),
      sameAs: cell.sameAs ? modeNames.get(cell.sameAs) ?? cell.sameAs : null,
      copied,
      chipBg: cell.against === 'surface' ? surfaceOf(cell.mode) : cell.hex || 'transparent',
      chipFg: cell.against === 'surface' ? cell.hex : cell.onColour.hex,
      onWord: word,
      onTitle: title,
      contrast: quiet(cell.contrast, row.role.slots),
    };
  };

  const slotHolders = new Map<SlotId, { roleId: string; label: string; self: boolean }>();
  for (const s of reading.slots) {
    const role = s.roleId ? reading.roles.find(r => r.id === s.roleId && r.declared) : undefined;
    if (role) slotHolders.set(s.slot as SlotId, { roleId: role.id, label: role.label, self: s.source === 'self' });
  }

  const slotReadouts = new Map(modes.map(m => [m.id, safeReadouts(doc, { lead, mode: m.id }, sets.get(m.id))]));
  const slotCell = (slot: SlotId, mode: { id: string; name: string }): RoleValueCell => {
    const r = slotReadouts.get(mode.id)?.[slot as RoleId];
    const hex = r?.hex ?? '';
    const ink = slot === 'text' || slot === 'muted' || slot === 'edge';
    return {
      mode: mode.id, modeName: modeNames.get(mode.id) ?? mode.id, hex,
      text: r?.ref ? (swatchNames.get(r.ref) ?? prettyPath(r.ref)) : hex,
      ref: r?.ref ?? null,
      sameAs: null, copied: null,
      chipBg: ink ? surfaceOf(mode.id) : hex || 'transparent',
      chipFg: ink ? hex : r?.against ?? '',
      onWord: '', onTitle: '',
      contrast: quiet(r?.contrast ?? (ink && hex ? roleContrast(hex, surfaceOf(mode.id)) : null), [slot]),
    };
  };

  const declared = table.rows.filter(r => r.role.declared);
  const shippedRows: RoleTableRow[] = reading.state === 'declared' ? [] : DEFAULT_COLOUR_VOCABULARY.map(word => ({
    key: word.id,
    shipped: true,
    label: shippedWord(word.id as SlotId),
    description: '',
    cells: modes.map(m => slotCell(word.id as SlotId, m)),
    slots: [word.id as SlotId],
    fixed: true,
    unwritten: [],
  }));
  const declaredRows: RoleTableRow[] = declared.map(row => ({
    key: row.role.id,
    shipped: false,
    label: row.role.label,
    description: row.role.description ?? '',
    cells: row.cells.map(cell => roleCell(row, cell)),
    slots: BINDABLE_COLOUR_SLOTS.filter(slot => row.role.slots.includes(slot)) as SlotId[],
    fixed: (BINDABLE_COLOUR_SLOTS as readonly string[]).includes(row.role.id),
    unwritten: reading.slots.filter(s => s.roleId === row.role.id && !s.written).map(s => s.slot as SlotId),
  }));

  const shown = new Set<SlotId>(reading.state === 'declared' ? [] : DEFAULT_COLOUR_VOCABULARY.map(word => word.id as SlotId));
  const unfilled: UnfilledSlot[] = reading.slots
    .filter(s => !slotHolders.has(s.slot as SlotId) && !shown.has(s.slot as SlotId))
    .map(s => ({
      slot: s.slot as SlotId,
      word: slotWord(s.slot as SlotId),
      line: slotLine(s.slot as SlotId),
      colours: modes.map(m => ({ mode: m.id, modeName: modeNames.get(m.id) ?? m.id, hex: slotCell(s.slot as SlotId, m).hex })),
    }));
  const handWritten: HandWrittenColour[] = table.rows.filter(r => !r.role.declared).map(row => ({
    id: row.role.id,
    label: row.role.label,
    colours: row.cells.map(cell => ({ mode: cell.mode, modeName: modeNames.get(cell.mode) ?? cell.mode, hex: cell.hex })),
  }));

  return {
    state: reading.state,
    editable: !opts.readOnly && editableNow.ok,
    refusal: opts.readOnly ? '' : refusalOf(reading.record),
    colourway: table.colourway,
    modes: modes.map(m => ({ id: m.id, name: modeNames.get(m.id) ?? m.id })),
    rows: reading.state === 'declared' ? declaredRows : shippedRows,
    unfilled,
    handWritten,
    unusable: reading.issues.filter(i => i.code === 'token-name-unusable' && i.subject).map(i => i.subject!),
    issues: reading.issues.filter(i => i.code !== 'token-name-unusable' && i.code !== 'record-unreadable').map(issueText),
    slotHolders,
  };
}

const refusalOf = (record: string): string =>
  (record === 'unreadable' ? t('The design system record in this file does not validate, so Lolly keeps the file as it is. Correct the record in the file to edit colour roles here.') : '');

/** Reading the slots of a file Lolly cannot resolve shows nothing rather than failing the room. */
function safeReadouts(doc: unknown, ctx: { lead: string | null; mode: string }, set: { resolve(key: string): unknown } | undefined): ReturnType<typeof roleReadouts> | null {
  try { return roleReadouts(doc, ctx, set ? key => set.resolve(key) : undefined); } catch { return null; }
}

/** The shipped words, in the language the room is showing. */
function shippedWord(slot: SlotId): string {
  switch (slot) {
    case 'primary': return t('Primary');
    case 'secondary': return t('Secondary');
    case 'surface': return t('Surface');
    case 'text': return t('Text');
    case 'muted': return t('Muted');
    case 'edge': return t('Edge');
  }
}

/** One plain sentence per thing the reader found odd in the file. */
function issueText(issue: { code: string; message: string; subject?: string }): string {
  const subject = issue.subject ?? '';
  switch (issue.code) {
    case 'role-id-unusable': return tRaw('A colour role has an id Lolly cannot use ({id}), so it stays in the file and is not offered here.', { id: subject });
    case 'duplicate-role': return tRaw('{id} is declared twice. The first one is used.', { id: subject });
    case 'binding-unknown-role': return tRaw('The file gives a slot to {id}, which it does not declare, so that is ignored.', { id: subject });
    case 'slot-bound-twice': return tRaw('Two roles claim the same slot. The first one is used, and {id} is not.', { id: subject });
    case 'slot-not-bindable': return t('The colour on the lead colour follows the lead colour, so the file\'s own binding of it is ignored.');
    case 'binding-not-written': return tRaw('The file says {id} fills a slot, but the colours do not link to {id} yet.', { id: subject });
    case 'label-too-long': return tRaw('The name of {id} is too long, so it is shown cut short.', { id: subject });
    case 'description-too-long': return tRaw('The description of {id} is too long, so it is shown cut short.', { id: subject });
    case 'label-missing': return tRaw('{id} has no name in the file, so its id is shown.', { id: subject });
    case 'too-many-roles': return t('The file declares more colour roles than Lolly reads. The first 32 are shown.');
    case 'unsafe-theme-id': return t('A theme in this file has an id Lolly will not use as a key.');
    case 'value-missing': return tRaw('{id} has no colour in some colourways.', { id: subject });
    default: return issue.message;
  }
}

// ── Starting points ──────────────────────────────────────────────────────────

/** Suggestions only. Each fills the words field, and nothing is written until someone uses them. */
export const STARTING_POINTS: ReadonlyArray<readonly string[]> = Object.freeze([
  Object.freeze(['Primary', 'Secondary']),
  Object.freeze(['Main', 'Accent', 'Supporting', 'Tertiary']),
]);

/** Words typed into one field: commas in any script, trimmed, without repeats. Each stays as typed. */
export function parseRoleWords(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of String(text ?? '').split(/[,，、،;；\n]/)) {
    const word = part.trim();
    if (!word || seen.has(word.toLocaleLowerCase())) continue;
    seen.add(word.toLocaleLowerCase());
    out.push(word);
  }
  return out;
}

/** The slot a word is the shipped name of, or null. Only an exact match: words are never read for meaning. */
function slotNamedBy(word: string): SlotId | null {
  const lower = word.trim().toLowerCase();
  return (BINDABLE_COLOUR_SLOTS as readonly string[]).includes(lower) ? lower as SlotId : null;
}

/**
 * The first words as a suggestion to fill the two slots a tool reaches for, by position.
 * A word that IS a slot's own name takes that slot. Shown before anything is written, and
 * changed in the table afterwards. Never read for meaning.
 */
export function suggestedReadings(words: readonly string[]): Array<{ word: string; slot: SlotId | null }> {
  const own = new Set(words.map(slotNamedBy).filter((s): s is SlotId => s !== null));
  const open: SlotId[] = (['primary', 'secondary'] as SlotId[]).filter(s => !own.has(s));
  return words.map((word) => {
    const named = slotNamedBy(word);
    if (named) return { word, slot: named };
    return { word, slot: open.shift() ?? null };
  });
}

/** `setColourRoles` specs for a list of words. A slot's own name takes no `fills`: the role is that slot. */
export function specsForWords(words: readonly string[]): ColourRoleSpec[] {
  return suggestedReadings(words).map(({ word, slot }) => (slot && slotNamedBy(word) !== slot ? { label: word, fills: slot } : { label: word }));
}

/**
 * The vocabulary after someone renames one shipped word. Primary and Secondary come with
 * it, so the words the system had stay on screen. Surface and Text join only when someone
 * renames them, because declaring either moves its colours into every colourway.
 */
export function specsForShippedRename(slot: SlotId, label: string): ColourRoleSpec[] {
  const keep: SlotId[] = ['primary', 'secondary'];
  if (!keep.includes(slot)) keep.push(slot);
  return keep.map((s) => {
    if (s !== slot) return { label: shippedEnglish(s) };
    // A word that is another slot's id would claim that slot, so the renamed role gets an id of its own.
    const clash = slotNamedBy(label);
    return clash === s ? { label } : { label, fills: s, ...(clash ? { id: `role-${clash}` } : {}) };
  });
}

/** The shipped word as the document stores it: labels are the system's, so they stay in one language. */
function shippedEnglish(slot: SlotId): string {
  return DEFAULT_COLOUR_VOCABULARY.find(word => word.id === slot)?.label ?? slot;
}

// ── Removing a role ──────────────────────────────────────────────────────────

export interface RemovalExplanation {
  /** Sentences saying what uses the role. */
  uses: string[];
  /** The sentence about saved documents, which a token file cannot answer for. */
  unseen: string;
  /** The role can go now, and these slots keep the colours they draw. */
  releases: boolean;
  /** Something has to change first, so no removal is offered. */
  blocked: boolean;
}

const join = (items: readonly string[]): string => items.slice(0, 4).join(', ') + (items.length > 4 ? ` +${items.length - 4}` : '');

/** The words a rule or guide group goes by, looked up from the record. */
function recordLabels(doc: unknown, list: 'rules' | 'guide', ids: readonly string[]): string[] {
  const vendor = isRec(doc) && isRec(doc.$extensions) ? doc.$extensions[TOKEN_EXT] : null;
  const system = isRec(vendor) && isRec(vendor.brandSystem) ? vendor.brandSystem : null;
  const rows = !system ? [] : list === 'rules' ? system.rules : isRec(system.guide) ? system.guide.groups : [];
  const entries = Array.isArray(rows) ? rows.filter(isRec) : [];
  return ids.map(id => {
    const label = entries.find(e => e.id === id)?.label;
    return typeof label === 'string' && label ? label : id;
  });
}

/** What pressing Remove on this role would mean, in plain words. */
export function explainRemoval(doc: unknown, label: string, inUse: ColourRoleUse | undefined, opts: { canRelease: boolean }): RemovalExplanation {
  const uses: string[] = [];
  const use = inUse ?? { slots: [], rules: [], guideGroups: [], tokens: [], toolBindings: [] };
  if (use.slots.length) {
    uses.push(tRaw('Lolly reads {label} as {slots}. If the role goes, each keeps the colour it draws now.', { label, slots: join(use.slots.map(s => slotWord(s as SlotId))) }));
  }
  if (use.rules.length) uses.push(tRaw('House rules use {label}: {names}. Change those first, in Rules.', { label, names: join(recordLabels(doc, 'rules', use.rules)) }));
  if (use.guideGroups.length) uses.push(tRaw('Guide groups list {label}: {names}. Change those first.', { label, names: join(recordLabels(doc, 'guide', use.guideGroups)) }));
  if (use.toolBindings.length) uses.push(tRaw('A tool field is tied to {label}: {names}. Change that in the token file first.', { label, names: join(use.toolBindings) }));
  if (use.tokens.length) uses.push(tRaw('Other colours link to {label}: {names}. Change those first.', { label, names: join(use.tokens) }));
  return {
    uses,
    unseen: tRaw('A saved Design document can use {label} by name, and Lolly cannot see that from here. One that does will report the colour as unresolved.', { label }),
    releases: opts.canRelease,
    blocked: !opts.canRelease && (use.rules.length + use.guideGroups.length + use.toolBindings.length + use.tokens.length + use.slots.length) > 0,
  };
}

// ── Refusals ─────────────────────────────────────────────────────────────────

/** A refused edit as one plain sentence. Anything without its own wording reads as the engine said. */
export function refusalText(edit: Extract<ColourRoleEdit, { ok: false }>, label = ''): string {
  switch (edit.code) {
    case 'duplicate-label': return tRaw('Another colour role is already called {label}.', { label });
    case 'label-required': return t('A colour role needs a name.');
    case 'label-too-long': return tRaw('A colour role name can have at most {n} characters.', { n: MAX_ROLE_LABEL });
    case 'description-too-long': return tRaw('A description can have at most {n} characters.', { n: MAX_ROLE_DESCRIPTION });
    case 'too-many-roles': return t('A design system can have at most 32 colour roles.');
    case 'not-a-colour': return t('That is not a colour Lolly can read.');
    case 'record-unreadable': return t('The design system record in this file does not validate, so Lolly keeps the file as it is. Correct the record in the file to edit colour roles here.');
    default: return edit.reasons[0] ?? t('That edit could not be made.');
  }
}

/** What reading a role as `slot` would do to the role that holds the slot now, as the option's own words. */
export function readingOption(model: ColourRolesModel, row: RoleTableRow, slot: SlotId): { label: string; disabled: boolean } {
  const holder = model.slotHolders.get(slot);
  if (!holder || holder.roleId === row.key) return { label: slotWord(slot), disabled: false };
  // Each slot takes one role. Choosing one that is held moves the slot here, so the option says who holds it now.
  return { label: tRaw('{slot} ({holder})', { slot: slotWord(slot), holder: holder.label }), disabled: holder.self };
}

export { BINDABLE_COLOUR_SLOTS };
