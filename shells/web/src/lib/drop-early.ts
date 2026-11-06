// SPDX-License-Identifier: MPL-2.0
/**
 * Keep a file dropped on a view before the drop router has loaded.
 *
 * The gallery and Projects load lib/drop-router.ts after they paint, so the router
 * stays off the first-load path. Until it arrives, nothing on the page takes a file
 * drag, so a file dropped in that time gets the browser's default: the tab opens the
 * file and leaves Lolly, or the drop does nothing. On a first visit that gap was
 * 0.2 to 0.6 s on a desktop, 2.4 s on a phone-class CPU over Fast 3G and 8.7 s over
 * Slow 3G (production build, fresh profile). This module is small and loaded with the
 * view, so it can take the drag from the moment the view mounts. It accepts the drop,
 * keeps the files, and hands them to the router when the router attaches
 * (`takeEarlyDrops` in attachDropRouter), which then routes them as if they had been
 * dropped then.
 *
 * Only file drags are taken, by the same rule the router uses. A newer drop replaces
 * the files kept from an older one, and a navigation away drops them: the person has
 * moved on. A root the router already listens on is left alone, so a view that
 * re-mounts over a live router never routes one drop twice.
 */
import { NAV_EVENTS } from '../utils.ts';

/** A drag of files from outside. A drag of Lolly's own tiles (text/lolly-*,
 *  application/x-lolly-*) is never a file import, even where the browser adds the
 *  tile's picture as a file. */
export function isFileDrag(e: DragEvent): boolean {
  const types = e.dataTransfer?.types;
  return !!types?.includes('Files') && !types.some(type => /^(?:text\/lolly-|application\/x-lolly-)/.test(type));
}

interface Holder { files: File[] | null; stop: () => void }
const HOLDERS = new WeakMap<HTMLElement, Holder>();

/** Take file drops on `root` until the drop router attaches there. */
export function holdEarlyDrops(root: HTMLElement): void {
  const previous = HOLDERS.get(root);
  // The router is already listening on this root (a same-route re-mount).
  if (!previous && 'dropReady' in root.dataset) return;
  const ac = new AbortController();
  const holder: Holder = {
    files: previous?.files ?? null,
    stop: () => {
      ac.abort();
      for (const ev of NAV_EVENTS) window.removeEventListener(ev, leave);
      if (HOLDERS.get(root) === holder) HOLDERS.delete(root);
    },
  };
  const leave = (): void => { holder.files = null; holder.stop(); };
  previous?.stop();
  HOLDERS.set(root, holder);
  root.addEventListener('dragover', (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault(); // without it the drop never fires and the browser opens the file
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }, { signal: ac.signal });
  root.addEventListener('drop', (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    const files = [...(e.dataTransfer?.files ?? [])];
    if (files.length) holder.files = files;
  }, { signal: ac.signal });
  for (const ev of NAV_EVENTS) window.addEventListener(ev, leave);
}

/** Stop holding drops on `root` and return the files dropped meanwhile, if any. */
export function takeEarlyDrops(root: HTMLElement): File[] | null {
  const holder = HOLDERS.get(root);
  if (!holder) return null;
  const files = holder.files;
  holder.stop();
  return files;
}
