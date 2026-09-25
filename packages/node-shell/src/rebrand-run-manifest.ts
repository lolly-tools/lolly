// SPDX-License-Identifier: MPL-2.0
/**
 * The folder-run manifest for bulk renovation (plan 274 section 5).
 *
 * `lolly rebrand` over a folder is a long run that a person will interrupt: a
 * laptop sleeps, a terminal closes, one deck fails while nine are fine. The run
 * therefore keeps its own record beside the output, `<outDir>/.lolly-rebrand-run.json`,
 * holding one entry per input file:
 *
 *   - the input path and the sha256 of its bytes, so a file edited between two
 *     runs is recognised and starts again from ingest rather than resuming onto
 *     stale work;
 *   - `pending`, `ready`, `needs-review` or `failed`, where `needs-review` is not
 *     a success and `failed` carries a stable error code from the contract;
 *   - the checkpoint stage that file reached, and the output paths written for it.
 *
 * `resume()` answers one question: which inputs named in this run still need
 * work. It returns the pending entries, the entries whose input changed (reset to
 * `pending`), and the failures whose code describes a condition a person can
 * change between two runs - the master was missing, the disk was full, the export
 * failed, the text reader was missing. Only a failure that repeats for the same
 * bytes is left alone: a file that could not be read, an encrypted file, a plan
 * that does not match its source. A `needs-review` file waits for a person, so it
 * is not offered as work either. Entries left over from an earlier run over other
 * files stay in the document for the summary, and `resume()` does not offer them.
 *
 * Writes go through `writeAtomic` from the project store: a temp file in the same
 * directory, then a rename. A final output is written the same way, so a
 * half-written deck never appears under its real name, and it never replaces an
 * existing file: the name is claimed with an exclusive create, so two writes of
 * one name land on two files, a collision takes a numeric suffix, and the entry
 * records both the requested and the written name. `{ overwrite: true }` is the
 * caller stating the opposite intent.
 *
 * A manifest that cannot be read is not a manifest that is missing. An existing
 * file this version cannot parse is moved aside rather than overwritten, and the
 * path it went to is on the returned object, because the alternative is erasing
 * the record of a run whose outputs are in that directory.
 */

import { createHash } from 'node:crypto';
import { basename, dirname, join, isAbsolute, normalize, sep } from 'node:path';

import type { ProjectStageV1, RebrandErrorCodeV1 } from '@lolly-tools/core';
import { PROJECT_STAGES, REBRAND_ERROR_CODES } from '@lolly-tools/core';

import {
  createMutex,
  nodeRebrandFs,
  writeAtomic,
  type RebrandFsV1,
  type RebrandStoreOptionsV1,
} from './rebrand-project-store.ts';

/** The manifest file name, inside the run's output directory. */
export const RUN_MANIFEST_FILE = '.lolly-rebrand-run.json';
/** Format stamp of the manifest document. */
export const RUN_MANIFEST_VERSION = 1 as const;
/** How many numeric suffixes one output name may take before the run gives up. */
const MAX_COLLISION_SUFFIX = 9999;

/** `pending` is the fourth state a run needs on top of the contract's three outcomes. */
export const RUN_OUTCOMES = ['pending', 'ready', 'needs-review', 'failed'] as const;
export type RunOutcomeV1 = (typeof RUN_OUTCOMES)[number];

/**
 * Failures that repeat for the same input bytes and the same plan. A rerun over
 * unchanged bytes produces the same result, so `resume()` leaves these files
 * failed and names them in the summary instead.
 */
export const RUN_PERMANENT_ERROR_CODES: readonly RebrandErrorCodeV1[] = [
  'source.unreadable',
  'source.encrypted',
  'plan.hash-mismatch',
  'plan.invalid',
];

/**
 * Everything else a run can fail on describes the machine, the design system or
 * the moment, all of which a person changes between two runs: adding the missing
 * master or logo, freeing disk, installing the text reader. Deriving the list
 * from the contract means a new error code is offered again by default, and the
 * test pins both lists so the next one added has to be classified.
 */
export const RUN_RETRYABLE_ERROR_CODES: readonly RebrandErrorCodeV1[] = REBRAND_ERROR_CODES.filter(
  code => !RUN_PERMANENT_ERROR_CODES.includes(code),
);

/** One input file in the run. */
export interface RunFileV1 {
  input: string;
  /** `sha256:<hex>` of the input bytes, or an empty string when it could not be read. */
  hash: string;
  outcome: RunOutcomeV1;
  /** The last stage this file completed. */
  stage: ProjectStageV1;
  /** Final output paths written for this file, in the order they were written. */
  outputs: string[];
  errorCode?: RebrandErrorCodeV1;
  message?: string;
  /** Requested versus written name, whenever a collision moved an output aside. */
  collisions?: Array<{ requested: string; written: string }>;
  at?: string;
}

/** The manifest document as it sits on disk. */
export interface RunManifestDocV1 {
  version: typeof RUN_MANIFEST_VERSION;
  outDir: string;
  createdAt: string;
  updatedAt: string;
  files: RunFileV1[];
}

/** What `markOutcome` may change about one file. */
export interface RunMarkV1 {
  outcome?: RunOutcomeV1;
  stage?: ProjectStageV1;
  /** Replaces the recorded outputs when given. */
  outputs?: string[];
  errorCode?: RebrandErrorCodeV1;
  message?: string;
}

/** Where an output went, and whether the name moved. */
export interface RunOutputResultV1 {
  path: string;
  /** The name the caller asked for, when a collision moved it. */
  requested?: string;
  suffixed: boolean;
  overwritten: boolean;
}

export interface RunManifestV1 {
  /** The manifest file path. */
  readonly path: string;
  /** The output directory the run writes into. */
  readonly outDir: string;
  /**
   * Where an unreadable earlier manifest was moved, or null when there was none.
   * A caller that sees a path here is looking at a directory that already holds
   * outputs whose record this version could not read.
   */
  readonly setAside: string | null;
  /** A copy of the current document. */
  doc(): RunManifestDocV1;
  /** A copy of one entry, or null when that input is not in the run. */
  file(input: string): RunFileV1 | null;
  /** Records an outcome, a stage, outputs or an error code for one input. */
  markOutcome(input: string, mark: RunMarkV1): Promise<RunFileV1 | null>;
  /** Re-hashes this run's inputs; returns the entries that still need work. */
  resume(): Promise<RunFileV1[]>;
  /** Writes one finished output under `outDir` and records it against the input. */
  writeOutput(input: string, name: string, bytes: Uint8Array | string, opts?: { overwrite?: boolean }): Promise<RunOutputResultV1>;
}

/** Options `createRunManifest` takes. */
export interface RunManifestOptionsV1 extends RebrandStoreOptionsV1 {
  inputs: string[];
}

function isStage(value: unknown): value is ProjectStageV1 {
  return typeof value === 'string' && (PROJECT_STAGES as readonly string[]).includes(value);
}

function isOutcome(value: unknown): value is RunOutcomeV1 {
  return typeof value === 'string' && (RUN_OUTCOMES as readonly string[]).includes(value);
}

function isErrorCode(value: unknown): value is RebrandErrorCodeV1 {
  return typeof value === 'string' && (REBRAND_ERROR_CODES as readonly string[]).includes(value);
}

/** True when a failed entry is worth offering again. */
export function isRetryable(entry: RunFileV1): boolean {
  if (entry.outcome !== 'failed') return false;
  if (!entry.errorCode) return true;
  return RUN_RETRYABLE_ERROR_CODES.includes(entry.errorCode);
}

/** `sha256:<hex>` over a file's bytes, or an empty string when it cannot be read. */
export async function hashInput(fs: RebrandFsV1, path: string): Promise<string> {
  try {
    const bytes = await fs.readFile(path);
    return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  } catch {
    return '';
  }
}

/** A fresh entry for one input, before any stage has run. */
function pendingEntry(input: string, hash: string, at: string): RunFileV1 {
  if (!hash) {
    return {
      input,
      hash,
      outcome: 'failed',
      stage: 'ingest',
      outputs: [],
      errorCode: 'source.unreadable',
      message: 'This file could not be read.',
      at,
    };
  }
  return { input, hash, outcome: 'pending', stage: 'ingest', outputs: [], at };
}

/** Read one entry out of a parsed manifest, dropping whatever does not fit. */
function normaliseEntry(raw: unknown): RunFileV1 | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.input !== 'string' || !rec.input) return null;
  const outputs = Array.isArray(rec.outputs) ? rec.outputs.filter((p): p is string => typeof p === 'string') : [];
  const collisions = Array.isArray(rec.collisions)
    ? rec.collisions.flatMap(c => {
        const pair = c as { requested?: unknown; written?: unknown } | null;
        return pair && typeof pair.requested === 'string' && typeof pair.written === 'string'
          ? [{ requested: pair.requested, written: pair.written }]
          : [];
      })
    : [];
  return {
    input: rec.input,
    hash: typeof rec.hash === 'string' ? rec.hash : '',
    outcome: isOutcome(rec.outcome) ? rec.outcome : 'pending',
    stage: isStage(rec.stage) ? rec.stage : 'ingest',
    outputs,
    ...(isErrorCode(rec.errorCode) ? { errorCode: rec.errorCode } : {}),
    ...(typeof rec.message === 'string' ? { message: rec.message } : {}),
    ...(collisions.length ? { collisions } : {}),
    ...(typeof rec.at === 'string' ? { at: rec.at } : {}),
  };
}

/** A copy a caller can sort or truncate without editing what the next save writes. */
function copyEntry(entry: RunFileV1): RunFileV1 {
  return {
    ...entry,
    outputs: [...entry.outputs],
    ...(entry.collisions ? { collisions: entry.collisions.map(c => ({ ...c })) } : {}),
  };
}

/** Split `deck.pptx` into `deck` and `.pptx` so a suffix goes before the extension. */
function splitName(name: string): { stem: string; ext: string } {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return { stem: name, ext: '' };
  return { stem: name.slice(0, dot), ext: name.slice(dot) };
}

/** A name that would write outside the run directory, or over its record, is refused. */
function checkOutputName(name: string): string {
  if (!name) throw new Error('An output name is required.');
  if (isAbsolute(name)) throw new Error(`An output name is relative to the run directory: ${name}`);
  const parts = normalize(name).split(sep);
  if (parts.includes('..')) throw new Error(`An output name cannot step outside the run directory: ${name}`);
  if (basename(name) === RUN_MANIFEST_FILE) throw new Error(`${RUN_MANIFEST_FILE} is the run's own record, not an output name.`);
  return name;
}

/** A name for the file an unreadable manifest is moved to, with no characters a filesystem argues about. */
function asideName(at: string): string {
  return `${RUN_MANIFEST_FILE}.unreadable-${at.replace(/[^0-9A-Za-z]+/g, '-')}`;
}

/**
 * Open the manifest for a run over `inputs`, creating or merging it. An input
 * already recorded with the same hash keeps its outcome, stage and outputs; one
 * whose bytes changed is reset to pending at ingest; an input that is no longer
 * in the run keeps its entry, because its outputs are still on disk.
 */
export async function createRunManifest(outDir: string, opts: RunManifestOptionsV1): Promise<RunManifestV1> {
  const fs = opts.fs ?? nodeRebrandFs;
  const now = opts.now ?? (() => new Date().toISOString());
  const queue = createMutex();
  const path = join(outDir, RUN_MANIFEST_FILE);
  const runInputs = new Set(opts.inputs);

  let priorFiles: RunFileV1[] = [];
  let priorCreatedAt: string | null = null;
  let setAside: string | null = null;
  let unreadable = false;

  let text: string | null = null;
  try {
    text = await fs.readFileText(path);
  } catch (err) {
    // A missing file is the ordinary first run. A file this process cannot read
    // is a record it must not write over.
    if ((err as { code?: unknown } | null)?.code !== 'ENOENT') unreadable = true;
  }
  if (text !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
    const raw = parsed && typeof parsed === 'object' ? (parsed as { createdAt?: unknown; files?: unknown; version?: unknown }) : null;
    if (!raw || (!Array.isArray(raw.files) && raw.version !== RUN_MANIFEST_VERSION)) {
      unreadable = true;
    } else {
      priorFiles = Array.isArray(raw.files) ? raw.files.flatMap(f => normaliseEntry(f) ?? []) : [];
      priorCreatedAt = typeof raw.createdAt === 'string' ? raw.createdAt : null;
    }
  }
  if (unreadable) {
    const aside = join(outDir, asideName(now()));
    await fs.rename(path, aside);
    setAside = aside;
  }

  const at = now();
  const byInput = new Map<string, RunFileV1>(priorFiles.map(f => [f.input, f]));
  const files: RunFileV1[] = [];
  let changed = priorCreatedAt === null;
  for (const input of opts.inputs) {
    const hash = await hashInput(fs, input);
    const before = byInput.get(input);
    byInput.delete(input);
    if (before && before.hash === hash) {
      files.push(before);
      continue;
    }
    files.push(pendingEntry(input, hash, at));
    changed = true;
  }
  // Entries from an earlier run over other files keep their record: their outputs
  // are in this directory and the summary should still account for them. They are
  // not this run's work, so `resume()` does not hand them back.
  for (const leftover of byInput.values()) files.push(leftover);

  const doc: RunManifestDocV1 = {
    version: RUN_MANIFEST_VERSION,
    outDir,
    createdAt: priorCreatedAt ?? at,
    updatedAt: at,
    files,
  };

  const save = async (): Promise<void> => {
    await queue('manifest', async () => {
      doc.updatedAt = now();
      await writeAtomic(fs, path, `${JSON.stringify(doc, null, 2)}\n`);
    });
  };
  // Opening a run that changed nothing leaves the record as it was.
  if (changed) await save();

  const find = (input: string): RunFileV1 | undefined => doc.files.find(f => f.input === input);

  return {
    path,
    outDir,
    setAside,

    doc(): RunManifestDocV1 {
      return { ...doc, files: doc.files.map(copyEntry) };
    },

    file(input: string): RunFileV1 | null {
      const entry = find(input);
      return entry ? copyEntry(entry) : null;
    },

    async markOutcome(input, mark): Promise<RunFileV1 | null> {
      const entry = find(input);
      if (!entry) return null;
      if (mark.outcome !== undefined) entry.outcome = mark.outcome;
      if (mark.stage !== undefined) entry.stage = mark.stage;
      if (mark.outputs !== undefined) entry.outputs = [...mark.outputs];
      if (mark.errorCode !== undefined) entry.errorCode = mark.errorCode;
      if (mark.message !== undefined) entry.message = mark.message;
      if (mark.outcome !== undefined && mark.outcome !== 'failed' && mark.errorCode === undefined) {
        // The sentence explained the failure, so it goes with the code rather
        // than staying under an entry that is now ready.
        delete entry.errorCode;
        if (mark.message === undefined) delete entry.message;
      }
      entry.at = now();
      await save();
      return copyEntry(entry);
    },

    async resume(): Promise<RunFileV1[]> {
      let moved = false;
      for (const entry of doc.files) {
        if (!runInputs.has(entry.input)) continue;
        const hash = await hashInput(fs, entry.input);
        // An input that is still unreadable hashes to the empty string it already
        // holds, so it is left as it is rather than restamped on every call.
        if (hash === entry.hash) continue;
        // The bytes moved (or went away), so nothing recorded against them holds.
        const fresh = pendingEntry(entry.input, hash, now());
        entry.hash = fresh.hash;
        entry.outcome = fresh.outcome;
        entry.stage = fresh.stage;
        entry.outputs = [];
        delete entry.collisions;
        if (fresh.errorCode) entry.errorCode = fresh.errorCode;
        else delete entry.errorCode;
        if (fresh.message) entry.message = fresh.message;
        else delete entry.message;
        entry.at = fresh.at;
        moved = true;
      }
      if (moved) await save();
      return doc.files
        .filter(entry => runInputs.has(entry.input))
        .filter(entry => entry.outcome === 'pending' || isRetryable(entry))
        .map(copyEntry);
    },

    async writeOutput(input, name, bytes, writeOpts): Promise<RunOutputResultV1> {
      checkOutputName(name);
      const overwrite = writeOpts?.overwrite === true;
      // One name is chosen and claimed at a time, so two finished decks written
      // together land on two files rather than on one.
      return queue('outputs', async () => {
        const entry = find(input);
        let target = join(outDir, name);
        let suffixed = false;
        let overwritten = false;
        let claimed = false;
        await fs.mkdir(dirname(target), { recursive: true });
        if (overwrite) {
          overwritten = await fs.exists(target);
        } else {
          // The claim is the check: an exclusive create either takes the name or
          // reports that someone else holds it, with no window in between.
          const { stem, ext } = splitName(name);
          let n = 1;
          while (!(await fs.createExclusive(target))) {
            n += 1;
            if (n > MAX_COLLISION_SUFFIX) {
              throw new Error(`${name} and its first ${MAX_COLLISION_SUFFIX} alternatives are all taken in this directory.`);
            }
            target = join(outDir, `${stem}-${n}${ext}`);
            suffixed = true;
          }
          claimed = true;
        }
        try {
          // The caller hands over the whole content, and the rename is the last step,
          // so the final name never holds a partial file.
          await writeAtomic(fs, target, bytes);
        } catch (err) {
          if (claimed) {
            try {
              await fs.rm(target, { force: true });
            } catch {
              /* the empty claim stays; the next write takes the next suffix */
            }
          }
          throw err;
        }
        if (entry) {
          entry.outputs = [...entry.outputs, target];
          if (suffixed) {
            entry.collisions = [...(entry.collisions ?? []), { requested: join(outDir, name), written: target }];
          }
          entry.at = now();
          await save();
        }
        return { path: target, ...(suffixed ? { requested: join(outDir, name) } : {}), suffixed, overwritten };
      });
    },
  };
}
