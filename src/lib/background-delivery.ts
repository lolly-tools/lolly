// SPDX-License-Identifier: MPL-2.0
import { getFloatCluster } from './float-cluster.ts';
import { deliverWithRecovery, releaseDeliveryFor } from './download-recovery.ts';
import type { DeliveryHost } from './deliver-file.ts';
import type { PreparedFile, DeliveryResult } from './delivery-result.ts';
import { t } from '../i18n.ts';

// Background runs outlive their originating view. Keep ONE final file in a
// dismissible surface, released when the next run starts or the user dismisses it.
let retained: HTMLElement | undefined;
export function releaseBackgroundDelivery(): void {
  if (!retained) return;
  releaseDeliveryFor(retained);
  retained.remove();
  retained = undefined;
}

export function deliverBatchFile(
  owner: HTMLElement | undefined, surface: HTMLElement | undefined,
  file: PreparedFile, host: DeliveryHost,
): Promise<DeliveryResult> {
  if (owner?.isConnected && surface) return deliverWithRecovery(owner, surface, file, host);
  releaseBackgroundDelivery();
  const result = document.createElement('aside');
  result.className = 'background-delivery';
  result.setAttribute('aria-label', t('Prepared download'));
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn btn--ghost btn--sm';
  close.textContent = t('Dismiss');
  close.addEventListener('click', () => { if (retained === result) releaseBackgroundDelivery(); });
  const status = document.createElement('div');
  result.append(close, status);
  getFloatCluster().append(result);
  retained = result;
  return deliverWithRecovery(result, status, file, host);
}
