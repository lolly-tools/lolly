// SPDX-License-Identifier: MPL-2.0
import { serializeUrlState } from '@lolly/engine';
import type { InputModelItem } from '../../../../engine/src/inputs.ts';

export interface SharePrivacyInput {
  id?: string;
  label?: string;
  urlKey?: string;
  bindToProfile?: string;
  sharePrivacy?: 'personal';
}
export interface PersonalShareField {
  id: string;
  label: string;
  value: string;
  parts: string[];
}
export function needsShareReview(input: SharePrivacyInput): boolean {
  return !!input.bindToProfile || input.sharePrivacy === 'personal';
}
export function shareUrlState(model: InputModelItem[], options: Parameters<typeof serializeUrlState>[1] = {}): string {
  return serializeUrlState(model.filter(input => !needsShareReview(input)), options);
}
export function personalShareFields(model: InputModelItem[]): PersonalShareField[] {
  return model.filter(needsShareReview).flatMap(input => {
    const query = serializeUrlState([input]);
    if (!query || input.value === '' || input.value === null || input.value === undefined) return [];
    return [{ id: input.id, label: input.label ?? input.id,
      value: typeof input.value === 'string' ? input.value : JSON.stringify(input.value), parts: query.split('&') }];
  });
}
export function partitionShareParts(parts: readonly string[], inputs: readonly SharePrivacyInput[]): { publicParts: string[]; personal: PersonalShareField[] } {
  const personal = inputs.filter(needsShareReview).filter(input => !!input.id).map(input => ({
    id: input.id!, label: input.label ?? input.id!, value: '', parts: [] as string[], keys: [input.id!, input.urlKey].filter((key): key is string => !!key),
  }));
  const publicParts: string[] = [];
  for (const part of parts) {
    const [key, value] = [...new URLSearchParams(part)][0] ?? ['', ''];
    const plainKey = key.replace(/^_(?:ref|restore)\./, '');
    const field = personal.find(input => input.keys.some(key => plainKey === key || plainKey.startsWith(`${key}.`)));
    if (!field) { publicParts.push(part); continue; }
    field.parts.push(part);
    field.value += (field.value ? '\n' : '') + value;
  }
  return { publicParts, personal: personal.filter(input => input.parts.length) };
}
