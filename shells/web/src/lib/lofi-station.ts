// SPDX-License-Identifier: MPL-2.0
/**
 * The Lofi station: plays engine/src/lofi-compose.ts's endless stream of bars through the
 * instruments in ./lofi-voices.ts and a lofi signal chain, live or offline.
 *
 *   music (keys + lead, with a slow tremolo on the keys, and bass)
 *     → ducked a little under each kick
 *     → a record head's wow and flutter (a delay line whose time wobbles unevenly: a
 *       lopsided pull once per revolution, a slow random drift with the odd warped
 *       spot, and random flutter; the tone wanders with the drift too)
 *   drums, and a reverb send from the keys and lead
 *     → tone (a low-pass that the mood, the texture and each bar's "open" set)
 *     → gentle saturation → glue compression → volume
 *   texture: vinyl crackle (in dusty patches, and on some records a faint tick once a
 *   revolution), hiss and, in the rainy mood, rain, joins after the tone filter so it
 *   stays crisp under the muffled music.
 *
 * Each tune's style (from the composer) picks its instruments and drum tuning, and as the
 * tune starts it sets how much wobble, room, tone and kick ducking the chain gives it,
 * and whether the music gets a sampler's grit. Three controls change the station while it
 * plays: mood (starts a new tune in that mood), drums on or off, and texture (clean to
 * dusty: more wobble, crackle, hiss, warmth and muffle). Skip starts a new tune.
 * Everything random is seeded from the tune, so renderLofi() gives the same bytes for
 * the same seed and settings every time.
 *
 * Scheduling is the usual look-ahead: a timer queues each bar's notes on the audio
 * clock a little ahead of time. A hidden tab's timers run slowly, so while the page
 * is hidden the station queues a few seconds ahead instead of a quarter of one.
 */
import { lofiStream, LOFI_DRUM_VOICES } from '../../../../engine/src/lofi-compose.ts';
import type { LofiBar, LofiMood, LofiNote, LofiStream, LofiStyle } from '../../../../engine/src/lofi-compose.ts';
import { mulberry32 } from '../../../../engine/src/zzfx-compose.ts';
import * as V from './lofi-voices.ts';

export interface LofiSettings {
  mood: LofiMood;
  drums: boolean;
  /** 0 clean … 1 dusty. The dustiest is as worn as anyone wants (TEXTURE_MAX of the chain's range). */
  texture: number;
  /** Fix parts of every tune's style (for auditioning an instrument); normally empty. */
  style?: Partial<LofiStyle>;
}

/** Part levels, for tuning the balance. 1 is the designed level. */
export interface LofiMix { keys: number; bass: number; lead: number; drums: number; reverb: number; texture: number }
export const LOFI_MIX: LofiMix = { keys: 1, bass: 1, lead: 1, drums: 1, reverb: 1, texture: 1 };

/** The tone filter's most open cutoff per mood (Hz); texture and each bar close it from there. */
const MOOD_TONE: Record<LofiMood, number> = { warm: 7500, lateNight: 4300, rainy: 5400, sings: 8200 };
/** Lolly Sings is melody-first: its lead sits this much higher than Lofi's (about +4 dB). */
const SINGS_LEAD = 1.6;
const DRUMS = new Set(LOFI_DRUM_VOICES);
/**
 * Each part's designed level: first measured K-weighted and soloed (keys about -25 LUFS,
 * drums -26, bass -27, lead -29, texture -40), then set by ear in the lofi lab (Andy,
 * 2026-11-08): the keys, bass, drums and room up, the lead a little back, and the crackle
 * and hiss well down. MASTER brings the sum back to the same headroom.
 */
const BUS = { keys: 0.37, bass: 0.2, lead: 1.05, drums: 0.83, texture: 0.27, reverb: 0.44 };
/** The whole station's level under the volume control, leaving headroom above the busiest bar. */
const MASTER = 0.62;
/** How far the music is lifted into the grit's staircase: its loudest bars just reach full scale. */
const GRIT_LIFT = 2.5;
/** How much of the music goes through the grit, on a tune with grit. */
const GRIT_MIX = 0.5;
/** Each instrument variant's level against the first of its kind, measured the same way. */
const VARIANT: { keys: Record<LofiStyle['keys'], number>; lead: Record<LofiStyle['lead'], number>; bass: Record<LofiStyle['bass'], number>; snare: Record<LofiStyle['snare'], number>; hats: Record<LofiStyle['hats'], number> } = {
  // Short, decaying sounds (pluck, kalimba, rim, clap) measure quieter than they sound,
  // so they take most of the measured difference, not the whole difference.
  keys: { rhodes: 1, felt: 0.93, wurli: 1.4, pluck: 1.8 },
  lead: { vibes: 1, flute: 0.82, soft: 1.35, kalimba: 1.7, chip: 0.8, none: 0 },
  bass: { round: 1, upright: 1.05, synth: 1.2 },
  snare: { snare: 1, brush: 1.15, rim: 1.8, clap: 2.3 },
  hats: { hat: 1, shaker: 1.15, none: 0 },
};
/** The style a station starts from, until its first tune's arrives. */
const PLAIN: Pick<LofiStyle, 'wow' | 'room' | 'tone' | 'duck' | 'crunch' | 'dust'> = { wow: 1, room: 1, tone: 1, duck: 1, crunch: false, dust: 1 };
/** How far the texture control reaches into the chain's range: past this it stops sounding like a record. */
const TEXTURE_MAX = 0.4;
/** A record at 33⅓ rpm turns once every 1.8 s. */
const REVOLUTION = 60 / (100 / 3);
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
  /** Playing live (set before the first tick, so the very first bar is announced too). */
  private running = false;
  private sources: AudioScheduledSourceNode[] = [];
  private colour = PLAIN;

  private readonly out: GainNode;
  private readonly keysBus: GainNode;
  private readonly bassBus: GainNode;
  private readonly leadBus: GainNode;
  private readonly drumBus: GainNode;
  private readonly music: GainNode;
  private readonly reverbSend: GainNode;
  private readonly tone: BiquadFilterNode;
  private readonly drumTone: BiquadFilterNode;
  private readonly shaper: WaveShaperNode;
  private readonly wowDepth: GainNode;
  private readonly driftDepth: GainNode;
  private readonly flutterDepth: GainNode;
  private readonly toneWander: GainNode;
  private readonly crackle: GainNode;
  private readonly hiss: GainNode;
  private readonly rain: GainNode;
  private readonly crunch: GainNode;
  private readonly dry: GainNode;
  private lanes: Lanes;

  constructor(ctx: BaseAudioContext, dest: AudioNode, seed: number, settings: LofiSettings, mix: LofiMix = LOFI_MIX) {
    this.ctx = ctx;
    this.settings = { ...settings };
    this.mix = { ...mix };
    this.stream = lofiStream(seed, { mood: settings.mood, style: settings.style });
    const noise = noiseBuffer(ctx, 2, mulberry32(seed ^ 0x51));
    this.kit = { ctx, noise, rng: mulberry32(seed ^ 0x5eed) };

    // Output: tone → high-pass → saturation → compression → volume.
    this.out = ctx.createGain();
    this.out.gain.value = MASTER;
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
    this.dry = ctx.createGain();
    this.music.connect(this.dry).connect(wow);
    // A sampler's grit, when a tune asks for it: the music lifted into an 80-step staircase
    // and brought back down, so the steps sit about 32 dB under the music at its usual
    // level (an old sampler, not a broken one), crossfaded with the clean signal rather
    // than added on top, so the level does not change.
    const lift = ctx.createGain();
    lift.gain.value = GRIT_LIFT;
    const crush = ctx.createWaveShaper();
    crush.curve = staircase(80);
    this.crunch = ctx.createGain();
    this.crunch.gain.value = 0;
    this.music.connect(lift).connect(crush).connect(this.crunch).connect(wow);
    // The record head. Nothing here is a clean sine: the eccentric pull is lopsided, and
    // the drift and flutter are smoothed random curves, looped at lengths that never line
    // up with each other or with the revolution.
    this.wowDepth = ctx.createGain();
    const eccentric = ctx.createOscillator();
    eccentric.frequency.value = 1 / REVOLUTION;
    eccentric.setPeriodicWave(ctx.createPeriodicWave(new Float32Array([0, 0.35, 0.2, 0.05]), new Float32Array([0, 1, 0.3, 0.12])));
    eccentric.connect(this.wowDepth).connect(wow.delayTime);
    eccentric.start();
    this.sources.push(eccentric);
    this.driftDepth = ctx.createGain();
    this.toneWander = ctx.createGain();
    const drift = wanderBuffer(ctx, 17.3, [0.35, 0.9], 2, mulberry32(seed ^ 0xd1));
    this.loop(drift, this.driftDepth);
    this.driftDepth.connect(wow.delayTime);
    this.loop(drift, this.toneWander, 5.1);
    this.flutterDepth = ctx.createGain();
    this.loop(wanderBuffer(ctx, 2.9, [0.03, 0.09], 0, mulberry32(seed ^ 0xf1)), this.flutterDepth);
    this.flutterDepth.connect(wow.delayTime);
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
    // The drums get their own tone filter, opening well above the music's, so the snare's
    // crack and the hats stay crisp when the music is muffled: the hits are what a
    // visualizer's treble and mid bands jump on.
    this.drumBus = ctx.createGain();
    this.drumTone = ctx.createBiquadFilter();
    this.drumTone.type = 'lowpass';
    this.drumTone.Q.value = 0.5;
    this.drumTone.frequency.value = drumCutoff(MOOD_TONE[settings.mood]);
    this.drumBus.connect(this.drumTone).connect(hp);

    // A room: a seeded, darkening noise tail, fed from the keys and lead.
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, 2.6, mulberry32(seed ^ 0x7e));
    this.reverbSend = ctx.createGain();
    this.keysBus.connect(this.reverbSend);
    this.leadBus.connect(this.reverbSend);
    this.reverbSend.connect(reverb).connect(this.tone);

    this.toneWander.connect(this.tone.frequency);

    // Texture, after the tone filter.
    this.crackle = ctx.createGain();
    this.crackle.connect(this.shaper);
    const crackleHp = ctx.createBiquadFilter();
    crackleHp.type = 'highpass'; crackleHp.frequency.value = 600;
    crackleHp.connect(this.crackle);
    this.loop(crackleBuffer(ctx, REVOLUTION * 4, mulberry32(seed ^ 0xc4)), crackleHp);
    this.hiss = ctx.createGain();
    this.hiss.connect(this.shaper);
    const hissLp = ctx.createBiquadFilter();
    hissLp.type = 'lowpass'; hissLp.frequency.value = 6500;
    hissLp.connect(this.hiss);
    this.loop(noise, hissLp);
    this.rain = ctx.createGain();
    this.rain.connect(this.shaper);
    const rainBp = ctx.createBiquadFilter();
    // Rain is a soft, dark patter under the music rather than a hiss over the top, so it
    // is low-passed well down and kept quiet. A broad band at 1.1 kHz was too much.
    rainBp.type = 'lowpass'; rainBp.frequency.value = 1400; rainBp.Q.value = 0.4;
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
    this.running = true;
    this.nextBarAt = this.ctx.currentTime + 0.1;
    this.tick();
    this.timer = setInterval(() => this.tick(), 25);
  }

  /** Fade out and stop. The station can't be started again; make a new one. */
  stop(fade = 0.4): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
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
    this.stream = lofiStream(seed, { mood: this.settings.mood, style: this.settings.style });
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

  /** Fix parts of the style from the next tune on (an audition aid). */
  setStyle(style: Partial<LofiStyle>, seed: number): void {
    this.settings.style = style;
    this.skip(seed);
  }

  setTexture(texture: number): void {
    this.settings.texture = Math.max(0, Math.min(1, texture));
    this.applyTexture(0.08);
  }

  /** Fade the whole station to silence over `dur` seconds from `at` (an offline render's ending). */
  fadeOutAt(at: number, dur: number): void {
    this.out.gain.setValueAtTime(this.out.gain.value, at);
    this.out.gain.linearRampToValueAtTime(0, at + dur);
  }

  setVolume(v: number): void { this.out.gain.setTargetAtTime(MASTER * Math.max(0, Math.min(1, v)), this.ctx.currentTime, 0.05); }

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
      if (m.bar.index === 0) this.applyStyle(m.bar.tune.style, Math.max(m.at, now));
      this.lastOpen = m.bar.open;
      this.tone.frequency.setTargetAtTime(this.cutoff(m.bar.open), Math.max(m.at, now), 0.5);
      this.drumTone.frequency.setTargetAtTime(drumCutoff(this.cutoff(m.bar.open)), Math.max(m.at, now), 0.5);
      if (this.running && typeof setTimeout === 'function') {
        setTimeout(() => { this.current = m.bar; this.onBar?.(m.bar); }, Math.max(0, (m.at - now) * 1000));
      }
    }
  }

  private play({ at, spb, note, bar, lanes }: Queued): void {
    const t = Math.max(at, this.ctx.currentTime);
    const vel = note.vel * bar.level;
    if (DRUMS.has(note.voice) && !this.settings.drums) return;
    const k = this.kit;
    const st = bar.tune.style;
    const len = note.dur * spb;
    switch (note.voice) {
      case 'keys': V.keys(st.keys, k, lanes.keys, t, note.midi, vel * VARIANT.keys[st.keys], len); break;
      case 'bass': V.bass(st.bass, k, lanes.bass, t, note.midi, vel * VARIANT.bass[st.bass], len); break;
      case 'lead': V.lead(st.lead, k, lanes.lead, t, note.midi, vel * VARIANT.lead[st.lead] * (bar.tune.mood === 'sings' ? SINGS_LEAD : 1), len); break;
      case 'kick': V.kick(k, lanes.drums, t, vel, st.kick, st.kickLen); this.duck(t, st.duck); break;
      case 'snare':
        V.snare(st.snare === 'rim' ? 'snare' : st.snare, k, lanes.drums, t, vel * VARIANT.snare[st.snare], st.snareTone);
        if (note.vel > 0.5) this.duck(t, st.duck * 0.45);   // a backbeat, not a ghost: the music gives it a little room
        break;
      case 'rim': V.rim(k, lanes.drums, t, vel * VARIANT.snare.rim); break;
      case 'hat': V.hat(st.hats, k, lanes.drums, t, vel * VARIANT.hats[st.hats], st.hatTone); break;
      case 'openHat': V.hat(st.hats, k, lanes.drums, t, vel * VARIANT.hats[st.hats], st.hatTone, true); break;
    }
  }

  /** Dip the music under a kick (it reaches the speakers 20 ms later, through the wow delay). */
  private duck(t: number, depth: number): void {
    const g = this.music.gain;
    const at = Math.max(this.ctx.currentTime, t - 0.02);
    g.setTargetAtTime(1 - 0.26 * depth, at, 0.006);
    g.setTargetAtTime(1, at + 0.05, 0.11);
  }

  // ── sound ─────────────────────────────────────────────────────────────────

  /** A new tune's colour: wobble, room, tone and grit, from the moment it starts. */
  private applyStyle(style: LofiStyle, at: number): void {
    this.colour = style;
    const grit = style.crunch ? GRIT_MIX : 0;
    this.crunch.gain.setTargetAtTime(grit / GRIT_LIFT, at, 0.1);
    this.dry.gain.setTargetAtTime(1 - grit, at, 0.1);
    this.reverbSend.gain.setTargetAtTime(BUS.reverb * this.mix.reverb * style.room, at, 0.1);
    this.applyTexture(0.3);
  }

  private cutoff(open: number): number {
    const top = MOOD_TONE[this.settings.mood] * this.colour.tone * (1 - 1.05 * this.settings.texture * TEXTURE_MAX);
    const bottom = 900;
    return bottom * (top / bottom) ** Math.max(0, Math.min(1, open));
  }

  private applyTexture(glide: number): void {
    const x = this.settings.texture * TEXTURE_MAX;
    const now = this.ctx.currentTime;
    const set = (p: AudioParam, v: number): void => { if (glide) p.setTargetAtTime(v, now, glide); else p.value = v; };
    // Delay-time depths in seconds. At full texture: about 8 cents of pitch from the
    // eccentric pull, 6 from the drift (more at a warped spot) and 4 from the flutter;
    // at none, a quarter of that, since a little unevenness is what a record sounds like.
    const w = this.colour.wow;
    set(this.wowDepth.gain, (0.00033 + x * 0.0025) * w);
    set(this.driftDepth.gain, (0.0003 + x * 0.002) * w);
    set(this.flutterDepth.gain, (0.00001 + x * 0.00011) * w);
    set(this.toneWander.gain, this.cutoff(this.lastOpen) * (0.03 + x * 0.12));
    const tex = BUS.texture * this.mix.texture;
    const dust = tex * this.colour.dust;
    set(this.crackle.gain, x * 0.09 * dust);
    set(this.hiss.gain, (0.002 + x * 0.008) * dust);
    set(this.rain.gain, this.settings.mood === 'rainy' ? (0.03 + x * 0.016) * tex : 0);
    set(this.tone.frequency, this.cutoff(this.lastOpen));
    set(this.drumTone.frequency, drumCutoff(this.cutoff(this.lastOpen)));
    const k = 1.05 + x * 1.3;   // gentle: warmth, never crunch
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
    this.reverbSend.gain.value = BUS.reverb * this.mix.reverb * this.colour.room;
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

/** The drums' tone filter: well above the music's, never below 3 kHz, at most 14 kHz. */
function drumCutoff(musicCutoff: number): number {
  return Math.max(3000, Math.min(14000, musicCutoff * 1.9));
}

/** A waveshaper curve that rounds every sample to one of `levels` steps. */
function staircase(levels: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(2048);
  for (let i = 0; i < curve.length; i++) {
    const v = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.round(v * levels / 2) / (levels / 2);
  }
  return curve;
}

/**
 * A smoothed random curve between -1 and 1 for modulation: random points `spacing`
 * seconds apart (each gap drawn between the two numbers), joined with cosine curves, plus
 * `warps` broad bumps, the warped spots a record passes over.
 */
function wanderBuffer(ctx: BaseAudioContext, seconds: number, spacing: [number, number], warps: number, rng: () => number): AudioBuffer {
  const sr = ctx.sampleRate;
  const b = ctx.createBuffer(1, Math.ceil(seconds * sr), sr);
  const d = b.getChannelData(0);
  const points: Array<[number, number]> = [[0, 0]];
  while (points[points.length - 1]![0] < d.length) {
    const gap = (spacing[0] + rng() * (spacing[1] - spacing[0])) * sr;
    points.push([points[points.length - 1]![0] + gap, (rng() * 2 - 1) * 0.7]);
  }
  points[points.length - 1]![1] = 0;   // end where it started, so the loop has no seam
  for (let p = 0; p < points.length - 1; p++) {
    const [x0, y0] = points[p]!;
    const [x1, y1] = points[p + 1]!;
    for (let i = Math.ceil(x0); i < Math.min(d.length, x1); i++) {
      const u = (1 - Math.cos(Math.PI * (i - x0) / (x1 - x0))) / 2;
      d[i] = y0 + (y1 - y0) * u;
    }
  }
  for (let n = 0; n < warps; n++) {
    const at = (0.15 + rng() * 0.7) * d.length;
    const width = (0.2 + rng() * 0.25) * sr;
    const height = (rng() < 0.5 ? -1 : 1) * (0.8 + rng() * 0.6);
    for (let i = Math.max(0, Math.floor(at - width)); i < Math.min(d.length, at + width); i++) {
      d[i] = (d[i] ?? 0) + height * (1 + Math.cos(Math.PI * (i - at) / width)) / 2;
    }
  }
  return b;
}

/**
 * Vinyl: small ticks with the occasional louder pop, each a few samples long, gathered
 * in dusty patches rather than spread evenly; on some records, a faint tick once a
 * revolution where a scratch crosses the groove. The buffer is four revolutions long.
 */
function crackleBuffer(ctx: BaseAudioContext, seconds: number, rng: () => number): AudioBuffer {
  const b = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate);
  const d = b.getChannelData(0);
  const tick = 34 / ctx.sampleRate;
  const pop = 2.5 / ctx.sampleRate;
  const dust = wanderBuffer(ctx, seconds, [0.25, 1.2], 0, rng).getChannelData(0);
  for (let i = 0; i < d.length - 8; i++) {
    const r = rng() / (0.25 + 1.9 * Math.max(0, (dust[i] ?? 0) + 0.45));   // a dusty patch is denser
    if (r >= tick) continue;
    const big = r < pop;
    const a = (big ? 0.5 + rng() * 0.5 : 0.08 + rng() * 0.22) * (rng() < 0.5 ? -1 : 1);
    const len = big ? 6 : 3;
    for (let n = 0; n < len; n++) d[i + n] = (d[i + n] ?? 0) + a * (1 - n / len) * (n % 2 ? -0.6 : 1);
  }
  if (rng() < 0.35) {
    const at = Math.floor(rng() * REVOLUTION * ctx.sampleRate);
    for (let rev = at; rev < d.length - 12; rev += Math.round(REVOLUTION * ctx.sampleRate)) {
      for (let n = 0; n < 10; n++) d[rev + n] = (d[rev + n] ?? 0) + 0.28 * (1 - n / 10) * (n % 2 ? -0.7 : 1);
    }
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
