// SPDX-License-Identifier: MPL-2.0
/**
 * views/company-card.ts - the person's company card leads the workspace's shelf
 * (Lolly Work plans/82 M3): their logo for the chrome's mode, their company's name
 * and "Your details are on every piece"; for a contact who may edit and no details
 * yet, "Add your logo and details". The shelf shows with the card alone.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { companyCardHtml, cardLogoId, accessEndsOf, accessEndsLine } = await import('./company-card.ts');
const { publishedShelfHtml } = await import('./published-shelf.ts');

const view = (revision: number, profile: Record<string, unknown> = {}) => ({
  company: { id: 'northwind-it', name: 'Northwind <IT>' }, programme: { id: 'resellers-emea', name: 'Resellers, EMEA' }, revision, profile,
});

test('the card names the company and says its details are on every piece', () => {
  const html = companyCardHtml(view(4, { logoLight: 'inst/l' }));
  assert.match(html, /data-company-card/);
  assert.match(html, /Northwind &lt;IT&gt;/, 'escaped');
  assert.match(html, /Your details are on every piece/);
  assert.match(html, />Details</);
  assert.doesNotMatch(html, /set by|Managed by/i, 'no line naming who set anything');
});

test('a contact with no details yet is asked to add them', () => {
  const html = companyCardHtml({ ...view(0), mayEdit: true });
  assert.match(html, /Add your logo and details/);
  assert.match(html, />Add</);
});

test('the logo follows the chrome: the light-surface logo in light, the dark one otherwise, each falling back', () => {
  const both = view(1, { logoLight: 'inst/l', logoDark: 'inst/d' });
  assert.equal(cardLogoId(both, 'light'), 'inst/l');
  assert.equal(cardLogoId(both, 'dark'), 'inst/d');
  assert.equal(cardLogoId(both, 'brand'), 'inst/d');
  assert.equal(cardLogoId(view(1, { logoLight: 'inst/l' }), 'dark'), 'inst/l');
  assert.equal(cardLogoId(view(1), 'light'), undefined);
});

test('the shelf shows with the company card alone, and stays absent with nothing at all', () => {
  assert.equal(publishedShelfHtml([], 'SUSE'), '');
  const shelf = publishedShelfHtml([], 'SUSE', companyCardHtml(view(2)));
  assert.match(shelf, /published-shelf/);
  assert.match(shelf, /From SUSE/);
  assert.match(shelf, /data-company-card/);
});

test('an end date the workspace set shows as one line on the card, the day in UTC (plans/82 M5)', () => {
  const now = Date.parse('2026-11-07T12:00:00Z');
  const ends = accessEndsOf({ accessEndsAt: '2026-11-21T23:59:59.999Z', accessEndsThrough: { id: 'resellers-emea', name: 'Resellers, EMEA' } }, now);
  assert.deepEqual(ends, { at: '2026-11-21T23:59:59.999Z', programme: 'Resellers, EMEA' });
  assert.equal(accessEndsLine(ends!, 'en-GB'), 'Your access through Resellers, EMEA ends on 21 November 2026');
  assert.equal(accessEndsLine(ends!, 'en-US'), 'Your access through Resellers, EMEA ends on November 21, 2026', 'the reader\'s own day and month order');
  const html = companyCardHtml({ ...view(3), accessEnds: { ...ends!, programme: 'Resellers <EMEA>' } });
  assert.match(html, /company-card-ends/);
  assert.match(html, /Your access through Resellers &lt;EMEA&gt; ends on/, 'escaped');
  assert.match(html, /Your details are on every piece/, 'the details line stays');
});

test('no line without a date, without a programme to name, or once the date has passed', () => {
  const now = Date.parse('2026-11-07T12:00:00Z');
  assert.equal(accessEndsOf(null, now), null);
  assert.equal(accessEndsOf({}, now), null);
  assert.equal(accessEndsOf({ accessEndsAt: '2026-11-21T23:59:59.999Z' }, now), null, 'no programme');
  assert.equal(accessEndsOf({ accessEndsAt: 'soon', accessEndsThrough: { name: 'Resellers' } }, now), null, 'not a date');
  assert.equal(accessEndsOf({ accessEndsAt: '2026-11-01T23:59:59.999Z', accessEndsThrough: { name: 'Resellers' } }, now), null, 'passed');
  assert.doesNotMatch(companyCardHtml(view(3)), /company-card-ends|ends on/);
});
