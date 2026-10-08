// SPDX-License-Identifier: MPL-2.0
/** Format readers share XML admission; the shell supplies the parser. */
import { escapeXml } from './xml-escape.ts';

/** Refuse characters XML 1.0 cannot carry before escaping text or attributes. */
export function escapeAdobeXml(source: string): string {
  for (const character of source) {
    const code = character.codePointAt(0)!;
    if (code < 32 && ![9, 10, 13].includes(code) || code >= 0xd800 && code <= 0xdfff || code === 0xfffe || code === 0xffff) throw new Error('Adobe XML text contains an unsupported character.');
  }
  return escapeXml(source);
}
export type AdobeXmlParser = (source: string) => Document;
export function readAdobeXml(source: string, parse: AdobeXmlParser, maxBytes = 1024 * 1024): Document {
  if (source.length > maxBytes || new TextEncoder().encode(source).length > maxBytes) throw new Error('Adobe XML exceeds the input byte limit.');
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('Adobe XML cannot contain a document type or entity declaration.');
  const doc = parse(source);
  if (!doc.documentElement || doc.getElementsByTagName('parsererror').length) throw new Error('Adobe XML is malformed.');
  const stack: { el: Element; depth: number }[] = [{ el: doc.documentElement, depth: 1 }]; let count = 0;
  while (stack.length) {
    const { el, depth } = stack.pop()!;
    if (++count > 50000 || depth > 64 || el.attributes.length > 128) throw new Error('Adobe XML exceeds the structure limits.');
    for (const child of Array.from(el.children)) stack.push({ el: child, depth: depth + 1 });
  }
  return doc;
}
export function adobeChildren(el: Element, name: string): Element[] { return Array.from(el.children).filter(c => c.localName === name); }
export function adobeChild(el: Element, name: string): Element | undefined { return adobeChildren(el, name)[0]; }
export function adobeText(el: Element, name: string): string { return adobeChild(el, name)?.textContent?.trim() ?? ''; }
