// SPDX-License-Identifier: MPL-2.0
/**
 * The WebGPU startup requirement may be on main, but a release may not ship it before
 * the supported-environment table is published (plan 295 P0b, decided 2026-10-08).
 * Ordinary CI runs `release-checklist --check`, which must stay green without the
 * table; release mode (`pnpm run check:release`) must refuse.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  REQUIRED_WEBGPU_TARGETS, SUPPORTED_ENVIRONMENTS_PATH, assertWebGpuReleaseAllowed,
  supportedEnvironmentProblems, webGpuReleaseProblems, webGpuStartupGatePresent,
} from '../scripts/webgpu-release-gate.ts';
import { main as releaseChecklist } from '../scripts/release-checklist.ts';

const COMPLETE = [
  '| Environment | WebGPU result | Adapter and backend | Evidence |',
  '|---|---|---|---|',
  '| Chrome and Edge (Chromium) 153 | Supported | Metal, SwiftShader | run 1 |',
  '| Firefox 155 | Not supported: no adapter | none | run 2 |',
  '| Safari 26 (WebKit) | Supported | Metal | run 3 |',
  '| macOS app (WKWebView) | Supported | Metal | run 4 |',
  '| iOS and iPadOS app (WKWebView) | Supported | Metal | run 5 |',
  '| Windows app (WebView2) | Supported | D3D12 | run 6 |',
  '| Linux app (WebKitGTK) | Not supported | none | run 7 |',
  '| Android app (WebView) | Supported | Vulkan | run 8 |',
].join('\n');

/** A scratch tree with the shell's main.ts and, optionally, the published table. */
function tree(mainSource: string, table?: string): string {
  const root = mkdtempSync(join(tmpdir(), 'lolly-webgpu-gate-'));
  mkdirSync(join(root, 'shells', 'web', 'src'), { recursive: true });
  writeFileSync(join(root, 'shells', 'web', 'src', 'main.ts'), mainSource);
  if (table !== undefined) {
    mkdirSync(join(root, 'docs'), { recursive: true });
    writeFileSync(join(root, SUPPORTED_ENVIRONMENTS_PATH), table);
  }
  return root;
}
const GATED_MAIN = "import { startWebGpuCheck, webGpuChecked } from './lib/webgpu/device.ts';\nvoid startWebGpuCheck().then(() => {}, () => {});\n";

test('the current shell makes WebGPU a startup requirement, so the gate applies to it', () => {
  // If this fails after a refactor, update webGpuStartupGatePresent: a detector that
  // stops recognising the requirement would let a release through silently.
  assert.equal(webGpuStartupGatePresent(), true);
});

test('the table needs a published result for every required environment', () => {
  assert.deepEqual(supportedEnvironmentProblems(COMPLETE), []);
  const missing = supportedEnvironmentProblems(COMPLETE.split('\n').filter(line => !/Firefox|WebKitGTK/.test(line)).join('\n'));
  assert.deepEqual(missing, ['no row for Firefox', 'no row for Linux app (WebKitGTK)']);
  const pending = supportedEnvironmentProblems(COMPLETE.replace('| Supported | D3D12', '| pending | D3D12'));
  assert.equal(pending.length, 1);
  assert.match(pending[0]!, /Windows app \(WebView2\): the result column says "pending"/);
  assert.equal(supportedEnvironmentProblems('').length, REQUIRED_WEBGPU_TARGETS.length);
});

test('a release is refused without the table, allowed with it, and not gated once the requirement is gone', () => {
  const roots = [tree(GATED_MAIN), tree(GATED_MAIN, COMPLETE), tree('void boot();\n'), tree(GATED_MAIN, COMPLETE.replace(/\| Android.*$/m, ''))];
  try {
    const [absent, published, ungated, partial] = roots as [string, string, string, string];
    assert.deepEqual(webGpuReleaseProblems(absent), [`${SUPPORTED_ENVIRONMENTS_PATH} does not exist`]);
    assert.throws(() => assertWebGpuReleaseAllowed(absent), /Release refused[\s\S]*Windows app \(WebView2\)[\s\S]*Android app \(WebView\)/);
    assert.deepEqual(webGpuReleaseProblems(published), []);
    assert.doesNotThrow(() => assertWebGpuReleaseAllowed(published));
    assert.deepEqual(webGpuReleaseProblems(ungated), []);
    assert.deepEqual(webGpuReleaseProblems(partial), ['no row for Android app (WebView)']);
  } finally { for (const root of roots) rmSync(root, { recursive: true, force: true }); }
});

test('ordinary CI keeps passing release-checklist --check; release mode refuses until the table exists', () => {
  const quiet = console.error;
  console.error = () => {};
  const roots = [tree(GATED_MAIN), tree(GATED_MAIN, COMPLETE)];
  try {
    assert.equal(releaseChecklist(['--check']), 0, 'the per-PR check does not run the release gate');
    assert.equal(releaseChecklist(['--check', '--release'], roots[0]), 1);
    assert.equal(releaseChecklist(['--check', '--release'], roots[1]), 0);
  } finally {
    console.error = quiet;
    for (const root of roots) rmSync(root, { recursive: true, force: true });
  }
});
