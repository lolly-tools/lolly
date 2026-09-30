// SPDX-License-Identifier: MPL-2.0
/** Compile a captured tool session without replacing its renderer. */
import {
  designToolPolicy,
  validateDesignTool,
  type DesignToolDraftV1,
} from '@lolly-tools/core/design-tool-v1';
import type { InputModelItem, InputSpec } from '../inputs.ts';
import type { ToolManifest } from '../loader.ts';
import { RESERVED } from '../url-mode.ts';
import type { CompiledDesignTool } from './compiler.ts';

export interface SessionToolSource {
  manifest: ToolManifest;
  model: InputModelItem[];
  template: string;
  hooks: string;
  styles: string;
  css: string;
  assets: Record<string, unknown>;
  tokens: {
    entries: Array<{ path: string; value: unknown; type?: string | null }>;
    colors: unknown[];
    themes: unknown[];
    active: unknown;
  };
  dependencies: Array<{ path: string; digest: string; credit?: string }>;
}

export function compileSessionTool(
  draft: DesignToolDraftV1,
  source: SessionToolSource,
  files: Record<string, Uint8Array> = {}
): CompiledDesignTool {
  const issues = validateDesignTool(draft, [...RESERVED]);
  if (
    !draft.sourceTool ||
    draft.sourceTool.id !== source.manifest.id ||
    draft.sourceTool.version !== source.manifest.version
  )
    throw new Error('The source tool does not match this draft.');
  if (
    source.manifest.hooks?.module ||
    ['onFrame', 'onLevel', 'exportStill', 'exportFile'].some((key) =>
      Reflect.get(source.manifest.hooks || {}, key)
    ) ||
    source.manifest.composes?.length
  )
    throw new Error(
      'This tool needs live, composed or custom export behaviour. Use a still Design document to share its artwork with rules.'
    );
  if (/<script\b|\son\w+\s*=/i.test(source.template))
    throw new Error(
      'This tool has interactive canvas code. Its controls need a portable renderer before sharing with rules.'
    );
  for (const f of draft.inputs) {
    const original = source.manifest.inputs.find(
      (i) => i.id === draft.sourceTool!.inputs[f.input.id]
    );
    if (source.manifest.inputs.some((i) => i.id === f.input.id))
      throw new Error('The public input name overlaps a source input. Create a new rule for it.');
    if (!original || original.type !== f.input.type)
      throw new Error('Choose an existing source input with the same type.');
    if (
      original.maxLength !== undefined &&
      (f.input.maxLength === undefined || f.input.maxLength > original.maxLength)
    )
      throw new Error('Keep the source text limit or make it smaller.');
    if (
      original.type === 'number' &&
      ((original.min !== undefined && Number(f.input.min) < original.min) ||
        (original.max !== undefined && Number(f.input.max) > original.max))
    )
      throw new Error('Keep numeric limits inside the source range.');
    if (
      original.type === 'number' &&
      original.step &&
      (Math.abs(
        Number(f.input.step) / original.step - Math.round(Number(f.input.step) / original.step)
      ) > 1e-7 ||
        Math.abs(
          (Number(f.input.min) - (original.min || 0)) / original.step -
            Math.round((Number(f.input.min) - (original.min || 0)) / original.step)
        ) > 1e-7)
    )
      throw new Error('Keep numeric steps aligned with the source input.');
    if (
      original.type === 'select' &&
      f.input.options?.some((o) => !original.options?.some((p) => p.value === o.value))
    )
      throw new Error('Choose options offered by the source tool.');
  }
  if (issues.length) throw new Error(issues.map((i) => i.message).join('\n'));
  if (draft.formats.some((format) => !source.manifest.render.formats.includes(format)))
    throw new Error('Choose an export format supported by the source tool.');
  const variant = draft.variants[0]!;
  const manifest: ToolManifest = {
    id: draft.id,
    name: draft.name,
    version: draft.version,
    engineVersion: '^1.201.0',
    description: draft.description || 'A reusable tool with designer-selected inputs.',
    category: 'designer',
    status: 'community',
    isolate: true,
    requires: source.manifest.requires,
    render: {
      width: variant.width,
      height: variant.height,
      formats: draft.formats,
      dims: false,
      units: false,
    },
    designTool: designToolPolicy(draft),
    inputs: [...draft.inputs].sort((a, b) => Number(a.input.section === 'More options') - Number(b.input.section === 'More options')).map((f) => f.input as InputSpec),
    hooks: { onInit: true, onInput: true },
  };
  const json = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
  const names = ['onInit', 'onInput', 'beforeExport', 'afterExport'];
  const hooks = `var sourceState=${json({ model: source.model, mapping: draft.sourceTool.inputs, assets: source.assets, tokens: source.tokens })};\n${SESSION_BRIDGE}\nvar sourceHooks=(function(host){\nvar ${names.join(',')};\n${source.hooks}\nreturn {${names.map((n) => `${n}:typeof ${n}==='function'?${n}:null`).join(',')}};\n})(sourceHost);\n${SESSION_HOOKS}`;
  return {
    manifest,
    files: {
      ...files,
      'tool.json': JSON.stringify(manifest, null, 2),
      'hooks.js': hooks,
      'template.html': `<div class="artboard lolly-locked-design" data-source-tool="true" data-design-width="${variant.width}" data-design-height="${variant.height}" style="width:${variant.width}px;height:${variant.height}px"><span hidden data-source-tool-error>{{__lollySourceError}}</span>${source.template}</div>`,
      'styles.css': `${source.styles}\n${source.css}\n.lolly-locked-design{position:relative;overflow:hidden;flex:none;}`,
      'compilation.json': JSON.stringify({
        compilerVersion: 1,
        sourceTool: draft.sourceTool,
        dependencies: source.dependencies,
      }),
    },
  };
}

const SESSION_BRIDGE = String.raw`
var sourceDependencyError='';
var sourceRuntimeAssets=Object.create(null);
function sourceUnavailable(name){sourceDependencyError='This tool needs an unpackaged dependency: '+name;throw new Error(sourceDependencyError);}
function sourceToken(ref){var key=String(ref).replace(/^\{|\}$/g,'');var entry=sourceState.tokens.entries.find(function(e){return e.path===key;});return entry?entry.value:undefined;}
var sourceHost=Object.assign({},host,{
  profile:{get:async function(){return sourceUnavailable('profile data');}},
  state:{load:async function(){return sourceUnavailable('saved state');},save:async function(){return sourceUnavailable('saved state');},list:async function(){return sourceUnavailable('saved state');}},
  assets:{get:async function(id){if(Object.prototype.hasOwnProperty.call(sourceState.assets,id))return sourceState.assets[id];if(Object.prototype.hasOwnProperty.call(sourceRuntimeAssets,id))return sourceRuntimeAssets[id];return sourceUnavailable('asset '+id);},list:async function(){return Object.values(sourceState.assets);}},
  net:{fetch:async function(){return sourceUnavailable('network access');}},
  compose:undefined,
  tokens:{resolve:async function(ref){return sourceToken(ref);},colors:async function(){return sourceState.tokens.colors;},themes:async function(){return sourceState.tokens.themes;},active:async function(){return sourceState.tokens.active;},get:async function(){return {size:sourceState.tokens.entries.length,has:function(path){return sourceState.tokens.entries.some(function(e){return e.path===path;});},get:function(path){return sourceState.tokens.entries.find(function(e){return e.path===path;});},resolve:sourceToken,query:function(filter){return sourceState.tokens.entries.filter(function(e){return !filter||!filter.type||e.type===filter.type;});},colors:function(){return sourceState.tokens.colors;},themes:function(){return sourceState.tokens.themes;}};}}
});
`;
const SESSION_HOOKS = `
function sourceModel(ctx){return sourceState.model.map(function(item){var publicId=Object.keys(sourceState.mapping).find(function(id){return sourceState.mapping[id]===item.id;});var input=ctx.model.find(function(i){return i.id===publicId;});return Object.assign({},item,{value:input?input.value:item.value===undefined?undefined:JSON.parse(JSON.stringify(item.value)),isDirty:true});});}
async function sourceRun(name,ctx){
  sourceDependencyError='';
  sourceRuntimeAssets=Object.create(null);
  ctx.model.forEach(function(item){var value=item.value;if(value&&typeof value==='object'&&typeof value.id==='string'&&typeof value.url==='string')sourceRuntimeAssets[value.id]=value;});
  var model=sourceModel(ctx), values=Object.fromEntries(model.map(function(i){return [i.id,i.value];}));
  try {
    var callback=sourceHooks[name], patch=callback?await callback(Object.assign({},ctx,{model:model,host:sourceHost,id:sourceState.mapping[ctx.id]||ctx.id,report:undefined})):{};
    if(sourceDependencyError)throw new Error(sourceDependencyError);
    var exportOptions={};
    for(var format of ['png','svg','pdf']) {
      var settings={}, exportContext={format:format,opts:settings,host:sourceHost};
      Object.defineProperty(exportContext,'node',{get:function(){throw new Error('This tool adjusts its canvas during export. Use Design to prepare portable still artwork.');}});
      if(sourceHooks.beforeExport)await sourceHooks.beforeExport(exportContext);
      if(sourceHooks.afterExport)await sourceHooks.afterExport(exportContext);
      if(Object.keys(settings).some(function(key){return key!=='background';}))throw new Error('This tool requires custom export settings. Use Design to prepare portable still artwork.');
      exportOptions[format]=settings;
    }
    if(sourceDependencyError)throw new Error(sourceDependencyError);
    var output=Object.assign({},values,patch||{},{__lollySourceError:'',__lollySourceExportOptions:exportOptions});
    Object.keys(sourceState.mapping).forEach(function(id){var original=sourceState.mapping[id];output[id]=patch&&Object.prototype.hasOwnProperty.call(patch,original)?patch[original]:values[original];output[original]=output[id];});
    return output;
  }catch(error){return Object.assign({},values,{__lollySourceError:String(error.message||error)});}
}
function onInit(ctx){return sourceRun('onInit',ctx);}
function onInput(ctx){return sourceRun('onInput',ctx);}
`;
