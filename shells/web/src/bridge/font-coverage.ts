// SPDX-License-Identifier: MPL-2.0
import type { TextAPI } from '@lolly-tools/core/host-v1';
import { lazyModule } from '../lib/lazy-module.ts';
import type { RunPlace } from './font-fill.ts';
import type { resolveVectorFont } from './font-registry.ts';
import type { FontStyleSlice } from './text-svg.ts';

const loadRegistry = lazyModule(() => import('./font-registry.ts'));
const loadFill = lazyModule(() => import('./font-fill.ts'));
interface ProofCache { entries: Map<string, Promise<boolean>>; keyBytes: number }
const proofs = new WeakMap<object, ProofCache>();
const MAX_PROOFS = 4096;
const MAX_KEY_BYTES = 2 * 1024 * 1024;

function removeProof(cache: ProofCache, key: string): void {
  if (cache.entries.delete(key)) cache.keyBytes -= key.length * 2;
}

/**
 * A resolvable file can still lack the glyphs the browser draws with a system font.
 *
 * The run is covered when the design system's fonts draw all of it, or when an export
 * draws the rest with the fonts it fills from: the later families of the run's stack,
 * then the bundled fallback fonts (font-fill.ts `fillDrawsAll`, the export's own rule).
 * `place` gives the run's element and its document, which choose between the Chinese,
 * Japanese and Korean fonts as an export does.
 */
export async function fontCoversText(
  style: FontStyleSlice,
  text: string,
  api: Pick<TextAPI, 'toPath'> | undefined,
  resolve?: typeof resolveVectorFont,
  place?: RunPlace,
): Promise<boolean> {
  // Line breaks and tabs are layout, not glyphs: no face draws a newline, so shaping one
  // reports a .notdef and every multi-line text box would read as uncovered. They are
  // proofed as spaces, which every text face carries.
  text = text.replace(/\p{Cc}/gu, ' ');
  if (!text.trim()) return true;
  if (!api) return false;
  try {
    const resolver = resolve ?? (await loadRegistry()).resolveVectorFont;
    const font = await resolver(style, text);
    if (!font) return false;
    let cache = proofs.get(api);
    if (!cache) { cache = { entries: new Map(), keyBytes: 0 }; proofs.set(api, cache); }
    const key = JSON.stringify([font.url, font.variations, font.fallbacks, text]);
    const filled = async (drawn: boolean): Promise<boolean> =>
      drawn || (await loadFill()).fillDrawsAll(font, style, text, place);
    const cached = cache.entries.get(key);
    if (cached) {
      cache.entries.delete(key);
      cache.entries.set(key, cached);
      return filled(await cached);
    }
    const proof = api.toPath({ text, fontUrl: font.url, fontSize: 16,
      variations: font.variations, fallbackFonts: font.fallbacks })
      .then(shaped => shaped.notdef === 0)
      .catch(() => {
        if (cache.entries.get(key) === proof) removeProof(cache, key);
        return false;
      });
    // Evidence stores booleans, not outlines. Bound both retained keys and entry count.
    const bytes = key.length * 2;
    if (bytes <= MAX_KEY_BYTES) {
      while (cache.entries.size >= MAX_PROOFS || cache.keyBytes + bytes > MAX_KEY_BYTES) {
        removeProof(cache, cache.entries.keys().next().value!);
      }
      cache.entries.set(key, proof);
      cache.keyBytes += bytes;
    }
    return filled(await proof);
  } catch { return false; }
}

/**
 * Read actual text runs, including inline font changes, without counting image labels.
 * `at` is the element that holds the run.
 */
export function renderedFontRuns(root: Element, styleOf: (element: Element) => CSSStyleDeclaration = getComputedStyle): Array<{ style: FontStyleSlice; text: string; at: Element }> {
  const runs: Array<{ style: FontStyleSlice; text: string; at: Element }> = [];
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.nodeValue ?? '';
    const parent = node.parentElement;
    if (!text.trim() || !parent || parent.closest('script,style,[data-export-hide]')) continue;
    if (parent.closest('svg') && !parent.closest('text')) continue;
    const computed = styleOf(parent);
    runs.push({ text, at: parent, style: { fontFamily: computed.fontFamily, fontWeight: computed.fontWeight, fontStyle: computed.fontStyle } });
  }
  return runs;
}
