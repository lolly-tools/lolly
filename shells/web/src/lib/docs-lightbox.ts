// SPDX-License-Identifier: MPL-2.0
/**
 * The docs picture viewer: a screenshot, diagram or figure opens full screen, where the
 * reader can zoom in and move around the picture.
 *
 * One module for both readers, like docs-enhance.ts: the in-app reader (views/docs.ts)
 * imports it, and docs/build.ts bundles this same file into the /info page script. It
 * imports nothing from the app; the caller gives it the words, the glyphs (lib/icons.ts
 * markup) and, optionally, how system Back closes the viewer. Styles:
 * styles/parts/docs-components.css.
 *
 * What opens: a screenshot (`.shot`, with its dark twin), the showcase, a diagram
 * (`.docs-diagram`), a figure (`.docs-figure`) and credentialed page art (`.asset-cred`),
 * inside the article. A picture list (`.md-pictures`) and the decorative mascots stay as
 * they are.
 *
 * The trigger is a real button on each picture, with an accessible name made from the
 * picture's alt text, so a keyboard or a screen reader reaches the control. A plain click or tap
 * on the picture does the same for a pointer. Long-press, right-click and the page's own
 * pinch-zoom stay with the browser: outside the open viewer this module listens only for
 * that click.
 *
 * Inside the viewer:
 *  - on a phone, pinch to zoom, drag to move, double-tap to zoom in and back out, swipe
 *    down (or up) to close, and swipe sideways for the next or previous picture;
 *  - on a desktop, the wheel or a trackpad pinch zooms around the pointer, a drag moves
 *    the picture, + and - zoom, 0 fits, the arrow keys move a zoomed picture or change
 *    picture, and Escape closes;
 *  - buttons do each of those things for anyone who cannot make the gesture.
 *
 * Why its own <dialog> rather than components/modal.ts's mountModal: /info runs this
 * module too, without the app, and the viewer is a full-window gesture surface rather
 * than a centred content box (the collab QR zoom is the same case). primitive-guards
 * lists the exception.
 *
 * Sharpness. A vector screenshot stays vector: when a zoom settles, the image is laid out
 * at its new size rather than scaled, so the browser draws the SVG again at that size.
 * During a pinch or a run of wheel steps it is scaled with a transform for speed, and is
 * redrawn at full sharpness when the gesture stops. A figure (inline SVG or HTML) keeps
 * the layout it has on the page and is scaled with a transform, which browsers repaint
 * sharply once it stops changing.
 *
 * Theme. The viewer shows the twin that is on screen when it opens (the light or the dark
 * file), read from the computed style, so the choice follows whichever theme rule made the choice. A
 * figure follows the theme through its own tokens.
 *
 * Motion. The picture grows from its place on the page, shrinks back on close, and zoom
 * steps ease. With the OS setting or the app's Reduce motion switch
 * (`data-a11y-motion="reduce"` on <html>), every change is immediate.
 */

export interface DocsLightboxLabels {
  /** The trigger's accessible name for one picture, from its alt text ('' when it has none). */
  enlarge: (alt: string) => string;
  /** The viewer's accessible name. */
  viewer: string;
  close: string;
  zoomIn: string;
  zoomOut: string;
  fit: string;
  previous: string;
  next: string;
  /** "3 of 12". */
  position: (n: number, total: number) => string;
}

/**
 * How system Back closes the viewer. Called as the viewer opens, with the function that
 * closes it; returns the function the viewer calls once each time it closes, however it
 * closed. The adapter owns any history entry it adds, and must not pop an entry that Back
 * already took.
 */
export type DocsLightboxBack = (dismiss: () => void) => () => void;

/** The glyphs, as TRUSTED markup from lib/icons.ts (the app's icon(), which docs/build.ts
 *  also calls at build time for /info). */
export interface DocsLightboxIcons {
  enlarge: string;
  zoomIn: string;
  zoomOut: string;
  fit: string;
  close: string;
  previous: string;
  next: string;
}

/** Which lib/icons.ts glyph draws each control, so both readers draw the same set. */
export const LIGHTBOX_ICON_NAMES = {
  enlarge: 'resize', zoomIn: 'zoomIn', zoomOut: 'zoomOut', fit: 'fitAll',
  close: 'close', previous: 'chevronLeft', next: 'chevronRight',
} as const;

export interface DocsLightboxOptions {
  labels: DocsLightboxLabels;
  icons: DocsLightboxIcons;
  back?: DocsLightboxBack;
}

export interface Box { x: number; y: number; w: number; h: number }

/** What the viewer can open, inside the article. */
export const LIGHTBOX_TARGETS = '.shot, .showcase, .docs-diagram, .docs-figure, .asset-cred';
/** Pictures that keep their own behaviour: a picture list's plates and the mascots. */
const LIGHTBOX_SKIP = '.md-pictures, .mascot-cred';
/** A click on one of these inside a picture is that control's, not the viewer's. */
const OWN_CONTROLS = 'a, button, summary, input, select, textarea, label, iframe, [contenteditable], .shot-cred, .diagram-actions, .shot-tryit';

// ── Geometry (pure, exported for the tests) ──────────────────────────────────

/** The largest box of aspect w:h inside `safe`, centred, at most `maxUp` times w×h. */
export function fitBox(safe: Box, w: number, h: number, maxUp = Infinity): Box {
  const k = Math.max(0, Math.min(safe.w / w, safe.h / h, maxUp));
  const fw = w * k;
  const fh = h * k;
  return { x: safe.x + (safe.w - fw) / 2, y: safe.y + (safe.h - fh) / 2, w: fw, h: fh };
}

/** Keep a w×h picture at (x, y) in reach: a side larger than the safe box may move only
 *  until its edge meets the box's edge; a side that fits is centred. */
export function clampPan(x: number, y: number, w: number, h: number, safe: Box): { x: number; y: number } {
  const cx = w <= safe.w ? safe.x + (safe.w - w) / 2 : Math.min(safe.x, Math.max(safe.x + safe.w - w, x));
  const cy = h <= safe.h ? safe.y + (safe.h - h) / 2 : Math.min(safe.y, Math.max(safe.y + safe.h - h, y));
  return { x: cx, y: cy };
}

/** Zoom from s0 to s1 about the point (px, py): the picture point under that point stays there. */
export function zoomAbout(x: number, y: number, s0: number, s1: number, px: number, py: number): { x: number; y: number } {
  const r = s1 / s0;
  return { x: px - (px - x) * r, y: py - (py - y) * r };
}

/** Is this picture file a vector one (it stays sharp at any zoom)? */
export function isVectorSrc(src: string): boolean {
  return /\.svgz?(?:[?#]|$)/i.test(src);
}

// ── The picture behind one trigger ───────────────────────────────────────────

type Pic =
  | { kind: 'img'; src: string; alt: string; caption: string; w: number; h: number; vector: boolean; from: Element }
  | { kind: 'art'; art: HTMLElement; alt: string; caption: string; w: number; h: number; from: Element };

/** Readable text of an element, without the credential card or the viewer's own button. */
function textOf(el: Element | null | undefined): string {
  if (!el) return '';
  const copy = el.cloneNode(true) as Element;
  for (const n of Array.from(copy.querySelectorAll('.shot-cred, .doc-lightbox-open, style, script'))) n.remove();
  return (copy.textContent || '').replace(/\s+/g, ' ').trim();
}

function num(v: string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Whether the reader asked for less motion: the OS setting, or the app's Reduce motion
 * switch, which both readers copy onto <html> before first paint.
 */
function reducedMotion(win: Window): boolean {
  const html = win.document.documentElement;
  if (html.getAttribute('data-a11y-motion') === 'reduce') return true;
  try { return !!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/** A glyph into a control. The one raw-markup write in this module: the markup is a
 *  trusted lib/icons.ts string from the caller, never page or user text. */
function putIcon(el: Element, markup: string): void {
  el.insertAdjacentHTML('afterbegin', markup);
}

// ── Enhancer ─────────────────────────────────────────────────────────────────

const enhanced = new WeakMap<HTMLElement, () => void>();

export function enhanceDocsLightbox(root: HTMLElement, opts: DocsLightboxOptions): () => void {
  const existing = enhanced.get(root);
  if (existing) return existing;

  const doc = root.ownerDocument;
  const win = doc.defaultView!;
  const { labels, icons } = opts;
  const shown = (el: Element): boolean => win.getComputedStyle(el).display !== 'none';

  // ── The pictures, in page order, each with its trigger ──────────────────────
  const hosts: HTMLElement[] = [];
  const injected: Element[] = [];
  for (const host of root.querySelectorAll<HTMLElement>(LIGHTBOX_TARGETS)) {
    if (host.closest(LIGHTBOX_SKIP)) continue;
    // A picture nested in another (an asset inside a figure) opens with its parent.
    if (host.parentElement?.closest(LIGHTBOX_TARGETS)) continue;
    if (host.hasAttribute('data-doc-lightbox')) continue;
    const pic = picOf(host);
    if (!pic) continue;
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'doc-lightbox-open';
    btn.setAttribute('aria-label', labels.enlarge(pic.alt || pic.caption));
    putIcon(btn, icons.enlarge);
    host.setAttribute('data-doc-lightbox', '');
    // A diagram is centred in a wider box: its trigger sits on the image's own corner.
    if (pic.kind === 'img' && host.classList.contains('docs-diagram')) host.style.setProperty('--doc-lb-w', String(pic.w));
    host.appendChild(btn);
    injected.push(btn);
    hosts.push(host);
  }

  /** The picture a trigger opens, read when it opens, so the twin on screen now wins. */
  function picOf(host: HTMLElement): Pic | null {
    if (host.classList.contains('docs-figure')) {
      const art = host.querySelector<HTMLElement>(':scope > .docs-figure-art');
      if (!art) return null;
      const r = art.getBoundingClientRect();
      return {
        kind: 'art', art, from: art,
        alt: art.querySelector('[aria-label]')?.getAttribute('aria-label')?.trim() ?? '',
        caption: textOf(host.querySelector(':scope > figcaption')),
        w: r.width || art.offsetWidth || 640, h: r.height || art.offsetHeight || 400,
      };
    }
    if (host.classList.contains('showcase')) {
      const stage = host.querySelector<HTMLElement>('.showcase-stage');
      const media = stage?.querySelector<Element>(':scope > img, :scope > svg') ?? null;
      const src = host.getAttribute('data-shot') || media?.getAttribute('src') || '';
      if (!src || !stage) return null;
      return {
        kind: 'img', src, vector: isVectorSrc(src), from: media ?? stage,
        alt: media?.getAttribute('alt') || stage.getAttribute('aria-label') || '',
        caption: textOf(host.querySelector(':scope > figcaption')),
        w: num(media?.getAttribute('width')) || 1200, h: num(media?.getAttribute('height')) || 800,
      };
    }
    const imgs = Array.from(host.querySelectorAll<HTMLImageElement>(':scope > img'));
    const img = imgs.find(shown) ?? imgs[0];
    const src = img?.getAttribute('src');
    if (!img || !src) return null;
    return {
      kind: 'img', src, vector: isVectorSrc(src), from: img,
      alt: (img.getAttribute('alt') || '').trim(), caption: '',
      w: num(img.getAttribute('width')) || img.naturalWidth || 1200,
      h: num(img.getAttribute('height')) || img.naturalHeight || 800,
    };
  }

  // ── Opening from the page ───────────────────────────────────────────────────
  const onPageClick = (e: Event): void => {
    const me = e as MouseEvent;
    if (me.defaultPrevented || me.button !== 0 || me.metaKey || me.ctrlKey || me.shiftKey || me.altKey) return;
    const target = me.target as Element | null;
    const btn = target?.closest?.('.doc-lightbox-open');
    const host = ((btn ?? target)?.closest?.('[data-doc-lightbox]') ?? null) as HTMLElement | null;
    if (!host || !root.contains(host)) return;
    const i = hosts.indexOf(host);
    if (i < 0) return;
    if (!btn) {
      // The picture itself, not a control painted on the picture or inside a figure.
      if (target!.closest(OWN_CONTROLS)) return;
      if (!target!.closest('img, svg, .showcase-stage, .docs-figure-art')) return;
      if (host.classList.contains('shot--live')) return;
      // Text chosen inside an HTML figure is a selection, not a request to open.
      const sel = win.getSelection?.();
      if (sel && !sel.isCollapsed && host.contains(sel.anchorNode)) return;
    }
    viewer().open(i, host);
  };
  root.addEventListener('click', onPageClick);

  // ── The viewer: built on first use, kept for the life of the reader ─────────
  let built: ReturnType<typeof buildViewer> | null = null;
  const viewer = (): ReturnType<typeof buildViewer> => (built ??= buildViewer());

  function buildViewer() {
    const dlg = doc.createElement('dialog');
    dlg.className = 'doc-lightbox';
    dlg.setAttribute('aria-label', labels.viewer);
    const capId = `doc-lightbox-caption-${Math.random().toString(36).slice(2, 8)}`;
    dlg.setAttribute('aria-describedby', capId);

    const scrim = el('div', 'doc-lightbox-scrim');
    const stage = el('div', 'doc-lightbox-stage');
    const pic = el('div', 'doc-lightbox-pic');
    stage.appendChild(pic);

    const bar = el('div', 'doc-lightbox-bar');
    const count = el('span', 'doc-lightbox-count');
    const tools = el('span', 'doc-lightbox-tools');
    const bOut = button('out', labels.zoomOut, icons.zoomOut);
    const bIn = button('in', labels.zoomIn, icons.zoomIn);
    const bFit = button('fit', labels.fit, icons.fit);
    const bClose = button('close', labels.close, icons.close);
    tools.append(bOut, bIn, bFit, bClose);
    bar.append(count, tools);

    const bPrev = button('prev', labels.previous, icons.previous);
    const bNext = button('next', labels.next, icons.next);
    bPrev.classList.add('doc-lightbox-nav');
    bNext.classList.add('doc-lightbox-nav');

    const foot = el('div', 'doc-lightbox-foot');
    const caption = el('p', 'doc-lightbox-caption');
    caption.id = capId;
    caption.setAttribute('aria-live', 'polite');
    foot.appendChild(caption);

    dlg.append(scrim, stage, bar, bPrev, bNext, foot);

    function el(tag: string, cls: string): HTMLElement {
      const n = doc.createElement(tag);
      n.className = cls;
      return n;
    }
    function button(name: string, label: string, icon: string): HTMLButtonElement {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'doc-lightbox-btn';
      b.dataset.lb = name;
      b.setAttribute('aria-label', label);
      putIcon(b, icon);
      return b;
    }

    // ── State ──────────────────────────────────────────────────────────────────
    let isOpen = false;
    let closing = false;
    let index = 0;
    let opener: HTMLElement | null = null;
    let release: (() => void) | null = null;
    let cur: Pic | null = null;
    let media: HTMLElement | null = null;      // the <img> or the figure's copy
    let safe: Box = { x: 0, y: 0, w: 1, h: 1 };
    let fit: Box = { x: 0, y: 0, w: 1, h: 1 };
    let scale = 1;                             // 1 = fitted
    let x = 0;                                 // the picture's top-left, in viewer px
    let y = 0;
    let committed = 1;                         // the scale an <img> is laid out at
    let maxScale = 4;
    let tapScale = 2.5;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let animTimer: ReturnType<typeof setTimeout> | null = null;

    const motion = (): boolean => !reducedMotion(win);
    const rtl = (): boolean => win.getComputedStyle(dlg).direction === 'rtl';

    // ── Layout ─────────────────────────────────────────────────────────────────
    /** The free area between the bars: a fitted picture shows whole inside this box. */
    function measureSafe(): Box {
      const W = stage.clientWidth || win.innerWidth;
      const H = stage.clientHeight || win.innerHeight;
      const gap = W < 640 ? 8 : 16;
      const top = bar.getBoundingClientRect().bottom || 56;
      const footBox = foot.hidden ? null : foot.getBoundingClientRect();
      const bottom = footBox?.height ? footBox.top : H;
      // Previous and next sit on the sides of a wide window (and in the foot on a
      // narrow one): a fitted picture keeps clear of them.
      let side = gap;
      for (const b of [bPrev, bNext]) {
        if (b.hidden) continue;
        const r = b.getBoundingClientRect();
        if (!r.width || r.bottom > bottom + 1) continue;
        side = Math.max(side, Math.min(r.right, W - r.left) + gap);
      }
      const sx = side;
      const sy = top + gap;
      return { x: sx, y: sy, w: Math.max(1, W - sx * 2), h: Math.max(1, bottom - gap - sy) };
    }

    function layout(keepView: boolean): void {
      if (!cur) return;
      // Where the centre of the view sits on the picture, to keep it there across a resize.
      const W0 = stage.clientWidth || win.innerWidth;
      const H0 = stage.clientHeight || win.innerHeight;
      const u = keepView && fit.w ? ((W0 / 2) - x) / (fit.w * scale) : 0.5;
      const v = keepView && fit.h ? ((H0 / 2) - y) / (fit.h * scale) : 0.5;
      safe = measureSafe();
      const maxUp = cur.kind === 'art' ? 2 : cur.vector ? 3 : 1;
      fit = fitBox(safe, cur.w, cur.h, maxUp);
      // The zoom range: a vector picture goes deep; a bitmap stops at twice its pixels.
      const native = cur.w / Math.max(1, fit.w);
      maxScale = cur.kind === 'img' && !cur.vector
        ? Math.min(8, Math.max(2, native * 2))
        : Math.min(10, Math.max(4, native * 3));
      tapScale = Math.min(maxScale, Math.max(2, cur.kind === 'img' ? native : 2.5));
      if (!keepView) { scale = 1; x = fit.x; y = fit.y; }
      else {
        x = W0 / 2 - u * fit.w * scale;
        y = H0 / 2 - v * fit.h * scale;
        const p = clampPan(x, y, fit.w * scale, fit.h * scale, safe);
        x = p.x; y = p.y;
      }
      commit();
      syncButtons();
    }

    /** Draw the current state. Live: scale the laid-out picture with a transform (fast).
     *  At rest an <img> is laid out at its real size instead, so a vector is redrawn. */
    function paint(): void {
      if (!media || !cur) return;
      if (cur.kind === 'img') {
        pic.style.transform = `translate(${x}px, ${y}px) scale(${scale / committed})`;
      } else {
        pic.style.transform = `translate(${x}px, ${y}px) scale(${(fit.w / cur.w) * scale})`;
      }
    }

    function commit(): void {
      if (!media || !cur) return;
      if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
      pic.style.willChange = '';
      if (cur.kind === 'img') {
        committed = scale;
        pic.style.width = `${fit.w * scale}px`;
        pic.style.height = `${fit.h * scale}px`;
      } else {
        pic.style.width = `${cur.w}px`;
        pic.style.height = `${cur.h}px`;
      }
      paint();
      dlg.toggleAttribute('data-zoomed', scale > 1.001);
    }

    /** A live change during a gesture; the sharp redraw follows once it stops. */
    function live(): void {
      pic.style.willChange = 'transform';
      paint();
      dlg.toggleAttribute('data-zoomed', scale > 1.001);
      syncButtons();
    }
    function settleSoon(ms = 160): void {
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => { settleTimer = null; commit(); }, ms);
    }

    function stopAnim(): void {
      if (animTimer) { clearTimeout(animTimer); animTimer = null; }
      pic.style.transition = '';
    }

    /** Move to a zoom and position, eased unless motion is reduced. */
    function animateTo(s: number, nx: number, ny: number, done?: () => void, ms = 240): void {
      stopAnim();
      scale = s; x = nx; y = ny;
      if (!motion()) { commit(); syncButtons(); done?.(); return; }
      pic.style.transition = `transform ${ms}ms cubic-bezier(.2, .8, .2, 1)`;
      live();
      animTimer = setTimeout(() => { animTimer = null; pic.style.transition = ''; commit(); syncButtons(); done?.(); }, ms + 20);
    }

    function zoomTo(target: number, px?: number, py?: number, animate = true): void {
      if (!cur) return;
      const s1 = Math.min(maxScale, Math.max(1, target));
      const cx = px ?? safe.x + safe.w / 2;
      const cy = py ?? safe.y + safe.h / 2;
      let p = zoomAbout(x, y, scale, s1, cx, cy);
      p = clampPan(p.x, p.y, fit.w * s1, fit.h * s1, safe);
      if (animate) animateTo(s1, p.x, p.y);
      else { stopAnim(); scale = s1; x = p.x; y = p.y; live(); settleSoon(); }
    }

    function panBy(dx: number, dy: number): void {
      const p = clampPan(x + dx, y + dy, fit.w * scale, fit.h * scale, safe);
      animateTo(scale, p.x, p.y, undefined, 160);
    }

    function syncButtons(): void {
      const at = (b: HTMLButtonElement, off: boolean): void => {
        if (off) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
      };
      at(bOut, scale <= 1.001);
      at(bFit, scale <= 1.001);
      at(bIn, scale >= maxScale - 0.001);
      if (hosts.length > 1) {
        at(bPrev, index <= 0);
        at(bNext, index >= hosts.length - 1);
        count.textContent = labels.position(index + 1, hosts.length);
      }
    }

    // ── Showing one picture ────────────────────────────────────────────────────
    function load(i: number): boolean {
      const host = hosts[i];
      const p = host ? picOf(host) : null;
      if (!p) return false;
      index = i;
      cur = p;
      stopAnim();
      pic.replaceChildren();
      pic.style.transform = '';
      if (p.kind === 'img') {
        const img = doc.createElement('img');
        img.alt = p.alt;
        img.decoding = 'async';
        img.draggable = false;
        img.src = p.src;
        media = img;
      } else {
        // The figure as the reader saw it: the same layout width, its own styles (the
        // page's copy of its <style> block already applies), and nothing inside it to
        // click or read twice; the caption below carries its words.
        const art = doc.createElement('div');
        art.className = 'docs-figure-art doc-lightbox-art';
        art.setAttribute('inert', '');
        art.setAttribute('aria-hidden', 'true');
        for (const n of Array.from(p.art.childNodes)) {
          if (n.nodeType === 1 && /^(style|script)$/i.test((n as Element).tagName)) continue;
          if (n.nodeType !== 1 && n.nodeType !== 3) continue;
          art.appendChild(n.cloneNode(true));
        }
        const cs = win.getComputedStyle(p.art);
        art.style.fontFamily = cs.fontFamily;
        art.style.fontSize = cs.fontSize;
        art.style.lineHeight = cs.lineHeight;
        art.style.color = cs.color;
        art.style.width = `${p.w}px`;
        media = art;
      }
      pic.appendChild(media);
      pic.classList.toggle('doc-lightbox-pic--art', p.kind === 'art');
      // The words: the caption, then the alt text when it adds something.
      const words = [p.caption, p.alt].filter(Boolean);
      const unique = words.filter((w, k) => words.indexOf(w) === k && !(k > 0 && words[0]!.includes(w)));
      caption.textContent = unique.join(' ');
      // The chrome first, so the fit below measures the bars this picture will have.
      const many = hosts.length > 1;
      bPrev.hidden = !many;
      bNext.hidden = !many;
      dlg.toggleAttribute('data-many', many);
      foot.hidden = !unique.length && !many;
      if (p.kind === 'art') {
        // The copy's own height at that width, in case the viewer's type differs.
        pic.style.width = `${p.w}px`;
        pic.style.height = '';
        const h = media.offsetHeight;
        if (h > 0) p.h = h;
      }
      layout(false);
      return true;
    }

    // ── Open and close ─────────────────────────────────────────────────────────
    function open(i: number, from: HTMLElement): void {
      if (isOpen || closing || !hosts[i] || !picOf(hosts[i]!)) return;
      if (!dlg.isConnected) doc.body.appendChild(dlg);
      opener = from.querySelector<HTMLElement>(':scope > .doc-lightbox-open') ?? from;
      isOpen = true;
      // The caption is a polite live region for a change of picture; it joins only after
      // the first fill, so opening reads the dialog once rather than the caption twice.
      caption.removeAttribute('aria-live');
      if (typeof (dlg as HTMLDialogElement).showModal === 'function') {
        try { (dlg as HTMLDialogElement).showModal(); } catch { dlg.setAttribute('open', ''); }
      } else {
        dlg.setAttribute('open', '');
      }
      // Measured with the dialog showing: the fit needs the bars' real sizes.
      load(i);
      caption.setAttribute('aria-live', 'polite');
      bClose.focus({ preventScroll: true });
      release = opts.back ? opts.back(() => close('back')) : null;
      // Grow from the picture's place on the page.
      const r = cur?.from.getBoundingClientRect();
      if (motion() && cur && r && r.width > 0 && fit.w > 0) {
        const k = cur.kind === 'img' ? r.width / fit.w : r.width / cur.w;
        pic.style.transition = 'none';
        pic.style.transform = `translate(${r.left}px, ${r.top}px) scale(${k})`;
        dlg.setAttribute('data-entering', '');
        void pic.offsetWidth;
        win.requestAnimationFrame(() => {
          dlg.removeAttribute('data-entering');
          if (isOpen && !closing) animateTo(1, fit.x, fit.y, undefined, 280);
        });
      }
    }

    type Why = 'user' | 'back' | 'swipe' | 'dispose';
    function close(why: Why): void {
      if (!isOpen || closing) return;
      closing = true;
      const rel = release;
      release = null;
      // Back took its own entry already; every other way out gives ours back.
      rel?.();
      const finish = (): void => {
        stopAnim();
        closing = false;
        isOpen = false;
        if (typeof (dlg as HTMLDialogElement).close === 'function' && (dlg as HTMLDialogElement).open) {
          try { (dlg as HTMLDialogElement).close(); } catch { dlg.removeAttribute('open'); }
        } else {
          dlg.removeAttribute('open');
        }
        dlg.removeAttribute('data-leaving');
        dlg.removeAttribute('data-zoomed');
        dlg.style.removeProperty('--doc-lb-drag');
        pic.replaceChildren();
        media = null;
        cur = null;
        if (why !== 'dispose' && opener) giveFocusBack(opener, why === 'back' || !!rel);
        opener = null;
      };
      // Shrink back to the picture's place when it is in view; otherwise fade.
      const host = hosts[index];
      const from = host && cur ? (cur.kind === 'img' ? (Array.from(host.querySelectorAll(':scope > img')).find(shown) ?? cur.from) : cur.from) : null;
      const r = from?.getBoundingClientRect();
      const inView = !!r && r.width > 0 && r.bottom > 0 && r.top < win.innerHeight;
      if (why === 'back' || why === 'dispose' || !motion()) { finish(); return; }
      dlg.setAttribute('data-leaving', '');
      if (inView && cur) {
        const k = cur.kind === 'img' ? r!.width / (fit.w * committed) : r!.width / cur.w;
        stopAnim();
        pic.style.transition = 'transform 220ms cubic-bezier(.4, 0, .2, 1)';
        pic.style.transform = `translate(${r!.left}px, ${r!.top}px) scale(${k})`;
      }
      animTimer = setTimeout(finish, 230);
    }

    /**
     * Focus back on the trigger. When the close also moves history (Back, or the viewer
     * giving its entry back), Chrome clears the focus as that same-document traversal
     * completes, so the trigger takes it again once the traversal's popstate has run,
     * unless the reader has put the focus somewhere else by then.
     */
    function giveFocusBack(to: HTMLElement, traversal: boolean): void {
      if (!to.isConnected) return;
      to.focus({ preventScroll: true });
      if (!traversal) return;
      const again = (): void => {
        const a = doc.activeElement;
        if (to.isConnected && (!a || a === doc.body)) to.focus({ preventScroll: true });
      };
      const onPop = (): void => { stop(); setTimeout(again, 0); };
      const stop = (): void => { win.removeEventListener('popstate', onPop); clearTimeout(expiry); };
      // Back has already delivered its popstate; our own history.back() delivers one soon.
      setTimeout(again, 0);
      win.addEventListener('popstate', onPop);
      const expiry = setTimeout(stop, 1500);
    }

    function go(delta: number): void {
      const next = index + delta;
      if (next < 0 || next >= hosts.length || next === index) return;
      if (!load(next)) return;
      if (motion()) {
        pic.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
      }
    }

    // ── Buttons ────────────────────────────────────────────────────────────────
    dlg.addEventListener('click', (e) => {
      const b = ((e.target as Element | null)?.closest?.('button[data-lb]') ?? null) as HTMLButtonElement | null;
      if (!b || b.getAttribute('aria-disabled') === 'true') return;
      switch (b.dataset.lb) {
        case 'in': zoomTo(scale * 1.6); break;
        case 'out': zoomTo(scale / 1.6); break;
        case 'fit': zoomTo(1); break;
        case 'close': close('user'); break;
        case 'prev': go(-1); break;
        case 'next': go(1); break;
      }
    });

    // ── Keys ───────────────────────────────────────────────────────────────────
    dlg.addEventListener('keydown', (e) => {
      if (!isOpen) return;
      const k = e.key;
      const onButton = (e.target as Element | null)?.closest?.('button');
      if (k === 'Escape') {
        // Taken here and stopped, so the page's own Escape handlers never see the key.
        e.preventDefault();
        e.stopPropagation();
        close('user');
        return;
      }
      if (k === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Focus stays in the viewer: Tab from the last control comes round to the first,
        // and Shift+Tab from the first to the last, rather than out to the browser.
        const order = Array.from(dlg.querySelectorAll<HTMLButtonElement>('button[data-lb]')).filter((b) => !b.hidden);
        const at = order.indexOf(doc.activeElement as HTMLButtonElement);
        const edge = e.shiftKey ? at <= 0 : at === order.length - 1 || at < 0;
        if (edge && order.length) {
          e.preventDefault();
          order[e.shiftKey ? order.length - 1 : 0]!.focus();
        }
        return;
      }
      // Browser zoom (Ctrl or Cmd with + and -) stays the browser's.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const step = Math.round(Math.min(safe.w, safe.h) * 0.15);
      let handled = true;
      if (k === '+' || k === '=' || k === 'Add') zoomTo(scale * 1.6);
      else if (k === '-' || k === '_' || k === 'Subtract') zoomTo(scale / 1.6);
      else if (k === '0') zoomTo(1);
      else if (k === 'ArrowLeft' || k === 'ArrowRight') {
        const sign = k === 'ArrowLeft' ? 1 : -1;
        if (scale > 1.001) panBy(sign * step, 0);
        else go((rtl() ? sign : -sign));
      } else if (k === 'ArrowUp' || k === 'ArrowDown') {
        if (scale > 1.001) panBy(0, k === 'ArrowUp' ? step : -step);
      } else if (k === 'PageUp' || k === 'PageDown' || k === 'Home' || k === 'End') {
        // Nothing to scroll here; stop the page underneath from moving.
      } else if (k === ' ' && !onButton) {
        // As above.
      } else handled = false;
      if (handled) { e.preventDefault(); e.stopPropagation(); }
    });

    // A close request the browser makes itself (Android Back with a modal open): close
    // the same way, and catch a dialog the browser closed without asking.
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close('user'); });
    dlg.addEventListener('close', () => { if (isOpen && !closing) { release?.(); release = null; isOpen = false; pic.replaceChildren(); media = null; cur = null; } });

    // ── Wheel and trackpad ─────────────────────────────────────────────────────
    dlg.addEventListener('wheel', (e) => {
      if (!isOpen || closing) return;
      // The caption may scroll on its own when it is long.
      const cap = (e.target as Element | null)?.closest?.('.doc-lightbox-caption');
      if (cap && cap.scrollHeight > cap.clientHeight) return;
      e.preventDefault();
      if (!cur) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? (stage.clientHeight || 800) : 1;
      const d = Math.max(-200, Math.min(200, e.deltaY * unit));
      // A trackpad pinch arrives as a wheel with Ctrl held and small steps.
      const factor = Math.exp(-d * (e.ctrlKey ? 0.01 : 0.002));
      zoomTo(scale * factor, e.clientX, e.clientY, false);
    }, { passive: false });

    // Safari on a Mac sends a trackpad pinch as gesture events instead.
    let gestureFrom = 1;
    let touchSeen = 0;
    dlg.addEventListener('gesturestart', (e) => {
      e.preventDefault();
      gestureFrom = scale;
    });
    dlg.addEventListener('gesturechange', (e) => {
      e.preventDefault();
      // On iOS the same pinch also arrives as pointers, which already zoom.
      if (pointers.size || Date.now() - touchSeen < 600) return;
      const g = e as Event & { scale?: number; clientX?: number; clientY?: number };
      if (!g.scale) return;
      zoomTo(gestureFrom * g.scale, g.clientX, g.clientY, false);
    });
    dlg.addEventListener('gestureend', (e) => { e.preventDefault(); });

    // ── Pointers: drag, pinch, double-tap, swipe ───────────────────────────────
    interface Pt { x: number; y: number; type: string }
    const pointers = new Map<number, Pt>();
    type Mode = 'none' | 'pending' | 'pan' | 'pinch' | 'dismiss' | 'page';
    let mode: Mode = 'none';
    let start = { x: 0, y: 0, t: 0, px: 0, py: 0, type: 'mouse' };
    let pinch = { d: 1, mx: 0, my: 0, s: 1, px: 0, py: 0 };
    let lastTap = { t: 0, x: 0, y: 0 };
    let drag = { x: 0, y: 0, t: 0 };

    const two = (): [Pt, Pt] => {
      const [a, b] = Array.from(pointers.values());
      return [a!, b!];
    };
    const beginPinch = (): void => {
      const [a, b] = two();
      pinch = { d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, s: scale, px: x, py: y };
      mode = 'pinch';
    };
    const beginSingle = (p: Pt): void => {
      start = { x: p.x, y: p.y, t: Date.now(), px: x, py: y, type: p.type };
      drag = { x: p.x, y: p.y, t: Date.now() };
    };

    stage.addEventListener('pointerdown', (e) => {
      if (!isOpen || closing) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.pointerType === 'touch') touchSeen = Date.now();
      stopAnim();
      try { stage.setPointerCapture(e.pointerId); } catch { /* an old engine; moves still arrive */ }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
      if (e.pointerType === 'mouse') e.preventDefault();
      if (pointers.size === 1) { mode = 'pending'; beginSingle(pointers.get(e.pointerId)!); }
      else if (pointers.size === 2) { if (mode === 'dismiss' || mode === 'page') resetDrag(); beginPinch(); }
    });

    stage.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p || !cur) return;
      p.x = e.clientX; p.y = e.clientY;
      if (e.pointerType === 'touch') touchSeen = Date.now();
      if (mode === 'pinch' && pointers.size >= 2) {
        const [a, b] = two();
        const d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const s1 = Math.min(maxScale, Math.max(1, pinch.s * (d / pinch.d)));
        // The picture point that was under the fingers' midpoint follows the midpoint.
        const u = (pinch.mx - pinch.px) / (fit.w * pinch.s);
        const v = (pinch.my - pinch.py) / (fit.h * pinch.s);
        const q = clampPan(mx - u * fit.w * s1, my - v * fit.h * s1, fit.w * s1, fit.h * s1, safe);
        scale = s1; x = q.x; y = q.y;
        live();
        return;
      }
      if (pointers.size !== 1) return;
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      if (mode === 'pending') {
        if (Math.hypot(dx, dy) < (p.type === 'mouse' ? 4 : 8)) return;
        if (scale > 1.001) mode = 'pan';
        else if (p.type !== 'mouse' && Math.abs(dy) > Math.abs(dx)) mode = 'dismiss';
        else if (p.type !== 'mouse' && hosts.length > 1) mode = 'page';
        else mode = 'none';
        if (mode !== 'none') dlg.setAttribute('data-dragging', '');
      }
      const now = Date.now();
      if (mode === 'pan') {
        const q = clampPan(start.px + dx, start.py + dy, fit.w * scale, fit.h * scale, safe);
        x = q.x; y = q.y;
        live();
      } else if (mode === 'dismiss') {
        x = start.px; y = start.py + dy;
        live();
        dlg.style.setProperty('--doc-lb-drag', String(Math.min(1, Math.abs(dy) / Math.max(200, safe.h * 0.6))));
      } else if (mode === 'page') {
        x = start.px + dx; y = start.py;
        live();
      }
      if (now - drag.t > 40) drag = { x: p.x, y: p.y, t: now };
    });

    const resetDrag = (): void => {
      dlg.style.removeProperty('--doc-lb-drag');
      x = start.px; y = start.py;
      paint();
    };

    const onUp = (e: PointerEvent): void => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      pointers.delete(e.pointerId);
      try { stage.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      const cancelled = e.type === 'pointercancel';
      if (mode === 'pinch') {
        if (pointers.size === 1) {
          // One finger stays down: it carries on moving a zoomed picture.
          const rest = Array.from(pointers.values())[0]!;
          beginSingle(rest);
          mode = scale > 1.001 ? 'pan' : 'none';
        } else if (pointers.size === 0) { mode = 'none'; commit(); syncButtons(); }
        return;
      }
      if (pointers.size) return;
      dlg.removeAttribute('data-dragging');
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      const dt = Math.max(1, Date.now() - drag.t);
      const vx = (p.x - drag.x) / dt;
      const vy = (p.y - drag.y) / dt;
      const was = mode;
      mode = 'none';
      if (cancelled) { if (was === 'dismiss' || was === 'page') { resetDrag(); } commit(); return; }
      if (was === 'pending') { tap(p); return; }
      if (was === 'pan') { commit(); syncButtons(); return; }
      if (was === 'dismiss') {
        if (Math.abs(dy) > Math.min(120, safe.h * 0.18) || Math.abs(vy) > 0.6) { close('swipe'); return; }
        dlg.style.removeProperty('--doc-lb-drag');
        animateTo(1, fit.x, fit.y, undefined, 200);
        return;
      }
      if (was === 'page') {
        const far = Math.abs(dx) > Math.min(120, safe.w * 0.2) || Math.abs(vx) > 0.5;
        // A swipe towards the start of the line brings the next picture, as a page turns.
        const forward = rtl() ? dx > 0 : dx < 0;
        const target = index + (forward ? 1 : -1);
        if (far && target >= 0 && target < hosts.length) { go(forward ? 1 : -1); return; }
        animateTo(1, fit.x, fit.y, undefined, 200);
      }
    };
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onUp);

    /** A press that did not move: what it means depends on where it was and on what
     *  pressed. Coordinates, not the event target: pointer capture sends every event to
     *  the stage. */
    function tap(p: Pt): void {
      const now = Date.now();
      const r = pic.getBoundingClientRect();
      const onPic = p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
      // A tap or click on the empty space around the picture closes the viewer.
      if (!onPic) { close('user'); return; }
      const double = now - lastTap.t < 320 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 32;
      if (p.type === 'mouse') {
        // The zoom-in cursor promises a click zooms in; a double-click on a zoomed
        // picture fits it again. The click that zoomed in never starts a double.
        if (scale <= 1.001) { lastTap = { t: 0, x: 0, y: 0 }; zoomTo(tapScale, p.x, p.y); return; }
        if (double) { lastTap = { t: 0, x: 0, y: 0 }; zoomTo(1); return; }
        lastTap = { t: now, x: p.x, y: p.y };
        return;
      }
      if (double) {
        lastTap = { t: 0, x: 0, y: 0 };
        if (scale > 1.05) zoomTo(1);
        else zoomTo(tapScale, p.x, p.y);
        return;
      }
      lastTap = { t: now, x: p.x, y: p.y };
    }

    // ── Window changes ─────────────────────────────────────────────────────────
    let resizeFrame = 0;
    const onResize = (): void => {
      if (!isOpen || resizeFrame) return;
      resizeFrame = win.requestAnimationFrame(() => { resizeFrame = 0; if (isOpen && !closing) layout(true); });
    };
    win.addEventListener('resize', onResize);

    function destroy(): void {
      close('dispose');
      win.removeEventListener('resize', onResize);
      if (resizeFrame) win.cancelAnimationFrame(resizeFrame);
      dlg.remove();
    }

    return { open, destroy };
  }

  const dispose = (): void => {
    root.removeEventListener('click', onPageClick);
    built?.destroy();
    built = null;
    for (const n of injected) n.remove();
    for (const h of hosts) {
      h.removeAttribute('data-doc-lightbox');
      h.style.removeProperty('--doc-lb-w');
    }
    enhanced.delete(root);
  };
  enhanced.set(root, dispose);
  return dispose;
}

/**
 * System Back on /info: one same-address history entry while the viewer is open, which
 * Back takes to close the viewer. Same address, so no hashchange fires and the page does not
 * reload. Closing the viewer any other way gives the entry back with history.back(),
 * unless the address has changed since (then the entry is left in place: one Back that
 * does nothing is better than undoing a navigation the reader made).
 *
 * The scroll. Going back to the page's own entry would otherwise put the page where that
 * entry remembers it, which for an address with a #section is the section: Chrome jumped
 * a reader who had scrolled on from an anchor back up to the anchor. So the page's entry is set
 * not to restore its scroll for the length of the round trip, the reader's place is put
 * back if anything moved it anyway, and the entry's own setting returns afterwards.
 */
export function sameEntryBack(win: Window = window): DocsLightboxBack {
  return (dismiss) => {
    const href = win.location.href;
    const at = { x: win.scrollX, y: win.scrollY };
    let mode: ScrollRestoration | null = null;
    let owed = false;
    let done = false;
    // The browser moves to a #section after popstate, reading the entry's setting then,
    // so the setting returns a little later (one task was enough in Chromium and WebKit).
    const settle = (): void => {
      setTimeout(() => {
        try { if (mode) win.history.scrollRestoration = mode; } catch { /* read-only here */ }
        mode = null;
        if (win.scrollX !== at.x || win.scrollY !== at.y) {
          win.scrollTo({ left: at.x, top: at.y, behavior: 'instant' as ScrollBehavior });
        }
      }, 50);
    };
    const onPop = (): void => {
      if (done) return;
      done = true;
      owed = false;
      win.removeEventListener('popstate', onPop);
      settle();
      dismiss();
    };
    try {
      mode = win.history.scrollRestoration;
      win.history.scrollRestoration = 'manual';
    } catch { mode = null; }
    try {
      win.history.pushState(win.history.state, '', href);
      owed = true;
      win.addEventListener('popstate', onPop);
    } catch {
      done = true;
      settle();
    }
    return () => {
      if (done) return;
      done = true;
      win.removeEventListener('popstate', onPop);
      if (owed && win.location.href === href) {
        owed = false;
        const after = (): void => { win.removeEventListener('popstate', after); clearTimeout(timer); settle(); };
        win.addEventListener('popstate', after);
        // A traversal the browser never reports still gives the setting back.
        const timer = setTimeout(after, 1000);
        try { win.history.back(); } catch { after(); }
      } else {
        settle();
      }
    };
  };
}
