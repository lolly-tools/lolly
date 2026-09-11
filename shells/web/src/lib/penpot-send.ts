// SPDX-License-Identifier: MPL-2.0
/**
 * Penpot send target (plans/178) - the `penpot` driver: ONE send makes ONE new
 * Penpot file, imported as a binfile-v3 archive into a project the user picks
 * at send time, with its board on the canvas and the brand's tokens, colours
 * and typographies inside.
 *
 * It replaces the media-library upload of plans/173, which Penpot 2.x made a
 * no-op: components-v2 removed the library section an `is-local=false` media
 * row appeared in, so the render was an orphan the media trimmer collected.
 * A `.penpot` export is sent as-is; an image render is wrapped by the engine's
 * writer into a one-board file, so every format the panel offers arrives
 * somewhere a person can actually see it.
 *
 * Custody follows the Mastodon shape exactly: the Personal Access Token is the
 * connection (Penpot PATs are long-lived, no refresh grant), so session-only
 * custody keeps it in the memory token cache and the record tokenless at rest;
 * "stay connected on this device" writes it into the config. Never in backups,
 * wiped by Disconnect - and there is no revoke RPC we can call, so Disconnect
 * is the local wipe plus the user deleting the PAT in Penpot settings.
 *
 * Transport honesty: every call goes through lolly.tools's app-origin
 * pass-through (/api/penpot/rpc) because Penpot's API refuses cross-origin
 * browser calls - the proxy forwards the token and bytes, stores nothing.
 * The account label is the instance host, not a username: Penpot's
 * get-profile sits behind a bot challenge, so we never call it.
 */

import {
  buildPenpotEntries, imageDimensions, imageToPenpotDoc, penpotUuid, penpotWorkspaceUrl,
  PENPOT_IMAGE_MTYPES, PENPOT_MIME,
} from '../../../../engine/src/penpot-file.ts';
import { t } from '../i18n.ts';
import { escape } from '../utils.ts';
import { makePenpotClient, type PenpotProject } from './penpot-api.ts';
import { brandForPenpot, type PenpotBrand } from './penpot-brand.ts';
import {
  cacheToken, cachedToken, getConnection, hasConnection, removeConnection, saveConnection,
} from './provider-connections.ts';
import type { SendTarget } from './send-target.ts';

const KIND = 'penpot';
/** The instance the proxy fronts - shown on the /profile row for honesty. */
export const PENPOT_HOST = 'design.penpot.app';
/** Fallback name when a send arrives with no filename at all. */
const FALLBACK_FILE_NAME = 'From Lolly';
/** What each offered format is, when the blob carries no usable type. */
const FORMAT_MTYPE: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
};

/** What {@link penpotSendTarget}'s `prepare` resolves and its `send` reads back. */
export interface PenpotChoice {
  projectId: string;
  projectName: string;
  /** The project's team, when the listing carried it - the workspace link needs it. */
  teamId?: string;
  /** The name the new Penpot file gets. */
  name: string;
}

/** The connect probe: list projects with the pasted PAT. Doubles as the
 *  default-project source on the /profile card - a PAT that cannot list
 *  projects cannot import into one either. */
export async function testPenpot(token: string, fetchImpl?: typeof fetch): Promise<{ ok: boolean; note: string; projects?: PenpotProject[] }> {
  try {
    const projects = await makePenpotClient({ token, fetchImpl }).listProjects();
    if (projects.length === 0) return { ok: false, note: t('That token works but sees no projects - create one in Penpot first') };
    return { ok: true, note: t('Found {n} projects - pick a destination', { n: projects.length }), projects };
  } catch (e) {
    return { ok: false, note: String((e as Error).message) };
  }
}

/** Connect the PAT. The project is OPTIONAL now: it is only the default the
 *  send-time picker starts on, so a token alone is a complete connection. */
export async function connectPenpot(persist: boolean, token: string, project?: PenpotProject): Promise<void> {
  // The PAT is the connection: memory cache always, at rest only by choice.
  cacheToken(KIND, token, Date.now() + 365 * 24 * 3600 * 1000);
  await saveConnection({
    kind: KIND,
    account: project ? `${PENPOT_HOST} · ${project.name}` : PENPOT_HOST,
    persist,
    config: {
      ...(project ? { projectId: project.id, projectName: project.name } : {}),
      ...(persist ? { token } : {}),
    },
    connectedAt: new Date().toISOString(),
  });
}

export async function disconnectPenpot(): Promise<void> {
  // No revoke RPC exists for PATs - the local wipe is the whole gesture; the
  // token itself is revoked in Penpot's own settings.
  await removeConnection(KIND);
}

async function penpotAuth(): Promise<{ token: string; projectId?: string; projectName?: string }> {
  const conn = await getConnection(KIND);
  if (!conn) throw new Error(t('Connect Penpot in Profile first'));
  const token = cachedToken(KIND) ?? conn.config?.token;
  if (!token) throw new Error(t('Your Penpot session ended - connect again in Profile'));
  return { token, projectId: conn.config?.projectId, projectName: conn.config?.projectName };
}

/** Remember the last project the user picked, under the connection's existing
 *  custody choice - a session-only record keeps it in memory, a persisted one
 *  at rest. It is only a default for the next picker, never a lock. */
async function rememberProject(projectId: string, projectName: string): Promise<void> {
  const conn = await getConnection(KIND);
  if (!conn) return;
  // The label names the project too, so a later pick must move it or the /profile
  // row keeps naming the project the user has stopped sending to.
  await saveConnection({ ...conn, account: `${PENPOT_HOST} · ${projectName}`, config: { ...conn.config, projectId, projectName } });
}

/**
 * A `.penpot` payload was written with the export panel's filename baked into its
 * manifest and file record, and for a version-3 import that internal name is what
 * Penpot shows. Rewrite both to the name the picker chose, and leave every other
 * entry byte-identical.
 */
export async function renamePenpotArchive(bytes: Uint8Array, name: string): Promise<Uint8Array> {
  const { unzipAsync, zipAsync } = await import('./zip.ts');
  const entries = await unzipAsync(bytes, { maxEntryBytes: 64 * 1024 * 1024, maxTotalBytes: 256 * 1024 * 1024 });
  const dec = new TextDecoder(), enc = new TextEncoder();
  const rewrite = (path: string, fn: (o: Record<string, unknown>) => void): void => {
    const raw = entries[path];
    if (!raw) return;
    try {
      const o = JSON.parse(dec.decode(raw)) as Record<string, unknown>;
      fn(o);
      entries[path] = enc.encode(JSON.stringify(o));
    } catch { /* not ours to fix - the entry stays as it came */ }
  };
  rewrite('manifest.json', (m) => {
    const files = Array.isArray(m.files) ? m.files : [];
    for (const f of files) if (f && typeof f === 'object') (f as Record<string, unknown>).name = name;
  });
  for (const path of Object.keys(entries)) {
    if (/^files\/[^/]+\.json$/.test(path)) rewrite(path, (f) => { f.name = name; });
  }
  return await zipAsync(entries);
}

/** A 401 anywhere in the flow means the same thing to the user. */
function penpotError(e: unknown): Error {
  const msg = String((e as Error)?.message ?? e);
  return /\(401\)/.test(msg) ? new Error(t('Penpot rejected the token - connect again in Profile')) : new Error(msg);
}

/** The media type the archive should carry for these bytes, or null when Penpot
 *  stores nothing of the kind. The blob's own type wins; the format id is the
 *  fallback for a blob that arrived typeless. */
function penpotMtype(mime: string, format: string): string | null {
  const declared = String(mime || '').split(';')[0]!.trim().toLowerCase();
  const fixed = declared === 'image/jpg' ? 'image/jpeg' : declared;
  if (PENPOT_IMAGE_MTYPES.includes(fixed)) return fixed;
  const guess = FORMAT_MTYPE[String(format || '').toLowerCase()] ?? '';
  return PENPOT_IMAGE_MTYPES.includes(guess) ? guess : null;
}

/** One image render → the binfile-v3 archive Penpot imports: a board the size
 *  of the picture, the picture as its fill, the brand alongside. */
async function penpotArchiveForImage(
  bytes: Uint8Array, name: string, format: string, mime: string, brand: PenpotBrand,
): Promise<Blob> {
  const mtype = penpotMtype(mime, format);
  if (!mtype) {
    throw new Error(t('Penpot cannot take a {format} file - send a PNG, an SVG or a .penpot export', { format: format || mime }));
  }
  const dims = imageDimensions(bytes, mtype);
  if (!dims) console.warn(`[penpot] no size in the ${mtype} header - falling back to 1024x1024`);
  const { w, h } = dims ?? { w: 1024, h: 1024 };
  const doc = imageToPenpotDoc(
    { id: penpotUuid(), name, mtype, width: w, height: h, bytes },
    {
      name,
      tokens: brand.tokens,
      palette: brand.palette,
      typographies: brand.typographies,
      googleFamilies: brand.googleFamilies,
    },
  );
  const { entries } = buildPenpotEntries(doc);
  // Dynamic import keeps fflate out of this chunk, exactly as export-pptx does.
  const { zipAsync } = await import('./zip.ts');
  const enc = new TextEncoder();
  const files: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(entries)) {
    files[path] = typeof content === 'string' ? enc.encode(content) : content;
  }
  return new Blob([(await zipAsync(files)) as BlobPart], { type: PENPOT_MIME });
}

/** The send-time destination picker: which project, and what the new file is
 *  called. Resolves null when the user cancels. DOM-only, so the modal is
 *  imported lazily and the rest of this module stays headless. */
async function pickPenpotDestination(
  projects: PenpotProject[], defaultProjectId: string | undefined, defaultName: string,
): Promise<PenpotChoice | null> {
  const { mountModal } = await import('../components/modal.ts');
  const selectedId = projects.find((p) => p.id === defaultProjectId)?.id ?? projects[0]!.id;
  // Grouped by team, in listing order - a person with several teams sees which
  // "Drafts" is which.
  const teams = new Map<string, PenpotProject[]>();
  for (const p of projects) {
    const key = p.teamName ?? '';
    const rows = teams.get(key);
    if (rows) rows.push(p); else teams.set(key, [p]);
  }
  const optionHtml = (p: PenpotProject): string =>
    `<option value="${escape(p.id)}"${p.id === selectedId ? ' selected' : ''}>${escape(p.name)}</option>`;
  const optionsHtml = [...teams].map(([team, rows]) => (team
    ? `<optgroup label="${escape(team)}">${rows.map(optionHtml).join('')}</optgroup>`
    : rows.map(optionHtml).join(''))).join('');

  const content = `
    <h2 class="modal-title">${t('Send to Penpot')}</h2>
    <p class="modal-msg">${t('This becomes a new Penpot file with your brand tokens inside.')}</p>
    <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:18px;text-align:left">
      <label class="field-row">
        <span class="field-label">${t('Project')}</span>
        <select class="field-select penpot-pick-project">${optionsHtml}</select>
      </label>
      <label class="field-row">
        <span class="field-label">${t('File name')}</span>
        <input type="text" class="field-input penpot-pick-name" spellcheck="false" value="${escape(defaultName)}">
      </label>
    </div>
    <div class="modal-actions">
      <button type="button" class="btn" data-act="cancel">${t('Cancel')}</button>
      <button type="button" class="btn modal-primary" data-act="send">${t('Send')}</button>
    </div>`;

  return new Promise<PenpotChoice | null>((resolve) => {
    const modal = mountModal<PenpotChoice | null>(content, {
      className: 'modal',
      cancelValue: null,
      initialFocus: (el) => el.querySelector<HTMLElement>('.penpot-pick-project'),
      onClose: (result) => resolve(result ?? null),
    });
    const projectEl = modal.el.querySelector<HTMLSelectElement>('.penpot-pick-project')!;
    const nameEl = modal.el.querySelector<HTMLInputElement>('.penpot-pick-name')!;
    const confirm = (): void => {
      const project = projects.find((p) => p.id === projectEl.value);
      if (!project) { modal.close(null); return; }
      modal.close({
        projectId: project.id,
        projectName: project.name,
        ...(project.teamId ? { teamId: project.teamId } : {}),
        name: nameEl.value.trim() || defaultName || FALLBACK_FILE_NAME,
      });
    };
    modal.el.addEventListener('click', (e) => {
      const act = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-act]')?.dataset.act : undefined;
      if (act === 'send') confirm();
      else if (act === 'cancel') modal.close(null);
    });
    nameEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); confirm(); } });
  });
}

/** What `prepare` chose, read back defensively - a surface may send without it. */
function readChoice(choice: Record<string, unknown> | undefined): Partial<PenpotChoice> {
  const c = choice ?? {};
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
  return {
    projectId: str(c.projectId),
    projectName: str(c.projectName),
    teamId: str(c.teamId),
    name: str(c.name),
  };
}

export function penpotSendTarget(): SendTarget {
  return {
    kind: KIND,
    label: t('Penpot'),
    // A .penpot export imports as-is; every image format is wrapped into a
    // one-board file, so each of these arrives ON the canvas.
    formats: ['penpot', 'svg', 'png', 'jpg', 'jpeg', 'webp', 'gif'],
    available: () => hasConnection(KIND),
    hint: t('Creates a new Penpot file, in the project you pick when you send, with your brand tokens inside. It travels through lolly.tools’s pass-through because Penpot’s API refuses direct browser calls - your token is forwarded, never stored server-side.'),
    prepare: async (payload) => {
      const { token, projectId } = await penpotAuth();
      let projects: PenpotProject[];
      try {
        projects = await makePenpotClient({ token }).listProjects();
      } catch (e) {
        throw penpotError(e);
      }
      if (!projects.length) throw new Error(t('That token works but sees no projects - create one in Penpot first'));
      const chosen = await pickPenpotDestination(projects, projectId, payload.name);
      if (!chosen) return null;
      // The pick becomes the next send's default. Never fatal.
      await rememberProject(chosen.projectId, chosen.projectName).catch(() => {});
      return { ...chosen };
    },
    send: async ({ bytes, name, format, mime, choice }) => {
      const auth = await penpotAuth();
      const picked = readChoice(choice);
      const projectId = picked.projectId ?? auth.projectId;
      if (!projectId) throw new Error(t('Pick a Penpot project to send to'));
      const projectName = picked.projectName ?? auth.projectName ?? '';
      const fileName = picked.name ?? name ?? FALLBACK_FILE_NAME;
      // The brand rides along in every archive: tokens, palette, typographies.
      const brand = await brandForPenpot();
      // The picked name goes INSIDE the archive too (manifest + file record), which is
      // what a version-3 import shows; the multipart `name` alone does not rename it.
      const blob = format === 'penpot'
        // A .penpot export IS the archive - send the bytes untouched.
        ? new Blob([(await renamePenpotArchive(bytes, fileName)) as BlobPart], { type: PENPOT_MIME })
        : await penpotArchiveForImage(bytes, fileName, format, mime, brand);
      let fileIds: string[];
      try {
        ({ fileIds } = await makePenpotClient({ token: auth.token }).importFile(fileName, projectId, blob));
      } catch (e) {
        throw penpotError(e);
      }
      const fileId = fileIds[0];
      return {
        // Only the workspace URL we can actually build: it needs the team id,
        // which the projects listing carries and a stale default may not.
        ...(picked.teamId && fileId ? { url: penpotWorkspaceUrl(picked.teamId, fileId) } : {}),
        label: projectName
          ? t('Created “{name}” in {project} on Penpot', { name: fileName, project: projectName })
          : t('Created “{name}” on Penpot', { name: fileName }),
      };
    },
  };
}
