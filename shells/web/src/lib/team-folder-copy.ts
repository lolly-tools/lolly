// SPDX-License-Identifier: MPL-2.0
import { folderPath, type Folder, type FolderTeamCopy } from '../folders.ts';
import type { SessionSourceWriter, TeamSessionWrite } from './session-source.ts';

export interface FolderCopyEntry { ref: string; name: string; session?: TeamSessionWrite; file?: Blob; }
export interface FolderCopyKit {
  writer: SessionSourceWriter;
  upload(projectId: string, blob: Blob, name: string): Promise<string>;
  remember(copy: FolderTeamCopy): Promise<void>;
  current(): boolean;
  progress(done: number, total: number): void;
}

/** Copy every preflighted material; keep checkpoints so a failed transfer can resume. */
export async function copyFolderToTeam(name: string, instance: string, entries: readonly FolderCopyEntry[], previous: FolderTeamCopy | undefined, kit: FolderCopyKit): Promise<FolderTeamCopy> {
  const check = () => { if (!kit.current()) throw Error('Folder sharing cancelled'); };
  check();
  let copy = previous?.instance === instance ? { ...previous, complete: false, copied: { ...previous.copied } } : undefined;
  if (!copy) {
    const created = await kit.writer.createProject({ name, visibility: 'private' });
    if (created.kind !== 'created') throw Error(`Project creation failed (${created.status})`);
    copy = { instance, projectId: created.project.id, complete: false, copied: {} };
    await kit.remember(copy);
  }
  let done = 0;
  for (const entry of entries) {
    check();
    if (!Object.hasOwn(copy.copied, entry.ref)) {
      let id: string;
      if (entry.session) {
        const saved = await kit.writer.createSession(copy.projectId, entry.session);
        if (saved.kind !== 'saved') throw Error(saved.kind === 'file-error' ? saved.message : `Document could not be shared (${saved.kind === 'error' ? saved.status : 409})`);
        id = saved.id;
      } else if (entry.file) id = await kit.upload(copy.projectId, entry.file, entry.name);
      else throw Error('A folder material is missing');
      copy.copied = Object.fromEntries([...Object.entries(copy.copied), [entry.ref, id]]);
      await kit.remember(copy);
    }
    kit.progress(++done, entries.length);
  }
  check(); copy.complete = true; await kit.remember(copy); return copy;
}

/** A changed local material gets its own checkpoint, never an earlier copy's marker. */
export async function folderCopyKey(ref: string, value: string | Blob): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : await value.arrayBuffer();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return `${ref}:${Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

/** Nested names remain visible in the shared collection; original folders stay intact. */
export function sharedFolderMaterialName(tree: readonly Folder[], root: string, folder: string, name: string): string {
  const path = folderPath(tree, folder), start = path.findIndex(item => item.id === root);
  return [...path.slice(start + 1).map(item => item.name), name].join(' / ');
}
