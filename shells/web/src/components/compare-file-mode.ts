// SPDX-License-Identifier: MPL-2.0
import { compareElement as el } from './compare-elements.ts';
import { t } from '../i18n.ts';

/** PDF keeps its visual default; extracted text is an explicit alternative. */
export function mountPdfComparisonMode(root: HTMLElement, formats: readonly (string | undefined)[], changed: (mode?: 'document') => void): void {
  if (formats.length !== 2 || !formats.every(format => format?.toLowerCase() === 'pdf')) return;
  const label = el('label', t('PDF comparison')), select = el('select', undefined, 'field-select');
  select.setAttribute('aria-label', t('PDF comparison'));
  select.add(new Option(t('Images / PDF pages'), 'visual')); select.add(new Option(t('Extracted document text'), 'document'));
  label.append(select); root.append(label); select.addEventListener('change', () => changed(select.value === 'document' ? 'document' : undefined));
}
