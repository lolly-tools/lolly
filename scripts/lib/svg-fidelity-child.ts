// SPDX-License-Identifier: MPL-2.0
/**
 * The pixel half of svgo-shots.ts's fidelity gate, run as its own process.
 *
 *   node scripts/lib/svg-fidelity-child.ts <original.svg> <optimised.svg>
 *
 * Prints one JSON line: { width, height, maxChannelDelta, overFrac } (width and
 * height are -1 when the two renders differ in size).
 *
 * Why a separate process: resvg is native code, and some malformed input makes it
 * panic (seen 2026-09-26: `geom.rs:27` unwrapping a missing size, on a capture taken
 * before its page had finished loading). A Rust panic across the Node boundary
 * aborts the whole process, which took down a 363-shot run 15 minutes in. Here it
 * only ends this child, and the parent reads the failed exit as "keep the
 * unoptimised bytes".
 */
import { readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const [originalPath, optimisedPath] = process.argv.slice(2);
if (!originalPath || !optimisedPath) {
  console.error('usage: svg-fidelity-child.ts <original.svg> <optimised.svg>');
  process.exit(2);
}
const render = (path: string) => new Resvg(readFileSync(path, 'utf8'), { logLevel: 'off' }).render();
const a = render(originalPath);
const b = render(optimisedPath);
if (a.width !== b.width || a.height !== b.height) {
  console.log(JSON.stringify({ width: -1, height: -1, maxChannelDelta: 255, overFrac: 1 }));
} else {
  const pa = a.pixels, pb = b.pixels;
  let maxChannelDelta = 0, over = 0;
  for (let i = 0; i < pa.length; i++) {
    const d = Math.abs(pa[i]! - pb[i]!);
    if (d > maxChannelDelta) maxChannelDelta = d;
    if (d > 2) over++;
  }
  console.log(JSON.stringify({ width: a.width, height: a.height, maxChannelDelta, overFrac: over / pa.length }));
}
