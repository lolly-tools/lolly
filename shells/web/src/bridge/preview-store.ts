// SPDX-License-Identifier: MPL-2.0
/**
 * One preview store (plan 373): every picture of a tool render the web shell
 * keeps, stored once by the hash of its bytes.
 *
 *   preview-blobs   content key -> { bytes, type, width, height, route, size }
 *   preview-index   owner id    -> { content: content key, kind }
 *
 * An owner is what must keep a picture: a saved session (`session:<slot>`), a
 * revision (`rev:<id>`), an export history entry (`export:<id>`), or a cache entry
 * drawn from a recipe (`cache:<recipe key>`). A picture with no index row left is
 * deleted in the same transaction that removed its last row, so one picture
 * shared by a session, its head revision and an export is stored once and leaves
 * with the last of them.
 *
 * The functions that take a transaction write inside the caller's own
 * transaction, so a session record and its picture row commit together or not at
 * all. They are synchronous IndexedDB work only: anything asynchronous (hashing,
 * decoding a data URL) happens in `preparePicture` before the transaction opens,
 * because awaiting anything else inside a transaction commits it early.
 *
 * Not part of the tool contract (packages/core host-v1): no tool can read another
 * document's picture. The stores are additive (db.ts version 27) and are never in
 * REQUIRED_STORES, so a missing store degrades to the pre-373 behaviour (a data
 * URL on the record) and never starts the destructive repair.
 */
import type { IDBPDatabase, IDBPTransaction } from 'idb';
import {
  decodePictureDataUrl, pictureDataUrl, previewRefFor, readPreviewRef, PREVIEW_MAX_BYTES,
  type DataUrlForm, type PreviewRoute, type PreviewType, type SessionPreviewRef,
} from '../../../../engine/src/session-preview.ts';

export type { SessionPreviewRef } from '../../../../engine/src/session-preview.ts';

export const PREVIEW_BLOBS = 'preview-blobs';
export const PREVIEW_INDEX = 'preview-index';
/** The lean list of sessions (plan 373 decision 6), kept beside `state`. */
export const STATE_LIST = 'state-list';
/** The stores a picture write touches. */
export const PREVIEW_STORES = [PREVIEW_BLOBS, PREVIEW_INDEX] as const;

/** Any transaction this module writes in. */
export type PictureTx = IDBPTransaction<unknown, string[], 'readwrite'>;
type ReadTx = Pick<IDBPTransaction<unknown, string[], IDBTransactionMode>, 'objectStore'> & { objectStoreNames: DOMStringList | { contains(name: string): boolean } };

/** A picture ready to store: its reference and its bytes. */
export interface PreparedPicture {
  ref: SessionPreviewRef;
  bytes: Uint8Array;
  /** How a data URL carried these bytes when they arrived as one. */
  form?: DataUrlForm;
}

/** What a writer may hand a store: a data URL (legacy callers, received packs),
 *  a reference to a picture already stored, prepared bytes, or nothing. */
export type PictureInput = string | SessionPreviewRef | PreparedPicture | null | undefined;

/** One stored picture. `bytes` is an ArrayBuffer, not a Blob: older WebKit builds
 *  lost Blobs stored in IndexedDB, and the largest value is 256 KiB. */
export interface PreviewBlobRow {
  key: string;
  type: PreviewType;
  bytes: ArrayBuffer;
  size: number;
  width: number;
  height: number;
  route: PreviewRoute;
  recipe?: string;
  form?: DataUrlForm;
  at: number;
}

export type OwnerKind = 'session' | 'revision' | 'export' | 'cache';

export interface PreviewIndexRow {
  id: string;
  content: string;
  kind: OwnerKind;
  at: number;
  /** Last read, for the cache's least-recently-used order (written once a day at most). */
  usedAt?: number;
  /** Byte length of the picture, so the cache's usage needs no blob read. */
  size?: number;
}

export const sessionOwner = (slot: string): string => `session:${slot}`;
export const revisionOwner = (id: string): string => `rev:${id}`;
export const exportOwner = (id: string): string => `export:${id}`;
export const cacheOwner = (recipe: string): string => `cache:${recipe}`;

const has = (list: { contains(name: string): boolean } | DOMStringList | undefined, name: string): boolean => !!list && list.contains(name);

/** Whether this database holds the preview stores (version 27 or later). */
export function hasPreviewStores(db: { objectStoreNames: { contains(name: string): boolean } | DOMStringList }): boolean {
  return has(db.objectStoreNames, PREVIEW_BLOBS) && has(db.objectStoreNames, PREVIEW_INDEX);
}

/** Whether a transaction's scope holds the preview stores. */
export function txHasPreviews(tx: { objectStoreNames: { contains(name: string): boolean } | DOMStringList }): boolean {
  return has(tx.objectStoreNames, PREVIEW_BLOBS) && has(tx.objectStoreNames, PREVIEW_INDEX);
}

/**
 * The scope for a transaction that writes `state`: the named stores plus the
 * lean list and the preview stores when this database has them. Every writer of
 * a session record opens its transaction through here, so the record, its lean
 * row and its picture row always commit together.
 */
export function scopeFor(db: { objectStoreNames: { contains(name: string): boolean } | DOMStringList }, stores: readonly string[]): string[] {
  const out = [...stores];
  for (const name of [STATE_LIST, ...PREVIEW_STORES]) if (has(db.objectStoreNames, name) && !out.includes(name)) out.push(name);
  return out;
}

/** Whether a value is prepared picture bytes (as opposed to a bare reference,
 *  whose `bytes` is a length). */
export function isPrepared(value: unknown): value is PreparedPicture {
  return !!value && typeof value === 'object' && 'bytes' in value && (value as PreparedPicture).bytes instanceof Uint8Array && !!readPreviewRef((value as PreparedPicture).ref);
}

/**
 * Turn what a caller handed in into prepared bytes or a reference, before any
 * transaction opens. A data URL is decoded and hashed (`route` says where it came
 * from: `legacy` for a field this device wrote before plan 373, `received` for a
 * pack, backup, sync record or beam); junk reads as null. A picture over the
 * per-entry limit is still accepted when it arrives from outside, because it is
 * the sender's only picture and dropping it would leave nothing.
 */
export async function preparePicture(input: PictureInput, route: PreviewRoute = 'received'): Promise<PreparedPicture | SessionPreviewRef | null> {
  if (input == null) return null;
  if (typeof input === 'string') {
    const decoded = decodePictureDataUrl(input);
    if (!decoded) return null;
    let bytes = decoded.bytes;
    if (decoded.type === 'image/svg+xml' && route === 'received') {
      // An SVG from outside (a pack, a backup, a sync record, a beam) is stored only
      // after the app's SVG sanitiser (bridge/svg-sanitize.ts: DOMPurify's SVG
      // profile, the treatment an uploaded SVG gets) has read the SVG. Shown only in an
      // <img> as a data: URL it could do nothing anyway; sanitising keeps a stored
      // picture safe for any later use. Fails closed: no sanitiser, no picture.
      try {
        const { sanitizeSvgToString } = await import('./svg-sanitize.ts');
        bytes = new TextEncoder().encode(await sanitizeSvgToString(new TextDecoder().decode(bytes)));
      } catch { return null; }
    }
    const ref = await previewRefFor(bytes, decoded.type, { route });
    return ref ? { ref, bytes, ...(bytes === decoded.bytes ? { form: decoded.form } : {}) } : null;
  }
  if (isPrepared(input)) return input;
  return readPreviewRef(input);
}

/** Store picture bytes once. A second write of the same bytes is a no-op. */
export async function putPictureBytes(tx: PictureTx, picture: PreparedPicture): Promise<void> {
  const blobs = tx.objectStore(PREVIEW_BLOBS);
  if (await blobs.count(picture.ref.key)) return;
  const bytes = picture.bytes.slice().buffer as ArrayBuffer;
  const row: PreviewBlobRow = {
    key: picture.ref.key, type: picture.ref.type, bytes, size: bytes.byteLength,
    width: picture.ref.width, height: picture.ref.height, route: picture.ref.route ?? 'received',
    ...(picture.ref.recipe ? { recipe: picture.ref.recipe } : {}), ...(picture.form ? { form: picture.form } : {}), at: Date.now(),
  };
  await blobs.put(row);
  // Read back inside the same transaction before anything points at the row: a
  // write that did not land must not become a reference to nothing.
  const back = await blobs.get(picture.ref.key) as PreviewBlobRow | undefined;
  if (!back || back.size !== bytes.byteLength) throw new Error('The picture could not be stored.');
}

/**
 * Pictures a save stored a moment before the record that points at them is
 * written, kept in memory until that save has finished. Between the two
 * transactions another tab may let go of the picture's last other owner, and the
 * bytes would go with it; the record write then stores them again from here rather
 * than lose the picture. Each hold lasts exactly as long as its save, however long
 * that takes, so the memory held is the pictures of the saves in progress.
 */
const staged = new Map<string, { picture: PreparedPicture; holds: number }>();
export function holdStaged(picture: PreparedPicture): () => void {
  const key = picture.ref.key;
  const entry = staged.get(key) ?? { picture, holds: 0 };
  entry.holds++;
  staged.set(key, entry);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--entry.holds <= 0 && staged.get(key) === entry) staged.delete(key);
  };
}
function stagedPicture(key: string): PreparedPicture | null {
  return staged.get(key)?.picture ?? null;
}

/** Delete a picture when no owner points at it any more. */
async function collect(tx: PictureTx, key: string): Promise<void> {
  if (await tx.objectStore(PREVIEW_INDEX).index('content').count(key)) return;
  await tx.objectStore(PREVIEW_BLOBS).delete(key);
}

/**
 * Point an owner at a picture, inside the caller's transaction. Prepared bytes are
 * stored first; a bare reference binds only when its bytes are already here, or
 * held from a save a moment ago (a reference copied from another device's record
 * points at nothing on this one).
 * Returns the reference that was bound, or null when nothing could be.
 */
export async function bindOwner(tx: PictureTx, owner: string, kind: OwnerKind, picture: PreparedPicture | SessionPreviewRef): Promise<SessionPreviewRef | null> {
  const ref = isPrepared(picture) ? picture.ref : picture;
  if (isPrepared(picture)) await putPictureBytes(tx, picture);
  else if (!await tx.objectStore(PREVIEW_BLOBS).count(ref.key)) {
    const held = stagedPicture(ref.key);
    if (!held) return null;
    await putPictureBytes(tx, held);
  }
  const index = tx.objectStore(PREVIEW_INDEX);
  const prior = await index.get(owner) as PreviewIndexRow | undefined;
  const size = isPrepared(picture) ? picture.bytes.byteLength : ref.bytes ?? (await tx.objectStore(PREVIEW_BLOBS).get(ref.key) as PreviewBlobRow | undefined)?.size;
  await index.put({ id: owner, content: ref.key, kind, at: Date.now(), ...(size ? { size } : {}) } satisfies PreviewIndexRow);
  if (prior && prior.content !== ref.key) await collect(tx, prior.content);
  return ref;
}

/** Remove an owner's picture row, and the picture too when no other owner holds the picture. */
export async function releaseOwner(tx: PictureTx, owner: string): Promise<void> {
  const index = tx.objectStore(PREVIEW_INDEX);
  const prior = await index.get(owner) as PreviewIndexRow | undefined;
  if (!prior) return;
  await index.delete(owner);
  await collect(tx, prior.content);
}

/** The reference an owner holds, or null. */
export async function ownerRef(tx: ReadTx, owner: string): Promise<SessionPreviewRef | null> {
  if (!txHasPreviews(tx)) return null;
  const row = await tx.objectStore(PREVIEW_INDEX).get(owner) as PreviewIndexRow | undefined;
  if (!row) return null;
  const blob = await tx.objectStore(PREVIEW_BLOBS).get(row.content) as PreviewBlobRow | undefined;
  return blob ? refOfRow(blob) : null;
}

/** The byte length of the picture an owner holds, or 0. */
export async function ownerSize(tx: ReadTx, owner: string): Promise<number> {
  if (!txHasPreviews(tx)) return 0;
  const row = await tx.objectStore(PREVIEW_INDEX).get(owner) as PreviewIndexRow | undefined;
  if (!row) return 0;
  if (row.size) return row.size;
  return (await tx.objectStore(PREVIEW_BLOBS).get(row.content) as PreviewBlobRow | undefined)?.size ?? 0;
}

export function refOfRow(row: PreviewBlobRow): SessionPreviewRef {
  return { key: row.key, type: row.type, width: row.width, height: row.height, route: row.route, bytes: row.size, ...(row.recipe ? { recipe: row.recipe } : {}) };
}

/** A picture as a Blob, from a stored row. */
export function blobOfRow(row: PreviewBlobRow): Blob {
  return new Blob([row.bytes], { type: row.type });
}

/** The data URL a pre-373 writer would have produced for a stored picture, for
 *  the formats that still carry one (`.lolly`, backup, device sync, beam). */
export function dataUrlOfRow(row: PreviewBlobRow): string {
  return pictureDataUrl(new Uint8Array(row.bytes), row.type, row.form);
}

/** Read one stored picture by its content key, or null. Never throws. */
export async function readPictureRow(db: Pick<IDBPDatabase, 'get' | 'objectStoreNames'>, key: string): Promise<PreviewBlobRow | null> {
  try {
    if (!hasPreviewStores(db)) return null;
    return (await db.get(PREVIEW_BLOBS, key) as PreviewBlobRow | undefined) ?? null;
  } catch { return null; }
}

/** Whether prepared bytes fit one entry. A picture this store makes itself never
 *  exceeds the limit (the writer falls back to raster first). */
export function withinLimit(picture: PreparedPicture): boolean {
  return picture.bytes.byteLength <= PREVIEW_MAX_BYTES;
}

export { PREVIEW_MAX_BYTES };

/** An `<img>` source for a stored picture: an object URL for a raster, a data URL
 *  for SVG, shared per content key (lib/preview-urls.ts). Null when the bytes are
 *  not here. */
export async function pictureSrc(db: Pick<IDBPDatabase, 'get' | 'objectStoreNames'>, key: string): Promise<string | null> {
  const { heldObjectUrl, srcForBlob } = await import('../lib/preview-urls.ts');
  const held = heldObjectUrl(key);
  if (held) return held;
  const row = await readPictureRow(db, key);
  return row ? srcForBlob(key, blobOfRow(row)) : null;
}

/** An `<img>` source for the picture an owner holds, or null. */
export async function ownerSrc(db: Pick<IDBPDatabase, 'get' | 'objectStoreNames'>, owner: string): Promise<string | null> {
  try {
    if (!hasPreviewStores(db)) return null;
    const row = await db.get(PREVIEW_INDEX, owner) as PreviewIndexRow | undefined;
    return row ? pictureSrc(db, row.content) : null;
  } catch { return null; }
}
