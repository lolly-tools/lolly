// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { createMockHost } from '@lolly-tools/core';
import { createRuntime, HOOK_BUDGET_MS } from '../engine/src/runtime.ts';
import { loadTool } from '../engine/src/loader.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import { parseUrlState, serializeUrlState } from '../engine/src/url-mode.ts';
import { createTextCompositionAPI } from '../packages/node-shell/src/text-composition.ts';
import { upgradeDesignText, defaultTextFrameSettings, readDesignText } from '../engine/src/text-design.ts';
const tool=await loadTool('design',path=>readFile(new URL(`../community/${path}`,import.meta.url),'utf8'));
const bytes=await readFile('shells/web/public/fonts/SUSE[wght].ttf');
const parser=new (new JSDOM('').window.DOMParser)(),parseXml=(source:string)=>parser.parseFromString(source,'image/svg+xml');
const font={id:'sans',family:'SUSE',sha256:createHash('sha256').update(bytes).digest('hex'),faceIndex:0,source:{kind:'bundled' as const,path:'/fonts/SUSE[wght].ttf'}};
function host(){const value=createMockHost();value.geom=makeGeomApi();value.text={...value.text!,...createTextCompositionAPI(async()=>bytes,parseXml)};return value;}
test('the actual Design render, appended URL fields and reopen preserve composed source and paths',async()=>{
  const initial=upgradeDesignText('',[{id:'box',kind:'text',text:'',x:5,y:10,w:180,h:40}],'box',{storyId:'story',source:'Office e\u0301\u00a0copy\r\nLast line\n',character:{font:'sans',size:24,weight:400,color:'#225577'},fonts:[font],settings:defaultTextFrameSettings('auto-height')});
  const runtime=await createRuntime(tool,host(),initial as Parameters<typeof createRuntime>[2]);
  try{
    assert.deepEqual(runtime.hookErrors,[]);const markup=runtime.getHydrated();assert.match(markup,/data-composed-text="story"/);
    const parsed=parseUrlState(serializeUrlState(runtime.getModel()),tool.manifest);
    assert.equal(parsed.values.textDocument,initial.textDocument);
    const reopened=await createRuntime(tool,host(),parsed.values);
    try{assert.deepEqual(reopened.hookErrors,[]);const first=new JSDOM(markup).window.document,next=new JSDOM(reopened.getHydrated()).window.document;
      assert.equal(next.querySelector('[data-composed-text]')!.outerHTML,first.querySelector('[data-composed-text]')!.outerHTML);
      assert.equal(next.querySelector('[data-box-id]')!.getAttribute('style'),first.querySelector('[data-box-id]')!.getAttribute('style'));}finally{reopened.destroy();}
    const boxes=parsed.values.boxes as Record<string,unknown>[];
    assert.ok(Number(boxes[0]!.h)>40);assert.equal(Number(boxes[0]!.w),180);
    const model=readDesignText(parsed.values.textDocument,boxes);assert.equal(model.document.stories[0]!.source,'Office e\u0301\u00a0copy\r\nLast line\n');
  }finally{runtime.destroy();}
});
test('font pin failures remain visible and block export instead of delivering empty text',async()=>{
  const initial=upgradeDesignText('',[{id:'box',kind:'text',text:'',w:180,h:80}],'box',{storyId:'story',source:'Hello',character:{font:'sans'},fonts:[{...font,sha256:'0'.repeat(64)}]});
  const runtime=await createRuntime(tool,host(),initial as Parameters<typeof createRuntime>[2]);
  try{assert.ok(runtime.hookErrors.length);await assert.rejects(()=>runtime.export({} as Element,'svg',{c2pa:false}),/font content changed/i);}finally{runtime.destroy();}
});
test('mixed paragraph emoji use the chosen pack, survive source edits and report only visible artwork',async()=>{
  const {createNodeEmojiAPI}=await import('../packages/node-shell/src/emoji.ts');
  const emoji=await createNodeEmojiAPI({parseXml}),sets=await emoji.sets();
  const value=host();value.emoji=emoji;
  const initial=upgradeDesignText('',[{id:'box',kind:'text',text:'',w:350,h:150}],'box',{storyId:'story',source:'Office 😀 ❤️\nSecond 👨‍👩‍👧‍👦',character:{font:'sans',size:24,color:'#22668880'},fonts:[font]});
  const runtime=await createRuntime(tool,value,initial as Parameters<typeof createRuntime>[2]);
  try{
    assert.deepEqual(runtime.hookErrors,[]);
    const set=sets.find(set=>set.pin.id==='community/emoji/twemoji/color')!;
    await runtime.setEmojiStyle({schemaVersion:1,primary:set.pin,fallbacks:[],metricsPolicy:'inline-em-v1',treatment:{mode:'original',strengthBps:0}});
    assert.deepEqual(runtime.hookErrors,[]);
    const node=new JSDOM(runtime.getHydrated()).window.document.body;
    await runtime.applyEmojiToDom(node);
    assert.equal(runtime.emojiIngredients().length,3);
    assert.match(runtime.emojiCredits(),/Twemoji/);
    assert.equal(node.querySelectorAll('[data-composed-text] svg').length,3);
    const before=node.querySelector('[data-composed-text]')!.outerHTML;
    const black=sets.find(set=>set.pin.id==='community/emoji/openmoji/black')!;
    await runtime.setEmojiStyle({schemaVersion:1,primary:black.pin,fallbacks:[],metricsPolicy:'inline-em-v1',treatment:{mode:'original',strengthBps:0}});
    assert.notEqual(new JSDOM(runtime.getHydrated()).window.document.querySelector('[data-composed-text]')!.outerHTML,before);
    const model=readDesignText(initial.textDocument,initial.boxes);
    const layout=await runtime.layoutText({document:model.document,storyId:'story',frames:model.frames,includeSvg:true});
    assert.equal(layout.lines.flatMap(line=>line.inlines).length,3);
    assert.ok(layout.resources.some(resource=>resource.id.includes('emoji')));
    assert.ok(layout.lines.flatMap(line=>line.inlines).every(inline=>!inline.svg.includes('currentColor')));
  }finally{runtime.destroy();}
});


test('export preflight refuses stale text and requires a named choice for clipped source',async()=>{
  const initial=upgradeDesignText('',[{id:'box',kind:'text',text:'',w:180,h:60}],'box',{storyId:'story',source:'A short heading',character:{font:'sans',size:24},fonts:[font],settings:defaultTextFrameSettings('fixed')});
  const value=host();let rendered=0;value.export.render=async()=>{rendered++;return new Blob(['ok']);};const runtime=await createRuntime(tool,value,initial as Parameters<typeof createRuntime>[2]);
  try{
    const old=new JSDOM(runtime.getHydrated()).window.document.body;
    const missing=new JSDOM(runtime.getHydrated()).window.document.body;missing.querySelector('[data-text-frame]')!.remove();
    await assert.rejects(()=>runtime.export(missing,'svg',{c2pa:false}),/layout is still changing/);assert.equal(rendered,0);
    const doc=JSON.parse(initial.textDocument);doc.stories[0].source='A longer article that continues beyond the last frame. '.repeat(8);doc.stories[0].paragraphs[0].end=doc.stories[0].source.length;doc.stories[0].revision++;
    await runtime.setInput('textDocument',JSON.stringify(doc));const current=new JSDOM(runtime.getHydrated()).window.document.body;
    await assert.rejects(()=>runtime.export(current,'svg',{c2pa:false}),/Export visible text only/);assert.equal(rendered,0);
    await runtime.setInput('exportVisibleText',true);
    await assert.rejects(()=>runtime.export(old,'svg',{c2pa:false}),/layout is still changing/);assert.equal(rendered,0);
    await runtime.export(current,'svg',{c2pa:false});assert.equal(rendered,1);assert.equal(current.querySelector('[data-text-frame]')!.getAttribute('overflow'),'hidden');assert.equal(JSON.parse(runtime.getModel().find(item=>item.id==='textDocument')!.value as string).stories[0].source,doc.stories[0].source);
  }finally{runtime.destroy();}
});

test('text export detects edits made while an asynchronous preflight is settling',{timeout:10000},async()=>{
  const initial=upgradeDesignText('',[{id:'box',kind:'text',text:'',w:300,h:100}],'box',{storyId:'story',source:'Before export',character:{font:'sans',size:24},fonts:[font]});
  const value=host();let release!:()=>void,entered!:()=>void;
    const waiting=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>(resolve=>{entered=resolve;});
  value.state.load=async()=>{entered();await waiting;return null;};
  const pausedTool={...tool,hooksSource:`${tool.hooksSource}\nconst originalBeforeExport=beforeExport;beforeExport=async ctx=>{await host.state.load('test-preflight');return originalBeforeExport(ctx);};`};
  const runtime=await createRuntime(pausedTool,value,initial as Parameters<typeof createRuntime>[2]);
  try{const exporting=runtime.export(new JSDOM(runtime.getHydrated()).window.document.body,'svg',{c2pa:false});
    await started;await runtime.setInput('background','#112233');release();await assert.rejects(()=>exporting,/text changed while its export/);
  }finally{runtime.destroy();}
});

test('hidden editable vector backups validate their source without requiring the original font to export', async () => {
  const initial = upgradeDesignText('', [{ id: 'source', kind: 'text', text: '', w: 180, h: 60, hidden: true, vectorSource: JSON.stringify({ version: 1, sourceCopy: true }) }, { id: 'vector', kind: 'path', path: 'M0 0L80 0L80 40Z', w: 80, h: 40, x: 0, y: 0, fill: '#223344' }], 'source', { storyId: 'story', source: 'Editable backup', character: { font: 'sans', size: 24 }, fonts: [{ ...font, sha256: '0'.repeat(64) }], settings: defaultTextFrameSettings('fixed') });
  const value = host(); let rendered = 0; value.export.render = async () => { rendered++; return new Blob(['ok']); };
  const runtime = await createRuntime(tool, value, initial as Parameters<typeof createRuntime>[2]);
  try {
    assert.deepEqual(runtime.hookErrors, []); const node = new JSDOM(runtime.getHydrated()).window.document.body;
    assert.ok(node.querySelector('[data-box-id="vector"] path')); assert.equal(node.querySelectorAll('[data-text-frame]').length, 0);
    await runtime.export(node, 'svg', { c2pa: false }); assert.equal(rendered, 1);
    assert.equal(JSON.parse(runtime.getModel().find(item => item.id === 'textDocument')!.value as string).stories[0].source, 'Editable backup');
    const boxes = runtime.getModel().find(item => item.id === 'boxes')!.value as Array<Record<string, unknown>>;
    await runtime.setInput('boxes', boxes.map(box => box.id === 'source' ? { ...box, hidden: false } : box) as Parameters<typeof runtime.setInput>[1]);
    await assert.rejects(() => runtime.export(node, 'svg', { c2pa: false }), /font content changed/i);
    const doc = JSON.parse(initial.textDocument); doc.fonts[0] = font; await runtime.setInput('textDocument', JSON.stringify(doc));
    const restored = new JSDOM(runtime.getHydrated()).window.document.body;
    assert.ok(restored.querySelector('[data-text-frame="source"]')); assert.ok(!restored.querySelector('[data-box-id="source"]')!.hasAttribute('data-export-hide'));
    await runtime.export(restored, 'svg', { c2pa: false }); assert.equal(rendered, 2);
  } finally { runtime.destroy(); }
});

test('a slow onInput during setEmojiStyle is logged and does not reject, so a large document still mounts',async()=>{
  const {createNodeEmojiAPI}=await import('../packages/node-shell/src/emoji.ts');
  const emoji=await createNodeEmojiAPI({parseXml}),sets=await emoji.sets();
  const value=host();value.emoji=emoji;const logs:string[]=[];value.log=(level:string,message:string)=>{logs.push(`${level}:${message}`);};
  const initial=upgradeDesignText('',[{id:'box',kind:'text',text:'',w:350,h:150}],'box',{storyId:'story',source:'Office 😀 copy',character:{font:'sans',size:24},fonts:[font]});
  const runtime=await createRuntime(tool,value,initial as Parameters<typeof createRuntime>[2]);
  const budget=HOOK_BUDGET_MS.onInput;
  try{
    const set=sets.find(set=>set.pin.id==='community/emoji/twemoji/color')!;
    await runtime.setEmojiStyle({schemaVersion:1,primary:set.pin,fallbacks:[],metricsPolicy:'inline-em-v1',treatment:{mode:'original',strengthBps:0}});
    HOOK_BUDGET_MS.onInput=1;
    const black=sets.find(set=>set.pin.id==='community/emoji/openmoji/black')!;
    await runtime.setEmojiStyle({schemaVersion:1,primary:black.pin,fallbacks:[],metricsPolicy:'inline-em-v1',treatment:{mode:'original',strengthBps:0}});
    assert.ok(logs.some(line=>/^warn:onInput timed out/.test(line)),'the overrun is logged as a warning');
  }finally{HOOK_BUDGET_MS.onInput=budget;runtime.destroy();}
});

test('a style given at creation lays text out once; applying it again runs nothing and still carries its pack',async()=>{
  const {createNodeEmojiAPI}=await import('../packages/node-shell/src/emoji.ts');
  const emoji=await createNodeEmojiAPI({parseXml}),sets=await emoji.sets();
  const style={schemaVersion:1 as const,primary:sets.find(set=>set.pin.id==='community/emoji/twemoji/color')!.pin,fallbacks:[],metricsPolicy:'inline-em-v1' as const,treatment:{mode:'original' as const,strengthBps:0}};
  const initial=upgradeDesignText('',[{id:'box',kind:'text',text:'',w:350,h:150}],'box',{storyId:'story',source:'Office 😀 ❤️\nSecond line',character:{font:'sans',size:24},fonts:[font]});
  // A host that lists each pack as a dependency, so the assets a save carries are visible.
  const withDependencies={...emoji,dependencies:async(pins:readonly {id:string}[])=>pins.map(pin=>({id:`pack:${pin.id}`}) as never)};
  const counted=()=>{const value=host();value.emoji=withDependencies;let calls=0;const layout=value.text!.layoutRuns!;value.text={...value.text!,layoutRuns:async request=>{calls++;return layout(request);}};return {value,calls:()=>calls};};
  // The old order: the default style first, then the document's own.
  const two=counted(),before=await createRuntime(tool,two.value,initial as Parameters<typeof createRuntime>[2]);
  const one=counted();let after:Awaited<ReturnType<typeof createRuntime>>|undefined;
  try{
    await before.setEmojiStyle(style);
    after=await createRuntime(tool,one.value,initial as Parameters<typeof createRuntime>[2],{emojiStyle:style});
    assert.deepEqual(after.hookErrors,[]);
    assert.equal(after.getHydrated(),before.getHydrated(),'the same render as seeding the style after creation');
    assert.ok(one.calls()<two.calls(),`one composition instead of two (${one.calls()} layouts against ${two.calls()})`);
    const composed=one.calls(),markup=after.getHydrated();
    await after.setEmojiStyle(structuredClone(style));
    assert.equal(one.calls(),composed,'the style already in force runs no second composition');
    assert.equal(after.getHydrated(),markup);
    assert.deepEqual(after.emoji.assets,before.emoji.assets,'and the pack a save carries is still resolved');
    assert.ok(after.emoji.assets.length>0);
    await after.setEmojiStyle(null);
    assert.ok(one.calls()>composed,'a different style still recomposes');
  }finally{before.destroy();after?.destroy();}
});

test('a watched first composition opens on the first page, then fills in, and ends where a single pass would',async()=>{
  // Three pages; the document lists the LAST page's story first, so reading order and
  // document order disagree.
  let boxes:Record<string,unknown>[]=[
    {id:'p3',kind:'frame',x:1000,y:0,w:400,h:300,order:2},{id:'p1',kind:'frame',x:0,y:0,w:400,h:300,order:0},{id:'p2',kind:'frame',x:500,y:0,w:400,h:300,order:1},
    {id:'t3',kind:'text',text:'',frame:'p3',x:1020,y:20,w:300,h:60},{id:'t1',kind:'text',text:'',frame:'p1',x:20,y:20,w:300,h:60},{id:'t2',kind:'text',text:'',frame:'p2',x:520,y:20,w:300,h:60},
  ];
  let textDocument:unknown='';
  for(const [id,source] of [['t3','Third page'],['t1','First page'],['t2','Second page']] as const){
    const next=upgradeDesignText(textDocument,boxes as never,id,{storyId:`s-${id}`,source,character:{font:'sans',size:24},fonts:[font]});
    textDocument=next.textDocument;boxes=next.boxes as Record<string,unknown>[];
  }
  const values={boxes,textDocument} as Parameters<typeof createRuntime>[2];
  // Each story takes long enough that the progress thresholds are crossed.
  const slow=()=>{const value=host();const layout=value.text!.layoutRuns!;const order:string[]=[];
    value.text={...value.text!,layoutRuns:async request=>{order.push(request.storyId);await new Promise(r=>setTimeout(r,180));return layout(request);}};return {value,order};};
  const single=await createRuntime(tool,slow().value,values);
  const watched=slow(),runtime=await createRuntime(tool,watched.value,values,{progressiveInit:true});
  try{
    const opened=new JSDOM(runtime.getHydrated()).window.document;
    const drawn=[...opened.querySelectorAll('[data-text-frame]')].map(node=>node.getAttribute('data-text-frame'));
    assert.ok(drawn.includes('t1'),'the first page is laid out when the view opens');
    assert.ok(!drawn.includes('t3'),`the last page is not yet (drawn: ${drawn.join(', ')})`);
    assert.deepEqual(watched.order.slice(0,2),['s-t1','s-t2'],'stories are laid out in reading order, not document order');
    assert.deepEqual(runtime.hookErrors,[]);
    await runtime.whenSettled();
    assert.equal(runtime.getHydrated(),single.getHydrated(),'the finished document is exactly what a single pass delivers');
  }finally{single.destroy();runtime.destroy();}

  // An edit while pages are still landing: the edit's own pass reuses what is finished
  // and what is in flight, so no story is laid out twice, and the end state is the
  // edited document.
  const editing=slow(),live=await createRuntime(tool,editing.value,values,{progressiveInit:true});
  const edited=await createRuntime(tool,host(),{...values,background:'#224466'} as Parameters<typeof createRuntime>[2]);
  try{
    await live.setInput('background','#224466');
    await live.whenSettled();
    const perStory=editing.order.reduce<Record<string,number>>((count,id)=>{count[id]=(count[id]??0)+1;return count;},{});
    assert.deepEqual(perStory,{'s-t1':1,'s-t2':1,'s-t3':1},'each story laid out once across both passes');
    assert.equal(live.getHydrated(),edited.getHydrated(),'and the result is the edited document, whole');
  }finally{live.destroy();edited.destroy();}
});
