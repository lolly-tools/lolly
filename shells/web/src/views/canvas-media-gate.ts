// SPDX-License-Identifier: MPL-2.0
/**
 * Media that costs only when seen (canvas performance review B2).
 *
 * Every Design video box is `muted loop autoplay`, so a document with eight clips
 * decoded eight streams on the main thread whether or not any of them was on screen.
 * The gate pauses a clip, and a playing Lottie player, while it is outside the padded
 * viewport of the stage, and pauses all of them while the level of detail is `far` or
 * `overview` (views/free-canvas/lod.ts), where a clip is a few pixels across. It plays
 * them again when they come back.
 *
 * Three rules keep it out of the way of everything else:
 *   - It only resumes what it paused. A clip someone else paused stays paused.
 *   - A clip the sequence clock owns (`skip`) is left alone: with a timeline mounted the
 *     clock already silences a clip outside its window and plays it during playback.
 *   - A render resumes everything (`hold`, wired to lib/stage-lod.ts by the level of
 *     detail): a still export snapshots a paused clip's frame as it is, and a live take
 *     films the screen, so nothing a render reads may stay paused by this gate.
 *
 * Pausing keeps the decoded frame, so a paused clip still shows a picture, and calling
 * `pause()` on a freshly painted clip also stops that clip's `autoplay` from starting. The
 * position keeper (views/video-mount.ts) asks `isMediaGated` before it plays a repainted
 * clip, so the two never fight. `loading="lazy"` and `decoding="async"` are deliberately
 * not used: both would change what an export reads.
 */
import type { AnimationItem } from 'lottie-web';

/** Videos this gate has paused. video-mount reads it before calling play(). */
const gatedVideos = new WeakSet<HTMLVideoElement>();
/** True while the gate holds this clip paused. */
export function isMediaGated(video: HTMLVideoElement): boolean {
  return gatedVideos.has(video);
}

export interface MediaGateOptions {
  /** The scroll box the padded viewport is measured against (the stage). */
  root: Element;
  /** Where the media lives (the tool canvas). */
  canvas: Element;
  /** Margin around the root that still counts as visible, as an IntersectionObserver rootMargin. */
  margin?: string;
  /** Media this gate must not touch (owned by the sequence clock). */
  skip?(el: Element): boolean;
  /** The live Lottie player on a marker, if one is mounted (views/lottie-mount.ts). */
  lottiePlayer?(el: Element): AnimationItem | null;
  /** Injected for tests; defaults to the window's. */
  IntersectionObserver?: typeof IntersectionObserver;
}

export interface MediaGate {
  /** After a paint: watch new media, forget the media the paint removed, apply the rules. */
  scan(): void;
  /** Pause everything (far and overview), or let visibility decide again. */
  setFrozen(frozen: boolean): void;
  /** A render started (true) or ended (false): resume everything, then decide again. */
  setHeld(held: boolean): void;
  destroy(): void;
}

const MEDIA = 'video, [data-lottie-src]';

export function createMediaGate(opts: MediaGateOptions): MediaGate {
  const IO = opts.IntersectionObserver ?? opts.root.ownerDocument?.defaultView?.IntersectionObserver;
  const tracked = new Set<Element>();
  /** Media the observer has reported in view. Unreported media counts as visible. */
  const hidden = new WeakSet<Element>();
  const pausedLottie = new WeakSet<Element>();
  let frozen = false, held = false, disposed = false;

  const io = typeof IO === 'function'
    ? new IO((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) hidden.delete(entry.target); else hidden.add(entry.target);
        apply(entry.target);
      }
    }, { root: opts.root, rootMargin: opts.margin ?? '50%' })
    : null;

  const wanted = (el: Element): boolean => held || (!frozen && !hidden.has(el));

  function applyVideo(video: HTMLVideoElement): void {
    if (wanted(video)) {
      if (!gatedVideos.has(video)) return;
      gatedVideos.delete(video);
      try { void video.play()?.catch(() => { /* autoplay policy: a muted clip is allowed, never throw */ }); } catch { /* detached */ }
      return;
    }
    // Only ambient clips are ours to pause: an `autoplay` clip that is playing, or one
    // that has not started yet (pausing it now stops its autoplay too).
    if (gatedVideos.has(video) || !video.autoplay) return;
    if (!video.paused || video.readyState < 3) {
      gatedVideos.add(video);
      try { video.pause(); } catch { /* detached */ }
    }
  }

  function applyLottie(el: Element): void {
    const anim = opts.lottiePlayer?.(el);
    if (!anim) return;
    if (wanted(el)) {
      if (pausedLottie.has(el)) { pausedLottie.delete(el); anim.play(); }
    } else if (!anim.isPaused) {
      pausedLottie.add(el);
      anim.pause();
    }
  }

  function apply(el: Element): void {
    // A clip a paint has detached is left as it is: playing it would decode for nobody.
    if (disposed || !el.isConnected || opts.skip?.(el)) return;
    if (el.tagName === 'VIDEO') applyVideo(el as HTMLVideoElement);
    else applyLottie(el);
  }

  function applyAll(): void { for (const el of tracked) apply(el); }

  return {
    scan() {
      if (disposed) return;
      for (const el of tracked) {
        if (el.isConnected) continue;
        tracked.delete(el);
        io?.unobserve(el);
      }
      for (const el of opts.canvas.querySelectorAll(MEDIA)) {
        if (tracked.has(el)) { apply(el); continue; }
        tracked.add(el);
        io?.observe(el);
        apply(el);
      }
    },
    setFrozen(next) {
      if (frozen === next) return;
      frozen = next;
      applyAll();
    },
    setHeld(next) {
      if (held === next) return;
      held = next;
      applyAll();
    },
    destroy() {
      // Leave nothing paused behind: a clip this gate stopped plays again.
      held = true;
      applyAll();
      disposed = true;
      io?.disconnect();
      tracked.clear();
    },
  };
}
