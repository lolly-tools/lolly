// SPDX-License-Identifier: MPL-2.0
/**
 * pptxgen-import.ts - parse a **pptxgenjs builder script** into a freeform deck
 * model the deck-builder tool can import, later re-themed onto brand tokens.
 *
 * Users author decks as executable pptxgenjs scripts:
 *
 *     const pptxgen = require("pptxgenjs");
 *     const p = new pptxgen();
 *     p.defineLayout({ name:"W", width:13.33, height:7.5 }); p.layout = "W";
 *     const s = p.addSlide(); s.background = { color:"0B1512" };
 *     s.addText("Hello", { x:0.6, y:0.4, w:12, h:0.7, fontSize:40, color:"FFFFFF", bold:true });
 *     s.addShape(p.ShapeType.roundRect, { x:0.6, y:2, w:6, h:1, fill:{color:"30BA78"}, rectRadius:0.08 });
 *     s.addImage({ path:"logo.png", x:1, y:1, w:2, h:2 });
 *
 * Rather than re-implement pptxgenjs's API surface, we EXECUTE the user script
 * against a capturing mock of pptxgenjs and record every call. Coordinates stay
 * in **inches** on the declared layout - the deck tool converts to native box
 * units at import time via `inchesToNative`.
 *
 * ── SECURITY ────────────────────────────────────────────────────────────────
 * The script is run with `new Function("require","module","exports", source)`.
 * This is the SAME trust model as pasting content into a tool: the bytes are the
 * user's own file, executed in the user's own session - we are not running third
 * -party code. We reduce blast radius by design:
 *
 *   • The ONLY thing we ever pass to `new Function` is the user-provided `source`.
 *     We never `eval`/`Function` anything derived from network or disk.
 *   • The `require` we inject resolves ONLY `"pptxgenjs"` (to the capturing mock).
 *     Every other `require(...)` throws - so `require("fs")` / `require("https")`
 *     / `require("child_process")` are unavailable; there is no node `require`
 *     in scope to reach the filesystem or network.
 *   • The mock never touches the real DOM, filesystem, or network. `writeFile`
 *     et al. are inert thenables so a trailing `.writeFile().then()` won't throw.
 *
 * A script can still reference ambient globals of whatever realm it runs in
 * (that is inherent to in-realm execution and identical to running pasted code);
 * true isolation is a Worker/sandbox concern handled elsewhere. Slides are capped
 * at {@link MAX_SLIDES} so a runaway `for` loop can't grow the model unbounded.
 */

/** Maximum slides captured from one script; extras are silently dropped. */
export const MAX_SLIDES = 200;

export interface DeckLayout {
  wIn: number;
  hIn: number;
}

export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  sizePt?: number;
  font?: string;
  breakLine?: boolean;
}

export interface TextElement {
  type: 'text';
  xIn: number;
  yIn: number;
  wIn: number;
  hIn: number;
  runs: TextRun[];
  align?: string;
  valign?: string;
  fontFace?: string;
}

export type ShapeKind = 'rect' | 'roundRect' | 'ellipse';

export interface ShapeLine {
  color?: string;
  widthPt?: number;
}

export interface ShapeElement {
  type: 'shape';
  shape: ShapeKind;
  xIn: number;
  yIn: number;
  wIn: number;
  hIn: number;
  fill?: string;
  line?: ShapeLine;
  radius?: number;
  /** Original pptxgenjs ShapeType name when it isn't one of the three we model. */
  rawShape?: string;
}

export interface ImageElement {
  type: 'image';
  xIn: number;
  yIn: number;
  wIn: number;
  hIn: number;
  src?: string;
}

export type DeckElement = TextElement | ShapeElement | ImageElement;

export interface DeckSlide {
  background?: string;
  elements: DeckElement[];
}

export interface ParsedDeck {
  layout: DeckLayout;
  slides: DeckSlide[];
  /** Every colour seen anywhere in the script, deduped, uppercase, hash-less. */
  palette: string[];
}

export interface BrandColor {
  name: string;
  hex: string;
}

/** Built-in pptxgenjs layout presets, resolved when a script sets `p.layout`. */
const PRESET_LAYOUTS: Record<string, DeckLayout> = {
  LAYOUT_WIDE: { wIn: 13.333, hIn: 7.5 },
  LAYOUT_16x9: { wIn: 10, hIn: 5.625 },
  LAYOUT_16x10: { wIn: 10, hIn: 6.25 },
  LAYOUT_4x3: { wIn: 10, hIn: 7.5 },
};
const DEFAULT_LAYOUT: DeckLayout = { wIn: 13.333, hIn: 7.5 };

/** Coerce a pptxgenjs coordinate (number, or "1.5"/"50%" string) to a number. */
function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function numOrUndef(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Uppercase, hash-less 6-hex - pptxgenjs's own colour form. `undefined` for
 *  non-colours (e.g. `{ type:"none" }`, missing values). Unknown strings are
 *  passed through uppercased so nothing is silently lost. */
function normalizeColor(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  const body = s.startsWith('#') ? s.slice(1) : s;
  if (/^[0-9a-fA-F]{6}$/.test(body)) return body.toUpperCase();
  if (/^[0-9a-fA-F]{3}$/.test(body)) {
    const [a, b, c] = body;
    return `${a}${a}${b}${b}${c}${c}`.toUpperCase();
  }
  return s.toUpperCase();
}

function normalizeShape(raw: string): ShapeKind {
  switch (raw.toLowerCase()) {
    case 'roundrect':
      return 'roundRect';
    case 'ellipse':
    case 'oval':
      return 'ellipse';
    default:
      return 'rect';
  }
}

/** Parse a hex colour (with/without hash, 3 or 6 digits) to an sRGB tuple. */
function hexToRgb(hex: string): [number, number, number] | null {
  if (typeof hex !== 'string') return null;
  let body = hex.trim();
  if (body.startsWith('#')) body = body.slice(1);
  if (/^[0-9a-fA-F]{3}$/.test(body)) {
    const [a, b, c] = body;
    body = `${a}${a}${b}${b}${c}${c}`;
  }
  if (!/^[0-9a-fA-F]{6}$/.test(body)) return null;
  const int = Number.parseInt(body, 16);
  return [(int >> 16) & 0xff, (int >> 8) & 0xff, int & 0xff];
}

/** sRGB 8-bit channel → linear-light [0,1]. */
function srgbToLinear(c255: number): number {
  const c = c255 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Nearest brand colour to `hex` by Euclidean distance in **linear** sRGB, so a
 * later re-theming step can map an imported colour onto a brand token. Returns
 * the matched `{ name, hex }` (or `null` if `hex`/`brand` yield no comparison).
 */
export function snapColorToPalette(hex: string, brand: BrandColor[]): BrandColor | null {
  const target = hexToRgb(hex);
  if (!target || !brand || brand.length === 0) return null;
  const tl: [number, number, number] = [
    srgbToLinear(target[0]),
    srgbToLinear(target[1]),
    srgbToLinear(target[2]),
  ];
  let best: BrandColor | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const b of brand) {
    const rgb = hexToRgb(b.hex);
    if (!rgb) continue;
    const dr = tl[0] - srgbToLinear(rgb[0]);
    const dg = tl[1] - srgbToLinear(rgb[1]);
    const db = tl[2] - srgbToLinear(rgb[2]);
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

/**
 * Map an inch value on a layout of `layoutIn` inches to `native` units, e.g.
 * `inchesToNative(6.665, 13.33, 1920) === 960`.
 */
export function inchesToNative(v: number, layoutIn: number, native: number): number {
  if (!Number.isFinite(layoutIn) || layoutIn === 0) return 0;
  return (v / layoutIn) * native;
}

/** Drop the `undefined`/falsy fields we don't want to serialise on a run. */
function cleanRun(text: string, o: Record<string, unknown>, colorRecorded: string | undefined, fallbackFont: string | undefined): TextRun {
  const run: TextRun = { text };
  if (o['bold'] === true) run.bold = true;
  if (o['italic'] === true) run.italic = true;
  if (colorRecorded) run.color = colorRecorded;
  const size = numOrUndef(o['fontSize']);
  if (size !== undefined) run.sizePt = size;
  const font = o['fontFace'] ?? fallbackFont;
  if (typeof font === 'string' && font) run.font = font;
  if (o['breakLine'] === true) run.breakLine = true;
  return run;
}

/**
 * Execute a pptxgenjs builder `source` against a capturing mock and return the
 * freeform deck it built. Never throws for well-formed scripts; a script that
 * `require`s anything other than `"pptxgenjs"`, or throws during execution,
 * surfaces as a thrown `Error` with a clear message.
 */
export function parsePptxGenJs(source: string): ParsedDeck {
  const palette: string[] = [];
  const seen = new Set<string>();

  /** Normalise + remember a colour; returns the normalised form (or undefined). */
  const recordColor = (raw: unknown): string | undefined => {
    const c = normalizeColor(raw);
    if (c && !seen.has(c)) {
      seen.add(c);
      palette.push(c);
    }
    return c;
  };

  // ── The capturing mock ────────────────────────────────────────────────────
  class MockSlide {
    readonly elements: DeckElement[] = [];
    private _bg: string | undefined;

    get background(): unknown {
      return this._bg;
    }
    set background(v: unknown) {
      const color = v && typeof v === 'object' ? (v as Record<string, unknown>)['color'] : v;
      this._bg = recordColor(color);
    }

    addText(text: unknown, opts?: Record<string, unknown>): this {
      const o = opts ?? {};
      const elFont = typeof o['fontFace'] === 'string' ? (o['fontFace'] as string) : undefined;
      const runs: TextRun[] = [];
      if (Array.isArray(text)) {
        for (const r of text) {
          const rObj = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
          const rOpts = (rObj['options'] && typeof rObj['options'] === 'object'
            ? rObj['options']
            : {}) as Record<string, unknown>;
          const color = recordColor(rOpts['color']);
          runs.push(cleanRun(String(rObj['text'] ?? ''), rOpts, color, elFont));
        }
      } else {
        const color = recordColor(o['color']);
        runs.push(cleanRun(String(text ?? ''), o, color, elFont));
      }
      // Capture a top-level colour even when it doesn't land on a run.
      recordColor(o['color']);

      const el: TextElement = {
        type: 'text',
        xIn: num(o['x']),
        yIn: num(o['y']),
        wIn: num(o['w']),
        hIn: num(o['h']),
        runs,
      };
      if (typeof o['align'] === 'string') el.align = o['align'];
      if (typeof o['valign'] === 'string') el.valign = o['valign'];
      if (elFont) el.fontFace = elFont;
      this.elements.push(el);
      return this;
    }

    addShape(type: unknown, opts?: Record<string, unknown>): this {
      const o = opts ?? {};
      const rawName = typeof type === 'string' && type ? type : 'rect';
      const shape = normalizeShape(rawName);
      const el: ShapeElement = {
        type: 'shape',
        shape,
        xIn: num(o['x']),
        yIn: num(o['y']),
        wIn: num(o['w']),
        hIn: num(o['h']),
      };
      if (rawName !== shape) el.rawShape = rawName;

      const fill = o['fill'];
      if (typeof fill === 'string') {
        const c = recordColor(fill);
        if (c) el.fill = c;
      } else if (fill && typeof fill === 'object') {
        const f = fill as Record<string, unknown>;
        if (f['type'] !== 'none') {
          const c = recordColor(f['color']);
          if (c) el.fill = c;
        }
      }

      const line = o['line'];
      if (line && typeof line === 'object') {
        const l = line as Record<string, unknown>;
        if (l['type'] !== 'none' && l['color'] !== undefined) {
          const c = recordColor(l['color']);
          const ln: ShapeLine = {};
          if (c) ln.color = c;
          const w = numOrUndef(l['width']);
          if (w !== undefined) ln.widthPt = w;
          if (ln.color || ln.widthPt !== undefined) el.line = ln;
        }
      }

      const radius = numOrUndef(o['rectRadius']);
      if (radius !== undefined) el.radius = radius;

      this.elements.push(el);
      return this;
    }

    addImage(opts?: Record<string, unknown>): this {
      const o = opts ?? {};
      const el: ImageElement = {
        type: 'image',
        xIn: num(o['x']),
        yIn: num(o['y']),
        wIn: num(o['w']),
        hIn: num(o['h']),
      };
      const src = o['path'] ?? o['data'];
      if (src !== undefined && src !== null) el.src = String(src);
      this.elements.push(el);
      return this;
    }

    // Inert no-ops so richer scripts don't throw. All pptxgenjs slide adders
    // are chainable.
    addTable(): this {
      return this;
    }
    addChart(): this {
      return this;
    }
    addNotes(): this {
      return this;
    }
    addMedia(): this {
      return this;
    }
    slideNumber(): this {
      return this;
    }
  }

  const decks: MockDeck[] = [];

  class MockDeck {
    // ShapeType: any property access yields the property name as a string,
    // exactly like `pptxgen.ShapeType.roundRect === "roundRect"`.
    readonly ShapeType: Record<string, string> = new Proxy(
      {},
      {
        get(_t, prop): string | undefined {
          return typeof prop === 'string' ? prop : undefined;
        },
      },
    ) as Record<string, string>;

    readonly slides: MockSlide[] = [];
    private readonly layouts = new Map<string, DeckLayout>();
    private _layoutName = 'LAYOUT_WIDE';

    constructor() {
      decks.push(this);
    }

    get layout(): string {
      return this._layoutName;
    }
    set layout(v: unknown) {
      this._layoutName = String(v);
    }

    defineLayout(def?: Record<string, unknown>): this {
      const d = def ?? {};
      const name = typeof d['name'] === 'string' ? (d['name'] as string) : '';
      const wIn = numOrUndef(d['width']);
      const hIn = numOrUndef(d['height']);
      if (name && wIn !== undefined && hIn !== undefined) {
        this.layouts.set(name, { wIn, hIn });
      }
      return this;
    }

    addSlide(): MockSlide {
      const s = new MockSlide();
      if (this.slides.length < MAX_SLIDES) this.slides.push(s);
      return s;
    }

    resolveLayout(): DeckLayout {
      const named = this.layouts.get(this._layoutName);
      if (named) return named;
      const preset = PRESET_LAYOUTS[this._layoutName];
      if (preset) return preset;
      // A script that defined exactly one custom layout but never assigned it.
      if (this.layouts.size === 1) {
        const only = [...this.layouts.values()][0];
        if (only) return only;
      }
      return DEFAULT_LAYOUT;
    }

    // Output sinks - inert thenables so `.writeFile().then()` chains resolve.
    writeFile(opts?: Record<string, unknown>): Promise<string> {
      const name = opts && typeof opts['fileName'] === 'string' ? (opts['fileName'] as string) : 'deck.pptx';
      return Promise.resolve(name);
    }
    write(): Promise<string> {
      return Promise.resolve('');
    }
    stream(): Promise<string> {
      return Promise.resolve('');
    }
    // Section/master helpers used by some builders - inert & chainable.
    addSection(): this {
      return this;
    }
    defineSlideMaster(): this {
      return this;
    }
  }

  // ── Execute the user script against the mock ──────────────────────────────
  const requireShim = (id: string): unknown => {
    if (id === 'pptxgenjs') return MockDeck;
    throw new Error(
      `pptxgen-import: this deck script requires('${id}'), but only 'pptxgenjs' is available to imported scripts`,
    );
  };

  const moduleObj: { exports: unknown } = { exports: {} };
  let runner: Function;
  try {
    runner = new Function('require', 'module', 'exports', source);
  } catch (e) {
    throw new Error(`pptxgen-import: could not parse deck script: ${(e as Error).message}`);
  }
  try {
    runner(requireShim, moduleObj, moduleObj.exports);
  } catch (e) {
    throw new Error(`pptxgen-import: deck script failed while running: ${(e as Error).message}`);
  }

  // ── Assemble the parsed deck ──────────────────────────────────────────────
  const deck = decks.find((d) => d.slides.length > 0) ?? decks[0];
  if (!deck) {
    return { layout: DEFAULT_LAYOUT, slides: [], palette };
  }

  const slides: DeckSlide[] = deck.slides.map((s) => {
    const bg = s.background;
    const slide: DeckSlide = { elements: s.elements };
    if (typeof bg === 'string' && bg) slide.background = bg;
    return slide;
  });

  return { layout: deck.resolveLayout(), slides, palette };
}
