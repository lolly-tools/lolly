// present-math.ts - the pure, DOM-free model behind presentation mode (plan 112).
//
// The conductor (present-mode.ts) reads the rendered `.lolly-frame-page` DOM into a
// list of FrameSpec, hands it here, and gets back: a deck walk order, `s=` address
// resolution, travel direction, and the per-frame state-class assignment (reveal's
// past/present/future trichotomy). Nothing in this file touches the DOM or the input
// model - it is unit-tested with plain objects, exactly like the CLI shares the
// engine's render path (one source of truth, no browser needed to check the maths).
//
// The model is 2D-capable from the start: frames group into COLUMNS (the main axis,
// `order`) each holding a vertical STACK of sub-slides (`stackOf`). When no frame
// declares `stackOf` - the M1 case, before the sub-slide field ships - every column
// holds exactly one frame and the walk is a plain left-to-right line, so the 2D code
// degrades to linear with no special-casing. Stacks (plan section 6) then land as data only.

/** One frame as the conductor extracts it from a `.lolly-frame-page`. */
export interface FrameSpec {
  /** Frame id - the `data-frame-id` stamped on the page (ULID or a human id like `slide1`). */
  id: string;
  /** Authored sort key: presentation order ascending, then `x` ascending as tie-break. */
  order: number;
  /** Authored canvas position - used for the tie-break, overview map, and stack seeding. */
  x: number;
  y: number;
  /** Frame size, for letterboxing a mixed-size deck into one viewport stack. */
  w: number;
  h: number;
  /** Temporal dwell in ms for kiosk auto-advance (plan 93: `dur` > 0 = temporal). null/absent = manual. */
  dur?: number | null;
  /** Frame id of this frame's column head when it is a vertical sub-slide; null/absent = a head. */
  stackOf?: string | null;
}

/** A frame's resolved place in the deck: its column, its row within that column's
 *  stack, and its absolute position in the linear advance walk. */
export interface DeckPosition {
  id: string;
  /** 0-based column index along the main axis. */
  col: number;
  /** 0-based row within the column's vertical stack (0 = the column head). */
  row: number;
  /** 0-based position in the full linear walk (Space/→ order): head, its stack, next head, … */
  index: number;
  frame: FrameSpec;
}

/** The whole deck, in every shape the conductor needs to read it. */
export interface Deck {
  /** Every frame in linear walk order (what advance/retreat step through). */
  positions: DeckPosition[];
  /** Lookup by frame id (for `s=<id>` and reorder-proof URL sync). */
  byId: Map<string, DeckPosition>;
  /** columns[col][row] - the 2D grid, columns in main-axis order, rows top-to-bottom. */
  columns: DeckPosition[][];
  /** Total frames. */
  count: number;
  /** Number of column heads (what numeric `s=N` counts). */
  columnCount: number;
}

/** Travel direction between two positions, for `data-nav-dir` and direction-aware
 *  transition reversal. Horizontal moves win over vertical when both change (a jump
 *  across columns is a horizontal transition even if the target row differs). */
export type NavDir = 'left' | 'right' | 'up' | 'down' | null;

/** reveal's per-frame state trichotomy plus the peek-neighbour and unload flags. */
export interface FrameState {
  index: number;
  id: string;
  /** Exactly one of these, purely positional (index vs active) - NOT direction-aware;
   *  direction lives on the root as `data-nav-dir` so CSS composes the two. */
  state: 'past' | 'present' | 'future';
  /** The immediate neighbours in the walk, for peek/adjacency effects. */
  isPrev: boolean;
  isNext: boolean;
  /** Belongs to a column with more than one frame (a real stack) - `pr-stack`. */
  isStack: boolean;
  /** Beyond the live window (|index − active| > viewDistance): unload + aria-hidden.
   *  This is the rendering monopoly (plan section 5.2): only the live window paints. */
  hidden: boolean;
}

/** The parsed form of an `s=` address: which frame, and which build step within it. */
export interface Address {
  /** The resolved position, or null when the address named nothing in the deck. */
  position: DeckPosition | null;
  /** Build-step threshold from an `.N` suffix (reveal boxes whose `build` ≤ N): a raw
   *  1-based build value, or null when no suffix was given. `.0` is meaningless → null. */
  build: number | null;
}

/** Is a string a bare non-negative integer (a positional `s=N`)? */
function isPositional(s: string): boolean {
  return /^\d+$/.test(s);
}

/** Build the deck from raw frame specs. Total function: an empty list yields an empty
 *  deck; a `stackOf` pointing at a missing/non-head frame degrades that frame to its
 *  own head rather than dropping it (geometry proposes, structure disposes - a dangling
 *  reference must never lose a slide). */
export function buildDeck(frames: readonly FrameSpec[]): Deck {
  // Canonical sort: order asc, then x asc, then id asc (stable, deterministic - the
  // same rule hooks.js uses for paged export, so present order === export order).
  const sorted = [...frames].sort(
    (a, b) => a.order - b.order || a.x - b.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );

  const byIdSpec = new Map<string, FrameSpec>();
  for (const f of sorted) byIdSpec.set(f.id, f);

  // A frame is a HEAD unless its stackOf names another frame that is itself a head.
  // (A stackOf chain is one level deep by construction - a sub-slide can't head a stack.)
  const isHead = (f: FrameSpec): boolean => {
    const head = f.stackOf;
    if (head == null || head === '' || head === f.id) return true;
    const target = byIdSpec.get(head);
    // Dangling or pointing at another sub-slide ⇒ treat as its own head.
    return !target || (target.stackOf != null && target.stackOf !== '' && target.stackOf !== target.id);
  };

  const heads = sorted.filter(isHead);
  const columns: DeckPosition[][] = [];
  const positions: DeckPosition[] = [];
  const byId = new Map<string, DeckPosition>();

  for (let col = 0; col < heads.length; col++) {
    const head = heads[col]!;
    const members = [head, ...sorted.filter((f) => !isHead(f) && f.stackOf === head.id)];
    const column: DeckPosition[] = [];
    for (let row = 0; row < members.length; row++) {
      const frame = members[row]!;
      const pos: DeckPosition = { id: frame.id, col, row, index: 0, frame };
      column.push(pos);
    }
    columns.push(column);
  }

  // Flatten columns → linear walk, assigning the absolute index as we go.
  let index = 0;
  for (const column of columns) {
    for (const pos of column) {
      pos.index = index++;
      positions.push(pos);
      byId.set(pos.id, pos);
    }
  }

  return { positions, byId, columns, count: positions.length, columnCount: columns.length };
}

/**
 * Geometry proposes, structure disposes (plan 112 M5): when NO frame authors a
 * `stackOf`, frames sharing an x-column become that column's vertical stack -
 * the head is the topmost, sub-slides follow in y order (their `order` values
 * take fractional nudges so buildDeck's canonical sort walks head-then-stack).
 * Any authored `stackOf` anywhere disables the whole derivation.
 *
 * Two abstentions keep existing decks byte-stable: a single-column doc (a plain
 * vertical strip) stays LINEAR - collapsing it to one column would break every
 * numeric `s=` link and read "1/1" on an N-frame deck - and a doc with no
 * vertical overlap at all has nothing to stack.
 */
export function seedStacks(frames: readonly FrameSpec[]): FrameSpec[] {
  if (frames.length < 2) return [...frames];
  if (frames.some((f) => f.stackOf != null && f.stackOf !== '')) return [...frames];
  const sorted = [...frames].sort(
    (a, b) => a.order - b.order || a.x - b.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  // Columns by x-interval: a frame joins the first column whose FOUNDER's x-span
  // contains its x-centre; otherwise it founds a new column.
  const cols: FrameSpec[][] = [];
  for (const f of sorted) {
    const cx = f.x + f.w / 2;
    const hit = cols.find((c) => cx >= c[0]!.x && cx < c[0]!.x + c[0]!.w);
    if (hit) hit.push(f);
    else cols.push([f]);
  }
  if (cols.length < 2 || !cols.some((c) => c.length > 1)) return [...frames];
  const out: FrameSpec[] = [];
  for (const c of cols) {
    const byY = [...c].sort((a, b) => a.y - b.y || a.order - b.order);
    const head = byY[0]!;
    out.push({ ...head, stackOf: null });
    byY.slice(1).forEach((m, i) => {
      out.push({ ...m, stackOf: head.id, order: head.order + (i + 1) / (byY.length + 1) });
    });
  }
  return out;
}

/** Resolve an `s=` address against a deck. Digits count COLUMN HEADS (1-based, plan section 6);
 *  anything else is a frame id (matches any frame, head or sub-slide, regardless of
 *  position - reorder-proof). An `.N` suffix is a 1-based build step, returned 0-based.
 *  Junk / out-of-range → position null (the caller falls back to the first frame),
 *  never a throw. */
export function resolveAddress(s: string | null | undefined, deck: Deck): Address {
  if (s == null || s === '') return { position: null, build: null };
  const dot = s.indexOf('.');
  const slidePart = dot < 0 ? s : s.slice(0, dot);
  const buildPart = dot < 0 ? '' : s.slice(dot + 1);

  let build: number | null = null;
  if (isPositional(buildPart)) {
    const n = parseInt(buildPart, 10);
    build = n >= 1 ? n : null; // `.N` is a build-value threshold (reveal boxes with build ≤ N); `.0` is meaningless
  }

  let position: DeckPosition | null = null;
  if (isPositional(slidePart)) {
    const n = parseInt(slidePart, 10);
    const head = deck.columns[n - 1]?.[0]; // 1-based head index
    position = head ?? null;
  } else {
    position = deck.byId.get(slidePart) ?? null;
  }
  return { position, build };
}

/** Travel direction between two positions (old → new). Column change = horizontal and
 *  takes precedence; same column, different row = vertical; same position = null. */
export function navDir(from: DeckPosition | null, to: DeckPosition | null): NavDir {
  if (!from || !to) return null;
  if (to.col !== from.col) return to.col > from.col ? 'right' : 'left';
  if (to.row !== from.row) return to.row > from.row ? 'down' : 'up';
  return null;
}

/** The state-class assignment for the whole deck at a given active index. Positional,
 *  not direction-aware (direction is a separate root signal). `viewDistance` is the
 *  live window each side of the active frame (reveal's viewDistance; default 1 - the
 *  rendering monopoly keeps only active±1 painting, plan section 5.2.1). */
export function frameStates(deck: Deck, activeIndex: number, viewDistance = 1): FrameState[] {
  const active = clampIndex(deck, activeIndex);
  return deck.positions.map((pos) => {
    const d = pos.index - active;
    const state: FrameState['state'] = d < 0 ? 'past' : d > 0 ? 'future' : 'present';
    return {
      index: pos.index,
      id: pos.id,
      state,
      isPrev: pos.index === active - 1,
      isNext: pos.index === active + 1,
      isStack: (deck.columns[pos.col]?.length ?? 1) > 1,
      hidden: Math.abs(d) > viewDistance,
    };
  });
}

/** Clamp an index into the deck's range (empty deck → 0). */
export function clampIndex(deck: Deck, index: number): number {
  if (deck.count === 0) return 0;
  if (index < 0) return 0;
  if (index >= deck.count) return deck.count - 1;
  return index;
}

/** The next frame in the linear walk. With `loop`, wraps from the last frame to the
 *  first; without it, stays put at the end (returns the same index). Builds are handled
 *  by the conductor before it calls this - this is slide-to-slide only. */
export function walkNext(deck: Deck, index: number, opts: { loop?: boolean } = {}): number {
  if (deck.count === 0) return 0;
  const i = clampIndex(deck, index);
  if (i < deck.count - 1) return i + 1;
  return opts.loop ? 0 : i;
}

/** The previous frame in the linear walk. With `loop`, wraps from the first to the last. */
export function walkPrev(deck: Deck, index: number, opts: { loop?: boolean } = {}): number {
  if (deck.count === 0) return 0;
  const i = clampIndex(deck, index);
  if (i > 0) return i - 1;
  return opts.loop ? deck.count - 1 : i;
}

// ── Morph matching (M5) ───────────────────────────────────────────────────────────────
// The "morph" transition FLIPs boxes that MATCH across two adjacent slides from their old
// place to their new one. Matching is where every competitor is weak - Figma matches by
// layer name (breaks on rename), Canva/Pitch by a hidden auto id. We expose it: an author
// sets `matchOf` for a deliberate link, and otherwise identical text or the same image is
// matched implicitly. This is the pure pairing; the conductor does the FLIP off these ids.

/** A box as the morph matcher sees it (the conductor reads these off the rendered DOM). */
export interface MorphBox {
  id: string;
  /** Explicit match key (`matchOf` / `data-match`) - the strongest signal. */
  matchOf?: string | null;
  /** Visible text content, trimmed - the implicit signal for text boxes. */
  text?: string | null;
  /** Image/video identity (asset id or `data-video-key`) - the implicit signal for media. */
  imageKey?: string | null;
}

/** A matched pair: the leaving box morphs INTO the entering box. */
export interface MorphPair { fromId: string; toId: string; via: 'matchOf' | 'text' | 'image'; }

/** Pair boxes across the leaving frame (`from`) and entering frame (`to`) for a morph.
 *  One-to-one and greedy: explicit `matchOf` links first, then equal non-empty text, then
 *  equal image key. A box already claimed by a stronger tier is never reused, so a rename
 *  that breaks an implicit text match still leaves an explicit `matchOf` intact. */
export function matchMorphBoxes(from: readonly MorphBox[], to: readonly MorphBox[]): MorphPair[] {
  const pairs: MorphPair[] = [];
  const usedFrom = new Set<string>();
  const usedTo = new Set<string>();

  const claim = (a: MorphBox, b: MorphBox, via: MorphPair['via']): void => {
    pairs.push({ fromId: a.id, toId: b.id, via });
    usedFrom.add(a.id); usedTo.add(b.id);
  };
  const norm = (s: string | null | undefined): string => (s ?? '').trim();

  // Tier 1 - explicit matchOf === matchOf (both non-empty).
  for (const a of from) {
    if (usedFrom.has(a.id)) continue;
    const key = norm(a.matchOf);
    if (!key) continue;
    const b = to.find((t) => !usedTo.has(t.id) && norm(t.matchOf) === key);
    if (b) claim(a, b, 'matchOf');
  }
  // Tier 2 - identical non-empty text.
  for (const a of from) {
    if (usedFrom.has(a.id)) continue;
    const key = norm(a.text);
    if (!key) continue;
    const b = to.find((t) => !usedTo.has(t.id) && norm(t.text) === key);
    if (b) claim(a, b, 'text');
  }
  // Tier 3 - identical non-empty image/media key.
  for (const a of from) {
    if (usedFrom.has(a.id)) continue;
    const key = norm(a.imageKey);
    if (!key) continue;
    const b = to.find((t) => !usedTo.has(t.id) && norm(t.imageKey) === key);
    if (b) claim(a, b, 'image');
  }
  return pairs;
}

/** Vertical navigation within the active frame's column (the 4-arrow stack walk).
 *  Returns the index of the neighbour above/below in the same column, or the same
 *  index when there is none (a column edge - do NOT spill into the next column; that
 *  is what ←/→ are for). */
export function stackStep(deck: Deck, index: number, dir: 'up' | 'down'): number {
  if (deck.count === 0) return 0;
  const pos = deck.positions[clampIndex(deck, index)];
  if (!pos) return index;
  const column = deck.columns[pos.col];
  if (!column) return index;
  const targetRow = dir === 'down' ? pos.row + 1 : pos.row - 1;
  const target = column[targetRow];
  return target ? target.index : pos.index;
}

// ── The canvas camera, and the flight transition (plan 179 M4 section 7) ──────────────
// A deck is authored on a canvas, and two of the presenter's surfaces are views of that
// same arrangement: the OVERVIEW map (a camera framing every frame at once) and the
// FLIGHT transition (a camera travelling from one frame to the next, Prezi-style). Both
// are `cameraFor` applied to a rectangle, which is what stops the map and the flight from
// disagreeing about where a frame is - there is one placement rule, not two.

/** A rectangle in AUTHORED canvas units (a frame's `left`/`top`/`width`/`height`). */
export interface Rect { x: number; y: number; w: number; h: number }

/** The presenter viewport, in CSS pixels. */
export interface Viewport { w: number; h: number }

/**
 * A camera over the canvas, expressed exactly as the CSS that applies it:
 * `transform: translate(tx, ty) scale(scale)` with `transform-origin: 0 0`. So a point
 * `p` in canvas units paints at `tx + p * scale`.
 */
export interface Camera { scale: number; tx: number; ty: number }

const clampNum = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

function finiteRect(r: Rect | null | undefined): r is Rect {
  return !!r && Number.isFinite(r.x) && Number.isFinite(r.y) && r.w > 0 && r.h > 0;
}

/** The smallest rectangle containing them all; a degenerate list yields a unit box. */
export function unionRect(rects: readonly Rect[]): Rect {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rects) {
    if (!finiteRect(r)) continue;
    minX = Math.min(minX, r.x); minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 1, h: 1 };
  return { x: minX, y: minY, w: maxX - minX || 1, h: maxY - minY || 1 };
}

/** The camera that centres `rect` in `view` and fits it with `margin` to spare. */
export function cameraFor(rect: Rect, view: Viewport, margin = 1): Camera {
  const w = rect.w > 0 ? rect.w : 1;
  const h = rect.h > 0 ? rect.h : 1;
  const scale = Math.min(view.w / w, view.h / h) * margin;
  return {
    scale,
    tx: view.w / 2 - (rect.x + w / 2) * scale,
    ty: view.h / 2 - (rect.y + h / 2) * scale,
  };
}

/** Where `rect` paints, in viewport pixels, under `cam`. */
export function rectOnScreen(rect: Rect, cam: Camera): Rect {
  return {
    x: cam.tx + rect.x * cam.scale,
    y: cam.ty + rect.y * cam.scale,
    w: rect.w * cam.scale,
    h: rect.h * cam.scale,
  };
}

/** Do two rectangles share any area? (Touching edges do not count.) */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** One leg of a flight: the camera to arrive at, and how long to take getting there. */
export interface FlightPhase extends Camera { ms: number }

/** A whole camera move from one frame to another. */
export interface FlightPath {
  /** One phase for a near move, two for the zoom-out-then-in arc. Never empty. */
  phases: FlightPhase[];
  /** The sum of the phase durations, ms. */
  total: number;
  /** Was the arc used (the two frames do not share the screen)? */
  zoomOut: boolean;
  /** How far the camera travels, measured in frame-spans - the "is this too far" number. */
  spans: number;
}

/** The flight's duration band. A near hop takes the floor, a whole-canvas move the ceiling. */
export const FLIGHT_MIN_MS = 500;
export const FLIGHT_MAX_MS = 900;
/** Travel, in frame-spans, at which a flight takes the full {@link FLIGHT_MAX_MS}. */
export const FLIGHT_FULL_SPANS = 2;
/** Past this much travel a flight stops reading as a move and becomes a whoosh - the
 *  caller crossfades instead. Deliberately generous: a wide deck is still flyable. */
export const FLIGHT_MAX_SPANS = 24;
/** How much of the viewport a flown-to frame fills - the same 0.94 the stacked deck fits to. */
export const FLIGHT_MARGIN = 0.94;
/** The looser fit at the top of the arc, so both frames are comfortably inside it. */
export const FLIGHT_OUT_MARGIN = 0.82;
/** Share of the total the zoom-out leg takes; the zoom-in gets the rest (it reads better
 *  slightly slower - the audience is looking for which frame they arrived at). */
export const FLIGHT_ARC_SPLIT = 0.45;

/**
 * The camera move from frame `a` to frame `b`.
 *
 * TWO SHAPES, and which one you get is geometry, not taste. When `a` is still on screen
 * once the camera frames `b` - overlapping boards, a frame inside another, a tiny hop -
 * one eased move is the honest answer: the audience never loses sight of where they came
 * from. When it is not, a straight interpolation would sweep the canvas past the viewport
 * in a blur, so the camera ARCS: out to a scale that holds both frames, then in on `b`.
 * That is the whole Prezi idea, and it is the reason a two-phase path exists at all.
 *
 * Returns null for input that cannot be flown (a zero viewport, an empty frame).
 */
export function flightPath(a: Rect, b: Rect, view: Viewport): FlightPath | null {
  if (!finiteRect(a) || !finiteRect(b) || !(view.w > 0) || !(view.h > 0)) return null;
  const camB = cameraFor(b, view, FLIGHT_MARGIN);
  const span = Math.max(a.w, a.h, b.w, b.h) || 1;
  const travel = Math.hypot((b.x + b.w / 2) - (a.x + a.w / 2), (b.y + b.h / 2) - (a.y + a.h / 2));
  const spans = travel / span;
  const total = Math.round(
    FLIGHT_MIN_MS + (FLIGHT_MAX_MS - FLIGHT_MIN_MS) * clampNum(spans / FLIGHT_FULL_SPANS, 0, 1),
  );
  const screen: Rect = { x: 0, y: 0, w: view.w, h: view.h };
  if (rectsOverlap(rectOnScreen(a, camB), screen)) {
    return { phases: [{ ...camB, ms: total }], total, zoomOut: false, spans };
  }
  const camOut = cameraFor(unionRect([a, b]), view, FLIGHT_OUT_MARGIN);
  const ms1 = Math.round(total * FLIGHT_ARC_SPLIT);
  return {
    phases: [{ ...camOut, ms: ms1 }, { ...camB, ms: total - ms1 }],
    total,
    zoomOut: true,
    spans,
  };
}
