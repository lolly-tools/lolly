// SPDX-License-Identifier: MPL-2.0
/**
 * Deriving a new user asset from an existing one - the shared provenance path.
 *
 * Every "make me a new copy of this image" flow in the shell has to answer the
 * same three questions the same way, or the chain rots differently per feature:
 *   • what does the new file's Content Credential say happened,
 *   • does the source ride along as an ingredient,
 *   • does an AI-generated source stay declared as one.
 *
 * The catalog's crop has answered them correctly since plans/105 (and the genAI
 * backfill in particular is what the AI chip depends on - see
 * tests/catalog-crop-preserves-genai-provenance.test.ts). This module is that
 * logic lifted out of the catalog view verbatim, so the framing bake (plans/148
 * WP-E, "Use as a new image") is the SAME path rather than a second one that
 * drifts. The catalog view now calls in here too.
 *
 * Signing is best-effort by default: a stamping failure ships the unsigned bytes
 * with a warning. Callers that promise a provenance-preserving conversion can set
 * `requireCredential`; those fail visibly instead of silently shipping a broken chain.
 */
import {
  C2PA_FORMATS, prepareC2paIngredient, prepareC2paIngredientFromStore,
  DIGITAL_SOURCE_TYPE, GENERATED_SOURCE_TYPE, COMPOSITE_SOURCE_TYPE,
} from '@lolly/engine';
import type { AssetRef, IngredientCredential } from '@lolly-tools/core/host-v1';
import type { C2paActionInput } from '../../../../engine/src/c2pa.ts';
import { assetAiKind } from './genai-pill.ts';

/** The minimum host surface this module needs (a slice of WebToolHost). */
export interface DerivedHost {
  assets: {
    get(id: string): Promise<AssetRef>;
    credential?(id: string): Promise<{ store: Uint8Array; format: string } | null | undefined>;
    _uploadUserAsset?(r: {
      id: string; type: AssetRef['type']; format: string; blob: Blob; version: string; meta: Record<string, unknown>;
    }): Promise<void>;
  };
  log?(level: string, msg: string, data?: Record<string, unknown>): void;
}

/** The credential inputs for one derived file. */
export interface DerivedSignInputs {
  /** The honest transform history for THIS derivation. */
  edits: C2paActionInput[];
  /** Recorded under tools.lolly.export so an inspected file shows the parameters. */
  detail?: Record<string, string>;
  dims?: string;
  /** Skips a refetch when the caller already holds the source bytes. */
  sourceBytes?: Uint8Array;
  /** Fail the operation if a stampable derivative cannot receive its new Content
   *  Credential. Used by Download as, whose UI explicitly promises preservation. */
  requireCredential?: boolean;
}

/** Formats embedC2pa can stamp (png/jpg/webp/gif/svg/tiff/pdf/…). */
export const STAMPABLE_FORMATS = new Set<string>(C2PA_FORMATS as readonly string[]);

/**
 * The source asset's preserved credential, as an embeddable ingredient.
 *
 * User uploads read the store captured at ingest (their stored pixels were
 * re-encoded, so the bytes no longer carry it); library assets read their own
 * bytes.
 */
export async function sourceIngredients(
  host: DerivedHost, ref: AssetRef, sourceBytes?: Uint8Array,
): Promise<IngredientCredential[] | undefined> {
  try {
    let ing: IngredientCredential | null = null;
    if (ref.id.startsWith('user/')) {
      const cred = await host.assets.credential?.(ref.id);
      ing = cred ? prepareC2paIngredientFromStore(cred.store, cred.format) : null;
    } else {
      const bytes = sourceBytes ?? new Uint8Array(await (await fetch(ref.url)).arrayBuffer());
      ing = prepareC2paIngredient(bytes);
    }
    if (!ing) return undefined;
    // The ingredient's own claim title wins (it names the actual work); fall
    // back to the library's display name so "Opened …" never reads blank.
    return [{ ...ing, title: ing.title || String(ref.meta?.name ?? ref.id) }];
  } catch { return undefined; }
}

/**
 * Stamp a derived blob's Content Credential: edits + the source as ingredient,
 * with the genAI source type backfilled so a flagged asset never reads as
 * human-made afterwards.
 *
 * A genAI-flagged source must NOT read as human-made after a crop / reframe /
 * recolour / resize. When it carries a full credential the AI origin rides in as
 * an ingredient (collectActionChain walks ingredient manifests, so the flag
 * survives); but when the AI-ness was authored/detected onto meta with no
 * embeddable manifest there is no ingredient to carry it, and a plain
 * c2pa.created would silently drop the flag. So the created claim asserts the
 * right source type, and an ingredient whose own chain records no AI *action*
 * gets its empty digitalSourceType filled from the asset's authored kind. Only
 * an EMPTY source type is filled, and only for a genAI asset, so this can never
 * double-flag a non-AI one.
 */
export async function signDerived(
  host: DerivedHost, ref: AssetRef, blob: Blob, format: string, o: DerivedSignInputs,
): Promise<Blob> {
  if (!STAMPABLE_FORMATS.has(format)) {
    if (o.requireCredential) throw new Error(`Content Credentials are not supported for ${format.toUpperCase()}.`);
    return blob;
  }
  try {
    // Lazily reach the 90 KB export bridge - a derivation is always a user
    // gesture, so this never runs on the gallery/boot path.
    const { stampDerivedC2pa } = await import('../bridge/export.ts');
    const ingredients = await sourceIngredients(host, ref, o.sourceBytes);
    const aiKind = assetAiKind(ref);
    const aiSourceType = aiKind === 'full' ? GENERATED_SOURCE_TYPE
      : aiKind === 'partial' ? COMPOSITE_SOURCE_TYPE
      : DIGITAL_SOURCE_TYPE;
    if (ingredients && (aiKind === 'full' || aiKind === 'partial')) {
      for (const ing of ingredients) {
        if (!ing.digitalSourceType) ing.digitalSourceType = aiSourceType;
      }
    }
    const actions: C2paActionInput[] = ingredients
      ? o.edits
      : [{ action: 'c2pa.created', digitalSourceType: aiSourceType }, ...o.edits];
    return await stampDerivedC2pa(host as never, blob, format, {
      title: String(ref.meta?.name ?? ref.id),
      actions,
      ingredients,
      inputs: { asset: ref.id, ...(o.detail ?? {}) },
      dimensions: o.dims,
    });
  } catch (err) {
    host.log?.('warn', 'Derived asset: Content Credentials not attached', { id: ref.id, error: String(err) });
    if (o.requireCredential) throw err;
    return blob;
  }
}

/** A filename-safe slug of an asset's display name, for a derived id. */
export function derivedSlug(ref: AssetRef): string {
  const base = String(ref.meta?.name ?? ref.id.split('/').pop() ?? 'image').replace(/\.[a-z0-9]+$/i, '');
  return base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

/** The display name a derived copy carries: "<source> - <suffix>". */
export function derivedName(ref: AssetRef, suffix: string): string {
  const base = String(ref.meta?.name ?? ref.id.split('/').pop() ?? 'image').replace(/\.[a-z0-9]+$/i, '');
  return `${base} - ${suffix}`;
}

/**
 * Sign a derived blob and save it to the user's library as a child of `ref`.
 *
 * `kind` is the id namespace and the display suffix ('crop', 'frame', …).
 * Returns the new AssetRef, or null when the shell cannot store user assets.
 * The source's authored AI flag rides onto the copy's meta so the AI chip
 * survives alongside the credential's record.
 */
export async function saveDerivedAsset(
  host: DerivedHost, ref: AssetRef, blob: Blob, format: string,
  kind: string, o: DerivedSignInputs, displayName?: string,
): Promise<AssetRef | null> {
  if (!host.assets._uploadUserAsset) return null;
  const signed = await signDerived(host, ref, blob, format, o);
  const id = `user/${kind}/${Date.now()}-${derivedSlug(ref) || kind}`;
  const aiKind = assetAiKind(ref);
  await host.assets._uploadUserAsset({
    id,
    type: format === 'svg' ? 'vector' : 'raster',
    format,
    blob: signed,
    version: '1.0.0',
    meta: {
      name: displayName ?? derivedName(ref, kind),
      bytes: signed.size,
      ...(aiKind ? { aiGenerated: aiKind } : {}),
    },
  });
  return host.assets.get(id);
}
