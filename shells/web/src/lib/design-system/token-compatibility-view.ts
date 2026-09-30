// SPDX-License-Identifier: MPL-2.0
import { tokenCompatibility, type TokenDiagnosticCode } from '../../../../../engine/src/token-compatibility.ts';
import { t, tRaw } from '../../i18n.ts';
import { escape as esc } from '../../utils.ts';

export function tokenCompatibilityHtml(doc: unknown): string {
  const report = tokenCompatibility(doc);
  const messages: Record<TokenDiagnosticCode, string> = {
    'json-pointer': t('JSON pointer references are kept but not resolved.'),
    'group-inheritance': t('Inherited groups are kept but not expanded.'),
    'unresolved-value': t('This value still contains a reference or expression.'),
    'resolution-failed': t('This selection could not be resolved.'),
    limit: t('This report reached its limit. Some values were not checked.'),
  };
  const issues = report.diagnostics;
  const active = report.selections[0];
  return `<details class="ds-reference-details ds-token-compatibility"${issues.length ? ' open' : ''}>
    <summary>${issues.length ? t('Some token features need attention') : t('Token compatibility')}</summary>
    <p class="ds-src-stage-note">${t('Imported definitions stay in the document. These checks describe what Lolly can resolve; each tool uses only the values it supports.')}</p>
    ${active ? `<p>${esc(tRaw('{n} tokens in the active selection. Unresolved values: {count}.', { n: active.tokens, count: active.unresolved }))}</p>` : ''}
    ${issues.length ? `<ul>${issues.slice(0, 8).map(d => `<li>${esc(messages[d.code])}${d.path ? ` <code>${esc(d.path)}</code>` : ''}${d.mode ? ` (${esc(d.mode)})` : ''}</li>`).join('')}</ul>` : `<p>${t('No known reference gaps found in the checked selections. Output appearance has not been checked.')}</p>`}
    ${issues.length > 8 ? `<p>${esc(tRaw('{n} more findings in this document.', { n: issues.length - 8 }))}</p>` : ''}
    ${report.modes.length ? `<p>${esc(tRaw('Named selections: {names}. Independent theme groups keep their own names.', { names: report.modes.map(m => m.group ? `${m.group} / ${m.name}` : m.name).join(', ') }))}</p>` : ''}
    ${report.extensionNamespaces.length ? `<p>${esc(tRaw('Extension data retained: {names}. Extension presence does not establish support in Lolly.', { names: report.extensionNamespaces.join(', ') }))}</p>` : ''}
  </details>`;
}
