// SPDX-License-Identifier: MPL-2.0
/**
 * brand editor: the Colour roles table (plans/352 R2), at the head of the Colours room.
 *
 * The table itself lives in design-system/rooms/colour-roles.ts and writes nothing: this
 * module gives it the room's document, the colourway the Colourways row chose, and the one
 * write every Colours room edit takes (undo snapshot, swap, repaint, save). The fold starts
 * open on a system that has words of its own or colours waiting for some, and shut on one
 * that does not, so the default room stays as calm as it was.
 */
import { readColourRoles } from '@lolly/engine';
import type { ColourRoleEdit } from '../../../../../engine/src/colour-roles.ts';
import { assignRole, setRoleValue as setSlotValue } from '../design-system/roles.ts';
import type { RoleId } from '../design-system/roles.ts';
import { mountColourRolesRoom } from '../design-system/rooms/colour-roles.ts';
import type { SlotId } from '../design-system/colour-roles-model.ts';
import { tRaw } from '../../i18n.ts';
import { bindOp, type BrandEditorCtx } from './context.ts';

/** Swap in an edited document: undo snapshot, save, repaint, the steps every edit takes. */
function commit(bedit: BrandEditorCtx, label: string, edit: ColourRoleEdit): boolean {
  if (!edit.ok || !edit.changed) return false;
  bedit.state.pushUndo(label);
  bedit.doc = edit.doc;
  bedit.swatchEditor.closeEditor();
  bedit.ramps.repaintPalette();
  bedit.state.persist(true);
  return true;
}

/** A shipped word's colour goes through its slot, which is all the system has until it declares words. */
function setSlot(bedit: BrandEditorCtx, slot: SlotId, mode: string, value: { key: string } | { literal: string }): boolean {
  const ctx = { lead: bedit.currentLead ?? null, mode };
  bedit.state.pushUndo(tRaw('Change {role}', { role: slot }));
  const wrote = 'key' in value ? assignRole(bedit.doc, slot as RoleId, value.key, ctx) : setSlotValue(bedit.doc, slot as RoleId, value.literal, ctx);
  if (!wrote) { bedit.undoStack.pop(); return false; }
  bedit.ramps.repaintPalette();
  bedit.state.persist(true);
  return true;
}

export function wireColourRoles(bedit: BrandEditorCtx): void {
  const mount = bedit.ramps.$('[data-be-role-table]') as HTMLElement | null;
  if (!mount) return;
  const fold = bedit.ramps.$('[data-be-roles-fold]') as HTMLDetailsElement | null;
  if (fold) fold.open = readColourRoles(bedit.doc).state !== 'default';
  const room = mountColourRolesRoom(mount, {
    doc: () => bedit.doc,
    colourway: () => bedit.currentLead ?? null,
    swatches: bedit.roles.roleSwatchOptions,
    commit: (label, edit) => commit(bedit, label, edit),
    setSlot: (slot, mode, value) => setSlot(bedit, slot, mode, value),
  });
  bedit.rolesRoom = room;
  // Shut, the table draws nothing a person can see, so a repaint leaves it for the next open.
  bedit.paletteHooks.push(() => { if (!fold || fold.open) room.render(); });
  fold?.addEventListener('toggle', () => { if (fold.open) room.render(); });
  bedit.cleanups.push(room.destroy);
  // A colour role's tile in the palette opens the same picker, on the look being shown.
  const onTile = (e: Event): void => {
    const tile = (e.target as HTMLElement).closest<HTMLElement>('[data-be-role-tile]');
    if (tile?.dataset.beRoleTile) room.openValue(tile.dataset.beRoleTile, tile.dataset.beRoleMode ?? 'light', tile);
  };
  bedit.palMount?.addEventListener('click', onTile);
  bedit.cleanups.push(() => bedit.palMount?.removeEventListener('click', onTile));
}

export function colourRolesOps(bedit: BrandEditorCtx) {
  return {
    wireColourRoles: bindOp(bedit, wireColourRoles),
  };
}
