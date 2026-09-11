// SPDX-License-Identifier: MPL-2.0
/**
 * brand editor: document state, undo, persistence and the preview.
 *
 * Every function takes the shared `bedit: BrandEditorCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `bedit.<module>.<fn>`. Extracted verbatim
 * from mountBrandEditor() by scripts/split-closure.ts.
 */
import { RAMP_STEPS_MAX, RAMP_STEPS_MIN, aliasPath, colorToHex, createTokenSet, deriveBrandTokens, deserializeCurve } from '@lolly/engine';
import { installUserTokens } from '../../bridge/tokens.ts';
import { isUserDesignSystemActive } from '../design-system/active.ts';
import { RAMP_IDS, getRampCurve, isRec, leafAt, walkSwatches } from '../brand-doc.ts';
import type { RampCurves, RampId } from '../brand-doc.ts';
import { applyChromeBrandVars, tokenValueToHex } from '../../brand-vars.ts';
import { colorFieldHtml, refreshSwatches, setSwatches, wireColorField } from '../../components/color-field.ts';
import { t, tRaw } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { wireHelpTips } from '../../components/help-tip.ts';
import { DEFAULT_PRIMARY, deriveSafe, previewHtml } from './shared.ts';
import type { BrandTabKey, WingKey } from './shared.ts';
import { bindOp, type BrandEditorCtx } from './context.ts';

// Feed the colour PICKER's swatch grid from the live (draft) brand palette, so
// the inline primary picker's swatches reflect exactly the colours this brand
// carries - and grow/shrink as the user adds or deletes them. Roles (aliases)
// are skipped (they duplicate the ramp step they point at); transparent leads.
// refreshSwatches repopulates the already-open inline grid in place.
export const syncPickerSwatches = (bedit: BrandEditorCtx): void => {
  const { root } = bedit;
  const opts = bedit.swatches
    .filter(s => s.hex && s.kind !== 'semantic')
    .map(s => ({ value: s.hex, label: s.name, group: s.group, ref: s.isAlias ? null : `{${s.key}}` }));
  setSwatches([{ value: 'transparent', label: t('Transparent'), group: null, ref: null }, ...opts]);
  refreshSwatches(root);
};
/** A `{path}` alias (or bare dotted path) → its current hex, or null. Reads
 *  the `swatches` array first - kept fresh by BOTH repaintPalette and the
 *  in-place recolour paths, so gradient chips resolve mid-drag values without
 *  re-flattening the doc - falling back to a full token-set resolve for refs
 *  that aren't palette swatches (hand-authored imports). */
export const resolveTokenRef = (bedit: BrandEditorCtx, ref: string): string | null => {
  const key = aliasPath(ref) ?? ref;
  const hit = bedit.swatches.find(s => s.key === key && s.hex);
  if (hit) return hit.hex;
  try {
    return colorToHex(createTokenSet(bedit.doc, { theme: bedit.currentTheme === 'dark' ? 'dark' : 'light' }).resolve(ref)) ?? null;
  } catch { return null; }
};
export const pushUndo = (bedit: BrandEditorCtx, label: string): void => {
  const { UNDO_LIMIT, undoStack } = bedit;
  if (!isRec(bedit.doc)) return;
  undoStack.push({ doc: structuredClone(bedit.doc) as Record<string, unknown>, label });
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  const undo = bedit.ramps.$<HTMLButtonElement>('[data-be-undo]');
  if (undo) { undo.hidden = false; undo.textContent = tRaw('Undo: {action}', { action: label }); }
};
/** Take a durable checkpoint through the host, best-effort. A rejection is a
 *  missing safety net, never a failed edit - the local stack still has it. */
export const ctxCheckpoint = (bedit: BrandEditorCtx, label: string): void => {
  const { opts } = bedit;
  try { void opts.checkpoint?.(label)?.catch?.(() => {}); } catch { /* host's problem */ }
};
/** Tell the host view a brand edit just arrived on `tab` (Save-&-continue
 *  appearance + next-tab nudge). Best-effort - a throwing listener must never
 *  break an edit. */
export const notify = (bedit: BrandEditorCtx, tab: BrandTabKey): void => {
  const { opts } = bedit; try { opts.onChange?.(tab); } catch { /* host's problem */ } };
export const persist = (bedit: BrandEditorCtx, immediate = false): void => {
  const { host, root, tokens } = bedit;
  const revision = ++bedit.saveRevision;
  clearTimeout(bedit.saveTimer);
  const status = bedit.ramps.$<HTMLElement>('[data-be-save-state]');
  if (status) { status.hidden = false; status.textContent = t('Saving…'); status.classList.remove('is-error'); }
  notify(bedit, 'color');
  bedit.ramps.notifyPaletteObservers(); // the doc is already mutated - mirrors repaint now, not post-debounce
  const run = (): void => {
    const snapshot = structuredClone(bedit.doc);
    bedit.saveQueue = bedit.saveQueue.then(async () => {
    try {
      await installUserTokens(host as unknown as Parameters<typeof installUserTokens>[0], snapshot, { label: 'My brand' });
      if (status && revision === bedit.saveRevision) { status.textContent = t('Saved'); }
      void applyChromeBrandVars(host);
      // Reflect the new palette in every picker without a tool remount.
      try {
        const cols = (await tokens?.colors?.()) ?? [];
        setSwatches(cols.map(c => ({ value: c.value, label: c.name, group: c.group, ref: c.ref })));
      } catch { /* pickers refresh on next tool mount regardless */ }
    } catch (err) {
      if (status && revision === bedit.saveRevision) { status.classList.add('is-error'); status.textContent = tRaw("Couldn't save: {error}", { error: String((err as { message?: unknown })?.message ?? err) }); }
      if (root.isConnected) announce(tRaw("Couldn't save the brand: {error}", { error: String((err as { message?: unknown })?.message ?? err) }), { assertive: true });
    }
    });
  };
  if (immediate) run(); else bedit.saveTimer = setTimeout(run, 300);
};
/**
 * How many shade steps the INSTALLED doc's ramp actually carries.
 *
 * NOT `steps`: that is the Generate wing's Shades slider, a preview-only
 * control that deliberately writes nothing until Replace palette is applied.
 * Baking a curve into `doc` at the slider's count rewrites leaves `1..n` and
 * leaves the rest of a longer ramp untouched, which is how a 9-step ramp
 * baked at 5 came out non-monotonic (step 5 the lightest, step 6 back down)
 * with duplicated tails. Every write into the committed document counts the
 * document's own leaves; only the preview follows the slider. 0 when the ramp
 * is absent, so callers fall back to the slider for a doc with no ramps.
 */
export const docRampSteps = (bedit: BrandEditorCtx, ramp: RampId): number => {
  const base = (isRec(bedit.doc) && isRec((bedit.doc as Record<string, unknown>).base)
    ? (bedit.doc as Record<string, unknown>).base : bedit.doc) as Record<string, unknown>;
  const group = leafAt(base, ['color', 'ramp', ramp]);
  return group ? Object.keys(group).filter(k => /^\d+$/.test(k)).length : 0;
};
/** The step count a write into `doc` must use for `ramp`. */
export const bakeSteps = (bedit: BrandEditorCtx, ramp: RampId): number => docRampSteps(bedit, ramp) || bedit.steps;
// ── Derive controls (the Generate wing) ─────────────────────────────────────
// Exploring does not write. Only adding shades or applying a reviewed full
// rebuild changes the palette; specimens outside this wing stay committed.
export const renderPreview = (bedit: BrandEditorCtx): void => {
  const { preview } = bedit;
  const next = deriveSafe({ primary: bedit.primary, scheme: bedit.scheme, surface: bedit.surface, contrast: bedit.contrast, steps: bedit.steps, foreground: bedit.foreground });
  if (!next) return; // a half-typed hex mid-edit - keep the last good preview
  // Exploration starts from the chosen colour. Saved curves belong to the
  // existing palette and the optional full rebuild, not to these new shades.
  if (preview) {
    const themesOpen = preview.querySelector<HTMLDetailsElement>('.be-draft-themes')?.open;
    const focusedStep = document.activeElement instanceof HTMLElement && preview.contains(document.activeElement)
      ? { ramp: document.activeElement.dataset.beRamp, step: document.activeElement.dataset.beStep } : null;
    preview.innerHTML = previewHtml(next, { neutral: bedit.neutralStep, secondary: bedit.secondaryStep, steps: bedit.steps, curves: bedit.ramps.curveMarks(), palette: walkSwatches(bedit.doc, bedit.currentTheme).filter(s => s.kind !== 'semantic').flatMap(s => s.hex ? [s.hex] : []) });
    const themes = preview.querySelector<HTMLDetailsElement>('.be-draft-themes');
    if (themes && themesOpen) themes.open = true;
    if (focusedStep?.ramp && focusedStep.step) preview.querySelector<HTMLElement>(`[data-be-ramp="${focusedStep.ramp}"][data-be-step="${focusedStep.step}"]`)?.focus({ preventScroll: true });
  }
  bedit.dropPendingReplacement(); // the parked proposal is now stale - see its comment
  // Deliberately NO notify(): a preview-only change has arrived nowhere, so
  // telling the host an edit happened would be a lie.
};
export const onPrimaryFieldChange = (bedit: BrandEditorCtx, id: string, value: string | { value: string }): void => {
  const { primaryLock } = bedit;
  if (id !== 'be-primary') return;
  const raw = typeof value === 'string' ? value : value.value;
  if (!raw || raw === 'transparent') return;
  const nextPrimary = /^#[0-9a-fA-F]{8}$/.test(raw) ? raw.slice(0, 7) : raw;
  bedit.curveEditor.reanchorCurvesTo(nextPrimary); // shift live curves by the primary delta (never discard)
  bedit.primary = nextPrimary;
  renderPreview(bedit);
  bedit.derive.renderScreen();
  primaryLock?.render();
  bedit.derive.renderGenerator();
};
/** Programmatically move the primary (the logo-colour pathway): re-seed the
 *  visual field (fresh render + wire - no setter exists on the component) and
 *  run the same fan-out a manual pick runs. */
export const setPrimaryTo = (bedit: BrandEditorCtx, hex: string): void => {
  const { primaryLock } = bedit;
  bedit.curveEditor.reanchorCurvesTo(hex); // keep any live curves anchored to the moving primary
  bedit.primary = hex;
  const wrap = bedit.ramps.$('[data-be-primary-field]') as HTMLElement | null;
  if (wrap) {
    wrap.innerHTML = colorFieldHtml('be-primary', hex, { inline: true, modes: true, progressive: true });
    wireColorField(wrap, { onChange: bedit.state.onPrimaryFieldChange });
    refreshSwatches(wrap);
  }
  renderPreview(bedit);
  bedit.derive.renderScreen();
  primaryLock?.render();
  bedit.derive.renderGenerator();
};
export const wingEl = (bedit: BrandEditorCtx, k: WingKey): HTMLDetailsElement | null => bedit.ramps.$(`[data-be-wing="${k}"]`);
export async function loadDocument(bedit: BrandEditorCtx): Promise<void> {
  const { host, tokens } = bedit;
  // The document we edit: the installed brand if any, else a fresh derive from
  // the default primary so the palette is never empty on an unbranded install.
  bedit.doc = (await tokens?.raw().catch(() => null)) as Record<string, unknown> | null;
  const installedDoc = isRec(bedit.doc) ? bedit.doc : null; bedit.installedDoc = installedDoc as BrandEditorCtx['installedDoc']; // stable snapshot for seeding, below - never reassigned
  if (!isRec(bedit.doc)) bedit.doc = deriveBrandTokens({ primary: DEFAULT_PRIMARY, name: 'My brand' }) as Record<string, unknown>;

  // Whether installedDoc is something the USER actually saved here, vs just the
  // catalog's own shipped/placeholder brand - distinct from "is there any doc at
  // all", since a fresh install still resolves ITS tokens as installedDoc. Only a
  // real user save should seed a control (like Shades below) away from its
  // considered default; the catalog's incidental step count isn't a user choice.
  bedit.isUserBrand = false;
  try {
    bedit.isUserBrand = await isUserDesignSystemActive(host);
  } catch { /* discovery unavailable - treat as not user-owned */ }

  // Derive-control state (separate from the edited doc - it RE-SEEDS on install).
  // Primary is seeded from the REAL installed brand's current colour, so the
  // picker opens on what's actually running, not a hardcoded default - only a
  // genuinely unbranded install (no real doc yet) falls back to DEFAULT_PRIMARY.
  // Scheme/surface/contrast aren't recoverable (deriveBrandTokens doesn't persist
  // its own input options into the doc), so those stay at their usual defaults.
  bedit.primary = DEFAULT_PRIMARY;
  if (installedDoc) {
    try {
      bedit.primary = tokenValueToHex(createTokenSet(installedDoc, { theme: 'light' }).resolve('color.semantic.primary')) ?? DEFAULT_PRIMARY;
    } catch { /* malformed/tokenless doc - keep the default seed */ }
  }
  bedit.scheme = 'mono'; bedit.surface = 'light'; bedit.contrast = 'comfort';
  // Foreground preference (text on the brand colour). Defaults to 'auto' - the
  // engine's contrast pick - until the user forces Light or Dark.
  bedit.foreground = 'auto';
  // How many shades each ramp carries. New brands start at 5 (a tight, decisive
  // palette); a brand the USER saved here keeps whatever it shipped (seeded from
  // its primary ramp's step count) so re-opening the editor never silently
  // reshapes it - but the catalog's own placeholder brand doesn't count as a user
  // choice, so it doesn't override the 5-step default either.
  const DEFAULT_STEPS = 5; bedit.DEFAULT_STEPS = DEFAULT_STEPS;
}

export function seedSteps(bedit: BrandEditorCtx): void {
  const { DEFAULT_STEPS, installedDoc } = bedit; // mid step = engine at(0.5)
  bedit.steps = DEFAULT_STEPS;
  if (installedDoc && bedit.isUserBrand) {
    try {
      const g = createTokenSet(installedDoc).query({ type: 'color' }).filter(t => /^color\.ramp\.primary\.\d+$/.test(t.path));
      if (g.length >= RAMP_STEPS_MIN) bedit.steps = Math.min(RAMP_STEPS_MAX, g.length);
    } catch { /* keep the default */ }
  }
  // Neutral/secondary ramp-step picks - default to the anchor (mid) step for the
  // current division count, so they track the shade count until the user picks.
  bedit.neutralStep = bedit.ramps.anchorStep(bedit.steps); bedit.secondaryStep = bedit.ramps.anchorStep(bedit.steps);
}

export function seedHarmony(bedit: BrandEditorCtx): void {
  bedit.harmonyKind = 'adjacent-3';
  // Parametric-analogous params - only read when harmonyKind === 'analogous'.
  bedit.analogCount = 3;   // number of accents (2–5)
  bedit.analogAngle = 30;  // hue step in degrees between consecutive accents (10–45)
  bedit.currentTheme = document.documentElement.dataset.theme || 'light';

  // ── Per-ramp tonal curves - the editable master behind each ramp's steps ─────
  // Loaded from the installed doc's ramp-group $extensions; ABSENT on a curve-less
  // brand, which then stays byte-identical to today's pure derive (overlay is a
  // no-op for a ramp with no curve). Draft-until-"Use this colour", exactly like
  // the other derive inputs - overlaid onto every derived preview below, and onto
  // the fresh `next` in the derive handler so a curve survives a re-derive.
  const curves: RampCurves = {}; bedit.curves = curves;
  for (const ramp of RAMP_IDS) {
    const stored = getRampCurve(bedit.doc, ramp);
    if (stored) curves[ramp] = deserializeCurve(stored);
  }
  // The primary the live curves are currently anchored to - a primary edit shifts
  // them by the per-channel delta from here (see reanchorCurvesTo below).
  bedit.curveAnchorPrimary = bedit.primary;
  // Which ramp's curve editor is open (null = none). Its state, plus whether each
  // ramp carries a curve, drives the affordance rendered on every ramp row.
  bedit.editingCurveRamp = null;
}

export function wirePreview(bedit: BrandEditorCtx): void {
  const { root } = bedit;
  const preview = bedit.ramps.$('[data-be-preview]') as HTMLElement | null; bedit.preview = preview;
  const palMount = bedit.ramps.$('[data-be-pal]') as HTMLElement | null; bedit.palMount = palMount;
  // The Colours room's own panel - the element the beat is stamped on, and the
  // scope every beat rule in brand-studio.css hangs off.
  const colorPanel = bedit.ramps.$('[data-be-tab-panel="color"]') as HTMLElement | null; bedit.colorPanel = colorPanel;
  const editorEl = bedit.ramps.$('[data-be-editor]') as HTMLElement | null; bedit.editorEl = editorEl;
  const editorCard = editorEl?.querySelector<HTMLElement>('.be-editor-card') ?? null; bedit.editorCard = editorCard as BrandEditorCtx['editorCard'];
  const cleanups: Array<() => void> = []; bedit.cleanups = cleanups;

  // The shared help-tip wiring (tap toggle, Escape, outside-click) for the
  // Logos lead's tip. Delegated on the studio root, and its document-level
  // dismiss listener comes off with the studio - a detached tree held alive by
  // one listener is the leak this primitive documents.
  wireHelpTips(root as HTMLElement & { _helpTipsWired?: boolean; _helpTipDismiss?: (e: MouseEvent) => void });
  cleanups.push(() => {
    const scope = root as HTMLElement & { _helpTipDismiss?: (e: MouseEvent) => void };
    if (scope._helpTipDismiss) document.removeEventListener('click', scope._helpTipDismiss, true);
  });

  // ── Palette state + persistence ─────────────────────────────────────────────
  bedit.swatches = [];
  bedit.selected = -1;
  // The OKLCH channel the palette grid's keyboard nudging steps (huetone-style).
  // A mode that persists across tiles; L by default, re-armed with l/c/h.
  // Null until a letter arms one: the arrow keys are the palette grid's
  // navigation (plan 182 section 5.5), and only an armed channel takes Arrow
  // Up/Down away from them.
  bedit.armedChannel = null;
  // The tile/dot the open swatch popover is anchored to - repositioning on
  // side-pane scroll needs it (the popover positions in `.be` space, so the
  // sticky pane's own scroll would otherwise drift it off its tile).
  bedit.editorAnchor = null;
  // bedit.saveTimer: assigned later
  // The wheel is a second view of the SAME swatches - assigned once the handlers
  // it needs (openEditor/applyEditedHex/addSwatch) exist, and called by every
  // repaintPalette so grid + wheel never drift.
  const wheelMount = bedit.ramps.$('[data-be-wheel-mount]') as HTMLElement | null; bedit.wheelMount = wheelMount;
  // bedit.wheelTeardown: assigned later
}

export function stateOps(bedit: BrandEditorCtx) {
  return {
    syncPickerSwatches: bindOp(bedit, syncPickerSwatches),
    resolveTokenRef: bindOp(bedit, resolveTokenRef),
    pushUndo: bindOp(bedit, pushUndo),
    ctxCheckpoint: bindOp(bedit, ctxCheckpoint),
    notify: bindOp(bedit, notify),
    persist: bindOp(bedit, persist),
    docRampSteps: bindOp(bedit, docRampSteps),
    bakeSteps: bindOp(bedit, bakeSteps),
    renderPreview: bindOp(bedit, renderPreview),
    onPrimaryFieldChange: bindOp(bedit, onPrimaryFieldChange),
    setPrimaryTo: bindOp(bedit, setPrimaryTo),
    wingEl: bindOp(bedit, wingEl),
    loadDocument: bindOp(bedit, loadDocument),
    seedSteps: bindOp(bedit, seedSteps),
    seedHarmony: bindOp(bedit, seedHarmony),
    wirePreview: bindOp(bedit, wirePreview),
  };
}
