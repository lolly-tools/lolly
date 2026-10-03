// SPDX-License-Identifier: MPL-2.0
/**
 * org/opened-projects: the set of opened team projects that the openers report to
 * and the inbox banner listens on. Also pins why the module exists: no opener imports
 * org/banner.ts, because the banner sits in the org/index.ts load cycle and an
 * opener importing the banner pulled the Share dialog's Team section into that cycle.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { _clearOpenedProjectsForTests, noteProjectOpened, onProjectOpened, openedProjects } from './opened-projects.ts';

test('an opening is remembered and told to the listener; an empty id is ignored', () => {
  _clearOpenedProjectsForTests();
  const heard: string[] = [];
  onProjectOpened((id) => heard.push(id));
  noteProjectOpened('');
  noteProjectOpened('prj_1');
  noteProjectOpened('prj_1');
  assert.deepEqual(heard, ['prj_1', 'prj_1'], 'every opening reaches the listener');
  assert.deepEqual([...openedProjects()], ['prj_1'], 'the set holds each project once');
  onProjectOpened(null);
  noteProjectOpened('prj_2');
  assert.deepEqual(heard, ['prj_1', 'prj_1'], 'a cleared listener hears nothing');
  assert.ok(openedProjects().has('prj_2'), 'the opening is still remembered for a later inbox load');
  _clearOpenedProjectsForTests();
});

test('the openers report to the leaf and never import the banner', () => {
  const read = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');
  for (const f of ['./team-open.ts', './team-projects.ts']) {
    const src = read(f);
    assert.match(src, /from '\.\/opened-projects\.ts'/, `${f} reports openings to the leaf`);
    assert.doesNotMatch(src, /['"]\.\/banner\.ts['"]/, `${f} must not import org/banner.ts`);
  }
  assert.doesNotMatch(read('./opened-projects.ts'), /^import /m, 'org/opened-projects.ts stays a leaf');
  assert.match(read('./banner.ts'), /onProjectOpened\(/, 'the banner listens for openings');
});
