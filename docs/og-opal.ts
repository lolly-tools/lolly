// SPDX-License-Identifier: MPL-2.0
// Opal's own share cards: the house, tool and stage designs from Lolly's brand page,
// for a brand pack whose tokens select them. docs/og-image.ts reads the selection
// (`$extensions['com.suse.lolly'].shareCards` set to "opal" in the brand tokens) and
// hands each card here; a pack without that declaration keeps the brand layouts in
// og-image.ts.
//
//   • house: the default card, the app's own views and the docs pages. The lolly
//     upright in a pale green soft box, the title in Spearmint, one line of text and
//     the address.
//   • tool: one card per tool, on Spearmint. The tool's sticker upright, a
//     "Tool · Name" kicker, a one-line pitch cut from the tool's own description and
//     the tool's link.
//   • stage: the why pages, Lolly's gravitas register. A deep green house with one
//     green spotlight, a thin timeline, a kicker, the title and a short line.
//
// Every ground is green: the Avocado wash, Spearmint and the deep greens of the stage,
// never Liquorice, Reef or the yellow and cream grounds. The lollipop is the mark
// loadBrandChrome() reads from icon.svg and a sticker carries the tool's own catalog
// icon, so no new art is drawn here. Nothing stands under a subject either: no dish,
// contact shadow, stick or tilt. Outfit sets the headings, SUSE the text and SUSE Mono
// the small labels, from the faces the shell serves in shells/web/public/fonts/. Each
// run of text is measured with HarfBuzz against those same files before the browser
// paints the card, so copy is wrapped and sized to its column, and a description that
// is too long is shortened, never reworded.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Font as HbFont } from 'harfbuzzjs';

/** The share-card designs a brand's tokens can select. */
export type ShareCardDesign = 'opal';

/** Bump after any change to the drawing below: it joins the card hashes of a pack that
 *  selects these designs (chromeFingerprint), so that pack's cards re-render while every
 *  other pack's cards keep their hashes. */
export const OPAL_CARDS_VERSION = 1;

export type OpalKind = 'house' | 'tool' | 'stage';

/** A house card: the title, one line of text and the address. */
export interface OpalHouseCard { title: string; line: string; url: string; }
/** A tool card: the pitch comes from `description`, the sticker from `iconSvg`. */
export interface OpalToolCard { name: string; description: string; url: string; iconSvg?: string; }
/** A stage card: the kicker, the title and a short line cut from `line`. */
export interface OpalStageCard { kicker: string; title: string; line: string; }

type SvgToPng = (svg: string, opts: { width: number; height: number; background?: string }) => Promise<Buffer>;

const W = 1200, H = 630;

const xmlEsc = (s: unknown): string => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Rounded to a tenth of a pixel, so the drawing carries no float noise. */
const r = (n: number): number => Math.round(n * 10) / 10;

// ── Colour ──────────────────────────────────────────────────────────────────

/** Opal's named colours on these cards (the palette table is in brands/lolly-demo/README.md). */
export const OPAL = Object.freeze({
  spearmint: '#033633',
  bunyapine: '#008657',
  greenApple: '#50c369',
  pandanus: '#ace1ad',
  avocado: '#edf6e0',
  sugar: '#ffffff',
});

/** The brand page's inks for these cards, each one green or a near-white tinted green,
 *  apart from the house line's slate, which is the page's own body text colour. */
const INK = Object.freeze({
  houseLine: '#1d2a31',
  stageTitle: '#f1f7f3',
  stageLine: '#c9e6d2',
  stageDot: '#061a14',
});

/** An elliptical radial gradient over the whole card, read the way CSS reads
 *  `radial-gradient(rx ry at cx cy, stops)`: offsets run from the centre to the ellipse. */
export interface Ground {
  cx: number; cy: number; rx: number; ry: number;
  stops: ReadonlyArray<readonly [offset: number, colour: string]>;
}

/** Each design's ground, in card pixels, from the brand page's CSS. */
export const GROUNDS: Readonly<Record<OpalKind, Ground>> = Object.freeze({
  // radial-gradient(130% 95% at 30% 6%, #ffffff, #edf6e0 48%, #c4e6b9): the soft box,
  // white light from the top left falling through Avocado to a pale green floor.
  house: { cx: 360, cy: 37.8, rx: 1560, ry: 598.5, stops: [[0, OPAL.sugar], [0.48, OPAL.avocado], [1, '#c4e6b9']] },
  // radial-gradient(110% 100% at 25% 0%, #0d5a52, #034441 45%, #003330): home ground
  // built from Spearmint's hue.
  tool: { cx: 300, cy: 0, rx: 1320, ry: 630, stops: [[0, '#0d5a52'], [0.45, '#034441'], [1, '#003330']] },
  // radial-gradient(60% 95% at 74% -8%, ...): one spotlight, Pandanus in the middle of
  // the beam, falling off into a deep green house. The brand page draws the middle as a
  // translucent Green Apple over its pale floor; Pandanus is the Opal colour that mix
  // comes to.
  stage: { cx: 888, cy: -50.4, rx: 720, ry: 598.5, stops: [[0, OPAL.pandanus], [0.4, '#0c3a2c'], [0.72, '#061a14'], [1, '#04110d']] },
});

const hexRgb = (h: string): [number, number, number] =>
  [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];

/** The ground's colour at a point of the card, interpolated in sRGB like the browser
 *  interpolates opaque gradient stops. */
export function groundAt(ground: Ground, x: number, y: number): string {
  const t = Math.min(1, Math.hypot((x - ground.cx) / ground.rx, (y - ground.cy) / ground.ry));
  const { stops } = ground;
  let i = 1;
  while (i < stops.length - 1 && stops[i]![0] < t) i++;
  const [o0, c0] = stops[i - 1]!, [o1, c1] = stops[i]!;
  const k = o1 > o0 ? Math.max(0, Math.min(1, (t - o0) / (o1 - o0))) : 1;
  const a = hexRgb(c0), b = hexRgb(c1);
  return `#${a.map((v, j) => Math.round(v + (b[j]! - v) * k).toString(16).padStart(2, '0')).join('')}`;
}

// ── Type ────────────────────────────────────────────────────────────────────

type Family = 'Outfit' | 'SUSE' | 'SUSE Mono';

/** A face as the card sets it: family, weight and letter-spacing in em. */
export interface Face { family: Family; weight: number; tracking: number; }

const FONTS_DIR = fileURLToPath(new URL('../shells/web/public/fonts/', import.meta.url));
const FONT_FILES: Readonly<Record<Family, string>> = {
  Outfit: 'Outfit[wght].ttf',
  SUSE: 'SUSE[wght].ttf',
  'SUSE Mono': 'SUSEMono[wght].ttf',
};

/** Text measured in the faces the card is painted in. */
export interface Measure {
  /** Advance width of `text` in `face` at `size` px, letter-spacing included. */
  width(text: string, face: Face, size: number): number;
  /** Ascender and descender of `face` in em, the descender as a positive number. */
  extents(face: Face): { ascent: number; descent: number };
}

let typeLoad: Promise<Measure> | null = null;

/**
 * HarfBuzz over the shell's own font files, with each face set to its weight on the
 * wght axis, as Chromium sets it from font-weight. Chromium drops optional ligatures
 * from letter-spaced text, so a tracked face is shaped without them as well. Loaded
 * once per process.
 */
export function loadOpalType(): Promise<Measure> {
  typeLoad ??= (async (): Promise<Measure> => {
    const hb = await import('harfbuzzjs');
    // The blobs and faces stay referenced for the life of the process: harfbuzzjs frees
    // what the garbage collector reclaims, and every font below points into them.
    const held: unknown[] = [];
    const fonts = new Map<string, { font: HbFont; upem: number; ascent: number; descent: number }>();
    const fontFor = (face: Face) => {
      const key = `${face.family}@${face.weight}`;
      let entry = fonts.get(key);
      if (!entry) {
        const blob = new hb.Blob(readFileSync(FONTS_DIR + FONT_FILES[face.family]));
        const hbFace = new hb.Face(blob, 0);
        const font = new hb.Font(hbFace);
        font.setVariations([new hb.Variation('wght', face.weight)]);
        const ext = font.hExtents();
        held.push(blob, hbFace);
        entry = { font, upem: hbFace.upem, ascent: ext.ascender / hbFace.upem, descent: -ext.descender / hbFace.upem };
        fonts.set(key, entry);
      }
      return entry;
    };
    const noLigatures = [new hb.Feature('liga', 0), new hb.Feature('clig', 0)];
    // Advance in em at size 1: widths scale with the size, so each run is shaped once.
    const ems = new Map<string, number>();
    return {
      width(text, face, size) {
        const key = `${face.family}@${face.weight}@${face.tracking}|${text}`;
        let em = ems.get(key);
        if (em === undefined) {
          const { font, upem } = fontFor(face);
          const buffer = new hb.Buffer();
          buffer.addText(text);
          buffer.guessSegmentProperties();
          hb.shape(font, buffer, face.tracking ? noLigatures : []);
          let units = 0;
          for (const glyph of buffer.getGlyphInfosAndPositions()) units += glyph.xAdvance ?? 0;
          em = units / upem + face.tracking * Math.max(0, [...text].length - 1);
          ems.set(key, em);
        }
        return em * size;
      },
      extents(face) {
        const { ascent, descent } = fontFor(face);
        return { ascent, descent };
      },
    };
  })();
  return typeLoad;
}

// ── Copy ────────────────────────────────────────────────────────────────────

const ABBREVIATION = /\b(?:e\.g|i\.e|etc|vs|cf)\.$/i;

/** The first sentence of `text`, its closing punctuation kept. */
function firstSentence(text: string): string {
  const re = /[.!?](?=\s+["“‘(]?[A-Z0-9])/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const head = text.slice(0, m.index + 1);
    if (!ABBREVIATION.test(head)) return head;
  }
  return text;
}

/** A closing full stop, colon or semicolon off the end; an ellipsis, question or exclamation stays. */
const dropStop = (s: string): string => s.replace(/(?<!\.)[.:;]$/, '').trim();

const wordCount = (s: string): number => s.split(' ').filter(Boolean).length;

/**
 * The lead of a sentence that opens with its point and then lists or explains: the
 * words before the first colon or spaced dash. A dash that opens an aside ("- or a
 * Lolly tool link -") is not a lead's end, and a lead of one or two words is too thin
 * to stand alone.
 */
function leadClause(sentence: string): string | null {
  const m = /: | [-–] /.exec(sentence);
  if (!m) return null;
  if (m[0] !== ': ' && /^(?:or|and|plus|but)\b/i.test(sentence.slice(m.index + m[0].length))) return null;
  const lead = sentence.slice(0, m.index).trim();
  return wordCount(lead) >= 3 ? lead : null;
}

/**
 * Ways to give a description in one line, longest first. Each one is cut from the text
 * itself: the whole text as written (when `whole`), its first sentence and the lead
 * before a colon or a spaced dash, the last two without a closing full stop, as the
 * brand page sets a pitch. A sentence is never cut at a comma, because a comma in these
 * descriptions as often joins two adjectives or the items of a list as it ends a
 * clause. Nothing is reworded, so a card never claims more than its description.
 */
export function oneLiners(text: string, whole = false): string[] {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const sentence = dropStop(firstSentence(clean));
  const all = [whole ? clean : '', sentence, leadClause(sentence) ?? ''];
  return [...new Set(all.filter(Boolean))].sort((a, b) => b.length - a.length);
}

// ── Layout ──────────────────────────────────────────────────────────────────

/** How one run of copy is set: its face, its largest size, the smallest size a longer
 *  candidate may shrink to before a shorter one is preferred, the smallest size at all,
 *  its line height (a multiple of the size), its most lines, the most lines once it has
 *  shrunk past the comfortable size, and its colour. */
interface Spec {
  face: Face;
  size: number;
  comfortable: number;
  min: number;
  lineHeight: number;
  maxLines: number;
  fallbackLines?: number;
  fill: string;
  upper?: boolean;
}

const FACE = {
  houseTitle: { family: 'Outfit', weight: 600, tracking: -0.025 },
  toolTitle: { family: 'Outfit', weight: 500, tracking: -0.01 },
  stageTitle: { family: 'Outfit', weight: 200, tracking: -0.025 },
  text: { family: 'SUSE', weight: 400, tracking: 0 },
  address: { family: 'SUSE Mono', weight: 500, tracking: 0.05 },
  kicker: { family: 'SUSE Mono', weight: 500, tracking: 0.09 },
} as const satisfies Record<string, Face>;

// Sizes are the brand page's, where one container unit is 12 px on a 1200 px card.
const SPEC = {
  house: {
    title: { face: FACE.houseTitle, size: 120, comfortable: 64, min: 48, lineHeight: 0.95, maxLines: 2, fallbackLines: 3, fill: OPAL.spearmint },
    line: { face: FACE.text, size: 43.2, comfortable: 34, min: 28, lineHeight: 1.25, maxLines: 3, fallbackLines: 4, fill: INK.houseLine },
    url: { face: FACE.address, size: 25.2, comfortable: 18, min: 18, lineHeight: 1, maxLines: 1, fill: OPAL.bunyapine },
  },
  tool: {
    kicker: { face: FACE.kicker, size: 24, comfortable: 18, min: 18, lineHeight: 1, maxLines: 1, fill: OPAL.greenApple, upper: true },
    title: { face: FACE.toolTitle, size: 67.2, comfortable: 52, min: 40, lineHeight: 1.08, maxLines: 3, fallbackLines: 4, fill: OPAL.sugar },
    url: { face: FACE.address, size: 25.2, comfortable: 18, min: 18, lineHeight: 1, maxLines: 1, fill: OPAL.pandanus },
  },
  stage: {
    kicker: { face: FACE.kicker, size: 24, comfortable: 18, min: 18, lineHeight: 1, maxLines: 1, fill: OPAL.greenApple, upper: true },
    title: { face: FACE.stageTitle, size: 96, comfortable: 84, min: 60, lineHeight: 1, maxLines: 2, fill: INK.stageTitle },
    line: { face: FACE.text, size: 38.4, comfortable: 32, min: 28, lineHeight: 1.55, maxLines: 2, fill: INK.stageLine },
  },
} as const satisfies Record<OpalKind, Record<string, Spec>>;

/** One run of copy, set: the chosen words, their lines, size and place on the card. */
export interface TextBlock {
  role: 'title' | 'line' | 'url' | 'kicker';
  /** The words the card shows, before any upper-casing. */
  text: string;
  lines: string[];
  face: Face;
  size: number;
  fill: string;
  x: number;
  width: number;
  /** Top of the first line box and the height of the whole block, in card pixels. */
  top: number;
  height: number;
  /** One baseline per line. */
  baselines: number[];
}

export interface OpalLayout { kind: OpalKind; ground: Ground; blocks: TextBlock[]; }

/** The words of a run, with a spaced dash kept on the word before it so that no line
 *  opens with a dash. */
function wordsOf(text: string): string[] {
  const out: string[] = [];
  for (const w of text.split(' ')) {
    if (!w) continue;
    if (/^[-–]$/.test(w) && out.length) out[out.length - 1] += ` ${w}`;
    else out.push(w);
  }
  return out;
}

/** Greedy word wrap by measured width; null when a single word overruns the column. */
function wrap(text: string, face: Face, size: number, width: number, m: Measure): string[] | null {
  const lines: string[] = [];
  let cur = '';
  for (const word of wordsOf(text)) {
    const trial = cur ? `${cur} ${word}` : word;
    if (m.width(trial, face, size) <= width) { cur = trial; continue; }
    if (!cur || m.width(word, face, size) > width) return null;
    lines.push(cur);
    cur = word;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** The same number of lines in the narrowest column that still holds them, so the lines
 *  come out even instead of one long line over a short one. */
function balance(text: string, face: Face, size: number, width: number, count: number, m: Measure): string[] {
  let lo = 0, hi = width, best = wrap(text, face, size, width, m) ?? [text];
  if (count < 2) return best;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const lines = wrap(text, face, size, mid, m);
    if (lines && lines.length === count) { best = lines; hi = mid; } else lo = mid;
  }
  return best;
}

interface Fit { text: string; lines: string[]; size: number; }

/** The largest size, from the spec's size down to `floor` in half pixels, that holds
 *  `text` in at most `maxLines` lines and `maxHeight` pixels; null when none does. */
function fitAt(
  text: string, spec: Spec, width: number, floor: number, m: Measure,
  maxLines = spec.maxLines, maxHeight = Number.POSITIVE_INFINITY,
): Fit | null {
  const shown = spec.upper ? text.toUpperCase() : text;
  for (let size = spec.size; size >= floor - 1e-9; size = Math.round((size - 0.5) * 10) / 10) {
    const lines = wrap(shown, spec.face, size, width, m);
    if (lines && lines.length <= maxLines && lines.length * size * spec.lineHeight <= maxHeight) {
      return { text, lines: balance(shown, spec.face, size, width, lines.length, m), size };
    }
  }
  return null;
}

/** `text` at the smallest size, cut short to the spec's lines and closed with an
 *  ellipsis: the last resort when no candidate fits. The cut goes back to the last
 *  comma, semicolon or spaced dash when that keeps most of the words, so the card stops
 *  at the end of a phrase rather than in the middle of one. */
function clampAt(text: string, spec: Spec, width: number, m: Measure, maxLines = spec.maxLines): Fit {
  const shown = spec.upper ? text.toUpperCase() : text;
  const size = spec.min;
  const words = wordsOf(shown);
  const holds = (s: string) => (wrap(s, spec.face, size, width, m)?.length ?? Infinity) <= maxLines;
  let n = words.length;
  while (n > 1 && !holds(`${words.slice(0, n).join(' ')}…`)) n--;
  let kept = words.slice(0, n).join(' ').replace(/[\s,.;:–-]+$/, '');
  const pause = Math.max(kept.lastIndexOf(', '), kept.lastIndexOf('; '), kept.lastIndexOf(' - '));
  if (pause > kept.length * 0.6) kept = kept.slice(0, pause);
  const out = `${kept}…`;
  const lines = wrap(out, spec.face, size, width, m) ?? [out];
  return { text, lines: balance(out, spec.face, size, width, lines.length, m), size };
}

/** The longest candidate that fits at a comfortable size; failing that, the shortest one
 *  at whatever size holds it, in the spec's fallback lines but never taller than the
 *  spec's full block at its largest size; failing that, the shortest one cut with an
 *  ellipsis. A `maxLines` from the caller holds in every step. */
function choose(candidates: readonly string[], spec: Spec, width: number, m: Measure, maxLines?: number): Fit {
  const list = candidates.length ? candidates : [''];
  for (const c of list) {
    const fit = fitAt(c, spec, width, spec.comfortable, m, maxLines ?? spec.maxLines);
    if (fit) return fit;
  }
  const shortest = list[list.length - 1]!;
  const lines = maxLines ?? spec.fallbackLines ?? spec.maxLines;
  const tallest = spec.maxLines * spec.size * spec.lineHeight;
  return fitAt(shortest, spec, width, spec.min, m, lines, tallest) ?? clampAt(shortest, spec, width, m, lines);
}

/** Set fitted blocks one under another `gap` apart, each line box `lineHeight` × size
 *  tall with the glyphs centred in it as CSS centres them, and return the blocks with
 *  their tops and baselines. `anchor` is the block's vertical centre, or its bottom. */
function stack(
  items: Array<{ role: TextBlock['role']; fit: Fit; spec: Spec }>,
  x: number, width: number, gap: number, anchor: { centre: number } | { bottom: number }, m: Measure,
): TextBlock[] {
  const heights = items.map(({ fit, spec }) => fit.lines.length * fit.size * spec.lineHeight);
  const total = heights.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
  let top = 'centre' in anchor ? anchor.centre - total / 2 : anchor.bottom - total;
  return items.map(({ role, fit, spec }, i) => {
    const lineBox = fit.size * spec.lineHeight;
    const { ascent, descent } = m.extents(spec.face);
    const first = top + (lineBox + (ascent - descent) * fit.size) / 2;
    const block: TextBlock = {
      role, text: fit.text, lines: fit.lines, face: spec.face, size: fit.size, fill: spec.fill,
      x, width, top, height: heights[i]!,
      baselines: fit.lines.map((_, j) => first + j * lineBox),
    };
    top += heights[i]! + gap;
    return block;
  });
}

// The brand page draws the house and tool cards as two equal columns, the copy in the
// right one with 6 units of padding on its right; the stage copy runs the full width
// inside 6.5 units of padding, anchored to the bottom.
const COPY_X = 600, COPY_W = 528, COPY_GAP = 21.6;
const STAGE_X = 78, STAGE_W = W - 2 * 78, STAGE_BOTTOM = H - 78, STAGE_GAP = 19.2;
// The highest a stage block may reach: well clear of the timeline's dots, so the copy
// keeps the dark house around it and the timeline stays on its own.
const STAGE_TOP_LIMIT = 300;

async function layoutHouse(card: OpalHouseCard): Promise<OpalLayout> {
  const m = await loadOpalType();
  const s = SPEC.house;
  const title = choose([card.title], s.title, COPY_W, m);
  const line = choose(oneLiners(card.line, true), s.line, COPY_W, m);
  const url = choose([card.url], s.url, COPY_W, m);
  return {
    kind: 'house', ground: GROUNDS.house,
    blocks: stack([
      { role: 'title', fit: title, spec: s.title },
      { role: 'line', fit: line, spec: s.line },
      { role: 'url', fit: url, spec: s.url },
    ], COPY_X, COPY_W, COPY_GAP, { centre: H / 2 }, m),
  };
}

async function layoutTool(card: OpalToolCard): Promise<OpalLayout> {
  const m = await loadOpalType();
  const s = SPEC.tool;
  const kicker = choose([`Tool · ${card.name}`], s.kicker, COPY_W, m);
  const pitch = choose(oneLiners(card.description), s.title, COPY_W, m);
  const url = choose([card.url], s.url, COPY_W, m);
  return {
    kind: 'tool', ground: GROUNDS.tool,
    blocks: stack([
      { role: 'kicker', fit: kicker, spec: s.kicker },
      { role: 'title', fit: pitch, spec: s.title },
      { role: 'url', fit: url, spec: s.url },
    ], COPY_X, COPY_W, COPY_GAP, { centre: H / 2 }, m),
  };
}

async function layoutStage(card: OpalStageCard): Promise<OpalLayout> {
  const m = await loadOpalType();
  const s = SPEC.stage;
  const kicker = choose([card.kicker], s.kicker, STAGE_W, m);
  const room = STAGE_BOTTOM - STAGE_TOP_LIMIT - kicker.size * s.kicker.lineHeight - 2 * STAGE_GAP;
  // The title is the subject of the stage. The description is set first, in up to its
  // own most lines, and the title takes the room that is left; when that leaves the title
  // below its comfortable size, the description gives up its second line whenever that
  // gives the title a larger size.
  const attempt = (lineMax: number): { line: Fit; title: Fit } => {
    const line = choose(oneLiners(card.line), s.line, STAGE_W, m, lineMax);
    const left = room - line.lines.length * line.size * s.line.lineHeight;
    const title = fitAt(card.title, s.title, STAGE_W, s.title.min, m, s.title.maxLines, left)
      ?? clampAt(card.title, s.title, STAGE_W, m, Math.max(1, Math.floor(left / (s.title.min * s.title.lineHeight))));
    return { line, title };
  };
  let { line, title } = attempt(s.line.maxLines);
  if (title.size < s.title.comfortable && line.lines.length > 1) {
    const tighter = attempt(1);
    if (tighter.title.size > title.size) ({ line, title } = tighter);
  }
  return {
    kind: 'stage', ground: GROUNDS.stage,
    blocks: stack([
      { role: 'kicker', fit: kicker, spec: s.kicker },
      { role: 'title', fit: title, spec: s.title },
      { role: 'line', fit: line, spec: s.line },
    ], STAGE_X, STAGE_W, STAGE_GAP, { bottom: STAGE_BOTTOM }, m),
  };
}

/** Lay out a card of one kind: its copy chosen, fitted and placed. */
export function layoutOpalCard(kind: 'house', card: OpalHouseCard): Promise<OpalLayout>;
export function layoutOpalCard(kind: 'tool', card: OpalToolCard): Promise<OpalLayout>;
export function layoutOpalCard(kind: 'stage', card: OpalStageCard): Promise<OpalLayout>;
export function layoutOpalCard(kind: OpalKind, card: OpalHouseCard | OpalToolCard | OpalStageCard): Promise<OpalLayout> {
  if (kind === 'tool') return layoutTool(card as OpalToolCard);
  if (kind === 'stage') return layoutStage(card as OpalStageCard);
  return layoutHouse(card as OpalHouseCard);
}

// ── Drawing ─────────────────────────────────────────────────────────────────

// The house lollipop: the brand page's subject box (58% of the left column, its foot 20%
// up the card) with the candy filling 76% of the box, centred on the column.
const HOUSE_MARK = { x: 167.8, y: 197.8, size: 264.5 };
// The tool sticker: the brand page's 64-unit prize at 240 px (40% of the column, its foot
// 24% up the card), a white tile of 56 units with 10-unit corners.
const STICKER = { x: 195, y: 253.8, size: 210, radius: 37.5 };
// The glyph on the sticker, in the tool's own 24-unit icon box, and the mark that stands
// in for a tool with no icon.
const GLYPH = { size: 156, stroke: 2 };
const STICKER_MARK = 150;

/** A catalog icon (24-unit box, stroke="currentColor") placed as a nested viewport in one
 *  colour; the root's own size and stroke width give way to the ones set here. */
function placeGlyph(iconSvg: string, x: number, y: number, size: number, colour: string, stroke: number): string {
  return iconSvg
    .replace(/currentColor/g, colour)
    .replace(/^<svg\b[^>]*>/, tag => tag
      .replace(/\s(?:width|height|stroke-width|x|y)\s*=\s*"[^"]*"/g, '')
      .replace(/^<svg\b/, `<svg x="${r(x)}" y="${r(y)}" width="${r(size)}" height="${r(size)}" stroke-width="${stroke}"`));
}

function groundSvg(g: Ground): string {
  const stops = g.stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');
  return `<defs><radialGradient id="ground" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1"`
    + ` gradientTransform="translate(${g.cx} ${g.cy}) scale(${g.rx} ${g.ry})">${stops}</radialGradient></defs>`
    + `<rect width="${W}" height="${H}" fill="url(#ground)"/>`;
}

// The stage's timeline: the brand page's 600 × 120 drawing scaled to the card's width
// inside 6 units, its top 7 units down. Four past dots, one present dot in Green Apple
// with a line rising into the spotlight, and one dot still to come.
const TIMELINE = { x: 72, y: 84, scale: (W - 144) / 600 };
function timelineSvg(): string {
  const { x, y, scale } = TIMELINE;
  const dot = (cx: number) => `<circle cx="${cx}" cy="80" r="5" fill="${INK.stageDot}"/>`;
  return `<g transform="translate(${x} ${y}) scale(${r(scale * 1000) / 1000})" fill="none"`
    + ` stroke="${INK.stageTitle}" stroke-opacity="0.35" stroke-width="1.5">`
    + `<path d="M20 80H580"/>${dot(60)}${dot(190)}${dot(320)}`
    + `<circle cx="450" cy="80" r="7" fill="${OPAL.greenApple}" stroke="${OPAL.greenApple}" stroke-opacity="1"/>`
    + `${dot(560)}<path d="M450 80V28"/></g>`;
}

function textSvg(b: TextBlock): string {
  const family = b.face.family.includes(' ') ? `'${b.face.family}'` : b.face.family;
  const spacing = b.face.tracking ? ` letter-spacing="${r(b.face.tracking * b.size * 100) / 100}"` : '';
  return b.lines.map((line, i) =>
    `<text x="${r(b.x)}" y="${r(b.baselines[i]!)}" font-family="${family}" font-weight="${b.face.weight}"`
    + ` font-size="${r(b.size)}"${spacing} fill="${b.fill}">${xmlEsc(line)}</text>`).join('');
}

/** The card as one self-contained SVG: the ground, the subject, then the copy. */
export function opalCardSvg(layout: OpalLayout, art: { mark: string | null; iconSvg?: string }): string {
  const out: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`];
  out.push(groundSvg(layout.ground));
  if (layout.kind === 'house' && art.mark) {
    const { x, y, size } = HOUSE_MARK;
    out.push(`<image x="${x}" y="${y}" width="${size}" height="${size}" href="${art.mark}"/>`);
  }
  if (layout.kind === 'tool') {
    const s = STICKER, cx = s.x + s.size / 2, cy = s.y + s.size / 2;
    out.push(`<rect x="${s.x}" y="${s.y}" width="${s.size}" height="${s.size}" rx="${s.radius}" fill="${OPAL.sugar}"/>`);
    if (art.iconSvg) {
      out.push(placeGlyph(art.iconSvg, cx - GLYPH.size / 2, cy - GLYPH.size / 2, GLYPH.size, OPAL.spearmint, GLYPH.stroke));
    } else if (art.mark) {
      out.push(`<image x="${r(cx - STICKER_MARK / 2)}" y="${r(cy - STICKER_MARK / 2)}" width="${STICKER_MARK}" height="${STICKER_MARK}" href="${art.mark}"/>`);
    }
  }
  if (layout.kind === 'stage') out.push(timelineSvg());
  for (const b of layout.blocks) out.push(textSvg(b));
  out.push('</svg>');
  return out.join('');
}

/**
 * The three Opal card renderers over one rasteriser. Each returns PNG bytes; `mark` is
 * the chrome's lollipop (icon.svg as a data URI), or null when that file is missing.
 */
export function createOpalCards(rasterize: SvgToPng, mark: string | null) {
  const paint = (layout: OpalLayout, iconSvg?: string): Promise<Buffer> =>
    rasterize(opalCardSvg(layout, { mark, iconSvg }), {
      width: W, height: H, background: layout.ground.stops[layout.ground.stops.length - 1]![1],
    });
  return {
    async house(card: OpalHouseCard): Promise<Buffer> { return paint(await layoutOpalCard('house', card)); },
    async tool(card: OpalToolCard): Promise<Buffer> { return paint(await layoutOpalCard('tool', card), card.iconSvg); },
    async stage(card: OpalStageCard): Promise<Buffer> { return paint(await layoutOpalCard('stage', card)); },
  };
}
