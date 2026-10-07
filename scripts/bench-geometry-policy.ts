// SPDX-License-Identifier: MPL-2.0
/** Compare retained and host-norm curve policies with the unchanged synchronous reference. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { arch, cpus, release } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadNodeGeometryHost } from '../packages/node-shell/src/geometry-host-node.ts';
import { benchGeometryWithLoader } from '../tests/helpers/geometry-host-benchmark.ts';
const repo = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(process.argv.find(value => value.startsWith('--output='))?.slice(9) ?? 'plans/295-validation/geometry-policy-node.json');
const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const names = ['clip', 'fit', 'clip-host-norm', 'fit-host-norm'];
const artifacts = Object.fromEntries(await Promise.all(names.map(async name => [name, hash(await readFile(resolve(repo, `packages/node-shell/wasm/geometry-kernel/geometry-${name}.wasm`)))])));
const modules = ['geometry-host', 'geometry-host-node', 'geometry-clipping', 'geometry-clipping-node', 'geometry-fitting', 'geometry-fitting-node', 'geometry-operation-scope'];
const sources = ['scripts/bench-geometry-policy.ts', 'engine/src/geom-api.ts', ...modules.map(name => `packages/node-shell/src/${name}.ts`), ...['geometry-host-benchmark', 'geometry-stage-workflows', 'geometry-workflow-cases'].map(name => `tests/helpers/${name}.ts`), ...(await readdir(resolve(repo, 'engine/src/geom'))).filter(name => name.endsWith('.ts')).map(name => `engine/src/geom/${name}`)];
const sourceHashes: Record<string, string> = {};
for (const name of sources) { const bytes = await readFile(resolve(repo, name)), snapshot = resolve(output + '.sources', name); sourceHashes[name] = hash(bytes); await mkdir(dirname(snapshot), { recursive: true }); await writeFile(snapshot, bytes); }
const result = await benchGeometryWithLoader(loadNodeGeometryHost, process.argv.includes('--reverse'), ['typescript', 'wasm-host-fitting', 'wasm-host-norm-fitting', 'wasm-host-curves', 'wasm-host-norm-curves']);
assert.equal(result.rows.length, 8);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({ machine: { node: process.version, os: release(), arch: arch(), cpu: cpus()[0]?.model }, artifacts, sourceHashes, result }, null, 2) + '\n');
for (const row of result.rows) console.log(`${row.id}: ${row.variants.map(value => `${value.backend} ${value.p50Ms.toFixed(3)}ms`).join(', ')}`);
