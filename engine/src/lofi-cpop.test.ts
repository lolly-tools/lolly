// SPDX-License-Identifier: MPL-2.0
/**
 * Mandopop and C-Pop (lofi-cpop.ts): a pop song's form, the hook on a traditional
 * instrument, the strings or the pad under the chorus, the last chorus lifted, and each
 * kind of tune's own beat.
 *
 * Run directly: node --test engine/src/lofi-cpop.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeLofiTune, lofiSectionName, type LofiBar } from './lofi-compose.ts';

const SEEDS = Array.from({ length: 24 }, (_, i) => (i * 2654435761 + 5) >>> 0);
const TRADITIONAL = new Set(['erhu', 'dizi', 'pipa', 'zheng']);
const names = (bars: readonly LofiBar[], mood: 'mandopop' | 'cpop'): string[] => {
  const out: string[] = [];
  for (const b of bars) { const n = lofiSectionName(mood, b.section); if (out[out.length - 1] !== n) out.push(n); }
  return out;
};
const leadOf = (b: LofiBar): string => b.voices?.lead ?? b.tune.style.lead;
const NOTE = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
/** A tune's major key (the relative major of a minor one), as a pitch class. */
const keyOf = (b: LofiBar): number => { const [n, q] = b.tune.key.split(' '); return (NOTE.indexOf(n!) + (q === 'minor' ? 3 : 0)) % 12; };

test('Mandopop is a song: intro, verse, pre-chorus, chorus, interlude, again, a bridge, a last chorus and an outro', () => {
  for (const seed of SEEDS.slice(0, 8)) {
    const bars = composeLofiTune(seed, 'mandopop');
    assert.deepEqual(names(bars, 'mandopop'), ['intro', 'verse', 'pre-chorus', 'chorus', 'interlude', 'verse', 'pre-chorus', 'chorus', 'bridge', 'pre-chorus', 'chorus', 'outro', 'rest']);
    const { bpm } = bars[0]!.tune;
    assert.ok(bpm >= 66 && bpm <= 100, `seed ${seed}: ${bpm} bpm`);
  }
});

test('C-Pop is brighter and faster: a dance break after each chorus, a breakdown, and the beat at 94 to 128', () => {
  let mandopop = 0, cpop = 0;
  for (const seed of SEEDS.slice(0, 8)) {
    const bars = composeLofiTune(seed, 'cpop');
    assert.deepEqual(names(bars, 'cpop'), ['intro', 'verse', 'pre-chorus', 'chorus', 'dance break', 'verse', 'pre-chorus', 'chorus', 'dance break', 'breakdown', 'pre-chorus', 'chorus', 'dance break', 'outro', 'rest']);
    const { bpm } = bars[0]!.tune;
    assert.ok(bpm >= 94 && bpm <= 128, `seed ${seed}: ${bpm} bpm`);
    cpop += bpm;
    mandopop += composeLofiTune(seed, 'mandopop')[0]!.tune.bpm;
  }
  assert.ok(cpop > mandopop + 8 * 15, `C-Pop's tempos (${cpop / 8}) well over Mandopop's (${mandopop / 8})`);
});

test('the hook is on a traditional instrument: most Mandopop tunes, every C-Pop dance break', () => {
  let wind = 0;
  for (const seed of SEEDS) {
    const m = composeLofiTune(seed, 'mandopop');
    if (m.filter(b => b.section === 'feature' || b.section === 'bridge').every(b => TRADITIONAL.has(leadOf(b)))) wind++;
    const c = composeLofiTune(seed, 'cpop');
    for (const b of c.filter(x => x.section === 'feature')) assert.ok(TRADITIONAL.has(leadOf(b)), `cpop ${seed} bar ${b.index}: the dance break's hook on ${leadOf(b)}`);
  }
  assert.ok(wind >= 12 && wind < 24, `China wind in most Mandopop tunes, not every one (${wind} of 24)`);
});

test('a guzheng runs up into some choruses, quick and up its pentatonic', () => {
  let runs = 0;
  for (const seed of SEEDS) for (const mood of ['mandopop', 'cpop'] as const) {
    for (const b of composeLofiTune(seed, mood).filter(x => x.voices?.lead === 'zheng' && x.section === 'build')) {
      const run = b.notes.filter(n => n.voice === 'lead' && n.beat >= 2.2).map(n => n.midi);
      assert.ok(run.length >= 7, `${mood} ${seed} bar ${b.index}: a run (${run.length} notes)`);
      assert.deepEqual(run, [...run].sort((x, y) => x - y), `${mood} ${seed} bar ${b.index}: up`);
      assert.ok(new Set(run.map(p => p % 12)).size <= 5, `${mood} ${seed} bar ${b.index}: five notes to the octave`);
      runs++;
    }
  }
  assert.ok(runs >= 12, `runs into choruses (${runs})`);
});

test('the strings come in through a Mandopop pre-chorus and hold under its chorus; C-Pop has its pad under the chorus', () => {
  for (const seed of SEEDS.slice(0, 8)) {
    const m = composeLofiTune(seed, 'mandopop');
    for (const b of m.filter(x => x.section === 'drop')) {
      assert.equal(b.voices?.pad, 'strings', `mandopop ${seed} bar ${b.index}`);
      assert.ok(b.notes.some(n => n.voice === 'pad'), `mandopop ${seed} bar ${b.index}: the strings play`);
    }
    assert.ok(m.filter(b => b.section === 'verse' && b.index < 12).every(b => !b.notes.some(n => n.voice === 'pad')), `mandopop ${seed}: the first verse is the piano's`);
    const c = composeLofiTune(seed, 'cpop');
    assert.ok(c.filter(b => b.section === 'drop').every(b => b.notes.some(n => n.voice === 'pad')), `cpop ${seed}: a pad under every chorus`);
  }
});

test('the last chorus is lifted a semitone or a tone in most Mandopop tunes, after a held dominant', () => {
  let lifted = 0;
  for (const seed of SEEDS) {
    const bars = composeLofiTune(seed, 'mandopop');
    const choruses = bars.filter(b => b.section === 'drop');
    const first = choruses[0]!, last = choruses[16]!;
    const by = (last.tones[0]! - first.tones[0]! + 12) % 12;
    assert.ok(by === 0 || by === 1 || by === 2, `seed ${seed}: the last chorus moves by ${by}`);
    if (by) {
      lifted++;
      const lift = bars[last.index - 1]!;
      assert.equal(lift.section, 'build', `seed ${seed}: a pre-chorus's dominant before the lift`);
      assert.equal(lift.tones[0], (keyOf(lift) + by + 7) % 12, `seed ${seed}: the new key's dominant (${lift.chord} into ${last.chord})`);
    }
  }
  assert.ok(lifted >= 12, `most tunes lift (${lifted} of 24)`);
});

test('each kind keeps its beat: four on the floor, a half-time clap with rolling hats, a ballad\'s verse opening bare and then on the cross-stick', () => {
  let floors = 0, halfTime = 0, rolls = 0, crossStick = 0;
  for (const seed of SEEDS) {
    const c = composeLofiTune(seed, 'cpop');
    const chorus = c.find(b => b.section === 'drop' && b.notes.some(n => n.voice === 'kick'))!;
    const kicks = chorus.notes.filter(n => n.voice === 'kick').map(n => n.beat);
    const snares = chorus.notes.filter(n => n.voice === 'snare').map(n => n.beat);
    if ([0, 1, 2, 3].every(bt => kicks.some(k => Math.abs(k - bt) < 0.02))) floors++;
    else if (snares.some(s => Math.abs(s - 2) < 0.02) && !snares.some(s => Math.abs(s - 1) < 0.02)) halfTime++;
    for (const b of c) {
      const hats = b.notes.filter(n => n.voice === 'hat').map(n => n.beat).sort((x, y) => x - y);
      if (hats.some((h, i) => i > 0 && h - hats[i - 1]! < 0.17)) { rolls++; break; }
    }
    const m = composeLofiTune(seed, 'mandopop');
    const firstVerse = m.filter(b => b.section === 'verse').slice(0, 8);
    if (firstVerse.some(b => b.notes.some(n => n.voice === 'rim'))) {
      crossStick++;
      assert.ok(!firstVerse.slice(0, 4).some(b => b.notes.some(n => n.voice === 'kick' || n.voice === 'snare' || n.voice === 'rim')), `mandopop ${seed}: a ballad's verse opens without drums`);
    }
  }
  assert.ok(floors >= 6 && halfTime >= 6, `four on the floor (${floors}) and half-time (${halfTime}) both common`);
  assert.ok(rolls >= 6, `hat rolls in C-Pop (${rolls} of 24 tunes)`);
  assert.ok(crossStick >= 4, `a ballad's first verse on the cross-stick (${crossStick} of 24)`);
});

test('a lead a person chooses plays the whole tune', () => {
  for (const seed of SEEDS.slice(0, 6)) for (const mood of ['mandopop', 'cpop'] as const) {
    const bars = composeLofiTune(seed, mood, { lead: 'erhu' });
    for (const b of bars) assert.equal(leadOf(b), 'erhu', `${mood} ${seed} bar ${b.index}`);
  }
});

test('the song has an arc: the verses held back, the pre-chorus climbing, the chorus full', () => {
  for (const mood of ['mandopop', 'cpop'] as const) for (const seed of SEEDS.slice(0, 4)) {
    const bars = composeLofiTune(seed, mood);
    const verse = bars.find(b => b.section === 'verse')!.level, chorus = bars.find(b => b.section === 'drop')!.level;
    const pre = bars.filter(b => b.section === 'build').slice(0, 4).map(b => b.level);
    assert.ok(verse < chorus - 0.1, `${mood} ${seed}: the verse at ${verse}, the chorus at ${chorus}`);
    assert.deepEqual(pre, [...pre].sort((a, b) => a - b), `${mood} ${seed}: the pre-chorus climbs`);
  }
});
