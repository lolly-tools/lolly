// SPDX-License-Identifier: MPL-2.0
/** Pinned CLI derivations, not an exclusion of generated Apple source inputs. */
import assert from 'node:assert/strict';
import { productProbeIdentity } from '../../shells/tauri-shared/webgpu-product-probe.mjs';
import { sha256 } from './webgpu-ios-product.ts';

export const IOS_APPLE_INPUTS = {
  project: 'shells/tauri-mobile/src-tauri/gen/apple/lolly-mobile.xcodeproj/project.pbxproj',
  info: 'shells/tauri-mobile/src-tauri/gen/apple/lolly-mobile_iOS/Info.plist',
} as const;
export interface AppleInputs { project: string; info: string }

function object(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), 'The Apple project object is invalid.');
  return value as Record<string, unknown>;
}

/** Select the actual app target's configuration list, not every matching line. */
function targetConfigurationIds(parsed: Record<string, unknown>): string[] {
  const objects = object(parsed.objects);
  const targets = Object.values(objects).map(object).filter(row => row.isa === 'PBXNativeTarget' && row.name === 'lolly-mobile_iOS');
  assert.equal(targets.length, 1, 'One ordinary mobile app target is required.');
  const list = object(objects[String(targets[0]!.buildConfigurationList)]);
  assert.equal(list.isa, 'XCConfigurationList');
  const ids = list.buildConfigurations;
  assert.ok(Array.isArray(ids) && ids.length === 2 && new Set(ids).size === 2, 'Exactly the ordinary debug and release configurations are required.');
  const names = ids.map(id => { assert.match(id, /^[A-F0-9]{24}$/); const row = object(objects[id]); assert.equal(row.isa, 'XCBuildConfiguration'); return row.name; });
  assert.deepEqual([...names].sort(), ['debug', 'release']);
  return ids;
}

export function expectedAppleProject(original: string, parsed: Record<string, unknown>, runId: string): string {
  const identifier = productProbeIdentity(runId);
  let result = original;
  for (const id of targetConfigurationIds(parsed)) {
    const block = new RegExp(`(^\\t\\t${id} /\\* (?:debug|release) \\*/ = \\{\\n)([\\s\\S]*?)(^\\t\\t\\};)`, 'gm');
    let found = 0;
    result = result.replace(block, (_whole, head: string, body: string, end: string) => {
      found++;
      let updated = body;
      for (const [key, value] of [['PRODUCT_BUNDLE_IDENTIFIER', identifier], ['PRODUCT_NAME', '"Lolly WebGPU Product Qualification"']]) {
        const line = new RegExp(`^(\\t\\t\\t\\t${key} = )[^\\n]+;$`, 'gm');
        assert.equal([...updated.matchAll(line)].length, 1, 'The expected app build setting must occur once.');
        updated = updated.replace(line, `$1${value};`);
      }
      return head + updated + end;
    });
    assert.equal(found, 1, 'The selected Apple configuration block is absent or ambiguous.');
  }
  return result;
}

/** Tauri 2.12.1 merges plist dictionaries shallowly, in this exact order. */
export function expectedAppleInfo(baseline: Record<string, unknown>, version: string, overlays: readonly Record<string, unknown>[]): Record<string, unknown> {
  assert.match(version, /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/, 'An authored application version is required.');
  const merged = Object.assign({}, baseline, { CFBundleShortVersionString: version }, ...overlays);
  // cargo-mobile2 0.22.5 invokes agvtool new-version -all before archive.
  return { ...merged, CFBundleVersion: version };
}

export function validateAppleDerivatives(original: AppleInputs, actual: AppleInputs, parsedProject: Record<string, unknown>, expectedInfo: Record<string, unknown>, actualInfo: Record<string, unknown>, runId: string): Record<string, unknown> {
  assert.equal(actual.project, expectedAppleProject(original.project, parsedProject, runId), 'Unexpected Apple project source mutation.');
  assert.deepEqual(actualInfo, expectedInfo, 'Unexpected generated Info.plist value, scene, version or registration change.');
  return { policy: 'tauri-cli 2.12.1 / cargo-mobile2 0.22.5 exact derivation',
    project: { inputSha256: sha256(original.project), outputSha256: sha256(actual.project) },
    info: { inputSha256: sha256(original.info), outputSha256: sha256(actual.info) } };
}

/** Raw receipts are retained; only two independently validated derivatives may differ. */
export function validateIosSourceChanges(before: Record<string, unknown>, after: Record<string, unknown>, changedPaths: string[]): void {
  assert.equal(before.sourceDirty, '', 'Apple derivation requires a clean prepared input tree.');
  assert.equal(after.sourceSha, before.sourceSha, 'The source commit changed.');
  assert.deepEqual(after.untrackedSourceFiles, before.untrackedSourceFiles, 'Untracked source changed.');
  const oldFiles = object(before.sourceFiles), newFiles = object(after.sourceFiles);
  assert.deepEqual(Object.keys(newFiles).sort(), Object.keys(oldFiles).sort());
  const allowed = new Set<string>(Object.values(IOS_APPLE_INPUTS));
  for (const path of Object.keys(oldFiles)) if (!allowed.has(path)) assert.equal(newFiles[path], oldFiles[path], 'Another qualification source input changed.');
  const generatedCss = object(after.generatedInfoCss);
  for (const path of changedPaths) assert.ok(allowed.has(path) || Object.hasOwn(generatedCss, path), 'A source outside the exact Apple derivations changed.');
  for (const key of ['cspSha256', 'desktopLockSha256']) assert.equal(after[key], before[key]);
}
