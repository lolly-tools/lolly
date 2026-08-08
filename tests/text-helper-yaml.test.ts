// SPDX-License-Identifier: MPL-2.0
/**
 * text-helper YAML engine tests.
 *
 * Run with: node --test tests/text-helper-yaml.test.ts
 *
 * The Text Helper tool used to ship a hand-rolled "common-subset" YAML parser
 * inline in its template. A YAML core-team maintainer (perlpunk / Tina Müller)
 * reported it broken for explicit keys, anchors/aliases and octal/hex numbers
 * (lolly-tools/lolly#1) and recommended github.com/eemeli/yaml. We now vendor
 * that library as a classic-script global (community/text-helper/lib/yaml.min.js)
 * and load it on demand, mirroring the D3 tool.
 *
 * These guards run the ACTUAL vendored artifact — evaluated exactly as a browser
 * classic <script> would (`var YAML = (() => …)()`) — so a re-vendor that broke
 * the surface or dropped a feature fails here, and assert that the template is
 * wired to it and no longer carries the old parser.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'community', 'text-helper');
const LIB = readFileSync(join(TOOL_DIR, 'lib', 'yaml.min.js'), 'utf8');
const TEMPLATE = readFileSync(join(TOOL_DIR, 'template.html'), 'utf8');

// Evaluate the IIFE bundle in an isolated scope and hand back its `YAML` global,
// the way `<script src=…>` would leave `window.YAML`. The bundle is DOM-free.
const YAML = new Function(`${LIB}\nreturn YAML;`)() as {
  parse(src: string): unknown;
  parseAllDocuments(src: string): Array<{ errors: Array<{ message: string }>; toJS(): unknown }>;
  stringify(value: unknown): string;
};

test('vendored bundle exposes the parse/stringify surface the tool uses', () => {
  assert.equal(typeof YAML.parse, 'function');
  assert.equal(typeof YAML.parseAllDocuments, 'function');
  assert.equal(typeof YAML.stringify, 'function');
});

// The three cases from the bug report, each of which the old parser got wrong.
test('explicit "? key / : value" mappings parse (were reported invalid)', () => {
  assert.deepEqual(YAML.parse('? key\n: value'), { key: 'value' });
});

test('anchors & aliases resolve (were not understood at all)', () => {
  assert.deepEqual(YAML.parse('a: &x 1\nb: *x'), { a: 1, b: 1 });
  assert.deepEqual(YAML.parse('- &alias value\n- second'), ['value', 'second']);
});

test('octal (0o7) and hex (0x10) numbers are recognised', () => {
  assert.deepEqual(YAML.parse('- 0o7\n- 0x10'), [7, 16]);
});

// Features the common-subset parser could not do, common in real k8s / Helm.
test('block & folded scalars, flow collections, merge keys', () => {
  assert.deepEqual(YAML.parse('s: |\n  line1\n  line2'), { s: 'line1\nline2\n' });
  assert.deepEqual(YAML.parse('s: >\n  a\n  b'), { s: 'a b\n' });
  assert.deepEqual(YAML.parse('m: {a: 1,\n b: 2}'), { m: { a: 1, b: 2 } });
});

test('multi-document streams parse via parseAllDocuments', () => {
  const docs = YAML.parseAllDocuments('kind: Service\n---\nkind: Pod');
  assert.equal(docs.length, 2);
  assert.equal(docs.flatMap((d) => d.errors).length, 0);
  assert.deepEqual(docs[0]!.toJS(), { kind: 'Service' });
  assert.deepEqual(docs[1]!.toJS(), { kind: 'Pod' });
});

test('parse errors carry a line/column so the tool can point at the fault', () => {
  const docs = YAML.parseAllDocuments('a: [1, 2\nb: 3');
  const errs = docs.flatMap((d) => d.errors);
  assert.ok(errs.length >= 1, 'expected at least one parse error');
  // The tool surfaces the first line of the message; it must name a location.
  assert.match(errs[0]!.message.split('\n')[0]!, /at line \d+, column \d+/);
});

test('JSON → YAML stringify round-trips a nested object', () => {
  assert.equal(YAML.stringify({ replicas: 3, labels: { app: 'web' } }), 'replicas: 3\nlabels:\n  app: web\n');
});

// Wiring guards: the template must actually use the library, not the old parser.
test('template loads the vendored global and drops the hand-rolled parser', () => {
  assert.match(TEMPLATE, /\/tools\/text-helper\/lib\/yaml\.min\.js/, 'template must reference the vendored lib');
  assert.match(TEMPLATE, /loadYaml\(\)\.then/, 'yaml/helm ops must load the library');
  assert.match(TEMPLATE, /parseAllDocuments/, 'ops must parse via eemeli/yaml');
  assert.doesNotMatch(TEMPLATE, /function yamlParse\b/, 'the old hand-rolled parser must be gone');
  assert.doesNotMatch(TEMPLATE, /common-subset parser/, 'the old status copy must be gone');
});
