// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyVendorInventory, type VendorInventory } from '../scripts/lib/vendor-artifacts.ts';

test('the committed vendor byte inventory verifies', () => verifyVendorInventory(process.cwd()));

test('vendor byte checks refuse changed, added and linked source files', () => {
  const root = mkdtempSync(join(tmpdir(), 'vendor-fixture-'));
  const sha = (s: string): string => createHash('sha256').update(s).digest('hex');
  const inventory: VendorInventory = { schemaVersion: 1, artifacts: [], sourceTrees: [{ name: 'fixture', version: '1', license: 'MIT', path: 'fixture', upstreamCommit: 'fixture', sourceArchiveSha256: sha('fixture'), files: { 'source.txt': sha('fixture') } }] };
  try {
    mkdirSync(join(root, 'fixture')); writeFileSync(join(root, 'fixture/source.txt'), 'fixture');
    verifyVendorInventory(root, inventory);
    writeFileSync(join(root, 'fixture/source.txt'), 'changed');
    assert.throws(() => verifyVendorInventory(root, inventory), /bytes changed/);
    writeFileSync(join(root, 'fixture/source.txt'), 'fixture'); writeFileSync(join(root, 'fixture/extra.txt'), 'fixture');
    assert.throws(() => verifyVendorInventory(root, inventory), /inventory changed/);
    rmSync(join(root, 'fixture/extra.txt')); symlinkSync(join(root, 'fixture/source.txt'), join(root, 'fixture/extra.txt'));
    assert.throws(() => verifyVendorInventory(root, inventory), /contain links/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
