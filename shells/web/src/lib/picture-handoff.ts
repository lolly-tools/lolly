// SPDX-License-Identifier: MPL-2.0
/**
 * One picture, passed between the tools that work on a single picture.
 *
 * Nothing here is written for a pair of tools. Both ends are read from what the
 * manifests already declare:
 *   - the sender is a tool whose `renditionOf.input` is the asset input holding
 *     the picture, which is how a tool states that its output is that picture
 *     worked over;
 *   - a receiver is any other tool whose `openWith` opens that kind of picture
 *     into one of its inputs.
 * The picture travels as the same asset, not as the sender's render, so the
 * receiver starts from the source and its Content Credentials read as they would
 * from the catalog. The framing travels with the picture: the vector input the
 * sender declares `framingFor` the picture, into the ones the receiver declares
 * for the input it opens, and a fit toggle `attachTo` the picture where both
 * tools offer the same choice.
 */
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import { assetOpenChoices, type AssetOpenChoiceV1, type AssetOpenToolV1 } from '@lolly-tools/core/asset-open-v1';
import type { ToolManifest } from '@lolly/engine';
import { matchesShowIf, type InputValue } from '../../../../engine/src/inputs.ts';

type Values = Record<string, InputValue>;

/** True for a value that is an asset: the picture an asset input holds. */
export function isAssetRef(value: InputValue | undefined): value is AssetRef {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Uint8Array)
    && 'id' in value && typeof value.id === 'string' && value.id !== '' && 'url' in value && 'type' in value;
}

export interface PictureDestination { id: string; name: string }

/** A tool-index row: what the gallery already holds for every tool. */
export type IndexedTool = AssetOpenToolV1 & { deprecated?: boolean; listed?: boolean };

/** The destinations `from` offers for the picture in `inputId`. Pure. */
export function pictureDestinations(
  from: Pick<ToolManifest, 'id' | 'renditionOf'>,
  inputId: string,
  ref: InputValue | undefined,
  tools: readonly IndexedTool[],
): PictureDestination[] {
  if (!isAssetRef(ref) || from.renditionOf?.input !== inputId) return [];
  const open = tools.filter((tool) => tool.id !== from.id && !tool.deprecated && tool.listed !== false);
  const seen = new Set<string>();
  const out: PictureDestination[] = [];
  for (const choice of assetOpenChoices(open, [ref])) {
    if (choice.intent.binding.kind !== 'input' || seen.has(choice.tool.id)) continue;
    seen.add(choice.tool.id);
    out.push({ id: choice.tool.id, name: choice.tool.name ?? choice.tool.id });
  }
  return out;
}

/**
 * The framing values the receiver starts with. The sender's framing is the one in
 * use: of several inputs declared for the picture, the first whose `showIf` holds.
 * Only fields the receiver declares are copied. Pure.
 */
export function carriedFraming(from: ToolManifest, values: Values, inputId: string, to: ToolManifest, toInputId: string): Values {
  const out: Values = {};
  const inUse = from.inputs.filter((input) => matchesShowIf(input.showIf, values));
  const placed = values[inUse.find((input) => input.type === 'vector' && input.framingFor === inputId)?.id ?? ''];
  if (typeof placed === 'object' && placed !== null && !Array.isArray(placed) && !(placed instanceof Uint8Array)) {
    const numbers: Record<string, unknown> = { ...placed };
    for (const input of to.inputs) {
      if (input.type !== 'vector' || input.framingFor !== toInputId) continue;
      const copy: Record<string, number> = {};
      for (const field of input.fields ?? []) {
        const v = numbers[field.id];
        if (typeof v === 'number' && Number.isFinite(v)) copy[field.id] = v;
      }
      if (Object.keys(copy).length) out[input.id] = copy;
    }
  }
  const fit = values[inUse.find((input) => input.type === 'select' && input.attachTo === inputId)?.id ?? ''];
  if (typeof fit === 'string') {
    for (const input of to.inputs) {
      if (input.type === 'select' && input.attachTo === toInputId && input.options?.some((option) => option.value === fit)) out[input.id] = fit;
    }
  }
  return out;
}

/** Open `destinationId` on the picture in `inputId`, in a session of its own. */
export async function openPictureIn(host: HostV1, from: ToolManifest, values: Values, inputId: string, destinationId: string): Promise<void> {
  const ref = values[inputId];
  if (!isAssetRef(ref)) return;
  const [{ getTool }, { openingInputValues, setAssetOpening }, { navigateTo }] = await Promise.all([
    import('../bridge/tool-loader.ts'), import('./asset-open-handoff.ts'), import('../nav.ts'),
  ]);
  const to = (await getTool(destinationId)).manifest;
  const choice: AssetOpenChoiceV1 | undefined = assetOpenChoices([to], [ref]).find((entry) => entry.intent.binding.kind === 'input');
  const binding = choice?.intent.binding;
  if (!choice || binding?.kind !== 'input') throw new Error('This tool no longer accepts the picture.');
  const opened = await openingInputValues(host, to, choice, [ref]);
  const slot = `asset-${crypto.randomUUID()}`;
  setAssetOpening({
    toolId: to.id, slot, refs: [ref], kind: 'input', at: Date.now(),
    values: { ...carriedFraming(from, values, inputId, to, binding.input), ...opened },
  });
  navigateTo(`#/tool/${to.id}?${new URLSearchParams({ slot })}`);
}
