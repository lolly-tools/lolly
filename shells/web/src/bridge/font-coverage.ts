// SPDX-License-Identifier: MPL-2.0
import type { TextAPI } from '@lolly-tools/core/host-v1';
import type { resolveVectorFont } from './font-registry.ts';
import type { FontStyleSlice } from './text-svg.ts';

const proofs = new WeakMap<object, Map<string, Promise<boolean>>>();
const MAX_PROOFS = 128;

/** A resolvable file can still lack the glyphs the browser draws with a system font. */
export async function fontCoversText(
  style: FontStyleSlice,
  text: string,
  api: Pick<TextAPI, 'toPath'> | undefined,
  resolve?: typeof resolveVectorFont,
): Promise<boolean> {
  if (!text.trim()) return true;
  if (!api) return false;
  try {
    const resolver = resolve ?? (await import('./font-registry.ts')).resolveVectorFont;
    const font = await resolver(style, text);
    if (!font) return false;
    let cache = proofs.get(api);
    if (!cache) { cache = new Map(); proofs.set(api, cache); }
    const key = JSON.stringify([font.url, font.variations, font.fallbacks, text]);
    const cached = cache.get(key);
    if (cached) return cached;
    const proof = api.toPath({ text, fontUrl: font.url, fontSize: 16,
      variations: font.variations, fallbackFonts: font.fallbacks })
      .then(shaped => shaped.notdef === 0)
      .catch(() => { cache.delete(key); return false; });
    if (cache.size >= MAX_PROOFS) cache.delete(cache.keys().next().value!);
    cache.set(key, proof);
    return proof;
  } catch { return false; }
}

/** Read actual text runs, including inline font changes, without counting image labels. */
export function renderedFontRuns(root: Element, styleOf: (element: Element) => CSSStyleDeclaration = getComputedStyle): Array<{ style: FontStyleSlice; text: string }> {
  const runs: Array<{ style: FontStyleSlice; text: string }> = [];
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.nodeValue ?? '';
    const parent = node.parentElement;
    if (!text.trim() || !parent || parent.closest('script,style,[data-export-hide]')) continue;
    if (parent.closest('svg') && !parent.closest('text')) continue;
    const computed = styleOf(parent);
    runs.push({ text, style: { fontFamily: computed.fontFamily, fontWeight: computed.fontWeight, fontStyle: computed.fontStyle } });
  }
  return runs;
}
