/**
 * Calendar ICS - build a downloadable .ics (iCalendar / RFC 5545) from a few
 * event fields, with a friendly card preview that can itself be exported (PNG/SVG).
 *
 * The .ics text is assembled HERE (not in the logic-less template) so it can be
 * fully RFC 5545-correct: CRLF line breaks, 75-octet content-line folding, strict
 * TEXT escaping that also neutralises CR/LF/control-char property injection, and a
 * stable content-hashed UID (re-exporting the same event updates it in a calendar
 * rather than duplicating). template.ics is a one-line passthrough of {{{ics}}}.
 *
 * Multi-day events need no extra inputs: set Starts (e.g. Monday) and Ends (e.g.
 * Friday). Timed multi-day spans across days; all-day multi-day books the whole
 * range (DTEND is the RFC-exclusive day after the last day).
 *
 * Input ids deliberately match Meeting Planner (eventName, meetingTime, city)
 * so one batch sheet's columns drive both tools (see memory pro-column-merge-input-ids).
 *
 * view=month draws the printable side of the same data: an ISO-week month grid
 * with the event (and every "More dates" row) placed as a chip. It reads no
 * clock - the month comes from the `month` input, else from the earliest date
 * the user actually entered, else the sheet asks for one. A hook that called
 * new Date() there would render a different sheet every month for the same URL.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const mon3 = i => MONTHS[i].slice(0, 3);
const wk3 = i => WEEKDAYS[i].slice(0, 3);
const REMINDER_LABEL = {
  '5': '5 minutes before', '10': '10 minutes before', '15': '15 minutes before',
  '30': '30 minutes before', '60': '1 hour before', '1440': '1 day before',
};

const pad = n => String(n).padStart(2, '0');

// Parse a datetime-local / date string ("2027-06-15T09:30" or "2027-06-15") as
// LOCAL wall-clock time (datetime-local carries no timezone).
function parseLocal(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/.exec(String(s || '').trim());
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0, 0, 0);
}

const basicDateTime = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const basicDate = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

// DTSTAMP - the UTC moment the file was generated.
function utcStamp() {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

// ── RFC 5545 text helpers ───────────────────────────────────────────────────
// TEXT value: escape \ ; , and fold ALL line breaks to the literal "\n" escape;
// strip every other control char so a raw CR/LF can't forge a new property
// (CRLF/CR injection). URI value: same control-char strip, but no comma escaping.
const escText = v => String(v ?? '')
  .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
  .replace(/\r\n|\r|\n/g, '\\n')
  .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '');
const escUri = v => String(v ?? '').replace(/[\x00-\x1F\x7F]/g, '');

const byteLen = ch => { const c = ch.codePointAt(0); return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; };
// Fold a content line to <=75 octets, continuations begin with a single space
// (codepoint-aware so a multi-byte char is never split).
function fold(line) {
  const out = []; let cur = '', len = 0;
  for (const ch of line) {
    const b = byteLen(ch);
    if (len + b > 75) { out.push(cur); cur = ' ' + ch; len = 1 + b; }
    else { cur += ch; len += b; }
  }
  out.push(cur);
  return out.join('\r\n');
}

// Stable, low-collision UID: a content hash (name + start + end + location) keeps
// re-exports of the SAME event identical (calendar updates, not duplicates) while
// distinct events differ. djb2 → base36.
function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'event';

function time12(d) {
  let h = d.getHours();
  const ap = h < 12 ? 'AM' : 'PM';
  h = h % 12 || 12;
  return `${h}:${pad(d.getMinutes())} ${ap}`;
}

// minutes-before → an iCalendar relative TRIGGER ("-PT15M", "-PT1H", "-P1D").
function alarmTrigger(mins) {
  const n = parseInt(mins, 10);
  if (!n) return '';
  if (n % 1440 === 0) return `-P${n / 1440}D`;
  if (n % 60 === 0) return `-PT${n / 60}H`;
  return `-PT${n}M`;
}

// ── Month grid (view=month) ─────────────────────────────────────────────────
// At most this many chips per day before the cell collapses to "+N more".
const MAX_CHIPS = 3;
const DAY_MS = 86400000;
// A month span can't be longer than this; the guard keeps a nonsense end date
// (a typo'd year) from spinning the placement loop.
const MAX_SPAN_DAYS = 366;

const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const midnight = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// "2026-09" → { y: 2026, m: 8 }. Anything else (including blank) → null.
// A leading-zero year ("0026-09") is refused rather than drawn: JS maps years 0-99
// onto 1900-1999, so it would head the sheet "September 26" over 1926's weekdays.
function parseMonthKey(s) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(s || '').trim());
  if (!m) return null;
  const mo = +m[2];
  return mo >= 1 && mo <= 12 && +m[1] >= 1000 ? { y: +m[1], m: mo - 1 } : null;
}

// ISO-8601 week number: the week owning the Thursday, counted from the week
// owning 4 January. Monday based by definition of the standard.
function isoWeek(d) {
  const t = midnight(d);
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + 3);       // this week's Thursday
  const firstThu = new Date(t.getFullYear(), 0, 4);
  firstThu.setDate(firstThu.getDate() - ((firstThu.getDay() + 6) % 7) + 3);
  return 1 + Math.round((t - firstThu) / (7 * DAY_MS));
}

// The "More dates" rows as events. A row needs a parseable date AND a title;
// the rest are counted so the sheet can say so instead of losing them quietly.
function parseRows(rows) {
  const events = [];
  let skipped = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== 'object') { skipped++; continue; }
    const title = String(row.title ?? '').trim();
    const start = parseLocal(row.date);
    if (!start || !title) {
      // A wholly empty row is the block editor's blank line, not a mistake.
      if (title || String(row.date ?? '').trim() || String(row.time ?? '').trim()) skipped++;
      continue;
    }
    // "9:30", "09:30" and a pasted "09:30:00" all read as a time; anything else
    // (including blank) makes the row an all-day entry.
    const t = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(row.time ?? '').trim());
    const timed = Boolean(t) && +t[1] <= 23 && +t[2] <= 59;
    if (timed) start.setHours(+t[1], +t[2], 0, 0);
    events.push({ start, end: null, title, allDay: !timed, sort: timed ? start.getHours() * 60 + start.getMinutes() : -1 });
  }
  return { events, skipped };
}

// One chip per day the event covers. A timed single-day event shows its start
// time; an all-day or multi-day one shows none.
function placeEvents(events, buckets) {
  for (const ev of events) {
    const first = midnight(ev.start);
    const last = ev.end ? midnight(ev.end) : first;
    const span = Math.min(MAX_SPAN_DAYS, Math.max(1, Math.round((last - first) / DAY_MS) + 1));
    for (let i = 0; i < span; i++) {
      const key = dayKey(new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));
      const chip = {
        title: ev.title,
        time: ev.allDay || span > 1 ? '' : time12(ev.start),
        sort: ev.allDay ? -1 : ev.sort,
      };
      (buckets[key] || (buckets[key] = [])).push(chip);
    }
  }
}

function monthView(v, all, skipped) {
  // Which month? The input wins; else the earliest date actually entered. No
  // clock fallback - see the file header.
  let picked = parseMonthKey(v.month);
  if (!picked && all.length) {
    const earliest = all.reduce((a, b) => (b.start < a.start ? b : a));
    picked = { y: earliest.start.getFullYear(), m: earliest.start.getMonth() };
  }
  if (!picked) {
    return {
      isMonth: true,
      needsMonth: true,
      monthTitle: 'Month grid',
    };
  }

  const buckets = {};
  placeEvents(all, buckets);

  const sunday = v.weekStart === 'sunday';
  const firstIdx = sunday ? 0 : 1;
  const first = new Date(picked.y, picked.m, 1);
  const offset = (first.getDay() - firstIdx + 7) % 7;
  const daysInMonth = new Date(picked.y, picked.m + 1, 0).getDate();
  const cellCount = Math.ceil((offset + daysInMonth) / 7) * 7;
  const showWeeks = Boolean(v.showWeekNumbers);

  const weeks = [];
  for (let i = 0; i < cellCount; i++) {
    const date = new Date(picked.y, picked.m, 1 - offset + i);
    if (i % 7 === 0) {
      // ISO weeks are Monday based, so a Sunday-start row is numbered by the
      // Monday that follows its first cell.
      weeks.push({ num: isoWeek(new Date(date.getFullYear(), date.getMonth(), date.getDate() + (sunday ? 1 : 0))), showWeeks, days: [] });
    }
    const chips = (buckets[dayKey(date)] || []).slice().sort((a, b) => a.sort - b.sort);
    const overflow = Math.max(0, chips.length - MAX_CHIPS);
    weeks[weeks.length - 1].days.push({
      day: date.getDate(),
      dim: date.getMonth() !== picked.m,
      chips: chips.slice(0, MAX_CHIPS),
      more: overflow,
      moreLabel: overflow ? `+${overflow} more` : '',
    });
  }

  const weekdayNames = [];
  for (let i = 0; i < 7; i++) weekdayNames.push(wk3((firstIdx + i) % 7));

  return {
    isMonth: true,
    needsMonth: false,
    monthTitle: `${MONTHS[picked.m]} ${picked.y}`,
    weekdayNames,
    showWeeks,
    weeks,
    skippedRows: skipped,
    skippedNote: skipped
      ? `${skipped} row${skipped === 1 ? '' : 's'} skipped: each needs a date (YYYY-MM-DD) and a title.`
      : '',
  };
}

function build(model) {
  const v = Object.fromEntries(model.map(i => [i.id, i.value]));
  const allDay = Boolean(v.allDay);

  // Start: the entered value, else today at 09:00 so the tool is valid out of the box.
  // The month grid uses `entered` only: a clock-derived start would move the sheet.
  const entered = parseLocal(v.meetingTime);
  let start = entered;
  if (!start) { start = new Date(); start.setHours(9, 0, 0, 0); }
  // End: the entered value if it's after the start, else a 1-hour event.
  const enteredEnd = parseLocal(v.meetingEndTime);
  let end = enteredEnd;
  if (!end || end <= start) end = new Date(start.getTime() + 60 * 60 * 1000);

  // Day span (inclusive) for multi-day events.
  const startMid = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endMid = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const dayCount = Math.round((endMid - startMid) / 86400000) + 1;
  const multiDay = dayCount > 1;

  let dtStartLine, dtEndLine;
  if (allDay) {
    const endExclusive = new Date(endMid.getFullYear(), endMid.getMonth(), endMid.getDate() + 1);
    dtStartLine = `DTSTART;VALUE=DATE:${basicDate(start)}`;
    dtEndLine = `DTEND;VALUE=DATE:${basicDate(endExclusive)}`;
  } else {
    dtStartLine = `DTSTART:${basicDateTime(start)}`;
    dtEndLine = `DTEND:${basicDateTime(end)}`;
  }

  const trig = alarmTrigger(v.reminder);
  const name = v.eventName || '';
  const uid = `${slug(name)}-${hash([name, dtStartLine, dtEndLine, v.city || ''].join('|'))}@lolly.tools`;
  const stamp = utcStamp();

  // ── Assemble RFC 5545-correct .ics (CRLF, folded, escaped) ──
  const L = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lolly//Calendar ICS//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    fold(`UID:${uid}`),
    `DTSTAMP:${stamp}`,
    dtStartLine,
    dtEndLine,
    fold(`SUMMARY:${escText(name)}`),
  ];
  if ((v.city || '').trim()) L.push(fold(`LOCATION:${escText(v.city)}`));
  if ((v.description || '').trim()) L.push(fold(`DESCRIPTION:${escText(v.description)}`));
  if ((v.url || '').trim()) L.push(fold(`URL:${escUri(v.url)}`));
  if (trig) {
    L.push('BEGIN:VALARM', 'ACTION:DISPLAY', fold(`DESCRIPTION:${escText(name)}`), `TRIGGER:${trig}`, 'END:VALARM');
  }
  L.push('END:VEVENT');

  // "More dates" rows are real entries, so each valid one is its own VEVENT -
  // the printed grid and the imported calendar say the same thing. With no rows
  // (the default) not a byte of the file above changes.
  const { events: rowEvents, skipped: skippedRows } = parseRows(v.events);
  for (const ev of rowEvents) {
    const rowEnd = ev.allDay
      ? new Date(ev.start.getFullYear(), ev.start.getMonth(), ev.start.getDate() + 1)
      : new Date(ev.start.getTime() + 60 * 60 * 1000);
    const rowStartLine = ev.allDay
      ? `DTSTART;VALUE=DATE:${basicDate(ev.start)}`
      : `DTSTART:${basicDateTime(ev.start)}`;
    const rowEndLine = ev.allDay
      ? `DTEND;VALUE=DATE:${basicDate(rowEnd)}`
      : `DTEND:${basicDateTime(rowEnd)}`;
    L.push(
      'BEGIN:VEVENT',
      fold(`UID:${slug(ev.title)}-${hash([ev.title, rowStartLine, rowEndLine].join('|'))}@lolly.tools`),
      `DTSTAMP:${stamp}`,
      rowStartLine,
      rowEndLine,
      fold(`SUMMARY:${escText(ev.title)}`),
      'END:VEVENT',
    );
  }

  L.push('END:VCALENDAR');
  const ics = L.join('\r\n') + '\r\n';

  // ── Pretty values for the preview card ──
  const cardWhen = !multiDay
    ? `${WEEKDAYS[start.getDay()]}, ${start.getDate()} ${MONTHS[start.getMonth()]} ${start.getFullYear()}`
    : (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()
      ? `${wk3(start.getDay())} ${start.getDate()} - ${wk3(end.getDay())} ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`
      : `${wk3(start.getDay())} ${start.getDate()} ${mon3(start.getMonth())} → ${wk3(end.getDay())} ${end.getDate()} ${mon3(end.getMonth())} ${end.getFullYear()}`);

  const cardTimeRange = allDay
    ? (multiDay ? `All day · ${dayCount} days` : 'All day')
    : (multiDay ? `${time12(start)} → ${time12(end)}` : `${time12(start)} - ${time12(end)}`);

  // ── Month grid ──
  // Only the ENTERED start seeds the grid; the 09:00-today fallback above is a
  // convenience for the .ics, not a date the user chose.
  // Only an end the user actually typed can stretch the grid: the invented hour
  // above would turn a 23:30 meeting into a two-day band and hide its start time.
  const mainEvent = entered ? {
    start: entered,
    end: enteredEnd && enteredEnd > entered ? enteredEnd : null,
    title: name.trim() || 'Untitled event',
    allDay,
    sort: allDay ? -1 : entered.getHours() * 60 + entered.getMinutes(),
  } : null;
  const month = v.view === 'month'
    ? monthView(v, mainEvent ? [mainEvent, ...rowEvents] : rowEvents, skippedRows)
    : {};

  return {
    ics, // consumed by template.ics ({{{ics}}})
    ...month, // isMonth + the grid, only in view=month
    // preview card
    cardTitle: name.trim() || 'Untitled event',
    cardMonth: mon3(start.getMonth()).toUpperCase(),
    cardDay: String(start.getDate()),
    cardTileSub: multiDay ? `→ ${wk3(end.getDay())} ${end.getDate()}` : WEEKDAYS[start.getDay()],
    cardWhen,
    cardTimeRange,
    multiDay,
    hasLocation: Boolean((v.city || '').trim()),
    hasDescription: Boolean((v.description || '').trim()),
    hasUrl: Boolean((v.url || '').trim()),
    hasReminder: Boolean(trig),
    reminderLabel: REMINDER_LABEL[v.reminder] || '',
  };
}

async function onInit({ model }) { return build(model); }
async function onInput({ model }) { return build(model); }
