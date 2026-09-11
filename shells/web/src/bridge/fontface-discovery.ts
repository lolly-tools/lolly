// SPDX-License-Identifier: MPL-2.0
/**
 * Discover the `@font-face` families declared in the LIVE document's stylesheets, so
 * vector text export can outline ANY brand/system font - not only the brand catalog's
 * statics / installed user fonts / the shell's platform faces - by resolving the family
 * to its actual font file.
 *
 * This is the discovery half; font-registry.ts fetches + decompresses (woff2→sfnt) the
 * bytes a discovered face points at. The stylesheet walk is DOM-side and guarded so it
 * cleanly no-ops off the main thread (Node/tests); the URL extraction is pure + tested.
 */

/** A `@font-face` rule reduced to what the registry needs to resolve + rank it. */
export interface DiscoveredFace {
  /** Lowercased family name (the registry keys on this). */
  family: string;
  /** First same-origin / data: `url()` in the rule's `src` list. */
  srcUrl: string;
  /** '400' or a variable range '100 900'. */
  weight: string;
  /** 'normal' | 'italic' | 'oblique'. */
  style: string;
  /** The rule's `unicode-range` (may be '' → covers everything). */
  unicodeRange: string;
}

/**
 * The first `url()` in a CSS `@font-face` `src` list, skipping `local()`. Accepts
 * quoted or unquoted forms and `data:` URIs. Pure - the unit-tested core of discovery.
 */
export function firstFontSrcUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  const m = String(src).match(/url\(\s*(["']?)([^)"']+)\1\s*\)/);
  return m ? m[2]!.trim() : null;
}

/**
 * Walk every readable stylesheet's `@font-face` rules → discovered faces. Cross-origin
 * sheets (whose `cssRules` access throws) are skipped, as is any rule with no family or
 * no resolvable `url()`. Returns [] when there is no `document` (Node/worker), so callers
 * stay DOM-free-safe.
 */
export function discoverFontFaces(): DiscoveredFace[] {
  if (typeof document === 'undefined') return [];
  const out: DiscoveredFace[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; }   // cross-origin sheet
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const family = rule.style.getPropertyValue('font-family').replace(/^["']|["']$/g, '').trim();
      const srcUrl = firstFontSrcUrl(rule.style.getPropertyValue('src'));
      if (!family || !srcUrl) continue;
      out.push({
        family: family.toLowerCase(),
        srcUrl,
        weight: (rule.style.getPropertyValue('font-weight') || '400').trim(),
        style: (rule.style.getPropertyValue('font-style') || 'normal').trim(),
        unicodeRange: (rule.style.getPropertyValue('unicode-range') || '').trim(),
      });
    }
  }
  return out;
}
