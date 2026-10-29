// SPDX-License-Identifier: MPL-2.0
/** Collapsible live Markdown preview and local writing feedback for Write. */
import DOMPurify from 'dompurify';
import { mdToHtml } from '../../lib/markdown.ts';
import { escapeHtml } from '../../lib/html.ts';
import { wireTabs } from '../../lib/tabs.ts';
import { displayOffset } from '../../../../../engine/src/text-document.ts';
import { analyseWriting, WRITING_SCAN_LIMIT, type WritingAnalysis, type WritingIssue, type WritingIssueKind } from '../../lib/writing-analysis.ts';
import type { TextContext } from './context.ts';
import './writing.css';

const labels: Record<WritingIssueKind, string> = {
  hard: 'Long sentence', 'very-hard': 'Very long sentence', adverb: 'Adverb',
  passive: 'Possible passive voice', simpler: 'Simpler wording',
};
export interface WriterTools {
  refresh(): void;
  show(view: 'preview' | 'checks'): void;
}

function reviewMarkup(text: string, analysis: WritingAnalysis): string {
  let end = 0;
  const parts: string[] = [];
  for (const issue of analysis.issues) {
    if (issue.start < end) continue;
    parts.push(escapeHtml(text.slice(end, issue.start)));
    parts.push(`<mark class="write-mark write-mark--${issue.kind}" title="${labels[issue.kind]}">${escapeHtml(text.slice(issue.start, issue.end))}</mark>`);
    end = issue.end;
  }
  parts.push(escapeHtml(text.slice(end, WRITING_SCAN_LIMIT)));
  return parts.join('');
}

function checksMarkup(text: string, analysis: WritingAnalysis): string {
  const seconds = analysis.readingSeconds;
  const time = seconds < 60 ? `${seconds} sec` : `${Math.ceil(seconds / 60)} min`;
  return `<p class="text-muted">English estimates. Suggestions help you review your style; keep what suits your voice.</p>
    <dl class="write-stats"><div><dt>Reading grade</dt><dd>${analysis.grade === null ? 'Not available' : analysis.grade}</dd></div><div><dt>Reading time</dt><dd>${time}</dd></div><div><dt>Words</dt><dd>${analysis.words}</dd></div><div><dt>Sentences</dt><dd>${analysis.sentences}</dd></div></dl>
    <p class="text-muted">${analysis.paragraphs} ${analysis.paragraphs === 1 ? 'paragraph' : 'paragraphs'}. Grade uses an approximate Flesch-Kincaid formula for English prose of at least 20 words. Reading time assumes 200 words per minute.</p>
    ${analysis.limited ? '<p class="write-limit" role="status">Showing up to 100 suggestions from the first 50,000 characters. Your full document is kept.</p>' : ''}
    <div class="write-legend">${Object.entries(labels).map(([kind, label]) => `<span class="write-mark write-mark--${kind}">${label}: ${analysis.issues.filter(issue => issue.kind === kind).length}</span>`).join('')}</div>
    ${text.trim() ? `<details class="write-review"><summary>Highlighted text</summary><div>${reviewMarkup(text, analysis)}</div></details>` : ''}
    <h3>${analysis.issues.length ? 'Suggestions' : text.trim() ? 'No suggestions from these checks' : 'Start writing to see suggestions'}</h3>
    <ol class="write-issues">${analysis.issues.map((issue, index) => `<li class="write-issue write-issue--${issue.kind}"><strong>${labels[issue.kind]}</strong><blockquote>${escapeHtml(text.slice(issue.start, Math.min(issue.end, issue.start + 220)))}${issue.end - issue.start > 220 ? '…' : ''}</blockquote><p>${escapeHtml(issue.advice)}</p><div class="text-row"><button type="button" class="btn btn--ghost" data-write-select="${index}" aria-label="Find suggestion ${index + 1} in text">Find in text</button>${issue.replacement === undefined ? '' : `<button type="button" class="btn btn--ghost" data-write-use="${index}">Use “${escapeHtml(issue.replacement)}”</button>`}</div></li>`).join('')}</ol>`;
}

export function mountWriterTools(ctx: TextContext): WriterTools {
  const { root, editor, abort } = ctx;
  root.classList.add('write-workspace');
  editor.input.spellcheck = true;
  const pane = document.createElement('aside');
  pane.className = 'write-pane';
  pane.id = `write-pane-${crypto.randomUUID()}`;
  pane.setAttribute('aria-label', 'Writing companion');
  pane.hidden = true;
  pane.innerHTML = `<header class="write-pane-header"><div class="text-tabs" role="tablist" aria-label="Writing companion"><button type="button" role="tab" data-writer-tab="preview" id="${pane.id}-preview-tab" aria-controls="${pane.id}-preview" aria-selected="true">Preview</button><button type="button" role="tab" data-writer-tab="checks" id="${pane.id}-checks-tab" aria-controls="${pane.id}-checks" aria-selected="false" tabindex="-1">Writing check</button></div><button type="button" class="btn btn--ghost" data-write-hide aria-label="Hide writing pane">Hide</button></header>
    <section role="tabpanel" id="${pane.id}-preview" aria-labelledby="${pane.id}-preview-tab" data-write-panel="preview" tabindex="0"><article class="write-preview" data-write-preview></article></section>
    <section role="tabpanel" id="${pane.id}-checks" aria-labelledby="${pane.id}-checks-tab" data-write-panel="checks" tabindex="0" hidden><div data-write-checks></div></section>`;
  root.querySelector('[data-result]')!.before(pane);
  const preview = pane.querySelector<HTMLElement>('[data-write-preview]')!;
  const checks = pane.querySelector<HTMLElement>('[data-write-checks]')!;
  const toggles = [...root.querySelectorAll<HTMLButtonElement>('[data-writer-view]')];
  for (const toggle of toggles) toggle.setAttribute('aria-controls', pane.id);
  let view = 'preview', revision = -1, format = '',
    timer: ReturnType<typeof setTimeout> | undefined;
  let snapshot = '', snapshotRevision = -1, issues: WritingIssue[] = [];
  let renderedPreview = '', renderedChecks = '';
  const updateButtons = (): void => {
    root.classList.toggle('has-writing-pane', !pane.hidden);
    for (const button of toggles) button.setAttribute('aria-expanded', String(!pane.hidden && button.dataset.writerView === view));
  };
  const render = (): void => {
    clearTimeout(timer);
    if (pane.hidden || abort.signal.aborted) return;
    const text = editor.document.value.text;
    const markdown = root.querySelector<HTMLSelectElement>('[data-write-format]')!.value === 'markdown';
    const key = `${editor.document.revision}:${markdown}`;
    if (view === 'preview' && renderedPreview !== key) {
      renderedPreview = key;
      if (!text) preview.innerHTML = '<p class="text-muted">Your Markdown preview will appear here as you write.</p>';
      else preview.innerHTML = DOMPurify.sanitize(mdToHtml(text));
    } else if (view === 'checks' && renderedChecks !== key) {
      renderedChecks = key;
      snapshot = text;
      snapshotRevision = editor.document.revision;
      const analysis = analyseWriting(text, markdown);
      issues = analysis.issues;
      const scroll = checks.parentElement!.scrollTop;
      checks.innerHTML = checksMarkup(text, analysis);
      checks.parentElement!.scrollTop = scroll;
    }
  };
  const selectTab = wireTabs(pane.querySelector('[role="tablist"]')!, {
    key: 'writerTab', onSelect(next) {
      view = next;
      for (const panel of pane.querySelectorAll<HTMLElement>('[data-write-panel]')) panel.hidden = panel.dataset.writePanel !== view;
      updateButtons();
      render();
    },
  });
  const hide = (): void => {
    pane.hidden = true;
    clearTimeout(timer);
    updateButtons();
    editor.input.focus({ preventScroll: true });
  };
  const open = (next: 'preview' | 'checks', focus: boolean): void => {
    pane.hidden = false;
    selectTab(next, { focus });
    if (focus && matchMedia('(max-width:899px)').matches) pane.scrollIntoView({ block: 'start' });
  };
  const show = (next: 'preview' | 'checks'): void => open(next, true);
  root.addEventListener('click', event => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!target) return;
    const next = target.dataset.writerView;
    if (next === 'preview' || next === 'checks') {
      if (!pane.hidden && view === next) hide();
      else show(next);
    }
    if (target.hasAttribute('data-write-hide')) hide();
    const index = target.dataset.writeSelect ?? target.dataset.writeUse;
    if (index === undefined) return;
    const issue = issues[Number(index)];
    if (!issue) return;
    if (snapshotRevision !== editor.document.revision || snapshot !== editor.document.value.text) {
      render();
      ctx.status('Your text changed. Choose a suggestion from the updated check.');
      return;
    }
    if (target.hasAttribute('data-write-use') && issue.replacement !== undefined) {
      if (editor.replace(issue.replacement, issue, snapshotRevision)) ctx.status('Wording updated. Undo restores the original.');
    } else {
      editor.input.focus();
      editor.input.setSelectionRange(displayOffset(snapshot, issue.start), displayOffset(snapshot, issue.end));
      editor.input.dispatchEvent(new Event('select'));
      // Browsers do not consistently reveal a selection set through script.
      const measure = document.createElement('div');
      const style = getComputedStyle(editor.input);
      Object.assign(measure.style, { position: 'fixed', visibility: 'hidden', width: `${editor.input.clientWidth}px`, boxSizing: style.boxSizing,
        font: style.font, padding: style.padding, whiteSpace: editor.input.wrap === 'off' ? 'pre' : 'pre-wrap', overflowWrap: 'anywhere' });
      measure.textContent = editor.input.value.slice(0, editor.input.selectionStart);
      document.body.append(measure);
      editor.input.scrollTop = Math.max(0, measure.offsetHeight - editor.input.clientHeight / 2);
      editor.input.dispatchEvent(new Event('scroll'));
      measure.remove();
    }
  }, { signal: abort.signal });
  pane.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); hide(); }
  }, { signal: abort.signal });
  // Keep preview links from navigating away from an unsaved document.
  preview.addEventListener('click', event => {
    if ((event.target as HTMLElement).closest('a')) event.preventDefault();
  }, { signal: abort.signal });
  abort.signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  if (root.querySelector<HTMLSelectElement>('[data-write-format]')!.value === 'markdown') open('preview', false);
  updateButtons();
  return {
    show,
    refresh() {
      const nextFormat = root.querySelector<HTMLSelectElement>('[data-write-format]')!.value;
      if (revision === editor.document.revision && format === nextFormat) return;
      revision = editor.document.revision;
      format = nextFormat;
      clearTimeout(timer);
      if (!pane.hidden) timer = setTimeout(render, 200);
    },
  };
}
