// SPDX-License-Identifier: MPL-2.0
/**
 * brand editor: roles as an assignment layer.
 *
 * Every function takes the shared `bedit: BrandEditorCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `bedit.<module>.<fn>`. Extracted verbatim
 * from mountBrandEditor() by scripts/split-closure.ts.
 */
import { createTokenSet } from '@lolly/engine';
import { tRaw } from '../../i18n.ts';
import { escape as escapeText } from '../../utils.ts';
import { announce } from '../../a11y.ts';
import { playSfx } from '../sfx.ts';
import { readStarterDoc } from '../design-system/rooms/overview.ts';
import { starterColorIds } from '../design-system/ownership.ts';
import { ROLE_IDS, ROLE_IDS_ALL, assignRole, clearRole, mountRolesStrip, readRoles, roleLabel } from '../design-system/roles.ts';
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
  const held = readRoles(bedit.doc, bedit.addColor.roleTheme());
  useasRow.querySelectorAll<HTMLElement>('[data-be-useas]').forEach(b => {
    const role = b.dataset.beUseas as RoleId | undefined;
    b.setAttribute('aria-pressed', String(!!role && held[role]?.ref === cur.key));
  });
};
export const showFontErr = (bedit: BrandEditorCtx, m: string): void => {
  const { fontErr } = bedit; if (fontErr) { fontErr.textContent = m; fontErr.hidden = !m; } if (m) announce(m, { assertive: true }); };
// One optional face-role chip: an active badge, or a button to assign the role.
export const roleControl = (_bedit: BrandEditorCtx, family: string, active: boolean, activeLabel: string, badgeMod: string, dataAttr: string, assignLabel: string, assignTitle: string): string =>
  active
    ? `<span class="be-font-badge be-font-badge--${badgeMod}">${activeLabel}</span>`
    : `<button type="button" class="be-btn be-font-role" ${dataAttr}="${escapeText(family)}" title="${escapeText(assignTitle)}">${assignLabel}</button>`;
export function wireRolesStrip(bedit: BrandEditorCtx): void {
  const { editorEl, paletteHooks, rolesMount, undoStack } = bedit;
  const rolesStrip = rolesMount ? mountRolesStrip(rolesMount, {
    doc: () => bedit.doc as Record<string, unknown>,
    theme: bedit.addColor.roleTheme,
    // Four slots until there is a palette, then every slot a tool can read
    // (plan 182 section 5.7 step 1). Seven rows in front of somebody who has
    // just added their first colour is a form; four is a strip.
    ids: () => (bedit.beat >= 2 ? ROLE_IDS_ALL : ROLE_IDS),
    resolve: (key) => {
      try { return createTokenSet(bedit.doc, { theme: bedit.addColor.roleTheme() }).resolve(key); }
      catch { return null; }
    },
    swatches: bedit.roles.roleSwatchOptions,
    // Both callbacks report what actually happened: a refused write (a document
    // the role can't land in) re-renders the strip so the picker snaps back to
    // the truth, rather than persisting nothing and announcing success.
    assign: (role, key) => {
      if (!assignRole(bedit.doc, role, key, bedit.addColor.roleTheme())) { rolesStrip?.render(); return; }
      bedit.ramps.repaintPalette(); bedit.state.persist(true);
      announce(tRaw('{role} is now {name}', { role: roleLabel(role), name: bedit.roles.nameOfKey(key) }));
    },
    clear: (role) => {
      // A removal: clearing `primary` deletes the token the app's own accent
      // reads, and nothing on screen holds the swatch it pointed at. Snapshot
      // first, and drop it again if there turned out to be nothing to remove.
      bedit.state.pushUndo(tRaw('Clear {role}', { role: roleLabel(role) }));
      if (!clearRole(bedit.doc, role, bedit.addColor.roleTheme())) { undoStack.pop(); rolesStrip?.render(); return; }
      bedit.ramps.repaintPalette(); bedit.state.persist(true);
      announce(tRaw('{role} is not set', { role: roleLabel(role) }));
    },
  }) : null; bedit.rolesStrip = rolesStrip;
  paletteHooks.push(() => rolesStrip?.render());

  // The swatch popover's "Use as" row - the same assignment, reached from the
  // colour itself. A pressed button means "this swatch IS that role", so
  // pressing it again clears the role rather than re-writing it.
  const useasRow = editorEl?.querySelector<HTMLElement>('[data-be-useas]') ?? null; bedit.useasRow = useasRow;
}

export async function wireUseAs(bedit: BrandEditorCtx): Promise<void> {
  const { host, undoStack, useasRow } = bedit;
  useasRow?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-be-useas]');
    const role = btn?.dataset.beUseas as RoleId | undefined;
    if (!role || bedit.selected < 0) return;
    const cur = bedit.swatches[bedit.selected]; if (!cur || cur.kind === 'semantic') return;
    const key = cur.key;
    const wasSet = btn!.getAttribute('aria-pressed') === 'true';
    // Un-pressing REMOVES the role (the strip's Clear by another door), so it
    // takes the same snapshot; assigning is not destructive and does not. The
    // snapshot is dropped again if the write turned out to change nothing.
    if (wasSet) bedit.state.pushUndo(tRaw('Clear {role}', { role: roleLabel(role) }));
    const wrote = wasSet ? clearRole(bedit.doc, role, bedit.addColor.roleTheme()) : assignRole(bedit.doc, role, key, bedit.addColor.roleTheme());
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
      ? tRaw('{role} is not set', { role: roleLabel(role) })
      : tRaw('{role} is now {name}', { role: roleLabel(role), name: cur.name }));
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
