// SPDX-License-Identifier: MPL-2.0
/** Build a local saved-session render URL without sharing personal input values. */
import { buildEmbedUrl } from '@lolly/engine';
import type { InputModelItem } from '../../../../engine/src/inputs.ts';
import { shareUrlState } from '../lib/share-privacy.ts';
import { imageFormatSeed } from './picker-formats.ts';

export function savedSessionEmbedUrl(toolId: string, model: InputModelItem[], format: unknown): string | null {
  // This identity re-renders on this device, where user uploads resolve. Preserve
  // those references, but apply the same personal-field filtering as other shares.
  const query = shareUrlState(model, { keepUserIds: true });
  return buildEmbedUrl({ toolId, format: imageFormatSeed(format), query });
}
