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
import type { LabelPicture, LabelPictureFn } from '@lolly-tools/node-shell/pdf-finishing';
import { rasterizeNodeToDataUrl } from './export-svg-walker.ts';
import { MAX_RASTER_PX } from './export-shared.ts';

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
    // No imprint: the picture stands in for words and adds nothing but those words to the file.
    const src = await rasterizeNodeToDataUrl(stand, Math.max(2, Math.round(r.width * scale)), Math.max(2, Math.round(r.height * scale)), undefined, undefined, false, Math.round(pad * scale));
    return src ? { src, pad, w: r.width, h: r.height } : null;
  } finally { stand.remove(); }
}

/** The scripts each document drew as pictures, for the notice at the end of its export. */
const pictured = new WeakMap<object, Set<string>>();

export function notePicturedText(pdf: object, text: string): void {
  let scripts = pictured.get(pdf);
  if (!scripts) { scripts = new Set(); pictured.set(pdf, scripts); }
  for (const script of scriptsOf(text)) scripts.add(script);
  // Emoji belong to no script (Common), so they are named on their own: "Emoji".
  if (/\p{Extended_Pictographic}/u.test(text)) scripts.add('Zsye');
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

/**
 * Runs one finishing step that draws print marks, giving it `labelPicture` for a label
 * the mark font cannot set, then hands `report` the key those labels were noted under,
 * so the export notice lists their scripts.
 */
export async function withMarkLabelPictures<T>(step: (labelPicture: LabelPictureFn) => Promise<T>, report: (key: object) => void): Promise<T> {
  const key = {};
  const out = await step(markLabelPictures(key));
  report(key);
  return out;
}

/**
 * A print mark label the mark font cannot set (a name in Arabic, Chinese or Cyrillic,
 * or with an emoji), as a picture from the browser's text renderer in the face the
 * marks name. pdf-finishing.ts paints its coverage in the label's own ink, and `key`
 * collects the scripts for the export notice, as a pictured run in the artwork does.
 */
function markLabelPictures(key: object): LabelPictureFn {
  return async (text, sizePt) => {
    const pic = await markLabelPicture(text, sizePt);
    if (pic) notePicturedText(key, text);
    return pic;
  };
}

async function markLabelPicture(text: string, sizePt: number): Promise<LabelPicture | null> {
  // A point of the label is one layout px here, so the picture's lengths are points.
  const lineH = Math.ceil(sizePt * 1.5);
  const style = { 'font-family': 'Helvetica, Arial, sans-serif', 'font-size': `${sizePt}px`, color: '#000' };
  // The stand-in textPicture makes, measured first: how far the words run, and where a
  // box of this line height puts their baseline. An empty inline-block sits on that baseline.
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;left:-99999px;top:0;margin:0;padding:0;border:0;display:block;white-space:pre;'
    + `width:max-content;line-height:${lineH}px;font-family:${style['font-family']};font-size:${sizePt}px`;
  probe.textContent = text;
  const mark = probe.appendChild(document.createElement('span'));
  mark.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
  document.body.appendChild(probe);
  let advance: number, baseline: number;
  try {
    const box = probe.getBoundingClientRect();
    advance = box.width;
    baseline = mark.getBoundingClientRect().bottom - box.top;
  } finally { probe.remove(); }
  if (!(advance > 0)) return null;
  const pic = await textPicture({ text, style, direction: 'ltr', box: { w: advance, h: lineH }, scale: TEXT_PICTURE_DPI / 72 });
  if (!pic) return null;
  const img = new Image();
  img.src = pic.src;
  try { await img.decode(); } catch { return null; }
  const width = img.naturalWidth, height = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const g = canvas.getContext('2d');
  if (!g || !width || !height) return null;
  g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, width, height).data;
  // Black words: coverage is opacity times darkness, which holds on a clear or a white ground.
  const coverage = new Uint8Array(width * height);
  for (let i = 0; i < coverage.length; i++) {
    const lum = 0.2126 * px[i * 4]! + 0.7152 * px[i * 4 + 1]! + 0.0722 * px[i * 4 + 2]!;
    coverage[i] = Math.round((px[i * 4 + 3]! * (255 - lum)) / 255);
  }
  return {
    coverage, width, height,
    w: pic.w + 2 * pic.pad, h: pic.h + 2 * pic.pad,
    left: pic.pad, advance, baseline: pic.pad + baseline,
  };
}

/** Why a PDF stopped, for text it could not draw at all. */
export function undrawableTextError(text: string): Error {
  return new Error(`This PDF cannot draw "${text.slice(0, 40)}": no font it can embed has those letters and a picture of the words could not be made. Add a font with those letters, or export a PNG.`);
}
