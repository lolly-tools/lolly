// SPDX-License-Identifier: MPL-2.0
/**
 * Live-capture video export - records the ON-SCREEN preview through a screen
 * share, so the finished clip's frame pacing matches what the user actually
 * watched. The offline renderVideo path re-renders each frame deterministically;
 * this path is the opt-in alternative for "I want exactly what I'm seeing"
 * (chosen via the export panel's "Record live" toggle - never the default).
 *
 * Three tiers, one recorder:
 *  - Element Capture (Chromium 132+, self-tab share): RestrictionTarget/restrictTo
 *    crops to the stage AND excludes occluding content - page chrome, toasts, our
 *    own countdown pill can never land in the clip. Verified with a black-frame
 *    probe (an ineligible element yields black frames, which we must not ship).
 *  - Region Capture (Chromium 104+, self-tab share): CropTarget/cropTo crops the
 *    track to the stage box - pixel-exact and element-following, but occluders
 *    inside the box still record, so overlapping chrome is hidden for the take.
 *  - Everywhere else (Safari/Firefox, or a window/monitor share): the browser
 *    can't crop, so the stage is located IN the shared picture: a short "setting
 *    the stage" flash (solid magenta, then solid green - ~700ms, dressed as a
 *    camera-flash moment with a caption pill and an iris-wipe reveal) is found in
 *    the incoming frames by live-capture-detect.ts, and every subsequent
 *    compositor frame is drawn cropped onto a canvas whose captureStream feeds
 *    the recorder. One encode, no post-processing.
 *
 * Capture hygiene, learned from real takes:
 *  - Chrome's "sharing this tab" banner resizes the viewport right AFTER the
 *    share is granted; the app re-fits the canvas and an element crop would
 *    change dimensions mid-take. settleLayout() waits for the stage rect to
 *    stop moving before anything is measured or recorded.
 *  - App chrome that hovers over the stage (the zoom HUD) opts in to hiding via
 *    the [data-live-hide] attribute - the rule ships in this module's injected
 *    <style>, so it applies for exactly the take and can't leak.
 *  - The countdown pill only mounts where it cannot be recorded: fully outside
 *    the stage rect, or anywhere under the occlusion-safe tier. When there's no
 *    safe spot the pill is skipped and the countdown rides opts.onProgress to
 *    the export button instead.
 *
 * Frames are delivered by requestVideoFrameCallback (rAF fallback), so the
 * recording keeps the compositor's real cadence - including any jank the user
 * saw. Lazy-loaded from export.ts only when the option is used.
 */

import { createStageLocator, scaleRect } from './live-capture-detect.ts';
import type { Rect } from './live-capture-detect.ts';

export interface LiveCaptureOpts {
  durationMs: number;
  mimeType: string;
  videoBitsPerSecond: number;
  /** Optional music bed (export.ts's looped-audio track); started via onRecordStart. */
  audioTrack?: MediaStreamTrack | null;
  onRecordStart?: () => void;
  /** Countdown for UI outside the capture (the export button): (secondsLeft, totalSeconds). */
  onProgress?: (secondsLeft: number, totalSeconds: number) => void;
  onWarn?: (msg: string) => void;
}

// Non-standard surfaces, typed locally: Element Capture (Chromium 132+), Region
// Capture (Chromium 104+) and the self-capture picker hints. Absent members are
// probed before use, so the casts never assume availability.
interface CaptureTargetCtor { fromElement(el: Element): Promise<unknown>; }
type CaptureTrack = MediaStreamTrack & {
  cropTo?: (target: unknown) => Promise<void>;
  restrictTo?: (target: unknown | null) => Promise<void>;
};
type RvfcVideo = HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
type DisplayRequest = NonNullable<Parameters<MediaDevices['getDisplayMedia']>[0]>;

const MAGENTA = '#ff00ff';
const GREEN = '#00ff00';
const MIN_HOLD_MS = 240;        // each flash colour stays up at least this long - the pop should read, not strobe
const LOCATE_TIMEOUT_MS = 2600; // give a slow compositor ~2 full pulse cycles before giving up
const AUDIO_BITRATE = 128_000;  // matches the offline export path's bed rate
const PILL_H = 34;              // pill box height incl. padding - placement math only
const PILL_GAP = 12;

const NOT_FOUND_MSG =
  "Couldn't find the canvas in the shared picture - share this tab (or the screen it's on) and keep it visible.";

/** One compositor frame: rVFC where available (Safari 15.4+, Firefox 130+, Chrome), rAF otherwise. */
function nextFrame(video: RvfcVideo): Promise<void> {
  return new Promise(resolve => {
    if (typeof video.requestVideoFrameCallback === 'function') video.requestVideoFrameCallback(() => resolve());
    else requestAnimationFrame(() => resolve());
  });
}

async function openVideo(display: MediaStream): Promise<RvfcVideo> {
  const video = document.createElement('video') as RvfcVideo;
  video.srcObject = display;
  video.muted = true;
  video.setAttribute('playsinline', '');
  await video.play();               // a srcObject video plays (and fires rVFC) without joining the DOM
  if (!video.videoWidth) {
    await new Promise<void>(r => video.addEventListener('loadedmetadata', () => r(), { once: true }));
  }
  return video;
}

/**
 * Wait for the stage's box to stop moving before measuring anything. Granting a
 * tab share pushes Chrome's "sharing this tab" banner into the viewport, the app
 * re-fits the canvas, and an element crop recorded across that re-fit changes
 * frame dimensions mid-clip (seen in the field: 2476px opening frames, 2368px
 * after the banner). Two consecutive stable reads ≈ layout is done.
 */
async function settleLayout(stage: Element, maxMs = 1500): Promise<DOMRect> {
  let prev = stage.getBoundingClientRect();
  const t0 = performance.now();
  for (;;) {
    await new Promise(r => setTimeout(r, 180));
    const cur = stage.getBoundingClientRect();
    const same = Math.abs(cur.left - prev.left) < 1 && Math.abs(cur.top - prev.top) < 1 &&
      Math.abs(cur.width - prev.width) < 1 && Math.abs(cur.height - prev.height) < 1;
    if (same || performance.now() - t0 > maxMs) return cur;
    prev = cur;
  }
}

/**
 * True when the restricted track is producing effectively black frames - the
 * Element Capture failure mode for an ineligible element (the API substitutes
 * black rather than throwing). Samples a coarse grid over two frames. A tool
 * whose canvas is genuinely near-black trips this too and falls back to the
 * cropTo tier - a cosmetic downgrade (occluders record), never a black clip.
 */
async function looksBlack(video: RvfcVideo): Promise<boolean> {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  let maxChannel = 0;
  for (let f = 0; f < 2; f++) {
    await nextFrame(video);
    ctx.drawImage(video, 0, 0, 32, 32);
    const { data } = ctx.getImageData(0, 0, 32, 32);
    for (let i = 0; i < data.length; i += 4) {
      maxChannel = Math.max(maxChannel, data[i]!, data[i + 1]!, data[i + 2]!);
    }
    if (maxChannel > 8) return false;
  }
  return maxChannel <= 8;
}

// ── The "setting the stage" overlay ──────────────────────────────────────────
// A fixed-position panel exactly over the stage (the flash the detector reads)
// plus a caption pill. The flash pops in, pulses an outer glow, swaps colours
// like camera flashes, then irises shut to reveal the real canvas. The injected
// <style> also carries the [data-live-hide] rule, so app chrome marked with that
// attribute (the zoom HUD) vanishes for exactly the overlay's lifetime.
interface LiveOverlay {
  setColor(css: string): void;
  caption(text: string, tone?: 'stage' | 'rec'): void;
  reveal(): Promise<void>;
  remove(): void;
}

function mountLiveOverlay(rect: DOMRect, o: { withPanel: boolean; allowInsidePill: boolean }): LiveOverlay {
  const root = document.createElement('div');
  root.setAttribute('data-live-capture-overlay', '');
  root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483000;';
  const style = document.createElement('style');
  style.textContent = `
    @keyframes lolly-lc-pop { from { transform: scale(.965); opacity: 0 } to { transform: scale(1); opacity: 1 } }
    @keyframes lolly-lc-glow { 0%,100% { box-shadow: 0 0 26px 4px var(--lc-glow) } 50% { box-shadow: 0 0 64px 12px var(--lc-glow) } }
    @keyframes lolly-lc-dot { 50% { opacity: .25 } }
    [data-live-hide] { visibility: hidden !important; }
  `;
  root.appendChild(style);

  let panel: HTMLDivElement | null = null;
  if (o.withPanel) {
    panel = document.createElement('div');
    panel.style.cssText = [
      `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`,
      `background:${MAGENTA};--lc-glow:${MAGENTA}66`,
      'animation:lolly-lc-pop 80ms ease-out, lolly-lc-glow 900ms ease-in-out 80ms infinite',
      'clip-path:circle(120% at 50% 50%)',
    ].join(';');
    root.appendChild(panel);
  }

  // Pill placement: fully BELOW or fully ABOVE the stage rect - never overlapping
  // it, because both crop tiers record anything inside the box. Under the
  // occlusion-safe tier an inside-top fallback is allowed (it can't be recorded);
  // otherwise, no safe spot → no pill (the export button carries the countdown).
  const fitsBelow = rect.bottom + PILL_GAP + PILL_H <= window.innerHeight - 4;
  const fitsAbove = rect.top - PILL_GAP - PILL_H >= 4;
  const pillTop = fitsBelow ? rect.bottom + PILL_GAP
    : fitsAbove ? rect.top - PILL_GAP - PILL_H
    : o.allowInsidePill ? rect.top + PILL_GAP
    : null;

  let txt: HTMLSpanElement | null = null;
  let dot: HTMLSpanElement | null = null;
  if (pillTop !== null) {
    const pill = document.createElement('div');
    pill.style.cssText = [
      `position:fixed;left:${rect.left + rect.width / 2}px;top:${pillTop}px;transform:translateX(-50%)`,
      'display:flex;align-items:center;gap:8px;padding:7px 14px;border-radius:999px',
      'background:rgba(20,20,24,.85);color:#fff;backdrop-filter:blur(6px)',
      'font:600 13px/1.2 SUSE,system-ui,sans-serif;white-space:nowrap',
      'animation:lolly-lc-pop 120ms ease-out',
    ].join(';');
    dot = document.createElement('span');
    dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#fbbf24;animation:lolly-lc-dot 1s ease-in-out infinite;';
    txt = document.createElement('span');
    pill.append(dot, txt);
    root.appendChild(pill);
  }
  document.body.appendChild(root);

  return {
    setColor(css: string): void {
      if (!panel) return;
      panel.style.background = css;
      panel.style.setProperty('--lc-glow', `${css}66`);
    },
    caption(text: string, tone: 'stage' | 'rec' = 'stage'): void {
      if (!txt || !dot) return;                   // pill had no capture-safe spot - button carries the text
      txt.textContent = text;
      dot.style.background = tone === 'rec' ? '#ef4444' : '#fbbf24';
    },
    async reveal(): Promise<void> {
      if (!panel) return;
      const p = panel;
      panel = null;
      p.style.animation = 'none';                 // stop the glow so only the iris plays out
      p.style.transition = 'clip-path 200ms ease-in';
      // Force the start state before flipping to the collapsed circle.
      void p.offsetWidth;
      p.style.clipPath = 'circle(0% at 50% 50%)';
      await new Promise<void>(r => {
        const done = (): void => { p.remove(); r(); };
        p.addEventListener('transitionend', done, { once: true });
        setTimeout(done, 320);                    // fallback - never hang the export on a lost event
      });
    },
    remove(): void { root.remove(); },
  };
}

// ── Stage location (the calibrated tier) ─────────────────────────────────────
// Drives the flash colours from detection progress: magenta until the locator
// has read it (min hold applies), then green until the locator confirms. The
// result is the stage rect in video pixels.
async function locateStage(video: RvfcVideo, overlay: LiveOverlay): Promise<Rect> {
  const sw = Math.min(480, video.videoWidth);
  const sh = Math.max(1, Math.round(video.videoHeight * (sw / video.videoWidth)));
  const sample = document.createElement('canvas');
  sample.width = sw;
  sample.height = sh;
  const ctx = sample.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D is unavailable - cannot locate the stage.');

  const locator = createStageLocator();
  const t0 = performance.now();
  let onGreen = false;
  overlay.setColor(MAGENTA);
  for (;;) {
    await nextFrame(video);
    const elapsed = performance.now() - t0;
    if (elapsed > LOCATE_TIMEOUT_MS) throw new Error(NOT_FOUND_MSG);
    ctx.drawImage(video, 0, 0, sw, sh);
    const found = locator.feed(ctx.getImageData(0, 0, sw, sh));
    if (found) {
      return scaleRect(found, video.videoWidth / sw, video.videoHeight / sh, video.videoWidth, video.videoHeight);
    }
    if (!onGreen && locator.phase === 'seek-b' && elapsed >= MIN_HOLD_MS) {
      onGreen = true;                             // magenta has been READ - flash to the confirm colour
      overlay.setColor(GREEN);
    }
  }
}

// Draw each compositor frame's stage region onto a recording canvas, delivered
// by hand (captureStream(0) + requestFrame) so exactly the frames the user saw
// get encoded. Falls back to the 60fps auto-sampler where requestFrame is
// missing. Returns the stream to record; the pump stops via the disposer.
function startCropPump(video: RvfcVideo, crop: Rect, disposers: Array<() => void>): MediaStream {
  const canvas = document.createElement('canvas');
  canvas.width = crop.w;
  canvas.height = crop.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable - cannot crop the recording.');
  let stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined;
  let deliver: () => void;
  if (typeof track?.requestFrame === 'function') {
    deliver = () => track.requestFrame();
  } else {
    stream.getTracks().forEach(t => { t.stop(); });
    stream = canvas.captureStream(60);
    deliver = () => {};
  }
  try { stream.getVideoTracks()[0]!.contentHint = 'motion'; } catch { /* hint only */ }

  let live = true;
  disposers.push(() => { live = false; stream.getTracks().forEach(t => { try { t.stop(); } catch { /* stopping */ } }); });
  void (async () => {
    while (live) {
      await nextFrame(video);
      if (!live) break;
      ctx.drawImage(video, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
      deliver();
    }
  })();
  return stream;
}

/**
 * Record the stage for opts.durationMs and return the encoded clip. The share
 * ending early (the browser's own "Stop sharing" bar) finishes the take with
 * the footage so far rather than losing it; a genuinely empty take throws.
 */
export async function captureLiveClip(stage: Element, opts: LiveCaptureOpts): Promise<Blob> {
  const disposers: Array<() => void> = [];
  const cleanup = (): void => { while (disposers.length) { try { disposers.pop()!(); } catch { /* teardown */ } } };

  try {
    const request: DisplayRequest & Record<string, unknown> = {
      video: { frameRate: { ideal: 60 } },
      audio: false,
      // Chromium picker hints (ignored elsewhere): lead with this tab - the only
      // surface that can be cropped exactly - and disallow mid-take switching.
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      surfaceSwitching: 'exclude',
    };
    const display = await navigator.mediaDevices.getDisplayMedia(request);
    disposers.push(() => display.getTracks().forEach(t => { try { t.stop(); } catch { /* stopping */ } }));
    const track = display.getVideoTracks()[0] as CaptureTrack | undefined;
    if (!track) throw new Error('The screen share provided no video.');
    try { track.contentHint = 'motion'; } catch { /* hint only */ }

    // Granting the share moves the layout (Chrome's tab banner) - wait it out,
    // THEN measure. Everything below uses the settled rect.
    const rect = await settleLayout(stage);
    const onScreen = rect.width > 4 && rect.height > 4 &&
      rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
    if (!onScreen) throw new Error('Live recording needs the preview visible on screen.');

    const isSelfTab = track.getSettings().displaySurface === 'browser';

    // Tier 0 - Element Capture: crop AND occlusion exclusion. Forcing a stacking
    // context (isolation) satisfies the API's main eligibility rule; the black-
    // frame probe catches the rest (ineligibility substitutes black frames).
    let occlusionSafe = false;
    const RT = (globalThis as { RestrictionTarget?: CaptureTargetCtor }).RestrictionTarget;
    if (isSelfTab && typeof RT?.fromElement === 'function' && typeof track.restrictTo === 'function') {
      const stageStyle = (stage as HTMLElement).style;
      const prevIsolation = stageStyle?.isolation ?? '';
      try {
        if (stageStyle) stageStyle.isolation = 'isolate';
        await track.restrictTo(await RT.fromElement(stage));
        const probe = await openVideo(display);
        occlusionSafe = !(await looksBlack(probe));
        probe.pause();
        probe.srcObject = null;
        if (!occlusionSafe) await track.restrictTo(null);   // un-restrict so cropTo can take over
      } catch { occlusionSafe = false; }
      if (stageStyle && !occlusionSafe) stageStyle.isolation = prevIsolation;
      else if (stageStyle) disposers.push(() => { stageStyle.isolation = prevIsolation; });
    }

    // Tier 1 - Region Capture: exact element crop, occluders still visible (the
    // overlay's [data-live-hide] rule hides the app's stage chrome for the take).
    let cropped = occlusionSafe;
    if (!cropped && isSelfTab) {
      const CT = (globalThis as { CropTarget?: CaptureTargetCtor }).CropTarget;
      if (typeof CT?.fromElement === 'function' && typeof track.cropTo === 'function') {
        try {
          await track.cropTo(await CT.fromElement(stage));
          cropped = true;
        } catch { /* not our tab, or cropping refused - locate the stage instead */ }
      }
    }

    const overlay = mountLiveOverlay(rect, { withPanel: !cropped, allowInsidePill: occlusionSafe });
    disposers.push(() => overlay.remove());

    let recStream: MediaStream;
    if (cropped) {
      recStream = new MediaStream([track]);
    } else {
      // Tier 2 - flash, find, crop. The video element decodes the share for both
      // the locator and the per-frame crop pump.
      const video = await openVideo(display);
      disposers.push(() => { video.pause(); video.srcObject = null; });
      overlay.caption('Setting the stage…');
      const crop = await locateStage(video, overlay);
      await overlay.reveal();
      await nextFrame(video);                     // two fresh compositor frames so the
      await nextFrame(video);                     // wipe itself never opens the clip
      recStream = startCropPump(video, crop, disposers);
    }
    if (opts.audioTrack) recStream.addTrack(opts.audioTrack);

    // Drifting mid-take is unrecoverable for tier 2 (the crop rect is fixed in
    // screen space) and merely unnecessary for the element tiers - warn either way.
    const onScroll = (): void => opts.onWarn?.('Page scrolled during the live recording - the canvas may drift out of frame.');
    const onVis = (): void => {
      if (document.hidden) opts.onWarn?.('Tab hidden during the live recording - frames freeze while it is not visible.');
    };
    window.addEventListener('scroll', onScroll, { once: true, capture: true });
    document.addEventListener('visibilitychange', onVis);
    disposers.push(() => {
      window.removeEventListener('scroll', onScroll, { capture: true });
      document.removeEventListener('visibilitychange', onVis);
    });

    const recorder = new MediaRecorder(recStream, {
      mimeType: opts.mimeType,
      videoBitsPerSecond: opts.videoBitsPerSecond,
      ...(opts.audioTrack ? { audioBitsPerSecond: AUDIO_BITRATE } : {}),
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    const totalSec = Math.ceil(opts.durationMs / 1000);
    const blob = await new Promise<Blob>((resolve, reject) => {
      let timer = 0;
      const finish = (): void => {
        clearInterval(timer);
        resolve(new Blob(chunks, { type: recorder.mimeType || opts.mimeType }));
      };
      recorder.onerror = e => {
        clearInterval(timer);
        reject((e as unknown as { error?: Error }).error ?? new Error('Live recording failed'));
      };
      recorder.onstop = finish;
      recorder.start();
      opts.onRecordStart?.();
      const t0 = performance.now();
      const stop = (): void => { try { recorder.stop(); } catch { finish(); } };
      const tick = (leftMs: number): void => {
        const s = Math.ceil(leftMs / 1000);
        overlay.caption(`Recording · ${s}s`, 'rec');
        opts.onProgress?.(s, totalSec);
      };
      timer = window.setInterval(() => {
        const left = Math.max(0, opts.durationMs - (performance.now() - t0));
        tick(left);
        if (left <= 0) { clearInterval(timer); stop(); }
      }, 250);
      tick(opts.durationMs);
      // The browser's own "Stop sharing" bar ends the track without telling us - 
      // finish the take with what's recorded rather than stranding it.
      track.addEventListener('ended', () => { clearInterval(timer); stop(); }, { once: true });
    });

    if (blob.size === 0) throw new Error('The live recording was empty - the share ended before any frames arrived.');
    return blob;
  } finally {
    cleanup();
  }
}
