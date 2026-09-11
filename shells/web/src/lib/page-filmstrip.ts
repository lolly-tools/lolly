// SPDX-License-Identifier: MPL-2.0
// A slide-sorter filmstrip for paged tools (render.paged) - a rail of live thumbnails
// beside the canvas that lets you see every page at once, click one to jump to it, and
// step with the ← → / ↑ ↓ arrow keys. The rail runs down the LEFT by default, or along
// the BOTTOM when the manifest asks for it (render.filmstrip: "bottom") - the deck-strip
// shape, which suits a card/slide deck where pages are wide and few. When a page carries a
// `data-block-index` (deck-studio tags each slide with the sidebar block that authors it),
// the link is two-way: clicking a thumbnail also scrolls + focuses that block, and clicking
// the block scrolls its slide into view.
//
// Entirely additive and defensive: it feature-detects the paged structure and no-ops if
// anything is missing, so a non-paged tool (or a shell change) can never be broken by it.
// Thumbnails are scaled clones of the real [data-pdf-page] nodes, rebuilt on each render.

import { isTypingTarget } from './typing-target.ts';

export interface Filmstrip {
  /** Rebuild the thumbnails from the current pages (call after the tool re-renders). */
  refresh(): void;
  /** Tear everything down (observers, listeners, DOM). */
  destroy(): void;
}

export type FilmstripSide = 'left' | 'bottom';

// A thumbnail is sized on the axis the rail does NOT scroll along, so every thumb in the
// rail matches on that axis and the rail's own thickness is constant: a vertical rail
// fixes the WIDTH (heights vary with each page's aspect), a horizontal one fixes the
// HEIGHT (widths vary). That constant is what lets the CSS reserve a fixed strip and the
// canvas inset it, with no measure-then-relayout pass.
const THUMB_W = 132; // px - left rail: thumbnail width
const THUMB_H = 96;  // px - bottom rail: thumbnail height

export function mountFilmstrip(
  outer: HTMLElement,
  canvas: HTMLElement,
  inputs: HTMLElement | null,
  side: FilmstripSide = 'left',
): Filmstrip {
  const host = outer.parentElement;
  if (!host) return { refresh() {}, destroy() {} };
  const bottom = side === 'bottom';

  const rail = document.createElement('nav');
  rail.className = bottom ? 'pagestrip pagestrip--bottom' : 'pagestrip';
  rail.setAttribute('aria-label', 'Slides');
  rail.setAttribute('aria-orientation', bottom ? 'horizontal' : 'vertical');
  host.classList.toggle('is-pagestrip-bottom', bottom);
  host.appendChild(rail);

  let thumbs: HTMLElement[] = [];
  let io: IntersectionObserver | null = null;
  let activeIdx = 0;
  let raf = 0;

  const pages = (): HTMLElement[] => Array.from(canvas.querySelectorAll<HTMLElement>('[data-pdf-page]'));

  function scrollToPage(i: number): void {
    const p = pages()[i];
    if (p) p.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  // The sidebar block a page is tied to (deck-studio's data-block-index convention).
  function blockOf(page: HTMLElement): HTMLElement | null {
    const bi = page.getAttribute('data-block-index');
    if (bi == null || !inputs) return null;
    return inputs.querySelector<HTMLElement>(`.block-item[data-block-index="${CSS.escape(bi)}"]`);
  }
  // Delete the slide by clicking its sidebar block's own remove control (reuses the
  // shell's block-removal path - undo, URL sync, re-render all come for free).
  function deletePage(page: HTMLElement): void {
    const bi = page.getAttribute('data-block-index');
    if (bi == null || !inputs) return;
    inputs.querySelector<HTMLElement>(`[data-block-remove][data-block-index="${CSS.escape(bi)}"]`)?.click();
  }
  function jumpToBlock(page: HTMLElement): void {
    const block = blockOf(page);
    if (!block) return;
    // Best-effort: expand a collapsed card so the jump lands on its fields.
    if (block.classList.contains('is-collapsed')) block.querySelector<HTMLElement>('[data-block-handle]')?.click();
    block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    block.classList.add('is-slide-linked');
    window.setTimeout(() => block.classList.remove('is-slide-linked'), 900);
  }

  function setActive(i: number): void {
    if (i < 0 || i >= thumbs.length) return;
    activeIdx = i;
    thumbs.forEach((t, k) => {
      const on = k === i;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-current', on ? 'true' : 'false');
    });
    const t = thumbs[i];
    // 'nearest' on both axes: the rail scrolls on whichever one it actually runs along.
    if (t) t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function step(delta: number): void {
    const next = Math.max(0, Math.min(thumbs.length - 1, activeIdx + delta));
    if (next !== activeIdx) { setActive(next); scrollToPage(next); }
  }

  // Arrow-key paging - only when the canvas region has focus/hover and the user isn't
  // typing in a field, so we never fight normal input or page scrolling.
  function onKey(e: KeyboardEvent): void {
    if (!thumbs.length) return;
    // Shadow-aware: a focused jelly field reports its HOST as the active element,
    // so a plain tagName test would let arrow keys page the strip mid-typing.
    const ae = document.activeElement as HTMLElement | null;
    if (isTypingTarget(ae)) return;
    const withinCanvas = host!.matches(':hover') || (ae ? host!.contains(ae) : false);
    if (!withinCanvas) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') { step(1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') { step(-1); e.preventDefault(); }
    else if (e.key === 'Home') { setActive(0); scrollToPage(0); e.preventDefault(); }
    else if (e.key === 'End') { const n = thumbs.length - 1; setActive(n); scrollToPage(n); e.preventDefault(); }
  }
  window.addEventListener('keydown', onKey);

  // Clicking a sidebar block jumps its slide into view (the reverse link). Delegated on
  // #tool-inputs so it survives the shell re-rendering the block cards.
  function onInputsClick(e: Event): void {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('.block-item[data-block-index]');
    if (!el) return;
    const bi = el.getAttribute('data-block-index');
    if (bi == null) return;
    const i = pages().findIndex(p => p.getAttribute('data-block-index') === bi);
    if (i >= 0) { setActive(i); scrollToPage(i); }
  }
  inputs?.addEventListener('click', onInputsClick);

  function clearThumbs(): void {
    if (io) { io.disconnect(); io = null; }
    thumbs = [];
    rail.querySelectorAll('.pagestrip-thumb').forEach(t => t.remove());
  }

  // Clone the tool's #tool-canvas-scoped <style>s and re-scope them onto the rail's
  // .pagestrip-render wrappers, so a cloned page renders with the tool's real styling
  // (positions, colours, bullets, tables) - a scaled clone would otherwise be unstyled.
  function injectScopedStyles(): void {
    let css = '';
    canvas.querySelectorAll('style[data-lolly-scope]').forEach(s => {
      const scope = s.getAttribute('data-lolly-scope') || '#tool-canvas';
      css += (s.textContent || '').split(scope).join('.pagestrip-render') + '\n';
    });
    let tag = rail.querySelector<HTMLStyleElement>('style.pagestrip-css');
    if (!tag) { tag = document.createElement('style'); tag.className = 'pagestrip-css'; rail.insertBefore(tag, rail.firstChild); }
    tag.textContent = css;
  }

  function refresh(): void {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      clearThumbs();
      const ps = pages();
      // A single-page tool doesn't need a sorter; hide the rail entirely.
      host!.classList.toggle('has-pagestrip', ps.length > 1);
      if (ps.length <= 1) return;
      injectScopedStyles();

      ps.forEach((page, i) => {
        const rect = page.getBoundingClientRect();
        const pw = Math.max(1, rect.width || page.offsetWidth || 1280);
        const ph = Math.max(1, rect.height || page.offsetHeight || 720);
        const scale = bottom ? THUMB_H / ph : THUMB_W / pw;
        const label = (page.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);

        // Container (not a button - it holds two buttons: jump + delete).
        const thumb = document.createElement('div');
        thumb.className = 'pagestrip-thumb';

        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'pagestrip-open';
        open.setAttribute('aria-label', `Slide ${i + 1}${label ? ': ' + label : ''}`);
        open.title = label || `Slide ${i + 1}`;

        // A scaled clone of the real page, rendered via the re-scoped styles above.
        const frame = document.createElement('span');
        frame.className = 'pagestrip-frame pagestrip-render';
        frame.style.width = (bottom ? Math.round(pw * scale) : THUMB_W) + 'px';
        frame.style.height = (bottom ? THUMB_H : Math.round(ph * scale)) + 'px';
        const clone = page.cloneNode(true) as HTMLElement;
        clone.removeAttribute('data-pdf-page');
        clone.querySelectorAll('script,[data-slide-notes]').forEach(n => n.remove());
        clone.style.width = pw + 'px';
        clone.style.height = ph + 'px';
        clone.style.margin = '0';
        clone.style.transform = `scale(${scale})`;
        clone.style.transformOrigin = 'top left';
        clone.style.pointerEvents = 'none';
        frame.appendChild(clone);

        const num = document.createElement('span');
        num.className = 'pagestrip-num';
        num.textContent = String(i + 1);

        open.append(frame, num);
        open.addEventListener('click', () => { setActive(i); scrollToPage(i); jumpToBlock(page); });
        thumb.appendChild(open);

        // Delete - only when the slide maps to a removable sidebar block (the builder).
        if (blockOf(page)) {
          const del = document.createElement('button');
          del.type = 'button';
          del.className = 'pagestrip-del';
          del.setAttribute('aria-label', `Delete slide ${i + 1}`);
          del.title = 'Delete slide';
          del.innerHTML = '&#215;';
          del.addEventListener('click', e => { e.stopPropagation(); deletePage(page); });
          thumb.appendChild(del);
        }

        rail.appendChild(thumb);
        thumbs.push(thumb);
      });

      // Track which page is most in view → highlight its thumbnail.
      io = new IntersectionObserver(entries => {
        let best: { i: number; r: number } | null = null;
        for (const e of entries) {
          const i = ps.indexOf(e.target as HTMLElement);
          if (i < 0) continue;
          if (!best || e.intersectionRatio > best.r) best = { i, r: e.intersectionRatio };
        }
        if (best && best.r > 0) setActive(best.i);
      }, { root: outer, threshold: [0.25, 0.5, 0.75] });
      ps.forEach(p => io!.observe(p));
      setActive(Math.min(activeIdx, thumbs.length - 1));
    });
  }

  refresh();

  return {
    refresh,
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      inputs?.removeEventListener('click', onInputsClick);
      clearThumbs();
      host!.classList.remove('has-pagestrip', 'is-pagestrip-bottom');
      rail.remove();
    },
  };
}
