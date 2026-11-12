// SPDX-License-Identifier: MPL-2.0
/**
 * The reed leads played: the saxophone and the clarinet blown in their waveguides
 * (lib/lofi-reeds.ts), one note at a time as it comes, then through the instrument's body:
 * the sax's bell, which rolls off its top and warms its middle, and the clarinet's darker
 * wood. A note slurred from the one before glides there inside the bore, so it has no new
 * attack, and a bent note (the composer's art 1) is scooped up from a semitone below.
 */
import { blowReed } from './lofi-reeds.ts';
import { EPS, mtof, type VoiceKit } from './lofi-voices.ts';

export const REED_LEADS = new Set<string>(['sax', 'clarinet']);

/** A small seeded source, from the station's own, so a tune's notes are the same each time. */
function seeded(k: VoiceKit): () => number {
  let a = Math.floor(k.rng() * 4294967296) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function lead(style: string, k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art = 0, from?: number): void {
  const { ctx } = k;
  const sax = style === 'sax';
  const held = Math.max(0.06, dur);
  const data = blowReed({
    sr: ctx.sampleRate, f: mtof(midi), from: from === undefined ? undefined : mtof(from), vel, dur: held, seconds: held + 0.12,
    bore: sax ? 'cone' : 'cylinder', vibrato: sax ? 22 : 6, rate: 5.1 + k.rng() * 0.6, scoop: art === 1 ? 1 : 0, attack: sax ? 0.012 : 0.045,
  }, seeded(k));
  const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
  buf.getChannelData(0).set(data);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  // The body: a sax's bell warms the middle and rolls the top off; a clarinet's wood is darker still.
  const warm = ctx.createBiquadFilter();
  warm.type = 'peaking';
  warm.frequency.value = sax ? 650 : 1500;
  warm.Q.value = 1;
  warm.gain.value = sax ? 3 : 2;
  const top = ctx.createBiquadFilter();
  top.type = 'lowpass';
  top.frequency.value = sax ? 5200 : 4200;
  top.Q.value = 0.6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(sax ? SAX_LEVEL : CLARINET_LEVEL, t);
  g.gain.setTargetAtTime(EPS, t + held + 0.08, 0.02);
  src.connect(warm).connect(top).connect(g).connect(out);
  src.start(t);
}
/** The blown reeds' levels against the voices they replaced. */
const SAX_LEVEL = 0.044;
const CLARINET_LEVEL = 0.065;
