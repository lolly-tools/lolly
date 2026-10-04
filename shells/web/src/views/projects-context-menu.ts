// SPDX-License-Identifier: MPL-2.0
/** Projects grid and favourites share one menu, with strip actions kept local to a tile. */
import { t } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { menuItemHtml, wireTileContextMenu, type TileContextMenuOptions, type TileContextMenuHandle } from '../lib/context-menu.ts';
import type { FeaturedRowHandle } from '../components/featured-row.ts';

interface ProjectMenuDeps extends Pick<TileContextMenuOptions, 'host' | 'bulkHtml' | 'backgroundHtml' | 'onAction'> {
  selected: { size: number; has(ref: string): boolean };
  strip(): FeaturedRowHandle | null;
  singleHtml(kind: string, ref: string): string;
}

export function wireProjectContextMenu(d: ProjectMenuDeps): TileContextMenuHandle {
  return wireTileContextMenu({
    host: d.host,
    tileSelector: '.folder-tile[data-ref][data-kind], [data-fav-strip] .ftile[data-tool]',
    refOf: (tile) => tile.classList.contains('folder-tile--create') || tile.dataset.kind?.startsWith('team-')
      ? null : tile.dataset.ref ?? tile.dataset.tool ?? null,
    tileAt: (x, y) => {
      const tile = d.strip()?.tileAt(x, y);
      return tile?.closest('[data-fav-strip]') ? tile : null;
    },
    isBulkTarget: (ref, tile) => !tile.closest('[data-fav-strip]') && d.selected.size > 1 && d.selected.has(ref),
    singleHtml: (tgt) => tgt.tile?.closest('[data-fav-strip]')
      ? menuItemHtml('fav', icon('star'), t('Unfavourite')) + menuItemHtml('share', icon('share'), t('Share'))
      : d.singleHtml(tgt.data ?? tgt.tile?.dataset.kind ?? 'session', tgt.ref),
    bulkHtml: d.bulkHtml,
    backgroundHtml: d.backgroundHtml,
    onAction: d.onAction,
    className: 'folder-menu projects-menu',
  });
}
