// SPDX-License-Identifier: MPL-2.0
/** Bind separately mounted model validators to reviewed inventory, then verify
 * the independent staged volume. No source model or retained alias is changed. */
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileSha256 } from '../gen-models-manifest.ts';

export interface MountedModelFile { url: string; size: number; sha256: string }
export interface ArchivedModelInventory { version: 1; files: MountedModelFile[] }
const digestPattern = /^[0-9a-f]{64}$/;
const pathPattern = /^\/models\/([a-z0-9-]+)(?:@([0-9a-f]{16}))?\/([A-Za-z0-9_./-]+)$/;
const digest = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid model inventory record');
  return value as Record<string, unknown>;
};
function keys(value: Record<string, unknown>, expected: string[]): void {
  if (Object.keys(value).sort().join(',') !== expected.sort().join(',')) throw new Error('Unexpected model inventory fields');
}
function modelPath(url: unknown): { family: string; address: string | undefined; name: string } {
  const match = typeof url === 'string' ? pathPattern.exec(url) : null;
  if (!match || match[3]!.split('/').some(part => !part || part.startsWith('.'))) throw new Error('Unsafe model inventory URL');
  return { family: match[1]!, address: match[2], name: match[3]! };
}
function file(value: unknown): MountedModelFile {
  const record = object(value);
  modelPath(record.url);
  if (typeof record.sha256 !== 'string' || !digestPattern.test(record.sha256)) throw new Error('Model inventory needs a full SHA256');
  if (!Number.isSafeInteger(record.size) || (record.size as number) < 0) throw new Error('Invalid model inventory size');
  return { url: record.url as string, size: record.size as number, sha256: record.sha256 };
}
function directoryDigest(files: readonly MountedModelFile[]): string {
  return digest([...files].sort((a, b) => a.url < b.url ? -1 : a.url > b.url ? 1 : 0)
    .map(row => `${modelPath(row.url).name}\0${row.size}\0${row.sha256}\n`).join(''));
}
/** Retained addressed directories must be complete, not a collection of aliases
 * carrying arbitrary hash-looking names. Legacy aliases retain their own bytes. */
export function validateMountedModelFiles(input: readonly MountedModelFile[]): MountedModelFile[] {
  const seen = new Set<string>(), addressed = new Map<string, MountedModelFile[]>();
  const files = input.map(value => {
    const record = object(value); keys(record, ['url', 'size', 'sha256']);
    const row = file(record);
    if (seen.has(row.url)) throw new Error('Duplicate model inventory URL');
    seen.add(row.url);
    const path = modelPath(row.url);
    if (path.address) {
      const key = `${path.family}@${path.address}`;
      const group = addressed.get(key) ?? []; group.push(row); addressed.set(key, group);
    }
    return row;
  });
  for (const [key, group] of addressed) {
    if (!key.endsWith('@' + directoryDigest(group).slice(0, 16))) throw new Error('Incomplete or mismatched addressed model directory');
  }
  return files.sort((a, b) => a.url < b.url ? -1 : a.url > b.url ? 1 : 0);
}
/** Current manifests contribute immutable paths only. Conventional aliases must
 * come from an explicit archive of the owning volume, even when sizes coincide. */
export function compileMountedModelDelivery(manifest: unknown, archive?: unknown): MountedModelFile[] {
  if (!Array.isArray(manifest) || !manifest.length) throw new Error('A complete reviewed model manifest is required');
  const families = new Map<string, { files: MountedModelFile[]; directory: string }>();
  const current = manifest.map(value => {
    const record = object(value); keys(record, ['url', 'size', 'sha256', 'directorySha256', 'immutableUrl']);
    const row = file(record), path = modelPath(row.url), immutable = modelPath(record.immutableUrl);
    if (path.address || typeof record.directorySha256 !== 'string' || !digestPattern.test(record.directorySha256)) throw new Error('Invalid current model directory digest');
    if (immutable.family !== path.family || immutable.name !== path.name || immutable.address !== record.directorySha256.slice(0, 16)) throw new Error('Model immutable address mismatch');
    const group = families.get(path.family) ?? { files: [], directory: record.directorySha256 };
    if (group.directory !== record.directorySha256) throw new Error('Inconsistent model family directory digest');
    group.files.push(row); families.set(path.family, group);
    return { ...row, url: record.immutableUrl as string };
  });
  for (const group of families.values()) {
    validateMountedModelFiles(group.files);
    if (directoryDigest(group.files) !== group.directory) throw new Error('Incomplete current model family');
  }
  let retained: MountedModelFile[] = [];
  if (archive !== undefined) {
    const record = object(archive); keys(record, ['version', 'files']);
    if (record.version !== 1 || !Array.isArray(record.files)) throw new Error('Invalid archived model inventory');
    retained = validateMountedModelFiles(record.files);
  }
  const combined = new Map(current.map(row => [row.url, row]));
  for (const row of retained) {
    const previous = combined.get(row.url);
    if (previous && (previous.sha256 !== row.sha256 || previous.size !== row.size)) throw new Error('Immutable mounted model collision');
    combined.set(row.url, row);
  }
  return validateMountedModelFiles([...combined.values()]);
}
/** A pin binds exact reviewed JSON bytes. Paths or timestamps alone do not. */
export function readReviewedModelJson(path: string, expectedSha256: string): unknown {
  if (!digestPattern.test(expectedSha256)) throw new Error('A full reviewed model inventory SHA256 pin is required');
  const bytes = readFileSync(path);
  if (digest(bytes) !== expectedSha256) throw new Error('Reviewed model inventory pin mismatch');
  return JSON.parse(bytes.toString('utf8'));
}
/** Read only from a separate staged models root. The caller must also verify its
 * Kubernetes readOnly mount and custody; this receipt cannot establish either. */
export async function verifyMountedModelVolume(root: string, input: readonly MountedModelFile[]): Promise<{ files: number; bytes: number; inventorySha256: string }> {
  const files = validateMountedModelFiles(input), expected = new Map(files.map(row => [row.url, row]));
  root = resolve(root);
  const metadata = lstatSync(root);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error('Model volume root must be a real directory');
  let count = 0, bytes = 0;
  async function walk(directory: string, prefix = '/models'): Promise<void> {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name), url = `${prefix}/${entry.name}`;
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new Error('Mounted model symlink refused');
      if (stat.isDirectory()) { await walk(path, url); continue; }
      if (!stat.isFile()) throw new Error('Unsupported mounted model file type');
      // These existing operator receipts have reserved, non-public routes.
      if (url === '/models/model-manifest.json' || url === '/models/models-release.json') continue;
      const row = expected.get(url);
      if (!row) throw new Error(`Unlisted mounted model file: ${url}`);
      if (stat.size !== row.size || stat.mtimeMs !== 0 || await fileSha256(path) !== row.sha256) throw new Error(`Mounted model bytes or epoch mismatch: ${url}`);
      expected.delete(url); count++; bytes += stat.size;
    }
  }
  await walk(root);
  if (expected.size) throw new Error(`Mounted model files missing: ${[...expected.keys()].join(', ')}`);
  return { files: count, bytes, inventorySha256: digest(JSON.stringify(files)) };
}
/** CLI verification reads staged bytes; it never changes the volume. */
export async function main(args = process.argv.slice(2)): Promise<void> {
  const opt = (name: string) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
  const root = opt('--verify-root'), manifest = opt('--manifest'), archive = opt('--archive-inventory');
  if (!root || !manifest) throw new Error('Usage: node scripts/lib/mounted-model-delivery.ts --verify-root staged/models --manifest JSON --manifest-sha256 SHA256 [--archive-inventory JSON --archive-sha256 SHA256]');
  if (!archive && opt('--archive-sha256')) throw new Error('Archived model pin needs an inventory');
  const files = compileMountedModelDelivery(readReviewedModelJson(manifest, opt('--manifest-sha256') ?? ''),
    archive ? readReviewedModelJson(archive, opt('--archive-sha256') ?? '') : undefined);
  console.log(JSON.stringify(await verifyMountedModelVolume(root, files)));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
