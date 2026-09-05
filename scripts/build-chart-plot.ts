// SPDX-License-Identifier: MPL-2.0
/**
 * Vendor Observable Plot's official browser build for Chart's statistical lane.
 *
 * Plot deliberately keeps D3 external in its UMD distribution. Chart already
 * carries the same pinned D3 7.9 runtime, so the lazy statistical path adds only
 * Plot's grammar, marks, transforms and faceting layer rather than bundling D3 a
 * second time.
 *
 *   npm run build:chart-plot
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(
  readFileSync(resolve(root, 'node_modules/@observablehq/plot/package.json'), 'utf8')
) as { version: string; license: string };
const source = readFileSync(
  resolve(root, 'node_modules/@observablehq/plot/dist/plot.umd.min.js'),
  'utf8'
);
const target = resolve(root, 'community/chart/lib/observable-plot.min.js');

if (pkg.license !== 'ISC') throw new Error(`unexpected Observable Plot license: ${pkg.license}`);
if (!source.includes(`@observablehq/plot v${pkg.version}`))
  throw new Error('Observable Plot bundle version banner is missing');
if (!source.includes('d3@7.9.0'))
  throw new Error('Observable Plot no longer declares the pinned external D3 runtime');
if (!source.includes('.Plot')) throw new Error('Observable Plot UMD global is missing');

writeFileSync(target, source);
console.log(`wrote ${target}`);
console.log(
  `Observable Plot ${pkg.version}: ${(Buffer.byteLength(source) / 1024).toFixed(0)} KB min, ${(gzipSync(source).length / 1024).toFixed(0)} KB gz (D3 external)`
);
