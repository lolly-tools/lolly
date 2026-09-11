// SPDX-License-Identifier: MPL-2.0
import { t } from '../i18n.ts';
import { escapeHtml } from '../lib/html.ts';
import type { TextSignalPanel } from './valid-text.ts';

export function textSignalLabels(panel: TextSignalPanel): { heading: string; bandLabel: string; rows: string } {
  // Static t() so the extractor sees every key; selected by band/kind at render.
  const heading: Record<TextSignalPanel['band'], string> = {
    none: t('No signals that this text was AI-generated'),
    weak: t('A few weak signals that this text may be AI-generated'),
    notable: t('Signals that this text may be AI-generated'),
    strong: t('Strong signals that this text may be AI-generated'),
  };
  const bandLabel: Record<TextSignalPanel['band'], string> = {
    none: t('None'), weak: t('Weak'), notable: t('Notable'), strong: t('Strong'),
  };
  const title: Record<string, string> = {
    'model-fingerprint': t('Model fingerprint'),
    'invisible-char': t('Invisible characters'),
    'tag-chars': t('Hidden tag characters'),
    'variation-selectors': t('Unusual variation selectors'),
    'bidi-override': t('Bidirectional override characters'),
    'mixed-script': t('Mixed-script words'),
    'anomalous-space': t('Unusual spacing'),
    'ai-vocabulary': t('AI-favoured vocabulary'),
    'ai-phrasing': t('AI stock phrasing'),
    'ai-structure': t('AI sentence structure'),
    'claude-tell': t('Claude-associated phrasing'),
    'smart-punctuation': t('Curly quotes / smart punctuation'),
    'em-dash-density': t('Heavy em-dash use'),
    'list-heavy': t('List-heavy structure'),
    'uniform-burstiness': t('Unusually uniform sentences'),
    'chatbot-leftover': t('Chatbot boilerplate'),
    'template-placeholder': t('Unfilled template placeholders'),
    'uniform-paragraphs': t('Unusually uniform paragraphs'),
    'ai-span': t('Concentrated AI-like section'),
    'family-tell': t('Model-associated phrasing'),
    'spelling-variant-mix': t('Mixed US/British spelling'),
    'model-estimate': t('On-device model estimate'),
  };
  const rows = panel.rows.map((r) => `
        <li class="valid-aidecl-row">
          <span class="valid-aidecl-model">${escapeHtml(title[r.kind] ?? r.kind)}</span>
          ${r.detail ? `<span class="valid-aidecl-fact">${escapeHtml(r.detail)}</span>` : ''}
        </li>`).join('');
  return { heading: heading[panel.band], bandLabel: bandLabel[panel.band], rows };
}
