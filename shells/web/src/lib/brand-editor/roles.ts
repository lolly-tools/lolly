// SPDX-License-Identifier: MPL-2.0
/**
 * brand editor: roles as an assignment layer.
 *
 * Every function takes the shared `bedit: BrandEditorCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `bedit.<module>.<fn>`. Extracted verbatim
 * from mountBrandEditor() by scripts/split-closure.ts.
 */
import { leadTokenSet } from '../design-system/leads.ts';
import { tRaw } from '../../i18n.ts';
import { escape as escapeText } from '../../utils.ts';
import { announce } from '../../a11y.ts';
import { playSfx } from '../sfx.ts';
import { readStarterDoc } from '../design-system/rooms/overview.ts';
import { starterColorIds } from '../design-system/ownership.ts';
import { ROLE_IDS_ALL, assignRole, clearRole, mountRolesStrip, roleLabel, roleWords } from '../design-system/roles.ts';
import { readColourRoles, setRoleValue } from '@lolly/engine';
import { mountRoleChips } from '../design-system/role-chips.ts';
import { roleTargets, targetRole } from '../design-system/role-targets.ts';
import type { RoleId } from '../design-system/roles.ts';
import { bindOp, type BrandEditorCtx } from './context.ts';

/** A swatch key's display name, for the announcements. */
export const nameOfKey = (bedit: BrandEditorCtx, key: string): string => bedit.swatches.find(s => s.key === key)?.name ?? key;
// Every non-role swatch is assignable, INCLUDING the starter's neutrals -
// Surface and Text want paper and ink, and pointing at them on purpose is a
// real decision. What the flag buys is the picker filing them under their own
// "Starter" heading, and the strip painting a role that sits on one in the
// muted register (plan 182 section 4.2).
export const roleSwatchOptions = (bedit: BrandEditorCtx): Array<{ key: string; name: string; hex: string; group?: string; starter?: boolean }> =>
  bedit.swatches.filter(s => s.hex && s.kind !== 'semantic')
    .map(s => ({ key: s.key, name: s.name, hex: s.hex, group: s.group, starter: bedit.ramps.isStarterSwatch(s) }));
export const renderUseAs = (bedit: BrandEditorCtx): void => {
  const { useasRow } = bedit;
  if (!useasRow) return;
  const cur = bedit.selected >= 0 ? bedit.swatches[bedit.selected] : null;
  useasRow.hidden = !cur || cur.kind === 'semantic';
  if (useasRow.hidden || !cur) return;
  const targets = roleTargets(bedit.doc, bedit.state.editContext());
  syncUseAsButtons(useasRow, targets);
  useasRow.querySelectorAll<HTMLElement>('button[data-be-useas]').forEach(b => {
    const target = targets.find(x => x.target === b.dataset.beUseas);
    const pressed = !!target && target.ref === cur.key;
    b.setAttribute('aria-pressed', String(pressed));
    // A lead's own role (plans/319: primary and secondary on a design system with
    // colourways, and the surface when the colourways tint it) can be re-pointed
    // but never cleared, so its pressed button is not a toggle. It stays pressed,
    // because that is still true, and says why pressing it again changes
    // nothing; the strip makes the same promise by offering no empty choice.
    if (target && pressed && target.required) {
      b.setAttribute('aria-disabled', 'true');
      b.title = leadRoleNote(target.label);
    } else {
      b.removeAttribute('aria-disabled');
      b.removeAttribute('title');
    }
  });
  const hint = useasRow.querySelector<HTMLElement>('[data-be-useas-hint]');
  if (hint) { hint.hidden = true; hint.textContent = ''; }
};
/** One button per thing a colour can be: the system's own words when it has them. */
const syncUseAsButtons = (row: HTMLElement, targets: ReturnType<typeof roleTargets>): void => {
  const buttons = [...row.querySelectorAll<HTMLButtonElement>('button[data-be-useas]')];
  if (buttons.length === targets.length && buttons.every((b, i) => b.dataset.beUseas === targets[i]!.target && b.textContent === targets[i]!.label)) return;
  const next = targets.map((target) => {
    const b = row.ownerDocument.createElement('button');
    b.type = 'button'; b.className = 'be-btn be-btn--sm';
    b.dataset.beUseas = target.target;
    b.setAttribute('aria-pressed', 'false');
    b.textContent = target.label;
    return b;
  });
  for (const b of buttons) b.remove();
  row.querySelector('[data-be-useas-hint]')?.before(...next);
};
/** Why a lead's own role cannot be cleared from the "Use as" row. */
export const leadRoleNote = (role: string): string =>
  tRaw('Every colourway needs its own {role}. To change this one, use another colour as {role}.', { role });
export const showFontErr = (bedit: BrandEditorCtx, m: string): void => {
  const { fontErr } = bedit; if (fontErr) { fontErr.textContent = m; fontErr.hidden = !m; } if (m) announce(m, { assertive: true }); };
// One optional face-role chip: an active badge, or a button to assign the role.
export const roleControl = (_bedit: BrandEditorCtx, family: string, active: boolean, activeLabel: string, badgeMod: string, dataAttr: string, assignLabel: string, assignTitle: string): string =>
  active
    ? `<span class="be-font-badge be-font-badge--${badgeMod}">${activeLabel}</span>`
    : `<button type="button" class="be-btn be-font-role" ${dataAttr}="${escapeText(family)}" title="${escapeText(assignTitle)}">${assignLabel}</button>`;
export function wireRolesStrip(bedit: BrandEditorCtx): void {
  const { editorEl, paletteHooks, rolesMount, undoStack } = bedit;
  const resolve = (key: string): unknown => {
    try { return leadTokenSet(bedit.doc, bedit.state.editContext()).resolve(key); }
    catch { return null; }
  };
  // Both role surfaces write through here and report what actually happened: a
  // refused write (a document the role can't land in) re-renders both, so the
  // control snaps back to the truth rather than persisting nothing and
  // announcing success. A colour for one of the system's own roles goes to that role,
  // the same way the Colour roles table writes.
  const assign = (role: RoleId | string, key: string): void => {
    const { lead, mode } = bedit.state.editContext();
    const roleId = targetRole(role) ?? readColourRoles(bedit.doc).slots.find(s => s.slot === role && s.source !== 'system')?.roleId ?? null;
    const declared = roleId && readColourRoles(bedit.doc).roles.some(r => r.id === roleId && r.declared);
    if (roleId && declared) {
      const edit = setRoleValue(bedit.doc, { roleId, colourway: lead, mode, value: `{${key}}` });
      if (!edit.ok) { bedit.rolesStrip?.render(); bedit.roleChips?.render(); return; }
      bedit.state.pushUndo(tRaw('Change {role}', { role: readColourRoles(bedit.doc).roles.find(r => r.id === roleId)?.label ?? roleId }));
      bedit.doc = edit.doc;
    } else if (!assignRole(bedit.doc, role as RoleId, key, bedit.state.editContext())) { bedit.rolesStrip?.render(); bedit.roleChips?.render(); return; }
    bedit.ramps.repaintPalette(); bedit.state.persist(true);
    const shown = roleTargets(bedit.doc, bedit.state.editContext()).find(x => x.target === role)?.label ?? roleLabel(role as RoleId, roleWords(bedit.doc));
    announce(tRaw('{role} is now {name}', { role: shown, name: bedit.roles.nameOfKey(key) }));
  };
  const rolesStrip = rolesMount ? mountRolesStrip(rolesMount, {
    doc: () => bedit.doc as Record<string, unknown>,
    context: bedit.state.editContext,
    // Every slot a tool can read: the strip sits in its own fold under the Colour
    // roles table, so nobody meets these seven rows without asking for them.
    ids: () => ROLE_IDS_ALL,
    resolve,
    swatches: bedit.roles.roleSwatchOptions,
    assign,
    clear: (role) => {
      // A removal: clearing `primary` deletes the token the app's own accent
      // reads, and nothing on screen holds the swatch it pointed at. Snapshot
      // first, and drop it again if there turned out to be nothing to remove.
      const words = roleWords(bedit.doc);
      bedit.state.pushUndo(tRaw('Clear {role}', { role: roleLabel(role, words) }));
      if (!clearRole(bedit.doc, role, bedit.state.editContext())) { undoStack.pop(); rolesStrip?.render(); return; }
      bedit.ramps.repaintPalette(); bedit.state.persist(true);
      announce(tRaw('{role} is not set', { role: roleLabel(role, words) }));
    },
  }) : null; bedit.rolesStrip = rolesStrip;
  paletteHooks.push(() => rolesStrip?.render());

  // The role chips at the top of the room (plan 346 change 7): the same four
  // first decisions, read from the same model and written through the same
  // assign, so the chips and the strip in the wing can never disagree.
  const chipsMount = bedit.ramps.$('[data-be-rolechips]') as HTMLElement | null;
  const roleChips = chipsMount ? mountRoleChips(chipsMount, {
    doc: () => bedit.doc as Record<string, unknown>,
    context: bedit.state.editContext,
    resolve,
    swatches: bedit.roles.roleSwatchOptions,
    assign,
  }) : null; bedit.roleChips = roleChips;
  if (roleChips) { paletteHooks.push(roleChips.render); bedit.cleanups.push(roleChips.destroy); }

  // The swatch popover's "Use as" row - the same assignment, reached from the
  // colour itself. A pressed button means "this swatch IS that role", so
  // pressing it again clears the role rather than re-writing it.
  const useasRow = editorEl?.querySelector<HTMLElement>('[data-be-useas]') ?? null; bedit.useasRow = useasRow;
  // The bulk bar's "Assign roles" menu speaks the system's words too.
  paletteHooks.push(() => {
    const words = roleWords(bedit.doc);
    for (const item of bedit.root.querySelectorAll<HTMLElement>('[data-be-bulk-role]')) item.textContent = roleLabel(item.dataset.beBulkRole as RoleId, words);
  });
}

export async function wireUseAs(bedit: BrandEditorCtx): Promise<void> {
  const { host, undoStack, useasRow } = bedit;
  useasRow?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('button[data-be-useas]');
    const role = btn?.dataset.beUseas;
    if (!role || bedit.selected < 0) return;
    const cur = bedit.swatches[bedit.selected]; if (!cur || cur.kind === 'semantic') return;
    const key = cur.key;
    const wasSet = btn!.getAttribute('aria-pressed') === 'true';
    const target = roleTargets(bedit.doc, bedit.state.editContext()).find(x => x.target === role);
    const label = target?.label ?? role;
    // Un-pressing a lead's own role would remove nothing (clearRole refuses), so
    // say why in the row and to a screen reader instead of doing nothing silently.
    if (wasSet && target?.required) {
      const note = leadRoleNote(label);
      const hint = useasRow?.querySelector<HTMLElement>('[data-be-useas-hint]');
      if (hint) { hint.textContent = note; hint.hidden = false; }
      announce(note);
      return;
    }
    // Un-pressing REMOVES the role (the strip's Clear by another door), so it
    // takes the same snapshot; assigning is not destructive and does not. The
    // snapshot is dropped again if the write turned out to change nothing.
    if (wasSet) bedit.state.pushUndo(tRaw('Clear {role}', { role: label }));
    const roleId = targetRole(role);
    let wrote: boolean;
    if (wasSet) wrote = clearRole(bedit.doc, role as RoleId, bedit.state.editContext());
    else if (roleId) {
      const { lead, mode } = bedit.state.editContext();
      const edit = setRoleValue(bedit.doc, { roleId, colourway: lead, mode, value: `{${key}}` });
      wrote = edit.ok && edit.changed;
      if (edit.ok && edit.changed) { bedit.state.pushUndo(tRaw('Change {role}', { role: label })); bedit.doc = edit.doc; }
    } else wrote = assignRole(bedit.doc, role as RoleId, key, bedit.state.editContext());
    if (!wrote) {
      if (wasSet) undoStack.pop();
      bedit.roles.renderUseAs(); // the button's pressed state describes the doc, not the tap
      return;
    }
    // repaintPalette rebuilds the grid, so re-find the tile the popover is on.
    const path = cur.path;
    bedit.ramps.repaintPalette(); bedit.state.persist(true); playSfx('click');
    const idx = bedit.swatches.findIndex(s => s.path.length === path.length && s.path.every((seg, i) => seg === path[i]));
    if (idx >= 0) { bedit.selected = idx; bedit.replace.refreshTile(idx); }
    bedit.roles.renderUseAs();
    announce(wasSet
      ? tRaw('{role} is not set', { role: label })
      : tRaw('{role} is now {name}', { role: label, name: cur.name }));
  });

  // Which of these colours came with the blank brand rather than from a person
  // (plan 137 C3). AWAITED before the first paint, unlike the fire-and-forget
  // read it replaced: the beat is decided on the own count, and a room that
  // painted first and learned second would show a first-time visitor the whole
  // studio for one frame and then collapse it to a single control. The read is
  // one IDB hit plus a JSON parse, in a mount that already awaits three.
  // starterColorIds walks BOTH themes, because a role's stored value differs
  // between them and either spelling is equally a starter one.
  try {
    const starterDoc = await readStarterDoc(host);
    const pairs = starterDoc ? starterColorIds(starterDoc) : new Set<string>();
    if (pairs.size) bedit.starterSwatches = pairs;
  } catch { /* no starter reachable - the palette claims nothing */ }

  bedit.ramps.repaintPalette();

  // ── Type (the Type room, plan 97 section 7.2) ───────────────────────────────────────
  // Three layers, top to bottom: the four ROLE CARDS (level 0 - what serves each
  // role, and the one action that changes it), the COMPARE STAGE they open (six
  // faces at one size on one specimen; nothing installs until a card is chosen),
  // and the MANAGEMENT LIST of everything already on the device (roles, delete).
  // The stage is presentation only - type-compare.ts installs nothing and this
  // file owns every write, which is why `applyTypeChoice` below is the single
  // place a face becomes an asset and a token.
  const fontErr = bedit.ramps.$('[data-be-font-err]') as HTMLElement | null; bedit.fontErr = fontErr;
}

export function rolesOps(bedit: BrandEditorCtx) {
  return {
    nameOfKey: bindOp(bedit, nameOfKey),
    roleSwatchOptions: bindOp(bedit, roleSwatchOptions),
    renderUseAs: bindOp(bedit, renderUseAs),
    showFontErr: bindOp(bedit, showFontErr),
    roleControl: bindOp(bedit, roleControl),
    wireRolesStrip: bindOp(bedit, wireRolesStrip),
    wireUseAs: bindOp(bedit, wireUseAs),
  };
}
