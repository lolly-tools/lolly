// SPDX-License-Identifier: MPL-2.0
/** Where a retired tool's document opens in its successor (lib/tool-successors.ts). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flowChartToDesign, meetingPlannerToTimezone, successorHref, scanToQrCode, voiceRecorderToAudiogram } from './tool-successors.ts';

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

const card = (over: Record<string, unknown> = {}) => ({
  id: 'ceo', kind: 'card', layout: 'row', x: 600, y: 40, w: 366, h: 142, rot: 0, shape: 'rounded', radius: 18,
  bg: '#0c322c', accent: 'var(--brand-secondary, #30ba78)', text: 'Alex Rivera\n{w400|Chief Executive}', fg: '#ffffff',
  fontSize: 30, align: 'left', valign: 'middle', weight: '500', font: 'sans', lineHeight: 1.15, pad: 16, ...over,
});
const line = { id: 'ln1', kind: 'path', layout: 'plain', x: 423, y: 106, w: 354, h: 415, path: '1!line!0_1!0_0!1', stroke: '#30ba78', strokeW: 3.5, headEnd: 'open', bindStart: 'ceo', bindEnd: 'cto', route: 'elbow' };
type Row = Record<string, unknown>;
const rowsOf = (values: Record<string, unknown>): Row[] => values.boxes as Row[];
const find = (rows: Row[], id: string): Row => { const row = rows.find((r) => r.id === id); assert.ok(row, `${id} is written`); return row; };

test('a Flow Chart card becomes a group in Design: ground, mark, initials and words, set out as the card was', () => {
  const rows = rowsOf(flowChartToDesign({ boxes: [card()] }));
  assert.deepEqual(rows.map((r) => [r.id, r.kind]), [['ceo-card', 'group'], ['ceo', 'box'], ['ceo-mark', 'box'], ['ceo-initials', 'text'], ['ceo-words', 'text']]);
  assert.ok(rows.slice(1).every((r) => r.group === 'ceo-card'), 'every part belongs to the group');
  assert.ok(rows.every((r) => r.frame === undefined && r.layout === undefined), 'loose layers, and no card layout left for Design to misread');
  // The row layout: a circle as tall as the card's inner height, then the words.
  assert.deepEqual([find(rows, 'ceo-mark').x, find(rows, 'ceo-mark').y, find(rows, 'ceo-mark').w, find(rows, 'ceo-mark').shape], [616, 56, 110, 'ellipse']);
  assert.equal(find(rows, 'ceo-initials').text, 'AR');
  assert.equal(find(rows, 'ceo-initials').fg, '#ffffff', 'light ink on the green accent, read from the var fallback, as Flow Chart drew the initials');
  assert.deepEqual([find(rows, 'ceo-words').x, find(rows, 'ceo-words').w, find(rows, 'ceo-words').text], [616 + 110 + 14, 366 - 32 - 110 - 14, 'Alex Rivera\n{w400|Chief Executive}']);
});

test('the ground keeps the card id, so a connector stays bound, and a connector travels as it is', () => {
  const rows = rowsOf(flowChartToDesign({ boxes: [card(), card({ id: 'cto', y: 420 }), line] }));
  assert.equal(rows[0]!.id, 'ln1', 'a bound line sits under the cards, so a press on a card reaches the card');
  const path = find(rows, 'ln1');
  assert.deepEqual([path.kind, path.bindStart, path.bindEnd, path.route, path.path], ['path', 'ceo', 'cto', 'elbow', '1!line!0_1!0_0!1']);
  assert.equal(path.layout, undefined);
  assert.equal(find(rows, 'ceo').kind, 'box');
  assert.equal(find(rows, 'cto').kind, 'box');
});

test('the other card layouts: an icon mark, a band on top, a plain card with its picture behind', () => {
  const icon = rowsOf(flowChartToDesign({ boxes: [card({ id: 'a', layout: 'icon', h: 110 })] }));
  assert.deepEqual([find(icon, 'a-mark').w, find(icon, 'a-mark').shape, find(icon, 'a-mark').radius], [56, 'rounded', 16]);
  const stacked = rowsOf(flowChartToDesign({ boxes: [card({ id: 'b', layout: 'stacked', w: 260, h: 230 })] }));
  assert.deepEqual([find(stacked, 'b-mark').w, find(stacked, 'b-mark').h], [228, 109]);
  assert.equal(find(stacked, 'b-words').y, 40 + 16 + 109 + 14, 'the words start under the band');
  const picture = { url: 'https://example.com/p.jpg' };
  const plain = rowsOf(flowChartToDesign({ boxes: [card({ id: 'c', layout: 'plain', image: picture })] }));
  assert.deepEqual(plain.map((r) => r.id), ['c-card', 'c', 'c-picture', 'c-words']);
  const photo = rowsOf(flowChartToDesign({ boxes: [card({ id: 'd', image: picture })] }));
  assert.deepEqual([find(photo, 'd-picture').kind, find(photo, 'd-picture').fit], ['image', 'cover']);
  assert.ok(!photo.some((r) => r.id === 'd-initials'), 'a card with a picture has no initials');
});

test('the Design address holds the chart at Flow Chart\'s canvas size', () => {
  const href = successorHref('org-chart', 'design', { background: '#ffffff', boxes: [card()] });
  const params = new URLSearchParams(href.split('?')[1]);
  assert.ok(href.startsWith('#/tool/design?'));
  assert.deepEqual([params.get('width'), params.get('height'), params.get('background')], ['1600', '1000', '#ffffff']);
  assert.equal(JSON.parse(params.get('boxes')!).length, 5);
});

test('Voice Recorder into Audiogram: the name, card style, accent and coaching choices travel', () => {
  assert.deepEqual(
    voiceRecorderToAudiogram({ title: ' Standup notes ', targetLevel: 'soft', showTips: false, theme: 'light', accent: '#30ba78' }),
    { title: 'Standup notes', bg: '#fafbfe', ink: '#11141f', accent: '#30ba78', targetLevel: 'soft', showTips: false },
  );
});

test('Voice Recorder into Audiogram: an empty accent and an unknown value are left to Audiogram', () => {
  assert.deepEqual(
    voiceRecorderToAudiogram({ title: 'Voice note', targetLevel: 'shout', showTips: 'true', theme: 'dark', accent: '' }),
    { title: 'Voice note', bg: '#11141f', ink: '#fafbfe', showTips: true },
  );
  assert.deepEqual(voiceRecorderToAudiogram({ theme: 'sepia' }), {}, 'a card style Voice Recorder never had carries no colours');
  assert.deepEqual(voiceRecorderToAudiogram({}), { bg: '#11141f', ink: '#fafbfe' }, 'the card was dark unless told otherwise');
});

test('the Audiogram address is one its own manifest reads back', async () => {
  const { readFile } = await import('node:fs/promises');
  const { parseUrlState } = await import('../../../../engine/src/url-mode.ts');
  const manifest = JSON.parse(await readFile(new URL('../../../../community/audiogram/tool.json', import.meta.url), 'utf8'));
  const href = successorHref('voice-recorder', 'audiogram', { title: 'Standup notes', targetLevel: 'loud', showTips: false, theme: 'light', accent: '' });
  assert.ok(href.startsWith('#/tool/audiogram?'));
  const { values } = parseUrlState(href.split('?')[1]!, manifest);
  assert.deepEqual(values, { title: 'Standup notes', bg: '#fafbfe', ink: '#11141f', targetLevel: 'loud', showTips: false });
});

test('Scan into QR Code: scan mode on the same source, with pasted text as typed', () => {
  assert.deepEqual(scanToQrCode({ mode: 'paste', paste: ' WIFI:S:Cafe;T:WPA;P:pw;; ' }), { mode: 'scan', source: 'paste', scanText: ' WIFI:S:Cafe;T:WPA;P:pw;; ' });
  assert.deepEqual(scanToQrCode({ mode: 'camera', paste: '' }), { mode: 'scan', source: 'camera' });
  assert.deepEqual(scanToQrCode({}), { mode: 'scan', source: 'camera' }, 'Scan opened on the camera');
  assert.deepEqual(scanToQrCode({ mode: 'make' }), { mode: 'scan', source: 'camera' }, 'a source Scan never had is the camera');
});

test('Scan into QR Code: a picked image is not carried, and the source stays Image', () => {
  const picked = { __file: true, name: 'poster.png', mime: 'image/png', size: 9, bytes: new Uint8Array([1]) };
  assert.deepEqual(scanToQrCode({ mode: 'image', image: picked, paste: '' }), { mode: 'scan', source: 'image' });
});

test('the QR Code address is one its own manifest reads back, in scan mode', async () => {
  const { readFile } = await import('node:fs/promises');
  const { parseUrlState } = await import('../../../../engine/src/url-mode.ts');
  const { resolveRender } = await import('../../../../engine/src/render-when.ts');
  const manifest = JSON.parse(await readFile(new URL('../../../../community/qr-code/tool.json', import.meta.url), 'utf8'));
  const href = successorHref('scan-code', 'qr-code', { mode: 'paste', paste: 'https://example.com/a?b=1&c=2' });
  assert.ok(href.startsWith('#/tool/qr-code?'));
  const { values } = parseUrlState(href.split('?')[1]!, manifest);
  assert.deepEqual(values, { mode: 'scan', source: 'paste', scanText: 'https://example.com/a?b=1&c=2' });
  const render = resolveRender(manifest.render, values);
  assert.equal(render.export, false, 'the address lands on the reader, with no export');
  assert.deepEqual(render.actions, []);
});
