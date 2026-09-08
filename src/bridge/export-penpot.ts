// SPDX-License-Identifier: MPL-2.0
/**
 * `.penpot` export - the rendered document → the binfile-v3 archive Penpot's own
 * Import reads (plans/178 sections 3.2 + 3.3).
 *
 * Split out of bridge/export.ts the way export-pptx.ts is, and for the same
 * reason: this file owns only what needs a live DOM and the network - reading
 * the tool's authored model off the stage, fetching image bytes, resolving a
 * `var(--brand-…)` through getComputedStyle, serialising an `<svg>` - while ALL
 * of the geometry, the schema and the token filtering live in the engine
 * (engine/src/penpot-file.ts), where they are pure and node-tested. Two
 * producers feed the one writer:
 *
 *   1. the DESIGN tool, which emits its RAW boxes as
 *      `<script type="application/json" data-penpot-doc>` beside the pptx deck
 *      model. Full fidelity - paths, gradients, rotation, blur, shadow, masks -
 *      because the boxes are the document, not a lossy slide lowering;
 *   2. every OTHER tool, through its vector render: the tool's own root `<svg>`
 *      where it has one, else the shell's HTML→SVG walker. The engine lowers
 *      that permissively and, where it meets something Penpot has no construct
 *      for, declines - and the whole SVG rides in as one picture instead, so
 *      fidelity never regresses.
 *
 * The `renderSvgFromHtml` / `ExportOpts` import back from export.ts is the same
 * deliberate, lazy circular edge export-pptx.ts documents: export.ts reaches
 * this module through a dynamic `import()` inside its format dispatch, so
 * nothing here is touched at module-init time.
 *
 * The archive is zipped through lib/zip.ts (the shell's one fflate wrapper) and
 * handed back as `application/x-penpot` - deliberately NOT a zip type, because
 * `extFor` renames a zip-typed blob to `.zip` and Penpot's picker wants
 * `.penpot`.
 */
import {
  ENGINE_VERSION, PENPOT_IMAGE_MTYPES, PENPOT_MIME, boxesToPenpotDoc, buildPenpotEntries,
  decodeDataUrl, imageDimensions, imageToPenpotDoc, markToolComponents, penpotUuid, svgToPenpotDoc,
} from "@lolly/engine";
import type { PenpotDoc, PenpotMedia } from "../../../../engine/src/penpot-file.ts";
import { brandForPenpot } from "../lib/penpot-brand.ts";
import { brandVarTokenPath } from "../brand-vars.ts";
import { domToPenpotDoc } from "../lib/dom-penpot.ts";
import { stampSvgBindings } from "../lib/svg-bindings.ts";
import { bakeTextStyles } from "./export-pptx.ts";
import { renderSvgFromHtml, type ExportOpts } from "./export.ts";

/** Per-image ceiling. Matches the pptx deck path: a `src` is tool-controlled. */
const MAX_PENPOT_IMG_BYTES = 32 * 1024 * 1024;
/** Upper bound on the image fetches one export may spend (bounds the fetch storm). */
const MAX_PENPOT_IMAGES = 200;
/** Elements a walker/native SVG may not sit under; mirrors the CLI's rootSvgOf rule. */
const NON_DRAWABLE = new Set(['script', 'style', 'template', 'link', 'meta']);
const PENPOT_DOC_SEL = 'script[data-penpot-doc]';

const warn = (msg: string): void => { console.warn(`[penpot] ${msg}`); };

// ─── images ───────────────────────────────────────────────────────────────────

/** A readable name for a picture: the URL's last path segment, else "Image". */
function basenameOf(url: string): string {
  if (url.startsWith('data:')) return 'Image';
  try {
    const path = new URL(url, typeof location === 'undefined' ? 'https://lolly.tools/' : location.href).pathname;
    const last = path.split('/').filter(Boolean).pop() ?? '';
    return decodeURIComponent(last) || 'Image';
  } catch { return 'Image'; }
}

/**
 * The media type Penpot will store these bytes as. The blob's own type is trusted
 * when Penpot accepts it; otherwise the magic bytes decide, because a `blob:` URL
 * and a same-origin static file both routinely answer with an empty or generic
 * type. An empty string means "none of Penpot's image types" - the caller then
 * rasterises or drops the picture rather than writing an entry import refuses.
 */
function sniffPenpotMtype(bytes: Uint8Array, hint: string): string {
  const h = hint.toLowerCase().split(';')[0]!.trim();
  if (PENPOT_IMAGE_MTYPES.includes(h)) return h;
  const b = bytes;
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return 'image/webp';
  const head = new TextDecoder().decode(b.subarray(0, Math.min(b.length, 256))).trim();
  if (head.startsWith('<svg') || head.startsWith('<?xml')) return 'image/svg+xml';
  return '';
}

/** Fetch a picture's bytes. `data:` decodes in the engine; everything else is one
 *  size-capped fetch (blob:, same-origin http(s)), and an unreachable or
 *  cross-origin asset drops the picture rather than the export. */
async function fetchImageBytes(url: string): Promise<{ bytes: Uint8Array; hint: string } | null> {
  if (url.startsWith('data:')) {
    const got = decodeDataUrl(url);
    return got && got.bytes.length ? { bytes: got.bytes, hint: got.mtype } : null;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size > MAX_PENPOT_IMG_BYTES) { warn(`${basenameOf(url)} is over ${MAX_PENPOT_IMG_BYTES / (1024 * 1024)} MB; skipped`); return null; }
    return { bytes: new Uint8Array(await blob.arrayBuffer()), hint: blob.type || '' };
  } catch { return null; }
}

/** Last resort for a picture Penpot has no type for (BMP, TIFF, an AVIF the
 *  reader will not take): draw it once and keep the PNG. Null when the browser
 *  cannot decode it either. */
async function rasteriseToPng(bytes: Uint8Array, hint: string): Promise<Uint8Array | null> {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return null;
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: hint || 'application/octet-stream' }));
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('decode'));
      im.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, img.naturalWidth || img.width);
    canvas.height = Math.max(1, img.naturalHeight || img.height);
    const cx = canvas.getContext('2d');
    if (!cx) return null;
    cx.drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    return decodeDataUrl(dataUrl)?.bytes ?? null;
  } catch { return null; } finally { URL.revokeObjectURL(url); }
}

/** Stored pixel size: the engine's header reader first (no decode), then the
 *  browser's own decoder for anything it cannot parse. */
async function measureImage(bytes: Uint8Array, mtype: string): Promise<{ w: number; h: number } | null> {
  const header = imageDimensions(bytes, mtype);
  if (header && header.w > 0 && header.h > 0) return header;
  if (typeof createImageBitmap !== 'function') return null;
  try {
    const bmp = await createImageBitmap(new Blob([bytes as BlobPart], { type: mtype }));
    const out = { w: bmp.width, h: bmp.height };
    bmp.close?.();
    return out.w > 0 && out.h > 0 ? out : null;
  } catch { return null; }
}

/** One URL → one {@link PenpotMedia}, or null with a reason on the console. */
async function mediaFromUrl(url: string, name: string, id = penpotUuid()): Promise<PenpotMedia | null> {
  const got = await fetchImageBytes(url);
  if (!got) { warn(`${name} could not be read; the picture is left out`); return null; }
  let bytes = got.bytes;
  let mtype = sniffPenpotMtype(bytes, got.hint);
  if (!mtype) {
    const png = await rasteriseToPng(bytes, got.hint);
    if (!png) { warn(`${name} is a type Penpot cannot store (${got.hint || 'unknown'}) and could not be redrawn; the picture is left out`); return null; }
    bytes = png;
    mtype = 'image/png';
  }
  const size = await measureImage(bytes, mtype);
  if (!size) { warn(`${name} has no readable pixel size; the picture is left out`); return null; }
  return { id, name, mtype, width: size.w, height: size.h, bytes };
}

// ─── producer 1: the Design tool's own boxes ──────────────────────────────────

interface PenpotDocModel { background: string | undefined; boxes: Array<Record<string, unknown>> }

/** Read the tool-authored raw document off the stage, or null to fall through to
 *  the vector render. Untrusted JSON: shape-checked, never assumed. */
function readPenpotDocModel(node: Element): PenpotDocModel | null {
  const el = node.querySelector?.(PENPOT_DOC_SEL) ?? (node.matches?.(PENPOT_DOC_SEL) ? node : null);
  const text = el?.textContent?.trim();
  if (!text) return null;
  try {
    const raw: unknown = JSON.parse(text);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const boxes = (raw as { boxes?: unknown }).boxes;
    if (!Array.isArray(boxes)) return null;
    const bg = (raw as { background?: unknown }).background;
    return {
      background: typeof bg === 'string' && bg.trim() ? bg.trim() : undefined,
      boxes: boxes.filter((b): b is Record<string, unknown> => !!b && typeof b === 'object' && !Array.isArray(b)),
    };
  } catch { return null; }
}

/** The no-frames artboard size. LAYOUT px (offsetWidth), not the client rect: the
 *  canvas is routinely under a responsive CSS `scale()` and a rect would hand the
 *  writer the on-screen size instead of the document's own. */
function stageSize(node: Element): { w: number; h: number } {
  const el = (node.querySelector?.('.artboard') as HTMLElement | null) ?? (node as HTMLElement);
  const w = el.offsetWidth || 0;
  const h = el.offsetHeight || 0;
  if (w > 0 && h > 0) return { w, h };
  const r = el.getBoundingClientRect?.();
  return { w: Math.max(1, Math.round(r?.width || 1)), h: Math.max(1, Math.round(r?.height || 1)) };
}

/**
 * Resolve a colour the engine's own parser cannot read - a `var(--brand-…)` with
 * no literal fallback, or anything else the cascade owns - by asking the browser:
 * one hidden probe INSIDE the canvas (so the brand variables are in scope), its
 * computed `color` read back as `rgb()`, which the engine does parse. Disposed by
 * the caller; `[data-export-hide]` keeps it out of every other export walk in the
 * unlikely event one runs while it exists.
 */
function makeColorResolver(node: Element): { resolve: (css: string) => string | null; dispose: () => void } {
  let probe: HTMLElement | null = null;
  const resolve = (css: string): string | null => {
    const doc = node.ownerDocument;
    if (!doc || typeof getComputedStyle !== 'function') return null;
    try {
      if (!probe) {
        probe = doc.createElement('span');
        probe.setAttribute('data-export-hide', '');
        probe.setAttribute('aria-hidden', 'true');
        probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:0;height:0;visibility:hidden';
        node.appendChild(probe);
      }
      probe.style.color = '';
      probe.style.color = css;
      if (!probe.style.color) return null;      // the CSS parser refused it outright
      const out = getComputedStyle(probe).color;
      return out && out !== 'rgba(0, 0, 0, 0)' ? out : null;
    } catch { return null; }
  };
  return { resolve, dispose: () => { probe?.remove(); probe = null; } };
}

/**
 * The brand token a Design box's source names (plans/222). A `var(--brand-*)` maps
 * through the SAME table the shell paints from (brand-vars.ts), so a box painted
 * `var(--brand-primary)` binds to `color.semantic.primary`; a bare `sans`/`mono`
 * font role maps to its font token. A bare `{alias}` is handled by the engine
 * itself, so this only sees the brand-specific forms. Returns null for a literal,
 * and the writer re-validates every path against the file's own tokens.
 */
function brandBindToken(css: string, kind: 'color' | 'font'): string | null {
  const s = css.trim();
  const varM = /^var\(\s*(--[\w-]+)/.exec(s);
  if (varM) return brandVarTokenPath(varM[1]!);
  if (kind === 'font') {
    if (s === '' || s === 'sans') return 'font.brand';
    if (s === 'mono') return 'font.mono';
  }
  return null;
}

/** The token PATH a paint source names: a bare `{alias}` directly, else the brand
 *  map. Mirrors the engine's own `boxesToPenpotDoc` resolution so SVG, Design and
 *  HTML producers all bind by the same rule. */
function paintTokenPath(css: string, kind: 'color' | 'font'): string | null {
  const s = css.trim();
  const alias = /^\{([A-Za-z0-9_.-]+)\}$/.exec(s);
  if (alias) return alias[1]!;
  return brandBindToken(s, kind);
}

/** A picture box whose asset is really a sound, a clip or a Lottie paints nothing
 *  on the artboard, so it must not be fetched as an image either. */
function isPictureBox(box: Record<string, unknown>): boolean {
  if (String(box.kind ?? '') !== 'image') return false;
  const img = box.image as { url?: unknown; type?: unknown } | undefined;
  const url = typeof img?.url === 'string' ? img.url : '';
  if (!url) return false;
  const type = String(img?.type ?? '');
  if (type === 'audio' || type === 'video' || type === 'lottie') return false;
  return !/\.(mp3|wav|ogg|m4a|flac|mp4|m4v|mov|webm|json)($|\?|#)/i.test(url);
}

/** Every picture the document references, fetched once per URL. */
async function resolveBoxMedia(boxes: Array<Record<string, unknown>>): Promise<Map<string, PenpotMedia>> {
  const byUrl = new Map<string, PenpotMedia>();
  const byBox = new Map<string, PenpotMedia>();
  let spent = 0;
  for (const box of boxes) {
    if (!isPictureBox(box)) continue;
    const id = String(box.id ?? '');
    if (!id || byBox.has(id)) continue;
    const url = String((box.image as { url: string }).url);
    let media = byUrl.get(url) ?? null;
    if (!media) {
      if (spent >= MAX_PENPOT_IMAGES) { warn(`more than ${MAX_PENPOT_IMAGES} pictures; the rest are left out`); break; }
      spent++;
      media = await mediaFromUrl(url, String(box.name ?? '').trim() || basenameOf(url));
      if (media) byUrl.set(url, media);
    }
    if (media) byBox.set(id, media);
  }
  return byBox;
}

// ─── producer 2: the vector render ────────────────────────────────────────────

/**
 * The single drawable `<svg>` root of a node, descending through single children
 * and ignoring non-drawable siblings and editor-only chrome. Identical rule to
 * the CLI's `rootSvgOf` (shells/cli/src/bridge.ts), so a native-SVG tool lowers
 * from the same markup in the terminal and in the browser.
 */
function rootSvgOf(node: Element | null): Element | null {
  let cur: Element | null = node;
  for (let depth = 0; cur && depth < 8; depth++) {
    if (cur.tagName?.toLowerCase() === 'svg') return cur;
    const kids = Array.from(cur.children).filter(
      (el) => !NON_DRAWABLE.has(el.tagName.toLowerCase()) && !el.hasAttribute('data-export-hide'),
    );
    if (kids.length !== 1) return null;
    cur = kids[0] ?? null;
  }
  return null;
}

/**
 * An SVG string for the node. A tool's own `<svg>` is serialised from a clone with
 * its computed paint and font state baked on as attributes (the lowering reads a
 * detached document, where the tool's stylesheet no longer applies) and its
 * `<style>` blocks then removed, since a stylesheet the lowering cannot evaluate
 * is a hard bail. An HTML-layout tool goes through the shell's own walker, whose
 * default outlines text - real vector geometry in Penpot beats a whole-document
 * picture, which is what a positioned `<tspan>` in a live-text walk would cost.
 */
async function svgTextFor(node: Element, opts: ExportOpts): Promise<string> {
  const root = rootSvgOf(node);
  if (root) {
    const clone = root.cloneNode(true) as Element;
    if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    // Capture a var(--brand-*)/{alias} paint into a data-lolly-bind attribute BEFORE
    // bakeTextStyles resolves it to a hex, so the lowered shape stays token-linked
    // (plans/222). The engine's svgToPenpotDoc reads the attribute and the writer
    // re-validates the paths.
    stampSvgBindings(clone, (css) => paintTokenPath(css, 'color'));
    bakeTextStyles(root, clone);
    clone.querySelectorAll('style, script').forEach((n) => n.remove());
    return new XMLSerializer().serializeToString(clone);
  }
  const blob = await renderSvgFromHtml(node, { ...opts, noBoxShadow: true });
  return await blob.text();
}

// ─── the export ───────────────────────────────────────────────────────────────

export async function renderPenpot(node: Element, opts: ExportOpts): Promise<Blob> {
  const brand = await brandForPenpot();
  const name = opts.meta?.tool?.trim() || 'From Lolly';
  const generatedBy = `lolly/${ENGINE_VERSION}`;
  const shared = {
    name, generatedBy,
    tokens: brand.tokens,
    palette: brand.palette,
    typographies: brand.typographies,
    googleFamilies: brand.googleFamilies,
  };

  let doc: PenpotDoc | null = null;
  const notes: string[] = [];

  // 1. The Design tool's own document, when the stage carries one.
  const model = readPenpotDocModel(node);
  if (model) {
    const media = await resolveBoxMedia(model.boxes);
    const colors = makeColorResolver(node);
    try {
      doc = boxesToPenpotDoc(model.boxes, {
        ...shared,
        canvas: stageSize(node),
        background: model.background,
        fonts: brand.fonts,
        mediaFor: (box) => media.get(String(box.id ?? '')) ?? null,
        resolveColor: colors.resolve,
        bindToken: brandBindToken,
      });
    } finally { colors.dispose(); }
  }

  // 2. An HTML-layout tool (no Design doc, no single root <svg>): the editable-text
  //    DOM producer, so labels stay text and inherited colours stay token-linked.
  //    It is conservative and returns null on anything it cannot carry faithfully,
  //    so the faithful outline/picture path below still catches those - the export
  //    can only match or improve on today's, never regress (plans/222 work pkg E).
  if (!doc && !rootSvgOf(node)) {
    try {
      const dom = await domToPenpotDoc(node, { name, background: opts.background, bindToken: brandBindToken });
      if (dom?.doc.pages[0]?.shapes.length) {
        doc = Object.assign(dom.doc, shared);
        if (dom.report.notes.length) notes.push(...dom.report.notes);
        if (dom.report.fonts.length) notes.push(`fonts used: ${dom.report.fonts.join(', ')} - install them in Penpot to paint the text`);
      }
    } catch (e) { warn(`the editable-text producer bailed (${e instanceof Error ? e.message : 'error'}); using the picture fallback`); }
  }

  // 3. Every other tool: the vector render, lowered - or kept whole as a picture.
  if (!doc) {
    const svg = await svgTextFor(node, opts);
    const lowered = svgToPenpotDoc(svg, { ...shared, background: opts.background });
    if (lowered) {
      notes.push(...lowered.notes);
      for (const pending of lowered.pending) {
        const media = await mediaFromUrl(pending.href, pending.name || basenameOf(pending.href), pending.mediaId);
        if (!media) continue;                 // mediaFromUrl already said why
        (lowered.doc.media ??= []).push(media);
      }
      doc = lowered.doc;
    } else {
      const bytes = new TextEncoder().encode(svg);
      const size = imageDimensions(bytes, 'image/svg+xml') ?? stageSize(node);
      doc = imageToPenpotDoc(
        { id: penpotUuid(), name, mtype: 'image/svg+xml', width: size.w, height: size.h, bytes },
        { ...shared, background: opts.background },
      );
    }
  }

  // Carry the render's active theme selection so the file opens on the theme the
  // canvas was rendered with, not whichever theme is listed first (plans/222 gap #3).
  if (brand.themeSelection) doc.themeSelection = brand.themeSelection;
  // Each top-level board becomes a reusable component under Lolly / Tools / <tool>.
  markToolComponents(doc, name);

  const build = buildPenpotEntries(doc);
  if (notes.length) warn(notes.join('; '));
  if (build.warnings.length) warn(build.warnings.join('; '));

  // Dynamic import keeps fflate out of this chunk, exactly as zipPptxParts does.
  const { zipAsync } = await import('../lib/zip.ts');
  const enc = new TextEncoder();
  const files: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(build.entries)) {
    files[path] = typeof content === 'string' ? enc.encode(content) : content;
  }
  return new Blob([(await zipAsync(files)) as BlobPart], { type: PENPOT_MIME });
}
