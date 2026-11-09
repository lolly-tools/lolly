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
  return surfaceRender(model);
}

// biome-ignore lint/correctness/noUnusedVariables: The engine calls this named hook.
function onInput({ model }) {
  return surfaceRender(model);
}

async function surfaceRender(model) {
  var values = _args(model);
  var palette = await toolSurface(values, {});
  return Object.assign(await compute(values), palette);
}

// === lolly:shared tool-surface - generated from community/_shared/tool-surface.js; edit there and run pnpm run sync:shared ===
function surfaceHex(value, fallback) {
  if (value && typeof value === 'object' && Array.isArray(value.components)) {
    var space = value.colorSpace || 'srgb';
    if (space === 'srgb' && value.components.length === 3 && value.components.every(Number.isFinite)) {
      value = '#' + value.components.map(function (n) { return Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, '0'); }).join('');
    } else value = 'color(' + space + ' ' + value.components.join(' ') + ')';
  }
  if (host.color && typeof host.color.mix === 'function') {
    try {
      var normalized = host.color.mix(String(value), String(value), 0);
      if (normalized && /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(normalized)) return normalized.slice(0, 7);
    } catch (_) { /* Try the plain hex form below. */ }
  }
  var match = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(String(value || '').trim());
  if (!match) return fallback;
  var hex = match[1];
  if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
  return '#' + hex.slice(0, 6).toLowerCase();
}

function surfaceMix(a, b, amount) {
  if (host.color && typeof host.color.mix === 'function') {
    try { return surfaceHex(host.color.mix(a, b, amount), a); } catch (_) { /* Use sRGB below. */ }
  }
  return '#' + [1, 3, 5].map(function (at) {
    var first = parseInt(a.slice(at, at + 2), 16);
    var last = parseInt(b.slice(at, at + 2), 16);
    return Math.round(first + (last - first) * amount).toString(16).padStart(2, '0');
  }).join('');
}

function surfaceContrast(a, b) {
  function luminance(hex) {
    var channels = [1, 3, 5].map(function (at) {
      var c = parseInt(hex.slice(at, at + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  var x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function surfaceReadable(preferred, ground, alternatives) {
  if (surfaceContrast(preferred, ground) >= 4.5) return preferred;
  var choices = alternatives.concat(['#111111', '#ffffff']);
  return choices.reduce(function (best, colour) {
    return surfaceContrast(colour, ground) > surfaceContrast(best, ground) ? colour : best;
  }, preferred);
}

async function toolSurface(values, aliases) {
  aliases = aliases || {};
  async function readToken(path) {
    try {
      if (host.tokens && typeof host.tokens.resolve === 'function') {
        return await host.tokens.resolve('{' + path + '}');
      }
      if (host.tokens && typeof host.tokens.get === 'function') {
        var set = await host.tokens.get();
        if (set && typeof set.resolve === 'function') return set.resolve('{' + path + '}');
      }
    } catch (_) { /* A tool without a design system still draws. */ }
    return null;
  }
  var colours = await Promise.all([
    readToken('color.semantic.primary'), readToken('color.semantic.on-primary'),
    readToken('color.semantic.surface'), readToken('color.semantic.text'),
  ]);
  colours = colours.map(function (c, i) { return surfaceHex(c, ['#2563eb', '#ffffff', '#f6f7f9', '#17232b'][i]); });
  var primary = surfaceHex(values[aliases.accent || 'accent'], colours[0]);
  var paper = surfaceHex(values[aliases.background || 'background'], colours[2]);
  var text = surfaceHex(values[aliases.ink || 'ink'], colours[3]);
  var ground = values.ground || 'tint';
  var fill = ground === 'lead' ? primary : ground === 'ink' ? text
    : ground === 'surface' ? paper : surfaceMix(paper, primary, 0.1);
  var ink = ground === 'lead' ? colours[1] : ground === 'ink' ? paper : text;
  ink = surfaceReadable(ink, fill, [text, paper, colours[1]]);
  var accent = primary;
  for (var amount = 0.1; surfaceContrast(accent, fill) < 4.5 && amount <= 1.01; amount += 0.1) {
    accent = surfaceMix(primary, ink, Math.min(1, amount));
  }
  var onAccent = surfaceReadable(colours[1], accent, [fill, text, paper]);
  var density = values.density || 'auto';
  var chars = JSON.stringify(['body', 'heading', 'subheading', 'quote', 'criteria', 'events', 'data',
    'directions', 'blocks', 'content', 'company', 'firstname', 'lastname', 'description', 'title']
    .map(function (key) { return values[key]; })).length;
  var spacing = density === 'compact' ? 0.78 : density === 'spacious' ? 1.16
    : density === 'comfortable' ? 1 : chars > 4500 ? 0.78 : chars > 2400 ? 0.9 : 1;
  var timing = await readToken('motion.duration.long');
  var ms = 700;
  if (typeof timing === 'number' && Number.isFinite(timing)) ms = timing;
  else if (timing && typeof timing === 'object' && typeof timing.value === 'number') {
    ms = timing.value * (timing.unit === 's' ? 1000 : 1);
  } else if (typeof timing === 'string') {
    var match = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(timing.trim());
    if (match) ms = Number(match[1]) * (match[2] === 's' ? 1000 : 1);
  }
  var curve = await readToken('motion.curve.emphasised');
  if (!Array.isArray(curve) || curve.length !== 4 || !curve.every(Number.isFinite)
      || curve[0] < 0 || curve[0] > 1 || curve[2] < 0 || curve[2] > 1) curve = [0.2, 0, 0, 1];
  return {
    surfaceGround: values.transparentBg === true || values.transparentBg === 'true' ? 'transparent' : fill,
    surfacePaper: fill,
    surfaceInk: ink,
    surfaceAccent: accent,
    surfaceOnAccent: onAccent,
    surfaceMuted: surfaceMix(ink, fill, 0.22),
    surfaceEdge: surfaceMix(fill, ink, 0.2),
    surfacePanel: surfaceMix(fill, ink, 0.045),
    surfaceTint: surfaceMix(fill, accent, 0.12),
    surfaceSpacing: String(spacing),
    surfaceEnterSeconds: String(Math.max(0, Math.min(3000, ms)) / 1000),
    surfaceCurve: curve.join(','),
  };
}
// === /lolly:shared tool-surface ===
