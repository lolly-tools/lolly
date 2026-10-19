// SPDX-License-Identifier: MPL-2.0
/**
 * One Print Sheet cell for a design sent from multi-edit or from the batch grid ("Send
 * to Print Sheet"). The cell holds the design as a live tool link, not a baked render:
 * Print Sheet re-renders each link through host.compose.renderUrl on every mount, so a
 * design edited later is followed. The link carries the design's theme choices as
 * `_themes` (plans/319 A6), and Print Sheet draws each cell in the light or dark and
 * the colourway of the design in that cell. Before, both senders dropped the choices
 * and every cell drew in the design system's defaults. No DOM.
 */
import { buildEmbedUrl } from '@lolly/engine';
import { shareUrlState } from './share-privacy.ts';
import type { InputModelItem } from '../../../../engine/src/inputs.ts';
import type { ToolManifest } from '../../../../engine/src/loader.ts';

/**
 * The embed URL a Print Sheet cell holds for one design: vector where the tool offers
 * it (it scales cleanly for print), else a raster still. `keepUserIds` keeps a user
 * upload's id, for a same-device link. Null when the link would be too long to parse
 * back, so the caller leaves the cell out.
 */
export function printSheetCellUrl(
  manifest: Pick<ToolManifest, 'id' | 'render'>,
  model: InputModelItem[],
  opts: { tokenSelection?: Record<string, string>; keepUserIds?: boolean } = {},
): string | null {
  const formats: string[] = manifest.render?.formats ?? [];
  const format = formats.includes('svg') ? 'svg' : (formats.find(f => ['png', 'jpg', 'jpeg', 'webp'].includes(f)) ?? 'png');
  const query = shareUrlState(model, {
    ...(opts.keepUserIds ? { keepUserIds: true } : {}),
    ...(opts.tokenSelection && Object.keys(opts.tokenSelection).length ? { tokenSelection: opts.tokenSelection } : {}),
  });
  return buildEmbedUrl({ toolId: manifest.id, format, query });
}
