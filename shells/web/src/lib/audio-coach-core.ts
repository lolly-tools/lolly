// SPDX-License-Identifier: MPL-2.0
/**
 * Pure audio-coaching logic - the DOM-free core behind `audio-coaching.ts`.
 *
 * Turns a live `AudioLevel` (host.recorder meter / record session) into a compact
 * `Coaching` verdict: a level bar fill + a plain-language warning about levels
 * (too quiet / too loud / clipping) and, when the meter exposes the v1.19 spectral
 * cues, the ROOM (electrical hum / background hiss / noisy). Two phases:
 *   - 'check'  (arming / sound-check, mic raw): silence is expected, so judge the room.
 *   - 'record' (the take): coach the speaking level; only flag a genuinely bad floor.
 *
 * This module imports NOTHING but types - no DOM, no `announce` - so it can be unit
 * tested directly (see tests/audio-coaching.test.ts). The DOM HUD lives in
 * `audio-coaching.ts`, which re-exports everything here.
 */
import type { AudioLevel } from '@lolly-tools/core/host-v1';
import type { TipCue } from './recording-tips.ts';

export type CoachTarget = 'soft' | 'normal' | 'loud';
export type CoachPhase = 'check' | 'record';

export interface Coaching {
  barPct: number;   // rms → bar fill (0..100)
  peakPct: number;  // peak marker (0..100)
  dbText: string;   // dBFS read-out
  tone: 'ok' | 'low' | 'hot';
  warning: string;  // '' when nothing to say
  cue: TipCue | null;  // recording-tip cue this level argues for (null = nothing to flag)
}

// rms bands [tooQuiet, tooLoud] per target loudness (mirrors voice-recorder's BANDS).
const BANDS: Record<CoachTarget, [number, number]> = {
  soft: [0.02, 0.18], normal: [0.05, 0.32], loud: [0.10, 0.5],
};
// Room-noise thresholds (only evaluated when the v1.19 fields are present).
const NOISY_FLOOR_DBFS = -50;   // noise floor above this = a noticeable room
const HUM_RATIO = 0.25;         // ≥ this share of energy in mains bands = electrical hum
const HISS_FLATNESS = 0.45;     // spectral flatness above this (in a noisy room) = broadband hiss
const SPEAKING_SNR_DB = 12;     // signal this far above the floor = they're talking
const STEADY_NOISE = 0.6;       // envelope steadiness ≥ this (with an audible level) = a constant drone, not speech

export function coachAudio(level: AudioLevel, opts: { target?: CoachTarget; phase?: CoachPhase } = {}): Coaching {
  const [quiet, hot] = BANDS[opts.target ?? 'normal'] ?? BANDS.normal;
  const phase = opts.phase ?? 'record';
  const barPct = Math.round(Math.min(1, level.rms / 0.5) * 100);
  const peakPct = Math.round(Math.min(1, level.peak) * 100);
  const hasSignal = level.peak > 0 && level.dbfs !== -Infinity;
  const dbText = hasSignal ? `${Math.round(Math.max(-60, level.dbfs))} dB` : '−∞ dB';

  const clipping = level.clipping;
  const tooLoud = !clipping && level.rms > hot;
  const tooQuiet = level.rms < quiet;

  // Spectral cues are optional (present only from a v1.19 raw meter). Guard each.
  const floor = level.noiseFloor;
  const noisy = floor != null && isFinite(floor) && floor > NOISY_FLOOR_DBFS;
  const humming = level.hum != null && level.hum >= HUM_RATIO;
  const hissy = level.hiss != null && level.hiss >= HISS_FLATNESS && noisy;
  // A steady loudness envelope (v1.20) at an audible level = a CONSTANT source (fan / AC /
  // hiss), not speech. This is the reliable noise-vs-speech tell: a mid-level hiss holds a
  // near-constant rms, so a min-hold floor keeps its snr high and would otherwise read as
  // "speaking" and mask the room checks.
  const droning = level.steady != null && level.steady >= STEADY_NOISE && level.rms > quiet;
  const speaking = !droning && (level.snr != null ? level.snr > SPEAKING_SNR_DB : level.rms > quiet);

  let tone: Coaching['tone'] = 'ok';
  let warning = '';
  // Clipping / too-loud are urgent in either phase.
  if (clipping) { tone = 'hot'; warning = 'Too hot - you’re clipping. Ease off the mic.'; }
  else if (tooLoud) { tone = 'hot'; warning = 'A little loud - pull back from the mic.'; }
  else if (phase === 'check' && !speaking) {
    // Sound check with no speech: judge the room, not the (expected) silence.
    if (humming) { tone = 'low'; warning = 'Electrical hum - try another cable or power socket.'; }
    else if (droning) { tone = 'low'; warning = 'Steady background noise - a fan, AC or hiss. Turn off what you can.'; }
    else if (hissy) { tone = 'low'; warning = 'Background hiss - turn off nearby fans/AC if you can.'; }
    else if (noisy) { tone = 'low'; warning = 'Noisy room - a quieter spot will sound cleaner.'; }
  } else {
    // Speaking (or recording): coach the LEVEL only. Room noise is a pre-record
    // (sound-check) concern - and the recording session suppresses it, so the raw
    // meter's hum/hiss here wouldn't match the saved file. Don't flag it mid-take.
    if (tooQuiet) { tone = 'low'; warning = 'Too quiet - move closer or speak up.'; }
  }

  // Which recording-tip cue (if any) this level argues for - the stage's tips panel
  // flashes it. Mirrors the warning branches above: clipping/too-loud → the meter tip in
  // either phase; a silent sound-check judges the ROOM (hum→room, hiss→wind, noisy→room);
  // otherwise (speaking / recording) a low level → mic distance, and speaking over a noisy
  // room during the check → project. Room cues stay out of the take (see the note above).
  let cue: TipCue | null = null;
  if (clipping || tooLoud) cue = 'level';
  else if (phase === 'check' && !speaking) {
    cue = humming ? 'room' : droning ? 'fan' : hissy ? 'wind' : noisy ? 'room' : null;
  } else if (tooQuiet) cue = 'distance';
  else if (phase === 'check' && noisy) cue = 'project';

  return { barPct, peakPct, dbText, tone, warning, cue };
}
