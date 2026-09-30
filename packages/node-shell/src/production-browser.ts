// SPDX-License-Identifier: MPL-2.0
import { createHash } from 'node:crypto';
import type { Page } from 'playwright-core';

export interface ProductionBrowserOptions {
  productionInputIds?: string[];
  onProductionInputs?: (inputs: Record<string, string> | undefined) => void;
}
/** Accept only observations from this tool and the exact downloaded artifact. */
export async function observeProductionInputs(page: Page, toolId: string, ids: string[]) {
  const requested = [...new Set(ids)];
  const observations: { artifactSha256: string; inputs: Record<string, string> }[] = [];
  let overflow = false;
  if (requested.length) {
    if (requested.length > 128 || requested.some(id => !id || id.length > 4096)) throw new Error('Production input observation exceeds its budget.');
    await page.exposeFunction('__lollyProductionEvidence', (value: unknown) => {
      if (observations.length >= 16) { overflow = true; return; }
      if (!value || typeof value !== 'object') return;
      const v = value as Record<string, unknown>;
      if (v.version !== 1 || v.toolId !== toolId || typeof v.artifactSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(v.artifactSha256)
        || !v.inputs || typeof v.inputs !== 'object' || Array.isArray(v.inputs)) return;
      const entries = Object.entries(v.inputs);
      if (entries.length > requested.length || entries.some(([id, hash]) => !requested.includes(id) || typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash))) return;
      observations.push({ artifactSha256: v.artifactSha256, inputs: Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b))) });
    });
    await page.addInitScript(inputIds => {
      Object.defineProperty(globalThis, '__lollyProductionInputIds', { value: inputIds, writable: false, configurable: false });
    }, requested);
  }
  return (bytes: Uint8Array): Record<string, string> | undefined => {
    if (overflow) return undefined;
    const digest = createHash('sha256').update(bytes).digest('hex');
    const matches = observations.filter(value => value.artifactSha256 === digest);
    if (!matches.length || matches.some(value => JSON.stringify(value.inputs) !== JSON.stringify(matches[0]!.inputs))) return undefined;
    return matches[0]!.inputs;
  };
}
