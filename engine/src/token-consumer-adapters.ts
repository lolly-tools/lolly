// SPDX-License-Identifier: MPL-2.0
/** Closed, explicit projections from composite tokens into existing scalar consumers. */
import type { TokenEntry } from './bridge/host-v1.ts';
import { toSwatch } from './tokens.ts';
import { swatchFace } from './color-face.ts';
import { formatGradientSpec, MAX_GRADIENT_STOPS } from './gradient-spec.ts';
export const TOKEN_ADAPTERS = ['typography', 'typography.fontFamily', 'typography.fontSize', 'typography.fontWeight', 'typography.letterSpacing', 'typography.lineHeight', 'shadow', 'shadow.color', 'shadow.offsetX', 'shadow.offsetY', 'shadow.blur', 'border', 'border.color', 'border.width', 'border.style', 'border.dashArray', 'border.dashLength', 'border.gapLength', 'transition', 'transition.duration-ms', 'transition.timingFunction', 'duration-ms', 'duration-s', 'cubic-bezier', 'gradient', 'ratio'] as const;
export type TokenAdapter = typeof TOKEN_ADAPTERS[number];
export const isTokenAdapter = (value: unknown): value is TokenAdapter => typeof value === 'string' && (TOKEN_ADAPTERS as readonly string[]).includes(value);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const fields: Record<string, Record<string, string>> = {
  typography: { fontFamily: 'fontFamily', fontSize: 'dimension', fontWeight: 'number', letterSpacing: 'dimension', lineHeight: 'number' },
  shadow: { color: 'color', offsetX: 'dimension', offsetY: 'dimension', blur: 'dimension' },
  border: { color: 'color', width: 'dimension', style: 'string' },
};
/** No implicit unit context, layered shadow truncation or gradient stop truncation. */
export function adaptTokenEntry(entry: TokenEntry, adapter: TokenAdapter): TokenEntry | string {
  const make = (type: string, value: unknown): TokenEntry => ({ ...entry, type, value });
  if (adapter === 'transition' || adapter === 'transition.duration-ms' || adapter === 'transition.timingFunction') {
    if (entry.type !== 'transition' || !record(entry.value)) return 'This consumer needs a single resolved composite token.';
    const value = entry.value;
    if (['duration', 'delay', 'timingFunction'].some(field => value[field] === undefined)) return 'The composite is missing a required property.';
    // Each projection checks the whole source, so a later delay or bad curve cannot
    // silently turn one linked property into a different transition consumer.
    const duration = adaptTokenEntry(make('duration', value.duration), 'duration-ms');
    if (typeof duration === 'string') return duration;
    const delay = adaptTokenEntry(make('duration', value.delay), 'duration-ms');
    if (typeof delay === 'string') return delay;
    if (typeof duration.value !== 'number' || !Number.isFinite(duration.value) || typeof delay.value !== 'number' || !Number.isFinite(delay.value)) return 'The resolved value is outside this field range.';
    if (delay.value !== 0) return 'This layer timing control cannot apply a delay. Choose a transition with zero delay.';
    const curve = adaptTokenEntry(make('cubicBezier', value.timingFunction), 'cubic-bezier');
    if (typeof curve === 'string') return curve;
    if (adapter === 'transition.duration-ms') return duration;
    if (adapter === 'transition.timingFunction') return curve;
    return make('string', JSON.stringify(value));
  }
  if (adapter.startsWith('typography') || adapter.startsWith('shadow') || adapter.startsWith('border')) {
    const [kind, field] = adapter.split('.');
    if (entry.type !== kind || !record(entry.value)) return 'This consumer needs a single resolved composite token.';
    const value = entry.value;
    if (kind === 'shadow') {
      const spread = value.spread;
      if (value.inset === true || spread !== undefined && spread !== '0px' && spread !== 0 && !(record(spread) && spread.value === 0 && spread.unit === 'px')) return 'This shadow consumer cannot represent spread, inset or multiple shadows.';
    }
    if (kind === 'border') {
      if (!['solid', 'dashed', 'dotted'].includes(String(value.style)) || typeof value.style !== 'string') return 'This border consumer supports solid, dashed or dotted strokes only.';
      // Clear more specific dash settings on the same portable link transaction.
      if (field === 'dashArray') return make('string', '');
      if (field === 'dashLength' || field === 'gapLength') return make('number', 0);
      if (field === 'style') return make('string', value.style === 'solid' ? '' : value.style);
    }
    if (!field) return Object.keys(fields[kind!]!).every(key => value[key] !== undefined) ? make('string', JSON.stringify(value)) : 'The composite is missing a required property.';
    if (value[field] === undefined) return 'The composite property has no resolved value.';
    return make(fields[kind!]![field]!, value[field]);
  }
  if (adapter === 'duration-ms' || adapter === 'duration-s') {
    if (entry.type !== 'duration' || !record(entry.value) || (entry.value.unit !== 'ms' && entry.value.unit !== 's') || typeof entry.value.value !== 'number' || !Number.isFinite(entry.value.value) || entry.value.value < 0) return 'Duration tokens need a finite nonnegative value in ms or s.';
    return make('number', entry.value.value * (entry.value.unit === 's' ? 1000 : 1) / (adapter === 'duration-s' ? 1000 : 1));
  }
  if (adapter === 'cubic-bezier') {
    const v = entry.value;
    if (entry.type !== 'cubicBezier' || !Array.isArray(v) || v.length !== 4 || ![0, 1, 2, 3].every(i => Object.hasOwn(v, i) && typeof v[i] === 'number' && Number.isFinite(v[i]) && Math.abs(v[i]) <= 100) || v[0] < 0 || v[0] > 1 || v[2] < 0 || v[2] > 1) return 'A cubic Bezier token needs four finite controls, with x controls between 0 and 1.';
    return make('string', `cubic-bezier(${v.join(',')})`);
  }
  if (adapter === 'ratio') return entry.type === 'number' && typeof entry.value === 'number' && Number.isFinite(entry.value) ? entry : 'Line height needs a unitless number token.';
  const stops = entry.value;
  if (entry.type !== 'gradient' || !Array.isArray(stops) || stops.length < 2 || stops.length > MAX_GRADIENT_STOPS) return 'A gradient token needs 2 to 12 stops.';
  let previous = -1;
  const converted = [];
  for (const stop of stops) {
    if (!record(stop) || typeof stop.position !== 'number' || !Number.isFinite(stop.position) || stop.position < previous || stop.position < 0 || stop.position > 1) return 'Gradient positions must increase within 0 to 1.';
    const color = swatchFace(toSwatch(make('color', stop.color)), 'srgb');
    if (!color || !/^#[a-f0-9]{6}(?:[a-f0-9]{2})?$/i.test(color)) return 'This gradient consumer needs resolved sRGB stops.';
    converted.push({ color, pos: stop.position * 100 }); previous = stop.position;
  }
  return make('string', formatGradientSpec({ kind: 'linear', angle: 90, space: 'srgb', stops: converted }));
}
