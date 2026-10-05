// SPDX-License-Identifier: MPL-2.0
/** Group a captured local selection into one folder without mixing shared project writes. */
import type { createFolderStore } from '../folders.ts';

export async function groupSelectionInFolder(store: Pick<ReturnType<typeof createFolderStore>, 'create' | 'moveItem' | 'moveFolder'>, name: string, parent: string | null, selected: { sessions: string[]; images: string[]; folders: string[] }): Promise<void> {
  const created = await store.create(name, parent);
  for (const ref of selected.sessions) await store.moveItem(ref, created.id, 'session');
  for (const ref of selected.images) await store.moveItem(ref, created.id, 'image');
  for (const id of selected.folders) if (id !== created.id) await store.moveFolder(id, created.id);
}
