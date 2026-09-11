// SPDX-License-Identifier: MPL-2.0
/**
 * The asset picker's format and embeddability rules - pure, DOM-free, testable.
 *
 * Extracted from views/picker.ts for maintainability-2026-07-29.md item 2, the
 * third increment after catalog-filter.ts and tool-history.ts. views/picker.ts is
 * 3,155 lines with only `picker-initial-tab.test.ts` against it.
 *
 * WHY THIS CLUSTER. These decide what an upload is STORED as (a wrong answer
 * writes `holiday.heic` as `.bin`, or an Opus recording as `.mp3`) and which
 * tools may be embedded into a slot. They are long ladders of string tests - 
 * exactly the shape where a missing branch is invisible on inspection and obvious
 * to a test, and where the interesting cases are the aliases: jpeg/jpg,
 * heic/heif, oga→ogg, quicktime→mov, m4a via an mp4 mime.
 *
 * Everything here is a pure function of its arguments; `relTime` takes `now` so
 * it is testable without faking the clock, and takes its own translator so this
 * module does not depend on the i18n runtime.
 */

/** True video containers. */
export const VIDEO_FMTS: ReadonlySet<string> = new Set(['webm', 'mp4']);
/** Raster containers that nonetheless carry motion. */
export const RASTER_MOTION_FMTS: ReadonlySet<string> = new Set(['gif', 'apng']);
/** Image formats a composed tool render can produce (mirrors compose.ts IMAGE_FORMATS). */
export const IMG_FORMATS: ReadonlySet<string> = new Set(['svg', 'png', 'jpg', 'jpeg', 'webp']);

/**
 * A file extension for a mime type. Returns 'bin' when nothing matches, which
 * callers treat as "unknown" rather than as a real extension.
 *
 * Substring tests, not equality: real mime strings carry parameters
 * (`image/jpeg; charset=binary`) and vendor prefixes, so `includes` is
 * deliberate. The ordering matters where one type contains another.
 */
export function extFromMime(mime: string): string {
  if (mime.includes('json')) return 'json';
  if (mime.includes('svg')) return 'svg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('avif')) return 'avif';
  if (mime.includes('heic') || mime.includes('heif')) return 'heic';
  if (mime.includes('tiff')) return 'tiff';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('quicktime')) return 'mov';
  if (mime.includes('mp4') || mime.includes('m4v')) return 'mp4';
  return 'bin';
}

/**
 * The audio format to store an uploaded file as.
 *
 * FILENAME EXTENSION WINS over the mime type, because browsers disagree wildly
 * on audio mimes (an .opus file is served as audio/ogg by some, application/
 * octet-stream by others) while the extension is what the user actually chose.
 * The mime ladder is the fallback, and 'mp3' the last resort - a wrong-but-
 * playable guess beats 'bin'.
 */
export function audioFormatOf(file: { name: string; type: string }): string {
  const n = file.name.toLowerCase();
  const t = file.type.toLowerCase();
  const m = n.match(/\.(mp3|wav|ogg|oga|opus|m4a|aac|flac)$/);
  if (m) return m[1] === 'oga' ? 'ogg' : (m[1] as string);
  if (/mpeg|mp3/.test(t)) return 'mp3';
  if (/wav/.test(t)) return 'wav';
  if (/opus/.test(t)) return 'opus';
  if (/ogg/.test(t)) return 'ogg';
  if (/aac/.test(t)) return 'aac';
  if (/flac/.test(t)) return 'flac';
  if (/mp4|m4a/.test(t)) return 'm4a';
  const ext = extFromMime(file.type);
  return ext && ext !== 'bin' ? ext : 'mp3';
}

/**
 * Narrow a tool's export formats to the ones sensible for the slot's asset type.
 *
 * Every branch FALLS BACK to the full list when filtering would empty it: a slot
 * offering no formats at all is a dead end for the user, so an over-strict filter
 * must degrade to "show everything" rather than to nothing.
 */
export function formatsForType(formats: readonly string[], type: string | undefined): readonly string[] {
  if (type === 'vector') {
    const svgOnly = formats.filter((f) => f === 'svg');
    return svgOnly.length ? svgOnly : formats;
  }
  if (type === 'video' || type === 'lottie') {
    const motion = formats.filter((f) => VIDEO_FMTS.has(f) || RASTER_MOTION_FMTS.has(f));
    return motion.length ? motion : formats;
  }
  const kept = formats.filter((f) => !VIDEO_FMTS.has(f));
  return kept.length ? kept : formats;
}

/** The subset of a tool manifest this module reads. */
export interface EmbeddableTool {
  exportable?: boolean;
  formats?: readonly string[];
}

/**
 * Can this catalog tool be rendered into an embeddable image?
 *
 * Mirrors the gate compose uses: it must be exportable AND emit at least one
 * image format - SVG specifically for a vector slot. Described-but-non-image
 * tools (pdf/ics only) and non-exportable transform utilities (strip-data,
 * compress-pdf) are dropped. `exportable !== true` rather than a falsy test, so
 * a manifest that omits the flag is excluded rather than assumed embeddable.
 */
export function isEmbeddable(tool: EmbeddableTool | undefined, needsSvg: boolean): boolean {
  if (!tool || tool.exportable !== true || !Array.isArray(tool.formats)) return false;
  const fmts = tool.formats.map((f) => String(f).toLowerCase());
  return needsSvg ? fmts.includes('svg') : fmts.some((f) => IMG_FORMATS.has(f));
}

/**
 * A saved session records its last export format; seed the render card with it
 * only when that was an image format, else return undefined and let the caller
 * choose (it defaults to SVG). 'jpeg' normalises to 'jpg' so the seed matches the
 * format ids the picker actually offers.
 */
export function imageFormatSeed(fmt: unknown): string | undefined {
  const f = String(fmt ?? '').toLowerCase();
  return IMG_FORMATS.has(f) ? (f === 'jpeg' ? 'jpg' : f) : undefined;
}

/** Translator shape - matches i18n's `t` exactly, so the app's own function is
 *  assignable without a cast; tests pass a plain formatter with the same shape. */
export type Translate = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Compact relative time for a saved session ("3d ago").
 *
 * `now` is injected rather than read from Date.now() so the boundaries are
 * testable. An unparseable or missing timestamp yields '' - a session row with no
 * date should show nothing, not "NaN ago". A FUTURE timestamp (clock skew, a file
 * copied from another machine) clamps to 0 and reads "just now" rather than
 * counting backwards.
 */
export function relTime(iso: string | undefined, now: number, t: Translate): string {
  const ts = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(ts)) return '';
  const s = Math.max(0, (now - ts) / 1000);
  if (s < 60) return t('just now');
  const m = s / 60; if (m < 60) return t('{n}m ago', { n: Math.floor(m) });
  const h = m / 60; if (h < 24) return t('{n}h ago', { n: Math.floor(h) });
  const d = h / 24; if (d < 7) return t('{n}d ago', { n: Math.floor(d) });
  const w = d / 7; if (w < 5) return t('{n}w ago', { n: Math.floor(w) });
  const mo = d / 30; if (mo < 12) return t('{n}mo ago', { n: Math.floor(mo) });
  return t('{n}y ago', { n: Math.floor(d / 365) });
}
