// SPDX-License-Identifier: MPL-2.0
/**
 * reset.ts - "Reset to original" for the design systems that came with the app
 * and are the person's to change: the catalog's own system once edited here (the
 * `default` record a first edit makes, bridge/tokens.ts) and a companion such as
 * Lolly Starter (companions.ts). A managed system is locked, so nobody edits it
 * and it has nothing to reset; a system the person made has no original.
 *
 * Neither reset touches saved sessions or personal uploads, which are outside
 * every system, and neither deletes a row another system still draws from
 * (manage.ts clearDesignSystemMaterial).
 */
import { SHIPPED_DESIGN_SYSTEM_ID, withDesignSystemIdentity } from '../../../../../engine/src/design-system.ts';
import { stripVersionIndex } from '../../../../../engine/src/design-version.ts';
import { installUserTokens } from '../../bridge/tokens.ts';
import { t } from '../../i18n.ts';
import { companionDoc, type CompanionHost } from './companions.ts';
import { clearDesignSystemMaterial, removeDesignSystem } from './manage.ts';
import type { DesignSystemRecord } from './registry.ts';
import { STARTER_TOKENS_ID } from './starter.ts';
import { switchDesignSystem, type SwitchHost, type SwitchOptions } from './switch.ts';

export type ResetHost = CompanionHost & SwitchHost;

/** Which original a record goes back to, or null when it has none. */
export function resetKind(record: DesignSystemRecord): 'edited-shipped' | 'companion' | null {
  if (record.locked || record.source.kind !== 'local') return null;
  if (record.source.from === 'shipped') return 'edited-shipped';
  if (record.source.from === 'app') return 'companion';
  return null;
}

/**
 * Put one system back the way it came. The edited copy of the catalog's system
 * goes, and the catalog's own row comes back in its place (active if the copy
 * was). A companion keeps its id and place in the list, and its material is
 * replaced by the companion's document under the companion's name.
 */
export async function resetDesignSystem(host: ResetHost, id: string, opts: SwitchOptions = {}): Promise<DesignSystemRecord> {
  const registry = host.designSystems;
  registry.bust();
  const record = await registry.get(id);
  const kind = record ? resetKind(record) : null;
  if (!record || !kind) throw new Error(t('This design system has no original to go back to.'));
  const wasActive = (await registry.activeId()) === id;

  if (kind === 'edited-shipped') {
    await registry.setShippedHidden(false);
    // Switch while the edited copy still exists, as a removal does.
    if (wasActive) await switchDesignSystem(host, SHIPPED_DESIGN_SYSTEM_ID, { ...opts, noRemount: true });
    await removeDesignSystem(host, id);
    const shipped = await registry.get(SHIPPED_DESIGN_SYSTEM_ID);
    if (!shipped) throw new Error(t('This design system has no original to go back to.'));
    return shipped;
  }

  const source = record.source.kind === 'local' ? record.source : null;
  const companion = source?.companion ?? { tokens: STARTER_TOKENS_ID, label: record.label };
  // Read the original before anything is deleted, so an unreadable one changes nothing.
  const doc = await companionDoc(host, companion.tokens);
  if (!doc) throw new Error(t('The original could not be read. Try again when the catalogue has synced.'));
  await clearDesignSystemMaterial(host, id);
  const reset: DesignSystemRecord = {
    id: record.id,
    label: companion.label,
    ns: record.ns,
    headId: record.headId,
    source: { kind: 'local', from: 'app', companion },
    locked: false,
    createdAt: record.createdAt,
    lastUsedAt: Date.now(),
  };
  await registry.put(reset);
  await installUserTokens(host,
    withDesignSystemIdentity(stripVersionIndex(doc), { id: reset.id, label: reset.label }), { system: reset.id, label: reset.label });
  host.tokens?.bust?.({ lock: true });
  // The active system's colours, type and logos just changed under the page.
  if (wasActive) await switchDesignSystem(host, reset.id, { ...opts, noRemount: true });
  return reset;
}
