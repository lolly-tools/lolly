// SPDX-License-Identifier: MPL-2.0
/**
 * The generative-AI provenance pill - shared by the catalog view, its details modal,
 * and the asset picker so they read identically. Styled by `.genai-pill` in
 * styles/parts/catalog.css (a fixed violet, deliberately brand-independent, matching the
 * /verify AI banner). One markup for both forms: the default shows the "GEN AI" text and
 * hides the sparkle; `iconOnly` (or the narrow-tile media query) collapses it to just the
 * sparkle in a circle.
 *
 * The flag reaches `ref.meta.aiGenerated` two ways: authored on a catalog entry
 * (`aiGenerated` in the asset manifest) OR auto-detected from an uploaded file's C2PA
 * content credential (bridge/assets.ts, via the engine's digitalSourceType chain).
 */

import { LEXICON_VERSION } from '@lolly/engine';
import { t, tRaw } from '../i18n.ts';
import { escape } from '../utils.ts';

export type AiKind = 'full' | 'partial';

/** The persisted AI-likelihood note ingest/analyse writes to meta.aiSignals. */
export interface AiSignalsNote { v: number; band: string; score: number; source: string; family?: string; confidence?: string }

// A filled sparkle (big + small twinkle) - the "generative AI" glyph, matching the
// verify view's aiSpark. Only visible when the pill collapses to a circle.
const AI_SPARK_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9z"/><path d="M19 13.5l.8 2.4 2.4.8-2.4.8-.8 2.4-.8-2.4-2.4-.8 2.4-.8z"/></svg>';

/** Read the AI-provenance flag off a resolved asset ref's meta. Returns '' when the
 *  asset carries no AI flag (authored or credential-detected). */
export function assetAiKind(ref: { meta?: Record<string, unknown> } | null | undefined): AiKind | '' {
  const v = ref?.meta?.aiGenerated;
  return v === 'full' || v === 'partial' ? v : '';
}

/** The honest claim the badge asserts. We only state that the asset IS or CONTAINS
 *  AI-generated content - the authoritative degree + provenance live in the credential,
 *  surfaced by the Verify checker (see the details "Check credentials" link). */
export const GENAI_CLAIM = 'This asset is or contains AI-generated content';

/** Render the pill. `iconOnly` forces the sparkle-in-a-circle form (used in the dense
 *  picker grid); otherwise it shows the "GEN AI" text and self-collapses on narrow tiles.
 *  `kind` (full/partial) still gates whether the badge shows, but the wording stays the
 *  same honest claim regardless - we don't over-assert the degree from a badge. */
export function genAiPill(_kind: AiKind, iconOnly = false): string {
  // `.chip` (styles/parts/chips.css) supplies the base pill box (component
  // audit rec 3); `.genai-pill`'s own rule keeps only its deltas - the fixed
  // violet --vf-ai-* gradient, mono type, uppercase - which stay brand-independent.
  return `<span class="chip genai-pill${iconOnly ? ' genai-pill--icon' : ''}" title="${GENAI_CLAIM}">${AI_SPARK_ICON}<span class="genai-pill-lbl">Gen AI</span></span>`;
}

/**
 * The persisted AI-likelihood chip ("AI?") - the SIGNALS glance, distinct from
 * the declared genAiPill above (a fact). Rendered ONLY while the stored note
 * matches the CURRENT tell lexicon (a lexicon bump retires stale verdicts
 * rather than letting them outlive the rules that produced them), and only at
 * the two bands worth a glance. A signal, never proof - the title says so.
 * Shared by the catalog (tiles + details) and the asset picker, so the risk is
 * visible at the moment an ingredient is CHOSEN, not only in the library.
 */
export function aiSignalsChip(ref: { meta?: Record<string, unknown> } | null | undefined): string {
  const sig = ref?.meta?.aiSignals as AiSignalsNote | undefined;
  if (sig && sig.v === LEXICON_VERSION && (sig.band === 'notable' || sig.band === 'strong')) {
    return `<span class="cat-ai-chip" data-band="${escape(sig.band)}" title="${escape(t('Signals consistent with AI-generated text were found in this asset. A signal, not proof.'))}">${escape(t('AI?'))}</span>`;
  }
  // The image/video twin: a maker-pipeline fingerprint persisted at ingest
  // (picker.ts's bare-metadata sniff). Same chip, its own hedged title.
  const maker = ref?.meta?.makerLikely as { vendor?: string; hint?: string } | undefined;
  if (maker?.vendor) {
    return `<span class="cat-ai-chip" data-band="notable" title="${escape(tRaw('This file is packaged the way {vendor} AI products package downloads ({hint}). A signal, not proof.', { vendor: maker.vendor, hint: maker.hint ?? '' }))}">${escape(t('AI?'))}</span>`;
  }
  return '';
}
