// SPDX-License-Identifier: MPL-2.0
/**
 * mountZoomHud - the −/readout/+/Fit canvas zoom control, shared by the tool
 * stage nav (.stage-nav), multi-edit's preview grid (.me-zoom) and the
 * catalog's asset inspector + crop dialog (.cat-zoom-hud). Extracted from
 * tool-stage-nav.ts, the richest of the four hand-rolled copies (it already
 * carried theme/sound toggle slots - kept here as `extras`).
 *
 * Each caller keeps its own container element/class (for positioning and the
 * pill's per-view skin - a fixed canvas overlay, an inline toolbar cluster, a
 * dialog-docked bar) and its own CSS chunk (these are lazy per-view imports,
 * so there's no single always-loaded stylesheet to hold one shared class);
 * what's unified is the markup shape, the click delegation, the disabled-state
 * rule at fixed bounds, and the destroy story. Per-view behavioural
 * differences that are real (not accidental drift) stay configurable:
 * whether there's a dedicated Fit button vs the readout doubling as reset,
 * where the Fit control lives, and whether the readout is itself a control (stage-nav
 * toggles Fit/Actual on it) or a plain live-region readout (multi-edit's
 * "N across" is announced, not clicked).
 *
 * Every button/label is built via DOM APIs (createElement + textContent/
 * setAttribute), never innerHTML string interpolation - so callers pass plain
 * translated strings straight through with no escape() footgun. `*Content`
 * options are the one exception: they're raw markup (an icon svg or a glyph),
 * set via innerHTML same as the trusted icon constants call sites already used.
 */

export interface ZoomHudClasses {
  /** Class for the − and + buttons (and the Fit button, composed alongside `fit`). */
  btn: string;
  /** Class for the readout element (button or span - see `pctInteractive`). */
  pct: string;
  /** Class for the dedicated Fit button, composed with `btn`. Omit to render no
   *  separate Fit button (the readout's own click is the reset action instead). */
  fit?: string;
  /** Separator class, only rendered when `extras` is non-empty. */
  sep?: string;
}

export interface ZoomHudOptions {
  /** Group aria-label for the HUD's `role="group"` container. */
  ariaLabel: string;
  classes: ZoomHudClasses;
  /** Step out (-1) or in (+1) - the caller owns the actual scale math/bounds. */
  onZoom(dir: -1 | 1): void;
  /** Fit / reset action: the Fit button's click, and the readout's own click
   *  when `onPct` isn't given. */
  onFit(): void;
  /** Overrides the readout's click (stage-nav toggles Fit vs true-100% instead
   *  of always jumping to Fit). Ignored when `pctInteractive` is false. */
  onPct?(): void;
  /** Whether the readout is itself a clickable control (button) or an inert,
   *  announced-only display (span). Default true. Multi-edit's "N across"
   *  readout has never been a control - keep it a span, not a button. */
  pctInteractive?: boolean;
  /** aria-live on the readout when it's a plain span (e.g. 'polite'). Ignored
   *  when `pctInteractive` is true (a button announces via its own click). */
  pctAriaLive?: string;
  /** Where the Fit button sits relative to −/readout/+. Default 'end' (multi-edit
   *  puts Fit first with 'start'); stage-nav uses 'middle' so Fit sits between −
   *  and + as the single reset control. Ignored when `classes.fit` is omitted. */
  fitPosition?: 'start' | 'middle' | 'end';
  /** Drop the readout entirely (no percent element). stage-nav does this: the
   *  readout doubled as a Fit/100% toggle, which read as a second Fit control, so
   *  the dedicated Fit button is now the only reset. setReadout() becomes a no-op. */
  noReadout?: boolean;
  /** Raw markup (icon svg or glyph) for each button - trusted, not escaped. */
  outContent?: string; inContent?: string; fitContent?: string;
  outAriaLabel?: string; inAriaLabel?: string; pctAriaLabel?: string; fitAriaLabel?: string;
  outTitle?: string; inTitle?: string; pctTitle?: string; fitTitle?: string;
  initialReadout?: string;
  /** Fixed bounds for the automatic disabled-state on setValue(). Omit to never
   *  disable the −/+ buttons - stage-nav's bounds are relative to the current
   *  fit and recomputed per canvas size, so a fixed range doesn't apply there. */
  min?: number;
  max?: number;
  /** Extra controls (theme/sound toggles) docked after a hairline separator - 
   *  createThemeToggle/createSoundToggle already emit `.stage-nav-btn`-classed
   *  elements expecting to sit here. */
  extras?: HTMLElement[];
  /** The data-* attribute used for click delegation (and, for stage-nav, for
   *  editor.css's mobile stacked-order rules). Defaults to a name private to
   *  this component so it can never collide with an ANCESTOR's own unrelated
   *  delegation on the same attribute - the catalog details modal already
   *  delegates its prev/next paging off a generic `closest('[data-nav]')`,
   *  which would otherwise swallow clicks on a HUD mounted inside it and page
   *  the asset instead of zooming. Only stage-nav opts into the shared
   *  'data-nav' name, where editor.css's `[data-nav="in|out|pct|fit"]`
   *  selectors expect it and no such ancestor delegation exists. */
  navAttr?: string;
}

const DEFAULT_NAV_ATTR = 'data-zoomhud-nav';

export interface ZoomHud {
  el: HTMLElement;
  /** Update the readout text (percent, "{n} across", whatever the caller formats). */
  setReadout(text: string): void;
  /** Refresh the −/+ disabled state against `min`/`max`. No-op if neither was given. */
  setValue(v: number): void;
  /** The HUD's dimmed/active visual cue (`[data-zoomed]`) - stage-nav shows the
   *  pill at full opacity while zoomed or focused, dimmed at rest. */
  setZoomed(zoomed: boolean): void;
  destroy(): void;
}

function makeButton(cls: string, navAttr: string, nav: string, content: string, aria?: string, title?: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.setAttribute(navAttr, nav);
  b.innerHTML = content;
  if (aria) b.setAttribute('aria-label', aria);
  if (title) b.title = title;
  return b;
}

export function mountZoomHud(container: HTMLElement, opts: ZoomHudOptions): ZoomHud {
  const { classes } = opts;
  const pctInteractive = opts.pctInteractive !== false;
  const navAttr = opts.navAttr ?? DEFAULT_NAV_ATTR;

  container.innerHTML = '';
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', opts.ariaLabel);

  const outBtn = makeButton(classes.btn, navAttr, 'out', opts.outContent ?? '−', opts.outAriaLabel, opts.outTitle);
  const inBtn  = makeButton(classes.btn, navAttr, 'in',  opts.inContent  ?? '+', opts.inAriaLabel,  opts.inTitle);

  let readoutEl: HTMLElement | null = null;
  if (!opts.noReadout) {
    if (pctInteractive) {
      readoutEl = makeButton(classes.pct, navAttr, 'pct', '', opts.pctAriaLabel, opts.pctTitle);
    } else {
      readoutEl = document.createElement('span');
      readoutEl.className = classes.pct;
      if (opts.pctAriaLive) readoutEl.setAttribute('aria-live', opts.pctAriaLive);
    }
    readoutEl.textContent = opts.initialReadout ?? '';
  }

  const fitBtn = classes.fit
    ? makeButton(`${classes.btn} ${classes.fit}`, navAttr, 'fit', opts.fitContent ?? 'Fit', opts.fitAriaLabel, opts.fitTitle)
    : null;

  const readout = readoutEl ? [readoutEl] : [];
  const order = fitBtn && opts.fitPosition === 'start' ? [fitBtn, outBtn, ...readout, inBtn]
    : fitBtn && opts.fitPosition === 'middle' ? [outBtn, fitBtn, inBtn, ...readout]
    : fitBtn ? [outBtn, ...readout, inBtn, fitBtn]
    : [outBtn, ...readout, inBtn];
  container.append(...order);

  if (opts.extras?.length) {
    if (classes.sep) {
      const sep = document.createElement('span');
      sep.className = classes.sep;
      sep.setAttribute('aria-hidden', 'true');
      container.append(sep);
    }
    container.append(...opts.extras);
  }

  // Keep taps on the pill from reaching whatever gesture layer sits under/behind
  // it (pinch/pan/click-to-focus, drag-to-crop) - stage-nav's original guard;
  // harmless where nothing overlaps.
  const onPointerDown = (e: PointerEvent): void => { e.stopPropagation(); };
  container.addEventListener('pointerdown', onPointerDown);

  const onClick = (e: MouseEvent): void => {
    const b = (e.target as HTMLElement).closest<HTMLElement>(`[${navAttr}]`);
    if (!b || !container.contains(b)) return;
    const nav = b.getAttribute(navAttr);
    if (nav === 'out') opts.onZoom(-1);
    else if (nav === 'in') opts.onZoom(1);
    else if (nav === 'fit') opts.onFit();
    else if (nav === 'pct') (opts.onPct ?? opts.onFit)();
  };
  container.addEventListener('click', onClick);

  function setReadout(text: string): void { if (readoutEl) readoutEl.textContent = text; }
  function setValue(v: number): void {
    if (opts.min !== undefined) outBtn.disabled = v <= opts.min;
    if (opts.max !== undefined) inBtn.disabled = v >= opts.max;
  }
  function setZoomed(zoomed: boolean): void { container.dataset.zoomed = zoomed ? '1' : ''; }
  function destroy(): void {
    container.removeEventListener('pointerdown', onPointerDown);
    container.removeEventListener('click', onClick);
    container.innerHTML = '';
    delete container.dataset.zoomed;
  }

  return { el: container, setReadout, setValue, setZoomed, destroy };
}
