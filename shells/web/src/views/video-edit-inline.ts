// SPDX-License-Identifier: MPL-2.0
/**
 * Crop + Grade + Trim a video IN the catalog detail preview (plans/130) - the
 * third inline mode of the details modal, after crop and retouch.
 *
 * Why inline and not a dialog: every decision this mode makes is about the
 * PICTURE and about TIME, and neither is answerable away from the frame. A modal
 * that asks "in point?" over a number field is a form, and one that asks for a
 * crop as four numbers is a worse one; a paused frame with a box on it and a
 * scrub bar under it is an edit. The catalog's video-job dialog stays where it is
 * for matte/upscale - those are model runs with no framing decision in them.
 *
 * Three tabs, one stage:
 *   - CROP: a drag/resize box over the paused frame, 60% centred to start so
 *     every handle is easy to grab. The box is held as FRACTIONS of the frame,
 *     so it survives a resize of the stage, and Apply converts them to source
 *     pixels through roundCropRect - the encoder's own even-dimension snap.
 *   - GRADE: a look (an open preset .cube, or the user's own .cube/.3dl) plus
 *     intensity, film grain and vignette, previewed LIVE on the paused frame -
 *     the engine's own applyLutFrame/applyGrainVignette run on the still, so
 *     what the user tunes here is the same maths the render will run per frame.
 *   - TRIM: a FILMSTRIP of the whole source with a draggable handle at each end,
 *     the sequence editor's gesture (Andy 2026-08-19: "drag the edges to trim
 *     rather than having to set numbered inputs"). Dragging an edge seeks the
 *     preview to that edge's frame, so the cut is chosen by looking at it; the
 *     in/out readouts stay editable for the times a number is the honest input.
 *     The duration and the job's own refusal are recomputed on every change,
 *     drag included. That recompute is the point: a 5-minute source is over the
 *     120s job cap as a WHOLE, but the window the user selects is what actually
 *     gets encoded, so the refusal clears the moment the selection fits.
 *     Apply stays off until an edge has actually moved - the tab opens on the
 *     whole clip, and encoding that would produce a lossy copy of the source
 *     carrying a credential that says it was trimmed.
 *
 * The window COMPOSES with the other two tabs: `range` is a request-level field
 * (the reader's decode window), not a trim parameter, so an in/out set on the
 * trim tab rides along on a crop or a grade - one job, one pass, and the refusal
 * for whichever tab is open is computed against that same window.
 *
 * Applying enqueues a background video job and leaves immediately - the global
 * job toast owns progress and cancellation (the dialog's Run button precedent).
 * Nothing here waits on an encode.
 */

import { escapeHtml } from '../lib/html.ts';
import { t, tRaw } from '../i18n.ts';
import { applyGrainVignette, applyLutFrame, GRAIN_REF_LONG_EDGE, parseLutText, type GradeLut } from '@lolly/engine';
import { roundCropRect, VIDEO_JOB_MAX_DURATION_SEC, videoJobRefusal, type CropRect, type LutCredit, type SourceProbe, type VideoJobHost, type VideoJobRequest, type VideoRange } from '../lib/video-jobs.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { clamp } from '@lolly/engine';

export type VideoEditTab = 'crop' | 'grade' | 'trim';

/** Where the mode mounts, all owned by the catalog detail modal. */
export interface VideoEditInlineEnv {
  /** The preview box (`.cat-details-preview`) - position:relative, the mode's stage. */
  stage: HTMLElement;
  /** The existing `.cat-thumb` video. Paused on entry, its playback restored on exit. */
  video: HTMLVideoElement;
  ref: AssetRef;
  name: string;
  initialTab: VideoEditTab;
  /**
   * Called with null when the mode ends (cancel, Escape, or an enqueued job),
   * and a SECOND time with the made ref if a job enqueued from here later lands -
   * the catalog's handler is idempotent for exactly that reason, and treats a
   * ref as "refresh the grid", never as "open a modal over the user".
   */
  onDone(made: AssetRef | null): void;
}

export interface VideoEditInlineHandle {
  /** Tear the mode down (cancel). Idempotent. */
  exit(): void;
  /** True only between the Apply click and the job being enqueued. */
  busy(): boolean;
}

/** One frame at the job's default output rate - the step the ± buttons take. */
const FRAME_STEP = 1 / 30;
/** Longest edge the live grade preview works at. The preview is a still, but it
 *  re-runs on every slider drag, so a 4K frame would make the sliders lag; the
 *  render itself always runs at full source resolution. */
const PREVIEW_MAX_EDGE = 960;
/** Output bitrate for both ops - the crop job's value, a good 1080p default. */
const OUT_BITRATE = 8_000_000;
/** Grain PRNG seed. Fixed so a preview and its render agree frame-for-frame.
 *  Exported for the still-image grade mode (views/grade-inline.ts), so a still
 *  and a video graded with the same sliders draw the same texture. */
export const GRAIN_SEED = 7;

/**
 * The open (CC0) preset LUTs darkroom ships, offered here by the same ids and
 * fetched from the same served path - `community/darkroom/hooks.js` owns the
 * files, this is a second reader of them, never a copy. Keys double as the
 * whitelist: an id that is not in here is never interpolated into a URL.
 * Exported for the still-image grade mode (views/grade-inline.ts) - one list,
 * so the two Grade buttons can never offer different looks.
 */
export const PRESET_LUT_BASE = '/tools/darkroom/assets/luts/';
export const PRESET_LUTS: Array<{ id: string; label: string; credit?: LutCredit }> = [
  { id: 'slide-standard', label: 'Standard slide' },
  { id: 'slide-vivid', label: 'Vivid slide' },
  { id: 'chrome-muted', label: 'Muted chrome' },
  { id: 'mono-fine', label: 'Fine mono (B&W)' },
  // A credited look (the CC0 films above carry none): the attribution rides into
  // the graded clip's C2PA, so it travels forward into anything the clip is used in.
  { id: 'suse7-slog3-heavy', label: 'SUSE7 S-Log3 (Heavy)', credit: {
    name: 'SUSE7 S-Log3 (Heavy)', author: 'Peter Chamalian',
    role: 'Director of Photography & Editor', org: 'SUSE',
    copyright: '© 2025 SUSE', license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    created: '2025-09',
  } },
];

/** m:ss.s - short enough to sit in a readout, precise enough to trim on. */
function fmtTime(sec: number): string {
  const s = Number.isFinite(sec) && sec > 0 ? sec : 0;
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest < 10 ? '0' : ''}${rest.toFixed(1)}`;
}

/**
 * A LENGTH, read as a magnitude: `4.2s` under ten seconds, `12s` under a minute,
 * `1:05` beyond it. The trim badge's first half.
 *
 * fmtTime is the POSITION readout - fixed width, always m:ss.s, so the clock beside
 * the frame does not jitter. `0:04.2` for a four-second selection is three characters
 * of ceremony over `4.2s`, which is why the sequence editor carries both and why this
 * tab does too.
 */
function fmtDur(sec: number): string {
  const v = Number.isFinite(sec) ? sec : 0;
  if (v < 0) return `-${fmtDur(-v)}`;
  const tenths = Math.round(v * 10);
  if (tenths < 100) return `${(tenths / 10).toFixed(1)}s`;
  const whole = Math.round(v);
  if (whole < 60) return `${whole}s`;
  return fmtTime(whole).replace(/\.\d$/, '');
}

/**
 * A CHANGE in length: `+0.6s` / `-0.6s`, same bands as fmtDur. ASCII signs
 * deliberately, never `±` or U+2212 - the badge is read aloud as well as drawn, and
 * a delta that rounds away to nothing reads `+0.0s` rather than `-0.0s`.
 */
function fmtDelta(sec: number): string {
  const v = Number.isFinite(sec) ? sec : 0;
  const a = Math.abs(v);
  const sign = v < 0 && Math.round(a * 10) > 0 ? '-' : '+';
  return `${sign}${fmtDur(a)}`;
}

/** The crop box as fractions of the frame (0..1). Fractions, not pixels, because
 *  the stage is sized from its container: a window resize or a phone rotation
 *  moves every pixel and none of the fractions. */
export interface CropFrac { x: number; y: number; w: number; h: number; }

/** 60% centred: 20% in from each side, so all eight handles sit well clear of the
 *  frame edges and are easy to grab (the still crop box's default). */
export const DEFAULT_CROP_FRAC: CropFrac = { x: 0.2, y: 0.2, w: 0.6, h: 0.6 };

/** Smallest box a drag may leave, in stage pixels - converted to a fraction of
 *  whatever the frame measures at the moment the drag starts. */
const MIN_BOX_PX = 16;

/**
 * Move or resize the box by a pointer delta already expressed in FRACTIONS of the
 * frame. `mode` is 'move', or any of n/e/s/w (a corner being two of them), with
 * the opposite side staying put on a resize. Clamped into the frame and never
 * below `min`. Pure, so the drag maths is testable where a pointer is not.
 */
export function dragCropFrac(start: CropFrac, mode: string, dx: number, dy: number, min: { w: number; h: number }): CropFrac {
  if (mode === 'move') {
    return {
      x: clamp(start.x + dx, 0, Math.max(0, 1 - start.w)),
      y: clamp(start.y + dy, 0, Math.max(0, 1 - start.h)),
      w: start.w,
      h: start.h,
    };
  }
  let x0 = start.x, y0 = start.y, x1 = start.x + start.w, y1 = start.y + start.h;
  if (mode.includes('w')) x0 = Math.min(x1 - min.w, Math.max(0, start.x + dx));
  if (mode.includes('e')) x1 = Math.max(x0 + min.w, Math.min(1, start.x + start.w + dx));
  if (mode.includes('n')) y0 = Math.min(y1 - min.h, Math.max(0, start.y + dy));
  if (mode.includes('s')) y1 = Math.max(y0 + min.h, Math.min(1, start.y + start.h + dy));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * The box in SOURCE pixels, snapped for the encoder. roundCropRect owns the snap
 * (even offsets and lengths, clamped inside the frame) and is the same call the
 * job's own crop path makes on the way in, so the size shown beside the box is
 * the size that gets cut - no second, quieter rounding downstream.
 */
export function cropRectFromFrac(frac: CropFrac, srcW: number, srcH: number): CropRect {
  const w = Math.max(0, Math.floor(srcW));
  const h = Math.max(0, Math.floor(srcH));
  return roundCropRect({ x: frac.x * w, y: frac.y * h, w: frac.w * w, h: frac.h * h }, w, h);
}

// ── Trim: the filmstrip's edges ─────────────────────────────────────────────
//
// The gesture is the sequence editor's, and the four numbers below are its numbers.
// They are COPIED rather than imported, for the reason lib/clip-thumbs.ts states
// about its own copied class names: views/timeline-panel.ts is a 7k-line view, and
// views/timeline-math.ts re-exports the whole engine index through free-canvas-math,
// so importing either would drag the sequence editor's graph into the catalog's
// lazily-loaded video mode to reach a handful of constants. timeline-panel.ts is the
// source of truth if any of them ever moves.

/** Edge hit zone, px each side, for a PRECISE pointer (mouse / trackpad). */
export const TRIM_EDGE_PX = 10;
/**
 * Edge hit zone for a COARSE pointer (finger / pen), px each side. 24 is WCAG 2.5.8's
 * AA target-size floor - the honest number for a target you press and drag along one
 * axis, where the other axis is the strip's full height.
 *
 * Picked per EVENT from `e.pointerType`, never from a media query: a touch laptop
 * reports `pointer: coarse` for the whole document while the user is on the trackpad.
 */
export const TRIM_EDGE_PX_COARSE = 24;
/** Keyboard trim step multiplier while Shift is held. One press, ten frames. */
export const TRIM_SHIFT_FRAMES = 10;
/** Narrowest strip that can carry two edge targets that are not also the whole strip. */
const MIN_STRIP_PX = 28;

/**
 * Smallest window an edge may leave. TWO frames, not one: `windowSet()` and the Apply
 * guard both want STRICTLY more than a frame, so a one-frame floor would let a handle
 * park the selection in a state Apply then refuses with nothing said.
 */
export const MIN_WINDOW_SEC = 2 * FRAME_STEP;

export type TrimEdge = 'in' | 'out';

/** The selected window in source seconds. The mode's single source of truth for it. */
export interface TrimWindow { inSec: number; outSec: number }

/**
 * How wide each edge zone may be on a strip of `stripPx`, given the pointer that
 * arrived. Zero below MIN_STRIP_PX - a strip that narrow cannot carry a target that is
 * not also the whole strip. Above it a third of the strip is the ceiling, so the in and
 * out zones can never meet.
 *
 * The HIT size and the VISUAL size are deliberately different numbers: the grip drawn
 * on the strip stays a hairline, while the zone that responds is this wide.
 */
export function trimEdgeZonePx(stripPx: number, pointerType?: string): number {
  const w = Number.isFinite(stripPx) ? stripPx : 0;
  const base = pointerType === 'touch' || pointerType === 'pen' ? TRIM_EDGE_PX_COARSE : TRIM_EDGE_PX;
  if (!(w >= MIN_STRIP_PX)) return 0;
  return Math.min(base, Math.floor(w / 3));
}

/**
 * Move ONE edge of the window by `deltaSec`, with the other edge staying put. Clamped
 * into the source and never below `minSec` of window. Pure, so the drag maths is
 * testable where a pointer is not - the same reason dragCropFrac is pure, and the same
 * writer the keyboard nudge and the typed-in time both go through, so there is one set
 * of clamps rather than three.
 */
export function dragTrimEdge(
  start: TrimWindow,
  edge: TrimEdge,
  deltaSec: number,
  duration: number,
  minSec: number = MIN_WINDOW_SEC,
): TrimWindow {
  const dur = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const min = Math.min(Math.max(0, Number.isFinite(minSec) ? minSec : 0), dur);
  const d = Number.isFinite(deltaSec) ? deltaSec : 0;
  const from0 = clamp(Number.isFinite(start.inSec) ? start.inSec : 0, 0, dur);
  const from1 = clamp(Number.isFinite(start.outSec) ? start.outSec : dur, 0, dur);
  if (edge === 'in') return { inSec: clamp(from0 + d, 0, Math.max(0, from1 - min)), outSec: from1 };
  return { inSec: from0, outSec: clamp(from1 + d, Math.min(dur, from0 + min), dur) };
}

/**
 * Read a typed time. `m:ss.s` (what the readouts print), plain seconds (`12`, `12.5`,
 * `.5`), and `h:mm:ss` for a long source. Returns null for anything else - a half-typed
 * or nonsense value is not a decision, so the caller puts the current time back rather
 * than guessing at what was meant.
 *
 * Deliberately strict: no sign (a negative in point is not a thing), no unit suffix, and
 * a minutes or seconds group past 59 is a typo rather than a time.
 */
export function parseTimeText(text: string): number | null {
  const s = String(text ?? '').trim();
  if (!s) return null;
  const parts = s.split(':');
  if (parts.length > 3) return null;
  let total = 0;
  for (let i = 0; i < parts.length; i++) {
    const raw = parts[i] ?? '';
    const last = i === parts.length - 1;
    // Only the final group may carry a fraction; the ones above it are whole units.
    if (!(last ? /^(\d+(\.\d+)?|\.\d+)$/.test(raw) : /^\d{1,2}$/.test(raw))) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    if (i > 0 && n >= 60) return null;
    total = total * 60 + n;
  }
  return total;
}

/**
 * Mount the inline Grade/Trim mode into the detail preview. The handle comes
 * back as soon as the stage is built; the source's metadata (duration, pixel
 * size) arrives after, and fills in the scrub range, the readouts and the
 * refusal line when it does.
 */
export async function mountInlineVideoEdit(host: VideoJobHost, env: VideoEditInlineEnv): Promise<VideoEditInlineHandle> {
  let tab: VideoEditTab = env.initialTab;
  let exited = false;
  let applying = false;
  let doneCalled = false;
  let jobDoneCalled = false;
  let duration = 0;
  let inSec = 0;
  let outSec = 0;
  let lut: GradeLut | null = null;
  let lutLabel = '';
  let lutCredit: LutCredit | undefined;   // set only for a credited preset (attribution → C2PA)
  let cubeText = '';
  let lutState: 'none' | 'loading' | 'ready' | 'error' = 'none';
  let previewBlocked = false;   // the frame can't be read back (a tainted canvas)
  let rafId = 0;
  let cropFrac: CropFrac = { ...DEFAULT_CROP_FRAC };

  const abort = new AbortController();
  const { signal } = abort;

  // The source's own AI-origin flag rides onto the derived clip: an edit must
  // never launder a Gen-AI disclosure out of the library (the matte precedent).
  const srcAi = env.ref.meta?.aiGenerated;
  const srcBytes = Number(env.ref.meta?.bytes ?? 0) || 0;

  // The original preview keeps autoplaying behind a `display:none` - CSS does
  // not stop a decoder. Pause it, and put its playback back exactly as found.
  const origLoop = env.video.loop;
  const origAutoplay = env.video.autoplay;
  const origWasPaused = env.video.paused;
  try {
    env.video.pause();
    env.video.loop = false;
    env.video.autoplay = false;
  } catch { /* a detached element has nothing to pause */ }

  const sliderRow = (id: string, label: string, min: number, max: number, step: number, value: number, unit: string): string => `
    <label class="cat-vid-slider">
      <span class="cat-vid-slider-label">${escapeHtml(label)}</span>
      <input type="range" data-${escapeHtml(id)} min="${min}" max="${max}" step="${step}" value="${value}">
      <output data-out-${escapeHtml(id)}>${value}${escapeHtml(unit)}</output>
    </label>`;

  const work = document.createElement('div');
  work.className = 'cat-vid-work';
  work.innerHTML = `
    <div class="cat-mode-bar">
      <div class="cat-vid-tabs" role="tablist" aria-label="${escapeHtml(t('Video edit'))}">
        <button type="button" class="cat-vid-tab" role="tab" id="cat-vid-tab-crop" aria-controls="cat-vid-panel-crop" data-tab="crop" aria-selected="false">${escapeHtml(t('Crop'))}</button>
        <button type="button" class="cat-vid-tab" role="tab" id="cat-vid-tab-grade" aria-controls="cat-vid-panel-grade" data-tab="grade" aria-selected="false">${escapeHtml(t('Grade'))}</button>
        <button type="button" class="cat-vid-tab" role="tab" id="cat-vid-tab-trim" aria-controls="cat-vid-panel-trim" data-tab="trim" aria-selected="false">${escapeHtml(t('Trim'))}</button>
      </div>
      <span class="cat-mode-bar-actions">
        <button type="button" class="btn cat-vid-cancel" data-cancel>${escapeHtml(t('Cancel'))}</button>
        <button type="button" class="btn cat-vid-apply modal-primary" data-apply>${escapeHtml(t('Apply'))}</button>
      </span>
    </div>
    <div class="cat-vid-body">
      <div class="cat-vid-viewport" data-viewport>
        <video class="cat-vid-preview" data-preview muted playsinline preload="metadata" src="${escapeHtml(env.ref.url)}"></video>
        <canvas class="cat-vid-canvas" data-canvas hidden></canvas>
        <div class="cat-vid-crop" data-crop hidden>
          <div class="cat-vid-crop-box" data-crop-box>
            ${['n', 'e', 's', 'w'].map(h => `<span class="cat-vid-crop-e" data-h="${h}"></span>`).join('')}
            ${['nw', 'ne', 'sw', 'se'].map(h => `<span class="cat-vid-crop-h" data-h="${h}"></span>`).join('')}
          </div>
        </div>
      </div>
      <div class="cat-vid-scrub">
        <button type="button" class="btn btn--sm cat-vid-step" data-step="-1" aria-label="${escapeHtml(t('Back one frame'))}">−1</button>
        <span class="cat-vid-track" data-track>
          <span class="cat-vid-span" data-span hidden aria-hidden="true"></span>
          <input type="range" data-scrub min="0" max="1" step="${FRAME_STEP}" value="0" aria-label="${escapeHtml(t('Playhead'))}">
        </span>
        <button type="button" class="btn btn--sm cat-vid-step" data-step="1" aria-label="${escapeHtml(t('Forward one frame'))}">+1</button>
        <span class="cat-vid-time" data-time>0:00.0 / 0:00.0</span>
      </div>
      <div class="cat-vid-panel" role="tabpanel" id="cat-vid-panel-crop" aria-labelledby="cat-vid-tab-crop" data-panel="crop" hidden>
        <p class="cat-vid-dur" data-crop-size></p>
        <p class="cat-vid-note">${escapeHtml(t('Drag the box on the frame to choose what is kept. The size snaps to even numbers, which is what the encoder needs.'))}</p>
      </div>
      <div class="cat-vid-panel" role="tabpanel" id="cat-vid-panel-grade" aria-labelledby="cat-vid-tab-grade" data-panel="grade" hidden>
        <label class="cat-vid-field">
          <span class="cat-vid-slider-label">${escapeHtml(t('Look'))}</span>
          <select data-look>
            <option value="">${escapeHtml(t('None (adjustments only)'))}</option>
            ${PRESET_LUTS.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(t(p.label))}</option>`).join('')}
          </select>
        </label>
        <label class="cat-vid-field">
          <span class="cat-vid-slider-label">${escapeHtml(t('Your LUT'))}</span>
          <input type="file" data-lutfile accept=".cube,.3dl">
        </label>
        ${sliderRow('intensity', t('Intensity'), 0, 100, 1, 100, '%')}
        ${sliderRow('grain', t('Grain'), 0, 100, 1, 0, '%')}
        ${sliderRow('grainsize', t('Grain size'), 1, 4, 0.1, 1.6, '')}
        ${sliderRow('vignette', t('Vignette'), 0, 100, 1, 0, '%')}
        <p class="cat-vid-note">${escapeHtml(t('The look is applied to every frame on your device.'))}</p>
      </div>
      <div class="cat-vid-panel" role="tabpanel" id="cat-vid-panel-trim" aria-labelledby="cat-vid-tab-trim" data-panel="trim" hidden>
        <div class="cat-vid-strip" data-strip>
          <canvas class="cat-vid-strip-frames" data-strip-canvas aria-hidden="true"></canvas>
          <span class="cat-vid-strip-veil" data-veil-in aria-hidden="true"></span>
          <span class="cat-vid-strip-veil" data-veil-out aria-hidden="true"></span>
          <span class="cat-vid-strip-head" data-strip-head aria-hidden="true"></span>
          <button type="button" class="cat-vid-strip-edge" data-edge="in" role="slider"
            aria-label="${escapeHtml(t('In point'))}" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0"></button>
          <button type="button" class="cat-vid-strip-edge" data-edge="out" role="slider"
            aria-label="${escapeHtml(t('Out point'))}" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0"></button>
          <span class="cat-vid-strip-badge" data-strip-badge hidden aria-hidden="true"></span>
        </div>
        <div class="cat-vid-inout">
          <label class="cat-vid-timefield">
            <span class="cat-vid-slider-label">${escapeHtml(t('In'))}</span>
            <input type="text" class="cat-vid-readout" data-in-time value="0:00.0" size="7"
              inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="${escapeHtml(t('In point, as m:ss.s or seconds'))}">
          </label>
          <label class="cat-vid-timefield">
            <span class="cat-vid-slider-label">${escapeHtml(t('Out'))}</span>
            <input type="text" class="cat-vid-readout" data-out-time value="0:00.0" size="7"
              inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="${escapeHtml(t('Out point, as m:ss.s or seconds'))}">
          </label>
        </div>
        <p class="cat-vid-dur" data-dur></p>
        <p class="cat-vid-note">${escapeHtml(t('Drag either end of the strip to choose what is kept. The frame shows the cut as you drag.'))}</p>
        <label class="field-toggle cat-vid-snap"><input type="checkbox" class="field-check" data-snap> ${escapeHtml(t('Snap to a keyframe for an instant, lossless trim'))}</label>
      </div>
      <p class="cat-vid-error" data-error hidden></p>
      <p class="cat-vid-refusal" data-refusal hidden></p>
    </div>`;
  env.stage.appendChild(work);

  const q = <T extends HTMLElement>(sel: string): T => work.querySelector<T>(sel)!;
  const vid = q<HTMLVideoElement>('[data-preview]');
  const canvas = q<HTMLCanvasElement>('[data-canvas]');
  const scrub = q<HTMLInputElement>('[data-scrub]');
  const spanEl = q<HTMLElement>('[data-span]');
  const timeEl = q<HTMLElement>('[data-time]');
  const applyBtn = q<HTMLButtonElement>('[data-apply]');
  const lookSel = q<HTMLSelectElement>('[data-look]');
  const lutFileEl = q<HTMLInputElement>('[data-lutfile]');
  const errEl = q<HTMLElement>('[data-error]');
  const refusalEl = q<HTMLElement>('[data-refusal]');
  const durEl = q<HTMLElement>('[data-dur]');
  const inTimeEl = q<HTMLInputElement>('[data-in-time]');
  const outTimeEl = q<HTMLInputElement>('[data-out-time]');
  const snapEl = q<HTMLInputElement>('[data-snap]');
  const stripEl = q<HTMLElement>('[data-strip]');
  const stripCanvas = q<HTMLCanvasElement>('[data-strip-canvas]');
  const veilInEl = q<HTMLElement>('[data-veil-in]');
  const veilOutEl = q<HTMLElement>('[data-veil-out]');
  const stripHeadEl = q<HTMLElement>('[data-strip-head]');
  const badgeEl = q<HTMLElement>('[data-strip-badge]');
  const edgeEls: Record<TrimEdge, HTMLButtonElement> = {
    in: q<HTMLButtonElement>('[data-edge="in"]'),
    out: q<HTMLButtonElement>('[data-edge="out"]'),
  };
  const cropStage = q<HTMLElement>('[data-crop]');
  const cropBox = q<HTMLElement>('[data-crop-box]');
  const cropSizeEl = q<HTMLElement>('[data-crop-size]');
  const num = (attr: string): number => Number(q<HTMLInputElement>(`[data-${attr}]`).value);

  const showError = (msg: string): void => { errEl.hidden = false; errEl.textContent = msg; };
  const clearError = (): void => { errEl.hidden = true; errEl.textContent = ''; };

  // ── The filmstrip under the trim tab ──────────────────────────────────────
  // The picture the edges are dragged on, captured by lib/clip-thumbs.ts - the
  // sequence editor's own machinery, and the reason this tab does not grow a second
  // one: ONE pooled probe <video> (so it never fights the preview element above it), a
  // serialised seek queue, an LRU of decoded frames, abort-aware throughout, and a
  // documented promise never to throw. An undecodable or cross-origin source resolves
  // EMPTY, which costs the tab its picture and nothing else - the handles, the
  // readouts and the refusal all work over a blank strip.
  //
  // OWNERSHIP: the bitmaps belong to that LRU. They are drawn synchronously inside the
  // `.then` and the references dropped - never retained across a repaint, never
  // close()d. A resize therefore re-ASKS rather than re-using, which is a cache hit
  // whenever the frame count and height have not moved.

  /** Strip height in CSS px when the stylesheet has not been consulted yet. The real
   *  height is MEASURED (a phone gets a taller strip), so the bitmaps are captured at
   *  the size they are drawn at rather than stretched up to it. */
  const STRIP_H_FALLBACK = 44;
  /** Frames are never packed tighter than this, px - roughly one 16:9 frame tall. */
  const STRIP_FRAME_PX = 78;
  /** Bounds on the ask. A detail strip is a few hundred px, and every frame is a seek. */
  const STRIP_FRAMES_MIN = 6;
  const STRIP_FRAMES_MAX = 24;

  const stripWidth = (): number => Math.round(stripEl.getBoundingClientRect().width || 0);
  const stripHeight = (): number => Math.round(stripEl.getBoundingClientRect().height || 0) || STRIP_H_FALLBACK;

  /** Where a source time sits along the strip, as a percentage of its width. */
  const atPct = (sec: number): number => (duration > 0 ? clamp((sec / duration) * 100, 0, 100) : 0);

  /** The veils, the handles, the playhead line and the handles' spoken values. */
  const syncStripChrome = (): void => {
    const inPct = atPct(inSec);
    const outPct = atPct(outSec);
    veilInEl.style.width = `${inPct}%`;
    veilOutEl.style.left = `${outPct}%`;
    stripHeadEl.style.left = `${atPct(vid.currentTime || 0)}%`;
    for (const edge of ['in', 'out'] as const) {
      const el = edgeEls[edge];
      const at = edge === 'in' ? inSec : outSec;
      el.style.left = `${edge === 'in' ? inPct : outPct}%`;
      // role=slider, so the value is spoken rather than left to the readout below:
      // a handle that announces only its name tells a screen reader nothing about
      // where the cut currently is.
      el.setAttribute('aria-valuemax', String(Math.round((duration || 0) * 10) / 10));
      el.setAttribute('aria-valuenow', String(Math.round(at * 10) / 10));
      el.setAttribute('aria-valuetext', fmtTime(at));
    }
  };

  /**
   * Draw one capture's frames across the strip, each cover-fitted into an equal slot.
   * Equal slots rather than natural widths on purpose: x maps to TIME here (the handles
   * are placed by time fraction), so a strip whose frames packed at their own aspect
   * would put the picture and the handle at different moments.
   */
  const paintStripFrames = (frames: readonly ImageBitmap[], dpr: number): void => {
    const cssW = stripWidth();
    if (!cssW || !frames.length) return;
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(stripHeight() * dpr));
    if (stripCanvas.width !== w) stripCanvas.width = w;
    if (stripCanvas.height !== h) stripCanvas.height = h;
    const ctx = stripCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    const slot = w / frames.length;
    const target = slot / h;
    for (let i = 0; i < frames.length; i++) {
      const bm = frames[i];
      if (!bm || !bm.width || !bm.height) continue;
      let sx = 0, sy = 0, sw = bm.width, sh = bm.height;
      if (bm.width / bm.height > target) { sw = bm.height * target; sx = (bm.width - sw) / 2; }
      else { sh = bm.width / target; sy = (bm.height - sh) / 2; }
      ctx.drawImage(bm, sx, sy, sw, sh, i * slot, 0, slot, h);
    }
    stripEl.classList.add('has-frames');
  };

  /**
   * Ask for the strip's frames, once the main thread is free.
   *
   * clip-thumbs never schedules itself - callers own *when* - so the first ask is
   * deferred through its own `onIdle`; later asks (a resize) go straight through and
   * land on the cache. The module is imported LAZILY: it reaches the scrub-proxy
   * registry and the job queue behind it, and a mode opened on the crop or grade tab
   * has no use for any of that. A failed import is a strip that stays blank.
   */
  let stripAsked = false;
  const requestStrip = (): void => {
    if (exited || tab !== 'trim' || !(duration > 0)) return;
    const cssW = stripWidth();
    if (!(cssW > 0)) return;      // not laid out yet (a hidden panel, or a headless run)
    const dpr = Math.min(2, Number(globalThis.devicePixelRatio) || 1);
    const count = clamp(Math.round(cssW / STRIP_FRAME_PX), STRIP_FRAMES_MIN, STRIP_FRAMES_MAX);
    const first = !stripAsked;
    stripAsked = true;
    void (async (): Promise<void> => {
      try {
        const { filmstrip, onIdle } = await import('../lib/clip-thumbs.ts');
        if (exited) return;
        if (first) {
          await new Promise<void>((resolve) => {
            const cancel = onIdle(resolve, 200);
            signal.addEventListener('abort', () => { cancel(); resolve(); }, { once: true });
          });
          if (exited) return;
        }
        const frames = await filmstrip(env.ref.url, {
          count, h: Math.round(stripHeight() * dpr), clipInSec: 0, clipOutSec: duration,
        }, signal);
        if (exited || !frames.length) return;
        paintStripFrames(frames, dpr);
      } catch (e) {
        // Nothing above is expected to throw - this is the belt on clip-thumbs' braces,
        // and it covers the import itself. A blank strip is a working trim tab.
        host.log('warn', 'Video trim filmstrip unavailable', { id: env.ref.id, error: String(e) });
      }
    })();
  };

  // ── The frame under the sliders ───────────────────────────────────────────
  // The live preview is the whole reason the grade tab is here rather than in a
  // dialog, so it runs the ENGINE's own op on the paused frame - the same
  // applyLutFrame + applyGrainVignette the per-frame render will call, at
  // frameIndex 0. A source the canvas refuses to read back (a tainted frame)
  // loses the preview, not the feature: the render never touches a canvas.
  const paintFrame = (): void => {
    if (exited) return;
    if (tab !== 'grade' || previewBlocked) { canvas.hidden = true; return; }
    const vw = vid.videoWidth || 0;
    const vh = vid.videoHeight || 0;
    if (!vw || !vh) { canvas.hidden = true; return; }
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) { canvas.hidden = true; return; }
    const scale = Math.min(1, PREVIEW_MAX_EDGE / Math.max(vw, vh));
    const w = Math.max(1, Math.round(vw * scale));
    const h = Math.max(1, Math.round(vh * scale));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const intensity = clamp(num('intensity') / 100, 0, 1);
    const grain = clamp(num('grain') / 100, 0, 1);
    const grainSize = clamp(num('grainsize'), 1, 4);
    const vignette = clamp(num('vignette') / 100, 0, 1);
    try {
      ctx.drawImage(vid, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      if (lut && intensity > 0) applyLutFrame(img.data, lut, intensity);
      // GRAIN_REF_LONG_EDGE is what makes the preview honest about grain: the cell
      // size is a fraction of the PICTURE, not of the pixel grid, so a 960px preview
      // and the full-resolution render draw the same lattice. Without it the render's
      // grain is finer than the one the slider was judged on - 2x on 1080p, 4x on 4K.
      // The render passes the same reference (lib/video-jobs.ts).
      if (grain > 0 || vignette > 0) {
        applyGrainVignette(img.data, w, h, { grain, grainSize, vignette, seed: GRAIN_SEED }, 0, GRAIN_REF_LONG_EDGE);
      }
      ctx.putImageData(img, 0, 0);
    } catch (e) {
      // A cross-origin frame taints the canvas: getImageData throws. Say so
      // once and stand the preview down - the job itself is unaffected.
      previewBlocked = true;
      canvas.hidden = true;
      host.log('warn', 'Video grade preview unavailable', { id: env.ref.id, error: String(e) });
      showError(t('Live preview is not available for this video; the look still applies when you Apply.'));
      return;
    }
    // Sit exactly over the video's rendered box, so the preview replaces the
    // frame rather than floating beside it.
    const box = vid.getBoundingClientRect();
    if (box.width && box.height) {
      canvas.style.width = `${box.width}px`;
      canvas.style.height = `${box.height}px`;
    }
    canvas.hidden = false;
  };

  // ── The box on the frame ──────────────────────────────────────────────────
  // The box overlays the PICTURE, not the viewport: its stage takes the video's
  // own rendered box, which the viewport sizes from the space the controls leave
  // (never a fixed pixel cap - entering a mode must not shrink or shift the
  // picture, Andy 2026-08-19). That is also what makes the fractions honest: they
  // are fractions OF the frame, so they map straight onto source pixels with no
  // letterbox to subtract.
  const syncCropStage = (): void => {
    const box = vid.getBoundingClientRect();
    if (box.width && box.height) {
      cropStage.style.width = `${box.width}px`;
      cropStage.style.height = `${box.height}px`;
    }
  };

  const paintCrop = (): void => {
    cropBox.style.left = `${cropFrac.x * 100}%`;
    cropBox.style.top = `${cropFrac.y * 100}%`;
    cropBox.style.width = `${cropFrac.w * 100}%`;
    cropBox.style.height = `${cropFrac.h * 100}%`;
    const srcW = vid.videoWidth || 0;
    const srcH = vid.videoHeight || 0;
    // The readout is the SNAPPED rect, so the numbers beside the box are the ones
    // the encoder will be handed - not a promise the even-rounding then breaks.
    const rect = srcW && srcH ? cropRectFromFrac(cropFrac, srcW, srcH) : null;
    cropSizeEl.textContent = rect ? tRaw('Keeps {w} × {h} pixels', { w: rect.w, h: rect.h }) : '';
  };

  /** Coalesce paints: a slider drag fires input far faster than a frame. */
  const schedulePaint = (): void => {
    if (exited || rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      paintFrame();
      if (tab === 'crop') { syncCropStage(); paintCrop(); }
    });
  };

  // ── State → UI ────────────────────────────────────────────────────────────
  const currentProbe = (): SourceProbe => ({
    longEdge: Math.max(vid.videoWidth || 0, vid.videoHeight || 0),
    durationSec: duration,
    bytes: srcBytes,
  });
  const currentRange = (): VideoRange => ({ startSec: inSec, endSec: outSec });

  /** True only when in/out actually NARROW the clip - a window over the whole
   *  thing is no window, and sending it as one would say something it doesn't. */
  const windowSet = (): boolean => duration > 0
    && (inSec > 0.001 || outSec < duration - 0.001)
    && outSec - inSec > FRAME_STEP;

  /**
   * The window this Apply would carry - on EVERY tab the same test, because a
   * window over the whole clip is no window on the trim tab either. A trim that
   * sent one would ask the job to re-encode the source and then stamp "Trimmed"
   * on a clip nobody trimmed; Apply refuses that state rather than shipping it
   * (see the trim block in syncButtons).
   */
  const requestRange = (): VideoRange | undefined => (windowSet() ? currentRange() : undefined);

  /** A trim with nothing trimmed - the state the tab OPENS in, since the window
   *  starts on the whole clip. Not applicable, and the way out is a gesture, so
   *  the gesture gets named rather than Apply just sitting there dead. */
  const trimWholeClip = (): boolean => tab === 'trim' && !windowSet();

  const syncRefusal = (): string | null => {
    // Recomputed on every in/out change, which is what lets a source that is too
    // long AS A WHOLE become acceptable once the selected window fits - and that
    // holds for a crop or a grade too, because both carry the window along.
    const refusal = duration > 0 ? videoJobRefusal(tab, currentProbe(), requestRange()) : null;
    // With no window set, a crop or a grade runs over the WHOLE clip, so a long
    // source is refused with no way out from this tab - and the way out is the
    // trim tab, one click away.
    const hint = refusal && tab !== 'trim' && duration > VIDEO_JOB_MAX_DURATION_SEC
      ? ` ${t('Trim it shorter first.')}`
      : '';
    // Nothing louder to say on the trim tab means saying the missing gesture: the
    // line is where this mode explains a disabled Apply, and an untouched window is
    // the commonest reason it is off.
    const line = refusal ? `${refusal}${hint}`
      : trimWholeClip() && duration > 0 ? t('Drag an edge first - the whole clip is selected.')
      : '';
    refusalEl.hidden = !line;
    refusalEl.textContent = line;
    return refusal;
  };

  const syncButtons = (): void => {
    const refusal = syncRefusal();
    // A grade with no look and no adjustments would re-encode the clip to say
    // nothing; a look that failed to load must not apply as silence either -
    // both are offered back as a disabled Apply beside the reason.
    const neutralGrade = tab === 'grade' && lutState !== 'ready' && num('grain') === 0 && num('vignette') === 0;
    const lookUnusable = tab === 'grade' && (lutState === 'loading' || lutState === 'error');
    // A trim needs a window that actually narrows the clip - a window over the
    // whole thing would re-encode the source and call the copy "Trimmed", which
    // is a credential asserting an edit nobody made. windowSet() also covers the
    // sub-frame case (and the source whose length has not arrived yet).
    const wholeClip = trimWholeClip();
    // A crop is a rect in SOURCE pixels; until the source has told us its size
    // there is no rect to send, only a box drawn over nothing.
    const noSourceSize = tab === 'crop' && !(vid.videoWidth > 0 && vid.videoHeight > 0);
    applyBtn.disabled = applying || !!refusal || lookUnusable || neutralGrade || wholeClip || noSourceSize;
  };

  /** The selected window, drawn on the track wherever it means something - which
   *  is every tab now that a crop and a grade carry it too, not just Trim. */
  const syncSpan = (): void => {
    spanEl.hidden = duration <= 0 || (tab !== 'trim' && !windowSet());
    if (duration > 0) {
      spanEl.style.left = `${(inSec / duration) * 100}%`;
      spanEl.style.width = `${((outSec - inSec) / duration) * 100}%`;
    }
  };

  /** Print a time into a field the user is not currently typing into. A readout that
   *  overwrites a half-typed entry is a field you cannot use. */
  const setTimeField = (el: HTMLInputElement, sec: number): void => {
    if (document.activeElement === el) return;
    el.value = fmtTime(sec);
  };

  const syncTimes = (): void => {
    timeEl.textContent = `${fmtTime(vid.currentTime || 0)} / ${fmtTime(duration)}`;
    setTimeField(inTimeEl, inSec);
    setTimeField(outTimeEl, outSec);
    durEl.textContent = tRaw('{sel} selected of {total}', { sel: fmtTime(outSec - inSec), total: fmtTime(duration) });
    syncSpan();
    syncStripChrome();
  };

  const syncTab = (): void => {
    for (const btn of work.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
      const on = btn.dataset.tab === tab;
      btn.setAttribute('aria-selected', String(on));
      btn.classList.toggle('is-active', on);
    }
    for (const panel of work.querySelectorAll<HTMLElement>('[data-panel]')) {
      panel.hidden = panel.dataset.panel !== tab;
    }
    cropStage.hidden = tab !== 'crop';
    if (tab === 'crop') { syncCropStage(); paintCrop(); }
    syncSpan();
    syncButtons();
    paintFrame();
    // The strip's panel was `hidden` until a moment ago, so it had no width to size a
    // capture against; ask now that it has one.
    if (tab === 'trim') { syncStripChrome(); requestStrip(); }
  };

  // ── Source metadata ───────────────────────────────────────────────────────
  const onMeta = (): void => {
    if (exited) return;
    duration = Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 0;
    if (duration > 0) {
      scrub.max = String(duration);
      inSec = 0;
      outSec = duration;
    }
    syncTimes();
    syncButtons();
    paintCrop();          // the source size just arrived; so did the pixel readout
    requestStrip();       // and so did the duration the strip spans
    schedulePaint();
  };
  vid.addEventListener('loadedmetadata', onMeta, { signal });
  vid.addEventListener('error', () => {
    if (!exited) showError(t("Couldn't read this video."));
  }, { signal });
  vid.addEventListener('seeked', schedulePaint, { signal });
  // The frame's rendered box moves with the window and with the source's own
  // intrinsic size; the box has to follow it or it would frame the wrong pixels.
  vid.addEventListener('resize', () => { if (tab === 'crop') { syncCropStage(); paintCrop(); } }, { signal });
  window.addEventListener('resize', () => {
    if (tab === 'crop') { syncCropStage(); paintCrop(); }
    // A wider strip wants more frames, and the canvas backing store is sized from the
    // strip's own box - so the picture has to be re-asked, not merely re-stretched.
    if (tab === 'trim') requestStrip();
  }, { signal });
  // A source already decoded (the browser had it warm) fires nothing.
  if (vid.readyState >= 1) onMeta();

  // ── Scrubbing ─────────────────────────────────────────────────────────────
  const seekTo = (sec: number): void => {
    const at = clamp(sec, 0, duration || 0);
    scrub.value = String(at);
    try { vid.currentTime = at; } catch { /* seeking a not-yet-loaded source is a no-op */ }
    syncTimes();
    schedulePaint();
  };
  scrub.addEventListener('input', () => seekTo(Number(scrub.value)), { signal });
  for (const btn of work.querySelectorAll<HTMLButtonElement>('[data-step]')) {
    btn.addEventListener('click', () => seekTo((vid.currentTime || 0) + Number(btn.dataset.step) * FRAME_STEP), { signal });
  }

  // ── Trim: drag an edge, nudge it, or type it ──────────────────────────────
  // Every one of the three goes through `applyWindow`, and `applyWindow` is the only
  // writer of inSec/outSec after the metadata arrives. That is what keeps the LIVE
  // refusal honest: it is recomputed on the same call that moved the edge, so a
  // too-long clip stops being refused the instant the dragged window fits, mid-gesture,
  // rather than on release.

  const applyWindow = (win: TrimWindow): void => {
    inSec = win.inSec;
    outSec = win.outSec;
    syncTimes();
    syncButtons();
  };

  /** The badge's baseline: the window's length when the current adjustment began, so a
   *  run of nudges reads as one delta rather than as the last press. */
  let adjustFrom: { edge: TrimEdge; dur0: number } | null = null;

  const showBadge = (edge: TrimEdge): void => {
    const at = edge === 'in' ? inSec : outSec;
    const base = adjustFrom?.dur0 ?? outSec - inSec;
    badgeEl.hidden = false;
    badgeEl.textContent = `${fmtDur(outSec - inSec)}  ${fmtDelta(outSec - inSec - base)}`;
    badgeEl.style.left = `${atPct(at)}%`;
  };

  const hideBadge = (): void => { badgeEl.hidden = true; badgeEl.textContent = ''; };

  /**
   * Move one edge and show it. `from` is the window the delta is measured AGAINST, and
   * it is the caller's because the two gestures anchor differently: a pointer drag
   * measures every frame from the window it grabbed (re-applying the delta to the
   * already-moved edge would double it on the second frame of the same drag), while a
   * key press is a discrete step from wherever the edge is now.
   *
   * The seek is the whole point of dragging on frames: the preview shows the exact
   * frame the cut lands on, so the edge is chosen by looking at it.
   */
  const moveEdge = (edge: TrimEdge, from: TrimWindow, delta: number): void => {
    applyWindow(dragTrimEdge(from, edge, delta, duration));
    seekTo(edge === 'in' ? inSec : outSec);
    showBadge(edge);
  };

  // Pointer capture on the STRIP, so a fast drag that leaves the handle keeps trimming
  // instead of stalling on the first pixel it misses - the crop box's pattern. The hit
  // test is geometric rather than "what did the pointer land on", because the zone that
  // responds is deliberately wider than the grip that is drawn (and wider again for a
  // finger), which no element box can express on its own.
  let edgeDrag: { edge: TrimEdge; from: TrimWindow; x0: number; w: number; moved: boolean } | null = null;
  let edgeX = 0;
  let edgeRaf = 0;

  /**
   * Apply everything the pointer has reported since the last painted frame. The rAF
   * coalescing means the LAST move of a gesture is usually still pending when the
   * pointer comes up, and a gesture short enough to fit inside one frame (a flick, or
   * a small precise nudge on a trackpad) never reaches the rAF at all - so the release
   * has to flush rather than cancel, or the handle snaps back to where it was grabbed
   * with nothing said. `moved` keeps a plain click on a handle what it was: a grab.
   */
  const flushEdgeMove = (): void => {
    const g = edgeDrag;
    if (!g || !g.moved || exited) return;
    moveEdge(g.edge, g.from, ((edgeX - g.x0) / g.w) * duration);
  };

  stripEl.addEventListener('pointerdown', (e) => {
    if (!(duration > 0)) return;
    const box = stripEl.getBoundingClientRect();
    const w = box.width || 0;
    if (!(w > 0)) return;
    const x = e.clientX - box.left;
    const zone = trimEdgeZonePx(w, e.pointerType);
    const dIn = Math.abs(x - (inSec / duration) * w);
    const dOut = Math.abs(x - (outSec / duration) * w);
    if (zone > 0 && Math.min(dIn, dOut) <= zone) {
      const edge: TrimEdge = dIn <= dOut ? 'in' : 'out';
      edgeDrag = { edge, from: { inSec, outSec }, x0: e.clientX, w, moved: false };
      edgeX = e.clientX;
      adjustFrom = { edge, dur0: outSec - inSec };
      // preventDefault stops the button taking focus by itself, so hand it over: the
      // arrow keys have to keep working on whichever edge was just grabbed.
      edgeEls[edge].focus();
      try { stripEl.setPointerCapture(e.pointerId); } catch { /* unsupported */ }
      showBadge(edge);
      e.preventDefault();
      return;
    }
    // Anywhere else on the strip is the playhead: a filmstrip you cannot seek on is a
    // picture rather than a control.
    seekTo((x / w) * duration);
    e.preventDefault();
  }, { signal });

  stripEl.addEventListener('pointermove', (e) => {
    if (!edgeDrag) return;
    // State captured synchronously, painting coalesced to a frame: a seek per pointer
    // event would queue decodes faster than the source can answer them.
    edgeX = e.clientX;
    edgeDrag.moved = true;
    if (edgeRaf) return;
    edgeRaf = requestAnimationFrame(() => {
      edgeRaf = 0;
      flushEdgeMove();
    });
  }, { signal });

  const endEdgeDrag = (e: PointerEvent): void => {
    if (!edgeDrag) return;
    if (edgeRaf) { cancelAnimationFrame(edgeRaf); edgeRaf = 0; }
    // The release position, applied BEFORE the gesture is let go of: the pending
    // frame is the one that carries it.
    flushEdgeMove();
    edgeDrag = null;
    adjustFrom = null;
    hideBadge();
    try { stripEl.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  };
  stripEl.addEventListener('pointerup', endEdgeDrag, { signal });
  stripEl.addEventListener('pointercancel', endEdgeDrag, { signal });

  for (const edge of ['in', 'out'] as const) {
    const el = edgeEls[edge];
    el.addEventListener('keydown', (e) => {
      const dir = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      if (!dir || e.altKey || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      if (!adjustFrom || adjustFrom.edge !== edge) adjustFrom = { edge, dur0: outSec - inSec };
      moveEdge(edge, { inSec, outSec }, dir * FRAME_STEP * (e.shiftKey ? TRIM_SHIFT_FRAMES : 1));
    }, { signal });
    el.addEventListener('blur', () => {
      if (edgeDrag) return;   // a capture drag can move focus without ending
      adjustFrom = null;
      hideBadge();
    }, { signal });
  }

  /**
   * The optional path. A field commits on Enter and on leaving it; anything that is not
   * a time puts the current one back rather than guessing, and a time that is legal but
   * out of range is clamped by the same writer the drag uses.
   */
  const commitTimeField = (edge: TrimEdge, el: HTMLInputElement): void => {
    const current = edge === 'in' ? inSec : outSec;
    const parsed = parseTimeText(el.value);
    if (parsed === null) { el.value = fmtTime(current); return; }
    applyWindow(dragTrimEdge({ inSec, outSec }, edge, parsed - current, duration));
    const now = edge === 'in' ? inSec : outSec;
    el.value = fmtTime(now);
    seekTo(now);
  };
  for (const [edge, el] of [['in', inTimeEl], ['out', outTimeEl]] as Array<[TrimEdge, HTMLInputElement]>) {
    el.addEventListener('change', () => commitTimeField(edge, el), { signal });
    el.addEventListener('blur', () => commitTimeField(edge, el), { signal });
  }

  // ── Crop box: drag to move, a handle to resize ────────────────────────────
  // Pointer capture on the stage, so a fast drag that leaves the box (or the
  // frame) keeps resizing instead of stalling on the first pixel it misses. The
  // deltas are converted to fractions against the stage measured AT DRAG START -
  // the stage cannot change size mid-drag, and re-measuring per move would be a
  // layout read per pointer event.
  let dragMode: string | null = null;
  let dragFrom: CropFrac = cropFrac;
  let dragMin = { w: 0.05, h: 0.05 };
  let dragX = 0, dragY = 0, dragW = 1, dragH = 1;
  cropStage.addEventListener('pointerdown', (e) => {
    const handle = (e.target as HTMLElement).closest<HTMLElement>('[data-h]');
    if (handle) dragMode = handle.dataset.h ?? null;
    else if ((e.target as HTMLElement).closest('[data-crop-box]')) dragMode = 'move';
    else return;   // outside the box: nothing to grab, and no pan without a zoom
    const box = cropStage.getBoundingClientRect();
    dragW = box.width || 1;
    dragH = box.height || 1;
    dragX = e.clientX;
    dragY = e.clientY;
    dragFrom = cropFrac;
    dragMin = { w: Math.min(0.5, MIN_BOX_PX / dragW), h: Math.min(0.5, MIN_BOX_PX / dragH) };
    try { cropStage.setPointerCapture(e.pointerId); } catch { /* unsupported */ }
    e.preventDefault();
  }, { signal });
  cropStage.addEventListener('pointermove', (e) => {
    if (!dragMode) return;
    cropFrac = dragCropFrac(dragFrom, dragMode, (e.clientX - dragX) / dragW, (e.clientY - dragY) / dragH, dragMin);
    paintCrop();
  }, { signal });
  const endCropDrag = (e: PointerEvent): void => {
    if (!dragMode) return;
    dragMode = null;
    try { cropStage.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  };
  cropStage.addEventListener('pointerup', endCropDrag, { signal });
  cropStage.addEventListener('pointercancel', endCropDrag, { signal });

  // ── Grade controls ────────────────────────────────────────────────────────
  for (const el of work.querySelectorAll<HTMLInputElement>('.cat-vid-slider input[type="range"]')) {
    el.addEventListener('input', () => {
      const out = el.parentElement?.querySelector('output');
      if (out) out.textContent = `${el.value}${el.max === '100' ? '%' : ''}`;
      syncButtons();
      schedulePaint();
    }, { signal });
  }

  /** Adopt a parsed LUT (or report why it could not be parsed) - never throws.
   *  `credit` is set only for a credited preset; an upload passes none, so the
   *  attribution never sticks to the wrong look. */
  const adoptLut = (text: string, label: string, name?: string, credit?: LutCredit): void => {
    try {
      lut = parseLutText(text, name);
      cubeText = text;
      lutLabel = label;
      lutCredit = credit;
      lutState = 'ready';
      clearError();
    } catch (e) {
      lut = null;
      cubeText = '';
      lutLabel = '';
      lutCredit = undefined;
      lutState = 'error';
      showError(tRaw("Couldn't read that LUT: {why}", { why: String((e as Error)?.message ?? e) }));
    }
    syncButtons();
    schedulePaint();
  };

  lookSel.addEventListener('change', () => {
    const id = lookSel.value;
    lutFileEl.value = '';
    if (!id) {
      lut = null; cubeText = ''; lutLabel = ''; lutCredit = undefined; lutState = 'none';
      clearError();
      syncButtons();
      schedulePaint();
      return;
    }
    const preset = PRESET_LUTS.find(p => p.id === id);
    if (!preset) return;   // the select's own whitelist; never fetch an unknown id
    lutState = 'loading';
    syncButtons();
    void fetch(`${PRESET_LUT_BASE}${preset.id}.cube`, { signal })
      .then(res => (res.ok ? res.text() : Promise.reject(new Error(String(res.status)))))
      .then(text => { if (!exited && lookSel.value === preset.id) adoptLut(text, t(preset.label), `${preset.id}.cube`, preset.credit); })
      .catch((e) => {
        if (exited || (e as Error)?.name === 'AbortError') return;
        lut = null; cubeText = ''; lutCredit = undefined; lutState = 'error';
        showError(t("Couldn't load that look."));
        syncButtons();
      });
  }, { signal });

  lutFileEl.addEventListener('change', () => {
    const file = lutFileEl.files?.[0];
    if (!file) return;
    lookSel.value = '';
    lutState = 'loading';
    syncButtons();
    const reader = new FileReader();
    reader.onload = () => { if (!exited) adoptLut(String(reader.result ?? ''), file.name, file.name); };
    reader.onerror = () => {
      if (exited) return;
      lutState = 'error';
      showError(t("Couldn't read that file."));
      syncButtons();
    };
    reader.readAsText(file);
  }, { signal });

  // ── Tabs ──────────────────────────────────────────────────────────────────
  for (const btn of work.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
    btn.addEventListener('click', () => {
      const next = btn.dataset.tab;
      tab = next === 'trim' ? 'trim' : next === 'crop' ? 'crop' : 'grade';
      syncTab();
    }, { signal });
  }

  // ── Teardown ──────────────────────────────────────────────────────────────
  const teardown = (): void => {
    if (exited) return;
    exited = true;
    abort.abort();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    if (edgeRaf) cancelAnimationFrame(edgeRaf);
    edgeRaf = 0;
    // Stop this mode's decoder before the element goes, then hand the ORIGINAL
    // preview its playback back exactly as it was found.
    try { vid.pause(); vid.removeAttribute('src'); vid.load(); } catch { /* nothing to stop */ }
    work.remove();
    env.video.loop = origLoop;
    env.video.autoplay = origAutoplay;
    // `paused` is not the whole test it looks like. The catalog's preview carries
    // `autoplay preload="metadata"`, so a mode entered during the load gap reads
    // paused=true on an element that was about to play - and pause() clears the
    // element's autoplaying flag, so putting the ATTRIBUTE back cannot restart it.
    // An element that carries autoplay is therefore played, best effort, rather
    // than left as a dead still frame for the rest of the modal's life.
    if (!origWasPaused || origAutoplay) {
      try {
        const p = env.video.play?.();
        if (p && typeof p.catch === 'function') p.catch(() => { /* autoplay is best effort */ });
      } catch { /* a shell that refuses playback is not this mode's problem */ }
    }
    if (!doneCalled) { doneCalled = true; env.onDone(null); }
  };

  // ── Apply: enqueue and leave ──────────────────────────────────────────────
  const buildRequest = (): VideoJobRequest => {
    const req: VideoJobRequest = { op: tab, source: env.ref, sourceName: env.name };
    if (srcAi === 'full' || srcAi === 'partial') req.aiGeneratedSource = srcAi;
    if (tab === 'grade') {
      req.grade = {
        cubeText,
        ...(lutLabel ? { lutLabel } : {}),
        // Attribution only when a credited LUT is actually applied (cubeText set),
        // never onto a grain/vignette-only grade.
        ...(cubeText && lutCredit ? { lutCredit } : {}),
        lutIntensity: clamp(num('intensity') / 100, 0, 1),
        grain: clamp(num('grain') / 100, 0, 1),
        grainSize: clamp(num('grainsize'), 1, 4),
        vignette: clamp(num('vignette') / 100, 0, 1),
        seed: GRAIN_SEED,
        // fps 0 means "keep the source rate", the same contract the trim below
        // sends: a look changes COLOUR and nothing else, so re-timing 60 fps
        // footage onto a 30 Hz grid would be an edit the user never asked for.
        fps: 0,
        bitrate: OUT_BITRATE,
      };
    } else if (tab === 'crop') {
      req.crop = {
        rect: cropRectFromFrac(cropFrac, vid.videoWidth || 0, vid.videoHeight || 0),
        fps: 30,
        bitrate: OUT_BITRATE,
      };
    } else {
      // fps 0 means "keep the source rate" - a trim changes WHEN, never how
      // smooth, so resampling it to 30 would be a second, unasked-for edit.
      req.trim = { fps: 0, bitrate: OUT_BITRATE, ...(snapEl.checked ? { snapToKeyframe: true } : {}) };
    }
    // The window is a REQUEST-level field, not a trim parameter: it is the
    // reader's decode window, so a crop or a grade with in/out set encodes just
    // that section in the same single pass.
    const range = requestRange();
    if (range) req.range = range;
    return req;
  };

  const doApply = async (): Promise<void> => {
    if (exited || applying || applyBtn.disabled) return;
    applying = true;
    syncButtons();
    try {
      const req = buildRequest();
      const { runVideoJobAsJob } = await import('../lib/video-jobs.ts');
      runVideoJobAsJob(host, req, {
        onComplete: (made) => {
          // The mode is long gone by now; the catalog treats a ref as
          // "refresh the grid", so a landing job is never a surprise modal.
          if (!jobDoneCalled) { jobDoneCalled = true; env.onDone(made); }
        },
        onError: (err) => host.log('error', 'Video edit job failed', { id: env.ref.id, op: req.op, error: String(err) }),
      });
    } catch (e) {
      applying = false;
      host.log('error', 'Video edit enqueue failed', { id: env.ref.id, error: String(e) });
      showError(t("Couldn't start that job."));
      syncButtons();
      return;
    }
    applying = false;
    teardown();
  };

  applyBtn.addEventListener('click', () => { void doApply(); }, { signal });
  q<HTMLButtonElement>('[data-cancel]').addEventListener('click', () => { if (!applying) teardown(); }, { signal });

  syncTab();
  syncTimes();
  // The button that opened the mode is inside the action row the takeover CSS
  // hides, so hand focus to the live tab rather than letting it fall to the
  // dialog root - the keyboard path into the controls starts here.
  work.querySelector<HTMLElement>(`[data-tab="${tab}"]`)?.focus();

  return {
    exit(): void { if (!applying) teardown(); },
    busy(): boolean { return applying; },
  };
}
