// SPDX-License-Identifier: MPL-2.0
/**
 * Folder export - render every saved session in a folder subtree to a file and pack the
 * whole tree into ONE zip on the user's Desktop.
 *
 * Formats: svg/emf/eps and the data formats render DOM-free in pure Node; raster/pdf/
 * video render via the scoped Chromium tier once `lolly install-browser` has run (the
 * same Tier-B path a single ToolView export uses - exportToFile routes per format).
 * When a row's format needs the browser tier and it isn't installed, the row falls back
 * to HTML and SAYS so (BatchMember.note, surfaced in the progress log and the zip's
 * lolly.txt) rather than failing the batch or degrading silently. The ZIP itself can be
 * password-locked via the engine's zip-crypto framer (buildEncryptedZip).
 *
 * The render itself is delegated to engine-render.exportToFile so the exportFile hook +
 * physical-unit handling stay in one place; this module re-implements only the html
 * fallback (which lives in the view, not the helper) and the packaging.
 */
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { zipSync, deflateSync, strToU8, type Zippable } from 'fflate';
import { crc32, buildEncryptedZip, type ZipTier, type ZipEntryInput, type BatchRow } from '@lolly/engine';
import type { JSDOM } from 'jsdom';
import { mountTool, exportToFile, exportableFormats } from './engine-render.ts';
import { listSessions, defaultExportDir, slug, type SavedSession } from './store.ts';
import { childFolders, type Folder } from './folders.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';

/** A rendered (or skipped) member, surfaced for the tick log + result summary. */
export interface BatchMember {
  slot: string;
  label: string;
  zipPath: string;        // relative path inside the zip (nested by folder tree)
  format: string;         // format actually written (may be 'html' via fallback)
  bytes: number;
  ok: boolean;
  reason?: string;        // set when ok === false
  /** Set when ok but degraded: the html fallback (browser tier missing / no vector
   *  output) or a format the tool doesn't declare. Surfaced per-row, never silent. */
  note?: string;
}

export interface ExportFolderOpts {
  /** Per-file progress. `label` carries a status glyph prefix: '✓ ', '⚠ ', or '✗ '.
   *  `done` increments AFTER each session is attempted (success OR skip). */
  onProgress?: (done: number, total: number, label: string) => void;
  /** When set, the whole zip is encrypted via engine zip-crypto (buildEncryptedZip). */
  zipPassword?: string;
  /** Encryption tier when zipPassword is set. Default 'standard' (opens in any unzip,
   *  incl. Windows Explorer); 'strong' = WinZip AES-256. */
  zipTier?: ZipTier;
  /** Preferred export format; falls back per-tool when unsupported. Default 'svg'. */
  format?: string;
  unit?: string;          // default 'px'
  dpi?: number;           // default 300
  /** Where the .zip lands. Default defaultExportDir() (~/Desktop). */
  outDir?: string;
}

export interface ExportFolderResult {
  zipPath: string;        // absolute path of the written .zip
  count: number;          // sessions successfully rendered into the zip
  bytes: number;          // size of the zip on disk
  members: BatchMember[]; // every attempted session (ok + skipped), in render order
}

// Already-compressed payloads gain nothing from deflate; store them (method 0) - Tier-B
// members (png/jpg/pdf/video) are already compressed bytes. Mirrors pro/zip.ts.
const STORE_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'pdf', 'webm', 'mp4']);
const extOf = (name: string): string => {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
};

/** One log/manifest line for a member: ✓ ok · ⚠ ok but degraded (note says why) · ✗ skipped. */
function memberLine(m: BatchMember): string {
  if (!m.ok) return `✗ ${m.zipPath}  (skipped: ${m.reason ?? 'unknown'})`;
  return m.note ? `⚠ ${m.zipPath}  (${m.note})` : `✓ ${m.zipPath}`;
}

/** The small credit/manifest dropped into every zip. */
function manifestText(zipName: string, folderName: string, members: BatchMember[]): string {
  const now = new Date();
  const date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const time = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  const ok = members.filter(m => m.ok);
  const degraded = ok.some(m => m.note);
  const lines = [
    'Lolly  •  https://lolly.tools',
    '-'.repeat(56),
    '',
    `[[ ${zipName} ]]`,
    `Folder: ${folderName}`,
    `Created on ${date} at ${time} (local)`,
    '',
    `[ ${ok.length} file${ok.length === 1 ? '' : 's'} included ]`,
    '',
    ...members.map(memberLine),
    '',
    '-'.repeat(56),
    'Rendered in the terminal. svg/emf/eps and data formats render natively;',
    'png/jpg/pdf/video use the scoped browser tier (one-time `lolly install-browser`).',
    ...(degraded ? [
      'Rows marked ⚠ degraded - each note says why; a missing browser tier falls',
      'back to HTML.',
    ] : []),
    'A password locks the ZIP itself.',
    '',
  ];
  return lines.join('\n') + '\n';
}

/**
 * The (ref, relDir) render plan for `folder`'s whole subtree: each folder id maps to its
 * slugged path relative to `folder` (root → ''), BFS so a parent's relDir is set before
 * its children, single-membership honoured (first folder wins). Exported so the Projects
 * view's format step can inspect the SAME session set exportFolder will render.
 */
export function planFolderRefs(folder: Folder, allFolders: Folder[]): { ref: string; relDir: string }[] {
  const relDirOf = new Map<string, string>();
  relDirOf.set(folder.id, '');
  const order: string[] = [folder.id];
  const queue: string[] = [folder.id];
  while (queue.length) {
    const pid = queue.shift()!;
    const base = relDirOf.get(pid)!;
    for (const child of childFolders(allFolders, pid)) {
      if (relDirOf.has(child.id)) continue; // guard against malformed cycles
      relDirOf.set(child.id, base ? `${base}/${slug(child.name)}` : slug(child.name));
      order.push(child.id);
      queue.push(child.id);
    }
  }
  const byId = new Map(allFolders.map(f => [f.id, f]));
  const planned: { ref: string; relDir: string }[] = [];
  const claimed = new Set<string>();
  for (const id of order) {
    const f = byId.get(id);
    if (!f) continue;
    const relDir = relDirOf.get(id) ?? '';
    for (const it of f.items) {
      if (claimed.has(it.ref)) continue;
      claimed.add(it.ref);
      planned.push({ ref: it.ref, relDir });
    }
  }
  return planned;
}

/**
 * Render `folder` and its whole subtree (nested via `allFolders`) into a single zip.
 * Sessions directly in `folder` sit at the zip root; sessions in a descendant folder D sit
 * under D's slugged path beneath `folder`. Filenames within one dir are deduped with a -NN
 * suffix. Adds a `lolly.txt` manifest. Returns { zipPath, count, bytes, members }.
 */
export async function exportFolder(
  host: HostV1,
  dom: JSDOM,
  folder: Folder,
  allFolders: Folder[],
  opts: ExportFolderOpts = {},
): Promise<ExportFolderResult> {
  // 1-2. Plan the subtree walk (shared with the view's format step).
  const planned = planFolderRefs(folder, allFolders);

  // 3. Resolve sessions.
  const byslot = new Map<string, SavedSession>((await listSessions()).map(s => [s.slot, s]));
  const resolved = planned.filter(p => byslot.has(p.ref));
  const total = resolved.length;
  if (total === 0) throw new Error('Nothing to export - this folder has no saved sessions.');

  // 4. Stage dir - one shared jsdom #canvas means renders MUST stay sequential.
  const stage = await mkdtemp(join(tmpdir(), 'lolly-batch-'));
  const members: BatchMember[] = [];
  const usedByDir = new Map<string, Set<string>>(); // relDir → base names taken (dedup)
  const want = opts.format ?? 'svg';
  const dims = { unit: opts.unit ?? 'px', dpi: opts.dpi ?? 300 };
  let done = 0;

  try {
    // 5. Render each session sequentially into the stage tree.
    for (const { ref, relDir } of planned) {
      const session = byslot.get(ref);
      if (!session) {
        // A planned ref with no session (deleted between plan + resolve). Skipped, still
        // counted against `total`? No - total counts only resolved; report but don't tick.
        continue;
      }
      const label = session.label || session.toolId;
      // Dedup the base name within its directory.
      const set = usedByDir.get(relDir) ?? new Set<string>();
      usedByDir.set(relDir, set);
      let base = slug(session.label) || slug(session.toolId);
      if (set.has(base)) {
        let n = 2;
        while (set.has(`${base}-${String(n).padStart(2, '0')}`)) n++;
        base = `${base}-${String(n).padStart(2, '0')}`;
      }
      set.add(base);
      const relNoExt = relDir ? `${relDir}/${base}` : base;

      const member = await renderSessionTo(host, dom, session, relNoExt, stage, want, dims);
      members.push(member);
      done++;
      opts.onProgress?.(done, total, memberLine(member));
    }

    // 6-8. Pack the staged files into one zip on disk.
    return packMembersToZip(stage, members, {
      zipName: `${slug(folder.name) || 'lolly-folder'}.zip`,
      folderName: folder.name,
      zipPassword: opts.zipPassword, zipTier: opts.zipTier, outDir: opts.outDir,
    });
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

/** Pack the staged member files (+ a lolly.txt manifest) into one zip and write it. The
 *  shared tail of every batch - folder export, a CSV batch, and a saved-session set. */
async function packMembersToZip(
  stage: string,
  members: BatchMember[],
  o: { zipName: string; folderName: string; zipPassword?: string; zipTier?: ZipTier; outDir?: string },
): Promise<ExportFolderResult> {
  // Only zip members whose staged file is actually on disk. A "render everything" must
  // never let a single session that reported success but produced no file (an odd fallback,
  // a browser-tier render that didn't land) crash the whole archive with an ENOENT.
  const okMembers = members.filter(m => m.ok && existsSync(join(stage, m.zipPath)));
  const manifest = manifestText(o.zipName, o.folderName, members);

  let zipBytes: Uint8Array;
  if (o.zipPassword) {
    const entries: ZipEntryInput[] = [];
    const add = (name: string, bytes: Uint8Array): void => {
      const store = STORE_EXT.has(extOf(name));
      entries.push({
        name,
        compressed: store ? bytes : deflateSync(bytes),
        method: store ? 0 : 8,
        crc32: crc32(bytes),
        uncompressedSize: bytes.length,
      });
    };
    for (const m of okMembers) add(m.zipPath, new Uint8Array(await readFile(join(stage, m.zipPath))));
    add('lolly.txt', strToU8(manifest));
    zipBytes = await buildEncryptedZip(entries, { tier: o.zipTier ?? 'standard', password: o.zipPassword });
  } else {
    const entries: Zippable = {};
    for (const m of okMembers) {
      const bytes = new Uint8Array(await readFile(join(stage, m.zipPath)));
      entries[m.zipPath] = [bytes, { level: STORE_EXT.has(extOf(m.zipPath)) ? 0 : 6 }];
    }
    entries['lolly.txt'] = [strToU8(manifest), { level: 6 }];
    zipBytes = zipSync(entries);
  }

  const zipPath = join(o.outDir ?? defaultExportDir(), o.zipName);
  await writeFile(zipPath, zipBytes);
  return { zipPath, count: okMembers.length, bytes: zipBytes.length, members };
}

/**
 * When a render fails for a reason HTML can still satisfy, the batch falls back rather
 * than skipping the row - but must SAY so. Returns the per-row note (surfaced in the
 * progress log and the zip's lolly.txt), or null when the failure is real and the row
 * should skip. Two honest cases: the format needs the browser tier and it isn't
 * installed, or the tool is HTML-layout with no <svg> for a vector format.
 */
function htmlFallbackNote(msg: string): string | null {
  if (/install[ :-]browser|browser engine|Chromium|build:web|web shell/i.test(msg))
    return 'html fallback - run lolly install-browser for png/pdf';
  if (/<svg>|requires an/i.test(msg))
    return 'html fallback - this tool has no vector output';
  return null;
}

/**
 * Render ONE session into `stage/<relNoExt>.<fmt>`, with the same html fallback as
 * ToolView.doExport. Never throws - a failure returns a skipped BatchMember so the batch
 * continues.
 */
async function renderSessionTo(
  host: HostV1,
  dom: JSDOM,
  session: SavedSession,
  relNoExt: string,
  stage: string,
  want: string,
  dims: { unit: string; dpi: number },
): Promise<BatchMember> {
  const label = session.label || session.toolId;
  try {
    const { runtime, manifest } = await mountTool(session.toolId, host, session.query, session.data);
    const avail = exportableFormats(manifest);
    const fmt = avail.includes(want) ? want : (avail[0] ?? 'html');
    // A batch-wide format won't exist on every tool - substitute, but say so per-row.
    const substituted = fmt !== want ? `${want} not offered by this tool - rendered ${fmt}` : undefined;
    const zipPath = `${relNoExt}.${fmt}`;
    try {
      const bytes = await exportToFile(runtime, dom, manifest, fmt, join(stage, zipPath), dims);
      if (!existsSync(join(stage, zipPath))) throw new Error('render produced no file');
      return { slot: session.slot, label, zipPath, format: fmt, bytes, ok: true, note: substituted };
    } catch (e) {
      // For a BULK export, fall back to HTML (always renderable) so every member still
      // produces a file rather than failing - but carry the honest reason per-row;
      // interactive doExport surfaces the actionable "run install:browser" message instead.
      const note = fmt !== 'html' ? htmlFallbackNote((e as Error).message) : null;
      if (note) {
        const htmlPath = `${relNoExt}.html`;
        const bytes = await exportToFile(runtime, dom, manifest, 'html', join(stage, htmlPath), dims);
        return { slot: session.slot, label, zipPath: htmlPath, format: 'html', bytes, ok: true, note };
      }
      throw e;
    }
  } catch (e) {
    return { slot: session.slot, label, zipPath: `${relNoExt}.${want}`, format: want, bytes: 0, ok: false, reason: (e as Error).message };
  }
}

export interface BatchRunOpts {
  onProgress?: (done: number, total: number, label: string) => void;
  zipPassword?: string;
  zipTier?: ZipTier;
  outDir?: string;
  name?: string;          // zip base name (default 'batch' / 'selection')
  /** Preferred format: the session-set path's format, and the default for CSV rows
   *  without their own `format` column. Default 'svg'. */
  format?: string;
  unit?: string;
  dpi?: number;
}

/**
 * CSV/data batch - render an array of BatchRow (engine parseBatchCsv output) to one zip.
 * The "TUI way" of a data-driven batch: each row is a tool + params + optional per-row
 * format/size, rendered through the SAME engine path as a single export and packed like a
 * folder export. Zip-to-Desktop is the TUI idiom (the CLI writes a directory instead).
 */
export async function exportBatchRows(
  host: HostV1, dom: JSDOM, rows: BatchRow[], opts: BatchRunOpts = {},
): Promise<ExportFolderResult> {
  if (!rows.length) throw new Error('No rows to render.');
  const stage = await mkdtemp(join(tmpdir(), 'lolly-batch-'));
  const members: BatchMember[] = [];
  const pad = Math.max(2, String(rows.length).length);
  try {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const base = row.filename ? slug(row.filename.replace(/\.[^.]+$/, '')) : slug(row.toolId);
      const relNoExt = `${String(i + 1).padStart(pad, '0')}-${base || 'row'}`;
      const member = await renderRowTo(host, dom, row, relNoExt, stage, opts.format);
      members.push(member);
      opts.onProgress?.(i + 1, rows.length, memberLine(member));
    }
    return packMembersToZip(stage, members, {
      zipName: `${slug(opts.name ?? 'batch') || 'batch'}.zip`,
      folderName: opts.name ?? 'CSV batch',
      zipPassword: opts.zipPassword, zipTier: opts.zipTier, outDir: opts.outDir,
    });
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

/** Render one CSV batch row (its params become the mount query; per-row format/size
 *  honoured; `fallbackFormat` covers rows without their own format column). */
async function renderRowTo(
  host: HostV1, dom: JSDOM, row: BatchRow, relNoExt: string, stage: string, fallbackFormat?: string,
): Promise<BatchMember> {
  const query = new URLSearchParams(row.params).toString();
  const want = row.format ?? fallbackFormat ?? 'svg';
  const dims = { width: row.width, height: row.height, unit: row.unit ?? 'px', dpi: row.dpi ?? 300 };
  try {
    const { runtime, manifest } = await mountTool(row.toolId, host, query);
    const avail = exportableFormats(manifest);
    const fmt = avail.includes(want) ? want : (avail[0] ?? 'html');
    const substituted = fmt !== want ? `${want} not offered by this tool - rendered ${fmt}` : undefined;
    const zipPath = `${relNoExt}.${fmt}`;
    try {
      const bytes = await exportToFile(runtime, dom, manifest, fmt, join(stage, zipPath), dims);
      return { slot: relNoExt, label: row.toolId, zipPath, format: fmt, bytes, ok: true, note: substituted };
    } catch (e) {
      const note = fmt !== 'html' ? htmlFallbackNote((e as Error).message) : null;
      if (note) {
        const htmlPath = `${relNoExt}.html`;
        const bytes = await exportToFile(runtime, dom, manifest, 'html', join(stage, htmlPath), dims);
        return { slot: relNoExt, label: row.toolId, zipPath: htmlPath, format: 'html', bytes, ok: true, note };
      }
      throw e;
    }
  } catch (e) {
    return { slot: relNoExt, label: row.toolId, zipPath: `${relNoExt}.${want}`, format: want, bytes: 0, ok: false, reason: (e as Error).message };
  }
}

/**
 * Saved-session multiselect - render an ad-hoc set of ticked sessions (across folders)
 * to one zip. Same packaging as a folder export; the difference is the source is a
 * hand-picked list rather than a folder subtree.
 */
export async function exportSessions(
  host: HostV1, dom: JSDOM, sessions: SavedSession[], opts: BatchRunOpts = {},
): Promise<ExportFolderResult> {
  if (!sessions.length) throw new Error('Nothing selected to export.');
  const stage = await mkdtemp(join(tmpdir(), 'lolly-batch-'));
  const members: BatchMember[] = [];
  const used = new Set<string>();
  const dims = { unit: opts.unit ?? 'px', dpi: opts.dpi ?? 300 };
  try {
    let done = 0;
    for (const session of sessions) {
      let base = slug(session.label) || slug(session.toolId);
      if (used.has(base)) {
        let n = 2;
        while (used.has(`${base}-${String(n).padStart(2, '0')}`)) n++;
        base = `${base}-${String(n).padStart(2, '0')}`;
      }
      used.add(base);
      const member = await renderSessionTo(host, dom, session, base, stage, opts.format ?? 'svg', dims);
      members.push(member);
      done++;
      opts.onProgress?.(done, sessions.length, memberLine(member));
    }
    return packMembersToZip(stage, members, {
      zipName: `${slug(opts.name ?? 'selection') || 'selection'}.zip`,
      folderName: opts.name ?? 'Selected sessions',
      zipPassword: opts.zipPassword, zipTier: opts.zipTier, outDir: opts.outDir,
    });
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
