// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: editor modes, auto layout and the copy, cut and paste of objects and styles.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `fc.<module>.<fn>`. Extracted verbatim
 * from initFreeCanvas() by scripts/split-closure.ts.
 */
import { boxRect, nextFrameOrder, num, seedFrameOrders } from '../free-canvas-math.ts';
import type { Box } from '../free-canvas-math.ts';
import { boxOutlineKind } from '../vector-ops.ts';
import { announce } from '../../a11y.ts';
import { t } from '../../i18n.ts';
import { applyDesignStyle, captureDesignStyle } from '../design-style-clipboard.ts';
import { FC_CLIP_PREFIX } from './shared.ts';
import type { AddKind, EditorMode } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

// ── the tool mode ─────────────────────────────────────────────────────────────
/**
 * THE mode switch. Every enter/exit below is private to it, because the bug it fixes was
 * not a missing button: the modes were four independent booleans, so each `armX` had to
 * remember to disarm each of the others by hand - and `armConnect` never disarmed the pen,
 * so Connect-over-Pen left two live tools, two lit rail buttons, and an Escape that took
 * two presses to dismantle what looked like one state. Here "enter next" IS "leave
 * everything else", once, in one place.
 *
 * `draft` decides an in-progress pen path's fate, and the two answers are deliberately
 * opposite: a TOOL SWITCH finishes it ('commit', the default - the user asked for a
 * different tool, not to throw the path away, which is what every mainstream design tool
 * does), while Escape means cancel and passes 'discard'. Getting these the same way round
 * either loses drawn work or resurrects work the user just abandoned. `penFinishDraw`
 * still commits nothing for a draft under two nodes, so a stray single click on the way
 * out leaves no invisible one-node box behind.
 *
 * Point editing is not a mode, but it IS something the user is inside, so any tool change
 * leaves it - the same way switching tools leaves a text edit.
 */
export function setMode(fc: FcCtx, 
  next: EditorMode,
  o: { kind?: AddKind; draft?: 'commit' | 'discard' } = {}
): void {
  const { cfg } = fc;
  // The line tool writes a PATH BOX now (plan 96 P2), so it is gated on the same config
  // the pen is - `pathField` - and no longer on the connectors input it used to write to.
  if (next === 'line' && !cfg.pathField) return;
  if (next === 'pen' && !cfg.pathField) return;
  if (next === 'create' && !o.kind && !fc.armedKind) return;
  if (next !== 'select') fc.nodeToolActive = false; // any other tool exits the Node tool
  const from = fc.mode;
  if (fc.penEdit) fc.penTool.endPenEdit();
  if (from === 'pen' && fc.penDraft) {
    if (o.draft === 'discard') fc.penTool.penCancelDraw();
    else fc.penTool.penFinishDraw();
  }
  fc.mode = next;
  if (from !== next) {
    // A mode switch while a create/line DRAG is still in flight (Escape's discard rung, or
    // a V/P/N tool shortcut pressed mid-draw) ABORTS that gesture, so its eventual
    // pointerup can't commit a box/line against the discard - both tools committed on
    // release and neither ended the gesture here (plan 90 verify LENS 3). endGesture()
    // nulls `gesture`, so onGestureEnd early-returns on release; the browser auto-releases
    // the pointer capture. Scoped to these two so select-mode move/resize/rotate is
    // untouched (those never coexist with a tool switch), as is pen's own draft handling.
    if (fc.gesture && (fc.gesture.type === 'create' || fc.gesture.type === 'line')) fc.gestures.endGesture();
    if (from === 'create') exitCreate(fc);
    else if (from === 'pen') fc.penTool.exitPen();
    else if (from === 'line') exitLine(fc);
    if (next === 'pen') fc.penTool.enterPen();
    else if (next === 'line') enterLine(fc);
  }
  if (next === 'create') enterCreate(fc, o.kind);
  syncModeUI(fc);
}
/** Back to the pointer, from anywhere - Escape's mode rung, and every internal "this
 *  gesture consumed the tool" exit. */
export const toPointer = (fc: FcCtx, draft: 'commit' | 'discard' = 'commit'): void => {
  setMode(fc, 'select', { draft });
};
/** The pointer as an EXPLICIT user choice (the rail button, `V`). Announced, because the
 *  other two tools announce themselves and a mode change no screen reader hears is not a
 *  mode change; the internal exits above stay quiet, or every edge click would speak. */
export const pickPointer = (fc: FcCtx): void => {
  fc.nodeToolActive = false; // the plain pointer is NOT the Node tool
  toPointer(fc);
  announce(t('Pointer on - click to select, drag to move.'));
};
/** Toggle the Node tool. Turning it on drops any other tool (it is a select sub-mode)
 *  and, if exactly one path box is selected, jumps straight into editing it - the
 *  "jump straight into node editing an object" ask. */
export function toggleNodeTool(fc: FcCtx): void {
  const { vectorCfg } = fc;
  if (fc.nodeToolActive) {
    fc.nodeToolActive = false;
    if (fc.penEdit) fc.penTool.endPenEdit();
    syncModeUI(fc);
    announce(t('Pointer on - click to select, drag to move.'));
    return;
  }
  if (fc.mode !== 'select') setMode(fc, 'select'); // exit pen/create/connect
  fc.nodeToolActive = true;
  const boxes = fc.select.getBoxes();
  if (fc.selection.size === 1) {
    const id = [...fc.selection][0]!;
    const i = boxes.findIndex((b, k) => fc.select.idOf(b, k) === id);
    if (i >= 0 && boxOutlineKind(boxes[i], vectorCfg ?? undefined) === 'path') fc.penTool.startPenEdit(id);
  }
  syncModeUI(fc);
  announce(t('Node tool on - click a shape to edit its points.'));
}
export function enterCreate(fc: FcCtx, kind?: AddKind): void {
  const { stageEl } = fc;
  if (kind) fc.armedKind = kind;
  // Every arm starts UNTIMED, and the timeline path re-stamps its time right after
  // calling setMode. Clearing here rather than only in exitCreate is what makes a
  // create→create switch safe: setMode skips exitCreate when the mode does not
  // change, so arming from the timeline `+` and then from the rail's add menu used
  // to carry the stale playhead time into the box drawn by the SECOND arm.
  fc.pendingAddAtMs = null;
  fc.edges.deselectEdge();
  stageEl.classList.add('fc-arming');
  fc.stage.showArmHint(fc.armedKind);
}
export function exitCreate(fc: FcCtx): void {
  const { stageEl } = fc;
  fc.armedKind = null;
  fc.pendingAddAtMs = null; // an abandoned arm must not time the NEXT box drawn by hand
  stageEl.classList.remove('fc-arming');
  fc.stage.hideArmHint(); // placed, or abandoned - either way the arm is over
}
// `enterConnect` / `exitConnect` (plan 90) lived here. Plan 96 P4 deleted Connect mode
// outright: clicking a card and then another card was a third way to make the one
// primitive the Pen and the Line tool already make, and P3 replaced it with the gesture
// the shape itself suggests - drag a line's endpoint onto a box and it attaches. There is
// no mode to enter, so there is no mode to be trapped in and none to leave.
// The Line tool (plan 96 P2) - the pen's other gesture. One drag draws a straight
// two-node authored path, committed as an ordinary path box: selectable, node-editable,
// and carrying the same stroke + arrowhead decorations any spline does.
export function enterLine(fc: FcCtx): void {
  const { stageEl } = fc;
  fc.edges.deselectEdge();
  fc.connectors.hideConnectLayer();
  fc.selection = new Set<string>();
  stageEl.classList.add('fc-lining');
  fc.edges.setHoverEdge(null);
  announce(t('Line tool - drag on the canvas to draw a line or arrow. Esc to finish.'));
  fc.chromeSync.renderChrome();
}
export function exitLine(fc: FcCtx): void {
  const { stageEl } = fc;
  stageEl.classList.remove('fc-lining');
  fc.connectors.hideConnectLayer();
  fc.gestures.clearGuides();
}
/**
 * What the Line tool adds to a path box beyond the pen's own seeding.
 *
 * An OPEN arrowhead at the END and nothing at the start: someone reaching for a line tool on a
 * layout canvas is nearly always pointing at something, and an undecorated straight
 * segment is what the pen already gives. The head is a normal field, so the stroke panel
 * takes it straight back off.
 *
 * Both bindings are written EMPTY rather than left absent, so a line drawn today carries
 * the same structure of row as one bound in P3 - the field exists, it just names no box.
 */
export const lineBoxSeed = (fc: FcCtx): Box => { const { cfg, hasBindCfg, hasHeadCfg } = fc; return ({
  ...(hasHeadCfg ? { [cfg.headStartField]: 'none', [cfg.headEndField]: 'open' } : {}),
  ...(hasBindCfg ? { [cfg.bindStartField]: '', [cfg.bindEndField]: '' } : {}),
}); };
/**
 * The rail's one job: say which tool is live. Attributes only, on buttons captured at
 * build time - this runs on every chrome sync (so, every frame of a drag), and the rail
 * follows the same build-once/touch-many discipline as the selection chrome.
 */
export function syncModeUI(fc: FcCtx): void {
  const { modeBtns } = fc;
  const flag = (b: HTMLElement | null, on: boolean): void => {
    if (!b) return;
    b.classList.toggle('is-armed', on);
    b.setAttribute('aria-pressed', String(on));
  };
  flag(modeBtns.select, fc.mode === 'select' && !fc.nodeToolActive);
  flag(modeBtns.create, fc.mode === 'create');
  flag(modeBtns.pen, fc.mode === 'pen');
  flag(modeBtns.line, fc.mode === 'line');
  flag(fc.nodeToolBtn, fc.nodeToolActive);
}
// Auto-arrange the connected cards into a tidy top-down hierarchy. Roots (cards with
// nothing pointing AT them) are laid out left-to-right; each child sits under its parent,
// and a parent is centred over the span of its children. Unconnected cards are left where
// they are. One commit → one undo step.
//
// The graph is read off the path boxes' BINDINGS (plan 96 P4). It used to be read off the
// `connectors` edge input; a connector is a path box now, and `bindStart` → `bindEnd` is
// the same directed pair `from` → `to` was, so the walk below is unchanged.
export function autoLayout(fc: FcCtx): void {
  const { cfg, gridSize, hasBindCfg } = fc;
  if (!hasBindCfg) return;
  const boxes = fc.select.getBoxes();
  if (!boxes.length) return;
  const idAt = new Map<string, number>();
  boxes.forEach((b, i) => { idAt.set(fc.select.idOf(b, i), i); });
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const b of boxes) {
    if (!b) continue;
    const from = String(b[cfg.bindStartField] ?? ''),
      to = String(b[cfg.bindEndField] ?? '');
    if (!from || !to || !idAt.has(from) || !idAt.has(to) || from === to) continue;
    if (!children.has(from)) children.set(from, []);
    if (!children.get(from)!.includes(to)) children.get(from)!.push(to);
    hasParent.add(to);
  }
  const roots = boxes
    .map((b, i) => fc.select.idOf(b, i))
    .filter((id) => children.has(id) && !hasParent.has(id));
  if (!roots.length) {
    announce(t('Connect some cards first, then Auto-arrange lays them out.'));
    return;
  } // nothing connected → leave the canvas alone
  const HGAP = 40,
    VGAP = 90;
  const cw = fc.helpers.canvasWH();
  const placed = new Map<string, { x: number; y: number }>();
  const seen = new Set<string>();
  let cursorX = 0;
  // First pass: assign x by in-order leaf slots, y by depth; parents centre over kids.
  function widthOf(id: string): number {
    const b = boxes[idAt.get(id)!]!;
    return Math.max(1, num(b[cfg.wField], 200));
  }
  function heightAtDepth(d: number): number {
    // Uniform row height = the tallest card overall (keeps rows aligned).
    let mh = 0;
    for (const b of boxes) mh = Math.max(mh, num(b[cfg.hField], 100));
    return d * (mh + VGAP);
  }
  function layout(id: string, depth: number): { cx: number } {
    seen.add(id);
    const kids = (children.get(id) || []).filter((k) => !seen.has(k));
    const y = heightAtDepth(depth);
    if (!kids.length) {
      const x = cursorX;
      cursorX += widthOf(id) + HGAP;
      placed.set(id, { x, y });
      return { cx: x + widthOf(id) / 2 };
    }
    const cxs: number[] = [];
    for (const k of kids) cxs.push(layout(k, depth + 1).cx);
    const cx = (cxs[0]! + cxs[cxs.length - 1]!) / 2;
    placed.set(id, { x: cx - widthOf(id) / 2, y });
    return { cx };
  }
  for (const r of roots) {
    layout(r, 0);
    cursorX += HGAP * 2;
  }
  // Centre the whole tree horizontally on the artboard, then snap onto the grid.
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity;
  for (const [id, p] of placed) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x + widthOf(id));
    minY = Math.min(minY, p.y);
  }
  const offX = (cw.w - (maxX - minX)) / 2 - minX;
  const offY = Math.max(40, cw.h * 0.12) - minY;
  const g = fc.gridOn ? gridSize : 1;
  const next = boxes.map((b, i) => {
    const id = fc.select.idOf(b, i);
    const p = placed.get(id);
    if (!p) return b;
    return {
      ...b,
      [cfg.xField]: Math.round((p.x + offX) / g) * g,
      [cfg.yField]: Math.round((p.y + offY) / g) * g,
    };
  });
  fc.select.commit(next);
}
/** Copy the first selected row's visual fields; multi-selection follows every paint panel. */
export function copySelectionStyle(fc: FcCtx): void {
  const { styleFields } = fc;
  const boxes = fc.select.getBoxes();
  const first = fc.select.selIndices(boxes)[0];
  if (first == null || !styleFields.length) return;
  fc.styleClipboard = captureDesignStyle(boxes[first]!, styleFields);
  fc.stage.flash(t('Style copied'));
}
/** Apply one style to the full selection in one model write / undo step. */
export function pasteSelectionStyle(fc: FcCtx): void {
  if (!fc.styleClipboard || !fc.selection.size) return;
  const boxes = fc.select.getBoxes();
  const next = applyDesignStyle(boxes, fc.selection, (b, i) => fc.select.idOf(b, i), fc.styleClipboard) as Box[];
  fc.select.commit(next);
  fc.stage.flash(t('Style pasted'));
} // last client {x,y} over the stage - paste placement
export function pasteAimedHere(fc: FcCtx): boolean {
  const { stageEl } = fc;
  const ae = document.activeElement;
  return !(ae && ae !== document.body && !stageEl.contains(ae));
}
/**
 * What a copy takes: the selection, PLUS the children of any selected artboard
 * (plans/179 A8, the Cmd+C leg). A slide is its content - copying the page row alone
 * pasted an empty board. Ids are written explicitly so `pasteObjects` can re-point a
 * child at the copy of its own page even when the tool stores no id on the row.
 */
export function copyRows(fc: FcCtx, boxes: Box[], idx: number[]): Box[] {
  const { cfg, frameCfg } = fc;
  const take = new Set(idx);
  const fk = frameCfg?.frameKind;
  if (fk) {
    const ff = fc.select.frameFields();
    const pages = new Set(
      idx.filter((i) => String(boxes[i]?.[cfg.kindField]) === fk).map((i) => fc.select.idOf(boxes[i], i))
    );
    if (pages.size)
      boxes.forEach((b, i) => {
        if (b && pages.has(String(b[ff.frameField] ?? ''))) take.add(i);
      });
  }
  return [...take]
    .sort((a, b) => a - b)
    .map((i) => ({ ...boxes[i], [cfg.idField]: fc.select.idOf(boxes[i], i) }));
}
export function onCopy(fc: FcCtx, e: ClipboardEvent): void {
  if (fc.disposed || fc.editing) return; // editing → native text copy
  if (fc.keys.typingTarget() || !pasteAimedHere(fc)) return;
  const boxes = fc.select.getBoxes();
  const idx = fc.select.selIndices(boxes);
  if (!idx.length) return; // nothing selected → native copy
  const picked = copyRows(fc, boxes, idx);
  fc.objectClipboard = picked;
  try {
    e.clipboardData!.setData('text/plain', FC_CLIP_PREFIX + JSON.stringify(picked));
    e.preventDefault();
  } catch {
    /* clipboard write blocked - the in-memory copy still serves ⌘V */
  }
}
/** Copy's exact deep payload followed by one ordinary delete commit. */
export function cutSelection(fc: FcCtx, transfer?: DataTransfer | null): void {
  const boxes = fc.select.getBoxes();
  const idx = fc.select.selIndices(boxes);
  if (!idx.length) return;
  const picked = copyRows(fc, boxes, idx);
  fc.objectClipboard = picked;
  const encoded = FC_CLIP_PREFIX + JSON.stringify(picked);
  try {
    if (transfer) transfer.setData('text/plain', encoded);
    else void navigator.clipboard?.writeText(encoded).catch(() => { /* in-memory fallback */ });
  } catch {
    /* the in-memory payload still makes a later paste work */
  }
  fc.ops.deleteSelection();
}
/** Native Cut keeps text fields native and owns the canvas only with a selection. */
export function onCut(fc: FcCtx, e: ClipboardEvent): void {
  const { timeCfg } = fc;
  if (fc.disposed || fc.editing) return; // editing → native text cut
  if (fc.keys.typingTarget() || !pasteAimedHere(fc) || !fc.selection.size) return;
  if (timeCfg && !fc.select.selectionLive(fc.select.getBoxes())) {
    e.preventDefault();
    announce(t('This card is not on screen at the playhead. Go to it to edit it.'));
    return;
  }
  e.preventDefault();
  cutSelection(fc, e.clipboardData);
}
/**
 * Duplicate a set of copied boxes at a +24,+24 offset (cascades on repeat paste),
 * clamped into the canvas, and select the fresh copies. Mirrors duplicateSelection.
 *
 * An ARTBOARD row takes the same path Cmd+D does (plans/179 A8/A9), because a paste
 * creates a frame exactly as a duplicate does. Left on the +24 rule it kept the SOURCE
 * board's `order` - two slides claiming one page slot, settled only by the x tie-break -
 * and sat 24px over the board it came from; since the paste is appended LAST and
 * `resolveFrame` answers with the last containing frame, that board's children re-bucketed
 * into the copy on their next gesture and vanished from every export. So a pasted board
 * goes clear of every board there is, takes the next page slot, and brings the children
 * `copyRows` collected with it, keeping their frame-local position.
 */
export function pasteObjects(fc: FcCtx, picked: any): void {
  const { FRAME_DUP_GAP, cfg, frameCfg } = fc;
  if (!Array.isArray(picked) || !picked.length) return;
  const rows = (picked as unknown[]).filter((s): s is Box => !!s && typeof s === 'object');
  if (!rows.length) return;
  const fk = frameCfg?.frameKind;
  const ff = frameCfg ? fc.select.frameFields() : null;
  const isFrameRow = (s: Box): boolean => !!fk && String(s[cfg.kindField]) === fk;
  let boxes = fc.select.getBoxes();
  if (ff && rows.some(isFrameRow)) boxes = seedFrameOrders(boxes, ff); // legacy docs get an order first
  const clones: Box[] = [];
  const nextSel = new Set<string>();
  const pageIds = new Map<string, string>(); // pasted frame id → its copy's id
  const pageShift = new Map<string, number>(); // …and how far right it moved
  let deckRight = fk
    ? boxes.reduce(
        (m, b) =>
          b && String(b[cfg.kindField]) === fk
            ? Math.max(m, num(b[cfg.xField]) + num(b[cfg.wField]))
            : m,
        Number.NEGATIVE_INFINITY
      )
    : Number.NEGATIVE_INFINITY;
  for (const src of rows) {
    // pages first - a child needs its new page
    if (!isFrameRow(src)) continue;
    const r = boxRect(src, cfg);
    const x = Math.round(Number.isFinite(deckRight) ? deckRight + FRAME_DUP_GAP : r.x);
    const id = fc.select.freshId(boxes.concat(clones));
    const clone: Box = {
      ...src,
      [cfg.idField]: id,
      [cfg.xField]: x,
      [cfg.yField]: Math.round(r.y),
    };
    if (ff) clone[ff.orderField] = nextFrameOrder(boxes.concat(clones), ff);
    clones.push(clone);
    nextSel.add(id);
    const old = src[cfg.idField] == null ? '' : String(src[cfg.idField]);
    if (old) {
      pageIds.set(old, id);
      pageShift.set(old, x - r.x);
    }
    deckRight = x + r.w;
  }
  for (const src of rows) {
    if (isFrameRow(src)) continue;
    const id = fc.select.freshId(boxes.concat(clones));
    const r = boxRect(src, cfg);
    const owner = ff ? String(src[ff.frameField] ?? '') : '';
    const dx = owner ? pageShift.get(owner) : undefined;
    const clone: Box =
      dx == null
        ? fc.document.clampToWorkArea({
            ...src,
            [cfg.idField]: id,
            [cfg.xField]: Math.round(r.x + 24),
            [cfg.yField]: Math.round(r.y + 24),
          })
        : {
            ...src,
            [cfg.idField]: id,
            [cfg.xField]: Math.round(r.x + dx),
            [cfg.yField]: Math.round(r.y),
            [ff!.frameField]: pageIds.get(owner)!,
          };
    clones.push(clone);
    nextSel.add(id);
  }
  if (!clones.length) return;
  // With a whole page pasted the selection is that PAGE, not its contents - the same
  // answer Cmd+D gives, so the next gesture moves the slide.
  fc.selection = pageIds.size ? new Set(pageIds.values()) : nextSel;
  fc.select.commit([...boxes, ...clones]);
  fc.chromeSync.renderChrome();
}
// ── paste-to-create ──────────────────────────────────────────────────────────
// Pasting (⌘/Ctrl+V, or a mobile long-press paste) while nothing is being edited
// drops the clipboard text into a NEW text box. Rich clipboard HTML (bold/italic/
// colour/weight/lists) is converted to the tool's markdown-subset source by
// round-tripping through the same rich-text model the editor uses; plain text is
// used verbatim. The in-edit editable has its OWN paste handler (onEditPaste) and
// stops propagation, so this only fires on the bare canvas.
export const textAddKind = (fc: FcCtx): AddKind | undefined =>
  { const { addKinds, cfg } = fc; return addKinds.find((k) => k.id === 'text' || (k.seed && k.seed[cfg.kindField] === 'text')); };
export function modesOps(fc: FcCtx) {
  return {
    setMode: bindOp(fc, setMode),
    toPointer: bindOp(fc, toPointer),
    pickPointer: bindOp(fc, pickPointer),
    toggleNodeTool: bindOp(fc, toggleNodeTool),
    enterCreate: bindOp(fc, enterCreate),
    exitCreate: bindOp(fc, exitCreate),
    enterLine: bindOp(fc, enterLine),
    exitLine: bindOp(fc, exitLine),
    lineBoxSeed: bindOp(fc, lineBoxSeed),
    syncModeUI: bindOp(fc, syncModeUI),
    autoLayout: bindOp(fc, autoLayout),
    copySelectionStyle: bindOp(fc, copySelectionStyle),
    pasteSelectionStyle: bindOp(fc, pasteSelectionStyle),
    pasteAimedHere: bindOp(fc, pasteAimedHere),
    copyRows: bindOp(fc, copyRows),
    onCopy: bindOp(fc, onCopy),
    cutSelection: bindOp(fc, cutSelection),
    onCut: bindOp(fc, onCut),
    pasteObjects: bindOp(fc, pasteObjects),
    textAddKind: bindOp(fc, textAddKind),
  };
}
