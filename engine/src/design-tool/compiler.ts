// SPDX-License-Identifier: MPL-2.0
import type { DesignToolDefinitionV1 } from '@lolly-tools/core/design-tool-v1';
import { designToolPolicy, validateDesignTool } from '@lolly-tools/core/design-tool-v1';
import type { ToolManifest } from '../loader.ts';
import { parseTextDocument } from '../text-story-document.ts';
import { RESERVED } from '../url-mode.ts';

export interface CompiledDesignTool {
  manifest: ToolManifest;
  files: Record<string, string | Uint8Array>;
}

/** Shell adapters resolve all dependencies before this pure compiler is called. */
export function compileDesignTool(
  definition: DesignToolDefinitionV1,
  renderer: { source: string; styles: string },
  assets: Record<string, Uint8Array> = {},
): CompiledDesignTool {
  for(const variant of definition.variants)if(variant.textDocument)parseTextDocument(variant.textDocument);
  const composed=definition.variants.some(variant=>variant.textDocument?.stories.length);
  const findings = validateDesignTool(definition, [...RESERVED]);
  if (findings.length) throw new Error(findings.map(f => f.message).join('\n'));
  for (const dep of definition.dependencies) if (!assets[dep.path]) throw new Error(`Missing dependency: ${dep.path}`);
  for (const path of Object.keys(assets)) if (!/^assets\/[\w./-]+$/.test(path) || path.split('/').includes('..')) throw new Error('Invalid dependency path.');
  const first = definition.variants.find(v => v.id === definition.defaultVariant)!;
  const policy = designToolPolicy(definition);
  const manifest = {
    id: definition.id, name: definition.name, version: definition.version,
    engineVersion: composed?'^1.217.0':'^1.199.0', description: definition.description || 'Share your design with your rules.',
    category: 'designer', tags: ['design', 'template'], status: 'community', isolate: true,
    render: { width: first.width, height: first.height, formats: definition.formats, dims: false, units: false },
    designTool: policy,
    inputs: [...definition.inputs].sort((a, b) => Number(a.input.section === 'More options') - Number(b.input.section === 'More options')).map(f => ({ ...f.input, ...(f.common?.source === 'profile' ? { bindToProfile: f.common.key } : {}) })),
    hooks: { onInit: true, onInput: true },
  } as ToolManifest;
  const json = JSON.stringify(definition).replace(/</g, '\\u003c');
  const hooks = `${renderer.source}\nvar lockedDefinition = ${json};\n${CONSUMER_HOOKS}`;
  return {
    manifest,
    files: {
      'tool.json': JSON.stringify(manifest, null, 2), 'hooks.js': hooks,
      'template.html': CONSUMER_TEMPLATE, 'styles.css': `${renderer.styles}\n${definition.css}\n${CONSUMER_STYLES}`,
      'compilation.json': JSON.stringify({ compilerVersion: 1, rendererDigest: definition.rendererDigest, dependencies: definition.dependencies }),
      ...assets,
    },
  };
}

const CONSUMER_HOOKS = `
async function renderLocked(ctx) {
  var supplied = inputsFrom(ctx.model.filter(function(i) { return i.isDirty || i.bindToProfile; }));
  var result = LollyDesignRules.evaluateDesignTool(lockedDefinition, supplied);
  var v = result.variant;
  var model = [{id:'boxes',value:v.boxes},{id:'background',value:v.background},{id:'textDocument',value:v.textDocument?JSON.stringify(v.textDocument):''}];
  var computed = await compute(model);
  var rows = v.boxes.map(function(b,i) {
    var rule = result.textRules[b.id];
    var imageRule = result.imageRules[b.id] || {};
    return {id:b.id, framingId:result.framingMap[b.id] || '', fitGroup:result.fitGroups[b.id] || '', imageMinWidth:imageRule.minWidth || 0, imageMinHeight:imageRule.minHeight || 0, imageFormats:(imageRule.formats || []).join(','), input:result.inputMap[b.id] || '', hidden:computed.boxHide[i],
      style:computed.boxStyle[i], textStyle:computed.textStyle[i], text:computed.textHtml[i],
      mediaMarkup:computed.mediaHtml[i], path:computed.pathHtml[i],
      fit:rule && !b.textStory ? rule.mode : '', min:rule ? rule.min : 0, max:rule ? Math.min(rule.max, Number(b.fontSize) || rule.max) : 0,
      lines:rule ? rule.maxLines || 0 : 0, wrap:rule && !rule.wrap ? 'nowrap' : 'normal'};
  });
  return Object.assign({}, result.values, {designRows:rows, designWidth:v.width, designHeight:v.height,
    designBackground:v.background, designIssues:result.findings, connectorSvg:computed.connectorSvg,
    __lollyTextPreflight:computed.textPreflight ? { values:Object.keys(result.values).sort().map(function(id){return [id,result.values[id]];}), frames:computed.textPreflight.frames, issues:computed.textPreflight.issues } : null});
}
function onInit(ctx) { return renderLocked(ctx); }
function onInput(ctx) { return renderLocked(ctx); }
`;
const CONSUMER_TEMPLATE = `<div class="artboard lolly-locked-design" style="width:{{designWidth}}px;height:{{designHeight}}px;background:{{designBackground}}" data-design-width="{{designWidth}}" data-design-height="{{designHeight}}">
<div class="lolly-conn-wrap">{{{connectorSvg}}}</div>
{{#each designRows}}{{#unless hidden}}
<div class="lolly-box" data-design-layer="{{id}}" data-framing="{{framingId}}" data-fit-group="{{fitGroup}}" data-image-min-width="{{imageMinWidth}}" data-image-min-height="{{imageMinHeight}}" data-image-formats="{{imageFormats}}" data-public-input="{{input}}" style="{{style}}" data-design-fit="{{fit}}" data-fit-min="{{min}}" data-fit-max="{{max}}" data-fit-lines="{{lines}}">
{{{path}}}{{{mediaMarkup}}}<div class="lolly-box-text" style="{{textStyle}};white-space:{{wrap}}">{{{text}}}</div></div>
{{/unless}}{{/each}}</div>`;
const CONSUMER_STYLES = `.lolly-locked-design { position:relative;overflow:hidden;flex:none; }
.lolly-locked-design .lolly-box-text { min-width:0; }
`;
