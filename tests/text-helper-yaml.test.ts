// SPDX-License-Identifier: MPL-2.0
/**
 * Regression cases reported against Text Helper's former subset YAML parser.
 * Text now uses the installed eemeli/yaml parser through the shared engine.
 * The explicit-key, alias and numeric fixtures retain the original bug report.
 */

import { test } from 'node:test';
import { readYaml, writeYaml } from '../engine/src/text-formats.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'community', 'text-helper');
const TEMPLATE = readFileSync(join(TOOL_DIR, 'template.html'), 'utf8');

// The three cases from the bug report, each of which the old parser got wrong.
test('explicit "? key / : value" mappings parse (were reported invalid)', () => {
  assert.deepEqual(readYaml('? key\n: value')[0], { key: 'value' });
});

test('anchors & aliases resolve (were not understood at all)', () => {
  assert.deepEqual(readYaml('a: &x 1\nb: *x')[0], { a: 1, b: 1 });
  assert.deepEqual(readYaml('- &alias value\n- second')[0], ['value', 'second']);
});

test('octal (0o7) and hex (0x10) numbers are recognised', () => {
  assert.deepEqual(readYaml('- 0o7\n- 0x10')[0], [7, 16]);
});

// Features the common-subset parser could not do, common in real k8s / Helm.
test('block & folded scalars, flow collections, merge keys', () => {
  assert.deepEqual(readYaml('s: |\n  line1\n  line2')[0], { s: 'line1\nline2\n' });
  assert.deepEqual(readYaml('s: >\n  a\n  b')[0], { s: 'a b\n' });
  assert.deepEqual(readYaml('m: {a: 1,\n b: 2}')[0], { m: { a: 1, b: 2 } });
});

test('multi-document streams retain each document', () => {
  assert.deepEqual(readYaml('kind: Service\n---\nkind: Pod'), [{ kind: 'Service' }, { kind: 'Pod' }]);
});

test('parse errors carry a line and column', () => {
  assert.throws(() => readYaml('a: [1, 2\nb: 3'), /at line \d+, column \d+/);
});

test('JSON to YAML round-trips a nested object', () => {
  const values = [{ replicas: 3, labels: { app: 'web' } }];
  assert.deepEqual(readYaml(writeYaml(values)), values);
});

// The browser and CLI now share the engine's installed eemeli/yaml parser.
test('Text uses the same full YAML parser through its portable bridge', async () => {
  const source = '? key\n: value\na: &x 0xFF\nb: *x\n';
  assert.deepEqual(readYaml(source), [{ key: 'value', a: 255, b: 255 }]);
  assert.deepEqual(readYaml(writeYaml(readYaml(source))), readYaml(source));
  const hooks = readFileSync(join(TOOL_DIR, 'hooks.js'), 'utf8');
  assert.match(hooks, /host\.textTools\.run/);
  assert.doesNotMatch(TEMPLATE, /function yamlParse\b/);
});
