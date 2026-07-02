// SPDX-License-Identifier: MPL-2.0
/**
 * Stage navigation for the tool view (finding 1): pinch/trackpad zoom + pan,
 * the mobile controls sheet, and the shared typing/motion/flick helpers they
 * (and mountTool) read. Extracted from tool.js unchanged.
 */

interface Point { x: number; y: number; }

export interface StageNav {
  reset(): void;
  isZoomed(): boolean;
  sync(): void;
  destroy(): void;
}

/**
 * Touch pinch-to-zoom + pan for the canvas stage.
 *
 * The page's native pinch-zoom is disabled (viewport user-scalable=no) so the
 * sticky sidebar header can't be stranded off-screen on mobile. To compensate,
 * the canvas preview gets gesture zoom here. It applies a transform to the OUTER
 * wrapper — fitCanvas only ever touches the inner canvas's width/height/transform,
 * so the two layers compose cleanly (fit-to-screen, then pinch on top of that).
 *
 * Returns { reset } so callers can snap back to the fitted view.
 */
// Unified canvas navigation for the stage: pinch-zoom + drag-pan on touch, and
// trackpad-native zoom/pan (+ a Fit/% HUD and keyboard shortcuts) on desktop.
// One module so both pointer types share a single transform model and never drift.
// The transform sits on the OUTER wrapper, layered on top of the fitCanvas scale;
// `scale` is a multiplier where 1 == the fitted view ("Fit").
export function setupStageNav(
  stageEl: HTMLElement,
  outerEl: HTMLElement,
  canvasEl: HTMLElement | null,
  nativeW: number,
  onFit: (() => void) | null | undefined,
): StageNav {
  const MIN = 1, MAX = 16;        // multiplier on top of the fitted view (Fit = 1)
  const PINCH_DEADZONE = 0.02;    // ignore <2% finger-spread wobble so a pan ≠ zoom
  let scale = 1, tx = 0, ty = 0;
  let originX = 0, originY = 0;   // outer's natural (untransformed) top-left, client coords
  const pts = new Map<number, Point>();  // pointerId -> { x, y }   (touch / pen)
  let pinchDist = 0;              // finger separation at the previous move
  let lastMid: Point | null = null;      // previous pinch midpoint (client coords)
  let panPt: Point | null = null;        // previous single-finger point (client coords)
  let lastTap = 0;
  let spaceDown = false;          // desktop: hold Space to drag-pan
  let mousePanPt: Point | null = null;   // desktop: previous mouse point while panning

  // transform-origin must be the top-left for the focal-point math below to hold
  // (CSS defaults to centre). fitCanvas never sets a transform on the outer wrapper.
  outerEl.style.transformOrigin = '0 0';

  const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
  const mid  = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  function apply(): void {
    outerEl.style.transform = (scale === 1 && tx === 0 && ty === 0)
      ? '' : `translate(${tx}px, ${ty}px) scale(${scale})`;
    syncHud();
  }

  // Recover the wrapper's natural top-left from its current rect + transform, so
  // the math works regardless of the flex centring that positions it in the stage.
  function captureOrigin(): void {
    const r = outerEl.getBoundingClientRect();
    originX = r.left - tx;
    originY = r.top  - ty;
  }

  // Keep the (scaled) content centre inside the stage so it can never be lost.
  function clampPan(): void {
    const sr = stageEl.getBoundingClientRect();
    const w  = outerEl.offsetWidth  * scale;
    const h  = outerEl.offsetHeight * scale;
    const cx = originX + tx + w / 2;
    const cy = originY + ty + h / 2;
    if (cx < sr.left)   tx += sr.left   - cx;
    if (cx > sr.right)  tx += sr.right  - cx;
    if (cy < sr.top)    ty += sr.top    - cy;
    if (cy > sr.bottom) ty += sr.bottom - cy;
  }

  function isZoomed(): boolean { return scale > 1.001 || tx !== 0 || ty !== 0; }
  function reset(): void { scale = 1; tx = 0; ty = 0; apply(); }
  // "Fit" = clear any zoom/pan, then recompute the fit for the current layout
  // (so it accounts for e.g. the mobile sheet's current coverage). reset() first
  // so isZoomed() is false and onFit's fitCanvas isn't skipped.
  function fit(): void { reset(); onFit?.(); }

  // Zoom by `factor`, keeping the client point (fx, fy) pinned under the cursor.
  function zoomAbout(factor: number, fx: number, fy: number): void {
    captureOrigin();
    const next = Math.max(MIN, Math.min(MAX, scale * factor));
    if (next === scale) return;
    const r = next / scale;
    const lx = fx - originX, ly = fy - originY;
    tx = lx - (lx - tx) * r;
    ty = ly - (ly - ty) * r;
    scale = next;
    clampPan();
    apply();
  }

  function stageCentre(): Point {
    const sr = stageEl.getBoundingClientRect();
    return { x: (sr.left + sr.right) / 2, y: (sr.top + sr.bottom) / 2 };
  }

  // Effective on-screen size vs native export pixels — the figure the HUD shows.
  function pct(): number {
    const w = canvasEl ? canvasEl.getBoundingClientRect().width : 0;
    return w > 0 ? Math.round(w / nativeW * 100) : 100;
  }

  // Jump to true 100% (1 CSS px per export px) about the stage centre.
  function actual(): void {
    const w = canvasEl ? canvasEl.getBoundingClientRect().width : 0;
    if (!(w > 0)) return;
    const c = stageCentre();
    zoomAbout(nativeW / w, c.x, c.y);
  }

  // ── Touch / pen: pinch-zoom + drag-pan (mouse stays free for click-to-focus) ──
  stageEl.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    captureOrigin();
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      if (!a || !b) return;
      pinchDist = dist(a, b);
      lastMid   = mid(a, b);
      panPt     = null;
    } else if (pts.size === 1) {
      panPt = { x: e.clientX, y: e.clientY };
      if (e.timeStamp - lastTap < 300 && scale > 1) { fit(); lastTap = 0; }  // double-tap → fit (sheet-aware)
      else lastTap = e.timeStamp;
    }
  });

  stageEl.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pts.size >= 2) {
      const [a, b] = [...pts.values()];
      if (!a || !b) return;
      const d = dist(a, b);
      const m = mid(a, b);
      if (lastMid) { tx += m.x - lastMid.x; ty += m.y - lastMid.y; }  // two-finger pan
      // Pinch-zoom with a dead-zone: ignore small finger-spread wobble so a
      // two-finger PAN doesn't register as zoom. (Without this, every frame
      // applied a tiny zoom about the moving midpoint and the jitter compounded —
      // "zooms like crazy" — while also fighting the pan so it felt sluggish.)
      // Hold pinchDist as the reference until we actually zoom, so a slow,
      // deliberate pinch still accumulates past the threshold and applies smoothly.
      if (pinchDist > 0 && Math.abs(d / pinchDist - 1) > PINCH_DEADZONE) {
        const next = Math.max(MIN, Math.min(MAX, scale * (d / pinchDist)));
        const r = next / scale;
        const fx = m.x - originX, fy = m.y - originY;
        tx = fx - (fx - tx) * r;   // zoom about the pinch midpoint
        ty = fy - (fy - ty) * r;
        scale = next;
        pinchDist = d;             // reset the reference only when we actually zoom
      }
      lastMid = m;
      clampPan();
      apply();
      e.preventDefault();
    } else if (pts.size === 1 && scale > 1 && panPt) {
      tx += e.clientX - panPt.x;
      ty += e.clientY - panPt.y;
      panPt = { x: e.clientX, y: e.clientY };
      clampPan();
      apply();
      e.preventDefault();
    }
  });

  const endTouch = (e: PointerEvent): void => {
    pts.delete(e.pointerId);
    if (pts.size < 2) { lastMid = null; pinchDist = 0; }
    if (pts.size === 1) {
      const [p] = [...pts.values()];
      if (p) panPt = { x: p.x, y: p.y };
    } else if (pts.size === 0) {
      panPt = null;
      if (scale <= 1.001) reset();   // settled back at fit — clear the transform
    }
  };
  stageEl.addEventListener('pointerup', endTouch);
  stageEl.addEventListener('pointercancel', endTouch);

  // Suppress native scroll/zoom on the stage so the gestures above own the touch.
  // Scoped here (not in CSS) so scrollable no-canvas tools keep normal touch scroll.
  stageEl.style.touchAction = 'none';

  // ── Desktop: trackpad-native zoom/pan + a Fit/% HUD + keyboard shortcuts ──────
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  let hud: HTMLDivElement | null = null, pctEl: HTMLElement | null = null;

  function syncHud(): void {
    if (pctEl) pctEl.textContent = pct() + '%';
    if (hud)   hud.dataset.zoomed = isZoomed() ? '1' : '';
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Space' && !isTyping()) { spaceDown = true; stageEl.classList.add('is-grabbable'); return; }
    if (isTyping()) return;
    if (e.key === '0')                       fit();                                              // Fit
    else if (e.key === '1')                  actual();                                           // 100%
    else if (e.key === '+' || e.key === '=') { const c = stageCentre(); zoomAbout(1.25, c.x, c.y); }
    else if (e.key === '-' || e.key === '_') { const c = stageCentre(); zoomAbout(0.8,  c.x, c.y); }
    else return;
    e.preventDefault();
  };
  const onKeyUp = (e: KeyboardEvent): void => { if (e.code === 'Space') { spaceDown = false; stageEl.classList.remove('is-grabbable'); } };

  // Zoom HUD (−  [NN%]  +  Fit) — created for EVERY pointer type. On touch it's the
  // primary way to snap to exact zoom levels and Fit (a pinch is imprecise); on
  // desktop it complements the trackpad/keyboard. The desktop-only wheel, mouse-pan
  // and keyboard wiring stays gated behind !isTouch further below.
  hud = document.createElement('div');
  hud.className = 'stage-nav';
  hud.innerHTML =
    '<button type="button" class="stage-nav-btn" data-nav="out" aria-label="Zoom out">−</button>' +
    '<button type="button" class="stage-nav-pct" data-nav="pct" aria-label="Toggle Fit and 100%"><span class="stage-nav-pct-val">100%</span></button>' +
    '<button type="button" class="stage-nav-btn" data-nav="in" aria-label="Zoom in">+</button>' +
    '<button type="button" class="stage-nav-btn stage-nav-fit" data-nav="fit" aria-label="Fit to window">Fit</button>';
  stageEl.appendChild(hud);
  pctEl = hud.querySelector('.stage-nav-pct-val');
  // Keep taps on the pill from reaching the stage's pinch / double-tap-to-fit logic.
  hud.addEventListener('pointerdown', e => e.stopPropagation());
  hud.addEventListener('click', e => {
    const b = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-nav]') : null;
    if (!b) return;
    const c = stageCentre();
    if (b.dataset.nav === 'in')       zoomAbout(1.25, c.x, c.y);
    else if (b.dataset.nav === 'out') zoomAbout(0.8,  c.x, c.y);
    else if (b.dataset.nav === 'fit') fit();
    else if (b.dataset.nav === 'pct') { if (isZoomed()) fit(); else actual(); }
  });

  if (!isTouch) {
    // Cmd/Ctrl-wheel (and trackpad pinch, which the browser delivers as ctrl+wheel)
    // zooms about the cursor; a plain wheel pans, but only once zoomed in (nothing
    // to pan at Fit). passive:false so we can preventDefault the page zoom/scroll.
    stageEl.addEventListener('wheel', e => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomAbout(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
      } else if (isZoomed()) {
        e.preventDefault();
        captureOrigin();
        tx -= e.deltaX; ty -= e.deltaY;
        clampPan(); apply();
      }
    }, { passive: false });

    // Pan with middle-drag or Space+left-drag; plain left-clicks stay free so the
    // canvas click-to-focus behaviour keeps working.
    stageEl.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse') return;
      if (!(e.button === 1 || (e.button === 0 && spaceDown))) return;
      e.preventDefault();
      stageEl.setPointerCapture(e.pointerId);
      mousePanPt = { x: e.clientX, y: e.clientY };
      stageEl.classList.add('is-grabbing');
    });
    stageEl.addEventListener('pointermove', e => {
      if (!mousePanPt || e.pointerType !== 'mouse') return;
      captureOrigin();
      tx += e.clientX - mousePanPt.x;
      ty += e.clientY - mousePanPt.y;
      mousePanPt = { x: e.clientX, y: e.clientY };
      clampPan(); apply();
    });
    const endMouse = (): void => {
      if (!mousePanPt) return;
      mousePanPt = null;
      stageEl.classList.remove('is-grabbing');
      if (!isZoomed()) reset();
    };
    stageEl.addEventListener('pointerup', endMouse);
    stageEl.addEventListener('pointercancel', endMouse);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }

  syncHud();

  function destroy(): void {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    hud?.remove();
  }

  return { reset, isZoomed, sync: syncHud, destroy };
}

// True when focus is in a text field, so global canvas shortcuts don't hijack typing.
export function isTyping(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el instanceof HTMLElement && el.isContentEditable);
}

// True only when focus is in a genuinely text-editable field (so Cmd+Z falls
// through to the browser's per-character undo). Deliberately NARROWER than
// isTyping: a focused range slider / colour / checkbox / number IS an <input>
// but has no native undo, so our input-history undo should still fire there.
export function isTextEditing(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  if ((el instanceof HTMLElement && el.isContentEditable) || el.tagName === 'TEXTAREA') return true;
  if (!(el instanceof HTMLInputElement)) return false;
  return ['text', 'search', 'url', 'tel', 'email', 'password'].includes((el.type || 'text').toLowerCase());
}

// Classify a vertical swipe as a flick. A flick is either fast (high velocity)
// or a long, decisive drag; small/slow moves are taps or jitter. Returns
// 1 (down), -1 (up), or 0 (neither). Shared by the controls sheet and the
// export popup so both surfaces feel the same.
export function flickDirection(dy: number, dt: number): -1 | 0 | 1 {
  const FAST = 0.35; // px/ms — a quick flick
  const FAR  = 48;   // px — a slow but decisive drag still counts
  if (Math.abs(dy) < 18) return 0;
  const v = dt > 0 ? Math.abs(dy) / dt : Infinity;
  if (v < FAST && Math.abs(dy) < FAR) return 0;
  return dy > 0 ? 1 : -1;
}

type SheetState = 'peek' | 'half' | 'full';

// Mobile only: drive the top-anchored controls panel via the grip on its bottom
// edge. Dragging sets an inline --sheet-h on the layout (the panel height + grip
// position read it live); the preview is a static full-screen backdrop the panel
// slides over. Releasing snaps to the nearest of peek/half/full. A plain tap on the
// grip steps through the stops with a bounce (peek↔half↔full), so half — both the
// controls and the preview in view — is always one tap from either extreme.
// Optional `onChange` fires on each move/snap (unused while the preview is static).
export function setupMobileSheet(
  layoutEl: HTMLElement,
  sidebarEl: HTMLElement,
  gripEl: HTMLElement,
  onChange: ((state?: SheetState) => void) | null | undefined,
): void {
  const SNAPS: readonly SheetState[] = ['peek', 'half', 'full'];
  const mq = window.matchMedia('(max-width: 640px)');
  let state: SheetState = 'half';
  let dragging = false, moved = false, tapMode = false, tapDir = 1, startY = 0, startH = 0;

  const vh = (): number => window.innerHeight;
  // Peek = the sheet's minimized height, which must equal the real header height
  // so the whole header (centered Tools pill + title row) shows, not just row 1.
  // Measured from headerEl below (it varies — e.g. 44px tap targets on touch);
  // 56 is only the pre-measurement fallback.
  let PEEK = 56;

  function setState(s: SheetState): void {
    state = s;
    layoutEl.style.removeProperty('--sheet-h'); // drop any drag override; the per-state var animates in
    layoutEl.dataset.sheet = s;
    onChange?.(s);
  }

  const endDrag = (): void => {
    if (!dragging) return;
    dragging = false;
    layoutEl.classList.remove('is-sheet-dragging');
    // We just dropped `transition: none` (used for 1:1 tracking). Flush layout so
    // the restored height/top transition is live at the CURRENT height before
    // setState changes it — otherwise the class-removal + height change batch into
    // one recalc and the snap jumps instead of animating.
    void sidebarEl.offsetHeight;
    if (!moved) {                                   // a press, not a drag
      if (tapMode) {
        // Tap walks the sheet through its stops with a bounce (peek↔half↔full),
        // reversing at the ends. So half — both the controls AND the preview
        // visible — is always one tap from either extreme, and you can always
        // recentre the divider after moving it; the sheet never jumps the full
        // span in a single tap.
        const idx = Math.max(0, SNAPS.indexOf(state));
        if (idx === 0) tapDir = 1;
        else if (idx === SNAPS.length - 1) tapDir = -1;
        const next = SNAPS[idx + tapDir];
        if (next) setState(next);
      } else {
        layoutEl.style.removeProperty('--sheet-h'); // header tap: no-op
      }
      return;
    }
    // Positional zones, no velocity: where the divider comes to rest decides the
    // dock. The screen splits into equal thirds and the divider's resting Y picks
    // the stop — release in the TOP third → dock to the top (peek, controls
    // minimised), the BOTTOM third → dock to the bottom (full, controls maximised),
    // the MIDDLE third → the 50/50 split (half). So a drag to the middle from
    // either extreme always lands on split, and a drag to the top stays at the top.
    const dividerY = sidebarEl.getBoundingClientRect().bottom; // grip rides the sheet's bottom edge
    const third = vh() / 3;
    if (dividerY < third)     return setState('peek');
    if (dividerY > third * 2) return setState('full');
    setState('half');
  };

  // Turn an element into a drag handle: the sheet follows the finger and snaps on
  // release. `tapToggles` gives the grip its tap-to-toggle; `guard` lets the
  // header ignore presses that land on a real control (its Tools link / toggle).
  function addDragHandle(handleEl: HTMLElement, { tapToggles = false, guard = null }: { tapToggles?: boolean; guard?: ((e: PointerEvent) => boolean) | null } = {}): void {
    handleEl.addEventListener('pointerdown', e => {
      if (!mq.matches || (guard && !guard(e))) return;
      dragging = true; moved = false; tapMode = tapToggles;
      startY = e.clientY;
      startH = sidebarEl.getBoundingClientRect().height;
      layoutEl.classList.add('is-sheet-dragging');
      handleEl.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    handleEl.addEventListener('pointermove', e => {
      if (!dragging) return;
      if (Math.abs(e.clientY - startY) > 4) moved = true;
      const h = Math.min(vh() * 0.92, Math.max(PEEK, startH + (e.clientY - startY))); // never below peek → grip stays visible
      layoutEl.style.setProperty('--sheet-h', h + 'px');
      onChange?.();
    });
    handleEl.addEventListener('pointerup', endDrag);
    handleEl.addEventListener('pointercancel', endDrag);
  }

  // The grip is the obvious handle; the header is the "wide blank area" the panel
  // wanted — grab anywhere on the title bar that isn't an actual control and drag
  // the sheet through its three stops.
  addDragHandle(gripEl, { tapToggles: true });
  const headerEl = sidebarEl.querySelector<HTMLElement>('.sidebar-header');
  if (headerEl) {
    addDragHandle(headerEl, {
      guard: e => !(e.target instanceof Element && e.target.closest('a, button, input, select, textarea, label')),
    });
    // Drive the peek height from the header's real height so the minimized sheet
    // shows the full two-row header (pill + title). Header height is content-based
    // and effectively constant per device, so a one-time measure suffices; --peek-h
    // feeds the CSS peek/preview-top vars (see the mobile sheet block).
    const h = Math.ceil(headerEl.getBoundingClientRect().height);
    if (h > 0) { PEEK = h; layoutEl.style.setProperty('--peek-h', h + 'px'); }
  }

  // The body is for scrolling the controls — nothing else. It deliberately has NO
  // drag/flick handler: a touch that lands on the inputs (or the gaps between them)
  // must only ever scroll the list, never resize or dock the sheet. The grip and
  // the header are the sole handles, so scrolling the controls can't collapse the
  // split view out from under you. Resizing happens by dragging the grip/header.

  layoutEl.dataset.sheet = state; // define the var; only consumed under the mobile media query
}

// Honour the OS "reduce motion" setting for the JS-driven scroll/reveal below.
// The global CSS reset zeroes CSS animations + scroll-behavior, but it can't reach
// an explicit JS scrollIntoView({behavior:'smooth'}) or a WAAPI tween — those have
// to be gated here.
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
