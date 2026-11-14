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
 *   texture: a record's crackle (stereo ticks and pops in dusty patches, and on some
 *   records a scratch once a revolution), the record's surface noise and, in the rainy
 *   mood, rain, joins after the tone filter so it stays crisp under the muffled music.
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
import { lofiStream, lofiTrack, LOFI_DRUM_VOICES } from '../../../../engine/src/lofi-compose.ts';
import type { LofiBar, LofiMood, LofiNote, LofiStream, LofiStyle, LofiTagChoice, LofiTuneInfo } from '../../../../engine/src/lofi-compose.ts';
import { mulberry32 } from '../../../../engine/src/zzfx-compose.ts';
import * as V from './lofi-voices.ts';
import { bandShout, isShoutPhrase, lollyTag } from './lofi-tag.ts';
import * as D from './lofi-drums.ts';
import * as W from './lofi-world-voices.ts';
import * as G from './lofi-guitars.ts';
import * as LG from './lofi-lead-guitars.ts';
import { HAT_BELL, perform } from './lofi-perform.ts';
import * as BL from './lofi-bass-layers.ts';
import * as R from './lofi-winds.ts';
import * as H from './lofi-house.ts';
import * as C from './lofi-chop.ts';
import * as S from './lofi-string-section.ts';
import { ownOnly } from './lofi-lead-art.ts';

export interface LofiSettings {
  mood: LofiMood;
  drums: boolean;
  /** 0 clean … 1 dusty. The dustiest is as worn as anyone wants (TEXTURE_MAX of the chain's range). */
  texture: number;
  /** Fix parts of every tune's style (for auditioning an instrument); normally empty. */
  style?: Partial<LofiStyle>;
  /** Repeat the first tune rather than going on to new ones (a saved tune). With `bars`,
   *  the whole track repeats from its top instead (a saved music generator track). */
  repeat?: boolean;
  /** Start this many bars in (the music generator's seek): the bars before are composed, not played. */
  startBar?: number;
  /** Stop after this many bars from the start of the stream (the music generator's length). */
  bars?: number;
  /** Change each bar before it plays (the music generator's per-section instruments). Must be pure. */
  shape?: (bar: LofiBar) => LofiBar;
  /** A drum kit a person chose (the music generator), over the one the tune draws. */
  kit?: D.LofiKit;
  /** The producer's tag a person chose for a generator track: none, or one delivery. */
  tag?: LofiTagChoice;
  /** 'high' for a render worked out ahead of playing: more oversampling and denser cymbals, at a cost live playing cannot pay. */
  quality?: 'live' | 'high';
}

/** Part levels, for tuning the balance. 1 is the designed level. `fx` is the effects: the
 *  risers, the console's sounds, the shouts, the birds, the sparkles, phasers and blips. */
export interface LofiMix { keys: number; bass: number; lead: number; drums: number; fx: number; reverb: number; texture: number }
export const LOFI_MIX: LofiMix = { keys: 1, bass: 1, lead: 1, drums: 1, fx: 1, reverb: 1, texture: 1 };

/** The tone filter's most open cutoff per mood (Hz); texture and each bar close it from there. */
const MOOD_TONE: Record<LofiMood, number> = {
  warm: 7500, lateNight: 4300, rainy: 5400, sings: 8200, sugar: 11000, sherbert: 13000, chiptune: 11000, citypop: 9500, nudisco: 9500, triphop: 5500, funk: 9500, soul: 8000, acid: 10000, hiphop: 8000, reggae: 7500, spanish: 8500, rock: 9000, synthwave: 9500, electro: 9000, dubstep: 9500, brostep: 10000, dnb: 10000,
  country: 9500, blues: 7000, jazz: 7500, swing: 8500, straya: 10000, grunge: 7500, stoner: 6500, shoegaze: 7000,
  fantasy: 9000, dream: 6000, kpop: 11000, metal: 9500, ska: 9500, punk: 10000, rnb: 8500,
  persian: 11500, guzheng: 11000, koto: 11000, kora: 11500, afrobeat: 9500, amapiano: 10000, lofiHouse: 6000,
};
/** Lolly Sings is melody-first: its lead sits this much higher than Lofi's (about +2 dB), in every genre of the family. */
const SINGS_LEAD = 1.3;
const SINGS_FAMILY = new Set<LofiMood>(['sings', 'sugar', 'sherbert', 'persian', 'guzheng', 'koto', 'kora', 'afrobeat', 'amapiano', 'chiptune', 'citypop', 'nudisco', 'triphop', 'funk', 'soul', 'acid', 'hiphop', 'reggae', 'spanish', 'rock', 'synthwave', 'electro', 'dubstep', 'brostep', 'dnb', 'country', 'blues', 'jazz', 'swing', 'straya', 'fantasy', 'dream', 'kpop', 'metal', 'ska', 'punk', 'rnb', 'lofiHouse']);
const DRUMS = new Set(LOFI_DRUM_VOICES);
/**
 * Each part's designed level: first measured K-weighted and soloed (keys about -25 LUFS,
 * drums -26, bass -27, lead -29, texture -40), then set by ear in the lofi lab (Andy,
 * 2026-11-08): the keys, bass, drums and room up, the lead a little back, and the crackle
 * and hiss well down. MASTER brings the sum back to the same headroom. Then by ear across
 * the styles (Andy, 2026-11-10): the effects too quiet and the lead too loud on average, so
 * the effects come up about 3 dB and the lead down about a decibel (and Lolly Sings' lift
 * from 4 dB to 2).
 */
const BUS = { keys: 0.37, bass: 0.2, lead: 0.95, drums: 0.83, texture: 0.27, reverb: 0.44, fx: 1.5 };
/** The room by section: bigger in the quiet sections, tighter in a drop. */
const SECTION_ROOM: Partial<Record<string, number>> = { intro: 1.25, break: 1.35, outro: 1.4, bridge: 1.15, build: 1.1, drop: 0.85 };
/** The styles built on drops, whose builds sweep a high-pass up the music. */
const SWEEPS = new Set<LofiMood>(['sugar', 'sherbert', 'kpop', 'chiptune', 'nudisco', 'synthwave', 'acid', 'electro', 'dubstep', 'brostep', 'dnb', 'amapiano', 'citypop', 'dream', 'fantasy']);
/** The styles that throw a phrase's last lead note into the echo, and those that keep a little echo on the lead throughout. */
const THROWS = new Set<LofiMood>(['reggae', 'synthwave', 'sugar', 'sherbert', 'kpop', 'dream', 'fantasy', 'triphop', 'rnb', 'citypop', 'chiptune', 'dubstep', 'amapiano', 'ska', 'lofiHouse']);
const ECHO_ALWAYS = new Set<LofiMood>(['synthwave', 'dream', 'reggae']);
const ECHO_BED = 0.12;
/** The drums' room send, at the middle of the arrangement; the room slider and the section scale the send. */
const DRUM_ROOM = 0.32;
const THROW_LEVEL = 0.55;
/** The styles whose chorus puts a sine sub under the bass guitar, and the basses it goes under. */
const SUB_UNDER = new Set<LofiMood>(['rnb', 'soul', 'citypop', 'kpop']);
const SUB_BASSES = new Set<string>(['motown', 'round', 'synth', 'picked']);
/** The styles whose lead lays back behind the beat, and by how much (s). */
const LAID_BACK = new Set<LofiMood>(['jazz', 'swing', 'blues']);
const LAY_BACK = 0.024;
/** Seconds between one lead note's end and the next one's start that still count as a slur. */
const SLUR_GAP = 0.035;
/** A riser rode the keys' bus (through its tremolo, about 0.92) before the effects had their own: this keeps that level, raised a little with the other effects. */
const RISER_LEVEL = (BUS.keys * 0.92 * 1.2) / BUS.fx;
/** The whole station's level under the volume control, leaving headroom above the busiest bar. */
const MASTER = 0.62;
/** How far the music is lifted into the grit's staircase: its loudest bars just reach full scale. */
const GRIT_LIFT = 2.5;
/** How much of the music goes through the grit, on a tune with grit. */
const GRIT_MIX = 0.5;
/** Each instrument variant's level against the first of its kind, measured the same way. */
const VARIANT: { keys: Record<LofiStyle['keys'], number>; lead: Record<LofiStyle['lead'], number>; bass: Record<LofiStyle['bass'], number>; snare: Record<LofiStyle['snare'], number>; hats: Record<LofiStyle['hats'], number> } = {
  // Short, decaying sounds (pluck, kalimba, rim, clap) measure quieter than they sound,
  // so they take most of the measured difference, not the whole difference. The electric
  // guitars (the keys' electric and the lead guitars) set their own level, as their
  // velocity chooses how hard the string is picked (lib/lofi-lead-guitars.ts).
  keys: { rhodes: 1, felt: 0.93, wurli: 1.4, pluck: 1.8, pad: 1, supersaw: 1, nylon: 1.8, crunch: 1, heavy: 1, buzzsaw: 1, clean: 1, fuzz: 1, wall: 1, wah: 1, chiparp: 1.6, steel: 2.4, banjo: 2, honky: 1, organ: 2.2, brass: 2, jazzbox: 2, electric: 1, harp: 1.3, choir: 1, future: 1.5, tar: 1, santur: 1, zheng: 1.2, koto: 1, shamisen: 1, kora: 1.2, balafon: 1.1, strings: 1 },
  lead: { vibes: 1, flute: 0.82, soft: 1.35, kalimba: 1.7, chip: 0.8, angel: 0.76, pulse: 2.4, guitar: 1, overdrive: 1, synthwave: 0.86, metal: 1, panflute: 0.56, nylon: 1.9, riff: 1, twang: 1, banjo: 1.5, harmonica: 0.55, sax: 1, trumpet: 1, clarinet: 1, pedal: 0.44, fiddle: 1, bells: 1.6, chop: 1, bit: 1,
    santur: 1, ney: 1, kamancheh: 1, erhu: 1, dizi: 1, zheng: 1, pipa: 1, shakuhachi: 1, koto: 1, shamisen: 1, kora: 1, balafon: 1, harp: 1.3, steel: 2, tar: 1, viola: 1, cello: 1, doublebass: 1, none: 0 },
  // The reese is drum and bass's whole low end, so it sits about 4 dB up (Andy, 2026-11-08).
  bass: { round: 1, upright: 1.05, synth: 1.2, wobble: 1, growl: 1.8, reese: 1.6, slap: 1.6, screech: 1.7, pulse: 1, electro: 1, picked: 1, croak: 1, eight: 1, acid: 1, motown: 1, yidaki: 1.1, log: 1, deep: 1 },
  snare: { snare: 1, brush: 1.15, rim: 1.8, clap: 2.3, stack: 1, snap: 2 },
  hats: { hat: 1, shaker: 1.15, ride: 0.8, none: 0 },
};
/**
 * Each lead instrument's trim (dB): what brings it to the others' loudness on the same
 * phrase (measured, the sounds that ring and fade trimmed by only part of the difference),
 * then refined with the genre seats against the stems of every style.
 */
const LEAD_TRIM: Partial<Record<LofiStyle['lead'], number>> = { angel: -0.2, balafon: 2.2, banjo: -1.8, bells: -0.6, bit: 4.0, chip: 4.0, chop: 0.3, clarinet: 1.5, dizi: -1.4, erhu: 1.4, fiddle: 0.2, flute: -2.1, guitar: -2.1, harp: -4.6, kalimba: -3.1, kamancheh: -0.1, kora: 0.1, koto: 2.2, metal: -0.3, ney: -0.6, nylon: -1.9, overdrive: 0.3, panflute: 0.3, pedal: 0.1, pipa: 3.3, pulse: 1.8, riff: -0.1, santur: 3.7, sax: 2.5, shakuhachi: -1.1, shamisen: 4.0, soft: -0.6, steel: -1.2, tar: 0.5, trumpet: 4.0, twang: -1.5, vibes: -0.7, zheng: 2.1, viola: 0.1, cello: -0.4, doublebass: -0.3 };
/**
 * Each genre's seat for its lead (dB), with the instrument trimmed: the lead's place
 * against the band while the lead plays. Measured from the stems of two tunes a genre, fitted twice, and set
 * so the lead plays about 5 dB under the band, 6 in the calm styles and 4 in jazz and
 * swing, whose soloist is the point; shoegaze's stays half-buried in its wall of guitars,
 * as the style's singers are, and lofi house's sits well back in the dust under its bass
 * (Andy, 2026-11-10: "some instruments are obnoxiously
 * loud as the lead, perhaps the genre should set a rule for certain instruments so they
 * dont destroy the genre"; 2026-11-13, of lofi house: "the lead is quiet and the bass is
 * loud").
 */
const LEAD_SEAT: Partial<Record<LofiMood, number>> = { acid: -2.6, afrobeat: 0.3, amapiano: -6.2, blues: -3.7, brostep: -10.2, chiptune: -8.5, citypop: 1.2, country: -2.5, dnb: -1.8, dream: -12.0, dubstep: -5.5, electro: -0.7, fantasy: -8.8, funk: 3.7, guzheng: -6.2, hiphop: 0.1, jazz: -0.8, kora: -1.7, koto: -2.8, kpop: -0.2, lateNight: -1.7, metal: -0.8, nudisco: -2.8, persian: -3.4, punk: -1.0, rainy: 0.3, reggae: -3.3, rnb: -2.1, rock: -1.5, sherbert: 0.3, sings: -3.2, ska: -2.9, soul: 0.6, spanish: -0.4, straya: -1.3, sugar: -1.0, swing: -0.7, synthwave: -8.2, triphop: -1.6, warm: -1.8, grunge: 1.5, stoner: 3, shoegaze: 0, lofiHouse: -9.5 };
/** Each genre's seat for its bass (dB): the styles whose bass is the star play it louder than the rest. */
const BASS_SEAT: Partial<Record<LofiMood, number>> = { lofiHouse: 7.5 };
/** The styles whose horn lines are a section's (see the lead and lib/lofi-winds.ts's hornSection). */
const HORN_SECTION = new Set<LofiMood>(['ska', 'afrobeat', 'soul', 'funk', 'swing']);
/** How far a section's brass falls off a phrase's last long note (semitones). */
const SECTION_FALL = 5;
/** The style a station starts from, until its first tune's arrives. */
const PLAIN: Pick<LofiStyle, 'wow' | 'room' | 'tone' | 'duck' | 'crunch' | 'dust'> = { wow: 1, room: 1, tone: 1, duck: 1, crunch: false, dust: 1 };
/** How far the texture control reaches into the chain's range: past this it stops sounding like a record. */
const TEXTURE_MAX = 0.4;
/** The crackle and hiss at the middle of the texture slider, against the lab balance (about +3 dB). */
const DUST_MID = 1.4;
/** A record at 33⅓ rpm turns once every 1.8 s. */
const REVOLUTION = 60 / (100 / 3);
const LOOKAHEAD = 0.25;
const LOOKAHEAD_HIDDEN = 3;

/** `lead`: how long before `at` a note must be handed to the audio clock (a shouted phrase starts before its beat). */
interface Queued { at: number; spb: number; note: LofiNote; bar: LofiBar; lanes: Lanes; lead: number }
/** A shouted phrase's longest lead-in, its "let's" before the "go" at the slowest tempo, with room to spare (s). */
const SHOUT_LEAD = 0.7;
/** A bar's start: when it sounds, the bar, and its place in the stream (bars from the stream's top). */
interface Mark { at: number; bar: LofiBar; pos: number }
/** One tune's inputs to the buses, so skipping can fade out what is still ringing. */
interface Lanes { keys: GainNode; bass: GainNode; lead: GainNode; drums: GainNode; fx: GainNode }

export class LofiStation {
  readonly ctx: BaseAudioContext;
  /** The bar now playing (live only), and a callback when it changes. */
  current: LofiBar | null = null;
  onBar: ((bar: LofiBar) => void) | null = null;
  /** When the bar now playing began, on the audio clock (live only). */
  currentAt = 0;
  /** The place of the bar now playing: bars from the top of the stream, or of a generator track (live only). */
  currentPos = 0;

  private settings: LofiSettings;
  private mix: LofiMix;
  private stream: LofiStream;
  /** The seed the stream started from, to start it again (a saved generator track repeating). */
  private seed: number;
  /** The last lead note (when it ends, its pitch, its instrument), to tell whether the next one is slurred. */
  private lastLead = { end: -1, midi: 0, voice: '' };
  /** The travelling bass's last note, for the next note to glide from. */
  private lastTravel = { end: -1, midi: 0 };
  /** Each tune's drum kit, drawn once from its seed (lib/lofi-drums.ts). */
  private kits = new Map<string, D.DrumKit>();

  /** The kit `tune` plays. */
  private kitOf(tune: LofiTuneInfo): D.DrumKit {
    const key = `${tune.mood}:${tune.seed}:${this.settings.kit ?? ''}`;
    let kit = this.kits.get(key);
    if (!kit) {
      if (this.kits.size > 16) this.kits.clear();
      kit = D.drumKit(tune.seed, this.settings.kit ? D.LOFI_KIT_MOOD[this.settings.kit] : tune.mood);
      this.kits.set(key, kit);
    }
    return kit;
  }
  private kit: V.VoiceKit;
  private queue: Queued[] = [];
  private marks: Mark[] = [];
  private nextBarAt = 0;
  /** Bars taken from the stream so far, skipped ones included. */
  private taken = 0;
  /** A generator track's length in bars, once fitted to end with its outro (see lofiTrack). */
  private trackBars = 0;
  /** Whether a tune's colour has been applied yet (a station that starts mid-tune applies its tune's at once). */
  private styled = false;
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
  private readonly fxBus: GainNode;
  private readonly drumBus: GainNode;
  private readonly music: GainNode;
  private readonly reverbSend: GainNode;
  /** The drums' own room: what gives a snare its tail and a tom its space. */
  private readonly drumRoom: GainNode;
  /** The build's sweep: a high-pass on the music (not the drums) that rises through a build and opens on the drop. */
  private readonly sweep: BiquadFilterNode;
  /** The echo: a tempo-synced ping-pong fed from the lead, opened for a phrase's last note (a throw). */
  private readonly echoSend: GainNode;
  private readonly echoTimes: DelayNode[];
  /** How many bars of the current build have passed, and the section of the last bar marked. */
  private buildBars = 0;
  private sectionRoom = 1;
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
    this.seed = seed;
    this.stream = this.open(seed);
    for (let i = 0; i < (settings.startBar ?? 0); i++) { this.stream.next(); this.taken++; }
    const noise = noiseBuffer(ctx, 2, mulberry32(seed ^ 0x51));
    this.kit = { ctx, noise, rng: mulberry32(seed ^ 0x5eed), hq: settings.quality === 'high' };

    // Output: tone → high-pass → saturation → compression → volume.
    this.out = ctx.createGain();
    this.out.gain.value = MASTER;
    this.out.connect(dest);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 10; comp.ratio.value = 2.5;
    comp.attack.value = 0.015; comp.release.value = 0.3;
    comp.connect(this.out);
    this.shaper = ctx.createWaveShaper();
    this.shaper.oversample = settings.quality === 'high' ? '4x' : '2x';
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
    // The build's sweep sits between the music and everything after it, wide open (20 Hz)
    // except while a build climbs (see markSection).
    this.sweep = ctx.createBiquadFilter();
    this.sweep.type = 'highpass';
    this.sweep.frequency.value = 20;
    this.sweep.Q.value = 0.7;
    this.music.connect(this.sweep).connect(this.dry).connect(wow);
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
    this.sweep.connect(lift).connect(crush).connect(this.crunch).connect(wow);
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
    // The effects: their own level (the music generator's slider), ducked and given the room as the lead is.
    this.fxBus = ctx.createGain();
    this.fxBus.connect(this.music);
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
    this.fxBus.connect(this.reverbSend);
    this.reverbSend.connect(reverb).connect(this.tone);

    // The drums' room: a shorter, brighter space than the music's, fed from the drums above
    // the kick's range (a high-pass at 300 Hz keeps the low end dry and tight), so a snare
    // rings out into the room and drops off, as a kit in a real room does.
    const room = ctx.createConvolver();
    room.buffer = impulse(ctx, 1.1, mulberry32(seed ^ 0x5d));
    const roomHp = ctx.createBiquadFilter();
    roomHp.type = 'highpass';
    roomHp.frequency.value = 300;
    this.drumRoom = ctx.createGain();
    this.drumRoom.gain.value = DRUM_ROOM;
    this.drumBus.connect(roomHp).connect(this.drumRoom).connect(room).connect(this.drumTone);

    // The echo: a dotted eighth, ping-ponging left and right, each repeat darker and
    // quieter. Its send is closed until a note is thrown into it (see play), except in the
    // styles that keep a little echo on the lead throughout (ECHO_ALWAYS).
    this.echoSend = ctx.createGain();
    this.echoSend.gain.value = 0;
    this.leadBus.connect(this.echoSend);
    const left = ctx.createDelay(2);
    const right = ctx.createDelay(2);
    const darken = ctx.createBiquadFilter();
    darken.type = 'lowpass';
    darken.frequency.value = 3200;
    const back = ctx.createGain();
    back.gain.value = 0.38;
    const panL = ctx.createStereoPanner();
    panL.pan.value = -0.7;
    const panR = ctx.createStereoPanner();
    panR.pan.value = 0.7;
    this.echoSend.connect(left);
    left.connect(panL).connect(this.tone);
    left.connect(right);
    right.connect(panR).connect(this.tone);
    right.connect(darken).connect(back).connect(left);
    this.echoTimes = [left, right];

    this.toneWander.connect(this.tone.frequency);

    // Texture, after the tone filter.
    this.crackle = ctx.createGain();
    this.crackle.connect(this.shaper);
    const crackleHp = ctx.createBiquadFilter();
    crackleHp.type = 'highpass'; crackleHp.frequency.value = 150;
    crackleHp.connect(this.crackle);
    this.loop(crackleBuffer(ctx, REVOLUTION * 4, mulberry32(seed ^ 0xc4)), crackleHp);
    this.hiss = ctx.createGain();
    this.hiss.connect(this.shaper);
    const hissLp = ctx.createBiquadFilter();
    hissLp.type = 'lowpass'; hissLp.frequency.value = 7000;
    hissLp.connect(this.hiss);
    // The record's surface, not tape hiss (surfaceBuffer).
    const surfaceHp = ctx.createBiquadFilter();
    surfaceHp.type = 'highpass'; surfaceHp.frequency.value = 300;
    surfaceHp.connect(hissLp);
    this.loop(surfaceBuffer(ctx, mulberry32(seed ^ 0x5f)), surfaceHp);
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

  /** One gain per lead instrument on a tune's lead lane, set to the instrument's trim and the genre's seat. */
  private readonly seats = new WeakMap<GainNode, Map<string, GainNode>>();
  private leadSeat(lane: GainNode, mood: LofiMood, voice: string, pan = 0): GainNode {
    let byVoice = this.seats.get(lane);
    if (!byVoice) { byVoice = new Map(); this.seats.set(lane, byVoice); }
    const key = `${voice}:${pan}`;
    let seat = byVoice.get(key);
    if (!seat) {
      seat = this.ctx.createGain();
      seat.gain.value = 10 ** (((LEAD_TRIM[voice as LofiStyle['lead']] ?? 0) + (LEAD_SEAT[mood] ?? 0)) / 20);
      if (pan) {
        const place = this.ctx.createStereoPanner();
        place.pan.value = pan;
        seat.connect(place).connect(lane);
      } else seat.connect(lane);
      byVoice.set(key, seat);
    }
    return seat;
  }

  /**
   * The bars to play from `seed`: the endless stream, or a generator track's fitted bars,
   * the same ones the generator composes (lofiTrack), ending with the last tune's outro.
   */
  private open(seed: number): LofiStream {
    const { mood, style, repeat, bars, tag } = this.settings;
    if (bars === undefined) return lofiStream(seed, { mood, style, repeat });
    const track = lofiTrack(seed, { mood, style, tag }, bars);
    this.trackBars = track.length;
    let at = 0;
    return { next: () => track[Math.min(at++, track.length - 1)]! };
  }

  /** Start a new tune now, from `seed`, fading out whatever is still ringing. */
  skip(seed: number): void {
    const old = this.lanes;
    const now = this.ctx.currentTime;
    for (const g of Object.values(old)) g.gain.setTargetAtTime(0, now, 0.06);
    if (typeof setTimeout === 'function') setTimeout(() => { for (const g of Object.values(old)) g.disconnect(); }, 800);
    this.lanes = this.newLanes();
    this.seed = seed;
    this.stream = this.open(seed);
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

  /** Queue everything up to `seconds` at once (an OfflineAudioContext). Short renders and
   *  tests only: see renderStation for a whole track. */
  scheduleAll(seconds: number): void {
    this.nextBarAt = 0.05;
    this.fill(seconds);
    this.flush(seconds);
  }

  /** Queue the notes up to `until` seconds, from the start the first time (an offline render in windows). */
  scheduleUntil(until: number): void {
    if (!this.offlineStarted) { this.nextBarAt = 0.05; this.offlineStarted = true; }
    this.fill(until);
    this.flush(until);
  }
  private offlineStarted = false;

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
      if (this.settings.bars !== undefined && this.taken >= this.trackBars) {
        if (!this.settings.repeat) return;
        // A saved generator track repeats from its top, wherever it was started (a seek).
        this.stream = this.open(this.seed);
        this.taken = 0;
      }
      const raw = this.stream.next();
      const bar = this.settings.shape ? this.settings.shape(raw) : raw;
      this.taken++;
      const spb = 60 / bar.tune.bpm;
      const at = this.nextBarAt;
      // The band plays the bar (lib/lofi-perform.ts): the drums in the style's pocket, a
      // strummed guitar's chords fingered and strummed, a lead guitar's bends and slides.
      const keysV = bar.voices?.keys ?? bar.tune.style.keys;
      const leadV = bar.voices?.lead ?? bar.tune.style.lead;
      for (const note of perform(bar, spb, keysV, leadV)) {
        const lead = note.voice === 'hey' && isShoutPhrase(note.mod ?? 0) ? SHOUT_LEAD : 0;
        this.queue.push({ at: at + note.beat * spb, spb, note, bar, lanes: this.lanes, lead });
      }
      this.marks.push({ at, bar, pos: this.taken - 1 });
      this.nextBarAt = at + 4 * spb;
    }
  }

  /** Play every queued note and bar change due before `until`. */
  private flush(until: number): void {
    const now = this.ctx.currentTime;
    const due = this.queue.filter(q => q.at - q.lead < until);
    if (due.length) this.queue = this.queue.filter(q => q.at - q.lead >= until);
    for (const q of due) {
      if (q.at < now - 0.05) continue;   // a stalled page: drop it rather than pile notes up late
      this.play(q);
    }
    const marks = this.marks.filter(m => m.at < until);
    if (marks.length) this.marks = this.marks.filter(m => m.at >= until);
    for (const m of marks) {
      if (m.bar.index === 0 || !this.styled) { this.applyStyle(m.bar.tune.style, Math.max(m.at, now)); this.styled = true; }
      this.lastOpen = m.bar.open;
      this.markSection(m.bar, Math.max(m.at, now));
      this.tone.frequency.setTargetAtTime(this.cutoff(m.bar.open), Math.max(m.at, now), 0.5);
      this.drumTone.frequency.setTargetAtTime(drumCutoff(this.cutoff(m.bar.open)), Math.max(m.at, now), 0.5);
      if (this.running && typeof setTimeout === 'function') {
        setTimeout(() => { this.current = m.bar; this.currentAt = m.at; this.currentPos = m.pos; this.onBar?.(m.bar); }, Math.max(0, (m.at - now) * 1000));
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
    // A dance tune changes instruments between sections; the bar says which it plays.
    const keysV = bar.voices?.keys ?? st.keys;
    const leadV = bar.voices?.lead ?? st.lead;
    const bassV = bar.voices?.bass ?? st.bass;
    const snareV = bar.voices?.snare ?? st.snare;
    const hatsV = bar.voices?.hats ?? st.hats;
    switch (note.voice) {
      case 'keys': {
        // A future-bass chord's wub is swings a beat (the voice wants Hz), plus 16 for a bend.
        const m = note.mod ?? 0;
        if (G.GUITAR_KEYS.has(keysV)) G.keys(keysV, k, lanes.keys, t, note.midi, vel * VARIANT.keys[keysV], len, m);
        else if (W.WORLD_KEYS.has(keysV)) W.keys(keysV, k, lanes.keys, t, note.midi, vel * VARIANT.keys[keysV], len);
        // The brass section blows each chord as hard as the tune says; its variant level is only a level.
        else if (keysV === 'brass') R.keys(k, lanes.keys, t, note.midi, vel, len, VARIANT.keys[keysV]);
        else if (S.STRING_KEYS.has(keysV)) S.keys(k, lanes.keys, t, note.midi, vel * VARIANT.keys[keysV], len);
        else V.keys(keysV, k, lanes.keys, t, note.midi, vel * VARIANT.keys[keysV], len, { rate: (m % 16) / spb, bend: m >= 16 });
        break;
      }
      case 'bass': {
        // A wobble's, growl's or screech's swing is cycles a beat (the voice wants Hz); the
        // other basses' `mod` is how the note is played, passed as it is.
        const swings = bassV === 'wobble' || bassV === 'growl' || bassV === 'screech';
        const mod = swings ? (note.mod ?? 0) / spb : (note.mod ?? 0);
        const level = vel * VARIANT.bass[bassV] * 10 ** ((BASS_SEAT[bar.tune.mood] ?? 0) / 20);
        const tone = { bright: st.bright ?? 1, drive: st.drive ?? 1 };
        if (bassV === 'log') W.bass(k, lanes.bass, t, note.midi, level, len, mod, tone);
        else if (H.HOUSE_BASSES.has(bassV)) H.bass(k, lanes.bass, t, note.midi, level, len, tone);
        else V.bass(bassV, k, lanes.bass, t, note.midi, level, len, mod, tone);
        // In a chorus, a modern record puts a sine under its electric bass for the weight a
        // bass guitar alone does not give: only in the styles that do it, only in the drop,
        // where the song opens up, so the verses keep the bass guitar's own sound.
        if (SUB_UNDER.has(bar.tune.mood) && bar.section === 'drop' && SUB_BASSES.has(bassV)) V.sub(k, lanes.bass, t, V.mtof(note.midi), vel * 0.7, len);
        break;
      }
      case 'lead': {
        const lift = SINGS_FAMILY.has(bar.tune.mood) ? SINGS_LEAD : 1;
        // A note that starts as the last one ends, on the same instrument, is slurred onto
        // it: a wind glides from that pitch instead of tonguing a new attack.
        // A jazz soloist lays back: the lead's notes on the beat sit a little behind it, the
        // swung off-beats stay with the ride.
        const lt = LAID_BACK.has(bar.tune.mood) && Math.abs(note.beat - Math.round(note.beat)) < 0.01 ? t + LAY_BACK : t;
        const prev = this.lastLead;
        const gap = lt - prev.end;
        const from = prev.voice === leadV && gap > -0.25 && gap < SLUR_GAP && prev.midi !== note.midi ? prev.midi : undefined;
        this.lastLead = { end: lt + len, midi: note.midi, voice: leadV };
        const play = (v: string, level: number, shift = 0, late = 0, pan = 0, how?: R.BrassPlay): void => {
          const seat = this.leadSeat(lanes.lead, bar.tune.mood, v, pan);
          const at = lt + late;
          if (v === 'chop') C.chop(k, seat, at, note.midi + shift, level, len, note.mod ?? 0, spb, bar.tune.seed, bar.index * 1000 + Math.round(note.beat * 48));
          else if (R.WIND_LEADS.has(v)) R.lead(v, k, seat, at, note.midi + shift, level, len, note.mod ?? 0, from === undefined ? undefined : from + shift, how);
          else if (S.STRING_LEADS.has(v)) S.lead(v, k, seat, at, note.midi + shift, level, len, note.mod ?? 0, from === undefined ? undefined : from + shift);
          else if (LG.LEAD_GUITARS.has(v)) LG.lead(v, k, seat, at, note.midi + shift, level, len, note.mod ?? 0, from === undefined ? undefined : from + shift);
          else if (W.WORLD_LEADS.has(v as LofiStyle['lead'])) W.lead(v as LofiStyle['lead'], k, seat, at, note.midi + shift, level, len, note.mod ?? 0);
          else V.lead(v as LofiStyle['lead'], k, seat, at, note.midi + shift, level, len, note.mod ?? 0, from === undefined ? undefined : from + shift);
        };
        // A horn section: in the styles built on one, a horn's line is played by the
        // section (lib/lofi-winds.ts): a second horn in unison and a trombone an octave
        // under, each player a little out of tune and a little late, placed across the
        // stage, as a ska or soul section plays.
        const section = HORN_SECTION.has(bar.tune.mood) && (leadV === 'trumpet' || leadV === 'sax');
        if (section) {
          // The section's brass falls off the long note that ends an eight-bar phrase, as a
          // ska or soul section does (the saxophone leading holds its note).
          const fall = bar.index % 8 === 7 && note.beat + note.dur >= 3.4 && note.dur >= 0.5 ? SECTION_FALL : 0;
          for (const p of R.hornSection(leadV, k)) play(p.voice, vel * (p.voice === leadV ? VARIANT.lead[leadV] : 1) * lift, p.shift, p.late, p.pan, { detune: p.detune, straight: true, gain: p.level, fall });
        } else play(leadV, vel * VARIANT.lead[leadV] * lift);
        // An echo throw: a phrase's last lead note (the fourth bar's, held at least half a
        // beat) thrown into the echo in the styles that throw, the send closing after the note.
        if (THROWS.has(bar.tune.mood) && bar.index % 4 === 3 && note.beat + note.dur >= 3.4 && note.dur >= 0.5 && bar.section !== 'intro') {
          const base = ECHO_ALWAYS.has(bar.tune.mood) ? ECHO_BED : 0;
          this.echoSend.gain.setTargetAtTime(THROW_LEVEL, lt, 0.01);
          this.echoSend.gain.setTargetAtTime(base, lt + len, 0.05);
        }
        // A doubled drop: a second instrument plays the same note a little quieter.
        // A lead's own ornament (a harp's run, a chop's stutter or reversed swell): a doubling instrument leaves it out.
        const double = bar.voices?.double;
        if (double && !ownOnly(note.mod)) play(double, vel * VARIANT.lead[double] * lift * 0.7);
        break;
      }
      case 'crash': D.crash(k, lanes.drums, t, vel, this.kitOf(bar.tune)); break;
      case 'riser': V.riser(k, lanes.fx, t, vel * RISER_LEVEL, len); break;
      case 'coin': V.coin(k, lanes.fx, t, note.midi, vel, note.mod ?? 0); break;
      case 'sparkle': V.sparkle(k, lanes.fx, t, note.midi, vel, len, note.mod ?? 4); break;
      case 'game': V.game(k, lanes.fx, t, note.midi, vel, note.mod ?? 0); break;
      case 'magpie': V.magpie(k, lanes.fx, t, note.midi, vel, len, note.mod ?? 0); break;
      case 'kookaburra': V.kookaburra(k, lanes.fx, t, note.midi, vel, note.mod ?? 0); break;
      case 'tom': D.tom(k, lanes.drums, t, note.midi, vel, this.kitOf(bar.tune)); break;
      case 'perc':
        if ((note.mod ?? 0) >= W.WORLD_PERC_FROM) W.perc(k, lanes.drums, t, note.midi, vel, note.mod ?? 0);
        else V.perc(k, lanes.drums, t, note.midi, vel, note.mod ?? 0);
        break;
      case 'hey':
        // The band's phrases are said by the formant voice, each call its own take.
        if (isShoutPhrase(note.mod ?? 0)) bandShout(k, lanes.fx, t, note.midi, vel, note.mod ?? 0, spb, tuneVoice(bar), `${bar.index}|${note.beat}`);
        else V.hey(k, lanes.fx, t, note.midi, vel, note.mod ?? 0);
        break;
      case 'layer': {
        // The layered basses: the travelling line glides from its last note when it follows straight on.
        if (note.mod === 2) { BL.stab(k, lanes.bass, t, note.midi, vel); break; }
        const glide = t - this.lastTravel.end < 0.03 ? this.lastTravel.midi : undefined;
        this.lastTravel = { end: t + len, midi: note.midi };
        BL.travel(k, lanes.bass, t, note.midi, vel, len, glide);
        break;
      }
      case 'tag': lollyTag(k, lanes.fx, t, note.midi, vel, note.mod ?? 0, 60 / bar.tune.bpm, tuneVoice(bar), this.echoTimes[0]); break;
      case 'bwah': {
        // A bass shot's `mod` is the shot, plus 4 for each swing a beat (the voice wants Hz).
        const m = note.mod ?? 0;
        V.bwah(k, lanes.bass, t, note.midi, vel, len, m % 4, Math.floor(m / 4) / spb, { bright: st.bright ?? 1, drive: st.drive ?? 1 });
        break;
      }
      case 'phaser': V.phaser(k, lanes.fx, t, note.midi, vel, len, note.mod ?? 0); break;
      case 'blip': V.blip(k, lanes.fx, t, note.midi, vel, note.mod ?? 0); break;
      case 'soar': V.soar(k, lanes.bass, t, note.midi, vel, len, note.mod === 1); break;
      case 'kick': { const kit = this.kitOf(bar.tune); D.kick(k, lanes.drums, t, vel, st.kick, st.kickLen, kit.kick, kit); this.duck(t, st.duck); break; }
      case 'snare':
        // A section given the cross-stick plays its snare hits on the rim.
        if (bar.voices?.snare === 'rim') { D.rim(k, lanes.drums, t, vel * VARIANT.snare.rim, this.kitOf(bar.tune)); break; }
        // A snare note the drummer holds (a `dur`) is a press roll (lib/lofi-perform.ts).
        if (note.dur > 0 && snareV === 'snare') { D.press(k, lanes.drums, t, vel, st.snareTone, this.kitOf(bar.tune)); break; }
        // A roll that climbs (Sherbert's builds) tunes each hit up by its `mod` in semitones.
        D.snare(snareV === 'rim' ? 'snare' : snareV, k, lanes.drums, t, vel * VARIANT.snare[snareV], st.snareTone * 2 ** ((note.mod ?? 0) / 12), this.kitOf(bar.tune));
        if (note.vel > 0.5) this.duck(t, st.duck * 0.45);   // a backbeat, not a ghost: the music gives it a little room
        break;
      case 'rim': {
        // A section given another snare plays its rim hits on that snare instead.
        const over = bar.voices?.snare;
        if (over && over !== 'rim') D.snare(over, k, lanes.drums, t, vel * VARIANT.snare[over], st.snareTone, this.kitOf(bar.tune));
        else D.rim(k, lanes.drums, t, vel * VARIANT.snare.rim, this.kitOf(bar.tune));
        break;
      }
      case 'hat':
        // A `mod` of 2 is the hat's foot (the pedal), whatever the hats are played on; a `mod` of 3 the ride's bell (lib/lofi-perform.ts).
        if (note.mod === 2) D.pedal(k, lanes.drums, t, vel, st.hatTone, this.kitOf(bar.tune));
        else if (note.mod === HAT_BELL) D.ride(k, lanes.drums, t, vel, st.hatTone, this.kitOf(bar.tune), true);
        else D.hat(hatsV, k, lanes.drums, t, vel * VARIANT.hats[hatsV], st.hatTone, false, note.mod === 1, this.kitOf(bar.tune));
        break;
      case 'openHat': D.hat(hatsV, k, lanes.drums, t, vel * VARIANT.hats[hatsV], st.hatTone, true, false, this.kitOf(bar.tune)); break;
    }
  }

  /** Dip the music under a kick (it reaches the speakers 20 ms later, through the wow delay). */
  private duck(t: number, depth: number): void {
    const g = this.music.gain;
    const at = Math.max(this.ctx.currentTime, t - 0.02);
    g.setTargetAtTime(1 - 0.26 * depth, at, 0.006);
    g.setTargetAtTime(1, at + 0.05, 0.11);
  }

  /**
   * What the arrangement does to the sound, bar by bar: the room grows in the quiet
   * sections and tightens in a drop; through a build (in the styles built on drops) a
   * high-pass climbs on the music, a bar at a time, and opens wide the moment the drop
   * arrives; and the echo keeps the tempo.
   */
  private markSection(bar: LofiBar, at: number): void {
    const spb = 60 / bar.tune.bpm;
    for (const d of this.echoTimes) d.delayTime.setValueAtTime(Math.min(1.9, 0.75 * spb), at);
    const room = SECTION_ROOM[bar.section] ?? 1;
    if (room !== this.sectionRoom) {
      this.sectionRoom = room;
      this.reverbSend.gain.setTargetAtTime(BUS.reverb * this.mix.reverb * this.colour.room * room, at, 0.6);
      // The drums' room follows the style's room, more gently than the music's: a grunge kit in a big room, a punk one tight.
      this.drumRoom.gain.setTargetAtTime(DRUM_ROOM * this.mix.reverb * room * Math.sqrt(this.colour.room), at, 0.6);
    }
    this.echoSend.gain.setTargetAtTime(ECHO_ALWAYS.has(bar.tune.mood) ? ECHO_BED : 0, at, 0.2);
    if (bar.section === 'build' && SWEEPS.has(bar.tune.mood)) {
      this.buildBars++;
      const to = Math.min(900, 40 * 2 ** (this.buildBars * 1.05));
      this.sweep.frequency.setValueAtTime(Math.max(20, this.sweep.frequency.value), at);
      this.sweep.frequency.exponentialRampToValueAtTime(to, at + 4 * spb);
    } else if (this.buildBars > 0) {
      this.buildBars = 0;
      this.sweep.frequency.cancelScheduledValues(at);
      this.sweep.frequency.setValueAtTime(20, at);   // the drop: the music comes back whole
    }
  }

  // ── sound ─────────────────────────────────────────────────────────────────

  /** A new tune's colour: wobble, room, tone and grit, from the moment it starts. */
  private applyStyle(style: LofiStyle, at: number): void {
    this.colour = style;
    const grit = style.crunch ? GRIT_MIX : 0;
    this.crunch.gain.setTargetAtTime(grit / GRIT_LIFT, at, 0.1);
    this.dry.gain.setTargetAtTime(1 - grit, at, 0.1);
    this.reverbSend.gain.setTargetAtTime(BUS.reverb * this.mix.reverb * style.room * this.sectionRoom, at, 0.1);
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
    // Crackle and hiss: none at the bottom of the slider, a little at the middle (the
    // balance Andy set in the lab), then a steep climb, so the top half of the slider
    // goes from a faint surface to a worn record. They had run in a straight line
    // to a top 38 dB under the music, and the slider seemed to do nothing. A cleaner
    // genre starts with less dust and reaches the same full dust at the top.
    const t = this.settings.texture;
    const amount = this.colour.dust + (1 - this.colour.dust) * t * t;
    const dust = tex * amount * DUST_MID * (t / 0.5) ** 3;
    set(this.crackle.gain, 0.06 * dust);
    set(this.hiss.gain, 0.0053 * dust);
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
    this.fxBus.gain.value = BUS.fx * this.mix.fx;
    this.drumBus.gain.value = BUS.drums * this.mix.drums;
    this.reverbSend.gain.value = BUS.reverb * this.mix.reverb * this.colour.room * this.sectionRoom;
  }

  private newLanes(): Lanes {
    const lane = (to: AudioNode): GainNode => { const g = this.ctx.createGain(); g.connect(to); return g; };
    return { keys: lane(this.keysBus), bass: lane(this.bassBus), lead: lane(this.leadBus), drums: lane(this.drumBus), fx: lane(this.fxBus) };
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
  station.fadeOutAt(Math.max(0, seconds - 2), 2);
  return renderStation(ctx, station, seconds);
}

/** How far ahead of an offline render its notes are scheduled, and how often it stops to schedule more (seconds). */
const OFFLINE_AHEAD = 4;
const OFFLINE_STEP = 1;

/**
 * Render a station offline, scheduling its notes a few seconds ahead of the render as it
 * goes, as the live station does, rather than the whole track at once. A graph that holds
 * every note of a track is walked on every block, so the old way slowed with the square
 * of the track's length: a 64-bar track crawled at a twentieth of real time and looked
 * hung. The render stops once a second to schedule more, and tells `onProgress` how far
 * it has got (0 to 1).
 */
export async function renderStation(ctx: OfflineAudioContext, station: LofiStation, seconds: number, onProgress?: (done: number) => void): Promise<AudioBuffer> {
  station.scheduleUntil(Math.min(seconds, OFFLINE_AHEAD));
  for (let s = OFFLINE_STEP; s < seconds; s += OFFLINE_STEP) {
    const at = s;
    void ctx.suspend(at).then(() => {
      station.scheduleUntil(Math.min(seconds, at + OFFLINE_AHEAD));
      onProgress?.(at / seconds);
      void ctx.resume();
    });
  }
  return ctx.startRendering();
}

/** A tune's identity for its voices, from which the producer's tag and the band's shouts draw their speakers. */
function tuneVoice(bar: LofiBar): string {
  return `${bar.tune.key}|${bar.tune.bpm}|${bar.tune.progressions[0].join(' ')}`;
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
 * Vinyl crackle, as a record makes it rather than as static: many tiny ticks and the
 * occasional louder pop, gathered in dusty patches. Each tick is a short damped ring at its
 * own pitch (dust knocking the stylus rings it, high and brief), in one groove wall or the
 * other, so the crackle sits in stereo the way it does on a record; a pop is lower, longer
 * and usually in both walls. Most ticks are tiny and a few are loud, as on a worn record. On
 * some records a scratch crosses the groove and ticks once a revolution. The buffer is four
 * revolutions long, in stereo.
 */
function crackleBuffer(ctx: BaseAudioContext, seconds: number, rng: () => number): AudioBuffer {
  const sr = ctx.sampleRate;
  const b = ctx.createBuffer(2, Math.ceil(seconds * sr), sr);
  const L = b.getChannelData(0);
  const R = b.getChannelData(1);
  const tick = 30 / sr;
  const pop = 0.6 / sr;
  const dust = wanderBuffer(ctx, seconds, [0.25, 1.2], 0, rng).getChannelData(0);
  /** A damped ring at `hz`, falling by e in `tau` seconds, added at `at` into each wall by its share. */
  const ring = (at: number, hz: number, tau: number, amp: number, left: number, right: number): void => {
    const len = Math.min(Math.ceil(tau * 5 * sr), L.length - at - 1);
    const w = 2 * Math.PI * hz / sr;
    const fall = Math.exp(-1 / (tau * sr));
    const phase = rng() * Math.PI * 2;
    let env = amp;
    for (let n = 0; n < len; n++) {
      const v = env * Math.sin(phase + w * n);
      L[at + n] = (L[at + n] ?? 0) + v * left;
      R[at + n] = (R[at + n] ?? 0) + v * right;
      env *= fall;
    }
  };
  for (let i = 0; i < L.length - 8; i++) {
    const r = rng() / (0.25 + 1.9 * Math.max(0, (dust[i] ?? 0) + 0.45));   // a dusty patch is denser
    if (r >= tick) continue;
    const big = r < pop;
    // Which wall: a tick is mostly in one, a pop mostly in both.
    const side = rng();
    const left = big ? 0.75 + rng() * 0.25 : side < 0.45 ? 1 : side < 0.9 ? 0.15 * rng() : 0.8;
    const right = big ? 0.75 + rng() * 0.25 : side < 0.45 ? 0.15 * rng() : side < 0.9 ? 1 : 0.8;
    const sign = rng() < 0.5 ? -1 : 1;
    if (big) {
      ring(i, 300 * 2 ** (rng() * 2.3), 0.0005 + rng() * 0.0012, sign * (0.3 + rng() * 0.4), left, right);
      ring(i, 2500 + rng() * 3000, 0.00015, sign * 0.3, left, right);   // the pop's sharp front
    } else {
      // Most ticks tiny, a few loud: the level falls away like a worn record's.
      ring(i, 1800 * 2 ** (rng() * 2.3), 0.00008 + rng() * 0.00025, sign * (0.06 + 0.75 * rng() ** 4), left, right);
    }
  }
  if (rng() < 0.35) {
    const at = Math.floor(rng() * REVOLUTION * sr);
    const hz = 600 + rng() * 900;
    for (let rev = at; rev < L.length - 400; rev += Math.round(REVOLUTION * sr)) ring(rev, hz, 0.0009, 0.24, 0.9, 0.7);
  }
  return b;
}

/**
 * A record's surface: the soft noise of the stylus in the groove, darker than tape hiss
 * (most of it between a few hundred hertz and a few kilohertz, falling like pink noise),
 * a little different in each wall, and swelling gently once a revolution as the record
 * turns. Two revolutions long, so the swell loops without a seam.
 */
function surfaceBuffer(ctx: BaseAudioContext, rng: () => number): AudioBuffer {
  const sr = ctx.sampleRate;
  const seconds = REVOLUTION * 2;
  const b = ctx.createBuffer(2, Math.ceil(seconds * sr), sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    // A pink-ish noise: three one-pole stages of white noise, summed (Voss and Kellet's way).
    let p0 = 0;
    let p1 = 0;
    let p2 = 0;
    const turn = rng() * Math.PI * 2;
    for (let i = 0; i < d.length; i++) {
      const white = rng() * 2 - 1;
      p0 = 0.99765 * p0 + white * 0.099;
      p1 = 0.963 * p1 + white * 0.2965;
      p2 = 0.57 * p2 + white * 1.0526;
      const swell = 1 + 0.22 * Math.sin(turn + (2 * Math.PI * i) / (REVOLUTION * sr));
      d[i] = (p0 + p1 + p2 + white * 0.1848) * 0.11 * swell;
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
