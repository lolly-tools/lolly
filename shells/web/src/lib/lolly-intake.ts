// SPDX-License-Identifier: MPL-2.0
/**
 * Manifest-first intake for every file that wears the `.lolly` extension.
 *
 * `.lolly` is the product's portable-container extension, not one payload:
 * `lolly-share` is one saved tool session (or, with `kind: 'project'`, a folder
 * tree of them) and `lolly-brand` is one design system (optionally promoted to
 * an instance pack by tools/catalog parts).
 * Entry points must therefore ask the manifest what the file is before they
 * choose a verb. This module is that one read-only decision seam.
 *
 * The preview is deliberately STREAMING. A session can legitimately contain a
 * large video, so reading the whole Blob merely to discover `manifest.json`
 * made the preflight itself the first memory spike. fflate sees ZIP local
 * headers as File.stream() advances; every entry except the tiny manifest is
 * left unopened. The selected reader later performs the full guarded inflate
 * exactly once, after the person has accepted the measured action.
 */
import { Unzip, UnzipInflate, strFromU8 } from 'fflate';
import { t, tRaw } from '../i18n.ts';

export const LOLLY_MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;
export const LOLLY_MEDIUM_FILE_BYTES = 10 * 1024 * 1024;
export const LOLLY_LARGE_FILE_BYTES = 100 * 1024 * 1024;
const MANIFEST_MAX_BYTES = 1024 * 1024;

export type LollySizeBand = 'small' | 'medium' | 'large';

/**
 * The manifest tool id a renovation that travels on its own carries
 * (`LOLLY_RENOVATION_TOOL_ID` in `lolly-pack.ts`). Spelled again here rather than
 * imported, so the streaming preview keeps the pack reader out of the cold path; a test
 * in `drop-router.test.ts` pins the two spellings together.
 */
const RENOVATION_TOOL_ID = 'lolly-renovation';

/**
 * A renovation project inside a `.lolly` (plan 274 section 3.5), as the manifest
 * declares it. A renovation is not a saved document: it is work in progress on a deck,
 * so a file carrying one opens at `#/rebrand` and not at a tool.
 */
export interface LollyRenovationPreview {
  id: string;
  /** The project name the person gave it. */
  name: string;
  /** The big records the file carries: `sourceDeck`, `census`, `plan`, `compiled`. */
  parts: string[];
  /** How many pictures the project and its records point at. */
  media: number;
  /** True when a saved document travelled beside the renovation. */
  withDocument: boolean;
}

export interface LollySessionPreview {
  /** `project` is a folder tree of sessions; the rest describe one session or tool. */
  kind: 'session' | 'tool' | 'project';
  format: 'lolly-share';
  label: string;
  fileBytes: number;
  sizeBand: LollySizeBand;
  toolId: string | null;
  embeddedAssets: number;
  referencedAssets: number;
  embeddedBytes: number;
  fonts: number;
  includesTool: boolean;
  toolFiles: number;
  includesDesignSystem: boolean;
  designSystemLabel: string | null;
  creator: string | null;
  /** On a project file: how many saved sessions and folders it declares. */
  sessionCount: number;
  folderCount: number;
  /** Present when the file carries a renovation project, whatever else it carries. */
  renovation: LollyRenovationPreview | null;
  manifest: Record<string, unknown>;
}

export interface LollyBrandPreview {
  kind: 'brand' | 'instance';
  format: 'lolly-brand';
  label: string;
  fileBytes: number;
  sizeBand: LollySizeBand;
  tokens: boolean;
  fontFamilies: number;
  fontFiles: number;
  logos: number;
  versions: number;
  resources: number;
  tools: number;
  catalogAssets: number;
  localSessions?: number;
  localAssets?: number;
  localTools?: number;
  publisher: string | null;
  instance: string | null;
  manifest: Record<string, unknown>;
}

export type LollyPreview = LollySessionPreview | LollyBrandPreview;

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;
const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

export function lollySizeBand(bytes: number): LollySizeBand {
  if (bytes > LOLLY_LARGE_FILE_BYTES) return 'large';
  if (bytes > LOLLY_MEDIUM_FILE_BYTES) return 'medium';
  return 'small';
}

/** Compact, locale-neutral byte spelling for intake summaries. */
export function lollyBytesLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  }
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(gb < 10 ? 1 : 0)} GB`;
}

/**
 * The renovation block as the manifest declares it. The format reader checks the paths,
 * the integrity map and every part before a byte of this is acted on; this is the
 * preview's own reading, so a chooser can say what the file is without inflating it.
 */
function readRenovation(
  manifest: Record<string, unknown>,
  toolId: string | null
): LollyRenovationPreview | null {
  const block = record(manifest.renovation);
  if (!block) return null;
  const id = text(block.id);
  const name = text(block.name);
  if (!id || !name) return null;
  const parts = record(block.parts);
  return {
    id,
    name,
    parts: parts ? Object.keys(parts).filter((kind) => typeof parts[kind] === 'string') : [],
    media: Array.isArray(block.assets) ? block.assets.length : 0,
    // A renovation travelling on its own is written under the renovation's own tool id,
    // because there is no document yet for a tool to own.
    withDocument: !!toolId && toolId !== RENOVATION_TOOL_ID,
  };
}

/**
 * The stages in the order they run, the same list the renovation store keeps
 * (`PROJECT_STAGES`). Spelled again here for the reason the tool id above is spelled
 * again: the streaming preview stays clear of the renovation modules. A test in
 * `drop-router.test.ts` pins the two spellings together.
 */
const STAGE_ORDER = ['ingest', 'census', 'plan', 'review', 'compile', 'done'] as const;

/**
 * Where the work picks up, read from the checkpoint the record carries.
 *
 * A checkpoint that carries a time is a stage that FINISHED, which is how the renovation
 * store reads it too (`resumePoint` in `rebrand/lifecycle.ts`). So the stage to name is
 * the one after it: naming the stage itself would send a person back to work the file
 * says is already done. A checkpoint with no time committed nothing, so its own stage is
 * the one still to run, and a stage past the end of the list is a finished renovation.
 */
function resumeStage(checkpoint: Record<string, unknown> | null): { stage: string | null; finished: boolean } {
  const stage = text(checkpoint?.stage);
  if (!stage) return { stage: null, finished: false };
  const at = STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
  if (at < 0) return { stage: null, finished: false };
  if (!text(checkpoint?.at)) {
    return stage === 'done' ? { stage: null, finished: true } : { stage, finished: false };
  }
  const next = STAGE_ORDER[at + 1];
  if (!next || next === 'done') return { stage: null, finished: true };
  return { stage: next, finished: false };
}

/** Where the work picks up, in plain words. An unknown stage gets none rather than a guess. */
/**
 * How far the work got, in the words the Rebrand intake's recent list uses for the
 * same stages (`stageWords` in views/rebrand/intake.ts), never the pipeline's own ids.
 */
function stageText(stage: string): string | null {
  switch (stage) {
    case 'ingest':
      return t('not read yet');
    case 'census':
    case 'plan':
      return t('being prepared');
    case 'review':
      return t('ready to review');
    case 'compile':
      return t('opening in Design');
    case 'done':
      return t('opened in Design');
    default:
      return null;
  }
}

/**
 * One sentence for a renovation file. A renovation is work in progress on a deck, so
 * describing it as a saved design would be wrong twice over: there is no document in it
 * yet, and the part that matters is where the work stopped.
 *
 * `project` is the carried project record, for a caller that has read the file. With it
 * the sentence names the source document and the stage it picks up at; without it, which
 * is what a chooser has before the file is inflated, it says what the manifest declares.
 * `name` is the file's own label, used when the record names no source document, so a
 * renovation-only drop still says which file it is talking about.
 */
export function describeRenovation(renovation: LollyRenovationPreview, project?: unknown, name?: string): string {
  const carried = record(project);
  // The record's source name first; a renovation-only drop with no record yet
  // falls back to the file's own label so the sentence still names something.
  const file = text(record(carried?.source)?.name) || text(name);
  const point = resumeStage(record(carried?.checkpoint));
  const stage = point.stage ? stageText(point.stage) : null;

  // A project, in the word the view uses, never a renovation.
  if (file && point.finished) return tRaw('A Rebrand project for {file}, opened in Design.', { file });
  if (point.finished) return t('A Rebrand project, opened in Design.');
  if (file && stage) return tRaw('A Rebrand project for {file}, {stage}.', { file, stage });
  if (file) return tRaw('A Rebrand project for {file}.', { file });
  if (stage) return tRaw('A Rebrand project, {stage}.', { stage });

  const content = [
    renovation.parts.length === 1
      ? t('1 stage of work')
      : renovation.parts.length
        ? t('{n} stages of work', { n: renovation.parts.length })
        : null,
    renovation.media === 1 ? t('1 picture') : renovation.media ? t('{n} pictures', { n: renovation.media }) : null,
  ]
    .filter(Boolean)
    .join(', ');
  return content ? tRaw('A Rebrand project: {content}.', { content }) : t('A Rebrand project.');
}

/**
 * Turn the untrusted manifest declaration into the small preview model. The
 * selected format reader still validates versions, checks integrity and treats
 * the payload bytes as authoritative before anything is written.
 */
export function classifyLollyManifest(
  value: unknown,
  fileName: string,
  fileBytes: number
): LollyPreview {
  const manifest = record(value);
  if (!manifest)
    throw new Error(
      'This does not look like a .lolly file (manifest.json is missing or unreadable).'
    );
  const format = text(manifest.format);
  const fallback = fileName.replace(/\.lolly$/i, '').trim() || 'Lolly file';

  if (format === 'lolly-share') {
    const counts = record(manifest.counts);
    const tool = record(manifest.tool);
    const bundledTool = record(manifest.bundledTool);
    const designSystem = record(manifest.designSystem);
    const creator = record(manifest.creator);
    const creatorName = text(creator?.name) ?? text(creator?.org);
    const project = manifest.kind === 'project' ? record(manifest.project) : null;
    const renovation = readRenovation(manifest, text(tool?.id));
    return {
      kind: manifest.kind === 'tool' ? 'tool' : manifest.kind === 'project' ? 'project' : 'session',
      format,
      label: text(project?.name) ?? fallback,
      fileBytes,
      sizeBand: lollySizeBand(fileBytes),
      toolId: text(tool?.id),
      embeddedAssets: count(counts?.assets),
      referencedAssets: count(counts?.byReference),
      embeddedBytes: count(counts?.bytes),
      fonts: Array.isArray(manifest.fonts) ? manifest.fonts.length : 0,
      includesTool: !!bundledTool,
      toolFiles: Array.isArray(bundledTool?.files) ? bundledTool.files.length : 0,
      includesDesignSystem: !!designSystem,
      designSystemLabel: text(designSystem?.label),
      creator: creatorName,
      sessionCount: Array.isArray(project?.sessions) ? project.sessions.length : 0,
      folderCount: Array.isArray(project?.folders) ? project.folders.length : 0,
      renovation,
      manifest,
    };
  }

  if (format === 'lolly-brand') {
    const counts = record(manifest.counts);
    const pack = record(manifest.pack);
    const instance = text(pack?.instance);
    const tools = count(pack?.toolCount);
    const catalogAssets = count(pack?.assetCount);
    const isInstance =
      pack?.kind === 'instance-pack' || !!instance || tools > 0 || catalogAssets > 0;
    return {
      kind: isInstance ? 'instance' : 'brand',
      format,
      label: text(manifest.label) ?? text(pack?.name) ?? fallback,
      fileBytes,
      sizeBand: lollySizeBand(fileBytes),
      tokens: counts?.tokens === true,
      fontFamilies: count(counts?.fontFamilies),
      fontFiles: count(counts?.fontFiles),
      logos: count(counts?.logos),
      versions: count(counts?.versions),
      resources: count(counts?.resources),
      tools,
      catalogAssets,
      localSessions: count(record(manifest.contents)?.sessions),
      localAssets: count(record(manifest.contents)?.assets),
      localTools: count(record(manifest.contents)?.tools),
      publisher: text(pack?.publisher),
      instance,
      manifest,
    };
  }

  if (format === 'lolly-backup') {
    throw new Error(
      'This is a Lolly device backup. Restore it from Profile → Storage; backups remain .zip files so they cannot be mistaken for a shared design.'
    );
  }
  throw new Error('This .lolly file uses an unknown bundle format.');
}

/** Read only manifest.json from a File/Blob without materialising the archive. */
export async function peekLollyFile(file: File): Promise<LollyPreview> {
  if (file.size > LOLLY_MAX_FILE_BYTES) {
    throw new Error(
      `This .lolly file is too large to open (max ${lollyBytesLabel(LOLLY_MAX_FILE_BYTES)}).`
    );
  }

  const value = await new Promise<unknown>((resolve, reject) => {
    const reader = file.stream().getReader();
    let settled = false;
    let found = false;
    const finish = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      void reader.cancel().catch(() => {});
      fn();
    };
    const unzip = new Unzip((entry) => {
      if (entry.name !== 'manifest.json') return;
      found = true;
      const chunks: Uint8Array[] = [];
      let total = 0;
      entry.ondata = (err, chunk, final) => {
        if (err) {
          finish(() => reject(err));
          return;
        }
        if (chunk?.length) {
          total += chunk.length;
          if (total > MANIFEST_MAX_BYTES) {
            entry.terminate();
            finish(() => reject(new Error('This .lolly file has an oversized manifest.')));
            return;
          }
          chunks.push(chunk);
        }
        if (!final) return;
        const joined = new Uint8Array(total);
        let at = 0;
        for (const part of chunks) {
          joined.set(part, at);
          at += part.length;
        }
        try {
          const parsed = JSON.parse(strFromU8(joined));
          finish(() => resolve(parsed));
        } catch {
          finish(() => reject(new Error('This .lolly file has an unreadable manifest.')));
        }
      };
      try {
        entry.start();
      } catch (err) {
        finish(() => reject(err));
      }
    });
    unzip.register(UnzipInflate);

    void (async () => {
      try {
        while (!settled) {
          const next = await reader.read();
          if (settled) break;
          unzip.push(next.value ?? new Uint8Array(), next.done);
          if (next.done && !settled) {
            finish(() =>
              reject(
                new Error(
                  found
                    ? 'This .lolly file has an incomplete manifest.'
                    : 'This does not look like a .lolly file (manifest.json is missing).'
                )
              )
            );
          }
        }
      } catch (err) {
        finish(() => reject(err));
      }
    })();
  });

  return classifyLollyManifest(value, file.name, file.size);
}

export type LoadedLolly =
  | {
      kind: 'session' | 'tool' | 'project';
      preview: LollySessionPreview;
      contents: import('./lolly-pack.ts').LollyFileContents;
    }
  | { kind: 'brand' | 'instance'; preview: LollyBrandPreview; files: import('fflate').Unzipped };

/**
 * Full guarded read, chosen after preflight and performed exactly once. The in-place
 * model offer is held back while it runs (`holdModelOffers` in `model-offer.ts`), so no
 * download sheet opens over the import.
 */
export async function loadLollyFile(file: File, preview: LollyPreview): Promise<LoadedLolly> {
  const release = await holdOffers();
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (preview.format === 'lolly-share') {
      const { readLollyFile } = await import('./lolly-pack.ts');
      return { kind: preview.kind, preview, contents: await readLollyFile(bytes) };
    }
    const { unzipBrandBytes } = await import('../brand-transfer.ts');
    return { kind: preview.kind, preview, files: await unzipBrandBytes(bytes) };
  } finally {
    release();
  }
}

/** The offer hold, loaded on first use so this module's chunk does not carry the sheet. */
async function holdOffers(): Promise<() => void> {
  try {
    return (await import('./model-offer.ts')).holdModelOffers();
  } catch {
    return () => {};
  }
}
