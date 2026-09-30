// SPDX-License-Identifier: MPL-2.0
import { productionInputFacts, sha256Hex } from '@lolly/engine';
import type { HostV1 } from '@lolly-tools/core/host-v1';

type ProductionWindow = Window & {
  __lollyProductionInputIds?: unknown;
  __lollyProductionEvidence?: (value: unknown) => Promise<void>;
};
/** An opted-in render driver receives hashes of selected runtime inputs only. */
export function observeProductionExport(host: HostV1, toolId: string, model: () => readonly { id: string; value: unknown }[]): void {
  const { __lollyProductionInputIds: ids, __lollyProductionEvidence: sink } = window as ProductionWindow;
  if (!Array.isArray(ids) || ids.length > 128 || ids.some(id => typeof id !== 'string' || !id || id.length > 4096) || typeof sink !== 'function') return;
  const requirements = ids.map((id: string) => ({ id, kind: 'input' as const, location: id, expected: '0'.repeat(64) }));
  const render = host.export.render.bind(host.export);
  host.export.render = async (...args) => {
    const inputs = productionInputFacts(model(), { requirements });
    const blob = await render(...args);
    try {
      await sink({ version: 1, toolId, artifactSha256: await sha256Hex(new Uint8Array(await blob.arrayBuffer())), inputs: await inputs });
    } catch { /* A lost observation leaves the required input check unresolved. */ }
    return blob;
  };
}
