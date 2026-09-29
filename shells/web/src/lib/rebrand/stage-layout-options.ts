// SPDX-License-Identifier: MPL-2.0
/** Compile and audit one slide's bounded layout choices away from the UI thread. */
import { recommendLayoutOptions, type LayoutOptionsInput, type LayoutOptionsResult } from '../../../../../engine/src/rebrand-layout-options.ts';
import { resolveRebrandDesignSystem, type RebrandDesignSystemInputV1 } from '../../../../../engine/src/rebrand-design-system.ts';
import type { StageFnV1 } from './stage-core.ts';

export type LayoutOptionsRequest = Omit<LayoutOptionsInput, 'system'> & { system: RebrandDesignSystemInputV1 };

export const layoutOptionsStage: StageFnV1<LayoutOptionsRequest, LayoutOptionsResult> = async (input, ctx) => {
  ctx.throwIfCancelled();
  const system = await resolveRebrandDesignSystem(input.system);
  return recommendLayoutOptions({ ...input, system }, async (done, total) => {
    ctx.throwIfCancelled();
    ctx.progress('Checking slide layouts', done, total);
    // Let the worker receive cancellation before starting the next compile.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    ctx.throwIfCancelled();
  });
};
