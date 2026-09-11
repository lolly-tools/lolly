// SPDX-License-Identifier: MPL-2.0
import { inspectPreparation, applyPreparation } from '@lolly/engine';
import type { PreparationSource, PreparationRule, PreparationInspection, PreparationChoice } from '@lolly-tools/core/host-v1';
export interface PreparationRequest {
  action: 'inspect' | 'apply'; sources: PreparationSource[]; rules?: PreparationRule[];
  inspection?: PreparationInspection; choices?: PreparationChoice[]; remove?: string[];
}
self.onmessage = async (event: MessageEvent<PreparationRequest>) => {
  const request = event.data;
  const options = { progress: (progress: { completed: number; total: number; phase: 'input' | 'output' }) => self.postMessage({ progress }) };
  try {
    const result = request.action === 'inspect' ? await inspectPreparation(request.sources, request.rules, options)
      : await applyPreparation(request.sources, request.inspection!, request.choices ?? [], request.remove, options);
    self.postMessage({ result });
  } catch (error) {
    // Engine preparation errors contain fixed explanations, never parser snippets.
    self.postMessage({ error: error instanceof Error ? error.message : 'Preparation failed. Your originals are unchanged.' });
  }
};
