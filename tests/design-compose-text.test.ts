// SPDX-License-Identifier: MPL-2.0
/**
 * The words a composed slot carries (plan 291 M3b, engine/src/design-compose.ts):
 *
 *   - `join` runs every line of an inventory text into one (`AI` over a question becomes
 *     `AI: the question`), and `para` still picks one paragraph;
 *   - E15, emphasis follows the brand: a source's bold in a display slot is set in the
 *     brand's accent ink when a text-weight house rule does not allow bold, the ink the
 *     brief's combinations allow as text on that ground; `emphasis` overrides it;
 *   - `case: "sentence"`, opt-in, with every change recorded as an edit.
 *
 * Public: the neutral master and a synthetic design system written here (invented
 * names and colours). The SUSE cases are in the brand-gated tests/design-compose-suse.test.ts.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/design-compose-text.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { ContentInventoryV1, DesignComposeSpecV1 } from '../packages/core/src/index.ts';
import { composeDesignSlides, sentenceCaseDesignText, type DesignComposeContext } from '../engine/src/design-compose.ts';
import { designBrief } from '../engine/src/design-brief.ts';
import { checkDesignHouseRules } from '../engine/src/design-house-rules.ts';
import { checkFidelity } from '../engine/src/check-fidelity.ts';
import { plainOfDesignText } from '../engine/src/design-text.ts';
import { neutralSlideMaster } from '../engine/src/rebrand-design-system.ts';

type Row = Record<string, unknown>;

/**
 * A synthetic design system: Medium (500) headlines as a required house rule, and an
 * accent (`kelp`) the brand does not allow as text on white, where `cobalt` is allowed.
 */
const TOKENS = {
  $themes: [
    { name: 'light', selectedTokenSets: { base: 'enabled', light: 'enabled' } },
    { name: 'dark', selectedTokenSets: { base: 'enabled', dark: 'enabled' } },
  ],
  $extensions: {
    'com.suse.lolly': {
      brandSystem: {
        schemaVersion: 1, id: 'coastal', label: 'Coastal', roles: [], bindings: [],
        rules: [
          { id: 'headline-medium', label: 'Headlines are Medium', kind: 'text-weight', roleIds: [], parameters: { target: 'headline', weights: ['500'] }, scope: { tools: ['design'] }, requirement: 'required', origin: { kind: 'manual', author: 'test' }, review: { state: 'draft' } },
          { id: 'pairings', label: 'Text colours follow the pairings', kind: 'color-pairing', roleIds: [], parameters: { source: 'token-extension' }, requirement: 'required', origin: { kind: 'manual', author: 'test' }, review: { state: 'draft' } },
        ],
      },
    },
  },
  base: {
    color: {
      $type: 'color',
      brand: {
        deep: { $value: '#102a43', $extensions: { 'com.suse.lolly': { combinations: { text: ['foam', 'white', 'kelp'], graphic: ['foam', 'white', 'kelp'] } } } },
        white: { $value: '#ffffff', $extensions: { 'com.suse.lolly': { combinations: { text: ['deep', 'cobalt'], graphic: ['deep', 'cobalt', 'kelp'] } } } },
        kelp: { $value: '#3fbf7f' },
        cobalt: { $value: '#2346d8' },
        foam: { $value: '#9ff0d2' },
      },
    },
  },
  light: { color: { $type: 'color', semantic: { primary: { $value: '{color.brand.deep}' }, secondary: { $value: '{color.brand.kelp}' }, surface: { $value: '{color.brand.white}' }, text: { $value: '{color.brand.deep}' } } } },
  dark: { color: { $type: 'color', semantic: { primary: { $value: '{color.brand.kelp}' }, secondary: { $value: '{color.brand.foam}' }, surface: { $value: '{color.brand.deep}' }, text: { $value: '{color.brand.white}' } } } },
};
const BRIEF = designBrief(TOKENS, null, { name: 'Coastal' });
const COLORS: Record<string, string> = { 'color.semantic.text': '#102a43', 'color.semantic.surface': '#ffffff', 'color.semantic.muted': '#52606d' };

/** One slide of invented words: a short line over a question with one bold word, then a name. */
function inventory(): ContentInventoryV1 {
  const box = { x: 0.1, y: 0.1, width: 0.8, height: 0.2 };
  return {
    version: 'lolly/content-inventory-v1',
    source: { name: 'invented.pptx', sha256: 'e'.repeat(64), bytes: 1000, kind: 'pptx', slides: 2, width: 960, height: 540 },
    slides: [
      {
        number: 1, id: 'slide1',
        text: [
          {
            objectId: 'h1', role: 'title', class: 'title', box,
            // One paragraph whose lines are line breaks (pptx a:br), the way decks set an eyebrow.
            paragraphs: [{ runs: [{ text: 'Tides', bold: true }, { text: '\n' }, { text: '\n' }, { text: 'Are we ' }, { text: 'drifting', bold: true, color: '#ff8800' }, { text: ' past the harbour?' }] }],
            plain: 'Tides\n\nAre we drifting past the harbour?',
          },
          { objectId: 'n1', role: 'body', class: 'body', box, paragraphs: [{ runs: [{ text: 'Maren Holt' }] }], plain: 'Maren Holt' },
        ],
        notes: null, pictures: [], tables: [], charts: [], objects: [],
      },
      {
        number: 2, id: 'slide2',
        text: [
          { objectId: 'h2', role: 'title', class: 'title', box, paragraphs: [{ runs: [{ text: 'Agenda:' }] }, { runs: [{ text: 'Three Tides Of The Year' }] }], plain: 'Agenda:\nThree Tides Of The Year' },
        ],
        notes: null, pictures: [], tables: [], charts: [], objects: [],
      },
    ],
    media: [],
    warnings: [],
  } as unknown as ContentInventoryV1;
}

const ctx = (over: Partial<DesignComposeContext> = {}): DesignComposeContext => ({
  master: neutralSlideMaster(), masterOrigin: 'neutral', resolveToken: (p) => COLORS[p], inventory: inventory(), ...over,
});
const compose = (spec: unknown, c: DesignComposeContext = ctx()) => composeDesignSlides(spec as DesignComposeSpecV1, c);
const byId = (boxes: Row[], id: string): Row => {
  const row = boxes.find((r) => r.id === id);
  assert.ok(row, `row ${id} is composed`);
  return row;
};

// ─── join ────────────────────────────────────────────────────────────────────

test('join runs every line of the text into one, across line breaks and paragraphs, and para still picks one', () => {
  const { document } = compose({
    slides: [
      { archetype: 'content', source: 1, notes: null, slots: { title: { from: 'h1', join: ': ' }, body: { from: 'n1' } } },
      { archetype: 'content', source: 2, notes: null, slots: { title: { from: 'h2', join: ': ' }, body: { from: 'h2', para: 1 } } },
    ],
  });
  // The neutral title is 700, so bold inside it is the row's own weight and not marked.
  assert.equal(byId(document.boxes, 's01.title').text, 'Tides: Are we drifting past the harbour?');
  // A line that already ends with the separator's mark keeps its own.
  assert.equal(byId(document.boxes, 's02.title').text, 'Agenda: Three Tides Of The Year');
  assert.equal(byId(document.boxes, 's02.body').text, 'Three Tides Of The Year');
});

test('join is refused without from or when it is not text; beside para it runs the picked paragraphs\' lines into one', () => {
  assert.throws(() => compose({ slides: [{ archetype: 'content', slots: { title: { text: 'x', join: ': ' } } }] }), /\/slides\/0\/slots\/title\/join: join runs the paragraphs/);
  assert.throws(() => compose({ slides: [{ archetype: 'content', slots: { title: { from: 'h1', join: 2 } } }] }), /\/join: expected the text/);
  // Plan 291 M4: para picks, join runs the picked paragraphs' lines into one.
  const { document } = compose({ slides: [{ archetype: 'content', source: 2, notes: null, slots: { title: { from: 'h2', para: [0, 1], join: ' ' }, body: null } }] });
  assert.equal(byId(document.boxes, 's01.title').text, 'Agenda: Three Tides Of The Year');
});

// ─── E15 emphasis ────────────────────────────────────────────────────────────

test('E15: under a Medium headline rule, source bold in a title takes the accent ink the brand allows on that ground', () => {
  const { document, report, edits } = compose({
    slides: [
      // The synthetic system sets headlines in Medium: the slot says so, over the neutral master's 700.
      { archetype: 'content', source: 1, notes: null, slots: { title: { from: 'h1', join: ': ', weight: '500' }, body: { from: 'n1' } } },
      { archetype: 'section', source: 1, notes: null, slots: { title: { from: 'h1', join: ': ', weight: '500' }, subtitle: null } },
    ],
  }, ctx({ brief: BRIEF }));
  // On white, the light accent (kelp) is not an allowed text colour; cobalt is, and differs from the ink.
  const light = String(byId(document.boxes, 's01.title').text);
  assert.equal(light, '{#2346d8|Tides}: Are we {#2346d8|drifting} past the harbour?');
  assert.ok(!light.includes('**'), 'no bold run is left to break the rule');
  // On the dark section ground, the dark theme's accent (foam) is allowed on deep.
  assert.equal(byId(document.boxes, 's02').bg, '#102a43');
  assert.equal(byId(document.boxes, 's02.title').text, '{#9ff0d2|Tides}: Are we {#9ff0d2|drifting} past the harbour?');
  // Each mapping is reported and declared as an edit whose words are unchanged.
  const mapped = report.notes.filter((n) => n.code === 'compose.emphasis.accent');
  assert.deepEqual(mapped.map((n) => n.path), ['/slides/0/slots/title', '/slides/1/slots/title']);
  assert.match(mapped[0]!.message, /#2346d8/);
  assert.match(mapped[0]!.message, /headline-medium/);
  const declared = edits.filter((e) => /accent colour #2346d8/.test(e.reason));
  // Named by the source's own lines (plan 291 M4): the words are the same, only their colour changed.
  assert.deepEqual(declared.map((e) => [e.source, e.result]), [['Tides', 'Tides'], ['Are we drifting past the harbour?', 'Are we drifting past the harbour?']]);
  // The body slot keeps the source as it is: emphasis follows the brand in display slots only.
  assert.equal(byId(document.boxes, 's01.body').text, 'Maren Holt');

  // The composed slide passes the house rules the mapping answers to.
  const findings = checkDesignHouseRules(document.boxes, BRIEF.houseRules, TOKENS).findings;
  assert.deepEqual(findings.filter((f) => f.layerId === 's01.title'), []);
});

test('E15: emphasis on the spec, the slide or the slot overrides the default', () => {
  const slide = (over: Record<string, unknown> = {}, slot: Record<string, unknown> = {}) => ({
    archetype: 'content', source: 1, notes: null, ...over, slots: { title: { from: 'h1', join: ': ', weight: '500', ...slot }, body: null },
  });
  const { document, report } = compose({
    emphasis: 'bold',
    slides: [slide(), slide({ emphasis: 'keep' }), slide({}, { emphasis: 'accent' })],
  }, ctx({ brief: BRIEF }));
  assert.equal(byId(document.boxes, 's01.title').text, '**Tides**: Are we **drifting** past the harbour?');
  // keep: bold, with the source's own run colour.
  assert.equal(byId(document.boxes, 's02.title').text, '**Tides**: Are we **{#ff8800|drifting}** past the harbour?');
  assert.equal(byId(document.boxes, 's03.title').text, '{#2346d8|Tides}: Are we {#2346d8|drifting} past the harbour?');
  assert.deepEqual(report.notes.filter((n) => n.code === 'compose.emphasis.accent').map((n) => n.path), ['/slides/2/slots/title']);
  assert.match(report.notes.find((n) => n.code === 'compose.emphasis.accent')!.message, /emphasis: accent/);
});

test('E15: without a rule that bold breaks, bold stays bold; with no allowed accent, bold stays and the report says why', () => {
  const plain = compose({ slides: [{ archetype: 'content', source: 1, notes: null, slots: { title: { from: 'h1', join: ': ', weight: '500' }, body: null } }] });
  assert.equal(byId(plain.document.boxes, 's01.title').text, '**Tides**: Are we **drifting** past the harbour?');
  assert.equal(plain.report.notes.some((n) => n.code.startsWith('compose.emphasis.')), false);

  // A brief whose only inks are the slot's own ink: nothing to set the emphasis in.
  const bare = { houseRules: BRIEF.houseRules, themes: [{ name: 'light', semantic: { primary: '#102a43', text: '#102a43' } }], combinations: { from: 'derived', pairs: [] } };
  const none = compose({ slides: [{ archetype: 'content', source: 1, notes: null, slots: { title: { from: 'h1', join: ': ', weight: '500' }, body: null } }] }, ctx({ brief: bare }));
  assert.equal(byId(none.document.boxes, 's01.title').text, '**Tides**: Are we **drifting** past the harbour?');
  assert.ok(none.report.notes.some((n) => n.code === 'compose.emphasis.no-accent' && /headline-medium/.test(n.message)));
});

test('E15: a text set bold all through has no emphasis, so no accent is looked for and no note is written', () => {
  // A statement whose every word is bold: that is the source's type, which the slot sets.
  const inv = inventory();
  inv.slides[0]!.text.push({ objectId: 'b1', role: 'body', class: 'body', box: { x: 0.1, y: 0.7, width: 0.8, height: 0.2 }, paragraphs: [{ runs: [{ text: 'Is the tide turning?', bold: true }] }], plain: 'Is the tide turning?' } as never);
  const bare = { houseRules: BRIEF.houseRules, themes: [{ name: 'light', semantic: { primary: '#102a43', text: '#102a43' } }], combinations: { from: 'derived', pairs: [] } };
  const slide = { archetype: 'content', source: 1, notes: null, slots: { title: { from: 'b1', weight: '500' }, body: null } };
  for (const brief of [bare, BRIEF]) {
    const { document, report, edits } = compose({ slides: [slide] }, ctx({ brief, inventory: inv }));
    assert.equal(byId(document.boxes, 's01.title').text, 'Is the tide turning?');
    assert.deepEqual(report.notes.filter((n) => n.code.startsWith('compose.emphasis.')), []);
    assert.deepEqual(edits.filter((e) => /accent colour/.test(e.reason)), []);
  }
});

test('emphasis and case are refused with a pointer when they are not a mode', () => {
  assert.throws(() => compose({ emphasis: 'loud', slides: [{ archetype: 'content' }] }), /^Error: \/emphasis: expected "accent", "bold" or "keep"/);
  assert.throws(() => compose({ slides: [{ archetype: 'content', case: 'upper' }] }), /\/slides\/0\/case: expected "sentence" or "keep"/);
  assert.throws(() => compose({ slides: [{ archetype: 'visual', slots: { visual: { image: 'a/b', case: 'sentence' } } }] }), /\/slides\/0\/slots\/visual\/case: only text slots take case/);
});

// ─── sentence case ───────────────────────────────────────────────────────────

test('sentence case lowers Title Case words and keeps capitals, inner capitals, first words and markup', () => {
  assert.equal(sentenceCaseDesignText('Ships ROI For Harbours'), 'Ships ROI for harbours');
  assert.equal(sentenceCaseDesignText('Built By Hand. Kept By Choice'), 'Built by hand. Kept by choice');
  assert.equal(sentenceCaseDesignText('Buy An iPhone From SUSE Or McHale'), 'Buy an iPhone from SUSE or McHale');
  assert.equal(sentenceCaseDesignText('Harbour Tide-Line, And I Know It'), 'Harbour tide-line, and I know it');
  assert.equal(sentenceCaseDesignText('{#2346d8|Big} Tides **Rise** Here\n1. First Item'), '{#2346d8|Big} tides **rise** here\n1. First item');
  assert.equal(sentenceCaseDesignText('Q3 Plans For 2026'), 'Q3 plans for 2026');
  // The known limit: a proper noun in Title Case is lowered too, which is why this is opt-in.
  assert.equal(sentenceCaseDesignText('Ships From Europe'), 'Ships from europe');
});

test('case: sentence is opt-in on the spec, the slide or the slot, and each change is an edit with its result', () => {
  const words = 'Three Tides Of The Year';
  const unset = compose({ slides: [{ archetype: 'content', slots: { title: words, body: null } }] });
  assert.equal(byId(unset.document.boxes, 's01.title').text, words, 'never the default');
  assert.deepEqual(unset.edits, []);

  const { document, report, edits } = compose({
    case: 'sentence',
    slides: [
      { archetype: 'content', source: 2, notes: null, slots: { title: { from: 'h2', join: ': ' }, body: { text: 'Maren Holt', case: 'keep' } } },
      { archetype: 'content', case: 'keep', slots: { title: words, body: { text: 'Spring Tide Notes', case: 'sentence' } } },
    ],
  });
  assert.equal(byId(document.boxes, 's01.title').text, 'Agenda: three tides of the year');
  assert.equal(byId(document.boxes, 's01.body').text, 'Maren Holt', 'a slot keeps its words with case: keep');
  assert.equal(byId(document.boxes, 's02.title').text, words, 'a slide keeps its words with case: keep');
  assert.equal(byId(document.boxes, 's02.body').text, 'Spring tide notes');
  const cased = edits.filter((e) => e.reason === 'Set in sentence case (case: sentence).');
  // The joined line's edit gives the source line the case changed (plan 291 M4); "Agenda:" kept its words.
  assert.deepEqual(cased.map((e) => [e.source, e.result]), [
    ['Three Tides Of The Year', 'three tides of the year'],
    ['Spring Tide Notes', 'Spring tide notes'],
  ]);
  assert.deepEqual(report.notes.filter((n) => n.code === 'compose.case.sentence').map((n) => n.path), ['/slides/0/slots/title', '/slides/1/slots/body']);
});

test('sentence case keeps I in its contractions and acronyms joined by & . / or +', () => {
  assert.equal(sentenceCaseDesignText("Why I'm Here And I've Stayed"), "Why I'm here and I've stayed");
  assert.equal(sentenceCaseDesignText('Then I’ll Go, I’d Say'), 'Then I’ll go, I’d say');
  assert.equal(sentenceCaseDesignText('Our R&D Budget Grows'), 'Our R&D budget grows');
  assert.equal(sentenceCaseDesignText('Ask Q&A Here'), 'Ask Q&A here');
  assert.equal(sentenceCaseDesignText('Talk To AT&T Now'), 'Talk to AT&T now');
  assert.equal(sentenceCaseDesignText('We Use C++ Daily'), 'We use C++ daily');
  assert.equal(sentenceCaseDesignText('Read The I/O Notes'), 'Read the I/O notes');
  // The dot of a dotted acronym ends no sentence; a dot after a word still does.
  assert.equal(sentenceCaseDesignText('The U.S. Market Today'), 'The U.S. market today');
  assert.equal(sentenceCaseDesignText('Grew 3.5 Times. Then Fell'), 'Grew 3.5 times. Then fell');
  // A joined pair with a lower-case letter is two ordinary words.
  assert.equal(sentenceCaseDesignText('Use And/Or Here'), 'Use and/or here');
});

test('an italic style sets a source text whose * and _ are literal characters', () => {
  const inv = inventory();
  inv.slides[0]!.text.push({ objectId: 'lit', role: 'title', class: 'title', box: { x: 0.1, y: 0.4, width: 0.8, height: 0.2 }, paragraphs: [{ runs: [{ text: 'A star*ry_night sky' }] }], plain: 'A star*ry_night sky' } as never);
  const { document } = compose({ slides: [{ archetype: 'content', source: 1, notes: null, slots: { title: { from: 'lit', $style: { italic: true } }, body: null } }] }, ctx({ inventory: inv }));
  const text = String(byId(document.boxes, 's01.title').text);
  assert.equal(text, '*A star\\*ry\\_night sky*');
  assert.equal(plainOfDesignText(text), 'A star*ry_night sky');
  // Real emphasis markup in the text is still refused.
  assert.throws(() => compose({ slides: [{ archetype: 'content', slots: { title: { text: 'A *bright* sky', $style: { italic: true } }, body: null } }] }),
    /\/slides\/0\/slots\/title\/\$style: an italic style cannot set text that already carries \* or _ markup/);
});

test('the edits compose writes check clean: sentence case and accent emphasis are declared and leave no unused edit', () => {
  const inv = inventory();
  const { document, edits } = compose({
    case: 'sentence',
    slides: [
      { archetype: 'content', source: 1, notes: null, slots: { title: { from: 'h1', join: ': ', weight: '500' }, body: { from: 'n1', case: 'keep' } } },
      { archetype: 'content', source: 2, notes: null, slots: { title: { from: 'h2', join: ': ' }, body: null } },
    ],
  }, ctx({ brief: BRIEF, inventory: inv }));
  // Both forms are recorded as edits with their result, as E15 and case: sentence ask.
  assert.ok(edits.some((e) => /accent colour/.test(e.reason)), 'the emphasis edit is listed');
  assert.ok(edits.some((e) => e.reason === 'Set in sentence case (case: sentence).'), 'the sentence case edit is listed');
  // `lolly check --source --edits` with that list: nothing missing, and no edit reported unused.
  const r = checkFidelity(inv, document.boxes, { edits, notes: false });
  assert.deepEqual(r.fidelity.missingStrings, []);
  assert.deepEqual(r.findings.filter((f) => f.code === 'fidelity.edit.unmatched').map((f) => f.evidence?.source), []);
  // An edit that changes words still has to match: one that matches nothing is still reported.
  const stale = checkFidelity(inv, document.boxes, { edits: [...edits, { source: 'A line the deck never had', result: 'Another line', reason: 'Stale' }], notes: false });
  assert.deepEqual(stale.findings.filter((f) => f.code === 'fidelity.edit.unmatched').map((f) => f.evidence?.source), ['A line the deck never had']);
});
