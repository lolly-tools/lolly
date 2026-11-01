// SPDX-License-Identifier: MPL-2.0
/**
 * Tests for SCC (CEA-608 pop-on) and TTML/IMSC1 captions.
 *
 * Several cases are ported as data from filmcraft's crates/captions tests
 * (https://github.com/storytold/filmcraft, pin 9c6d661, MIT OR Apache-2.0):
 * the drop-frame timecode pairs, the TTML time-container cases, the timing
 * parameter table and the invalid time expressions. Only the inputs and expected
 * values are taken; the code under test is written from the CEA-608 and W3C specs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { validateManifest } from '../engine/src/validate.ts';
import { baseHost } from './helpers/host.ts';
import { CaptionFormatError, type CaptionCue } from '../engine/src/captions.ts';
import {
  cuesToScc, sccToCues, frameToTimecode, timecodeToFrame, withOddParity, hasOddParity, SCC_LIMITS,
} from '../engine/src/captions-scc.ts';
import { cuesToTtml, ttmlToCues, parseTtmlTime, IMSC11_TEXT_PROFILE } from '../engine/src/captions-ttml.ts';

const dom = new JSDOM('');
const parse = (s: string): Document => new dom.window.DOMParser().parseFromString(s, 'application/xml');
const FPS = 30000 / 1001;
const frameOf = (sec: number): number => Math.round(sec * FPS);
const sec = (frame: number): number => (frame * 1001) / 30000;
const cue = (s: number, e: number, text: string): CaptionCue => ({ start: sec(s), end: sec(e), text });
const frames = (cues: CaptionCue[]): [number, number, string][] => cues.map((c) => [frameOf(c.start), frameOf(c.end), c.text]);

// --- timecode and parity ------------------------------------------------------------

test('drop-frame timecode at minute marks (upstream pairs)', () => {
  assert.equal(frameToTimecode(1799, true), '00:00:59;29');
  assert.equal(frameToTimecode(1800, true), '00:01:00;02');
  assert.equal(frameToTimecode(1800, false), '00:01:00:00');
  assert.equal(frameToTimecode(17981, true), '00:09:59;29');
  assert.equal(frameToTimecode(17982, true), '00:10:00;00');
  assert.equal(frameToTimecode(17982 + 1800, true), '00:11:00;02');
  assert.equal(timecodeToFrame('00:01:00;02'), 1800);
  assert.equal(timecodeToFrame('00:01:00:00'), 1800);
  assert.equal(timecodeToFrame('00:10:00;00'), 17982);
  assert.equal(timecodeToFrame('00:00:01:00'), 30);
});

test('drop-frame timecode round-trips every frame across a day boundary sample', () => {
  for (let f = 0; f < 40_000; f += 7) assert.equal(timecodeToFrame(frameToTimecode(f, true)), f);
  for (const f of [107_892, 107_893, 1_078_920, 1_078_921]) assert.equal(timecodeToFrame(frameToTimecode(f, true)), f);
});

test('invalid timecodes are refused (upstream cases plus dropped frames)', () => {
  for (const tc of ['00:00:-5:00', '00:+1:00:00', '00:00:00:', '00:60:00:00', '00:00:60:00', '00:00:00:30', '00:01:00;00', '00:01:00;01']) {
    assert.equal(timecodeToFrame(tc), null, tc);
  }
  assert.equal(timecodeToFrame('00:10:00;00'), 17982);
});

test('odd parity', () => {
  assert.equal(withOddParity(0x14), 0x94);
  assert.equal(withOddParity(0x20), 0x20);
  assert.equal(withOddParity(0x21), 0xa1);
  assert.equal(withOddParity(0x48), 0xc8);
  assert.equal(withOddParity(0x45), 0x45);
  assert.equal(withOddParity(0x00), 0x80);
  for (let b = 0; b < 128; b++) assert.ok(hasOddParity(withOddParity(b)));
});

// --- SCC ----------------------------------------------------------------------------

test('control codes are doubled and every byte has odd parity', () => {
  const { text } = cuesToScc([cue(120, 200, 'Hi')]);
  const words = text.split('\n').filter((l) => /^\d\d:/.test(l)).flatMap((l) => l.split('\t')[1]!.split(' '));
  for (const w of words) {
    assert.ok(hasOddParity(parseInt(w.slice(0, 2), 16)) && hasOddParity(parseInt(w.slice(2), 16)), w);
  }
  assert.ok(text.startsWith('Scenarist_SCC V1.0\n\n'));
  // RCL RCL ENM ENM, then the preamble code twice, text, EOC EOC.
  assert.match(words.join(' '), /^9420 9420 94ae 94ae /);
  assert.match(words.join(' '), /942f 942f/);
  assert.match(words.join(' '), /9476 9476 9723 9723/);
});

test('reads a known pop-on (HELLO on row 15)', () => {
  const scc = 'Scenarist_SCC V1.0\n\n00:00:00;20\t9420 9420 94ae 94ae 9470 9470 c845 4c4c 4f80 942f 942f\n\n00:00:03;00\t942c 942c\n';
  const r = sccToCues(scc);
  assert.deepEqual(r.issues, []);
  assert.deepEqual(frames(r.cues), [[20 + 9, 90, 'HELLO']]);
});

test('write then read: frame-exact round trip, drop-frame and not', () => {
  const cues = [cue(60, 120, 'Hello, world!'), cue(120, 200, 'Second caption\nwith two lines'), cue(260, 300, 'Ñandú ♪ {x} * café “q”')];
  for (const dropFrame of [true, false]) {
    const w = cuesToScc(cues, { dropFrame });
    assert.deepEqual(w.issues, []);
    assert.deepEqual(frames(sccToCues(w.text).cues), frames(cues));
  }
});

test('captions across a minute boundary survive drop-frame', () => {
  const cues = [cue(1700, 1799, 'before'), cue(1802, 1900, 'after')];
  const back = sccToCues(cuesToScc(cues).text).cues;
  assert.deepEqual(frames(back), frames(cues));
});

test('back-to-back captions stay exact and a cue at zero is delayed, not lost', () => {
  const cues = [cue(90, 150, 'One'), cue(150, 230, 'Two'), cue(230, 300, 'Three')];
  assert.deepEqual(frames(sccToCues(cuesToScc(cues).text).cues), frames(cues));
  const w = cuesToScc([cue(0, 60, 'Start')]);
  assert.ok(w.issues.some((i) => i.code === 'delayed'));
  const back = sccToCues(w.text).cues;
  assert.equal(back.length, 1);
  assert.equal(back[0]!.text, 'Start');
  assert.equal(frameOf(back[0]!.end), 60);
});

test('SRT-style timings keep text and frames (upstream chain)', () => {
  const cues: CaptionCue[] = [{ start: 2.002, end: 4.004, text: 'Hello there' }, { start: 5.005, end: 7.007, text: '<i>General</i> Kenobi' }];
  const w = cuesToScc(cues);
  assert.ok(w.issues.some((i) => i.code === 'style'));
  const back = sccToCues(w.text).cues;
  assert.deepEqual(back.map((c) => c.text), ['Hello there', 'General Kenobi']);
  assert.equal(frameOf(back[0]!.start), 60);
  assert.equal(frameOf(back[1]!.end), 210);
});

test('long lines wrap to 32 columns and nothing is lost', () => {
  const long = 'the quick brown fox jumps over the lazy dog and keeps running far away';
  const back = sccToCues(cuesToScc([cue(90, 300, long)]).text).cues;
  assert.equal(back[0]!.text.split('\n').every((r) => r.length <= 32), true);
  assert.equal(back[0]!.text.replace(/\n/g, ' '), long);
  const giant = sccToCues(cuesToScc([cue(90, 300, 'x'.repeat(100))]).text).cues[0]!.text;
  assert.equal(giant.replace(/\n/g, ''), 'x'.repeat(100));
});

test('characters: special, extended and substituted basic ones round-trip', () => {
  const text = '® ° ½ ¿ ™ ¢ £ ♪ à è â ê î ô û / Á É Ó Ú Ü ü ¡ * — © • “ ” À Â Ç È Ê Ë ë Î Ï ï Ô Ù ù Û « » / Ã ã Í Ì ì Ò ò Õ õ { } \\ ^ _ | ~ Ä ä Ö ö ß ¥ ¤ │ Å å Ø ø ┌ ┐ └ ┘ / á é í ó ú ç ÷ Ñ ñ ■';
  const lines: string[] = [];
  // Rows are 32 columns; one cue per few characters keeps each below the wrap point.
  const chars = text.split(' / ').flatMap((g) => g.split(' '));
  for (let i = 0; i < chars.length; i += 8) lines.push(chars.slice(i, i + 8).join(' '));
  const cues = lines.map((l, i) => cue(120 + i * 150, 220 + i * 150, l));
  const w = cuesToScc(cues);
  assert.deepEqual(w.issues, []);
  assert.deepEqual(sccToCues(w.text).cues.map((c) => c.text), lines);
});

test('characters that cannot be carried are reported, never dropped', () => {
  assert.throws(() => cuesToScc([cue(90, 150, 'smile \u{1F600} `tick`')]), (e: Error) => e instanceof CaptionFormatError && /U\+1F600/.test(e.message) && /U\+0060/.test(e.message));
  const r = cuesToScc([cue(90, 150, 'ok \u{1F600}')], { onUnsupported: 'replace' });
  assert.ok(r.issues.some((i) => i.code === 'unsupported-character' && /1F600/.test(i.message)));
  assert.equal(sccToCues(r.text).cues[0]!.text, 'ok ?');
});

test('too many rows, bad times and empty text', () => {
  assert.throws(() => cuesToScc([cue(90, 150, Array(16).fill('a').join('\n'))]), CaptionFormatError);
  assert.throws(() => cuesToScc([{ start: NaN, end: 1, text: 'x' }]), CaptionFormatError);
  assert.throws(() => cuesToScc([{ start: -1, end: 1, text: 'x' }]), CaptionFormatError);
  const r = cuesToScc([cue(90, 150, '   ')]);
  assert.ok(r.issues.some((i) => i.code === 'empty-caption'));
  assert.deepEqual(sccToCues(r.text).cues, []);
});

test('roll-up and paint-on are reported and skipped; strict refuses', () => {
  const rollUp = 'Scenarist_SCC V1.0\n\n00:00:00:00\t9425 9425 94ad 94ad c1c2 94ad 94ad 4344\n\n00:00:02:00\t942c 942c\n';
  const r = sccToCues(rollUp);
  assert.deepEqual(r.cues, []);
  assert.ok(r.issues.some((i) => i.code === 'roll-up'));
  assert.throws(() => sccToCues(rollUp, { strict: true }), CaptionFormatError);
  const paint = 'Scenarist_SCC V1.0\n\n00:00:00:00\t9429 9429 9470 9470 c1c2\n\n00:00:02:00\t942c 942c\n';
  assert.ok(sccToCues(paint).issues.some((i) => i.code === 'paint-on'));
  const ch2 = 'Scenarist_SCC V1.0\n\n00:00:01:00\t1c20 1c20 1c2e 1c2e 1c70 1c70 c1c2 1c2f 1c2f\n';
  assert.deepEqual(sccToCues(ch2).cues, []);
});

test('bad parity is read and counted', () => {
  const scc = 'Scenarist_SCC V1.0\n\n00:00:00;20\t1420 1420 14ae 14ae 1470 1470 4845 942f 942f\n\n00:00:03;00\t942c 942c\n';
  const r = sccToCues(scc);
  assert.equal(r.cues[0]!.text, 'HE');
  assert.ok(r.issues.some((i) => i.code === 'parity'));
});

test('malformed SCC is refused with a clear error', () => {
  const bad = [
    '', 'hello', 'Scenarist_SCC V2.0\n\n', 'Scenarist_SCC V1.0\n\nnot a line',
    'Scenarist_SCC V1.0\n\n00:00:00;20\tzz20',
    'Scenarist_SCC V1.0\n\n00:00:00;20\t942',
    'Scenarist_SCC V1.0\n\n00:00:61;00\t9420',
    'Scenarist_SCC V1.0\n\n00:00:05:00\t9420 9420\n\n00:00:01:00\t9420',
  ];
  for (const s of bad) assert.throws(() => sccToCues(s), CaptionFormatError, JSON.stringify(s));
  assert.throws(() => sccToCues('Scenarist_SCC V1.0\n\n' + 'a'.repeat(SCC_LIMITS.maxChars)), /larger than/);
});

test('an unterminated caption is closed and reported', () => {
  const scc = 'Scenarist_SCC V1.0\n\n00:00:00;20\t9420 9420 94ae 94ae 9470 9470 c845 4c4c 4f80 942f 942f\n';
  const r = sccToCues(scc);
  assert.equal(r.cues.length, 1);
  assert.ok(r.issues.some((i) => i.code === 'unterminated'));
});

test('reader tolerates CRLF, BOM and lower or upper case hex', () => {
  const scc = '\uFEFFScenarist_SCC V1.0\r\n\r\n00:00:00;20\t9420 9420 94AE 94AE 9470 9470 C845 4C4C 4F80 942F 942F\r\n\r\n00:00:03;00\t942c 942c\r\n';
  assert.equal(sccToCues(scc).cues[0]!.text, 'HELLO');
});

// --- TTML ---------------------------------------------------------------------------

const wrap = (body: string, attrs = ''): string =>
  `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" xmlns:tts="http://www.w3.org/ns/ttml#styling" ${attrs}>${body}</tt>`;
const times = (xml: string): [number, number, string][] => ttmlToCues(xml, parse).cues.map((c) => [c.start, c.end, c.text]);
const near = (got: [number, number, string][], want: [number, number, string][]): void => {
  assert.equal(got.length, want.length);
  got.forEach((g, i) => {
    assert.ok(Math.abs(g[0] - want[i]![0]) < 1e-9 && Math.abs(g[1] - want[i]![1]) < 1e-9 && g[2] === want[i]![2], JSON.stringify([g, want[i]]));
  });
};

test('writer: IMSC1.1 text profile, media time, escaped text, br', () => {
  const x = cuesToTtml([{ start: 1.5, end: 3.25, text: 'A & B <ok>\nsecond "line"' }, { start: 3661.001, end: 3662, text: 'late' }], { lang: 'en-GB' });
  assert.ok(x.includes(`ttp:contentProfiles="${IMSC11_TEXT_PROFILE}"`));
  assert.ok(x.includes('ttp:timeBase="media"') && x.includes('xml:lang="en-GB"'));
  assert.ok(x.includes('begin="00:00:01.500" end="00:00:03.250"'));
  assert.ok(x.includes('begin="01:01:01.001"'));
  assert.ok(x.includes('A &amp; B &lt;ok&gt;<br/>second &quot;line&quot;'));
  assert.ok(!/tts:(color|fontFamily|fontSize)/.test(x));
  assert.equal(parse(x).getElementsByTagName('parsererror').length, 0);
});

test('writer refuses bad input', () => {
  assert.throws(() => cuesToTtml([{ start: 0, end: 1, text: 'a\u0001b' }]), CaptionFormatError);
  assert.throws(() => cuesToTtml([{ start: 2, end: 1, text: 'a' }]), CaptionFormatError);
  assert.throws(() => cuesToTtml([{ start: 0, end: 1, text: 'a' }], { lang: 'bad lang"' }), CaptionFormatError);
});

test('round trip at millisecond resolution', () => {
  const cues: CaptionCue[] = [
    { start: 0, end: 1.234, text: 'Hello' },
    { start: 2, end: 4.5, text: 'Two lines\nof text é ñ 日本 & <b>' },
    { start: 7200.5, end: 7201, text: 'Over two hours' },
  ];
  const r = ttmlToCues(cuesToTtml(cues), parse);
  assert.deepEqual(r.issues, []);
  near(r.cues.map((c) => [c.start, c.end, c.text]), cues.map((c) => [c.start, c.end, c.text]));
});

test('time containers offset and clip (upstream cases)', () => {
  near(times(wrap('<body begin="5s"><div><p begin="1s" end="2s">x</p></div></body>')), [[6, 7, 'x']]);
  near(times(wrap('<body><div begin="5s"><p begin="1s" end="2s">x</p></div></body>')), [[6, 7, 'x']]);
  near(times(wrap('<body><div><p begin="1s" end="2s">x</p></div></body>')), [[1, 2, 'x']]);
  near(
    times(wrap('<body begin="5s"><div begin="00:00:10.000"><div begin="1s"><p begin="1s" end="2s">deep</p></div><p begin="0s" dur="1s">mid</p></div><p begin="1s" end="2s">top</p></body>')),
    [[6, 7, 'top'], [15, 16, 'mid'], [17, 18, 'deep']],
  );
  near(times(wrap('<body begin="5s"><div><p><span begin="1s" end="2s">x</span></p></div></body>')), [[6, 7, 'x']]);
  near(
    times(wrap('<body begin="1s"><div begin="10s" end="12s"><p begin="1s" end="5s">cut</p><p begin="3s" end="4s">gone</p></div></body>')),
    [[12, 13, 'cut']],
  );
  near(times(wrap('<body dur="3s"><div><p begin="1s" end="5s">x</p></div></body>')), [[1, 3, 'x']]);
  near(
    times(wrap('<body><div begin="2s" end="6s"><p begin="1s">open</p></div><div begin="10s" dur="2s"><p>whole</p></div></body>')),
    [[3, 6, 'open'], [10, 12, 'whole']],
  );
  near(times(wrap('<body><div><p begin="1s" end="5s" dur="2s">x</p></div></body>')), [[1, 3, 'x']]);
});

test('seq containers are read as par with a note', () => {
  const r = ttmlToCues(wrap('<body><div timeContainer="seq"><p begin="1s" end="2s">x</p></div></body>'), parse);
  assert.equal(r.cues.length, 1);
  assert.ok(r.issues.some((i) => i.code === 'seq'));
  assert.throws(() => ttmlToCues(wrap('<body><div timeContainer="seq"><p begin="1s" end="2s">x</p></div></body>'), parse, { strict: true }), CaptionFormatError);
});

test('timing parameters: frame, tick and sub-frame rates (upstream table)', () => {
  const table: [string, string, string][] = [
    ['', '1s', '2s'],
    ['ttp:frameRate="25" ttp:frameRateMultiplier="2 1"', '50t', '100t'],
    ['ttp:frameRate="30" ttp:frameRateMultiplier="1000 1001" ttp:subFrameRate="1001"', '30000t', '60000t'],
    ['ttp:frameRate="25"', '25f', '50f'],
    ['ttp:frameRate="30" ttp:subFrameRate="2"', '60t', '120t'],
    ['ttp:frameRate="30" ttp:subFrameRate="2" ttp:tickRate="10"', '10t', '20t'],
    ['ttp:frameRate="25" ttp:frameRateMultiplier="2 1"', '50f', '100f'],
  ];
  for (const [params, b, e] of table) near(times(wrap(`<body><div><p begin="${b}" end="${e}">Hello</p></div></body>`, params)), [[1, 2, 'Hello']]);
  const ntsc = 'ttp:frameRate="30" ttp:frameRateMultiplier="1000 1001"';
  near(times(wrap('<body><div><p begin="30t" end="60t">H</p></div></body>', ntsc)), [[1.001, 2.002, 'H']]);
  near(times(wrap('<body><div><p begin="1.5t" end="3t">H</p></div></body>', ntsc)), [[0.05005, 0.1001, 'H']]);
  near(times(wrap('<body><div><p begin="1.5t" end="12.5t">H</p></div></body>', 'ttp:tickRate="10"')), [[0.15, 1.25, 'H']]);
});

test('invalid timing parameters are refused', () => {
  for (const params of ['ttp:frameRate="0"', 'ttp:frameRate="-25"', 'ttp:frameRate=""', 'ttp:subFrameRate="0"', 'ttp:tickRate="-1"',
    'ttp:frameRateMultiplier="1 0"', 'ttp:frameRateMultiplier="1"', 'ttp:frameRateMultiplier="1 2 3"', 'ttp:timeBase="smpte"']) {
    assert.throws(() => ttmlToCues(wrap('<body><div><p begin="1s" end="2s">Hello</p></div></body>', params), parse), CaptionFormatError, params);
  }
});

test('time expressions (upstream cases)', () => {
  const t = { fps: 25, nominal: 25, subFrames: 1, tickRate: 1 };
  const ok: [string, number][] = [['00:00:01.500', 1.5], ['01:00:00', 3600], ['00:00:02:12', 2.48], ['2.5s', 2.5], ['1500ms', 1.5], ['0.5m', 30], ['50f', 2], ['0s', 0], ['1ms', 0.001]];
  for (const [e, v] of ok) assert.ok(Math.abs(parseTtmlTime(e, t)! - v) < 1e-9, e);
  for (const e of ['bogus', '1:2', '999999999999999h', '999999999999999m', '999999999999999s', '999999999999999ms', '999999999999999f', '999999999999999t',
    '00:60:00', '00:00:60', '00:00:01:25', 's', 'ms', 'h', 'm', 't', 'f', '.5s', '.5ms', '.s', '1.xt', '1.1234567890123t']) {
    assert.equal(parseTtmlTime(e, t), null, e);
  }
  const sub = { ...t, subFrames: 2 };
  assert.notEqual(parseTtmlTime('00:00:01:12.1', sub), null);
  assert.equal(parseTtmlTime('00:00:01:12.2', sub), null);
});

test('bad cue times are skipped and reported', () => {
  const r = ttmlToCues(wrap('<body><div><p begin="999999999999999s" end="2s">Bad</p><p begin="1s" end="2s">Good</p></div></body>'), parse);
  assert.deepEqual(r.cues.map((c) => c.text), ['Good']);
  assert.ok(r.issues.length > 0);
});

test('whitespace, br, spans, styling note, head ignored', () => {
  const xml = wrap(`<head><styling><style xml:id="it" tts:fontStyle="italic"/></styling></head>
    <body><div><p begin="00:00:01.000" end="00:00:02.000">Hello
      <span tts:fontStyle="italic">big</span>   world<br/>
      second   line</p></div></body>`);
  const r = ttmlToCues(xml, parse);
  assert.equal(r.cues[0]!.text, 'Hello big world\nsecond line');
  assert.ok(r.issues.some((i) => i.code === 'styling'));
});

test('malformed TTML is refused', () => {
  for (const s of ['', 'not xml', '<html/>', '<tt><body>', '<!DOCTYPE tt [<!ENTITY a "b">]><tt/>', '<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="1s" end="2s">a</p></div></body>']) {
    assert.throws(() => ttmlToCues(s, parse), CaptionFormatError, s);
  }
  assert.throws(() => ttmlToCues('<tt>' + ' '.repeat(9 * 1024 * 1024) + '</tt>', parse), CaptionFormatError);
  const deep = `<tt>${'<div>'.repeat(100)}<p begin="0s" end="1s">c</p>${'</div>'.repeat(100)}</tt>`;
  assert.throws(() => ttmlToCues(deep, parse), CaptionFormatError);
});

test('every writer output is read back by the other reader types without error', () => {
  const cues: CaptionCue[] = [{ start: 3, end: 5, text: 'Hello there' }, { start: 6, end: 8, text: 'Second' }];
  assert.deepEqual(sccToCues(cuesToScc(cues).text).cues.map((c) => c.text), ['Hello there', 'Second']);
  assert.deepEqual(ttmlToCues(cuesToTtml(cues), parse).cues.map((c) => c.text), ['Hello there', 'Second']);
});

// --- tool export wiring -------------------------------------------------------------

async function exportFixture(format: 'ttml' | 'scc', cuesJson: string): Promise<Blob> {
  const manifest = {
    id: 'captions-fixture', name: 'Captions fixture', version: '1.0.0', engineVersion: '>=1.150.0', status: 'official', category: 'utility',
    render: { width: 100, height: 100, formats: ['png', format] },
    inputs: [{ id: 'cues', type: 'longtext', label: 'Cues' }],
  };
  assert.ok(validateManifest(manifest).valid, JSON.stringify(validateManifest(manifest).errors));
  const files: Record<string, string> = {
    'captions-fixture/tool.json': JSON.stringify(manifest),
    'captions-fixture/template.html': '<div>{{cues}}</div>',
    [`captions-fixture/template.${format}`]: '{{{cues}}}',
  };
  const tool = await loadTool('captions-fixture', async (path: string) => {
    const hit = files[path];
    if (hit == null) throw new Error(`not found: ${path}`);
    return hit;
  });
  const host = baseHost({
    export: { render: async (_n: unknown, _f: string, opts: any) => new Blob([opts.dataText ?? ''], { type: opts.dataMime ?? 'text/plain' }) },
  }) as never;
  const rt = await createRuntime(tool, host, { cues: cuesJson });
  return rt.export({} as never, format, { embedMeta: false } as never);
}

test('a tool can export ttml and scc from its cue list', async () => {
  const list = JSON.stringify([{ start: 3, end: 5, text: 'Hello there' }]);
  const ttml = await exportFixture('ttml', list);
  assert.equal(ttml.type, 'application/ttml+xml');
  assert.equal(ttmlToCues(await ttml.text(), parse).cues[0]!.text, 'Hello there');
  const scc = await exportFixture('scc', JSON.stringify({ cues: JSON.parse(list) }));
  assert.equal(sccToCues(await scc.text()).cues[0]!.text, 'Hello there');
  await assert.rejects(exportFixture('scc', JSON.stringify([{ start: 3, end: 5, text: '\u{1F600}' }])), /cannot carry/);
  await assert.rejects(exportFixture('ttml', 'nope'), /could not be read/);
});
