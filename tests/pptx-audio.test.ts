// SPDX-License-Identifier: MPL-2.0
/**
 * Per-slide narration in the .pptx writer (plans/180 section 5, milestone M-C).
 *
 * A narrated slide is a `p:pic` that draws a speaker icon and carries a sound, plus a
 * `<p:audio>` node in the slide's timing tree that starts it, plus `advTm` on the
 * transition that moves the deck on when it ends. Four things are pinned here:
 *
 *   • the PART SHAPE - a separate content-type family, a separate rel-id run, and the
 *     two relationships to one sound part that PowerPoint actually requires;
 *   • the XML the pic, the p14 media extension and the media node come out as;
 *   • BYTE-IDENTITY - a deck with no audio anywhere comes out exactly as it did before
 *     this existed, which is the rule every additive change to this writer lives under;
 *   • the READ side, so an imported deck's narration can be bound back to a box.
 *
 * The bytes go in verbatim: a narration clip carries a synthetic-voice credential in its
 * RIFF chunks and a re-encode would strip it (plans/180 section 7).
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/pptx-audio.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { buildPptxParts, timingXml, EMU_PER_PX } from '../engine/src/pptx.ts';
import type { PptxSlide, PptxAudio } from '../engine/src/pptx.ts';
import { readPptx } from '../engine/src/pptx-read.ts';
import type { PptxParts } from '../engine/src/pptx-read.ts';

const win = new JSDOM('').window;
const domParser = new win.DOMParser();
const parseXml = (xml: string): Document => domParser.parseFromString(xml, 'application/xml') as unknown as Document;

const EMU_W = Math.round(1280 * EMU_PER_PX);
const EMU_H = Math.round(720 * EMU_PER_PX);
const OPTS = { emuW: EMU_W, emuH: EMU_H, now: '2026-09-03T00:00:00Z' };

/** A stand-in for a credentialed WAV - the exact bytes must come out the other side. */
const WAV = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x2a, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);

const audio = (over: Partial<PptxAudio> = {}): PptxAudio => ({
  bytes: WAV, ext: 'wav', durationMs: 11_400, autoplay: true, ...over,
});

const slide = (over: Partial<PptxSlide> = {}): PptxSlide => ({ shapes: [], media: [], ...over });

const str = (parts: Record<string, string | Uint8Array>, k: string): string => {
  const v = parts[k];
  assert.equal(typeof v, 'string', `${k} is missing or not XML`);
  return v as string;
};

// ─── the part family ──────────────────────────────────────────────────────────

test('a narrated slide emits the sound part, the shared speaker poster and their Defaults', () => {
  const parts = buildPptxParts([slide({ audio: audio() })], OPTS);

  const bytes = parts['ppt/media/audio1.wav'];
  assert.ok(bytes instanceof Uint8Array, 'the sound part is present');
  assert.deepEqual(Array.from(bytes as Uint8Array), Array.from(WAV),
    'the caller bytes go in VERBATIM - a re-encode would strip the synthetic-voice credential');

  const icon = parts['ppt/media/audioIcon.png'];
  assert.ok(icon instanceof Uint8Array && (icon as Uint8Array).byteLength > 0, 'the poster part is present');
  // A real PNG, not a placeholder: a p:pic must draw something.
  assert.deepEqual(Array.from((icon as Uint8Array).slice(0, 8)), [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ct = str(parts, '[Content_Types].xml');
  assert.match(ct, /<Default Extension="wav" ContentType="audio\/wav"\/>/);
  // The poster forces a png Default even on a deck with no image on any slide.
  assert.match(ct, /<Default Extension="png" ContentType="image\/png"\/>/);
});

test('mp3 and m4a get their own content types; an unknown extension is refused outright', () => {
  const mp3 = buildPptxParts([slide({ audio: audio({ ext: 'mp3' }) })], OPTS);
  assert.match(str(mp3, '[Content_Types].xml'), /<Default Extension="mp3" ContentType="audio\/mpeg"\/>/);
  assert.ok('ppt/media/audio1.mp3' in mp3);

  const m4a = buildPptxParts([slide({ audio: audio({ ext: 'm4a' }) })], OPTS);
  assert.match(str(m4a, '[Content_Types].xml'), /<Default Extension="m4a" ContentType="audio\/mp4"\/>/);

  // An extension with no Default would be an undeclared part - a PowerPoint repair. It
  // is dropped, and `constructor` proves the check is an own-property one, not `in`.
  for (const ext of ['ogg', 'constructor']) {
    const bad = buildPptxParts([slide({ audio: audio({ ext: ext as PptxAudio['ext'] }) })], OPTS);
    assert.deepEqual(bad, buildPptxParts([slide()], OPTS), `${ext} is written as no audio at all`);
  }
});

test('the three relationships: audio and media point at ONE part, image at the poster', () => {
  const parts = buildPptxParts([slide({ audio: audio() })], OPTS);
  const rels = str(parts, 'ppt/slides/_rels/slide1.xml.rels');
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

  // rId1 is the layout; there is no image media and no note, so the audio run starts at 2.
  assert.match(rels, new RegExp(`<Relationship Id="rId2" Type="${REL}/audio" Target="\\.\\./media/audio1\\.wav"/>`));
  assert.match(rels, new RegExp(`<Relationship Id="rId3" Type="${REL}/media" Target="\\.\\./media/audio1\\.wav"/>`));
  assert.match(rels, new RegExp(`<Relationship Id="rId4" Type="${REL}/image" Target="\\.\\./media/audioIcon\\.png"/>`));
});

test('images, notes, audio and slide-jump links all keep their own rel-id run', () => {
  const png = new Uint8Array([1, 2, 3]);
  const deck: PptxSlide[] = [
    {
      shapes: [
        { kind: 'pic', x: 0, y: 0, cx: 100, cy: 100, media: 0 },
        { kind: 'text', x: 0, y: 0, cx: 100, cy: 100, paras: [{ runs: [{ text: 'Agenda', sizePt: 12, linkSlide: 1 }] }] },
      ],
      media: [{ bytes: png, ext: 'png' }],
      notes: 'Say the thing.',
      audio: audio(),
    },
    slide(),
  ];
  const rels = str(buildPptxParts(deck, OPTS), 'ppt/slides/_rels/slide1.xml.rels');
  // layout=1, image=2, notesSlide=3, audio=4, media=5, poster=6, then the jump at 7.
  assert.match(rels, /Id="rId2" Type="[^"]+\/image" Target="\.\.\/media\/image1_1\.png"/);
  assert.match(rels, /Id="rId3" Type="[^"]+\/notesSlide"/);
  assert.match(rels, /Id="rId4" Type="[^"]+\/audio"/);
  assert.match(rels, /Id="rId5" Type="[^"]+\/media"/);
  assert.match(rels, /Id="rId6" Type="[^"]+\/image" Target="\.\.\/media\/audioIcon\.png"/);
  assert.match(rels, /Id="rId7" Type="[^"]+\/slide" Target="slide2\.xml"/);
  // …and the run text points at the SAME id the rel got, or the jump goes nowhere.
  assert.match(str(buildPptxParts(deck, OPTS), 'ppt/slides/slide1.xml'),
    /<a:hlinkClick r:id="rId7" action="ppaction:\/\/hlinksldjump"\/>/);
});

// ─── the shape ────────────────────────────────────────────────────────────────

test('the audio p:pic carries the media action, the audioFile link and the p14 embed', () => {
  const parts = buildPptxParts([slide({ audio: audio({ name: 'slide-1-narration.wav' }) })], OPTS);
  const xml = str(parts, 'ppt/slides/slide1.xml');

  assert.match(xml, /<p:cNvPr id="2" name="slide-1-narration\.wav"><a:hlinkClick r:id="" action="ppaction:\/\/media"\/><\/p:cNvPr>/);
  assert.match(xml, /<p:nvPr><a:audioFile r:link="rId2"\/>/);
  assert.match(
    xml,
    /<p:extLst><p:ext uri="\{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230\}"><p14:media xmlns:p14="http:\/\/schemas\.microsoft\.com\/office\/powerpoint\/2010\/main" r:embed="rId3"\/><\/p:ext><\/p:extLst>/,
    'the 2010 media extension is what PowerPoint actually plays',
  );
  assert.match(xml, /<p:blipFill><a:blip r:embed="rId4"\/><a:stretch><a:fillRect\/><\/a:stretch><\/p:blipFill>/);

  // Bottom-right, 0.4in square, 0.15in in - small enough not to sit on the design.
  const off = /<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/><\/a:xfrm><a:prstGeom prst="rect"><a:avLst\/><\/a:prstGeom><\/p:spPr><\/p:pic>/.exec(xml);
  assert.ok(off, 'the pic carries a real xfrm');
  const [x, y, cx, cy] = off!.slice(1).map(Number) as [number, number, number, number];
  assert.equal(cx, 365760);
  assert.equal(cy, 365760);
  assert.equal(x, EMU_W - cx - 137160);
  assert.equal(y, EMU_H - cy - 137160);

  // A nameless clip still gets a name a person can find in the selection pane.
  const anon = str(buildPptxParts([slide({ audio: audio() })], OPTS), 'ppt/slides/slide1.xml');
  assert.match(anon, /name="narration\.wav"/);
});

test('the narration pic is appended LAST, so animated shapes keep their spid', () => {
  const s = slide({
    shapes: [
      { kind: 'rect', x: 0, y: 0, cx: 10, cy: 10 },
      { kind: 'text', x: 0, y: 0, cx: 10, cy: 10, paras: [], anim: { enter: { preset: 'fade', ms: 400 } } },
    ],
    audio: audio(),
  });
  const xml = str(buildPptxParts([s], OPTS), 'ppt/slides/slide1.xml');
  // The text shape is index 1, so spid 3 - unchanged by the pic that follows it.
  assert.match(timingXml(s), /<p:spTgt spid="3"\/>/);
  assert.match(xml, /<p:pic><p:nvPicPr><p:cNvPr id="4"/, 'the audio pic takes the id after the shapes');
  // …and it draws after both authored shapes, so it can never cover one of them.
  assert.ok(xml.indexOf('name="text3"') < xml.indexOf('ppaction://media'));
});

// ─── autoplay and auto-advance ────────────────────────────────────────────────

test('autoplay is a p:audio media node in the step-0 group, not an attribute', () => {
  const t = timingXml(slide({ audio: audio() }));
  assert.match(t, /<p:audio isNarration="1"><p:cMediaNode><p:cTn id="\d+" fill="hold" display="0">/);
  assert.match(t, /<p:stCondLst><p:cond delay="0"\/><\/p:stCondLst><\/p:cTn><p:tgtEl><p:sndTgt r:embed="rId3"\/><\/p:tgtEl>/);
  // The whole tree exists purely for the sound: root, mainSeq, one empty step-0 group.
  assert.match(t, /nodeType="tmRoot"/);
  assert.match(t, /<p:childTnLst><p:audio /, 'the step-0 group holds nothing but the sound');
});

test('the media node points at the SAME rel the p14 extension embeds', () => {
  const s = slide({ media: [{ bytes: new Uint8Array([1]), ext: 'png' }], notes: 'hi', audio: audio() });
  const xml = str(buildPptxParts([s], OPTS), 'ppt/slides/slide1.xml');
  const embed = /<p14:media [^>]*r:embed="(rId\d+)"\/>/.exec(xml)?.[1];
  const sndTgt = /<p:sndTgt r:embed="(rId\d+)"\/>/.exec(xml)?.[1];
  assert.equal(embed, 'rId5', 'layout, image, notesSlide, audio, then media');
  assert.equal(sndTgt, embed, 'a mismatch here plays silence and nobody can see why');
});

test('a clip that is NOT autoplay still ships, it just never starts itself', () => {
  const s = slide({ audio: audio({ autoplay: false }) });
  assert.equal(timingXml(s), '', 'no timing tree at all - byte-identity with a plain slide');
  const parts = buildPptxParts([s], OPTS);
  assert.ok('ppt/media/audio1.wav' in parts, 'the sound is still in the package');
  assert.match(str(parts, 'ppt/slides/slide1.xml'), /ppaction:\/\/media/, 'and still clickable');
});

test('an autoplaying clip on a slide that also animates rides the step-0 group after its effects', () => {
  const s = slide({
    shapes: [{ kind: 'text', x: 0, y: 0, cx: 10, cy: 10, paras: [], anim: { enter: { preset: 'fade', ms: 400 } } }],
    audio: audio(),
  });
  const t = timingXml(s);
  assert.ok(t.indexOf('<p:animEffect') < t.indexOf('<p:audio'), 'the entrance is minted before the sound');
  assert.equal(t.split('<p:audio').length - 1, 1, 'one sound, one node');
  // One step-0 group holding both, not a second group bolted on for the sound.
  assert.match(t, /<p:animEffect[\s\S]*<\/p:par><p:audio [\s\S]*<\/p:audio><\/p:childTnLst>/);
});

test('a click-step animation does not swallow the narration: step 0 is created for it', () => {
  const s = slide({
    shapes: [{ kind: 'text', x: 0, y: 0, cx: 10, cy: 10, paras: [], anim: { click: 2, enter: { preset: 'appear', ms: 1 } } }],
    audio: audio(),
  });
  const t = timingXml(s);
  assert.match(t, /<p:cond delay="0"\/><\/p:stCondLst><p:childTnLst><p:par><p:cTn id="\d+" fill="hold"><p:stCondLst><p:cond delay="0"\/><\/p:stCondLst><p:childTnLst><p:audio/);
  assert.match(t, /<p:cond delay="indefinite"\/>/, 'the click step is still there');
  assert.ok(t.indexOf('<p:audio') < t.indexOf('delay="indefinite"'), 'step 0 sorts before step 2');
});

test('advanceAfterMs writes advTm - with a transition, and on a slide that has none', () => {
  const withFade = str(
    buildPptxParts([slide({ transition: { kind: 'fade', ms: 400 }, audio: audio({ advanceAfterMs: 12_400 }) })], OPTS),
    'ppt/slides/slide1.xml',
  );
  assert.match(withFade, /<p:transition spd="fast" advTm="12400"><p:fade\/><\/p:transition>/);

  const bare = str(buildPptxParts([slide({ audio: audio({ advanceAfterMs: 12_400 }) })], OPTS), 'ppt/slides/slide1.xml');
  assert.match(bare, /<p:transition advTm="12400"\/>/, 'the empty element PowerPoint itself writes for "After: 12.4s"');
  // CT_Slide child order: transition between clrMapOvr and timing.
  assert.match(bare, /<\/p:clrMapOvr><p:transition advTm="12400"\/><p:timing>/);

  // Nonsense never reaches the attribute, and the ceiling is an hour.
  for (const ms of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const x = str(buildPptxParts([slide({ audio: audio({ advanceAfterMs: ms }) })], OPTS), 'ppt/slides/slide1.xml');
    assert.ok(!x.includes('<p:transition'), `advanceAfterMs ${ms} writes nothing`);
  }
  const huge = str(buildPptxParts([slide({ audio: audio({ advanceAfterMs: 9e9 }) })], OPTS), 'ppt/slides/slide1.xml');
  assert.match(huge, /advTm="3600000"/);
});

// ─── byte-identity ────────────────────────────────────────────────────────────

test('a deck with no audio is byte-identical to the deck this builder wrote before narration', () => {
  const deck = (withAudio: boolean): PptxSlide[] => [
    {
      shapes: [{ kind: 'text', x: 0, y: 0, cx: 100, cy: 100, paras: [{ runs: [{ text: 'Hello', sizePt: 24 }] }] }],
      media: [{ bytes: new Uint8Array([1, 2]), ext: 'png' }],
      notes: 'A note.',
      transition: { kind: 'push', dir: 'l' },
      ...(withAudio ? { audio: audio() } : {}),
    },
    { shapes: [], media: [] },
  ];
  const plain = buildPptxParts(deck(false), OPTS);
  const narrated = buildPptxParts(deck(true), OPTS);

  // Everything the audio does not touch matches exactly.
  for (const k of Object.keys(plain)) {
    if (k === '[Content_Types].xml' || k === 'ppt/slides/slide1.xml' || k === 'ppt/slides/_rels/slide1.xml.rels') continue;
    assert.deepEqual(narrated[k], plain[k], k);
  }
  // And the audio-free deck itself is unchanged by the field existing at all.
  const before = buildPptxParts([{ shapes: [], media: [] }], OPTS);
  const after = buildPptxParts([{ shapes: [], media: [], audio: undefined }], OPTS);
  assert.deepEqual(after, before);
});

// ─── the read side ────────────────────────────────────────────────────────────

test('readPptx resolves a slide audio rel back to its part and extension', () => {
  const parts = buildPptxParts(
    [slide({ audio: audio(), notes: 'Say it.' }), slide(), slide({ audio: audio({ ext: 'm4a' }) })],
    OPTS,
  );
  const deck = readPptx(parts as unknown as PptxParts, parseXml);
  assert.deepEqual(deck.slides[0]!.audio, { part: 'ppt/media/audio1.wav', ext: 'wav' });
  assert.equal(deck.slides[1]!.audio, undefined, 'a silent slide says nothing');
  assert.deepEqual(deck.slides[2]!.audio, { part: 'ppt/media/audio3.m4a', ext: 'm4a' });
  // The note is still read alongside it - the two are independent.
  assert.equal(deck.slides[0]!.notes, 'Say it.');
});

test('a deck whose only sound rel is the p14 media one still reads, but a video does not', () => {
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
  const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const decl = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const build = (target: string): PptxParts => ({
    'ppt/presentation.xml':
      `${decl}<p:presentation xmlns:a="${NS_A}" xmlns:r="${REL}" xmlns:p="${NS_P}">` +
      `<p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/></p:presentation>`,
    'ppt/_rels/presentation.xml.rels':
      `${decl}<Relationships xmlns="${NS_PKG}"><Relationship Id="rId2" Type="${REL}/slide" Target="slides/slide1.xml"/></Relationships>`,
    'ppt/slides/slide1.xml':
      `${decl}<p:sld xmlns:a="${NS_A}" xmlns:r="${REL}" xmlns:p="${NS_P}"><p:cSld><p:spTree/></p:cSld></p:sld>`,
    'ppt/slides/_rels/slide1.xml.rels':
      `${decl}<Relationships xmlns="${NS_PKG}"><Relationship Id="rId9" Type="${REL}/media" Target="${target}"/></Relationships>`,
  }) as unknown as PptxParts;

  assert.deepEqual(readPptx(build('../media/media1.mp3'), parseXml).slides[0]!.audio,
    { part: 'ppt/media/media1.mp3', ext: 'mp3' });
  assert.equal(readPptx(build('../media/media1.mp4'), parseXml).slides[0]!.audio, undefined,
    'the media rel is a video rel too, so only a sound extension counts');
});
