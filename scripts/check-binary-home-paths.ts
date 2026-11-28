#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * No home-directory path in a committed binary.
 *
 *   node scripts/check-binary-home-paths.ts            every tracked binary, minified or generated file
 *   node scripts/check-binary-home-paths.ts <file...>  only these files, whatever their kind
 *
 * A compiler writes source paths into what it builds: Rust panic messages name the
 * file of every crate from outside the package by its absolute path, so a kernel built
 * on a laptop carried /Users/<name>/.cargo/registry/... and published the builder's
 * user name. The kernel build scripts now remap those paths (scripts/lib/wasm-rustflags.ts),
 * and this check fails when any committed binary still holds one, whatever tool built the file.
 *
 * Scanned: every tracked file Git would call binary (a NUL byte in its first 8,000
 * bytes, Git's own test), every minified file, source map, `.wasm` and `.node`, and the
 * generated function bundles under api/. Hand-written source and test files are not
 * scanned: they quote example paths on purpose, and a reviewer reads them.
 *
 * A home-directory path is a macOS `/Users/<name>/`, a Linux `/home/<name>/`, a Windows
 * `<drive>:\Users\<name>\` (either slash, escaped or not) or a dot directory under
 * `/root/`. The shared profile folders that belong to no person (`/Users/Shared`,
 * `C:\Users\Public`, `C:\Users\Default`) are not home directories. Nothing else is
 * exempt, and there is no allowlist: rebuild the file with its paths remapped.
 *
 * The scan reads bytes, not lines. `git grep -E` stops a line at a NUL byte, so a
 * regular expression over a .wasm through it finds nothing even when the path is there.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

const NAME = '[A-Za-z0-9._-]{1,64}';
const SEP = '(?:\\\\\\\\|\\\\|/)';
const HOME_PATH = new RegExp(
  [
    `/Users/(${NAME})(?=[/\\0])`,
    `/home/(${NAME})(?=[/\\0])`,
    `[A-Za-z]:${SEP}Users${SEP}(${NAME})(?=[\\\\/\\0])`,
    '/root/(?=\\.[A-Za-z])()',
  ].join('|'),
  'g',
);
/** Profile folders that hold no one's files. */
const SHARED_PROFILES = new Set(['shared', 'public', 'default']);

export interface HomePathFinding {
  offset: number;
  /** The path with the user name replaced, so the report does not repeat the name. */
  path: string;
}

/** Every home-directory path in the bytes, with its byte offset. */
export function findHomePaths(bytes: Uint8Array): HomePathFinding[] {
  const text = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('latin1');
  const findings: HomePathFinding[] = [];
  for (const match of text.matchAll(HOME_PATH)) {
    const name = match[1] ?? match[2] ?? match[3] ?? '';
    if (SHARED_PROFILES.has(name.toLowerCase())) continue;
    const start = match.index ?? 0;
    const tail = /^[\x21-\x7e]{0,80}/.exec(text.slice(start + match[0].length))?.[0] ?? '';
    const shown = name ? match[0].slice(0, match[0].length - name.length) + '<name>' : match[0];
    findings.push({ offset: start, path: shown + tail });
  }
  return findings;
}

const SCANNED_BY_NAME = /\.(?:wasm|node|map)$|\.min\.(?:js|mjs|cjs|css)$|^api\/.+\.js$/;

/** Git's binary test: a NUL byte in the first 8,000 bytes. */
export function looksBinary(bytes: Uint8Array): boolean {
  return bytes.subarray(0, 8000).includes(0);
}

/** True when the check scans this tracked file. */
export function isScanned(path: string, bytes: Uint8Array): boolean {
  return SCANNED_BY_NAME.test(path) || looksBinary(bytes);
}

function trackedFiles(): string[] {
  return execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0')
    .filter(Boolean);
}

export function checkFiles(paths: string[], { all = false } = {}): { scanned: number; failures: { path: string; findings: HomePathFinding[] }[] } {
  let scanned = 0;
  const failures: { path: string; findings: HomePathFinding[] }[] = [];
  for (const path of paths) {
    let bytes: Buffer;
    try { bytes = readFileSync(resolve(ROOT, path)); } catch { continue; } // a submodule gitlink or a file deleted in the working tree
    if (!all && !isScanned(path, bytes)) continue;
    scanned++;
    const findings = findHomePaths(bytes);
    if (findings.length) failures.push({ path, findings });
  }
  return { scanned, failures };
}

function main(): void {
  const named = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  const { scanned, failures } = named.length ? checkFiles(named, { all: true }) : checkFiles(trackedFiles());
  if (!failures.length) {
    console.log(`binary home paths: ${scanned} files scanned, none holds a home-directory path.`);
    return;
  }
  console.error(`binary home paths: ${failures.length} of ${scanned} scanned files hold a home-directory path.\n`);
  for (const { path, findings } of failures) {
    console.error(`  ${path} (${findings.length})`);
    for (const finding of findings.slice(0, 3)) console.error(`    at byte ${finding.offset}: ${finding.path}`);
  }
  console.error(
    '\nA build wrote its own machine\'s paths, and with them a user name, into a published file. ' +
    'Rebuild it with the paths remapped: the Rust kernel scripts take theirs from scripts/lib/wasm-rustflags.ts ' +
    '(--remap-path-prefix); C and Emscripten builds use -ffile-prefix-map. Do not edit the bytes by hand.',
  );
  process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
