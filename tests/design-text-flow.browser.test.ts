// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Page } from 'playwright-core';
import type { TextDocumentV1 } from '@lolly-tools/core';
import type { InputValue } from '../engine/src/inputs.ts';
import type { CanvasCommitEl } from '../shells/web/src/lib/canvas-commit.ts';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { createTextStory } from '../engine/src/text-story-document.ts';
import { expandQuery } from '../engine/src/url-pack.ts';
import { journeyDiagnostics } from './helpers/journey-diagnostics.ts';
const origin = process.env.LOLLY_EXPORT_TEST_URL;
async function state(page: Page): Promise<{document:TextDocumentV1;boxes:Array<Record<string,unknown>>}> {
  return page.evaluate(()=>{const values=(document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!();return {document:JSON.parse(values.find(item=>item.id==='textDocument')!.value as string),boxes:values.find(item=>item.id==='boxes')!.value as Array<Record<string,unknown>>};});
}
async function selectText(page: Page, start: number, end: number): Promise<void> {
  await page.evaluate(({start,end})=>{
    const editor=document.querySelector<HTMLElement>('[data-native-text-editor]')!;editor.focus();
    const walker=document.createTreeWalker(editor,4);let node=walker.nextNode(),offset=0,a:[Node,number]|undefined,b:[Node,number]|undefined;
    while(node){const length=node.textContent!.length;if(!a&&start<=offset+length)a=[node,start-offset];if(!b&&end<=offset+length)b=[node,end-offset];offset+=length;node=walker.nextNode();}
    document.getSelection()!.setBaseAndExtent(...a!,...b!);document.dispatchEvent(new Event('selectionchange'));
  },{start,end});
}
test('three-frame text links, edits across frames, copies visible text, deletes containers and reopens', {skip:origin?false:'set LOLLY_EXPORT_TEST_URL',timeout:150000},async()=>{
  const source='An article flows across its ordered frames. '.repeat(12);
  const stories=['a','b','c'].map(id=>{const story=createTextStory(`story-${id}`,id==='a'?source:'',i=>`${id}-p${i}`);story.frameIds=[id];story.defaultStyle='body';return story;});
  const textDocument:TextDocumentV1={version:1,stories,fonts:[{id:'font',family:'SUSE',faceIndex:0,sha256:createHash('sha256').update(readFileSync('shells/web/public/fonts/SUSE[wght].ttf')).digest('hex'),source:{kind:'bundled',path:'/fonts/SUSE[wght].ttf'}}],styles:[{id:'body',name:'Body',kind:'paragraph',paragraph:{character:{font:'font',size:20},lineHeight:1.2}}]};
  const boxes=['a','b','c'].map((id,i)=>({id,kind:'text',name:`Frame ${id}`,text:'',textStory:`story-${id}`,textFrame:JSON.stringify({mode:'fixed',inset:{top:8,right:8,bottom:8,left:8},columns:{count:1,gutter:12,balance:false},verticalAlign:'top'}),x:[100,900,1250][i],y:100,w:[200,260,320][i],h:[200,200,500][i],rot:0}));
  const artboards=[{id:'page-a',kind:'frame',name:'First artboard',x:0,y:0,w:760,h:700,order:0},{id:'page-b',kind:'frame',name:'Second artboard',x:850,y:0,w:850,h:700,order:1}];
  const browser=await getBrowser(),context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),diagnose=journeyDiagnostics(context,'design-text-flow');page.setDefaultTimeout(20000);
  const box=(id:string)=>page.locator(`#tool-canvas [data-box-id="${id}"] .lolly-box-text`);
  const settle=()=>page.waitForFunction(()=>!document.querySelector('[data-text-pending]'));
  try {
    await page.goto(`${origin}/design?${new URLSearchParams({textDocument:JSON.stringify(textDocument),boxes:JSON.stringify([...artboards,...boxes]),_sel:'a',c2pa:'0',imprint:'0'})}`);
    await page.locator('#tool-canvas svg[data-text-frame="a"]').waitFor();
    for(const id of ['navigator','inspector']){const button=page.locator(`[data-topbar="${id}"]`);if(await button.getAttribute('aria-pressed')==='true')await button.click();}
    for(const [from,to,count] of [['a','b',2],['b','c',3]] as const){
      await box(from).click();await page.locator('[data-cx="text-flow"]').click();
      const panel=page.getByRole('dialog',{name:'Continue text',exact:true});
      if(from==='a'){await panel.getByRole('button',{name:'New linked frame',exact:true}).click();await box(to).click();}
      else {await panel.getByLabel('Target text frame',{exact:true}).selectOption(to);await panel.getByRole('button',{name:'Continue into selected frame',exact:true}).click();}
      await page.waitForFunction(count=>{const model=(document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!();return JSON.parse(model.find(item=>item.id==='textDocument')!.value as string).stories[0].frameIds.length===count;},count);
      await page.waitForFunction(to=>!!document.querySelector(`#tool-canvas svg[data-text-frame="${to}"] path[data-text-start]`),to);
    }
    assert.equal((await state(page)).document.stories.length,1);
    const boundary=await box('b').locator('path[data-text-start]').first().getAttribute('data-text-start');assert.ok(boundary);const at=Number(boundary);
    await box('a').dblclick();await page.locator('[data-native-text-editor]').waitFor();await settle();
    const geometry=await page.evaluate(at=>{
      const holder=document.querySelector<HTMLElement>(`[data-native-text-editor] [data-text-start="${at}"]`)!,target=document.querySelector<SVGSVGElement>('#tool-canvas svg[data-text-frame="b"]')!;
      return {holder:holder.getBoundingClientRect().toJSON(),target:target.getBoundingClientRect().toJSON(),scale:target.getBoundingClientRect().width/260};
    },at);
    assert.ok(Math.abs(geometry.holder.x-geometry.target.x-8*geometry.scale)<1,'native caret starts in the second frame');
    assert.ok(Math.abs(geometry.holder.y-geometry.target.y-8*geometry.scale)<1,'native caret uses the second frame baseline area');
    assert.ok(await page.evaluate(at=>{
      const ink=document.querySelector<HTMLElement>(`[data-native-text-editor] [data-text-start="${at}"] [data-text-ink]`)!,r=ink.getBoundingClientRect();
      return !!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-native-text-editor]');
    },at),'second-frame native text is an actual pointer target above clipped artwork');
    await page.evaluate(()=>{const canvas=document.getElementById('tool-canvas') as CanvasCommitEl;const boxes=canvas.__lollyModel!().find(item=>item.id==='boxes')!.value as Array<Record<string,unknown>>;canvas.__lollyCommit!('boxes',boxes.map(box=>box.id==='b'?{...box,rot:18}:box) as InputValue);});
    await page.waitForFunction(at=>{
      const holder=document.querySelector<HTMLElement>(`[data-native-text-editor] [data-text-start="${at}"]`)!,target=document.querySelector<SVGSVGElement>('#tool-canvas svg[data-text-frame="b"]')!;
      const matrix=target.getScreenCTM()!,root=document.querySelector<SVGSVGElement>('#tool-canvas svg[data-text-frame="a"]')!.getScreenCTM()!,relative=root.inverse().multiply(matrix);
      const native=new DOMMatrix(getComputedStyle(holder).transform);return Math.abs(relative.b-native.b)<.001 && Math.abs(relative.b)>.1;
    },at);
    const points=await page.evaluate(({start,end})=>[start,end].map(at=>{const ink=document.querySelector<HTMLElement>(`[data-native-text-editor] [data-text-start="${at}"] [data-text-ink]`)!;const rect=ink.getBoundingClientRect();return {x:rect.x+rect.width/2,y:rect.y+rect.height/2};}),{start:at-5,end:at+5});
    await page.mouse.move(points[0]!.x,points[0]!.y);await page.mouse.down();await page.mouse.move(points[1]!.x,points[1]!.y,{steps:18});await page.mouse.up();
    const selected=await page.evaluate(()=>{
      const selection=document.getSelection()!,editor=document.querySelector('[data-native-text-editor]')!;
      const offset=(node:Node,at:number)=>{const range=document.createRange();range.selectNodeContents(editor);range.setEnd(node,at);return range.toString().length;};
      return [offset(selection.anchorNode!,selection.anchorOffset),offset(selection.focusNode!,selection.focusOffset)].sort((a,b)=>a-b);
    });assert.ok(selected[0]!<at&&selected[1]!>at,`pointer selection crosses rotated frames: ${selected}`);
    await selectText(page,at-5,at+5);await page.keyboard.insertText('Edited ');await settle();
    assert.equal((await state(page)).document.stories[0]!.source,source.slice(0,at-5)+'Edited '+source.slice(at+5));
    await page.keyboard.press('ControlOrMeta+z');await settle();assert.equal((await state(page)).document.stories[0]!.source,source);
    await page.locator('.fc-composed-bar').getByRole('button',{name:'Done',exact:true}).click();
    await page.evaluate(()=>{const canvas=document.getElementById('tool-canvas') as CanvasCommitEl;const boxes=canvas.__lollyModel!().find(item=>item.id==='boxes')!.value as Array<Record<string,unknown>>;canvas.__lollyCommit!('boxes',boxes.map(box=>box.id==='b'?{...box,rot:0}:box) as InputValue);});
    await page.waitForFunction(()=>Math.abs(document.querySelector<SVGSVGElement>('#tool-canvas svg[data-text-frame="b"]')!.getScreenCTM()!.b)<.001);
    await box('b').click();
    const clipboard=await page.evaluate(()=>{const data=new DataTransfer();document.getElementById('tool-canvas')!.dispatchEvent(new ClipboardEvent('copy',{bubbles:true,cancelable:true,clipboardData:data}));return data.getData('text/plain');});
    assert.ok(clipboard.startsWith('lolly/layout-boxes:'),'linked frame clipboard has a portable document');
    const payload=JSON.parse(clipboard.slice('lolly/layout-boxes:'.length));assert.equal(payload.version,2);
    const fragment=JSON.parse(payload.textDocument);assert.equal(fragment.stories.length,1);assert.ok(fragment.stories[0].source.length<source.length);
    await page.evaluate(text=>{const data=new DataTransfer();data.setData('text/plain',text);document.getElementById('tool-canvas')!.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));},clipboard);
    await page.waitForFunction(()=>JSON.parse((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(item=>item.id==='textDocument')!.value as string).stories.length===2);
    const pasted=(await state(page)).document.stories[1]!;assert.equal(pasted.source,fragment.stories[0].source);
    await page.keyboard.press('ControlOrMeta+z');await page.waitForFunction(()=>JSON.parse((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(item=>item.id==='textDocument')!.value as string).stories.length===1);
    await page.locator(`#tool-canvas svg[data-text-frame="${pasted.frameIds[0]}"]`).waitFor({state:'detached'});
    await box('a').click();await box('b').click();await page.locator('[data-cx="dup"]').click();
    await page.waitForFunction(()=>{const values=(document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!();return JSON.parse(values.find(item=>item.id==='textDocument')!.value as string).stories.length===2;});
    const copied=(await state(page)).document.stories[1]!;assert.ok(copied.source.length<source.length);assert.ok(source.includes(copied.source));assert.notEqual(copied.id,'story-a');
    await box('b').click({position:{x:2,y:2}});await page.keyboard.press('Delete');
    await page.waitForFunction(()=>!((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(item=>item.id==='boxes')!.value as Array<Record<string,unknown>>).some(box=>box.id==='b'));
    await page.waitForFunction(()=>!document.querySelector('#tool-canvas svg[data-text-frame="b"]'));
    let saved=await state(page);assert.equal(saved.document.stories[0]!.source,source);assert.deepEqual(saved.document.stories[0]!.frameIds,['a','c']);
    await page.keyboard.press('ControlOrMeta+z');await page.locator('#tool-canvas svg[data-text-frame="b"]').waitFor();
    saved=await state(page);assert.deepEqual(saved.document.stories[0]!.frameIds,['a','b','c']);
    let portable=false;
    for(let attempt=0;attempt<100;attempt++){
      const params=new URLSearchParams(await expandQuery(new URL(page.url()).search));
      if((params.get('tdoc')??params.get('textDocument'))===JSON.stringify(saved.document)){portable=true;break;}
      await page.waitForTimeout(50);
    }
    assert.ok(portable,'the share URL contains the complete restored story before reload');
    let recovered=false;
    for(let attempt=0;attempt<100;attempt++){
      recovered=await page.evaluate(async expected=>{
        const path='/src/lib/host-ref.ts',slot=history.state?.lollyHistory?.slot;
        if(!slot)return false;
        const record=await (await import(path)).getHostRef().state.load(slot);
        return record?.textDocument===expected;
      },JSON.stringify(saved.document));
      if(recovered)break;
      await page.waitForTimeout(50);
    }
    assert.ok(recovered,'automatic recovery stores the complete restored story before reload');
    await page.reload();await page.locator('#tool-canvas svg[data-text-frame="c"]').waitFor();assert.deepEqual((await state(page)).document,saved.document);
    // A reload can reopen framed on the first artboard, which leaves frame c off-screen, and the
    // stage moves by transform, so a click cannot scroll it into view. Frame everything first.
    await page.getByRole('button',{name:'Fit all',exact:true}).click();
    await box('c').click();await page.locator('[data-cx="text-flow"]').click();
    await page.getByRole('dialog',{name:'Continue text',exact:true}).getByRole('button',{name:'New linked frame',exact:true}).click();
    const area=(await page.locator('#tool-canvas').boundingBox())!;
    await page.mouse.move(area.x+area.width*.2,area.y+area.height*.7);await page.mouse.down();await page.mouse.move(area.x+area.width*.2+160,area.y+area.height*.7+90,{steps:8});await page.mouse.up();
    await page.waitForFunction(()=>{const values=(document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!();return JSON.parse(values.find(item=>item.id==='textDocument')!.value as string).stories[0].frameIds.length===4;});
    saved=await state(page);assert.equal(saved.document.stories[0]!.source,source);assert.ok(saved.boxes.every(box=>!('__textContinue' in box)));
    await box('a').click();await page.locator('[data-cx="text-frame"]').click();await page.getByRole('dialog',{name:'Frame options',exact:true}).getByText('Adjust on canvas',{exact:true}).click();await page.getByRole('dialog',{name:'Frame options',exact:true}).getByRole('button',{name:'Adjust frame',exact:true}).click();
    const guides=page.getByRole('dialog',{name:'Adjust frame',exact:true}),handle=page.locator('button[data-text-adjust]');await handle.focus();await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('Escape');
    assert.equal(JSON.parse(String((await state(page)).boxes.find(box=>box.id==='a')!.textFrame)).inset.left,8,'Escape cancels guide preview');
    await handle.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
    await page.waitForFunction(()=>{const boxes=(document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(item=>item.id==='boxes')!.value as Array<Record<string,unknown>>;return JSON.parse(String(boxes.find(box=>box.id==='a')!.textFrame)).inset.left===9;});
    await guides.getByRole('button',{name:'Done',exact:true}).click();await page.locator('#tool-canvas').focus();await page.keyboard.press('ControlOrMeta+z');
    await page.waitForFunction(()=>{const boxes=(document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(item=>item.id==='boxes')!.value as Array<Record<string,unknown>>;return JSON.parse(String(boxes.find(box=>box.id==='a')!.textFrame)).inset.left===8;});
    await box('a').click();await page.locator('[data-cx="text-flow"]').click();
    await page.getByRole('dialog',{name:'Continue text',exact:true}).getByText('More actions',{exact:true}).click();await page.getByRole('dialog',{name:'Continue text',exact:true}).getByRole('button',{name:'Select story frames',exact:true}).click();await page.keyboard.press('Delete');
    await page.getByRole('button',{name:'Place text (1)',exact:true}).waitFor();saved=await state(page);assert.equal(saved.document.stories[0]!.source,source);assert.deepEqual(saved.document.stories[0]!.frameIds,[]);
    await page.getByRole('button',{name:'Place text (1)',exact:true}).click();await page.getByRole('dialog',{name:'Unplaced text',exact:true}).getByRole('button',{name:'Edit story',exact:true}).click();
    const storyPanel=page.getByRole('dialog',{name:'Edit story',exact:true});await storyPanel.getByRole('textbox',{name:'Story text',exact:true}).fill(source+'Recovered.');
    await page.waitForFunction(()=>JSON.parse((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(item=>item.id==='textDocument')!.value as string).stories[0].source.endsWith('Recovered.'));
    await storyPanel.getByRole('button',{name:'Place text',exact:true}).click();
    await page.mouse.move(area.x+area.width*.2,area.y+area.height*.4);await page.mouse.down();await page.mouse.move(area.x+area.width*.2+240,area.y+area.height*.4+160,{steps:8});await page.mouse.up();
    await page.waitForFunction(()=>JSON.parse((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(item=>item.id==='textDocument')!.value as string).stories[0].frameIds.length===1);
    saved=await state(page);assert.equal(saved.document.stories[0]!.source,source+'Recovered.');assert.ok(saved.boxes.every(box=>!('__textPlace' in box)));

  }catch(error){await diagnose(error);throw error;}finally{await context.close();await closeBrowser();}
});
