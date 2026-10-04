// SPDX-License-Identifier: MPL-2.0
/**
 * Plan 291 M4, closing what the M3 close-out left open in compose and suggest:
 * the neutral master's main-point in a dark deck, whitespace on carried slots,
 * speaker notes kept as paragraphs, edits recorded against the source's lines,
 * a slot joined from several objects, the logo over a pale photo, and the
 * suggestion priors the second judge and subject b2 reported.
 *
 * Public: the neutral master and invented copy only.
 * Run with: node --import ./tests/css-stub.mjs --test tests/design-compose-closeout.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { ContentInventoryV1, DesignComposeSpecV1 } from '../packages/core/src/index.ts';
import { composeDesignSlides, type DesignComposeContext } from '../engine/src/design-compose.ts';
import { buildDeckTheme } from '../engine/src/rebrand-theme.ts';
import { neutralSlideMaster, themedColors } from '../engine/src/rebrand-design-system.ts';
import { bgIsDark } from '../engine/src/logo-variant.ts';

type Row = Record<string, unknown>;

/** A design system shaped like tests/fixtures/recreate/tokens.json: one neutral ramp step that the dark mode leaves light. */
const LIGHT: Record<string, string> = {
  'color.ramp.grey.2': '#3a3a3a', 'color.ramp.grey.7': '#d9d9d9', 'color.ramp.neutral.8': '#eef1f4',
  'color.semantic.primary': '#13294b', 'color.semantic.secondary': '#2fb8ac', 'color.semantic.surface': '#ffffff',
  'color.semantic.text': '#13294b', 'color.semantic.muted': '#3a3a3a', 'color.semantic.edge': '#d9d9d9',
};
const DARK: Record<string, string> = {
  ...LIGHT,
  'color.semantic.primary': '#2fb8ac', 'color.semantic.secondary': '#f3e9d2', 'color.semantic.surface': '#13294b',
  'color.semantic.text': '#ffffff', 'color.semantic.muted': '#d9d9d9', 'color.semantic.edge': '#3a3a3a',
};

const ctx = (over: Partial<DesignComposeContext> = {}): DesignComposeContext => ({
  master: neutralSlideMaster(),
  masterOrigin: 'neutral',
  resolveToken: (p) => LIGHT[p],
  themeColors: { colors: LIGHT, darkColors: DARK },
  ...over,
});
const compose = (spec: unknown, c: DesignComposeContext = ctx()) => composeDesignSlides(spec as DesignComposeSpecV1, c);
const byId = (boxes: Row[], id: string): Row => {
  const row = boxes.find((r) => r.id === id);
  assert.ok(row, `row ${id} is composed`);
  return row;
};

// ─── main-point in a dark deck ───────────────────────────────────────────────

test('themedColors gives a master ground the dark mode leaves light (a neutral ramp step) a dark counterpart', () => {
  const source = { colors: LIGHT, darkColors: DARK, master: neutralSlideMaster() };
  const choice = buildDeckTheme('dark', source);
  assert.ok(choice);
  const themed = themedColors(source, choice.theme);
  const ground = themed.colors['color.ramp.neutral.8'];
  assert.ok(ground && bgIsDark(ground), `main-point's ground reads dark in the Dark theme (got ${ground})`);
  assert.equal(ground, '#13294b', 'with no darker step on its ramp, it takes the mode\'s surface');
  const mainPoint = themed.master.archetypes.find((a) => a.id === 'main-point');
  assert.equal(mainPoint?.background?.dark, true);
  // The light theme is untouched.
  const light = themedColors(source, buildDeckTheme('light', source)?.theme);
  assert.equal(light.colors['color.ramp.neutral.8'], '#eef1f4');
});

test('a --file design system with a dark mode draws main-point dark in a dark deck (compose.dark.themed)', () => {
  const { document, report } = compose({ theme: 'dark', slides: [{ archetype: 'main-point', slots: { title: 'One statement', subtitle: null } }] });
  const frame = byId(document.boxes, 's01');
  assert.ok(typeof frame.bg === 'string' && bgIsDark(frame.bg), `the frame is dark (bg ${String(frame.bg)})`);
  assert.equal(report.slides[0]!.ground, 'dark');
  assert.ok(report.notes.some((n) => n.code === 'compose.dark.themed'));
  assert.ok(!report.notes.some((n) => n.code === 'compose.dark.none'));
  const title = byId(document.boxes, 's01.title');
  assert.ok(typeof title.fg === 'string' && !bgIsDark(title.fg), `the statement is set in light ink (fg ${String(title.fg)})`);
});

// ─── an inventory of invented copy ───────────────────────────────────────────

type Para = { runs: Array<{ text: string; bold?: boolean }> };
const box = { x: 0.1, y: 0.1, width: 0.8, height: 0.2 };
const textObj = (objectId: string, role: string, paragraphs: Para[], extra: Row = {}): Row => ({
  objectId, role, class: role, box, paragraphs, plain: paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n'), ...extra,
});
function inventory(slides: Array<{ text: Row[]; notes?: Array<{ lines: string[] }> }>): ContentInventoryV1 {
  return {
    version: 'lolly/content-inventory-v1',
    source: { name: 'invented.pptx', sha256: 'e'.repeat(64), bytes: 1000, kind: 'pptx', slides: slides.length, width: 960, height: 540 },
    slides: slides.map((s, i) => ({
      number: i + 1, id: `slide${i + 1}`, text: s.text,
      notes: s.notes ? { text: s.notes.flatMap((p) => p.lines).join('\n'), paragraphs: s.notes } : null,
      pictures: [], tables: [], charts: [], objects: [],
    })),
    media: [],
    warnings: [],
  } as unknown as ContentInventoryV1;
}

// ─── speaker notes keep their paragraphs ─────────────────────────────────────

test('notes copied from the source separate paragraphs with a blank line, so a line break stays inside its paragraph', () => {
  const inv = inventory([{
    text: [textObj('h1', 'title', [{ runs: [{ text: 'Harbour tides' }] }])],
    notes: [{ lines: ['OPENING', 'Welcome the crews.', '', 'TIMING', 'Two minutes.'] }, { lines: ['Photo: free to reuse.'] }],
  }]);
  const { document } = compose({ slides: [{ archetype: 'section', source: 1, slots: { title: { from: 'h1' } } }] }, ctx({ inventory: inv }));
  const notes = String(byId(document.boxes, 's01').notes);
  assert.ok(notes.includes('OPENING\nWelcome the crews.'), 'a line break inside a paragraph is one newline');
  assert.ok(notes.endsWith('Two minutes.\n\nPhoto: free to reuse.'), 'paragraphs are a blank line apart');
  // The blank line inside the first paragraph is a line of one no-break space, so it is
  // not read as a paragraph break (the PPTX writer turns it back into two a:br).
  assert.ok(notes.startsWith('OPENING\nWelcome the crews.\n\u00a0\nTIMING\nTwo minutes.\n\n'), JSON.stringify(notes));
  assert.equal(notes.split('\n\n').length, 2, 'two paragraphs, as the source has');
});

// ─── whitespace on a carried slot ────────────────────────────────────────────

test('a carried or joined slot loses trailing spaces and blank lines at its ends', () => {
  const inv = inventory([{
    text: [
      textObj('h1', 'title', [{ runs: [{ text: 'Are you ' }, { text: 'charting', bold: true }, { text: ' \nyour own course? ' }] }, { runs: [{ text: ' ' }] }]),
      textObj('n1', 'body', [{ runs: [{ text: '\nCrews first.  ' }] }]),
    ],
  }]);
  const { document } = compose({ slides: [{ archetype: 'section', source: 1, notes: null, emphasis: 'bold', slots: { title: { from: 'h1' }, subtitle: { from: 'n1' } } }] }, ctx({ inventory: inv }));
  const title = String(byId(document.boxes, 's01.title').text);
  assert.doesNotMatch(title, /[ \t]\n|\s$/, `no space before a break and nothing trailing (${JSON.stringify(title)})`);
  assert.match(title, /^Are you /);
  assert.equal(byId(document.boxes, 's01.subtitle').text, 'Crews first.');
});

// ─── edits against the source's lines ────────────────────────────────────────

import { checkFidelity } from '../engine/src/check-fidelity.ts';

const twoLineHeading = (): ContentInventoryV1 => inventory([{
  text: [
    textObj('h1', 'title', [{ runs: [{ text: 'Tides' }] }, { runs: [{ text: 'Are We Charting Our Own Course?' }] }]),
    textObj('t1', 'title', [{ runs: [{ text: '3 Main Crossings' }] }]),
  ],
}, {
  text: [textObj('h2', 'title', [{ runs: [{ text: '3 Main Crossings' }] }])],
}]);

test('sentence case on a joined slot is recorded against the source lines it changed, so check uses every edit', () => {
  const inv = twoLineHeading();
  const { document, edits } = compose({
    slides: [{ archetype: 'section', source: 1, notes: null, case: 'sentence', slots: { title: { from: 'h1', join: ': ' }, subtitle: { from: 't1' } } }],
  }, ctx({ inventory: inv }));
  assert.equal(byId(document.boxes, 's01.title').text, 'Tides: are we charting our own course?');
  const lines = new Set(inv.slides[0]!.text.flatMap((t) => t.plain.split('\n')));
  for (const e of edits) assert.ok(lines.has(e.source), `edit source "${e.source}" is a line of the source`);
  assert.ok(edits.some((e) => e.source === 'Are We Charting Our Own Course?' && e.result === 'are we charting our own course?'), 'the result is that line as the slot now reads it');
  assert.ok(!edits.some((e) => e.source === 'Tides'), 'a line the case left alone is not an edit');
  const sub = { ...inv, slides: [inv.slides[0]!] };
  const report = checkFidelity(sub, document.boxes, { notes: false, edits });
  assert.deepEqual(report.findings.filter((f) => f.code === 'fidelity.edit.unmatched').map((f) => f.evidence), []);
});

test('a slot given new words in place of its source text records the source as replaced, with the result', () => {
  const inv = twoLineHeading();
  const { edits } = compose({ slides: [{ archetype: 'section', source: 2, notes: null, slots: { title: 'Three crossings', subtitle: null } }] }, ctx({ inventory: inv }));
  const hit = edits.find((e) => e.source === '3 Main Crossings');
  assert.ok(hit, 'the replaced title is an edit');
  assert.equal(hit.result, 'Three crossings');
  assert.doesNotMatch(hit.reason, /Left out/);
});

// ─── one slot joined from several objects ────────────────────────────────────

test('from takes a list of objects, so an eyebrow set as its own object folds into the heading with join', () => {
  const inv = inventory([{
    text: [
      textObj('e1', 'subtitle', [{ runs: [{ text: 'WHY TIDES MATTER' }] }]),
      textObj('h1', 'title', [{ runs: [{ text: 'Every crossing starts with a timetable' }] }]),
    ],
  }]);
  const { document } = compose({ slides: [{ archetype: 'section', source: 1, notes: null, slots: { title: { from: ['e1', 'h1'], join: ': ' }, subtitle: null } }] }, ctx({ inventory: inv }));
  assert.equal(byId(document.boxes, 's01.title').text, 'WHY TIDES MATTER: Every crossing starts with a timetable');
  // Without join the objects stay lines of their own, in the order given.
  const kept = compose({ slides: [{ archetype: 'section', source: 1, notes: null, slots: { title: { from: ['e1', 'h1'] }, subtitle: null } }] }, ctx({ inventory: inv }));
  assert.equal(byId(kept.document.boxes, 's01.title').text, 'WHY TIDES MATTER\nEvery crossing starts with a timetable');
  assert.throws(() => compose({ slides: [{ archetype: 'section', source: 1, slots: { title: { from: ['e1', 'h1'], para: 0 } } }] }, ctx({ inventory: inv })), /\/slides\/0\/slots\/title\/para: para picks a paragraph of one object/);
  assert.throws(() => compose({ slides: [{ archetype: 'section', source: 1, slots: { title: { from: ['e1', 'nope'] } } }] }, ctx({ inventory: inv })), /\/slides\/0\/slots\/title\/from\/1: the inventory has no text or picture "nope"/);
  assert.throws(() => compose({ slides: [{ archetype: 'section', source: 1, slots: { title: { from: [] } } }] }, ctx({ inventory: inv })), /\/slides\/0\/slots\/title\/from: expected an inventory object id/);
});

// ─── logo: auto over a pale photograph ───────────────────────────────────────

const MARKS = { onLight: 'test/logo/pos', onDark: 'test/logo/neg', monoOnLight: 'test/logo/pos-mono', monoOnDark: 'test/logo/neg-mono' };
const INKS: Record<string, string[]> = {
  'test/logo/pos': ['#13294b'], 'test/logo/pos-mono': ['#000000'],
  'test/logo/neg': ['#ffffff'], 'test/logo/neg-mono': ['#ffffff'],
};
const photoSlide = { archetype: 'main-point', slots: { title: 'One statement', subtitle: null }, under: [{ kind: 'image', image: 'photo:pale', x: 0, y: 0, w: 1920, h: 1080, fit: 'cover' }] };
/** A photograph whose luminance under any box is this low and high (20th and 80th percentiles). */
const photo = (low: number, high: number): DesignComposeContext['photoSurface'] => ({ luminanceUnder: () => ({ low, high }), inks: INKS });
const logoOf = (boxes: Row[]): Row | undefined => boxes.find((r) => r.frame === 's01' && typeof r.furniture === 'string' && typeof r.image === 'string');

test('logo: auto over a dark photo keeps the on-photo mark when it reaches 3:1 there', () => {
  const { document, report } = compose({ slides: [photoSlide] }, ctx({ logos: MARKS, photoSurface: photo(0.02, 0.06) }));
  assert.equal(logoOf(document.boxes)?.image, 'test/logo/neg-mono');
  assert.ok(!report.notes.some((n) => n.code === 'compose.logo.photo-contrast'));
});

test('logo: auto over a pale photo takes a legal mark that reaches 3:1, or leaves the logo off with a note', () => {
  // No logo-surface rule: any of the marks may sit on a photograph, so the dark one is taken.
  const free = compose({ slides: [photoSlide] }, ctx({ logos: MARKS, photoSurface: photo(0.38, 0.45) }));
  assert.equal(logoOf(free.document.boxes)?.image, 'test/logo/pos');
  // The brand allows only the negative mark on photography: neither negative mark reaches 3:1 on 0.41.
  const brief = { logos: { rules: [{ ruleId: 'logo-on-photo', parameters: { photo: ['test/logo/neg', 'test/logo/neg-mono'] } }] } };
  const ruled = compose({ slides: [photoSlide] }, ctx({ logos: MARKS, brief, photoSurface: photo(0.38, 0.45) }));
  assert.equal(logoOf(ruled.document.boxes), undefined, 'the logo is left off');
  const note = ruled.report.notes.find((n) => n.code === 'compose.logo.photo-contrast');
  assert.ok(note, 'and the report says why');
  assert.equal(note.path, '/slides/0/furniture');
  assert.match(note.message, /3:1/);
  assert.ok(!ruled.report.slides[0]!.furniture.some((f) => /logo/.test(f)));
  // Without a measurement compose keeps today's pick.
  const unmeasured = compose({ slides: [photoSlide] }, ctx({ logos: MARKS, brief }));
  assert.equal(logoOf(unmeasured.document.boxes)?.image, 'test/logo/neg-mono');
});

test('a legal mark whose colours are not known keeps the logo on: only marks all measured too faint are left off', () => {
  const brief = { logos: { rules: [{ ruleId: 'logo-on-photo', parameters: { photo: ['test/logo/neg', 'test/logo/neg-mono'] } }] } };
  const partial = { luminanceUnder: () => ({ low: 0.38, high: 0.45 }), inks: { 'test/logo/neg': ['#ffffff'] } };
  const { document, report } = compose({ slides: [photoSlide] }, ctx({ logos: MARKS, brief, photoSurface: partial }));
  assert.equal(logoOf(document.boxes)?.image, 'test/logo/neg-mono');
  assert.ok(!report.notes.some((n) => n.code === 'compose.logo.photo-contrast'));
});

// ─── a divider's place ───────────────────────────────────────────────────────

import { expandDesignAuthoring } from '../engine/src/design-authoring.ts';

test('a divider key its macro does not read is refused with a pointer to the one that moves it', () => {
  const frame = { id: 'f', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080 };
  const table = (divider: Record<string, unknown>) => [frame, { id: 't', $in: 'f', $table: { x: 100, y: 100, pitch: 130, divider: { id: 'd{i}', stroke: '#cccccc', ...divider }, columns: [{ kind: 'text', slot: 'c', w: 400 }], rows: [['a'], ['b']] } }];
  assert.throws(() => expandDesignAuthoring(table({ y: 20 })), /\/1\/\$table\/divider\/y: .*dy/);
  assert.throws(() => expandDesignAuthoring(table({ dx: 4 })), /\/1\/\$table\/divider\/dx: /);
  // dy moves it down from each row's top, as before.
  const r = expandDesignAuthoring(table({ dy: 20 }));
  const rule = r.rows.find((row) => row.id === 'd1')!;
  assert.ok(rule, 'the second row has a divider');
  const stack = (divider: Record<string, unknown>, axis = 'y') => [frame, { id: 's', $in: 'f', $stack: { x: 0, y: 0, w: 300, h: 200, pitch: 100, axis, divider: { id: 'd{i}', ...divider }, item: [{ kind: 'text', slot: 't', w: 200 }], items: ['a', 'b'] } }];
  assert.throws(() => expandDesignAuthoring(stack({ y: 5 })), /\/1\/\$stack\/divider\/y: .*dy/);
  assert.throws(() => expandDesignAuthoring(stack({ x: 5 }, 'x')), /\/1\/\$stack\/divider\/x: .*dx/);
  assert.doesNotThrow(() => expandDesignAuthoring(stack({ y: 5 }, 'x')));
});

// ─── a table slot filled with its rows ───────────────────────────────────────

test('a table slot takes a $table: its rows are set out in the slot\'s box and the slot counts as filled', () => {
  const $table = { pitch: 60, columns: [{ id: 's01.data-r{r}-c0', kind: 'text', x: 0, y: 0, w: 300, h: 50 }, { id: 's01.data-r{r}-c1', kind: 'text', x: 320, y: 0, w: 300, h: 50 }], rows: [['Stage', 'Crew'], ['Board', 'Pilots']] };
  const { document, report } = compose({ slides: [{ archetype: 'table', slots: { title: 'Who holds each stage', data: { $table } } }] });
  const seeded = composeDesignSlides({ slides: [{ archetype: 'table', slots: { title: 'x', data: 'y' } }] } as DesignComposeSpecV1, ctx()).document.boxes.find((r) => r.id === 's01.data')!;
  const first = byId(document.boxes, 's01.data-r0-c0');
  assert.equal(first.text, 'Stage');
  assert.equal(first.x, seeded.x, 'the table starts at the slot box');
  assert.equal(first.y, seeded.y);
  assert.equal(byId(document.boxes, 's01.data-r1-c1').text, 'Pilots');
  assert.ok(!document.boxes.some((r) => r.id === 's01.data'), 'the slot\'s own text row is not drawn');
  assert.ok(report.slides[0]!.filled.includes('data'));
  assert.ok(!report.slides[0]!.dropped.includes('data'));
  assert.throws(() => compose({ slides: [{ archetype: 'table', slots: { title: 'x', data: { $table, fg: '#000000' } } }] }), /\/slides\/0\/slots\/data\/fg: a table slot given a \$table/);
  assert.throws(() => compose({ slides: [{ archetype: 'content', slots: { title: 'x', body: { $table } } }] }), /\/slides\/0\/slots\/body\/\$table: slot "body" holds text/);
  assert.throws(() => compose({ slides: [{ archetype: 'table', slots: { title: 'x', data: { $table: { pitch: 'x', columns: [], rows: [] } } } }] }), /\/slides\/0\/slots\/data\/\$table/);
});

test('para takes a list, so one text object set at two sizes fills a title and a subtitle', () => {
  const inv = inventory([{
    text: [textObj('h1', 'title', [{ runs: [{ text: 'Are you charting your course?' }] }, { runs: [{ text: 'Harbour Offers' }] }, { runs: [{ text: 'Charts for every crew' }] }])],
  }]);
  const { document } = compose({ slides: [{ archetype: 'section', source: 1, notes: null, slots: { title: { from: 'h1', para: 0 }, subtitle: { from: 'h1', para: [1, 2] } } }] }, ctx({ inventory: inv }));
  assert.equal(byId(document.boxes, 's01.title').text, 'Are you charting your course?');
  assert.equal(byId(document.boxes, 's01.subtitle').text, 'Harbour Offers\nCharts for every crew');
  for (const bad of [[], [0, 0], [3], [-1], ['1']]) {
    assert.throws(() => compose({ slides: [{ archetype: 'section', source: 1, slots: { title: { from: 'h1', para: bad } } }] }, ctx({ inventory: inv })), /\/slides\/0\/slots\/title\/para/);
  }
});

// ─── suggest ─────────────────────────────────────────────────────────────────

import { suggestComposeSlides } from '../engine/src/design-compose-suggest.ts';

type Runs = Array<{ text: string; size?: number; bold?: boolean }>;
const sized = (objectId: string, role: string, box: [number, number, number, number], paras: Runs[]): Row => ({
  objectId, role, class: role, box: { x: box[0], y: box[1], width: box[2], height: box[3] },
  paragraphs: paras.map((runs) => ({ runs })),
  plain: paras.map((runs) => runs.map((r) => r.text).join('')).join('\n'),
});
const photoPic = (objectId: string, sha: string): Row => ({ objectId, ref: `user/media/${sha}`, sha256: sha, mime: 'image/jpeg', bytes: 1000, width: 2048, height: 1366, box: { x: 0, y: 0, width: 1, height: 1 }, kind: 'photo', class: 'unknown' });
function deck(slides: Array<{ text: Row[]; pictures?: Row[] }>): ContentInventoryV1 {
  const inv = inventory(slides.map((s) => ({ text: s.text })));
  inv.slides.forEach((slide, k) => { (slide as { pictures: unknown[] }).pictures = slides[k]!.pictures ?? []; });
  return inv;
}
const middle = (n: number): { text: Row[] } => ({ text: [sized(`m${n}`, 'title', [0.06, 0.08, 0.88, 0.1], [[{ text: `Middle ${n}`, size: 32 }]])] });

test('suggest: a closing heading set at two sizes fills the title and the subtitle, and its tagline the caption', () => {
  const heading = sized('h', 'title', [0.05, 0.12, 0.43, 0.76], [
    [{ text: 'Are you ', size: 40 }, { text: 'charting', size: 40, bold: true }, { text: '\n' }, { text: 'your own course?', size: 40 }],
    [{ text: 'Harbour Offers ', size: 27 }, { text: '\n' }, { text: 'Charts for every crew', size: 27 }],
    [{ text: 'And crews for every chart', size: 27 }],
  ]);
  const tagline = sized('t', 'body', [0.62, 0.87, 0.39, 0.08], [[{ text: 'Open by habit, safe by design', size: 16 }]]);
  const inv = deck([middle(1), middle(2), { text: [heading, tagline], pictures: [photoPic('p', 'c'.repeat(64))] }]);
  const { spec, reasons } = suggestComposeSlides({ census: null, source: null, inventory: inv }, neutralSlideMaster());
  const s = spec.slides[2]!;
  assert.equal(s.archetype, 'closing-thanks');
  assert.deepEqual(s.slots?.title, { from: 'h', para: 0 });
  // Plan 291 M4: three hand-broken lines are more than the two-line subtitle holds, so they run into one.
  assert.deepEqual(s.slots?.subtitle, { from: 'h', para: [1, 2], join: ' ' });
  assert.deepEqual(s.slots?.caption, { from: 't' });
  assert.match(reasons[2]!.why, /set at two sizes/);
  assert.match(reasons[2]!.why, /run into one \(join\)/);
  const composed = compose(spec, ctx({ inventory: inv }));
  assert.equal(byId(composed.document.boxes, 's03.title').text, 'Are you charting\nyour own course?');
  assert.equal(byId(composed.document.boxes, 's03.subtitle').text, 'Harbour Offers Charts for every crew And crews for every chart');
  assert.deepEqual(composed.edits, []);
});

test('suggest: a role line under the speaker\'s name joins the subtitle, not a loose row at its source position', () => {
  const title = sized('h', 'title', [0.05, 0.3, 0.6, 0.2], [[{ text: 'Harbour lights', size: 44 }]]);
  const name = sized('n', 'body', [0.72, 0.72, 0.32, 0.12], [[{ text: 'Robin Vale', size: 28 }]]);
  const role = sized('r', 'body', [0.66, 0.87, 0.35, 0.08], [[{ text: 'Head of Tidal Operations', size: 16 }]]);
  const inv = deck([{ text: [title, name, role], pictures: [photoPic('p', 'a'.repeat(64))] }, middle(2), middle(3)]);
  const { spec } = suggestComposeSlides({ census: null, source: null, inventory: inv }, neutralSlideMaster());
  const s = spec.slides[0]!;
  assert.equal(s.archetype, 'title');
  assert.deepEqual(s.slots?.subtitle, { from: ['n', 'r'] });
  assert.equal(s.over, undefined, 'no loose row at the source position');
  const composed = compose(spec, ctx({ inventory: inv }));
  assert.equal(byId(composed.document.boxes, 's01.subtitle').text, 'Robin Vale\nHead of Tidal Operations');
});

test('suggest: one short line set large over a full-bleed photo mid deck is a statement over the photo', () => {
  const line = sized('q', 'body', [0.04, 0.68, 0.62, 0.19], [[{ text: 'Are we ready?', size: 50, bold: true }]]);
  const inv = deck([middle(1), { text: [line], pictures: [photoPic('p', 'b'.repeat(64))] }, middle(3)]);
  const { spec, reasons } = suggestComposeSlides({ census: null, source: null, inventory: inv }, neutralSlideMaster());
  const s = spec.slides[1]!;
  assert.equal(s.archetype, 'main-point');
  assert.deepEqual(s.slots?.title, { from: 'q' });
  assert.equal((s.under?.[0] as Row | undefined)?.image, 'photo:bbbbbbbbbbbb');
  assert.match(reasons[1]!.why, /statement over the photograph/);
});
