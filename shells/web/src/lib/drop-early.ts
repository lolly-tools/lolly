// SPDX-License-Identifier: MPL-2.0
/**
 * Keep a file dropped while Lolly is still loading, and give the file to the page under
 * the drop once that page can take files.
 *
 * Until a view has attached its own drop handler, nothing on the page takes a file
 * drag, so a file dropped in that time gets the browser's default: the tab opens the
 * file and leaves Lolly. That time starts at the first paint (index.html's boot screen)
 * and runs through the app's download, the view's code and the view's first reads. On
 * a production build, fresh profile, it was 0.7 to 1.2 s to Projects on a desktop, 30 s
 * over Fast 3G and 107 s over Slow 3G. This module is the one hold for all of it:
 *
 *   - index.html's boot script keeps every file drop made before any app code has run
 *     (BOOT_DROPS), and installDropHold(), called first thing in main.ts, takes those
 *     drops over and keeps holding from then on;
 *   - navigate() calls viewLoading() as it starts to mount a view and viewReady() once
 *     the mount has settled, and a file drop that nothing took in between is held;
 *   - a view whose handler arrives after its mount (the gallery and Projects load the
 *     drop router after they paint) calls holdEarlyDrops(root), and the router calls
 *     releaseEarlyDrops(root) once it listens there.
 *
 * A held drop keeps its point, its files and the element it was dropped on. Once no view
 * is loading and no handler it waits for is still on the way, it is dropped again, as the
 * dragenter, dragover and drop a person makes: on the element it was dropped on if that
 * is still shown, deeper if the point is now inside it, or on whatever is at the point
 * when that element has gone or was only standing in for the view (DROP_STAND_IN: the
 * boot screen, the Loading card). So a file dropped on the Start studio's Logos zone
 * while the studio loads goes to Logos, and one dropped elsewhere on the studio goes to
 * the studio's importer. If nothing there takes a file, the front door's chooser opens
 * (the `unclaimed` option).
 *
 * One drop is kept at a time. A second file dropped while one is waiting is refused at
 * once with a note, so every drop is opened once, in the order it was made, or refused
 * in plain words. A drop belongs to the view that was loading when it was made: if the
 * person moves to another view first, it is not opened there, and a note tells them.
 *
 * Only file drags are taken, by the same rule the router uses, and only drags nothing
 * else on the page has taken: this listens on the window after every element's own
 * handler has run. With no view loading and no handler on the way, it takes nothing.
 */

/** A drag of files from outside. A drag of Lolly's own tiles (text/lolly-*,
 *  application/x-lolly-*) is never a file import, even where the browser adds the
 *  tile's picture as a file. index.html's boot script applies the same rule. */
export function isFileDrag(e: DragEvent): boolean {
  const types = e.dataTransfer?.types;
  return !!types?.includes('Files') && !types.some(type => /^(?:text\/lolly-|application\/x-lolly-)/.test(type));
}

/** Marks an element that stands in for a view still loading, such as the boot screen or
 *  the route's Loading card. A held drop is never given to it: once the view is ready,
 *  the drop goes to whatever the view shows at the same point. */
export const DROP_STAND_IN = 'data-drop-stand-in';

/** Where index.html's boot script keeps the drops made before this module has run. */
export const BOOT_DROPS = '__lollyEarlyDrops';

/** A drop index.html's boot script kept. */
export interface BootDrop { files: File[]; x: number; y: number; target: EventTarget | null }

declare global {
  interface Window { __lollyEarlyDrops?: { stop(): BootDrop[] } }
}

/** What happened to a held drop, for the person to read. `files` are file names. */
export type DropNote =
  | { kind: 'held'; files: string[] }
  | { kind: 'busy'; held: string[]; files: string[] }
  | { kind: 'left'; files: string[] }
  | { kind: 'failed'; files: string[] }
  | { kind: 'unclaimed'; files: string[] }
  | { kind: 'done' };

export interface DropHoldOptions {
  /** Show the person what happened to a held drop. */
  tell(note: DropNote): void;
  /** A held drop that nothing at its place took, once its view was ready. */
  unclaimed(files: File[]): void;
}

interface Held { files: File[]; x: number; y: number; target: Element | null; view: string | null }

/** A plain stand-in for DataTransfer where the realm has none (a test DOM). */
interface PlainTransfer { types: string[]; files: File[]; dropEffect: string; effectAllowed: string; getData(): string }

let options: DropHoldOptions | null = null;
/** The view being mounted: its key, null before navigate() has started one (boot), or
 *  undefined when no view is loading. */
let loading: string | null | undefined;
/** The view on screen, once one has mounted. */
let shown: string | null = null;
let held: Held | null = null;
/** Roots whose own drop handler is still on the way (holdEarlyDrops). */
const waiting = new Set<HTMLElement>();
/** True while a held drop is being given to the page, so this never holds it again. */
let replaying = false;
let timer: ReturnType<typeof setTimeout> | undefined;

const isElement = (target: EventTarget | null | undefined): target is Element => (target as Node | null)?.nodeType === 1;
const standsIn = (el: Element): boolean => !!el.closest(`[${DROP_STAND_IN}]`);
const awaited = (node: Node): boolean => [...waiting].some(root => root.contains(node));
const names = (files: File[]): string[] => Array.from(files, file => file.name);

function takes(e: DragEvent): boolean {
  if (!options || replaying || e.defaultPrevented || !isFileDrag(e)) return false;
  if (loading !== undefined) return true;
  return isElement(e.target) && awaited(e.target);
}

function over(e: DragEvent): void {
  if (!takes(e)) return;
  e.preventDefault(); // without it the drop never fires and the browser opens the file
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
}

function drop(e: DragEvent): void {
  if (!takes(e)) return;
  e.preventDefault();
  keep([...(e.dataTransfer?.files ?? [])], e.clientX, e.clientY, e.target);
}

function keep(files: File[], x: number, y: number, target: EventTarget | null): void {
  if (!options || !files.length) return;
  if (held) {
    options.tell({ kind: 'busy', held: names(held.files), files: names(files) });
    return;
  }
  held = { files: [...files], x, y, target: isElement(target) ? target : null, view: loading === undefined ? shown : loading };
  options.tell({ kind: 'held', files: names(files) });
  schedule();
}

/**
 * Hold file drops from now on. Called once, first thing in main.ts: it takes over the
 * drops index.html's boot script kept, and until the first view is ready every file
 * drop is held. Returns the uninstall, for tests.
 */
export function installDropHold(opts: DropHoldOptions): () => void {
  options = opts;
  loading = null;
  shown = null;
  held = null;
  waiting.clear();
  const ac = new AbortController();
  window.addEventListener('dragenter', over, { signal: ac.signal });
  window.addEventListener('dragover', over, { signal: ac.signal });
  window.addEventListener('drop', drop, { signal: ac.signal });
  const boot = window[BOOT_DROPS];
  delete window[BOOT_DROPS];
  for (const early of boot?.stop() ?? []) keep(early.files, early.x, early.y, early.target);
  return () => {
    ac.abort();
    clearTimeout(timer);
    timer = undefined;
    options = null;
    loading = undefined;
    held = null;
    waiting.clear();
  };
}

/** navigate() is mounting `view` (a key that stays the same while the person stays on
 *  that view). A drop held for another view is not opened here. */
export function viewLoading(view: string): void {
  if (!options) return;
  // Roots the previous mount said its handler would reach belong to that mount.
  waiting.clear();
  if (held?.view === null) held.view = view;
  else if (held && held.view !== view) giveUp('left');
  loading = view;
}

/** The mount of `view` has settled: a held drop can go to the page now. */
export function viewReady(view: string): void {
  if (!options || loading !== view) return;
  loading = undefined;
  shown = view;
  schedule();
}

/** The view did not load (an error card, the WebGPU card): a held drop is not opened. */
export function viewFailed(): void {
  if (!options) return;
  loading = undefined;
  shown = null;
  waiting.clear();
  giveUp('failed');
}

/** The handler for drops on `root` is still on the way: keep holding drops on it, even
 *  once its view has mounted, until releaseEarlyDrops(root). A root the drop router
 *  already listens on is left alone, so a view that re-mounts over a live router never
 *  routes one drop twice. */
export function holdEarlyDrops(root: HTMLElement): void {
  if (!options || 'dropReady' in root.dataset) return;
  waiting.add(root);
}

/** The handler for drops on `root` is listening now: give that handler the drop held for `root`. */
export function releaseEarlyDrops(root: HTMLElement): void {
  waiting.delete(root);
  schedule();
}

function giveUp(kind: 'left' | 'failed'): void {
  if (!held || !options) return;
  const files = names(held.files);
  held = null;
  options.tell({ kind, files });
}

function schedule(): void {
  if (!held || timer !== undefined) return;
  // A task later, so the view that just became ready has laid itself out and the
  // Loading card has closed.
  timer = setTimeout(() => { timer = undefined; deliver(); }, 0);
}

function deliver(): void {
  if (!held || !options || loading !== undefined) return;
  const target = placeOf(held);
  if (target && awaited(target)) return; // its handler is still on the way
  const { files, x, y } = held;
  held = null;
  options.tell({ kind: 'done' });
  if (!target || !dropOn(target, files, x, y)) options.unclaimed(files);
}

/** Where a held drop goes now. */
function placeOf(h: Held): Element | null {
  const atPoint = (document.elementsFromPoint?.(h.x, h.y) ?? []).find(el => !standsIn(el)) ?? null;
  const { target } = h;
  const kept = target?.isConnected && !standsIn(target) && (target.checkVisibility?.() ?? !target.closest('[hidden]')) ? target : null;
  if (kept && atPoint && kept.contains(atPoint)) return atPoint;
  return kept ?? atPoint;
}

/** Drop `files` on `target` the way a person does. True when something there took them. */
function dropOn(target: Element, files: File[], x: number, y: number): boolean {
  const realm = target.ownerDocument.defaultView ?? window;
  const transfer = transferOf(files, realm);
  const real = typeof realm.DataTransfer === 'function' && transfer instanceof realm.DataTransfer ? transfer : null;
  const fire = (type: string): boolean => {
    const init = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y };
    let event: Event;
    if (real) event = new realm.DragEvent(type, { ...init, dataTransfer: real });
    else {
      event = new realm.Event(type, init);
      Object.defineProperty(event, 'dataTransfer', { value: transfer });
    }
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
  const input = target.matches('input[type="file"]:not(:disabled)') ? target as HTMLInputElement : null;
  replaying = true;
  try {
    fire('dragenter');
    // A file input takes a dropped file by itself, unless a handler took the drop first.
    if (!fire('dragover') && !input) { fire('dragleave'); return false; }
    if (fire('drop')) return true;
    if (!input || !real) return false;
    input.files = real.files;
    input.dispatchEvent(new realm.Event('input', { bubbles: true, composed: true }));
    input.dispatchEvent(new realm.Event('change', { bubbles: true }));
    return true;
  } finally { replaying = false; }
}

function transferOf(files: File[], realm: Window & typeof globalThis): DataTransfer | PlainTransfer {
  if (typeof realm.DataTransfer === 'function') {
    const transfer = new realm.DataTransfer();
    for (const file of files) transfer.items.add(file);
    transfer.dropEffect = 'copy';
    return transfer;
  }
  return { types: ['Files'], files, dropEffect: 'copy', effectAllowed: 'all', getData: () => '' };
}
