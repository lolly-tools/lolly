// SPDX-License-Identifier: MPL-2.0
/**
 * The live page's watch for characters the design system's fonts cannot draw
 * (docs/fallback-fonts.md). The tool view calls `notePagePainted` after each paint. A
 * canvas whose text is all ASCII costs one test of its text and nothing more; otherwise
 * bridge/page-fallback-fonts.ts loads and decides, with the export's own rule, whether a
 * fallback font should draw some of that text. An export started meanwhile waits for that
 * decision (fallback-font-source.ts `pageFillSettled`), so it lays the text out in the
 * same faces the page shows.
 */
import { notePageFill } from '../bridge/fallback-font-source.ts';
import { lazyModule } from './lazy-module.ts';

const load = lazyModule(() => import('../bridge/page-fallback-fonts.ts'));
const ASCII = /^\p{ASCII}*$/u;

interface Watch { scope: string; running: Promise<void> | null; again: boolean; active: boolean }
const watches = new WeakMap<Element, Watch>();

/** After a paint of `root`, whose tool styles are scoped to `scope`. */
export function notePagePainted(root: Element | null | undefined, scope: string): void {
  if (!root) return;
  let watch = watches.get(root);
  // The common case: nothing outside ASCII, and no fallback font in use to take away.
  if (!watch?.active && ASCII.test(root.textContent ?? '')) return;
  if (!watch) { watch = { scope, running: null, again: false, active: false }; watches.set(root, watch); }
  watch.scope = scope;
  if (watch.running) { watch.again = true; return; }
  const w = watch;
  const job = (async (): Promise<void> => {
    try {
      do {
        w.again = false;
        w.active = await (await load()).syncPageFallbackFonts(root, w.scope);
      } while (w.again);
    } catch { /* the page keeps the fonts it had; an export still fills on its own */ }
    finally { w.running = null; }
  })();
  w.running = job;
  notePageFill(job);
}

/** When the canvas is torn down, its fallback families are removed as well. */
export function releasePageWatch(root: Element | null | undefined): void {
  if (!root) return;
  const watch = watches.get(root);
  watches.delete(root);
  if (!watch?.active && !watch?.running) return;
  void (watch.running ?? Promise.resolve()).then(() => load()).then((m) => m.releasePageFallbackFonts(root)).catch(() => {});
}
