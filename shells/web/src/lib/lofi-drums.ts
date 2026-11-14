// SPDX-License-Identifier: MPL-2.0
/**
 * The drums every station plays: kick, snare (and clap, brushes, the stacked snare, the
 * cross-stick), hats and the hat's foot, ride, crash and toms. Synthesised like every other
 * voice (lib/lofi-voices.ts holds the shared pieces they use: noise, the stick's crack, the
 * cymbal metal).
 *
 * KITS. Each tune plays its own kit, chosen from its seed and the kind of music by
 * `drumKit()`: which kick (a band's acoustic drum, a jazz drummer's feathered one, a lofi
 * boom, an 808's long sub, a 909-style punch, a tight one), how much the snare's wires
 * rattle and how long its body rings, the hats' length and brightness, the ride's pitch,
 * bell and wash, the crash (a crash, a splash or a china), and acoustic or electronic toms.
 * The composer's notes are untouched (the kit is drawn here, from the seed, with its own
 * random source), so a tune keeps every note and gains a kit of its own.
 *
 * TOUCH. A drum struck harder is not only louder: it is brighter, its wires and its stick
 * are louder still, and a membrane's pitch starts higher and falls (the head's tension
 * rises with the strike). A ghost note is a soft, dark tap. Each hit also differs a little
 * from the last (a few per cent in pitch and length), the way no two strokes are alike.
 * The research behind the numbers: Sound On Sound's Synth Secrets series (snare, kick,
 * cymbals), the membrane's Bessel-zero mode ratios, and pitch glide in proportion to the
 * strike's energy (Avanzini, Marogna and Bank, DAFx-10).
 */
import type { LofiMood, LofiStyle } from '../../../../engine/src/lofi-compose.ts';
import { EPS, mtof, noiseAt, osc, crack, metalAt, drivenBy, type VoiceKit } from './lofi-voices.ts';
import * as K from './lofi-kit.ts';

export type KickKind = 'sub' | 'punch' | 'tight' | 'boom' | 'house' | 'acoustic' | 'feather' | 'click';
export type CrashKind = 'crash' | 'splash' | 'china';

/** One tune's drum kit. The numbers are each about 1, the kit's lean from the middle. */
export interface DrumKit {
  kick: KickKind;
  /** The snare: its wires' rattle, how long its body rings, its brightness. */
  wires: number; ring: number; snareBright: number;
  /** The hats: their length and brightness. */
  hatDecay: number; hatBright: number;
  /** The ride: its pitch (the metal's rate), its bell and how long its wash lasts. */
  rideRate: number; bell: number; wash: number;
  crash: CrashKind;
  /** A sub boom under a full-strength crash: a dance drop's, never a band's. */
  boom: boolean;
  /** A head's modes and a small fall (a band's toms) or a big electronic sweep. */
  acousticToms: boolean;
  /** Real shells: the snare, the toms and an acoustic or feathered kick rendered as the instruments are (lib/lofi-kit.ts). */
  real: boolean;
  /** Real cymbals: the ride, the crash and the hats rendered the same way; an electronic kit keeps its synthesised metal. */
  realCymbals: boolean;
  /** The snare head's pitch (Hz), and the kit's own seed for rendering its pieces. */
  snareHead: number;
  /** How the toms are tuned against the composer's (semitones): a jazz kit's small toms high, the others a little either way. */
  tomTune: number;
  id: string;
}

/** The kinds of music, by how their drums are played. */
const JAZZ = new Set<LofiMood>(['jazz', 'swing']);
const BAND = new Set<LofiMood>(['blues', 'country', 'rock', 'punk', 'ska', 'metal', 'soul', 'funk', 'reggae', 'spanish', 'straya', 'afrobeat', 'kora', 'persian', 'guzheng', 'koto', 'citypop', 'fantasy', 'grunge', 'stoner', 'shoegaze', 'surf', 'yacht']);
const DUSTY = new Set<LofiMood>(['warm', 'lateNight', 'rainy', 'triphop', 'dream', 'lofiHouse']);
const SUBS = new Set<LofiMood>(['dubstep', 'brostep', 'dnb', 'amapiano']);
/** The styles whose sound is the electronic kit's own synthesised metal. */
const SYNTH_METAL = new Set<LofiMood>(['acid', 'electro', 'chiptune', 'sherbert']);

/** A small seeded random source, its own stream, so drawing a kit moves nothing else. */
function kitRandom(seed: number, mood: string): () => number {
  let a = (seed ^ 0x6b1d2e5) >>> 0;
  for (let i = 0; i < mood.length; i++) a = Math.imul(a ^ mood.charCodeAt(i), 0x5bd1e995) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** The kits a person can choose, each drawn as a kind of music draws its own. */
export const LOFI_KITS = ['acoustic', 'jazz', 'dusty', 'hiphop', 'electronic', '808'] as const;
export type LofiKit = typeof LOFI_KITS[number];
export const LOFI_KIT_NAME: Record<LofiKit, string> = { acoustic: 'Acoustic kit', jazz: 'Jazz kit', dusty: 'Dusty kit', hiphop: 'Hip-hop kit', electronic: 'Electronic kit', '808': '808 kit' };
/** The kind of music whose kit each choice is. */
export const LOFI_KIT_MOOD: Record<LofiKit, LofiMood> = { acoustic: 'rock', jazz: 'jazz', dusty: 'warm', hiphop: 'hiphop', electronic: 'electro', '808': 'dubstep' };

/** The kit a tune plays, from its seed and its kind of music. */
export function drumKit(seed: number, mood: LofiMood): DrumKit {
  const r = kitRandom(seed >>> 0, mood);
  const between = (lo: number, hi: number): number => Math.round((lo + r() * (hi - lo)) * 100) / 100;
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const jazz = JAZZ.has(mood);
  const band = jazz || BAND.has(mood);
  const kick: KickKind = jazz ? 'feather'
    : mood === 'metal' ? 'click'
      : mood === 'punk' ? pick(['acoustic', 'punch'] as const)
        : band ? (mood === 'rock' ? pick(['acoustic', 'acoustic', 'punch'] as const) : 'acoustic')
      : mood === 'hiphop' ? pick(['boom', 'punch', 'sub'] as const)
        : mood === 'lofiHouse' ? 'house'
        : DUSTY.has(mood) ? pick(['boom', 'boom', 'tight'] as const)
        : SUBS.has(mood) ? pick(['sub', 'sub', 'punch'] as const)
          : pick(['sub', 'punch', 'tight'] as const);
  return {
    kick,
    wires: between(jazz ? 0.6 : 0.75, 1.45), ring: between(0.7, 1.5), snareBright: between(0.88, 1.18),
    hatDecay: between(0.75, 1.4), hatBright: between(0.88, 1.15),
    // A jazz ride is dark and washy, its bell barely there; a jazz kit has no china.
    rideRate: jazz ? between(0.66, 0.8) : between(0.8, 0.98), bell: jazz ? between(0.2, 0.6) : between(0.3, 1.2), wash: jazz ? between(1.3, 1.7) : between(0.8, 1.5),
    crash: pick(jazz ? ['crash', 'crash', 'splash'] as const : band ? ['crash', 'crash', 'splash', 'china'] as const : ['crash', 'crash', 'splash'] as const),
    boom: !band && !DUSTY.has(mood) && mood !== 'hiphop',
    acousticToms: band,
    real: band || DUSTY.has(mood) || mood === 'hiphop' || mood === 'rnb',
    realCymbals: !SYNTH_METAL.has(mood),
    snareHead: Math.round(between(170, 235)),
    tomTune: jazz ? 7 : Math.round(between(-2, 2)),
    id: `${seed >>> 0}:${mood}`,
  };
}

/** The kit a tune plays when none is known: the drums as they always sounded. */
export const PLAIN_KIT: DrumKit = { kick: 'sub', wires: 1, ring: 1, snareBright: 1, hatDecay: 1, hatBright: 1, rideRate: 0.9, bell: 1, wash: 1, crash: 'crash', boom: true, acousticToms: false, real: false, realCymbals: false, snareHead: 200, tomTune: 0, id: 'plain' };

// ── the real kit's recordings ───────────────────────────────────────────────────

/** The pieces a kit has rendered so far, per audio context: rendered at a piece's first hit, kept for the tune. */
interface Bank { buffers: Map<string, AudioBuffer>; cymbals: Map<string, ReturnType<typeof K.cymbalBase>>; open: GainNode | null; nextRender: number }
const BANKS = new WeakMap<BaseAudioContext, Map<string, Bank>>();
function bankOf(ctx: BaseAudioContext, kit: DrumKit): Bank {
  let byKit = BANKS.get(ctx);
  if (!byKit) { byKit = new Map(); BANKS.set(ctx, byKit); }
  let bank = byKit.get(kit.id);
  if (!bank) {
    if (byKit.size > 8) byKit.clear();
    bank = { buffers: new Map(), cymbals: new Map(), open: null, nextRender: -Infinity };
    byKit.set(kit.id, bank);
  }
  return bank;
}
/** A seeded source for one piece of one kit, so a piece renders the same every time. */
function pieceRandom(kit: DrumKit, name: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619) >>> 0;
  return kitRandom(h, kit.id);
}
/** The strokes a piece is recorded at (soft, medium, hard), and how many takes of each, so no two hits in a row are the same. */
const LAYERS = [0.35, 0.65, 0.95] as const;
const TAKES = 3;
/** The least music (s) between two new takes from one kit. */
const RENDER_GAP = 0.2;
/** One piece at the nearest of its strengths, in one of its takes, rendered on first use; the player sets the loudness. */
function piece(k: VoiceKit, kit: DrumKit, t: number, name: string, vel: number, make: (sr: number, vel: number, rand: () => number) => Float32Array): { buf: AudioBuffer; scale: number } {
  const bank = bankOf(k.ctx, kit);
  const at = vel < 0.5 ? LAYERS[0] : vel < 0.8 ? LAYERS[1] : LAYERS[2];
  let key = `${name}:${at}:${Math.floor(k.rng() * TAKES)}`;
  // A new take costs up to a tenth of a second to work out (a long ride), so a kit playing
  // live makes one at most every RENDER_GAP of music and plays a take it already has
  // meanwhile (a render ahead of playing makes every take). Paced by the music's time, not
  // the clock's, so a tune still renders the same every time.
  if (!k.hq && !bank.buffers.has(key) && t < bank.nextRender) {
    const have = Array.from({ length: TAKES }, (_, n) => `${name}:${at}:${n}`).find(x => bank.buffers.has(x));
    if (have) key = have;
  }
  let buf = bank.buffers.get(key);
  if (!buf) {
    bank.nextRender = t + RENDER_GAP;
    const sr = k.ctx.sampleRate;
    const data = make(sr, at, pieceRandom(kit, key));
    buf = k.ctx.createBuffer(1, data.length, sr);
    buf.getChannelData(0).set(data);
    bank.buffers.set(key, buf);
  }
  return { buf, scale: strokeLevel(vel) };
}
/**
 * How loud a stroke is, by its velocity, whichever recording plays it (each is brought to
 * the same peak): in step with the velocity, a full stroke at 0.95 being 1, and below 0.4
 * falling away faster, as a drummer's ghost notes do (12 to 20 dB under an accent).
 */
export function strokeLevel(vel: number): number {
  return Math.min(1.25, vel >= 0.4 ? vel / 0.95 : (0.4 / 0.95) * (vel / 0.4) ** 2.5);
}
/** A cymbal's own partials, fixed for the kit, so every stroke is the same cymbal. */
function cymbalOf(kit: DrumKit, k: VoiceKit, name: string, spec: K.CymbalSpec): ReturnType<typeof K.cymbalBase> {
  const bank = bankOf(k.ctx, kit);
  let base = bank.cymbals.get(name);
  if (!base) { base = K.cymbalBase(spec, pieceRandom(kit, `${name}:base`)); bank.cymbals.set(name, base); }
  return base;
}
/**
 * The kit's channel strips: one panner per place across the speakers and per output, made
 * once and kept, the way a desk has a channel per drum. A hit is then a buffer and a gain:
 * a panner per hit made a busy hat part cost several times as much to render.
 */
const STRIPS = new WeakMap<AudioNode, Map<number, StereoPannerNode>>();
function stripOf(k: VoiceKit, out: AudioNode, pan: number): StereoPannerNode {
  let byPan = STRIPS.get(out);
  if (!byPan) { byPan = new Map(); STRIPS.set(out, byPan); }
  const key = Math.round(pan * 100);
  let strip = byPan.get(key);
  if (!strip) {
    strip = k.ctx.createStereoPanner();
    strip.pan.value = key / 100;
    strip.connect(out);
    byPan.set(key, strip);
  }
  return strip;
}
/** Play a piece: its buffer a hair off pitch each time, at `level`, through the strip at `pan`, as overhead mics hear a kit. */
function hit(k: VoiceKit, out: AudioNode, t: number, p: { buf: AudioBuffer; scale: number }, level: number, pan: number): GainNode {
  const src = k.ctx.createBufferSource();
  src.buffer = p.buf;
  src.playbackRate.value = 1 + (k.rng() - 0.5) * 0.012;
  const g = k.ctx.createGain();
  g.gain.value = level * p.scale * (0.94 + k.rng() * 0.12);
  src.connect(g).connect(stripOf(k, out, pan));
  src.start(t);
  return g;
}
/** Each piece's place across the speakers, from the drummer's side: hats left, ride right. */
const PAN = { hat: -0.32, ride: 0.36, crash: -0.22, snare: 0.04, kick: 0 } as const;
/**
 * Each piece's level, so the mix holds: first set against the synthesised voices each
 * replaced, and kept at that loudness (K-weighted, over as long as the piece sounds in a
 * groove: the hats 0.1 s, the snare 0.2 s, the ride 0.5 s, the crash 1 s) when the pieces
 * were remodelled on the recorded kit. The kick is held over its first 0.1 s, its punch:
 * the old kick's loudness was a boom ringing six times as long as a real kick's. The
 * cross-stick and the hat's foot are set against the synthesised ones they replace; the
 * ride's bell and the press roll play at the ride's and the snare's.
 */
const LEVEL = { hat: 0.109, open: 0.128, ride: 0.373, bell: 0.373, crash: 0.926, snare: 0.6, press: 0.6, rim: 0.319, pedal: 0.051, tom: 0.345, kick: 1.01 } as const;

/** The cymbal a crash note plays, by the kit, with its brightness and length. */
function crashSpec(kit: DrumKit): K.CymbalSpec {
  return kit.crash === 'splash' ? K.SPLASH : kit.crash === 'china' ? K.CHINA : K.CRASH;
}

/** A few per cent either way: no two strokes alike. */
const nudge = (k: VoiceKit, by: number): number => 1 + (k.rng() - 0.5) * 2 * by;

/** A sine whose level jumps in and falls away: one of a drum's modes. */
function mode(k: VoiceKit, out: AudioNode, t: number, f: number, level: number, decay: number, fallFrom = 1, fallTime = 0.03): void {
  const o = osc(k, 'sine', f * fallFrom, t, t + decay + 0.02);
  if (fallFrom !== 1) o.frequency.exponentialRampToValueAtTime(f, t + fallTime);
  const g = k.ctx.createGain();
  g.gain.setValueAtTime(EPS, t);
  g.gain.exponentialRampToValueAtTime(level, t + 0.0015);
  g.gain.exponentialRampToValueAtTime(EPS, t + decay);
  o.connect(g).connect(out);
}

/** Noise through a band, struck and gone in `len`: a beater's click, a stick, a slap. */
function tap(k: VoiceKit, out: AudioNode, t: number, hz: number, q: number, level: number, len: number): void {
  const bp = k.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = hz;
  bp.Q.value = q;
  const g = k.ctx.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(EPS, t + len);
  noiseAt(k, t, len).connect(bp).connect(g).connect(out);
}

/**
 * The kick, by the kit: `hz` is its pitch and `len` how long it booms (the tune's own).
 * - sub: the 808's long sine, swept down from almost three times its pitch.
 * - punch: a 909-style kick, a fast sweep from high with a sharp click and a shorter body.
 * - tight: short and clicky, for busy dance music.
 * - boom: a lofi kick, round and dusty, its click rolled off.
 * - house: lofi house's kick, the boom's round body pushed a little into a soft clip, as an
 *   old sampler's input warms it: soft, never punchy, with a little more for a small speaker.
 * - acoustic: a bass drum: its head's first two modes, a small fall in pitch with the
 *   strike, the beater's click and the shell's thump.
 * - feather: a jazz drummer's kick, felt more than heard: low, soft, no click.
 * - click: metal's kick, as its records have it: a short, tight body under a hard beater
 *   click high enough to cut through the guitars, every stroke alike, so a double kick
 *   reads as a run of distinct hits.
 * Every kind falls further and clicks louder the harder it is struck.
 */
export function kick(k: VoiceKit, out: AudioNode, t: number, vel: number, hz: number, len: number, kind: KickKind = 'sub', kit?: DrumKit): void {
  const { ctx } = k;
  const hard = vel * vel;
  if (kind === 'click') {
    mode(k, out, t, hz * 1.15, 0.7 * vel, 0.16, 3.5, 0.014);
    tap(k, out, t, 4200, 1.3, 0.34 * vel, 0.01);   // the beater, hard enough to cut through
    tap(k, out, t, 1800, 0.9, 0.12 * vel, 0.008);
    return;
  }
  if ((kind === 'acoustic' || kind === 'feather') && kit?.real) {
    const soft = kind === 'feather';
    const p = piece(k, kit, t, `kick:${Math.round(hz)}:${kind}`, vel, (sr, v, r) => K.kickStroke(sr, hz * (soft ? 0.92 : 1), v, soft ? 0.25 : 1, (soft ? 0.32 : 0.28) + len * 0.3, r));
    hit(k, out, t, p, LEVEL.kick * (soft ? 0.85 : 1), PAN.kick);
    return;
  }
  if (kind === 'acoustic' || kind === 'feather') {
    const soft = kind === 'feather';
    const f = hz * (soft ? 0.92 : 1);
    const ring = (soft ? 0.32 : 0.28) + len * 0.3;
    mode(k, out, t, f, (soft ? 0.62 : 0.72) * vel, ring, 1 + 0.35 * vel, 0.022);
    mode(k, out, t, f * 1.59, 0.16 * vel, ring * 0.3, 1 + 0.2 * vel, 0.02);
    tap(k, out, t, 280, 0.9, (soft ? 0.12 : 0.22) * vel, 0.035);   // the shell's thump
    if (!soft || vel > 0.6) tap(k, out, t, 2800, 1.2, (soft ? 0.05 : 0.2) * hard, 0.012);   // the beater
    return;
  }
  if (kind === 'boom' || kind === 'house') {
    const o = osc(k, 'sine', hz * 2, t, t + len + 0.05);
    o.frequency.exponentialRampToValueAtTime(hz, t + 0.05);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(EPS, t);
    amp.gain.exponentialRampToValueAtTime(0.78 * vel, t + 0.004);
    amp.gain.exponentialRampToValueAtTime(EPS, t + len);
    o.connect(lp).connect(amp);
    if (kind === 'house') {
      // Into the clip at about a third of full scale: the body's third harmonic about 26 dB down.
      const [push, ws] = drivenBy(ctx, HOUSE_KICK_PUSH);
      const back = ctx.createGain();
      back.gain.value = HOUSE_KICK_BACK;
      amp.connect(push);
      ws.connect(back).connect(out);
    } else amp.connect(out);
    tap(k, out, t, 700, 0.8, 0.14 * vel, 0.02);
    return;
  }
  const punch = kind === 'punch';
  const tight = kind === 'tight';
  const body = tight ? Math.min(len, 0.2) : punch ? len * 0.75 : len;
  const o = osc(k, 'sine', hz * (punch ? 4.5 : tight ? 3.4 : 2.9), t, t + body + 0.05);
  if (punch) o.frequency.exponentialRampToValueAtTime(hz * 1.6, t + 0.012);
  o.frequency.exponentialRampToValueAtTime(hz, t + (punch ? 0.06 : tight ? 0.035 : 0.07));
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.75 * vel, t + 0.003);
  amp.gain.exponentialRampToValueAtTime(EPS, t + body);
  o.connect(amp).connect(out);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = punch || tight ? 5000 : 1800;
  const cg = ctx.createGain();
  cg.gain.setValueAtTime((punch || tight ? 0.26 : 0.18) * (punch || tight ? hard : vel), t);
  cg.gain.exponentialRampToValueAtTime(EPS, t + (punch || tight ? 0.008 : 0.012));
  noiseAt(k, t, 0.015).connect(lp).connect(cg).connect(out);
}

/** How hard the house kick is pushed into the clip, and its level after it, so it plays about as loud as the boom. */
const HOUSE_KICK_PUSH = 0.45;
const HOUSE_KICK_BACK = 0.95;

/**
 * The backbeat, by the style's kit: a snare, a brush or a clap, around `tone` Hz, tuned by
 * the tune's kit. Each starts with a HIT: a few milliseconds of bright noise (the crack of
 * the stick, the slap of the hands, the brush landing) over its body, so it reads as sharp
 * and loud through the lofi muffle and gives a visualizer's mid and treble bands a clear
 * jump on every backbeat. Struck harder, it is brighter and its wires and stick louder
 * still; a ghost note is a soft, dark tap with hardly any wire.
 */
export function snare(style: LofiStyle['snare'], k: VoiceKit, out: AudioNode, t: number, vel: number, tone: number, kit: DrumKit = PLAIN_KIT): void {
  const { ctx } = k;
  if (style === 'stack') { stack(k, out, t, vel, tone, kit); return; }
  if (style === 'snap') { snap(k, out, t, vel, kit); return; }
  if (style === 'snare' && kit.real) {
    const p = piece(k, kit, t, `snare:${Math.round(tone / 50)}`, vel, (sr, v, r) => K.snareStroke(sr, kit.snareHead * (tone / 2000) ** 0.25, v, kit.wires, kit.ring, r));
    hit(k, out, t, p, LEVEL.snare, PAN.snare);
    return;
  }
  const brush = style === 'brush';
  const hard = vel * vel;
  const bright = kit.snareBright * (0.82 + 0.3 * vel) * nudge(k, 0.03);
  // The hit: bright noise, full level at once, gone in 20 to 30 ms.
  crack(k, out, t, (brush ? 0.32 * vel : style === 'clap' ? 0.5 * vel : 0.62 * (0.35 * vel + 0.65 * hard)), (brush ? 2600 : 3800) * bright, brush ? 0.02 : 0.03);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = (brush ? tone * 1.3 : style === 'clap' ? tone * 0.7 : tone) * bright;
  bp.Q.value = brush ? 0.6 : style === 'clap' ? 1.4 : 0.9;
  const g = ctx.createGain();
  if (style === 'clap') {
    // Three hands, a few milliseconds apart, then the room.
    g.gain.setValueAtTime(EPS, t);
    for (const [d, a] of [[0, 0.42], [0.011, 0.36], [0.023, 0.48]] as const) {
      g.gain.setValueAtTime(a * vel, t + d * nudge(k, 0.15));
      g.gain.exponentialRampToValueAtTime(0.04 * vel, t + d + 0.009);
    }
    g.gain.exponentialRampToValueAtTime(EPS, t + 0.2);
    noiseAt(k, t, 0.22).connect(bp).connect(g).connect(out);
    return;
  }
  // The snap (the wires): a band of noise around `tone`.
  const decay = (brush ? 0.26 : 0.18) * nudge(k, 0.08);
  g.gain.setValueAtTime(EPS, t);
  g.gain.exponentialRampToValueAtTime((brush ? 0.24 : 0.44) * vel, t + (brush ? 0.012 : 0.0015));
  g.gain.exponentialRampToValueAtTime(EPS, t + decay);
  noiseAt(k, t, decay).connect(bp).connect(g).connect(out);
  if (brush) return;
  // The wires' rattle: a wide band of noise that rings on a little after the hit, louder
  // the harder the stroke (a ghost note hardly sets them going).
  const wires = ctx.createBiquadFilter();
  wires.type = 'highpass';
  wires.frequency.value = 2200 * bright;
  const wg = ctx.createGain();
  wg.gain.setValueAtTime(EPS, t);
  wg.gain.exponentialRampToValueAtTime(Math.max(EPS * 2, 0.14 * kit.wires * vel ** 1.5), t + 0.004);
  wg.gain.exponentialRampToValueAtTime(EPS, t + 0.24 * (0.7 + 0.3 * kit.wires));
  noiseAt(k, t, 0.3).connect(wires).connect(wg).connect(out);
  // The body (the drum): a short tone that drops, and a ring at about 330 Hz, as long as
  // the kit's head rings.
  for (const [type, from, to, level, len] of [['triangle', 205, 165, 0.3, 0.1], ['sine', 330, 290, 0.1, 0.07]] as const) {
    const ring = len * kit.ring;
    const body = osc(k, type, from * (1 + 0.04 * vel), t, t + ring + 0.01);
    body.frequency.exponentialRampToValueAtTime(to, t + ring * 0.8);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(EPS, t);
    bg.gain.exponentialRampToValueAtTime(level * vel, t + 0.0015);
    bg.gain.exponentialRampToValueAtTime(EPS, t + ring);
    body.connect(bg).connect(out);
  }
}

/**
 * A press (buzz) roll on the snare: the stick pressed into the head bounces, each bounce
 * softer and sooner than the last (lib/lofi-kit.ts buzzStroke), a jazz drummer's roll into
 * the turn of a phrase. A kit without real shells plays it as a snare stroke.
 */
export function press(k: VoiceKit, out: AudioNode, t: number, vel: number, tone: number, kit: DrumKit = PLAIN_KIT): void {
  if (!kit.real) { snare('snare', k, out, t, vel, tone, kit); return; }
  const p = piece(k, kit, t, `press:${Math.round(tone / 50)}`, vel, (sr, v, r) => K.buzzStroke(sr, kit.snareHead * (tone / 2000) ** 0.25, v, kit.wires, kit.ring, r));
  hit(k, out, t, p, LEVEL.press, PAN.snare);
}

/**
 * A finger snap (R&B's backbeat): the finger slapping the palm, a sharp band of noise
 * high in the mids, the skin's short pop under it, and the flick of the nail on top.
 */
function snap(k: VoiceKit, out: AudioNode, t: number, vel: number, kit: DrumKit): void {
  const bright = kit.snareBright * nudge(k, 0.04);
  tap(k, out, t, 2500 * bright, 1.6, 0.55 * vel, 0.05);
  tap(k, out, t, 1250 * bright, 2.6, 0.28 * vel, 0.025);
  crack(k, out, t, 0.22 * vel * vel, 5200, 0.01);
}

/**
 * The stacked snare (Sherbert): a clap and a snare struck together, the console's noise
 * channel buzzing under them, and a long, bright tail, the big room a future-bass snare
 * sits in.
 */
function stack(k: VoiceKit, out: AudioNode, t: number, vel: number, tone: number, kit: DrumKit): void {
  const { ctx } = k;
  snare('clap', k, out, t, vel * 0.75, tone, kit);
  // A quiet hit (a roll's, a ghost's) is the clap and the console's buzz alone: a roll is
  // many hits, and the snare and the tail under each would cost more than they are heard.
  const full = vel > 0.6;
  if (full) snare('snare', k, out, t, vel * 0.6, tone, kit);
  const buzz = ctx.createBufferSource();
  buzz.buffer = chipNoise(ctx);
  buzz.loop = true;
  buzz.playbackRate.value = tone / 2000;
  buzz.start(t);
  buzz.stop(t + 0.12);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 900;
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.11 * vel, t);
  bg.gain.exponentialRampToValueAtTime(EPS, t + 0.1);
  buzz.connect(hp).connect(bg).connect(out);
  if (!full) return;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = tone * 1.6;
  bp.Q.value = 0.6;
  const tail = ctx.createGain();
  tail.gain.setValueAtTime(EPS, t);
  tail.gain.exponentialRampToValueAtTime(0.07 * vel, t + 0.02);
  tail.gain.exponentialRampToValueAtTime(EPS, t + 0.5);
  noiseAt(k, t, 0.52).connect(bp).connect(tail).connect(out);
}

/**
 * An old console's noise channel in its short mode: a 15-bit shift register fed back from
 * its sixth bit, which repeats after a few dozen steps, so it buzzes at a pitch rather
 * than hissing. One buffer per context, looped.
 */
const CHIP_NOISES = new WeakMap<BaseAudioContext, AudioBuffer>();
function chipNoise(ctx: BaseAudioContext): AudioBuffer {
  let b = CHIP_NOISES.get(ctx);
  if (b) return b;
  const hold = Math.max(1, Math.round(ctx.sampleRate / 22000));
  let reg = 1;
  const bits: number[] = [];
  for (let n = 0; n < 93; n++) {
    const fb = (reg ^ (reg >> 6)) & 1;
    reg = (reg >> 1) | (fb << 14);
    bits.push(reg & 1 ? 0.8 : -0.8);
  }
  b = ctx.createBuffer(1, bits.length * hold, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = bits[Math.floor(i / hold)]!;
  CHIP_NOISES.set(ctx, b);
  return b;
}

/**
 * The cross-stick: the stick laid across the head, its shaft clicking on the rim. A real kit
 * plays the recorded kit's (lib/lofi-kit.ts crossStick: the wood and the rim's knock at
 * 300 Hz to 1.2 kHz); an electronic kit keeps a drum machine's.
 */
export function rim(k: VoiceKit, out: AudioNode, t: number, vel: number, kit: DrumKit = PLAIN_KIT): void {
  if (kit.real) {
    hit(k, out, t, piece(k, kit, t, 'cross-stick', vel, (sr, v, r) => K.crossStick(sr, kit.snareHead, v, kit.wires, r)), LEVEL.rim, PAN.snare);
    return;
  }
  const { ctx } = k;
  crack(k, out, t, vel * 0.3, 4500, 0.012);
  const o = osc(k, 'sine', 1150 * nudge(k, 0.02), t, t + 0.04);
  const g = ctx.createGain();
  g.gain.setValueAtTime(EPS, t);
  g.gain.exponentialRampToValueAtTime(0.14 * vel, t + 0.001);
  g.gain.exponentialRampToValueAtTime(EPS, t + 0.035);
  o.connect(g).connect(out);
  tap(k, out, t, 3200, 3, 0.3 * vel, 0.03);
}

/**
 * Hats by the style's kit: a closed or open hat around `tone` Hz, or a shaker, as long and
 * as bright as the tune's kit, a little brighter struck harder and never twice the same.
 * A `light` hat (Sherbert's sixteenth ghosts and rolls) is the hiss alone, a third of the
 * cost. With hats on the ride, the hat notes play the ride.
 */
export function hat(style: LofiStyle['hats'], k: VoiceKit, out: AudioNode, t: number, vel: number, tone: number, open = false, light = false, kit: DrumKit = PLAIN_KIT): void {
  if (style === 'ride') { ride(k, out, t, vel, tone, kit); return; }
  if (style === 'hat' && kit.realCymbals && !light) {
    const bank = bankOf(k.ctx, kit);
    // A closed hat closes the plates on an open one still ringing.
    if (bank.open) { bank.open.gain.setTargetAtTime(0, t, 0.008); bank.open = null; }
    const spec = hatSpec(kit, open);
    const name = open ? 'hat-open' : 'hat';
    const base = cymbalOf(kit, k, name, spec);
    const g = hit(k, out, t, piece(k, kit, t, name, vel, (sr, v, r) => K.cymbal(sr, spec, base, v, r, k.hq)), open ? LEVEL.open : LEVEL.hat, PAN.hat);
    if (open) bank.open = g;
    return;
  }
  const { ctx } = k;
  const f = tone * kit.hatBright * (0.9 + 0.15 * vel) * nudge(k, 0.03);
  if (light && style === 'hat' && !open) {
    tap(k, out, t, f * 1.15, 0.8, 0.2 * vel, 0.03);
    return;
  }
  const shaker = style === 'shaker';
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = shaker ? 3500 : f * 0.75;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = shaker ? 5200 : f * 1.2;
  bp.Q.value = shaker ? 1.1 : 0.7;
  const g = ctx.createGain();
  const decay = (open ? 0.24 : shaker ? 0.07 : 0.035) * kit.hatDecay * nudge(k, 0.1);
  if (shaker) {   // a shaker swishes in rather than striking
    g.gain.setValueAtTime(EPS, t);
    g.gain.exponentialRampToValueAtTime(0.13 * vel, t + 0.018);
  } else {
    g.gain.setValueAtTime(0.16 * vel, t);
  }
  g.gain.exponentialRampToValueAtTime(EPS, t + decay);
  noiseAt(k, t, decay).connect(hp).connect(bp).connect(g).connect(out);
  if (shaker) return;
  // The metal under the hiss: what makes a hat sound like a cymbal and not a burst of static.
  const mhp = ctx.createBiquadFilter();
  mhp.type = 'highpass';
  mhp.frequency.value = f * 0.7;
  const mg = ctx.createGain();
  mg.gain.setValueAtTime(0.2 * vel, t);
  mg.gain.exponentialRampToValueAtTime(EPS, t + decay * (open ? 1.3 : 1.1));
  metalAt(k, t, decay * 1.3, f / 9000).connect(mhp).connect(mg).connect(out);
}

/** The kit's hats, closed or open: their brightness and length by the kit's leans. */
function hatSpec(kit: DrumKit, open: boolean): K.CymbalSpec {
  const spec = open ? K.HAT_OPEN : K.HAT_CLOSED;
  return { ...spec, scale: kit.hatBright, choke: (spec.choke ?? 0.05) * kit.hatDecay };
}

/**
 * The hi-hat's foot: the two cymbals pressed together by the pedal, a short "chick" with
 * no stick, the jazz drummer's two and four under the ride. A kit with real cymbals plays
 * the recorded kit's chick (lib/lofi-kit.ts pedalChick), which closes an open hat too.
 */
export function pedal(k: VoiceKit, out: AudioNode, t: number, vel: number, tone: number, kit: DrumKit = PLAIN_KIT): void {
  if (kit.realCymbals) {
    const bank = bankOf(k.ctx, kit);
    if (bank.open) { bank.open.gain.setTargetAtTime(0, t, 0.008); bank.open = null; }
    const spec = hatSpec(kit, false);
    const base = cymbalOf(kit, k, 'hat', spec);
    hit(k, out, t, piece(k, kit, t, 'hat-pedal', vel, (sr, v, r) => K.pedalChick(sr, spec, base, v, r, k.hq)), LEVEL.pedal, PAN.hat);
    return;
  }
  const { ctx } = k;
  const f = tone * kit.hatBright * nudge(k, 0.03);
  const g = ctx.createGain();
  g.gain.setValueAtTime(EPS, t);
  g.gain.exponentialRampToValueAtTime(0.16 * vel, t + 0.003);
  g.gain.exponentialRampToValueAtTime(EPS, t + 0.045);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = f * 0.55;
  metalAt(k, t, 0.06, f / 10000).connect(hp).connect(g).connect(out);
  tap(k, out, t, 1300, 1.4, 0.06 * vel, 0.02);   // the cymbals closing: a low, short chick
}

/**
 * The ride, by the kit: the stick's ping (the bell's partials, as loud as the kit's bell),
 * the wash that builds after the ping (as long as the kit's), and the stick's tick. Each
 * stroke differs a little, in pitch and in length; a stroke leaned on is brighter and
 * rings longer.
 */
export function ride(k: VoiceKit, out: AudioNode, t: number, vel: number, tone: number, kit: DrumKit = PLAIN_KIT, bell = false): void {
  if (kit.realCymbals) {
    // The kit's ride: its pitch (the metal's rate), how long it washes, how much a stroke on the bow sets its bell going.
    const spec: K.CymbalSpec = { ...K.RIDE, scale: kit.rideRate / 0.9, lives: kit.wash, bellLevel: (K.RIDE.bellLevel ?? 0) * kit.bell };
    const base = cymbalOf(kit, k, 'ride', spec);
    const p = bell
      ? piece(k, kit, t, 'ride-bell', vel, (sr, v, r) => K.rideBell(sr, spec, base, v, r, k.hq))
      : piece(k, kit, t, 'ride', vel, (sr, v, r) => K.cymbal(sr, spec, base, v, r, k.hq));
    hit(k, out, t, p, bell ? LEVEL.bell : LEVEL.ride, PAN.ride);
    return;
  }
  const { ctx } = k;
  const rate = kit.rideRate * nudge(k, 0.02);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 3200 * rate / 0.9;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = tone * 0.75 * (0.92 + 0.15 * vel);
  bp.Q.value = 0.6;
  const wash = 1.3 * kit.wash * (0.85 + 0.3 * vel) * nudge(k, 0.08);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.16 * vel, t);
  g.gain.exponentialRampToValueAtTime(0.05 * vel, t + 0.12);
  g.gain.exponentialRampToValueAtTime(EPS, t + wash);
  metalAt(k, t, wash, rate).connect(hp).connect(bp).connect(g).connect(out);
  for (const [hz, level] of [[3150, 0.03], [4470, 0.02], [920, 0.012]] as const) {
    const o = osc(k, 'sine', hz * rate / 0.9 * nudge(k, 0.012), t, t + 0.6);
    const pg = ctx.createGain();
    pg.gain.setValueAtTime(EPS, t);
    pg.gain.exponentialRampToValueAtTime(level * vel * kit.bell, t + 0.002);
    pg.gain.exponentialRampToValueAtTime(EPS, t + (hz < 1000 ? 0.55 : 0.3) * (0.8 + 0.4 * vel));
    o.connect(pg).connect(out);
  }
  crack(k, out, t, vel * 0.12, 5000, 0.01);   // the stick
}

/**
 * A tom, pitched by `midi`. A band's tom (the kit's acoustic toms) is its head's first three
 * modes (the membrane's ratios, 1 : 1.59 : 2.14, the higher ones dying first), its pitch a
 * little sharp at the strike and settling as the head relaxes, more so struck harder, with
 * the stick on top. An electronic tom sweeps down from well above its pitch.
 */
export function tom(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, kit: DrumKit = PLAIN_KIT): void {
  const { ctx } = k;
  if (kit.real && kit.acousticToms) {
    // Toms spread from the high tom on the left to the floor tom on the right.
    const p = piece(k, kit, t, `tom:${midi}`, vel, (sr, v, r) => K.tomStroke(sr, mtof(midi + kit.tomTune), v, r));
    hit(k, out, t, p, LEVEL.tom, Math.round(Math.max(-0.35, Math.min(0.35, (52 - midi) * 0.04)) * 10) / 10);
    return;
  }
  const f = mtof(midi) * nudge(k, 0.01);
  const ring = 0.28 + Math.max(0, 52 - midi) * 0.025;
  if (kit.acousticToms) {
    const fall = 1 + 0.07 * vel * vel;
    for (const [ratio, level, life] of [[1, 0.34, 1], [1.59, 0.12, 0.45], [2.14, 0.06, 0.3]] as const) mode(k, out, t, f * ratio, level * vel, ring * 1.25 * life, fall, ring * 0.35);
    tap(k, out, t, 2400, 0.8, 0.12 * vel, 0.04);
    crack(k, out, t, vel * vel * 0.2, 2800, 0.02);
    return;
  }
  const head = osc(k, 'sine', f * 1.6, t, t + ring + 0.05);
  head.frequency.exponentialRampToValueAtTime(f, t + 0.06);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.34 * vel, t + 0.002);
  amp.gain.exponentialRampToValueAtTime(EPS, t + ring);
  head.connect(amp).connect(out);
  const over = osc(k, 'triangle', f * 1.5, t, t + 0.16);
  over.frequency.exponentialRampToValueAtTime(f * 1.42, t + 0.12);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.1 * vel, t);
  og.gain.exponentialRampToValueAtTime(EPS, t + 0.14);
  over.connect(og).connect(out);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2400;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.12 * vel, t);
  ng.gain.exponentialRampToValueAtTime(EPS, t + 0.05);
  noiseAt(k, t, 0.06).connect(lp).connect(ng).connect(out);
  crack(k, out, t, vel * 0.18, 2800, 0.02);
}

/**
 * A cymbal crash, by the kit: a crash (a burst of noise and the cymbal's own metal swelling
 * a moment after the hit), a splash (smaller, brighter, gone in under a second) or a china
 * (trashy and lower, its metal at a slower rate). A dance kit puts a sub boom under a
 * full-strength crash, the drop's; a band's kit never does.
 */
export function crash(k: VoiceKit, out: AudioNode, t: number, vel: number, kit: DrumKit = PLAIN_KIT): void {
  if (kit.realCymbals) {
    const spec = crashSpec(kit);
    const base = cymbalOf(kit, k, kit.crash, spec);
    hit(k, out, t, piece(k, kit, t, kit.crash, vel, (sr, v, r) => K.cymbal(sr, spec, base, v, r, k.hq)), LEVEL.crash, PAN.crash);
    if (kit.boom && vel >= 0.8) boomUnder(k, out, t, vel);
    return;
  }
  const { ctx } = k;
  const splash = kit.crash === 'splash';
  const china = kit.crash === 'china';
  const life = (splash ? 0.95 : china ? 1.6 : 2) * nudge(k, 0.06);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = splash ? 5200 : china ? 2600 : 3800;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = splash ? 9500 : china ? 4800 : 7600;
  bp.Q.value = china ? 1.1 : 0.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.12 * vel, t);
  g.gain.exponentialRampToValueAtTime(0.03 * vel, t + 0.25 * life / 2);
  g.gain.exponentialRampToValueAtTime(EPS, t + life);
  noiseAt(k, t, life).connect(hp).connect(bp).connect(g).connect(out);
  // The metal: the cymbal's own ring, a little darker, swelling a moment after the hit.
  const mhp = ctx.createBiquadFilter();
  mhp.type = 'highpass';
  mhp.frequency.value = splash ? 4000 : china ? 1900 : 2800;
  const mg = ctx.createGain();
  mg.gain.setValueAtTime(EPS, t);
  mg.gain.exponentialRampToValueAtTime((china ? 0.26 : 0.22) * vel, t + 0.012);
  mg.gain.exponentialRampToValueAtTime(0.07 * vel, t + 0.4 * life / 2.4);
  mg.gain.exponentialRampToValueAtTime(EPS, t + life * 1.2);
  metalAt(k, t, life * 1.2, (splash ? 1.05 : china ? 0.62 : 0.82) * nudge(k, 0.02)).connect(mhp).connect(mg).connect(out);
  if (kit.boom && vel >= 0.8) boomUnder(k, out, t, vel);
}

/** The sub boom a dance drop puts under its crash. */
function boomUnder(k: VoiceKit, out: AudioNode, t: number, vel: number): void {
  const boom = osc(k, 'sine', 62, t, t + 1.1);
  boom.frequency.exponentialRampToValueAtTime(34, t + 0.9);
  const bg = k.ctx.createGain();
  bg.gain.setValueAtTime(0.5 * vel, t);
  bg.gain.exponentialRampToValueAtTime(EPS, t + 1);
  boom.connect(bg).connect(out);
}
