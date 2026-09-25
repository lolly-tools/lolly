// SPDX-License-Identifier: MPL-2.0
/**
 * A renovation project in a `.lolly` file (plan 274, work package 0b).
 *
 * `#/rebrand` owns real work before a Design document exists: the source bytes, the
 * media pulled out of them, the census, the plan and every decision a person made. That
 * work lives on the device, and the plan's answer to a device filling up or a browser
 * dropping its storage is the same one the rest of the app gives - a file the person
 * holds. This module is the writer and the reader for that file.
 *
 * It sits on top of `lib/lolly-pack.ts` rather than beside it: the envelope, the
 * integrity map, the reader gate and the way carried asset bytes are packed are all the
 * ones a `.lolly` already has, so a renovation download opens with the same guarantees
 * as a project download and needs no second format.
 *
 * Two boundaries are kept on purpose. Writing to and reading from the project store is
 * not done here: `readRenovationLolly` hands back plain values the store layer can take.
 * And the rebrand contract types are used for typing only; the parts travel as JSON and
 * are checked for readability, never repaired.
 *
 * Pure and DOM-free apart from the `Blob` the envelope builds, so the round trip runs
 * headlessly against plain data.
 */

import type {
  CompiledDeckV1,
  DeckCensusV1,
  RenovationPlanV1,
  RenovationProjectV1,
  SourceDeckV1,
} from '@lolly-tools/core';
import { assetDependency } from '../../../../engine/src/asset-version.ts';
import type { BeamAssetRecord } from './beam-pack.ts';
import {
  buildLollyFile,
  readLollyFile,
  renovationAssetRow,
  LOLLY_MAX_RENOVATION_ASSETS,
  LOLLY_RENOVATION_TOOL_ID,
  RENOVATION_PART_KINDS,
  type LollyCreator,
  type LollyRenovationPartKind,
} from './lolly-pack.ts';

/** The four big parts of a renovation, each optional until its stage has run. */
export interface RenovationPartsV1 {
  sourceDeck?: SourceDeckV1;
  census?: DeckCensusV1;
  plan?: RenovationPlanV1;
  compiled?: CompiledDeckV1;
}

/**
 * Where a media ref can sit in the renovation contracts: a picture's bytes
 * (`SourceObjectV1.media`, a slide background), the real fallback image an unsupported
 * object carried (`FidelityV1.fallbackAssetRef`), a slide preview or a supplied
 * picture (`assetRef`), the retained source file (`RenovationProjectV1.source
 * .bytesAssetRef`), and `image` - the `design:boxes` field a compiled frame's picture
 * layer uses (`deck-compile.ts` writes it on every picture row, `slide-master.ts` on the
 * master's logo furniture, which exists in no other part). Named keys rather than a scan
 * for anything hash-shaped, so what travels is decided by the contract and not a guess.
 *
 * A key added to the contracts and not added here would take pictures out of the file
 * without saying so, so each one is pinned by a test that carries a real part.
 */
const MEDIA_KEYS = new Set(['media', 'assetRef', 'fallbackAssetRef', 'bytesAssetRef', 'image']);
const MAX_WALK_DEPTH = 64;

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** A ref's base id, the name the envelope's asset closure files its bytes under. A ref
 *  whose pin cannot be read keeps its own spelling: it will find no bytes either way,
 *  and a broken link is a missing picture rather than a write that fails. */
function assetRefKey(ref: string): string {
  try { return assetDependency({ id: ref }).key; } catch { return ref; }
}

export interface RenovationPackInput {
  project: RenovationProjectV1;
  parts?: RenovationPartsV1;
  /** The user-asset record for one media ref, or null when the store no longer holds it.
   *  The returned record travels under the ref it was asked for. */
  resolveAsset?: (ref: string) => Promise<BeamAssetRecord | null>;
  /** Records already in hand, consulted before `resolveAsset` is called. */
  userAssets?: readonly BeamAssetRecord[];
  creator?: LollyCreator | null;
  appVersion?: string;
  engineVersion?: string;
}

/** One media ref as the file carries it. `bytes` is absent when the ref travelled as a
 *  reference, either because the store had nothing for it or because it was held back. */
export interface RenovationPackAsset {
  ref: string;
  bytes?: Uint8Array;
  mime: string;
  type: string;
  format: string;
  label: string;
}

/**
 * What a read renovation file hands back. The project store takes it from here.
 *
 * The record and the parts come back as the plain JSON they travelled as, checked for
 * readability and nothing else. Handing them back under the contract types would be
 * claiming a check this reader never made - it does not validate against the rebrand
 * schemas, and repairing a part is not its job - so the store is the one that judges
 * them, and it judges what the file actually said.
 */
export interface RenovationPackContents {
  id: string;
  name: string;
  project: Record<string, unknown>;
  parts: Partial<Record<LollyRenovationPartKind, Record<string, unknown>>>;
  assets: RenovationPackAsset[];
}

export interface RenovationPackResult {
  bytes: Uint8Array;
  filename: string;
  /** The refs the file names, in the order it names them. */
  assets: string[];
}

/**
 * Every media ref the project and its parts point at, in first-seen order, deduped and
 * bounded. Order is stable, so two writes of the same project produce the same list.
 *
 * `strict` is what the write path passes. The bound is there so a hostile archive cannot
 * make a reader walk forever; used on a write it would drop the person's own pictures
 * and still report a saved file, so on that side going over it is an error with a count
 * in it rather than a silent truncation.
 */
export function renovationAssetRefs(project: unknown, parts: RenovationPartsV1 = {}, opts: { strict?: boolean } = {}): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (value: unknown): void => {
    if (typeof value !== 'string' || !value) return;
    if (value.length > 2048) {
      if (opts.strict) throw new Error('This renovation points at a picture whose link is too long to save in one file.');
      return;
    }
    if (seen.has(value)) return;
    if (out.length >= LOLLY_MAX_RENOVATION_ASSETS) {
      if (opts.strict) throw new Error(`This renovation points at more than ${LOLLY_MAX_RENOVATION_ASSETS} pictures, more than one .lolly file carries.`);
      return;
    }
    seen.add(value);
    out.push(value);
  };
  const walk = (value: unknown, depth: number): void => {
    if (!value || typeof value !== 'object' || depth > MAX_WALK_DEPTH) return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (MEDIA_KEYS.has(key)) add(child);
      else walk(child, depth + 1);
    }
  };
  walk(project, 0);
  for (const kind of RENOVATION_PART_KINDS) walk(parts[kind], 0);
  return out;
}

/**
 * Write a renovation project to `.lolly` bytes: the project record, whichever big parts
 * have been written, and the bytes of the media they point at. The file carries no saved
 * session, which is why it asks for reader 4 (see `LOLLY_RENOVATION_MIN_READER`).
 *
 * A ref the store cannot supply is still recorded, as a reference with no bytes, so the
 * reader can say which picture is missing instead of the object losing its source.
 */
export async function buildRenovationLolly(input: RenovationPackInput): Promise<RenovationPackResult> {
  const project: unknown = input.project;
  if (!isRecord(project)) throw new Error('A renovation file needs its project record.');
  const id = typeof project.id === 'string' ? project.id.trim() : '';
  if (!id) throw new Error('This renovation has no id.');
  const name = typeof project.name === 'string' && project.name.trim() ? project.name.trim() : id;
  const parts = input.parts ?? {};
  const assets = renovationAssetRefs(project, parts, { strict: true });

  // Resolve the media up front rather than through `resolveUser`: the envelope calls that
  // hook only to satisfy a version pin, and a renovation ref is a content hash with no pin.
  //
  // Each record travels under the ref's BASE id, which is what the envelope's own closure
  // files it as: a `?modifier` picks a treatment, not a different picture, so it is no
  // part of an asset's identity and the store has nothing filed under it. Asking for the
  // base id is therefore also what a store can answer.
  const held = new Map((input.userAssets ?? []).map(r => [r.id, r]));
  const records: BeamAssetRecord[] = [];
  const packed = new Set<string>();
  for (const ref of assets) {
    const key = assetRefKey(ref);
    if (packed.has(key)) continue;
    const found = held.get(key) ?? held.get(ref) ?? (input.resolveAsset ? await input.resolveAsset(key) : null);
    if (found) {
      packed.add(key);
      records.push({ ...found, id: key });
    }
  }

  const built = await buildLollyFile({
    kind: 'session',
    toolId: LOLLY_RENOVATION_TOOL_ID,
    session: null,
    name,
    userAssets: records,
    renovation: { id, name, project, parts, assets },
    ...(input.creator !== undefined ? { creator: input.creator } : {}),
    ...(input.appVersion ? { appVersion: input.appVersion } : {}),
    ...(input.engineVersion ? { engineVersion: input.engineVersion } : {}),
  });
  return { bytes: new Uint8Array(await built.blob.arrayBuffer()), filename: built.filename, assets };
}

/**
 * Read a renovation `.lolly` back. Integrity is checked before anything is returned, so
 * a file whose plan was edited after it was written is refused rather than handed on;
 * the message is the envelope's own, exactly as a project file's would be.
 */
export async function readRenovationLolly(bytes: ArrayBuffer | Uint8Array): Promise<RenovationPackContents> {
  const read = await readLollyFile(bytes);
  const block = read.renovation;
  if (!block) throw new Error('This .lolly file carries no renovation project.');
  // `readLollyFile` has already refused a picture whose bytes are not in the integrity
  // map, so bytes found at a declared row's path are bytes the file vouched for.
  const assets: RenovationPackAsset[] = block.assets.map((ref) => {
    const entry = renovationAssetRow(read.manifest, ref);
    const raw = entry?.path ? read.files[entry.path] : undefined;
    return {
      ref,
      mime: entry?.mime ?? '',
      type: entry?.type ?? '',
      format: entry?.format ?? '',
      label: entry?.label ?? ref,
      ...(raw ? { bytes: raw } : {}),
    };
  });
  return { id: block.id, name: block.name, project: block.project, parts: block.parts, assets };
}
