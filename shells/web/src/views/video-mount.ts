// SPDX-License-Identifier: MPL-2.0
/**
 * Shell-side <video> position keeper for the tool canvas.
 *
 * The tool canvas is rebuilt via `contentEl.innerHTML` on every rAF-coalesced
 * paint, which DESTROYS each <video> and the template emits a fresh one - so a
 * placed clip would restart at 0 on every edit. This enhancer remembers where each
 * keyed video was (data-video-key; Design sets it to the box id) and seeks
 * the newly-painted element back there, so the clip appears to keep playing while
 * the user edits.
 *
 * Contrast with lottie-mount: that OWNS the players it creates and must reap them
 * or lottie-web's global rAF manager leaks. This owns NO elements - a native
 * <video autoplay muted loop> plays by itself; we only read/write currentTime on
 * whatever the latest paint produced. So there is nothing to leak and nothing to
 * reap; pure progressive enhancement (without it, the clip still plays, just from 0).
 *
 * It also does one required job for export: `mountVideoPlayers` resolves only
 * once every video has a decoded frame (readyState ≥ 2) or a cap elapses, so an
 * exporter that awaits its returned promise snapshots a real frame rather than a
 * blank, not-yet-decoded one - the same settledness contract mountLottiePlayers
 * gives the exporter.
 *
 * Marker attributes (on the <video> the template emits):
 *   data-video-key   required for tracking - a stable per-instance id (box id)
 */

const lastTime = new Map<string, number>();     // data-video-key → last observed currentTime
const wired = new WeakSet<HTMLVideoElement>();   // videos already given listeners (per element instance)

/** Resolve once the video has a decoded frame (or a cap / failure), never wedging. */
function whenDecoded(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2 /* HAVE_CURRENT_DATA */) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { clearTimeout(cap); resolve(); };
    const cap = setTimeout(done, 3000);
    video.addEventListener('loadeddata', done, { once: true });
    video.addEventListener('error', done, { once: true });
  });
}

function trackOne(video: HTMLVideoElement): void {
  const key = video.getAttribute('data-video-key');
  if (!key) return;
  const seek = () => {
    const saved = lastTime.get(key);
    const dur = video.duration;
    if (saved != null && Number.isFinite(dur) && dur > 0) {
      try { video.currentTime = saved % dur; } catch { /* seek disallowed pre-metadata - ignore */ }
    }
    video.play?.()?.catch(() => { /* autoplay policy - a muted video should be fine, but never throw */ });
  };
  if (video.readyState >= 1 /* HAVE_METADATA */) seek();
  else video.addEventListener('loadedmetadata', seek, { once: true });
  // Keep the position current so the NEXT paint's fresh element resumes from here.
  video.addEventListener('timeupdate', () => { lastTime.set(key, video.currentTime); });
}

/**
 * Post-paint pass: track every `[data-video-key]` <video> under `rootEl` (restore
 * its position, keep it playing) and resolve once they've all decoded a frame.
 * Per-element failures never reject - one bad clip must not break the paint/export.
 */
export function mountVideoPlayers(
  rootEl: Element,
  { isCurrent = () => true }: { isCurrent?: () => boolean } = {},
): Promise<void> {
  const run = (async () => {
    if (!isCurrent()) return;
    const vids = [...rootEl.querySelectorAll<HTMLVideoElement>('video[data-video-key]')];
    const seen = new Set<string>();
    for (const video of vids) {
      const key = video.getAttribute('data-video-key');
      if (key) seen.add(key);
      if (!wired.has(video)) { wired.add(video); trackOne(video); }
    }
    // Forget positions for keys no longer on the canvas (box deleted) so the map
    // can't grow unbounded over a long session.
    for (const key of [...lastTime.keys()]) if (!seen.has(key)) lastTime.delete(key);
    // Settledness for exporters: wait for a decoded frame so a snapshot isn't blank.
    if (vids.length) await Promise.all(vids.map(whenDecoded));
  })();
  return run;
}

/**
 * View teardown: drop remembered positions so a re-entered tool starts fresh. No
 * elements are owned, so there is nothing to destroy - the <video>s go away with
 * their canvas.
 */
export function destroyVideoPlayers(): void {
  lastTime.clear();
}
