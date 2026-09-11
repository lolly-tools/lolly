/* global host */
/**
 * Agenda hooks.
 *
 * One table of sessions becomes three renders and a calendar file. Everything
 * the logic-less template prints is computed here; nothing throws, and a failure
 * comes back as the `error` extra, which the template shows in place of the
 * programme.
 *
 * Five things worth knowing before editing:
 *
 * 1. TRACKS ARE THE POINT. A track is any distinct, non-empty value in the
 *    table's Track column, ordered by first appearance, and that order is the
 *    column order of the timetable. A session with an empty Track cell belongs
 *    to everybody: it spans every column and is listed under the plenary name.
 *    Colours come from the ACTIVE design system through host.tokens, assigned
 *    round-robin, so a two-track meetup and a six-track summit both look native
 *    to the brand. A design system that offers nothing falls back to the literal
 *    ramp below, which is the only place a colour is hardcoded.
 *
 * 2. THE GRID IS COMPUTED, NOT DRAWN. Each day's slot boundaries are the sorted
 *    union of every start and end time in that day, so a 90-minute workshop and
 *    a 30-minute break share one lattice without either being rounded. A session
 *    gets colStart/colSpan from its track and rowStart/rowSpan from those
 *    boundaries; the template only prints them into CSS grid placements.
 *
 * 3. OVERLAPS ARE REPORTED, NEVER HIDDEN. Two sessions in the SAME track on the
 *    same day whose times cross are counted and named under the day heading. The
 *    grid still draws both (they sit side by side in the same column band), so
 *    the render shows the clash as well as counting it.
 *
 * 4. THE CLOCK IS ONLY EVER READ FOR THE BOARD, and only when the `now` input is
 *    empty. The list and the timetable are pure functions of the table, so the
 *    same link renders the same sheet forever; a board with `now` set is frozen
 *    the same way, which is what makes a test and an exported picture repeatable.
 *
 * 5. THE .ICS IS BUILT HERE, not in template.ics, for the same reason
 *    calendar-ics does it: RFC 5545 wants CRLF line endings, 75-octet content
 *    folding and escaping that also neutralises control characters, none of
 *    which a Handlebars text file can express. template.ics is a one-line
 *    passthrough of {{{ics}}}.
 */

// The only hardcoded colours in the tool: the track ramp a design system with no
// usable palette falls back to, plus the paper and ink the mixes are taken
// against. Muted rather than vivid, because a track colour is a background for
// black or white text at small sizes on paper.
var FALLBACK_TRACKS = ['#2f6f4f', '#2b5d8a', '#8a5a2b', '#6b3f7a', '#1f6f74', '#8a2f52', '#4d6a1f', '#4a4f7a'];
var PAPER_FALLBACK = '#ffffff';
var INK_FALLBACK = '#1f2933';

// Kinds the tool understands. Anything else in the Kind column is treated as an
// ordinary session and printed back as the user typed it, so a programme written
// in another language keeps its own words.
var KINDS = { session: 1, keynote: 1, workshop: 1, break: 1, social: 1 };

// A session with no end time runs this long, matching the calendar tool's "leave
// it blank for a one-hour event".
var DEFAULT_MINUTES = 60;

// A day is never longer than this many minutes past midnight, so a typo'd end
// time can't stretch the timetable into an unreadable sliver.
var DAY_END = 24 * 60;

var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// Column headings this tool recognises, in the order it falls back to when a
// heading matches nothing. A pasted spreadsheet keeps working when its headings
// are worded slightly differently, and a renamed heading still finds its column.
var COLUMNS = [
  { key: 'date', names: ['date', 'day'] },
  { key: 'start', names: ['start', 'starts', 'from', 'begins', 'time'] },
  { key: 'end', names: ['end', 'ends', 'to', 'until', 'finish'] },
  { key: 'title', names: ['title', 'session', 'what', 'name', 'talk'] },
  { key: 'speaker', names: ['speaker', 'speakers', 'who', 'presenter', 'host'] },
  { key: 'track', names: ['track', 'stream', 'strand', 'room track'] },
  { key: 'room', names: ['room', 'where', 'venue', 'place', 'location'] },
  { key: 'kind', names: ['kind', 'type', 'category'] },
  { key: 'note', names: ['note', 'notes', 'detail', 'details', 'description'] },
];

// ── small helpers ───────────────────────────────────────────────────────────

function str(v) {
  return String(v == null ? '' : v).trim();
}

function pad(n) {
  return (n < 10 ? '0' : '') + n;
}

// Own-property lookup only: a value of "constructor" or "__proto__" arriving
// from a URL would otherwise pick an inherited member.
function own(map, key) {
  return Object.prototype.hasOwnProperty.call(map, key);
}

// Accept #rgb / #rrggbb / #rrggbbaa with or without the hash; anything else
// takes the fallback. The alpha form is dropped rather than the whole colour: a
// design system token can carry alpha and a printed chip has no opacity.
function hex(v, fallback) {
  var m = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(str(v));
  if (!m) return fallback;
  var h = m[1].toLowerCase();
  if (h.length <= 4) return '#' + h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return '#' + h.slice(0, 6);
}

function rgb(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

// Straight 8-bit blend. Not perceptual, but these are hairlines and pale tints
// derived from two colours the design system already agreed on.
function mix(a, b, t) {
  var A = rgb(a);
  var B = rgb(b);
  var out = '#';
  for (var i = 0; i < 3; i++) {
    var v = Math.max(0, Math.min(255, Math.round(A[i] + (B[i] - A[i]) * t)));
    out += (v < 16 ? '0' : '') + v.toString(16);
  }
  return out;
}

// Hue in degrees, from an [r, g, b] triple. Only used to keep two track colours
// apart, so the plain HSL hue is enough - no perceptual model needed to know
// that two greens are two greens.
function hueOf(c) {
  var r = c[0] / 255;
  var g = c[1] / 255;
  var b = c[2] / 255;
  var max = Math.max(r, g, b);
  var min = Math.min(r, g, b);
  var d = max - min;
  if (!d) return 0;
  var h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

// Rec.709 luminance, the same test the certificate uses to pick a logo side.
function isDark(h) {
  var c = rgb(h);
  return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) < 140;
}

function contrastInk(h) {
  var c = rgb(h).map(function (v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  var l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return (1.05 / (l + 0.05)) >= ((l + 0.05) / 0.0556) ? '#ffffff' : '#111111';
}

// djb2 to base36. Short, stable and good enough to keep two sessions apart in a
// calendar UID.
function hash(s) {
  var h = 5381;
  for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// 'YYYY-MM-DD' to { y, m, d }, or null. A leading-zero year is refused rather
// than drawn: JS maps years 0-99 onto 1900-1999, so it would head the sheet with
// one century over another century's weekdays.
function parseDate(v) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(v));
  if (!m) return null;
  var y = Number(m[1]);
  var mo = Number(m[2]);
  var d = Number(m[3]);
  if (y < 1000 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y: y, m: mo, d: d };
}

// '09:30', '9:30', '0930' or '9' to minutes past midnight, or null.
function parseTime(v) {
  var s = str(v);
  var suffix = /(am|pm)\s*$/i.exec(s);
  var ampm = suffix ? suffix[1].toLowerCase() : '';
  if (ampm) s = s.slice(0, suffix.index);
  var m = /^(\d{1,2})[:.]?(\d{2})?$/.exec(s.trim());
  if (!m) return null;
  var h = Number(m[1]);
  var mi = m[2] ? Number(m[2]) : 0;
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  if (h > 24 || mi > 59) return null;
  return Math.min(DAY_END, h * 60 + mi);
}

function fmtTime(mins) {
  return pad(Math.floor(mins / 60) % 24) + ':' + pad(mins % 60);
}

function fmtDay(date) {
  var js = new Date(Date.UTC(date.y, date.m - 1, date.d));
  return WEEKDAYS[js.getUTCDay()] + ' ' + date.d + ' ' + MONTHS[date.m - 1] + ' ' + date.y;
}

// The value of an input, falling back to its PLACEHOLDER. The placeholder is a
// translated manifest string (the i18n sidecar overlays it before the model is
// built), so a word the render prints can be localized without the tool holding
// a word list of its own.
function wordOf(model, id, fallback) {
  for (var i = 0; i < model.length; i++) {
    if (model[i].id !== id) continue;
    var v = str(model[i].value);
    if (v) return v;
    var p = str(model[i].placeholder);
    if (p) return p;
  }
  return fallback;
}

// ── the design system's colours ─────────────────────────────────────────────
// Resolved ONCE per mount: onInput runs on every keystroke and the design system
// does not change under the tool. A host with no tokens, or a system with no
// usable colours, leaves the fallback ramp in place.

var _palette = null;

async function resolvePalette() {
  if (_palette) return _palette;
  var out = { tracks: FALLBACK_TRACKS.slice(), paper: PAPER_FALLBACK, ink: INK_FALLBACK };
  try {
    if (typeof host !== 'undefined' && host && host.tokens) {
      var picked = [];
      var hues = [];
      var seen = {};
      // A track colour has one job: to be told apart from the other track
      // colours, on paper and across a room. Three tests, all of them refusals
      // rather than corrections, because a design system's own colour is either
      // usable as a label or it is not.
      var take = function (v) {
        var h = hex(v, '');
        if (!h || own(seen, h)) return;
        var c = rgb(h);
        // 1. Not so pale that a chip disappears into the paper, and not so dark
        //    that it reads as ink.
        var lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
        if (lum > 200 || lum < 30) return;
        // 2. Not a grey: a system whose ink and surface are the only colours it
        //    has is better served by the ramp than by two shades of the same
        //    grey standing for two different rooms.
        var top = Math.max(c[0], c[1], c[2]);
        var bottom = Math.min(c[0], c[1], c[2]);
        if (top === 0 || (top - bottom) / top < 0.18) return;
        // 3. Not the same hue as one already taken. Two greens next to each
        //    other on a timetable is the failure this whole function exists to
        //    avoid, and a palette often carries several tints of one family.
        var hue = hueOf(c);
        for (var q = 0; q < hues.length; q++) {
          var d = Math.abs(hue - hues[q]);
          if (Math.min(d, 360 - d) < 25) return;
        }
        seen[h] = 1;
        hues.push(hue);
        picked.push(h);
      };
      if (host.tokens.colors) {
        var swatches = (await host.tokens.colors()) || [];
        for (var i = 0; i < swatches.length; i++) {
          var s = swatches[i] || {};
          var path = String(s.path || '');
          var group = String(s.group || '');
          if (path.indexOf('color.spectrum.') !== 0 && group !== 'Spectrum') continue;
          take(s.value);
        }
      }
      if (host.tokens.resolve) {
        var token = async function (path) {
          try {
            var v = await host.tokens.resolve('{' + path + '}');
            return (typeof v === 'string' && v) ? v : '';
          } catch (e) { return ''; }
        };
        // The semantic hues come after the spectrum: a design system with a full
        // spectrum leads with it, and a blank one still gets two real colours.
        take(await token('color.semantic.primary'));
        take(await token('color.semantic.secondary'));
        out.paper = hex(await token('color.semantic.surface'), PAPER_FALLBACK);
        out.ink = hex(await token('color.semantic.text'), INK_FALLBACK);
      }
      if (picked.length) {
        // Top up a short palette from the fallback ramp - through the same three
        // tests - so a six-track programme never repeats a hue while a two-track
        // one stays entirely on the design system's own colours.
        for (var j = 0; j < FALLBACK_TRACKS.length && picked.length < 8; j++) take(FALLBACK_TRACKS[j]);
        out.tracks = picked;
      }
    }
  } catch (e) { /* an unbranded host renders on the fallback ramp */ }
  _palette = out;
  return out;
}

// ── reading the table ───────────────────────────────────────────────────────

// Which cell index holds which field. An unmatched heading falls back to the
// position COLUMNS declares, so a table with no headings at all still reads.
function columnMap(columns) {
  var cols = Array.isArray(columns) ? columns : [];
  var map = {};
  var used = {};
  for (var i = 0; i < COLUMNS.length; i++) {
    var spec = COLUMNS[i];
    var found = -1;
    for (var c = 0; c < cols.length; c++) {
      if (own(used, String(c))) continue;
      var head = str(cols[c]).toLowerCase();
      if (spec.names.indexOf(head) >= 0) { found = c; break; }
    }
    if (found < 0 && i < cols.length && !own(used, String(i))) found = i;
    if (found >= 0) { map[spec.key] = found; used[String(found)] = 1; }
  }
  return map;
}

function readSessions(table) {
  var t = (table && typeof table === 'object') ? table : {};
  var rows = Array.isArray(t.rows) ? t.rows : [];
  var map = columnMap(t.columns);
  var cell = function (row, key) {
    var idx = own(map, key) ? map[key] : -1;
    return idx >= 0 ? str(row[idx]) : '';
  };
  var out = [];
  for (var r = 0; r < rows.length; r++) {
    var row = Array.isArray(rows[r]) ? rows[r] : [];
    var any = false;
    for (var c = 0; c < row.length; c++) if (str(row[c])) { any = true; break; }
    if (!any) continue;                              // a blank row is spacing, not data

    var rawDate = cell(row, 'date');
    var date = parseDate(rawDate);
    var start = parseTime(cell(row, 'start'));
    var end = parseTime(cell(row, 'end'));
    if (start === null) start = 0;
    if (end === null || end <= start) end = Math.min(DAY_END, start + DEFAULT_MINUTES);

    var rawKind = cell(row, 'kind');
    var kindKey = rawKind.toLowerCase();
    var known = own(KINDS, kindKey);

    out.push({
      index: r,
      dayKey: date ? (date.y + '-' + pad(date.m) + '-' + pad(date.d)) : rawDate,
      date: date,
      rawDate: rawDate,
      start: start,
      end: end,
      hasTime: parseTime(cell(row, 'start')) !== null,
      title: cell(row, 'title'),
      speaker: cell(row, 'speaker'),
      track: cell(row, 'track'),
      room: cell(row, 'room'),
      note: cell(row, 'note'),
      kind: known ? kindKey : (rawKind ? 'other' : 'session'),
      kindWord: known ? (rawKind.charAt(0).toUpperCase() + rawKind.slice(1).toLowerCase()) : rawKind,
    });
  }
  return out;
}

// ── shaping ─────────────────────────────────────────────────────────────────

// Distinct non-empty track names in order of first appearance, each with its
// colour and its column in the timetable.
function buildTracks(sessions, palette) {
  var names = [];
  var seen = {};
  for (var i = 0; i < sessions.length; i++) {
    var n = sessions[i].track;
    if (!n || own(seen, n)) continue;
    seen[n] = 1;
    names.push(n);
  }
  var ramp = palette.tracks.length ? palette.tracks : FALLBACK_TRACKS;
  return names.map(function (name, i) {
    var colour = ramp[i % ramp.length];
    return {
      name: name,
      index: i,
      col: i + 2,                                    // column 1 is the time gutter
      colour: colour,
      textColour: contrastInk(colour),
      // Pale enough to sit under body copy, strong enough to tell three tracks
      // apart at a glance.
      tint: mix(colour, palette.paper, 0.85),
      edge: mix(colour, palette.paper, 0.55),
    };
  });
}

function trackStyle(session, tracks, plenary, palette) {
  for (var i = 0; i < tracks.length; i++) {
    if (tracks[i].name === session.track) return tracks[i];
  }
  var grey = mix(palette.ink, palette.paper, 0.55);
  return {
    name: plenary,
    index: -1,
    col: 2,
    colour: grey,
    textColour: contrastInk(grey),
    tint: mix(grey, palette.paper, 0.9),
    edge: mix(grey, palette.paper, 0.6),
  };
}

// Sessions in the same track on the same day whose times cross. Counted per
// track so the warning can name the track the organiser has to fix.
function findOverlaps(sessions) {
  var byTrack = {};
  for (var i = 0; i < sessions.length; i++) {
    var key = sessions[i].trackKey;
    if (!own(byTrack, key)) byTrack[key] = [];
    byTrack[key].push(sessions[i]);
  }
  var out = [];
  for (var key2 in byTrack) {
    if (!own(byTrack, key2)) continue;
    var list = byTrack[key2].slice().sort(function (a, b) { return a.start - b.start; });
    var count = 0;
    for (var a = 0; a < list.length - 1; a++) {
      if (list[a + 1].start < list[a].end) count++;
    }
    if (count) out.push({ track: byTrack[key2][0].trackName, count: count });
  }
  return out;
}

// One day's timetable lattice: the sorted union of every start and end time in
// the day, then a placement per session against those boundaries.
function buildGrid(sessions, trackCount) {
  var marks = [];
  var seen = {};
  for (var i = 0; i < sessions.length; i++) {
    var s = sessions[i];
    if (!own(seen, String(s.start))) { seen[String(s.start)] = 1; marks.push(s.start); }
    if (!own(seen, String(s.end))) { seen[String(s.end)] = 1; marks.push(s.end); }
  }
  marks.sort(function (a, b) { return a - b; });
  var rowOf = {};
  for (var m = 0; m < marks.length; m++) rowOf[String(marks[m])] = m + 1;

  var bands = [];
  var rowTemplate = [];
  for (var b = 0; b < marks.length - 1; b++) {
    var minutes = Math.max(1, marks[b + 1] - marks[b]);
    bands.push({ label: fmtTime(marks[b]), row: b + 1 });
    // Is anything actually running across this band?
    var busy = false;
    for (var q = 0; q < sessions.length && !busy; q++) {
      if (sessions[q].start <= marks[b] && sessions[q].end >= marks[b + 1]) busy = true;
    }
    // A band is proportional to its own length, with a floor so a five-minute
    // changeover still has a readable line of its own and a ceiling so a long
    // block does not eat the sheet. An EMPTY band is drawn as a thin gap
    // whatever the clock says: the two dead hours before the evening party are
    // the one stretch of a programme nobody needs to see at full length.
    var weight = busy ? Math.min(75, Math.max(10, minutes)) : 10;
    rowTemplate.push('minmax(1.9em, ' + weight + 'fr)');
  }
  var span = Math.max(1, trackCount);
  var items = sessions.map(function (s) {
    var rowStart = rowOf[String(s.start)] || 1;
    var rowEnd = rowOf[String(s.end)] || (rowStart + 1);
    var wide = s.plenary || s.kind === 'break';
    return {
      session: s,
      colStart: wide ? 2 : s.col,
      colSpan: wide ? span : 1,
      rowStart: rowStart,
      rowSpan: Math.max(1, rowEnd - rowStart),
    };
  });
  return {
    slots: bands,
    items: items,
    lastTime: marks.length ? fmtTime(marks[marks.length - 1]) : '',
    rowTemplate: rowTemplate.join(' ') || 'minmax(1.9em, 1fr)',
    // A FIXED gutter, not auto: the head row and the lattice are two grid
    // containers, and an auto column would size to its own content, so the
    // track headings would sit a few pixels off the columns they name.
    colTemplate: 'calc(64 * var(--ag-u)) repeat(' + span + ', minmax(0, 1fr))',
  };
}

/**
 * The list layout. It is the timetable with rows sized by their CONTENT rather
 * than by the clock: one row per start time, the sessions that start together
 * laid out side by side in track order, and anything with no track (or a break)
 * on a full-width row of its own.
 *
 * Time flows down the page and tracks run across it, exactly as in the grid.
 * Two sessions running at once are never stacked one above the other, because
 * that reads as one following the other - which is the whole thing a programme
 * has to get right.
 */
function buildRows(sessions, tracks) {
  var span = Math.max(1, tracks.length);
  var colTemplate = 'calc(64 * var(--ag-u)) repeat(' + span + ', minmax(0, 1fr))';
  var starts = [];
  var seen = {};
  for (var i = 0; i < sessions.length; i++) {
    var key = String(sessions[i].start);
    if (own(seen, key)) continue;
    seen[key] = 1;
    starts.push(sessions[i].start);
  }
  starts.sort(function (a, b) { return a - b; });

  var rows = [];
  for (var t = 0; t < starts.length; t++) {
    var group = sessions.filter(function (s) { return s.start === starts[t]; });
    var tracked = [];
    for (var g = 0; g < group.length; g++) {
      var s = group[g];
      var wide = s.plenary || s.kind === 'break';
      if (wide) {
        rows.push({
          wide: true,
          timeText: fmtTime(s.start),
          colTemplate: colTemplate,
          wideSpan: span,
          session: s,
          cells: [],
        });
      } else {
        tracked.push(s);
      }
    }
    if (!tracked.length) continue;
    var cells = tracks.map(function () { return { has: false, sessions: [] }; });
    if (!cells.length) cells = [{ has: false, sessions: [] }];
    for (var k = 0; k < tracked.length; k++) {
      var idx = tracked[k].trackIndex >= 0 && tracked[k].trackIndex < cells.length ? tracked[k].trackIndex : 0;
      cells[idx].sessions.push(tracked[k]);
      cells[idx].has = true;
    }
    rows.push({
      wide: false,
      timeText: fmtTime(starts[t]),
      colTemplate: colTemplate,
      wideSpan: span,
      session: null,
      cells: cells,
    });
  }
  return { rows: rows, colTemplate: colTemplate, span: span };
}

// ── the calendar file ───────────────────────────────────────────────────────

// TEXT value per RFC 5545: escape backslash, semicolon and comma, fold every
// line break to the literal "\n" escape, and strip the remaining control
// characters so a pasted cell cannot forge a new property.
function escText(v) {
  return String(v == null ? '' : v)
    .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

function byteLen(ch) {
  var c = ch.codePointAt(0);
  return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
}

// Fold a content line to 75 octets; continuations begin with a single space.
// Codepoint-aware, so a multi-byte character is never split down the middle.
function fold(line) {
  var out = [];
  var cur = '';
  var len = 0;
  var chars = Array.from(line);
  for (var i = 0; i < chars.length; i++) {
    var b = byteLen(chars[i]);
    if (len + b > 75) { out.push(cur); cur = ' ' + chars[i]; len = 1 + b; }
    else { cur += chars[i]; len += b; }
  }
  out.push(cur);
  return out.join('\r\n');
}

// Minutes a zone is ahead of UTC at a given instant. Intl carries the zone rules,
// so this needs no table of its own and follows daylight saving.
function zoneOffset(ms, tz) {
  var parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ms));
  var f = {};
  for (var i = 0; i < parts.length; i++) f[parts[i].type] = parts[i].value;
  var asUtc = Date.UTC(Number(f.year), Number(f.month) - 1, Number(f.day),
    Number(f.hour) % 24, Number(f.minute), Number(f.second));
  return (asUtc - ms) / 60000;
}

// A wall-clock moment in a zone to the UTC instant it names. Two passes, because
// the offset that applies is the one AT the resolved instant, not at the guess -
// which is what makes the hour either side of a daylight change come out right.
function wallToUtc(date, minutes, tz) {
  var guess = Date.UTC(date.y, date.m - 1, date.d, Math.floor(minutes / 60), minutes % 60, 0);
  var off = zoneOffset(guess, tz);
  var utc = guess - off * 60000;
  var off2 = zoneOffset(utc, tz);
  if (off2 !== off) utc = guess - off2 * 60000;
  return utc;
}

function utcStampOf(ms) {
  var d = new Date(ms);
  return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' +
    pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
}

function floatingStamp(date, minutes) {
  return date.y + pad(date.m) + pad(date.d) + 'T' +
    pad(Math.floor(minutes / 60) % 24) + pad(minutes % 60) + '00';
}

/**
 * One VEVENT per session that has a real date and a title. DTSTART/DTEND carry
 * UTC instants when a zone is given and floating wall-clock times when it is
 * not; the UID is a hash of date, start and title, so re-exporting the same
 * programme updates a calendar instead of duplicating it.
 */
function buildIcs(sessions, args, plenary, tz) {
  var lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0',
    'PRODID:-//Lolly//Agenda//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
  ];
  var name = str(args.title);
  if (name) lines.push('X-WR-CALNAME:' + escText(name));
  if (tz) lines.push('X-WR-TIMEZONE:' + escText(tz));
  var stamp = utcStampOf(Date.now());
  var count = 0;
  for (var i = 0; i < sessions.length; i++) {
    var s = sessions[i];
    if (!s.date || !s.title) continue;
    var startStr, endStr;
    if (tz) {
      startStr = utcStampOf(wallToUtc(s.date, s.start, tz));
      endStr = utcStampOf(wallToUtc(s.date, s.end, tz));
    } else {
      startStr = floatingStamp(s.date, s.start);
      endStr = floatingStamp(s.date, s.end);
    }
    var desc = [s.speaker, s.note].filter(Boolean).join(' - ');
    lines.push('BEGIN:VEVENT');
    lines.push('UID:agenda-' + hash(s.dayKey + fmtTime(s.start) + s.title) + '-' + s.index + '@lolly.tools');
    lines.push('DTSTAMP:' + stamp);
    lines.push('DTSTART:' + startStr);
    lines.push('DTEND:' + endStr);
    lines.push('SUMMARY:' + escText(s.title));
    if (s.room) lines.push('LOCATION:' + escText(s.room));
    lines.push('CATEGORIES:' + escText(s.track || plenary));
    if (desc) lines.push('DESCRIPTION:' + escText(desc));
    lines.push('END:VEVENT');
    count++;
  }
  lines.push('END:VCALENDAR');
  return { text: lines.map(fold).join('\r\n') + '\r\n', count: count };
}

// ── the board ───────────────────────────────────────────────────────────────

// Wall-clock minutes since the epoch for a session, so "on now" is one integer
// comparison whatever the layout is doing with the day grouping.
function absMinutes(date, minutes) {
  return Date.UTC(date.y, date.m - 1, date.d) / 60000 + minutes;
}

function parseNowInput(v) {
  var m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/.exec(str(v));
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 60000 + Number(m[4]) * 60 + Number(m[5]);
}

// The device's own wall clock as the same integer. Read ONLY for a board with no
// `now` value; every other layout is a pure function of the table.
function wallNowMinutes() {
  var d = new Date();
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 60000 + d.getHours() * 60 + d.getMinutes();
}

function boardEntry(s) {
  return {
    title: s.title,
    speaker: s.speaker,
    room: s.room,
    startText: fmtTime(s.start),
    endText: fmtTime(s.end),
    kindWord: s.kindWord,
  };
}

function buildBoard(sessions, tracks, nowMin, plenary, palette, args) {
  var columns = [];
  var groups = [];
  for (var t = 0; t < tracks.length; t++) groups.push({ meta: tracks[t], list: [] });
  var plenaryMeta = trackStyle({ track: '' }, [], plenary, palette);
  var plenaryGroup = { meta: plenaryMeta, list: [] };
  for (var i = 0; i < sessions.length; i++) {
    var s = sessions[i];
    if (!s.date) continue;
    var g = plenaryGroup;
    for (var j = 0; j < groups.length; j++) if (groups[j].meta.name === s.track) g = groups[j];
    g.list.push(s);
  }
  var all = groups.concat(plenaryGroup.list.length ? [plenaryGroup] : []);
  var changeAt = null;
  for (var k = 0; k < all.length; k++) {
    var list = all[k].list.slice().sort(function (a, b) { return absMinutes(a.date, a.start) - absMinutes(b.date, b.start); });
    var current = null;
    var next = null;
    for (var n = 0; n < list.length; n++) {
      var abs = absMinutes(list[n].date, list[n].start);
      var absEnd = absMinutes(list[n].date, list[n].end);
      if (abs <= nowMin && nowMin < absEnd) { if (!current) current = list[n]; }
      else if (abs > nowMin && !next) next = list[n];
    }
    if (current) changeAt = changeAt === null ? absMinutes(current.date, current.end) : Math.min(changeAt, absMinutes(current.date, current.end));
    if (next) changeAt = changeAt === null ? absMinutes(next.date, next.start) : Math.min(changeAt, absMinutes(next.date, next.start));
    columns.push({
      name: all[k].meta.name,
      colour: all[k].meta.colour,
      textColour: all[k].meta.textColour,
      tint: all[k].meta.tint,
      edge: all[k].meta.edge,
      hasNow: !!current,
      now: current ? boardEntry(current) : null,
      hasNext: !!next,
      next: next ? boardEntry(next) : null,
      showSpeaker: args.showSpeakers !== false,
      showRoom: args.showRooms !== false,
    });
  }
  return {
    clock: fmtTime(((nowMin % 1440) + 1440) % 1440),
    columns: columns,
    hasColumns: columns.length > 0,
    changeAt: changeAt,
  };
}

// The board's own copy of the programme, for the template's ticking script. Kept
// to the fields the script rewrites, and emitted as JSON with "<" neutralised so
// the data island can never close its own script element.
function boardJson(sessions, tracks, plenary, palette, frozen) {
  var rows = [];
  for (var i = 0; i < sessions.length; i++) {
    var s = sessions[i];
    if (!s.date) continue;
    var meta = trackStyle(s, tracks, plenary, palette);
    rows.push({
      track: s.track || plenary,
      colour: meta.colour,
      start: absMinutes(s.date, s.start),
      end: absMinutes(s.date, s.end),
      startText: fmtTime(s.start),
      endText: fmtTime(s.end),
      title: s.title,
      speaker: s.speaker,
      room: s.room,
    });
  }
  var doc = { frozen: !!frozen, sessions: rows };
  return JSON.stringify(doc)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// ── the whole render ────────────────────────────────────────────────────────

function build(model, args, palette) {
  var style = ['editorial', 'minimal', 'night'].indexOf(args.style) >= 0 ? args.style : 'editorial';
  if (style === 'night') palette = {
    tracks: palette.tracks,
    paper: mix(isDark(palette.paper) ? palette.paper : palette.ink, '#000000', 0.25),
    ink: '#f4f6f8',
  };
  var plenary = wordOf(model, 'plenaryLabel', 'Plenary');
  var raw = readSessions(args.sessions);
  var tracks = buildTracks(raw, palette);
  var mode = args.layout === 'grid' ? 'grid' : (args.layout === 'board' ? 'board' : 'list');
  var showSpeakers = args.showSpeakers !== false;
  var showRooms = args.showRooms !== false;

  // Decorate each session once: the track it belongs to, its colours and the
  // strings all three layouts print.
  for (var i = 0; i < raw.length; i++) {
    var s = raw[i];
    var meta = trackStyle(s, tracks, plenary, palette);
    s.plenary = !s.track;
    s.trackName = meta.name;
    s.trackKey = s.track || '\u0000plenary';
    s.trackIndex = meta.index;
    s.col = meta.col;
    s.colour = meta.colour;
    s.textColour = meta.textColour;
    s.tint = meta.tint;
    s.edge = meta.edge;
    s.timeText = fmtTime(s.start) + ' - ' + fmtTime(s.end);
    s.startText = fmtTime(s.start);
    s.endText = fmtTime(s.end);
    s.isBreak = s.kind === 'break';
    s.isSocial = s.kind === 'social';
    s.hasKind = !!s.kindWord && s.kind !== 'session';
    s.showSpeaker = showSpeakers && !!s.speaker;
    s.showRoom = showRooms && !!s.room;
    s.hasNote = !!s.note;
  }

  // Group by day. Rows whose Date cell is not a real date keep their own group,
  // sorted after the dated ones, so a typo is visible rather than swallowed.
  var order = [];
  var byDay = {};
  for (var d = 0; d < raw.length; d++) {
    var key = raw[d].dayKey;
    if (!own(byDay, key)) { byDay[key] = []; order.push(key); }
    byDay[key].push(raw[d]);
  }
  order.sort(function (a, b) {
    var da = parseDate(a);
    var db = parseDate(b);
    if (da && db) return a < b ? -1 : (a > b ? 1 : 0);
    if (da) return -1;
    if (db) return 1;
    return a < b ? -1 : (a > b ? 1 : 0);
  });

  var allOverlaps = [];
  var days = order.map(function (key) {
    var list = byDay[key].slice().sort(function (a, b) {
      if (a.start !== b.start) return a.start - b.start;
      if (a.col !== b.col) return a.col - b.col;
      return a.index - b.index;
    });
    var date = parseDate(key);
    var clashes = findOverlaps(list);
    var total = 0;
    for (var c = 0; c < clashes.length; c++) {
      total += clashes[c].count;
      allOverlaps.push({ day: key, track: clashes[c].track, count: clashes[c].count });
    }
    var warning = clashes.map(function (o) {
      return o.count + (o.count === 1 ? ' overlap in ' : ' overlaps in ') + o.track;
    }).join(', ');
    return {
      key: key,
      label: date ? fmtDay(date) : key,
      hasLabel: !!key,
      sessions: list,
      count: list.length,
      timeRange: list.length ? fmtTime(list[0].start) + ' – ' + fmtTime(Math.max.apply(null, list.map(function (s) { return s.end; }))) : '',
      warning: warning,
      hasWarning: !!warning,
      overlapCount: total,
      grid: buildGrid(list, tracks.length),
      list: buildRows(list, tracks),
    };
  });

  var frozen = !!parseNowInput(args.now);
  var nowMin = frozen ? parseNowInput(args.now) : (mode === 'board' ? wallNowMinutes() : 0);
  var board = mode === 'board' ? buildBoard(raw, tracks, nowMin, plenary, palette, args) : null;
  var ics = buildIcs(raw, args, plenary, args.icsZone || '');

  return {
    error: '',
    mode: mode,
    programmeStyle: style,
    isList: mode === 'list',
    isGrid: mode === 'grid',
    isBoard: mode === 'board',
    isCompact: args.compact === true,

    headingText: str(args.title),
    subtitleText: str(args.subtitle),
    plenaryName: plenary,

    days: days,
    dayCount: days.length,
    multiDay: days.length > 1,
    tracks: tracks,
    trackCount: tracks.length,
    hasTracks: tracks.length > 0,
    sessionCount: raw.length,
    isEmpty: raw.length === 0,
    overlaps: allOverlaps,

    nowNext: board,
    boardFrozen: frozen,
    boardJson: mode === 'board' ? boardJson(raw, tracks, plenary, palette, frozen) : '',
    boardNowLabel: wordOf(model, 'nowLabel', 'Now'),
    boardNextLabel: wordOf(model, 'nextLabel', 'Next'),

    ics: ics.text,
    icsCount: ics.count,
    zoneWarning: args.zoneWarning || '',

    paperColor: args.transparentBg === true ? 'transparent' : palette.paper,
    inkColor: palette.ink,
    mutedColor: mix(palette.ink, palette.paper, 0.42),
    ruleColor: mix(palette.ink, palette.paper, 0.82),
    accentColor: palette.tracks[0] || palette.ink,
    flagColor: isDark(palette.paper) ? '#ffba99' : '#9a3412',
  };
}

function blank(note, palette) {
  var out = build([], {}, palette || { tracks: FALLBACK_TRACKS, paper: PAPER_FALLBACK, ink: INK_FALLBACK });
  out.error = note;
  return out;
}

async function compute(model) {
  var args = {};
  for (var i = 0; i < model.length; i++) args[model[i].id] = model[i].value;
  var palette = await resolvePalette();
  try {
    // A time zone is only honoured when this device can actually resolve it;
    // an unknown name falls back to floating times and says so rather than
    // writing a calendar file full of the wrong moments.
    var tz = str(args.tz);
    if (tz) {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        args.icsZone = tz;
      } catch (e) {
        args.icsZone = '';
        args.zoneWarning = 'Unknown time zone - the calendar file keeps floating times.';
      }
    }
    return build(model, args, palette);
  } catch (err) {
    return blank('This programme could not be laid out. Check the dates and times in the table.', palette);
  }
}

function onInit({ model }) {
  return compute(model);
}

function onInput({ model }) {
  return compute(model);
}
