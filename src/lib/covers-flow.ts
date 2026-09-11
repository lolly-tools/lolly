// SPDX-License-Identifier: MPL-2.0
/**
 * The landing's Cover Flow (plans/177 beat 2) - ONE source for both surfaces.
 * docs/build.ts bundles this file with esbuild into the static /info page's
 * inline covers script, and lib/docs-landing.ts imports it for the in-app
 * reader at #/docs/index. The pure geometry helper is shared with the app carousel; the static bundle
 * stays independent of the app runtime.
 *
 * The motion model is the app gallery's own (components/featured-row.ts): the
 * strip is a real horizontal scroller whose scrollLeft is the single source of
 * truth, and each cover's transform is a pure function of its LAYOUT offset
 * from the viewport centre - offsetLeft/offsetWidth are transform-independent,
 * so there is no feedback loop. One rAF loop owns scrollLeft in three states:
 *   1. dragging  - the pointer sets it (mouse, pen and touch alike; the strip
 *                  is touch-action: pan-y in fan mode so vertical stays with
 *                  the page);
 *   2. coasting  - a flick release or a horizontal wheel spin decays with
 *                  friction ("wheel physics");
 *   3. settling  - ease onto the chosen cover (a dot, an arrow, a key, the
 *                  autoplay, a side click) or, with none chosen, the nearest.
 * CSS scroll-snap is OFF in fan mode. A snap area is the TRANSFORMED border
 * box, so native snap chased the tuck every frame and fought both the settle
 * and the drag (the 2026-09-02 "buggy sideways scroll and drag"). Native
 * horizontal scrolling is off too (overflow-x: hidden in fan mode): WebKit on an
 * iPad would otherwise run its own momentum scroll on the same scroller the
 * pointer handlers are driving, and the two fighting over scrollLeft is what
 * read as "jerky". A script can still set scrollLeft on a hidden-overflow box,
 * which is all this model needs. The fan runs at every width (Andy, 2026-09-03:
 * "now that the coverflow effect is stable we can have it on mobile also") -
 * the scroll-snap filmstrip underneath is what a reader with scripts off gets,
 * and what the markup means on its own.
 *
 * The fan is a LOOP. Sixteen covers are enough to never show an end, so the
 * module clones the last few covers in front of the strip and the first few
 * after it (clones carry a poster in place of a video and are hidden from the
 * accessibility tree), and whenever the centred cover is a clone the scroll
 * position is re-based by one period - the clone and its original are pixel
 * identical, so the jump is invisible. Dots, the Open button and autoplay all
 * work in REAL indices; only the geometry knows about clones.
 *
 * Markup contract (docs/build.ts, covers.json): #coversRoot > #coversStrip >
 * a.cover-card[href][data-hue] with .cover-cap b (the name) - the module adds
 * a.cover-card.is-clone siblings around them; .covers-nav with
 * [data-covers=prev|next] + .covers-dots; .covers-open-btn[data-tpl] whose
 * first child span takes the label. Cards are pointer-events:none in the fan
 * (a z-translated plane is not hit-testable - featured-row.ts's finding), so
 * the ONE clickable control is the Open button outside the 3-D context, and
 * a press on a side cover is mapped by geometry to centre it.
 *
 * Where the fan OPENS: the covers are posed a hue apart (scripts/build-covers.ts
 * - each one is the app wearing a derived design system, so the strip reads as
 * a rainbow), and `data-hue` carries each pose's OKLCH hue. The first cover
 * shown is the one nearest the reader's own accent: the loaded design system's
 * primary (`--brand-primary`, which brand-vars.ts sets on :root in the app and
 * mirrors to localStorage for the static /info page on the same origin), else
 * Lolly's own green. A visitor with a violet brand meets the violet cover first;
 * a fresh visitor (or one on the ink-and-paper starter, which has no hue) meets
 * the Design cover, posed at Lolly's hue.
 */

import { COVERFLOW_TUCK as CF_TUCK, coverflowPose } from './coverflow-geometry.ts';

const WHEEL_TO_VELOCITY = 14;   // px/s of spin per unit of horizontal wheel delta
const MAX_VELOCITY = 3200;      // px/s cap so a wild flick cannot teleport the strip
const INERTIA_FRICTION = 0.94;  // velocity decay per ~16.7 ms frame
const INERTIA_MIN_V = 6;        // px/s; below this the coast is over
const EASE_PER_SEC = 12;        // settle ease rate (time-based)
const DRAG_SLOP = 8;            // px a press may travel and still count as a click
const REST_MS = 900;            // a cover must rest centred this long before Open appears
const HOLD_MS = 12000;          // autoplay pause after any hand input
const AUTOPLAY_MS = 4500;
const LOOP_CLONES = 10;         // covers cloned on each side; 10 × the tucked pitch covers a 4K viewport
const OFFSCREEN_SLACK = 1.5;    // covers this many tucked pitches past the viewport edge skip the per-frame transform

interface Geom { el: HTMLElement; center: number; w: number; vc: number }

/**
 * Which way to re-base the loop: the strip holds `clones` copies of the tail,
 * then the `n` real covers, then `clones` copies of the head. With the centred
 * cover at absolute index `cur`, +1 means "jump one period forward" (a tail clone
 * is centred, the real cover a period later must take over), -1 the reverse, 0
 * when a real cover is centred.
 */
export function loopShift(cur: number, clones: number, n: number): -1 | 0 | 1 {
  if (cur < clones) return 1;
  if (cur >= clones + n) return -1;
  return 0;
}

/** The real cover an absolute strip index shows (a clone maps to its original). */
export function realIndexOf(cur: number, clones: number, n: number): number {
  return (((cur - clones) % n) + n) % n;
}

/** localStorage mirror of the loaded design system's light primary (brand-vars.ts
 *  writes it, hex) - how the static landing, which has no brand of its own, learns
 *  the reader's accent. Same-origin with the app, so the key is shared. */
const ACCENT_MIRROR_KEY = 'brand-accent';

/** OKLCH hue (degrees) of an sRGB colour - the same hue space the poses are
 *  spaced in, so "nearest cover" compares like with like. Ottosson's OKLab. */
function oklchHue(r: number, g: number, b: number): number | null {
  const lin = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  if (Math.hypot(a, bb) < 0.02) return null;   // a grey has no hue worth steering by
  const h = (Math.atan2(bb, a) * 180) / Math.PI;
  return h < 0 ? h + 360 : h;
}

function hexHue(hex: string): number | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let s = m[1]!;
  if (s.length === 3) s = s.replace(/./g, (ch) => ch + ch);
  const n = parseInt(s, 16);
  return oklchHue(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Lolly's own green (Pine, #30ba78) in OKLCH - where a reader with no chromatic
 *  brand is sent. The Design cover is posed at 157.5° for exactly this reason. */
const LOLLY_HUE = 157.2;

/** The reader's accent hue: the loaded design system's primary first (live var,
 *  then the mirror), else Lolly's own. A grey brand (the starter's ink) has no
 *  hue to steer by and takes the default too. */
function readerHue(): number {
  const brand = getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim();
  if (brand) { const h = hexHue(brand); if (h != null) return h; }
  let mirror = '';
  try { mirror = localStorage.getItem(ACCENT_MIRROR_KEY) ?? ''; } catch { /* storage blocked */ }
  if (mirror) { const h = hexHue(mirror); if (h != null) return h; }
  return LOLLY_HUE;
}

/** Index of the cover whose posed hue is nearest `hue` on the circle; 0 without hues. */
export function nearestCoverIndex(hues: ReadonlyArray<number | null>, hue: number | null): number {
  if (hue == null) return 0;
  let best = 0;
  let bd = Infinity;
  hues.forEach((h, i) => {
    if (h == null || !Number.isFinite(h)) return;
    const d = Math.abs((((h - hue) % 360) + 540) % 360 - 180);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

export function mountCoverFlow(root: ParentNode): void {
  const rootFound = root.querySelector<HTMLElement>('#coversRoot');
  const stripFound = root.querySelector<HTMLElement>('#coversStrip');
  if (!rootFound || !stripFound) return;
  const sectionFound = rootFound.closest<HTMLElement>('.covers-section');
  const navFound = rootFound.querySelector<HTMLElement>('.covers-nav');
  const dotsFound = rootFound.querySelector<HTMLElement>('.covers-dots');
  if (!sectionFound || !navFound || !dotsFound) return;
  if (rootFound.dataset.coversMounted) return;   // a second hydrate reuses the first
  rootFound.dataset.coversMounted = '1';
  // Re-bound as plain HTMLElements so the closures below need no null checks.
  const rootEl: HTMLElement = rootFound;
  const strip: HTMLElement = stripFound;
  const section: HTMLElement = sectionFound;
  const nav: HTMLElement = navFound;
  const dots: HTMLElement = dotsFound;
  const openBtn = rootEl.querySelector<HTMLAnchorElement>('.covers-open-btn');
  // The REAL covers, in covers.json order. Clones are added below and only the
  // geometry sees them; everything user-facing indexes this array.
  const cards = [...strip.querySelectorAll<HTMLElement>('.cover-card:not(.is-clone)')];
  const n = cards.length;
  if (n < 3) return;
  const hues = cards.map((c) => { const v = parseFloat(c.dataset.hue ?? ''); return Number.isFinite(v) ? v : null; });
  const startIdx = nearestCoverIndex(hues, readerHue());
  if (startIdx !== 0) cards.forEach((c, i) => c.classList.toggle('is-cur', i === startIdx));

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // The animated covers are muted looping clips; under reduced motion they hold
  // their poster frame instead of playing.
  const videos = cards.map((el) => el.querySelector('video'));
  // Playback is this module's to decide from here: videoPolicy runs the clips
  // (all of them, for now). The autoplay attribute would otherwise restart a
  // clip the policy just paused (reduced motion) as soon as its metadata arrives.
  videos.forEach((v) => { if (v) { v.removeAttribute('autoplay'); v.autoplay = false; if (reduced) v.pause(); } });

  // ── The loop: clones of the tail before the strip, clones of the head after ──
  // A clone is a poster-only copy (three playing videos are plenty for a tablet;
  // a clone at the edge never needs to move) and is out of the accessibility
  // tree and the tab order. The filmstrip hides them in CSS.
  const K = Math.min(n, LOOP_CLONES);
  const cloneOf = (card: HTMLElement): HTMLElement => {
    const c = card.cloneNode(true) as HTMLElement;
    c.classList.add('is-clone');
    c.classList.remove('is-cur');
    c.removeAttribute('data-i');
    c.removeAttribute('id');
    c.setAttribute('aria-hidden', 'true');
    c.setAttribute('tabindex', '-1');
    const v = c.querySelector('video');
    if (v) {
      const img = document.createElement('img');
      const poster = v.getAttribute('poster');
      if (poster) img.setAttribute('src', poster);
      img.setAttribute('alt', '');
      img.setAttribute('loading', 'lazy');
      img.setAttribute('decoding', 'async');
      v.replaceWith(img);
    }
    return c;
  };
  if (!strip.querySelector('.is-clone')) {
    const head = cards.slice(n - K).map(cloneOf);
    const tail = cards.slice(0, K).map(cloneOf);
    head.forEach((c) => strip.insertBefore(c, cards[0]!));
    tail.forEach((c) => strip.appendChild(c));
  }
  const all = [...strip.querySelectorAll<HTMLElement>('.cover-card')];   // K + n + K, strip order
  const real = (i: number): number => realIndexOf(i, K, n);

  let fan = false;
  let geom: Geom[] = [];
  let period = 0;                 // strip distance between a cover and its clone one loop away
  let raf = 0;
  let lastTs = 0;
  let velocity = 0;
  let snapTarget: number | null = null;
  let dragging = false;
  let dragMoved = false;
  let dragPointerId = -1;
  let dragStartX = 0;
  let lastPointerX = 0;
  let lastMoveTs = 0;
  let pendingDx = 0;              // pointer travel not yet applied - flushed once per frame
  let hold = 0;
  let hov = false;
  let lastCur = -1;               // REAL index last laid out as current
  let restT: ReturnType<typeof setTimeout> | 0 = 0;
  let wheelSettleT: ReturnType<typeof setTimeout> | 0 = 0;

  const dotEls: HTMLButtonElement[] = [];
  if (!dots.childElementCount) {
    cards.forEach((c, i) => {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'covers-dot';
      d.setAttribute('role', 'tab');
      d.setAttribute('aria-label', c.querySelector('.cover-cap b')?.textContent ?? String(i + 1));
      d.addEventListener('click', () => goReal(i));
      dots.appendChild(d);
      dotEls.push(d);
    });
  }

  const clampV = (v: number): number => Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, v));
  const half = (): number => strip.clientWidth / 2;
  const centerOf = (i: number): number => (geom[i]?.center ?? 0) - half();

  /** Snapshot the layout geometry once per (re)layout so the hot loop is write-only. */
  function measure(): void {
    geom = all.map((el) => {
      const w = el.offsetWidth || 1;
      return { el, w, center: el.offsetLeft + w / 2, vc: el.offsetLeft + w / 2 };
    });
    period = (geom[K + n]?.center ?? 0) - (geom[K]?.center ?? 0);
  }

  /** Absolute strip index of the cover nearest the viewport centre. */
  function curIndex(): number {
    const focus = strip.scrollLeft + half();
    let best = 0;
    let bd = Infinity;
    geom.forEach((g, i) => {
      const d = Math.abs(g.center - focus);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  /** Keep the centred cover a REAL one: when a clone is centred, jump a whole
   *  period so its original takes over. Pixel-identical, so nothing visible
   *  moves; the settle target and the drag both ride the same shift. */
  function rebase(): void {
    if (!period) return;
    const shift = loopShift(curIndex(), K, n) * period;
    if (!shift) return;
    strip.scrollLeft += shift;
    if (snapTarget !== null) snapTarget += shift;
  }

  function nearestTarget(): number {
    const h = half();
    let best = strip.scrollLeft;
    let bd = Infinity;
    for (const g of geom) {
      const target = g.center - h;
      const dist = Math.abs(target - strip.scrollLeft);
      if (dist < bd) { bd = dist; best = target; }
    }
    return best;
  }

  function showOpen(r: number): void {
    if (!openBtn) return;
    const card = cards[r]!;
    openBtn.setAttribute('href', card.getAttribute('href') ?? '#');
    const label = openBtn.firstElementChild;
    if (label) {
      label.textContent = (openBtn.getAttribute('data-tpl') || 'Open {name}')
        .replace('{name}', card.querySelector('.cover-cap b')?.textContent ?? '');
    }
    openBtn.classList.add('is-on');
  }

  /** Every real clip plays (the clones hold posters, so at most the four
   *  posed loops decode at once); Andy 2026-09-03: try them all playing and
   *  see how it performs - if a tablet struggles, narrow this back to the
   *  centred clip and its two neighbours (`d <= 1` on the ring distance). */
  function videoPolicy(_r: number): void {
    if (reduced) return;
    videos.forEach((v) => {
      if (!v) return;
      if (v.paused) void v.play().catch(() => { /* autoplay policy */ });
    });
  }

  function layout(): void {
    if (!fan) return;
    const focus = strip.scrollLeft + half();
    const cur = curIndex();   // decided BEFORE the pass, so exactly one cover is current
    // How many tucked pitches the viewport edge is from the centre, plus slack:
    // a cover beyond that is not drawn at all - no transform write, no
    // compositing - which keeps a 36-card loop as cheap as the handful it shows,
    // and still fills a 4K screen edge to edge.
    const cutoff = half() / ((geom[0]?.w ?? 1) * CF_TUCK) + OFFSCREEN_SLACK;
    geom.forEach((g, i) => {
      const d = (g.center - focus) / g.w;
      const ad = Math.abs(d);
      if (ad > cutoff) {
        if (g.el.style.visibility !== 'hidden') g.el.style.visibility = 'hidden';
        return;
      }
      if (g.el.style.visibility) g.el.style.visibility = '';
      const pose = coverflowPose(d, g.w);
      g.el.style.transform = pose.transform;
      g.el.style.zIndex = pose.zIndex;
      g.vc = g.center + pose.tuck;
    });
    const r = real(cur);
    if (r !== lastCur) {
      // Attribute and class writes only when the centred cover actually changes -
      // a style recalc per frame across every card is what a tablet feels.
      lastCur = r;
      all.forEach((el, i) => {
        const isCur = i === cur;
        el.classList.toggle('is-cur', isCur);
        if (!el.classList.contains('is-clone')) el.setAttribute('aria-hidden', isCur ? 'false' : 'true');
      });
      dotEls.forEach((d, i) => d.setAttribute('aria-current', i === r ? 'true' : 'false'));
      videoPolicy(r);
      clearTimeout(restT);
      openBtn?.classList.remove('is-on');
      // Quiet while the fan moves, an invitation once it settles.
      restT = setTimeout(() => showOpen(r), REST_MS);
    }
  }

  // ── The motion loop ─────────────────────────────────────────────────────
  function loop(): void { if (!raf) raf = requestAnimationFrame(tick); }
  function tick(ts: number): void {
    raf = 0;
    if (!fan || !rootEl.isConnected) { lastTs = 0; return; }
    const dt = lastTs ? Math.min(200, ts - lastTs) : 0;
    lastTs = ts;
    if (dragging) {
      // Pointer travel is applied HERE, once per frame, however many move events
      // arrived - a 120 Hz pointer on a 60 Hz screen otherwise writes scrollLeft
      // twice a frame and WebKit renders the in-between.
      if (pendingDx) { strip.scrollLeft -= pendingDx; pendingDx = 0; }
      rebase();
      layout();
      loop();
      return;
    }
    if (Math.abs(velocity) > INERTIA_MIN_V) {
      strip.scrollLeft += (velocity * dt) / 1000;
      velocity = clampV(velocity * INERTIA_FRICTION ** (dt / 16.67));
      if (Math.abs(velocity) < INERTIA_MIN_V) velocity = 0;
      rebase();
      layout();
      loop();
      return;
    }
    const target = snapTarget ?? nearestTarget();
    const diff = target - strip.scrollLeft;
    if (Math.abs(diff) < 0.5 || reduced) {
      strip.scrollLeft = target;
      snapTarget = null;
      rebase();
      layout();
      lastTs = 0;
      return;                                   // at rest: the loop stops here
    }
    strip.scrollLeft += diff * Math.min(1, (dt / 1000) * EASE_PER_SEC);
    rebase();
    layout();
    loop();
  }

  /** Ease onto an ABSOLUTE strip index (a neighbour of the current one, usually). */
  function go(i: number): void {
    if (!fan) return;
    i = Math.max(0, Math.min(all.length - 1, i));
    hold = Date.now() + HOLD_MS;
    velocity = 0;
    snapTarget = centerOf(i);
    loop();
  }
  /** Ease onto a REAL cover by the shortest way round the loop. */
  function goReal(r: number): void {
    const cur = curIndex();
    let best = K + r;
    for (const cand of [K + r - n, K + r, K + r + n]) {
      if (cand >= 0 && cand < all.length && Math.abs(cand - cur) < Math.abs(best - cur)) best = cand;
    }
    go(best);
  }

  function enterFan(): void {
    // The reader's-hue cover sits centred when the fan opens.
    const keep = K + startIdx;
    fan = true;
    section.classList.add('covers--fan');
    nav.hidden = false;
    all.forEach((el) => el.setAttribute('draggable', 'false'));
    measure();
    strip.scrollLeft = centerOf(keep);
    lastCur = -1;
    layout();
  }
  enterFan();

  addEventListener('resize', () => {
    if (!fan) return;
    const cur = curIndex();
    measure();
    strip.scrollLeft = centerOf(cur);
    snapTarget = null;
    rebase();
    layout();
  }, { passive: true });
  // A scroll that slips past the model (keyboard scrolling of the scroller under
  // the last click, focus scrolling) repaints the fan from the new position and,
  // once it stops, settles onto the nearest cover.
  let nativeSettleT: ReturnType<typeof setTimeout> | 0 = 0;
  strip.addEventListener('scroll', () => {
    if (!fan || raf || dragging) return;
    layout();
    clearTimeout(nativeSettleT);
    nativeSettleT = setTimeout(() => { if (!raf && !dragging) { snapTarget = nearestTarget(); loop(); } }, 120);
  }, { passive: true });

  // ── Input ────────────────────────────────────────────────────────────────
  rootEl.querySelector('[data-covers="prev"]')?.addEventListener('click', () => go(curIndex() - 1));
  rootEl.querySelector('[data-covers="next"]')?.addEventListener('click', () => go(curIndex() + 1));
  rootEl.addEventListener('keydown', (e) => {
    rootEl.removeAttribute('data-focus-by');
    if (!fan) return;
    if (e.key === 'ArrowLeft') { go(curIndex() - 1); e.preventDefault(); }
    if (e.key === 'ArrowRight') { go(curIndex() + 1); e.preventDefault(); }
  });

  // Horizontal wheel (trackpad swipe) spins the fan with momentum; a vertical
  // wheel ALWAYS falls through to the page - the strip never captures it.
  strip.addEventListener('wheel', (e) => {
    if (!fan) return;
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    hold = Date.now() + HOLD_MS;
    snapTarget = null;
    if (reduced) {
      // No momentum: move with the hand, then snap once it stops.
      strip.scrollLeft += e.deltaX;
      rebase();
      layout();
      clearTimeout(wheelSettleT);
      wheelSettleT = setTimeout(() => { snapTarget = nearestTarget(); loop(); }, 150);
      return;
    }
    velocity = clampV(velocity + e.deltaX * WHEEL_TO_VELOCITY);
    loop();
  }, { passive: false });

  strip.addEventListener('pointerdown', (e) => {
    if (!fan) return;
    if (e.pointerType !== 'touch' && e.button !== 0 && e.button !== 1) return;
    velocity = 0;
    snapTarget = null;
    dragging = true;
    dragMoved = false;
    dragPointerId = e.pointerId;
    dragStartX = e.clientX;
    lastPointerX = e.clientX;
    lastMoveTs = performance.now();
    pendingDx = 0;
    hold = Date.now() + HOLD_MS;
    section.classList.add('covers--dragging');
    try { strip.setPointerCapture(e.pointerId); } catch { /* best effort */ }
    // Mouse and pen: stop the browser's own drag/select. A touch keeps its default
    // so touch-action: pan-y can still hand a vertical swipe to the page.
    if (e.pointerType !== 'touch') e.preventDefault();
    loop();
  });
  // A middle press must pan, not engage the browser's autoscroll.
  strip.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
  strip.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== dragPointerId) return;
    const now = performance.now();
    const dx = e.clientX - lastPointerX;
    if (Math.abs(e.clientX - dragStartX) > DRAG_SLOP) dragMoved = true;
    pendingDx += dx;
    const dtm = now - lastMoveTs;
    if (dtm > 0) velocity = clampV(velocity * 0.7 + ((-dx / dtm) * 1000) * 0.3);
    lastPointerX = e.clientX;
    lastMoveTs = now;
    if (e.pointerType !== 'touch') e.preventDefault();
  });
  const endDrag = (e: PointerEvent): void => {
    if (!dragging || e.pointerId !== dragPointerId) return;
    dragging = false;
    dragPointerId = -1;
    section.classList.remove('covers--dragging');
    if (pendingDx) { strip.scrollLeft -= pendingDx; pendingDx = 0; rebase(); }
    // Take focus on RELEASE: Chrome's own press handling still moves focus to
    // the body after a cancelled pointerdown, so a focus() there is undone by
    // the time the keys arrive. After the release it sticks, and the region's
    // arrow-key handler owns the strip from here (no scroll jump). The focus is
    // marked as pointer-made so the stylesheet can hold back the keyboard ring
    // (browsers differ on whether a scripted focus() after a click gets one -
    // Andy saw the whole fan outlined after a drag); the mark clears on the
    // first key or when focus leaves, so keyboard users still see the ring.
    if (e.pointerType !== 'touch') { rootEl.setAttribute('data-focus-by', 'pointer'); rootEl.focus({ preventScroll: true }); }
    // A slow release (the hand already at rest) stops dead; only a real throw
    // coasts. A cancelled pointer (the page took the gesture for a vertical
    // scroll) coasts with whatever it had - stopping dead there is the jolt.
    if (reduced || (e.type === 'pointerup' && performance.now() - lastMoveTs > 80)) velocity = 0;
    if (!dragMoved && e.type === 'pointerup' && e.button === 0) {
      // Cards are pointer-events:none, so map the press to a cover by its DRAWN
      // centre (layout centre + this frame's tuck) and centre that cover.
      const x = e.clientX - strip.getBoundingClientRect().left + strip.scrollLeft;
      let bi = -1;
      let bd = Infinity;
      geom.forEach((g, i) => {
        const d = Math.abs(g.vc - x);
        if (d < bd) { bd = d; bi = i; }
      });
      if (bi >= 0 && bi !== curIndex()) { go(bi); return; }
    }
    loop();
  };
  strip.addEventListener('pointerup', endDrag);
  strip.addEventListener('pointercancel', endDrag);

  rootEl.addEventListener('mouseenter', () => { hov = true; });
  rootEl.addEventListener('mouseleave', () => { hov = false; });
  rootEl.addEventListener('focusin', () => { hov = true; });
  rootEl.addEventListener('focusout', () => { hov = false; rootEl.removeAttribute('data-focus-by'); });

  if (!reduced) {
    const timer = setInterval(() => {
      if (!rootEl.isConnected) { clearInterval(timer); return; }
      if (!fan || hov || dragging || Date.now() < hold || document.hidden || Math.abs(velocity) > INERTIA_MIN_V) return;
      // Always one step on: the loop re-bases, so there is no "back to the start".
      snapTarget = centerOf(curIndex() + 1);
      loop();
    }, AUTOPLAY_MS);
  }
}
