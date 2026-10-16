// SPDX-License-Identifier: MPL-2.0
/** Browse one shared project's folders without importing its files onto the device. */
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { getSessionSource, readSourceProjects, type TeamProjectRef } from '../../lib/session-source.ts';
import type { AssetSourceNode } from '../../lib/asset-source-tree.ts';
import { getInstanceBase } from '../../lib/instance.ts';
import { listTeamFiles, type TeamFile } from '../../org/team-files.ts';
import { listTeamFolders, teamItemFolder, teamFolderPath, type TeamFolder } from '../../org/team-folders.ts';
import { projectFileUrl, prepareProjectAsset } from '../../org/team-project-assets.ts';
import { escape as esc } from '../../utils.ts';
import { t } from '../../i18n.ts';
import type { CatCtx } from './context.ts';

export const projectSourceId = (project = '', folder = '') => JSON.stringify(['team-projects', project, folder]);
export function projectSourceSelection(value: string): { project: string; folder: string } | null {
  try { const parts: unknown = JSON.parse(value); return Array.isArray(parts) && parts.length === 3 && parts[0] === 'team-projects' && typeof parts[1] === 'string' && typeof parts[2] === 'string' ? { project: parts[1], folder: parts[2] } : null; }
  catch { return null; }
}
export function projectFileRef(file: TeamFile): AssetRef {
  const format = String(file.asset.format ?? file.name.split('.').at(-1) ?? '').toLowerCase();
  const type: AssetRef['type'] = file.contentType.startsWith('image/') ? format === 'svg' ? 'vector' : 'raster' : file.contentType.startsWith('video/') ? 'video' : file.contentType.startsWith('audio/') ? 'audio' : file.contentType.startsWith('font/') ? 'font' : 'data';
  return { source: 'remote', id: `project/${file.projectId}/${file.id}`, type, format, url: projectFileUrl(file.projectId, file.id), checksum: file.checksum, version: file.checksum,
    meta: { name: file.name, bytes: file.size, projectId: file.projectId, projectFileId: file.id, projectChecksum: file.checksum, fileRole: 'original', _placeholder: true } };
}

export function projectsOps(cat: CatCtx) {
  let projects: TeamProjectRef[] = [], folders: TeamFolder[] = [], files: TeamFile[] = [];
  let scopeSource = getSessionSource(), scopeBase = getInstanceBase();
  let signature = '', generation = 0, loading = false, error = '', page = 0, disposed = false;
  const prepared = new Map<string, Awaited<ReturnType<typeof prepareProjectAsset>>>();
  const active = () => !!projectSourceSelection(cat.sourceSelection);
  const shared = (ref: AssetRef | undefined) => typeof ref?.meta?.projectFileId === 'string';
  const reconcile = () => {
    for (const [id, ref] of cat.assetById) if (shared(ref) && !cat.selected.has(id)) cat.assetById.delete(id);
    for (const file of files) { const ref = projectFileRef(file); if (!cat.selected.has(ref.id)) cat.assetById.set(ref.id, ref); }
  };
  const paint = () => { if (!disposed && cat.mounted) { reconcile(); cat.sections.renderBody(); cat.sources.mount(); } };
  const load = async () => {
    const selection = projectSourceSelection(cat.sourceSelection), source = getSessionSource(), base = getInstanceBase(), ticket = ++generation;
    if (!selection || !source) return;
    loading = true; error = ''; files = []; folders = []; paint();
    try {
      const got = await readSourceProjects(source);
      if (!got.ok) throw new Error('Shared projects could not be loaded.');
      let nextFiles: TeamFile[] = [], nextFolders: TeamFolder[] = [];
      if (selection.project) {
        if (!got.items.some(project => project.id === selection.project)) throw new Error('This shared project is unavailable.');
        const [listed, tree] = await Promise.all([listTeamFiles(selection.project), listTeamFolders(selection.project)]);
        nextFiles = listed.files; nextFolders = tree;
        if (selection.folder && !tree.some(folder => folder.id === selection.folder)) throw new Error('This shared folder is unavailable.');
      }
      if (disposed || ticket !== generation || base !== getInstanceBase() || source !== getSessionSource()) return;
      projects = got.items; files = nextFiles; folders = nextFolders;
      if (selection.project) {
        cat.sourceExpanded.add(projectSourceId()); cat.sourceExpanded.add(projectSourceId(selection.project));
        for (const folder of teamFolderPath(folders, selection.folder || null)) cat.sourceExpanded.add(projectSourceId(selection.project, folder.id));
      }
    } catch (cause) {
      if (disposed || ticket !== generation || base !== getInstanceBase() || source !== getSessionSource()) return;
      projects = []; files = []; folders = []; error = (cause as Error).message;
      for (const [id, ref] of cat.assetById) if (shared(ref)) { cat.assetById.delete(id); cat.selected.delete(id); }
      cat.sections.closeDetails();
    } finally { if (!disposed && ticket === generation) { loading = false; paint(); } }
  };
  const sync = () => {
    if (scopeSource !== getSessionSource() || scopeBase !== getInstanceBase()) {
      scopeSource = getSessionSource(); scopeBase = getInstanceBase(); projects = [];
      for (const [id, ref] of cat.assetById) if (shared(ref)) { cat.assetById.delete(id); cat.selected.delete(id); }
      cat.sections.closeDetails();
    }
    const key = JSON.stringify([getSessionSource()?.scope, getInstanceBase(), cat.sourceSelection]);
    if (key === signature) return;
    signature = key; page = 0; ++generation; files = []; folders = [];
    if (active()) queueMicrotask(() => { void load(); });
  };
  const tree = (): AssetSourceNode | null => {
    if (!getSessionSource()) return null;
    const selection = projectSourceSelection(cat.sourceSelection);
    const branch = (project: string, parent: string | null, seen = new Set<string>()): AssetSourceNode[] => folders.filter(folder => folder.parentId === parent && !seen.has(folder.id)).map(folder => ({ id: projectSourceId(project, folder.id), label: folder.name, children: branch(project, folder.id, new Set([...seen, folder.id])) }));
    return { id: projectSourceId(), label: t('Shared projects'), children: projects.map(project => ({ id: projectSourceId(project.id), label: project.name, ...(selection?.project === project.id ? { children: branch(project.id, null) } : {}) })) };
  };
  const visible = () => {
    const selection = projectSourceSelection(cat.sourceSelection);
    return files.filter(file => teamItemFolder(folders, { kind: 'file', ref: file.id }) === (selection?.folder || null))
      .map(projectFileRef).filter(ref => !cat.hiddenSet.has(ref.id) && cat.filters.matchesType(ref) && String(ref.meta?.name ?? '').toLowerCase().includes(cat.query.trim().toLowerCase()));
  };
  const html = () => {
    if (!active()) return '';
    const selection = projectSourceSelection(cat.sourceSelection)!, project = projects.find(row => row.id === selection.project), refs = visible();
    page = Math.min(page, Math.max(0, Math.ceil(refs.length / 100) - 1));
    const heading = [project?.name ?? t('Shared projects'), ...teamFolderPath(folders, selection.folder || null).map(folder => folder.name)].join(' / ');
    return `<section class="cat-remote" aria-label="${t('Shared projects')}" aria-busy="${loading}"><h2>${esc(heading)}</h2><p>${t('Files retain project access. Adding one to the library is a separate submission.')}</p><p role="${error ? 'alert' : 'status'}">${esc(loading ? t('Loading…') : error || (refs.length === 1 ? t('1 file in this folder') : t('{count} files in this folder', { count: refs.length })))}</p><button type="button" class="btn" data-project-assets="refresh">${t('Refresh')}</button>${!selection.project ? `<p>${t('Choose a shared project in Sources to browse its files and folders.')}</p>` : ''}<div class="cat-grid">${refs.slice(page * 100, (page + 1) * 100).map(cat.thumbs.assetTile).join('')}</div>${refs.length > 100 ? `<div class="cat-remote-controls"><button type="button" class="btn" data-project-assets="previous"${page ? '' : ' disabled'}>${t('Previous page')}</button><span>${page + 1}</span><button type="button" class="btn" data-project-assets="next"${(page + 1) * 100 < refs.length ? '' : ' disabled'}>${t('Next page')}</button></div>` : ''}</section>`;
  };
  const click = (event: Event) => {
    const action = (event.target as Element).closest<HTMLElement>('[data-project-assets]')?.dataset.projectAssets;
    if (!action) return;
    if (action === 'refresh') void load(); else { page += action === 'next' ? 1 : -1; paint(); }
  };
  cat.viewEl.addEventListener('click', click);
  const prepare = async (ref: AssetRef): Promise<AssetRef> => {
    const file = files.find(file => file.id === ref.meta?.projectFileId);
    if (!file || file.checksum !== ref.checksum) throw new Error('This shared file is unavailable or changed. Refresh the folder.');
    const source = getSessionSource(), base = getInstanceBase();
    const got = await prepareProjectAsset(file.projectId, file);
    if (disposed || source !== getSessionSource() || base !== getInstanceBase()) { got.dispose(); throw new Error('The connected workspace changed.'); }
    prepared.get(ref.id)?.dispose(); prepared.set(ref.id, got);
    return { ...got.ref, id: ref.id };
  };
  return { active, shared, sync, reconcile, tree, html, visible, prepare, dispose() { disposed = true; ++generation; for (const value of prepared.values()) value.dispose(); cat.viewEl.removeEventListener('click', click); } };
}
