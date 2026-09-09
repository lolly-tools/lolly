// SPDX-License-Identifier: MPL-2.0
import '../styles/parts/timeline.css';
/**
 * timeline-panel.ts - the docked timeline editor for a `boxes` block that carries the
 * phase-1 time model (plans/53-fable-timeline-phase-2.md section 2).
 *
 * Three hard rules shape everything below, and every one of them exists because the
 * alternative has already bitten this codebase:
 *
 *  1. NO EDITING ARITHMETIC LIVES HERE. Every model mutation goes through
 *     ./timeline-math.ts (packSeq / moveSeqClip / removeAndRipple / trimClip /
 *     trimClips / splitAll / joinClips / detachAudio / reattachAudio / snapTime / deriveDuration /
 *     fmtTime). The panel converts pixels to
 *     seconds and hands seconds to that module. If a gesture needs a new clamp, the
 *     clamp belongs in timeline-math beside the one it must agree with - never
 *     re-derived here, where it would silently drift from the tool hook.
 *  2. THE MODEL IS WRITTEN EXACTLY ONCE PER GESTURE. While a pointer is down the panel
 *     mutates only its OWN DOM (bar left/width, playhead, snapline). `commit()` fires
 *     on pointerup, yielding one coalesced undo step - identical to the canvas gesture
 *     contract. `runtime.setInput` is never called mid-drag.
 *  3. KEYS ARE BOUND ON THE PANEL ROOT, never on window. free-canvas.ts already owns
 *     the window keydown channel (Delete/arrows/Escape on the selected boxes); a second
 *     window listener would fight it. The containment guard (`panelKeysActive`) is the
 *     page-filmstrip.ts pattern, exported so it is unit-testable.
 *
 * The playhead is NOT ours: ./sequence-clock.ts owns time, reads timing only from the
 * live canvas DOM, and never writes the model. The panel asks it to seek and listens to
 * `onTick` to move a line. Filmstrips/waveforms/stills come from ../lib/clip-thumbs.ts,
 * whose cache OWNS the returned ImageBitmaps - so every bitmap is drawn into the bar's
 * own <canvas> SYNCHRONOUSLY on receipt and never retained across an await or a repaint.
 * EVERY bar gets a picture: a filmstrip, a waveform, one tiled still (image / Lottie /
 * tool clip), or - with no media at all - a photograph of the box itself (a frame, a
 * card, a text box, a pen shape), over its own fill as the immediate underlay. That
 * last mode is the expensive one, so it is budgeted per pass and cached by APPEARANCE
 * rather than by identity; see `thumbMode` / `canRasterBox` / `appearanceSig` below.
 *
 * Repaint law (the chromeKey precedent): a full row rebuild happens only when the box
 * SET or a lane assignment changes (`tracksKey`). Everything else - dragging, trimming,
 * zooming, scrolling, the playhead - is style writes against a cached `pxPerSec`.
 */

import { t } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import type { IconName } from '../lib/icons.ts';
import { mountBodyPopover, pointAnchor } from '../components/body-popover.ts';
import { onNodeShotSettled, setAuthoredPoseSeam } from '../lib/clip-thumbs.ts';
import { KF_CLAMPS, KF_Z_FIELD_CLAMP } from '../../../../engine/src/keyframes.ts';
import type { KfChannel, KfPose } from '../../../../engine/src/keyframes.ts';
import { mountEasingEditor } from '../components/easing-editor.ts';
import { authoredStyleOf, borrowAuthoredPose, createSequenceClock } from './sequence-clock.ts';
import type { SequenceClock } from './sequence-clock.ts';
import { resetAppearMemory } from '../lib/motion-model.ts';
import { ONION_MAX_STEPS, boxTiming, indexOfId, isTimed, kfBoxTrack, kfKeyAt, packSeq, seqBoxes, staggerOverlays } from './timeline-math.ts';
import type { Box, TimeCfg } from './timeline-math.ts';
import { DEFAULT_PANEL_H, KF_TILT_CONTROL, KF_Z_SLIDER, SEAM_PX, ZOOM_STEP, finite } from './timeline-config.ts';
import { ONION_DEFAULT, ONION_KEY } from './timeline-panel/shared.ts';
import type { InspectorGroup, KfBaseChannel, OnionPref, TimelineAddKind, TimelinePanelOpts } from './timeline-panel/shared.ts';
import type { TpCtx } from './timeline-panel/context.ts';
import { helpersOps } from './timeline-panel/helpers.ts';
import { rowsOps } from './timeline-panel/rows.ts';
import { menusOps } from './timeline-panel/menus.ts';
import { keyframesOps } from './timeline-panel/keyframes.ts';
import { cameraOps } from './timeline-panel/camera.ts';
import { kfDockOps } from './timeline-panel/kf-dock.ts';
import { inspectorPaneOps } from './timeline-panel/inspector-pane.ts';
import { thumbsOps } from './timeline-panel/thumbs.ts';
import { syncingOps } from './timeline-panel/syncing.ts';
import { gesturesOps } from './timeline-panel/gestures.ts';
import { playbackOps } from './timeline-panel/playback.ts';
import { clipsOps } from './timeline-panel/clips.ts';
import { editOps } from './timeline-panel/edit.ts';
import { recordingOps } from './timeline-panel/recording.ts';
import { subtitlesOps } from './timeline-panel/subtitles.ts';
import { panelOps } from './timeline-panel/panel.ts';
export { canPlayOnce, playOnce, timeToPx, pxToTime, clientToTime, clampPxPerSec, fitPxPerSec, zoomAbout, tracksKey, snapCandidates, isTextControl, panelKeysActive, clampPanelH, tickStep, frameCountFor, isCoarsePointer, edgeBase, MAX_NODE_RASTERS_PER_PASS, MAX_THUMB_PASSES, isPaintedColor, thumbMode, canRasterBox, appearanceSig } from './timeline-panel/shared.ts';
export type { TimelineRuntime, TimelineHost, TimelineSelection, TimelineAddKind, TimelineAddDetail, TimelinePanelOpts, ThumbMode } from './timeline-panel/shared.ts';


// The vector twin vocabulary. Imported for its markup builders ONLY: the panel must
// never gain a static edge to bridge/export.ts (vector-paint imports nothing at all,
// which is why the shared pieces live there), so the two twins that DO need the walker
// reach it through a dynamic import inside the producer.


// The keyframe wire's own vocabulary. The panel does EDITING GLUE only - every keyframe
// NUMBER comes from the engine module or from timeline-math's kf* primitives, and what
// is imported here is exactly the vocabulary a control has to speak to offer a choice:
// the preset tokens the ease picker lists, the two adapters that carry one token to and
// from the shared easing editor's CSS wire, and `parseKf` for "how many poses are on
// this track" - never a `split('*')` of its own.


// The "no clock = every box shows" half of the same contract (plans/179 T2). Taken
// straight from the applier rather than through sequence-clock's re-export list,
// because it is not the clock's: it holds down EVERY writer over the canvas, which is
// what makes an export taken while the panel is shut nest inside the hold.
// `beginAuthoredDom` / `createSequenceTime` / `DRIVE_FPS` come from the same module for
// `playOnce` below: a one-shot preview is a second writer over a stage the panel's own
// clock may already be posing, so it stands that clock down first and composes against
// the AUTHORED styles - exactly the discipline `driveSequenceTime` follows.

// The ONE motion model (plans/179 M4). How a box appears is DERIVED from fields it
// already carries, and the patch that changes it is written in ONE place, so the panel,
// the presenter and the exports can never disagree about what a box means.


// Engine-owned cue grouping (the analysePcm precedent): captions grouped here
// break at the same words a headless render would break at.


// The group predicate only (plans/180): a narration clip stores no name of its own, so
// the row's word is translated at paint time rather than written into the document.

// Transcript-driven editing (plans/174): delete a row cuts that media, strike a
// row greys it. All arithmetic lives in the pure transcript-edit.ts; this panel
// is opened from here so it can reuse this module's getBoxes/write/clock/cfg.


// The transcription rung as a background job (plans/124 section 9, WP-F): the
// consent sheet enqueues and closes, the global toast owns progress and cancel,
// and a finished transcript outlives the panel.


export {
  MIN_PANEL_H,
  DEFAULT_PANEL_H,
  ONE_LANE_H,
  RESERVE_PAD,
  MIN_PPS,
  MAX_PPS,
  ZOOM_STEP,
  EDGE_PX,
  EDGE_PX_COARSE,
  SEAM_PX,
  SNAP_PX_FINE,
  SNAP_PX_COARSE,
  FRAME_S,
  TRIM_SHIFT_FRAMES,
  TAKE_TIMING,
  KF_Z_SLIDER,
  KF_TILT_CONTROL,
  KF_CAMERA_PRESETS,
  PANEL_SHORTCUTS,
  finite,
} from './timeline-config.ts';
export type { PanelShortcut } from './timeline-config.ts';

export interface TimelinePanel {
  destroy(): void;
  setOpen(open: boolean): void;
  isOpen(): boolean;
  /**
   * Panel-owned selection (the adapter mirrors it to the canvas), revealing the first
   * id's clip. The editor-state path (plans/176 v1) routes ids here when the panel is
   * up, so a camera id - no canvas footprint - still reaches the Camera inspector
   * group the way a click on its Always-on chip does.
   */
  selectAndReveal(ids: string[], opts?: { reveal?: boolean }): void;
  /** The playhead in authored seconds - the read half of `seek`. */
  time(): number;
  /**
   * The scenery ⇄ timed writers, exposed so the CANVAS context menu (and free-canvas's
   * timeline-initiated create path) drive the SAME two functions the panel's own
   * inspector, chip and context menu use. There is exactly one implementation of each;
   * everything else is a door onto it. Both are one commit, one undo step.
   *
   * `dur: null` - passed explicitly, distinct from omitting it - means "author no
   * length": the caller knows the box's media length is not knowable yet. See promote's
   * own doc for why that is not the same as the default.
   */
  promote(id: string, want?: { start?: number; dur?: number | null }): void;
  demote(id: string): void;
  /**
   * PLAYHEAD-CONTEXTUAL WRITES, the canvas half (plans/104 section 8).
   *
   * The panel owns the clock and therefore owns the only honest answer to "is this
   * box parked on one of its own keyframes right now". free-canvas asks that at its
   * single pointerup commit and, for the ids that come back, hands the gesture's
   * delta here instead of moving the box - which is what makes a drag on a diamond
   * pose THAT keyframe while a drag anywhere else moves the clip, with no mode, no
   * record-arm and no second gesture to learn.
   *
   * Two calls rather than one so the caller keeps its own writers: `kfPoseIds` is a
   * question (no writes, no side effects), `kfPoseWrite` is a pure transform of a
   * boxes array. Neither commits - the caller composes both halves of a mixed
   * selection into ONE array and makes ONE commit, so a multi-select is one undo step.
   */
  kfPoseIds(ids: readonly string[]): string[];
  /**
   * `mode` is the same distinction `writeKfPose` documents: `'add'` folds a DELTA into
   * the pose the box is already striking (a drag's dx/dy, a rotate's degrees), `'set'`
   * writes the value itself. Resize is the one canvas gesture that is absolute - a
   * dragged handle produces the box's new WIDTH, not a change to it - so it is the
   * caller that knows which reading applies (section 5.2, the P1 w/h reversal).
   */
  kfPoseWrite(boxes: Box[], ids: readonly string[], delta: KfPose, mode?: 'add' | 'set'): Box[];
  /**
   * CAMERA MODE, entered by SELECTION and never by a toggle (plans/104 section 8): the id of
   * the camera a canvas gesture is currently aimed at, or '' when none is.
   *
   * True when the panel is open, exactly one box is selected, it is a camera, and the
   * playhead is inside its window - every one of which is something the user can see
   * on screen. free-canvas asks before it starts a marquee on the empty stage (that
   * drag becomes a camera pan) and before it lets a plain wheel through (that wheel
   * becomes a dolly). Cmd/Ctrl-wheel and Space+drag are the VIEW's and stay the
   * view's: "move the shot" and "move my view" have to stay separable.
   */
  cameraModeId(): string;
  /**
   * The camera gesture's delta, folded into the camera's own track - pure, like
   * `kfPoseWrite`, so the caller commits once on release (a drag) or once per pause (a
   * wheel). Returns the array unchanged when no camera is armed, or when the camera
   * has an authored MOVE and the playhead is off every diamond (section 8's latch, applied to
   * the camera: see `cameraPoseAtSec`).
   */
  cameraWrite(boxes: Box[], delta: KfPose): Box[];
  /**
   * The tilt the camera WOULD hold if a shift-drag of `(dRx, dRy)` degrees committed now
   * - the current pose plus the delta, clamped to the control band (`KF_TILT_CONTROL`),
   * read at the latch. Pure; null when no camera is armed. Drives the canvas tilt HUD: a
   * camera drag previews NOTHING on the stage (section 8 commits on release), so this absolute
   * readout is the only live feedback the gesture has, and the clamp lives here so the
   * HUD can never show an angle the write would not actually reach.
   */
  cameraTiltPreview(boxes: Box[], dRx: number, dRy: number): { rx: number; ry: number } | null;
  /**
   * "+Keyframe", the ACTION (plans/104 section 8's M2.5 revision: "TWO homes, one action").
   *
   * The panel's own transport button, the canvas contextual bar's diamond and the `K`
   * shortcut are three doors onto this one function - there is no second copy of the
   * rules anywhere. It reads the shared selection itself, so a caller passes nothing:
   * a timed box is keyed at the playhead; an UNTIMED one is promoted onto the timeline
   * and keyed in the SAME array, so the whole thing is one commit and one undo step.
   * Boxes with nothing to pose (audio, until plan 101) fall out; an empty selection
   * writes nothing at all.
   */
  addKeyframe(): void;
  /**
   * The SCOPE half of that action, as a question - which of these ids "+Keyframe"
   * would actually key. free-canvas's contextual-bar diamond asks it for its own
   * enabled state, so the two homes of one action share one ENABLEMENT rule as well as
   * one writer: the panel's rule reads the live canvas as well as the model (a box
   * carrying an audio asset is a sound whatever its `kind` says), which a caller
   * re-deriving from the model alone cannot see - it would offer a button that then
   * writes nothing and says nothing.
   *
   * Pure: no writes, no DOM mutation, no announce.
   */
  keyframableIds(ids: readonly string[]): string[];
  /**
   * Park the playhead at an AUTHORED time in seconds - the `_t` deep link's door, and
   * the same seek the ruler makes. A non-finite or negative time parks at 0.
   */
  seek(sec: number): void;
}

/**
 * The seam between two ADJACENT seq clips near `tSec`, if the pointer is within
 * `hitPx` of one. Seams are where junction transitions (cut / crossfade) are authored;
 * `a` is the clip that ends there, `b` the one that starts there.
 */
export function junctionAt(
  boxes: Box[],
  cfg: TimeCfg,
  tSec: number,
  pxPerSec: number,
  hitPx: number = SEAM_PX
): { aId: string; bId: string; t: number } | null {
  const row = seqBoxes(Array.isArray(boxes) ? boxes : [], cfg);
  const pps = finite(pxPerSec, 0);
  if (row.length < 2 || !(pps > 0)) return null;
  const tol = Math.max(0, finite(hitPx, SEAM_PX)) / pps;
  const at = finite(tSec, 0);
  let best: { aId: string; bId: string; t: number } | null = null;
  let bestD = Infinity;
  for (let i = 0; i < row.length - 1; i++) {
    const a = row[i]!;
    const b = row[i + 1]!;
    const aId = a[cfg.idField];
    const bId = b[cfg.idField];
    if (aId == null || aId === '' || bId == null || bId === '') continue;
    const seam = boxTiming(b, cfg).start ?? 0;
    const d = Math.abs(seam - at);
    if (d <= tol && d < bestD) {
      best = { aId: String(aId), bId: String(bId), t: seam };
      bestD = d;
    }
  }
  return best;
}

const onionStep = (v: unknown): number => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? (n < 0 ? 0 : n > ONION_MAX_STEPS ? ONION_MAX_STEPS : n) : 1;
};
const onionOpacity = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? (n < 0 ? 0 : n > 1 ? 1 : n) : 1;
};

function readOnionPref(): OnionPref | null {
  try {
    const raw = localStorage.getItem(ONION_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<OnionPref> | null;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    // Coerced field by field: a hand-edited or half-migrated record must degrade to a
    // usable preference, never to a crash or to a mode nothing draws.
    return {
      mode: o.mode === 'filled' ? 'filled' : 'outline',
      before: onionStep(o.before),
      after: onionStep(o.after),
      opacity: onionOpacity(o.opacity),
    };
  } catch {
    return null; /* storage off, or junk in the slot */
  }
}

export function initTimelinePanel(opts: TimelinePanelOpts): TimelinePanel {
  const tp = {} as TpCtx;
  tp.helpers = helpersOps(tp);
  tp.rows = rowsOps(tp);
  tp.menus = menusOps(tp);
  tp.keyframes = keyframesOps(tp);
  tp.camera = cameraOps(tp);
  tp.kfDock = kfDockOps(tp);
  tp.inspectorPane = inspectorPaneOps(tp);
  tp.thumbs = thumbsOps(tp);
  tp.syncing = syncingOps(tp);
  tp.gestures = gesturesOps(tp);
  tp.playback = playbackOps(tp);
  tp.clips = clipsOps(tp);
  tp.edit = editOps(tp);
  tp.recording = recordingOps(tp);
  tp.subtitles = subtitlesOps(tp);
  tp.panel = panelOps(tp);
  tp.opts = opts;

  const {
    stageEl,
    canvasEl,
    runtime,
    host,
    blockId,
    cfg,
    getBoxes,
    commit,
    selection,
    onDirty,
    reserve,
  } = opts;
  tp.stageEl = stageEl;
  tp.canvasEl = canvasEl;
  tp.runtime = runtime;
  tp.host = host;
  tp.blockId = blockId;
  tp.cfg = cfg;
  tp.getBoxes = getBoxes;
  tp.commit = commit;
  tp.selection = selection;
  tp.onDirty = onDirty;
  tp.reserve = reserve;
  const addKinds: TimelineAddKind[] = Array.isArray(opts.addKinds)
    ? opts.addKinds.filter((k) => k?.id)
    : []; tp.addKinds = addKinds;
  // A new document: the numbers the Appears control remembers are keyed by row id, and an
  // id is only unique inside one document. See `resetAppearMemory`.
  resetAppearMemory();

  tp.open = false;
  tp.disposed = false;
  /**
   * The hold taken over the canvas while the panel is CLOSED (plans/179 T2), and the
   * closure that lifts it. Non-null means "this panel has handed the stage back to its
   * author": no `.seq-off`, no composed pose, and the clock keeping its own time
   * without writing a pixel until the panel opens again.
   */
  tp.seqHold = null;
  tp.panelH = DEFAULT_PANEL_H;
  tp.pxPerSec = 60;
  tp.fitPending = true;
  tp.gesture = null;
  tp.lastKey = '\u0000'; // deliberately unmatchable, so the first sync rebuilds
  // Ditto, for what a bar's PICTURE depends on rather than what its ROW does (see sync).
  tp.lastAppearance = String.fromCharCode(0);
  tp.focusedId = '';
  tp.snapOn = true;
  tp.onionPref = readOnionPref();
  tp.thumbAbort = null;
  tp.cancelIdle = null;
  tp.syncScheduled = false;
  tp.syncMissed = false; // a model change arrived mid-gesture; replay it on release
  tp.moveScheduled = false;

  const bars = new Map<string, HTMLElement>(); tp.bars = bars;
  /**
   * The scenery strip's chips, id → the chip BUTTON (its pill wrapper is the parent).
   * A sibling of `bars` on purpose: together they are "every box the panel is showing",
   * which is exactly the set the inspector may open on. Before this map existed the
   * inspector keyed off `bars` alone, so selecting an untimed box showed nothing at all
   * and there was no route from "always on" to "timed" anywhere in the UI.
   */
  const chips = new Map<string, HTMLElement>(); tp.chips = chips;

  // ── DOM ─────────────────────────────────────────────────────────────────────
  const root = document.createElement('div'); tp.root = root;
  root.className = 'tl-panel';
  root.setAttribute('data-export-hide', ''); // export-safety: never walked into an SVG/PDF
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', t('Timeline'));
  root.tabIndex = -1;
  root.hidden = true;

  const handle = document.createElement('div'); tp.handle = handle;
  handle.className = 'tl-handle';
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'horizontal');
  handle.setAttribute('aria-label', t('Resize timeline'));
  handle.tabIndex = 0;

  const bar = document.createElement('div'); tp.bar = bar;
  bar.className = 'tl-bar';
  // Every glyph now comes from the registry (lib/icons.ts). The `.tl-glyph` CSS
  // drawings this file used to emit for pause / scissors / plus existed only because
  // those three had no registry entry and a hand-inlined 24×24 <svg> here trips the R3
  // primitive guard; zoom in/out were a bare `+`/`−` rather than magnifiers. All five
  // are real entries now, so there is one source of truth for icon shape again.

  const playBtn = tp.helpers.btn('tl-play', t('Play'), icon('play')); tp.playBtn = playBtn;
  const timeEl = document.createElement('span'); tp.timeEl = timeEl;
  timeEl.className = 'tl-time';
  timeEl.setAttribute('aria-live', 'off');

  const addBtn = tp.helpers.btn('tl-add', t('Add to the timeline'), icon('plus')); tp.addBtn = addBtn;
  addBtn.setAttribute('aria-haspopup', 'menu');
  addBtn.setAttribute('aria-expanded', 'false');
  // No declared kinds means the host tool has no create pipeline to arm - the button
  // would open an empty menu, so it is not rendered at all.
  addBtn.hidden = !addKinds.length;
  const splitBtn = tp.helpers.btn('tl-split', t('Split at playhead'), icon('scissors')); tp.splitBtn = splitBtn;
  const snapBtn = tp.helpers.btn('tl-snap', t('Snap to edges'), icon('pin')); tp.snapBtn = snapBtn;
  snapBtn.setAttribute('aria-pressed', 'true');
  // Onion skin - OFF by default, and the button says so before anything is clicked.
  // A long-press / right-click on it opens the options popover (see onionMenu).
  const onionBtn = tp.helpers.btn('tl-onion', t('Onion skin'), icon('filmStrip')); tp.onionBtn = onionBtn;
  onionBtn.setAttribute('aria-pressed', 'false');
  onionBtn.setAttribute('aria-haspopup', 'dialog');
  const zoomOutBtn = tp.helpers.btn('tl-zoom-out', t('Zoom out'), icon('zoomOut')); tp.zoomOutBtn = zoomOutBtn;
  const zoomInBtn = tp.helpers.btn('tl-zoom-in', t('Zoom in'), icon('zoomIn')); tp.zoomInBtn = zoomInBtn;
  const fitBtn = tp.helpers.btn('tl-fit', t('Fit to view'), icon('resize')); tp.fitBtn = fitBtn;
  // The sheet. Bare letters are the only key space the browser leaves alone, so the
  // panel's shortcuts are unguessable by design - this is where they stop being so.
  const keysBtn = tp.helpers.btn('tl-keys', t('Keyboard shortcuts'), icon('keyboard')); tp.keysBtn = keysBtn;
  keysBtn.setAttribute('aria-haspopup', 'dialog');
  const mobileToolsBtn = tp.helpers.btn('tl-mobile-tools', t('More timeline tools'), icon('menuDots')); tp.mobileToolsBtn = mobileToolsBtn;
  mobileToolsBtn.setAttribute('aria-expanded', 'false');

  // ── record-in-place voiceover (track C) ──────────────────────────────────────
  // The button is only rendered when the SHELL can capture audio and the TOOL has
  // declared it needs a microphone; see canRecordVoiceover for why both.
  const micBtn = tp.helpers.btn('tl-mic', t('Record a voiceover'), icon('mic')); tp.micBtn = micBtn;
  micBtn.hidden = true; // decided below, once the capability check has run
  // Scripted voiceover - the mic's typed twin: opens the Script-audio dialog
  // (views/script-audio.ts, on-device TTS) and commits the saved clip at the
  // playhead exactly like a finished take. Feature-detected on `host.speech`,
  // the same progressive-capability terms as the mic (see canRecordVoiceover).
  const scriptBtn = tp.helpers.btn('tl-script', t('Script a voiceover'), icon('speech')); tp.scriptBtn = scriptBtn;
  scriptBtn.hidden = true; // decided below, beside the mic's check
  // Record a VIDEO (Andy, 2026-09-02: a colleague opens the shared link, presses this,
  // and their clip joins the sequence already cut to the export frame). The mic's
  // twin on the camera: same count-in, HUD and teardown, but the take is recorded
  // cover-cropped to `frameSize()` (RecordOpts.frame) and handed to the canvas as a
  // full-frame `clip` through the tl-add seam. Shown on the same progressive terms as
  // the mic (canRecordVideo).
  const camBtn = tp.helpers.btn('tl-cam', t('Record a video'), icon('camera')); tp.camBtn = camBtn;
  camBtn.hidden = true;
  // Screen capture uses the same clip-creation seam as a camera take.
  // The browser-native picker chooses a screen/window/tab; no fake pre-picker UI.
  const screenBtn = tp.helpers.btn('tl-screen', t('Record screen'), icon('monitor')); tp.screenBtn = screenBtn;
  screenBtn.hidden = true;

  /**
   * "+Keyframe" - one of its TWO homes (plans/104 section 8's M2.5 revision).
   *
   * It sits at the END of the left cluster, AFTER the keyboard sheet (section 8's M2.6 pass:
   * "the transport diamond moves to after the keyboard icon"). M2.5 put it fourth,
   * among `+` / mic / script on the reasoning that it is the fourth thing this panel
   * can ADD - but on the built strip that reading did not survive contact: the three
   * additive buttons all put something NEW on a track, and a diamond poses a box that
   * is already there, so it read as an interruption mid-cluster. The other home is the
   * canvas's selected-object contextual bar (views/free-canvas.ts), and both call the
   * SAME exported action - `addKeyframeAction` below - so there is one writer, one set
   * of rules and one undo step however the press arrived.
   *
   * DISABLED, never hidden, when the selection has nothing keyframable in it: a
   * control that vanishes teaches nothing, and this one's whole job is to be the
   * answer to "how do I animate this". `aria-disabled` rather than the `disabled`
   * property, so it keeps its place in the tab order and can still explain itself.
   * A tool whose manifest declares no `kf` sub-field never grows the button at all -
   * the same progressive-capability gate the `+` and the mic already carry.
   */
  const kfBtn = tp.helpers.btn('tl-kf-btn', t('+Keyframe'), icon('keyframe')); tp.kfBtn = kfBtn;
  kfBtn.hidden = !cfg.kfField;

  // Transcript-driven editing (plans/174). Same progressive gate as the rest: a
  // tool that declares no `ignored` sub-field never grows the button. Clicking
  // opens the right-docked Transcript panel for the selected clip (or, if it has
  // no timings yet, offers the same on-device transcription the captions use).
  const transcriptBtn = tp.helpers.btn('tl-transcript', t('Edit transcript'), icon('transcript')); tp.transcriptBtn = transcriptBtn;
  transcriptBtn.hidden = !cfg.ignoredField;

  /** The take HUD: a live level meter and the elapsed clock, shown only during a take. */
  const rec = document.createElement('div'); tp.rec = rec;
  rec.className = 'tl-rec';
  rec.hidden = true;
  const recDot = document.createElement('span'); tp.recDot = recDot;
  recDot.className = 'tl-rec-dot';
  recDot.setAttribute('aria-hidden', 'true');
  const recTime = document.createElement('span'); tp.recTime = recTime;
  recTime.className = 'tl-rec-time';
  // Silent to a screen reader: the elapsed number changes 60 times a second, and the
  // spoken cues that matter (start, the 5-second warning, stop) are announce()d.
  recTime.setAttribute('aria-hidden', 'true');
  const recMeter = document.createElement('span'); tp.recMeter = recMeter;
  recMeter.className = 'tl-rec-meter';
  recMeter.setAttribute('aria-hidden', 'true');
  const recFill = document.createElement('span'); tp.recFill = recFill;
  recFill.className = 'tl-rec-fill';
  recMeter.appendChild(recFill);
  rec.append(recDot, recTime, recMeter);
  /** Permission/again messages. A live region, so a denial is spoken as well as shown. */
  const recNote = document.createElement('span'); tp.recNote = recNote;
  recNote.className = 'tl-rec-note';
  recNote.setAttribute('role', 'status');
  recNote.hidden = true;

  const transport = document.createElement('div'); tp.transport = transport;
  transport.className = 'tl-transport';
  transport.append(playBtn, timeEl);
  const tools = document.createElement('div'); tp.tools = tools;
  tools.className = 'tl-tools';
  // Display capture leads the recording cluster: in a screencast workspace the
  // native screen/window/tab picker is the next step, not a secondary camera verb.
  // It stays feature-detected and hidden on hosts without screen capture.
  // `kfBtn` LAST - the end of the left cluster, after the keyboard sheet (section 8's M2.6).
  // The mobile-only disclosure sits immediately before it so the existing desktop
  // transport contract remains literal: no tool is ever appended after +Keyframe.
  tools.append(
    screenBtn,
    addBtn,
    micBtn,
    camBtn,
    scriptBtn,
    transcriptBtn,
    splitBtn,
    snapBtn,
    onionBtn,
    zoomOutBtn,
    zoomInBtn,
    fitBtn,
    keysBtn,
    mobileToolsBtn,
    kfBtn
  );
  const inspector = document.createElement('div'); tp.inspector = inspector;
  inspector.className = 'tl-inspector';
  bar.append(transport, tools, rec, recNote, inspector);

  const ruler = document.createElement('div'); tp.ruler = ruler;
  ruler.className = 'tl-ruler';
  ruler.setAttribute('role', 'slider');
  ruler.setAttribute('aria-label', t('Playhead'));
  ruler.setAttribute('aria-valuemin', '0');
  ruler.tabIndex = 0;
  const rulerInner = document.createElement('div'); tp.rulerInner = rulerInner;
  rulerInner.className = 'tl-ruler-inner';
  ruler.appendChild(rulerInner);

  const tracks = document.createElement('div'); tp.tracks = tracks;
  tracks.className = 'tl-tracks';
  const inner = document.createElement('div'); tp.inner = inner;
  inner.className = 'tl-tracks-inner';
  const laneWrap = document.createElement('div'); tp.laneWrap = laneWrap;
  laneWrap.className = 'tl-lanes';
  laneWrap.setAttribute('role', 'listbox');
  laneWrap.setAttribute('aria-label', t('Clips'));
  laneWrap.setAttribute('aria-orientation', 'horizontal');
  // Shift-click toggles, so the listbox must say so.
  laneWrap.setAttribute('aria-multiselectable', 'true');
  const scenery = document.createElement('div'); tp.scenery = scenery;
  scenery.className = 'tl-scenery';
  const playhead = document.createElement('div'); tp.playhead = playhead;
  playhead.className = 'tl-playhead';
  const snapline = document.createElement('div'); tp.snapline = snapline;
  snapline.className = 'tl-snapline';
  snapline.hidden = true;
  /**
   * The ghost EXTENT: how far this clip could reach in either direction before it runs
   * out of source. Shown for the length of a trim gesture only (FCP's "available media"
   * idea, drawn rather than implied).
   *
   * A panel-level element positioned in timeline pixels, NOT a child of the bar -
   * `.tl-clip` is `overflow: hidden`, so a child could never paint the one thing this
   * element exists to show, which is the media that is currently OUTSIDE the bar.
   *
   * Solid 1px outline, not dashed: dashed borders in this shell mean "drop area".
   */
  const extent = document.createElement('div'); tp.extent = extent;
  extent.className = 'tl-clip-extent';
  extent.hidden = true;
  extent.setAttribute('aria-hidden', 'true');
  /**
   * The trim readout: absolute duration plus a signed delta, anchored at the edge being
   * dragged (Final Cut's pairing - the absolute number is what you are aiming for, the
   * delta is what you have done). aria-hidden because it changes every frame; the
   * spoken version is one announce() on release.
   */
  const trimBadge = document.createElement('div'); tp.trimBadge = trimBadge;
  trimBadge.className = 'tl-trim-badge';
  trimBadge.hidden = true;
  trimBadge.setAttribute('aria-hidden', 'true');
  /** The rubber-band selection rectangle (drag-select on empty lane space). Positioned
   *  in timeline-content pixels inside `inner`, so it scrolls with the bars. */
  const marquee = document.createElement('div'); tp.marquee = marquee;
  marquee.className = 'tl-marquee';
  marquee.hidden = true;
  marquee.setAttribute('aria-hidden', 'true');
  inner.append(laneWrap, scenery, extent, playhead, snapline, trimBadge, marquee);
  tracks.appendChild(inner);

  root.append(handle, bar, ruler, tracks);
  stageEl.appendChild(root);

  const clock: SequenceClock = createSequenceClock({ canvasEl, host }); tp.clock = clock;

  tp.rulerKey = '\u0000';

  /**
   * The slider's value, written only when the announced tenth actually changes: the
   * ruler is focusable, and rewriting aria-valuenow/valuetext on every clock tick
   * makes a screen reader announce continuously through playback.
   */
  tp.rulerNow = Number.NaN;

  // ── ignored-clip time mapping (plans/174) ───────────────────────────────────
  // The hook compresses ignored SEQ clips out of the CANVAS/clock timebase (their
  // data-t-start/data-seq-ms drop the gap), but the RULER keeps them in place, greyed.
  // So the clock's compressed ("edited") time and the ruler's authored time need mapping.
  // INERT when nothing is struck: `removedMs` is empty, and both maps are the identity -
  // so a document with no strikes is byte-for-byte unchanged. The list is cached and
  // refreshed on every model sync (restyle), never recomputed per playhead tick.
  tp.removedMs = [];

  // ── menus: the `+` add menu and the bar/chip context menu ───────────────────
  //
  // Both are mountBodyPopover instances (components/body-popover.ts) rather than a
  // bespoke menu: that shell already owns Escape, outside-pointerdown dismissal, the
  // focus trap, aria-expanded upkeep and teardown on a route change. The panel is
  // docked at the BOTTOM of the stage, so the placement below flips the menu upwards
  // when there is no room under the anchor.

  /** Kind id → a registry glyph. A Map, never an object, so no prototype key can hit. */
  const KIND_ICON = new Map<string, IconName>([
    ['clip', 'filmStrip'],
    ['video', 'filmStrip'],
    ['audio', 'music'],
    ['image', 'image'],
    ['text', 'font'],
    ['card', 'box'],
    ['box', 'box'],
    ['lottie', 'sparkle'],
    ['tool', 'tool'],
    ['camera', 'camera'],
  ]); tp.KIND_ICON = KIND_ICON;

  const addMenu = mountBodyPopover(
    addBtn,
    (el, pop) => {
      el.textContent = '';
      let first: HTMLElement | null = null;
      for (const k of addKinds) {
        // The label is the MANIFEST's, exactly as the canvas add-menu shows it - the
        // panel must not second-guess a tool's own vocabulary or hardcode the list.
        const item = tp.menus.menuItem(k.label || k.id, KIND_ICON.get(k.id) ?? 'plus', () => {
          pop.close();
          tp.menus.emitAdd(k.id);
        });
        el.appendChild(item);
        first = first ?? item;
      }
      return first;
    },
    {
      className: 'folder-menu tl-menu',
      ariaLabel: t('Add to the timeline'),
      position: tp.menus.menuPosition,
    }
  ); tp.addMenu = addMenu;
  tp.menus.syncOnionBtn();

  const onionMenu = mountBodyPopover(
    onionBtn,
    (el) => {
      el.textContent = '';
      const cur = tp.onionPref ?? ONION_DEFAULT;

      const desc = document.createElement('p');
      desc.className = 'tl-onion-desc';
      desc.textContent = t('Show ghosts of the scenes either side of the playhead.');
      el.appendChild(desc);

      const row = (labelText: string, control: HTMLElement): HTMLElement => {
        const wrap = document.createElement('label');
        wrap.className = 'field-row field-row--inline tl-field tl-onion-row';
        const lab = document.createElement('span');
        lab.className = 'field-label';
        lab.textContent = labelText;
        wrap.append(lab, control);
        return wrap;
      };

      // Mode. A <select> rather than a pair of radios: two mutually exclusive labelled
      // choices is exactly what `.field-select` already is in this panel (the transition
      // kind picker), and forking radio styling here would be a second primitive for the
      // same job. Outlines first, because it is the default and the one that stays
      // legible over an opaque scene.
      const mode = document.createElement('select');
      mode.className = 'field-select tl-select';
      for (const [value, label] of [
        ['outline', t('Outlines')],
        ['filled', t('Filled')],
      ] as const) {
        const o = document.createElement('option');
        o.value = value;
        o.textContent = label;
        mode.appendChild(o);
      }
      mode.value = cur.mode;
      mode.addEventListener('change', () =>
        tp.menus.patchOnion({ mode: mode.value === 'filled' ? 'filled' : 'outline' })
      );
      el.appendChild(row(t('Mode'), mode));

      // Before and after are configured INDEPENDENTLY (the Procreate Dreams pattern):
      // "two behind, none ahead" is a real way to work, and a single symmetric count
      // cannot express it.
      const stepper = (value: number, onCommit: (v: number) => void): HTMLInputElement => {
        const n = document.createElement('input');
        n.className = 'field-input tl-num tl-onion-step';
        n.type = 'number';
        n.min = '0';
        n.max = String(ONION_MAX_STEPS);
        n.step = '1';
        n.value = String(value);
        n.addEventListener('change', () => onCommit(Number(n.value)));
        return n;
      };
      el.appendChild(
        row(
          t('Scenes before'),
          stepper(cur.before, (v) => tp.menus.patchOnion({ before: onionStep(v) }))
        )
      );
      el.appendChild(
        row(
          t('Scenes after'),
          stepper(cur.after, (v) => tp.menus.patchOnion({ after: onionStep(v) }))
        )
      );

      const strength = document.createElement('input');
      strength.className = 'field-range';
      strength.type = 'range';
      strength.min = '10';
      strength.max = '100';
      strength.step = '5';
      strength.value = String(Math.round(cur.opacity * 100));
      // `input`, not `change`: the whole point of the slider is watching the ghosts fade.
      strength.addEventListener('input', () =>
        tp.menus.patchOnion({ opacity: onionOpacity(Number(strength.value) / 100) })
      );
      el.appendChild(row(t('Ghost strength'), strength));

      return mode;
    },
    {
      className: 'folder-menu tl-menu tl-onion-pop',
      role: 'dialog',
      ariaLabel: t('Onion skin options'),
      position: tp.menus.menuPosition,
    }
  ); tp.onionMenu = onionMenu;

  // Plain click toggles; a long press or a right-click opens the options. Escape and the
  // focus restore come free from mountBodyPopover, which is why this is not hand-rolled.
  tp.onionHold = 0;
  tp.onionHeld = false;
  onionBtn.addEventListener('pointerdown', () => {
    tp.onionHeld = false;
    tp.menus.cancelOnionHold();
    tp.onionHold = setTimeout(() => {
      tp.onionHold = 0;
      tp.onionHeld = true;
      onionMenu.open();
    }, 500);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave'])
    onionBtn.addEventListener(ev, tp.menus.cancelOnionHold);
  onionBtn.addEventListener('click', () => {
    // The long press already did something; the click that ends it must not undo it.
    if (tp.onionHeld) {
      tp.onionHeld = false;
      return;
    }
    tp.menus.toggleOnion();
  });
  onionBtn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    tp.menus.cancelOnionHold();
    if (onionMenu.isOpen()) onionMenu.close(true);
    else onionMenu.open();
  });

  const staggerPoint = pointAnchor(); tp.staggerPoint = staggerPoint;
  tp.staggerIds = [];
  tp.lastStaggerMs = 200;
  const staggerPop = mountBodyPopover(
    staggerPoint,
    (el) => {
      el.textContent = '';
      const label = document.createElement('label');
      label.className = 'tl-stagger-label';
      const caption = document.createElement('span');
      caption.textContent = t('Gap between starts (ms)');
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'field-input tl-num';
      input.min = '0';
      input.step = '50';
      input.value = String(tp.lastStaggerMs);
      label.append(caption, input);
      const apply = document.createElement('button');
      apply.type = 'button';
      apply.className = 'btn tl-stagger-apply';
      // "Stagger" was a word for the gesture, not for what it does (plans/179 M4's
      // vocabulary pass): the card deals each selected clip a later start, so it says so.
      apply.textContent = t('Offset starts by');
      const go = (): void => {
        const ms = Math.max(0, Math.round(finite(input.value, tp.lastStaggerMs)));
        tp.lastStaggerMs = ms;
        tp.helpers.write(staggerOverlays(getBoxes(), cfg, tp.staggerIds, ms / 1000));
        staggerPop.close();
      };
      apply.addEventListener('click', go);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          go();
        }
      });
      el.append(label, apply);
      return input;
    },
    {
      className: 'folder-menu tl-menu tl-stagger-pop',
      ariaLabel: t('Offset starts by'),
      position: tp.menus.menuPosition,
    }
  ); tp.staggerPop = staggerPop;

  // ── the bar / chip context menu ─────────────────────────────────────────────

  /** A virtual anchor at the right-click point; `delegate` carries the keyboard route. */
  const ctxPoint = pointAnchor(); tp.ctxPoint = ctxPoint;
  tp.ctxId = '';
  /** Non-null while the menu is acting on a KEPT multi-selection (plans/175 WP-C):
   *  the staggerable members, decided once in openCtxMenu so the open decision and
   *  the render can never disagree. */
  tp.ctxMulti = null;

  const ctxMenu = mountBodyPopover(
    ctxPoint,
    (el, pop) => {
      const rows = getBoxes();
      const i = tp.ctxId ? indexOfId(rows, cfg, tp.ctxId) : -1;
      if (i < 0) {
        // mountBodyPopover appends, positions and focus-traps whatever this render leaves
        // behind - a null return only means "don't move focus", not "don't open". Bail out
        // of the open itself, or a box that vanished between openCtxMenu's check and here
        // paints an empty, focus-trapped card. Unreachable today (openCtxMenu re-checks in
        // the same tick); one microtask is the cheap insurance against that ever deferring.
        queueMicrotask(() => pop.close());
        return null;
      }
      const timed = isTimed(rows[i]!, cfg);
      el.textContent = '';
      const act = (fn: () => void) => () => {
        pop.close();
        fn();
      };
      // A KEPT multi-selection (plans/175 WP-C) gets the selection-wide actions and
      // nothing else: mixing per-box rows in would act on one bar while several stay
      // painted selected - the exact state the collapse rule below exists to prevent.
      if (tp.ctxMulti && tp.ctxMulti.length >= 2) {
        const n = tp.ctxMulti.length;
        el.appendChild(
          tp.menus.menuItem(
            t('Offset starts by…'),
            'layers',
            act(() => tp.menus.openStaggerPop(tp.ctxMulti ?? [])),
            {
              sub: t(
                'Deals the {n} selected clips an even gap, each starting after the one before.',
                { n: String(n) }
              ),
            }
          )
        );
        return el.querySelector<HTMLElement>('.folder-menu-item');
      }
      if (timed) {
        // Exactly the writers that already exist - the context menu is a second DOOR onto
        // them, never a second implementation (see promote/demote above).
        el.appendChild(
          tp.menus.menuItem(
            t('Split at playhead'),
            'scissors',
            act(() => {
              tp.rows.selectAndReveal([tp.ctxId]);
              tp.playback.splitAtPlayhead();
            })
          )
        );
        // Video only, and absent (never greyed) otherwise - the same offered-only-
        // where-real rule as Join/Subtitles below.
        if (tp.clips.canExportFrame(tp.ctxId)) {
          el.appendChild(
            tp.menus.menuItem(
              t('Export frame'),
              'camera',
              act(() => {
                void tp.clips.exportFrameAt(tp.ctxId);
              }),
              { sub: t('Saves the frame under the playhead as a PNG, at full resolution.') }
            )
          );
        }
        // Remove background: make a transparent alternative asset for this video clip's
        // source on device (the shared video-job dialog, op 'matte'). Offered only where
        // it is real - the same video + staged-model gate the catalog detail modal uses.
        if (tp.clips.canVideoMatte(tp.ctxId)) {
          el.appendChild(
            tp.menus.menuItem(
              t('Remove background…'),
              'scissors',
              act(() => {
                void tp.clips.videoMatteAt(tp.ctxId);
              }),
              { sub: t('Makes a transparent copy you can swap onto this track.') }
            )
          );
        }
        // Join is offered only where it is REAL: a cut whose two sides are still perfectly
        // contiguous, on either side of this clip. Everywhere else the item is absent
        // rather than disabled - a menu of greyed-out rows teaches nothing.
        const join = tp.clips.throughNeighbour(tp.ctxId, rows);
        if (join)
          el.appendChild(
            tp.menus.menuItem(
              t('Join clips'),
              'link',
              act(() => tp.clips.joinAt(join.aId, join.bId))
            )
          );
        const partner = tp.clips.partnerOf(tp.ctxId, rows);
        if (partner) {
          el.appendChild(
            tp.menus.menuItem(
              t('Re-attach audio'),
              'volumeOn',
              act(() => tp.clips.reattachAudioAt(tp.ctxId)),
              { sub: t('Puts the sound back on the clip it came from.') }
            )
          );
        } else if (tp.clips.canDetach(tp.ctxId)) {
          el.appendChild(
            tp.menus.menuItem(
              t('Detach audio'),
              'volumeOff',
              act(() => tp.clips.detachAudioAt(tp.ctxId)),
              { sub: t('Puts the sound on its own lane so you can move and trim it separately.') }
            )
          );
        }
        // Mute clip audio: a SECOND DOOR onto the inspector's mute toggle (the same
        // `cfg.muteField` write, never a second implementation - see the promote/demote
        // rule above). Offered only where there is sound to silence - a clip with its own
        // audio, or one of a detached-audio pair - the same offered-only-where-real rule
        // as Join/Detach above, never on a silent still.
        if (tp.clips.canDetach(tp.ctxId) || partner) {
          const muted = rows[i]![cfg.muteField] === true || rows[i]![cfg.muteField] === 'true';
          el.appendChild(
            tp.menus.menuItem(
              muted ? t('Unmute clip') : t('Mute clip'),
              muted ? 'volumeOff' : 'volumeOn',
              act(() =>
                tp.helpers.write(tp.helpers.patchBox(getBoxes(), tp.ctxId, { [cfg.muteField]: muted ? '' : 'true' }))
              ),
              { sub: t('Silences this clip’s own sound without removing it.') }
            )
          );
        }
        // Subtitles, for a clip with sound - absent (never greyed) when no timing
        // source is reachable, the same offered-only-where-real rule as Join.
        if (tp.subtitles.canGenerateSubtitles(tp.ctxId)) {
          el.appendChild(
            tp.menus.menuItem(
              t('Generate subtitles'),
              'speech',
              act(() => {
                void tp.subtitles.generateSubtitles(tp.ctxId);
              }),
              { sub: t('Adds timed caption boxes you can edit like any clip.') }
            )
          );
        }
        el.appendChild(
          tp.menus.menuItem(
            t('Make always on'),
            'layers',
            act(() => tp.rows.demote(tp.ctxId))
          )
        );
      } else {
        el.appendChild(
          tp.menus.menuItem(
            t('Add to the timeline'),
            'plus',
            act(() => tp.rows.promote(tp.ctxId))
          )
        );
      }
      // Rename: the second door onto the double-click inline editor. Needs a BAR to
      // anchor the input, so a scenery chip (no bar) does not offer it.
      // Download: the clip's own source file, wherever the clip carries one - a bar, a
      // scenery chip, an audio box alike (Andy, 2026-09-03).
      if (tp.clips.canDownload(tp.ctxId))
        el.appendChild(
          tp.menus.menuItem(
            t('Download'),
            'download',
            act(() => {
              void tp.clips.downloadClipAt(tp.ctxId);
            })
          )
        );
      if (cfg.labelField && bars.has(tp.ctxId)) {
        el.appendChild(
          tp.menus.menuItem(
            t('Rename'),
            'tag',
            act(() => tp.rows.renameClip(tp.ctxId))
          )
        );
      }
      el.appendChild(
        tp.menus.menuItem(
          t('Delete'),
          'trash',
          act(() => tp.edit.deleteBox(tp.ctxId)),
          { danger: true }
        )
      );
      return el.querySelector<HTMLElement>('.folder-menu-item');
    },
    {
      className: 'folder-menu tl-menu tl-ctx-menu',
      ariaLabel: t('Clip actions'),
      position: tp.menus.menuPosition,
    }
  ); tp.ctxMenu = ctxMenu;

  /**
   * The diamond's own menu: the three things section 3 lists on the transport's right -
   * EASING / DUPLICATE / DELETE - offered where the pointer already is.
   *
   * Pointer sugar again, and the same three actions are labelled buttons in the
   * inspector's list, so nothing here is the only way to reach anything.
   */
  const kfCtxPoint = pointAnchor(); tp.kfCtxPoint = kfCtxPoint;
  tp.kfCtxId = '';
  tp.kfCtxT = 0;

  const kfCtxMenu = mountBodyPopover(
    kfCtxPoint,
    (el, pop) => {
      const rows = getBoxes();
      const i = tp.kfCtxId ? indexOfId(rows, cfg, tp.kfCtxId) : -1;
      const key = i < 0 ? null : kfKeyAt(kfBoxTrack(rows[i]!, cfg), tp.kfCtxT);
      if (!key) {
        queueMicrotask(() => pop.close());
        return null;
      }
      el.textContent = '';
      const act = (fn: () => void) => () => {
        pop.close();
        fn();
      };
      // ONE SURFACE (section 8's M2.7): the curve editor is DOCKED in the Keyframes popup, so
      // this item opens that popup on this keyframe rather than spawning a second,
      // nested editor of its own - which is exactly what a left-click on the same
      // diamond already does. The item stays because a context menu that lists Duplicate
      // and Delete and not the third thing you can do to a keyframe is a menu with a
      // hole in it.
      el.appendChild(
        tp.menus.menuItem(
          t('Keyframe curve'),
          'animate',
          act(() => tp.keyframes.openKeyframeAt(tp.kfCtxId, tp.kfCtxT))
        )
      );
      el.appendChild(
        tp.menus.menuItem(
          t('Duplicate keyframe'),
          'duplicate',
          act(() => tp.keyframes.duplicateKeyframe(tp.kfCtxId, tp.kfCtxT))
        )
      );
      el.appendChild(
        tp.menus.menuItem(
          t('Delete keyframe'),
          'trash',
          act(() => tp.keyframes.deleteKeyframe(tp.kfCtxId, tp.kfCtxT)),
          { danger: true }
        )
      );
      return el.querySelector<HTMLElement>('.folder-menu-item');
    },
    {
      className: 'folder-menu tl-menu tl-ctx-menu',
      ariaLabel: t('Keyframe actions'),
      position: tp.menus.menuPosition,
    }
  ); tp.kfCtxMenu = kfCtxMenu;

  // ── the selected-clip inspector (precision + a11y fallback for every gesture) ──

  tp.inspectorKey = '\u0000';

  /**
   * ENTERING is not the same as CHANGING. The inspector is a whole row of controls that
   * lands in a toolbar the user is already looking at, and watching it land is the
   * complaint that started this: three regions of chrome appeared between two adjacent
   * frames of a screen recording, one of them clipping a tool button, with nothing to
   * lead the eye. So the arrival is announced - `is-entering` runs one short fade and
   * rise - and ONLY the arrival: a field edit or a scrub rebuilds this row constantly,
   * and re-running the cue on every one of those is its own kind of noise.
   *
   * Reduced motion is honoured in the sheet rather than by withholding the class, so
   * the cue still exists for someone who asked for less movement - it just does not
   * move.
   */
  tp.inspectorShown = false;
  /**
   * WHICH box the inspector row currently describes. The group segments are built
   * inside `renderInspector` but pressed long afterwards, so a head's click handler
   * reads this rather than closing over an `id` that a later rebuild has replaced.
   */
  tp.inspectorId = '';
  tp.inspectorEnterT = null;

  /* ── the custom-easing popover ─────────────────────────────────────────────
     ONE instance for both directions: which box and which field it writes are
     `easeId` / `easeField`, set by the trigger before `open()`. The trigger itself
     cannot be the anchor - the inspector rebuilds its controls on every commit, so
     the `<select>` that opened this is a detached node moments later. `pointAnchor`
     with a `delegate` is the same shape openCtxMenu already uses for exactly that:
     the point supplies geometry, the delegate takes the focus restore.

     Body-mounted (via mountBodyPopover) rather than parented in the panel, because
     the panel is a fixed-position band whose descendants must never become the
     containing block for this card - the trap documented on `.tl-panel` and
     `.fc-toolbar`. Escape, the outside click and the focus restore come free with it. */
  const easePoint = pointAnchor(); tp.easePoint = easePoint;
  tp.easeId = '';
  tp.easeField = '';
  tp.easeEditor = null;

  const easeMenu = mountBodyPopover(
    easePoint,
    (el, pop) => {
      const rows = getBoxes();
      const i = tp.easeId ? indexOfId(rows, cfg, tp.easeId) : -1;
      if (i < 0 || !tp.easeField) {
        queueMicrotask(() => pop.close());
        return null;
      }
      tp.easeEditor?.destroy();
      tp.easeEditor = mountEasingEditor(el, {
        value: rows[i]![tp.easeField],
        // The same one-commit / one-undo-step write every other field in this row makes.
        onCommit: (wire) => tp.helpers.write(tp.helpers.patchBox(getBoxes(), tp.easeId, { [tp.easeField]: wire })),
      });
      return tp.easeEditor.focusTarget;
    },
    {
      className: 'folder-menu tl-menu tl-ease-pop',
      role: 'dialog',
      ariaLabel: t('Custom easing curve'),
      position: tp.menus.menuPosition,
    }
  ); tp.easeMenu = easeMenu;

  /**
   * The transport button's enabled state, memoised on the ACHIEVED state rather than
   * on the selection: this runs on every repaint, and the attribute must not be
   * rewritten on each one. Disabled - `aria-disabled`, never `hidden` - is a real
   * state here: with nothing keyframable selected the button stays in place and its
   * tooltip says what would make it work.
   */
  tp.kfBtnKey = '\u0000';
  kfBtn.addEventListener('click', () => {
    if (kfBtn.getAttribute('aria-disabled') === 'true') return;
    tp.keyframes.addKeyframeAction({ speak: true });
  });
  tp.kfLatch = null;
  tp.kfLatchKey = '\u0000';
  /** The live camera-channel controls of the row on screen, or null (section 8's Camera group). */
  tp.kfCam = null;
  tp.kfCamKey = '\u0000';

  /** The pose readout's own memo - see `syncKfLatch` for why the two are separate. */
  tp.kfPoseKey = '\u0000';

  /**
   * The pose channels the inspector offers, and the form of each control.
   *
   * Six, and the reason they are these six: `x`/`y`/`r`/`w`/`h` are authored ON THE
   * CANVAS (drag, rotate and resize, redirected at free-canvas's single pointerup
   * commit), so duplicating them as number fields here would be a second, worse door
   * onto a gesture that already works. These are the ones with no canvas handle.
   *
   * `z` clamps to the FIELD range (`KF_Z_FIELD_CLAMP`), not the wider wire range: the
   * wire has to carry a camera dolly, a control does not, and a depth a user can
   * scrub to should stay inside the band the guard never has to rescue (section 5.1). It is
   * also the only one with a SLIDER.
   *
   * P2.1 put TILT X / TILT Y beside it, and they sit beside it deliberately: depth and
   * the two tilt angles are the three channels that describe where the card is in
   * space, and scale/opacity/blur are what it looks like once it is there. They take
   * `KF_TILT_CONTROL` (±75) for the camera rows' reason exactly - past a quarter turn
   * `κ` changes sign and the depth sort inverts - and they are BOX angles, so their
   * sense is CSS's own `rotateY(ry) rotateX(rx)`: a box `rx` and a camera `rx` tip the
   * picture in OPPOSITE directions (moving the camera down is moving the world up).
   */
  const KF_POSE_FIELDS: ReadonlyArray<{
    ch: KfChannel;
    label: string;
    step: number;
    range: readonly [number, number];
    /** Present on the ONE channel that also has a slider beside the number (`z`). */
    slider?: readonly [number, number];
    /**
     * The box sub-field this channel falls back to when the playhead is OFF every
     * diamond - section 8's "edits write the base". Three channels have one - depth and
     * the two tilt angles are properties of the BOX that a keyframe may override for a
     * segment - while scale/opacity/blur have no per-box base the pose row could write.
     */
    base?: KfBaseChannel;
  }> = [
    {
      ch: 'z',
      label: t('Depth'),
      step: 10,
      range: KF_Z_FIELD_CLAMP,
      slider: KF_Z_SLIDER,
      base: 'z',
    },
    { ch: 'rx', label: t('Tilt X'), step: 5, range: KF_TILT_CONTROL, base: 'rx' },
    { ch: 'ry', label: t('Tilt Y'), step: 5, range: KF_TILT_CONTROL, base: 'ry' },
    { ch: 's', label: t('Scale'), step: 0.05, range: KF_CLAMPS.s },
    { ch: 'o', label: t('Opacity'), step: 0.05, range: KF_CLAMPS.o },
    { ch: 'b', label: t('Blur'), step: 0.5, range: KF_CLAMPS.b },
  ]; tp.KF_POSE_FIELDS = KF_POSE_FIELDS;

  /**
   * The CAMERA's own channels, as the section 8 camera panel offers them - pose, tilt, focus,
   * aperture and perspective, each with the affordance chip Depthfield puts on the
   * same row (section 3's observed UI: DRAG for pan, SCROLL for the dolly).
   *
   * `p` is labelled as FOV STRENGTH and never "zoom": `eff(z = camZ) === 1` for every
   * value of p, so p changes the perspective, not the magnification - a dolly (`z`) is
   * what magnifies (section 4.3). Calling this control "zoom" is the one naming mistake this
   * feature can make, and the plan names it twice.
   *
   * P2 PUT THE TILT ROWS HERE (this is the seam the M2.5 comment reserved). They sit
   * between the pans and the dolly because that is the order a shot is set up in - where
   * the camera is, which way it is pointing, how far away it is - and they carry the
   * SHIFT-DRAG chip, the gesture section 8 reserved for them at M2.5 and P2 finally spends.
   *
   * The labels are TILT X / TILT Y, the reference tool's own words, and not "pitch"/
   * "yaw": those are the correct terms and nobody outside a flight sim uses them. Signs
   * are the engine's (`surfaceMatrix`): **negative Tilt X pitches the camera down over
   * the artwork** - the near edge to the bottom of frame, the far edge receding to a
   * horizon - which is the POV shot the Surface glide preset is built from. Positive
   * Tilt Y brings the right-hand edge nearer.
   *
   * Ranges come from the engine's own clamp table, never re-typed here - with the two
   * tilt rows the deliberate exception, held to `KF_TILT_CONTROL` (±75) rather than to
   * the ±180 WIRE clamp. That is not taste trimming: past a quarter turn `κ` changes
   * sign and `buildPlan`'s depth sort inverts, so ±180 on a control is a reachable
   * wrong picture. See `KF_TILT_CONTROL` for the derivation; `cameraWrite` holds the
   * shift-drag to the same band so the two doors onto tilt cannot disagree.
   */
  const KF_CAMERA_FIELDS: ReadonlyArray<{
    ch: KfChannel;
    label: string;
    step: number;
    range: readonly [number, number];
    hint?: string;
  }> = [
    { ch: 'x', label: t('Pan X'), step: 10, range: KF_CLAMPS.x, hint: t('Drag') },
    { ch: 'y', label: t('Pan Y'), step: 10, range: KF_CLAMPS.y, hint: t('Drag') },
    { ch: 'rx', label: t('Tilt X'), step: 5, range: KF_TILT_CONTROL, hint: t('Shift-drag') },
    { ch: 'ry', label: t('Tilt Y'), step: 5, range: KF_TILT_CONTROL, hint: t('Shift-drag') },
    { ch: 'z', label: t('Dolly'), step: 10, range: KF_CLAMPS.z, hint: t('Scroll') },
    { ch: 'f', label: t('Focus'), step: 10, range: KF_CLAMPS.f },
    { ch: 'a', label: t('Aperture'), step: 0.05, range: KF_CLAMPS.a },
    { ch: 'p', label: t('FOV strength'), step: 50, range: KF_CLAMPS.p },
  ]; tp.KF_CAMERA_FIELDS = KF_CAMERA_FIELDS;

  /**
   * The live segments of the row just built, by group id - what the popover machinery
   * re-points itself at after a rebuild.
   */
  const groupsById = new Map<string, InspectorGroup>(); tp.groupsById = groupsById;

  /** Which group is showing, and for which box. Session UI state; never the model. */
  tp.openGroup = null;
  /** The popover's own content host, so a rebuild can swap the body inside it. */
  tp.groupPopHost = null;
  /**
   * A POINT anchor, not the head button: the inspector is rebuilt on every commit, so
   * the button that opened the popover is a detached node moments later. The point
   * supplies geometry and its `delegate` - re-pointed by `renderInspector` - receives
   * the focus restore and the `aria-expanded` upkeep. Exactly the pattern the ease
   * editor already uses, and the reason the M2 fix round established it.
   */
  const groupPoint = pointAnchor(); tp.groupPoint = groupPoint;

  const groupPop = mountBodyPopover(
    groupPoint,
    (el) => {
      el.textContent = '';
      const host = document.createElement('div');
      host.className = 'tl-group-pop-body';
      el.appendChild(host);
      tp.groupPopHost = host;
      const g = tp.openGroup ? groupsById.get(tp.openGroup.gid) : null;
      if (g) {
        g.body.hidden = false;
        host.appendChild(g.body);
        // WHICH group this is, not the constant "Clip settings" - every group opens
        // the same popover, so a dialog that always announces the same name never tells a
        // screen-reader user which one they just opened. Set after `open()` has already
        // stamped the fallback, so the constant only ever survives the (unreachable)
        // no-group case.
        el.setAttribute('aria-label', g.label);
      }
      // Focus the first real control, so a keyboard user lands ON the fields the press
      // revealed rather than on the popover box. `trapFocus` keeps them there until Esc.
      return host.querySelector<HTMLElement>('input, select, button, [tabindex]') ?? host;
    },
    {
      className: 'folder-menu tl-menu tl-group-pop',
      role: 'dialog',
      ariaLabel: t('Clip settings'),
      position: tp.kfDock.groupPopPosition,
      // The bodies borrowed into this card carry the ease `<select>`s, and picking
      // "Custom…" opens a curve editor - a SIBLING popover on `document.body`, so
      // `menu.contains()` says false and the first press inside it would otherwise
      // dismiss this card mid-drag (and hide the very `<select>` the editor restores
      // focus to). `.tl-ease-pop` is the class both curve editors mount with.
      isInside: (n) => {
        const el = (n as Element | null)?.closest
          ? (n as Element)
          : ((n as ChildNode | null)?.parentElement ?? null);
        return !!el?.closest('.tl-ease-pop');
      },
      // EVERY route out - Escape, an outside press, a route change, the caller's own
      // close - lands here, which is what makes the borrowed body safe: the popover is
      // about to detach its element, and the group's live body is inside it.
      onClose: () => tp.kfDock.restoreGroupBody(),
    }
  ); tp.groupPop = groupPop;

  /**
   * The snap candidate currently engaged, so a NEWLY engaged snap can be felt as well
   * as seen. Reset by endGesture; null means "nothing is snapped right now".
   */
  tp.snappedAt = null;

  /**
   * The three edge states, armed. Every class added here comes off in endGesture - the
   * single teardown - and never at a call site, matching the `is-drop-target` discipline.
   */
  /** A drag has to travel this far vertically before it reads as a lane change. */
  const LANE_DRAG_PX = 14; tp.LANE_DRAG_PX = LANE_DRAG_PX;
  /** Pointer within this of a row boundary reads as the GAP, not the row. */
  const LANE_EDGE_PX = 6; tp.LANE_EDGE_PX = LANE_EDGE_PX;

  // ── transport + tools ───────────────────────────────────────────────────────

  /**
   * The button is a PROJECTION of the clock's state, never a record of what we last
   * asked for: the clock also pauses itself at end-of-sequence and on `visibilitychange`,
   * and it has no play-state callback to tell us. So this runs on every tick as well as
   * on the click, and is a no-op unless the state actually differs.
   */
  tp.playBtnPlaying = null;

  // ── Pinch to zoom ───────────────────────────────────────────────────────────
  // TOUCH events, not pointer events, deliberately. `.tl-tracks` keeps `touch-action:
  // pan-x pan-y` so ONE finger still pans a long sequence natively (the panel itself is
  // `touch-action: none`, so without that opt-out a phone cannot reach past the fold at
  // all). Under that value the browser claims a TWO-finger gesture as a pan and fires
  // pointercancel on both pointers, which would kill a pointer-based pinch part-way
  // through; a non-passive touchmove can preventDefault that pan and keep the gesture,
  // without giving up single-finger scrolling. The zoom itself goes through the same
  // zoom() → zoomAbout() path as the wheel and the buttons, so every route anchors on
  // its cursor and clamps to [MIN_PPS, MAX_PPS] identically.
  tp.pinchDist = 0;

  /**
   * The blade says what it would cut BEFORE it is pressed - the researched
   * self-teaching affordance, and the one that makes the scope rule above learnable
   * instead of surprising: "Split clip" when the playhead is inside one, "Split 3
   * clips" when a selection spans it, and disabled (not a refusal announced after the
   * press) when there is nothing under the playhead at all.
   *
   * Disabled is decided by the UNION of both scopes, because Shift-click is the
   * split-everything door: a playhead inside an overlay but no seq clip still has work
   * to do, and a disabled button would swallow that press. The LABEL stays the plain
   * scope's - it describes what an unmodified click does.
   *
   * `aria-disabled`, NOT the `disabled` property. A successful split leaves the playhead
   * exactly on the cut it just made, so both scopes resolve empty on the very next
   * restyle - i.e. the blade goes inert the instant you use it. Per the HTML spec a
   * FOCUSED control that becomes `disabled` is no longer focusable and the browser drops
   * focus to <body>; this panel's keydown listener is bound on `root` and gated by
   * panelKeysActive, so a keyboard user who pressed Enter on the blade would silently
   * lose every panel shortcut. aria-disabled keeps the element focusable and announced
   * as unavailable; the click handler swallows the press, and `.tl-btn[aria-disabled]`
   * carries the same greying as `:disabled`.
   */
  tp.splitBtnKey = '\u0000';

  // ── keyboard trim (`[` / `]` pick an edge, `,` / `.` nudge it, `e` snaps it) ──
  //
  // The best affordance in the whole survey for an editor that has to be approachable:
  // it needs no pointer precision at all, it works at any zoom (including one where the
  // bar is too narrow to carry a hit zone), and "trim to the playhead" is the operation
  // people actually want most of the time - you are already looking at the frame.
  //
  // Each command is ONE write() = one undo step; holding a key coalesces through
  // tool-history's 500ms window exactly like a held arrow on the canvas.

  /** Which edge the keyboard is aimed at, or null. Cleared by the first Escape. */
  tp.focusedEdge = null;

  tp.takePhase = 'idle';
  tp.takeKind = 'audio';
  tp.takeSession = null;
  tp.takeLevelOff = null;
  /** Microphone METER references this panel currently holds. A COUNT, not a boolean:
   *  `recorder.meter` is refcounted, so every resolved `start()` owes exactly one
   *  `stop()`. A boolean cannot describe "a start resolved after the take that asked for
   *  it was abandoned, while a newer take holds its own reference" - and an unbalanced
   *  count is unrecoverable: the browser's recording indicator stays lit until reload. */
  tp.takeMeterRefs = 0;
  /** Identity of the take in flight. Every await in the take driver is resumed by a
   *  continuation that may belong to an ABANDONED take, and the phase string cannot tell
   *  them apart (an abandoned take's continuation sees a NEWER take's 'countin' and
   *  proceeds as if it were live - two sessions, one leaked meter reference). Compare
   *  this instead: it is bumped by every start and every teardown. */
  tp.takeSeq = 0;
  /** Playhead seconds at the instant the recorder actually started. */
  tp.takeStartSec = 0;
  /** performance.now() at the same instant - the duration's only honest source. */
  tp.takeStartedAt = 0;
  tp.takeTimer = 0;
  tp.takeCountTimer = 0;
  tp.takeWarned = false;
  /** Elapsed ms at the last mute re-assertion (see tickTake). */
  tp.lastMuteAt = 0;
  /** A re-take replaces THIS box's asset instead of inserting a new one. */
  tp.takeReplaceId = '';
  /** The canvas boxes this take stamped `data-t-mute` onto (and must unstamp). */
  const takeMuted = new Set<HTMLElement>(); tp.takeMuted = takeMuted;
  tp.noteTimer = 0;

  // ── the camera self-view ──────────────────────────────────────────────────────
  // While a video take runs, the recorder bridge publishes its (already framed)
  // capture stream on the shell-internal preview channel; a small <video> in the
  // stage's corner mirrors it so the person can see how they sit in the frame.
  // Stage-mounted with data-export-hide, so no export path can ever pick it up.
  tp.camView = null;
  tp.camPreviewOff = null;

  /**
   * The field on a box that carries an asset ref. See TimelinePanelOpts.assetField.
   * Memoised once found: a tool's field vocabulary cannot change under a mount, and
   * this is reached from `restyle` (every keystroke). The FALLBACK is deliberately not
   * cached - a composition with no assets yet may grow one.
   */
  tp.assetFieldCache = '';

  // ── scripted voiceover (typed, not performed) ───────────────────────────────
  //
  // The Script-audio dialog owns everything speech: consent + model download,
  // voice/speed, generation progress, preview, save. The panel only remembers
  // WHERE the playhead was when the user pressed the button - the dialog can
  // stay open for minutes, and the clip must land where they were looking, not
  // wherever the clock has since drifted to.

  tp.scriptBusy = false;

  /**
   * Boxes with a subtitles run in flight: a consent sheet open, or a
   * transcription job queued/running. A second request for the SAME clip is
   * noise; a DIFFERENT clip may start its own, and lib/jobs.ts's serial heavy
   * queue is what keeps two wasm runs from fighting over the address space.
   */
  const subtitlesPending = new Set<string>(); tp.subtitlesPending = subtitlesPending;

  // ── the shortcuts sheet ──────────────────────────────────────────────────────
  //
  // Built from PANEL_SHORTCUTS, which is the same list `onKey` is written against, so
  // the sheet cannot drift from the handler (timeline-panel.test.ts drives every row
  // through the handler and checks the reverse direction too).
  //
  // Nodes, not an HTML string: every cell here is a translated string, and building the
  // table with textContent means no locale catalog can ever inject markup into it.

  tp.keysModal = null;

  // ── keyboard (panel-scoped; NEVER window - free-canvas owns that channel) ────

  tp.hovered = false;

  // ── wiring ──────────────────────────────────────────────────────────────────

  playBtn.addEventListener('click', tp.playback.togglePlay);
  mobileToolsBtn.addEventListener('click', () => {
    const expanded = root.classList.toggle('is-mobile-tools-open');
    mobileToolsBtn.setAttribute('aria-expanded', String(expanded));
  });
  // Re-click closes, the way every other disclosure in the shell behaves.
  addBtn.addEventListener('click', () => {
    if (addMenu.isOpen()) addMenu.close(true);
    else addMenu.open();
  });
  micBtn.addEventListener('click', () => tp.subtitles.toggleTake('audio'));
  micBtn.hidden = !tp.recording.canRecordVoiceover();
  camBtn.addEventListener('click', () => tp.subtitles.toggleTake('video'));
  camBtn.hidden = !tp.recording.canRecordVideo();
  screenBtn.addEventListener('click', () => tp.subtitles.toggleTake('screen'));
  screenBtn.hidden = !tp.recording.canRecordScreen();
  tp.recording.syncCamBtn();
  tp.recording.syncMicBtn();
  scriptBtn.addEventListener('click', () => {
    void tp.recording.openScriptVoiceover();
  });
  scriptBtn.hidden = !tp.recording.canScriptVoiceover();
  transcriptBtn.addEventListener('click', () => {
    void tp.subtitles.openTranscript();
  });
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', tp.subtitles.onVisibility);
  // Shift-click the blade is the pointer twin of Shift+S: cut everything the playhead
  // is inside. Same one write, same one undo step.
  // aria-disabled is advisory, so the press has to be swallowed here - that is the
  // price of keeping the blade focusable while it is inert (see syncSplitBtn).
  splitBtn.addEventListener('click', (e) => {
    if (splitBtn.getAttribute('aria-disabled') === 'true') return;
    tp.playback.splitAtPlayhead(e.shiftKey ? { everything: true } : undefined);
  });
  snapBtn.addEventListener('click', () => {
    tp.snapOn = !tp.snapOn;
    snapBtn.setAttribute('aria-pressed', tp.snapOn ? 'true' : 'false');
    snapBtn.classList.toggle('is-active', tp.snapOn);
  });
  snapBtn.classList.add('is-active');
  keysBtn.addEventListener('click', tp.panel.openShortcuts);
  zoomInBtn.addEventListener('click', () => tp.playback.zoom(ZOOM_STEP));
  zoomOutBtn.addEventListener('click', () => tp.playback.zoom(1 / ZOOM_STEP));
  fitBtn.addEventListener('click', tp.playback.fit);

  laneWrap.addEventListener('click', (e) => {
    const seam = (e.target as HTMLElement | null)?.closest<HTMLElement>('.tl-seam');
    if (seam) {
      tp.panel.openJunction(seam.dataset.a || '', seam.dataset.b || '');
      return;
    }
    const chip = (e.target as HTMLElement | null)?.closest<HTMLElement>('.tl-chip');
    if (chip?.dataset.id) tp.rows.selectAndReveal([chip.dataset.id]);
  });
  scenery.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    // The `+` half of the pill promotes straight from the strip - no need to select
    // first and then find a field. One commit, exactly like the inspector route.
    const add = target?.closest<HTMLElement>('.tl-chip-add');
    if (add?.dataset.id) {
      tp.rows.promote(add.dataset.id);
      return;
    }
    const chip = target?.closest<HTMLElement>('.tl-chip');
    if (chip?.dataset.id) tp.rows.selectAndReveal([chip.dataset.id]);
  });
  laneWrap.addEventListener('dblclick', (e) => {
    // On a bar: rename in place. The junction affordance keeps the seams (a
    // double-click BETWEEN clips hits the lane, not a bar, so the two never race).
    const bar = (e.target as HTMLElement | null)?.closest<HTMLElement>('.tl-clip');
    if (bar?.dataset.id && cfg.labelField) {
      tp.rows.renameClip(bar.dataset.id);
      return;
    }
    const at = tp.syncing.timeAt((e as MouseEvent).clientX);
    const j = junctionAt(getBoxes(), cfg, at, tp.pxPerSec);
    if (j) tp.panel.openJunction(j.aId, j.bId);
  });

  root.addEventListener('pointerdown', tp.gestures.onPointerDown);
  root.addEventListener('pointermove', tp.gestures.onPointerMove);
  root.addEventListener('pointerup', tp.gestures.onPointerUp);
  root.addEventListener('pointercancel', tp.gestures.onPointerCancel);
  // A capture lost to a browser gesture (or a pointerup the panel never saw) would
  // otherwise leave `gesture` set forever, which silently turns scheduleSync and the
  // ResizeObserver refit into permanent no-ops.
  root.addEventListener('lostpointercapture', tp.gestures.onPointerCancel);
  root.addEventListener('keydown', tp.panel.onKey);
  root.addEventListener('contextmenu', tp.menus.onContextMenu);
  root.addEventListener('wheel', tp.panel.onWheel, { passive: false });
  root.addEventListener('pointerenter', () => {
    tp.hovered = true;
  });
  root.addEventListener('pointerleave', () => {
    tp.hovered = false;
  });
  tracks.addEventListener(
    'scroll',
    () => {
      rulerInner.style.transform = `translateX(${-tracks.scrollLeft}px)`;
    },
    { passive: true }
  );
  // Only touchmove is non-passive - it is the one that has to preventDefault the pan.
  tracks.addEventListener('touchstart', tp.playback.onTouchStart, { passive: true });
  tracks.addEventListener('touchmove', tp.playback.onTouchMove, { passive: false });
  tracks.addEventListener('touchend', tp.playback.onTouchEnd, { passive: true });
  tracks.addEventListener('touchcancel', tp.playback.onTouchEnd, { passive: true });

  const unsubRuntime = runtime.subscribe(() => {
    tp.syncing.scheduleSync();
  }); tp.unsubRuntime = unsubRuntime;
  const unsubSelection = selection.onChange(() => {
    if (tp.disposed || !tp.open) return;
    tp.rows.restyle(getBoxes());
  }); tp.unsubSelection = unsubSelection;
  /**
   * `tl-time` - the panel→canvas half of the one rule's seam (free-canvas.ts's header).
   * Same CustomEvent-on-the-stage pattern as `tl-add` / `tl-take`, deliberately: the
   * canvas needs to repaint its chrome when the set of ON-SCREEN boxes changes, and it
   * must NOT repaint sixty times a second while a clip merely plays through.
   *
   * So the fire is gated on a string signature of (playing, active ids). A tick inside
   * one clip produces the same string and costs one comparison; a cut, a seek across a
   * boundary, or pressing play produces a new one and fires exactly once.
   *
   * The ONION SKIN rides the same event and the same gate. Its neighbour set changes on
   * exactly the boundaries the active set does, so folding `mode` / `opacity` / the two
   * id lists into the signature keeps the "never once per tick" property intact while
   * making a toggle or an option change fire immediately - `setOnion` simply calls this.
   * With the preference OFF (the default) the whole onion half costs one `!!` per tick:
   * `onionNeighbours` is never called, and `mode` goes out as the empty string, which is
   * what tells free-canvas not to load the module at all.
   */
  tp.lastTimeKey = '\u0000';
  const unsubTick = clock.onTick((rawMs) => {
    // The clock runs compressed (ignored spans removed); the ruler, the readout and the
    // read-along rows are all in authored time, so map once here. Identity when nothing
    // is struck. The effect during playback is the playhead SKIPPING a struck clip.
    const tMs = tp.rows.toAuthoredMs(rawMs);
    tp.rows.updatePlayhead(tMs);
    tp.playback.syncPlayBtn();
    tp.panel.emitTime(tMs);
    // The latch is a question about the PLAYHEAD, so it is asked on the same tick the
    // playhead moves on - and answers with no DOM write at all unless the answer
    // changed (see its memo). Outside emitTime's own gate, which is keyed on the
    // ACTIVE set: crossing a diamond changes neither what is on screen nor which
    // clips are playing, so that gate would swallow every latch there is.
    tp.kfDock.syncKfLatch();
    tp.kfDock.syncKfCam();
  }); tp.unsubTick = unsubTick;
  stageEl.addEventListener('fc-seek', tp.panel.onFcSeek);
  /**
   * A thumbnail shot has to un-hide an off-playhead box (see clip-thumbs' node section)
   * and puts `.seq-off` back when it is done. That restore used to be a GUESS taken up
   * to a second and a half earlier, which is exactly how long the artboard could stay
   * black: scrub onto the box being photographed and the applier removed `seq-off` from
   * a box still parked 200vw away, so the LIVE scene was off the viewport until the
   * shot settled and popped it back.
   *
   * The borrow is a LEASE now (`data-tl-borrowed`, sequence-dom.ts): the applier revokes
   * it the instant the playhead moves onto the box, and the shot's restore re-hides only
   * what still carries its own token. So this is no longer the fix - it is the belt to
   * the applier's braces, for the ordinary case where nothing raced. Cheap: `reapply()`
   * is one pass of class/style writes, and this only fires for a box that carried the
   * class at all.
   */
  const unsubShot = onNodeShotSettled(() => {
    // …and only while the panel is OPEN. A closed panel has released the canvas
    // (plans/179 T2), so re-asserting the playhead here would put `.seq-off` straight
    // back on a stage the user is editing - the exact state the close undid.
    if (tp.disposed || !tp.open) return;
    try {
      clock.reapply();
    } catch {
      /* the clock is gone; the panel is going with it */
    }
  }); tp.unsubShot = unsubShot;

  /**
   * A thumbnail is a picture of the CLIP, never of the frame the playhead is parked on
   * (plans/104 section 6.5). clip-thumbs cannot reach the authored values itself - importing
   * bridge/sequence-dom.ts would drag sequence-plan → @lolly/engine into the chunk
   * picker.ts loads for `onIdle` alone - so the panel, which already owns both ends,
   * hands it the two readers. Removed with the panel: a seam pointing at a destroyed
   * clock's store would answer authored reads out of nothing.
   */
  const unsubPose = setAuthoredPoseSeam({ read: authoredStyleOf, borrow: borrowAuthoredPose }); tp.unsubPose = unsubPose;

  const ro =
    typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => {
          if (tp.open && !tp.gesture) {
            tp.rows.restyle(getBoxes());
            tp.rows.updatePlayhead(clock.t());
          }
        })
      : null; tp.ro = ro;
  ro?.observe(stageEl);

  return {
    destroy: tp.panel.destroy,
    setOpen: tp.panel.setOpen,
    isOpen: () => tp.open,
    promote: tp.rows.promote,
    demote: tp.rows.demote,
    kfPoseIds: tp.panel.kfPoseIds,
    kfPoseWrite: tp.panel.kfPoseWrite,
    cameraModeId: tp.camera.cameraModeId,
    cameraWrite: tp.camera.cameraWrite,
    cameraTiltPreview: tp.camera.cameraTiltPreview,
    seek: (sec) => tp.rows.seekAuthored((Number.isFinite(sec) ? Math.max(0, sec) : 0) * 1000),
    selectAndReveal: tp.rows.selectAndReveal,
    time: () => tp.keyframes.playheadSec(),
    addKeyframe: () => tp.keyframes.addKeyframeAction({ speak: true }),
    keyframableIds: (ids) => {
      const rows = getBoxes();
      return ids.filter((id) => tp.keyframes.isKeyframable(rows[indexOfId(rows, cfg, id)], id));
    },
  };
}

/**
 * Repack the seq row - exposed for free-canvas's create path, which drops a new clip
 * onto the magnetic lane and needs it gapless before the next paint. Thin on purpose:
 * the arithmetic is timeline-math's.
 */
export function packSeqRow(boxes: Box[], cfg: TimeCfg): Box[] {
  return packSeq(boxes, cfg);
}
