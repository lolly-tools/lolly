// SPDX-License-Identifier: MPL-2.0
import type { PreparationSource } from '@lolly-tools/core/host-v1';
import { sendTargetsFor } from '../../lib/send-target.ts';
import { t } from '../../i18n.ts';
/** Use the existing destination registry. The user chooses the destination after
 * reviewing a result; neither a report nor an original accompanies the bytes. */
export function attachPreparationDestinations(root: HTMLElement, source: PreparationSource, status: HTMLElement): void {
  const format = source.name.split('.').pop()?.toLowerCase() || 'txt';
  const destinations = sendTargetsFor(format, 'asset').filter(target => !target.requiresCredential);
  if (!destinations.length) return;
  const details = document.createElement('details'), summary = document.createElement('summary');
  details.className = 'prep-output-dest';
  summary.textContent = t('Send this copy to…'); details.append(summary);
  for (const target of destinations) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn--sm'; button.textContent = target.label;
    button.title = `${t('Send this reviewed copy to')} ${target.label}`;
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const payload = { bytes: source.bytes.slice(), name: source.name, format, mime: source.mime || 'application/octet-stream' };
        const choice = target.prepare ? await target.prepare(payload, { anchor: button }) : undefined;
        if (choice === null || !root.isConnected) return;
        await target.send({ ...payload, ...(choice ? { choice } : {}) });
        status.textContent = `${t('Sent the reviewed copy to')} ${target.label}.`;
      } catch { status.textContent = t('Sending did not finish. The copy is still available; try again or download it.'); }
      finally { button.disabled = false; }
    });
    details.append(button);
  }
  root.append(details);
}
