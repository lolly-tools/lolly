// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromiumUsernsProfile } from '../scripts/ci-chromium-userns.ts';

const root = '/home/runner/work/lolly/lolly/.browsers';
const binary = `${root}/chromium-1243/chrome-linux64/chrome`;

test('runner profile grants userns only to one literal installed Chromium executable', () => {
  const profile = chromiumUsernsProfile(binary, root);
  assert.match(
    profile,
    new RegExp(`profile lolly-ci-chromium ${binary.replace(/[.]/g, '\\.')} flags=\\(unconfined\\)`)
  );
  assert.match(profile, /\n {2}userns,\n/);
  assert.doesNotMatch(profile, /\*|sysctl|complain|no-sandbox|capability/);
});

test('runner profile refuses external, wildcard and malformed executable attachments', () => {
  for (const path of [
    '/usr/bin/chrome',
    `${root}/../chrome`,
    `${root}/chromium-*/chrome-linux64/chrome`,
    `${binary}\nprofile evil /**`,
    `${root}/chromium-1243/chrome-linux64/other`,
    'relative/chrome',
    `${root}/chromium-1243/chrome-linux64/chrome"`,
  ])
    assert.throws(() => chromiumUsernsProfile(path, root));
});
