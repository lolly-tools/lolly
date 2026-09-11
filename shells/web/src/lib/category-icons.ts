// SPDX-License-Identifier: MPL-2.0
/**
 * Library-category glyphs - one Lucide-house icon per Catalog section, so a
 * category reads at a glance and identically everywhere it appears: the Catalog
 * view (views/catalog.ts) and the asset picker (views/picker.ts).
 *
 * Keys mirror LIB_GROUPS (lib/asset-category.ts) plus the sibling sections that
 * render alongside the tag-bucketed groups - 'swatches', 'fonts', 'uploads' - and
 * a couple of synonym aliases ('stock'→photos, 'type'→fonts, 'lottie'→animations)
 * so a caller using either name resolves. This is a thin category→icon-name map;
 * the path data itself lives in lib/icons.ts (the shared registry - see
 * plans/76-component-audit.md recommendation 5), which is where 'palette' and
 * 'filmStrip' are deduped against lib/catalog-summary.ts's near-identical
 * glyphs. Deliberately SEPARATE from that file's own map, which is a different
 * taxonomy (tool categories + asset TYPES like vector/raster) - merging would
 * force one map to carry the other's keys.
 */

import { icon, type IconName } from './icons.ts';

// 18px, matching every other inline glyph in the shell. Colour + vertical
// centring come from the header's flex layout.
const g = (name: IconName): string => icon(name, { size: 18 });

const CATEGORY_ICON: Record<string, string> = {
  // Content Credentials - a shield with a check (provenance / "made with Lolly").
  credentials: g('credentialShield'),
  // Logos - a hexagon brand mark with a struck centre.
  logos: g('hexagon'),
  // Backgrounds - stacked layers (depth / fill behind everything).
  backgrounds: g('layersStack'),
  // Campaign Photos - a megaphone (a campaign / promotion).
  campaign: g('megaphone'),
  // Photos (stock) - a stack of images.
  photos: g('photos'),
  stock: g('photos'),
  // Headshots - a head-and-shoulders portrait.
  headshots: g('headshot'),
  // Icons - the universal triangle / square / circle shapes mark.
  icons: g('shapes'),
  // Illustrations - a vector pen tool (drawn art).
  illustrations: g('penTool'),
  // Animations - a film strip (lottie / video motion).
  animations: g('filmStrip'),
  lottie: g('filmStrip'),
  // Swatches - a painter's palette (colour).
  swatches: g('palette'),
  // Fonts (type) - a serifed "T".
  fonts: g('font'),
  type: g('font'),
  // Your uploads - an image with an up-arrow.
  uploads: g('uploadImage'),
  // More / other - a four-square grid (the catch-all).
  other: g('grid'),
};

/**
 * Lucide-house glyph for a Catalog section key (a LIB_GROUPS key, or one of the
 * sibling sections 'swatches' / 'fonts' / 'uploads'). Falls back to the four-square
 * grid so an unknown key still renders an icon rather than a blank slot.
 */
export function categoryGlyph(key: string): string {
  return CATEGORY_ICON[key] ?? g('grid');
}
