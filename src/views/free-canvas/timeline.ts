// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: the timeline panel - mount, clips, onion skin, motion paths, open/close.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `fc.<module>.<fn>`. Extracted verbatim
 * from initFreeCanvas() by scripts/split-closure.ts.
 */
import { num } from '../free-canvas-math.ts';
import type { Box } from '../free-canvas-math.ts';
import type { AddKind, OnionTimeDetail } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

export function watchPoses(fc: FcCtx): void {
  const { canvasEl } = fc;
  if (fc.poseMo || fc.disposed) return;
  fc.poseMo = new MutationObserver(() => {
    if (fc.selection.size) fc.chromeSync.scheduleSync();
  });
  fc.poseMo.observe(canvasEl, { attributes: true, attributeFilter: ['style'], subtree: true });
}
// True when the block already carries authored timing - the auto-open cue. This is a
// field-presence check, not editing arithmetic, so it stays here rather than pulling
// timeline-math in eagerly (that module is part of the lazy chunk).
export function isTimedBox(fc: FcCtx, b: Box): boolean {
  const { timeCfg } = fc;
  if (!timeCfg) return false;
  if (String(b[timeCfg.laneField] ?? '') === 'seq') return true;
  const s = b[timeCfg.startField];
  return Number.isFinite(typeof s === 'number' ? s : parseFloat(String(s ?? '')));
}
export function anyTimed(fc: FcCtx, boxes: Box[]): boolean {
  const { timeCfg } = fc;
  return !!timeCfg && boxes.some(fc.timeline.isTimedBox);
}
export async function ensureTimeline(fc: FcCtx, open: boolean): Promise<void> {
  const { addKinds, blockId, canvasEl, cfg, cv, frameCfg, host, onDirty, runtime, selectionPort, stageEl, timeCfg } = fc;
  if (!timeCfg || fc.disposed) return;
  fc.timelineWantOpen = open;
  if (fc.timelinePanel) {
    fc.timelinePanel.setOpen(open);
    fc.select.syncTimelineBtn();
    // The motion path is gated on `timelinePanel.isOpen()` (see motionIds), and this
    // is the ONE place that answer changes on an already-mounted panel - so this is
    // where the overlay is re-asked, rather than where it happens to be re-asked.
    //
    // It DOES already arrive without this line, and the route matters because
    // it is not one anybody wrote down: `setOpen` calls `reserve()`, which writes (or
    // clears) `--stage-reserve-bottom` on the stage's inline style, which trips the
    // stage MutationObserver, which schedules a sync, which repaints the chrome. Real,
    // measured, and made entirely of other decisions - it holds only while opening and
    // closing happen to reserve different heights and the observer happens to watch
    // attributes. One repaint on a toggle the user pressed is a cheap price for the
    // gate not resting on that.
    fc.chromeSync.renderChrome();
    if (open) fc.narration.maybePromptSequenceFrames();
    else fc.narration.hideSeqPrompt();
    return;
  }
  if (!open) return;
  // A caller that arrives while the chunk is in flight (the `_t` deep link, one tick
  // after the mount-time auto-open) waits for THAT load rather than returning to a
  // panel that does not exist yet.
  if (fc.timelineLoading) {
    await fc.timelineLoad;
    return;
  }
  fc.timelineLoading = true;
  fc.timelineLoad = (async () => {
    try {
      // Lazy for the picker.ts reason: timeline-panel.ts imports its own CSS chunk and
      // the sequence clock, so a static import would ship both to every editor tool.
      // The applier's pose reader rides along in the same round trip - the panel's own
      // graph already contains that module, so this resolves off the module cache.
      const [{ initTimelinePanel }, seqDom] = await Promise.all([
        import('../timeline-panel.ts'),
        import('../../bridge/sequence-dom.ts'),
      ]);
      if (fc.disposed) return; // torn down while the chunk was in flight
      fc.seqPoseOf = seqDom.sequencePoseOf;
      watchPoses(fc); // …and start following what it reports
      fc.timelinePanel = initTimelinePanel({
        stageEl,
        canvasEl,
        runtime,
        host: host as { log?(level: string, msg: string): void },
        blockId,
        // The FRAME sub-field carrying a slide's own transition rides in on the time
        // cfg (plans/179 M4). It is not part of the time model - it lives on the canvas
        // block beside `frameField` - and without it here the panel's "a hand-set
        // Enter/Exit on an artboard stamps `custom`" branch was unreachable in the app:
        // the only thing that ever set the name was a test's own cfg patch, so every
        // hand-set slide transition was still fair game for the next "Place in order".
        cfg: { ...timeCfg, frameTransitionField: frameCfg?.transitionField || '' },
        getBoxes: fc.select.getBoxes,
        commit: fc.select.commit,
        onDirty,
        // The box sub-field carrying rendered text, so the panel's generated
        // caption boxes write cue text where the tool's template reads it.
        textField: cv.textField,
        // The tool's OWN add-kinds, so the panel's plus offers exactly what the rail's
        // does (audio included) instead of hardcoding a list it cannot know.
        addKinds,
        // The canvas selection, adapted: read/write the same Set the overlay uses, and
        // subscribe to the single notifier fired from paintChrome. The SAME object the
        // Design columns are handed (see `selectionPort`).
        selection: selectionPort,
        reserve: fc.select.reserveBottom,
        // The export frame for a camera take (RecordOpts.frame): the active artboard's
        // size, else the canvas - the same answer the size panel gives.
        frameSize: () => {
          const b = fc.select.getBoxes();
          const fi = fc.document.activeFrameIndex(b);
          return fi >= 0
            ? { w: num(b[fi]![cfg.wField]), h: num(b[fi]![cfg.hField]) }
            : fc.helpers.canvasWH();
        },
      });
      fc.timelinePanel.setOpen(fc.timelineWantOpen); // the intent may have flipped mid-load
      // The contextual bar's "+Keyframe" asks the panel for its enabled state and had to
      // stand in for it while the chunk was in flight (see kfCtxHtml). Now that the real
      // rule exists, force ONE rebuild against it - the bar is otherwise only rebuilt
      // when the selection SET changes, so a selection made before the panel loaded would
      // keep the provisional answer for as long as it stands.
      fc.ctxSelKey = null;
      fc.chromeSync.renderChrome();
      if (fc.timelineWantOpen) fc.narration.maybePromptSequenceFrames();
      else fc.narration.hideSeqPrompt();
    } catch (err) {
      console.error('[free-canvas] timeline panel failed to load:', err);
    } finally {
      fc.timelineLoading = false;
      fc.select.syncTimelineBtn();
    }
  })();
  await fc.timelineLoad;
}
export function onTlAdd(fc: FcCtx, e: Event): void {
  const { MAX_ADD_AT_MS, addKinds, timeCfg } = fc;
  if (!timeCfg || fc.disposed) return;
  const d = (e as CustomEvent).detail as
    | { kind?: unknown; atMs?: unknown; asset?: unknown; durSec?: unknown }
    | null
    | undefined;
  const kind = addKinds.find((k) => k.id === (typeof d?.kind === 'string' ? d.kind : ''));
  if (!kind) return;
  const atMs = typeof d?.atMs === 'number' ? d.atMs : Number.NaN;
  if (!Number.isFinite(atMs) || atMs < 0 || atMs > MAX_ADD_AT_MS) return;
  // A finished camera take arrives WITH its asset (the panel's Record a video): no
  // create gesture and no picker - the clip is committed onto the sequence row now.
  // Untrusted detail: the asset must at least be an object with a string id.
  const asset = d?.asset;
  if (asset && typeof asset === 'object' && typeof (asset as { id?: unknown }).id === 'string') {
    const durSec =
      typeof d?.durSec === 'number' && Number.isFinite(d.durSec) && d.durSec > 0
        ? d.durSec
        : null;
    addRecordedClip(fc, kind, asset as Box[string], durSec);
    return;
  }
  // AFTER setMode, never before: enterCreate clears the pending time so that an arm
  // from anywhere else cannot inherit one. This is the single place that sets it.
  fc.modes.setMode('create', { kind });
  fc.pendingAddAtMs = atMs;
}
/**
 * The recorded clip joins the SEQUENCE ROW the way imported scenes do: born from the
 * manifest's clip kind, sized to the ACTIVE artboard (else the canvas) in that
 * frame's own coordinates, cover-fit so the take - already cropped to the export
 * frame by the recorder - fills the picture edge to edge, appended after the current
 * end of the row with its MEASURED length, one commit. Not "at the playhead": a seq
 * clip's start is owned by the magnetic pack (moveOverlay refuses it, by design), and
 * a colleague's clip belongs after what the template already plays. The row repacks
 * from array order, so appending IS the placement.
 */
export function addRecordedClip(fc: FcCtx, kind: AddKind, asset: Box[string], durSec: number | null): void {
  const { cfg, timeCfg } = fc;
  const tc = timeCfg!;
  const boxes = fc.select.getBoxes();
  const fi = fc.document.activeFrameIndex(boxes);
  const fr = fi >= 0 ? boxes[fi]! : null;
  const rect = fr
    ? {
        x: num(fr[cfg.xField]),
        y: num(fr[cfg.yField]),
        w: num(fr[cfg.wField]),
        h: num(fr[cfg.hField]),
      }
    : { x: 0, y: 0, ...fc.helpers.canvasWH() };
  // After the current sequence's end - never disturb existing timing (importAsScenes).
  let at = 0;
  for (const b of boxes) {
    if (String(b[tc.laneField] ?? '') !== 'seq') continue;
    const s = num(b[tc.startField], NaN);
    if (!Number.isFinite(s)) continue;
    const d = num(b[tc.durField], NaN);
    at = Math.max(at, s + (Number.isFinite(d) && d > 0 ? d : 3));
  }
  const id = fc.select.freshId(boxes);
  const box: Box = {
    ...(kind.seed as Box | undefined),
    [cfg.idField]: id,
    [cfg.xField]: rect.x,
    [cfg.yField]: rect.y,
    [cfg.wField]: rect.w,
    [cfg.hField]: rect.h,
    ...(cfg.imageField ? { [cfg.imageField]: asset } : {}),
    ...(cfg.fitField ? { [cfg.fitField]: 'cover' } : {}),
    [tc.laneField]: 'seq',
    [tc.startField]: at,
    ...(durSec != null ? { [tc.durField]: durSec } : {}),
  };
  fc.select.commit(fc.select.assignFrames([...boxes, box], new Set([boxes.length])));
  openTimeline(fc);
  fc.timelinePanel?.selectAndReveal([id]);
}
export function onTlTime(fc: FcCtx, e: Event): void {
  const { timeCfg } = fc;
  if (!timeCfg || fc.disposed) return;
  const d = (e as CustomEvent).detail as OnionTimeDetail | null | undefined;
  fc.tlPlaying = d?.playing === true;
  onionFrom(fc, d);
  fc.chromeSync.renderChrome();
}
export function onionOff(fc: FcCtx): void {
  fc.onionState = null;
  if (!fc.onionSkin) return;
  try {
    fc.onionSkin.destroy();
  } catch (e) {
    console.error(e);
  }
  fc.onionSkin = null;
}
export function onionFrom(fc: FcCtx, d: OnionTimeDetail | null | undefined): void {
  const { canvasEl, cfg, overlay } = fc;
  const mode = d?.mode === 'filled' ? 'filled' : d?.mode === 'outline' ? 'outline' : '';
  if (!mode) {
    onionOff(fc);
    return;
  }
  fc.onionState = {
    mode,
    past: d?.past,
    future: d?.future,
    opacity: d?.opacity,
    active: d?.activeIds,
  };
  if (fc.onionSkin) {
    fc.onionSkin.paint(fc.onionState);
    return;
  }
  if (fc.onionLoading) return;
  fc.onionLoading = true;
  void (async () => {
    try {
      const mod = await import('../onion-skin.ts');
      // The mode may have been turned off again while the chunk was in flight.
      if (fc.disposed || !fc.onionState) return;
      fc.onionSkin = mod.mountOnionSkin({
        overlayEl: overlay,
        canvasEl,
        cfg,
        getBoxes: fc.select.getBoxes,
        metricsOf: fc.stage.metrics,
      });
      fc.onionSkin.paint(fc.onionState);
    } catch (e) {
      console.error(e);
    } finally {
      fc.onionLoading = false;
    }
  })();
}
/** Re-place the ghosts after a pan / zoom / resize - they are positioned in stage px
 *  from the model, exactly like the selection outline, so they move with it. */
export function paintOnion(fc: FcCtx): void {
  if (fc.onionSkin && fc.onionState) fc.onionSkin.paint(fc.onionState);
}
export function motionOff(fc: FcCtx): void {
  if (!fc.motionPath) return;
  try {
    fc.motionPath.destroy();
  } catch (e) {
    console.error(e);
  }
  fc.motionPath = null;
}
/** The ids whose paths should be on screen right now - possibly none. */
export function motionIds(fc: FcCtx, boxes: Box[]): string[] {
  const { timeCfg } = fc;
  if (!timeCfg?.kfField || !fc.selection.size || !fc.timelinePanel?.isOpen()) return [];
  const out: string[] = [];
  for (const i of fc.select.selIndices(boxes)) {
    // The cheap half of the gate lives here so an ordinary selection of ordinary
    // boxes never fetches the chunk at all: a box with no `kf` value cannot have a
    // path, and asking costs one field read. Everything past this point (parse,
    // sample, project) is the lazy module's job.
    const raw = boxes[i]?.[timeCfg.kfField];
    if (raw == null || raw === '') continue;
    out.push(fc.select.idOf(boxes[i], i));
  }
  return out;
}
/**
 * Re-draw the paths. Called from `paintChrome` beside `paintOnion`, so a pan, a zoom,
 * a selection change and every `tl-time` all keep the line under the box it describes.
 */
export function paintMotion(fc: FcCtx): void {
  const { cfg, overlay, timeCfg } = fc;
  if (fc.disposed || !timeCfg?.kfField) return;
  const ids = motionIds(fc, fc.select.getBoxes());
  if (fc.motionPath) {
    fc.motionPath.paint(ids);
    return;
  }
  if (!ids.length || fc.motionLoading) return;
  fc.motionLoading = true;
  void (async () => {
    try {
      const mod = await import('../motion-path.ts');
      // The selection may have changed (or the view gone) while the chunk was in
      // flight, so the paint below asks the model again rather than reusing `ids`.
      if (fc.disposed || !timeCfg) return;
      fc.motionPath = mod.mountMotionPath({
        overlayEl: overlay,
        geom: cfg,
        time: timeCfg,
        getBoxes: fc.select.getBoxes,
        metricsOf: fc.stage.metrics,
        canvasSize: fc.helpers.canvasWH,
      });
      fc.motionPath.paint(motionIds(fc, fc.select.getBoxes()));
    } catch (e) {
      console.error(e);
    } finally {
      fc.motionLoading = false;
    }
  })();
}
/** Open the panel (used by the rail button and after creating a timed box). */
export function openTimeline(fc: FcCtx): void {
  void ensureTimeline(fc, true);
}
export function toggleTimeline(fc: FcCtx): void {
  void ensureTimeline(fc, !fc.timelinePanel?.isOpen());
}
export function destroyTimeline(fc: FcCtx): void {
  const { canvasEl, stageEl } = fc;
  try {
    stageEl.removeEventListener('tl-add', fc.timeline.onTlAdd);
  } catch {
    /* stage detached */
  }
  try {
    stageEl.removeEventListener('tl-time', fc.timeline.onTlTime);
  } catch {
    /* stage detached */
  }
  // No panel means no playhead means nothing to be either side OF - and no arm, so
  // no motion path either (see motionIds).
  onionOff(fc);
  motionOff(fc);
  try {
    fc.timelinePanel?.destroy();
  } catch (e) {
    console.error(e);
  }
  fc.timelinePanel = null;
  // Unconditional, even if destroy() above threw: a leaked reserve permanently shrinks
  // the stage for every other tool mounted in this session.
  stageEl.style.removeProperty('--stage-reserve-bottom');
  fc.rail.dockRailForTimeline(false);
  try {
    canvasEl.dispatchEvent(new Event('canvas-resize'));
  } catch {
    /* stage detached */
  }
}
export function timelineOps(fc: FcCtx) {
  return {
    watchPoses: bindOp(fc, watchPoses),
    isTimedBox: bindOp(fc, isTimedBox),
    anyTimed: bindOp(fc, anyTimed),
    ensureTimeline: bindOp(fc, ensureTimeline),
    onTlAdd: bindOp(fc, onTlAdd),
    addRecordedClip: bindOp(fc, addRecordedClip),
    onTlTime: bindOp(fc, onTlTime),
    onionOff: bindOp(fc, onionOff),
    onionFrom: bindOp(fc, onionFrom),
    paintOnion: bindOp(fc, paintOnion),
    motionOff: bindOp(fc, motionOff),
    motionIds: bindOp(fc, motionIds),
    paintMotion: bindOp(fc, paintMotion),
    openTimeline: bindOp(fc, openTimeline),
    toggleTimeline: bindOp(fc, toggleTimeline),
    destroyTimeline: bindOp(fc, destroyTimeline),
  };
}
