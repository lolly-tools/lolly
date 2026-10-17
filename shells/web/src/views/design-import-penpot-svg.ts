// SPDX-License-Identifier: MPL-2.0
// Penpot SVG metadata for design-import.ts. Only the SVGs inside Penpot's legacy
// zip export carry it: its pages and components.svg (render-page and
// render-components in frontend/src/app/main/render.cljs upstream). A board or
// object exported as SVG is written without metadata, so its layouts cannot be
// detected. Each shape's `<g id="shape-…">` starts with a `penpot:shape` record in
// the https://penpot.app/xmlns namespace (frontend/src/app/main/ui/shapes/export.cljs),
// and Penpot writes a layout on a nested `penpot:layout` element. A `penpot:layout`
// attribute on the record itself is also accepted, as a tolerance. The records
// describe artwork and are never drawn.
import type { PenpotSvgLayout } from '@lolly/engine';
import { t } from '../i18n.ts';

/**
 * SVG containers whose content is never drawn in place. The SVG walk in
 * design-import.ts skips them, so a layout declared inside one (a component master
 * in the zip's components.svg, under `<defs><symbol>`) was never imported.
 */
export const NON_DRAWN_CONTAINERS: ReadonlySet<string> = new Set(['defs', 'symbol', 'mask', 'clippath', 'pattern', 'marker']);

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

const insideNonDrawn = (el: Element, root: Element): boolean => {
  for (let node: Element | null = el; node && node !== root; node = node.parentElement) {
    if (NON_DRAWN_CONTAINERS.has((node.localName || '').toLowerCase())) return true;
  }
  return false;
};

/**
 * Every `penpot:layout` declaration on one SVG page, once per declaring shape, in
 * document order. The id is the shape id from the wrapping group. Declarations in a
 * container that is never drawn are left out. Reads at most `limit` elements; a
 * page without the metadata returns an empty list.
 */
export function readPenpotSvgLayouts(root: Element, limit = 16000): PenpotSvgLayout[] {
  const out: PenpotSvgLayout[] = [], owners = new Set<Element>();
  const all = root.getElementsByTagName('*');
  for (let i = 0; i < all.length && i < limit; i++) {
    const el = all[i]!, layout = penpotAttr(el, 'layout');
    if (!layout?.trim() || insideNonDrawn(el, root)) continue;
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

/**
 * The sentence an import shows after its result line when Penpot layouts came in
 * as fixed positions, or '' when none did. Each layer's own finding passes through
 * the import's warning callback while it runs and the result line replaces it, so
 * this count is what stays on screen.
 */
export function layoutFindingsNote(findings: readonly unknown[] | undefined): string {
  const n = findings?.length ?? 0;
  if (!n) return '';
  return n === 1
    ? t('1 Penpot layout came in as fixed positions. Import the .penpot export to keep it editable.')
    : t('{n} Penpot layouts came in as fixed positions. Import the .penpot export to keep them editable.', { n });
}
