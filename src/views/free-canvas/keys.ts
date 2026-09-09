// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: context bar placement, small formatters, keyboard handling and stage pointer moves.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `fc.<module>.<fn>`. Extracted verbatim
 * from initFreeCanvas() by scripts/split-closure.ts.
 */
import { boxRect, moveBoxes } from '../free-canvas-math.ts';
import type { Box } from '../free-canvas-math.ts';
import { announce } from '../../a11y.ts';
import { escape as escapeText } from '../../utils.ts';
import { deepActiveElement, isTypingTarget } from '../../lib/typing-target.ts';
import { t } from '../../i18n.ts';
import { centreCtxBar, ctxTopBand, stageBlockers } from './shared.ts';
import type { Metrics, Rect, StageBox } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

export function ctxBarBlockers(fc: FcCtx, sr: DOMRect): StageBox[] {
  const { stageEl, toolbarDock } = fc;
  if (fc.ctxBlockers && fc.gesture) return fc.ctxBlockers;
  // .chrome-topleft, not just its .tools-home pill: the island can also carry the
  // Home fab beside the pill, and the ctx bar must dodge the whole cluster.
  //
  // The LEFT SIDEBAR is on that list too (plans/179 M4): `.fc-nav` is the navigator
  // column - open, or collapsed to its dot rail - and while it is open the tool rail is
  // a grid inside it, so one rect covers both. The rail's own dock joins them only
  // while the TIMELINE has made it a full-height column; a floating rail is vertically
  // centred and nowhere near this row, so counting it would push the bar sideways for
  // chrome that is not actually in the way.
  const out = stageBlockers(
    [
      stageEl.querySelector<HTMLElement>('.stage-nav'),
      stageEl.querySelector<HTMLElement>('.fc-nav'),
      fc.railMode === 'timeline' ? toolbarDock : null,
      ...Array.from(document.querySelectorAll<HTMLElement>('.chrome-topleft, .tools-home')),
    ],
    sr
  );
  fc.ctxBlockers = fc.gesture ? out : null;
  return out;
}
export function positionCtxBar(fc: FcCtx, 
  boxes: Box[],
  idx: number[],
  liveRects: Map<number, Rect> | null,
  m: Metrics
): void {
  const { cfg, ctxbar } = fc;
  if (fc.editing) {
    fc.rail.hideCtxBar();
    return;
  } // hidden while typing in a box
  fc.rail.showCtxBar();
  // Pinned to the top chrome row (never over the selection, whose artwork the user is
  // looking at), centred in the band between the back pill and the zoom HUD and capped
  // to it - a bar too wide for a narrow phone row scrolls inside that width (see the
  // `.fc-ctxbar` overflow) instead of dropping down over the canvas.
  const band = ctxTopBand({ w: m.sr.width, h: m.sr.height }, ctxBarBlockers(fc, m.sr), {
    reserve: fc.contextBar.stageReserves(),
  });
  ctxbar.style.maxWidth = Math.max(0, band.hi - band.lo) + 'px';
  // Measured AFTER the bar is shown and its max-width is set, so `offsetWidth` reflects
  // a laid-out, capped bar rather than the zero a `hidden` element reports. A zero here
  // would paint the first frame off-centre and then snap; leave the last position alone
  // and come back next frame instead.
  const bw = ctxbar.offsetWidth || 0;
  if (bw > 0) {
    // Frozen for the life of a box gesture: the transform readout grows mid-drag
    // ("241, -235" → "113, -92 · 1920×1080"), which would re-centre the bar and walk
    // its controls sideways. It re-places on release; the readout itself keeps updating.
    const pos = liveRects && fc.ctxFrozen ? fc.ctxFrozen : centreCtxBar(bw, band);
    fc.ctxFrozen = liveRects ? pos : null;
    ctxbar.style.left = pos.left + 'px';
    ctxbar.style.top = pos.top + 'px';
  }
  // Transform readout.
  const first = boxes[idx[0]!];
  const r = liveRects?.get(idx[0]!) || boxRect(first, cfg);
  const read = ctxbar.querySelector('[data-cx-readout]');
  if (read)
    read.textContent =
      idx.length > 1
        ? t('{n} selected', { n: idx.length })
        : `${Math.round(r.x)}, ${Math.round(r.y)}  ·  ${Math.round(r.w)}×${Math.round(r.h)}${r.rot ? '  ·  ' + Math.round(r.rot) + '°' : ''}`;
}
export function updateToolbarState(fc: FcCtx, _count: number): void {
  // Nothing hard-disabled - align-to-canvas works on a single box; arrange/delete
  // no-op when empty. Just reflect which tool is live, and whether the layout
  // options have anything to act on.
  fc.modes.syncModeUI();
  syncArrangeUI(fc);
}
/** The Arrange button is layout options for a SELECTION - no selection, no button.
 *  Hidden rather than disabled: an always-there control whose whole menu no-ops is
 *  what made "arrange" read as broken. Nothing else reaches these actions through
 *  it (right-click and the keyboard are unchanged), so hiding it removes no path. */
export function syncArrangeUI(fc: FcCtx): void {
  if (fc.arrangeBtn) fc.arrangeBtn.hidden = fc.selection.size === 0;
}
// ── helpers ───────────────────────────────────────────────────────────────────
export const rectAsBox = (fc: FcCtx, r: Rect): Box => { const { cfg } = fc; return ({
  [cfg.xField]: r.x,
  [cfg.yField]: r.y,
  [cfg.wField]: r.w,
  [cfg.hField]: r.h,
  [cfg.rotationField]: r.rot,
}); };
export function rotOf(_fc: FcCtx, el: HTMLElement): number {
  const t = el.style.transform || '';
  const mm = t.match(/rotate\(([-0-9.]+)deg\)/);
  return mm ? parseFloat(mm[1]!) : 0;
}
export function normHex(_fc: FcCtx, v: any, fallback = '#ffffff'): string {
  const s = String(v == null ? '' : v).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s))
    return ('#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toLowerCase();
  return fallback;
}
export function cssEscape(_fc: FcCtx, s: any): string {
  return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&');
}
// Finite number clamped to [lo,hi], or the default when not a number.
export function clampN(_fc: FcCtx, v: any, dflt: number, lo: number, hi: number): number {
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (!Number.isFinite(n)) return dflt;
  return n < lo ? lo : n > hi ? hi : n;
}
// Delegates to the canonical 5-char escape (utils.ts) - this used to hand-roll a 4-char
// (no `'`) escape, safe only by accident of every call site using double-quoted attrs.
export function escapeHtml(_fc: FcCtx, s: any): string {
  return escapeText(s);
}
export function fmtDate(_fc: FcCtx, iso: any): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return String(iso);
  }
}
// ── keyboard ─────────────────────────────────────────────────────────────────
// Shadow-aware: jelly text fields keep their real <input> in a shadow root, so a
// host-only tagName test reads as "not typing" and shortcuts eat the keystroke.
export function typingTarget(_fc: FcCtx): boolean {
  return isTypingTarget();
}
// Keyboard focus on a card selects it, so Tab / Shift-Tab cycle the cards and the onKey
// actions (Delete, arrows, duplicate, group…) apply. Pointer focus is ignored here -
// pointerdown already owns pointer selection (and would clobber shift-click multi-select).
export function onBoxFocus(fc: FcCtx, e: FocusEvent): void {
  if (fc.gesture || fc.editing) return;
  const el = (e.target as HTMLElement | null)?.closest?.(
    '.lolly-box[data-box-id]'
  ) as HTMLElement | null;
  if (!el?.matches(':focus-visible')) return;
  const id = el.getAttribute('data-box-id');
  if (!id || (fc.selection.size === 1 && fc.selection.has(id))) return;
  fc.selection = new Set([id]);
  fc.chromeSync.renderChrome();
}
/**
 * Does this press CHANGE the selected boxes? The keyboard half of the one rule gates
 * on exactly this set and nothing else, so navigation (Tab, ⌘A, the tool letters) and
 * every escape route stay live on an off-playhead selection.
 *
 * The list mirrors onKey's own mutating branches below: arrow nudge, delete, the
 * text-edit entry (Enter/F2 - starting a text edit on a box nobody can see is the
 * same mistake in slow motion), duplicate, group/ungroup, and z-order.
 */
export function isMutatingKey(_fc: FcCtx, e: KeyboardEvent): boolean {
  const k = e.key;
  // Alt+←/→ is the seek chord the nudge branch below declines - it edits nothing, so it
  // must not be answered with "this card is not on screen". Alt+↑/↓ is NOT that chord
  // and nudges like any other arrow, so it is a mutating press (this used to decline all
  // four, which made Alt+↑/↓ a key that did nothing anywhere).
  if (k === 'ArrowLeft' || k === 'ArrowRight') return !e.altKey;
  if (k === 'ArrowUp' || k === 'ArrowDown') return true;
  if (k === 'Delete' || k === 'Backspace') return true;
  if (k === 'Enter' || k === 'F2') return true;
  if (!(e.metaKey || e.ctrlKey)) return false;
  return k === 'x' || k === 'X' || k === 'd' || k === 'D' || k === 'g' || k === 'G'
    || k === ']' || k === '[' || (e.altKey && (k === 'v' || k === 'V'));
}
/**
 * Chrome that puts focusable controls over the canvas opts out of the canvas keyboard
 * by marking its own root `data-canvas-keys="off"`: the Design top bar, the right edge
 * dock column, the navigator column. The verbs in `onKey` are bound on `window`, so
 * without this a focused button in one of those roots was a live canvas surface -
 * Delete on the Export button removed the selection, an arrow key in a menu nudged a
 * box. One attribute check covers every such root, rather than a growing class list.
 *
 * The event target AND the deep active element are both tested: a pointer-focused
 * button is the target, while a jelly text field keeps its real input in a shadow root
 * (the event retargets to the host, which is what `closest` can walk).
 *
 * The two exemptions are the ones those roots already make by hand where they stop
 * their own keys (`onRootKey` in design-topbar.ts and design-navigator.ts), so the
 * attribute says the same thing rather than something stricter: app-wide chords carry
 * meta/ctrl and mean the same wherever focus is, and Escape is how you leave a mode,
 * a draft or a selection, so it belongs to the ladder below from anywhere.
 *
 * The NEAREST marked ancestor decides, so a surface inside one of those roots can say
 * `data-canvas-keys="on"` and get the canvas keys back. The tool rail needs exactly
 * that: it is a canvas palette that free-canvas parks inside the navigator column while
 * that column is open, and without the opt-back-in `v` armed the pointer tool from a
 * floating rail and did nothing from a docked one - the same button, two meanings.
 */
export function chromeKeysOff(_fc: FcCtx, e: KeyboardEvent): boolean {
  if (e.metaKey || e.ctrlKey || e.key === 'Escape') return false;
  const off = (el: HTMLElement | null): boolean =>
    el?.closest?.('[data-canvas-keys]')?.getAttribute('data-canvas-keys') === 'off';
  if (off(e.target as HTMLElement | null)) return true;
  return off(deepActiveElement() as HTMLElement | null);
}
export function onKey(fc: FcCtx, e: KeyboardEvent): void {
  const { NO_TEXT_KINDS, canFlip, cfg, designChrome, stageEl, timeCfg } = fc;
  if (fc.disposed || document.querySelector('dialog[open]')) return;
  // The timeline panel binds its keys on its OWN root and owns them while focus is
  // inside it (deck-editor's `.deck-strip, .deck-bar…` bail). Without this, Delete /
  // arrows / ⌘A / Enter typed at a clip would also hit the canvas selection.
  if (fc.timelinePanel && (document.activeElement as HTMLElement | null)?.closest?.('.tl-panel'))
    return;
  if (chromeKeysOff(fc, e)) return;
  // ── Escape: ONE ladder, innermost rung first, one rung per press ───────────
  // Escape is exempt from the typing bail below on purpose: it is how you get out of a
  // text edit too (onEditKey owns that and stops here).
  //
  // The rule that matters is that a rung only swallows the key if it actually DID
  // something. The old first rung returned on a merely non-null `popover` / `morePanel`
  // reference, so a reference left pointing at a detached element silently ate the next
  // Escape - the reported "Esc does not leave point editing". A floating surface that is
  // no longer in the document is not a rung.
  if (e.key === 'Escape') {
    // Rung 1 stays the colour popover - it is the innermost surface, and it can be
    // open over the gradient panel while picking a stop's brand swatch.
    if (stageEl.querySelector('.color-popover:not([hidden])') && fc.document.dismissFloating()) {
      e.preventDefault();
      return;
    }
    // Gradient editing is a MODE like point editing, and its panel is part of it:
    // closing just the panel left the handles up with no way back to it (the toolbar
    // button now reads as "leave"), so Escape takes the whole mode.
    if (fc.gradEdit != null) {
      e.preventDefault();
      fc.document.closeMorePanel();
      fc.gradient.exitGradEdit();
      return;
    }
    if (fc.document.dismissFloating()) {
      e.preventDefault();
      return;
    }
    // Cancel, not commit: a draft dies here and Enter (or a tool switch) is what keeps it.
    if (fc.penDraft) {
      e.preventDefault();
      fc.penTool.penCancelDraw();
      return;
    }
    // Point editing ends and the rail is already the pointer, since it never left it.
    if (fc.penEdit) {
      e.preventDefault();
      fc.penTool.endPenEdit();
      return;
    }
    if (fc.mode !== 'select') {
      e.preventDefault();
      fc.modes.toPointer('discard');
      return;
    }
    if (fc.selectedEdges.size) {
      e.preventDefault();
      fc.edges.deselectEdge();
      return;
    }
    if (fc.selection.size) {
      e.preventDefault();
      fc.selection = new Set<string>();
      fc.chromeSync.renderChrome();
      return;
    }
    return; // nothing left to back out of - leave the key alone
  }
  // ── the pen's other keys ───────────────────────────────────────────────────
  // Each already means something on a box, so the pen takes them only while it is
  // actually on, and hands them straight back when it is not. The split follows the
  // meanings already in this handler rather than redefining them:
  //   Enter - "commit the thing you are in the middle of", as it commits a text edit;
  //             it finishes the drawn path and leaves point editing.
  //   Delete/Backspace - "remove what is selected", so it drops the last placed node
  //             while drawing and the selected nodes while editing, never the box.
  if ((fc.penDraft || fc.penEdit) && !typingTarget(fc)) {
    if (fc.penDraft) {
      if (e.key === 'Enter') {
        e.preventDefault();
        fc.penTool.penFinishDraw();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        fc.penTool.penUndoNode();
        return;
      }
    } else if (fc.penEdit) {
      if (e.key === 'Enter') {
        e.preventDefault();
        fc.penTool.endPenEdit();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && fc.penSel.size) {
        e.preventDefault();
        fc.penTool.penDeleteSelected();
        return;
      }
      if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        fc.penSel = new Set(fc.penEdit.path.nodes.map((_, i) => i));
        fc.ctxSelKey = null;
        fc.chromeSync.renderChrome();
        return;
      }
    }
  }
  if (typingTarget(fc)) return;
  // The canvas-wide sheet. A focused timeline returns at the top of this handler and
  // keeps its own detailed `?` inventory; every other Design surface gets this one.
  if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey && designChrome) {
    e.preventDefault();
    fc.select.showShortcuts(document.activeElement as HTMLElement | null);
    return;
  }
  if (
    fc.authoringGuides &&
    e.shiftKey &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.altKey &&
    (e.key === 'r' || e.key === 'R')
  ) {
    e.preventDefault();
    fc.stage.setGuidesVisible(!fc.authoringGuides.isVisible());
    return;
  }
  // ── THE ONE RULE, enforcement point 3 of 3: KEYBOARD ────────────────────────
  // Chrome suppression closes every POINTER path onto an off-playhead box; a nudge,
  // a Delete or a duplicate needs no chrome at all. Navigation stays live on purpose
  // - Tab still moves, Escape (handled above, before this gate) still deselects, and
  // ⌘A still selects all - because the way out of this state must never be blocked.
  if (timeCfg && fc.selection.size && isMutatingKey(fc, e) && !fc.select.selectionLive(fc.select.getBoxes())) {
    e.preventDefault();
    announce(t('This card is not on screen at the playhead. Go to it to edit it.'));
    return;
  }
  // Standard copy/paste-properties chord (Figma/Sketch): the in-memory snapshot means
  // clipboard permission can never make the operation flaky. Copy is a read; Paste is
  // covered by the off-playhead mutation gate immediately above.
  if ((e.metaKey || e.ctrlKey) && e.altKey && !e.shiftKey) {
    if ((e.key === 'c' || e.key === 'C') && fc.selection.size) {
      e.preventDefault();
      fc.modes.copySelectionStyle();
      return;
    }
    if ((e.key === 'v' || e.key === 'V') && fc.selection.size && fc.styleClipboard) {
      e.preventDefault();
      fc.modes.pasteSelectionStyle();
      return;
    }
  }
  // Flip the selection: Shift+H mirrors horizontally, Shift+V vertically (Figma/Sketch's
  // keys). Shift-qualified deliberately - bare V is already the Pointer tool below (the
  // Illustrator convention), so bare V would hijack it, and the pair stays symmetric behind
  // one modifier. Checked BEFORE the V/P tool letters so Shift+V flips rather than arming the
  // pointer; it falls through to the pointer when nothing is selected or the tool has no flip
  // field, so that path is untouched. After `typingTarget()` above, so a field/text edit
  // types the letter instead. Cmd/Ctrl/Alt variants are left alone.
  if (
    e.shiftKey &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.altKey &&
    canFlip &&
    fc.selection.size &&
    (e.key === 'h' || e.key === 'H' || e.key === 'v' || e.key === 'V')
  ) {
    e.preventDefault();
    fc.objects.applyFlip(e.key === 'v' || e.key === 'V' ? 'v' : 'h');
    return;
  }
  // Tool shortcuts, the Illustrator/Figma letters: V pointer, P pen. Unmodified only -
  // ⌘V is paste and ⌘P is print - and after `typingTarget()`, so a live text edit or any
  // focused field gets the letter typed into it instead. Neither letter meant anything
  // here before (the only unmodified keys taken are Escape/Enter/F2/Delete/arrows, and
  // tool-stage-nav's 0/1/+/-).
  if (!e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'v' || e.key === 'V')) {
    e.preventDefault();
    fc.modes.pickPointer();
    return;
  }
  if (
    !e.metaKey &&
    !e.ctrlKey &&
    !e.altKey &&
    (e.key === 'p' || e.key === 'P') &&
    cfg.pathField
  ) {
    e.preventDefault();
    if (fc.mode !== 'pen') fc.modes.setMode('pen');
    return;
  }
  // N - the Node tool (Inkscape's key). Toggles direct node editing on the selection.
  if (
    !e.metaKey &&
    !e.ctrlKey &&
    !e.altKey &&
    (e.key === 'n' || e.key === 'N') &&
    cfg.pathField
  ) {
    e.preventDefault();
    fc.modes.toggleNodeTool();
    return;
  }
  // Enter / F2 on a selected box → edit its text (select-all so typing replaces it).
  // On a kind with no text node - an artboard, an audio bed, a camera marker -
  // `startTextEdit` returns on the missing node and nothing at all happens, which is
  // the silent no-op plan 179 C3 refuses. The object bar hides its pencil for those
  // kinds; the keyboard has no such affordance, so it says why instead.
  // Cmd/Ctrl+Return is the tool view's Present shortcut (plans/179 M1 section 4), so a
  // held modifier is NOT a request to edit text here - it belongs to the document.
  if (
    (e.key === 'Enter' || e.key === 'F2') &&
    !(e.key === 'Enter' && (e.metaKey || e.ctrlKey)) &&
    !fc.editing &&
    fc.selection.size &&
    cfg.textField
  ) {
    e.preventDefault();
    const rows = fc.select.getBoxes();
    const first = [...fc.selection][0]!;
    const at = rows.findIndex((b, n) => fc.select.idOf(b, n) === first);
    const k = at >= 0 ? fc.contextBar.kindOf(rows[at]) : '';
    if (NO_TEXT_KINDS.has(k)) {
      announce(t('This object has no text to edit.'));
      return;
    }
    fc.textEdit.startTextEdit(first, { selectAll: e.key === 'Enter' });
    return;
  }
  // In gradient mode the selected thing is a STOP, so Delete removes that - deleting
  // the whole card here would be a nasty surprise mid-gradient. Falls through when the
  // gradient is down to its last two stops (deleteGradStop refuses and says so).
  if ((e.key === 'Delete' || e.key === 'Backspace') && fc.gradEdit != null) {
    e.preventDefault();
    if (!fc.gradient.deleteGradStop()) announce(t('A gradient needs at least two stops.'));
    return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && fc.selectedEdges.size) {
    e.preventDefault();
    fc.edges.deleteSelectedEdge();
    return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && fc.selection.size) {
    e.preventDefault();
    fc.ops.deleteSelection();
    return;
  }
  if ((e.key === 'd' || e.key === 'D') && (e.metaKey || e.ctrlKey) && fc.selection.size) {
    e.preventDefault();
    fc.ops.duplicateSelection();
    return;
  }
  if ((e.key === 'g' || e.key === 'G') && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    e.shiftKey ? fc.objects.ungroupSelection() : fc.objects.groupSelection();
    return;
  }
  // Stacking order (Illustrator/Figma convention): Cmd/Ctrl + ] forward, + [ back;
  // add Shift to jump all the way to front / back. (Undo/redo is handled globally
  // by tool.js's onHistoryKey - Cmd+Z / Cmd+Shift+Z / Cmd+Y - and reaches the editor
  // because every edit commits through runtime.setInput, which the undo wrapper
  // records; nothing extra is needed here.)
  if ((e.key === ']' || e.key === '[') && (e.metaKey || e.ctrlKey) && fc.selection.size) {
    e.preventDefault();
    if (e.key === ']') fc.objects.applyZ(e.shiftKey ? 'front' : 'forward');
    else fc.objects.applyZ(e.shiftKey ? 'back' : 'backward');
    return;
  }
  if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    const boxes = fc.select.getBoxes();
    fc.selection = new Set(boxes.map((b, i) => fc.select.idOf(b, i)));
    fc.chromeSync.renderChrome();
    return;
  }
  // Arrow-nudge (Shift = 10px). Alt+←/→ is RESERVED, and only that pair: it is the
  // timeline panel's keyframe walk (plans/104 section 8, and section 9.2 records the decline as "the
  // seek chord"), so the chord means one thing in this editor rather than seeking in
  // the panel and nudging on the canvas. It is a reservation, not a collision: the panel
  // binds its keys on its OWN root, this handler is on `window` and bails outright while
  // focus is inside `.tl-panel`, so the two never race for the same press - the chord is
  // simply panel-focus-scoped, like `k`/`s`/`e`. Alt+↑/↓ is NOT that chord: declining it
  // too (as this once did) bought nothing and left a key that did nothing anywhere, so it
  // nudges like any other arrow.
  const nudges: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  const altSeek = e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight');
  if (nudges[e.key] && fc.selection.size && !altSeek) {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    const [ux, uy] = nudges[e.key]!;
    const boxes = fc.select.getBoxes();
    // Same containment+cascade path as the pointer-drag move (see g.type === 'move'):
    // nudging a frame-kind box must carry its members in the SAME commit, and any box
    // whose centre crosses a frame edge must re-bucket. cascadeFrameChildren + assignFrames
    // over the selected indices only - no-op on frameless tools (Design), so a
    // no-frame nudge stays byte-identical to the old moveBoxes-only path.
    const idx = fc.select.selIndices(boxes);
    // …and the SAME playhead-contextual split, for the same reason (plans/104 section 8).
    // The nudge is the keyboard equivalent of the drag: on a diamond, dragging a box
    // poses the keyframe, so nudging it by the same pixel must pose it too - or the
    // accessible route silently gets the opposite model-write semantics from the
    // pointer one. One commit either way, so it stays one undo step.
    const kfIds = new Set(fc.timelinePanel?.kfPoseIds(idx.map((i) => fc.select.idOf(boxes[i], i))) ?? []);
    const moveIdx = idx.filter((i) => !kfIds.has(fc.select.idOf(boxes[i], i)));
    let next = moveIdx.length ? moveBoxes(boxes, moveIdx, ux * step, uy * step, cfg) : boxes;
    if (kfIds.size && fc.timelinePanel)
      next = fc.timelinePanel.kfPoseWrite(next, [...kfIds], { x: ux * step, y: uy * step });
    fc.select.commit(fc.select.assignFrames(fc.select.cascadeFrameChildren(boxes, next, moveIdx), new Set(moveIdx)));
  }
}
// Reposition chrome when the stage pans/zooms/resizes.
// Geometry changed (pan/zoom/resize) - invalidate the metrics cache and mark the
// frame scrim for repositioning (M2: paintChrome only moves the scrim when this is
// set, so drag/hover/selection syncs skip the 100vmax shadow repaint).
export const onStageMove = (fc: FcCtx, e: any): void => {
  const { connectLayer } = fc;
  fc.gestureMetrics = null;
  fc.ctxBlockers = null;
  fc.scrimDirty = true;
  if (e && typeof e.clientX === 'number') fc.lastPointer = { x: e.clientX, y: e.clientY };
  fc.chromeSync.scheduleSync();
  fc.rail.reclampRail();
  if (connectLayer.style.display !== 'none') fc.connectors.placeConnectLayer(fc.stage.metrics());
};
// pointermove fires continuously while the cursor merely HOVERS the canvas. The old
// handler rebuilt the whole selection chrome (2 getBoundingClientRect + innerHTML swap
// + 10 handle nodes re-bound) every frame for zero visual change. Here we only track
// the paste-at-cursor position; a real pan (buttons held) still re-syncs, and pan/zoom
// via the transform is already caught by the MutationObserver below - so an idle hover
// costs nothing.
export const onStagePointerMove = (fc: FcCtx, e: any): void => {
  const { connectCfg } = fc;
  if (e && typeof e.clientX === 'number') fc.lastPointer = { x: e.clientX, y: e.clientY };
  // Pen: the segment from the last placed node to the cursor, previewed live. Only while
  // no gesture is running - mid-drag the pointer is pulling a handle, not proposing a
  // node. Works for `pointerType: 'touch'` too: a touch drag reports `buttons` while
  // down, so this only fires between taps and never fights stageNav's pan/pinch.
  if (
    fc.mode === 'pen' &&
    fc.penDraft &&
    !fc.gesture &&
    e &&
    typeof e.clientX === 'number' &&
    !e.buttons
  ) {
    fc.penCursor = fc.stage.clientToNative(e.clientX, e.clientY);
    fc.penTool.paintPen();
    return;
  }
  // Hover affordance over connector lines (idle hover only, throttled to one rAF/frame).
  if (
    connectCfg &&
    !fc.selectedEdges.size &&
    !fc.gesture &&
    e &&
    !e.buttons &&
    typeof e.clientX === 'number'
  ) {
    if (!fc.hoverRaf) fc.hoverRaf = requestAnimationFrame(fc.edges.updateHover);
  }
  if (e?.buttons) fc.chromeSync.scheduleSync();
};
// A CSS transition that finishes inside the stage - the rail docking or undocking is the
// one that matters (plans/179 A10) - changes the layout with no resize, no wheel and no
// transform mutation, so nothing above catches it and the artboard label tabs stay where
// the pre-transition rect put them. One re-sync at transitionend glues them back.
// Narrowed twice over, because every rail button transitions its colour on hover and a
// chrome rebuild per hover would be a real cost: only a transition on the RAIL, and only
// of a property that can move something.
export const onStageTransitionEnd = (fc: FcCtx, e: Event): void => {
  const el = e.target as HTMLElement | null;
  if (!el?.closest?.('.fc-toolbar-dock')) return;
  const prop = (e as TransitionEvent).propertyName || '';
  if (!/^(left|top|right|bottom|width|height|transform|inset|margin|padding)/.test(prop)) return;
  fc.chromeSync.scheduleSync();
};
// Hide-controls full preview (Figma/Penpot `\`, and `/` - Andy, 2026-09-03): strip the
// editor chrome to a clean canvas so the artwork can be seen whole. Chrome-only - the
// render geometry and export are untouched. Escape always restores it, so a preview
// can never trap you. The hidden state also takes the chrome's SPACE back: editor.css
// zeroes the stage reserves and the dock width under the class, and since the fit
// reads computed values it only needs asking.
export const chromeRoot = (fc: FcCtx): HTMLElement | null => { const { stageEl } = fc; return stageEl.closest('.tool-view'); };
export const refitAfterChrome = (fc: FcCtx): void => {
  const { canvasEl } = fc;
  try {
    canvasEl.dispatchEvent(new Event('canvas-resize'));
  } catch {
    /* stage detached */
  }
};
export function onPreviewKey(fc: FcCtx, e: KeyboardEvent): void {
  if (e.defaultPrevented || document.querySelector('dialog[open]')) return;
  const l = chromeRoot(fc);
  if (!l) return;
  if (
    (e.key === '\\' || e.key === '/') &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.altKey &&
    !isTypingTarget(e.target as Element | null)
  ) {
    e.preventDefault();
    l.classList.toggle('is-chrome-hidden');
    refitAfterChrome(fc);
  } else if (e.key === 'Escape' && l.classList.contains('is-chrome-hidden')) {
    e.preventDefault();
    e.stopPropagation();
    l.classList.remove('is-chrome-hidden');
    refitAfterChrome(fc);
  }
}
// Dismiss popover / more-panel on outside click.
export const onDocDown = (fc: FcCtx, e: PointerEvent): void => {
  if (fc.popover && !fc.popover.contains(e.target as Node)) fc.toolbox.closePopover();
  // The colour popover is a companion of the panel, not an outside click: the whole
  // point of the gradient panel is to pick stop colours from the brand palette, and
  // closing the panel the moment you reached for a swatch made that a two-click
  // dance. `[data-cx="grad"]` is exempt for the same reason as `more`/`text` - the
  // button that opens a panel must not immediately close it.
  const t = e.target as HTMLElement;
  // Everything that IS the gradient-editing surface: the button that opens the panel,
  // the on-canvas handles, and the colour popover the panel sends you to for a brand
  // swatch. None of those are an "outside click" - treating the handles as one closed
  // the panel the instant you selected a stop.
  const companion = t.closest?.(
    '[data-cx="more"],[data-cx="text"],[data-cx="grad"],.color-popover,[data-color-field],.fc-grad-stop,.fc-grad-dir'
  );
  if (fc.morePanel && !fc.morePanel.contains(e.target as Node) && !companion) fc.document.closeMorePanel();
};
export function keysOps(fc: FcCtx) {
  return {
    ctxBarBlockers: bindOp(fc, ctxBarBlockers),
    positionCtxBar: bindOp(fc, positionCtxBar),
    updateToolbarState: bindOp(fc, updateToolbarState),
    syncArrangeUI: bindOp(fc, syncArrangeUI),
    rectAsBox: bindOp(fc, rectAsBox),
    rotOf: bindOp(fc, rotOf),
    normHex: bindOp(fc, normHex),
    cssEscape: bindOp(fc, cssEscape),
    clampN: bindOp(fc, clampN),
    escapeHtml: bindOp(fc, escapeHtml),
    fmtDate: bindOp(fc, fmtDate),
    typingTarget: bindOp(fc, typingTarget),
    onBoxFocus: bindOp(fc, onBoxFocus),
    isMutatingKey: bindOp(fc, isMutatingKey),
    chromeKeysOff: bindOp(fc, chromeKeysOff),
    onKey: bindOp(fc, onKey),
    onStageMove: bindOp(fc, onStageMove),
    onStagePointerMove: bindOp(fc, onStagePointerMove),
    onStageTransitionEnd: bindOp(fc, onStageTransitionEnd),
    chromeRoot: bindOp(fc, chromeRoot),
    refitAfterChrome: bindOp(fc, refitAfterChrome),
    onPreviewKey: bindOp(fc, onPreviewKey),
    onDocDown: bindOp(fc, onDocDown),
  };
}
