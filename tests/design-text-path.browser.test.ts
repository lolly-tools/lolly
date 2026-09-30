// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Page } from 'playwright-core';
import type { TextDocumentV1 } from '@lolly-tools/core';
import type { CanvasCommitEl } from '../shells/web/src/lib/canvas-commit.ts';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { createTextStory } from '../engine/src/text-story-document.ts';
import { expandQuery } from '../engine/src/url-pack.ts';
import { parseUrlState } from '../engine/src/url-mode.ts';
import { journeyDiagnostics } from './helpers/journey-diagnostics.ts';
const origin=process.env.LOLLY_EXPORT_TEST_URL;
const manifest=JSON.parse(readFileSync('community/design/tool.json','utf8'));
async function state(page:Page):Promise<{document:TextDocumentV1;boxes:Array<Record<string,unknown>>}>{return page.evaluate(()=>{const values=(document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!();return {document:JSON.parse(values.find(item=>item.id==='textDocument')!.value as string),boxes:values.find(item=>item.id==='boxes')!.value as Array<Record<string,unknown>>};});}
test('Design attaches, edits curved native text, changes its guide, detaches and reopens', {skip:origin?false:'set LOLLY_EXPORT_TEST_URL',timeout:150000},async()=>{
  const story=createTextStory('story','Office around a circle',i=>`p${i}`);story.frameIds=['text'];story.defaultStyle='body';story.spans=[{start:0,end:6,character:{underline:true,color:'#123456'}}];
  const textDocument:TextDocumentV1={version:1,stories:[story],fonts:[{id:'font',family:'SUSE',faceIndex:0,sha256:createHash('sha256').update(readFileSync('shells/web/public/fonts/SUSE[wght].ttf')).digest('hex'),source:{kind:'bundled',path:'/fonts/SUSE[wght].ttf'}}],styles:[{id:'body',name:'Body',kind:'paragraph',paragraph:{character:{font:'font',size:36}}}]};
  const boxes=[{id:'text',kind:'text',name:'Heading',text:'',textStory:'story',textFrame:JSON.stringify({mode:'fixed',inset:{top:0,right:0,bottom:0,left:0},columns:{count:1,gutter:0,balance:false},verticalAlign:'top'}),x:100,y:100,w:550,h:180,rot:0},{id:'guide',kind:'box',name:'Circle guide',shape:'ellipse',bg:'none',stroke:'#888888',strokeW:1,x:500,y:350,w:420,h:420,rot:0}];
  const browser=await getBrowser(),context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),diagnose=journeyDiagnostics(context,'design-text-path');page.setDefaultTimeout(20000);
  const text=()=>page.locator('#tool-canvas [data-box-id="text"] .lolly-box-text'),svg=()=>text().locator('svg[data-text-frame="text"]');
  const frame=async()=>JSON.parse(String((await state(page)).boxes.find(box=>box.id==='text')!.textFrame));
  const settle=()=>page.waitForFunction(()=>!document.querySelector('[data-text-pending]'));
  try{
    await page.goto(`${origin}/design?${new URLSearchParams({textDocument:JSON.stringify(textDocument),boxes:JSON.stringify(boxes),_sel:'text',c2pa:'0',imprint:'0'})}`);await svg().waitFor();
    for(const id of ['navigator','inspector']){const button=page.locator(`[data-topbar="${id}"]`);if(await button.getAttribute('aria-pressed')==='true')await button.click();}
    await text().click();await page.locator('#tool-canvas [data-box-id="guide"]').click({modifiers:['Shift']});
    await text().click({button:'right'});await page.getByRole('menuitem',{name:'Attach text to path',exact:true}).click();
    await page.getByRole('dialog',{name:'Attach text to path',exact:true}).getByRole('button',{name:'Attach text to path',exact:true}).click();
    await page.locator('[data-cx="text-path"]').waitFor();assert.equal((await frame()).mode,'path');assert.equal((await state(page)).boxes.length,2,'original guide stays');assert.equal((await state(page)).document.stories[0]!.source,story.source);
    await page.locator('[data-cx="text-path"]').click();const panel=page.getByRole('dialog',{name:'Path options',exact:true});
    const offset=panel.getByRole('spinbutton',{name:'Baseline offset',exact:true});await offset.fill('12');await offset.press('Tab');await page.waitForFunction(()=>JSON.parse(String(((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(item=>item.id==='boxes')!.value as Array<Record<string,unknown>>).find(box=>box.id==='text')!.textFrame)).path.baseline===12);
    await panel.getByLabel('Flip side',{exact:true}).check();await page.waitForFunction(()=>JSON.parse(String(((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(item=>item.id==='boxes')!.value as Array<Record<string,unknown>>).find(box=>box.id==='text')!.textFrame)).path.flip===true);
    await panel.getByRole('button',{name:'Edit text',exact:true}).click();await page.locator('[data-native-text-editor]').waitFor();await settle();
    const points=await page.evaluate(()=>[0,6].map(at=>{const ink=document.querySelector<HTMLElement>(`[data-native-text-editor] [data-text-start="${at}"] [data-text-ink]`)!;const r=ink.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};}));
    await page.mouse.move(points[0]!.x,points[0]!.y);await page.mouse.down();await page.mouse.move(points[1]!.x,points[1]!.y,{steps:16});await page.mouse.up();
    const selected=await page.evaluate(()=>document.getSelection()!.toString());assert.ok(selected.length>=4,`curved pointer selection: ${selected}`);
    await page.keyboard.insertText('Curved');await settle();assert.ok((await state(page)).document.stories[0]!.source.includes('Curved'));
    await page.keyboard.press('ControlOrMeta+z');await settle();assert.equal((await state(page)).document.stories[0]!.source,story.source);
    await page.locator('.fc-composed-bar').getByRole('button',{name:'Done',exact:true}).click();
    await page.locator('[data-cx="text-path"]').click();await page.getByRole('dialog',{name:'Path options',exact:true}).getByRole('button',{name:'Adjust path',exact:true}).click();
    const adjust=page.getByRole('dialog',{name:'Adjust path',exact:true}),handle=page.locator('button[data-text-adjust]');await adjust.getByLabel('Path handle',{exact:true}).selectOption('baseline');await handle.focus();await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('Escape');assert.equal((await frame()).path.baseline,12);
    await handle.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await page.waitForFunction(()=>JSON.parse(String(((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(item=>item.id==='boxes')!.value as Array<Record<string,unknown>>).find(box=>box.id==='text')!.textFrame)).path.baseline===13);
    await adjust.getByRole('button',{name:'Done',exact:true}).click();await page.locator('#tool-canvas').focus();await page.keyboard.press('ControlOrMeta+z');await page.waitForFunction(()=>JSON.parse(String(((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(item=>item.id==='boxes')!.value as Array<Record<string,unknown>>).find(box=>box.id==='text')!.textFrame)).path.baseline===12);
    await page.locator('[data-cx="text-path"]').click();await page.getByRole('dialog',{name:'Path options',exact:true}).getByRole('button',{name:'Adjust path',exact:true}).click();
    await adjust.getByLabel('Path handle',{exact:true}).selectOption('baseline');
    const handleBounds=(await handle.boundingBox())!;await page.mouse.move(handleBounds.x+22,handleBounds.y+22);await page.mouse.down();await page.mouse.move(handleBounds.x+45,handleBounds.y+35,{steps:12});await page.mouse.up();
    await page.waitForFunction(()=>Math.abs(JSON.parse(String(((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(item=>item.id==='boxes')!.value as Array<Record<string,unknown>>).find(box=>box.id==='text')!.textFrame)).path.baseline-12)>.1);
    await adjust.getByRole('button',{name:'Done',exact:true}).click();await page.locator('#tool-canvas').focus();await page.keyboard.press('ControlOrMeta+z');await page.waitForFunction(()=>JSON.parse(String(((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(item=>item.id==='boxes')!.value as Array<Record<string,unknown>>).find(box=>box.id==='text')!.textFrame)).path.baseline===12);
    const beforeGuide=(await frame()).path.d;await page.locator('[data-cx="text-path-edit"]').click();await page.locator('.tool-stage.fc-node-editing').waitFor();
    await page.screenshot({path:'/tmp/lolly-271-path-nodes.png'});
    await page.keyboard.press('ControlOrMeta+a');await page.keyboard.press('ArrowRight');
    await page.waitForFunction(before=>JSON.parse(String(((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(item=>item.id==='boxes')!.value as Array<Record<string,unknown>>).find(box=>box.id==='text')!.textFrame)).path.d!==before,beforeGuide);
    await page.locator('[data-pen="done"]').click();
    assert.notEqual((await frame()).path.d,beforeGuide,'existing pen commits the owned text guide');assert.equal((await state(page)).document.stories[0]!.source,story.source);
    const savedPath=(await frame()).path.d;
    let portable=false;for(let attempt=0;attempt<100;attempt++){const params=await expandQuery(new URL(page.url()).search);const boxes=parseUrlState(params,manifest).values.boxes as Array<Record<string,unknown>>;if(boxes&&JSON.parse(String(boxes.find(box=>box.id==='text')!.textFrame)).path.d===savedPath){portable=true;break;}await page.waitForTimeout(50);}
    assert.ok(portable,'the completed guide edit reaches the share URL');
    await page.keyboard.press('ControlOrMeta+s');await page.locator('.dtb-save-status[data-dirty="false"]').waitFor();
    const savedState=await state(page),savedSvg=await svg().evaluate(el=>el.outerHTML);await page.reload();await svg().waitFor();
    assert.deepEqual((await state(page)).boxes,savedState.boxes);assert.equal(await svg().evaluate(el=>el.outerHTML),savedSvg);

    const glyphs=await svg().locator('path[data-text-start]').evaluateAll(paths=>paths.map(path=>path.getAttribute('d')!).filter(Boolean));
    await page.locator('[data-topbar="export"]').click();await page.locator('[data-action="format"]').selectOption('svg',{force:true});
    const download=page.waitForEvent('download');await page.locator('[data-action="download"]').click();const output=await download;assert.equal(await output.failure(),null);
    const exported=readFileSync((await output.path())!,'utf8');for(const path of glyphs)assert.ok(exported.includes(path),'SVG export retains each composed glyph path');
    await page.keyboard.press('Escape');
    await text().click();await page.locator('[data-cx="text-path"]').click();await page.getByRole('dialog',{name:'Path options',exact:true}).getByLabel('Keep guide as a separate shape',{exact:true}).check();await page.getByRole('button',{name:'Detach from path',exact:true}).click();
    await page.locator('[data-cx="text-frame"]').waitFor();assert.equal((await frame()).mode,'auto-height');assert.equal((await state(page)).boxes.length,3);assert.equal((await state(page)).document.stories[0]!.source,story.source);
    await page.locator('#tool-canvas').focus();await page.keyboard.press('ControlOrMeta+z');await page.locator('[data-cx="text-path"]').waitFor();assert.equal((await state(page)).boxes.length,2);
    await page.screenshot({path:'/tmp/lolly-271-path-final.png'});
  }catch(error){await diagnose(error);throw error;}finally{await context.close();await closeBrowser();}
});
test('Add creates circle text and draws an editable text guide with no temporary fields', {skip:origin?false:'set LOLLY_EXPORT_TEST_URL',timeout:120000},async()=>{
  const browser=await getBrowser(),context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),diagnose=journeyDiagnostics(context,'design-text-path-create');page.setDefaultTimeout(20000);
  try{
    await page.goto(`${origin}/design?boxes=%5B%5D&c2pa=0&imprint=0`);await page.locator('#tool-canvas .artboard').waitFor();
    for(const id of ['navigator','inspector']){const button=page.locator(`[data-topbar="${id}"]`);if(await button.getAttribute('aria-pressed')==='true')await button.click();}
    await page.getByRole('button',{name:'Add a box',exact:true}).click();await page.getByRole('menuitem',{name:'Text on a circle',exact:true}).click();
    const area=(await page.locator('#tool-canvas').boundingBox())!;
    await page.mouse.move(area.x+area.width*.2,area.y+area.height*.2);await page.mouse.down();await page.mouse.move(area.x+area.width*.2+220,area.y+area.height*.2+220,{steps:12});await page.mouse.up();
    await page.locator('[data-native-text-editor]').waitFor();await page.waitForFunction(()=>!document.querySelector('[data-text-pending]'));await page.keyboard.insertText('Round 😀');await page.waitForFunction(()=>!document.querySelector('[data-text-pending]'));await page.locator('.fc-composed-bar').getByRole('button',{name:'Done',exact:true}).click();
    const circle=await state(page);assert.equal(circle.document.stories.length,1);assert.equal(circle.document.stories[0]!.source,'Round 😀');assert.match(JSON.parse(String(circle.boxes[0]!.textFrame)).path.d,/Z$/);assert.ok(circle.boxes.every(box=>!('__textPath' in box)));
    await page.getByRole('button',{name:'Add a box',exact:true}).click();await page.getByRole('menuitem',{name:'Text on a path',exact:true}).click();await page.getByRole('dialog',{name:'Text on a path',exact:true}).getByRole('button',{name:'Draw a guide',exact:true}).click();
    await page.mouse.click(area.x+area.width*.6,area.y+area.height*.55);await page.mouse.click(area.x+area.width*.75,area.y+area.height*.45);await page.mouse.click(area.x+area.width*.9,area.y+area.height*.55);await page.keyboard.press('Enter');
    await page.locator('[data-native-text-editor]').waitFor();await page.waitForFunction(()=>!document.querySelector('[data-text-pending]'));await page.keyboard.insertText('Wave');await page.waitForFunction(()=>!document.querySelector('[data-text-pending]'));await page.locator('.fc-composed-bar').getByRole('button',{name:'Done',exact:true}).click();
    const drawn=await state(page);assert.equal(drawn.document.stories.length,2);assert.equal(drawn.boxes.length,2);assert.equal(drawn.document.stories[1]!.source,'Wave');assert.ok(drawn.boxes.every(box=>!('__textGuideD' in box)));assert.equal(JSON.parse(String(drawn.boxes[1]!.textFrame)).mode,'path');
    await page.screenshot({path:'/tmp/lolly-271-path-created.png'});
  }catch(error){await diagnose(error);throw error;}finally{await context.close();await closeBrowser();}
});
