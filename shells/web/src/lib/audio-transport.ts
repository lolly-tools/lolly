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
 * Styling lives with the surface that uses it (see `.cat-tp-*` in styles/parts/catalog.css)
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
    + `<span class="cat-tp-seek-fill" data-tp-fill></span></span>`
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
): AudioTransport {
  const l = { ...FALLBACK, ...labels };
  const wrap = root.querySelector<HTMLElement>('[data-transport]');
  const playBtn = root.querySelector<HTMLButtonElement>('[data-tp-play]');
  const timeEl = root.querySelector<HTMLElement>('[data-tp-time]');
  const seek = root.querySelector<HTMLElement>('[data-tp-seek]');
  const fill = root.querySelector<HTMLElement>('[data-tp-fill]');
  const muteBtn = root.querySelector<HTMLButtonElement>('[data-tp-mute]');
  const vol = root.querySelector<HTMLInputElement>('[data-tp-vol]');
  if (!wrap || !playBtn || !seek || !fill) return { refresh() {}, destroy() {} };

  // Hide the native strip only once we KNOW our own controls are in place. Removing the
  // attribute up front would leave an unplayable element behind if the wiring bailed.
  audioEl.controls = false;

  const seekable = (): boolean => Number.isFinite(audioEl.duration) && audioEl.duration > 0;
  let scrubbing = false;

  const paint = (): void => {
    const playing = !audioEl.paused && !audioEl.ended;
    playBtn.innerHTML = playing ? PAUSE : PLAY;
    const label = playing ? l.pause : l.play;
    playBtn.title = label;
    playBtn.setAttribute('aria-label', label);

    const pct = seekable() ? Math.min(100, Math.max(0, (audioEl.currentTime / audioEl.duration) * 100)) : 0;
    fill.style.width = `${pct}%`;
    seek.setAttribute('aria-valuenow', String(Math.round(pct)));
    seek.setAttribute('aria-disabled', String(!seekable()));
    // ELAPSED IS ALWAYS KNOWN, even when the length is not - a source served without
    // range support reports `Infinity` for duration, and blanking the whole readout for
    // it loses the one number the listener actually wants. Show `0:12` and add `/ 1:30`
    // only once there is a real length; seeking stays disabled either way.
    const clock = seekable()
      ? `${formatTime(audioEl.currentTime)} / ${formatTime(audioEl.duration)}`
      : formatTime(audioEl.currentTime);
    seek.setAttribute('aria-valuetext', clock);
    if (timeEl) timeEl.textContent = clock;

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

  const seekToClientX = (clientX: number): void => {
    if (!seekable()) return;
    const r = seek.getBoundingClientRect();
    if (r.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
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
  };

  const onKey = (e: KeyboardEvent): void => {
    if (!seekable()) return;
    const step = e.key === 'PageUp' || e.key === 'PageDown' ? 30 : 5;
    let delta = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'PageUp') delta = step;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'PageDown') delta = -step;
    else if (e.key === 'Home') { e.preventDefault(); audioEl.currentTime = 0; paint(); return; }
    else if (e.key === 'End') { e.preventDefault(); audioEl.currentTime = audioEl.duration; paint(); return; }
    else return;
    e.preventDefault();
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
    },
  };
}
