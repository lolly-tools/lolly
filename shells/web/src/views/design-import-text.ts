// SPDX-License-Identifier: MPL-2.0
import { nodeToBox, type DesignMapOptions } from '@lolly/engine';
import { mountModal } from '../components/modal.ts';
import { navigateTo } from '../nav.ts';
import { escape as escapeHtml } from '../utils.ts';
import { t, tRaw } from '../i18n.ts';

type ImportedNode = NonNullable<Parameters<typeof nodeToBox>[0]>;

/** SVG text bounds describe glyphs, not padded, wrapping layout frames. */
export async function prepareSvgText(nodes: ImportedNode[], map?: DesignMapOptions): Promise<string[]> {
  const remapped = new Set<string>();
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none;display:inline-block;white-space:pre;padding:0;margin:0;border:0;';
  document.body.appendChild(probe);
  try {
    for (const node of nodes) {
      if (node.kind !== 'text' || !node.text) continue;
      node.pad = 0;
      const box = nodeToBox(node, map);
      const family = String(node.fontFamily ?? '').trim();
      if (family && family.toLowerCase() !== box.font.toLowerCase()) remapped.add(family);
      const roles: Record<string, string> = {
        sans: 'var(--font-brand, sans-serif)',
        mono: 'var(--font-mono, monospace)',
        display: 'var(--font-display, var(--font-brand, sans-serif))',
      };
      const safeFamily = box.font.replace(/[^\w -]/g, '').trim();
      probe.style.fontFamily = Object.hasOwn(roles, box.font) ? roles[box.font]! : `'${safeFamily}', var(--font-brand, sans-serif)`;
      probe.style.fontSize = `${box.fontSize}px`;
      probe.style.fontWeight = box.weight;
      probe.style.lineHeight = String(Math.min(4, Math.max(0.5, box.lineHeight)));
      probe.textContent = box.text;
      const style = getComputedStyle(probe);
      try { await document.fonts?.load(`${box.weight} ${box.fontSize}px ${style.fontFamily}`, box.text); }
      catch { /* Measure the same fallback the editor can render. */ }
      const rect = probe.getBoundingClientRect();
      // Font ink can extend beyond the line box by a pixel. Include its scroll
      // bounds, which are also what the mounted Design overflow check reads.
      node.w = Math.max(box.w, Math.ceil(rect.width), probe.scrollWidth);
      node.h = Math.max(box.h, Math.ceil(rect.height), probe.scrollHeight);
    }
  } finally { probe.remove(); }
  return [...remapped];
}

/** Shown after committing the import, so visiting Type retains the design. */
export async function showImportedFontNotice(families?: string[], canvas?: HTMLElement): Promise<void> {
  if (!families?.length) return;
  // The queued tool paint also writes the return URL. Let it finish before the
  // modal pushes its Back entry or offers navigation to Type.
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  if (canvas && !canvas.isConnected) return;
  await new Promise<void>(resolve => {
    const message = tRaw('Text from {fonts} now uses your current brand fonts. To use your company’s typeface, add it in Design System Setup → Type. Your imported design is kept; use Back to return to it.', { fonts: families.join(', ') });
    const modal = mountModal(`<h2 class="modal-title">${t('This design uses your brand fonts')}</h2>
      <p class="modal-msg">${escapeHtml(message)}</p><div class="modal-actions">
      <button type="button" class="btn" data-font-setup>${t('Add brand fonts')}</button>
      <button type="button" class="btn modal-primary" data-continue>${t('Keep editing')}</button></div>`, {
      className: 'modal', onClose: () => resolve(),
      initialFocus: el => el.querySelector<HTMLButtonElement>('[data-continue]'),
    });
    modal.el.addEventListener('click', event => {
      if (!(event.target instanceof Element)) return;
      // Navigate while the modal owns its Back entry; closing first races its pop.
      if (event.target.closest('[data-font-setup]')) navigateTo('#/start?area=type');
      else if (event.target.closest('[data-continue]')) modal.close();
    });
  });
}

// Concatenate <text>/<tspan> content, one line per <tspan> (or the whole text if none).
export function readTextContent(el: Element) {
  const tspans = el.querySelectorAll('tspan');
  let text: string;
  if (tspans.length) {
    text = Array.from(tspans).map((t) => t.textContent || '').join('\n');
  } else {
    text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  }
  return {
    text,
    fg: styleProp(el, 'fill') || el.getAttribute('fill') || '',
    fontSize: attrNum(el, 'font-size') || parseFloat(styleProp(el, 'font-size')) || 0,
    fontWeight: el.getAttribute('font-weight') || styleProp(el, 'font-weight') || '',
    fontFamily: el.getAttribute('font-family') || styleProp(el, 'font-family') || '',
    textAlign: anchorToAlign(styleProp(el, 'text-anchor') || el.getAttribute('text-anchor')),
    lineHeight: 0,
  };
}

// SVG text-anchor → box textAlign.
export function anchorToAlign(a: unknown): string {
  const s = String(a || '').toLowerCase();
  if (s === 'middle') return 'center';
  if (s === 'end') return 'right';
  return 'left';
}

// Read a CSS property off the element's inline style="" (cheap; no computed styles).
export function styleProp(el: Element, prop: string): string {
  try {
    const st = 'style' in el ? (el as SVGElement).style : undefined;
    const v = st?.getPropertyValue(prop);
    return v ? v.trim() : '';
  } catch {
    return '';
  }
}

export function attrNum(el: Element, name: string): number | null {
  const v = el.getAttribute(name);
  if (v == null || v === '') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}
