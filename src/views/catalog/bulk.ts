// SPDX-License-Identifier: MPL-2.0
/**
 * catalog: multi-select and the bulk bar actions.
 *
 * Every function takes the shared `cat: CatCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `cat.<module>.<fn>`. Extracted verbatim
 * from mountCatalog() by scripts/split-closure.ts.
 */
import { isHiddenSlot } from '../../lib/batch-slots.ts';
import { pruneSelection as pruneSelectionRule, selectableIds as selectableIdsRule } from '../catalog-filter.ts';
import { t, tRaw } from '../../i18n.ts';
import { showUndoToast } from '../../lib/undo-toast.ts';
import { createFolderStore, folderPath } from '../../folders.ts';
import type { FolderHost } from '../../folders.ts';
import { announce } from '../../a11y.ts';
import { choiceDialog, promptDialog } from '../../components/confirm-dialog.ts';
import { assetBaseId, saveFavouriteAssets, saveHiddenAssets } from '../../lib/asset-favourites.ts';
import { syncBulkBar as syncSharedBulkBar } from '../../lib/bulk-bar.ts';
import { startJob } from '../../lib/jobs.ts';
import { extractC2paStore, verifyC2pa } from '@lolly/engine';
import { STAMPABLE_FORMATS as STAMPABLE } from '../../lib/derived-asset.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { EMPTY_HAYSTACK, downloadName } from './shared.ts';
import { bindOp, type CatCtx } from './context.ts';

// ── selection (user uploads only) ───────────────────────────────────────────────
// The set of currently-selectable ids - exactly the uploads the grid is SHOWING right now.
// The same three filters assetsSectionHtml() builds the uploads section from (visible +
// search + filetype), so "Select all" and pruneSelection() can never reach a tile that
// isn't on screen: an off-screen id in the selection would ride into a bulk delete
// invisibly. (The filetype filter belongs here for the same reason the search does.)
export const selectableIds = (cat: CatCtx): Set<string> => selectableIdsRule(
  cat.filters.visibleAssets(),
  // An empty query short-circuits inside the rule, so hand it an empty index
  // rather than building one nobody will read. Scope 'all': every visible tile
  // is selectable; destructive bulk actions gate per-kind (allSelectedUploads).
  { query: cat.query, haystack: cat.query ? cat.filters.haystack() : EMPTY_HAYSTACK, typeFilter: cat.typeFilter, scope: 'all' },
);
// The uploads section's "Select all" button keeps its uploads-only scope.
export const uploadSelectableIds = (cat: CatCtx): Set<string> => selectableIdsRule(
  cat.filters.visibleAssets(),
  { query: cat.query, haystack: cat.query ? cat.filters.haystack() : EMPTY_HAYSTACK, typeFilter: cat.typeFilter, scope: 'uploads' },
);
export const allSelectedUploads = (cat: CatCtx): boolean =>
  { const { selected } = cat; return selected.size > 0 && [...selected].every(id => cat.assetById.get(id)?.source === 'user'); };
// The single selected upload, or null. Replace (one file → one file) and Rename (one
// asset's name) only make sense on exactly one of the user's own uploads.
export const singleSelectedUploadRef = (cat: CatCtx): AssetRef | null => {
  const { selected } = cat;
  if (selected.size !== 1) return null;
  const ref = cat.assetById.get([...selected][0]!);
  return ref?.source === 'user' ? ref : null;
};
export const allSelectedFav = (cat: CatCtx): boolean =>
  { const { selected } = cat; return selected.size > 0 && [...selected].every(id => cat.favSet.has(assetBaseId(id))); };
export const allSelectedHidden = (cat: CatCtx): boolean =>
  { const { selected } = cat; return selected.size > 0 && [...selected].every(id => cat.hiddenSet.has(assetBaseId(id))); };
// Drop selected ids that are gone (deleted, or filtered out by a search) so the count
// stays honest. Runs at the top of every render().
export function pruneSelection(cat: CatCtx): void {
  const { selected } = cat;
  pruneSelectionRule(selected, selectableIds(cat));
}
export function toggleSelect(cat: CatCtx, id: string): void {
  const { selected, viewEl } = cat;
  if (selected.has(id)) selected.delete(id); else selected.add(id);
  // Update the one tile in place - no full render, so scroll + focus are kept.
  const on = selected.has(id);
  const tile = [...viewEl.querySelectorAll<HTMLElement>('.cat-tile')].find(t => t.dataset.id === id);
  tile?.classList.toggle('is-selected', on);
  tile?.querySelector('.cat-check')?.setAttribute('aria-pressed', String(on));
  syncSelectAll(cat);
  syncBulkBar(cat);
}
export function selectAllUploads(cat: CatCtx): void {
  const { selected, viewEl } = cat;
  const ids = uploadSelectableIds(cat);
  const allSel = ids.size > 0 && [...ids].every(id => selected.has(id));
  if (allSel) for (const id of ids) selected.delete(id);
  else for (const id of ids) selected.add(id);
  // Flip each upload tile's checkbox in place (mirrors toggleSelect) rather than
  // rebuilding the grid - selection never moves a tile between buckets.
  for (const tile of viewEl.querySelectorAll<HTMLElement>('.cat-tile')) {
    const id = tile.dataset.id ?? '';
    if (!ids.has(id)) continue;
    const on = selected.has(id);
    tile.classList.toggle('is-selected', on);
    tile.querySelector('.cat-check')?.setAttribute('aria-pressed', String(on));
  }
  syncSelectAll(cat);
  syncBulkBar(cat);
}
// Keep the "Select all / Deselect all" label + pressed state in sync after a single toggle.
export function syncSelectAll(cat: CatCtx): void {
  const { selected, viewEl } = cat;
  const ids = uploadSelectableIds(cat);
  const allSel = ids.size > 0 && [...ids].every(id => selected.has(id));
  const btn = viewEl.querySelector<HTMLElement>('.cat-uploads-selectall');
  if (btn) { btn.textContent = allSel ? t('Deselect all') : t('Select all'); btn.setAttribute('aria-pressed', String(allSel)); }
}
export const syncBulkBar = (cat: CatCtx): void => { const { bulkBarCfg, viewEl } = cat; syncSharedBulkBar(viewEl, bulkBarCfg); };
export async function ensureSessionTexts(cat: CatCtx): Promise<void> {
  const { host } = cat;
  if (cat.sessionTexts) return;
  if (!cat.sessionTextsLoading) {
    cat.sessionTextsLoading = (async () => {
      const h = host as unknown as { state?: { list?: () => Promise<Array<{ slot: string; label?: string | null; toolId?: string }>>; load?: (slot: string) => Promise<unknown> } };
      const rows = (await h.state?.list?.().catch(() => [])) ?? [];
      const out: Array<{ slot: string; label: string; text: string }> = [];
      for (const row of rows) {
        if (typeof row.slot !== 'string' || isHiddenSlot(row.slot)) continue;
        const data = await h.state?.load?.(row.slot).catch(() => null);
        if (!data) continue;
        try { out.push({ slot: row.slot, label: String(row.label ?? row.toolId ?? row.slot), text: JSON.stringify(data) }); }
        catch { /* unserialisable session - skip */ }
      }
      cat.sessionTexts = out;
    })();
  }
  await cat.sessionTextsLoading;
}
/** Saved sessions whose stored values reference this asset (base-id substring
 *  inside the serialized data - honest as "appears in", not a strict parse). */
export async function usedInSessions(cat: CatCtx, ref: AssetRef): Promise<Array<{ slot: string; label: string }>> {
  await ensureSessionTexts(cat);
  const needle = `"${assetBaseId(ref.id)}`;
  return (cat.sessionTexts ?? []).filter(s2 => s2.text.includes(needle)).map(({ slot, label }) => ({ slot, label }));
}
/**
 * "Add to project…" (plans/132 WP-D): reference the assets into a folder via
 * the SAME store Projects uses - no byte copies (folder image items are refs;
 * the projects reconciler already keeps catalog refs alive). Offers every
 * folder path-labelled, plus creating a new one on the spot.
 */
export async function addToProject(cat: CatCtx, ids: string[]): Promise<void> {
  const { host } = cat;
  if (!ids.length) return;
  const store = createFolderStore(host as unknown as FolderHost);
  const folders = await store.list();
  const pathLabel = (id: string): string => folderPath(folders, id).map(f => f.name).join(' / ');
  const chosen = await choiceDialog({
    title: ids.length === 1 ? t('Add to project') : tRaw('Add {n} assets to project', { n: ids.length }),
    message: t('The assets stay in the Catalog; the project holds a reference.'),
    choices: [
      ...folders.map(f => ({ id: f.id, label: pathLabel(f.id) })),
      { id: '__new__', label: t('New project…'), primary: folders.length === 0 },
    ],
  });
  if (!chosen || !cat.mounted) return;
  let target = chosen;
  if (chosen === '__new__') {
    const name = await promptDialog({ title: t('New project'), message: t('Name the project folder.'), placeholder: t('Project name'), confirmLabel: t('Create') });
    if (!name || !cat.mounted) return;
    try { target = (await store.create(name)).id; }
    catch (err) { announce(String((err as Error).message ?? err), { assertive: true }); return; }
  }
  for (const id of ids) await store.addItem(target, { type: 'image', ref: id }).catch(() => {});
  announce(ids.length === 1 ? t('Added to the project') : tRaw('Added {n} assets to the project', { n: ids.length }));
}
export function handleBulk(cat: CatCtx, action: string): void {
  const { selected, tileSelect, viewEl } = cat;
  if (action === 'clear') {
    // Deselect in place - drop the highlight from every selected tile, no full re-render.
    for (const tile of viewEl.querySelectorAll<HTMLElement>('.cat-tile.is-selected')) {
      tile.classList.remove('is-selected');
      tile.querySelector('.cat-check')?.setAttribute('aria-pressed', 'false');
    }
    selected.clear();
    // The anchor goes with the selection: left behind, it would silently become the far
    // end of the next Shift-click's range, selecting a swathe the user never started.
    tileSelect.resetAnchor();
    syncSelectAll(cat);
    syncBulkBar(cat);
  }
  // The destructive trio is hidden unless the whole selection is uploads; the
  // guard re-checks at dispatch so a selection that changed under a stale menu
  // can never route a catalog asset into a delete.
  else if (action === 'add-to-project') { void addToProject(cat, [...selected]); }
  else if (action === 'delete') { if (allSelectedUploads(cat)) void deleteSelection(cat); }
  else if (action === 'download') { if (allSelectedUploads(cat)) void downloadSelection(cat); }
  else if (action === 'duplicate') { if (allSelectedUploads(cat)) void duplicateSelection(cat); }
  else if (action === 'edit-tags') {
    if (allSelectedUploads(cat)) void cat.userAssets.editTags([...selected].map(id => cat.assetById.get(id)).filter((r): r is AssetRef => !!r));
  }
  // Replace + Rename act on exactly one upload; the guard re-checks at dispatch so a
  // selection that grew under a stale bar can never misroute them.
  else if (action === 'replace') { const r = singleSelectedUploadRef(cat); if (r) void cat.userAssets.replaceUserAsset(r); }
  else if (action === 'rename') { const r = singleSelectedUploadRef(cat); if (r) void cat.userAssets.renameUserAsset(r); }
  else if (action === 'fav') void favouriteSelection(cat);
  else if (action === 'hide') void hideSelection(cat);
}
// Bulk favourite/unfavourite - smart toggle (all starred → unstar all), one
// profile write, tiles + strip reflected in place. Works on ANY selection kind.
export async function favouriteSelection(cat: CatCtx): Promise<void> {
  const { host, selected } = cat;
  if (!selected.size) return;
  const on = !allSelectedFav(cat);
  const bases = new Set([...selected].map(assetBaseId));
  for (const b of bases) { if (on) cat.favSet.add(b); else cat.favSet.delete(b); }
  if (cat.profile) await saveFavouriteAssets(host, cat.profile, cat.favSet);
  if (!cat.mounted) return;
  for (const b of bases) cat.sections.reflectFavInGrid(b, on);
  cat.sections.refreshFavStrip();
  syncBulkBar(cat);
  announce(on ? t('{n} added to favourites', { n: bases.size }) : t('{n} removed from favourites', { n: bases.size }));
}
// Bulk hide/unhide - smart toggle, one profile write, then a full re-render
// (hiding relocates tiles between the category grids and the Hidden section,
// and the selection is cleared with it - the tiles are leaving the view).
export async function hideSelection(cat: CatCtx): Promise<void> {
  const { host, selected, tileSelect } = cat;
  if (!selected.size) return;
  const unhide = allSelectedHidden(cat);
  const bases = new Set([...selected].map(assetBaseId));
  for (const b of bases) { if (unhide) cat.hiddenSet.delete(b); else cat.hiddenSet.add(b); }
  if (cat.profile) await saveHiddenAssets(host, cat.profile, cat.hiddenSet);
  if (!cat.mounted) return;
  selected.clear();
  tileSelect.resetAnchor();
  announce(unhide ? t('{n} unhidden', { n: bases.size }) : t('{n} hidden', { n: bases.size }));
  cat.sections.rerender();
  showUndoToast({
    message: unhide ? tRaw('Unhid {n} assets.', { n: bases.size }) : tRaw('Hid {n} assets.', { n: bases.size }),
    undo: async () => {
      for (const b of bases) { if (unhide) cat.hiddenSet.add(b); else cat.hiddenSet.delete(b); }
      if (cat.profile) await saveHiddenAssets(host, cat.profile, cat.hiddenSet);
      if (cat.mounted) cat.sections.rerender();
    },
  });
}
/**
 * Bulk "Duplicate": a byte-identical copy of every selected upload, then move
 * the selection onto the new copies - so the very next move / edit / download
 * acts on THEM, while the originals stay put and untouched. Copies mint with a
 * fresh, now-stamped id, so they sort to the top of "Your uploads" and land in
 * view (we scroll the first into sight), already highlighted and ready to grab.
 *
 * The copy loop is a background JOB (progress + cancel in the global job toast),
 * so an N-image run neither hides its progress nor dies with the view. heavy:
 * false - byte copies through the asset store, no inference. Cancel is
 * cooperative (_duplicateUserAsset has no abort): the copies already made are
 * kept and announced, since they exist in the library either way.
 */
export async function duplicateSelection(cat: CatCtx): Promise<void> {
  const { host, selected, tileSelect, viewEl } = cat;
  const ids = [...selected];
  if (!ids.length) return;
  const job = startJob({
    title: t('Duplicating images'),
    heavy: false,
    cancel: () => { /* cooperative - the loop polls job.cancelled between copies */ },
  });
  const newIds: string[] = [];
  for (const id of ids) {
    if (job.cancelled) break;
    job.progress(newIds.length, ids.length);
    try {
      const newId = await host.assets._duplicateUserAsset(id);
      if (newId) newIds.push(newId);
    } catch (err) {
      host.log?.('warn', 'Catalog bulk duplicate: member skipped', { id, error: String(err) });
    }
  }
  job.progress(newIds.length, ids.length);
  job.finish();
  if (!newIds.length) return;
  // Announce first: the copies are made whether or not this view is still up, and
  // the live region is body-level, so the count is announced after a navigation too.
  announce(newIds.length === 1 ? t('1 copy made · selected') : t('{n} copies made · selected', { n: newIds.length }));
  if (!cat.mounted) return;
  await cat.tiles.reload();                     // pull the new copies into allAssets / assetById
  if (!cat.mounted) return;
  // Hand the selection to the copies (not the originals). render()'s pruneSelection
  // keeps only ids that are present + selectable, so a copy filtered out by an
  // active search simply drops from the selection - the visible ones stay selected.
  selected.clear();
  tileSelect.resetAnchor();           // the originals are no longer the selection's origin
  for (const newId of newIds) selected.add(newId);
  cat.sections.render();
  // Bring the first new copy into view so "the copies appeared" is visible, not
  // just a count in the bar - nearest, so it doesn't jump when already on screen.
  viewEl.querySelector<HTMLElement>('.cat-tile.is-selected')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
/**
 * The byte payload a download of `ref` should carry - byte-exact, EXCEPT a user
 * upload whose ingest captured a credential store: its stored bytes were
 * re-encoded (credential no longer inside), so wrap them in a Lolly manifest
 * that opens the original as an ingredient. Same rule as directDownload's
 * single save - keep the two in step.
 */
export async function credentialedBytes(cat: CatCtx, ref: AssetRef): Promise<Blob> {
  const { host } = cat;
  const format = String(ref.format || 'bin');
  if (ref.id.startsWith('user/') && STAMPABLE.has(format)) {
    try {
      const ingredients = await cat.downloads.sourceIngredients(ref);
      if (ingredients) {
        const blob = await (await fetch(ref.url)).blob();
        const { stampDerivedC2pa } = await import('../../bridge/export.ts');
        return await stampDerivedC2pa(host, blob, format, {
          title: String(ref.meta?.name ?? ref.id),
          actions: [{ action: 'c2pa.converted', description: `Re-encoded to ${format.toUpperCase()} when added to the device library` }],
          ingredients,
          inputs: { asset: ref.id },
          ...(ref.width && ref.height ? { dimensions: `${ref.width}×${ref.height}` } : {}),
        });
      }
    } catch { /* fall through to the byte-exact bytes */ }
  }
  return await (await fetch(ref.url)).blob();
}
// Bulk "Download": the whole selection in ONE zip (optionally password-locked,
// same prompt as every batch export), each member's Content Credentials checked
// with the engine verifier so the announcement is honest about what it carries.
//
// The fetch/verify loop and the zip are a background JOB, so a big selection shows
// progress and cancels from the global job toast. heavy: false - network reads plus
// a deflate, no inference. Cancel stops between members; a cancel BEFORE the zip
// delivers nothing (a partial archive the user stopped is not what they asked for).
// Delivery deliberately ignores `mounted`: saveBlob is a browser download and the
// live region is body-level, so leaving the catalog mid-run no longer loses the zip.
export async function downloadSelection(cat: CatCtx): Promise<void> {
  const { host, selected } = cat;
  const refs = [...selected].map(id => cat.assetById.get(id)).filter((r): r is AssetRef => !!r);
  if (!refs.length) return;
  const { askExportLock } = await import('../../lib/export-lock.ts');
  const { ok, strongPassword, zipLock } = await askExportLock(refs.length === 1 ? t('1 selected image') : t('{n} selected images', { n: refs.length }), true);
  if (!ok || !cat.mounted) return;
  const job = startJob({
    title: t('Zipping images'),
    heavy: false,
    cancel: () => { /* cooperative - the loop polls job.cancelled between members */ },
  });
  const files: { name: string; blob: Blob }[] = [];
  const names = new Set<string>();
  let credentialed = 0;
  for (const ref of refs) {
    if (job.cancelled) return;
    job.progress(files.length, refs.length);
    try {
      const blob = await credentialedBytes(cat, ref);
      try {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (extractC2paStore(bytes) && (await verifyC2pa(bytes)).found) credentialed++;
      } catch { /* the check is advisory - never blocks the zip */ }
      const orig = downloadName(ref, String(ref.format || 'bin'));
      let name = orig;
      for (let n = 2; names.has(name); n++) {
        name = orig.includes('.') ? orig.replace(/(\.[^.]+)$/, ` (${n})$1`) : `${orig} (${n})`;
      }
      names.add(name);
      files.push({ name, blob });
    } catch (err) {
      host.log?.('warn', 'Catalog bulk download: member skipped', { id: ref.id, error: String(err) });
    }
  }
  if (!files.length) { job.finish(); return; }
  job.progress(files.length, refs.length);
  const { buildZip, saveBlob } = await import('../../pro/zip.ts');
  let zip: Blob;
  try {
    zip = await buildZip(files, { zipName: 'lolly-images', zipLock, password: strongPassword });
  } catch (err) {
    job.fail(err);
    throw err;
  }
  await saveBlob(zip, 'lolly-images.zip');
  job.finish();
  announce(files.length === 1
    ? t('1 image zipped · {c} with Content Credentials', { c: credentialed })
    : t('{n} images zipped · {c} with Content Credentials', { n: files.length, c: credentialed }));
}
export async function deleteSelection(cat: CatCtx): Promise<void> {
  const { selected, tileSelect } = cat;
  const refs = [...selected].map(id => cat.assetById.get(id)).filter((r): r is AssetRef => !!r);
  if (!refs.length) return;
  selected.clear();
  tileSelect.resetAnchor();           // the anchor was almost certainly one of the deleted
  cat.userAssets.softDeleteUploads(refs);
}
export function bulkOps(cat: CatCtx) {
  return {
    selectableIds: bindOp(cat, selectableIds),
    uploadSelectableIds: bindOp(cat, uploadSelectableIds),
    allSelectedUploads: bindOp(cat, allSelectedUploads),
    singleSelectedUploadRef: bindOp(cat, singleSelectedUploadRef),
    allSelectedFav: bindOp(cat, allSelectedFav),
    allSelectedHidden: bindOp(cat, allSelectedHidden),
    pruneSelection: bindOp(cat, pruneSelection),
    toggleSelect: bindOp(cat, toggleSelect),
    selectAllUploads: bindOp(cat, selectAllUploads),
    syncSelectAll: bindOp(cat, syncSelectAll),
    syncBulkBar: bindOp(cat, syncBulkBar),
    ensureSessionTexts: bindOp(cat, ensureSessionTexts),
    usedInSessions: bindOp(cat, usedInSessions),
    addToProject: bindOp(cat, addToProject),
    handleBulk: bindOp(cat, handleBulk),
    favouriteSelection: bindOp(cat, favouriteSelection),
    hideSelection: bindOp(cat, hideSelection),
    duplicateSelection: bindOp(cat, duplicateSelection),
    credentialedBytes: bindOp(cat, credentialedBytes),
    downloadSelection: bindOp(cat, downloadSelection),
    deleteSelection: bindOp(cat, deleteSelection),
  };
}
