// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-files-panel - a team project's "Shared files" screen in Projects: the files everyone who can see the project may
 * download, an upload with progress and Cancel for people who can save to the project,
 * and Delete for the person who uploaded a file or anyone who manages the project.
 *
 * A file that sessions still use is not deleted at once: the panel lists those
 * sessions, and a manager may then choose "Delete anyway". The transfers and the
 * sentence for each refusal live in org/team-files.ts; this module only draws them.
 * Built with DOM APIs and textContent: file and session names come from the instance.
 */
import { tRaw } from '../i18n.ts';
import { promptDialog } from '../components/confirm-dialog.ts';
import { renameProjectFile } from './project-folders.ts';
import { orgConfig } from './index.ts';
import { fmtBytes } from '../lib/format.ts';
import { getHostRef } from '../lib/host-ref.ts';
import { anchorSave } from '../bridge/anchor-save.ts';
import { copyText } from '../lib/copy-text.ts';
import { listProjectPeople, teamProjectFileLinkUrl } from './project-members.ts';
import {
  deleteTeamFile, downloadTeamFile, knownUploaderId, listTeamFiles, teamFileMessage, TeamFileError, uploadTeamFile,
  type TeamFile, type TeamFileList,
} from './team-files.ts';

export interface TeamFilesPanelOptions {
  projectId: string;
  /** The file a shared link selects after the project has been authorised. */
  fileId?: string;
  /** May add files: an editor or better, where the instance lets this person save. */
  canUpload: boolean;
  /** Manages the project (owner, manager, or the instance's project.manage): may
   *  delete any file, including one that sessions still use. */
  canManage?: boolean;
  onBack(): void;
}

/** Hand a downloaded file to the person: the host's own save (a native dialog in the
 *  desktop and mobile apps), or a browser download before the host exists. */
async function saveFile(blob: Blob, name: string): Promise<void> {
  const host = getHostRef();
  if (host?.export.download) await host.export.download(blob, name);
  else anchorSave(blob, name);
}

export function buildTeamFilesPanel(opts: TeamFilesPanelOptions): HTMLElement {
  const panel = document.createElement('div'); panel.className = 'team-files';
  const button = (text: string, act: string, label?: string): HTMLButtonElement => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn--sm'; b.textContent = text; b.dataset.act = act;
    if (label) b.setAttribute('aria-label', label);
    return b;
  };
  const para = (text: string, style = ''): HTMLParagraphElement => {
    const p = document.createElement('p'); p.textContent = text; p.className = 'team-project-notice'; if (style) p.style.cssText = style; return p;
  };
  const back = button(tRaw('← Back to sessions'), 'files-back');
  back.addEventListener('click', opts.onBack);
  const heading = document.createElement('h3'); heading.textContent = tRaw('Shared files'); heading.tabIndex = -1;
  const note = para(tRaw('These files are available to everyone who can see this project.'), '');
  note.className = 'share-shortest-note';
  const linkNote = para(tRaw('File links use the same project access. Sharing a link does not give someone access.'));
  const room = para('', '');
  room.hidden = true;
  const status = document.createElement('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const list = document.createElement('ul'); list.className = 'team-files-list';
  panel.append(back, heading, note, linkNote, room, list, status);
  let selectedOnce = false;
  let linkedFileAvailable = false;

  // Who the signed-in person is on the instance, for Delete on their own files: an
  // upload tells us, or their own row in the project's people list (`isMe`). Not
  // needed by a manager, who may delete any file.
  let me: Promise<string | null> | null = null;
  const whoAmI = (): Promise<string | null> => {
    const known = knownUploaderId();
    if (opts.canManage || known) return Promise.resolve(known);
    me ??= listProjectPeople(opts.projectId)
      .then(got => (got.ok ? got.data.members.find(m => m.isMe)?.userId ?? null : null))
      .catch(() => null);
    return me;
  };

  const download = async (file: TeamFile, b: HTMLButtonElement): Promise<void> => {
    b.disabled = true; status.textContent = tRaw('Downloading…');
    try {
      const blob = await downloadTeamFile(opts.projectId, file);
      if (!panel.isConnected) return;
      await saveFile(blob, file.name);
      status.textContent = '';
    } catch (error) { status.textContent = teamFileMessage(error, 'read'); }
    finally { b.disabled = false; }
  };

  /** The sessions that still use a file, and what this person may do about them. */
  const showInUse = (file: TeamFile, li: HTMLLIElement, del: HTMLButtonElement, error: TeamFileError): void => {
    li.querySelector('[data-file-in-use]')?.remove();
    const box = document.createElement('div');
    box.dataset.fileInUse = '';
    box.setAttribute('role', 'group');
    box.className = 'team-files-in-use';
    const lead = para(tRaw('These sessions use “{name}”:', { name: file.name }), 'margin:0');
    lead.id = `team-file-in-use-${file.id}`;
    box.setAttribute('aria-labelledby', lead.id);
    const uses = document.createElement('ul'); uses.className = 'team-files-uses';
    for (const s of error.sessions) { const item = document.createElement('li'); item.textContent = s.title; uses.append(item); }
    const after = para(opts.canManage
      ? tRaw('If you delete the file, those sessions cannot be opened.')
      : tRaw('Only a project manager can delete a file that a session uses.'));
    const actions = document.createElement('div'); actions.className = 'team-project-actions';
    const keep = button(tRaw('Cancel'), 'file-keep');
    keep.addEventListener('click', () => { box.remove(); del.focus(); });
    if (opts.canManage) {
      const force = button(tRaw('Delete anyway'), 'file-delete-force', tRaw('Delete {name} anyway', { name: file.name }));
      force.addEventListener('click', () => { void remove(file, li, force, true); });
      actions.append(force);
    }
    actions.append(keep);
    box.append(lead, uses, after, actions);
    li.append(box);
    actions.querySelector('button')?.focus();
  };

  const remove = async (file: TeamFile, li: HTMLLIElement, b: HTMLButtonElement, force = false): Promise<void> => {
    b.disabled = true; status.textContent = '';
    try {
      await deleteTeamFile(opts.projectId, file.id, { force });
      if (!panel.isConnected) return;
      await refresh();
      status.textContent = tRaw('Deleted “{name}”.', { name: file.name });
      if (!panel.contains(document.activeElement)) heading.focus();
    } catch (error) {
      if (!panel.isConnected) return;
      const del = li.querySelector<HTMLButtonElement>('[data-act="file-delete"]');
      if (!force && del && error instanceof TeamFileError && error.code === 'FILE_IN_USE') showInUse(file, li, del, error);
      else status.textContent = teamFileMessage(error, 'delete');
    } finally { b.disabled = false; }
  };

  const draw = ({ files, limits }: TeamFileList, mine: string | null): void => {
    list.replaceChildren();
    linkedFileAvailable = files.some(file => file.id === opts.fileId);
    room.hidden = limits.projectBudgetBytes >= Number.MAX_SAFE_INTEGER;
    room.textContent = tRaw('Each file can be up to {max}. This project uses {used} of {total}.', {
      max: fmtBytes(limits.maxBytes), used: fmtBytes(limits.projectUsedBytes), total: fmtBytes(limits.projectBudgetBytes),
    });
    for (const file of files) {
      const li = document.createElement('li'); li.className = 'team-files-row';
      li.dataset.teamFile = file.id;
      const name = document.createElement('span'); name.textContent = file.name; name.className = 'team-files-name';
      const meta = document.createElement('span');
      meta.textContent = [fmtBytes(file.size), file.createdByName].filter(Boolean).join(' · ');
      meta.className = 'team-project-notice';
      const get = button(tRaw('Download'), 'file-download', tRaw('Download {name}', { name: file.name }));
      get.addEventListener('click', () => void download(file, get));
      const copy = button(tRaw('Copy file link'), 'file-copy-link', tRaw('Copy link to {name}', { name: file.name }));
      copy.addEventListener('click', () => {
        void copyText(teamProjectFileLinkUrl(opts.projectId, file.id)).then(copied => {
          if (panel.isConnected) status.textContent = tRaw(copied ? 'Link copied' : 'Could not copy. Try again.');
        });
      });
      li.append(name, meta, get, copy);
      if (opts.canUpload && orgConfig()?.can?.['session.edit'] !== false) {
        const rename = button(tRaw('Rename'), 'file-rename', tRaw('Rename {name}', { name: file.name }));
        rename.addEventListener('click', () => { void (async () => {
          const value = await promptDialog({ title: tRaw('Rename file'), message: tRaw('File name'), value: file.name, confirmLabel: tRaw('Save') });
          if (!value?.trim() || !panel.isConnected) return;
          rename.disabled = true;
          const got = await renameProjectFile(opts.projectId, file.id, value.trim().slice(0, 200));
          if (panel.isConnected) { if (got.ok) await refresh(); else status.textContent = tRaw('Could not rename this file. Refresh and try again.'); }
          rename.disabled = false;
        })(); });
        li.append(rename);
      }
      if (opts.canManage || (mine !== null && file.createdBy === mine)) {
        const del = button(tRaw('Delete'), 'file-delete', tRaw('Delete {name}', { name: file.name }));
        del.addEventListener('click', () => void remove(file, li, del));
        li.append(del);
      }
      list.append(li);
      if (file.id === opts.fileId) {
        li.setAttribute('aria-current', 'true'); li.tabIndex = -1;
        if (!selectedOnce) {
          selectedOnce = true; li.focus(); li.scrollIntoView?.({ block: 'nearest' });
        }
      }
    }
    if (!files.length) { const li = document.createElement('li'); li.textContent = tRaw('This project has no shared files yet.'); list.append(li); }
  };

  const refresh = async (): Promise<void> => {
    const [got, mine] = await Promise.all([listTeamFiles(opts.projectId), whoAmI()]);
    if (panel.isConnected) draw(got, mine);
  };

  if (opts.canUpload) {
    const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.hidden = true;
    const upload = button(tRaw('Upload files'), 'files-upload');
    const cancel = button(tRaw('Cancel'), 'files-cancel');
    cancel.hidden = true;
    let running: AbortController | null = null;
    upload.addEventListener('click', () => input.click());
    cancel.addEventListener('click', () => running?.abort());
    input.addEventListener('change', () => {
      const files = Array.from(input.files ?? []); input.value = '';
      if (!files.length || running) return;
      const job = new AbortController();
      running = job;
      upload.disabled = true; cancel.hidden = false; status.textContent = tRaw('Uploading…');
      // Leaving the panel (Back, or the dialog closing) cancels what is still sending.
      const onProgress = (name: string) => (sent: number, total: number): void => {
        if (!panel.isConnected) { job.abort(); return; }
        status.textContent = tRaw('Uploading {name}… {percent}%', { name, percent: Math.floor((sent * 100) / Math.max(total, 1)) });
      };
      void (async () => {
        try {
          for (const file of files) {
            if (!panel.isConnected || job.signal.aborted) break;
            await uploadTeamFile(opts.projectId, file, file.name, { signal: job.signal, onProgress: onProgress(file.name) });
          }
          if (!panel.isConnected) return;
          await refresh();
          status.textContent = job.signal.aborted ? teamFileMessage(new TeamFileError(0, 'CANCELLED'), 'upload') : tRaw('Saved.');
        } catch (error) {
          if (!panel.isConnected) return;
          status.textContent = teamFileMessage(error, 'upload');
          // Files sent before the failure are in the project now.
          void refresh().catch(() => {});
        } finally {
          running = null;
          upload.disabled = false; cancel.hidden = true;
        }
      })();
    });
    const bar = document.createElement('div'); bar.className = 'team-project-actions';
    bar.append(upload, cancel);
    panel.insertBefore(bar, list); panel.append(input);
  }
  status.textContent = tRaw('Loading…');
  void refresh().then(() => { status.textContent = opts.fileId && !linkedFileAvailable ? tRaw('That file is no longer available.') : ''; }).catch((error: unknown) => { status.textContent = teamFileMessage(error, 'list'); });
  return panel;
}
