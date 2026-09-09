// SPDX-License-Identifier: MPL-2.0
/**
 * brand editor: ramp steps, curve marks, surfaces, the palette repaint and beats.
 *
 * Every function takes the shared `bedit: BrandEditorCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `bedit.<module>.<fn>`. Extracted verbatim
 * from mountBrandEditor() by scripts/split-closure.ts.
 */
import { colorToHex, createTokenSet } from '@lolly/engine';
import { paletteHtml } from '../design-system/palette-view.ts';
import { paletteGroups } from '../design-system/palette-groups.ts';
import { RAMP_IDS, getExcludedSwatches, getSwatchPrintOverride, primaryAnchorPath, walkSwatches } from '../brand-doc.ts';
import type { BrandSwatch, PrintLock } from '../brand-doc.ts';
import { t } from '../../i18n.ts';
import { segHtml } from '../seg.ts';
import { colourBeat } from '../design-system/beats.ts';
import { ROLE_IDS, readRoles } from '../design-system/roles.ts';
import { RAMP_LABEL, ROLE_GLYPH, starterId } from './shared.ts';
import type { CurveMarks } from './shared.ts';
import { bindOp, type BrandEditorCtx } from './context.ts';

export const anchorStep = (_bedit: BrandEditorCtx, n: number): number => Math.round((n - 1) / 2) + 1;
// The primary's pinned print lock (null = auto-convert at export) - read LIVE
// off `doc` rather than cached, since the very same swatch (the primary ramp's
// anchor step) is also reachable - and lockable - through the Palette panel's
// swatch popover (see mountPrintLock's two call sites below). A cached copy
// would drift the moment the OTHER surface writes the lock straight to `doc`.
export const primaryPrintLock = (bedit: BrandEditorCtx): PrintLock | null => {
  const p = primaryAnchorPath(bedit.doc);
  return p ? getSwatchPrintOverride(bedit.doc, p) : null;
};
export const curveMarks = (bedit: BrandEditorCtx): CurveMarks => { const { curves } = bedit; return ({
  primary: { edited: !!curves.primary, open: bedit.editingCurveRamp === 'primary' },
  neutral: { edited: !!curves.neutral, open: bedit.editingCurveRamp === 'neutral' },
  secondary: { edited: !!curves.secondary, open: bedit.editingCurveRamp === 'secondary' },
}); };
// The brand's resolved surface role - the default background contrast-lock
// measures against (what a step will actually sit on). Falls back to white on a
// tokenless / unresolvable doc, exactly like the Palette Lab tool's `bg`.
export const surfaceHex = (bedit: BrandEditorCtx): string => {
  try {
    const v = createTokenSet(bedit.doc, { theme: bedit.currentTheme === 'dark' ? 'dark' : 'light' }).resolve('color.semantic.surface');
    return colorToHex(v) ?? '#ffffff';
  } catch { return '#ffffff'; }
};
/** The ramp picker, rendered once per wing (the two instances stay in sync).
 *  Its own `groupAttr` keeps it out of DERIVE_SEGS's generic delegate. */
export const rampPickHtml = (bedit: BrandEditorCtx): string => segHtml(
  'ramppick', RAMP_IDS.map(r => ({ id: r, label: RAMP_LABEL[r] })), bedit.curveRamp, t('Ramp'),
  { attr: 'data-ramp', extraClass: 'be-ramppick', groupAttr: 'data-be-ramp-pick' },
);
export const $ = <T extends Element>(bedit: BrandEditorCtx, sel: string): T | null => { const { root } = bedit; return root.querySelector<T>(sel); };
export const notifyPaletteObservers = (bedit: BrandEditorCtx): void => {
  const { paletteObservers } = bedit;
  for (const fn of paletteObservers) { try { fn(); } catch { /* observer's problem */ } }
};
/** Is a swatch still exactly as the starter shipped it? The one test, spelled
 *  once, so the pane, the count, the beat and the roles strip all agree. */
export const isStarterSwatch = (bedit: BrandEditorCtx, s: BrandSwatch): boolean =>
  bedit.starterSwatches.size > 0 && bedit.starterSwatches.has(starterId(s.key, s.raw));
/** Colours the person actually chose - the headline number, and what the beat
 *  is decided on (plan 182 sections 3a, 4.2). Roles are skipped for the reason
 *  paletteHtml skips them: an alias is not a colour somebody added. */
export const ownColorCount = (bedit: BrandEditorCtx): number => bedit.swatches.filter(s => s.kind !== 'semantic' && !isStarterSwatch(bedit, s)).length;
/** Which swatch wears which role mark, read off the doc's own aliases so the
 *  glyph and the Roles strip can never disagree. */
export const roleGlyphsNow = (bedit: BrandEditorCtx): Map<string, string> => {
  const out = new Map<string, string>();
  let resolve: ((key: string) => unknown) | undefined;
  try {
    const set = createTokenSet(bedit.doc, { theme: bedit.currentTheme === 'dark' ? 'dark' : 'light' });
    resolve = (key: string) => set.resolve(key);
  } catch { /* unresolvable doc - no marks rather than wrong ones */ }
  const held = readRoles(bedit.doc, bedit.currentTheme === 'dark' ? 'dark' : 'light', resolve);
  for (const role of ROLE_IDS) {
    const ref = held[role]?.ref;
    const glyph = ROLE_GLYPH[role];
    if (ref && glyph && !out.has(ref)) out.set(ref, glyph);
  }
  return out;
};
export const repaintPalette = (bedit: BrandEditorCtx): void => {
  const { palMount, paletteHooks } = bedit;
  // Roles store `{alias}` refs, so hand the walker a resolver built from the
  // SAME doc + theme the tiles are describing - otherwise every role renders
  // as a blank chip.
  let resolve: ((key: string) => unknown) | undefined;
  try {
    const set = createTokenSet(bedit.doc, { theme: bedit.currentTheme === 'dark' ? 'dark' : 'light' });
    resolve = (key: string) => set.resolve(key);
  } catch { /* a malformed doc still lists its literal swatches */ }
  // Excluded keys (a "deleted" derived step/role - the token stays, the tile
  // goes) are filtered here, so the grid, wheel, picker swatches and gradient
  // stop grids all inherit the exclusion from this one seam.
  const excluded = new Set(getExcludedSwatches(bedit.doc));
  bedit.swatches = walkSwatches(bedit.doc, bedit.currentTheme, resolve).filter(s => !excluded.has(s.key));
  if (palMount) {
    // Keep user-folded sections folded across the innerHTML replace (every
    // group renders `open` by default) - the same re-render/state guard the
    // gradients panel's details carries. Session-only; no persistence.
    const closed = new Set(
      [...palMount.querySelectorAll<HTMLDetailsElement>('.be-pal-group:not([open])')]
        .map(d => d.dataset.beGroup ?? '').filter(Boolean),
    );
    palMount.innerHTML = paletteHtml(bedit.swatches, bedit.starterSwatches, {
      roles: roleGlyphsNow(bedit), starterGroup: bedit.revealedStarterGroup,
      groups: paletteGroups(bedit.doc), hidden: excluded.size,
    });
    if (closed.size) {
      palMount.querySelectorAll<HTMLDetailsElement>('.be-pal-group').forEach(d => {
        if (closed.has(d.dataset.beGroup ?? '')) d.open = false;
      });
    }
  }
  bedit.paintWheel();
  bedit.paintSlices();
  bedit.state.syncPickerSwatches();
  for (const fn of paletteHooks) fn();
  applyBeat(bedit);
  notifyPaletteObservers(bedit);
};
/**
 * Stamp the beat, unless something is open over the room.
 *
 * The layout MOVES between beats - the split appears, panels arrive - and
 * doing that under an open swatch card or picker would pull the thing the
 * person is operating out from under them. So a beat that falls due mid-
 * interaction is held and applied by the next close (see closeEditor).
 */
export const applyBeat = (bedit: BrandEditorCtx): void => {
  const { GENERATED_RAMP, colorPanel, editorEl, rolesStrip } = bedit;
  if (!colorPanel) return;
  if (editorEl && !editorEl.hidden) { bedit.beatPending = true; return; }
  bedit.beatPending = false;
  const next = colourBeat(
    { counts: { ownColors: ownColorCount(bedit), starterColors: 0, ownFaces: 0, logos: 0 } },
    { generatedRamp: bedit.swatches.some(s => GENERATED_RAMP.test(s.key)) },
  );
  if (colorPanel.dataset.beBeat === String(next)) return;
  bedit.beat = next;
  colorPanel.dataset.beBeat = String(next);
  bedit.addColor.syncAddPlaceholder();
  // The roles strip widens to all seven slots at beat 2 (plan 182 section 5.7),
  // and the palette hooks above have already run with the OLD beat - so the
  // strip is re-rendered here, on the change itself. Its own render is a no-op
  // patch when the row set has not moved.
  rolesStrip?.render();
};
export function rampsOps(bedit: BrandEditorCtx) {
  return {
    anchorStep: bindOp(bedit, anchorStep),
    primaryPrintLock: bindOp(bedit, primaryPrintLock),
    curveMarks: bindOp(bedit, curveMarks),
    surfaceHex: bindOp(bedit, surfaceHex),
    rampPickHtml: bindOp(bedit, rampPickHtml),
    $: <T extends Element>(sel: string): T | null => $<T>(bedit, sel),
    notifyPaletteObservers: bindOp(bedit, notifyPaletteObservers),
    isStarterSwatch: bindOp(bedit, isStarterSwatch),
    ownColorCount: bindOp(bedit, ownColorCount),
    roleGlyphsNow: bindOp(bedit, roleGlyphsNow),
    repaintPalette: bindOp(bedit, repaintPalette),
    applyBeat: bindOp(bedit, applyBeat),
  };
}
