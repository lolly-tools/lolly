// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createMockHost } from '@lolly-tools/core';
import { evaluateDesignTool, validateDesignTool, type DesignToolDefinitionV1 } from '@lolly-tools/core/design-tool-v1';
import { compileDesignTool } from '../engine/src/design-tool/compiler.ts';
import { designExportSize } from '../engine/src/design-tool/policy.ts';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { buildLollyFile, readLollyFile, extractBundledTool } from '../shells/web/src/lib/lolly-pack.ts';

export function rulesFixture(): DesignToolDefinitionV1 {
  return {
    schemaVersion: 1, compilerVersion: 1, rendererDigest: 'fixture', css: '', dependencies: [],
    id: 'welcome-card-fixture', name: 'Welcome card', version: '1.0.0', presentation: 'sidebar', formats: ['png', 'svg', 'pdf'],
    defaultVariant: 'light',
    variants: [
      { id: 'light', label: 'Light', width: 800, height: 400, background: '#ffffff', boxes: [{ id: 'title', text: 'Welcome', x: 40, y: 40, w: 700, h: 100, font: 'sans', fontSize: 48, fg: '#111111', plainText: true }] },
      { id: 'dark', label: 'Dark', width: 400, height: 600, background: '#111111', boxes: [{ id: 'title-dark', text: 'Welcome', x: 40, y: 40, w: 320, h: 150, font: 'sans', fontSize: 48, fg: '#ffffff', plainText: true }] },
    ],
    inputs: [
      { input: { id: 'theme', label: 'Theme', type: 'select', default: 'light', options: [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }] }, targets: [] },
      { input: { id: 'firstname', label: 'First name', type: 'text', default: 'Sam', required: true, maxLength: 40 }, common: { key: 'firstname', subject: 'person', source: 'brief' }, text: { mode: 'shrink', min: 24, max: 48, wrap: true }, targets: [{ variantId: 'light', layerId: 'title', property: 'text' }, { variantId: 'dark', layerId: 'title-dark', property: 'text' }] },
    ],
    choices: [{ inputId: 'theme', options: [{ value: 'light', label: 'Light', variantId: 'light', writes: [] }, { value: 'dark', label: 'Dark', variantId: 'dark', writes: [] }] }], recipes: [],
  };
}

test('rules reject conflicting ownership and keep common text across artboards', () => {
  const d = rulesFixture();
  assert.deepEqual(validateDesignTool(d), []);
  assert.equal(evaluateDesignTool(d, { theme: 'dark', firstname: 'Andy' }).variant.boxes[0]!.text, 'Andy');
  assert.equal(d.variants[1]!.boxes[0]!.text, 'Welcome');
  d.choices[0]!.options[1]!.writes.push({ variantId: 'dark', layerId: 'title-dark', property: 'text', value: 'Theme text' });
  assert.ok(validateDesignTool(d).some(i => i.code === 'ownership'));
  d.choices[0]!.options[1]!.fixedInputs = ['firstname'];
  assert.equal(evaluateDesignTool(d, { theme: 'dark', firstname: 'Bypass' }).variant.boxes[0]!.text, 'Theme text');
});

test('compiler mounts the ordinary runtime with literal inputs and no editor payload', async () => {
  const renderer = { source: await readFile('community/design/assets/rules-renderer.js', 'utf8'), styles: await readFile('community/design/styles.css', 'utf8') };
  const compiled = compileDesignTool(rulesFixture(), renderer);
  const tool = await loadTool(compiled.manifest.id, async path => String(compiled.files[path.slice(compiled.manifest.id.length + 1)] ?? ''));
  const runtime = await createRuntime(tool, createMockHost(), { firstname: '**Sam** <script>' });
  assert.deepEqual(runtime.getModel().map(i => i.id), ['theme', 'firstname']);
  assert.match(runtime.getHydrated(), /\*\*Sam\*\* &lt;script&gt;/);
  assert.doesNotMatch(runtime.getHydrated(), /data-canvas-input|data-penpot-doc|<script/);
  assert.deepEqual(runtime.hookErrors, []);
  await assert.rejects(runtime.setInput('boxes', []), /fixed by the designer/);
  await assert.rejects(runtime.applyPatch({boxes:[]}), /fixed by the designer/);
  await assert.rejects(runtime.setInput('firstname', 'a'.repeat(41)), /full value has been kept/);
  await runtime.setInput('theme', 'dark');
  assert.match(runtime.getHydrated(), /data-design-width="400"/);
  assert.throws(() => designExportSize(compiled.manifest.designTool!, { theme: 'dark' }, 'pptx'), /not enabled/);
  assert.throws(() => designExportSize(compiled.manifest.designTool!, { theme: 'dark' }, 'png', 800, 400), /proportions/);
  runtime.destroy();
});

test('recipient instructions and secondary placement survive compilation without changing the policy order', async () => {
  const draft = rulesFixture(); draft.description = 'Enter a name, then download your card.';
  draft.inputs[0]!.input.section = 'More options';
  const compiled = compileDesignTool(draft, { source: await readFile('community/design/assets/rules-renderer.js', 'utf8'), styles: '' });
  assert.equal(compiled.manifest.description, draft.description);
  assert.deepEqual(compiled.manifest.inputs.map(input => input.id), ['firstname', 'theme']);
  assert.deepEqual(draft.inputs.map(field => field.input.id), ['theme', 'firstname']);
  draft.description = 'x'.repeat(2001);
  assert.ok(validateDesignTool(draft).some(issue => issue.code === 'description'));
});

test('tool packages round-trip without a session and keep old session writers compatible', async () => {
  const renderer = { source: await readFile('community/design/assets/rules-renderer.js', 'utf8'), styles: await readFile('community/design/styles.css', 'utf8') };
  const compiled = compileDesignTool(rulesFixture(), renderer);
  const files = Object.fromEntries(Object.entries(compiled.files).map(([path, value]) => [path, typeof value === 'string' ? new TextEncoder().encode(value) : value]));
  const pack = await buildLollyFile({ kind: 'tool', session: null, toolId: compiled.manifest.id, userAssets: [], tool: { id: compiled.manifest.id, version: '1.0.0', trust: 'custom', files } });
  const parsed = await readLollyFile(new Uint8Array(await pack.blob.arrayBuffer()));
  assert.equal(parsed.manifest.minReader, 2);
  assert.equal(parsed.manifest.kind, 'tool');
  assert.equal(parsed.session, null);
  assert.equal(parsed.files['session.json'], undefined);
  assert.deepEqual(extractBundledTool(parsed)?.files['hooks.js'], files['hooks.js']);
  const legacy = await buildLollyFile({ session: { heading: 'Existing session' }, toolId: 'existing-tool', userAssets: [] });
  assert.equal(legacy.manifest.minReader, 1);
  assert.deepEqual((await readLollyFile(new Uint8Array(await legacy.blob.arrayBuffer()))).session, { heading: 'Existing session' });
});

test('choice defaults change untouched fields and preserve reader content', async () => {
  const d = rulesFixture();
  d.choices[0]!.options[0]!.defaults = {firstname:'Day'};
  d.choices[0]!.options[1]!.defaults = {firstname:'Night'};
  const compiled = compileDesignTool(d,{source:await readFile('community/design/assets/rules-renderer.js','utf8'),styles:''});
  const tool = await loadTool(d.id, async p => String(compiled.files[p.slice(d.id.length + 1)] || ''));
  const runtime = await createRuntime(tool,createMockHost());
  assert.equal(runtime.getModel().find(i => i.id === 'firstname')?.value,'Day');
  await runtime.setInput('theme','dark');
  assert.equal(runtime.getModel().find(i => i.id === 'firstname')?.value,'Night');
  await runtime.setInput('firstname','Reader'); await runtime.setInput('theme','light');
  assert.equal(runtime.getModel().find(i => i.id === 'firstname')?.value,'Reader');
  runtime.destroy();
});

test('strict worker evaluates the shared renderer and rejects ambient execution', async () => {
  const {createNodeHookExecutor} = await import('@lolly-tools/node-shell/hook-worker');
  const d = rulesFixture(); const compiled = compileDesignTool(d,{source:await readFile('community/design/assets/rules-renderer.js','utf8'),styles:''});
  const tool = await loadTool(d.id, async p => String(compiled.files[p.slice(d.id.length + 1)] || ''),{trustClass:'sideloaded-consented'});
  const runtime = await createRuntime(tool,createMockHost(),{firstname:'Isolated'}, {hookExecutor:createNodeHookExecutor({strict:true})});
  try { assert.match(runtime.getHydrated(),/Isolated/); assert.deepEqual(runtime.hookErrors,[]); }
  finally { runtime.destroy(); }
});

test('ranges reject invalid raw input and block stale output until corrected', async () => {
  const d = rulesFixture();
  d.inputs.push({input:{id:'size',label:'Size',type:'number',min:24,max:48,step:2,default:48},targets:[{variantId:'light',layerId:'title',property:'fontSize'}]});
  const compiled = compileDesignTool(d,{source:await readFile('community/design/assets/rules-renderer.js','utf8'),styles:''});
  const tool = await loadTool(d.id, async p => String(compiled.files[p.slice(d.id.length + 1)] || ''));
  const runtime = await createRuntime(tool,createMockHost());
  for (const value of [25,49,NaN,Infinity]) await assert.rejects(runtime.setInput('size',value),/steps of 2/);
  await assert.rejects(runtime.export({},'png'),/steps of 2/);
  await runtime.setInput('size',40);
  await assert.rejects(runtime.export({},'png'),{code:'NEEDS_BROWSER'});
  runtime.destroy();
});

test('common inputs retain full raw names with per-output errors and detachment', async () => {
  const {commonInputKit,applyKit,captureKitEdits,kitRowIssues} = await import('../shells/web/src/pro/kit-model.ts');
  const first = compileDesignTool(rulesFixture(),{source:'',styles:''}).manifest;
  const second = structuredClone(first); second.id = 'second-card'; second.designTool!.inputs[1]!.input.maxLength = 4;
  const rows = [{toolId:first.id,manifest:first,values:{firstname:'Sam'}},{toolId:second.id,manifest:second,values:{firstname:'Sam'}}];
  const kit = commonInputKit(rows);
  kit.brief['person-firstname'] = 'Longname'; applyKit(kit,rows);
  assert.equal(rows[0]!.values.firstname,'Longname'); assert.equal(rows[1]!.values.firstname,'Longname');
  assert.equal(kitRowIssues(kit,rows).length,1);
  rows[1]!.values.firstname = 'Jo'; captureKitEdits(kit,rows);
  kit.brief['person-firstname'] = 'Ann'; applyKit(kit,rows);
  assert.equal(rows[0]!.values.firstname,'Ann'); assert.equal(rows[1]!.values.firstname,'Jo');
  kit.detached['asset-2'] = []; applyKit(kit,rows); assert.equal(rows[1]!.values.firstname,'Ann');
});

test('Node and web readers agree on the tool payload and reject altered bytes', async () => {
  const {readLollyFile: readNode} = await import('@lolly-tools/node-shell/lolly-file');
  const {unzipSync,zipSync} = await import('fflate');
  const d = rulesFixture(); const compiled = compileDesignTool(d,{source:'',styles:''});
  const pack = await buildLollyFile({kind:'tool',session:null,toolId:d.id,toolVersion:d.version,name:d.name,userAssets:[],tool:{id:d.id,version:d.version,trust:'custom',files:Object.fromEntries(Object.entries(compiled.files).map(([p,v]) => [p,typeof v === 'string' ? new TextEncoder().encode(v) : v]))}});
  const bytes = new Uint8Array(await pack.blob.arrayBuffer());
  assert.equal(readNode(bytes,{allowTool:true}).manifest.kind,'tool');
  assert.throws(() => readNode(bytes),/reusable tool/);
  const parts = unzipSync(bytes); parts['tool/hooks.js'] = new TextEncoder().encode('changed'); const changed = zipSync(parts);
  await assert.rejects(readLollyFile(changed),/integrity/); assert.throws(() => readNode(changed,{allowTool:true}),/integrity/);
});

test('authoring schema is mirrored and accepts the public example', async () => {
  const {default:Ajv} = await import('ajv');
  const schema = await readFile('schemas/design-tool-v1.schema.json','utf8');
  assert.equal(schema,await readFile('packages/core/schema/design-tool-v1.schema.json','utf8'));
  const validate = new Ajv({strict:false}).compile(JSON.parse(schema));
  const draft = rulesFixture(); delete (draft as Partial<typeof draft>).rendererDigest;
  assert.equal(validate(draft),true,JSON.stringify(validate.errors));
  assert.deepEqual(evaluateDesignTool({...rulesFixture(),inputs:[...rulesFixture().inputs,{input:{id:'size',label:'Size',type:'number',min:20,max:48,step:1,default:40},targets:[{variantId:'light',layerId:'title',property:'fontSize'}]}]},{size:30}).variant.boxes[0]!.fontSize,30);
});

test('URL positioning uses bounded partial axes and choice defaults have one owner', async () => {
  const {validateDesignValues,designToolPolicy} = await import('@lolly-tools/core/design-tool-v1');
  const {parseUrlState} = await import('../engine/src/url-mode.ts');
  const d = rulesFixture();
  d.inputs.push({input:{id:'position',label:'Image position',type:'vector',default:{x:50,y:50,zoom:100},fields:[{id:'x',min:10,max:90,step:1},{id:'y',min:0,max:100,step:1},{id:'zoom',min:100,max:200,step:5}]},targets:[{variantId:'light',layerId:'title',property:'imageFraming'}]});
  const policy = designToolPolicy(d);
  const manifest = compileDesignTool(d,{source:'',styles:''}).manifest;
  const parsed = parseUrlState('position.x=25',manifest);
  assert.deepEqual(validateDesignValues(policy,parsed.values),[]);
  assert.ok(validateDesignValues(policy,parseUrlState('position.zoom=300',manifest).values).length);
  d.inputs.unshift({input:{id:'occasion',label:'Occasion',type:'select',default:'event',options:[{value:'event',label:'Event'}]},targets:[]});
  d.choices[0]!.options[0]!.defaults = {firstname:'Day'};
  d.choices.push({inputId:'occasion',options:[{value:'event',label:'Event',writes:[],defaults:{firstname:'Other'}}]});
  assert.ok(validateDesignTool(d).some(f => f.code === 'ownership' && f.inputId === 'firstname'));
});

test('the shipped renderer is built from the SDK and canonical Design regions', async () => {
  const {execFileSync} = await import('node:child_process');
  execFileSync(process.execPath,['scripts/build-design-tool-renderer.ts','--check'],{stdio:'pipe'});
});

test('sample history retains deliberate empty values and has independent reset and redo', async () => {
  const {DesignPreviewHistory} = await import('../shells/web/src/lib/design-preview-history.ts');
  const history = new DesignPreviewHistory();
  history.edit('firstname','Alex'); history.edit('lastname','');
  assert.deepEqual(history.values,{firstname:'Alex',lastname:''});
  assert.equal(history.undo(),true); assert.deepEqual(history.values,{firstname:'Alex'});
  assert.equal(history.undo(true),true); assert.equal(history.values.lastname,'');
  history.replace({}); assert.deepEqual(history.values,{}); history.undo();
  assert.deepEqual(history.values,{firstname:'Alex',lastname:''});
});

test('corrected-source rebind refuses ambiguous matches and preserves all rule references', async () => {
  const {suggestDesignRebind,rebindDesignTool} = await import('../shells/web/src/lib/design-tool-rebind.ts');
  const d=rulesFixture(); const original=d.variants[0]!.boxes[0]!;
  const replacement={...original,id:'corrected'};
  assert.equal(suggestDesignRebind(original,[replacement]),'corrected');
  assert.equal(suggestDesignRebind(original,[replacement,{...replacement,id:'ambiguous'}]),undefined);
  const variants=structuredClone(d.variants); variants[0]!.boxes=[replacement];
  const mapping=Object.fromEntries(d.variants.flatMap(v=>v.boxes.map(b=>[`${v.id}/${b.id}`,v.id===variants[0]!.id?'corrected':String(b.id)])));
  const next=rebindDesignTool(d,variants,mapping);
  assert.deepEqual(next.inputs,d.inputs);assert.deepEqual(next.recipes,d.recipes);
  assert.equal(next.variants[0]!.boxes[0]!.id,original.id);
  assert.throws(()=>rebindDesignTool(d,variants,{}),/replacement/);
});

test('shared fitted text and framing targets travel in the compiled renderer', async () => {
  const d=rulesFixture();const f=d.inputs.find(f=>f.input.id==='firstname')!;
  f.targets=[{variantId:'light',layerId:'title',property:'text'}];f.text={mode:'shrink',min:20,max:48,wrap:true,sharedSize:true};d.recipes=d.recipes.filter(r=>r.target.variantId!=='light');
  d.variants[0]!.boxes.push({id:'photo',kind:'image',x:0,y:0,w:300,h:200});
  d.inputs.push({input:{id:'photo',label:'Headshot',type:'asset',assetType:'image',default:''},targets:[{variantId:'light',layerId:'photo',property:'image'}],image:{minWidth:800,minHeight:600,formats:['jpeg','png']},common:{key:'headshot',subject:'presenter',source:'brief'}},{input:{id:'photoFraming',label:'Position',type:'vector',framingFor:'photo',default:{x:40,y:30,zoom:120},fields:[{id:'x',min:20,max:70,step:1,default:40},{id:'y',min:10,max:60,step:1,default:30},{id:'zoom',min:100,max:200,step:1,default:120}]},targets:[{variantId:'light',layerId:'photo',property:'imageFraming'}]});
  assert.deepEqual(validateDesignTool(d),[]);
  const compiled=compileDesignTool(d,{source:await readFile('community/design/assets/rules-renderer.js','utf8'),styles:''});
  const tool=await loadTool(d.id,async path=>String(compiled.files[path.slice(d.id.length+1)]||''));
  const runtime=await createRuntime(tool,createMockHost());
  assert.match(runtime.getHydrated(),/data-framing="photoFraming"/);assert.match(runtime.getHydrated(),/data-fit-group="firstname"/);assert.match(runtime.getHydrated(),/data-image-min-width="800"/);
  runtime.destroy();d.inputs.at(-2)!.image!.minWidth=-1;assert.ok(validateDesignTool(d).some(i=>i.code==='image-rule'));
});

test('shared briefs keep recipient and presenter names separate', async () => {
  const {commonInputKit}=await import('../shells/web/src/pro/kit-model.ts');
  const a=rulesFixture();a.inputs.find(f=>f.input.id==='firstname')!.common={key:'firstname',subject:'recipient',source:'brief'};
  const b=structuredClone(a);b.id='presenter-tool';b.inputs.find(f=>f.input.id==='firstname')!.common!.subject='presenter';
  const rows=[a,b].map(d=>({toolId:d.id,manifest:compileDesignTool(d,{source:'',styles:''}).manifest,values:{firstname:d===a?'Alex':'Sam'}}));
  const kit=commonInputKit(rows);assert.equal(kit.brief['recipient-firstname'],'Alex');assert.equal(kit.brief['presenter-firstname'],'Sam');
});

test('Preview translates private font choices back to authored values', async()=>{
  const {designPreviewValue}=await import('../shells/web/src/lib/design-preview-history.ts');
  const draft=rulesFixture();draft.inputs.push({input:{id:'typeface',type:'select',label:'Typeface',default:'sans',options:[{value:'sans',label:'Brand'},{value:'mono',label:'Mono'}]},targets:[{variantId:'light',layerId:'title',property:'font'}]});
  const inputs=draft.inputs.map(f=>structuredClone(f.input));inputs.at(-1)!.options=[{value:'LollyFontA',label:'Brand'},{value:'LollyFontB',label:'Mono'}];
  assert.equal(designPreviewValue(draft,inputs,'typeface','LollyFontB',false),'mono');
  assert.equal(designPreviewValue(draft,inputs,'typeface','mono',true),'LollyFontB');
  assert.equal(designPreviewValue(draft,inputs,'firstname','Original',false),'Original');
});
