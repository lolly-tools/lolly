// SPDX-License-Identifier: MPL-2.0
/**
 * Save the file-lifecycle corpus as real files, for the checks a test cannot make: a
 * phone's Share and Open With, a desktop file manager, an installed app's launch.
 *
 *   node --import ./tests/css-stub.mjs tests/fixtures/file-lifecycle/write.ts <folder>
 *
 * The folder must not exist yet. Each fixture keeps its own name; the oversized clip is
 * a sparse file. corpus.json, saved beside the files, lists each one with its size and
 * families.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CORPUS } from './corpus.ts';

const target = process.argv[2];
if (!target) {
  console.error('usage: write.ts <folder>');
  process.exit(2);
}
const dir = path.resolve(target);
if (fs.existsSync(dir)) {
  console.error(`${dir} already exists; choose a new folder.`);
  process.exit(2);
}
fs.mkdirSync(dir, { recursive: true });

const ctx = {
  async sparse(name: string, head: Uint8Array, size: number): Promise<Blob> {
    const file = path.join(dir, name);
    fs.writeFileSync(file, head);
    fs.truncateSync(file, size);
    return fs.openAsBlob(file);
  },
};

const written: Array<{ id: string; name: string; type: string; bytes: number; families: string[] }> = [];
for (const fixture of CORPUS) {
  const blob = await fixture.build(ctx);
  const file = path.join(dir, fixture.name);
  // A sparse fixture is already on disk under its own name.
  if (!fs.existsSync(file)) fs.writeFileSync(file, new Uint8Array(await blob.arrayBuffer()));
  written.push({ id: fixture.id, name: fixture.name, type: fixture.type, bytes: blob.size, families: fixture.families });
}
fs.writeFileSync(path.join(dir, 'corpus.json'), `${JSON.stringify(written, null, 2)}\n`);
console.log(`Wrote ${written.length} files to ${dir}`);
