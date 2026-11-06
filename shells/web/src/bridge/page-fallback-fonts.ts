// SPDX-License-Identifier: MPL-2.0
/**
 * Fallback fonts on the live page: the page and the export draw a script the design
 * system's fonts lack in the same font (docs/fallback-fonts.md).
 *
 * Without this, a browser draws such characters in whatever system font it finds while
 * the export outlines them in the fallback font, so the two disagree on the letters and
 * on the width of every line that holds them. Here, after a paint, the canvas's rendered
 * text is checked with the export's own rule (font-fill.ts `packsForText`). When it
 * needs fallback fonts, each is registered as a FontFace under a family name of its own
 * (PAGE_FALLBACK_FAMILY) with a `unicode-range` of the characters its file maps, and that
 * family is added to the canvas's font variables after the design system's named
 * families and before the generic ones. The browser then walks the stack as the export
 * does: a design system font draws every character it has, and only what none of them
 * has reaches the fallback font.
 *
 * Nothing changes for a canvas whose text the design system covers: no font loads and no
 * variable is touched, and the page and every export keep their bytes. The faces are
 * created from the same catalog-cache bytes the export reads, so no second download
 * happens, the CSP needs nothing new (`font-src` already allows `blob:`), and the
 * service worker is not involved. The registry that outlines exports reads stylesheet
 * `@font-face` rules only, so these FontFace objects never become a design system face.
 *
 * Chinese, Japanese and Korean text is grouped by the font its export would draw the Han
 * characters with (fallback-fonts.ts `hanForms`, read per text node with the export's
 * own inputs: the node's `lang` and the canvas's text), so the page registers the same
 * one. A canvas holding two of those languages lists both fonts in one family stack, and
 * the browser draws every Han character with the first; its export draws each run's own.
 */
import { hanEvidence, hanForms, hasCjk, runLang, type FallbackFontPack, type HanForm } from '@lolly-tools/node-shell/fallback-fonts';
import { PAGE_FALLBACK_FAMILY } from './fallback-font-source.ts';
import { fallbackPackUrl, fallbackPacks, packsForText, packsGeneration } from './font-fill.ts';
import type { FontStyleSlice } from './text-svg.ts';

/** The font variables tool styles take their families from (brand-vars.ts FONT_SLOTS). */
const FONT_VARS = ['--font-brand', '--font-mono', '--font-display', '--font-italic'] as const;
const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|math|emoji|fangsong|ui-serif|ui-sans-serif|ui-monospace|ui-rounded)$/i;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'TEXTAREA']);
const ASCII = /^\p{ASCII}*$/u;
/** Text checked per style is capped, so a very long document stays cheap to recheck. */
const MAX_TEXT_PER_STYLE = 65536;

const faces = new Map<string, Promise<boolean>>();
/** A repaint that changes no text (a zoom, a selection) asks the same question again. */
const answers = new Map<string, Promise<FallbackFontPack[]>>();
const MAX_ANSWERS = 64;
function packsFor(style: FontStyleSlice, text: string, han: readonly HanForm[]): Promise<FallbackFontPack[]> {
  // Keyed by the catalog's generation too, so an answer given before the catalog's
  // fallback fonts were known is asked again once they are.
  const key = `${packsGeneration()}\u0000${style.fontFamily}\u0000${style.fontWeight}\u0000${style.fontStyle}\u0000${han.join()}\u0000${text}`;
  let hit = answers.get(key);
  if (!hit) {
    hit = packsForText(style, text, han);
    answers.set(key, hit);
    if (answers.size > MAX_ANSWERS) answers.delete(answers.keys().next().value!);
  }
  return hit;
}
const styleEls = new WeakMap<Element, HTMLStyleElement>();

const familyOf = (pack: FallbackFontPack): string => `${PAGE_FALLBACK_FAMILY}${pack.family}`;
const quoted = (family: string): string => `"${family.replace(/["\\]/g, '')}"`;

/** One pack as a FontFace on this document, created once per session. */
function ensureFace(pack: FallbackFontPack): Promise<boolean> {
  const key = `${pack.id}@${pack.version}`;
  let hit = faces.get(key);
  if (!hit) {
    hit = (async (): Promise<boolean> => {
      const url = await fallbackPackUrl(pack);
      if (!url || typeof FontFace === 'undefined' || !document.fonts?.add) return false;
      const face = new FontFace(familyOf(pack), `url("${url}")`, { weight: pack.weight, style: pack.style, unicodeRange: pack.covers });
      await face.load();
      document.fonts.add(face);
      return true;
    })().catch(() => false);
    faces.set(key, hit);
    void hit.then((ok) => { if (!ok && faces.get(key) === hit) faces.delete(key); });
  }
  return hit;
}

/** A family stack with these families placed after its named families, before the generics. */
export function withFallbackFamilies(stack: string, families: readonly string[]): string {
  const parts = stack.split(',').map((p) => p.trim()).filter(Boolean)
    .filter((p) => !p.replace(/^["']|["']$/g, '').startsWith(PAGE_FALLBACK_FAMILY));
  const at = parts.findIndex((p) => GENERIC.test(p.replace(/^["']|["']$/g, '')));
  const add = families.map(quoted);
  const next = at === -1 ? [...parts, ...add] : [...parts.slice(0, at), ...add, ...parts.slice(at)];
  return next.join(', ');
}

/**
 * The canvas's rendered text, grouped by the computed font it is set in and, for Chinese,
 * Japanese and Korean, by the font its export would draw the Han characters with.
 */
async function textByStyle(root: Element): Promise<Array<{ style: FontStyleSlice; text: string; han: readonly HanForm[] }>> {
  const nodes: Array<{ parent: Element; data: string }> = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const data = (node as Text).data;
    if (ASCII.test(data)) continue;
    const parent = node.parentElement;
    if (!parent || parent.closest('script,style,template,noscript,textarea') || SKIP_TAGS.has(parent.tagName)) continue;
    nodes.push({ parent, data });
  }
  // The same inputs an export reads (font-fill.ts resolveExportFont): the node's `lang`,
  // its text and the whole canvas's text. Read only when some text could need them.
  const cjk = nodes.some((n) => hasCjk(n.data));
  const packs = cjk ? await fallbackPacks() : [];
  const evidence = cjk ? hanEvidence(root.textContent ?? '', packs) : null;
  const groups = new Map<string, { style: FontStyleSlice; text: string; han: readonly HanForm[] }>();
  for (const { parent, data } of nodes) {
    const cs = getComputedStyle(parent);
    // The stack is read without this module's own families, so the answer does not
    // depend on whether they were added on the last check.
    const fontFamily = withFallbackFamilies(cs.fontFamily, []);
    const han = cjk && hasCjk(data) ? hanForms({ lang: runLang(parent), text: data, document: evidence }, packs) : [];
    const key = `${fontFamily}\u0000${cs.fontWeight}\u0000${cs.fontStyle}\u0000${han.join()}`;
    let group = groups.get(key);
    if (!group) { group = { style: { fontFamily, fontWeight: cs.fontWeight, fontStyle: cs.fontStyle }, text: '', han }; groups.set(key, group); }
    if (group.text.length < MAX_TEXT_PER_STYLE) group.text += `${data}\n`;
  }
  return [...groups.values()];
}

/**
 * Check the canvas `root` and bring its fallback fonts in line with what its export would
 * draw with. `scope` is the selector the tool's styles are scoped to. Returns whether any
 * fallback font is now in use on that canvas.
 */
export async function syncPageFallbackFonts(root: Element, scope: string): Promise<boolean> {
  const wanted: FallbackFontPack[] = [];
  for (const group of await textByStyle(root)) {
    for (const pack of await packsFor(group.style, group.text, group.han)) {
      if (!wanted.some((p) => p.id === pack.id)) wanted.push(pack);
    }
  }
  const ready: FallbackFontPack[] = [];
  for (const pack of wanted) if (await ensureFace(pack)) ready.push(pack);
  const families = [...new Set(ready.map(familyOf))];

  let el = styleEls.get(root);
  if (!families.length) {
    el?.remove();
    styleEls.delete(root);
    return false;
  }
  const rootStyle = getComputedStyle(document.documentElement);
  const decls: string[] = [];
  for (const name of FONT_VARS) {
    const value = rootStyle.getPropertyValue(name).trim();
    if (value) decls.push(`${name}: ${withFallbackFamilies(value, families)};`);
  }
  const css = `${scope} { ${decls.join(' ')} }`;
  if (!el) {
    el = document.createElement('style');
    el.dataset.lollyFallbackFonts = '';
    document.head.appendChild(el);
    styleEls.set(root, el);
  }
  if (el.textContent !== css) el.textContent = css;
  return true;
}

/** Take the canvas's fallback families away again, as on unmount. The faces stay loaded. */
export function releasePageFallbackFonts(root: Element): void {
  styleEls.get(root)?.remove();
  styleEls.delete(root);
}
