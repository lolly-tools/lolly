// SPDX-License-Identifier: MPL-2.0
/**
 * The producer's tag played: a voice saying "Lolly" (lib/lofi-voice.ts), rendered once per
 * tune and delivery, then played back. The echo delivery, and a little of the sung one,
 * also feed the station's echo, so the word repeats in time.
 */
import { sayLolly, TAG_DELIVERIES } from './lofi-voice.ts';
import type { VoiceKit } from './lofi-voices.ts';

/** The tags rendered so far, per context. */
const TAGS = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();

/** A small seeded source, from a string, so a tune's tag is the same voice every time. */
function seeded(key: string): () => number {
  let a = 2166136261;
  for (let i = 0; i < key.length; i++) a = Math.imul(a ^ key.charCodeAt(i), 16777619) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Say "Lolly" at `t`, in delivery `which` (an index of LOFI_TAGS), `midi` the tune's key
 * note in the singing range and `beat` its beat (s). `voice` is the tune's identity, which
 * draws the speaker. `echo` is the station's echo input, for the deliveries that use the echo.
 */
export function lollyTag(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, which: number, beat: number, voice: string, echo?: AudioNode): void {
  const delivery = TAG_DELIVERIES[which] ?? 'spoken';
  const { ctx } = k;
  let cache = TAGS.get(ctx);
  if (!cache) { cache = new Map(); TAGS.set(ctx, cache); }
  const key = `${voice}|${delivery}|${midi}|${beat.toFixed(3)}`;
  let buf = cache.get(key);
  if (!buf) {
    if (cache.size > 64) cache.clear();
    const [left, right] = sayLolly(ctx.sampleRate, delivery, { midi, beat }, seeded(key));
    buf = ctx.createBuffer(2, left.length, ctx.sampleRate);
    buf.getChannelData(0).set(left);
    buf.getChannelData(1).set(right);
    cache.set(key, buf);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = TAG_LEVEL * vel * (delivery === 'whisper' ? 0.65 : 1);
  src.connect(g).connect(out);
  if (echo && (delivery === 'echo' || delivery === 'sung')) {
    const send = ctx.createGain();
    send.gain.value = delivery === 'echo' ? 0.75 : 0.25;
    g.connect(send).connect(echo);
  }
  src.start(t);
}
/** The tag's level on the effects lane, about a lead's. */
const TAG_LEVEL = 0.5;
