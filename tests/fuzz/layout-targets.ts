// SPDX-License-Identifier: MPL-2.0
import { readFile } from 'node:fs/promises';
import {
  buildPenpotEntries,
  boxesToPenpotDoc,
  PENPOT_ROOT_ID,
  seededPenpotUuid,
} from '../../engine/src/penpot-file.ts';
import { finalizeBoxes, penpotShapeToNode } from '../../engine/src/design-map.ts';
import { importPenpotLayouts, penpotChildrenPaintOrder } from '../../engine/src/penpot-layout.ts';
import { createDesignLayoutEvaluator } from '../../engine/src/design-layout.ts';
import { loadLayoutKernel } from '../../packages/node-shell/src/layout-kernel-node.ts';

interface LayoutExports {
  memory: WebAssembly.Memory;
  layout_alloc(length: number): number;
  layout_free(pointer: number, length: number): void;
  layout_solve(pointer: number, length: number): number;
  layout_output_len(): number;
}
interface LayoutOutput {
  bounds: number[][];
  columns?: number[][];
  rows?: number[][];
  error?: string;
}
type Row = Record<string, unknown>;
const kernelRoot = new URL('../../packages/node-shell/wasm/layout-kernel/', import.meta.url);
const MAX_LAYOUT_ABI_BYTES = 8 * 1024 * 1024;
const MAX_LAYOUT_MEMORY_BYTES = 32 * 1024 * 1024;
let instance: Promise<LayoutExports> | undefined;
const getInstance = () =>
  (instance ??= (async () => {
    const bytes = new Uint8Array(await readFile(new URL('layout-kernel.wasm', kernelRoot)));
    const module = await WebAssembly.compile(bytes);
    if (WebAssembly.Module.imports(module).length)
      throw new Error('Layout fuzz kernel imports host functions.');
    return new WebAssembly.Instance(module, {}).exports as unknown as LayoutExports;
  })());

/** Raw bytes reach Rust serde_json without a preceding JS JSON parse or sanitization. */
export async function invokeLayoutAbi(bytes: Uint8Array): Promise<LayoutOutput> {
  const api = await getInstance();
  const pointer = api.layout_alloc(bytes.length);
  if (!pointer) throw new Error('Layout allocation refused.');
  try {
    new Uint8Array(api.memory.buffer, pointer, bytes.length).set(bytes);
    const output = api.layout_solve(pointer, bytes.length);
    if (api.memory.buffer.byteLength > MAX_LAYOUT_MEMORY_BYTES)
      throw new WebAssembly.RuntimeError('Layout linear memory exceeds its bound.');
    const length = api.layout_output_len();
    if (!length || length > MAX_LAYOUT_ABI_BYTES)
      throw new WebAssembly.RuntimeError('Malformed layout response length.');
    return readLayoutAbiOutput(new Uint8Array(api.memory.buffer, output, length));
  } finally {
    api.layout_free(pointer, bytes.length);
  }
}

export function readLayoutAbiOutput(bytes: Uint8Array): LayoutOutput {
  let result: LayoutOutput;
  try {
    result = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as LayoutOutput;
  } catch {
    throw new WebAssembly.RuntimeError('Malformed layout response JSON.');
  }
  if (!result || typeof result !== 'object' || Array.isArray(result))
    throw new WebAssembly.RuntimeError('Malformed layout response record.');
  if (typeof result.error === 'string') throw new Error(result.error);
  const finite = (rows: unknown, width: number) =>
    Array.isArray(rows) &&
    rows.every((row) => Array.isArray(row) && row.length === width && row.every(Number.isFinite));
  if (
    result.error !== undefined ||
    !finite(result.bounds, 8) ||
    (result.columns !== undefined && !finite(result.columns, 5)) ||
    (result.rows !== undefined && !finite(result.rows, 5))
  )
    throw new WebAssembly.RuntimeError('Malformed layout geometry.');
  return result;
}

export async function layoutAbiSeeds(): Promise<Uint8Array[]> {
  const corpus = JSON.parse(
    await readFile(new URL('fixtures/modern-layout.json', kernelRoot), 'utf8')
  ) as {
    cases: Array<{ name: string; request: unknown; expected: { error?: string } }>;
  };
  const names = new Set([
    'flex-row',
    'flex-wrap',
    'flex-fill-limits',
    'flex-rotated-fill',
    'grid-fixed',
    'grid-fr-percent-auto',
    'grid-span-auto',
    'grid-rotated-child-fill',
  ]);
  return corpus.cases
    .filter((row) => names.has(row.name) && !row.expected.error)
    .map((row) => new TextEncoder().encode(JSON.stringify(row.request)));
}

export function invokePenpotLayout(bytes: Uint8Array) {
  const source = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as {
    boxes: Row[];
    sourceIds: string[];
    shapes: Record<string, Row>;
  };
  for (const shape of Object.values(source.shapes)) penpotChildrenPaintOrder(shape, source.shapes);
  const result = importPenpotLayouts(source.boxes, source.sourceIds, source.shapes);
  if (result.findings.length) throw new Error(result.findings.map((row) => row.message).join('\n'));
  return result;
}

export async function invokePenpotLayoutEvaluation(bytes: Uint8Array): Promise<void> {
  const result = invokePenpotLayout(bytes);
  const evaluated = await createDesignLayoutEvaluator(await loadLayoutKernel())(
    result.boxes,
    result.tracks
  );
  if (evaluated.findings.length)
    throw new Error(evaluated.findings.map((row) => row.message).join('\n'));
}

/** Native shape JSON comes from the maintained archive writer, then the real shape mapper. */
export async function penpotLayoutSeeds(): Promise<Uint8Array[]> {
  const layer = (id: string, patch: Row = {}): Row => ({
    id,
    name: id,
    kind: 'box',
    x: 0,
    y: 0,
    w: 80,
    h: 40,
    rot: 0,
    bg: '#eeeeee',
    text: '',
    ...patch,
  });
  const seeds: Uint8Array[] = [];
  for (const layout of ['flex', 'grid']) {
    const boxes = [
      layer('root', { kind: 'frame', w: 400, h: 200, layout, layoutGapX: 8, layoutPadLeft: 10 }),
      layer('first', { layoutOwner: 'root', layoutOrder: 0, layoutW: 'fill', layoutColumnSpan: 2 }),
      layer('second', {
        layoutOwner: 'root',
        layoutOrder: 1,
        layoutAbsolute: true,
        layoutX: 20,
        layoutY: 10,
      }),
    ];
    const tracks =
      layout === 'grid'
        ? [
            { id: 'c1', container: 'root', axis: 'column', order: 0, track: '1fr' },
            { id: 'c2', container: 'root', axis: 'column', order: 1, track: '80px' },
            { id: 'r1', container: 'root', axis: 'row', order: 0, track: 'auto' },
          ]
        : [];
    const doc = boxesToPenpotDoc(boxes, {
      name: 'Layout fuzz seed',
      canvas: { w: 400, h: 200 },
      layoutTracks: tracks,
    });
    const archive = buildPenpotEntries(doc, {
      uuid: seededPenpotUuid(305),
      now: () => '2026-10-11T12:00:00.000Z',
    });
    const shapes: Record<string, Row> = {},
      importedBoxes: Row[] = [],
      sourceIds: string[] = [];
    for (const [path, value] of Object.entries(archive.entries)) {
      if (!/\/pages\/[^/]+\/[^/]+\.json$/.test(path)) continue;
      const shape = JSON.parse(
        typeof value === 'string' ? value : new TextDecoder().decode(value)
      ) as Row;
      shapes[String(shape.id)] = shape;
    }
    for (const [sourceId, shape] of Object.entries(shapes)) {
      if (sourceId === PENPOT_ROOT_ID) continue;
      const node = penpotShapeToNode(shape),
        finalized = finalizeBoxes(node ? [node] : []);
      if (finalized.length !== 1) throw new Error('Penpot fuzz seed did not retain its shape.');
      importedBoxes.push({ ...finalized[0], id: `read:${sourceId}` });
      sourceIds.push(sourceId);
    }
    const bytes = new TextEncoder().encode(
      JSON.stringify({ boxes: importedBoxes, sourceIds, shapes })
    );
    invokePenpotLayout(bytes);
    seeds.push(bytes);
  }
  return seeds;
}
