// SPDX-License-Identifier: MPL-2.0
/**
 * The didgeridoo blown, modelled: the player's lips buzzing into a long, wide bore, with the
 * player's own vocal tract behind the lips, worked out in JS sample by sample and played back,
 * as the brass is (lib/lofi-brass.ts). The didgeridoo comes from the Yolŋu of north-east
 * Arnhem Land, where it is the yidaki.
 *
 * Three things make the sound, and the model keeps each:
 *
 * - The lips are the brass model's valve (lofi-brass.ts LIP_REST, LIP_COMPLIANCE, LIP_GAP): a
 *   mass on a spring the breath pushes open, the air through the gap given by Bernoulli. Here
 *   they are loose and slow, set just under the bore's first resonance, so they buzz the
 *   drone; tightened towards its second, they jump up to it, the "toot".
 * - The bore is 1.2 to 1.5 m of wide, roughly conical tube. Its input impedance is a set of
 *   resonances (the modal method of brass physics): peaks at the drone and at about 2.5, 4.2
 *   and 5.9 times it, not at the harmonics, because the bore widens along its length. The
 *   lips run at the first, so the drone's harmonics are all there, and those that fall near a
 *   resonance ring louder. Above a kilohertz the peaks have faded into the tube's plain
 *   resistance, so what the lips let through passes almost unshaped.
 * - The vocal tract sits in series behind the lips. Where its own resonances are strong it
 *   chokes the air at those frequencies, so the sound has gaps there and bright bands between
 *   them (Tarnopolsky, Fletcher, Hollenberg, Lange, Smith and Wolfe, Nature 436, 2005). Moving
 *   the tongue moves the gaps and the bands: the "oo", "wah" and "ee" sweeps a player's
 *   rhythms are made of. A voice sung or hummed into the tract adds its own pressure behind
 *   the lips; the lips mix it with their buzz, so the voice comes out with the tones its pitch
 *   and the drone's make between them, the growl of a call or a bark.
 *
 * The breath runs as a player's does. A steady drone drifts a little in pitch and colour.
 * Circular breathing never stops it: the cheeks push the air while the nose breathes in, so
 * the drone sags and darkens, then the lungs come back with a push, a pulse the player keeps
 * in time. A tongued note stops the air for a moment and lets it go with a kick; the diaphragm
 * pushes accents without stopping the air.
 *
 * Pure: no DOM, no Web Audio; deterministic for the same notes and seed. A player is one
 * continuous simulation: each span it renders carries on from where the last one ended, so a
 * drone held across many notes is one unbroken sound.
 */
import { LIP_COMPLIANCE, LIP_GAP, LIP_REST } from './lofi-brass.ts';
import { airBurst, inhale, seededRandom, type BurstShape, type InhaleShape } from './lofi-breath.ts';
import { DIDGE_BARK, DIDGE_BREATH, DIDGE_CALL, DIDGE_HOWL, DIDGE_PUSH, DIDGE_SWEEP, DIDGE_TONGUE, DIDGE_TOOT, DIDGE_WA } from '../../../../engine/src/lofi-straya.ts';

export { DIDGE_ART, DIDGE_ROLE } from '../../../../engine/src/lofi-straya.ts';

/** One note the player plays: when it starts and how long it lasts (s, within the span), how it is played (a DIDGE_* articulation), how hard (0 to 1) and in which role (0 the drone, 1 the rhythm, 2 the lead). */
export interface DidgeEvent { at: number; dur: number; art: number; vel: number; role: number }

/** A resonance: its frequency (Hz, or a multiple of the drone for the bore), its peak (against the tube's plain resistance) and its sharpness. */
type Resonance = readonly [number, number, number];

/**
 * The bore's resonances, as multiples of the drone it plays: [ratio, peak, sharpness]. Measured
 * didgeridoos toot about 2.75 to 2.9 times their drone (the second resonance), and their drones
 * are strong in the odd harmonics (the 3rd, 5th and 7th 8, 15 and 22 dB under the fundamental,
 * the 2nd and 4th 25 and 28 under, in the recordings' median), so the resonances above the first
 * fall close under the odd harmonics, about two apart. Each has the same strength (residue), a
 * pipe's, with its losses growing as the root of the frequency: the peaks fall and sharpen as
 * they rise, and between them the bore's resistance all but vanishes, which is what leaves the
 * even harmonics weak.
 */
export const BORE: Resonance[] = Array.from({ length: 12 }, (_, k) => {
  const ratio = k === 0 ? 0.98 : 2.8 + 2 * (k - 1);
  return [ratio, 10 * Math.sqrt(0.98 / ratio), Math.min(80, 14 * Math.sqrt(ratio / 0.98))] as const;
});

/**
 * The tongue's places, as the vocal tract's resonances seen from the lips (Hz, peak against the
 * tube's resistance, sharpness): its low resonance, the one the tongue moves most, and the one
 * above. "oo" with the tongue low and back, "ah" open, "ee" high and forward, and the cheeks'
 * own shape while the nose breathes in (the tongue up against the palate, the mouth alone).
 */
export const TRACT: Record<'oo' | 'ah' | 'ee' | 'cheek', readonly [Resonance, Resonance, Resonance]> = {
  oo: [[320, 2.2, 5], [950, 5, 7], [2500, 3, 8]],
  ah: [[650, 2.2, 5], [1250, 4.5, 7], [2700, 3, 8]],
  ee: [[290, 2.2, 5], [2100, 6, 9], [3100, 3.2, 9]],
  cheek: [[900, 1.5, 4], [2400, 3.5, 6], [3400, 2, 6]],
};
type Vowel = keyof typeof TRACT;

/**
 * The bright bands each tongue position lets out (Hz): where the tract chokes the air least,
 * the band between its resonances that the ear hears as the vowel. A rhythm's "ee" sweeps
 * them up to two and a half kilohertz and more, as recorded players' do; a drone's "oo" keeps
 * them low.
 */
export const BANDS: Record<Vowel, readonly [number, number]> = { oo: [750, 1250], ah: [900, 1500], ee: [1700, 2600], cheek: [1200, 2300] };

/** The fitted constants (see the measurements above); one object so the fitting harness can try others. */
export const DIDGE_TUNING = {
  /** How the sound leaves the bell: the radiation's rise below `radiate` (Hz), and the room's gentle fall above `top`. */
  radiate: 40, top: 5200,
  /** The air through the lips heard directly above `hfFrom` (Hz), against the bore's pressure. */
  hf: 4, hfFrom: 900,
  /** The tract's bright bands in that air: how strong against the plain air, and how sharp. */
  band: 3, hfPlain: 0.3, bandQ: 4,
  /** The mouth's pressure, softly and fully blown. */
  soft: 0.35, loud: 1.25,
  /** The lips' own resonance against the bore's resonance they play on, and their sharpness. */
  lipUnder: 0.78, lipQ: 30,
  /** The tube's plain resistance, against which the resonances' peaks are given, and a scale on every bore peak. */
  zc: 0.02, boreGain: 1, tractGain: 0.4,
  /** Noise in the air through the lips (a share of the flow). */
  turbulence: 0.05,
  /** How far the drone's pitch wanders (cents, one deviation) and how fast (Hz). */
  wander: 4, wanderRate: 0.7,
  /** How far the drone's colour drifts as the tongue settles (a share of its low resonance, one deviation) and how fast. */
  drift: 0.06, driftRate: 0.5,
  /** Where the lips play from, against the bore's first resonance (the loop runs sharp of it): the bore is tuned this much flat. */
  sharp: 1,
  /** The vowel each role's drone rests on: the bass's dark, the rhythm's, the lead's open. */
  rests: ['oo', 'oo', 'ah'] as Vowel[],
  /** How fast the breath follows a new note's strength (s). */
  follow: 0.03,
  /** The air beside the tone: the nose's sniff and the tongue's release, against the breath. */
  sniff: 0.035, tongueAir: 0.05,
  /** How firmly the lips are set together beyond the brass model's rest (more shuts them for longer each cycle). */
  press: 0.1,
  /** The toot: where the lips are tightened to (times the drone), and how much harder it is blown. */
  toot: 2.7, tootPush: 0.3,
};
/** Samples between control updates (the tract's filters are recomputed this often). */
const BLOCK = 32;

/** The nose's breath in, behind the drone (lofi-breath.ts inhale): a narrow rush high up. */
const SNIFF: InhaleShape = { bands: [{ centre: 3200, width: 1.6, top: 0.3, topHz: 6000 }, { centre: 1300, width: 1, level: -8 }], rise: 0.3, fall: 0.4 };
/** The tongue's release: a short burst of air (lofi-breath.ts airBurst). */
const TONGUE_AIR: BurstShape = { centre: 1800, width: 1.4, level: -6, length: 0.012, perStrength: 6, spread: 1.5, centreSpread: 0.2, top: 0.4, topHz: 4500 };

/** An RBJ band-pass at unit peak gain, run on the flow: its state and coefficients. */
class Peak {
  b0 = 0; a1 = 0; a2 = 0; z = 0;
  x1 = 0; x2 = 0; y1 = 0; y2 = 0;
  set(sr: number, hz: number, q: number, peak: number): void {
    const w = (2 * Math.PI * Math.min(hz, sr * 0.45)) / sr;
    const al = Math.sin(w) / (2 * q), a0 = 1 + al;
    this.b0 = al / a0; this.a1 = (-2 * Math.cos(w)) / a0; this.a2 = (1 - al) / a0; this.z = peak;
  }
  /** The part of the output already decided by the past (times the peak). */
  memory(): number { return this.z * (-this.b0 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2); }
  /** The instantaneous gain (times the peak). */
  gain(): number { return this.z * this.b0; }
  push(x: number): void {
    const y = this.b0 * x - this.b0 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
  }
  copy(o: Peak): void { this.b0 = o.b0; this.a1 = o.a1; this.a2 = o.a2; this.z = o.z; this.x1 = o.x1; this.x2 = o.x2; this.y1 = o.y1; this.y2 = o.y2; }
}

/** What the player is doing at a moment: the controls the simulation reads each block. */
interface Controls {
  /** How hard the note sounding now is blown (0 to 1; below 0 none, the span's own strength holds). */
  strength: number;
  /** The mouth's pressure, as a share of the note's. */
  breath: number;
  /** The lips' tuning: which bore resonance they sit under (1 the drone, 2 the toot, between while they move). */
  lips: number;
  /** The tongue's place: a blend between vowels. */
  vowel: Vowel; to: Vowel; blend: number;
  /** The voice: its loudness (a share of the breath) and its pitch (Hz). */
  voice: number; pitch: number;
}

/** A small seeded normal draw. */
function gauss(r: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
}

/** A smoothstep from 0 to 1 as `x` goes from `a` to `b`. */
function ease(x: number, a: number, b: number): number {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

/** Options for a player: its drone (Hz), the vowel it rests on, how bright its lips are. */
export interface DidgeOptions { sr: number; f: number; rest?: Vowel; seed: number }

/**
 * One didgeridoo and its player, as a continuous simulation. `render` carries on from where
 * the last span ended; `release` gives the sound of the breath stopping at the end of the
 * last span without moving the player on.
 */
export class Didgeridoo {
  readonly sr: number;
  readonly f: number;
  private readonly rest: Vowel;
  private readonly rand: () => number;
  private readonly bore: Peak[];
  private readonly tract: Peak[];
  private lipY = 0; private lipV = 0;
  private wander = 0; private drift = 0;
  private vphase = 0;
  private r1 = 0; private r2 = 0; private o1 = 0; private o2 = 0; private top = 0;
  private hp: { b0: number; b1: number; b2: number; a1: number; a2: number };
  private f1 = 0; private f2 = 0; private g1 = 0; private g2 = 0;
  private readonly flowHp: { b0: number; b1: number; b2: number; a1: number; a2: number };
  /** The vocal tract's filter stage on what the lips let through above the bore's resonances: its two bright bands. */
  private readonly band1 = new Peak();
  private readonly band2 = new Peak();
  private topPole: number;
  /** How long the player has been blowing (s): a fresh player speaks from silence. */
  private blown = 0;
  /** The breath's pressure, following each note's strength (below 0 until the first span). */
  private pm = -1;
  /** Samples the lips spent shut (a measure for the fitting harness). */
  closed = 0;
  private seed: number;

  constructor(o: DidgeOptions) {
    this.sr = o.sr;
    this.f = o.f;
    this.rest = o.rest ?? 'oo';
    this.seed = o.seed >>> 0;
    this.rand = seededRandom(this.seed);
    this.bore = BORE.map(() => new Peak());
    this.bore.forEach((p, k) => { const [ratio, peak, q] = BORE[k]!; p.set(o.sr, o.f * ratio, q, peak * DIDGE_TUNING.boreGain); });
    this.tract = [new Peak(), new Peak(), new Peak()];
    const w = (2 * Math.PI * DIDGE_TUNING.radiate) / o.sr, c = Math.cos(w), al = Math.sin(w) / (2 * 0.7), a0 = 1 + al;
    this.hp = { b0: (1 + c) / 2 / a0, b1: -(1 + c) / a0, b2: (1 + c) / 2 / a0, a1: (-2 * c) / a0, a2: (1 - al) / a0 };
    this.topPole = Math.exp((-2 * Math.PI * DIDGE_TUNING.top) / o.sr);
    const wh = (2 * Math.PI * DIDGE_TUNING.hfFrom) / o.sr, ch = Math.cos(wh), ah = Math.sin(wh) / (2 * 0.7), a0h = 1 + ah;
    this.flowHp = { b0: (1 + ch) / 2 / a0h, b1: -(1 + ch) / a0h, b2: (1 + ch) / 2 / a0h, a1: (-2 * ch) / a0h, a2: (1 - ah) / a0h };
  }

  /** The controls at time `t` (s into the span) given the span's notes. */
  private controls(t: number, notes: readonly DidgeEvent[], end: number): Controls {
    // The note sounding now sets how hard the drone is blown and which vowel it rests on.
    let now: DidgeEvent | undefined;
    for (const n of notes) if (n.at <= t + 0.005 && (!now || n.at >= now.at)) now = n;
    const rest = now ? DIDGE_TUNING.rests[now.role] ?? this.rest : this.rest;
    const c: Controls = { strength: now?.vel ?? -1, breath: 1, lips: 1, vowel: rest, to: rest, blend: 0, voice: 0, pitch: this.f * 2.5 };
    for (const n of notes) {
      const u = t - n.at;
      if (u < -0.05 || u > n.dur + 0.4) continue;
      const art = n.art;
      const v = n.vel;
      if (art === DIDGE_WA || art === DIDGE_PUSH) {
        // A push from the diaphragm; a "wa" opens the mouth with it and closes it again.
        c.breath *= 1 + (0.18 + 0.2 * v) * ease(u, 0, 0.025) * Math.exp(-Math.max(0, u - 0.025) / 0.12);
        if (art === DIDGE_WA && u >= 0) { c.to = 'ah'; c.blend = Math.max(c.blend, ease(u, 0, 0.07) * (1 - 0.7 * ease(u, 0.08, Math.min(0.35, n.dur + 0.05)))); }
      } else if (art === DIDGE_TONGUE) {
        // The tongue stops the air against the palate, then lets it go with a kick.
        const stop = 0.022;
        if (u >= -0.02 && u < 0) { c.breath *= 1 - 0.85 * ease(u, -0.02, -0.006); c.to = 'ee'; c.blend = 0.7; }
        else if (u >= 0) c.breath *= 1 + (0.35 + 0.3 * v) * Math.exp(-u / 0.05) - 0.85 * Math.max(0, 1 - u / stop) ** 2;
      } else if (art === DIDGE_SWEEP) {
        // "oo" to "ee" and back across the note.
        if (u >= 0 && u <= n.dur + 0.1) { c.to = 'ee'; c.blend = Math.max(c.blend, Math.sin(Math.PI * Math.min(1, u / Math.max(0.12, n.dur)))); }
      } else if (art === DIDGE_BREATH) {
        // The cheeks take over while the nose breathes in: the drone sags and darkens, then the lungs push back.
        const sag = ease(u, 0, 0.04) * (1 - ease(u, 0.13, 0.17));
        c.breath *= 1 - 0.32 * sag + (0.3 + 0.2 * v) * ease(u, 0.15, 0.18) * Math.exp(-Math.max(0, u - 0.18) / 0.14);
        if (sag > 0) { c.to = 'cheek'; c.blend = Math.max(c.blend, sag); }
      } else if (art === DIDGE_TOOT) {
        // The lips tighten onto the bore's second resonance, blown harder, for a moment.
        const len = Math.min(n.dur, 0.12 + 0.1 * v);
        const on = ease(u, -0.01, 0.012) * (1 - ease(u, len, len + 0.03));
        c.lips = 1 + (DIDGE_TUNING.toot - 1) * on;
        c.breath *= 1 + DIDGE_TUNING.tootPush * on;
        if (on > 0) { c.to = 'ee'; c.blend = Math.max(c.blend, 0.5 * on); }
      } else if (art === DIDGE_HOWL || art === DIDGE_BARK || art === DIDGE_CALL) {
        const len = art === DIDGE_BARK ? Math.min(n.dur, 0.18) : n.dur;
        const on = ease(u, 0, art === DIDGE_BARK ? 0.012 : 0.06) * (1 - ease(u, len, len + (art === DIDGE_BARK ? 0.05 : 0.12)));
        if (on <= 0) continue;
        const along = Math.min(1, Math.max(0, u / Math.max(0.05, len)));
        // The voice's pitch, high over the drone as recorded players sing (five to seven and a
        // half times it): a howl easing down, a bark falling fast, a call rising and falling.
        const rise = art === DIDGE_CALL ? Math.sin(Math.PI * along) ** 0.7 : 0;
        const pitch = art === DIDGE_HOWL ? this.f * (7.4 - 2.4 * along)
          : art === DIDGE_BARK ? this.f * (6 - 2 * along)
          : this.f * (3.2 + 4.2 * rise);
        c.voice = Math.max(c.voice, on * (art === DIDGE_BARK ? 0.55 : 0.35) * (0.7 + 0.5 * v));
        c.pitch = pitch;
        if (art === DIDGE_BARK) c.breath *= 1 + 0.5 * on;
        c.to = art === DIDGE_CALL ? (rise > 0.5 ? 'ee' : 'ah') : 'ah';
        c.blend = Math.max(c.blend, on * (art === DIDGE_CALL ? 0.4 + 0.6 * rise : 0.7));
      }
    }
    // The breath stops at the span's end only for a release.
    if (t > end) c.breath *= Math.max(0, 1 - (t - end) / 0.06) ** 2;
    return c;
  }

  /**
   * Blow `seconds` of sound, the notes' times measured from the span's start, at strength
   * `vel` underneath them (the drone's own). Returns the radiated sound.
   */
  render(notes: readonly DidgeEvent[], seconds: number, vel = 0.6, releaseAfter = Infinity): Float32Array {
    const { sr } = this;
    const T = DIDGE_TUNING;
    const n = Math.max(1, Math.round(seconds * sr));
    const out = new Float32Array(n);
    const dt = 1 / sr;
    const rand = this.rand;
    const pressureOf = (v: number): number => T.soft * (T.loud / T.soft) ** Math.min(1, Math.max(0, v));
    if (this.pm < 0) this.pm = pressureOf(vel);
    const follow = Math.exp(-BLOCK / (T.follow * sr));
    const wanderPole = Math.exp((-2 * Math.PI * T.wanderRate) / sr * BLOCK);
    const driftPole = Math.exp((-2 * Math.PI * T.driftRate) / sr * BLOCK);
    const wScale = Math.sqrt((1 + wanderPole) / (1 - wanderPole));
    const dScale = Math.sqrt((1 + driftPole) / (1 - driftPole));
    let lipW = 0, gt = 0, gb = 0, breath = 0, voice = 0, vf = this.f;
    // The instantaneous part of the bore's impedance does not change.
    gb = T.zc;
    for (const p of this.bore) gb += p.gain();
    for (let i = 0; i < n; i++) {
      if (i % BLOCK === 0) {
        const t = i * dt;
        const c = this.controls(t, notes, releaseAfter);
        this.wander = wanderPole * this.wander + (1 - wanderPole) * gauss(rand);
        this.drift = driftPole * this.drift + (1 - driftPole) * gauss(rand);
        const cents = this.wander * wScale * T.wander * (1 - wanderPole);
        // The lips sit under the resonance they play on: the drone's, or the toot's.
        const target = this.f * c.lips * 2 ** (cents / 1200);
        lipW = 2 * Math.PI * target * T.lipUnder;
        // A fresh player's breath comes in over a few tens of milliseconds.
        const swell = Math.min(1, (this.blown + t) / 0.04);
        this.pm = follow * this.pm + (1 - follow) * pressureOf(c.strength >= 0 ? c.strength : vel);
        breath = this.pm * c.breath * swell;
        voice = c.voice * this.pm;
        vf = c.pitch;
        // The tract: the resting vowel blended towards the one the note moves to, drifting a little.
        const a = TRACT[c.vowel], b = TRACT[c.to];
        const [a1, a2] = BANDS[c.vowel], [b1, b2] = BANDS[c.to];
        this.band1.set(sr, a1 * (b1 / a1) ** c.blend, T.bandQ, 1);
        this.band2.set(sr, a2 * (b2 / a2) ** c.blend, T.bandQ, 1);
        const d = 1 + this.drift * dScale * T.drift * (1 - driftPole);
        gt = 0;
        for (let j = 0; j < 3; j++) {
          const [fa, za, qa] = a[j]!, [fb, zb, qb] = b[j]!;
          const hz = fa * (fb / fa) ** c.blend * (j === 1 ? d : 1);
          this.tract[j]!.set(sr, hz, qa + (qb - qa) * c.blend, (za + (zb - za) * c.blend) * T.tractGain);
          gt += this.tract[j]!.gain();
        }
      }
      // The voice behind the lips: a glottal pulse at its pitch, without its mean.
      let pv = 0;
      if (voice > 0) {
        this.vphase += vf / sr;
        if (this.vphase >= 1) this.vphase -= 1;
        const ph = this.vphase;
        pv = voice * ((ph < 0.6 ? 0.5 - 0.5 * Math.cos((2 * Math.PI * ph) / 0.6) : 0) - 0.3);
      }
      // What the past has already decided of the bore's and the tract's pressure.
      let mb = 0, mt = 0;
      for (const p of this.bore) mb += p.memory();
      for (const p of this.tract) mt += p.memory();
      // The lips' gap, and the flow through it, solved with both pressures (Bernoulli).
      const gap = Math.max(0, LIP_REST - T.press + this.lipY) * LIP_GAP;
      if (gap === 0) this.closed++;
      const g = gb + gt;
      const drive = breath + pv - mb - mt;
      let dp: number, u: number;
      if (drive >= 0) { const s = (-g * gap + Math.sqrt(g * g * gap * gap + 4 * drive)) / 2; dp = s * s; u = gap * s; }
      else { const s = (-g * gap + Math.sqrt(g * g * gap * gap - 4 * drive)) / 2; dp = -s * s; u = -gap * s; }
      u *= 1 + (rand() * 2 - 1) * T.turbulence;
      for (const p of this.bore) p.push(u);
      for (const p of this.tract) p.push(u);
      // The lips move under the pressure across them.
      this.lipV += (lipW * lipW * (LIP_COMPLIANCE * dp - this.lipY) - (lipW / T.lipQ) * this.lipV) * dt;
      this.lipY += this.lipV * dt;
      // The pressure in the mouthpiece, radiated from the bell: the lows thinned, the top softened.
      // What leaves the bell: the bore's own pressure below about a kilohertz, where it
      // resonates, and above that the air the lips let through, which the wide bore passes on.
      const pb = gb * u + mb;
      const h = this.hp;
      const y = h.b0 * pb + h.b1 * this.r1 + h.b2 * this.r2 - h.a1 * this.o1 - h.a2 * this.o2;
      this.r2 = this.r1; this.r1 = pb; this.o2 = this.o1; this.o1 = y;
      // Above the bore's resonances (a two-pole high-pass on the air through the lips).
      const fh = this.flowHp;
      const above = fh.b0 * u + fh.b1 * this.f1 + fh.b2 * this.f2 - fh.a1 * this.g1 - fh.a2 * this.g2;
      this.f2 = this.f1; this.f1 = u; this.g2 = this.g1; this.g1 = above;
      const b1 = this.band1.memory() + this.band1.gain() * above, b2 = this.band2.memory() + this.band2.gain() * above;
      this.band1.push(above); this.band2.push(above);
      const hf = (above * T.hfPlain + b1 * T.band + b2 * T.band * 0.7) * T.hf;
      this.top = (1 - this.topPole) * (y + hf) + this.topPole * this.top;
      out[i] = this.top;
    }
    this.blown += seconds;
    this.addAir(out, notes);
    return out;
  }

  /** A copy of the player as it stands, to try a release on without moving this one on. */
  clone(): Didgeridoo {
    const d = new Didgeridoo({ sr: this.sr, f: this.f, rest: this.rest, seed: this.seed });
    d.lipY = this.lipY; d.lipV = this.lipV; d.wander = this.wander; d.drift = this.drift; d.vphase = this.vphase;
    d.r1 = this.r1; d.r2 = this.r2; d.o1 = this.o1; d.o2 = this.o2; d.top = this.top; d.f1 = this.f1; d.f2 = this.f2; d.g1 = this.g1; d.g2 = this.g2; d.blown = this.blown; d.pm = this.pm;
    this.bore.forEach((p, k) => { d.bore[k]!.copy(p); });
    this.tract.forEach((p, k) => { d.tract[k]!.copy(p); });
    d.band1.copy(this.band1); d.band2.copy(this.band2);
    return d;
  }

  /** The air the breath makes beside the tone, into `out`: the nose's sniff in each circular breath and the tongue's release, for the notes that start in the span. */
  private addAir(out: Float32Array, notes: readonly DidgeEvent[]): void {
    const { sr } = this;
    const span = out.length / sr;
    for (const nt of notes) {
      if (nt.at < 0 || nt.at >= span) continue;
      const seed = (this.seed ^ Math.imul(Math.round((this.blown - span + nt.at) * 1000), 0x9e3779b1)) >>> 0;
      let air: Float32Array | null = null, at = 0, g = 0;
      if (nt.art === DIDGE_BREATH) { air = inhale(sr, 0.13, SNIFF, seed); at = nt.at + 0.02; g = DIDGE_TUNING.sniff * (0.7 + 0.6 * nt.vel); }
      else if (nt.art === DIDGE_TONGUE || nt.art === DIDGE_TOOT) { air = airBurst(sr, TONGUE_AIR, { strength: nt.vel, speed: 0.5, seed }, 0.08); at = nt.at; g = DIDGE_TUNING.tongueAir; }
      if (!air) continue;
      const from = Math.round(at * sr);
      for (let i = 0; i < air.length && from + i < out.length; i++) out[from + i]! += air[i]! * g * this.pm;
    }
  }
}
