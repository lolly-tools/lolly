// SPDX-License-Identifier: MPL-2.0
// Animation transport - a reusable play / pause / scrub bar for ANY tool that publishes
// an animation on `window.__lollyAnim`. The tool owns rendering and its own frame clock;
// this control only drives that shared clock (play/pause, seek, step) and reflects its
// position, so one component works across every animated tool without knowing its
// internals. Mounted on the tool stage for any manifest declaring `render.video`; it
// shows itself only while an animation is actually active.
//
// Contract (window.__lollyAnim - all fields additive, the tool may set a subset):
//   active   boolean - tool sets true while animating; false / absent hides the bar
//   labels   string[] - keyframe names, drawn as ticks under the track
//   loopMs   number - one loop's duration (informational)
//   curT     number - 0..1 current position; the TOOL writes it each frame
//   playing  boolean - the SHELL toggles it; the tool advances only while true
//   scrubT   number | null - the SHELL sets 0..1 to seek/hold; null = follow the clock
//   gen      number - the tool bumps it when it republishes so the bar resyncs ticks

import { icon } from '../lib/icons.ts';

export type AnimState = {
  active?: boolean; labels?: string[]; loopMs?: number; curT?: number;
  playing?: boolean; scrubT?: number | null; gen?: number;
};

// Transport glyphs come from the one icon registry (lib/icons.ts) - filled so the
// solid transport look matches the audio player's play/pause.
const ICON = {
  play: icon('play', { filled: true }),
  pause: icon('pause', { filled: true }),
  prev: icon('skipBack', { filled: true }),
  next: icon('skipForward', { filled: true }),
};

export function setupAnimTransport({ stageEl }: { stageEl: HTMLElement }): () => void {
  const w = window as unknown as { __lollyAnim?: AnimState };
  const A = (): AnimState | undefined => w.__lollyAnim;

  const bar = document.createElement('div');
  bar.className = 'anim-transport';
  bar.setAttribute('data-export-hide', ''); // never captured into an exported frame
  bar.hidden = true;
  bar.innerHTML =
    `<button type="button" class="anim-transport-btn" data-act="prev" aria-label="Previous frame">${ICON.prev}</button>` +
    `<button type="button" class="anim-transport-btn anim-transport-play" data-act="play" aria-label="Play">${ICON.play}</button>` +
    `<button type="button" class="anim-transport-btn" data-act="next" aria-label="Next frame">${ICON.next}</button>` +
    `<div class="anim-transport-track" role="slider" tabindex="0" aria-label="Animation timeline" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">` +
      `<div class="anim-transport-fill"></div><div class="anim-transport-ticks"></div><div class="anim-transport-head"></div>` +
    `</div>` +
    `<span class="anim-transport-label" aria-hidden="true"></span>`;
  stageEl.appendChild(bar);

  const playBtn = bar.querySelector<HTMLButtonElement>('.anim-transport-play')!;
  const track = bar.querySelector<HTMLElement>('.anim-transport-track')!;
  const fill = bar.querySelector<HTMLElement>('.anim-transport-fill')!;
  const head = bar.querySelector<HTMLElement>('.anim-transport-head')!;
  const ticksEl = bar.querySelector<HTMLElement>('.anim-transport-ticks')!;
  const labelEl = bar.querySelector<HTMLElement>('.anim-transport-label')!;

  let lastGen = -1, dragging = false, wasPlaying = false, iconPlaying: boolean | null = null;

  const buildTicks = (labels: string[]): void => {
    ticksEl.textContent = '';
    const n = labels.length; if (!n) return;
    labels.forEach((lab, k) => {
      const el = document.createElement('span');
      el.className = 'anim-transport-tick';
      el.style.left = ((n > 1 ? k / n : 0) * 100) + '%'; // frame k's hold begins at k/nF
      el.title = lab;
      ticksEl.appendChild(el);
    });
  };

  const setPlayIcon = (playing: boolean): void => {
    if (iconPlaying === playing) return;
    iconPlaying = playing;
    playBtn.innerHTML = playing ? ICON.pause : ICON.play;
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  };

  const paintPos = (t: number, labels?: string[]): void => {
    const pct = Math.max(0, Math.min(100, t * 100));
    fill.style.width = pct + '%';
    head.style.left = pct + '%';
    track.setAttribute('aria-valuenow', String(Math.round(pct)));
    if (labels && labels.length) {
      const k = Math.min(labels.length - 1, Math.round(t * labels.length) % labels.length);
      labelEl.textContent = labels[k] ?? '';
    }
  };

  const seekTo = (clientX: number): void => {
    const r = track.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, r.width)));
    const a = A(); if (a) a.scrubT = t;
    paintPos(t, a?.labels);
  };

  const step = (dir: number): void => {
    const a = A(); if (!a?.labels?.length) return;
    const n = a.labels.length, cur = Math.round((a.curT || 0) * n) % n;
    const k = (((cur + dir) % n) + n) % n, t = k / n;
    a.scrubT = t; a.playing = false;
    paintPos(t, a.labels); setPlayIcon(false);
  };

  playBtn.addEventListener('click', () => {
    const a = A(); if (!a) return;
    if (a.scrubT != null) { a.scrubT = null; a.playing = true; }   // resume from a scrubbed hold
    else a.playing = a.playing === false;                          // plain toggle
    setPlayIcon(a.playing !== false && a.scrubT == null);
  });
  bar.querySelector('[data-act="prev"]')!.addEventListener('click', () => step(-1));
  bar.querySelector('[data-act="next"]')!.addEventListener('click', () => step(1));

  const onDown = (e: PointerEvent): void => {
    const a = A(); if (!a) return;
    dragging = true; wasPlaying = a.playing !== false && a.scrubT == null;
    try { track.setPointerCapture(e.pointerId); } catch { /* not all pointers capture */ }
    seekTo(e.clientX); e.preventDefault();
  };
  const onMove = (e: PointerEvent): void => { if (dragging) seekTo(e.clientX); };
  const onUp = (e: PointerEvent): void => {
    if (!dragging) return; dragging = false;
    // If it was playing, resume (the tool picks up from the scrubbed clock); if it was
    // paused, KEEP scrubT so it holds exactly on the scrubbed frame - never nulling it,
    // which could strand the tool at a stale clock if no tick fired during a fast click.
    const a = A();
    if (a) { if (wasPlaying) { a.scrubT = null; a.playing = true; } else { a.playing = false; } }
    setPlayIcon(a ? (a.playing !== false && a.scrubT == null) : false);
    try { track.releasePointerCapture(e.pointerId); } catch { /* no-op */ }
  };
  track.addEventListener('pointerdown', onDown);
  track.addEventListener('pointermove', onMove);
  track.addEventListener('pointerup', onUp);
  track.addEventListener('pointercancel', onUp);
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { step(-1); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { step(1); e.preventDefault(); }
    else if (e.key === ' ' || e.key === 'Enter') { playBtn.click(); e.preventDefault(); }
  });

  // Reflect the tool's shared state: show/hide, resync ticks on a new generation, and
  // follow the playhead. rAF-paced (paused with the tab, exactly like the tool's own
  // loop), so the two never drift.
  let raf = 0;
  const poll = (): void => {
    const a = A();
    if (!a || !a.active) { if (!bar.hidden) bar.hidden = true; }
    else {
      if (bar.hidden) bar.hidden = false;
      if (a.gen !== lastGen) { lastGen = a.gen ?? 0; buildTicks(a.labels || []); }
      if (!dragging) { paintPos(a.curT || 0, a.labels); setPlayIcon(a.playing !== false && a.scrubT == null); }
    }
    raf = requestAnimationFrame(poll);
  };
  raf = requestAnimationFrame(poll);

  return () => { cancelAnimationFrame(raf); bar.remove(); };
}
