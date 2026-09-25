// SPDX-License-Identifier: MPL-2.0
/**
 * The renovation project store for the web shell (plan 274 section 3.5).
 *
 * `#/rebrand` is a view, so a renovation has no Design session to hang from
 * until a compile happens. The durable unit of work is the project record: the
 * source facts, the design-system snapshot, the checkpoint and the pointers to
 * the four big parts (source deck, census, plan, compiled deck). Records go
 * through `host.state`, never `localStorage`; source bytes go through the user
 * asset store, which is what `storeUpload` injects.
 *
 * Three rules this module exists to keep:
 *
 *   1. Two tabs never overwrite each other's decisions. Every write states the
 *      revision it read; a different stored revision refuses the write and
 *      reports the current one. Writes for one project id are run one after
 *      another inside this tab, and each one reads its own record back to
 *      check that it is still the stored value.
 *   2. A quota failure is never reported as a save. The caller keeps its
 *      in-memory value and can offer a `.lolly` download of it.
 *   3. The project record stays small. A census or a compiled deck is its own
 *      record, loaded on demand through `getPart`.
 *
 * Everything the DOM or the bridge owns arrives through `deps`, so the store
 * runs against `createMockHost` from the tool-author SDK with no browser.
 * See README.md in this directory for the keys and what is disposable.
 */
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { PPTX_READER_SINCE } from '@lolly/engine';
import {
  PROJECT_PART_KINDS,
  PROJECT_THUMB_SVG_MAX,
  REBRAND_CONTRACT_VERSION,
  type CompiledDeckV1,
  type DeckCensusV1,
  type ProjectPartKindV1,
  type ProjectStageV1,
  type ProjectWriteResultV1,
  type RenovationPlanV1,
  type RenovationProjectStoreV1,
  type RenovationProjectV1,
  type SourceDeckV1,
} from '../../../../../packages/core/src/rebrand-v1.ts';

// ─── the source read by an older reader (plan 275 decision 24) ──────────────

/** Whether a stored source deck carries the formatting the current reader reads, and what to do if not. */
export type SourceReadFreshnessV1 =
  | { state: 'current' }
  /** Read the retained bytes again: the source was read before paragraph formatting was. */
  | { state: 're-read'; assetRef: string }
  /** Nothing to read again from: the report says so, and nothing is invented. */
  | { state: 'not-read'; message: string };

/** The sentence the report carries when a stored source cannot be read again. */
export const FORMATTING_NOT_READ_MESSAGE = 'Formatting and drawings were not read from this source; open the file again to carry them.';

/** `a.b.c` as three numbers; anything after the patch number (`+rebuild`) is ignored. */
function versionParts(version: string): [number, number, number] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/**
 * Was this pptx source read by a reader older than the one that resolves bullets,
 * numbering, alignment, spacing, strike, baseline and letter case (plan 275 section
 * 7.2) and reads SVG pictures and custom geometry as drawings (decision 32)? A reader
 * version is the engine version it ran under. Such a source is read
 * again on open when the project retained its bytes; otherwise the project opens as
 * it is and the report says formatting was not read. A pdf source, and one read by
 * this reader or a later one, is current.
 */
export function sourceReadFreshness(
  project: Pick<RenovationProjectV1, 'source'>,
  source: Pick<SourceDeckV1, 'source' | 'reader'>,
  since: string = PPTX_READER_SINCE,
): SourceReadFreshnessV1 {
  if (source.source.kind !== 'pptx') return { state: 'current' };
  const read = versionParts(source.reader.version);
  const floor = versionParts(since);
  if (read && floor) {
    const newer = read[0] !== floor[0] ? read[0] > floor[0] : read[1] !== floor[1] ? read[1] > floor[1] : read[2] >= floor[2];
    if (newer) return { state: 'current' };
  }
  if (project.source.bytesAssetRef) return { state: 're-read', assetRef: project.source.bytesAssetRef };
  return { state: 'not-read', message: FORMATTING_NOT_READ_MESSAGE };
}

/**
 * One prefix for every record this journey writes. A project is
 * `__rebrand__:project:<id>`; a part is `__rebrand__:part:<id>:<kind>`.
 */
export const REBRAND_SLOT_PREFIX = '__rebrand__:';

const PROJECT_SLOT_PREFIX = `${REBRAND_SLOT_PREFIX}project:`;

export const projectSlot = (id: string): string => `${PROJECT_SLOT_PREFIX}${id}`;
export const partSlot = (id: string, kind: ProjectPartKindV1): string => `${REBRAND_SLOT_PREFIX}part:${id}:${kind}`;

/** True for a slot this store owns, so a session list can hide it. */
export const isRebrandSlot = (slot: unknown): boolean =>
  typeof slot === 'string' && slot.startsWith(REBRAND_SLOT_PREFIX);

/** The part of the host bridge the store touches. `HostV1` satisfies it. */
export interface ProjectStoreHost {
  state: {
    save(slot: string, data: object): Promise<void>;
    load(slot: string): Promise<object | null>;
    list(): Promise<{ slot: string }[]>;
    delete(slot: string): Promise<void>;
  };
}

/** What a part record holds; the value stays opaque to the store. */
type PartValueV1 = SourceDeckV1 | DeckCensusV1 | RenovationPlanV1 | CompiledDeckV1;

interface ProjectRecordV1 {
  record: 'rebrand-project';
  project: RenovationProjectV1;
  /**
   * Who wrote this copy. A writer reads the record back after saving: a token
   * that is not the one just written means another writer saved after this one,
   * so the write is reported as refused rather than as a save.
   */
  writeToken?: string;
}

interface PartRecordV1 {
  record: 'rebrand-part';
  projectId: string;
  part: ProjectPartKindV1;
  value: unknown;
  /**
   * Who wrote this copy, read the same way as a project record's token. A
   * refused write puts the key back only when the token there is still its own:
   * a record another writer left belongs to the revision that was accepted.
   */
  writeToken?: string;
}

/** The shell functions the store calls, injected so a test needs no browser. */
export interface ProjectStoreDeps {
  /** ISO timestamp for `updatedAt` and a checkpoint's `at`. No clock inside the module. */
  now(): string;
  /**
   * The asset picker's `storeUserUpload`, bound to the host. Always called with
   * `batch: true`: an import must not raise the duplicate prompt, whose Back
   * history entry re-mounts the view and drops the run, and the library
   * milestone nudge waits for the next interactive upload.
   */
  storeUpload(file: File, opts: { batch: true }): Promise<AssetRef>;
  /**
   * Whether something outside this store still points at the bytes: a Design
   * session, a saved pack. Required, because "nobody asked" must not read as
   * "nothing else holds it": `remove` keeps the bytes when this throws, and a
   * caller with nothing to check answers false in one line.
   */
  referencedElsewhere(assetRef: string): Promise<boolean>;
  /** Release bytes no project and nothing else references. Best effort. */
  deleteAsset?(assetRef: string): Promise<void>;
}

export type CreateProjectInputV1 = Parameters<RenovationProjectStoreV1['create']>[0];

export interface CreateProjectOptsV1 {
  /** The source file. Stored through `storeUpload` unless `retainBytes` is false. */
  bytes?: File;
  /** False keeps the hash, name and page count and no bytes. Default true. */
  retainBytes?: boolean;
  /**
   * Replace a project already stored under this id: the old one is removed
   * first, so its parts go and its bytes are released under the usual rules.
   * Without it, an id already in use refuses with `ProjectExistsError`.
   */
  replace?: boolean;
}

/**
 * Thrown when storage refuses the first write of a project. It carries the
 * project that was built but not saved, so the view can offer the `.lolly`
 * download and the re-select path without rebuilding anything.
 */
export class ProjectQuotaError extends Error {
  readonly refusal = 'quota' as const;
  readonly project: RenovationProjectV1;
  constructor(project: RenovationProjectV1) {
    super('Storage refused the write. The project was not saved on this device.');
    this.name = 'ProjectQuotaError';
    this.project = project;
  }
}

/**
 * Thrown when `create` is given an id this device already holds. Overwriting
 * would reset the revision counter and strand the old project's part records,
 * so the caller chooses: a fresh id, or `replace: true`.
 */
export class ProjectExistsError extends Error {
  readonly refusal = 'project-exists' as const;
  readonly projectId: string;
  readonly existing: RenovationProjectV1 | null;
  constructor(projectId: string, existing: RenovationProjectV1 | null) {
    super(`A renovation project ${projectId} is already stored on this device.`);
    this.name = 'ProjectExistsError';
    this.projectId = projectId;
    this.existing = existing;
  }
}

/** The web store: the shared contract, with a create that can take the bytes. */
export interface WebRenovationProjectStore extends RenovationProjectStoreV1 {
  create(input: CreateProjectInputV1, opts?: CreateProjectOptsV1): Promise<RenovationProjectV1>;
}

/** A browser quota refusal, however the storage layer spelled it. */
function isQuotaRefusal(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: unknown; code?: unknown; message?: unknown };
  if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
  if (e.code === 22 || e.code === 1014) return true;
  return typeof e.message === 'string' && /quota/i.test(e.message);
}

const quotaResult = (): ProjectWriteResultV1 => ({
  ok: false,
  refusal: 'quota',
  message: 'Storage refused the write. Nothing was saved on this device; the work is still in memory.',
});

const missingResult = (id: string): ProjectWriteResultV1 => ({
  ok: false,
  refusal: 'missing-project',
  message: `No renovation project ${id} on this device.`,
});

const staleResult = (current: number, expected: number): ProjectWriteResultV1 => ({
  ok: false,
  refusal: 'stale-revision',
  message: `This project moved on while you were working: revision ${current} is stored, the write was made against ${expected}. Reload the project to see the newer decisions.`,
  currentRevision: current,
});

/**
 * Keys that hold an asset ref in the four part shapes: a slide background or
 * object picture, a slide preview, a raster fallback, a supplied picture in a
 * plan decision, and the retained source bytes. A catalog asset is named by
 * `{ kind: 'asset', id }` and is not collected: the catalog owns those bytes.
 */
const REF_KEYS = new Set(['assetRef', 'fallbackAssetRef', 'media', 'bytesAssetRef', 'previewAssetRef']);

const MAX_REF_DEPTH = 16;

/**
 * Every asset ref a stored part names. The walk is by key rather than by part
 * shape, so a later work package that adds a picture to the plan or to a
 * compiled deck is counted as a holder from the day that field is added, and
 * bytes it points at are not released while it still names them.
 */
function refsIn(value: unknown, into: Set<string>, depth = 0): void {
  if (depth > MAX_REF_DEPTH || !value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) refsIn(item, into, depth + 1);
    return;
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === 'string') {
      if (item && REF_KEYS.has(key)) into.add(item);
      continue;
    }
    refsIn(item, into, depth + 1);
  }
}

/**
 * A project thumbnail the record may hold: an SVG string within `PROJECT_THUMB_SVG_MAX`
 * bytes. Anything else is not written, so a list falls back to the layout wireframe
 * rather than carry a drawing the record was never meant to hold.
 */
export function thumbSvgOf(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^<svg[\s>]/.test(value)) return undefined;
  return new TextEncoder().encode(value).byteLength <= PROJECT_THUMB_SVG_MAX ? value : undefined;
}

let writeCounter = 0;
function mintToken(): string {
  writeCounter += 1;
  return `w${writeCounter}.${Math.random().toString(36).slice(2, 10)}`;
}

export function createWebProjectStore(host: ProjectStoreHost, deps: ProjectStoreDeps): WebRenovationProjectStore {
  /**
   * One chain per project id. Read, compare and save for one project run one
   * after another in this tab, so two calls in flight at once cannot both pass
   * the revision check and report a save. Another tab is a separate chain, which
   * is what the read-back token below is for.
   */
  const chains = new Map<string, Promise<void>>();

  function serialise<T>(id: string, body: () => Promise<T>): Promise<T> {
    const previous = chains.get(id) ?? Promise.resolve();
    const run = previous.then(body, body);
    const tail = run.then(
      () => undefined,
      () => undefined,
    );
    chains.set(id, tail);
    void tail.then(() => {
      if (chains.get(id) === tail) chains.delete(id);
    });
    return run;
  }

  async function readRecord(id: string): Promise<ProjectRecordV1 | null> {
    const raw = (await host.state.load(projectSlot(id))) as ProjectRecordV1 | null;
    if (raw?.record !== 'rebrand-project' || !raw.project) return null;
    return raw;
  }

  async function readProject(id: string): Promise<RenovationProjectV1 | null> {
    return (await readRecord(id))?.project ?? null;
  }

  /**
   * Save the project and read it back. False means the stored copy is someone
   * else's, so the caller reports a refusal instead of a save. Best effort
   * against another tab: it catches a write that was overtaken by the time of
   * the read, which is the case a person notices.
   */
  async function writeProject(project: RenovationProjectV1): Promise<boolean> {
    const token = mintToken();
    const record: ProjectRecordV1 = { record: 'rebrand-project', project, writeToken: token };
    await host.state.save(projectSlot(project.id), record);
    const back = await readRecord(project.id).catch(() => null);
    return back === null || back.writeToken === undefined || back.writeToken === token;
  }

  /**
   * One short write: read, compare the revision, build the next value, save it.
   * The stored project is never mutated, so a refused write leaves the caller's
   * value exactly as it was. Callers outside the chain go through `transact`.
   */
  async function transactNow(
    id: string,
    expectedRevision: number,
    change: (stored: RenovationProjectV1) => RenovationProjectV1,
  ): Promise<ProjectWriteResultV1> {
    const stored = await readProject(id);
    if (!stored) return missingResult(id);
    if (stored.revision !== expectedRevision) return staleResult(stored.revision, expectedRevision);
    const next: RenovationProjectV1 = {
      ...change(stored),
      id: stored.id,
      version: REBRAND_CONTRACT_VERSION,
      revision: stored.revision + 1,
      updatedAt: deps.now(),
    };
    try {
      if (!(await writeProject(next))) {
        const current = await readProject(id);
        return staleResult(current?.revision ?? next.revision, expectedRevision);
      }
    } catch (err) {
      if (isQuotaRefusal(err)) return quotaResult();
      throw err;
    }
    return { ok: true, revision: next.revision };
  }

  const transact = (
    id: string,
    expectedRevision: number,
    change: (stored: RenovationProjectV1) => RenovationProjectV1,
  ): Promise<ProjectWriteResultV1> => serialise(id, () => transactNow(id, expectedRevision, change));

  async function assetRefsOf(project: RenovationProjectV1): Promise<Set<string>> {
    const refs = new Set<string>();
    if (project.source.bytesAssetRef) refs.add(project.source.bytesAssetRef);
    for (const kind of PROJECT_PART_KINDS) {
      const slot = project.parts[kind];
      if (!slot) continue;
      const raw = (await host.state.load(slot).catch(() => null)) as PartRecordV1 | null;
      if (raw && raw.record === 'rebrand-part') refsIn(raw.value, refs);
    }
    return refs;
  }

  async function list(): Promise<RenovationProjectV1[]> {
    const entries = await host.state.list();
    const projects: RenovationProjectV1[] = [];
    for (const entry of entries) {
      if (!entry?.slot?.startsWith(PROJECT_SLOT_PREFIX)) continue;
      const raw = (await host.state.load(entry.slot).catch(() => null)) as ProjectRecordV1 | null;
      if (raw && raw.record === 'rebrand-project' && raw.project) projects.push(raw.project);
    }
    // Newest first. An ISO stamp sorts as text, and a record written before
    // updatedAt existed sorts last rather than jumping to the top.
    return projects.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  }

  async function removeNow(id: string): Promise<{ removedAssetRefs: string[]; keptAssetRefs: string[] }> {
    const project = await readProject(id);
    if (!project) return { removedAssetRefs: [], keptAssetRefs: [] };
    const mine = await assetRefsOf(project);

    for (const kind of PROJECT_PART_KINDS) {
      const slot = project.parts[kind];
      if (slot) await host.state.delete(slot).catch(() => {});
    }
    await host.state.delete(projectSlot(id)).catch(() => {});

    // Read what is left AFTER the record is gone, so this project's own refs
    // cannot count as another holder.
    const held = new Set<string>();
    for (const other of await list()) {
      for (const ref of await assetRefsOf(other)) held.add(ref);
    }

    const removedAssetRefs: string[] = [];
    const keptAssetRefs: string[] = [];
    for (const ref of mine) {
      let elsewhere = held.has(ref);
      if (!elsewhere) {
        try {
          elsewhere = (await deps.referencedElsewhere(ref)) === true;
        } catch {
          // The question went unanswered, so the bytes stay. They may be the
          // only copy of a deck something else still draws from.
          elsewhere = true;
        }
      }
      if (elsewhere) {
        keptAssetRefs.push(ref);
        continue;
      }
      let released = true;
      if (deps.deleteAsset) {
        released = await deps
          .deleteAsset(ref)
          .then(() => true)
          .catch(() => false);
      }
      // A refused delete leaves the bytes on the device, so they are reported as
      // kept. The view must not tell a person that storage came back.
      (released ? removedAssetRefs : keptAssetRefs).push(ref);
    }
    return { removedAssetRefs, keptAssetRefs };
  }

  async function createNow(input: CreateProjectInputV1, opts: CreateProjectOptsV1): Promise<RenovationProjectV1> {
    const existing = await readProject(input.id);
    if (existing) {
      if (!opts.replace) throw new ProjectExistsError(input.id, existing);
      await removeNow(input.id);
    }

    const retain = opts.retainBytes !== false;
    const source = { ...input.source };
    if (!retain) delete source.bytesAssetRef;
    const at = deps.now();
    const project: RenovationProjectV1 = {
      version: REBRAND_CONTRACT_VERSION,
      id: input.id,
      name: input.name,
      source,
      // Nothing has completed yet, so the checkpoint names the stage that
      // recovery resumes at and carries no time.
      checkpoint: { stage: 'ingest' },
      revision: 1,
      designSystem: input.designSystem,
      parts: {},
      designSessionIds: [],
      createdAt: input.createdAt ?? at,
      updatedAt: at,
    };

    if (retain && opts.bytes) {
      try {
        source.bytesAssetRef = (await deps.storeUpload(opts.bytes, { batch: true })).id;
      } catch (err) {
        // Storing a deck is the largest write this journey makes, so a full
        // device shows up here first. The project goes back without the ref.
        delete source.bytesAssetRef;
        if (isQuotaRefusal(err)) throw new ProjectQuotaError(project);
        throw err;
      }
    }

    try {
      if (!(await writeProject(project))) throw new ProjectExistsError(input.id, await readProject(input.id));
    } catch (err) {
      if (isQuotaRefusal(err)) {
        // Nothing names the uploaded bytes now, and the device just said it was
        // full, so release them before handing the project back.
        const orphan = source.bytesAssetRef;
        delete source.bytesAssetRef;
        if (orphan && deps.deleteAsset) await deps.deleteAsset(orphan).catch(() => {});
        throw new ProjectQuotaError(project);
      }
      throw err;
    }
    return project;
  }

  return {
    list,

    get: readProject,

    create(input: CreateProjectInputV1, opts: CreateProjectOptsV1 = {}): Promise<RenovationProjectV1> {
      return serialise(input.id, () => createNow(input, opts));
    },

    update(id, expectedRevision, patch) {
      // Field by field, so an unexpected key in the patch cannot reach the
      // record and neither can a prototype key. `updatedAt` comes from the
      // clock, never from the patch. A thumbnail over its cap is not written.
      const thumbSvg = thumbSvgOf(patch.thumbSvg);
      return transact(id, expectedRevision, (stored) => ({
        ...stored,
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.source !== undefined ? { source: patch.source } : {}),
        ...(patch.checkpoint !== undefined ? { checkpoint: patch.checkpoint } : {}),
        ...(patch.designSystem !== undefined ? { designSystem: patch.designSystem } : {}),
        ...(patch.parts !== undefined ? { parts: patch.parts } : {}),
        ...(patch.designSessionIds !== undefined ? { designSessionIds: patch.designSessionIds } : {}),
        ...(patch.createdAt !== undefined ? { createdAt: patch.createdAt } : {}),
        ...(thumbSvg !== undefined ? { thumbSvg } : {}),
      }));
    },

    putPart(id, expectedRevision, kind, value: PartValueV1) {
      if (!PROJECT_PART_KINDS.includes(kind)) {
        return Promise.resolve<ProjectWriteResultV1>({
          ok: false,
          refusal: 'invalid-part',
          message: `"${String(kind)}" is not a part of a renovation project.`,
        });
      }
      return serialise(id, async () => {
        const stored = await readProject(id);
        if (!stored) return missingResult(id);
        if (stored.revision !== expectedRevision) return staleResult(stored.revision, expectedRevision);

        const slot = partSlot(id, kind);
        // What is at the key now, so a refused pointer write can put it back.
        // A refused write must leave the earlier decision readable.
        const previous = await host.state.load(slot).catch(() => null);
        const token = mintToken();
        const record: PartRecordV1 = { record: 'rebrand-part', projectId: id, part: kind, value, writeToken: token };
        try {
          await host.state.save(slot, record);
        } catch (err) {
          if (isQuotaRefusal(err)) return quotaResult();
          throw err;
        }
        const result = await transactNow(id, expectedRevision, (current) => ({
          ...current,
          parts: { ...current.parts, [kind]: slot },
        }));
        if (!result.ok) {
          // Put the key back the way it was, but only while it still holds this
          // write. A record another tab left there belongs to the revision that
          // was accepted, and undoing over it would drop that decision.
          const now = (await host.state.load(slot).catch(() => null)) as PartRecordV1 | null;
          if (now?.writeToken === token) {
            if (previous) await host.state.save(slot, previous).catch(() => {});
            else await host.state.delete(slot).catch(() => {});
          }
        }
        return result;
      });
    },

    async getPart<T = unknown>(id: string, kind: ProjectPartKindV1): Promise<T | null> {
      const project = await readProject(id);
      const slot = project?.parts[kind];
      if (!slot) return null;
      const raw = (await host.state.load(slot).catch(() => null)) as PartRecordV1 | null;
      // A pointer that names a record belonging to another project, or to
      // another kind, is not this part. Answer null rather than the wrong deck.
      if (raw?.record !== 'rebrand-part' || raw.projectId !== id || raw.part !== kind) return null;
      return (raw.value ?? null) as T | null;
    },

    checkpoint(id, expectedRevision, stage: ProjectStageV1, planRevision?: number) {
      return transact(id, expectedRevision, (stored) => {
        // A caller that marks a later stage without restating the plan revision
        // still belongs to the plan the earlier checkpoint named, so it is
        // carried forward rather than dropped.
        const carried = planRevision ?? stored.checkpoint.planRevision;
        return {
          ...stored,
          checkpoint: { stage, at: deps.now(), ...(carried === undefined ? {} : { planRevision: carried }) },
        };
      });
    },

    remove(id) {
      return serialise(id, () => removeNow(id));
    },
  };
}
