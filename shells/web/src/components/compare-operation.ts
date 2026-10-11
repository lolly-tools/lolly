// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { FileFactsV1 } from '@lolly-tools/core/file-v1';
import { operationComparisonPair, verifyComparisonOriginal } from '../lib/compare-operation-sources.ts';
import { mountModal } from './modal.ts';
import { mountComparison } from './compare-panel.ts';
import { mountVisualComparison } from './compare-visual-panel.ts';
import { compareElement as el, compareButton as button } from './compare-elements.ts';
import { t } from '../i18n.ts';

/** The caller closes this review when its input or output snapshot becomes stale. */
export function openOperationComparison(host: HostV1, after: File, options: { before?: File; expected?: FileFactsV1 } = {}): () => void {
  let active: AbortController | undefined, dispose: (() => void) | undefined, closed = false;
  const modal = mountModal('', { className: 'modal compare-modal', ariaLabel: t('Compare original and copy'), onClose: () => {
    closed = true; active?.abort(); dispose?.();
  } });
  const close = button('Close comparison'), status = el('p'), root = el('div'); status.setAttribute('role', 'status');
  modal.el.append(el('h2', t('Compare original and copy')), close, status, root);
  close.addEventListener('click', () => modal.close()); close.focus();
  const compare = async (before: File, verify: boolean): Promise<void> => {
    active?.abort(); dispose?.(); dispose = undefined; root.replaceChildren();
    const controller = new AbortController(); active = controller; status.textContent = t('Comparing locally…');
    try {
      if (!host.compare) throw new Error('Comparison is unavailable in this host.');
      if (verify) {
        if (!options.expected) throw new Error('The original hash was not recorded. This operation cannot verify a reselected original.');
        await verifyComparisonOriginal(before, options.expected, controller.signal);
      }
      const pair = await operationComparisonPair(before, after, host, controller.signal);
      if (closed || controller.signal.aborted) return;
      status.textContent = '';
      dispose = pair.mode === 'visual' ? mountVisualComparison(root, host.compare, pair.request) : mountComparison(root, host.compare, pair.request);
    } catch (error) {
      if (!closed && !controller.signal.aborted) status.textContent = error instanceof Error ? t(error.message) : t('These sources could not be compared.');
      controller.abort();
    }
  };
  if (options.before) void compare(options.before, false);
  else {
    const label = el('label', t('Choose the original file')), input = el('input', undefined, 'field-input'); input.type = 'file';
    label.append(input); modal.el.insertBefore(label, status);
    status.textContent = t('Originals are not saved in file history. Choose the original to compare it with the saved copy; its hash must match.');
    input.addEventListener('change', () => { const file = input.files?.[0]; if (file) void compare(file, true); input.value = ''; });
  }
  return () => modal.close();
}
