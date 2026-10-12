// SPDX-License-Identifier: MPL-2.0
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { lollyFeatureReader } from '../../packages/core/src/lolly-features.ts';
import { readLollyFile as readNode } from '../../packages/node-shell/src/lolly-file.ts';
import { packageDesign } from '../../packages/node-shell/src/design-lolly.ts';
import { buildLollyFile, readLollyFile, extractBundledTool, LOLLY_PROJECT_TOOL_ID } from '../../shells/web/src/lib/lolly-pack.ts';

export class LollyHierarchyRefusal extends Error {}
export function lollyInvariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new WebAssembly.RuntimeError(`Lolly hierarchy invariant: ${message}`);
}
export async function invokeLollyHierarchy(bytes: Uint8Array): Promise<void> {
  let parsed: Awaited<ReturnType<typeof readLollyFile>>;
  try { parsed = await readLollyFile(bytes); }
  catch (error) {
    if (error instanceof Error && !(error instanceof RangeError) && !(error instanceof TypeError)) throw new LollyHierarchyRefusal(error.message);
    throw error;
  }
  const tool = extractBundledTool(parsed);
  const required = lollyFeatureReader({ toolId: parsed.manifest.tool.id, session: parsed.session,
    project: parsed.project, templates: parsed.templates,
    toolManifest: tool ? JSON.parse(strFromU8(tool.files['tool.json']!)) : undefined });
  lollyInvariant(required === 1 || parsed.manifest.minReader >= required, 'reader accepted an underdeclared feature');
  if (parsed.manifest.kind !== 'project') {
    let node: ReturnType<typeof readNode>;
    try { node = readNode(bytes, { allowTool: true }); }
    catch (error) {
      if (error instanceof Error && !(error instanceof RangeError) && !(error instanceof TypeError)) throw new LollyHierarchyRefusal(error.message);
      throw error;
    }
    lollyInvariant(parsed.manifest.kind === 'tool' || JSON.stringify(node.session) === JSON.stringify(parsed.session), 'Node session changed');
  }
  const built = await buildLollyFile({ kind: parsed.manifest.kind, toolId: parsed.manifest.tool.id,
    session: parsed.session, project: parsed.project, templates: parsed.templates,
    tool: tool || undefined, userAssets: [] });
  const restored = await readLollyFile(new Uint8Array(await built.blob.arrayBuffer()));
  lollyInvariant(JSON.stringify(restored.session) === JSON.stringify(parsed.session), 'session round trip changed');
  lollyInvariant(JSON.stringify(restored.templates) === JSON.stringify(parsed.templates), 'templates round trip changed');
  lollyInvariant(JSON.stringify(restored.project?.sessions.map(row => row.data)) === JSON.stringify(parsed.project?.sessions.map(row => row.data)), 'project sessions changed');
  if (required <= 1) return;
  for (const gate of [required - 1, undefined]) {
    const files = unzipSync(bytes), manifest = JSON.parse(strFromU8(files['manifest.json']!));
    if (gate === undefined) delete manifest.minReader; else manifest.minReader = gate;
    files['manifest.json'] = strToU8(JSON.stringify(manifest));
    const forged = zipSync(files);
    let refused = false;
    try { await readLollyFile(forged); } catch (error) { refused = error instanceof Error && /reader gate|invalid payload/.test(error.message); }
    lollyInvariant(refused, 'web reader admitted a forged feature gate');
    if (parsed.manifest.kind === 'project') continue;
    refused = false;
    try { readNode(forged, { allowTool: true }); } catch (error) { refused = error instanceof Error && /reader gate|invalid payload/.test(error.message); }
    lollyInvariant(refused, 'Node reader admitted a forged feature gate');
  }
}

/** Small real writer files exercise session, project, template and tool payloads. */
export async function lollyHierarchySeeds(): Promise<Uint8Array[]> {
  const session = { __toolId: 'design', pages: [{ id: 'p', name: 'Page' }], boxes: [
    { id: 'g', kind: 'group', pageId: 'p', x: 10, y: 20, w: 30, h: 40 },
    { id: 'a', kind: 'text', group: 'g', x: 10, y: 20, w: 30, h: 40, text: 'Hello' },
  ] };
  const requests: Parameters<typeof buildLollyFile>[0][] = [
    { toolId: 'design', session, userAssets: [] },
    { toolId: 'design', session: { ...session, boxes: [session.boxes[0],
      { ...session.boxes[0], id: 'alpha', opacity: 50, blend: 'multiply' },
      { ...session.boxes[1], group: 'alpha' },
    ] }, userAssets: [] },
    { toolId: 'design', session: { ...session, boxes: [
      { ...session.boxes[0], layoutW: 'fill', layoutH: 'hug' }, session.boxes[1],
    ] }, userAssets: [] },
    { kind: 'project', toolId: LOLLY_PROJECT_TOOL_ID, session: null, userAssets: [], project: {
      name: 'Project', folders: [{ id: 'root', name: 'Project', parentId: null, items: [{ type: 'session', ref: 'one' }] }],
      sessions: [{ key: 'one', toolId: 'design', data: session }],
    } },
    { toolId: 'chart', session: { title: 'Flat' }, userAssets: [], templates: [
      { id: 'starter', toolId: 'design', name: 'Nested', values: session, createdAt: '', updatedAt: '' },
    ] },
    { kind: 'tool', toolId: 'design', session: null, userAssets: [], tool: { id: 'design', trust: 'custom', files: {
      'tool.json': strToU8(JSON.stringify({ id: 'design', inputs: [{ id: 'pages', type: 'blocks', default: [] }] })),
      'template.html': strToU8('<div>Design</div>'),
    } } },
    { toolId: 'design', session: { boxes: [{ id: 'a', kind: 'box', group: 'legacy', pageId: '' }], pages: [] }, userAssets: [] },
  ];
  const seeds: Uint8Array[] = [];
  for (const input of requests) seeds.push(new Uint8Array(await (await buildLollyFile(input)).blob.arrayBuffer()));
  seeds.push((await packageDesign(session, { catalog: null, toolVersion: '1.49.0', exportedAt: '2026-10-11T12:00:00.000Z' })).bytes);
  return seeds;
}
