// SPDX-License-Identifier: MPL-2.0
/**
 * Every date in a details list is written in one style. An instant is shown in the
 * reader's zone; a date-time written without a zone (EXIF) is shown as written, in
 * every zone the reader might be in.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateLocale, formatMetaInstant, formatWrittenDate } from './meta-dates.ts';

// ICU writes a narrow no-break space before AM/PM; compare the words, not the spaces.
const plain = (text: string): string => text.replace(/\s/g, ' ');
const en = { locale: 'en-US' };

/** Run `body` with the process in another time zone, then put the zone back. */
function inZone<T>(zone: string, body: () => T): T {
  const before = process.env.TZ;
  process.env.TZ = zone;
  try { return body(); } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before; }
}

test('an EXIF date-time keeps its time of day in the locale short style', () => {
  assert.equal(plain(formatWrittenDate('2026:10:12 09:41:07', en)), 'Oct 12, 2026, 9:41 AM');
  assert.equal(plain(formatWrittenDate('2026:10:12 21:05:00', { locale: 'en-GB' })), '12 Oct 2026, 21:05');
  assert.equal(plain(formatWrittenDate('2026:10:12 09:41:07', { locale: 'de' })), '12. Okt. 2026, 09:41');
});

test('a zone-less EXIF value reads the same in every zone, never shifted', () => {
  const written = '2026:10:12 23:30:00';
  const seen = ['UTC', 'Pacific/Kiritimati', 'Pacific/Pago_Pago', 'Asia/Kolkata', 'America/St_Johns']
    .map(zone => inZone(zone, () => plain(formatWrittenDate(written, en))));
  assert.deepEqual(new Set(seen), new Set(['Oct 12, 2026, 11:30 PM']), seen.join(' | '));
  // The check can see a shift: the same clock reading taken as an instant does move.
  const instant = Date.UTC(2026, 9, 12, 23, 30);
  assert.notEqual(inZone('Pacific/Kiritimati', () => formatMetaInstant(instant, { ...en, time: true })), inZone('Pacific/Pago_Pago', () => formatMetaInstant(instant, { ...en, time: true })));
});

test('a zone written after the clock reading is not applied either', () => {
  assert.equal(plain(formatWrittenDate('2026-10-12T09:41:00+02:00', en)), 'Oct 12, 2026, 9:41 AM');
  assert.equal(plain(formatWrittenDate('2026-10-12T09:41:00Z', en)), 'Oct 12, 2026, 9:41 AM');
});

test('a date without a time reads in the Added style, in every zone', () => {
  for (const zone of ['UTC', 'Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
    assert.equal(inZone(zone, () => formatWrittenDate('2026-10-31', en)), 'Oct 31, 2026', zone);
    assert.equal(inZone(zone, () => formatWrittenDate('2026:10:31', en)), 'Oct 31, 2026', zone);
  }
});

test('an instant and a written date of the same day read identically', () => {
  const localNoon = new Date(2026, 9, 31, 12).getTime();
  assert.equal(formatMetaInstant(localNoon, en), formatWrittenDate('2026-10-31', en));
  assert.equal(formatMetaInstant(new Date(localNoon).toISOString(), en), 'Oct 31, 2026');
  assert.equal(plain(formatMetaInstant(new Date(2026, 9, 31, 14, 5), { ...en, time: true })), 'Oct 31, 2026, 2:05 PM');
});

test('no date, an impossible date and text in another form', () => {
  assert.equal(formatWrittenDate('0000:00:00 00:00:00', en), '', 'a camera that never set its clock');
  assert.equal(formatWrittenDate('    :  :     :  :  ', en), '', 'a blank EXIF date');
  assert.equal(formatWrittenDate('2026:02:30 10:00:00', en), '2026:02:30 10:00:00', 'February 30 is shown as written');
  assert.equal(formatWrittenDate('2026:10:12 25:00:00', en), '2026:10:12 25:00:00');
  assert.equal(formatWrittenDate(' Sat, 31 Oct 2026 12:00:00 +0000 ', en), 'Sat, 31 Oct 2026 12:00:00 +0000');
  assert.equal(formatMetaInstant('not a date', en), '');
  assert.equal(formatMetaInstant(Number.NaN, en), '');
});

test('dates follow the app language, in the reader\'s own region of it', () => {
  assert.equal(dateLocale('en', ['en-AU', 'fr-FR']), 'en-AU');
  assert.equal(dateLocale('en', ['fr-FR', 'en-GB']), 'en-GB');
  assert.equal(dateLocale('de', ['en-AU']), 'de', 'a German interface on an English browser writes German dates');
  assert.equal(dateLocale('zh-hant', ['zh-CN']), 'zh-hant', 'Simplified Chinese is not the reader\'s region of Traditional');
  assert.equal(dateLocale('zh-hant', ['zh-TW']), 'zh-TW');
  assert.equal(dateLocale('pt', []), 'pt');
  assert.equal(plain(formatWrittenDate('2026-10-31', { locale: dateLocale('en', ['en-AU']) })), '31 Oct 2026');
});
