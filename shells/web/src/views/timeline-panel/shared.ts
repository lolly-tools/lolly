// SPDX-License-Identifier: MPL-2.0
/**
 * Module-level declarations of timeline-panel.ts that its feature modules use: the types,
 * constants and pure helpers that used to sit above initTimelinePanel(). Moved here verbatim so
 * no feature module has to import the orchestrator file. The timeline panel of the design tool.
 */
import { t } from '../../i18n.ts';
import { MAX_NODE_RASTER_NODES } from '../../lib/clip-thumbs.ts';
import { DEFAULT_TRANSITION, TRANSITIONS, isTransitionKind } from '../../lib/transitions.ts';
import { KF_EASE_TOKENS, KF_HOLD_EASE, kfEaseCss, kfEaseName } from '../../../../../engine/src/keyframes.ts';
import type { KfChannel } from '../../../../../engine/src/keyframes.ts';
import type { EasingEditorHandle } from '../../components/easing-editor.ts';
import { DRIVE_FPS, beginAuthoredDom, createSequenceTime } from '../../bridge/sequence-dom.ts';
import { boxTiming, isTimed } from '../timeline-math.ts';
import type { Box, LaneDrop, TimeCfg } from '../timeline-math.ts';
import type { AssetRef, HostV1, RecorderAPI, SpeechAPI } from '@lolly-tools/core/host-v1';
import { isTypingTarget } from '../../lib/typing-target.ts';
import { CHIP_SEP, EDGE_PX, EDGE_PX_COARSE, MAX_PPS, MIN_FRAME_PX, MIN_PANEL_H, MIN_PPS, ONE_LANE_H, clamp, finite } from '../timeline-config.ts';

// ── local structural types (kept minimal so free-canvas can pass its own objects) ──

/**
 * Just the slice of the tool runtime the panel needs: repaint notifications, plus a
 * READ-ONLY peek at the manifest's declared capabilities. The panel offers no
 * device-capture affordance to a tool that has not declared it needs one - the
 * manifest is the contract every other shell gates on (a CLI/TUI refuses to mount a
 * `microphone` tool at all), so the panel reads the same field rather than assuming
 * that "the web shell can record" means "this tool may".
 */
export interface TimelineRuntime {
  subscribe(fn: () => void): (() => void) | undefined;
  manifest?: { capabilities?: readonly string[] } | null;
}

/**
 * Just the slice of the host bridge the panel needs. `recorder` is the optional v1.17
 * capture API: absent on a shell that cannot record, in which case the mic affordance
 * is never rendered (see `canRecordVoiceover`).
 */
export interface TimelineHost {
  log?(level: string, msg: string): void;
  recorder?: RecorderAPI;
  /** The optional speech bridge (v1.96 synthesis, v1.99 speech-to-text) - behind the
   *  "Script a voiceover" button and the speech-to-text arm of Generate subtitles.
   *  Feature-detected like `recorder`, never capability-gated. */
  speech?: SpeechAPI;
  /** The optional on-device background remover (v1.103). Not required to OFFER the clip
   *  context menu's "Remove background…" (the shared video-job dialog also has a model-free
   *  colour-key method), but carried on the host so the dialog can use the model method
   *  when a model is staged. Feature-detected like `speech`, never capability-gated. */
  matte?: NonNullable<HostV1['matte']>;
  /** The user-asset store, for retiring a take that a RE-take has superseded - and only
   *  once the replacement has been committed to the model (see finishTake) - plus `get`,
   *  which resolves a box's persisted ref back to a LIVE one (fresh object URL and full
   *  meta) for the subtitle path. */
  assets?: {
    _deleteUserAsset?(id: string): Promise<void>;
    get?(id: string): Promise<AssetRef | null>;
    /** "Export frame": persist a native-resolution PNG grabbed at the playhead
     *  as a new user asset (mirrors MatteAssetRecordInput/UpscaleAssetRecordInput -
     *  the shape every on-device-transform dialog already saves through). */
    _uploadUserAsset?(record: {
      id: string;
      type: AssetRef['type'];
      format: string;
      blob?: Blob;
      version?: string;
      width?: number;
      height?: number;
      meta?: Record<string, unknown>;
    }): Promise<void>;
    /** The meta-only ANNOTATION write (bridge/assets.ts) - how a finished
     *  speech-to-text is filed onto the clip's own record, so a second
     *  "Generate subtitles" reads it back instead of inferring again. */
    _updateUserAssetMeta?(
      id: string,
      meta: Record<string, unknown>,
      patch?: { aiGenerated?: 'full' | 'partial' }
    ): Promise<void>;
  };
  /** "Export frame"'s second half: the same PNG bytes, offered as a plain download. */
  export?: {
    download(blob: Blob, filename: string): Promise<void>;
  };
}

/** The canvas selection seam, threaded from free-canvas (selection is keyed by box id). */
export interface TimelineSelection {
  get(): string[];
  set(ids: string[]): void;
  onChange(cb: () => void): () => void;
}

/**
 * One entry of the tool's OWN `canvas.addKinds` (free-canvas's `AddKind`).
 * The panel never hardcodes the list: sequence-studio declares clip/card/text/image/
 * lottie/audio/tool, and the next timed tool will declare something else entirely. Only
 * `id` and `label` are read here - the `seed` is free-canvas's business.
 */
export interface TimelineAddKind {
  id: string;
  label?: string;
  /**
   * The manifest's own seed for this kind - free-canvas's `AddKind.seed`, already
   * threaded here. Read for exactly one thing: a take recorded in the
   * panel is born from the AUDIO kind's seed, so the box the panel inserts is
   * field-for-field the box the rail's "Audio" add-kind would have made. The panel
   * still never invents a kind of its own.
   */
  seed?: Record<string, unknown>;
}

/** The detail of the `tl-add` event the panel dispatches (the cross-module seam). */
export interface TimelineAddDetail {
  /** An addKind id from the manifest. */
  kind: string;
  /** Playhead time, ms - where the created box must START. */
  atMs: number;
  /**
   * A finished camera take (the panel's "Record a video"): the durable user asset the
   * recording became, so the canvas creates the clip WITH its media - no create
   * gesture, no picker - full-frame at `atMs`. Absent for the plus menu's adds.
   */
  asset?: AssetRef;
  /** The take's MEASURED length, seconds - the box's authored duration. */
  durSec?: number;
}

export interface TimelinePanelOpts {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  /**
   * The size a render of this document exports at - the active artboard, else the
   * canvas - in px. The camera button records a take cover-cropped to exactly this
   * frame (RecordOpts.frame), so a colleague's clip already fits the picture. Absent
   * (or null) → the camera records at its own size.
   */
  frameSize?: () => { w: number; h: number } | null;
  runtime: TimelineRuntime;
  host: TimelineHost;
  blockId: string;
  /**
   * The canvas time model, plus ONE name that is not a timing field at all.
   *
   * `frameTransitionField` is `canvas.frameTransitionField` (plans/179 M4): the FRAME
   * sub-field carrying that slide's own transition to the next one. It is named here on
   * the same progressive-capability terms as every optional field in `TimeCfg` - present,
   * and a timeline edit to a frame's enter/exit stamps it 'custom' so nothing derives
   * over a pair the author has just set by hand; absent (every tool but Design), and the
   * panel writes no such field, because the manifest never declared one.
   */
  cfg: TimeCfg & { frameTransitionField?: string };
  getBoxes(): Box[];
  /** The free-canvas single write path - the ONLY way this module touches the model. */
  commit(next: Box[]): void;
  selection: TimelineSelection;
  onDirty?(id: string): void;
  /** Sets --stage-reserve-bottom on the stage + re-fits the canvas. 0 releases it. */
  reserve(px: number): void;
  /**
   * The tool manifest's `canvas.addKinds`, threaded by free-canvas. Populates the
   * panel's own `+` menu; each choice dispatches `tl-add` and free-canvas owns the
   * rest of the create pipeline. Omitted/empty hides the button entirely.
   */
  addKinds?: TimelineAddKind[];
  /**
   * The box sub-field that carries an asset ref (free-canvas's `cv.imageField`). Only
   * the record-in-place take writes one, and free-canvas does not thread it today, so
   * it is optional: `assetField()` falls back to sniffing an existing row for a ref,
   * then to the conventional `image`. Passing it explicitly is always better.
   */
  assetField?: string;
  /**
   * The box sub-field carrying rendered text (free-canvas's `cv.textField`).
   * Only Generate subtitles writes it - each cue becomes a text box - so a tool
   * that declares no text field simply never offers the action.
   */
  textField?: string;
}

/**
 * The Animate segment's WHOLE collapsed reading: the two kind names, `Rise · Fade`.
 *
 * section 8's M2.6 pass, verbatim: "Chips must not duplicate the popup's contents… ANIMATE's
 * chip drops the ms/curve dump - kind names only". M2.5 printed
 * `In: Rise · 400ms · Ease out` beside `Out: Cut (no animation)`, which is every field
 * of the group re-rendered as text on the door of the group - so the door taught the
 * user nothing they would not read one press later, at twice the width. The segment is
 * a door with at most one glance token; the popup is where the details live.
 *
 * A CUT contributes NOTHING rather than a placeholder: "Rise · Cut (no animation)" is a
 * summary that spends half its width on the absence of an animation, and an em dash in
 * its place is a token that has to be learned. Both directions cut → no chip at all,
 * which is exactly how the segment reads a box that has never been animated. The
 * vocabulary is the SAME registry the `<select>`s a press away are built from
 * (`TRANSITIONS`), so the chip can never name a kind by a word the control does not use.
 */
export function animateSummary(enter: unknown, exit: unknown): string[] {
  const name = (v: unknown): string => {
    const k = isTransitionKind(v) ? v : DEFAULT_TRANSITION;
    return k === 'none' ? '' : t(TRANSITIONS[k]);
  };
  const parts = [name(enter), name(exit)].filter(Boolean);
  // ONE chip, not two: `setSummary` draws a separator rule between chips, and a single
  // reading split across two of them would read as two facts.
  return parts.length ? [parts.join(CHIP_SEP)] : [];
}

/**
 * The PRESET TOKEN a stored keyframe ease means, or the token itself when it is a curve
 * of its own (plans/179 M4).
 *
 * The keyframe wire has more than one spelling for the same curve: the engine's adapters
 * accept a preset token, a preset NAME and a raw `cubic-bezier`, and normalise on the way
 * in - so a track can legitimately carry `eb(0.4)(0)(0.2)(1)`, which is `es`, which is
 * Smooth. This is the read-side normalisation that makes the ease picker say so. Held to
 * the engine's own two answers - the preset name, then the CSS curve - so this can never
 * name a curve the engine would not.
 *
 * A token the grammar cannot read at all therefore resolves to the curve the evaluator
 * will really run it as (`kfEaseCss` falls back to the default ease), rather than to a
 * "Custom" row naming a curve nothing will draw.
 */
export function kfEasePreset(ease: string): string {
  if (!ease || ease === KF_HOLD_EASE) return ease;
  const name = kfEaseName(ease);
  const css = name ? '' : kfEaseCss(ease);
  for (const tok of KF_EASE_TOKENS) {
    if (name ? kfEaseName(tok) === name : kfEaseCss(tok) === css) return tok;
  }
  return ease;
}

/**
 * The three PRESENTER-ONLY entrance attributes, paired with the timeline names they
 * stand in for (plans/179 M4, spec 1b).
 *
 * A box that appears "with the slide" or "on click" carries no timing, so the tool's
 * hook may not stamp `data-t-enter` on it - the video compositor reads that name off
 * every `.lolly-box` and widening it would change what a render draws. It stamps
 * `data-pr-*` instead, and present-mode copies them onto the `data-t-*` names per slide
 * activation. The preview does the same copy for the length of one ramp, so the majority
 * of a deck's boxes - every untimed one - can be previewed at all.
 */
export const PR_ENTER_ATTRS: ReadonlyArray<readonly [string, string]> = [
  ['data-pr-enter', 'data-t-enter'],
  ['data-pr-enter-ms', 'data-t-enter-ms'],
  ['data-pr-enter-ease', 'data-t-enter-ease'],
];

/** The entrance kind this element would play, under either spelling. */
export function enterKindOf(el: HTMLElement | null | undefined): string | null {
  return el?.getAttribute?.('data-t-enter') ?? el?.getAttribute?.('data-pr-enter') ?? null;
}

/**
 * Is there an entrance on this element for {@link playOnce} to play?
 *
 * ONE rule, shared by the button that offers the preview and the function that runs it,
 * so a control can never be drawn for a motion nothing would show. A cut is not an
 * entrance: there is nothing to watch, which is why 'none' answers no.
 *
 * BOTH spellings, because the preview's whole audience is boxes that carry the
 * presenter-only one (see {@link PR_ENTER_ATTRS}): asking for `data-t-enter` alone hid
 * the button from every slide-deck box - the majority case, and the one where there is
 * no other way to see the motion short of entering present mode - and offered it only on
 * timeline clips.
 */
export function canPlayOnce(el: HTMLElement | null | undefined): boolean {
  const enter = enterKindOf(el);
  return isTransitionKind(enter) && enter !== 'none';
}

/**
 * One preview at a time, across every surface that runs one.
 *
 * A second press while a ramp is running opens a SECOND session over the same root; the
 * newer one suspends the older, and when the older finishes its `restore()` strips
 * `seq-off` from every box on the stage - so everything that has not started yet flashes
 * on screen for a frame and is hidden again on the next tick. The navigator's chip
 * already refused a second press for this reason; the guard belongs here, where both
 * doors meet.
 */
export let previewRunning = false;

/**
 * Play ONE element's own entrance once, over `ms`, and hand the DOM straight back
 * (plans/179 M4).
 *
 * The preview a play button beside Enter runs, and the same one the navigator's slide
 * transition chip runs - which is why it is exported rather than closed over: two
 * surfaces previewing motion two ways is how they start disagreeing about what the
 * motion is. Nothing here decides what the entrance looks like; the applier reads that
 * off the element's own `data-t-*` attributes, so what plays is what a render plays.
 *
 * THREE rules, each taken from `driveSequenceTime` rather than re-derived:
 *   • the panel's live clock is stood down first (`beginAuthoredDom`), or this session
 *     would capture the pose the playhead is holding and treat it as authored;
 *   • setTimeout against a wall clock, never rAF - a backgrounded tab stops rAF dead and
 *     would strand the element mid-entrance, which is the one state it must never be
 *     left in;
 *   • `restore()` runs in a `finally`, so a throw mid-ramp still gives the canvas back.
 *
 * The session composes over a ROOT and walks its descendants, so the root has to be an
 * ancestor of `el` - `el` itself would find nothing to pose. An element with no entrance
 * (see {@link canPlayOnce}) has nothing to play, and this resolves without touching it.
 *
 * ATTRIBUTES are written, and only where they are missing: the applier walks
 * `[data-t-start]` (and the depth/keyframe attributes), so an element carrying an enter
 * and no start - a deck's artboard that has never been placed in order, which is what the
 * navigator's transition chip previews - is not in its set at all. A `data-t-start="0"`
 * is stamped for the length of the ramp, and so is the `data-t-*` spelling of a
 * presenter-only entrance ({@link PR_ENTER_ATTRS}), which is the only name the applier
 * reads. All of them come off again AFTER `restore()`, which needs the element still in
 * the set to hand it back. Absent stays absent.
 */
export function playOnce(
  el: HTMLElement | null | undefined,
  ms: number,
  o: { now?: () => number; schedule?: (fn: () => void, delay: number) => () => void } = {}
): Promise<void> {
  const dur = Math.max(0, Math.round(finite(ms, 0)));
  if (!el || !dur || previewRunning || !canPlayOnce(el)) return Promise.resolve();
  // The presenter-only names, borrowed onto the timeline ones for the ramp. Only where
  // the timeline name is absent: a box carrying both is a timed box, and its own timing
  // is the truth.
  const borrowed: string[] = [];
  for (const [from, to] of PR_ENTER_ATTRS) {
    const v = el.getAttribute(from);
    if (v == null || el.hasAttribute(to)) continue;
    el.setAttribute(to, v);
    borrowed.push(to);
  }
  const hadStart = el.hasAttribute('data-t-start');
  const root = (el.closest?.('[data-sequence]') ?? el.parentElement ?? el) as HTMLElement;
  // WHERE the entrance is, on the sequence's own clock: a box that starts at 12s plays
  // its entrance at 12s. Ramping from 0 would show the rest of the slide instead.
  const start = hadStart ? finite(el.getAttribute('data-t-start'), 0) : 0;
  if (!hadStart) el.setAttribute('data-t-start', '0');
  const now =
    o.now ??
    (typeof performance !== 'undefined' && performance.now
      ? () => performance.now()
      : () => Date.now());
  const schedule =
    o.schedule ??
    ((fn: () => void, delay: number) => {
      const h = setTimeout(fn, delay);
      return () => clearTimeout(h);
    });
  const step = 1000 / DRIVE_FPS;
  previewRunning = true;
  const release = beginAuthoredDom(root);
  const session = createSequenceTime(root);
  return new Promise<void>((resolve) => {
    const t0 = now();
    let cancel: (() => void) | null = null;
    const finish = (): void => {
      if (cancel) {
        cancel();
        cancel = null;
      }
      try {
        session.restore();
      } finally {
        // AFTER the restore, never before: the applier finds the element by these
        // attributes, so removing them first would leave the pose composed on it forever.
        if (!hadStart) el.removeAttribute('data-t-start');
        for (const name of borrowed) el.removeAttribute(name);
        release();
        previewRunning = false;
        resolve();
      }
    };
    const tick = (): void => {
      cancel = null;
      const t = now() - t0;
      // One bad frame never strands the element: the ramp keeps going and the finally
      // below still hands the DOM back.
      try {
        session.apply(start + Math.min(t, dur));
      } catch {
        /* keep going */
      }
      if (t >= dur) {
        finish();
        return;
      }
      cancel = schedule(tick, step);
    };
    tick();
  });
}

/** Seconds → panel pixels at the current zoom. */
export function timeToPx(tSec: number, pxPerSec: number): number {
  return finite(tSec, 0) * finite(pxPerSec, 0);
}

/** Panel pixels → seconds at the current zoom. Zero/negative zoom reads as 0s. */
export function pxToTime(px: number, pxPerSec: number): number {
  const pps = finite(pxPerSec, 0);
  return pps > 0 ? finite(px, 0) / pps : 0;
}

/**
 * A viewport clientX → timeline seconds, given the track viewport's left edge and its
 * horizontal scroll. One function so the ruler, the bars and every gesture agree.
 */
export function clientToTime(
  clientX: number,
  rectLeft: number,
  scrollLeft: number,
  pxPerSec: number
): number {
  return Math.max(
    0,
    pxToTime(finite(clientX, 0) - finite(rectLeft, 0) + finite(scrollLeft, 0), pxPerSec)
  );
}

/** Clamp a zoom level into the supported range. */
export function clampPxPerSec(pps: number): number {
  return clamp(finite(pps, MIN_PPS), MIN_PPS, MAX_PPS);
}

/** The zoom that makes `durSec` exactly fill `widthPx` (with a little breathing room). */
export function fitPxPerSec(durSec: number, widthPx: number): number {
  const d = Math.max(0.5, finite(durSec, 0));
  const w = Math.max(80, finite(widthPx, 0)) - 24;
  return clampPxPerSec(w / d);
}

/**
 * Zoom about a cursor: the timeline instant under `cursorPx` (offset from the track
 * viewport's left edge) stays under the cursor afterwards. Returns the new zoom AND the
 * scroll that preserves the anchor - the caller applies both together.
 */
export function zoomAbout(
  pxPerSec: number,
  factor: number,
  cursorPx: number,
  scrollLeft: number
): { pxPerSec: number; scrollLeft: number } {
  const pps = clampPxPerSec(pxPerSec);
  const next = clampPxPerSec(pps * finite(factor, 1));
  const anchor = pxToTime(finite(cursorPx, 0) + finite(scrollLeft, 0), pps);
  return { pxPerSec: next, scrollLeft: Math.max(0, timeToPx(anchor, next) - finite(cursorPx, 0)) };
}

/**
 * The identity of the panel's ROW STRUCTURE: box ids, their lane, whether they are
 * timed at all, and - for a tool with a group field - their group, because grouped
 * overlays SHARE a lane row (see rebuild's collapse), so regrouping is a structure
 * change. Geometry (start/dur) is deliberately absent - moving or trimming a clip
 * must restyle, never rebuild. The chromeKey precedent, applied to tracks.
 */
export function tracksKey(boxes: Box[], cfg: TimeCfg): string {
  const rows = Array.isArray(boxes) ? boxes : [];
  const parts: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const b = rows[i];
    if (!b) continue;
    const id = b[cfg.idField];
    const timing = boxTiming(b, cfg);
    const group = cfg.groupField ? b[cfg.groupField] : undefined;
    parts.push(
      `${id == null ? '' : String(id)}:${timing.lane}:${isTimed(b, cfg) ? 1 : 0}:${group == null ? '' : String(group)}`
    );
  }
  return parts.join('|');
}

/**
 * The times a drag may snap to: every clip edge, the playhead, and the whole seconds
 * NEAR the pointer. Bounded on purpose - emitting every whole second up to MAX_TIME_S
 * would hand snapTime a 3,600-entry array on every pointermove.
 */
export function snapCandidates(
  boxes: Box[],
  cfg: TimeCfg,
  playheadSec: number,
  aroundSec: number,
  excludeId?: string
): number[] {
  const rows = Array.isArray(boxes) ? boxes : [];
  const out: number[] = [0];
  for (const b of rows) {
    if (!b) continue;
    const id = b[cfg.idField];
    if (excludeId != null && id != null && String(id) === String(excludeId)) continue;
    const timing = boxTiming(b, cfg);
    if (timing.lane !== 'seq' && timing.start === null) continue;
    const s = timing.start ?? 0;
    out.push(s);
    if (timing.dur !== null) out.push(s + timing.dur);
  }
  const ph = finite(playheadSec, 0);
  if (ph >= 0) out.push(ph);
  const centre = Math.round(finite(aroundSec, 0));
  for (let s = centre - 2; s <= centre + 2; s++) if (s >= 0) out.push(s);
  return out;
}

/** Is `el` something the user types into? Typing must never trigger a shortcut. */
export function isTextControl(el: Element | null | undefined): boolean {
  if (!el) return false;
  // isTypingTarget descends shadow roots: a focused jelly field reports its HOST as
  // the active element, and the host is neither an INPUT nor contentEditable.
  return isTypingTarget(el);
}

/**
 * The keyboard containment guard (page-filmstrip.ts:83-94, adapted). Shortcuts fire only
 * when the panel owns the interaction - focus inside it, or the pointer over it - and
 * never while a text control has focus, including the panel's own numeric fields.
 */
export function panelKeysActive(
  root: HTMLElement | null,
  active: Element | null,
  hovered: boolean
): boolean {
  if (!root) return false;
  if (isTextControl(active)) return false;
  return Boolean(hovered || (active && root.contains(active)));
}

/**
 * Clamp a dragged panel height into the docking range ([floor, half the stage]).
 *
 * The floor has to clear the panel's OWN chrome, which is why `chromeH` exists: at
 * ≤720px `.tl-bar` wraps into three rows (transport / tools / inspector) where desktop
 * fits one, so the flat 112px that still leaves ~42px of track on desktop leaves none
 * at all on a phone - the resize grip could crush `.tl-tracks` to zero height and the
 * panel became 100% chrome showing no timeline. Callers that can measure their live
 * chrome pass it; the two-argument form keeps the original behaviour exactly.
 */
export function clampPanelH(h: number, stageH: number, chromeH = 0): number {
  const floor = Math.max(MIN_PANEL_H, Math.round(finite(chromeH, 0)) + ONE_LANE_H);
  const hi = Math.max(floor, Math.floor(finite(stageH, 0) * 0.5));
  return clamp(Math.round(finite(h, floor)), floor, hi);
}

/** Ruler tick spacing (seconds) for a zoom level - the smallest step ≥ 60px apart. */
export function tickStep(pxPerSec: number): number {
  const pps = Math.max(0.0001, finite(pxPerSec, 1));
  const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  for (const s of steps) if (s * pps >= 60) return s;
  return steps[steps.length - 1]!;
}

/** How many filmstrip frames a bar of `widthPx` wants (bounded both ends). */
export function frameCountFor(widthPx: number): number {
  return clamp(Math.round(finite(widthPx, 0) / MIN_FRAME_PX), 1, 24);
}

/**
 * Is this pointer a coarse one - i.e. does it need the WCAG-floor hit target?
 *
 * Written as an ALLOW-LIST of the two coarse kinds rather than "anything that is not a
 * mouse", so an absent/unknown `pointerType` (jsdom builds MouseEvents; some browsers
 * report '' for a synthetic event) falls back to the PRECISE zone. Guessing coarse for
 * an unknown pointer is the dangerous direction: it steals 24px of every bar's body
 * from the move gesture on hardware that never needed it.
 */
export function isCoarsePointer(pointerType: string | undefined): boolean {
  return pointerType === 'touch' || pointerType === 'pen';
}

/** The trim hit zone a pointer of this kind is entitled to, before the bar's own cap. */
export function edgeBase(pointerType: string | undefined): number {
  return isCoarsePointer(pointerType) ? EDGE_PX_COARSE : EDGE_PX;
}

// ── the controller ────────────────────────────────────────────────────────────

export type GestureKind = 'trim' | 'move' | 'reorder' | 'seek' | 'resize' | 'kf' | 'marquee';

export interface Gesture {
  kind: GestureKind;
  id: string;
  pointerId: number;
  el: HTMLElement | null;
  /** Pointer x/y at pointerdown, viewport coords. */
  x0: number;
  y0: number;
  /** Latest pointer position - written SYNCHRONOUSLY in pointermove, read on pointerup. */
  x: number;
  y: number;
  alt: boolean;
  /**
   * The pointer kind that STARTED the gesture. Captured once rather than re-read per
   * move, because the hit zone that opened the gesture and the snap tolerance that
   * steers it must be the same pointer's numbers from pointerdown to pointerup.
   */
  pointerType: string;
  edge?: 'in' | 'out';
  /** Trim only: the limit signal has already been spoken for this gesture. */
  limitSaid?: boolean;
  /**
   * Diamond drag only (`kind === 'kf'`): the keyframe's LOCAL ms at pointerdown, and
   * the dot being dragged. Absolute-from-the-snapshot like `start0`/`dur0`, so a
   * retime is never accumulated across frames.
   */
  kfT0?: number;
  kfDot?: HTMLElement | null;
  /** Snapshot of the timing at pointerdown, so the drag is always absolute, never accumulated. */
  start0: number;
  dur0: number;
  /** Seq reorder only. */
  index0: number;
  index: number;
  /** Overlay vertical drag (plans/165 Slice C-tracks): the resolved lane drop, and
   *  the overlay rows' geometry, cached at the first vertical breach of the drag. */
  laneDrop?: LaneDrop | null;
  laneRects?: { el: HTMLElement; anchor: string; members: string[]; top: number; bottom: number }[];
  /** Panel resize only. */
  h0: number;
  moved: boolean;
  /** Marquee only: the drag ADDS to the current selection (Shift/Cmd held). */
  additive?: boolean;
  /** move/reorder/trim: when >1, the gesture acts on the whole selection as a batch
   *  (one undo step). moveOverlays/moveSeqClips each act on the same-lane members and
   *  ignore the rest; trimClips trims the SAME edge of every selected clip by the same
   *  delta, each clamped to its own source - "drag one edge, resize the group". */
  groupIds?: string[];
  /** move/reorder only: a plain press on an already-multi-selected clip keeps the set
   *  for a possible group drag; if it turns out to be a click (no move), collapse to this
   *  one clip on release (the standard "click one of a selection" behaviour). */
  collapseOnClick?: boolean;
}

export const cssEscape = (v: string): string =>
  typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(v)
    : String(v).replace(/["\\\]]/g, '\\$&');

export interface BoxMedia {
  url: string;
  kind: 'video' | 'audio' | 'image' | 'lottie' | '';
  dur: number | null;
  /**
   * The live node the picture is already decoded in - the `<img>` on the canvas, or
   * a Lottie's mounted `<svg>`. Handed to clip-thumbs so a bar's still is drawn from
   * what is on screen instead of costing a second fetch + decode of the same asset.
   * Never retained across a repaint: a rebuild aborts the thumb pass that holds it.
   */
  el?: Element | null;
}

/** What a bar's canvas should paint, given what the box turned out to be. */
export type ThumbMode = 'waveform' | 'filmstrip' | 'still' | 'node' | 'fill' | 'none';

/**
 * How many dom-to-image shots ONE idle pass may start. Cache hits are free and
 * unlimited (they paint synchronously); only misses spend the budget, in bar order.
 * A twenty-frame timeline therefore fills in over four passes instead of stalling.
 */
export const MAX_NODE_RASTERS_PER_PASS = 6;
/**
 * Extra idle passes a single scheduling may chain, to finish work the budget deferred
 * - and to catch the OTHER late arrival: a Lottie whose player has not mounted its
 * <svg> by the first pass. Nothing else ever re-runs a pass (they fire on rebuild,
 * gesture-end, zoom, fit and an appearance change only), so without this a slow Lottie
 * bar stayed blank forever.
 *
 * Six, not three: three passes bounded a scheduling at 18 shots, so a twenty-frame
 * sequence had two bars that could never be reached at all. The chain still terminates
 * - a pass that leaves nothing pending does not queue the next, an in-flight bar no
 * longer counts as pending (nodeRasterPending) and a bar that failed once is retired
 * (nodeRasterFailed) - so this is a ceiling, not a schedule.
 */
export const MAX_THUMB_PASSES = 6;

/**
 * Is a computed CSS colour actually going to leave a mark?
 *
 * `getComputedStyle().backgroundColor` reports the "no background" case as
 * `rgba(0, 0, 0, 0)`, which paints an invisible rectangle and would light up
 * `has-thumbs` (and its label scrim) for a bar that shows nothing.
 */
export function isPaintedColor(css: string): boolean {
  const v = String(css ?? '')
    .trim()
    .toLowerCase();
  if (!v || v === 'transparent' || v === 'none' || v === 'initial' || v === 'unset') return false;
  const m = /^rgba?\(([^)]+)\)$/.exec(v);
  if (m) {
    const parts = (m[1] as string).split(/[\s,/]+/).filter(Boolean);
    if (parts.length >= 4) {
      const raw = parts[3] as string;
      // A computed value is always numeric, but the modern space-separated syntax
      // allows a percentage and this predicate also reads authored colours.
      const a = raw.endsWith('%') ? Number(raw.slice(0, -1)) / 100 : Number(raw);
      return Number.isFinite(a) ? a > 0.02 : true;
    }
  }
  return true;
}

/**
 * The branch every bar takes. Pure, and the whole point of it: before this, only
 * audio and video bars painted anything, so a timeline of cards and tool clips was
 * a row of identical coloured rectangles.
 *
 * Order is the design, not an accident:
 *
 *   • A decoded ASSET wins over everything. It is both cheaper (one <img> decode, or
 *     a straight reuse of the element already on screen) and more faithful than a
 *     photograph of the DOM - and a tool clip must keep taking `still`, because that
 *     <img> IS the compose render, not a screenshot of a tag.
 *   • `node` sits above `fill`, because a photograph of the box is strictly more
 *     information about the same box than its background colour is.
 *   • `node` sits above `none` TOO, which is the point of the whole branch: a text
 *     card and every pen shape (the tool hook forces `kind:'path'` boxes to a
 *     transparent fill) painted nothing at all before it existed.
 *
 * `canRaster` defaults to false so every existing call site - and every pinned row of
 * the table this function is tested against - keeps its exact previous answer.
 */
export function thumbMode(kind: string, url: string, fill: string, canRaster = false): ThumbMode {
  if (url) {
    if (kind === 'audio') return 'waveform';
    if (kind === 'video') return 'filmstrip';
    if (kind === 'image' || kind === 'lottie') return 'still';
  }
  if (canRaster) return 'node';
  return isPaintedColor(fill) ? 'fill' : 'none';
}

/**
 * Is this box worth photographing, and cheap enough to?
 *
 * Called ONCE per bar, in the thumb pass's read phase, and only for a box that turned
 * out to have no media - `querySelectorAll`/`textContent` force no layout, so it is
 * safe there and nowhere near the paint phase.
 *
 * Declining is the important half. An empty, transparent, textless box would cost a
 * full dom-to-image shot to produce a blank bitmap, so it stays on `none`; and a box
 * with a pathological subtree is refused outright rather than allowed to eat the
 * pass's whole budget (the MAX_SVG_MARKUP / MAX_AUDIO_DECODE_BYTES idiom - decline,
 * don't build it).
 */
export function canRasterBox(
  box: HTMLElement | null | undefined,
  fill: string,
  maxNodes: number = MAX_NODE_RASTER_NODES
): boolean {
  if (!box) return false;
  if ((box.querySelectorAll?.('*').length ?? 0) > maxNodes) return false;
  if (isPaintedColor(fill)) return true; // a card / a coloured frame
  // A pen shape: hooks.js forces every `kind:'path'` box to fill:'transparent', so the
  // computed background says "nothing here" while the <svg> inside says otherwise.
  if (box.querySelector?.('.lolly-box-path')) return true;
  return !!box.querySelector?.('.lolly-box-text')?.textContent?.trim();
}

/**
 * The APPEARANCE identity of a box - everything that decides what its photograph looks
 * like, and nothing that decides where its bar is placed.
 *
 * TIMING fields are excluded deliberately: a drag rewrites start/dur on every
 * pointermove, and re-keying on those would throw away a picture that has not changed
 * one pixel and retake it at the end of every gesture. `idField` is excluded too - two
 * boxes that look identical may legitimately share one raster (and one shot).
 *
 * O(row keys), against O(subtree bytes) for anything derived from the DOM. The box DOM
 * is a pure function of (model row, brand/theme, fonts), so the caller appends the two
 * environment terms it already has in hand - the box's computed background and the
 * document's theme stamp - rather than this module reaching for them. Same shape as
 * the `tracksKey` precedent above.
 *
 * Joined on U+0001, written as an escape - no authored field value contains it.
 */
/**
 * One field's contribution to an appearance signature.
 *
 * `String(v)` is wrong for the structured halves of `InputValue` - a token reference
 * `{ref,value}`, an asset ref, a blocks array - every one of which stringifies to
 * `[object Object]`. Two boxes differing ONLY in such a field would then share a
 * signature, hence a cache key, hence (via `share()`) one photograph served to both.
 * Today's sequence-studio schema keeps its colours and paths as strings, so this is
 * hardening rather than a fix, but the signature is the cache identity for an open
 * `Record<string, InputValue>` and the failure would be silent and wrong.
 */
export function sigValue(v: unknown): string {
  if (typeof v !== 'object') return String(v);
  try {
    return JSON.stringify(v) ?? '';
  } catch {
    return '[cyclic]'; // never thrown by an input value, but a signature must not throw
  }
}

export function appearanceSig(box: Box | undefined, cfg: TimeCfg): string {
  const b = box || {};
  const skip = new Set<string>([
    cfg.idField,
    cfg.startField,
    cfg.durField,
    cfg.clipInField,
    cfg.speedField,
    cfg.enterField,
    cfg.exitField,
    cfg.enterMsField,
    cfg.exitMsField,
    cfg.laneField,
  ]);
  const parts: string[] = [];
  for (const k of Object.keys(b)) {
    if (skip.has(k)) continue;
    const v = b[k];
    // null / undefined / '' are the same "unauthored" state as far as paint goes, so
    // they must collapse to one signature rather than three.
    parts.push(`${k}=${v == null ? '' : sigValue(v)}`);
  }
  // Sorted, so two rows built by different code paths (a seed vs. a patch) that carry
  // the same fields in a different insertion order share a picture.
  parts.sort();
  return parts.join('\u0001');
}

// ── onion-skin preference (device-local, absent = OFF) ────────────────────────
//
// A CHROME preference, not tool state: it changes what the editor draws over the
// artboard and never touches the model, so the "no localStorage for tool state" rule
// in CLAUDE.md does not apply. Direct precedent: projects.ts's view/sort modes and
// multi-edit.ts's zoom. Every access is wrapped, because a private-mode browser throws
// on the property access itself, not only on the call.
//
// ABSENCE is the off state - there is no `on: false` record. That keeps the default
// unambiguous (nothing stored, nothing drawn) and means turning it off leaves no
// residue for a future version to misread.
export const ONION_KEY = 'lolly:onion';

export interface OnionPref {
  mode: 'outline' | 'filled';
  before: number;
  after: number;
  opacity: number;
}

/** Turning it on with nothing stored: outlines, one scene either side, full strength. */
export const ONION_DEFAULT: OnionPref = { mode: 'outline', before: 1, after: 1, opacity: 1 };

export function writeOnionPref(pref: OnionPref | null): void {
  try {
    if (pref) localStorage.setItem(ONION_KEY, JSON.stringify(pref));
    else localStorage.removeItem(ONION_KEY);
  } catch {
    /* storage off */
  }
}

/**
 * Disclosure, since section 8's M2.5 revision: the inspector strip carries only the SEGMENTS
 * (icon + label + the resolved value chips, at a constant width), and an open group's
 * body is a body-mounted popover ABOVE the transport.
 *
 * There is therefore no per-group open MAP any more, and its absence is the point:
 *
 *   • ONE popover at a time - opening a second group swaps, the way a menu bar does.
 *     A map of independently-open groups cannot express that, and the strip it used to
 *     describe (bodies inline, side by side) is exactly what the revision removed.
 *   • DEFAULT ALL-SHUT. Nothing auto-discloses on selection: a popover that opens
 *     itself over the canvas because you clicked a box is a popover you have to close.
 *   • Still UI state and still session-local - it lives in `openGroup` inside the panel
 *     closure below, never in the model (plans/104 section 8: "never a model field") and never
 *     in storage. A group left open is a working posture, not a setting.
 */

/** Unique `aria-controls` targets: the inspector is rebuilt constantly, ids must not collide. */
export let groupBodySeq = 0;

// ── the latch (plans/104 section 8) ────────────────────────────────────────────────
//
// ONE question, asked once per tick: is the playhead parked exactly on a diamond?
// Everything downstream is a reading of that answer - the group header's wording,
// whether the pose fields accept an edit, which list row is marked, which diamond
// draws large, and (through `kfPoseIds`, below) whether a canvas drag writes a
// keyframe or the base.
//
// It is deliberately NOT part of `inspectorKey`: the latch moves with the playhead,
// sixty times a second while playing, and rebuilding a row of controls at that rate
// would throw away the focus and the half-typed value of whoever was using them.
// So the row is built from MODEL values and re-READ here, in place.

export interface KfPoseField {
  ch: KfChannel;
  el: HTMLInputElement;
  /** The range beside the number, on the one channel that has one (`z`). */
  slider?: HTMLInputElement | null;
  /**
   * The base channel this control writes off a diamond, when the tool actually
   * declares the field it falls back to. Absent means "nothing to write here" - which
   * is what `syncKfLatch` turns into an inert control, so a tool with no `zField` /
   * `rxField` / `ryField` never shows a live number that the commit would refuse.
   */
  base?: KfBaseChannel;
}
export interface KfLatchRefs {
  id: string;
  /** "Scene pose" ⇄ "Keyframe @ 0:01.8". */
  state: HTMLElement;
  /** The pose controls - enabled only ON a diamond (except the ones with a `base`). */
  pose: KfPoseField[];
  /** The CRUD list, whose rows carry `data-t`. */
  list: HTMLElement;
  /**
   * The curve editor DOCKED in this popup (section 8's M2.7): the keyframe it is showing,
   * and the handle to tear down. Null when the row has no keyframes to ease.
   */
  dock: { atMs: number; editor: EasingEditorHandle | null; host: HTMLElement } | null;
}

/**
 * The three pose channels that have a BASE FIELD on the box, and the `cfg` key naming
 * it. A keyed value REPLACES the field for its segment (section 5.2 for `z`, P2.1 for
 * the tilt pair), which is what makes an off-diamond edit here an edit of the base
 * rather than an invented keyframe.
 */
export type KfBaseChannel = 'z' | 'rx' | 'ry';

/**
 * Build one inspector group: a SEGMENT for the strip (a disclosure button carrying
 * an icon, a text label and the resolved value chips) plus the body its fields live
 * in - which, since section 8's M2.5 revision, is NOT appended to the segment.
 *
 * The row this replaced was eleven labelled inputs in a horizontal overflow
 * scroller, and the keyframe row would have made it fourteen (plans/104 section 8,
 * "Inspector regrouping"). Grouping answered that; the M2.5 revision answers what
 * grouping left behind - an open group still had to fit its whole body INSIDE the
 * strip, which is why the ease pickers were truncated to "Ease in ar…". So the body
 * is now mounted in a popover ABOVE the transport and the segment keeps a constant
 * width whether it is open or shut.
 *
 * Three properties this shape has to keep, all of them contracts elsewhere:
 *
 *   • the body is hidden with the `hidden` PROPERTY while it is not in a popover, so
 *     a shut group leaves the accessibility tree as well as the picture - and no
 *     sheet may style `[hidden]` (styles/hidden-attribute-guard.test.ts fails the
 *     build for a rule that tries). Nothing here is display-toggled by class.
 *   • no `transform` / `filter` / `backdrop-filter` on the group or its body - the
 *     fixed-popover containing-block trap documented on `.tl-panel` and
 *     `.fc-toolbar`. It is now doubly essential: the body itself is reparented
 *     into a `position: fixed` popover, and the ease `<select>`s inside it open
 *     fixed popovers of their own. The caret rotation is on a LEAF `<svg>`, which is
 *     an ancestor of nothing.
 *   • the head is a real `<button>` with `aria-expanded`, keyboard reachable - the
 *     diamonds on the bars are aria-hidden pointer sugar, so the inspector is the AT
 *     route and it cannot become a div that listens for clicks.
 */
export interface InspectorGroup {
  /** The group wrapper (`.tl-group[data-group]`) - append it to the inspector. */
  root: HTMLElement;
  /** Where controls go. Reparented into the popover while this group is open. */
  body: HTMLElement;
  /** The disclosure control. Its accessible name is label + summary. */
  head: HTMLButtonElement;
  /** The group's own translated name - also the popover's accessible name. */
  label: string;
  /** Replace the value summary. Empty strings are dropped. */
  setSummary(parts: string[]): void;
  /** Is this group's body currently showing in the popover? */
  isOpen(): boolean;
}

// ── thumbnails (cache-owned bitmaps: draw synchronously, never retain) ───────

/** Everything one bar's paint needs, gathered in the read pass. */
export interface ThumbJob {
  id: string;
  el: HTMLElement;
  w: number;
  h: number;
  /** Device-pixel ratio, read ONCE per pass rather than once per bar. */
  dpr: number;
  media: BoxMedia;
  /** The bar's resolved foreground colour - canvas 2D silently ignores currentColor. */
  ink: string;
  /** The BOX's own computed background, for the no-media fallback. */
  fill: string;
  /**
   * The live `.lolly-box`, and its model row. Both resolved HERE, in the read pass:
   * `paintThumbs` used to re-scan `getBoxes()` with `indexOfId` per bar, which is
   * O(bars × boxes) and - now that node mode needs the row for its cache key too -
   * would have been paid twice.
   */
  box: HTMLElement | null;
  row: Box | null;
  /** Appearance identity for a node raster. Empty when the bar cannot take one. */
  sig: string;
  /** May this bar photograph its box at all (subtree size, and is there any ink)? */
  canRaster: boolean;
  /** May it do so THIS pass, or has the per-pass shot budget already gone? */
  allowRaster: boolean;
}

// ── record-in-place voiceover (track C) ─────────────────────────────────────
//
// Press the mic, get a 3-2-1 count-in, then perform AGAINST THE PICTURE: the panel
// runs the playhead through the take, so what you narrate is what you were watching.
// On stop the blob becomes a durable user asset and ends up as an audio box at the
// time the take started - one commit, one undo step, trimmable immediately.
//
// Four things here are essential and each has already cost someone an afternoon:
//
//  1. THE LENGTH IS MEASURED, NEVER READ OFF THE BLOB. A fresh MediaRecorder blob
//     reports duration Infinity or 0 (record-control.ts's `data-clip-ms` note says
//     the same thing from the video side), so the elapsed wall-clock between "the
//     recorder said go" and "the user pressed stop" IS the duration - and it is
//     stored as the asset's `meta.durationMs`, because that is what the tool hook
//     stamps as `data-audio-dur` and therefore the only thing `mediaOf` can clamp a
//     trim against. A take stored without it cannot be trimmed properly.
//  2. THE COMPOSITION IS SILENCED BY ATTRIBUTE, not by touching media elements.
//     sequence-clock reads `data-t-mute="1"` off the live canvas DOM on EVERY frame
//     for both videos (element.muted) and audio boxes (they are simply not
//     scheduled). Setting `video.muted` directly would be overwritten by the clock's
//     next frame; setting the attribute is speaking the clock's own language, so
//     nothing fights and the model is never written. Re-asserted per tick, since a
//     repaint mints fresh box elements.
//  3. EVERY EXIT PATH GOES THROUGH endTake(). A leaked microphone is the worst
//     outcome available here: the browser shows a recording indicator with no way
//     for the user to trace it. Denial, an abort mid-count-in, a hidden tab, closing
//     the panel, destroy() - all of them land in the same teardown.
//  4. THE INSERT IS ONE COMMIT, composed from the SAME writers a drag uses
//     (moveOverlay + setDuration on the intermediate array). No new clamping
//     arithmetic lives in this view - see the module header.

export type TakePhase = 'idle' | 'countin' | 'recording' | 'saving';
/** What the live take captures: the mic alone (a voiceover box) or camera + mic
 *  (a full-frame clip). Decided by the button pressed; read by every branch below. */
export type TakeKind = 'audio' | 'video' | 'screen';
/** groupBodySeq is an ES module binding now: importers read it live and write it through here. */
export function setGroupBodySeq(value: number): void { groupBodySeq = value; }

