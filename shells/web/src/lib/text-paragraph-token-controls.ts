// SPDX-License-Identifier: MPL-2.0
/** Paragraph links follow the same caret, range and story commands as literal edits. */
import type { HostV1, TextParagraphStyleV1 } from '@lolly-tools/core';
import { PARAGRAPH_TOKEN_FIELDS, TEXT_TYPOGRAPHY_LINK, resolveTextTypography, type TextTypographyLink } from '../../../../engine/src/text-token-bindings.ts';
import { readBlockTokenBindings } from '../../../../engine/src/token-block-bindings.ts';
import type { InputModelItem } from '../../../../engine/src/inputs.ts';
import { aliasPath, isTokenValue } from '../../../../engine/src/tokens.ts';
import { mountTokenBindingField } from '../components/token-binding-field.ts';
import { t } from '../i18n.ts';
import type { BlockTokenBinding } from '../../../../engine/src/token-block-bindings.ts';
import type { TokenValue } from '../../../../engine/src/tokens.ts';
/** Whole typography sets character and line settings together; the shell pins the faces first. */
export interface ParagraphTypographyControl {
  read(): { active?: BlockTokenBinding; mixed: boolean; restoreRef?: string } | undefined;
  write(link?: TextTypographyLink): Promise<void>;
}
export function mountParagraphTokenControls(root: HTMLElement, host: HostV1, read: () => TextParagraphStyleV1, write: (field: string, binding?: TokenValue) => void, info: () => { selection?: string; mixed?: string[]; restoreRefs?: Record<string, string>; active?: Record<string, BlockTokenBinding> } = () => ({}), typography?: ParagraphTypographyControl) {
  const details = document.createElement('details'), summary = document.createElement('summary'), select = document.createElement('select'), fieldRoot = document.createElement('div');
  summary.textContent = t('Paragraph token links'); details.append(summary, select, fieldRoot); root.append(details);
  select.setAttribute('aria-label', t('Paragraph property'));
  for (const field of PARAGRAPH_TOKEN_FIELDS) select.add(new Option(t(field.label ?? field.id), field.id));
  if (typography) select.add(new Option(t('Whole typography'), TEXT_TYPOGRAPHY_LINK));
  let dispose: (() => void) | undefined, stamp = '';
  const current = () => JSON.stringify([select.value, read(), info(), typography?.read()]);
  function mountTypography(control: ParagraphTypographyControl) {
    const state = control.read() ?? { mixed: false };
    const input = { id: TEXT_TYPOGRAPHY_LINK, label: t('Whole typography'), type: 'text', control: 'text-input', isDirty: false, value: state.active ?? '' } as InputModelItem;
    const changed = () => { if (current() !== stamp) throw new Error(t('The paragraph changed. Select the property again before linking.')); };
    dispose = mountTokenBindingField(fieldRoot, input, host, async next => {
      changed();
      if (!isTokenValue(next)) return control.write(undefined);
      const set = await host.tokens?.get();
      changed();
      const result = resolveTextTypography(set?.get(aliasPath(next.ref) ?? next.ref));
      if (result.status !== 'linked') throw new Error(result.reason);
      return control.write({ ref: next.ref, typography: result.value });
    }, { consumer: { type: 'text', adapter: 'typography' }, mixed: state.mixed, restoreRef: state.restoreRef });
    const hint = document.createElement('p'); hint.className = 'fc-insp-hint';
    hint.textContent = t('Sets font, size, weight, tracking and line height together. The font needs an installed face at that exact weight.');
    fieldRoot.append(hint);
  }
  function refresh() {
    const nextStamp = current(); if (stamp === nextStamp) return; stamp = nextStamp; dispose?.();
    if (typography && select.value === TEXT_TYPOGRAPHY_LINK) { mountTypography(typography); return; }
    const value = read(), field = PARAGRAPH_TOKEN_FIELDS.find(field => field.id === select.value)!;
    const adapter = field.id === 'lineHeight' ? 'ratio' : undefined;
    const link = info().active?.[field.id] ?? readBlockTokenBindings(value.tokenLinks)[field.id];
    const input = { ...field, type: 'number', control: 'text-input', isDirty: false, value: link && !link.custom ? link : value[field.id as keyof TextParagraphStyleV1] ?? field.default } as InputModelItem;
    dispose = mountTokenBindingField(fieldRoot, input, host, next => {
      if (current() !== stamp) throw new Error(t('The paragraph changed. Select the property again before linking.'));
      write(field.id, isTokenValue(next) ? next : undefined);
    }, { consumer: { type: 'number', min: field.min, max: field.max, adapter }, mixed: info().mixed?.includes(field.id), restoreRef: info().restoreRefs?.[field.id] });
  }
  select.addEventListener('change', refresh); refresh();
  return { refresh, destroy() { dispose?.(); details.remove(); } };
}
