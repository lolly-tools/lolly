// SPDX-License-Identifier: MPL-2.0
/**
 * Oompa (engine/src/lofi-oompa.ts): a Bavarian brass band's polka, march or waltz. The oom
 * on the strong beats and the pah on the after-beats, a tune with a second player under it
 * in thirds and sixths, the clarinets' runs, the trombones' countermelody, a run on the
 * tuba into each strain, the trio in the subdominant, and the stinger.
 *
 * Run directly:  node --test engine/src/lofi-oompa.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeLofiTune, lofiBarBeats, lofiSectionName, lofiTuneSeconds, type LofiBar } from './lofi-compose.ts';
import { OOMPA_BEATS, OOMPA_PART, OOMPA_PARTS, OOMPA_RUN, oompaPart } from './lofi-oompa.ts';

const SEEDS = Array.from({ length: 30 }, (_, i) => (i * 2654435761 + 11) >>> 0);
const pc = (m: number): number => ((m % 12) + 12) % 12;
const NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const tuneOf = (seed: number): LofiBar[] => composeLofiTune(seed, 'oompa');
/** The runs of one section, as [section, first bar, bars]. */
function runs(bars: readonly LofiBar[]): Array<[string, number, number]> {
  const out: Array<[string, number, number]> = [];
  bars.forEach((b, i) => { if (!out.length || out[out.length - 1]![0] !== b.section) out.push([b.section, i, 1]); else out[out.length - 1]![2]++; });
  return out;
}

test('a tune is a polka or a march in two, or a waltz in three, at its own tempo', () => {
  const forms = new Map<string, number>();
  for (const seed of SEEDS) {
    const bars = tuneOf(seed);
    const t = bars[0]!.tune;
    const form = t.style.groove as keyof typeof OOMPA_BEATS;
    forms.set(form, (forms.get(form) ?? 0) + 1);
    assert.equal(lofiBarBeats(t), OOMPA_BEATS[form], `${seed}: ${form} has ${OOMPA_BEATS[form]} beats a bar`);
    const [lo, hi] = form === 'waltz' ? [132, 168] : form === 'march' ? [84, 120] : [108, 132];
    assert.ok(t.bpm >= lo && t.bpm <= hi, `${seed}: a ${form} at ${t.bpm} bpm`);
    assert.match(t.key, /major$/, `${seed}: a major key`);
    for (const b of bars) for (const n of b.notes) assert.ok(n.beat >= 0 && n.beat < lofiBarBeats(t), `${seed} bar ${b.index}: ${n.voice} at beat ${n.beat} is inside its bar`);
    const s = lofiTuneSeconds(seed, 'oompa');
    assert.ok(s > 60 && s < 200, `${seed}: ${s.toFixed(0)} s`);
  }
  for (const f of ['polka', 'march', 'waltz']) assert.ok((forms.get(f) ?? 0) >= 3, `${f}: ${forms.get(f) ?? 0} of ${SEEDS.length}`);
});

test('the form: a fanfare, the first strain twice, the second, a lead-in, the trio in the subdominant, and the coda', () => {
  for (const seed of SEEDS.slice(0, 12)) {
    const bars = tuneOf(seed);
    const t = bars[0]!.tune;
    const order = runs(bars).map(([s, , n]) => `${s}:${n}`);
    const form = t.style.groove;
    assert.equal(order[0], 'intro:4', `${seed}: ${order.join(' ')}`);
    assert.equal(order[1], 'verse:32', `${seed}: the first strain, twice`);
    assert.ok(/^groove:(16|32)$/.test(order[2]!), `${seed}: the second strain`);
    assert.equal(order[3], 'build:4', `${seed}: the lead-in`);
    assert.equal(order.at(-2), 'outro:4', `${seed}: the coda`);
    assert.equal(order.at(-1), 'rest:1');
    if (form === 'march') assert.ok(order.includes('break:8'), `${seed}: a march's break strain`);
    // The trio is in the subdominant: its home chord a fourth over the tune's key.
    const home = NAMES.indexOf(t.key.split(' ')[0]!);
    const trio = bars.find(b => b.section === 'drop')!;
    assert.equal(trio.tones[0], pc(home + 5), `${seed}: the trio opens on the subdominant (${trio.chord} in ${t.key})`);
    assert.equal(lofiSectionName('oompa', 'drop'), 'trio');
    assert.equal(lofiSectionName('oompa', 'verse'), 'first strain');
  }
});

test('the oom on the strong beats and the pah on the after-beats', () => {
  let checked = 0;
  for (const seed of SEEDS.slice(0, 12)) {
    const bars = tuneOf(seed);
    const waltz = bars[0]!.tune.style.groove === 'waltz';
    for (const b of bars.filter(x => x.section === 'verse')) {
      const next = bars[b.index + 1];
      if (!next || b.notes.some(n => n.voice === 'bass' && n.mod === OOMPA_RUN)) continue;   // the run into the next strain
      const oom = b.notes.filter(n => n.voice === 'bass' && n.mod !== OOMPA_RUN).map(n => n.beat);
      const pah = [...new Set(b.notes.filter(n => n.voice === 'keys').map(n => n.beat))];
      if (waltz) {
        assert.deepEqual(oom, [0], `${seed} bar ${b.index}: the waltz's oom on one`);
        assert.deepEqual(pah, [1, 2], `${seed} bar ${b.index}: pah, pah on two and three`);
      } else {
        assert.ok(oom[0] === 0 && oom.every(x => x === 0 || x === 1), `${seed} bar ${b.index}: the oom on the beats (${oom})`);
        assert.deepEqual(pah, [0.5, 1.5], `${seed} bar ${b.index}: the pah on the ands`);
      }
      for (const n of b.notes.filter(x => x.voice === 'keys')) assert.ok(b.tones.includes(pc(n.midi)), `${seed} bar ${b.index}: the pah plays ${b.chord}`);
      // The oom is the root, or the fifth.
      for (const n of b.notes.filter(x => x.voice === 'bass')) assert.ok(pc(n.midi) === b.tones[0] || pc(n.midi) === b.tones[2], `${seed} bar ${b.index}: the oom is the root or the fifth`);
      checked++;
    }
  }
  assert.ok(checked > 200);
});

test('the tune has a second player a third or a sixth under it, and leaves room to breathe at each phrase end', () => {
  let pairs = 0, sweet = 0;
  for (const seed of SEEDS.slice(0, 10)) {
    const bars = tuneOf(seed);
    const beats = lofiBarBeats(bars[0]!.tune);
    for (const b of bars.filter(x => x.section === 'verse' || x.section === 'groove' || x.section === 'drop')) {
      const lines = b.notes.filter(n => n.voice === 'lead');
      for (const m of lines.filter(n => oompaPart(n.mod) === 'melody')) {
        const s = lines.find(n => oompaPart(n.mod) === 'second' && n.beat === m.beat);
        assert.ok(s, `${seed} bar ${b.index}: a second player under the tune`);
        assert.ok(s!.midi < m.midi, `${seed} bar ${b.index}: under it`);
        pairs++;
        if ([3, 4, 8, 9].includes(m.midi - s!.midi)) sweet++;
      }
    }
    // Every four-bar phrase of the first strain ends with the tune's last note let go before the bar does.
    const verse = bars.filter(x => x.section === 'verse');
    for (let i = 3; i < verse.length; i += 4) {
      const mel = verse[i]!.notes.filter(n => n.voice === 'lead' && oompaPart(n.mod) === 'melody');
      const last = mel[mel.length - 1]!;
      assert.ok(last.beat + last.dur <= beats - 0.2, `${seed} verse bar ${i}: room for a breath after the phrase (${last.beat}+${last.dur})`);
    }
  }
  assert.ok(sweet / pairs > 0.75, `thirds and sixths: ${sweet} of ${pairs}`);
});

test('the clarinets decorate, the trombones answer, the trumpets call the fanfare', () => {
  for (const seed of SEEDS.slice(0, 10)) {
    const bars = tuneOf(seed);
    const parts = new Set(bars.flatMap(b => b.notes.filter(n => n.voice === 'lead').map(n => oompaPart(n.mod))));
    for (const p of OOMPA_PARTS) assert.ok(parts.has(p), `${seed}: the ${p} plays`);
    const intro = bars.filter(b => b.section === 'intro');
    assert.ok(intro.slice(0, 3).every(b => b.notes.some(n => n.voice === 'lead' && oompaPart(n.mod) === 'fanfare')), `${seed}: the fanfare's trumpets`);
    // The first strain the second time through: the clarinets run over the tune.
    const second = bars.filter(b => b.section === 'verse').slice(16);
    const clar = second.flatMap(b => b.notes.filter(n => n.voice === 'lead' && oompaPart(n.mod) === 'clarinet'));
    assert.ok(clar.length >= 40, `${seed}: ${clar.length} clarinet notes over the repeat`);
    assert.ok(clar.every(n => n.midi >= 70 && n.midi <= 93), `${seed}: the clarinets over the tune`);
    const counter = bars.flatMap(b => b.notes.filter(n => n.voice === 'lead' && oompaPart(n.mod) === 'counter' && b.section === 'drop'));
    assert.ok(counter.length >= 8 && counter.every(n => n.midi >= 40 && n.midi <= 65), `${seed}: the trombones' countermelody in the full trio`);
  }
});

test('the tuba runs into each new strain, and the coda ends on the stinger', () => {
  for (const seed of SEEDS.slice(0, 12)) {
    const bars = tuneOf(seed);
    const r = runs(bars);
    for (let i = 1; i < r.length - 2; i++) {
      const before = bars[r[i]![1] - 1]!;
      const run = before.notes.filter(n => n.voice === 'bass');
      if (r[i]![0] === 'outro') continue;
      assert.ok(run.length >= 3 && run.slice(1).every(n => n.mod === OOMPA_RUN), `${seed} bar ${before.index}: a run into the ${r[i]![0]}`);
      const into = bars[r[i]![1]]!;
      const lastRun = run[run.length - 1]!;
      const target = into.notes.find(n => n.voice === 'bass' && n.beat === 0)!;
      assert.ok(Math.abs(target.midi - lastRun.midi) <= 2, `${seed} bar ${before.index}: the run steps onto the strain's first oom (${lastRun.midi} to ${target.midi})`);
    }
    const stinger = bars[bars.length - 2]!;
    assert.ok(stinger.notes.some(n => n.voice === 'crash' && n.beat === 0), `${seed}: the stinger's crash`);
    for (const v of ['bass', 'keys', 'lead', 'kick'] as const) assert.ok(stinger.notes.some(n => n.voice === v && n.beat === 0), `${seed}: the whole band on the stinger (${v})`);
    assert.ok(stinger.notes.filter(n => n.voice !== 'crash' && n.voice !== 'kick' && n.voice !== 'tag').every(n => n.beat === 0 && n.dur <= 0.6), `${seed}: the stinger is short`);
  }
});

test('the drums: the bass drum on the beats, a cymbal on the after-beats, the march\'s snare, a woodblock now and then', () => {
  let wood = 0, clash = 0;
  for (const seed of SEEDS) {
    const bars = tuneOf(seed);
    const t = bars[0]!.tune;
    const verse = bars.find(b => b.section === 'verse')!;
    const kicks = verse.notes.filter(n => n.voice === 'kick').map(n => n.beat);
    assert.deepEqual(kicks, t.style.groove === 'waltz' ? [0] : [0, 1], `${seed}: the bass drum`);
    assert.ok(verse.notes.filter(n => n.voice === 'hat').length >= 2, `${seed}: the cymbal on the after-beats`);
    if (t.style.groove === 'march') assert.ok(bars.filter(b => b.section === 'verse').every(b => b.notes.some(n => n.voice === 'snare')), `${seed}: a march's snare in every bar`);
    if (bars.some(b => b.notes.some(n => n.voice === 'perc'))) wood++;
    if (bars.some(b => b.notes.some(n => n.voice === 'hat' && n.mod === 1))) clash++;
  }
  assert.ok(wood >= 6 && wood <= 24, `the woodblock in some tunes (${wood} of ${SEEDS.length})`);
  assert.ok(clash >= 5 && clash <= 25, `crash cymbals on the after-beats in some tunes (${clash} of ${SEEDS.length})`);
});

test('the parts are told apart by their mod, and the tune is the same every time', () => {
  assert.equal(oompaPart(undefined), 'melody');
  assert.equal(oompaPart(OOMPA_PART * 3 + 2), 'counter');
  assert.deepEqual(tuneOf(77), tuneOf(77));
  assert.notDeepEqual(tuneOf(77)[20]!.notes, tuneOf(78)[20]!.notes);
  // A lead a person fixes plays the trio too; otherwise the trio's tune is the tenor horn's.
  const own = tuneOf(5).find(b => b.section === 'drop')!;
  assert.equal(own.voices?.lead, 'tenorhorn');
  const fixed = composeLofiTune(5, 'oompa', { lead: 'trumpet' }).find(b => b.section === 'drop')!;
  assert.equal(fixed.voices?.lead, 'trumpet');
});
