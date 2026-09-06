// SPDX-License-Identifier: MPL-2.0
/**
 * Manifest-first intake for every file that wears the `.lolly` extension.
 *
 * `.lolly` is the product's portable-container extension, not one payload:
 * `lolly-share` is one saved tool session and `lolly-brand` is one design
 * system (optionally promoted to an instance pack by tools/catalog parts).
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

export const LOLLY_MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;
export const LOLLY_MEDIUM_FILE_BYTES = 10 * 1024 * 1024;
export const LOLLY_LARGE_FILE_BYTES = 100 * 1024 * 1024;
const MANIFEST_MAX_BYTES = 1024 * 1024;

export type LollySizeBand = 'small' | 'medium' | 'large';

export interface LollySessionPreview {
  kind: 'session';
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
    return {
      kind: 'session',
      format,
      label: fallback,
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
      kind: 'session';
      preview: LollySessionPreview;
      contents: import('./lolly-pack.ts').LollyFileContents;
    }
  | { kind: 'brand' | 'instance'; preview: LollyBrandPreview; files: import('fflate').Unzipped };

/** Full guarded read, chosen after preflight and performed exactly once. */
export async function loadLollyFile(file: File, preview: LollyPreview): Promise<LoadedLolly> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (preview.kind === 'session') {
    const { readLollyFile } = await import('./lolly-pack.ts');
    return { kind: 'session', preview, contents: await readLollyFile(bytes) };
  }
  const { unzipBrandBytes } = await import('../brand-transfer.ts');
  return { kind: preview.kind, preview, files: await unzipBrandBytes(bytes) };
}
