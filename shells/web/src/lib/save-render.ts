// SPDX-License-Identifier: MPL-2.0
/**
 * Save a just-downloaded render into the user's own catalog (the 'renders' tag).
 *
 * WP-B: after a successful download - a single export, a batch/zip member, or a
 * multi-edit zip member - the SAME credentialed bytes the user received are also
 * written to the personal library as a derived user asset. The bytes are stored
 * verbatim (never re-encoded), so the embedded Content Credential survives and a
 * later re-download verifies exactly like the file that just left. That is the
 * mirror of the catalog's `directDownload` credentialedBytes rule: a user asset
 * carrying its provenance in-band needs no re-wrap - only a re-encoded upload
 * (whose stored bytes lost the manifest) does.
 *
 * The save is best-effort and never blocks the download: the file has already
 * reached the user by the time this runs.
 *
 * Policy:
 *   - Off switch: `profile.saveRenders === false` suppresses every auto-save.
 *   - Dedupe: identical bytes (SHA-256) already tagged 'renders' are skipped
 *     SILENTLY - a re-download never stacks a second copy.
 *   - Size: images + audio auto-save silently; a video, or anything over
 *     RENDER_SAVE_MAX_BYTES, asks first (Esc / Cancel = don't save). The
 *     download is never gated by that dialog - it already happened.
 */
import { hashBlob } from './export-history.ts';
import { confirmDialog } from '../components/confirm-dialog.ts';
import { fmtBytes } from './format.ts';
import { isAudioFormat } from './audio-encode.ts';
import { t } from '../i18n.ts';

/** Renders at or below this size auto-save silently; a video (or anything) over
 *  it asks first. One place to tune the line. Start 50 MB. */
export const RENDER_SAVE_MAX_BYTES = 50 * 1024 * 1024;

/** Formats that store as a motion video (each also implies AssetRef type 'video'). */
const VIDEO_FORMATS = new Set(['mp4', 'm4v', 'webm', 'mov', 'ogv']);
/** Still-image formats (raster or, via 'svg', vector). */
const IMAGE_FORMATS = /^(png|jpe?g|webp|gif|apng|tiff?|avif|bmp|ico|heic|heif|svg)$/;

export type RenderKind = 'image' | 'audio' | 'video' | 'other';

/** Classify an export format for the size policy. Unknown/document formats
 *  (pdf/zip/html/json…) fall to 'other', which auto-saves when under the
 *  threshold and asks when over it - same as an image, minus the always-ask a
 *  video carries. */
export function renderKindForFormat(format: string): RenderKind {
  const f = String(format || '').toLowerCase();
  if (VIDEO_FORMATS.has(f)) return 'video';
  if (isAudioFormat(f)) return 'audio';
  if (IMAGE_FORMATS.test(f)) return 'image';
  return 'other';
}

/** 'auto' = save without asking; 'confirm' = pop a Save / Don't-save dialog
 *  first. Images and audio auto-save; a video always asks, and anything over the
 *  byte threshold asks regardless of kind. The download itself already happened -
 *  this only governs the personal-library COPY. */
export function renderSavePolicy(kind: RenderKind, size: number): 'auto' | 'confirm' {
  if (size > RENDER_SAVE_MAX_BYTES) return 'confirm';
  if (kind === 'video') return 'confirm';
  return 'auto';
}

/** The AssetRef record type a stored render carries. */
function recordType(kind: RenderKind, format: string): string {
  if (kind === 'video') return 'video';
  if (kind === 'audio') return 'audio';
  const f = String(format || '').toLowerCase();
  if (f === 'svg') return 'vector';
  if (f === 'json' || f === 'lottie') return 'lottie';
  if (kind === 'image') return 'raster';
  return 'data';
}

/** One stored user-asset record (the subset this module writes). Structurally
 *  compatible with the web bridge's UserAssetRecord, kept narrow so the module
 *  doesn't reach across into bridge internals. */
interface RenderRecord {
  id: string;
  type: string;
  format: string;
  blob: Blob;
  version: string;
  checksum?: string;
  width?: number;
  height?: number;
  meta: Record<string, unknown>;
}

/** The host slice this module needs - the two shell-internal asset methods plus
 *  the profile read. The real web host implements all of them; call sites cast. */
export interface RenderSaveHost {
  assets: {
    _uploadUserAsset(record: RenderRecord): Promise<void>;
    _listUserAssets(): Promise<ReadonlyArray<{ checksum?: string; meta?: Record<string, unknown> }>>;
  };
  profile: { get(): Promise<{ saveRenders?: boolean }> };
  log?: (level: string, msg: string, extra?: unknown) => void;
}

export interface SaveRenderInput {
  /** The EXACT credentialed bytes the user downloaded (post-C2PA-sign). */
  blob: Blob;
  format: string;
  /** The tool the render came from - stored under meta.toolId. */
  toolId: string;
  /** Display name for the saved asset (usually the download filename stem). */
  name: string;
  width?: number;
  height?: number;
}

export type SaveRenderResult = 'saved' | 'skipped-off' | 'skipped-dupe' | 'declined' | 'error';

/** Ask before saving a large / video render. Seam so tests drive the decision
 *  without a live modal; production uses the shared confirmDialog. */
export type ConfirmSave = (size: number) => Promise<boolean>;

const defaultConfirm: ConfirmSave = (size) => confirmDialog({
  title: t('Save this render to your catalog?'),
  message: fmtBytes(size),
  confirmLabel: t('Save'),
  danger: false,
});

function tagsOf(meta: Record<string, unknown> | undefined): string[] {
  const tags = meta?.tags;
  return Array.isArray(tags) ? (tags as unknown[]).map(String) : [];
}

/**
 * Save one finished render into the personal library, tagged 'renders'. Returns
 * how it went; every non-'saved' outcome is a quiet, expected no-op (the toggle
 * is off, the bytes are already saved, the user declined, or a best-effort
 * failure that must never surface to break a download).
 */
export async function saveRenderToLibrary(host: RenderSaveHost, input: SaveRenderInput, confirm: ConfirmSave = defaultConfirm): Promise<SaveRenderResult> {
  try {
    const profile = await host.profile.get().catch(() => ({} as { saveRenders?: boolean }));
    if (profile.saveRenders === false) return 'skipped-off';

    const { blob, format } = input;
    const kind = renderKindForFormat(format);
    const hash = await hashBlob(blob);

    // Dedupe by checksum: an identical 'renders' asset already on the device
    // means this file was saved before - skip silently. Reads AssetRefs (which
    // carry the record checksum + meta), so no blob is loaded to compare.
    if (hash) {
      const existing = await host.assets._listUserAssets().catch(() => [] as ReadonlyArray<{ checksum?: string; meta?: Record<string, unknown> }>);
      if (existing.some(r => r.checksum === hash && tagsOf(r.meta).includes('renders'))) return 'skipped-dupe';
    }

    // Size policy. The dialog asks ONLY about the library copy; the download is
    // already done, so a "don't save" leaves the user's file untouched.
    if (renderSavePolicy(kind, blob.size) === 'confirm') {
      const ok = await confirm(blob.size);
      if (!ok) return 'declined';
    }

    const safeName = String(input.name || input.toolId || 'render').replace(/[^a-z0-9.-]/gi, '_').slice(0, 80);
    const record: RenderRecord = {
      id: `user/render/${Date.now()}-${safeName}`,
      type: recordType(kind, format),
      format,
      blob,
      version: '1.0.0',
      ...(hash ? { checksum: hash } : {}),
      ...(input.width ? { width: input.width } : {}),
      ...(input.height ? { height: input.height } : {}),
      meta: {
        name: input.name || safeName,
        tags: ['renders'],
        toolId: input.toolId,
        format,
        ...(input.width && input.height ? { dimensions: `${input.width}×${input.height}` } : {}),
      },
    };
    await host.assets._uploadUserAsset(record);
    return 'saved';
  } catch (err) {
    host.log?.('warn', 'Save render to library failed', { error: String(err) });
    return 'error';
  }
}

/** Save each member of a delivered batch/zip. Sequential so any size-policy
 *  dialogs never stack, and each save is independent + best-effort. */
export async function saveBatchRendersToLibrary(
  host: RenderSaveHost,
  members: ReadonlyArray<{ blob: Blob; name: string; format: string; toolId: string }>,
  confirm: ConfirmSave = defaultConfirm,
): Promise<void> {
  for (const m of members) {
    const stem = m.name.replace(/\.[a-z0-9]{1,5}$/i, '');
    await saveRenderToLibrary(host, { blob: m.blob, format: m.format, toolId: m.toolId, name: stem }, confirm);
  }
}
