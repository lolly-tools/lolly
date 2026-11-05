/* global host */
/**
 * Week hooks.
 *
 * Reads the `events` table into day columns the logic-less template prints:
 * each event placed by its start and length as a share of the day shown, with
 * its status as a class. DOM-free and never throws: a row whose day or times
 * cannot be read is left out rather than guessed.
 *
 * Days read as names (Mon, monday), numbers (1 is Monday) or dates; with a
 * date in "Week of" the day headers show their dates. Times read as 10:00,
 * 9.30, 10, 2pm or 14h.
 */

var DAY_NAMES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
var DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
var STATUSES = { busy: 1, proposed: 1, declined: 1, tentative: 1, booked: 1 };
var STATUS_LABELS = { proposed: 'Proposed', declined: 'Declined', tentative: 'Tentative', booked: 'Booked' };

/** A yyyy-mm-dd date as a UTC Date, or null. */
function isoDate(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  if (!m) return null;
  var d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Monday of the week a date falls in. */
function mondayOf(d) {
  var back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * 864e5);
}

/** A day cell as 0 (Monday) to 6, or -1. */
function dayIndex(text, monday) {
  var s = String(text == null ? '' : text).trim().toLowerCase();
  if (!s) return -1;
  var date = isoDate(s);
  if (date) {
    if (monday) {
      var diff = Math.round((date.getTime() - monday.getTime()) / 864e5);
      return diff >= 0 && diff < 7 ? diff : -1;
    }
    return (date.getUTCDay() + 6) % 7;
  }
  if (/^[1-7]$/.test(s)) return Number(s) - 1;
  var i = DAY_NAMES.indexOf(s.slice(0, 3));
  return i;
}

/** A time cell as hours (10.5 for 10:30), or null. */
function hours(text) {
  var s = String(text == null ? '' : text).trim().toLowerCase().replace(/\s+/g, '');
  var m = /^(\d{1,2})(?:[:.h](\d{2}))?(am|pm|h)?$/.exec(s);
  if (!m) return null;
  var h = Number(m[1]), min = m[2] ? Number(m[2]) : 0;
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 24 || min > 59) return null;
  return h + min / 60;
}

function clock(h) {
  var hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return hh + ':' + (mm < 10 ? '0' : '') + mm;
}

function columnsOf(columns) {
  var names = (columns || []).map(function (c) { return String(c || '').trim().toLowerCase(); });
  var find = function (re, fallback) {
    for (var i = 0; i < names.length; i++) if (re.test(names[i])) return i;
    return fallback;
  };
  return {
    day: find(/^(day|date|weekday)$/, 0),
    start: find(/^(start|from|begins?)$/, 1),
    end: find(/^(end|to|until|ends?)$/, 2),
    title: find(/^(title|event|what|subject|name)$/, 3),
    status: find(/^(status|kind|type|state)$/, 4),
  };
}

function compute(v) {
  var count = String(v.days) === '7' ? 7 : 5;
  var from = Math.max(0, Math.min(23, Math.round(Number(v.fromHour)) || 0));
  var to = Math.max(from + 1, Math.min(24, Math.round(Number(v.toHour)) || 24));
  var span = to - from;
  var anchor = isoDate(v.weekOf);
  var monday = anchor ? mondayOf(anchor) : null;
  var table = v.events && typeof v.events === 'object' ? v.events : { columns: [], rows: [] };
  var at = columnsOf(table.columns);

  var days = [];
  for (var d = 0; d < count; d++) {
    var date = monday ? new Date(monday.getTime() + d * 864e5) : null;
    days.push({ label: DAY_LABELS[d], date: date ? String(date.getUTCDate()) : '', events: [] });
  }

  (Array.isArray(table.rows) ? table.rows : []).slice(0, 80).forEach(function (row) {
    if (!Array.isArray(row)) return;
    var cell = function (k) { return String(row[k] == null ? '' : row[k]).trim(); };
    var day = dayIndex(cell(at.day), monday);
    var start = hours(cell(at.start));
    var end = hours(cell(at.end));
    if (day < 0 || day >= count || start === null) return;
    if (end === null || end <= start) end = start + 1;
    var top = Math.max(start, from), bottom = Math.min(end, to);
    if (bottom <= top) return;
    var word = cell(at.status).toLowerCase().split(/\s+/)[0] || 'busy';
    var status = STATUSES[word] ? word : 'busy';
    days[day].events.push({
      title: cell(at.title),
      time: clock(start) + ' to ' + clock(end),
      status: 'is-' + status,
      statusLabel: STATUS_LABELS[status] || '',
      booked: status === 'booked',
      top: Math.round((top - from) / span * 1000) / 10 + '%',
      height: Math.round((bottom - top) / span * 1000) / 10 + '%',
    });
  });

  var marks = [];
  for (var h = from; h <= to; h++) marks.push({ label: clock(h), top: Math.round((h - from) / span * 1000) / 10 + '%' });

  var booked = null;
  days.forEach(function (day) { day.events.forEach(function (e) { if (e.booked && !booked) booked = day.label + (day.date ? ' ' + day.date : '') + ', ' + e.time.split(' to ')[0]; }); });

  return { weekDays: days, hourMarks: marks, dayCount: String(count), bookedText: booked || '' };
}

function _args(model) {
  return Object.fromEntries(model.map(function (i) { return [i.id, i.value]; }));
}

// biome-ignore lint/correctness/noUnusedVariables: The engine calls this named hook.
function onInit({ model }) {
  return compute(_args(model));
}

// biome-ignore lint/correctness/noUnusedVariables: The engine calls this named hook.
function onInput({ model }) {
  return compute(_args(model));
}
