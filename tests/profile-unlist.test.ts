// SPDX-License-Identifier: MPL-2.0
/**
 * profiles.json `unlist`: a profile keeps a tool and does not offer the tool. The id stays
 * in the generated index, so a link, a saved project and the render route still open the
 * tool, and the index carries `listed: false`, which the gallery, search and menus read.
 *
 * Run: node --test tests/profile-unlist.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contentRoots } from '../packages/node-shell/src/content-roots.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const profiles = JSON.parse(readFileSync(join(ROOT, 'profiles.json'), 'utf8')).profiles as Record<string, { tools: string[]; catalog: string; unlist?: string[]; exclude?: string[] }>;

test('the resolver reports the unlist set of a profile', () => {
  for (const [name, profile] of Object.entries(profiles)) {
    if (!profile.tools.every((dir) => existsSync(join(ROOT, dir)))) continue; // a pack that is not mounted here
    assert.deepEqual([...contentRoots({ profile: name }).unlist].sort(), [...(profile.unlist ?? [])].sort(), name);
  }
});

test('an unlisted tool stays in the profile index and is marked not listed, in the full and the slim index', () => {
  let checked = 0;
  for (const [name, profile] of Object.entries(profiles)) {
    const dir = join(ROOT, profile.catalog, 'tools');
    const unlist: string[] = profile.unlist ?? [];
    if (!unlist.length || !existsSync(join(dir, 'index.json'))) continue;
    for (const file of ['index.json', 'index.slim.json']) {
      const tools = JSON.parse(readFileSync(join(dir, file), 'utf8')).tools as Array<{ id: string; listed?: boolean }>;
      for (const id of unlist) {
        const entry: { id: string; listed?: boolean } | undefined = tools.find((t) => t.id === id);
        assert.ok(entry, `${name} ${file}: ${id} must stay in the index so its links keep opening`);
        assert.equal(entry.listed, false, `${name} ${file}: ${id}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 0, 'at least one mounted profile unlists a tool');
});

test('a profile never both excludes and unlists one tool', () => {
  for (const [name, profile] of Object.entries(profiles)) {
    const both = (profile.unlist ?? []).filter((id) => (profile.exclude ?? []).includes(id));
    assert.deepEqual(both, [], name);
  }
});
