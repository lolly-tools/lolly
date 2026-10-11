// SPDX-License-Identifier: MPL-2.0
/** Supported composite groups use the same scalar fields and portable link metadata. */
import type { BlockFieldSpec } from '../../../../engine/src/inputs.ts';
import type { TokenAdapter } from '../../../../engine/src/token-consumer-adapters.ts';
import type { BoxFieldConfig } from './free-canvas-math.ts';
export interface DesignTokenProperty { field: BlockFieldSpec; targets: Array<{ field: BlockFieldSpec; adapter?: TokenAdapter }>; adapter?: TokenAdapter }
export function designTokenProperties(fields: readonly BlockFieldSpec[], visible: readonly (string | undefined)[], cfg: BoxFieldConfig & Record<string, string | undefined>): DesignTokenProperty[] {
  const selected = fields.filter(field => visible.includes(field.id));
  const adapterFor = (id: string): TokenAdapter | undefined => id === cfg.gradField ? 'gradient' : [cfg.enterMsField, cfg.exitMsField].includes(id) ? 'duration-ms' : id === cfg.durField ? 'duration-s' : ['enterEase', 'exitEase'].includes(id) ? 'cubic-bezier' : undefined;
  const result: DesignTokenProperty[] = selected.filter(field => ['number', 'color'].includes(field.type ?? '') || field.brandFonts || field.id === cfg.weightField || adapterFor(field.id)).map(field => ({ field, adapter: adapterFor(field.id), targets: [{ field, adapter: adapterFor(field.id) }] }));
  for (const [kind, label, pairs] of [
    ['typography', 'Whole typography', [[cfg.fontField, 'fontFamily'], [cfg.fontSizeField, 'fontSize'], [cfg.weightField, 'fontWeight'], [cfg.trackingField, 'letterSpacing'], [cfg.lineHeightField, 'lineHeight']]],
    ['shadow', 'Whole shadow', [[cfg.shadowColorField, 'color'], [cfg.shadowXField, 'offsetX'], [cfg.shadowYField, 'offsetY'], [cfg.shadowBlurField, 'blur']]],
  ] as const) {
    const targets = pairs.map(([id, key]) => ({ field: selected.find(field => field.id === id), adapter: `${kind}.${key}` as TokenAdapter }));
    if (targets.every(target => target.field)) result.push({ field: { id: `__${kind}`, type: 'text', label }, adapter: kind, targets: targets as DesignTokenProperty['targets'] });
  }
  return result;
}
