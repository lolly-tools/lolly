// SPDX-License-Identifier: MPL-2.0
/**
 * The producer's tag played: a voice saying "Lolly" (lib/lofi-voice.ts), rendered once per
 * tune and delivery, then played back. The echo delivery, and a little of the sung one,
 * also feed the station's echo, so the word repeats in time. The band's shouted phrases
 * ("pick it up", "let's go", "go") are played the same way, each call rendered once.
 */
import { LOFI_SHOUT_CROWD, LOFI_SHOUT_PHRASES } from '../../../../engine/src/lofi-compose.ts';
import { sayLolly, sayShout, SHOUT_PHRASES, TAG_DELIVERIES } from './lofi-voice.ts';
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

/** The shouted phrases rendered so far, per context. */
const SHOUTS = new WeakMap<BaseAudioContext, Map<string, { buf: AudioBuffer; at: number }>>();

/** Whether a `hey` note's `mod` is one of the band's phrases (said by the formant voice) rather than a one-vowel shout. */
export function isShoutPhrase(mod: number): boolean {
  return mod % LOFI_SHOUT_CROWD >= LOFI_SHOUT_PHRASES && SHOUT_PHRASES[(mod % LOFI_SHOUT_CROWD) - LOFI_SHOUT_PHRASES] !== undefined;
}

/**
 * Shout a band's phrase with its stressed vowel on `t`: `mod` is the `hey` note's (the
 * phrase, plus LOFI_SHOUT_CROWD for the crowd), `midi` the note it is pitched to and `beat`
 * the tune's beat (s). `voice` is the tune's identity, which draws the caller and the
 * crowd; `take` tells this call from the tune's others, so each is said a little differently.
 */
export function bandShout(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, mod: number, beat: number, voice: string, take: string): void {
  const phrase = SHOUT_PHRASES[(mod % LOFI_SHOUT_CROWD) - LOFI_SHOUT_PHRASES];
  if (!phrase) return;
  const crowd = mod >= LOFI_SHOUT_CROWD;
  const { ctx } = k;
  let cache = SHOUTS.get(ctx);
  if (!cache) { cache = new Map(); SHOUTS.set(ctx, cache); }
  const key = `${voice}|${phrase}|${crowd ? 'crowd' : 'one'}|${midi}|${beat.toFixed(3)}|${take}`;
  let said = cache.get(key);
  if (!said) {
    if (cache.size > 48) cache.clear();
    const { audio: [left, right], at } = sayShout(ctx.sampleRate, phrase, { midi, beat, crowd }, seeded(`${voice}|shouts`), seeded(key));
    const buf = ctx.createBuffer(2, left.length, ctx.sampleRate);
    buf.getChannelData(0).set(left);
    buf.getChannelData(1).set(right);
    said = { buf, at };
    cache.set(key, said);
  }
  const src = ctx.createBufferSource();
  src.buffer = said.buf;
  const g = ctx.createGain();
  g.gain.value = SHOUT_LEVEL * vel;
  src.connect(g).connect(out);
  // The stressed vowel falls on the beat; whatever comes before the vowel ("let's") starts early.
  // Too late to start it whole (a stalled page, or the very top of a render), it starts in step, clipped.
  const start = t - said.at, now = ctx.currentTime;
  if (start >= now) src.start(start);
  else src.start(now, now - start);
}
/** The shouts' level on the effects lane: set against the band from the stems (see the station's notes). */
const SHOUT_LEVEL = 0.26;
