// SPDX-License-Identifier: MPL-2.0
/**
 * catalog: favourites, hiding, recategorise, soft delete, rename, tags, replace and trim of user assets.
 *
 * Every function takes the shared `cat: CatCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `cat.<module>.<fn>`. Extracted verbatim
 * from mountCatalog() by scripts/split-closure.ts.
 */
import { t, tRaw } from '../../i18n.ts';
import { showUndoToast } from '../../lib/undo-toast.ts';
import { announce } from '../../a11y.ts';
import { choiceDialog, confirmDialog, promptDialog } from '../../components/confirm-dialog.ts';
import { LIB_GROUPS, categoryLabel, libCategory, loadAssetCategories, saveAssetCategory } from '../../lib/asset-category.ts';
import { assetBaseId, saveFavouriteAssets, saveHiddenAssets } from '../../lib/asset-favourites.ts';
import type { TrimProposal } from '../../lib/design-system/trim-offer.ts';
import { UPLOAD_ACCEPT, replaceUserUpload } from '../picker.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { CAT_ICONS, REPLACE_IMAGE_ACCEPT, setCatToggle } from './shared.ts';
import type { UserAssetRecordLike } from './shared.ts';
import { bindOp, type CatCtx } from './context.ts';

// ── actions ──────────────────────────────────────────────────────────────────
export async function toggleFavourite(cat: CatCtx, id: string): Promise<void> {
  const { host } = cat;
  const base = assetBaseId(id);
  const on = !cat.favSet.has(base);
  if (on) cat.favSet.add(base); else cat.favSet.delete(base);
  if (cat.profile) await saveFavouriteAssets(host, cat.profile, cat.favSet);
  if (!cat.mounted) return;
  // In place: flip the affected grid tile(s) + re-mount only the favourites strip (whose
  // membership just changed) instead of rebuilding the whole grid via render().
  cat.sections.reflectFavInGrid(base, on);
  cat.sections.refreshFavStrip();
  const name = String(cat.assetById.get(id)?.meta?.name ?? id);
  announce(on ? tRaw('Added {name} to favourites', { name }) : tRaw('Removed {name} from favourites', { name }));
}
export async function setHidden(cat: CatCtx, base: string, hide: boolean, opts: { toast?: boolean } = {}): Promise<void> {
  const { host } = cat;
  if (hide) cat.hiddenSet.add(base); else cat.hiddenSet.delete(base);
  if (cat.profile) await saveHiddenAssets(host, cat.profile, cat.hiddenSet);
  if (!cat.mounted) return;
  const hidName = String(cat.assetById.get(base)?.meta?.name ?? base);
  announce(hide ? tRaw('{name} hidden', { name: hidName }) : tRaw('{name} unhidden', { name: hidName }));
  // Hide is already reversible, so the toast carries no deferred commit - it is
  // pure convenience: one press instead of finding the Show-hidden toggle.
  // toast:false on the undo path so undoing can't spawn a counter-toast.
  if (opts.toast !== false) {
    showUndoToast({
      message: hide ? tRaw('Hid "{name}".', { name: hidName }) : tRaw('Unhid "{name}".', { name: hidName }),
      undo: () => { void setHidden(cat, base, !hide, { toast: false }); },
    });
  }
  // Hiding relocates a tile between buckets (category grid ↔ Hidden section), so a naive
  // class-toggle isn't faithful. Try a minimal in-place DOM move for the common case and
  // fall back to a full re-render for the structural sub-cases where splicing a section
  // in/out (or building the toolbar's "Show hidden" control) isn't clearly safe.
  if (!applyHiddenInPlace(cat, base, hide)) cat.sections.rerender();
}
// Minimal in-place reflection of a hide/unhide; returns false to request a full render()
// when the change would create/reorder a section (not clearly safe to splice). Only the
// repeated-hide path (Show hidden off, its toggle already present) is handled in place - 
// the same set of tiles just leaves the grid, exactly as a re-render would omit them.
export function applyHiddenInPlace(cat: CatCtx, base: string, hide: boolean): boolean {
  const { viewEl } = cat;
  if (cat.query) return false;                       // search view buckets differently
  if (!hide) return false;                        // unhide re-inserts into an ordered category → render()
  if (cat.showHidden) return false;                   // would need to move tiles INTO the Hidden section
  const assets = viewEl.querySelector<HTMLElement>('.cat-assets');
  if (!assets) return false;
  const tiles = [...viewEl.querySelectorAll<HTMLElement>('.cat-tile')]
    .filter(t => assetBaseId(t.dataset.id ?? '') === base);
  if (!tiles.length) return false;
  // The "Show hidden (N)" toggle (the .cat-showhidden that isn't Collapse-all) must
  // already exist; building it from scratch on the first-ever hide isn't clearly safe.
  const toggle = [...assets.querySelectorAll<HTMLElement>('.cat-showhidden')]
    .find(b => !b.classList.contains('cat-collapse-all'));
  if (!toggle) return false;
  // Drop the tiles; remove any category/uploads section they leave empty (render omits it).
  for (const tile of tiles) {
    const sec = tile.closest<HTMLElement>('.cat-group');
    tile.remove();
    if (sec && !sec.querySelector('.cat-tile')) sec.remove();
  }
  // Toolbar count + the toggle's own tally both read the (now smaller) visible/hidden sets.
  const hiddenCount = cat.allAssets.filter(a => cat.hiddenSet.has(assetBaseId(a.id))).length;
  // This path only runs while hidden assets are folded away (showHidden === false), so the
  // eye icon + "Show hidden (N)" is always the right pairing. Preserve the icon (setCatToggle).
  setCatToggle(toggle, CAT_ICONS.eye, t('Show hidden ({n})', { n: hiddenCount }));
  const count = assets.querySelector<HTMLElement>('.cat-count');
  if (count) { const n = cat.filters.visibleAssets().length; count.textContent = n === 1 ? t('1 asset') : t('{n} assets', { n }); }
  if (cat.favSet.has(base)) cat.sections.refreshFavStrip();   // a hidden favourite leaves the strip
  return true;
}
export async function recategorise(cat: CatCtx, ref: AssetRef): Promise<void> {
  const { host } = cat;
  const base = assetBaseId(ref.id);
  const current = libCategory(ref, cat.overrides);
  const chosen = await choiceDialog({
    title: t('Recategorise asset'),
    message: tRaw('Move “{name}” into which group? (Currently {category}.)', { name: String(ref.meta?.name ?? ref.id), category: t(categoryLabel(current)) }),
    choices: [
      ...LIB_GROUPS.map(g => ({ id: g.key, label: t(g.label), primary: g.key === current })),
      { id: '__auto__', label: t('Auto (from tags)') },
    ],
  });
  if (!chosen || !cat.mounted) return;
  if (cat.profile) await saveAssetCategory(host, cat.profile, base, chosen === '__auto__' ? null : chosen);
  cat.tiles.setOverrides(loadAssetCategories(cat.profile));
  // '__auto__' clears the override, so the resulting group is the tag-derived one.
  const newCat = chosen === '__auto__' ? libCategory(ref, cat.overrides) : chosen;
  announce(tRaw('Moved {name} to {category}', { name: String(ref.meta?.name ?? ref.id), category: t(categoryLabel(newCat)) }));
  cat.sections.rerender();
}
/**
 * Soft-delete uploads behind an undo toast (plans/132 WP-E): the tiles leave
 * the view NOW, the bytes leave the device only when the toast settles. No
 * confirm dialog any more - the toast IS the safety net, and it costs nothing
 * on the (overwhelmingly common) intentional path.
 */
export function softDeleteUploads(cat: CatCtx, refs: readonly AssetRef[]): void {
  const { host, pendingDeletes, selected } = cat;
  if (!refs.length) return;
  for (const r of refs) {
    pendingDeletes.add(r.id);
    cat.allAssets = cat.allAssets.filter(a => a.id !== r.id);
    cat.assetById.delete(r.id);
    selected.delete(r.id);
  }
  cat.sections.rerender();
  const firstName = String(refs[0]!.meta?.name ?? refs[0]!.id.split('/').pop());
  showUndoToast({
    message: refs.length === 1
      ? tRaw('Deleted "{name}".', { name: firstName })
      : tRaw('Deleted {n} uploads.', { n: refs.length }),
    undo: async () => {
      for (const r of refs) pendingDeletes.delete(r.id);
      if (!cat.mounted) return;
      await cat.tiles.reload();
      if (cat.mounted) cat.sections.rerender();
      announce(refs.length === 1 ? tRaw('Restored "{name}".', { name: firstName }) : tRaw('Restored {n} uploads.', { n: refs.length }));
    },
    commit: async () => {
      for (const r of refs) {
        const base = assetBaseId(r.id);
        // The bridge announces the delete ('lolly:user-asset-deleted', wired in
        // main.ts), which also drops an audio upload from the Neurospicy player.
        await host.assets._deleteUserAsset(r.id).catch(() => {});
        pendingDeletes.delete(r.id);
        // Prune any dangling per-user overlay entries for the gone asset (one
        // write each, only when actually present).
        if (cat.profile && cat.favSet.delete(base)) await saveFavouriteAssets(host, cat.profile, cat.favSet);
        if (cat.profile && cat.hiddenSet.delete(base)) await saveHiddenAssets(host, cat.profile, cat.hiddenSet);
        if (cat.profile && cat.overrides[base]) { await saveAssetCategory(host, cat.profile, base, null); cat.tiles.setOverrides(loadAssetCategories(cat.profile)); }
      }
    },
  });
}
export async function deleteUserAsset(cat: CatCtx, ref: AssetRef): Promise<void> {
  softDeleteUploads(cat, [ref]);
}
export async function renameUserAsset(cat: CatCtx, ref: AssetRef): Promise<void> {
  const { host } = cat;
  const current = String(ref.meta?.name ?? '');
  const name = await promptDialog({
    title: t('Rename image'),
    message: t('Give this upload a new name.'),
    value: current,
    placeholder: t('Image name'),
    confirmLabel: t('Rename'),
  });
  if (name == null || !cat.mounted) return;
  const trimmed = name.trim();
  if (!trimmed || trimmed === current) return;
  await host.assets._renameUserAsset(ref.id, trimmed).catch(() => {});
  // allAssets holds the same AssetRef objects assetById maps to, so one write updates both.
  const rec = cat.assetById.get(ref.id);
  if (rec) rec.meta = { ...rec.meta, name: trimmed };
  cat.sections.rerender();
}
/** Edit the free-form tags on one or many uploads (plans/132 WP-C item 2).
 *  One comma-separated field - the same read-then-merge meta write the
 *  declare-AI-origins action uses; an empty field clears the tags. Tags feed
 *  the search haystack, so the memoised index is dropped after a write. */
export async function editTags(cat: CatCtx, refs: AssetRef[]): Promise<void> {
  const { host } = cat;
  const uploads = refs.filter(r => r.source === 'user');
  const first = uploads[0];
  if (!first) return;
  const current = uploads.length === 1 ? (((first.meta?.tags as string[] | undefined) ?? []).join(', ')) : '';
  const raw = await promptDialog({
    title: uploads.length === 1 ? t('Edit tags') : tRaw('Edit tags on {n} uploads', { n: uploads.length }),
    message: uploads.length === 1
      ? t('Comma-separated tags. They show in the details, feed search, and click-to-filter.')
      : t('Comma-separated tags to set on every selected upload, replacing what each has now.'),
    value: current,
    placeholder: t('e.g. logo, dark, print'),
    confirmLabel: t('Save'),
  });
  if (raw == null || !cat.mounted) return;
  const tags = [...new Set(raw.split(',').map(x => x.trim()).filter(Boolean))];
  for (const ref of uploads) {
    const rec = cat.assetById.get(ref.id);
    if (!rec) continue;
    const meta: Record<string, unknown> = { ...rec.meta };
    if (tags.length) meta.tags = tags; else delete meta.tags;
    await host.assets._updateUserAssetMeta(ref.id, meta).catch(() => {});
    rec.meta = meta;
  }
  cat.searchHaystack = null;
  cat.sections.rerender();
}
/** Open a single-file OS picker and resolve the chosen File (null if cancelled). */
export function pickOneFile(_cat: CatCtx, accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.cssText = 'position:fixed;left:-9999px;';
    const done = (f: File | null): void => { input.remove(); resolve(f); };
    // 'cancel' (where supported) resolves null; 'change' resolves the file. Clean up either way.
    input.addEventListener('change', () => done(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => done(null), { once: true });
    document.body.appendChild(input);
    input.click();
  });
}
/**
 * Replace the FILE behind one upload, keeping its id - so every saved session, tool and
 * project that references it redrives with the new image (see picker.replaceUserUpload). The
 * confirm states the global reach and the honest limit (already-exported/shared copies keep
 * the old image), and warns when the new file's aspect ratio would reflow existing layouts.
 */
export async function replaceUserAsset(cat: CatCtx, ref: AssetRef): Promise<void> {
  const { host } = cat;
  // Offer only compatible files: still images get the image-only accept; other kinds (audio,
  // video, lottie) fall back to the full accept, with the ingest-time kind guard as backstop.
  const isImageRef = ref.type === 'raster' || ref.type === 'vector';
  const file = await pickOneFile(cat, isImageRef ? REPLACE_IMAGE_ACCEPT : UPLOAD_ACCEPT);
  if (!file || !cat.mounted) return;

  // A materially different aspect ratio reflows layouts sized to the old shape. Best-effort.
  let reflow = false;
  try {
    const nd = await trimmedDimensions(cat, file);
    const ow = Number(ref.width ?? 0), oh = Number(ref.height ?? 0);
    if (nd.width && nd.height && ow > 0 && oh > 0) {
      reflow = Math.abs((nd.width / nd.height) - (ow / oh)) / (ow / oh) > 0.05;
    }
  } catch { /* dimensions are a nicety, not a gate */ }
  if (!cat.mounted) return;

  // Name the blast radius (plans/132 WP-G): the confirm now says HOW MANY
  // saved sessions actually reference this image, not just that some might.
  const uses = await cat.bulk.usedInSessions(ref).catch(() => [] as Array<{ slot: string; label: string }>);
  if (!cat.mounted) return;
  const message = [
    reflow ? t('The new image is a different shape, so layouts sized to the old one may shift.') : '',
    t('The new file replaces this image at the same address, so every saved session, tool and project that uses it shows the new one. Anything you’ve already exported, downloaded or shared keeps the old image.'),
    uses.length ? (uses.length === 1 ? t('It is used in 1 saved session.') : tRaw('It is used in {n} saved sessions.', { n: uses.length })) : '',
  ].filter(Boolean).join(' ');

  const ok = await confirmDialog({ title: t('Replace this image?'), message, confirmLabel: t('Replace'), danger: false });
  if (!ok || !cat.mounted) return;

  // The stored record (bytes included) BEFORE the swap - the undo toast below
  // re-uploads it wholesale if the user changes their mind.
  const prevRecord = (await host.assets._exportUserAssets().catch(() => [] as UserAssetRecordLike[]))
    .find(r => r.id === ref.id) ?? null;
  if (!cat.mounted) return;

  try {
    await replaceUserUpload(host as unknown as Parameters<typeof replaceUserUpload>[0], ref.id, file);
  } catch (err) {
    host.log?.('error', 'Catalog replace failed', { id: ref.id, error: String(err) });
    // Quota / too-large errors carry a user-ready message; everything else gets a plain one.
    announce((err as { code?: unknown }).code ? (err as Error).message : t('Couldn’t replace that image.'), { assertive: true });
    return;
  }
  if (!cat.mounted) return;
  await cat.tiles.reload();          // the record changed under _listUserAssets
  if (!cat.mounted) return;
  cat.sections.rerender();
  announce(t('Image replaced.'));
  if (prevRecord?.blob) {
    showUndoToast({
      message: tRaw('Replaced "{name}".', { name: String(prevRecord.meta?.name ?? ref.id) }),
      undo: async () => {
        try { await host.assets._uploadUserAsset({ ...prevRecord, version: String(Date.now()) }); }
        catch (err) { host.log?.('error', 'Replace undo failed', { id: ref.id, error: String(err) }); return; }
        if (!cat.mounted) return;
        await cat.tiles.reload();
        if (!cat.mounted) return;
        cat.sections.rerender();
        announce(t('Restored the previous image.'));
      },
    });
  }
}
// ── trim margins (plan 97 section 7.3) ─────────────────────────────────────────────────
// The retro-trim of an upload that arrived padded - the same offer the dropzone and
// the asset picker make at ingest, made again later against the STORED bytes. The
// card is the confirmation (section 14.4): nothing is written until the user takes "Trim",
// and what is written replaces the original margins for good.

/**
 * Read the record behind a user upload and measure a trim of its stored bytes.
 * Null = it could not be read at all; `proposal: null` = it was read and there is
 * nothing worth trimming (already tight to its content).
 *
 * The read is `_exportUserAssets` because the bridge exposes no get-one-record
 * call, and `_getBlob` hands back bytes without the metadata a rewrite has to carry
 * forward. It walks the rows, not the pixels - an IndexedDB blob is a file-backed
 * handle - which is what makes it fine on an explicit one-shot action (the storage
 * meter's `_userAssetsSize` takes the same read on every visit).
 */
export async function measureTrim(cat: CatCtx, ref: AssetRef): Promise<{ record: UserAssetRecordLike; proposal: TrimProposal | null } | null> {
  const { host } = cat;
  const { prepareTrim } = await import('../../lib/design-system/trim-offer.ts');
  const record = (await host.assets._exportUserAssets()).find(r => r.id === ref.id);
  if (!record?.blob) return null;
  // A File, not the raw Blob: the measure routes on magic bytes first but falls back
  // to the MIME type and then the name, and a stored blob's type can be blank.
  const name = String(record.meta?.name ?? ref.id.split('/').pop() ?? 'image');
  const file = new File([record.blob], name, { type: record.blob.type || '' });
  return { record, proposal: await prepareTrim(file) };
}
/**
 * The stored dimensions for the bytes a trim actually produced. Measured from the
 * RESULT rather than taken from the proposal: the card's padding stepper may have
 * moved since it was built, and it resolves with a file, not a box. Empty when they
 * can't be read - the record then carries no dimensions rather than the old ones,
 * which after a trim would be a wrong aspect for every tool that reads them.
 */
export async function trimmedDimensions(_cat: CatCtx, file: File): Promise<{ width?: number; height?: number }> {
  if (/svg/i.test(file.type)) {
    const { svgArtboardBox } = await import('../../lib/design-system/trim-offer.ts');
    const box = svgArtboardBox(await file.text().catch(() => ''));
    // User units, so keep the fraction the viewBox rewrite wrote (to 3 places).
    return box ? { width: Math.round(box.width * 1000) / 1000, height: Math.round(box.height * 1000) / 1000 } : {};
  }
  try {
    const bitmap = await createImageBitmap(file);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return dims;
  } catch {
    return {};
  }
}
/**
 * Commit a trim: replace one upload's stored bytes, keeping its id.
 *
 * A read-modify-write in the discipline of the bridge's own `_renameUserAsset` /
 * `_restampUserAsset` - read the record, change only what the trim changed, put it
 * back under the SAME id. `user/…` ids are a permanent contract: sessions, project
 * folders and tool inputs already point at this one, and minting a new id would
 * quietly orphan every one of them. `version` is bumped for the same reason
 * `_restampUserAsset` bumps it: object URLs are cached as `user:<id>:<format>:
 * <version>`, so without it the grid would keep painting the untrimmed bytes.
 *
 * The write goes through `_uploadUserAsset`, the one narrow helper the bridge
 * exposes for a whole record, so the quota guard at that boundary still runs. It
 * measures the WHOLE blob rather than the delta (the caveat `_restampUserAsset`
 * documents) - for a trim that is the safe direction, since the new bytes all but
 * always weigh less than the ones they replace.
 *
 * Carried forward on purpose: `credential` / `credentialFormat` / `aiGenerated`. A
 * trim is a derivative edit, and ingest already keeps a re-encoded upload's original
 * credential so a download can carry it as an ingredient; dropping it here would
 * launder an AI image's disclosure out of the library. `checksum` is the one field
 * deliberately left behind - it describes bytes that no longer exist.
 */
export async function commitTrim(cat: CatCtx, record: UserAssetRecordLike, file: File): Promise<void> {
  const { host } = cat;
  const format = /svg/i.test(file.type) ? 'svg' : /png/i.test(file.type) ? 'png' : record.format;
  const prevName = String(record.meta?.name ?? '');
  const { checksum: _staleChecksum, ...carried } = record;
  const { width, height } = await trimmedDimensions(cat, file);
  await host.assets._uploadUserAsset({
    ...carried,
    // A plain Blob like every other stored record, and a slice rather than a
    // re-wrap so the bytes are viewed, not copied.
    blob: file.slice(0, file.size, file.type),
    format,
    width,
    height,
    version: String(Date.now()),
    meta: {
      ...record.meta,
      // A raster trim re-encodes to PNG, so a "logo.webp" would now be lying about
      // its own bytes - the same honesty ingest keeps with renameExt.
      ...(prevName && format !== record.format ? { name: `${prevName.replace(/\.[^./\\]+$/, '')}.${format}` } : {}),
      bytes: file.size,
    },
  });
}
export function userAssetsOps(cat: CatCtx) {
  return {
    toggleFavourite: bindOp(cat, toggleFavourite),
    setHidden: bindOp(cat, setHidden),
    applyHiddenInPlace: bindOp(cat, applyHiddenInPlace),
    recategorise: bindOp(cat, recategorise),
    softDeleteUploads: bindOp(cat, softDeleteUploads),
    deleteUserAsset: bindOp(cat, deleteUserAsset),
    renameUserAsset: bindOp(cat, renameUserAsset),
    editTags: bindOp(cat, editTags),
    pickOneFile: bindOp(cat, pickOneFile),
    replaceUserAsset: bindOp(cat, replaceUserAsset),
    measureTrim: bindOp(cat, measureTrim),
    trimmedDimensions: bindOp(cat, trimmedDimensions),
    commitTrim: bindOp(cat, commitTrim),
  };
}
