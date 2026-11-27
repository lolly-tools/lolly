// SPDX-License-Identifier: MPL-2.0
/** Where a retired tool's document opens in its successor (lib/tool-successors.ts). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backdropToGradient, flowChartToDesign, meetingPlannerToTimezone, successorHref, THREE_D_SCENES, threeDRotation, threeDToStudio, voiceRecorderToAudiogram, scanToQrCode, compressToPages, signToPages } from './tool-successors.ts';

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

// ── 3D into 3D Studio ────────────────────────────────────────────────────────
// 3D's document at its defaults, as the runtime hands it over.
const threeD = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  model: 'duck', scene: 'soft-glow', envIntensity: 1, envRotation: 0, background: '#eef1f4', bgColor2: '#30ba78',
  transparentBg: true, exposure: 1, shadows: true,
  camera: { fov: 45, rotation: 35, tilt: 12, zoom: 1.3, pan: 0 },
  modelRotate: { pitch: 0, yaw: 0, tilt: 0 }, modelTranslate: { x: 0, y: 0, z: 0 }, modelScale: { scale: 1 },
  cameraMove: 'orbit', duration: 5, loop: true, easing: 'ease-in-out', cameraKeyframes: [],
  playClip: true, clipIndex: 0, applyTint: false, tint: '#30ba78',
  ...over,
});
const studio = (over: Record<string, unknown> = {}) => threeDToStudio(threeD(over));
const keysOf = (carried: Record<string, unknown>) => carried.cameraKeys as Record<string, number>[];

test('3D into 3D Studio: the sample model becomes a model source from the library', () => {
  assert.deepEqual([studio().source, studio().modelAsset], ['model', 'lolly/3d/duck']);
  assert.equal(studio({ model: 'cat' }).modelAsset, 'lolly/3d/cat');
  assert.equal(studio({ model: 'something-else' }).modelAsset, 'lolly/3d/duck', '3D fell back to the duck too');
  assert.equal(studio({ model: 'geeko-sitting' }).modelAsset, 'suse/model/geeko-sitting', "a brand's sample opens that brand's catalog model");
  assert.equal(studio({ model: 'geeko' })['target.y'], 0.84, 'and the camera aims at its middle');
  // An upload lived in memory and is not a value, so nothing of the upload travels.
  assert.equal(JSON.stringify(studio({ modelUpload: { __file: true, url: 'blob:x' } })).includes('blob:'), false);
});

test('3D into 3D Studio: a transparent background becomes the output mode, with or without the shadow', () => {
  assert.deepEqual([studio().outputMode, studio().shadowOpacity], ['object-shadow', 0.28]);
  assert.deepEqual([studio({ shadows: false }).outputMode, studio({ shadows: false }).shadowOpacity], ['object', 0]);
  assert.equal(studio({ transparentBg: false }).outputMode, 'scene');
  assert.equal(studio({ transparentBg: 'false' }).outputMode, 'scene', 'a flag read from a link is text');
});

test('3D into 3D Studio: the background is a solid backdrop, and the gradient scene keeps both colours', () => {
  const solid = studio({ transparentBg: false, background: '#102030' });
  assert.deepEqual([solid.backdrop, solid.background, solid.background2], ['solid', '#102030', undefined]);
  const gradient = studio({ transparentBg: false, scene: 'fun-gradient', background: '#102030', bgColor2: '#ff00aa' });
  assert.deepEqual([gradient.backdrop, gradient.background, gradient.background2, gradient.backdropStrength], ['gradient', '#102030', '#ff00aa', 1]);
});

test('3D into 3D Studio: the environment keeps its turn and its strength relative to each tool own default', () => {
  assert.deepEqual([studio().environmentIntensity, studio().environmentRotation], [0.4, 0]);
  assert.equal(studio({ envIntensity: 2.5 }).environmentIntensity, 1);
  assert.equal(studio({ envIntensity: 0 }).environmentIntensity, 0);
  assert.equal(studio({ envRotation: 90 }).environmentRotation, 90);
  assert.equal(studio({ envRotation: 270 }).environmentRotation, -90, '0 to 360 folds into -180 to 180');
  assert.equal(studio({ envRotation: 360 }).environmentRotation, 0);
});

test('3D into 3D Studio: exposure and loop seconds keep their ids and values', () => {
  assert.deepEqual([studio({ exposure: 1.85 }).exposure, studio({ duration: 12.5 }).duration], [1.85, 12.5]);
  assert.equal(studio({ exposure: 0.1 }).exposure, 0.1);
});

test('3D into 3D Studio: the camera stands where it stood', () => {
  const carried = studio();
  assert.deepEqual(
    [carried['camera.azimuth'], carried['camera.elevation'], carried['camera.fov'], carried['camera.panX'], carried['camera.panY'], carried['camera.panZ']],
    [35, 12, 45, 0, 0, 0],
  );
  // 3D: 0.8 * size / tan(fov / 2) / zoom from the model. 3D Studio: 11.3 / zoom, with the model 3.25 across.
  const distance = (zoom: number) => 11.3 / zoom;
  const was = (fov: number, zoom: number) => (0.8 * 3.25) / Math.tan((fov * Math.PI) / 360) / zoom;
  assert.ok(Math.abs(distance(carried['camera.zoom'] as number) - was(45, 1.3)) < 0.01);
  const wide = studio({ camera: { fov: 30, rotation: 200, tilt: -10, zoom: 0.5, pan: 0.5 } });
  assert.ok(Math.abs(distance(wide['camera.zoom'] as number) - was(30, 0.5)) < 0.05);
  assert.equal(wide['camera.azimuth'], -160, 'a rotation of 200 is an azimuth of -160');
  assert.equal(wide['camera.elevation'], -10);
  assert.equal(wide['camera.panX'], 0.813, 'pan was in half model widths along x');
  // The lens is held to 3D Studio's range, and the camera keeps the distance 3D put between camera and model.
  const fisheye = studio({ camera: { fov: 90, rotation: 0, tilt: 0, zoom: 0.4, pan: 0 } });
  assert.equal(fisheye['camera.fov'], 80);
  assert.ok(Math.abs(distance(fisheye['camera.zoom'] as number) - was(90, 0.4)) < 0.05);
  // A close view runs out of zoom: 3D Studio stops at 3.
  assert.equal(studio({ camera: { fov: 90, rotation: 0, tilt: 0, zoom: 2.5, pan: 0 } })['camera.zoom'], 3);
  // The target is the middle of the model, which stands on the floor in 3D Studio.
  assert.deepEqual([carried['target.x'], carried['target.y'], carried['target.z']], [0, 1.455, 0]);
  assert.equal(studio({ model: 'cat' })['target.y'], 0.925);
  assert.equal(studio({ modelScale: { scale: 2 } })['target.y'], 2.91, 'a bigger model has a higher middle');
});

test('3D into 3D Studio: the model pose keeps its turn, its place and its size', () => {
  const rest = studio();
  assert.deepEqual([rest['rotation.x'], rest['rotation.y'], rest['rotation.z']], [0, 0, 0]);
  assert.deepEqual([rest['position.x'], rest['position.y'], rest['position.z'], rest['transform.scale']], [0, 0, 0, 1]);
  const moved = studio({ modelTranslate: { x: 1, y: -0.5, z: 2 }, modelScale: { scale: 2.5 } });
  assert.deepEqual([moved['position.x'], moved['position.y'], moved['position.z']], [3.25, -1.625, 5], 'model widths become studio units, held to 5');
  assert.equal(moved['transform.scale'], 2.5);
  // One axis at a time is the same number in both orders.
  assert.deepEqual(threeDRotation(30, 0, 0), { x: 30, y: 0, z: 0 });
  assert.deepEqual(threeDRotation(0, -45, 0), { x: 0, y: -45, z: 0 });
  assert.deepEqual(threeDRotation(0, 0, 60), { x: 0, y: 0, z: 60 });
});

test('3D into 3D Studio: a pose on several axes is the same turn in the other order', async () => {
  const THREE = await import('three');
  for (const [pitch, yaw, roll] of [[20, 35, -10], [-70, 120, 45], [10, 90, 30], [180, -180, 90]] as const) {
    const rad = (n: number) => (n * Math.PI) / 180;
    const was = new THREE.Quaternion().setFromEuler(new THREE.Euler(rad(pitch), rad(yaw), rad(roll), 'YXZ'));
    const now = threeDRotation(pitch, yaw, roll);
    const is = new THREE.Quaternion().setFromEuler(new THREE.Euler(rad(now.x), rad(now.y), rad(now.z), 'XYZ'));
    assert.ok(Math.abs(Math.abs(was.dot(is)) - 1) < 1e-6, `${pitch}/${yaw}/${roll} became ${now.x}/${now.y}/${now.z}`);
  }
});

test('3D into 3D Studio: Static holds still and Orbit is the whole turn at a constant speed', () => {
  assert.equal(studio({ cameraMove: 'static' }).cameraMotion, 'still');
  assert.equal(studio({ cameraMove: 'static' }).cameraKeys, undefined);
  // Looping, 3D turned at a constant speed whatever Easing said.
  const orbit = studio({ cameraMove: 'orbit', loop: true, easing: 'ease-in-out' });
  assert.deepEqual([orbit.cameraMotion, orbit.cameraEase, orbit.cameraLoop], ['orbit', 'linear', true]);
  // Played once, the turn eased as asked.
  const once = studio({ cameraMove: 'orbit', loop: false, easing: 'ease-in-out' });
  assert.deepEqual([once.cameraMotion, once.cameraEase, once.cameraLoop], ['orbit', 'smooth', false]);
  assert.equal(studio({ cameraMove: 'orbit', loop: false, easing: 'linear' }).cameraEase, 'linear');
});

test('3D into 3D Studio: Arc is 45 degrees each way, as keys', () => {
  const loop = studio({ cameraMove: 'arc' });
  assert.deepEqual([loop.cameraMotion, loop.cameraEase, loop.cameraLoop], ['keys', 'linear', true]);
  assert.deepEqual(keysOf(loop).map((k) => [k.at, k.azimuth]), [[0, -10], [50, 80], [100, -10]], 'there and back inside one loop');
  const once = studio({ cameraMove: 'arc', loop: false });
  assert.deepEqual([once.cameraEase, once.cameraLoop], ['smooth', false]);
  assert.deepEqual(keysOf(once).map((k) => [k.at, k.azimuth]), [[0, -10], [100, 80]]);
  // Every other part of the view is the camera's own.
  for (const k of keysOf(loop)) assert.deepEqual([k.elevation, k.fov, k.zoom, k.panX, k.panY, k.panZ, k.focusDistance], [12, 45, 2.34, 0, 1.455, 0, 0]);
});

test('3D into 3D Studio: the dollies and Push in keep their start and end distances', () => {
  const zoom = (old: number) => Math.round(((11.3 * Math.tan((45 * Math.PI) / 360) * old) / 2.6) * 1000) / 1000;
  const dollyIn = keysOf(studio({ cameraMove: 'dolly-in', loop: false }));
  assert.deepEqual(dollyIn.map((k) => k.zoom), [zoom(1.3 * 0.6), zoom(1.3 * 1.2)]);
  const dollyOut = keysOf(studio({ cameraMove: 'dolly-out', loop: false }));
  assert.deepEqual(dollyOut.map((k) => k.zoom), [zoom(1.3 * 1.2), zoom(1.3 * 0.6)], 'Dolly out is Dolly in backwards, which no 3D Studio move is');
  const push = keysOf(studio({ cameraMove: 'push-in', loop: false }));
  // 3D Studio's camera comes no closer than zoom 3, so from 3D's default view the end of
  // Push in stops a little short: 3.77 studio units from the model where 3D reached 3.58.
  assert.deepEqual(push.map((k) => k.zoom), [zoom(1.3 * 0.6), 3]);
  assert.ok(zoom(1.3 * 1.35) > 3);
  const farther = keysOf(studio({ cameraMove: 'push-in', loop: false, camera: { fov: 45, rotation: 35, tilt: 12, zoom: 1, pan: 0 } }));
  assert.deepEqual(farther.map((k) => k.zoom), [zoom(0.6), zoom(1.35)], 'from a view with room to spare the end is exact');
  assert.deepEqual(push.map((k) => k.fov), [51.75, 40.5], 'Push in narrowed the lens from 1.15 to 0.9 of the view');
  assert.deepEqual(dollyIn.map((k) => k.fov), [45, 45], 'a dolly leaves the lens alone');
  // Looping, each runs there and back at a constant speed.
  const looped = studio({ cameraMove: 'dolly-out' });
  assert.deepEqual([looped.cameraEase, looped.cameraLoop, keysOf(looped).map((k) => k.at)], ['linear', true, [0, 50, 100]]);
});

test('3D into 3D Studio: custom keyframes become keys, seconds as a share of the loop', () => {
  const frames = [
    { time: 5, fov: 40, rotation: 120, zoom: 1, pan: 0.2, tilt: 20, easing: 'linear' },
    { time: 0, fov: 55, rotation: 0, zoom: 1.4, pan: 0, tilt: 6, easing: 'linear' },
  ];
  // Played once: each key at its own second out of the loop seconds, in time order.
  const once = studio({ cameraMove: 'custom', loop: false, duration: 10, cameraKeyframes: frames });
  assert.deepEqual([once.cameraMotion, once.cameraLoop, once.duration], ['keys', false, 10]);
  assert.deepEqual(keysOf(once).map((k) => [k.at, k.azimuth, k.elevation, k.fov, k.panX]), [[0, 0, 6, 55, 0], [50, 120, 20, 40, 0.325]]);
  assert.equal(once.cameraEase, 'linear', 'every leg was linear');
  assert.equal(studio({ cameraMove: 'custom', loop: false, cameraKeyframes: [frames[1], { ...frames[0], easing: 'ease-in-out' }] }).cameraEase, 'smooth');
  // A key's distance is measured with the camera's own lens, which is how 3D measured.
  const zoom = (old: number) => Math.round(((11.3 * Math.tan((45 * Math.PI) / 360) * old) / 2.6) * 1000) / 1000;
  assert.deepEqual(keysOf(once).map((k) => k.zoom), [zoom(1.4), zoom(1)]);
  // Looping, 3D ran the path there and back inside the path's own length.
  const loop = studio({ cameraMove: 'custom', loop: true, duration: 10, cameraKeyframes: frames });
  assert.deepEqual([loop.cameraLoop, loop.duration], [true, 5]);
  assert.deepEqual(keysOf(loop).map((k) => [k.at, k.azimuth]), [[0, 0], [50, 120], [100, 0]]);
  // A rotation past one turn keeps its turns, so the camera goes the long way as 3D did.
  const far = studio({ cameraMove: 'custom', loop: false, cameraKeyframes: [frames[1], { ...frames[0], rotation: 540 }] });
  assert.equal(keysOf(far)[1]!.azimuth, 540);
});

test('3D into 3D Studio: one keyframe is a held view, and none is the camera as posed', () => {
  const one = studio({ cameraMove: 'custom', cameraKeyframes: [{ time: 2, fov: 60, rotation: 270, zoom: 1, pan: 0, tilt: 30, easing: 'linear' }] });
  assert.equal(one.cameraMotion, 'still');
  assert.deepEqual([one['camera.azimuth'], one['camera.elevation'], one['camera.fov']], [-90, 30, 60]);
  const none = studio({ cameraMove: 'custom', cameraKeyframes: [] });
  assert.deepEqual([none.cameraMotion, none['camera.azimuth']], ['still', 35]);
});

test('3D into 3D Studio: the model animation choices keep their ids', () => {
  assert.deepEqual([studio().playClip, studio().clipIndex], [true, 0]);
  assert.deepEqual([studio({ playClip: false, clipIndex: 4 }).playClip, studio({ playClip: false, clipIndex: 4 }).clipIndex], [false, 4]);
  assert.equal(threeDToStudio({}).playClip, true, '3D played the clip unless told otherwise');
});

test('3D into 3D Studio: Recolour becomes a colour pair of the one tint', () => {
  assert.equal(studio().materialMode, 'source');
  assert.equal(studio().colorA, undefined, 'a tint that was switched off does not travel');
  const tinted = studio({ applyTint: true, tint: '#ff8800' });
  assert.deepEqual([tinted.materialMode, tinted.colorA, tinted.colorB, tinted.finishA, tinted.finishB], ['pair', '#ff8800', '#ff8800', 'satin', 'satin']);
});

test('3D into 3D Studio: each lighting scene takes its nearest rig', () => {
  const scenes = ['soft-glow', 'plain', 'natural', 'bright-studio', 'serious-studio', 'fun-gradient', 'suse-green'];
  assert.deepEqual(Object.keys(THREE_D_SCENES).sort(), [...scenes].sort(), 'all seven are mapped');
  for (const scene of scenes) {
    const carried = studio({ scene });
    for (const [id, value] of Object.entries(THREE_D_SCENES[scene]!)) assert.equal(carried[id], value, `${scene}: ${id}`);
    assert.ok(['soft', 'dramatic', 'electric', 'warm'].includes(carried.studio as string), scene);
  }
  // Natural and Bright studio were set by comparing the two pictures side by side.
  assert.deepEqual([studio({ scene: 'natural' }).studio, studio({ scene: 'natural' }).environment, studio({ scene: 'natural' }).keyColor], ['soft', 'gallery', '#fff1dc']);
  assert.deepEqual([studio({ scene: 'bright-studio' }).studio, studio({ scene: 'bright-studio' }).environment], ['soft', 'gallery']);
  assert.equal(studio({ scene: 'suse-green' }).keyColor, '#8ff0c0');
  assert.equal(studio({ scene: 'no-such-scene' }).studio, 'soft', 'an unknown scene takes the default one');
});

test('3D into 3D Studio: the address is one 3D Studio own manifest reads back', async () => {
  const { readFile } = await import('node:fs/promises');
  const { parseUrlState } = await import('../../../../engine/src/url-mode.ts');
  const manifest = JSON.parse(await readFile(new URL('../../../../community/3d-studio/tool.json', import.meta.url), 'utf8'));
  const href = successorHref('3d', '3d-studio', threeD({ cameraMove: 'arc', applyTint: true, tint: '#ff8800', modelScale: { scale: 2 } }));
  assert.ok(href.startsWith('#/tool/3d-studio?'));
  const { values } = parseUrlState(href.split('?')[1]!, manifest);
  const read = values as Record<string, unknown>;
  const carried = studio({ cameraMove: 'arc', applyTint: true, tint: '#ff8800', modelScale: { scale: 2 } });
  // Every id the mapping writes is an input 3D Studio has, and reads back as the value sent.
  for (const [id, value] of Object.entries(carried)) {
    const [input, field] = id.split('.');
    assert.ok(manifest.inputs.some((i: { id: string }) => i.id === input), `3D Studio has ${input}`);
    if (id === 'modelAsset') continue;
    const got = field ? (read[input!] as Record<string, unknown> | undefined)?.[field] : read[input!];
    assert.deepEqual(got ?? defaultOf(manifest, input!, field), value, id);
  }
  assert.deepEqual((read.modelAsset as { id: string }).id, 'lolly/3d/duck');
});

/** A value equal to the input's default is left out of what a link parser returns. */
function defaultOf(manifest: { inputs: { id: string; default?: unknown; fields?: { id: string; default?: unknown }[] }[] }, id: string, field?: string): unknown {
  const input = manifest.inputs.find((i) => i.id === id)!;
  return field ? input.fields?.find((f) => f.id === field)?.default : input.default;
}

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

test('Backdrop into Gradient: the Field method with every value under its id, and the speed renamed', () => {
  const carried = backdropToGradient({
    effect: 'silk-flow', count: 3, color1: '#008657', color2: '#033633', color3: '#008657', color4: '#033633', color5: '#008657', color6: '#033633',
    background: '#033633', brandInfluence: 'subtle', intensity: 60, density: 45, scale: 100, rotation: 90, speed: 70, phase: 35,
  });
  assert.deepEqual(carried, {
    mode: 'field', effect: 'silk-flow', count: 3, color1: '#008657', color2: '#033633', color3: '#008657', color4: '#033633', color5: '#008657',
    color6: '#033633', background: '#033633', brandInfluence: 'subtle', intensity: 60, density: 45, scale: 100, rotation: 90, phase: 35, fieldSpeed: 70,
  });
  assert.ok(!Object.hasOwn(carried, 'speed'), 'Gradient reads speed as loop seconds, so the percentage does not travel under that id');
});

test('Backdrop into Gradient: a colour linked to a design token travels as the token path', () => {
  // The web shell holds a linked input as the path beside the colour the path gave.
  const carried = backdropToGradient({
    effect: 'metaballs', count: 2,
    color1: { ref: '{color.semantic.secondary}', value: '#008657' }, color2: { ref: '{color.semantic.primary}', value: '#033633' },
    background: { ref: '{color.semantic.primary}', value: '#033633' },
  });
  assert.deepEqual(carried, {
    mode: 'field', effect: 'metaballs', count: 2, color1: '{color.semantic.secondary}', color2: '{color.semantic.primary}', background: '{color.semantic.primary}',
  });
  const href = successorHref('backdrop', 'gradient', { color1: { ref: '{color.semantic.secondary}', value: '#008657' }, color2: { value: '#112233' } });
  assert.deepEqual(Object.fromEntries(new URLSearchParams(href.split('?')[1])), { mode: 'field', color1: '{color.semantic.secondary}', color2: '#112233' });
});

test('Backdrop into Gradient: an empty document still opens on the Field method, and a speed of 0 is kept', () => {
  assert.deepEqual(backdropToGradient({}), { mode: 'field' });
  assert.deepEqual(backdropToGradient({ speed: 0, count: 1, color2: '' }), { mode: 'field', count: 1, fieldSpeed: 0 });
});

test('the Gradient address is one its own manifest reads back, and its hooks draw the same field Backdrop drew', async () => {
  const { readFile } = await import('node:fs/promises');
  const { parseUrlState } = await import('../../../../engine/src/url-mode.ts');
  const { loadTool } = await import('../../../../engine/src/loader.ts');
  const { createRuntime } = await import('../../../../engine/src/runtime.ts');
  const { baseHost } = await import('../../../../tests/helpers/host.ts');
  const community = new URL('../../../../community/', import.meta.url);
  const load = (id: string) => loadTool(id, (path: string) => readFile(new URL(path, community), 'utf8'));
  // The field each tool hands its canvas script: one JSON record in a data attribute.
  const field = (html: string, attr: string): unknown => JSON.parse(new RegExp(`${attr}='([^']*)'`).exec(html)![1]!);
  const wash = (html: string): string => /class="(?:bd|mg-field)-wash" style="([^"]*)"/.exec(html)![1]!;
  const backdrop = await load('backdrop');
  const gradient = await load('gradient');
  const documents = [
    {},
    { effect: 'silk-flow', brandInfluence: 'subtle', count: 3, intensity: 60, density: 45, speed: 70 },
    { effect: 'warp', count: 1, color1: '#ff8800', background: '#101010', scale: 120, rotation: 45, speed: 0, phase: 80 },
    { effect: 'god-rays', count: 6, color1: '#111111', color2: '#222222', color3: '#333333', color4: '#444444', color5: '#555555', color6: '#666666', intensity: 60, density: 45 },
  ];
  for (const changed of documents) {
    const query = new URLSearchParams(Object.entries(changed).map(([id, value]) => [id, String(value)])).toString();
    const old = await createRuntime(backdrop as never, baseHost(), parseUrlState(query, backdrop.manifest as never).values as never);
    const model = Object.fromEntries(old.getModel().map((input) => [input.id, input.value]));
    const href = successorHref('backdrop', 'gradient', model);
    assert.ok(href.startsWith('#/tool/gradient?mode=field&'));
    const { values } = parseUrlState(href.split('?')[1]!, gradient.manifest as never);
    const next = await createRuntime(gradient as never, baseHost(), values as never);
    assert.deepEqual(field(next.getHydrated(), 'data-field'), field(old.getHydrated(), 'data-bd'), `the same field for ${query || 'the defaults'}`);
    assert.equal(wash(next.getHydrated()), wash(old.getHydrated()), 'and the same wash where the shader cannot run');
  }
});

test('Compress into Pages: the compress operation, with the level and the greyscale choice', () => {
  assert.deepEqual(compressToPages({ level: 'strong', grayscale: true }), { operation: 'compress', level: 'strong', grayscale: true });
  assert.deepEqual(compressToPages({ level: 'balanced', grayscale: 'false' }), { operation: 'compress', level: 'balanced', grayscale: false });
  assert.deepEqual(compressToPages({}), { operation: 'compress' }, 'Pages keeps its own defaults, which are the same');
  assert.deepEqual(compressToPages({ level: 'maximum' }), { operation: 'compress' }, 'a level Compress never had is left out');
});

test('Compress into Pages: the picked PDF is not carried', () => {
  const picked = { __file: true, name: 'report.pdf', mime: 'application/pdf', size: 9, bytes: new Uint8Array([1]) };
  assert.deepEqual(compressToPages({ source: picked, level: 'light' }), { operation: 'compress', level: 'light' });
});

test('Sign into Pages: three inputs take their new ids and the rest keep theirs', () => {
  const carried = signToPages({
    signatureInk: 'M10,10L100,80', page: 4, position: { x: 72, y: 620, width: 144 }, date: true, seal: false, lock: true,
  });
  assert.deepEqual(carried, {
    operation: 'sign', signatureInk: 'M10,10L100,80', signaturePage: 4, signatureDate: true, seal: false, lock: true,
    'signaturePosition.x': 72, 'signaturePosition.y': 620, 'signaturePosition.width': 144,
  });
  for (const old of ['page', 'position', 'date']) assert.equal(old in carried, false, `${old} is not an input of Pages`);
});

test('Sign into Pages: a catalog or linked picture travels by id, and bytes in memory do not', () => {
  const picked = { __file: true, name: 'contract.pdf', mime: 'application/pdf', size: 9, bytes: new Uint8Array([1]) };
  const carried = signToPages({
    source: picked, signature: { id: 'user/signature-1', url: 'blob:https://lolly.tools/1' }, initials: { id: 'data:image/png;base64,AA==', url: 'data:image/png;base64,AA==' },
  });
  assert.deepEqual(carried, { operation: 'sign', signature: 'user/signature-1' });
  assert.deepEqual(signToPages({ signature: 'https://lolly.tools/tool/signature.png?name=Ana', page: 0, date: 'false' }), {
    operation: 'sign', signature: 'https://lolly.tools/tool/signature.png?name=Ana', signatureDate: false,
  });
  assert.deepEqual(signToPages({}), { operation: 'sign' });
});

test('the Pages addresses for Compress and Sign carry the operation first', () => {
  assert.equal(successorHref('compress-pdf', 'pages', { level: 'strong', grayscale: false }), '#/tool/pages?operation=compress&level=strong&grayscale=false');
  assert.equal(successorHref('sign', 'pages', { page: 2, position: { x: 10, y: 20, width: 30 } }),
    '#/tool/pages?operation=sign&signaturePage=2&signaturePosition.x=10&signaturePosition.y=20&signaturePosition.width=30');
});
