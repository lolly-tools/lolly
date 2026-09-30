// SPDX-License-Identifier: MPL-2.0
/** Typed consumer adapters for token-linked scalar inputs. */
import type { TokenEntry } from './bridge/host-v1.ts';
import { isAlias, toSwatch } from './tokens.ts';
import { swatchFace } from './color-face.ts';
import { parseDimension, toCssPx } from './units.ts';

export interface TokenConsumer {
  type: string;
  min?: number;
  max?: number;
  maxLength?: number;
  brandFonts?: boolean;
  options?: { value: unknown }[];
  colorTarget?: 'srgb' | 'display-p3' | 'rec2020';
}
export interface TokenBindingResult { status: 'linked' | 'unresolved' | 'incompatible'; value?: string | number; reason?: string }

/** Consumer adapters validate types and units before a link can replace a literal. */
export function resolveTokenBinding(entry: TokenEntry | undefined, consumer: TokenConsumer): TokenBindingResult {
  if (!entry || isAlias(entry.value)) return { status: 'unresolved', reason: 'The token has no resolved value.' };
  const bad = (reason: string): TokenBindingResult => ({ status: 'incompatible', reason });
  let value: string | number;
  if (consumer.type === 'color') {
    const color = entry.type === 'color' ? swatchFace(toSwatch(entry), consumer.colorTarget) : '';
    if (!color) return bad('This field needs a resolved colour token.');
    value = color;
  } else if (consumer.type === 'number') {
    if (entry.type === 'number' && typeof entry.value === 'number') value = entry.value;
    else if (entry.type === 'dimension') {
      const raw = entry.value;
      const dim = parseDimension(typeof raw === 'string' ? raw : raw && typeof raw === 'object' ? `${(raw as { value?: unknown }).value}${(raw as { unit?: unknown }).unit}` : '');
      if (!dim) return bad('This field needs an absolute dimension. Relative units need an explicit reference context.');
      value = toCssPx(dim);
    } else return bad('This numeric field accepts number or absolute dimension tokens.');
    if (!Number.isFinite(value) || (consumer.min !== undefined && value < consumer.min) || (consumer.max !== undefined && value > consumer.max)) return bad('The resolved value is outside this field range.');
  } else if (['text', 'longtext', 'select'].includes(consumer.type)) {
    if (!['string', 'fontFamily'].includes(entry.type ?? '')) return bad('This field accepts string or font-family tokens.');
    const raw = Array.isArray(entry.value) && entry.type === 'fontFamily' ? entry.value[0] : entry.value;
    if (typeof raw !== 'string') return bad('The resolved token must be text.');
    value = raw;
    if (consumer.maxLength !== undefined && value.length > consumer.maxLength) return bad('The resolved text exceeds this field length limit.');
    if (consumer.type === 'select' && !consumer.brandFonts && consumer.options?.length && !consumer.options.some(o => String(o.value) === value)) return bad('This token is not one of the allowed choices.');
  } else return bad('This consumer has no typed token adapter.');
  return { status: 'linked', value };
}
