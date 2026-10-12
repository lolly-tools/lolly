// SPDX-License-Identifier: MPL-2.0
/** Supported composite groups use the same scalar fields and portable link metadata. */
import type { BlockFieldSpec } from '../../../../engine/src/inputs.ts';
import type { TokenAdapter } from '../../../../engine/src/token-consumer-adapters.ts';
import type { BoxFieldConfig } from './free-canvas-math.ts';
export interface DesignTokenProperty { field: BlockFieldSpec; targets: Array<{ field: BlockFieldSpec; adapter?: TokenAdapter }>; adapter?: TokenAdapter }
export function designTokenProperties(fields: readonly BlockFieldSpec[], visible: readonly (string | undefined)[], cfg: BoxFieldConfig & Record<string, string | undefined>): DesignTokenProperty[] {
  const selected = fields.filter(field => visible.includes(field.id));
  const adapterFor = (id: string): TokenAdapter | undefined => id === cfg.gradField ? 'gradient' : [cfg.enterMsField, cfg.exitMsField].includes(id) ? 'duration-ms' : id === cfg.durField ? 'duration-s' : [cfg.enterEaseField ?? 'enterEase', cfg.exitEaseField ?? 'exitEase'].includes(id) ? 'cubic-bezier' : undefined;
  const dashTargets = [[cfg.strokeDashArrayField, 'border.dashArray'], [cfg.strokeDashLenField ?? 'strokeDashLen', 'border.dashLength'], [cfg.strokeGapLenField ?? 'strokeGapLen', 'border.gapLength']].flatMap(([id, adapter]) => {
    const field = fields.find(field => field.id === id);
    return field ? [{ field, adapter: adapter as TokenAdapter }] : [];
  });
  const result: DesignTokenProperty[] = selected.filter(field => !dashTargets.some(target => target.field.id === field.id) && (['number', 'color'].includes(field.type ?? '') || field.brandFonts || field.id === cfg.weightField || adapterFor(field.id))).map(field => ({ field, adapter: adapterFor(field.id), targets: [{ field, adapter: adapterFor(field.id) }] }));
  const styleField = selected.find(field => field.id === cfg.strokeDashField);
  if (styleField) result.push({ field: styleField, adapter: 'border.style', targets: [{ field: styleField, adapter: 'border.style' }, ...dashTargets] });
  for (const [kind, label, pairs] of [
    ['typography', 'Whole typography', [[cfg.fontField, 'fontFamily'], [cfg.fontSizeField, 'fontSize'], [cfg.weightField, 'fontWeight'], [cfg.trackingField, 'letterSpacing'], [cfg.lineHeightField, 'lineHeight']]],
    ['shadow', 'Whole shadow', [[cfg.shadowColorField, 'color'], [cfg.shadowXField, 'offsetX'], [cfg.shadowYField, 'offsetY'], [cfg.shadowBlurField, 'blur']]],
    ['border', 'Whole border', [[cfg.strokeField, 'color'], [cfg.strokeWField, 'width'], [cfg.strokeDashField, 'style']]],
  ] as const) {
    const targets = pairs.map(([id, key]) => ({ field: selected.find(field => field.id === id), adapter: `${kind}.${key}` as TokenAdapter }));
    if (targets.every(target => target.field)) result.push({ field: { id: `__${kind}`, type: 'text', label }, adapter: kind, targets: [...targets as DesignTokenProperty['targets'], ...(kind === 'border' ? dashTargets : [])] });
  }
  const duration = selected.find(field => field.id === cfg.enterMsField);
  const easing = selected.find(field => field.id === (cfg.enterEaseField ?? 'enterEase'));
  if (duration?.type === 'number' && easing?.type === 'text') result.push({
    field: { id: '__transition', type: 'text', label: 'Enter transition', min: duration.min, max: duration.max },
    adapter: 'transition',
    targets: [{ field: duration, adapter: 'transition.duration-ms' }, { field: easing, adapter: 'transition.timingFunction' }],
  });
  return result;
}
