// SPDX-License-Identifier: MPL-2.0
/**
 * One version number for everything people install (Andy, 2026-10-27). The Lolly
 * release version lives in the desktop app's tauri.conf.json, which the release and
 * YunoHost scripts already read. The CLI and TUI packages published to npm carry the
 * same number, so `lolly --version` and the npm version match the app. A release that
 * bumps tauri.conf.json fails here until those packages move to the same number. The MCP
 * and CA services and the web app follow too (Andy, 2026-10-29), and the MCP server's
 * serverInfo reads its package.json, so agents see the same number. The lolly-render npm
 * packages follow as well (Andy, 2026-11-23). The SDK
 * (@lolly-tools/core) and ENGINE_VERSION keep their own semver: they describe the
 * tool-author API, not a release people install.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const json = (path: string): { version: string } => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));

test('the CLI and TUI packages carry the Lolly release version', () => {
  const release = json('shells/tauri-desktop/src-tauri/tauri.conf.json').version;
  assert.match(release, /^\d+\.\d+\.\d+$/);
  for (const path of ['shells/cli/package.json', 'shells/tui/package.json', 'shells/tauri-desktop/package.json']) {
    assert.equal(json(path).version, release, `${path} must carry the release version ${release}`);
  }
});

test('the services and the web app carry the Lolly release version', async () => {
  const release = json('shells/tauri-desktop/src-tauri/tauri.conf.json').version;
  for (const path of ['services/mcp/package.json', 'services/ca/package.json', 'shells/web/package.json']) {
    assert.equal(json(path).version, release, `${path} must carry the release version ${release}`);
  }
  // The MCP server's serverInfo is what an agent sees, so it is checked as served, not only as declared.
  const { SERVER_INFO } = await import('../services/mcp/src/negotiation.ts');
  assert.deepEqual(SERVER_INFO, { name: 'lolly-mcp', version: release });
});

test('the lolly-render packages carry the Lolly release version', () => {
  // @lolly-tools/render and its platform packages are installed by people, so they follow
  // the release too; the crates themselves keep their own semver, as the Rust kernels do.
  const release = json('shells/tauri-desktop/src-tauri/tauri.conf.json').version;
  const main = JSON.parse(readFileSync(new URL('../crates/lolly-render-node/package.json', import.meta.url), 'utf8')) as { version: string; optionalDependencies: Record<string, string> };
  assert.equal(main.version, release, `crates/lolly-render-node/package.json must carry the release version ${release}`);
  const platforms = ['darwin-arm64', 'linux-x64-gnu', 'linux-x64-musl', 'linux-arm64-gnu', 'win32-x64-msvc'];
  assert.deepEqual(main.optionalDependencies, Object.fromEntries(platforms.map((p) => [`@lolly-tools/render-${p}`, release])), 'each platform package is pinned to the release version');
  for (const platform of platforms) {
    assert.equal(json(`crates/lolly-render-node/npm/${platform}/package.json`).version, release, `the ${platform} package must carry the release version ${release}`);
  }
});
