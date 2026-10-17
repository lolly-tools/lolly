// SPDX-License-Identifier: MPL-2.0
/**
 * Deriving a new user asset from an existing one - the shared provenance path.
 *
 * Every "make me a new copy of this image" flow in the shell has to answer the
 * same four questions the same way, or the chain rots differently per feature:
 *   • what does the new file's Content Credential say happened,
 *   • does the source ride along as an ingredient,
 *   • does an AI-generated source stay declared as one,
 *   • does the credit a source's licence asks for travel with the new file.
 *
 * The catalog's crop has answered the first three correctly since plans/105 (and
 * the genAI backfill in particular is what the AI chip depends on - see
 * tests/catalog-crop-preserves-genai-provenance.test.ts). This module is that
 * logic lifted out of the catalog view verbatim, so the framing bake (plans/148
 * WP-E, "Use as a new image") is the SAME path rather than a second one that
 * drifts. The catalog view now calls in here too.
 *
 * Sources and credits (plan 253). A source with a Content Credential of its own
 * rides along as that credential. A source with none, but with a recorded
 * licence, rides along as an UNSIGNED source ingredient: a record of what Lolly
 * read about it, never a signature for the upstream author. Further works the
 * derivation used, such as a LUT, join the same evaluation under their own role,
 * so a LUT's licence is never read as the photograph's and a LUT never becomes
 * an ingredient of the picture.
 *
 * Signing is best-effort while nothing was promised: a stamping failure ships
 * the unsigned bytes with a warning. Two things turn that into a failure. A
 * caller that promises a provenance-preserving conversion sets
 * `requireCredential`. And a source whose licence asks for a credit makes the
 * credit a required delivery: when the new file cannot carry it, signDerived
 * throws a DerivedCreditError rather than returning bytes without the credit.
 */
import {
  C2PA_FORMATS, prepareC2paIngredient, prepareC2paIngredientFromStore,
  DIGITAL_SOURCE_TYPE, GENERATED_SOURCE_TYPE, COMPOSITE_SOURCE_TYPE,
  attributionCredits, evaluateCreativeUses, normaliseLicence, sourceIngredientsFor,
} from '@lolly/engine';
import type { SourceDetailV1 } from '@lolly/engine';
import type { AssetRef, IngredientCredential, SourceIngredient } from '@lolly-tools/core/host-v1';
import type {
  CreativeOperationV1, CreativeUseV1, CreativeWorkRecordV1, RightsEvaluationV1, RightsEvidenceV1, UseContextV1,
} from '@lolly-tools/core/rights-v1';
import type { C2paActionInput } from '../../../../engine/src/c2pa.ts';
import { assetAiKind } from './genai-pill.ts';
import { readAssetRightsRecord, type AssetRightsMeta } from './asset-rights.ts';
import { t } from '../i18n.ts';

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

/**
 * A further work a derivation used beside its source, with its own role. A LUT
 * is the case today: a `transformation` use, so the rules credit it under its
 * own licence and no ingredient is written for the LUT.
 */
export interface DerivedSource {
  work: CreativeWorkRecordV1;
  use: CreativeUseV1;
  /** The credit the licensor asked for, word for word, and anything else the record has no field for. */
  detail?: SourceDetailV1;
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
  /** Further works this derivation used, such as the LUT of a grade. */
  sources?: DerivedSource[];
}

/**
 * What a derivation did about its sources' credits.
 *
 * `signed`: the new file carries a fresh credential that holds the source
 * records. Nothing has read the file back yet, so this is a written record, not
 * a confirmed credit.
 * `unsigned`: no credential was attached and no source asked for a credit, so
 * only optional provenance was lost.
 * `delivery-failed`: a credit a source's licence asks for is not in the file.
 */
export type DerivedDeliveryState = 'signed' | 'unsigned' | 'delivery-failed';

export interface DerivedOutcome {
  blob: Blob;
  state: DerivedDeliveryState;
  /** The rules' reading of the source and the further works, or null when none of them records a licence. */
  rights: RightsEvaluationV1 | null;
  /** The readable credits written into the new file's credential, or the ones it would have carried. */
  credits: string;
  /** Work ids whose required credit the new file does not carry. */
  missing: string[];
  /** Why no credential was attached, when none was. */
  reason?: string;
}

/** Thrown by signDerived when the new file cannot carry a credit its sources' licences ask for. */
export class DerivedCreditError extends Error {
  readonly outcome: DerivedOutcome;
  constructor(outcome: DerivedOutcome) {
    super(t('The new file could not carry the credit its source asks for.'));
    this.name = 'DerivedCreditError';
    this.outcome = outcome;
  }
}

/** What to tell the user when a derived save or download failed: the credit
 *  failure in its own words, anything else as the caller's general message. */
export function derivedFailureMessage(err: unknown, fallback: string): string {
  return err instanceof DerivedCreditError ? err.message : fallback;
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

const TITLE_MAX = 1024;
const CREDIT_MAX = 1024;
const DECLARATION_MAX = 256;
const SRI_SHA256 = /^sha256-([A-Za-z0-9+/]{43}=)$/;

/** A catalog `sha256-<base64>` checksum as the `sha256:<hex>` a rights record carries, or undefined. */
function checksumText(checksum: unknown): string | undefined {
  const b64 = typeof checksum === 'string' ? SRI_SHA256.exec(checksum)?.[1] : undefined;
  if (!b64) return undefined;
  const raw = atob(b64);
  if (raw.length !== 32) return undefined;
  let hex = '';
  for (let i = 0; i < raw.length; i++) hex += raw.charCodeAt(i).toString(16).padStart(2, '0');
  return `sha256:${hex}`;
}

/**
 * One rights statement with the identifier and licence link filled in where the
 * declaration is a licence these rules know, and the declaration itself left
 * exactly as supplied. The source ingredient writes the identifier and link it
 * finds here, so a catalog's `cc-by-4.0` reads as `CC-BY-4.0` with its URL in
 * the credential, the same spelling the credits use.
 */
function withNormalised(evidence: RightsEvidenceV1): RightsEvidenceV1 {
  const normalised = normaliseLicence(evidence.declaration);
  if (!normalised.id) return evidence;
  return {
    ...evidence,
    expression: evidence.expression ?? normalised.id,
    ...(evidence.url || !normalised.url ? {} : { url: normalised.url }),
    ...(evidence.status === 'unparsed' ? { status: 'parsed' as const } : {}),
  };
}

/**
 * The source asset as a creative work, from what its catalog entry or upload
 * recorded: the structured `rights` record, the legacy licence string, or both.
 * Both are kept as separate statements, so a catalog whose two fields disagree
 * is reported as a conflict rather than settled here. The legacy credit string
 * is the attribution the source asks for. Null when nothing records a licence,
 * which means not recorded, never permission: such a source adds nothing.
 */
export function derivedSourceWork(ref: AssetRef): { work: CreativeWorkRecordV1; detail?: SourceDetailV1 } | null {
  const meta = (ref.meta ?? {}) as AssetRightsMeta & { name?: unknown };
  const record = readAssetRightsRecord(meta.rights);
  const declared = (record?.rights ?? []).filter((ev) => ev.status !== 'missing' && ev.status !== 'not-applicable');
  const legacy = typeof meta.license === 'string' ? meta.license.trim().slice(0, DECLARATION_MAX) : '';
  if (!declared.length && !legacy) return null;
  const rights: RightsEvidenceV1[] = declared.map(withNormalised);
  if (legacy) {
    rights.push(withNormalised({ declaration: legacy, assertedBy: 'catalog', evidence: 'catalog-entry', status: 'unparsed' }));
  }
  const title = String(record?.title ?? meta.name ?? ref.id).slice(0, TITLE_MAX);
  const work: CreativeWorkRecordV1 = { ...(record ?? { creators: [] }), id: record?.id ?? ref.id, title, rights };
  const attribution = typeof meta.attribution === 'string' ? meta.attribution.trim().slice(0, CREDIT_MAX) : '';
  return { work, ...(attribution ? { detail: { attribution } } : {}) };
}

/**
 * The factual operations a derivation's edit history records, for the rules.
 * Only the edits with an exact match are named; any other edit (a retouch, a
 * matte, a trim, an orientation change) is read as `retouched`, the cautious
 * word, because the rules may raise a classification and never lower one.
 */
const ACTION_OPERATIONS = new Map<string, CreativeOperationV1>([
  ['c2pa.cropped', 'cropped'],
  ['c2pa.color_adjustments', 'recoloured'],
  ['c2pa.resized', 'resized'],
  ['c2pa.converted', 'converted'],
  ['c2pa.transcoded', 'converted'],
]);
const NOT_AN_EDIT = new Set(['c2pa.created', 'c2pa.opened', 'c2pa.placed']);

export function derivedOperations(edits: readonly C2paActionInput[]): CreativeOperationV1[] {
  const ops = new Set<CreativeOperationV1>();
  for (const edit of edits) {
    if (NOT_AN_EDIT.has(edit.action)) continue;
    ops.add(ACTION_OPERATIONS.get(edit.action) ?? 'retouched');
  }
  // A new file with no recorded edit is still a re-encode of its source.
  return ops.size ? [...ops] : ['converted'];
}

/**
 * The delivery a single derived file is. The credential is the only place a
 * credit can travel in it: as the source ingredient, and as readable credits in
 * the export details. A format that cannot be stamped carries neither.
 */
function derivedContext(format: string): UseContextV1 {
  const stampable = STAMPABLE_FORMATS.has(format);
  return {
    operation: 'render',
    delivery: {
      format,
      route: stampable ? 'file-with-c2pa' : 'file-without-c2pa',
      canCarryCredential: stampable,
      canCarryReadableCredit: stampable,
    },
    audience: 'unknown',
  };
}

/** The rights reading of one derivation. */
export interface DerivedRights {
  evaluation: RightsEvaluationV1;
  /** The source as an unsigned ingredient the new file opens; absent when the source records no licence
   *  or nothing about it can be looked up. */
  ingredient?: SourceIngredient;
  /** Readable credits for the new file, required lines first. */
  credits: string;
  /** Work ids whose credit a licence requires. */
  required: string[];
}

/**
 * Evaluate one derivation: the source (when it records a licence) as the work
 * the new file is made from, plus any further works under their own roles.
 * Null when none of them records anything, which leaves the path exactly as it
 * was before plan 253. Pure: no network, no clock.
 *
 * The source's ingredient comes from the engine's census-to-ingredient step, so
 * it never carries a field the writer would refuse, and is then marked
 * `parentOf`: the new file is derived from its source (C2PA 2.4, section
 * 18.16.3), which the writer records as `c2pa.opened`, not as a placed part.
 */
export function derivedRights(
  ref: AssetRef | null,
  o: { edits: readonly C2paActionInput[]; sources?: readonly DerivedSource[]; format: string },
): DerivedRights | null {
  const own = ref ? derivedSourceWork(ref) : null;
  const sources = o.sources ?? [];
  if (!own && !sources.length) return null;
  const works: CreativeWorkRecordV1[] = [];
  const uses: CreativeUseV1[] = [];
  const details = Object.create(null) as Record<string, SourceDetailV1>;
  let ownUse: CreativeUseV1 | null = null;
  if (own && ref) {
    // The exact bytes read, pinned only when the asset states both its version
    // and a checksum: a pin is a fact about this file, never a guess.
    const checksum = checksumText(ref.checksum);
    const version = ref.version ?? ref.pin?.version;
    ownUse = {
      work: own.work.id,
      role: 'incorporated',
      operations: derivedOperations(o.edits),
      ...(checksum && version ? { pin: { id: ref.id, version, checksum } } : {}),
    };
    works.push(own.work);
    uses.push(ownUse);
    if (own.detail) details[own.work.id] = own.detail;
  }
  for (const source of sources) {
    works.push(source.work);
    uses.push(source.use);
    if (source.detail) details[source.work.id] = source.detail;
  }
  const evaluation = evaluateCreativeUses({ works, uses, details, context: derivedContext(o.format) });
  const [census] = own && ownUse ? sourceIngredientsFor([own.work], [ownUse], details) : [];
  // An ingredient with neither a licence link nor a public locator for the bytes
  // would record a name and a licence nobody can look up (a catalog's
  // `proprietary`, say), so it is left off and the file reads as it did before.
  const ingredient = census && (census.informationalUri || census.url) ? census : undefined;
  return {
    evaluation,
    ...(ingredient ? { ingredient: { ...ingredient, relationship: 'parentOf' as const } } : {}),
    credits: attributionCredits(evaluation.plan),
    required: [...new Set(evaluation.plan.required.map((notice) => notice.work))],
  };
}

/**
 * Stamp a derived blob's Content Credential and report what happened to the
 * sources' credits. Never throws: the outcome's state says whether a required
 * credit was lost, and signDerived turns that into an error.
 *
 * The genAI backfill: a genAI-flagged source must NOT read as human-made after
 * a crop / reframe / recolour / resize. When it carries a full credential the
 * AI origin rides in as an ingredient (collectActionChain walks ingredient
 * manifests, so the flag survives); but when the AI-ness was authored/detected
 * onto meta with no embeddable manifest there is no ingredient to carry it, and
 * a plain c2pa.created would silently drop the flag. So the created claim
 * asserts the right source type, and an ingredient whose own chain records no AI
 * *action* gets its empty digitalSourceType filled from the asset's authored
 * kind. Only an EMPTY source type is filled, and only for a genAI asset, so
 * this can never double-flag a non-AI one. An unsigned source ingredient takes
 * the same fill, and the writer copies it onto the c2pa.opened step.
 */
export async function signDerivedOutcome(
  host: DerivedHost, ref: AssetRef, blob: Blob, format: string, o: DerivedSignInputs,
): Promise<DerivedOutcome> {
  const rights = derivedRights(ref, { edits: o.edits, sources: o.sources, format });
  const credits = rights?.credits ?? '';
  const settle = (out: Blob, signed: boolean, reason?: string): DerivedOutcome => {
    const missing = signed ? [] : (rights?.required ?? []);
    return {
      blob: out,
      state: signed ? 'signed' : missing.length ? 'delivery-failed' : 'unsigned',
      rights: rights?.evaluation ?? null,
      credits,
      missing,
      ...(reason ? { reason } : {}),
    };
  };
  if (!STAMPABLE_FORMATS.has(format)) {
    return settle(blob, false, `Content Credentials are not supported for ${format.toUpperCase()}.`);
  }
  try {
    // Lazily reach the 90 KB export bridge - a derivation is always a user
    // gesture, so this never runs on the gallery/boot path.
    const { stampDerivedC2pa } = await import('../bridge/export.ts');
    const credentialed = await sourceIngredients(host, ref, o.sourceBytes);
    const ingredients: (IngredientCredential | SourceIngredient)[] | undefined = credentialed
      ?? (rights?.ingredient ? [{ ...rights.ingredient }] : undefined);
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
    const stamped = await stampDerivedC2pa(host as never, blob, format, {
      title: String(ref.meta?.name ?? ref.id),
      actions,
      ingredients,
      inputs: { asset: ref.id, ...(o.detail ?? {}), ...(credits ? { credits } : {}) },
      dimensions: o.dims,
    });
    // stampDerivedC2pa never throws: when no credential was attached it hands
    // back the very blob it was given, so identity is the failure signal.
    if (stamped === blob) {
      host.log?.('warn', 'Derived asset: Content Credentials not attached', { id: ref.id });
      return settle(blob, false, 'Content Credentials could not be attached.');
    }
    return settle(stamped, true);
  } catch (err) {
    host.log?.('warn', 'Derived asset: Content Credentials not attached', { id: ref.id, error: String(err) });
    return settle(blob, false, err instanceof Error ? err.message : String(err));
  }
}

/**
 * Stamp a derived blob's Content Credential: edits + the source as ingredient,
 * signed or unsigned, with the genAI source type backfilled (see
 * signDerivedOutcome). Returns the stamped bytes, or the unsigned bytes when
 * only optional provenance was lost. Throws when a promised credential
 * (`requireCredential`) or a required credit could not be written.
 */
export async function signDerived(
  host: DerivedHost, ref: AssetRef, blob: Blob, format: string, o: DerivedSignInputs,
): Promise<Blob> {
  const outcome = await signDerivedOutcome(host, ref, blob, format, o);
  if (outcome.state === 'delivery-failed') throw new DerivedCreditError(outcome);
  if (outcome.state !== 'signed' && o.requireCredential) {
    throw new Error(outcome.reason ?? 'Content Credentials could not be attached.');
  }
  return outcome.blob;
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
