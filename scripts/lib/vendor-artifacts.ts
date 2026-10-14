// SPDX-License-Identifier: MPL-2.0
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { resolve, relative, isAbsolute, join } from 'node:path';

export interface VendorArtifact { name: string; version: string; license: string; path: string; sha256: string; repository: string; source: string; localChanges: boolean }
export interface VendorSourceTree { name: string; version: string; license: string; path: string; upstreamCommit: string; sourceArchiveSha256: string; files: Record<string, string> }
export interface VendorInventory { schemaVersion: 1; artifacts: VendorArtifact[]; sourceTrees: VendorSourceTree[] }

export function readVendorInventory(root: string): VendorInventory {
  return JSON.parse(readFileSync(join(root, 'security/vendor-artifacts.json'), 'utf8')) as VendorInventory;
}

export function verifyVendorInventory(root: string, inventory = readVendorInventory(root)): void {
  if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.artifacts) || !Array.isArray(inventory.sourceTrees)) throw new Error('Invalid vendor inventory');
  const checkedPath = (path: string): string => {
    const absolute = resolve(root, path), rel = relative(root, absolute);
    if (!rel || isAbsolute(rel) || rel === '..' || rel.startsWith('../') || path.includes('\\')) throw new Error('Invalid vendor path');
    return absolute;
  };
  const verify = (path: string, expected: string): void => {
    if (!/^[0-9a-f]{64}$/.test(expected)) throw new Error('Invalid vendor digest');
    const absolute = checkedPath(path), stat = lstatSync(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Vendor file is not a regular file: ${path}`);
    const digest = createHash('sha256').update(readFileSync(absolute)).digest('hex');
    if (digest !== expected) throw new Error(`Vendor bytes changed: ${path}`);
  };
  for (const artifact of inventory.artifacts) verify(artifact.path, artifact.sha256);
  for (const tree of inventory.sourceTrees) {
    const paths: string[] = [];
    const scan = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.name === 'target' || entry.name === 'Cargo.lock') continue;
        const path = join(directory, entry.name);
        if (entry.isSymbolicLink()) throw new Error('Vendor source trees must not contain links');
        if (entry.isDirectory()) scan(path);
        else if (entry.isFile()) paths.push(relative(checkedPath(tree.path), path).replaceAll('\\', '/'));
        else throw new Error('Vendor source trees must contain regular files');
      }
    };
    scan(checkedPath(tree.path));
    if (JSON.stringify(paths.sort()) !== JSON.stringify(Object.keys(tree.files).sort())) throw new Error(`Vendor source inventory changed: ${tree.path}`);
    for (const [path, digest] of Object.entries(tree.files)) verify(`${tree.path}/${path}`, digest);
  }
}
