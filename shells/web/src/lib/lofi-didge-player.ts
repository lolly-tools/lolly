// SPDX-License-Identifier: MPL-2.0
/**
 * The station's didgeridoo player: the notes of a Straya tune's didgeridoo (its drone as the
 * bass, its rhythm and its solo as `didge` notes, engine/src/lofi-straya.ts) played on one
 * modelled instrument (lib/lofi-didgeridoo.ts) that is never restarted while the notes join
 * up. Each note is worked out from where the last one left the player, so a drone held across
 * a verse is one unbroken sound, and a role's change (the drone becoming the rhythm, the
 * rhythm the solo) is the same player changing what it does.
 *
 * A note's sound is rendered with a short tail, the breath stopping, in case nothing follows
 * the note. When the next note does follow, the tail is faded out over a few milliseconds as the
 * next note's sound (which carries on from the same moment of the same simulation) fades in,
 * so the join cannot be heard. A gap, a new tune or a new key starts the player afresh.
 */
import { DIDGE_ART, DIDGE_ROLE } from '../../../../engine/src/lofi-straya.ts';
import { Didgeridoo, type DidgeEvent } from './lofi-didgeridoo.ts';
import type { VoiceKit } from './lofi-voices.ts';

const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);

/** How long a gap between notes still counts as the drone carrying on (s). */
const JOIN = 0.08;
/** The tail rendered after each note in case the breath stops there (s), and the crossfade into the next note (s). */
const TAIL = 0.22;
const FADE = 0.004;
/** How long a note's articulation still shapes the sound after it ends (s): a push's decay, a breath's push back. */
const CARRY = 0.45;
/** Each role's level against the drone's: the rhythm sits in the middle of the band, the solo in front. */
export const DIDGE_LEVELS = [1, 0.85, 1.15] as const;
/** The player's output level, into the bass lane (the drone and the rhythm) or the lead's seat (the solo). */
const LEVEL = 0.5;

/** One station's didgeridoo player. */
export class DidgePlayer {
  private player: Didgeridoo | null = null;
  private key = '';
  /** The audio time the simulation has reached. */
  private end = -1;
  /** The last note's tail, to fade out when the drone carries on. */
  private tail: { g: GainNode; level: number } | null = null;
  /** Recent notes, in audio time, whose shaping may reach into the next note. */
  private recent: Array<DidgeEvent & { t: number }> = [];

  /**
   * Play a note: `mod` its articulation plus its role times DIDGE_ROLE, `out` the lane its role
   * goes to (the bass lane for the drone and the rhythm, the lead's seat for the solo), `seed`
   * the tune's, so the same tune is blown the same way each time.
   */
  play(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, mod: number, seed: number, level = 1): void {
    const { ctx } = k;
    const sr = ctx.sampleRate;
    const role = Math.min(2, Math.floor(mod / DIDGE_ROLE));
    const art = mod & DIDGE_ART;
    const key = `${seed}:${midi}`;
    const fresh = !this.player || this.key !== key || t > this.end + JOIN || t < this.end - 0.3;
    if (fresh) {
      this.player = new Didgeridoo({ sr, f: mtof(midi), seed: (seed ^ Math.imul(midi + 1, 0x85ebca6b)) >>> 0 });
      this.key = key;
      this.end = t;
      this.recent = [];
      this.tail = null;
    }
    const player = this.player!;
    const start = this.end;
    const stop = Math.max(start + 0.02, t + dur);
    this.recent = this.recent.filter(n => n.t + n.dur + CARRY > start);
    this.recent.push({ t, at: 0, dur, art, vel: Math.min(1, Math.max(0.05, vel)), role });
    const notes = this.recent.map(n => ({ ...n, at: n.t - start }));
    const body = player.render(notes, stop - start);
    // The tail: the breath stopping after this note, on a copy, so the player itself stays where the note ends.
    const tail = player.clone().render(notes.map(n => ({ ...n, at: n.at - (stop - start) })), TAIL, undefined, 0.012);
    this.end = stop;
    const data = new Float32Array(body.length + tail.length);
    data.set(body);
    data.set(tail, body.length);
    const buf = ctx.createBuffer(1, data.length, sr);
    buf.getChannelData(0).set(data);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    const gain = LEVEL * (DIDGE_LEVELS[role] ?? 1) * level;
    if (this.tail && !fresh) {
      // Carry on: the last note's tail gives way as this note (the same breath, the same moment) comes in.
      this.tail.g.gain.setValueAtTime(this.tail.level, start);
      this.tail.g.gain.linearRampToValueAtTime(0, start + FADE);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(gain, start + FADE);
    } else g.gain.value = gain;
    src.connect(g).connect(out);
    src.start(Math.max(start, ctx.currentTime));
    this.tail = { g, level: gain };
  }
}
