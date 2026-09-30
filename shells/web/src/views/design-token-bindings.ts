// SPDX-License-Identifier: MPL-2.0
/** Token actions beside the existing Design property groups and undo transaction. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { BlockFieldSpec, InputModelItem, InputValue } from '../../../../engine/src/inputs.ts';
import { readBlockTokenBindings, withBlockTokenBinding } from '../../../../engine/src/token-block-bindings.ts';
import { isTokenValue } from '../../../../engine/src/tokens.ts';
import { mountTokenBindingField } from '../components/token-binding-field.ts';
import { escape as esc } from '../utils.ts';
import { t } from '../i18n.ts';
import type { ModelPort } from './design-ports.ts';
import type { Box } from './free-canvas-math.ts';
import type { Runtime } from '../../../../engine/src/runtime.ts';
import { withTokenSelection } from '../../../../engine/src/token-context.ts';

/** Keep token actions on the canvas commit path, with explicit gesture boundaries. */
export function designTokenInspectorOptions(runtime: Pick<Runtime, 'getModel' | 'tokenSelection'>, host: HostV1, model: ModelPort, history: { endGesture(): void }, fields: unknown[]): { fields: unknown[]; tokens?: Pick<DesignTokenBindingOptions, 'host' | 'metadataField' | 'commit'> } {
  const metadataField = runtime.getModel().find(input => input.id === model.blockId)?.tokenBindingsField;
  if (!metadataField) return { fields };
  return { fields, tokens: { host: runtime.tokenSelection ? withTokenSelection(host, runtime.tokenSelection) : host, metadataField, commit: rows => {
    history.endGesture();
    try { model.commit(rows); } finally { history.endGesture(); }
  } } };
}

export interface DesignTokenBindingOptions {
  host: HostV1;
  metadataField: string;
  fields: readonly BlockFieldSpec[];
  fieldIds: readonly (string | undefined)[];
  model: ModelPort;
  ids: readonly string[];
  state?: { open?: boolean; field?: string };
  commit?: (rows: Box[], label: string) => void | Promise<void>;
}

export function mountDesignTokenBindings(root: HTMLElement, options: DesignTokenBindingOptions): () => void {
  const { model, metadataField, host } = options;
  const ids = new Set(options.ids);
  const idOf = (row: Record<string, unknown>, index: number): string => String(row[model.cfg.idField] ?? index);
  const rows = () => model.getBoxes().filter((row, index) => ids.has(idOf(row, index)));
  const fields = options.fields.filter(field => options.fieldIds.includes(field.id) && (['number', 'color'].includes(field.type ?? '') || field.brandFonts));
  if (!fields.length || !host.tokens || !ids.size) return () => {};
  const linked = rows().some(row => fields.some(field => readBlockTokenBindings(row[metadataField])[field.id]));
  root.innerHTML = `<details class="design-token-links"><summary>${t('Token links')}${linked ? ` · ${t('In use')}` : ''}</summary><p class="fc-insp-hint">${ids.size === 1 ? t('Changes apply to this layer.') : t('Changes apply to all {n} selected layers in one undo step.', { n: ids.size })}</p><label>${t('Property')}<select class="field-select" data-design-token-property>${fields.map(field => `<option value="${esc(field.id)}">${esc(field.label ?? field.id)}</option>`).join('')}</select></label><div data-design-token-field></div></details>`;
  let disposeField: (() => void) | undefined;
  const picker = root.querySelector<HTMLSelectElement>('[data-design-token-property]')!;
  const fieldRoot = root.querySelector<HTMLElement>('[data-design-token-field]')!;
  const disclosure = root.querySelector<HTMLDetailsElement>('details')!;
  if (options.state?.field && fields.some(field => field.id === options.state!.field)) picker.value = options.state.field;
  disclosure.open = options.state?.open ?? false;
  const remember = (): void => { if (options.state) { options.state.open = disclosure.open; options.state.field = picker.value; } };
  disclosure.addEventListener('toggle', remember);
  function render(): void {
    remember();
    disposeField?.();
    const field = fields.find(candidate => candidate.id === picker.value)!;
    const before = rows();
    const links = before.map(row => readBlockTokenBindings(row[metadataField])[field.id]);
    const active = links.find(link => link && !link.custom);
    const stamp = JSON.stringify(before.map((row, index) => [String(row[model.cfg.idField] ?? index), row[field.id], row[metadataField]]));
    const mixed = new Set(before.map((row, index) => JSON.stringify([row[field.id], links[index]]))).size > 1;
    const restores = links.filter(link => link?.custom).map(link => link!.ref);
    const value = active ? { ...active } : before[0]?.[field.id] ?? field.default ?? '';
    const input = { ...field, id: `layer-${field.id}`, type: field.type ?? 'text', value, isDirty: false, control: 'text-input' } as InputModelItem;
    disposeField = mountTokenBindingField(fieldRoot, input, host, next => {
      const current = rows();
      if (stamp !== JSON.stringify(current.map((row, index) => [String(row[model.cfg.idField] ?? index), row[field.id], row[metadataField]]))) throw new Error(t('These layer values changed. Select the property again before linking.'));
      const nextRows = model.getBoxes().map((row, index) => ids.has(idOf(row, index))
        ? withBlockTokenBinding(row, metadataField, field.id, isTokenValue(next) ? next : row[field.id] as InputValue)
        : row);
      return options.commit ? options.commit(nextRows, isTokenValue(next) ? t('Link token') : t('Make custom')) : model.commit(nextRows);
    }, { mixed, restoreRef: restores.length === before.length && new Set(restores).size === 1 ? restores[0] : undefined, colorTarget: model.getInput('editingRange') === 'hdr' ? 'rec2020' : 'srgb' });
  }
  picker.addEventListener('change', render); render();
  return () => { remember(); disposeField?.(); disclosure.removeEventListener('toggle', remember); picker.removeEventListener('change', render); root.replaceChildren(); };
}
