// SPDX-License-Identifier: MPL-2.0
/**
 * brand editor: contrast lock, hue rotate, candidates, previews and the generator.
 *
 * Every function takes the shared `bedit: BrandEditorCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `bedit.<module>.<fn>`. Extracted verbatim
 * from mountBrandEditor() by scripts/split-closure.ts.
 */
import { RAMP_STEPS_MAX, RAMP_STEPS_MIN, SCHEME_KINDS, colorToHex, colorToHexString, createTokenSet, deserializeCurve, generateAnalogous, generateSchemeAccents, parseColor as parseCssColor } from '@lolly/engine';
import { nameColor } from '../color-namer.ts';
import { palettePreviewSvgs } from '../palette-preview.ts';
import { addDraftShades, draftShades } from '../design-system/palette-draft.ts';
import { groupName, paletteGroups } from '../design-system/palette-groups.ts';
import { RAMP_IDS, addSwatch, contrastLockCurve, contrastTargets, getRampCurve, isRec, overlayRampCurves, primaryAnchorPath, rotateCurveHue, seedRampCurve, setSwatchCmykLock, setSwatchSpotLock, walkSwatches } from '../brand-doc.ts';
import type { ContrastLockPreset, RampId } from '../brand-doc.ts';
import { tokenValueToHex } from '../../brand-vars.ts';
import { colorFieldHtml, wireColorField } from '../../components/color-field.ts';
import { STORAGE_FORMATS, formatColor, serializeColor } from '../color-formats.ts';
import { icon } from '../icons.ts';
import { panelHead } from '../brand-studio-tabs.ts';
import { POPULAR_FAMILIES } from '../google-fonts.ts';
import { t, tRaw } from '../../i18n.ts';
import { escape as escapeText } from '../../utils.ts';
import { segHtml } from '../seg.ts';
import { announce } from '../../a11y.ts';
import { playSfx } from '../sfx.ts';
import { helpTip } from '../../components/help-tip.ts';
import { ROLE_IDS, readRoles, roleLabel } from '../design-system/roles.ts';
import { CONTRASTS, DEFAULT_PRIMARY, FOREGROUNDS, INTENSITIES, PALETTE_FORMATS, RAMP_LABEL, SCHEMES, TYPE_ROLES, deriveSafe, finishLabel, mountPrintLock, previewHtml, typeRoleCardHtml } from './shared.ts';
import type { Contrast, Fg, HarmonyKind, Scheme, Surface } from './shared.ts';
import { bindOp, type BrandEditorCtx } from './context.ts';

export const applyContrastLock = (bedit: BrandEditorCtx): void => {
  const { clBgInput, clCustomInput, clPresetSel, clReadout, curves } = bedit;
  // The transform lives in its own wing now, so it acts on the ramp the wings'
  // picker names - not on whichever curve editor happens to be open.
  const ramp = bedit.curveRamp;
  if (!isRec(bedit.doc)) return;
  const rawPreset = clPresetSel?.value;
  const preset: ContrastLockPreset = rawPreset === 'text' || rawPreset === 'ui' ? rawPreset : 'even';
  const custom = clCustomInput?.value ?? '';
  // A valid picked colour wins; anything unreadable falls back to the resolved
  // surface (never an empty bg, which the solver can't measure against).
  const bg = (clBgInput?.value ? colorToHex(clBgInput.value) : null) ?? bedit.ramps.surfaceHex();
  // Every count here is the INSTALLED ramp's, not the preview slider's - this
  // writes the committed doc (see docRampSteps), so the targets, the solve and
  // the bake all have to describe the same ramp.
  const n = bedit.state.bakeSteps(ramp);
  const targets = contrastTargets(preset, n, custom);
  // Seed a curve when this ramp has none yet - from the LIVE draft derive so it
  // matches the visible preview, exactly like openCurveEditor's first-open seed.
  const base = curves[ramp]
    ?? seedRampCurve(deriveSafe({ primary: bedit.primary, scheme: bedit.scheme, surface: bedit.surface, contrast: bedit.contrast, steps: bedit.steps, foreground: bedit.foreground }) ?? bedit.doc, ramp, bedit.steps);
  const { curve, unreachable } = contrastLockCurve(base, n, targets, bg);
  curves[ramp] = curve;
  bedit.curveAnchorPrimary = bedit.primary;           // the locked curve is anchored to today's primary
  bedit.curveEditor.cancelCurveSave();                      // this path persists itself
  overlayRampCurves(bedit.doc, { [ramp]: curve }, n); // bake steps + stamp the curve on the committed doc
  if (bedit.editingCurveRamp === ramp) bedit.curveHandle?.render({ curve, steps: bedit.steps }); // reflect it in an open editor
  bedit.state.renderPreview();                        // repaint the wing's ramp rows
  bedit.ramps.repaintPalette();                       // the Palette panel shows the retoned steps
  bedit.state.persist(true);
  if (clReadout) {
    clReadout.textContent = unreachable === 0
      ? t('All shades reached their target.')
      : unreachable === 1
        ? t('1 shade could not reach its target (capped at the closest tone).')
        : tRaw('{n} shades could not reach their target (capped at the closest tone).', { n: unreachable });
  }
  announce(tRaw('{label} ramp contrast-locked', { label: RAMP_LABEL[ramp] }));
  playSfx('click');
};
export const applyHueRotate = (bedit: BrandEditorCtx): void => {
  const { curves, hrDegInput, hrDegVal } = bedit;
  const ramp = bedit.curveRamp;
  if (!isRec(bedit.doc)) return;
  const degrees = Number(hrDegInput?.value) || 0;
  if (!degrees) return; // 0° is a no-op - nothing to commit
  // Seed a curve when this ramp has none yet - from the LIVE draft derive so it
  // matches the visible preview, exactly like applyContrastLock's seed.
  const base = curves[ramp]
    ?? seedRampCurve(deriveSafe({ primary: bedit.primary, scheme: bedit.scheme, surface: bedit.surface, contrast: bedit.contrast, steps: bedit.steps, foreground: bedit.foreground }) ?? bedit.doc, ramp, bedit.steps);
  const curve = rotateCurveHue(base, degrees);
  curves[ramp] = curve;
  bedit.curveAnchorPrimary = bedit.primary;           // the rotated curve is anchored to today's primary
  bedit.curveEditor.cancelCurveSave();                      // this path persists itself
  overlayRampCurves(bedit.doc, { [ramp]: curve }, bedit.state.bakeSteps(ramp)); // bake the doc's own steps + stamp the curve
  if (bedit.editingCurveRamp === ramp) bedit.curveHandle?.render({ curve, steps: bedit.steps }); // reflect it in an open editor
  bedit.state.renderPreview();                        // repaint the wing's ramp rows
  bedit.ramps.repaintPalette();                       // the Palette panel shows the rotated steps
  bedit.state.persist(true);
  if (hrDegInput) hrDegInput.value = '0'; // reset - the transform is applied, further turns compose
  if (hrDegVal) hrDegVal.textContent = '0°';
  announce(tRaw('{label} ramp hue rotated', { label: RAMP_LABEL[ramp] }));
  playSfx('click');
};
/** The current primary as a `#`-prefixed hex (shared by the generator + the
 *  screen/print readout below). `primary` is whatever the picker or a token
 *  resolution handed over - a named colour, `oklch()`, or a wide-gamut
 *  `color()` all reach here - and generateSchemeAccents throws on anything that
 *  is not a hex, which empties the candidate list. So parse it properly:
 *  concatenating a `#` onto `oklch(62% 0.19 260)` produced a string nothing
 *  downstream could read. */
export const primaryHex = (bedit: BrandEditorCtx): string => {
  const p = (bedit.primary || '').trim();
  if (/^#[0-9a-fA-F]{6,8}$/.test(p)) { bedit.goodPrimaryHex = p.slice(0, 7).toLowerCase(); return bedit.goodPrimaryHex; }
  const parsed = p && p.toLowerCase() !== 'transparent' ? parseCssColor(p) : null;
  if (parsed) bedit.goodPrimaryHex = colorToHexString(parsed).slice(0, 7);
  return bedit.goodPrimaryHex;
};
export const paletteHexes = (bedit: BrandEditorCtx): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (h: string | undefined): void => { const k = (h || '').toLowerCase(); if (h && /^#[0-9a-fA-F]{6}/.test(h) && !seen.has(k)) { seen.add(k); out.push(h.slice(0, 7)); } };
  if (bedit.previewSelection.length) bedit.swatches.filter(s => bedit.previewSelection.includes(s.key)).forEach(s => { add(s.hex); });
  else {
    const material = bedit.swatches.filter(s => s.kind !== 'semantic');
    const chosen = material.filter(s => !bedit.ramps.isStarterSwatch(s) || paletteGroups(bedit.doc).includes(groupName(s.group)));
    const pool = chosen.length ? chosen : material;
    const primaryRole = readRoles(bedit.doc, bedit.currentTheme === 'dark' ? 'dark' : 'light').primary.ref;
    const lead = pool.find(s => s.key === primaryRole);
    if (lead) add(lead.hex);
    for (const s of pool.filter(s => s.kind === 'custom' || s.kind === 'spectrum')) add(s.hex);
    for (const s of pool) add(s.hex);
  }
  return out;
};
export const isInPalette = (bedit: BrandEditorCtx, hex: string): boolean => {
  const k = hex.toLowerCase().slice(0, 7);
  return bedit.swatches.some(s => (s.hex || '').toLowerCase().slice(0, 7) === k);
};
export const renderCandidates = (bedit: BrandEditorCtx): void => {
  const { candidatesEl } = bedit;
  if (!candidatesEl) return;
  let accents: ReturnType<typeof generateSchemeAccents> = [];
  try {
    accents = bedit.harmonyKind === 'analogous'
      ? generateAnalogous(primaryHex(bedit), { count: bedit.analogCount, angle: bedit.analogAngle })
      : generateSchemeAccents(primaryHex(bedit), bedit.harmonyKind);
  } catch { accents = []; }
  candidatesEl.innerHTML = accents.map(a => {
    const name = nameColor(a.hex);
    const added = isInPalette(bedit, a.hex);
    return `<div class="be-cand${added ? ' is-added' : ''}">
          <span class="be-cand-sw" style="background:${escapeText(a.hex)}" aria-hidden="true"></span>
          <span class="be-cand-meta"><span class="be-cand-name">${escapeText(name)}</span><span class="be-cand-hex">${escapeText(a.hex)}</span></span>
          <button type="button" class="be-cand-add" data-add-hex="${escapeText(a.hex)}" data-add-name="${escapeText(name)}"${added ? ' disabled aria-disabled="true"' : ''}>${added ? t('✓ Added') : t('+ Add')}</button>
        </div>`;
  }).join('');
};
export const renderPreviews = (bedit: BrandEditorCtx): void => {
  const { previewsEl } = bedit;
  if (!previewsEl) return;
  const colors = paletteHexes(bedit);
  if (!colors.length) {
    const empty = document.createElement('p'); empty.className = 'be-preview-empty';
    empty.textContent = t('Add a colour to see it in context.'); previewsEl.replaceChildren(empty); return;
  }
  const set = createTokenSet(bedit.doc, { theme: bedit.currentTheme === 'dark' ? 'dark' : 'light' });
  const role = (name: string): string | undefined => colorToHex(set.resolve(`color.semantic.${name}`)) ?? undefined;
  const scenes = palettePreviewSvgs(colors, { roles: bedit.previewSelection.length ? undefined : {
    primary: role('primary'), secondary: role('secondary'), surface: role('surface'), text: role('text'), onPrimary: role('on-primary'),
  } });
  // `s.svg` is interpolated RAW, deliberately - it is markup, so escaping it
  // would render the tags as text. It is safe because lib/palette-preview.ts
  // BUILDS these scenes from developer-authored templates and passes every
  // user-supplied colour through its `col()` whitelist (hex or 'transparent',
  // nothing else) before it reaches an attribute; the module contains no
  // <script>, href or url(), and palette-preview.test.ts pins all of that
  // against hostile colour strings. `s.label` is ours but escaped anyway,
  // since it is text rather than markup.
  previewsEl.innerHTML = scenes.map((s, i) => `<figure class="be-pv"${i === bedit.previewScene ? '' : ' hidden'}><div class="be-pv-art">${s.svg}</div><figcaption class="be-pv-cap">${escapeText(s.label)}</figcaption></figure>`).join('');
};
export const renderGenerator = (bedit: BrandEditorCtx): void => { renderCandidates(bedit); renderPreviews(bedit); };
export const renderScreen = (bedit: BrandEditorCtx): void => {
  const { screenEl } = bedit;
  const hex = primaryHex(bedit);
  if (screenEl) screenEl.textContent = `${hex.toUpperCase()} · rgb(${formatColor('rgb', hex)})`;
};
/** No primary ramp, no anchor step, nothing a print build could pin itself
 *  to - so the wing states that instead of offering controls that write
 *  nowhere. Re-read live, because a Replace palette creates the ramp. */
export const syncPrintWing = (bedit: BrandEditorCtx): void => {
  const { printChips, printNone, printSubst } = bedit;
  const anchored = primaryAnchorPath(bedit.doc) !== null;
  if (printNone) printNone.hidden = anchored;
  if (printSubst) printSubst.hidden = !anchored;
  if (printChips) printChips.hidden = !anchored;
};
export const renderPrintChips = (bedit: BrandEditorCtx): void => {
  const { printChips } = bedit;
  syncPrintWing(bedit);
  if (!printChips) return;
  const lock = bedit.ramps.primaryPrintLock();
  const bits: string[] = [];
  if (lock?.cmyk) bits.push(`<span class="be-ps-chip">C${lock.cmyk[0]} M${lock.cmyk[1]} Y${lock.cmyk[2]} K${lock.cmyk[3]}</span>`);
  if (lock?.spot) bits.push(`<span class="be-ps-chip">${escapeText(lock.spot.name)}${lock.spot.finish ? ` · ${escapeText(finishLabel(lock.spot.finish))}` : ''}</span>`);
  printChips.innerHTML = bits.length ? bits.join('') : `<span class="be-ps-chip be-ps-chip--auto">${t('auto')}</span>`;
};
/**
 * Re-seed every Generate-wing control from whatever `doc` currently holds.
 * Split out of reload() because an undo needs exactly the same work: the
 * document was swapped wholesale, so the primary, the shade count, the ramp
 * anchors, the stored curves and the preview all describe the wrong brand
 * until this runs. Reads the steps off the GIVEN doc rather than a fresh
 * tokens.raw() - an undo has not installed anything yet.
 */
export const reseedFromDoc = (bedit: BrandEditorCtx): void => {
  const { curves, preview, primaryLock, stepsSlider, stepsVal } = bedit;
  try {
    const set = createTokenSet(bedit.doc, { theme: 'light' });
    bedit.primary = tokenValueToHex(set.resolve('color.semantic.primary')) ?? bedit.primary;
    const g = set.query({ type: 'color' }).filter(tk => /^color\.ramp\.primary\.\d+$/.test(tk.path));
    if (g.length >= RAMP_STEPS_MIN) bedit.steps = Math.min(RAMP_STEPS_MAX, g.length);
    bedit.neutralStep = bedit.ramps.anchorStep(bedit.steps); bedit.secondaryStep = bedit.ramps.anchorStep(bedit.steps);
  } catch { /* tokenless/malformed doc - keep the previous seeds */ }
  if (stepsSlider) stepsSlider.value = String(bedit.steps);
  if (stepsVal) stepsVal.textContent = String(bedit.steps);
  // Re-load per-ramp tonal curves from the doc (a pack import may carry them; a
  // plain brand won't, leaving curves empty → pure derive). Any open editor
  // described the OLD brand, so close it first - without a preview repaint
  // (the fresh preview is painted below).
  bedit.curveEditor.closeCurveEditor(false);
  for (const ramp of RAMP_IDS) { delete curves[ramp]; const st = getRampCurve(bedit.doc, ramp); if (st) curves[ramp] = deserializeCurve(st); }
  bedit.curveAnchorPrimary = bedit.primary;
  const wrap = bedit.ramps.$('[data-be-primary-field]') as HTMLElement | null;
  if (wrap) {
    wrap.innerHTML = colorFieldHtml('be-primary', bedit.primary, { inline: true, modes: true, progressive: true });
    wireColorField(wrap, { onChange: bedit.state.onPrimaryFieldChange });
  }
  // New shade suggestions follow the current starting colour.
  const fresh = deriveSafe({ primary: bedit.primary, scheme: bedit.scheme, surface: bedit.surface, contrast: bedit.contrast, steps: bedit.steps, foreground: bedit.foreground });
  if (preview && fresh) preview.innerHTML = previewHtml(fresh, { neutral: bedit.neutralStep, secondary: bedit.secondaryStep, steps: bedit.steps, curves: bedit.ramps.curveMarks(), palette: walkSwatches(bedit.doc, bedit.currentTheme).filter(s => s.kind !== 'semantic').flatMap(s => s.hex ? [s.hex] : []) });
  renderScreen(bedit);
  primaryLock?.render();
  renderGenerator(bedit);
  bedit.dropPendingReplacement(); // the doc was swapped wholesale - any parked proposal is stale
};
export function seedDraftAndMarkup(bedit: BrandEditorCtx): void {
  const { CONTRAST_LOCK_PRESETS, contrastLockBg, root } = bedit;
  const initialDraft = deriveSafe({ primary: bedit.primary, scheme: bedit.scheme, surface: bedit.surface, contrast: bedit.contrast, steps: bedit.steps, foreground: bedit.foreground }); bedit.initialDraft = initialDraft as BrandEditorCtx['initialDraft'];

  // The Logos room's lead was six lines of taxonomy before anyone had added a
  // single mark (plan 137 C4). The whole of it is still here, one tap away in
  // the shared help tip, and the room opens on the one sentence that says what
  // to do. Plain text, no markup: helpTip escapes what it is given.
  const logoTaxonomyTip = helpTip(t('Each orientation (horizontal, vertical) can carry each treatment: primary and mono, each with a reverse form for dark backgrounds. Marks the design system names its own way - an icon, a crest - go under Custom marks. A design system with more than one logo can carry each as its own set. Every slot is optional. PNG, SVG, JPEG or WebP; they stay on this device and travel in the design system file.')); bedit.logoTaxonomyTip = logoTaxonomyTip;

  root.innerHTML = `
    <div class="be" data-brand-editor>
      <div class="be-tab" data-be-tab-panel="logos">
        <div class="be-panel be-logos">
          ${panelHead(t('Logos'), `<span class="help-tip-host be-logos-lead">${t('Add the marks - Lolly reads each file and offers it the right slot.')} ${logoTaxonomyTip.button}${logoTaxonomyTip.pop}</span>`)}
          ${/* Level 0 (plan 97 section 7.3): one multi-file drop zone. Each file is
                read for shape and ink, proposes a slot, and waits for a tap - 
                the matrix below stays exactly as it was, per-slot drops and
                all. The trim offer mounts between the two. */''}
          <div class="be-logo-intake" data-be-logo-intake>
            <label class="be-logo-intake-drop">
              <input type="file" class="visually-hidden" data-be-logo-multi multiple accept="image/png,image/jpeg,image/svg+xml,image/webp" aria-label="${escapeText(t('Choose logo files'))}">
              <span class="be-logo-intake-glyph" aria-hidden="true">${icon('uploadImage', { size: 20 })}</span>
              <span class="be-logo-intake-lead">${t('Drop marks here, or choose several at once')}</span>
              <span class="be-logo-intake-hint">${t('Each file is read for its shape and its ink, then offered the slot it looks like. Nothing is placed until you tap.')}</span>
            </label>
            <div class="be-logo-queue" data-be-logo-queue hidden></div>
            <div class="be-logo-trim" data-be-logo-trim hidden></div>
          </div>
          <div class="be-logo-grid" data-be-logos></div>
          <p class="be-err" data-be-logo-err hidden></p>
        </div>
      </div>

      <div class="be-tab be-tab--split" data-be-tab-panel="color">
      <aside class="be-split-side" data-be-split-side aria-label="${escapeText(t('Palette'))}">
      <!-- Inner scroller: the panels scroll in here (≥1100px, the pane's height
           viewport-anchored by the host - see brand-studio.css) while the
           download dock below stays OUTSIDE it, keeping its seat at the pane's
           bottom edge however far the palette scrolls. -->
      <div class="be-split-scroll" data-be-split-scroll>
      <div class="be-panel be-palette">
        <div class="be-palette-heading"><h2>${t('Your colours')}</h2><span class="be-save-state" data-be-save-state role="status" hidden></span></div>
        <div class="be-pal" data-be-pal></div>
        <button type="button" class="be-pal-restore" data-be-undo hidden>${t('Undo')}</button>
      <details class="be-addcolor"><summary>${t("Paste colours or use an image")}</summary>
        ${/* Beat 0's whole room (plan 182 section 3a): a title, a line, the pick
              row, and one quiet sentence saying what arrives later and where a
              file goes instead. It replaces the panel head rather than joining
              it - two headings over one control is the wall this beat removes. */''}
        <div data-be-addcolor></div>

        ${/* The answer to one add (plan 137 C1): the colour, its name, and the two
              things worth doing next. Static markup filled in place (textContent
              and one custom property) so a swatch name never reaches a markup
              sink. Borrows the logo suggestion's box - it is the same kind of
              row in the same panel. */''}
        <div class="be-suggest be-added" data-be-added hidden>
          <span class="be-suggest-note">
            <span class="be-suggest-sw" data-be-added-sw aria-hidden="true"></span>
            <span data-be-added-name></span>
          </span>
          <button type="button" class="be-btn" data-be-added-primary>${t('Use as primary?')}</button>
          <button type="button" class="be-btn" data-be-added-tune>${t('Fine-tune')}</button>
          <button type="button" class="be-suggest-dismiss" data-be-added-dismiss aria-label="${escapeText(t('Dismiss'))}">&#x2715;</button>
        </div>
        <div class="be-suggest" data-be-suggest hidden></div>
      </details>

        <!-- The colour charts, demoted to a folded card - repainted on open,
             since a hidden mount measures 0×0 (see the toggle wiring below).
             Two views of the SAME swatches: the wheel reads a palette's spread
             at a glance, the gamut chart shows where the displayable range
             actually ends. Wheel stays the default so the ?wheel deep-link and
             everyone's muscle memory land where they always did. -->
        <details class="be-subst-details be-chart-details" data-be-chart>
          <summary><span class="be-subst-details-label">${t('Colour chart')}</span></summary>
          ${segHtml('chartview', [
            { id: 'wheel', label: t('Wheel') },
            { id: 'slices', label: t('Gamut') },
          ], 'wheel', t('Chart view'), { attr: 'data-be-chartview', extraClass: 'be-chartview' })}
          <div class="be-pal-wheel" data-be-wheel-mount></div>
          <div class="be-pal-slice" data-be-slice-mount hidden></div>
        </details>
        <p class="be-err" data-be-pal-err hidden></p>
      </div>

      <div class="be-panel be-gradients" data-be-grads-mount></div>
      </div>

      <!-- Download-all - a floating pill (the catalog toolbar's clothes) at the
           pane's anchored bottom edge, so exporting the palette never scrolls
           away. Lives OUTSIDE .be-split-scroll - see above. -->
      <div class="be-pal-dock" data-be-pal-dock>
        <select class="field-select field-select--auto field-select--sm be-pal-fmt-sel" data-be-pal-fmt aria-label="${escapeText(t('Download the palette as'))}">
          <option value="tokens-json">${t('Design tokens (JSON)')} &middot; Penpot / Tokens Studio</option>
          <option value="css-vars">${t('CSS variables')}</option>
          <option value="css-classes">${t('CSS classes')}</option>
          <option value="scss">${t('SCSS variables')}</option>
          <option value="gpl">${t('GIMP palette (.gpl)')}</option>
          <option value="ase">${t('Adobe Swatch Exchange (.ase)')}</option>
        </select>
        <button type="button" class="be-btn be-btn--sm" data-be-pal-download data-sfx="whoosh">${t('Download')}</button>
      </div>
      </aside>
      <div class="be-split-main">
      ${/* ── Level 0: the one control. Adding a colour writes exactly one token
             (plan 97 section 7.1) - nothing is derived, suggested-into, or demanded. */''}
      <section class="be-context" aria-label="${escapeText(t('Palette previews'))}">
        <div class="be-context-head"><h2>${t('In context')}</h2><span data-be-preview-source>${t('Your palette')}</span></div>
        <div class="be-previews" data-be-previews></div>
        ${segHtml('preview-scene', [{ id: '0', label: t('Poster') }, { id: '1', label: t('Chart') }, { id: '2', label: t('UI card') }], '0', t('Preview scene'), { attr: 'data-scene', groupAttr: 'data-be-scenes' })}
      </section>

      ${/* Roles are an assignment layer over the swatches that already exist -
            a design system of three loose colours with no roles is valid. */''}
      <details class="be-wing be-roles"><summary class="be-wing-head"><span class="be-wing-title">${t("Colour roles")}</span><span class="be-wing-sub">${t("Choose what tools use")}</span></summary><div class="be-wing-body">
        <div data-be-roles></div>
      </div></details>

      ${/* ── Level 2: the expert wings. Folded by default, no persistence - the
             same discipline the palette's own sections keep. */''}
      <details class="be-wing" data-be-wing="generate">
        <summary class="be-wing-head">
          <span class="be-wing-title">${t('Explore shades & harmonies')}</span>
          <span class="be-wing-sub">${t('Add the colours you like')}</span>
        </summary>
        <div class="be-wing-body">
      <div class="be-colour">
        ${panelHead(t('Find a few more colours'), t('Choose a starting colour, then add individual shades or a shade group. Your existing colours and roles stay as they are.'))}
        <p class="be-draft-status" data-be-draft-status role="status" aria-live="polite"></p>
        <div class="be-derive">
          <div class="be-colorpick">
            <span class="be-field-label">${t('Starting colour')}</span>
            <div data-be-primary-field>${colorFieldHtml('be-primary', bedit.primary, { inline: true, modes: true, progressive: true })}</div>
          </div>
          <div class="be-derive-controls">
            <label class="be-field"><span class="be-field-label">${t('Scheme')}</span>${segHtml('scheme', SCHEMES, bedit.scheme, t('Colour scheme'))}</label>
            <div class="be-field be-steps-field">
              <span class="be-field-label">${t('Shades')} <span class="be-steps-val" data-be-steps-val>${bedit.steps}</span></span>
              <input type="range" class="field-range be-steps-slider" data-be-steps min="${RAMP_STEPS_MIN}" max="${RAMP_STEPS_MAX}" step="1" value="${bedit.steps}" aria-label="${escapeText(t('Shades per ramp'))}">
            </div>
            <details class="be-subst-details be-finetune" data-be-finetune>
              <summary><span class="be-subst-details-label">${t('Fine-tune')}</span></summary>
              <div class="be-finetune-body">
                <label class="be-field"><span class="be-field-label">${t('UI intensity')}</span>${segHtml('surface', INTENSITIES, bedit.surface, t('UI intensity'))}</label>
                <label class="be-field"><span class="be-field-label">${t('Contrast')}</span>${segHtml('contrast', CONTRASTS, bedit.contrast, t('Contrast target'))}</label>
                <label class="be-field"><span class="be-field-label">${t('Text on brand')}</span>${segHtml('foreground', FOREGROUNDS, bedit.foreground, t('Text colour on the brand colour'))}</label>
              </div>
            </details>
          </div>
          <div class="be-preview" data-be-preview>${initialDraft ? previewHtml(initialDraft, { neutral: bedit.neutralStep, secondary: bedit.secondaryStep, steps: bedit.steps, curves: bedit.ramps.curveMarks(), palette: walkSwatches(bedit.doc, bedit.currentTheme).filter(s => s.kind !== 'semantic').flatMap(s => s.hex ? [s.hex] : []) }) : ''}</div>
        </div>
      </div>

      <details class="be-generate-detail">
        <summary>${t('Find matching colours')}</summary>
      <div class="be-generate">
        ${panelHead(t('Find matching colours'), t('Choose a harmony and add the colours you like. Each added colour can be renamed in your palette.'))}
        <div class="be-field">
          <span class="be-field-label">${t('Harmony')}</span>
          ${/* The shared segmented-control primitive (lib/seg.ts). The free-N kinds
                are hidden UI-side only - the engine keeps them (stored docs may
                reference them) and the default stays adjacent-3. `data-kind` is
                this group's own value hook, kept because its click delegate below
                keys off it; segHtml emits `data-val` alongside either way. */''}
          ${/* "Analogous" is appended UI-side as an ADDITIONAL parametric mode; the
                fixed engine schemes (incl. adjacent-3) are untouched. Its own count
                + angle controls appear below only while it is the active kind. */''}
          ${segHtml('schemekind', [
            ...SCHEME_KINDS.filter(k => !k.id.startsWith('free-')),
            { id: 'analogous', label: t('Analogous') },
          ], bedit.harmonyKind, t('Colour harmony'), {
            attr: 'data-kind', extraClass: 'be-schemekinds', groupAttr: 'data-be-schemekind',
          })}
        </div>
        <!-- Parametric-analogous controls - N accents at a variable hue step.
             Hidden unless the Analogous harmony is picked (shown/hidden by the
             segmented-control delegate below). -->
        <div class="be-analogous" data-be-analogous${(bedit.harmonyKind as HarmonyKind) === 'analogous' ? '' : ' hidden'}>
          <div class="be-field be-analog-field">
            <span class="be-field-label">${t('Accents')} <span class="be-analog-val" data-be-analog-count-val>${bedit.analogCount}</span></span>
            <input type="range" class="field-range be-analog-slider" data-be-analog-count min="2" max="5" step="1" value="${bedit.analogCount}" aria-label="${escapeText(t('Number of analogous accents'))}">
          </div>
          <div class="be-field be-analog-field">
            <span class="be-field-label">${t('Angle')} <span class="be-analog-val" data-be-analog-angle-val>${bedit.analogAngle}°</span></span>
            <input type="range" class="field-range be-analog-slider" data-be-analog-angle min="10" max="45" step="1" value="${bedit.analogAngle}" aria-label="${escapeText(t('Hue step between analogous accents in degrees'))}">
          </div>
        </div>
        <div class="be-candidates" data-be-candidates aria-live="polite"></div>

      </div>
      </details>

      <details class="be-generate-detail be-rebuild" data-be-rebuild>
        <summary>${t('Rebuild the whole palette…')}</summary>
        <p class="be-gen-note">${t('Replace generated ramps and update theme roles from these settings. Review the result before applying; Undo restores the previous palette.')}</p>
        <button type="button" class="be-btn" data-be-replace-palette>${t('Preview full rebuild')}</button>
        <div class="be-review" data-be-review hidden></div>
      </details>
        </div>
      </details>

      ${/* The three wings below are for a system that already exists (plans/163
            F7): they are marked advanced so they read quieter than Generate,
            and so the palette rides above them wherever the split stacks. */''}
      <details class="be-wing be-wing--advanced" data-be-wing="curves">
        <summary class="be-wing-head">
          <span class="be-wing-title">${t('Shade curves')}</span>
          <span class="be-wing-sub">${t('Fine-tune a colour ramp')}</span>
        </summary>
        <div class="be-wing-body">
          <label class="be-field"><span class="be-field-label">${t('Ramp')}</span>${bedit.ramps.rampPickHtml()}</label>
          <!-- The tonal-curve editor. Revealed with the wing (the Shades slider
               in the Generate wing resamples whatever it holds). -->
          <div class="be-curve" data-be-curve-editor hidden>
            <div class="be-curve-head">
              <span class="be-curve-title" data-be-curve-title></span>
              <div class="be-curve-head-actions">
                <button type="button" class="be-btn be-btn--sm be-curve-rebuild" data-be-curve-rebuild>${t('Rebuild from colour')}</button>
                <button type="button" class="be-curve-close" data-be-curve-close aria-label="${escapeText(t('Close the curve editor'))}" title="${escapeText(t('Close'))}">✕</button>
              </div>
            </div>
            <p class="be-curve-hint">${t('Drag a point to reshape this ramp. Lightness, chroma and hue each have their own curve - switch with L / C / H. The shades below rebake live; the number of shades follows the slider above.')}</p>
            <div class="be-curve-mount" data-be-curve-mount></div>
          </div>
        </div>
      </details>

      <details class="be-wing be-wing--advanced" data-be-wing="contrast">
        <summary class="be-wing-head">
          <span class="be-wing-title">${t('Contrast')}</span>
          <span class="be-wing-sub">${t('Check and adjust readability')}</span>
        </summary>
        <div class="be-wing-body">
          <label class="be-field"><span class="be-field-label">${t('Ramp')}</span>${bedit.ramps.rampPickHtml()}</label>
          <!-- Contrast-lock: a one-shot curve transform. It retones every step
               to hit an APCA target against a background, keeping each step's
               hue + chroma, then hands the result to the SAME curve machinery
               (drag / re-anchor / Rebuild all apply as-is afterwards). -->
          <div class="be-cl" data-be-cl>
            <div class="be-cl-head">
              <span class="be-cl-title">${t('Contrast-lock')}</span>
              <span class="be-cl-sub">${t('Retone this ramp to hit APCA contrast targets against a background - each step keeps its hue and chroma.')}</span>
            </div>
            <div class="be-cl-controls">
              <label class="be-field be-cl-bg-field">
                <span class="be-field-label">${t('Background')}</span>
                <input type="color" class="be-cl-bg" data-be-cl-bg value="${escapeText(contrastLockBg)}" aria-label="${escapeText(t('Contrast-lock background colour'))}">
              </label>
              <label class="be-field be-cl-preset-field">
                <span class="be-field-label">${t('Targets')}</span>
                <select class="field-select field-select--auto field-select--sm be-cl-preset" data-be-cl-preset aria-label="${escapeText(t('Contrast target preset'))}">
                  ${CONTRAST_LOCK_PRESETS.map(p => `<option value="${escapeText(p.id)}">${escapeText(p.label)}</option>`).join('')}
                </select>
              </label>
              <label class="be-field be-cl-custom-field">
                <span class="be-field-label">${t('Custom Lc')} <em>${t('(optional)')}</em></span>
                <input type="text" class="field-input field-input--sm be-cl-custom" data-be-cl-custom placeholder="15, 45, 75, 90" inputmode="numeric" autocomplete="off" spellcheck="false" aria-label="${escapeText(t('Custom APCA Lc targets, comma-separated'))}">
              </label>
            </div>
            <div class="be-cl-actions">
              <button type="button" class="be-btn be-btn--sm be-cl-apply" data-be-cl-apply>${t('Apply contrast-lock')}</button>
              <span class="be-cl-readout" data-be-cl-readout aria-live="polite"></span>
            </div>
          </div>
          <!-- Rotate hue: a one-shot curve transform. It shifts every step's hue
               by a fixed angle, keeping each step's lightness + chroma, turning
               the whole ramp bodily around the wheel - then hands the result to
               the SAME curve machinery (drag / re-anchor / Rebuild all apply). -->
          <div class="be-hr" data-be-hr>
            <div class="be-hr-head">
              <span class="be-hr-title">${t('Rotate hue')}</span>
              <span class="be-hr-sub">${t('Turn this whole ramp around the hue wheel. Every shade keeps its lightness and chroma.')}</span>
            </div>
            <div class="be-hr-controls">
              <div class="be-field be-hr-deg-field">
                <span class="be-field-label">${t('Degrees')} <span class="be-hr-val" data-be-hr-val>0°</span></span>
                <input type="range" class="field-range be-hr-slider" data-be-hr-deg min="-180" max="180" step="1" value="0" aria-label="${escapeText(t('Hue rotation in degrees'))}">
              </div>
              <button type="button" class="be-btn be-btn--sm be-hr-apply" data-be-hr-apply>${t('Apply rotation')}</button>
            </div>
          </div>
        </div>
      </details>

      <details class="be-wing be-wing--advanced" data-be-wing="print">
        <summary class="be-wing-head">
          <span class="be-wing-title">${t('Print')}</span>
          <span class="be-wing-sub">${t('CMYK and spot inks')}</span>
          <span class="be-subst-chips" data-be-print-chips></span>
        </summary>
        <div class="be-wing-body">
          <!-- The primary is one colour; Lolly shows its on-screen (sRGB) form and
               auto-converts it for print - UNLESS the shared print lock inside pins
               an exact CMYK anchor or a named spot colour instead. -->
          ${/* A print lock pins the PRIMARY RAMP's anchor step, and a design
                system that has never generated a palette has no primary ramp to
                pin (the starter cut, plan 182 section 12) - primaryAnchorPath
                answers null. Rather than show four CMYK sliders that write
                nowhere, the wing says what is missing and offers nothing. */''}
          <p class="be-subst-none" data-be-print-none hidden>${t('Generate a palette to pin a print build for the primary.')}</p>
          <div class="be-subst" data-be-subst>
            <div class="be-subst-line">
              <span class="be-subst-key">${t('Screen')}</span>
              <code class="be-subst-val" data-be-screen></code>
              <span class="be-subst-tag">${t('auto')}</span>
            </div>
            <div data-be-lock-mount="primary"></div>
          </div>
        </div>
      </details>
      </div>


      </div>

      ${/* The room has two beats (plan 182 section 3a), written on the panel by
             paintFonts and read by the CSS below it: 0 = no face of its own, so
             ONE card and one decision; 1 = the four cards, the Fonts list and
             the specimen. `beats-type.ts` decides; nothing here guesses. */''}
      <div class="be-tab" data-be-tab-panel="type" data-be-beat="0">
      ${/* ── Level 0 (plan 97 section 7.2): the four role cards. Each shows the face
             that serves its role right now and opens the compare stage scoped
             to it. Nothing on a card commits anything. */''}
      <div class="be-panel be-typecards" data-be-typecards-panel>
        ${/* Beat 0's own head - the room's first decision, said as a decision.
               The panel head below is the beat-1 head; exactly one shows. */''}
        <div class="be-typelede">
          <h3 class="be-typelede-title">${t('Choose a face')}</h3>
          <p class="be-typelede-sub">${t('One face for body copy, buttons and every tool. Search Google Fonts, or drop a font file.')}</p>
        </div>
        ${panelHead(t('Type'), t('Four faces the app, the tools and every export read. Each card shows what serves that role today, and opens a stage where candidates stand side by side before anything installs.'))}
        <div class="be-typecard-grid" data-be-typecards>${TYPE_ROLES.map(typeRoleCardHtml).join('')}</div>
        ${/* Beat 0's tail: the three optional roles are not hidden, they are
               DEFERRED, and the sentence says what they do meanwhile. Revealing
               them holds for the mount - a disclosure that re-folds under you is
               a disclosure you stop trusting. */''}
        <p class="be-typemore" data-be-typemore>${t('Headings, code and italic follow the primary until you choose them.')}
          <button type="button" class="be-typemore-btn" data-be-typemore-toggle>${t('Choose them separately')} <span aria-hidden="true">▸</span></button>
        </p>
      </div>

      ${/* The compare stage (lib/design-system/type-compare.ts), hosted inline by
             the room rather than in a dialog: the room has the width, and a
             panel keeps the role cards it was opened from on screen. Escape
             cancels and hands the keyboard back to that card. */''}
      <section class="be-panel be-typestage" data-be-typestage hidden aria-labelledby="be-typestage-title">
        <div class="be-typestage-head">
          <h3 class="be-typestage-title" id="be-typestage-title" data-be-typestage-title></h3>
          <button type="button" class="be-typestage-x" data-be-typestage-close aria-label="${escapeText(t('Close without choosing'))}">${icon('close', { size: 14 })}</button>
        </div>
        <form class="be-typestage-search" data-be-typestage-search>
          <label class="visually-hidden" for="be-typestage-q">${t('Font name')}</label>
          ${/* Example values, not prose - untranslated on purpose, the same
                 PANTONE-placeholder precedent the print lock keeps. */''}
          <input type="text" id="be-typestage-q" data-be-typestage-q list="be-google-fonts" placeholder="Inter, Fraunces, Space Mono…" autocomplete="off" autocapitalize="words" spellcheck="false">
          <datalist id="be-google-fonts">${POPULAR_FAMILIES.map(f => `<option value="${escapeText(f)}"></option>`).join('')}</datalist>
          <button type="submit" class="be-cta" data-be-typestage-add>${t('Preview')}</button>
        </form>
        ${/* Six families, one press each (plan 182 section 6.4). On a fresh
               origin this is the first thing that shows what a candidate looks
               like, and it costs nothing until pressed - the chips are names,
               and a press is what fetches. The row is filled by openStage (the
               families already serving a role are dropped), so the buttons
               themselves are built with textContent, never markup. */''}
        <div class="be-typestage-pins" data-be-typestage-pins hidden>
          <span class="be-typestage-pins-label">${t('Pinned')}</span>
          <div class="be-typestage-pinrow" data-be-typestage-pinrow></div>
          <span class="be-typestage-pinnote">${t('one press each')}</span>
        </div>
        <div data-be-typestage-mount></div>
        <p class="be-err" data-be-typestage-err hidden></p>
      </section>

      ${/* The management list: every installed family, its roles, and delete.
             Behaviour unchanged; only its place in the room moved. Adding a face
             now goes through the stage, so there is one door and everything is
             seen before it is stored. */''}
      <div class="be-panel be-fonts">
        ${panelHead(t('Fonts'), t("Every face on this device and the role it serves. Faces of the design system's own travel in its file; starter faces come with the app."))}
        <ul class="be-font-list" data-be-fonts role="list"></ul>
        <div class="be-font-add">
          <button type="button" class="be-btn" data-be-font-compare>${t('Add a face')}</button>
          <span class="be-font-addnote">${t('Opens the compare stage. Search Google Fonts, or drop a font file.')}</span>
        </div>
        <p class="be-err" data-be-font-err hidden></p>
      </div>

      ${/* The second upload door is gone (plan 182 T6, section 6.4): the stage's
             own drop zone is the one door for a file, and it runs the same
             validators the panel did. */''}
      <div class="be-panel be-typeroles">
        ${panelHead(t('Type roles'), t('What each face is <em>for</em> - the roles tools and the app read. Body and UI wear the primary; set an optional <em>display</em> face for the top headings (h1/h2), an <em>italic</em> face for emphasis, and a <em>mono</em> face for code and data. Each falls back to the primary until you assign it.'))}
        <div class="be-specimen" data-be-specimen aria-live="off"></div>
      </div>
      </div>

      <div class="be-tab" data-be-tab-panel="tokens">
      <div class="be-panel be-radius-panel">
        ${panelHead(t('Rounded corners'), t('One brand radius drives a full scale: fine controls use smaller steps, panels use the base, and the pill step becomes fully rounded. Set it to 0 for straight corners everywhere.'))}
        <div class="brand-radius-row">
          <span class="brand-radius-preview" data-be-radius-preview aria-hidden="true"></span>
          <input type="range" class="field-range brand-radius-slider" data-be-radius-slider min="0" max="1.5" step="0.05" aria-label="${escapeText(t('Corner radius'))}">
          <span class="brand-radius-value" data-be-radius-value></span>
        </div>
        <p class="be-err" data-be-radius-err role="alert" hidden></p>
      </div>
      <div class="be-panel be-space-panel">
        ${panelHead(t('Spacing rhythm'), t('One base space token drives every Lolly gap: the compact steps, controls, panels and page margins all move together. This only writes <code>space.base</code> to your brand.'))}
        <div class="brand-space-row">
          <span class="brand-space-preview" data-be-space-preview aria-hidden="true"><i></i><i></i><i></i></span>
          <input type="range" class="field-range brand-space-slider" data-be-space-slider min="0.25" max="1.5" step="0.05" aria-label="${escapeText(t('Base spacing'))}">
          <span class="brand-space-value" data-be-space-value></span>
        </div>
        <p class="be-err" data-be-space-err role="alert" hidden></p>
      </div>
      <div class="be-panel be-tokens" data-be-tokens-mount></div>
      </div>

      <div class="be-tab" data-be-tab-panel="catalogue">
      <div class="be-panel be-cat" data-be-cat-mount></div>
      </div>

      <!-- Swatch editor popover (shared; positioned under the clicked tile).
           The SAME pieces as the Colour panel's primary field, in a card: the
           identity row up top, then the full picker (mode tabs - the value input
           reads and writes hex/OKLCH/HSL/RGB/CMYK, so there's no separate "set by
           value" row), the storage notation, and the shared print-lock control
           folded away. Delete/Save are pinned to a sticky footer so the two
           actions never scroll off.
           The card grows with its folds and REPOSITIONS (see positionEditor) -
           opening a section moves the card to where it fits rather than starting
           an inner scroll. -->
      ${/* The bulk bar (plan 182 section 5.5). It arrives with the first selected
             tile and leaves with the last - there is no mode to be in. Move to
             and Give a role are held back until beat 2: at beat 1 the pane holds
             a handful of tiles and there is nothing to sort them into.
             Each menu is a button plus a panel that opens under it; the Move-to
             panel's rows are built at open time (they are the live group names),
             the other two are fixed lists and are written here. */''}
      <div class="be-bulkbar" data-be-bulkbar role="region" aria-label="${escapeText(t('Selection actions'))}" hidden>
        <span class="be-bulkbar-n" data-be-bulk-n aria-live="polite"></span>
        <button type="button" class="be-bulkbar-btn be-bulk-preview" data-be-bulk-preview>${t('Preview')}</button>
        <span class="be-bulkbar-sep" aria-hidden="true"></span>
        <span class="be-bulkbar-wrap" data-be-bulk-wrap="move">
          <button type="button" class="be-bulkbar-btn" data-be-bulk-menu="move" aria-haspopup="true" aria-expanded="false">${t('Move to')} <span aria-hidden="true">▾</span></button>
          <div class="be-bulkbar-menu" data-be-bulk-panel="move" hidden></div>
        </span>
        <span class="be-bulkbar-wrap" data-be-bulk-wrap="role">
          <button type="button" class="be-bulkbar-btn" data-be-bulk-menu="role" aria-haspopup="true" aria-expanded="false">${t('Give a role')} <span aria-hidden="true">▾</span></button>
          <div class="be-bulkbar-menu" data-be-bulk-panel="role" hidden>
            <p class="be-bulkbar-menu-note">${t('Each selected colour takes the next role in turn.')}</p>
            ${ROLE_IDS.map(r => `<button type="button" class="be-bulkbar-item" data-be-bulk-role="${escapeText(r)}">${escapeText(roleLabel(r))}</button>`).join('')}
          </div>
        </span>
        <span class="be-bulkbar-wrap" data-be-bulk-wrap="download">
          <button type="button" class="be-bulkbar-btn" data-be-bulk-menu="download" aria-haspopup="true" aria-expanded="false">${t('Download')} <span aria-hidden="true">▾</span></button>
          <div class="be-bulkbar-menu" data-be-bulk-panel="download" hidden>
            ${PALETTE_FORMATS.map(f => `<button type="button" class="be-bulkbar-item" data-be-bulk-dl="${escapeText(f.id)}">${escapeText(f.label)}</button>`).join('')}
          </div>
        </span>
        <button type="button" class="be-bulkbar-btn" data-be-bulk-copy>${t('Copy values')}</button>
        <button type="button" class="be-bulkbar-del" data-be-bulk-del>${t('Delete')}</button>
        <button type="button" class="be-bulkbar-x" data-be-bulk-cancel aria-label="${escapeText(t('Cancel selection'))}">✕</button>
      </div>
      <div class="be-editor" data-be-editor hidden>
        <div class="be-editor-card" role="dialog" aria-label="${escapeText(t('Edit swatch'))}">
          <div class="be-editor-scroll">
            <div class="be-editor-id">
              <span class="be-editor-chip" data-be-editor-chip aria-hidden="true"></span>
              <input type="text" class="be-editor-name" data-be-editor-name autocomplete="off" aria-label="${escapeText(t('Swatch name'))}">
              <span class="be-swatch-lock be-editor-lockbadge" data-be-editor-lockbadge hidden>${t('LOCK')}</span>
            </div>
            <div class="be-editor-field"><div data-be-editor-color></div></div>
            <label class="be-editor-group">${t('Group')}<select class="field-select" data-be-editor-group></select></label>
            <div class="be-editor-field be-stored" data-be-stored-row>
              <span class="be-stored-label" id="be-stored-label">${t('Stored as')}</span>
              ${/* Built from the shared segmented-control primitive (lib/seg.ts) - 
                    .be-stored-seg keeps only its delta (a compact joined trough
                    instead of .view-seg-btn's gapped pills; see brand-studio.css).
                    aria-labelledby, not aria-label: the group's name is already on
                    screen as #be-stored-label. No option starts pressed - every
                    button renders aria-pressed="false" and renderStoredSeg() marks
                    the open swatch's notation once the editor knows it. */''}
              ${segHtml('stored', STORAGE_FORMATS, '', '', {
                attr: 'data-store-fmt', extraClass: 'be-stored-seg', groupAttr: 'data-be-stored', labelledBy: 'be-stored-label',
              })}
            </div>
            ${/* Roles are identity, print is output - so "Use as" sits above the
                  print fold. Hidden for a role's own tile: a role cannot take a
                  role (the alias would chain). */''}
            <div class="be-useas-row" data-be-useas hidden>
              <span class="be-useas-label">${t('Use as')}</span>
              ${ROLE_IDS.map(r => `<button type="button" class="be-btn be-btn--sm" data-be-useas="${escapeText(r)}" aria-pressed="false">${escapeText(roleLabel(r))}</button>`).join('')}
            </div>
            <details class="be-subst-details" data-be-subst-details>
              <summary><span class="be-subst-details-label">${t('Print substitutes')}</span><span class="be-subst-chips" data-be-subst-chips></span></summary>
              <div data-be-subst-mount></div>
            </details>
            ${/* What this colour becomes everywhere else (plans/60-color-spaces.md
                  section 11.3). Folded, and BELOW the print substitutes: those are the
                  established control and this widens the same idea, so leading
                  with it would make the familiar row look like the afterthought. */''}
            <details class="be-subst-details be-faces-details" data-be-faces-details>
              <summary><span class="be-subst-details-label">${t('In other spaces')}</span><span class="be-subst-chips" data-be-faces-chips></span></summary>
              <div data-be-faces-mount></div>
            </details>
          </div>
          ${/* Two footers in one row, one pair showing at a time: Delete | Save
                for a swatch that exists, Cancel | Add colour for the pick card
                (plan 182 section 5.1), which is bound to no token until it is
                pressed. */''}
          <div class="be-editor-actions">
            <button type="button" class="be-editor-del" data-be-editor-del hidden>${t('Delete')}</button>
            <button type="button" class="be-editor-del be-editor-cancel" data-be-editor-cancel hidden>${t('Cancel')}</button>
            <button type="button" class="be-cta be-editor-done" data-be-editor-done>${t('Save')}</button>
            <button type="button" class="be-cta be-editor-done be-editor-add" data-be-editor-add hidden>${t('Add colour')}</button>
          </div>
        </div>
      </div>
    </div>`;
}

export function wireStepsSlider(bedit: BrandEditorCtx): void {
  const { DEFAULT_STEPS } = bedit;
  // Shades slider - how many divisions each ramp carries. Re-derives live; the
  // neutral/secondary step picks re-centre on the new anchor (and clamp in range).
  const stepsSlider = bedit.ramps.$('[data-be-steps]') as HTMLInputElement | null; bedit.stepsSlider = stepsSlider;
  const stepsVal = bedit.ramps.$('[data-be-steps-val]') as HTMLElement | null; bedit.stepsVal = stepsVal;
  stepsSlider?.addEventListener('input', () => {
    bedit.steps = Math.round(Number(stepsSlider.value)) || DEFAULT_STEPS;
    if (stepsVal) stepsVal.textContent = String(bedit.steps);
    bedit.neutralStep = Math.min(bedit.neutralStep, bedit.steps);
    bedit.secondaryStep = Math.min(bedit.secondaryStep, bedit.steps);
    bedit.state.renderPreview();
    bedit.curveEditor.syncCurveEditor(); // the curve is the master; the slider only resamples it
  });
}

export function wireHueRotate(bedit: BrandEditorCtx): void {
  const { root } = bedit;
  bedit.ramps.$('[data-be-hr-apply]')?.addEventListener('click', () => bedit.derive.applyHueRotate());

  // ── Wing wiring: the ramp picker (two instances) + the Curves wing's reveal ──
  root.querySelectorAll<HTMLElement>('[data-be-ramp-pick]').forEach(seg => {
    // The Curves wing's own picker OWNS the editor: it opens it on whichever
    // ramp is picked, which is also the way back after the editor's ✕ (the wing
    // would otherwise show a picker that does nothing at all until it is
    // collapsed and re-expanded). Any other copy - the Contrast wing's - only
    // re-points an editor that is already showing, and never reveals the Curves
    // wing behind it or scrolls the page there mid-interaction.
    const ownsEditor = !!seg.closest('[data-be-wing="curves"]');
    seg.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-ramp]'); if (!btn) return;
      const next = btn.dataset.ramp;
      if (next !== 'primary' && next !== 'neutral' && next !== 'secondary') return;
      bedit.curveRamp = next;
      bedit.curveEditor.syncRampPick();
      if (ownsEditor) bedit.curveEditor.showCurveEditor(bedit.curveRamp);
      else if (bedit.editingCurveRamp) bedit.curveEditor.openCurveEditor(bedit.curveRamp, { toggle: false, reveal: false });
    });
  });
  // The editor lives in the Curves wing and is hidden until asked; revealing the
  // wing IS the ask, so it opens on whichever ramp the picker names.
  bedit.state.wingEl('curves')?.addEventListener('toggle', function (this: HTMLDetailsElement) {
    if (this.open) bedit.curveEditor.showCurveEditor(bedit.curveRamp);
  });

  /** The last primary that resolved to a real hex - what an unreadable primary
   *  falls back to, so the generator never sees a broken string. */
  bedit.goodPrimaryHex = /^#[0-9a-fA-F]{6,8}$/.test(bedit.primary) ? bedit.primary.slice(0, 7) : DEFAULT_PRIMARY;
}

export function wireScenes(bedit: BrandEditorCtx): void {
  const { paletteObservers } = bedit;
  bedit.ramps.$('[data-be-scenes]')?.addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest<HTMLElement>('[data-scene]');
    if (!button) return;
    bedit.previewScene = Number(button.dataset.scene);
    bedit.ramps.$('[data-be-scenes]')?.querySelectorAll('[data-scene]').forEach(b => { b.setAttribute('aria-pressed', String(b === button)); });
    bedit.derive.renderPreviews();
  });
  paletteObservers.add(bedit.derive.renderPreviews);
}

export function wireAnalogous(bedit: BrandEditorCtx): void {
  const { candidatesEl, paletteHooks, preview, root } = bedit;
  // The parametric-analogous count/angle controls, shown only in that mode.
  const analogWrap = bedit.ramps.$('[data-be-analogous]') as HTMLElement | null; bedit.analogWrap = analogWrap;
  const analogCountInput = bedit.ramps.$('[data-be-analog-count]') as HTMLInputElement | null; bedit.analogCountInput = analogCountInput;
  const analogAngleInput = bedit.ramps.$('[data-be-analog-angle]') as HTMLInputElement | null; bedit.analogAngleInput = analogAngleInput;
  const analogCountVal = bedit.ramps.$('[data-be-analog-count-val]') as HTMLElement | null; bedit.analogCountVal = analogCountVal;
  const analogAngleVal = bedit.ramps.$('[data-be-analog-angle-val]') as HTMLElement | null; bedit.analogAngleVal = analogAngleVal;
  bedit.ramps.$('[data-be-schemekind]')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-kind]'); if (!btn) return;
    bedit.harmonyKind = btn.dataset.kind as HarmonyKind;
    root.querySelectorAll<HTMLElement>('[data-be-schemekind] [data-kind]').forEach(b => { b.setAttribute('aria-pressed', String(b === btn)); });
    if (analogWrap) analogWrap.hidden = bedit.harmonyKind !== 'analogous';
    bedit.derive.renderCandidates();
  });
  analogCountInput?.addEventListener('input', () => {
    bedit.analogCount = Number(analogCountInput.value) || bedit.analogCount;
    if (analogCountVal) analogCountVal.textContent = String(bedit.analogCount);
    bedit.derive.renderCandidates();
  });
  analogAngleInput?.addEventListener('input', () => {
    bedit.analogAngle = Number(analogAngleInput.value) || bedit.analogAngle;
    if (analogAngleVal) analogAngleVal.textContent = `${bedit.analogAngle}°`;
    bedit.derive.renderCandidates();
  });
  candidatesEl?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-add-hex]'); if (!btn || btn.disabled) return;
    const hex = btn.dataset.addHex!, name = btn.dataset.addName || nameColor(hex);
    if (bedit.derive.isInPalette(hex)) return;
    bedit.state.pushUndo(t('Add matching colour'));
    addSwatch(bedit.doc, 'spectrum', name, serializeColor(hex, 'lch')); // LCH - the storage default
    bedit.ramps.repaintPalette();       // refreshes swatches + picker + wheel + (via hook) the generator
    bedit.state.persist(true);          // officiate: the accent is now part of the brand
    playSfx('click');
    announce(tRaw('{name} added to the palette', { name }));
  });
  paletteHooks.push(() => { bedit.derive.renderGenerator(); bedit.state.renderPreview(); }); // keep candidates + previews in sync with the palette
  bedit.derive.renderGenerator();                  // initial paint

  preview?.addEventListener('click', e => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-be-add-ramp], [data-be-add-shade]');
    if (!button || button.disabled) return;
    const ramp = button.dataset.beAddRamp ?? button.dataset.beAddShade?.split('.')[2];
    if (!ramp || !RAMP_IDS.includes(ramp as RampId)) return;
    const draft = deriveSafe({ primary: bedit.primary, scheme: bedit.scheme, surface: bedit.surface, contrast: bedit.contrast, steps: bedit.steps, foreground: bedit.foreground });
    if (!draft) return;
    const shades = draftShades(draft, ramp).filter(shade => !button.dataset.beAddShade || shade.key === button.dataset.beAddShade);
    const label = tRaw('{label} shades', { label: RAMP_LABEL[ramp as RampId] });
    bedit.state.pushUndo(t('Add shades'));
    const added = addDraftShades(bedit.doc, shades, label);
    if (!added) return;
    bedit.ramps.repaintPalette();
    bedit.state.persist(true);
    const status = bedit.ramps.$<HTMLElement>('[data-be-draft-status]');
    if (status) status.textContent = added === 1 ? t('1 shade added. Undo is available above your palette.') : tRaw('{n} shades added. Undo is available above your palette.', { n: added });
    // Repainting replaces the trigger. Keep focus in the workbench even when
    // every shade has been added and the ramp's buttons are now disabled.
    const nextButton = preview?.querySelector<HTMLButtonElement>(`[data-be-add-ramp="${ramp}"]:not(:disabled)`);
    if (nextButton) nextButton.focus();
    else if (status) { status.tabIndex = -1; status.focus(); }
    announce(added === 1 ? t('1 shade added to your palette') : tRaw('{n} shades added to your palette', { n: added }));
  });

  // ── Screen readout - the primary's on-screen (sRGB) form. ───────────────────
  const screenEl = bedit.ramps.$('[data-be-screen]') as HTMLElement | null; bedit.screenEl = screenEl;
}

export function paintInitialScreen(bedit: BrandEditorCtx): void {
  const { root } = bedit;
  bedit.derive.renderScreen();
  // The four derive segments. Named explicitly because `[data-be-seg]` is the
  // shared primitive's hook, not this listener's - the Harmony and "Stored as"
  // segments now render through segHtml() too, and they own their own delegates
  // (renderCandidates / renderStoredSeg). Without this guard they'd be swept in
  // here as well and re-run renderPreview() on every click.
  const DERIVE_SEGS = new Set(['scheme', 'surface', 'contrast', 'foreground']); bedit.DERIVE_SEGS = DERIVE_SEGS;
  root.querySelectorAll<HTMLElement>('[data-be-seg]').forEach(seg => {
    if (!DERIVE_SEGS.has(seg.dataset.beSeg ?? '')) return;
    const on = (e: Event): void => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-val]'); if (!btn) return;
      const name = seg.dataset.beSeg;
      if (name === 'scheme') bedit.scheme = btn.dataset.val as Scheme;
      else if (name === 'surface') bedit.surface = btn.dataset.val as Surface;
      else if (name === 'contrast') bedit.contrast = btn.dataset.val as Contrast;
      else if (name === 'foreground') bedit.foreground = btn.dataset.val as Fg;
      seg.querySelectorAll<HTMLElement>('[data-val]').forEach(b => { b.setAttribute('aria-pressed', String(b === btn)); });
      bedit.state.renderPreview();
    };
    seg.addEventListener('click', on);
  });
  // The "Print & screen" summary chips - rendered via mountPrintLock's own
  // render (ctx.onRender), never by a caller directly, so both lock funnels
  // (the control's toggles AND afterSwatchLockChange → primaryLock.render())
  // update them without either knowing about the folded summary.
  const printChips = bedit.ramps.$('[data-be-print-chips]') as HTMLElement | null; bedit.printChips = printChips;
  const printNone = bedit.ramps.$('[data-be-print-none]') as HTMLElement | null; bedit.printNone = printNone;
  const printSubst = bedit.ramps.$('[data-be-subst]') as HTMLElement | null; bedit.printSubst = printSubst;
}

export function wirePrimaryLock(bedit: BrandEditorCtx): void {
  const { preview } = bedit;
  // The primary's print lock - mounted only now, AFTER the generic [data-be-seg]
  // delegate above has taken its one-time querySelectorAll snapshot, so this
  // control's own Auto/Locked + Process/Spot segments (built on the same
  // segHtml markup) don't get swept into that older Scheme/Surface/Contrast
  // listener (see mountPrintLock's doc comment).
  const primaryLockMount = bedit.ramps.$('[data-be-lock-mount="primary"]') as HTMLElement | null; bedit.primaryLockMount = primaryLockMount as BrandEditorCtx['primaryLockMount'];
  const primaryLock = primaryLockMount ? mountPrintLock(primaryLockMount, {
    onRender: bedit.derive.renderPrintChips,
    hex: () => bedit.derive.primaryHex(),
    getCmyk: () => bedit.ramps.primaryPrintLock()?.cmyk ?? null,
    setCmyk: (cmyk) => {
      const path = primaryAnchorPath(bedit.doc);
      if (path) setSwatchCmykLock(bedit.doc, path, cmyk);
      bedit.ramps.repaintPalette(); // same swatch is a tile in the Palette panel - keep its lock badge in sync
      bedit.state.persist();        // the popover's afterSwatchLockChange does exactly this
    },
    getSpot: () => bedit.ramps.primaryPrintLock()?.spot ?? null,
    setSpot: (spot) => {
      const path = primaryAnchorPath(bedit.doc);
      if (path) setSwatchSpotLock(bedit.doc, path, spot);
      bedit.ramps.repaintPalette();
      bedit.state.persist();
    },
  }) : null; bedit.primaryLock = primaryLock;
  // Neutral/secondary ramp-step picks - the Primary ramp stays non-interactive
  // (it's already driven by the colour field above, not a step choice).
  preview?.addEventListener('click', (e) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-be-ramp]');
    if (!cell) return;
    const step = Number(cell.dataset.beStep);
    if (cell.dataset.beRamp === 'neutral') bedit.neutralStep = step;
    else if (cell.dataset.beRamp === 'secondary') bedit.secondaryStep = step;
    else return;
    bedit.state.renderPreview();
  });
  // The per-ramp tonal-curve toggle (a separate attribute → never swept up by
  // the step-pick delegate above, which keys off [data-be-ramp] on the cells).
  preview?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-be-curve]');
    if (!btn) return;
    const ramp = btn.dataset.beCurve;
    if (ramp === 'primary' || ramp === 'neutral' || ramp === 'secondary') bedit.curveEditor.openCurveEditor(ramp);
  });
}

export function deriveOps(bedit: BrandEditorCtx) {
  return {
    applyContrastLock: bindOp(bedit, applyContrastLock),
    applyHueRotate: bindOp(bedit, applyHueRotate),
    primaryHex: bindOp(bedit, primaryHex),
    paletteHexes: bindOp(bedit, paletteHexes),
    isInPalette: bindOp(bedit, isInPalette),
    renderCandidates: bindOp(bedit, renderCandidates),
    renderPreviews: bindOp(bedit, renderPreviews),
    renderGenerator: bindOp(bedit, renderGenerator),
    renderScreen: bindOp(bedit, renderScreen),
    syncPrintWing: bindOp(bedit, syncPrintWing),
    renderPrintChips: bindOp(bedit, renderPrintChips),
    reseedFromDoc: bindOp(bedit, reseedFromDoc),
    seedDraftAndMarkup: bindOp(bedit, seedDraftAndMarkup),
    wireStepsSlider: bindOp(bedit, wireStepsSlider),
    wireHueRotate: bindOp(bedit, wireHueRotate),
    wireScenes: bindOp(bedit, wireScenes),
    wireAnalogous: bindOp(bedit, wireAnalogous),
    paintInitialScreen: bindOp(bedit, paintInitialScreen),
    wirePrimaryLock: bindOp(bedit, wirePrimaryLock),
  };
}
