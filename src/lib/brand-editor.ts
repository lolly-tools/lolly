// SPDX-License-Identifier: MPL-2.0
/**
 * Brand studio - the ONE place brand primitives are created, edited, saved,
 * imported and exported. Mounted exclusively by #/start (the Dashboard's
 * Design-system tab is a read-only rendering of the result; user preferences
 * like the app theme live on #/profile - that separation is the whole point).
 *
 * The studio renders five tab panels, each wrapped in `[data-be-tab-panel]`;
 * the host view (start.ts) drives visibility by setting `data-active-tab` on
 * the editor root - every panel stays mounted (and wired) whichever tab shows:
 *
 *  1. logos - the Logos room (plan 97 section 7.3). Level 0 is one multi-file drop
 *                 zone: each file is classified (classify-logo.ts), proposes one
 *                 of the eight slots and waits as a confirm chip, and a placed
 *                 colour SVG offers generated mono / reverse siblings. Under it,
 *                 unchanged, the canonical orientation × treatment matrix
 *                 (brand-logos.ts), user-named custom marks ("icon", "crest")
 *                 and additional logo identities. Every placement runs the
 *                 shared trim-to-content offer first (trim-offer.ts), and an SVG
 *                 feeds the Colours room's "found in the logo" primary
 *                 suggestion, with its other colours going to the tray.
 *  2. color - the Colours room (plan 97 section 7.1). Level 0 leads: "Add a colour"
 *                 writes exactly one token, and the Roles strip says which
 *                 swatch plays each part. The expert controls - Generate a
 *                 starter palette, Shade curves, Contrast, Print - are folded
 *                 into four wings below it. The palette (every swatch an
 *                 editable tile + the OKLCH wheel) and optional gradient tokens
 *                 sit in the side pane.
 *  3. type - the Type room (plan 97 section 7.2). Level 0 is four ROLE CARDS
 *                 (Primary, Headings, Code, Italic - brand-vars.ts's FONT_SLOTS),
 *                 each showing the face that serves it on a live one-line
 *                 specimen. A card opens the COMPARE STAGE inline
 *                 (design-system/type-compare.ts): Google families by name,
 *                 dropped font files, and font candidates a source scan left in
 *                 the tray all stand side by side on one editable specimen at
 *                 one size, and NOTHING installs until a card is chosen. The
 *                 stage previews faces as session-scoped FontFaces and installs
 *                 nothing itself - `applyTypeChoice` here is the only writer
 *                 (installGoogleFont / installFontFromBytes, then the role).
 *                 Below it: the management list of installed families (roles,
 *                 delete), the font-file upload panel, and the full four-role
 *                 specimen.
 *  4. tokens - the corner radius plus every other non-colour primitive
 *                 (spacing, sizing, stroke, opacity, rotation, numbers, shadows
 * - lib/token-studio.ts).
 *  5. catalogue - brand asset uploads, sorted the same way the Catalogue view
 *                 sorts them (vector / image / audio / motion).
 *
 * Everything persists to the active design system's head via the bridge's
 * single write chokepoint (installUserTokens → bust → the next get()/colors()/
 * resolve() re-reads). ONE save discipline (plan 97 section 6): every commit-level
 * action persists immediately and a session undo stack (Ctrl/Cmd+Z, scoped to
 * the Colours room) is the safety net - there is no draft, no dirty flag, and
 * no confirm dialog where an undo suffices.
 * Import/export of the whole brand pack is exposed on the handle
 * (exportPack/importPack) so the host view owns those buttons' placement.
 *
 * A LOCKED build (host.tokens.isLocked()) exposes none of this - the caller
 * renders a read-only note instead. Everything is best-effort and DOM-guarded:
 * a detached editor (route changed mid-op) never writes to a dead node.
 */

import type { Unzipped } from 'fflate';
import { mountPaletteGroupControls } from './design-system/palette-view.ts';
import type { WebTokensAPI } from '../bridge/tokens.ts';
import { primaryAnchorPath } from './brand-doc.ts';
import type { ContrastLockPreset } from './brand-doc.ts';
import { applyChromeBrandVars } from '../brand-vars.ts';
import { wireColorField } from '../components/color-field.ts';
import type { SliceChartState } from './oklch-slice.ts';
import type { FontRole, UserFontsHost } from '../user-fonts.ts';
import type { BrandTransferHost } from '../brand-transfer.ts';
import { t } from '../i18n.ts';
import { segHtml } from './seg.ts';
import { prefersReducedMotion } from './a11y-prefs.ts';
import type { ColorEntry } from './design-system/add-color.ts';
import { createSelection } from './design-system/palette-select.ts';
import type { BrandEditorOptions, EditorHost } from './brand-editor/shared.ts';
import type { BrandEditorCtx } from './brand-editor/context.ts';
import { rampsOps } from './brand-editor/ramps.ts';
import { stateOps } from './brand-editor/state.ts';
import { curveEditorOps } from './brand-editor/curve-editor.ts';
import { deriveOps } from './brand-editor/derive.ts';
import { replaceOps } from './brand-editor/replace.ts';
import { swatchEditorOps } from './brand-editor/swatch-editor.ts';
import { palSelectOps } from './brand-editor/pal-select.ts';
import { gridOps } from './brand-editor/grid.ts';
import { addColorOps } from './brand-editor/add-color.ts';
import { rolesOps } from './brand-editor/roles.ts';
import { typeOps } from './brand-editor/type.ts';
import { compareStageOps } from './brand-editor/compare-stage.ts';
import { logosOps } from './brand-editor/logos.ts';
import { logoIntakeOps } from './brand-editor/logo-intake.ts';
import { packOps } from './brand-editor/pack.ts';
export type { BrandTabKey, BrandEditorOptions } from './brand-editor/shared.ts'; // every .be-* rule - rides this module's lazy chunk
         // .help-tip-btn/-pop/-host - the shared chunk the tool
                                           // view and /profile already pull for the same primitive
                // the gamut chart's .okls-* rules (see oklch-slice.ts)


// The engine's own default for `secondary` (deriveBrandTokens hardcodes ramp
// step 5); `neutral` has no engine default to match since it's not a slot the
// engine emits at all - step 5 (the ramp's contrast-anchor step) is this
// editor's own sensible starting point for it.
const _DEFAULT_RAMP_STEP = 5;

// `segHtml` moved to lib/seg.ts (component audit rec 1 - the one `.view-seg`
// primitive, shared beyond the brand studio); re-exported here for compat with
// anything still importing it from this module.
export { segHtml };

/** teardown: unmount. exportPack/importPack: the brand-file share pair, exposed
 *  here so the host view owns the buttons' placement (errors propagate - the
 *  caller shows them). */
export interface BrandEditorHandle {
  teardown: () => void;
  /** Retained only so an older caller still compiles. Every commit in the studio
   *  persists immediately (plan 97 section 6), so there is never a draft to save and
   *  never a pending state to report - start.ts consulted neither, verified. */
  saveDraft: () => void;
  isDirty: () => boolean;
  /** Add n colours as n swatches, through the Colours room's own write - one
   *  `addSwatch` each, one persist, no derive and nothing suggested-into (plan
   *  97 section 3 principle 1). Returns how many landed.
   *
   *  This is the ONLY correct way for another surface (the tray) to add a
   *  colour: it writes into the live document this editor holds, so an add can
   *  never reinstall a stale snapshot over edits made in the room. Additive
   *  since plan 97 M2; absent on a locked build, which writes nothing at all. */
  addColors?: (entries: ColorEntry[]) => number;
  exportPack: () => Promise<{ filename: string }>;
  importPack: (source: File | Unzipped) => Promise<void>;
  /** Re-read the installed doc and repaint every panel - for a host that
   *  installed tokens through its own path (JSON/SVG import) underneath us. */
  reload: () => Promise<void>;
  /** Close any floating editor UI (the swatch popover) - the host calls this
   *  on tab switches, where an open popover would otherwise outlive the tile
   *  it was anchored to (the popover sits outside the tab panels). */
  closeOverlays: () => void;
  /** Subscribe to COMMITTED-palette changes. Fired from both repaintPalette
   *  and persist() - in-place recolours (wheel drags, popover edits) bypass
   *  repaintPalette and only funnel through persist(), so a single hook point
   *  would miss one path. Returns an unsubscribe. */
  onPalette: (cb: () => void) => () => void;
  /** Deep-link entry: reveal the folded Colour chart card (the OKLCH wheel) the
   *  Colours tab opens on click - repaints itself via its own toggle handler.
   *  Returns false when the card isn't present (a locked build renders no
   *  studio), so a host can degrade gracefully. */
  openColorChart: () => boolean;
  /** Open a level-2 wing of the Colours room. False when absent (a locked build
   *  renders no studio). Additive since plan 97 M1. */
  openWing?: (key: 'generate' | 'curves' | 'contrast' | 'print') => boolean;
  /** Prime the Generate wing's primary colour (the `?seed=` deep link - the
   *  added-chip's "Generate your palette from this colour"). Runs the same
   *  fan-out a manual pick runs. Additive, audit 167 F-A12. */
  setGeneratePrimary?: (hex: string) => void;
  /** Session undo for the room's destructive actions. Additive since M1. */
  undo?: () => boolean;
  canUndo?: () => boolean;
  /** Which beat the Colours room is showing (plan 182 section 3a) - 0 when the
   *  design system has no colour of its own, 1 after the first, 2 once there is
   *  a palette. The host reads it to decide whether the phone's palette mirror
   *  has anything to mirror. 2 on a locked build, which renders no studio and
   *  therefore holds nothing back. Additive. */
  colourBeat?: () => 0 | 1 | 2;
  /** Show one INHERITED colour group in the Colours pane, folded and tagged
   *  Starter (`?area=color&group=neutral` - the Tokens room's "Open"). The one
   *  place a starter tile is ever drawn. False when no such group exists.
   *  Additive. */
  openStarterGroup?: (group: string) => boolean;
  /** Open the Colours room's colour picker, anchored to the add row's chip
   *  (`?area=color&focus=pick` - the Overview's "Pick a colour" door). Nothing is
   *  written until the person presses Add colour. False when the room did not
   *  render (a locked build). Additive, plan 182 section 3a. */
  openPickCard?: () => boolean;
  /** Open the Type room's face stage for one role (`?area=type&focus=stage` -
   *  the Overview's "Choose a face" door). Presentation only: the stage installs
   *  nothing until a card is chosen. False when the room did not render.
   *  Additive, plan 182 section 3a. */
  openTypeStage?: (role: FontRole) => boolean;
}

export async function mountBrandEditor(root: HTMLElement, host: EditorHost, opts: BrandEditorOptions = {}): Promise<BrandEditorHandle> {
  const bedit = {} as BrandEditorCtx;
  bedit.ramps = rampsOps(bedit);
  bedit.state = stateOps(bedit);
  bedit.curveEditor = curveEditorOps(bedit);
  bedit.derive = deriveOps(bedit);
  bedit.replace = replaceOps(bedit);
  bedit.swatchEditor = swatchEditorOps(bedit);
  bedit.palSelect = palSelectOps(bedit);
  bedit.grid = gridOps(bedit);
  bedit.addColor = addColorOps(bedit);
  bedit.roles = rolesOps(bedit);
  bedit.type = typeOps(bedit);
  bedit.compareStage = compareStageOps(bedit);
  bedit.logos = logosOps(bedit);
  bedit.logoIntake = logoIntakeOps(bedit);
  bedit.pack = packOps(bedit);
  bedit.root = root;
  bedit.host = host;
  bedit.opts = opts;

  const tokens = host.tokens as unknown as WebTokensAPI | undefined; bedit.tokens = tokens;
  const fontsHost = host as unknown as UserFontsHost; bedit.fontsHost = fontsHost;
  const transferHost = { host: host as unknown as BrandTransferHost, storage: localStorage }; bedit.transferHost = transferHost;

  bedit.locked = false;
  try { bedit.locked = !!(await tokens?.isLocked?.()); } catch { /* treat as unlocked */ }
  if (bedit.locked) {
    root.innerHTML = `<p class="be-locked">${t('This build ships with a fixed brand - its colours, fonts and tokens are what the whole app, your tools and every export wear. Brand editing is turned off here.')}</p>`;
    return {
      teardown: () => {}, saveDraft: () => {}, isDirty: () => false,
      exportPack: () => Promise.reject(new Error(t('This brand is fixed - there is nothing of yours to export.'))),
      importPack: () => Promise.reject(new Error(t('This brand is fixed - imports are turned off.'))),
      reload: () => Promise.resolve(),
      closeOverlays: () => {},
      onPalette: () => () => {},
      openColorChart: () => false,
    };
  }

  await bedit.state.loadDocument();

  bedit.state.seedSteps();

  bedit.state.seedHarmony();
  // Contrast-lock presets - labels only; the [low,high] Lc spans live in
  // brand-doc's contrastTargets (shared verbatim with the Palette Lab tool).
  const CONTRAST_LOCK_PRESETS: ReadonlyArray<{ id: ContrastLockPreset; label: string }> = [
    { id: 'even', label: t('Even') },
    { id: 'text', label: t('Text-first') },
    { id: 'ui', label: t('UI states') },
  ]; bedit.CONTRAST_LOCK_PRESETS = CONTRAST_LOCK_PRESETS;

  // The default contrast-lock background, seeded once for the control's initial
  // value (the user can re-pick it any time; Apply reads the live input).
  const contrastLockBg = bedit.ramps.surfaceHex(); bedit.contrastLockBg = contrastLockBg;

  // The ramp the Shade curves + Contrast wings act on. The curve editor and the
  // two one-shot transforms used to share the "whichever ramp's glyph you
  // clicked" state; now that they live in two separate wings, each wing renders
  // the SAME picker and this is the one value both read.
  // `primary` is only the right default while the document HAS a primary ramp.
  // The starter cut ships none (plan 182 section 12), so a design system that
  // has never generated a palette would open both wings on a ramp that does not
  // exist; neutral is the one ramp a starter always carries. The wings are
  // beat-2 material either way, so this only ever bites the person who reached
  // beat 2 on custom colours alone.
  bedit.curveRamp = primaryAnchorPath(bedit.doc) ? 'primary' : 'neutral';

  bedit.derive.seedDraftAndMarkup();

  bedit.state.wirePreview();
  bedit.paintWheel = () => {};
  // The gamut chart - the same swatches again, on a plane through OKLCH space
  // where the sRGB/P3/Rec.2020 boundaries are visible. Only ONE of the two
  // charts is mounted at a time (the hidden one measures 0×0 and would paint
  // nothing anyway), so `chartView` gates both the markup and the repaints.
  const sliceMount = bedit.ramps.$('[data-be-slice-mount]') as HTMLElement | null; bedit.sliceMount = sliceMount;
  // bedit.sliceTeardown: assigned later
  bedit.chartView = 'wheel';
  // No cMax: the chart derives its chroma ceiling from the gamut it charts
  // (Rec.2020 by default, so 0.5), which is what stops the wide-gamut spikes
  // being drawn with flat tops.
  const sliceState: SliceChartState = { plane: 'lc', fixed: 30 }; bedit.sliceState = sliceState;
  bedit.paintSlices = () => {};

  // Hooks run at the end of every repaintPalette (the generator's candidate
  // "added" states + applied-previews subscribe here, so any palette change - 
  // add / delete / re-derive - keeps them in sync). Declared as a mutable list
  // to sidestep the TDZ: the generator functions are defined further below.
  const paletteHooks: Array<() => void> = []; bedit.paletteHooks = paletteHooks;
  // External observers of the COMMITTED palette (the handle's onPalette - the
  // mobile mirror, gradient stop chips). Notified from BOTH repaintPalette and
  // persist(): in-place recolours (wheel drags, popover edits) bypass
  // repaintPalette and only reach persist(), so either seam alone would miss
  // one path. Observers must tolerate double-fires (a repaint + its persist).
  const paletteObservers = new Set<() => void>(); bedit.paletteObservers = paletteObservers;
  // Every colour the SHIPPED starter document holds, as key+value pairs. Read
  // once after the first paint (the read is async and must not hold it up), and
  // empty on any brand that ships no starter - so the palette and the Overview
  // count agree about which colours nobody chose. See readStarterDoc.
  bedit.starterSwatches = new Set<string>();
  bedit.revealedStarterGroup = null;

  // Ownership still informs Overview and mobile affordances; it never hides palette editing.
  bedit.beat = 2;
  /** A beat the room owes but has not applied - see applyBeat. */
  bedit.beatPending = false;
  /** The ramp only a generate writes. `deriveBrandTokens` always emits
   *  `secondary`, so its presence is the cheapest honest answer to "has a
   *  palette been generated here" - the same test the Overview's
   *  `worthExporting` latch makes, deliberately spelled the same way. */
  const GENERATED_RAMP = /(^|\.)ramp\.secondary\./; bedit.GENERATED_RAMP = GENERATED_RAMP;

  // ── Session undo (plan 97 section 6) ───────────────────────────────────────────────
  // The one save discipline means every commit writes straight through, so the
  // destructive actions need a way back. Snapshots are whole documents - a few
  // KB of JSON - so the cap is memory-shaped, not a product limit. Checkpoints
  // (the durable, cross-reload net) belong to the host and are reached through
  // opts.checkpoint. Six actions push, every one of which REMOVES something the
  // user cannot retype: Replace palette, bulk delete, a single swatch delete,
  // clearing a role from the strip, un-pressing a "Use as" role in the swatch
  // popover, and "Rebuild from colour" (which discards a hand-tuned curve). An
  // ordinary recolour, rename or curve drag is not destructive - the value is
  // still on screen - and would only flood the stack.
  const UNDO_LIMIT = 20; bedit.UNDO_LIMIT = UNDO_LIMIT;
  const undoStack: Array<{ doc: Record<string, unknown>; label: string }> = []; bedit.undoStack = undoStack;

  /**
   * Push the edited doc to the install (debounced) + refresh chrome & pickers.
   * The ONE write, and the one save discipline: every commit-level action in
   * this room calls it immediately (plan 97 section 6). Every caller is a Colour-tab
   * surface (palette tiles, wheel, locks, generator, the add row), so this is
   * also the one place that flags colour-tab activity to the host.
   */
  bedit.saveQueue = Promise.resolve();
  bedit.saveRevision = 0;

  /** Set once the Replace-palette review card exists (it is declared far below
   *  this, and every derive control funnels through renderPreview). A parked
   *  proposal describes the controls as they were when it was built, so a later
   *  change must drop it rather than leave a card that would install a document
   *  the panel no longer describes. */
  bedit.dropPendingReplacement = () => {};

  bedit.derive.wireStepsSlider();
  wireColorField(root, { onChange: bedit.state.onPrimaryFieldChange });

  // ── Tonal-curve editor wiring ───────────────────────────────────────────────
  // A curve edit is a real write, debounced like every other edit in the room:
  // it bakes the ramp's steps onto `doc` and installs once the drag settles.
  const curveEditorMount = bedit.ramps.$('[data-be-curve-editor]') as HTMLElement | null; bedit.curveEditorMount = curveEditorMount;
  const curveMountEl = bedit.ramps.$('[data-be-curve-mount]') as HTMLElement | null; bedit.curveMountEl = curveMountEl;
  const curveTitleEl = bedit.ramps.$('[data-be-curve-title]') as HTMLElement | null; bedit.curveTitleEl = curveTitleEl;
  bedit.curveHandle = null;
  // A curve drag fires per frame. renderPreview is cheap (one re-derive into the
  // wing's own markup); the palette repaint is not - it rebuilds the grid, the
  // wheel and the gamut slices - and NEITHER is persist(): it synchronously runs
  // notify('color') (the host re-reads the whole design system for the Overview)
  // and notifyPaletteObservers() (the mobile sheet rebuilds its markup and
  // re-measures) before its own 300ms install debounce even starts. Both are
  // exactly the work a per-frame handler must not do, so the repaint AND the
  // save trail the drag by 250ms together.
  const CURVE_SETTLE_MS = 250; bedit.CURVE_SETTLE_MS = CURVE_SETTLE_MS;
  // bedit.curveSettleTimer: assigned later
  bedit.curveSaveDue = false;
  // A teardown mid-drag must not repaint a dead tree - but it must not eat the
  // last frame either, so a pending save is flushed rather than dropped.
  bedit.cleanups.push(() => {
    clearTimeout(bedit.curveSettleTimer);
    if (bedit.curveSaveDue) { bedit.curveSaveDue = false; bedit.state.persist(true); }
  });
  curveEditorMount?.querySelector('[data-be-curve-rebuild]')?.addEventListener('click', () => bedit.curveEditor.rebuildRampFromColour());
  curveEditorMount?.querySelector('[data-be-curve-close]')?.addEventListener('click', () => bedit.curveEditor.closeCurveEditor());
  bedit.cleanups.push(() => { bedit.curveHandle?.teardown(); bedit.curveHandle = null; });

  // ── Contrast-lock (a curve TRANSFORM over the picked ramp) ───────────────────
  // Builds a fresh curve that hits per-step APCA targets against a background,
  // KEEPING each step's hue + chroma, then hands it to the SAME curve machinery
  // every other curve rides. The commit shape mirrors the sibling "Rebuild from
  // colour" button (rebuildRampFromColour): write curves[ramp], overlay onto the
  // doc (bake + stamp), re-render the editor + preview, repaint the palette, and
  // persist. One-shot: afterwards the ramp is an ordinary curve (drag / re-anchor
  // on primary edit / Rebuild-from-colour all apply as-is).
  const clBgInput = bedit.ramps.$('[data-be-cl-bg]') as HTMLInputElement | null; bedit.clBgInput = clBgInput;
  const clPresetSel = bedit.ramps.$('[data-be-cl-preset]') as HTMLSelectElement | null; bedit.clPresetSel = clPresetSel;
  const clCustomInput = bedit.ramps.$('[data-be-cl-custom]') as HTMLInputElement | null; bedit.clCustomInput = clCustomInput;
  const clReadout = bedit.ramps.$('[data-be-cl-readout]') as HTMLElement | null; bedit.clReadout = clReadout;
  bedit.ramps.$('[data-be-cl-apply]')?.addEventListener('click', () => bedit.derive.applyContrastLock());

  // ── Rotate hue (a curve TRANSFORM over the picked ramp) ──────────────────────
  // Shifts every step's hue by a fixed angle (L + C untouched, gamut-mapped at
  // bake by oklchToHex), rotating the whole ramp bodily around the wheel. The
  // commit shape is the SAME as contrast-lock / Rebuild-from-colour: write
  // curves[ramp], overlay onto the doc (bake + stamp), re-render the editor +
  // preview, repaint the palette, persist. One-shot: the slider resets to 0
  // afterwards and the ramp is an ordinary curve (further rotation composes;
  // drag / re-anchor / Rebuild all apply as-is).
  const hrDegInput = bedit.ramps.$('[data-be-hr-deg]') as HTMLInputElement | null; bedit.hrDegInput = hrDegInput;
  const hrDegVal = bedit.ramps.$('[data-be-hr-val]') as HTMLElement | null; bedit.hrDegVal = hrDegVal;
  hrDegInput?.addEventListener('input', () => {
    if (hrDegVal) hrDegVal.textContent = `${Number(hrDegInput.value) || 0}°`;
  });

  bedit.derive.wireHueRotate();

  // ── Build the palette: generate harmony accents (named) + live "applied" previews ──
  // Each accent is a candidate the user must explicitly + Add to officiate it
  // into the brand (addSwatch → repaintPalette → persist), matching the Palette
  // panel's add semantics. The previews render the CURRENT brand palette on
  // illustrative graphics so the effect of adding/removing colours is felt.
  const candidatesEl = bedit.ramps.$('[data-be-candidates]') as HTMLElement | null; bedit.candidatesEl = candidatesEl;
  const previewsEl = bedit.ramps.$('[data-be-previews]') as HTMLElement | null; bedit.previewsEl = previewsEl;
  /** The brand's live palette as hexes (primary first), deduped - feeds the previews. */
  bedit.previewSelection = [];
  bedit.previewScene = 0;

  bedit.derive.wireScenes();

  bedit.derive.wireAnalogous();

  bedit.derive.paintInitialScreen();

  bedit.derive.wirePrimaryLock();
  bedit.ramps.$('[data-be-undo]')?.addEventListener('click', () => { bedit.replace.undoLast(); });
  const reviewEl = bedit.ramps.$('[data-be-review]') as HTMLElement | null; bedit.reviewEl = reviewEl;
  /** The proposal the review card is describing, or null when it is closed. */
  bedit.pendingReplacement = null;
  // A proposal is a snapshot of the derive controls, and the card sits in the
  // same open wing as the controls that built it - so any later change retires
  // it rather than leaving a card whose counts, and whose document, describe a
  // panel that has moved on. Only an OPEN proposal is dropped: the "replaced,
  // Undo" card that follows a commit holds no document and stays put.
  bedit.dropPendingReplacement = (): void => { if (bedit.pendingReplacement) bedit.replace.hideReview(); };

  bedit.replace.wireReplacePalette();
  // The swatch popover's print substitutes - always read/write whichever swatch
  // is CURRENTLY open (`selected`), so the control is built once and driven
  // dynamically rather than re-mounted per swatch (openEditor calls render()).
  const substMount = bedit.editorEl?.querySelector<HTMLElement>('[data-be-subst-mount]') ?? null; bedit.substMount = substMount as BrandEditorCtx['substMount'];

  bedit.replace.wireSwatchSubstitution();

  bedit.replace.wireStoredSegment();

  /**
   * Place the popover against `tile`. The card is allowed to be tall - opening
   * the print fold, or switching to CMYK's four sliders, grows it - and the
   * answer to that is to MOVE it, not to scroll it: below the tile by default,
   * flipped above when it would overhang and there's room up there, and only
   * pinned to the viewport (letting the card's own max-height start an inner
   * scroll) when it fits in neither direction.
   *
   * Coordinates are viewport-space until the last line, which converts into `.be`
   * space (the popover is absolute within it). The left floor (8) must win over
   * the right clamp, so a viewport narrower than the card never pushes it off the
   * left edge. Needs the popover measurable - openEditor unhides it before calling.
   */
  const MARGIN = 8; bedit.MARGIN = MARGIN;
  const { renderEditorGroup } = mountPaletteGroupControls(bedit.palMount, bedit.editorEl, {
    doc: () => bedit.doc, swatches: () => bedit.swatches, current: () => bedit.swatches[bedit.selected],
    before: bedit.state.pushUndo, commit: () => { bedit.ramps.repaintPalette(); bedit.state.persist(true); },
    close: bedit.swatchEditor.closeEditor, open: path => bedit.swatchEditor.openSwatchAt(path),
  }); bedit.renderEditorGroup = renderEditorGroup;

  bedit.swatchEditor.wireEditorAdd();

  // The card earns its height back by MOVING. Anything that resizes it - folding
  // the print section open, switching the picker to CMYK's four sliders, a spot
  // name field appearing - re-runs positionEditor, which flips the card above the
  // tile when there's room up there. A ResizeObserver catches all of it, including
  // the changes we don't own (the colour field's own internals), so this is one
  // hook rather than a listener per control. Guarded: jsdom (the CLI shell's
  // renderer, and the unit tests) has no ResizeObserver.
  if (bedit.editorCard && typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => bedit.swatchEditor.reposition());
    ro.observe(bedit.editorCard);
    bedit.cleanups.push(() => ro.disconnect());
  }
  const bulkbar = bedit.ramps.$('[data-be-bulkbar]') as HTMLElement | null; bedit.bulkbar = bulkbar;
  const palSel = createSelection({ order: bedit.palSelect.ownOrder }); bedit.palSel = palSel;
  /** The tile holding the grid's one tab stop (roving tabindex). */
  bedit.palFocusKey = null;

  // The bar's three menus. One open at a time; a second press on its own button
  // closes it, as does Escape, an outside pointer, and the bar itself leaving.
  bedit.openBulkPanel = null;
  window.addEventListener('resize', bedit.palSelect.onBulkResize);
  bedit.cleanups.push(() => window.removeEventListener('resize', bedit.palSelect.onBulkResize));
  paletteHooks.push(bedit.palSelect.syncPalSelect);
  bulkbar?.querySelector<HTMLElement>('[data-be-bulk-cancel]')?.addEventListener('click', bedit.palSelect.exitPalSelect);
  bedit.ramps.$('[data-be-bulk-preview]')?.addEventListener('click', () => { bedit.ramps.$('.be-context')?.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' }); });

  bedit.palSelect.wireBulkBar();

  bedit.palSelect.seedMarquee();

  bedit.palSelect.wireMarquee();

  bedit.palSelect.wirePalettePointer();

  const CHANNEL_NAME: Record<'L' | 'C' | 'H', string> = { L: t('Lightness'), C: t('Chroma'), H: t('Hue') }; bedit.CHANNEL_NAME = CHANNEL_NAME;

  bedit.grid.wirePaletteKeys();
  document.addEventListener('pointerdown', bedit.grid.onDocPointer, true);
  document.addEventListener('keydown', bedit.grid.onKey);
  bedit.cleanups.push(() => { document.removeEventListener('pointerdown', bedit.grid.onDocPointer, true); document.removeEventListener('keydown', bedit.grid.onKey); });
  document.addEventListener('scroll', bedit.grid.onAnchorScroll, { capture: true, passive: true });
  bedit.cleanups.push(() => document.removeEventListener('scroll', bedit.grid.onAnchorScroll, true));

  bedit.grid.wireWheel();

  // Repaint at most once per frame while the fixed slider is scrubbed, at half
  // resolution - three engine slices is ~17ms of real work, too much to run
  // synchronously inside a pointermove.
  bedit.sliceFrame = 0;

  bedit.grid.wireGamutChart();

  bedit.grid.wireChartDetails();

  bedit.addColor.wireAddedChip();

  bedit.addColor.wireAddColorMount();
  // "Or bring a file" - beat 0's one alternative door, opening the host's own
  // source picker (the same one the rail's "Add from…" opens).
  root.querySelector('[data-be-beat0-file]')?.addEventListener('click', () => { opts.openImport?.(); });

  paletteHooks.push(bedit.derive.syncPrintWing);

  // ── Roles as an assignment layer ────────────────────────────────────────────
  // The strip reads the doc and writes through assignRole/clearRole; every
  // repaint re-reads it, so an add, a delete, a Replace or an undo all land.
  const rolesMount = bedit.ramps.$('[data-be-roles]') as HTMLElement | null; bedit.rolesMount = rolesMount as BrandEditorCtx['rolesMount'];

  bedit.roles.wireRolesStrip();

  await bedit.roles.wireUseAs();

  bedit.type.seedFonts();

  bedit.type.paintTypeRoom();

  /** The stage's seat when nothing is open: the scaffold position, straight
   *  after the cards panel. Both halves are remembered, because appending to the
   *  parent would park it after the Fonts panel instead. */
  const stageHome = bedit.stageEl?.parentElement ?? null; bedit.stageHome = stageHome;
  const stageHomeNext = bedit.stageEl?.nextElementSibling ?? null; bedit.stageHomeNext = stageHomeNext;
  bedit.cleanups.push(() => bedit.compareStage.closeStage({ restoreFocus: false }));
  // A width change while the stage is open moves it: under its card on a wide
  // screen, after the strip on a narrow one. Without this, rotating a phone
  // leaves the stage inside a sideways scroller.
  try {
    const mq = root.ownerDocument.defaultView?.matchMedia('(max-width: 640px)');
    const onWidth = (): void => { if (bedit.stageOpen) bedit.compareStage.placeStage(); };
    mq?.addEventListener('change', onWidth);
    bedit.cleanups.push(() => mq?.removeEventListener('change', onWidth));
  } catch { /* no matchMedia - the stage keeps its seat, which works at any width */ }

  bedit.compareStage.wireTypeCards();
  bedit.logoUrls = []; // object URLs to revoke on repaint/teardown
  // Identities the user added this session that hold no assets yet - an identity
  // only truly exists through its assets, so empty sections live here until the
  // first mark lands (and vanish on reload if none ever does; that's honest).
  const pendingIdentities: string[] = []; bedit.pendingIdentities = pendingIdentities;
  // Which of the unnamed identity's slots currently hold a mark. Refreshed by
  // every paint and read by the intake queue: a chip says "Replace" instead of
  // "Place" for a taken slot, and a derived variant is only offered for an EMPTY
  // sibling. The intake files into the unnamed identity only - a named identity's
  // slots are still filled from their own tiles, which is where their context is.
  bedit.filledDefaultSlots = new Set<string>();
  // Repaints the intake queue. Assigned further down (the queue's own render
  // needs helpers declared after this point); declared here as a mutable so
  // paintLogos can keep the chips' "Place" / "Replace" labels honest without a
  // temporal-dead-zone reference.
  bedit.renderIntake = () => {};
  // Drains marks handed over by another view (the #/pdf exploder's "Send to the
  // Design System studio"). Same forward-declared shape as renderIntake above
  // and for the same reason: the paint runs before the queue's own helpers
  // exist, and the real drain needs addLogoFiles.
  bedit.drainPendingLogos = () => {};
  void bedit.logos.paintLogos();
  bedit.cleanups.push(() => bedit.logoUrls.forEach(u => { URL.revokeObjectURL(u); }));

  // The logo-colour pathway: an SVG mark carries the design system's real
  // colours, so offer (or on a still-unbranded install, simply apply) its first
  // colour. The note lives in the Add hero, where the colour lands.
  const suggestEl = bedit.ramps.$('[data-be-suggest]') as HTMLElement | null; bedit.suggestEl = suggestEl;
  // The candidate tray (plan 97 section 8) - the HOST's, whenever it has one, because
  // two live trays over one storage key erase each other (see BrandEditorOptions
  // .tray). Only a host that mounts no tray of its own falls through to the
  // second branch, which creates one lazily - and only when a mark actually has
  // colours to hand over, so a session that never touches a logo pays nothing.
  // `load()` runs before the first add either way: the tray persists the whole
  // candidate list on every write, so adding to an unloaded one would erase
  // whatever a source scan left there earlier.
  bedit.tray = null;

  bedit.logos.wireLogoSuggest();
  /** Below this the classification is guesswork, so the chip leads with the slot
   *  menu and nothing is one tap away (plan 97 section 14.5: an ambiguous file always
   *  gets the confirm chip, never a silent placement). */
  const LOGO_CONFIRM_MIN = 0.6; bedit.LOGO_CONFIRM_MIN = LOGO_CONFIRM_MIN;
  /** How many files may wait at once - past this a queue stops being a list and
   *  becomes a backlog. */
  const LOGO_INTAKE_MAX = 12; bedit.LOGO_INTAKE_MAX = LOGO_INTAKE_MAX;
  /** Classification decode budget: the readback holds four bytes a pixel, and a
   *  logo is not a hero photo. */
  const CLASSIFY_MAX_PIXELS = 24_000_000; bedit.CLASSIFY_MAX_PIXELS = CLASSIFY_MAX_PIXELS;
  /** At most this many samples feed the colour census - a mark's ink is no more
   *  legible for having counted every pixel of a 4000px export. */
  const CLASSIFY_MAX_SAMPLES = 120_000; bedit.CLASSIFY_MAX_SAMPLES = CLASSIFY_MAX_SAMPLES;
  /** Census bucket size per channel (16 levels), so an anti-aliased edge does not
   *  read as a hundred separate inks. */
  const CLASSIFY_QUANT = 16; bedit.CLASSIFY_QUANT = CLASSIFY_QUANT;
  /** Alpha at or below this is not ink. */
  const CLASSIFY_ALPHA_MIN = 8; bedit.CLASSIFY_ALPHA_MIN = CLASSIFY_ALPHA_MIN;
  /** The ink a generated mono mark falls back to when the document names no text
   *  colour. Near-black rather than pure black, the same restraint the palette keeps. */
  const MONO_INK_FALLBACK = '#111111'; bedit.MONO_INK_FALLBACK = MONO_INK_FALLBACK;

  // ── The trim offer, in front of every placement ─────────────────────────────
  const trimMount = bedit.ramps.$('[data-be-logo-trim]') as HTMLElement | null; bedit.trimMount = trimMount;
  bedit.trimTeardown = null;
  bedit.trimAbandon = null;
  bedit.cleanups.push(bedit.logos.closeTrimOffer);

  const queueEl = bedit.ramps.$('[data-be-logo-queue]') as HTMLElement | null; bedit.queueEl = queueEl;
  bedit.intake = [];
  bedit.intakeSeq = 0;
  /** A selector to focus after the next render - the queue re-renders whole, so
   *  a menu toggle, a placement or a dismissal would otherwise drop the keyboard
   *  where it stood, i.e. on <body>. EVERY path that re-renders says where the
   *  keyboard goes; the only exception is the queue emptying, which is
   *  `intakeEmptyFocus` below because there is no chip left to name. */
  bedit.intakeFocus = null;
  bedit.intakeEmptyFocus = false;
  bedit.cleanups.push(() => { for (const c of bedit.intake) URL.revokeObjectURL(c.url); bedit.intake = []; });

  bedit.logoIntake.defineRenderIntake();

  bedit.logoIntake.seedIntakeQueue();

  bedit.logoIntake.wireIntakeZone();

  bedit.pack.wirePaletteDownload();

  bedit.pack.wireGradientsPanel();

  return {
    teardown: () => {
      clearTimeout(bedit.saveTimer); bedit.cleanups.forEach(fn => { fn(); });
      paletteObservers.clear();
      // The chrome already reflects what is installed; this is the cheap resync
      // after an unmount (nothing here was ever a draft).
      void applyChromeBrandVars(host);
    },
    saveDraft: () => {},   // no-op: every commit persists immediately (plan 97 section 6)
    isDirty: () => false,  // nothing is ever pending
    addColors: (entries) => bedit.addColor.addColorEntries(entries),
    exportPack: bedit.pack.exportPack,
    importPack: bedit.pack.importPack,
    reload: bedit.pack.reload,
    // The host calls this on every room change, which is also when a post-add
    // chip stops being about anything the person can see.
    closeOverlays: () => { bedit.swatchEditor.closeEditor(); bedit.addColor.clearAddedChip(); },
    onPalette: (cb) => { paletteObservers.add(cb); return () => { paletteObservers.delete(cb); }; },
    openColorChart: () => {
      if (!bedit.chartDetails) return false;
      bedit.chartDetails.open = true; // fires the toggle handler above → paintWheel()
      bedit.chartDetails.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return true;
    },
    openWing: (key) => bedit.curveEditor.openWing(key),
    colourBeat: () => bedit.beat,
    openStarterGroup: (group) => {
      const name = String(group || '').trim();
      if (!name) return false;
      bedit.revealedStarterGroup = name;
      bedit.ramps.repaintPalette();
      const details = bedit.palMount?.querySelector<HTMLDetailsElement>('.be-pal-group--starter');
      if (!details) { bedit.revealedStarterGroup = null; return false; }
      // On a fresh design system this IS beat 0, where the pane is not on
      // screen at all - so the pane comes back for the group that was asked for
      // by name, holding nothing else (see the beat rules in brand-studio.css).
      bedit.colorPanel?.classList.add('is-starter-shown');
      details.open = true;
      details.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      return true;
    },
    openPickCard: () => {
      // Anchored on the add row's own chip, which is the control the card
      // belongs to at every beat - on a phone the card ignores the anchor and
      // docks to the bottom edge (see openPickCard).
      const chip = bedit.ramps.$('[data-be-tab-panel="color"] [data-ds-addc-pick]') as HTMLElement | null;
      if (!chip) return false;
      bedit.swatchEditor.openPickCard(chip, null);
      return true;
    },
    openTypeStage: (role) => {
      // The card for that role is the opener, so Escape returns focus where the
      // person would have pressed. A room that did not render has no card.
      const card = bedit.ramps.$(`[data-be-typecard-choose="${role}"]`) as HTMLButtonElement | null;
      if (!card) return false;
      bedit.compareStage.openStage(role, card);
      return true;
    },
    setGeneratePrimary: (hex) => {
      bedit.state.setPrimaryTo(hex);
      // A colour deep link opens its suggested shades and Add actions. The
      // wing opens in the same tick, so wait one frame before positioning it.
      requestAnimationFrame(() => {
        const previews = bedit.ramps.$('[data-be-preview]') as HTMLElement | null;
        previews?.scrollIntoView?.({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      });
    },
    undo: () => bedit.replace.undoLast(),
    canUndo: () => undoStack.length > 0,
  };
}
