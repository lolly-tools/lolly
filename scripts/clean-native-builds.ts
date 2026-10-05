// SPDX-License-Identifier: MPL-2.0
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanNativeCaches, nativeCachePaths } from './lib/native-build-cache.ts';

const args = process.argv.slice(2);
if (args.some(arg => !['--apply', '--mobile', '--desktop'].includes(arg))) throw new Error('Usage: node scripts/clean-native-builds.ts [--apply] [--mobile|--desktop]');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shells: ('mobile' | 'desktop')[] = args.includes('--mobile') ? ['mobile'] : args.includes('--desktop') ? ['desktop'] : ['mobile', 'desktop'];
const paths = shells.flatMap(shell => nativeCachePaths(root, shell));
const results = cleanNativeCaches(root, paths, args.includes('--apply'));
for (const result of results) console.log(`${result.removed ? 'Cleaned' : 'Would clean'} ${(result.bytes / 2 ** 30).toFixed(2)} GiB: ${result.path}`);
console.log(args.includes('--apply') ? 'Release bundles and Android outputs preserved.' : 'Dry run. Add --apply to remove caches; release bundles and Android outputs are preserved.');
