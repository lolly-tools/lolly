// SPDX-License-Identifier: MPL-2.0
/** Paragraph links follow the same caret, range and story commands as literal edits. */
import type { HostV1, TextParagraphStyleV1 } from '@lolly-tools/core';
import { PARAGRAPH_TOKEN_FIELDS } from '../../../../engine/src/text-token-bindings.ts';
import { readBlockTokenBindings } from '../../../../engine/src/token-block-bindings.ts';
import type { InputModelItem } from '../../../../engine/src/inputs.ts';
import { isTokenValue } from '../../../../engine/src/tokens.ts';
import { mountTokenBindingField } from '../components/token-binding-field.ts';
import { t } from '../i18n.ts';
import type { BlockTokenBinding } from '../../../../engine/src/token-block-bindings.ts';
import type { TokenValue } from '../../../../engine/src/tokens.ts';
export function mountParagraphTokenControls(root: HTMLElement, host: HostV1, read: () => TextParagraphStyleV1, write: (field: string, binding?: TokenValue) => void, info: () => { selection?: string; mixed?: string[]; restoreRefs?: Record<string, string>; active?: Record<string, BlockTokenBinding> } = () => ({})) {
  const details = document.createElement('details'), summary = document.createElement('summary'), select = document.createElement('select'), fieldRoot = document.createElement('div');
  summary.textContent = t('Paragraph token links'); details.append(summary, select, fieldRoot); root.append(details);
  select.setAttribute('aria-label', t('Paragraph property'));
  for (const field of PARAGRAPH_TOKEN_FIELDS) select.add(new Option(t(field.label ?? field.id), field.id));
  let dispose: (() => void) | undefined, stamp = '';
  function refresh() {
    const value = read(), nextStamp = JSON.stringify([select.value, value, info()]); if (stamp === nextStamp) return; stamp = nextStamp; dispose?.();
    const field = PARAGRAPH_TOKEN_FIELDS.find(field => field.id === select.value)!;
    const adapter = field.id === 'lineHeight' ? 'ratio' : undefined;
    const link = info().active?.[field.id] ?? readBlockTokenBindings(value.tokenLinks)[field.id];
    const input = { ...field, type: 'number', control: 'text-input', isDirty: false, value: link && !link.custom ? link : value[field.id as keyof TextParagraphStyleV1] ?? field.default } as InputModelItem;
    dispose = mountTokenBindingField(fieldRoot, input, host, next => {
      if (JSON.stringify([select.value, read(), info()]) !== stamp) throw new Error(t('The paragraph changed. Select the property again before linking.'));
      write(field.id, isTokenValue(next) ? next : undefined);
    }, { consumer: { type: 'number', min: field.min, max: field.max, adapter }, mixed: info().mixed?.includes(field.id), restoreRef: info().restoreRefs?.[field.id] });
  }
  select.addEventListener('change', refresh); refresh();
  return { refresh, destroy() { dispose?.(); details.remove(); } };
}
