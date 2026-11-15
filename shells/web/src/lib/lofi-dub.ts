// SPDX-License-Identifier: MPL-2.0
/**
 * Jungle's dub: the echo and spring its stabs are thrown into, and its siren. Called by the
 * station for a jungle tune's keys and its `siren` notes (engine/src/lofi-jungle.ts).
 *
 * THE ECHO is a tape echo in the dub manner: a delay a dotted eighth long at the tune's
 * tempo, each repeat darker and thinner (a band-pass in the loop) and a little saturated,
 * fed from the keys lane through a send that opens for each stab of a drop. The last stab of
 * every four bars is thrown: the send opened wide and the feedback raised for a beat or two,
 * so the chord echoes on into the next phrase, as a dub engineer rides the send.
 * THE SPRING is the modelled tank of lib/lofi-spring.ts, a little of every keys note and
 * all of the echo going into the tank.
 * THE SIREN is an original synth siren, no recording: a square wave and a triangle an octave
 * under, through a low-pass, its pitch swept by an oscillator of its own (the wail rising
 * and falling, the whoop rising again and again, the pulse trilling between two pitches, the
 * dive falling away), into the echo.
 */
import type { LofiBar, LofiMood } from '../../../../engine/src/lofi-compose.ts';
import { JUNGLE_SIRENS } from '../../../../engine/src/lofi-jungle.ts';
import { LONG_TANK, springImpulse } from './lofi-spring.ts';
import { drivenBy, mtof, type VoiceKit } from './lofi-voices.ts';

/** The genres whose keys are thrown into the dub echo. */
const DUBBED = new Set<LofiMood>(['jungle']);
export const dubbed = (mood: LofiMood): boolean => DUBBED.has(mood);

/** The echo's settings: each stab's send, a throw's, the feedback held and thrown, the spring's send and return. */
const STAB_SEND = 0.28, THROW_SEND = 0.85, FEEDBACK = 0.42, THROW_FEEDBACK = 0.66, SPRING_SEND = 0.16, SPRING_RETURN = 0.55, ECHO_RETURN = 0.7;

/** The spring tank's impulse, once per audio context. */
const SPRINGS = new WeakMap<BaseAudioContext, AudioBuffer>();
function springBuffer(ctx: BaseAudioContext): AudioBuffer {
  let b = SPRINGS.get(ctx);
  if (!b) {
    const data = springImpulse(ctx.sampleRate, LONG_TANK, 7);
    b = ctx.createBuffer(1, data.length, ctx.sampleRate);
    b.getChannelData(0).set(data);
    SPRINGS.set(ctx, b);
  }
  return b;
}

/** One tune's dub chain on its keys lane: the stab send, the echo with its feedback, and the spring. */
interface Chain { send: GainNode; delay: DelayNode; feedback: GainNode; siren: GainNode }
const CHAINS = new WeakMap<AudioNode, Chain>();
function chainOf(k: VoiceKit, keys: AudioNode, fx: AudioNode, spb: number): Chain {
  const had = CHAINS.get(keys);
  if (had) return had;
  const { ctx } = k;
  const send = ctx.createGain();
  send.gain.value = 0;
  keys.connect(send);
  const delay = ctx.createDelay(2);
  delay.delayTime.value = Math.min(1.9, spb * 0.75);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 380; hp.Q.value = 0.6;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.6;
  const [push, ws] = drivenBy(ctx, 1.2);
  // The saturation's own gain undone (its curve rises 2.5 / tanh 2.5 at silence), so the loop's gain is the feedback alone and the echo dies away.
  const back = ctx.createGain();
  back.gain.value = 1 / (1.2 * (2.5 / Math.tanh(2.5)));
  const feedback = ctx.createGain();
  feedback.gain.value = FEEDBACK;
  send.connect(delay);
  delay.connect(hp).connect(lp).connect(push);
  ws.connect(back).connect(feedback).connect(delay);
  const echo = ctx.createGain();
  echo.gain.value = ECHO_RETURN;
  back.connect(echo).connect(fx);
  // The spring: a little of every keys note, and the echo's repeats.
  const tank = ctx.createConvolver();
  tank.normalize = false;
  tank.buffer = springBuffer(ctx);
  const springIn = ctx.createGain();
  springIn.gain.value = 1;
  const springSend = ctx.createGain();
  springSend.gain.value = SPRING_SEND;
  keys.connect(springSend).connect(springIn);
  back.connect(springIn);
  const ret = ctx.createGain();
  ret.gain.value = SPRING_RETURN;
  springIn.connect(tank).connect(ret).connect(fx);
  // The siren's own way in: straight to the effects lane and into the echo.
  const siren = ctx.createGain();
  siren.connect(fx);
  const sirenSend = ctx.createGain();
  sirenSend.gain.value = 0.6;
  siren.connect(sirenSend).connect(delay);
  const chain = { send, delay, feedback, siren };
  CHAINS.set(keys, chain);
  return chain;
}

/**
 * A jungle keys note: in a drop it is a stab, its send opened for the stab's length; the last
 * stab of every four bars is thrown, the send wide and the feedback up for two beats.
 */
export function stab(k: VoiceKit, keys: AudioNode, fx: AudioNode, bar: LofiBar, beat: number, t: number, len: number): void {
  const spb = 60 / bar.tune.bpm;
  const chain = chainOf(k, keys, fx, spb);
  if (bar.section !== 'drop') return;
  const last = !bar.notes.some(n => n.voice === 'keys' && n.beat > beat + 0.01);
  const thrown = bar.index % 4 === 3 && last;
  chain.send.gain.setTargetAtTime(thrown ? THROW_SEND : STAB_SEND, t, 0.004);
  chain.send.gain.setTargetAtTime(0, t + Math.max(0.05, len), 0.02);
  if (thrown) {
    chain.feedback.gain.setTargetAtTime(THROW_FEEDBACK, t, 0.01);
    chain.feedback.gain.setTargetAtTime(FEEDBACK, t + 2 * spb, 0.3);
  }
}

/**
 * The dub siren: `midi` its home pitch, `mod` its kind (JUNGLE_SIRENS), `len` seconds. A
 * square and a triangle an octave under, through a low-pass, the pitch swept by the kind's
 * own movement, swelling in and out.
 */
export function siren(k: VoiceKit, keys: AudioNode, fx: AudioNode, bar: LofiBar, t: number, midi: number, vel: number, len: number, mod: number): void {
  const { ctx } = k;
  const spb = 60 / bar.tune.bpm;
  const chain = chainOf(k, keys, fx, spb);
  const kind = JUNGLE_SIRENS[mod] ?? 'wail';
  const f = mtof(midi);
  const end = t + len;
  const sq = ctx.createOscillator();
  sq.type = 'square';
  const tri = ctx.createOscillator();
  tri.type = 'triangle';
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 1.2;
  const amp = ctx.createGain();
  const level = 0.05 * vel;
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(level, t + 0.08);
  amp.gain.setValueAtTime(level, end - 0.25);
  amp.gain.exponentialRampToValueAtTime(0.0001, end);
  const triLevel = ctx.createGain();
  triLevel.gain.value = 0.6;
  sq.connect(lp);
  tri.connect(triLevel).connect(lp);
  lp.connect(amp).connect(chain.siren);
  // The pitch: set on both oscillators, the triangle an octave under.
  const at = (hz: number, when: number, ramp: 'set' | 'lin' | 'exp'): void => {
    for (const [o, mul] of [[sq, 1], [tri, 0.5]] as const) {
      const v = Math.max(20, hz * mul);
      if (ramp === 'set') o.frequency.setValueAtTime(v, when);
      else if (ramp === 'lin') o.frequency.linearRampToValueAtTime(v, when);
      else o.frequency.exponentialRampToValueAtTime(v, when);
    }
  };
  at(f, t, 'set');
  if (kind === 'wail') {
    // Up a fifth and back, slowly, again and again: the classic rise and fall.
    const cycle = Math.max(0.6, spb * 2);
    for (let c = t; c < end; c += cycle) { at(f * 1.5, Math.min(end, c + cycle / 2), 'lin'); at(f, Math.min(end, c + cycle), 'lin'); }
  } else if (kind === 'whoop') {
    // Swooping up an octave from a fourth under, three or four times.
    const n = Math.max(2, Math.round(len / (spb * 1.5)));
    for (let i = 0; i < n; i++) { const c = t + (i * len) / n; at(f * 0.75, c, 'set'); at(f * 2, c + (len / n) * 0.9, 'exp'); }
  } else if (kind === 'pulse') {
    // A trill between the note and its fifth, sixteenths at the tune's tempo, rising a little as it goes.
    const step = spb / 4;
    let i = 0;
    for (let c = t; c < end; c += step, i++) at(f * (i % 2 ? 1.5 : 1) * (1 + (0.12 * (c - t)) / len), c, 'set');
  } else {
    // A dive: from an octave over, falling two octaves.
    at(f * 2, t, 'set');
    at(f / 2, end, 'exp');
  }
  for (const o of [sq, tri]) { o.start(t); o.stop(end + 0.05); }
}
