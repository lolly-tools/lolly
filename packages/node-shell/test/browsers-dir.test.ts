// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { join } from 'node:path';
import { playwrightUserCacheDir } from '../src/browsers.ts';

test("Playwright's own per-user cache is where each platform keeps it", () => {
  assert.equal(playwrightUserCacheDir({}, 'darwin', '/Users/a'), join('/Users/a', 'Library', 'Caches', 'ms-playwright'));
  assert.equal(playwrightUserCacheDir({}, 'linux', '/home/a'), join('/home/a', '.cache', 'ms-playwright'));
  assert.equal(playwrightUserCacheDir({ XDG_CACHE_HOME: '/xdg' }, 'linux', '/home/a'), join('/xdg', 'ms-playwright'));
  assert.equal(playwrightUserCacheDir({ LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local' }, 'win32', 'C:\\Users\\a'), join('C:\\Users\\a\\AppData\\Local', 'ms-playwright'));
});
