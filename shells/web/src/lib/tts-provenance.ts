// SPDX-License-Identifier: MPL-2.0
/**
 * TTS provenance - the ONE implementation of a generated clip's Content
 * Credential, shared by the save path (views/script-audio.ts) and the lazy
 * heal path (views/catalog.ts) so the two can never drift on the manifest
 * shape: c2pa.created with trainedAlgorithmicMedia and the full recipe
 * ({ script, voice, speed, model, lang }) in the action's parameters, RIFF
 * LIST/INFO tags, then the signed store embedded as a top-level RIFF chunk.
 *
 * The heal exists because clips saved before the wav embed shipped hold bare
 * WAV bytes (the earliest carry no record-side credential either - only
 * aiGenerated: 'full' and the meta.tts recipe). Everything needed to rebuild
 * the credential is in that recipe, so "Check Content Credentials" and the
 * details dialog re-stamp such a clip on sight instead of shrugging.
 *
 * NEVER heal audio Lolly did not generate: the meta.tts recipe is the proof
 * of origin, and shouldHealTts refuses without it - a user-recorded or
 * uploaded file is not ours to stamp.
 */
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';

/** The synthesis model every Kokoro clip records (buildTtsRecord writes it). */
export const TTS_MODEL = 'kokoro-82m-q8';

/** The human-readable AI declaration carried in ICMT and the created action. */
export const TTS_DECLARATION = 'Speech synthesized on-device from a typed script - the voice is AI-generated, not a real person';

/** The exact inputs that produced a clip - enough to rebuild its credential. */
export interface TtsRecipe {
  text: string;
  voice: string;
  speed: number;
  model: string;
  lang: string;
  /**
   * The model-facing script: normalized, one sentence per line, with the
   * `[pause]` / `[slow]` / `[word](/ipa/)` marks in place (plans/181 section
   * 5.1). Set once a clip has been regenerated from an edited script, because
   * then it - not the prose someone first typed - is what produced this audio.
   * Absent on a clip generated straight from a textarea, where the two are the
   * same words.
   */
  script?: string;
}

/** What both provenance builders consume: the clip's bytes as a Blob (read
 *  inside the try, so a failing read degrades instead of throwing), a display
 *  name for the manifest title and the recipe for the action parameters. */
export interface TtsProvenanceArgs {
  blob: Blob;
  name: string;
  recipe: TtsRecipe;
}

/**
 * Read the recipe off a stored record's meta.tts block (buildTtsRecord's
 * shape). Pure. Returns null unless the block proves Lolly generated the
 * clip - a non-empty script and voice; speed/model/lang default like the
 * save path wrote them.
 */
export function ttsRecipeFromMeta(meta: Record<string, unknown> | null | undefined): TtsRecipe | null {
  const tts = (meta as { tts?: unknown } | null | undefined)?.tts;
  if (!tts || typeof tts !== 'object') return null;
  const block = tts as Record<string, unknown>;
  const text = typeof block.text === 'string' ? block.text.trim() : '';
  const voice = typeof block.voice === 'string' ? block.voice.trim() : '';
  if (!text || !voice) return null;
  const speed = typeof block.speed === 'number' && Number.isFinite(block.speed) && block.speed > 0 ? block.speed : 1;
  const model = typeof block.model === 'string' && block.model ? block.model : TTS_MODEL;
  const lang = typeof block.lang === 'string' && block.lang ? block.lang : 'en';
  const script = typeof block.script === 'string' ? block.script.trim() : '';
  return { text, voice, speed, model, lang, ...(script ? { script } : {}) };
}

/**
 * Cheap sniff: does this WAV already carry an embedded C2PA chunk? Pure - a
 * top-level RIFF chunk walk (headers only, chunk bodies are skipped by size),
 * mirroring the engine's placeWav scan without pulling the c2pa cluster in.
 * Anything that is not a well-formed RIFF/WAVE reads as "no credential".
 */
export function hasRiffC2pa(bytes: Uint8Array): boolean {
  const fourcc = (o: number): string => String.fromCharCode(bytes[o]!, bytes[o + 1]!, bytes[o + 2]!, bytes[o + 3]!);
  if (bytes.length < 12 || fourcc(0) !== 'RIFF' || fourcc(8) !== 'WAVE') return false;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 12; i + 8 <= bytes.length; ) {
    if (fourcc(i) === 'C2PA') return true;
    const size = dv.getUint32(i + 4, true);
    i += 8 + size + (size & 1);   // chunks are word-aligned (pad byte on odd sizes)
  }
  return false;
}

/**
 * The heal decision, pure and testable: a USER wav whose meta.tts recipe
 * proves Lolly generated it, and whose stored bytes carry no embedded C2PA
 * chunk yet. An uploaded mp3, a recording without a recipe or an already
 * stamped clip all say no.
 */
export function shouldHealTts(
  ref: Pick<AssetRef, 'source' | 'type' | 'format' | 'meta'>,
  bytes: Uint8Array,
): boolean {
  if (ref.source !== 'user' || ref.type !== 'audio') return false;
  if (String(ref.format ?? '').toLowerCase() !== 'wav') return false;
  if (!ttsRecipeFromMeta(ref.meta)) return false;
  return !hasRiffC2pa(bytes);
}

/** The optional device-identity signer some hosts expose (bridge/identity). */
type SigningHost = HostV1 & { identity?: { signer(): Promise<unknown> } };

/** The signed-manifest options both builders share: the enrolled device
 *  identity when one is valid, else the engine's ephemeral on-device default
 *  (30-day window) - stampCaptureClip's recipe. */
async function signerOptions(host: HostV1): Promise<Record<string, unknown>> {
  let signer: unknown = null;
  try { signer = await (host as SigningHost).identity?.signer(); } catch { /* fall back to ephemeral */ }
  return signer
    ? { signer }
    : { dates: { notBefore: new Date(Date.now() - 60_000), notAfter: new Date(Date.now() + 30 * 86_400_000) } };
}

/**
 * The words this clip was actually spoken from: the marks-bearing model-facing
 * script once a regeneration has written one, else the prose someone typed,
 * which on a clip generated straight from a textarea is the same words.
 *
 * The created action records this, and so must anything that RE-OPENS the clip
 * for editing. Prefilling an editor from `text` alone shows the words as they
 * were before the last edit; saving from there then re-speaks them under the
 * same asset id and destroys the fix everywhere the clip is used.
 */
export function spokenScriptOf(recipe: TtsRecipe): string {
  return recipe.script || recipe.text;
}

/** The one created-action shape (trainedAlgorithmicMedia + the full recipe). */
const createdAction = (recipe: TtsRecipe, digitalSourceType: string) => ({
  action: 'c2pa.created',
  digitalSourceType,
  description: TTS_DECLARATION,
  parameters: {
    script: spokenScriptOf(recipe),
    voice: recipe.voice, speed: recipe.speed, model: recipe.model, lang: recipe.lang,
  },
});

/**
 * Sign a record-side Content Credential for a generated clip - the machine-
 * readable "this voice is synthetic" mark (EU AI Act Article 50). Nothing is
 * embedded into the file: the hash binds the whole wav byte range (no
 * exclusions), mirroring a sidecar manifest, and the store is persisted ON
 * the asset record (credential/credentialFormat) - exactly what
 * host.assets.credential serves the runtime's ingredient gathering, so a
 * video or image composed from the clip chains the AI origin into its own
 * manifest. Never throws - a failure logs and returns null.
 */
export async function buildTtsCredential(host: HostV1, args: TtsProvenanceArgs): Promise<{ store: Uint8Array; format: string } | null> {
  try {
    const { buildC2paManifest, GENERATED_SOURCE_TYPE, ENGINE_VERSION } = await import('@lolly/engine');
    const bytes = new Uint8Array(await args.blob.arrayBuffer());
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const store = await buildC2paManifest({
      title: args.name,
      claimGenerator: 'Lolly lolly.tools',
      generatorInfo: { name: 'Lolly', version: ENGINE_VERSION },
      actions: [createdAction(args.recipe, GENERATED_SOURCE_TYPE)],
      assetHash: { exclusions: [], hash },
      format: 'audio/wav',
      ...(await signerOptions(host) as object),
    });
    return { store, format: 'wav' };
  } catch (err) {
    host.log?.('warn', `tts provenance: Content Credential not attached - ${(err as Error)?.message || err}`);
    return null;
  }
}

/**
 * Embed the clip's provenance INTO the wav bytes: LIST/INFO tags first (INAM
 * title, ICMT the AI-declaration line, IART only with the profile's "Use my
 * details" opt-in - the same gate buildExportMeta applies - ISFT lolly.tools),
 * then the signed C2PA manifest as a top-level RIFF chunk via the engine's
 * two-pass embed, so the hash binding covers the FINAL byte layout tags
 * included. Returns the finished blob plus the extracted store (mirrored onto
 * the record for the runtime's fast ingredient path), or null on any failure - 
 * callers fall back to the record-side-only credential.
 */
export async function embedTtsProvenance(host: HostV1, args: TtsProvenanceArgs): Promise<{ blob: Blob; store: Uint8Array } | null> {
  try {
    const { embedC2pa, embedWavInfo, extractC2paStore, GENERATED_SOURCE_TYPE, ENGINE_VERSION } = await import('@lolly/engine');
    // Personal details only with the explicit profile opt-in, never by default.
    let artist = '';
    try {
      const p = (await host.profile.get()) ?? {};
      if ((p as { useDetails?: unknown }).useDetails === true) {
        artist = [p.firstname, p.lastname].map((s) => String(s ?? '').trim()).filter(Boolean).join(' ');
      }
    } catch { /* no profile → no artist */ }
    const bytes = new Uint8Array(await args.blob.arrayBuffer());
    const tagged = embedWavInfo(bytes, { title: args.name, artist, comment: TTS_DECLARATION });
    const embedded = await embedC2pa(tagged, 'wav', {
      title: args.name,
      claimGenerator: 'Lolly lolly.tools',
      generatorInfo: { name: 'Lolly', version: ENGINE_VERSION },
      ...(artist ? { author: { name: artist } } : {}),
      actions: [createdAction(args.recipe, GENERATED_SOURCE_TYPE)],
      ...(await signerOptions(host) as object),
    });
    const ex = extractC2paStore(embedded);
    if (!ex) throw new Error('embedded credential did not read back');
    return { blob: new Blob([embedded as BlobPart], { type: 'audio/wav' }), store: ex.store };
  } catch (err) {
    host.log?.('warn', `tts provenance: in-file credential not embedded - ${(err as Error)?.message || err}`);
    return null;
  }
}

/** The narrow bridge seam the heal writes through (bridge/assets.ts). */
export interface TtsHealHost extends HostV1 {
  assets: HostV1['assets'] & {
    _restampUserAsset(id: string, patch: { blob: Blob; credential: Uint8Array; credentialFormat: string }): Promise<void>;
  };
}

/**
 * Lazily re-stamp one pre-embed clip: rebuild the credential exactly as the
 * save path does (same manifest, same INFO tags), then replace the record's
 * blob + credential in place. Returns the healed blob so the caller can hand
 * the STAMPED bytes straight to /verify, or null when the asset does not
 * qualify (shouldHealTts) or the embed failed - never throws.
 */
export async function healTtsProvenance(host: TtsHealHost, ref: AssetRef, bytes: Uint8Array): Promise<Blob | null> {
  if (!shouldHealTts(ref, bytes)) return null;
  const recipe = ttsRecipeFromMeta(ref.meta)!;
  const name = String(ref.meta?.name ?? ref.id);
  const embedded = await embedTtsProvenance(host, { blob: new Blob([bytes as BlobPart], { type: 'audio/wav' }), name, recipe });
  if (!embedded) return null;
  try {
    await host.assets._restampUserAsset(ref.id, { blob: embedded.blob, credential: embedded.store, credentialFormat: 'wav' });
  } catch (err) {
    host.log?.('warn', `tts provenance: heal write failed - ${(err as Error)?.message || err}`);
    return null;
  }
  return embedded.blob;
}

/** The seam a rewrite writes through (bridge/assets.ts's general bytes swap). */
export interface TtsRewriteHost extends HostV1 {
  assets: HostV1['assets'] & {
    _replaceUserAssetBytes(id: string, patch: {
      blob: Blob; credential?: Uint8Array; credentialFormat?: string; meta?: Record<string, unknown>;
    }): Promise<void>;
  };
}

/** One regenerated take, ready to replace the clip it came from. */
export interface TtsRewrite {
  /** The clip's own asset id - a rewrite never mints a new one. */
  id: string;
  /** Display name for the manifest title (the stored `meta.name`). */
  name: string;
  /** The re-encoded wav for the spliced audio. */
  blob: Blob;
  /** The inputs that produced THIS take, with `script` set to the edited script. */
  recipe: TtsRecipe;
  /** The `meta` keys the new take changed - merged over what is stored. */
  meta?: Record<string, unknown>;
}

/**
 * Rewrite a generated clip in place after a regenerate (plans/181 section 5.2
 * step 4): stamp the new bytes exactly as the save path stamps a first take -
 * a fresh `c2pa.created` whose `parameters.script` is the script that was
 * actually read, marks included - then swap the record's bytes, credential and
 * changed meta under the same id.
 *
 * No `c2pa.edited` action: the clip is still wholly generated, and the created
 * action already carries the recipe that made it. The asset id does not move,
 * so every document, link and caption pointing at this clip hears the fix.
 *
 * Returns the stored blob, or null when the write failed - never throws. A
 * clip that cannot be stamped still saves with the record-side credential, and
 * one that cannot be written keeps the take it had.
 */
export async function rewriteTtsClip(host: TtsRewriteHost, rw: TtsRewrite): Promise<Blob | null> {
  const args: TtsProvenanceArgs = { blob: rw.blob, name: rw.name, recipe: rw.recipe };
  const patch: { blob: Blob; credential?: Uint8Array; credentialFormat?: string; meta?: Record<string, unknown> } = {
    blob: rw.blob, meta: rw.meta,
  };
  // Provenance lives in the file, as it does for a first take. When the embed
  // cannot run the record-side credential alone is the fallback, and a clip
  // with neither is still rewritten - the bytes matter more than the stamp.
  const embedded = await embedTtsProvenance(host, args);
  if (embedded) {
    patch.blob = embedded.blob;
    patch.credential = embedded.store;
    patch.credentialFormat = 'wav';
  } else {
    const credential = await buildTtsCredential(host, args);
    if (credential) {
      patch.credential = credential.store;
      patch.credentialFormat = credential.format;
    }
  }
  try {
    await host.assets._replaceUserAssetBytes(rw.id, patch);
  } catch (err) {
    host.log?.('warn', `tts provenance: rewrite write failed - ${(err as Error)?.message || err}`);
    return null;
  }
  return patch.blob;
}
