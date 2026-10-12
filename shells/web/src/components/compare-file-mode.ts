// SPDX-License-Identifier: MPL-2.0
import { compareElement as el } from './compare-elements.ts';
import { t } from '../i18n.ts';
import { yamlComparisonFormats, YAML_COMPARISON_NOTE, type ContentComparisonOverride } from '../lib/compare-sources.ts';

function mountYamlComparisonMode(root: HTMLElement, formats: readonly (string | undefined)[], changed: (mode?: ContentComparisonOverride) => void): boolean {
  if (!yamlComparisonFormats(formats)) return false;
  const label = el('label', t('YAML comparison')), select = el('select', undefined, 'field-select');
  select.setAttribute('aria-label', t('YAML comparison'));
  select.add(new Option(t('YAML structure'), 'yaml')); select.add(new Option(t('Text'), 'text'));
  const note = el('p', t(YAML_COMPARISON_NOTE), 'compare-note');
  label.append(select); root.append(label, note);
  select.addEventListener('change', () => { note.hidden = select.value === 'text'; changed(select.value === 'text' ? 'text' : 'yaml'); });
  return true;
}

/** PDF keeps its visual default; extracted text is an explicit alternative. */
export function mountPdfComparisonMode(root: HTMLElement, formats: readonly (string | undefined)[], changed: (mode?: 'document') => void): void {
  if (formats.length !== 2 || !formats.every(format => format?.toLowerCase() === 'pdf')) return;
  const label = el('label', t('PDF comparison')), select = el('select', undefined, 'field-select');
  select.setAttribute('aria-label', t('PDF comparison'));
  select.add(new Option(t('Images / PDF pages'), 'visual')); select.add(new Option(t('Extracted document text'), 'document'));
  label.append(select); root.append(label); select.addEventListener('change', () => changed(select.value === 'document' ? 'document' : undefined));
}

/** Controls use resolved formats, including the current side of a saved version. */
export function mountAssetComparisonMode(root: HTMLElement, formats: readonly (string | undefined)[], changed: (mode?: ContentComparisonOverride) => void): void {
  if (!mountYamlComparisonMode(root, formats, changed)) mountPdfComparisonMode(root, formats, changed);
}

/** Operation review retains DOCX properties by default, including metadata-only changes. */
export function mountOperationComparisonMode(root: HTMLElement, formats: readonly (string | undefined)[], changed: (mode?: ContentComparisonOverride) => void): ContentComparisonOverride | undefined {
  if (mountYamlComparisonMode(root, formats, changed)) return 'yaml';
  if (formats.length !== 2 || !formats.every(format => format?.toLowerCase() === 'docx')) { mountPdfComparisonMode(root, formats, changed); return; }
  const label = el('label', t('DOCX comparison')), select = el('select', undefined, 'field-select');
  select.setAttribute('aria-label', t('DOCX comparison'));
  select.add(new Option(t('Document properties'), 'properties')); select.add(new Option(t('Extracted document text'), 'document'));
  label.append(select); root.append(label); select.addEventListener('change', () => changed(select.value === 'document' ? 'document' : undefined));
}
