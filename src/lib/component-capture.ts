// SPDX-License-Identifier: MPL-2.0
/** Opt-in native capture for the deterministic component library. Text remains
 * text; SVG icons lower independently, so one complex illustration cannot flatten
 * all the surrounding controls. This is deliberately not the tool export path. */
import { parseBoxShadow } from '../../../../engine/src/css-box.ts';
import { parsePenpotColor, svgToPenpotDoc, penpotUuid, PENPOT_MIME } from '../../../../engine/src/penpot-file.ts';
import type { PenpotDoc, PenpotIrShape, PenpotIrText, PenpotMedia } from '../../../../engine/src/penpot-file.ts';
import { bakeTextStyles } from '../bridge/export-pptx.ts';
import { buildComponentArchive, componentTokenDocument } from './component-penpot.ts';
import { listLollyUiTokens } from './lolly-ui-tokens.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';

const px = (v: string): number => Number.parseFloat(v) || 0;
const colour = (css: string): string | undefined => {
  const c = parsePenpotColor(css);
  return c && c.alpha > 0 ? c.hex + (c.alpha < 1 ? Math.round(c.alpha * 255).toString(16).padStart(2, '0') : '') : undefined;
};
export function readComponentTokenValues(root: Element): Record<string, string> {
  const style = getComputedStyle(root);
  const values: Record<string, string> = {};
  const probe = document.createElement('span');
  probe.setAttribute('data-export-hide', '');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
  root.append(probe);
  try {
    for (const t of listLollyUiTokens()) {
      const css = `var(--ui-${t.path.join('-')})`;
      const path = `lolly.ui.${t.path.join('.')}`;
      if (t.type === 'color') {
        probe.style.color = css;
        values[path] = getComputedStyle(probe).color;
      } else values[path] = style.getPropertyValue(`--ui-${t.path.join('-')}`).trim();
    }
  } finally { probe.remove(); }
  return values;
}

export interface ComponentCapture { name: string; node: HTMLElement }
export async function captureComponents(items: ComponentCapture[]): Promise<{ doc: PenpotDoc; notes: string[] }> {
  if (!items.length) throw new Error('Choose at least one component.');
  await document.fonts.ready;
  const notes = new Set<string>();
  const media: PenpotMedia[] = [];
  const doc: PenpotDoc = {
    name: items.length === 1 ? `Lolly · ${items[0]!.name}` : 'Lolly component library',
    pages: [], media, googleFamilies: ['SUSE', 'Inter', 'Outfit'],
    tokens: componentTokenDocument(readComponentTokenValues(items[0]!.node)),
  };
  for (const { name, node } of items) {
    if (!node.isConnected) throw new Error('This component is no longer mounted.');
    const bounds = node.getBoundingClientRect();
    if (!bounds.width || !bounds.height) throw new Error(`Show “${name}” before downloading it.`);
    const box = (r: DOMRect) => ({ x: r.x - bounds.x, y: r.y - bounds.y, w: r.width, h: r.height });
    const textShape = (text: string, style: CSSStyleDeclaration, rect: DOMRect): PenpotIrText => ({
      type: 'text', name: text.trim().slice(0, 60), ...box(rect), growType: 'auto-height',
      paragraphs: [{ runs: [{ text, fontFamily: style.fontFamily.split(',')[0]!.trim().replace(/['"]/g, ''),
        fontSize: px(style.fontSize), fontWeight: px(style.fontWeight) || 400,
        italic: style.fontStyle === 'italic', lineHeight: px(style.lineHeight) / px(style.fontSize) || 1.2,
        letterSpacing: px(style.letterSpacing), color: colour(style.color) || '#000000',
        transform: ['uppercase', 'lowercase', 'capitalize'].includes(style.textTransform) ? style.textTransform as 'uppercase' | 'lowercase' | 'capitalize' : 'none',
        decoration: style.textDecorationLine.includes('underline') ? 'underline' : style.textDecorationLine.includes('line-through') ? 'line-through' : 'none',
      }] }],
    });
    const walk = async (el: Element): Promise<PenpotIrShape[]> => {
      if (el.matches('script, style, template, [data-export-hide], [hidden]')) return [];
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return [];
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return [];
      const b = box(rect);
      const label = el.getAttribute('aria-label') || el.classList[0] || el.tagName.toLowerCase();
      const shapes: PenpotIrShape[] = [];
      if (el.tagName.toLowerCase() === 'svg') {
        const clone = el.cloneNode(true) as SVGElement;
        bakeTextStyles(el, clone);
        clone.querySelectorAll('style, script').forEach(n => n.remove());
        clone.setAttribute('x', String(b.x)); clone.setAttribute('y', String(b.y));
        clone.setAttribute('width', String(b.w)); clone.setAttribute('height', String(b.h));
        const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}">${new XMLSerializer().serializeToString(clone)}</svg>`;
        const lowered = svgToPenpotDoc(xml, { name: label });
        const board = lowered?.doc.pages[0]?.shapes[0];
        if (board && 'children' in board && !lowered?.pending.length) return board.children;
        // An unsupported SVG is local artwork; its surrounding labels and boxes
        // remain native. Record this limitation in the visible download status.
        clone.removeAttribute('x'); clone.removeAttribute('y');
        const id = penpotUuid();
        media.push({ id, name: label, mtype: 'image/svg+xml', width: b.w, height: b.h,
          bytes: new TextEncoder().encode(new XMLSerializer().serializeToString(clone)) });
        notes.add('Complex SVG artwork is embedded; text and controls remain editable.');
        return [{ type: 'image', name: label, ...b, media: id }];
      }
      const fill = colour(style.backgroundColor);
      const stroke = colour(style.borderTopColor);
      const bw = px(style.borderTopWidth);
      const corner = (css: string): number => css.includes('%') ? px(css) / 100 * Math.min(b.w, b.h) : px(css);
      const corners = [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius].map(corner) as [number, number, number, number];
      const radius = corners.every(r => r === corners[0]) ? corners[0] : corners;
      const borders = [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].map(px);
      const borderColors = [style.borderTopColor, style.borderRightColor, style.borderBottomColor, style.borderLeftColor].map(colour);
      const uniformBorder = borders.every(w => w === bw) && borderColors.every(c => c === stroke);
      const shadows = parseBoxShadow(style.boxShadow).map(s => ({ style: s.inset ? 'inner-shadow' as const : 'drop-shadow' as const,
        x: s.x, y: s.y, blur: s.blur, spread: s.spread, color: colour(s.color) || '#000000' }));
      if (fill || bw || shadows.length) shapes.push({ type: 'rect', name: `${label} surface`, ...b, radius,
        fills: fill ? [{ color: fill }] : [], strokes: uniformBorder && bw && stroke ? [{ color: stroke, width: bw, alignment: 'inner' }] : [], shadows });
      if (!uniformBorder) borders.forEach((width, i) => {
        const paint = borderColors[i];
        if (!width || !paint) return;
        shapes.push({ type: 'rect', name: `${label} ${['top', 'right', 'bottom', 'left'][i]} edge`,
          x: b.x + (i === 1 ? b.w - width : 0), y: b.y + (i === 2 ? b.h - width : 0),
          w: i % 2 ? width : b.w, h: i % 2 ? b.h : width, fills: [{ color: paint }] });
      });
      if (style.backgroundImage !== 'none' && style.backgroundImage && el !== node) notes.add('CSS background textures are simplified to native surfaces.');
      if (style.transform && style.transform !== 'none') notes.add('Transformed elements use their visible bounding boxes.');
      if (el instanceof HTMLImageElement && el.currentSrc) {
        const response = await fetch(el.currentSrc);
        if (!response.ok) throw new Error(`Could not read the image in ${name}.`);
        const blob = await response.blob();
        const id = penpotUuid();
        media.push({ id, name: el.alt || label, mtype: blob.type, width: el.naturalWidth || b.w, height: el.naturalHeight || b.h,
          bytes: new Uint8Array(await blob.arrayBuffer()) });
        shapes.push({ type: 'image', name: el.alt || label, ...b, media: id, radius });
      } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        let value = el instanceof HTMLSelectElement ? el.selectedOptions[0]?.text || '' : el.value || el.placeholder;
        if (el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type)) {
          if (el.checked) shapes.push({ type: el.type === 'radio' ? 'circle' : 'rect', name: 'Selected',
            x: b.x + b.w * .25, y: b.y + b.h * .25, w: b.w * .5, h: b.h * .5,
            fills: [{ color: colour(style.accentColor) || colour(style.color) || '#000000' }] });
          value = '';
        }
        if (el instanceof HTMLInputElement && ['range', 'color', 'file', 'hidden'].includes(el.type)) value = '';
        if (el instanceof HTMLInputElement && el.type === 'range') {
          const min = Number(el.min) || 0, max = Number(el.max) || 100;
          const fraction = Math.max(0, Math.min(1, (Number(el.value) - min) / (max - min || 1)));
          const paint = colour(style.accentColor) || colour(style.color) || '#000000';
          shapes.push({ type: 'rect', name: 'Range track', x: b.x, y: b.y + b.h / 2 - 2, w: b.w, h: 4, radius: 2, fills: [{ color: paint, opacity: .2 }] },
            { type: 'rect', name: 'Range value', x: b.x, y: b.y + b.h / 2 - 2, w: Math.max(.01, b.w * fraction), h: 4, radius: 2, fills: [{ color: paint }] },
            { type: 'circle', name: 'Range thumb', x: b.x + (b.w - 14) * fraction, y: b.y + b.h / 2 - 7, w: 14, h: 14, fills: [{ color: paint }] });
        }
        if (el instanceof HTMLInputElement && el.type === 'color') shapes.push({ type: 'rect', name: 'Colour value', ...b, radius, fills: [{ color: el.value }] });
        if (value) {
          const left = px(style.paddingLeft) + bw;
          const textRect = new DOMRect(rect.x + left, rect.y + Math.max(px(style.paddingTop), (rect.height - px(style.fontSize) * 1.2) / 2), Math.max(1, rect.width - left - px(style.paddingRight)), px(style.fontSize) * 1.3);
          shapes.push(textShape(value, style, textRect));
        }
      } else {
        for (const child of el.shadowRoot?.childNodes ?? el.childNodes) {
          if (child.nodeType === Node.ELEMENT_NODE) shapes.push(...await walk(child as Element));
          else if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
            // Range-measured words keep wrapping as authored, with an editable
            // text object per visual line rather than per glyph or outlines.
            const text = child.textContent;
            const range = document.createRange();
            const lines: Array<{ text: string; rect: DOMRect }> = [];
            for (const match of text.matchAll(/\S+\s*/g)) {
              range.setStart(child, match.index!); range.setEnd(child, match.index! + match[0].length);
              const r = range.getBoundingClientRect();
              const last = lines.at(-1);
              if (last && Math.abs(last.rect.y - r.y) < 2) {
                last.text += match[0];
                last.rect = new DOMRect(Math.min(last.rect.x, r.x), r.y, Math.max(last.rect.right, r.right) - Math.min(last.rect.x, r.x), Math.max(last.rect.height, r.height));
              } else if (r.width && r.height) lines.push({ text: match[0], rect: r });
            }
            shapes.push(...lines.map(line => textShape(line.text.trimEnd(), style, line.rect)));
          }
        }
      }
      if (el.tagName.toLowerCase() === 'canvas') notes.add('Canvas animation is not captured as editable geometry.');
      if (!shapes.length) return [];
      return [{ type: 'group', name: label, ...b, opacity: Number(style.opacity) || 1, children: shapes }];
    };
    const children = await walk(node);
    if (!children.length) throw new Error(`No visible objects were found in ${name}.`);
    doc.pages.push({ name, shapes: [{ type: 'board', name, x: 0, y: 0, w: bounds.width, h: bounds.height,
      fills: [{ color: colour(getComputedStyle(node).backgroundColor) || '#ffffff' }], children }] });
  }
  return { doc, notes: [...notes] };
}

export async function downloadComponents(host: HostV1, items: ComponentCapture[], filename: string): Promise<string[]> {
  const { doc, notes } = await captureComponents(items);
  const build = buildComponentArchive(doc);
  if (build.warnings.length) throw new Error(build.warnings.join(' '));
  const { zipAsync } = await import('./zip.ts');
  const enc = new TextEncoder();
  const entries = Object.fromEntries(Object.entries(build.entries).map(([path, value]) => [path, typeof value === 'string' ? enc.encode(value) : value]));
  await host.export.download(new Blob([await zipAsync(entries)], { type: PENPOT_MIME }), `${filename}.penpot`);
  return notes;
}
