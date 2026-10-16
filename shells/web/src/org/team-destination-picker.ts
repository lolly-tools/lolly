// SPDX-License-Identifier: MPL-2.0
import { getSessionSource, readSourceProjects } from '../lib/session-source.ts';
import { getInstanceBase } from '../lib/instance.ts';
import { announce } from '../a11y.ts';
import { tRaw } from '../i18n.ts';
import { actionButton } from '../components/action-button.ts';
import { mountModal } from '../components/modal.ts';
import { canWriteProject } from './team-access.ts';
import { listTeamFolders, teamFolderPath, TeamFolderError } from './team-folders.ts';

/** Ask which shared project, and which folder in it, takes the items. */
export async function chooseTeamDestination(action: 'Move' | 'Copy' = 'Move'): Promise<{ project: string; folder: string | null } | undefined> {
  const source = getSessionSource(), base = getInstanceBase();
  if (!source?.write || source.write.projectOptions().canSave === false) return;
  const got = await readSourceProjects(source);
  if (source !== getSessionSource() || base !== getInstanceBase()) return;
  if (!got.ok) { announce(tRaw('Shared projects could not be loaded. Try again.')); return; }
  const projects = got.items.filter(project => canWriteProject(project.myRole));
  if (!projects.length) { announce(tRaw('There is no shared project you can save to.')); return; }
  return new Promise(resolve => {
    let request = 0, ready = false;
    const node = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
      const el = document.createElement(tag); el.className = cls; el.textContent = text; return el;
    };
    const modal = mountModal<{ project: string; folder: string | null }>('', {
      className: 'modal team-move-dialog', ariaLabel: tRaw(action === 'Copy' ? 'Copy to a shared project' : 'Move to a shared project'),
      onClose: value => { ++request; resolve(value ?? undefined); },
    });
    const title = node('h2', 'modal-title', tRaw(action === 'Copy' ? 'Copy to a shared project' : 'Move to a shared project'));
    const projectLabel = node('label', 'document-agent-field', tRaw('Shared project')), projectSelect = node('select', 'field-select');
    for (const project of projects) { const option = node('option', '', project.name); option.value = project.id; projectSelect.append(option); }
    projectSelect.setAttribute('aria-label', tRaw('Shared project'));
    projectLabel.append(projectSelect);
    const folderLabel = node('label', 'document-agent-field', tRaw('Folder')), folderSelect = node('select', 'field-select');
    folderSelect.setAttribute('aria-label', tRaw('Folder'));
    folderLabel.append(folderSelect);
    const status = node('p', 'team-project-notice'); status.setAttribute('role', 'status');
    const controls = node('div', 'modal-actions'), cancel = actionButton(tRaw('Cancel'), 'close'), move = actionButton(tRaw(action), 'move', true);
    move.disabled = true;
    controls.append(cancel, move); modal.el.append(title, projectLabel, folderLabel, status, controls);
    const load = async (): Promise<void> => {
      const ticket = ++request, project = projects.find(entry => entry.id === projectSelect.value)!;
      ready = false; move.disabled = true; folderSelect.replaceChildren(); status.textContent = tRaw('Loading…');
      let folders: Awaited<ReturnType<typeof listTeamFolders>> = [];
      try { folders = await listTeamFolders(projectSelect.value); }
      catch (error) {
        // An instance without shared folders still takes items at the project root.
        if (!(error instanceof TeamFolderError && error.status === 404)) {
          if (modal.el.isConnected && ticket === request) status.textContent = tRaw('Folders could not be loaded. Choose another project or try again.');
          return;
        }
      }
      if (!modal.el.isConnected || ticket !== request || source !== getSessionSource() || base !== getInstanceBase()) return;
      const root = node('option', '', project.name); root.value = ''; folderSelect.append(root);
      for (const folder of folders) {
        const option = node('option', '', teamFolderPath(folders, folder.id).map(part => part.name).join(' / '));
        option.value = folder.id; folderSelect.append(option);
      }
      ready = true; move.disabled = false; status.textContent = action === 'Copy' ? tRaw('Copies are visible to everyone with access to this project. Folders inherit project access. Originals stay where they are. Copies carry the file and its name; source tags and library fields stay with the source.') : '';
    };
    projectSelect.addEventListener('change', () => { void load(); });
    cancel.addEventListener('click', () => modal.close());
    move.addEventListener('click', () => { if (source !== getSessionSource() || base !== getInstanceBase()) { ready = false; move.disabled = true; status.textContent = tRaw('The connected workspace changed. Close this dialog and choose again.'); return; } if (ready) modal.close({ project: projectSelect.value, folder: folderSelect.value || null }); });
    projectSelect.focus();
    void load();
  });
}

