// SPDX-License-Identifier: MPL-2.0
/**
 * A tool whose render settings follow one input (`render.when`, engine 1.356).
 *
 * The tool view decides its whole frame when it mounts: whether there is an export
 * sheet, which action buttons the bar holds, whether the canvas is a scaled artboard
 * or a live page, whether the camera controls exist. Those answers come from the
 * `render` block in effect, which the engine resolves from the manifest and the
 * current values (`runtime.getRender()`).
 *
 * When the keyed input changes and the block in effect changes with it, the view is
 * mounted again at the same address, so every part of the frame is built from the new
 * answer and nothing from the old one stays on screen. The live values cross that
 * mount by reference, as they do when a collaboration starts
 * (lib/collab-live-mount.ts), because a picked file and a long text have no place in
 * an address.
 *
 * What does not cross: the undo stack, which belongs to a mount.
 */
import { matchesShowIf } from '@lolly/engine';
import type { ToolManifest } from '@lolly/engine';

type Render = ToolManifest['render'];

/** A runtime that may answer the block in effect. A stand-in runtime in a test may not. */
interface RenderSource { getRender?: () => Render }

/** The `render` block in effect now: the runtime's answer, or the manifest's own block. */
export function renderInEffect(runtime: RenderSource | null | undefined, manifest: { render: Render }): Render {
  return runtime?.getRender?.() ?? manifest.render;
}

/** What a mount hands the next one when its render settings changed. */
export interface CarriedRenderMount {
  readonly toolId: string;
  readonly slot: string | null;
  /** Input id to value, as the outgoing runtime held them. Not serialised. */
  readonly values: Record<string, unknown>;
  /** The keyed input, when the person's focus was on its control. */
  readonly focusInput: string | null;
  /** The inputs the person had changed, which the address is written from. */
  readonly edited: readonly string[];
}

/**
 * The inputs that belong to this mount. A tool whose render settings follow an input is
 * mounted once per value of that input, so an input whose `showIf` asks for another
 * value of the keyed input cannot be shown for the life of the mount. The view leaves
 * such an input out of what it offers by type: a `file` input of the other mode is not
 * a drop target on the canvas and is not what the recovery notice speaks of. A tool
 * with no `when` gets its inputs back as they are, the same array.
 */
export function inputsOfMount<T extends { showIf?: unknown }>(
  manifest: { render: Render; inputs?: readonly T[] }, values: Record<string, unknown>,
): readonly T[] {
  const inputs = manifest.inputs ?? [];
  const keyed = typeof manifest.render.when?.input === 'string' ? manifest.render.when.input : null;
  if (!keyed) return inputs;
  return inputs.filter((input) => {
    const showIf = input.showIf as Record<string, unknown> | undefined;
    if (!showIf || typeof showIf !== 'object' || !Object.hasOwn(showIf, keyed)) return true;
    return matchesShowIf({ [keyed]: showIf[keyed] } as Parameters<typeof matchesShowIf>[0], values);
  });
}

let armed: { toolId: string; focusInput: string | null } | null = null;
let carried: CarriedRenderMount | null = null;

/** Whether the mount of this tool is about to be replaced because its render settings changed. */
export function willRemountForRender(toolId: string): boolean {
  return armed?.toolId === toolId;
}

/** Hand the outgoing mount's values to its replacement. Ignored unless armed. */
export function carryRenderMount(toolId: string, slot: string | null, values: Record<string, unknown>, edited: Iterable<string> = []): void {
  if (armed?.toolId !== toolId) return;
  carried = { toolId, slot, values: { ...values }, focusInput: armed.focusInput, edited: [...edited] };
  armed = null;
}

/** One shot: what the new mount starts from, or null for every other mount. */
export function takeRenderMount(toolId: string): CarriedRenderMount | null {
  armed = null;
  if (!carried || carried.toolId !== toolId) { carried = null; return null; }
  const state = carried;
  carried = null;
  return state;
}

export interface RenderModeWatch {
  toolId: string;
  manifest: { render: Render };
  runtime: RenderSource & { subscribe(fn: () => void): () => void };
  /** The block this mount was built from. */
  mounted: Render;
  /** The element that holds the input controls, to learn whether the keyed input has focus. */
  inputs: () => ParentNode | null;
  /** Write any waiting address change, then mount the view again. */
  remount: () => void;
  /** Runs the remount after the current change has finished. Injected by tests. */
  defer?: (fn: () => void) => void;
}

/**
 * Watch one mount. The first time the block in effect is no longer the one the mount
 * was built from, arm the carry and ask for the view to be mounted again. Returns the
 * function that ends the watch.
 */
export function watchRenderMode(watch: RenderModeWatch): () => void {
  const keyed = typeof watch.manifest.render.when?.input === 'string' ? watch.manifest.render.when.input : null;
  if (!keyed) return () => {};
  const defer = watch.defer ?? ((fn: () => void) => { setTimeout(fn, 0); });
  let done = false;
  let stopped = false;
  const off = watch.runtime.subscribe(() => {
    if (done || renderInEffect(watch.runtime, watch.manifest) === watch.mounted) return;
    done = true;
    const active = watch.inputs()?.ownerDocument?.activeElement ?? null;
    const focused = controlInputId(active?.closest?.(CONTROL) ?? null) === keyed;
    armed = { toolId: watch.toolId, focusInput: focused ? keyed : null };
    defer(() => {
      if (armed?.toolId !== watch.toolId) return;
      // A view that left in the meantime owes nothing to the next mount of this tool.
      if (stopped) armed = null;
      else watch.remount();
    });
  });
  return () => { done = true; stopped = true; off(); };
}

/** A control carries its input id, or sits in the button group a select draws as. */
const CONTROL = '[data-input-id], [data-badge-select]';
const controlInputId = (el: Element | null): string | null =>
  el?.getAttribute('data-input-id') ?? el?.getAttribute('data-badge-select') ?? null;

/** Put focus back on the keyed input's control after the mount that replaced the old one. */
export function restoreRenderFocus(inputs: ParentNode | null, inputId: string | null): void {
  if (!inputs || !inputId) return;
  const own = [...inputs.querySelectorAll<HTMLElement>(CONTROL)].find((el) => controlInputId(el) === inputId);
  if (!own) return;
  // The person was on this control, so the section that holds the control was open. A
  // new mount draws its sections folded as the tool declares, and a control inside a
  // folded section cannot take focus.
  for (let fold = own.closest('details'); fold; fold = fold.parentElement?.closest('details') ?? null) fold.open = true;
  // A button group takes focus on its chosen button.
  const chosen = own.matches('[data-badge-select]')
    ? own.querySelector<HTMLElement>('[aria-checked="true"], [aria-pressed="true"]') ?? own.querySelector<HTMLElement>('button')
    : own;
  chosen?.focus({ preventScroll: true });
}

/**
 * Restore focus now, and once more when the router arrives at the view. While a view
 * mounts the page may not take focus yet, and the router then puts focus on the view
 * itself (main.ts `arriveAt`); that focus is the moment the control can take focus. The
 * second chance ends after `withinMs`, so a later click on the view is left alone.
 */
export function restoreRenderFocusOnArrival(view: HTMLElement, inputs: () => ParentNode | null, inputId: string | null, withinMs = 4000): void {
  if (!inputId) return;
  restoreRenderFocus(inputs(), inputId);
  const onArrive = (): void => { stop(); restoreRenderFocus(inputs(), inputId); };
  const timer = setTimeout(() => stop(), withinMs);
  const stop = (): void => { clearTimeout(timer); view.removeEventListener('focus', onArrive); };
  view.addEventListener('focus', onArrive);
}
