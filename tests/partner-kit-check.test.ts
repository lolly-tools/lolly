// SPDX-License-Identifier: MPL-2.0
/**
 * Guest-mark checks (Lolly Work plan 82 M8): a Design document's partner marks against the
 * kit's minimum size, clear space and treatments. Findings are reviews, never refusals, and
 * carry no automatic fix. The same reading feeds the app, `lolly check --kit` and Work.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkGuestMarks, guestRecolourFrom, guestUnmeasuredText } from '../engine/src/partner-kit-check.ts';
import { checkFindingFromBrand } from '../engine/src/design-check.ts';
import { checkFile } from '../packages/node-shell/src/check.ts';
import type { PartnerKitV1 } from '../packages/core/src/partner-kit-v1.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { normaliseDesignColourRefs } from '../engine/src/token-block-bindings.ts';
import type { InputValue } from '../engine/src/inputs.ts';

const LOGO = 'inst/3f9cQm-x';
const MARK = 'inst/c07e';

function kit(rules: PartnerKitV1['rules']): PartnerKitV1 {
  return {
    schemaVersion: 1,
    id: 'northwind-it',
    label: 'Northwind IT',
    logos: { light: { id: LOGO, version: 2 }, mark: { id: MARK, version: 1 } },
    colours: [],
    ...(rules ? { rules } : {}),
  };
}

const SIZE = kit({ minSize: { px: 96, mm: 20 } });
const SPACE = kit({ clearSpace: { value: 0.5, unit: 'mark-height' } });

// A mark drawn to fill its box, so it is placed exactly without the logo's proportions;
// the tests of a contained logo say `fit: 'contain'`.
const markBox = (extra: Record<string, unknown> = {}): Record<string, unknown> =>
  ({ id: 'logo', kind: 'image', name: 'Northwind logo', image: LOGO, fit: 'fill', x: 100, y: 100, w: 200, h: 48, ...extra });

test('guest marks: a mark below the kit\'s minimum size is named, in the kit\'s words', () => {
  const report = checkGuestMarks([markBox()], SIZE);
  assert.equal(report.findings.length, 1);
  const f = report.findings[0]!;
  assert.equal(f.message, "Northwind IT's mark is 48 px high; the kit asks for at least 96 px.");
  assert.deepEqual({ kind: f.kind, status: f.status, rule: f.rule, layerId: f.layerId, value: f.value, expected: f.expected, company: f.company },
    { kind: 'mark', status: 'review', rule: 'min-size', layerId: 'logo', value: '48 px', expected: '96 px', company: 'Northwind IT' });
  assert.equal(f.fix, undefined, 'sizing a mark is the person\'s call, so there is no automatic fix');
  assert.equal(report.checked.marks, 1);
  assert.deepEqual(report.checked.rules, ['min-size']);
});

test('guest marks: scaled back up to the minimum, the finding clears', () => {
  assert.deepEqual(checkGuestMarks([markBox({ h: 96 })], SIZE).findings, []);
});

test('guest marks: a contained wide logo is measured where it is drawn, not by its box', () => {
  const aspect = (id: string) => (id === LOGO ? 4 : null);
  const report = checkGuestMarks([markBox({ w: 300, h: 120, fit: 'contain' })], SIZE, { logoAspect: aspect });
  assert.equal(report.findings[0]?.value, '75 px', '300 wide at 4:1 draws 75 high inside a 120 high box');
  assert.equal(checkGuestMarks([markBox({ w: 300, h: 120, fit: 'cover' })], SIZE, { logoAspect: aspect }).findings.length, 0, 'a cover fit fills the box');
  assert.equal(checkGuestMarks([markBox({ w: 300, h: 120, fit: 'contain' })], SIZE).findings.length, 0, 'with no aspect a box at the minimum is not a finding');
});

test('guest marks: a print document is measured in millimetres and in export pixels at its dpi', () => {
  // 48 CSS px is 12.7 mm, and 150 px at 300 dpi.
  const report = checkGuestMarks([markBox()], SIZE, { unit: 'mm', dpi: 300 });
  assert.deepEqual(report.findings.map((f) => f.message), ["Northwind IT's mark is 12.7 mm high; the kit asks for at least 20 mm."]);
  const low = checkGuestMarks([markBox()], SIZE, { unit: 'mm', dpi: 150 });
  assert.deepEqual(low.findings.map((f) => f.id), ['brand.mark.logo.min-size.px', 'brand.mark.logo.min-size.mm'], 'at 150 dpi the mark is 75 px, under 96');
});

test('guest marks: a pixel document is not measured in millimetres, and the report lists that', () => {
  const report = checkGuestMarks([markBox({ h: 100 })], kit({ minSize: { mm: 20 } }));
  assert.deepEqual(report.findings, []);
  assert.ok(report.notMeasured.some((n) => /millimetres/.test(n)));
});

test('guest marks: a pixel document exported wider is measured at its export scale', () => {
  assert.equal(checkGuestMarks([markBox()], SIZE, { scale: 2 }).findings.length, 0, '48 CSS px export at 96 px');
});

test('guest marks: a layer inside the clear space is named; a full-bleed background is not', () => {
  const boxes = [
    { id: 'bg', kind: 'box', name: 'Background', x: 0, y: 0, w: 1920, h: 1080, bg: '#ffffff' },
    markBox({ h: 50 }),
    { id: 'heading', kind: 'text', name: 'Heading', text: 'Join the webinar', x: 100, y: 160, w: 600, h: 60 },
    { id: 'far', kind: 'text', text: 'Far away', x: 1000, y: 800, w: 200, h: 40 },
  ];
  const report = checkGuestMarks(boxes, SPACE);
  assert.equal(report.findings.length, 1);
  const f = report.findings[0]!;
  assert.equal(f.message, "“Heading” sits inside Northwind IT's clear space.");
  assert.equal(f.rule, 'clear-space');
  assert.deepEqual(f.related, ['heading']);
  // Moved out of the band (the mark's bottom is 150, the band 25 more), the finding clears.
  assert.deepEqual(checkGuestMarks(boxes.map((b) => (b.id === 'heading' ? { ...b, y: 176 } : b)), SPACE).findings, []);
});

test('guest marks: several neighbours are counted in one finding, and two kit marks check each other', () => {
  const several = checkGuestMarks([
    markBox({ h: 50 }),
    { id: 'a', kind: 'text', name: 'Title', text: 'T', x: 90, y: 90, w: 20, h: 20 },
    { id: 'b', kind: 'box', x: 280, y: 140, w: 40, h: 40 },
  ], SPACE);
  assert.equal(several.findings[0]!.message, "“Title” and 1 other layer sit inside Northwind IT's clear space.");
  const pair = checkGuestMarks([
    markBox({ h: 50 }),
    { id: 'square', kind: 'image', name: 'Northwind square', image: MARK, fit: 'fill', x: 310, y: 100, w: 50, h: 50 },
  ], SPACE);
  assert.deepEqual(pair.findings.map((f) => [f.layerId, f.related]), [['logo', ['square']], ['square', ['logo']]]);
});

test('guest marks: hidden layers, layers on screen at another time and pages are not neighbours', () => {
  const report = checkGuestMarks([
    { id: 'page', kind: 'frame', x: 50, y: 50, w: 260, h: 80 },
    markBox({ h: 50, start: 0, dur: 2 }),
    { id: 'hidden', kind: 'text', text: 'Hidden', hidden: true, x: 100, y: 160, w: 100, h: 20 },
    { id: 'later', kind: 'text', text: 'Later', start: 3, dur: 2, x: 100, y: 160, w: 100, h: 20 },
    { id: 'sound', kind: 'audio', x: 100, y: 100, w: 50, h: 50 },
  ], SPACE);
  assert.deepEqual(report.findings, []);
});

test('guest marks: what Design does not draw is not measured, and other artboards and pages are not neighbours', () => {
  // A mark on a hidden artboard is not measured; a hidden group's members are not neighbours.
  const hiddenBoard = checkGuestMarks([
    { id: 'board', kind: 'frame', hidden: true, x: 0, y: 0, w: 800, h: 600 },
    markBox({ frame: 'board' }),
  ], SIZE);
  assert.equal(hiddenBoard.checked.marks, 0);
  assert.deepEqual(hiddenBoard.findings, []);
  const hiddenGroup = checkGuestMarks([
    markBox({ h: 50 }),
    { id: 'g', kind: 'group', hidden: true, x: 90, y: 150, w: 200, h: 40 },
    { id: 'caption', kind: 'text', text: 'Caption', group: 'g', x: 100, y: 160, w: 100, h: 20 },
  ], SPACE);
  assert.deepEqual(hiddenGroup.findings, []);
  // Two artboards whose coordinates overlap still hold separate pages.
  const boards = checkGuestMarks([
    { id: 'a', kind: 'frame', x: 0, y: 0, w: 800, h: 600 },
    { id: 'b', kind: 'frame', x: 0, y: 0, w: 800, h: 600 },
    markBox({ h: 50, frame: 'a' }),
    { id: 'other', kind: 'text', text: 'On B', frame: 'b', x: 100, y: 160, w: 100, h: 20 },
    { id: 'same', kind: 'text', text: 'On A', frame: 'a', x: 100, y: 160, w: 100, h: 20 },
  ], SPACE);
  assert.deepEqual(boards.findings.map((f) => f.related), [['same']]);
});

test('guest marks: a mark turned on its side keeps its own height for size and clear space', () => {
  // 200 by 48 turned 90 degrees has a 48 by 200 bounding box, and is still 48 high.
  const turned = checkGuestMarks([markBox({ rot: 90 })], SIZE);
  assert.deepEqual(turned.findings.map((f) => f.value), ['48 px']);
  assert.equal(checkGuestMarks([markBox({ rot: 90, h: 96 })], SIZE).findings.length, 0);
});

test('guest marks: a rotated neighbour is measured by its bounding box', () => {
  // 100 by 10 at (210, 185) rotated 90 degrees is upright, 10 by 100, so it reaches up to y 140.
  const rotated = checkGuestMarks([markBox({ h: 50 }), { id: 'bar', kind: 'box', x: 210, y: 185, w: 100, h: 10, rot: 90 }], SPACE);
  assert.deepEqual(rotated.findings.map((f) => f.related), [['bar']]);
});

test('guest marks: a recoloured mark is judged by the catalog\'s own colours, and unmeasured without them', () => {
  const allow = kit({ treatments: ['colour', 'on-photo'] });
  const recolour = guestRecolourFrom({
    iconThemes: { themes: [{ id: 'ink', c1: '#112233', c2: '#112233' }, { id: 'red-blue', c1: '#ff0000', c2: '#0000ff' }] },
    photoTreatments: { treatments: [{ id: 'greyscale', kind: 'greyscale' }, { id: 'duo', kind: 'duotone', shadow: '#112233', highlight: '#ffffff' }] },
  });
  const greyscale = checkGuestMarks([markBox({ image: `${LOGO}?treatment=greyscale` })], allow, { recolour });
  assert.deepEqual(greyscale.findings.map((f) => f.message), ["Northwind IT's mark is drawn in one colour; the kit allows full colour or on a photo."]);
  assert.deepEqual(checkGuestMarks([markBox({ image: `${LOGO}?theme=ink` })], allow, { recolour }).findings.map((f) => f.value), ['mono'], 'a theme whose two colours are one colour is one colour');
  // A two-colour theme is not one colour: it recolours the mark, which a mono-only kit does not allow.
  const twoColour = checkGuestMarks([markBox({ image: `${LOGO}?theme=red-blue` })], kit({ treatments: ['mono'] }), { recolour });
  assert.deepEqual(twoColour.findings.map((f) => f.message), ["Northwind IT's mark is recoloured; the kit allows one colour."]);
  assert.deepEqual(checkGuestMarks([markBox({ image: `${LOGO}?treatment=duo` })], allow, { recolour }).findings.map((f) => f.value), ['recoloured']);
  // Without the catalog's colours, or for a theme it does not declare, the treatment is not measured, and the report says so.
  for (const opts of [{}, { recolour }]) {
    const unknown = checkGuestMarks([markBox({ image: `${LOGO}?theme=${'recolour' in opts ? 'unknown-theme' : 'red-blue'}` })], kit({ treatments: ['mono'] }), opts);
    assert.deepEqual(unknown.findings, []);
    assert.ok(unknown.notMeasured.some((n) => /treatment of one recoloured mark/.test(n)), JSON.stringify(unknown.notMeasured));
  }
  const monoOnly = checkGuestMarks([markBox()], kit({ treatments: ['mono'] }));
  assert.deepEqual(monoOnly.findings.map((f) => f.message), ["Northwind IT's mark is drawn in full colour; the kit allows one colour."]);
});

test('guest marks: a mark on a photo is named when the kit leaves on-photo out', () => {
  const noPhoto = kit({ treatments: ['colour', 'mono'] });
  const boxes = [
    { id: 'photo', kind: 'image', name: 'Event photo', image: 'user/abc123', x: 0, y: 0, w: 800, h: 600 },
    markBox(),
  ];
  const report = checkGuestMarks(boxes, noPhoto);
  assert.deepEqual(report.findings.map((f) => f.message), ["Northwind IT's mark sits on a photo; the kit allows full colour or one colour."]);
  assert.deepEqual(report.findings[0]!.related, ['photo']);
  assert.equal(checkGuestMarks(boxes, noPhoto, { pictureKind: () => 'vector' }).findings.length, 0, 'a vector drawing beneath is not a photo');
  assert.equal(checkGuestMarks([boxes[1]!, boxes[0]!], noPhoto).findings.length, 0, 'a photo drawn over the mark (later in layer order) is not what the mark sits on');
  // Design paints in layer order and `z` is depth: a depth on the mark does not move it off the photo.
  assert.deepEqual(checkGuestMarks([{ id: 'dummy', kind: 'box', x: 900, y: 900, w: 10, h: 10 }, boxes[0]!, { ...boxes[1]!, z: 0 }], noPhoto).findings.map((f) => f.value), ['on-photo']);
  assert.equal(checkGuestMarks(boxes, kit({ treatments: ['colour', 'on-photo'] })).findings.length, 0);
  // A plain box between the photo and the mark is what the mark sits on.
  const panel = { id: 'panel', kind: 'box', x: 80, y: 80, w: 300, h: 100, bg: '#ffffff' };
  assert.equal(checkGuestMarks([boxes[0]!, panel, boxes[1]!], noPhoto).findings.length, 0);
});

test('guest marks: reversed use is not measured, and the report says so', () => {
  const report = checkGuestMarks([markBox()], kit({ treatments: ['colour', 'reverse'] }));
  assert.deepEqual(report.findings, []);
  assert.ok(report.notMeasured.some((n) => /reversed use/.test(n)));
});

test('guest marks: a mark is a kit logo by id, whatever version or modifier it was placed with', () => {
  const report = checkGuestMarks([
    markBox({ image: { id: LOGO, version: 1 } }),
    markBox({ id: 'other', image: 'lolly/logo/primary' }),
    markBox({ id: 'upload', image: 'user/logo' }),
  ], SIZE);
  assert.deepEqual(report.findings.map((f) => f.layerId), ['logo']);
  assert.equal(report.checked.marks, 1);
});

test('guest marks: a kit with no rules measures nothing, and junk input is handled', () => {
  const none = checkGuestMarks([markBox()], kit(undefined));
  assert.deepEqual({ findings: none.findings, rules: none.checked.rules, marks: none.checked.marks }, { findings: [], rules: [], marks: 1 });
  assert.deepEqual(checkGuestMarks(null, SIZE).findings, []);
  assert.deepEqual(checkGuestMarks([null, 4, 'x', markBox({ w: 0 })], SIZE).findings, []);
});

test('guest marks: in a check report a mark finding is a brand review with a code per rule', () => {
  const f = checkGuestMarks([markBox()], SIZE).findings[0]!;
  const finding = checkFindingFromBrand(f);
  assert.equal(finding.code, 'brand.mark.min-size');
  assert.equal(finding.family, 'brand');
  assert.equal(finding.severity, 'warn', 'a review, never an error');
  assert.equal(finding.needs, 'review');
  assert.equal(finding.message, "Northwind IT's mark is 48 px high; the kit asks for at least 96 px.");
  assert.equal(finding.evidence?.expected, '96 px');
  assert.equal(finding.fix, undefined);
});

test('guest marks: the check report measures a kit with no design system, and the brand family says only the kit ran', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify([markBox()]));
  const report = await checkFile(bytes, 'banner.json', { designSystem: null, partnerKit: SIZE, browser: 'off' });
  assert.equal(report.families.brand.state, 'ran');
  assert.match(report.families.brand.reason ?? '', /Only the partner kit was checked\. Partner kit Northwind IT: measured 1 partner mark against its minimum size\./);
  assert.deepEqual(report.findings.filter((f) => f.family === 'brand').map((f) => f.code), ['brand.mark.min-size']);
  const without = await checkFile(bytes, 'banner.json', { designSystem: null, browser: 'off' });
  assert.equal(without.families.brand.state, 'unavailable', 'with no kit and no design system the family stays unavailable, as before');
});

test('guest marks: a print document is measured at the unit and dpi it was saved with', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ boxes: [markBox()], documentUnit: 'mm', documentDpi: 300 }));
  const report = await checkFile(bytes, 'flyer.json', { designSystem: null, partnerKit: SIZE, browser: 'off' });
  assert.deepEqual(report.findings.filter((f) => f.family === 'brand').map((f) => f.message), ["Northwind IT's mark is 12.7 mm high; the kit asks for at least 20 mm."]);
});

test('guest marks: with a kit attached, the brand check counts the kit colours and logos as compared, never off-brand', async () => {
  const { checkBrandDesign } = await import('../engine/src/brand-check.ts');
  const doc = { color: { $type: 'color', semantic: { primary: { $value: '#0c322c' }, surface: { $value: '#ffffff' } } } };
  const boxes = [
    markBox(),
    { id: 'heading', kind: 'text', name: 'Heading', text: 'Hello', fg: '#1D4ED8', x: 0, y: 200, w: 400, h: 60 },
    { id: 'scrim', kind: 'box', bg: '#1d4ed880', x: 0, y: 300, w: 400, h: 60 },
    { id: 'stray', kind: 'box', bg: '#ff00ff', x: 0, y: 400, w: 40, h: 40 },
  ];
  const without = checkBrandDesign(boxes, doc);
  assert.ok(without.findings.some((f) => f.layerId === 'heading' && f.kind === 'color'), 'without the kit, the partner blue reads as off-brand');
  assert.ok(without.findings.some((f) => f.layerId === 'logo'), 'and the partner logo as an unknown asset');
  const guest = checkBrandDesign(boxes, doc, { guest: { colours: ['#1d4ed8'], assets: [LOGO, MARK] } });
  assert.deepEqual(guest.findings.filter((f) => f.kind === 'color' || f.kind === 'asset').map((f) => f.layerId), ['stray'], 'only the colour that is neither brand nor kit is flagged');
  assert.equal(guest.checked.assets, 1);
});

// Review regressions (plans/82 M8, L-M8-2): each case failed before its fix.

test('guest marks: a guest logo is a known asset, but its undeclared treatment is still a reference to check', async () => {
  const { checkBrandDesign } = await import('../engine/src/brand-check.ts');
  const doc = { color: { $type: 'color', ink: { $value: '#112233' } } };
  const report = checkBrandDesign([{ id: 'logo', name: 'Logo', kind: 'image', image: `${LOGO}?treatment=missing` }], doc, { treatments: [], guest: { colours: [], assets: [LOGO] } });
  assert.deepEqual(report.findings.map((f) => [f.kind, f.status]), [['reference', 'unknown']]);
  assert.deepEqual(checkBrandDesign([{ id: 'logo', kind: 'image', image: LOGO }], doc, { guest: { colours: [], assets: [LOGO] } }).findings, [], 'the plain logo is known');
});

test('guest marks: two kit marks in the same box each crowd the other; another mark is never a background', () => {
  const report = checkGuestMarks([markBox({ h: 50 }), { id: 'square', kind: 'image', name: 'Northwind square', image: MARK, fit: 'fill', x: 100, y: 100, w: 200, h: 50 }], SPACE);
  assert.deepEqual(report.findings.map((f) => [f.layerId, f.related]), [['logo', ['square']], ['square', ['logo']]]);
});

test('guest marks: a layer at no opacity, its own or its group\'s, is not a neighbour', () => {
  assert.deepEqual(checkGuestMarks([markBox({ h: 50 }), { id: 'ghost', kind: 'text', text: 'Ghost', opacity: 0, x: 100, y: 160, w: 100, h: 20 }], SPACE).findings, []);
  assert.deepEqual(checkGuestMarks([
    markBox({ h: 50 }),
    { id: 'g', kind: 'group', opacity: 0, x: 100, y: 160, w: 100, h: 20 },
    { id: 'kid', kind: 'text', text: 'In a faded group', group: 'g', x: 100, y: 160, w: 100, h: 20 },
  ], SPACE).findings, []);
  assert.equal(checkGuestMarks([markBox({ h: 50 }), { id: 'half', kind: 'text', text: 'Half', opacity: 50, x: 100, y: 160, w: 100, h: 20 }], SPACE).findings.length, 1, 'a half-faded layer still crowds the mark');
});

test('guest marks: a mark in a group takes its artboard from the hierarchy, so another artboard is never a neighbour', () => {
  const report = checkGuestMarks([
    { id: 'a', kind: 'frame', x: 0, y: 0, w: 800, h: 600 },
    { id: 'b', kind: 'frame', x: 0, y: 0, w: 800, h: 600 },
    { id: 'g', kind: 'group', frame: 'a', x: 100, y: 100, w: 200, h: 50 },
    markBox({ h: 50, group: 'g' }),
    { id: 'other', kind: 'text', text: 'On B', frame: 'b', x: 100, y: 160, w: 100, h: 20 },
  ], SPACE);
  assert.deepEqual(report.findings, []);
});

test('guest marks: what the mark sits on looks through layers that paint nothing, and an artboard\'s own picture counts', () => {
  const noPhoto = kit({ treatments: ['colour', 'mono'] });
  const through = checkGuestMarks([
    { id: 'photo', kind: 'image', image: 'user/photo', x: 0, y: 0, w: 800, h: 600 },
    { id: 'clear', kind: 'box', bg: 'transparent', x: 50, y: 50, w: 400, h: 200 },
    markBox(),
  ], noPhoto);
  assert.deepEqual(through.findings.map((f) => [f.value, f.related]), [['on-photo', ['photo']]]);
  const board = checkGuestMarks([
    { id: 'board', kind: 'frame', image: 'lolly/photos/sea', x: 0, y: 0, w: 800, h: 600 },
    markBox({ frame: 'board' }),
  ], noPhoto);
  assert.deepEqual(board.findings.map((f) => [f.value, f.related]), [['on-photo', ['board']]]);
  const panel = checkGuestMarks([
    { id: 'board', kind: 'frame', image: 'lolly/photos/sea', x: 0, y: 0, w: 800, h: 600 },
    { id: 'panel', kind: 'box', bg: '#ffffff', frame: 'board', x: 50, y: 50, w: 400, h: 200 },
    markBox({ frame: 'board' }),
  ], noPhoto);
  assert.deepEqual(panel.findings, [], 'a painted panel between is what the mark sits on');
});

test('guest marks: a contained logo of unknown proportions in a box at the minimum is reported as not measured', () => {
  const box = markBox({ w: 300, h: 120, fit: 'contain' });
  const unknown = checkGuestMarks([box], SIZE);
  assert.deepEqual(unknown.findings, []);
  assert.ok(unknown.notMeasured.some((n) => /drawn height of one partner mark/.test(n)), JSON.stringify(unknown.notMeasured));
  // A box already under the minimum is under it whatever the proportions.
  assert.equal(checkGuestMarks([markBox({ fit: 'contain' })], SIZE).notMeasured.some((n) => /drawn height/.test(n)), false);
  assert.deepEqual(checkGuestMarks([box], SIZE, { logoAspect: () => 4 }).findings.map((f) => f.value), ['75 px']);
  assert.equal(checkGuestMarks([markBox({ w: 300, h: 120, fit: 'cover' })], SIZE).notMeasured.some((n) => /drawn height/.test(n)), false, 'a cover fit draws the box');
});

test('guest marks: an unreadable document dpi is read as absent, and the check report carries what was not measured', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ boxes: [markBox({ w: 300, h: 120, fit: 'contain' })], documentUnit: 'mm', documentDpi: { toString: null } }));
  const report = await checkFile(bytes, 'flyer.json', { designSystem: null, partnerKit: SIZE, browser: 'off' });
  assert.equal(report.families.brand.state, 'ran');
  assert.match(report.families.brand.reason ?? '', /Not measured: .*drawn height of one partner mark/);
});

// Second review pass (plans/82 M8, L-M8-2).

test('guest marks: paint order follows the layer tree, so a group\'s member paints at the group\'s place', () => {
  const colourOnly = kit({ treatments: ['colour'] });
  // Design paints g, then its member photo, then the mark, though the photo is listed last.
  const report = checkGuestMarks([
    { id: 'g', kind: 'group', x: 0, y: 0, w: 800, h: 600 },
    markBox(),
    { id: 'photo', kind: 'image', image: 'user/photo', group: 'g', x: 0, y: 0, w: 800, h: 600 },
  ], colourOnly);
  assert.deepEqual(report.findings.map((f) => [f.value, f.related]), [['on-photo', ['photo']]]);
});

test('guest marks: only a group\'s opacity reaches its members; a layout container\'s is its own', () => {
  const report = checkGuestMarks([
    { id: 'row', kind: 'box', opacity: 0, x: 0, y: 0, w: 800, h: 200 },
    markBox({ layoutOwner: 'row' }),
  ], SIZE);
  assert.equal(report.checked.marks, 1);
  assert.deepEqual(report.findings.map((f) => f.value), ['48 px']);
});

test('guest marks: a transparent fill paints nothing, and a translucent one leaves the ground not measured', () => {
  const colourOnly = kit({ treatments: ['colour'] });
  const photo = { id: 'photo', kind: 'image', image: 'user/photo', x: 0, y: 0, w: 800, h: 600 };
  const clear = checkGuestMarks([photo, { id: 'p', kind: 'box', bg: 'rgba(255,255,255,0)', x: 0, y: 0, w: 800, h: 600 }, markBox()], colourOnly);
  assert.deepEqual(clear.findings.map((f) => f.value), ['on-photo']);
  for (const veil of [{ bg: 'rgba(255,255,255,0.5)' }, { bg: '#ffffff', opacity: 50 }]) {
    const r = checkGuestMarks([photo, { id: 'p', kind: 'box', x: 0, y: 0, w: 800, h: 600, ...veil }, markBox()], colourOnly);
    assert.deepEqual(r.findings, [], JSON.stringify(veil));
    assert.ok(r.notMeasured.some((n) => /sits on a photo: what lies beneath is translucent/.test(n)), JSON.stringify(veil));
  }
  assert.deepEqual(checkGuestMarks([photo, { id: 'p', kind: 'box', bg: '#ffffff', x: 0, y: 0, w: 800, h: 600 }, markBox()], colourOnly).findings, [], 'an opaque panel is the ground');
});

test('guest marks: an empty or unknown fit is Design\'s contain', () => {
  for (const fit of ['', 'bogus', 7]) {
    const unknown = checkGuestMarks([markBox({ w: 300, h: 120, fit })], SIZE);
    assert.ok(unknown.notMeasured.some((n) => /drawn height/.test(n)), String(fit));
    assert.deepEqual(checkGuestMarks([markBox({ w: 300, h: 120, fit })], SIZE, { logoAspect: () => 4 }).findings.map((f) => f.value), ['75 px'], String(fit));
  }
});

test('guest marks: a theme\'s two colours are compared as colours, and an unreadable one is not measured', () => {
  const recolour = guestRecolourFrom({ iconThemes: { themes: [{ id: 'ink', c1: '#fff', c2: '#ffffff' }, { id: 'odd', c1: 'not a colour', c2: '#ffffff' }] } });
  assert.equal(recolour({ theme: 'ink' }), 'mono');
  assert.equal(recolour({ theme: 'odd' }), null);
  assert.deepEqual(checkGuestMarks([markBox({ image: `${LOGO}?theme=ink` })], kit({ treatments: ['mono'] }), { recolour }).findings, []);
});

test('guest marks: a layer tree that cannot be read is said, not passed in silence', () => {
  const report = checkGuestMarks([
    { id: 'board', kind: 'frame', image: 'lolly/photos/sea', x: 0, y: 0, w: 800, h: 600 },
    { id: 'g', kind: 'group', frame: 'board', x: 0, y: 0, w: 800, h: 600 },
    markBox({ group: 'g' }),
    { id: 'bad', kind: 'box', w: { toString: null }, x: 0, y: 0, h: 10 },
  ], kit({ treatments: ['colour'] }));
  assert.ok(report.notMeasured.some((n) => /layer tree could not be read/.test(n)), JSON.stringify(report.notMeasured));
});

// Third review pass (plans/82 M8, L-M8-2): each test fails on the pass-two checker.

test('guest marks: a surface-aware mark takes its colours from what lies beneath, so its treatment is not measured', () => {
  const recolour = guestRecolourFrom({ iconThemes: { themes: [{ id: 'red-blue', c1: '#ff0000', c2: '#0000ff' }] } });
  const report = checkGuestMarks([markBox({ image: `${LOGO}?theme=auto` })], kit({ treatments: ['mono'] }), { recolour });
  assert.deepEqual(report.findings, [], 'no colour is assumed for the variant the surface picks');
  assert.ok(report.notMeasured.some((n) => /colours of one partner mark set to follow the surface/.test(n)), JSON.stringify(report.notMeasured));
});

test('guest marks: an artboard\'s opacity reaches what is drawn on it, and opacity is Design\'s 0 to 100', () => {
  const hiddenBoard = checkGuestMarks([
    { id: 'board', kind: 'frame', opacity: 0, x: 0, y: 0, w: 800, h: 600 },
    markBox({ frame: 'board' }),
  ], SIZE);
  assert.equal(hiddenBoard.checked.marks, 0, 'a mark on an artboard at no opacity is not drawn');
  // The renderer reads a leading number, so Design draws "0%" as no opacity.
  assert.deepEqual(checkGuestMarks([markBox({ h: 50 }), { id: 'ghost', kind: 'text', text: 'Ghost', opacity: '0%', x: 100, y: 160, w: 100, h: 20 }], SPACE).findings, []);
});

test('guest marks: a fit Design draws at the logo\'s own size needs that size, and framing and a border change the drawn height', () => {
  for (const fit of ['none', 'scale-down']) {
    const box = markBox({ w: 200, h: 200, fit });
    const unsized = checkGuestMarks([box], SIZE, { logoAspect: () => 1 });
    assert.deepEqual(unsized.findings, [], fit);
    assert.ok(unsized.notMeasured.some((n) => /drawn height of one partner mark/.test(n)), `${fit}: ${JSON.stringify(unsized.notMeasured)}`);
    assert.deepEqual(checkGuestMarks([box], SIZE, { logoSize: () => ({ width: 32, height: 32 }) }).findings.map((f) => f.value), ['32 px'], fit);
  }
  // A framing zoom draws the logo larger; an inside border draws the picture within the border.
  assert.deepEqual(checkGuestMarks([markBox({ imageFraming: { x: 50, y: 50, zoom: 200 } })], SIZE).findings, []);
  assert.deepEqual(checkGuestMarks([markBox({ h: 100, stroke: '#000000', strokeW: 4 })], SIZE).findings.map((f) => f.value), ['92 px']);
});

test('guest marks: where a logo of unknown proportions is drawn is unknown for its ground and clear space too', () => {
  const colourOnly = kit({ treatments: ['colour'] });
  const box = markBox({ x: 100, y: 100, w: 300, h: 120, fit: 'contain' });
  const strip = { id: 'strip', kind: 'image', image: 'user/photo', x: 100, y: 145, w: 300, h: 30 };
  const unknown = checkGuestMarks([strip, box], colourOnly);
  assert.deepEqual(unknown.findings, []);
  assert.ok(unknown.notMeasured.some((n) => /one partner mark sits on a photo/.test(n)), JSON.stringify(unknown.notMeasured));
  assert.deepEqual(checkGuestMarks([strip, box], colourOnly, { logoAspect: () => 10 }).findings.map((f) => f.value), ['on-photo'], 'at 10:1 the logo is drawn on the strip');
  const near = { id: 'caption', kind: 'text', text: 'Caption', x: 100, y: 240, w: 300, h: 20 };
  const space = checkGuestMarks([box, near], kit({ clearSpace: { value: 0.5, unit: 'mark-height' } }));
  assert.deepEqual(space.findings, [], 'the caption may or may not be in the clear space');
  assert.ok(space.notMeasured.some((n) => /clear space of one partner mark/.test(n)), JSON.stringify(space.notMeasured));
});

test('guest marks: what a mark sits on is read for each stretch of time', () => {
  const colourOnly = kit({ treatments: ['colour'] });
  const photo = { id: 'photo', kind: 'image', image: 'user/photo', x: 0, y: 0, w: 800, h: 600, start: 0, dur: 10 };
  const mark = markBox({ start: 0, dur: 10 });
  const panel = { id: 'panel', kind: 'box', bg: '#ffffff', x: 0, y: 0, w: 800, h: 600, start: 0, dur: 1 };
  assert.deepEqual(checkGuestMarks([photo, panel, mark], colourOnly).findings.map((f) => f.value), ['on-photo'], 'after the first second the mark sits on the photo');
  // A timed layer set aside is not played, so it hides nothing.
  assert.deepEqual(checkGuestMarks([photo, { ...panel, dur: 10, ignored: true }, mark], colourOnly).findings.map((f) => f.value), ['on-photo']);
  // A layer that moves over time is measured where it was placed, and the report says so.
  const moving = checkGuestMarks([photo, { ...panel, dur: 10, kf: 't0_x0*t1000_x-900' }, mark], colourOnly);
  assert.deepEqual(moving.findings, []);
  assert.ok(moving.notMeasured.some((n) => /one partner mark while the piece plays/.test(n)), JSON.stringify(moving.notMeasured));
});

test('guest marks: a catalog id declared twice is read as the renderer reads it, the first one', () => {
  const recolour = guestRecolourFrom({
    iconThemes: { themes: [{ id: 'look', c1: '#ff0000', c2: '#0000ff' }, { id: 'look', c1: '#000000', c2: '#000000' }] },
    photoTreatments: { treatments: [{ id: 'tone', kind: 'duotone', shadow: '#112233', highlight: '#ffffff' }, { id: 'tone', kind: 'greyscale' }] },
  });
  assert.equal(recolour({ theme: 'look' }), 'other');
  assert.equal(recolour({ treatment: 'tone' }), 'other');
});

test('guest marks: findings past the first 200 are counted, not dropped in silence', () => {
  const many = Array.from({ length: 201 }, (_, n) => markBox({ id: `logo-${n}`, x: n * 300 }));
  const report = checkGuestMarks(many, kit({ minSize: { px: 96 } }));
  assert.equal(report.checked.marks, 201);
  assert.equal(report.findings.length, 200);
  assert.ok(report.notMeasured.some((n) => /one more finding past the first 200/.test(n)), JSON.stringify(report.notMeasured));
});

test('guest marks: the check report reads what a mark sits on in every theme checked', async () => {
  const doc = {
    $themes: [
      { name: 'light', selectedTokenSets: { base: 'enabled', light: 'enabled' } },
      { name: 'dark', selectedTokenSets: { base: 'enabled', dark: 'enabled' } },
    ],
    base: { color: { $type: 'color', ink: { $value: '#1d1d1d' } } },
    light: { color: { $type: 'color', panel: { $value: '#ffffff' } } },
    dark: { color: { $type: 'color', panel: { $value: '#ffffff00' } } },
  };
  const rows = normaliseDesignColourRefs([
    { id: 'photo', kind: 'image', image: 'user/photo', x: 0, y: 0, w: 800, h: 600 },
    { id: 'panel', kind: 'box', bg: '{color.panel}', x: 0, y: 0, w: 800, h: 600 },
    markBox(),
  ] as InputValue[], ['bg', 'fg', 'stroke'], createTokenSet(doc, {}));
  const bytes = new TextEncoder().encode(JSON.stringify({ boxes: rows }));
  const report = await checkFile(bytes, 'themes.json', { designSystem: { doc, origin: 'file' }, partnerKit: kit({ treatments: ['colour'] }), themes: ['light', 'dark'], browser: 'off', textMeasure: false });
  const onPhoto = report.findings.filter((f) => f.layerId === 'logo' && /sits on a photo/.test(f.message));
  assert.deepEqual(onPhoto.map((f) => f.theme), ['dark'], 'the light panel covers the photo; the dark one is clear');
});

test('guest marks: each thing not measured is a stable code with its counts, and the English is read from the code', () => {
  const report = checkGuestMarks([markBox({ w: 300, h: 120, fit: 'contain', image: `${LOGO}?theme=auto` })], kit({ minSize: { px: 96, mm: 20 }, treatments: ['mono'] }));
  assert.deepEqual(report.unmeasured, [{ code: 'reverse' }, { code: 'mm-in-pixels' }, { code: 'size', count: 1 }, { code: 'surface', count: 1 }]);
  assert.deepEqual(report.notMeasured, report.unmeasured.map(guestUnmeasuredText), 'the CLI\'s English is the same entries, in the same order');
  const many = checkGuestMarks(Array.from({ length: 203 }, (_, n) => markBox({ id: `logo-${n}`, x: n * 300 })), kit({ minSize: { px: 96 } }));
  assert.deepEqual(many.unmeasured, [{ code: 'findings-limit', count: 3, limit: 200 }]);
  assert.equal(many.notMeasured[0], '3 more findings past the first 200, which are not listed');
});
