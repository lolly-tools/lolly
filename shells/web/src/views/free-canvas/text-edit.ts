// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: pasted text sources, in-place text editing and the formatting bar.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `fc.<module>.<fn>`. Extracted verbatim
 * from initFreeCanvas() by scripts/split-closure.ts.
 */
import { seedBox, selectionAABB } from '../free-canvas-math.ts';
import type { Box, Rect as MathRect } from '../free-canvas-math.ts';
import { escape as escapeText } from '../../utils.ts';
import { t } from '../../i18n.ts';
import { colorFieldHtml, wireColorField } from '../../components/color-field.ts';
import { allBulleted, allNumbered, charsFromDom, clearFormatting, htmlFromChars, markdownFromChars, rangeHasFlag, rangeWeight, setColor, setFlag, setWeight, toggleBullets, toggleNumbers, wordRangeAt } from '../rich-text.ts';
import { SVG, icon } from '../free-canvas-icons.ts';
import { FC_CLIP_PREFIX, H_JUSTIFY, V_ALIGN, boolOf, featureSettings } from './shared.ts';
import type { EditingState, FmtBar, FmtRefs } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

export function sourceFromPastedHtml(_fc: FcCtx, html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return markdownFromChars(charsFromDom(doc.body))
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+$/, '');
  } catch {
    return '';
  }
}
export function createTextBoxFromSource(fc: FcCtx, source: string): void {
  const { cfg } = fc;
  if (!cfg.textField) return;
  const kind = fc.modes.textAddKind();
  const seed: Box = { ...(kind?.seed) };
  seed[cfg.textField] = source;
  const boxes = fc.select.getBoxes();
  const cw = fc.helpers.canvasWH();
  // Place the new box where the cursor last was over the stage (a text paste is
  // usually aimed there); fall back to the visible-canvas centre when the pointer
  // is stale / off-stage (e.g. a keyboard ⌘V after scrolling).
  const m = fc.stage.metrics();
  const onStage =
    fc.lastPointer &&
    fc.lastPointer.x >= m.sr.left &&
    fc.lastPointer.x <= m.sr.left + m.sr.width &&
    fc.lastPointer.y >= m.sr.top &&
    fc.lastPointer.y <= m.sr.top + m.sr.height;
  const c = onStage
    ? fc.stage.clientToNative(fc.lastPointer!.x, fc.lastPointer!.y)
    : fc.stage.clientToNative(m.sr.left + m.sr.width / 2, m.sr.top + m.sr.height / 2);
  const fontSize = parseFloat(String(seed[cfg.fontSizeField])) || 64;
  const lhRaw = parseFloat(String(seed[cfg.lineHeightField]));
  const lh = Number.isFinite(lhRaw) ? lhRaw : 1.12;
  const padRaw = parseFloat(String(seed[cfg.padField]));
  const pad = Number.isFinite(padRaw) ? padRaw : 8;
  const lines = source.split('\n').length;
  const w = Math.round(Math.min(cw.w * 0.72, 760));
  // Over-estimate height (the box clips overflow in the render) - the user can drag
  // to resize, and a subsequent text edit grows-to-fit exactly.
  const h = Math.round(Math.max(120, lines * fontSize * lh + pad * 2 + fontSize * 0.5));
  const id = fc.select.freshId(boxes);
  let box = seedBox(cfg, {}, seed, { x: c.x - w / 2, y: c.y - h / 2, w, h } as MathRect, id);
  box = fc.document.clampToWorkArea(box);
  box = fc.select.withLegibleInk(box, boxes); // same reason as the create gesture: a dark seed on a dark ground is nothing
  fc.selection = new Set([id]);
  fc.select.commit([...boxes, box]);
  fc.chromeSync.renderChrome();
}
export function onGlobalPaste(fc: FcCtx, e: ClipboardEvent): void {
  const { canvasEl, cfg } = fc;
  if (fc.disposed || fc.editing) return;
  if (fc.keys.typingTarget()) return; // a real input owns the paste
  if (!canvasEl.isConnected) return;
  if (!fc.modes.pasteAimedHere()) return; // aimed at a modal/picker elsewhere
  const dt = e.clipboardData || (window as any).clipboardData;
  if (!dt) return;
  const plain = String((dt.getData?.('text/plain')) || '');
  // Objects copied inside the editor → paste = duplicate them (⌘C/⌘V an object).
  // Prefer the clipboard payload (survives reloads); fall back to the in-memory
  // copy when the clipboard held only our marker or the read was blocked.
  if (plain.startsWith(FC_CLIP_PREFIX) || (fc.objectClipboard && !plain.trim())) {
    let picked = fc.objectClipboard;
    if (plain.startsWith(FC_CLIP_PREFIX)) {
      try {
        picked = JSON.parse(plain.slice(FC_CLIP_PREFIX.length));
      } catch {
        /* keep in-memory */
      }
    }
    if (Array.isArray(picked) && picked.length) {
      e.preventDefault();
      e.stopPropagation();
      fc.modes.pasteObjects(picked);
      return;
    }
  }
  // Otherwise clipboard TEXT (rich or plain) → a new text box at the canvas centre.
  if (!cfg.textField) return;
  const html = dt.getData?.('text/html');
  let source = html?.trim() ? sourceFromPastedHtml(fc, html) : '';
  if (!source) source = plain.replace(/\r\n?/g, '\n').replace(/\s+$/, '');
  if (!source.trim()) return; // nothing useful → let the default happen
  e.preventDefault();
  e.stopPropagation();
  createTextBoxFromSource(fc, source);
}
// Multi-page mode: page frames clip their content (overflow:hidden) so a box that
// bleeds off a page is cut at the page edge in the render. While a box is being
// dragged, lift that clip so a box crossing between pages (or into the gap) stays
// fully visible under the cursor; the next paint re-buckets it and restores the clip.
// No-op for single-page editors (no [data-pdf-page] frames).
export function setFramesClipped(fc: FcCtx, clipped: boolean): void {
  const { canvasEl, frameCfg, pages } = fc;
  if (!pages && !frameCfg) return;
  canvasEl.querySelectorAll<HTMLElement>('[data-pdf-page]').forEach((f) => {
    if (!clipped) {
      // Stash the inline overflow before lifting the clip so we can restore it
      // EXACTLY. Carousel `.cm-page` clips from the stylesheet (inline ''), but the
      // frames path bakes `overflow:hidden` INLINE on clipChildren frames - blanket
      // resetting to '' there would delete the only clip source, so restore verbatim.
      f.dataset.fcOverflow = f.style.overflow;
      f.style.overflow = 'visible';
    } else if (f.dataset.fcOverflow !== undefined) {
      // Restore ONLY elements that carry the stash: a mid-gesture repaint mints fresh
      // page nodes without it, and writing '' at those would delete the hook-baked
      // inline `overflow:hidden` that is a clipChildren frame's only clip source.
      f.style.overflow = f.dataset.fcOverflow;
      delete f.dataset.fcOverflow;
    }
  });
  // When restoring the clip at gesture end, also drop the drag-time z-index hoist
  // (applyLiveRect set it) so box paint order returns to array order. A committed edit
  // repaints the elements clean anyway; this covers a gesture that ends without a commit.
  if (clipped)
    canvasEl
      .querySelectorAll<HTMLElement>('.lolly-box, .lolly-frame-page[data-frame-id]')
      .forEach((el) => {
        el.style.zIndex = '';
      });
}
// A box element only exists after a foreground paint (rAF-gated), so a freshly
// created box needs us to wait a few frames before we can focus its text.
export function editAfterPaint(fc: FcCtx, id: string, opts: { selectAll?: boolean }, tries = 8): void {
  const { canvasEl } = fc;
  if (fc.disposed) return;
  const el = canvasEl.querySelector<HTMLElement>(
    `.lolly-box[data-box-id="${fc.keys.cssEscape(id)}"] .lolly-box-text`
  );
  if (el) {
    startTextEdit(fc, id, opts);
    return;
  }
  if (tries > 0) requestAnimationFrame(() => editAfterPaint(fc, id, opts, tries - 1));
}
export function startTextEdit(fc: FcCtx, id: string, opts: { selectAll?: boolean } = {}): void {
  const { canvasEl, stageEl } = fc;
  if (fc.editing) commitTextEdit(fc);
  const el = canvasEl.querySelector<HTMLElement>(
    `.lolly-box[data-box-id="${fc.keys.cssEscape(id)}"] .lolly-box-text`
  );
  if (!el) return;
  const boxEl = el.closest<HTMLElement>('.lolly-box');
  // WYSIWYG: edit the RENDERED rich text in place (the element already holds
  // hooks.js richText output - <strong>/<em> runs, \n line breaks, "•  "
  // bullets). Formatting ops round-trip through the rich-text.js char model,
  // and commit serialises back to the stored markdown-subset source.
  // `pending` collects box-field changes (align/weight/size/…) made from the
  // format bar mid-edit; they preview as inline styles and land in the SAME
  // commit as the text, so the whole edit stays one undo step.
  fc.editing = {
    id,
    el,
    boxEl,
    prevHtml: el.innerHTML,
    prevStyle: el.style.cssText,
    prevBoxStyle: boxEl ? boxEl.style.cssText : '',
    pending: {},
  };
  stageEl.classList.add('is-text-editing');
  fc.rail.clearChrome(); // hide handles while typing (resets chrome node cache)
  fc.rail.hideCtxBar();
  fc.document.closeMorePanel();
  fc.toolbox.closePopover();
  boxEl?.classList.add('fc-box-editing'); // reveal overflow so typing stays visible
  el.setAttribute('contenteditable', 'true');
  el.setAttribute('role', 'textbox');
  el.setAttribute('aria-label', t('Edit text'));
  el.classList.add('fc-editing');
  el.focus();
  // Select-all when replacing a create-seed ("Text") so the first keystroke wins;
  // otherwise drop the caret at the end for a natural continue-typing feel.
  const range = document.createRange();
  range.selectNodeContents(el);
  if (!opts.selectAll) range.collapse(false);
  const sel = window.getSelection();
  sel!.removeAllRanges();
  sel!.addRange(range);
  el.addEventListener('keydown', fc.textEdit.onEditKey);
  el.addEventListener('blur', fc.textEdit.onEditBlur);
  el.addEventListener('paste', fc.textEdit.onEditPaste);
  document.addEventListener('selectionchange', fc.textEdit.onEditSelChange);
  showFmtBar(fc);
  positionFmtBar(fc);
  refreshFmtStates(fc);
  zoomForTouchEdit(fc, el, boxEl);
}
/**
 * Bring a too-small text box up to readable type before the user starts typing.
 *
 * Touch only, decided by the EVENT that reached the canvas and not by a media query: a
 * mouse user has a cursor, a wheel and the zoom HUD within reach, moving the canvas under
 * a deliberate double-click would be rude, and a touch laptop calls itself coarse for the
 * whole document while its owner is on the trackpad. Never mid-gesture either - the stage
 * must not slide out from under a finger that is still down.
 *
 * What gets measured is the on-screen TYPE, not the box: a tapped-out text box is ~320×200
 * native, which clears any box-height threshold at fit zoom while its 64px type is still a
 * dozen pixels tall. The canvas is scaled by a CSS transform, so a client rect is
 * post-transform and `offsetHeight` is not - their ratio IS the live composed scale,
 * without the overlay having to read a StageNav it deliberately cannot see. A ROTATED box
 * inflates that ratio (a client rect is the AABB), which only ever under-reports the need
 * to zoom, so it can produce no surprise movement.
 *
 * The zoom goes through `fc-focus-rect`, the overlay's ONLY channel to the pan/zoom
 * transform (tool.ts holds the StageNav). focusRect frames a CLIENT rect at 85% of the
 * stage, so asking it for the modest factor we actually want means handing it a rect that
 * is STAGE-SHAPED and `0.85 / want` of the stage's size, centred on the box - at any other
 * aspect its letterboxing `min()` would pick the other axis and over-zoom.
 */
export function zoomForTouchEdit(fc: FcCtx, el: HTMLElement, boxEl: HTMLElement | null): void {
  const { TOUCH_EDIT_MIN_PX, stageEl } = fc;
  if (fc.gesture || (fc.lastPointerKind !== 'touch' && fc.lastPointerKind !== 'pen')) return;
  const shown = el.getBoundingClientRect().height;
  const laid = el.offsetHeight;
  const fs = parseFloat(getComputedStyle(el).fontSize);
  if (!(shown > 0) || !(laid > 0) || !(fs > 0)) return;
  const onScreen = fs * (shown / laid);
  if (onScreen >= TOUCH_EDIT_MIN_PX) return;
  const sr = stageEl.getBoundingClientRect();
  if (!(sr.width > 0) || !(sr.height > 0)) return;
  const br = (boxEl || el).getBoundingClientRect();
  const h = (0.85 * sr.height) / (TOUCH_EDIT_MIN_PX / onScreen);
  const w = h * (sr.width / sr.height);
  stageEl.dispatchEvent(
    new CustomEvent('fc-focus-rect', {
      bubbles: true,
      detail: {
        x: br.left + br.width / 2 - w / 2,
        y: br.top + br.height / 2 - h / 2,
        w,
        h,
      },
    })
  );
}
export function onEditKey(fc: FcCtx, e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    cancelTextEdit(fc);
  } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    commitTextEdit(fc);
  }
  // Plain Enter inserts a literal \n (the render model is pre-wrap text) -
  // never the browser's <div> soup, which would desync the char model.
  else if (e.key === 'Enter') {
    e.preventDefault();
    document.execCommand('insertText', false, '\n');
  } else if ((e.key === 'b' || e.key === 'B') && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    toggleInline(fc, 'b');
  } else if ((e.key === 'i' || e.key === 'I') && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    toggleInline(fc, 'i');
  }
  e.stopPropagation(); // keep global Delete/nudge/undo off while typing
}
// Paste as plain text: rich clipboard HTML would smuggle arbitrary markup into
// the editable; \n survives fine under pre-wrap.
export function onEditPaste(_fc: FcCtx, e: ClipboardEvent): void {
  e.preventDefault();
  e.stopPropagation();
  const text = (e.clipboardData || (window as any).clipboardData)?.getData('text/plain') ?? '';
  if (text) document.execCommand('insertText', false, text);
}
export function onEditSelChange(fc: FcCtx): void {
  if (fc.editing) refreshFmtStates(fc);
}
export function onEditBlur(fc: FcCtx, e: FocusEvent): void {
  // Clicking our own format bar preventDefaults focus, so blur shouldn't fire from
  // it - but guard anyway so a stray blur toward the bar never drops the edit.
  if (e?.relatedTarget && fc.fmtbar?.contains(e.relatedTarget as Node)) return;
  commitTextEdit(fc);
}
export function finishEdit(fc: FcCtx): EditingState | null {
  const { stageEl } = fc;
  if (!fc.editing) return null;
  const done = fc.editing;
  fc.editing = null;
  hideFmtBar(fc);
  done.el.removeEventListener('keydown', fc.textEdit.onEditKey);
  done.el.removeEventListener('blur', fc.textEdit.onEditBlur);
  done.el.removeEventListener('paste', fc.textEdit.onEditPaste);
  document.removeEventListener('selectionchange', fc.textEdit.onEditSelChange);
  done.el.removeAttribute('contenteditable');
  done.el.removeAttribute('role');
  done.el.removeAttribute('aria-label');
  done.el.classList.remove('fc-editing');
  done.boxEl?.classList.remove('fc-box-editing');
  stageEl.classList.remove('is-text-editing');
  return done;
}
// Restore the pre-edit rendered view + inline styles (drops any pending-field
// live previews the format bar applied during the edit).
export function restoreEditView(_fc: FcCtx, done: EditingState): void {
  done.el.innerHTML = done.prevHtml;
  done.el.style.cssText = done.prevStyle;
  if (done.boxEl) done.boxEl.style.cssText = done.prevBoxStyle;
}
export function commitTextEdit(fc: FcCtx): void {
  const { cfg } = fc;
  const done = fc.editing;
  if (!done) return;
  const text = markdownFromChars(charsFromDom(done.el));
  const pending = done.pending || {};
  const boxes = fc.select.getBoxes();
  const i = fc.select.indexOfId(boxes, done.id);
  const changedText = i >= 0 && String(boxes[i]![cfg.textField] ?? '') !== text;
  const changed = changedText || Object.keys(pending).length > 0;
  // Grow-to-fit - ONLY when the edit actually changed something (so merely
  // opening a box to read it never mutates its height). The box clips overflow
  // in the final render, so if the copy is taller than the box, grow it (only
  // ever grow) to keep it whole. The editable IS the rendered rich text (with
  // any pending size/weight previews already applied), so measure it directly.
  // A box that opted into shrink-to-fit handles overflow by scaling the text DOWN, so
  // it must NOT also grow - the two are opposite responses to the same overflow.
  const fitOn = i >= 0 && !!cfg.fitTextField && boolOf(boxes[i]![cfg.fitTextField], false);
  let grownH: number | null = null;
  if (changed && !fitOn && cfg.hField && done.boxEl) {
    const needed = Math.ceil(done.el.scrollHeight);
    const boxNativeH = parseFloat(done.boxEl.style.height) || 0;
    if (boxNativeH && needed > boxNativeH + 1) grownH = needed;
  }
  finishEdit(fc);
  if (i < 0) {
    fc.chromeSync.renderChrome();
    return;
  }
  if (changed) {
    fc.select.commit(
      boxes.map((b, k) => {
        if (k !== i) return b;
        const nb = { ...b, ...pending, [cfg.textField]: text };
        if (grownH != null) nb[cfg.hField] = grownH;
        return nb;
      })
    );
  } else {
    restoreEditView(fc, done); // nothing changed → restore rendered view
    fc.chromeSync.renderChrome();
  }
}
export function cancelTextEdit(fc: FcCtx): void {
  const done = fc.editing;
  if (!done) return;
  finishEdit(fc);
  restoreEditView(fc, done); // discard edits, restore rendered view
  fc.chromeSync.renderChrome();
}
// ── in-edit formatting: true rich text over the char model ────────────────────
// The editable's DOM ↔ a flat char array (rich-text.js); the selection maps to
// [start, end) character offsets. Toggle = parse → flip flags → re-render →
// restore the selection at the same offsets. BRs count as one \n character.
export function selectionOffsets(_fc: FcCtx, el: HTMLElement): [number, number] | null {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return null;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) return null;
  const offsetOf = (container: Node, offset: number): number => {
    let n = 0;
    let found = false;
    const walk = (node: Node): void => {
      if (found) return;
      if (node.nodeType === 3) {
        if (node === container) {
          n += Math.min(offset, node.nodeValue!.length);
          found = true;
        } else n += node.nodeValue!.length;
        return;
      }
      if (node.nodeName === 'BR') {
        if (node === container) found = true;
        else n += 1;
        return;
      }
      const kids = node.childNodes;
      for (let k = 0; k < kids.length; k++) {
        if (node === container && k === offset) {
          found = true;
          return;
        }
        walk(kids[k]!);
        if (found) return;
      }
      if (node === container) found = true;
    };
    walk(el);
    return n;
  };
  const a = offsetOf(range.startContainer, range.startOffset);
  const b = offsetOf(range.endContainer, range.endOffset);
  return a <= b ? [a, b] : [b, a];
}
export function selectOffsets(_fc: FcCtx, el: HTMLElement, a: number, b: number): void {
  const idxIn = (node: Node): number =>
    Array.prototype.indexOf.call(node.parentNode!.childNodes, node);
  const posOf = (target: number): { node: Node; offset: number } => {
    let n = 0;
    let out: { node: Node; offset: number } | null = null;
    const walk = (node: Node): void => {
      if (out) return;
      if (node.nodeType === 3) {
        const len = node.nodeValue!.length;
        if (n + len >= target) {
          out = { node, offset: target - n };
          return;
        }
        n += len;
        return;
      }
      if (node.nodeName === 'BR') {
        if (n + 1 > target) out = { node: node.parentNode!, offset: idxIn(node) };
        else n += 1;
        return;
      }
      for (const kid of node.childNodes) {
        walk(kid);
        if (out) return;
      }
    };
    walk(el);
    return out || { node: el, offset: el.childNodes.length };
  };
  const start = posOf(a);
  const end = b === a ? start : posOf(b);
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  const sel = window.getSelection();
  sel!.removeAllRanges();
  sel!.addRange(range);
}
export function toggleInline(fc: FcCtx, flag: string): void {
  if (!fc.editing) return;
  const el = fc.editing.el;
  el.focus();
  const off = selectionOffsets(fc, el);
  if (!off) return;
  let [a, b] = off;
  const chars = charsFromDom(el);
  if (a === b) [a, b] = wordRangeAt(chars, a); // caret → the word under it
  if (a === b) return;
  const next = setFlag(
    chars,
    a,
    b,
    flag as 'b' | 'i',
    !rangeHasFlag(chars, a, b, flag as 'b' | 'i')
  );
  el.innerHTML = htmlFromChars(next);
  selectOffsets(fc, el, a, b);
  refreshFmtStates(fc);
}
// Text colour on the selection (mid-edit). The colour picker steals focus/selection, so
// STASH the range the moment the swatch is engaged (while the editable still owns the
// selection) and colour that range on each pick. `color` falsy → clear to the box fg.
export function stashRunColorRange(fc: FcCtx): void {
  if (!fc.editing) return;
  const off = selectionOffsets(fc, fc.editing.el);
  if (!off) return; // focus already left → keep the earlier stash
  const chars = charsFromDom(fc.editing.el);
  let [a, b] = off;
  if (a === b) [a, b] = wordRangeAt(chars, a);
  if (a < b) fc.editing.colorRange = [a, b];
}
export function applyRunColor(fc: FcCtx, color: any): void {
  if (!fc.editing?.colorRange) return;
  const [a, b] = fc.editing.colorRange;
  const el = fc.editing.el;
  el.innerHTML = htmlFromChars(setColor(charsFromDom(el), a, b, color || null));
  try {
    selectOffsets(fc, el, a, b);
  } catch {
    /* focus may be in the colour picker */
  }
  refreshFmtStates(fc);
}
// Per-selection font weight (mid-edit). Like the colour picker, the <select> steals
// focus/selection when it opens, so STASH the range on engage and re-weight it on
// change. A null weight clears the run back to the box weight. Weight and bold are
// the same axis, so setWeight drops any bold on the run (rich-text.js invariant).
export function stashRunWeightRange(fc: FcCtx): void {
  if (!fc.editing) return;
  const off = selectionOffsets(fc, fc.editing.el);
  if (!off) return;
  const chars = charsFromDom(fc.editing.el);
  let [a, b] = off;
  if (a === b) [a, b] = wordRangeAt(chars, a);
  if (a < b) fc.editing.weightRange = [a, b];
}
export function applyRunWeight(fc: FcCtx, weight: any): void {
  if (!fc.editing?.weightRange) return;
  const [a, b] = fc.editing.weightRange;
  const el = fc.editing.el;
  el.innerHTML = htmlFromChars(setWeight(charsFromDom(el), a, b, weight));
  try {
    selectOffsets(fc, el, a, b);
  } catch {
    /* focus may be in the select */
  }
  refreshFmtStates(fc);
}
// Toggle "•  " bullets / "1.  " numbers on every non-blank line (a text box is one
// logical list - bullets and numbers are mutually exclusive, handled in rich-text.js).
export function toggleBullet(fc: FcCtx): void {
  toggleList(fc, toggleBullets);
}
export function toggleNumber(fc: FcCtx): void {
  toggleList(fc, toggleNumbers);
}
export function toggleList(fc: FcCtx, fn: (chars: any) => any): void {
  if (!fc.editing) return;
  const el = fc.editing.el;
  el.focus();
  const next = fn(charsFromDom(el));
  el.innerHTML = htmlFromChars(next);
  selectOffsets(fc, el, next.length, next.length); // caret to the end
  refreshFmtStates(fc);
}
// A field tweak from the format bar mid-edit: preview it as an inline style on
// the live box (repainting now would destroy the contenteditable) and stash it
// in `pending` for commitTextEdit to fold into the box row.
export function applyPending(fc: FcCtx, field: string | undefined, value: any): void {
  const { cfg } = fc;
  if (!fc.editing || !field) return;
  fc.editing.pending[field] = value;
  const el = fc.editing.el;
  const boxEl = fc.editing.boxEl;
  if (field === cfg.alignField) {
    el.style.textAlign = value;
    if (boxEl) boxEl.style.justifyContent = H_JUSTIFY[value] || 'center';
  } else if (field === cfg.valignField) {
    if (boxEl) boxEl.style.alignItems = V_ALIGN[value] || 'center';
  } else if (field === cfg.weightField) {
    el.style.fontWeight = String(value);
  } else if (field === cfg.fontSizeField) {
    el.style.fontSize = value + 'px';
  } else if (field === cfg.fontField) {
    el.style.fontFamily = fc.helpers.fontStackFor(value);
  } else if (field === cfg.ligaturesField || field === cfg.alternatesField) {
    applyFeaturePreview(fc);
  }
  positionFmtBar(fc);
  refreshFmtStates(fc);
}
// Preview the box-level OpenType features on the live editable (ligatures /
// stylistic alternates). 'normal' explicitly re-enables defaults, overriding
// any stale value baked into the box's rendered style.
export function applyFeaturePreview(fc: FcCtx): void {
  const { cfg } = fc;
  if (!fc.editing) return;
  const boxes = fc.select.getBoxes();
  const box: Box = boxes[fc.select.indexOfId(boxes, fc.editing.id)] || {};
  const ligOn = boolOf(pendingOr(fc, cfg.ligaturesField, box[cfg.ligaturesField]), true);
  const altOn = boolOf(pendingOr(fc, cfg.alternatesField, box[cfg.alternatesField]), false);
  fc.editing.el.style.fontFeatureSettings = featureSettings(ligOn, altOn) || 'normal';
}
// Toggle a box-level boolean (ligatures/alternates) from the format bar, staged
// like the other box fields and committed with the text as one undo step.
export function toggleBoxBool(fc: FcCtx, field: string | undefined, dflt: boolean): void {
  if (!fc.editing || !field) return;
  const boxes = fc.select.getBoxes();
  const box: Box = boxes[fc.select.indexOfId(boxes, fc.editing.id)] || {};
  applyPending(fc, field, !boolOf(pendingOr(fc, field, box[field]), dflt));
}
// Drop the brand emoji trio (🦎💚🐧 / 🐧💚🦎) at the caret and force the box's
// ligatures ON, so the font can shape the three adjacent glyphs as one ligature.
// The insert keeps them adjacent; forcing ligatures on means a box that had the
// feature switched off still shapes them. Staged like the other box fields, so the
// insert + the ligature toggle land in the SAME commit (one undo step).
export function insertBrandLigature(fc: FcCtx, seq: string): void {
  const { cfg } = fc;
  if (!fc.editing) return;
  fc.editing.el.focus();
  if (cfg.ligaturesField) {
    const box: Box = fc.select.getBoxes()[fc.select.indexOfId(fc.select.getBoxes(), fc.editing.id)] || {};
    if (!boolOf(pendingOr(fc, cfg.ligaturesField, box[cfg.ligaturesField]), true))
      applyPending(fc, cfg.ligaturesField, true);
  }
  // execCommand keeps the contenteditable's own selection model in sync (same path
  // as Enter/paste); the inserted glyphs serialise straight through on commit.
  document.execCommand('insertText', false, seq);
  refreshFmtStates(fc);
}
// Strip inline character formatting (bold/italic/weight/colour) from the
// selection (or the word under the caret). Lists are paragraph-level and kept.
export function clearFormattingSelection(fc: FcCtx): void {
  if (!fc.editing) return;
  const el = fc.editing.el;
  el.focus();
  const off = selectionOffsets(fc, el);
  if (!off) return;
  let [a, b] = off;
  const chars = charsFromDom(el);
  if (a === b) [a, b] = wordRangeAt(chars, a);
  if (a === b) return;
  el.innerHTML = htmlFromChars(clearFormatting(chars, a, b));
  selectOffsets(fc, el, a, b);
  refreshFmtStates(fc);
}
export const pendingOr = (fc: FcCtx, field: string | undefined, fallback: any): any =>
  fc.editing && field && field in fc.editing.pending ? fc.editing.pending[field] : fallback;
export function showFmtBar(fc: FcCtx): void {
  const { cfg, defaultFont, overlay } = fc;
  if (fc.fmtbar) return;
  fc.fmtbar = document.createElement('div') as FmtBar;
  fc.fmtbar.className = 'fc-fmtbar';
  fc.fmtbar.setAttribute('data-export-hide', '');
  const refs: FmtRefs = { align: {}, valign: {} };
  // The bar is built as a row of logical GROUPS (type · styles · align · valign ·
  // size · OpenType). Each group is one flex item that never splits internally, so
  // when the bar wraps to a second row it breaks cleanly between groups and the
  // clusters stay legible. `curGroup` is the section buttons land in; section()
  // starts a new one.
  let curGroup: HTMLElement = fc.fmtbar;
  const section = (): HTMLElement => {
    const g = document.createElement('span');
    g.className = 'fc-fmt-group';
    fc.fmtbar!.appendChild(g);
    curGroup = g;
    return g;
  };
  const mk = (label: string, html: string, run: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fc-cbtn';
    b.setAttribute('data-tip', label);
    b.setAttribute('aria-label', label);
    b.innerHTML = html;
    // preventDefault on pointerdown keeps the caret/selection in the editable
    // (focus never leaves → the toggle hits the live selection, no blur/commit).
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      run();
    });
    curGroup.appendChild(b);
    return b;
  };
  const boxes = fc.select.getBoxes();
  const box: Box = boxes[fc.select.indexOfId(boxes, fc.editing?.id)] || {};
  // Type pill - font, weight and text colour joined into ONE connected control
  // (a single left→right run: font → weight → colour). These are the type
  // settings reached for most while typing; the weight menu is seeded from the
  // font so it sits between them. CSS collapses the inner borders so the three
  // read as one pill - only the pill's outer corners round.
  const typeGroup = document.createElement('span');
  typeGroup.className = 'fc-fmt-typegroup';
  if (cfg.fontField) {
    const fsel = document.createElement('select');
    fsel.className = 'field-select field-select--sm field-select--auto fc-fmt-font';
    fsel.setAttribute('data-tip', t('Font'));
    fsel.setAttribute('aria-label', t('Font'));
    fsel.innerHTML = fc.helpers.fontOptionsHtml();
    fsel.addEventListener('pointerdown', (e) => e.stopPropagation());
    fsel.addEventListener('change', () => {
      const font = fsel.value;
      applyPending(fc, cfg.fontField, font);
      if (cfg.weightField && fc.helpers.isMonoFont(font)) {
        const bx: Box = fc.select.getBoxes()[fc.select.indexOfId(fc.select.getBoxes(), fc.editing!.id)] || {};
        if ((parseInt(pendingOr(fc, cfg.weightField, bx[cfg.weightField]), 10) || 700) > 800)
          applyPending(fc, cfg.weightField, '800');
      }
      if (refs.weight) {
        // the run-weight menu's choices depend on the font
        const cur = refs.weight.value;
        refs.weight.innerHTML =
          `<option value="">${t('Auto')}</option>` +
          fc.helpers.weightChoicesFor(font)
            .map(([v, l]) => `<option value="${v}">${escapeText(t(l))}</option>`)
            .join('');
        refs.weight.value = fc.helpers.weightChoicesFor(font).some(([v]) => v === cur) ? cur : '';
      }
    });
    typeGroup.appendChild(fsel);
    refs.font = fsel;
  }
  // Weight (per-selection) sits right after the font - its menu depends on the
  // font - and before the colour. "Auto" = no explicit run weight (the run
  // inherits the box weight); refreshFmtStates fills it from the selected run.
  if (cfg.weightField) {
    const sel = document.createElement('select');
    sel.className = 'field-select field-select--sm field-select--auto fc-fmt-weight';
    sel.setAttribute('data-tip', t('Weight of the selected text'));
    sel.setAttribute('aria-label', t('Weight of the selected text'));
    const font = String((cfg.fontField && box[cfg.fontField]) || defaultFont);
    sel.innerHTML =
      `<option value="">${t('Auto')}</option>` +
      fc.helpers.weightChoicesFor(font)
        .map(([v, l]) => `<option value="${v}">${escapeText(t(l))}</option>`)
        .join('');
    sel.value = '';
    // Stash the selection on engage (the select steals focus/selection when it
    // opens); no preventDefault - the select needs focus, and the onEditBlur guard
    // recognises the bar so the edit survives the round trip.
    sel.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      stashRunWeightRange(fc);
    });
    sel.addEventListener('change', () =>
      applyRunWeight(fc, sel.value === '' ? null : parseInt(sel.value, 10))
    );
    typeGroup.appendChild(sel);
    refs.weight = sel;
  }
  // Per-selection text colour (distinct from the whole-box fg on the object bar)
  // - closes the pill.
  if (cfg.textColorField) {
    const cw = document.createElement('span');
    cw.className = 'fc-cfield fc-fmt-color';
    cw.innerHTML = colorFieldHtml('fc-runcolor', box[cfg.textColorField] || '#0c322c', {
      float: true,
    });
    // Capture the selection before the picker takes focus (capture phase catches the
    // trigger's pointerdown; later swatch clicks find no selection and keep the stash).
    cw.addEventListener('pointerdown', () => stashRunColorRange(fc), true);
    typeGroup.appendChild(cw);
    wireColorField(cw, { onChange: (_id, val) => applyRunColor(fc, fc.helpers.unwrapColor(val)) });
  }
  // Type section - the connected font·weight·colour pill plus the "reset
  // formatting" button (T-with-a-slash: strips bold/italic/weight/colour from the
  // selection, keeping paragraph structure). Grouped so the pill and its reset
  // never split across a wrapped row.
  if (typeGroup.childElementCount || cfg.textColorField) {
    const g = section();
    if (typeGroup.childElementCount) g.appendChild(typeGroup);
    if (cfg.textColorField)
      refs.clear = mk(t('Reset text formatting'), icon(SVG.resetColor), () =>
        clearFormattingSelection(fc)
      );
  }
  // Character styles - bold / italic / bulleted + numbered lists.
  section();
  refs.b = mk(t('Bold (⌘B)'), '<b>B</b>', () => toggleInline(fc, 'b'));
  refs.i = mk(t('Italic (⌘I)'), '<i class="fc-fmt-serif">I</i>', () => toggleInline(fc, 'i'));
  refs.bullet = mk(t('Bulleted list'), icon(SVG.bulletList), () => toggleBullet(fc));
  refs.numbers = mk(t('Numbered list'), '<b class="fc-fmt-number-glyph">1.</b>', () => toggleNumber(fc));
  // How the copy sits in its box: horizontal alignment, then vertical - each its
  // own group so the two icon-runs read apart.
  if (cfg.alignField) {
    section();
    for (const [v, label, ic] of [
      ['left', 'Align left', SVG.textL],
      ['center', 'Align centre', SVG.textC],
      ['right', 'Align right', SVG.textR],
    ] as Array<[string, string, string]>) {
      refs.align[v] = mk(t(label), icon(ic), () => applyPending(fc, cfg.alignField, v));
    }
  }
  if (cfg.valignField) {
    section();
    for (const [v, label, ic] of [
      ['top', 'Align to top', SVG.textT],
      ['middle', 'Centre vertically', SVG.textM],
      ['bottom', 'Align to bottom', SVG.textB],
    ] as Array<[string, string, string]>) {
      refs.valign[v] = mk(t(label), icon(ic), () => applyPending(fc, cfg.valignField, v));
    }
  }
  // Size steppers - the weight menu moved into the type pill, so this trailing
  // group is just the A− / A+ font-size nudges.
  if (cfg.fontSizeField) {
    section();
    mk(t('Smaller text'), 'A−', () => bumpPendingFont(fc, -6));
    mk(t('Bigger text'), 'A+', () => bumpPendingFont(fc, 6));
  }
  // OpenType features (whole-box, staged): ligatures + stylistic alternates, plus
  // the brand-ligature inserter.
  if (cfg.ligaturesField || cfg.alternatesField) {
    section();
    if (cfg.ligaturesField)
      refs.lig = mk(t('Ligatures'), '<span class="fc-fmt-type-glyph">fi</span>', () =>
        toggleBoxBool(fc, cfg.ligaturesField, true)
      );
    if (cfg.alternatesField)
      refs.alt = mk(t('Stylistic alternates'), '<span class="fc-fmt-type-glyph">a͎</span>', () =>
        toggleBoxBool(fc, cfg.alternatesField, false)
      );
    // Geeko 💚 Tux - drops the brand emoji trio at the caret and forces ligatures
    // on so the font can shape the three adjacent glyphs as one ligature. Plain
    // click inserts 🦎💚🐧; ⌥/Alt-click flips to penguin-first (🐧💚🦎). Gated on
    // the ligatures field since it turns that feature on.
    if (cfg.ligaturesField) {
      const emo = document.createElement('button');
      emo.type = 'button';
      emo.className = 'fc-cbtn fc-fmt-emoji';
      emo.setAttribute('data-tip', t('Insert 🦎💚🐧 - turns ligatures on (⌥-click for 🐧💚🦎)'));
      emo.setAttribute('aria-label', t('Insert Geeko loves Tux'));
      emo.textContent = '🦎💚🐧';
      emo.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      emo.addEventListener('click', (e) => {
        e.stopPropagation();
        insertBrandLigature(fc, e.altKey ? '🐧💚🦎' : '🦎💚🐧');
      });
      curGroup.appendChild(emo);
      refs.emoji = emo;
    }
  }
  fc.fmtbar._refs = refs;
  overlay.appendChild(fc.fmtbar);
}
export function bumpPendingFont(fc: FcCtx, delta: number): void {
  const { cfg } = fc;
  if (!fc.editing || !cfg.fontSizeField) return;
  const boxes = fc.select.getBoxes();
  const box: Box = boxes[fc.select.indexOfId(boxes, fc.editing.id)] || {};
  const cur = parseFloat(pendingOr(fc, cfg.fontSizeField, box[cfg.fontSizeField]));
  const base = Number.isFinite(cur) ? cur : 48;
  applyPending(fc, cfg.fontSizeField, Math.max(4, base + delta));
}
// Reflect the live state on the bar: B/I from the selection (or the word under
// the caret), bullets/alignment/weight from the box row + pending overrides.
export function refreshFmtStates(fc: FcCtx): void {
  const { cfg, defaultFont } = fc;
  if (!fc.fmtbar || !fc.editing) return;
  const r = (fc.fmtbar._refs || {}) as FmtRefs;
  const chars = charsFromDom(fc.editing.el);
  let [a, b] = selectionOffsets(fc, fc.editing.el) || [chars.length, chars.length];
  if (a === b) [a, b] = wordRangeAt(chars, a);
  r.b?.classList.toggle('is-on', rangeHasFlag(chars, a, b, 'b'));
  r.i?.classList.toggle('is-on', rangeHasFlag(chars, a, b, 'i'));
  r.bullet?.classList.toggle('is-on', allBulleted(chars));
  r.numbers?.classList.toggle('is-on', allNumbered(chars));
  const boxes = fc.select.getBoxes();
  const box: Box = boxes[fc.select.indexOfId(boxes, fc.editing.id)] || {};
  const alignCur = String(pendingOr(fc, cfg.alignField, box[cfg.alignField] || 'center'));
  const valignCur = String(pendingOr(fc, cfg.valignField, box[cfg.valignField] || 'middle'));
  for (const [v, btn] of Object.entries(r.align)) btn.classList.toggle('is-on', v === alignCur);
  for (const [v, btn] of Object.entries(r.valign)) btn.classList.toggle('is-on', v === valignCur);
  if (r.weight && document.activeElement !== r.weight) {
    // The weight picker reflects the SELECTED RUN's explicit weight (or Auto).
    const rw = rangeWeight(chars, a, b);
    r.weight.value = rw != null ? String(rw) : '';
  }
  // Whole-box font + OpenType feature toggles (staged in pending).
  if (r.font && document.activeElement !== r.font) {
    r.font.value = String(pendingOr(fc, cfg.fontField, box[cfg.fontField]) || defaultFont);
  }
  r.lig?.classList.toggle(
    'is-on',
    boolOf(pendingOr(fc, cfg.ligaturesField, box[cfg.ligaturesField]), true)
  );
  r.alt?.classList.toggle(
    'is-on',
    boolOf(pendingOr(fc, cfg.alternatesField, box[cfg.alternatesField]), false)
  );
}
export function hideFmtBar(fc: FcCtx): void {
  fc.fmtbar?.remove();
  fc.fmtbar = null;
}
export function positionFmtBar(fc: FcCtx): void {
  const { cfg } = fc;
  if (!fc.fmtbar || !fc.editing) return;
  const boxes = fc.select.getBoxes();
  const i = fc.select.indexOfId(boxes, fc.editing.id);
  if (i < 0) return;
  const m = fc.stage.metrics();
  const aabb = selectionAABB(boxes, [i], cfg);
  if (!aabb) return;
  const tl = fc.stage.nativeToStage(aabb.minX, aabb.minY, m);
  const br = fc.stage.nativeToStage(aabb.maxX, aabb.minY, m);
  const bottomY = fc.stage.nativeToStage(aabb.minX, aabb.maxY, m).y;
  const bw = fc.fmtbar.offsetWidth || 0;
  const bh = fc.fmtbar.offsetHeight || 44;
  const GAP = 8;
  fc.fmtbar.style.left =
    Math.max(6, Math.min((tl.x + br.x) / 2 - bw / 2, m.sr.width - bw - 6)) + 'px';
  // Seat the WHOLE bar above the box using its real height (the two-row
  // colour version is ~90px - a fixed offset let it dip onto the first line).
  // If there's no room above, flip below the box; clamp to the stage so a
  // tall/off-screen box pins the bar to a visible edge, never over the text.
  const above = tl.y - bh - GAP;
  const top = above >= 6 ? above : Math.min(bottomY + GAP, m.sr.height - bh - 6);
  fc.fmtbar.style.top = Math.max(6, top) + 'px';
}
export function textEditOps(fc: FcCtx) {
  return {
    sourceFromPastedHtml: bindOp(fc, sourceFromPastedHtml),
    createTextBoxFromSource: bindOp(fc, createTextBoxFromSource),
    onGlobalPaste: bindOp(fc, onGlobalPaste),
    setFramesClipped: bindOp(fc, setFramesClipped),
    editAfterPaint: bindOp(fc, editAfterPaint),
    startTextEdit: bindOp(fc, startTextEdit),
    zoomForTouchEdit: bindOp(fc, zoomForTouchEdit),
    onEditKey: bindOp(fc, onEditKey),
    onEditPaste: bindOp(fc, onEditPaste),
    onEditSelChange: bindOp(fc, onEditSelChange),
    onEditBlur: bindOp(fc, onEditBlur),
    finishEdit: bindOp(fc, finishEdit),
    restoreEditView: bindOp(fc, restoreEditView),
    commitTextEdit: bindOp(fc, commitTextEdit),
    cancelTextEdit: bindOp(fc, cancelTextEdit),
    selectionOffsets: bindOp(fc, selectionOffsets),
    selectOffsets: bindOp(fc, selectOffsets),
    toggleInline: bindOp(fc, toggleInline),
    stashRunColorRange: bindOp(fc, stashRunColorRange),
    applyRunColor: bindOp(fc, applyRunColor),
    stashRunWeightRange: bindOp(fc, stashRunWeightRange),
    applyRunWeight: bindOp(fc, applyRunWeight),
    toggleBullet: bindOp(fc, toggleBullet),
    toggleNumber: bindOp(fc, toggleNumber),
    toggleList: bindOp(fc, toggleList),
    applyPending: bindOp(fc, applyPending),
    applyFeaturePreview: bindOp(fc, applyFeaturePreview),
    toggleBoxBool: bindOp(fc, toggleBoxBool),
    insertBrandLigature: bindOp(fc, insertBrandLigature),
    clearFormattingSelection: bindOp(fc, clearFormattingSelection),
    pendingOr: bindOp(fc, pendingOr),
    showFmtBar: bindOp(fc, showFmtBar),
    bumpPendingFont: bindOp(fc, bumpPendingFont),
    refreshFmtStates: bindOp(fc, refreshFmtStates),
    hideFmtBar: bindOp(fc, hideFmtBar),
    positionFmtBar: bindOp(fc, positionFmtBar),
  };
}
