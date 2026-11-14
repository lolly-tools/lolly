// SPDX-License-Identifier: MPL-2.0
/**
 * Two Australian birds, modelled as pure buffers: the magpie's carol and its quiet warble, and
 * the laughing kookaburra. Straya places them as its signature (engine/src/lofi-straya.ts), and
 * any style can have them when a person turns on the effects lane's Aussie birds. Lolly ships
 * no samples, so none of this is a recording: each is a seeded model of how the bird sings,
 * and the same seed always gives the same bytes.
 *
 * The magpie sings with both sides of its syrinx at once, so a carol is two voices, each a
 * run of short notes: most a few tens of milliseconds, some held a few tenths of a second,
 * between about 650 Hz and 2 kHz, with leaps between them more often than steps, a slow
 * drift or a swoop inside a note, now and then a quick falling zip high up, and the
 * distinctive warble: many held notes pulsed about a hundred times a second, a gurgle. Its
 * harmonics are faint (the second about 28 dB down). Phrases last a second or two with half
 * a second between; a family carols together, each bird its own phrases, overlapping. The
 * warble, its quiet sub-song, is softer and denser, its notes shorter and more of them pulsed.
 *
 * The kookaburra laughs in four parts: low, soft chuckles ("hoo-hoo"), a build that quickens
 * and climbs, the full rolling laugh ("koo-koo-kaa-kaa", the kaa higher and harsher), and the
 * fall-away, sputtering down, with breaks and a breath drawn in. Each syllable is raucous: a
 * voice near 450 to 700 Hz whose pulses waver and alternate (period doubling), full of breath
 * noise, its pitch arching up and down inside each syllable. A family laughs together, out of step, the
 * birds further off quieter and duller.
 *
 * Measured against field recordings (numbers only; none is in this repository): magpie carols
 * and warbles from Freesound, the radio aporee archive and Wikimedia Commons (CC0, CC BY, CC
 * BY-SA, a Public Domain Mark), and kookaburra laughs from Freesound and Wikimedia Commons
 * (the Australian National Wildlife Collection's, CC BY 3.0, among them), each measured the
 * same way as the model:
 * - magpie carols: 3.7 to 8.2 notes a second (median 6.6), notes about 60 ms (median), pitch
 *   about 700, 1080 and 1550 to 2000 Hz (5th, 50th, 95th percentiles), leaps of more than three
 *   semitones at about half the joins, two voices a third of the time, the second harmonic 24
 *   to 33 dB down, about 70 per cent of held notes pulsed near 100 Hz; the model's carols give
 *   4.5 to 5.9 notes a second, 87 to 141 ms, 830, 1300 and 1850 to 2050 Hz, two voices 36 per
 *   cent of the time, 27.6 dB down, pulsed near 90 to 100 Hz.
 * - kookaburra laughs: 7 to 15 s, 6 to 9 syllables a second, syllables 56 to 116 ms, a pitch of
 *   450 to 690 Hz, 7 to 10 harmonics within 30 dB; inside a syllable the harmonics stand only
 *   about 0 to 5 dB over the noise, period doubling puts energy half way between them 11 to 19
 *   dB down, the pitch arches up 1.4 to 2.5 semitones and down 1 to 3, the attack takes 28 to
 *   40 ms, and the gaps spread by about 0.4 of themselves. The model's laugh: 10.7 s, 8.1 a
 *   second, 112 ms, 615 Hz, 9 harmonics, harmonics 0.8 dB under the noise, doubling 11 dB
 *   down, arches up 1.8 and down 1.2 semitones, a 32 ms attack, gaps spread by 0.34.
 */

export type Stereo = [Float32Array, Float32Array];

/** A small seeded source (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
}
/** A log-normal draw round `median`, spread `sigma` (natural log units), held between `lo` and `hi`. */
function lognormal(r: () => number, median: number, sigma: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, median * Math.exp(sigma * gauss(r))));
}

/** A two-pole band-pass run sample by sample. */
class Band {
  private b0 = 0; private a1 = 0; private a2 = 0; private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
  constructor(sr: number, hz: number, q: number) {
    const w = (2 * Math.PI * Math.min(hz, sr * 0.45)) / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al;
    this.b0 = al / a0; this.a1 = (-2 * Math.cos(w)) / a0; this.a2 = (1 - al) / a0;
  }
  run(x: number): number {
    const y = this.b0 * x - this.b0 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

// ── outdoors ─────────────────────────────────────────────────────────────────

/**
 * The bird a few metres off outdoors: its song comes back from the ground, the trees and the
 * houses round it, softer and duller. Recorded carols ring on about 13 to 16 dB under a note
 * 20 to 60 ms after it stops and 16 to 19 dB under from 60 to 150 ms, then fall away into
 * the quiet between phrases: a cluster of early echoes (EARLY, ms and level), and a fainter
 * diffuse tail from four delay lines feeding each other (a feedback delay network), the
 * highs absorbed on every pass. `wet` scales both (1 as measured), in place on a stereo pair.
 */
const EARLY: ReadonlyArray<readonly [number, number, number]> = [[11, 0.21, 0.14], [23, 0.17, 0.2], [37, 0.16, 0.12], [52, 0.13, 0.16], [71, 0.12, 0.09], [96, 0.09, 0.1], [128, 0.065, 0.065]];
const TAIL = 0.12;
export function outdoors([l, r]: Stereo, sr: number, wet: number): void {
  const n = l.length;
  const dry = new Float32Array(n);
  for (let i = 0; i < n; i++) dry[i] = (l[i]! + r[i]!) * 0.5;
  // The early echoes, each duller than the bird (a one-pole low-pass at 4 kHz), a little different each side.
  const pole = Math.exp((-2 * Math.PI * 4000) / sr);
  let lpd = 0;
  const dull = new Float32Array(n);
  for (let i = 0; i < n; i++) { lpd = (1 - pole) * dry[i]! + pole * lpd; dull[i] = lpd; }
  for (const [ms, gl, gr] of EARLY) {
    const d = Math.round((ms / 1000) * sr);
    for (let i = n - 1; i >= d; i--) { l[i]! += dull[i - d]! * gl * wet; r[i]! += dull[i - d]! * gr * wet; }
  }
  // The diffuse tail: about 0.8 s to fall 60 dB.
  const ms = [29.7, 37.1, 43.3, 53.9];
  const len = ms.map(d => Math.round((d / 1000) * sr));
  const lines = len.map(k => new Float32Array(k));
  const at = [0, 0, 0, 0], lp = [0, 0, 0, 0];
  const g = len.map(k => 10 ** ((-3 * k) / (0.8 * sr)));
  const tp = Math.exp((-2 * Math.PI * 3000) / sr);
  for (let i = 0; i < n; i++) {
    const o = lines.map((d, k) => d[at[k]!]!);
    for (let k = 0; k < 4; k++) lp[k] = (1 - tp) * o[k]! + tp * lp[k]!;
    const sum = (lp[0]! + lp[1]! + lp[2]! + lp[3]!) * 0.5;
    for (let k = 0; k < 4; k++) { lines[k]![at[k]!] = dull[i]! + (lp[k]! - sum) * g[k]!; at[k] = (at[k]! + 1) % len[k]!; }
    l[i]! += (o[0]! - o[2]!) * TAIL * wet;
    r[i]! += (o[1]! - o[3]!) * TAIL * wet;
  }
}

// ── the magpie ───────────────────────────────────────────────────────────────

/** How a magpie sings: the full carol, or the quiet warble. */
export type MagpieSong = 'carol' | 'warble';

interface Note { at: number; dur: number; from: number; to: number; hook: number; pulse: number; level: number }

/** How each song goes, fitted: notes (median s, spread), the gaps after them, phrases and the rests between (s), the share of notes leaping, swooping, zipping and pulsed. */
const SONGS: Record<MagpieSong, { note: number; spread: number; gap: number; phrase: number; rest: number; leap: number; swoop: number; zip: number; pulsed: number; level: number }> = {
  carol: { note: 0.045, spread: 0.75, gap: 0.05, phrase: 1.25, rest: 0.5, leap: 0.4, swoop: 0.14, zip: 0.06, pulsed: 0.45, level: 1 },
  warble: { note: 0.035, spread: 0.7, gap: 0.035, phrase: 1.8, rest: 0.45, leap: 0.3, swoop: 0.1, zip: 0.08, pulsed: 0.55, level: 0.55 },
};

/** One syrinx voice's notes through `seconds`: phrases of notes, leaping and drifting round `centre`. */
function magpieNotes(r: () => number, seconds: number, centre: number, song: MagpieSong, start: number): Note[] {
  const s = SONGS[song];
  const notes: Note[] = [];
  const lo = centre * 0.62, hi = centre * 1.75;
  let pitch = centre * 2 ** ((r() - 0.5) * 0.8);
  let t = start;
  while (t < seconds - 0.08) {
    const phraseEnd = Math.min(seconds - 0.03, t + lognormal(r, s.phrase, 0.45, 0.4, 3.5));
    while (t < phraseEnd) {
      const zip = r() < s.zip;
      let dur = zip ? 0.012 + r() * 0.02 : lognormal(r, s.note, s.spread, 0.012, 0.42);
      if (t + dur > phraseEnd) dur = Math.max(0.012, phraseEnd - t);
      // A leap to anywhere in the range, or a step from the last note.
      pitch = r() < s.leap ? lo * (hi / lo) ** r() : Math.min(hi, Math.max(lo, pitch * 2 ** (gauss(r) * 0.12)));
      let from = pitch, to = pitch * 2 ** (gauss(r) * 1.1 * dur);
      if (zip) { from = Math.min(2400, pitch * 1.5 + 400); to = from * 2 ** -(0.3 + r() * 0.25); }
      else if (dur > 0.12 && r() < s.swoop / 0.4) { const sweep = (r() < 0.6 ? 1 : -1) * (0.25 + r() * 0.35); to = pitch * 2 ** sweep; }
      const hook = !zip && r() < 0.3 ? (r() < 0.5 ? -1 : 1) * (2 + r() * 3) : 0;
      const pulse = !zip && dur >= 0.05 && r() < s.pulsed ? 92 + r() * 18 : 0;
      notes.push({ at: t, dur, from, to, hook, pulse, level: 10 ** ((gauss(r) * 3) / 20) * (zip ? 0.5 : 1) });
      // Some notes run straight into the next (a slur), most leave a short gap.
      t += dur + (r() < 0.3 ? 0.004 + r() * 0.012 : lognormal(r, s.gap, 0.6, 0.012, 0.25));
    }
    t = phraseEnd + lognormal(r, s.rest, 0.4, 0.15, 1.6);
  }
  return notes;
}

/** Sing `notes` into `out` (mono), each a nearly pure whistle with faint harmonics, some pulsed. */
function singNotes(out: Float32Array, sr: number, notes: readonly Note[], r: () => number, gain: number): void {
  for (const n of notes) {
    const start = Math.round(n.at * sr), len = Math.round(n.dur * sr);
    const att = Math.max(1, Math.round(0.004 * sr)), rel = Math.max(1, Math.round(Math.min(0.012, n.dur * 0.3) * sr));
    let phase = r() * 2 * Math.PI, pphase = r();
    const jitter = 0.004;
    let wob = 0;
    for (let i = 0; i < len && start + i < out.length; i++) {
      const u = i / len;
      // The pitch: a hook into the note, then its glide from one pitch to the other.
      const hook = n.hook ? 2 ** ((n.hook * Math.max(0, 1 - i / (0.015 * sr))) / 12) : 1;
      wob = 0.995 * wob + 0.005 * gauss(r);
      const f = n.from * (n.to / n.from) ** u * hook * (1 + jitter * wob * 10);
      phase += (2 * Math.PI * f) / sr;
      let env = Math.min(1, i / att, (len - i) / rel);
      if (n.pulse) {
        // The gurgle: the note pulsed a hundred times a second, each pulse a short swell.
        pphase += n.pulse / sr;
        if (pphase >= 1) pphase -= 1;
        env *= 0.08 + 0.92 * (0.5 - 0.5 * Math.cos(2 * Math.PI * Math.min(1, pphase / 0.62))) * (pphase < 0.62 ? 1 : 0);
      }
      const v = Math.sin(phase) + 0.04 * Math.sin(2 * phase + 0.5) + 0.013 * Math.sin(3 * phase + 1.1);
      out[start + i]! += v * env * n.level * gain;
    }
  }
}

/**
 * One magpie singing for `seconds`, round `centre` (Hz, its middle pitch, about 1.1 kHz):
 * both voices of its syrinx, the second joining in for parts of each phrase. Mono, peak about 0.5.
 */
export function magpie(sr: number, seconds: number, centre: number, seed: number, song: MagpieSong = 'carol'): Float32Array {
  const r = seeded(seed ^ 0x3a9f1e);
  const out = new Float32Array(Math.ceil(seconds * sr));
  const a = magpieNotes(r, seconds, centre, song, 0);
  // The second voice sings for parts of the phrases, lower or higher than the first.
  const b = magpieNotes(r, seconds, centre * 2 ** ((r() - 0.5) * 0.9), song, 0.05 + r() * 0.2).filter(() => r() < 0.45);
  singNotes(out, sr, a, r, 0.42 * SONGS[song].level);
  singNotes(out, sr, b, r, 0.3 * SONGS[song].level);
  // A breath of air under the song, and the bird a few metres off: the lowest frequencies gone.
  let hp = 0, prev = 0;
  const pole = Math.exp((-2 * Math.PI * 380) / sr);
  for (let i = 0; i < out.length; i++) {
    const x = out[i]! + 0.016 * (r() * 2 - 1);
    hp = pole * (hp + x - prev); prev = x;
    out[i] = hp;
  }
  return out;
}

/**
 * A family of `birds` magpies carolling together across the stereo field, each a little apart
 * in pitch and time; the first one nearest. Peak about 0.5 a side.
 */
export function magpieFamily(sr: number, seconds: number, centre: number, seed: number, birds: number, song: MagpieSong = 'carol', room = 1): Stereo {
  // The song, and the place ringing on after the song.
  const L = new Float32Array(Math.ceil((seconds + 0.7) * sr)), R = new Float32Array(L.length);
  const r = seeded(seed ^ 0x51f00d);
  for (let b = 0; b < birds; b++) {
    const late = b === 0 ? 0 : 0.15 + r() * 0.9;
    const near = b === 0 ? 1 : 0.55 + r() * 0.3;
    const pan = b === 0 ? (r() - 0.5) * 0.3 : (r() < 0.5 ? -1 : 1) * (0.35 + r() * 0.5);
    const x = magpie(sr, Math.max(0.3, seconds - late), centre * 2 ** ((r() - 0.5) * 0.5), (seed + b * 7919) >>> 0, song);
    const gl = near * Math.cos(((pan + 1) * Math.PI) / 4), gr = near * Math.sin(((pan + 1) * Math.PI) / 4);
    const off = Math.round(late * sr);
    for (let i = 0; i < x.length && off + i < L.length; i++) { L[off + i]! += x[i]! * gl; R[off + i]! += x[i]! * gr; }
  }
  outdoors([L, R], sr, room);
  return [L, R];
}

// ── the kookaburra ───────────────────────────────────────────────────────────

/**
 * One syllable of a laugh: when, how long, its pitch, how its pitch sweeps inside it (from,
 * peak and end in semitones, and where the peak falls), how harsh and how loud, and whether it
 * is a breath drawn in between bursts rather than a call.
 */
interface Syllable { at: number; dur: number; f0: number; from: number; top: number; end: number; peakAt: number; harsh: number; level: number; breath: boolean }

/**
 * The laugh's four parts, fitted to the recordings: [length (s), syllables a second from and to,
 * pitch from and to (times the laugh's own), syllable length (s), harshness, level from and to].
 * Recorded laughs run 7 to 15 s, 6 to 9 syllables a second through the full laugh, each about
 * 55 to 115 ms long, the chuckles 5 to 10 dB under the full laugh and the fall-away sputtering
 * down 5 to 12 dB.
 */
const LAUGH: ReadonlyArray<readonly [number, number, number, number, number, number, number, number, number]> = [
  [1.8, 7.5, 8.5, 0.62, 0.72, 0.05, 0.25, 0.28, 0.45],   // the chuckles: hoo-hoo, low, soft and quick
  [2, 7.5, 8.5, 0.78, 1, 0.08, 0.65, 0.5, 0.9],           // the build: quicker, climbing, harsher
  [5, 6.6, 6.2, 1, 1, 0.105, 1, 1, 1],                    // the full laugh: koo-koo-kaa-kaa-ha-ha
  [2.6, 5.5, 3.2, 0.95, 0.72, 0.09, 0.85, 0.5, 0.15],     // the fall-away, sputtering down
];

/**
 * A laugh's syllables, `length` times the usual length (1 about 11 s). Never metronomic: the
 * gaps vary (recorded laughs' spread is about 0.4 of the gap), a syllable now and then comes
 * hard on the last (a stutter), the laugh breaks off and starts again, a breath is drawn in the
 * longer breaks, and the pitch jumps a semitone or two between syllables.
 */
function laughSyllables(r: () => number, f0: number, length: number): Syllable[] {
  const out: Syllable[] = [];
  let t = 0;
  for (const [secs, rateA, rateB, pitchA, pitchB, dur, harsh, levelA, levelB] of LAUGH) {
    const span = secs * length * (0.8 + r() * 0.4);
    const begin = t, end = t + span;
    let k = 0;
    while (t < end) {
      const u = (t - begin) / span;
      const rate = rateA + (rateB - rateA) * u;
      // The full laugh alternates: koo, koo, then kaa higher and harsher.
      const kaa = harsh >= 1 && k % 4 >= 2;
      const f = f0 * (pitchA + (pitchB - pitchA) * u) * (kaa ? 1.2 : 1) * 2 ** ((gauss(r) * 1.1) / 12);
      // Each syllable's own sweep: up from under its pitch to a peak near its middle, and down past where it began.
      const width = (harsh < 0.4 ? 0.5 : 0.9) * (0.3 + r() * 1.0);
      out.push({
        at: t, dur: dur * (0.75 + r() * 0.5) * (kaa ? 1.15 : 1), f0: f,
        from: -(3 + r() * 2) * width, top: (0.5 + r() * 1.2) * width, end: -(0.8 + r() * 2) * width, peakAt: 0.4 + r() * 0.2,
        harsh: Math.min(1, harsh * (kaa ? 1.25 : 1) * (0.8 + r() * 0.4)), level: (levelA + (levelB - levelA) * u) * (0.65 + r() * 0.7), breath: false,
      });
      // The gap to the next: varied, sometimes a stutter, sometimes a break and a breath drawn in.
      // The full laugh runs steadiest; the chuckles, the build and the fall-away stutter more.
      let gap = (1 / rate) * Math.exp((harsh >= 1 ? 0.15 : 0.4) * gauss(r));
      if (r() < (harsh >= 1 ? 0.04 : 0.12)) gap = 0.055 + r() * 0.03;
      else if (harsh >= 0.6 && r() < 0.06) {
        gap = 0.22 + r() * 0.25;
        out.push({ at: t + gap * 0.45, dur: 0.07 + r() * 0.05, f0: f * 0.45, from: 0, top: 0, end: -1, peakAt: 0.5, harsh: 1, level: 0.12 + r() * 0.08, breath: true });
      }
      t += Math.max(0.05, gap);
      k++;
    }
  }
  return out;
}

/** The breath noise in each pulse, against the pulse. */
const LAUGH_NOISE = 0.22;
/**
 * Sing a laugh's syllables into `out`: a raucous voice, its pulses irregular (jitter and shimmer
 * of a few per cent), every other pulse weaker and later (the period doubling that puts energy
 * half way between the harmonics, 10 to 20 dB under them in the recordings), and breath noise
 * inside each pulse (the recordings' harmonics stand only about 0 to 5 dB over their noise),
 * through the bird's resonances. A drawn breath is noise alone, low and soft.
 */
function singLaugh(out: Float32Array, sr: number, syl: readonly Syllable[], r: () => number, gain: number): void {
  const low = new Band(sr, 700, 1.6), f1 = new Band(sr, 1500, 3.5), f2 = new Band(sr, 2600, 3.5), f3 = new Band(sr, 3600, 4);
  const breathBand = new Band(sr, 1200, 0.8);
  for (const s of syl) {
    const start = Math.round(s.at * sr), len = Math.round(s.dur * sr), tail = Math.round(0.015 * sr);
    const attack = Math.round((0.025 + 0.03 * s.harsh * r()) * sr);
    if (s.breath) {
      for (let i = 0; i < len + tail && start + i < out.length; i++) {
        const u = i / len;
        const env = Math.sin(Math.PI * Math.min(1, u)) ** 2;
        out[start + i]! += breathBand.run((r() * 2 - 1) * env) * s.level * gain;
      }
      continue;
    }
    let phase = 0, odd = false, period = sr / s.f0, amp = 1;
    const doubling = 0.12 + 0.35 * s.harsh * r();
    const offset = 0.015 * s.harsh * r();
    const noisy = 0.25 + 1.1 * s.harsh;
    // The voice's top: the chuckles low and soft (the recordings' "hoo" sits under a kilohertz),
    // the full laugh's energy mostly between 1 and 3.5 kHz, falling away above 4.
    const topPole = Math.exp((-2 * Math.PI * (900 + 3100 * Math.min(1, s.harsh * 1.25))) / sr);
    let t1 = 0, t2 = 0;
    for (let i = 0; i < len + tail && start + i < out.length; i++) {
      const u = Math.min(1, i / len);
      // The sweep inside the syllable, as a chevron.
      const st = u < s.peakAt ? s.from + (s.top - s.from) * Math.sin((Math.PI / 2) * (u / s.peakAt)) : s.top + (s.end - s.top) * (1 - Math.cos((Math.PI / 2) * ((u - s.peakAt) / (1 - s.peakAt))));
      phase += 1;
      let pulse = 0;
      if (phase >= period) {
        phase -= period;
        odd = !odd;
        // The next period: the sweep's pitch, jittered, every other one longer and weaker.
        const f = s.f0 * 2 ** (st / 12);
        period = (sr / f) * (1 + 0.01 * s.harsh * gauss(r)) * (odd ? 1 + offset : 1 - offset);
        amp = (odd ? 1 - doubling : 1) * (1 + 0.1 * s.harsh * gauss(r));
        pulse = amp;
      }
      // Breath noise, strongest in the first part of each period (while the syrinx is open).
      const open = phase < period * 0.4 ? 1 : 0.3;
      const src = pulse * 1.6 + (r() * 2 - 1) * LAUGH_NOISE * noisy * open;
      const env = i < attack ? 0.5 - 0.5 * Math.cos((Math.PI * i) / attack) : i < len ? 1 - 0.5 * ((i - attack) / Math.max(1, len - attack)) : 0.5 * (1 - (i - len) / tail);
      t1 = (1 - topPole) * src * env + topPole * t1;
      t2 = (1 - topPole) * t1 + topPole * t2;
      const v = t2;
      const chuckle = 1 - Math.min(1, s.harsh * 1.4);
      out[start + i]! += (low.run(v) * (0.3 + 0.9 * chuckle) + f1.run(v) * 1.4 * (1 - 0.6 * chuckle) + f2.run(v) * 1.0 * (1 - 0.7 * chuckle) + f3.run(v) * 0.3 * (1 - 0.8 * chuckle) + v * 0.02) * s.level * gain;
    }
  }
}

/** A kookaburra laughing, round `f0` (Hz, about 450 to 700), `length` times the usual length. Mono, peak about 0.5. */
export function kookaburra(sr: number, f0: number, seed: number, length = 1): Float32Array {
  const r = seeded(seed ^ 0x6b00ca);
  const syl = laughSyllables(r, f0, length);
  const seconds = (syl[syl.length - 1]?.at ?? 0) + 0.3;
  const out = new Float32Array(Math.ceil(seconds * sr));
  singLaugh(out, sr, syl, r, 1);
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i]! *= 0.5 / peak;
  return out;
}

/** A family of `birds` kookaburras laughing together across the stereo field, each starting a moment after the last. */
export function kookaburraFamily(sr: number, f0: number, seed: number, birds: number, length = 1, room = 1): Stereo {
  const r = seeded(seed ^ 0xfa111e);
  const takes = Array.from({ length: birds }, (_, b) => ({
    x: kookaburra(sr, f0 * 2 ** ((b === 0 ? 0 : (r() - 0.5) * 0.5)), (seed + b * 104729) >>> 0, length * (b === 0 ? 1 : 0.75 + r() * 0.35)),
    late: b === 0 ? 0 : 0.4 + r() * 1.8, near: b === 0 ? 1 : 0.5 + r() * 0.35, pan: b === 0 ? (r() - 0.5) * 0.3 : (r() < 0.5 ? -1 : 1) * (0.3 + r() * 0.5),
  }));
  const n = Math.max(...takes.map(k => k.x.length + Math.round(k.late * sr))) + Math.round(0.6 * sr);
  const L = new Float32Array(n), R = new Float32Array(n);
  for (const k of takes) {
    const gl = k.near * Math.cos(((k.pan + 1) * Math.PI) / 4), gr = k.near * Math.sin(((k.pan + 1) * Math.PI) / 4);
    const off = Math.round(k.late * sr);
    // A bird further off is quieter and duller: the air takes its top.
    const pole = Math.exp((-2 * Math.PI * (2500 + 5000 * k.near)) / sr);
    let y = 0;
    for (let i = 0; i < k.x.length; i++) { y = (1 - pole) * k.x[i]! + pole * y; L[off + i]! += y * gl; R[off + i]! += y * gr; }
  }
  outdoors([L, R], sr, room);
  return [L, R];
}
