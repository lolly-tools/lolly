// SPDX-License-Identifier: MPL-2.0
/** Export may move into a dock outside the tool view. The name still belongs to
 * the same actions root, which also feeds the saved-state snapshot. */
export function sessionName(actions: HTMLElement | null): { get(): string; set(value: string): void; placeholder(): string } {
  const field = (): HTMLInputElement | null => actions?.querySelector<HTMLInputElement>('[data-action="filename"]') ?? null;
  return {
    get: () => field()?.value || '',
    placeholder: () => field()?.placeholder || '',
    set(value) {
      const input = field();
      if (!input) return;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    },
  };
}
