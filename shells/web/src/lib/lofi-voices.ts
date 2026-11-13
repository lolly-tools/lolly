// SPDX-License-Identifier: MPL-2.0
/**
 * Lofi instruments: the Web Audio voices that play engine/src/lofi-compose.ts's notes.
 * Every one is synthesised from oscillators, filters and a seeded noise buffer, so the
 * station ships no samples, owes no licence and renders the same bytes offline as live.
 * Each tune's style (LofiStyle) picks one voice of each kind and tunes the drums.
 *
 *   keys   rhodes  a two-operator FM electric piano whose brightness falls as it rings
 *          felt    a soft, muffled upright: a few warm partials and a felt thump
 *          wurli   a reedier FM piano with more bark on the attack
 *          pluck   a soft pluck, half guitar and half koto: a filter that closes fast
 *   lead   vibes, flute (with breath), soft (a filtered saw, a little like muted brass),
 *          kalimba (a bright inharmonic tine), chip (a soft chiptune square, for Lolly Sings)
 *   bass   round (sine and triangle), upright (a darker pluck with a thump), synth
 *          (a filtered saw over a sine)
 *   drums  kick, snare, brush, clap, rim, hat and shaker, tuned by the style
 *
 * The dance genres of the Lolly Sings family add their own:
 *   keys   pad (two soft detuned saws) and supersaw (a bright stack of four wide saws)
 *   lead   angel (a saw and an octave sine through two vowel formants, with vibrato)
 *   bass   wobble (a filter swinging at the note's own rate), growl (distorted, with
 *          formant filters moving apart), reese (three detuned saws, slowly moving),
 *          slap (a thumbed or popped string: a bright attack, a resonant pop), screech
 *          (an FM cry), pulse (a console's bass channel) and electro (a driven riff
 *          with a wah); each takes the tune's brightness and drive
 *   lead   pulse (a thin chiptune pulse that blips into its note), guitar (a clean
 *          electric pluck), overdrive (a driven lead guitar that bends into its notes)
 *          and synthwave (a swept saw lead with its own echoes), riff and twang (driven
 *          and clean mid-range guitars an octave down), metal (a heavy
 *          power-chord guitar an octave down) and panflute (a soft, breathy pan flute)
 *   guitar nylon (a warm nylon-string guitar, strummed as keys or picked as a lead),
 *          crunch (a mid-gain power-chord rhythm guitar) and a picked bass guitar
 *   bass   croak (the modelled slap string thumbed in repeated eighths: guttural and
 *          bubbling, a Sugar flavour)
 *   fx     crash (a cymbal with a low boom under a drop), riser (a build's noise sweep)
 *          and coin (a bright two-note square ding)
 *
 * Sherbert (future bass with an old console inside it) adds:
 *   keys   future (wide saw chords, panned apart, that bend up into their pitch and wub)
 *   lead   chop (chopped vowels: a voice of formant filters, one vowel to a key, cut
 *          short like slices of a sample, no words) and bit (a console's pulse lead:
 *          the duty cycle switching, the level and vibrato stepping once a frame)
 *   snare  stack (a clap and a snare together over the console's buzzing noise, with a
 *          long bright tail)
 *   fx     sparkle (a console's chord: root, third and fifth taking turns fifty times a
 *          second, echoing across) and game (a jump, a power-up, a power-down, a bonus)
 *
 * The world styles' instruments (Persian, Guzheng, Koto, Kora, Amapiano) live in
 * ./lofi-world-voices.ts, built on the helpers exported here.
 *
 * Each voice schedules its own nodes at `t` on the context it is given and lets them
 * end; nothing is kept. Levels sit low, and lofi-station.ts evens the variants out.
 */
import { pluckString, type StringSpec } from './lofi-strings.ts';
import type { LofiStyle } from '../../../../engine/src/lofi-compose.ts';

export interface VoiceKit {
  ctx: BaseAudioContext;
  /** Two seconds of seeded white noise, shared by every noisy voice. */
  noise: AudioBuffer;
  /** Seeded 0..1, for the small detunes and noise offsets that keep repeats alive. */
  rng: () => number;
  /** A render worked out ahead of playing (render and play): spend more on quality than live playing can. */
  hq?: boolean;
}

export const EPS = 0.0001;
export const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);

export function noiseAt(k: VoiceKit, t: number, dur: number): AudioBufferSourceNode {
  const src = k.ctx.createBufferSource();
  src.buffer = k.noise;
  src.loop = true;
  src.start(t, k.rng() * 1.5);
  src.stop(t + dur + 0.02);
  return src;
}

export function osc(k: VoiceKit, type: OscillatorType, f: number, t: number, end: number): OscillatorNode {
  const o = k.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.start(t);
  o.stop(end);
  return o;
}

/**
 * A held note's level: a strike to `peak`, a fall to `body` of it, then (for a long
 * note) a slow fade further, as a struck string or tine does, and a release at `dur`.
 */
function struck(g: AudioParam, t: number, dur: number, peak: number, attack: number, fall: number, body: number, release: number): void {
  g.setValueAtTime(EPS, t);
  g.exponentialRampToValueAtTime(peak, t + attack);
  g.exponentialRampToValueAtTime(peak * body, t + Math.max(attack + 0.005, Math.min(fall, dur * 0.9)));
  if (dur > fall + 0.2) g.setTargetAtTime(peak * body * 0.25, t + fall + 0.05, 2.2);
  g.setTargetAtTime(EPS, t + dur, release);
}

// ── keys ──────────────────────────────────────────────────────────────────────

/** How a future-bass chord moves: its wub in swings a second (0 holds it), and whether it bends up into its pitch. */
export interface KeysArt { rate: number; bend: boolean }
const HELD: KeysArt = { rate: 0, bend: false };

export function keys(style: LofiStyle['keys'], k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art: KeysArt = HELD): void {
  if (style === 'felt') felt(k, out, t, midi, vel, dur);
  else if (style === 'future') future(k, out, t, midi, vel, dur, art);
  else if (style === 'pluck') pluck(k, out, t, midi, vel, dur);
  else if (style === 'pad' || style === 'supersaw') saws(k, out, t, midi, vel, dur, style === 'supersaw');
  else if (style === 'nylon') nylon(k, out, t, midi, vel, dur, false);
  else if (style === 'crunch') crunch(k, out, t, midi, vel, dur);
  else if (style === 'heavy') heavy(k, out, t, midi, vel, dur, METAL_AMP);
  else if (style === 'buzzsaw') heavy(k, out, t, midi, vel, dur, PUNK_AMP);
  else if (style === 'wah') wah(k, out, t, midi, vel, dur);
  else if (style === 'chiparp') chipArp(k, out, t, midi, vel, dur);
  else if (style === 'steel') steel(k, out, t, midi, vel, dur);
  else if (style === 'banjo') banjo(k, out, t, midi, vel, dur);
  else if (style === 'jazzbox') jazzbox(k, out, t, midi, vel, dur);
  else if (style === 'organ') organ(k, out, t, midi, vel, dur);
  else if (style === 'harp') harp(k, out, t, midi, vel, dur);
  else if (style === 'choir') choir(k, out, t, midi, vel, dur);
  else if (style === 'honky') { fmPiano(k, out, t, midi, vel * 0.75, dur, false, 9); fmPiano(k, out, t, midi, vel * 0.75, dur, false, -9); }
  else fmPiano(k, out, t, midi, vel, dur, style === 'wurli');
}

/** A cosine (not a sine), one per context, so a wub starts each note at the top of its swing. */
const COSINES = new WeakMap<BaseAudioContext, PeriodicWave>();
function cosineOsc(k: VoiceKit, rate: number, t: number, end: number): OscillatorNode {
  let wave = COSINES.get(k.ctx);
  if (!wave) { wave = k.ctx.createPeriodicWave(new Float32Array([0, 1]), new Float32Array([0, 0])); COSINES.set(k.ctx, wave); }
  const o = k.ctx.createOscillator();
  o.setPeriodicWave(wave);
  o.frequency.setValueAtTime(rate, t);
  o.start(t);
  o.stop(end);
  return o;
}

/**
 * Future-bass chords (Sherbert). Four saws a note, two panned left and two right with
 * different detunes, so the chord is as wide as the speakers while the bass stays in the
 * middle, and a quiet pulse an octave up for a console's glint. The filter strikes open
 * and settles. A chord can bend up a whole tone into its pitch (the future-bass swoop) and
 * can wub: its level and filter swinging together at `art.rate`, the swing starting at the
 * top so every stab still hits hard. The station's kick ducking does the pumping.
 */
function future(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art: KeysArt): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.15;
  const open = Math.min(12000, 6500 + f * 6);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.7;
  lp.frequency.value = open;   // held still (a moving filter is costly on every chord note); the wub alone moves it
  // The 808 owns the low end: the chords are thinned below 260 Hz, as a producer would.
  const thin = ctx.createBiquadFilter();
  thin.type = 'highpass';
  thin.frequency.value = 260;
  thin.Q.value = 0.6;
  // And brightened on top, where the records' chords shine.
  const shine = ctx.createBiquadFilter();
  shine.type = 'highshelf';
  shine.frequency.value = 2500;
  shine.gain.value = 5;
  lp.connect(thin).connect(shine);
  const env = ctx.createGain();
  const peak = 0.12 * vel;
  env.gain.setValueAtTime(EPS, t);
  env.gain.exponentialRampToValueAtTime(peak, t + 0.006);
  env.gain.setTargetAtTime(peak * 0.8, t + 0.04, 0.35);
  env.gain.setTargetAtTime(EPS, t + dur, 0.04);
  shine.connect(env);
  if (art.rate > 0) {
    // The wub: the chord swings between itself, bright, and a dark, muffled copy, with its
    // level dipping between. A crossfade between two still filters, because a filter swept
    // by an oscillator is redesigned every sample, which made these chords the costliest
    // sound in the station.
    const lfo = cosineOsc(k, art.rate, t, end);
    const bright = ctx.createGain();
    bright.gain.value = 0.55;
    const bd = ctx.createGain();
    bd.gain.value = 0.45;
    lfo.connect(bd).connect(bright.gain);
    const dark = ctx.createGain();
    dark.gain.value = 0.35;
    const dd = ctx.createGain();
    dd.gain.value = -0.25;
    lfo.connect(dd).connect(dark.gain);
    const muffle = ctx.createBiquadFilter();
    muffle.type = 'lowpass';
    muffle.frequency.value = 900;
    muffle.Q.value = 2;
    env.connect(bright).connect(out);
    env.connect(muffle).connect(dark).connect(out);
  } else {
    env.connect(out);
  }
  // The glide is a ramp that ends (a target never quite arrives, so the browser would
  // work out every saw's pitch sample by sample for the whole note, which doubled the cost).
  const from = art.bend ? f * 2 ** (-2 / 12) : f * 2 ** (-0.25 / 12);
  const arrive = t + (art.bend ? 0.2 : 0.03);
  const glide = (o: OscillatorNode, by = 1): void => {
    o.frequency.setValueAtTime(from * by, t);
    o.frequency.exponentialRampToValueAtTime(f * by, arrive);
  };
  for (const [pan, detunes] of [[-0.8, [-26, 9]], [0.8, [-9, 26]]] as const) {
    const side = ctx.createStereoPanner();
    side.pan.value = pan;
    side.connect(lp);
    for (const cents of detunes) {
      const o = osc(k, 'sawtooth', f, t, end);
      glide(o);
      o.detune.value = cents + (k.rng() - 0.5) * 4;
      o.connect(side);
    }
  }
  const glint = pulseOsc(k, 0.25, f * 2, t, end);
  glide(glint, 2);
  const gg = ctx.createGain();
  gg.gain.value = 0.22;
  glint.connect(gg).connect(lp);
}

/**
 * Saw chords for the dance genres. A pad is two soft saws that swell in; a supersaw is
 * four, spread wider and brighter, that strike at once (the future-bass chord). Both are
 * low-passed so a chord of four stays a wall of sound and not a buzz.
 */
function saws(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, superSaw: boolean): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + (superSaw ? 0.25 : 0.7);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(superSaw ? 5200 : 1800, t);
  lp.frequency.setTargetAtTime(superSaw ? 3200 : 2400, t + 0.05, 0.4);
  lp.Q.value = 0.5;
  const amp = ctx.createGain();
  const peak = (superSaw ? 0.066 : 0.064) * vel;
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(peak, t + (superSaw ? 0.01 : 0.35));
  amp.gain.setTargetAtTime(peak * 0.8, t + 0.4, 0.5);
  amp.gain.setTargetAtTime(EPS, t + dur, superSaw ? 0.06 : 0.25);
  lp.connect(amp).connect(out);
  // Four saws for the supersaw and two for the pad: seven and three were most of a
  // drop's cost, and the spread, not the count, is what makes the chord wide.
  const spread = superSaw ? [-22, -8, 9, 23] : [-8, 8];
  for (const cents of spread) {
    const o = osc(k, 'sawtooth', f, t, end);
    o.detune.value = cents + (k.rng() - 0.5) * 3;
    o.connect(lp);
  }
}

/** Rhodes or Wurlitzer: FM, bright on the strike and mellowing as it rings. */
function fmPiano(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, wurli: boolean, cents = 0): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.5;
  const car = osc(k, 'sine', f, t, end);
  car.detune.setValueAtTime((k.rng() - 0.5) * 8 + cents, t);
  const mod = osc(k, 'sine', f, t, end);
  const index = ctx.createGain();   // FM depth in Hz
  index.gain.setValueAtTime(f * (wurli ? 1.2 + vel * 1.8 : 0.6 + vel * 1.2), t);
  index.gain.exponentialRampToValueAtTime(f * (wurli ? 0.35 : 0.18), t + (wurli ? 0.35 : 0.7));
  mod.connect(index).connect(car.frequency);
  const amp = ctx.createGain();
  struck(amp.gain, t, dur, 0.16 * vel, 0.004, wurli ? 0.6 : 1.2, wurli ? 0.3 : 0.38, 0.12);
  car.connect(amp).connect(out);
  // The tine: a quiet high partial, gone in a moment.
  const tine = osc(k, 'sine', f * (wurli ? 3.01 : 7.1), t, t + 0.14);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(EPS, t);
  tg.gain.exponentialRampToValueAtTime((wurli ? 0.02 : 0.012) * vel, t + 0.002);
  tg.gain.exponentialRampToValueAtTime(EPS, t + 0.12);
  tine.connect(tg).connect(out);
}

/** Felt piano: warm partials through a low filter, a soft hammer thump, a long fade. */
function felt(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.6;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.min(3200, f * 5), t);
  lp.frequency.exponentialRampToValueAtTime(Math.min(1600, f * 2.5), t + 0.8);
  const amp = ctx.createGain();
  struck(amp.gain, t, dur, 0.15 * vel, 0.008, 1.5, 0.42, 0.25);
  lp.connect(amp).connect(out);
  const det = (k.rng() - 0.5) * 6;
  for (const [ratio, level] of [[1, 1], [2.003, 0.38], [3.01, 0.14], [4.02, 0.05]] as const) {
    const o = osc(k, ratio === 1 ? 'triangle' : 'sine', f * ratio, t, end);
    o.detune.setValueAtTime(det, t);
    const g = ctx.createGain();
    g.gain.value = level;
    o.connect(g).connect(lp);
  }
  const thump = ctx.createBiquadFilter();
  thump.type = 'lowpass';
  thump.frequency.value = 500;
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.05 * vel, t);
  tg.gain.exponentialRampToValueAtTime(EPS, t + 0.04);
  noiseAt(k, t, 0.05).connect(thump).connect(tg).connect(out);
}

/** A soft pluck: a saw and a triangle through a filter that snaps shut. */
function pluck(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const ring = Math.min(dur, 1.6);
  const end = t + ring + 0.4;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 1.2;
  lp.frequency.setValueAtTime(Math.min(6000, f * 9), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.4), t + 0.22);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.13 * vel, t + 0.003);
  amp.gain.exponentialRampToValueAtTime(0.04 * vel, t + Math.max(0.01, Math.min(0.5, ring * 0.6)));
  amp.gain.setTargetAtTime(EPS, t + ring * 0.7, 0.25);
  lp.connect(amp).connect(out);
  for (const [type, cents, level] of [['sawtooth', -4, 0.5], ['triangle', 4, 0.8]] as const) {
    const o = osc(k, type, f, t, end);
    o.detune.setValueAtTime(cents, t);
    const g = ctx.createGain();
    g.gain.value = level;
    o.connect(g).connect(lp);
  }
}

// ── lead ──────────────────────────────────────────────────────────────────────

/**
 * The lead, by the style's instrument. `art` 1 bends (harmonica, guitar, pedal steel) or
 * scoops (horns, fiddle) up into the note; the other leads play every note straight.
 * `from` is the note before when this one is slurred onto it (it starts as the last one
 * ends); the wind voices then glide from that pitch with no new attack, the way a player
 * changes note without tonguing. The other voices take no notice of the pitch.
 */
export function lead(style: LofiStyle['lead'], k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art = 0, from?: number): void {
  if (style === 'flute') flute(k, out, t, midi, vel, dur, from);
  else if (style === 'soft') softLead(k, out, t, midi, vel, dur);
  else if (style === 'kalimba') kalimba(k, out, t, midi, vel);
  else if (style === 'vibes') vibes(k, out, t, midi, vel, dur);
  else if (style === 'chip') chip(k, out, t, midi, vel, dur);
  else if (style === 'angel') angel(k, out, t, midi, vel, dur);
  else if (style === 'pulse') pulseLead(k, out, t, midi, vel, dur);
  else if (style === 'guitar') guitar(k, out, t, midi, vel, dur, art);
  else if (style === 'overdrive') overdrive(k, out, t, midi, vel, dur, art);
  else if (style === 'synthwave') synthwave(k, out, t, midi, vel, dur);
  else if (style === 'metal') metal(k, out, t, midi, vel, dur, art);
  else if (style === 'panflute') panflute(k, out, t, midi, vel, dur);
  else if (style === 'nylon') nylon(k, out, t, midi, vel, dur, true);
  else if (style === 'riff') riff(k, out, t, midi, vel, dur, art);
  else if (style === 'twang') twang(k, out, t, midi, vel, dur, art);
  else if (style === 'banjo') banjo(k, out, t, midi, vel, dur);
  else if (style === 'harmonica') harmonica(k, out, t, midi, vel, dur, art, from);
  else if (style === 'pedal') pedalSteel(k, out, t, midi, vel, dur, art);
  else if (style === 'fiddle') fiddle(k, out, t, midi, vel, dur, art);
  else if (style === 'bells') bells(k, out, t, midi, vel, dur);
  else if (style === 'chop') chop(k, out, t, midi, vel, dur);
  else if (style === 'bit') bitLead(k, out, t, midi, vel, dur);
}


/** Vowels as their first three formants (Hz): ah, eh, ee, oh, oo, a high voice's. */
const CHOP_VOWELS: ReadonlyArray<readonly [number, number, number]> = [
  [850, 1610, 2900], [600, 2100, 2850], [360, 2650, 3350], [540, 980, 2750], [420, 1150, 2650],
];
/** A chopped voice sounds sped up: its formants sit higher than a person's. */
const CHOP_LIFT = 1.12;

/**
 * Chop (Sherbert): chopped vowels, the sound of a sung phrase cut into slices and played
 * as an instrument. A saw (the voice) through three formant filters, so it sings a vowel,
 * with a consonant's click at the front, breath on top, and a cut-off end, as a slice has.
 * Each key keeps one vowel, the way a sampler maps one slice to a key, so a melody that
 * comes round again sings the same syllables. Two voices a few cents apart, one to each
 * side, sing it together, double-tracked, so the chops are wide. Synthesised: no
 * recording and no words.
 */
function chop(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const len = Math.max(0.05, dur);
  const end = t + len + 0.06;
  const [f1, f2, f3] = CHOP_VOWELS[(midi * 7) % CHOP_VOWELS.length]!;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.26 * vel, t + 0.005);
  amp.gain.setTargetAtTime(0.21 * vel, t + 0.02, 0.1);
  amp.gain.setTargetAtTime(EPS, t + len, 0.01);
  amp.connect(out);
  const mouth = ctx.createGain();
  for (const [pan, cents] of [[-0.45, -7], [0.45, 7]] as const) {
    const voice = osc(k, 'sawtooth', f, t, end);
    voice.detune.value = cents;
    voice.frequency.setValueAtTime(f * 2 ** (-0.6 / 12), t);
    voice.frequency.exponentialRampToValueAtTime(f, t + 0.035);   // the voice finding its note
    if (len > 0.3) vibrato(k, voice.detune, t, end, 5.6, 18, 0.14);
    const side = ctx.createStereoPanner();
    side.pan.value = pan;
    voice.connect(side).connect(mouth);
  }
  for (const [hz, q, level] of [[f1, 5, 0.7], [f2, 8, 1], [f3, 8, 0.75]] as const) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = q;
    bp.frequency.value = hz * CHOP_LIFT;   // held still: a moving filter is recomputed every sample, and chops come thick and fast
    const g = ctx.createGain();
    g.gain.value = level;
    mouth.connect(bp).connect(g).connect(amp);
  }
  // The consonant at the front of the slice, then breath over the vowel: one noise for both.
  const air = ctx.createBiquadFilter();
  air.type = 'highpass';
  air.frequency.value = 3200;
  const ag = ctx.createGain();
  ag.gain.setValueAtTime(0.06 * vel, t);
  ag.gain.exponentialRampToValueAtTime(0.022 * vel, t + 0.008);
  ag.gain.setTargetAtTime(EPS, t + len, 0.01);
  noiseAt(k, t, len + 0.05).connect(air).connect(ag).connect(out);
}

/** An old console's video frame: its sound changed once a frame, so its envelopes step. */
const FRAME = 1 / 60;

/**
 * Bit (Sherbert): a console's pulse lead. It starts thin (a 12.5% pulse) and fills out to
 * a quarter pulse after two frames; its level steps down through a console's sixteen
 * levels once a frame to where it holds, and steps out; a held note gets a vibrato that
 * steps too, after a fifth of a second. The steps are what make it sound like the console
 * and not a synthesiser imitating one.
 */
function bitLead(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const len = Math.max(0.05, dur);
  const end = t + len + 6 * FRAME;
  const amp = ctx.createGain();
  const level = (v: number): number => (v / 15) * 0.07 * vel;
  const fall = [15, 14, 13, 12, 11, 11, 10, 10, 9];
  amp.gain.setValueAtTime(level(fall[0]!), t);
  for (let n = 1; n < fall.length && n * FRAME < len; n++) amp.gain.setValueAtTime(level(fall[n]!), t + n * FRAME);
  [6, 4, 2, 1, 0].forEach((v, n) => { amp.gain.setValueAtTime(level(v), t + len + n * FRAME); });
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 11000;
  amp.connect(lp).connect(out);
  const thin = pulseOsc(k, 0.125, f, t, end);
  const full = pulseOsc(k, 0.25, f, t, end);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(1, t);
  tg.gain.setValueAtTime(0, t + 2 * FRAME);
  const fg = ctx.createGain();
  fg.gain.setValueAtTime(0, t);
  fg.gain.setValueAtTime(1, t + 2 * FRAME);
  thin.connect(tg).connect(amp);
  full.connect(fg).connect(amp);
  if (len > 0.25) {
    const wobble = [0, 14, 22, 14, 0, -14, -22, -14];
    for (let n = 0, at = t + 12 * FRAME; at < t + len; n++, at += 2 * FRAME) {
      for (const o of [thin, full]) o.detune.setValueAtTime(wobble[n % wobble.length]!, at);
    }
  }
}

/** A concert harp: a mellow pluck from the middle of a long gut string, ringing on. */
function harp(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  plucked(k, out, t, midi, vel, Math.max(dur, 1.2), { pickAt: 0.5, bright: 9, mellow: 3, ring: 2.4, body: 520, level: 0.24 });
}

/**
 * A choir singing "ah": three voices a few cents apart (a section, not a soloist), shaped
 * by the vowel's formants, swelling in slowly with a gentle vibrato.
 */
function choir(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.6;
  const mix = ctx.createGain();
  for (const cents of [-9, 0, 8]) {
    const o = osc(k, 'sawtooth', f, t, end);
    o.detune.setValueAtTime(cents, t);
    vibrato(k, o.detune, t, end, 5 + k.rng(), 12, 0.3);
    o.connect(mix);
  }
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.27 * vel, t + 0.28);
  amp.gain.setValueAtTime(0.27 * vel, t + Math.max(0.3, dur));
  amp.gain.exponentialRampToValueAtTime(EPS, end);
  amp.connect(out);
  // "Ah": the vowel's first three formants, in parallel.
  for (const [hz, q, level] of [[750, 5, 1], [1150, 6, 0.6], [2700, 8, 0.25]] as const) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = hz;
    bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = level;
    mix.connect(bp).connect(g).connect(amp);
  }
}

/**
 * Bells (a celesta or glockenspiel): a bright FM strike whose metallic partials fade
 * first, leaving the pure tone ringing.
 */
function bells(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const ring = Math.max(1.2, Math.min(2.5, dur + 1));
  const car = osc(k, 'sine', f, t, t + ring + 0.05);
  const mod = osc(k, 'sine', f * 3.5, t, t + ring + 0.05);
  const index = ctx.createGain();
  index.gain.setValueAtTime(f * 2.2 * (0.6 + vel * 0.6), t);
  index.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.9);
  mod.connect(index).connect(car.frequency);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.09 * vel, t + 0.002);
  amp.gain.exponentialRampToValueAtTime(EPS, t + ring);
  car.connect(amp).connect(out);
}

// ── the roots instruments ───────────────────────────────────────────────────

/** A steel-string acoustic: brighter and longer-ringing than nylon, with the body's jangle. */
function steel(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  plucked(k, out, t, midi, vel, dur, { pickAt: 0.1, bright: 20, mellow: 4.5, ring: 1.5, body: 2600, level: 0.08 });
}

/**
 * A banjo: a bright, short pluck through a high-pass (a banjo has no low body), and the
 * drum head's ring, a nasal resonance around 1 kHz that every note sets off.
 */
function banjo(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 260;
  const head = ctx.createBiquadFilter();
  head.type = 'peaking';
  head.frequency.value = 1050;
  head.Q.value = 2.4;
  head.gain.value = 7;
  hp.connect(head).connect(out);
  plucked(k, hp, t, midi, vel, Math.min(dur, 0.5), { pickAt: 0.2, bright: 26, mellow: 7, ring: 0.45, body: 2800, level: 0.12 });
}

/** An archtop jazz guitar: flatwound strings picked softly, heard by the neck pickup through a dark amp, round and warm. */
function jazzbox(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  plucked(k, out, t, midi, vel, dur, { pickAt: 0.22, bright: 6, mellow: 2.2, ring: 1.3, body: 850, level: 0.15, pickup: 0.3, top: 3500, noise: 0.08 });
}

/** The organ's drawbars (16', 8', 4', 2 2/3', 2'), as one waveform, made once per context. */
const ORGANS = new WeakMap<BaseAudioContext, PeriodicWave>();
function organWave(ctx: BaseAudioContext): PeriodicWave {
  let wave = ORGANS.get(ctx);
  if (!wave) {
    // Harmonics of the 16' foot: the fundamental, the 8' an octave up, then the 4' and the 2 2/3'.
    const amp = [0, 0.7, 1, 0.45, 0.6, 0, 0.35, 0, 0.3];
    wave = ctx.createPeriodicWave(new Float32Array(amp.length), Float32Array.from(amp));
    ORGANS.set(ctx, wave);
  }
  return wave;
}

/** A tonewheel organ: the drawbars, a key click, and the rotating speaker's vibrato. */
function organ(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const end = t + dur + 0.12;
  const o = ctx.createOscillator();
  o.setPeriodicWave(organWave(ctx));
  o.frequency.setValueAtTime(mtof(midi) / 2, t);
  o.start(t);
  o.stop(end);
  vibrato(k, o.detune, t, end, 6.4, 9, 0.05);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.06 * vel, t + 0.008);
  amp.gain.setValueAtTime(0.06 * vel, t + Math.max(0.01, dur));
  amp.gain.exponentialRampToValueAtTime(EPS, end);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 4200;
  o.connect(lp).connect(amp).connect(out);
  crack(k, out, t, 0.04 * vel, 2200, 0.006);   // the key click
}

/**
 * A harmonic spectrum as a PeriodicWave, made once per context and key: `amps(n)` is the
 * level of harmonic n. A PeriodicWave is band-limited by the browser, so a bright wave
 * never aliases, and it costs one oscillator, where a waveshaper needed oversampling.
 */
const SPECTRA = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();
function spectrumWave(ctx: BaseAudioContext, key: string, count: number, amps: (n: number) => number): PeriodicWave {
  let byKey = SPECTRA.get(ctx);
  if (!byKey) { byKey = new Map(); SPECTRA.set(ctx, byKey); }
  let wave = byKey.get(key);
  if (!wave) {
    const real = new Float32Array(count + 1);
    const imag = new Float32Array(count + 1);
    for (let n = 1; n <= count; n++) imag[n] = amps(n);
    wave = ctx.createPeriodicWave(real, imag);
    byKey.set(key, wave);
  }
  return wave;
}
const fromDb = (db: number): number => 10 ** (db / 20);

/** An oscillator playing `wave` at `f`, or gliding into `f` from `from` Hz (a slur). */
function waveOsc(k: VoiceKit, wave: PeriodicWave, f: number, t: number, end: number, from?: number): OscillatorNode {
  const o = k.ctx.createOscillator();
  o.setPeriodicWave(wave);
  o.frequency.setValueAtTime(from ?? f, t);
  if (from) o.frequency.exponentialRampToValueAtTime(f, t + 0.045);
  o.start(t);
  o.stop(end);
  return o;
}

/**
 * A wind's brightness, the way a real one behaves: two low-passes whose cutoff follows the
 * note's loudness, a little behind the attack (the top harmonics of a horn speak last), so
 * a soft note is nearly pure and a loud one opens right up. `low` and `high` are the
 * cutoff, in harmonics of `f`, at a whisper and at full strength.
 */
function brightness(k: VoiceKit, f: number, t: number, dur: number, end: number, vel: number, low: number, high: number, attack: number): BiquadFilterNode[] {
  const top = Math.min(15000, f * (low + (high - low) * vel ** 2));
  const rest = Math.min(15000, f * low);
  const open = Math.max(t + attack + 0.03, t + 0.01);
  return [0.55, 0.8].map((q) => {
    const lp = k.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = q;
    lp.frequency.setValueAtTime(rest, t);
    lp.frequency.exponentialRampToValueAtTime(top * 1.12, open);
    lp.frequency.exponentialRampToValueAtTime(top, open + 0.12);
    lp.frequency.setValueAtTime(top, Math.max(open + 0.13, t + dur));
    lp.frequency.exponentialRampToValueAtTime(rest, end);
    return lp;
  });
}

/** Chain `filters` from `from` and return the last. */
function chain(from: AudioNode, filters: readonly AudioNode[]): AudioNode {
  let node = from;
  for (const f of filters) { node.connect(f); node = f; }
  return node;
}

/**
 * A blues harp: a reed's buzz (a narrow pulse) through the cupped hands and the mouth (two
 * formant bands), brighter the harder it is blown, breath, a hand tremolo on long notes,
 * and with `art` a bend up into the note from a semitone and a half below.
 */
function harmonica(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art: number, from?: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.12;
  const reed = pulseOsc(k, 0.3, from ? mtof(from) : art ? f * 2 ** (-1.5 / 12) : f, t, end);
  if (from || art) reed.frequency.exponentialRampToValueAtTime(f, t + (from ? 0.045 : 0.16));
  vibrato(k, reed.detune, t, end, 5.2, 8, 0.3);
  const lps = brightness(k, f, t, dur, end, vel, 3, 16, 0.02);
  const shaped = chain(reed, lps);
  const mix = ctx.createGain();
  for (const [hz, q, level] of [[1050, 1.6, 1], [2500, 2.4, 0.7], [600, 1, 0.4]] as const) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = hz;
    bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = level;
    shaped.connect(bp).connect(g).connect(mix);
  }
  const trem = ctx.createGain();
  trem.gain.value = 1;
  if (dur > 0.5) vibrato(k, trem.gain, t, end, 5, 0.35, 0.3);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(from ? 0.06 * vel : EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.17 * vel, t + (from ? 0.015 : 0.025));
  amp.gain.setValueAtTime(0.17 * vel, t + Math.max(0.03, dur));
  amp.gain.exponentialRampToValueAtTime(EPS, end);
  mix.connect(trem).connect(amp).connect(out);
  const breath = ctx.createBiquadFilter();
  breath.type = 'bandpass';
  breath.frequency.value = 1800;
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.012 * vel, t);
  bg.gain.exponentialRampToValueAtTime(EPS, end);
  noiseAt(k, t, dur + 0.1).connect(breath).connect(bg).connect(out);
}

/**
 * A pedal steel: a pure, singing tone that swells in under the volume pedal and, with
 * `art`, glides up a whole tone into the note as the pedal is pushed.
 */
function pedalSteel(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.35;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3400;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.11 * vel, t + 0.12);
  amp.gain.setTargetAtTime(EPS, t + Math.max(0.15, dur), 0.12);
  lp.connect(amp).connect(out);
  for (const [type, level] of [['sine', 1], ['triangle', 0.5], ['sawtooth', 0.08]] as const) {
    const o = osc(k, type, art ? f * 2 ** (-2 / 12) : f, t, end);
    if (art) o.frequency.exponentialRampToValueAtTime(f, t + 0.3);
    vibrato(k, o.detune, t, end, 5, 7, 0.45);
    const g = ctx.createGain();
    g.gain.value = level;
    o.connect(g).connect(lp);
  }
}

/**
 * A fiddle: two saws (the bow never quite still) through the body's three resonances,
 * bow noise, vibrato that arrives after the stroke, and with `art` a slide up into the note.
 */
function fiddle(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.12;
  let node: AudioNode = ctx.createGain();
  const input = node;
  for (const [hz, gain, q] of [[450, 6, 1.5], [1200, 5, 1.4], [2900, 4, 1.6]] as const) {
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
  lp.frequency.value = 5500;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.04 * vel, t + 0.05);
  amp.gain.setValueAtTime(0.038 * vel, t + Math.max(0.06, dur));
  amp.gain.exponentialRampToValueAtTime(EPS, end);
  node.connect(lp).connect(amp).connect(out);
  for (const cents of [-4, 4]) {
    const o = osc(k, 'sawtooth', f, t, end);
    o.detune.setValueAtTime(cents - (art ? 100 : 0), t);
    if (art) o.detune.linearRampToValueAtTime(cents, t + 0.1);
    vibrato(k, o.detune, t, end, 5.6, 20, Math.min(0.2, dur * 0.5));
    o.connect(input);
  }
  const bow = ctx.createBiquadFilter();
  bow.type = 'highpass';
  bow.frequency.value = 2800;
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.008 * vel, t);
  bg.gain.exponentialRampToValueAtTime(EPS, end);
  noiseAt(k, t, dur + 0.1).connect(bow).connect(bg).connect(out);
}

/**
 * Riff: a mid-range lead guitar, single notes an octave below the melody through a
 * driven amp with a mid-forward cabinet: the rock riff, not the scooped metal chug.
 */
function riff(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art = 0): void {
  const { ctx } = k;
  const f = mtof(midi - 12);
  const end = t + dur + 0.2;
  const [push, ws] = drivenBy(ctx, 4, true);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 120;
  const mids = ctx.createBiquadFilter();
  mids.type = 'peaking';
  mids.frequency.value = 900;
  mids.Q.value = 1;
  mids.gain.value = 5;
  const cab = ctx.createBiquadFilter();
  cab.type = 'lowpass';
  cab.frequency.value = 3800;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.06 * vel, t + 0.008);
  amp.gain.setTargetAtTime(EPS, t + dur, 0.07);
  ws.connect(hp).connect(mids).connect(cab).connect(amp).connect(out);
  const drive = ctx.createGain();
  drive.gain.value = ELECTRIC_DRIVE;
  drive.connect(push);
  const attack = guitarAttack(art);
  for (const cents of [-5, 5]) {
    const s = electric(k, f, t, end, vel, dur < 0.18);
    s.playbackRate.setValueAtTime(attack.from, t);
    s.playbackRate.exponentialRampToValueAtTime(1, t + attack.time);
    s.detune.value = cents;
    vibrato(k, s.detune, t, end, 5.2, 18, 0.3);
    s.connect(drive);
  }
}

/**
 * Twang: a clean mid-range guitar an octave below the melody, plucked (see plucked())
 * through a tremolo, the surf and spaghetti-western sound.
 */
function twang(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art = 0): void {
  const { ctx } = k;
  const trem = ctx.createGain();
  trem.gain.value = 0.75;
  const lfo = osc(k, 'sine', 6.5, t, t + dur + 1.2);
  const depth = ctx.createGain();
  depth.gain.value = 0.25;
  lfo.connect(depth).connect(trem.gain);
  trem.connect(out);
  plucked(k, trem, t, midi - 12, vel, dur, { pickAt: 0.14, bright: 10, mellow: 3, ring: 1.4, body: 1800, level: 0.145, pickup: 0.1, top: 6500, ...pluckedArt(art, dur) });
}

/**
 * Nylon: a classical guitar (see plucked()). Plucked further from the bridge than an
 * electric, so rounder, with the top mellowing sooner and a wooden body resonance
 * near 220 Hz. Strummed as chords (the rumba) or picked as a melody, a touch brighter
 * and longer as a lead.
 */
function nylon(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, lead: boolean): void {
  plucked(k, out, t, midi, vel, dur, lead
    ? { pickAt: 0.2, bright: 9, mellow: 2.6, ring: 1.1, body: 220, level: 0.13 }
    : { pickAt: 0.22, bright: 7, mellow: 2.2, ring: 0.8, body: 220, level: 0.08 });
}

/** A chiptune arpeggio note: a 25% pulse, short and bright, an old console's second channel. */
function chipArp(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const len = Math.max(0.04, Math.min(dur, 0.25));
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 7000;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.045 * vel, t + 0.002);
  amp.gain.setValueAtTime(0.045 * vel, t + len * 0.6);
  amp.gain.exponentialRampToValueAtTime(EPS, t + len);
  lp.connect(amp).connect(out);
  pulseOsc(k, 0.25, mtof(midi), t, t + len + 0.02).connect(lp);
}

/**
 * Wah: a funk guitar's chank, a short, bright pluck through a resonant band-pass that
 * sweeps up as the string is struck and back down (the "wacka").
 */
function wah(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const len = Math.max(0.05, Math.min(dur, 0.3));
  const string = ctx.createBufferSource();
  string.buffer = stringBuffer(ctx, { f, seconds: 0.5, pickAt: 0.1, bright: vel >= 0.6 ? 18 : 11, decay: 1.2, mellow: 9, pickup: 0.12, noise: 0.3 }, k.rng() < 0.5 ? 0 : 1);
  string.start(t);
  string.stop(t + len + 0.08);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 4;
  bp.frequency.setValueAtTime(500, t);
  bp.frequency.exponentialRampToValueAtTime(2400, t + 0.05);
  bp.frequency.exponentialRampToValueAtTime(800, t + len);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.16 * vel * WAH_LEVEL, t + 0.002);
  amp.gain.setTargetAtTime(EPS, t + len * 0.6, 0.03);
  string.connect(bp).connect(amp).connect(out);
}

/**
 * Crunch: a rhythm guitar's power chord, the root an octave below the given note with
 * its fifth and octave, through an amp at a classic rock's gain: driven but open, with a
 * mid push near 1 kHz rather than metal's scoop. A short note is palm-muted.
 */
function crunch(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const root = mtof(midi - 12);
  const chug = dur < 0.18;
  const end = t + dur + 0.15;
  const [push, ws] = drivenBy(ctx, 3.5);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 80;
  const mid = ctx.createBiquadFilter();
  mid.type = 'peaking';
  mid.frequency.value = 1000;
  mid.Q.value = 0.9;
  mid.gain.value = 3;
  const cab = ctx.createBiquadFilter();
  cab.type = 'lowpass';
  cab.frequency.value = chug ? 2000 : 4600;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.06 * vel, t + 0.005);
  if (chug) amp.gain.setTargetAtTime(EPS, t + 0.06, 0.05);
  else amp.gain.setTargetAtTime(EPS, t + dur, 0.08);
  ws.connect(hp).connect(mid).connect(cab).connect(amp).connect(out);
  const drive = ctx.createGain();
  drive.gain.value = ELECTRIC_DRIVE / 1.6;
  drive.connect(push);
  for (const [n, [ratio, cents]] of ([[1, -4], [1.5, 3], [2, 0]] as const).entries()) {
    // A downstroke: the low string first, the next a few milliseconds behind.
    const s = electric(k, root * ratio, t + n * 0.006, end, vel, chug);
    s.detune.value = cents;
    s.connect(drive);
  }
}

/**
 * A high-gain amp's clipping curve, made once: hard clipping, a touch asymmetric (a
 * valve's even harmonics), exactly zero at silence so a note's tail goes quiet.
 */
const HEAVY_CURVE = ((): Float32Array<ArrayBuffer> => {
  const n = 2049;
  const c = new Float32Array(n);
  const lean = 0.08;
  const raw = (x: number): number => Math.tanh(4 * (x + lean)) - Math.tanh(4 * lean);
  const norm = Math.max(Math.abs(raw(1)), Math.abs(raw(-1)));
  for (let i = 0; i < n; i++) c[i] = raw((i / (n - 1)) * 2 - 1) / norm;
  return c;
})();

/** A guitar amp and its speaker cabinet: [Hz, gain dB] for each tone stage. */
export interface Amp {
  /** How hard the preamp is driven. */
  gain: number;
  /** The high-pass before the drive that keeps the lows tight. */
  tight: number;
  /** The mid push into the drive (a boost pedal's), the cabinet's low resonance, the mids scooped or pushed after the drive, and the presence. */
  push: readonly [number, number]; low: readonly [number, number]; mids: readonly [number, number]; presence: readonly [number, number];
  /** The cabinet's top: where its speakers stop. */
  cab: number;
  level: number;
}
/** Metal: driven very hard, tight, the mids scooped after the drive, a 4x12's low thump and bite. */
const METAL_AMP: Amp = { gain: 16, tight: 120, push: [900, 6], low: [115, 8], mids: [550, -5], presence: [2900, 4], cab: 5000, level: 0.07 };
/** Punk: driven hard but less, the mids left in so it buzzes like a saw. */
const PUNK_AMP: Amp = { gain: 8, tight: 110, push: [800, 4], low: [120, 5], mids: [1100, 3], presence: [2500, 3], cab: 5600, level: 0.07 };
/** A metal lead: as much gain, more of the mids a solo needs to sing through the band. */
const LEAD_AMP: Amp = { gain: 18, tight: 160, push: [1000, 7], low: [120, 2], mids: [700, -2], presence: [3000, 4], cab: 5400, level: 0.06 };

/** A peaking filter at [Hz, dB]. */
function peak(ctx: BaseAudioContext, [hz, db]: readonly [number, number], q = 0.9): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = 'peaking';
  f.frequency.value = hz;
  f.gain.value = db;
  f.Q.value = q;
  return f;
}

/**
 * A guitar amp and cabinet, built once per amp and output and left running, the way a
 * guitarist plugs into one amp for the whole song: every note's strings feed its input,
 * so notes that overlap distort together, as they do in a real amp, and a note costs only
 * its strings. The chain: a tightening high-pass and a mid push into a hard, oversampled
 * clipper (oversampling keeps a high-gain tone from fizzing), the cabinet's resonance,
 * mids and presence, and its speakers' steep top. `double` splits it into a double-tracked
 * pair, the second side a few milliseconds behind, so a rhythm part fills the speakers.
 */
const AMPS = new WeakMap<AudioNode, Map<Amp, GainNode>>();
export function ampInput(k: VoiceKit, out: AudioNode, amp: Amp, double: boolean): GainNode {
  let byAmp = AMPS.get(out);
  if (!byAmp) { byAmp = new Map(); AMPS.set(out, byAmp); }
  const ready = byAmp.get(amp);
  if (ready) return ready;
  const { ctx } = k;
  const input = ctx.createGain();
  input.gain.value = amp.gain;
  const tight = ctx.createBiquadFilter();
  tight.type = 'highpass';
  tight.frequency.value = amp.tight;
  tight.Q.value = 0.7;
  const ws = ctx.createWaveShaper();
  ws.curve = HEAVY_CURVE;
  ws.oversample = k.hq ? '4x' : '2x';
  const cabs = [0.8, 0.6].map((q, j) => {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = q;
    lp.frequency.value = amp.cab * (1 + j * 0.12);
    return lp;
  });
  const level = ctx.createGain();
  level.gain.value = amp.level;
  const cab = chain(input, [tight, peak(ctx, amp.push, 0.8), ws, peak(ctx, amp.low, 1), peak(ctx, amp.mids, 0.8), peak(ctx, amp.presence, 1.2), ...cabs, level]);
  if (double) {
    const left = ctx.createStereoPanner();
    left.pan.value = -0.8;
    const late = ctx.createDelay(0.05);
    late.delayTime.value = 0.011;
    const right = ctx.createStereoPanner();
    right.pan.value = 0.8;
    cab.connect(left).connect(out);
    cab.connect(late).connect(right).connect(out);
  } else {
    cab.connect(out);
  }
  byAmp.set(amp, input);
  return input;
}

/**
 * One note's strings into an amp: saws at `freqs` (a power chord, or one note), picked
 * with the note's envelope. A short note is palm-muted: the hand on the strings darkens
 * them before they reach the amp, and the note stops dead.
 */
export function strings(k: VoiceKit, input: AudioNode, t: number, freqs: readonly number[], vel: number, dur: number, chug: boolean, vib: boolean, bend?: { from: number; time: number }): void {
  const { ctx } = k;
  const end = t + dur + 0.14;
  const g = ctx.createGain();
  const level = (0.6 + 0.4 * vel) / freqs.length;
  g.gain.setValueAtTime(EPS, t);
  g.gain.exponentialRampToValueAtTime(level, t + 0.004);
  if (chug) g.gain.setTargetAtTime(EPS, t + Math.min(0.05, dur), 0.035);
  else g.gain.setTargetAtTime(EPS, t + dur, 0.07);
  let into: AudioNode = g;
  if (chug) {
    const mute = ctx.createBiquadFilter();
    mute.type = 'lowpass';
    mute.frequency.value = 1400;
    mute.Q.value = 0.7;
    g.connect(mute);
    into = mute;
  }
  into.connect(input);
  const drive = ctx.createGain();
  drive.gain.value = ELECTRIC_DRIVE;
  drive.connect(g);
  for (const [n, f] of freqs.entries()) {
    const s = electric(k, f, t + n * 0.005, end, vel, chug);
    s.detune.value = n === 0 ? -4 : 3;
    if (bend) { s.playbackRate.setValueAtTime(bend.from, t); s.playbackRate.exponentialRampToValueAtTime(1, t + bend.time); }
    if (vib) vibrato(k, s.detune, t, end, 5.2, 14, 0.3);
    s.connect(drive);
  }
}

/**
 * A heavy rhythm guitar (metal's `heavy`, punk's `buzzsaw`): a power chord (root and
 * fifth, the octave on held chords) an octave below the given note, through a high-gain
 * amp, double-tracked. A short note is a palm-muted chug.
 */
function heavy(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, amp: Amp): void {
  const root = mtof(midi - 12);
  const chug = dur < 0.18;
  strings(k, ampInput(k, out, amp, true), t, chug ? [root, root * 1.5] : [root, root * 1.5, root * 2], vel, dur, chug, false);
}

/**
 * Metal's lead guitar: the note itself through a high-gain amp with the mids a solo needs,
 * vibrato on held notes, and a short note muted and tight.
 */
function metal(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art = 0): void {
  strings(k, ampInput(k, out, LEAD_AMP, false), t, [mtof(midi)], vel, dur, dur < 0.18, dur >= 0.3, art ? guitarAttack(art) : undefined);
}

/**
 * Pan flute: a breathy, hollow pipe. A sine and a soft triangle carry the note under
 * band-passed breath noise; a chiff of noise starts it, the pitch wavers a little as
 * breath does, and a slow vibrato comes in on held notes.
 */
function panflute(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.9;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.1 * vel, t + 0.09);
  amp.gain.setTargetAtTime(EPS, t + dur, 0.12);
  amp.connect(out);
  const tone = osc(k, 'sine', f, t, end);
  const tri = osc(k, 'triangle', f, t, end);
  const tg = ctx.createGain();
  tg.gain.value = 0.3;
  vibrato(k, tone.detune, t, end, 4.6, 14, 0.35);
  vibrato(k, tri.detune, t, end, 4.6, 14, 0.35);
  tone.connect(amp);
  tri.connect(tg).connect(amp);
  // Breath: noise in a narrow band on the note's own pitch, so the air sounds blown
  // rather than added, swelling with the note and never louder than the tone.
  const breath = ctx.createBiquadFilter();
  breath.type = 'bandpass';
  breath.frequency.value = f * 2;
  breath.Q.value = 10;
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0, t);
  bg.gain.linearRampToValueAtTime(0.7, t + 0.09);
  bg.gain.setTargetAtTime(0.35, t + 0.12, 0.2);
  noiseAt(k, t, dur + 0.9).connect(breath).connect(bg).connect(amp);
}

/**
 * How a lead guitar note starts, by its articulation (lib/lofi-perform.ts): 1 bent up a
 * tone into pitch, 2 slid into from a tone below, otherwise picked with the small scoop a
 * pick's strike gives. The pitch ratio it starts at and how long it takes to arrive.
 */
function guitarAttack(art: number): { from: number; time: number } {
  return art === 1 ? { from: 2 ** (-2 / 12), time: 0.16 } : art === 2 ? { from: 2 ** (-2 / 12), time: 0.05 } : { from: 2 ** (-0.2 / 12), time: 0.03 };
}
/** A plucked lead's bend or slide, as plucked()'s options; held notes get a left-hand vibrato. */
function pluckedArt(art: number, dur: number): { slide?: number; slideTime?: number; wobble?: number } {
  const bend = art === 1 || art === 2 ? { slide: -2, slideTime: art === 1 ? 0.16 : 0.05 } : {};
  return { ...bend, ...(dur > 0.6 ? { wobble: 12 } : {}) };
}

/**
 * Guitar: a clean electric pluck (see plucked()). Brighter than nylon, plucked nearer
 * the bridge, and it rings a little longer.
 */
function guitar(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art = 0): void {
  plucked(k, out, t, midi, vel, dur, { pickAt: 0.12, bright: 14, mellow: 3.2, ring: 1.2, body: 2400, level: 0.095, pickup: 0.2, top: 5500, ...pluckedArt(art, dur) });
}

/** The strings rendered so far, per context: one recording per note, pluck and strength, played back by every pluck. */
const STRINGS = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();
/** A note's recording from the string model (lib/lofi-strings.ts), made on first use. */
export function stringBuffer(ctx: BaseAudioContext, spec: Omit<StringSpec, 'sr'>, variant: number): AudioBuffer {
  let cache = STRINGS.get(ctx);
  if (!cache) { cache = new Map(); STRINGS.set(ctx, cache); }
  const key = `${spec.f.toFixed(2)}|${spec.seconds.toFixed(2)}|${spec.pickAt}|${spec.bright.toFixed(1)}|${spec.decay.toFixed(2)}|${spec.mellow}|${spec.pickup ?? 0}|${spec.noise ?? ''}|${spec.plane ?? ''}|${spec.top ?? ''}|${variant}`;
  let buf = cache.get(key);
  if (!buf) {
    if (cache.size > 600) cache.clear();
    // Each note and variant seeds its own pluck, so a tune renders the same every time.
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
    const data = pluckString({ ...spec, sr: ctx.sampleRate }, mulberry(h));
    buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
    buf.getChannelData(0).set(data);
    cache.set(key, buf);
  }
  return buf;
}

/** A small seeded source, for the strings' plucks. */
function mulberry(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How a plucked string is played: where, how bright, how long it rings, and the instrument around the string. */
export interface Pluck {
  pickAt: number; bright: number; mellow: number; ring: number; body: number; level: number;
  /** A second string in the course, this many cents apart: the beating of a doubled or quadrupled course. */
  course?: number;
  /** Slide into the note from this many semitones away (a guzheng's press, a koto's oshide), over `slideTime`. */
  slide?: number; slideTime?: number;
  /** A left-hand vibrato as the note rings (the zither's rou), in cents. */
  wobble?: number;
  /** An electric's pickup, as a fraction of the string from the bridge (0.1 the bridge pickup, 0.28 the neck). */
  pickup?: number;
  /** How much of the pluck is noise: a pick's scrape (0.25) or a fingertip (0.1). */
  noise?: number;
  /** Where the body or speaker rolls the top off (Hz). */
  top?: number;
}

/**
 * A plucked string, modelled (lib/lofi-strings.ts): each note is rendered once from a
 * string's physics, a soft and a hard pluck and two of each so no two plucks are alike,
 * and every pluck plays one back. The body's resonance and the release (a finger lifting
 * off the fret, damping the string) are applied as it plays.
 */
export function plucked(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, o: Pluck): void {
  const { ctx } = k;
  const f = mtof(midi);
  const len = Math.min(dur + o.ring * 0.4, o.ring * 1.6);
  const end = t + len + 0.1;
  const hard = vel >= 0.6;
  const spec = {
    f,
    seconds: Math.min(3.4, o.ring * 1.6 + 0.2),
    pickAt: o.pickAt,
    bright: o.bright * (hard ? 1 : 0.6),
    decay: Math.max(0.6, Math.min(6, o.ring * 2.6 * (f / 196) ** -0.3)),
    mellow: Math.max(2, Math.round(o.mellow * 2.2)),
    pickup: o.pickup,
    noise: o.noise,
    top: o.top,
  };
  const buf = stringBuffer(ctx, spec, k.rng() < 0.5 ? 0 : 1);
  const body = ctx.createBiquadFilter();
  body.type = 'peaking';
  body.frequency.value = o.body;
  body.Q.value = 1.3;
  body.gain.value = 3.5;
  const amp = ctx.createGain();
  const level = o.level * PLUCK_LEVEL * pluckLevel(vel);
  amp.gain.setValueAtTime(level, t);
  amp.gain.setTargetAtTime(EPS, t + Math.max(0.1, dur), 0.06);
  body.connect(amp).connect(out);
  for (const cents of o.course ? [-o.course / 2, o.course / 2] : [0]) {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.detune.value = cents + (k.rng() - 0.5) * 3;
    if (o.slide) {
      const from = 2 ** (o.slide / 12);
      src.playbackRate.setValueAtTime(from, t);
      src.playbackRate.setValueAtTime(from, t + 0.03);
      src.playbackRate.exponentialRampToValueAtTime(1, t + 0.03 + (o.slideTime ?? 0.14));
    }
    if (o.wobble) vibrato(k, src.detune, t, end, 5.2, o.wobble, 0.25);
    src.connect(body);
    src.start(t);
    src.stop(end);
  }
}
/** The modelled strings' level against the voice they replaced. */
const PLUCK_LEVEL = 1.3;
/**
 * How loud a pluck is, by its velocity, whichever recording plays it (soft and hard are
 * brought to the same loudness): in step with the velocity, 0.9 being 1, and below 0.45
 * falling away faster, as a soft pluck does.
 */
export function pluckLevel(vel: number): number {
  return vel >= 0.45 ? vel / 0.9 : 0.5 * (vel / 0.45) ** 1.5;
}

/**
 * An electric guitar's string for the driven voices, modelled (lib/lofi-strings.ts):
 * picked hard near the bridge and heard by the bridge pickup, ringing long so the amp
 * can sustain it; palm-muted, the hand damps it to a short, dark thud. It plays at the
 * level a sawtooth used to, so the amps drive as they were tuned to.
 */
function electric(k: VoiceKit, f: number, t: number, end: number, vel: number, muted: boolean): AudioBufferSourceNode {
  const hard = vel >= 0.6;
  const spec = muted
    ? { f, seconds: 0.6, pickAt: 0.12, bright: hard ? 10 : 7, decay: 0.45, mellow: 3, pickup: 0.12, noise: 0.2, plane: 0.2 }
    : { f, seconds: end - t <= 1.2 ? 1.3 : 4.2, pickAt: 0.12, bright: hard ? 22 : 14, decay: 6, mellow: 12, pickup: 0.12, noise: 0.25 };
  const src = k.ctx.createBufferSource();
  src.buffer = stringBuffer(k.ctx, spec, k.rng() < 0.5 ? 0 : 1);
  src.start(t);
  src.stop(end);
  return src;
}
/** The modelled electric string's level into an amp, against the sawtooth it replaced. */
const ELECTRIC_DRIVE = 2.6;
/** The wah's level against its old waveform. */
const WAH_LEVEL = 1.4;

/**
 * Overdrive: a lead guitar through a cranked amp, the synthwave solo. Two saws a few
 * cents apart are driven hard into a clipper, then shaped by a cabinet (no lows below
 * about 110 Hz, a push around 1.7 kHz, no fizz above 4 kHz). Each note bends up into
 * its pitch from a semitone below, and vibrato comes in as the note holds.
 */
function overdrive(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art = 0): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.2;
  const [push, ws] = drivenBy(ctx, 5);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 110;
  const mid = ctx.createBiquadFilter();
  mid.type = 'peaking';
  mid.frequency.value = 1700;
  mid.Q.value = 1.2;
  mid.gain.value = 5;
  const cab = ctx.createBiquadFilter();
  cab.type = 'lowpass';
  cab.frequency.value = 4200;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.06 * vel, t + 0.012);
  amp.gain.setTargetAtTime(EPS, t + dur, 0.08);
  ws.connect(hp).connect(mid).connect(cab).connect(amp).connect(out);
  const drive = ctx.createGain();
  drive.gain.value = ELECTRIC_DRIVE;
  drive.connect(push);
  const attack = guitarAttack(art);
  for (const cents of [-6, 6]) {
    const s = electric(k, f, t, end, vel, false);
    s.playbackRate.setValueAtTime(attack.from, t);
    s.playbackRate.exponentialRampToValueAtTime(1, t + attack.time);   // bent, slid or picked into the note
    s.detune.value = cents;
    vibrato(k, s.detune, t, end, 5.5, 22, 0.28);
    s.connect(drive);
  }
}

/**
 * Synthwave: two bright saws and a square an octave down through a resonant low-pass
 * that sweeps open on each note, followed by two echoes (a third of a second apart,
 * each quieter), the eighties lead.
 */
function synthwave(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.15;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 4;
  lp.frequency.setValueAtTime(700, t);
  lp.frequency.exponentialRampToValueAtTime(3600, t + 0.06);
  lp.frequency.setTargetAtTime(2200, t + 0.1, 0.3);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.055 * vel, t + 0.01);
  amp.gain.setTargetAtTime(EPS, t + dur, 0.07);
  lp.connect(amp).connect(out);
  for (const [type, ratio, cents, level] of [['sawtooth', 1, -9, 1], ['sawtooth', 1, 9, 1], ['square', 0.5, 0, 0.5]] as const) {
    const o = osc(k, type, f * ratio, t, end);
    o.detune.value = cents;
    vibrato(k, o.detune, t, end, 5, 12, 0.3);
    const g = ctx.createGain();
    g.gain.value = level;
    o.connect(g).connect(lp);
  }
  for (const [delayS, level] of [[0.33, 0.32], [0.66, 0.14]] as const) {
    const d = ctx.createDelay(1);
    d.delayTime.value = delayS;
    const g = ctx.createGain();
    g.gain.value = level;
    amp.connect(d).connect(g).connect(out);
  }
}

/** Pulse lead: a thin 12.5% pulse that blips up an octave for its first moment, then holds with a little vibrato. */
function pulseLead(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.1;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 7000;
  const amp = ctx.createGain();
  struck(amp.gain, t, dur, 0.05 * vel, 0.003, 0.25, 0.75, 0.05);
  lp.connect(amp).connect(out);
  const o = pulseOsc(k, 0.125, f * 2, t, end);
  o.frequency.setValueAtTime(f, t + 0.03);
  vibrato(k, o.detune, t, end, 6, 14, 0.25);
  o.connect(lp);
}

/**
 * Angel: the soaring lead of the dance genres, voiceless though vocal. A saw and a sine an
 * octave above pass through two band-pass filters at an open "ah" (about 800 and 1200 Hz),
 * swell in, and gain a slow vibrato as they hold.
 */
function angel(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.5;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.11 * vel, t + 0.06);
  amp.gain.setTargetAtTime(EPS, t + dur, 0.18);
  const mix = ctx.createGain();
  mix.gain.value = 1;
  for (const [hz, q, level] of [[800, 3, 1], [1200, 4, 0.7], [2600, 5, 0.25]] as const) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = hz;
    bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = level;
    mix.connect(bp).connect(g).connect(amp);
  }
  const body = ctx.createGain();
  body.gain.value = 0.35;   // some of the plain tone under the formants, so it keeps its pitch
  mix.connect(body).connect(amp);
  amp.connect(out);
  const saw = osc(k, 'sawtooth', f, t, end);
  const sine = osc(k, 'sine', f * 2, t, end);
  const sg = ctx.createGain();
  sg.gain.value = 0.5;
  saw.connect(mix);
  sine.connect(sg).connect(mix);
  vibrato(k, saw.detune, t, end, 5.2, 16, 0.25);
  vibrato(k, sine.detune, t, end, 5.2, 16, 0.25);
}

/**
 * Chip: a soft chiptune lead for Lolly Sings. A square wave, rounded by a low-pass a few
 * harmonics up, that blips down into its pitch and gets a light vibrato as it holds -
 * the sound of an old console singing, not buzzing.
 */
function chip(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.2;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.min(9000, f * 5), t);
  lp.Q.value = 0.6;
  const amp = ctx.createGain();
  struck(amp.gain, t, dur, 0.06 * vel, 0.004, 0.35, 0.6, 0.06);
  lp.connect(amp).connect(out);
  const o = osc(k, 'square', f * 1.06, t, end);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.025);   // the blip down into pitch
  vibrato(k, o.detune, t, end, 5.8, 12, 0.3);
  o.connect(lp);
}

/** A vibrato (in cents) that eases in after the attack. */
export function vibrato(k: VoiceKit, target: AudioParam, t: number, end: number, rate: number, cents: number, delay: number): void {
  const lfo = osc(k, 'sine', rate, t, end);
  const depth = k.ctx.createGain();
  depth.gain.setValueAtTime(0, t);
  depth.gain.linearRampToValueAtTime(cents, t + delay);
  lfo.connect(depth).connect(target);
}

function vibes(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.5;
  const o = osc(k, 'sine', f, t, end);
  vibrato(k, o.detune, t, end, 5.1, 7, 0.35);
  const amp = ctx.createGain();
  struck(amp.gain, t, dur, 0.11 * vel, 0.012, 0.9, 0.45, 0.15);
  o.connect(amp).connect(out);
  const shimmer = osc(k, 'sine', f * 4, t, t + 0.32);
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(EPS, t);
  sg.gain.exponentialRampToValueAtTime(0.02 * vel, t + 0.004);
  sg.gain.exponentialRampToValueAtTime(EPS, t + 0.3);
  shimmer.connect(sg).connect(out);
}

/**
 * A flute: a near-pure tone whose upper harmonics come with the breath (louder is brighter)
 * and whose vibrato is mostly in those harmonics, a breath-pressure swell at about five a
 * second rather than a pitch wobble, as a real flute's is. A chiff of air as the note
 * speaks, unless it is slurred (`from`), when it glides from the last pitch instead.
 * Breath under the tone throughout. Everything runs until the fade is silent: a note cut
 * off mid-fade, or a broad band of breath, reads as static.
 */
function flute(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, from?: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.9;
  const amp = ctx.createGain();
  const peak = 0.085 * vel;
  amp.gain.setValueAtTime(from ? peak * 0.5 : EPS, t);
  amp.gain.exponentialRampToValueAtTime(peak, t + (from ? 0.03 : 0.08));
  amp.gain.setTargetAtTime(EPS, t + Math.max(0.1, dur), 0.12);
  amp.connect(out);
  const fromHz = from ? mtof(from) : undefined;
  const o = waveOsc(k, spectrumWave(ctx, 'flute1', 1, () => 1), f, t, end, fromHz);
  vibrato(k, o.detune, t, end, 4.9, 3, 0.3);
  o.connect(amp);
  // The upper harmonics: their level follows the breath, and swells with the vibrato.
  const upper = waveOsc(k, spectrumWave(ctx, 'flute-upper', 6, (n) => (n === 1 ? 0 : fromDb(-9 * (n - 1) - 1))), f, t, end, fromHz);
  vibrato(k, upper.detune, t, end, 4.9, 3, 0.3);
  const ug = ctx.createGain();
  ug.gain.value = 0.25 + 0.75 * vel;
  vibrato(k, ug.gain, t, end, 4.9, 0.2 + 0.25 * vel, 0.25);
  upper.connect(ug).connect(amp);
  // The chiff: a puff of air on the second harmonic as the note speaks.
  if (!from) {
    const cbp = ctx.createBiquadFilter();
    cbp.type = 'bandpass';
    cbp.frequency.value = Math.min(9000, f * 2);
    cbp.Q.value = 3;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.5 * vel, t);
    cg.gain.exponentialRampToValueAtTime(EPS, t + 0.05);
    noiseAt(k, t, 0.06).connect(cbp).connect(cg).connect(amp);
  }
  // Breath: a narrow band on the note's own harmonic, always under the tone.
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = Math.min(9000, f * 2);
  bp.Q.value = 9;
  const breath = ctx.createGain();
  breath.gain.setValueAtTime(0, t);
  breath.gain.linearRampToValueAtTime(from ? 0.1 : 0.18, t + 0.08);
  breath.gain.setTargetAtTime(0.09, t + 0.1, 0.15);
  noiseAt(k, t, dur + 0.9).connect(bp).connect(breath).connect(amp);
}

/** A soft lead: a filtered saw that swells in, a little like a muted horn. */
function softLead(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.3;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.8;
  lp.frequency.setValueAtTime(f * 1.2, t);
  lp.frequency.exponentialRampToValueAtTime(f * 2.8, t + 0.08);
  lp.frequency.exponentialRampToValueAtTime(f * 1.8, t + 0.5);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.07 * vel, t + 0.045);
  amp.gain.setTargetAtTime(EPS, t + Math.max(0.06, dur), 0.08);
  lp.connect(amp).connect(out);
  const o = osc(k, 'sawtooth', f, t, end);
  vibrato(k, o.detune, t, end, 5.4, 8, 0.25);
  o.connect(lp);
}

/** Kalimba: a bright tine with an inharmonic overtone that dies fast. */
function kalimba(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  for (const [ratio, level, decay] of [[1, 0.13, 1.1], [5.4, 0.04, 0.09], [2.01, 0.02, 0.3]] as const) {
    const pf = f * ratio;
    if (pf > 12000) continue;
    const o = osc(k, 'sine', pf, t, t + decay + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(EPS, t);
    g.gain.exponentialRampToValueAtTime(level * vel, t + 0.002);
    g.gain.exponentialRampToValueAtTime(EPS, t + decay);
    o.connect(g).connect(out);
  }
}

// ── bass ──────────────────────────────────────────────────────────────────────

/**
 * A bass note. `mod` is the note's movement (LofiNote.mod): for a wobble or a growl the
 * filter's swing in Hz (the station turns cycles a beat into Hz), on a slap bass 1 for a
 * popped note.
 */
export function bass(style: LofiStyle['bass'], k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, mod = 0, tone: Tone = PLAIN_TONE): void {
  if (style === 'wobble') { wobble(k, out, t, midi, vel, dur, mod, tone); return; }
  if (style === 'growl') { growl(k, out, t, midi, vel, dur, mod, tone); return; }
  if (style === 'reese') { reese(k, out, t, midi, vel, dur, tone); return; }
  if (style === 'slap') { fmSlap(k, out, t, midi, vel, dur, Math.round(mod), tone); return; }
  if (style === 'screech') { screech(k, out, t, midi, vel, dur, mod, tone); return; }
  if (style === 'pulse') { pulseBass(k, out, t, midi, vel, dur, tone); return; }
  if (style === 'electro') { electro(k, out, t, midi, vel, dur, tone); return; }
  if (style === 'picked') { pickedBass(k, out, t, midi, vel, dur, tone); return; }
  if (style === 'upright') { upright(k, out, t, midi, vel, dur, tone); return; }
  if (style === 'croak') { stringSlap(k, out, t, midi, vel, dur, Math.round(mod), tone, true); return; }   // the raw, buzzy string: bubbling, sliding, bending
  if (style === 'eight') { eightOhEight(k, out, t, midi, vel, dur, mod >= 2, tone); return; }
  if (style === 'acid') { acid(k, out, t, midi, vel, dur, Math.round(mod), tone); return; }
  if (style === 'yidaki') { yidaki(k, out, t, midi, vel, dur, Math.round(mod), tone); return; }
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.3;
  const amp = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.connect(amp).connect(out);
  if (style === 'synth') {
    struck(amp.gain, t, dur, 0.24 * vel, 0.01, 0.5, 0.6, 0.06);
    lp.Q.value = 3;
    lp.frequency.setValueAtTime(950, t);
    lp.frequency.exponentialRampToValueAtTime(260, t + 0.3);
  } else {
    struck(amp.gain, t, dur, 0.34 * vel, 0.008, 0.5, 0.55, 0.06);
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(420, t + 0.25);
  }
  const layers: ReadonlyArray<readonly [OscillatorType, number]> = style === 'synth'
    ? [['sawtooth', 0.6], ['sine', 1]]
    : [['sine', 1], ['triangle', 0.35]];
  for (const [type, level] of layers) {
    const o = osc(k, type, f * 1.015, t, end);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.03);   // the pluck settles into pitch
    const g = ctx.createGain();
    g.gain.value = level;
    o.connect(g).connect(lp);
  }
}

/** A dance tune's tone (LofiStyle.bright and drive): filter brightness and how hard the bass is driven. */
export interface Tone { bright: number; drive: number }
export const PLAIN_TONE: Tone = { bright: 1, drive: 1 };

/** A pulse wave of `duty` (0.5 is a square) as a band-limited PeriodicWave, one per context and duty. */
const PULSES = new WeakMap<BaseAudioContext, Map<number, PeriodicWave>>();
function pulseWave(ctx: BaseAudioContext, duty: number): PeriodicWave {
  let byDuty = PULSES.get(ctx);
  if (!byDuty) { byDuty = new Map(); PULSES.set(ctx, byDuty); }
  let wave = byDuty.get(duty);
  if (!wave) {
    const n = 48;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let h = 1; h < n; h++) real[h] = (2 / (h * Math.PI)) * Math.sin(h * Math.PI * duty);
    wave = ctx.createPeriodicWave(real, imag);
    byDuty.set(duty, wave);
  }
  return wave;
}

/** An oscillator playing a pulse of `duty` from `t` to `end`. */
function pulseOsc(k: VoiceKit, duty: number, f: number, t: number, end: number): OscillatorNode {
  const o = k.ctx.createOscillator();
  o.setPeriodicWave(pulseWave(k.ctx, duty));
  o.frequency.setValueAtTime(f, t);
  o.start(t);
  o.stop(end);
  return o;
}

/** A soft-clipping curve, for the dance basses' drive. */
const DRIVE = ((): Float32Array => {
  const c = new Float32Array(1024);
  for (let i = 0; i < c.length; i++) { const x = (i / (c.length - 1)) * 2 - 1; c[i] = Math.tanh(x * 2.5) / Math.tanh(2.5); }
  return c;
})();

function driven(ctx: BaseAudioContext): WaveShaperNode {
  const ws = ctx.createWaveShaper();
  ws.curve = DRIVE as Float32Array<ArrayBuffer>;
  // No oversampling: the drive only shapes bass, and oversampling every note's clipper
  // was a large share of the dance stations' cost.
  ws.oversample = 'none';
  return ws;
}

/** A gain of `amount` feeding a clipper: the drive stage, louder in means dirtier out.
 *  `clean` oversamples the clipper, for a hard-driven bass whose aliasing would sizzle. */
export function drivenBy(ctx: BaseAudioContext, amount: number, clean = false): [GainNode, WaveShaperNode] {
  const push = ctx.createGain();
  push.gain.value = amount;
  const ws = driven(ctx);
  if (clean) ws.oversample = '2x';
  push.connect(ws);
  return [push, ws];
}

/** A sine under a dance bass, an octave down when the note is high: what the low end feels. */
export function sub(k: VoiceKit, out: AudioNode, t: number, f: number, vel: number, dur: number): void {
  const g = k.ctx.createGain();
  g.gain.setValueAtTime(EPS, t);
  g.gain.exponentialRampToValueAtTime(0.42 * vel, t + 0.006);
  g.gain.setTargetAtTime(EPS, t + dur, 0.03);
  osc(k, 'sine', f > 70 ? f / 2 : f, t, t + dur + 0.2).connect(g).connect(out);
}

/** Wobble: a saw and a square through a resonant low-pass whose cutoff swings at `rate` Hz. */
function wobble(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, rate: number, tone: Tone): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.1;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 7;
  lp.frequency.value = 700 * tone.bright;
  const lfo = osc(k, 'sine', Math.max(0.5, rate), t, end);
  const depth = ctx.createGain();
  depth.gain.value = 620 * tone.bright;
  lfo.connect(depth).connect(lp.frequency);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.2 * vel, t + 0.005);
  amp.gain.setTargetAtTime(EPS, t + dur, 0.02);
  const [push, ws] = drivenBy(ctx, tone.drive);
  lp.connect(push);
  ws.connect(amp).connect(out);
  osc(k, 'sawtooth', f, t, end).connect(lp);
  const sq = osc(k, 'square', f, t, end);
  sq.detune.value = 7;
  const sg = ctx.createGain();
  sg.gain.value = 0.6;
  sq.connect(sg).connect(lp);
  sub(k, out, t, f, vel, dur);
}

/** Growl: a driven saw stack through two band-passes that sweep apart and back, a vowel that talks. */
function growl(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, rate: number, tone: Tone): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.08;
  const pre = ctx.createGain();
  pre.gain.value = 0.45 * tone.drive;
  const ws = driven(ctx);
  ws.oversample = '2x';   // a hard-driven growl aliases into a sizzle without it
  const fizz = ctx.createBiquadFilter();
  fizz.type = 'lowpass';
  fizz.frequency.value = 3600;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.24 * vel, t + 0.004);
  amp.gain.setTargetAtTime(EPS, t + dur, 0.015);
  const lfo = osc(k, 'triangle', Math.max(1, rate), t, end);
  for (const [hz, swing] of [[520, 380], [1500, -700]] as const) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = hz * tone.bright;
    bp.Q.value = 6;
    const d = ctx.createGain();
    d.gain.value = swing;
    lfo.connect(d).connect(bp.frequency);
    ws.connect(bp).connect(fizz);
  }
  fizz.connect(amp);
  pre.connect(ws);
  amp.connect(out);
  for (const cents of [-10, 0, 9]) {
    const o = osc(k, 'sawtooth', f * 1.04, t, end);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.05);   // a small "yoi" into pitch
    o.detune.value = cents;
    o.connect(pre);
  }
  sub(k, out, t, f, vel * 0.9, dur);
}

/**
 * Reese: three saws a few cents apart, so they beat against each other, under a slowly
 * moving low-pass, then driven hard into a clipper (the dirt) and smoothed after it so
 * the grit stays in the bass's range rather than fizzing.
 */
function reese(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, tone: Tone): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.15;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900 * tone.bright;
  lp.Q.value = 2;
  const drift = osc(k, 'sine', 0.3 + k.rng() * 0.2, t, end);
  const d = ctx.createGain();
  d.gain.value = 420;
  drift.connect(d).connect(lp.frequency);
  const push = ctx.createGain();
  push.gain.value = 1.3 * tone.drive;
  const smooth = ctx.createBiquadFilter();
  smooth.type = 'lowpass';
  smooth.frequency.value = 3200;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.13 * vel, t + 0.02);
  amp.gain.setTargetAtTime(EPS, t + dur, 0.05);
  lp.connect(push).connect(driven(ctx)).connect(smooth).connect(amp).connect(out);
  for (const cents of [-14, 0, 13]) {
    const o = osc(k, 'sawtooth', f, t, end);
    o.detune.value = cents;
    o.connect(lp);
  }
  sub(k, out, t, f, vel, dur);
}

/**
 * Slap: a plucked string, modelled the classic way (Karplus-Strong). A short burst of
 * noise runs round a delay line one period long, losing a little top on every trip
 * through a low-pass, so it rings and mellows like a real string. Because the pitch is
 * the delay's length, the note can move: `art` is how it is played (LofiNote.mod).
 *   0 thumb  the thumb hits the string against the frets: a bright thwack, then a round note
 *   1 pop    a finger snaps the string: a sharp, bright click and a ringing octave
 *   2 slide  comes up into the note from a fourth below
 *   3 bend   popped, then pushed up a tone and let back down
 *   4 dead   muted with the left hand: a percussive tick with no note at all
 * A sine under the string keeps the weight a modelled string loses as it decays. `raw`
 * is the croak: the same string left bright, buzzy and driven.
 */
function stringSlap(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art: number, tone: Tone, raw = false): void {
  const { ctx } = k;
  const f = mtof(midi);
  const pop = art === 1 || art === 3;
  // A dead note is a muted, percussive tick with no ringing string: a short pitched
  // buzz at bass pitch is the fart-like sound a dead note must never make.
  if (art === 4 && !raw) {
    const tick = ctx.createBiquadFilter();
    tick.type = 'bandpass';
    tick.frequency.value = 1600;
    tick.Q.value = 1.2;
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.16 * vel, t);
    tg.gain.exponentialRampToValueAtTime(EPS, t + 0.02);
    noiseAt(k, t, 0.025).connect(tick).connect(tg).connect(out);
    return;
  }
  const len = Math.max(0.12, Math.min(dur + 0.08, 0.8));
  const end = t + len + 0.05;
  // The string. A Web Audio loop holds at least one 128-frame block, which caps the
  // string at about 340 Hz; slap notes stay below that.
  const delay = ctx.createDelay(0.1);
  const period = (hz: number): number => Math.max(128 / ctx.sampleRate, 1 / hz);
  const pitch = delay.delayTime;
  if (art === 2) {
    pitch.setValueAtTime(period(f * 2 ** (-5 / 12)), t);
    pitch.linearRampToValueAtTime(period(f), t + (raw ? 0.07 : 0.035));
  } else if (art === 3) {
    pitch.setValueAtTime(period(f), t);
    pitch.linearRampToValueAtTime(period(f * 2 ** (2 / 12)), t + 0.09);
    pitch.linearRampToValueAtTime(period(f), t + 0.22);
  } else if (pop) {
    pitch.setValueAtTime(period(f * 1.012), t);
    pitch.linearRampToValueAtTime(period(f), t + 0.03);
  } else {
    pitch.setValueAtTime(period(f), t);
  }
  // Smooth by default: a darker string loop, a warmer strike, little drive and a
  // low-pass after the drive. The croak (`raw`) keeps the bright, buzzy, driven string on purpose.
  const damp = ctx.createBiquadFilter();
  damp.type = 'lowpass';
  damp.frequency.value = (raw ? (pop ? 7000 : 3200) : (pop ? 4500 : 1800)) * tone.bright;
  const keep = pop ? 0.993 : 0.99;
  const loop = ctx.createGain();
  loop.gain.setValueAtTime(keep, t);
  loop.gain.setValueAtTime(keep, t + len);
  loop.gain.linearRampToValueAtTime(0, t + len + 0.03);   // let go of the string
  delay.connect(damp).connect(loop).connect(delay);
  const excite = ctx.createBiquadFilter();
  excite.type = pop ? 'bandpass' : 'lowpass';
  excite.frequency.value = pop ? 3500 : raw ? 2600 : 1500;
  excite.Q.value = pop ? 0.9 : 0.7;
  const eg = ctx.createGain();
  eg.gain.setValueAtTime(pop ? 1.2 : 1, t);
  eg.gain.exponentialRampToValueAtTime(EPS, t + (pop ? 0.006 : 0.009));
  noiseAt(k, t, 0.012).connect(excite).connect(eg).connect(delay);
  // The string slapping the frets (or snapping back off them), heard directly.
  const fret = ctx.createBiquadFilter();
  fret.type = 'bandpass';
  fret.frequency.value = pop ? 4200 : 1900;
  fret.Q.value = 1.4;
  const fg = ctx.createGain();
  fg.gain.setValueAtTime((pop ? 0.2 : 0.12) * vel, t);
  fg.gain.exponentialRampToValueAtTime(EPS, t + (pop ? 0.004 : 0.008));
  noiseAt(k, t, 0.01).connect(fret).connect(fg).connect(out);
  const [push, ws] = drivenBy(ctx, raw ? 1.4 : 0.7);
  const smooth = ctx.createBiquadFilter();
  smooth.type = 'lowpass';
  smooth.frequency.value = raw ? 9000 : pop ? 5000 : 2600;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime((pop ? 0.5 : raw ? 0.6 : 0.42) * vel, t);
  amp.gain.setTargetAtTime(EPS, t + len, 0.03);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 35;
  delay.connect(hp).connect(push);
  ws.connect(smooth).connect(amp).connect(out);
  // The weight under the string, following its slides and bends: a bigger share of the
  // sound when smooth.
  const body = osc(k, 'sine', f, t, end);
  if (art === 2) {
    body.frequency.setValueAtTime(f * 2 ** (-5 / 12), t);
    body.frequency.linearRampToValueAtTime(f, t + (raw ? 0.07 : 0.035));
  } else if (art === 3) {
    body.frequency.linearRampToValueAtTime(f * 2 ** (2 / 12), t + 0.09);
    body.frequency.linearRampToValueAtTime(f, t + 0.22);
  }
  const bg = ctx.createGain();
  struck(bg.gain, t, len, (pop ? 0.16 : raw ? 0.26 : 0.34) * vel, 0.003, 0.2, 0.5, 0.03);
  body.connect(bg).connect(out);
}

/**
 * Slap: an FM slap bass, the synth slap of funk records and of the old consoles' bass
 * channels. A sine carrier is frequency-modulated by a sine at the same pitch (a thumb)
 * or three times it (a pop, more metallic); the modulation snaps deep at the strike and
 * decays fast, which is the twang, then the note settles round. A slight pitch drop on
 * the strike, an amp's scooped mids and a fret click finish the sound. `art` is how it is played
 * (LofiNote.mod): 0 thumb, 1 pop, 2 slide up from a fourth below, 3 pop bent up a tone and
 * back, 4 a dead note, an unpitched tick.
 */
function fmSlap(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art: number, tone: Tone): void {
  const { ctx } = k;
  const f = mtof(midi);
  const pop = art === 1 || art === 3;
  const click = (hz: number, level: number, len: number): void => {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = hz;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level * vel, t);
    g.gain.exponentialRampToValueAtTime(EPS, t + len);
    noiseAt(k, t, len + 0.005).connect(bp).connect(g).connect(out);
  };
  if (art === 4) { click(1600, 0.16, 0.02); return; }
  const len = Math.max(0.1, Math.min(dur + 0.06, 0.9));
  const end = t + len + 0.05;
  const carrier = osc(k, 'sine', f, t, end);
  const mod = osc(k, 'sine', f * (pop ? 3 : 1), t, end);
  // The pitch: a slight drop on the strike, a slide up from a fourth below, or a bend.
  const glide = (p: AudioParam, ratio: number): void => {
    if (art === 2) {
      p.setValueAtTime(f * ratio * 2 ** (-5 / 12), t);
      p.exponentialRampToValueAtTime(f * ratio, t + 0.045);
    } else if (art === 3) {
      p.setValueAtTime(f * ratio, t);
      p.exponentialRampToValueAtTime(f * ratio * 2 ** (2 / 12), t + 0.09);
      p.exponentialRampToValueAtTime(f * ratio, t + 0.22);
    } else {
      p.setValueAtTime(f * ratio * 1.012, t);
      p.exponentialRampToValueAtTime(f * ratio, t + 0.025);
    }
  };
  glide(carrier.frequency, 1);
  glide(mod.frequency, pop ? 3 : 1);
  const index = ctx.createGain();
  const deep = f * (pop ? 7 : 4.5) * tone.bright;
  index.gain.setValueAtTime(deep, t);
  index.gain.exponentialRampToValueAtTime(Math.max(1, f * 0.5), t + (pop ? 0.16 : 0.1));
  mod.connect(index).connect(carrier.frequency);
  // The amp: lows and top up, mids scooped.
  const lows = ctx.createBiquadFilter();
  lows.type = 'lowshelf';
  lows.frequency.value = 110;
  lows.gain.value = 3;
  const scoop = ctx.createBiquadFilter();
  scoop.type = 'peaking';
  scoop.frequency.value = 700;
  scoop.Q.value = 0.9;
  scoop.gain.value = -4;
  const top = ctx.createBiquadFilter();
  top.type = 'highshelf';
  top.frequency.value = 2800;
  top.gain.value = 3;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime((pop ? 0.34 : 0.4) * vel, t + 0.002);
  amp.gain.exponentialRampToValueAtTime((pop ? 0.2 : 0.26) * vel, t + 0.15);
  amp.gain.setTargetAtTime(EPS, t + len, 0.03);
  carrier.connect(lows).connect(scoop).connect(top).connect(amp).connect(out);
  click(pop ? 4200 : 1900, pop ? 0.14 : 0.1, pop ? 0.004 : 0.007);
}

/**
 * Acid: a 303-style line. A saw through a very resonant low-pass whose envelope snaps
 * open on each note and closes again (the squelch), wider on an accent (`art` 1); a slide
 * (`art` 2) glides up into the note without striking the filter again. Driven a little.
 */
function acid(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art: number, tone: Tone): void {
  const { ctx } = k;
  const f = mtof(midi);
  const accent = art === 1;
  const slide = art === 2;
  const len = Math.max(0.08, dur);
  const end = t + len + 0.06;
  const o = osc(k, 'sawtooth', slide ? f * 2 ** (-2 / 12) : f, t, end);
  if (slide) o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 14;
  const base = 260 * tone.bright;
  const peak = (accent ? 3200 : 1800) * tone.bright;
  lp.frequency.setValueAtTime(slide ? base * 2 : peak, t);
  lp.frequency.exponentialRampToValueAtTime(base, t + (accent ? 0.25 : 0.16));
  const [push, ws] = drivenBy(ctx, 0.9 * tone.drive);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime((accent ? 0.2 : 0.15) * vel, t + 0.004);
  amp.gain.setTargetAtTime(EPS, t + len, 0.02);
  o.connect(lp).connect(push);
  ws.connect(amp).connect(out);
}

/**
 * Screech: an FM cry. A saw is frequency-modulated by a sine at one and a half times its
 * pitch; the modulation depth and a peaky band-pass both swing at `rate`, then the lot
 * is driven hard. Mid-range and aggressive, with a sine under it for the low end.
 */
function screech(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, rate: number, tone: Tone): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.06;
  const carrier = osc(k, 'sawtooth', f * 1.06, t, end);
  carrier.frequency.exponentialRampToValueAtTime(f, t + Math.min(0.12, dur * 0.5));   // a slide into the note
  const mod = osc(k, 'sine', f * 1.5, t, end);
  const index = ctx.createGain();
  index.gain.value = f * 2.2;
  const lfo = osc(k, 'triangle', Math.max(1, rate), t, end);
  const swing = ctx.createGain();
  swing.gain.value = f * 1.8;
  lfo.connect(swing).connect(index.gain);
  mod.connect(index).connect(carrier.frequency);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 4;
  bp.frequency.value = 1700 * tone.bright;
  const sweep = ctx.createGain();
  sweep.gain.value = 1100 * tone.bright;
  lfo.connect(sweep).connect(bp.frequency);
  const [push, ws] = drivenBy(ctx, 0.65 * tone.drive, true);
  const fizz = ctx.createBiquadFilter();
  fizz.type = 'lowpass';
  fizz.frequency.value = 4800;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.2 * vel, t + 0.004);
  amp.gain.setTargetAtTime(EPS, t + dur, 0.015);
  carrier.connect(push);
  ws.connect(bp).connect(fizz).connect(amp).connect(out);
  sub(k, out, t, f / 2, vel * 0.85, dur);
}

/** Pulse bass: a 25% pulse with a triangle an octave down, short and bright, like a console's bass channel. */
function pulseBass(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, tone: Tone): void {
  const { ctx } = k;
  const f = mtof(midi);
  const len = Math.max(0.06, Math.min(dur, 0.4));
  const end = t + len + 0.05;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 5000 * tone.bright;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.14 * vel, t + 0.002);
  amp.gain.setValueAtTime(0.14 * vel, t + len * 0.7);
  amp.gain.exponentialRampToValueAtTime(EPS, t + len);
  lp.connect(amp).connect(out);
  pulseOsc(k, 0.25, f, t, end).connect(lp);
  const tri = osc(k, 'triangle', f / 2, t, end);
  const tg = ctx.createGain();
  tg.gain.value = 1.4;
  tri.connect(tg).connect(lp);
}

/**
 * Electro: a saw and a square through a resonant low-pass that snaps shut (a wah on every
 * note), driven very hard and high-passed so the dirt sits in the mids, over a sine for the low end.
 */
function electro(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, tone: Tone): void {
  const { ctx } = k;
  const f = mtof(midi);
  const len = Math.max(0.08, dur);
  const end = t + len + 0.06;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 5;
  lp.frequency.setValueAtTime(3400 * tone.bright, t);
  lp.frequency.exponentialRampToValueAtTime(520 * tone.bright, t + Math.min(0.18, len));
  const [push, ws] = drivenBy(ctx, 1.1 * tone.drive);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 90;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.15 * vel, t + 0.003);
  amp.gain.setTargetAtTime(EPS, t + len, 0.02);
  lp.connect(push);
  ws.connect(hp).connect(amp).connect(out);
  osc(k, 'sawtooth', f, t, end).connect(lp);
  const sq = osc(k, 'square', f, t, end);
  sq.detune.value = -8;
  sq.connect(lp);
  sub(k, out, t, f, vel * 0.8, len);
}

/**
 * The 808: a sine that drops from about two octaves above into its note for the punch,
 * then holds long under the kick, a little driven so it carries on small speakers. A
 * slide comes up into the note from a fourth below.
 */
function eightOhEight(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, slide: boolean, tone: Tone): void {
  const { ctx } = k;
  const f = mtof(midi);
  const len = Math.max(0.2, dur);
  const end = t + len + 0.15;
  const o = osc(k, 'sine', slide ? f * 2 ** (-5 / 12) : f * 3.5, t, end);
  if (slide) o.frequency.exponentialRampToValueAtTime(f, t + 0.12);
  else o.frequency.exponentialRampToValueAtTime(f, t + 0.035);
  const [push, ws] = drivenBy(ctx, 0.8 * tone.drive);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.4 * vel, t + 0.004);
  amp.gain.setTargetAtTime(0.28 * vel, t + 0.05, 0.25);
  amp.gain.setTargetAtTime(EPS, t + len, 0.06);
  o.connect(push);
  ws.connect(amp).connect(out);
}

/**
 * Picked bass: a rock bass guitar played with a pick. A saw and a square through a
 * low-pass that snaps from bright to round on each note, over a sine for the weight,
 * with a little grit from the amp.
 */
function pickedBass(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, tone: Tone): void {
  const { ctx } = k;
  const f = mtof(midi);
  const len = Math.max(0.1, dur);
  const end = t + len + 0.08;
  // A steady, round tone with only a small brightening at the pick: a resonant filter
  // swept on every note (fast repeats especially) croaks, which is Sugar's sound, not rock's.
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.7;
  lp.frequency.setValueAtTime(1300 * tone.bright, t);
  lp.frequency.exponentialRampToValueAtTime(700 * tone.bright, t + 0.15);
  const [push, ws] = drivenBy(ctx, 0.4 * tone.drive);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.2 * vel, t + 0.004);
  amp.gain.setTargetAtTime(0.13 * vel, t + 0.05, 0.12);
  amp.gain.setTargetAtTime(EPS, t + len, 0.025);
  lp.connect(push);
  ws.connect(amp).connect(out);
  // The string, picked near the bridge and heard by the bridge pickup (lib/lofi-strings.ts).
  const string = ctx.createBufferSource();
  string.buffer = stringBuffer(ctx, { f, seconds: len < 0.5 ? 0.7 : 2.2, pickAt: 0.12, bright: vel >= 0.6 ? 16 : 10, decay: 3.5, mellow: 9, pickup: 0.16, noise: 0.25, top: 5000 }, k.rng() < 0.5 ? 0 : 1);
  string.start(t);
  string.stop(end);
  const sg = ctx.createGain();
  sg.gain.value = PICKED_DRIVE;
  string.connect(sg).connect(lp);
  sub(k, out, t, f, vel * 0.7, len);
}
/** The picked bass's string into its amp, at the level the sawtooth and square used to drive the amp. */
const PICKED_DRIVE = 3.6;

/**
 * An upright bass, plucked (pizzicato), modelled (lib/lofi-strings.ts): a long, heavy
 * string plucked with the side of a finger near the end of the fingerboard, so the top
 * dies almost at once and the low end blooms and rings, through the big body's warmth
 * around 100 Hz and the wood's growl near 700 Hz. The finger slapping the string onto the
 * fingerboard thumps the start of every note, and the note stops when the hand lets go.
 */
function upright(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, tone: Tone): void {
  const { ctx } = k;
  const f = mtof(midi);
  const hard = vel >= 0.6;
  const string = ctx.createBufferSource();
  string.buffer = stringBuffer(ctx, { f, seconds: 2.4, pickAt: 0.22, bright: hard ? 9 : 6, decay: 2.6, mellow: 5, noise: 0.12, plane: 0.5, top: 2600 * tone.bright }, k.rng() < 0.5 ? 0 : 1);
  string.detune.value = (k.rng() - 0.5) * 6;
  const body = ctx.createBiquadFilter();
  body.type = 'peaking';
  body.frequency.value = 105;
  body.Q.value = 1.1;
  body.gain.value = 4;
  const growl = ctx.createBiquadFilter();
  growl.type = 'peaking';
  growl.frequency.value = 720;
  growl.Q.value = 1.4;
  growl.gain.value = 2.5;
  const amp = ctx.createGain();
  const level = UPRIGHT_LEVEL * pluckLevel(vel);
  amp.gain.setValueAtTime(level, t);
  amp.gain.setTargetAtTime(EPS, t + Math.max(0.08, dur), 0.05);
  string.connect(body).connect(growl).connect(amp).connect(out);
  string.start(t);
  string.stop(t + Math.max(0.08, dur) + 0.4);
  // The thump of the finger and the string meeting the fingerboard.
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.1 * vel, t);
  tg.gain.exponentialRampToValueAtTime(EPS, t + 0.03);
  const thump = ctx.createBiquadFilter();
  thump.type = 'lowpass';
  thump.frequency.value = 300;
  noiseAt(k, t, 0.04).connect(thump).connect(tg).connect(out);
}
/** The modelled upright's level against the voice it replaced. */
const UPRIGHT_LEVEL = 0.84;


// ── effects ──────────────────────────────────────────────────────────────────

/**
 * Soar: a wide bass layer an octave over the bass. Four detuned saws glide up into the
 * note through a low-pass that opens as the note holds: slowly and far in a build
 * (`climbing`), quickly to a warm middle in a drop.
 */
export function soar(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, climbing: boolean): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.3;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = climbing ? 3 : 1.2;
  lp.frequency.setValueAtTime(climbing ? 250 : 500, t);
  lp.frequency.exponentialRampToValueAtTime(climbing ? 3200 : 1700, t + (climbing ? dur : 0.4));
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.055 * vel, t + (climbing ? dur * 0.6 : 0.08));
  amp.gain.setTargetAtTime(EPS, t + dur, 0.12);
  lp.connect(amp).connect(out);
  for (const cents of [-14, -5, 6, 15]) {
    const o = osc(k, 'sawtooth', f * 2 ** (-2 / 12), t, end);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.15);
    o.detune.value = cents;
    o.connect(lp);
  }
}

/**
 * A "hey!": a synthesised shout, no recording and no words. A breath of noise (the h)
 * leads into a saw through three vowel formants that glide from "e" towards "i" while
 * the pitch falls, the way a shout does. Two of them, a few cents and milliseconds apart,
 * so it sounds like a few people calling out together.
 */
export function hey(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, which = 0): void {
  if (which > 0 && SHOUTS[which]) { shout(k, out, t, midi, vel, SHOUTS[which]!); return; }
  const { ctx } = k;
  const f = mtof(midi);
  // Held long enough to ring out, three voices a little apart: a few people calling.
  const len = 0.5;
  for (const [delay, cents] of [[0, 0], [0.018, 14], [0.032, -11]] as const) {
    const at = t + delay;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(EPS, at);
    amp.gain.setValueAtTime(EPS, at + 0.03);
    amp.gain.exponentialRampToValueAtTime(0.27 * vel, at + 0.065);
    amp.gain.exponentialRampToValueAtTime(EPS, at + len);
    const glottis = osc(k, 'sawtooth', f * 1.1, at, at + len + 0.05);
    glottis.frequency.exponentialRampToValueAtTime(f * 0.86, at + len);
    glottis.detune.value = cents;
    for (const [from, to, q, level] of [[620, 360, 8, 1], [1800, 2250, 10, 0.55], [2600, 3000, 12, 0.3]] as const) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = q;
      bp.frequency.setValueAtTime(from, at + 0.03);
      bp.frequency.linearRampToValueAtTime(to, at + len);
      const g = ctx.createGain();
      g.gain.value = level;
      glottis.connect(bp).connect(g).connect(amp);
    }
    amp.connect(out);
    // The h: breath shaped by the same mouth, before the voice starts.
    const h = ctx.createBiquadFilter();
    h.type = 'bandpass';
    h.frequency.value = 1700;
    h.Q.value = 1.5;
    const hg = ctx.createGain();
    hg.gain.setValueAtTime(EPS, at);
    hg.gain.exponentialRampToValueAtTime(0.09 * vel, at + 0.02);
    hg.gain.exponentialRampToValueAtTime(EPS, at + 0.08);
    noiseAt(k, at, 0.1).connect(h).connect(hg).connect(out);
  }
}

/** A shout's shape: its length, how it starts, its pitch at the start, middle and end (times
 *  the note), and its vowel moving through [fraction of the way, F1, F2, F3]. */
interface Shout {
  len: number;
  onset: 'h' | 'glide' | 'none';
  pitch: readonly [number, number, number];
  vowels: ReadonlyArray<readonly [number, number, number, number]>;
}
/** The shouts after "hey", by LOFI_SHOUTS: yeah, woo, oh, ayy, uh, ugh (low and short, from the throat), whoa (oo opening to oh) and yo. */
const SHOUTS: ReadonlyArray<Shout | null> = [
  null,
  { len: 0.42, onset: 'glide', pitch: [1.12, 1.05, 0.8], vowels: [[0, 300, 2300, 3000], [0.25, 530, 1850, 2550], [0.55, 760, 1300, 2600], [1, 740, 1250, 2600]] },
  { len: 0.55, onset: 'glide', pitch: [0.88, 1.38, 1.12], vowels: [[0, 300, 750, 2300], [0.5, 380, 850, 2400], [1, 470, 900, 2500]] },
  { len: 0.36, onset: 'h', pitch: [1.08, 1, 0.86], vowels: [[0, 520, 880, 2550], [1, 430, 820, 2500]] },
  { len: 0.46, onset: 'none', pitch: [1, 1.04, 1.08], vowels: [[0, 760, 1350, 2600], [0.45, 600, 1900, 2600], [1, 360, 2300, 3000]] },
  { len: 0.17, onset: 'h', pitch: [1.1, 1, 0.82], vowels: [[0, 640, 1190, 2390], [1, 600, 1150, 2400]] },
  { len: 0.22, onset: 'none', pitch: [0.82, 0.76, 0.7], vowels: [[0, 600, 1100, 2350], [1, 520, 1000, 2300]] },
  { len: 0.6, onset: 'glide', pitch: [0.95, 1.2, 1], vowels: [[0, 320, 760, 2300], [0.35, 560, 920, 2450], [1, 470, 860, 2450]] },
  { len: 0.3, onset: 'glide', pitch: [1.05, 1.08, 0.92], vowels: [[0, 280, 2200, 3000], [0.3, 500, 900, 2450], [1, 450, 820, 2450]] },
];

/**
 * A shout other than "hey" (Sherbert's yeah, woo, oh, ayy and uh): built as the "hey" is,
 * a saw through three formants, but each with its own vowel moving (yeah from ee through
 * eh to ah, woo from oo to oh, ayy from ah to ee) and its own pitch (a woo whoops up and
 * falls back). Two voices a little apart in time, pitch and place, a few people calling.
 */
function shout(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, sh: Shout): void {
  const { ctx } = k;
  const f = mtof(midi);
  const { len } = sh;
  for (const [delay, cents, pan] of [[0, 0, -0.25], [0.018, 14, 0.25]] as const) {
    const at = t + delay;
    const start = at + (sh.onset === 'h' ? 0.03 : 0);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(EPS, at);
    amp.gain.setValueAtTime(EPS, start);
    amp.gain.exponentialRampToValueAtTime(0.28 * vel, start + (sh.onset === 'glide' ? 0.045 : 0.018));
    amp.gain.setTargetAtTime(0.23 * vel, start + 0.06, len * 0.4);
    amp.gain.setTargetAtTime(EPS, start + len * 0.8, len * 0.12);
    const side = ctx.createStereoPanner();
    side.pan.value = pan;
    amp.connect(side).connect(out);
    const glottis = osc(k, 'sawtooth', f * sh.pitch[0], start, start + len + 0.1);
    glottis.detune.value = cents;
    glottis.frequency.linearRampToValueAtTime(f * sh.pitch[1], start + len * 0.45);
    glottis.frequency.linearRampToValueAtTime(f * sh.pitch[2], start + len);
    for (const [band, q, level] of [[1, 8, 1], [2, 10, 0.55], [3, 12, 0.3]] as const) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = q;
      sh.vowels.forEach((v, n) => {
        if (n === 0) bp.frequency.setValueAtTime(v[band], start);
        else bp.frequency.linearRampToValueAtTime(v[band], start + v[0] * len);
      });
      const g = ctx.createGain();
      g.gain.value = level;
      glottis.connect(bp).connect(g).connect(amp);
    }
    if (sh.onset === 'h') {
      const h = ctx.createBiquadFilter();
      h.type = 'bandpass';
      h.frequency.value = 1700;
      h.Q.value = 1.5;
      const hg = ctx.createGain();
      hg.gain.setValueAtTime(EPS, at);
      hg.gain.exponentialRampToValueAtTime(0.09 * vel, at + 0.02);
      hg.gain.exponentialRampToValueAtTime(EPS, at + 0.08);
      noiseAt(k, at, 0.1).connect(h).connect(hg).connect(out);
    }
  }
}

/**
 * A magpie's warble: two voices duetting in rising and falling glissandi, with fast
 * trills and a gurgle, on the notes of a pentatonic scale around `midi`. `song` seeds
 * the phrase, so a tune's magpie sings the same carol every time.
 */
export function magpie(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, song: number): void {
  const { ctx } = k;
  let seed = (song * 2654435761) >>> 0;
  const rand = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const scale = [0, 2, 4, 7, 9, 12, 14, 16];
  for (let voice = 0; voice < 2; voice++) {
    const start = t + voice * (0.12 + rand() * 0.25);
    const end = Math.min(t + dur, start + 0.6 + rand() * dur);
    if (end <= start + 0.2) continue;
    const o = osc(k, 'sine', mtof(midi), start, end + 0.05);
    const reed = osc(k, 'triangle', mtof(midi) * 2, start, end + 0.05);
    const rg = ctx.createGain();
    rg.gain.value = 0.12;
    reed.connect(rg);
    // The trill and the gurgle: fast vibrato that comes and goes.
    const trill = osc(k, 'sine', 22 + rand() * 14, start, end + 0.05);
    const depth = ctx.createGain();
    depth.gain.value = 0;
    trill.connect(depth);
    depth.connect(o.detune);
    depth.connect(reed.detune);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(EPS, start);
    o.connect(amp);
    rg.connect(amp);
    amp.connect(out);
    let at = start;
    while (at < end - 0.06) {
      const step = 0.07 + rand() * 0.16;
      const note = midi + (voice ? -5 : 0) + scale[Math.floor(rand() * scale.length)]!;
      const f = mtof(note);
      // A glide into each note, sometimes a long swoop, then a short hold.
      o.frequency.exponentialRampToValueAtTime(f, at + step * (rand() < 0.3 ? 0.9 : 0.4));
      reed.frequency.exponentialRampToValueAtTime(f * 2, at + step * 0.5);
      depth.gain.setValueAtTime(rand() < 0.35 ? 45 : 0, at);
      amp.gain.setTargetAtTime((0.05 + rand() * 0.04) * vel, at, 0.012);
      if (rand() < 0.25) amp.gain.setTargetAtTime(EPS, at + step * 0.8, 0.01);   // a gap between notes
      at += step;
    }
    amp.gain.setTargetAtTime(EPS, end, 0.03);
  }
}

/** The yidaki player's mouth shapes, as the first two formants: oo, oh, ah, ee. */
const VOWELS: ReadonlyArray<readonly [number, number]> = [[300, 870], [460, 820], [700, 1150], [330, 1900]];

/**
 * A yidaki (didgeridoo): the lips' buzz on one low note, shaped by the mouth like a voice.
 * Each note takes one of four mouth shapes, and the harder it is blown (`vel`) the
 * narrower the buzz and the brighter and grittier the tone. `art` is how the breath is
 * used: 0 a steady drone that drifts, 1 a "wa" (the mouth opening and closing, the pulse
 * that drives the rhythm), 2 a toot (the overblown note), 3 a bark (a shout into the
 * horn), 4 the in-breath (circular breathing: the drone dips, a sniff, then the cheeks
 * push it back hard) and 5 a howl (the player's voice sung through the drone, beating
 * against the drone). The notes overlap a little, so the drone is unbroken.
 */
function yidaki(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art: number, tone: Tone): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.12;
  const [v1, v2] = VOWELS[Math.floor(k.rng() * VOWELS.length)]!;
  const lips = pulseOsc(k, Math.max(0.08, 0.24 - 0.14 * vel), f, t, end);
  lips.detune.setValueAtTime((k.rng() - 0.5) * 10, t);
  const mix = ctx.createGain();
  const formant = (shape: number, open: number, q: number, level: number): void => {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = q;
    if (art === 1 || art === 3 || art === 4) {
      // From nearly closed, open to the vowel, and part way back.
      bp.frequency.setValueAtTime(shape * 0.7, t);
      bp.frequency.exponentialRampToValueAtTime(open, t + (art === 4 ? 0.14 : 0.07));
      bp.frequency.exponentialRampToValueAtTime(shape, t + Math.min(0.32, dur * 0.8 + 0.05));
    } else {
      bp.frequency.setValueAtTime(shape, t);
      bp.frequency.linearRampToValueAtTime(shape * (0.9 + k.rng() * 0.25), t + Math.max(0.1, dur));   // the drone drifts
    }
    const g = ctx.createGain();
    g.gain.value = level;
    lips.connect(bp).connect(g).connect(mix);
  };
  formant(v1, Math.max(v1 * 1.8, 650), 3.5, 1.4);
  formant(v2, v2 * 1.6, 5, 0.9);
  formant(2400, 2700, 7, 0.25 + 0.35 * vel);
  // The bore's fundamental, the weight under the buzz.
  const body = osc(k, 'sine', f, t, end);
  const bodyG = ctx.createGain();
  bodyG.gain.value = 0.5;
  body.connect(bodyG).connect(mix);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = Math.min(5500, (1500 + 2200 * vel) * tone.bright);
  const [push, shaper] = drivenBy(ctx, 0.8 + vel * 0.6 + (tone.drive - 1) * 0.4);
  const amp = ctx.createGain();
  const level = 0.42 * vel;
  const hold = art === 1 ? level * 0.62 : level * 0.75;
  amp.gain.setValueAtTime(EPS, t);
  if (art === 1) {
    amp.gain.exponentialRampToValueAtTime(level, t + 0.02);
    amp.gain.exponentialRampToValueAtTime(hold, t + 0.18);
  } else if (art === 4) {
    // The in-breath: the drone sags while the nose draws air, then the cheeks push it back.
    amp.gain.exponentialRampToValueAtTime(level * 0.3, t + 0.03);
    amp.gain.setValueAtTime(level * 0.3, t + 0.1);
    amp.gain.exponentialRampToValueAtTime(level * 1.05, t + 0.16);
    amp.gain.exponentialRampToValueAtTime(hold, t + 0.32);
  } else {
    amp.gain.exponentialRampToValueAtTime(hold, t + 0.05);
  }
  amp.gain.setValueAtTime(hold, t + Math.max(0.33, dur));
  amp.gain.exponentialRampToValueAtTime(EPS, end);
  mix.connect(lp).connect(push);
  shaper.connect(amp).connect(out);
  if (art === 2) {
    // The toot: the horn overblown to its next resonance, a bright blare for a moment.
    const toot = osc(k, 'sawtooth', f * 2.62, t, t + Math.min(0.35, dur + 0.05));
    toot.frequency.setValueAtTime(f * 2.5, t);
    toot.frequency.exponentialRampToValueAtTime(f * 2.62, t + 0.04);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.min(1800, f * 7);
    bp.Q.value = 1.4;
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(EPS, t);
    tg.gain.exponentialRampToValueAtTime(0.16 * vel, t + 0.02);
    tg.gain.exponentialRampToValueAtTime(EPS, t + Math.min(0.33, dur + 0.03));
    toot.connect(bp).connect(tg).connect(out);
  }
  if (art === 3 || art === 4) {
    // A bark is voice and breath shouted in; the in-breath is a short sniff through the nose.
    const bp = ctx.createBiquadFilter();
    bp.type = art === 3 ? 'bandpass' : 'highpass';
    bp.frequency.value = art === 3 ? 650 : 1800;
    bp.Q.value = 1.2;
    const ng = ctx.createGain();
    const at = art === 3 ? t : t + 0.02;
    ng.gain.setValueAtTime(EPS, t);
    ng.gain.exponentialRampToValueAtTime((art === 3 ? 0.12 : 0.03) * vel, at + 0.015);
    ng.gain.exponentialRampToValueAtTime(EPS, at + (art === 3 ? 0.14 : 0.09));
    noiseAt(k, t, 0.15).connect(bp).connect(ng).connect(out);
  }
  if (art === 5) {
    // The howl: the voice a tenth above, sung into the horn, wavering and beating with the drone.
    const voice = osc(k, 'sawtooth', f * 2.5 * (1 + (k.rng() - 0.5) * 0.01), t, end);
    vibrato(k, voice.detune, t, end, 5.8, 25, 0.1);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = v2;
    bp.Q.value = 2;
    const vg = ctx.createGain();
    vg.gain.setValueAtTime(EPS, t);
    vg.gain.exponentialRampToValueAtTime(0.09 * vel, t + 0.12);
    vg.gain.setValueAtTime(0.09 * vel, t + Math.max(0.13, dur));
    vg.gain.exponentialRampToValueAtTime(EPS, end);
    voice.connect(bp).connect(vg).connect(out);
  }
}

/**
 * A kookaburra's laugh: chuckles that climb, break into the full cackle (the "koo" and
 * "kaa" alternating, high and harsh) and tumble away. Each syllable is a harsh tone
 * falling in pitch. `song` seeds the laugh, so the same tune laughs the same way.
 */
export function kookaburra(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, song: number): void {
  const { ctx } = k;
  let seed = (song * 2246822519) >>> 0;
  const rand = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const f0 = mtof(midi);
  // [syllables, pitch from, pitch to, gap, level] for each phase of the laugh.
  const phases: ReadonlyArray<readonly [number, number, number, number, number]> = [
    [4 + Math.floor(rand() * 3), 0.7, 0.85, 0.13, 0.45],
    [6 + Math.floor(rand() * 4), 0.9, 1.5, 0.08, 0.8],
    [6 + Math.floor(rand() * 5), 1.6, 1.7, 0.068, 1],
    [5 + Math.floor(rand() * 3), 1.3, 0.75, 0.11, 0.6],
  ];
  const total = phases.reduce((sum, [n, , , gap]) => sum + n * gap, 0);
  const end = t + total + 0.2;
  const o = osc(k, 'sawtooth', f0, t, end);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 450;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = f0 * 2;
  bp.Q.value = 1.1;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  o.connect(hp).connect(bp).connect(amp).connect(out);
  const rasp = ctx.createGain();
  rasp.gain.setValueAtTime(EPS, t);
  const rbp = ctx.createBiquadFilter();
  rbp.type = 'bandpass';
  rbp.frequency.value = f0 * 2.5;
  rbp.Q.value = 2;
  noiseAt(k, t, total + 0.2).connect(rbp).connect(rasp).connect(out);
  let at = t;
  for (const [count, from, to, gap, level] of phases) {
    for (let n = 0; n < count; n++) {
      const along = count > 1 ? n / (count - 1) : 0;
      const kaa = n % 2 === 1 && level === 1;   // the cackle alternates high and low
      const pitch = f0 * (from + (to - from) * along) * (kaa ? 1.18 : 1) * (0.97 + rand() * 0.06);
      o.frequency.setValueAtTime(pitch * 1.12, at);
      o.frequency.exponentialRampToValueAtTime(pitch * 0.78, at + gap * 0.7);
      const peak = 0.4 * vel * level;
      amp.gain.setValueAtTime(EPS, at);
      amp.gain.exponentialRampToValueAtTime(peak, at + 0.008);
      amp.gain.exponentialRampToValueAtTime(peak * 0.05, at + gap * 0.75);
      rasp.gain.setValueAtTime(EPS, at);
      rasp.gain.exponentialRampToValueAtTime(peak * 0.5, at + 0.006);
      rasp.gain.exponentialRampToValueAtTime(EPS, at + gap * 0.5);
      at += gap * (0.92 + rand() * 0.16);
    }
  }
  amp.gain.setTargetAtTime(EPS, at, 0.02);
}

/**
 * Cymbal metal, made once per context: six square waves at inharmonic ratios (the
 * classic drum machine's cymbal, tuned up so more of its energy falls in the cymbal's band) with
 * a little noise. Filtered, it rings like a cymbal where plain noise only hisses.
 */
const METALS = new WeakMap<BaseAudioContext, AudioBuffer>();
function metalBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buf = METALS.get(ctx);
  if (!buf) {
    const rate = ctx.sampleRate;
    const n = Math.floor(rate * 1.5);
    buf = ctx.createBuffer(1, n, rate);
    const d = buf.getChannelData(0);
    const freqs = [205.3, 304.4, 369.6, 522.7, 540, 800].map(f => f * 3);
    let seed = 0x2545f491;
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (const f of freqs) sum += (i * f / rate) % 1 < 0.5 ? 1 : -1;
      seed = (seed * 1664525 + 1013904223) >>> 0;
      d[i] = (sum / 6) * 0.8 + ((seed / 4294967296) * 2 - 1) * 0.2;
    }
    METALS.set(ctx, buf);
  }
  return buf;
}
export function metalAt(k: VoiceKit, t: number, dur: number, rate = 1): AudioBufferSourceNode {
  const src = k.ctx.createBufferSource();
  src.buffer = metalBuffer(k.ctx);
  src.loop = true;
  src.playbackRate.value = rate;
  src.start(t, k.rng() * 1.2);
  src.stop(t + dur + 0.02);
  return src;
}

/**
 * Hand percussion, by `kind` (LOFI_PERCUSSION's order): 0 an egg shaker, 1 a tambourine,
 * 2 a conga (pitched by `midi`), 3 a cowbell, 4 clapsticks.
 */
export function perc(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, kind: number): void {
  const { ctx } = k;
  const env = (peak: number, attack: number, len: number): GainNode => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(EPS, t);
    g.gain.exponentialRampToValueAtTime(peak * vel, t + attack);
    g.gain.exponentialRampToValueAtTime(EPS, t + len);
    g.connect(out);
    return g;
  };
  const band = (type: BiquadFilterType, hz: number, q: number): BiquadFilterNode => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = hz;
    f.Q.value = q;
    return f;
  };
  if (kind === 0) {
    // The egg: beads swishing in, a little after the hand moves.
    noiseAt(k, t, 0.08).connect(band('bandpass', 6200, 1.3)).connect(env(0.16, 0.014, 0.075));
  } else if (kind === 1) {
    // The tambourine: the jingles (cymbal metal, high) shimmering in two quick rattles.
    for (const [d, level] of [[0, 1], [0.012, 0.55], [0.027, 0.35]] as const) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(EPS, t + d);
      g.gain.exponentialRampToValueAtTime(0.2 * level * vel, t + d + 0.003);
      g.gain.exponentialRampToValueAtTime(EPS, t + d + 0.16);
      g.connect(out);
      metalAt(k, t + d, 0.18, 1.7).connect(band('highpass', 5500, 0.7)).connect(band('bandpass', 9000, 0.8)).connect(g);
    }
  } else if (kind === 2) {
    // A conga: the skin's tone falling into pitch, and the slap of the palm.
    const f = mtof(midi || 60);
    const skin = osc(k, 'sine', f * 1.15, t, t + 0.35);
    skin.frequency.exponentialRampToValueAtTime(f, t + 0.03);
    skin.connect(env(0.42, 0.003, midi > 62 ? 0.18 : 0.32));
    noiseAt(k, t, 0.03).connect(band('bandpass', 1600, 1.1)).connect(env(midi > 62 ? 0.3 : 0.14, 0.001, 0.03));
  } else if (kind === 3) {
    // The cowbell: two square tones a bent fifth apart, through the bell's band.
    const g = env(0.12, 0.002, 0.3);
    const bp = band('bandpass', 2400, 1.2);
    bp.connect(g);
    for (const hz of [587, 845]) pulseOsc(k, 0.5, hz, t, t + 0.32).connect(bp);
  } else {
    // Clapsticks: two hardwood sticks, a dry knock with a short woody ring.
    for (const [hz, level] of [[2150, 0.18], [3350, 0.08]] as const) osc(k, 'sine', hz, t, t + 0.06).connect(env(level, 0.001, 0.05));
    noiseAt(k, t, 0.012).connect(band('bandpass', 2600, 1.5)).connect(env(0.2, 0.001, 0.012));
  }
}


/** A riser: noise through a band-pass that climbs over `dur`, growing louder, cut dead at the end. */
export function riser(k: VoiceKit, out: AudioNode, t: number, vel: number, dur: number): void {
  const { ctx } = k;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 3;
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.exponentialRampToValueAtTime(9000, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.004, t);
  g.gain.exponentialRampToValueAtTime(0.14 * vel, t + dur);
  g.gain.setValueAtTime(EPS, t + dur + 0.01);
  noiseAt(k, t, dur + 0.02).connect(bp).connect(g).connect(out);
  const tone = osc(k, 'sawtooth', 110, t, t + dur + 0.02);
  tone.frequency.exponentialRampToValueAtTime(880, t + dur);
  const tl = ctx.createBiquadFilter();
  tl.type = 'lowpass';
  tl.frequency.value = 2400;
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(EPS, t);
  tg.gain.exponentialRampToValueAtTime(0.03 * vel, t + dur);
  tg.gain.setValueAtTime(EPS, t + dur + 0.01);
  tone.connect(tl).connect(tg).connect(out);
}

/**
 * A coin: a square blip at `midi`, then a held blip a fourth higher, ringing out, by
 * `kind` (LOFI_COINS): the classic, a long ring with a second voice a few cents off (a
 * coin that shimmers), an echo (the coin again and again, fading, as in a cave), or two
 * coins in quick succession. Struck harder, it is brighter and rings longer.
 */
export function coin(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, kind = 0): void {
  const one = (at: number, level: number, ring: number, cents = 0): void => {
    const g = k.ctx.createGain();
    g.gain.setValueAtTime(EPS, at);
    g.gain.exponentialRampToValueAtTime(0.07 * level, at + 0.003);
    g.gain.setValueAtTime(0.07 * level, at + 0.07);
    g.gain.exponentialRampToValueAtTime(EPS, at + ring);
    const lp = k.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 4000 + 5000 * vel;
    lp.connect(g).connect(out);
    const o = osc(k, 'square', mtof(midi), at, at + ring + 0.05);
    o.detune.value = cents;
    o.frequency.setValueAtTime(mtof(midi + 5), at + 0.07);
    o.connect(lp);
  };
  const ring = 0.35 + 0.3 * vel;
  if (kind === 1) { one(t, vel, ring * 2.6); one(t, vel * 0.5, ring * 2.6, 9); return; }
  if (kind === 2) { for (let n = 0; n < 4; n++) one(t + n * 0.16, vel * 0.55 ** n, ring); return; }
  if (kind === 3) { one(t, vel, ring * 0.6); one(t + 0.09, vel, ring); return; }
  one(t, vel, ring);
}

/** A console's level stepping down a frame at a time, from `peak` to silence over `len` seconds. */
function stepFall(g: AudioParam, t: number, len: number, peak: number): void {
  const frames = Math.max(2, Math.round(len / FRAME));
  for (let n = 0; n <= frames; n++) g.setValueAtTime(peak * Math.max(0, Math.round(15 * (1 - n / frames))) / 15, t + n * FRAME);
}

/**
 * Sparkle (Sherbert): an old console's chord on its one channel. The pulse takes the root,
 * the third (`third` semitones up) and the fifth in turn fifty times a second, so the ear
 * hears a glittering chord; it steps away a frame at a time, and an echo answers from the
 * other side.
 */
export function sparkle(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, third: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const len = Math.max(0.08, dur);
  const turns = [0, third, 7];
  const side = k.rng() < 0.5 ? -0.55 : 0.55;
  for (const [delay, level, pan] of [[0, 1, side], [0.14, 0.4, -side]] as const) {
    const at = t + delay;
    const o = pulseOsc(k, 0.125, f, at, at + len + 0.02);
    for (let n = 0, when = at; when < at + len; n++, when += 0.02) o.frequency.setValueAtTime(f * 2 ** (turns[n % 3]! / 12), when);
    const g = ctx.createGain();
    stepFall(g.gain, at, len, 0.03 * vel * level);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    o.connect(g).connect(p).connect(out);
  }
}

/**
 * Game (Sherbert): a console's sound effects, by `kind` (see LOFI_GAME_SOUNDS; 16 and up are
 * the same in a minor key): a jump sweeping up, a power-up running up the key's chord, a
 * power-down falling and wobbling, a bonus trill that climbs, a bounce (a spring's boing,
 * overshooting and settling), a menu's blip, a laser's pew and a warp sliding down and up;
 * a level-up's fanfare (the chord run up and the top note trilled), shrinking (a wobble
 * between two notes falling away) and growing (the same, rising), a 1-up's quick run up
 * the scale, and a gem's high sparkle. Pulse waves, their pitch and level stepped by the
 * frame.
 */
export function game(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, kind: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const third = kind >= 16 ? 3 : 4;
  const sound = kind % 16;
  const len = [0.22, 0.62, 0.7, 0.5, 0.45, 0.12, 0.2, 0.5, 0.95, 0.8, 0.8, 0.5, 0.35][sound] ?? 0.3;
  const duty = sound === 1 || sound === 4 || sound === 8 ? 0.5 : sound === 6 || sound === 12 ? 0.125 : 0.25;
  const o = pulseOsc(k, duty, f, t, t + len + 0.05);
  const frames = Math.round(len / FRAME);
  for (let n = 0; n < frames; n++) {
    let semis: number;
    if (sound === 0) semis = n * 1.6;   // the jump: up and up
    else if (sound === 1) semis = [0, third, 7, 12, 12 + third, 19, 24][Math.min(6, Math.floor(n / 3))]! + (n >= 21 && n % 2 ? 0.3 : 0);
    else if (sound === 2) semis = 24 - n * 0.9 + (n % 2 ? 0.6 : -0.6);   // the power-down: falling and wobbling
    else if (sound === 3) semis = 12 + [0, third, 7, 12][Math.min(3, Math.floor(n / 8))]! + (n % 2 ? 7 : 0);   // the bonus: a trill climbing
    else if (sound === 4) semis = 9 - 9 * Math.exp(-n / 5) * Math.cos(n * 1.1);   // the bounce: up past the note and settling, a spring
    else if (sound === 5) semis = n < 3 ? 24 : 31;   // the blip: two quick notes
    else if (sound === 6) semis = 10 + 30 * Math.exp(-n / 3);   // the laser: a fast fall
    else if (sound === 7) semis = 12 + 9 * Math.sin(n * 0.55) - n * 0.4;   // the warp: sliding down and up, sinking
    else if (sound === 8) semis = n < 16 ? [0, third, 7, 12][Math.floor(n / 4)]! : 12 + (n % 2 ? 7 : 4);   // the level-up: the chord, then the top trilled
    else if (sound === 9) semis = 12 - n * 0.55 + (n % 2 ? 0 : 7);   // shrinking: a wobble falling away
    else if (sound === 10) semis = n * 0.55 + (n % 2 ? 0 : 7);   // growing: the same, rising
    else if (sound === 11) semis = [12, 16, 19, 24, 21, 26][Math.min(5, Math.floor(n / 4))]!;   // the 1-up: a quick run up
    else semis = 31 + (n % 3) * 5;   // the gem: a high sparkle
    o.frequency.setValueAtTime(f * 2 ** (semis / 12), t + n * FRAME);
  }
  const g = ctx.createGain();
  stepFall(g.gain, t, len, 0.045 * vel);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 9000;
  o.connect(g).connect(lp).connect(out);
}

/**
 * A bass shot (the bass genres), by `shot` (see LOFI_BASS_SHOTS): the bwah, a saw and a
 * square an octave under it dropping into the note while a resonant filter is flung open
 * and swings shut; the yoi, the bass talking from oh to ee as its pitch scoops up; the
 * throat, a growl through an open vowel, its filter and level shaking `rate` times a
 * second; and the wub, a deep, round wobble at `rate`. Driven, over a sine for the weight.
 */
export function bwah(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, shot: number, rate: number, tone: Tone = PLAIN_TONE): void {
  const { ctx } = k;
  const f = mtof(midi);
  const len = Math.max(0.12, dur);
  const end = t + len + 0.1;
  const bright = tone.bright;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  const mouth = ctx.createGain();
  const [push, ws] = drivenBy(ctx, (shot === 3 ? 1.6 : 2.6) * tone.drive, true);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.13 * vel, t + 0.008);
  amp.gain.setTargetAtTime(0.1 * vel, t + 0.05, 0.2);
  amp.gain.setTargetAtTime(EPS, t + len, 0.03);
  lp.connect(mouth);
  mouth.connect(push);
  ws.connect(amp).connect(out);
  const saw = osc(k, 'sawtooth', f, t, end);
  const sq = osc(k, 'square', f / 2, t, end);
  const sg = ctx.createGain();
  sg.gain.value = 0.6;
  saw.connect(lp);
  sq.connect(sg).connect(lp);
  if (shot === 0) {
    // Bwah: the pitch drops in from a fifth up, the filter flies open and swings shut.
    for (const o of [saw, sq]) { const base = o === sq ? f / 2 : f; o.frequency.setValueAtTime(base * 1.5, t); o.frequency.exponentialRampToValueAtTime(base, t + 0.06); }
    lp.Q.value = 7;
    lp.frequency.setValueAtTime(220, t);
    lp.frequency.exponentialRampToValueAtTime(3600 * bright, t + 0.07);
    lp.frequency.exponentialRampToValueAtTime(380, t + len);
  } else if (shot === 1) {
    // Yoi: the pitch scoops up from a fourth below as the vowel opens from oh to ee.
    for (const o of [saw, sq]) { const base = o === sq ? f / 2 : f; o.frequency.setValueAtTime(base * 0.75, t); o.frequency.exponentialRampToValueAtTime(base, t + 0.09); }
    lp.Q.value = 2;
    lp.frequency.setValueAtTime(2600 * bright, t);
    formants(k, lp, mouth, t, len, [[450, 800], [300, 2200]]);
  } else {
    // Throat and wub: the filter and the level shake at `rate`, through an open vowel for the throat.
    const throat = shot === 2;
    lp.Q.value = throat ? 5 : 4;
    lp.frequency.setValueAtTime(throat ? 1300 * bright : 520, t);
    const lfo = osc(k, throat ? 'square' : 'sine', Math.max(0.5, rate), t, end);
    const depth = ctx.createGain();
    depth.gain.value = throat ? 1100 * bright : 420;
    lfo.connect(depth).connect(lp.frequency);
    if (throat) formants(k, lp, mouth, t, len, [[650, 1050], [700, 1150]]);
  }
  sub(k, out, t, f, vel * 0.8, len);
}

/** Two vowel formants from `from` to `to` ([F1, F2] each), sung between `src` and `dst`, with a little of the plain sound under them. */
function formants(k: VoiceKit, src: AudioNode, dst: AudioNode, t: number, len: number, [from, to]: ReadonlyArray<readonly [number, number]>): void {
  for (let n = 0; n < 2; n++) {
    const bp = k.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = n === 0 ? 4 : 6;
    bp.frequency.setValueAtTime(from![n]!, t);
    bp.frequency.linearRampToValueAtTime(to![n]!, t + len);
    const g = k.ctx.createGain();
    g.gain.value = n === 0 ? 1.4 : 1;
    src.connect(bp).connect(g).connect(dst);
  }
}

/**
 * A phaser sweep (Sherbert and the bass genres): two saws and a breath of noise through
 * four all-pass filters a side, mixed back with the dry sound so notches sweep through
 * it: rising across a build (`mode` 0, swelling), falling into a breakdown (1, fading),
 * or a quick zip (2). The left and right sweeps run a little apart, so it swirls.
 */
export function phaser(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, mode: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const len = mode === 2 ? Math.min(0.35, Math.max(0.15, dur)) : Math.max(0.3, dur);
  const end = t + len + 0.1;
  const src = ctx.createGain();
  for (const cents of [-12, 12]) {
    const o = osc(k, 'sawtooth', f, t, end);
    o.detune.value = cents;
    o.connect(src);
  }
  const ng = ctx.createGain();
  ng.gain.value = 0.25;
  noiseAt(k, t, len + 0.1).connect(ng).connect(src);
  const amp = ctx.createGain();
  const peak = 0.035 * vel;
  amp.gain.setValueAtTime(mode === 0 ? peak * 0.05 : peak, t);
  if (mode === 0) amp.gain.exponentialRampToValueAtTime(peak, t + len);
  else amp.gain.exponentialRampToValueAtTime(peak * 0.03, t + len);
  amp.gain.setValueAtTime(EPS, t + len + 0.01);
  amp.connect(out);
  const [lo, hi] = mode === 1 ? [6000, 220] : [220, mode === 2 ? 8000 : 6000];
  for (const [pan, offset] of [[-0.6, 1], [0.6, 1.3]] as const) {
    const side = ctx.createStereoPanner();
    side.pan.value = pan;
    side.connect(amp);
    src.connect(side);   // the dry half
    let at: AudioNode = src;
    for (let n = 0; n < 4; n++) {
      const ap = ctx.createBiquadFilter();
      ap.type = 'allpass';
      ap.Q.value = 0.7;
      ap.frequency.setValueAtTime(lo * offset, t);
      ap.frequency.exponentialRampToValueAtTime(hi * offset, t + len);
      at.connect(ap);
      at = ap;
    }
    at.connect(side);   // the swept half, summed with the dry: the notches
  }
}

/**
 * A blip (the bass genres): a short FM bleep in the gaps of a drop. `kind` 0 bleeps up,
 * 1 bloops down, 2 is a pair a fifth apart. A sine carrier with a modulator twice its
 * pitch, the brightness gone in a moment, placed a little to one side.
 */
export function blip(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, kind: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const side = ctx.createStereoPanner();
  side.pan.value = (k.rng() - 0.5) * 0.9;
  side.connect(out);
  const hits = kind === 2 ? [[0, 0], [0.07, 7]] as const : [[0, 0]] as const;
  for (const [delay, semis] of hits) {
    const at = t + delay;
    const p = f * 2 ** (semis / 12);
    const car = osc(k, 'sine', kind === 1 ? p * 1.5 : p, at, at + 0.12);
    car.frequency.exponentialRampToValueAtTime(kind === 1 ? p * 0.7 : kind === 0 ? p * 1.5 : p, at + 0.08);
    const mod = osc(k, 'sine', p * 2, at, at + 0.12);
    const idx = ctx.createGain();
    idx.gain.setValueAtTime(p * 2.5, at);
    idx.gain.exponentialRampToValueAtTime(p * 0.1, at + 0.06);
    mod.connect(idx).connect(car.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(EPS, at);
    g.gain.exponentialRampToValueAtTime(0.06 * vel, at + 0.004);
    g.gain.exponentialRampToValueAtTime(EPS, at + 0.09);
    car.connect(g).connect(side);
  }
}

// ── shared by the drums (lib/lofi-drums.ts) and the world percussion ─────────

/** A drum's hit: high-passed noise at full level at once, falling away in `len` seconds. */
export function crack(k: VoiceKit, out: AudioNode, t: number, peak: number, from: number, len: number): void {
  const hp = k.ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = from;
  hp.Q.value = 0.7;
  const g = k.ctx.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(EPS, t + len);
  noiseAt(k, t, len).connect(hp).connect(g).connect(out);
}

