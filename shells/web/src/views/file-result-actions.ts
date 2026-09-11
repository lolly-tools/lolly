// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { FileFactsV1 } from '@lolly-tools/core/file-v1';
import { addFileResultToLibrary, canDesignWithFile, fileResultDesignSeed, type FileResultLibraryHost } from '../lib/file-result-library.ts';
import { localFileOperations } from '../lib/file-operation-store.ts';
import { t } from '../i18n.ts';

export function attachFileResultActions(root: HTMLElement, operationId: string, facts: FileFactsV1, host: HostV1, announce: (message: string) => void): void {
  const group = document.createElement('details'); group.className = 'convert-reuse';
  group.innerHTML = `<summary>${t('Use this copy…')}</summary><div class="convert-actions"><button class="btn" data-result-library>${t('Add to library')}</button>${canDesignWithFile(facts) ? `<button class="btn" data-result-design>${t('Start a design with this copy')}</button>` : ''}<button class="btn" data-result-prepare>${t('Prepare for sharing')}</button><button class="btn" data-result-convert>${t('Convert this copy')}</button></div><p class="convert-retention">${t('Library copies keep these exact bytes. Starting a design adds the copy to your library; replacing that library asset later can change the design. Your original is not changed.')}</p>`;
  const use = async (button: HTMLButtonElement, action: 'library' | 'design' | 'convert' | 'prepare'): Promise<void> => {
    button.disabled = true;
    try {
      const store = await localFileOperations();
      if (action === 'prepare') {
        const file = await store.getOutput(operationId);
        if (!file) throw new Error(t('The saved copy is missing.'));
        const { openPreparation } = await import('../lib/prepare-entry.ts');
        if (root.isConnected) openPreparation(host, [file]);
        return;
      }
      if (action === 'convert') {
        const file = await store.getOutput(operationId); if (!file) throw new Error(t('The saved copy is missing. Retry with the original file.'));
        const { openFileInUtility } = await import('../lib/drop-router.ts');
        if (!root.isConnected) return;
        openFileInUtility('convert', file); return;
      }
      const ref = await addFileResultToLibrary(store, operationId, host as unknown as FileResultLibraryHost);
      announce(t('Added to your library. The copy’s bytes are unchanged.'));
      if (action === 'design') {
        const [{ setPendingToolSeed }, { navigateTo }] = await Promise.all([import('../lib/drop-router.ts'), import('../nav.ts')]);
        if (!root.isConnected) return;
        setPendingToolSeed('design', fileResultDesignSeed(ref, facts)); navigateTo('#/tool/design');
      }
    } catch (error) { announce(error instanceof Error ? error.message : String(error)); }
    finally { button.disabled = false; }
  };
  for (const action of ['library', 'design', 'convert', 'prepare'] as const) {
    const button = group.querySelector<HTMLButtonElement>(`[data-result-${action}]`);
    button?.addEventListener('click', () => { void use(button, action); });
  }
  root.append(group);
}
