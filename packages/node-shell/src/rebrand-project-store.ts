// SPDX-License-Identifier: MPL-2.0
/**
 * The renovation project store over a plain directory, for the CLI and the TUI
 * (plan 274 section 3.5, work package 0b).
 *
 * The web shell keeps a renovation project in `host.state` with its bytes in the
 * user asset store. A terminal has neither, so this module keeps the same record
 * in a directory the person can open, copy and back up:
 *
 *   <dir>/<encodeFsToken(id)>/project.json          the RenovationProjectV1 record
 *   <dir>/<encodeFsToken(id)>/parts/<kind>.<rev>.json the four big stage records
 *   <dir>/<encodeFsToken(id)>/assets.json           which asset refs this project claims
 *   <dir>/assets/<encodeFsToken(ref)>               the retained bytes, one copy per ref
 *
 * Three rules follow the contract in packages/core/src/rebrand-v1.ts rather than
 * the filesystem's habits:
 *
 * 1. Every write compares the caller's `expectedRevision` against the stored one
 *    and refuses a stale write with `refusal: 'stale-revision'`. A second
 *    terminal that read revision 3 cannot overwrite a decision written at
 *    revision 4. Inside one process every write against one project is queued,
 *    so two concurrent writers cannot both pass the gate. `create` claims the
 *    record name with an exclusive create, so two processes creating one id
 *    cannot both succeed either. Two processes writing an existing project still
 *    race in the window between the read and the rename; the gate narrows that
 *    window but does not close it, and closing it needs a lock file with a
 *    takeover rule, which is not built here.
 * 2. A stage record is written under a revision-stamped name and the project
 *    record is what points at it, so a refused or crashed write leaves the last
 *    committed part in place. `getPart` reads the path the record claims, never a
 *    file that no commit ever pointed at.
 * 3. Asset bytes sit in one pool under the store directory, not inside a project
 *    directory, so two projects opened from the same file share one copy. The
 *    pool file for a ref is deleted by `remove()` only when no remaining project
 *    claims that ref, and `remove()` reports both lists. A ref whose pool file
 *    could not be deleted is reported as kept, because its bytes are still there.
 *
 * Every write goes to a temp file in the target directory and is then renamed, so
 * a reader never sees half a record. A crash between the two leaves the previous
 * file intact; the temp file is removed on the way out of both failure paths.
 *
 * The filesystem is reached through the `RebrandFsV1` adapter, the same inversion
 * the Tauri state bridge uses, so a test can make `rename` throw without touching
 * a real disk. The names come from the engine's `encodeFsToken`, the codec
 * packages/node-shell/src/session-store.ts already uses, so a project id with a
 * slash or a space cannot collide with another one or reach outside the store.
 * An id whose token would name the byte pool, a temp file or a hidden directory
 * is refused, so the ids the store accepts are exactly the ones `list()` and
 * `remove()` can see.
 */

import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';

import type {
  DesignSystemSnapshotV1,
  ProjectPartKindV1,
  ProjectStageV1,
  ProjectWriteResultV1,
  RenovationProjectStoreV1,
  RenovationProjectV1,
} from '@lolly-tools/core';
import { PROJECT_PART_KINDS, PROJECT_STAGES, REBRAND_CONTRACT_VERSION } from '@lolly-tools/core';

// Deep relative import, not the `@lolly/engine` barrel: the CLI bridge reaches
// this module and the MCP function bundle follows every import from there.
import { encodeFsToken } from '../../../engine/src/fs-token.ts';

/** The project record file inside one project directory. */
export const PROJECT_FILE = 'project.json';
/** The directory holding the four stage records. */
export const PARTS_DIR = 'parts';
/** The sidecar listing the asset refs one project claims. */
export const ASSET_INDEX_FILE = 'assets.json';
/** The shared byte pool, one level up from the projects. */
export const ASSET_POOL_DIR = 'assets';
/** Prefix of a half-written file. Readers skip these. */
export const TEMP_PREFIX = '.tmp-';
/** The only shape a recorded part path may take, so a record cannot name another file. */
const PART_REL = /^parts\/[A-Za-z0-9._-]+$/;
/** Longest id or asset ref the store accepts. */
const MAX_TOKEN_LENGTH = 256;

/**
 * The filesystem calls this module makes. Node's `fs/promises` satisfies it; a
 * test passes a partial stand-in to make one call fail.
 */
export interface RebrandFsV1 {
  mkdir(path: string, opts: { recursive: true }): Promise<unknown>;
  readFile(path: string): Promise<Uint8Array>;
  readFileText(path: string): Promise<string>;
  writeFile(path: string, data: Uint8Array | string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  readdir(path: string): Promise<string[]>;
  rm(path: string, opts: { recursive?: boolean; force?: boolean }): Promise<void>;
  exists(path: string): Promise<boolean>;
  /**
   * Creates an empty file and reports whether this call was the one that made
   * it. False means the name was already taken, which is how a caller claims a
   * name without a check-then-act window.
   */
  createExclusive(path: string): Promise<boolean>;
}

/** `fs/promises` behind the adapter. */
export const nodeRebrandFs: RebrandFsV1 = {
  mkdir: (path, opts) => mkdir(path, opts),
  readFile: async path => new Uint8Array(await readFile(path)),
  readFileText: path => readFile(path, 'utf8'),
  writeFile: (path, data) => writeFile(path, data),
  rename: (from, to) => rename(from, to),
  readdir: path => readdir(path),
  rm: (path, opts) => rm(path, opts),
  exists: async path => {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  },
  createExclusive: async path => {
    try {
      await writeFile(path, '', { flag: 'wx' });
      return true;
    } catch (err) {
      if ((err as { code?: unknown } | null)?.code === 'EEXIST') return false;
      throw err;
    }
  },
};

/** Options both this store and the run manifest take. */
export interface RebrandStoreOptionsV1 {
  /** Returns the timestamp written into a record. Passed by tests so no clock is read. */
  now?: () => string;
  fs?: RebrandFsV1;
}

/** Runs one function at a time per key, in the order the calls arrived. */
export type MutexV1 = <T>(key: string, fn: () => Promise<T>) => Promise<T>;

/**
 * A queue per key. Two writes against one project in this process are ordered,
 * so the read-compare-write of the revision gate is not interleaved with itself.
 */
export function createMutex(): MutexV1 {
  const chains = new Map<string, Promise<unknown>>();
  return <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    const prior = chains.get(key) ?? Promise.resolve();
    const run = prior.then(fn, fn);
    const settled = run.then(
      () => undefined,
      () => undefined,
    );
    chains.set(key, settled);
    void settled.then(() => {
      if (chains.get(key) === settled) chains.delete(key);
    });
    return run;
  };
}

/**
 * A write refused for a reason the caller cannot recover from by re-reading. The
 * `create` path has no refusal channel in the contract, so it throws this.
 */
export class ProjectStoreError extends Error {
  code: 'project-exists' | 'invalid-id';
  constructor(code: 'project-exists' | 'invalid-id', message: string) {
    super(message);
    this.name = 'ProjectStoreError';
    this.code = code;
  }
}

/** The directory store: the contract plus the byte pool the terminal needs. */
export interface DirProjectStoreV1 extends RenovationProjectStoreV1 {
  /** The store directory this instance reads and writes. */
  readonly dir: string;
  /** The directory holding one project's files. */
  projectDir(id: string): string;
  /** Writes retained bytes into the pool and records the ref against this project. */
  putAsset(id: string, ref: string, bytes: Uint8Array): Promise<ProjectWriteResultV1>;
  /** Reads pooled bytes back, or null when the ref was never retained. */
  getAsset(ref: string): Promise<Uint8Array | null>;
  /** The refs one project claims, including its source bytes. */
  assetRefs(id: string): Promise<string[]>;
}

/** Write one file through a temp file in the same directory, then rename. */
export async function writeAtomic(fs: RebrandFsV1, path: string, data: Uint8Array | string): Promise<void> {
  const dir = dirname(path);
  const temp = join(dir, `${TEMP_PREFIX}${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.writeFile(temp, data);
    await fs.rename(temp, path);
  } catch (err) {
    // A disk that ran out mid-write leaves a partial temp file, and nothing else
    // prunes it, so the failure path removes it before the error travels on.
    try {
      await fs.rm(temp, { force: true });
    } catch {
      /* the temp file stays; readers skip it */
    }
    throw err;
  }
}

/** True when the failure is the disk refusing more bytes rather than a bug. */
export function isQuotaError(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return code === 'ENOSPC' || code === 'EDQUOT' || code === 'EFBIG';
}

function refuseQuota(err: unknown): ProjectWriteResultV1 | null {
  if (!isQuotaError(err)) return null;
  return { ok: false, refusal: 'quota', message: 'This machine refused the write; the work is still in memory.' };
}

function refuse(refusal: 'invalid-part' | 'missing-project', message: string): ProjectWriteResultV1 {
  return { ok: false, refusal, message };
}

/**
 * A project id that would name something other than one project directory under
 * the store. The reserved names matter as much as the traversal ones: an id of
 * `assets` would name the shared byte pool, and a leading dot or a temp prefix
 * would name a directory the readers skip.
 */
function checkId(id: string): string {
  if (!id || typeof id !== 'string') throw new ProjectStoreError('invalid-id', 'A project id is required.');
  if (id === '.' || id === '..') throw new ProjectStoreError('invalid-id', `"${id}" is not a project id.`);
  if (id.length > MAX_TOKEN_LENGTH) {
    throw new ProjectStoreError('invalid-id', `A project id runs to at most ${MAX_TOKEN_LENGTH} characters.`);
  }
  const token = encodeFsToken(id);
  if (token === ASSET_POOL_DIR) {
    throw new ProjectStoreError('invalid-id', `"${id}" is the name of the shared byte pool, so it is not a project id.`);
  }
  if (token.startsWith(TEMP_PREFIX) || token.startsWith('.')) {
    throw new ProjectStoreError('invalid-id', `A project id cannot start with a dot: "${id}".`);
  }
  return id;
}

/** An asset ref has to name one file in the pool, under the same rules as an id. */
function isUsableRef(ref: string): boolean {
  if (!ref || typeof ref !== 'string') return false;
  if (ref === '.' || ref === '..') return false;
  if (ref.length > MAX_TOKEN_LENGTH) return false;
  const token = encodeFsToken(ref);
  return !token.startsWith('.');
}

function isPartKind(kind: string): kind is ProjectPartKindV1 {
  return (PROJECT_PART_KINDS as readonly string[]).includes(kind);
}

function isStage(stage: string): stage is ProjectStageV1 {
  return (PROJECT_STAGES as readonly string[]).includes(stage);
}

/** Read one project record, or null when it is missing or unreadable. */
async function readRecord(fs: RebrandFsV1, path: string): Promise<RenovationProjectV1 | null> {
  let raw: unknown;
  try {
    raw = JSON.parse(await fs.readFileText(path));
  } catch {
    return null;
  }
  return normalise(raw);
}

/** The fields v1 of the record knows. Everything else on the file is carried through. */
const KNOWN_RECORD_KEYS = new Set([
  'version',
  'id',
  'name',
  'source',
  'checkpoint',
  'revision',
  'designSystem',
  'parts',
  'designSessionIds',
  'createdAt',
  'updatedAt',
  '__proto__',
]);

/**
 * Coerce a parsed file into a project. A file on disk is someone else's JSON, so
 * every field is read defensively, and a file this version cannot read is no
 * record rather than a record with invented fields: a missing design system or an
 * unknown stage would write back a document the schema refuses. A record stamped
 * with a later contract version is refused for the same reason, and the keys this
 * version does not know are carried through so a later writer does not lose them.
 */
function normalise(raw: unknown): RenovationProjectV1 | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Partial<RenovationProjectV1> & Record<string, unknown>;
  if (typeof rec.version === 'number' && rec.version > REBRAND_CONTRACT_VERSION) return null;
  if (typeof rec.id !== 'string' || !rec.id) return null;
  const source = rec.source && typeof rec.source === 'object' ? rec.source : null;
  if (!source || typeof source.hash !== 'string') return null;
  const design = rec.designSystem as DesignSystemSnapshotV1 | undefined;
  if (!design || typeof design !== 'object' || typeof design.id !== 'string' || !design.id) return null;
  const rawStage = rec.checkpoint && typeof rec.checkpoint === 'object' ? String(rec.checkpoint.stage) : '';
  if (!isStage(rawStage)) return null;
  const parts = rec.parts && typeof rec.parts === 'object' ? rec.parts : {};
  const clean: RenovationProjectV1['parts'] = {};
  for (const kind of PROJECT_PART_KINDS) {
    const value = (parts as Record<string, unknown>)[kind];
    if (typeof value === 'string' && PART_REL.test(value)) clean[kind] = value;
  }
  const extras: Record<string, unknown> = {};
  for (const key of Object.keys(rec)) {
    if (!KNOWN_RECORD_KEYS.has(key)) extras[key] = rec[key];
  }
  return {
    ...extras,
    version: REBRAND_CONTRACT_VERSION,
    id: rec.id,
    name: typeof rec.name === 'string' ? rec.name : '',
    source,
    checkpoint: {
      stage: rawStage,
      ...(typeof rec.checkpoint?.at === 'string' ? { at: rec.checkpoint.at } : {}),
      ...(typeof rec.checkpoint?.planRevision === 'number' ? { planRevision: rec.checkpoint.planRevision } : {}),
    },
    revision: typeof rec.revision === 'number' && rec.revision >= 0 ? rec.revision : 0,
    designSystem: design,
    parts: clean,
    designSessionIds: Array.isArray(rec.designSessionIds) ? rec.designSessionIds.filter(s => typeof s === 'string') : [],
    ...(typeof rec.createdAt === 'string' ? { createdAt: rec.createdAt } : {}),
    ...(typeof rec.updatedAt === 'string' ? { updatedAt: rec.updatedAt } : {}),
  };
}

/**
 * A directory store. `dir` is created on the first write; reading an absent
 * directory returns an empty list rather than throwing, because a first run has
 * no projects yet.
 */
export function createDirProjectStore(dir: string, opts: RebrandStoreOptionsV1 = {}): DirProjectStoreV1 {
  const fs = opts.fs ?? nodeRebrandFs;
  const now = opts.now ?? (() => new Date().toISOString());
  const queue = createMutex();

  const projectDir = (id: string): string => join(dir, encodeFsToken(checkId(id)));
  const recordPath = (id: string): string => join(projectDir(id), PROJECT_FILE);
  const assetIndexPath = (id: string): string => join(projectDir(id), ASSET_INDEX_FILE);
  const poolPath = (ref: string): string => join(dir, ASSET_POOL_DIR, encodeFsToken(ref));

  /** Directory names under the store that could hold a project. */
  async function projectDirNames(): Promise<string[]> {
    let names: string[];
    try {
      names = await fs.readdir(dir);
    } catch {
      return [];
    }
    return names.filter(name => name !== ASSET_POOL_DIR && !name.startsWith(TEMP_PREFIX) && !name.startsWith('.'));
  }

  /**
   * The record for one id, or null when the file is missing, unreadable, or
   * holds another project. The last case is not academic: on a case-insensitive
   * filesystem `DECK` and `deck` name one directory, and without this check a
   * write or a `remove` for one id would land on the other project.
   */
  async function readRecordFor(id: string): Promise<RenovationProjectV1 | null> {
    let path: string;
    try {
      path = recordPath(id);
    } catch {
      return null;
    }
    const project = await readRecord(fs, path);
    if (!project || project.id !== id) return null;
    return project;
  }

  async function readAssetIndex(projectPath: string): Promise<string[]> {
    try {
      const raw: unknown = JSON.parse(await fs.readFileText(join(projectPath, ASSET_INDEX_FILE)));
      const refs = (raw as { refs?: unknown } | null)?.refs;
      if (!Array.isArray(refs)) return [];
      return refs.filter((r): r is string => typeof r === 'string' && isUsableRef(r));
    } catch {
      return [];
    }
  }

  /**
   * Every ref one project holds: the sidecar in the directory the record was read
   * from, plus the source bytes it points at. The directory travels with the
   * record, so a project directory the person renamed keeps its claims.
   */
  async function refsOf(project: RenovationProjectV1 | null, projectPath: string): Promise<string[]> {
    const refs = new Set(await readAssetIndex(projectPath));
    const sourceRef = project?.source.bytesAssetRef;
    if (typeof sourceRef === 'string' && isUsableRef(sourceRef)) refs.add(sourceRef);
    return [...refs].sort();
  }

  async function writeRecord(project: RenovationProjectV1): Promise<void> {
    await writeAtomic(fs, recordPath(project.id), `${JSON.stringify(project, null, 2)}\n`);
  }

  /**
   * The revision gate every write shares: read, compare, hand the caller the
   * record it may now bump. A missing project and a stale revision are the two
   * refusals a caller can act on.
   */
  async function guard(
    id: string,
    expectedRevision: number,
  ): Promise<{ ok: true; project: RenovationProjectV1 } | { ok: false; result: ProjectWriteResultV1 }> {
    const project = await readRecordFor(id);
    if (!project) {
      return { ok: false, result: refuse('missing-project', `No project ${id} in this store.`) };
    }
    if (project.revision !== expectedRevision) {
      return {
        ok: false,
        result: {
          ok: false,
          refusal: 'stale-revision',
          message: `This project moved on: it is at revision ${project.revision}, the write was written against ${expectedRevision}.`,
          currentRevision: project.revision,
        },
      };
    }
    return { ok: true, project };
  }

  async function commit(project: RenovationProjectV1): Promise<ProjectWriteResultV1> {
    const next: RenovationProjectV1 = { ...project, revision: project.revision + 1, updatedAt: now() };
    try {
      await writeRecord(next);
    } catch (err) {
      const quota = refuseQuota(err);
      if (quota) return quota;
      throw err;
    }
    return { ok: true, revision: next.revision };
  }

  /** Remove a staged or superseded part file, leaving the store usable if it fails. */
  async function dropStaged(path: string): Promise<void> {
    try {
      await fs.rm(path, { force: true });
    } catch {
      /* the file stays; the record does not point at it */
    }
  }

  /** A part file the record claims, resolved under the project directory. */
  function partPathFor(id: string, rel: string): string | null {
    if (!PART_REL.test(rel)) return null;
    const [, file] = rel.split('/');
    if (!file) return null;
    return join(projectDir(id), PARTS_DIR, file);
  }

  return {
    dir,
    projectDir,

    async list(): Promise<RenovationProjectV1[]> {
      const out: RenovationProjectV1[] = [];
      for (const name of await projectDirNames()) {
        const project = await readRecord(fs, join(dir, name, PROJECT_FILE));
        if (project) out.push(project);
      }
      return out.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    },

    async get(id: string): Promise<RenovationProjectV1 | null> {
      // The contract types this as a read that answers null, so a bad id is an
      // answer of null here rather than a throw. `create` and `remove` keep the
      // throw, because neither has a null channel.
      return readRecordFor(id);
    },

    async create(input): Promise<RenovationProjectV1> {
      checkId(input.id);
      return queue(input.id, async () => {
        const path = recordPath(input.id);
        await fs.mkdir(dirname(path), { recursive: true });
        // The claim is the check. An exclusive create either takes the name or
        // reports that it is taken, with no window in between, so two processes
        // creating one id cannot both walk away thinking they made it.
        if (!(await fs.createExclusive(path))) {
          throw new ProjectStoreError('project-exists', `A project ${input.id} is already in this store.`);
        }
        const at = now();
        const project: RenovationProjectV1 = {
          version: REBRAND_CONTRACT_VERSION,
          id: input.id,
          name: input.name,
          source: input.source,
          // No `at`: nothing has completed yet, so recovery resumes at ingest itself
          // (lifecycle.ts treats a stamped checkpoint as a finished stage).
          checkpoint: { stage: 'ingest' },
          revision: 1,
          designSystem: input.designSystem,
          parts: {},
          designSessionIds: [],
          createdAt: input.createdAt ?? at,
          updatedAt: input.updatedAt ?? at,
        };
        try {
          await writeRecord(project);
        } catch (err) {
          // The claim is an empty file no reader can use. It goes, rather than
          // holding the id against the next attempt.
          await dropStaged(path);
          throw err;
        }
        return project;
      });
    },

    async update(id, expectedRevision, patch): Promise<ProjectWriteResultV1> {
      // The patch is checked before the gate, so a patch this store would have to
      // read back as something else is refused rather than written.
      if (patch.checkpoint !== undefined && !isStage(String(patch.checkpoint.stage))) {
        return refuse('invalid-part', `${String(patch.checkpoint.stage)} is not a renovation stage.`);
      }
      if (patch.parts !== undefined) {
        for (const [kind, value] of Object.entries(patch.parts)) {
          if (!isPartKind(kind)) return refuse('invalid-part', `${kind} is not one of the four stage records.`);
          if (typeof value !== 'string' || !PART_REL.test(value)) {
            return refuse('invalid-part', `${kind} points at ${String(value)}, which is not a part file in this project.`);
          }
        }
      }
      if (patch.designSystem !== undefined && !patch.designSystem?.id) {
        return refuse('invalid-part', 'A project keeps the design system it was renovated against.');
      }
      return queue(id, async () => {
        const gate = await guard(id, expectedRevision);
        if (!gate.ok) return gate.result;
        // Field by field, so an unexpected key in the patch cannot reach the record
        // and neither can a prototype key.
        const merged: RenovationProjectV1 = {
          ...gate.project,
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.source !== undefined ? { source: patch.source } : {}),
          ...(patch.checkpoint !== undefined ? { checkpoint: patch.checkpoint } : {}),
          ...(patch.designSystem !== undefined ? { designSystem: patch.designSystem } : {}),
          ...(patch.parts !== undefined ? { parts: patch.parts } : {}),
          ...(patch.designSessionIds !== undefined ? { designSessionIds: patch.designSessionIds } : {}),
          ...(patch.createdAt !== undefined ? { createdAt: patch.createdAt } : {}),
        };
        return commit(merged);
      });
    },

    async putPart(id, expectedRevision, kind, value): Promise<ProjectWriteResultV1> {
      if (!isPartKind(kind)) {
        return refuse('invalid-part', `${String(kind)} is not one of the four stage records.`);
      }
      return queue(id, async () => {
        const gate = await guard(id, expectedRevision);
        if (!gate.ok) return gate.result;
        // The part goes to a name stamped with the revision this write would
        // commit, so the record is what makes it the current one. A refusal or a
        // crash before the record is written leaves the last committed part in place.
        const nextRevision = gate.project.revision + 1;
        const rel = `${PARTS_DIR}/${kind}.${nextRevision}.json`;
        const staged = partPathFor(id, rel);
        if (!staged) return refuse('invalid-part', `${kind} could not be written under this project.`);
        const previous = gate.project.parts[kind];
        try {
          await writeAtomic(fs, staged, `${JSON.stringify(value, null, 2)}\n`);
        } catch (err) {
          const quota = refuseQuota(err);
          if (quota) return quota;
          throw err;
        }
        let result: ProjectWriteResultV1;
        try {
          result = await commit({ ...gate.project, parts: { ...gate.project.parts, [kind]: rel } });
        } catch (err) {
          await dropStaged(staged);
          throw err;
        }
        if (!result.ok) {
          await dropStaged(staged);
          return result;
        }
        if (previous && previous !== rel) {
          const old = partPathFor(id, previous);
          if (old) await dropStaged(old);
        }
        return result;
      });
    },

    async getPart<T = unknown>(id: string, kind: ProjectPartKindV1): Promise<T | null> {
      if (!isPartKind(kind)) return null;
      const project = await readRecordFor(id);
      const rel = project?.parts[kind];
      if (!rel) return null;
      const path = partPathFor(id, rel);
      if (!path) return null;
      try {
        return JSON.parse(await fs.readFileText(path)) as T;
      } catch {
        return null;
      }
    },

    async checkpoint(id, expectedRevision, stage, planRevision): Promise<ProjectWriteResultV1> {
      if (!isStage(stage)) {
        return refuse('invalid-part', `${String(stage)} is not a renovation stage.`);
      }
      return queue(id, async () => {
        const gate = await guard(id, expectedRevision);
        if (!gate.ok) return gate.result;
        return commit({
          ...gate.project,
          checkpoint: { stage, at: now(), ...(planRevision !== undefined ? { planRevision } : {}) },
        });
      });
    },

    async putAsset(id, ref, bytes): Promise<ProjectWriteResultV1> {
      if (!isUsableRef(ref)) return refuse('invalid-part', `${String(ref)} is not an asset ref.`);
      // The sidecar is read, added to and written back, so two calls for one
      // project are queued behind each other; without that, a Promise.all over a
      // deck's retained media would record one ref and orphan the rest.
      return queue(id, async () => {
        const project = await readRecordFor(id);
        if (!project) return refuse('missing-project', `No project ${id} in this store.`);
        try {
          await writeAtomic(fs, poolPath(ref), bytes);
          const refs = new Set(await readAssetIndex(projectDir(id)));
          refs.add(ref);
          await writeAtomic(fs, assetIndexPath(id), `${JSON.stringify({ refs: [...refs].sort() }, null, 2)}\n`);
        } catch (err) {
          const quota = refuseQuota(err);
          if (quota) return quota;
          throw err;
        }
        return { ok: true, revision: project.revision };
      });
    },

    async getAsset(ref): Promise<Uint8Array | null> {
      if (!isUsableRef(ref)) return null;
      try {
        return await fs.readFile(poolPath(ref));
      } catch {
        return null;
      }
    },

    async assetRefs(id): Promise<string[]> {
      let path: string;
      try {
        path = projectDir(id);
      } catch {
        return [];
      }
      return refsOf(await readRecordFor(id), path);
    },

    async remove(id): Promise<{ removedAssetRefs: string[]; keptAssetRefs: string[] }> {
      checkId(id);
      return queue(id, async () => {
        const removedAssetRefs: string[] = [];
        const keptAssetRefs: string[] = [];
        const here = projectDir(id);
        const onDisk = await readRecord(fs, join(here, PROJECT_FILE));
        // A record that names another project is a neighbour answering for this
        // id, which a case-insensitive filesystem arranges on its own. Deleting
        // it would take a project nobody asked about.
        if (onDisk && onDisk.id !== id) return { removedAssetRefs, keptAssetRefs };
        const mine = await refsOf(onDisk, here);
        await fs.rm(here, { recursive: true, force: true });

        // Whatever the rest of the store still claims stays; the pool holds one copy
        // of each ref, so a ref another project points at is not this one's to drop.
        const survivors = new Set<string>();
        for (const name of await projectDirNames()) {
          const otherPath = join(dir, name);
          const other = await readRecord(fs, join(otherPath, PROJECT_FILE));
          if (other && other.id === id) continue;
          for (const ref of await refsOf(other, otherPath)) survivors.add(ref);
        }

        for (const ref of mine) {
          if (survivors.has(ref)) {
            keptAssetRefs.push(ref);
            continue;
          }
          try {
            await fs.rm(poolPath(ref), { force: true });
            removedAssetRefs.push(ref);
          } catch {
            // The bytes are still on disk, so the honest answer is that this ref
            // was kept, not that it went.
            keptAssetRefs.push(ref);
          }
        }
        return { removedAssetRefs, keptAssetRefs };
      });
    },
  };
}
