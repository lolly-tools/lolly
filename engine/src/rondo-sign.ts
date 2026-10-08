// SPDX-License-Identifier: MPL-2.0
/**
 * rondo-sign.ts: sign a file rendered from a rondocode song.
 *
 * rondo-provenance.ts decides what such a file says about itself; this module
 * writes it, the same way lib/tts-provenance.ts writes a generated voice clip:
 * for WAV the human-readable declaration goes into the RIFF LIST/INFO comment
 * (ICMT) first, then the signed Content Credentials go into the container as
 * the last byte operation, so the hash covers the final layout. The created
 * step and the song's source ingredient come from rondo-provenance.ts, so a
 * file from the web shell and one from the CLI say the same thing.
 *
 * A file holding synthesised singing also carries one C2PA 2.4 AI disclosure
 * per model the singing passed through (rondoModelDisclosures).
 *
 * The caller picks the signer: an enrolled identity when there is one, else the
 * ephemeral on-device signer (`dates` without `signer`). Not on the engine
 * barrel; the shells import it by path.
 */
import { embedC2pa, C2PA_FORMATS } from './c2pa-containers.ts';
import type { C2paAiDisclosureInput, EmbedOptions } from './c2pa.ts';
import { embedWavInfo } from './riff-meta.ts';
import { rondoCreatedAction, rondoDeclaration, rondoSongIngredient, type RondoRenderFacts } from './rondo-provenance.ts';
import { ENGINE_VERSION } from './version.ts';

export interface RondoSignArgs {
  /** The song's canonical `.rondo.json` bytes (rondo-source.ts rondoSourceBytes). */
  song: Uint8Array;
  /** The song's display name, the credential's title. */
  name: string;
  facts: RondoRenderFacts;
  /** An enrolled identity's signer. Absent: the ephemeral on-device signer. */
  signer?: EmbedOptions['signer'];
  /** The signing window: an identity's certificate dates, else now to 30 days on. */
  dates?: EmbedOptions['dates'];
  /** `claim_generator_info.name`. Default 'Lolly'. */
  generator?: string;
}

/** Where the singing models come from, pinned as scripts/fetch-sing-models.ts pins them. */
const SUPERTONIC_REPO = 'https://huggingface.co/Supertone/supertonic-3/tree/3cadd1ee6394adea1bd021217a0e650ede09a323';
const RONDO_SING_REPO = 'https://huggingface.co/hi-im-vijay/rondocode-sing/blob/528c7e4eaec2a0a71cb6f02c2169f16ee11c55b1';
const ONNX = 'c2pa.types.model.onnx';

/**
 * The C2PA 2.4 AI disclosures (section 18.28) for a file holding synthesised
 * singing: one per model the singing passed through, each an ONNX model
 * (Table 12), named and identified by the repository and commit Lolly hosts it
 * from. Text to speech (Supertonic-3), the phoneme aligner that fits the words
 * to the notes, the ContentVec encoder and one RVC voice generator per voice.
 * Empty when nothing was sung, so a plain render discloses no model.
 */
export function rondoModelDisclosures(facts: RondoRenderFacts): C2paAiDisclosureInput[] {
  if (!facts.sungParts?.length) return [];
  const voices = facts.voices?.length ? facts.voices : [];
  return [
    { modelType: ONNX, modelName: 'Supertonic-3 text to speech (Supertone Inc.)', modelIdentifier: SUPERTONIC_REPO },
    { modelType: ONNX, modelName: 'wav2vec 2.0 phoneme aligner (facebook/wav2vec2-lv-60-espeak-cv-ft, exported to ONNX)', modelIdentifier: `${RONDO_SING_REPO}/phoneme.onnx` },
    { modelType: ONNX, modelName: 'ContentVec speech encoder for voice conversion', modelIdentifier: `${RONDO_SING_REPO}/vec-768.onnx` },
    ...(voices.length
      ? voices.slice(0, 8).map((v) => ({ modelType: ONNX, modelName: `RVC voice generator "${v}"`, ...(/^[a-z]+$/.test(v) ? { modelIdentifier: `${RONDO_SING_REPO}/gen_${v}.onnx` } : {}) }))
      : [{ modelType: ONNX, modelName: 'RVC voice generator' }]),
  ];
}

/** True when the engine can embed a credential in this format. */
export function canSignRondo(format: string): boolean {
  return C2PA_FORMATS.includes(format);
}

/**
 * Embed the declaration and the signed credential. Throws for a format with no
 * credential placer (see canSignRondo), so a caller never reports a credential
 * that was not written.
 */
export async function signRondoFile(bytes: Uint8Array, format: string, args: RondoSignArgs): Promise<Uint8Array> {
  if (!canSignRondo(format)) throw new Error(`${format.toUpperCase()} has no place for Content Credentials`);
  const hash = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', args.song as BufferSource));
  const tagged = format === 'wav' ? embedWavInfo(bytes, { title: args.name, comment: rondoDeclaration(args.facts) }) : bytes;
  const disclosures = rondoModelDisclosures(args.facts);
  return embedC2pa(tagged, format, {
    title: args.name,
    claimGenerator: 'Lolly lolly.tools',
    generatorInfo: { name: args.generator ?? 'Lolly', version: ENGINE_VERSION },
    actions: [rondoCreatedAction(args.facts)],
    ingredients: [rondoSongIngredient({ name: args.name, hash, facts: args.facts })],
    ...(disclosures.length ? { aiDisclosure: disclosures } : {}),
    ...(args.signer ? { signer: args.signer } : {}),
    // An enrolled identity brings its certificate window; the ephemeral signer
    // gets now to 30 days on.
    dates: args.dates ?? { notBefore: new Date(Date.now() - 60_000), notAfter: new Date(Date.now() + 30 * 86_400_000) },
  } as EmbedOptions);
}
