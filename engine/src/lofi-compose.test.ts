// SPDX-License-Identifier: MPL-2.0
/**
 * The Lofi composer's promises.
 *
 * Run directly:  node --test engine/src/lofi-compose.test.ts
 *
 * What is pinned:
 *  - a seed is a tune: the same seed and mood give exactly the same bars, and a
 *    station's run of tunes follows from its first seed;
 *  - every note is playable: inside its bar, in range for its instrument, a velocity
 *    between 0 and 1, no NaN anywhere;
 *  - the harmony holds: the keys voice four or fewer chord tones in their range and move
 *    smoothly, and the lead plays a chord tone on the strong beats;
 *  - tunes differ: across seeds the keys, lead, groove, kit and the way a tune opens all
 *    vary, and the mood leans the key (warm is major, late night and rainy minor);
 *  - a tune's shape: it opens, has a verse, ends with a fading outro and one silent bar;
 *  - a fixed style part (auditioning one instrument) changes that part only.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeLofiTune, lofiStream, lofiTuneSeconds, nextLofiSeed, isDanceMood, LOFI_MOODS, LOFI_DRUM_VOICES, DANCE_MOODS } from './lofi-compose.ts';
import type { LofiBar } from './lofi-compose.ts';

const SEEDS = Array.from({ length: 24 }, (_, i) => (i * 2654435761) >>> 0);
const DRUMS = new Set(LOFI_DRUM_VOICES);

/** A tune's fingerprint: FNV-1a over its bars as JSON, so any change to any note shows. */
function fingerprint(bars: unknown): number {
  const j = JSON.stringify(bars);
  let h = 2166136261;
  for (let i = 0; i < j.length; i++) { h ^= j.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
/** Tunes composed on main before Sherbert existed. */
const FINGERPRINTS: Record<string, number> = {
  'sugar.2024': 1067381605, 'sugar.2654435761': 987489652, 'chiptune.2024': 3361767685, 'chiptune.2654435761': 2547177282,
  'kpop.2024': 1245126060, 'kpop.2654435761': 1409581692,
  'jazz.2024': 4242884971, 'jazz.2654435761': 1166250726, 'sings.2024': 2251072788, 'sings.2654435761': 419362352,
  'warm.2024': 3837958448, 'warm.2654435761': 1943752970,
};

test('a seed is a tune: the same seed and mood compose the same bars', () => {
  for (const mood of LOFI_MOODS) {
    assert.deepEqual(composeLofiTune(1234, mood), composeLofiTune(1234, mood));
  }
  assert.notDeepEqual(composeLofiTune(1, 'warm')[8]!.notes, composeLofiTune(2, 'warm')[8]!.notes, 'different seeds differ');
});

test('a station plays one tune after another, each seed following from the last', () => {
  const stream = lofiStream(99, { mood: 'rainy' });
  const first = composeLofiTune(99, 'rainy');
  for (let i = 0; i < first.length; i++) assert.equal(stream.next().tune.seed, 99);
  const next = stream.next();
  assert.equal(next.index, 0, 'the next tune starts at its first bar');
  assert.equal(next.tune.seed, nextLofiSeed(99));
  assert.equal(next.tune.mood, 'rainy', 'and keeps the mood');
});

test('the dance genres: their tempo, a build with a riser and a roll, then a drop that opens on a crash', () => {
  const BPM = { sugar: [116, 130], sherbert: [136, 150], chiptune: [128, 150], nudisco: [115, 124], synthwave: [92, 118], acid: [122, 130], electro: [118, 126], dubstep: [138, 142], brostep: [145, 150], dnb: [170, 176] } as const;
  for (const mood of ['sugar', 'sherbert', 'chiptune', 'nudisco', 'synthwave', 'acid', 'electro', 'dubstep', 'brostep', 'dnb'] as const) for (const seed of SEEDS.slice(0, 6)) {
    const bars = composeLofiTune(seed, mood);
    const t = bars[0]!.tune;
    const where = `${mood} ${seed}`;
    assert.ok(t.bpm >= BPM[mood][0] && t.bpm <= BPM[mood][1], `${where}: ${t.bpm} bpm`);
    const builds = bars.filter(b => b.section === 'build');
    const drops = bars.filter(b => b.section === 'drop');
    assert.ok(builds.length >= 8 && drops.length >= 32, `${where}: two builds and two drops`);
    assert.ok(builds.some(b => b.notes.some(n => n.voice === 'riser')), `${where}: a build has a riser`);
    const firstBuild = bars.findIndex(b => b.section === 'build');
    const lastBuildBar = bars.findIndex((b, i) => i > firstBuild && b.section !== 'build') - 1;
    const rollEnd = bars[lastBuildBar]!.notes.filter(n => n.voice === 'snare').length;
    const rollStart = bars[firstBuild]!.notes.filter(n => n.voice === 'snare').length;
    assert.ok(rollEnd > rollStart, `${where}: the roll speeds up (${rollStart} hits, then ${rollEnd})`);
    const drop = bars[lastBuildBar + 1]!;
    assert.equal(drop.section, 'drop');
    assert.ok(drop.notes.some(n => n.voice === 'crash' && n.beat === 0), `${where}: the drop opens on a crash`);
    assert.ok(drops.every(b => b.notes.some(n => n.voice === 'bass')), `${where}: the bass plays through every drop bar`);
    assert.ok(drops.some(b => b.notes.some(n => n.voice === 'lead')), `${where}: Lolly Sings, so the melody is in the drop too`);
  }
});

test('sugar: slap bass in every drop (a chip bass now and then in the verse), four on the floor, claps on two and four, and coin dings', () => {
  const verseBasses = new Set<string>();
  for (const seed of SEEDS.slice(0, 12)) {
    const bars = composeLofiTune(seed, 'sugar');
    const st = bars[0]!.tune.style;
    assert.equal(st.bass, 'slap', `${seed}: ${st.bass}`);
    for (const b of bars.filter(x => x.section === 'verse')) verseBasses.add(b.voices?.bass ?? st.bass);
    const drop = bars.filter(b => b.section === 'drop');
    const firstDrop = bars.filter(b => b.section === 'drop' && !b.voices?.bass);
    assert.ok(firstDrop.length >= 8 && firstDrop.every(b => (b.voices?.bass ?? st.bass) === 'slap'), `${seed}: slap through the first drop`);
    assert.ok(drop.every(b => ['slap', 'croak'].includes(b.voices?.bass ?? st.bass)), `${seed}: slap, or now and then the croak, in the second`);
    const arts = new Set(drop.flatMap(b => b.notes.filter(n => n.voice === 'bass').map(n => n.mod)));
    assert.ok(arts.has(0) && arts.has(1), `${seed}: thumbed and popped notes`);
    assert.ok(arts.has(2) || arts.has(3), `${seed}: a slide or a bend`);
    for (const b of drop.slice(0, 4)) {
      const kicks = b.notes.filter(n => n.voice === 'kick').map(n => Math.round(n.beat * 4));
      assert.deepEqual(kicks, [0, 4, 8, 12], `${seed} bar ${b.index}: four on the floor`);
      const backbeat = b.notes.filter(n => n.voice === 'snare' && n.vel > 0.9).map(n => n.beat);
      assert.deepEqual(backbeat, [1, 3], `${seed} bar ${b.index}: claps on two and four`);
    }
    assert.ok(bars.some(b => b.notes.some(n => n.voice === 'coin')), `${seed}: a coin ding`);
  }
  assert.ok(verseBasses.size >= 2 && [...verseBasses].every(b => ['slap', 'pulse', 'croak'].includes(b)), `verses vary their bass across a dozen tunes (${[...verseBasses].join(', ')})`);
});

test('sherbert: half-time future bass, an 808 in every drop, chords that bend and wub, chops in leaps, hat rolls, a console in the effects', () => {
  let chopTunes = 0, stutters = 0, powerUps = 0, leaps = 0, bends = 0, wubs = 0, rolls = 0, shouts = 0;
  const kinds = new Set<string>();
  for (const seed of SEEDS.slice(0, 12)) {
    const bars = composeLofiTune(seed, 'sherbert');
    const st = bars[0]!.tune.style;
    const where = `sherbert ${seed}`;
    assert.ok(bars[0]!.tune.bpm >= 136 && bars[0]!.tune.bpm <= 150, `${where}: ${bars[0]!.tune.bpm} bpm`);
    assert.equal(st.groove, 'halfStep', `${where}: half-time`);
    const drops = bars.filter(b => b.section === 'drop');
    assert.ok(drops.every(b => (b.voices?.bass ?? st.bass) === 'eight'), `${where}: the 808 under every drop`);
    for (const b of drops) {
      const backbeat = b.notes.filter(n => n.voice === 'snare' && n.vel > 0.9).map(n => n.beat);
      assert.deepEqual(backbeat, [2], `${where} bar ${b.index}: the clap on three`);
      assert.ok(b.notes.some(n => n.voice === 'kick' && n.beat === 0), `${where} bar ${b.index}: a kick on one`);
      if (b.layers.includes('hats')) assert.ok(b.notes.filter(n => n.voice === 'hat' || n.voice === 'openHat').length >= 12, `${where} bar ${b.index}: sixteenth hats`);
      if (b.notes.some(n => n.voice === 'hat' && Math.abs(n.beat * 8 - Math.round(n.beat * 8)) < 0.01 && Math.abs(n.beat * 4 - Math.round(n.beat * 4)) > 0.01)) rolls++;
    }
    // The second half of the first drop and all of the second sparkle, on the chord.
    const sparkles = drops.flatMap(b => b.notes.filter(n => n.voice === 'sparkle').map(n => ({ n, b })));
    assert.ok(sparkles.length >= 40, `${where}: the console's arpeggios in the drops (${sparkles.length})`);
    for (const { n, b } of sparkles) assert.ok(b.tones.includes(n.midi % 12) && [3, 4, 5].includes(n.mod ?? -1), `${where}: a sparkle on ${b.chord}`);
    if (st.keys === 'future') {
      const chords = drops.flatMap(b => b.notes.filter(n => n.voice === 'keys'));
      if (chords.some(n => (n.mod ?? 0) >= 16)) bends++;
      if (chords.some(n => (n.mod ?? 0) % 16 > 0)) wubs++;
    }
    if (st.lead === 'chop') chopTunes++;
    const lead = drops.flatMap(b => b.notes.filter(n => n.voice === 'lead').map(n => n.midi));
    if (lead.some((p, i) => i > 0 && Math.abs(p - lead[i - 1]!) >= 7)) leaps++;
    const build = bars.filter(b => b.section === 'build');
    const climb = build.flatMap(b => b.notes.filter(n => n.voice === 'snare').map(n => n.mod ?? 0));
    assert.ok(climb[0] === 0 && climb.at(-1)! >= 10, `${where}: the build's roll climbs (${climb[0]} to ${climb.at(-1)} semitones)`);
    const lastBuild = build.filter((b, i) => !build[i + 1] || build[i + 1]!.index !== b.index + 1);
    for (const b of lastBuild) {
      if (b.notes.filter(n => n.voice === 'lead' && n.beat >= 3 && n.beat < 3.5).length >= 4) stutters++;
      if (b.notes.some(n => n.voice === 'game' && (n.mod ?? 0) % 16 === 1)) powerUps++;
      assert.ok(!b.notes.some(n => !DRUMS.has(n.voice) && n.voice !== 'keys' && n.voice !== 'riser' && n.beat >= 3.5), `${where} bar ${b.index}: the breath before the drop`);
    }
    const breaks = bars.filter(b => b.section === 'break');
    assert.ok(breaks.every(b => !b.notes.some(n => n.voice === 'bass' || n.voice === 'kick')), `${where}: the breakdown drops the bass and the kick`);
    assert.ok(breaks[0]!.notes.some(n => n.voice === 'game' && (n.mod ?? 0) % 16 === 2), `${where}: the power goes down into the breakdown`);
    shouts += bars.flatMap(b => b.notes.filter(n => n.voice === 'hey')).length;
    for (const b of bars) for (const n of b.notes.filter(x => x.voice === 'hey' || x.voice === 'game')) kinds.add(`${n.voice}${(n.mod ?? 0) % 16}`);
  }
  assert.ok(shouts >= 24, `shouts call out through the drops (${shouts} in 12 tunes)`);
  for (const k of ['hey1', 'hey2', 'game4', 'game0']) assert.ok(kinds.has(k), `a ${k} somewhere (${[...kinds].sort().join(' ')})`);
  assert.ok(chopTunes >= 4, `chopped vowels lead most tunes (${chopTunes} of 12)`);
  assert.ok(leaps >= 10, `the melody leaps (${leaps} of 12)`);
  assert.ok(bends >= 6 && wubs >= 6, `the chords bend (${bends}) and wub (${wubs})`);
  assert.ok(rolls >= 12, `thirty-second hat rolls (${rolls})`);
  assert.ok(stutters >= 6 && powerUps >= 2, `builds end on a stutter (${stutters}) or a power-up (${powerUps})`);
});

/** A tune without the hat's foot under the ride (a hat with a `mod` of 2), the only notes added to jazz and swing since these fingerprints. */
const withoutHatFoot = (bars: ReturnType<typeof composeLofiTune>): ReturnType<typeof composeLofiTune> =>
  bars.map(b => ({ ...b, notes: b.notes.filter(n => !(n.voice === 'hat' && n.mod === 2)) }));

test('adding Sherbert changed no other style: a seed still composes what it did', () => {
  // Fingerprints of a few styles' tunes composed before Sherbert existed (main at 2b9783498).
  // Jazz has since gained the hat's foot, and only that: without it, the tune is unchanged.
  const before: Record<string, number> = FINGERPRINTS;
  for (const [key, want] of Object.entries(before)) {
    const [mood, seed] = key.split('.') as [Parameters<typeof composeLofiTune>[1], string];
    assert.equal(fingerprint(withoutHatFoot(composeLofiTune(Number(seed), mood))), want, `${key} composes as it did`);
  }
});

test('jazz and swing: the hat\'s foot on two and four under the ride, and nowhere else', () => {
  for (const mood of ['jazz', 'swing'] as const) {
    let feet = 0;
    for (const seed of SEEDS.slice(0, 6)) {
      for (const b of composeLofiTune(seed, mood)) {
        const foot = b.notes.filter(n => n.voice === 'hat' && n.mod === 2);
        const ride = b.notes.some(n => n.voice === 'hat' && n.mod !== 2);
        if (foot.length) assert.ok(ride, `${mood}: a foot only where the ride plays`);
        for (const n of foot) assert.ok(n.beat === 1 || n.beat === 3, `${mood}: the foot on two and four (beat ${n.beat})`);
        feet += foot.length;
      }
    }
    assert.ok(feet > 40, `${mood}: the foot keeps time (${feet})`);
  }
  for (const mood of ['sugar', 'rock', 'warm'] as const) {
    for (const b of composeLofiTune(SEEDS[0]!, mood)) assert.ok(!b.notes.some(n => n.voice === 'hat' && n.mod === 2), `${mood} has no hat's foot`);
  }
});

test('the bass genres: the bass talks at the end of each drop phrase, bleeps sit in the gaps, a phaser sweeps the build', () => {
  for (const mood of ['dubstep', 'brostep', 'dnb'] as const) {
    let blips = 0, zips = 0;
    for (const seed of SEEDS.slice(0, 8)) {
      const bars = composeLofiTune(seed, mood);
      const where = `${mood} ${seed}`;
      const drops = bars.filter(b => b.section === 'drop');
      let phrase = 0;
      for (const b of drops) {
        const i = phrase++ % 16;
        if (i % 4 !== 3) continue;
        assert.ok(b.notes.some(n => n.voice === 'bwah' && n.beat >= 2), `${where} bar ${b.index}: the bass talks`);
        assert.ok(!b.notes.some(n => n.voice === 'bass' && n.beat >= 1.99), `${where} bar ${b.index}: the line makes way`);
        assert.ok(b.notes.some(n => n.voice === 'bass' && n.beat < 2), `${where} bar ${b.index}: the line plays up to it`);
      }
      blips += drops.flatMap(b => b.notes.filter(n => n.voice === 'blip')).length;
      zips += drops.flatMap(b => b.notes.filter(n => n.voice === 'phaser')).length;
      assert.ok(bars.filter(b => b.section === 'build').some(b => b.notes.some(n => n.voice === 'phaser' && n.mod === 0)), `${where}: a phaser rises through the build`);
    }
    assert.ok(blips >= 20 && zips >= 2, `${mood}: bleeps (${blips}) and zips (${zips}) in the drops`);
  }
});

test('the dance genres change instruments between sections', () => {
  for (const mood of DANCE_MOODS) {
    let softer = 0, newLead = 0;
    for (const seed of SEEDS.slice(0, 8)) {
      const bars = composeLofiTune(seed, mood);
      const st = bars[0]!.tune.style;
      const intro = bars.find(b => b.section === 'intro')!;
      if ((intro.voices?.keys ?? st.keys) !== st.keys) softer++;
      const secondDrop = bars.filter(b => b.section === 'drop').at(-1)!;
      if ((secondDrop.voices?.lead ?? st.lead) !== st.lead) newLead++;
    }
    assert.ok(softer >= 6, `${mood}: the intro's keys differ from the drop's in most tunes (${softer} of 8)`);
    assert.ok(newLead >= 6, `${mood}: the second drop brings a second lead in most tunes (${newLead} of 8)`);
  }
});

test('every dance tune draws its own brightness and drive, within its genre', () => {
  for (const mood of DANCE_MOODS) {
    const tones = SEEDS.slice(0, 8).map(seed => composeLofiTune(seed, mood)[0]!.tune.style);
    for (const st of tones) {
      assert.ok(st.bright! >= 0.6 && st.bright! <= 1.6, `${mood}: bright ${st.bright}`);
      assert.ok(st.drive! >= 1 && st.drive! <= 4, `${mood}: drive ${st.drive}`);
    }
    assert.ok(new Set(tones.map(st => st.bright)).size > 4, `${mood}: brightness varies`);
  }
  assert.equal(composeLofiTune(12345, 'warm')[0]!.tune.style.bright, undefined, 'the Lofi tunes keep their own colour');
});

test('the band styles: a song with verses and choruses, a fill into each chorus and a solo', () => {
  for (const mood of ['rock', 'spanish', 'hiphop', 'reggae', 'funk', 'soul', 'citypop', 'triphop'] as const) for (const seed of SEEDS.slice(0, 6)) {
    const bars = composeLofiTune(seed, mood);
    const st = bars[0]!.tune.style;
    const where = `${mood} ${seed}`;
    const order = bars.map(b => b.section).filter((s, i, a) => s !== a[i - 1]);
    assert.deepEqual(order, ['intro', 'verse', 'build', 'drop', 'break', 'build', 'drop', 'outro', 'rest'], `${where}: ${order.join(' > ')}`);
    assert.ok(!bars.some(b => b.notes.some(n => n.voice === 'riser')), `${where}: a band has no riser`);
    const chorus = bars.find(b => b.section === 'drop')!;
    assert.ok(chorus.notes.some(n => n.voice === 'crash' && n.beat === 0), `${where}: the chorus opens on a crash`);
    const preEnd = bars[bars.indexOf(chorus) - 1]!;
    assert.ok(preEnd.notes.filter(n => n.voice === 'snare' && n.beat >= 2).length >= 8, `${where}: a fill turns into the chorus`);
    const solo = bars.filter(b => b.section === 'break');
    assert.ok(solo.every(b => b.notes.some(n => n.voice === 'lead')), `${where}: the break is a solo`);
    const verse = bars.find(b => b.section === 'verse')!;
    if (mood === 'funk') {
      assert.equal(st.bass, 'slap', `${where}: slap bass`);
      const arts = new Set(bars.flatMap(b => b.notes.filter(n => n.voice === 'bass').map(n => n.mod)));
      assert.ok(arts.has(4) && arts.has(1), `${where}: dead notes and pops`);
      assert.ok(verse.notes.filter(n => n.voice === 'hat').length >= 14, `${where}: sixteenth hats`);
    } else if (mood === 'soul') {
      assert.equal(st.bass, 'motown', `${where}: the soul bass`);
    } else if (mood === 'hiphop') {
      assert.equal(st.bass, 'eight', `${where}: an 808`);
      assert.ok(bars.some(b => b.notes.filter(n => n.voice === 'hat' && n.beat >= 3).length >= 8), `${where}: a trap roll`);
    } else if (mood === 'reggae') {
      const first = bars[0]!;
      assert.ok(['kick', 'rim', 'keys', 'bass'].every(v => first.notes.some(n => n.voice === v)), `${where}: straight into the groove`);
      assert.deepEqual(verse.notes.filter(n => n.voice === 'kick').map(n => n.beat).filter(b => b < 3), [2], `${where}: the one drop`);
      assert.ok(verse.notes.filter(n => n.voice === 'keys').every(n => Math.round(n.beat * 4) % 2 === 0 && Math.round(n.beat * 4) % 4 !== 0), `${where}: the skank on the offbeats`);
      assert.ok(bars.some(b => b.notes.some(n => n.voice === 'hey')), `${where}: a hey`);
    } else if (mood === 'rock') {
      assert.equal(st.keys, 'crunch');
      assert.equal(st.bass, 'picked');
      assert.ok(verse.notes.filter(n => n.voice === 'keys').length >= 8, `${where}: eighth-note chugs`);
      assert.deepEqual(verse.notes.filter(n => n.voice === 'snare').map(n => n.beat), [1, 3], `${where}: the backbeat`);
      // The bass keeps moving: across the song it plays many different bar shapes.
      const shapes = new Set(bars.filter(b => b.section !== 'rest').map(b => b.notes.filter(n => n.voice === 'bass').map(n => Math.round(n.beat * 4)).join(',')));
      assert.ok(shapes.size >= 5, `${where}: ${shapes.size} bass rhythms`);
    } else if (mood === 'spanish') {
      assert.equal(st.keys, 'nylon');
      const strum = verse.notes.filter(n => n.voice === 'keys' && n.beat < 0.2).map(n => n.beat);
      assert.ok(strum.length >= 3 && strum.every((b, i) => i === 0 || b > strum[i - 1]!), `${where}: a strum rolls across the strings`);
      assert.ok(verse.notes.some(n => n.voice === 'rim'), `${where}: the cajón slaps`);
      assert.ok(verse.notes.filter(n => n.voice === 'snare').length >= 4, `${where}: palmas`);
    }
  }
});

test('dance tunes open in different ways', () => {
  for (const mood of ['sugar', 'electro', 'dnb', 'hiphop'] as const) {
    const openings = new Set(SEEDS.slice(0, 12).map(seed => {
      const first = composeLofiTune(seed, mood)[0]!;
      return [...new Set(first.notes.map(n => n.voice))].sort().join('+');
    }));
    assert.ok(openings.size >= 2, `${mood}: ${[...openings].join(' | ')}`);
  }
});

test('the wobble and the growl move: every note says how fast its filter swings', () => {
  for (const mood of ['dubstep', 'brostep'] as const) for (const seed of SEEDS.slice(0, 4)) {
    const bass = composeLofiTune(seed, mood).flatMap(b => b.notes.filter(n => n.voice === 'bass'));
    assert.ok(bass.length > 20);
    assert.ok(bass.every(n => typeof n.mod === 'number' && n.mod > 0), `${mood} ${seed}: a rate on every note`);
    assert.ok(new Set(bass.map(n => n.mod)).size >= 3, `${mood} ${seed}: the rate changes`);
  }
});

test('a saved tune repeats: the stream plays the same tune again instead of moving on', () => {
  const stream = lofiStream(4111860815, { mood: 'sings', repeat: true });
  const tune = composeLofiTune(4111860815, 'sings');
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < tune.length; i++) {
      const bar = stream.next();
      assert.equal(bar.tune.seed, 4111860815);
      assert.equal(bar.index, i, `round ${round}: bar ${i} comes round again in order`);
    }
  }
});

test('a tune lasts its bars at its tempo', () => {
  const bars = composeLofiTune(250249288, 'warm');
  assert.equal(lofiTuneSeconds(250249288, 'warm'), (bars.length * 4 * 60) / bars[0]!.tune.bpm);
  for (const mood of LOFI_MOODS) for (const seed of SEEDS.slice(0, 6)) {
    const s = lofiTuneSeconds(seed, mood);
    assert.ok(s > 40 && s < 400, `${mood} ${seed}: ${s.toFixed(0)} s is a plausible tune length`);
  }
});

test('every note is playable', () => {
  for (const mood of LOFI_MOODS) for (const seed of SEEDS.slice(0, 8)) {
    for (const bar of composeLofiTune(seed, mood)) {
      for (const n of bar.notes) {
        const where = `${mood} ${seed} bar ${bar.index} ${n.voice}`;
        for (const v of [n.beat, n.dur, n.midi, n.vel]) assert.ok(Number.isFinite(v), `${where}: a non-finite value`);
        assert.ok(n.beat >= -0.05 && n.beat < 4.2, `${where}: starts at beat ${n.beat}`);
        assert.ok(n.vel > 0 && n.vel <= 1, `${where}: velocity ${n.vel}`);
        if (DRUMS.has(n.voice)) continue;
        assert.ok(n.dur > 0, `${where}: length ${n.dur}`);
        if (n.voice === 'riser') continue;   // a sweep, not a pitch
        const dance = isDanceMood(mood);
        // The dance basses sit lower (a sub register), and a slap bass pops up to a twelfth above.
        const [lo, hi] = n.voice === 'bass' ? (dance ? [28, 64] : [33, 53]) : n.voice === 'keys' ? [52, 76] : n.voice === 'coin' || n.voice === 'magpie' ? [79, 95] : n.voice === 'hey' ? [55, 66] : n.voice === 'soar' ? [40, 60]
          : n.voice === 'bwah' ? [28, 60] : n.voice === 'phaser' ? [40, 72] : n.voice === 'blip' ? [64, 96] : [64, 84];
        assert.ok(n.midi >= lo && n.midi <= hi, `${where}: note ${n.midi} outside ${lo}..${hi}`);
      }
    }
  }
});

const PC = (m: number): number => ((m % 12) + 12) % 12;


test('the keys voice a few chord tones and move smoothly from chord to chord', () => {
  let moves = 0, total = 0;
  for (const seed of SEEDS.slice(0, 8)) {
    let prev: number[] | null = null;
    for (const bar of composeLofiTune(seed, 'lateNight')) {
      const onset = new Map<number, number[]>();
      for (const n of bar.notes.filter(x => x.voice === 'keys')) {
        const at = Math.round(n.beat * 4);
        onset.set(at, [...(onset.get(at) ?? []), n.midi]);
      }
      for (const chord of onset.values()) {
        if (chord.length < 3) continue;   // a broken chord's single notes
        assert.ok(chord.length <= 4, `seed ${seed} bar ${bar.index}: ${chord.length} keys at once`);
        const v = [...chord].sort((a, b) => a - b);
        if (prev && prev.length === v.length) { total += v.reduce((s, p, i) => s + Math.abs(p - prev![i]!), 0); moves++; }
        prev = v;
      }
    }
  }
  assert.ok(moves > 20, 'enough chord changes to judge');
  assert.ok(total / moves < 8, `the voices move ${(total / moves).toFixed(1)} semitones a change on average`);
});

test('the lead plays a chord tone on the strong beats, and the keys play only chord tones', () => {
  let checked = 0;
  for (const mood of LOFI_MOODS) for (const seed of SEEDS) {
    for (const bar of composeLofiTune(seed, mood)) {
      const tones = new Set(bar.tones);
      for (const n of bar.notes) {
        if (n.voice === 'keys') assert.ok(tones.has(PC(n.midi)), `${mood} ${seed} bar ${bar.index}: keys ${n.midi} is not in ${bar.chord}`);
        const strong = Math.abs(n.beat - Math.round(n.beat / 2) * 2) < 0.03;
        if (n.voice === 'lead' && strong) {
          assert.ok(tones.has(PC(n.midi)), `${mood} ${seed} bar ${bar.index}: lead ${n.midi} on beat ${n.beat.toFixed(2)} is off ${bar.chord}`);
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 30, 'enough strong-beat lead notes to judge');
});

test('tunes differ: instruments, groove, kit and openings vary, and the mood leans the key', () => {
  const seen: Record<string, Set<string>> = { keys: new Set(), lead: new Set(), groove: new Set(), snare: new Set(), opening: new Set() };
  for (const seed of SEEDS) {
    const bars = composeLofiTune(seed, 'warm');
    const st = bars[0]!.tune.style;
    seen.keys!.add(st.keys); seen.lead!.add(st.lead); seen.groove!.add(st.groove); seen.snare!.add(st.snare);
    seen.opening!.add(bars[0]!.layers.join('+'));
  }
  for (const [part, values] of Object.entries(seen)) assert.ok(values.size >= 3, `${part}: only ${[...values].join(', ')}`);
  for (const seed of SEEDS.slice(0, 6)) {
    assert.match(composeLofiTune(seed, 'warm')[0]!.tune.key, /major$/);
    assert.match(composeLofiTune(seed, 'lateNight')[0]!.tune.key, /minor$/);
    assert.match(composeLofiTune(seed, 'rainy')[0]!.tune.key, /minor$/);
  }
});

test("a tune's shape: an opening, a verse, a fading outro and one silent bar", () => {
  for (const seed of SEEDS.slice(0, 8)) {
    const bars: LofiBar[] = composeLofiTune(seed, 'warm');
    assert.equal(bars[0]!.section, 'intro');
    assert.ok(bars.some(b => b.section === 'verse'), 'a verse');
    const rest = bars.at(-1)!;
    assert.equal(rest.section, 'rest');
    assert.equal(rest.notes.length, 0, 'the last bar is silent');
    const outro = bars.filter(b => b.section === 'outro');
    assert.ok(outro.length >= 2, 'an outro');
    assert.ok(outro.at(-1)!.level < outro[0]!.level, 'that fades');
    assert.equal(bars[0]!.tune.bars, bars.length);
  }
});

test('Lolly Sings: a lead in every tune, singing through every verse, in a major key', () => {
  for (const seed of SEEDS.slice(0, 12)) {
    const bars = composeLofiTune(seed, 'sings');
    const st = bars[0]!.tune.style;
    assert.notEqual(st.lead, 'none', `seed ${seed}: Lolly Sings always has a lead`);
    assert.equal(st.crunch, false, 'and no sampler grit');
    assert.ok(st.dust < 1, 'and less dust than Lofi');
    assert.match(bars[0]!.tune.key, /major$/);
    for (const bar of bars.filter(b => b.section === 'verse')) {
      assert.ok(bar.layers.includes('lead'), `seed ${seed} bar ${bar.index}: the lead sings the whole verse`);
    }
  }
});

test('adding Lolly Sings changed no Lofi tune: a seed still composes what it did', () => {
  // A shared Lofi link is a seed, so a new genre must not shift the old ones' draws.
  const t = composeLofiTune(12345, 'warm')[0]!.tune;
  assert.equal(t.key, 'B major');
  assert.equal(t.bpm, 88);
  assert.equal(t.style.keys, 'rhodes');
  assert.equal(t.style.lead, 'flute');
});

test('fixing one style part changes that part only', () => {
  const base = composeLofiTune(77, 'warm')[0]!.tune;
  const fixed = composeLofiTune(77, 'warm', { keys: 'felt' })[0]!.tune;
  assert.equal(fixed.style.keys, 'felt');
  assert.equal(fixed.key, base.key);
  assert.equal(fixed.bpm, base.bpm);
  assert.equal(fixed.style.groove, base.style.groove);
  assert.equal(fixed.style.lead, base.style.lead);
});

test('Fantasy, Dreamscape, K-pop and Metal each have their own colour and moments', () => {
  const pcOf = (m: number): number => ((m % 12) + 12) % 12;
  const tonic = (b: LofiBar): number => ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'].indexOf(b.tune.key.split(' ')[0]!);
  let lydian = 0, keyChanges = 0;
  for (const seed of SEEDS.slice(0, 8)) {
    // Fantasy: a harp or a choir, and the lydian fourth in a major key's melody.
    const fantasy = composeLofiTune(seed, 'fantasy');
    assert.ok(['harp', 'choir', 'pad'].includes(fantasy[0]!.tune.style.keys), `fantasy ${seed}: ${fantasy[0]!.tune.style.keys}`);
    if (fantasy.some(b => b.tune.key.endsWith('major') && b.notes.some(n => n.voice === 'lead' && pcOf(n.midi) === (tonic(b) + 6) % 12))) lydian++;
    // Dreamscape: the hats only on the beat.
    const dream = composeLofiTune(seed, 'dream');
    assert.ok(dream.every(b => b.notes.every(n => n.voice !== 'hat' || Math.abs(n.beat - Math.round(n.beat)) <= 0.05)), `dream ${seed}: hats on the beat`);
    // K-pop: claps on every beat of a chorus, and the last chorus a key up from the first.
    const kpop = composeLofiTune(seed, 'kpop');
    const drops = kpop.filter(b => b.section === 'drop');
    assert.ok(drops.every(b => [0, 1, 2, 3].every(beat => b.notes.some(n => n.voice === 'snare' && Math.abs(n.beat - beat) < 0.05))), `kpop ${seed}: claps on every beat`);
    if (drops.at(-1)!.chord !== drops[0]!.chord) keyChanges++;
    // Metal: a band song with the double kick through the chorus.
    const metal = composeLofiTune(seed, 'metal');
    assert.equal(metal[0]!.tune.style.keys, 'crunch');
    assert.ok(metal.filter(b => b.section === 'drop').every(b => b.notes.filter(n => n.voice === 'kick').length >= 8), `metal ${seed}: the double kick`);
  }
  assert.ok(lydian >= 1, 'a lydian fourth in some major fantasy tune');
  assert.ok(keyChanges >= 6, `most K-pop tunes change key for the last chorus (${keyChanges} of 8)`);
});

