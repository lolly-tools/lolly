// SPDX-License-Identifier: MPL-2.0
/**
 * Files dropped from the desktop onto an open folder land in that folder (lolly plan
 * 299): a local folder files each upload there, and a shared project or shared folder
 * uploads each file to the project and files it in that folder. At the top of
 * Projects, and for `.lolly` files, the drop chooser runs as before, because there
 * the person still has a choice to make.
 */
import type { PickerHost } from './picker.ts';
import type { DropChooserHooks } from '../lib/drop-router.ts';
import { holdEarlyDrops } from '../lib/drop-early.ts';
import { announce } from '../a11y.ts';
import { t, tRaw } from '../i18n.ts';

export interface ProjectsDropContext {
  host: PickerHost;
  /** The local folder on screen, or null at the top of Projects. */
  folderTarget: () => string | null;
  /** File an upload into a local folder. */
  addToFolder: (folderId: string, assetId: string) => Promise<void>;
  /** Draw the view again after files arrived. */
  refresh: () => Promise<void>;
  mounted: () => boolean;
}

/** The shared project and folder in the address, when a shared project is open. Pure. */
export function sharedDropTarget(hash: string): { projectId: string; folderId: string | null } | null {
  const query = hash.split('?')[1];
  if (!hash.startsWith('#/p') || !query) return null;
  const params = new URLSearchParams(query);
  const projectId = params.get('team');
  if (!projectId || params.get('tab') && params.get('tab') !== 'sessions' && params.get('tab') !== 'files') return null;
  return { projectId, folderId: params.get('folder') || null };
}

const isLolly = (file: File): boolean => /\.lolly$/i.test(file.name);

export function projectsDropHooks(o: ProjectsDropContext): DropChooserHooks {
  const sayAdded = (n: number): void => announce(n === 1 ? t('Added 1 file to this folder.') : tRaw('Added {n} files to this folder.', { n }));
  return {
    hint: () => (sharedDropTarget(window.location.hash) || o.folderTarget() ? t('Drop to add to this folder') : ''),
    async direct(files) {
      if (files.some(isLolly)) return false;
      const shared = sharedDropTarget(window.location.hash);
      // A workspace that keeps no shared files cannot take an upload, so the chooser
      // runs instead and the files go to the person's own library.
      if (shared && !(await import('../org/index.ts')).orgConfig()?.sharing?.projectFiles) return false;
      if (shared) {
        const [{ uploadTeamFile, teamFileMessage }, { moveTeamFolderItem }] = await Promise.all([import('../org/team-files.ts'), import('../org/team-folders.ts')]);
        let added = 0;
        for (const file of files) {
          try {
            const stored = await uploadTeamFile(shared.projectId, file, file.name);
            if (shared.folderId) await moveTeamFolderItem(shared.projectId, shared.folderId, 'file', stored.id);
            added++;
          } catch (error) {
            announce(teamFileMessage(error, 'upload'), { assertive: true });
          }
        }
        if (added) sayAdded(added);
        if (o.mounted()) await o.refresh();
        return true;
      }
      const folderId = o.folderTarget();
      if (!folderId) return false;
      const { storeUserUpload } = await import('./picker.ts');
      let added = 0;
      for (const file of files) {
        try {
          const stored = await storeUserUpload(o.host, file, { sourceHint: 'drop' });
          await o.addToFolder(folderId, stored.id);
          added++;
        } catch (error) {
          const message = (error as { code?: unknown }).code ? (error as Error).message : tRaw('Upload failed: {message}', { message: (error as Error).message });
          announce(message, { assertive: true });
        }
      }
      if (added) sayAdded(added);
      if (o.mounted()) await o.refresh();
      return true;
    },
  };
}

/**
 * Open the Projects drop door at mount. Projects reads the whole library before it first
 * paints, and on a first visit that read also waits for a module to download. A file
 * dropped meanwhile, on the boot screen or on the route's Loading card, used to find no
 * listener, so the browser opened the file and left Lolly. It is now held from this
 * call (lib/drop-early.ts, as on the gallery). The view calls the returned attach after
 * each render: the router then takes over the root, routes the held file as if dropped
 * then, and files what it stores into the folder on screen. Attaching again replaces
 * the live attachment.
 */
export function projectsDropDoor(viewEl: HTMLElement, o: ProjectsDropContext): () => void {
  holdEarlyDrops(viewEl);
  let router: Promise<typeof import('../lib/drop-router.ts')> | undefined;
  return () => {
    router ??= import('../lib/drop-router.ts');
    void router.then(({ attachDropRouter }) => {
      if (!o.mounted()) return;
      attachDropRouter(viewEl, o.host, { ...projectsDropHooks(o), onStored: (ids) => {
        const target = o.folderTarget();
        void (async () => { if (target) for (const id of ids) await o.addToFolder(target, id); await o.refresh(); })();
      } });
    });
  };
}
