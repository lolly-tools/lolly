// SPDX-License-Identifier: MPL-2.0
/**
 * brand editor: the shared swatch editor and the pick card.
 *
 * Every function takes the shared `bedit: BrandEditorCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `bedit.<module>.<fn>`. Extracted verbatim
 * from mountBrandEditor() by scripts/split-closure.ts.
 */
import { colorToHex } from '@lolly/engine';
import { nameColor } from '../color-namer.ts';
import { getSwatchFaces, getSwatchPrintOverride, primaryAnchorPath, setSwatchValue } from '../brand-doc.ts';
import { colorFieldHtml, wireColorField } from '../../components/color-field.ts';
import { serializeColor, storageFormatOf } from '../color-formats.ts';
import type { StorageFormat } from '../color-formats.ts';
import { t, tRaw } from '../../i18n.ts';
import { samePath } from './shared.ts';
import { bindOp, type BrandEditorCtx } from './context.ts';

// Re-syncs the popover's lock badge + folded-row chips + tile + the
// primary-panel control (when the edited swatch IS the primary anchor - see
// primaryPrintLock's doc comment) after either half of the swatch lock changes.
export const afterSwatchLockChange = (bedit: BrandEditorCtx): void => {
  const { editorLockBadge, primaryLock } = bedit;
  if (bedit.selected < 0) return;
  const cur = bedit.swatches[bedit.selected]!;
  cur.lock = getSwatchPrintOverride(bedit.doc, cur.path);
  bedit.replace.refreshTile(bedit.selected);
  if (editorLockBadge) editorLockBadge.hidden = !cur.lock;
  bedit.replace.renderSubstChips();
  bedit.state.persist();
  const anchorPath = primaryAnchorPath(bedit.doc);
  if (anchorPath && samePath(anchorPath, cur.path)) primaryLock?.render();
};
/** How many faces this swatch has authored - the folded summary. */
export function renderFacesChips(bedit: BrandEditorCtx): void {
  const { facesChips } = bedit;
  if (!facesChips) return;
  const n = bedit.selected >= 0 ? [...getSwatchFaces(bedit.doc, bedit.swatches[bedit.selected]!.path).keys()].length : 0;
  facesChips.textContent = n ? tRaw('{n} set', { n: String(n) }) : '';
}
/** (Re)build the visual colour field on a hex, wiring its live onChange. */
export const renderEditField = (bedit: BrandEditorCtx, hex: string): void => {
  const { editorEl } = bedit;
  const mountEl = editorEl?.querySelector<HTMLElement>('[data-be-editor-color]'); if (!mountEl) return;
  // The same field the primary gets: inline (it lays out in the card's flow
  // rather than as a popover that would overlap the rows below), `modes`,
  // whose value input IS the typed-value entry (hex, OKLCH, HSL, RGB, CMYK),
  // and `dials` - the L/C/H wheels the first pick is worth opening on.
  mountEl.innerHTML = colorFieldHtml('be-edit-color', hex || '#888888', {
    inline: true, modes: true, dials: true, progressive: bedit.pickHex !== null,
  });
  wireColorField(mountEl, {
    onChange: (id, value) => {
      if (id !== 'be-edit-color') return;
      const raw = typeof value === 'string' ? value : value.value;
      // In pick mode nothing is bound to a token yet - the drag paints the
      // card and the add row, and only "Add colour" writes.
      if (bedit.pickHex !== null) { setPickHex(bedit, raw); return; }
      applyEditedHex(bedit, raw); // field-driven → don't re-render the field under the user
    },
  });
};
/**
 * Apply a colour to the selected swatch from EITHER surface: write it to the
 * doc, repaint the tile + value row, and persist. Alpha is kept - an `#rrggbbaa`
 * from the field's opacity slider (or an rgba()/oklch(… / a) value) flows
 * through verbatim, so brand swatches can be translucent. `rerenderField`
 * re-seeds the visual field (used when the value row drove the change, so the
 * sliders catch up; NOT when the field itself did, mid-drag).
 */
export function applyEditedHex(bedit: BrandEditorCtx, rawHex: string, opts: { rerenderField?: boolean } = {}): void {
  if (bedit.selected < 0) return;
  writeSwatchHex(bedit, bedit.selected, rawHex, bedit.storedFmt, opts);
}
/**
 * The doc-write half of applyEditedHex, parameterised by swatch index + storage
 * format so BOTH the popover (the open `selected` swatch, LCH/hex per its "Stored
 * as" toggle) and the keyboard nudge (any FOCUSED tile, in the swatch's own
 * notation) land through one path - the tile repaints in place and it persists on
 * Save exactly like a popover edit. The popover-only touches (chip, value field,
 * the alias-detach row) fire only when `idx` IS the open swatch.
 */
export function writeSwatchHex(bedit: BrandEditorCtx, idx: number, rawHex: string, fmt: StorageFormat, opts: { rerenderField?: boolean } = {}): void {
  const { editorChip, palMount, storedRow } = bedit;
  const cur = bedit.swatches[idx]; if (!cur) return;
  if (!rawHex || rawHex === 'transparent') return;
  const hex = rawHex; // keep #rrggbbaa alpha - brand swatches may be translucent
  // The doc stores the swatch's chosen notation ("Stored as" - LCH default);
  // the tile/UI keep working in resolved hex. Recolouring an alias role
  // detaches it to a literal, which is when the storage toggle starts to bite.
  const stored = serializeColor(colorToHex(hex) ?? hex, fmt);
  setSwatchValue(bedit.doc, cur.path, stored);
  cur.hex = colorToHex(hex) ?? hex; cur.raw = stored;
  if (cur.isAlias) { cur.isAlias = false; if (idx === bedit.selected && storedRow) storedRow.hidden = false; }
  const tile = palMount?.querySelector<HTMLElement>(`[data-be-tile="${idx}"]`);
  if (tile) {
    tile.style.setProperty('--sw', cur.hex);
    tile.classList.remove('is-empty');
    bedit.replace.syncTileMeta(tile, cur);
  }
  if (idx === bedit.selected && editorChip) editorChip.style.setProperty('--sw', cur.hex);
  if (idx === bedit.selected && opts.rerenderField) renderEditField(bedit, cur.hex);
  bedit.state.persist();
} // viewport breathing room, and the tile↔card gap
export const positionEditor = (bedit: BrandEditorCtx, tile: HTMLElement): void => {
  const { MARGIN, editorEl, root } = bedit;
  if (!editorEl) return;
  const r = tile.getBoundingClientRect(), pr = root.getBoundingClientRect();
  const w = editorEl.offsetWidth, h = editorEl.offsetHeight;
  editorEl.style.left = `${Math.max(MARGIN, Math.min(r.left - pr.left, pr.width - w - MARGIN))}px`;

  const below = r.bottom + MARGIN;
  const above = r.top - MARGIN - h;
  const fitsBelow = below + h <= window.innerHeight - MARGIN;
  const fitsAbove = above >= MARGIN;
  // Prefer below (it reads as "belonging to" the tile); flip up only when below
  // overhangs AND above actually has the room.
  let top = fitsBelow || !fitsAbove ? below : above;
  // Taller than the viewport: pin it and let .be-editor-card's max-height scroll.
  top = Math.max(MARGIN, Math.min(top, window.innerHeight - MARGIN - h));
  editorEl.style.top = `${top - pr.top}px`;
};
/** Re-place the open card against its anchor - after anything that resized it.
 *  Never in the phone's sheet pose, where the card has no anchor to follow:
 *  it is docked to the viewport's bottom edge and the CSS owns its box. */
export const reposition = (bedit: BrandEditorCtx): void => {
  const { editorEl } = bedit;
  if (bedit.pickSheet) return;
  if (bedit.editorAnchor && editorEl && !editorEl.hidden) positionEditor(bedit, bedit.editorAnchor);
};
export const closeEditor = (bedit: BrandEditorCtx): void => {
  const { editorEl, root } = bedit;
  if (editorEl) { editorEl.hidden = true; }
  const focusBack = bedit.editorAnchor;
  bedit.selected = -1; bedit.editorAnchor = null;
  if (focusBack?.isConnected) focusBack.focus();
  leavePickMode(bedit);
  root.querySelectorAll('.be-swatch.is-selected').forEach(t => { t.classList.remove('is-selected'); });
  // A beat that fell due while this card was open is owed now (see applyBeat).
  if (bedit.beatPending) { bedit.ramps.applyBeat(); bedit.ramps.notifyPaletteObservers(); }
};
export const openEditor = (bedit: BrandEditorCtx, idx: number, tile: HTMLElement): void => {
  const { editorChip, editorEl, editorLockBadge, facesDetails, renderEditorGroup, root, storedRow, substDetails, swatchFaces, swatchSubst } = bedit;
  const s = bedit.swatches[idx]; if (!s || !editorEl) return;
  bedit.selected = idx;
  root.querySelectorAll('.be-swatch.is-selected').forEach(t => { t.classList.remove('is-selected'); });
  tile.classList.add('is-selected');
  const nameInput = editorEl.querySelector<HTMLInputElement>('[data-be-editor-name]')!;
  const delBtn = editorEl.querySelector<HTMLButtonElement>('[data-be-editor-del]')!;
  renderEditField(bedit, s.hex);
  if (editorChip) editorChip.style.setProperty('--sw', s.hex || 'transparent');
  nameInput.value = s.name;
  // Everything is deletable: real removal for the user's own swatches, an
  // exclusion (hide) for derived ramp steps + roles - see the Delete handler.
  delBtn.hidden = false;
  delBtn.textContent = s.deletable && s.kind !== 'ramp' && !bedit.ramps.isStarterSwatch(s) ? t('Delete') : t('Hide colour');
  renderEditorGroup(s);
  if (editorLockBadge) editorLockBadge.hidden = !s.lock;
  // Storage notation: respect what the doc already holds (an older hex edit
  // stays hex); the app default for everything else - aliases included, which
  // start storing the moment a recolour detaches them - is LCH. The row hides
  // while there's no literal to re-write.
  bedit.storedFmt = s.isAlias ? 'lch' : storageFormatOf(s.raw);
  bedit.replace.renderStoredSeg();
  if (storedRow) storedRow.hidden = s.isAlias;
  bedit.roles.renderUseAs();
  bedit.replace.renderSubstChips();
  if (substDetails) substDetails.open = false; // folded until asked - the lock chips say enough
  swatchSubst?.render();
  renderFacesChips(bedit);
  if (facesDetails) facesDetails.open = false; // folded, like the print section
  swatchFaces?.render();
  bedit.editorAnchor = tile;
  editorEl.hidden = false; // before positioning - the clamp measures offsetHeight
  positionEditor(bedit, tile);
  nameInput.focus();
};
/** Put the card back in swatch-editing clothes. Idempotent - closeEditor calls
 *  it on every close, including the ones that were never a pick. */
export const leavePickMode = (bedit: BrandEditorCtx): void => {
  const { editorAddBtn, editorCancelBtn, editorDoneBtn, editorEl, facesDetails, substDetails } = bedit;
  if (bedit.pickHex === null) return;
  bedit.pickHex = null;
  bedit.pickGroup = undefined;
  bedit.pickSheet = false;
  editorEl?.classList.remove('is-pick', 'is-picksheet');
  if (editorAddBtn) editorAddBtn.hidden = true;
  if (editorCancelBtn) editorCancelBtn.hidden = true;
  if (editorDoneBtn) editorDoneBtn.hidden = false;
  // The folds pick mode put away belong to the next swatch that opens here;
  // openEditor decides their OPEN state, never their existence.
  if (substDetails) substDetails.hidden = false;
  if (facesDetails) facesDetails.hidden = false;
};
/** A live drag: paint the card's chip and write the add row's field, so the
 *  row's own chip follows and the value is there to be pasted elsewhere. */
export const setPickHex = (bedit: BrandEditorCtx, raw: string): void => {
  const { editorChip } = bedit;
  if (!raw || raw === 'transparent') return;
  bedit.pickHex = colorToHex(raw) ?? raw;
  editorChip?.style.setProperty('--sw', bedit.pickHex);
  const field = bedit.addColor.addField();
  if (field) {
    field.value = serializeColor(bedit.pickHex, bedit.storedFmt);
    // The row parses on `input`, which is also what repaints its chip - so
    // one dispatch keeps the two controls saying the same thing.
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
};
/**
 * Open the card in pick mode against `anchor`, seeded with `current` (the
 * colour the add row is holding) or a considered default when it holds none.
 *
 * On a phone the card docks to the bottom edge instead of floating over a
 * 44px chip: the inline anchoring has nowhere to put a 340px card there, and
 * the CSS parks the palette mirror underneath for the same single-owner
 * reason the tray does.
 */
export const openPickCard = (bedit: BrandEditorCtx, anchor: HTMLElement, current: string | null): void => {
  const { PICK_SEED, editorAddBtn, editorCancelBtn, editorChip, editorDelBtn, editorDoneBtn, editorEl, editorLockBadge, facesDetails, storedRow, substDetails, useasRow } = bedit;
  if (!editorEl) return;
  closeEditor(bedit);                       // one card at a time, whatever it held
  const nameInput = editorEl.querySelector<HTMLInputElement>('[data-be-editor-name]');
  const hex = current || PICK_SEED;
  bedit.pickHex = hex;
  bedit.storedFmt = 'lch';
  bedit.replace.renderStoredSeg();
  if (storedRow) storedRow.hidden = true;
  if (editorLockBadge) editorLockBadge.hidden = true;
  if (useasRow) useasRow.hidden = true;
  if (substDetails) { substDetails.open = false; substDetails.hidden = true; }
  if (facesDetails) { facesDetails.open = false; facesDetails.hidden = true; }
  if (editorDelBtn) editorDelBtn.hidden = true;
  if (editorDoneBtn) editorDoneBtn.hidden = true;
  if (editorAddBtn) editorAddBtn.hidden = false;
  if (editorCancelBtn) editorCancelBtn.hidden = false;
  editorEl.classList.add('is-pick');
  renderEditField(bedit, hex);
  const fineToggle = editorEl.querySelector<HTMLButtonElement>('[data-color-fine-toggle]');
  fineToggle?.addEventListener('click', () => {
  const { storedRow } = bedit;
    if (storedRow) storedRow.hidden = fineToggle.getAttribute('aria-expanded') !== 'true';
    reposition(bedit);
  });
  editorChip?.style.setProperty('--sw', hex);
  if (nameInput) nameInput.value = nameColor(hex);
  bedit.pickSheet = typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 640px)')?.matches;
  editorEl.classList.toggle('is-picksheet', bedit.pickSheet);
  bedit.editorAnchor = bedit.pickSheet ? null : anchor;
  editorEl.hidden = false;             // before positioning - the clamp measures offsetHeight
  if (bedit.pickSheet) { editorEl.style.left = ''; editorEl.style.top = ''; }
  else positionEditor(bedit, anchor);
  editorEl.querySelector<HTMLInputElement>('[data-color-hex]')?.focus();
};
/** Commit the pick through the room's ONE add path, carrying the name the
 *  person typed. The add row is cleared the way it clears itself. */
export const commitPickCard = (bedit: BrandEditorCtx): void => {
  const { editorEl } = bedit;
  const hex = bedit.pickHex;
  if (!hex) return;
  const name = editorEl?.querySelector<HTMLInputElement>('[data-be-editor-name]')?.value ?? '';
  const value = serializeColor(hex, bedit.storedFmt);
  const group = bedit.pickGroup;
  closeEditor(bedit);
  const field = bedit.addColor.addField();
  if (field) { field.value = ''; field.dispatchEvent(new Event('input', { bubbles: true })); }
  bedit.addColor.addColorEntries([{ value, hex: colorToHex(hex) ?? hex, name }], true, group);
};
/**
 * Select the swatch at a JSON path and open its editor against the best
 * available anchor. Never "the last one" - key order shifts on repaint - and
 * never a hidden tile: a folded palette group measures 0×0 and would place
 * the popover at the panel origin, so the caller's own anchor (a wheel dot,
 * a gamut dot) takes over. A no-op when the path did not land.
 */
export const openSwatchAt = (bedit: BrandEditorCtx, path: string[] | null, fallback?: HTMLElement | null): void => {
  const { palMount } = bedit;
  if (!path) return;
  const idx = bedit.swatches.findIndex(s => s.path.length === path.length && s.path.every((seg, i) => seg === path[i]));
  if (idx < 0) return;
  const tile = palMount?.querySelector<HTMLElement>(`[data-be-tile="${idx}"]`) ?? null;
  const anchor = (tile && tile.offsetParent !== null ? tile : null) ?? fallback ?? tile;
  if (anchor) openEditor(bedit, idx, anchor);
};
export function wireEditorAdd(bedit: BrandEditorCtx): void {
  const { editorEl } = bedit;
  // ── The first pick: the same card, not bound to a token (plan 182 section 5.1)
  // The Fine-tune popover is the best colour control in the app, and it was one
  // click away from where the first colour had to be TYPED. Pick mode opens that
  // exact card with nothing selected: the chip and name field, the full OKLCH
  // picker, "Stored as", and a footer of Cancel | Add colour instead of Delete |
  // Save. Nothing is written until Add colour; Cancel and Escape leave the add
  // row exactly as they found it. Roles and print substitutes are hidden - both
  // are things you do to a colour that exists.
  const editorAddBtn = editorEl?.querySelector<HTMLButtonElement>('[data-be-editor-add]') ?? null; bedit.editorAddBtn = editorAddBtn;
  const editorCancelBtn = editorEl?.querySelector<HTMLButtonElement>('[data-be-editor-cancel]') ?? null; bedit.editorCancelBtn = editorCancelBtn;
  const editorDoneBtn = editorEl?.querySelector<HTMLButtonElement>('[data-be-editor-done]') ?? null; bedit.editorDoneBtn = editorDoneBtn;
  const editorDelBtn = editorEl?.querySelector<HTMLButtonElement>('[data-be-editor-del]') ?? null; bedit.editorDelBtn = editorDelBtn;
  /** The colour the pick card is holding, or null when it is not open. */
  bedit.pickHex = null;
  // bedit.pickGroup: assigned later
  /** True while the card is docked to the phone's bottom edge rather than
   *  anchored to the chip - the pose has no anchor, so nothing may reposition
   *  it and no anchor scroll may close it. */
  bedit.pickSheet = false;
  const PICK_SEED = '#7c3aed'; bedit.PICK_SEED = PICK_SEED;
}

export function swatchEditorOps(bedit: BrandEditorCtx) {
  return {
    afterSwatchLockChange: bindOp(bedit, afterSwatchLockChange),
    renderFacesChips: bindOp(bedit, renderFacesChips),
    renderEditField: bindOp(bedit, renderEditField),
    applyEditedHex: bindOp(bedit, applyEditedHex),
    writeSwatchHex: bindOp(bedit, writeSwatchHex),
    positionEditor: bindOp(bedit, positionEditor),
    reposition: bindOp(bedit, reposition),
    closeEditor: bindOp(bedit, closeEditor),
    openEditor: bindOp(bedit, openEditor),
    leavePickMode: bindOp(bedit, leavePickMode),
    setPickHex: bindOp(bedit, setPickHex),
    openPickCard: bindOp(bedit, openPickCard),
    commitPickCard: bindOp(bedit, commitPickCard),
    openSwatchAt: bindOp(bedit, openSwatchAt),
    wireEditorAdd: bindOp(bedit, wireEditorAdd),
  };
}
