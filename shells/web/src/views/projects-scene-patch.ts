// SPDX-License-Identifier: MPL-2.0
/**
 * Swap a finished 3-D scene thumb (projects-scene-previews.ts) into the Projects tiles on
 * screen, instead of re-rendering the whole view once per thumb. The new images carry the
 * same attributes sessionTile and folderTile write for a thumb (src/folder-tiles.ts), so the
 * next full render draws the same markup.
 */
import type { Folder } from '../folders.ts';
import type { FeaturedRowHandle } from '../components/featured-row.ts';

interface ScenePatchDeps {
  /** The favourites strip, when one is mounted. */
  strip: FeaturedRowHandle | null;
  folders: readonly Folder[];
  /** Whether a ref has a preview; a folder cover keeps only refs that do. */
  hasPreview(ref: string): boolean;
  isFavourite(folderId: string): boolean;
  /** A starred folder's cover, redrawn for its tile in the favourites strip. */
  folderCover(folder: Folder): string;
}

/** Returns false when no tile for the slot is on screen, so the caller can render instead. */
function patchSceneThumbInPlace(root: HTMLElement, slot: string, thumb: string, d: ScenePatchDeps): boolean {
  const thumbImg = (className: string): HTMLImageElement => {
    const img = document.createElement('img');
    img.className = className;
    img.src = thumb;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    return img;
  };
  const setThumb = (old: Element | null | undefined, className: string): boolean => {
    if (!old) return false;
    if (old instanceof HTMLImageElement) old.src = thumb;
    else old.replaceWith(thumbImg(className));
    return true;
  };
  let found = false;
  root.querySelectorAll(`[data-open-session="${CSS.escape(slot)}"]`).forEach((open) => {
    if (setThumb(open.closest('.folder-tile')?.querySelector('.tile-cover'), 'tile-cover')) found = true;
  });
  if (d.strip?.setPreview(slot, thumb)) found = true;
  // A folder's cover shows its first members, so a folder holding this session redraws
  // that cell on the grid, and (when starred) its cover in the favourites strip.
  for (const f of d.folders) {
    // folderTileOpts drops refs with no preview before folderTile keeps the first four.
    const cell = f.items.filter(i => d.hasPreview(i.ref)).slice(0, 4).findIndex(i => i.ref === slot);
    if (cell >= 0) {
      root.querySelectorAll(`[data-open-folder="${CSS.escape(f.id)}"]`).forEach((open) => {
        setThumb(open.querySelector('.folder-cover .folder-mosaic')?.children[cell], 'folder-cell');
      });
    }
    if (d.isFavourite(f.id) && f.items.slice(0, 4).some(i => i.ref === slot)) {
      d.strip?.setPreview(f.id, d.folderCover(f));
    }
  }
  return found;
}

/** The Projects view's callback for a finished scene thumb: store it on the session
 *  record (so a later full render shows it), patch the tiles on screen, and render only
 *  when none of them is. Everything view-owned is read through a getter at call time. */
export function sceneThumbPatcher(root: HTMLElement, v: {
  mounted(): boolean;
  entry(slot: string): { thumb?: string | null } | undefined;
  render(): void;
  strip(): FeaturedRowHandle | null;
  folders(): readonly Folder[];
  hasPreview(ref: string): boolean;
  isFavourite(folderId: string): boolean;
  folderCover(folder: Folder): string;
}): (slot: string, thumb: string) => void {
  return (slot, thumb) => {
    if (!v.mounted()) return;
    const e = v.entry(slot);
    if (!e) { v.render(); return; }
    e.thumb = thumb;
    const shown = patchSceneThumbInPlace(root, slot, thumb, {
      strip: v.strip(), folders: v.folders(), hasPreview: v.hasPreview, isFavourite: v.isFavourite, folderCover: v.folderCover,
    });
    if (!shown) v.render();
  };
}
