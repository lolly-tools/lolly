// SPDX-License-Identifier: MPL-2.0
import { isFlagOnSync, LEARNING_FLAG } from '../feature-flags.ts';
import { t } from '../i18n.ts';
import { escape as escapeHtml } from '../utils.ts';

export const learningEnabled = (): boolean => isFlagOnSync(LEARNING_FLAG);

export function requireLearningFeature(): void {
  if (!learningEnabled()) throw new Error(t('Turn on Training and courses in Settings to use this feature.'));
}

/** A direct course address stays useful without creating or changing a module. */
export function showLearningFeatureGate(root: HTMLElement): boolean {
  if (learningEnabled()) return false;
  root.innerHTML = `<section class="view-empty"><h1>${escapeHtml(t('Training and courses'))}</h1><p>${escapeHtml(t('Turn on Training and courses in Settings to use this feature.'))}</p><p><a href="#/settings?focus=feature-flags-section">${escapeHtml(t('Feature flags'))}</a></p><p><a href="#/p">${escapeHtml(t('Projects'))}</a></p></section>`;
  return true;
}
