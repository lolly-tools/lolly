// SPDX-License-Identifier: MPL-2.0
/** Map existing input declarations into independently named public controls. */
import type { InputSpec } from '../../../../engine/src/inputs.ts';
import type { DesignToolDraftV1, DesignInputV1 } from '@lolly-tools/core/design-tool-v1';
import type { InputModelItem } from '../../../../engine/src/inputs.ts';
import type { ToolManifest } from '../../../../engine/src/loader.ts';
import { newDesignToolDraft } from './design-tool-draft.ts';

export function sessionInputReason(input: InputSpec): string | null {
  if (
    ![
      'text',
      'longtext',
      'url',
      'date',
      'time',
      'datetime-local',
      'number',
      'boolean',
      'select',
      'color',
      'asset',
    ].includes(input.type)
  )
    return 'Structured content and file inputs stay fixed. Use Design to expose individual objects.';
  if (input.type === 'asset' && input.assetType !== 'image')
    return 'Only still image inputs can be made editable.';
  if (input.type === 'select' && /font/i.test(input.id))
    return 'Use Design’s font rules to offer multiple complete fonts.';
  return null;
}
export function sessionField(input: InputSpec, item: InputModelItem, index: number): DesignInputV1 {
  const spec: DesignInputV1['input'] = {...structuredClone(input), display: input.type === 'select' ? 'select' : input.display === 'slider' ? 'slider' : 'input'};
  spec.id = `editable_${index + 1}`;
  spec.label = String(input.label || input.id);
  spec.default = structuredClone(item.value) as InputSpec['default'];
  if (
    spec.default &&
    typeof spec.default === 'object' &&
    'ref' in spec.default &&
    'value' in spec.default
  )
    spec.default = spec.default.value as InputSpec['default'];
  if(spec.options)spec.options=spec.options.map(option=>{const copy={...option};delete copy.showIf;return copy;});
  delete spec.bindToProfile;
  delete spec.showIf;
  delete spec.urlKey;
  delete spec.section;
  delete spec.bindToMeta;
  if (['text', 'longtext', 'url'].includes(spec.type))
    spec.maxLength = spec.maxLength ?? Math.max(2000, String(spec.default || '').length);
  if (spec.type === 'number') {
    const n = Number(spec.default) || 0;
    spec.min = spec.min ?? Math.min(0, n * 2);
    spec.max = spec.max ?? Math.max(100, n * 2);
    spec.step = spec.step || 1;
  }
  const common = ['firstname', 'lastname', 'email'].includes(String(input.bindToProfile))
    ? {key: input.bindToProfile as 'firstname' | 'lastname' | 'email', subject: 'person' as const, source: 'profile' as const} : undefined;
  return { input: spec, targets: [], ...(common ? {common} : {}) };
}
export function newSessionToolDraft(
  manifest: ToolManifest,
  name: string,
  size: { width: number; height: number }
): DesignToolDraftV1 {
  const draft = newDesignToolDraft(
    [{ id: 'output', label: 'Output', ...size, background: '', boxes: [] }],
    name
  );
  draft.formats = draft.formats.filter((f) => manifest.render.formats.includes(f));
  draft.sourceTool = { id: manifest.id, version: manifest.version, inputs: {} };
  return draft;
}
