// SPDX-License-Identifier: MPL-2.0
/**
 * tool view: colour, select and asset popovers over the canvas.
 *
 * Every function takes the shared `tview: ToolViewCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `tview.<module>.<fn>`. Extracted verbatim
 * from mountTool() by scripts/split-closure.ts.
 */
import type { AssetRef } from '@lolly-tools/core/host-v1';
import type { InputModelItem, InputValue } from '../../../../../engine/src/inputs.js';
import { escape as escapeText } from '../../utils.ts';
import { tRaw } from '../../i18n.ts';
import { colorFieldHtml, fixedContainingBlockOrigin, wireColorField } from '../../components/color-field.ts';
import { askLollyIntent } from '../picker.ts';
import { asRow } from '../tool-types.ts';
import { asStr, openEmbedEditor } from '../tool-inputs.ts';
import type { WebToolHost } from './shared.ts';
import { bindOp, type ToolViewCtx } from './context.ts';

// Colour: a temporary, otherwise-invisible instance of the shared colour-field
// component, positioned over the clicked swatch and opened programmatically -
// so the popover it opens (float mode) is byte-for-byte the sidebar's own
// widget, just anchored at the click instead of docked under a sidebar row.
// Removed the moment its popover closes (Escape / outside click), detected via
// the `hidden` attribute the component already flips on close - one signal,
// whichever of the three ways it happened to close.
export function openColorPopover(tview: ToolViewCtx, anchor: HTMLElement, input: InputModelItem): void {
  const box = document.createElement('div');
  box.className = 'canvas-color-popover-host';
  box.innerHTML = colorFieldHtml(input.id, input.value, {
    swatchesOnly: input.swatchesOnly === true,
    float: true,
  });
  document.body.appendChild(box);
  const trigger = box.querySelector<HTMLElement>('.color-trigger');
  const popover = box.querySelector<HTMLElement>('.color-popover');
  if (!trigger || !popover) {
    box.remove();
    return;
  }
  const ar = anchor.getBoundingClientRect();
  box.style.cssText = `position:fixed;left:${Math.round(ar.left)}px;top:${Math.round(ar.top)}px;width:${Math.round(ar.width)}px;height:${Math.round(ar.height)}px;`;
  wireColorField(box, {
    onChange: (fieldId, value) => {
    const { runtime } = tview;
      runtime.setInput(fieldId, value);
      tview.session.markUserDirty(fieldId);
    },
  });
  trigger.style.opacity = '0';
  trigger.style.pointerEvents = 'none';
  trigger.click(); // opens the popover via the component's own (tested) logic
  const observer = new MutationObserver(() => {
    if (popover.hidden) {
      observer.disconnect();
      box.remove();
    }
  });
  observer.observe(popover, { attributes: true, attributeFilter: ['hidden'] });
}
// Select: no shared floating widget exists for this yet (the sidebar uses a
// plain native <select>, and a native dropdown can't be opened by script from
// an unrelated click target) - so this is a small bespoke option-list popover,
// generic enough it could grow into a shared component if more call sites want
// one. Picking an option commits and closes immediately (a select's change IS
// the complete action, unlike a colour field's fiddly controls).
export function openSelectPopover(tview: ToolViewCtx, anchor: HTMLElement, input: InputModelItem): void {
  const options = input.options ?? [];
  const box = document.createElement('div');
  box.className = 'canvas-input-popover';
  box.setAttribute('role', 'listbox');
  box.setAttribute('aria-label', input.label ?? input.id);
  box.innerHTML = options
    .map(
      (o, i) =>
        `<button type="button" class="canvas-input-popover-opt${o.value === input.value ? ' is-current' : ''}" role="option" aria-selected="${o.value === input.value}" data-i="${i}">${escapeText(o.label ?? String(o.value))}</button>`
    )
    .join('');
  box.style.cssText = 'position:fixed;visibility:hidden;left:-9999px;top:0;';
  document.body.appendChild(box);
  const w = box.offsetWidth,
    h = box.offsetHeight;
  const ar = anchor.getBoundingClientRect();
  const cb = fixedContainingBlockOrigin(box);
  const left = Math.max(6, Math.min(ar.left - cb.x, window.innerWidth - w - 8));
  const top = Math.max(6, Math.min(ar.bottom + 6 - cb.y, window.innerHeight - h - 8));
  box.style.cssText = `position:fixed;left:${Math.round(left)}px;top:${Math.round(top)}px;z-index:10001;`;

  const close = (): void => {
    box.remove();
    document.removeEventListener('pointerdown', onDocDown, true);
    document.removeEventListener('keydown', onKey, true);
  };
  box.querySelectorAll<HTMLElement>('[data-i]').forEach((btn) =>
    { btn.addEventListener('click', () => {
    const { runtime } = tview;
      const opt = options[Number(btn.dataset.i)];
      if (!opt) return;
      runtime.setInput(input.id, opt.value);
      tview.session.markUserDirty(input.id);
      close();
    }); }
  );
  const onDocDown = (e: PointerEvent): void => {
    if (!box.contains(e.target as Node | null)) close();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  setTimeout(() => {
    document.addEventListener('pointerdown', onDocDown, true);
    document.addEventListener('keydown', onKey, true);
  }, 0);
  (
    box.querySelector<HTMLElement>('.is-current') ?? box.querySelector<HTMLElement>('button')
  )?.focus();
}
// Asset: host.assets.pick is already a self-contained modal picker (input-
// agnostic - the sidebar just calls it with an options object), so a click
// opens it directly, no intermediate popover chrome needed. Mirrors the
// sidebar's asset-picker wiring in tool-inputs.ts exactly, including the
// "edit the tool you're using" prompt for a slot that already holds a live
// Lolly render.
export async function openAssetPickerInline(tview: ToolViewCtx, input: InputModelItem): Promise<void> {
  const { runtime } = tview;
  const curVal = input.value as AssetRef | null;
  const curToolUrl = asStr(asRow(curVal?.meta as InputValue | undefined).toolUrl);
  if (curToolUrl && tview.host.compose?.renderUrl) {
    const intent = await askLollyIntent(
      asStr(asRow(curVal?.meta as InputValue | undefined).name)
    );
    if (!intent) return;
    if (intent === 'edit') {
      const edited = await openEmbedEditor(tview.host, {
        editUrl: curToolUrl,
        slotLabel: input.label ?? input.id,
      });
      if (edited) {
        runtime.setInput(input.id, edited);
        tview.session.markUserDirty(input.id);
      }
      return;
    }
  }
  const ref = await tview.host.assets.pick({
    title: tRaw('Choose {name}', { name: input.label ?? input.id }),
    type:
      input.assetType === 'any' ? undefined : (input.assetType as AssetRef['type'] | undefined),
    // Same capability-driven widening as the sidebar picker (tool-inputs.ts):
    // an onFrame tool's image slot also offers the user's video uploads.
    motion: runtime.hasFrameHook === true,
    tags: input.filter?.tags as string[] | undefined,
    namespace: input.filter?.namespace as string | undefined,
    allowUpload: input.allowUpload === true,
    current: curVal?.id,
    currentToolUrl: curToolUrl,
    currentToolName: asStr(asRow(curVal?.meta as InputValue | undefined).name),
    editTool: (toolUrl: string, mode = 'insert') =>
      openEmbedEditor(tview.host, { editUrl: toolUrl, slotLabel: input.label ?? input.id, mode }),
  } as Parameters<WebToolHost['assets']['pick']>[0]);
  if (ref) {
    runtime.setInput(input.id, ref);
    tview.session.markUserDirty(input.id);
  }
}
export function openInlineInputEditor(tview: ToolViewCtx, anchor: HTMLElement, input: InputModelItem): void {
  if (input.control === 'color-picker') openColorPopover(tview, anchor, input);
  else if (input.control === 'select') openSelectPopover(tview, anchor, input);
  else if (input.control === 'asset-picker') void openAssetPickerInline(tview, input);
}
export function popoversOps(tview: ToolViewCtx) {
  return {
    openColorPopover: bindOp(tview, openColorPopover),
    openSelectPopover: bindOp(tview, openSelectPopover),
    openAssetPickerInline: bindOp(tview, openAssetPickerInline),
    openInlineInputEditor: bindOp(tview, openInlineInputEditor),
  };
}
