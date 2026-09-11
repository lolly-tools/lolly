// SPDX-License-Identifier: MPL-2.0
/**
 * The "Reworded with Lolly" note - the ONE renderer of a reword-watermark
 * detection (engine text-watermark.ts, the green-list scheme of Kirchenbauer
 * et al., arXiv:2301.10226), shared by the verify view and the catalog's
 * Analyse-text panel so the claim and its odds copy can never drift between
 * the two surfaces.
 *
 * A view calls `wmNoteSlot(text, className)` while building its panel HTML: it
 * returns a hidden <p> placeholder (or '' when the reword pack is not staged
 * in this deploy) and queues a post-render check. The check lazy-imports the
 * reworder facade - the catalog deliberately keeps that module off its chunk -
 * and `detectRewordWatermark` scores the text tokenizer-side (never the
 * model), resolving null wherever the check cannot run. The slot is filled
 * ONLY on a detection; on anything else it is removed. Absence renders
 * nothing - the Lolly Imprint rule: most AI text is not Lolly-reworded, so
 * "not found" carries no information and must not look like a verdict.
 *
 * textContent/append only - no markup sink for text that came from a file.
 */
import { t, tRaw } from '../i18n.ts';
import { REWORD_STAGED } from './reword-models.ts';
import { REWORD_WATERMARK } from '@lolly/engine';

/** Texts queued for a post-render check, keyed by their slot id. */
const texts = new Map<number, string>();
let seq = 0;

/** The hidden slot for one analysed text. `className` styles the eventual
 *  note in the caller's own CSS context (a literal, never user data). */
export function wmNoteSlot(text: string, className: string): string {
  if (!REWORD_STAGED) return '';
  const idx = ++seq;
  texts.set(idx, text);
  // After the current task: every caller assigns its panel string into the
  // DOM synchronously, so the slot is findable by the time this runs.
  queueMicrotask(run);
  return `<p class="${className}" data-wm-note="${idx}" hidden></p>`;
}

function run(): void {
  if (typeof document === 'undefined') { texts.clear(); return; } // node tests: no DOM, no check
  for (const [idx, text] of [...texts]) {
    texts.delete(idx);
    const el = document.querySelector<HTMLElement>(`[data-wm-note="${idx}"]`);
    if (!el) continue; // that panel was replaced before the microtask ran
    void (async (): Promise<void> => {
      const { detectRewordWatermark } = await import('./reworder.ts');
      const det = await detectRewordWatermark(text);
      if (!det?.detected || !el.isConnected) { el.remove(); return; }
      const viaWhole = det.tokens >= REWORD_WATERMARK.minTokens && det.p <= REWORD_WATERMARK.pThreshold;
      const z = (viaWhole ? det.z : (det.window?.z ?? det.z)).toFixed(1);
      const strong = document.createElement('strong');
      strong.textContent = t('Reworded with Lolly');
      // tRaw: these land in a TEXT sink (append), where t()'s param escaping
      // would show entities literally.
      el.append(strong, ' ', viaWhole
        ? tRaw('This text carries the statistical watermark Lolly’s on-device reword model leaves in its pattern of word choices (score {z} across {n} tokens). Unmarked text matches this strongly less than once in 10,000 checks.', { z, n: det.tokens })
        : tRaw('A section of this text carries the statistical watermark Lolly’s on-device reword model leaves in its pattern of word choices (score {z} in the strongest section). Unmarked text matches this strongly less than once in 3 million checks.', { z }));
      el.hidden = false;
    })().catch(() => { el.remove(); });
  }
}
