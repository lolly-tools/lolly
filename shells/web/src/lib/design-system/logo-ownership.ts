// SPDX-License-Identifier: MPL-2.0
/**
 * logo-ownership.ts - every design system draws its logos from its OWN rows
 * (plans/186 section 3.2).
 *
 * Before this, an upload in the Logos room was always stored at the legacy
 * `user/logo/<slot>` whatever system was active, and only the active system's
 * tokens recorded the upload. Two systems that filled the same slot therefore pointed at
 * ONE row: the second upload replaced the first system's bytes, and the first
 * system then drew the second system's logo on screen and in every export.
 * Uploads now land in the active system's namespace (lib/brand-logos.ts), which
 * stops new sharing; this module repairs the sharing a device already has.
 *
 * The rule: a named system whose head document references a logo row in another
 * system's namespace gets its own copy of those bytes, under its own namespace,
 * and its head is rewritten to reference the copy. Nothing else moves:
 *   - the source rows stay where they are, so a published version that pinned
 *     one keeps resolving, and the default system keeps its legacy ids;
 *   - published versions and their version list are not rewritten (the list
 *     records each pin under `id`, and the reference walk only rewrites
 *     `$value`s);
 *   - where two systems already point at the same row, each gets a copy of the
 *     CURRENT bytes: which system's upload those bytes were is not recorded
 *     anywhere, so there is nothing to tell them apart by.
 *
 * The pass NEVER replaces bytes. A copy goes to the slot's own id when that id
 * is free (or already holds the same bytes); when the system's own row for the
 * slot holds something else - its newer mark, kept by a version or by the undo
 * of a restore - the copy goes to a content-keyed sibling id instead
 * (`<slot>-<sha8>`, flagged `meta.kept`), and if even that is taken by other
 * bytes the reference is left where it is. So no row the pass touches can lose
 * bytes a version, a checkpoint or another reference still needs.
 *
 * It is idempotent by construction: once a head references only its own rows,
 * a second pass finds nothing to move and writes nothing. It runs where the
 * answer matters and nowhere else - before the Logos room lists or writes a
 * mark, before a brand pack is exported, when a system is created as a copy of
 * another, and before a system is removed - so a device that never opens the
 * Logos room pays nothing for the repair. A head already known to borrow
 * nothing is recognised by its stored checksum and not parsed again.
 *
 * DOM-free. The copies go through the asset bridge's upload path (quota and
 * history included) and the head through installUserTokens.
 */
import {
  DEFAULT_DESIGN_SYSTEM_ID, SHIPPED_DESIGN_SYSTEM_ID, designMaterialOf, isDesignSystemId,
} from '../../../../../engine/src/design-system.ts';
import { readVersionIndex, sha256Hex } from '../../../../../engine/src/design-version.ts';
import { installUserTokens } from '../../bridge/tokens.ts';
import { rehomeMaterialId, rewriteAssetRefs } from './namespace.ts';
import type { DesignSystemRecord, DesignSystemRegistry } from './registry.ts';

/** The slice of the web host this pass drives. */
export interface LogoOwnershipHost {
  designSystems?: DesignSystemRegistry;
  assets: {
    _getBlob(id: string): Promise<Blob | null>;
    _getUserRecord?(id: string): Promise<{
      type?: string; format?: string; meta?: Record<string, unknown>; trashedAt?: string;
      /** SHA-256 of the stored bytes, written by the asset history on every write. */
      checksum?: string;
    } | null>;
    /** Writes the logo copies and, through installUserTokens, the head. */
    _uploadUserAsset(record: {
      id: string; type: 'tokens' | 'vector' | 'raster'; format: string; blob: Blob; version?: string; meta?: Record<string, unknown>;
    }): Promise<void>;
  };
  tokens?: { bust?(): void };
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

async function readJson(blob: Blob | null): Promise<unknown> {
  if (!blob) return null;
  try { return JSON.parse(await blob.text()); } catch { return null; }
}

async function sameBytes(a: Blob, b: Blob): Promise<boolean> {
  if (a.size !== b.size) return false;
  const [x, y] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]);
  const u = new Uint8Array(x);
  const v = new Uint8Array(y);
  for (let i = 0; i < u.length; i++) if (u[i] !== v[i]) return false;
  return true;
}

/** The format a copy records when the source row does not say: the same four
 *  the Logos room accepts. */
function formatOf(blob: Blob): string {
  return blob.type.includes('svg') ? 'svg'
    : blob.type.includes('jpeg') ? 'jpg'
      : blob.type.includes('webp') ? 'webp' : 'png';
}

/** Every string a document names under `$value`, the same walk the rewrite uses. */
function valuesOf(doc: unknown): Set<string> {
  const out = new Set<string>();
  rewriteAssetRefs(doc, (id) => { out.add(id); return id; });
  return out;
}

// ── One head write at a time ──────────────────────────────────────────────────

// The Logos room, the brand studio's save and this pass each read the stored
// head, change part of it and write it back. Run in parallel, the later write
// is built on a copy that predates the earlier one and silently drops it, so
// every such read-modify-write in this document goes through one queue.
let headQueue: Promise<unknown> = Promise.resolve();

/** Run one read-modify-write of a design system's head after every earlier one
 *  has finished. The queue carries on whether `fn` succeeds or fails. */
export function withLogoHeadLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = headQueue.then(fn, fn);
  headQueue = run.catch(() => undefined);
  return run;
}

// ── The repair pass ───────────────────────────────────────────────────────────

/** Heads known to reference no other system's logo row, by the checksum of
 *  their stored bytes. Borrowing is a property of the document's content alone,
 *  so a head whose bytes have not changed since it was found clean is still
 *  clean, and any write to it changes the checksum and forces a fresh look. */
const cleanHeads = new Map<string, string>();

/** The id a kept copy goes to when the slot's own id already holds other bytes:
 *  the same slot, suffixed with the copy's content key, still a valid slug. */
function keptId(to: string, sha: string): string {
  return to.replace(/[^/]+$/, seg => `${seg.slice(0, 31)}-${sha.slice(0, 8)}`);
}

/**
 * Give ONE system its own copy of every logo its head borrows from another
 * system's namespace, and point its head at the copies. Returns how many
 * references moved.
 *
 * Only named systems take part: the default system keeps its legacy `user/logo`
 * ids forever (saved sessions reference them), and the shipped system has no
 * user namespace to copy into. A reference whose row is gone, or in the Trash,
 * is left as it is; a copy that fails (a full disk) leaves that one reference
 * on its old row, and the next pass tries again.
 */
export async function ownLogosOf(
  host: LogoOwnershipHost, record: Pick<DesignSystemRecord, 'id' | 'headId'>,
): Promise<number> {
  if (record.id === DEFAULT_DESIGN_SYSTEM_ID || record.id === SHIPPED_DESIGN_SYSTEM_ID) return 0;
  if (!isDesignSystemId(record.id) || !record.headId) return 0;
  const assets = host.assets;
  const fingerprint = async (): Promise<string | null> => {
    const checksum = (await assets._getUserRecord?.(record.headId).catch(() => null))?.checksum;
    return typeof checksum === 'string' && checksum ? checksum : null;
  };
  const before = await fingerprint();
  if (before && cleanHeads.get(record.headId) === before) return 0;
  const head = await readJson(await assets._getBlob(record.headId).catch(() => null));
  if (!isRec(head)) return 0;

  const borrowed = [...valuesOf(head)].filter((id) => {
    const material = designMaterialOf(id);
    return material?.kind === 'logo' && material.systemId !== record.id;
  });
  if (!borrowed.length) {
    if (before) cleanHeads.set(record.headId, before);
    return 0;
  }

  const moved = new Map<string, string>();
  for (const from of borrowed) {
    const to = rehomeMaterialId(from, record.id);
    if (!to) continue;
    try {
      const source = await assets._getUserRecord?.(from).catch(() => null) ?? null;
      if (source?.trashedAt) continue;
      const blob = await assets._getBlob(from).catch(() => null);
      if (!blob) continue;
      // The slot's own id when it is free or already holds these bytes; else a
      // kept sibling. Bytes already at an id are never replaced (see header).
      let target: string | null = null;
      let flag = false;
      const own = await assets._getBlob(to).catch(() => null);
      if (!own || await sameBytes(own, blob)) target = to;
      else {
        const alt = keptId(to, await sha256Hex(new Uint8Array(await blob.arrayBuffer())));
        const taken = await assets._getBlob(alt).catch(() => null);
        if (!taken || await sameBytes(taken, blob)) { target = alt; flag = true; }
      }
      if (!target) continue;
      // A copy already in place (an earlier pass whose head write was lost) is
      // not written again: a second write of the same bytes would only add a
      // saved version of them to the asset's history.
      if (!(await assets._getBlob(target).catch(() => null))) {
        const format = typeof source?.format === 'string' && source.format ? source.format : formatOf(blob);
        const type = source?.type === 'vector' || source?.type === 'raster' ? source.type : (format === 'svg' ? 'vector' : 'raster');
        await assets._uploadUserAsset({
          id: target, type, format, blob,
          meta: { ...(source?.meta ?? {}), kind: 'logo', ...(flag ? { kept: true } : {}) },
        });
      }
      moved.set(from, target);
    } catch { /* this reference keeps its old row until the next pass */ }
  }
  if (!moved.size) return 0;

  // Re-read the head now, under the head lock, and rewrite THAT document. The
  // copies above go through the upload path, whose pin preservation can write
  // this head's version list in the meantime, and the studio's own save can
  // land here too; writing the copy read before them would erase their work.
  await withLogoHeadLock(async () => {
    const fresh = await readJson(await assets._getBlob(record.headId).catch(() => null));
    if (!isRec(fresh)) return;
    // Named, so the write goes to THIS system whichever one is active, and a
    // locked system (a subscribed one) can still be repaired: nothing it draws
    // changes, only which row the same bytes are read from.
    await installUserTokens(
      { assets, designSystems: host.designSystems },
      rewriteAssetRefs(fresh, id => moved.get(id) ?? id),
      { system: record.id },
    );
  });
  host.tokens?.bust?.();
  return moved.size;
}

// One pass at a time in this document. Two surfaces can ask at once (the Logos
// room and the Overview both list logos), and two concurrent passes would both
// copy the same bytes before either rewrote a head.
let passQueue: Promise<unknown> = Promise.resolve();

/**
 * Run {@link ownLogosOf} for every named system on the device. `skip` leaves one
 * system out (the one about to be removed has no use for copies). Returns how
 * many references moved in all; never rejects, since every caller is on its way
 * to something the person asked for and a repair that could not finish now is
 * simply tried again next time.
 */
export function ensureOwnLogos(host: LogoOwnershipHost, opts: { skip?: string } = {}): Promise<number> {
  const run = passQueue.then(async () => {
    const registry = host.designSystems;
    if (!registry) return 0;
    const records = await registry.list().catch(() => [] as DesignSystemRecord[]);
    let moved = 0;
    for (const record of records) {
      if (record.id === opts.skip) continue;
      try { moved += await ownLogosOf(host, record); } catch { /* the next pass tries again */ }
    }
    return moved;
  });
  passQueue = run.catch(() => 0);
  return run.catch(() => 0);
}

/**
 * Every asset id the OTHER design systems still depend on: what their heads
 * name under `$value`, and every id a published version of theirs pins. Removing
 * a system keeps any of its rows found here, so a copy the repair pass could not
 * make (a full disk) or a version published before the repair never loses the
 * bytes it draws.
 */
export async function idsNamedByOtherSystems(host: LogoOwnershipHost, except: string): Promise<Set<string>> {
  const out = new Set<string>();
  const records = await host.designSystems?.list().catch(() => [] as DesignSystemRecord[]) ?? [];
  for (const record of records) {
    if (record.id === except || record.source.kind === 'shipped' || !record.headId) continue;
    const head = await readJson(await host.assets._getBlob(record.headId).catch(() => null));
    if (!isRec(head)) continue;
    for (const id of valuesOf(head)) out.add(id);
    for (const entry of readVersionIndex(head).versions) for (const pin of entry.assets ?? []) out.add(pin.id);
  }
  return out;
}
