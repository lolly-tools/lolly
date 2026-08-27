// SPDX-License-Identifier: MPL-2.0
/**
 * Calendar ICS (community/calendar-ics) - the printable month grid.
 *
 * Run with: node --test tests/calendar-month.test.ts
 * No test framework - node:test only.
 *
 * The tool loads from the SOURCE pack (not the gitignored tools/ view) and runs
 * through the real engine with the shared stub host, so these guard shipped
 * behaviour rather than a fixture.
 *
 * What is pinned:
 *  - view=list is BYTE-IDENTICAL to the card the tool shipped before the grid
 *    existed (the whole feature is additive or it is a regression);
 *  - the grid maths: first-column offset for both week starts, the leap-year
 *    February, a month whose 1st is a Sunday, ISO-8601 week numbers, and
 *    adjacent-month days marked as filler;
 *  - chip placement, ordering and the "+N more" overflow;
 *  - the month is chosen without a clock: the input wins, else the earliest
 *    entered date, else the sheet asks (never today);
 *  - "More dates" rows ride into the .ics as their own VEVENTs, and with no
 *    rows the file is unchanged;
 *  - every shipped template and preset seed hydrates.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { parseUrlState, serializeUrlState } from '../engine/src/url-mode.ts';
import { baseHost } from './helpers/host.ts';

// calendar-ics is a community tool - always present in a full checkout. Load it
// from the SOURCE pack (community/), not the gitignored tools/ profile view, so the
// suite never silently skips: a missing dir means the tool was renamed or deleted,
// which must FAIL here.
const COMMUNITY_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(COMMUNITY_DIR, path), 'utf8');

assert.ok(existsSync(join(COMMUNITY_DIR, 'calendar-ics', 'tool.json')),
  'community/calendar-ics/tool.json is missing - the tool was renamed or deleted');

const PKG = join(COMMUNITY_DIR, 'calendar-ics');
const tool: any = await loadTool('calendar-ics', fetchFile);

async function mount(initialState: any = {}) {
  const rt = await createRuntime(tool, baseHost(), initialState);
  return { rt, html: rt.getHydrated() as string };
}

const ics = (rt: any): string => rt.getHydratedString('{{{ics}}}') as string;

// ── Reading the rendered grid ───────────────────────────────────────────────

interface Cell { day: number; dim: boolean; body: string; chips: number; }

function cells(html: string): Cell[] {
  const out: Cell[] = [];
  const re = /<div class="cm-day( cm-dim)?">\s*<span class="cm-num">(\d+)<\/span>([\s\S]*?)\n\s*<\/div>/g;
  for (const m of html.matchAll(re)) {
    const body = m[3] ?? '';
    out.push({
      day: Number(m[2]),
      dim: Boolean(m[1]),
      body,
      chips: (body.match(/class="cm-chip"/g) ?? []).length,
    });
  }
  return out;
}

// Indexed read that says which cell was missing rather than throwing on a
// property of undefined three lines later.
function at(list: Cell[], i: number): Cell {
  const cell = list[i];
  assert.ok(cell, `the grid has no cell ${i} (it drew ${list.length})`);
  return cell;
}

const dayCell = (html: string, day: number, dim = false): Cell => {
  const hit = cells(html).find(c => c.day === day && c.dim === dim);
  assert.ok(hit, `no ${dim ? 'filler' : 'in-month'} cell for day ${day}`);
  return hit!;
};

const weekdayRow = (html: string): string[] =>
  [...html.matchAll(/<div class="cm-dow">([^<]+)<\/div>/g)].map(m => m[1] ?? '');

const weekNumbers = (html: string): number[] =>
  [...html.matchAll(/<div class="cm-wk">(\d+)<\/div>/g)].map(m => Number(m[1]));

// ── The list card must not have moved ───────────────────────────────────────

// Captured from the tool at version 1.1.0, before the month grid was added.
// Every input the card can show is filled, so a change anywhere in that branch
// shows up here. If this fails, the "additive" promise broke.
const LIST_1_1_0 = `<div class="cal-stage">
  <article class="cal-card">
    <aside class="cal-chip">
      <span class="cal-chip-month">SEP</span>
      <span class="cal-chip-day">14</span>
      <span class="cal-chip-weekday">Monday</span>
    </aside>

    <div class="cal-main">
      <p class="cal-kicker">Calendar event <span class="cal-ext">.ics</span></p>
      <h1 class="cal-title">Team meeting</h1>
      <p class="cal-when">Monday, 14 September 2026</p>

      <ul class="cal-meta">
        <li>
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#30ba78" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>
          <span>9:30 AM - 10:30 AM</span>
        </li>
        <li>
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#30ba78" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>
          <span>Nuremberg</span>
        </li>
        <li data-lolly-anno="15">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#30ba78" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>
          <span>15 minutes before</span>
        </li>
        <li class="cal-link">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#30ba78" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 15l6-6"/><path d="M10.5 7.5l1.8-1.8a3.5 3.5 0 0 1 5 5l-1.8 1.8"/><path d="M13.5 16.5l-1.8 1.8a3.5 3.5 0 0 1-5-5l1.8-1.8"/></svg>
          <span>https://example.com/a</span>
        </li>
      </ul>

      <p class="cal-desc">Agenda in the doc.</p>
    </div>
  </article>
</div>
`;

const LIST_SEED = {
  eventName: 'Team meeting',
  meetingTime: '2026-09-14T09:30',
  meetingEndTime: '2026-09-14T10:30',
  city: 'Nuremberg',
  description: 'Agenda in the doc.',
  url: 'https://example.com/a',
  reminder: '15',
};

test('view=list renders byte-identically to the pre-grid card', async () => {
  const { html } = await mount(LIST_SEED);
  assert.equal(html, LIST_1_1_0);
  // The default view is the card, so an untouched link keeps rendering it.
  const { html: dflt } = await mount({ ...LIST_SEED, view: undefined });
  assert.equal(dflt, LIST_1_1_0);
  assert.ok(!html.includes('cm-'), 'no month markup may reach the card branch');
});

test('an empty "More dates" list leaves the .ics untouched', async () => {
  const { rt: plain } = await mount(LIST_SEED);
  const { rt: withEmpty } = await mount({ ...LIST_SEED, events: [{ date: '', time: '', title: '' }] });
  assert.equal(ics(withEmpty), ics(plain));
  assert.equal((ics(plain).match(/BEGIN:VEVENT/g) ?? []).length, 1);
});

// ── Grid maths ──────────────────────────────────────────────────────────────

test('a month whose 1st is a Sunday fills the first row with the previous month', async () => {
  // 1 February 2026 is a Sunday: a Monday-start grid needs six filler days.
  const { html } = await mount({ view: 'month', month: '2026-02' });
  assert.match(html, /<h1 class="cm-title">February 2026<\/h1>/);
  assert.deepEqual(weekdayRow(html), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

  const all = cells(html);
  assert.equal(all.length, 35, 'six filler days plus 28 days is five rows of seven');
  assert.deepEqual(all.slice(0, 6).map(c => c.day), [26, 27, 28, 29, 30, 31]);
  assert.ok(all.slice(0, 6).every(c => c.dim), 'January days are filler');
  assert.equal(at(all, 6).day, 1);
  assert.equal(at(all, 6).dim, false, 'the 1st sits in the last column, not as filler');
  assert.equal(at(all, 33).day, 28, 'February 2026 ends on the 28th');
  assert.equal(at(all, 33).dim, false);
  assert.equal(at(all, 34).day, 1);
  assert.ok(at(all, 34).dim, '1 March is filler');
});

test('the same month on a Sunday start shifts the columns, not the dates', async () => {
  const { html } = await mount({ view: 'month', month: '2026-02', weekStart: 'sunday' });
  assert.deepEqual(weekdayRow(html), ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  const all = cells(html);
  assert.equal(all.length, 28, 'the 1st is a Sunday, so the grid is exactly four rows');
  assert.equal(at(all, 0).day, 1);
  assert.equal(at(all, 0).dim, false, 'no filler at all when the month starts on the first column');
  assert.equal(at(all, 27).day, 28);
  assert.ok(all.every(c => !c.dim));
});

test('leap February keeps its 29th', async () => {
  const { html } = await mount({ view: 'month', month: '2024-02' });
  const inMonth = cells(html).filter(c => !c.dim).map(c => c.day);
  assert.equal(inMonth.length, 29);
  assert.equal(inMonth[28], 29);
  // 1 February 2024 is a Thursday: three filler days lead the Monday-start row.
  assert.deepEqual(cells(html).slice(0, 3).map(c => c.day), [29, 30, 31]);

  const common = await mount({ view: 'month', month: '2026-02' });
  assert.equal(cells(common.html).filter(c => !c.dim).length, 28, '2026 is not a leap year');
});

test('week numbers are ISO-8601, and only appear when asked for', async () => {
  const off = await mount({ view: 'month', month: '2026-02' });
  assert.equal(weekNumbers(off.html).length, 0);
  assert.ok(!off.html.includes('cm-has-wk'));

  const on = await mount({ view: 'month', month: '2026-02', showWeekNumbers: true });
  assert.ok(on.html.includes('cm-has-wk'));
  assert.deepEqual(weekNumbers(on.html), [5, 6, 7, 8, 9]);

  // ISO weeks are Monday based, so a Sunday-start row is numbered by the Monday
  // inside it - the same five weeks, not four (the grid itself is four rows).
  const sun = await mount({ view: 'month', month: '2026-02', weekStart: 'sunday', showWeekNumbers: true });
  assert.deepEqual(weekNumbers(sun.html), [6, 7, 8, 9]);

  // A January that belongs to the previous ISO year: 1 January 2027 is a Friday,
  // so its first days are week 53 of 2026.
  const jan = await mount({ view: 'month', month: '2027-01', showWeekNumbers: true });
  assert.deepEqual(weekNumbers(jan.html), [53, 1, 2, 3, 4]);
});

// ── Events on the grid ──────────────────────────────────────────────────────

const BUSY = {
  view: 'month',
  month: '2026-02',
  eventName: 'Quarterly review',
  meetingTime: '2026-02-11T09:30',
  meetingEndTime: '2026-02-11T11:00',
  events: [
    { date: '2026-02-11', time: '16:00', title: 'Release cut' },
    { date: '2026-02-11', time: '14:00', title: 'Retro' },
    { date: '2026-02-11', time: '17:30', title: 'Late one' },
    { date: '2026-02-02', title: 'Offsite' },
  ],
};

test('events land on their day, in time order, with a chip each', async () => {
  const { html } = await mount(BUSY);

  const second = dayCell(html, 2);
  assert.equal(second.chips, 1);
  assert.match(second.body, /<span class="cm-chip">Offsite<\/span>/, 'an undated-time row is an all-day chip with no time');

  const eleventh = dayCell(html, 11);
  const order = [...eleventh.body.matchAll(/<span class="cm-chip">(?:<span class="cm-chip-t">([^<]*)<\/span>)?([^<]*)<\/span>/g)]
    .map(m => [m[1] ?? '', m[2]]);
  assert.deepEqual(order, [
    ['9:30 AM', 'Quarterly review'],
    ['2:00 PM', 'Retro'],
    ['4:00 PM', 'Release cut'],
  ], 'the anchor event and the rows sort by time of day, whatever order they were typed');

  // A day with nothing on it carries no chip.
  assert.equal(dayCell(html, 20).chips, 0);
});

test('a fourth event on one day collapses into "+N more"', async () => {
  const { html } = await mount(BUSY);
  const eleventh = dayCell(html, 11);
  assert.equal(eleventh.chips, 3, 'at most three chips are drawn');
  assert.match(eleventh.body, /<span class="cm-more">\+1 more<\/span>/);
  assert.ok(!eleventh.body.includes('Late one'), 'the overflowed event is counted, not drawn');

  const { html: two } = await mount({
    ...BUSY,
    events: [...BUSY.events, { date: '2026-02-11', time: '18:30', title: 'Later still' }],
  });
  assert.match(dayCell(two, 11).body, /\+2 more/);
  assert.ok(!dayCell(two, 20).body.includes('cm-more'), 'a quiet day says nothing');
});

test('a multi-day event gets a chip on every day it covers', async () => {
  const { html } = await mount({
    view: 'month',
    month: '2026-02',
    eventName: 'Design week',
    meetingTime: '2026-02-09T09:00',
    meetingEndTime: '2026-02-13T17:00',
  });
  for (const day of [9, 10, 11, 12, 13]) {
    assert.equal(dayCell(html, day).chips, 1, `day ${day} carries the span`);
    assert.match(dayCell(html, day).body, /<span class="cm-chip">Design week<\/span>/,
      'a span shows no start time, since only its first day starts');
  }
  assert.equal(dayCell(html, 8).chips, 0);
  assert.equal(dayCell(html, 14).chips, 0);
});

test('rows that are half filled in are counted under the grid, never dropped', async () => {
  const { html } = await mount({
    view: 'month',
    month: '2026-02',
    events: [
      { date: '2026-02-03', title: 'Good' },
      { date: 'not a date', title: 'No date' },
      { date: '2026-02-04', title: '' },
      { date: '', time: '', title: '' },
    ],
  });
  assert.equal(dayCell(html, 3).chips, 1);
  assert.match(html, /<p class="cm-note">2 rows skipped: each needs a date \(YYYY-MM-DD\) and a title\.<\/p>/);
  const { html: one } = await mount({
    view: 'month', month: '2026-02', events: [{ date: 'oops', title: 'No date' }],
  });
  assert.match(one, /1 row skipped/, 'the count reads as English at one');
});

// ── Choosing the month without a clock ──────────────────────────────────────

test('with no month and no dates the sheet asks, instead of guessing today', async () => {
  const { html } = await mount({ view: 'month' });
  assert.match(html, /<p class="cm-hint">/);
  assert.ok(!html.includes('cm-grid'), 'no grid is drawn from a date nobody entered');
  assert.match(html, /<h1 class="cm-title">Month grid<\/h1>/);
});

test('an empty month falls back to the earliest date entered', async () => {
  const fromEvent = await mount({ view: 'month', meetingTime: '2026-05-20T09:00' });
  assert.match(fromEvent.html, /<h1 class="cm-title">May 2026<\/h1>/);

  // A row earlier than the anchor event wins.
  const fromRow = await mount({
    view: 'month',
    meetingTime: '2026-05-20T09:00',
    events: [{ date: '2026-03-02', title: 'Kick-off' }],
  });
  assert.match(fromRow.html, /<h1 class="cm-title">March 2026<\/h1>/);

  // The input always wins over both.
  const explicit = await mount({
    view: 'month',
    month: '2026-11',
    meetingTime: '2026-05-20T09:00',
    events: [{ date: '2026-03-02', title: 'Kick-off' }],
  });
  assert.match(explicit.html, /<h1 class="cm-title">November 2026<\/h1>/);
});

test('the same inputs render the same sheet twice, whatever the wall clock says', async () => {
  const a = await mount(BUSY);
  const b = await mount(BUSY);
  assert.equal(a.html, b.html);
  // DTSTAMP is the one clock-derived line in the .ics and lives outside the render.
  assert.ok(!a.html.includes('DTSTAMP'));
});

// ── The rows are real calendar entries ──────────────────────────────────────

test('each "More dates" row becomes its own VEVENT', async () => {
  const { rt } = await mount({
    ...LIST_SEED,
    events: [
      { date: '2026-09-15', time: '11:00', title: 'Roadmap review' },
      { date: '2026-09-16', title: 'Offsite' },
      { date: 'nope', title: 'skipped' },
    ],
  });
  const text = ics(rt);
  assert.equal((text.match(/BEGIN:VEVENT/g) ?? []).length, 3, 'the card event plus the two valid rows');
  assert.ok(text.includes('DTSTART:20260915T110000\r\nDTEND:20260915T120000'), 'a timed row books an hour');
  assert.ok(text.includes('DTSTART;VALUE=DATE:20260916\r\nDTEND;VALUE=DATE:20260917'),
    'an untimed row books the whole day, DTEND exclusive per RFC 5545');
  assert.ok(text.includes('SUMMARY:Roadmap review'));
  assert.ok(!text.includes('SUMMARY:skipped'));
  assert.ok(text.endsWith('END:VCALENDAR\r\n'));
  // A row title with RFC TEXT metacharacters is escaped, not injected.
  const { rt: nasty } = await mount({
    ...LIST_SEED,
    events: [{ date: '2026-09-15', title: 'Budget; costs, phase 1\r\nSUMMARY:forged' }],
  });
  assert.ok(ics(nasty).includes('Budget\\; costs\\, phase 1\\nSUMMARY:forged'));
  assert.equal((ics(nasty).match(/\r\nSUMMARY:/g) ?? []).length, 2, 'no third SUMMARY was forged');
});

test('a month sheet survives the URL round trip, so the CLI draws the same grid', async () => {
  const { rt, html } = await mount(BUSY);
  const query = serializeUrlState(rt.getModel() as any);
  const back = parseUrlState(new URLSearchParams(query), tool.manifest);
  assert.equal(back.values.month, '2026-02');
  assert.equal(back.values.view, 'month');
  const { html: again } = await mount(back.values);
  assert.equal(again, html);
});

// ── The invented hour must not reach the grid ───────────────────────────────

test('a late-evening event with no end stays on one day', async () => {
  // With Ends blank the .ics books an hour, which for 23:30 runs past midnight.
  // The grid must not read that invented hour as a two-day span (which would also
  // blank the chip's start time).
  const { html } = await mount({
    view: 'month', month: '2026-02', eventName: 'Late sync', meetingTime: '2026-02-11T23:30',
  });
  assert.equal(dayCell(html, 11).chips, 1);
  assert.match(dayCell(html, 11).body, /<span class="cm-chip-t">11:30 PM<\/span>Late sync/);
  assert.equal(dayCell(html, 12).chips, 0, 'the next day carries nothing the user did not enter');

  // An end the user actually typed still spans, midnight crossing included.
  const { html: typed } = await mount({
    view: 'month', month: '2026-02', eventName: 'Night shift',
    meetingTime: '2026-02-11T23:30', meetingEndTime: '2026-02-12T00:30',
  });
  assert.equal(dayCell(typed, 11).chips, 1);
  assert.equal(dayCell(typed, 12).chips, 1);
});

test('a leading-zero year is refused, not drawn as the 1900s', async () => {
  // JS maps years 0-99 onto 1900-1999, so "0026-02" would head the sheet
  // "February 26" over February 1926's weekdays.
  const { html } = await mount({ view: 'month', month: '0026-02' });
  assert.match(html, /<p class="cm-hint">/);
  assert.ok(!html.includes('cm-grid'), 'no grid is drawn for a year the sheet cannot honour');

  // With a real date entered the sheet uses that month rather than the bad input.
  const { html: fallback } = await mount({
    view: 'month', month: '0026-02', meetingTime: '2026-05-20T09:00',
  });
  assert.match(fallback, /<h1 class="cm-title">May 2026<\/h1>/);
});

test('the sheet carries its accent as fill, never a one-sided edge', async () => {
  // House rule: a coloured border on one side of a rounded shape is banned. The
  // grid's own hairlines are neutral rules between cells, which is a different thing.
  const css = await readFile(join(PKG, 'styles.css'), 'utf8');
  const sheet = css.slice(css.indexOf('.cm-sheet'));
  const sided = [...sheet.matchAll(/border-(?:left|right|top|bottom)\s*:[^;]+;/g)].map(m => m[0]);
  for (const rule of sided) {
    assert.ok(!/brand-primary|brand-secondary/.test(rule),
      `accent colour on a single edge: ${rule.trim()}`);
  }
});

// ── Seeds ───────────────────────────────────────────────────────────────────

test('every template and preset seed hydrates into a grid', async () => {
  const manifest = JSON.parse(await readFile(join(PKG, 'tool.json'), 'utf8'));
  const declared = new Set<string>(manifest.inputs.map((i: { id: string }) => i.id));

  const seeds: Array<[string, Record<string, unknown>]> = [];
  for (const ex of manifest.examples ?? []) seeds.push([`example "${ex.label}"`, ex.values]);

  const dir = join(PKG, 'templates');
  const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  assert.ok(files.length >= 1, 'the tool ships at least one starting template');
  for (const file of files) {
    const t = JSON.parse(await readFile(join(dir, file), 'utf8'));
    assert.equal(t.id, file.replace(/\.json$/, ''), `${file}: template id must match its basename`);
    seeds.push([`template "${t.id}"`, t.values]);
    for (const p of t.presets ?? []) {
      // A preset is a values OVERLAY on the template base, as the chooser applies it.
      seeds.push([`preset "${t.id}/${p.id}"`, { ...t.values, ...p.values }]);
    }
  }

  for (const [label, values] of seeds) {
    for (const key of Object.keys(values)) {
      assert.ok(declared.has(key), `${label} sets "${key}", which is not a declared input`);
    }
    const { rt, html } = await mount(values);
    assert.ok(html.includes('cm-grid') || html.includes('cal-card'), `${label} rendered nothing`);
    if (values.view === 'month') {
      assert.ok(!html.includes('cm-hint'), `${label} must seed a month, not the "set a month" note`);
      assert.ok(!html.includes('cm-note'), `${label} must not ship a skipped row`);
      assert.ok(html.includes('class="cm-chip"'), `${label} needs real sample dates on the grid`);
    }
    assert.ok(ics(rt).startsWith('BEGIN:VCALENDAR'), `${label} must still export a calendar`);
  }
});
