// SPDX-License-Identifier: MPL-2.0
/**
 * prepare-document.ts turns one uploaded file's bytes into a
 * PreparationDocument: bounded units a UI can show and edit, and a `write()`
 * that reassembles edited bytes without corrupting the surrounding structure.
 * These tests pin the contract engine/src/prepare.ts relies on: plain text
 * round-trips through a single unit, JSON/YAML scalars become individually
 * addressable units whose field name drives sensitivity, an edit through
 * write() produces valid JSON again, unsupported binary formats are retained
 * untouched with a limitation recorded (never silently dropped), the
 * documented size/scope budgets degrade gracefully instead of throwing, and a
 * zip archive expands into child documents that preparationDocuments()
 * flattens.
 *
 * Run with: node --test tests/prepare-document.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  openPreparationDocument,
  preparationDocuments,
  PREPARE_MAX_BYTES,
  PREPARE_MAX_SCOPES,
  type PreparationBudget,
} from '../engine/src/prepare-document.ts';
import { storeZip, readZipMembers } from '../engine/src/zip.ts';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
function budget(): PreparationBudget {
  return { scopes: 0, expanded: 0, units: 0 };
}

test('a plain text file becomes one "Text" unit that write() can replace', () => {
  const bytes = encoder.encode('hello world');
  const doc = openPreparationDocument(bytes, 'notes.txt', 'src', 'src', [], budget());
  assert.equal(doc.scope.status, 'inspected');
  assert.equal(doc.scope.format, 'text');
  assert.equal(doc.units.length, 1);
  assert.equal(doc.units[0]!.location, 'Text');
  const out = doc.write(new Map([[doc.units[0]!.id, 'goodbye']]), new Set());
  assert.equal(decoder.decode(out), 'goodbye');
});

test('write() with no matching values returns the original bytes object unchanged', () => {
  const bytes = encoder.encode('hello world');
  const doc = openPreparationDocument(bytes, 'notes.txt', 'src', 'src', [], budget());
  const out = doc.write(new Map(), new Set());
  assert.equal(out, bytes);
});

test('a JSON field named "password" is marked sensitive and edits stay valid JSON', () => {
  const json = JSON.stringify({ username: 'ada', password: 'hunter2' });
  const bytes = encoder.encode(json);
  const doc = openPreparationDocument(bytes, 'creds.json', 'src', 'src', [], budget());
  assert.equal(doc.scope.format, 'json');
  const pwUnit = doc.units.find(u => u.field === 'password');
  const userUnit = doc.units.find(u => u.location.includes('username'));
  assert.ok(pwUnit, 'password value should be a unit with field "password"');
  assert.equal(userUnit?.field, undefined, 'a non-sensitive field name is not flagged');
  const out = doc.write(new Map([[pwUnit!.id, 'REDACTED']]), new Set());
  const parsed = JSON.parse(decoder.decode(out));
  assert.equal(parsed.password, 'REDACTED');
  assert.equal(parsed.username, 'ada');
});

test('a caller-supplied field rule marks a custom field name sensitive too', () => {
  const json = JSON.stringify({ internalId: 'abc-123' });
  const bytes = encoder.encode(json);
  const rules = [{ id: 'r1', kind: 'field' as const, value: 'internalId', label: 'Internal id' }];
  const doc = openPreparationDocument(bytes, 'data.json', 'src', 'src', rules, budget());
  const unit = doc.units.find(u => u.field === 'internalId');
  assert.ok(unit, 'internalId should be flagged sensitive via the local rule');
});

test('an unsupported binary extension is retained unchanged with a limitation, not inspected', () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const doc = openPreparationDocument(bytes, 'photo.png', 'src', 'src', [], budget());
  assert.equal(doc.scope.format, 'png');
  assert.equal(doc.units.length, 0);
  assert.ok(doc.scope.limitations.length > 0);
  assert.equal(doc.write(new Map(), new Set()), bytes);
});

test('bytes over the 32 MiB per-file limit are retained with a limitation and never parsed', () => {
  const bytes = new Uint8Array(PREPARE_MAX_BYTES + 1);
  const doc = openPreparationDocument(bytes, 'big.txt', 'src', 'src', [], budget());
  assert.equal(doc.scope.status, 'uninspected');
  assert.equal(doc.units.length, 0);
  assert.ok(doc.scope.limitations.some(l => l.includes('32 MiB')));
});

test('the 300-member global scope budget stops inspection once reached', () => {
  const b = budget();
  b.scopes = PREPARE_MAX_SCOPES;
  const bytes = encoder.encode('hello');
  const doc = openPreparationDocument(bytes, 'notes.txt', 'src', 'src', [], b);
  assert.equal(doc.units.length, 0);
  assert.ok(doc.scope.limitations.some(l => l.includes('300-member')));
});

test('a zip archive expands into a child PreparationDocument per member, flattened by preparationDocuments()', () => {
  const zipBytes = storeZip([{ name: 'a.txt', bytes: encoder.encode('one') }, { name: 'b.txt', bytes: encoder.encode('two') }]);
  const doc = openPreparationDocument(zipBytes, 'bundle.zip', 'src', 'src', [], budget());
  assert.equal(doc.scope.format, 'zip');
  assert.equal(doc.children.length, 2);
  const all = preparationDocuments([doc]);
  assert.equal(all.length, 3); // the zip itself plus its two members
  assert.deepEqual(all.slice(1).map(d => d.scope.path).sort(), ['bundle.zip/a.txt', 'bundle.zip/b.txt']);
});

test('removing a zip member via write() drops it from the rebuilt archive', () => {
  const zipBytes = storeZip([{ name: 'a.txt', bytes: encoder.encode('one') }, { name: 'b.txt', bytes: encoder.encode('two') }]);
  const doc = openPreparationDocument(zipBytes, 'bundle.zip', 'src', 'src', [], budget());
  const removedId = doc.children[0]!.scope.id;
  const rebuilt = doc.write(new Map(), new Set([removedId]));
  assert.notEqual(rebuilt, zipBytes);
  const members = readZipMembers(rebuilt);
  assert.equal(members.length, 1);
  assert.equal(members[0]!.name, 'b.txt');
});
