// SPDX-License-Identifier: MPL-2.0
import { mountComparisonResults } from '../../components/compare-results.ts';
import '../../components/compare.css';
import type { ComparisonResult } from '@lolly-tools/core/host-v1';
import { replacePrivateSpans, type PrivateSpan } from '../../../../../engine/src/prepare-text.ts';
import { applySuggestion, type RewordSuggestion } from '@lolly/engine';
import { paintSyntaxPreview } from '../../lib/syntax-preview.ts';
import { query, type TextContext } from './context.ts';
export function showResult(ctx: TextContext): void {
  const result = ctx.result;
  if (!result) return;
  ctx.resultCleanup?.();
  ctx.resultCleanup = null;
  const panel = query(ctx, '[data-result]');
  panel.hidden = false;
  query(ctx, '[data-result-notes]').textContent = result.value.notes.join(' ');
  const pre = query(ctx, '[data-result-text]');
  paintSyntaxPreview(
    pre,
    result.value.text,
    ({ js: 'javascript', ts: 'typescript' } as Record<string, string>)[result.value.format] ??
      result.value.format
  );
  const extra = query(ctx, '[data-result-extra]');
  extra.replaceChildren();
  query(ctx, '[data-apply]').hidden = [
    'inspect',
    'logs',
    'reword-rules',
    'diff',
    'schema',
    'jwt',
    'hash',
    'synopsis',
    'explain-logs',
  ].includes(result.operation);
  query(ctx, '[data-alias-map]').hidden = true;
  if (result.operation === 'reword-rules') {
    const suggestions = (result.value.details?.suggestions ?? []) as RewordSuggestion[];
    pre.hidden = true;
    if (!suggestions.length) extra.textContent = 'No plain-language suggestions for this text.';
    for (const suggestion of suggestions) {
      const button = document.createElement('button');
      button.className = 'btn';
      button.textContent = `${suggestion.label}: ${suggestion.replacement}`;
      button.addEventListener(
        'click',
        () => {
          const original = ctx.editor.document.value.text.slice(result.start, result.end);
          result.value.text = applySuggestion(original, suggestion);
          result.operation = 'rewrite-suggestion';
          result.value.notes = ['Suggested edit. Review the change before applying.'];
          showResult(ctx);
        },
        { signal: ctx.abort.signal }
      );
      extra.append(button);
    }
  } else pre.hidden = false;
  if (result.operation === 'diff') {
    pre.hidden = true;
    mountComparisonResults(extra, result.value.details?.comparison as ComparisonResult);
  }
  if (result.operation === 'regex') {
    const matches = result.value.details?.matches as Array<{
      at: number;
      text: string;
      groups: unknown;
    }>;
    const source = String(result.value.details?.source ?? '');
    const summary = document.createElement('p');
    summary.textContent = `${matches.length} matches. Positions use UTF-16 offsets, starting at zero.`;
    const highlighted = document.createElement('pre');
    highlighted.setAttribute('aria-label', 'Matches in source');
    let at = 0;
    for (const match of matches) {
      if (match.at > 80000) break;
      highlighted.append(document.createTextNode(source.slice(at, match.at)));
      const mark = document.createElement('mark');
      mark.textContent = match.text || '│';
      mark.title = `Offset ${match.at}${match.text ? '' : ' (empty match)'}`;
      highlighted.append(mark);
      at = match.at + match.text.length;
    }
    highlighted.append(document.createTextNode(source.slice(at, 80000)));
    if (source.length > 80000)
      highlighted.append(
        document.createTextNode(
          '\nPreview limited to 80,000 characters. The action uses the whole selection.'
        )
      );
    extra.append(summary, highlighted);
    const captures = document.createElement('details'),
      heading = document.createElement('summary');
    heading.textContent = 'Match positions and capture groups';
    const values = document.createElement('pre');
    values.textContent = JSON.stringify(matches, null, 2);
    captures.append(heading, values);
    extra.append(captures);
    pre.hidden = !result.value.details?.replacing;
    query(ctx, '[data-apply]').hidden = !result.value.details?.replacing;
  }
  if (result.operation === 'redact') {
    const original = ctx.editor.document.value.text.slice(result.start, result.end);
    const findings = result.value.details?.findings as PrivateSpan[];
    const choices = Object.entries(result.value.details?.aliases as Record<string, string>).map(
      ([alias, value]) => ({ alias, value, enabled: true })
    );
    const fields = document.createElement('details'),
      heading = document.createElement('summary');
    heading.textContent = `Review ${choices.length} replacement values`;
    fields.append(heading);
    const message = document.createElement('p');
    message.setAttribute('role', 'status');
    fields.append(message);
    const update = (): void => {
      const enabled = choices.filter((choice) => choice.enabled),
        aliases = enabled.map((choice) => choice.alias);
      const valid =
        aliases.every((alias) => alias.trim() && !original.includes(alias)) &&
        new Set(aliases).size === aliases.length &&
        !aliases.some((a, i) => aliases.some((b, j) => i !== j && b.includes(a)));
      query<HTMLButtonElement>(ctx, '[data-apply]').disabled =
        !valid || ctx.editor.document.revision !== result.revision;
      query<HTMLButtonElement>(ctx, '[data-insert-result]').disabled =
        !valid || ctx.editor.document.revision !== result.revision;
      if (!valid) {
        message.textContent =
          'Use unique, non-overlapping aliases that do not already occur in the source.';
        return;
      }
      message.textContent = '';
      const byValue = new Map(enabled.map((choice) => [choice.value, choice.alias]));
      result.value.text = replacePrivateSpans(
        original,
        findings
          .filter((span) => byValue.has(span.value))
          .map((span) => ({ span, replacement: byValue.get(span.value)! }))
      );
      result.value.details!.aliases = Object.fromEntries(
        enabled.map((choice) => [choice.alias, choice.value])
      );
      paintSyntaxPreview(pre, result.value.text, 'plain');
    };
    for (const choice of choices) {
      const label = document.createElement('label');
      label.className = 'text-row';
      const enabled = document.createElement('input');
      enabled.type = 'checkbox';
      enabled.checked = true;
      const value = document.createElement('span');
      value.textContent = choice.value;
      const alias = document.createElement('input');
      alias.value = choice.alias;
      alias.setAttribute('aria-label', `Replacement for ${choice.value}`);
      enabled.addEventListener('change', () => {
        choice.enabled = enabled.checked;
        update();
      });
      alias.addEventListener('input', () => {
        choice.alias = alias.value;
        update();
      });
      label.append(enabled, value, alias);
      fields.append(label);
    }
    extra.append(fields);
  }
  if (result.operation === 'logs') {
    pre.hidden = true;
    ctx.presentation.logs(extra);
  }
  if (result.operation === 'inspect') {
    pre.hidden = true;
    ctx.presentation.inspect(extra);
  }
  const copyFirst =
    query(ctx, '[data-apply]').hidden ||
    ctx.operations.find((operation) => operation.id === result.operation)?.group === 'Generate';
  query(ctx, '[data-apply]').classList.toggle('btn--primary', !copyFirst);
  query(ctx, '[data-copy-result]').classList.toggle('btn--primary', copyFirst);
  panel.scrollIntoView({ block: 'nearest', behavior: 'instant' });
}
