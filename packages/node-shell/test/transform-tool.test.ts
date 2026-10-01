// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isFileTransform } from '../src/transform-tool.ts';

const community = fileURLToPath(new URL('../../../community/', import.meta.url));

test('an exportFile tool is a transform unless it says it renders stills', () => {
  assert.equal(isFileTransform({ hooks: { exportFile: true }, render: { export: false } }), true);
  assert.equal(isFileTransform({ hooks: { exportFile: true }, render: {} }), true, 'the hook alone still marks a transform');
  assert.equal(isFileTransform({ hooks: { exportFile: true, exportStill: true }, render: {} }), false, 'a still renderer with an extra file action');
  assert.equal(isFileTransform({ hooks: { exportFile: true }, render: { export: true } }), false);
  assert.equal(isFileTransform({ hooks: {}, render: { export: false } }), false);
  assert.equal(isFileTransform({}), false);
});

test('every community utility stays a transform and Darkroom renders stills', () => {
  const ids = readdirSync(community).filter((id) => existsSync(join(community, id, 'tool.json')));
  const transforms = ids.filter((id) => isFileTransform(JSON.parse(readFileSync(join(community, id, 'tool.json'), 'utf8'))));
  for (const id of ['strip-data', 'compress-pdf', 'convert-image', 'redact', 'trim']) assert.ok(transforms.includes(id), id);
  assert.ok(!transforms.includes('darkroom'));
});
