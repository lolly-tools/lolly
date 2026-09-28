// SPDX-License-Identifier: MPL-2.0
/**
 * The two Download actions of the Projects view (views/projects.ts):
 *
 *   Download originals - the stored files as they are, zipped.
 *   Download project   - one folder subtree as a single `.lolly` that opens back into
 *                        Projects (lib/drop-router.ts openLollyProject).
 *
 * Both write `.lolly` files for the sender, so they share the sender's design-system read
 * and the zip-path slug. The view hands them a {@link ProjectDownloadView}: the folder
 * list as it is when the action starts, and getters for the session rows, image refs and
 * profile. Those three are getters because the view's reload() replaces them, and a job
 * reads them after its first await, as the code did when it was part of the view.
 */
import { ENGINE_VERSION } from '@lolly/engine';
import type { AssetRef, HostV1, Profile } from '@lolly-tools/core/host-v1';
import { t, tRaw } from '../i18n.ts';
import { announce } from '../a11y.ts';
import { childFolders, descendantFolderIds } from '../folders.ts';
import type { Folder, FolderItem } from '../folders.ts';
import { isBatchSlot } from '../lib/batch-slots.ts';
import { shareFile } from '../lib/share-file.ts';
import type { JobHandle } from '../lib/jobs.ts';
import type { LollyProjectSessionInput } from '../lib/lolly-pack.ts';
import type { DesignSystemRegistry } from '../lib/design-system/registry.ts';
import type { WebStateAPI } from '../bridge/state.ts';
import type { readUserDesignSystem } from '../bridge/tokens.ts';
import type { LollyAssetsSlice } from './tool-lolly-vehicle.ts';

/** The host surface both downloads call. The web host that mounts Projects carries all of it. */
export interface ProjectDownloadHost {
  state: Pick<WebStateAPI, 'load'>;
  /** Catalog and user-asset reads, the same slice the Share dialog's `.lolly` uses. */
  assets: LollyAssetsSlice;
  export: Pick<HostV1['export'], 'file' | 'share'>;
  log?: HostV1['log'];
  /** Read by bridge/tokens.ts readUserDesignSystem to find the sender's active design system. */
  designSystems?: DesignSystemRegistry;
}

/** A host.state.list() row, as the Projects view keeps it. */
type SessionRow = Awaited<ReturnType<WebStateAPI['list']>>[number];

/** What the Projects view gives the downloads. */
export interface ProjectDownloadView {
  host: ProjectDownloadHost;
  /** The folder list, read before the job starts. */
  folders: readonly Folder[];
  /** The saved-session rows by slot, as the view holds them now. */
  entries(): ReadonlyMap<string, SessionRow>;
  /** The resolved image refs by ref, as the view holds them now. */
  imageRefs(): ReadonlyMap<string, AssetRef>;
  profile(): Profile | null;
  toolName(id: string): string;
  closeMenu(): void;
  /** The view's job starter: it closes the menus, then runs `run` as a background job. */
  startJob(title: string, run: (job: JobHandle) => Promise<unknown>): void;
}

// Leading dots are stripped too, so a folder named ".." can never mint a `../`
// zip path (zip-slip) - it falls back to the 'folder' default like an empty name.
const slug = (s: string): string => s.trim().replace(/[^\w.-]+/g, '-').replace(/^[-.]+|-+$/g, '');

/** The exporter's own design system for a `.lolly` (see tool.ts's share path), or null. */
function readSenderDesignSystem(host: ProjectDownloadHost): Promise<Awaited<ReturnType<typeof readUserDesignSystem>>> {
  return import('../bridge/tokens.ts')
    .then(m => m.readUserDesignSystem(host))
    .catch(() => null);
}

/**
 * Download originals (plans/133 WP-6). The stored files as they are, zipped: every
 * single-tool session as a `.lolly` (the same file Share builds - inputs, carried user
 * assets, thumb), a batch session as its stored JSON, every folder image as its bytes.
 * Nothing is rendered - that is what Render is for. Folders recurse into zip paths.
 */
export async function downloadOriginals(view: ProjectDownloadView, label: string, sessionSlots: readonly string[], imageIds: readonly string[], folderIds: readonly string[], share = false): Promise<void> {
  const { host, folders } = view;
  view.closeMenu();
  const items: Array<{ dir: string; kind: 'session' | 'image'; ref: string }> = [];
  const seen = new Set<string>();
  const add = (dir: string, kind: 'session' | 'image', ref: string): void => { if (!seen.has(ref)) { seen.add(ref); items.push({ dir, kind, ref }); } };
  const walk = (fid: string, dir: string): void => {
    const f = folders.find(x => x.id === fid);
    if (!f) return;
    const d = `${dir}${slug(f.name) || 'folder'}/`;
    for (const it of f.items) add(d, it.type, it.ref);
    for (const c of childFolders(folders, fid)) walk(c.id, d);
  };
  for (const s of sessionSlots) add('', 'session', s);
  for (const i of imageIds) add('', 'image', i);
  for (const fid of folderIds) walk(fid, '');
  if (!items.length) return;
  const zipName = `${slug(label) || 'lolly'}-originals.zip`;
  view.startJob(tRaw('Packing {name}', { name: label }), async (job) => {
    const [{ zipAsync }, { buildLollyFile, creatorFromProfile }] = await Promise.all([import('../lib/zip.ts'), import('../lib/lolly-pack.ts')]);
    const userAssets = await host.assets._exportUserAssets();
    const appVersion = `Lolly ${ENGINE_VERSION}`;
    const creator = creatorFromProfile(view.profile(), { appVersion });
    const entries: Record<string, Uint8Array> = {};
    const taken = new Set<string>();
    // Two same-named members never collide: name-2.ext, name-3.ext…
    const unique = (p: string): string => {
      const dot = p.lastIndexOf('.');
      let q = p;
      for (let n = 2; taken.has(q.toLowerCase()); n++) q = dot > p.lastIndexOf('/') ? `${p.slice(0, dot)}-${n}${p.slice(dot)}` : `${p}-${n}`;
      taken.add(q.toLowerCase());
      return q;
    };
    let done = 0, skipped = 0;
    // The design system rides in every .lolly of the batch; read once, not per session.
    const designSystem = await readSenderDesignSystem(host);
    for (const it of items) {
      if (job.cancelled) return;
      try {
        if (it.kind === 'session') {
          const e = view.entries().get(it.ref);
          const data = await host.state.load(it.ref);
          if (!e || !data) { skipped++; continue; }
          const name = e.label || e.filename || view.toolName(e.toolId) || it.ref;
          if (isBatchSlot(it.ref)) {
            entries[unique(`${it.dir}${slug(name) || 'batch'}.json`)] = new TextEncoder().encode(JSON.stringify(data, null, 2));
          } else {
            const { blob } = await buildLollyFile({ session: data, toolId: e.toolId, name, thumb: e.thumb, userAssets, creator, appVersion, engineVersion: ENGINE_VERSION, ...(designSystem ? { designSystem } : {}) });
            entries[unique(`${it.dir}${slug(name) || 'session'}.lolly`)] = new Uint8Array(await blob.arrayBuffer());
          }
        } else {
          // A catalog ref may carry a ?theme= / ?treatment= modifier; the byte
          // store is keyed by the plain base id (folders.ts's catalogBaseId rule).
          const baseId = it.ref.startsWith('user/') ? it.ref : it.ref.split('?')[0]!.split('#')[0]!;
          const blob = await host.assets._getBlob(baseId);
          if (!blob) { skipped++; host.log?.('warn', 'projects: originals member has no bytes', { ref: it.ref }); continue; }
          const ref = view.imageRefs().get(it.ref);
          const base = String(ref?.meta?.name ?? it.ref.split('/').pop() ?? 'image');
          const file = /\.[a-z0-9]{1,5}$/i.test(base) || !ref?.format ? base : `${base}.${ref.format}`;
          entries[unique(`${it.dir}${slug(file) || 'image'}`)] = new Uint8Array(await blob.arrayBuffer());
        }
      } catch (err) { skipped++; host.log?.('warn', 'projects: originals member skipped', { ref: it.ref, error: String(err) }); }
      job.progress(++done, items.length);
    }
    if (!Object.keys(entries).length) throw new Error(t('Nothing could be packed.'));
    const bytes = await zipAsync(entries);
    const blob = new Blob([bytes as BlobPart], { type: 'application/zip' });
    if (share) await shareFile(host.export, blob, zipName);
    else await host.export.file(blob, { filename: zipName });
    if (skipped) announce(skipped === 1 ? t('1 file could not be packed and was left out') : t('{n} files could not be packed and were left out', { n: skipped }));
    return { zipName };
  });
}

/**
 * Download project. The folder as ONE `.lolly` a recipient opens back into Projects: its
 * subtree, every saved session in it (values, tile, carried uploads and the catalog bytes
 * that may travel) and the pictures filed in it. Batch sessions are not tool sessions and
 * stay behind, which the toast says. Opening the file rebuilds the tree with fresh ids
 * (lib/drop-router.ts openLollyProject).
 */
export async function downloadProject(view: ProjectDownloadView, id: string, share = false): Promise<void> {
  const { host, folders } = view;
  view.closeMenu();
  const root = folders.find(f => f.id === id);
  if (!root) return;
  const inside = new Set(descendantFolderIds(folders, id));
  const tree = [root, ...folders.filter(f => inside.has(f.id))];
  view.startJob(tRaw('Packing {name}', { name: root.name }), async (job) => {
    const [lp, { lollyLibraryResolver }] = await Promise.all([import('../lib/lolly-pack.ts'), import('./tool-lolly-vehicle.ts')]);
    const userAssets = await host.assets._exportUserAssets();
    const appVersion = `Lolly ${ENGINE_VERSION}`;
    const designSystem = await readSenderDesignSystem(host);
    const keys = new Map<string, string>();
    const sessions: LollyProjectSessionInput[] = [];
    const members = tree.flatMap(f => f.items.filter(it => it.type === 'session').map(it => it.ref));
    let skipped = 0;
    for (const slot of members) {
      if (job.cancelled) return;
      const e = view.entries().get(slot);
      const data = isBatchSlot(slot) || !e ? null : await host.state.load(slot).catch(() => null);
      if (!e || !data) { skipped++; job.progress(sessions.length + skipped, members.length); continue; }
      const key = `s${sessions.length + 1}`;
      keys.set(slot, key);
      sessions.push({
        key, toolId: e.toolId, data,
        ...(e.toolVersion ? { toolVersion: e.toolVersion } : {}),
        ...(e.label || e.filename ? { label: e.label || e.filename || '' } : {}),
        ...(e.thumb ? { thumb: e.thumb } : {}),
      });
      job.progress(sessions.length + skipped, members.length);
    }
    const projectFolders = tree.map(f => ({
      id: f.id, name: f.name, parentId: f.id === id ? null : (f.parentId ?? null),
      items: f.items.flatMap((it): FolderItem[] => it.type === 'image' ? [{ type: 'image', ref: it.ref }]
        : keys.has(it.ref) ? [{ type: 'session', ref: keys.get(it.ref)! }] : []),
      ...(f.color ? { color: f.color } : {}),
      ...(f.emoji ? { emoji: f.emoji } : {}),
      ...(f.tags?.length ? { tags: f.tags } : {}),
    }));
    const { blob, filename } = await lp.buildLollyFile({
      kind: 'project', toolId: lp.LOLLY_PROJECT_TOOL_ID, session: null, name: root.name,
      project: { name: root.name, folders: projectFolders, sessions },
      userAssets, resolveLibrary: lollyLibraryResolver(host.assets),
      creator: lp.creatorFromProfile(view.profile(), { appVersion }), appVersion, engineVersion: ENGINE_VERSION,
      ...(designSystem ? { designSystem } : {}),
    });
    if (share) await shareFile(host.export, blob, filename);
    else await host.export.file(blob, { filename });
    if (skipped) announce(skipped === 1 ? t('1 file could not be packed and was left out') : t('{n} files could not be packed and were left out', { n: skipped }));
    return { zipName: filename };
  });
}
