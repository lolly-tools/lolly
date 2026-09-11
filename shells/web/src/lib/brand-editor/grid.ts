// SPDX-License-Identifier: MPL-2.0
/**
 * brand editor: the palette grid, keyboard nudging, the wheel and the gamut chart.
 *
 * Every function takes the shared `bedit: BrandEditorCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `bedit.<module>.<fn>`. Extracted verbatim
 * from mountBrandEditor() by scripts/split-closure.ts.
 */
import { aliasPath, convertColor, formatOklch, hexToOklch, parseColor as parseCssColor } from '@lolly/engine';
import type { SlicePlane } from '@lolly/engine';
import { addSwatch, deleteSwatch, nudgeSwatch, setSwatchExcluded, setSwatchName, setSwatchValue } from '../brand-doc.ts';
import type { BrandSwatch } from '../brand-doc.ts';
import { serializeColor, storageFormatOf } from '../color-formats.ts';
import type { StorageFormat } from '../color-formats.ts';
import { oklchHex, oklchToStored, renderBrandWheel, updateWheelDot, wireBrandWheel } from '../palette-wheel.ts';
import type { WheelDot } from '../palette-wheel.ts';
import { SLICE_AXES, formatFixed, paintSliceChart, renderSliceChart, sliceCMax, sliceFixedOf, updateSliceDot, wireSliceChart } from '../oklch-slice.ts';
import type { SliceDot } from '../oklch-slice.ts';
import { gradientAliasRefCount, materializeGradientAliases } from '../token-studio.ts';
import { t, tRaw } from '../../i18n.ts';
import { escape as escapeText } from '../../utils.ts';
import { segHtml } from '../seg.ts';
import { announce } from '../../a11y.ts';
import { playSfx } from '../sfx.ts';
import { bindOp, type BrandEditorCtx } from './context.ts';

// ── Palette grid: keyboard channel nudging (huetone-style) ──────────────────
// With a swatch TILE focused (a native <button>, so Tab reaches it and Enter/
// click still opens the popover), l/c/h ARM an OKLCH channel and Arrow Up/Down
// nudge it (Shift = coarse). Shift+H copies the hex, Shift+C the oklch() string.
// We only ever act when the tile itself is the focused element - a text input in
// the popover (a separate element outside palMount) never reaches this listener,
// so no browser default is hijacked. The one deviation from the brief's "c
// copies hex": bare `c` ARMS Chroma (keeping the L/C/H channel model whole), so
// copy-hex moved to Shift+H (H = Hex) - the model reads "letter arms, Shift+
// letter copies", and Cmd/Ctrl+C is never touched, which was the real rule.
/** How many tiles sit in the focused tile's row. Measured, not assumed: the
 *  grid is `auto-fill`, so the count moves with the pane's width. */
export const gridColumns = (_bedit: BrandEditorCtx, tile: HTMLElement): number => {
  const grid = tile.closest<HTMLElement>('.be-pal-grid');
  if (!grid) return 1;
  const kids = [...grid.children] as HTMLElement[];
  const top = kids[0]?.offsetTop ?? 0;
  return Math.max(1, kids.filter(el => el.offsetTop === top).length);
};
/**
 * The grid's own keyboard (plan 182 section 5.5): arrows move the focused
 * tile, Shift-arrows extend the selection, Space toggles, Cmd-A takes every
 * own colour, Delete removes the selection. True means the press was consumed,
 * so the channel nudging below only ever sees what is left.
 *
 * THE ARROWS BELONG TO THE GRID NOW, and the channel nudge keeps them only
 * while a channel is ARMED - which is why `armedChannel` starts at null rather
 * than 'L'. The model was always "a letter arms, the arrows nudge"; it just
 * started armed, so the first Arrow Up on a freshly focused tile recoloured it
 * instead of moving. Press l, c or h and Arrow Up/Down nudge exactly as they
 * always did.
 *
 * Escape is deliberately NOT here: the studio's Escape ladder (popover, then
 * the review card, then the selection) lives on the document handler, and one
 * ladder is the only way it stays in order.
 */
export const paletteSelectKey = (bedit: BrandEditorCtx, e: KeyboardEvent, tile: HTMLElement): boolean => {
  const { palSel } = bedit;
  const k = bedit.palSelect.keyOfTile(tile);
  if (!k || e.key === 'Escape') return false;
  bedit.palFocusKey = k;
  if ((e.key === 'Delete' || e.key === 'Backspace') && palSel.size()) {
    e.preventDefault();
    bedit.palSelect.deleteSelection();
    return true;
  }
  if (bedit.armedChannel && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.metaKey && !e.ctrlKey) return false;
  const r = palSel.keyboard(e.key, k, {
    shift: e.shiftKey, meta: e.metaKey || e.ctrlKey, columns: gridColumns(bedit, tile),
  });
  if (!r.handled) return false;
  e.preventDefault();
  if (r.focus) bedit.palFocusKey = r.focus;
  bedit.palSelect.syncPalSelect();
  if (r.focus && r.focus !== k) bedit.palSelect.tileForKey(r.focus)?.focus();
  return true;
};
export const channelValueStr = (_bedit: BrandEditorCtx, ch: 'L' | 'C' | 'H', hex: string): string => {
  const o = hexToOklch(hex);
  if (!o) return hex;
  return ch === 'L' ? `L ${o.l.toFixed(2)}` : ch === 'C' ? `C ${o.c.toFixed(3)}` : `H ${Math.round(o.h)}°`;
};
export const nudgeFmtOf = (_bedit: BrandEditorCtx, s: BrandSwatch): StorageFormat => (s.isAlias ? 'lch' : storageFormatOf(s.raw));
export const copyTileText = (bedit: BrandEditorCtx, text: string, spoken: string): void => {
  const { host } = bedit;
  void Promise.resolve(host.clipboard?.writeText?.(text)).then(
    () => announce(spoken),
    () => announce(t('Copy failed - your browser blocked clipboard access'), { assertive: true }),
  );
};
// Esc / outside-click closes the swatch editor (the colour popover stops its own Esc).
// The add row's chip is exempt: it OPENS this card, so letting the pointer-down
// close it first would make every press a toggle that ends closed.
export const onDocPointer = (bedit: BrandEditorCtx, e: PointerEvent): void => {
  const { bulkbar, editorEl } = bedit;
  // The bulk bar's menus dismiss on the same press, and on their own: the bar
  // shows whether or not a swatch card is open.
  if (bedit.openBulkPanel && !bulkbar?.contains(e.target as Node)) bedit.palSelect.closeBulkMenu();
  if (!editorEl || editorEl.hidden || editorEl.contains(e.target as Node)) return;
  const el = e.target as HTMLElement;
  if (el.closest('[data-be-tile]') || el.closest('[data-ds-addc-pick]')) return;
  bedit.swatchEditor.closeEditor();
};
// stopImmediatePropagation, not stopPropagation: the host view's own
// Esc-to-leave handler listens on the SAME document target, and plain
// stopPropagation can't stop a sibling listener - Esc on an open popover
// would close it AND kick the user out of the studio. The editor mounts
// before the host wires its handler, so this one runs first.
export const onKey = (bedit: BrandEditorCtx, e: KeyboardEvent): void => {
  const { editorEl, palSel, reviewEl, root, undoStack } = bedit;
  // Undo - Colours room only, and never over a text field (a native input owns
  // its own undo; hijacking a browser default is not on). With an empty stack
  // the key falls straight through to the page.
  if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
    const el = document.activeElement as HTMLElement | null;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    const be = root.querySelector<HTMLElement>('[data-brand-editor]');
    // No data-active-tab at all = every panel stacked, i.e. the room is showing.
    if (be?.dataset.activeTab && be.dataset.activeTab !== 'color') return;
    if (!undoStack.length) return;
    e.preventDefault(); e.stopImmediatePropagation();
    bedit.replace.undoLast();
    return;
  }
  if (e.key !== 'Escape') return;
  if (editorEl && !editorEl.hidden) { e.stopImmediatePropagation(); bedit.swatchEditor.closeEditor(); return; }
  if (reviewEl && !reviewEl.hidden) { e.stopImmediatePropagation(); bedit.replace.hideReview(); return; }
  if (bedit.openBulkPanel) { e.stopImmediatePropagation(); bedit.palSelect.closeBulkMenu(); return; }
  // The model decides whether there was anything to clear, and the event is
  // only stopped when there was - an Escape this room did not answer has to
  // reach the studio's own handler, or the room becomes a trap.
  const was = document.activeElement;
  if (palSel.keyboard('Escape', bedit.palFocusKey).cleared) {
    e.stopImmediatePropagation();
    bedit.palSelect.syncPalSelect();
    bedit.palSelect.handBackPalFocus(was);
  }
};
// The popover positions in `.be` space, but its anchors live inside the side
// pane's own scrollport (and below 1100px the page itself still scrolls) - 
// either scroll drifts an open popover off its tile. Capture-phase scroll
// catches both: follow the tile while it exists, close when it's gone.
// refreshTile swaps tiles via outerHTML, so a disconnected anchor is
// re-queried by index before giving up.
export const onAnchorScroll = (bedit: BrandEditorCtx, e: Event): void => {
  const { editorEl, palMount } = bedit;
  if (!editorEl || editorEl.hidden || bedit.pickSheet) return; // the phone pose is docked, not anchored
  if (e.target instanceof Node && editorEl.contains(e.target)) return; // the popover's own body scrolling
  const anchor = bedit.editorAnchor?.isConnected
    ? bedit.editorAnchor
    : (bedit.selected >= 0 ? palMount?.querySelector<HTMLElement>(`[data-be-tile="${bedit.selected}"]`) ?? null : null);
  if (!anchor) { bedit.swatchEditor.closeEditor(); return; }
  // An anchor inside the side pane's clipped scrollport can scroll out from
  // under the popover - following it would float the popover over the derive
  // panel (and slide it under the sticky action row). Close once it leaves.
  const pane = anchor.closest('.be-split-scroll');
  if (pane) {
    const pr = pane.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
    if (ar.bottom < pr.top || ar.top > pr.bottom) { bedit.swatchEditor.closeEditor(); return; }
  }
  bedit.editorAnchor = anchor; bedit.swatchEditor.positionEditor(anchor);
};
// ── The wheel: a live OKLCH hue/chroma view of the SAME swatches ────────────
// Drag a dot to recolour it (hue+chroma from where it arrives, lightness kept),
// click a dot to open its editor, click empty space to drop a new custom
// swatch there. Re-rendered (and re-wired) on every repaint so it never drifts
// from the grid; recolours update the one dot + its grid tile in place.
export const liveTile = (bedit: BrandEditorCtx, idx: number, hex: string): void => {
  const { palMount } = bedit;
  const tile = palMount?.querySelector<HTMLElement>(`[data-be-tile="${idx}"]`);
  if (!tile) return;
  tile.style.setProperty('--sw', hex);
  tile.classList.remove('is-empty');
  const s = bedit.swatches[idx];
  if (s) bedit.replace.syncTileMeta(tile, s); // hex already updated on the swatch by the caller
};
/**
 * A swatch's AUTHORED colour, for positioning its dot on the slice charts.
 *
 * `s.hex` is the resolved sRGB bake - gamut-MAPPED, so for a swatch stored as
 * `oklch()` past sRGB it carries a reduced chroma. Positioning from it plots the
 * sRGB ceiling instead of the colour (the same defect just fixed in the Colour
 * Lab), and worse, a drag then reads back that clamped value and ratchets the
 * swatch's real chroma down a step at a time.
 *
 * `s.raw` is the stored `$value`, which is `oklch()` for anything the wheel wrote.
 * An alias (`{color.x}`) or an unparseable value has no authored colour of its own
 * - those fall back to the hex, which is what they were always positioned by.
 */
export const swatchOklch = (_bedit: BrandEditorCtx, s: { raw: string; isAlias: boolean }): { l: number; c: number; h: number } | undefined => {
  if (s.isAlias) return undefined;
  const parsed = parseCssColor(s.raw);
  if (!parsed) return undefined;
  const [l, c, h] = convertColor(parsed, 'oklch').components;
  return Number.isFinite(l) && Number.isFinite(c) && Number.isFinite(h) ? { l, c, h } : undefined;
};
export const sliceDots = (bedit: BrandEditorCtx): SliceDot[] =>
  bedit.swatches.map((s, idx) => ({ idx, hex: s.hex, label: s.name, oklch: swatchOklch(bedit, s) }));
/** Move every dot to where the CURRENT slice puts it, without a re-render - 
 *  the off-plane fade changes on every tick of the fixed slider. */
export const refreshSliceDots = (bedit: BrandEditorCtx): void => {
  const { sliceMount, sliceState } = bedit;
  if (!sliceMount) return;
  for (const s of bedit.swatches.keys()) {
    updateSliceDot(sliceMount, s, bedit.swatches[s]!.hex, sliceState, swatchOklch(bedit, bedit.swatches[s]!));
  }
};
export const schedulePaint = (bedit: BrandEditorCtx, quality: 'full' | 'draft'): void => {
  if (bedit.sliceFrame) cancelAnimationFrame(bedit.sliceFrame);
  bedit.sliceFrame = requestAnimationFrame(() => {
  const { sliceMount, sliceState } = bedit;
    bedit.sliceFrame = 0;
    if (sliceMount) paintSliceChart(sliceMount, sliceState, { quality });
  });
};
export const paintChart = (bedit: BrandEditorCtx): void => { bedit.paintWheel(); bedit.paintSlices(); };
export function wirePaletteKeys(bedit: BrandEditorCtx): void {
  const { CHANNEL_NAME, editorEl, palMount, undoStack } = bedit;
  palMount?.addEventListener('keydown', (e) => {
    const tile = (e.target as HTMLElement | null)?.closest?.<HTMLElement>('[data-be-tile]') ?? null;
    // Only when the tile BUTTON itself holds focus - never a nested/other control.
    if (!tile || tile !== (e.target as HTMLElement) || e.altKey) return;
    if (bedit.grid.paletteSelectKey(e, tile)) return; // arrows, Shift-arrows, Space, Cmd-A, Delete
    if (e.metaKey || e.ctrlKey) return;
    const idx = Number(tile.dataset.beTile);
    const s = Number.isInteger(idx) ? bedit.swatches[idx] : undefined;
    if (!s?.hex) return;
    const k = e.key;
    // Arm a channel (bare l/c/h) - a live readout via the shared aria-live region.
    if (!e.shiftKey && (k === 'l' || k === 'c' || k === 'h')) {
      e.preventDefault();
      bedit.armedChannel = k.toUpperCase() as 'L' | 'C' | 'H';
      announce(tRaw('{channel} armed · {value}', { channel: CHANNEL_NAME[bedit.armedChannel], value: bedit.grid.channelValueStr(bedit.armedChannel, s.hex) }));
      return;
    }
    // Copy - Shift+C the oklch() string, Shift+H the hex.
    if (e.shiftKey && (k === 'C' || k === 'H')) {
      e.preventDefault();
      const o = hexToOklch(s.hex);
      if (k === 'C' && o) bedit.grid.copyTileText(formatOklch(o), tRaw('Copied {value}', { value: formatOklch(o) }));
      else bedit.grid.copyTileText(s.hex, tRaw('Copied {value}', { value: s.hex }));
      return;
    }
    // Nudge the armed channel (Shift = coarse ×5), written through the same doc
    // path a popover edit uses, so it persists on Save identically.
    if (bedit.armedChannel && (k === 'ArrowUp' || k === 'ArrowDown')) {
      e.preventDefault();
      const next = nudgeSwatch(s.hex, bedit.armedChannel, k === 'ArrowUp' ? 1 : -1, e.shiftKey);
      bedit.swatchEditor.writeSwatchHex(idx, next, bedit.grid.nudgeFmtOf(s));
      announce(tRaw('{channel} {value}', { channel: CHANNEL_NAME[bedit.armedChannel], value: bedit.grid.channelValueStr(bedit.armedChannel, next) }));
    }
  });

  editorEl?.querySelector('[data-be-editor-name]')?.addEventListener('input', (e) => {
    if (bedit.selected < 0) return;
    const cur = bedit.swatches[bedit.selected]; if (!cur) return;
    const val = (e.target as HTMLInputElement).value;
    setSwatchName(bedit.doc, cur.path, val); cur.name = val || cur.name;
    const tile = palMount?.querySelector<HTMLElement>(`[data-be-tile="${bedit.selected}"]`);
    if (tile) bedit.replace.syncTileMeta(tile, cur); // the grid is shape-only - the name lives in title/aria
    bedit.state.persist();
  });
  editorEl?.querySelector('[data-be-editor-del]')?.addEventListener('click', () => {
    if (bedit.selected < 0) return;
    const cur = bedit.swatches[bedit.selected]; if (!cur) return;
    bedit.state.pushUndo(tRaw('Delete {name}', { name: cur.name }));
    // Derived leaves (ramp steps + the theme roles) are structural - "delete"
    // HIDES them via the doc's exclusion list: the ramp stays derived and the
    // token keeps resolving (so semantic roles and gradient aliases pointing at
    // an excluded step never dangle - no materialisation needed), while the
    // tile vanishes from the grid + picker swatches. A re-derive clears entries
    // whose step no longer exists (see the derive flow above).
    if (!cur.deletable || bedit.ramps.isStarterSwatch(cur) || cur.kind === 'ramp' || cur.kind === 'semantic') {
      setSwatchExcluded(bedit.doc, cur.key, true);
      bedit.swatchEditor.closeEditor(); bedit.ramps.repaintPalette(); bedit.state.persist(true);
      announce(`${tRaw('{name} removed', { name: cur.name })} ${t('Undo with Control Z.')}`);
      return;
    }
    if (!cur.deletable) { undoStack.pop(); return; } // nothing happened - drop the snapshot
    // Gradient stops may wear this swatch by alias - pin them to its current hex
    // before it goes, so the doc and any exported pack never carry a dangling
    // ref. No confirm: the announcement says what happened, and undo restores it.
    const refs = gradientAliasRefCount(bedit.doc, cur.key);
    if (refs) materializeGradientAliases(bedit.doc, ref => aliasPath(ref) === cur.key, () => cur.hex || null);
    deleteSwatch(bedit.doc, cur.path); bedit.swatchEditor.closeEditor(); bedit.ramps.repaintPalette(); bedit.state.persist(true);
    const stops = refs === 0 ? ''
      : refs === 1 ? ` ${t('1 gradient stop keeps its colour as a fixed value.')}`
        : ` ${tRaw('{refs} gradient stops keep their colour as a fixed value.', { refs })}`;
    announce(`${tRaw('{name} removed', { name: cur.name })}${stops} ${t('Undo with Control Z.')}`);
  });
  // Save = the affirmative close: edits already arrived live (same contract as
  // the wheel/tiles), so this flushes the debounce, confirms audibly, and closes.
  editorEl?.querySelector('[data-be-editor-done]')?.addEventListener('click', () => {
    bedit.state.persist(true); playSfx('saveProfile'); bedit.swatchEditor.closeEditor();
  });
  editorEl?.querySelector('[data-be-editor-name]')?.addEventListener('keydown', (event) => {
    const e = event as KeyboardEvent;
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    if (bedit.pickHex !== null) bedit.swatchEditor.commitPickCard();
    else { bedit.state.persist(true); bedit.swatchEditor.closeEditor(); }
  });
  // The pick card's footer. Cancel is a real cancel - nothing was written, so
  // there is nothing to undo and the add row keeps whatever it had.
  editorEl?.querySelector('[data-be-editor-cancel]')?.addEventListener('click', () => {
    bedit.swatchEditor.closeEditor();
    bedit.addColor.addField()?.focus();
  });
  editorEl?.querySelector('[data-be-editor-add]')?.addEventListener('click', () => { bedit.swatchEditor.commitPickCard(); });
}

export function wireWheel(bedit: BrandEditorCtx): void {
  const { cleanups, editorChip, palMount, sliceState, wheelMount } = bedit;
  bedit.paintWheel = (): void => {
    if (!wheelMount) return;
    const dots: WheelDot[] = bedit.swatches.map((s, idx) => ({ idx, hex: s.hex, label: s.name }));
    wheelMount.innerHTML = renderBrandWheel(dots);
    bedit.wheelTeardown?.();
    bedit.wheelTeardown = wireBrandWheel(wheelMount, {
      hexOf: (idx) => bedit.swatches[idx]?.hex ?? '#888888',
      onRecolor: (idx, o) => {
        const cur = bedit.swatches[idx]; if (!cur) return;
        // Respect the swatch's stored notation: LCH swatches (the default) get
        // the exact oklch() string; a swatch the user stores as hex/rgb/hsl
        // keeps its notation through a wheel drag too.
        const fmt = storageFormatOf(cur.raw);
        const hex = oklchHex(o);
        const stored = fmt === 'lch' ? oklchToStored(o) : serializeColor(hex, fmt);
        setSwatchValue(bedit.doc, cur.path, stored);
        cur.raw = stored; cur.hex = hex;
        updateWheelDot(wheelMount, idx, hex);
        bedit.grid.liveTile(idx, hex);
        if (bedit.selected === idx && editorChip) editorChip.style.setProperty('--sw', hex); // keep an open editor's chip in step
      },
      onCommit: () => bedit.state.persist(),
      onPick: (idx) => {
        // The tile can hide inside a folded palette group (display:none - 
        // offsetParent null); a hidden anchor would place the popover at the
        // panel origin, so fall back to the wheel dot itself.
        const tile = palMount?.querySelector<HTMLElement>(`[data-be-tile="${idx}"]`);
        const anchor = (tile && tile.offsetParent !== null ? tile : null)
          ?? wheelMount.querySelector<HTMLElement>(`[data-be-widx="${idx}"]`);
        if (anchor) bedit.swatchEditor.openEditor(idx, anchor);
      },
      onAdd: (seed) => {
        const path = addSwatch(bedit.doc, 'custom', t('New swatch'), oklchHex(seed));
        if (path) setSwatchValue(bedit.doc, path, oklchToStored(seed)); // sit exactly where dropped
        bedit.ramps.repaintPalette(); bedit.state.persist(true);
        const idx = path ? bedit.swatches.findIndex(s => s.path.length === path.length && s.path.every((seg, i) => seg === path[i])) : -1;
        bedit.swatchEditor.openSwatchAt(path, idx >= 0 ? wheelMount.querySelector<HTMLElement>(`[data-be-widx="${idx}"]`) : null);
      },
    });
  };
  cleanups.push(() => bedit.wheelTeardown?.());

  // ── The gamut chart ────────────────────────────────────────────────────────
  // A plane through OKLCH space with the sRGB / Display-P3 / Rec.2020 bands
  // drawn on it. The wheel shows what a palette IS; this shows what it can
  // still become - the sRGB boundary is a curve in lightness×chroma that moves
  // with hue, so it only becomes visible on a plane that has one of those as a
  // real axis. Same swatches, same drag/click/add gestures, same persist path.

  /** The range the fixed-channel slider covers, per plane. */
  const FIXED_RANGE: Record<SlicePlane, { min: number; max: number; step: number }> = {
    lc: { min: 0, max: 359, step: 1 },        // hue°
    ch: { min: 0, max: 1, step: 0.01 },       // lightness
    // Chroma - the same ceiling the chart's own axis uses, so the slider cannot
    // ask for a slice the plot has no room to show.
    lh: { min: 0, max: sliceCMax(sliceState), step: 0.005 },
  }; bedit.FIXED_RANGE = FIXED_RANGE;
  const FIXED_LABEL: Record<SlicePlane, string> = {
    lc: t('Hue'), ch: t('Lightness'), lh: t('Chroma'),
  }; bedit.FIXED_LABEL = FIXED_LABEL;
}

export function wireGamutChart(bedit: BrandEditorCtx): void {
  const { FIXED_LABEL, FIXED_RANGE, cleanups, editorChip, palMount, sliceMount, sliceState } = bedit;
  cleanups.push(() => { if (bedit.sliceFrame) cancelAnimationFrame(bedit.sliceFrame); });

  bedit.paintSlices = (): void => {
    if (!sliceMount || bedit.chartView !== 'slices') return;
    const axes = SLICE_AXES[sliceState.plane];
    const range = FIXED_RANGE[sliceState.plane];
    sliceMount.innerHTML = `
      <div class="be-slice-ctl">
        ${segHtml('sliceplane', [
          { id: 'lc', label: t('L × C') },
          { id: 'ch', label: t('C × H') },
          { id: 'lh', label: t('L × H') },
        ], sliceState.plane, t('Slice plane'), { attr: 'data-be-plane', extraClass: 'be-sliceplane' })}
        <label class="be-slice-fixed">
          <span class="be-slice-fixed-label">${escapeText(FIXED_LABEL[sliceState.plane])}</span>
          <input type="range" class="be-slice-range" data-be-slice-fixed
            min="${range.min}" max="${range.max}" step="${range.step}" value="${sliceState.fixed}"
            aria-label="${escapeText(FIXED_LABEL[sliceState.plane])}">
          <output class="be-slice-fixed-val" data-be-slice-out>${escapeText(formatFixed(sliceState.plane, sliceState.fixed))}</output>
        </label>
      </div>
      ${renderSliceChart(sliceState, bedit.grid.sliceDots(), { editable: true })}
      <p class="be-wheel-hint">${t('Colour inside the bright region is displayable everywhere; the drained bands need a Display-P3 or Rec.2020 screen, and the checkerboard is beyond every display. The solid line is the sRGB edge, the dashed one Display-P3. Drag a dot to recolour · click to edit · click empty space to add.')}</p>`;

    bedit.sliceTeardown?.();
    const teardowns: Array<() => void> = [];

    teardowns.push(wireSliceChart(sliceMount, {
      stateOf: () => sliceState,
      hexOf: (idx) => bedit.swatches[idx]?.hex ?? '#888888',
      onRecolor: (idx, o) => {
        const cur = bedit.swatches[idx]; if (!cur) return;
        // Same storage-notation contract as the wheel: an LCH swatch keeps the
        // exact oklch(), a hex/rgb/hsl one keeps its own notation.
        const fmt = storageFormatOf(cur.raw);
        const hex = oklchHex(o);
        const stored = fmt === 'lch' ? oklchToStored(o) : serializeColor(hex, fmt);
        setSwatchValue(bedit.doc, cur.path, stored);
        cur.raw = stored; cur.hex = hex;
        updateSliceDot(sliceMount, idx, hex, sliceState);
        bedit.grid.liveTile(idx, hex);
        if (bedit.selected === idx && editorChip) editorChip.style.setProperty('--sw', hex);
      },
      onCommit: () => bedit.state.persist(),
      onPick: (idx) => {
        // Clicking an off-plane dot brings the SLICE to the colour rather than
        // the colour to the slice - the palette is what's being read here, and
        // silently rotating a swatch's hue to match the chart would be the
        // chart editing something the user only pointed at.
        const s = bedit.swatches[idx];
        if (s) {
          const o = hexToOklch(s.hex);
          if (o) {
            const want = sliceFixedOf(sliceState.plane, o);
            if (Math.abs(want - sliceState.fixed) > (axes.fixed === 'h' ? 0.5 : 0.005)) {
              sliceState.fixed = want;
              bedit.paintSlices();
              return; // the re-render replaced the dot; let the user click again to edit
            }
          }
        }
        const tile = palMount?.querySelector<HTMLElement>(`[data-be-tile="${idx}"]`);
        const anchor = (tile && tile.offsetParent !== null ? tile : null)
          ?? sliceMount.querySelector<HTMLElement>(`[data-okls-idx="${idx}"]`);
        if (anchor) bedit.swatchEditor.openEditor(idx, anchor);
      },
      onAdd: (seed) => {
        const path = addSwatch(bedit.doc, 'custom', t('New swatch'), oklchHex(seed));
        if (path) setSwatchValue(bedit.doc, path, oklchToStored(seed));
        bedit.ramps.repaintPalette(); bedit.state.persist(true);
        const idx = path ? bedit.swatches.findIndex(s => s.path.length === path.length && s.path.every((seg, i) => seg === path[i])) : -1;
        bedit.swatchEditor.openSwatchAt(path, idx >= 0 ? sliceMount.querySelector<HTMLElement>(`[data-okls-idx="${idx}"]`) : null);
      },
    }));

    // Plane switch: a full re-render, since the axes, ticks and slider range all
    // change. Carry the fixed value across by reading it off the palette's
    // primary, so the new plane opens somewhere useful rather than at zero.
    const planeSeg = sliceMount.querySelector<HTMLElement>('[data-be-seg="sliceplane"]');
    if (planeSeg) {
      const onPlane = (e: Event): void => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-val]'); if (!btn) return;
        const next = btn.dataset.val as SlicePlane;
        if (next === sliceState.plane) return;
        sliceState.plane = next;
        const anchorHex = bedit.swatches.find(s => (hexToOklch(s.hex)?.c ?? 0) > 0.02)?.hex ?? bedit.swatches[0]?.hex;
        const o = anchorHex ? hexToOklch(anchorHex) : null;
        sliceState.fixed = o ? sliceFixedOf(next, o) : FIXED_RANGE[next].min;
        bedit.paintSlices();
      };
      planeSeg.addEventListener('click', onPlane);
      teardowns.push(() => planeSeg.removeEventListener('click', onPlane));
    }

    const fixedInput = sliceMount.querySelector<HTMLInputElement>('[data-be-slice-fixed]');
    const fixedOut = sliceMount.querySelector<HTMLElement>('[data-be-slice-out]');
    if (fixedInput) {
      const onInput = (): void => {
        sliceState.fixed = Number(fixedInput.value);
        if (fixedOut) fixedOut.textContent = formatFixed(sliceState.plane, sliceState.fixed);
        bedit.grid.refreshSliceDots();
        bedit.grid.schedulePaint('draft');
      };
      // `change` fires when the scrub ends (and on a keyboard step) - the moment
      // to spend the full-resolution repaint.
      const onChange = (): void => { onInput(); bedit.grid.schedulePaint('full'); };
      fixedInput.addEventListener('input', onInput);
      fixedInput.addEventListener('change', onChange);
      teardowns.push(() => {
        fixedInput.removeEventListener('input', onInput);
        fixedInput.removeEventListener('change', onChange);
      });
    }

    // The plot's box is set by the pane width, which the split divider can drag.
    const plot = sliceMount.querySelector<HTMLElement>('[data-okls-plot]');
    if (plot && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => bedit.grid.schedulePaint('full'));
      ro.observe(plot);
      teardowns.push(() => ro.disconnect());
    }

    bedit.sliceTeardown = () => { for (const fn of teardowns) fn(); };
    paintSliceChart(sliceMount, sliceState, { quality: 'full' });
  };
  cleanups.push(() => bedit.sliceTeardown?.());

  // The Colour chart card folds closed by default, and a hidden mount measures
  // 0×0 - repaint the moment the card opens so the first reveal (and any palette
  // change that happened while it was folded) renders true.
  const chartDetails = bedit.ramps.$('[data-be-chart]') as HTMLDetailsElement | null; bedit.chartDetails = chartDetails;
}

export function wireChartDetails(bedit: BrandEditorCtx): void {
  const { chartDetails, sliceMount, sliceState, wheelMount } = bedit;
  chartDetails?.addEventListener('toggle', () => { if (chartDetails.open) bedit.grid.paintChart(); });

  // Wheel ⇄ Gamut. Only the visible chart is mounted: the hidden one would
  // measure 0×0 and paint nothing, and leaving three engine slices' worth of
  // work wired up behind a `hidden` attribute is exactly the kind of cost that
  // never shows up in a profile until the pane is resized.
  const chartSeg = bedit.ramps.$('[data-be-seg="chartview"]') as HTMLElement | null; bedit.chartSeg = chartSeg;
  chartSeg?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-val]'); if (!btn) return;
    const next = btn.dataset.val === 'slices' ? 'slices' : 'wheel';
    if (next === bedit.chartView) return;
    bedit.chartView = next;
    chartSeg.querySelectorAll<HTMLElement>('[data-val]').forEach(b => { b.setAttribute('aria-pressed', String(b === btn)); });
    if (wheelMount) wheelMount.hidden = bedit.chartView !== 'wheel';
    if (sliceMount) sliceMount.hidden = bedit.chartView !== 'slices';
    if (bedit.chartView === 'wheel') {
      bedit.sliceTeardown?.(); bedit.sliceTeardown = undefined;
      if (sliceMount) sliceMount.innerHTML = '';
      bedit.paintWheel();
    } else {
      // Seed the plane's fixed channel from the palette's first chromatic
      // colour, so the first switch opens on the brand rather than on hue 30.
      const anchorHex = bedit.swatches.find(s => (hexToOklch(s.hex)?.c ?? 0) > 0.02)?.hex ?? bedit.swatches[0]?.hex;
      const o = anchorHex ? hexToOklch(anchorHex) : null;
      if (o) sliceState.fixed = sliceFixedOf(sliceState.plane, o);
      bedit.paintSlices();
    }
  });

  // ── The post-add chip (plan 137 C1) ─────────────────────────────────────────
  // Adding one colour used to open the full swatch editor on the new tile: the
  // deepest surface in the room as the answer to its shallowest action, and the
  // first thing a first-run visitor met. The chip confirms the colour instead
  // and offers the two things worth doing next - give it the primary role, or
  // open that same editor deliberately. Nothing about the multi-paste chips
  // changes; several colours at once are still announced and nothing else.
  const addedEl = bedit.ramps.$('[data-be-added]') as HTMLElement | null; bedit.addedEl = addedEl;
  const addedSw = addedEl?.querySelector<HTMLElement>('[data-be-added-sw]') ?? null; bedit.addedSw = addedSw;
  const addedNameEl = addedEl?.querySelector<HTMLElement>('[data-be-added-name]') ?? null; bedit.addedNameEl = addedNameEl;
  const addedPrimaryBtn = addedEl?.querySelector<HTMLButtonElement>('[data-be-added-primary]') ?? null; bedit.addedPrimaryBtn = addedPrimaryBtn;
  const addedTuneBtn = addedEl?.querySelector<HTMLButtonElement>('[data-be-added-tune]') ?? null; bedit.addedTuneBtn = addedTuneBtn;
  /** The swatch the visible chip describes, or null when no chip is showing. */
  bedit.addedSwatch = null;
}

export function gridOps(bedit: BrandEditorCtx) {
  return {
    gridColumns: bindOp(bedit, gridColumns),
    paletteSelectKey: bindOp(bedit, paletteSelectKey),
    channelValueStr: bindOp(bedit, channelValueStr),
    nudgeFmtOf: bindOp(bedit, nudgeFmtOf),
    copyTileText: bindOp(bedit, copyTileText),
    onDocPointer: bindOp(bedit, onDocPointer),
    onKey: bindOp(bedit, onKey),
    onAnchorScroll: bindOp(bedit, onAnchorScroll),
    liveTile: bindOp(bedit, liveTile),
    swatchOklch: bindOp(bedit, swatchOklch),
    sliceDots: bindOp(bedit, sliceDots),
    refreshSliceDots: bindOp(bedit, refreshSliceDots),
    schedulePaint: bindOp(bedit, schedulePaint),
    paintChart: bindOp(bedit, paintChart),
    wirePaletteKeys: bindOp(bedit, wirePaletteKeys),
    wireWheel: bindOp(bedit, wireWheel),
    wireGamutChart: bindOp(bedit, wireGamutChart),
    wireChartDetails: bindOp(bedit, wireChartDetails),
  };
}
