// SPDX-License-Identifier: MPL-2.0
/**
 * rondo-provenance.ts: what a file made from a rondocode song says about itself.
 *
 * Andy approved two machine-readable statements (2026-10-08). Both are shown to
 * the person at the moment of export and named in the public docs:
 *
 *   1. A song used in an export is recorded as a C2PA source ingredient: its
 *      name, the hash of its canonical bytes, and how it was rendered (the `vm`
 *      execution class, the renderer's version and seed), with the parts the
 *      render could not play.
 *   2. A file that holds synthesised singing declares that singing. The created
 *      step's digital source type is compositeWithTrainedAlgorithmicMedia (synth
 *      music composited with model-made voices), and its description lists the
 *      sung parts and the models. A render with no singing is algorithmicMedia:
 *      DSP running the song's own code, with no trained model involved.
 *
 * Pure: shells hash, sign and embed. This module only decides what is said, so
 * the web shell, the Node shells and the rondocode utility say the same thing.
 */
import type { SourceIngredient } from '@lolly-tools/core/host-v1';
import { ALGORITHMIC_SOURCE_TYPE, COMPOSITE_SOURCE_TYPE } from './c2pa.ts';

/** Where the song format and renderer come from, for the ingredient's informational link. */
export const RONDOCODE_URL = 'https://github.com/vijaypemmaraju/rondocode';

/** The models synthesised singing passes through, as a reader would want them named. */
export const RONDO_SINGING_MODELS = 'Supertonic-3 text to speech, a wav2vec 2.0 phoneme aligner and RVC voice conversion';

/** How a song became the audio in a file. */
export interface RondoRenderFacts {
  /** The document model's execution class the song's code ran in: `vm`. */
  executionClass: string;
  /** The renderer's version, for example `fbbf6512df37+lolly.1`. */
  version: string;
  /** The fixed seed behind any randomness the song asked for. */
  seed?: number;
  /** Synths whose singing was synthesised into this file. Empty or absent when none was. */
  sungParts?: string[];
  /** The singing voices used, for example `kizuna`. */
  voices?: string[];
  /** Parts the render could not play. */
  silentParts?: string[];
}

const list = (xs: readonly string[]): string => xs.slice(0, 12).join(', ') + (xs.length > 12 ? ` and ${xs.length - 12} more` : '');
const sung = (f: RondoRenderFacts): boolean => (f.sungParts?.length ?? 0) > 0;

/** The IPTC digital source type for audio rendered from a song. */
export function rondoDigitalSourceType(facts: RondoRenderFacts): string {
  return sung(facts) ? COMPOSITE_SOURCE_TYPE : ALGORITHMIC_SOURCE_TYPE;
}

/**
 * The human-readable declaration, for a WAV's ICMT tag and the created step's
 * description. Always says what made the sound; says AI-generated only when it is.
 */
export function rondoDeclaration(facts: RondoRenderFacts): string {
  const base = `Music computed on the device from the code of a rondocode song (${facts.executionClass} execution class, rondocode ${facts.version})`;
  if (!sung(facts)) return `${base}, with no trained model.`;
  const voices = facts.voices?.length ? `, voice ${list(facts.voices)}` : '';
  return `${base}. The singing is AI-generated (${RONDO_SINGING_MODELS}${voices}): ${list(facts.sungParts ?? [])}.`;
}

/** The c2pa.created step for a file whose whole essence is one song's render. */
export function rondoCreatedAction(facts: RondoRenderFacts): {
  action: 'c2pa.created';
  digitalSourceType: string;
  description: string;
  parameters: Record<string, unknown>;
} {
  return {
    action: 'c2pa.created',
    digitalSourceType: rondoDigitalSourceType(facts),
    description: rondoDeclaration(facts),
    parameters: {
      source: 'rondocode',
      version: facts.version,
      executionClass: facts.executionClass,
      ...(facts.seed !== undefined ? { seed: facts.seed } : {}),
      ...(sung(facts) ? { sungParts: [...(facts.sungParts ?? [])], models: RONDO_SINGING_MODELS } : {}),
      ...(facts.voices?.length ? { voices: [...facts.voices] } : {}),
      ...(facts.silentParts?.length ? { silentParts: [...facts.silentParts] } : {}),
    },
  };
}

/**
 * The identifier a song ingredient records: `sha256:` and the hex digest of the
 * song's canonical `.rondo.json` bytes (engine/src/rondo-source.ts
 * rondoSourceBytes). A reader holding the song file hashes it and compares.
 */
export function rondoSourceId(hash: Uint8Array): string {
  if (!(hash instanceof Uint8Array) || hash.length !== 32) throw new Error('rondo provenance: the song hash must be a 32-byte SHA-256 digest');
  let hex = '';
  for (const b of hash) hex += b.toString(16).padStart(2, '0');
  return `sha256:${hex}`;
}

/** The parts a render could not play: the parts of every `rondo.part.*` finding, each named once. */
export function rondoSilentParts(findings: readonly { code: string; parts: readonly string[] }[]): string[] {
  const out: string[] = [];
  for (const f of findings) {
    if (!f.code.startsWith('rondo.part.')) continue;
    for (const p of f.parts) if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

/**
 * The facts for a render through the `vm` path (a timeline clip, a soundtrack,
 * `lolly mix`). That path never synthesises singing: a sung part is silent and
 * named in the findings, so the facts carry `silentParts` and never `sungParts`.
 */
export function rondoRenderFacts(
  run: { executionClass: string; version: string; seed?: number },
  findings: readonly { code: string; parts: readonly string[] }[],
): RondoRenderFacts {
  const silentParts = rondoSilentParts(findings);
  return {
    executionClass: run.executionClass,
    version: run.version,
    ...(run.seed !== undefined ? { seed: run.seed } : {}),
    ...(silentParts.length ? { silentParts } : {}),
  };
}

/** The writer's ceiling for an ingredient description (c2pa.ts boundedText). */
const MAX_DESCRIPTION = 4096;

/**
 * The source ingredient for a song used in an export (a timeline clip, a
 * soundtrack, a tool's audio input). It records the song's name, its identifier
 * (`rondoSourceId`, the digest of its canonical bytes) and how it was rendered.
 *
 * The digest travels as the ingredient's `instanceID`, not as a hashed data
 * reference: C2PA binds a data hash to a URL where those bytes can be fetched, and
 * a song on someone's device has no such URL. The C2PA writer refuses a hash
 * without a URL, and a refused ingredient takes the whole credential down.
 *
 * The song carries no licence of its own, so no rights record is attached; the
 * creative-rights rules read that as unrecorded.
 */
export function rondoSongIngredient(args: {
  name: string;
  hash: Uint8Array;
  facts: RondoRenderFacts;
}): SourceIngredient {
  const { facts } = args;
  const seed = facts.seed !== undefined ? `, seed ${facts.seed}` : '';
  const silent = facts.silentParts?.length ? ` Not played in this render: ${list(facts.silentParts)}.` : '';
  const voice = sung(facts) ? ` Its singing is AI-generated (${RONDO_SINGING_MODELS}).` : '';
  const description = `A rondocode song (source code), rendered on the device in the ${facts.executionClass} execution class by rondocode ${facts.version}${seed}.${voice}${silent}`;
  return {
    credential: 'none',
    title: (args.name.trim() || 'Untitled song').slice(0, 200),
    format: 'application/json',
    relationship: 'componentOf',
    instanceId: rondoSourceId(args.hash),
    description: description.length > MAX_DESCRIPTION ? `${description.slice(0, MAX_DESCRIPTION - 1)}…` : description,
    informationalUri: RONDOCODE_URL,
    digitalSourceType: rondoDigitalSourceType(facts),
  };
}

/** True for an ingredient record that describes a rondocode song (written by `rondoSongIngredient`). */
export function isRondoSongIngredient(record: { informationalUri?: string; instanceId?: string; description?: string }): boolean {
  return record.informationalUri === RONDOCODE_URL
    && /^sha256:[0-9a-f]{64}$/.test(record.instanceId ?? '')
    && (record.description ?? '').startsWith('A rondocode song');
}

/** One ingredient per song: the same song placed twice, or rendered at two lengths, is one source. */
export function uniqueRondoIngredients<T extends { instanceId?: string }>(ingredients: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const ing of ingredients) {
    const key = ing.instanceId ?? '';
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(ing);
  }
  return out;
}

/**
 * The sentence a terminal or an agent reads about the songs a file's Content
 * Credentials record. Say it only after reading the written file back.
 */
export function rondoRecordedSentence(names: readonly string[]): string {
  const quoted = names.map((n) => `"${n}"`);
  const which = quoted.length === 1 ? `the song ${quoted[0]}` : `the songs ${list(quoted)}`;
  return `Content Credentials in this file record ${which}, rendered in Lolly's sandbox (the vm execution class), as a source.`;
}
