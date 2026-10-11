// SPDX-License-Identifier: MPL-2.0
/** Stream full hashes from an explicit model root. Family directories get real
 * content-addressed siblings for conventional transformer model resolution.
 * Legacy files are retained. Publish verified siblings before activating a manifest. */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, stat, mkdir, link, copyFile, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface ModelManifestEntry { url: string; size: number; sha256: string; directorySha256: string; immutableUrl: string }
const familyPattern = /^[a-z0-9-]+$/;
export async function fileSha256(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
async function walk(root: string, current = root): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.endsWith('.part') || entry.name.includes('@')) continue;
    const path = join(current, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Refusing model symlink: ${path}`);
    if (entry.isDirectory()) files.push(...await walk(root, path));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort();
}
export async function generateModelManifest(sourceRoot: string, onlyFamily?: string): Promise<ModelManifestEntry[]> {
  if (onlyFamily && !familyPattern.test(onlyFamily)) throw new Error('Invalid model family');
  const families = onlyFamily ? [onlyFamily] : (await readdir(sourceRoot, { withFileTypes: true })).filter(e => e.isDirectory() && familyPattern.test(e.name)).map(e => e.name).sort();
  const all: ModelManifestEntry[] = [];
  for (const family of families) {
    const paths = await walk(join(sourceRoot, family));
    if (!paths.length) throw new Error(`Model family ${family} has no files`);
    const entries = [];
    for (const path of paths) {
      const name = relative(join(sourceRoot, family), path).split(sep).join('/');
      if (!/^[a-zA-Z0-9_./-]+$/.test(name) || name.split('/').some(s => s === '.' || s === '..')) throw new Error(`Unsafe model name: ${name}`);
      entries.push({ name, size: (await stat(path)).size, sha256: await fileSha256(path) });
    }
    const directorySha256 = createHash('sha256').update(entries.map(e => `${e.name}\0${e.size}\0${e.sha256}\n`).join('')).digest('hex');
    for (const entry of entries) all.push({ url: `/models/${family}/${entry.name}`, size: entry.size, sha256: entry.sha256, directorySha256, immutableUrl: `/models/${family}@${directorySha256.slice(0, 16)}/${entry.name}` });
  }
  return all.sort((a, b) => a.url.localeCompare(b.url));
}
/** Materialization never replaces a file. Existing bytes must match the full
 * digest before a resumed run can leave a hashed directory alone. */
export async function materializeModels(entries: readonly ModelManifestEntry[], sourceRoot: string, targetRoot: string): Promise<void> {
  for (const entry of entries) {
    const source = join(sourceRoot, entry.url.slice('/models/'.length));
    const target = join(targetRoot, entry.immutableUrl.slice('/models/'.length));
    await mkdir(dirname(target), { recursive: true });
    try {
      if (await fileSha256(target) !== entry.sha256) throw new Error(`Immutable model collision: ${target}`);
      continue;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (await fileSha256(source) !== entry.sha256) throw new Error(`Source changed while materializing: ${source}`);
    try { await link(source, target); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
      const { constants } = await import('node:fs');
      await copyFile(source, target, constants.COPYFILE_EXCL);
    }
    if (await fileSha256(target) !== entry.sha256) throw new Error(`Materialized model integrity failed: ${target}`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const sourceRoot = arg('source-root');
  if (!sourceRoot) throw new Error('Supply --source-root=<models-directory>; optionally --family=<name>, --output=<manifest.json>, --materialize-root=<new-directory>.');
  const family = arg('family');
  const output = resolve(arg('output') ?? join(import.meta.dirname, '../shells/web/models-manifest.json'));
  let entries = await generateModelManifest(resolve(sourceRoot), family);
  if (arg('materialize-root')) await materializeModels(entries, resolve(sourceRoot), resolve(arg('materialize-root')!));
  if (family) {
    const previous = JSON.parse(await readFile(output, 'utf8')) as ModelManifestEntry[];
    entries = [...previous.filter(e => !e.url.startsWith(`/models/${family}/`)), ...entries].sort((a, b) => a.url.localeCompare(b.url));
  }
  await writeFile(output, `${JSON.stringify(entries, null, 1)}\n`);
  console.log(`Wrote ${entries.length} model file hashes to ${output}; legacy files were not changed.`);
}
