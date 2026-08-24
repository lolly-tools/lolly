// SPDX-License-Identifier: MPL-2.0
/**
 * diagram-builder, dated roadmap mode: real dates on the axis, swimlanes,
 * milestones and the today-line.
 *
 * Run with: node --test "tests/diagram-builder-gantt.test.ts"  (or npm test)
 * No test framework - uses node:test built-in.
 *
 * The date maths lives in the tool's hooks.js, which ships as tool DATA and may not
 * be imported. These tests compile the REAL hooks.js the way engine/src/runtime.ts
 * does (new Function('host', src)) and call the helpers directly, and drive the
 * whole tool through createRuntime for the geometry - so what is pinned here is the
 * shipping code, not a copy of it.
 *
 * The rule the whole feature rests on: dates are ADDITIVE. A gantt whose cards carry
 * only the old unitless start/length numbers must render byte for byte what it
 * rendered before, so that render is hashed below. Re-record the hash ONLY together
 * with a deliberate change to the unitless bars (print it with `node --test` after
 * flipping RECORD to true in the pin test).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

// diagram-builder ships in the (private) SUSE brand pack. Load it from the SOURCE
// pack, not the gitignored tools/ profile view, so this suite is profile-
// independent: skip ONLY when the pack itself isn't mounted (public CI /
// lolly-start checkouts); with the pack mounted, a missing tool dir means the tool
// was renamed or deleted - that must FAIL loudly, never silently skip.
const SUSE_TOOLS = join(dirname(fileURLToPath(import.meta.url)), '..', 'brands', 'suse', 'tools');
const TOOL_DIR = join(SUSE_TOOLS, 'diagram-builder');
const PACK_MOUNTED = existsSync(SUSE_TOOLS);
const SKIP_SUSE = !PACK_MOUNTED && 'SUSE brand pack not mounted (see profiles.json)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(TOOL_DIR, 'tool.json')),
    'brands/suse/tools/diagram-builder/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}

interface Day { day: number; text: string; loose: boolean }
interface Dates {
  parseDay: (v: unknown) => Day | null;
  dayFromYMD: (y: number, m: number, d: number) => number;
  axisTicks: (from: number, to: number, scale: string) => number[];
  tickLabel: (day: number, scale: string) => string;
  pickScale: (spanDays: number) => string;
}

/** Compile hooks.js exactly as engine/src/runtime.ts getHookFactory does. */
function dateHelpers(): Dates {
  const src = readFileSync(join(TOOL_DIR, 'hooks.js'), 'utf8');
  const factory = new Function(
    'host',
    `${src}; return { parseDay: parseDay, dayFromYMD: dayFromYMD, axisTicks: axisTicks,`
    + ' tickLabel: tickLabel, pickScale: pickScale };',
  ) as (host: unknown) => Dates;
  return factory({ log: () => {} });
}

const D = SKIP_SUSE ? (null as unknown as Dates) : dateHelpers();

const fetchFile = (path: string) => readFile(join(SUSE_TOOLS, path), 'utf8');
const tool: any = SKIP_SUSE ? null : await loadTool('diagram-builder', fetchFile);

// Colours are pinned on every render so the geometry never depends on which brand
// tokens happen to resolve; only the layout maths is under test.
const PAINT = {
  diagramType: 'gantt', source: 'visual', theme: 'custom', density: 'cozy', preset: 'custom',
  nodeFill: '#ffffff', nodeStroke: '#0c322c', nodeText: '#0c322c', edgeColor: '#0c322c',
  background: '#ffffff', gridBg: 'none', title: '',
};

async function render(state: Record<string, unknown>): Promise<string> {
  const rt = await createRuntime(tool, baseHost(), { ...PAINT, ...state });
  return rt.getHydrated() as string;
}
async function warningOf(state: Record<string, unknown>): Promise<string> {
  const rt = await createRuntime(tool, baseHost(), { ...PAINT, ...state });
  return rt.getHydratedText('{{ganttWarning}}');
}

/** Every <line> in the SVG as { x1, x2, y1, y2, width }. */
function lines(svg: string) {
  const out: { x1: number; y1: number; x2: number; y2: number; w: number }[] = [];
  const re = /<line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)" stroke="[^"]*" stroke-width="([\d.]+)"/g;
  for (let m = re.exec(svg); m; m = re.exec(svg)) {
    out.push({ x1: +m[1]!, y1: +m[2]!, x2: +m[3]!, y2: +m[4]!, w: +m[5]! });
  }
  return out;
}
/** Vertical rules of a given stroke width, left to right. */
const verticals = (svg: string, w: number) =>
  lines(svg).filter(l => l.x1 === l.x2 && Math.abs(l.w - w) < 0.001).map(l => l.x1).sort((a, b) => a - b);
/** Task bars: a rounded rect path opens at left+r and turns at right-r (r = 6 here). */
function barSpans(svg: string) {
  const out: { left: number; right: number; top: number }[] = [];
  const re = /<path d="M([\d.]+) ([\d.]+)L([\d.]+) ([\d.]+)C/g;
  for (let m = re.exec(svg); m; m = re.exec(svg)) {
    if (m[2] !== m[4]) continue; // not a horizontal top edge
    out.push({ left: +m[1]! - 6, right: +m[3]! + 6, top: +m[2]! });
  }
  return out;
}
/** Text runs as { x, y, cls, text }. */
function texts(svg: string) {
  const out: { x: number; y: number; cls: string; text: string; anchor: string }[] = [];
  const re = /<text (?:class="([^"]*)" )?x="([-\d.]+)" y="([-\d.]+)"[^>]*text-anchor="(\w+)">([^<]*)<\/text>/g;
  for (let m = re.exec(svg); m; m = re.exec(svg)) {
    out.push({ cls: m[1] || '', x: +m[2]!, y: +m[3]!, anchor: m[4]!, text: m[5]! });
  }
  return out;
}

// ─── date parsing ────────────────────────────────────────────────────────────

test('parseDay: ISO dates, in whole days from 1970-01-01 UTC', { skip: SKIP_SUSE }, () => {
  assert.equal(D.parseDay('1970-01-01')!.day, 0);
  assert.equal(D.parseDay('1970-01-05')!.day, 4, '1970-01-05 was a Monday - the week-tick anchor');
  assert.equal(D.parseDay('2026-01-15')!.day, D.dayFromYMD(2026, 1, 15));
  assert.equal(D.parseDay('2026-1-5')!.day, D.dayFromYMD(2026, 1, 5), 'single-digit month/day is still ISO');
  assert.equal(D.parseDay('2026-01-15T09:00')!.day, D.dayFromYMD(2026, 1, 15), 'a time suffix is dropped, not refused');
  assert.equal(D.parseDay('  2026-01-15  ')!.day, D.dayFromYMD(2026, 1, 15));
  assert.equal(D.parseDay('2026-01-15')!.loose, false);
});

test('parseDay: empty is absent, junk is unreadable, neither throws', { skip: SKIP_SUSE }, () => {
  for (const empty of ['', '   ', null, undefined]) assert.equal(D.parseDay(empty), null, `${JSON.stringify(empty)} is no date at all`);
  for (const junk of ['next tuesday', '2026', 'Q1', '15-01-2026', '2026/01/15', '--', '2026-13-01', '2026-02-31']) {
    const p = D.parseDay(junk)!;
    assert.ok(p && Number.isNaN(p.day), `${junk} is unreadable, not silently rolled over`);
    assert.equal(p.text, junk, 'the raw text is kept for the warning');
  }
});

test('parseDay: d/m/yyyy is tolerated and flagged loose', { skip: SKIP_SUSE }, () => {
  assert.equal(D.parseDay('5/3/2026')!.day, D.dayFromYMD(2026, 3, 5), 'day first, never month first');
  assert.equal(D.parseDay('5/3/2026')!.loose, true);
  assert.equal(D.parseDay('05.03.2026')!.day, D.dayFromYMD(2026, 3, 5));
  assert.equal(D.parseDay('05.03.2026')!.loose, true);
  assert.ok(Number.isNaN(D.parseDay('31/2/2026')!.day), 'a loose date is validated too');
});

// ─── axis ────────────────────────────────────────────────────────────────────

test('pickScale: the span picks the tick spacing', { skip: SKIP_SUSE }, () => {
  assert.equal(D.pickScale(14), 'days');
  assert.equal(D.pickScale(21), 'days');
  assert.equal(D.pickScale(22), 'weeks');
  assert.equal(D.pickScale(120), 'weeks');
  assert.equal(D.pickScale(121), 'months');
  assert.equal(D.pickScale(800), 'months');
  assert.equal(D.pickScale(801), 'quarters');
});

test('axisTicks: ticks sit on natural boundaries, never on the range start', { skip: SKIP_SUSE }, () => {
  const from = D.dayFromYMD(2026, 1, 8), to = D.dayFromYMD(2026, 4, 20);

  const days = D.axisTicks(D.dayFromYMD(2026, 1, 8), D.dayFromYMD(2026, 1, 12), 'days');
  assert.deepEqual(days, [8, 9, 10, 11, 12].map(d => D.dayFromYMD(2026, 1, d)));

  const weeks = D.axisTicks(from, to, 'weeks');
  for (const t of weeks) assert.equal(((t % 7) + 7) % 7, 4, 'every week tick is a Monday');
  assert.equal(weeks[0], D.dayFromYMD(2026, 1, 12), 'the first Monday at or after the start');

  const months = D.axisTicks(from, to, 'months');
  assert.deepEqual(months.map(t => D.tickLabel(t, 'months')), ['Feb', 'Mar', 'Apr']);

  const quarters = D.axisTicks(D.dayFromYMD(2026, 2, 1), D.dayFromYMD(2027, 9, 1), 'quarters');
  assert.deepEqual(quarters.map(t => D.tickLabel(t, 'quarters')), ['Q2 26', 'Q3 26', 'Q4 26', 'Q1 27', 'Q2 27', 'Q3 27']);

  assert.deepEqual(D.axisTicks(from, from - 5, 'days'), [], 'an inverted range yields nothing instead of looping');
});

test('axisTicks: a span too long to tick per unit thins, and still reaches its end', { skip: SKIP_SUSE }, () => {
  // Regression: the generators used to stop at a fixed 4000-tick cap, so a long span
  // produced 40 labels crowded into the first fraction of the chart while the rest of
  // the axis went unlabelled - an axis that mislabels the whole picture.
  const strideOf = (t: number[]) => t[1]! - t[0]!;
  const reaches = (t: number[], to: number, what: string) =>
    assert.ok(t[t.length - 1]! > to - strideOf(t), `the last ${what} tick is within one stride of the end`);

  const from = D.dayFromYMD(2026, 1, 1), to = D.dayFromYMD(2040, 1, 1);   // ~5114 days
  const days = D.axisTicks(from, to, 'days');
  assert.ok(days.length > 1 && days.length <= 4001, 'still bounded');
  reaches(days, to, 'day');

  // Under the cap nothing moved: one tick per day, exactly as before.
  assert.deepEqual(D.axisTicks(from, from + 30, 'days'), Array.from({ length: 31 }, (_, i) => from + i));
  assert.equal(strideOf(D.axisTicks(from, from + 3999, 'days')), 1, 'the cap is not reached below it');

  const wTo = D.dayFromYMD(2090, 1, 1);
  const weeks = D.axisTicks(D.dayFromYMD(1970, 1, 1), wTo, 'weeks');
  for (const t of weeks) assert.equal(((t % 7) + 7) % 7, 4, 'a thinned week tick is still a Monday');
  reaches(weeks, wTo, 'week');

  const qTo = D.dayFromYMD(2200, 1, 1);
  const quarters = D.axisTicks(D.dayFromYMD(1700, 1, 1), qTo, 'quarters');
  for (const t of quarters) assert.match(D.tickLabel(t, 'quarters'), /^Q[1-4] \d\d$/, 'a thinned quarter tick is still a quarter start');
  reaches(quarters, qTo, 'quarter');
});

test('tickLabel: day and month names, the year only where it turns over', { skip: SKIP_SUSE }, () => {
  assert.equal(D.tickLabel(D.dayFromYMD(2026, 3, 9), 'days'), '9 Mar');
  assert.equal(D.tickLabel(D.dayFromYMD(2026, 3, 9), 'weeks'), '9 Mar');
  assert.equal(D.tickLabel(D.dayFromYMD(2026, 3, 1), 'months'), 'Mar');
  assert.equal(D.tickLabel(D.dayFromYMD(2027, 1, 1), 'months'), 'Jan 27');
  assert.equal(D.tickLabel(D.dayFromYMD(2026, 10, 1), 'quarters'), 'Q4 26');
});

// ─── the unitless pin (the whole feature is additive) ────────────────────────

const UNITLESS = [
  { shape: 'rounded', nodeId: 'discover', label: 'Discovery', detail: 'Research', ganttStart: 0, ganttLen: 2 },
  { shape: 'rounded', nodeId: 'build', label: 'Build', detail: 'Two teams', ganttStart: 2, ganttLen: 3 },
  { shape: 'rounded', nodeId: 'ship', label: 'Ship', ganttStart: 5, ganttLen: 1 },
];

test('a unitless gantt renders byte for byte what it rendered before dates existed', { skip: SKIP_SUSE }, async () => {
  const RECORD = false; // flip, run, paste the printed hash, flip back
  const svg = await render({ nodes: UNITLESS, ganttUnit: 'wk' });
  const hash = createHash('sha256').update(svg).digest('hex').slice(0, 32);
  if (RECORD) console.log('unitless gantt hash:', hash);
  assert.equal(hash, 'a8b358a557a96039ce7ccfff8f2bf3e6',
    'the unitless bars moved - dates are additive, so this only changes deliberately');

  // Readable companions to the hash, so a break says WHAT moved.
  const axis = texts(svg).filter(t => /^[\d.]+ wk$/.test(t.text));
  assert.equal(axis.length, 7, 'one numeric tick label per unit, with the unit suffix');
  assert.deepEqual(axis.map(t => t.text), ['0 wk', '1 wk', '2 wk', '3 wk', '4 wk', '5 wk', '6 wk']);
  assert.ok(!svg.includes('db-axis'), 'the mono axis class belongs to the dated mode only');
  assert.ok(!svg.includes('>Today<'), 'no today-line in the unitless mode');
  assert.equal(await warningOf({ nodes: UNITLESS }), '', 'nothing to warn about');
});

test('milestone and lane fields are inert without dates', { skip: SKIP_SUSE }, async () => {
  const plain = await render({ nodes: UNITLESS });
  const decorated = await render({
    nodes: UNITLESS.map(n => ({ ...n, milestone: true, layer: 'platform' })),
  });
  assert.equal(decorated, plain, 'milestones and swimlanes only exist on a dated axis');
});

// ─── the dated axis ──────────────────────────────────────────────────────────

const DATED = [
  { shape: 'rounded', nodeId: 'discover', label: 'Discovery', startDate: '2026-01-01', endDate: '2026-01-07' },
  { shape: 'rounded', nodeId: 'build', label: 'Build', startDate: '2026-01-08', endDate: '2026-01-14' },
];

test('one dated card switches the whole chart to a date axis', { skip: SKIP_SUSE }, async () => {
  const svg = await render({ nodes: DATED });
  const axis = texts(svg).filter(t => t.cls === 'db-axis');
  assert.ok(axis.length >= 10, 'a two-week span ticks by day');
  assert.deepEqual(axis.slice(0, 3).map(t => t.text), ['1 Jan', '2 Jan', '3 Jan']);
  for (const t of axis) assert.equal(t.anchor, 'middle');
  assert.ok(!/\d+ wk/.test(svg), 'the unitless unit label has no place on a dated axis');
});

test('bars span start to end inclusive, and a scale change only rescales them', { skip: SKIP_SUSE }, async () => {
  const svg = await render({ nodes: DATED });
  const day = verticals(svg, 0.4);
  const oneDay = day[1]! - day[0]!;
  // Both tasks are 7 inclusive days, laid end to end: equal widths, touching edges.
  // A bar is a rounded rect whose corner radius is min(6, cornerRadius), so its path
  // opens at left+6 and turns at right-6.
  const bars = barSpans(svg);
  assert.equal(bars.length, 2, 'both tasks drew a bar');
  const a = bars[0]!, b = bars[1]!;
  assert.ok(Math.abs((a.right - a.left) - 7 * oneDay) < 0.05, 'an inclusive 1-7 Jan task is seven days wide');
  assert.ok(Math.abs(b.left - a.right) < 0.05, 'the next task starts where the first ends');
  assert.ok(Math.abs(a.left - day[0]!) < 0.05, 'the first bar starts on the first tick');

  const monthly = await render({ nodes: DATED, ganttScale: 'months' });
  assert.deepEqual(texts(monthly).filter(t => t.cls === 'db-axis').map(t => t.text), ['Jan 26'],
    'an explicit scale overrides the auto pick');
});

test('the today-line sits on its date and stays away when out of range', { skip: SKIP_SUSE }, async () => {
  // 1 Jan .. 15 Jan (exclusive end): 8 Jan is the exact midpoint of the span.
  const svg = await render({ nodes: DATED, ganttToday: '2026-01-08' });
  const grid = verticals(svg, 0.4);
  const today = verticals(svg, 1.82); // max(1.4, connectorWidth 2.6 * 0.7)
  assert.equal(today.length, 1, 'exactly one today-line');
  assert.ok(Math.abs(today[0]! - (grid[0]! + grid[grid.length - 1]!) / 2) < 0.05,
    'the line sits at the midpoint of a 14-day span');
  assert.ok(svg.includes('>Today<'), 'the line is labelled');

  for (const off of ['', '2025-06-01', '2027-01-01']) {
    const none = await render({ nodes: DATED, ganttToday: off });
    assert.equal(verticals(none, 1.82).length, 0, `${off || 'empty'} draws no today-line`);
  }
  assert.match(await warningOf({ nodes: DATED, ganttToday: 'tomorrow' }), /not a date/);
});

test('a milestone is a zero-length diamond centred on its start date', { skip: SKIP_SUSE }, async () => {
  const svg = await render({
    nodes: [
      ...DATED,
      { shape: 'rounded', nodeId: 'ga', label: 'GA', startDate: '2026-01-08', milestone: true },
    ],
  });
  const grid = verticals(svg, 0.4), oneDay = grid[1]! - grid[0]!;
  const diamond = /<path d="M([\d.]+) ([\d.]+)L([\d.]+) ([\d.]+)L([\d.]+) ([\d.]+)L([\d.]+) ([\d.]+)Z"/g;
  const found = [...svg.matchAll(diamond)]
    .map(m => m.slice(1).map(Number))
    .filter(p => Math.abs(p[0]! - p[4]!) < 0.01 && Math.abs(p[3]! - p[7]!) < 0.01 && p[0] !== p[2]);
  assert.equal(found.length, 1, 'one diamond, and the bars are not diamonds');
  const [topX, topY, rightX, midY] = found[0] as number[] as [number, number, number, number];
  assert.ok(Math.abs(topX - (grid[0]! + 7 * oneDay)) < 0.05, 'centred on 8 Jan, not on the bar start of the row');
  assert.ok(rightX - topX > 4 && Math.abs((rightX - topX) - (midY - topY)) < 0.01, 'a square-on-its-point diamond');
});

test('swimlanes group the rows by Group, and undated rows sit at the bottom', { skip: SKIP_SUSE }, async () => {
  const svg = await render({
    nodes: [
      { nodeId: 'a', label: 'Alpha', layer: 'platform', startDate: '2026-01-01', endDate: '2026-01-10' },
      { nodeId: 'b', label: 'Beta', layer: 'apps', startDate: '2026-01-04', endDate: '2026-01-20' },
      { nodeId: 'c', label: 'Gamma', layer: 'platform', startDate: '2026-01-12', endDate: '2026-01-25' },
      { nodeId: 'd', label: 'Delta', ganttStart: 0, ganttLen: 1 },
    ],
  });
  const rowLabel = (name: string) => texts(svg).find(t => t.text === name)!;
  assert.ok(rowLabel('Alpha').y < rowLabel('Gamma').y, 'same lane, in card order');
  assert.ok(rowLabel('Gamma').y < rowLabel('Beta').y, 'the platform lane is whole before the apps lane starts');
  assert.ok(rowLabel('Beta').y < rowLabel('Delta').y, 'the undated row is last');

  const lane = (name: string) => texts(svg).find(t => t.text === name && t.anchor === 'start')!;
  for (const name of ['Platform', 'Apps', 'Undated']) assert.ok(lane(name), `the ${name} lane is labelled`);
  assert.ok(lane('Platform').x < rowLabel('Alpha').x, 'the lane label sits left of the task labels');
  const bands = [...svg.matchAll(/<path d="M[^"]+" fill="(#[0-9a-f]{6})"\/>/g)];
  assert.ok(bands.length >= 3, 'three lane bands are painted behind the rows');
});

test('a Group called "constructor" is a swimlane, not Object.prototype', { skip: SKIP_SUSE }, async () => {
  // Regression: lane lookup keyed a plain object by a user-typed group name, so the
  // one lowercase Object.prototype key that survives slug() returned the inherited
  // member and the whole diagram fell back to the error placeholder.
  const svg = await render({
    layers: [{ layerId: 'constructor', label: 'Kernel', bandFill: '#eeeeee' }],
    nodes: [
      { nodeId: 'a', label: 'Alpha', layer: 'constructor', startDate: '2026-01-01', endDate: '2026-01-10' },
      { nodeId: 'b', label: 'Beta', layer: 'apps', startDate: '2026-01-04', endDate: '2026-01-20' },
    ],
  });
  assert.ok(!svg.includes('Could not build'), 'a prototype key as a group name must not blank the diagram');
  assert.ok(texts(svg).some(t => t.text === 'Kernel' && t.anchor === 'start'), 'the declared lane label is read, not Object.prototype.constructor');
  assert.ok(svg.includes('#eeeeee'), 'and so is its declared band fill');
  assert.ok(texts(svg).some(t => t.text === 'Apps'), 'the ordinary lane beside it is unaffected');
});

test('an end date with no start date is reported, not silently dropped', { skip: SKIP_SUSE }, async () => {
  assert.match(await warningOf({ nodes: [{ nodeId: 'a', label: 'Alpha', endDate: '2026-03-01' }] }),
    /Alpha has an end date but no start date/);
  assert.match(await warningOf({
    nodes: [
      { nodeId: 'a', label: 'Alpha', startDate: '2026-01-01', endDate: '2026-01-10' },
      { nodeId: 'b', label: 'Beta', endDate: '2026-03-01' },
    ],
  }), /Beta has an end date but no start date/);
  assert.equal(await warningOf({ nodes: [{ nodeId: 'a', label: 'Alpha', startDate: '2026-01-01', endDate: '2026-03-01' }] }), '',
    'a complete pair says nothing');
});

test('mixed rows are warned about, not quietly drawn as fact', { skip: SKIP_SUSE }, async () => {
  const w = await warningOf({
    nodes: [
      { nodeId: 'a', label: 'Alpha', startDate: '2026-01-01', endDate: '2026-01-10' },
      { nodeId: 'b', label: 'Beta', ganttStart: 0, ganttLen: 2 },
      { nodeId: 'c', label: 'Gamma' },
    ],
  });
  assert.match(w, /2 card\(s\) have no start date/);
});

test('unreadable and day-first dates each say so', { skip: SKIP_SUSE }, async () => {
  const bad = await warningOf({
    nodes: [
      { nodeId: 'a', label: 'Alpha', startDate: '2026-01-01' },
      { nodeId: 'b', label: 'Beta', startDate: 'soon' },
    ],
  });
  assert.match(bad, /“soon” on Beta is not a date/);

  const loose = await warningOf({
    nodes: [{ nodeId: 'a', label: 'Alpha', startDate: '5/3/2026', endDate: '2026-04-01' }],
  });
  assert.match(loose, /read “5\/3\/2026” on Alpha as 5 Mar 2026/);

  const backwards = await warningOf({
    nodes: [{ nodeId: 'a', label: 'Alpha', startDate: '2026-04-01', endDate: '2026-01-01' }],
  });
  assert.match(backwards, /Alpha ends before it starts/);
  const svg = await render({ nodes: [{ nodeId: 'a', label: 'Alpha', startDate: '2026-04-01', endDate: '2026-01-01' }] });
  assert.match(svg, /<svg/, 'a backwards range still renders');

  // A typo with no readable date anywhere leaves the unitless mode running, and
  // still reports - otherwise the card silently loses its date.
  assert.match(await warningOf({ nodes: [{ nodeId: 'a', label: 'Alpha', startDate: 'soon', ganttStart: 0, ganttLen: 1 }] }),
    /is not a date/);
});

// ─── every route into the mode ───────────────────────────────────────────────

test('every preset, scale and source hydrates a dated roadmap without a hook error', { skip: SKIP_SUSE }, async () => {
  const opts = (id: string) => tool.manifest.inputs.find((i: any) => i.id === id).options.map((o: any) => o.value);
  const nodes = [
    { nodeId: 'a', label: 'Alpha', layer: 'platform', startDate: '2026-01-01', endDate: '2026-02-10' },
    { nodeId: 'm', label: 'GA', layer: 'platform', startDate: '2026-02-11', milestone: true },
    { nodeId: 'b', label: 'Beta', layer: 'apps', startDate: '2026-01-20', endDate: '2026-04-01' },
    { nodeId: 'u', label: 'Someday', ganttStart: 0, ganttLen: 2 },
  ];
  const ok = async (label: string, state: Record<string, unknown>) => {
    const rt = await createRuntime(tool, baseHost(), { diagramType: 'gantt', ...state });
    const svg = rt.getHydrated() as string;
    assert.match(svg, /^<svg /, `${label} produced no SVG`);
    assert.ok(!svg.includes('Could not build'), `${label} fell back to the error placeholder`);
  };

  for (const preset of opts('preset')) {
    for (const ganttScale of opts('ganttScale')) {
      await ok(`${preset}/${ganttScale}`, { preset, ganttScale, ganttToday: '2026-02-01', nodes });
    }
  }
  // Every Build-from route reaches the same layout; only `visual` carries dates today.
  for (const source of opts('source')) await ok(`source:${source}`, { source });
  // And the tool's own defaults, which no state override touches.
  const bare = await createRuntime(tool, baseHost(), {});
  assert.match(bare.getHydrated() as string, /^<svg /, 'the shipped defaults render');
});

// ─── manifest ────────────────────────────────────────────────────────────────

test('manifest: the date fields exist and reuse the Group field as the swimlane', { skip: SKIP_SUSE }, () => {
  const input = (id: string) => tool.manifest.inputs.find((i: any) => i.id === id);
  const field = (id: string) => input('nodes').fields.find((f: any) => f.id === id);

  for (const id of ['startDate', 'endDate']) {
    assert.equal(field(id).type, 'text', `${id} is text - blocks have no date sub-field type`);
    assert.deepEqual(field(id).showIf, { diagramType: 'gantt' });
  }
  assert.equal(field('milestone').type, 'boolean');
  assert.equal(field('milestone').default, false);
  assert.ok(field('layer'), 'the existing Group field IS the swimlane - there is no second lane field');
  assert.ok(!input('nodes').fields.some((f: any) => /lane/i.test(f.id)), 'no second lane field was added');

  assert.equal(input('ganttToday').type, 'date', 'a top-level input CAN be a real date picker');
  assert.deepEqual(input('ganttToday').showIf, { diagramType: 'gantt' });
  assert.deepEqual(input('ganttScale').options.map((o: any) => o.value), ['auto', 'days', 'weeks', 'months', 'quarters']);
  assert.equal(input('ganttScale').default, 'auto');

  // Additive: the unitless controls are still there, unrenamed.
  for (const id of ['ganttStart', 'ganttLen']) assert.ok(field(id), `${id} is still a card field`);
  for (const id of ['ganttGrid', 'ganttUnit']) assert.ok(input(id), `${id} is still an input`);
});
