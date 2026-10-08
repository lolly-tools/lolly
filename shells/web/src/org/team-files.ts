// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-files - files shared inside a team project: the shell's half of the
 * instance's /api/v1/projects/:id/files routes.
 *
 * Saving a document to a team project first carries its device uploads into the
 * project (shareTeamFiles), so the saved session refers to immutable project ids;
 * opening one puts those files into this device's asset store before the tool is
 * built (restoreTeamFiles). The Files panel (org/team-files-panel.ts) lists,
 * uploads, downloads and deletes them, and teamFileMessage gives every refusal its
 * own sentence.
 *
 * Uploads follow the instance's own limits (the list answer carries them) and go
 * in its fixed-size parts, each part retried a few times. A failed or cancelled
 * upload deletes its unfinished file, so nothing half-sent holds the project's
 * storage until it expires.
 *
 * Content Credentials never travel as a declaration, the rule beam-pack keeps: an
 * upload sends no credential, and a restore lets this device's asset store read the
 * credential out of the received bytes, so no member can attach a manifest the file
 * does not carry. A sidecar credential that no longer binds to the stored bytes
 * stays on the device that recorded the upload.
 */
import { decodeAssetVersion } from '../../../../engine/src/asset-version.ts';
import {
  collectSessionAssetRefs, defaultSanitizeSvg, rewriteSessionAssetRefs, safeMeta, sniffBeamAsset, type BeamAssetRecord,
} from '../lib/beam-pack.ts';
import { rebaseImportedAssetPins } from '../lib/session-asset-versions.ts';
import { getHostRef } from '../lib/host-ref.ts';
import { instanceFetch, instancePath } from '../lib/instance.ts';
import { hasMethods, isRecord } from '../lib/util/guards.ts';
import { fmtBytes } from '../lib/format.ts';
import { tRaw } from '../i18n.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { TeamSessionData } from '../lib/session-source.ts';

/** The largest file any instance stores. A listed file claiming more is not read. */
const CEILING_BYTES = 256 * 1024 * 1024;
/** The instance's limit on a file's name, in UTF-16 units. */
const NAME_UNITS = 200;
const JSON_HEADERS = { 'content-type': 'application/json' };

/** Waits before each retry of one part's upload: three retries, further apart each
 *  time. Exported so tests can shorten them. */
export const PART_RETRY_DELAYS_MS = [500, 1500, 4000];

export interface TeamFile {
  id: string; projectId: string; name: string; size: number; checksum: string;
  contentType: string; ready: boolean; asset: Record<string, unknown>;
  createdAt?: string; createdBy?: string; createdByName?: string;
}

/** The instance's file limits, in bytes, as the list answer reports them. */
export interface TeamFileLimits {
  partBytes: number; maxBytes: number; projectBudgetBytes: number; projectUsedBytes: number; instanceRemainingBytes: number;
}

export interface TeamFileList { files: TeamFile[]; limits: TeamFileLimits }

/** A session that still uses a file someone asked to delete. */
export interface TeamFileUse { id: string; title: string }

/** Optional controls for one upload: cancel it, and hear how far it got. */
export interface TeamFileTransfer {
  signal?: AbortSignal;
  onProgress?(sent: number, total: number): void;
}

/** An instance that sends no limits: its own refusal decides. */
const OPEN_LIMITS: TeamFileLimits = {
  partBytes: 1024 * 1024, maxBytes: CEILING_BYTES, projectBudgetBytes: Number.MAX_SAFE_INTEGER,
  projectUsedBytes: 0, instanceRemainingBytes: Number.MAX_SAFE_INTEGER,
};

/**
 * A transfer that failed. `status` is the HTTP status (0: no answer), `code` the
 * instance's error code when it sent one, or this module's own (`CANCELLED`, and
 * `MISSING` for bytes this device no longer holds). `limit` is the per-file limit a
 * too-large file broke; `sessions` are the sessions that still use a file.
 */
export class TeamFileError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly limit: number | undefined;
  readonly sessions: TeamFileUse[];
  constructor(status: number, code?: string, detail: { limit?: number; sessions?: TeamFileUse[] } = {}) {
    super(`Shared project files could not be transferred (${code ?? status}).`);
    this.status = status;
    this.code = code;
    this.limit = detail.limit;
    this.sessions = detail.sessions ?? [];
  }
}

interface AssetReader { _getUserRecord(id: string, version?: string): Promise<BeamAssetRecord | null> }
interface AssetStore extends AssetReader { _uploadUserAsset(record: BeamAssetRecord): Promise<unknown> }
const isReader = (assets: unknown): assets is AssetReader => hasMethods(assets, ['_getUserRecord']);
const isStore = (assets: unknown): assets is AssetStore => hasMethods(assets, ['_getUserRecord', '_uploadUserAsset']);

/** The signed-in person's id on the instance, once an upload has told us. The
 *  Files panel uses this id to offer Delete on their own files. */
let uploaderId: string | null = null;
export function knownUploaderId(): string | null { return uploaderId; }

const filePath = (projectId: string, tail = ''): string => `/api/v1/projects/${encodeURIComponent(projectId)}/files${tail}`;
const assetId = (file: TeamFile): string => `user/team/${file.id}`;
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
const cancelled = (): TeamFileError => new TeamFileError(0, 'CANCELLED');

async function checksum(bytes: Uint8Array): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource)), n => n.toString(16).padStart(2, '0')).join('');
}

/** A refused response as an error: its status, the instance's code (`{ error: { code } }`,
 *  or a bare `{ code }`), the per-file limit it names (else the listed one) and, for
 *  FILE_IN_USE, the sessions it lists. */
async function failure(res: Response, limits?: TeamFileLimits): Promise<TeamFileError> {
  let body: unknown = null;
  try { body = await res.json(); } catch { /* no readable body: the status decides */ }
  const raw = isRecord(body) ? (isRecord(body.error) ? body.error : body) : {};
  const sessions = Array.isArray(raw.sessions)
    ? raw.sessions.filter(isRecord).flatMap((s) => {
      const id = str(s.id);
      return id ? [{ id, title: str(typeof s.title === 'string' ? s.title.trim() : undefined) ?? id }] : [];
    })
    : [];
  const named = typeof raw.maxBytes === 'number' && Number.isSafeInteger(raw.maxBytes) && raw.maxBytes > 0 ? raw.maxBytes : undefined;
  const limit = named ?? limits?.maxBytes;
  return new TeamFileError(res.status, str(raw.code), { sessions, ...(limit ? { limit } : {}) });
}

async function request(path: string, init: RequestInit = {}, limits?: TeamFileLimits): Promise<Response> {
  let res: Response;
  try { res = await instanceFetch(instancePath(path), init); } catch { throw init.signal?.aborted ? cancelled() : new TeamFileError(0); }
  if (!res.ok) throw await failure(res, limits);
  return res;
}

async function readBody(res: Response): Promise<Record<string, unknown>> {
  let body: unknown = null;
  try { body = await res.json(); } catch { /* below */ }
  if (!isRecord(body)) throw new TeamFileError(422);
  return body;
}

function readFile(value: unknown, projectId: string): TeamFile {
  if (!isRecord(value)) throw new TeamFileError(422);
  const { id, checksum: hash, size, name, contentType, asset } = value;
  if (value.projectId !== projectId || typeof id !== 'string' || !/^fil_[a-zA-Z0-9_-]{22}$/.test(id)
    || typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)
    || typeof size !== 'number' || !Number.isSafeInteger(size) || size < 1 || size > CEILING_BYTES
    || typeof name !== 'string' || typeof contentType !== 'string' || !isRecord(asset)) throw new TeamFileError(422);
  const createdAt = str(value.createdAt), createdBy = str(value.createdBy);
  const createdByName = str(typeof value.createdByName === 'string' ? value.createdByName.trim() : undefined);
  return {
    id, projectId, name, size, checksum: hash, contentType, ready: value.ready === true, asset,
    ...(createdAt ? { createdAt } : {}), ...(createdBy ? { createdBy } : {}), ...(createdByName ? { createdByName } : {}),
  };
}

function readLimits(value: unknown): TeamFileLimits {
  const v = isRecord(value) ? value : {};
  const n = (key: keyof TeamFileLimits, min: number): number => {
    const x = v[key];
    return typeof x === 'number' && Number.isSafeInteger(x) && x >= min ? x : OPEN_LIMITS[key];
  };
  return {
    partBytes: n('partBytes', 1), maxBytes: n('maxBytes', 1), projectBudgetBytes: n('projectBudgetBytes', 0),
    projectUsedBytes: n('projectUsedBytes', 0), instanceRemainingBytes: n('instanceRemainingBytes', 0),
  };
}

/** The project's finished files, newest first as the instance sends them, and its limits. */
export async function listTeamFiles(projectId: string): Promise<TeamFileList> {
  const body = await readBody(await request(filePath(projectId)));
  if (!Array.isArray(body.files)) throw new TeamFileError(422);
  return { files: body.files.map(f => readFile(f, projectId)).filter(f => f.ready), limits: readLimits(body.limits) };
}

/** The instance's own refusal for a file that cannot fit, before any byte is sent. */
function checkRoom(limits: TeamFileLimits, size: number): void {
  if (size > limits.maxBytes) throw new TeamFileError(413, 'PROJECT_FILE_TOO_LARGE', { limit: limits.maxBytes });
  if (size > limits.projectBudgetBytes - limits.projectUsedBytes) throw new TeamFileError(413, 'PROJECT_FILE_BUDGET');
  if (size > limits.instanceRemainingBytes) throw new TeamFileError(413, 'INSTANCE_FILE_BUDGET');
}

/** Refuses a file over the per-file limit before its bytes are read into memory,
 *  unless the project holds a file of that size: it may be these bytes, which need
 *  no room (putFile finds them), even after the limit was lowered. */
function checkSize(list: TeamFileList, size: number): void {
  if (size > list.limits.maxBytes && !list.files.some(f => f.size === size)) throw new TeamFileError(413, 'PROJECT_FILE_TOO_LARGE', { limit: list.limits.maxBytes });
}

const dim =(n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
function dims(v: { width?: unknown; height?: unknown }): { width?: number; height?: number } {
  return { ...(dim(v.width) ? { width: v.width } : {}), ...(dim(v.height) ? { height: v.height } : {}) };
}

/** A name the instance stores: no control characters or unpaired surrogates, cut
 *  between characters. A cut through an emoji would leave half of it, which
 *  Postgres refuses inside JSON. */
function cleanName(raw: string): string {
  const unpaired = (c: string): boolean => c.length === 1 && c >= '\ud800' && c <= '\udfff';
  const kept = Array.from(raw, c => (c < ' ' || c === '\u007f' || unpaired(c) ? '' : c)).join('').trim();
  let name = '';
  for (const c of kept) {
    if (name.length + c.length > NAME_UNITS) break;
    name += c;
  }
  return name.trim() || 'Upload';
}

/** What the instance keeps beside a file's bytes: its name, kind and size in pixels.
 *  Nothing else from this device's own record travels, its credential included. */
function describe(record: Omit<BeamAssetRecord, 'id'>, fallback: string): { name: string; asset: Record<string, unknown> } {
  const name = cleanName(String(record.meta?.name || record.meta?.originalName || fallback));
  return { name, asset: { type: record.type, format: record.format, ...dims(record), meta: { name } } };
}

function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(cancelled()); return; }
    const stop = (): void => { clearTimeout(timer); reject(cancelled()); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', stop); resolve(); }, ms);
    signal?.addEventListener('abort', stop, { once: true });
  });
}

/** One part, retried while the failure could pass (no answer, or the instance busy). */
async function putPart(path: string, body: Blob, signal?: AbortSignal): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await request(path, { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body, ...(signal ? { signal } : {}) });
      return;
    } catch (error) {
      const passing = error instanceof TeamFileError && error.code !== 'CANCELLED' && (error.status === 0 || error.status === 429 || error.status >= 500);
      const wait = PART_RETRY_DELAYS_MS[attempt];
      if (!passing || wait === undefined) throw error;
      await pause(wait, signal);
    }
  }
}

/** The project's file for these bytes: the one it already holds, or a new upload.
 *  After the upload began, any failure or cancel deletes the unfinished file. */
async function putFile(projectId: string, list: TeamFileList, blob: Blob, bytes: Uint8Array, about: { name: string; asset: Record<string, unknown> }, transfer: TeamFileTransfer): Promise<TeamFile> {
  const hash = await checksum(bytes);
  const same = list.files.find(f => f.checksum === hash && f.size === bytes.length);
  if (same) return same;
  const { limits } = list;
  checkRoom(limits, bytes.length);
  const parts: { size: number; checksum: string }[] = [];
  for (let off = 0; off < bytes.length; off += limits.partBytes) {
    const part = bytes.subarray(off, off + limits.partBytes);
    parts.push({ size: part.length, checksum: await checksum(part) });
  }
  const body = JSON.stringify({ name: about.name, size: bytes.length, checksum: hash, contentType: blob.type.split(';')[0] || 'application/octet-stream', parts, asset: about.asset });
  if (transfer.signal?.aborted) throw cancelled();
  // The begin is never aborted mid-flight: an answer that arrived unread would leave
  // a reservation with no known id. A cancel takes effect at the first part instead.
  const begun = readFile((await readBody(await request(filePath(projectId), { method: 'POST', headers: JSON_HEADERS, body }, limits))).file, projectId);
  if (begun.createdBy) uploaderId = begun.createdBy;
  const at = filePath(projectId, `/${encodeURIComponent(begun.id)}`);
  try {
    let sent = 0;
    transfer.onProgress?.(0, bytes.length);
    for (let n = 0; n < parts.length; n++) {
      if (transfer.signal?.aborted) throw cancelled();
      await putPart(`${at}/parts/${n}`, blob.slice(sent, sent + parts[n]!.size), transfer.signal);
      sent += parts[n]!.size;
      transfer.onProgress?.(sent, bytes.length);
    }
    if (transfer.signal?.aborted) throw cancelled();
    const done = readFile((await readBody(await request(`${at}/finalize`, { method: 'POST', headers: JSON_HEADERS, body: '{}' }))).file, projectId);
    if (!done.ready || done.checksum !== hash || done.size !== bytes.length) throw new TeamFileError(422);
    list.files.unshift(done);
    limits.projectUsedBytes += done.size;
    limits.instanceRemainingBytes -= done.size;
    return done;
  } catch (error) {
    await deleteTeamFile(projectId, begun.id).catch(() => {});
    throw error;
  }
}

/** Every saved dependency receives an immutable project id. Two pinned versions
 * of one device upload remain distinct, and absent bytes stop the save. */
export async function shareTeamFiles(projectId: string, inputs: Record<string, unknown>, host = getHostRef(), transfer: TeamFileTransfer = {}): Promise<Record<string, unknown>> {
  const refs = collectSessionAssetRefs(inputs).user;
  if (!refs.length) return inputs;
  const assets: unknown = host?.assets;
  if (!isReader(assets)) throw new TeamFileError(422, 'MISSING');
  return shareFileInputs(projectId, inputs, (id, version) => assets._getUserRecord(id, version), transfer);
}

async function shareFileInputs(projectId: string, inputs: Record<string, unknown>, read: (id: string, version?: string) => Promise<BeamAssetRecord | null>, transfer: TeamFileTransfer): Promise<Record<string, unknown>> {
  const refs = collectSessionAssetRefs(inputs).user;
  const list = await listTeamFiles(projectId);
  const rekey = new Map<string, string>();
  const records: BeamAssetRecord[] = [];
  for (const key of refs) {
    const dep = decodeAssetVersion(key);
    const record = await read(dep.id, dep.pin?.version);
    if (!record?.blob?.size || (dep.pin && dep.pin.version !== record.version) || (dep.pin?.format && dep.pin.format !== record.format)) throw new TeamFileError(422, 'MISSING');
    checkSize(list, record.blob.size);
    const bytes = new Uint8Array(await record.blob.arrayBuffer());
    const file = await putFile(projectId, list, record.blob, bytes, describe(record, dep.id.split('/').at(-1) || 'Upload'), transfer);
    rekey.set(key, assetId(file));
    records.push({ ...record, id: assetId(file), version: file.checksum });
  }
  const mapped = rewriteSessionAssetRefs(inputs, rekey);
  if (mapped.unresolved.length) throw new TeamFileError(422);
  const result = rebaseImportedAssetPins(mapped.data, rekey, records);
  if (collectSessionAssetRefs(result).user.some(key => !decodeAssetVersion(key).id.startsWith('user/team/'))) throw new TeamFileError(422);
  return result;
}

/** Hydrate dependencies before building the tool. The local cache keeps scoped
 * immutable ids; project membership is checked before any remote bytes arrive.
 * What the instance says about a file is scrubbed as a received beam's is: its meta
 * is filtered, and a credential it declares is ignored. The asset store reads the
 * credential out of the bytes instead. */
export async function restoreTeamFiles(host: HostV1, data: TeamSessionData): Promise<void> {
  const refs = collectSessionAssetRefs(data.inputs).user.filter(key => decodeAssetVersion(key).id.startsWith('user/team/'));
  if (!refs.length) return;
  const assets: unknown = host.assets;
  if (!data.projectId || !isStore(assets)) throw new TeamFileError(422);
  const { files } = await listTeamFiles(data.projectId);
  for (const key of refs) {
    const dep = decodeAssetVersion(key);
    const file = files.find(f => assetId(f) === dep.id);
    if (!file || (dep.pin && dep.pin.version !== file.checksum)) throw new TeamFileError(404);
    await keepOnDevice(assets, data.projectId, file);
  }
}

/** Bring one project file onto this device under its shared id, the same way, and
 *  resolve that id. A copy of this version already on the device is kept. */
export async function restoreTeamFile(host: HostV1, projectId: string, file: TeamFile): Promise<string> {
  const assets: unknown = host.assets;
  if (!isStore(assets)) throw new TeamFileError(422);
  await keepOnDevice(assets, projectId, file);
  return assetId(file);
}

async function keepOnDevice(assets: AssetStore, projectId: string, file: TeamFile): Promise<void> {
  const existing = await assets._getUserRecord(assetId(file), file.checksum);
  if (existing?.blob && existing.version === file.checksum) return;
  const bytes = new Uint8Array(await (await downloadTeamFile(projectId, file)).arrayBuffer());
  const kind = sniffBeamAsset(bytes, file.asset);
  const safe = kind.markup ? await defaultSanitizeSvg(bytes) : bytes;
  await assets._uploadUserAsset({ id: assetId(file), version: file.checksum, type: kind.type, format: kind.format,
    blob: new Blob([safe as BlobPart], { type: kind.mime }), meta: { ...safeMeta(file.asset.meta), name: file.name },
    ...dims(file.asset) });
}

/** Upload one file from this device into the project (the Files panel). Markup is
 *  sanitised first, as a received asset's is. Resolves the project's file: an
 *  existing one when the project already holds the same bytes. */
export async function uploadTeamFile(projectId: string, blob: Blob, name: string, transfer: TeamFileTransfer = {}): Promise<TeamFile> {
  const list = await listTeamFiles(projectId);
  if (!blob.size) throw new TeamFileError(422);
  checkSize(list, blob.size);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const kind = sniffBeamAsset(bytes);
  const safe = kind.markup ? await defaultSanitizeSvg(bytes) : bytes;
  const clean = new Blob([safe as BlobPart], { type: kind.mime });
  return putFile(projectId, list, clean, safe, describe({ type: kind.type, format: kind.format, meta: { name } }, 'Upload'), transfer);
}

/** Create a new file identity with the original verified bytes and metadata. */
export async function duplicateTeamFile(projectId: string, file: TeamFile, name: string): Promise<TeamFile> {
  const list = await listTeamFiles(projectId);
  const blob = await downloadTeamFile(projectId, file);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (await checksum(bytes) !== file.checksum) throw new TeamFileError(422);
  return putFile(projectId, { ...list, files: [] }, blob, bytes,
    { name, asset: { ...file.asset, meta: { ...(isRecord(file.asset.meta) ? file.asset.meta : {}), name } } }, {});
}

/**
 * Delete a project file, or cancel an unfinished upload. The person who uploaded a
 * file may always; a project manager may delete any file. A file that sessions still
 * use is refused with FILE_IN_USE and those sessions, unless a manager passes `force`.
 */
export async function deleteTeamFile(projectId: string, fileId: string, opts: { force?: boolean } = {}): Promise<void> {
  await request(filePath(projectId, `/${encodeURIComponent(fileId)}${opts.force ? '?force=1' : ''}`), { method: 'DELETE' });
}

export async function downloadTeamFile(projectId: string, file: TeamFile): Promise<Blob> {
  const res = await request(filePath(projectId, `/${encodeURIComponent(file.id)}`));
  const declared = res.headers.get('content-length');
  if ((declared && Number(declared) !== file.size) || !res.body) throw new TeamFileError(422);
  const reader = res.body.getReader();
  const parts: BlobPart[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > file.size) throw new TeamFileError(422);
      parts.push(value as BlobPart);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  const blob = new Blob(parts, { type: file.contentType });
  if (size !== file.size || await checksum(new Uint8Array(await blob.arrayBuffer())) !== file.checksum) throw new TeamFileError(422);
  return blob;
}

/** What the person was doing when a file transfer failed: listing the project's
 *  files, reading one (a download, or opening a session that uses it), adding files
 *  (an upload, or a save that shares the document's files), or deleting one. */
export type TeamFileAction = 'list' | 'read' | 'upload' | 'delete';

/** The sentence for a failed file transfer. Plain text (a text sink). */
export function teamFileMessage(error: unknown, action: TeamFileAction): string {
  const e = error instanceof TeamFileError ? error : new TeamFileError(0);
  switch (e.code) {
    case 'CANCELLED': return tRaw('Upload cancelled.');
    case 'MISSING': return tRaw('An image or file in this document is missing on this device. Add it again, then save.');
    case 'PROJECT_FILE_BUDGET': return tRaw('There is no room left for files in this project. Delete files you no longer need, then try again.');
    case 'INSTANCE_FILE_BUDGET': return tRaw('There is no room left for files on this instance. Delete files you no longer need, or ask an administrator.');
    case 'PROJECT_FILE_PENDING': return tRaw('You have too many unfinished uploads. Try again later.');
    case 'UPLOAD_EXPIRED': case 'UPLOAD_INCOMPLETE': case 'FILE_READY': return tRaw('The upload was interrupted. Try again.');
    case 'FILE_IN_USE': return tRaw('Sessions still use that file: {sessions}.', { sessions: e.sessions.map(s => s.title).join(', ') });
    case 'ARCHIVED': return tRaw('This project is archived, so its files cannot change.');
  }
  if (e.status === 403) {
    if (action === 'delete') return tRaw('You can delete files you uploaded. A project manager can delete any file.');
    if (action === 'upload') return tRaw('You do not have permission to add files to this project.');
    return tRaw('You do not have access to the files in this project.');
  }
  if (e.status === 404 && action !== 'list') return tRaw('That file is no longer available.');
  if (e.status === 413) return tRaw('A file is too large to share. Each file can be up to {size}.', { size: fmtBytes(e.limit ?? CEILING_BYTES) });
  if (e.status === 422 && action !== 'list') return tRaw('The file did not arrive intact. Try again.');
  return tRaw('The shared files could not be reached. Check your sign-in and try again.');
}
