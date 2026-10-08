// SPDX-License-Identifier: MPL-2.0
/**
 * org/project-browse-sheet - the shared projects a person can open but that are not in
 * their own Projects list: projects shared with everyone on the workspace, projects an
 * admin can open, and projects the person hid (lolly plan 299 section 6).
 *
 * Each row opens the project or adds it to the person's list ("pinned"); a hidden one
 * can be shown again. Nothing here changes who has access.
 */
import { mountModal } from '../components/modal.ts';
import { announce } from '../a11y.ts';
import { tRaw } from '../i18n.ts';
import type { TeamProjectRef } from '../lib/session-source.ts';

const ROW_LIMIT = 200;

/** Why a project is in this list, in a few words. Plain text. */
export function browseReason(p: Pick<TeamProjectRef, 'via' | 'listed'>): string {
  if (p.listed === 'hidden') return tRaw('Hidden from your projects');
  if (p.via === 'everyone') return tRaw('Shared with everyone');
  if (p.via === 'admin') return tRaw('You can open this as an admin');
  return tRaw('Shared project');
}

export function openProjectBrowse(opts: {
  projects: readonly TeamProjectRef[];
  workspace: string;
  setListing: (projectId: string, listed: 'pinned' | 'hidden' | null) => Promise<boolean>;
  onChanged: () => void;
}): void {
  const modal = mountModal('', { className: 'modal team-invite-dialog project-browse', ariaLabel: tRaw('Browse shared projects') });
  const head = document.createElement('header');
  head.className = 'team-project-head';
  const title = document.createElement('h2');
  title.className = 'modal-title';
  title.textContent = tRaw('Browse shared projects');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn btn--sm';
  close.textContent = tRaw('Close');
  close.addEventListener('click', () => modal.close());
  head.append(title, close);
  const intro = document.createElement('p');
  intro.className = 'team-project-notice';
  intro.textContent = opts.workspace
    ? tRaw('Projects you can open at {workspace} that are not in your own list. Add one to keep it with your projects.', { workspace: opts.workspace })
    : tRaw('Projects you can open that are not in your own list. Add one to keep it with your projects.');
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'field-input';
  search.placeholder = tRaw('Search shared projects');
  search.setAttribute('aria-label', tRaw('Search shared projects'));
  const list = document.createElement('ul');
  list.className = 'share-access-list project-browse-list';
  const status = document.createElement('p');
  status.className = 'team-project-notice';
  status.setAttribute('role', 'status');
  const added = new Set<string>();

  const draw = (): void => {
    const q = search.value.trim().toLowerCase();
    const matches = opts.projects.filter((p) => !q || p.name.toLowerCase().includes(q));
    list.replaceChildren();
    for (const p of matches.slice(0, ROW_LIMIT)) {
      const li = document.createElement('li');
      li.className = 'share-access-row';
      const who = document.createElement('div');
      who.className = 'share-access-who';
      const name = document.createElement('a');
      name.className = 'share-access-name';
      name.href = `#/p?team=${encodeURIComponent(p.id)}`;
      name.textContent = p.name;
      name.addEventListener('click', () => modal.close());
      const why = document.createElement('div');
      why.className = 'share-access-muted';
      why.textContent = added.has(p.id) ? tRaw('In your projects') : browseReason(p);
      who.append(name, why);
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'btn btn--sm';
      add.textContent = added.has(p.id) ? tRaw('Remove from my projects') : tRaw('Add to my projects');
      add.setAttribute('aria-label', added.has(p.id) ? tRaw('Remove {name} from my projects', { name: p.name }) : tRaw('Add {name} to my projects', { name: p.name }));
      add.addEventListener('click', async () => {
        add.disabled = true;
        const adding = !added.has(p.id);
        const ok = await opts.setListing(p.id, adding ? 'pinned' : null);
        add.disabled = false;
        if (!ok) { status.textContent = tRaw('Could not save that change. Try again.'); return; }
        if (adding) added.add(p.id); else added.delete(p.id);
        announce(adding ? tRaw('{name} is now in your projects.', { name: p.name }) : tRaw('{name} is no longer in your projects.', { name: p.name }));
        opts.onChanged();
        draw();
      });
      li.append(who, add);
      list.append(li);
    }
    status.textContent = !matches.length
      ? (q ? tRaw('No shared projects match your search.') : tRaw('Every shared project you can open is already in your projects.'))
      : matches.length > ROW_LIMIT ? tRaw('Showing {shown} of {total}. Search to narrow the list.', { shown: ROW_LIMIT, total: matches.length }) : '';
  };
  search.addEventListener('input', draw);
  modal.el.append(head, intro, search, status, list);
  draw();
  search.focus();
}
