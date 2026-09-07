// SPDX-License-Identifier: MPL-2.0
import './download-recovery.css';
import { saveFilePickerSupported, saveFileWithPicker } from '../bridge/export-save-picker.ts';

/** Anchor downloads have no delivery acknowledgement. Keep a prepared file
 * available through a separate save path, called directly from a fresh click. */
export function offerDownloadRecovery(status: HTMLElement, blob: Blob, filename: string, savedMessage: string): () => void {
  if (!saveFilePickerSupported()) {
    status.append(' If no file appears, check your browser’s download permissions or try a private window.');
    return () => {};
  }
  let active = true;
  const readyMessage = status.textContent || '';
  const summary = document.createElement('span');
  summary.textContent = readyMessage;
  status.replaceChildren(summary);
  const recovery = document.createElement('span');
  recovery.className = 'download-recovery';
  const message = document.createElement('span');
  message.textContent = 'No file? ';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn--sm';
  button.textContent = 'Save file…';
  button.setAttribute('aria-label', `Save ${filename}`);
  const save = async (): Promise<void> => {
    if (!active || button.disabled) return;
    button.disabled = true;
    summary.textContent = readyMessage;
    try {
      // Do not import or rebuild here: the picker needs this click's activation.
      const result = await saveFileWithPicker(blob, filename);
      if (active) {
        if (result === 'saved') { summary.textContent = savedMessage; message.textContent = ''; }
        else message.textContent = 'Save cancelled. Your file is still ready. ';
      }
    } catch (error) {
      if (active) message.textContent = `Could not save: ${error instanceof Error ? error.message : String(error)} Try again. `;
    } finally {
      if (active) button.disabled = false;
    }
  };
  button.addEventListener('click', save);
  recovery.append(message, button);
  status.append(recovery);
  return () => {
    active = false;
    button.removeEventListener('click', save);
    recovery.remove();
  };
}
