// SPDX-License-Identifier: MPL-2.0
import { isFlagOnSync, LEARNING_FLAG } from '../feature-flags.ts';
import { t } from '../i18n.ts';

export const learningEnabled = (): boolean => isFlagOnSync(LEARNING_FLAG);

export function requireLearningFeature(): void {
  if (!learningEnabled()) throw new Error(t('Turn on Training and courses in Settings to use this feature.'));
}

/** A direct course address stays useful without creating or changing a module. */
export function showLearningFeatureGate(root: HTMLElement): boolean {
  if (learningEnabled()) return false;
  const doc = root.ownerDocument;
  const section = doc.createElement('section'); section.className = 'view-empty';
  const heading = doc.createElement('h1'); heading.textContent = t('Training and courses');
  const message = doc.createElement('p'); message.textContent = t('Turn on Training and courses in Settings to use this feature.');
  section.append(heading, message);
  for (const [href, label] of [['#/settings?focus=feature-flags-section', t('Feature flags')], ['#/p', t('Projects')]] as const) {
    const row = doc.createElement('p');
    const link = doc.createElement('a'); link.href = href; link.textContent = label;
    row.append(link); section.append(row);
  }
  root.replaceChildren(section);
  return true;
}
