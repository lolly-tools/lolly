// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { TextDocumentV1 } from '@lolly-tools/core';
import type { Page } from 'playwright-core';
import type { CanvasCommitEl } from '../shells/web/src/lib/canvas-commit.ts';
import { getBrowser,closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { createTextStory } from '../engine/src/text-story-document.ts';
import { journeyDiagnostics } from './helpers/journey-diagnostics.ts';
const origin=process.env.LOLLY_EXPORT_TEST_URL;
async function state(page:Page){return page.evaluate(()=>{const model=(document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!();return {document:JSON.parse(model.find(input=>input.id==='textDocument')!.value as string),boxes:model.find(input=>input.id==='boxes')!.value as Array<Record<string,unknown>>};});}
async function svg(page:Page){return page.locator('svg[data-text-frame="text"]').evaluate(svg=>svg.outerHTML);}
test('object wrap previews, cancels, follows a moved contour, undoes and reopens', {skip:origin?false:'set LOLLY_EXPORT_TEST_URL',timeout:150000},async()=>{
  const story=createTextStory('story','An article flows around its picture and retains every word. '.repeat(9),i=>`p${i}`);story.frameIds=['text'];story.defaultStyle='body';
  const doc:TextDocumentV1={version:1,stories:[story],styles:[{id:'body',kind:'paragraph',name:'Body',paragraph:{character:{font:'font',size:30}}}],fonts:[{id:'font',family:'SUSE',sha256:createHash('sha256').update(readFileSync('shells/web/public/fonts/SUSE[wght].ttf')).digest('hex'),faceIndex:0,source:{kind:'bundled',path:'/fonts/SUSE[wght].ttf'}}]};
  const boxes=[{id:'text',kind:'text',text:'',textStory:'story',textFrame:JSON.stringify({mode:'fixed',inset:{top:8,right:8,bottom:8,left:8},columns:{count:1,gutter:0,balance:false},verticalAlign:'top'}),x:180,y:100,w:700,h:850},{id:'picture',kind:'box',shape:'ellipse',bg:'#77bbcc',x:180,y:200,w:250,h:280}];
  const browser=await getBrowser(),context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'}),page=await context.newPage(),diagnose=journeyDiagnostics(context,'design-text-wrap');page.setDefaultTimeout(20000);
  try{
    await page.goto(`${origin}/design?${new URLSearchParams({boxes:JSON.stringify(boxes),textDocument:JSON.stringify(doc),height:'1080',c2pa:'0',imprint:'0'})}`);await page.locator('svg[data-text-frame="text"]').waitFor();
    for(const id of ['navigator','inspector']){const toggle=page.locator(`[data-topbar="${id}"]`);if(await toggle.getAttribute('aria-pressed')==='true')await toggle.click();}
    const before=await svg(page),picture=page.locator('#tool-canvas [data-box-id="picture"]');await picture.click({button:'right'});await page.getByRole('menuitem',{name:'Text wrap',exact:true}).click();const panel=page.getByRole('dialog',{name:'Text wrap',exact:true});
    await panel.getByLabel('Text wrap',{exact:true}).selectOption('box');await panel.getByRole('button',{name:'Apply',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector<HTMLButtonElement>('[role="dialog"][aria-label="Text wrap"] button')?.disabled);assert.notEqual(await svg(page),before);assert.ok(!(await state(page)).boxes.find(box=>box.id==='picture')!.textWrap);
    await panel.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await svg(page),before);
    await picture.click({button:'right'});await page.getByRole('menuitem',{name:'Text wrap',exact:true}).click();await panel.getByLabel('Text wrap',{exact:true}).selectOption('contour');await panel.getByRole('button',{name:'Apply',exact:true}).click();await panel.waitFor({state:'detached'});const wrapped=await svg(page);assert.notEqual(wrapped,before);assert.equal(JSON.parse(String((await state(page)).boxes.find(box=>box.id==='picture')!.textWrap)).mode,'contour');
    await picture.click();await page.keyboard.press('Shift+ArrowRight');await page.waitForFunction(()=>((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(input=>input.id==='boxes')!.value as Array<Record<string,unknown>>).find(box=>box.id==='picture')!.x===190);await page.waitForFunction(old=>document.querySelector('svg[data-text-frame="text"]')?.outerHTML!==old,wrapped);assert.equal((await state(page)).document.stories[0].source,story.source);
    await page.keyboard.press('ControlOrMeta+z');await page.waitForFunction(old=>document.querySelector('svg[data-text-frame="text"]')?.outerHTML===old,wrapped);await page.screenshot({path:'/tmp/lolly-271-wrap-ui.png'});
    await page.keyboard.press('ControlOrMeta+s');await page.locator('.dtb-save-status[data-dirty="false"]').waitFor();const saved=await state(page);await page.reload();await page.locator('svg[data-text-frame="text"]').waitFor();const reopened=await state(page);assert.deepEqual(reopened.document,saved.document);for(const box of saved.boxes){const restored=reopened.boxes.find(item=>item.id===box.id)!;for(const [key,value] of Object.entries(box))assert.equal(String(restored[key]),String(value),`${box.id}.${key}`);}assert.equal(await svg(page),wrapped);
  }catch(error){await diagnose(error);throw error;}finally{await context.close();await closeBrowser();}
});
