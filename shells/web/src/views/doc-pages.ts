// SPDX-License-Identifier: MPL-2.0
// doc-pages.ts - Doc Studio pagination in the TipTap editor.
//
// The editor is a single continuous surface; these two pieces make it read as an
// (infinite) stack of pages:
//   • PageBreak - an explicit hard-break node. The hook (tools/doc-studio/hooks.js) turns
//     it into a fresh [data-pdf-page] on export, so a user can force "start a new page".
//   • mountPageGuides - soft page-boundary guides drawn at each page-height down the
//     paper, recomputed as content grows (so pages are effectively infinite) and reset at
//     each explicit PageBreak. Measurement is layout-based (offsetHeight) and debounced
//     with setTimeout - NOT requestAnimationFrame - so it also runs in a backgrounded tab.
import { Node } from '@tiptap/core';
import type { Editor } from '@tiptap/core';

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML() { return [{ tag: 'div[data-page-break]' }]; },
  renderHTML() {
    return ['div', { 'data-page-break': 'true', class: 'doc-pagebreak' }, ['span', { class: 'doc-pagebreak-label' }, 'Page break']];
  },
});

interface PageGuideOpts {
  editor: Editor;
  stageEl: HTMLElement;
  /** Full printed page height in the paper's own (unscaled) px - e.g. 1123 for A4. The
   *  per-page content step is derived from this minus the paper's live top+bottom margins,
   *  so the guides land on the real page cut and adapt to page-size / margin changes. */
  nativeH: number;
  onCount?: (pages: number) => void;
  cleanups: (() => void)[];
}

export function mountPageGuides(opts: PageGuideOpts): void {
  const { editor, stageEl, nativeH, cleanups } = opts;
  const doc = document;
  const paper = stageEl.querySelector('.doc-tt-paper') as HTMLElement | null;
  const holder = stageEl.querySelector('.doc-tt-holder') as HTMLElement | null;
  if (!paper || !holder || nativeH <= 0) return;

  const layer = doc.createElement('div');
  layer.className = 'doc-tt-guides';
  layer.setAttribute('data-export-hide', '');
  paper.appendChild(layer);
  cleanups.push(() => layer.remove());

  const draw = (): void => {
    // The paper is rendered 1:1 with the print page (same native px width), so one printed
    // page of content = nativeH minus the paper's margins (its CSS padding). Read padding
    // fresh so a page-size / margin change is picked up on the next redraw.
    const cs = getComputedStyle(paper);
    const padTop = parseFloat(cs.paddingTop) || 0;
    const padBottom = parseFloat(cs.paddingBottom) || 0;
    const pageStep = nativeH - padTop - padBottom;
    if (pageStep <= 0) { layer.innerHTML = ''; opts.onCount?.(1); return; }
    const total = holder.offsetHeight;                 // unscaled content height
    // Everything in HOLDER-content space (0 = top of the content). getBoundingClientRect
    // handles padding + stage zoom uniformly; divide out the zoom scale to get layout px.
    const holderRect = holder.getBoundingClientRect();
    const scale = holderRect.height / (total || 1) || 1;
    const breaks: number[] = [];
    holder.querySelectorAll('.doc-pagebreak').forEach((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      breaks.push((r.top + r.height / 2 - holderRect.top) / scale);
    });
    breaks.sort((a, b) => a - b);
    // Walk down page by page. An explicit break resets the running height (and bumps the
    // page count) but draws NO guide line - its own "Page break" marker is the boundary.
    // Only AUTO overflow boundaries get a dashed guide line.
    const autoYs: number[] = [];
    let base = 0, bi = 0, pages = 1, guard = 0;
    while (base < total && guard++ < 2000) {
      const nextAuto = base + pageStep;
      const nextBreak = bi < breaks.length ? breaks[bi]! : Infinity;
      if (nextBreak > base && nextBreak <= nextAuto) { base = nextBreak; bi++; pages++; }
      else if (nextAuto < total) { autoYs.push(nextAuto); base = nextAuto; pages++; }
      else break;
    }
    layer.innerHTML = '';
    autoYs.forEach((y) => {
      const g = doc.createElement('div');
      g.className = 'doc-tt-guide';
      g.style.top = (padTop + y) + 'px';
      const lbl = doc.createElement('span');
      lbl.className = 'doc-tt-guide-lbl';
      lbl.textContent = 'Page break';
      g.appendChild(lbl);
      layer.appendChild(g);
    });
    opts.onCount?.(pages);
  };

  let timer = 0;
  const schedule = (): void => { if (timer) return; timer = window.setTimeout(() => { timer = 0; draw(); }, 120); };
  const ro = new ResizeObserver(schedule);
  ro.observe(holder);
  editor.on('update', schedule);
  cleanups.push(() => { ro.disconnect(); if (timer) window.clearTimeout(timer); editor.off('update', schedule); });
  // Initial pass after layout settles.
  window.setTimeout(draw, 60);
}
