// SPDX-License-Identifier: MPL-2.0
/** Compare original and once-prepared offset verification boxes from the same engine source. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import type { CLIP_COUNTS } from '../../engine/src/geom/intersect.ts';
import type { geometryStageWorkflows } from '../../tests/helpers/geometry-stage-workflows.ts';

const repo = fileURLToPath(new URL('../../', import.meta.url));
function replaceOnce(source: string, from: string, to: string): string {
  assert.equal(source.split(from).length, 2, `Offset verification seam moved: ${from}`);
  return source.replace(from, to);
}
function variant(source: string, prepared: boolean): string {
  const oldCall = 'nearestOnChain(approx, want)',
    newCall = 'nearestOnChain(approx, want, boxes)';
  const old = source.includes(oldCall),
    current = source.includes(newCall);
  assert.notEqual(old, current, 'Offset verification must have exactly one recognized variant.');
  if (prepared === current) return source;
  const marker = '  const worst = { error: 0, t: 0.5 };';
  const declaration = '  const boxes = approx.map(boundsCubic);\n';
  const oldSignature = 'function nearestOnChain(chain: Cubic[], p: Pt): number {';
  const signature =
    /function nearestOnChain\(\s*chain: Cubic\[\],\s*p: Pt(?:,\s*boxes: ReturnType<typeof boundsCubic>\[\],?)?\s*\): number \{/g;
  assert.equal([...source.matchAll(signature)].length, 1, 'One nearest-chain signature.');
  source = source.replace(
    signature,
    prepared
      ? 'function nearestOnChain(chain: Cubic[], p: Pt, boxes: ReturnType<typeof boundsCubic>[]): number {'
      : oldSignature
  );
  const oldLoop = '  for (const k of chain) {\n    const b = boundsCubic(k);';
  const newLoop =
    '  for (let i = 0; i < chain.length; i++) {\n    const k = chain[i]!;\n    const b = boxes[i]!;';
  for (const [from, to] of [
    [marker, declaration + marker],
    [oldCall, newCall],
    [oldLoop, newLoop],
  ] as const)
    source = replaceOnce(source, prepared ? from : to, prepared ? to : from);
  return source;
}
export async function loadVerificationComparison(prepared: boolean) {
  const result = await build({
    stdin: {
      contents:
        "export {geometryStageWorkflows} from './tests/helpers/geometry-stage-workflows.ts'; export {CLIP_COUNTS} from './engine/src/geom/intersect.ts';",
      resolveDir: repo,
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    plugins: [
      {
        name: 'offset-verification-boxes',
        setup(builder) {
          builder.onLoad({ filter: /engine\/src\/geom\/offset-error\.ts$/ }, async (args) => ({
            contents: variant(await readFile(args.path, 'utf8'), prepared),
            loader: 'ts',
            resolveDir: dirname(args.path),
          }));
        },
      },
    ],
  });
  const code = result.outputFiles[0]!.text;
  const module = (await import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  )) as {
    geometryStageWorkflows: typeof geometryStageWorkflows;
    CLIP_COUNTS: typeof CLIP_COUNTS;
  };
  return { module, code };
}
