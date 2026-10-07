// SPDX-License-Identifier: MPL-2.0
/**
 * A Design frame exported as SVG from the engine's drawing operations (plan 295, P3d).
 *
 * The authored document travels on `ExportOpts.sourceDocument`; this module lends the
 * engine what only the web shell has (the HarfBuzz text API, the font registry, the
 * asset host and the live page's colours) and returns the page the operations draw.
 * It returns null, and logs why, whenever the operations do not carry everything the
 * page shows (a finding), or the export is not one frame: the caller then draws the page
 * with the DOM walker, as before. The choice is never silent.
 */
import { createHostTextShaper, extractC2paStore, prepareC2paIngredientFromStore, sfntVerticalMetrics, toCssLength, toCssPx } from '@lolly/engine';
import type { TextFontMetricsV1 } from '@lolly/engine';
import type { TextMeasureFontsV1 } from '@lolly-tools/core/text-measure-v1';
import { _host, exportDims, type ExportOpts } from './export-shared.ts';
import { parseFontFamilies, resolveVectorFont } from './font-registry.ts';
import type { DesignPageSvg, DesignPageSvgHost, DesignPdfPlacement } from '../../../../engine/src/design-page-svg.ts';

const log = (message: string): void => { _host?.log?.('info', message); };

/** Why a page is drawn by the walker, as one sentence. */
function walkerBecause(reason: string): null {
  log(`Design SVG export: drawn by the DOM walker because ${reason}.`);
  return null;
}

/** The brand's font families by slot, as the canvas reads them from its custom properties. */
function fontsOf(node: Element): TextMeasureFontsV1 | undefined {
  const style = getComputedStyle(node);
  const first = (name: string): string | undefined => parseFontFamilies(style.getPropertyValue(name))[0];
  const brand = first('--font-brand');
  if (!brand) return undefined;
  const mono = first('--font-mono'), display = first('--font-display'), italic = first('--font-italic');
  return { brand, ...(mono ? { mono } : {}), ...(display ? { display } : {}), ...(italic ? { italic } : {}) };
}

/** A colour the page writes as `var(...)`, read as the colour the live page computes. */
function colorResolver(node: Element): (css: string) => string | null {
  const cache = new Map<string, string | null>();
  return (css) => {
    if (cache.has(css)) return cache.get(css)!;
    const probe = document.createElement('span');
    probe.style.color = css;
    let out: string | null = null;
    if (probe.style.color) {
      probe.style.display = 'none';
      node.appendChild(probe);
      out = getComputedStyle(probe).color || null;
      probe.remove();
    }
    cache.set(css, out);
    return out;
  };
}

const MOTION = /\.(json|lottie|mp4|m4v|mov|webm)($|\?|#)/i;
const SOUND = /\.(mp3|wav|ogg|m4a|flac)($|\?|#)/i;

/** What the engine needs from this shell to draw `node`'s pages: shaping, outlines, pictures, fonts and colours. */
function pageHost(node: Element, opts: ExportOpts, text: NonNullable<NonNullable<typeof _host>['text']>, assets: NonNullable<typeof _host>['assets']): DesignPageSvgHost {
  const metrics = new Map<string, Promise<TextFontMetricsV1 | undefined>>();
  const shaper = createHostTextShaper({
    toPath: (o) => text.toPath(o),
    ...(text.characters ? { characters: (url: string) => text.characters!(url) } : {}),
    face: async (family, weight, italic, runText) => {
      const font = await resolveVectorFont({ fontFamily: JSON.stringify(family), fontWeight: String(weight), fontStyle: italic ? 'italic' : 'normal' }, runText);
      return font ? { url: font.url, ...(font.variations ? { variations: font.variations } : {}) } : null;
    },
    metrics: (url) => {
      let hit = metrics.get(url);
      if (!hit) {
        hit = fetch(url).then(async (r) => (r.ok ? sfntVerticalMetrics(new Uint8Array(await r.arrayBuffer())) ?? undefined : undefined)).catch(() => undefined);
        metrics.set(url, hit);
      }
      return hit;
    },
  });

  const picture = async (ref: string) => {
    // A treated asset is resolved by the runtime with the document's token choices; leave it to the walker.
    if (ref.includes('?')) return null;
    const asset = await assets.get(ref).catch(() => null);
    if (!asset?.url) return null;
    const type = String(asset.type ?? '');
    const meta = (asset as { meta?: { animated?: unknown; tags?: unknown } }).meta;
    if (type === 'audio' || SOUND.test(asset.url) || SOUND.test(ref)) return { media: 'audio' as const };
    if (type === 'lottie' || type === 'video' || MOTION.test(asset.url) || meta?.animated === true || (Array.isArray(meta?.tags) && meta.tags.includes('animated'))) return { media: 'motion' as const };
    const response = await fetch(asset.url).catch(() => null);
    if (!response?.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    // A credentialed bitmap's own manifest also travels as an ingredient of the export's,
    // as the walker records it, so Verify reads the source's credentials either way.
    if (opts._ingredientSink) {
      try {
        const store = extractC2paStore(bytes);
        const ingredient = store && prepareC2paIngredientFromStore(store.store, store.format);
        if (ingredient && !opts._ingredientSink.some((p) => p.activeLabel === ingredient.activeLabel)) opts._ingredientSink.push({ ...ingredient, relationship: 'componentOf' });
      } catch { /* not a credentialed bitmap */ }
    }
    // The browser can size a format the header reader does not know.
    const bitmap = await createImageBitmap(new Blob([bytes as BlobPart])).catch(() => null);
    const size = bitmap ? { width: bitmap.width, height: bitmap.height } : {};
    bitmap?.close();
    return { bytes, ...size };
  };

  const fonts = fontsOf(node);
  return {
    shaper,
    ...(opts.convertPaths !== false ? { toPath: (o: Parameters<typeof text.toPath>[0]) => text.toPath(o) } : {}),
    picture,
    resolveColor: colorResolver(node),
    ...(fonts ? { fonts } : {}),
  };
}

/** The reasons a page holds features the operations or PDF do not carry, as one phrase. */
const findingList = (findings: ReadonlyArray<{ feature: string; id: string }>): string => [...new Set(findings.map((f) => `${f.feature} (${f.id})`))].join(', ');

/**
 * The page the operations draw, or null when the page belongs to the walker. `node` is the
 * element the export was asked for; only a single frame page qualifies.
 */
export async function designOpsSvg(node: Element, opts: ExportOpts): Promise<Blob | null> {
  const doc = opts.sourceDocument;
  if (doc?.toolId !== 'design') return null;
  const frameId = node.getAttribute('data-frame-id');
  if (!frameId) return walkerBecause('the export is not a single frame');
  // The watermark is an overlay the export adds to the live page, which the walker draws.
  if (opts.watermark) return walkerBecause('the export carries a watermark');
  const text = _host?.text;
  if (!text || !_host?.assets) return walkerBecause('this shell has no text or asset host');
  const d = exportDims(node, opts);
  const { designPageSvg } = await import('../../../../engine/src/design-page-svg.ts');
  let page: DesignPageSvg;
  try {
    page = await designPageSvg(doc.values, frameId, pageHost(node, opts, text, _host.assets), {
      dpi: d.dpi,
      size: { width: toCssLength(d.w), height: toCssLength(d.h), px: { w: toCssPx(d.w), h: toCssPx(d.h) } },
      meta: opts.meta,
    });
  } catch (error) {
    return walkerBecause(`the drawing could not be compiled (${error instanceof Error ? error.message : String(error)})`);
  }
  if (page.findings.length) return walkerBecause(`the page holds features the drawing operations do not carry yet: ${findingList(page.findings)}`);
  log(`Design SVG export: frame ${frameId} drawn from the drawing operations.`);
  return new Blob([page.svg], { type: 'image/svg+xml' });
}

/**
 * A Design document's pages as one PDF from the operations, before the finishing pass,
 * or null when any page belongs to the walker. `place` gives each page's size and
 * artwork box in points, print geometry included.
 */
export async function designOpsPdf(pageEls: readonly Element[], opts: ExportOpts, place: DesignPdfPlacement): Promise<Uint8Array | null> {
  const doc = opts.sourceDocument;
  if (doc?.toolId !== 'design') return null;
  const why = (reason: string) => { log(`Design PDF export: drawn by the DOM walker because ${reason}.`); return null; };
  const ids = pageEls.map((el) => el.getAttribute('data-frame-id'));
  if (!ids.length || ids.some((id) => !id)) return why('a page is not a Design frame');
  if (opts.watermark) return why('the export carries a watermark');
  // The standard password is set as the walker's document is built; the strong tier encrypts finished bytes and composes.
  if (opts.password) return why('the export carries a standard password');
  if (opts.convertPaths === false) return why('the export keeps its words as live text');
  const text = _host?.text;
  if (!text || !_host?.assets) return why('this shell has no text or asset host');
  const { designPagesPdf } = await import('../../../../engine/src/design-page-svg.ts');
  const m = opts.meta;
  const creator = m?.software || 'Lolly';
  let out: { pdf: Uint8Array | null; findings: ReadonlyArray<{ feature: string; id: string }> };
  try {
    out = await designPagesPdf(doc.values, ids as string[], pageHost(pageEls[0]!, opts, text, _host.assets), {
      ...((opts.dpi as number) > 0 ? { dpi: opts.dpi as number } : {}),
      // The document information the walker's PDF carries (applyPdfMeta).
      info: {
        creator, author: m?.author || creator,
        ...(m?.tool ? { title: m.tool } : {}),
        ...(m?.description ? { subject: m.description } : {}),
        ...(m ? { keywords: [m.software, m.source, m.contact].filter(Boolean).join(', ') } : {}),
      },
      place,
    });
  } catch (error) {
    return why(`the drawing could not be compiled (${error instanceof Error ? error.message : String(error)})`);
  }
  if (!out.pdf) return why(`a page holds features the drawing operations or PDF do not carry yet: ${findingList(out.findings)}`);
  log(`Design PDF export: ${ids.length} page${ids.length === 1 ? '' : 's'} drawn from the drawing operations.`);
  return out.pdf;
}
