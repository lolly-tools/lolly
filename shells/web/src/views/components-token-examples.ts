// SPDX-License-Identifier: MPL-2.0
import type { HostV1, TokensSnapshot } from '@lolly-tools/core/host-v1';
import type { InputModelItem, InputValue } from '../../../../engine/src/inputs.ts';
import { flattenValue } from '../../../../engine/src/inputs.ts';
import { createTokenSet } from '../../../../engine/src/tokens.ts';
import { mountTokenBindingField } from '../components/token-binding-field.ts';
import { mountTokenContextStrip } from '../components/token-context-strip.ts';
import { openTokenInspector } from '../components/token-workspace.ts';
import { escape as esc } from '../utils.ts';
import { t } from '../i18n.ts';

const doc = { rhythm: { gap: { $type: 'dimension', $value: { value: 24, unit: 'px' } } }, opacity: { $type: 'number', $value: 0.75 }, title: { $type: 'string', $value: 'Beacon' } };
const snapshot: TokensSnapshot = { document: doc, system: { id: 'example', label: 'Beacon example', active: true, locked: false, source: 'local', headId: null }, version: 'v1', selection: { choices: { appearance: 'day', density: 'compact' } } };
const tokens = createTokenSet(doc);
const host: Pick<HostV1, 'tokens'> = { tokens: { get: async () => tokens, snapshot: async () => snapshot,
  colors: async () => tokens.colors(), resolve: async ref => tokens.resolve(ref), themes: async () => [] } };

/** Live specimens call the production controls and keep edits inside the specimen. */
export function wireTokenBindingExamples(root: HTMLElement): () => void {
  const scenarios: { label: string; value: InputValue; mixed?: boolean; readOnly?: boolean; restoreRef?: string }[] = [
    { label: t('Linked'), value: { ref: '{rhythm.gap}', value: 24 } },
    { label: t('Custom value'), value: 16, restoreRef: '{rhythm.gap}' },
    { label: t('Unresolved'), value: { ref: '{missing.gap}', value: 12, status: 'unresolved', reason: 'The token has no active definition.' } as InputValue },
    { label: t('Mixed values'), value: 16, mixed: true },
    { label: t('Read-only'), value: { ref: '{rhythm.gap}', value: 24 }, readOnly: true },
  ];
  const disposers: (() => void)[] = [];
  for (const [index, scenario] of scenarios.entries()) {
    const row = document.createElement('section'); row.className = 'card card--sub';
    row.innerHTML = `<label class="field-row"><span class="field-label">${esc(scenario.label)}</span><input class="field-input" type="number" value="${esc(String(flattenValue(scenario.value)))}" ${scenario.readOnly ? 'readonly' : ''}></label><div data-link></div>`;
    root.append(row);
    const field = row.querySelector<HTMLInputElement>('input')!;
    let value = scenario.value, dispose: (() => void) | undefined;
    const refresh = (): void => {
      dispose?.(); field.value = String(flattenValue(value));
      dispose = mountTokenBindingField(row.querySelector<HTMLElement>('[data-link]')!, { id: `example-${index}`, type: 'number', value, min: 0, max: 100 } as InputModelItem, host, next => { value = next; refresh(); }, scenario);
    };
    field.addEventListener('change', () => { value = Number(field.value); refresh(); }); refresh();
    disposers.push(() => { dispose?.(); row.remove(); });
  }
  return () => { disposers.forEach(dispose => { dispose(); }); };
}

export function wireTokenContextExample(root: HTMLElement): () => void {
  return mountTokenContextStrip(root, snapshot, () => openTokenInspector(host, undefined, () => root.isConnected));
}
