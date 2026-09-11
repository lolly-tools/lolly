// SPDX-License-Identifier: MPL-2.0
/**
 * SCORM package export - the shell half (plans/180 section 6, milestone M-D1).
 *
 * The pure half is `engine/src/scorm.ts`: the two manifests, the runtime adapter source
 * and the D1 launch page are all string builders there, so the CLI can inherit them the
 * way it inherits `.pptx` and `.penpot`. What is left for the shell is exactly the part
 * that needs a browser: photographing each artboard, encoding the narrated film, reading
 * the font files off the registry, and zipping the result.
 *
 * D1, not D2. The package is packaged slide IMAGES driven by the launch page's own
 * navigator, plus the narrated video with a caption track - not the live presenter DOM.
 * It loses motion and gains working in every LMS, offline, with no bundler and no font
 * chasing. Section 6 recommends shipping it first and it is what this module builds.
 *
 * SVG where the deck is vector. The slide stills go through the same per-artboard export
 * every other multi-page path uses, so an artboard that can be drawn as vector is drawn
 * as vector - a 6 KB `<radialGradient>` instead of a 700 KB screenshot - and only a deck
 * that genuinely needs pixels pays for them.
 *
 * Two things are INJECTED rather than imported: the still renderer and the film renderer.
 * Both need the live export bridge, the offscreen stage and the timeline compositor, none
 * of which exist under `node --test`, and the packaging rules (what is in the zip, what
 * the manifest lists, whether the credentialed bytes came through untouched) are exactly
 * what wants testing. So the caller in views/tool-actions.ts passes two closures over
 * `runtime.export`, and the suite passes two fakes.
 *
 * Provenance (section 7): the narration bytes reach the package VERBATIM - the film is
 * whatever the video export produced, credential and all, and nothing here re-encodes it.
 * The captions come from the spoken words' own timings through `cuesForSlide`, never a
 * second pass over the audio. An LMS shows no credential UI at all, so the launch page
 * carries a visible synthetic-voice line as well.
 */
import { cuesForSlide, cuesToVtt, scormAdapterJs, scormLaunchHtml, scormManifest } from '@lolly/engine';
import type { CaptionCue, ScormFont, ScormLaunchLabels, ScormSlide, ScormVersion } from '@lolly/engine';
import type { SpeechWordTiming } from '@lolly-tools/core/host-v1';
import { zipAsync } from '../lib/zip.ts';
import { faceSourceBytes, resolveVectorFont } from './font-registry.ts';
import { TTS_DECLARATION } from '../lib/tts-provenance.ts';

/** Where each family of file sits in the package. Relative, always - an LMS serves the
 *  package from a path nobody can predict, and some proxy it. */
const MANIFEST_NAME = 'imsmanifest.xml';
const LAUNCH_NAME = 'index.html';
const ADAPTER_NAME = 'scorm/api.js';
const SLIDE_DIR = 'slides';
const MEDIA_DIR = 'media';
const FONT_DIR = 'fonts';

/** Upper bound on slides in one package - the same order of magnitude the pptx writer
 *  allows itself (MAX_DECK_SLIDES), so a runaway document cannot spend the tab. */
const MAX_SCORM_SLIDES = 500;
/** Upper bound on packaged font files. The launch page's own chrome uses one face; a
 *  handful covers a deck that names a display face as well. */
const MAX_SCORM_FONTS = 4;

/** One artboard to photograph, plus what the launch page says about it. */
export interface ScormSlideInput {
  /** The `[data-pdf-page]` element for this slide. */
  el: Element;
  /** Speaker notes - the same text that was narrated. Shown under the slide. */
  notes?: string;
  /** Alt text. The launch page falls back to "Slide N" when this is empty. */
  alt?: string;
}

/** A packaged still. `ext` decides the file name and nothing else - the bytes are
 *  written as they arrive. */
export interface ScormStill {
  bytes: Uint8Array;
  ext: 'svg' | 'png';
}

/** The narrated film and, when the export produced one, its caption sidecar. */
export interface ScormFilm {
  bytes: Uint8Array;
  ext: 'mp4' | 'webm';
  /** A ready-made WebVTT. Ignored when `narration` slices are supplied, which are the
   *  better source: they are the spoken words' own timings. */
  captionsVtt?: string;
}

/** A font file to serve from the package. woff2 ONLY - the launch page's `@font-face`
 *  declares `format("woff2")`, and a TTF announced as woff2 is a face no browser loads. */
export interface ScormFontFile {
  family: string;
  bytes: Uint8Array;
  weight?: string | number;
  style?: string;
}

/**
 * One slide's narration, as the caption writer needs it (plans/180 T4).
 *
 * `words` are the clip's OWN word timings - `meta.tts.words`, media seconds from the
 * start of the sound. They are never re-derived by transcribing the audio: that would be
 * a second, weaker claim about text we already know exactly (section 7).
 */
export interface ScormNarrationSlice {
  words: readonly SpeechWordTiming[];
  /** Where this slide starts on the film clock, ms. */
  startMs: number;
  /** Where it ends, ms. Cues are clamped to the window. */
  endMs: number;
  /** How far into the slide the clip's own t=0 sits - the lead-in (T2). */
  offsetMs?: number;
}

/** Photograph one artboard. Injected: the real one calls `runtime.export`. */
export type ScormStillRenderer = (el: Element, index: number) => Promise<ScormStill | null>;
/** Encode the narrated film. Injected for the same reason. Absent (or answering null)
 *  means the package is slides only. */
export type ScormFilmRenderer = () => Promise<ScormFilm | null>;

export interface ScormPackageOpts {
  /** The course title: the LMS's own navigation label and the launch page's heading. */
  title: string;
  slides: readonly ScormSlideInput[];
  renderStill: ScormStillRenderer;
  renderFilm?: ScormFilmRenderer | null;
  /** Per-slide narration for the caption sidecar. Preferred over `ScormFilm.captionsVtt`. */
  narration?: readonly ScormNarrationSlice[];
  fonts?: readonly ScormFontFile[];
  /** SCORM 1.2 by default - the widest floor. 2004 4th ed. is the option. */
  version?: ScormVersion;
  /** BCP 47 tag for the launch page itself - the reader's language. Default `en`. */
  lang?: string;
  /** The launch page's visible chrome, translated by the caller. The engine has no i18n,
   *  so without these a package stamped `<html lang="nl">` still reads "Previous"/"Next". */
  labels?: ScormLaunchLabels;
  /** BCP 47 tag for the caption track - the language actually SPOKEN, which is not the
   *  same question. This build's narration is English only (plans/180 section 2), so it
   *  defaults to `en` rather than following the page. */
  captionLang?: string;
  /** The visible synthetic-voice line. Defaults to the canonical TTS declaration when
   *  the package carries narration; omitted entirely when it does not. */
  aiVoiceNote?: string;
  /** Slides done / slides total, so the export shutter can show progress. */
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

/** What the packager built: the zip and the file list the manifest declares. */
export interface ScormPackage {
  blob: Blob;
  /** Every packaged path, `imsmanifest.xml` included, in write order. */
  files: string[];
  /** How many slides were photographed. Fewer than `slides.length` when a render failed. */
  slideCount: number;
  /** Whether the narrated film made it into the package. */
  hasFilm: boolean;
}

/** A file name segment safe on every filesystem a learner may unzip onto. */
function safeSegment(raw: string, fallback: string): string {
  const s = String(raw ?? '').trim().toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return s || fallback;
}

/** woff2's magic number, `wOF2`. Sniffed rather than trusted from the URL: a face served
 *  without an extension is common, and a mislabelled file breaks the @font-face silently. */
function isWoff2(bytes: Uint8Array | null | undefined): boolean {
  return !!bytes && bytes.length > 4
    && bytes[0] === 0x77 && bytes[1] === 0x4f && bytes[2] === 0x46 && bytes[3] === 0x32;
}

/**
 * The caption cues for the whole film, on the film's clock.
 *
 * Each slice is clamped to its own slide's window by `cuesForSlide`, so a slide someone
 * shortened by hand cannot spill its last cue over the next slide's first words (T4).
 * Pure, and exported for the suite.
 */
export function scormNarrationCues(slices: readonly ScormNarrationSlice[]): CaptionCue[] {
  const out: CaptionCue[] = [];
  for (const s of slices) {
    if (!s?.words?.length) continue;
    out.push(...cuesForSlide(s.words, s.startMs, s.endMs, { offsetMs: s.offsetMs ?? 0 }));
  }
  return out.sort((a, b) => a.start - b.start);
}

/**
 * The font files to package, read off the export node's own cascade.
 *
 * Only the launch page's chrome (its heading and the notes under each slide) is HTML -
 * the slides themselves are images carrying their own type - so one face is normally the
 * whole answer, and the page falls back to `system-ui` when nothing resolves. woff2 only:
 * see {@link ScormFontFile}. A missing font is a cosmetic loss, never a failed export, so
 * every failure here degrades silently.
 */
export async function collectScormFonts(node: Element | null | undefined, sample = 'Ag'): Promise<ScormFontFile[]> {
  if (!node || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return [];
  const out: ScormFontFile[] = [];
  const seen = new Set<string>();
  try {
    const cs = window.getComputedStyle(node);
    const style = { fontFamily: cs.fontFamily, fontWeight: cs.fontWeight, fontStyle: cs.fontStyle };
    const resolved = await resolveVectorFont(style, sample);
    const face = resolved?.face;
    if (!face) return out;
    const key = `${face.family}|${face.weight}|${face.style}`;
    if (seen.has(key)) return out;
    seen.add(key);
    const bytes = await faceSourceBytes(face);
    if (bytes && isWoff2(bytes)) out.push({ family: face.family, bytes, weight: face.weight, style: face.style });
  } catch { /* no packaged font - the launch page uses the system stack */ }
  return out.slice(0, MAX_SCORM_FONTS);
}

/**
 * Build the package.
 *
 * Order of work: photograph every slide (the long part, and the cancel point), encode the
 * film, write the captions, then assemble. The manifest is written LAST because it must
 * list every file that actually made it in - a manifest naming a still that failed to
 * render is a package an LMS rejects on import.
 */
export async function buildScormPackage(opts: ScormPackageOpts): Promise<ScormPackage> {
  const version: ScormVersion = opts.version === '2004' ? '2004' : '1.2';
  const lang = String(opts.lang ?? '').trim() || 'en';
  const title = String(opts.title ?? '').trim() || 'Presentation';
  const slidesIn = (opts.slides ?? []).slice(0, MAX_SCORM_SLIDES);

  const zipFiles: Record<string, Uint8Array> = {};
  const enc = new TextEncoder();
  const put = (name: string, body: string | Uint8Array): void => {
    zipFiles[name] = typeof body === 'string' ? enc.encode(body) : body;
  };

  // ── the slides ──────────────────────────────────────────────────────────────
  const launchSlides: ScormSlide[] = [];
  for (let i = 0; i < slidesIn.length; i++) {
    opts.signal?.throwIfAborted();
    opts.onProgress?.(i, slidesIn.length);
    const input = slidesIn[i]!;
    let still: ScormStill | null = null;
    try { still = input.el ? await opts.renderStill(input.el, i) : null; }
    catch { still = null; }
    // A slide that would not render is DROPPED, not packaged as a broken <img>: the
    // learner sees a shorter deck rather than a hole, and the manifest stays truthful.
    if (!still?.bytes?.length) continue;
    const name = `${SLIDE_DIR}/slide-${i + 1}.${still.ext === 'png' ? 'png' : 'svg'}`;
    put(name, still.bytes);
    launchSlides.push({
      src: name,
      ...(input.alt ? { alt: input.alt } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
    });
  }
  opts.onProgress?.(slidesIn.length, slidesIn.length);

  // ── the narrated film and its captions ──────────────────────────────────────
  opts.signal?.throwIfAborted();
  let film: ScormFilm | null = null;
  try { film = opts.renderFilm ? await opts.renderFilm() : null; }
  catch { film = null; }

  const cues = scormNarrationCues(opts.narration ?? []);
  // The slices win when there are any: they are the spoken words' own timings. A
  // ready-made VTT from the video export is the fallback for a deck whose narration
  // this caller could not slice up.
  const vtt = cues.length ? cuesToVtt(cues) : (film?.captionsVtt || '');

  let videoRef: { src: string; captions?: string; lang: string } | undefined;
  if (film?.bytes?.length) {
    const videoName = `${MEDIA_DIR}/deck.${film.ext === 'webm' ? 'webm' : 'mp4'}`;
    // VERBATIM (section 7). The film carries the composite credential the video export
    // signed, and every byte of it is written straight through.
    put(videoName, film.bytes);
    videoRef = { src: videoName, lang: String(opts.captionLang ?? '').trim() || 'en' };
    if (vtt.trim()) {
      const vttName = `${MEDIA_DIR}/deck.vtt`;
      put(vttName, vtt);
      videoRef.captions = vttName;
    }
  }

  // ── fonts ───────────────────────────────────────────────────────────────────
  const fontDecls: ScormFont[] = [];
  (opts.fonts ?? []).slice(0, MAX_SCORM_FONTS).forEach((f, i) => {
    if (!f?.bytes?.length || !String(f.family ?? '').trim()) return;
    const name = `${FONT_DIR}/${safeSegment(f.family, `face-${i + 1}`)}-${safeSegment(String(f.weight ?? '400'), '400')}.woff2`;
    // Two faces that reduce to the same file name would overwrite each other's bytes and
    // leave a second `@font-face` pointing at the first one's file. Skip the later one.
    if (zipFiles[name]) return;
    put(name, f.bytes);
    fontDecls.push({
      family: f.family, src: name,
      ...(f.weight != null ? { weight: f.weight } : {}),
      ...(f.style ? { style: f.style } : {}),
    });
  });

  // ── the adapter and the launch page ─────────────────────────────────────────
  put(ADAPTER_NAME, scormAdapterJs());
  // The synthetic-voice line rides only a package that actually narrates. Saying it on a
  // silent deck would be a claim about content that is not there.
  const narrated = !!videoRef;
  const aiVoiceNote = narrated ? (opts.aiVoiceNote?.trim() || TTS_DECLARATION) : undefined;
  put(LAUNCH_NAME, scormLaunchHtml({
    title, lang, slides: launchSlides, adapterSrc: ADAPTER_NAME,
    ...(opts.labels ? { labels: opts.labels } : {}),
    ...(videoRef ? { video: videoRef } : {}),
    ...(aiVoiceNote ? { aiVoiceNote } : {}),
    ...(fontDecls.length ? { fonts: fontDecls } : {}),
  }));

  // ── the manifest, last, over the files that actually exist ──────────────────
  const contentFiles = Object.keys(zipFiles);
  put(MANIFEST_NAME, scormManifest(version, {
    title, href: LAUNCH_NAME, files: contentFiles,
    identifier: safeSegment(title, 'lolly-package'),
  }));

  const bytes = await zipAsync(zipFiles);
  return {
    blob: new Blob([bytes as BlobPart], { type: 'application/zip' }),
    files: Object.keys(zipFiles),
    slideCount: launchSlides.length,
    hasFilm: narrated,
  };
}
