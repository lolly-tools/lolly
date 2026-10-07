// SPDX-License-Identifier: MPL-2.0
/** Prepare and verify a bounded, immutable model tree for any static host. */
import { createHash } from 'node:crypto';
import { constants, createReadStream } from 'node:fs';
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const metadata = '.lolly-model-release.json';
const maxFiles = 4096;
const maxBytes = 8 * 1024 ** 3;
interface Entry {
  url: string;
  size: number;
}
interface ModelFile extends Entry {
  sha256: string;
}
interface Release {
  version: 1;
  sourceCommit: string;
  manifestSha256: string;
  files: ModelFile[];
  release: string;
}
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function sha(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
function pathname(url: string): string {
  check(
    typeof url === 'string' && url.startsWith('/models/'),
    'Model URL must begin with /models/.'
  );
  const name = url.slice(8);
  check(
    name.length > 0 &&
      name.length < 1024 &&
      !/[\\%?#]/.test(name) &&
      [...name].every((c) => c.charCodeAt(0) > 32 && c.charCodeAt(0) !== 127),
    'Model URL contains an unsafe path.'
  );
  check(
    name.split('/').every((part) => part.length > 0 && !part.startsWith('.')),
    'Model URL contains a hidden or relative path.'
  );
  return name;
}
async function manifest(path: string): Promise<{ entries: Entry[]; hash: string }> {
  check(
    (await lstat(path)).isFile() && (await lstat(path)).size < 2 * 1024 ** 2,
    'Model manifest must be a regular file below 2 MiB.'
  );
  const raw = await readFile(path);
  let entries: Entry[];
  try {
    entries = JSON.parse(raw.toString());
  } catch {
    throw new Error('Model manifest JSON is invalid.');
  }
  check(
    Array.isArray(entries) && entries.length > 0 && entries.length <= maxFiles,
    'Model manifest has an invalid file count.'
  );
  const seen = new Set<string>();
  let total = 0;
  for (const entry of entries) {
    check(entry && typeof entry === 'object', 'Model manifest entry is invalid.');
    pathname(entry.url);
    check(
      Number.isSafeInteger(entry.size) && entry.size >= 0,
      'Model file size must be a non-negative integer.'
    );
    check(!seen.has(entry.url), 'Model manifest contains a duplicate URL.');
    seen.add(entry.url);
    total += entry.size;
    check(total <= maxBytes, 'Model set exceeds the 8 GiB release limit.');
  }
  return {
    entries: entries
      .map(({ url, size }) => ({ url, size }))
      .sort((a, b) => a.url.localeCompare(b.url)),
    hash: sha(raw),
  };
}
async function regular(root: string, name: string): Promise<string> {
  let path = root;
  const segments = name.split('/');
  for (const [index, part] of segments.entries()) {
    path = join(path, part);
    const stat = await lstat(path);
    check(!stat.isSymbolicLink(), 'Model source or release contains a symbolic link.');
    check(
      index === segments.length - 1 ? stat.isFile() : stat.isDirectory(),
      'Model path is not a regular file tree.'
    );
  }
  return path;
}
async function hashFile(path: string, expectedSize: number): Promise<string> {
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(path, { highWaterMark: 1024 * 1024 })) {
    bytes += chunk.length;
    check(bytes <= expectedSize, 'Model bytes exceed their declared size.');
    hash.update(chunk);
  }
  check(bytes === expectedSize, 'Model bytes do not match their declared size.');
  return hash.digest('hex');
}
function identity(release: Omit<Release, 'release'>): string {
  return 'models-' + sha(JSON.stringify(release));
}
function overlaps(a: string, b: string): boolean {
  const path = relative(a, b);
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith('../'));
}
async function roots(paths: string[]): Promise<string[]> {
  check(paths.length > 0, 'Provide at least one explicitly reviewed source root.');
  return Promise.all(
    paths.map(async (path) => {
      check(
        (await lstat(path)).isDirectory(),
        'Model root must be a directory, not a symbolic link.'
      );
      return realpath(path);
    })
  );
}
export async function inspectModels(
  manifestPath: string,
  sourceRoots: string[],
  sourceCommit: string
): Promise<{ record: Release; paths: string[] }> {
  check(/^[0-9a-f]{40}$/.test(sourceCommit), 'Provide the exact reviewed source commit.');
  const input = await manifest(manifestPath),
    directories = await roots(sourceRoots);
  const files: ModelFile[] = [],
    paths: string[] = [];
  for (const entry of input.entries) {
    let selected: string | undefined;
    for (const root of directories) {
      try {
        selected = await regular(root, pathname(entry.url));
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    check(selected, 'Required model file is missing: ' + entry.url);
    check((await lstat(selected)).size === entry.size, 'Model source size differs: ' + entry.url);
    files.push({ ...entry, sha256: await hashFile(selected, entry.size) });
    paths.push(selected);
  }
  const payload = { version: 1 as const, sourceCommit, manifestSha256: input.hash, files };
  return { record: { ...payload, release: identity(payload) }, paths };
}
export async function verifyModels(
  rootPath: string,
  manifestPath: string,
  expectedRelease: string
): Promise<Release> {
  const [root] = await roots([rootPath]);
  check(root, 'Model release root is missing.');
  const input = await manifest(manifestPath),
    inventoryPath = await regular(root, metadata);
  check((await lstat(inventoryPath)).size < 2 * 1024 ** 2, 'Model release inventory is too large.');
  const raw = await readFile(inventoryPath);
  let record: Release;
  try {
    record = JSON.parse(raw.toString());
  } catch {
    throw new Error('Model release inventory JSON is invalid.');
  }
  check(
    record.version === 1 && /^[0-9a-f]{40}$/.test(record.sourceCommit),
    'Invalid model release inventory.'
  );
  check(
    record.manifestSha256 === input.hash,
    'Model release does not match the reviewed manifest.'
  );
  check(
    Array.isArray(record.files) && record.files.length === input.entries.length,
    'Model release file count differs.'
  );
  const payload = {
    version: record.version,
    sourceCommit: record.sourceCommit,
    manifestSha256: record.manifestSha256,
    files: record.files,
  };
  check(
    record.release === expectedRelease && record.release === identity(payload),
    'Model release identity differs from the approved release.'
  );
  const wanted = new Set([metadata]);
  for (const [index, entry] of input.entries.entries()) {
    const file = record.files[index];
    check(
      file &&
        file.url === entry.url &&
        file.size === entry.size &&
        /^[0-9a-f]{64}$/.test(file.sha256),
      'Model release entry differs from the manifest.'
    );
    const name = pathname(entry.url);
    wanted.add(name);
    check(
      (await hashFile(await regular(root, name), entry.size)) === file.sha256,
      'Model checksum differs: ' + entry.url
    );
  }
  let visited = 0;
  async function walk(directory: string, prefix: string, depth: number): Promise<void> {
    check(depth < 32, 'Model release tree is too deep.');
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      check(++visited < maxFiles * 8, 'Model release tree contains too many entries.');
      const name = prefix + entry.name;
      check(!entry.isSymbolicLink(), 'Model release contains a symbolic link.');
      if (entry.isDirectory()) await walk(join(directory, entry.name), name + '/', depth + 1);
      else {
        check(
          entry.isFile() && wanted.delete(name),
          'Model release contains an unexpected file: ' + name
        );
      }
    }
  }
  await walk(root, '', 0);
  check(wanted.size === 0, 'Model release is incomplete.');
  return record;
}
export async function stageModels(
  manifestPath: string,
  sourceRoots: string[],
  sourceCommit: string,
  output: string
): Promise<Release> {
  const inspected = await inspectModels(manifestPath, sourceRoots, sourceCommit);
  const parent = await realpath(dirname(resolve(output))),
    target = join(parent, resolve(output).split('/').at(-1)!);
  for (const root of await roots(sourceRoots))
    check(
      !overlaps(root, target) && !overlaps(target, root),
      'Model output must be separate from all source roots.'
    );
  await mkdir(target, { mode: 0o700 }); // Exclusive: preserve every existing release.
  try {
    for (const [index, file] of inspected.record.files.entries()) {
      const source = inspected.paths[index];
      check(source, 'Model source is missing.');
      const destination = join(target, pathname(file.url));
      await mkdir(dirname(destination), { recursive: true, mode: 0o755 });
      await copyFile(source, destination, constants.COPYFILE_EXCL | constants.COPYFILE_FICLONE);
      await chmod(destination, 0o444);
      check(
        (await hashFile(destination, file.size)) === file.sha256,
        'Model source changed during staging.'
      );
    }
    await writeFile(join(target, metadata), JSON.stringify(inspected.record, null, 2) + '\n', {
      flag: 'wx',
      mode: 0o444,
    });
    await verifyModels(target, manifestPath, inspected.record.release);
    await chmod(target, 0o755);
    return inspected.record;
  } catch (error) {
    await rm(target, { recursive: true, force: true });
    throw error;
  }
}
async function main(): Promise<void> {
  const args = parseArgs({
    options: {
      manifest: { type: 'string' },
      source: { type: 'string', multiple: true },
      commit: { type: 'string' },
      output: { type: 'string' },
      root: { type: 'string' },
      release: { type: 'string' },
    },
    allowPositionals: true,
  });
  const command = args.positionals[0],
    values = args.values;
  check(
    args.positionals.length === 1 && values.manifest,
    'Use inspect|stage|verify with --manifest.'
  );
  let record: Release;
  if (command === 'verify') {
    check(
      values.root && values.release,
      'Verification requires --root and the approved --release identity.'
    );
    record = await verifyModels(values.root, values.manifest, values.release);
  } else {
    check(
      (command === 'inspect' || command === 'stage') && values.commit && values.source,
      'Inspection/staging requires reviewed --commit and explicit --source roots.'
    );
    if (command === 'stage') {
      check(values.output, 'Staging requires a new --output directory.');
      record = await stageModels(values.manifest, values.source, values.commit, values.output);
    } else record = (await inspectModels(values.manifest, values.source, values.commit)).record;
  }
  console.log(
    JSON.stringify({
      command,
      release: record.release,
      files: record.files.length,
      bytes: record.files.reduce((sum, file) => sum + file.size, 0),
      manifestSha256: record.manifestSha256,
    })
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch((error) => {
    console.error((error as Error).message);
    process.exitCode = 1;
  });
