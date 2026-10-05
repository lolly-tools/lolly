// SPDX-License-Identifier: MPL-2.0
/** DOM glyph creation is loaded by the controls that need it, outside app boot. */
import { icon, type IconName } from './icons.ts';
export function iconNode(name: IconName, doc: Document = document): Element | null {
  const Parser = doc.defaultView?.DOMParser;
  if (!Parser) return null;
  const root = new Parser().parseFromString(icon(name), 'image/svg+xml').documentElement;
  if (root.localName !== 'svg' || root.namespaceURI !== 'http://www.w3.org/2000/svg') return null;
  return doc.importNode(root, true);
}
