#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Hand a built frontend from one workflow job to the next as one file instead of a directory.
 *
 * upload-artifact zips a directory one file at a time, and download-artifact unzips it in a single
 * JavaScript stream at about 12 MB/s. Preview run 40524327407 spent 8.5 of its 28.5 minutes moving
 * artifacts that way: 3 m 47 s alone to unzip the 2.9 GB signed web frontend. A zstd tar uploaded with
 * `archive: false` travels as one blob and unpacks in seconds.
 *
 *   node scripts/artifact-archive.ts pack <directory> <out.tar.zst>
 *   node scripts/artifact-archive.ts unpack <in.tar.zst> <new directory>
 *
 * pack follows symbolic links, as the zip did, so an archive holds regular files and directories and
 * nothing else. unpack reads every header before it writes a byte and refuses anything else: a link, a
 * device, an absolute path, a `..` step or a repeated path. The compile job that packs the input runs
 * third-party build code, and the job that unpacks it holds a catalog signing key.
 *
 * Modification times travel with the files. scripts/build-delivery.ts stamps every served file at the
 * epoch and builds nginx's native validators from that stamp; the zip round trip replaced the stamp
 * with the time of the download, so those validators never matched.
 */
import { spawn } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BLOCK = 512;
/** release-frontend-receipt.ts accepts 150000 entries; leave room for the directories it also counts. */
export const MAX_ENTRIES = 200000;
/** A pax record or GNU long name is a few hundred bytes; anything larger is not one this pack wrote. */
const MAX_META_BYTES = 64 * 1024;
const REGULAR = new Set(['0', '\0']);
const DIRECTORY = '5';

export interface ArchiveSummary { files: number; directories: number; bytes: number }

function refuse(message: string): never {
  throw new Error(`Artifact archive refused: ${message}`);
}

const text = (block: Buffer, start: number, length: number): string => {
  const field = block.subarray(start, start + length);
  const end = field.indexOf(0);
  return field.subarray(0, end < 0 ? field.length : end).toString('utf8');
};

function octal(block: Buffer, start: number, length: number): number {
  const field = block.subarray(start, start + length);
  if (field[0]! & 0x80) {
    // GNU base-256: big-endian, the top bit only marks the encoding.
    let value = field[0]! & 0x7f;
    for (const byte of field.subarray(1)) value = value * 256 + byte;
    if (!Number.isSafeInteger(value)) refuse('an entry size is out of range');
    return value;
  }
  const digits = text(block, start, length).trim();
  if (!/^[0-7]*$/.test(digits)) refuse('a header number is not octal');
  return digits ? Number.parseInt(digits, 8) : 0;
}

function checksumMatches(block: Buffer): boolean {
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 0x20 : block[i]!;
  return sum === octal(block, 148, 8);
}

/** The archive path as the tree will hold it: no leading "./", no trailing "/", and only plain steps. */
export function entryPath(raw: string, directory: boolean): string {
  if (!raw || raw.includes('\0') || /[\\\p{Cc}]/u.test(raw)) refuse('an entry path is empty or holds a control character');
  if (raw.startsWith('/')) refuse(`absolute path ${JSON.stringify(raw)}`);
  let path = raw;
  while (path.startsWith('./')) path = path.slice(2);
  if (directory) path = path.replace(/\/+$/, '');
  if (path === '.') path = '';
  if (!path) {
    if (!directory) refuse('a file entry has no name');
    return '';
  }
  for (const step of path.split('/')) {
    if (!step || step === '.' || step === '..') refuse(`path ${JSON.stringify(raw)} has an empty, "." or ".." step`);
  }
  return path;
}

function paxRecords(data: Buffer): Map<string, string> {
  const records = new Map<string, string>();
  let offset = 0;
  while (offset < data.length) {
    const space = data.indexOf(0x20, offset);
    if (space < 0) refuse('a pax record has no length');
    const length = Number(data.subarray(offset, space).toString('ascii'));
    if (!Number.isSafeInteger(length) || length <= space - offset + 1 || offset + length > data.length) refuse('a pax record length is wrong');
    const record = data.subarray(space + 1, offset + length - 1).toString('utf8');
    if (data[offset + length - 1] !== 0x0a) refuse('a pax record is not newline terminated');
    const equals = record.indexOf('=');
    if (equals <= 0) refuse('a pax record has no key');
    records.set(record.slice(0, equals), record.slice(equals + 1));
    offset += length;
  }
  return records;
}

/**
 * Reads a tar stream header by header and refuses any entry that is not a plain file or directory
 * under the archive root. Data is skipped, never buffered, so a 3 GB archive costs one pass.
 */
export class TarScanner {
  readonly paths = new Set<string>();
  files = 0;
  directories = 0;
  bytes = 0;
  private pending = Buffer.alloc(0);
  private skip = 0;
  private meta: { kind: 'x' | 'L'; size: number; chunks: Buffer[]; got: number } | null = null;
  private nextPath: string | null = null;
  private nextSize: number | null = null;
  private ended = false;

  write(chunk: Buffer): void {
    let data = this.pending.length ? Buffer.concat([this.pending, chunk]) : chunk;
    this.pending = Buffer.alloc(0);
    while (data.length) {
      if (this.skip) {
        const step = Math.min(this.skip, data.length);
        if (this.meta) {
          const want = Math.min(step, this.meta.size - this.meta.got);
          if (want > 0) { this.meta.chunks.push(data.subarray(0, want)); this.meta.got += want; }
        }
        this.skip -= step;
        data = data.subarray(step);
        if (!this.skip && this.meta) this.finishMeta();
        continue;
      }
      if (data.length < BLOCK) { this.pending = Buffer.from(data); return; }
      this.header(data.subarray(0, BLOCK));
      data = data.subarray(BLOCK);
    }
  }

  private finishMeta(): void {
    const meta = this.meta!;
    this.meta = null;
    const body = Buffer.concat(meta.chunks);
    if (meta.kind === 'L') {
      this.nextPath = text(body, 0, body.length);
      return;
    }
    for (const [key, value] of paxRecords(body)) {
      if (key === 'path') this.nextPath = value;
      else if (key === 'size') {
        if (!/^[0-9]{1,15}$/.test(value)) refuse('a pax size is malformed');
        this.nextSize = Number(value);
      } else if (key === 'linkpath' || key.startsWith('GNU.sparse')) refuse(`pax key ${key} is not allowed`);
    }
  }

  private header(block: Buffer): void {
    if (this.ended) {
      if (block.some(byte => byte !== 0)) refuse('data follows the end of the archive');
      return;
    }
    if (block.every(byte => byte === 0)) { this.ended = true; return; }
    if (!checksumMatches(block)) refuse('a header checksum is wrong');
    const type = String.fromCharCode(block[156]!);
    const headerSize = octal(block, 124, 12);
    if (type === 'x' || type === 'L') {
      if (this.meta || headerSize > MAX_META_BYTES) refuse('an extended header is too large or nested');
      this.meta = { kind: type, size: headerSize, chunks: [], got: 0 };
      this.skip = Math.ceil(headerSize / BLOCK) * BLOCK;
      if (!this.skip) this.finishMeta();
      return;
    }
    const magic = block.subarray(257, 263).toString('latin1');
    // POSIX ustar splits long paths into prefix/name; the GNU format keeps other fields there.
    const prefix = magic === 'ustar\0' ? text(block, 345, 155) : '';
    const raw = this.nextPath ?? (prefix ? `${prefix}/${text(block, 0, 100)}` : text(block, 0, 100));
    const size = this.nextSize ?? headerSize;
    this.nextPath = null;
    this.nextSize = null;
    const directory = type === DIRECTORY;
    if (!directory && !REGULAR.has(type)) {
      const kinds: Record<string, string> = { 1: 'hard link', 2: 'symbolic link', 3: 'character device', 4: 'block device', 6: 'FIFO', 7: 'contiguous file', g: 'global pax header', K: 'long link name', S: 'sparse file' };
      refuse(`${kinds[type] ?? `entry type ${JSON.stringify(type)}`} ${JSON.stringify(raw)}`);
    }
    if (directory && size) refuse('a directory entry carries data');
    const path = entryPath(raw, directory);
    if (this.paths.has(path)) refuse(`path ${JSON.stringify(path)} appears twice`);
    this.paths.add(path);
    if (this.paths.size > MAX_ENTRIES) refuse(`more than ${MAX_ENTRIES} entries`);
    if (directory) this.directories++;
    else { this.files++; this.bytes += size; }
    this.skip = Math.ceil(size / BLOCK) * BLOCK;
  }

  end(): ArchiveSummary {
    if (this.pending.length || this.skip || this.meta || this.nextPath !== null || this.nextSize !== null) refuse('the archive is truncated');
    if (!this.ended) refuse('the archive has no end marker');
    return { files: this.files, directories: this.directories, bytes: this.bytes };
  }
}

type Command = [string, string[]];

/** Runs producer | consumer and resolves when both exit 0. onData, when given, also sees every byte. */
function pipe(producer: Command, consumer: Command | null, onData?: (chunk: Buffer) => void): Promise<void> {
  // macOS tar would otherwise add a "._" entry beside every file that carries extended attributes.
  const env = { ...process.env, COPYFILE_DISABLE: '1' };
  return new Promise((done, fail) => {
    const left = spawn(producer[0], producer[1], { stdio: ['ignore', 'pipe', 'inherit'], env });
    const right = consumer ? spawn(consumer[0], consumer[1], { stdio: ['pipe', 'ignore', 'inherit'], env }) : null;
    let open = right ? 2 : 1, failed = false;
    const fault = (error: Error) => {
      if (failed) return;
      failed = true;
      left.kill();
      right?.kill();
      fail(error);
    };
    const exited = (name: string) => (code: number | null, signal: NodeJS.Signals | null) => {
      if (code !== 0) fault(new Error(`${name} exited ${code ?? signal}`));
      else if (--open === 0 && !failed) done();
    };
    left.on('error', fault).on('close', exited(producer[0]));
    right?.on('error', fault).on('close', exited(consumer![0]));
    left.stdout.on('data', (chunk: Buffer) => {
      try { onData?.(chunk); } catch (error) { fault(error as Error); }
    });
    if (right) {
      right.stdin.on('error', () => { /* the consumer's exit code reports the failure */ });
      left.stdout.pipe(right.stdin);
    }
  });
}

/** Reads every header of a .tar.zst and writes no file. */
export async function scan(archive: string): Promise<ArchiveSummary> {
  const scanner = new TarScanner();
  await pipe(['zstd', ['-dcq', '--', archive]], null, chunk => scanner.write(chunk));
  return scanner.end();
}

export async function pack(directory: string, out: string): Promise<ArchiveSummary> {
  directory = resolve(directory);
  out = resolve(out);
  if (!out.endsWith('.tar.zst')) refuse('the archive name must end in .tar.zst');
  if (!lstatSync(directory, { throwIfNoEntry: false })?.isDirectory()) refuse('the input is not a directory');
  if (existsSync(out)) refuse('the archive already exists');
  // -h: follow links as the zip did. -T0: every core. Level 3 halves the transfer for a few seconds.
  await pipe(['tar', ['-C', directory, '-chf', '-', '.']], ['zstd', ['-T0', '-3', '-q', '-o', out]]);
  try {
    return await scan(out);
  } catch (error) {
    rmSync(out, { force: true });
    throw error;
  }
}

function walk(root: string, directory = root): void {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name), state = lstatSync(path);
    if (state.isDirectory()) walk(root, path);
    else if (!state.isFile() || state.nlink !== 1) refuse(`${path.slice(root.length + 1)} unpacked as something other than a single regular file`);
  }
}

export async function unpack(archive: string, directory: string): Promise<ArchiveSummary> {
  archive = resolve(archive);
  directory = resolve(directory);
  if (!lstatSync(archive, { throwIfNoEntry: false })?.isFile()) refuse('the archive is not a regular file');
  if (existsSync(directory)) refuse('the output directory already exists');
  const summary = await scan(archive);
  mkdirSync(directory, { recursive: true });
  await pipe(['zstd', ['-dcq', '--', archive]], ['tar', ['-C', directory, '-xf', '-', '--no-same-owner', '--no-same-permissions']]);
  walk(directory);
  return summary;
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const [command, from, to] = argv;
  if (argv.length !== 3 || !from || !to || (command !== 'pack' && command !== 'unpack')) {
    throw new Error('Usage: node scripts/artifact-archive.ts pack <directory> <out.tar.zst> | unpack <in.tar.zst> <new directory>');
  }
  const started = Date.now();
  const summary = command === 'pack' ? await pack(from, to) : await unpack(from, to);
  console.log(`${command}: ${summary.files} files, ${summary.directories} directories, ${summary.bytes} bytes in ${((Date.now() - started) / 1000).toFixed(1)} s`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
