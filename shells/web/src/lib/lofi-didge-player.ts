// SPDX-License-Identifier: MPL-2.0
/**
 * The station's didgeridoo players: the notes of a Straya tune's Didgeridoo and Yidaki (the
 * Didgeridoo's drone as the bass, the rhythm and the solo as `didge` notes,
 * engine/src/lofi-straya.ts) played on modelled instruments (lib/lofi-didgeridoo.ts), each
 * never restarted while its notes join up. Each note is worked out from where the last one
 * left its player, so a drone held across a verse is one unbroken sound, and the Didgeridoo
 * turning its drone into the rhythm is the same player changing what it does.
 *
 * A note's sound is rendered with a short tail, the breath stopping, in case nothing follows
 * the note. When the next note does follow, the tail is faded out over a few milliseconds as the
 * next note's sound (which carries on from the same moment of the same simulation) fades in,
 * so the join cannot be heard. A gap, a new tune or a new key starts the player afresh.
 */
import { DIDGE_TONGUE, readDidge } from '../../../../engine/src/lofi-straya.ts';
import { Didgeridoo, YIDAKI, type DidgeEvent } from './lofi-didgeridoo.ts';
import type { VoiceKit } from './lofi-voices.ts';

const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);

/** How long a gap between notes still counts as the drone carrying on (s). */
const JOIN = 0.08;
/** The tail rendered after each note in case the breath stops there (s), and the crossfade into the next note (s). */
const TAIL = 0.22;
const FADE = 0.004;
/** How long a note's articulation still shapes the sound after it ends (s): a push's decay, a breath's push back. */
const CARRY = 0.45;
/**
 * Each role's level against the drone's, set K-weighted against the rest of the band: the drone
 * about 2 to 3 dB under the band through a verse, the rhythm about 3 dB under it through a
 * chorus, and the solo about 4 dB under it, a little more forward than Straya's usual lead. The
 * solo goes through the lead's bus, which runs far hotter than the bass's, so its number is lower.
 */
export const DIDGE_LEVELS = [1, 0.63, 0.085] as const;
/** The player's output level, into the bass lane (the drone), the chords' (the rhythm) or the lead's seat (the solo). */
const LEVEL = 0.17;
/** The Yidaki against the Didgeridoo in each role: brighter, it measures louder at the same breath. */
const YIDAKI_LEVELS = [1, 0.4, 0.8] as const;

/** One instrument being played: its simulation and where it has got to. */
interface Slot {
  player: Didgeridoo | null;
  key: string;
  /** The audio time the simulation has reached. */
  end: number;
  /** The last note's tail, to fade out when the drone carries on. */
  tail: { g: GainNode; level: number } | null;
  /** Recent notes, in audio time, whose shaping may reach into the next note. */
  recent: Array<DidgeEvent & { t: number }>;
}

/**
 * One station's didgeridoo players: the Didgeridoo and the Yidaki each their own, so the
 * Didgeridoo's drone carries on unbroken under the Yidaki's rhythm or solo (and a track a
 * person gave to one of them plays on a player of its own).
 */
export class DidgePlayer {
  private readonly slots = new Map<string, Slot>();

  /**
   * Play a note: `mod` its articulation plus its role times DIDGE_ROLE and its kind times
   * DIDGE_KIND, `out` the lane its role goes to (the bass lane for the drone, the chords' for
   * the rhythm, the lead's seat for the solo), `seed` the tune's, so the same tune is blown the
   * same way each time. `lane` keeps a track's player apart from the tune's own.
   */
  play(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, mod: number, seed: number, level = 1, lane = ''): void {
    const { ctx } = k;
    const sr = ctx.sampleRate;
    const { art, role, kind } = readDidge(mod);
    const variant = kind % YIDAKI.length;
    const family = YIDAKI[variant]!.family;
    const name = `${family}:${lane}`;
    const slot: Slot = this.slots.get(name) ?? { player: null, key: '', end: -1, tail: null, recent: [] };
    this.slots.set(name, slot);
    // Another kind, or another pitch, is another instrument: it starts afresh.
    const key = `${seed}:${midi}:${variant}`;
    const fresh = !slot.player || slot.key !== key || t > slot.end + JOIN || t < slot.end - 0.3;
    if (fresh) {
      slot.player = new Didgeridoo({ sr, f: mtof(midi), seed: (seed ^ Math.imul(midi + 1, 0x85ebca6b) ^ Math.imul(variant + 1, 0x27d4eb2f)) >>> 0, variant });
      slot.key = key;
      slot.end = t;
      slot.recent = [];
      slot.tail = null;
    }
    const player = slot.player!;
    const start = slot.end;
    const stop = Math.max(start + 0.02, t + dur);
    slot.recent = slot.recent.filter(n => n.t + n.dur + CARRY > start);
    const strength = Math.min(1, Math.max(0.05, vel));
    // A drone started afresh is tongued in: the lips set, then the air let go with a kick.
    if (fresh && art !== DIDGE_TONGUE) slot.recent.push({ t, at: 0, dur: 0.05, art: DIDGE_TONGUE, vel: strength, role });
    slot.recent.push({ t, at: 0, dur, art, vel: strength, role });
    const notes = slot.recent.map(n => ({ ...n, at: n.t - start }));
    const body = player.render(notes, stop - start);
    // The tail: the breath stopping after this note, on a copy, so the player itself stays where the note ends.
    const tail = player.clone().render(notes.map(n => ({ ...n, at: n.at - (stop - start) })), TAIL, undefined, 0.012);
    slot.end = stop;
    const data = new Float32Array(body.length + tail.length);
    data.set(body);
    data.set(tail, body.length);
    const buf = ctx.createBuffer(1, data.length, sr);
    buf.getChannelData(0).set(data);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    const gain = LEVEL * (DIDGE_LEVELS[Math.min(2, role)] ?? 1) * (family === 'yidaki' ? YIDAKI_LEVELS[Math.min(2, role)] ?? 1 : 1) * level;
    if (slot.tail && !fresh) {
      // Carry on: the last note's tail gives way as this note (the same breath, the same moment) comes in.
      slot.tail.g.gain.setValueAtTime(slot.tail.level, start);
      slot.tail.g.gain.linearRampToValueAtTime(0, start + FADE);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(gain, start + FADE);
    } else g.gain.value = gain;
    src.connect(g).connect(out);
    src.start(Math.max(start, ctx.currentTime));
    slot.tail = { g, level: gain };
  }
}
