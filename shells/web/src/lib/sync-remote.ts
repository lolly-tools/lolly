// SPDX-License-Identifier: MPL-2.0
/**
 * sync-remote (plans/138 Tier B) - the ONE contract a device-sync backend must
 * satisfy. Deliberately tiny: a single named snapshot object the sync engine
 * pushes to and pulls from, plus a cheap metadata read to detect a newer one
 * without downloading. Every provider the roadmap names offers exactly this:
 *
 *   - S3 / R2 / MinIO   → PUT / GET / HEAD one key (ETag = rev)
 *   - WebDAV / Nextcloud → PUT / GET / HEAD one path (ETag or Last-Modified = rev)
 *   - Dropbox            → files/upload + files/download (rev field)
 *   - Google Drive       → a file in appDataFolder (version/headRevisionId = rev)
 *   - iCloud             → a file in the ubiquity container (handled natively; a
 *                          later adapter, if a JS seam is even needed there)
 *
 * A concrete adapter is a THIN wrapper over the existing send drivers'
 * auth/fetch (lib/{s3,nextcloud,dropbox,onedrive,google-drive}-send.ts) - those
 * already do the hard part (SigV4, OAuth). The send drivers only PUT + return a
 * link; this adds the GET/HEAD the two-way sync needs. Kept as its own seam so
 * the engine (sync-engine.ts) never knows which cloud it's talking to, and so it
 * unit-tests against MemoryRemote below with no network.
 *
 * `rev` is opaque: any string that CHANGES whenever the remote snapshot changes
 * and is STABLE while it doesn't. The engine only ever compares it for equality
 * (last-write-wins at snapshot granularity), never parses or orders it.
 */

export interface SnapshotMeta {
  /** Opaque revision - ETag / Dropbox rev / Drive headRevisionId / mtime. Compared
   *  for equality only; changes iff the remote snapshot changed. */
  rev: string;
  /** ISO time the remote snapshot was written, for honest "last synced" UI. */
  updatedAt: string;
  /** Byte length of the stored snapshot. */
  size: number;
}

export interface PutOpts {
  /** See `SyncRemote.put`. */
  ifRev?: string | null;
}

/** The stored copy changed since this device last read it, so a conditional
 *  write was refused. The engine turns this into a conflict for the person to
 *  settle; it is never retried on its own. */
export class SyncConflictError extends Error {
  constructor(message = 'Your synced data changed on another device.') {
    super(message);
    this.name = 'SyncConflictError';
  }
}

/**
 * HTTP precondition headers for a conditional write. A rev read from an ETag is
 * sent back as `If-Match`; `null` becomes `If-None-Match: *`. A weak ETag or a
 * rev that fell back to Last-Modified cannot be matched strongly, so it sends
 * nothing and the engine's head check is the only guard.
 */
export function preconditionHeaders(opts?: PutOpts): Record<string, string> {
  if (!opts || opts.ifRev === undefined) return {};
  if (opts.ifRev === null) return { 'If-None-Match': '*' };
  const rev = opts.ifRev;
  if (!rev || rev.startsWith('W/') || /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} /.test(rev)) return {};
  return { 'If-Match': `"${rev}"` };
}

export interface SyncRemote {
  /** A short id for this backend (the provider kind), for logs/UI. */
  readonly kind: string;
  /** Cheap metadata read: the current snapshot's meta, or null if none exists yet.
   *  MUST NOT download the body. */
  head(): Promise<SnapshotMeta | null>;
  /** Download the current snapshot + its meta, or null if none exists. */
  get(): Promise<{ bytes: Uint8Array; meta: SnapshotMeta } | null>;
  /** Upload the snapshot; resolves to the new meta carrying the fresh rev.
   *  `opts.ifRev` makes the write conditional (plans/138 Tier D, WP-S1): a string
   *  means "only if the stored rev is still this one", `null` means "only if
   *  nothing is stored yet", and absent means an unconditional overwrite. A store
   *  that can check the condition itself does so and throws `SyncConflictError`
   *  when it fails; a store that cannot (Drive) compares a fresh read instead,
   *  which leaves a short window. The engine's own head check runs first either way. */
  put(bytes: Uint8Array, opts?: PutOpts): Promise<SnapshotMeta>;
  /** Whether this remote can operate WITHOUT an interactive sign-in right now.
   *  Credential remotes (S3, WebDAV) are always silent and omit this. OAuth remotes
   *  (Drive, Dropbox) return true only with a live/refreshable token - so the AUTO
   *  paths (debounced push, boot check) skip them rather than popping a sign-in
   *  outside a user gesture. Absent = assumed silent. Manual actions ignore it. */
  canSyncSilently?(): boolean | Promise<boolean>;
  /** Remove the stored object. Optional: per-record sync (plans/138 B2) uses it to
   *  clear objects nothing names any more, and without it they stay in the store.
   *  Removing an object that is not there is not an error. */
  remove?(): Promise<void>;
}

/**
 * Build a SnapshotMeta from an HTTP response's headers - shared by every
 * HTTP-backed adapter (S3, WebDAV, …). `rev` is the ETag (Last-Modified as a
 * fallback), quote-stripped; `updatedAt` prefers Last-Modified then the response
 * Date; `size` reads Content-Length, falling back to a caller-known length.
 * REALITY: the store's CORS must expose ETag (ideally Last-Modified) or `rev`
 * comes back '' and newer-detection can't work - documented per provider.
 */
export function metaFromHeaders(headers: Headers, fallbackSize: number): SnapshotMeta {
  return {
    rev: (headers.get('etag') || headers.get('last-modified') || '').replace(/^"|"$/g, ''),
    updatedAt: headers.get('last-modified') || headers.get('date') || new Date().toISOString(),
    size: Number(headers.get('content-length')) || fallbackSize,
  };
}

/**
 * In-memory SyncRemote for tests and local reasoning - and the reference for what
 * a real adapter must do. `rev` is a monotonic counter (any change-detecting
 * string is legal); `now()` is injected because the workflow/test sandbox forbids
 * Date.now(), and it keeps timestamps deterministic in tests.
 */
export class MemoryRemote implements SyncRemote {
  readonly kind = 'memory';
  private bytes: Uint8Array | null = null;
  private meta: SnapshotMeta | null = null;
  private seq = 0;
  private readonly now: () => string;
  constructor(now: () => string = () => new Date(0).toISOString()) { this.now = now; }

  async head(): Promise<SnapshotMeta | null> {
    return this.meta ? { ...this.meta } : null;
  }

  async get(): Promise<{ bytes: Uint8Array; meta: SnapshotMeta } | null> {
    if (!this.bytes || !this.meta) return null;
    return { bytes: this.bytes.slice(), meta: { ...this.meta } };
  }

  async put(bytes: Uint8Array, opts?: PutOpts): Promise<SnapshotMeta> {
    if (opts && opts.ifRev !== undefined && opts.ifRev !== (this.meta?.rev ?? null)) {
      throw new SyncConflictError();
    }
    this.bytes = bytes.slice();
    this.meta = { rev: `r${++this.seq}`, updatedAt: this.now(), size: bytes.length };
    return { ...this.meta };
  }

  async remove(): Promise<void> {
    this.bytes = null;
    this.meta = null;
  }
}
