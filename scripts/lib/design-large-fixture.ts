// SPDX-License-Identifier: MPL-2.0
/**
 * Large Design documents for the navigation benchmark (scripts/bench-design-navigation.ts).
 *
 * Seeded and deterministic: one name and seed always give identical rows,
 * so a run before a change and a run after it measure the same document. Rows are stored
 * Design layers in global canvas coordinates, the form the editor itself writes.
 *
 *   D1         one page, 50 artboards (1920 x 1080, 10 x 5 grid), 2,000 objects:
 *              1,100 text (12 to 96 px, 30% multi-line), 500 shapes (10% shadow,
 *              5% layer blur, 5% blend mode), 200 pictures from 20 distinct 3000 x 2000
 *              JPEGs, 100 paths, 50 connectors and 50 groups
 *   D1-pages   the D1 rows split across 10 pages, five artboards on each
 *   D1-motion  D1 plus 8 videos and 8 Lottie clips
 *   D2         5,000 objects in the D1 mix
 *   D3         20,000 objects in the D1 mix
 *   W1         1,900 rows in all, just under a lolly-work room's 2,000-box limit
 *
 * Pictures, videos and clips are referenced as uploads (`user/media/...`). The generator
 * only lists their ids; the harness makes the bytes in the browser, stores them as uploads
 * and passes their refs back in through `media`, so a run needs no network. A missing
 * ref keeps its id with an empty url, which draws an empty box.
 */

export type DesignFixtureName = 'D1' | 'D1-pages' | 'D1-motion' | 'D2' | 'D3' | 'W1';
export const DESIGN_FIXTURES: readonly DesignFixtureName[] = ['D1', 'D1-pages', 'D1-motion', 'D2', 'D3', 'W1'];

export type FixtureRow = Record<string, string | number | boolean | FixtureMediaRef> & { id: string; kind: string };
export interface FixtureMediaRef {
  source: 'user';
  id: string;
  type: 'raster' | 'video' | 'lottie';
  format: string;
  url: string;
  width?: number;
  height?: number;
  meta?: Record<string, unknown>;
}
export interface FixturePage { id: string; name: string; order: number }
export interface FixtureArtboard { id: string; x: number; y: number; w: number; h: number; pageId: string }
export interface DesignFixture {
  name: DesignFixtureName;
  seed: number;
  boxes: FixtureRow[];
  /** The `pages` input, or an empty list for a one-page document. */
  pages: FixturePage[];
  artboards: FixtureArtboard[];
  counts: Record<string, number>;
}
export interface DesignFixtureOptions {
  seed?: number;
  /** Refs for the media the rows name (see `fixtureMedia`), keyed by upload id. */
  media?: Readonly<Record<string, FixtureMediaRef>>;
}

/** One picture, video or clip a fixture names. The harness draws it from `seed`. */
export interface FixtureMediaSpec {
  id: string;
  type: FixtureMediaRef['type'];
  format: string;
  width: number;
  height: number;
  seed: number;
  name: string;
}

const ARTBOARD_W = 1920, ARTBOARD_H = 1080, GRID_COLS = 10, GRID_ROWS = 5, GAP = 240;
const ARTBOARDS = GRID_COLS * GRID_ROWS;
const PICTURES = 20, PICTURE_W = 3000, PICTURE_H = 2000;
const VIDEOS = 8, CLIPS = 8;
/** The D1 mix. Every other size keeps these proportions. */
const BASE_MIX = { text: 1100, shape: 500, image: 200, path: 100, connector: 50, group: 50 } as const;
type Kind = keyof typeof BASE_MIX;
const BASE_OBJECTS = 2000;
const OBJECTS: Record<DesignFixtureName, number> = { D1: 2000, 'D1-pages': 2000, 'D1-motion': 2000, D2: 5000, D3: 20000, W1: 1900 - ARTBOARDS };
const DEFAULT_SEED = 20261023;

const PALETTE = ['#0f2a3f', '#1f6f5c', '#30ba78', '#f3c13a', '#e4572e', '#7d5ba6', '#2c7be5', '#f2f0eb', '#ffffff', '#dfe7ef'];
const INKS = ['#152135', '#0c322c', '#3a3a3a', '#ffffff', '#5c2d91'];
const WORDS = ('launch quarterly roadmap brand canvas motion review signal harbour orbit pattern spring ' +
  'summit delta native vector render layer frame story chart sprint budget partner cloud edge market ' +
  'insight growth design system colour type grid balance contrast rhythm scale detail').split(' ');
const SPLINES = ['line', 'hyperbezier', 'catmull-rom'] as const;

/** A small, fast, seedable generator (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Counts per kind for `objects` objects, in the D1 proportions (largest remainder). */
export function mixFor(objects: number): Record<Kind, number> {
  const kinds = Object.keys(BASE_MIX) as Kind[];
  const exact = kinds.map(kind => BASE_MIX[kind] * objects / BASE_OBJECTS);
  const counts = exact.map(Math.floor);
  let left = objects - counts.reduce((sum, n) => sum + n, 0);
  const order = kinds.map((_, i) => i).sort((a, b) => (exact[b]! - counts[b]!) - (exact[a]! - counts[a]!) || a - b);
  for (const i of order) { if (left <= 0) break; counts[i]!++; left--; }
  return Object.fromEntries(kinds.map((kind, i) => [kind, counts[i]!])) as Record<Kind, number>;
}

/** The media a fixture names: 20 pictures, plus 8 videos and 8 clips for D1-motion. */
export function fixtureMedia(name: DesignFixtureName): FixtureMediaSpec[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  const pictures = Array.from({ length: PICTURES }, (_, i): FixtureMediaSpec => ({
    id: `user/media/bench-photo-${pad(i + 1)}`, type: 'raster', format: 'jpg', width: PICTURE_W, height: PICTURE_H, seed: 1000 + i, name: `Bench photo ${i + 1}`,
  }));
  if (name !== 'D1-motion') return pictures;
  return [
    ...pictures,
    ...Array.from({ length: VIDEOS }, (_, i): FixtureMediaSpec => ({
      id: `user/media/bench-video-${pad(i + 1)}`, type: 'video', format: 'webm', width: 640, height: 360, seed: 2000 + i, name: `Bench video ${i + 1}`,
    })),
    ...Array.from({ length: CLIPS }, (_, i): FixtureMediaSpec => ({
      id: `user/media/bench-clip-${pad(i + 1)}`, type: 'lottie', format: 'json', width: 400, height: 400, seed: 3000 + i, name: `Bench clip ${i + 1}`,
    })),
  ];
}

/** A two-second Lottie clip: one rounded square turning and changing colour. */
export function lottieClip(seed: number): Record<string, unknown> {
  const random = seededRandom(seed);
  const colour = () => [0, 1, 2].map(() => Math.round(random() * 100) / 100).concat(1);
  const ease = { i: { x: [0.5], y: [0.5] }, o: { x: [0.5], y: [0.5] } };
  return {
    v: '5.7.4', fr: 30, ip: 0, op: 60, w: 400, h: 400, nm: `bench-clip-${seed}`, ddd: 0, assets: [],
    layers: [{
      ddd: 0, ind: 1, ty: 4, nm: 'square', sr: 1, ao: 0, ip: 0, op: 60, st: 0, bm: 0,
      ks: {
        o: { a: 0, k: 100 }, p: { a: 0, k: [200, 200, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] },
        r: { a: 1, k: [{ t: 0, s: [0], ...ease }, { t: 60, s: [360] }] },
      },
      shapes: [{
        ty: 'gr', nm: 'shape',
        it: [
          { ty: 'rc', d: 1, s: { a: 0, k: [180, 180] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 28 } },
          { ty: 'fl', c: { a: 1, k: [{ t: 0, s: colour(), ...ease }, { t: 60, s: colour() }] }, o: { a: 0, k: 100 }, r: 1 },
          { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
        ],
      }],
    }],
  };
}

function emptyRef(spec: FixtureMediaSpec): FixtureMediaRef {
  return { source: 'user', id: spec.id, type: spec.type, format: spec.format, url: '', width: spec.width, height: spec.height, meta: { name: spec.name } };
}

/** Normalised polygon or blob nodes in the authored-path wire form (engine/src/geom/authored-url.ts). */
function pathValue(random: () => number, n: number): string {
  const spline = SPLINES[n % SPLINES.length]!;
  const points = 3 + Math.floor(random() * 5);
  const nodes: string[] = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2, radius = 0.32 + random() * 0.18;
    const x = 0.5 + Math.cos(angle) * radius, y = 0.5 + Math.sin(angle) * radius;
    nodes.push(`${Number(x.toFixed(3))}!${Number(y.toFixed(3))}`);
  }
  return `1!${spline}!1_${nodes.join('_')}`;
}

function sentence(random: () => number, words: number): string {
  const out: string[] = [];
  for (let i = 0; i < words; i++) out.push(WORDS[Math.floor(random() * WORDS.length)]!);
  const text = out.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const pick = <T>(random: () => number, list: readonly T[]): T => list[Math.floor(random() * list.length)]!;

/** Spread `count` items over the artboards: every artboard gets floor(count/50), the first few one more. */
function perArtboard(count: number, artboard: number): number {
  return Math.floor(count / ARTBOARDS) + (artboard < count % ARTBOARDS ? 1 : 0);
}

const centre = (row: FixtureRow): [number, number] => [Number(row.x) + Number(row.w) / 2, Number(row.y) + Number(row.h) / 2];
/** The index in `pool` of the row whose centre is closest to `row`'s (the first on a tie). */
function nearest(row: FixtureRow, pool: readonly FixtureRow[]): number {
  const [x, y] = centre(row);
  let best = 0, distance = Infinity;
  pool.forEach((other, i) => { const [ox, oy] = centre(other), d = (ox - x) ** 2 + (oy - y) ** 2; if (d < distance) { distance = d; best = i; } });
  return best;
}

/** Build one fixture. Pure: no clock, no I/O, the same rows for the same name and seed. */
export function designLargeFixture(name: DesignFixtureName, options: DesignFixtureOptions = {}): DesignFixture {
  const seed = options.seed ?? DEFAULT_SEED;
  const random = seededRandom(seed);
  const media = fixtureMedia(name);
  const refFor = (spec: FixtureMediaSpec): FixtureMediaRef => options.media?.[spec.id] ?? emptyRef(spec);
  const pictures = media.filter(spec => spec.type === 'raster');
  const motion = media.filter(spec => spec.type !== 'raster');
  const mix = mixFor(OBJECTS[name]);
  const paged = name === 'D1-pages';
  const pages: FixturePage[] = paged ? Array.from({ length: 10 }, (_, i) => ({ id: `page-${i + 1}`, name: `Page ${i + 1}`, order: i })) : [];
  const artboards: FixtureArtboard[] = Array.from({ length: ARTBOARDS }, (_, i) => ({
    id: `ab-${String(i + 1).padStart(2, '0')}`,
    x: (i % GRID_COLS) * (ARTBOARD_W + GAP), y: Math.floor(i / GRID_COLS) * (ARTBOARD_H + GAP), w: ARTBOARD_W, h: ARTBOARD_H,
    pageId: paged ? `page-${Math.floor(i / 5) + 1}` : 'page-1',
  }));
  const boxes: FixtureRow[] = artboards.map((board, i) => ({
    id: board.id, kind: 'frame', name: `Artboard ${i + 1}`, x: board.x, y: board.y, w: board.w, h: board.h, rot: 0,
    bg: i % 7 === 3 ? '#f2f0eb' : '#ffffff', order: i, ...(paged ? { pageId: board.pageId } : {}),
  }));
  const serial: Record<string, number> = {};
  const nextId = (prefix: string) => {
    const n = (serial[prefix] ?? 0) + 1;
    serial[prefix] = n;
    return `${prefix}-${String(n).padStart(5, '0')}`;
  };
  let shapeSerial = 0, imageSerial = 0, textSerial = 0, pathSerial = 0;

  artboards.forEach((board, a) => {
    const own: Record<Kind, number> = {
      text: perArtboard(mix.text, a), shape: perArtboard(mix.shape, a), image: perArtboard(mix.image, a),
      path: perArtboard(mix.path, a), connector: perArtboard(mix.connector, a), group: perArtboard(mix.group, a),
    };
    const motionHere = name === 'D1-motion' && a < motion.length ? [motion[a]!] : [];
    const placed = own.text + own.shape + own.image + own.path + motionHere.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(placed * ARTBOARD_W / ARTBOARD_H)));
    const rows = Math.max(1, Math.ceil(placed / cols));
    const cellW = ARTBOARD_W / cols, cellH = ARTBOARD_H / rows;
    const slots = Array.from({ length: placed }, (_, i) => i);
    // A seeded shuffle, so kinds interleave on the artboard instead of filling it in bands.
    for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [slots[i], slots[j]] = [slots[j]!, slots[i]!]; }
    let slot = 0;
    const cell = (w: number, h: number) => {
      const s = slots[slot++]!, cx = s % cols, cy = Math.floor(s / cols);
      const x = board.x + Math.min(Math.max(0, cx * cellW + random() * Math.max(0, cellW - w)), ARTBOARD_W - w);
      const y = board.y + Math.min(Math.max(0, cy * cellH + random() * Math.max(0, cellH - h)), ARTBOARD_H - h);
      return { x: Math.round(x), y: Math.round(y) };
    };
    const frame = board.id;
    const groupable: FixtureRow[] = [];
    const shapes: FixtureRow[] = [];
    const add = (row: FixtureRow) => { boxes.push(row); return row; };

    for (let i = 0; i < own.text; i++) {
      const n = textSerial++;
      const fontSize = 12 + Math.round(random() * 84);
      const lines = n % 10 < 3 ? 2 + Math.floor(random() * 3) : 1;
      const w = Math.round(Math.min(ARTBOARD_W, Math.max(cellW * 0.9, fontSize * 4) * (0.7 + random() * 0.3)));
      const h = Math.round(Math.min(ARTBOARD_H, fontSize * 1.2 * lines + 8));
      const text = Array.from({ length: lines }, () => sentence(random, 2 + Math.floor(random() * 4))).join('\n');
      groupable.push(add({ id: nextId('t'), kind: 'text', frame, ...cell(w, h), w, h, rot: 0, text, fontSize, fg: pick(random, INKS),
        weight: pick(random, ['400', '500', '700']), font: n % 5 === 0 ? 'display' : 'sans', align: 'left', valign: 'top', lineHeight: 1.2, bg: '' }));
    }
    for (let i = 0; i < own.shape; i++) {
      const n = shapeSerial++;
      const w = Math.round(Math.max(24, cellW * (0.4 + random() * 0.5))), h = Math.round(Math.max(24, cellH * (0.4 + random() * 0.5)));
      const effects: Record<string, string | number> = n % 10 === 0
        ? { shadow: 'box', shadowColor: '#00000055', shadowX: 0, shadowY: 8, shadowBlur: 24 }
        : n % 20 === 5 ? { blur: 6 } : n % 20 === 15 ? { blend: 'multiply' } : {};
      const row = add({ id: nextId('s'), kind: 'box', frame, ...cell(w, h), w, h, rot: n % 9 === 0 ? Math.round(random() * 30 - 15) : 0,
        shape: pick(random, ['rect', 'rounded', 'ellipse', 'pill']), radius: 16, bg: pick(random, PALETTE), ...effects });
      shapes.push(row); groupable.push(row);
    }
    for (let i = 0; i < own.image; i++) {
      const spec = pictures[imageSerial++ % pictures.length]!;
      const w = Math.round(Math.max(48, cellW * (0.6 + random() * 0.3))), h = Math.round(w * 2 / 3);
      groupable.push(add({ id: nextId('i'), kind: 'image', frame, ...cell(w, Math.min(h, ARTBOARD_H)), w, h: Math.min(h, ARTBOARD_H), rot: 0, image: refFor(spec), fit: 'cover' }));
    }
    for (let i = 0; i < own.path; i++) {
      const n = pathSerial++;
      const size = Math.round(Math.max(32, Math.min(cellW, cellH) * (0.5 + random() * 0.4)));
      add({ id: nextId('p'), kind: 'path', frame, ...cell(size, size), w: size, h: size, rot: 0, path: pathValue(random, n),
        bg: pick(random, PALETTE), stroke: pick(random, INKS), strokeW: 2 });
    }
    for (const spec of motionHere) {
      const w = Math.round(Math.max(64, cellW * 0.8)), h = spec.type === 'video' ? Math.round(w * 9 / 16) : w;
      add({ id: nextId(spec.type === 'video' ? 'v' : 'l'), kind: 'image', frame, ...cell(w, Math.min(h, ARTBOARD_H)), w, h: Math.min(h, ARTBOARD_H), rot: 0, image: refFor(spec), fit: 'contain' });
    }
    // Connectors and groups join near neighbours, as people draw them, so a group's
    // box or a connector's span covers a corner of the artboard, not the whole artboard.
    const bound = new Set<string>();
    const free = [...shapes];
    for (let i = 0; i < own.connector && free.length >= 2; i++) {
      const from = free.shift()!, to = free.splice(nearest(from, free), 1)[0]!;
      bound.add(from.id); bound.add(to.id);
      const [fx, fy] = centre(from), [tx, ty] = centre(to);
      add({ id: nextId('c'), kind: 'path', frame, x: Math.round(Math.min(fx, tx)), y: Math.round(Math.min(fy, ty)),
        w: Math.max(1, Math.round(Math.abs(tx - fx))), h: Math.max(1, Math.round(Math.abs(ty - fy))), rot: 0,
        path: '1!line!0_0!0_1!1', bg: '', stroke: '#152135', strokeW: 3, strokeCap: 'round', strokeJoin: 'round', headStart: 'none', headEnd: 'triangle',
        bindStart: from.id, bindEnd: to.id });
    }
    // Groups take three ungrouped objects each, a seed and its two nearest neighbours,
    // never a connector's end. A member's `group` field replaces its `frame` field.
    const members = groupable.filter(row => !bound.has(row.id));
    for (let i = members.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [members[i], members[j]] = [members[j]!, members[i]!]; }
    for (let i = 0; i < own.group && members.length >= 2; i++) {
      const first = members.shift()!;
      const chosen = [first, members.splice(nearest(first, members), 1)[0]!];
      if (members.length) chosen.push(members.splice(nearest(first, members), 1)[0]!);
      const id = nextId('g');
      const x1 = Math.min(...chosen.map(row => Number(row.x))), y1 = Math.min(...chosen.map(row => Number(row.y)));
      const x2 = Math.max(...chosen.map(row => Number(row.x) + Number(row.w))), y2 = Math.max(...chosen.map(row => Number(row.y) + Number(row.h)));
      const at = Math.min(...chosen.map(row => boxes.indexOf(row)));
      boxes.splice(at, 0, { id, kind: 'group', name: `Group ${serial.g}`, frame, x: x1, y: y1, w: x2 - x1, h: y2 - y1, rot: 0 });
      for (const row of chosen) { delete row.frame; row.group = id; }
    }
  });
  return { name, seed, boxes, pages, artboards, counts: countRows(boxes) };
}

/** Rows by what they are: shapes, pictures, videos, clips, paths and connectors apart. */
export function countRows(boxes: readonly FixtureRow[]): Record<string, number> {
  const counts: Record<string, number> = { rows: boxes.length, objects: 0 };
  for (const row of boxes) {
    const media = typeof row.image === 'object' ? row.image.type : '';
    const what = row.kind === 'box' ? 'shape' : row.kind === 'path' && row.bindStart ? 'connector'
      : row.kind === 'image' && media !== 'raster' ? media : row.kind;
    counts[what] = (counts[what] ?? 0) + 1;
    if (row.kind !== 'frame') counts.objects!++;
  }
  return counts;
}

/**
 * A pasteboard band that starts below the first page's bottom row of artboards and
 * reaches up into the first two of them, sized so it touches about `target` objects. In
 * native canvas pixels. Below the grid is open pasteboard at any zoom (artboard titles
 * sit above their artboards), so a marquee dragged over the band is an ordinary
 * multi-selection.
 */
export function marqueeBand(fixture: DesignFixture, target: number): { x1: number; y1: number; x2: number; y2: number; touched: number; ids: string[] } {
  const objects = fixture.boxes.filter(row => row.kind !== 'frame' && row.kind !== 'group' && !(row.kind === 'path' && row.bindStart));
  const page = fixture.artboards.filter(board => board.pageId === fixture.artboards[0]!.pageId);
  const bottom = Math.max(...page.map(board => board.y));
  const [first, second] = page.filter(board => board.y === bottom);
  const x1 = first!.x + first!.w * 0.4, x2 = second!.x + second!.w * 0.9, y1 = bottom + first!.h + GAP * 2;
  const inside = (y2: number) => objects.filter(row => {
    const x = Number(row.x), y = Number(row.y), w = Number(row.w), h = Number(row.h);
    return x + w >= x1 && x <= x2 && y + h >= y2 && y <= y1;
  });
  let low = bottom, high = bottom + first!.h;
  for (let i = 0; i < 30; i++) { const mid = (low + high) / 2; if (inside(mid).length >= target) low = mid; else high = mid; }
  const ids = inside(low).map(row => row.id);
  return { x1, y1, x2, y2: low, touched: ids.length, ids };
}
