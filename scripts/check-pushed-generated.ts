#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/** Check generated source maps at pushed ref tips without touching the checkout or index. */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const GENERATORS = ['scripts/gen-web-src-readme.ts', 'scripts/gen-engine-modules.ts'];
const INPUTS = [...GENERATORS, 'package.json', 'shells/web/src', 'engine/src', 'engine/README.md', 'tests'];
const OBJECT_ID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const MAX_BUFFER = 256 * 1024 * 1024;

interface PushTip { object: string; ref: string }
interface TreeFile { object: string; name: string }

/** Git supplies four space-separated fields per update; a zero local object deletes a ref. */
export function pushedTips(input: string): PushTip[] {
  return input.split('\n').filter(line => line.trim()).flatMap((line, index) => {
    const fields = line.trim().split(/\s+/);
    const [localRef, localObject, remoteRef, remoteObject] = fields;
    if (fields.length !== 4 || !localRef || !remoteRef ||
        !localObject || !OBJECT_ID.test(localObject) || !remoteObject || !OBJECT_ID.test(remoteObject)) {
      throw new Error(`Malformed pre-push update on line ${index + 1}.`);
    }
    return /^0+$/.test(localObject) || localObject === remoteObject ? [] : [{ object: localObject, ref: remoteRef }];
  });
}

function git(args: string[], input?: string): Buffer {
  const result = spawnSync('git', args, { input, maxBuffer: MAX_BUFFER });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git ${args[0]} failed: ${result.stderr.toString().trim()}`);
  return result.stdout;
}

/** Read raw blobs: archive attributes and checkout filters must not alter generator inputs. */
function snapshot(commit: string, directory: string): void {
  const entries = git(['ls-tree', '-rz', '--full-tree', commit, '--', ...INPUTS]).toString('utf8');
  const files: TreeFile[] = entries.split('\0').filter(Boolean).map(entry => {
    const match = /^(100644|100755) blob ([a-f0-9]+)\t([\s\S]+)$/.exec(entry);
    if (!match) throw new Error(`Generated-source input must be a regular file: ${entry}`);
    const [, , object, name] = match;
    if (!object || !name || name.split('/').some(part => part === '..' || part === '.' || part === '')) {
      throw new Error(`Invalid generated-source input path: ${entry}`);
    }
    return { object, name };
  });
  for (const generator of GENERATORS) {
    if (!files.some(file => file.name === generator)) throw new Error(`Missing generator at ${commit}: ${generator}`);
  }
  const blobs = git(['cat-file', '--batch'], files.map(file => file.object).join('\n') + '\n');
  let cursor = 0;
  for (const file of files) {
    const end = blobs.indexOf(10, cursor);
    const header = blobs.subarray(cursor, end).toString('ascii');
    const [object, type, sizeText] = header.split(' ');
    const size = Number(sizeText);
    if (end < cursor || object !== file.object || type !== 'blob' || !Number.isSafeInteger(size) || size < 0 ||
        end + 1 + size >= blobs.length || blobs[end + 1 + size] !== 10) {
      throw new Error(`Invalid Git blob response for ${file.name}.`);
    }
    const destination = join(directory, file.name);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, blobs.subarray(end + 1, end + 1 + size));
    cursor = end + size + 2;
  }
  if (cursor !== blobs.length) throw new Error('Unexpected trailing Git blob data.');
}

function checkTips(tips: PushTip[]): boolean {
  const commits = new Map<string, string[]>();
  for (const tip of tips) {
    const object = git(['rev-parse', '--verify', '--end-of-options', `${tip.object}^{}`]).toString().trim();
    if (git(['cat-file', '-t', object]).toString().trim() !== 'commit') {
      console.log(`Generated source maps: ${tip.ref} points to a non-commit object; no source tree to check.`);
      continue;
    }
    const refs = commits.get(object) ?? [];
    refs.push(tip.ref);
    commits.set(object, refs);
  }
  let clean = true;
  const started = performance.now();
  for (const [commit, refs] of commits) {
    console.log(`Checking generated source maps at ${commit.slice(0, 12)} (${refs.join(', ')}).`);
    // On macOS /var aliases /private/var; generator entry-point guards compare URLs.
    const directory = realpathSync(mkdtempSync(join(tmpdir(), 'lolly-generated-check-')));
    try {
      snapshot(commit, directory);
      for (const generator of GENERATORS) {
        const result = spawnSync(process.execPath, [join(directory, generator), '--check'], {
          cwd: directory, encoding: 'utf8', maxBuffer: MAX_BUFFER,
        });
        if (result.stdout) process.stdout.write(result.stdout);
        if (result.stderr) process.stderr.write(result.stderr);
        if (result.error) throw result.error;
        if (result.status !== 0) clean = false;
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      clean = false;
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
  if (!clean) {
    console.error('Generated source maps failed in a pushed commit. In a worktree for the affected ref, run:\n' +
      '  node scripts/gen-web-src-readme.ts\n  node scripts/gen-engine-modules.ts\n' +
      'Review and commit the generated README changes, then push again. Uncommitted fixes do not change the pushed commit.');
  }
  console.log(`Generated source maps: ${commits.size} distinct commit tip(s) checked in ${((performance.now() - started) / 1000).toFixed(2)}s.`);
  return clean;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 0) throw new Error('Usage: node scripts/check-pushed-generated.ts --pre-push < ref-updates\n' +
      '   or: node scripts/check-pushed-generated.ts <commit-or-ref> [...]');
    const tips = args[0] === '--pre-push' && args.length === 1
      ? pushedTips(readFileSync(0, 'utf8'))
      : args.map(ref => ({ object: git(['rev-parse', '--verify', '--end-of-options', ref]).toString().trim(), ref }));
    if (!checkTips(tips)) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
