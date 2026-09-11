// SPDX-License-Identifier: MPL-2.0
import type { TextFacts, TextSignalReport } from '@lolly/engine';
import { tsigFactsHtml } from '../tsig-facts.ts';
import { escapeHtml as esc } from '../../lib/html.ts';
import { icon } from '../../lib/icons.ts';
import { paintSyntaxPreview } from '../../lib/syntax-preview.ts';
import type { TextContext } from './context.ts';
export function mountTextInspection(ctx: TextContext, container: HTMLElement): void {
  const result = ctx.result!;
  const facts = result.value.details?.facts as TextFacts;
  const signals = result.value.details?.signals as TextSignalReport;
  if (!facts) return;
  ctx.root.querySelector('[data-result-notes]')!.textContent = '';
  const hidden = facts.hidden.reduce((total, value) => total + value.count, 0);
  container.innerHTML = `<div class="text-stats">${[
    [facts.words, 'Words'],
    [facts.sentences, 'Sentences'],
    [facts.paragraphs, 'Paragraphs'],
    [hidden, 'Hidden characters'],
  ]
    .map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`)
    .join(
      ''
    )}</div><section class="text-inspection-section"><h3>${icon('eye', { className: 'text-icon' })}Hidden characters</h3><p>${hidden ? 'Highlighted below so you can see exactly what is in your text.' : 'No hidden characters were found.'}</p><pre class="syntax text-inspected-source" data-inspected-source></pre></section><section class="text-inspection-section"><h3>${icon('aiSpark', { className: 'text-icon' })}Writing signals</h3><p>${signals.findings.length ? 'Review the characters and phrases found in your text.' : 'No observations to review.'}</p><p class="text-muted">These observations cannot establish who wrote the text.</p>${signals.findings.length ? `<details><summary>Review ${signals.findings.length} findings</summary><ul>${signals.findings.map((finding) => `<li>${esc(finding.label)}</li>`).join('')}</ul></details>` : ''}</section>${tsigFactsHtml(facts)}`;
  const source = ctx.editor.document.value.text.slice(result.start, result.end);
  paintSyntaxPreview(container.querySelector('[data-inspected-source]')!, source, 'plain', {
    invisibleClass: 'cat-invis',
  });
}
