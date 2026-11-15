// SPDX-License-Identifier: MPL-2.0
/**
 * The wind singing in the she-oaks (casuarinas) on the dunes behind a beach: Noosacore's
 * other sound of the coast, a soft, pitched whistling hiss that rises and falls with each
 * gust. Lolly ships no recordings, so this is a model of how the sound is made, driven by
 * a seed: the same seed always gives the same bytes.
 *
 * A she-oak's leaves are fine jointed branchlets, a millimetre or less across, by the
 * million. Air flowing past a thin cylinder sheds vortices from each side in turn and the
 * cylinder whistles (an aeolian tone) at about a fifth of the wind's speed over its
 * diameter. So the tree sings a band of whistles, as many pitches as there are branchlets
 * of different thicknesses in air moving at different speeds, all rising together when a
 * gust gets up and falling as it dies. The model is that band: white noise rung through a
 * dozen narrow resonances spread around a centre that follows the gust (an
 * Ornstein-Uhlenbeck swell, shared with botanica's wind, lib/lofi-nature.ts gustCurve), each
 * wandering a little on its own as the flow round its twigs does, louder as the wind
 * rises; under them the trees' broad sigh, most of it under a kilohertz, and a breath of
 * hiss from the branchlets brushing. The two channels hear different trees, so they share
 * the gust and part of the sigh but not the whistles.
 *
 * Fitted against field recordings of she-oaks singing in the wind from Freesound
 * (kangaroovindaloo's Pink Lakes she-oak forest, 266635 and 266656, CC0, and from inside a
 * she-oak, 266631, CC BY 4.0; measured only, no recording is in this repository), each
 * measured with the same code as the model: the band's centre and how far it moves, how
 * pitched the band is above the noise, how much and how long the wind gusts, and the
 * spectrum. The numbers are in docs/generated-music.md.
 *
 * Pure: no DOM, no Web Audio.
 */
import { Biquad, gustCurve, mix, seeded, type Stereo } from './lofi-nature.ts';

/** Pink-ish noise (Paul Kellet's economy filter over white), about unit level. */
class Pink {
  private p0 = 0; private p1 = 0; private p2 = 0;
  private readonly r: () => number;
  constructor(r: () => number) { this.r = r; }
  next(): number {
    const w = this.r() * 2 - 1;
    this.p0 = 0.99765 * this.p0 + w * 0.099;
    this.p1 = 0.963 * this.p1 + w * 0.2965;
    this.p2 = 0.57 * this.p2 + w * 1.0526;
    return (this.p0 + this.p1 + this.p2 + w * 0.1848) * 0.25;
  }
}

/** Samples between the resonances' retunings. */
const BLOCK = 64;
/** The band's centre at a gust's mean (Hz), and how far a gust a deviation stronger lifts it (a ratio). */
const CENTRE = 585;
const LIFT = 1.1;
/** The gust's mean and its spread (lib/lofi-nature.ts gustCurve): a steady breeze off the sea, not a gale. */
const GUST = [0.5, 0.13] as const;
/** How many whistles each channel sings, and how widely their pitches spread (a log-normal spread, in octaves). */
const WHISTLES = 9;
const SPREAD = 0.4;
/** The whistles' level over the branchlets' broad sigh. */
const WHISTLE = 0.19;

/** `seconds` of wind in the she-oaks, from `seed`. Stereo, peak about 0.4 in a strong gust. */
export function sheOaks(sr: number, seconds: number, seed: number): Stereo {
  const n = Math.ceil(seconds * sr);
  const gust = gustCurve(sr, n, mix(seed, 0x5e0a), 3.2, GUST[0], GUST[1]);
  const out: Stereo = [new Float32Array(n), new Float32Array(n)];
  // The trees' broad sigh is partly the same in both ears; the whistles are each ear's own.
  const shared = new Pink(seeded(mix(seed, 0x5e0c)));
  const common = new Float32Array(n);
  for (let i = 0; i < n; i++) common[i] = shared.next();
  for (let ch = 0; ch < 2; ch++) {
    const r = seeded(mix(seed, ch, 0x5e0b));
    const gauss = (): number => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
    const whistles = Array.from({ length: WHISTLES }, () => ({
      ratio: 2 ** (gauss() * SPREAD),
      q: 7 + r() * 9,
      gain: 0.5 + r() * 0.5,
      wobble: r() * Math.PI * 2,
      rate: 0.15 + r() * 0.5,
      filter: new Biquad(sr),
    }));
    const pink = new Pink(r);
    const bedHp = new Biquad(sr).set('hp', 110, 0.6), bedLp = new Biquad(sr).set('lp', 1150, 0.6);
    const hissHp = new Biquad(sr).set('hp', 1800, 0.7), hissLp = new Biquad(sr).set('lp', 4200, 0.7);
    const o = out[ch]!;
    // The other channel's trees catch the gust a moment later.
    const lag = ch ? Math.round(0.35 * sr) : 0;
    let level = 0;
    for (let b = 0; b * BLOCK < n; b++) {
      const at = b * BLOCK;
      const u = gust[Math.max(0, at - lag)]!;
      const t = at / sr;
      const centre = CENTRE * LIFT ** ((u - GUST[0]) / GUST[1]);
      for (const w of whistles) {
        const f = centre * w.ratio * (1 + 0.04 * Math.sin(w.wobble + 2 * Math.PI * w.rate * t));
        w.filter.set('bp', f, w.q);
      }
      // Louder as the wind rises, more than in proportion: an aeolian tone's power grows steeply with the speed.
      level = (u / GUST[0]) ** 1.5;
      const end = Math.min(n, at + BLOCK);
      for (let i = at; i < end; i++) {
        const x = r() * 2 - 1;
        let sum = 0;
        for (const w of whistles) sum += w.filter.run(x) * w.gain;
        o[i] = (bedLp.run(bedHp.run(pink.next() * 0.8 + common[i]! * 0.6)) * 0.5 + sum * WHISTLE + hissLp.run(hissHp.run(x)) * 0.012) * level * 0.3;
      }
    }
  }
  return out;
}
