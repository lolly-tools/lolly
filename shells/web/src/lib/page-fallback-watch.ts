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
/** One emoji character, or a joiner, selector or modifier that builds one. */
const EMOJI_PART = /^[\p{Extended_Pictographic}\p{Emoji_Component}]$/u;

/**
 * Is this text ASCII and emoji only, needing no fallback font for any character? Emoji, with
 * the joiners, selectors and modifiers that build them, are drawn as pictures by the
 * emoji pass. A loop, not one pattern over the whole text: a canvas's text holds its
 * style and script text too, and a pattern with astral emoji ranges ran V8's regular
 * expression stack out on a long one, as an alternation of the overlapping sets
 * backtracked over digits. ASCII is skipped by its code, the rest tested one at a time.
 */
export function isPlainText(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) < 0x80) continue;
    const cp = text.codePointAt(i)!;
    if (cp > 0xffff) i++;
    if (!EMOJI_PART.test(String.fromCodePoint(cp))) return false;
  }
  return true;
}
let codeLoaded = false;

interface Watch { scope: string; running: Promise<void> | null; again: boolean; active: boolean }
const watches = new WeakMap<Element, Watch>();

/** After a paint of `root`, whose tool styles are scoped to `scope`. */
export function notePagePainted(root: Element | null | undefined, scope: string): void {
  if (!root) return;
  let watch = watches.get(root);
  // The common case: nothing outside ASCII and emoji, and no fallback font in use to take away.
  if (!watch?.active && isPlainText(root.textContent ?? '')) return;
  // Offline, this code may never have reached the device, and a failed chunk load would
  // read as a stale app. The page keeps the fonts it has; an export still fills on its own.
  if (!codeLoaded && typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (!watch) { watch = { scope, running: null, again: false, active: false }; watches.set(root, watch); }
  watch.scope = scope;
  if (watch.running) { watch.again = true; return; }
  const w = watch;
  const job = (async (): Promise<void> => {
    try {
      do {
        w.again = false;
        const page = await load();
        codeLoaded = true;
        w.active = await page.syncPageFallbackFonts(root, w.scope);
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
