// SPDX-License-Identifier: MPL-2.0
/**
 * The Lofi station: plays engine/src/lofi-compose.ts's endless stream of bars through the
 * instruments in ./lofi-voices.ts and a lofi signal chain, live or offline.
 *
 *   music (keys + lead, with a slow tremolo on the keys, and bass)
 *     → ducked a little under each kick
 *     → tape wow and flutter (a delay line whose time wobbles)
 *   drums, and a reverb send from the keys and lead
 *     → tone (a low-pass that the mood, the texture and each bar's "open" set)
 *     → gentle saturation → glue compression → volume
 *   texture: vinyl crackle, tape hiss and, in the rainy mood, rain, joins after the tone
 *   filter so it stays crisp under the muffled music.
 *
 * Three controls change it while it plays: mood (starts a new tune in that mood),
 * drums on or off, and texture (clean to dusty: more wobble, crackle, hiss, warmth and
 * muffle). Skip starts a new tune. Everything random is seeded from the tune, so
 * renderLofi() gives the same bytes for the same seed and settings every time.
 *
 * Scheduling is the usual look-ahead: a timer queues each bar's notes on the audio
 * clock a little ahead of time. A hidden tab's timers run slowly, so while the page
 * is hidden the station queues a few seconds ahead instead of a quarter of one.
 */
import { lofiStream, LOFI_DRUM_VOICES } from '../../../../engine/src/lofi-compose.ts';
import type { LofiBar, LofiMood, LofiNote, LofiStream } from '../../../../engine/src/lofi-compose.ts';
import { mulberry32 } from '../../../../engine/src/zzfx-compose.ts';
import * as V from './lofi-voices.ts';

export interface LofiSettings {
  mood: LofiMood;
  drums: boolean;
  /** 0 clean … 1 dusty. */
  texture: number;
}

/** Part levels, for tuning the balance. 1 is the designed level. */
export interface LofiMix { keys: number; bass: number; lead: number; drums: number; reverb: number; texture: number }
export const LOFI_MIX: LofiMix = { keys: 1, bass: 1, lead: 1, drums: 1, reverb: 1, texture: 1 };

/** The tone filter's most open cutoff per mood (Hz); texture and each bar close it from there. */
const MOOD_TONE: Record<LofiMood, number> = { warm: 7500, lateNight: 4300, rainy: 5400 };
const DRUMS = new Set(LOFI_DRUM_VOICES);
/**
 * Each part's designed level. Measured K-weighted, soloed, so the whole station sits near
 * -20 LUFS: keys about -25, drums -26, bass -27 (it carries more than it sounds), lead -29
 * and the texture down at -40, a bed you notice only when it stops.
 */
const BUS = { keys: 0.26, bass: 0.115, lead: 1.38, drums: 0.47, texture: 0.85 };
const LOOKAHEAD = 0.25;
const LOOKAHEAD_HIDDEN = 3;

interface Queued { at: number; spb: number; note: LofiNote; bar: LofiBar; lanes: Lanes }
interface Mark { at: number; bar: LofiBar }
/** One tune's inputs to the buses, so skipping can fade out what is still ringing. */
interface Lanes { keys: GainNode; bass: GainNode; lead: GainNode; drums: GainNode }

export class LofiStation {
  readonly ctx: BaseAudioContext;
  /** The bar now playing (live only), and a callback when it changes. */
  current: LofiBar | null = null;
  onBar: ((bar: LofiBar) => void) | null = null;

  private settings: LofiSettings;
  private mix: LofiMix;
  private stream: LofiStream;
  private kit: V.VoiceKit;
  private queue: Queued[] = [];
  private marks: Mark[] = [];
  private nextBarAt = 0;
  private lastOpen = 1;
  private timer: ReturnType<typeof setInterval> | null = null;
  private sources: AudioScheduledSourceNode[] = [];

  private readonly out: GainNode;
  private readonly keysBus: GainNode;
  private readonly bassBus: GainNode;
  private readonly leadBus: GainNode;
  private readonly drumBus: GainNode;
  private readonly music: GainNode;
  private readonly reverbSend: GainNode;
  private readonly tone: BiquadFilterNode;
  private readonly shaper: WaveShaperNode;
  private readonly wowDepth: GainNode;
  private readonly flutterDepth: GainNode;
  private readonly crackle: GainNode;
  private readonly hiss: GainNode;
  private readonly rain: GainNode;
  private lanes: Lanes;

  constructor(ctx: BaseAudioContext, dest: AudioNode, seed: number, settings: LofiSettings, mix: LofiMix = LOFI_MIX) {
    this.ctx = ctx;
    this.settings = { ...settings };
    this.mix = { ...mix };
    this.stream = lofiStream(seed, { mood: settings.mood });
    const noise = noiseBuffer(ctx, 2, mulberry32(seed ^ 0x51));
    this.kit = { ctx, noise, rng: mulberry32(seed ^ 0x5eed) };

    // Output: tone → high-pass → saturation → compression → volume.
    this.out = ctx.createGain();
    this.out.connect(dest);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 10; comp.ratio.value = 2.5;
    comp.attack.value = 0.015; comp.release.value = 0.3;
    comp.connect(this.out);
    this.shaper = ctx.createWaveShaper();
    this.shaper.oversample = '2x';
    this.shaper.connect(comp);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 28;
    hp.connect(this.shaper);
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass'; this.tone.Q.value = 0.5;
    this.tone.frequency.value = MOOD_TONE[settings.mood];
    this.tone.connect(hp);

    // Music: keys (with tremolo), lead and bass → duck → wow and flutter → tone.
    const wow = ctx.createDelay(0.1);
    wow.delayTime.value = 0.02;
    wow.connect(this.tone);
    this.music = ctx.createGain();
    this.music.connect(wow);
    this.wowDepth = ctx.createGain();
    this.flutterDepth = ctx.createGain();
    this.lfo(0.47, this.wowDepth).connect(wow.delayTime);
    this.lfo(6.3, this.flutterDepth).connect(wow.delayTime);
    this.keysBus = ctx.createGain();
    const trem = ctx.createGain();
    trem.gain.value = 0.92;
    const tremDepth = ctx.createGain();
    tremDepth.gain.value = 0.08;
    this.lfo(4.4, tremDepth).connect(trem.gain);
    this.keysBus.connect(trem).connect(this.music);
    this.leadBus = ctx.createGain();
    this.leadBus.connect(this.music);
    this.bassBus = ctx.createGain();
    this.bassBus.connect(this.music);
    this.drumBus = ctx.createGain();
    this.drumBus.connect(this.tone);

    // A room: a seeded, darkening noise tail, fed from the keys and lead.
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, 2.6, mulberry32(seed ^ 0x7e));
    this.reverbSend = ctx.createGain();
    this.keysBus.connect(this.reverbSend);
    this.leadBus.connect(this.reverbSend);
    this.reverbSend.connect(reverb).connect(this.tone);

    // Texture, after the tone filter.
    this.crackle = ctx.createGain();
    this.crackle.connect(this.shaper);
    const crackleHp = ctx.createBiquadFilter();
    crackleHp.type = 'highpass'; crackleHp.frequency.value = 600;
    crackleHp.connect(this.crackle);
    this.loop(crackleBuffer(ctx, 3.3, mulberry32(seed ^ 0xc4)), crackleHp);
    this.hiss = ctx.createGain();
    this.hiss.connect(this.shaper);
    const hissLp = ctx.createBiquadFilter();
    hissLp.type = 'lowpass'; hissLp.frequency.value = 6500;
    hissLp.connect(this.hiss);
    this.loop(noise, hissLp);
    this.rain = ctx.createGain();
    this.rain.connect(this.shaper);
    const rainBp = ctx.createBiquadFilter();
    rainBp.type = 'bandpass'; rainBp.frequency.value = 1100; rainBp.Q.value = 0.35;
    const gust = ctx.createGain();
    gust.gain.value = 0.75;
    const gustDepth = ctx.createGain();
    gustDepth.gain.value = 0.25;
    this.lfo(0.07, gustDepth).connect(gust.gain);
    rainBp.connect(gust).connect(this.rain);
    this.loop(noise, rainBp, 0.37);

    this.lanes = this.newLanes();
    this.applyMix();
    this.applyTexture(0);
  }

  // ── controls ──────────────────────────────────────────────────────────────

  /** Start playing on a live AudioContext. */
  start(): void {
    if (this.timer) return;
    this.nextBarAt = this.ctx.currentTime + 0.1;
    this.tick();
    this.timer = setInterval(() => this.tick(), 25);
  }

  /** Fade out and stop. The station can't be started again; make a new one. */
  stop(fade = 0.4): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(0, now + fade);
    for (const s of this.sources) { try { s.stop(now + fade + 0.05); } catch { /* already stopped */ } }
    this.queue = [];
    this.marks = [];
  }

  /** Start a new tune now, from `seed`, fading out whatever is still ringing. */
  skip(seed: number): void {
    const old = this.lanes;
    const now = this.ctx.currentTime;
    for (const g of Object.values(old)) g.gain.setTargetAtTime(0, now, 0.06);
    if (typeof setTimeout === 'function') setTimeout(() => { for (const g of Object.values(old)) g.disconnect(); }, 800);
    this.lanes = this.newLanes();
    this.stream = lofiStream(seed, { mood: this.settings.mood });
    this.queue = [];
    this.marks = [];
    this.nextBarAt = now + 0.15;
  }

  /** A new mood starts a new tune in that mood. */
  setMood(mood: LofiMood, seed: number): void {
    this.settings.mood = mood;
    this.skip(seed);
  }

  setDrums(on: boolean): void { this.settings.drums = on; }

  setTexture(texture: number): void {
    this.settings.texture = Math.max(0, Math.min(1, texture));
    this.applyTexture(0.08);
  }

  /** Fade the whole station to silence over `dur` seconds from `at` (an offline render's ending). */
  fadeOutAt(at: number, dur: number): void {
    this.out.gain.setValueAtTime(this.out.gain.value, at);
    this.out.gain.linearRampToValueAtTime(0, at + dur);
  }

  setVolume(v: number): void { this.out.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), this.ctx.currentTime, 0.05); }

  setMix(mix: Partial<LofiMix>): void { Object.assign(this.mix, mix); this.applyMix(); this.applyTexture(0.05); }

  // ── offline ───────────────────────────────────────────────────────────────

  /** Queue everything up to `seconds` at once (an OfflineAudioContext). */
  scheduleAll(seconds: number): void {
    this.nextBarAt = 0.05;
    this.fill(seconds);
    this.flush(seconds);
  }

  // ── scheduling ────────────────────────────────────────────────────────────

  private tick(): void {
    const hidden = typeof document !== 'undefined' && document.hidden;
    const until = this.ctx.currentTime + (hidden ? LOOKAHEAD_HIDDEN : LOOKAHEAD);
    this.fill(until);
    this.flush(until);
  }

  /** Queue whole bars until the next one starts after `until`. */
  private fill(until: number): void {
    while (this.nextBarAt < until) {
      const bar = this.stream.next();
      const spb = 60 / bar.tune.bpm;
      const at = this.nextBarAt;
      for (const note of bar.notes) this.queue.push({ at: at + note.beat * spb, spb, note, bar, lanes: this.lanes });
      this.marks.push({ at, bar });
      this.nextBarAt = at + 4 * spb;
    }
  }

  /** Play every queued note and bar change due before `until`. */
  private flush(until: number): void {
    const now = this.ctx.currentTime;
    const due = this.queue.filter(q => q.at < until);
    if (due.length) this.queue = this.queue.filter(q => q.at >= until);
    for (const q of due) {
      if (q.at < now - 0.05) continue;   // a stalled page: drop it rather than pile notes up late
      this.play(q);
    }
    const marks = this.marks.filter(m => m.at < until);
    if (marks.length) this.marks = this.marks.filter(m => m.at >= until);
    for (const m of marks) {
      this.lastOpen = m.bar.open;
      this.tone.frequency.setTargetAtTime(this.cutoff(m.bar.open), Math.max(m.at, now), 0.5);
      if (this.onBar && typeof setTimeout === 'function' && this.timer) {
        setTimeout(() => { this.current = m.bar; this.onBar?.(m.bar); }, Math.max(0, (m.at - now) * 1000));
      }
    }
  }

  private play({ at, spb, note, bar, lanes }: Queued): void {
    const t = Math.max(at, this.ctx.currentTime);
    const vel = note.vel * bar.level;
    if (DRUMS.has(note.voice) && !this.settings.drums) return;
    const k = this.kit;
    switch (note.voice) {
      case 'keys': V.keys(k, lanes.keys, t, note.midi, vel, note.dur * spb); break;
      case 'bass': V.bass(k, lanes.bass, t, note.midi, vel, note.dur * spb); break;
      case 'lead': V.lead(k, lanes.lead, t, note.midi, vel, note.dur * spb); break;
      case 'kick': V.kick(k, lanes.drums, t, vel); this.duck(t); break;
      case 'snare': V.snare(k, lanes.drums, t, vel, bar.tune.mood === 'rainy'); break;
      case 'rim': V.rim(k, lanes.drums, t, vel); break;
      case 'hat': V.hat(k, lanes.drums, t, vel); break;
      case 'openHat': V.hat(k, lanes.drums, t, vel, true); break;
    }
  }

  /** Dip the music under a kick (it reaches the speakers 20 ms later, through the wow delay). */
  private duck(t: number): void {
    const g = this.music.gain;
    const at = Math.max(this.ctx.currentTime, t - 0.02);
    g.setTargetAtTime(0.74, at, 0.006);
    g.setTargetAtTime(1, at + 0.05, 0.11);
  }

  // ── sound ─────────────────────────────────────────────────────────────────

  private cutoff(open: number): number {
    const top = MOOD_TONE[this.settings.mood] * (1 - 0.42 * this.settings.texture);
    const bottom = 900;
    return bottom * (top / bottom) ** Math.max(0, Math.min(1, open));
  }

  private applyTexture(glide: number): void {
    const x = this.settings.texture;
    const now = this.ctx.currentTime;
    const set = (p: AudioParam, v: number): void => { if (glide) p.setTargetAtTime(v, now, glide); else p.value = v; };
    set(this.wowDepth.gain, 0.0004 + x * 0.0016);
    set(this.flutterDepth.gain, 0.00004 + x * 0.00018);
    const tex = BUS.texture * this.mix.texture;
    set(this.crackle.gain, x * 0.09 * tex);
    set(this.hiss.gain, (0.002 + x * 0.008) * tex);
    set(this.rain.gain, this.settings.mood === 'rainy' ? (0.05 + x * 0.02) * tex : 0);
    set(this.tone.frequency, this.cutoff(this.lastOpen));
    const k = 1.1 + x * 2.4;
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const v = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(k * v) / Math.tanh(k);
    }
    this.shaper.curve = curve;
  }

  private applyMix(): void {
    this.keysBus.gain.value = BUS.keys * this.mix.keys;
    this.bassBus.gain.value = BUS.bass * this.mix.bass;
    this.leadBus.gain.value = BUS.lead * this.mix.lead;
    this.drumBus.gain.value = BUS.drums * this.mix.drums;
    this.reverbSend.gain.value = 0.28 * this.mix.reverb;
  }

  private newLanes(): Lanes {
    const lane = (to: AudioNode): GainNode => { const g = this.ctx.createGain(); g.connect(to); return g; };
    return { keys: lane(this.keysBus), bass: lane(this.bassBus), lead: lane(this.leadBus), drums: lane(this.drumBus) };
  }

  /** A sine LFO into `depth`; returns `depth` to connect onward. */
  private lfo(hz: number, depth: GainNode): GainNode {
    const o = this.ctx.createOscillator();
    o.frequency.value = hz;
    o.connect(depth);
    o.start();
    this.sources.push(o);
    return depth;
  }

  private loop(buffer: AudioBuffer, to: AudioNode, offset = 0): void {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    s.connect(to);
    s.start(0, offset);
    this.sources.push(s);
  }
}

/** Render `seconds` of the station offline, the same bytes every time for the same inputs. */
export async function renderLofi(seed: number, settings: LofiSettings, seconds: number, sampleRate = 44100, mix: LofiMix = LOFI_MIX): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const station = new LofiStation(ctx, ctx.destination, seed, settings, mix);
  station.scheduleAll(seconds);
  station.fadeOutAt(Math.max(0, seconds - 2), 2);
  return ctx.startRendering();
}

// ── seeded buffers ──────────────────────────────────────────────────────────

function noiseBuffer(ctx: BaseAudioContext, seconds: number, rng: () => number): AudioBuffer {
  const b = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = rng() * 2 - 1;
  return b;
}

/** Vinyl: a bed of small ticks with the occasional louder pop, each a few samples long. */
function crackleBuffer(ctx: BaseAudioContext, seconds: number, rng: () => number): AudioBuffer {
  const b = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate);
  const d = b.getChannelData(0);
  const tick = 34 / ctx.sampleRate;
  const pop = 2.5 / ctx.sampleRate;
  for (let i = 0; i < d.length - 8; i++) {
    const r = rng();
    if (r >= tick) continue;
    const big = r < pop;
    const a = (big ? 0.5 + rng() * 0.5 : 0.08 + rng() * 0.22) * (rng() < 0.5 ? -1 : 1);
    const len = big ? 6 : 3;
    for (let n = 0; n < len; n++) d[i + n] = (d[i + n] ?? 0) + a * (1 - n / len) * (n % 2 ? -0.6 : 1);
  }
  return b;
}

/** A stereo room tail: noise under an exponential decay that also darkens as it goes. */
function impulse(ctx: BaseAudioContext, seconds: number, rng: () => number): AudioBuffer {
  const n = Math.ceil(seconds * ctx.sampleRate);
  const b = ctx.createBuffer(2, n, ctx.sampleRate);
  const pre = Math.floor(0.015 * ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / ctx.sampleRate;
      const dark = Math.min(0.92, 0.25 + t * 0.4);   // the tail loses its top
      lp = lp * dark + (rng() * 2 - 1) * (1 - dark);
      d[i] = lp * Math.exp(-t / 0.62) * 2.2;
    }
  }
  return b;
}
