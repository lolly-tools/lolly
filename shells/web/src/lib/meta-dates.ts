// SPDX-License-Identifier: MPL-2.0
/**
 * One style for every date in a details list (Added, Modified, Imported, Taken and
 * a shared asset's source dates): the app language's short-month date, "Oct 31, 2026"
 * in English, followed by the short time of day where the time matters. A reader
 * whose browser asks for a regional form of the app's language, English in Australia
 * say, gets that region's order ("31 Oct 2026").
 *
 * Two kinds of value come in, and they are shown differently on purpose.
 *  - An instant (a millisecond stamp, or an ISO string with a zone that Lolly or a
 *    server wrote) is shown in the reader's own time zone.
 *  - A value written without a zone (a camera's EXIF date-time, a catalog's
 *    YYYY-MM-DD) is shown exactly as written. Nothing records the zone it was written
 *    in, so moving it through the browser's zone would show a time nobody saw.
 */
import { currentLang } from '../i18n.ts';

const DATE: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
const shortTimes = new Map<string, Intl.DateTimeFormatOptions>();

/**
 * The locale's own short time ("9:41 AM", "09:41") as component options, so it can sit
 * beside the date's components in one format: a date style and a time style cannot be
 * mixed with components, and the medium date style is not the Added style in every
 * language (German writes it 12.10.2026). Read off one sample time: whether the hour
 * is written with two digits, and the locale's hour cycle.
 */
function shortTime(locale: string): Intl.DateTimeFormatOptions {
  let options = shortTimes.get(locale);
  if (!options) {
    const sample = new Intl.DateTimeFormat(locale, { timeStyle: 'short', timeZone: 'UTC' });
    const hour = sample.formatToParts(Date.UTC(2000, 0, 1, 9, 5)).find(part => part.type === 'hour')?.value ?? '';
    options = { hour: hour.length > 1 ? '2-digit' : 'numeric', minute: '2-digit', hourCycle: sample.resolvedOptions().hourCycle };
    shortTimes.set(locale, options);
  }
  return options;
}

export interface DateStyle {
  /** Add the short time of day after the date. */
  time?: boolean;
  /** A BCP 47 locale to write in, for tests. Defaults to {@link dateLocale}. */
  locale?: string;
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : navigator.language ? [navigator.language] : [];
}

/** Language and script, so a Traditional Chinese interface never takes a Simplified region. */
function sameWriting(a: string, b: string): boolean {
  try {
    const x = new Intl.Locale(a).maximize(), y = new Intl.Locale(b).maximize();
    return x.language === y.language && x.script === y.script;
  } catch { return false; }
}

/**
 * The locale dates are written in: the first browser language that writes the app's
 * language (keeping its region's day and month order), else the app language itself.
 */
export function dateLocale(lang: string = currentLang(), preferred: readonly string[] = browserLanguages()): string {
  return preferred.find(code => sameWriting(code, lang)) ?? lang;
}

function write(date: Date, style: DateStyle, timeZone?: string): string {
  const options = (locale: string | undefined): Intl.DateTimeFormatOptions =>
    ({ ...DATE, ...(style.time ? shortTime(locale ?? new Intl.DateTimeFormat().resolvedOptions().locale) : {}), ...(timeZone ? { timeZone } : {}) });
  const locale = style.locale ?? dateLocale();
  try { return new Intl.DateTimeFormat(locale, options(locale)).format(date); }
  catch { return new Intl.DateTimeFormat(undefined, options(undefined)).format(date); }
}

/** An instant, in the reader's own zone. Empty for a value that is not a time. */
export function formatMetaInstant(value: number | string | Date, style: DateStyle = {}): string {
  const date = value instanceof Date ? value : new Date(typeof value === 'string' ? Date.parse(value) : value);
  return Number.isNaN(date.getTime()) ? '' : write(date, style);
}

// YYYY:MM:DD (EXIF) or YYYY-MM-DD (ISO), then an optional HH:MM[:SS[.fff]] and an
// optional zone, which is ignored: the clock reading is shown as it was written.
const WRITTEN = /^(\d{4})[:-](\d{2})[:-](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:[.,]\d+)?)?)?(?:\s*(?:Z|[+-]\d{2}:?\d{2}))?$/i;

/**
 * A date or date-time written without a zone, shown as written, with its time of day
 * when the text has one. A camera that never set its clock writes zeros, which is no
 * date, so that comes back empty and the row is left out. Text in any other form
 * comes back trimmed and unchanged.
 */
export function formatWrittenDate(text: string, style: DateStyle = {}): string {
  const trimmed = text.trim();
  const m = WRITTEN.exec(trimmed);
  if (!m) return /^[\s0:\-T]*$/.test(trimmed) ? '' : trimmed;
  const [year, month, day, hour, minute] = [m[1], m[2], m[3], m[4], m[5]].map(part => part === undefined ? undefined : Number(part));
  if (!year || !month || !day) return '';
  const hasTime = hour !== undefined && minute !== undefined;
  const at = new Date(0);
  at.setUTCFullYear(year, month - 1, day); // not Date.UTC, which reads years 0 to 99 as 1900 to 1999
  at.setUTCHours(hasTime ? hour : 12, hasTime ? minute : 0, 0, 0);
  // An impossible day or hour rolls into the next one; refuse it instead.
  if (at.getUTCFullYear() !== year || at.getUTCMonth() !== month - 1 || at.getUTCDate() !== day || (hasTime && (at.getUTCHours() !== hour || at.getUTCMinutes() !== minute))) return trimmed;
  return write(at, { ...style, time: hasTime }, 'UTC');
}
