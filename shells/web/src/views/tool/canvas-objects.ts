// SPDX-License-Identifier: MPL-2.0
import { matchesShowIf, type InputModelItem, type InputValue, type ShowIf } from '../../../../../engine/src/inputs.ts';
import { wireTileContextMenu, menuItemHtml, type ContextMenuTarget } from '../../lib/context-menu.ts';
import { getInputPolicy } from '../../lib/input-policy.ts';
import { t } from '../../i18n.ts';
import { escape as escapeText } from '../../utils.ts';
import { focusSidebarBlock, scrollToControl } from '../../lib/sidebar-focus.ts';
import { bindOp, type ToolViewCtx } from './context.ts';

/** Resolve only visible, declared controls. Canvas markup cannot name an action. */
export function canvasControl(model: InputModelItem[], ref: string, toolId?: string) {
  const [id, index, fieldId, extra] = ref.split(':');
  const input = model.find(item => item.id === id);
  const policy = getInputPolicy(toolId, id || '');
  if (policy?.mode === 'hidden' || policy?.mode === 'locked' || (policy?.mode === 'choice' && input?.control !== 'select')) return null;
  const values = Object.fromEntries(model.map(item => [item.id, item.value]));
  if (!input || extra || !matchesShowIf(input.showIf, values)) return null;
  if (index === undefined) return { input, index: null, field: null, value: input.value, label: input.label || input.id };
  if (input.type !== 'blocks' || !/^\d+$/.test(index) || !Array.isArray(input.value)) return null;
  const row = input.value[Number(index)];
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const field = fieldId ? input.fields?.find(item => item.id === fieldId) : null;
  if (fieldId && (!field || !matchesShowIf(field.showIf as ShowIf | undefined, { ...values, ...row }))) return null;
  if (field?.showFor && input.addMenu && !field.showFor.includes(String((row as Record<string, InputValue>)[input.addMenu.field]))) return null;
  return { input, index: Number(index), field, value: field ? (row as Record<string, InputValue>)[field.id] : row, label: field?.label || field?.id || input.label || input.id };
}

export function focusCanvasControl(tview: ToolViewCtx, ref: string): void {
  const { inputsEl, layout } = tview;
  const resolved = canvasControl(tview.runtime.getModel(), ref, tview.toolId);
  if (!inputsEl || !resolved) return;
  const { input, index, field } = resolved;
  const focus = () => {
    const control = inputsEl.querySelector<HTMLElement>(`[data-input-id="${CSS.escape(input.id)}"]`);
    if (!control) return;
    control.closest('details.input-section')?.setAttribute('open', '');
    if (index !== null) {
      focusSidebarBlock(control, index);
      const row = control.querySelector<HTMLElement>(`[data-block-index="${index}"].block-item`);
      const target = field
        ? row?.querySelector<HTMLElement>(`[data-field-id="${CSS.escape(ref)}"], [data-input-id="${CSS.escape(ref)}"]`)
        : row?.querySelector<HTMLElement>('.block-fields textarea, .block-fields input.block-field:not([type="range"]), .block-fields select');
      const focusable = target?.matches('input, textarea, select, button') ? target : target?.querySelector<HTMLElement>('input, button');
      focusable?.focus({ preventScroll: true });
      if (target) scrollToControl(target);
      else if (row) scrollToControl(row);
    } else {
      const focusable = control.matches('input, textarea, select, button') ? control : control.querySelector<HTMLElement>('input, textarea, select, button');
      (focusable || control).focus({ preventScroll: true });
      scrollToControl(control);
    }
  };
  if (layout.dataset.sidebar === 'closed') {
    tview.stageLayout.setSidebarWidth(tview.stageLayout.getRestoreWidth());
    tview.mountLifecycle.animationFrame('canvas-control-focus', focus);
  } else focus();
}

export function wireCanvasObjects(tview: ToolViewCtx): void {
  const { canvasEl, hideSidebar, inputsEl, runtime, mountLifecycle } = tview;
  if (!canvasEl || hideSidebar || !inputsEl) return;
  const resolve = (ref: string) => canvasControl(runtime.getModel(), ref, tview.toolId);
  const name = (target: ContextMenuTarget) => target.tile?.dataset.canvasName || resolve(target.ref)?.label || t('Settings');
  const menu = wireTileContextMenu({
    host: canvasEl,
    tileSelector: '[data-canvas-input]',
    refOf: tile => resolve(tile.dataset.canvasInput || '') ? tile.dataset.canvasInput! : null,
    presentation: 'sheet',
    head: target => target ? { name: target.data ? resolve(target.data)?.label || name(target) : name(target) } : null,
    singleHtml(target) {
      if (target.data) {
        const control = resolve(target.data);
        const options = (control?.field || control?.input)?.options;
        if (!control || !options) return '';
        return `<p class="folder-menu-head canvas-object-menu-head">${escapeText(control.label)}</p>` + options.flatMap((option, index) => {
          const allow = getInputPolicy(tview.toolId, control.input.id)?.allow;
          return allow && !allow.includes(String(option.value)) ? [] : [menuItemHtml(`option:${index}`, '', `${String(option.value) === String(control.value) ? '✓ ' : ''}${option.label || option.value}`)];
        }).join('');
      }
      const refs = [...new Set((target.tile?.dataset.canvasSettings || '').split(/\s+/).filter(Boolean))];
      return `<p class="folder-menu-head canvas-object-menu-head">${escapeText(name(target))}</p>`
        + menuItemHtml('edit', '', t('Edit'))
        + refs.flatMap(ref => { const item = resolve(ref); return item ? [menuItemHtml(`field:${ref}`, '', item.label)] : []; }).join('');
    },
    onAction(action, target) {
      if (!target || (target.tile && !target.tile.isConnected)) return;
      if (action === 'edit') { tview.canvasObjects.focusCanvasControl(target.ref); return; }
      if (action.startsWith('field:')) {
        const ref = action.slice(6), control = resolve(ref);
        if (!control) return;
        if ((control.field || control.input).options?.length) {
          const bounds = target.tile?.getBoundingClientRect();
          menu.openAt(bounds?.left || 20, bounds?.top || 20, { ...target, data: ref });
        } else tview.canvasObjects.focusCanvasControl(ref);
      } else if (action.startsWith('option:') && target.data) {
        const control = resolve(target.data);
        const option = (control?.field || control?.input)?.options?.[Number(action.slice(7))];
        if (!control || !option) return;
        const policy = getInputPolicy(tview.toolId, control.input.id);
        if (policy?.allow && !policy.allow.includes(String(option.value))) return;
        const { input, index, field } = control;
        let value: InputValue = option.value;
        if (index !== null && field && Array.isArray(input.value)) {
          value = input.value.map((row, i) => i === index ? { ...(row as Record<string, InputValue>), [field.id]: option.value } : row);
        }
        void runtime.setInput(input.id, value).then(() => tview.session.markUserDirty(input.id))
          .catch(error => tview.host.log?.('warn', `Canvas settings could not update ${input.id}: ${String(error)}`));
      }
    },
  });
  mountLifecycle.add('canvas-object-menu', () => menu.destroy());
  mountLifecycle.listen('canvas-object-click', canvasEl, 'click', event => {
    if (event.defaultPrevented || (event.target as Element).closest('[data-framing]')) return;
    const target = (event.target as Element).closest<HTMLElement>('[data-canvas-input]');
    const ref = target?.dataset.canvasInput;
    if (!target || !ref || !resolve(ref)) return;
    const input = runtime.getModel().find(item => item.id === ref);
    if (input && !target.hasAttribute('data-canvas-settings') && tview.INLINE_EDIT_CONTROLS.has(input.control)) {
      tview.popovers.openInlineInputEditor(target, input);
    } else tview.canvasObjects.focusCanvasControl(ref);
  });
  mountLifecycle.listen('canvas-object-keyboard', canvasEl, 'keydown', event => {
    const key = event as KeyboardEvent;
    const target = (event.target as Element).closest<HTMLElement>('[data-canvas-input]');
    const ref = target?.dataset.canvasInput;
    if (!target || !ref || !resolve(ref)) return;
    if (key.key === 'ContextMenu' || (key.shiftKey && key.key === 'F10')) {
      key.preventDefault();
      const bounds = target.getBoundingClientRect();
      menu.openAt(bounds.left, bounds.bottom, { ref, tile: target }, target);
    } else if (key.key === 'Enter' || key.key === ' ') {
      key.preventDefault(); tview.canvasObjects.focusCanvasControl(ref);
    }
  });
}

export function canvasObjectsOps(tview: ToolViewCtx) {
  return { focusCanvasControl: bindOp(tview, focusCanvasControl), wireCanvasObjects: bindOp(tview, wireCanvasObjects) };
}
