// SPDX-License-Identifier: MPL-2.0
import type { DesignInputV1, DesignToolDraftV1 } from '@lolly-tools/core/design-tool-v1';
import { escape as escapeHtml } from '../utils.ts';
import { t } from '../i18n.ts';
import { SVG, icon } from './free-canvas-icons.ts';
const e = (v: unknown): string => escapeHtml(String(v ?? ''));
export const ruleField = (label: string, control: string): string => `<div class="dr-field"><label>${t(label)}${control}</label></div>`;
export const ruleNumber = (key: string, value: unknown, min = 0): string => `<input class="field-input" data-rule="${key}" type="number" min="${min}" value="${e(value)}">`;

export function designRulesFields(d: DesignToolDraftV1): string {
  if (!d.inputs.length) return `<div class="dr-empty"><strong>${t('Choose what people can change')}</strong><p>${t('Select a text or image object, then choose Make editable. Everything else stays fixed.')}</p></div>`;
  return d.inputs.map((f, index) => {
    const i = f.input;
    const isText = i.type === 'text' || i.type === 'longtext';
    const choice = d.choices.find(c => c.inputId === i.id);
    const freeProperty = f.targets[0]?.property;
    return `<details class="dr-input" name="design-rules-input" data-field="${e(i.id)}" data-reorder-row>
      <summary><button class="btn btn--ghost dr-grab" type="button" data-reorder-handle aria-label="${e(t('Move {name}', { name: i.label || i.id }))}" aria-pressed="false">${icon(SVG.grip)}</button><span class="dr-input-title"><strong>${e(i.label || i.id)}</strong><small>${e(choice || i.type === 'select' ? t('Choice') : f.common ? t('Shared text') : isText ? t('Text') : i.type === 'color' ? t('Colour') : i.type === 'number' ? t('Size') : i.type === 'vector' ? t('Position') : t('Image'))}${f.targets.length > 1 ? ` · ${f.targets.length} ${t('objects')}` : ''}</small></span></summary>
      <div class="dr-input-body">
        ${ruleField('Label', `<input class="field-input" data-rule="label" value="${e(i.label)}">`)}
        ${isText ? ruleField('Default text', `<textarea class="field-input" data-rule="default" rows="2">${e(i.default)}</textarea>`) : ''}
        ${isText ? ruleField('Control', `<select class="field-select" data-rule="control"><option value="text"${i.type === 'text' ? ' selected' : ''}>${t('Single line')}</option><option value="longtext"${i.type === 'longtext' ? ' selected' : ''}>${t('Multiple lines')}</option></select>`) : ''}
        ${i.type === 'color' ? ruleField('Default colour', `<input class="field-input" data-rule="default" value="${e(i.default)}">`) : ''}
        <div class="dr-editing-policy"><strong>${t(choice || i.type === 'select' ? 'Choose from approved options' : 'Editable')}</strong><div class="dr-row-actions">${isText || i.type === 'asset' || i.type === 'color' ? `<button class="btn btn--sm" data-act="approved-${isText ? 'text' : i.type === 'asset' ? 'image' : 'options'}" type="button">${t('Choose from approved options')}</button>` : ''}<button class="btn btn--ghost btn--sm" data-act="remove" type="button">${t('Make fixed')}</button></div><small>${t('Fixed objects keep their authored value and have no recipient control.')}</small></div>
        ${ruleField('Placement', `<select class="field-select" data-rule="placement"><option value="">${t('Main inputs')}</option><option value="more"${i.section === 'More options' ? ' selected' : ''}>${t('More options')}</option></select>`)}
        ${isText || i.type === 'asset' ? ruleField('Common input', `<select class="field-select" data-rule="common"><option value="">${t('Only this tool')}</option>${(i.type === 'asset' ? ['headshot'] : ['firstname', 'lastname', 'email', 'organization', 'heading', 'subheading', 'body', 'eventName']).map(k => `<option value="${k}"${f.common?.key === k ? ' selected' : ''}>${e(({ organization: 'Organization', headshot: 'Headshot', firstname: 'First name', lastname: 'Last name', eventName: 'Event name', email: 'Email', heading: 'Heading', subheading: 'Subheading', body: 'Body' } as Record<string, string>)[k] || k)}</option>`).join('')}</select>`) : ''}
        ${f.common && ['person', 'recipient', 'presenter'].includes(f.common.subject) ? ruleField('Person', `<select class="field-select" data-rule="subject">${['person','recipient','presenter'].map(role => `<option value="${role}"${f.common?.subject === role ? ' selected' : ''}>${t(role === 'person' ? 'Shared person' : role === 'recipient' ? 'Recipient' : 'Presenter')}</option>`).join('')}</select>`) : ''}
        ${f.common && ['person', 'recipient', 'presenter'].includes(f.common.subject) && ['firstname','lastname','email'].includes(f.common.key) ? ruleField('Starting value', `<select class="field-select" data-rule="source"><option value="brief">${t('Project brief or entered text')}</option><option value="profile"${f.common.source === 'profile' ? ' selected' : ''}>${t('The person using the tool')}</option></select>`) : ''}
        ${choice ? `<button class="btn btn--sm" type="button" data-act="choice">${t('Edit options')}</button><div class="dr-options">${choice.options.map(o => `<label class="dr-option">${e(o.label)}<small>${e(d.variants.find(v => v.id === o.variantId)?.label || '')}</small></label>`).join('')}</div>` : ''}
        ${i.type === 'select' && !choice ? `<div class="dr-row-actions"><button class="btn btn--sm" data-act="approved-options" type="button">${t('Edit options')}</button>${freeProperty && ['text', 'fg', 'fill'].includes(freeProperty) ? `<button class="btn btn--ghost btn--sm" data-act="free" type="button">${t(freeProperty === 'text' ? 'Allow free text' : 'Allow any colour')}</button>` : ''}</div>` : ''}
        <details class="dr-advanced"><summary>${t('Rules')}</summary>
        ${isText ? `<button class="btn btn--sm" data-act="join" type="button">${t('Build text from first and last name')}</button>${ruleField('Help text', `<input class="field-input" data-rule="help" value="${e(i.help)}">`)}<label class="dr-check"><input type="checkbox" data-rule="required"${i.required ? ' checked' : ''}>${t('Required')}</label>${ruleField('Character limit', ruleNumber('maxLength', i.maxLength || 200, 1))}${ruleField('Text fitting', `<select class="field-select" data-rule="fit"><option value="fixed">${t('Fixed size')}</option><option value="shrink"${f.text?.mode === 'shrink' ? ' selected' : ''}>${t('Shrink to fit')}</option></select>`)}<div class="dr-pair">${ruleField('Minimum size', ruleNumber('min', f.text?.min, 1))}${ruleField('Maximum size', ruleNumber('max', f.text?.max, 1))}</div><label class="dr-check"><input type="checkbox" data-rule="sharedSize"${f.text?.sharedSize ? ' checked' : ''}>${t('Keep linked objects at one fitted size')}</label>${ruleField('Maximum lines', ruleNumber('maxLines', f.text?.maxLines || 0))}<label class="dr-check"><input type="checkbox" data-rule="wrap"${f.text?.wrap !== false ? ' checked' : ''}>${t('Allow wrapping')}</label><button type="button" class="btn btn--sm" data-act="font-size"${d.inputs.some(field=>field.input.id===`${i.id}FontSize`) ? ' disabled' : ''}>${t('Add a font-size control')}</button><button class="btn btn--sm" data-act="approved-font" type="button">${t('Allow font choices')}</button><button class="btn btn--sm" data-act="approved-weight" type="button">${t('Allow weight choices')}</button><button class="btn btn--sm" data-act="approved-fg" type="button">${t('Allow colour choices')}</button>` : ''}
        ${f.targets.length > 1 && f.text ? f.targets.map((target,index) => { const rule = target.text || f.text!; return `<fieldset class="dr-axis"><legend>${e(d.variants.find(v => v.id === target.variantId)?.label || 'Object')}</legend><div class="dr-pair">${ruleField('Minimum size',ruleNumber(`target:${index}:min`,rule.min,1))}${ruleField('Maximum size',ruleNumber(`target:${index}:max`,rule.max,1))}</div></fieldset>`; }).join('') : ''}
        ${i.type === 'asset' ? `<div class="dr-pair">${ruleField('Minimum width (px)',ruleNumber('image:minWidth',f.image?.minWidth || 0))}${ruleField('Minimum height (px)',ruleNumber('image:minHeight',f.image?.minHeight || 0))}</div><fieldset class="dr-axis"><legend>${t('Allowed image formats')}</legend>${['png','jpeg','webp','avif','svg'].map(format => `<label class="dr-check"><input type="checkbox" data-rule="image-format:${format}"${!f.image?.formats || f.image.formats.includes(format as 'png') ? ' checked' : ''}>${format.toUpperCase()}</label>`).join('')}</fieldset><button class="btn btn--sm" data-act="framing" type="button"${d.inputs.some(field=>field.input.framingFor===i.id) ? ' disabled' : ''}>${t('Add image positioning')}</button><button class="btn btn--sm" data-act="image-fit" type="button"${d.inputs.some(field=>field.input.id===`${i.id}Fit`) ? ' disabled' : ''}>${t('Add image fit choice')}</button><label class="dr-check"><input type="checkbox" data-rule="uploads"${i.allowUpload !== false ? ' checked' : ''}>${t('Allow image uploads')}</label>` : ''}
        ${i.type === 'vector' ? (i.fields as Array<{id:string;label:string;min:number;max:number;step:number}>).map(axis => `<fieldset class="dr-axis"><legend>${e(axis.label)}</legend><div class="dr-pair">${ruleField('Minimum', ruleNumber(`vector:${axis.id}:min`, axis.min))}${ruleField('Maximum', ruleNumber(`vector:${axis.id}:max`, axis.max))}</div>${ruleField('Default', ruleNumber(`vector:${axis.id}:default`, (i.default as Record<string,number>)?.[axis.id], 0))}${ruleField('Step', ruleNumber(`vector:${axis.id}:step`, axis.step, 0.01))}</fieldset>`).join('') : ''}
        ${i.type === 'number' ? `<div class="dr-pair">${ruleField('Minimum', ruleNumber('numberMin', i.min))}${ruleField('Maximum', ruleNumber('numberMax', i.max))}</div>${ruleField('Default', ruleNumber('numberDefault', i.default))}${ruleField('Step', ruleNumber('step', i.step, 0.01))}` : ''}
        ${f.targets.length && d.variants.length > 1 ? `<button class="btn btn--sm" data-act="matches" type="button">${t('Find matching objects')}</button>` : ''}<div class="dr-targets">${f.targets.map((target,n) => `<div class="dr-target"><button class="btn btn--ghost btn--sm" data-act="target" data-target="${n}" type="button">${e(d.variants.find(v => v.id === target.variantId)?.label)} · ${e(d.variants.find(v => v.id === target.variantId)?.boxes.find(b => b.id === target.layerId)?.name || target.property)}</button><button class="btn btn--ghost btn--sm" type="button" data-act="unlink" data-target="${n}" aria-label="${t('Unlink this object')}">${t('Unlink')}</button></div>`).join('')}</div><p class="dr-field-error" role="status"></p>
        <div class="dr-row-actions"><button class="btn btn--ghost btn--sm" data-act="link" type="button">${t('Link selected objects to this input')}</button><button class="btn btn--ghost btn--sm" data-act="up" type="button"${index === 0 ? ' disabled' : ''}>${t('Move up')}</button><button class="btn btn--ghost btn--sm" data-act="down" type="button"${index === d.inputs.length - 1 ? ' disabled' : ''}>${t('Move down')}</button><button class="btn btn--ghost btn--sm" data-act="remove" type="button">${t('Remove input')}</button></div></details>
      </div></details>`;
  }).join('');
}

export function editDesignRule(field: DesignInputV1, key: string, value: string | boolean): void {
  const i = field.input;
  if (key === 'label' || key === 'default' || key === 'help') i[key] = String(value);
  else if (key === 'control') { i.type = value === 'longtext' ? 'longtext' : 'text'; if (i.type === 'longtext') i.rows = 3; else delete i.rows; }
  else if (key === 'placement') { if (value === 'more') i.section = 'More options'; else delete i.section; }
  else if (key === 'required') i.required = Boolean(value);
  else if (key === 'maxLength') i.maxLength = Number(value);
  else if (key === 'numberDefault') i.default = Number(value);
  else if (key === 'numberMin') i.min = Number(value);
  else if (key === 'numberMax') i.max = Number(value);
  else if (key === 'step') i.step = Number(value);
  else if (key === 'uploads') i.allowUpload = Boolean(value);
  else if (key === 'common') {
    if (!value) delete field.common;
    else { const k = String(value) as NonNullable<DesignInputV1['common']>['key']; field.common = { key: k, subject: ['firstname', 'lastname', 'email', 'organization', 'headshot'].includes(k) ? 'person' : k === 'eventName' ? 'event' : 'content', source: 'brief' }; }
  } else if (key === 'subject' && field.common) field.common.subject = String(value) as NonNullable<DesignInputV1['common']>['subject'];
  else if (key.startsWith('image:')) { field.image ??= {}; field.image[key.slice(6) as 'minWidth' | 'minHeight'] = Number(value) || undefined; }
  else if (key.startsWith('image-format:')) { field.image ??= {}; const formats = new Set<NonNullable<NonNullable<DesignInputV1['image']>['formats']>[number]>(field.image.formats || ['png','jpeg','webp','avif','svg']); const format = key.slice(13) as 'png'; if (value) formats.add(format); else formats.delete(format); field.image.formats = [...formats]; }
  else if (key === 'source' && field.common) field.common.source = value === 'profile' ? 'profile' : 'brief';
  else if (key.startsWith('target:') && field.text) {
    const [,index,property] = key.split(':'); const target = field.targets[Number(index)];
    if (target && (property === 'min' || property === 'max')) { target.text ??= {...field.text}; target.text[property] = Number(value); }
  }
  else if (key.startsWith('vector:')) {
    const [, id, property] = key.split(':');
    const axis = (i.fields as Array<{id:string;min:number;max:number;step:number}>).find(axis => axis.id === id);
    if (axis && property === 'default') { (i.default as Record<string,number>)[id!] = Number(value); }
    if (axis && (property === 'min' || property === 'max' || property === 'step')) axis[property] = Number(value);
  }
  else if (field.text) {
    if (key === 'sharedSize') field.text.sharedSize = Boolean(value);
    else if (key === 'fit') field.text.mode = value === 'shrink' ? 'shrink' : 'fixed';
    else if (key === 'wrap') field.text.wrap = Boolean(value);
    else if (key === 'min' || key === 'max') field.text[key] = Number(value);
    else if (key === 'maxLines') field.text.maxLines = Number(value) || undefined;
    if (['fit','wrap','maxLines'].includes(key)) for (const target of field.targets) if (target.text) target.text = {...target.text,mode:field.text.mode,wrap:field.text.wrap,maxLines:field.text.maxLines};
  }
}
