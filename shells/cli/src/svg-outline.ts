// SPDX-License-Identifier: MPL-2.0
/**
 * Outline the live `<text>` runs of a native-`<svg>` template into `<path>` glyphs,
 * using host.text (HarfBuzz) - the CLI half of "vector output is text as paths"
 * (plans/73-cli-ga-contract.md section 6a).
 *
 * Why this exists: until GA the CLI's svg branch serialised jsdom's `<text>` verbatim,
 * so a recipient without the font opened the file and saw a different design, with
 * nothing to say so - the same silent-wrong-output class the fail-loud work removed.
 * EMF, EPS and DXF already outline in this very process through svgDomToIr and the same
 * host.text, so svg was the odd one out on its own shell, not a capability gap.
 *
 * TWO deliberate differences from the EMF/EPS/DXF path:
 *
 *   • Unlike those formats, SVG can REPRESENT live text. So an unresolvable font is a
 *     warned fallback (the run stays `<text>`, the file still renders) rather than a
 *     hard failure. `--strict` promotes the warning to an exit-4 refusal.
 *   • Anything this walk cannot place EXACTLY keeps its live `<text>` and says so:
 *     a run with `tspan` children, a `dominant-baseline`/`alignment-baseline` shift, a
 *     `textLength`, or a `textPath`. Guessing a baseline offset would move glyphs by a
 *     few pixels in a file nobody would think to check, which is worse than a warning.
 *
 * Font resolution goes through `host.text.fontUrl(family, {weight, italic})` - the
 * headless registry over the catalog's static sfnts and the shell's platform face. The
 * web shell's font-registry is deliberately NOT used here: it fetches URLs and knows
 * about IndexedDB user fonts, neither of which exists in this process.
 */

import type { HostV1 } from '@lolly-tools/core/host-v1';

/** Presentation properties inherited down the SVG tree that this walk reads. */
const INHERITED = ['font-family', 'font-weight', 'font-style', 'font-size', 'letter-spacing', 'text-anchor', 'fill'] as const;
type InheritedProp = (typeof INHERITED)[number];

/** Attributes that describe the TEXT LAYOUT and mean nothing on the outlined path. */
const DROP_ON_PATH = new Set([
  'x', 'y', 'dx', 'dy', 'text-anchor', 'font-family', 'font-weight', 'font-style',
  'font-size', 'font-stretch', 'font-variant', 'letter-spacing', 'word-spacing',
  'xml:space', 'dominant-baseline', 'alignment-baseline', 'textLength', 'lengthAdjust',
  'transform',   // re-composed with the glyph translate below
]);

export interface OutlineResult {
  /** Runs converted to `<path>`. */
  outlined: number;
  /** Runs left as live `<text>`, with the reason, in document order. */
  fallbacks: Array<{ text: string; reason: string }>;
}

/**
 * Read a presentation property off an element: attribute first, then its inline
 * `style`, then up the ancestor chain (SVG presentation attributes inherit), then the
 * computed style if the host DOM offers one (a `<style>` block in the template).
 */
function prop(el: Element, name: InheritedProp, getComputed: ((e: Element) => CSSStyleDeclaration | null) | null): string | null {
  for (let cur: Element | null = el; cur; cur = cur.parentElement) {
    const attr = cur.getAttribute(name);
    if (attr) return attr;
    const inline = cur.getAttribute('style');
    if (inline) {
      const m = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, 'i').exec(inline);
      if (m) return m[1]!.trim();
    }
    if (cur.tagName?.toLowerCase() === 'svg') break;
  }
  const cs = getComputed?.(el) ?? null;
  if (!cs) return null;
  const camel = name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  const v = (cs as unknown as Record<string, unknown>)[camel];
  return typeof v === 'string' && v ? v : null;
}

/** First number of an SVG coordinate list ("10 20" / "10,20") - 0 when absent. */
function coord(v: string | null): number {
  if (!v) return 0;
  const n = parseFloat(String(v).trim());
  return Number.isFinite(n) ? n : 0;
}

/** `font-family: "SUSE", Outfit, sans-serif` → ['SUSE', 'Outfit', 'sans-serif']. */
export function familyStack(css: string | null): string[] {
  if (!css) return [];
  return css.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
}

/** CSS font-weight keyword/number → the numeric weight host.text.fontUrl wants. */
export function numericWeight(v: string | null): number {
  const s = String(v ?? '400').trim().toLowerCase();
  if (s === 'bold') return 700;
  if (s === 'normal') return 400;
  if (s === 'lighter') return 300;
  if (s === 'bolder') return 700;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? Math.min(900, Math.max(100, n)) : 400;
}

/** `letter-spacing` in px. `normal`/unitless-em forms that we cannot resolve are 0. */
export function letterSpacingPx(v: string | null, fontSize: number): number {
  if (!v) return 0;
  const s = v.trim();
  if (/^normal$/i.test(s)) return 0;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  if (/em$/i.test(s)) return n * fontSize;
  return n;   // px (or unitless user units, which are px in SVG user space)
}

/** Why this run cannot be placed exactly - null when it can. */
export function unplaceableReason(el: Element): string | null {
  if (el.children.length) return 'the run contains tspan/textPath children';
  for (const a of ['dominant-baseline', 'alignment-baseline']) {
    const v = el.getAttribute(a);
    if (v && !/^(auto|alphabetic)$/i.test(v)) return `${a}="${v}" shifts the baseline`;
  }
  if (el.getAttribute('textLength')) return 'textLength stretches the run';
  return null;
}

/**
 * Replace every `<text>` in `svg` with outlined `<path>` glyphs, IN PLACE.
 *
 * In place, not on a clone, because the caller (the bridge's svg branch) already
 * mutates this node for width/height and serialises it immediately afterwards; a CLI
 * render is single-shot per element, so there is no second reader to surprise.
 */
export async function outlineSvgText(
  svg: Element,
  host: HostV1,
  opts: { getComputedStyle?: ((e: Element) => CSSStyleDeclaration | null) | null } = {},
): Promise<OutlineResult> {
  const result: OutlineResult = { outlined: 0, fallbacks: [] };
  const text = host.text;
  const doc = svg.ownerDocument;
  if (!text || !doc) {
    return result;   // no shaping in this host - the caller reports it once, not per run
  }
  const getComputed = opts.getComputedStyle ?? null;
  const runs = Array.from(svg.querySelectorAll('text'));

  for (const el of runs) {
    const raw = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!raw) continue;

    const blocked = unplaceableReason(el);
    if (blocked) { result.fallbacks.push({ text: raw, reason: blocked }); continue; }

    const fontSize = parseFloat(prop(el, 'font-size', getComputed) ?? '16') || 16;
    const families = familyStack(prop(el, 'font-family', getComputed));
    const weight = numericWeight(prop(el, 'font-weight', getComputed));
    const italic = /italic|oblique/i.test(prop(el, 'font-style', getComputed) ?? '');

    // Cascade order, exactly as a browser picks a face: the first family that resolves
    // to a real sfnt wins. A generic keyword (sans-serif) is left to the last-resort
    // platform face below rather than looked up as a family name.
    let font: { url: string; variations?: string[] } | null = null;
    for (const family of families) {
      if (/^(sans-serif|serif|monospace|cursive|fantasy|system-ui)$/i.test(family)) continue;
      font = (await text.fontUrl?.(family, { weight, italic })) ?? null;
      if (font) break;
    }
    // NO substitute face. Outlining a run in whatever font happens to be on disk would
    // bake a design nobody chose into a file that then looks authoritative; keeping the
    // live <text> preserves the author's intent for every recipient who does have the
    // font, and the warning tells the exporter which ones those are.
    if (!font) {
      result.fallbacks.push({ text: raw, reason: `no font file for "${families.join(', ') || 'the inherited family'}"` });
      continue;
    }

    let shaped: { d: string; advanceWidth: number } | null = null;
    try {
      shaped = await text.toPath({
        text: raw,
        fontUrl: font.url,
        fontSize,
        letterSpacing: letterSpacingPx(prop(el, 'letter-spacing', getComputed), fontSize),
        ...(font.variations ? { variations: font.variations } : {}),
      });
    } catch (e) {
      result.fallbacks.push({ text: raw, reason: `shaping failed - ${(e as Error).message}` });
      continue;
    }
    if (!shaped?.d) { result.fallbacks.push({ text: raw, reason: 'the font produced no glyph outlines' }); continue; }

    const anchor = (prop(el, 'text-anchor', getComputed) ?? 'start').trim().toLowerCase();
    const x = coord(el.getAttribute('x')) + coord(el.getAttribute('dx'));
    const y = coord(el.getAttribute('y')) + coord(el.getAttribute('dy'));
    const adv = shaped.advanceWidth || 0;
    const tx = anchor === 'middle' ? x - adv / 2 : anchor === 'end' ? x - adv : x;

    const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', shaped.d);
    for (const attr of Array.from(el.attributes)) {
      if (!DROP_ON_PATH.has(attr.name)) path.setAttribute(attr.name, attr.value);
    }
    // `fill` is inherited in SVG, and a <text> commonly takes it from an ancestor <g>
    // - which still wraps the path, so nothing needs copying. Only an ancestor default
    // of "no fill attribute anywhere" would paint black, which is the SVG default too.
    const own = el.getAttribute('transform');
    path.setAttribute('transform', `${own ? own + ' ' : ''}translate(${round(tx)} ${round(y)})`);
    el.replaceWith(path);
    result.outlined++;
  }
  return result;
}

const round = (n: number): number => Math.round(n * 100) / 100;
