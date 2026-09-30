// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { Runtime } from '../../../../engine/src/runtime.ts';
import type { DesignToolPolicyV1 } from '@lolly-tools/core/design-tool-v1';
import { checkTextLayout } from '../lib/text-layout-check.ts';
import { announce } from '../a11y.ts';
import { t } from '../i18n.ts';
import { mountLockedActions } from './locked-tool-actions.ts';
import { resetDesignInputs } from '../lib/design-input-reset.ts';
import '../styles/parts/locked-tool.css';

/** Presentation only. The engine owns the editable fields and output rules. */
export function mountLockedTool(opts: { view: HTMLElement; canvas: HTMLElement; sidebar: HTMLElement; stage: HTMLElement; actions?: HTMLElement | null; runtime: Runtime; host: HostV1; policy: DesignToolPolicyV1 }): () => void {
  const { view, canvas, sidebar, stage, policy } = opts;
  const trigger = document.createElement('button');
  trigger.type = 'button'; trigger.className = 'btn btn--glass locked-edit-inputs';
  trigger.textContent = t('Edit inputs');
  trigger.setAttribute('aria-controls', sidebar.id);
  const onCanvas = policy.presentation === 'on-canvas';
  view.classList.add('is-locked-tool');
  view.classList.toggle('locked-on-canvas', onCanvas);
  const heading = document.createElement('header'); heading.className = 'locked-heading';
  const title = document.createElement('h1'); title.textContent = opts.runtime.manifest.name;
  heading.append(title, trigger); stage.append(heading);
  const instructions = document.createElement('p'); instructions.className = 'locked-instructions'; instructions.textContent = opts.runtime.manifest.description || t('Edit the inputs, preview your result, then download.');
  sidebar.querySelector('.sidebar-body')?.prepend(instructions);
  const stopActions = opts.actions ? mountLockedActions(view, opts.actions, opts.runtime.manifest.render.formats, () => { void resetDesignInputs(opts.runtime, sidebar); }) : undefined;
  const done = document.createElement('button'); done.type = 'button'; done.className = 'btn locked-inputs-done'; done.textContent = t('Preview');
  sidebar.querySelector('.sidebar-header')?.append(done);
  const syncReserves = (): void => {
    const reserves = { top: view.classList.contains('locked-inputs-open') ? 0 : heading.getBoundingClientRect().height, bottom: view.querySelector('.locked-actions')?.getBoundingClientRect().height || 88 };
    view.style.setProperty('--locked-actions-h', `${Math.ceil(reserves.bottom)}px`);
    let changed = false;
    for (const [edge, px] of Object.entries(reserves)) {
      const key = `--stage-reserve-${edge}`, value = `${Math.ceil(px)}px`;
      if (stage.style.getPropertyValue(key) !== value) { stage.style.setProperty(key, value); changed = true; }
    }
    const inputHeight = sidebar.querySelector('#tool-inputs')?.getBoundingClientRect().height || 0;
    const headerHeight = sidebar.querySelector('.sidebar-header')?.getBoundingClientRect().height || 0;
    const available = window.visualViewport?.height || window.innerHeight;
    view.style.setProperty('--locked-form-h', `${Math.min(Math.max(200, available - 200), headerHeight + instructions.offsetHeight + inputHeight + 60)}px`);
    if (changed) canvas.dispatchEvent(new CustomEvent('canvas-resize'));
  };
  const setOpen = (open: boolean, focus = false): void => {
    view.classList.toggle('locked-inputs-open', open); trigger.setAttribute('aria-expanded', String(open));
    syncReserves();
    if (focus) {
      if (open) sidebar.querySelector<HTMLElement>('[data-input-id],input,textarea,select')?.focus({ preventScroll: true });
      else trigger.focus({ preventScroll: true });
    }
  };
  setOpen(!onCanvas);
  const resize = new ResizeObserver(syncReserves); resize.observe(heading);
  const bar = view.querySelector('.locked-actions'); if (bar) resize.observe(bar);
  const inputs = sidebar.querySelector('#tool-inputs'); if (inputs) resize.observe(inputs);
  resize.observe(instructions);
  done.addEventListener('click', () => setOpen(false, true));
  const feedback=document.createElement('p');feedback.className='locked-fit-feedback';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');stage.append(feedback);
  const toggle = (): void => {
    const open = !view.classList.contains('locked-inputs-open');
    setOpen(open, true);
  };
  const click = (event: MouseEvent): void => {
    const id = (event.target as Element).closest<HTMLElement>('[data-public-input]')?.dataset.publicInput;
    if (!id) return;
    setOpen(true);
    sidebar.querySelector<HTMLElement>(`[data-input="${CSS.escape(id)}"] input, [data-input="${CSS.escape(id)}"] textarea, [data-input="${CSS.escape(id)}"] select, [data-input-id="${CSS.escape(id)}"]`)?.focus();
  };
  const key = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && view.classList.contains('locked-inputs-open') && !document.querySelector('dialog[open]')) {
      event.preventDefault(); event.stopPropagation(); setOpen(false, true);
    }
  };
  trigger.addEventListener('click', toggle); canvas.addEventListener('click', click); view.addEventListener('keydown', key);
  const measure = (): void => { const at=canvas.lastElementChild; void checkTextLayout(canvas, opts.host.text).then(result => { if (!canvas.isConnected || at!==canvas.lastElementChild) return; const sizes=[...canvas.querySelectorAll<HTMLElement>('[data-effective-size]')].filter(el=>Number(el.dataset.effectiveSize)<Number(el.dataset.requestedSize)-.1).map(el=>`${policy.inputs.find(f=>f.input.id===el.dataset.publicInput)?.input.label || t('Text')}: ${Number(el.dataset.requestedSize).toFixed(0)} → ${Number(el.dataset.effectiveSize).toFixed(1)} px`);feedback.textContent=result.ok?sizes.join(' · '):result.issues[0]!; }).catch(err => { if (canvas.isConnected) announce(String(err.message)); }); };
  const observer = new MutationObserver(measure);
  observer.observe(canvas, { childList: true, subtree: true });
  measure();
  return () => { observer.disconnect(); resize.disconnect(); stopActions?.(); instructions.remove(); heading.remove(); done.remove(); feedback.remove(); canvas.removeEventListener('click', click); view.removeEventListener('keydown', key); view.classList.remove('is-locked-tool', 'locked-on-canvas', 'locked-inputs-open'); stage.style.removeProperty('--stage-reserve-top'); stage.style.removeProperty('--stage-reserve-bottom'); view.style.removeProperty('--locked-form-h'); view.style.removeProperty('--locked-actions-h'); };
}
