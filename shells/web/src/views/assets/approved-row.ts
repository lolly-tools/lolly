// SPDX-License-Identifier: MPL-2.0
/**
 * The Details row for a kept approved file: the request it came from, with a way back on
 * its own instance. Another workspace's request stays a plain fact, because its id means
 * nothing here. Reading the signed record in the file is a separate job for Verify.
 */
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { t, tRaw } from '../../i18n.ts';
import { approvalWork } from '../../lib/approval-request.ts';
import { approvalLinkOf } from '../../lib/approved-asset.ts';
import { getInstanceBase } from '../../lib/instance.ts';
import { formatMetaInstant } from '../../lib/meta-dates.ts';
import { metaRow } from '../../lib/meta-rows.ts';
import { escape as escapeText } from '../../utils.ts';

const onThisInstance = (instance: string): boolean => instance === (getInstanceBase() || location.origin) && !!approvalWork();

export function approvedRow(ref: Pick<AssetRef, 'meta'>): string {
  const link = approvalLinkOf(ref.meta);
  if (!link) return '';
  const words = escapeText(tRaw('Approved {date}', { date: formatMetaInstant(link.decidedAt) }));
  return metaRow('approval', t('Approval'), onThisInstance(link.instance)
    ? `${words} <button type="button" class="btn btn--ghost btn--sm" data-act="open-approval">${escapeText(t('Open request'))}</button>`
    : words);
}

export function openApprovedRequest(ref: Pick<AssetRef, 'meta'>): void {
  const link = approvalLinkOf(ref.meta);
  if (link && onThisInstance(link.instance)) approvalWork()?.open(link.id);
}
