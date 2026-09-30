// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { validateDesignTool, type DesignToolDraftV1 } from '@lolly-tools/core/design-tool-v1';
import type { Runtime } from '../../../../engine/src/runtime.ts';
import type { DesignCanvasPorts } from './design-ports.ts';
import { mountRulesSelection } from './design-rules-selection.ts';
import { mountRulesPreview } from './design-rules-preview.ts';
import { addArtboardChoice, designVariants, getDesignToolDraft, makeDesignInput, newDesignToolDraft, setDesignToolDraft } from '../lib/design-tool-draft.ts';
import { reviewMatchingObjects } from './design-rules-matches.ts';
import { createRulesRecovery } from './design-rules-recovery.ts';
import { createRulesShare } from './design-rules-share.ts';
import { checkDesignToolSource, getDesignToolSource, rememberDesignToolSource } from '../lib/design-tool-source.ts';
import { clearDesignPublication } from '../lib/design-tool-publication.ts';
import { editJoinedName, editDesignChoice, addApprovedProperty } from './design-rules-options.ts';
import { designRulesFields, editDesignRule } from './design-rules-fields.ts';
import { wireReorderList } from '../components/reorder-list.ts';
import { mountModal } from '../components/modal.ts';
import { announce } from '../a11y.ts';
import { t } from '../i18n.ts';
import '../styles/parts/design-rules.css';
import { registerRulesEditor } from '../lib/rules-launch.ts';
import { mountRulesWorkspace } from './design-rules-workspace.ts';

export interface DesignRulesHandle { open(): void; expose(property?: 'text' | 'image' | 'fg' | 'fill'): void; rememberSource(file: File): Promise<void>; key(event: KeyboardEvent): boolean; destroy(): void }
export interface DesignRulesOptions {
  ports: DesignCanvasPorts; runtime: Runtime; host: HostV1;
  view: HTMLElement; stage: HTMLElement; canvas: HTMLElement;
  size(): { width: number; height: number };
  workspace?: { fit(): void; preserve(): (() => void) | undefined };
  dirty(): void;
  saveMaster(): void;
}

export function mountDesignRules(opts: DesignRulesOptions): DesignRulesHandle {
  let mode: 'design' | 'rules' | 'preview' = 'design';
  let draft: DesignToolDraftV1 | undefined;
  let busy = false;
  const parkedChrome = new Map<HTMLElement, { display: string; inert: boolean }>();
  const parkChrome = (park: boolean): void => {
    if (park) for (const element of [
      ...document.querySelectorAll<HTMLElement>('.edge-dock'),
      ...opts.view.querySelectorAll<HTMLElement>('.design-compact-actions,.design-topbar,.fc-toolbar-dock,.fc-nav,.fc-insp,.fc-overlay,.tl-panel,.stage-zoom'),
    ]) {
      if (!parkedChrome.has(element)) parkedChrome.set(element, { display: element.style.display, inert: element.inert });
      element.style.display = 'none'; element.inert = true;
    }
    else { for (const [element, state] of parkedChrome) { element.style.display = state.display; element.inert = state.inert; } parkedChrome.clear(); }
  };
  const undo: DesignToolDraftV1[] = [];
  const redo: DesignToolDraftV1[] = [];
  const toolbar = document.createElement('div');
  toolbar.className = 'dr-toolbar surface surface--floating';
  toolbar.hidden = true;
  toolbar.innerHTML = `<div class="dr-modes" role="group" aria-label="${t('Design workflow')}"><button class="btn btn--ghost" data-mode="design">${t('Design')}</button><button class="btn btn--ghost" data-mode="rules">${t('Rules')}</button><button class="btn btn--ghost" data-mode="preview">${t('Preview')}</button></div><button class="btn btn--primary" data-share>${t('Share .lolly')}</button>`;
  const panel = document.createElement('aside');
  panel.className = 'dr-panel surface surface--floating';
  panel.setAttribute('aria-label', t('Tool inputs'));
  panel.hidden = true;
  panel.innerHTML = `<header><div><h2>${t('Inputs')}</h2><p>${t('Share your design with your rules.')}</p></div></header><div class="dr-panel-scroll"><div class="dr-presentation"><label>${t('People edit with')}<select class="field-select" data-presentation><option value="sidebar">${t('Sidebar')}</option><option value="on-canvas">${t('On-canvas')}</option></select></label></div><button class="btn btn--ghost" data-original hidden>${t('Compare with source')}</button><div class="dr-row-actions"><button class="btn btn--ghost btn--sm" data-find>${t('Find content')}</button><button class="btn btn--ghost btn--sm" data-areas aria-pressed="true">${t('Editable areas')}</button><button class="btn btn--ghost btn--sm" data-help>${t('Shortcuts')}</button></div><details class="dr-advanced"><summary>${t('Source and fonts')}</summary><button class="btn btn--ghost btn--sm" data-fonts>${t('Review fonts')}</button><button class="btn btn--ghost btn--sm" data-design-system>${t('Apply design system')}</button><button class="btn btn--ghost btn--sm" data-replace-source>${t('Replace source file')}</button></details><div class="dr-selection"><span data-selection-label></span><button class="btn btn--primary" data-editable>${t('Make editable')}</button><small>${t('Shift E')}</small><button class="btn btn--ghost" data-replace-text hidden>${t('Replace selected artwork with text')}</button></div><div data-inputs></div><button class="btn btn--ghost" data-choice>${t('Add choice')}</button><button class="btn btn--ghost" data-layout>${t('Add layout choice')}</button></div><p class="dr-status" role="status" aria-live="polite"></p>`;
  const preview = document.createElement('div');
  preview.className = 'dr-preview';
  preview.hidden = true;
  preview.innerHTML = `<div class="dr-preview-controls tool-panel"></div><div class="dr-preview-stage"><button class="btn btn--glass dr-edit-inputs" type="button">${t('Edit inputs')}</button><p class="dr-preview-status" role="status" aria-live="polite"></p><div class="dr-preview-scale"><div id="design-rules-preview-canvas" data-rules-preview-canvas></div></div></div>`;
  opts.view.append(toolbar, panel);
  opts.stage.append(preview);
  const workspace = mountRulesWorkspace({ stage: opts.stage, panel, toolbar, navigation: opts.workspace });
  const collapse = document.createElement('button');
  collapse.type = 'button'; collapse.className = 'btn btn--ghost dr-panel-toggle';
  collapse.textContent = t('Hide inputs'); collapse.setAttribute('aria-expanded', 'true');
  collapse.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('is-collapsed');
    collapse.textContent = t(collapsed ? 'Show inputs' : 'Hide inputs');
    collapse.setAttribute('aria-expanded', String(!collapsed)); workspace.refresh();
  });
  panel.querySelector('header')!.append(collapse);
  const scroll = panel.querySelector('.dr-panel-scroll')!;
  const setup = document.createElement('details'); setup.className = 'dr-advanced dr-setup';
  const summary = document.createElement('summary'); summary.textContent = t('Tool setup'); setup.append(summary);
  for (const element of panel.querySelectorAll('.dr-presentation,[data-original],.dr-row-actions,.dr-panel-scroll > .dr-advanced')) setup.append(element);
  scroll.append(setup);
  const list = panel.querySelector<HTMLElement>('[data-inputs]')!;
  const status = panel.querySelector<HTMLElement>('.dr-status')!;
  const statusText = (message: string): void => { status.textContent = message; preview.querySelector('.dr-preview-status')!.textContent = message; };
  const checkSource = (): void => {
    checkDesignToolSource(opts.runtime);
    if (String(opts.runtime.getModel().find(i => i.id === 'customCss')?.value || '').trim()) throw new Error(t('This design uses custom CSS. Apply those styles to its objects before sharing a tool.'));
  };
  const variants = () => {
    const size = opts.size();
    return designVariants(opts.ports.model.getBoxes(), size.width, size.height, opts.runtime.getModel().find(i => i.id === 'transparentBg')?.value === true ? 'transparent' : String(opts.runtime.getModel().find(i => i.id === 'background')?.value || '#ffffff'),opts.runtime.getModel().find(i=>i.id==='textDocument')?.value);
  };
  const save = (): void => {
    if (!draft) return;
    setDesignToolDraft(opts.runtime, draft);
    opts.dirty();
  };
  const change = (fn: () => void): void => {
    if (!draft) return;
    undo.push(structuredClone(draft)); redo.length = 0;
    fn(); save();
  };
  const paintList = (): void => {
    if (!draft) return;
    const open = [...list.querySelectorAll<HTMLDetailsElement>('details.dr-input[open]')].map(el => el.dataset.field);
    const advanced = [...list.querySelectorAll<HTMLDetailsElement>('details.dr-advanced[open]')].map(el=>el.closest<HTMLElement>('[data-field]')?.dataset.field);
    const focused=document.activeElement instanceof HTMLElement && list.contains(document.activeElement) ? document.activeElement : undefined;
    const focusField=focused?.closest<HTMLElement>('[data-field]')?.dataset.field; const focusRule=focused?.dataset.rule;
    list.innerHTML = designRulesFields(draft);
    for (const detail of list.querySelectorAll<HTMLDetailsElement>('details.dr-input')) {if (open.includes(detail.dataset.field)) detail.open = true; if(advanced.includes(detail.dataset.field)) {const more=detail.querySelector<HTMLDetailsElement>('.dr-advanced');if(more)more.open=true;}}
    if(focusField&&focusRule)list.querySelector<HTMLElement>(`[data-field="${CSS.escape(focusField)}"] [data-rule="${CSS.escape(focusRule)}"]`)?.focus();
    (panel.querySelector('[data-presentation]') as HTMLSelectElement).value = draft.presentation;
    selection?.paint();
    (panel.querySelector('[data-layout]') as HTMLButtonElement).hidden = draft.variants.length < 2 || draft.choices.some(c => c.options.some(o => o.variantId));
  };
  const selection = mountRulesSelection({canvas:opts.canvas,stage:opts.stage,ports:opts.ports,active:()=>mode === 'rules',draft:()=>draft});
  const updateSelection = (): void => {
    selection.paint();
    const ids = opts.ports.selection.get();
    for (const box of opts.canvas.querySelectorAll<HTMLElement>('[data-box-id]')) box.classList.toggle('dr-selected', mode === 'rules' && ids.includes(box.dataset.boxId!));
    (panel.querySelector('[data-original]') as HTMLButtonElement).hidden = !getDesignToolSource(opts.runtime);
    const selected = opts.ports.model.getBoxes().filter(b => ids.includes(String(b.id)) && (b.kind === 'text' || b.text || b.image));
    panel.querySelector('[data-selection-label]')!.textContent = ids.length ? t('{n} selected', { n: ids.length }) : t('Select text or an image');
    (panel.querySelector('[data-editable]') as HTMLButtonElement).disabled = !selected.length;
    const texts = selected.filter(b => b.kind === 'text' || b.text);
    const repair = panel.querySelector<HTMLButtonElement>('[data-replace-text]')!;
    repair.hidden = !ids.length || texts.length === 1 || opts.ports.model.getBoxes().some(b => ids.includes(String(b.id)) && b.kind === 'frame');
    repair.textContent = t(texts.length > 1 ? 'Combine as text' : 'Replace selected artwork with text');
  };
  const editable = (property?: 'text' | 'image' | 'fg' | 'fill'): void => {
    if (!draft) return;
    let id = '';
    change(() => {
      for (const layerId of opts.ports.selection.get()) {
        const b = opts.ports.model.getBoxes().find(b => b.id === layerId);
        if (b && (property || b.kind === 'text' || b.text || b.image)) id = makeDesignInput(draft!, layerId, property || (b.kind === 'text' || b.text ? 'text' : 'image'))?.input.id || id;
      }
    });
    paintList();
    const row = [...list.querySelectorAll<HTMLDetailsElement>('[data-field]')].find(el => el.dataset.field === id);
    if (row) {
      panel.classList.remove('is-collapsed'); collapse.textContent = t('Hide inputs'); collapse.setAttribute('aria-expanded', 'true');
      row.open = true; row.querySelector<HTMLElement>('[data-rule="label"]')?.focus({ preventScroll: true });
      row.scrollIntoView({ block: 'nearest' }); workspace.refresh();
    }
  };
  const reader = mountRulesPreview({root: preview, source: opts.canvas, host: opts.host,
    draft: () => draft!, status: statusText,
    defaults(values) { change(() => { for (const field of draft!.inputs) if (Object.hasOwn(values, field.input.id)) field.input.default = values[field.input.id]; }); paintList(); },
  });
  const showPreview = async (): Promise<void> => {
    if (!draft || busy) return;
    busy = true;
    try {
      checkSource();
      if (mode === 'design') { draft.variants = variants(); save(); }
      mode = 'preview'; toolbar.classList.remove('is-design-mode'); preview.hidden = false; panel.hidden = true; parkChrome(true);
      preview.classList.toggle('is-on-canvas', draft.presentation === 'on-canvas');
      opts.view.classList.add('is-design-rules-preview');
      document.body.classList.add('design-rules-active'); updateModes();
      workspace.set(true);
      await reader.show();
    } catch (error) { statusText((error as Error).message); announce((error as Error).message, {assertive:true}); }
    finally { busy = false; }
  };
  const updateModes = (): void => {
    for (const button of toolbar.querySelectorAll<HTMLButtonElement>('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  };
  const setMode = (next: 'design' | 'rules' | 'preview'): void => {
    if (next === 'preview') { void showPreview(); return; }
    parkChrome(next !== 'design');
    if (mode === 'design' && next === 'rules' && draft) { draft.variants = variants(); save(); }
    reader.cancel(); mode = next; preview.hidden = true;
    panel.hidden = next !== 'rules'; toolbar.hidden = false; toolbar.classList.toggle('is-design-mode', next === 'design');
    opts.view.classList.toggle('is-design-rules', next === 'rules');
    document.body.classList.toggle('design-rules-active', next === 'rules');
    opts.view.classList.remove('is-design-rules-preview');
    workspace.set(next === 'rules');
    if (next === 'rules') paintList();
    updateSelection();
    updateModes();
  };
  const open = (name?:string): void => {
    const saved = getDesignToolDraft(opts.runtime);
    draft = saved ? structuredClone(saved) : newDesignToolDraft(variants(), getDesignToolSource(opts.runtime)?.name.replace(/\.[^.]+$/, '') || 'Untitled tool');
    draft.variants = variants();
    if(name)draft.name=name;
    save(); setMode('rules');
  };
  const unregisterEditor=registerRulesEditor(opts.runtime,open);
  const recovery = createRulesRecovery({runtime:opts.runtime,host:opts.host,canvas:opts.canvas,ports:opts.ports,draft:()=>draft!,status:statusText,sourceChanged:opts.dirty,
    commit(boxes,next) {setMode('design');opts.ports.model.commit(boxes);change(()=>{draft=next;});statusText(t('Artwork updated. Review it in Design, then return to Rules.'));},
  });
  const sharing = createRulesShare({runtime:opts.runtime,host:opts.host,canvas:opts.canvas,draft:()=>draft!,checkSource,status:statusText,saveMaster:opts.saveMaster,
    commit(next) {change(()=>{draft=next;});paintList();},
    repair(issue) {
      setMode('rules');
      if (issue.layerId) opts.ports.selection.set([issue.layerId]);
      const row = [...list.querySelectorAll<HTMLDetailsElement>('[data-field]')].find(el=>el.dataset.field === issue.inputId);
      if (row) {row.open=true;row.scrollIntoView({block:'nearest'});row.querySelector<HTMLElement>('input,textarea,select')?.focus();}
      statusText(issue.message);
      if (issue.code === 'source-review') void recovery.compare().catch(error=>statusText(error.message));
      else if (/font/i.test(issue.message)) recovery.fonts(issue.layerId);
      else if (issue.layerId && /image/i.test(issue.message)) recovery.image(issue.layerId);
    },
  });
  toolbar.addEventListener('click', event => {
    const target = (event.target as Element).closest<HTMLElement>('button');
    if (target?.dataset.mode) setMode(target.dataset.mode as typeof mode);
    else if (target?.hasAttribute('data-share')) sharing.open();
  });
  panel.querySelector('[data-find]')!.addEventListener('click', selection.find);
  panel.querySelector('[data-help]')!.addEventListener('click', selection.help);
  panel.querySelector('[data-areas]')!.addEventListener('click', event => { (event.currentTarget as HTMLElement).setAttribute('aria-pressed',String(selection.toggle())); });
  panel.querySelector('[data-original]')!.addEventListener('click', () => {void recovery.compare().catch(error=>statusText(error.message));});
  panel.querySelector('[data-fonts]')!.addEventListener('click', () => recovery.fonts());
  panel.querySelector('[data-design-system]')!.addEventListener('click', () => recovery.fonts(undefined,true));
  panel.querySelector('[data-replace-source]')!.addEventListener('click', recovery.replace);
  panel.querySelector('[data-replace-text]')!.addEventListener('click', () => {
    const ids = opts.ports.selection.get();
    const selected = opts.ports.model.getBoxes().filter(b => ids.includes(String(b.id)));
    const combine = selected.length > 1 && selected.every(b => b.kind === 'text' || b.text);
    if (combine && (new Set(selected.map(b => b.frame)).size > 1 || selected.some(b => Number(b.rot)))) { statusText(t('Combine unrotated text within one artboard. Review other text in Design.')); return; }
    const title = combine ? 'Combine as text' : 'Replace artwork with text';
    const note = combine ? 'Review the assembled text. The selected objects will become one text box using the first object’s style. Check mixed styles and line breaks in Design before making it editable.' : 'The selected objects will be removed and replaced with one text box. For a flattened page, prepare a clean background in your original design app first. Lolly cannot remove words baked into an image.';
    const m = mountModal(`<h2>${t(title)}</h2><p>${t(note)}</p><label class="dr-field">${t('New text')}<textarea class="field-input" rows="3" data-replacement></textarea></label><footer><button class="btn" data-cancel>${t('Cancel')}</button><button class="btn btn--primary" data-replace>${t('Replace in Design')}</button></footer>`, {className:'modal dr-share',ariaLabel:t(title)});
    if (combine) {
      selected.sort((a,b) => Math.abs(Number(a.y) - Number(b.y)) > Number(a.fontSize || 16) * 0.6 ? Number(a.y) - Number(b.y) : Number(a.x) - Number(b.x));
      (m.el.querySelector('[data-replacement]') as HTMLTextAreaElement).value = selected.map((b,i) => {
        const before = selected[i-1]; const gap = before ? Number(b.x) - Number(before.x) - Number(before.w) : 0;
        const separator = !before ? '' : Math.abs(Number(b.y) - Number(before.y)) > Number(b.fontSize || 16) * 0.6 ? '\n' : gap > Number(b.fontSize || 16) * 0.15 ? ' ' : '';
        return separator + String(b.text || '');
      }).join('');
    }
    m.el.querySelector('[data-cancel]')!.addEventListener('click', () => m.close());
    m.el.querySelector('[data-replace]')!.addEventListener('click', () => {
      if (!selected.length) return;
      const text = (m.el.querySelector('[data-replacement]') as HTMLTextAreaElement).value;
      const first = selected[0]!; const x = Math.min(...selected.map(b => Number(b.x) || 0)); const y = Math.min(...selected.map(b => Number(b.y) || 0));
      const w = Math.max(...selected.map(b => Number(b.x || 0) + Number(b.w || 100))) - x;
      const h = Math.max(...selected.map(b => Number(b.y || 0) + Number(b.h || 50))) - y;
      setMode('design');
      opts.ports.model.commit([...opts.ports.model.getBoxes().filter(b => !ids.includes(String(b.id))), {...(combine ? first : {font:'sans',fontSize:Math.min(48,h)}),id:crypto.randomUUID(),kind:'text',name:'Replacement text',text,x,y,w,h,frame:first.frame,plainText:true}]);
      m.close(); announce(t('Artwork replaced. Review the font and spacing in Design. Undo restores the original objects.'));
    });
  });
  panel.querySelector('[data-editable]')!.addEventListener('click', () => editable());
  const commitDraft = (next: DesignToolDraftV1): void => { change(() => { draft = next; }); paintList(); };
  panel.querySelector('[data-choice]')!.addEventListener('click', () => { if (draft) editDesignChoice(draft, opts.ports.selection.get(), opts.host, commitDraft, undefined, ids=>opts.ports.selection.set(ids)); });
  panel.querySelector('[data-layout]')!.addEventListener('click', () => { change(() => addArtboardChoice(draft!)); paintList(); });
  panel.querySelector('[data-presentation]')!.addEventListener('change', event => { change(() => { draft!.presentation = (event.target as HTMLSelectElement).value as DesignToolDraftV1['presentation']; }); });
  list.addEventListener('change', event => {
    const control = event.target as HTMLInputElement;
    const id = control.closest<HTMLElement>('[data-field]')?.dataset.field;
    const field = draft?.inputs.find(f => f.input.id === id);
    if (!field || !control.dataset.rule) return;
    change(() => editDesignRule(field, control.dataset.rule!, control.type === 'checkbox' ? control.checked : control.value));
    if (control.dataset.rule === 'label') control.closest('[data-field]')!.querySelector('summary strong')!.textContent = String(field.input.label);
    const issues = validateDesignTool(draft!).filter(issue => issue.inputId === id);
    control.setAttribute('aria-invalid', String(issues.length > 0));
    control.closest('[data-field]')!.querySelector('.dr-field-error')!.textContent = issues.map(issue => issue.message).join(' ');
    if (['common', 'source', 'subject', 'control'].includes(control.dataset.rule)) paintList();
  });
  list.addEventListener('focusin', event => { const id = (event.target as Element).closest<HTMLElement>('[data-field]')?.dataset.field; const field = draft?.inputs.find(f => f.input.id === id); if (field) {const ids=[...field.targets.map(t=>t.layerId),...draft!.recipes.filter(r=>r.parts.some(p=>'inputId' in p&&p.inputId===id)).map(r=>r.target.layerId)];for(const el of opts.canvas.querySelectorAll<HTMLElement>('[data-box-id]'))el.classList.toggle('dr-affected',ids.includes(el.dataset.boxId!));} });
  list.addEventListener('keydown', event => {
    const target = event.target as HTMLInputElement;
    const row = target.closest<HTMLDetailsElement>('[data-field]');
    if (event.key === 'F2' && row) { event.preventDefault(); event.stopPropagation(); row.open = true; row.querySelector<HTMLInputElement>('[data-rule="label"]')?.select(); }
    if (target.dataset.rule === 'label' && ['Enter','Escape'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      if (event.key === 'Escape') target.value = String(draft?.inputs.find(f => f.input.id === row?.dataset.field)?.input.label || '');
      target.blur(); row?.querySelector<HTMLElement>('summary')?.focus();
    }
  });
  const move = (from: number, to: number): void => { change(() => { draft!.inputs.splice(to, 0, draft!.inputs.splice(from, 1)[0]!); }); paintList(); };
  const disposeReorder = wireReorderList(list, move, message => announce(t(message)));
  list.addEventListener('click', event => {
    const target = (event.target as Element).closest<HTMLElement>('[data-act]');
    const id = target?.closest<HTMLElement>('[data-field]')?.dataset.field;
    const index = draft?.inputs.findIndex(f => f.input.id === id) ?? -1;
    if (!target || !draft || index < 0) return;
    const f = draft.inputs[index]!;
    const action = target.dataset.act;
    if (action === 'matches') {reviewMatchingObjects(draft,id!,commitDraft);return;}
    if (action === 'target') { const targetRule = f.targets[Number(target.dataset.target)]; if (targetRule) { opts.ports.selection.set([targetRule.layerId]); opts.ports.artboard.focus(targetRule.variantId); } return; }
    if (action === 'unlink') { change(() => { f.targets.splice(Number(target.dataset.target),1); }); paintList(); updateSelection(); return; }
    if (action === 'join') { editJoinedName(draft, id!, commitDraft); return; }
    if (action === 'choice') { editDesignChoice(draft, opts.ports.selection.get(), opts.host, commitDraft, id, ids=>opts.ports.selection.set(ids)); return; }
    if (action?.startsWith('approved-')) { void addApprovedProperty(draft, id!, action.slice(9) as 'font' | 'weight' | 'fg' | 'image' | 'text' | 'options', opts.host, commitDraft).catch(err => statusText(String(err.message))); return; }
    if (action === 'up' || action === 'down') { move(index, index + (action === 'up' ? -1 : 1)); return; }
    change(() => {
      if (action === 'free') {
        const property = f.targets[0]?.property;
        if (property === 'text' || property === 'fg' || property === 'fill') {
          f.input.type = property === 'text' ? String(f.input.default).includes('\n') ? 'longtext' : 'text' : 'color';
          delete f.input.options; delete f.approved;
        }
      }
      if (action === 'remove') { draft!.inputs.splice(index, 1); draft!.choices = draft!.choices.filter(c => c.inputId !== id); draft!.recipes = draft!.recipes.filter(r => !r.parts.some(p => 'inputId' in p && p.inputId === id)); }
      if (action === 'link') for (const layerId of opts.ports.selection.get()) {
        const variant = draft!.variants.find(v => v.boxes.some(b => b.id === layerId));
        const property = f.targets[0]?.property;
        if (variant && property && !f.targets.some(t => t.layerId === layerId)) {
          const size = Number(variant.boxes.find(b => b.id === layerId)?.fontSize) || f.text?.max || 32;
          f.targets.push({ variantId:variant.id,layerId,property,...(f.text ? {text:{...f.text,min:size,max:size}} : {}) });
        }
      }
      if (action === 'font-size' && f.text && !draft!.inputs.some(g => g.input.id === `${id}FontSize`)) draft!.inputs.splice(index + 1, 0, {
        input: { id: `${id}FontSize`, label: `${f.input.label} size`, type: 'number', default: f.text.max, min: f.text.min, max: f.text.max, step: 1, unit: 'px', display: 'slider' }, targets: f.targets.map(t => ({ ...t, property: 'fontSize' })),
      });
      if (action === 'image-fit' && !draft!.inputs.some(g => g.input.id === `${id}Fit`)) draft!.inputs.splice(index + 1, 0, {
        input: { id: `${id}Fit`, label: `${f.input.label} fit`, type: 'select', default: 'cover', options: [{value:'cover',label:'Fill frame'},{value:'contain',label:'Fit inside'}], attachTo: id }, targets: f.targets.map(t => ({ ...t, property: 'fit' })),
      });
      if (action === 'framing' && !draft!.inputs.some(g => g.input.id === `${id}Framing`)) {
        const target = f.targets[0]; const box = draft!.variants.find(v=>v.id===target?.variantId)?.boxes.find(b=>b.id===target?.layerId);
        const initial = {x:50,y:50,zoom:100,...box?.imageFraming as object};
        draft!.inputs.splice(index + 1, 0, {
          input: {id:`${id}Framing`,label:`${f.input.label} position`,type:'vector',framingFor:id,default:initial,fields:[{id:'x',label:'Horizontal %',min:0,max:100,step:1,default:initial.x},{id:'y',label:'Vertical %',min:0,max:100,step:1,default:initial.y},{id:'zoom',label:'Zoom %',min:100,max:Math.max(300,initial.zoom),step:1,default:initial.zoom}]},
          targets:f.targets.map(t=>({...t,property:'imageFraming'})),
        });
      }
    }); paintList();
  });
  const offSelection = opts.ports.selection.onChange(updateSelection);
  const handle: DesignRulesHandle = {
    open,
    expose(property) { open(); editable(property); },
    async rememberSource(file) {
      await rememberDesignToolSource(opts.runtime, file);
      draft = newDesignToolDraft(variants(), file.name.replace(/\.[^.]+$/, '') || 'Untitled tool');
      undo.length = redo.length = 0;
      clearDesignPublication(opts.runtime); save(); updateSelection();
    },
    key(event) {
      if (event.defaultPrevented) return true;
      if (mode === 'design' || event.isComposing || document.querySelector('dialog[open]') || (event.target as Element)?.closest('input,textarea,select,[contenteditable="true"]')) return false;
      const command = event.metaKey || event.ctrlKey;
      if (!command && event.shiftKey && event.key.toLowerCase() === 'e' && mode === 'rules') { if (!event.repeat) editable(); }
      else if (!command && event.shiftKey && event.key.toLowerCase() === 'p') { if (!event.repeat) setMode(mode === 'preview' ? 'rules' : 'preview'); }
      else if (mode === 'rules' && command && event.key.toLowerCase() === 'f') selection.find();
      else if (mode === 'rules' && event.shiftKey && event.key.toLowerCase() === 'h') selection.toggle();
      else if (mode === 'rules' && event.key === '?') selection.help();
      else if (event.key === 'Escape') { const samples = preview.querySelector<HTMLDetailsElement>('.dr-samples[open]'); if (samples) samples.open = false; else if (mode === 'preview') setMode('rules'); else opts.ports.selection.set([]); }
      else if (command && event.key.toLowerCase() === 'z' && mode === 'preview') reader.undo(event.shiftKey);
      else if (command && event.key.toLowerCase() === 'z') {
        const source = event.shiftKey ? redo : undo; const target = event.shiftKey ? undo : redo;
        if (source.length && draft) { target.push(structuredClone(draft)); draft = source.pop()!; save(); paintList(); }
      } else if (command && ['s','e','enter'].includes(event.key.toLowerCase())) return false;
      else if (['0','1','+','-','=','?'].includes(event.key)) return false;
      else if (event.key === 'Tab' || event.key === ' ' || ['ArrowUp', 'ArrowDown'].includes(event.key) && (event.target as Element)?.closest('[data-reorder-handle]')) return false;
      else return true;
      event.preventDefault(); event.stopPropagation(); return true;
    },
    destroy() { unregisterEditor(); document.removeEventListener('keydown',handle.key); parkChrome(false); workspace.destroy(); reader.destroy(); sharing.destroy(); offSelection(); disposeReorder(); selection.destroy(); toolbar.remove(); panel.remove(); preview.remove(); opts.view.classList.remove('is-design-rules', 'is-design-rules-preview'); document.body.classList.remove('design-rules-active'); },
  };
  document.addEventListener('keydown',handle.key);
  return handle;
}
