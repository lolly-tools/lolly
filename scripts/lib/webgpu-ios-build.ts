// SPDX-License-Identifier: MPL-2.0
/** Process-local archive policy and actual nested compiler provenance. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, stat, writeFile, readdir } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { productProbeIdentity } from '../../shells/tauri-shared/webgpu-product-probe.mjs';
import { requireSourceSha, sha256 } from './webgpu-ios-product.ts';
import { IOS_BUILD_MS, processFacts, runOwnedBuild } from './webgpu-ios-process.ts';

const modulePath = fileURLToPath(import.meta.url);
export const IOS_BUILD_PROVISIONING_FLAGS = ['-allowProvisioningUpdates'] as const;
const unsigned = ['CODE_SIGNING_REQUIRED=NO', 'CODE_SIGNING_ALLOWED=NO', 'CODE_SIGN_IDENTITY=""', 'CODE_SIGN_ENTITLEMENTS=""'];
export interface ExecutableIdentity { path: string; sha256: string; size: number; mtimeMs: number; inode: number; device: number }
export interface IosBuildGuard {
  version: 1; repo: string; output: string; runId: string; sourceSha: string; deadline: number;
  toolchain: string; rustc: ExecutableIdentity; cargo: ExecutableIdentity; rustdoc: ExecutableIdentity; xcode: ExecutableIdentity;
  helperSha256: string; processHelperSha256: string; workspace: string; archive: string; target: string; wrapperBin: string;
  compilerWrapper: string; leases: string; compilerRecords: string; path: string;
  protectedGroup: number;
}
function command(command: string, args: string[]): string {
  const reply = spawnSync(command, args, { encoding: 'utf8', timeout: 20_000, maxBuffer: 1024 * 1024 });
  assert.ok(!reply.error && reply.status === 0, 'The selected local build tool cannot be verified.'); return reply.stdout.trim();
}
async function executable(path: string): Promise<ExecutableIdentity> {
  assert.ok(isAbsolute(path)); const exact = await realpath(path), info = await stat(exact);
  assert.ok(info.isFile() && (info.mode & 0o111) !== 0, 'An executable build tool is required.');
  return { path: exact, sha256: sha256(await readFile(exact)), size: info.size, mtimeMs: info.mtimeMs, inode: info.ino, device: info.dev };
}
async function unchangedExecutable(expected: ExecutableIdentity): Promise<void> {
  const info = await stat(expected.path);
  assert.equal(await realpath(expected.path), expected.path);
  assert.deepEqual([info.size, info.mtimeMs, info.ino, info.dev], [expected.size, expected.mtimeMs, expected.inode, expected.device], 'The selected executable identity changed.');
}
const inside = (parent: string, value: string) => resolve(value).startsWith(resolve(parent) + '/');
const quote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;

/** Exact pinned cargo-mobile2 archive command; no export, device or provisioning. */
export function guardedXcodeArgs(args: string[], guard: Pick<IosBuildGuard, 'workspace' | 'archive'>): { args: string[]; removed: number } {
  assert.ok(args.length <= 32 && args.every(arg => arg.length <= 4096), 'The archive command exceeds its bound.');
  const filtered = args.filter(arg => !IOS_BUILD_PROVISIONING_FLAGS.includes(arg as '-allowProvisioningUpdates'));
  const removed = args.length - filtered.length;
  assert.ok(removed <= 2, 'Unexpected provisioning flag repetition.');
  const expected = [...unsigned, '-scheme', 'lolly-mobile_iOS', '-workspace', guard.workspace, '-sdk', 'iphoneos', '-configuration', 'release', 'archive', '-archivePath', guard.archive];
  const ordinary = filtered[4] === '-quiet' ? [...filtered.slice(0, 4), ...filtered.slice(5)] : filtered;
  assert.deepEqual(ordinary, expected, 'Only the exact physical unsigned archive command is permitted.');
  return { args: filtered, removed };
}

/** No imported certificates, account/API credentials, or alternate compiler hooks. */
export function iosArchiveEnvironment(env: NodeJS.ProcessEnv, guard: IosBuildGuard, binding: string): NodeJS.ProcessEnv {
  const result = { ...env };
  for (const key of Object.keys(result)) if (/^(?:IOS_CERTIFICATE(?:_PASSWORD)?|IOS_MOBILE_PROVISION|APPLE_|APP_STORE_|FASTLANE_|MATCH_)/.test(key)) delete result[key];
  for (const key of ['RUSTC', 'RUSTDOC', 'RUSTC_WRAPPER', 'RUSTC_WORKSPACE_WRAPPER', 'CARGO_BUILD_RUSTC', 'CARGO_BUILD_RUSTDOC', 'CARGO_BUILD_RUSTC_WRAPPER', 'CARGO_BUILD_RUSTC_WORKSPACE_WRAPPER']) delete result[key];
  return { ...result, PATH: guard.path, RUSTUP_TOOLCHAIN: guard.toolchain, CARGO_BUILD_RUSTC: guard.rustc.path, CARGO_BUILD_RUSTDOC: guard.rustdoc.path,
    CARGO_BUILD_RUSTC_WRAPPER: guard.compilerWrapper, CARGO_BUILD_RUSTC_WORKSPACE_WRAPPER: '', CARGO_TARGET_DIR: guard.target,
    CARGO_LOLLY_IOS_BUILD_BINDING: binding };
}

async function createWrappers(guardPath: string, guard: IosBuildGuard): Promise<void> {
  for (const [name, mode] of [['xcodebuild', 'xcode'], ['observe-rustc', 'rustc']]) {
    const text = `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(modulePath)} --${mode} ${quote(guardPath)} "$@"\n`;
    await writeFile(join(guard.wrapperBin, name!), text, { flag: 'wx', mode: 0o700 });
  }
}
export async function prepareIosBuildGuard(repo: string, output: string, runId: string, sourceSha: string, env: NodeJS.ProcessEnv): Promise<{ guard: IosBuildGuard; binding: string; env: NodeJS.ProcessEnv; tools: Record<string, unknown> }> {
  requireSourceSha(sourceSha, command('git', ['-C', repo, 'rev-parse', 'HEAD'])); productProbeIdentity(runId);
  const toolchain = env.RUSTUP_TOOLCHAIN;
  assert.ok(toolchain && /^[A-Za-z0-9._-]+$/.test(toolchain), 'Choose an explicit installed RUSTUP_TOOLCHAIN for this qualification.');
  const selected = await Promise.all(['rustc', 'cargo', 'rustdoc'].map(tool => executable(command('rustup', ['which', '--toolchain', toolchain, tool]))));
  const [rustc, cargo, rustdoc] = selected as [ExecutableIdentity, ExecutableIdentity, ExecutableIdentity];
  assert.equal(dirname(cargo.path), dirname(rustc.path)); assert.equal(dirname(rustdoc.path), dirname(rustc.path));
  const wrapperBin = join(output, 'build-bin'), leases = join(output, 'build-processes'), compilerRecords = join(output, 'compiler-invocations');
  for (const path of [wrapperBin, leases, compilerRecords]) await mkdir(path, { mode: 0o700 });
  const guard: IosBuildGuard = { version: 1, repo, output, runId, sourceSha, toolchain, rustc, cargo, rustdoc, deadline: Date.now() + IOS_BUILD_MS,
    xcode: await executable(command('/usr/bin/xcrun', ['--find', 'xcodebuild'])), helperSha256: sha256(await readFile(modulePath)),
    processHelperSha256: sha256(await readFile(join(repo, 'scripts/lib/webgpu-ios-process.ts'))),
    workspace: join(repo, 'shells/tauri-mobile/src-tauri/gen/apple/lolly-mobile.xcodeproj/project.xcworkspace') + '/',
    archive: join(repo, 'shells/tauri-mobile/src-tauri/gen/apple/build/lolly-mobile_iOS'), target: join(output, 'target'),
    wrapperBin, compilerWrapper: join(wrapperBin, 'observe-rustc'), leases, compilerRecords,
    path: [wrapperBin, dirname(rustc.path), env.PATH ?? ''].join(delimiter), protectedGroup: processFacts().find(row => row.pid === process.pid)!.group };
  const bytes = JSON.stringify(guard, null, 2) + '\n', binding = sha256(bytes), path = join(output, 'build-guard.json');
  await writeFile(path, bytes, { flag: 'wx', mode: 0o600 }); await createWrappers(path, guard);
  return { guard, binding, env: iosArchiveEnvironment(env, guard, binding), tools: { toolchain, rustc: command(rustc.path, ['--version', '--verbose']),
    cargo: command(cargo.path, ['--version']), rustdoc: command(rustdoc.path, ['--version']), executables: selected, xcode: guard.xcode } };
}

export function compilerMetadata(args: string[], guard: Pick<IosBuildGuard, 'target'>): { crate: string | null; target: string | null } {
  const value = (flag: string) => args[args.indexOf(flag) + 1];
  const crate = args.includes('--crate-name') ? value('--crate-name') : null;
  const target = args.includes('--target') ? value('--target') : null;
  if (crate !== null) { assert.ok(crate); assert.match(crate, /^[A-Za-z0-9_]{1,128}$/); }
  if (target !== null) assert.ok(target === 'aarch64-apple-ios' || target === 'aarch64-apple-darwin', 'Unexpected compiler target.');
  for (const flag of ['--out-dir', '-o']) if (args.includes(flag)) assert.ok(value(flag) && inside(guard.target, value(flag)!), 'Compiler output is outside the owned target directory.');
  return { crate, target };
}

async function readGuard(path: string): Promise<{ guard: IosBuildGuard; binding: string }> {
  const bytes = await readFile(path); assert.ok(bytes.length <= 32 * 1024);
  const guard = JSON.parse(bytes.toString()) as IosBuildGuard, binding = sha256(bytes);
  assert.equal(guard.version, 1); productProbeIdentity(guard.runId);
  assert.equal(resolve(path), join(guard.output, 'build-guard.json'));
  assert.equal(binding, process.env.CARGO_LOLLY_IOS_BUILD_BINDING, 'The wrapper is outside its owned build process.');
  requireSourceSha(guard.sourceSha, command('git', ['-C', guard.repo, 'rev-parse', 'HEAD']));
  assert.equal(sha256(await readFile(modulePath)), guard.helperSha256);
  assert.equal(sha256(await readFile(join(guard.repo, 'scripts/lib/webgpu-ios-process.ts'))), guard.processHelperSha256);
  assert.equal(process.env.CARGO_BUILD_RUSTC, guard.rustc.path); assert.equal(process.env.CARGO_TARGET_DIR, guard.target);
  assert.equal(process.env.CARGO_BUILD_RUSTC_WRAPPER, guard.compilerWrapper);
  assert.ok(Number.isSafeInteger(guard.protectedGroup) && guard.protectedGroup > 0);
  for (const field of ['wrapperBin', 'leases', 'compilerRecords', 'target'] as const) assert.ok(inside(guard.output, guard[field]));
  assert.ok(Date.now() < guard.deadline);
  return { guard, binding };
}

export async function archiveProvenance(guard: IosBuildGuard, binding: string): Promise<Record<string, unknown>> {
  const bytes = await readFile(join(guard.output, 'xcode-archive-command.json')); assert.ok(bytes.length <= 16 * 1024);
  const row = JSON.parse(bytes.toString());
  assert.equal(row.sourceSha, guard.sourceSha); assert.equal(row.binding, binding); assert.equal(row.executable, guard.xcode.path);
  assert.equal(row.executableSha256, guard.xcode.sha256); assert.equal(row.status, 'completed'); assert.equal(row.exit, 0);
  assert.ok(Number.isInteger(row.provisioningFlagsRemoved) && row.provisioningFlagsRemoved >= 0 && row.provisioningFlagsRemoved <= 2);
  assert.ok(Array.isArray(row.command) && row.command.every((arg: unknown) => typeof arg === 'string'));
  assert.equal(guardedXcodeArgs(row.command, guard).removed, 0, 'The executed archive command retained provisioning.');
  assert.equal(sha256(await readFile(guard.xcode.path)), guard.xcode.sha256);
  return { sourceSha: guard.sourceSha, binding, commandSha256: sha256(bytes), provisioningFlagsRemoved: row.provisioningFlagsRemoved, completedUnsignedArchive: true };
}

async function wrapper(mode: string, path: string, args: string[]): Promise<number> {
  const { guard, binding } = await readGuard(path);
  const rust = mode === '--rustc'; assert.ok(rust || mode === '--xcode');
  const selected = rust ? guard.rustc : guard.xcode; await unchangedExecutable(selected);
  let meta: Record<string, unknown>, outgoing: string[];
  if (rust) {
    assert.equal(args[0], guard.rustc.path, 'Cargo selected an unreviewed compiler.');
    assert.equal(await realpath(command('/usr/bin/which', ['cargo'])), guard.cargo.path, 'Xcode did not retain the selected real Cargo bin.');
    outgoing = args.slice(1); meta = compilerMetadata(outgoing, guard);
  } else {
    const safe = guardedXcodeArgs(args, guard); outgoing = safe.args; meta = { command: outgoing, provisioningFlagsRemoved: safe.removed };
  }
  const row = { sourceSha: guard.sourceSha, binding, executable: selected.path, executableSha256: selected.sha256, ...meta };
  const record = join(rust ? guard.compilerRecords : guard.output, rust ? `${randomUUID()}.json` : 'xcode-archive-command.json');
  await writeFile(record, JSON.stringify({ ...row, status: 'started' }), { flag: 'wx', mode: 0o600 });
  try {
    const status = await runOwnedBuild({ command: selected.path, args: outgoing, cwd: process.cwd(), env: process.env, stdio: ['inherit', 'inherit', 'inherit'],
      leases: guard.leases, binding, deadline: guard.deadline, protectedGroup: guard.protectedGroup });
    await unchangedExecutable(selected);
    await writeFile(record, JSON.stringify({ ...row, status: 'completed', exit: status }), { mode: 0o600 }); return status;
  } catch {
    await writeFile(record, JSON.stringify({ ...row, status: 'failed or interrupted; inspect owned process journal' }), { mode: 0o600 });
    throw new Error('The scoped build tool failed; inspect its bounded owned record.');
  }
}

export async function compilerProvenance(guard: IosBuildGuard, binding: string): Promise<Record<string, unknown>> {
  const files = (await readdir(guard.compilerRecords)).sort(); assert.ok(files.length > 0 && files.length <= 8192, 'Nested compiler evidence is absent or exceeds its bound.');
  const records = await Promise.all(files.map(async name => { assert.match(name, /^[a-f0-9-]{36}\.json$/); const bytes = await readFile(join(guard.compilerRecords, name)); assert.ok(bytes.length <= 4096); return JSON.parse(bytes.toString()); }));
  for (const row of records) {
    assert.equal(row.binding, binding); assert.equal(row.sourceSha, guard.sourceSha); assert.equal(row.executable, guard.rustc.path);
    assert.equal(row.executableSha256, guard.rustc.sha256); assert.equal(row.status, 'completed'); assert.equal(row.exit, 0);
  }
  assert.ok(records.some(row => row.crate === 'lolly_mobile_lib' && row.target === 'aarch64-apple-ios'), 'No completed physical-product compiler invocation was observed.');
  assert.equal(sha256(await readFile(guard.rustc.path)), guard.rustc.sha256);
  return { sourceSha: guard.sourceSha, compiler: guard.rustc, invocationCount: records.length, completedPhysicalProduct: true, recordsSha256: sha256(JSON.stringify(files.map((name, i) => [name, records[i]]))) };
}

if (process.argv[1] && resolve(process.argv[1]) === modulePath) {
  try { process.exitCode = await wrapper(process.argv[2] ?? '', process.argv[3] ?? '', process.argv.slice(4)); }
  catch { console.error('Scoped iOS build guard refused the command; no unvalidated arguments are logged.'); process.exitCode = 1; }
}
