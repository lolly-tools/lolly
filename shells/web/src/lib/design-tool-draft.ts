// SPDX-License-Identifier: MPL-2.0
import type { DesignToolDraftV1, ArtboardVariantV1, DesignInputV1 } from '@lolly-tools/core/design-tool-v1';
import { validateDesignTool } from '@lolly-tools/core/design-tool-v1';
import { parseTextDocument,textStyleResolver } from '@lolly/engine';
import type { Runtime } from '../../../../engine/src/runtime.ts';

const drafts = new WeakMap<Runtime, DesignToolDraftV1>();
export function getDesignToolDraft(runtime: Runtime): DesignToolDraftV1 | undefined { return drafts.get(runtime); }
export function setDesignToolDraft(runtime: Runtime, draft: DesignToolDraftV1): void { drafts.set(runtime, structuredClone(draft)); }
export function restoreDesignToolDraft(runtime: Runtime, value: unknown): void {
  if (!value || typeof value !== 'object') return;
  const d = value as DesignToolDraftV1;
  if (d.schemaVersion !== 1 || !Array.isArray(d.inputs) || !Array.isArray(d.variants) || !Array.isArray(d.choices) || !Array.isArray(d.recipes)) return;
  // Incomplete rules remain editable; malformed saved metadata cannot break Design.
  try { validateDesignTool(d); setDesignToolDraft(runtime,d); } catch { return; }
}

export function designVariants(boxes: Array<Record<string, unknown>>, width: number, height: number, background: string, textDocument?:unknown): ArtboardVariantV1[] {
  const document=textDocument?parseTextDocument(textDocument):undefined;
  const attach=(variant:ArtboardVariantV1):ArtboardVariantV1=>{if(!document)return variant;const ids=new Set(variant.boxes.map(box=>String(box.id))),stories=document.stories.filter(story=>story.frameIds.some(id=>ids.has(id)));return {...variant,textDocument:{...structuredClone(document),stories:structuredClone(stories)}};};
  const linkedArtboards=document?.stories.some(story=>new Set(story.frameIds.map(id=>boxes.find(box=>box.id===id)?.frame??'')).size>1);
  if(linkedArtboards)return [attach({id:'linked-artboards',label:'Linked artboards',width:Math.max(width,...boxes.map(box=>Number(box.x||0)+Number(box.w||0))),height:Math.max(height,...boxes.map(box=>Number(box.y||0)+Number(box.h||0))),background,boxes:structuredClone(boxes)})];
  const frames = boxes.filter(b => b.kind === 'frame' && !b.hidden);
  if (!frames.length) return [attach({ id: 'artboard', label: 'Artboard', width, height, background, boxes: structuredClone(boxes) })];
  return frames.map((frame, i) => attach({
    id: String(frame.id), label: String(frame.name || `Artboard ${i + 1}`), width: Number(frame.w), height: Number(frame.h), background: String(frame.bg || background),
    boxes: boxes.filter(b => b.kind !== 'frame' && b.frame === frame.id).map(b => ({ ...structuredClone(b), x: Number(b.x || 0) - Number(frame.x || 0), y: Number(b.y || 0) - Number(frame.y || 0), frame: '' })),
  }));
}
export function newDesignToolDraft(variants: ArtboardVariantV1[], name = 'Untitled tool'): DesignToolDraftV1 {
  return { schemaVersion: 1, id: `design-${crypto.randomUUID().slice(0, 12)}`, name, version: '1.0.0', presentation: 'sidebar', formats: ['png', 'svg', 'pdf'], inputs: [], variants, defaultVariant: variants[0]!.id, choices: [], recipes: [] };
}
export function makeDesignInput(draft: DesignToolDraftV1, layerId: string, property: 'text' | 'image' | 'fg' | 'fill'): DesignInputV1 | null {
  const existing = draft.inputs.find(f => f.targets.some(t => t.layerId === layerId && t.property === property));
  if (existing) return existing;
  const v = draft.variants.find(v => v.boxes.some(b => b.id === layerId));
  const b = v?.boxes.find(b => b.id === layerId);
  if (!v || !b) return null;
  const colour = property === 'fg' || property === 'fill';
  const base = String(b.name || (property === 'text' ? 'Text' : property === 'image' ? 'Image' : 'Object')) + (colour ? ' colour' : '');
  let id = base.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^\d|_$/g, '') || 'content';
  if (['image', 'text', 'font', 'background'].includes(id)) id = `editable_${id}`;
  const ids = new Set(draft.inputs.map(f => f.input.id));
  while (ids.has(id)) id += '_2';
  const story=v.textDocument?.stories.find(story=>story.id===b.textStory),character=story?textStyleResolver(v.textDocument!).character(story,story.paragraphs[0]!,0):undefined;
  const size = character?.size ?? (Number(b.fontSize) || 32);
  const value = property === 'text' && story ? story.source : b[property] ?? (colour ? '#000000' : '');
  const multiline = property === 'text' && (String(value).includes('\n') || String(value).length > 100);
  const f: DesignInputV1 = {
    input: { id, label: base, type: colour ? 'color' : property === 'text' ? multiline ? 'longtext' : 'text' : 'asset', default: value, ...(property === 'image' ? { assetType: 'image', allowUpload: true } : property === 'text' ? { maxLength: Math.max(200, String(value).length), ...(multiline ? { rows: 3 } : {}) } : {}) },
    targets: [{ variantId: v.id, layerId, property }],
    ...(property === 'text' ? { text: { mode: 'fixed' as const, min: size, max: size, wrap: true } } : {}),
  };
  draft.inputs.push(f);
  return f;
}

export function addArtboardChoice(draft: DesignToolDraftV1): void {
  if (draft.choices.some(c => c.options.some(o => o.variantId))) return;
  const options = draft.variants.map(v => ({ value: v.id, label: v.label }));
  draft.inputs.unshift({ input: { id: 'layout', label: 'Layout', type: 'select', default: draft.defaultVariant, options }, targets: [] });
  draft.choices.push({ inputId: 'layout', options: draft.variants.map(v => ({ value: v.id, label: v.label, variantId: v.id, writes: [] })) });
}
