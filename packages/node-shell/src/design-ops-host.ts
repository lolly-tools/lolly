// SPDX-License-Identifier: MPL-2.0
/** Node font and picture facts for the same Design drawing pipeline as the web shell. */
import { assetDependency, extractC2paStore, prepareC2paIngredientFromStore } from '@lolly/engine';
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

/** The most of one picture read for its credential, as the web shell's `credential()` reads (`MAX_CREDENTIAL_SCAN_BYTES`). */
const MAX_CREDENTIAL_SCAN_BYTES = 64 * 1024 * 1024;

/**
 * Each row's picture reference in a Design document, in row order: an asset id, or the
 * reference the picker wrote, with its version pin, so a pinned picture is read at the
 * version the document holds.
 */
function placedRefs(values: Record<string, unknown>): Array<{ id: string; pin?: unknown }> {
  const rows = Array.isArray(values.boxes) ? values.boxes : [];
  const refs: Array<{ id: string; pin?: unknown }> = [];
  for (const row of rows) {
    const image: unknown = row && typeof row === 'object' ? (row as { image?: unknown }).image : undefined;
    if (typeof image === 'string' && image) refs.push({ id: image });
    else if (image && typeof image === 'object' && typeof (image as { id?: unknown }).id === 'string' && (image as { id: string }).id) {
      const { id, pin } = image as { id: string; pin?: unknown };
      refs.push(pin === undefined ? { id } : { id, pin });
    }
  }
  return refs;
}

/**
 * A credentialed picture's own manifest travels as a `componentOf` ingredient of the
 * export's, as on the web shell (plan 326, "ingredients do not depend on the route").
 * The web shell lists two sets: every credentialed catalog or uploaded picture the
 * document places, on any page (the runtime's asset walk over `boxes`, read through
 * `host.assets.credential`), and each picture the page draws (its page host and DOM
 * walker). This Node host has no `credential`, so `ingredients(values)` reads both sets
 * here, in the web shell's order: the document's pictures first, then any picture the
 * page drew that the first set does not hold. One the engine cannot prepare is left
 * out, and each manifest is listed once, by its active label.
 */
export async function designOpsNodeHost(host: HostV1, ctx: { repoRoot: string }, outlined = true): Promise<{ drawing: DesignPageSvgHost; ingredients: (values: Record<string, unknown>) => Promise<IngredientCredential[]> } | null> {
  const text = host.text;
  if (!text) return null;
  const drawn: IngredientCredential[] = [];
  const credentialOf = (bytes: Uint8Array): IngredientCredential | null => {
    try {
      const store = extractC2paStore(bytes);
      const ingredient = store && prepareC2paIngredientFromStore(store.store, store.format);
      return ingredient ? { ...ingredient, relationship: 'componentOf' } as IngredientCredential : null;
    } catch { return null; /* not a credentialed file */ }
  };
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
    const ingredient = credentialOf(bytes);
    if (ingredient && !drawn.some((p) => p.activeLabel === ingredient.activeLabel)) drawn.push(ingredient);
    return { bytes };
  };

  /**
   * The document's credentialed pictures, as the runtime gathers them on the web shell:
   * a catalog or uploaded asset only (never a link or an inline picture), by its source
   * asset without a theme, treatment or file pick, the bytes it was made from, any media.
   */
  const placed = async (values: Record<string, unknown>): Promise<IngredientCredential[]> => {
    const out: IngredientCredential[] = [];
    const seen = new Set<string>();
    for (const ref of placedRefs(values)) {
      let source: ReturnType<typeof assetDependency>;
      try { source = assetDependency(ref as Parameters<typeof assetDependency>[0]); } catch { continue; /* an unreadable version pin */ }
      if (seen.has(source.key)) continue;
      seen.add(source.key);
      try {
        const asset = await host.assets.get(source.id, source.pin ? { version: source.pin.version, ...(source.pin.format ? { format: source.pin.format } : {}) } : undefined);
        if (asset?.source !== 'user' && asset?.source !== 'library') continue;
        const bytes = await host.assets.bytes?.(asset);
        if (!bytes || bytes.byteLength > MAX_CREDENTIAL_SCAN_BYTES) continue;
        const ingredient = credentialOf(bytes);
        if (ingredient && !out.some((p) => p.activeLabel === ingredient.activeLabel)) out.push(ingredient);
      } catch { /* an asset this host cannot resolve has no credential to carry */ }
    }
    return out;
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
    ingredients: async (values) => {
      const listed = await placed(values);
      for (const ingredient of drawn) if (!listed.some((p) => p.activeLabel === ingredient.activeLabel)) listed.push(ingredient);
      return listed;
    },
  };
}
