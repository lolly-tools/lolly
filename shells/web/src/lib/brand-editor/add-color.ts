// SPDX-License-Identifier: MPL-2.0
/**
 * brand editor: adding colours and the post-add chip.
 *
 * Every function takes the shared `bedit: BrandEditorCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `bedit.<module>.<fn>`. Extracted verbatim
 * from mountBrandEditor() by scripts/split-closure.ts.
 */
import { nameColor } from '../color-namer.ts';
import { addSwatch, walkSwatches } from '../brand-doc.ts';
import { serializeColor, storageFormatOf } from '../color-formats.ts';
import { t, tRaw } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { playSfx } from '../sfx.ts';
import { COLOR_NOTATION_EXAMPLES, mountAddColor } from '../design-system/add-color.ts';
import type { ColorEntry } from '../design-system/add-color.ts';
import { assignRole, roleLabel } from '../design-system/roles.ts';
import { bindOp, type BrandEditorCtx } from './context.ts';

/** Put the chip away. Called by the next add, by Dismiss, by either action
 *  once it has run, and by the host on a room change (closeOverlays). */
export const clearAddedChip = (bedit: BrandEditorCtx): void => {
  const { addedEl } = bedit;
  bedit.addedSwatch = null;
  if (addedEl) addedEl.hidden = true;
};
/** Hand focus back to the field the add came from. Both actions retire the
 *  chip that holds the pressed button, so without this a keyboard user
 *  restarts from the top of the page (the same hand-off handBackPalFocus
 *  makes for the bulk bar). */
export const focusAddField = (bedit: BrandEditorCtx): void => {
  const { root } = bedit;
  root.querySelector<HTMLElement>('[data-ds-addc-input]')?.focus();
};
/**
 * The chip in its "this colour now has the primary role" state - what a press
 * of "Use as primary?" leaves behind, and what the very first colour of all
 * shows straight away (it becomes the primary on arrival, plan 182 section
 * 5.2). One action is left, Fine-tune, and the ✕.
 *
 * The generate handover is NOT here any more. It was a link on this chip,
 * which a dismiss took away with it; it is the `.be-generate-cta` panel now,
 * which is on screen for the whole of beat 1.
 */
export const showPrimarySetChip = (bedit: BrandEditorCtx, name: string): void => {
  const { addedNameEl, addedPrimaryBtn, addedTuneBtn } = bedit;
  if (addedPrimaryBtn) addedPrimaryBtn.hidden = true;
  if (addedTuneBtn) addedTuneBtn.hidden = false;
  if (addedNameEl) addedNameEl.textContent = tRaw('{role} is now {name}', { role: roleLabel('primary'), name });
  addedTuneBtn?.focus();
};
export const showAddedChip = (bedit: BrandEditorCtx, one: { path: string[]; name: string; hex: string }, primarySet = false): void => {
  const { addedEl, addedNameEl, addedPrimaryBtn, addedSw, addedTuneBtn } = bedit;
  if (!addedEl || !addedNameEl) return;
  bedit.addedSwatch = { path: one.path, name: one.name };
  addedNameEl.textContent = one.name;
  // A previous chip may have ended in the primary-set state (the offer button
  // hidden) - a fresh add starts with both actions back.
  if (addedPrimaryBtn) addedPrimaryBtn.hidden = false;
  if (addedTuneBtn) addedTuneBtn.hidden = false;
  addedSw?.style.setProperty('--sw', one.hex || 'transparent');
  addedEl.hidden = false;
  if (primarySet) showPrimarySetChip(bedit, one.name);
  else addedPrimaryBtn?.focus();
};
// ── Level 0: Add a colour ───────────────────────────────────────────────────
// The module parses; this callback is the only thing that writes. One colour
// in, one addSwatch out - nothing derived, nothing suggested-into (plan 97 section 3
// principle 1). Notation is preserved as typed: storageFormatOf maps `#…`→hex,
// `rgb(…)`→rgb, `hsl(…)`→hsl and everything else to the app's LCH default.
/**
 * The room's write for "here are n colours" - one `addSwatch` each, one
 * persist for the batch. Returns how many arrived.
 *
 * Exposed on the handle as `addColors` (plan 97 section 2b) because it writes into
 * the doc THIS editor is holding. A caller that keeps its own snapshot of the
 * installed document and writes into that instead would reinstall the snapshot
 * - silently reverting every edit made in the room since it was taken. There
 * is one live document; this is the way in.
 *
 * `reveal` is the room's own affordance (confirm the new swatch, announce it)
 * and belongs to a press made IN the room. A tray add announces for itself
 * from the panel the press happened in, and must not put a chip in the Add
 * hero for a colour that was added somewhere else.
 */
export const addColorEntries = (bedit: BrandEditorCtx, entries: ColorEntry[], reveal = false, group?: string): number => {
  if (entries.length) bedit.state.pushUndo(t('Add colours'));
  // Was this room empty of the person's own colour before the add? That is
  // what makes the next line the FIRST colour, and the first colour becomes
  // the primary (plan 182 section 5.2) - it is what nine people in ten mean
  // by it, and asking would be asking about a decision already made.
  const wasEmpty = bedit.ramps.ownColorCount() === 0;
  const added: Array<{ path: string[]; name: string; hex: string }> = [];
  for (const e of entries) {
    // The picker card names the colour it committed; a scan of pasted text
    // has no name to report, so the room's own namer answers for those.
    const name = e.name?.trim() || nameColor(e.hex);
    const path = addSwatch(bedit.doc, 'custom', name, serializeColor(e.hex, storageFormatOf(e.value)), group ? { displayGroup: group } : {});
    if (path) added.push({ path, name, hex: e.hex });
  }
  if (!added.length) return 0;
  // Deliberately UNSCOPED (no theme), for the reason the chip's own "Use as
  // primary?" is: a colour someone names as their primary is the primary in
  // both themes, unlike surface and text, which each theme inverts.
  const first = added[0]!;
  const firstKey = walkSwatches(bedit.doc, bedit.currentTheme)
    .find(s => s.path.length === first.path.length && s.path.every((seg, i) => seg === first.path[i]))?.key;
  const tookPrimary = !!(wasEmpty && added.length === 1 && firstKey && assignRole(bedit.doc, 'primary', firstKey));
  bedit.ramps.repaintPalette(); bedit.state.persist(true); playSfx('click');
  if (reveal) {
    clearAddedChip(bedit);   // one chip at a time: the previous add has had its answer
    if (added.length === 1) {
      showAddedChip(bedit, first, tookPrimary);
      announce(tookPrimary
        ? tRaw('{role} is now {name}', { role: roleLabel('primary'), name: first.name })
        : tRaw('{name} added', { name: first.name }));
    } else {
      announce(tRaw('{n} colours added', { n: added.length }));
    }
  }
  return added.length;
};
/** The add row's field, the one place the pick card writes its live value. */
export const addField = (bedit: BrandEditorCtx): HTMLInputElement | null => { const { root } = bedit; return root.querySelector<HTMLInputElement>('[data-ds-addc-input]'); };
/**
 * Beat 0 spells the notations out in full under a 72px chip; the compact row
 * keeps the short sentence, because by then the person has done this once.
 * The example values stay untranslated (they are values, not prose).
 */
export function syncAddPlaceholder(bedit: BrandEditorCtx): void {
  const field = addField(bedit);
  if (!field) return;
  field.placeholder = bedit.beat === 0
    ? `${t('Paste a colour')} · ${COLOR_NOTATION_EXAMPLES}`
    : t('Paste a colour, or a list');
}
/** The theme the strip is reading, and therefore the ONE it may write. A
 *  derived doc's light and dark roles are deliberately inverted (surface is
 *  the lightest neutral in one and the darkest in the other), so an unscoped
 *  write from here would overwrite dark mode with the light theme's choices. */
export const roleTheme = (bedit: BrandEditorCtx): string => (bedit.currentTheme === 'dark' ? 'dark' : 'light');
export function wireAddedChip(bedit: BrandEditorCtx): void {
  const { addedEl } = bedit;
  addedEl?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-be-added-dismiss]')) { bedit.addColor.clearAddedChip(); bedit.addColor.focusAddField(); return; }
    if (target.closest('[data-be-added-tune]')) {
      const path = bedit.addedSwatch?.path ?? null;
      bedit.addColor.clearAddedChip();       // before the popover opens - it takes focus itself
      bedit.swatchEditor.openSwatchAt(path);
      return;
    }
    if (!target.closest('[data-be-added-primary]') || !bedit.addedSwatch) return;
    // Deliberately UNSCOPED (no theme), for the reason takePrimaryFromLogo
    // states: a colour someone names as their primary is the brand's primary in
    // both themes, unlike surface and text, which each theme inverts.
    const path = bedit.addedSwatch.path;
    const name = bedit.addedSwatch.name;
    const key = bedit.swatches.find(s => s.path.length === path.length && s.path.every((seg, i) => seg === path[i]))?.key;
    if (!key || !assignRole(bedit.doc, 'primary', key)) { bedit.addColor.clearAddedChip(); bedit.addColor.focusAddField(); return; }
    bedit.ramps.repaintPalette(); bedit.state.persist(true); playSfx('click');
    // The chip STAYS as a confirmation (plans/163 F3 - retiring the whole row
    // here used to destroy the only handover to Generate). The handover is the
    // `.be-generate-cta` panel now, which the same repaint has just re-titled
    // after this colour, so the chip's remaining job is to say what happened.
    bedit.addColor.showPrimarySetChip(name);
    announce(tRaw('{role} is now {name}', { role: roleLabel('primary'), name }));
  });
}

export function wireAddColorMount(bedit: BrandEditorCtx): void {
  const { cleanups, opts } = bedit;
  const addColorMount = bedit.ramps.$('[data-be-addcolor]') as HTMLElement | null; bedit.addColorMount = addColorMount as BrandEditorCtx['addColorMount'];
  if (addColorMount) {
    const teardownAdd = mountAddColor(addColorMount, {
      t: (source, params) => (params ? tRaw(source, params) : t(source)),
      onAdd: (entries: ColorEntry[]) => { bedit.addColor.addColorEntries(entries, true); },
      // The chip opens the studio's OWN swatch card in pick mode (plan 182
      // section 5.1) - the same OKLCH picker a tile opens, with Add colour as
      // its footer instead of Delete/Save. One picker in the room, not two.
      onOpenPicker: (anchor, current) => { bedit.swatchEditor.openPickCard(anchor, current); },
      // "From an image" is the studio's existing image source, reached through
      // the host rather than re-implemented: sample → colour cloud → census →
      // tray, exactly as the source picker's image tile does it. Without a host
      // that offers it, the button is not rendered at all.
      onImageFile: opts.scanImage ? (file: File) => { opts.scanImage?.(file); } : undefined,
    });
    cleanups.push(teardownAdd);
  }
}

export function addColorOps(bedit: BrandEditorCtx) {
  return {
    clearAddedChip: bindOp(bedit, clearAddedChip),
    focusAddField: bindOp(bedit, focusAddField),
    showPrimarySetChip: bindOp(bedit, showPrimarySetChip),
    showAddedChip: bindOp(bedit, showAddedChip),
    addColorEntries: bindOp(bedit, addColorEntries),
    addField: bindOp(bedit, addField),
    syncAddPlaceholder: bindOp(bedit, syncAddPlaceholder),
    roleTheme: bindOp(bedit, roleTheme),
    wireAddedChip: bindOp(bedit, wireAddedChip),
    wireAddColorMount: bindOp(bedit, wireAddColorMount),
  };
}
