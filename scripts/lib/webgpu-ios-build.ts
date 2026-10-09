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
export interface IosObjectCopyTool { requestedPath: string; executable: ExecutableIdentity; version: string }
export interface IosObjectCopyTools {
  sysroot: string; host: 'aarch64-apple-darwin' | 'x86_64-apple-darwin';
  llvmObjcopy: IosObjectCopyTool; rustObjcopy: IosObjectCopyTool;
}
export interface IosBuildGuard {
  version: 1; repo: string; output: string; runId: string; sourceSha: string; deadline: number;
  toolchain: string; rustc: ExecutableIdentity; cargo: ExecutableIdentity; rustdoc: ExecutableIdentity; xcode: ExecutableIdentity;
  helperSha256: string; processHelperSha256: string; workspace: string; archive: string; target: string; wrapperBin: string;
  compilerWrapper: string; leases: string; compilerRecords: string; path: string;
  protectedGroup: number;
  objectCopyTools: IosObjectCopyTools;
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
const objectCopyNames = { llvmObjcopy: 'llvm-objcopy', rustObjcopy: 'rust-objcopy' } as const;
function objectCopyVersion(path: string): string {
  const reply = spawnSync(path, ['--version'], { encoding: 'utf8', timeout: 20_000, maxBuffer: 1024 });
  assert.ok(!reply.error && reply.status === 0, 'The selected Rust object-copy tool cannot be verified; install its llvm-tools component.');
  const version = reply.stdout.trim();
  assert.ok(version.length > 0 && Buffer.byteLength(version) <= 1024 && /^[\t\r\n\x20-\x7e]+$/.test(version) && /\bLLVM\b/.test(version), 'The object-copy version exceeds its printable evidence bound.');
  return version;
}
/** Swift bindings use the selected compiler's host tools, not a PATH fallback. */
export async function prepareIosObjectCopyTools(rustc: ExecutableIdentity): Promise<IosObjectCopyTools> {
  const sysrootValue = command(rustc.path, ['--print', 'sysroot']); assert.ok(isAbsolute(sysrootValue));
  const sysroot = await realpath(sysrootValue);
  assert.equal(dirname(dirname(rustc.path)), sysroot, 'The selected compiler and its sysroot differ.');
  const host = /^host: ([^\r\n]+)$/m.exec(command(rustc.path, ['--version', '--verbose']))?.[1];
  assert.ok(host === 'aarch64-apple-darwin' || host === 'x86_64-apple-darwin', 'An Apple compiler host is required.');
  const tools = {} as Pick<IosObjectCopyTools, 'llvmObjcopy' | 'rustObjcopy'>;
  for (const [key, name] of Object.entries(objectCopyNames)) {
    const requestedPath = join(sysroot, 'lib/rustlib', host, 'bin', name);
    const identity = await executable(requestedPath);
    assert.ok(inside(sysroot, identity.path));
    assert.equal(dirname(identity.path), await realpath(dirname(requestedPath)), 'The object-copy executable is outside the selected host tool directory.');
    tools[key as keyof typeof tools] = { requestedPath, executable: identity, version: objectCopyVersion(requestedPath) };
  }
  return { sysroot, host, ...tools };
}
/** Recheck aliases and bytes before Xcode and after a completed archive. */
export async function verifyIosObjectCopyTools(tools: IosObjectCopyTools): Promise<void> {
  assert.ok(isAbsolute(tools.sysroot)); assert.equal(await realpath(tools.sysroot), tools.sysroot);
  assert.ok(tools.host === 'aarch64-apple-darwin' || tools.host === 'x86_64-apple-darwin');
  for (const [key, name] of Object.entries(objectCopyNames)) {
    const tool = tools[key as keyof typeof objectCopyNames];
    assert.equal(tool.requestedPath, join(tools.sysroot, 'lib/rustlib', tools.host, 'bin', name));
    assert.deepEqual(await executable(tool.requestedPath), tool.executable, 'The selected object-copy executable changed.');
  }
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
  const objectCopyTools = await prepareIosObjectCopyTools(rustc);
  const wrapperBin = join(output, 'build-bin'), leases = join(output, 'build-processes'), compilerRecords = join(output, 'compiler-invocations');
  for (const path of [wrapperBin, leases, compilerRecords]) await mkdir(path, { mode: 0o700 });
  const guard: IosBuildGuard = { version: 1, repo, output, runId, sourceSha, toolchain, rustc, cargo, rustdoc, deadline: Date.now() + IOS_BUILD_MS,
    xcode: await executable(command('/usr/bin/xcrun', ['--find', 'xcodebuild'])), helperSha256: sha256(await readFile(modulePath)),
    processHelperSha256: sha256(await readFile(join(repo, 'scripts/lib/webgpu-ios-process.ts'))),
    workspace: join(repo, 'shells/tauri-mobile/src-tauri/gen/apple/lolly-mobile.xcodeproj/project.xcworkspace') + '/',
    archive: join(repo, 'shells/tauri-mobile/src-tauri/gen/apple/build/lolly-mobile_iOS'), target: join(output, 'target'),
    wrapperBin, compilerWrapper: join(wrapperBin, 'observe-rustc'), leases, compilerRecords,
    path: [wrapperBin, dirname(rustc.path), env.PATH ?? ''].join(delimiter), protectedGroup: processFacts().find(row => row.pid === process.pid)!.group, objectCopyTools };
  const bytes = JSON.stringify(guard, null, 2) + '\n', binding = sha256(bytes), path = join(output, 'build-guard.json');
  assert.ok(Buffer.byteLength(bytes) <= 32 * 1024, 'The build guard exceeds its evidence bound.');
  await writeFile(path, bytes, { flag: 'wx', mode: 0o600 }); await createWrappers(path, guard);
  return { guard, binding, env: iosArchiveEnvironment(env, guard, binding), tools: { toolchain, rustc: command(rustc.path, ['--version', '--verbose']),
    cargo: command(cargo.path, ['--version']), rustdoc: command(rustdoc.path, ['--version']), executables: selected, xcode: guard.xcode, objectCopyTools } };
}

// Only input-free, stdout-only information queries can have a nonzero outcome.
// native-static-libs/link-args may compile; crate-name/file-names may read input.
const informationPrints = ['sysroot', 'host-tuple', 'target-libdir', 'cfg', 'target-list', 'target-cpus', 'target-features',
  'relocation-models', 'code-models', 'tls-models', 'deployment-target', 'split-debuginfo'] as const;
const diagnosticPrints = [...informationPrints, 'crate-name', 'file-names', 'native-static-libs', 'link-args',
  'target-spec-json', 'all-target-specs-json', 'calling-conventions', 'stack-protector-strategies',
  'explain', 'codegen-help', 'unstable-help', 'lint-help', 'unknown'] as const;
const compilerFlags = ['--crate-name', '--target', '--out-dir', '-o', '--emit', '--print', '--version', '--verbose', '--help',
  '--crate-type', '--edition', '--cfg', '--check-cfg', '--extern', '--cap-lints', '--force-warn', '--error-format', '--json', '--color',
  '--diagnostic-width', '--remap-path-prefix', '--remap-path-scope', '--sysroot', '--test', '--explain',
  '-C', '-L', '-l', '-Z', '-W', '-A', '-D', '-F', '-g', '-O', 'input', 'unknown-option'] as const;
const valueFlags = ['--crate-type', '--edition', '--cfg', '--check-cfg', '--extern', '--cap-lints', '--force-warn', '--error-format', '--json',
  '--color', '--diagnostic-width', '--remap-path-prefix', '--remap-path-scope', '--sysroot', '--explain', '-C', '-L', '-l', '-Z', '-W', '-A', '-D', '-F'];
const compilerAliases: Record<string, string> = { '--codegen': '-C', '--warn': '-W', '--allow': '-A', '--deny': '-D', '--forbid': '-F' };
export interface CompilerMetadata {
  metadataVersion: 1; crate: string | null; target: string | null;
  operation: 'compile' | 'information' | 'unclassified'; argvSha256: string; argumentCount: number;
  flags: string[]; querySelectors: string[]; ownedOutputCount: number; inputCount: number; sourceInputCount: number;
}
function ownedCompilerOutput(value: string, guard: Pick<IosBuildGuard, 'target'>): void {
  assert.ok(isAbsolute(value) && [...value].every(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
    && !value.split('/').some(part => part === '.' || part === '..')
    && inside(guard.target, value), 'Compiler output is outside the owned target directory.');
}
function informationGrammar(row: CompilerMetadata): boolean {
  if (row.crate !== null || row.ownedOutputCount !== 0 || row.querySelectors.length === 0) return false;
  const flags = new Set(row.flags), queries = row.querySelectors;
  if (queries.length === 1 && queries[0] === 'version') return row.target === null && flags.has('--version')
    && [...flags].every(flag => flag === '--version' || flag === '--verbose')
    && row.argumentCount >= 1 && row.argumentCount <= (flags.has('--verbose') ? 2 : 1);
  if (queries.length === 1 && queries[0] === 'help') return row.target === null && flags.size === 1 && flags.has('--help') && row.argumentCount === 1;
  return flags.has('--print') && [...flags].every(flag => flag === '--print' || flag === '--target')
    && queries.every(query => informationPrints.includes(query as typeof informationPrints[number]))
    && row.argumentCount >= queries.length + Number(row.target !== null)
    && row.argumentCount <= 2 * (queries.length + Number(row.target !== null));
}
/** Evidence contains fixed flag names/selectors and an argv hash, never values. */
export function compilerMetadata(args: string[], guard: Pick<IosBuildGuard, 'target'>): CompilerMetadata {
  assert.ok(isAbsolute(guard.target), 'The owned compiler target directory must be absolute.');
  assert.ok(args.length > 0 && args.length <= 4096 && args.every(arg => typeof arg === 'string' && arg.length > 0
    && Buffer.byteLength(arg) <= 16 * 1024) && Buffer.byteLength(JSON.stringify(args)) <= 1024 * 1024, 'Compiler arguments exceed their bound.');
  assert.ok(!args.some(arg => arg.startsWith('@') || arg === '--'), 'Response files and ambiguous compiler argument boundaries are refused.');
  const values = new Map<string, string>(), flags = new Set<string>(), prints = new Set<string>(), specialQueries = new Set<string>();
  let version = 0, verbose = 0, help = 0, compilation = false, ownedOutputCount = 0, inputCount = 0, sourceInputCount = 0;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    const long = /^(--crate-name|--target|--out-dir|--print|--emit)(?:=(.*))?$/.exec(arg);
    if (long || arg === '-o' || arg.startsWith('-o')) {
      const flag = long?.[1] ?? '-o', attached = long ? long[2] : arg.length > 2 ? arg.slice(2) : undefined;
      const value = attached ?? args[++i];
      assert.ok(value && !value.startsWith('-') && !(flag === '-o' && value.startsWith('=')), 'A guarded compiler flag has a missing or ambiguous value.');
      flags.add(flag);
      if (flag === '--print') {
        assert.match(value, /^[a-z][a-z-]{0,63}$/, 'Redirected or ambiguous compiler print selectors are refused.');
        assert.ok(!prints.has(value) && prints.size < 16, 'Duplicate or excessive compiler print selectors.'); prints.add(value);
        if (value === 'native-static-libs' || value === 'link-args') compilation = true;
      } else {
        assert.ok(!values.has(flag), 'Duplicate guarded compiler flag.'); values.set(flag, value);
        if (flag === '--out-dir' || flag === '-o') { ownedCompilerOutput(value, guard); ownedOutputCount++; }
        if (flag === '--emit') {
          const kinds = new Set<string>();
          for (const emit of value.split(',')) {
            const [kind, destination, ...extra] = emit.split('=');
            assert.ok(kind && ['asm', 'dep-info', 'link', 'llvm-bc', 'llvm-ir', 'metadata', 'mir', 'obj'].includes(kind)
              && !kinds.has(kind) && extra.length === 0, 'Ambiguous compiler emit selector.'); kinds.add(kind);
            if (destination !== undefined) { ownedCompilerOutput(destination, guard); ownedOutputCount++; }
          }
        }
        if (flag !== '--target') compilation = true;
      }
    } else if (arg === '-vV' || arg === '--version' || arg === '-V') {
      version++; flags.add('--version'); if (arg === '-vV') { verbose++; flags.add('--verbose'); }
    } else if (arg === '--verbose' || arg === '-v') { verbose++; flags.add('--verbose'); }
    else if (arg === '--help' || arg === '-h') { help++; flags.add('--help'); }
    else {
      assert.ok(!/^(?:--version|--verbose|--help)=/.test(arg), 'Ambiguous compiler information flag.');
      const originalName = arg.startsWith('--') ? arg.split('=')[0]! : /^-[CLlZWADF].+/.test(arg) ? arg.slice(0, 2) : arg;
      const name = compilerAliases[originalName] ?? originalName;
      const known = arg.startsWith('-') && compilerFlags.includes(name as typeof compilerFlags[number]);
      flags.add(known ? name : arg.startsWith('-') && arg !== '-' ? 'unknown-option' : 'input');
      if (known && valueFlags.includes(name)) {
        const attached = originalName.startsWith('--') && arg.includes('=') ? arg.slice(originalName.length + 1)
          : originalName.length === 2 && arg.length > 2 ? arg.slice(2) : undefined;
        const value = attached ?? args[++i]; assert.ok(value && !value.startsWith('-'), 'A compiler option value is missing.');
        if (name === '--explain') specialQueries.add('explain');
        if (value === 'help' && ['-C', '-Z', '-W', '-A', '-D', '-F', '--force-warn'].includes(name)) specialQueries.add(name === '-C' ? 'codegen-help' : name === '-Z' ? 'unstable-help' : 'lint-help');
      } else if (!arg.startsWith('-') || arg === '-') { inputCount++; if (arg.endsWith('.rs')) sourceInputCount++; }
      if (known || !arg.startsWith('-') || arg === '-') compilation = true;
    }
  }
  assert.ok(version <= 1 && verbose <= 1 && help <= 1, 'Duplicate compiler information flag.');
  const crate = values.get('--crate-name') ?? null, target = values.get('--target') ?? null;
  if (crate !== null) assert.match(crate, /^[A-Za-z0-9_]{1,128}$/, 'Invalid compiler crate name.');
  if (target !== null) assert.ok(target === 'aarch64-apple-ios' || target === 'aarch64-apple-darwin', 'Unexpected compiler target.');
  const querySelectors = version ? ['version'] : help ? ['help'] : [...new Set([...prints].map(value =>
    diagnosticPrints.includes(value as typeof diagnosticPrints[number]) ? value : 'unknown').concat([...specialQueries]))];
  const row: CompilerMetadata = { metadataVersion: 1, crate, target, operation: compilation ? 'compile' : 'unclassified',
    argvSha256: sha256(JSON.stringify(args)), argumentCount: args.length, flags: [...flags].sort(), querySelectors, ownedOutputCount, inputCount, sourceInputCount };
  if (informationGrammar(row)) row.operation = 'information';
  if (version || help) assert.ok(informationGrammar(row), 'Mixed compiler information and compilation arguments are refused.');
  validateCompilerMetadata(row);
  return row;
}
function validateCompilerMetadata(row: CompilerMetadata): void {
  assert.ok(row.metadataVersion === 1 && ['compile', 'information', 'unclassified'].includes(row.operation), 'Compiler operation evidence is absent.');
  assert.ok(typeof row.argvSha256 === 'string' && /^[a-f0-9]{64}$/.test(row.argvSha256)
    && Number.isSafeInteger(row.argumentCount) && row.argumentCount > 0 && row.argumentCount <= 4096, 'Compiler argument binding is invalid.');
  assert.ok(row.crate === null || typeof row.crate === 'string' && /^[A-Za-z0-9_]{1,128}$/.test(row.crate));
  assert.ok(row.target === null || row.target === 'aarch64-apple-ios' || row.target === 'aarch64-apple-darwin');
  assert.ok(Array.isArray(row.flags) && row.flags.length > 0 && row.flags.length <= compilerFlags.length && new Set(row.flags).size === row.flags.length
    && row.flags.every(flag => compilerFlags.includes(flag as typeof compilerFlags[number])), 'Compiler diagnostic flags are invalid.');
  assert.ok(Array.isArray(row.querySelectors) && row.querySelectors.length <= 16 && new Set(row.querySelectors).size === row.querySelectors.length
    && row.querySelectors.every(query => query === 'version' || query === 'help' || diagnosticPrints.includes(query as typeof diagnosticPrints[number])), 'Compiler diagnostic selectors are invalid.');
  assert.ok((row.crate !== null) === row.flags.includes('--crate-name') && (row.target !== null) === row.flags.includes('--target'), 'Compiler identity flags differ from their evidence.');
  assert.ok(Number.isSafeInteger(row.inputCount) && row.inputCount >= 0 && row.inputCount <= row.argumentCount
    && Number.isSafeInteger(row.sourceInputCount) && row.sourceInputCount >= 0 && row.sourceInputCount <= row.inputCount
    && (row.inputCount > 0) === row.flags.includes('input'), 'Compiler input evidence is invalid.');
  assert.ok(Number.isSafeInteger(row.ownedOutputCount) && row.ownedOutputCount >= 0 && row.ownedOutputCount <= 10
    && row.ownedOutputCount >= Number(row.flags.includes('--out-dir')) + Number(row.flags.includes('-o'))
    && (row.ownedOutputCount === 0 || row.flags.some(flag => flag === '--out-dir' || flag === '-o' || flag === '--emit')), 'Compiler output evidence is invalid.');
  if (row.operation === 'information') assert.ok(informationGrammar(row), 'Compiler information evidence contains compilation or unknown selectors.');
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
  await verifyIosObjectCopyTools(guard.objectCopyTools);
  return { sourceSha: guard.sourceSha, binding, commandSha256: sha256(bytes), provisioningFlagsRemoved: row.provisioningFlagsRemoved, completedUnsignedArchive: true, objectCopyTools: guard.objectCopyTools };
}

async function wrapper(mode: string, path: string, args: string[]): Promise<number> {
  const { guard, binding } = await readGuard(path);
  const rust = mode === '--rustc'; assert.ok(rust || mode === '--xcode');
  const selected = rust ? guard.rustc : guard.xcode; await unchangedExecutable(selected);
  let meta: Record<string, unknown> | CompilerMetadata, outgoing: string[];
  if (rust) {
    assert.equal(args[0], guard.rustc.path, 'Cargo selected an unreviewed compiler.');
    assert.equal(await realpath(command('/usr/bin/which', ['cargo'])), guard.cargo.path, 'Xcode did not retain the selected real Cargo bin.');
    outgoing = args.slice(1); meta = compilerMetadata(outgoing, guard);
  } else {
    const safe = guardedXcodeArgs(args, guard); outgoing = safe.args; meta = { command: outgoing, provisioningFlagsRemoved: safe.removed };
    await verifyIosObjectCopyTools(guard.objectCopyTools);
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
  for (const [index, row] of records.entries()) {
    assert.equal(row.binding, binding); assert.equal(row.sourceSha, guard.sourceSha); assert.equal(row.executable, guard.rustc.path);
    assert.equal(row.executableSha256, guard.rustc.sha256); assert.equal(row.status, 'completed'); validateCompilerMetadata(row);
    assert.ok(Number.isInteger(row.exit) && row.exit >= 0 && row.exit <= 255, 'Compiler exit evidence is invalid.');
    assert.ok(row.exit === 0 || row.operation === 'information', `Nonzero compiler operation refused: ${JSON.stringify({ record: files[index], operation: row.operation,
      flags: row.flags, querySelectors: row.querySelectors, argumentCount: row.argumentCount, argvSha256: row.argvSha256 })}`);
  }
  assert.ok(records.some(row => row.crate === 'lolly_mobile_lib' && row.target === 'aarch64-apple-ios' && row.operation === 'compile'
    && row.ownedOutputCount > 0 && row.inputCount === 1 && row.sourceInputCount === 1 && row.querySelectors.length === 0
    && !row.flags.some((flag: string) => ['--print', '--version', '--help', '--explain', 'unknown-option'].includes(flag))
    && row.exit === 0), 'No completed physical-product compiler invocation was observed.');
  assert.equal(sha256(await readFile(guard.rustc.path)), guard.rustc.sha256);
  return { sourceSha: guard.sourceSha, compiler: guard.rustc, invocationCount: records.length, completedPhysicalProduct: true,
    nonzeroInformationQueries: records.filter(row => row.exit !== 0 && row.operation === 'information').length,
    recordsSha256: sha256(JSON.stringify(files.map((name, i) => [name, records[i]]))) };
}

if (process.argv[1] && resolve(process.argv[1]) === modulePath) {
  try { process.exitCode = await wrapper(process.argv[2] ?? '', process.argv[3] ?? '', process.argv.slice(4)); }
  catch { console.error('Scoped iOS build guard refused the command; no unvalidated arguments are logged.'); process.exitCode = 1; }
}
