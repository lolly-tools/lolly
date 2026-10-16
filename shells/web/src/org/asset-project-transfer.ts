// SPDX-License-Identifier: MPL-2.0
/** Explicit copies into shared folders. A saved upload and its placement are separate steps. */
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import { getInstanceBase } from '../lib/instance.ts';
import { getSessionSource } from '../lib/session-source.ts';
import { readAssetViewerBytes } from '../lib/asset-viewer-source.ts';
import { copyTeamFile, listTeamFiles, teamFileMessage } from './team-files.ts';
import { listTeamFolders, moveTeamFolderItem, teamItemFolder, TeamFolderError } from './team-folders.ts';
import { chooseTeamDestination } from './team-destination-picker.ts';
import { mountModal } from '../components/modal.ts';
import { announce } from '../a11y.ts';
import { tRaw } from '../i18n.ts';

export interface ProjectDestination { project: string; folder: string | null }
interface Receipt { fileId: string; placed: boolean }
export interface CopyResult { id: string; fileId?: string; ok: boolean; message?: string }
const running = new Set<string>();
const volatileScopes = new WeakMap<object, string>();

export async function openAssetProjectCopy(host: HostV1, refs: readonly AssetRef[]): Promise<void> {
  const openedSource = getSessionSource(), openedBase = getInstanceBase();
  const current = () => openedSource === getSessionSource() && openedBase === getInstanceBase();
  const target = await chooseTeamDestination('Copy');
  if (!target || !current()) return;
  const controller = new AbortController();
  const modal = mountModal<void>('', { className: 'modal', ariaLabel: tRaw('Copy to shared project'), onClose() { controller.abort(); } });
  const title = document.createElement('h2'); title.textContent = tRaw('Copy to shared project');
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  const rows = document.createElement('ul');
  const open = document.createElement('a'); open.className = 'btn'; open.textContent = tRaw('Open destination folder');
  open.href = `#/p?team=${encodeURIComponent(target.project)}${target.folder ? `&folder=${encodeURIComponent(target.folder)}` : ''}`;
  open.addEventListener('click', () => modal.close());
  const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'btn'; retry.textContent = tRaw('Retry failed copies');
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn'; cancel.textContent = tRaw('Cancel remaining copies'); cancel.addEventListener('click', () => { controller.abort(); cancel.disabled = true; });
  const close = document.createElement('button'); close.type = 'button'; close.className = 'btn'; close.textContent = tRaw('Done'); close.addEventListener('click', () => modal.close());
  modal.el.append(title, status, rows, open, retry, cancel, close);
  let pending = [...refs], completed = 0;
  const run = async () => {
    retry.disabled = true; close.disabled = true; cancel.hidden = false; cancel.disabled = false; status.textContent = tRaw('Copying…');
    try {
      if (!current()) throw new Error(tRaw('The connected workspace changed. Close this dialog and choose again.'));
      const results = await copyAssetsToProject(host, pending, target, controller.signal);
      completed += results.filter(result => result.ok).length;
      rows.replaceChildren();
      for (const result of results.filter(result => !result.ok)) {
        const row = document.createElement('li');
        row.textContent = `${String(pending.find(ref => ref.id === result.id)?.meta?.name ?? result.id)}: ${result.fileId ? tRaw('Upload saved; placement is not confirmed.') + ' ' : ''}${result.message}`;
        rows.append(row);
      }
      pending = pending.filter(ref => results.some(result => result.id === ref.id && !result.ok));
      status.textContent = tRaw('{done} of {total} copies saved in the destination folder.', { done: completed, total: refs.length });
    } catch (error) { status.textContent = String((error as Error).message); }
    close.disabled = false; cancel.hidden = true; retry.disabled = controller.signal.aborted; retry.hidden = pending.length === 0;
    announce(status.textContent ?? '');
  };
  retry.addEventListener('click', () => { void run(); });
  await run();
}

export async function copyAssetsToProject(host: HostV1, refs: readonly AssetRef[], target: ProjectDestination, signal?: AbortSignal): Promise<CopyResult[]> {
  const source = getSessionSource(), base = getInstanceBase();
  const current = () => source === getSessionSource() && base === getInstanceBase();
  if (!source?.write || source.write.projectOptions().canShareFiles === false) throw new Error('Shared project files are unavailable.');
  if (!volatileScopes.has(source)) volatileScopes.set(source, crypto.randomUUID());
  const scope = source.scope ?? volatileScopes.get(source)!;
  const foldersOf = async () => { try { return await listTeamFolders(target.project); } catch (error) { if (!target.folder && error instanceof TeamFolderError && error.status === 404) return []; throw error; } };
  const results: CopyResult[] = [];
  for (const ref of refs) {
    const identity = new TextEncoder().encode(JSON.stringify([target.project, target.folder, ref.id, ref.version, ref.checksum]));
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', identity)), n => n.toString(16).padStart(2, '0')).join('');
    const key = `__projectcopy__:${base}:${scope}:${digest}`;
    if (running.has(key)) { results.push({ id: ref.id, ok: false, message: 'This copy is already running.' }); continue; }
    running.add(key);
    let receipt: Receipt | null = null;
    try {
      if (signal?.aborted) throw new Error('Copy cancelled.');
      if (!current()) throw new Error('The connected workspace changed. Open Assets again before copying.');
      receipt = await host.state.load(key) as Receipt | null;
      const listed = await listTeamFiles(target.project);
      if (target.folder && !(await foldersOf()).some(folder => folder.id === target.folder)) throw new Error('The destination folder no longer exists.');
      if (receipt && !listed.files.some(file => file.id === receipt!.fileId)) throw new Error('The earlier upload is not confirmed. Refresh the shared project and retry.');
      if (!receipt) {
        if (ref.meta?.provider && (ref.meta.providerOriginalsAvailable === false || ref.meta.fileRole !== 'original')) throw new Error('Select an available original file before copying from this provider.');
        if (ref.meta?.fileRole === 'preview') throw new Error('A preview cannot be copied as an original. Select an available original file.');
        const original = ref.meta?.selectedFile ? ref.url : ref.original?.url ?? ref.url;
        const bytes = await readAssetViewerBytes(original, signal ?? new AbortController().signal, listed.limits.maxBytes);
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource)), n => n.toString(16).padStart(2, '0')).join('');
        if (!ref.meta?.selectedFile && ref.checksum && /^[a-f0-9]{64}$/.test(ref.checksum) && hash !== ref.checksum) throw new Error('The selected file changed or failed verification. Select it again.');
        if (signal?.aborted) throw new Error('Copy cancelled.');
      if (!current()) throw new Error('The connected workspace changed. Open Assets again before copying.');
        const file = await copyTeamFile(target.project, new Blob([bytes as BlobPart]), String(ref.meta?.name ?? ref.id.split('/').at(-1) ?? 'Asset'), {
          async onReserved(fileId) { receipt = { fileId, placed: false }; await host.state.save(key, receipt); },
          async onAbandoned() { receipt = null; await host.state.delete(key); },
          stillCurrent: current, signal,
        });
        receipt = { fileId: file.id, placed: false };
        await host.state.save(key, receipt);
      }
      if (!current()) throw new Error('The connected workspace changed. The upload is saved; placement can be retried.');
      if (signal?.aborted) throw new Error('Copy cancelled. The upload is saved; placement can be retried.');
      const folders = await foldersOf();
      if (!current()) throw new Error('The connected workspace changed. The upload is saved; placement can be retried.');
      const existing = teamItemFolder(folders, { kind: 'file', ref: receipt.fileId }) ?? null;
      if (receipt.placed && existing !== target.folder) throw new Error('This copied file has since moved. Open the project to choose its location.');
      if (existing !== target.folder) await moveTeamFolderItem(target.project, target.folder, 'file', receipt.fileId);
      receipt.placed = true;
      await host.state.save(key, receipt);
      results.push({ id: ref.id, fileId: receipt.fileId, ok: true });
    } catch (error) {
      const message = error instanceof Error && error.name !== 'TeamFileError' ? error.message : teamFileMessage(error, 'upload');
      results.push({ id: ref.id, ...(receipt ? { fileId: receipt.fileId } : {}), ok: false, message });
    } finally { running.delete(key); }
  }
  return results;
}
