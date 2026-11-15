// SPDX-License-Identifier: MPL-2.0
/**
 * Reed instruments blown, modelled: the saxophone and the clarinet as digital waveguides,
 * after Perry Cook's in the Synthesis ToolKit (the STK's Saxofony and Clarinet), worked out
 * in JS one note at a time and played back.
 *
 * The player's breath presses on a reed. The reed is a valve: the more the pressure across
 * it, the more it closes, so how much of the wave coming back up the bore it lets through
 * depends on that pressure (the reed table, clipped at fully open and fully shut). The bore
 * is a delay line the length of the note's period, with a little low-pass and an inverted
 * reflection at the bell, losing a few per cent each trip. The loop of breath, reed and
 * bore oscillates by itself, and how hard the player blows sets how far the reed beats and
 * so how bright the note is: a soft note is round, a hard one buzzes.
 *
 * - The saxophone's bore is a cone. Its waveguide is two delay lines in a loop, split at
 *   the mouthpiece's place along the cone, so every harmonic sounds (blowSax).
 * - The clarinet's is a cylinder, closed at the reed: one line, half the period long, so
 *   the odd harmonics lead in the low register, as they do on a real clarinet.
 *
 * The breath swells in over a few tens of milliseconds with a little noise in it, a held
 * note gets a jaw vibrato that comes in after a moment, a note slurred from the one before
 * glides there with no new attack, and a scooped note starts a semitone flat.
 *
 * The saxophone is played as a player plays one, fitted to recorded altos and tenors (the
 * University of Iowa's alto notes, the Philharmonia's alto notes and phrases, and pop and
 * jazz phrases from Freesound, all measured, none kept): the breath is turbulent and its
 * air is heard in the tone, more on a soft note (the subtone) than a loud one; a harder
 * note is brighter as well as louder; a tongued note speaks quickly when it is hard and
 * slowly when it is soft, with a puff of air as the tongue lets go; many notes fall into
 * pitch from a little flat; a held note's vibrato comes in late and grows; and a growled
 * note carries the player's hum (saxNote).
 *
 * Pure: no DOM, no Web Audio; deterministic for the same note and seed.
 */
import { airBurst, type BurstShape } from './lofi-breath.ts';

export interface ReedNote {
  sr: number;
  /** The note (Hz), and the one it slurs from, if any. */
  f: number; from?: number;
  /** How hard it is blown (0 to 1), how long it is held (s), and how long to render (s). */
  vel: number; dur: number; seconds: number;
  bore: 'cone' | 'cylinder';
  /** The jaw vibrato's depth (cents) and rate (Hz); a scoop up into the note (semitones, 0 none). */
  vibrato: number; rate: number; scoop: number;
  /** How quickly the breath swells in (s). */
  attack: number;
  /**
   * The saxophone's playing, each optional (the clarinet takes none of them): when the
   * vibrato starts and how long it takes to reach its depth (s); how many cents flat a
   * tongued note starts and how long it takes to settle (s); how much the player growls
   * (0 to 1); and how much breath is heard against the tone (1 as measured for the strength).
   */
  vibratoAt?: number; vibratoGrow?: number;
  fallIn?: number; fallTime?: number;
  growl?: number;
  air?: number;
}

/** A fractional delay line with linear interpolation, its length changeable every sample. */
class Line {
  private readonly buf: Float32Array;
  private at = 0;
  constructor(size: number) { this.buf = new Float32Array(size); }
  /** The sample `delay` samples ago. */
  read(delay: number): number {
    const d = Math.max(1, Math.min(this.buf.length - 2, delay));
    const whole = Math.floor(d);
    const frac = d - whole;
    const n = this.buf.length;
    const a = this.buf[(this.at - whole + n) % n]!;
    const b = this.buf[(this.at - whole - 1 + n) % n]!;
    return a + (b - a) * frac;
  }
  write(x: number): void {
    this.at = (this.at + 1) % this.buf.length;
    this.buf[this.at] = x;
  }
}

/**
 * The reed: how much of the returning wave it passes at a pressure difference, clipped
 * open and shut. The clarinet's closes as the pressure rises; the saxophone's waveguide,
 * whose loop takes the wave in the other sense, has the table the other way round (as in
 * the STK's own two instruments).
 */
const reed = (diff: number, slope: number): number => Math.max(-1, Math.min(1, REED_OFFSET + slope * diff));
const REED_OFFSET = 0.7;
const CLARINET_SLOPE = -0.3;
const SAX_SLOPE = 0.3;
/** The mouthpiece's place along the sax's cone, as a share of the loop (between two harmonics' nodes, so none is lost outright). */
const MOUTHPIECE = 0.23;
/** The loop's own delay (the filters'), taken off the period so the note is in tune; measured. */
const SAX_TRIM = 2.55;
const CLARINET_TRIM = 1.5;
/** How strongly the tongue sets the bore going (the wave it starts with, against the breath): the sax's cone takes a fuller start. */
const TONGUE = 0.25;
const SAX_TONGUE = 0.6;
/**
 * The sax's blowing pressure, soft to hard. In this waveguide the tone darkens and brightens
 * unevenly with pressure: below 0.55 the reed does not speak, from about 0.68 to 0.73 the
 * tone brightens with pressure as a played sax does (measured against an alto's mf and ff
 * notes), and above about 0.75 notes jump to the octave.
 */
const SAX_PRESSURE = [0.68, 0.73] as const;
/**
 * Above SAX_HIGH (MIDI) the loop jumps to the octave at a lower pressure, a little lower
 * each semitone: at 0.68 every note from G5 up sounded an octave high, and at 0.73 every
 * note from E5 up, so the old model played a tenth of the station's sax notes (those from
 * G#5) an octave high. The pressure's ceiling falls SAX_CEILING_STEP a semitone from there
 * (never under SAX_FLOOR), the band keeping its width (SAX_SPAN) down to SAX_SPEAKS, so
 * every note the lead plays, up to C6, speaks on its own pitch at every strength.
 */
const SAX_HIGH = 72, SAX_CEILING_STEP = 0.013, SAX_FLOOR = 0.6, SAX_SPAN = 0.05;
/** The least pressure that still speaks a top note on its own pitch (under it the reed stops or flips to the octave). */
const SAX_SPEAKS = 0.58;
/** The push of breath behind a tongued note as the tongue lets go of the reed (a share of the pressure), and how fast it settles (s). */
const SAX_PUSH = 0.25;
const SAX_PUSH_TIME = 0.05;
/** How long a scoop takes to rise into the note (s): the recorded scoops reach pitch in about 95 ms. */
const SCOOP_TIME = 0.11;
/**
 * How a tongued sax note's loudness rises, by strength: from 10 to 90 per cent of its held
 * level in SPEAK_HARD seconds blown hardest, SPEAK_HARD plus SPEAK_SOFT blown softest
 * (eased in between), never more than a share of the note (SPEAK_SHARE). Recorded altos:
 * 21 to 48 ms at ff, 36 to 58 at mf, 150 ms and more at pp. The note is worked out whole
 * before it plays, so its steady level is known and its first moments are brought to that
 * rise; the tone keeps building as it does.
 */
const SPEAK_HARD = 0.02, SPEAK_SOFT = 0.11, SPEAK_SHARE = 0.35;
/** A raised cosine's rise from 10 to 90 per cent takes this share of its length. */
const SPEAK_10_90 = 0.59;
/**
 * How much of a note is evened out to the rise (s, at least), and how far its steady level
 * is read to (s): the bore can take 50 to 150 ms to build to its held level, and its level
 * can dip by a third as the tongue's push dies away, where a played note keeps rising.
 */
const SPEAK_SHAPED = 0.35, SPEAK_STEADY = 0.7;
/** The most a moment of the rise is lifted (8 times, 18 dB): on a loud middle note the bore sits 20 dB under its held level for the first 40 ms. */
const SPEAK_MOST = 8;
/**
 * The 4th harmonic, lifted back (dB). Even heard at the bell, the loop sounds the harmonics
 * near 1 / MOUTHPIECE weakly, because the reed sits where they have a node: the 4th came out
 * about 10 dB under its neighbours, where a recorded alto's 3rd, 4th and 5th are about level.
 */
const SAX_FOURTH = 9;
/**
 * The horn's body, as peaks on the bell's wave (Hz, Q, dB), fitted to the recorded notes'
 * spectra against frequency (third-octave bins, each note's harmonics against its own
 * total): the old model sat 2 to 4 dB low from 400 to 630 Hz and 5 to 12 dB low from 800 Hz
 * to 2.5 kHz against the pop and jazz players (the edge a sax has and a synthesiser's tone
 * lacks), and 10 to 20 dB low above 5 kHz against the classical alto, where its bell's
 * low-pass took the top away. With these the model sits between the classical alto blown
 * loud and the pop players at mf, and with them blown hard.
 */
const SAX_BODY: ReadonlyArray<readonly ['peak', number, number, number]> = [
  ['peak', 520, 1.1, 2.5],
  ['peak', 1700, 0.7, 2.5],
  ['peak', 3300, 1.4, 2],
  ['peak', 6000, 0.8, 2],
];
/**
 * How much brighter a harder note is above 1 kHz (dB per unit of strength, about the middle
 * of the dynamics): recorded altos swelling on one note gain 1.3 to 2 dB above 1 kHz for each
 * dB they get louder in the low and middle registers, and the waveguide's own pressure gives
 * less than half of that.
 */
const SAX_BRIGHT = 16;
const SAX_BRIGHT_MID = 0.6;
/** The most a note is brightened (dB): past this the 2nd and 3rd harmonics stand 5 dB over the fundamental on the loudest middle notes, as far as a recorded alto's go. */
const SAX_BRIGHT_MOST = 4;
/**
 * The breath's turbulence in the bore (a share of the pressure, white), by strength: soft to
 * hard. More than this and the loop starts to jump to its twelfth on loud notes.
 */
const SAX_AIR = [0.07, 0.03] as const;
/**
 * The air heard in the tone (dB against the note), by strength, soft to hard: noise in the
 * band the reed's slit makes it (SAX_BREATH_BAND, Hz, and its width in octaves), pulsed by
 * the reed as it opens and shuts, so the air is part of the note and not a separate hiss. The
 * recorded players' noise between the harmonics, 2 to 8 kHz, sat 31 to 43 dB under the note
 * (pop and jazz 31 to 38, a classical alto 38 to 43, about the same at pp, mf and ff), where
 * the old model's sat 53 to 58. A soft note is a little airier; the subtone much more so.
 */
const SAX_BREATH = [-31.5, -36.5] as const, SAX_BREATH_BAND = 3000, SAX_BREATH_WIDTH = 2.2;
/**
 * How unsteady the breath is: slow pressure changes in the bore (a share, under
 * SAX_FLUTTER_HZ), no more than the loop takes without jumping to its twelfth, and the
 * flutter of the air column a player never holds still (SAX_SHIMMER of the note's level,
 * between SAX_SHIMMER_BAND Hz). Recorded notes' loudness moves 3 to 9 per cent between 15
 * and 90 Hz on a plain note; the old model's moved under 1 per cent.
 */
const SAX_FLUTTER = 0.025, SAX_FLUTTER_HZ = 12;
const SAX_SHIMMER = 0.025, SAX_SHIMMER_BAND = [12, 70] as const;
/**
 * The growl: the player hums into the horn while blowing, the hum (SAX_HUM Hz, drawn per note)
 * moving the breath by up to SAX_GROWL_DEPTH of itself. A growled note's loudness moves 20 to
 * 75 per cent between 15 and 90 Hz in the recorded solos (about one note in ten).
 */
const SAX_HUM = [48, 88] as const, SAX_GROWL_DEPTH = 0.2;
/** The hum's beat in the note's loudness (a share either way): the breath alone moves the waveguide's tone more than its level. */
const SAX_GROWL_BEAT = 0.5;
/** How far a player's pitch wanders while holding a note (cents, standard deviation): a recorded alto's held notes, 1.5 to 3. */
const WANDER = 2.2;
/**
 * How uneven the clarinet's reed is (the even harmonics it brings), in the low register and
 * above the break. Measured against recorded clarinets (the Philharmonia's B♭ clarinet at
 * pianissimo, forte and fortissimo, E3 to D6): in the chalumeau the odd harmonics lead, the
 * even ones 25 to 40 dB down, but from about C♯5 (concert) the second harmonic comes up to
 * within 0 to 25 dB of the first, as the tone holes stop the bore acting as a closed pipe
 * for the second harmonic. The evenness rises over CLARINET_EVEN_SPAN semitones from CLARINET_EVEN_FROM.
 */
const CLARINET_EVEN = 1;
const CLARINET_EVEN_HIGH = 3;
const CLARINET_EVEN_FROM = 73.3;
const CLARINET_EVEN_SPAN = 8;
/** The clarinet's breath pressure, softly and at full strength: a soft note's reed hardly beats, so its tone is nearly pure (recorded pianissimo notes above the break, the 3rd to 6th harmonics 25 to 60 dB down). */
const CLARINET_PRESSURE = [0.537, 0.755] as const;
/** What the bell and the room take off the top: two gentle low-passes at CLARINET_TOP Hz, lower by CLARINET_TOP_SOFT octaves per unit of strength under 0.5. */
const CLARINET_TOP = 7630;
const CLARINET_TOP_SOFT = 1.64;

/** Blow one note. A sax note is blown by blowSax; the clarinet's is here. */
export function blowReed(n: ReedNote, rand: () => number): Float32Array {
  if (n.bore === 'cone') return blowSax(n, rand);
  const { sr } = n;
  const out = new Float32Array(Math.ceil(n.seconds * sr));
  const lines = [new Line(Math.ceil(sr / 30) + 4), new Line(Math.ceil(sr / 30) + 4)];
  const pressure = CLARINET_PRESSURE[0] + (CLARINET_PRESSURE[1] - CLARINET_PRESSURE[0]) * n.vel;
  const midi = 69 + 12 * Math.log2(n.f / 440);
  const even = CLARINET_EVEN + (CLARINET_EVEN_HIGH - CLARINET_EVEN) * Math.min(1, Math.max(0, (midi - CLARINET_EVEN_FROM) / CLARINET_EVEN_SPAN));
  const attack = Math.max(1, n.attack * sr);
  const release = Math.round(n.dur * sr);
  const releaseLen = 0.07 * sr;
  const glide = n.from ? 0.05 * sr : n.scoop ? 0.08 * sr : 0;
  const start = n.from ?? (n.scoop ? n.f * 2 ** (-n.scoop / 12) : n.f);
  const vibratoFrom = Math.min(0.3, n.dur * 0.5) * sr;
  // The tongue: a player starts a note by releasing the reed against the tongue, which
  // sets the bore's fundamental going at once. Here the bore starts with a wave one period
  // long already in it, so a low note speaks in a few cycles instead of growing out of the
  // noise over a third of a second (and on the fundamental, not the octave).
  const seedPeriod = sr / start / 2;
  for (let i = 0; i < Math.ceil(seedPeriod); i++) {
    const v = Math.sin((2 * Math.PI * i) / seedPeriod) * TONGUE * pressure;
    lines[0]!.write(v);
    lines[1]!.write(-v * MOUTHPIECE);
  }
  let lp = 0, last = 0;
  let phase = rand() * Math.PI * 2;
  // The pitch's slow wander: noise smoothed to below about 3 Hz, scaled to WANDER cents.
  const drift = Math.exp((-2 * Math.PI * 3) / sr);
  const driftScale = WANDER / (0.577 * Math.sqrt((1 - drift) / (1 + drift)));
  let wander = 0;
  for (let i = 0; i < out.length; i++) {
    // The breath: swelling in (at once on a slur), held, let go, with a little noise.
    const swell = n.from ? Math.min(1, i / (0.012 * sr)) : Math.min(1, i / attack);
    const gone = i < release ? 1 : Math.max(0, 1 - (i - release) / releaseLen);
    const breath = pressure * swell * gone * (1 + (rand() * 2 - 1) * 0.06);
    // The pitch: gliding in from a slur or a scoop, then the jaw's vibrato once the note settles.
    const into = glide ? Math.min(1, i / glide) : 1;
    let f = start * (n.f / start) ** (into * into * (3 - 2 * into));
    wander = drift * wander + (1 - drift) * (rand() * 2 - 1);
    f *= 2 ** ((wander * driftScale) / 1200);
    if (i > vibratoFrom) {
      phase += (2 * Math.PI * n.rate) / sr;
      const depth = Math.min(1, (i - vibratoFrom) / (0.25 * sr));
      f *= 2 ** ((n.vibrato * depth * Math.sin(phase)) / 1200);
    }
    const half = sr / f / 2 - CLARINET_TRIM;
    const back = lines[0]!.read(half);
    lp = 0.5 * (back + last);
    last = back;
    const diff = -0.95 * lp - breath;
    let y = breath + diff * reed(diff, CLARINET_SLOPE);
    lines[0]!.write(y);
    // The reed opens and shuts unevenly, which gives a real clarinet's weak even harmonics.
    y += even * y * y;
    out[i] = y;
  }
  dcBlock(out);
  lowpass2(out, sr, CLARINET_TOP * 2 ** (CLARINET_TOP_SOFT * (n.vel - 0.5)));
  return out;
}

/** The sax's breath pressure at a strength (0 to 1) on a note (MIDI): the band, under the ceiling that keeps a high note off its octave. */
export function saxPressure(vel: number, midi: number): number {
  const top = Math.max(SAX_FLOOR, SAX_PRESSURE[1] - Math.max(0, midi - SAX_HIGH) * SAX_CEILING_STEP);
  const bottom = Math.max(SAX_SPEAKS, Math.min(SAX_PRESSURE[0], top - SAX_SPAN));
  return bottom + (top - bottom) * Math.min(1, Math.max(0, vel));
}

/** Blow one saxophone note: the cone's waveguide, the breath's air and the horn's body. */
export function blowSax(n: ReedNote, rand: () => number): Float32Array {
  const { sr } = n;
  const out = new Float32Array(Math.ceil(n.seconds * sr));
  const lines = [new Line(Math.ceil(sr / 30) + 4), new Line(Math.ceil(sr / 30) + 4)];
  const strength = Math.min(1, Math.max(0, n.vel));
  const midi = 69 + 12 * Math.log2(n.f / 440);
  const pressure = saxPressure(strength, midi);
  const attack = Math.max(1, n.attack * sr);
  const release = Math.round(n.dur * sr);
  const releaseLen = 0.07 * sr;
  // Into the note: a slur glides from the note before, a scoop rises a semitone or so, and a
  // tongued note may fall into pitch from a few cents flat.
  const fall = !n.from && !n.scoop && n.fallIn ? n.fallIn : 0;
  const glide = n.from ? 0.05 * sr : n.scoop ? SCOOP_TIME * sr : fall ? Math.max(0.004, n.fallTime ?? 0.035) * sr : 0;
  const start = n.from ?? (n.scoop ? n.f * 2 ** (-n.scoop / 12) : fall ? n.f * 2 ** (-fall / 1200) : n.f);
  const vibratoFrom = (n.vibratoAt ?? Math.min(0.3, n.dur * 0.5)) * sr;
  const vibratoGrow = Math.max(0.01, n.vibratoGrow ?? 0.25) * sr;
  // The tongue sets the bore going with a wave one period long already in it (see blowReed).
  const seedPeriod = sr / start;
  for (let i = 0; i < Math.ceil(seedPeriod); i++) {
    const v = Math.sin((2 * Math.PI * i) / seedPeriod) * SAX_TONGUE * pressure;
    lines[0]!.write(v);
    lines[1]!.write(-v * MOUTHPIECE);
  }
  let lp = 0, last = 0;
  let phase = rand() * Math.PI * 2;
  // The push of breath as the tongue lets the reed go (none on a slur, which has no new attack).
  let push = n.from ? 0 : SAX_PUSH;
  const pushFall = Math.exp(-1 / (SAX_PUSH_TIME * sr));
  // The pitch's slow wander, as the clarinet's.
  const drift = Math.exp((-2 * Math.PI * 3) / sr);
  const driftScale = WANDER / (0.577 * Math.sqrt((1 - drift) / (1 + drift)));
  let wander = 0;
  // The breath's turbulence, its slow unsteadiness, and the hum of a growl.
  const air = SAX_AIR[0] + (SAX_AIR[1] - SAX_AIR[0]) * strength;
  const flutterPole = Math.exp((-2 * Math.PI * SAX_FLUTTER_HZ) / sr);
  const flutterScale = SAX_FLUTTER / (0.577 * Math.sqrt((1 - flutterPole) / (1 + flutterPole)));
  let flutter = 0;
  const growl = Math.min(1, Math.max(0, n.growl ?? 0)) * SAX_GROWL_DEPTH;
  const hum = SAX_HUM[0] + (SAX_HUM[1] - SAX_HUM[0]) * rand();
  let humPhase = 0;
  for (let i = 0; i < out.length; i++) {
    const swell = n.from ? Math.min(1, i / (0.012 * sr)) : Math.min(1, i / attack);
    const gone = i < release ? 1 : Math.max(0, 1 - (i - release) / releaseLen);
    flutter = flutterPole * flutter + (1 - flutterPole) * (rand() * 2 - 1);
    let blow = 1 + (rand() * 2 - 1) * air + flutter * flutterScale;
    if (growl) {
      humPhase += (2 * Math.PI * hum) / sr;
      blow *= 1 + growl * (0.7 * Math.sin(humPhase) + 0.3 * Math.sin(2 * humPhase + 0.6));
    }
    const breath = pressure * (1 + push) * swell * gone * blow;
    push *= pushFall;
    // The pitch: into the note (eased, quick at first), then the jaw's vibrato once the note settles.
    const into = glide ? Math.min(1, i / glide) : 1;
    const shape = n.from ? into * into * (3 - 2 * into) : 1 - (1 - into) * (1 - into);
    let f = start * (n.f / start) ** shape;
    wander = drift * wander + (1 - drift) * (rand() * 2 - 1);
    f *= 2 ** ((wander * driftScale) / 1200);
    if (i > vibratoFrom && n.vibrato) {
      phase += (2 * Math.PI * n.rate) / sr;
      const depth = Math.min(1, (i - vibratoFrom) / vibratoGrow);
      f *= 2 ** ((n.vibrato * depth * depth * Math.sin(phase)) / 1200);
    }
    const period = sr / f - SAX_TRIM;
    const back = lines[0]!.read(period * (1 - MOUTHPIECE));
    lp = 0.5 * (back + last);
    last = back;
    const bell = -0.95 * lp;
    const y = bell - lines[1]!.read(period * MOUTHPIECE);
    const diff = breath - y;
    lines[1]!.write(bell);
    lines[0]!.write(breath - diff * reed(diff, SAX_SLOPE) - bell);
    // What is heard is the wave arriving at the bell, where the sound leaves the horn. The
    // pressure at the mouthpiece has a node for every harmonic near a multiple of
    // 1 / MOUTHPIECE (the 4th and the 13th), which made the tone hollow; the bell's wave does not.
    out[i] = back;
  }
  dcBlock(out);
  // The horn: the 4th harmonic lifted back, the body, and the brightness of the strength.
  biquad(out, sr, 'peak', n.f * 4, 4, SAX_FOURTH);
  for (const [type, hz, q, db] of SAX_BODY) biquad(out, sr, type, hz, q, db);
  biquad(out, sr, 'shelf', 1000, 0.7, Math.min(SAX_BRIGHT_MOST, SAX_BRIGHT * (strength - SAX_BRIGHT_MID)));
  // The player: the air in the tone, the loudness never quite still, and a growl's hum.
  breathe(out, sr, n.f, (SAX_BREATH[0] + (SAX_BREATH[1] - SAX_BREATH[0]) * strength) + 20 * Math.log10(n.air ?? 1), rand);
  shimmer(out, sr, rand);
  if (growl) {
    // The hum beating in the note's loudness, as it does in a recorded growl.
    const depth = (growl / SAX_GROWL_DEPTH) * SAX_GROWL_BEAT;
    for (let i = 0, ph = 0; i < out.length; i++, ph += (2 * Math.PI * hum) / sr) out[i] = out[i]! * (1 + depth * (0.7 * Math.sin(ph) + 0.3 * Math.sin(2 * ph + 0.6)));
  }
  if (!n.from) speak(out, sr, n.dur, SPEAK_HARD + SPEAK_SOFT * (1 - strength) ** 2);
  return out;
}

/**
 * The air in a sax note, mixed in at `db` against the note: noise in the reed's band, louder
 * while the reed is open (the half of each cycle the bell's wave is high), so it beats with
 * the note's own period, and following the note's loudness from moment to moment.
 */
function breathe(x: Float32Array, sr: number, f: number, db: number, rand: () => number): void {
  const n = x.length;
  const noise = new Float32Array(n);
  for (let i = 0; i < n; i++) noise[i] = rand() * 2 - 1;
  const q = 1 / (2 * Math.sinh((Math.LN2 / 2) * SAX_BREATH_WIDTH));
  biquad(noise, sr, 'band', SAX_BREATH_BAND, q, 0);
  // The note's loudness, smoothed over about a period, to scale the reed's opening against.
  const per = Math.max(1, Math.round(sr / f));
  const k = Math.exp(-1 / per);
  let env = 0, toneE = 0, airE = 0;
  for (let i = 0; i < n; i++) {
    const v = x[i]!;
    env = k * env + (1 - k) * Math.abs(v);
    const open = env > 0 ? Math.max(0, v / (env * 1.6) + 0.5) : 0;
    noise[i] = noise[i]! * open * env;
    toneE += v * v; airE += noise[i]! * noise[i]!;
  }
  if (airE <= 0 || toneE <= 0) return;
  const g = Math.sqrt(toneE / airE) * 10 ** (db / 20);
  for (let i = 0; i < n; i++) x[i] = x[i]! + noise[i]! * g;
}

/** A held note's loudness moving as a player's does: a gain wandering SAX_SHIMMER either way in the SAX_SHIMMER_BAND. */
function shimmer(x: Float32Array, sr: number, rand: () => number): void {
  const n = x.length;
  const j = new Float32Array(n);
  for (let i = 0; i < n; i++) j[i] = rand() * 2 - 1;
  biquad(j, sr, 'band', Math.sqrt(SAX_SHIMMER_BAND[0] * SAX_SHIMMER_BAND[1]), Math.sqrt(SAX_SHIMMER_BAND[0] * SAX_SHIMMER_BAND[1]) / (SAX_SHIMMER_BAND[1] - SAX_SHIMMER_BAND[0]), 0);
  let e = 0;
  for (let i = 0; i < n; i++) e += j[i]! * j[i]!;
  const g = e > 0 ? SAX_SHIMMER / Math.sqrt(e / n) : 0;
  for (let i = 0; i < n; i++) x[i] = x[i]! * (1 + g * j[i]!);
}

/** Take out the breath's own steady push, which is not sound. */
/** Two one-pole low-passes at `hz`, in place. */
function lowpass2(x: Float32Array, sr: number, hz: number): void {
  const a = Math.exp((-2 * Math.PI * Math.min(hz, sr * 0.45)) / sr), b = 1 - a;
  let y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { y1 = b * x[i]! + a * y1; y2 = b * y1 + a * y2; x[i] = y2; }
}

function dcBlock(out: Float32Array): void {
  let x1 = 0, y1 = 0;
  for (let i = 0; i < out.length; i++) {
    const y = out[i]! - x1 + 0.995 * y1;
    x1 = out[i]!;
    y1 = y;
    out[i] = y;
  }
}

/** An RBJ biquad, in place: a peak at `hz` (quality `q`, `db`), a high shelf from `hz` up (`db`), a low-pass or a band-pass (quality `q`). */
function biquad(x: Float32Array, sr: number, type: 'peak' | 'shelf' | 'lowpass' | 'band', hz: number, q: number, db: number): void {
  if (hz >= sr * 0.45 || ((type === 'peak' || type === 'shelf') && db === 0)) return;
  const w = (2 * Math.PI * hz) / sr, cs = Math.cos(w), sn = Math.sin(w);
  const a = 10 ** (db / 40), alpha = sn / (2 * q);
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
  if (type === 'peak') {
    b0 = 1 + alpha * a; b1 = -2 * cs; b2 = 1 - alpha * a; a0 = 1 + alpha / a; a1 = -2 * cs; a2 = 1 - alpha / a;
  } else if (type === 'shelf') {
    const sq = 2 * Math.sqrt(a) * alpha;
    b0 = a * (a + 1 + (a - 1) * cs + sq); b1 = -2 * a * (a - 1 + (a + 1) * cs); b2 = a * (a + 1 + (a - 1) * cs - sq);
    a0 = a + 1 - (a - 1) * cs + sq; a1 = 2 * (a - 1 - (a + 1) * cs); a2 = a + 1 - (a - 1) * cs - sq;
  } else if (type === 'band') {
    b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha;
  } else {
    b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha;
  }
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i]!;
    const y = (b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = v; y2 = y1; y1 = y;
    x[i] = y;
  }
}

/** A window's RMS level, from sample `a` to `b`. */
function level(x: Float32Array, a: number, b: number): number {
  let s = 0;
  for (let i = a; i < b; i++) s += x[i]! * x[i]!;
  return Math.sqrt(s / Math.max(1, b - a));
}

/**
 * Bring a tongued note's first moments to a played note's rise, 10 to 90 per cent of its
 * held level in `rise` seconds (a raised cosine): its level is measured every 5 ms against
 * its steady level (from the end of the shaped part to as far as the note is held) and
 * evened out to the rise, the correction fading out over the shaped part's last third. A
 * note held too briefly to have a steady level is left as it is.
 */
function speak(x: Float32Array, sr: number, held: number, rise: number): void {
  const length = Math.min(rise, held * SPEAK_SHARE) / SPEAK_10_90;
  const from = Math.round(Math.max(0.05, Math.min(Math.max(SPEAK_SHAPED, length * 1.6), held * 0.5)) * sr);
  const to = Math.min(x.length, Math.round(Math.min(held, Math.max(SPEAK_STEADY, from / sr + 0.2)) * sr));
  const hop = Math.round(0.005 * sr);
  if (to - from < hop * 4) return;
  const steady = level(x, from, to);
  if (steady <= 0) return;
  const gains: number[] = [];
  for (let k = 0; k * hop <= from; k++) {
    const t = (k * hop) / sr;
    const up = t < length ? 0.5 - 0.5 * Math.cos((Math.PI * t) / length) : 1;
    const now = level(x, Math.max(0, k * hop - hop), Math.min(x.length, k * hop + hop));
    const g = now > 0 ? Math.min(SPEAK_MOST, (steady * up) / now) : 0;
    const fade = Math.min(1, Math.max(0, (from - k * hop) / (from / 3)));
    gains.push(1 + (g - 1) * fade);
  }
  for (let i = 0; i <= from && i < x.length; i++) {
    const k = Math.min(gains.length - 2, Math.floor(i / hop));
    const u = i / hop - k;
    x[i] = x[i]! * (gains[k]! + (gains[k + 1]! - gains[k]!) * u);
  }
}

// ── the saxophonist ────────────────────────────────────────────────────────────

/**
 * How a sax note is asked for, in its `art`: SAX_PLAYED marks a line played for the sax, with
 * a scoop (SAX_SCOOP), a growl (SAX_GROWL) or the soft, airy subtone (SAX_SUBTONE). Without the
 * mark, only the composer's own art 1 (a scoop) is read, so the flags another lead's player
 * leaves on a line the sax doubles (a flute's, a guitar's) never reach the sax.
 */
export const SAX_PLAYED = 1 << 13;
export const SAX_SCOOP = 1, SAX_GROWL = 2, SAX_SUBTONE = 4;

/** How a sax note is to be played: the lead's note and the playing the line asks for. */
export interface SaxPlay {
  sr: number;
  /** The note (MIDI, may be fractional: a section player's own tuning), and the one it slurs from. */
  midi: number; from?: number;
  /** Strength (0 to 1) and how long it is held (s). */
  vel: number; dur: number;
  /** The note's art: the composer's (1, a scoop), or SAX_PLAYED with SAX_SCOOP, SAX_GROWL and SAX_SUBTONE. */
  art: number;
  /** A section player: no vibrato. */
  straight?: boolean;
  /** The vibrato's rate (Hz). */
  rate: number;
}

/**
 * How the recorded players start a tongued note (614 notes of pop and jazz phrases, each
 * note's pitch tracked over its first 15 ms against where it settles): a sixth read 8 to 20
 * cents flat and settle at once, a sixth 20 to 40 flat (settled in about 30 ms), one in
 * twelve 40 to 70 (60 ms) and one in twelve a scoop, 70 cents or more (95 ms); the rest
 * start on pitch. The tracker's 30 ms window smooths a fall-in, so each kind is drawn as
 * the model's notes read the same through it: [share, cents, s], cents and time drawn
 * between the two given, and the share left for a scoop (SAX_SCOOPS).
 */
const FALL_INS: ReadonlyArray<readonly [number, readonly [number, number], readonly [number, number]]> = [
  [0.18, [40, 55], [0.035, 0.045]],
  [0.22, [70, 100], [0.05, 0.07]],
  [0.1, [110, 150], [0.07, 0.095]],
];
const SAX_SCOOPS = 0.08;
/** A scoop's depth (semitones): a semitone and a half reads as the recorded scoops do, 70 to 150 cents flat at the tracker. */
const SCOOP = 1.5;
/**
 * The vibrato on a held note, as the recorded pop and jazz players held theirs: about 4.8
 * times a second, 13 to 19 cents either way at its full depth, barely there for the first
 * quarter of a second (3 cents) and grown by about half a second in; some held notes are
 * played straight. A classical alto's (Iowa) is shallower and starts at once: 6 to 16 cents.
 */
const SAX_VIBRATO = 18, SAX_VIBRATO_SPREAD = 0.3, SAX_VIBRATO_FROM = 0.45, SAX_VIBRATO_AT = 0.22, SAX_VIBRATO_GROW = 0.35, SAX_STRAIGHT = 0.25;
/**
 * The puff of air as the tongue lets the reed go (against the note's held level): measured on
 * the recorded tongued notes, the air above 4 kHz rises 4 to 14 dB over the held note's for
 * about 30 ms (staccato more, legato phrases about 4 dB).
 */
const SAX_PUFF: BurstShape = {
  centre: 3200, width: 2, top: 0.5, topHz: 6000, level: -15, length: 0.02, rise: 0.006,
  perStrength: 6, perSpeed: 3, spread: 2, lengthSpread: 0.3, centreSpread: 0.2,
};
/** A subtone: softer air across the reed, darker and airier (the strength it is blown at, and its breath). */
const SUBTONE_AT = 0.2, SUBTONE_AIR = 2.2;
/** A growl's depth (0 to 1), when the line asks for one. */
const GROWL = 0.75;

/**
 * Play one sax note as a player does: the choices a player makes on every note (whether it
 * falls into pitch, how deep and late its vibrato is) drawn from `rand`, the line's own
 * choices (a scoop, a growl, a subtone) from `art`, and the puff of air at a tongued onset.
 */
export function saxNote(p: SaxPlay, rand: () => number): Float32Array {
  const { sr } = p;
  const held = Math.max(0.06, p.dur);
  const flags = p.art & SAX_PLAYED ? p.art : p.art === 1 ? SAX_SCOOP : 0;
  const subtone = (flags & SAX_SUBTONE) !== 0;
  const vel = subtone ? Math.min(p.vel, SUBTONE_AT) : p.vel;
  const tongued = p.from === undefined;
  const pick = rand();
  const scoop = flags & SAX_SCOOP || (tongued && pick > 1 - SAX_SCOOPS) ? SCOOP : 0;
  let fallIn = 0, fallTime = 0;
  if (tongued && !scoop) {
    let acc = 0;
    for (const [share, [c0, c1], [t0, t1]] of FALL_INS) {
      acc += share;
      if (pick < acc) { const u = rand(); fallIn = c0 + (c1 - c0) * u; fallTime = t0 + (t1 - t0) * u; break; }
    }
  }
  const straight = p.straight || held < SAX_VIBRATO_FROM || rand() < SAX_STRAIGHT;
  const vibrato = straight ? 0 : SAX_VIBRATO * (1 + SAX_VIBRATO_SPREAD * (2 * rand() - 1));
  const vibratoAt = Math.min(held * 0.5, SAX_VIBRATO_AT * (0.8 + 0.4 * rand()));
  const seed = Math.floor(rand() * 4294967296);
  const f = 440 * 2 ** ((p.midi - 69) / 12);
  const data = blowSax({
    sr, f, from: p.from === undefined ? undefined : 440 * 2 ** ((p.from - 69) / 12), vel, dur: held, seconds: held + 0.12, bore: 'cone',
    vibrato, rate: p.rate, scoop, attack: 0.012, vibratoAt, vibratoGrow: SAX_VIBRATO_GROW, fallIn, fallTime,
    growl: flags & SAX_GROWL ? GROWL : 0, air: subtone ? SUBTONE_AIR : 1,
  }, rand);
  if (tongued) {
    // The puff, against the note's held level (its first half second after the onset).
    const ref = level(data, Math.round(Math.min(0.06, held / 3) * sr), Math.round(Math.min(held, 0.5) * sr));
    const speed = Math.min(1, Math.max(0, (0.3 - held) / 0.2));
    const puff = airBurst(sr, SAX_PUFF, { strength: vel, speed, seed });
    for (let i = 0; i < puff.length && i < data.length; i++) data[i] = data[i]! + puff[i]! * ref;
  }
  return data;
}
