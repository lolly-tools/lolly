// SPDX-License-Identifier: MPL-2.0
import { t } from '../../i18n.ts';
import { getInstanceBase } from '../instance.ts';
import { removeDesignSystem, type ManageHost } from './manage.ts';
import { switchDesignSystem, type SwitchHost, type SwitchOptions, type SwitchResult } from './switch.ts';
import type { DesignSystemRegistry } from './registry.ts';
import { removalFallback, designSystemRemovalMessage } from './catalog-source.ts';

interface RemovalReview { snapshot: string; message: string }

/** Capture the choice shown in a removal dialog, including its connection. */
export async function prepareDesignSystemRemoval(registry: DesignSystemRegistry, id: string): Promise<RemovalReview> {
  registry.bust();
  const target = await registry.get(id);
  if (!target || target.source.kind === 'shipped') throw new Error(t('This design system cannot be removed.'));
  const active = await registry.active();
  const fallback = await removalFallback(registry, id);
  const snapshot = JSON.stringify({ id, active: active.id, target: [target.label, target.headId, target.source],
    fallback: [fallback.id, fallback.label, fallback.headId, fallback.catalog], instance: getInstanceBase() });
  return { snapshot, message: await designSystemRemovalMessage(registry, id, fallback) };
}

/** Switch while the outgoing record still exists, then remove only its material. */
export async function removeAndSwitchDesignSystem(
  host: ManageHost & SwitchHost, id: string, reviewed: RemovalReview, opts: SwitchOptions = {},
) {
  if ((await prepareDesignSystemRemoval(host.designSystems, id)).snapshot !== reviewed.snapshot) {
    throw new Error(t('The active design system or its source changed. Review the removal again.'));
  }
  const wasActive = (await host.designSystems.activeId()) === id;
  let transition: SwitchResult | null = null;
  if (wasActive) transition = await switchDesignSystem(host, 'shipped', { ...opts, noRemount: true, strictConnection: true });
  const removed = await removeDesignSystem(host, id);
  return { ...removed, wasActive, fallback: await host.designSystems.active(),
    catalogStatus: transition?.catalogStatus ?? 'unchanged', needsReload: transition?.needsReload ?? false };
}
