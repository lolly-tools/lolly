// SPDX-License-Identifier: MPL-2.0
/**
 * Archetype fit (plan 274 section 3.3, work package 4): which of a slide
 * master's layouts a source slide should be poured into.
 *
 * Every rule reads a `LayoutFeaturesV1` vector, so most of this file is hand
 * built vectors rather than decks: a rule that needs a pptx to be exercised is
 * a rule nobody can reason about. The master is the neutral one from
 * `brands/lolly-start`, which is on disk in every clone and declares all twelve
 * archetypes.
 *
 * Run with: node --test "tests/rebrand-archetype.test.ts"
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
  ARCHETYPE_MIN_GAP,
  pickArchetype,
  scoreArchetypes,
  type ArchetypeHintsV1,
} from '../engine/src/rebrand-archetype.ts';
import type { LayoutFeaturesV1, SlideMasterFileV1, SlideMasterV1 } from '../packages/core/src/index.ts';
import { isKnownArchetypeId } from '../packages/core/src/index.ts';

const MASTER: SlideMasterV1 = (JSON.parse(
  readFileSync(fileURLToPath(new URL('../brands/lolly-start/catalog/assets/lolly/slides/masters.json', import.meta.url)), 'utf8'),
) as SlideMasterFileV1).masters[0] as SlideMasterV1;

/** A feature vector with everything at zero, so a case states only what it means. */
function features(partial: Partial<LayoutFeaturesV1> = {}): LayoutFeaturesV1 {
  return {
    slideId: 'slide1',
    counts: {},
    imageAreaShare: 0,
    chartPresent: false,
    tablePresent: false,
    distinctLeftEdges: 1,
    equalSiblingBoxes: 0,
    textParagraphs: 1,
    textWords: 0,
    ...partial,
  };
}

function pick(partial: Partial<LayoutFeaturesV1>, hints: ArchetypeHintsV1 = {}): string {
  return pickArchetype(features(partial), MASTER, { hints }).id;
}

test('the neutral master declares every archetype these rules can propose', () => {
  const declared = new Set(MASTER.archetypes.map((a) => a.id));
  for (const id of ['title', 'section', 'content', 'two-column', 'split', 'visual', 'full-image', 'quote', 'big-number', 'table']) {
    assert.ok(declared.has(id as never), `the neutral master is missing ${id}, so this file cannot exercise its rule`);
  }
});

test('the rule table, one hand-built feature vector per case', () => {
  // A title and a subtitle, nothing else: the title slide.
  assert.equal(pick({ counts: { title: 1, subtitle: 1 }, textWords: 9, textParagraphs: 2 }), 'title');
  // The same slide without a subtitle is a section header, not a title slide.
  assert.equal(pick({ counts: { title: 1 }, textWords: 4, textParagraphs: 1 }), 'section');
  // A native table wins over everything else on the slide.
  assert.equal(pick({ counts: { title: 1, table: 1 }, tablePresent: true, textWords: 40 }), 'table');
  // A chart with little text around it.
  assert.equal(pick({ counts: { title: 1, chart: 1 }, chartPresent: true, textWords: 12 }), 'visual');
  // One picture over most of the slide.
  assert.equal(pick({ counts: { photo: 1 }, imageAreaShare: 0.74, textWords: 6 }), 'full-image');
  // A picture beside a body of text.
  assert.equal(pick({ counts: { title: 1, body: 1, photo: 1 }, imageAreaShare: 0.32, textWords: 80 }), 'split');
  // Two equal boxes on two left edges with two bodies of text.
  assert.equal(pick({ counts: { title: 1, body: 2 }, equalSiblingBoxes: 2, distinctLeftEdges: 3, textWords: 70 }), 'two-column');
  // A quotation, which only the hint can see.
  assert.equal(pick({ counts: { body: 1 }, textWords: 18 }, { quoteMarks: true }), 'quote');
  // One figure, which only the hint can see.
  assert.equal(pick({ counts: { body: 1 }, textWords: 3 }, { bigNumber: true }), 'big-number');
  // A title over a body of text is the plainest content slide.
  assert.equal(pick({ counts: { title: 1, body: 1 }, textWords: 95 }), 'content');
});

test('a quotation or a figure with no hint is not guessed at', () => {
  assert.notEqual(pick({ counts: { body: 1 }, textWords: 18 }), 'quote');
  assert.notEqual(pick({ counts: { body: 1 }, textWords: 3 }), 'big-number');
});

test('scoreArchetypes returns every archetype the master declares, ordered, with reasons on the leader', () => {
  const scored = scoreArchetypes(features({ counts: { title: 1, subtitle: 1 }, textWords: 9, textParagraphs: 2 }), MASTER);
  assert.equal(scored.length, MASTER.archetypes.length);
  for (let i = 1; i < scored.length; i += 1) {
    const before = scored[i - 1];
    const now = scored[i];
    assert.ok(before && now);
    // At one score the twelve come before the layout library's archetypes, which no rule scores yet.
    const rank = (id: string): number => (isKnownArchetypeId(id) ? 0 : 1);
    assert.ok(before.score > now.score || (before.score === now.score
      && (rank(before.id) < rank(now.id) || (rank(before.id) === rank(now.id) && before.id.localeCompare(now.id) <= 0))),
      'the list is ordered by score, then the twelve before the library, then by id');
  }
  const top = scored[0];
  assert.ok(top);
  assert.equal(top.id, 'title');
  assert.ok(top.reasons.length > 0, 'the leader states why it leads');
  assert.match(top.reasons.join(' '), /9 words/);
});

test('a near tie falls back to the content layout and offers the leader as the alternative', () => {
  const vector = features({ counts: { title: 1, chart: 1 }, chartPresent: true, textWords: 12 });
  // With a gap wide enough to swallow the real one, the pick has to fall back.
  const tied = pickArchetype(vector, MASTER, { minGap: 0.9 });
  assert.equal(tied.id, 'content');
  assert.equal(tied.alternative, 'visual');
  assert.match(tied.reasons.join(' '), /within 0\.9/);

  // The same vector at the documented gap takes its leader outright.
  const clear = pickArchetype(vector, MASTER, { minGap: ARCHETYPE_MIN_GAP });
  assert.equal(clear.id, 'visual');
  assert.equal(clear.alternative, undefined);
});

test('a master with one archetype can only answer with it, and an empty one answers content', () => {
  const single: SlideMasterV1 = { ...MASTER, archetypes: MASTER.archetypes.filter((a) => a.id === 'table') };
  assert.equal(pickArchetype(features({ counts: { title: 1, body: 1 }, textWords: 95 }), single).id, 'table');

  const none: SlideMasterV1 = { ...MASTER, archetypes: [] };
  const picked = pickArchetype(features({ counts: { title: 1 } }), none);
  assert.equal(picked.id, 'content');
  assert.equal(picked.score, 0);
  assert.ok(picked.reasons.length > 0);
});

test('the same features give the same list twice', () => {
  const vector = features({ counts: { title: 1, body: 1, photo: 1 }, imageAreaShare: 0.32, textWords: 80 });
  assert.deepEqual(scoreArchetypes(vector, MASTER), scoreArchetypes(vector, MASTER));
});

test('a cover slide with no subtitle is the title slide, and a bare heading elsewhere is still a section header', () => {
  const vector: Partial<LayoutFeaturesV1> = { counts: { title: 1 }, textWords: 4, textParagraphs: 1 };
  // The opening slide of a deck states its title and, often, a date line the
  // census reads as a date rather than a subtitle. Without the hint the section
  // rule takes every such slide and the title archetype is unreachable.
  assert.equal(pick(vector, { coverSlide: true }), 'title');
  assert.equal(pick(vector), 'section', 'a heading in the middle of a deck is still a divider');

  const cover = pickArchetype(features(vector), MASTER, { hints: { coverSlide: true } });
  assert.equal(cover.alternative, undefined, 'the pick is clear of the runner-up, so nothing is offered beside it');
  assert.match(cover.reasons.join(' '), /opens the deck/);
});

test('one native table is counted once, in the sentence a review reads', () => {
  // The census sets the class count AND the presence flag for the same object,
  // so adding them read one table as two.
  const scored = scoreArchetypes(features({ counts: { title: 1, table: 1 }, tablePresent: true, textWords: 40 }), MASTER);
  const table = scored.find((row) => row.id === 'table');
  assert.ok(table);
  assert.match(table.reasons.join(' '), /carries 1 table\./);
});

// ─── coverage before taste ───────────────────────────────────────────────────

test('coverage outranks the aesthetic score: kept content picks a layout that holds all of it', () => {
  // A title, a body and a chart picture: the split layout reads a chart beside
  // that many words, and it is the one layout that holds all three.
  const chartSlide = features({ counts: { title: 1, body: 1, chart: 1 }, chartPresent: true, textWords: 60 });
  assert.equal(pickArchetype(chartSlide, MASTER, { hints: {} }).id, 'split', 'the rule reads a chart beside text');
  const covered = pickArchetype(chartSlide, MASTER, { hints: { needs: { title: 1, body: 1, visual: 1 } } });
  assert.equal(covered.id, 'split');
  assert.equal(covered.coverage, 1);

  // A title and a picture: the visual layout holds both; the full-page picture
  // has no title slot, so it covers half.
  assert.equal(pick({ counts: { title: 1, photo: 1 }, imageAreaShare: 0.7, textWords: 6 }, { needs: { title: 1, visual: 1 } }), 'visual');
  // A picture and nothing else keeps the full-page picture.
  assert.equal(pick({ counts: { photo: 1 }, imageAreaShare: 0.74, textWords: 0 }, { needs: { visual: 1 } }), 'full-image');
  // A table wants the table layout.
  assert.equal(pick({ counts: { title: 1, table: 1 }, tablePresent: true, textWords: 20 }, { needs: { title: 1, data: 1 } }), 'table');
  // Two text columns still read as two columns: the rule decides among layouts that cover the same.
  assert.equal(pick({ counts: { title: 1, body: 2 }, equalSiblingBoxes: 2, distinctLeftEdges: 3, textWords: 70 }, { needs: { title: 1, body: 2 } }), 'two-column');
  // A chart with its unit line needs a text slot to close, which the visual layout lacks.
  assert.equal(pick({ counts: { title: 1, chart: 1 }, chartPresent: true, textWords: 12 }, { needs: { title: 1, visual: 1, note: 1 } }), 'split');
});

test('on a slide of many words, a layout no rule chose never wins on coverage alone', () => {
  // 150 words, a title and a picture over 12% of the slide: the split rule wants
  // 15% before it reads a picture beside text, so it scores nothing. Coverage
  // alone would still pour the words into its narrow panel; the content layout
  // scored, so it is taken and the picture goes on to a continuation slide.
  const wordy = features({ counts: { title: 1, body: 2, photo: 1 }, imageAreaShare: 0.12, textWords: 150 });
  const needs = { title: 1, body: 2, visual: 1 };
  const scored = scoreArchetypes(wordy, MASTER, { needs });
  const split = scored.find((row) => row.id === 'split');
  const content = scored.find((row) => row.id === 'content');
  assert.equal(split?.score, 0);
  assert.equal(split?.coverage, 1);
  assert.ok(content && content.score > 0 && content.coverage < 1);
  assert.equal(pickArchetype(wordy, MASTER, { hints: { needs } }).id, 'content');

  // A slide of few words keeps coverage first: a title over a large picture takes
  // the layout that holds both, although no rule chose it.
  assert.equal(pick({ counts: { title: 1, photo: 1 }, imageAreaShare: 0.7, textWords: 6 }, { needs: { title: 1, visual: 1 } }), 'visual');
});

test('coverage names what a layout cannot hold, and a tie on coverage and score prefers fewer spare slots', () => {
  const scored = scoreArchetypes(features({ counts: { title: 1, photo: 1 }, imageAreaShare: 0.7 }), MASTER, { needs: { title: 1, visual: 1 } });
  const content = scored.find((row) => row.id === 'content');
  assert.ok(content);
  assert.equal(content.coverage, 0.5);
  assert.ok(content.reasons.some((reason) => /No slot for the visual/.test(reason)));
  // Visual and split both cover a title and a picture and neither rule fires at
  // this picture size; visual leaves no slot empty and split leaves its body.
  const visual = scored.find((row) => row.id === 'visual');
  const split = scored.find((row) => row.id === 'split');
  assert.equal(visual?.spare, 0);
  assert.equal(split?.spare, 1);
  assert.ok(scored.indexOf(visual!) < scored.indexOf(split!));
  // With no needs stated every layout covers the slide in full and none is spare.
  for (const row of scoreArchetypes(features(), MASTER)) {
    assert.equal(row.coverage, 1);
    assert.equal(row.spare, 0);
  }
});

// ─── the structure hint and the plain-word sentences (plan 275 section 3) ─────

test('two-column fires only where the structure read is two boxes side by side', () => {
  const vector = { counts: { title: 1, body: 2 }, equalSiblingBoxes: 2, distinctLeftEdges: 3, textWords: 70 };
  assert.equal(pick(vector), 'two-column', 'with no read at all, plan 274 rules as before');
  assert.equal(pick(vector, { structure: 'columns-2' }), 'two-column');
  assert.equal(pick(vector, { structure: 'text-two-column' }), 'two-column');
  assert.equal(pick(vector, { structure: null }), 'content', 'the matcher read the slide and named nothing: a dense slide');
  assert.equal(pick(vector, { structure: 'title-body' }), 'content', 'a stack of equal boxes is not two columns');
  assert.equal(pick(vector, { structure: 'grid-2x2' }), 'content');
});

test('a pick says why in plain words, with the figures in the params and none in the text', () => {
  const cases: Array<[Partial<LayoutFeaturesV1>, ArchetypeHintsV1]> = [
    [{ counts: { title: 1, subtitle: 1 }, textWords: 9, textParagraphs: 2 }, {}],
    [{ counts: { title: 1, table: 1 }, tablePresent: true, textWords: 40 }, {}],
    [{ counts: { photo: 1 }, imageAreaShare: 0.74, textWords: 6 }, {}],
    [{ counts: { title: 1, body: 1, photo: 1 }, imageAreaShare: 0.32, textWords: 80 }, {}],
    [{ counts: { title: 1, body: 1 }, textWords: 95 }, {}],
    [{ counts: { title: 1, body: 2 }, equalSiblingBoxes: 2, distinctLeftEdges: 3, textWords: 70 }, { structure: 'columns-2' }],
  ];
  for (const [vector, hints] of cases) {
    const picked = pickArchetype(features(vector), MASTER, { hints });
    assert.ok(picked.messages.length > 0, picked.id);
    for (const message of picked.messages) {
      assert.match(message.code, /^layout\.reason\.pick\./);
      assert.doesNotMatch(message.text, /[\d%]/, message.text);
    }
  }
  const table = pickArchetype(features({ counts: { title: 1, table: 1 }, tablePresent: true, textWords: 40 }), MASTER);
  assert.equal(table.messages[0]?.text, 'The slide holds a table.');
  assert.equal(table.messages[0]?.params.words, 40);
});
