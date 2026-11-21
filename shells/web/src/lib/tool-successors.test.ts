// SPDX-License-Identifier: MPL-2.0
/** Where a retired tool's document opens in its successor (lib/tool-successors.ts). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { meetingPlannerToTimezone, successorHref } from './tool-successors.ts';

test('a Meeting Planner document becomes Timezone places, with the host city first and as the clock', () => {
  const carried = meetingPlannerToTimezone({
    eventName: 'Quarterly sync', city: 'Nuremberg', meetingTime: '2026-12-01T10:00', liveClock: false,
    people: [{ name: 'Ana', city: 'Lisbon' }, { name: 'Kei', city: 'Tokyo' }, { name: 'Nobody', city: '' }],
    showNight: true, showBorders: false, showGraticule: true,
  });
  assert.deepEqual(carried, {
    locations: [{ label: '', place: 'Nuremberg' }, { label: 'Ana', place: 'Lisbon' }, { label: 'Kei', place: 'Tokyo' }],
    heading: 'Quarterly sync', timeMode: 'fixed', eventTime: '2026-12-01T10:00', referenceZone: 'Nuremberg',
    showHourQuality: true, showNight: true, showBorders: false, showGrid: true,
  });
});

test('the host city is not listed twice, and a live clock stays live', () => {
  const carried = meetingPlannerToTimezone({ city: 'Lisbon', meetingTime: '2026-12-01T10:00', liveClock: true, people: [{ name: 'Ana', city: 'lisbon' }] });
  assert.deepEqual(carried.locations, [{ label: 'Ana', place: 'lisbon' }]);
  assert.equal(carried.timeMode, undefined, 'Timezone starts on the live clock');
});

test('the address holds lists as JSON and reads back whole', () => {
  const href = successorHref('meeting-planner', 'timezone', { city: 'Nuremberg', people: [{ name: 'Ana & Co', city: 'São Paulo' }] });
  assert.ok(href.startsWith('#/tool/timezone?'));
  const params = new URLSearchParams(href.split('?')[1]);
  assert.deepEqual(JSON.parse(params.get('locations')!), [{ label: '', place: 'Nuremberg' }, { label: 'Ana & Co', place: 'São Paulo' }]);
  assert.equal(params.get('showHourQuality'), 'true');
});

test('a retired tool with no mapping opens its successor at the start', () => {
  assert.equal(successorHref('some-old-tool', 'design', { anything: 1 }), '#/tool/design');
});
