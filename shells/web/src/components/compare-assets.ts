// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { captureComparisonAssets, capturedAssetComparisonPair, type ComparisonAsset, type CapturedComparisonAsset } from '../lib/compare-asset-sources.ts';
import type { ContentComparisonOverride } from '../lib/compare-sources.ts';
import { mountModal } from './modal.ts';
import { mountComparison } from './compare-panel.ts';
import { mountVisualComparison } from './compare-visual-panel.ts';
import { compareElement as el, compareButton as button } from './compare-elements.ts';
import { t } from '../i18n.ts';
import { mountAssetComparisonMode } from './compare-file-mode.ts';
/** A read-only overlay. The catalog's selection and navigation stay where they were. */
export function openAssetComparison(host: HostV1, input: readonly ComparisonAsset[]): void {
  const sources = structuredClone(input); let controller: AbortController | undefined, dispose: (() => void) | undefined, closed = false;
  let captured: readonly CapturedComparisonAsset[] | undefined, modesMounted = false;
  const modal = mountModal('', { className: 'modal compare-modal', ariaLabel: t('Compare assets'), onClose: () => { closed = true; controller?.abort(); dispose?.(); captured = undefined; } });
  const heading = el('h2', t('Compare assets')), close = button('Close comparison'), status = el('p', t('Loading the selected versions locally…')), root = el('div'); status.setAttribute('role', 'status');
  close.addEventListener('click', () => modal.close()); modal.el.append(heading, close, status, root); close.focus();
  const modes = el('div', undefined, 'compare-toolbar');
  const compare = async (mode?: ContentComparisonOverride): Promise<void> => {
    controller?.abort(); dispose?.(); dispose = undefined; root.replaceChildren();
    const active = new AbortController(); controller = active; status.textContent = t('Loading the selected versions locally…');
    try {
      if (!host.compare) throw new Error('Comparison is unavailable in this host.');
      if (!captured) {
        const files = await captureComparisonAssets(sources, host, active.signal);
        if (closed || active.signal.aborted) return;
        captured = files;
      }
      if (!modesMounted) {
        mountAssetComparisonMode(modes, captured.map(file => file.format), value => { void compare(value); });
        modesMounted = true;
      }
      const pair = await capturedAssetComparisonPair(captured, host, active.signal, mode);
      if (closed || active.signal.aborted) return;
      status.textContent = '';
      dispose = pair.mode === 'visual' ? mountVisualComparison(root, host.compare, pair.request) : mountComparison(root, host.compare, pair.request);
    } catch (error) {
      if (!closed && !active.signal.aborted) status.textContent = error instanceof Error ? t(error.message) : t('These asset versions could not be compared.');
      active.abort();
    }
  };
  modal.el.insertBefore(modes, status); void compare();
}
