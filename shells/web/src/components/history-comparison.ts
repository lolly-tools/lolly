// SPDX-License-Identifier: MPL-2.0
import type { ComparisonSource } from '@lolly-tools/core/host-v1';
import type { RevisionEntry, RevisionHistoryAPI } from '../bridge/revision-history.ts';
import { mountComparison } from './compare-panel.ts';
import { runComparison } from '../lib/compare-client.ts';
import { t } from '../i18n.ts';
import { compareElement as el } from './compare-elements.ts';

/** Read only the selected immutable snapshots; missing history is an error. */
export async function historyComparisonSource(history: Pick<RevisionHistoryAPI, 'read'>, entry: RevisionEntry): Promise<ComparisonSource> {
  const value = await history.read(entry.id);
  if (!value) throw new Error(t('This version is no longer available.'));
  return { identity: { id: entry.id, kind: 'revision', label: `${entry.milestone ?? entry.label} · ${new Date(entry.at).toLocaleString()}`, revision: entry.id },
    content: { kind: 'structure', value } };
}
export async function mountHistoryComparison(root: HTMLElement, history: RevisionHistoryAPI, before: RevisionEntry, after: RevisionEntry | ComparisonSource, signal: AbortSignal): Promise<() => void> {
  const pair = await Promise.all([historyComparisonSource(history, before), 'identity' in after ? after : historyComparisonSource(history, after)]);
  const previews = await Promise.all([history.preview(before.id), 'identity' in after ? null : history.preview(after.id)]);
  signal.throwIfAborted();
  const pictures = el('div', undefined, 'revision-history-comparison-pair');
  previews.forEach((preview, i) => {
    const figure = el('figure'), caption = el('figcaption', i ? t('After snapshot') : t('Before snapshot'));
    if (preview && /^data:image\/(png|jpeg|webp);base64,/.test(preview)) { const image = el('img'); image.src = preview; image.alt = caption.textContent ?? ''; figure.append(image); }
    else figure.append(el('p', t('Preview unavailable')));
    figure.append(caption); pictures.append(figure);
  });
  const body = el('div'); root.replaceChildren(pictures, body);
  const disposePanel = mountComparison(body, { run: runComparison }, { version: 1, before: pair[0]!, after: pair[1]!, options: { ignoreRootMetadata: true } });
  const dispose = (): void => { disposePanel(); root.replaceChildren(); };
  signal.addEventListener('abort', dispose, { once: true });
  return () => { signal.removeEventListener('abort', dispose); dispose(); };
}
