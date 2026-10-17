// SPDX-License-Identifier: MPL-2.0
// Penpot SVG metadata for design-import.ts. Penpot's SVG export writes a
// `penpot:shape` record as the first child of each shape's `<g id="shape-…">`, in
// the https://penpot.app/xmlns namespace (frontend/src/app/main/ui/shapes/export.cljs
// upstream). A layout lives on a nested `penpot:layout` element; older exports put
// the same attribute on the record itself. The records describe artwork and are
// never drawn.
import type { PenpotSvgLayout } from '@lolly/engine';

// DOMParser keeps the literal qualified name, but namespace handling varies, so we
// look attributes up defensively.
const PENPOT_NS_CANDIDATES = [
  'https://penpot.app/xmlns',
  'http://penpot.app/svg',
  'https://penpot.app/svg',
  'http://penpot.app/xmlns',
];

// Read a Penpot `penpot:<name>` attribute robustly across namespace handling.
export function penpotAttr(el: Element, name: string): string | null {
  const direct = el.getAttribute('penpot:' + name);
  if (direct != null) return direct;
  for (const ns of PENPOT_NS_CANDIDATES) {
    const v = el.getAttributeNS(ns, name);
    if (v != null && v !== '') return v;
  }
  // Last resort: scan attributes for a matching prefixed/local name.
  for (const attr of Array.from(el.attributes)) {
    if (attr.name === 'penpot:' + name || (attr.localName === name && (attr.prefix === 'penpot'))) {
      return attr.value;
    }
  }
  return null;
}

/** A Penpot metadata element: import data, never artwork. */
export function isPenpotMetadata(el: Element): boolean {
  return el.prefix === 'penpot' || PENPOT_NS_CANDIDATES.includes(el.namespaceURI || '')
    || (el.tagName || '').toLowerCase().startsWith('penpot:');
}

const isShapeRecord = (el: Element): boolean =>
  isPenpotMetadata(el) && (el.localName === 'shape' || (el.tagName || '').toLowerCase() === 'penpot:shape');

/**
 * Every `penpot:layout` declaration on one SVG page, once per declaring shape, in
 * document order. The id is the shape id from the wrapping group. Reads at most
 * `limit` elements; a page without the metadata returns an empty list.
 */
export function readPenpotSvgLayouts(root: Element, limit = 16000): PenpotSvgLayout[] {
  const out: PenpotSvgLayout[] = [], owners = new Set<Element>();
  const all = root.getElementsByTagName('*');
  for (let i = 0; i < all.length && i < limit; i++) {
    const el = all[i]!, layout = penpotAttr(el, 'layout');
    if (!layout?.trim()) continue;
    let owner: Element = el;
    for (let node: Element | null = el, depth = 0; node && depth < 3; node = node.parentElement, depth++) {
      if (isShapeRecord(node)) { owner = node; break; }
    }
    if (owners.has(owner)) continue;
    owners.add(owner);
    const group = owner.parentElement, groupId = group ? group.getAttribute('id') || '' : '';
    out.push({ id: groupId.startsWith('shape-') ? groupId.slice(6) : '', name: penpotAttr(owner, 'name') ?? '', layout });
  }
  return out;
}
