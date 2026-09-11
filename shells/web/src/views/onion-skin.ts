// SPDX-License-Identifier: MPL-2.0
/**
 * onion-skin.ts - the OPT-IN ghost layer: faint outlines (or faint pictures) of the
 * scenes either side of the one on screen at the playhead.
 *
 * Default OFF, toggled explicitly, preference persisted by the timeline panel. This is
 * an animator's tool, not the default experience, and the research says why: no
 * mainstream NLE ghosts adjacent CLIPS, and that is not an oversight. A Lolly scene is
 * an opaque, full-canvas, brand-coloured composition that entirely REPLACES its
 * neighbour, so superimposing two at 30% produces colour mud and destroys the one thing
 * the viewer is judging. Which is also why the default mode here is `outline` (Adobe
 * Animate's *Onion Skin Outlines* precedent): a filled ghost has to sit UNDER an opaque
 * active scene, where it is invisible; an outline sits OVER it, where it stays legible.
 *
 * ── THE EXPORT CONTRACT (the reason this module exists as a separate layer) ──────────
 * A ghost must never reach a rendered file. Three INDEPENDENT guarantees, each with its
 * own test in onion-skin.test.ts:
 *
 *   1. The layer is a child of `.fc-overlay`, a STAGE SIBLING of `#tool-canvas` - it is
 *      outside the node `runtime.export` is ever handed.
 *   2. It carries `data-export-hide`, so bridge/export.ts's `detachExportHidden` REMOVES
 *      it from the DOM upstream of every format dispatch (including parseSequenceStage),
 *      even if an export node were ever widened to the whole stage.
 *   3. It never writes a class or an inline style to a `.lolly-box`. This is the one that
 *      needed a module: a `.seq-ghost` class setting `opacity:.3` on the real box would be
 *      baked straight into every exported plate, and we KNOW CSS-only hiding is not
 *      export-safe here because sequence-render.ts actively strips `.seq-off` before
 *      photographing each layer (otherwise dom-to-image clones `display:none` and
 *      rasterises blank). So this module only ever READS the live element - its
 *      `classList.contains` and an `<img>`'s `currentSrc` - and a source scan pins that.
 *
 * Deliberately NOT built on clip-thumbs' `nodeStill`: that shares a module-global
 * dom-to-image queue with `suspendNodeRasters()` / `drainNodeRasters()`, and a second
 * owner of that queue is a landmine for no proportionate gain. Filled mode uses the box's
 * own fill colour plus its already-browser-cached `<img>` URL - zero decode work. A video
 * box degrades to fill-only, an audio box draws nothing at all.
 *
 * Colour coding is the universal past = warm, but the future is Aseprite's cool BLUE
 * rather than Krita/Procreate/Animate's green: red/green is the worst possible pair for
 * deuteranopia and protanopia (~8% of men) and there is no reason to inherit it. The
 * redundant non-colour channel (WCAG 1.4.1) is a corner chip reading `-1` / `+1`, drawn
 * by CSS from `data-offset` - NOT a dash pattern, because dashed borders are reserved
 * for drop areas throughout this shell.
 */
import { num, type Box } from './free-canvas-math.ts';
import '../styles/parts/onion.css';

/** The two modes. `outline` is the default; `filled` is for animators who want the art. */
export type OnionMode = 'outline' | 'filled';

/**
 * The SPATIAL field names (free-canvas's own `cfg`), narrowed to what a ghost needs.
 * Structural, so the canvas hands over its resolved config unchanged.
 */
export interface OnionGeomCfg {
  idField: string;
  xField: string; yField: string; wField: string; hField: string;
  rotationField: string;
  radiusField?: string;
  fillField?: string;
  fitField?: string;
}

/** What `nativeToStage` needs, and nothing more - so a test can pass plain objects. */
export interface OnionMetrics {
  cr: { left: number; top: number };
  sr: { left: number; top: number };
  scale: number;
}

/** One paint. Shaped as the `tl-time` detail arrives, so the canvas forwards it as-is. */
export interface OnionPaintState {
  /** Anything other than 'outline' / 'filled' means OFF: the layer paints nothing. */
  mode?: unknown;
  past?: unknown;
  future?: unknown;
  /** Master ghost strength, 0…1. Absent reads as 1. */
  opacity?: unknown;
  /**
   * The ids on screen at the playhead (`tl-time`'s own `activeIds`), used ONLY to
   * detect the coincident case below. Absent reads as "nothing active", which simply
   * means no ghost escalates - the austere outline, exactly as before.
   */
  active?: unknown;
}

export interface MountOnionSkinOpts {
  /** `.fc-overlay` - the ghosts become its FIRST child, under every selection chrome. */
  overlayEl: HTMLElement;
  /** `#tool-canvas`, read-only: the live `.lolly-box` elements are the media source. */
  canvasEl: HTMLElement;
  cfg: OnionGeomCfg;
  getBoxes: () => Box[];
  metricsOf: () => OnionMetrics;
}

export interface OnionSkinHandle {
  paint(state: OnionPaintState | null | undefined): void;
  destroy(): void;
}

/** Below this the ghost is a smudge, not a shape - and its corner chip would not fit. */
const MIN_GHOST_PX = 2;
/** The `fit` values that map to a legal `object-fit`; anything else falls back. */
const FITS = new Set(['contain', 'cover', 'fill', 'none', 'scale-down']);

const clamp01 = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? (n < 0 ? 0 : n > 1 ? 1 : n) : 1;
};

/** Colour fields can be a bare string or the `{ value }` wrapper the colour input uses. */
const colorOf = (v: unknown): string => {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && 'value' in (v as Record<string, unknown>)) {
    const inner = (v as { value: unknown }).value;
    return typeof inner === 'string' ? inner : '';
  }
  return '';
};

const idList = (v: unknown): string[] =>
  (Array.isArray(v) ? v : []).map((x) => (x == null ? '' : String(x))).filter(Boolean);

export function mountOnionSkin(opts: MountOnionSkinOpts): OnionSkinHandle {
  const { overlayEl, canvasEl, cfg, getBoxes, metricsOf } = opts;
  const doc = overlayEl.ownerDocument;

  const layer = doc.createElement('div');
  layer.className = 'onion-layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.setAttribute('data-export-hide', '');
  layer.hidden = true;
  // FIRST child of the overlay: ghosts belong under the frame scrim and under every
  // piece of selection chrome, so nothing the user is actually manipulating is dimmed
  // by a ghost drawn on top of it.
  overlayEl.prepend(layer);

  let destroyed = false;

  /** The live boxes, by id - one pass of the model per paint. */
  function boxIndex(): Map<string, Box> {
    const out = new Map<string, Box>();
    for (const b of getBoxes()) {
      if (!b) continue;
      const v = b[cfg.idField];
      const id = v == null ? '' : String(v);
      if (id && !out.has(id)) out.set(id, b);
    }
    return out;
  }

  /**
   * The live `.lolly-box` elements, by id - READ ONLY. Nothing below writes to any of
   * these; the whole export contract rests on that (see the module doc, guarantee 3).
   */
  function liveIndex(): Map<string, Element> {
    const out = new Map<string, Element>();
    for (const el of canvasEl.querySelectorAll('.lolly-box[data-box-id]')) {
      const id = el.getAttribute('data-box-id') || '';
      if (id && !out.has(id)) out.set(id, el);
    }
    return out;
  }

  function ghostFor(
    box: Box, live: Element | undefined, offset: string, mode: OnionMode, m: OnionMetrics,
    coincident: boolean,
  ): HTMLElement | null {
    const w = num(box[cfg.wField], 0);
    const h = num(box[cfg.hField], 0);
    if (!(w >= MIN_GHOST_PX) || !(h >= MIN_GHOST_PX)) return null;
    // An audio box has no picture and no geometry worth outlining - sequence-studio
    // renders it as a `display:none` marker. Match sequence-plan.ts's reading: the
    // marker may BE the box element or sit inside it.
    if (live && (live.classList.contains('lolly-box-audio') || live.querySelector('.lolly-box-audio'))) return null;

    const x = num(box[cfg.xField], 0);
    const y = num(box[cfg.yField], 0);
    const g = doc.createElement('div');
    g.className = 'onion-ghost';
    g.setAttribute('data-offset', offset);
    // The same native→stage mapping free-canvas's own outlines use, from the metrics it
    // injects - so a ghost tracks pan and zoom exactly as the selection outline does.
    g.style.left = `${m.cr.left - m.sr.left + x * m.scale}px`;
    g.style.top = `${m.cr.top - m.sr.top + y * m.scale}px`;
    g.style.width = `${w * m.scale}px`;
    g.style.height = `${h * m.scale}px`;
    const rot = num(box[cfg.rotationField], 0);
    if (rot) g.style.transform = `rotate(${rot}deg)`;
    const radius = cfg.radiusField ? num(box[cfg.radiusField], 0) : 0;
    if (radius > 0) g.style.borderRadius = `${radius * m.scale}px`;

    // A ghost whose rect COINCIDES with the scene on screen is the one case an outline
    // cannot serve: the ring lands exactly on the active scene's own edge (and on the
    // other ghost's), so the feature reads as doing nothing at all. That is the normal
    // layout of a sequence - scenes are same-size, usually full-canvas - which is why
    // "onion skin does nothing" was the reasonable report. Here, and ONLY here, the
    // ghost shows the neighbour's PICTURE instead of its border: what an animator wants
    // from a coincident frame is what is in it, and there is no geometry left to draw.
    // The `filled` default stays outline everywhere the rects genuinely differ.
    if (mode === 'filled' || coincident) {
      // A data attribute, not a class: the module's source scan bans `classList.*`
      // outright (guarantee 3 - a class is the shape that would reach an exported
      // plate), and `data-offset` above is already the idiom for a per-ghost flag.
      if (coincident) g.setAttribute('data-coincident', '');
      const fill = cfg.fillField ? colorOf(box[cfg.fillField]) : '';
      if (fill) {
        const f = doc.createElement('div');
        f.className = 'onion-fill';
        f.style.background = fill;
        g.appendChild(f);
      }
      // The box's OWN <img>, at whatever URL the browser already has in cache. A video
      // box has no such element, so it degrades to the fill alone.
      const src = (live?.querySelector('img.lolly-box-img') as HTMLImageElement | null)?.currentSrc || '';
      if (src) {
        const img = doc.createElement('img');
        img.className = 'onion-img';
        img.src = src;
        img.alt = '';
        img.decoding = 'async';
        const fit = cfg.fitField ? String(box[cfg.fitField] ?? '') : '';
        img.style.objectFit = FITS.has(fit) ? fit : 'contain';
        g.appendChild(img);
      }
      // The box's OWN text element, CLONED - the same read-only borrow the <img> above
      // is, and the reason a text-driven scene ghosts as anything at all: a scene whose
      // whole content is a word has no fill worth 12% and no <img>, so fill+picture
      // alone came back empty. Cloning (rather than re-implementing align/valign/fit)
      // means the ghost says what the scene says, in the scene's own type. Ids are
      // stripped: a duplicate id in the document would capture the original's
      // references. The clone is laid out in NATIVE px and scaled as a unit, because
      // the box's font-size is native and the ghost's box is stage px.
      const textEl = live?.querySelector('.lolly-box-text');
      if (textEl) {
        const holder = doc.createElement('div');
        holder.className = 'onion-text';
        holder.style.width = `${w}px`;
        holder.style.height = `${h}px`;
        // PAST above, FUTURE below. Two coincident ghosts otherwise centre their words
        // on the active scene's and on each other - measured: "One"/"Two"/"Three" came
        // out as one unreadable smear, which is the colour-mud objection in text form.
        // Nudging is honest here in a way it would not be for a differing rect: the
        // geometry is identical BY DEFINITION in this branch, so there is no position
        // left to misreport, and a filmstrip reading (previous up, next down) is what
        // the vertical axis already means everywhere else in the editor.
        // The translate is in STAGE px because CSS applies it in the parent's space,
        // before the scale; the ghost's `overflow: hidden` clips a nudge that would
        // otherwise escape a top- or bottom-aligned box.
        const step = Math.abs(parseInt(offset, 10)) || 1;
        const shift = (offset.startsWith('-') ? -1 : 1) * Math.min(0.42, 0.25 * step) * h * m.scale;
        holder.style.transform = `translateY(${shift}px) scale(${m.scale})`;
        // The box's vertical/horizontal alignment lives as INLINE flex on the box
        // itself (free-canvas writes valign/align there), not on the text element - so
        // a clone dropped into a plain div lands at the top-left regardless of where
        // the scene puts it. Read the two values straight off the live element's style
        // object: no computed style, so this works identically under test.
        const ls = (live as HTMLElement | undefined)?.style;
        holder.style.justifyContent = ls?.justifyContent || '';
        holder.style.alignItems = ls?.alignItems || '';
        const clone = textEl.cloneNode(true) as HTMLElement;
        clone.removeAttribute('id');
        for (const sub of clone.querySelectorAll('[id]')) sub.removeAttribute('id');
        // The ghost's DIRECTION colour, not the scene's own - two coincident ghosts
        // otherwise draw the same-coloured words in the same place and turn to mush,
        // and a neighbour whose text colour matches the active scene's would vanish
        // entirely. Dropping the inline `color` is what lets the sheet's
        // `color: var(--onion-c)` through; the write is on the CLONE, never the live
        // node. Warm past / cool future stays the one reading across the feature.
        clone.style.removeProperty('color');
        for (const sub of clone.querySelectorAll<HTMLElement>('[style*="color"]')) sub.style.removeProperty('color');
        holder.appendChild(clone);
        g.appendChild(holder);
      }
    }
    return g;
  }

  function paint(state: OnionPaintState | null | undefined): void {
    if (destroyed) return;
    layer.textContent = '';
    const asked = state?.mode === 'filled' ? 'filled' : state?.mode === 'outline' ? 'outline' : '';
    if (!asked) { layer.hidden = true; return; }
    const past = idList(state?.past);
    const future = idList(state?.future);
    if (!past.length && !future.length) { layer.hidden = true; return; }

    // "Hide colourful previews" forces outlines. A filled ghost is exactly the colourful
    // preview noise that pref exists to remove, and the outline still carries all of the
    // information (which scene, which side, how far away).
    const hidden = doc.documentElement?.getAttribute('data-a11y-previews') === 'hidden';
    const mode: OnionMode = hidden ? 'outline' : asked;

    layer.hidden = false;
    layer.setAttribute('data-mode', mode);
    layer.style.setProperty('--onion-master', String(clamp01(state?.opacity)));

    const boxes = boxIndex();
    const live = liveIndex();
    const m = metricsOf();

    // The rects on screen at the playhead. A ghost matching one of them to within half
    // a model pixel is the coincident case ghostFor escalates. "Hide colourful previews"
    // suppresses the escalation outright rather than routing round it - that pref exists
    // to remove exactly the pictures escalating would add, and an austere invisible
    // outline is the honest answer when the user has asked for no previews.
    const activeRects = hidden ? [] : idList(state?.active)
      .map((id) => boxes.get(id))
      .filter((b): b is Box => !!b)
      .map((b) => [num(b[cfg.xField], 0), num(b[cfg.yField], 0),
                   num(b[cfg.wField], 0), num(b[cfg.hField], 0)] as const);
    const coincidesWithActive = (b: Box): boolean => {
      const x = num(b[cfg.xField], 0), y = num(b[cfg.yField], 0);
      const w = num(b[cfg.wField], 0), h = num(b[cfg.hField], 0);
      return activeRects.some((r) => Math.abs(r[0] - x) < 0.5 && Math.abs(r[1] - y) < 0.5
        && Math.abs(r[2] - w) < 0.5 && Math.abs(r[3] - h) < 0.5);
    };
    // `past`/`future` arrive NEAREST-first (onionNeighbours' contract), and the walk is
    // backwards so the furthest ghost is appended first: the nearest neighbour then
    // paints on top of the one behind it, which is the depth reading every onion-skin
    // implementation uses.
    const add = (ids: string[], sign: '-' | '+'): void => {
      for (let k = ids.length - 1; k >= 0; k--) {
        const box = boxes.get(ids[k]!);
        if (!box) continue;
        const g = ghostFor(box, live.get(ids[k]!), `${sign}${k + 1}`, mode, m, coincidesWithActive(box));
        if (g) layer.appendChild(g);
      }
    };
    add(past, '-');
    add(future, '+');
  }

  return {
    paint,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      layer.remove();
    },
  };
}
