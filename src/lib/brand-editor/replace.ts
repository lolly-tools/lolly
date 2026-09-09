// SPDX-License-Identifier: MPL-2.0
/**
 * brand editor: replace-palette proposals, review and substitution chips.
 *
 * Every function takes the shared `bedit: BrandEditorCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `bedit.<module>.<fn>`. Extracted verbatim
 * from mountBrandEditor() by scripts/split-closure.ts.
 */
import { colorToHex, createTokenSet, deriveBrandTokens } from '@lolly/engine';
import { carryPaletteGroups } from '../design-system/palette-groups.ts';
import { RAMP_IDS, getExcludedSwatches, getSwatchFaces, getSwatchPrintOverride, isRec, overlayRampCurves, primaryAnchorPath, setSemanticRampAlias, setSwatchCmykLock, setSwatchExcluded, setSwatchFace, setSwatchSpotLock, setSwatchValue, walkSwatches } from '../brand-doc.ts';
import type { BrandSwatch } from '../brand-doc.ts';
import { serializeColor } from '../color-formats.ts';
import type { StorageFormat } from '../color-formats.ts';
import { tileLabel } from '../swatches.ts';
import { STUDIO_GROUPS, materializeGradientAliases } from '../token-studio.ts';
import { t, tRaw } from '../../i18n.ts';
import { escape as escapeText } from '../../utils.ts';
import { announce } from '../../a11y.ts';
import { playSfx } from '../sfx.ts';
import { assignRole, readRoles } from '../design-system/roles.ts';
import { finishLabel, mountFaces, mountPrintLock, specCard, tileHtml } from './shared.ts';
import type { ReplacePlan } from './shared.ts';
import { bindOp, type BrandEditorCtx } from './context.ts';

/** Pop the last snapshot and make the room describe it again. Returns false
 *  when there is nothing to undo, so the key event can fall through. */
export const undoLast = (bedit: BrandEditorCtx): boolean => {
  const { undoStack } = bedit;
  const prev = undoStack.pop();
  if (!prev) return false;
  bedit.doc = prev.doc;
  bedit.derive.reseedFromDoc();
  bedit.swatchEditor.closeEditor();
  bedit.palSelect.exitPalSelect();
  bedit.ramps.repaintPalette();
  bedit.state.persist(true);
  playSfx('click');
  announce(tRaw('Undone: {action}', { action: prev.label }));
  const undo = bedit.ramps.$<HTMLButtonElement>('[data-be-undo]');
  if (undo) { undo.hidden = undoStack.length === 0; undo.textContent = tRaw('Undo: {action}', { action: undoStack.at(-1)?.label ?? '' }); }
  return true;
};
export const countLeaves = (_bedit: BrandEditorCtx, node: unknown): number =>
  isRec(node) ? Object.keys(node).filter(k => !k.startsWith('$')).length : 0;
export const buildReplacement = (bedit: BrandEditorCtx): { next: Record<string, unknown>; plan: ReplacePlan } | null => {
  const { curves } = bedit;
  let next: Record<string, unknown>;
  try { next = deriveBrandTokens({ primary: bedit.primary, scheme: bedit.scheme, surface: bedit.surface, contrast: bedit.contrast, steps: bedit.steps, foreground: bedit.foreground, name: 'My brand' }) as Record<string, unknown>; }
  catch (err) { announce(tRaw("Couldn't derive from {primary}: {error}", { primary: bedit.primary, error: String((err as { message?: unknown })?.message ?? err) }), { assertive: true }); return null; }
  setSemanticRampAlias(next, 'secondary', bedit.secondaryStep);
  setSemanticRampAlias(next, 'neutral', bedit.neutralStep);
  // Re-apply any tonal curves onto the fresh derive - this is what makes an
  // edited ramp SURVIVE a re-derive (the curve is regenerated from its control
  // points, and its extension re-stamped on the new doc). A no-op for a ramp
  // with no curve, so a curve-less re-derive is byte-identical to before.
  overlayRampCurves(next, curves, bedit.steps);
  // Read the lock LIVE off the pre-derive `doc` - whichever surface (the print
  // wing or the Palette panel's swatch popover) set it last, since both write
  // straight to `doc` - so re-deriving never silently drops a lock the other
  // surface just set (see primaryPrintLock's doc comment above). cmyk and spot
  // are independent, so both are re-pinned onto the freshly derived doc.
  const priorLock = bedit.ramps.primaryPrintLock();
  const p = priorLock ? primaryAnchorPath(next) : null;
  if (p && priorLock?.cmyk) setSwatchCmykLock(next, p, priorLock.cmyk); // ramp rebuilt → re-pin the print lock
  if (p && priorLock?.spot) setSwatchSpotLock(next, p, priorLock.spot);

  const cur = isRec(bedit.doc) ? bedit.doc : {};
  const srcBase = (isRec(cur.base) ? cur.base : cur) as Record<string, unknown>;
  const dstBase = (isRec(next.base) ? next.base : next) as Record<string, unknown>;
  // Count the derive's own spectrum BEFORE the carry below grows it.
  const spectrumRebuilt = countLeaves(bedit, isRec(dstBase.color) ? (dstBase.color as Record<string, unknown>).spectrum : null);

  // Deriving only rebuilds COLOUR - everything else the doc carries (the
  // studio's spacing/shadows/gradients, the font roles, the logos' asset
  // tokens, shape.radius) survives it, same precedent as the print lock.
  // deriveBrandTokens never emits these groups, so a straight carry is safe.
  for (const g of [...STUDIO_GROUPS, 'font', 'asset', 'shape']) {
    if (dstBase[g] === undefined && isRec(srcBase[g])) dstBase[g] = structuredClone(srcBase[g]);
  }

  // Colour carry - what makes "added colours kept" true. STUDIO_GROUPS does not
  // cover `color`, so before this every custom swatch was silently dropped and
  // the old flow needed a confirm dialog to say so.
  let kept = 0;
  {
    const srcColor = isRec(srcBase.color) ? srcBase.color as Record<string, unknown> : null;
    const dstColor = isRec(dstBase.color) ? dstBase.color as Record<string, unknown> : null;
    if (srcColor && dstColor) {
      // `custom` is user-owned outright - nothing derived ever arrives there.
      if (isRec(srcColor.custom)) { dstColor.custom = structuredClone(srcColor.custom); kept += countLeaves(bedit, srcColor.custom); }
      // `spectrum` is shared: the derive rebuilds its six fixed hues, every OTHER
      // key is an accent the user added from the generator, so it comes across.
      if (isRec(srcColor.spectrum)) {
        const dst = (isRec(dstColor.spectrum) ? dstColor.spectrum : (dstColor.spectrum = {})) as Record<string, unknown>;
        for (const [k, v] of Object.entries(srcColor.spectrum as Record<string, unknown>)) {
          if (k.startsWith('$') || k in dst) continue;
          dst[k] = structuredClone(v);
          kept++;
        }
      }
    }
  }

  const nextKeys = new Set(walkSwatches(next, bedit.currentTheme).map(s => s.key));

  // Role carry - a hand-assigned secondary/surface/text survives the rebuild.
  // Deliberately NOT primary or on-primary: the wing's own picker IS the
  // primary, and keeping a hand-assigned one would contradict the ramps this
  // derive just built around it.
  // Per THEME, because the roles are: a surface assigned in light mode has no
  // business landing in the dark theme's set (see roles.ts). A role kept in
  // both themes is one kept role, not two, so the count is over the names.
  const rolesCarried = new Set<string>();
    for (const th of ['light', 'dark'] as const) {
      const before = readRoles(bedit.doc, th);
      for (const role of ['secondary', 'surface', 'text'] as const) {
        const ref = before[role].ref;
        if (!ref || ref.startsWith('color.ramp.') || ref.startsWith('color.semantic.')) continue;
        if (!nextKeys.has(ref)) continue;
        if (assignRole(next, role, ref, th)) rolesCarried.add(role);
      }
    }
  const rolesKept = rolesCarried.size;

  // Carry the swatch exclusion list ("deleted" derived steps stay deleted) - 
  // but only entries whose swatch still exists in the fresh derive: a smaller
  // shade count drops its stale ramp-step exclusions, per the delete contract.
  // Runs AFTER the colour + role carries, so a carried swatch keeps its
  // exclusion rather than losing it to a key that wasn't there yet.
  carryPaletteGroups(bedit.doc, next);
  let excluded = 0;
  {
    const wasExcluded = getExcludedSwatches(bedit.doc);
    const keys = new Set(walkSwatches(next, bedit.currentTheme).map(s => s.key));
    for (const k of wasExcluded) if (keys.has(k)) { setSwatchExcluded(next, k, true); excluded++; }
  }

  // The carried gradients' stops alias ramp/spectrum/custom keys, and this
  // derive may have rebuilt or dropped their targets (fewer shades; custom
  // swatches go). Resolve every alias against the OLD doc now (`doc` hasn't
  // swapped yet - resolveTokenRef still answers from it) and pin the ones the
  // fresh doc can no longer answer, so an exported pack never carries a
  // dangling ref. Aliases that still resolve keep tracking their swatch.
  const nextSet = createTokenSet(next, { theme: bedit.currentTheme === 'dark' ? 'dark' : 'light' });
  const pinnedStops = materializeGradientAliases(next, ref => colorToHex(nextSet.resolve(ref)) == null, bedit.state.resolveTokenRef);

  const lightSet = isRec(next.light) ? next.light as Record<string, unknown> : next;
  const roles = countLeaves(bedit, isRec(lightSet.color) ? (lightSet.color as Record<string, unknown>).semantic : null);
  return {
    next,
    plan: {
      steps: bedit.steps, ramps: RAMP_IDS.length, rebuilt: bedit.steps * RAMP_IDS.length, spectrumRebuilt,
      roles, kept, curves: RAMP_IDS.filter(r => curves[r]).length,
      locks: (priorLock?.cmyk ? 1 : 0) + (priorLock?.spot ? 1 : 0),
      excluded, pinnedStops, rolesKept,
    },
  };
};
/** Where focus goes when a card that HELD it is taken away: back to the button
 *  that opens one. Only when the focus really was inside - a card retired
 *  underneath somebody working elsewhere must not yank them here. */
export const hideReview = (bedit: BrandEditorCtx): void => {
  const { reviewEl } = bedit;
  bedit.pendingReplacement = null;
  if (!reviewEl) return;
  const hadFocus = reviewEl.contains(document.activeElement);
  reviewEl.hidden = true;
  reviewEl.innerHTML = '';
  if (hadFocus) bedit.ramps.$<HTMLElement>('[data-be-replace-palette]')?.focus();
};
/** Wrap a rendered line. Every string below is a LITERAL at its t()/tRaw()
 *  call site - the chrome-string process reads these statically, so a
 *  plural-picking helper that took the key as an argument would hide them. */
export const li = (_bedit: BrandEditorCtx, text: string): string => `<li>${text}</li>`;
export const renderReview = (bedit: BrandEditorCtx, plan: ReplacePlan): void => {
  const { reviewEl } = bedit;
  if (!reviewEl) return;
  const bits = [
    li(bedit, tRaw('{n} shades rebuilt across {ramps} ramps', { n: plan.rebuilt, ramps: plan.ramps })),
    li(bedit, plan.spectrumRebuilt === 1 ? t('1 spectrum hue rebuilt') : tRaw('{n} spectrum hues rebuilt', { n: plan.spectrumRebuilt })),
    li(bedit, `${plan.roles === 1 ? t('1 role re-derived') : tRaw('{n} roles re-derived', { n: plan.roles })}${
        plan.rolesKept ? tRaw(', {n} kept as assigned', { n: plan.rolesKept }) : ''}`),
  ];
  if (plan.kept) bits.push(li(bedit, plan.kept === 1 ? t('1 added colour kept') : tRaw('{n} added colours kept', { n: plan.kept })));
  if (plan.curves) bits.push(li(bedit, plan.curves === 1 ? t('1 shade curve re-anchored') : tRaw('{n} shade curves re-anchored', { n: plan.curves })));
  if (plan.locks) bits.push(li(bedit, plan.locks === 1 ? t('1 print lock re-pinned') : tRaw('{n} print locks re-pinned', { n: plan.locks })));
  if (plan.excluded) bits.push(li(bedit, plan.excluded === 1 ? t('1 hidden shade stays hidden') : tRaw('{n} hidden shades stay hidden', { n: plan.excluded })));
  if (plan.pinnedStops) bits.push(li(bedit, plan.pinnedStops === 1 ? t('1 gradient stop keeps its colour') : tRaw('{n} gradient stops keep their colour', { n: plan.pinnedStops })));
  reviewEl.innerHTML = `
      <p class="be-review-title">${t('Rebuild the palette?')}</p>
      <div class="be-specs">${specCard(t('Current'), createTokenSet(bedit.doc, { theme: 'light' }))}${bedit.pendingReplacement ? specCard(t('Proposed'), createTokenSet(bedit.pendingReplacement, { theme: 'light' })) : ''}</div>
      <ul class="be-review-list">${bits.join('')}</ul>
      <div class="be-review-actions">
        <button type="button" class="be-cta" data-be-review-go>${t('Apply rebuilt palette')}</button>
        <button type="button" class="be-btn" data-be-review-cancel>${t('Cancel')}</button>
      </div>`;
  reviewEl.hidden = false;
  reviewEl.querySelector<HTMLButtonElement>('[data-be-review-go]')?.focus();
};
export const renderReviewDone = (bedit: BrandEditorCtx): void => {
  const { reviewEl } = bedit;
  if (!reviewEl) return;
  reviewEl.innerHTML = `
      <p class="be-review-title">${t('Palette rebuilt.')}</p>
      <div class="be-review-actions">
        <button type="button" class="be-btn" data-be-review-undo>${t('Undo')}</button>
      </div>`;
  reviewEl.hidden = false;
  // Undo IS the safety net this whole path leans on, and the Replace button
  // that was focused a moment ago has just been replaced out of the document.
  // Hand focus straight to it rather than leaving it on <body>, from where
  // reaching Undo means tabbing in from the top of the page.
  reviewEl.querySelector<HTMLButtonElement>('[data-be-review-undo]')?.focus();
};
export const commitReplacement = (bedit: BrandEditorCtx, next: Record<string, unknown>): void => {
  bedit.state.pushUndo(t('Rebuild palette'));                        // snapshot BEFORE the swap
  bedit.state.ctxCheckpoint(t('Before replacing the palette'));       // durable, best-effort
  bedit.doc = next;
  bedit.curveAnchorPrimary = bedit.primary;
  bedit.ramps.repaintPalette();
  bedit.state.persist(true);
  bedit.pendingReplacement = null;
  renderReviewDone(bedit);
  playSfx('click');
  announce(t('Palette rebuilt. Undo is available.'));
};
export const renderStoredSeg = (bedit: BrandEditorCtx): void => {
  const { storedSeg } = bedit;
  storedSeg?.querySelectorAll<HTMLElement>('[data-store-fmt]').forEach(b =>
    { b.setAttribute('aria-pressed', String(b.dataset.storeFmt === bedit.storedFmt)); });
};
/** The print-substitute state, summarised on the folded row so a lock is
 *  visible without opening it. */
export const renderSubstChips = (bedit: BrandEditorCtx): void => {
  const { substChips } = bedit;
  const cur = bedit.selected >= 0 ? bedit.swatches[bedit.selected] : null;
  if (!substChips) return;
  const bits: string[] = [];
  if (cur?.lock?.cmyk) bits.push(`<span class="be-ps-chip">C${cur.lock.cmyk[0]} M${cur.lock.cmyk[1]} Y${cur.lock.cmyk[2]} K${cur.lock.cmyk[3]}</span>`);
  if (cur?.lock?.spot) bits.push(`<span class="be-ps-chip">${escapeText(cur.lock.spot.name)}${cur.lock.spot.finish ? ` · ${escapeText(finishLabel(cur.lock.spot.finish))}` : ''}</span>`);
  substChips.innerHTML = bits.length ? bits.join('') : `<span class="be-ps-chip be-ps-chip--auto">${t('auto')}</span>`;
};
/** Keep a shape-only tile's tooltip + accessible name (name - hex) fresh - 
 *  the grid shows no text, so every in-place recolour/rename re-stamps these. */
export const syncTileMeta = (_bedit: BrandEditorCtx, tile: HTMLElement, s: BrandSwatch): void => {
  const label = tileLabel(s.name, s.hex, !!s.lock);
  tile.title = label;
  tile.setAttribute('aria-label', label);
  const card = tile.closest('.be-pal-card');
  const name = card?.querySelector('.be-pal-name');
  const hex = card?.querySelector('.be-pal-hex');
  if (name) name.textContent = s.name;
  if (hex) hex.textContent = s.hex || 'transparent';
};
/** Refresh a swatch's tile in place (lock badge + colour), without a full repaint - 
 *  preserves `.is-selected` (tileHtml doesn't know selection state) so an open
 *  popover's tile doesn't lose its ring the moment its lock changes. */
export const refreshTile = (bedit: BrandEditorCtx, idx: number): void => {
  const { palMount } = bedit;
  const s = bedit.swatches[idx]; const tile = palMount?.querySelector<HTMLElement>(`[data-be-tile="${idx}"]`);
  if (!s || !tile) return;
  const wasSelected = tile.classList.contains('is-selected');
  tile.outerHTML = tileHtml(s, idx);
  if (wasSelected) palMount?.querySelector<HTMLElement>(`[data-be-tile="${idx}"]`)?.classList.add('is-selected');
};
export function wireReplacePalette(bedit: BrandEditorCtx): void {
  const { editorEl, reviewEl } = bedit;
  bedit.ramps.$('[data-be-replace-palette]')?.addEventListener('click', () => {
    const built = bedit.replace.buildReplacement();
    if (!built) return;
    bedit.pendingReplacement = built.next;
    bedit.replace.renderReview(built.plan);
  });
  reviewEl?.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    if (el.closest('[data-be-review-go]')) { if (bedit.pendingReplacement) bedit.replace.commitReplacement(bedit.pendingReplacement); return; }
    if (el.closest('[data-be-review-cancel]')) { bedit.replace.hideReview(); return; }
    if (el.closest('[data-be-review-undo]')) { bedit.replace.hideReview(); bedit.replace.undoLast(); }
  });

  // ── Palette: click a tile → open the shared swatch editor ───────────────────
  // One way to set a colour, not two: the popover's colour field is the full
  // picker (`modes` - its value input reads AND writes hex / OKLCH / HSL / RGB /
  // CMYK), so the old "Set by value" select+input row it duplicated is gone.
  // Everything funnels through applyEditedHex, which WRITES the doc in the
  // swatch's storage format (the "Stored as" toggle - LCH by default, or the
  // notation already in the doc for older edits).
  const editorLockBadge = editorEl?.querySelector<HTMLElement>('[data-be-editor-lockbadge]') ?? null; bedit.editorLockBadge = editorLockBadge;
  const editorChip = editorEl?.querySelector<HTMLElement>('[data-be-editor-chip]') ?? null; bedit.editorChip = editorChip;
  const storedSeg = editorEl?.querySelector<HTMLElement>('[data-be-stored]') ?? null; bedit.storedSeg = storedSeg;
  const storedRow = editorEl?.querySelector<HTMLElement>('[data-be-stored-row]') ?? null; bedit.storedRow = storedRow;
  const substDetails = editorEl?.querySelector<HTMLDetailsElement>('[data-be-subst-details]') ?? null; bedit.substDetails = substDetails;
  const substChips = editorEl?.querySelector<HTMLElement>('[data-be-subst-chips]') ?? null; bedit.substChips = substChips;
  /** The open swatch's $value notation (the "Stored as" toggle). */
  bedit.storedFmt = 'lch';
}

export function wireSwatchSubstitution(bedit: BrandEditorCtx): void {
  const { substMount } = bedit;
  const swatchSubst = substMount ? mountPrintLock(substMount, {
    hex: () => (bedit.selected >= 0 ? bedit.swatches[bedit.selected]!.hex : ''),
    getCmyk: () => (bedit.selected >= 0 ? getSwatchPrintOverride(bedit.doc, bedit.swatches[bedit.selected]!.path)?.cmyk ?? null : null),
    setCmyk: (cmyk) => { if (bedit.selected >= 0) { setSwatchCmykLock(bedit.doc, bedit.swatches[bedit.selected]!.path, cmyk); bedit.swatchEditor.afterSwatchLockChange(); } },
    getSpot: () => (bedit.selected >= 0 ? getSwatchPrintOverride(bedit.doc, bedit.swatches[bedit.selected]!.path)?.spot ?? null : null),
    setSpot: (spot) => { if (bedit.selected >= 0) { setSwatchSpotLock(bedit.doc, bedit.swatches[bedit.selected]!.path, spot); bedit.swatchEditor.afterSwatchLockChange(); } },
  }) : null; bedit.swatchSubst = swatchSubst;

  // The faces list, mounted beside the print lock. Its ctx reads the doc LIVE for
  // the same reason the lock's does: the popover and a re-derive can both change
  // a swatch's overrides, and a cached copy would show a stale row.
  const facesMount = bedit.ramps.$('[data-be-faces-mount]') as HTMLElement | null; bedit.facesMount = facesMount as BrandEditorCtx['facesMount'];
  const facesChips = bedit.ramps.$('[data-be-faces-chips]') as HTMLElement | null; bedit.facesChips = facesChips;
  const facesDetails = bedit.ramps.$('[data-be-faces-details]') as HTMLDetailsElement | null; bedit.facesDetails = facesDetails;
  const swatchFaces = facesMount ? mountFaces(facesMount, {
    canonical: () => {
      const cur = bedit.selected >= 0 ? bedit.swatches[bedit.selected] : null;
      if (!cur) return '';
      // The stored `$value` where it is a literal, NOT the resolved hex: the hex is
      // the sRGB bake, and deriving a wide-gamut face from a bake would clamp the
      // very chroma the face exists to carry. An alias has no literal, so it falls
      // back to the hex - a role's colour lives on the swatch it points at.
      return cur.isAlias ? cur.hex : (cur.raw || cur.hex);
    },
    get: () => (bedit.selected >= 0 ? getSwatchFaces(bedit.doc, bedit.swatches[bedit.selected]!.path) : new Map()),
    set: (target, face) => {
      if (bedit.selected < 0) return;
      setSwatchFace(bedit.doc, bedit.swatches[bedit.selected]!.path, target, face);
      bedit.swatchEditor.renderFacesChips();
      bedit.state.persist();
    },
  }) : null; bedit.swatchFaces = swatchFaces;
}

export function wireStoredSegment(bedit: BrandEditorCtx): void {
  const { storedSeg } = bedit;
  // "Stored as" - re-serialise the open swatch's $value in the picked notation.
  // An alias role has no literal of its own to re-write, so the row hides for
  // those (recolouring detaches the alias first, which re-shows it).
  storedSeg?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-store-fmt]'); if (!btn) return;
    const next = btn.dataset.storeFmt as StorageFormat;
    if (next === bedit.storedFmt) return;
    bedit.storedFmt = next;
    bedit.replace.renderStoredSeg();
    const cur = bedit.selected >= 0 ? bedit.swatches[bedit.selected] : null;
    if (!cur || cur.isAlias || !cur.hex) return;
    const stored = serializeColor(colorToHex(cur.raw) ?? cur.hex, bedit.storedFmt);
    setSwatchValue(bedit.doc, cur.path, stored);
    cur.raw = stored;
    bedit.state.persist();
  });
}

export function replaceOps(bedit: BrandEditorCtx) {
  return {
    undoLast: bindOp(bedit, undoLast),
    countLeaves: bindOp(bedit, countLeaves),
    buildReplacement: bindOp(bedit, buildReplacement),
    hideReview: bindOp(bedit, hideReview),
    li: bindOp(bedit, li),
    renderReview: bindOp(bedit, renderReview),
    renderReviewDone: bindOp(bedit, renderReviewDone),
    commitReplacement: bindOp(bedit, commitReplacement),
    renderStoredSeg: bindOp(bedit, renderStoredSeg),
    renderSubstChips: bindOp(bedit, renderSubstChips),
    syncTileMeta: bindOp(bedit, syncTileMeta),
    refreshTile: bindOp(bedit, refreshTile),
    wireReplacePalette: bindOp(bedit, wireReplacePalette),
    wireSwatchSubstitution: bindOp(bedit, wireSwatchSubstitution),
    wireStoredSegment: bindOp(bedit, wireStoredSegment),
  };
}
