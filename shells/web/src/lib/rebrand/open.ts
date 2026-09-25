// SPDX-License-Identifier: MPL-2.0
/**
 * Opening a renovation `.lolly` on this device: the Rebrand door in plan 274 section
 * 2.1, over the renovation project of section 3.5.
 *
 * A renovation file is not a saved document. It carries a project record, whichever big
 * parts have been written, and the bytes of the pictures they point at. Landing one is
 * therefore two jobs, and this module is both of them in order:
 *
 *   1. The media go through the ordinary `.lolly` asset ingest, the same path a project
 *      file's pictures take: checksum dedup, byte-exact write, provenance kept, and a
 *      rollback when one of them fails. That ingest mints a receiver-local id per
 *      picture and hands back the sender-id to receiver-id map.
 *   2. Every asset ref inside the project record and inside each part is rebased onto
 *      those local ids, and only then is the project created and its parts written.
 *
 * Without step 2 the refs name bytes that exist on the sender's device and nowhere here,
 * and the renovation opens with every picture missing. A saved session rewrites its own
 * refs inside the ingest (`applyLollyRekey`); a renovation is stored elsewhere, which is
 * why the map comes back out instead.
 *
 * The rebase is by key, as the writer's media walk is: `media`, `assetRef`,
 * `fallbackAssetRef`, `bytesAssetRef`, `previewAssetRef` and the compiled picture
 * layer's `image`. A ref no map entry names is left alone and counted, so the caller can
 * say which pictures did not travel rather than the view showing empty boxes with no
 * reason. A catalog asset, named as `{ kind: 'asset', id }`, sits under `id` and is
 * never touched: the catalog owns those bytes on both devices.
 *
 * Three things this module refuses to do. It does not repair a record: a file whose
 * project record has no readable source or design system is turned away with a sentence,
 * because a repaired record would claim facts the file never stated. It does not
 * overwrite: an id this device already holds gets a fresh one and the caller is told, so
 * a second copy of a deck never sits on top of the decisions made in the first. And it
 * does not mark a stage complete over parts that were not written, so a refused part
 * write leaves the project at the stage whose work is actually here.
 *
 * The `#/rebrand` route is returned, never navigated to: the view that consumes it is
 * the next milestone, and the caller owns navigation either way.
 */
import type {
  DesignSystemSnapshotV1,
  ProjectPartKindV1,
  ProjectStageV1,
  RenovationProjectStoreV1,
  RenovationProjectV1,
} from '@lolly-tools/core';
import { PROJECT_PART_KINDS, PROJECT_STAGES, SOURCE_KINDS } from '@lolly-tools/core';
import { assetDependency } from '../../../../../engine/src/asset-version.ts';
import type { BeamPackHost } from '../beam-pack.ts';
import {
  ingestLollyFile,
  readLollyFile,
  type LollyFileContents,
  type LollyIngestProgress,
  type LollyProjectFolderSink,
} from '../lolly-pack.ts';
import { STAGE_PART, type StagePartValueV1 } from './lifecycle.ts';

/**
 * Keys that hold an asset ref in the project record and in the four parts: a picture or
 * a slide background (`media`), a slide preview or a supplied picture in a plan decision
 * (`assetRef`), the raster an unsupported object fell back to (`fallbackAssetRef`), the
 * retained source bytes (`bytesAssetRef`), a stored preview (`previewAssetRef`), and
 * `image`, the Design box field a compiled picture layer uses.
 *
 * It is the same named-key rule two neighbours apply, and today it is the widest of the
 * three lists rather than the one they all share. The writer's `MEDIA_KEYS`
 * (`lib/lolly-renovation.ts`) has no `previewAssetRef`; the store's own release walk
 * (`rebrand/project-store.ts`) has no `image`. Rebasing a key either neighbour knows is
 * the safe direction: a ref this walk misses keeps pointing at bytes that live on the
 * sender's device, which is the picture-shaped hole the walk exists to prevent, while a
 * ref this walk rebases and the writer never packed is reported as a picture that did
 * not travel, which is a sentence rather than a hole. One shared constant is the real
 * answer and it belongs beside the contracts, not in this file.
 */
const REF_KEYS = new Set(['media', 'assetRef', 'fallbackAssetRef', 'bytesAssetRef', 'previewAssetRef', 'image']);

const MAX_REBASE_DEPTH = 64;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** What one rebase walk changed, and which refs it found no local bytes for. */
export interface RebasedRefsV1<T> {
  value: T;
  /** How many refs were pointed at a receiver-local id. */
  rebased: number;
  /** Refs the map did not name, in first-seen order and deduped. */
  unresolved: string[];
  /**
   * How many subtrees sat deeper than the walk goes and were handed back whole. Their
   * refs, if they hold refs, still name the sender's ids. Counted rather than passed
   * over in silence, because a ref left behind without a word is the outcome the
   * unresolved list exists to prevent.
   */
  truncated: number;
}

/**
 * Point every asset ref in `value` at the id the ingest minted for it. Pure and
 * immutable: the walk builds new objects, so the contents the reader handed back stay
 * exactly as the file wrote them and a caller can walk them again.
 *
 * A ref keeps its treatment modifier (`?treatment=...`), which picks a treatment rather
 * than a different picture. A version pin does not survive: the bytes arrived
 * under a fresh id of this device's own, so the sender's version number names nothing here.
 */
export function rebaseAssetRefs<T>(value: T, rekey: ReadonlyMap<string, string>): RebasedRefsV1<T> {
  let rebased = 0;
  let truncated = 0;
  const unresolved = new Set<string>();

  const one = (ref: string): string => {
    if (!ref) return ref;
    let dep: { key: string; modifier: string };
    try {
      dep = assetDependency({ id: ref });
    } catch {
      // A link this build cannot read finds no bytes either way, so it travels on
      // unchanged and is reported as a picture that did not arrive.
      unresolved.add(ref);
      return ref;
    }
    const next = rekey.get(dep.key);
    if (next === undefined) {
      unresolved.add(ref);
      return ref;
    }
    rebased += 1;
    return next + dep.modifier;
  };

  const walk = (node: unknown, depth: number): unknown => {
    if (!node || typeof node !== 'object') return node;
    if (depth > MAX_REBASE_DEPTH) {
      truncated += 1;
      return node;
    }
    if (Array.isArray(node)) return node.map((item) => walk(item, depth + 1));
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(node as Record<string, unknown>)) {
      put(out, key, REF_KEYS.has(key) && typeof item === 'string' ? one(item) : walk(item, depth + 1));
    }
    return out;
  };

  return { value: walk(value, 0) as T, rebased, unresolved: [...unresolved], truncated };
}

/**
 * Write one field of the copy. A file may state a field called `__proto__`, and plain
 * assignment would read that name as the prototype setter: the value the file stated
 * would vanish from the copy and reappear on its prototype chain, where a later read
 * finds it as though the record had declared it. Defined as data, the name is a field
 * and nothing more.
 */
function put(out: Record<string, unknown>, key: string, value: unknown): void {
  if (key === '__proto__') {
    Object.defineProperty(out, key, { value, enumerable: true, writable: true, configurable: true });
    return;
  }
  out[key] = value;
}

/** The retained source bytes and the facts about them, as a project record states them. */
function isProjectSource(value: unknown): value is RenovationProjectV1['source'] {
  if (!isRecord(value)) return false;
  if (!(SOURCE_KINDS as readonly string[]).includes(text(value.kind))) return false;
  if (!text(value.hash) || !text(value.lineageId) || !text(value.instanceId)) return false;
  return typeof value.pageCount === 'number' && Number.isFinite(value.pageCount);
}

/** The design system the renovation was planned against, as the record states it. */
function isDesignSystemSnapshot(value: unknown): value is DesignSystemSnapshotV1 {
  if (!isRecord(value)) return false;
  if (!text(value.id) || !text(value.tokenHash)) return false;
  return isRecord(value.fontHashes) && isRecord(value.assetHashes);
}

/**
 * A part as the store takes it. The store keeps a part opaque, so the one thing checked
 * here is the contract version every part states: it separates a readable record from a
 * `null` or a string that happens to sit at the path, without claiming a schema check
 * this module never ran.
 */
function isRenovationPart(value: unknown): value is StagePartValueV1 {
  return isRecord(value) && Object.hasOwn(value, 'version') && typeof value.version === 'number';
}

const isStage = (value: string): value is ProjectStageV1 => (PROJECT_STAGES as readonly string[]).includes(value);

/** Contents a caller already read, told apart from the raw bytes by what a read adds. */
const isLollyContents = (value: unknown): value is LollyFileContents =>
  !!value && typeof value === 'object' && 'manifest' in value && 'files' in value;

/** What the carried record says, after the refs in it were rebased. */
interface CarriedFactsV1 {
  name: string;
  source: RenovationProjectV1['source'];
  designSystem: DesignSystemSnapshotV1;
  /** The checkpoint stage as the file spells it, or '' when it names none. */
  stage: string;
  /** True when that checkpoint had completed: a stage with no time committed nothing. */
  completed: boolean;
  planRevision?: number;
  createdAt?: string;
}

function readCarriedFacts(record: Record<string, unknown>, fallbackName: string): CarriedFactsV1 {
  const source = record.source;
  if (!isProjectSource(source)) {
    throw new Error('This renovation file has no readable source document.');
  }
  const designSystem = record.designSystem;
  if (!isDesignSystemSnapshot(designSystem)) {
    throw new Error('This renovation file has no readable design system.');
  }
  const checkpoint = isRecord(record.checkpoint) ? record.checkpoint : {};
  const planRevision = typeof checkpoint.planRevision === 'number' && Number.isFinite(checkpoint.planRevision)
    ? checkpoint.planRevision
    : undefined;
  const createdAt = text(record.createdAt);
  return {
    name: text(record.name) || fallbackName,
    source,
    designSystem,
    stage: text(checkpoint.stage),
    completed: !!text(checkpoint.at),
    ...(planRevision === undefined ? {} : { planRevision }),
    ...(createdAt ? { createdAt } : {}),
  };
}

/**
 * True for the refusal a store raises when the id is already in use. Read off the
 * refusal code the error carries rather than off the class, so a store other than this
 * shell's own answers the same question the same way.
 */
function isProjectExists(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { refusal?: unknown }).refusal === 'project-exists';
}

/** An id this device does not hold: the file's own, else the same name with a number. */
async function freeProjectId(store: RenovationProjectStoreV1, id: string, now: () => string): Promise<string> {
  if (!(await store.get(id))) return id;
  for (let n = 2; n <= 99; n += 1) {
    const candidate = `${id}-${n}`;
    if (!(await store.get(candidate))) return candidate;
  }
  return `${id}-${now().replace(/\D/g, '').slice(-9)}`;
}

/** The route the caller navigates to. Built here so one spelling serves every door. */
export const renovationRoute = (projectId: string): string => `#/rebrand?project=${encodeURIComponent(projectId)}`;

export interface OpenRenovationInputV1 {
  /** The `.lolly`, as bytes or as the contents an intake already read and verified. */
  bytes: ArrayBuffer | Uint8Array | LollyFileContents;
  /** The receiving device: its saved-session slots and its user asset store. */
  host: BeamPackHost;
  /** Where the project record and its parts are written. */
  store: RenovationProjectStoreV1;
  /** ISO timestamp. Injected, so a caller owns the one clock and a test can choose it. */
  now: () => string;
  /**
   * Where a carried document's folders land. A renovation may travel inside an ordinary
   * project file, and that file's folder tree is as much a part of it as its sessions.
   * Without this sink the sessions arrive unfiled, so the door that opens a renovation
   * hands in the same folder store the project door does.
   */
  folders?: LollyProjectFolderSink;
  parentFolderId?: string | null;
  onProgress?: (progress: LollyIngestProgress) => void;
}

/** What the person is told, as a name a view can render its own wording from. */
export type RenovationOpenWarningCodeV1 =
  | 'renamed'
  | 'part-unreadable'
  | 'part-refused'
  | 'unknown-stage'
  | 'partial-stage'
  | 'media-missing'
  | 'media-nested'
  | 'document-landed';

/**
 * The word each saved record goes by in a message. The kinds are contract names, so the
 * fallback message names them the way the web wording does rather than raw.
 */
const PART_WORD: Partial<Record<ProjectPartKindV1, string>> = {
  sourceDeck: 'source deck',
  census: 'census',
  plan: 'plan',
  compiled: 'compiled deck',
};

/**
 * One thing the person should know about the file that was just opened.
 *
 * The `code` is what a view reads: it maps to wording in the reader's own language, with
 * the numbers and names beside it. `message` is the plain English fallback for a caller
 * with no wording of its own, which is what keeps this module readable on the CLI and in
 * a test without a translation table.
 */
export interface RenovationOpenWarningV1 {
  code: RenovationOpenWarningCodeV1;
  message: string;
  /** Pictures, or saved designs, depending on the code. */
  count?: number;
  /** Folders that came with a carried document. */
  folders?: number;
  /** The part a write or a read could not take. */
  kind?: ProjectPartKindV1;
  /** The stage name the file stated, when this build does not know it. */
  stage?: string;
}

export interface OpenedRenovationFileV1 {
  projectId: string;
  /** `#/rebrand?project=<id>`. Returned, not navigated to. */
  route: string;
  project: RenovationProjectV1;
  /** Everything the person should be told: missing pictures, a copy, a refused write. */
  warnings: RenovationOpenWarningV1[];
  /** Pictures written to this device, and pictures whose bytes were already here. */
  imported: number;
  deduped: number;
}

/**
 * Every part the stages up to and including `stage` write, in the order they run.
 *
 * A checkpoint says a stage finished, and a stage that finished stands on the records of
 * the ones before it. `done` writes nothing of its own, so a project that claims it is
 * finished is claiming a compiled deck, which this list says out loud.
 */
function partsUpTo(stage: ProjectStageV1): ProjectPartKindV1[] {
  const out: ProjectPartKindV1[] = [];
  for (const one of PROJECT_STAGES) {
    const part = STAGE_PART[one];
    if (part && !out.includes(part)) out.push(part);
    if (one === stage) break;
  }
  return out;
}

/**
 * Land a renovation `.lolly` on this device and return where it opens.
 *
 * A file that carries a saved document beside the renovation keeps landing that document
 * in Projects, as every other `.lolly` does; the warning says so, so a person taking the
 * renovation door is not surprised by a project they did not ask for and is not left
 * wondering where the document went. Its folders land too when the caller hands in a
 * folder sink, which is the same tree the project door builds.
 *
 * What is not unwound: a store that refuses the project record itself leaves the pictures
 * the ingest already wrote in the library. The ingest's own rollback cannot be reached
 * from here, and the map it returns names deduplicated bytes that other work still holds,
 * so deleting by that map would take pictures this file never brought.
 */
export async function openRenovationFile(input: OpenRenovationInputV1): Promise<OpenedRenovationFileV1> {
  const { host, store, now } = input;
  // One read for both jobs. `readRenovationLolly` answers the first question on its own,
  // but the ingest needs the whole envelope, and inflating a deck's worth of pictures
  // twice is the memory spike the streaming intake exists to avoid.
  const contents = isLollyContents(input.bytes) ? input.bytes : await readLollyFile(input.bytes);
  const block = contents.renovation;
  if (!block) throw new Error('This .lolly file carries no renovation.');
  // Judge the record before a byte is written. A file this module turns away then leaves
  // nothing behind in the person's library.
  readCarriedFacts(block.project, block.name);

  const ingested = await ingestLollyFile(contents, host, {
    ...(input.onProgress ? { onProgress: input.onProgress } : {}),
    ...(input.folders ? { folders: input.folders } : {}),
    ...(input.parentFolderId === undefined ? {} : { parentFolderId: input.parentFolderId }),
  });
  const carried = ingested.renovation;
  if (!carried) throw new Error('This .lolly file carries no renovation.');

  const warnings: RenovationOpenWarningV1[] = [];
  const unresolved = new Set<string>();
  let nested = 0;

  const record = rebaseAssetRefs(carried.contents.project, carried.rekey);
  for (const ref of record.unresolved) unresolved.add(ref);
  nested += record.truncated;

  const parts: Partial<Record<ProjectPartKindV1, Record<string, unknown>>> = {};
  for (const kind of PROJECT_PART_KINDS) {
    const raw = carried.contents.parts[kind];
    if (!raw) continue;
    const rebased = rebaseAssetRefs(raw, carried.rekey);
    for (const ref of rebased.unresolved) unresolved.add(ref);
    nested += rebased.truncated;
    parts[kind] = rebased.value;
  }

  const facts = readCarriedFacts(record.value, carried.contents.name);
  const wanted = text(carried.contents.id);
  // The store has the last word on the id: a second tab can create this project between
  // the check and the create, and the record that comes back names the id it took.
  const created = await createProject(store, await freeProjectId(store, wanted, now), facts, now);
  const projectId = created.id;
  if (projectId !== wanted) {
    warnings.push({
      code: 'renamed',
      message: 'This renovation is already on this device, so it opened as a copy.',
    });
  }

  let revision = created.revision;
  const stored = new Set<ProjectPartKindV1>();

  for (const kind of PROJECT_PART_KINDS) {
    const value = parts[kind];
    if (value === undefined) continue;
    if (!isRenovationPart(value)) {
      warnings.push({
        code: 'part-unreadable',
        kind,
        message: `The ${PART_WORD[kind] ?? 'saved'} record could not be read, so it was not added.`,
      });
      continue;
    }
    const written = await store.putPart(projectId, revision, kind, value);
    if (!written.ok) {
      warnings.push({
        code: 'part-refused',
        kind,
        // The store's own reason, unprefixed: a view wraps it in its own sentence.
        message: written.message,
      });
      // A quota refusal refuses the next part too, and a stale revision means another
      // tab is writing this project. Either way, stop rather than report each one.
      break;
    }
    revision = written.revision;
    stored.add(kind);
  }

  if (facts.stage && !isStage(facts.stage)) {
    warnings.push({
      code: 'unknown-stage',
      stage: facts.stage,
      message: `This file names a stage Lolly does not know (${facts.stage}), so it opens at the first one.`,
    });
  } else if (facts.completed && isStage(facts.stage)) {
    const missing = partsUpTo(facts.stage).filter((kind) => !stored.has(kind));
    if (missing.length) {
      // Marking the stage would claim work that is not on this device. The project opens
      // at the stage whose records did arrive, and the person runs the rest again.
      warnings.push({
        code: 'partial-stage',
        stage: facts.stage,
        message: 'Part of this renovation did not arrive, so it opens at the stage its records support.',
      });
    } else {
      const marked = await store.checkpoint(projectId, revision, facts.stage, facts.planRevision);
      if (marked.ok) revision = marked.revision;
      else warnings.push({ code: 'partial-stage', stage: facts.stage, message: marked.message });
    }
  }

  if (unresolved.size) {
    warnings.push({
      code: 'media-missing',
      count: unresolved.size,
      message: unresolved.size === 1
        ? '1 picture is missing.'
        : `${unresolved.size} pictures are missing.`,
    });
  }
  if (nested) {
    warnings.push({
      code: 'media-nested',
      count: nested,
      message: "Part of this renovation is nested too deep, so its pictures still point at the sender's copies.",
    });
  }
  const sessions = ingested.project ? ingested.project.slots.length : ingested.slot ? 1 : 0;
  if (sessions) {
    const folders = ingested.project?.folderIds.length ?? 0;
    warnings.push({
      code: 'document-landed',
      count: sessions,
      folders,
      message: folders
        ? `${sessions === 1 ? '1 design was' : `${sessions} designs were`} added to Projects, in ${folders === 1 ? '1 folder' : `${folders} folders`}.`
        : sessions === 1
          ? '1 design was added to Projects.'
          : `${sessions} designs were added to Projects.`,
    });
  }

  const project = (await store.get(projectId)) ?? created;
  return {
    projectId,
    route: renovationRoute(projectId),
    project,
    warnings,
    imported: ingested.imported,
    deduped: ingested.deduped,
  };
}

/**
 * Create the project, taking a fresh id if the store says this one is in use. The id was
 * checked a moment ago, so a refusal here is another tab that created the same project
 * in between; a second name is a better answer than a failed open.
 *
 * The record that comes back names the id that was taken, and that is the id the caller
 * writes every part and every checkpoint against. Addressing the id asked for instead
 * would write this file's records over the project already on the device.
 */
async function createProject(
  store: RenovationProjectStoreV1,
  id: string,
  facts: CarriedFactsV1,
  now: () => string,
): Promise<RenovationProjectV1> {
  let candidate = id;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await store.create({
        id: candidate,
        name: facts.name,
        source: facts.source,
        designSystem: facts.designSystem,
        createdAt: facts.createdAt ?? now(),
      });
    } catch (err) {
      if (!isProjectExists(err) || attempt === 2) throw err;
      candidate = await freeProjectId(store, candidate, now);
    }
  }
  throw new Error('This renovation could not be added to this device.');
}
