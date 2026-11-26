// SPDX-License-Identifier: MPL-2.0
/**
 * A themed transport for a plain `<audio>` element.
 *
 * WHY NOT `<audio controls>`. The native control strip cannot be themed in any browser
 * that matters - it ignores the brand entirely, ships its own grey chrome, and changes
 * shape between platforms. Inside a modal that is otherwise fully branded it reads as a
 * piece of another application, which is exactly what it looked like.
 *
 * WHY NOT REUSE THE NEUROSPICY PLAYER. That component is bound to the focus-loop engine
 * (`getNeurospicy`, `listLoops`, the shared analyser graph) rather than to an element, so
 * it cannot drive an arbitrary asset preview. What IS shared is the look and the glyphs,
 * which both take from lib/icons.ts. This owns only the element wiring.
 *
 * The `<audio>` element STAYS: it is the playback engine, and the level meter and the
 * visualiser both tap it (an element can only ever produce one MediaElementSource, so
 * replacing it with Web Audio here would break both). All this does is hide the native
 * chrome and drive the same element from our own controls.
 *
 * DURATION IS OFTEN UNKNOWN AT FIRST, and for some sources never: a zzfxm song is still
 * rendering to a blob when the modal opens, a stream has no length, and a file served
 * without range support reports `Infinity`. So the scrubber refuses interaction until a
 * finite duration arrives, rather than offering a control that silently does nothing - 
 * but the ELAPSED clock keeps running throughout, because that number is always real and
 * is the one a listener is actually reading.
 */
import { snapToGrid, seekKeyTarget } from '@lolly-tools/audio-dock/seek-grid';
import type { DockPositionText, DockSeekGrid } from '@lolly-tools/audio-dock';
import { icon } from './icons.ts';
import { escape } from '../utils.ts';

// The registry already had all four - see lib/icons.ts. Rendering through `icon()` rather
// than inlining SVG is what keeps one glyph one definition across every player.
const PLAY = icon('play', { size: 18, filled: true });
const PAUSE = icon('pause', { size: 18, filled: true });
const VOLUME = icon('volumeOn', { size: 16 });
const MUTED = icon('volumeOff', { size: 16 });

/** m:ss, or `--:--` when there is no finite time to show. */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Where the track is, for a source the element cannot report: a generated tune plays
 * into the element as a live stream, whose clock is not the tune's (lib/tune-preview.ts).
 * With a source the transport reads the time from it and seeks through it; the element
 * still plays, pauses and sets the volume.
 */
export interface TransportSource {
  /** Seconds into the track and its length; null while it is not known yet. */
  position(): { seconds: number; duration: number } | null;
  seek(seconds: number): void;
  /** Where a seek can land (a tune's bars, which a drag snaps to and the arrows step along). */
  grid?(): DockSeekGrid | null;
  /** Words for a position: the bar and part shown above the scrubber, and its spoken value. */
  describe?(seconds: number): DockPositionText;
  /** Called when the position changes other than by playing on (a seek, the end of the track). */
  onChange?(listener: () => void): () => void;
}

export interface AudioTransportLabels {
  play: string;
  pause: string;
  seek: string;
  mute: string;
  unmute: string;
  volume: string;
}

const FALLBACK: AudioTransportLabels = {
  play: 'Play', pause: 'Pause', seek: 'Seek',
  mute: 'Mute', unmute: 'Unmute', volume: 'Volume',
};

/**
 * The markup. Self-contained and inert until wired - safe to drop into a template string.
 * Styling lives with the surface that uses it (see `.cat-tp-*` in styles/parts/asset-shared.css)
 * so this module stays free of any one view's layout.
 */
export function audioTransportHtml(labels: Partial<AudioTransportLabels> = {}): string {
  const l = { ...FALLBACK, ...labels };
  return `<span class="cat-tp" data-transport>`
    + `<button type="button" class="cat-tp-btn cat-tp-play" data-tp-play`
    + ` title="${escape(l.play)}" aria-label="${escape(l.play)}">${PLAY}</button>`
    + `<span class="cat-tp-time" data-tp-time aria-hidden="true">--:--</span>`
    // role=slider rather than a bare div: this is the only seek surface, and it has to be
    // reachable and operable from the keyboard like the native control it replaces.
    + `<span class="cat-tp-seek" data-tp-seek role="slider" tabindex="0"`
    + ` aria-label="${escape(l.seek)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">`
    + `<span class="cat-tp-seek-fill" data-tp-fill></span><span data-tp-marks></span></span>`
    // A generated tune's bar and part ("Bar 5 of 43 · Verse"), just above the bar.
    + `<span class="cat-tp-pos" data-tp-pos hidden></span>`
    + `<button type="button" class="cat-tp-btn cat-tp-mute" data-tp-mute`
    + ` title="${escape(l.mute)}" aria-label="${escape(l.mute)}" aria-pressed="false">${VOLUME}</button>`
    + `<input type="range" class="cat-tp-vol" data-tp-vol min="0" max="1" step="0.01" value="1"`
    + ` aria-label="${escape(l.volume)}">`
    + `</span>`;
}

export interface AudioTransport {
  /** Re-read the element and repaint every control. Safe to call at any time. */
  refresh(): void;
  /** Detach every listener. Idempotent. */
  destroy(): void;
}

/**
 * Wire the markup in `root` to `audioEl`.
 *
 * Returns a handle even when the markup is absent (a caller that renders the bar
 * conditionally), so callers never have to null-check.
 */
export function wireAudioTransport(
  root: ParentNode,
  audioEl: HTMLAudioElement,
  labels: Partial<AudioTransportLabels> = {},
  source?: TransportSource,
): AudioTransport {
  const l = { ...FALLBACK, ...labels };
  const wrap = root.querySelector<HTMLElement>('[data-transport]');
  const playBtn = root.querySelector<HTMLButtonElement>('[data-tp-play]');
  const timeEl = root.querySelector<HTMLElement>('[data-tp-time]');
  const seek = root.querySelector<HTMLElement>('[data-tp-seek]');
  const fill = root.querySelector<HTMLElement>('[data-tp-fill]');
  const muteBtn = root.querySelector<HTMLButtonElement>('[data-tp-mute]');
  const posEl = root.querySelector<HTMLElement>('[data-tp-pos]');
  const marksEl = root.querySelector<HTMLElement>('[data-tp-marks]');
  const vol = root.querySelector<HTMLInputElement>('[data-tp-vol]');
  if (!wrap || !playBtn || !seek || !fill) return { refresh() {}, destroy() {} };

  // Hide the native strip only once we KNOW our own controls are in place. Removing the
  // attribute up front would leave an unplayable element behind if the wiring bailed.
  audioEl.controls = false;

  // The clock: the source's when there is one, else the element's.
  const duration = (): number => (source ? source.position()?.duration ?? 0 : audioEl.duration);
  const now = (): number => (source ? source.position()?.seconds ?? 0 : audioEl.currentTime);
  const grid = (): DockSeekGrid | null => source?.grid?.() ?? null;
  const seekable = (): boolean => Number.isFinite(duration()) && duration() > 0;
  let scrubbing = false;
  /** Where a drag over a source will land; it seeks when the pointer lets go. */
  let dragAt: number | null = null;
  let marksDrawn: readonly number[] | undefined;

  /** The part ticks in the scrubber, redrawn only when the source hands over other marks. */
  const paintMarks = (): void => {
    const marks = seekable() ? grid()?.marks : undefined;
    if (!marksEl || marks === marksDrawn) return;
    marksDrawn = marks;
    const total = duration();
    marksEl.replaceChildren(...(marks ?? []).filter((m) => m > 0 && m < total).map((m) => {
      const tick = document.createElement('span');
      tick.className = 'cat-tp-mark';
      tick.style.left = `${((m / total) * 100).toFixed(3)}%`;
      return tick;
    }));
  };

  const paint = (): void => {
    const playing = !audioEl.paused && !audioEl.ended;
    playBtn.innerHTML = playing ? PAUSE : PLAY;
    const label = playing ? l.pause : l.play;
    playBtn.title = label;
    playBtn.setAttribute('aria-label', label);

    const at = dragAt ?? now();
    const pct = seekable() ? Math.min(100, Math.max(0, (at / duration()) * 100)) : 0;
    fill.style.width = `${pct}%`;
    seek.setAttribute('aria-valuenow', String(Math.round(pct)));
    seek.setAttribute('aria-disabled', String(!seekable()));
    // ELAPSED IS ALWAYS KNOWN, even when the length is not - a source served without
    // range support reports `Infinity` for duration, and blanking the whole readout for
    // it loses the one number the listener actually wants. Show `0:12` and add `/ 1:30`
    // only once there is a real length; seeking stays disabled either way.
    const clock = seekable()
      ? `${formatTime(at)} / ${formatTime(duration())}`
      : formatTime(at);
    const words = seekable() ? source?.describe?.(at) : undefined;
    seek.setAttribute('aria-valuetext', words?.spoken ?? clock);
    if (timeEl) timeEl.textContent = clock;
    if (posEl) {
      posEl.textContent = words?.label ?? '';
      posEl.hidden = !words?.label;
    }
    paintMarks();

    const muted = audioEl.muted || audioEl.volume === 0;
    if (muteBtn) {
      muteBtn.innerHTML = muted ? MUTED : VOLUME;
      const ml = muted ? l.unmute : l.mute;
      muteBtn.title = ml;
      muteBtn.setAttribute('aria-label', ml);
      muteBtn.setAttribute('aria-pressed', String(muted));
    }
    // Don't fight the user's finger: writing the value mid-drag snaps the thumb back.
    if (vol && document.activeElement !== vol) vol.value = String(audioEl.muted ? 0 : audioEl.volume);
  };

  /** Go to `seconds`: through the source, on its grid, or on the element. */
  const seekTo = (seconds: number): void => {
    if (source) source.seek(snapToGrid(seconds, grid(), duration()));
    else audioEl.currentTime = Math.min(audioEl.duration, Math.max(0, seconds));
    paint();
  };

  const seekToClientX = (clientX: number): void => {
    if (!seekable()) return;
    const r = seek.getBoundingClientRect();
    if (r.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    // A source (a generated tune) starts again wherever it seeks, so a drag shows where it
    // will land, snapped to the grid, and seeks once when the pointer lets go.
    if (source) { dragAt = snapToGrid(ratio * duration(), grid(), duration()); paint(); return; }
    audioEl.currentTime = ratio * audioEl.duration;
    paint();
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (!seekable()) return;
    scrubbing = true;
    // Capture on the BAR, so a drag that leaves the 4px strip (all of them do) keeps
    // seeking instead of dying the moment the pointer moves off it.
    seek.setPointerCapture(e.pointerId);
    seekToClientX(e.clientX);
  };
  const onPointerMove = (e: PointerEvent): void => { if (scrubbing) seekToClientX(e.clientX); };
  const onPointerUp = (e: PointerEvent): void => {
    if (!scrubbing) return;
    scrubbing = false;
    try { seek.releasePointerCapture(e.pointerId); } catch { /* already gone */ }
    const landing = dragAt;
    dragAt = null;
    if (landing !== null && e.type === 'pointerup') seekTo(landing);
    else paint();
  };

  const onKey = (e: KeyboardEvent): void => {
    if (!seekable()) return;
    // A source steps along its grid: the arrows a bar, Page Up and Page Down a part, the
    // rules the Neurospicy player's scrub keeps (packages/audio-dock seek-grid).
    if (source) {
      const to = seekKeyTarget(e.key, now(), grid(), duration());
      if (to === null) return;
      e.preventDefault();
      e.stopPropagation();   // the arrows are the slider's, not a page turn in the sheet around it
      seekTo(to);
      return;
    }
    const step = e.key === 'PageUp' || e.key === 'PageDown' ? 30 : 5;
    let delta = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'PageUp') delta = step;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'PageDown') delta = -step;
    else if (e.key === 'Home') { e.preventDefault(); audioEl.currentTime = 0; paint(); return; }
    else if (e.key === 'End') { e.preventDefault(); audioEl.currentTime = audioEl.duration; paint(); return; }
    else return;
    e.preventDefault();
    e.stopPropagation();
    audioEl.currentTime = Math.min(audioEl.duration, Math.max(0, audioEl.currentTime + delta));
    paint();
  };

  const onPlayBtn = (): void => {
    // A rejected play() is ordinary (autoplay policy, an unplayable source) and must not
    // throw into the click handler - repaint so the button reflects reality either way.
    if (audioEl.paused || audioEl.ended) void audioEl.play().then(paint, paint);
    else { audioEl.pause(); paint(); }
  };
  const onMuteBtn = (): void => { audioEl.muted = !audioEl.muted; paint(); };
  const onVol = (): void => {
    if (!vol) return;
    const v = Number(vol.value);
    audioEl.volume = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
    // Moving the slider off zero is an unmute - otherwise the audio stays silent while
    // the control claims otherwise.
    audioEl.muted = audioEl.volume === 0;
    paint();
  };

  playBtn.addEventListener('click', onPlayBtn);
  muteBtn?.addEventListener('click', onMuteBtn);
  vol?.addEventListener('input', onVol);
  seek.addEventListener('pointerdown', onPointerDown);
  seek.addEventListener('pointermove', onPointerMove);
  seek.addEventListener('pointerup', onPointerUp);
  seek.addEventListener('pointercancel', onPointerUp);
  seek.addEventListener('keydown', onKey);

  // `durationchange` and `loadedmetadata` are what turn the scrubber on for a source
  // whose length only becomes known after the modal opened.
  const EVENTS = ['play', 'pause', 'ended', 'timeupdate', 'durationchange',
    'loadedmetadata', 'volumechange', 'emptied'] as const;
  for (const ev of EVENTS) audioEl.addEventListener(ev, paint);
  const unsubscribe = source?.onChange?.(paint);

  paint();

  return {
    refresh: paint,
    destroy() {
      playBtn.removeEventListener('click', onPlayBtn);
      muteBtn?.removeEventListener('click', onMuteBtn);
      vol?.removeEventListener('input', onVol);
      seek.removeEventListener('pointerdown', onPointerDown);
      seek.removeEventListener('pointermove', onPointerMove);
      seek.removeEventListener('pointerup', onPointerUp);
      seek.removeEventListener('pointercancel', onPointerUp);
      seek.removeEventListener('keydown', onKey);
      for (const ev of EVENTS) audioEl.removeEventListener(ev, paint);
      unsubscribe?.();
    },
  };
}
