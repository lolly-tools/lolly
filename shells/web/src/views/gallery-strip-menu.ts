// SPDX-License-Identifier: MPL-2.0
/**
 * The favourites strip's tile menu, above the Tools and Utilities grids: right-click,
 * a trackpad two-finger tap or a held finger on a tile opens Open / Unfavourite / Share,
 * in the Gallery strip and in Cover Flow alike.
 *
 * It rides the shared tile menu (lib/context-menu.ts), bound to the strip's mount,
 * which outlives every re-mount of the strip inside it. Wrap clones carry the same
 * data-tool, so a clone's menu acts on its original. Cover Flow's covers cannot be
 * hit-tested (see featured-row.ts), so `tileAt` asks the strip which cover is under
 * the pointer. A strip with no favourites yet shows curated picks, so the star row
 * reads Favourite for those.
 */
import { t } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import type { TileContextMenuHandle } from '../lib/context-menu.ts';

const OPEN_ICON = icon('externalLink');
const STAR_ICON = icon('star');
const SHARE_ICON = icon('share');

export interface StripMenuDeps {
  /** The strip's mount: the persistent element the strip is re-mounted into. */
  host: HTMLElement;
  /** The Cover Flow cover under a point, or null (the strip handle's tileAt). */
  tileAt(x: number, y: number): HTMLElement | null;
  /** The tile's display name, or undefined when the ref is not a known tool or view. */
  nameOf(ref: string): string | undefined;
  openable(ref: string): boolean;
  isFavourite(ref: string): boolean;
  /** The link Share hands on. */
  linkFor(ref: string): string;
  /** The grid menu's own dispatch, for Open and the star toggle. */
  onAction(act: 'open' | 'fav', ref: string): void;
  /** Copy the link with the grid's feedback, where there is no share sheet. */
  copyLink(ref: string): Promise<void>;
}

export function wireStripMenu(menu: typeof import('../lib/context-menu.ts'), d: StripMenuDeps): TileContextMenuHandle {
  return menu.wireTileContextMenu({
    host: d.host,
    tileSelector: '.ftile[data-tool]',
    refOf: (el) => el.dataset.tool ?? null,
    tileAt: d.tileAt,
    singleHtml: ({ ref }) => d.nameOf(ref) === undefined ? '' : [
      d.openable(ref) ? menu.menuItemHtml('open', OPEN_ICON, t('Open')) : '',
      menu.menuItemHtml('fav', STAR_ICON, d.isFavourite(ref) ? t('Unfavourite') : t('Favourite')),
      menu.menuItemHtml('share', SHARE_ICON, t('Share')),
    ].join(''),
    onAction: (act, target) => {
      if (!target) return;
      if (act === 'open' || act === 'fav') { d.onAction(act, target.ref); return; }
      if (act === 'share') void share(d, target.ref);
    },
  });
}

/** The system share sheet where there is one (it runs straight from the menu click, so
 *  the gesture still counts); the copied link where there is not, or the sheet fails. */
async function share(d: StripMenuDeps, ref: string): Promise<void> {
  if (typeof navigator.share === 'function') {
    try { await navigator.share({ title: d.nameOf(ref), url: d.linkFor(ref) }); return; }
    catch (e) { if ((e as { name?: string })?.name === 'AbortError') return; }
  }
  await d.copyLink(ref);
}
