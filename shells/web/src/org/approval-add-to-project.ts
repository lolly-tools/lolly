// SPDX-License-Identifier: MPL-2.0
/**
 * org/approval-add-to-project - put an approved file in a project, in one step.
 *
 * The same choice as Assets' Add to project: a device folder keeps a reference to the
 * person's own copy, and a shared project receives a file copy. The kept copy holds its
 * request on its record, so Assets can lead back to the approval. A shared project's file
 * record has no place for that link, so a shared copy stands on its own; the person's own
 * copy keeps the link either way. Nothing here touches an organisation catalog.
 *
 * Comments describe a generic "instance" capability, never a specific product.
 */
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import { choiceDialog, promptDialog } from '../components/confirm-dialog.ts';
import { createFolderStore, folderPath, type FolderHost } from '../folders.ts';
import { t, tRaw } from '../i18n.ts';
import { storeApprovedFile, type ApprovedAssetHost } from '../lib/approved-asset.ts';
import { getHostRef } from '../lib/host-ref.ts';
import { getInstanceBase } from '../lib/instance.ts';
import { getSessionSource } from '../lib/session-source.ts';
import { decidedAt, type ApprovalRow } from './approval-work.ts';

/** Keep the file and put it in a project. Returns a sentence for the sheet, or null when the person
 *  backed out and nothing was kept. */
export async function addApprovedFileToProject(row: ApprovalRow, blob: Blob): Promise<string | null> {
  const host = getHostRef();
  if (!host) return null;
  const store = createFolderStore(host as HostV1 & FolderHost);
  const folders = await store.list();
  const writer = getSessionSource()?.write;
  const shared = !!writer && writer.projectOptions().canSave !== false && writer.projectOptions().canShareFiles !== false;
  const chosen = await choiceDialog({
    title: t('Add to project'),
    message: shared ? t('Device folders hold references. Shared project folders receive file copies visible to everyone with project access.') : t('A copy goes in Assets, and the project keeps a reference.'),
    choices: [
      ...(shared ? [{ id: '__shared__', label: t('Copy to a shared project…') }] : []),
      ...folders.map(f => ({ id: f.id, label: folderPath(folders, f.id).map(part => part.name).join(' / ') })),
      { id: '__new__', label: t('New project…'), primary: folders.length === 0 },
    ],
  });
  if (!chosen) return null;
  let target = chosen;
  if (chosen === '__new__') {
    const name = await promptDialog({ title: t('New project'), message: t('Name the project folder.'), placeholder: t('Project name'), confirmLabel: t('Create') });
    if (!name) return null;
    target = (await store.create(name)).id;
  }
  const { exportReview: file } = row;
  const id = await storeApprovedFile(host as HostV1 & ApprovedAssetHost, {
    blob, name: file.name, format: file.format, toolId: file.toolId,
    ...(file.widthPx ? { width: file.widthPx } : {}), ...(file.heightPx ? { height: file.heightPx } : {}),
    link: { id: row.id, instance: getInstanceBase() || location.origin, sha256: file.sha256, decidedAt: decidedAt(row) },
  });
  if (chosen === '__shared__') {
    const ref = await sharedRef(host, id);
    if (!ref) return t('Could not finish that. Try again.');
    const { openAssetProjectCopy } = await import('./asset-project-transfer.ts');
    await openAssetProjectCopy(host, [ref]);
    return null;
  }
  await store.addItem(target, { type: 'image', ref: id });
  const placed = folders.find(f => f.id === target)?.name;
  return placed ? tRaw('Added to {project}.', { project: placed }) : t('Added to the new project.');
}

async function sharedRef(host: HostV1, id: string): Promise<AssetRef | null> {
  const listed = await (host as HostV1 & { assets: { _listUserAssets(): Promise<readonly AssetRef[]> } }).assets._listUserAssets();
  return listed.find(asset => asset.id === id) ?? null;
}
