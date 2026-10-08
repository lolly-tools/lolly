// SPDX-License-Identifier: MPL-2.0
/** Node font and picture facts for the same Design drawing pipeline as the web shell. */
import { extractC2paStore } from '@lolly/engine';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { TextMeasureFontsV1 } from '@lolly-tools/core/text-measure-v1';
import type { DesignPageSvgHost } from '../../../engine/src/design-page-svg.ts';
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


/** No credentialed picture is admitted unless a shell can preserve its ingredient record. */
export async function designOpsNodeHost(host: HostV1, ctx: { repoRoot: string }, outlined = true): Promise<{ drawing: DesignPageSvgHost; credentialed: () => boolean } | null> {
  const text = host.text;
  if (!text) return null;
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

  const fonts = await fontsOf(host);
  return {
    drawing: {
      shaper: createNodeTextShaper({ repoRoot: ctx.repoRoot }),
      ...(outlined ? { toPath: (o: Parameters<typeof text.toPath>[0]) => text.toPath(o) } : {}),
      picture,
      ...(fonts ? { fonts } : {}),
    },
    credentialed: () => credentialed,
  };
}
