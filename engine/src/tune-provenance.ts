// SPDX-License-Identifier: MPL-2.0
/**
 * tune-provenance.ts: what a file made from a Lolly tune says about itself.
 *
 * A tune is music Lolly's own composer writes from a recipe (a style and a seed,
 * and for a music generator track its settings), played by instruments Lolly
 * synthesises. No sample, recording or trained model is involved, so the honest
 * IPTC digital source type is algorithmicMedia. That is not an AI flag: the read
 * side (ai-kind.ts) maps only the two trained-model slugs to AI.
 *
 * Andy approved two machine-readable statements (2026-11-10). Both are shown to the
 * person at the moment of export and named in the public docs:
 *
 *   1. A WAV or M4A downloaded from the music generator carries a created step whose
 *      description starts with TUNE_DECLARATION, followed by the style and the seed.
 *   2. A saved tune used in another export (a video's music bed, a tool's audio, a
 *      timeline clip) is recorded as a C2PA source ingredient: its name, its licence
 *      when the tune records one, the digest of its recipe and the engine version that
 *      rendered the tune. Who made the tune is added only when the shell passes a
 *      maker, which the web shell does only while the person's "Use my details" is on.
 *
 * Pure: shells hash, sign and embed. This module only decides what is said, so a web
 * export and a later CLI path say the same thing.
 */
import type { SourceIngredient } from '@lolly-tools/core/host-v1';

/**
 * IPTC algorithmicMedia: the same IRI as c2pa.ts ALGORITHMIC_SOURCE_TYPE, and the
 * tests pin the two equal. Held here so this module imports nothing and the music
 * generator can show its declaration without loading the credential writer.
 */
export const TUNE_SOURCE_TYPE = 'http://cv.iptc.org/newscodes/digitalsourcetype/algorithmicMedia';

/** The sentence a file downloaded from the music generator carries, word for word. */
export const TUNE_DECLARATION = "Made with Lolly's music generator (procedural, no AI)";

/** Where a tune was made: the music generator, or a station of the Neurospicy player. */
export type TuneOrigin = 'generator' | 'station';

/** The opening words of a tune ingredient's description, one per origin. */
const INGREDIENT_OPENING: Record<TuneOrigin, string> = {
  generator: "A tune made with Lolly's music generator (procedural, no AI)",
  station: "A tune from a station of Lolly's Neurospicy player (procedural, no AI)",
};

/** The writer's ceiling for an ingredient description (c2pa.ts boundedText). */
const MAX_DESCRIPTION = 4096;
const MAX_TITLE = 200;
const MAX_MAKER = 200;

/** What a downloaded track's created step records. */
export interface TuneTrackFacts {
  /** The style's id, for example `sugar`. */
  style: string;
  /** The style's name as a person reads it, for example `Lolly Sings Sugar`. */
  styleName?: string;
  /** The tune's seed, a whole number from 0 to 4294967295. */
  seed: number;
}

/** The created step's description: the declaration, then the style and the seed. */
export function tuneDeclaration(facts: TuneTrackFacts): string {
  const style = (facts.styleName ?? '').trim() || facts.style;
  return `${TUNE_DECLARATION}. Style ${style}, seed ${facts.seed >>> 0}.`;
}

/** The c2pa.created step for a file whose whole essence is one music generator track. */
export function tuneCreatedAction(facts: TuneTrackFacts): {
  action: 'c2pa.created';
  digitalSourceType: string;
  description: string;
  parameters: Record<string, unknown>;
} {
  return {
    action: 'c2pa.created',
    digitalSourceType: TUNE_SOURCE_TYPE,
    description: tuneDeclaration(facts),
    parameters: { source: 'lolly-music-generator', style: facts.style, seed: facts.seed >>> 0 },
  };
}

/** True when a created step's description is the music generator's declaration. */
export function isTuneDeclaration(description: unknown): boolean {
  return typeof description === 'string' && description.startsWith(TUNE_DECLARATION);
}

/**
 * The identifier a tune ingredient records: `sha256:` and the hex digest of the
 * tune's canonical recipe bytes (the web shell's lofiTuneBytes). A reader holding
 * the saved tune hashes its bytes and compares.
 */
export function tuneSourceId(hash: Uint8Array): string {
  if (!(hash instanceof Uint8Array) || hash.length !== 32) throw new Error('tune provenance: the recipe hash must be a 32-byte SHA-256 digest');
  let hex = '';
  for (const b of hash) hex += b.toString(16).padStart(2, '0');
  return `sha256:${hex}`;
}

/** What a saved tune's ingredient records beyond its name and digest. */
export interface TuneIngredientFacts {
  origin: TuneOrigin;
  /** The engine version that rendered the tune into this file. */
  engineVersion: string;
  /** Who made the tune, as the saved tune records the maker. A statement of fact, not a rights claim. */
  maker?: string;
  /** The licence the maker set on the tune: its name, and a public page for its terms. */
  licence?: { name: string; url?: string };
}

const publicUrl = (value: string | undefined): string | undefined =>
  typeof value === 'string' && /^https?:\/\/[^\s]+$/i.test(value) && value.length <= 2048 ? value : undefined;

/**
 * The source ingredient for a saved tune used in an export. It records the tune's
 * name, its identifier (`tuneSourceId`, the digest of its recipe), how it was made
 * and the engine version that rendered it, and the maker and licence only when the
 * tune records them.
 *
 * As for a rondocode song, the digest travels as the ingredient's `instanceID`, not
 * as a hashed data reference: C2PA binds a data hash to a URL where those bytes can
 * be fetched, and a tune on someone's device has no such URL. For the same reason no
 * `tools.lolly.rights` record is attached (it needs a public source address), so the
 * licence travels in the description, with its terms page as the informational URI.
 */
export function tuneIngredient(args: { name: string; hash: Uint8Array; facts: TuneIngredientFacts }): SourceIngredient {
  const { facts } = args;
  const maker = (facts.maker ?? '').trim().slice(0, MAX_MAKER);
  const licence = (facts.licence?.name ?? '').trim();
  const terms = licence ? publicUrl(facts.licence?.url) : undefined;
  const description = `${INGREDIENT_OPENING[facts.origin]}, composed and rendered on the device from its recipe by Lolly engine ${facts.engineVersion}.`
    + (maker ? ` Made by ${maker}.` : '')
    + (licence ? ` Licence: ${licence}.` : '');
  return {
    credential: 'none',
    title: (args.name.trim() || 'Untitled tune').slice(0, MAX_TITLE),
    format: 'application/json',
    relationship: 'componentOf',
    instanceId: tuneSourceId(args.hash),
    description: description.length > MAX_DESCRIPTION ? `${description.slice(0, MAX_DESCRIPTION - 1)}…` : description,
    ...(terms ? { informationalUri: terms } : {}),
    digitalSourceType: TUNE_SOURCE_TYPE,
  };
}

/** True for an ingredient record that describes a saved tune (written by `tuneIngredient`). */
export function isTuneIngredient(record: { instanceId?: string; description?: string; digitalSourceType?: unknown }): boolean {
  const description = record.description ?? '';
  return /^sha256:[0-9a-f]{64}$/.test(record.instanceId ?? '')
    && Object.values(INGREDIENT_OPENING).some((opening) => description.startsWith(opening))
    && typeof record.digitalSourceType === 'string' && record.digitalSourceType.endsWith('/algorithmicMedia');
}
