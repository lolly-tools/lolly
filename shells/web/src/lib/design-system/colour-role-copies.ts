// SPDX-License-Identifier: MPL-2.0
/**
 * A colour role's copies (plans/352): what a design system with colour roles holds for
 * each role in every colourway and look.
 *
 * A role keeps one value per colourway and per look, `color.colourway.<look>.<role>`, with
 * the colour that sits on the role beside each (`on-<role>`), and a slot the role fills
 * under another name links to the role there too. Those are one role, edited in the
 * Colour roles table at the head of the Colours room. The Tokens room, the token lists
 * and the token count show the role once, by its own token `color.semantic.<role>`, and
 * keep these with the role rather than as tokens of their own, so a manager is never
 * shown one colour as several.
 *
 * A system that declares no colour roles has none: `colourRoleCopies` answers null, and
 * every list keeps every token it had. That check comes first and costs nothing, so a
 * role-less system never reads further.
 *
 * Pure and DOM-free.
 */
import type { ColourRoleV1 } from '@lolly-tools/core/brand-system-v1';
import { colourRoleTable, readColourRoles } from '@lolly/engine';

type Rec = Record<string, unknown>;
const record = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);

/** Does this document declare a colour role? Cheap; it decides only whether to read further. */
function declaresRoles(doc: unknown): boolean {
  const ext = record(doc) && record(doc.$extensions) && Object.hasOwn(doc.$extensions, 'com.suse.lolly') ? doc.$extensions['com.suse.lolly'] : null;
  const system = record(ext) && Object.hasOwn(ext, 'brandSystem') ? ext.brandSystem : null;
  return record(system) && Array.isArray(system.roles) && system.roles.some(r => record(r) && r.group === 'colourway');
}

/** `color.colourway.<look>.<name>`: one colourway's value for one name in one look. */
const COPY = /^color\.colourway\.([^.]+)\.([^.]+)$/;

export interface ColourRoleCopies {
  /** The declared colour roles, in the design system's order. */
  roles: readonly ColourRoleV1[];
  /** The role a path is a copy of, or null for a token of its own. */
  roleOf(path: string): ColourRoleV1 | null;
  /** The role whose own token this path is (`color.semantic.<role>`), or null. */
  roleAt(path: string): ColourRoleV1 | null;
  /** A slot's own token where a role of another name fills the slot: a second name for that role. */
  secondNames: ReadonlyMap<string, ColourRoleV1>;
}

/** The copies of each declared colour role, or null on a system that declares none. */
export function colourRoleCopies(doc: unknown): ColourRoleCopies | null {
  if (!declaresRoles(doc)) return null;
  let reading: ReturnType<typeof readColourRoles>;
  try { reading = readColourRoles(doc); } catch { return null; }
  const roles = reading.roles.filter(role => role.declared);
  if (!roles.length) return null;
  const byId = new Map(roles.map(role => [role.id, role]));
  // Each role's copies go by its own id and on-colour, then by each slot it fills.
  const owner = new Map<string, ColourRoleV1>();
  const secondNames = new Map<string, ColourRoleV1>();
  for (const role of roles) { owner.set(role.id, role); owner.set(`on-${role.id}`, role); }
  for (const slot of reading.slots) {
    const role = slot.roleId ? byId.get(slot.roleId) : undefined;
    if (!role) continue;
    if (!owner.has(slot.slot)) owner.set(slot.slot, role);
    if (slot.slot === 'primary' && !owner.has('on-primary')) owner.set('on-primary', role);
    if (slot.slot === role.id) continue;
    secondNames.set(`color.semantic.${slot.slot}`, role);
    // on-primary follows whatever fills primary, so it is the role's own on-colour by another name.
    if (slot.slot === 'primary') secondNames.set('color.semantic.on-primary', role);
  }
  const byPath = new Map(roles.map(role => [role.path, role]));
  return {
    roles,
    roleOf: (path) => { const m = COPY.exec(path); return m ? owner.get(m[2]!) ?? null : null; },
    roleAt: (path) => byPath.get(path) ?? null,
    secondNames,
  };
}

/** The tokens a list shows: every one but a colour role's copies. */
export function withoutRoleCopies<T extends { path: string }>(tokens: readonly T[], copies: ColourRoleCopies | null): T[] {
  return copies ? tokens.filter(t => !copies.roleOf(t.path)) : [...tokens];
}

/** One role's colour in each colourway, light and dark side by side, as the Colour roles table holds them. */
export interface RoleColourwayValues {
  modes: Array<{ id: string; name: string }>;
  rows: Array<{ colourway: string; values: string[] }>;
}

/**
 * Every colourway's value of one role, in the design system's colourway order. One row
 * with an empty name on a system with no colourways. Read the same way the Colour roles
 * table reads them, so the two never disagree.
 */
export function roleValuesByColourway(doc: unknown, roleId: string, colourways: ReadonlyArray<{ id: string; name: string }>): RoleColourwayValues {
  const ids = colourways.length ? colourways : [{ id: '', name: '' }];
  let modes: RoleColourwayValues['modes'] = [];
  const rows: RoleColourwayValues['rows'] = [];
  for (const cw of ids) {
    const table = colourRoleTable(doc, cw.id || null);
    modes = table.modes;
    const row = table.rows.find(r => r.role.id === roleId);
    if (row) rows.push({ colourway: table.colourway?.name ?? cw.name, values: row.cells.map(cell => cell.hex) });
  }
  return { modes, rows };
}
