// SPDX-License-Identifier: MPL-2.0
/**
 * A Design frame exported as SVG from the engine's drawing operations, in Node (plan
 * 295, P3d): the CLI's browser-free page export.
 *
 * The same engine call as the web shell's (`designPageSvg`), lent what a Node host has:
 * the content roots' faces through the measure's shaper, HarfBuzz outlines, the asset
 * bytes and the brand's font tokens. Wherever the web shell would draw something this
 * host cannot settle without a browser, the result is a reason instead of a page, and
 * the CLI escalates to the browser tier, which draws the page through the web shell.
 */
import { extractC2paStore, toCssLength, toCssPx, parseDimension } from '@lolly/engine';
import type { ExportOpts, HostV1 } from '@lolly-tools/core/host-v1';
import type { TextMeasureFontsV1 } from '@lolly-tools/core/text-measure-v1';
import type { DesignPageSvg } from '../../../engine/src/design-page-svg.ts';
import { firstFontFamily, tokenFontStack } from './pptx-deck.ts';
import { createNodeTextShaper } from './text-measure.ts';

const MOTION = /\.(json|lottie|mp4|m4v|mov|webm)($|\?|#)/i;
const SOUND = /\.(mp3|wav|ogg|m4a|flac)($|\?|#)/i;

/** The brand's font families by slot, from its font tokens, as the web shell's custom properties carry them. */
async function fontsOf(host: HostV1): Promise<TextMeasureFontsV1 | undefined> {
  const slot = async (name: string): Promise<string | undefined> => {
    try { return firstFontFamily(tokenFontStack(await host.tokens?.resolve(`font.${name}`))); } catch { return undefined; }
  };
  const brand = await slot('brand');
  if (!brand) return undefined;
  const [mono, display, italic] = await Promise.all([slot('mono'), slot('display'), slot('italic')]);
  return { brand, ...(mono ? { mono } : {}), ...(display ? { display } : {}), ...(italic ? { italic } : {}) };
}

/**
 * The page the operations draw for `node`, or the reason the page needs the browser
 * tier. Null when the export is not a Design page at all.
 */
export async function designOpsSvgNode(node: Element | null | undefined, opts: ExportOpts, host: HostV1, ctx: { repoRoot: string }): Promise<{ svg: string } | { reason: string } | null> {
  const doc = opts.sourceDocument;
  if (doc?.toolId !== 'design') return null;
  const frameId = node?.getAttribute?.('data-frame-id');
  if (!frameId) return { reason: 'the export is not a single frame (name one with --s)' };
  if (opts.watermark) return { reason: 'the export carries a watermark' };
  const text = host.text;
  if (!text) return { reason: 'this shell has no text host' };

  let credentialed = false;
  const picture = async (ref: string) => {
    if (ref.includes('?')) return null;
    const asset = await host.assets.get(ref).catch(() => null);
    if (!asset?.url) return null;
    const type = String(asset.type ?? '');
    const meta = (asset as { meta?: { animated?: unknown; tags?: unknown } }).meta;
    if (type === 'audio' || SOUND.test(asset.url) || SOUND.test(ref)) return { media: 'audio' as const };
    if (type === 'lottie' || type === 'video' || MOTION.test(asset.url) || meta?.animated === true || (Array.isArray(meta?.tags) && meta.tags.includes('animated'))) return { media: 'motion' as const };
    const bytes = await host.assets.bytes?.(asset).catch(() => null);
    if (!bytes) return null;
    try { if (extractC2paStore(bytes)) credentialed = true; } catch { /* not a credentialed bitmap */ }
    return { bytes };
  };

  const width = parseDimension(opts.width) ?? undefined;
  const height = parseDimension(opts.height) ?? undefined;
  const dpi = (opts.dpi as number) > 0 ? opts.dpi as number : 96;
  const { designFrames, designPageSvg } = await import('../../../engine/src/design-page-svg.ts');
  const frame = designFrames(doc.values).find((f) => f.id === frameId);
  if (!frame) return { reason: `there is no visible frame "${frameId}"` };
  const w = width ?? { value: frame.width, unit: 'px' as const }, h = height ?? { value: frame.height, unit: 'px' as const };
  const fonts = await fontsOf(host);
  let page: DesignPageSvg;
  try {
    page = await designPageSvg(doc.values, frameId, {
      shaper: createNodeTextShaper({ repoRoot: ctx.repoRoot }),
      ...((opts as { convertPaths?: boolean }).convertPaths !== false ? { toPath: (o: Parameters<typeof text.toPath>[0]) => text.toPath(o) } : {}),
      picture,
      ...(fonts ? { fonts } : {}),
    }, {
      dpi,
      size: { width: toCssLength(w), height: toCssLength(h), px: { w: toCssPx(w), h: toCssPx(h) } },
      ...(opts.meta ? { meta: opts.meta } : {}),
    });
  } catch (error) {
    return { reason: `the drawing could not be compiled (${error instanceof Error ? error.message : String(error)})` };
  }
  if (page.findings.length) return { reason: `the page holds features the drawing operations do not carry yet: ${[...new Set(page.findings.map((f) => `${f.feature} (${f.id})`))].join(', ')}` };
  // The web shell records a credentialed picture's manifest as an ingredient of the export's; this path cannot yet.
  if (credentialed) return { reason: 'a picture carries Content Credentials that only the browser tier records as an ingredient' };
  return { svg: page.svg };
}
