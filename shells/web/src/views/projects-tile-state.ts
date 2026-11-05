// SPDX-License-Identifier: MPL-2.0
/**
 * What a saved session's tile says about the session's life outside this device: who is
 * in it now (lib/collab-tile-state.ts) and the state of its approval request.
 *
 * The approval states come from one read per view, shared with the notification queue,
 * so a grid of any size makes one request. The badge gives the state in words, with the
 * existing badge grammar: colour never carries it alone.
 */
import { t, tRaw } from '../i18n.ts';
import { approvalWork, type SessionApproval } from '../lib/approval-request.ts';
import { getCollabTileProvider, renderCollabBadge } from '../lib/collab-tile-state.ts';
import type { MetaKey } from '../lib/meta-rows.ts';

const BADGE = 'tile-badge--approval';

const dayOf = (iso: string | undefined): string => {
  const at = iso ? new Date(iso) : null;
  return at && !Number.isNaN(at.getTime()) ? at.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
};

/** The newest request for each saved session, or nothing when no flow is registered. */
export async function readSessionApprovals(): Promise<ReadonlyMap<string, SessionApproval>> {
  return (await approvalWork()?.sessions().catch(() => null)) ?? new Map();
}

/** One tile's badge, added, changed or taken off to match. */
export function renderApprovalBadge(tile: HTMLElement, approval: SessionApproval | undefined): void {
  const held = tile.querySelector<HTMLElement>(`.${BADGE}`);
  if (!approval) { held?.remove(); return; }
  const words = approval.state === 'approved' ? t('Approved') : t('In review');
  const doc = tile.ownerDocument;
  const badge = held ?? doc.createElement('span');
  badge.className = `tile-badge ${BADGE}`;
  badge.dataset.state = approval.state;
  badge.textContent = words;
  if (held) return;
  let row = tile.querySelector<HTMLElement>('.tile-badges');
  if (!row) {
    row = doc.createElement('span');
    row.className = 'tile-badges';
    (tile.querySelector<HTMLElement>('.tile-sub') ?? tile.querySelector<HTMLElement>('.tile-title'))?.after(row);
  }
  row.prepend(badge);
}

/** Paint every session tile under `root`. */
export function applyTileStates(root: HTMLElement, approvals: ReadonlyMap<string, SessionApproval>): void {
  const provider = getCollabTileProvider();
  for (const tile of root.querySelectorAll<HTMLElement>('.folder-tile[data-kind="session"]')) {
    const slot = tile.dataset.ref;
    renderCollabBadge(tile, slot && provider ? provider.peersFor(slot) : []);
    renderApprovalBadge(tile, slot ? approvals.get(slot) : undefined);
  }
}

/** The info sheet's row for a session with a request, or nothing. */
export function approvalInfoRows(approvals: ReadonlyMap<string, SessionApproval>, slot: string): Array<[MetaKey, string, string]> {
  const approval = approvals.get(slot);
  if (!approval) return [];
  const day = dayOf(approval.decidedAt);
  const words = approval.state === 'in_review' ? t('In review') : day ? tRaw('Approved {date}', { date: day }) : t('Approved');
  return [['approval', t('Approval'), words]];
}
