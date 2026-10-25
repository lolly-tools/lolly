// SPDX-License-Identifier: MPL-2.0
/**
 * issue-model.ts: the Settings Design system tab's read of a design system,
 * pinned against the two shipped fixtures (Lolly Demo and the lolly-start
 * starter) so its counts, looks, faces, logos and colourways are the real ones.
 * Run directly:  node --test shells/web/src/lib/design-system/issue-model.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readIssue, standfirstOf } from './issue-model.ts';
import { docPalette } from './preview.ts';
import { rolePathName } from '../swatches.ts';

const read = (rel: string): Record<string, unknown> => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8')) as Record<string, unknown>;
const DEMO = read('../../../../../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json');
const START = read('../../../../../brands/lolly-start/catalog/assets/lolly/tokens/brand.json');

const issueOf = (doc: unknown, label: string) => readIssue({ doc, palette: docPalette(doc), label, source: 'Came with this app', locked: false });

test('Lolly Demo: 33 named colours, each with an exact ink; its spectrum and 37 role colours stay out of the count', () => {
  const issue = issueOf(DEMO, 'Lolly Demo');
  assert.equal(issue.colours.core.length, 33);
  assert.equal(issue.colours.named.length, 33);
  assert.deepEqual(issue.colours.ramps, []);
  assert.equal(issue.colours.spectrum.length, 8, 'the spectrum is read from the whole palette: its swatches alias brand greens');
  assert.equal(issue.colours.roles.length, 7 + 17 + 7 + 6);
  assert.deepEqual([...new Set(issue.colours.roles.map(c => c.token?.path.split('.')[1]))], ['semantic', 'role', 'chrome', 'colourway']);
  assert.equal(issue.colours.lockedInks, 33);
  assert.equal(issue.facts.colours, 33);
});

test('Lolly Demo: light and dark looks come from each mode\'s semantic slots, named after the colours they use', () => {
  const issue = issueOf(DEMO, 'Lolly Demo');
  assert.equal(issue.looks.light.primary, '#033633');
  assert.equal(issue.looks.dark?.primary, '#50c369');
  assert.equal(issue.primaryHex, '#033633');
  assert.deepEqual(issue.leads.map(l => l.mode), ['light', 'dark']);
  const light = issue.leads[0]!.slots;
  assert.deepEqual(light.map(s => s.role), ['surface', 'text', 'primary', 'secondary']);
  assert.deepEqual(light.map(s => s.hex), ['#ffffff', '#09141a', '#033633', '#008657']);
  assert.deepEqual(light.map(s => s.name), ['Sugar', 'Liquorice', 'Spearmint', 'Bunyapine']);
  assert.equal(light[2]!.note, 'The accent: Spearmint, 13.3:1 with a Sugar label');
  assert.equal(issue.leads[1]!.slots[2]!.name, 'Green Apple');
  assert.deepEqual(issue.facts.modes, ['light', 'dark']);
});

test('Lolly Demo: four type roles over three faces, with their own notes', () => {
  const issue = issueOf(DEMO, 'Lolly Demo');
  assert.deepEqual(issue.fonts.map(f => [f.role, f.family, f.follows]), [
    ['display', 'Outfit', false], ['brand', 'SUSE', false], ['italic', 'SUSE', false], ['mono', 'SUSE Mono', false],
  ]);
  assert.equal(issue.facts.typefaces, 3);
  assert.ok(issue.fonts.some(f => f.note.includes('Outfit has no italics')));
});

test('Lolly Demo: nine logo slots draw seven files, horizontal forms first', () => {
  const issue = issueOf(DEMO, 'Lolly Demo');
  assert.equal(issue.facts.logos, 7);
  assert.equal(issue.logos.length, 7);
  assert.equal(issue.logos.flatMap(l => l.variants).length, 9);
  assert.deepEqual(issue.logos.slice(0, 3).map(l => [l.id, l.ground]), [
    ['lolly/logo/horizontal', 'surface-light'],
    ['lolly/logo/horizontal-reverse', 'surface-dark'],
    ['lolly/logo/horizontal-on-brand', 'primary'],
  ]);
  assert.deepEqual(issue.logos[0]!.variants, ['Horizontal primary', 'Horizontal mono']);
  assert.ok(issue.logos.slice(3).every(l => l.variants.every(v => v.startsWith('Vertical'))));
});

test('Lolly Demo: six colourways in order, Spearmint canonical', () => {
  const issue = issueOf(DEMO, 'Lolly Demo');
  assert.deepEqual(issue.colourways.map(l => l.name), ['Spearmint', 'Morning', 'Spring', 'Beach', 'Afternoon', 'Midnight']);
  assert.equal(issue.colourways[0]!.canonical, true);
  assert.equal(issue.facts.colourways, 6);
});

test('Lolly Demo: the standfirst leads with the first two sentences of its own note and folds the rest', () => {
  const { lead, rest } = issueOf(DEMO, 'Lolly Demo').standfirst;
  assert.equal(lead, "Lolly Demo, Lolly's own design system and the first one built on Lolly. Its palette is Opal: every colour is a treat or a piece of nature, remembered by name and never by number; a tint keeps its parent's name.");
  assert.match(rest, /^Liquorice is the ink/);
  assert.match(rest, /Layered DTCG/, 'the format note sits in the fold');
});

test('lolly-start: one Neutral ramp of nine, four logo files, no named colours and no colourways', () => {
  const issue = issueOf(START, 'Lolly Starter');
  assert.equal(issue.colours.core.length, 9);
  assert.equal(issue.colours.named.length, 0);
  assert.deepEqual(issue.colours.ramps.map(([family, steps]) => [family, steps.length]), [['Neutral', 9]]);
  assert.equal(issue.colours.spectrum.length, 0);
  assert.equal(issue.colourways.length, 0);
  assert.equal(issue.facts.colourways, 0);
  assert.equal(issue.facts.logos, 4);
  const display = issue.fonts.find(f => f.role === 'display')!;
  assert.equal(display.follows, true, 'no display face, so headings follow the text face');
  assert.equal(display.family, 'SUSE');
  assert.equal(display.note, '');
  assert.equal(issue.facts.typefaces, 2);
  assert.equal(issue.looks.light.primary, '#1d1d1d');
  assert.equal(issue.looks.dark?.primary, '#ffffff');
});

test('a $description is returned as text: markup comes back verbatim for the renderer to escape', () => {
  const doc = { $description: 'Ours. <script>alert(1)</script> A second line.\u0007\u202e Third.' };
  const { lead, rest } = standfirstOf(doc);
  assert.equal(`${lead} ${rest}`.trim().includes('<script>alert(1)</script>'), true);
  assert.equal(['\u0007', '\u202e'].some(ch => (lead + rest).includes(ch)), false, 'control and bidi override characters are removed');
  assert.deepEqual(standfirstOf({}), { lead: '', rest: '' });
  assert.deepEqual(standfirstOf(null), { lead: '', rest: '' });
});

test('a long $description is clamped at a word and a long first sentence is cut before the fold', () => {
  const words = Array.from({ length: 600 }, (_, i) => `word${i}`).join(' ');
  const { lead, rest } = standfirstOf({ $description: words });
  assert.ok(lead.length <= 321 && lead.endsWith('…'));
  assert.ok((lead + rest).length <= 2002);
  assert.ok(rest.endsWith('…'), 'the clamp says the note goes on');
  assert.equal(/word\d+word/.test(rest), false, 'cut between words');
});

test('no named colour takes a description sentence as its label', () => {
  const issue = issueOf(DEMO, 'Lolly Demo');
  // The role colours are labelled by their sentences (a token's name is its
  // description), and the doc and its groups carry notes of their own.
  const sentences = new Set<string>([DEMO.$description as string]);
  for (const c of issue.colours.roles) if (c.token?.description) sentences.add(c.token.description);
  const groupNotes = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const rec = node as Record<string, unknown>;
    if (typeof rec.$description === 'string' && !('$value' in rec)) sentences.add(rec.$description);
    for (const [key, value] of Object.entries(rec)) if (!key.startsWith('$')) groupNotes(value);
  };
  groupNotes(DEMO);
  assert.ok(sentences.size > 30);
  for (const c of issue.colours.named) assert.equal(sentences.has(c.label), false, `${c.label} is a name, not a note`);
});

test('rolePathName names a role row from its path', () => {
  assert.equal(rolePathName('color.semantic.on-primary'), 'On primary');
  assert.equal(rolePathName('color.chrome.edge'), 'Chrome edge');
  assert.equal(rolePathName('color.role.slide-title'), 'Slide title');
});

test('a doc that is not a design system reads as an empty issue, never a throw', () => {
  for (const doc of [null, 'nope', 42, [], {}]) {
    const issue = readIssue({ doc, palette: [], label: 'X', source: '', locked: true });
    assert.equal(issue.facts.colours, 0);
    assert.deepEqual(issue.logos, []);
    assert.deepEqual(issue.colourways, []);
    assert.match(issue.primaryHex, /^#[0-9a-f]{6}$/);
  }
});
