// SPDX-License-Identifier: MPL-2.0
/**
 * timeline-panel: the scene camera rows, poses, tilt preview and presets.
 *
 * Every function takes the shared `tp: TpCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `tp.<module>.<fn>`. Extracted verbatim
 * from initTimelinePanel() by scripts/split-closure.ts.
 */
import { t } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { parseKf } from '../../../../../engine/src/keyframes.ts';
import type { KfPose } from '../../../../../engine/src/keyframes.ts';
import { deriveDuration, indexOfId, isTimed, kfBoxTrack, kfDiamondAt, kfPoseAt, kfTimelineSec, kfWriteMs, rescaleKfTrack, setKfTrack, writeKfPose } from '../timeline-math.ts';
import type { Box } from '../timeline-math.ts';
import { KF_TILT_CONTROL, PRESET_MIN_MS, TILT_CHANNELS, clamp, finite } from '../timeline-config.ts';
import type { KfBaseChannel, TimelineAddKind } from './shared.ts';
import { bindOp, type TpCtx } from './context.ts';

// ── the camera (plans/104 section 5.4, section 8) ─────────────────────────────────────────
//
// A camera is an ordinary box of kind `camera` whose only job is to be animated.
// The panel owns three things about it and nothing else: WHERE its pose is written
// (this section), how it is offered (the Camera inspector group), and whether a
// canvas gesture is currently aimed at it (`cameraModeId`). Every NUMBER is the
// engine's - `resolveCamera` reads the same track this writes.

export const cameraKind = (tp: TpCtx): TimelineAddKind | undefined => { const { addKinds } = tp; return addKinds.find((k) => k.id === 'camera'); };
/** A box is a camera because its kind says so - the hooks' own rule (section 5.4). */
export function isCameraBox(_tp: TpCtx, b: Box | undefined): boolean {
  return !!b && String(b.kind ?? '') === 'camera';
}
/** The scene camera's id, or '' - the FIRST camera in the array (DOM order). */
export function sceneCameraId(tp: TpCtx, rows: Box[]): string {
  const { cfg } = tp;
  for (const b of rows) if (isCameraBox(tp, b)) return String(b?.[cfg.idField] ?? '');
  return '';
}
/**
 * THE IMPLICIT SCENE CAMERA (section 5.4's "default experience", the review's strongest UX
 * finding): the first depth interaction auto-creates ONE untimed camera box.
 *
 * PURE - it returns the array and the id, and commits nothing, so the gesture that
 * triggered it composes the camera and its own write into ONE commit and therefore
 * one undo step. That is the whole reason this is not a `write()`: lifting a box and
 * minting the camera that looks at it is one action to the user, and two ⌘Zs to undo
 * it would be a lie about what just happened.
 *
 * UNTIMED, deliberately: no `start` field, so it renders as an "Always on" scenery
 * chip whose inspector is the scene-camera panel - Depthfield's SCENE DEFAULTS. It
 * becomes a timed clip only when promoted (the existing timed ⇄ always-on switch),
 * and a SECOND camera is how you cut.
 *
 * It is born from the manifest's own `camera` add-kind seed where the tool declares
 * one, exactly as a recorded take is born from the audio seed - the panel never
 * invents a kind. With no seed it still mints `{kind:'camera'}`, because the wire is
 * the contract and the hooks key their marker off `kind` alone.
 *
 * No geometry: a camera has no canvas footprint (section 5.4), and a zero-size box is
 * exactly that - nothing to hit-test, nothing to marquee, nothing to paint.
 */
export function ensureSceneCameraRows(tp: TpCtx, rows: Box[]): { rows: Box[]; id: string } {
  const { cfg } = tp;
  const found = sceneCameraId(tp, rows);
  if (found) return { rows, id: found };
  const id = tp.edit.mintId(rows);
  const box: Box = {
    ...(cameraKind(tp)?.seed as Box | undefined),
    kind: 'camera',
    [cfg.idField]: id,
  };
  return { rows: [...rows, box], id };
}
/**
 * WHERE a camera pose edit arrives, in TIMELINE seconds - or null when it may not land
 * at all. The camera's reading of section 8's latch, and the one place that decides it.
 *
 * Three cases, in order:
 *   • parked ON a diamond → that keyframe. The ordinary latch rule.
 *   • a track of at most ONE key → that key (or t = 0 when there are none). A single
 *     key IS the scene default: evaluation clamp-holds before the first key and after
 *     the last, so with one key the camera holds that pose for the whole sequence.
 *     This is what makes the fresh implicit camera behave as SCENE DEFAULTS - pan it,
 *     dolly it, change its focus, and the whole shot moves - with no keyframe UI in
 *     the way and no auto-keying (section 8's "No auto-key" is about NEW diamonds; there is
 *     no new diamond here).
 *   • a real MOVE (two or more keys), off every diamond → null. Writing the first key
 *     of an authored move from a playhead parked somewhere else would change the shot
 *     everywhere except where the user is looking.
 */
export function cameraPoseAtSec(tp: TpCtx, box: Box, atSec: number): number | null {
  const { cfg } = tp;
  const on = kfDiamondAt(box, cfg, atSec);
  if (on !== null) return atSec;
  const track = kfBoxTrack(box, cfg);
  if (track.length === 0) return kfTimelineSec(box, cfg, 0);
  if (track.length === 1) return kfTimelineSec(box, cfg, track[0]!.t);
  return null;
}
/**
 * Is a canvas gesture currently aimed at the camera (section 8: "camera mode is entered by
 * SELECTION, never a global toggle")? Returns the camera's id, or ''.
 *
 * Three conditions, all of them things the user can SEE: the panel is open (the same
 * reason `kfPoseIds` refuses a shut panel - with no playhead on screen there is no
 * arm), exactly one box is selected and it is a camera, and the playhead is inside
 * its window (a camera that is not running is not the camera you are looking
 * through). Clicking a box exits by ordinary selection semantics; there is nothing
 * to turn off.
 */
export function cameraModeId(tp: TpCtx): string {
  const { cfg, getBoxes, selection } = tp;
  if (!tp.open || !cfg.kfField) return '';
  const sel = selection.get();
  if (sel.length !== 1) return '';
  const rows = getBoxes();
  const i = indexOfId(rows, cfg, sel[0]!);
  if (i < 0 || !isCameraBox(tp, rows[i]!)) return '';
  const box = rows[i]!;
  if (isTimed(box, cfg)) {
    const { start, dur } = tp.rows.span(box, tp.rows.durationSec());
    const at = tp.keyframes.playheadSec();
    if (at < start || at >= start + dur) return '';
  }
  return sel[0]!;
}
/**
 * A camera gesture's delta, folded into whichever key `cameraPoseAtSec` resolved -
 * pure, like `kfPoseWrite`, so the caller commits once on release.
 *
 * `'add'`, because a drag and a wheel are both "from wherever it already was": the
 * channels are absolute on a camera (a keyed channel REPLACES the base), but a
 * gesture's number is a change, and `writeKfPose` composes the two by evaluating the
 * pose at that instant first.
 *
 * WHICH IS ALSO WHY THE TILT BAND IS HELD HERE and not in the caller. `KF_TILT_CONTROL`
 * bounds the RESULT, and a shift-drag only ever supplies a delta - clamping the delta
 * would let three drags of +30° walk `rx` to 90 and past the sign change in `κ` that
 * the depth sort depends on. So the composed value is what gets held: re-evaluate the
 * pose the write is about to start from (the same `kfWriteMs` + `kfPoseAt` reading
 * `writeKfPose` itself takes, so the two cannot disagree about which key that is) and
 * shrink the delta to whatever the band still has room for. A drag that runs into the
 * end of the band simply stops turning, which is what every clamped control does.
 */
export function cameraWrite(tp: TpCtx, boxes: Box[], delta: KfPose): Box[] {
  const { cfg } = tp;
  const id = cameraModeId(tp);
  if (!id) return boxes;
  const i = indexOfId(boxes, cfg, id);
  if (i < 0) return boxes;
  const box = boxes[i]!;
  const at = cameraPoseAtSec(tp, box, tp.keyframes.playheadSec());
  if (at === null) return boxes;
  return writeKfPose(boxes, cfg, id, at, holdTilt(tp, box, at, delta), 'add');
}
/**
 * The tilt half of `cameraWrite`'s clamp - pure, and a no-op by identity on every
 * delta that carries no `rx`/`ry`, so the pan and dolly gestures are byte-unchanged.
 */
export function holdTilt(tp: TpCtx, box: Box, atSec: number, delta: KfPose): KfPose {
  const { cfg } = tp;
  const drx = typeof delta.rx === 'number' ? delta.rx : 0;
  const dry = typeof delta.ry === 'number' ? delta.ry : 0;
  if (!drx && !dry) return delta;
  const from = kfPoseAt(box, cfg, kfWriteMs(box, cfg, atSec), TILT_CHANNELS);
  const held: KfPose = { ...delta };
  const [lo, hi] = KF_TILT_CONTROL;
  if (drx) held.rx = clamp(finite(from.rx, 0) + drx, lo, hi) - finite(from.rx, 0);
  if (dry) held.ry = clamp(finite(from.ry, 0) + dry, lo, hi) - finite(from.ry, 0);
  return held;
}
/**
 * The ABSOLUTE tilt a shift-drag of `(dRx, dRy)` degrees would produce - current pose
 * plus the delta, clamped to the same band `holdTilt` enforces, so the HUD and the
 * write can never disagree. Reads at the latch when the playhead is on/near a key, and
 * falls back to the playhead itself for an authored move parked off every diamond (the
 * gesture still previews an angle even where the commit will be refused). Pure.
 */
export function cameraTiltPreview(tp: TpCtx, 
  boxes: Box[],
  dRx: number,
  dRy: number
): { rx: number; ry: number } | null {
  const { cfg } = tp;
  const id = cameraModeId(tp);
  if (!id) return null;
  const i = indexOfId(boxes, cfg, id);
  if (i < 0) return null;
  const box = boxes[i]!;
  const at = cameraPoseAtSec(tp, box, tp.keyframes.playheadSec());
  const from = kfPoseAt(box, cfg, kfWriteMs(box, cfg, at ?? tp.keyframes.playheadSec()), TILT_CHANNELS);
  const [lo, hi] = KF_TILT_CONTROL;
  return {
    rx: clamp(finite(from.rx, 0) + (Number.isFinite(dRx) ? dRx : 0), lo, hi),
    ry: clamp(finite(from.ry, 0) + (Number.isFinite(dRy) ? dRy : 0), lo, hi),
  };
}
/**
 * One camera preset, expanded onto the camera's own track in ONE commit - creating
 * the scene camera first if there is none (section 8: "inserting writes the camera's kf
 * track (creating the scene camera if absent) in one commit").
 *
 * `parseKf` is the engine's reader and `setKfTrack` re-serialises through the
 * engine's writer, so what arrives is the canonical wire at the section 4.6 quanta - never
 * the literal string, which would put an unvalidated author's text on the wire.
 */
export function applyCameraPreset(tp: TpCtx, preset: { label: string; track: string }): void {
  const { cfg, getBoxes } = tp;
  if (!cfg.kfField) return;
  const seeded = ensureSceneCameraRows(tp, getBoxes());
  // A1#5 - a preset is AUTHORED at a fixed length (4–5.2 s); stretch or compress it so
  // the move fills THIS scene rather than overrunning it or parking the camera early.
  // A scene with no derived duration (a still with no clip timing) keeps the authored
  // length - `deriveDuration` returns 0, and `rescaleKfTrack` treats a 0 target as
  // "leave it", so nothing regresses. The floor keeps a sub-second scene from strobing.
  const sceneMs = deriveDuration(seeded.rows, cfg);
  const track =
    sceneMs > 0
      ? rescaleKfTrack(parseKf(preset.track), Math.max(PRESET_MIN_MS, sceneMs))
      : parseKf(preset.track);
  const next = setKfTrack(seeded.rows, cfg, seeded.id, track);
  tp.helpers.write(next);
  tp.rows.selectAndReveal([seeded.id]);
  announce(t('Camera move: {name}', { name: preset.label }));
}
export const kfBaseField = (tp: TpCtx, ch: KfBaseChannel): string | undefined => { const { cfg } = tp; return cfg[`${ch}Field`]; };
export function cameraOps(tp: TpCtx) {
  return {
    cameraKind: bindOp(tp, cameraKind),
    isCameraBox: bindOp(tp, isCameraBox),
    sceneCameraId: bindOp(tp, sceneCameraId),
    ensureSceneCameraRows: bindOp(tp, ensureSceneCameraRows),
    cameraPoseAtSec: bindOp(tp, cameraPoseAtSec),
    cameraModeId: bindOp(tp, cameraModeId),
    cameraWrite: bindOp(tp, cameraWrite),
    holdTilt: bindOp(tp, holdTilt),
    cameraTiltPreview: bindOp(tp, cameraTiltPreview),
    applyCameraPreset: bindOp(tp, applyCameraPreset),
    kfBaseField: bindOp(tp, kfBaseField),
  };
}
