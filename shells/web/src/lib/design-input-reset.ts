// SPDX-License-Identifier: MPL-2.0
import type { Runtime } from '../../../../engine/src/runtime.ts';
import type { InputValue } from '../../../../engine/src/inputs.ts';
import { prepareDesignInputs, restoreDesignInputErrors } from './design-tool-input-errors.ts';
import { designSelection } from '@lolly-tools/core/design-tool-v1';
import { showUndoToast } from './undo-toast.ts';
import { t } from '../i18n.ts';

export async function resetDesignInputs(runtime: Runtime, panel: HTMLElement, ids?: string[]): Promise<void> {
  const policy = runtime.manifest.designTool; if (!policy) return;
  const valid = new Map(runtime.getModel().map(item => [item.id, structuredClone(item.value)]));
  const [guarded, model] = prepareDesignInputs(runtime, runtime.getModel(), panel);
  const selection = designSelection(policy, Object.fromEntries(model.map(item => [item.id, item.value])));
  const fields = model.filter(item => (!ids || ids.includes(item.id)) && !selection.fixed.has(item.id));
  const previous = fields.map(item => [item.id, structuredClone(item.value)] as const);
  for (const item of fields) {
    const value = runtime.manifest.inputs.find(input => input.id === item.id)?.default;
    await guarded.setInput(item.id, structuredClone(value) as InputValue);
  }
  showUndoToast({ message: t(ids ? 'Input reset' : 'Inputs reset'), undo: async () => {
    for (const [id] of previous) await guarded.setInput(id, valid.get(id)!);
    await restoreDesignInputErrors(runtime, panel, Object.fromEntries(previous));
  } });
}
