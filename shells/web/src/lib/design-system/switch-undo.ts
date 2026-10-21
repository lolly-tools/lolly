// SPDX-License-Identifier: MPL-2.0
/**
 * A design-system switch that says what changed and offers the way back
 * (plan 320 M5). A switch repaints every tool, so a silent one reads as nothing
 * happening. The Preferences card and the Settings strip both switch through
 * this helper, and the notice with its Undo reads the same from either place.
 *
 * Only one switch notice is up at a time. Flipping between systems from the
 * strip would otherwise stack a notice per press over the page, and an older
 * notice's Undo would go back to a system that is no longer the one before.
 */
import { tRaw } from '../../i18n.ts';
import { showUndoToast, type UndoToastHandle } from '../undo-toast.ts';
import { switchDesignSystem, type SwitchHost, type SwitchOptions, type SwitchResult } from './switch.ts';

/** The notice of the latest switch, while it is up. */
let notice: UndoToastHandle | null = null;

export interface SwitchUndoHooks {
  /** Runs after Undo has switched back, with that switch's result. */
  onUndo?(result: SwitchResult): void;
}

/**
 * Switch to `id`, then show "Using {name}." with an Undo that switches back with
 * the same options. A notice from an earlier switch goes first.
 */
export async function switchWithUndo(host: SwitchHost, id: string, opts: Omit<SwitchOptions, 'previous'> = {}, hooks: SwitchUndoHooks = {}): Promise<SwitchResult> {
  const previous = await host.designSystems.active();
  const result = await switchDesignSystem(host, id, { ...opts, previous });
  notice?.settle();
  const handle: UndoToastHandle = showUndoToast({
    message: tRaw('Using {name}.', { name: result.record.label }),
    undo: async () => {
      if (notice === handle) notice = null;
      const back = await switchDesignSystem(host, previous.id, opts);
      hooks.onUndo?.(back);
    },
    commit: () => { if (notice === handle) notice = null; },
  });
  notice = handle;
  return result;
}
