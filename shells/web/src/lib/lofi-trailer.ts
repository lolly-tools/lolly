// SPDX-License-Identifier: MPL-2.0
/**
 * Trailer's three sounds, called by the station for a tune's `impact`, `braam` and `subdrop`
 * notes (engine/src/lofi-trailer.ts). All three are synthesised here: no recording, no sample.
 *
 * THE IMPACT is the hit a trailer is cut to. Five parts, struck together:
 * - the boom: a sine that falls from above into the note in under a tenth of a second and
 *   rings there, sagging a little as it dies, pushed into a soft clip so a small speaker
 *   hears its harmonics;
 * - the punch: a triangle an octave and a half up, falling faster and gone in a quarter of
 *   a second, the knock a speaker cone makes;
 * - the crack: a burst of noise around 2 kHz, thirty milliseconds long;
 * - the debris: noise whose low-pass closes from 7 kHz to 500 Hz as it dies, the air after
 *   an explosion;
 * - the rumble: noise under 120 Hz, as long as the boom.
 * Its kinds (TRAILER_IMPACTS): `hit` is all five; `slam` is short and metallic, the debris a
 * struck sheet of metal; `deep` is the boom and the rumble alone, struck softly.
 *
 * THE BRAAM is the low brass blast: five saws detuned across 27 cents on the note, two more
 * an octave up and a square an octave under, half of them on each side, through a low-pass
 * that snaps open and closes slowly, then a soft clip. The pitch scoops up into the note from 60 cents under, a rasp at
 * about 31 Hz roughens the blast and a rip of noise opens the note. Its kinds (TRAILER_BRAAMS): `low` is
 * that; `fifth` adds two saws a fifth up; `rise` bends the whole blast up a tone as it sounds.
 *
 * THE SUB DROP is a sine that falls two octaves over its length, with a quiet triangle an
 * octave up so it can be followed where the sub cannot be heard.
 */
import { TRAILER_BRAAMS, TRAILER_IMPACTS } from '../../../../engine/src/lofi-trailer.ts';
import { drivenBy, EPS, metalAt, mtof, noiseAt, osc, type VoiceKit } from './lofi-voices.ts';

/** Each sound's level into the effects lane, at full velocity. */
const IMPACT_LEVEL = 0.5, BRAAM_LEVEL = 0.2, SUBDROP_LEVEL = 0.34;
/** The soft clip's own gain at low level (lofi-voices.ts drivenBy: its curve rises 2.5 / tanh 2.5 at silence). */
const CLIP_GAIN = 2.5 / Math.tanh(2.5);
/** How far to each side a sound's two halves sit (a stereo panner's pan). */
const SPREAD = 0.7;

/** A gain that strikes to `peak` in `attack` seconds and dies away with the time constant `tau`. */
function struck(ctx: BaseAudioContext, t: number, peak: number, attack: number, tau: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(EPS, t);
  g.gain.exponentialRampToValueAtTime(Math.max(EPS, peak), t + attack);
  g.gain.setTargetAtTime(EPS, t + attack, tau);
  return g;
}

/** The impact: `midi` the boom's pitch (the key's root, low), `len` how long it may ring (s), `mod` its kind. */
export function impact(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, len: number, mod: number): void {
  const { ctx } = k;
  const kind = TRAILER_IMPACTS[mod] ?? 'hit';
  const f = mtof(midi);
  const ring = Math.max(0.6, Math.min(len, kind === 'slam' ? 1.1 : kind === 'deep' ? 2.6 : 3.2));
  const level = IMPACT_LEVEL * vel;
  // A dying sound is 40 dB down after 4.6 time constants.
  const tau = ring / 4.6;

  // The boom, into a soft clip.
  const boom = osc(k, 'sine', f * (kind === 'deep' ? 1.6 : 2.6), t, t + ring + 0.3);
  boom.frequency.exponentialRampToValueAtTime(f, t + (kind === 'deep' ? 0.18 : 0.09));
  boom.frequency.exponentialRampToValueAtTime(f * 0.86, t + ring);
  const [push, clip] = drivenBy(ctx, 1.5);
  const boomLevel = ctx.createGain();
  boomLevel.gain.value = level / (1.5 * CLIP_GAIN);
  boom.connect(struck(ctx, t, 1, kind === 'deep' ? 0.02 : 0.004, tau)).connect(push);
  clip.connect(boomLevel).connect(out);

  // The rumble under the boom.
  const rumbleFilter = ctx.createBiquadFilter();
  rumbleFilter.type = 'lowpass'; rumbleFilter.frequency.value = 120; rumbleFilter.Q.value = 0.7;
  noiseAt(k, t, ring + 0.2).connect(rumbleFilter).connect(struck(ctx, t, level * 1.4, 0.02, tau)).connect(out);
  if (kind === 'deep') return;

  // The punch.
  const punch = osc(k, 'triangle', f * 5, t, t + 0.4);
  punch.frequency.exponentialRampToValueAtTime(f * 1.8, t + 0.07);
  punch.connect(struck(ctx, t, level * 0.7, 0.002, 0.06)).connect(out);

  // The crack.
  const crackFilter = ctx.createBiquadFilter();
  crackFilter.type = 'bandpass'; crackFilter.frequency.value = 2200; crackFilter.Q.value = 0.7;
  noiseAt(k, t, 0.25).connect(crackFilter).connect(struck(ctx, t, level * 1.3, 0.001, 0.035)).connect(out);

  // The debris, a different stretch of noise panned to each side: a struck sheet of metal for a slam, the air after an explosion otherwise.
  for (const side of [0, 1]) {
    const wide = ctx.createStereoPanner();
    wide.pan.value = side ? SPREAD : -SPREAD;
    wide.connect(out);
    const debrisFilter = ctx.createBiquadFilter();
    if (kind === 'slam') {
      debrisFilter.type = 'bandpass'; debrisFilter.frequency.value = 1500; debrisFilter.Q.value = 0.6;
      metalAt(k, t, ring, side ? 1.07 : 1).connect(debrisFilter).connect(struck(ctx, t, level * 0.45, 0.002, 0.2)).connect(wide);
    } else {
      debrisFilter.type = 'lowpass'; debrisFilter.Q.value = 0.5;
      debrisFilter.frequency.setValueAtTime(9000, t);
      debrisFilter.frequency.exponentialRampToValueAtTime(700, t + ring * 0.6);
      noiseAt(k, t, ring + 0.2).connect(debrisFilter).connect(struck(ctx, t, level * 0.55, 0.005, ring / 5)).connect(wide);
    }
  }
}

/** The braam: `midi` its note (low: about 55 to 105 Hz), `len` seconds, `mod` its kind. */
export function braam(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, len: number, mod: number): void {
  const { ctx } = k;
  const kind = TRAILER_BRAAMS[mod] ?? 'low';
  const f = mtof(midi);
  const end = t + Math.max(0.4, len);
  const stop = end + 0.6;
  const level = BRAAM_LEVEL * vel;
  // The rasp: the level shaken at about 31 Hz, a little, the same on both sides.
  const rasp = osc(k, 'sine', 29 + k.rng() * 4, t, stop);
  const raspDepth = ctx.createGain();
  raspDepth.gain.value = 0.1;
  rasp.connect(raspDepth);

  // The voices: [type, pitch against the note, cents of detune, level, side (0 left, 1 right, 2 both)].
  const voices: Array<readonly [OscillatorType, number, number, number, 0 | 1 | 2]> = [
    ['sawtooth', 1, -14, 1, 0], ['sawtooth', 1, -5, 1, 1], ['sawtooth', 1, 0, 1, 2], ['sawtooth', 1, 6, 1, 0], ['sawtooth', 1, 13, 1, 1],
    ['sawtooth', 2, -9, 0.5, 0], ['sawtooth', 2, 8, 0.5, 1], ['square', 0.5, 0, 0.6, 2],
  ];
  if (kind === 'fifth') voices.push(['sawtooth', 1.5, -7, 0.45, 1], ['sawtooth', 1.5, 7, 0.45, 0]);

  // Each side is its own blast: its voices, a filter that snaps open and closes slowly, its level and a soft clip.
  for (const side of [0, 1] as const) {
    const wide = ctx.createStereoPanner();
    wide.pan.value = side ? SPREAD : -SPREAD;
    wide.connect(out);
    const mine = voices.filter(v => v[4] === side || v[4] === 2);
    const sum = ctx.createGain();
    sum.gain.value = 1 / mine.reduce((acc, v) => acc + v[3], 0);
    for (const [type, ratio, cents, lvl] of mine) {
      const hz = f * ratio * 2 ** ((cents + (k.rng() - 0.5) * 3) / 1200);
      const o = osc(k, type, hz * 2 ** (-60 / 1200), t, stop);
      o.frequency.exponentialRampToValueAtTime(hz, t + 0.09);
      if (kind === 'rise') o.frequency.exponentialRampToValueAtTime(hz * 2 ** (2 / 12), end);
      const g = ctx.createGain();
      g.gain.value = lvl;
      o.connect(g).connect(sum);
    }
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 1.1;
    lp.frequency.setValueAtTime(220, t);
    lp.frequency.exponentialRampToValueAtTime(2600 + 2400 * vel, t + 0.07);
    lp.frequency.setTargetAtTime(1500, t + 0.1, (end - t) * 0.35);
    // A fast swell, a little more through the note, and a short release.
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(EPS, t);
    amp.gain.exponentialRampToValueAtTime(1, t + 0.03);
    amp.gain.linearRampToValueAtTime(1.12, t + (end - t) * 0.4);
    amp.gain.setTargetAtTime(EPS, end - 0.08, 0.12);
    raspDepth.connect(amp.gain);
    const [push, clip] = drivenBy(ctx, 1.6);
    const outLevel = ctx.createGain();
    outLevel.gain.value = level / CLIP_GAIN;
    sum.connect(lp).connect(amp).connect(push);
    clip.connect(outLevel).connect(wide);
  }

  // The rip that opens the note.
  const rip = ctx.createBiquadFilter();
  rip.type = 'bandpass'; rip.frequency.value = 900; rip.Q.value = 0.8;
  noiseAt(k, t, 0.5).connect(rip).connect(struck(ctx, t, level * 0.5, 0.004, 0.09)).connect(out);
}

/** The sub drop: `midi` where it starts (it ends two octaves under), `len` seconds. */
export function subdrop(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, len: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const span = Math.max(0.8, len);
  const end = t + span;
  const level = SUBDROP_LEVEL * vel;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(level, t + 0.015);
  amp.gain.setTargetAtTime(EPS, t + span * 0.55, span * 0.15);
  const sine = osc(k, 'sine', f, t, end + 0.2);
  sine.frequency.exponentialRampToValueAtTime(Math.max(24, f / 4), end);
  sine.connect(amp).connect(out);
  // An octave up, quietly, for the speakers the sub is lost on.
  const top = osc(k, 'triangle', f * 2, t, end + 0.2);
  top.frequency.exponentialRampToValueAtTime(Math.max(48, f / 2), end);
  const topFilter = ctx.createBiquadFilter();
  topFilter.type = 'lowpass'; topFilter.frequency.value = 400;
  const topLevel = ctx.createGain();
  topLevel.gain.value = 0.22;
  top.connect(topFilter).connect(topLevel).connect(amp);
}
