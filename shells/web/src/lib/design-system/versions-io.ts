// SPDX-License-Identifier: MPL-2.0
/**
 * versions-io.ts - publishing, activating and restoring design-system versions
 * (plans/97 section 6a). The Versions panel's whole vocabulary, with no DOM in it.
 *
 * The rules this module exists to hold in one place:
 *   - **The bytes go through the chokepoint.** Nothing here writes an asset
 *     itself: a version payload goes to `installUserTokens` with an explicit
 *     `versionSlug`, which is where immutability is enforced, and the head
 *     document goes through the caller's `install` (the studio's undo stack) or
 *     the same chokepoint by default.
 *   - **Order matters.** The version ASSET is written before the ledger entry.
 *     Interrupted the other way round, the ledger would name a version nothing
 *     can load; interrupted this way it leaves an orphan asset, which the next
 *     publish of that name is free to reclaim (bridge/tokens.ts says so too).
 *   - **A version stores no ledger.** The list belongs to the head; a copy of it
 *     inside a version would be a second, instantly-stale source of truth.
 *   - **Publishing copies no bytes.** The asset manifest records `{id, version,
 *     sha256}`; the copy-on-write hook in bridge/version-assets.ts preserves the
 *     bytes if and when something would destroy them.
 *
 * Scope: WRITES are always the user's own design system (the active record's
 * head and its siblings) - the thing the studio edits and publishes; this never
 * writes a pack's namespace. READS are relative to whatever head the bridge
 * discovered, because a device whose system came from a pack has a
 * `<ns>/tokens/brand` head with its versions beside it, and reading those under
 * the user id would report every one of them as missing.
 *
 * DOM-free like studio-state.ts, so it runs under plain node in tests.
 */

import type { HostV1 } from '@lolly-tools/core/host-v1';
import { installUserTokens } from '../../bridge/tokens.ts';
import { activeHeadId } from './active.ts';
// User-facing throws: these reach a person through the panel, so they are chrome
// strings. t() (not tRaw) with no params is the brand-logos.ts precedent.
import { t } from '../../i18n.ts';
import type { WebTokensAPI } from '../../bridge/tokens.ts';
import { FROZEN_PREFIX } from '../../bridge/version-assets.ts';
import {
  collectAssetTokens, collectFontFamilies, docChecksum, diffTokenDocs, readVersionIndex,
  sha256Hex, slugifyVersion, stripVersionIndex, versionAssetId, withVersionIndex,
} from './versions.ts';
import type { PinnedAsset, VersionEntry, VersionIndex } from './versions.ts';

/** What the studio hands this module: a host, and how to write the head. */
export interface VersionsIoCtx {
  host: HostV1;
  /**
   * Head-document writer. The panel passes `studio.install` so publish, activate
   * and restore all land on the undo stack and repaint chrome; the default is the
   * bridge chokepoint directly, which is what tests and headless callers get.
   */
  install?: (doc: unknown, action: string) => Promise<void>;
  /** Asset label recorded with head writes (the bridge default when absent). */
  label?: string;
}

/** The asset-store reads this module needs beyond the public HostV1 surface. */
interface VersionAssets {
  _getBlob(id: string): Promise<Blob | null>;
  _getUserRecord?(id: string): Promise<{
    id: string; type: string; blob?: Blob; version?: string; meta?: Record<string, unknown>;
  } | null>;
  _exportUserAssets?(): Promise<Array<{
    id: string; type: string; blob?: Blob; version?: string; meta?: Record<string, unknown>;
  }>>;
}

const assetsOf = (ctx: VersionsIoCtx): VersionAssets => ctx.host.assets as unknown as VersionAssets;
const tokensOf = (ctx: VersionsIoCtx): WebTokensAPI | undefined =>
  ctx.host.tokens as unknown as WebTokensAPI | undefined;

/**
 * The asset id the head document was DISCOVERED at, which is not always the head
 * this module writes to.
 *
 * A version is addressed relative to its head (`<headId>/<slug>`), and a device
 * whose design system came from a pack has a `<ns>/tokens/brand` head with its
 * versions shipped alongside it. Addressing them under the user id instead makes
 * every read here return null while the panel happily lists them: restore says
 * "that version could not be read", the compat card diffs against nothing and
 * calls the whole system `added`, and the storage line reports zero bytes.
 *
 * Falls back to the active design system's head when the bridge cannot say (a
 * partial test host, an unreachable store) - that is where this module's own
 * writes go (plans/186 section 3.3).
 */
async function headId(ctx: VersionsIoCtx): Promise<string> {
  try { return (await tokensOf(ctx)?.headId?.()) || await activeHeadId(ctx.host); }
  catch { return activeHeadId(ctx.host); }
}

/**
 * The ids one published version could live at, in the order worth trying: under
 * the head it was discovered relative to, then under the head this module writes
 * to.
 *
 * Both, because a publish MIGRATES the head. A studio whose system came from a
 * pack publishes into `<write head>/<slug>` and writes the ledger to that head,
 * so from the next read on the discovered head is the write head while the
 * pack's own earlier versions still sit under the pack namespace.
 */
async function versionIdsOf(ctx: VersionsIoCtx, slug: string): Promise<string[]> {
  const [head, writeHead] = await Promise.all([headId(ctx), activeHeadId(ctx.host)]);
  // One id whenever the two agree, which is every device with a single design
  // system; the second read only exists for the pack case above.
  const ids = head === writeHead ? [head] : [head, writeHead];
  return ids.map(id => versionAssetId(id, slug));
}

/** One published version's stored bytes, wherever they are (see versionIdsOf). */
async function readVersionBlob(ctx: VersionsIoCtx, slug: string): Promise<Blob | null> {
  const assets = assetsOf(ctx);
  for (const id of await versionIdsOf(ctx, slug)) {
    const blob = await assets._getBlob(id).catch(() => null);
    if (blob) return blob;
  }
  return null;
}

/** A DTCG document is a plain object - the shape installUserTokens accepts. */
const isDoc = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

async function writeHead(ctx: VersionsIoCtx, doc: unknown, action: string): Promise<void> {
  if (ctx.install) { await ctx.install(doc, action); return; }
  await installUserTokens(
    ctx.host as unknown as Parameters<typeof installUserTokens>[0],
    doc,
    ctx.label ? { label: ctx.label } : {},
  );
}

/** The head document the studio is editing, or null when none is reachable. */
export async function readHeadDoc(ctx: VersionsIoCtx): Promise<unknown> {
  return (await tokensOf(ctx)?.raw?.().catch(() => null)) ?? null;
}

/** The published-version ledger the head carries (empty when nothing published). */
export async function readIndex(ctx: VersionsIoCtx): Promise<VersionIndex> {
  return readVersionIndex(await readHeadDoc(ctx));
}

/**
 * One published version's stored document, or null.
 *
 * The payload EXACTLY as published - asset tokens still name their original ids,
 * not the frozen copies. Rendering applies the pins (bridge/tokens.ts forVersion);
 * a caller reading the document is reading history, and rewriting it here would
 * hide what the version actually said.
 */
export async function readVersionDoc(ctx: VersionsIoCtx, slug: string): Promise<unknown> {
  const blob = await readVersionBlob(ctx, slug);
  if (!blob) return null;
  try { return JSON.parse(await blob.text()); } catch { return null; }
}

/**
 * Every asset `doc` names, as the pins a version records: `{id, version, sha256}`.
 *
 * Two rails, one list, and they are NOT worth the same. `$type: 'asset'` leaves
 * give ids directly (today's logos), and those pins are required: the render
 * path rewrites them to preserved bytes (`applyPinnedAssets`), so the version
 * keeps drawing the image it was published with. `$type: 'fontFamily'` leaves
 * give family NAMES, and every stored face whose `meta.family` matches - case-
 * insensitively, mirroring the font registry's own lookup - contributes a pin
 * that is a RECORD ONLY: nothing resolves a face through an asset id, so a font
 * pin says what the version used (and lets the compat card name a replacement)
 * but does not freeze it. bridge/version-assets.ts skips fonts for exactly that
 * reason, rather than charging a user's storage for bytes nothing can read; the
 * panel's storage copy says which of the two a version actually guarantees.
 *
 * A token naming an id this device does not have is skipped - a dangling token is
 * not a pin, and inventing a checksum for absent bytes would make the manifest
 * lie. A record with no `version` records `0.0.0`: the logo installer writes none
 * today, and recording what is actually there beats inventing a bump.
 *
 * De-duped by id and sorted by id, so two publishes of the same system produce
 * byte-identical manifests and a diff of them means something.
 */
export async function buildAssetManifest(ctx: VersionsIoCtx, doc: unknown): Promise<PinnedAsset[]> {
  const assets = assetsOf(ctx);
  const byId = new Map<string, PinnedAsset>();
  const pin = async (
    rec: { id: string; blob?: Blob; version?: string },
  ): Promise<void> => {
    if (!rec.blob || byId.has(rec.id)) return;
    const sha256 = await sha256Hex(new Uint8Array(await rec.blob.arrayBuffer()));
    byId.set(rec.id, { id: rec.id, version: rec.version ?? '0.0.0', sha256 });
  };

  for (const { id } of collectAssetTokens(doc)) {
    if (byId.has(id)) continue;
    const rec = await assets._getUserRecord?.(id).catch(() => null);
    if (rec) await pin(rec);
  }

  const families = collectFontFamilies(doc).map(f => f.toLowerCase());
  if (families.length && assets._exportUserAssets) {
    const wanted = new Set(families);
    for (const rec of await assets._exportUserAssets().catch(() => [])) {
      if (rec.type !== 'font') continue;
      const family = String(rec.meta?.family ?? '').trim().toLowerCase();
      if (!family || !wanted.has(family)) continue;
      await pin(rec);
    }
  }

  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Publish the head as a permanent, named version.
 *
 * Throws a sentence a person can read: this is called straight from a button.
 * The version asset lands first, then the head's ledger - see the module header
 * for why that order is the safe one.
 */
export async function publishVersion(
  ctx: VersionsIoCtx, o: { label: string; note?: string; activate?: boolean },
): Promise<VersionEntry> {
  const head = await readHeadDoc(ctx);
  if (!isDoc(head)) throw new Error(t('There is nothing to publish yet.'));
  const slug = slugifyVersion(o.label);
  if (!slug) throw new Error(t('Give the version a name using letters or numbers.'));
  const index = readVersionIndex(head);
  if (index.versions.some(v => v.slug === slug)) {
    throw new Error(t('That name is already used. Version names are permanent, so pick another.'));
  }

  const payload = stripVersionIndex(head);
  const checksum = await docChecksum(payload);
  const assets = await buildAssetManifest(ctx, payload);

  await installUserTokens(
    ctx.host as unknown as Parameters<typeof installUserTokens>[0],
    payload,
    { label: o.label, versionSlug: slug, allowVersionWrite: true },
  );

  const note = o.note?.trim();
  const entry: VersionEntry = {
    slug,
    label: o.label,
    date: new Date().toISOString(),
    ...(note ? { note } : {}),
    checksum,
    ...(assets.length ? { assets } : {}),
  };
  await writeHead(
    ctx,
    withVersionIndex(head, {
      versions: [...index.versions, entry],
      active: o.activate ? slug : index.active,
    }),
    'publish-version',
  );
  return entry;
}

/**
 * Set (or clear) the version tools and chrome resolve against.
 *
 * `null` means "follow the latest again": the head goes live everywhere, which
 * is the state every system starts in. An unknown slug is refused rather than
 * stored - a dangling active would quietly fall through the ladder and look like
 * the setting had not taken.
 */
export async function setActiveVersion(ctx: VersionsIoCtx, slug: string | null): Promise<void> {
  const head = await readHeadDoc(ctx);
  if (!isDoc(head)) throw new Error(t('There is no design system to change yet.'));
  const index = readVersionIndex(head);
  if (slug && !index.versions.some(v => v.slug === slug)) {
    throw new Error(t('That version is not on this device.'));
  }
  if (index.active === slug) return; // nothing to write, so nothing to undo
  await writeHead(ctx, withVersionIndex(head, { versions: index.versions, active: slug }), 'activate-version');
}

/**
 * Copy a published version back over the edit head. False when the version's
 * document cannot be read.
 *
 * The LEDGER is carried across verbatim: restoring is an edit to the head, not a
 * rewriting of history, and a restore that erased the version list would delete
 * the very thing it restored from. Asset tokens keep their original ids (see
 * readVersionDoc), so the restored head references the files the user manages
 * rather than the hidden frozen copies - the version itself still renders its own
 * preserved bytes. Undo is the studio's, one step.
 */
export async function restoreLatestFrom(ctx: VersionsIoCtx, slug: string): Promise<boolean> {
  const head = await readHeadDoc(ctx);
  const doc = await readVersionDoc(ctx, slug);
  if (!isDoc(doc)) return false;
  await writeHead(ctx, withVersionIndex(doc, readVersionIndex(head)), 'restore-version');
  return true;
}

/**
 * Whether the head has moved on from the active version, and by how much - the
 * "Editing ahead of {label}" banner. With nothing active there is nothing to be
 * ahead OF: the head is live everywhere, so `ahead` is false by definition.
 */
export async function headAhead(
  ctx: VersionsIoCtx,
): Promise<{ slug: string | null; label: string; ahead: boolean; changes: number }> {
  const head = await readHeadDoc(ctx);
  const index = readVersionIndex(head);
  const entry = index.active ? index.versions.find(v => v.slug === index.active) : undefined;
  if (!entry) return { slug: null, label: '', ahead: false, changes: 0 };
  const payload = stripVersionIndex(head);
  const ahead = (await docChecksum(payload)) !== entry.checksum;
  if (!ahead) return { slug: entry.slug, label: entry.label, ahead: false, changes: 0 };
  const before = await readVersionDoc(ctx, entry.slug);
  const diff = diffTokenDocs(before, payload);
  return {
    slug: entry.slug,
    label: entry.label,
    ahead: true,
    changes: diff.added.length + diff.changed.length + diff.removed.length,
  };
}

/**
 * What publishing under `label` would produce, for the panel's compat card:
 * whether the name is usable and free, the token diff against the version this
 * one succeeds, and which pinned assets changed.
 *
 * The baseline is the ACTIVE version, else the most recent one, else nothing at
 * all - a first publish honestly reads as "everything added". `removed` is the
 * breaking set and the panel says so.
 */
export async function publishPreview(ctx: VersionsIoCtx, label: string): Promise<{
  slug: string | null;
  taken: boolean;
  diff: { added: string[]; changed: string[]; removed: string[] };
  assetChanges: Array<{ id: string; kind: 'added' | 'replaced' | 'removed' }>;
}> {
  const head = await readHeadDoc(ctx);
  const index = readVersionIndex(head);
  const slug = slugifyVersion(label);
  const taken = !!slug && index.versions.some(v => v.slug === slug);

  const baseline = (index.active ? index.versions.find(v => v.slug === index.active) : undefined)
    ?? index.versions[index.versions.length - 1];
  const payload = stripVersionIndex(head);
  const before = baseline ? await readVersionDoc(ctx, baseline.slug) : null;
  const diff = diffTokenDocs(before, payload);

  const next = await buildAssetManifest(ctx, payload);
  const prev = baseline?.assets ?? [];
  const prevById = new Map(prev.map(p => [p.id, p]));
  const nextById = new Map(next.map(p => [p.id, p]));
  const assetChanges: Array<{ id: string; kind: 'added' | 'replaced' | 'removed' }> = [];
  for (const p of next) {
    const was = prevById.get(p.id);
    if (!was) assetChanges.push({ id: p.id, kind: 'added' });
    else if (was.sha256 !== p.sha256) assetChanges.push({ id: p.id, kind: 'replaced' });
  }
  for (const p of prev) if (!nextById.has(p.id)) assetChanges.push({ id: p.id, kind: 'removed' });
  assetChanges.sort((a, b) => a.id.localeCompare(b.id));

  return { slug, taken, diff, assetChanges };
}

/**
 * What versioning is costing on this device: published versions, preserved files
 * and their bytes. The panel states it plainly, because none of it can be
 * deleted in v1 and a user is owed that before they publish, not after.
 */
export async function versionStorage(
  ctx: VersionsIoCtx,
): Promise<{ versions: number; frozen: number; bytes: number }> {
  const assets = assetsOf(ctx);
  const index = await readIndex(ctx);
  let bytes = 0;
  for (const entry of index.versions) {
    bytes += (await readVersionBlob(ctx, entry.slug))?.size ?? 0;
  }
  let frozen = 0;
  // The frozen rows are hidden from _listUserAssets on purpose, so the honest
  // total comes from the backup view - the one listing that still sees them.
  for (const rec of await assets._exportUserAssets?.().catch(() => []) ?? []) {
    if (!rec.id.startsWith(FROZEN_PREFIX)) continue;
    frozen++;
    bytes += rec.blob?.size ?? 0;
  }
  return { versions: index.versions.length, frozen, bytes };
}
