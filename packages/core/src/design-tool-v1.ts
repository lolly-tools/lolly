// SPDX-License-Identifier: MPL-2.0
/** Portable rules for a Design document published as one ordinary tool. */
import type { TextDocumentV1 } from './text-v1.ts';
import { writeDesignText } from './design-tool-text.ts';
import type { InputSpec } from './manifest.ts';

export type DesignPropertyV1 = 'text' | 'image' | 'fontSize' | 'font' | 'weight' | 'fg' | 'fill' | 'fit' | 'imageFraming';
export interface DesignTargetV1 {
  variantId: string;
  layerId: string;
  property: DesignPropertyV1;
  text?: DesignTextRuleV1;
}
export interface CommonInputBindingV1 {
  key: 'firstname' | 'lastname' | 'email' | 'heading' | 'subheading' | 'body' | 'eventName' | 'organization' | 'headshot';
  subject: 'person' | 'recipient' | 'presenter' | 'event' | 'content';
  source: 'brief' | 'profile';
}
export interface DesignTextRuleV1 {
  mode: 'fixed' | 'shrink';
  min: number;
  max: number;
  maxLines?: number;
  wrap: boolean;
  sharedSize?: boolean;
}
export interface DesignImageRuleV1 { minWidth?: number; minHeight?: number; formats?: Array<'png' | 'jpeg' | 'webp' | 'avif' | 'svg'> }
export interface DesignInputV1 {
  input: InputSpec;
  targets: DesignTargetV1[];
  common?: CommonInputBindingV1;
  image?: DesignImageRuleV1;
  text?: DesignTextRuleV1;
  /** Approved asset ids, font families or colours, enforced independently of UI. */
  approved?: string[];
}
export interface DesignWriteV1 extends DesignTargetV1 { value: unknown }
export interface DesignChoiceV1 {
  inputId: string;
  options: Array<{
    value: string;
    label: string;
    variantId?: string;
    thumbnail?: string;
    writes: DesignWriteV1[];
    /** Defaults apply only to fields the reader has not supplied. */
    defaults?: Record<string, unknown>;
    fixedInputs?: string[];
  }>;
}
export interface DesignTextRecipeV1 {
  target: DesignTargetV1;
  parts: Array<{ inputId: string } | { literal: string }>;
  text?: DesignTextRuleV1;
}
export interface ArtboardVariantV1 {
  id: string;
  label: string;
  width: number;
  height: number;
  background: string;
  boxes: Array<Record<string, unknown>>;
  textDocument?: TextDocumentV1;
}
/** A captured tool renderer, with public fields mapped to its original inputs. */
export interface DesignSourceToolV1 { id: string; version: string; inputs: Record<string, string> }
export interface DesignToolDraftV1 {
  schemaVersion: 1;
  id: string;
  name: string;
  description?: string;
  version: string;
  presentation: 'sidebar' | 'on-canvas';
  formats: Array<'png' | 'svg' | 'pdf'>;
  inputs: DesignInputV1[];
  variants: ArtboardVariantV1[];
  defaultVariant: string;
  choices: DesignChoiceV1[];
  recipes: DesignTextRecipeV1[];
  sourceTool?: DesignSourceToolV1;
}
export interface DesignToolDefinitionV1 extends DesignToolDraftV1 {
  compilerVersion: 1;
  rendererDigest: string;
  /** Scoped, resolved tokens and font declarations. Never applied to shell chrome. */
  css: string;
  dependencies: Array<{ path: string; digest: string; credit?: string }>;
}
export interface DesignToolFindingV1 {
  code: string;
  message: string;
  inputId?: string;
  layerId?: string;
}
/** The runtime sees policy, not the private source document. */
export interface DesignToolPolicyV1 {
  schemaVersion: 1;
  presentation: 'sidebar' | 'on-canvas';
  inputs: DesignInputV1[];
  choices: DesignChoiceV1[];
  variants: Array<Omit<ArtboardVariantV1, 'boxes' | 'background' | 'textDocument'>>;
  defaultVariant: string;
  formats: Array<'png' | 'svg' | 'pdf'>;
  sourceTool?: DesignSourceToolV1;
}

const propertyTypes: Record<DesignPropertyV1, string[]> = {
  text: ['text', 'longtext', 'select'], image: ['asset'], fontSize: ['number'], font: ['select'],
  weight: ['select', 'number'], fg: ['color', 'select'], fill: ['color', 'select'],
  fit: ['select'], imageFraming: ['vector'],
};
const badKeys = new Set(['__proto__', 'prototype', 'constructor']);
const internal = new Set(['boxes', 'textDocument', 'exportVisibleText', 'customCss', 'background', 'transparentBg', 'font', 'fontSize', 'boxStyle', 'textStyle', 'mediaHtml', 'textHtml', 'designRows', 'designWidth', 'designHeight', 'designBackground', 'designIssues']);
const idPattern = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const own = (o: object, k: string): boolean => Object.hasOwn(o, k);
const keyOf = (t: DesignTargetV1): string => `${t.variantId}/${t.layerId}/${t.property}`;

export function designToolPolicy(d: DesignToolDraftV1): DesignToolPolicyV1 {
  return {
    schemaVersion: 1, presentation: d.presentation, inputs: d.inputs, choices: d.choices,
    variants: d.variants.map(({ id, label, width, height }) => ({ id, label, width, height })),
    defaultVariant: d.defaultVariant, formats: d.formats,
    ...(d.sourceTool ? {sourceTool:d.sourceTool} : {}),
  };
}

export function validateDesignTool(d: DesignToolDraftV1, reserved: readonly string[] = []): DesignToolFindingV1[] {
  const issues: DesignToolFindingV1[] = [];
  const add = (code: string, message: string, inputId?: string, layerId?: string): void => { issues.push({ code, message, inputId, layerId }); };
  if (d.schemaVersion !== 1) add('version', 'This rules version is not supported.');
  if (!/^[a-z0-9][a-z0-9-]{2,95}$/.test(d.id)) add('identity', 'Use a valid permanent tool id.');
  if (!d.name.trim() || !/^\d+\.\d+\.\d+$/.test(d.version)) add('identity', 'Add a name and a three-part version.');
  if (d.description !== undefined && (typeof d.description !== 'string' || d.description.length > 2000)) add('description', 'Keep the instructions within 2000 characters.');
  if (!['sidebar', 'on-canvas'].includes(d.presentation)) add('presentation', 'Choose Sidebar or On-canvas.');
  if (!d.formats.length || d.formats.some(f => !['png', 'svg', 'pdf'].includes(f))) add('formats', 'Choose PNG, SVG or PDF.');
  if (!d.variants.length || d.variants.length > 24 || d.inputs.length > 64 || d.choices.length > 4 || d.recipes.length > 64) add('limits', 'Use up to 24 artboards, 64 inputs and four choices.');
  const variants = new Map(d.variants.map(v => [v.id, v]));
  if (variants.size !== d.variants.length || !variants.has(d.defaultVariant)) add('artboards', 'Choose a valid default artboard and unique artboard ids.');
  for (const v of d.variants) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(v.id) || ![v.width, v.height].every(n => Number.isFinite(n) && n >= 1 && n <= 16384)) add('artboard-size', 'Artboards need a size between 1 and 16384 pixels.');
    if (v.boxes.length > 1000 || new Set(v.boxes.map(b => b.id)).size !== v.boxes.length) add('layers', 'Layers need unique, permanent ids.');
  }
  const fields = new Map(d.inputs.map(f => [f.input.id, f]));
  const choiceIds = new Set(d.choices.map(c => c.inputId));
  if (fields.size !== d.inputs.length || choiceIds.size !== d.choices.length) add('duplicate-id', 'Each input and choice needs a unique id.');
  const owners = new Map<string, string>();
  const choiceOwners = new Map<string, string>();
  const defaultOwners = new Map<string, string>();
  const checkTarget = (t: DesignTargetV1, owner: string, type?: string): void => {
    if (!own(propertyTypes, t.property)) { add('property', 'This property cannot be made editable.', owner, t.layerId); return; }
    const layer = variants.get(t.variantId)?.boxes.find(b => b.id === t.layerId);
    if (!layer) add('missing-layer', 'The linked object was removed. Relink this input.', owner, t.layerId);
    if (type && !propertyTypes[t.property].includes(type)) add('type', 'The input type does not match its property.', owner, t.layerId);
    const prior = owners.get(keyOf(t));
    if (prior && prior !== owner) add('ownership', 'Two controls change the same property. Choose one owner.', owner, t.layerId);
    owners.set(keyOf(t), owner);
  };
  for (const f of d.inputs) {
    const i = f.input;
    if (!idPattern.test(i.id) || badKeys.has(i.id) || internal.has(i.id) || reserved.includes(i.id) || i.id.startsWith('__')) add('input-id', 'Use a unique input id that is not a reserved setting.', i.id);
    if (!['text', 'longtext', 'number', 'select', 'color', 'asset', 'vector', ...(d.sourceTool ? ['boolean','url','date','time','datetime-local'] : [])].includes(i.type)) add('input-type', 'This input type is not supported in a locked tool.', i.id);
    if (i.type === 'select' && (!i.options?.length || i.options.some(o => !o.value || !o.label) || new Set(i.options.map(o => o.value)).size !== i.options.length)) add('options', 'Give each option a label and a unique value.', i.id);
    if (i.type === 'number' && (![i.min, i.max, i.step, i.default].every(n => typeof n === 'number' && Number.isFinite(n)) || Number(i.min) > Number(i.max) || Number(i.step) <= 0)) add('range', 'Set a finite minimum, maximum, default and positive step.', i.id);
    if (i.type === 'asset' && i.assetType !== 'image') add('media', 'Editable images must use the image asset type.', i.id);
    if (i.type === 'vector') {
      const axes = i.fields as Array<{ id: string; min: number; max: number; step: number }> | undefined;
      if (!axes?.length || axes.length > 3 || new Set(axes.map(a => a.id)).size !== axes.length || axes.some(a => !['x', 'y', 'zoom'].includes(a.id) || ![a.min, a.max, a.step].every(Number.isFinite) || a.min > a.max || a.step <= 0 || a.min < (a.id === 'zoom' ? 1 : 0) || a.max > (a.id === 'zoom' ? 1000 : 100))) add('framing-range', 'Set valid X/Y percentages and a bounded zoom range.', i.id);
    }
    if (!f.targets.length && !d.sourceTool?.inputs[i.id] && !choiceIds.has(i.id) && !d.recipes.some(r => r.parts.some(p => 'inputId' in p && p.inputId === i.id))) add('unlinked', 'Link this input to an object.', i.id);
    if (f.common && (f.common.key === 'headshot' ? i.type !== 'asset' : !['text', 'longtext'].includes(i.type))) add('common-type', 'Use an image for a headshot and text for other common fields.', i.id);
    if (f.image && (i.type !== 'asset' || [f.image.minWidth, f.image.minHeight].some(n => n !== undefined && (!Number.isInteger(n) || n < 1 || n > 32768)) || f.image.formats && (!f.image.formats.length || f.image.formats.some(format => !['png','jpeg','webp','avif','svg'].includes(format))))) add('image-rule', 'Choose image formats and positive minimum pixel dimensions.', i.id);
    if (f.common?.source === 'profile' && (!['person', 'recipient', 'presenter'].includes(f.common.subject) || !['firstname', 'lastname', 'email'].includes(f.common.key))) add('profile', 'Profile prefill is only available for a person’s name or email.', i.id);
    for (const target of f.targets) {
      checkTarget(target,i.id,i.type);
      if (target.text && (!(target.text.min > 0) || !Number.isFinite(target.text.max) || target.text.max < target.text.min)) add('text-fit','Review this object’s font-size range.',i.id,target.layerId);
    }
    if (f.text && (!(f.text.min > 0) || !Number.isFinite(f.text.max) || f.text.min > f.text.max || (f.text.maxLines !== undefined && (!Number.isInteger(f.text.maxLines) || f.text.maxLines < 1)))) add('text-fit', 'Set a valid font-size range and line limit.', i.id);
  }
  if(d.sourceTool) {
    const entries=Object.entries(d.sourceTool.inputs);
    if(!d.sourceTool.id || !d.sourceTool.version || entries.length!==d.inputs.length || new Set(entries.map(([,id])=>id)).size!==entries.length || entries.some(([id,source])=>!fields.has(id)||!source||badKeys.has(source)||source.startsWith('__')))
      add('source-inputs','Choose distinct inputs from the source tool.');
  }
  let combinations = 1;
  let artboardSelectors = 0;
  for (const c of d.choices) {
    const field = fields.get(c.inputId);
    if (field?.input.type !== 'select' || field.targets.length) add('choice', 'A choice needs its own select input.', c.inputId);
    combinations *= c.options.length;
    if (!c.options.length || new Set(c.options.map(o => o.value)).size !== c.options.length) add('choice-options', 'Give each choice option a unique value.', c.inputId);
    if (c.options.some(o => o.variantId)) artboardSelectors++;
    const choiceTargets = new Set<string>();
    for (const o of c.options) {
      if (!field?.input.options?.some(p => p.value === o.value)) add('choice-option', 'Declare each choice option in the input.', c.inputId);
      if (o.variantId && !variants.has(o.variantId)) add('choice-artboard', 'Choose an existing artboard.', c.inputId);
      for (const id of new Set([...(o.fixedInputs ?? []), ...Object.keys(o.defaults ?? {})])) {
        const target = fields.get(id);
        if (!target || choiceIds.has(id)) add('choice-field', 'Choose an existing content input.', c.inputId);
        const prior = defaultOwners.get(id);
        if (prior && prior !== c.inputId) add('ownership', 'Two choices set the same input. Choose one owner.', id);
        defaultOwners.set(id,c.inputId);
        if (target && own(o.defaults || {},id)) for (const issue of validateDesignValues({...designToolPolicy(d), choices:[], inputs:[target]}, {[id]:o.defaults![id]})) issues.push(issue);
      }
      const writes = new Set<string>();
      for (const w of o.writes) {
        const k = keyOf(w);
        const choiceOwner = choiceOwners.get(k);
        if (choiceOwner && choiceOwner !== c.inputId) add('ownership', 'Two choices control the same property.', c.inputId, w.layerId);
        choiceOwners.set(k, c.inputId);
        if (writes.has(k)) add('choice-write', 'An option cannot write the same property twice.', c.inputId, w.layerId);
        writes.add(k);
        const reader = owners.get(k);
        if (reader && reader !== c.inputId && !(o.fixedInputs ?? []).includes(reader)) add('ownership', 'This option and a reader input both control this property.', reader, w.layerId);
        if (!reader) checkTarget(w, c.inputId);
        choiceTargets.add(k);
      }
    }
  }
  if (combinations > 128 || artboardSelectors > 1) add('choice-limits', 'Use one artboard choice and up to 128 option combinations.');
  for (const r of d.recipes) {
    if (r.target.property !== 'text' || !r.parts.length || r.parts.length > 16) add('recipe', 'Joined text needs a text target and up to 16 parts.');
    checkTarget(r.target, `recipe:${keyOf(r.target)}`, 'text');
    for (const p of r.parts) if ('inputId' in p && !['text', 'longtext'].includes(fields.get(p.inputId)?.input.type ?? '')) add('recipe-input', 'Joined text can use only declared text inputs.', p.inputId);
  }
  for (const issue of validateDesignValues(designToolPolicy(d), {}, true)) issues.push(issue);
  return issues;
}

export function designSelection(p: DesignToolPolicyV1, values: Record<string, unknown>): { variantId: string; fixed: Set<string>; defaults: Record<string, unknown>; writes: DesignWriteV1[] } {
  let variantId = p.defaultVariant;
  const fixed = new Set<string>();
  const defaults: Record<string, unknown> = {};
  const writes: DesignWriteV1[] = [];
  for (const c of p.choices) {
    const value = own(values, c.inputId) ? values[c.inputId] : p.inputs.find(f => f.input.id === c.inputId)?.input.default;
    const option = c.options.find(o => o.value === value);
    if (!option) continue;
    if (option.variantId) variantId = option.variantId;
    for (const id of option.fixedInputs ?? []) fixed.add(id);
    Object.assign(defaults, option.defaults);
    writes.push(...option.writes);
  }
  return { variantId, fixed, defaults, writes };
}

/** Reject invalid raw content before ordinary input normalization can truncate it. */
export function validateDesignValues(p: DesignToolPolicyV1, values: Record<string, unknown>, required = false): DesignToolFindingV1[] {
  const result: DesignToolFindingV1[] = [];
  const selection = designSelection(p, values);
  for (const f of p.inputs) {
    const i = f.input;
    if (selection.fixed.has(i.id)) continue;
    const v = own(values, i.id) ? values[i.id] : own(selection.defaults, i.id) ? selection.defaults[i.id] : i.default;
    const bad = (message: string): void => { result.push({ code: 'value', message: `${i.label || i.id}: ${message}`, inputId: i.id }); };
    if (v === undefined || v === null || v === '') { if (required && i.required) bad('add a value.'); continue; }
    if (['text','longtext','url','date','time','datetime-local'].includes(i.type)) {
      if (typeof v !== 'string') bad('enter text.');
      else if (i.maxLength !== undefined && v.length > i.maxLength) bad(`use up to ${i.maxLength} characters. The full value has been kept.`);
    } else if(i.type === 'boolean') { if(typeof v!=='boolean') bad('choose on or off.');
    } else if (i.type === 'number') {
      const n = Number(v);
      if (!Number.isFinite(n) || n < Number(i.min) || n > Number(i.max) || Math.abs((n - Number(i.min)) / Number(i.step) - Math.round((n - Number(i.min)) / Number(i.step))) > 1e-7) bad(`use ${i.min} to ${i.max}, in steps of ${i.step}.`);
    } else if (i.type === 'select' && !i.options?.some(o => o.value === v)) bad('choose an approved option.');
    else if (i.type === 'color' && (typeof v !== 'string' || !/^#[\da-f]{3,8}$/i.test(v))) bad('choose a valid colour.');
    else if (i.type === 'asset' && typeof v === 'object' && 'type' in v && (!['raster', 'vector'].includes(String(v.type)) || 'format' in v && ['gif', 'apng', 'html'].includes(String(v.format)))) bad('choose a still image.');
    else if (i.type === 'vector') {
      const fields = i.fields as Array<{ id: string; min: number; max: number; step?: number }> | undefined;
      if (!v || typeof v !== 'object' || !fields?.length) bad('set valid image positioning.');
      else for (const field of fields) {
        const n = Number((v as Record<string, unknown>)[field.id] ?? (i.default as Record<string, unknown> | undefined)?.[field.id]);
        if (!Number.isFinite(n) || n < field.min || n > field.max || field.step && Math.abs((n - field.min) / field.step - Math.round((n - field.min) / field.step)) > 1e-7) bad(`${field.id} must be between ${field.min} and ${field.max}, using its declared step.`);
      }
    }
    const assetId = typeof v === 'object' && v && 'id' in v ? String(v.id) : String(v);
    if (f.approved?.length && !f.approved.includes(assetId)) bad('choose a designer-approved value.');
  }
  return result;
}

export function evaluateDesignTool(d: DesignToolDraftV1, supplied: Record<string, unknown>): { variant: ArtboardVariantV1; values: Record<string, unknown>; findings: DesignToolFindingV1[]; textRules: Record<string, DesignTextRuleV1>; inputMap: Record<string, string>; framingMap: Record<string, string>; fitGroups: Record<string, string>; imageRules: Record<string, DesignImageRuleV1> } {
  const policy = designToolPolicy(d);
  const selection = designSelection(policy, supplied);
  const source = d.variants.find(v => v.id === selection.variantId);
  if (!source) throw new Error('The selected artboard is unavailable.');
  const variant = JSON.parse(JSON.stringify(source)) as ArtboardVariantV1;
  const values: Record<string, unknown> = {};
  const textRules: Record<string, DesignTextRuleV1> = {};
  const inputMap: Record<string, string> = {};
  const framingMap: Record<string, string> = {};
  const fitGroups: Record<string, string> = {};
  const imageRules: Record<string, DesignImageRuleV1> = {};
  const findings = validateDesignValues(policy, supplied, true);
  const invalid = new Set(findings.map(f => f.inputId));
  const write = (target: DesignTargetV1, value: unknown): void => {
    if (target.variantId !== variant.id) return;
    const box = variant.boxes.find(b => b.id === target.layerId);
    if (box && own(propertyTypes, target.property)) {
      if(box.textStory&&variant.textDocument&&writeDesignText(variant.textDocument,box,target.property,value))return;
      box[target.property] = value;
      if (target.property === 'text') box.plainText = true;
    }
  };
  for (const f of d.inputs) {
    const i = f.input;
    const value = !invalid.has(i.id) && own(supplied, i.id) ? supplied[i.id] : own(selection.defaults, i.id) ? selection.defaults[i.id] : i.default;
    values[i.id] = selection.fixed.has(i.id) ? (selection.defaults[i.id] ?? i.default) : value;
    if (selection.fixed.has(i.id)) continue;
    for (const target of f.targets) {
      write(target, value);
      if (target.variantId === variant.id) {
        inputMap[target.layerId] ??= i.id;
        if (target.property === 'imageFraming') framingMap[target.layerId] = i.id;
        if (target.property === 'image' && f.image) imageRules[target.layerId] = f.image;
        if (target.property === 'text' && f.text?.sharedSize) fitGroups[target.layerId] = i.id;
        if (f.text && target.property === 'text') textRules[target.layerId] = target.text || f.text;
      }
    }
  }
  for (const recipe of d.recipes) {
    write(recipe.target, recipe.parts.map(p => 'literal' in p ? p.literal : String(values[p.inputId] ?? '')).join(''));
    if (recipe.target.variantId === variant.id) {
      const first = recipe.parts.find(p => 'inputId' in p);
      if (first && 'inputId' in first) inputMap[recipe.target.layerId] = first.inputId;
      if (recipe.text) textRules[recipe.target.layerId] = recipe.text;
    }
  }
  for (const w of selection.writes) write(w, w.value);
  for (const f of d.inputs) if (f.input.type === 'number' && !selection.fixed.has(f.input.id)) {
    for (const target of f.targets) if (target.variantId === variant.id && target.property === 'fontSize' && textRules[target.layerId]) textRules[target.layerId] = {...textRules[target.layerId]!,min:Number(f.input.min),max:Number(f.input.max)};
  }
  for (const box of variant.boxes) {
    const rule = textRules[String(box.id)];
    box.fitText = false;
    if(box.textStory&&variant.textDocument&&rule){const frame=JSON.parse(String(box.textFrame));if(rule.mode==='shrink'){const story=variant.textDocument.stories.find(story=>story.id===box.textStory)!;if(story.frameIds.length!==1)throw new Error('A linked story cannot shrink to fit. Use a fixed text rule.');frame.shrink={minSize:rule.min};}else delete frame.shrink;box.textFrame=JSON.stringify(frame);continue;}
    if (rule) box.fontSize = Math.min(rule.max, Math.max(rule.min, Number(box.fontSize) || rule.max));
  }
  return { variant, values, findings, textRules, inputMap, framingMap, fitGroups, imageRules };
}
