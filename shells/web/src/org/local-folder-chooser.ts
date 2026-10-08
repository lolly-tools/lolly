// SPDX-License-Identifier: MPL-2.0
/**
 * org/local-folder-chooser - pick one of the person's own folders (or the top of
 * Projects) as the destination for shared work: "Copy to my projects" and "Add to a
 * folder" (lolly plan 299).
 *
 * Resolves the chosen folder id, null for the top of Projects, or undefined when the
 * person closed the dialog.
 */
import { mountModal } from '../components/modal.ts';
import { createFolderStore, type Folder, type FolderHost } from '../folders.ts';
import { tRaw } from '../i18n.ts';

/** The folders as an indented list, parents before children, names sorted. Pure. */
export function folderOutline(folders: readonly Folder[]): Array<{ id: string; name: string; depth: number }> {
  const out: Array<{ id: string; name: string; depth: number }> = [];
  const byParent = new Map<string | null, Folder[]>();
  for (const f of folders) {
    if (f.link || f.teamCopy) continue;
    const key = f.parentId ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), f]);
  }
  const walk = (parent: string | null, depth: number, seen: Set<string>): void => {
    for (const f of [...(byParent.get(parent) ?? [])].sort((a, b) => a.name.localeCompare(b.name))) {
      if (seen.has(f.id) || depth > 12) continue;
      seen.add(f.id);
      out.push({ id: f.id, name: f.name, depth });
      walk(f.id, depth + 1, seen);
    }
  };
  walk(null, 0, new Set());
  return out;
}

export async function chooseLocalFolder(host: FolderHost, opts: { title: string; confirmLabel: string }): Promise<string | null | undefined> {
  const outline = folderOutline(await createFolderStore(host).list());
  return new Promise((resolve) => {
    let chosen: string | null | undefined;
    const modal = mountModal('', { className: 'modal team-move-dialog', ariaLabel: opts.title, onClose: () => resolve(chosen) });
    const heading = document.createElement('h2');
    heading.className = 'modal-title';
    heading.textContent = opts.title;
    const label = document.createElement('label');
    label.className = 'document-agent-field';
    label.textContent = tRaw('Folder');
    const select = document.createElement('select');
    select.className = 'field-select';
    const top = document.createElement('option');
    top.value = '';
    top.textContent = tRaw('Top of Projects');
    select.append(top);
    for (const row of outline) {
      const option = document.createElement('option');
      option.value = row.id;
      option.textContent = `${' '.repeat(row.depth)}${row.name}`;
      select.append(option);
    }
    label.append(select);
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn';
    cancel.textContent = tRaw('Cancel');
    cancel.addEventListener('click', () => modal.close());
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'btn btn--primary';
    ok.textContent = opts.confirmLabel;
    ok.addEventListener('click', () => { chosen = select.value || null; modal.close(); });
    actions.append(cancel, ok);
    modal.el.append(heading, label, actions);
    select.focus();
  });
}
