// SPDX-License-Identifier: MPL-2.0
import { loadTool } from '@lolly/engine';
import { designToolPolicy, validateDesignValues, designSelection, type DesignToolDraftV1 } from '@lolly-tools/core/design-tool-v1';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { CompiledDesignTool } from '../../../../engine/src/design-tool/compiler.ts';
import type { Runtime } from '../../../../engine/src/runtime.ts';
import type { InputValue } from '../../../../engine/src/inputs.ts';
import type { PanelEl, WebToolHost } from './tool.ts';
import { createInteractiveToolRuntime } from '../lib/mount-runtime.ts';
import { prepareDesignTool } from '../lib/design-tool-compile.ts';
import { designPreviewValue, DesignPreviewHistory } from '../lib/design-preview-history.ts';
import { checkTextLayout } from '../lib/text-layout-check.ts';
import { scopeCss } from '../lib/scope-css.ts';
import { setupFramingOverlay, hasFramingInputs } from './framing-overlay.ts';
import { showDesignSamples } from './design-rules-samples.ts';
import { t } from '../i18n.ts';

export function mountRulesPreview(opts: {
  root: HTMLElement; source: HTMLElement; host: HostV1; compiled?: CompiledDesignTool; hideDefaults?: boolean;
  draft(): DesignToolDraftV1; status(message: string): void;
  defaults(values: Record<string, unknown>): void;
}) {
  const history = new DesignPreviewHistory();
  const canvas = opts.root.querySelector<HTMLElement>('[data-rules-preview-canvas]')!;
  const controls = opts.root.querySelector<PanelEl>('.dr-preview-controls')!;
  const stage = opts.root.querySelector<HTMLElement>('.dr-preview-stage')!;
  const form = document.createElement('div'); form.className = 'dr-preview-form';
  controls.replaceWith(form); form.append(controls);
  const done = document.createElement('button'); done.type = 'button'; done.className = 'btn dr-preview-done'; done.textContent = t('Done');
  form.prepend(done);
  const actions = document.createElement('div'); actions.className = 'dr-sample-actions';
  for (const [action,label] of [['reset','Reset samples'],['theme','Reset to theme'],['limits','Test limits'],['defaults','Use as defaults']]) {
    const button=document.createElement('button');button.className='btn btn--ghost';button.dataset.sample=action!;button.textContent=t(label!);button.hidden=action==='theme'||action==='defaults'&&!!opts.hideDefaults;actions.append(button);
  }
  const samples = document.createElement('details'); samples.className = 'dr-samples'; const summary = document.createElement('summary'); summary.className = 'btn btn--glass'; summary.textContent = t('Sample controls'); samples.append(summary,actions); stage.append(samples);
  let runtime: Runtime | undefined;
  let off: (() => void) | undefined;
  let framing: (() => void) | undefined;
  let generation = 0;
  let fingerprint = '';
  let disposed = false;
  const scale = (): void => {
    const artboard = canvas.querySelector<HTMLElement>('[data-design-width]');
    if (!artboard || !stage.clientWidth) return;
    const width = Number(artboard.dataset.designWidth), height = Number(artboard.dataset.designHeight);
    const factor = Math.max(.01, Math.min((stage.clientWidth - 32) / width, (stage.clientHeight - 96) / height, 1));
    canvas.parentElement!.style.width = `${width * factor}px`; canvas.parentElement!.style.height = `${height * factor}px`;
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`; canvas.style.transform = `scale(${factor})`;
  };
  const stop = (): void => { framing?.(); off?.(); runtime?.destroy(); framing = off = undefined; runtime = undefined; };
  const show = async (force = false): Promise<void> => {
    const draft = opts.draft(); (actions.querySelector('[data-sample="theme"]') as HTMLElement).hidden = !draft.choices.length; const key = JSON.stringify(draft);
    if (!force && runtime && key === fingerprint) { scale(); return; }
    const at = ++generation;
    opts.status(t('Preparing the reader preview…'));
    const compiled = opts.compiled || await prepareDesignTool(draft, opts.source, opts.host, {preview: true});
    if (at !== generation || disposed) return;
    const { renderInputs, syncInputs } = await import('./tool-inputs.ts');
    const tool = await loadTool(compiled.manifest.id, async path => {
      const file = compiled.files[path.slice(compiled.manifest.id.length + 1)];
      if (file === undefined) throw new Error('File unavailable');
      return typeof file === 'string' ? file : new TextDecoder().decode(file);
    }, {trustClass: 'sideloaded-consented'});
    const policy = designToolPolicy(draft);
    const samples = Object.fromEntries(Object.entries(history.values).filter(([id]) => draft.inputs.some(f => f.input.id === id)));
    const invalid = new Set(validateDesignValues(policy, samples).map(f => f.inputId));
    const initial = Object.fromEntries(Object.entries(samples).filter(([id]) => !invalid.has(id)));
    const next = await createInteractiveToolRuntime(tool, opts.host, Object.fromEntries(Object.entries(initial).map(([id,value])=>[id,designPreviewValue(draft,compiled.manifest.inputs,id,value,true)])) as Record<string, InputValue>);
    if (at !== generation || disposed) { next.destroy(); return; }
    if (next.hookErrors.length) { next.destroy(); throw new Error(next.hookErrors.map(e => e.message).join('\n')); }
    stop(); fingerprint = key;
    runtime = new Proxy(next, {get(target, property) {
      if (property !== 'setInput') return Reflect.get(target, property);
      return async (id: string, value: InputValue) => { history.edit(id, designPreviewValue(draft,compiled.manifest.inputs,id,value,false)); await target.setInput(id, value); };
    }});
    const currentRuntime = runtime;
    let previous = runtime.getModel();
    const render = (): void => {
      previous = syncInputs(controls, currentRuntime.getModel(), previous, currentRuntime, opts.host as WebToolHost, () => {}, tool.manifest.id);
      canvas.innerHTML = `<style>${scopeCss(tool.styles || '', `#${canvas.id}`)}</style>${currentRuntime.getHydrated()}`;
      scale(); const root = canvas.lastElementChild;
      void checkTextLayout(canvas, opts.host.text).then(check => {
        if (root !== canvas.lastElementChild || runtime !== currentRuntime) return;
        const fitted = [...canvas.querySelectorAll<HTMLElement>('[data-effective-size]')].filter(el => Number(el.dataset.effectiveSize) < Number(el.dataset.requestedSize) - .1);
        const sizes = fitted.map(el => `${draft.inputs.find(f => f.input.id === el.dataset.publicInput)?.input.label || t('Text')}: ${Number(el.dataset.requestedSize).toFixed(0)} → ${Number(el.dataset.effectiveSize).toFixed(1)} px`).join(' · ');
        opts.status(check.ok ? sizes || t('Preview uses the same tool recipients receive.') : check.issues[0]!);
      }).catch(error => { if (runtime === currentRuntime) opts.status(error.message); });
    };
    renderInputs(controls, runtime.getModel(), runtime, opts.host as WebToolHost, () => {}, tool.manifest.id);
    off = runtime.subscribe(render); render();
    if (hasFramingInputs(runtime.getModel())) framing = setupFramingOverlay({stageEl: stage, canvasEl: canvas, runtime});
    if (invalid.size) opts.status(t('Some retained samples exceed the updated rules. Reset samples or correct the marked fields.'));
    const { restoreDesignInputErrors } = await import('../lib/design-tool-input-errors.ts');
    await restoreDesignInputErrors(runtime, controls, Object.fromEntries(Object.entries(samples).filter(([id]) => invalid.has(id))));
  };
  actions.addEventListener('click', event => {
    const action = (event.target as Element).closest<HTMLElement>('[data-sample]')?.dataset.sample;
    if (action === 'reset') { history.replace({}); void show(true).catch(error => opts.status(error.message)); }
    if (action === 'theme') { const choices = new Set(opts.draft().choices.map(c=>c.inputId)); history.replace(Object.fromEntries(Object.entries(history.values).filter(([id])=>choices.has(id)))); void show(true).catch(error=>opts.status(error.message)); }
    if (action === 'limits') showDesignSamples(opts.draft(),opts.host,(id,value)=>{history.edit(id,value);void show(true).catch(error=>opts.status(error.message));});
    if (action === 'defaults' && runtime) {
      const draft = opts.draft(); const issues = validateDesignValues(designToolPolicy(draft), history.values, true);
      if (issues.length) { opts.status(issues[0]!.message); return; }
      const selection = designSelection(designToolPolicy(draft), history.values);
      opts.defaults(Object.fromEntries(Object.entries(history.values).filter(([id]) => !selection.fixed.has(id))));
      opts.status(t('Sample values saved as defaults.'));
    }
  });
  const toggle = (): void => { opts.root.classList.toggle('is-inputs-open'); if (opts.root.classList.contains('is-inputs-open')) controls.querySelector<HTMLElement>('input,textarea,select,button')?.focus(); scale(); };
  done.addEventListener('click', () => { opts.root.classList.remove('is-inputs-open'); scale(); opts.root.querySelector<HTMLElement>('.dr-edit-inputs')?.focus(); });
  opts.root.querySelector('.dr-edit-inputs')!.addEventListener('click', toggle);
  canvas.addEventListener('click', event => {
    const id = (event.target as Element).closest<HTMLElement>('[data-public-input]')?.dataset.publicInput;
    if (!id) return;
    opts.root.classList.add('is-inputs-open'); controls.querySelector<HTMLElement>(`[data-input-id="${CSS.escape(id)}"]`)?.focus(); scale();
  });
  const resize = new ResizeObserver(scale); resize.observe(opts.root);
  return {show, scale, undo(redo = false) { if (history.undo(redo)) void show(true).catch(error => opts.status(error.message)); },
    cancel() { generation++; }, destroy() { disposed = true; generation++; stop(); resize.disconnect(); samples.remove(); }};
}
