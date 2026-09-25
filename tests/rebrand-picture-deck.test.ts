// SPDX-License-Identifier: MPL-2.0
/**
 * Picture decks rebuilt into structure (plan 275 WP10): a deck whose every
 * slide is one picture, read by the page reading of `reconstructFlattenedSlide`
 * through `readDeck`, then censused and planned.
 *
 * The synthetic deck (`tests/fixtures/rebrand-pictures/`, built by
 * `scripts/build-rebrand-picture-fixtures.ts`) draws text over a gradient beside
 * a photograph, three cards with icons, rows with a callout, and a photograph
 * across a slide, with the same mark in the bottom right corner of each. The
 * recogniser here is a stand-in that reads back what the builder drew: for a
 * crop, every drawn line's whole characters inside it, boxed as a detector
 * boxes them. So these tests measure the finding, the grouping and the rules,
 * not a model.
 *
 * The last test reads the private deck the plan measures against, with the real
 * node OCR, when `LOLLY_REBRAND_FIXTURES` names the directory holding
 * `slides-to-test/Lolly_Strategic_Vision.pptx` and its transcript under
 * `labels/`, and the model is on this machine. It skips by name otherwise.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { compileDeck, decodePipelinePicture, planDeck, readDeck } from '../packages/node-shell/src/rebrand/index.ts';
import { plainOfDesignText } from '../engine/src/design-text.ts';
import { contrastRatio } from '../engine/src/brand-derive.ts';
import { detailShare } from '../engine/src/slide-regions.ts';
import type { FlattenedOcrV1 } from '../packages/node-shell/src/rebrand/flattened.ts';
import type { OcrLine } from '../packages/core/src/host-v1.ts';
import type { SlideSourceV1, SourceObjectV1 } from '../packages/core/src/rebrand-v1.ts';
import { STARTER_DESIGN_SYSTEM, parsePipelineXml } from './helpers/rebrand-pipeline.ts';
import { skipReason } from './helpers/rebrand-fixtures.ts';

const FIXTURES = new URL('./fixtures/rebrand-pictures/', import.meta.url);

type Frac = [number, number, number, number];

interface DrawnLine {
  text: string;
  x: number;
  y: number;
  scale: number;
  box: { x: number; y: number; w: number; h: number };
}

interface SlideLabel {
  slide: number;
  structure: string;
  title: string;
  body: string[];
  items: string[];
  callouts: string[];
  pictures: Array<{ what: string; box: Frac }>;
  drawn: DrawnLine[];
}

interface Labels {
  width: number;
  height: number;
  mark: { text: string; box: Frac };
  slides: SlideLabel[];
}

function readLabels(): Labels {
  const raw: unknown = JSON.parse(readFileSync(new URL('pictures.labels.json', FIXTURES), 'utf8'));
  assert.ok(raw && typeof raw === 'object' && 'slides' in raw && Array.isArray(raw.slides), 'pictures.labels.json has slides');
  return raw as Labels;
}

const LABELS = readLabels();
const DECK = new Uint8Array(readFileSync(new URL('pictures.pptx', FIXTURES)));

/** A detector's box is a few px wider than the ink it boxes. */
const DETECTOR_PAD = 3;

/** The stand-in misses a line this small (in glyph scale) on the whole-slide call, as a detector given a busy slide does. */
const PAGE_MISSES_SCALE = 3;
/** A run of characters longer than this many of its boxed heights is read squeezed: every third letter is lost. */
const SQUEEZE_ASPECT = 12;
/** How sure the whole-slide call is of the lines it reads on a slide where it missed some. */
const BUSY_CONFIDENCE = 0.85;

/**
 * The stand-in recogniser for one slide's drawing. The crop's place on the
 * picture is the region's box (the page reading crops with no padding, a
 * colour region is cropped with 4 px of context, as `reconstructFlattenedSlide`
 * does), and a line is read as the run of its characters whose glyph cells lie
 * wholly inside the crop. It fails where a real model does: on the whole-slide
 * call it misses the small lines (the tiles find them), and is unsure of the
 * lines it does read there (`BUSY_CONFIDENCE`), as a detector losing text on a
 * busy slide is, which is what sends the page reading on to its tiles; and a run
 * longer than `SQUEEZE_ASPECT` of its height loses letters (the pieces read it
 * whole), so these tests rest on the tile and piece readings too.
 */
function drawnOcr(slides: SlideLabel[], calls: string[] = []): FlattenedOcrV1 {
  let slide = -1;
  return async (frame, region) => {
    calls.push(region.id);
    if (region.id === 'page') slide++;
    const drawn = slides[slide]?.drawn ?? [];
    const pad = region.id.startsWith('page') ? 0 : 4;
    const ox = Math.max(0, Math.floor(region.box.x - pad));
    const oy = Math.max(0, Math.floor(region.box.y - pad));
    const lines: OcrLine[] = [];
    const missesSome = region.id === 'page' && drawn.some((line) => line.scale <= PAGE_MISSES_SCALE);
    for (const line of drawn) {
      const top = line.y;
      const bottom = line.y + 7 * line.scale;
      if (top < oy || bottom > oy + frame.height) continue;
      if (region.id === 'page' && line.scale <= PAGE_MISSES_SCALE) continue;
      // A crop is one span across, so the characters inside it are one run.
      const inside = Array.from(line.text)
        .map((ch, k) => ({ ch, k, x0: line.x + k * 6 * line.scale }))
        .filter(({ ch, x0 }) => ch !== ' ' && x0 >= ox && x0 + 5 * line.scale <= ox + frame.width)
        .map(({ k }) => k);
      if (!inside.length) continue;
      const first = Math.min(...inside);
      const last = Math.max(...inside);
      const whole = Array.from(line.text).slice(first, last + 1).join('').trim();
      const x0 = line.x + first * 6 * line.scale - DETECTOR_PAD;
      const x1 = line.x + (last * 6 + 5) * line.scale + DETECTOR_PAD;
      const squeezed = x1 - x0 > SQUEEZE_ASPECT * (7 * line.scale + 2 * DETECTOR_PAD);
      let letter = 0;
      const text = squeezed ? Array.from(whole).filter((ch) => ch === ' ' || ++letter % 3 !== 0).join('') : whole;
      if (!text) continue;
      const bx = Math.max(0, x0 - ox);
      const by = Math.max(0, top - DETECTOR_PAD - oy);
      lines.push({
        text,
        confidence: missesSome ? BUSY_CONFIDENCE : 0.97,
        box: { x: bx, y: by, w: Math.min(frame.width, x1 - ox) - bx, h: Math.min(frame.height, bottom + DETECTOR_PAD - oy) - by },
      });
    }
    return lines;
  };
}

const textOf = (o: SourceObjectV1): string => (o.text?.paras ?? []).map((p) => p.runs.map((r) => r.text).join('')).join('\n');

function frac(o: SourceObjectV1, s: SlideSourceV1): Frac {
  return [o.box.x / s.width, o.box.y / s.height, o.box.w / s.width, o.box.h / s.height];
}

function overlap(a: Frac, b: Frac): number {
  const w = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]);
  const h = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]);
  return w > 0 && h > 0 ? w * h : 0;
}

function trigrams(s: string): Set<string> {
  const t = ` ${s.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()} `;
  const out = new Set<string>();
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3));
  return out;
}

function containment(expected: string, found: string): number {
  const want = trigrams(expected);
  const have = trigrams(found);
  let hit = 0;
  for (const g of want) if (have.has(g)) hit++;
  return want.size ? hit / want.size : 0;
}

/** The deck read once with the stand-in recogniser, planned against the starter design system. */
const deckCalls: string[] = [];
const planned = await planDeck({
  bytes: DECK,
  name: 'pictures.pptx',
  parseXml: parsePipelineXml,
  system: STARTER_DESIGN_SYSTEM,
  instanceId: 'picture-deck-test',
  ocr: drawnOcr(LABELS.slides, deckCalls),
  ocrModel: 'drawn-stub',
});

const proposalOf = new Map(planned.plan.slides.flatMap((s) => s.objects.map((o) => [o.id, o.decision ?? o.proposal] as const)));
const classOf = new Map(planned.census.objects.map((o) => [o.id, o.hypothesis.class] as const));

function slideAt(n: number): { slide: SlideSourceV1; label: SlideLabel } {
  const slide = planned.source.slides[n - 1];
  const label = LABELS.slides[n - 1];
  assert.ok(slide && label, `slide ${n}`);
  return { slide, label };
}

/** Groups by their innermost id, with their members. */
function groupsOf(slide: SlideSourceV1): Map<string, SourceObjectV1[]> {
  const out = new Map<string, SourceObjectV1[]>();
  for (const o of slide.objects) {
    for (const id of o.groupPath ?? []) {
      const list = out.get(id);
      if (list) list.push(o);
      else out.set(id, [o]);
    }
  }
  return out;
}

test('the fixture rebuilds byte for byte from its builder', () => {
  const out = mkdtempSync(path.join(tmpdir(), 'rebrand-pictures-'));
  try {
    execFileSync(process.execPath, [new URL('../scripts/build-rebrand-picture-fixtures.ts', import.meta.url).pathname, `--out=${out}`], { stdio: 'pipe' });
    for (const name of ['pictures.pptx', 'pictures.labels.json']) {
      assert.deepEqual(new Uint8Array(readFileSync(path.join(out, name))), new Uint8Array(readFileSync(new URL(name, FIXTURES))), `${name} matches its builder`);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('every slide of the picture deck is rebuilt from a page reading', () => {
  assert.equal(planned.source.slides.length, 4);
  assert.deepEqual(planned.flattened.map((f) => f.outcome), ['rebuilt', 'rebuilt', 'rebuilt', 'rebuilt']);
  for (const slide of planned.source.slides) {
    assert.equal(slide.origin.flattened, true);
    assert.deepEqual(slide.ocr, { state: 'text-found', model: 'drawn-stub' });
    assert.ok(slide.recovery?.assetRef, `${slide.id} keeps the whole-slide picture as its recovery`);
  }
  assert.deepEqual(planned.read, { flattened: 'rebuild', ocr: true, ocrModel: 'drawn-stub' });
});

test('the stand-in needs the tiles and the pieces: small lines come from tiles, long lines are read again in pieces', () => {
  assert.ok(deckCalls.some((id) => id.startsWith('page.tile')), 'tiles were read');
  assert.ok(deckCalls.some((id) => id === 'page.piece'), 'long lines were read again in pieces');
  // Every drawn line comes back whole, though the whole-slide call missed the
  // small ones and squeezed the long ones.
  for (const [i, label] of LABELS.slides.entries()) {
    const slide = planned.source.slides[i];
    assert.ok(slide);
    const all = slide.objects.filter((o) => o.kind === 'text').map(textOf).join('\n').replace(/\s+/g, ' ');
    for (const line of label.drawn) assert.ok(all.includes(line.text.trim()), `slide ${i + 1} reads ${JSON.stringify(line.text)} whole: ${JSON.stringify(all)}`);
  }
});

test('every rebuilt run stands at 3:1 or more against the ground the rebuilt slide draws under it', () => {
  for (const slide of planned.source.slides) {
    for (const o of slide.objects.filter((t) => t.kind === 'text' && proposalOf.get(t.id) !== 'remove')) {
      const cx = o.box.x + o.box.w / 2;
      const cy = o.box.y + o.box.h / 2;
      const under = slide.objects.filter((u) => u.kind === 'shape' && u.fill?.hex && cx >= u.box.x && cx <= u.box.x + u.box.w && cy >= u.box.y && cy <= u.box.y + u.box.h).pop();
      const onPicture = slide.objects.some((u) => u.kind === 'pic' && proposalOf.get(u.id) !== 'remove' && cx >= u.box.x && cx <= u.box.x + u.box.w && cy >= u.box.y && cy <= u.box.y + u.box.h);
      if (onPicture && !under) continue;
      const ground = under?.fill?.hex ?? slide.background.color?.hex;
      assert.ok(ground, `${o.id} has a ground`);
      for (const run of (o.text?.paras ?? []).flatMap((p) => p.runs)) {
        const ratio = contrastRatio(run.color?.hex ?? '#000000', ground);
        assert.ok(ratio >= 3, `${o.id} ${JSON.stringify(run.text)} ${run.color?.hex} on ${ground}: ${ratio.toFixed(2)}`);
      }
    }
  }
});

test('every title comes back as the title estimate, and the body as body', () => {
  for (const n of [1, 2, 3, 4]) {
    const { slide, label } = slideAt(n);
    const texts = slide.objects.filter((o) => o.kind === 'text');
    const title = texts.filter((o) => o.roleEstimate === 'title').map(textOf).join(' ');
    assert.ok(containment(label.title, title) > 0.9, `slide ${n}: ${JSON.stringify(title)} against ${label.title}`);
    const body = texts.filter((o) => o.roleEstimate !== 'title').map(textOf).join(' ');
    for (const para of label.body) assert.ok(containment(para, body) > 0.9, `slide ${n}: body ${JSON.stringify(body)} holds ${para}`);
  }
});

/** A picture crop at least this many times the mark's area runs under the mark with the mark painted out. */
const UNDER_MARK_AREA = 20;

test('the corner mark is found on every slide and proposed for removal as decoration', async () => {
  const mark = LABELS.mark.box;
  const area = mark[2] * mark[3];
  for (const n of [1, 2, 3, 4]) {
    const { slide } = slideAt(n);
    const over = slide.objects.filter((o) => {
      const f = frac(o, slide);
      return overlap(f, mark) >= 0.5 * Math.min(area, f[2] * f[3]);
    });
    assert.ok(over.some((o) => o.kind === 'text' && textOf(o) === LABELS.mark.text), `slide ${n} reads the mark as text`);
    for (const o of over) {
      const f = frac(o, slide);
      if (o.kind === 'pic' && f[2] * f[3] >= UNDER_MARK_AREA * area) {
        // A photograph running to the corner keeps its pixels there, with the
        // mark painted out of them: its crop is plain where the original drew letters.
        const crop = o.media ? planned.media.get(o.media) : undefined;
        const original = slide.recovery ? planned.media.get(slide.recovery.assetRef) : undefined;
        assert.ok(crop && original, `slide ${n}: ${o.id} and the slide picture are held`);
        const cropped = await decodePipelinePicture(crop.bytes, crop.mime);
        const whole = await decodePipelinePicture(original.bytes, original.mime);
        assert.ok(cropped && whole);
        const inWhole = { x: mark[0] * whole.width, y: mark[1] * whole.height, w: mark[2] * whole.width, h: mark[3] * whole.height };
        const sx = cropped.width / (f[2] * whole.width);
        const sy = cropped.height / (f[3] * whole.height);
        const inCrop = { x: (inWhole.x - f[0] * whole.width) * sx, y: (inWhole.y - f[1] * whole.height) * sy, w: inWhole.w * sx, h: inWhole.h * sy };
        assert.ok(detailShare(cropped, inCrop) < 0.5 * detailShare(whole, inWhole), `slide ${n}: ${o.id} paints the mark out`);
        continue;
      }
      assert.equal(classOf.get(o.id), 'decoration', `slide ${n}: ${o.id} (${o.kind}) is decoration`);
      assert.equal(proposalOf.get(o.id), 'remove', `slide ${n}: ${o.id} is proposed for removal`);
    }
  }
});

test('three icons over labels on slide 2 read as three cards, each icon cropped tight', () => {
  const { slide, label } = slideAt(2);
  const cards = [...groupsOf(slide).entries()].filter(([id]) => /\.card\d+$/.test(id)).sort(([a], [b]) => a.localeCompare(b));
  assert.equal(cards.length, 3);
  cards.forEach(([, members], k) => {
    const icons = members.filter((m) => m.kind === 'pic');
    const texts = members.filter((m) => m.kind === 'text');
    assert.equal(icons.length, 1, `card ${k + 1} has one icon`);
    assert.ok(containment(label.items[k] ?? '', texts.map(textOf).join(' ')) > 0.9, `card ${k + 1} holds ${label.items[k]}`);
    const icon = icons[0];
    const truth = label.pictures[k]?.box;
    assert.ok(icon && truth);
    const f = frac(icon, slide);
    assert.ok(overlap(f, truth) >= 0.9 * truth[2] * truth[3], `card ${k + 1}'s icon crop covers the ring`);
    assert.ok(f[2] * f[3] <= 1.5 * truth[2] * truth[3], `card ${k + 1}'s icon crop is tight`);
  });
  // Each card is also held by its panel, a white rectangle, outermost first.
  for (const [, members] of cards) {
    const panel = members[0]?.groupPath?.[0];
    assert.ok(panel && !/\.card\d+$/.test(panel), 'a panel holds the card');
    const shape = slide.objects.find((o) => o.id === panel);
    assert.equal(shape?.kind, 'shape');
    assert.equal(shape?.fill?.hex, '#ffffff');
  }
});

test('slide 3 reads as three rows of an icon and its text, beside a callout drawn as an outlined box', () => {
  const { slide, label } = slideAt(3);
  const groups = groupsOf(slide);
  const rows = [...groups.entries()].filter(([id]) => /\.row\d+$/.test(id)).sort(([a], [b]) => a.localeCompare(b));
  assert.equal(rows.length, 3);
  rows.forEach(([, members], k) => {
    assert.deepEqual(members.map((m) => m.kind).sort(), ['pic', 'text']);
    assert.ok(containment(label.items[k] ?? '', textOf(members.find((m) => m.kind === 'text') as SourceObjectV1)) > 0.9, `row ${k + 1}`);
  });
  const callouts = [...groups.entries()].filter(([id, members]) => members.some((m) => m.id === id && m.kind === 'shape') && members.every((m) => m.kind !== 'pic'));
  assert.equal(callouts.length, 1);
  const [calloutId, members] = callouts[0] ?? ['', []];
  const box = slide.objects.find((o) => o.id === calloutId);
  assert.equal(box?.line?.color?.hex !== undefined, true, 'the callout is a rectangle with its outline');
  assert.notEqual(proposalOf.get(calloutId), 'remove', 'the plan keeps the box that makes the callout one unit');
  assert.ok(containment(label.callouts[0] ?? '', members.filter((m) => m.kind === 'text').map(textOf).join(' ')) > 0.9);
  // The rules between the rows stay rules; none of the outline's own rules is left over.
  const rules = slide.objects.filter((o) => o.kind === 'shape' && o.box.h < 6);
  assert.ok(rules.length >= 3, `the row rules are kept, ${rules.length}`);
});

test('CP13: slide 3\'s rows beside a callout match Text with callout, not one column of body text', () => {
  const plan = planned.plan.slides[2];
  assert.equal(plan?.layoutMatch?.structure, 'text-and-callout', JSON.stringify(plan?.layoutReasons));
});

test('CP13: a rebuilt text keeps one ink per colour it was drawn in, and a colour apart as its own run', () => {
  const apart = (a: string, b: string): number => [1, 3, 5].reduce((n, i) => n + Math.abs(Number.parseInt(a.slice(i, i + 2), 16) - Number.parseInt(b.slice(i, i + 2), 16)), 0);
  for (const slide of planned.source.slides) {
    for (const object of slide.objects) {
      const inks = [...new Set((object.text?.paras ?? []).flatMap((p) => p.runs.map((r) => r.color?.hex)).filter((hex): hex is string => typeof hex === 'string'))];
      for (const [i, a] of inks.entries()) {
        for (const b of inks.slice(i + 1)) assert.ok(apart(a, b) > 48, `${object.id}: ${a} and ${b} are one ink read twice`);
      }
    }
  }
});

test('photographs are cropped tight, and a photograph under text keeps its largest text-free part', () => {
  const { slide: one, label: first } = slideAt(1);
  const photo = first.pictures[0]?.box;
  assert.ok(photo);
  const crops = one.objects.filter((o) => o.kind === 'pic' && proposalOf.get(o.id) !== 'remove');
  assert.equal(crops.length, 1);
  const f = frac(crops[0] as SourceObjectV1, one);
  assert.ok(overlap(f, photo) >= 0.9 * photo[2] * photo[3] && f[2] * f[3] <= 1.2 * photo[2] * photo[3], 'the photograph is cropped to itself');

  // Across the whole slide the photograph's ground is its own border, so the
  // finder can leave a patch of it apart; the text here sits on that patch,
  // not on the picture region, so every crop leaves the text alone. (Text set
  // on the picture region itself keeps the picture whole under it, painted
  // out: tests/rebrand-flattened.test.ts.)
  const { slide: four } = slideAt(4);
  const pics = four.objects.filter((o) => o.kind === 'pic' && proposalOf.get(o.id) !== 'remove').sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h);
  assert.ok(pics.length >= 1);
  const kept = pics[0] as SourceObjectV1;
  // The mark, proposed for removal, is the one text a crop may run under (painted out, see above).
  const texts = four.objects.filter((o) => o.kind === 'text' && proposalOf.get(o.id) !== 'remove');
  for (const pic of pics) {
    for (const t of texts) assert.equal(overlap(frac(pic, four), frac(t, four)), 0, `${pic.id} leaves ${JSON.stringify(textOf(t))} to its text object`);
  }
  assert.ok(kept.box.w * kept.box.h >= 0.3 * four.width * four.height, 'most of the photograph is kept');
  assert.equal(kept.ocr?.state, 'no-text-found', 'the page reading read the photograph and found no text of its own in the crop');
});

test('a recogniser that refuses the whole page falls back to reading region by region', async () => {
  const calls: string[] = [];
  const inner = drawnOcr(LABELS.slides.slice(0, 1), calls);
  let page = 0;
  const refusing: FlattenedOcrV1 = async (frame, region) => {
    if (region.id === 'page') {
      page++;
      throw new Error('whole-page reading refused');
    }
    return inner(frame, { ...region, id: region.id });
  };
  const read = await readDeck({ bytes: DECK, name: 'pictures.pptx', parseXml: parsePipelineXml, instanceId: 'fallback', ocr: refusing, ocrModel: 'drawn-stub' });
  assert.equal(page, 4, 'each slide tried the page reading once');
  assert.ok(calls.every((id) => !id.startsWith('page')), 'no tile or piece was read after the refusal');
  assert.deepEqual(read.flattened.map((f) => f.outcome), ['rebuilt', 'rebuilt', 'rebuilt', 'rebuilt']);
  assert.ok(read.source.slides.every((s) => s.objects.every((o) => !o.groupPath)), 'the region reading groups nothing');
});

// ─── the private deck ────────────────────────────────────────────────────────

const PRIVATE_ROOT = process.env.LOLLY_REBRAND_FIXTURES;
const PRIVATE_DECK = PRIVATE_ROOT ? path.join(PRIVATE_ROOT, 'slides-to-test', 'Lolly_Strategic_Vision.pptx') : '';
const PRIVATE_TRANSCRIPT = PRIVATE_ROOT ? path.join(PRIVATE_ROOT, 'labels', 'Lolly_Strategic_Vision.transcript.json') : '';

async function privateRunner(): Promise<{ ocr: FlattenedOcrV1; model: string } | string> {
  const corpus = skipReason();
  if (corpus || !PRIVATE_ROOT) return corpus ?? 'the private rebrand deck fixture corpus is not on this machine (set LOLLY_REBRAND_FIXTURES)';
  if (!existsSync(PRIVATE_DECK) || !existsSync(PRIVATE_TRANSCRIPT)) return `${PRIVATE_DECK} or its transcript is not there`;
  const { nodeFlattenedOcr } = await import('../packages/node-shell/src/rebrand/ocr-node.ts');
  const runner = await nodeFlattenedOcr();
  return runner.ok ? { ocr: runner.ocr, model: runner.model } : runner.message;
}

const privateOcr = await privateRunner();

test(
  'the private picture deck: titles, body, marks, crops and the two structures (LOLLY_REBRAND_FIXTURES)',
  { skip: typeof privateOcr === 'string' ? privateOcr : false, timeout: 600_000 },
  async () => {
    if (typeof privateOcr === 'string') return;
    interface Transcript {
      commonMarks?: Record<string, { box: Frac }>;
      slides: Array<{ title: string; body: string[]; pictures: Array<{ box: Frac }> }>;
    }
    const transcript = JSON.parse(readFileSync(PRIVATE_TRANSCRIPT, 'utf8')) as Transcript;
    const run = await planDeck({
      bytes: new Uint8Array(readFileSync(PRIVATE_DECK)),
      name: path.basename(PRIVATE_DECK),
      parseXml: parsePipelineXml,
      system: STARTER_DESIGN_SYSTEM,
      instanceId: 'private-picture-deck',
      ocr: privateOcr.ocr,
      ocrModel: privateOcr.model,
    });
    const proposal = new Map(run.plan.slides.flatMap((s) => s.objects.map((o) => [o.id, o.decision ?? o.proposal] as const)));
    const censusClass = new Map(run.census.objects.map((o) => [o.id, o.hypothesis.class] as const));
    const words = (s: string): string[] => s.toLowerCase().replace(/[\u2018\u2019']/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean);
    let truthWords = 0;
    let hitWords = 0;
    const named = Object.values(transcript.commonMarks ?? {})[0]?.box;
    assert.ok(named, 'the transcript names the common mark');
    const markBox: Frac = named;
    for (const [i, slide] of run.source.slides.entries()) {
      const truth = transcript.slides[i];
      assert.ok(truth);
      const texts = slide.objects.filter((o) => o.kind === 'text');
      // The title the plan pours: the text the census classed as title.
      const title = texts.filter((o) => censusClass.get(o.id) === 'title').map(textOf).join(' ');
      assert.ok(containment(truth.title, title) > 0.9, `slide ${i + 1} title ${JSON.stringify(title)}`);
      const pool = new Map<string, number>();
      for (const w of words(texts.filter((o) => censusClass.get(o.id) !== 'title' && proposal.get(o.id) !== 'remove').map(textOf).join(' '))) pool.set(w, (pool.get(w) ?? 0) + 1);
      for (const w of truth.body.flatMap(words)) {
        truthWords++;
        const n = pool.get(w) ?? 0;
        if (n > 0) {
          hitWords++;
          pool.set(w, n - 1);
        }
      }
      const area = markBox[2] * markBox[3];
      // A photograph running under the mark has it painted out (checked on the synthetic deck).
      const over = slide.objects.filter((o) => {
        const f = frac(o, slide);
        if (o.kind === 'pic' && f[2] * f[3] >= UNDER_MARK_AREA * area) return false;
        return overlap(f, markBox) >= 0.5 * Math.min(area, f[2] * f[3]);
      });
      assert.ok(over.length > 0 && over.every((o) => proposal.get(o.id) === 'remove'), `slide ${i + 1}: the mark is proposed for removal`);
      if (truth.pictures.length) {
        const crops = slide.objects.filter((o) => o.kind === 'pic' && proposal.get(o.id) !== 'remove');
        assert.ok(crops.length > 0, `slide ${i + 1} has a picture crop`);
      }
    }
    assert.ok(hitWords / truthWords > 0.9, `body word recall ${hitWords}/${truthWords}`);
    const nine = run.source.slides[8];
    assert.ok(nine);
    assert.equal([...groupsOf(nine).keys()].filter((id) => /\.card\d+$/.test(id)).length, 3, 'slide 9 reads as three cards');
    const four = run.source.slides[3];
    assert.ok(four);
    const fourGroups = groupsOf(four);
    assert.equal([...fourGroups.keys()].filter((id) => /\.row\d+$/.test(id)).length, 3, 'slide 4 reads as three rows');
    assert.ok([...fourGroups.entries()].some(([id, members]) => members.some((m) => m.id === id && m.kind === 'shape') && members.every((m) => m.kind !== 'pic')), 'slide 4 has a callout');

    // Close-out CP13: the three slides the close-out names, poured.
    assert.equal(run.plan.slides[3]?.layoutMatch?.structure, 'text-and-callout', 'slide 4 matches Text with callout');
    const { compiled } = await compileDeck({ source: run.source, census: run.census, plan: run.plan, system: STARTER_DESIGN_SYSTEM, applyUnreviewed: true, applyNeedsAttention: true });
    const frameOf = (n: number) => compiled.frames.find((f) => f.sourceSlideId === run.source.slides[n - 1]?.id && !f.continuation);
    const first = frameOf(1);
    assert.ok(first);
    const titleIndex = first.layers.findIndex((row) => row.role === 'title');
    const titleRow = first.layers[titleIndex];
    assert.ok(titleRow);
    assert.equal((plainOfDesignText(String(titleRow.text)).match(/\?/g) ?? []).length, 2, 'slide 1 keeps both question marks');
    const under = first.layers.slice(0, titleIndex).filter((row) => (row.kind === 'frame' || row.kind === 'box') && typeof row.bg === 'string'
      && Number(row.x) <= Number(titleRow.x) && Number(row.x) + Number(row.w) >= Number(titleRow.x) + Number(titleRow.w)
      && Number(row.y) <= Number(titleRow.y) && Number(row.y) + Number(row.h) >= Number(titleRow.y) + Number(titleRow.h));
    const ground = String(under[under.length - 1]?.bg);
    for (const m of String(titleRow.text).matchAll(/\{#([0-9a-fA-F]{6})\|/g)) {
      assert.ok(contrastRatio(`#${m[1]}`, ground) >= 3, `slide 1: the emphasis #${m[1]} reads on ${ground}`);
    }
    const nineFrame = frameOf(9);
    assert.ok(nineFrame);
    const labels = nineFrame.layers.filter((row) => row.role === 'label').map((row) => plainOfDesignText(String(row.text ?? '')).trim());
    assert.equal(labels.filter(Boolean).length, 3, `slide 9 keeps its three card titles: ${JSON.stringify(labels)}`);
    assert.equal(compiled.report.entries.filter((e) => e.code === 'text.overflow' && (e.slideId === run.source.slides[0]?.id || e.slideId === run.source.slides[8]?.id)).length, 0, 'nothing on slides 1 and 9 is cut');
  },
);
