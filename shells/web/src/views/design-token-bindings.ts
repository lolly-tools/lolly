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
import { liveThemedHost } from '../lib/document-theme.ts';
import { designTokenProperties } from './design-token-properties.ts';
import { resolveTokenBinding } from '../../../../engine/src/token-binding.ts';
import { isTokenAdapter } from '../../../../engine/src/token-consumer-adapters.ts';
import { aliasPath } from '../../../../engine/src/tokens.ts';

/** Keep token actions on the canvas commit path, with explicit gesture boundaries. */
export function designTokenInspectorOptions(runtime: Pick<Runtime, 'getModel' | 'tokenSelection'>, host: HostV1, model: ModelPort, history: { endGesture(): void }, fields: unknown[]): { fields: unknown[]; tokens?: Pick<DesignTokenBindingOptions, 'host' | 'metadataField' | 'commit'> } {
  const metadataField = runtime.getModel().find(input => input.id === model.blockId)?.tokenBindingsField;
  if (!metadataField) return { fields };
  // Live, not captured: the inspector outlives a theme switch, and a link made after
  // one must store the value of the theme the document shows then (plan 291 W4).
  return { fields, tokens: { host: liveThemedHost(host, runtime), metadataField, commit: rows => {
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
  onSettled?: () => void;
  commit?: (rows: Box[], label: string) => void | Promise<void>;
}

export function mountDesignTokenBindings(root: HTMLElement, options: DesignTokenBindingOptions): (() => void) & { busy(): boolean } {
  const { model, metadataField, host } = options;
  const ids = new Set(options.ids);
  const idOf = (row: Record<string, unknown>, index: number): string => String(row[model.cfg.idField] ?? index);
  const rows = () => model.getBoxes().filter((row, index) => ids.has(idOf(row, index)));
  const cfg = model.cfg as typeof model.cfg & Record<string, string | undefined>;
  const properties = designTokenProperties(options.fields, options.fieldIds, cfg).filter(property => {
    if (property.adapter === 'transition') return ids.size === 1 && rows().length === 1 && String(rows()[0]![cfg.kindField ?? 'kind']) !== (model.frame?.frameKind ?? 'frame');
    if (!property.adapter?.startsWith('border')) return true;
    const paintTargets = property.targets.filter(target => !['border.dashArray', 'border.dashLength', 'border.gapLength'].includes(target.adapter ?? ''));
    return paintTargets.every(target => !target.field.showFor?.length || rows().every(row => target.field.showFor!.includes(String(row[cfg.kindField ?? 'kind']))));
  });
  const fields = properties.map(property => property.field);
  if (!fields.length || !host.tokens || !ids.size) return Object.assign(() => {}, { busy: () => false });
  const linked = rows().some(row => properties.some(property => property.targets.some(target => readBlockTokenBindings(row[metadataField])[target.field.id])));
  root.innerHTML = `<details class="design-token-links"><summary>${t('Token links')}${linked ? ` · ${t('In use')}` : ''}</summary><p class="fc-insp-hint">${ids.size === 1 ? t('Changes apply to this layer.') : t('Changes apply to all {n} selected layers in one undo step.', { n: ids.size })}</p><label>${t('Property')}<select class="field-select" data-design-token-property>${fields.map(field => `<option value="${esc(field.id)}">${esc(t(field.label ?? field.id))}</option>`).join('')}</select></label><div data-design-token-field></div></details>`;
  let disposed = false, generation = 0, pending = 0;
  let disposeField: (() => void) | undefined;
  const picker = root.querySelector<HTMLSelectElement>('[data-design-token-property]')!;
  const fieldRoot = root.querySelector<HTMLElement>('[data-design-token-field]')!;
  const disclosure = root.querySelector<HTMLDetailsElement>('details')!;
  if (options.state?.field && fields.some(field => field.id === options.state!.field)) picker.value = options.state.field;
  disclosure.open = options.state?.open ?? false;
  const remember = (): void => { if (options.state) { options.state.open = disclosure.open; options.state.field = picker.value; } };
  disclosure.addEventListener('toggle', remember);
  function render(): void {
    const currentGeneration = ++generation;
    const colorTarget = model.getInput('editingRange') === 'hdr' ? 'rec2020' : 'srgb';
    remember();
    disposeField?.();
    const field = fields.find(candidate => candidate.id === picker.value)!;
    const before = rows();
    const property = properties.find(candidate => candidate.field.id === field.id)!;
    const borderStyle = property.adapter === 'border' || property.adapter === 'border.style';
    const groupRestore = borderStyle || property.adapter === 'transition';
    const links = before.map(row => {
      const all = readBlockTokenBindings(row[metadataField]);
      const group = property.targets.map(target => all[target.field.id]);
      return group.every(link => link && link.ref === group[0]?.ref && (groupRestore || link.custom === group[0]?.custom)) ? { ...group[0]!, ...(groupRestore && group.some(link => link?.custom) ? { custom: true } : {}) } : undefined;
    });
    const active = groupRestore && links.some(link => link?.custom) ? undefined : links.find(link => link && !link.custom);
    const snapshot = (selected: Box[]): string => JSON.stringify(selected.map((row, index) => [String(row[model.cfg.idField] ?? index), ...property.targets.map(target => row[target.field.id]), row[metadataField], ...(property.adapter === 'transition' ? [row[cfg.kindField ?? 'kind']] : [])]));
    const stamp = snapshot(before);
    const mixed = new Set(before.map((row, index) => JSON.stringify([property.targets.map(target => row[target.field.id]), links[index]]))).size > 1;
    const restores = links.filter(link => link?.custom).map(link => link!.ref);
    const restoreRef = groupRestore && restores.length && links.every(link => link?.ref === restores[0]) ? restores[0] : restores.length === before.length && new Set(restores).size === 1 ? restores[0] : undefined;
    const value = active ? { ...active } : before[0]?.[field.id] ?? field.default ?? '';
    const input = { ...field, id: `layer-${field.id}`, type: field.type ?? 'text', value, isDirty: false, control: 'text-input' } as InputModelItem;
    disposeField = mountTokenBindingField(fieldRoot, input, host, async next => {
      const current = rows();
      if (stamp !== snapshot(current)) throw new Error(t('These layer values changed. Select the property again before linking.'));
      const set = isTokenValue(next) ? await host.tokens?.get() : undefined;
      if (disposed || generation !== currentGeneration) return;
      const values = property.targets.map(target => {
        if (!isTokenValue(next)) return { ...target, value: undefined };
        const candidate = (next as { adapter?: unknown }).adapter;
        const adapter = property.targets.length === 1 && isTokenAdapter(candidate) ? candidate : target.adapter ?? (isTokenAdapter(candidate) ? candidate : undefined);
        const resolved = resolveTokenBinding(set?.get(aliasPath(next.ref)!), { ...target.field, type: target.field.type ?? 'text', adapter, colorTarget });
        if (resolved.status !== 'linked') throw new Error(resolved.reason);
        return { ...target, adapter, value: { ref: next.ref, value: resolved.value } };
      });
      if (stamp !== snapshot(rows())) throw new Error(t('These layer values changed. Select the property again before linking.'));
      const nextRows = model.getBoxes().map((row, index) => {
        if (!ids.has(idOf(row, index))) return row;
        let result = row;
        for (const target of values) result = withBlockTokenBinding(result, metadataField, target.field.id, target.value ?? row[target.field.id] as InputValue, target.adapter);
        if (property.adapter === 'shadow' && isTokenValue(next) && cfg.shadowField) result = { ...result, [cfg.shadowField]: String(row[cfg.kindField!]) === 'text' ? 'text' : 'box' };
        return result;
      });
      return options.commit ? options.commit(nextRows, isTokenValue(next) ? t('Link token') : t('Make custom')) : model.commit(nextRows);
    }, { onPendingChange: busy => { pending += busy ? 1 : -1; if (!busy) options.onSettled?.(); }, consumer: { ...field, type: field.type ?? 'text', adapter: property.adapter }, fallbackAdapter: property.targets.length === 1 ? links[0]?.adapter : undefined, mixed, restoreRef, colorTarget, ...(property.adapter === 'transition' ? { candidateType: 'transition' } : {}) });
    if (property.adapter === 'transition') {
      const hint = document.createElement('p'); hint.className = 'fc-insp-hint';
      hint.textContent = t('Applies Enter duration and geometry easing. Opacity keeps the preset easing.');
      fieldRoot.append(hint);
    }
  }
  picker.addEventListener('change', render); render();
  return Object.assign(() => { disposed = true; remember(); disposeField?.(); disclosure.removeEventListener('toggle', remember); picker.removeEventListener('change', render); root.replaceChildren(); }, { busy: () => pending > 0 });
}
