// SPDX-License-Identifier: MPL-2.0
/**
 * profile: the Connected services card and the sync-across-devices sub-block.
 *
 * Every function takes the shared `pv: ProfileViewCtx` first (see context.ts). Sibling
 * calls in this file are direct; a call into another module, and every use of a
 * function as a value (an event listener), goes through `pv.<module>.<fn>`. Extracted verbatim
 * from mountProfile() by scripts/split-closure.ts.
 */
import { bindOp, type ProfileViewCtx } from './context.ts';

export const loadConnections = async (pv: ProfileViewCtx): Promise<void> => {
  const { host, viewEl } = pv;
  if (pv.connectionsLoaded) return;
  pv.connectionsLoaded = true;
  const body = viewEl.querySelector<HTMLElement>('#connections-body');
  if (!body) return;
  const { mountConnectionsBody } = await import('../profile-connections.ts');
  await mountConnectionsBody(body, host as Parameters<typeof mountConnectionsBody>[1],
    text => pv.summaries.setSummary('connections-section', text));
};
export const loadSync = async (pv: ProfileViewCtx): Promise<void> => {
  const { host, viewEl } = pv;
  if (pv.syncLoaded) return;
  pv.syncLoaded = true;
  const body = viewEl.querySelector<HTMLElement>('#sync-body');
  if (!body) return;
  const { mountSyncBody } = await import('../profile-sync.ts');
  await mountSyncBody(body, host as unknown as Parameters<typeof mountSyncBody>[1]);
};
export const loadConnectionsCard = (pv: ProfileViewCtx): void => { void loadConnections(pv); void loadSync(pv); };
/** Load the connected-services card when it is first expanded. */
export function wireConnectionsToggle(pv: ProfileViewCtx): void {
  const { connectionsDetails } = pv;
  connectionsDetails?.addEventListener('toggle', () => { if (connectionsDetails!.open) pv.connections.loadConnectionsCard(); });
  if (connectionsDetails?.open) pv.connections.loadConnectionsCard();
}

export function connectionsOps(pv: ProfileViewCtx) {
  return {
    loadConnections: bindOp(pv, loadConnections),
    loadSync: bindOp(pv, loadSync),
    loadConnectionsCard: bindOp(pv, loadConnectionsCard),
    wireConnectionsToggle: bindOp(pv, wireConnectionsToggle),
  };
}
