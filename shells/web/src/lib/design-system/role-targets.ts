// SPDX-License-Identifier: MPL-2.0
/**
 * Everything in a design system a colour can be given to, in the order the room lists
 * them (plans/352). A system with no colour roles of its own has today's four slots. One
 * that declares its words has each role in the brand's order, then whichever of the four
 * no role fills. The role chips, the swatch's "Use as" row and the tile marks all read
 * this list, so they cannot disagree about what a colour may be.
 */
import { aliasPath, colourRoleTable, readColourRoles } from '@lolly/engine';
import { editContextOf } from './leads.ts';
import type { EditContextInput } from './leads.ts';
import { ROLE_IDS, readRoles, roleLabel, roleWords } from './roles.ts';
import type { RoleId } from './roles.ts';

export interface RoleTarget {
  /** `role:<id>` for one of the system's own roles, or the slot's id. */
  target: string;
  /** The declared role, or null for a slot written directly. */
  roleId: string | null;
  /** The slot written directly, or null for a declared role. */
  slot: RoleId | null;
  label: string;
  /** The swatch this holds in this context, or null for a literal or nothing. */
  ref: string | null;
  /** Re-pointed but never cleared: a colourway's own colour, or one of the system's roles. */
  required: boolean;
}

const ROLE_PREFIX = 'role:';

/** The role id inside a `role:<id>` target, or null for a slot. */
export const targetRole = (target: string): string | null => (target.startsWith(ROLE_PREFIX) ? target.slice(ROLE_PREFIX.length) : null);

/** Today's four slots, or the system's own words and then what they leave unfilled. */
export function roleTargets(doc: unknown, ctx: EditContextInput, resolve?: (key: string) => unknown): RoleTarget[] {
  const held = readRoles(doc, ctx, resolve);
  const words = roleWords(doc);
  const slotTarget = (slot: RoleId): RoleTarget => ({
    target: slot, roleId: null, slot, label: roleLabel(slot, words), ref: held[slot]?.ref ?? null, required: !!held[slot]?.lead,
  });
  const reading = readColourRoles(doc);
  if (reading.state !== 'declared') return ROLE_IDS.map(slotTarget);
  const { lead, mode } = editContextOf(ctx);
  const rows = new Map(colourRoleTable(doc, lead).rows.map(row => [row.role.id, row]));
  const roles = reading.roles.filter(role => role.declared).map((role): RoleTarget => {
    const cell = rows.get(role.id)?.cells.find(c => c.mode === mode);
    return { target: `${ROLE_PREFIX}${role.id}`, roleId: role.id, slot: null, label: role.label, ref: cell?.stored ? aliasPath(cell.stored) : null, required: true };
  });
  const filled = new Set(reading.slots.filter(s => s.roleId).map(s => s.slot as string));
  return [...roles, ...ROLE_IDS.filter(slot => !filled.has(slot)).map(slotTarget)];
}
