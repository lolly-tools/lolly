// SPDX-License-Identifier: MPL-2.0
/**
 * Text a PDF cannot set: the words go in as a picture from the browser's own text
 * renderer, the same one that drew them on the page.
 *
 * A PDF has no font fallback of its own. The writer embeds one face and addresses it one
 * glyph per character, with no shaping, or uses a base-14 face that holds WinAnsi and
 * nothing else. Outlining needs a font file with the glyphs. Text that no font file here
 * covers, which on a brand with Latin faces is every other script, used to reach the
 * base-14 face and print as question marks. The browser can still draw that text, from
 * the fonts on the machine, so a picture of a stand-in for the run matches the page.
 *
 * A picture cannot be selected or searched, so each export says which scripts went this
 * way, through the export notice and the log. A capture that fails stops the export with
 * a message rather than leaving the words out.
 */
import { hasComplexScript, hasRtlText, scriptsOf } from '@lolly-tools/node-shell/text-bidi';
import { rasterizeNodeToDataUrl } from './export-svg-walker.ts';
import { MAX_RASTER_PX, type ImprintState } from './export-shared.ts';

/** Sharper than the 200 dpi of other pictures in a PDF, because these are words. */
export const TEXT_PICTURE_DPI = 300;

/** Style the run takes from its element. Direction and bidi come through `bidi`. */
const COPIED = [
  'font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch', 'font-variant', 'font-feature-settings',
  'font-variation-settings', 'font-kerning', 'font-synthesis', 'font-size-adjust', 'font-optical-sizing',
  'letter-spacing', 'word-spacing', 'text-rendering', 'color', '-webkit-text-fill-color',
  '-webkit-text-stroke-width', '-webkit-text-stroke-color', 'paint-order', 'text-shadow',
] as const;

/**
 * Whether this run has to avoid pdf.text() even when the active font holds its glyphs:
 * text() does not shape and always runs left to right.
 */
export function liveTextWouldGarble(text: string, rtl: boolean): boolean {
  return rtl || hasRtlText(text) || hasComplexScript(text);
}

export interface TextPictureRun {
  text: string;
  /** The computed style of the run's element, or the same properties as a plain record. */
  style: CSSStyleDeclaration | Readonly<Record<string, string>>;
  direction: 'ltr' | 'rtl';
  /** Reverses the characters themselves, for `<bdo>` and bidi-override. */
  override?: boolean;
  /** The run's box in layout px. Left out, the box takes the words' natural size. */
  box?: { w: number; h: number };
  /** Output pixels per layout px. */
  scale: number;
  /** The background a `background-clip: text` box shows through the words, on the stand-in's box. */
  clip?: { image: string; size: string; position: string; repeat: string };
  /** The element's language, which selects local letter forms. */
  lang?: string | null;
  imprint?: ImprintState | undefined;
}

export interface TextPicture {
  src: string;
  /** Layout px: the padded image, and the run's box inside the padding. */
  pad: number;
  w: number;
  h: number;
}

const readStyle = (style: TextPictureRun['style'], prop: string): string =>
  (typeof (style as CSSStyleDeclaration).getPropertyValue === 'function'
    ? (style as CSSStyleDeclaration).getPropertyValue(prop)
    : (style as Readonly<Record<string, string>>)[prop]) ?? '';

/** The room around a run that its glyphs, shadow or stroke can paint into, in layout px. */
function reach(style: TextPictureRun['style']): number {
  const size = parseFloat(readStyle(style, 'font-size')) || 16;
  const shadow = readStyle(style, 'text-shadow');
  let extra = 0;
  // Offsets and blur of each shadow. The colour may hold numbers too, which only adds room.
  for (const m of shadow.matchAll(/-?\d*\.?\d+px/g)) extra = Math.max(extra, Math.abs(parseFloat(m[0])));
  return Math.ceil(size * 0.75 + extra * 3);
}

/**
 * A picture of the run from a stand-in, so the words are drawn and nothing else. The image
 * is `w + 2 * pad` by `h + 2 * pad` in layout px, with the run's box at `pad`, `pad`.
 * Null when the capture failed.
 */
export async function textPicture(run: TextPictureRun): Promise<TextPicture | null> {
  const stand = document.createElement('div');
  const box = run.box;
  stand.style.cssText = 'position:absolute;left:-99999px;top:0;margin:0;padding:0;border:0;display:block;'
    + 'overflow:visible;white-space:pre;text-indent:0;text-transform:none;text-decoration:none;background:none;'
    + (box ? `width:${box.w}px;height:${box.h}px;line-height:${box.h}px;` : 'width:max-content;');
  for (const prop of COPIED) {
    const value = readStyle(run.style, prop);
    if (value) stand.style.setProperty(prop, value);
  }
  stand.style.direction = run.direction;
  stand.style.unicodeBidi = run.override ? 'bidi-override' : 'normal';
  stand.style.textAlign = run.direction === 'rtl' ? 'right' : 'left';
  if (run.clip) {
    stand.style.backgroundImage = run.clip.image;
    stand.style.backgroundSize = run.clip.size;
    stand.style.backgroundPosition = run.clip.position;
    stand.style.backgroundRepeat = run.clip.repeat;
    stand.style.setProperty('-webkit-background-clip', 'text');
    stand.style.setProperty('background-clip', 'text');
  }
  if (run.lang) stand.lang = run.lang;
  stand.textContent = run.text;
  document.body.appendChild(stand);
  try {
    const r = stand.getBoundingClientRect();
    if (r.width < 0.5 || r.height < 0.5) return null;
    const pad = reach(run.style);
    // Past the cap on an axis, both shrink together, so the words keep their shape.
    const fit = Math.min(1, (MAX_RASTER_PX - 2) / ((r.width + 2 * pad) * run.scale), (MAX_RASTER_PX - 2) / ((r.height + 2 * pad) * run.scale));
    const scale = run.scale * fit;
    const src = await rasterizeNodeToDataUrl(stand, Math.max(2, Math.round(r.width * scale)), Math.max(2, Math.round(r.height * scale)), undefined, run.imprint, false, Math.round(pad * scale));
    return src ? { src, pad, w: r.width, h: r.height } : null;
  } finally { stand.remove(); }
}

/** The scripts each document drew as pictures, for the notice at the end of its export. */
const pictured = new WeakMap<object, Set<string>>();

export function notePicturedText(pdf: object, text: string): void {
  let scripts = pictured.get(pdf);
  if (!scripts) { scripts = new Set(); pictured.set(pdf, scripts); }
  for (const script of scriptsOf(text)) scripts.add(script);
}

const scriptNames = new Intl.DisplayNames(['en'], { type: 'script' });

/** What this document has to tell the person about its pictured text, once, or null. */
export function takePicturedTextNotice(pdf: object): string | null {
  const scripts = pictured.get(pdf);
  if (!scripts) return null;
  pictured.delete(pdf);
  // Latin beside another script is rarely the letters that are missing.
  if (scripts.size > 1) scripts.delete('Latn');
  const names = [...scripts].map((code) => { try { return scriptNames.of(code) ?? code; } catch { return code; } });
  const which = names.length ? ` (${names.join(', ')})` : '';
  return `This PDF draws some text as pictures, because no font it can embed has those letters${which}. `
    + 'The words look as they do on the page but cannot be selected or searched. Add a font with those letters to keep them as vector text.';
}

/** Why a PDF stopped, for text it could not draw at all. */
export function undrawableTextError(text: string): Error {
  return new Error(`This PDF cannot draw "${text.slice(0, 40)}": no font it can embed has those letters and a picture of the words could not be made. Add a font with those letters, or export a PNG.`);
}
