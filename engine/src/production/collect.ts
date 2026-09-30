// SPDX-License-Identifier: MPL-2.0
import { sha256Hex } from '../bytes.ts';
import { productionJson } from './contract.ts';
import type { ProductionContract, ProductionSpec, ProductionFacts, ProductionFormat } from './types.ts';
export function productionFormat(bytes: Uint8Array): ProductionFormat | undefined {
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)) return 'png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  if (new TextDecoder().decode(bytes.subarray(0, 5)) === '%PDF-') return 'pdf';
  return undefined;
}
export function productionSvgLength(value: string | null): number | undefined {
  const m = /^\s*(\d+(?:\.\d*)?|\.\d+)(?:e([+-]?\d+))?(px|in|cm|mm|pt|pc|q)?\s*$/i.exec(value ?? '');
  if (!m) return undefined;
  const factors: Record<string, number> = { px: 1, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, pt: 96 / 72, pc: 16, q: 96 / 101.6 };
  const result = Number(m[1]) * 10 ** Number(m[2] ?? 0) * factors[(m[3] ?? 'px').toLowerCase()]!;
  return Number.isFinite(result) && result > 0 ? result : undefined;
}
export interface ProductionSvgSnapshot {
  valid: boolean; width: string | null; height: string | null;
  nodes: { id: string; name: string; text: string; href: string; xml: string }[];
}
export async function collectProductionSvg(bytes: Uint8Array, contract: Pick<ProductionSpec, 'requirements'>, parse: (xml: string, ids: string[]) => Promise<ProductionSvgSnapshot>): Promise<ProductionFacts> {
  if (bytes.length > 2 * 1024 * 1024) return { limitations: ['svg-byte-budget-exceeded'] };
  const xml = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) return { limitations: ['xml-declarations-unsupported'] };
  const snapshot = await parse(xml, contract.requirements.filter(r => r.kind !== 'resource' && r.kind !== 'input').map(r => r.location));
  if (!snapshot.valid) return { readable: false, limitations: ['invalid-svg-root'] };
  const facts: ProductionFacts = { format: 'svg', readable: true, width: productionSvgLength(snapshot.width), height: productionSvgLength(snapshot.height), pages: 1,
    text: Object.create(null), links: Object.create(null), nodes: Object.create(null), limitations: ['svg-text-is-structure-not-visibility', 'svg-fonts-and-linked-resources-unobserved', 'svg-pixels-unavailable'] };
  for (const r of contract.requirements) {
    if (r.kind === 'resource' || r.kind === 'input') continue;
    const nodes = snapshot.nodes.filter(n => n.id === r.location);
    if (nodes.length > 1) { facts.limitations.push(`duplicate-svg-id:${r.location}`); continue; }
    const n = nodes[0];
    if (r.kind === 'text') facts.text![r.location] = n && ['text', 'tspan', 'textPath'].includes(n.name) ? n.text : '';
    else if (r.kind === 'link') facts.links![r.location] = n?.href ?? '';
    else facts.nodes![r.location] = n ? await sha256Hex(new TextEncoder().encode(n.xml)) : '';
  }
  return facts;
}

/** Record only requested, unambiguous values from the runtime that rendered the artifact. */
export async function productionInputFacts(model: readonly { id: string; value: unknown }[], contract: Pick<ProductionContract, 'requirements'>): Promise<Record<string, string>> {
  const inputs: Record<string, string> = Object.create(null);
  const snapshots: [string, Uint8Array][] = [];
  let size = 0;
  for (const id of new Set(contract.requirements.filter(r => r.kind === 'input').map(r => r.location))) {
    const matches = model.filter(input => input.id === id);
    if (matches.length !== 1 || matches[0]!.value === undefined) continue;
    try {
      const bytes = new TextEncoder().encode(productionJson(matches[0]!.value));
      size += bytes.length;
      if (size <= 1024 * 1024) snapshots.push([id, bytes]);
    } catch { /* Non-JSON runtime values have no portable identity. */ }
  }
  await Promise.all(snapshots.map(async ([id, bytes]) => { inputs[id] = await sha256Hex(bytes); }));
  return inputs;
}
