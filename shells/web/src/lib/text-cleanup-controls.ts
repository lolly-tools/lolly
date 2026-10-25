// SPDX-License-Identifier: MPL-2.0
/** Review source edits in place, then apply one authored command. */
import { previewTextCleanup, storyParagraphIds, textStyleResolver, type TextCleanupPreview } from '@lolly/engine';
import type { ComposedTextEditor } from './text-editor-session.ts';
import { t } from '../i18n.ts';
export function mountTextCleanup(root: HTMLElement, editor: ComposedTextEditor, error: (error: unknown) => void) {
  const details = document.createElement('details'), title = document.createElement('summary'); title.textContent = t('Typography cleanup'); details.append(title); root.append(details);
  const check = (label: string, value: boolean) => { const row = document.createElement('label'), input = document.createElement('input'); input.type = 'checkbox'; input.className = 'field-check'; input.checked = value; row.append(input, document.createTextNode(label)); details.append(row); return input; };
  const quotes = check(t('Use language-specific quotes'), true), spaces = check(t('Remove repeated word spaces'), true), discretionary = check(t('Remove discretionary breaks'), false);
  const preview = document.createElement('button'); preview.type = 'button'; preview.textContent = t('Preview changes'); details.append(preview);
  const output = document.createElement('div'); output.setAttribute('role', 'status'); details.append(output);
  const apply = document.createElement('button'); apply.type = 'button'; apply.textContent = t('Apply changes'); apply.disabled = true; details.append(apply);
  let proposal: TextCleanupPreview | undefined;
  const clear = () => { proposal = undefined; apply.disabled = true; output.replaceChildren(); editor.highlight([]); };
  for (const input of [quotes, spaces, discretionary]) input.addEventListener('change', clear);
  details.addEventListener('toggle', () => { if (!details.open) clear(); });
  preview.addEventListener('click', () => {
    try {
      clear();
      const story = editor.story, selected = editor.range, ids = storyParagraphIds(story, selected);
      const paragraphs = story.paragraphs.filter(paragraph => ids.includes(paragraph.id));
      const range = selected.start === selected.end ? { start: paragraphs[0]!.start, end: paragraphs.at(-1)!.end } : selected;
      const language = textStyleResolver(editor.document).paragraph(story, paragraphs[0]!).language ?? 'und';
      proposal = previewTextCleanup(story, range, language, { quotes: quotes.checked, spaces: spaces.checked, discretionary: discretionary.checked });
      editor.highlight(proposal.edits);
      const description = document.createElement('p'); description.textContent = proposal.edits.length ? t('{n} proposed changes', { n: proposal.edits.length }) : t('No changes proposed.'); output.append(description);
      for (const edit of proposal.edits) { const row = document.createElement('p'), before = document.createElement('del'), after = document.createElement('ins'); before.textContent = edit.before; after.textContent = edit.after || t('(remove)'); row.append(before, document.createTextNode(' → '), after); output.append(row); }
      apply.disabled = !proposal.edits.length;
    } catch (reason) { error(reason); }
  });
  apply.addEventListener('click', () => { if (proposal) try { editor.cleanup(proposal); clear(); } catch (reason) { error(reason); } });
  return { clear };
}
