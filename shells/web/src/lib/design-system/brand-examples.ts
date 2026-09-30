// SPDX-License-Identifier: MPL-2.0
import type { BrandSystemV1 } from '@lolly-tools/core/brand-system-v1';
import type { InputValue } from '../../../../../engine/src/inputs.ts';
import { resolveBrandRule, type BrandExample, type BrandFacts } from '../../../../../engine/src/brand-rules.ts';
import { createTokenSet } from '../../../../../engine/src/tokens.ts';
import { fetchTemplateSeed } from '../template-source.ts';
import { designVariants, newDesignToolDraft, makeDesignInput } from '../design-tool-draft.ts';

export const EXAMPLE_LABELS: Record<BrandExample, string> = {
  'brand-poster': 'Poster', 'brand-slide-title': 'Title slide', 'brand-slide-content': 'Content slide', 'brand-chart': 'Chart',
};
export interface ExampleText { heading: string; body: string; dense: string }
export const EXAMPLE_TEXT: ExampleText = {
  heading: 'Make room for your next idea.', body: 'A fresh direction, made with your colours.',
  dense: 'A clear starting point\nBring your colours, type and artwork together.\n\nSpace to explore\nMake useful variations without losing the details that identify your brand.\n\nReady for the next step\nReview the output, resolve any issues and share a consistent result.',
};

export async function brandExample(id: BrandExample, doc: unknown, system: BrandSystemV1, mode: string, text: ExampleText) {
  const tokens = createTokenSet(doc, { theme: mode });
  const choices = system.rules.map(rule => resolveBrandRule(rule, system, doc, { tool: id, mode, output: 'png' })).filter(result => result.constraint);
  const first = (slot: string, fallback: string): string => choices.find(result => result.constraint!.slot === slot)?.constraint?.values?.[0] ?? fallback;
  const fieldLabel = (slot: string, fallback: string): string => {
    const rule = system.rules.find(rule => rule.id === choices.find(result => result.constraint!.slot === slot)?.id);
    const names = rule?.roleIds.map(id => system.roles.find(role => role.id === id)?.label).filter(Boolean);
    return names?.length ? `${names.join(' / ')} · ${fallback}` : fallback;
  };
  const resolve = (path: string, fallback: string): string => { const value = tokens.resolve(`{${path}}`); return typeof value === 'string' && value && !value.startsWith('{') ? value : fallback; };
  const accent = first('accent', resolve('color.semantic.primary', '#326b54'));
  const family = first('type', resolve('font.brand', 'SUSE'));
  const device = first('device', '');
  const facts: BrandFacts = { accent: { value: accent }, type: { value: family }, heading: { value: text.heading } };
  const renderDoc = structuredClone(doc || {}) as Record<string, unknown>;
  const font = (renderDoc.font || {}) as object;
  renderDoc.font = { ...font, brand: { $type: 'fontFamily', $value: family }, display: { $type: 'fontFamily', $value: family } };
  if (id === 'brand-chart') {
    return { id, toolId: 'chart', values: { heading: text.heading, data: 'Quarter,Studio\nQ1,42\nQ2,58\nQ3,73\nQ4,89', chartType: 'bar', palette: 'ordered', paletteSeed: accent, palette1: accent, transparentBg: false, background: resolve('color.semantic.surface', '#ffffff'), width: 1280, height: 800 } as Record<string, InputValue>, facts, renderDoc, family, width: 1280, height: 800, draft: null };
  }
  const seed = await fetchTemplateSeed('design', id === 'brand-poster' ? 'poster' : 'slide-deck');
  if (!seed || !Array.isArray(seed.boxes)) throw new Error('The example template is unavailable.');
  const frameId = id === 'brand-poster' ? 'frame' : id === 'brand-slide-title' ? 'slide1' : 'slide2';
  const prefix = id === 'brand-poster' ? '' : id === 'brand-slide-title' ? 's1' : 's2';
  const titleId = prefix ? `${prefix}title` : 'title';
  const bodyId = `${prefix}body`, accentId = `${prefix}accent`;
  const boxes = (seed.boxes as Array<Record<string, unknown>>).filter(box => box.id === frameId || box.frame === frameId).map(box => structuredClone(box));
  const frame = boxes.find(box => box.id === frameId)!;
  const x = Number(frame.x), y = Number(frame.y);
  const body = id === 'brand-slide-content' ? text.dense : text.body;
  facts.body = { value: body };
  for (const box of boxes) {
    box.x = Number(box.x) - x; box.y = Number(box.y) - y;
    if (box.kind === 'text') box.font = family;
    if (box.id === titleId) { box.text = text.heading; if (id === 'brand-poster') box.fg = accent; }
    if (box.id === bodyId) box.text = body;
    if (box.id === accentId) box.bg = accent;
    if (id === 'brand-slide-title' && box.id === titleId) box.h = 300;
    if (id === 'brand-slide-title' && box.id === bodyId) box.y = 760;
    if (id === 'brand-slide-content' && box.id === bodyId) { box.fontSize = 40; box.lineHeight = 1.4; box.h = 560; }
  }
  if (device) {
    boxes.push({ id: 'brand-device', kind: 'image', image: device, x: 1500, y: 70, w: 260, h: 110, frame: frameId, fit: 'contain' });
    facts.device = { value: device, fixed: true };
  }
  const values = { ...seed, boxes, width: 1920, height: 1080, transparentBg: false } as Record<string, InputValue>;
  const variants = designVariants(boxes, 1920, 1080, String(frame.bg));
  const draft = newDesignToolDraft(variants, `${system.label} poster`);
  const headingInput = makeDesignInput(draft, titleId, 'text')!;
  const bodyInput = makeDesignInput(draft, bodyId, 'text')!;
  const accentInput = makeDesignInput(draft, titleId, 'fg')!;
  accentInput.input.default = accent;
  accentInput.input.label = fieldLabel('accent', 'Heading colour');
  headingInput.input.label = 'Heading'; bodyInput.input.label = 'Supporting text';
  const fontInput = { input: { id: 'brand_type', type: 'select' as const, label: fieldLabel('type', 'Typeface'), default: family, options: [{ value: family, label: family }] }, targets: [titleId, bodyId].map(layerId => ({ variantId: variants[0]!.id, layerId, property: 'font' as const })) };
  draft.inputs.push(fontInput);
  return { id, toolId: 'design', values, facts, renderDoc, family, width: 1920, height: 1080, draft,
    fields: { heading: headingInput.input.id, body: bodyInput.input.id, accent: accentInput.input.id, type: fontInput.input.id }, titleId, bodyId, accentId };
}
