// SPDX-License-Identifier: MPL-2.0
/**
 * One version number for everything people install (Andy, 2026-10-27). The Lolly
 * release version lives in the desktop app's tauri.conf.json, which the release and
 * YunoHost scripts already read. The CLI and TUI packages published to npm carry the
 * same number, so `lolly --version` and the npm version match the app. A release that
 * bumps tauri.conf.json fails here until those packages move to the same number. The SDK
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
