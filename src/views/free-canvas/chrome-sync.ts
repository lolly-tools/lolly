// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: chrome rendering - sync, frame labels, box chrome, handles.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `fc.<module>.<fn>`. Extracted verbatim
 * from initFreeCanvas() by scripts/split-closure.ts.
 */
import { activeFrameIdFor, boxCorners, boxRect, num, posedRect } from '../free-canvas-math.ts';
import type { Box } from '../free-canvas-math.ts';
import { t, tRaw } from '../../i18n.ts';
import { HANDLES } from './shared.ts';
import type { Bounds, Corner, HandleName, Metrics, Point, Rect } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

export function scheduleSync(fc: FcCtx): void {
  if (fc.syncScheduled || fc.disposed) return;
  fc.syncScheduled = true;
  requestAnimationFrame(() => {
    fc.syncScheduled = false;
    if (!fc.gesture || fc.gesture.type === 'tap') renderChrome(fc);
  });
}
// During a gesture, reposition chrome from the live DOM (which we just mutated).
export function renderChromeLive(fc: FcCtx): void {
  const boxes = fc.select.getBoxes();
  const rects = new Map<number, Rect>();
  for (const i of fc.select.selIndices(boxes)) {
    const id = fc.select.idOf(boxes[i], i);
    const el = fc.stage.liveBoxEl(id);
    // el.style.left/top are FRAME-LOCAL in multi-page mode; add the frame offset back
    // so the selection chrome (which paints in global native → stage coords) lines up.
    if (el) {
      const fo = fc.stage.frameOffsetOfEl(el);
      rects.set(i, {
        x: (parseFloat(el.style.left) || 0) + fo.x,
        y: (parseFloat(el.style.top) || 0) + fo.y,
        w: parseFloat(el.style.width) || 1,
        h: parseFloat(el.style.height) || 1,
        rot: fc.keys.rotOf(el),
      });
    }
  }
  paintChrome(fc, boxes, rects);
}
export function renderChrome(fc: FcCtx): void {
  const boxes = fc.select.getBoxes();
  if (fc.selection.size) fc.authoringGuides?.select(null);
  fc.authoringGuides?.sync();
  paintChrome(fc, boxes, null);
  // Keep the selected connector's highlight + inspector tracking any box move,
  // pan/zoom, or edit (drops the selection if its edge/box has gone).
  if (fc.selectedEdges.size) fc.edges.refreshEdgeChrome();
  emitActiveArtboard(fc);
}
export function notifyActiveArtboard(fc: FcCtx, id: string): void {
  const { artboardListeners } = fc;
  if (id === fc.artboardNotifiedId) return;
  fc.artboardNotifiedId = id;
  for (const f of [...artboardListeners]) {
    try {
      f(id);
    } catch (e) {
      console.error(e);
    }
  }
}
export function emitActiveArtboard(fc: FcCtx): void {
  const { canvasEl, cfg, frameCfg } = fc;
  // The rail's paint swatch follows the same active artboard (plans/179 A1), and this
  // is the one function that already runs on every selection change, commit and
  // `tl-time` - so it is where the swatch is kept in step. Ahead of the frameCfg
  // guard: a no-frames document still has a `background` to re-show after an undo.
  fc.toolbox.syncBgField();
  if (!frameCfg) return;
  const boxes = fc.select.getBoxes();
  const fk = frameCfg.frameKind;
  const frames = boxes.filter((b) => b && String(b[cfg.kindField]) === fk);
  // With artboards in the doc the canvas rect is only the pasteboard - this class
  // drops the shell's page chrome (the outer shadow ring) so the artboards are the
  // only page-looking surfaces (plans/141; see parts/tool.css).
  canvasEl.classList.toggle('fc-has-frames', frames.length > 0);
  const info = (b: Box | null): { id: string; w: number; h: number } | null =>
    b ? { id: fc.select.idOf(b, boxes.indexOf(b)), w: num(b[cfg.wField]), h: num(b[cfg.hField]) } : null;
  // plans/179 A11: a still export follows the artboard that CONTAINS the selection,
  // not the primary one. Selecting a card on slide 3 and exporting PNG used to export
  // slide 1. `activeFrameIdFor` is the same resolution the rail's fill swatch uses -
  // a selected artboard, else the one owning the selected box, else primary - so the
  // swatch you just painted and the page you just exported can never disagree.
  const activeId = activeFrameIdFor(boxes, fc.selection, fc.select.frameFields());
  // Ahead of the `activeArtboardKey` dedupe below, which also folds in the PLAYHEAD's
  // artboard and the two sizes - none of which change which board the editor is "on".
  notifyActiveArtboard(fc, frames.length ? activeId : '');
  const sel = activeId
    ? (frames.find((b) => String(b[cfg.idField] ?? '') === activeId) ?? null)
    : null;
  const timedEl = canvasEl.querySelector<HTMLElement>(
    '[data-pdf-page][data-t-start]:not(.seq-off)'
  );
  const timedId = timedEl?.getAttribute('data-frame-id') ?? '';
  const timed = timedId
    ? (frames.find((b) => String(b[cfg.idField] ?? '') === timedId) ?? null)
    : null;
  const detail = { sel: info(sel), timed: info(timed) };
  const key = JSON.stringify(detail);
  if (key === fc.activeArtboardKey) return;
  fc.activeArtboardKey = key;
  if (detail.sel) canvasEl.dataset.fcActiveFrame = detail.sel.id;
  else delete canvasEl.dataset.fcActiveFrame;
  // Fires at mount too (renderChrome), so construct from the element's own realm -
  // a bare CustomEvent here can resolve to Node's own in a jsdom harness.
  const Ev = (canvasEl.ownerDocument?.defaultView?.CustomEvent ??
    CustomEvent) as typeof CustomEvent;
  canvasEl.dispatchEvent(new Ev('fc-artboard', { bubbles: true, detail }));
}
// Align the frame dimmer to the export frame. Runs on every sync (pan / zoom /
// resize) regardless of selection or text-edit state, so the "faded outside the
// frame" cue tracks the artboard wherever it moves.
export function positionFrameScrim(fc: FcCtx): void {
  const { cfg, frameCfg, frameScrim } = fc;
  // With artboards in the doc the canvas rect is just the pasteboard - dimming
  // outside it would mark a false "export frame" (each artboard's own page
  // surface + shadow is the cue, and exports are per-artboard; plans/141 WP-B).
  if (frameCfg && fc.select.getBoxes().some((b) => b && String(b[cfg.kindField]) === frameCfg.frameKind)) {
    frameScrim.hidden = true;
    return;
  }
  frameScrim.hidden = false;
  const m = fc.stage.metrics();
  const wh = fc.helpers.canvasWH();
  const tl = fc.stage.nativeToStage(0, 0, m);
  frameScrim.style.left = tl.x + 'px';
  frameScrim.style.top = tl.y + 'px';
  frameScrim.style.width = wh.w * m.scale + 'px';
  frameScrim.style.height = wh.h * m.scale + 'px';
}
export function syncFrameLabels(fc: FcCtx, boxes: Box[]): void {
  const { cfg, frameCfg, frameLabels, nameField } = fc;
  if (!frameCfg) return;
  if (fc.editing || fc.penDraft || fc.penEdit) {
    if (frameLabels.childElementCount) frameLabels.replaceChildren();
    fc.frameLabelKey = '';
    return;
  }
  const fk = frameCfg.frameKind;
  const of = frameCfg.orderField ?? '';
  const frames = boxes
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => String(b?.[cfg.kindField]) === fk)
    .sort(
      (a, c) => num(a.b?.[of]) - num(c.b?.[of]) || num(a.b?.[cfg.xField]) - num(c.b?.[cfg.xField])
    );
  if (!frames.length) {
    if (frameLabels.childElementCount) frameLabels.replaceChildren();
    fc.frameLabelKey = '';
    return;
  }
  // The NAME is part of the key: a rename has to repaint the tab (plans/179 A10).
  const key = frames
    .map(
      ({ b, i }, n) =>
        `${fc.select.idOf(b, i)}:${n}:${fc.selection.has(fc.select.idOf(b, i)) ? 1 : 0}:${frameLabelText(fc, b, n)}`
    )
    .join('|');
  // Never rebuild under an open rename - the input lives in this container and a
  // replaceChildren would delete it mid-word.
  if (key !== fc.frameLabelKey && !fc.renamingFrameId) {
    fc.frameLabelKey = key;
    frameLabels.replaceChildren(
      ...frames.map(({ b, i }, n) => {
        const id = fc.select.idOf(b, i);
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'fc-frame-label' + (fc.selection.has(id) ? ' is-active' : '');
        el.dataset.frameId = id;
        el.textContent = frameLabelText(fc, b, n);
        if (nameField) {
          el.title = t('Double-click to rename');
          el.setAttribute('aria-keyshortcuts', 'F2 Enter');
        }
        return el;
      })
    );
  }
  const m = fc.stage.metrics();
  const kids = frameLabels.children;
  for (let n = 0; n < frames.length; n++) {
    const el = kids[n] as HTMLElement | undefined;
    if (!el) continue;
    const fb = frames[n]!.b;
    const tl = fc.stage.nativeToStage(num(fb[cfg.xField]), num(fb[cfg.yField]), m);
    const left = `${Math.round(tl.x)}px`;
    const top = `${Math.round(Math.max(2, tl.y - 20))}px`;
    el.style.left = left;
    el.style.top = top;
    // The rename input rides on the same rect as the tab it replaces, so a pan or zoom
    // mid-rename does not leave it behind.
    if (fc.renamingFrameId && fc.select.idOf(fb, frames[n]!.i) === fc.renamingFrameId) {
      const inp = frameLabels.querySelector<HTMLElement>('.fc-frame-rename');
      if (inp) {
        inp.style.left = left;
        inp.style.top = top;
      }
    }
  }
}
/** The tab text for a frame: its own name, else its 1-based place in the PAGE order.
 *  `Artboard` is the key every one of the 26 catalogues already carries; an
 *  `Artboard {n}` key would be a NEW string in none of them, so a French deck would
 *  have regressed from "Plan de travail 1" to "Artboard 1". */
export function frameLabelText(fc: FcCtx, b: Box | undefined, n: number): string {
  const { nameField } = fc;
  const nm = nameField ? String(b?.[nameField] ?? '').trim() : '';
  return nm || `${t('Artboard')} ${n + 1}`;
}
export function startFrameRename(fc: FcCtx, el: HTMLElement, fid: string): void {
  const { frameLabels, nameField } = fc;
  if (!nameField || fc.renamingFrameId || !fid) return;
  const boxes = fc.select.getBoxes();
  const i = boxes.findIndex((b, n) => fc.select.idOf(b, n) === fid);
  if (i < 0) return;
  fc.renamingFrameId = fid;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'fc-frame-rename field-input';
  input.value = String(boxes[i]![nameField] ?? '');
  input.placeholder = el.textContent || '';
  input.setAttribute('aria-label', t('Artboard name'));
  input.spellcheck = false;
  input.style.left = el.style.left;
  input.style.top = el.style.top;
  el.hidden = true;
  frameLabels.appendChild(input);
  input.focus();
  input.select();
  let done = false;
  /**
   * `refocus` is only ever true for a KEY (Enter / Escape): the input is about to be
   * removed and the tab it replaced is about to be rebuilt, so without a hand-back
   * focus falls to `<body>` - where the next Tab restarts at the top of the page and
   * every bare canvas shortcut is live again. A blur, by contrast, means the user has
   * already put the focus somewhere themselves, and taking it back would fight them.
   */
  const finish = (save: boolean, refocus = false): void => {
  const { frameLabels, nameField } = fc;
    if (done) return;
    done = true;
    fc.renamingFrameId = '';
    input.remove();
    el.hidden = false;
    if (save && nameField) {
      const bs = fc.select.getBoxes();
      const j = bs.findIndex((b, n) => fc.select.idOf(b, n) === fid);
      const v = input.value.trim();
      if (j >= 0 && String(bs[j]![nameField] ?? '') !== v) {
        fc.select.commit(bs.map((b, n) => (n === j ? { ...b, [nameField]: v } : b)));
      }
    }
    fc.frameLabelKey = ''; // force the tab to repaint with the new name
    renderChrome(fc);
    // The repaint replaced the tab, so `el` is detached - find the new one by id.
    if (refocus) {
      const back = [...frameLabels.querySelectorAll<HTMLElement>('.fc-frame-label')].find(
        (l) => (l.dataset.frameId || '') === fid
      );
      back?.focus();
    }
  };
  // Typing a name must not reach the canvas shortcuts (every letter is a tool).
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true, true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finish(false, true);
    }
  });
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('pointerdown', (e) => e.stopPropagation());
}
export function paintChrome(fc: FcCtx, boxes: Box[], liveRects: Map<number, Rect> | null): void {
  const { cfg, ctxbar, emptyHint, frameCfg, timeCfg, toolbar } = fc;
  // The one place a selection change is announced (see selListeners) - BEFORE the
  // text-edit / pen early returns, so a listener never misses a change made in
  // those modes. Inert (returns immediately) when nothing is listening.
  fc.select.notifySelection();
  syncFrameLabels(fc, boxes);
  // M2 - reposition the frame scrim only when the artboard geometry changed (pan/
  // zoom/resize set scrimDirty); a box drag/hover/selection change never moves it.
  const movedStage = fc.scrimDirty;
  if (fc.scrimDirty) {
    positionFrameScrim(fc);
    fc.scrimDirty = false;
  }
  // Ghosts and motion paths are both positioned in stage px from the MODEL, exactly
  // like the selection outline, so they have to be re-placed whenever the artboard's
  // geometry or the model moves. Skipped on the LIVE path (`liveRects` non-null = a
  // box drag is in flight) unless the stage itself moved - and the two have SEPARATE
  // reasons, which is worth writing down because the shared line reads like one:
  //
  //   • a GHOST is of an off-playhead box, which is by definition never the one being
  //     dragged, so rebuilding it sixty times a second buys nothing;
  //   • a MOTION PATH is of the box being dragged, and skipping it is what holds the
  //     line still at the pose the drag started from. Not a compromise: no gesture
  //     here writes the model while the pointer is down (see writeGradSpec's note -
  //     it is the discipline all of them follow), `getBoxes()` hands back the input's
  //     own array, and `samplePaths` memoises on that array's IDENTITY plus the
  //     selection and the artboard size. So a paint per pointermove would re-run the
  //     same map over the same samples and draw the same polyline - the path CANNOT
  //     follow a live drag, and the honest picture is the authored one it is still
  //     describing. The commit at pointerup replaces the array, which is the moment
  //     the path is allowed to move.
  if (!liveRects || movedStage) {
    fc.timeline.paintOnion();
    fc.timeline.paintMotion();
  }
  // ── THE ONE RULE, enforcement point 2 of 3: RETENTION (see the file header) ──
  // The chrome below is positioned from the MODEL, mapped through the playhead's own
  // pose (`chromeRect`) - and a HIDDEN box has no pose, because the applier hands its
  // styles back when it leaves the window. So a selected box the sequence is hiding
  // would get a full outline, 8 resize handles, a rotate handle and a contextual bar
  // painted at its authored rect over empty canvas - the "edit a layer you cannot
  // see" failure, and the ONLY drag entry point that never goes through the hit-test
  // (a handle is its own pointerdown target). So the whole apparatus comes down and
  // the reconciliation banner goes up instead.
  if (timeCfg && fc.selection.size && !fc.select.selectionLive(boxes)) {
    const offIdx = fc.select.selIndices(boxes);
    if (offIdx.length) {
      fc.rail.clearChrome();
      fc.rail.hideCtxBar();
      fc.document.closeMorePanel();
      fc.chromeKey = '';
      fc.ctxSelKey = '';
      fc.stage.showOffPlayhead(boxes, offIdx);
      fc.keys.updateToolbarState(0);
      return;
    }
  }
  fc.stage.hideOffPlayhead();
  // While editing text, suppress selection chrome + ctxbar; just keep the floating
  // format bar tracking the box as the stage pans/zooms.
  if (fc.editing) {
    fc.rail.clearChrome();
    fc.rail.hideCtxBar();
    fc.textEdit.positionFmtBar();
    return;
  }
  // Pen mode owns the chrome outright - no selection outline, no resize handles, and the
  // object bar replaced by the pen's own. Same suppression a text edit does, for the same
  // reason: the box's frame is not what is being manipulated.
  if (fc.penDraft || fc.penEdit) {
    fc.rail.clearChrome();
    fc.penTool.penSyncFromModel(boxes);
    if (fc.penDraft || fc.penEdit) {
      fc.penTool.paintPen();
      fc.penTool.syncPenChrome();
      fc.penTool.penCtxBar();
      fc.keys.updateToolbarState(0);
      syncBoxA11y(fc);
      emptyHint.hidden = true;
      return;
    }
  }
  if (fc.penChromeKey) fc.rail.clearPenChrome();
  fc.penTool.paintPen();
  const idx = fc.select.selIndices(boxes);
  const m = fc.stage.metrics();
  // Gradient handles sit UNDER the selection chrome in z-order but are painted here
  // so they track the same pan/zoom sync (and self-exit if their box went away).
  // Gradient mode belongs to ONE box. If the selection moved on, leave the mode -
  // otherwise the ctx bar rebuilds for the new box while the Fill field and Delete
  // still write to the old one, which is silent, wrong, and very hard to spot.
  if (fc.gradEdit != null && !(idx.length === 1 && fc.select.idOf(boxes[idx[0]!], idx[0]!) === fc.gradEdit)) {
    fc.gradient.exitGradEdit();
    fc.ctxSelKey = '';
  }
  fc.gradient.paintGradChrome(boxes, m);
  // M1 - build the outline(s) + handles ONCE per selection set, then only reposition.
  const key = idx.length
    ? idx
        .map((i) => fc.select.idOf(boxes[i], i))
        .sort()
        .join(',')
    : '';
  if (key !== fc.chromeKey) {
    fc.chromeKey = key;
    buildChrome(fc, idx.length); // (re)create nodes for the new set
  }
  positionChrome(fc, boxes, idx, liveRects, m);
  // Contextual bar - rebuilt when the selection set changes OR when the VALUES it shows
  // change (plan 179 A16). The set alone was not enough: Cmd+Z put the old fill back in
  // the model and left the swatch showing the colour that had just been undone, which is
  // the one state a colour control must never be in. The signature is the handful of
  // fields the bar actually paints, so an opacity drag or a text edit still costs nothing.
  const ctxKey = idx.length ? `${key}|${fc.contextBar.ctxValueSig(boxes, idx)}` : '';
  if (ctxKey !== fc.ctxSelKey) {
    fc.ctxSelKey = ctxKey;
    if (idx.length) fc.contextBar.rebuildCtxBar(boxes, idx);
    else {
      fc.rail.hideCtxBar();
      fc.document.closeMorePanel();
      fc.multiTapMode = false;
    }
  }
  // Now that the ctx bar exists (and cannot close the panel again this frame), honour
  // a pending request to open the gradient panel, anchored on the live button.
  if (fc.gradPanelPending && fc.gradEdit != null) {
    fc.gradPanelPending = false;
    const btn = ctxbar.querySelector<HTMLElement>('[data-cx="grad"]');
    if (btn) fc.gradient.openGradPanel(btn);
  }
  if (idx.length) fc.keys.positionCtxBar(boxes, idx, liveRects, m);
  fc.keys.updateToolbarState(idx.length);
  syncBoxA11y(fc);
  // A doc holding only empty ARTBOARDS is still content-empty - keep inviting the
  // first card until a non-frame box exists (a blank Design now seeds Artboard 1).
  const hasContentBox = frameCfg
    ? boxes.some((b) => b && String(b[cfg.kindField]) !== frameCfg.frameKind)
    : boxes.length > 0;
  emptyHint.hidden = hasContentBox || !toolbar.querySelector('.fc-btn-add');
}
// Make each rendered card keyboard-focusable + labelled, and reflect selection state, so
// keyboard users can Tab to a card (which selects it → every onKey action applies) and
// screen readers announce it. The tool template owns the .lolly-box elements; we annotate
// them here after each sync (fresh elements after a re-render arrive without the attrs).
export function syncBoxA11y(fc: FcCtx): void {
  const { canvasEl } = fc;
  canvasEl.querySelectorAll<HTMLElement>('.lolly-box[data-box-id]').forEach((el) => {
    const id = el.getAttribute('data-box-id') || '';
    if (!el.hasAttribute('tabindex')) {
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      el.setAttribute('aria-label', txt ? tRaw('Card: {text}', { text: txt }) : t('Card'));
    }
    const on = fc.selection.has(id);
    if ((el.getAttribute('aria-pressed') === 'true') !== on)
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}
// Create the chrome node set for a selection of `count` boxes (0 = none, 1 = single
// with 8 resize handles + rotate, 2+ = group AABB with 4 corners + rotate). Nodes
// are stored in chromeNodes so subsequent syncs reposition them without recreating
// (or re-binding pointerdown). positionChrome fills in geometry.
export function buildChrome(fc: FcCtx, count: number): void {
  const { chrome } = fc;
  chrome.innerHTML = '';
  const outlines: HTMLElement[] = [];
  const handles: HTMLElement[] = [];
  let groupOutline: HTMLElement | null = null;
  let stem: HTMLElement | null = null;
  let rot: HTMLElement | null = null;
  if (count === 1) {
    const o = document.createElement('div');
    o.className = 'fc-outline';
    outlines.push(o);
    chrome.appendChild(o);
    for (const h of HANDLES) {
      const el = document.createElement('div');
      el.className = 'fc-handle fc-h-' + h;
      el.addEventListener('pointerdown', (e) => fc.gestures.onHandlePointerDown(e, h));
      handles.push(el);
      chrome.appendChild(el);
    }
    stem = document.createElement('div');
    stem.className = 'fc-rot-stem';
    chrome.appendChild(stem);
    rot = document.createElement('div');
    rot.className = 'fc-handle fc-h-rotate';
    rot.setAttribute('data-tip', t('Rotate'));
    rot.addEventListener('pointerdown', (e) => fc.gestures.onHandlePointerDown(e, 'rotate'));
    chrome.appendChild(rot);
  } else if (count > 1) {
    for (let k = 0; k < count; k++) {
      const o = document.createElement('div');
      o.className = 'fc-outline';
      outlines.push(o);
      chrome.appendChild(o);
    }
    groupOutline = document.createElement('div');
    groupOutline.className = 'fc-outline fc-group-outline';
    chrome.appendChild(groupOutline);
    for (const name of ['nw', 'ne', 'se', 'sw'] as Corner[]) {
      const el = document.createElement('div');
      el.className = 'fc-handle fc-h-' + name;
      el.addEventListener('pointerdown', (e) => onGroupHandleDown(fc, e, name));
      handles.push(el);
      chrome.appendChild(el);
    }
    stem = document.createElement('div');
    stem.className = 'fc-rot-stem';
    chrome.appendChild(stem);
    rot = document.createElement('div');
    rot.className = 'fc-handle fc-h-rotate';
    rot.setAttribute('data-tip', t('Rotate group'));
    rot.addEventListener('pointerdown', (e) => onGroupHandleDown(fc, e, 'rotate'));
    chrome.appendChild(rot);
  }
  fc.chromeNodes = { outlines, groupOutline, handles, stem, rot };
}
/**
 * The rect the chrome for box `i` is drawn on: the live DOM rect mid-gesture (else
 * the model's), mapped through whatever pose the playhead has that box in.
 *
 * ⚑ plans/104 section 9.15. The chrome used to be placed from the model ALONE, which is
 * right for an untimed board and wrong the moment a keyframe or a camera moves the
 * box: the outline and all eight handles drew at the authored rect while the artwork
 * sat somewhere else entirely, so the user was offered editing controls over a patch
 * of empty canvas. Section 6.5's rule is that chrome goes through the same fold the
 * render did, and `seqPoseId` is that fold - read back from the applier, never
 * re-evaluated here.
 *
 * The MODEL is still what a gesture writes (an off-diamond edit moves the base; see
 * section 8's latch), so this deliberately changes where the controls are drawn and
 * nothing about what they do.
 *
 * A box with a LIVE rect is the exception, and not an arbitrary one: `applyLiveRect`
 * writes `transform: rotate(...)` straight onto the element, which CLOBBERS the
 * applier's composed pose for the duration of the drag. So mid-gesture the box really
 * is unposed on screen, and posing its chrome would be the original bug with the
 * signs reversed. The live rect is used verbatim, exactly as it always was.
 */
export function chromeRect(fc: FcCtx, boxes: Box[], i: number, liveRects: Map<number, Rect> | null): Rect {
  const { cfg } = fc;
  const live = liveRects?.get(i);
  if (live) return live;
  const r = boxRect(boxes[i], cfg);
  if (!fc.seqPoseOf) return r;
  const pose = fc.select.seqPoseId(fc.select.idOf(boxes[i], i));
  return pose ? posedRect(r, pose) : r;
}
// Reposition the (already-built) chrome nodes for the current selection. Pure style
// writes - pixel-identical to the old build path, just no node churn.
export function positionChrome(fc: FcCtx, 
  boxes: Box[],
  idx: number[],
  liveRects: Map<number, Rect> | null,
  m: Metrics
): void {
  const nodes = fc.chromeNodes;
  if (!nodes) return;
  // Resolved ONCE per sync: a posed rect costs a `querySelector` per box, and the
  // group branch below would otherwise ask for every one of them a second time.
  const rects = idx.map((i) => chromeRect(fc, boxes, i, liveRects));
  for (let k = 0; k < idx.length; k++) {
    const r = rects[k]!;
    const tl = fc.stage.nativeToStage(r.x, r.y, m);
    const o = nodes.outlines[k]!;
    o.style.left = tl.x + 'px';
    o.style.top = tl.y + 'px';
    o.style.width = r.w * m.scale + 'px';
    o.style.height = r.h * m.scale + 'px';
    o.style.transform = r.rot ? `rotate(${r.rot}deg)` : '';
  }
  if (idx.length === 1) {
    positionHandles(fc, rects[0]!, m);
  } else if (idx.length > 1) {
    positionGroupHandles(fc, aabbOfRects(fc, rects), m);
  }
}
export function positionHandles(fc: FcCtx, r: Rect, m: Metrics): void {
  const { cfg } = fc;
  const nodes = fc.chromeNodes;
  if (!nodes) return;
  const box = {
    [cfg.xField]: r.x,
    [cfg.yField]: r.y,
    [cfg.wField]: r.w,
    [cfg.hField]: r.h,
    [cfg.rotationField]: r.rot,
  };
  const corners = boxCorners(box, cfg).map((p: Point) => fc.stage.nativeToStage(p.x, p.y, m)); // TL,TR,BR,BL
  const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const pos: Record<HandleName, Point> = {
    nw: corners[0]!,
    ne: corners[1]!,
    se: corners[2]!,
    sw: corners[3]!,
    n: mid(corners[0]!, corners[1]!),
    e: mid(corners[1]!, corners[2]!),
    s: mid(corners[2]!, corners[3]!),
    w: mid(corners[3]!, corners[0]!),
  };
  HANDLES.forEach((h, k) => {
    const el = nodes.handles[k]!;
    el.style.left = pos[h].x + 'px';
    el.style.top = pos[h].y + 'px';
  });
  // rotate handle: outward from the BOTTOM-edge midpoint along the box "down"
  // normal - kept clear of the contextual bar (which floats above the selection)
  // and the 'n' resize handle, so the two never fight for a grab (Canva-style).
  const ROT_OFFSET = 30;
  const c = fc.stage.nativeToStage(r.x + r.w / 2, r.y + r.h / 2, m);
  const bottom = pos.s;
  const len = Math.hypot(bottom.x - c.x, bottom.y - c.y) || 1;
  const ux = (bottom.x - c.x) / len,
    uy = (bottom.y - c.y) / len;
  const rp = { x: bottom.x + ux * ROT_OFFSET, y: bottom.y + uy * ROT_OFFSET };
  if (nodes.stem) {
    nodes.stem.style.left = bottom.x + 'px';
    nodes.stem.style.top = bottom.y + 'px';
    nodes.stem.style.width = ROT_OFFSET + 'px';
    nodes.stem.style.transform = `rotate(${(Math.atan2(uy, ux) * 180) / Math.PI}deg)`;
  }
  if (nodes.rot) {
    nodes.rot.style.left = rp.x + 'px';
    nodes.rot.style.top = rp.y + 'px';
  }
}
// Axis-aligned native AABB over already-resolved rects (rotation-aware).
export function aabbOfRects(fc: FcCtx, rects: Rect[]): Bounds {
  const { cfg } = fc;
  let a: Bounds | null = null;
  for (const r of rects) {
    for (const p of boxCorners(fc.keys.rectAsBox(r), cfg)) {
      a = a
        ? {
            minX: Math.min(a.minX, p.x),
            minY: Math.min(a.minY, p.y),
            maxX: Math.max(a.maxX, p.x),
            maxY: Math.max(a.maxY, p.y),
          }
        : { minX: p.x, minY: p.y, maxX: p.x, maxY: p.y };
    }
  }
  return a || { minX: 0, minY: 0, maxX: 0, maxY: 0 };
}
// The same AABB over the AUTHORED geometry - live DOM rects during a gesture, else
// the model. This is what a group GESTURE anchors on (its scale/rotate write the
// model), which is why it is deliberately not the posed one `positionChrome` draws.
export function groupAABBNative(fc: FcCtx, 
  idx: number[],
  boxes: Box[],
  liveRects: Map<number, Rect> | null
): Bounds {
  const { cfg } = fc;
  return aabbOfRects(fc, idx.map((i) => (liveRects?.get(i)) || boxRect(boxes[i], cfg)));
}
// Group/multi-selection chrome: an axis-aligned box with 4 corner handles
// (uniform scale) + a rotate handle. Nodes are built by buildChrome; this only
// repositions the group outline, the 4 corner handles (nw,ne,se,sw order) and the
// rotate stem/handle.
export function positionGroupHandles(fc: FcCtx, a: Bounds, m: Metrics): void {
  const nodes = fc.chromeNodes;
  if (!nodes) return;
  const corners: Record<Corner, Point> = {
    nw: fc.stage.nativeToStage(a.minX, a.minY, m),
    ne: fc.stage.nativeToStage(a.maxX, a.minY, m),
    se: fc.stage.nativeToStage(a.maxX, a.maxY, m),
    sw: fc.stage.nativeToStage(a.minX, a.maxY, m),
  };
  if (nodes.groupOutline) {
    nodes.groupOutline.style.left = corners.nw.x + 'px';
    nodes.groupOutline.style.top = corners.nw.y + 'px';
    nodes.groupOutline.style.width = corners.ne.x - corners.nw.x + 'px';
    nodes.groupOutline.style.height = corners.sw.y - corners.nw.y + 'px';
  }
  (['nw', 'ne', 'se', 'sw'] as Corner[]).forEach((name, k) => {
    const el = nodes.handles[k]!;
    el.style.left = corners[name].x + 'px';
    el.style.top = corners[name].y + 'px';
  });
  const bc = { x: (corners.sw.x + corners.se.x) / 2, y: (corners.sw.y + corners.se.y) / 2 };
  if (nodes.stem) {
    nodes.stem.style.left = bc.x + 'px';
    nodes.stem.style.top = bc.y + 'px';
    nodes.stem.style.width = '30px';
    nodes.stem.style.transform = 'rotate(90deg)';
  }
  if (nodes.rot) {
    nodes.rot.style.left = bc.x + 'px';
    nodes.rot.style.top = bc.y + 30 + 'px';
  }
}
export const CORNER_PT = (_fc: FcCtx, a: Bounds, name: Corner): Point =>
  (
    ({
      nw: { x: a.minX, y: a.minY },
      ne: { x: a.maxX, y: a.minY },
      se: { x: a.maxX, y: a.maxY },
      sw: { x: a.minX, y: a.maxY },
    }) as Record<Corner, Point>
  )[name];
export function onGroupHandleDown(fc: FcCtx, e: PointerEvent, name: Corner | 'rotate'): void {
  const { OPPOSITE } = fc;
  e.stopPropagation();
  if (e.button > 0) return;
  const boxes = fc.select.getBoxes();
  const sel = fc.select.selIndices(boxes);
  if (sel.length < 2) return;
  const a = groupAABBNative(fc, sel, boxes, null);
  const centre = { x: (a.minX + a.maxX) / 2, y: (a.minY + a.maxY) / 2 };
  if (name === 'rotate') {
    const m = fc.stage.metrics();
    const cs = fc.stage.nativeToStage(centre.x, centre.y, m);
    const centerClient = { x: cs.x + m.sr.left, y: cs.y + m.sr.top };
    const pointerStartDeg =
      (Math.atan2(e.clientY - centerClient.y, e.clientX - centerClient.x) * 180) / Math.PI;
    fc.gestures.beginGesture(e, {
      type: 'grotate',
      sel,
      startBoxes: boxes,
      centre,
      centerClient,
      pointerStartDeg,
    });
  } else {
    const anchor = CORNER_PT(fc, a, OPPOSITE[name]);
    const origDist =
      Math.hypot(CORNER_PT(fc, a, name).x - anchor.x, CORNER_PT(fc, a, name).y - anchor.y) || 1;
    fc.gestures.beginGesture(e, { type: 'gscale', sel, startBoxes: boxes, anchor, origDist });
  }
}
export function chromeSyncOps(fc: FcCtx) {
  return {
    scheduleSync: bindOp(fc, scheduleSync),
    renderChromeLive: bindOp(fc, renderChromeLive),
    renderChrome: bindOp(fc, renderChrome),
    notifyActiveArtboard: bindOp(fc, notifyActiveArtboard),
    emitActiveArtboard: bindOp(fc, emitActiveArtboard),
    positionFrameScrim: bindOp(fc, positionFrameScrim),
    syncFrameLabels: bindOp(fc, syncFrameLabels),
    frameLabelText: bindOp(fc, frameLabelText),
    startFrameRename: bindOp(fc, startFrameRename),
    paintChrome: bindOp(fc, paintChrome),
    syncBoxA11y: bindOp(fc, syncBoxA11y),
    buildChrome: bindOp(fc, buildChrome),
    chromeRect: bindOp(fc, chromeRect),
    positionChrome: bindOp(fc, positionChrome),
    positionHandles: bindOp(fc, positionHandles),
    aabbOfRects: bindOp(fc, aabbOfRects),
    groupAABBNative: bindOp(fc, groupAABBNative),
    positionGroupHandles: bindOp(fc, positionGroupHandles),
    CORNER_PT: bindOp(fc, CORNER_PT),
    onGroupHandleDown: bindOp(fc, onGroupHandleDown),
  };
}
