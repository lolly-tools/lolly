/**
 * Calendar ICS — build a downloadable .ics (iCalendar / RFC 5545) from a few
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
 * Input ids deliberately match Meeting Planner (eventName, meetingTime, hostCity)
 * so one batch sheet's columns drive both tools (see memory pro-column-merge-input-ids).
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

// DTSTAMP — the UTC moment the file was generated.
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

function build(model) {
  const v = Object.fromEntries(model.map(i => [i.id, i.value]));
  const allDay = Boolean(v.allDay);

  // Start: the entered value, else today at 09:00 so the tool is valid out of the box.
  let start = parseLocal(v.meetingTime);
  if (!start) { start = new Date(); start.setHours(9, 0, 0, 0); }
  // End: the entered value if it's after the start, else a 1-hour event.
  let end = parseLocal(v.meetingEndTime);
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
  const uid = `${slug(name)}-${hash([name, dtStartLine, dtEndLine, v.hostCity || ''].join('|'))}@lolly.tools`;

  // ── Assemble RFC 5545-correct .ics (CRLF, folded, escaped) ──
  const L = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lolly//Calendar ICS//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    fold(`UID:${uid}`),
    `DTSTAMP:${utcStamp()}`,
    dtStartLine,
    dtEndLine,
    fold(`SUMMARY:${escText(name)}`),
  ];
  if ((v.hostCity || '').trim()) L.push(fold(`LOCATION:${escText(v.hostCity)}`));
  if ((v.description || '').trim()) L.push(fold(`DESCRIPTION:${escText(v.description)}`));
  if ((v.url || '').trim()) L.push(fold(`URL:${escUri(v.url)}`));
  if (trig) {
    L.push('BEGIN:VALARM', 'ACTION:DISPLAY', fold(`DESCRIPTION:${escText(name)}`), `TRIGGER:${trig}`, 'END:VALARM');
  }
  L.push('END:VEVENT', 'END:VCALENDAR');
  const ics = L.join('\r\n') + '\r\n';

  // ── Pretty values for the preview card ──
  const cardWhen = !multiDay
    ? `${WEEKDAYS[start.getDay()]}, ${start.getDate()} ${MONTHS[start.getMonth()]} ${start.getFullYear()}`
    : (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()
      ? `${wk3(start.getDay())} ${start.getDate()} – ${wk3(end.getDay())} ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`
      : `${wk3(start.getDay())} ${start.getDate()} ${mon3(start.getMonth())} → ${wk3(end.getDay())} ${end.getDate()} ${mon3(end.getMonth())} ${end.getFullYear()}`);

  const cardTimeRange = allDay
    ? (multiDay ? `All day · ${dayCount} days` : 'All day')
    : (multiDay ? `${time12(start)} → ${time12(end)}` : `${time12(start)} – ${time12(end)}`);

  return {
    ics, // consumed by template.ics ({{{ics}}})
    // preview card
    cardTitle: name.trim() || 'Untitled event',
    cardMonth: mon3(start.getMonth()).toUpperCase(),
    cardDay: String(start.getDate()),
    cardTileSub: multiDay ? `→ ${wk3(end.getDay())} ${end.getDate()}` : WEEKDAYS[start.getDay()],
    cardWhen,
    cardTimeRange,
    multiDay,
    hasLocation: Boolean((v.hostCity || '').trim()),
    hasDescription: Boolean((v.description || '').trim()),
    hasUrl: Boolean((v.url || '').trim()),
    hasReminder: Boolean(trig),
    reminderLabel: REMINDER_LABEL[v.reminder] || '',
  };
}

async function onInit({ model }) { return build(model); }
async function onInput({ model }) { return build(model); }
