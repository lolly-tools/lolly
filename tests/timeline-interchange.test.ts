// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { readEdl } from '../engine/src/timeline-edl.ts';
import { readOtio } from '../engine/src/timeline-otio.ts';
import { readFcpxml, parseRationalSeconds } from '../engine/src/timeline-fcpxml.ts';
import { detectTimelineFormat, readTimeline } from '../engine/src/timeline-import.ts';
import { framesToTimecode, rateFromFps, timecodeToFrames } from '../engine/src/timeline-common.ts';
import { premiereSequenceValues, framesToSeconds } from '../engine/src/premiere-xml.ts';

const dom = new JSDOM(''), parse = (s: string) => new dom.window.DOMParser().parseFromString(s, 'application/xml');
const fixture = (name: string) => readFileSync(new URL(`./fixtures/timeline/${name}`, import.meta.url), 'utf8');
const r2997 = { numerator: 30000, denominator: 1001 }, r5994 = { numerator: 60000, denominator: 1001 };

test('drop-frame timecode matches the SMPTE counts and round trips', () => {
  assert.equal(timecodeToFrames('00:01:00;02', r2997, true), 1800);
  assert.equal(timecodeToFrames('00:10:00;00', r2997, true), 17982);
  assert.equal(timecodeToFrames('01:00:00;00', r2997, true), 107892);
  assert.equal(timecodeToFrames('00:01:00;04', r5994, true), 3600);
  assert.equal(timecodeToFrames('01:00:00;00', r5994, true), 215784);
  assert.equal(timecodeToFrames('01:00:00:00', { numerator: 25, denominator: 1 }, false), 90000);
  for (const rate of [r2997, r5994]) for (let f = 0; f < 220_000; f += 7) assert.equal(timecodeToFrames(framesToTimecode(f, rate, true), rate, true), f);
  for (let f = 0; f < 5000; f++) assert.equal(timecodeToFrames(framesToTimecode(f, r2997, false), r2997, false), f);
  assert.throws(() => timecodeToFrames('00:01:00;00', r2997, true), /dropped frame/);
  assert.throws(() => timecodeToFrames('00:00:00:30', r2997, false), /does not fit/);
  assert.throws(() => timecodeToFrames('00:00:00;00', { numerator: 24, denominator: 1 }, true), /Drop-frame/);
  assert.throws(() => timecodeToFrames('nonsense', r2997, false), /Invalid timecode/);
  assert.deepEqual(rateFromFps(29.97), r2997); assert.deepEqual(rateFromFps(59.94), r5994);
  assert.deepEqual(rateFromFps(23.976), { numerator: 24000, denominator: 1001 }); assert.throws(() => rateFromFps(13.3), /Unsupported/);
});

test('29.97 drop-frame EDL lands as clips, gaps and a loss report', async () => {
  const seq = readEdl(fixture('df-2997.edl'));
  assert.deepEqual(seq.rate, r2997); assert.equal(seq.dropFrame, true); assert.equal(seq.timecodeStart, 107892);
  const video = seq.clips.filter(c => c.kind === 'video'), audio = seq.clips.filter(c => c.kind === 'audio');
  assert.equal(video.length, 3); assert.equal(audio.length, 2);
  assert.deepEqual([video[0]!.start, video[0]!.end, video[0]!.name, video[0]!.path], [0, 150, 'Harbour wide', '/Media/harbour.mov']);
  assert.deepEqual(audio.map(c => c.track), [0, 1]);
  assert.equal(video[1]!.start, 210, 'the black event is a gap');
  assert.equal(video[1]!.in, timecodeToFrames('01:10:00;02', r2997, true));
  const text = seq.notes.join('\n');
  for (const word of ['dissolve', 'Locators', 'Speed changes', 'zero-length', 'black', 'assumed']) assert.match(text, new RegExp(word, 'i'), word);
  const { values } = await premiereSequenceValues(seq);
  const boxes = values.boxes as { start: number; clipIn: number }[];
  assert.equal(boxes.length, 5); assert.ok(Math.abs(boxes[0]!.clipIn - framesToSeconds(timecodeToFrames('01:00:10;00', r2997, true) - 107892, r2997)) < 1e-9);
  assert.equal(values.projectFps, '30');
});

test('59.94 drop-frame EDL respects the four-frame drop', () => {
  const seq = readEdl(fixture('df-5994.edl'), { rate: r5994 });
  assert.deepEqual(seq.rate, r5994); assert.equal(seq.clips.length, 2);
  assert.equal(seq.clips[0]!.in, 3600); assert.equal(seq.clips[0]!.out, 3720);
  assert.equal(seq.clips[1]!.name, 'Minute boundary'); assert.equal(seq.clips[1]!.end - seq.clips[1]!.start, 4);
  assert.throws(() => readEdl('FCM: DROP FRAME\n001  A V C 00:01:00;00 00:01:01;00 01:00:00;00 01:00:01;00\n', { rate: r5994 }), /Line 2.*dropped frame/);
});

test('EDL options, non-drop lists and hostile input', () => {
  const seq = readEdl('TITLE: Plain\n001  R1  V  C  00:00:01:00 00:00:02:00 01:00:00:00 01:00:01:00\n', { rate: { numerator: 25, denominator: 1 } });
  assert.equal(seq.clips[0]!.end, 25); assert.equal(seq.name, 'Plain'); assert.ok(!seq.notes.some(n => /assumed\. Choose/.test(n)));
  assert.throws(() => readEdl(''), /no edit events/);
  assert.throws(() => readEdl('TITLE: x\nhello\n'), /no edit events/);
  assert.match(readEdl('001 R V C 00:00:00:00 00:00:01:00 01:00:00:00 01:00:01:00\nwhat is this\n').notes.join(), /unrecognised/);
  assert.throws(() => readEdl('x'.repeat(9 * 1024 * 1024)), /exceeds/);
  assert.throws(() => readEdl('001 R V C 99:99:99:99 00:00:01:00 01:00:00:00 01:00:01:00'), /Line 1/);
});

test('OpenTimelineIO keeps mixed rates and reports transitions, nesting and speed', async () => {
  const seq = readOtio(fixture('mixed-rate.otio'));
  assert.deepEqual(seq.rate, { numerator: 24, denominator: 1 }); assert.equal(seq.timecodeStart, 86400);
  const [slow, ntsc] = seq.clips.filter(c => c.kind === 'video'), music = seq.clips.find(c => c.kind === 'audio')!;
  assert.deepEqual([slow!.start, slow!.end, slow!.in, slow!.out, slow!.path], [0, 48, 48, 96, 'file:///Media/slow.mov']);
  assert.equal(ntsc!.start, 60, 'a 12 frame gap follows the first clip'); assert.deepEqual(ntsc!.sourceRate, { numerator: 24000, denominator: 1001 });
  assert.equal(music.kind, 'audio'); assert.equal(music.end - music.start, 48); assert.equal(music.in, 24);
  const text = seq.notes.join('\n');
  for (const word of ['Speed changes', 'Transitions', 'Nested', 'rounded', 'audio samples']) assert.match(text, new RegExp(word), word);
  const { values } = await premiereSequenceValues(seq);
  assert.equal((values.boxes as unknown[]).length, 3);
});

test('OpenTimelineIO refuses non-timelines and bad JSON', () => {
  assert.throws(() => readOtio('{'), /not valid JSON/);
  assert.throws(() => readOtio('{"OTIO_SCHEMA":"Clip.1"}'), /not an OpenTimelineIO timeline/);
  assert.throws(() => readOtio('{"OTIO_SCHEMA":"Timeline.1","tracks":{"OTIO_SCHEMA":"Stack.1","children":[]}}'), /no clips/);
  const deep = '['.repeat(200) + ']'.repeat(200);
  assert.throws(() => readOtio(`{"OTIO_SCHEMA":"Timeline.1","x":${deep}}`), /structure limits/);
});

test('FCPXML 1.10 reads drop-frame timecode, lanes, mixed rates and reports unsupported items', async () => {
  const seq = readFcpxml(fixture('df-2997.fcpxml'), parse);
  assert.deepEqual(seq.rate, r2997); assert.equal(seq.dropFrame, true); assert.equal(seq.name, 'Drop frame story');
  assert.equal(seq.timecodeStart, 107892);
  const a = seq.clips.find(c => c.name === 'Interview A' && c.kind === 'video')!, b = seq.clips.find(c => c.name === 'Interview B' && c.kind === 'video')!;
  assert.deepEqual([a.start, a.end, a.in, a.out, a.sourceStart], [0, 150, 108000, 108150, 108000]);
  assert.equal(b.start, 180, 'a gap sits between the two interview clips');
  const cut = seq.clips.find(c => c.name === 'Cutaway B')!;
  assert.deepEqual([cut.track, cut.start, cut.end, cut.sourceRate], [1, 0, 60, { numerator: 24000, denominator: 1001 }]);
  assert.ok(seq.clips.some(c => c.kind === 'audio' && c.name === 'Interview A'));
  const text = seq.notes.join('\n');
  for (const word of ['Transitions', 'Compound', 'Titles', 'Effects', 'rounded']) assert.match(text, new RegExp(word), word);
  assert.equal(((await premiereSequenceValues(seq)).values.boxes as unknown[]).length, seq.clips.length);
});

test('FCPXML refuses unsupported versions, entities and missing sequences', () => {
  assert.throws(() => readFcpxml('<fcpxml version="1.7"><resources/></fcpxml>', parse), /unsupported/);
  assert.throws(() => readFcpxml('<fcpxml version="1.12"><resources/></fcpxml>', parse), /unsupported/);
  assert.throws(() => readFcpxml('<fcpxml version="1.10"><resources/></fcpxml>', parse), /no sequence/);
  assert.throws(() => readFcpxml('<!DOCTYPE fcpxml [<!ENTITY e "x">]><fcpxml version="1.10"/>', parse), /declaration/);
  assert.throws(() => readFcpxml('<other/>', parse), /not an FCPXML/);
  assert.equal(parseRationalSeconds('1001/30000s'), 1001 / 30000); assert.equal(parseRationalSeconds('5s'), 5);
  assert.equal(parseRationalSeconds('1/0s'), undefined); assert.equal(parseRationalSeconds('bad'), undefined);
});

test('format detection and the shared entry point', () => {
  assert.equal(detectTimelineFormat(fixture('df-2997.edl')), 'edl'); assert.equal(detectTimelineFormat(fixture('mixed-rate.otio')), 'otio');
  assert.equal(detectTimelineFormat(fixture('df-2997.fcpxml')), 'fcpxml');
  assert.equal(detectTimelineFormat(readFileSync(new URL('./fixtures/adobe/premiere.xml', import.meta.url), 'utf8')), 'xmeml');
  assert.equal(detectTimelineFormat('hello'), null); assert.equal(detectTimelineFormat('{"a":1}'), null);
  assert.throws(() => readTimeline('hello'), /not a timeline/);
  assert.throws(() => readTimeline(fixture('df-2997.fcpxml')), /parser is required/);
  assert.equal(readTimeline(fixture('df-2997.fcpxml'), { parse }).format, 'fcpxml');
  assert.equal(readTimeline(fixture('df-5994.edl'), { rate: r5994 }).sequence.clips.length, 2);
});
