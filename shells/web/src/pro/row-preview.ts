// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode - the link a row's preview opens.
 *
 * The preview popup opens a row in the tool view. The route used to be written out
 * inline in pro/index.ts; here Node tests read it directly (theme-rows.test.ts). It
 * carries the row's theme choices (plans/319 A6), which a row keeps among its values
 * as `__tokenSelection` (pro/folder-rows.ts), so the preview opens in the light or
 * dark and the colourway the row renders in. No DOM.
 */
import { toCssPx } from '@lolly/engine';
import { shareUrlState } from '../lib/share-privacy.ts';
import { savedTokenSelection } from '../lib/theme-choices.ts';
import type { InputModelItem } from '../../../../engine/src/inputs.ts';
import type { ToolManifest } from '../../../../engine/src/loader.ts';
import type { Unit } from '../../../../engine/src/units.ts';

/** The row fields a preview reads. */
export interface PreviewRow {
  toolId: string;
  values: Record<string, unknown>;
  format?: string;
  unit?: string;
  outWidth?: number;
  outHeight?: number;
}

/**
 * The `#/tool/<id>?...` route a row's preview opens. The row's values go through the
 * engine's canonical URL serializer, so the link matches what the single-tool view
 * expects, with `keepUserIds` because it is a same-device link and a user upload
 * resolves there. The row's theme choices ride along as `_themes`. The export size is
 * carried as the reserved `w`/`h` in on-screen px (a physical unit shows at its 96 dpi
 * size), and `full` hides the tool view's sidebar for a clean preview.
 */
export function rowPreviewRoute(row: Readonly<PreviewRow>, manifest: ToolManifest, defaults: { format?: string; unit: string }): string {
  const model = (manifest.inputs ?? []).map((i) => ({ ...i, value: row.values[i.id] ?? i.default })) as InputModelItem[];
  const tokenSelection = savedTokenSelection(row.values.__tokenSelection);
  const qs = shareUrlState(model, { format: row.format || defaults.format, keepUserIds: true, ...(tokenSelection ? { tokenSelection } : {}) });
  const unit = row.unit ?? defaults.unit;
  const toPreviewPx = (v: number) => Math.round(unit === 'px' ? v : toCssPx({ value: v, unit: unit as Unit }));
  let dims = '';
  if (row.outWidth) dims += `&w=${toPreviewPx(row.outWidth)}`;
  if (row.outHeight) dims += `&h=${toPreviewPx(row.outHeight)}`;
  return `#/tool/${encodeURIComponent(row.toolId)}?${qs ? `${qs}&` : ''}full${dims}`;
}
