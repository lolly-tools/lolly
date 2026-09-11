// SPDX-License-Identifier: MPL-2.0
/**
 * The on-device model tier's UI seam (plans/126 WP-A) - shared by the verify
 * view's text-signals panel and the catalog's Analyse-text panel, so the
 * consent line, the estimate row and the honesty copy can never drift.
 *
 * A panel builder calls `aiModelSlot(panel, cls, render)` while assembling its
 * HTML. What comes back depends on what is honestly available:
 *
 *  - model staged + text eligible: a hidden slot plus a queued post-render
 *    wire-up. Model already cached → the check runs immediately; downloadable
 *    → a consent button naming the one-time size (an explicit click is the
 *    consent - a verify page must never start a 100+ MB download by itself).
 *    A conclusive estimate re-renders the WHOLE panel through the caller's own
 *    `render` with the engine's `applyModelEstimate` fold, so the gauge, band
 *    and findings list all move together; an inconclusive run says so in one
 *    quiet line (the check ran - that is worth saying; "nothing conclusive"
 *    is not exoneration and the copy does not claim it).
 *  - model absent (unstaged deploy): NOTHING interactive - the deterministic
 *    tiers are the whole story (the progressive-enhancement promise). The one
 *    exception is an honesty line on a band-none verdict over eligible prose:
 *    clean text proves nothing either way, and the panel should say so rather
 *    than read as a clean bill of health.
 *  - text ineligible (short, or not mostly Latin-script): nothing at all. The
 *    detector is English-trained and documented to over-score non-native
 *    prose; not asking is the bias guard.
 */

import { t, tRaw } from '../i18n.ts';
import { escape } from '../utils.ts';
import { analyzeTextSignals, applyModelEstimate } from '@lolly/engine';
import { textSignalPanel, type TextSignalPanel } from './valid-text.ts';
import {
  aiDetectAvailable, aiDetectEligible, aiDetectStatus, aiDetectModelBytes, scoreAiText,
} from '../lib/ai-detect.ts';

interface Slot {
  text: string;
  source: 'digital' | 'ocr';
  render: (p: TextSignalPanel) => string;
}

const slots = new Map<number, Slot>();
let seq = 0;

/**
 * The model-tier fragment for one rendered panel. `cls` styles the note in the
 * caller's CSS context (a literal, never user data); `render` is the caller's
 * own panel builder, used to re-render in place on a conclusive estimate.
 */
export function aiModelSlot(panel: TextSignalPanel, cls: string, render: (p: TextSignalPanel) => string): string {
  const text = panel.text;
  if (text == null) return '';
  // Already enriched - the re-render must not offer the check again.
  if (panel.rows.some((r) => r.kind === 'model-estimate')) return '';
  // Source code is out of the model's domain: the classifier was trained on
  // prose and rates ORDINARY human code ~0.99 "AI" (measured at staging, gate
  // step 6) - the analyser's docKind detection is the guard.
  if (panel.docKind === 'code') return '';
  if (!aiDetectEligible(text)) return '';
  if (!aiDetectAvailable()) {
    return panel.band === 'none'
      ? `<p class="${cls}">${escape(t('No writing tells were found. Clean text, human or AI, often carries none - tells alone cannot prove origin.'))}</p>`
      : '';
  }
  const idx = ++seq;
  slots.set(idx, { text, source: panel.pixelSourced ? 'ocr' : 'digital', render });
  // After the current task: every caller assigns its panel string into the DOM
  // synchronously, so the slot is findable by the time this runs.
  queueMicrotask(run);
  return `<p class="${cls}" data-aidet="${idx}" hidden></p>`;
}

function run(): void {
  if (typeof document === 'undefined') { slots.clear(); return; } // node tests: no DOM
  for (const [idx, s] of [...slots]) {
    slots.delete(idx);
    const el = document.querySelector<HTMLElement>(`[data-aidet="${idx}"]`);
    if (!el) continue; // that panel was replaced before the microtask ran
    void wire(el, s).catch(() => { el.remove(); });
  }
}

async function wire(el: HTMLElement, s: Slot): Promise<void> {
  const status = await aiDetectStatus();
  if (!el.isConnected) return;
  if (status === 'unstaged') { el.remove(); return; }
  if (status === 'ready') return runCheck(el, s);
  // need-download: the click IS the consent.
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn';
  btn.textContent = t('Run the deeper AI check');
  const note = document.createElement('span');
  note.textContent = ` ${tRaw('Downloads the on-device detector once (~{mb} MB). The text never leaves this device.', { mb: Math.round(aiDetectModelBytes() / 1048576) })}`;
  el.append(btn, note);
  el.hidden = false;
  btn.addEventListener('click', () => { void runCheck(el, s).catch(() => { el.remove(); }); }, { once: true });
}

async function runCheck(el: HTMLElement, s: Slot): Promise<void> {
  el.replaceChildren();
  el.textContent = t('Checking with the on-device detector…');
  el.hidden = false;
  const est = await scoreAiText(s.text, {
    onProgress: (f) => {
      if (!el.isConnected) return;
      el.textContent = f >= 1
        ? t('Checking with the on-device detector…')
        : tRaw('Downloading the detector… {pct}%', { pct: Math.round(f * 100) });
    },
  });
  if (!el.isConnected) return;
  if (!est) { el.remove(); return; }
  if (est.probAi < est.threshold) {
    // The run happened and was inconclusive - said plainly, claimed as nothing.
    el.textContent = t('The on-device detector found nothing conclusive in this text.');
    return;
  }
  const enriched = applyModelEstimate(analyzeTextSignals(s.text, { source: s.source }), est);
  const panel: TextSignalPanel = { ...textSignalPanel(enriched), text: s.text };
  const host = el.closest<HTMLElement>('[data-tsig-root]');
  if (!host) { el.remove(); return; }
  // The caller's own builder, whole-panel: gauge, band, rows and summary move
  // together. Same escaped-template family as the original render.
  host.outerHTML = s.render(panel);
}
