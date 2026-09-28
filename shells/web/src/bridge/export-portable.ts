// SPDX-License-Identifier: MPL-2.0
import type { ExportOpts } from '../../../../packages/core/src/host-v1/export.ts';
import { portableHtml } from '../../../../engine/src/portable-html.ts';

/** Inline the fonts and images used by this document, without bundling the shell. */
export async function renderPortableHtml(node: Element, doc: NonNullable<ExportOpts['portableDocument']>): Promise<Blob> {
  const resources = new Map<string, Promise<string>>();
  let totalBytes = 0;
  const inline = (raw: string): Promise<string> => {
    if (raw.startsWith('#')) return Promise.resolve(raw);
    const url = new URL(raw, document.baseURI).href;
    if (url.startsWith('data:')) return Promise.resolve(url);
    const existing = resources.get(url);
    if (existing) return existing;
    if (resources.size >= 128) throw new Error('This document uses too many resources for a portable file.');
    const result = (async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error('A document resource could not be embedded. Reload its font or image and retry.');
      const blob = await response.blob();
      totalBytes += blob.size;
      if (totalBytes > 32 * 1024 * 1024) throw new Error('The portable document exceeds 32 MB. Use smaller images.');
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not embed a document resource.'));
        reader.readAsDataURL(blob);
      });
    })();
    resources.set(url, result);
    return result;
  };
  const inlineCss = async (css: string, base = document.baseURI): Promise<string> => {
    const urls = [...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)];
    for (const match of urls) {
      if (match[1]!.startsWith('#')) continue;
      css = css.replace(match[0], `url("${await inline(new URL(match[1]!, base).href)}")`);
    }
    return css;
  };
  const root = node.querySelector<HTMLElement>('[data-portable-root]') ?? node;
  const cs = getComputedStyle(root);
  const vars: string[] = [];
  for (let i = 0; i < cs.length; i++) {
    const name = cs.item(i);
    if (/^--(?:font-|brand-)/.test(name)) vars.push(`${name}:${cs.getPropertyValue(name)}`);
  }
  const families = new Set<string>();
  for (const el of [root, ...root.querySelectorAll('*')].slice(0, 4096)) {
    for (const family of getComputedStyle(el).fontFamily.split(',')) families.add(family.trim().replace(/["']/g, '').toLowerCase());
  }
  const faces: Array<{ css: string; base: string }> = [];
  const visit = (rules: CSSRuleList, base: string): void => {
    for (const rule of rules) {
      if (rule instanceof CSSFontFaceRule && families.has(rule.style.fontFamily.replace(/["']/g, '').toLowerCase())) faces.push({ css: rule.cssText, base });
      else if ('cssRules' in rule) visit((rule as CSSGroupingRule).cssRules, base);
    }
  };
  for (const sheet of document.styleSheets) {
    try { visit(sheet.cssRules, sheet.href ?? document.baseURI); } catch { /* Cross-origin stylesheets do not expose rules. */ }
  }
  let resourceCss = `:root{${vars.join(';')}}\n`;
  for (const face of faces) resourceCss += await inlineCss(face.css, face.base) + '\n';
  const fragment = document.createElement('template');
  fragment.innerHTML = doc.markup;
  let markup = doc.markup;
  for (const element of fragment.content.querySelectorAll('img[src],image[href],image[xlink\\:href]')) {
    const src = element.getAttribute('src') ?? element.getAttribute('href') ?? element.getAttribute('xlink:href');
    if (src && !src.startsWith('#')) {
      const attr = element.hasAttribute('src') ? 'src' : element.hasAttribute('href') ? 'href' : 'xlink:href';
      element.setAttribute(attr, await inline(src));
    }
  }
  for (const element of fragment.content.querySelectorAll('style')) element.textContent = await inlineCss(element.textContent ?? '');
  for (const element of fragment.content.querySelectorAll<HTMLElement>('[style]')) {
    const css = element.getAttribute('style')!;
    if (css.includes('url(')) element.setAttribute('style', await inlineCss(css));
  }
  markup = fragment.innerHTML;
  return new Blob([portableHtml({ ...doc, markup, styles: await inlineCss(doc.styles) }, resourceCss)], { type: 'text/html' });
}
