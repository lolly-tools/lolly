// SPDX-License-Identifier: MPL-2.0
/** File actions retain the original file when moving between utilities. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { setPendingUtility } from '../lib/utility-handoff.ts';
import { saveReportCard } from './valid-report-card.ts';

export function handleVerifyFileAction(target: EventTarget | null, host: HostV1, files: File[]): boolean {
  if (!(target instanceof Element)) return false;
  const button = target.closest<HTMLButtonElement>('[data-open-unpack], [data-open-prepare], [data-report-card]');
  if (!button) return false;
  const file = files[Number(button.dataset.fileIndex)];
  if (button.hasAttribute('data-report-card')) void saveReportCard(host, button, file);
  else if (file) {
    const utility = button.hasAttribute('data-open-unpack') ? 'unpack' : 'prepare';
    setPendingUtility(utility, file);
    window.location.hash = `#/${utility}`;
  }
  return true;
}
