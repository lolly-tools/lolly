// SPDX-License-Identifier: MPL-2.0
import { matchesShowIf } from '../../../engine/src/inputs.ts';
import type { ShowIf } from '../../../engine/src/inputs.ts';

interface PresentedInput {
  id: string;
  value: unknown;
  showIf?: ShowIf;
  options?: Array<{ value: string; showIf?: ShowIf }>;
}

/** Conditions change the controls offered, never the underlying document. */
export function presentInputs<T extends PresentedInput>(model: T[]): T[] {
  const values = Object.fromEntries(model.map((input) => [input.id, input.value]));
  return model
    .filter((input) => matchesShowIf(input.showIf, values))
    .map((input) =>
      input.options
        ? {
            ...input,
            options: input.options.filter(
              (option) => option.value === input.value || matchesShowIf(option.showIf, values)
            ),
          }
        : input
    );
}

export function inputFocus(
  model: readonly { id: string }[],
  previousId: string | undefined,
  previousIndex: number
): number {
  const found = model.findIndex((input) => input.id === previousId);
  return found >= 0 ? found : Math.max(0, Math.min(previousIndex, model.length - 1));
}
