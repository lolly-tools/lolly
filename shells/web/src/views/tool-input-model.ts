// SPDX-License-Identifier: MPL-2.0
/** Build one input-panel context from the runtime, declared policy and render choices. */
import type { InputModelItem, InputValue } from '../../../../engine/src/inputs.ts';
import type { Runtime } from '../../../../engine/src/runtime.ts';
import { withTokenSelection } from '../../../../engine/src/token-context.ts';
import { prepareDesignInputs, isDesignInputVisible } from '../lib/design-tool-input-errors.ts';
import { getInputPolicy } from '../lib/input-policy.ts';
import type { WebToolHost, PanelEl } from './tool.ts';

export function prepareInputPanel(el: PanelEl, runtime: Runtime, model: InputModelItem[], host: WebToolHost, toolId?: string) {
  if (runtime.tokenSelection) host = withTokenSelection(host, runtime.tokenSelection) as WebToolHost;
  [runtime, model] = prepareDesignInputs(runtime, model, el);
  const policyFor = (id: string) => getInputPolicy(toolId, id);
  const modelValues: Record<string, InputValue> = Object.fromEntries(model.map(input => [input.id, input.value]));
  const panelModel = model.filter(input => isDesignInputVisible(runtime, input, modelValues, policyFor(input.id)?.mode === 'hidden'));
  el._emojiInputsDispose?.();
  return { runtime, model, host, policyFor, modelValues, panelModel };
}
