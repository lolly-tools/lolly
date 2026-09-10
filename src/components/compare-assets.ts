// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { comparisonAssetPair, type ComparisonAsset } from '../lib/compare-asset-sources.ts';
import { mountModal } from './modal.ts';
import { mountComparison } from './compare-panel.ts';
import { mountVisualComparison } from './compare-visual-panel.ts';
import { compareElement as el, compareButton as button } from './compare-elements.ts';
import { t } from '../i18n.ts';
/** A read-only overlay. The catalog's selection and navigation stay where they were. */
export function openAssetComparison(host: HostV1, input: readonly ComparisonAsset[]): void {
  const sources = structuredClone(input), controller = new AbortController(); let dispose: (() => void) | undefined;
  const modal = mountModal('', { className: 'modal compare-modal', ariaLabel: t('Compare assets'), onClose: () => { controller.abort(); dispose?.(); } });
  const heading = el('h2', t('Compare assets')), close = button('Close comparison'), status = el('p', t('Loading the selected versions locally…')), root = el('div'); status.setAttribute('role', 'status');
  close.addEventListener('click', () => modal.close()); modal.el.append(heading, close, status, root); close.focus();
  void (async () => {
    try {
      if (!host.compare) throw new Error('Comparison is unavailable in this host.');
      const pair = await comparisonAssetPair(sources, host, controller.signal);
      if (controller.signal.aborted) return;
      status.textContent = '';
      dispose = pair.mode === 'visual' ? mountVisualComparison(root, host.compare, pair.request) : mountComparison(root, host.compare, pair.request);
    } catch (error) {
      if (!controller.signal.aborted) status.textContent = error instanceof Error ? t(error.message) : t('These asset versions could not be compared.');
      controller.abort();
    }
  })();
}
