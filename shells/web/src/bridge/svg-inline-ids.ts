// SPDX-License-Identifier: MPL-2.0
/**
 * Id-namespacing for SVG subtrees inlined from external files.
 *
 * The walker inlines same-origin SVG images (`inlineSvgFromImg` in export.ts)
 * to keep them vector - but a pre-rendered file carries its own generated ids
 * (`fcovclip-1`, gradient/filter ids, …), and inlining several files into one
 * document makes same-named ids collide: every reference binds to the FIRST
 * definition. Found 2026-08-10 via the svgo fidelity harness - four filmstrip
 * covers each carrying `fcovclip-1` all clipped to the first cover's geometry,
 * silently cutting the other covers' titles to nothing (the optimizer's
 * id-minification "repaired" the binding and the missing titles appeared).
 *
 * The prefix hashes the SOURCE URL rather than counting: repeat exports of the
 * same page stay byte-identical (C2PA hashes depend on that), and the same
 * file inlined twice gets the same prefix - harmless, because identical
 * content makes every reference resolve to identical geometry.
 */

/** djb2 of the source string, base36 - short, stable, good enough spread. */
const srcHash = (src: string): string => {
  let h = 5381;
  for (let i = 0; i < src.length; i++) h = ((h << 5) + h + src.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

/**
 * Prefix every id in `svg` (and every reference to one - `url(#…)` in any
 * attribute, `href`/`xlink:href`, and `<style>` text) with a hash of `src`.
 * No-op for subtrees with no ids.
 */
export function namespaceInlinedSvgIds(svg: Element, src: string): void {
  const withId = svg.querySelectorAll('[id]');
  if (!withId.length) return;
  const prefix = `i${srcHash(src)}-`;
  const ids = new Set<string>();
  for (const el of withId) ids.add(el.getAttribute('id')!);
  for (const el of withId) el.setAttribute('id', prefix + el.getAttribute('id')!);
  const rewriteUrls = (v: string): string =>
    v.replace(/url\(\s*(['"]?)#([^)'"\s]+)\1\s*\)/g, (m, q, id) => (ids.has(id) ? `url(${q}#${prefix}${id}${q})` : m));
  const all = [svg, ...svg.querySelectorAll('*')];
  for (const el of all) {
    for (const attr of [...el.attributes]) {
      const v = attr.value;
      if ((attr.name === 'href' || attr.name === 'xlink:href') && v.startsWith('#') && ids.has(v.slice(1))) {
        el.setAttribute(attr.name, `#${prefix}${v.slice(1)}`);
      } else if (v.includes('url(') && v.includes('#')) {
        const nv = rewriteUrls(v);
        if (nv !== v) el.setAttribute(attr.name, nv);
      }
    }
    if (el.tagName && el.tagName.toLowerCase() === 'style' && el.textContent && el.textContent.includes('#')) {
      el.textContent = rewriteUrls(el.textContent)
        .replace(/(^|[\s,{])#([A-Za-z_][\w-]*)/g, (m, pre, id) => (ids.has(id) ? `${pre}#${prefix}${id}` : m));
    }
  }
}
