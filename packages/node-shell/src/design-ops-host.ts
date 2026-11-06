// SPDX-License-Identifier: MPL-2.0
/** Node font and picture facts for the same Design drawing pipeline as the web shell. */
import { extractC2paStore, prepareC2paIngredientFromStore } from '@lolly/engine';
import { tokenColorVar } from '../../../engine/src/color-face.ts';
import { brandLeadVars } from '../../../engine/src/token-context.ts';
import type { HostV1, IngredientCredential } from '@lolly-tools/core/host-v1';
import type { TextMeasureFontsV1 } from '@lolly-tools/core/text-measure-v1';
import type { DesignPageSvgHost } from '../../../engine/src/design-page-svg.ts';
import { firstFontFamily, tokenFontStack } from './pptx-deck.ts';
import { createNodeTextShaper } from './text-measure.ts';
import { nodeStrikeMetrics } from './text.ts';

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
 * What a `var(--brand-...)` in a row draws, read from the variables the canvas carries:
 * every colour token by its `--brand-token-<hex>` name, each semantic colour by
 * `--brand-<name>`, and the colourway leads. The web shell reads the same variables off
 * the live canvas, so a page draws one colour on both. A name no token holds answers
 * null, and the row's own fallback draws, or the page goes to the browser tier without one.
 */
async function brandColourResolver(host: HostV1): Promise<((css: string) => string | null) | null> {
  if (!host.tokens) return null;
  try {
    const colours = new Map<string, string>();
    for (const swatch of await host.tokens.colors()) {
      colours.set(tokenColorVar(swatch.ref), swatch.value);
      const semantic = /^color\.semantic\.([a-z-]+)$/.exec(swatch.path);
      if (semantic) colours.set(`--brand-${semantic[1]}`, swatch.value);
    }
    for (const [name, value] of brandLeadVars(await host.tokens.family?.('primary'))) colours.set(name, value);
    return (css) => {
      const name = /^var\(\s*(--brand-[a-z0-9-]+)\s*(?:,[\s\S]*)?\)$/i.exec(css.trim())?.[1];
      return name ? colours.get(name) ?? null : null;
    };
  } catch { return null; }
}

/**
 * A credentialed picture's own manifest travels as a `componentOf` ingredient of the
 * export's, as the web shell's page host and the DOM walker record it (plan 326), so the
 * page no longer needs the browser tier for that alone. `ingredients()` lists them,
 * once each by active manifest; one the engine cannot prepare is left out, as on the web.
 */
export async function designOpsNodeHost(host: HostV1, ctx: { repoRoot: string }, outlined = true): Promise<{ drawing: DesignPageSvgHost; ingredients: () => IngredientCredential[] } | null> {
  const text = host.text;
  if (!text) return null;
  const ingredients: IngredientCredential[] = [];
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
    try {
      const store = extractC2paStore(bytes);
      const ingredient = store && prepareC2paIngredientFromStore(store.store, store.format);
      if (ingredient && !ingredients.some((p) => p.activeLabel === ingredient.activeLabel)) ingredients.push({ ...ingredient, relationship: 'componentOf' } as IngredientCredential);
    } catch { /* not a credentialed bitmap */ }
    return { bytes };
  };

  const fonts = await fontsOf(host);
  const resolveColor = await brandColourResolver(host);
  return {
    drawing: {
      shaper: createNodeTextShaper({ repoRoot: ctx.repoRoot }),
      ...(outlined ? { toPath: (o: Parameters<typeof text.toPath>[0]) => text.toPath(o) } : {}),
      ...(outlined ? { strikeMetrics: (url: string, variations?: string[]) => nodeStrikeMetrics(url, variations, ctx.repoRoot) } : {}),
      picture,
      ...(fonts ? { fonts } : {}),
      ...(resolveColor ? { resolveColor } : {}),
    },
    ingredients: () => [...ingredients],
  };
}
