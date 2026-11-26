// SPDX-License-Identifier: MPL-2.0
/**
 * Colour roles in other formats (plans/352 R4): what a role's words become when a
 * design system leaves Lolly, and how they come back.
 *
 * DTCG and Tokens Studio carry the whole record, so they need nothing here. The rest
 * have less room:
 *
 *  - A `DESIGN.md` has no theme and no record. `colourRoleBlock` is the part of a role's
 *    story that fits one file: a visible fenced block in the Colors section, which any
 *    reader of the format can ignore because the tokens are complete on their own.
 *  - A Penpot token keeps `$value`, `$type` and `$description` and nothing else, so the
 *    words go in the description (`roleWordsText`) and come back out of it on every import
 *    route (`restoreColourRoleWords`).
 *  - A PowerPoint theme has six accents and no names, so only the order survives
 *    (`colourRoleThemeAccents`).
 *
 * `adoptColourRoles` is the way back in. It takes a file's colours and the words someone
 * confirmed, and writes the same record, colourway leaves, links and bindings the studio
 * writes, through the same edits. Every word it reads came from a file: bounded, inert, and
 * never read for meaning. Which word means what is a suggestion a shell made and a person
 * saw. Nothing here runs at render time.
 *
 * Pure: documents are cloned, nothing reads a clock or a random source.
 */
import { deriveOnColour, isDerivedOnColourValue } from './brand-derive.ts';
import {
  addColourRole, bindRole, colourRoleIdRefusal, colourRoleTable, MAX_COLOUR_ROLES, MAX_ROLE_DESCRIPTION, MAX_ROLE_LABEL, readColourRoles,
  setRoleSameAsLight, type ColourRoleEdit,
} from './colour-roles.ts';
import {
  colourRoleMarkOf, colourwayAxis, colourwayLinkOf, colourwayPath, colourwaySetOf, COLOURWAY_GROUP, COLOURWAY_ID, declaredColourRoleIds,
  enabledSets, groupAt, groupOf, isLifted, isSafeKey, liftRole, nodeAt, optionIdOf, setColourRoleMark, setNodeAt, setOrder, themeEntries, type LiftOptions,
} from './colourway.ts';
import { parseColor } from './css-color.ts';
import { TOKEN_EXT } from './token-ext.ts';
import { axisOfKind, modeAxis, readTokenAxes, type TokenAxis } from './token-axes.ts';
import { colorToHex, createTokenSet, isAlias, tokenSetNames } from './tokens.ts';

type Rec = Record<string, unknown>;
const record = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);

const SLOTS_ON_THE_SURFACE: readonly string[] = ['surface', 'text', 'muted', 'edge'];

// ─── A PowerPoint theme ──────────────────────────────────────────────────────

/**
 * The token each theme accent reads, in the brand's order, for a PowerPoint theme. A role
 * that fills the background, the text, the quiet text or the hairlines already has its
 * place in the theme (`lt1`, `dk1`, `dk2`), so it is not an accent. The lead and partner
 * colours follow when no role fills them, so a brand whose roles are all read by name
 * still has them on offer. Empty with no declared roles, which is what keeps such a
 * document's theme as it was.
 */
export function colourRoleThemeAccents(doc: unknown): string[] {
  if (!declaredColourRoleIds(doc).length) return [];
  const reading = readColourRoles(doc);
  const declared = reading.roles.filter(role => role.declared);
  if (!declared.length) return [];
  const accents = declared
    .filter(role => !SLOTS_ON_THE_SURFACE.includes(role.id) && !role.slots.some(slot => SLOTS_ON_THE_SURFACE.includes(slot)))
    .map(role => role.path);
  for (const slot of ['primary', 'secondary'] as const) {
    const path = `color.semantic.${slot}`;
    if (!reading.slots.find(s => s.slot === slot)?.roleId && !accents.includes(path)) accents.push(path);
  }
  return accents;
}

// ─── A Penpot token's description ────────────────────────────────────────────

const ROLE_WORDS = /^Colour role (\d{1,2}) of (\d{1,2}) "([^"\n]{1,120})"(?:\. ([^\n]*))?(?:\n([\s\S]*))?$/;

/**
 * A role's words as a Penpot token's description. Penpot keeps `$description` and drops
 * `$extensions`, so this is the one place the words can travel. The first line is plain
 * enough to read in Penpot's own token list and exact enough to read back, with the
 * role's place in the brand's order, which token order does not hold. A description the
 * token already had stays, on the lines after: a role's words never hold a line break.
 */
export function roleWordsText(words: { label: string; description?: string; position: number; total: number }, own?: string): string {
  const label = String(words.label).replace(/["\n\r]+/g, ' ').trim().slice(0, MAX_ROLE_LABEL);
  const about = typeof words.description === 'string' ? words.description.replace(/\s*[\n\r]+\s*/g, ' ').trim() : '';
  const first = `Colour role ${words.position} of ${words.total} "${label}"${about ? `. ${about}` : ''}`;
  return own ? `${first}\n${own}` : first;
}

/** What `roleWordsText` wrote, or null for any other description. */
export function readRoleWords(text: unknown): { position: number; label: string; description?: string; own?: string } | null {
  if (typeof text !== 'string') return null;
  const hit = ROLE_WORDS.exec(text.trim().slice(0, 8192));
  if (!hit) return null;
  const label = hit[3]!.trim();
  if (!label) return null;
  const description = hit[4]?.trim();
  const own = hit[5]?.trim();
  return { position: Number(hit[1]), label, ...(description ? { description } : {}), ...(own ? { own } : {}) };
}

/**
 * A document that came back with role words in its token descriptions: the record comes
 * back from them, every description goes back to what the token said for itself, and the
 * bindings come from the links the colourways still hold. A file with none of those words
 * is returned as the same object, so no other document changes on any import route.
 *
 * This reads Lolly's own wording exactly and never reads meaning into a word. A file that
 * declares its roles keeps its record, and only the descriptions are tidied. When the roles
 * cannot be written the words still leave the descriptions, because they would otherwise
 * show up as swatch names, and the warning says so. Text the scope hints flag is out of the
 * document before this runs, so it cannot become a role's words.
 */
export function restoreColourRoleWords<T extends Rec>(doc: T): { doc: T | Rec; warnings: string[] } {
  const sets = tokenSetNames(doc);
  const carrying = new Map<string, NonNullable<ReturnType<typeof readRoleWords>>>();
  for (const set of sets ?? ['']) {
    const semantic = groupAt(set ? doc[set] : doc, ['color', 'semantic']);
    if (!semantic) continue;
    for (const key of Object.keys(semantic)) {
      const leaf = semantic[key];
      const said = record(leaf) ? readRoleWords(leaf.$description) : null;
      if (said && !carrying.has(key) && carrying.size < MAX_COLOUR_ROLES) carrying.set(key, said);
    }
  }
  if (!carrying.size) return { doc, warnings: [] };
  const clean = structuredClone(doc) as Rec;
  for (const set of sets ?? ['']) {
    const semantic = groupAt(set ? clean[set] : clean, ['color', 'semantic']);
    if (!semantic) continue;
    for (const key of Object.keys(semantic)) {
      const leaf = semantic[key];
      const said = record(leaf) ? readRoleWords(leaf.$description) : null;
      if (!said) continue;
      if (said.own) (leaf as Rec).$description = said.own;
      else delete (leaf as Rec).$description;
    }
  }
  if (declaredColourRoleIds(clean).length) return { doc: clean, warnings: [] };
  const reading = readColourRoles(withColourwayKindRestored(clean));
  const specs: AdoptedColourRole[] = [...carrying]
    .filter(([id]) => !colourRoleIdRefusal(id))
    .sort(([a, wordsA], [b, wordsB]) => wordsA.position - wordsB.position || (a < b ? -1 : a > b ? 1 : 0))
    .map(([id, said]) => {
      const fills = reading.roles.find(role => role.id === id)?.slots[0];
      return { id, label: said.label, ...(said.description ? { description: said.description } : {}), ...(fills && fills !== id ? { fills } : {}) };
    });
  const adopted = adoptColourRoles(clean, specs);
  if (!adopted.ok) return { doc: clean, warnings: [`The colour roles this file names could not be restored, so their words were left out: ${adopted.reasons[0] ?? adopted.code}`] };
  return { doc: adopted.doc, warnings: [] };
}

// ─── A file's colourway group ────────────────────────────────────────────────

/**
 * A theme group called `colourway` that has lost its kind, which is what a Penpot round
 * trip does to one, gets the kind back. A document that declares its kinds comes back as
 * the same object, and so does one with no such group.
 */
export function withColourwayKindRestored(doc: unknown): unknown {
  if (!record(doc)) return doc;
  const { axes } = readTokenAxes(doc);
  if (axisOfKind(axes, 'colourway')) return doc;
  const group = axes.find(axis => axis.group === COLOURWAY_GROUP && axis.kind === null);
  if (!group) return doc;
  const next = structuredClone(doc);
  let first = true;
  for (const entry of themeEntries(next)) {
    if (groupOf(entry) !== COLOURWAY_GROUP) continue;
    if (!record(entry.$extensions)) entry.$extensions = {};
    const ext = entry.$extensions as Rec;
    if (!record(ext[TOKEN_EXT])) ext[TOKEN_EXT] = {};
    (ext[TOKEN_EXT] as Rec).axis = { kind: 'colourway', ...(first ? { canonical: true } : {}) };
    first = false;
  }
  return next;
}

// ─── Adopting a file's words ─────────────────────────────────────────────────

export interface AdoptedColourRole {
  /** The role's permanent id. */
  id: string;
  label: string;
  description?: string;
  /** The token its colours come from. Absent when `color.semantic.<id>` already holds them. */
  from?: string;
  /** The slot it fills, or nothing to read it by name only. */
  fills?: string;
}

export interface AdoptColourRolesOptions {
  /** Tokens for slots no role fills, as `slot` to path, for a file that defines the slot nowhere. */
  slots?: Readonly<Record<string, string | undefined>>;
  /** The canonical colourway a one-lead document gains. */
  lift?: LiftOptions;
  /** The record's label, when the document has no record yet. */
  systemLabel?: string;
}

const uniqueSetName = (taken: ReadonlySet<string>, name: string): string => {
  if (!taken.has(name)) return name;
  for (let i = 2; ; i += 1) if (!taken.has(`${name} ${i}`)) return `${name} ${i}`;
};

/**
 * A document with light and dark themes, which is what colourways and roles are written
 * into. A flat DTCG file or a themeless layered one has a single look, so both looks start
 * the same. A document with themes that are not light and dark gets null.
 */
function withLooks(doc: Rec): Rec | null {
  const themes = Array.isArray(doc.$themes) ? doc.$themes : [];
  if (themes.length) return modeAxis(readTokenAxes(doc).axes) ? structuredClone(doc) : null;
  const layered = tokenSetNames(doc);
  const next: Rec = {};
  const putOwn = (key: string, value: unknown): void => { Object.defineProperty(next, key, { value, enumerable: true, writable: true, configurable: true }); };
  const clone = structuredClone(doc);
  let sets: string[];
  if (layered) {
    sets = [...layered];
    for (const key of Object.keys(clone)) putOwn(key, clone[key]);
  } else {
    const base: Rec = {};
    for (const key of Object.keys(clone)) {
      if (key === '$description' || key === '$extensions' || key === '$schema' || key === '$metadata' || key === '$themes') putOwn(key, clone[key]);
      else Object.defineProperty(base, key, { value: clone[key], enumerable: true, writable: true, configurable: true });
    }
    putOwn('base', base);
    sets = ['base'];
  }
  const taken = new Set(sets);
  const light = uniqueSetName(taken, 'light');
  taken.add(light);
  const dark = uniqueSetName(taken, 'dark');
  putOwn(light, {});
  putOwn(dark, {});
  const metadata = record(next.$metadata) ? next.$metadata : {};
  const active = Array.isArray(metadata.activeSets) ? { activeSets: [...metadata.activeSets, light] } : {};
  putOwn('$metadata', { ...metadata, ...active, tokenSetOrder: [...sets, light, dark] });
  const selected = (own: string): Rec => Object.fromEntries([...sets, own].map(set => [set, 'enabled']));
  putOwn('$themes', [
    { id: 'light', name: 'light', selectedTokenSets: selected(light) },
    { id: 'dark', name: 'dark', selectedTokenSets: selected(dark) },
  ]);
  return next;
}

/** The last set this look alone turns on. */
function ownSet(doc: Rec, mode: TokenAxis, option: string): string | null {
  const entries = themeEntries(doc).filter(t => groupOf(t) === mode.group);
  const mine = enabledSets(entries.find(t => optionIdOf(t) === option) ?? {});
  const others = entries.filter(t => optionIdOf(t) !== option).flatMap(enabledSets);
  return setOrder(doc).filter(set => mine.includes(set) && !others.includes(set)).at(-1) ?? null;
}

/** Give each look a value for a slot it does not define. The value may be per look. */
function fillSlot(doc: Rec, mode: TokenAxis, slot: string, value: (look: string) => string | null): string[] {
  const path = `color.semantic.${slot}`;
  for (const look of mode.options) {
    if (createTokenSet(doc, { selection: { [mode.group]: look.id } }).has(path)) continue;
    const own = ownSet(doc, mode, look.id);
    if (!own || !isSafeKey(own)) return [`The ${look.name} theme has no token set of its own to hold ${slot}.`];
    const written = value(look.id);
    if (written === null) continue;
    if (!record(doc[own])) doc[own] = {};
    setNodeAt(doc[own] as Rec, path, { $value: written, $type: 'color' });
  }
  return [];
}

const refused = (code: 'no-colourways' | 'unknown-role' | 'foreign-encoding', ...reasons: string[]): ColourRoleEdit => ({ ok: false, code, reasons });

/**
 * Bring a file's colours in as colour roles, in the words someone confirmed. The first
 * refusal stops everything and is returned, and the document stays as it was: the caller
 * then installs the file as written.
 *
 * Each role's colours stay where the file put them: `from` becomes a link from the role's
 * leaf to that token, in every colourway and look, so a per-look token keeps its per-look
 * values. A slot the file never defines takes the role that fills it, and the slots a
 * colourway cannot do without (`primary`, its on-colour, `secondary`) take the first role
 * rather than stay empty. On-colours follow the same rule as anywhere else, except that a
 * value that reads as one Lolly picked comes back marked as derived.
 *
 * No specs leaves the document untouched.
 */
export function adoptColourRoles(doc: unknown, specs: readonly AdoptedColourRole[], opts: AdoptColourRolesOptions = {}): ColourRoleEdit {
  if (!record(doc)) return refused('foreign-encoding', 'This is not a design system.');
  if (!specs.length) return { ok: true, doc: structuredClone(doc), changed: false };
  const restored = withColourwayKindRestored(doc) as Rec;
  const next = withLooks(restored);
  if (!next) return refused('no-colourways', 'The themes in this file are not light and dark, so colour roles cannot be added yet.');
  const mode = modeAxis(readTokenAxes(next).axes);
  if (!mode) return refused('no-colourways', 'The themes in this file are not light and dark, so colour roles cannot be added yet.');

  const sourceOf = (spec: AdoptedColourRole): string => spec.from ?? `color.semantic.${spec.id}`;
  const filling = (slot: string): AdoptedColourRole | undefined => specs.find(spec => spec.fills === slot || spec.id === slot);
  const anySource = (slot: string): string | undefined => {
    const role = filling(slot);
    return role ? sourceOf(role) : opts.slots?.[slot];
  };
  const leadSource = anySource('primary') ?? sourceOf(specs[0]!);
  const reasons: string[] = [
    ...fillSlot(next, mode, 'primary', () => `{${leadSource}}`),
    ...fillSlot(next, mode, 'secondary', () => `{${anySource('secondary') ?? leadSource}}`),
  ];
  for (const slot of SLOTS_ON_THE_SURFACE) {
    const source = anySource(slot);
    if (source) reasons.push(...fillSlot(next, mode, slot, () => `{${source}}`));
  }
  reasons.push(...fillSlot(next, mode, 'on-primary', (look) => {
    const hex = colorToHex(createTokenSet(next, { selection: { [mode.group]: look } }).resolve('color.semantic.primary'));
    return typeof hex === 'string' ? deriveOnColour(hex) : null;
  }));
  if (reasons.length) return refused('foreign-encoding', ...reasons);

  let current: Rec = next;
  for (const spec of specs) {
    const added = addColourRole(current, {
      id: spec.id, label: spec.label,
      ...(spec.description ? { description: spec.description } : {}),
      ...(spec.from ? { value: `{${spec.from}}` } : {}),
      ...(opts.lift ? { lift: opts.lift } : {}),
      ...(opts.systemLabel ? { systemLabel: opts.systemLabel } : {}),
    });
    if (!added.ok) return added;
    current = added.doc;
  }
  const lifted = liftStatedOnColours(current, specs);
  if (lifted.length) return refused('foreign-encoding', ...lifted);
  for (const spec of specs) {
    if (!spec.fills || spec.fills === spec.id) continue;
    const bound = bindRole(current, spec.fills, spec.id);
    if (!bound.ok) return bound;
    current = bound.doc;
  }
  return { ok: true, doc: markDerivedOnColours(current), changed: true };
}

/**
 * An on-colour a file states moves into the colourways like its role, so a second
 * colourway can state its own. Changes `doc` in place: it is the adoption's own copy.
 */
function liftStatedOnColours(doc: Rec, specs: readonly AdoptedColourRole[]): string[] {
  const axis = colourwayAxis(doc);
  const mode = modeAxis(readTokenAxes(doc).axes);
  if (!axis || !mode) return [];
  const reasons: string[] = [];
  for (const spec of specs) {
    const onId = `on-${spec.id}`;
    if (spec.id === 'primary' || isLifted(doc, onId, mode)) continue;
    if (!mode.options.every(look => createTokenSet(doc, { selection: { [mode.group]: look.id } }).has(`color.semantic.${onId}`))) continue;
    reasons.push(...liftRole(doc, onId, mode, axis));
  }
  return reasons;
}

/** An on-colour that reads as one Lolly picked comes back marked, which a format with no room for the mark loses. */
function markDerivedOnColours(doc: Rec): Rec {
  const axis = colourwayAxis(doc);
  const mode = modeAxis(readTokenAxes(doc).axes);
  if (!axis || !mode) return doc;
  const next = structuredClone(doc);
  for (const role of readColourRoles(next).roles.filter(r => r.declared)) {
    if (role.id === 'primary') continue;
    const onId = `on-${role.id}`;
    for (const option of axis.options) {
      const set = colourwaySetOf(next, axis, option.id);
      if (!set) continue;
      for (const look of mode.options) {
        const node = nodeAt(next[set], colourwayPath(look.id, onId));
        if (!node || colourRoleMarkOf(node)) continue;
        const link = colourwayLinkOf(node.$value);
        const target = link && link.role === onId ? nodeAt(next[set], colourwayPath(link.mode, onId))?.$value : node.$value;
        if (isDerivedOnColourValue(target)) setColourRoleMark(node, { derived: true });
      }
    }
  }
  return next;
}

// ─── A DESIGN.md's block ─────────────────────────────────────────────────────

export const COLOUR_ROLE_BLOCK_FORMAT = 'lolly-colour-roles';
const MAX_BLOCK_CHARS = 256 * 1024;
const MAX_BLOCK_MODES = 8;
const MAX_BLOCK_NAMES = 256;

/** What one DESIGN.md can say about colour roles beyond its tokens. */
export interface ColourRoleBlockV1 {
  format: typeof COLOUR_ROLE_BLOCK_FORMAT;
  version: 1;
  /** The colourway this file's tokens are for. */
  colourway?: { id: string; name: string };
  /** The look this file's tokens are for. */
  mode?: string;
  modes: Array<{ id: string; name: string }>;
  /** In the brand's order. */
  roles: Array<{ id: string; label: string; description?: string; fills?: string[] }>;
  /** Every `color.semantic.*` value of this colourway, per look. */
  looks: Record<string, Record<string, string>>;
  /** On-colours Lolly worked out, per look, so they come back marked rather than as stated. */
  derived?: Record<string, string[]>;
  /** A look that follows another for a role: look, then role, to the look it follows. */
  sameAs?: Record<string, Record<string, string>>;
}

/** The block for one colourway of a document, or null with no declared roles. */
export function colourRoleBlock(doc: unknown, selection: Readonly<Record<string, string>> = {}): ColourRoleBlockV1 | null {
  if (!declaredColourRoleIds(doc).length) return null;
  const { axes } = readTokenAxes(doc);
  const axis = axisOfKind(axes, 'colourway');
  const mode = modeAxis(axes);
  const option = axis ? (axis.options.find(o => o.id === selection[axis.group]) ?? axis.options.find(o => o.id === axis.canonical) ?? null) : null;
  const table = colourRoleTable(doc, option?.id ?? null);
  const declared = table.rows.filter(row => row.role.declared);
  if (!declared.length) return null;
  const base: Record<string, string> = axis && option ? { [axis.group]: option.id } : {};
  const looks: ColourRoleBlockV1['looks'] = {};
  const options = mode ? mode.options.filter(o => isSafeKey(o.id)) : [];
  const namesIn = (extra: Record<string, string>): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const c of createTokenSet(doc, { selection: { ...base, ...extra } }).colors()) {
      if (!c.path.startsWith('color.semantic.') || typeof c.value !== 'string' || !parseColor(c.value)) continue;
      const name = c.path.slice('color.semantic.'.length);
      if (/^[a-z][a-z-]*$/.test(name)) out[name] = c.value;
    }
    return out;
  };
  if (mode) for (const look of options) looks[look.id] = namesIn({ [mode.group]: look.id });
  else looks.default = namesIn({});
  const derived: NonNullable<ColourRoleBlockV1['derived']> = {};
  const sameAs: NonNullable<ColourRoleBlockV1['sameAs']> = {};
  for (const row of declared) {
    for (const cell of row.cells) {
      if (!cell.mode) continue;
      if (cell.onColour.origin === 'derived') derived[cell.mode] = [...(derived[cell.mode] ?? []), `on-${row.role.id}`];
      if (cell.sameAs) sameAs[cell.mode] = { ...sameAs[cell.mode], [row.role.id]: cell.sameAs };
    }
  }
  const look = mode ? options.find(o => o.id === selection[mode.group]) ?? options[0] : undefined;
  return {
    format: COLOUR_ROLE_BLOCK_FORMAT,
    version: 1,
    ...(option ? { colourway: { id: option.id, name: option.name } } : {}),
    ...(look ? { mode: look.id } : {}),
    modes: options.map(o => ({ id: o.id, name: o.name })),
    roles: declared.map(row => ({
      id: row.role.id, label: row.role.label,
      ...(row.role.description ? { description: row.role.description } : {}),
      ...(row.role.slots.length ? { fills: [...row.role.slots] } : {}),
    })),
    looks,
    ...(Object.keys(derived).length ? { derived } : {}),
    ...(Object.keys(sameAs).length ? { sameAs } : {}),
  };
}

const LOOK_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const VALUE_NAME = /^[a-z][a-z-]{0,63}$/;
const inert = (value: unknown, limit: number): string => (typeof value === 'string' ? Array.from(value.slice(0, limit * 4)).filter(ch => {
  const code = ch.codePointAt(0)!;
  return !(code < 0x20 || (code >= 0x7f && code <= 0x9f) || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069));
}).join('').trim().slice(0, limit) : '');

/**
 * A block from a file, or the reason it is not one. A file is someone else's data, so
 * every id, colour and word is checked on the way past and nothing else is kept. A colour
 * has to be a literal: a link in here could reach anywhere in the receiving document.
 */
export function readColourRoleBlock(text: string): { ok: true; block: ColourRoleBlockV1 } | { ok: false; reason: string } | null {
  if (typeof text !== 'string' || !text.includes(COLOUR_ROLE_BLOCK_FORMAT)) return null;
  if (text.length > MAX_BLOCK_CHARS) return { ok: false, reason: 'The colour role block is too long to read.' };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  if (!record(raw) || raw.format !== COLOUR_ROLE_BLOCK_FORMAT) return null;
  const no = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });
  if (raw.version !== 1) return no('The colour role block is from another version of the format.');
  if (!Array.isArray(raw.roles) || !raw.roles.length || raw.roles.length > MAX_COLOUR_ROLES) return no('The colour role block lists no roles, or too many.');
  const roles: ColourRoleBlockV1['roles'] = [];
  const seen = new Set<string>();
  for (const row of raw.roles) {
    if (!record(row) || colourRoleIdRefusal(row.id) || seen.has(row.id as string)) return no('A colour role in the block has an id Lolly cannot use.');
    seen.add(row.id as string);
    const label = inert(row.label, MAX_ROLE_LABEL);
    if (!label) return no('A colour role in the block has no name.');
    const description = inert(row.description, MAX_ROLE_DESCRIPTION);
    const fills = Array.isArray(row.fills) ? row.fills.filter((s): s is string => typeof s === 'string' && ['primary', 'secondary', 'surface', 'text', 'muted', 'edge'].includes(s)).slice(0, 6) : [];
    roles.push({ id: row.id as string, label, ...(description ? { description } : {}), ...(fills.length ? { fills } : {}) });
  }
  const modes: ColourRoleBlockV1['modes'] = [];
  for (const row of Array.isArray(raw.modes) ? raw.modes.slice(0, MAX_BLOCK_MODES) : []) {
    if (!record(row) || typeof row.id !== 'string' || !LOOK_NAME.test(row.id) || modes.some(m => m.id === row.id)) return no('A look in the colour role block has an id Lolly cannot use.');
    modes.push({ id: row.id, name: inert(row.name, 80) || row.id });
  }
  const looks: ColourRoleBlockV1['looks'] = {};
  if (!record(raw.looks)) return no('The colour role block lists no colours.');
  for (const look of Object.keys(raw.looks).slice(0, MAX_BLOCK_MODES)) {
    const values = raw.looks[look];
    if (!LOOK_NAME.test(look) || !record(values)) return no('A look in the colour role block has an id Lolly cannot use.');
    const names = Object.keys(values);
    if (names.length > MAX_BLOCK_NAMES) return no('The colour role block lists too many colours.');
    const kept: Record<string, string> = Object.create(null);
    for (const name of names) {
      const value = values[name];
      if (!VALUE_NAME.test(name) || !isSafeKey(name) || typeof value !== 'string' || isAlias(value) || !parseColor(value)) return no('A colour in the block could not be read.');
      kept[name] = value;
    }
    Object.defineProperty(looks, look, { value: { ...kept }, enumerable: true, writable: true, configurable: true });
  }
  const colourway = record(raw.colourway) && typeof raw.colourway.id === 'string' && COLOURWAY_ID.test(raw.colourway.id)
    ? { id: raw.colourway.id, name: inert(raw.colourway.name, 80) || raw.colourway.id } : undefined;
  const mode = typeof raw.mode === 'string' && LOOK_NAME.test(raw.mode) ? raw.mode : undefined;
  if (mode && modes.length && !modes.some(m => m.id === mode)) return no('The colour role block gives a look it does not list.');
  const derived: NonNullable<ColourRoleBlockV1['derived']> = {};
  if (record(raw.derived)) {
    for (const look of Object.keys(raw.derived).slice(0, MAX_BLOCK_MODES)) {
      const names = raw.derived[look];
      if (!LOOK_NAME.test(look) || !Array.isArray(names)) continue;
      const kept = names.filter((s): s is string => typeof s === 'string' && s.startsWith('on-') && VALUE_NAME.test(s)).slice(0, MAX_BLOCK_NAMES);
      Object.defineProperty(derived, look, { value: kept, enumerable: true, writable: true, configurable: true });
    }
  }
  const sameAs: NonNullable<ColourRoleBlockV1['sameAs']> = {};
  if (record(raw.sameAs)) {
    for (const look of Object.keys(raw.sameAs).slice(0, MAX_BLOCK_MODES)) {
      const rows = raw.sameAs[look];
      if (!LOOK_NAME.test(look) || !record(rows)) continue;
      for (const role of Object.keys(rows).slice(0, MAX_COLOUR_ROLES)) {
        const from = rows[role];
        if (seen.has(role) && typeof from === 'string' && LOOK_NAME.test(from)) {
          if (!Object.hasOwn(sameAs, look)) Object.defineProperty(sameAs, look, { value: {}, enumerable: true, writable: true, configurable: true });
          Object.defineProperty(sameAs[look]!, role, { value: from, enumerable: true, writable: true, configurable: true });
        }
      }
    }
  }
  return {
    ok: true,
    block: {
      format: COLOUR_ROLE_BLOCK_FORMAT, version: 1,
      ...(colourway ? { colourway } : {}), ...(mode ? { mode } : {}),
      modes, roles, looks,
      ...(Object.keys(derived).length ? { derived } : {}),
      ...(Object.keys(sameAs).length ? { sameAs } : {}),
    },
  };
}

/**
 * Rebuild a design system from a DESIGN.md's tokens and its block: the file's own look
 * from its normative tokens, the other look from the block, the roles through
 * `adoptColourRoles`. `own` is the file's `color.semantic.*` values, by name, and `rest` is
 * every token that is not one of those (type, radii, named colours). A colourway the file
 * does not hold cannot come back: the format has room for one.
 */
export function colourRolesFromBlock(block: ColourRoleBlockV1, own: Readonly<Record<string, string>>, rest: Rec, extensions: Rec, description: string | null, systemLabel?: string): ColourRoleEdit {
  const modes = block.modes.length ? block.modes : [{ id: 'light', name: 'light' }, { id: 'dark', name: 'dark' }];
  const fromTokens = block.mode ?? modes[0]!.id;
  const setsOf = (look: string): Rec => {
    const stated: Record<string, string> = look === fromTokens || !Object.hasOwn(block.looks, look) ? { ...own } : { ...block.looks[look] };
    const semantic: Rec = {};
    for (const name of Object.keys(stated)) Object.defineProperty(semantic, name, { value: { $value: stated[name] }, enumerable: true, writable: true, configurable: true });
    return { color: { $type: 'color', semantic } };
  };
  const taken = new Set(['base']);
  const doc: Rec = {
    ...(description ? { $description: description } : {}),
    $metadata: { tokenSetOrder: ['base', ...modes.map(m => m.id)] },
    $themes: modes.map(m => ({ id: m.id, name: m.name, selectedTokenSets: { base: 'enabled', [m.id]: 'enabled' } })),
    base: rest,
    $extensions: extensions,
  };
  for (const m of modes) {
    if (taken.has(m.id)) return refused('foreign-encoding', 'A look in the colour role block is called base.');
    taken.add(m.id);
    Object.defineProperty(doc, m.id, { value: setsOf(m.id), enumerable: true, writable: true, configurable: true });
  }
  const lift: LiftOptions | undefined = block.colourway ? { id: block.colourway.id, name: block.colourway.name } : undefined;
  const adopted = adoptColourRoles(doc, block.roles.map(role => ({
    id: role.id, label: role.label,
    ...(role.description ? { description: role.description } : {}),
    ...(role.fills?.[0] ? { fills: role.fills[0] } : {}),
  })), { ...(lift ? { lift } : {}), ...(systemLabel ? { systemLabel } : {}) });
  if (!adopted.ok) return adopted;
  let current = adopted.doc;
  // A role read as more than one slot: the first went through adoption, the rest follow.
  for (const role of block.roles) {
    for (const slot of role.fills?.slice(1) ?? []) {
      const bound = bindRole(current, slot, role.id);
      if (!bound.ok) return bound;
      current = bound.doc;
    }
  }
  current = markBlockOnColours(current, block);
  for (const look of Object.keys(block.sameAs ?? {})) {
    for (const role of Object.keys(block.sameAs![look]!)) {
      const followed = setRoleSameAsLight(current, { roleId: role, mode: look, from: block.sameAs![look]![role]! });
      // A pair the rest of the file contradicts keeps the values it has, which are already right.
      if (followed.ok) current = followed.doc;
    }
  }
  return { ok: true, doc: current, changed: true };
}

/** Each on-colour the block says Lolly worked out comes back marked, and the colour on the lead follows its role again. */
function markBlockOnColours(doc: Rec, block: ColourRoleBlockV1): Rec {
  const axis = colourwayAxis(doc);
  const mode = modeAxis(readTokenAxes(doc).axes);
  if (!axis || !mode) return doc;
  const next = structuredClone(doc);
  const lead = block.roles.find(role => role.fills?.includes('primary'));
  for (const option of axis.options) {
    const set = colourwaySetOf(next, axis, option.id);
    if (!set) continue;
    for (const look of mode.options) {
      const derived = block.derived?.[look.id] ?? [];
      for (const name of derived) {
        const node = nodeAt(next[set], colourwayPath(look.id, name));
        if (node) setColourRoleMark(node, { derived: true });
      }
      if (lead && derived.includes(`on-${lead.id}`)) {
        const on = nodeAt(next[set], colourwayPath(look.id, 'on-primary'));
        if (on) on.$value = `{${colourwayPath(look.id, `on-${lead.id}`)}}`;
      }
    }
  }
  return next;
}
