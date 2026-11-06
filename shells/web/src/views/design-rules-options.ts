// SPDX-License-Identifier: MPL-2.0
/** Small rule editors. Changes are committed once when the designer chooses Done. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { validateDesignTool, type DesignToolDraftV1, type DesignPropertyV1, type DesignChoiceV1 } from '@lolly-tools/core/design-tool-v1';
import { mountModal } from '../components/modal.ts';
import { wireReorderList } from '../components/reorder-list.ts';
import { announce } from '../a11y.ts';
import { t } from '../i18n.ts';
import { captureDesignOption } from '../lib/design-tool-preflight.ts';
import { colourFieldOptions } from '../lib/colour-role-swatches.ts';
import { SVG, icon } from './free-canvas-icons.ts';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag); el.textContent = t(text); el.className = className; return el;
}
function button(label: string, action: () => void): HTMLButtonElement {
  const el = element('button', label, 'btn btn--sm'); el.type = 'button'; el.addEventListener('click', action); return el;
}
function textField(label: string, value: string, change: (value: string) => void): HTMLElement {
  const wrap = element('label', label, 'dr-field'); const input = element('input', '', 'field-input'); input.value = value; input.addEventListener('change', () => change(input.value)); wrap.append(input); return wrap;
}
function selectField(label: string, value: string, options: Array<{value:string;label:string}>, change: (value:string) => void): HTMLElement {
  const wrap = element('label', label, 'dr-field'); const select = element('select', '', 'field-select');
  for (const o of options) { const el = element('option', o.label); el.value = o.value; select.append(el); }
  select.value = value; select.addEventListener('change', () => change(select.value)); wrap.append(select); return wrap;
}
function editor(title: string, commit: () => string | undefined) {
  const modal = mountModal('', { className: 'modal dr-share dr-rule-editor', ariaLabel: t(title) });
  const header = element('header'); header.append(element('h2', title));
  const body = element('div', '', 'dr-rule-editor-body'); const status = element('p'); status.setAttribute('role', 'status');
  const footer = element('footer'); footer.append(button('Cancel', () => modal.close()), button('Done', () => { const issue = commit(); if (issue) status.textContent = issue; else modal.close(); })); footer.lastElementChild!.classList.add('btn--primary');
  modal.el.append(header, body, status, footer); return { ...modal, body, status };
}
function uniqueId(d: DesignToolDraftV1, prefix: string): string { let id = prefix; while (d.inputs.some(f => f.input.id === id)) id += '2'; return id; }

export function editJoinedName(draft: DesignToolDraftV1, fieldId: string, commit: (next: DesignToolDraftV1) => void): void {
  const f = draft.inputs.find(f => f.input.id === fieldId)!;
  const targets = f.targets.filter(t => t.property === 'text'); if (!targets.length) return;
  let order = 'first'; let separator = ' '; let subject: 'person' | 'recipient' | 'presenter' = ['recipient','presenter'].includes(f.common?.subject || '') ? f.common!.subject as 'recipient'|'presenter' : 'person';
  const m = editor('Build text from inputs', () => {
    const d = structuredClone(draft);
    const names = ['firstname', 'lastname'] as const;
    const ids = names.map((key, index) => {
      const existing = d.inputs.find(g => g.common?.key === key && g.common.subject === subject && g.input.id !== fieldId);
      if (existing) return existing.input.id;
      const id = uniqueId(d, key); d.inputs.push({ input: { id, label: index ? 'Last name' : 'First name', type: 'text', default: '', maxLength: f.input.maxLength || 100 }, targets: [], common: { key, subject, source: 'brief' } }); return id;
    });
    if (order === 'last') ids.reverse();
    d.inputs = d.inputs.filter(g => g.input.id !== fieldId);
    for (const target of targets) d.recipes.push({ target, parts: [{ inputId: ids[0]! }, { literal: separator }, { inputId: ids[1]! }], text: target.text || f.text });
    const issues = validateDesignTool(d); if (issues.length) return issues[0]!.message;
    commit(d); return undefined;
  });
  m.body.append(selectField('Person',subject,[{value:'person',label:'Shared person'},{value:'recipient',label:'Recipient'},{value:'presenter',label:'Presenter'}],value=>{subject=value as typeof subject;}),element('p', 'Use separate first and last names across your assets. Enter example values in the new fields; the original name is never split automatically.'), selectField('Order', order, [{value:'first',label:'First name, last name'},{value:'last',label:'Last name, first name'}], v => { order = v; }), textField('Separator', separator, v => { separator = v; }));
}

const propertyLabels: Record<DesignPropertyV1, string> = { text: 'Text', image: 'Image', fontSize: 'Font size (px)', font: 'Font', weight: 'Weight', fg: 'Text colour', fill: 'Fill colour', fit: 'Image fit', imageFraming: 'Image position' };
/** A choice owns exact properties, or supplies defaults to an existing public input. */
export function editDesignChoice(draft: DesignToolDraftV1, selection: string[], host: HostV1, commit: (next: DesignToolDraftV1) => void, choiceId?: string, highlight?: (ids: string[]) => void): void {
  const d = structuredClone(draft);
  let choice = d.choices.find(c => c.inputId === choiceId);
  if (!choice) {
    const id = uniqueId(d, 'theme');
    choice = { inputId: id, options: [{ value: 'option1', label: 'Option 1', writes: [] }] }; d.choices.push(choice);
    d.inputs.unshift({ input: { id, label: 'Theme', type: 'select', default: 'option1', options: [] }, targets: [] });
  }
  const c = choice; const input = d.inputs.find(f => f.input.id === c.inputId)!.input;
  let active = c.options[0]!; let stopReorder: (() => void) | undefined;
  const sync = (): void => { input.options = c.options.map(o => ({value:o.value,label:o.label})); if (!c.options.some(o => o.value === input.default)) input.default = c.options[0]?.value; };
  const m = editor('Edit choice', () => { sync(); const issues = validateDesignTool(d); if (issues.length) return issues[0]!.message; commit(d); });
  const controls = element('div', '', 'dr-input-body'); const options = element('div'); const changes = element('div', '', 'dr-input-body');
  m.body.append(textField('Choice label', String(input.label), v => { input.label = v; }), options, controls, changes);
  const valueControl = (label: string, property: DesignPropertyV1, value: unknown, update: (v:unknown) => void): HTMLElement => {
    if (property === 'image') {
      const wrap = element('div', '', 'dr-field'); wrap.append(element('span', label), button('Choose image', () => { void host.assets.pick({title:t('Choose approved image'),allowUpload:true,types:['raster','vector']}).then(ref => { if (ref) { update(ref); paint(); } }).catch(err => { m.status.textContent = String(err.message); }); }));
      if (value && typeof value === 'object' && 'url' in value) { const img = element('img'); img.className = 'dr-choice-thumb'; img.src = String(value.url); img.alt = label; wrap.prepend(img); } return wrap;
    }
    if (property === 'fit') return selectField(label, String(value), [{value:'cover',label:'Fill frame'},{value:'contain',label:'Fit inside'}], update);
    if (property === 'imageFraming') { const wrap = element('div', '', 'dr-pair'); const values = {x:50,y:50,zoom:100,...value as object}; for (const key of ['x','y','zoom'] as const) wrap.append(textField(key === 'zoom' ? 'Zoom %' : `${key.toUpperCase()} %`, String(values[key]), v => { values[key] = Number(v); update({...values}); })); return wrap; }
    return textField(label, String(value ?? ''), v => update(property === 'fontSize' || property === 'weight' ? Number(v) : v));
  };
  const paint = (): void => {
    stopReorder?.(); options.replaceChildren(); controls.replaceChildren(); changes.replaceChildren();
    for (const option of c.options) {
      const row = element('div', '', 'dr-option'); row.dataset.reorderRow = '';
      const grab = button('', () => {}); grab.append(document.importNode(new DOMParser().parseFromString(icon(SVG.grip).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '),'image/svg+xml').documentElement,true)); grab.dataset.reorderHandle = ''; grab.classList.add('dr-grab'); grab.setAttribute('aria-label', t('Move {name}', {name:option.label}));
      const count = validateDesignTool({...d,choices:d.choices.map(choice=>choice===c?{...choice,options:[option]}:choice)}).filter(issue=>issue.inputId===c.inputId).length;
      const choose = button(`${option.label}${count ? ` · ${count} ${t('issues')}` : ''}`, () => { active = option; paint(); }); choose.setAttribute('aria-pressed', String(option === active));
      if (option.thumbnail) { const thumbnail = element('img'); thumbnail.src = option.thumbnail; thumbnail.alt = ''; thumbnail.className = 'dr-option-thumb'; choose.prepend(thumbnail); }
      row.append(grab, choose); options.append(row);
    }
    stopReorder = wireReorderList(options, (from, to) => { c.options.splice(to, 0, c.options.splice(from, 1)[0]!); sync(); paint(); }, announce);
    controls.append(textField('Option name', active.label, v => { active.label = v; sync(); paint(); }), selectField('Artboard', active.variantId || '', [{value:'',label:'Keep current artboard'}, ...d.variants.map(v => ({value:v.id,label:v.label}))], v => { active.variantId = v || undefined; }), button('Duplicate option', () => { let id = `option${c.options.length + 1}`; while (c.options.some(o => o.value === id)) id += '2'; active = { ...structuredClone(active), value: id, label: `${active.label} copy` }; c.options.push(active); sync(); paint(); }));
    if (c.options.length > 1) controls.append(button('Remove option', () => { c.options.splice(c.options.indexOf(active), 1); active = c.options[0]!; sync(); paint(); }));
    const previewButton = button(active.thumbnail ? 'Update thumbnail' : 'Add preview thumbnail', () => {
      const canvas = document.querySelector<HTMLElement>('#tool-canvas'); if (!canvas) return;
      sync(); const option = active; previewButton.disabled = true; m.status.textContent = t('Rendering this option…');
      void captureDesignOption(d,{[c.inputId]:option.value},canvas,host).then(url => {
        if (!m.el.isConnected) return; option.thumbnail = url; m.status.textContent = ''; paint();
      }).catch(error => { if (m.el.isConnected) m.status.textContent = String(error.message); }).finally(() => { previewButton.disabled = false; });
    });
    const affected = [...new Set([...active.writes.map(w=>w.layerId),...Object.keys(active.defaults || {}).flatMap(id=>d.inputs.find(f=>f.input.id===id)?.targets.map(t=>t.layerId)||[])])];
    controls.append(previewButton,element('p', t('Editing option: {name}',{name:active.label})),element('p', t('{objects} objects · {inputs} input defaults',{objects:affected.length,inputs:Object.keys(active.defaults||{}).length})));
    if (affected.length && highlight) controls.append(button('Show affected objects',()=>highlight(affected)));
    const defaults = element('details', '', 'dr-advanced'); defaults.append(element('summary', 'Set input defaults'));
    for (const field of d.inputs.filter(f => f.input.id !== c.inputId && !d.choices.some(c => c.inputId === f.input.id))) {
      const id = field.input.id; const owned = active.fixedInputs?.includes(id); const mode = owned ? 'fixed' : Object.hasOwn(active.defaults || {}, id) ? 'default' : 'keep';
      defaults.append(selectField(String(field.input.label), mode, [{value:'keep',label:'Keep recipient content'},{value:'default',label:'Editable after choosing'},{value:'fixed',label:'Controlled by this choice'}], value => {
        active.fixedInputs = (active.fixedInputs || []).filter(k => k !== id); active.defaults ??= {}; delete active.defaults[id];
        active.writes = active.writes.filter(w => !field.targets.some(t => t.layerId === w.layerId && t.variantId === w.variantId && t.property === w.property));
        if (value === 'fixed') { active.fixedInputs.push(id); active.defaults[id] = field.input.default; active.writes.push(...field.targets.map(target => ({...target,value:field.input.default}))); }
        else if (value === 'default') active.defaults[id] = field.input.default;
        paint();
      }));
      if (mode !== 'keep') defaults.append(valueControl(mode === 'fixed' ? 'Fixed value' : 'Starting value', field.targets[0]?.property || 'text', active.defaults?.[id] ?? field.input.default, value => {
        active.defaults ??= {}; active.defaults[id] = value;
        if (mode === 'fixed') for (const write of active.writes) if (field.targets.some(t => t.variantId === write.variantId && t.layerId === write.layerId && t.property === write.property)) write.value = value;
      }));
    }
    controls.append(defaults);
    const selected = d.variants.flatMap(v => v.boxes.filter(b => selection.includes(String(b.id))).map(b => ({v,b})));
    if (selected.length) {
      const capture = element('details', '', 'dr-advanced'); capture.append(element('summary', 'Capture selected objects'));
      for (const property of ['image','fg','fill','font','weight','fontSize','fit','imageFraming'] as DesignPropertyV1[]) capture.append(button(propertyLabels[property], () => {
        for (const {v,b} of selected) if (b[property] !== undefined) {
          const target = {variantId:v.id,layerId:String(b.id),property};
          const field = d.inputs.find(f => f.targets.some(t => t.variantId === v.id && t.layerId === b.id && t.property === property));
          if (field) { active.fixedInputs ??= []; if (!active.fixedInputs.includes(field.input.id)) active.fixedInputs.push(field.input.id); }
          active.writes = active.writes.filter(w => !(w.variantId === v.id && w.layerId === b.id && w.property === property)); active.writes.push({...target,value:structuredClone(b[property])});
        } paint();
      })); controls.append(capture);
    }
    if (!active.writes.length) changes.append(element('p', 'Choose an artboard, set input defaults, or capture properties from selected objects.'));
    for (const write of active.writes) {
      const box = d.variants.find(v => v.id === write.variantId)?.boxes.find(b => b.id === write.layerId);
      const row = element('div', '', 'dr-input-body'); row.append(valueControl(`${String(box?.name || 'Object')}: ${propertyLabels[write.property]}`, write.property, write.value, value => { write.value = value; }), button('Remove change', () => { active.writes.splice(active.writes.indexOf(write), 1); paint(); })); changes.append(row);
    }
  };
  paint(); m.el.addEventListener('close', () => stopReorder?.(), {once:true});
}

export async function addApprovedProperty(draft: DesignToolDraftV1, fieldId: string, property: 'font' | 'weight' | 'fg' | 'image' | 'text' | 'options', host: HostV1, commit: (next: DesignToolDraftV1) => void): Promise<void> {
  const source = draft.inputs.find(f => f.input.id === fieldId)!;
  const options: Array<{value:string;label:string}> = [];
  const images = new Map<string, unknown>();
  const add = (value: string, label = value): void => { if (value && !options.some(o => o.value === value)) options.push({value,label}); };
  if (property === 'fg') for (const option of await colourFieldOptions(host, await host.tokens?.colors() || [])) add(option.value, option.label ?? undefined);
  if (property === 'weight') for (const n of ['400','500','600','700']) add(n);
  if (property === 'font') for (const variant of draft.variants) for (const b of variant.boxes) if (b.kind === 'text' || b.text) add(String(b.font || 'sans'));
  if (property === 'text' || property === 'options') for (const option of source.input.options || [{value:String(source.input.default || ''),label:String(source.input.default || '')}]) add(option.value,option.label);
  const m = editor(property === 'image' ? 'Approved images' : property === 'options' ? 'Approved options' : `Approved ${propertyLabels[property].toLowerCase()}`, () => {
    if (!options.length) return t('Add at least one option.');
    if (options.some(o => !o.value || !o.label.trim()) || new Set(options.map(o => o.value)).size !== options.length) return t('Give each option a label and a unique value.');
    const d = structuredClone(draft); const f = d.inputs.find(f => f.input.id === fieldId)!;
    if (property === 'image') {
      f.input = {id:f.input.id,label:f.input.label,type:'select',default:options[0]!.value,options};
      const choice: DesignChoiceV1 = { inputId:f.input.id, options:options.map(o => ({...o,writes:f.targets.map(target => ({...target,value:images.get(o.value)}))})) };
      f.targets = []; delete f.approved; delete f.common; delete f.image; d.choices.push(choice);
    } else if (property === 'text' || property === 'options') {
      f.input = {...f.input,type:'select',default:options.some(o => o.value === f.input.default) ? f.input.default : options[0]!.value,options}; delete f.common; f.approved = options.map(o => o.value);
    } else {
      const id = uniqueId(d, `${fieldId}${property[0]!.toUpperCase()}${property.slice(1)}`);
      d.inputs.splice(d.inputs.indexOf(f) + 1, 0, { input:{id,label:`${f.input.label} ${propertyLabels[property].toLowerCase()}`,type:'select',default:options[0]!.value,options,attachTo:fieldId}, targets:f.targets.map(t => ({...t,property})), approved:options.map(o => o.value) });
    }
    const issues = validateDesignTool(d); if (issues.length) return issues[0]!.message;
    commit(d); return undefined;
  });
  m.body.append(element('p', property === 'fg' ? 'Start with colours from the active brand. Keep only the values recipients may use.' : 'Only the options in this list will be available to recipients.'));
  const list = element('div', '', 'dr-input-body'); m.body.append(list);
  const paint = (): void => {
    list.replaceChildren();
    for (const option of options) {
      const row = element('div', '', 'dr-input-body');
      row.append(textField('Label', option.label, value => { option.label = value; }));
      if (property !== 'image') row.append(textField('Value', option.value, value => { option.value = value; }));
      row.append(button('Remove option', () => { options.splice(options.indexOf(option), 1); paint(); })); list.append(row);
    }
  };
  m.body.append(button(property === 'image' ? 'Add image' : 'Add option', () => {
    if (property === 'image') void host.assets.pick({title:t('Choose approved image'),allowUpload:true,types:['raster','vector']}).then(ref => { if (ref) { images.set(ref.id,ref); add(ref.id,String(ref.meta?.name || `Image ${options.length + 1}`)); paint(); } }).catch(err => { m.status.textContent = String(err.message); });
    else { options.push({value:'',label:`Option ${options.length + 1}`}); paint(); }
  })); paint();
}
