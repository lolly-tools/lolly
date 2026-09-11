// SPDX-License-Identifier: MPL-2.0
/**
 * Audio coaching for capture tools - turns a live `AudioLevel` (host.recorder meter /
 * record session) into a compact HUD: a level bar + a plain-language warning about
 * levels (too quiet / too loud / clipping) and, when the meter exposes the v1.19
 * spectral cues, the ROOM (electrical hum / background hiss / noisy).
 *
 * This is the VIDEO/`av` counterpart to voice-recorder's onLevel meter card: a video
 * tool's canvas shows the composited bookends, not a meter, so the shell draws the HUD
 * over the framing viewfinder instead. Two phases:
 *   - 'check'  (arming / sound-check, mic raw): silence is expected, so judge the room.
 *   - 'record' (the take): coach the speaking level; only flag a genuinely bad floor.
 */
import type { AudioLevel } from '@lolly-tools/core/host-v1';
import { announce } from '../a11y.ts';
import { coachAudio } from './audio-coach-core.ts';
import type { CoachTarget, CoachPhase } from './audio-coach-core.ts';
import type { VideoCoaching } from './video-coach-core.ts';

// The pure coaching cores live in DOM-free modules so they can be unit tested
// (tests/audio-coaching.test.ts, tests/video-coaching.test.ts). Re-export coachAudio
// here so every existing import of `audio-coaching.ts` keeps working unchanged.
export { coachAudio };
export type { Coaching, CoachTarget, CoachPhase } from './audio-coach-core.ts';

export interface CoachHud {
  /** Update the audio-level section from a live meter sample. No-op if the HUD has no audio row. */
  updateAudio(level: AudioLevel, opts?: { target?: CoachTarget; phase?: CoachPhase }): void;
  /** Update the exposure section from a video-coaching verdict (shows only when there's a warning). */
  updateExposure(v: VideoCoaching): void;
  destroy(): void;
}

// Small eye glyph marking the exposure row apart from the audio meter.
const EYE_SVG =
  '<svg class="crc-eye" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';

/**
 * Mount a compact coaching HUD onto `parent` (the tool stage). It holds up to two rows:
 * an audio row (level bar + dB read-out + warning chip) and an exposure row (an eye glyph
 * + an exposure warning) that only appears while there's something to flag. It sits above
 * the framing viewfinder and never captures pointer events or bakes into an export
 * ([data-export-hide]). Feed it with updateAudio() (per AudioLevel) and updateExposure()
 * (per camera-frame verdict).
 *
 * `opts.audio` (default true) controls whether the audio row is rendered - a video-only
 * capture tool shows just the exposure row.
 */
export function mountCoachHud(parent: HTMLElement, opts: { audio?: boolean } = {}): CoachHud {
  const showAudio = opts.audio ?? true;
  const el = document.createElement('div');
  el.className = 'canvas-record-coach';
  el.setAttribute('data-export-hide', '');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML =
    (showAudio
      ? '<div class="crc-row crc-audio" data-tone="ok">' +
        '<div class="crc-meter"><div class="crc-fill"></div><div class="crc-peak"></div></div>' +
        '<div class="crc-db"></div>' +
        '<div class="crc-warn"></div>' +
        '</div>'
      : '') +
    '<div class="crc-row crc-exposure" data-tone="ok">' + EYE_SVG + '<div class="crc-warn"></div></div>';
  parent.appendChild(el);

  const audioRow = el.querySelector<HTMLElement>('.crc-audio');
  const fill = el.querySelector<HTMLElement>('.crc-audio .crc-fill');
  const peak = el.querySelector<HTMLElement>('.crc-audio .crc-peak');
  const db = el.querySelector<HTMLElement>('.crc-audio .crc-db');
  const audioWarn = el.querySelector<HTMLElement>('.crc-audio .crc-warn');
  const expoRow = el.querySelector<HTMLElement>('.crc-exposure')!;
  const expoWarn = el.querySelector<HTMLElement>('.crc-exposure .crc-warn')!;

  // The HUD is aria-hidden (decorative overlay); mirror a genuinely-new warning into the
  // app's polite live region so screen-reader users hear "you're clipping" / "too dark".
  // Throttled per channel: a new message speaks at once, the same one re-speaks after 8s.
  let spokenA = '', spokenAAt = 0;
  let spokenV = '', spokenVAt = 0;
  const speak = (msg: string, prev: string, at: number): { msg: string; at: number } => {
    const now = performance.now();
    if (msg && (msg !== prev || now - at > 8000)) { announce(msg); return { msg, at: now }; }
    if (!msg) return { msg: '', at };
    return { msg: prev, at };
  };

  return {
    updateAudio(level, o) {
      if (!audioRow) return;
      const c = coachAudio(level, o);
      audioRow.dataset.tone = c.tone;
      if (fill) fill.style.width = `${c.barPct}%`;
      if (peak) peak.style.left = `${c.peakPct}%`;
      if (db) db.textContent = c.dbText;
      if (audioWarn) audioWarn.textContent = c.warning;
      audioRow.classList.toggle('has-warn', c.warning !== '');
      ({ msg: spokenA, at: spokenAAt } = speak(c.warning, spokenA, spokenAAt));
    },
    updateExposure(v) {
      expoRow.dataset.tone = v.tone;
      expoWarn.textContent = v.warning;
      expoRow.classList.toggle('has-warn', v.warning !== '');
      ({ msg: spokenV, at: spokenVAt } = speak(v.warning, spokenV, spokenVAt));
    },
    destroy() { el.remove(); },
  };
}
