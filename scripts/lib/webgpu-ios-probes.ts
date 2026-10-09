// SPDX-License-Identifier: MPL-2.0
/** Exact upstream capability compiles; never an exemption by crate name. */
import assert from 'node:assert/strict';
import { open, realpath } from 'node:fs/promises';
import { basename, isAbsolute, join, resolve } from 'node:path';
import { sha256 } from './webgpu-ios-product.ts';

const registry = 'registry+https://github.com/rust-lang/crates.io-index';
const pins = [
  { name: 'proc-macro2', version: '1.0.106', crate: 'proc_macro2', checksum: '8fd00f0bb2e90d81d1044c2b32617f68fcb9fa3bb7640c23e9c748e53fb30934',
    build: 'baeb20b52f6b536be8657a566591a507bb2e34a45cf8baa42b135510a0c3c729', edition: '2021', cfg: 'procmacro2_build_probe',
    sources: { 'src/probe/proc_macro_span.rs': '53853f0c70170c9695294b8867821664d9b8f1c901957b003003a3c26987abbe',
      'src/probe/proc_macro_span_location.rs': 'e022386204b6e042b3c55a6c809923849a2f915199bcbf3be72d0b7c8ffa7f83',
      'src/probe/proc_macro_span_file.rs': 'e7fb4cf8852d9d589bfa3321d8d5cdc8cccb45606ec816a6b8a08f73e416b9ce' } },
  { name: 'anyhow', version: '1.0.103', crate: 'anyhow', checksum: '2a4385e2e34eb35d6b3efe798b9eb88096925d87726c0798709bf56d9ed84af3',
    build: '89d1baedcff59822ed692d3a33f131c211a213bdec33c83f68b54110d9c64223', edition: '2018', cfg: 'anyhow_build_probe',
    sources: { 'src/nightly.rs': '1c0aeadfcdbe22f8f807b185dec1a7448c378bddb37689714944b60473b58049' } },
  { name: 'thiserror', version: '1.0.69', crate: 'thiserror', checksum: 'b6aaf5339b578ea85b50e080feb250a3e8ae8cfcdff9a461c9ec2904bc923f52',
    build: '275d0ddbb22d5f015fba360f51a48da10b6309410efe8c6ca678412b1e8c9288', edition: '2018', cfg: null,
    sources: { 'build/probe.rs': '2e2198c1aa004aabf8b36cc34e057b4dfce56d23401fe0a7582d8480225817f7' } },
  { name: 'thiserror', version: '2.0.18', crate: 'thiserror', checksum: '4288b5bcbc7920c07a1149a35cf9590a2aa808e0bc1eafaade0b80947865fbc4',
    build: '18bf4b4af0f507c7fdfe4dbfc98b5ac3d6a5ef924f46ee56125fd8b22fd61b4c', edition: '2018', cfg: null,
    sources: { 'build/probe.rs': '8df55471d6b75623d423b17ebbf493335ee66140d1ddd232c88db3e59f61298c' } },
] as const;
type Pin = typeof pins[number];
export interface IosCapabilityProbe {
  id: string; packageChecksum: string; buildScriptSha256: string; sourceSha256: string;
  lockSha256: string; manifestSha256: string; cwdSha256: string; outputSha256: string; argvSha256: string;
}
export interface ProbeCandidate { pin: Pin; source: string; cwd: string; output: string; argvSha256: string }
/** Match the unmodified pinned build-script argv, with no encoded-RUSTFLAGS tail. */
export function capabilityProbeCandidate(args: string[], cwd: string, target: string): ProbeCandidate | null {
  if (!isAbsolute(cwd) || resolve(cwd) !== cwd || !isAbsolute(target) || resolve(target) !== target) return null;
  const pin = pins.find(row => basename(cwd) === row.name + '-' + row.version); if (!pin) return null;
  for (const source of Object.keys(pin.sources)) {
    const index = pin.cfg ? 7 : 6, output = args[index], triple = args[index + 3];
    if (typeof output !== 'string' || triple !== 'aarch64-apple-ios' && triple !== 'aarch64-apple-darwin') continue;
    const prefix = join(target, triple === 'aarch64-apple-ios' ? triple : '') + '/';
    const tail = output.startsWith(prefix) ? output.slice(prefix.length) : '';
    if (!new RegExp('^(?:debug|release)/build/' + pin.name + '-[a-f0-9]{16}/out/probe$').test(tail)) continue;
    const expected = [...(pin.cfg ? ['--cfg=' + pin.cfg] : []), '--edition=' + pin.edition, '--crate-name=' + pin.crate,
      '--crate-type=lib', '--cap-lints=allow', '--emit=dep-info,metadata', '--out-dir', output, source, '--target', triple];
    if (JSON.stringify(args) === JSON.stringify(expected)) return { pin, source, cwd, output, argvSha256: sha256(JSON.stringify(args)) };
  }
  return null;
}
function field(section: string, name: string): string {
  const matches = [...section.matchAll(new RegExp('^' + name + ' = "([^"\\r\\n]*)"$', 'gm'))];
  assert.equal(matches.length, 1, 'Pinned dependency field is missing or ambiguous.'); return matches[0]![1]!;
}
/** Verify all approved versions against the reviewed Cargo lock, not a cache filename. */
export function capabilityProbeReceipt(candidate: ProbeCandidate, facts: { lock: string; manifest: string; buildSha256: string; sourceSha256: string }): IosCapabilityProbe {
  const blocks = facts.lock.split(/^\[\[package\]\]\s*$/m).slice(1);
  for (const name of new Set(pins.map(pin => pin.name))) {
    const approved = pins.filter(pin => pin.name === name);
    const selected = blocks.filter(block => new RegExp('^name = "' + name + '"$', 'm').test(block));
    assert.equal(selected.length, approved.length, 'The pinned capability dependency inventory changed.');
    for (const pin of approved) {
      const exact = selected.filter(block => field(block, 'version') === pin.version); assert.equal(exact.length, 1);
      assert.equal(field(exact[0]!, 'source'), registry); assert.equal(field(exact[0]!, 'checksum'), pin.checksum);
    }
  }
  const packages = facts.manifest.split(/^\[package\]\s*$/m); assert.equal(packages.length, 2);
  const section = packages[1]!.split(/^\[/m)[0]!;
  assert.equal(field(section, 'name'), candidate.pin.name); assert.equal(field(section, 'version'), candidate.pin.version);
  assert.equal(field(section, 'build'), 'build.rs');
  assert.equal(facts.buildSha256, candidate.pin.build, 'The pinned capability build script changed.');
  const sourceSha256 = (candidate.pin.sources as Record<string, string>)[candidate.source]; assert.ok(sourceSha256);
  assert.equal(facts.sourceSha256, sourceSha256, 'The pinned capability source changed.');
  return { id: candidate.pin.name + '@' + candidate.pin.version + ':' + candidate.source, packageChecksum: candidate.pin.checksum,
    buildScriptSha256: candidate.pin.build, sourceSha256, lockSha256: sha256(facts.lock), manifestSha256: sha256(facts.manifest),
    cwdSha256: sha256(candidate.cwd), outputSha256: sha256(candidate.output), argvSha256: candidate.argvSha256 };
}
async function boundedFile(path: string, maximum: number): Promise<Buffer> {
  assert.equal(await realpath(path), path, 'Capability source paths must be canonical and unsymlinked.');
  const file = await open(path, 'r');
  try {
    const before = await file.stat(); assert.ok(before.isFile() && before.size <= maximum, 'Capability source exceeds its bound.');
    const bytes = Buffer.alloc(maximum + 1), { bytesRead } = await file.read(bytes, 0, bytes.length, 0);
    const after = await file.stat(); assert.ok(bytesRead <= maximum);
    assert.deepEqual([after.size, after.mtimeMs, after.ino, after.dev], [before.size, before.mtimeMs, before.ino, before.dev]);
    assert.equal(bytesRead, before.size); return bytes.subarray(0, bytesRead);
  } finally { await file.close(); }
}
/** Capture before execution; recheck the same files after the actual child exits. */
export async function observeCapabilityProbe(args: string[], guard: { repo: string; target: string }, cwd: string): Promise<{ receipt: IosCapabilityProbe; recheck: () => Promise<void> } | null> {
  const candidate = capabilityProbeCandidate(args, cwd, guard.target); if (!candidate) return null;
  assert.equal(await realpath(cwd), cwd); assert.equal(await realpath(candidate.output), candidate.output, 'Capability output is not canonical.');
  const capture = async () => {
    const [lock, manifest, build, source] = await Promise.all([
      boundedFile(join(guard.repo, 'shells/tauri-mobile/src-tauri/Cargo.lock'), 1024 * 1024),
      boundedFile(join(cwd, 'Cargo.toml'), 64 * 1024), boundedFile(join(cwd, 'build.rs'), 64 * 1024),
      boundedFile(join(cwd, candidate.source), 64 * 1024),
    ]);
    return capabilityProbeReceipt(candidate, { lock: lock.toString(), manifest: manifest.toString(), buildSha256: sha256(build), sourceSha256: sha256(source) });
  };
  const receipt = await capture(); return { receipt, recheck: async () => { assert.deepEqual(await capture(), receipt, 'Capability sources changed during execution.'); } };
}
/** Only fixed identifiers/hashes are persisted; no source, argv or environment. */
export function validateCapabilityProbe(receipt: IosCapabilityProbe): void {
  assert.ok(receipt && typeof receipt === 'object' && !Array.isArray(receipt));
  assert.deepEqual(Object.keys(receipt).sort(), ['id', 'packageChecksum', 'buildScriptSha256', 'sourceSha256', 'lockSha256', 'manifestSha256', 'cwdSha256', 'outputSha256', 'argvSha256'].sort());
  const pin = pins.find(pin => Object.keys(pin.sources).some(source => receipt.id === pin.name + '@' + pin.version + ':' + source));
  assert.ok(pin, 'Unapproved capability probe identifier.');
  assert.equal(receipt.packageChecksum, pin.checksum); assert.equal(receipt.buildScriptSha256, pin.build);
  assert.equal(receipt.sourceSha256, (pin.sources as Record<string, string>)[receipt.id.split(':')[1]!]);
  for (const key of ['packageChecksum', 'buildScriptSha256', 'sourceSha256', 'lockSha256', 'manifestSha256', 'cwdSha256', 'outputSha256', 'argvSha256'] as const) assert.match(receipt[key], /^[a-f0-9]{64}$/, 'Invalid capability probe hash.');
}
