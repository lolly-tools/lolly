// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boxesToPenpotDoc, buildPenpotEntries, seededPenpotUuid } from '../engine/src/penpot-file.ts';
import { zipSync, strToU8 } from 'fflate';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
const origin = process.env.LOLLY_IMPORT_TEST_URL;
const box = (id: string, patch: Record<string, unknown> = {}): Record<string, unknown> => ({id,kind:'box',name:id,x:120,y:80,w:100,h:40,rot:0,bg:'#4488cc',...patch});
test('Design document import retains all named pages, artboards and nested groups at global coordinates', {skip:origin?false:'Set LOLLY_IMPORT_TEST_URL to a local Vite shell.',timeout:90000}, async () => {
  const rows=[box('board',{kind:'frame',pageId:'p1',x:100,y:50,w:400,h:250,layout:'flex'}),box('outer',{kind:'group',layoutOwner:'board',pageId:'p1'}),box('inner',{kind:'group',group:'outer',pageId:'p1'}),box('leaf',{group:'inner',pageId:'p1'}),box('other',{pageId:'p2',x:120,y:80})];
  const built=buildPenpotEntries(boxesToPenpotDoc(rows,{name:'Hierarchy',canvas:{w:640,h:480},pages:[{id:'p1',name:'Drafts'},{id:'p2',name:'Final'}]}),{uuid:seededPenpotUuid(305),now:()=> '2026-10-11T18:00:00.000Z'});
  const zipped=zipSync(Object.fromEntries(Object.entries(built.entries).map(([path,value])=>[path,typeof value==='string'?strToU8(value):value]))), browser=await getBrowser();
  try {
    const page=await browser.newPage(); await page.goto(origin!,{waitUntil:'domcontentloaded'});
    const result=await page.evaluate(async bytes=>{
      const path='/src/views/design-import.ts'; const {parseDesignFile}=await import(path);
      const file=new File([new Uint8Array(bytes)],'hierarchy.penpot'), warnings:string[]=[];
      const imported=await parseDesignFile(file,{preserveHierarchy:true,log:(message:string)=>warnings.push(message)});
      return {imported,warnings};
    },[...zipped]);
    assert.deepEqual(result.imported.pages.map((page:{name:string})=>page.name),['Drafts','Final']);
    assert.equal(result.imported.pages.length,2);
    const byName=new Map<string,Record<string,unknown>>(result.imported.boxes.map((row:Record<string,unknown>)=>[String(row.name),row]));
    const board=byName.get('board')!,outer=byName.get('outer')!,inner=byName.get('inner')!,leaf=byName.get('leaf')!;
    assert.equal(board.kind,'frame'); assert.equal(board.layout,'flex'); assert.equal(outer.kind,'group');
    assert.equal(outer.layoutOwner,board.id); assert.equal(inner.group,outer.id); assert.equal(leaf.group,inner.id);
    assert.equal(leaf.pageId,result.imported.pages[0].id); assert.equal(byName.get('other')!.pageId,result.imported.pages[1].id);
    assert.equal(board.x,100); assert.equal(board.y,50); assert.equal(leaf.x,120); assert.equal(leaf.y,80);
    assert.equal(result.imported.boxes.length,6); // The frameless page receives an editable export artboard.
    assert.equal(new Set(result.imported.boxes.map((row:Record<string,unknown>)=>row.id)).size,result.imported.boxes.length);
    assert.ok(!result.warnings.some((warning:string)=>/first of|composited|vector image/.test(warning)));
    await page.close();
  } finally { await closeBrowser(); }
});

test('an unsupported opaque masked group keeps the vector-image fallback and collective opacity', {skip:origin?false:'Set LOLLY_IMPORT_TEST_URL to a local Vite shell.',timeout:90000}, async () => {
  const built=buildPenpotEntries({name:'Masked document',pages:[{name:'Masked',shapes:[{type:'board',x:0,y:0,w:200,h:100,children:[
    {type:'group',name:'Masked group',x:0,y:0,w:150,h:100,masked:true,opacity:.5,children:[
      {type:'rect',name:'Mask',x:0,y:0,w:100,h:100,fills:[{color:'#000000'}]},
      {type:'rect',name:'Red',x:0,y:0,w:100,h:100,fills:[{color:'#ff0000'}]},
      {type:'rect',name:'Blue',x:50,y:0,w:100,h:100,fills:[{color:'#0000ff'}]},
    ]},
  ]}]}]},{uuid:seededPenpotUuid(3061)});
  const zipped=zipSync(Object.fromEntries(Object.entries(built.entries).map(([path,value])=>[path,typeof value==='string'?strToU8(value):value]))),browser=await getBrowser();
  try {
    const page=await browser.newPage(); await page.goto(origin!,{waitUntil:'domcontentloaded'});
    const result=await page.evaluate(async bytes=>{
      const path='/src/views/design-import.ts',bridgePath='/src/bridge/index.ts';
      const {parseDesignFile}=await import(path),{createBridge}=await import(bridgePath),host=await createBridge(),warnings:string[]=[];
      const imported=await parseDesignFile(new File([new Uint8Array(bytes)],'masked.penpot'),{host,preserveHierarchy:true,log:(message:string)=>warnings.push(message)});
      const image=imported.boxes.find((row:{kind:string})=>row.kind==='image');
      return {boxes:imported.boxes,warnings,svg:image?.image?.url?await(await fetch(image.image.url)).text():''};
    },[...zipped]);
    const image=result.boxes.filter((row:{kind:string})=>row.kind==='image');
    assert.equal(image.length,1);assert.equal(image[0].opacity,50);
    assert.ok(!result.boxes.some((row:{kind:string})=>row.kind==='group'));
    assert.match(result.svg,/<clipPath/);assert.ok(!result.svg.includes('opacity="0.5"'));
    assert.ok(result.warnings.some((message:string)=>/one vector image/.test(message)));
    await page.close();
  } finally {await closeBrowser();}
});

test('a composited vector group retains editable children and collective opacity', {skip:origin?false:'Set LOLLY_IMPORT_TEST_URL to a local Vite shell.',timeout:90000}, async () => {
  const rows=[box('composite',{kind:'group',opacity:50,pageId:'p1',x:0,y:0,w:150,h:100}),box('red',{group:'composite',pageId:'p1',x:0,y:0,w:100,h:100,bg:'#ff0000'}),box('blue',{group:'composite',pageId:'p1',x:50,y:0,w:100,h:100,bg:'#0000ff'})];
  const built=buildPenpotEntries(boxesToPenpotDoc(rows,{name:'Collective opacity',canvas:{w:200,h:100},pages:[{id:'p1',name:'Artwork'}]}),{uuid:seededPenpotUuid(306)});
  const zipped=zipSync(Object.fromEntries(Object.entries(built.entries).map(([path,value])=>[path,typeof value==='string'?strToU8(value):value]))),browser=await getBrowser();
  try {
    const page=await browser.newPage(); await page.goto(origin!,{waitUntil:'domcontentloaded'});
    const result=await page.evaluate(async bytes=>{
      const path='/src/views/design-import.ts'; const {parseDesignFile}=await import(path); const warnings:string[]=[];
      const bridgePath='/src/bridge/index.ts'; const {createBridge}=await import(bridgePath); const host=await createBridge();
      const imported=await parseDesignFile(new File([new Uint8Array(bytes)],'composite.penpot'),{host,preserveHierarchy:true,log:(message:string)=>warnings.push(message)});
      const image=imported.boxes.find((row:{kind:string})=>row.kind==='image');
      const svg=image?.image?.url ? await (await fetch(image.image.url)).text() : '';
      return {boxes:imported.boxes,svg,warnings};
    },[...zipped]);
    const groups=result.boxes.filter((row:{kind:string})=>row.kind==='group'); assert.equal(groups.length,1);
    assert.equal(groups[0].opacity,50); assert.equal(result.boxes.filter((row:{kind:string})=>row.kind==='image').length,0);
    const children=result.boxes.filter((row:{group?:string})=>row.group===groups[0].id);
    assert.equal(children.length,2); assert.ok(children.every((row:{opacity:number})=>row.opacity===100));
    assert.ok(!result.warnings.some((message:string)=>/one vector image/.test(message)));
    await page.close();
  } finally {await closeBrowser();}
});
