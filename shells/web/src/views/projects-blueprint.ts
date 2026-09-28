// SPDX-License-Identifier: MPL-2.0
/**
 * "New project from a blueprint" (views/projects.ts): copy a stored blueprint back out
 * as live sessions and folders. Lifted out of the view whole. It needs only the host's
 * state, the folder store and a repaint, so the mount lends it those.
 */
import { tRaw } from '../i18n.ts';
import { announce } from '../a11y.ts';
import { BATCH_SLOT_PREFIX, PTPL_SLOT_PREFIX, isBatchSlot } from '../lib/batch-slots.ts';
import type { createFolderStore, ProjectTemplate } from '../folders.ts';
import type { WebStateAPI } from '../bridge/state.ts';

/** A host.state.list() row (WebStateAPI's return shape). */
type Entry = Awaited<ReturnType<WebStateAPI['list']>>[number];

/** What the blueprint step borrows from the mount: data access and a repaint. */
export type BlueprintView = { host: { state: WebStateAPI }; store: ReturnType<typeof createFolderStore>; isMounted(): boolean; refresh(): Promise<void> };

/**
 * Copy a blueprint's stored sessions out of the `__ptpl__:` namespace under fresh slots,
 * then rebuild its folder tree over them.
 */
export async function instantiateBlueprint(tp: ProjectTemplate, parent: string | null, view: BlueprintView): Promise<void> {
  const h = view.host;
  const rows = await h.state.list().catch(() => [] as Entry[]);
  const thumbOf = new Map(rows.map(r => [r.slot, r.thumb]));
  const live = new Set(rows.map(r => r.slot));
  const slotMap = new Map<string, string>();
  let i = 0;
  for (const f of tp.tree) for (const it of f.items) {
    if (it.type !== 'session' || slotMap.has(it.ref)) continue;
    const data = await h.state.load(it.ref).catch(() => null);
    if (!data) continue;
    // The original slot sits after the template token: __ptpl__:<token>:<toolId:ts | __batch__:label>.
    const original = it.ref.slice(PTPL_SLOT_PREFIX.length).split(':').slice(1).join(':');
    let slot: string;
    if (isBatchSlot(original)) {
      const base = original.slice(BATCH_SLOT_PREFIX.length);
      slot = BATCH_SLOT_PREFIX + base;
      for (let n = 2; live.has(slot); n++) slot = `${BATCH_SLOT_PREFIX}${base} ${n}`;
    } else {
      const toolId = String((data as { __toolId?: unknown }).__toolId || original.split(':')[0] || 'session');
      slot = `${toolId}:${Date.now()}-${++i}`;
    }
    await h.state.save(slot, data, thumbOf.get(it.ref) ?? undefined);
    live.add(slot);
    slotMap.set(it.ref, slot);
  }
  const root = await view.store.instantiateSubtree(tp.tree, parent, slotMap);
  if (!view.isMounted()) return;
  await view.refresh();
  if (root) announce(tRaw('Created "{name}" from the blueprint', { name: root.name }));
}
