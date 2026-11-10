// SPDX-License-Identifier: MPL-2.0
/**
 * The world styles' instruments: the station's voices for Persian, Guzheng, Koto, Kora
 * and Amapiano (and Afrobeat's hand percussion), split from ./lofi-voices.ts, whose
 * helpers they use. The station sends these instruments here and every other one there.
 *
 *   keys   tar, santur, zheng (guzheng), koto, shamisen, kora, balafon
 *   lead   santur, ney, shakuhachi, dizi, kamancheh, erhu, zheng, koto, pipa, shamisen,
 *          kora, balafon
 *   bass   log (amapiano's log drum)
 *   perc   the hand drums and bells from the tombak on (see LOFI_PERCUSSION)
 *
 * Physical sounds made the way Web Audio allows: a plucked or struck string as a
 * waveform with its pick position's missing harmonics through a closing filter and the
 * body's resonance (a modelled string loop cannot reach these pitches, because a delay
 * in a feedback loop is held to at least one 128-sample block), bars and drums as their
 * measured modes ringing down, flutes and bowed strings as a source through the body's
 * filters with breath or bow noise.
 */
import type { LofiStyle } from '../../../../engine/src/lofi-compose.ts';
import { EPS, mtof, noiseAt, osc, plucked, vibrato, drivenBy, metalAt, crack, PLAIN_TONE, type Tone, type VoiceKit } from './lofi-voices.ts';

/** The keys this module plays. */
export const WORLD_KEYS = new Set<LofiStyle['keys']>(['tar', 'santur', 'zheng', 'koto', 'shamisen', 'kora', 'balafon']);
/** The leads this module plays. */
export const WORLD_LEADS = new Set<LofiStyle['lead']>(['santur', 'ney', 'shakuhachi', 'dizi', 'kamancheh', 'erhu', 'zheng', 'koto', 'pipa', 'shamisen', 'kora', 'balafon']);
/** The first percussion kind (by its `mod`) this module plays: the tombak, and every later kind too. */
export const WORLD_PERC_FROM = 5;

/** A world keys instrument (see WORLD_KEYS). */
export function keys(style: LofiStyle['keys'], k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  if (style === 'tar') tar(k, out, t, midi, vel, dur);
  else if (style === 'santur') santur(k, out, t, midi, vel, dur, 0);
  else if (style === 'zheng') zheng(k, out, t, midi, vel, dur, 0);
  else if (style === 'koto') koto(k, out, t, midi, vel, dur, 0);
  else if (style === 'shamisen') shamisen(k, out, t, midi, vel, dur);
  else if (style === 'kora') kora(k, out, t, midi, vel, dur);
  else if (style === 'balafon') balafon(k, out, t, midi, vel);
}

/** A world lead (see WORLD_LEADS); `art` 1 is the instrument's ornament. */
export function lead(style: LofiStyle['lead'], k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art = 0): void {
  if (style === 'santur') santur(k, out, t, midi, vel, dur, art);
  else if (style === 'ney') windFlute(k, out, t, midi, vel, dur, art, NEY);
  else if (style === 'shakuhachi') windFlute(k, out, t, midi, vel, dur, art, SHAKUHACHI);
  else if (style === 'dizi') windFlute(k, out, t, midi, vel, dur, art, DIZI);
  else if (style === 'kamancheh') bowed(k, out, t, midi, vel, dur, art, KAMANCHEH);
  else if (style === 'erhu') bowed(k, out, t, midi, vel, dur, art, ERHU);
  else if (style === 'zheng') zheng(k, out, t, midi, vel, dur, art);
  else if (style === 'koto') koto(k, out, t, midi, vel, dur, art);
  else if (style === 'pipa') pipa(k, out, t, midi, vel, dur, art);
  else if (style === 'shamisen') shamisen(k, out, t, midi, vel, dur);
  else if (style === 'kora') kora(k, out, t, midi, vel, dur);
  else if (style === 'balafon') balafon(k, out, t, midi, vel);
}

/** The log drum, the one bass here; `mod` 2 or more slides. */
export function bass(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, mod = 0, tone: Tone = PLAIN_TONE): void {
  logDrum(k, out, t, midi, vel, dur, mod >= 2, tone);
}

/** A world hand drum or bell, by its percussion kind (`mod`, from WORLD_PERC_FROM) and stroke. */
export function perc(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, kind: number): void {
  worldPerc(k, out, t, midi, vel, LOFI_PERCUSSION_KINDS[kind] ?? 'tombak');
}

// ── the instruments ──────────────────────────────────────────────────────────────
// Physical sounds made the way Web Audio allows: a plucked or struck string as a
// waveform with its pick position's missing harmonics through a closing filter and the
// body's resonance (a modelled string loop cannot reach these pitches, because a delay
// in a feedback loop is held to at least one 128-sample block), bars and drums as their
// measured modes ringing down, flutes and bowed strings as a source through the body's
// filters with breath or bow noise.

/**
 * Tar (Persian): a long-necked lute with doubled courses, struck with a brass plectrum
 * near the bridge, its lambskin top giving a bright, peaky, nasal ring.
 */
function tar(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  plucked(k, out, t, midi, vel, dur, { pickAt: 0.1, bright: 26, mellow: 8.5, ring: 1.1, body: 2300, level: 0.06, course: 6 });
}

/**
 * Santur (Persian): a hammered dulcimer, four unison strings to a course, struck by light
 * wooden mezrabs, ringing long with no dampers and beating as the strings drift a few
 * cents apart. `art` 1 is the riz: the note tremoloed, the mezrabs alternating.
 */
function santur(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art: number): void {
  const strike = (at: number, v: number, ring: number): void => {
    plucked(k, out, at, midi, v, Math.max(0.4, ring), { pickAt: 0.07, bright: 36, mellow: 11, ring: 2.2, body: 2400, level: 0.052, course: 5 });
    // The mezrab's tick on the string.
    crack(k, out, at, 0.04 * v, 3200, 0.004);
  };
  if (art === 1 && dur > 0.35) {
    // The riz: strokes about sixteen to the second, the left mezrab a little lighter.
    const n = Math.min(24, Math.floor(dur / 0.065));
    for (let i = 0; i < n; i++) strike(t + i * 0.065, vel * (i % 2 ? 0.72 : 0.9) * (i === 0 ? 1.1 : 1), 0.2);
  } else {
    strike(t, vel, dur);
  }
}

/**
 * Guzheng (Chinese): a long zither plucked with bright fingerpicks near the bridge,
 * ringing in its big wooden box. `art` 1 presses the string from a whole tone below up
 * into the note (the an), and the held notes waver under the left hand (the rou).
 */
function zheng(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art: number): void {
  plucked(k, out, t, midi, vel, dur, { pickAt: 0.13, bright: 22, mellow: 6.5, ring: 1.9, body: 900, level: 0.12, ...(art === 1 ? { slide: -2, slideTime: 0.16 } : {}), ...(dur > 0.6 ? { wobble: 14 } : {}) });
}

/**
 * Koto (Japanese): plucked with ivory tsume, longer and rounder than the guzheng. `art` 1
 * is the ato-oshi: the string pressed after the pluck, so the note rises a half step and
 * settles back.
 */
function koto(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art: number): void {
  if (art === 1 && dur > 0.3) {
    plucked(k, out, t, midi, vel, dur, { pickAt: 0.18, bright: 20, mellow: 5.5, ring: 2.3, body: 700, level: 0.11, slide: 1, slideTime: 0.3 });
  } else {
    plucked(k, out, t, midi, vel, dur, { pickAt: 0.18, bright: 20, mellow: 5.5, ring: 2.3, body: 700, level: 0.11 });
  }
}

/**
 * Shamisen (Japanese): struck with a big bachi close to the bridge, so it snaps; the
 * lowest string's sawari buzzes against the neck, and the bachi slaps the skin.
 */
function shamisen(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  plucked(k, out, t, midi, vel, Math.min(dur, 0.9), { pickAt: 0.06, bright: 28, mellow: 5, ring: 0.65, body: 1400, level: 0.065 });
  // The sawari: the string's own sound, clipped where it touches the neck, a sizzle over the note.
  const f = mtof(midi);
  const buzz = osc(k, 'sawtooth', f, t, t + 0.5);
  const [push, ws] = drivenBy(ctx, 3);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 3200;
  bp.Q.value = 1.2;
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.02 * vel, t);
  bg.gain.exponentialRampToValueAtTime(EPS, t + 0.45);
  buzz.connect(push);
  ws.connect(bp).connect(bg).connect(out);
  // The bachi on the skin: a short, dull slap.
  const skin = ctx.createBiquadFilter();
  skin.type = 'bandpass';
  skin.frequency.value = 380;
  skin.Q.value = 1.4;
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.14 * vel, t);
  sg.gain.exponentialRampToValueAtTime(EPS, t + 0.05);
  noiseAt(k, t, 0.06).connect(skin).connect(sg).connect(out);
}

/** Kora (West African): a harp-lute's nylon strings over a calabash: warm, darker, a little woody. */
function kora(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  plucked(k, out, t, midi, vel, dur, { pickAt: 0.27, bright: 13, mellow: 4.2, ring: 1.5, body: 320, level: 0.18 });
}

/** Pipa (Chinese): a pear-shaped lute, bright and short; `art` 1 is the lunzhi, the five-finger tremolo on a held note. */
function pipa(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art: number): void {
  const pluck = (at: number, v: number, d: number): void => plucked(k, out, at, midi, v, d, { pickAt: 0.1, bright: 24, mellow: 5, ring: 0.7, body: 1500, level: 0.08 });
  if (art === 1 && dur > 0.35) {
    const n = Math.min(20, Math.floor(dur / 0.07));
    for (let i = 0; i < n; i++) pluck(t + i * 0.07, vel * (0.75 + (i % 5 === 0 ? 0.2 : 0)), 0.12);
  } else {
    pluck(t, vel, dur);
  }
}

/**
 * Balafon (West African): a wooden bar over a gourd. The bar's modes (STK's measured
 * wood ratios, 1 : 2.78 : 7.38 : 15.38) ring down fast, the higher ones faster; the mallet
 * knocks; and the gourd's spider-silk membrane buzzes as the note sounds.
 */
function balafon(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const bar = ctx.createGain();
  bar.connect(out);
  modes(k, bar, t, f, [[1, 0.16, 0.45], [2.777, 0.05, 0.12], [7.378, 0.03, 0.05], [15.377, 0.015, 0.025]], vel);
  // The mirliton: the bar's sound clipped past a threshold, a buzz in the upper middle.
  const [push, ws] = drivenBy(ctx, 6);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2400;
  bp.Q.value = 0.9;
  const bg = ctx.createGain();
  bg.gain.value = 0.05;
  bar.connect(push);
  ws.connect(bp).connect(bg).connect(out);
  crack(k, out, t, 0.05 * vel, 1800, 0.006);   // the mallet
}

/**
 * Modes ringing down: for each [ratio of `f`, level, seconds to fade], a sine struck at
 * once and decaying. Bars, gongs and drumheads are made of these. `bend` starts every
 * mode that much higher and lets it fall into pitch (a drum struck hard goes sharp).
 */
function modes(k: VoiceKit, out: AudioNode, t: number, f: number, list: ReadonlyArray<readonly [number, number, number]>, vel: number, bend = 1, bendTime = 0.05): void {
  for (const [ratio, level, fade] of list) {
    const hz = Math.min(18000, f * ratio);
    const o = osc(k, 'sine', hz * bend, t, t + fade * 1.2 + 0.02);
    if (bend !== 1) o.frequency.exponentialRampToValueAtTime(hz, t + bendTime);
    const g = k.ctx.createGain();
    g.gain.setValueAtTime(level * vel, t);
    g.gain.exponentialRampToValueAtTime(EPS, t + fade);
    o.connect(g).connect(out);
  }
}

/** A wind instrument's character: its harmonics, breath and how it is played (see windFlute). */
interface Wind { harmonics: readonly number[]; breath: number; air: number; attack: number; vibrato: number; vibratoRate: number; buzz: number; scoop: number; level: number }
/** Ney: the Persian reed flute, blown across the rim against the teeth: breathy, hollow, few harmonics. */
const NEY: Wind = { harmonics: [1, 0.22, 0.1, 0.04], breath: 0.42, air: 0.05, attack: 0.12, vibrato: 12, vibratoRate: 5.4, buzz: 0, scoop: -45, level: 0.075 };
/** Shakuhachi: the Japanese bamboo flute, breathier still, a muraiki's rush of air on an accent, notes bent from below (meri). */
const SHAKUHACHI: Wind = { harmonics: [1, 0.3, 0.12, 0.05], breath: 0.55, air: 0.08, attack: 0.09, vibrato: 18, vibratoRate: 4.6, buzz: 0, scoop: -70, level: 0.075 };
/** Dizi: the Chinese flute, brighter, its dimo membrane buzzing in the upper middle. */
const DIZI: Wind = { harmonics: [1, 0.35, 0.18, 0.08], breath: 0.25, air: 0.04, attack: 0.05, vibrato: 16, vibratoRate: 5.8, buzz: 0.35, scoop: -100, level: 0.07 };

/**
 * A breathy flute (ney, shakuhachi, dizi): the tone's few harmonics, breath on the note's
 * own harmonics (narrow bands of noise at the pitch and its octave), high air over the
 * top, a vibrato that eases in and, for the dizi, the membrane's buzz (the tone clipped,
 * a band around 4 kHz). `art` 1 bends the note in from below and, on the shakuhachi, starts
 * it with a rush of breath.
 */
function windFlute(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art: number, w: Wind): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.5;
  const amp = ctx.createGain();
  const peak = w.level * vel;
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(peak, t + w.attack);
  amp.gain.setTargetAtTime(EPS, t + Math.max(0.08, dur), 0.1);
  amp.connect(out);
  const tone = ctx.createGain();
  tone.connect(amp);
  w.harmonics.forEach((level, n) => {
    const o = osc(k, 'sine', f * (n + 1), t, end);
    if (art === 1) { o.detune.setValueAtTime(w.scoop, t); o.detune.linearRampToValueAtTime(0, t + 0.16); }
    vibrato(k, o.detune, t, end, w.vibratoRate, w.vibrato, Math.min(0.35, dur * 0.5));
    const g = ctx.createGain();
    g.gain.value = level;
    o.connect(g).connect(tone);
  });
  if (w.buzz > 0) {
    const [push, ws] = drivenBy(ctx, 4);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 4000;
    bp.Q.value = 2.5;
    const bg = ctx.createGain();
    bg.gain.value = w.buzz;
    tone.connect(push);
    ws.connect(bp).connect(bg).connect(amp);
  }
  for (const [mult, level, q] of [[1, w.breath, 14], [2, w.breath * 0.5, 14]] as const) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.min(9000, f * mult);
    bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = level;
    noiseAt(k, t, dur + 0.5).connect(bp).connect(g).connect(amp);
  }
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 5000;
  const ag = ctx.createGain();
  // The muraiki: an accented shakuhachi note starts in a rush of air.
  const rush = art === 1 && w === SHAKUHACHI ? 6 : 1;
  ag.gain.setValueAtTime(w.air * rush, t);
  ag.gain.setTargetAtTime(w.air, t + 0.04, 0.08);
  noiseAt(k, t, dur + 0.5).connect(hp).connect(ag).connect(amp);
}

/** A bowed string's character: the body's resonances and how it is played (see bowed). */
interface Bow { formants: ReadonlyArray<readonly [number, number, number]>; vibrato: number; slide: number; noise: number; level: number }
/** Kamancheh: the Persian spike fiddle, warm and singing. */
const KAMANCHEH: Bow = { formants: [[600, 5, 1.4], [1300, 6, 1.6], [2600, 4, 1.8]], vibrato: 22, slide: -2, noise: 0.008, level: 0.04 };
/** Erhu: the Chinese two-string fiddle, its python-skin drum making it nasal and vocal. */
const ERHU: Bow = { formants: [[850, 4, 1.6], [2000, 8, 2.2], [3400, 3, 2]], vibrato: 30, slide: -3, noise: 0.012, level: 0.038 };

/**
 * A bowed string (kamancheh, erhu): two saws a few cents apart through the body's
 * resonances, bow noise over the top, a deep vibrato that eases in, and with `art` 1 the
 * huayin, a slide up into the note from below.
 */
function bowed(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art: number, b: Bow): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.15;
  let node: AudioNode = ctx.createGain();
  const input = node;
  for (const [hz, gain, q] of b.formants) {
    const pk = ctx.createBiquadFilter();
    pk.type = 'peaking';
    pk.frequency.value = hz;
    pk.gain.value = gain;
    pk.Q.value = q;
    node.connect(pk);
    node = pk;
  }
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 5200;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(b.level * vel, t + 0.07);
  amp.gain.setValueAtTime(b.level * 0.95 * vel, t + Math.max(0.08, dur));
  amp.gain.exponentialRampToValueAtTime(EPS, end);
  node.connect(lp).connect(amp).connect(out);
  for (const cents of [-5, 5]) {
    const o = osc(k, 'sawtooth', f, t, end);
    o.detune.setValueAtTime(cents + (art === 1 ? b.slide * 100 : 0), t);
    if (art === 1) o.detune.linearRampToValueAtTime(cents, t + 0.18);
    vibrato(k, o.detune, t, end, 5.8, b.vibrato, Math.min(0.3, dur * 0.5));
    o.connect(input);
  }
  const bow = ctx.createBiquadFilter();
  bow.type = 'highpass';
  bow.frequency.value = 3000;
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(b.noise * vel, t);
  bg.gain.exponentialRampToValueAtTime(EPS, end);
  noiseAt(k, t, dur + 0.15).connect(bow).connect(bg).connect(out);
}

/**
 * The log drum (amapiano): FM with the modulator an octave over the carrier (odd
 * harmonics, a hollow, woody tone) and a modulation index that starts high and falls
 * away in a few milliseconds, so each note knocks and then hums, decaying in about half
 * a second. A slide comes up into the note from a fourth below. The shape follows the
 * MIT-licensed mda DX10's "Log Drum" preset, rebuilt from its published parameters.
 */
function logDrum(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, slide: boolean, tone: Tone): void {
  const { ctx } = k;
  const f = mtof(midi);
  const len = Math.max(0.12, Math.min(dur + 0.25, 0.9));
  const end = t + len + 0.05;
  const carrier = osc(k, 'sine', slide ? f * 2 ** (-5 / 12) : f, t, end);
  const mod = osc(k, 'sine', slide ? f * 2 * 2 ** (-5 / 12) : f * 2, t, end);
  if (slide) {
    carrier.frequency.exponentialRampToValueAtTime(f, t + 0.1);
    mod.frequency.exponentialRampToValueAtTime(f * 2, t + 0.1);
  }
  const index = ctx.createGain();
  index.gain.setValueAtTime(f * 2 * 9.6 * (0.6 + 0.4 * vel), t);
  index.gain.setTargetAtTime(f * 2 * 1.1 * tone.bright, t + 0.001, 0.0043);
  mod.connect(index).connect(carrier.frequency);
  const [push, ws] = drivenBy(ctx, 1.2 * tone.drive);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.42 * vel, t + 0.002);
  amp.gain.setTargetAtTime(EPS, t + 0.004, 0.074);
  amp.gain.setTargetAtTime(EPS, t + Math.max(0.05, dur), 0.04);
  carrier.connect(push);
  ws.connect(amp).connect(out);
}

/** The percussion kinds by their `mod`, as the composer lists them (LOFI_PERCUSSION). */
const LOFI_PERCUSSION_KINDS = ['shaker', 'tambourine', 'conga', 'cowbell', 'sticks', 'tombak', 'daf', 'woodblock', 'tanggu', 'gong', 'taiko', 'kotsuzumi', 'djembe', 'dunun', 'shekere', 'agogo', 'talking'] as const;
/** A drumhead's modes as ratios of its lowest (an ideal circular membrane's), for the hand drums. */
const MEMBRANE = [1, 1.594, 2.136, 2.296, 2.653] as const;

/**
 * The world styles' hand drums and bells, by kind, the stroke in `midi` (see the composer's
 * LOFI_PERCUSSION). Each is its modes ringing down (see modes): a drumhead's for the
 * drums, struck a little sharp and falling into pitch, louder the lower the stroke; a
 * wooden block's or a bell's inharmonic pair; with the hand's or the stick's noise on top.
 */
function worldPerc(k: VoiceKit, out: AudioNode, t: number, stroke: number, vel: number, kind: typeof LOFI_PERCUSSION_KINDS[number]): void {
  const { ctx } = k;
  const noise = (hz: number, q: number, level: number, len: number, type: BiquadFilterType = 'bandpass'): void => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = hz;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level * vel, t);
    g.gain.exponentialRampToValueAtTime(EPS, t + len);
    noiseAt(k, t, len + 0.01).connect(f).connect(g).connect(out);
  };
  const head = (f: number, level: number, fade: number, bend = 1.12, count = 4): void => {
    modes(k, out, t, f, MEMBRANE.slice(0, count).map((r, n) => [r, level / (n + 1.5) * 1.5, fade / (1 + n * 0.6)] as const), vel, bend, 0.04);
  };
  switch (kind) {
    case 'tombak':
      // The goblet drum: the tom deep in the centre, the bak sharp at the rim, the
      // pelang a finger snapped on the head, the riz a light finger roll.
      if (stroke === 1) { head(92, 0.5, 0.45, 1.25); noise(300, 1, 0.12, 0.03, 'lowpass'); }
      else if (stroke === 2) { head(560, 0.2, 0.12, 1.04, 3); noise(3400, 1, 0.34, 0.025); }
      else if (stroke === 3) { noise(4200, 1.5, 0.35, 0.025); head(700, 0.08, 0.05, 1, 2); }
      else { head(380, 0.1, 0.08, 1.02, 2); noise(2600, 1, 0.08, 0.015); }
      break;
    case 'daf':
      // The frame drum: a deep boom or a slap, and the rings on the frame shimmering.
      if (stroke !== 3) head(stroke === 1 ? 68 : 190, stroke === 1 ? 0.45 : 0.22, stroke === 1 ? 0.5 : 0.15, 1.08);
      for (const [d, level] of [[0, 1], [0.014, 0.6], [0.031, 0.4]] as const) {
        const g = ctx.createGain();
        const at = t + d;
        g.gain.setValueAtTime(EPS, at);
        g.gain.exponentialRampToValueAtTime((stroke === 1 ? 0.09 : 0.2) * level * vel, at + 0.003);
        g.gain.exponentialRampToValueAtTime(EPS, at + 0.22);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 4200;
        g.connect(out);
        metalAt(k, at, 0.25, 1.2).connect(hp).connect(g);
      }
      break;
    case 'woodblock':
      modes(k, out, t, stroke === 1 ? 1250 : 820, [[1, 0.2, 0.09], [2.6, 0.06, 0.04]], vel);
      noise(2500, 1.5, 0.12, 0.006);
      break;
    case 'tanggu':
      // The Chinese barrel drum: a deep, round centre, or the stick on its rim.
      if (stroke === 1) { head(78, 0.55, 0.7, 1.2); noise(400, 1, 0.1, 0.04, 'lowpass'); }
      else { modes(k, out, t, 1500, [[1, 0.12, 0.04]], vel); noise(3000, 1.2, 0.2, 0.012); }
      break;
    case 'gong':
      // A small gong: inharmonic modes, ringing long, its pitch sliding up as it settles.
      modes(k, out, t, 340, [[1, 0.12, 1.6], [1.47, 0.08, 1.2], [2.09, 0.06, 0.9], [2.56, 0.04, 0.7], [3.15, 0.03, 0.5]], vel, 0.94, 0.25);
      noise(1200, 0.8, 0.08, 0.05);
      break;
    case 'taiko':
      // The big drum: the don in the centre, hit hard and falling into its deep pitch,
      // or the ka, the bachi's click on the rim.
      if (stroke === 1) { head(84, 0.6, 0.9, 1.3); noise(250, 1, 0.16, 0.05, 'lowpass'); }
      else { modes(k, out, t, 1800, [[1, 0.1, 0.035], [2.3, 0.04, 0.02]], vel); noise(3500, 1.4, 0.2, 0.01); }
      break;
    case 'kotsuzumi':
      // The shoulder drum: its cords squeezed as it is struck, so the pon rises; the ta is dry.
      if (stroke === 3 || stroke === 1) { const f = stroke === 3 ? 420 : 240; modes(k, out, t, f, [[1, 0.22, 0.32], [1.59, 0.06, 0.12]], vel, 0.82, 0.12); }
      else { head(330, 0.12, 0.06, 1, 2); noise(2200, 1, 0.18, 0.02); }
      break;
    case 'djembe':
      // The goblet drum of the Mande: bass (the open centre, the shell's low resonance),
      // tone (the edge with flat fingers) or slap (cupped, a bright crack).
      if (stroke === 1) { head(76, 0.55, 0.32, 1.2); noise(200, 1, 0.1, 0.03, 'lowpass'); }
      else if (stroke === 2) { head(205, 0.3, 0.18, 1.05); noise(1200, 1, 0.08, 0.015); }
      else { head(330, 0.14, 0.08, 1.02, 3); noise(3000, 0.8, 0.5, 0.035); }
      break;
    case 'dunun':
      // The bass drum played with its bell: open or muffled, the bell struck each time.
      head(66, stroke === 1 ? 0.5 : 0.35, stroke === 1 ? 0.6 : 0.12, 1.15, 3);
      modes(k, out, t, 1850, [[1, 0.07, 0.18], [1.42, 0.04, 0.12]], vel);
      break;
    case 'shekere':
      // The gourd in its net of beads: a scatter of tiny clicks, high and dry, or a
      // palm's slap on its base.
      if (stroke === 2) { head(120, 0.25, 0.12, 1.1, 2); }
      for (let n = 0; n < 5; n++) {
        const d = n * 0.006 + k.rng() * 0.004;
        const g = ctx.createGain();
        g.gain.setValueAtTime(EPS, t + d);
        g.gain.exponentialRampToValueAtTime((0.12 - n * 0.018) * vel, t + d + 0.002);
        g.gain.exponentialRampToValueAtTime(EPS, t + d + 0.03);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 6500;
        bp.Q.value = 1.1;
        noiseAt(k, t + d, 0.035).connect(bp).connect(g).connect(out);
      }
      break;
    case 'agogo':
      modes(k, out, t, stroke === 1 ? 660 : 880, [[1, 0.13, 0.32], [2.7, 0.05, 0.16], [5.2, 0.025, 0.08]], vel);
      noise(4000, 1, 0.06, 0.004);
      break;
    case 'talking': {
      // The talking drum: one drumhead whose pitch the player's arm bends, squeezing the
      // cords, to follow the tones of speech; `stroke` is 50 plus the bend in semitones.
      const bendTo = 2 ** ((stroke - 50) / 12);
      for (const [r, level, fade] of [[1, 0.32, 0.4], [1.594, 0.1, 0.2], [2.136, 0.05, 0.12]] as const) {
        const o = osc(k, 'sine', 150 * r, t, t + fade * 1.2);
        o.frequency.exponentialRampToValueAtTime(150 * r * bendTo, t + Math.min(0.25, fade * 0.6));
        const g = ctx.createGain();
        g.gain.setValueAtTime(level * vel, t);
        g.gain.exponentialRampToValueAtTime(EPS, t + fade);
        o.connect(g).connect(out);
      }
      noise(900, 1, 0.08, 0.015);
      break;
    }
    default:
      break;
  }
}
