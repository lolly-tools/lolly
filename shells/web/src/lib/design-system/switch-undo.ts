// SPDX-License-Identifier: MPL-2.0
/**
 * A design-system switch that says what changed and offers the way back
 * (plan 320 M5). A switch repaints every tool, so a silent one reads as nothing
 * happening. The Preferences card and the Settings strip both switch through
 * this helper, and the notice with its Undo reads the same from either place.
 */
import { tRaw } from '../../i18n.ts';
import { showUndoToast } from '../undo-toast.ts';
import { switchDesignSystem, type SwitchHost, type SwitchOptions, type SwitchResult } from './switch.ts';

/** Switch to `id`, then show "Using {name}." with an Undo that switches back with the same options. */
export async function switchWithUndo(host: SwitchHost, id: string, opts: Omit<SwitchOptions, 'previous'> = {}): Promise<SwitchResult> {
  const previous = await host.designSystems.active();
  const result = await switchDesignSystem(host, id, { ...opts, previous });
  showUndoToast({
    message: tRaw('Using {name}.', { name: result.record.label }),
    undo: async () => { await switchDesignSystem(host, previous.id, opts); },
  });
  return result;
}
