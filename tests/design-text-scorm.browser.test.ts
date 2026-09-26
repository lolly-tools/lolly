// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { createTextStory } from '../engine/src/text-story-document.ts';
import type { TextDocumentV1 } from '@lolly-tools/core';
import { journeyDiagnostics } from '../tests/helpers/journey-diagnostics.ts';
const origin=process.env.LOLLY_EXPORT_TEST_URL;
test('SCORM retains saved Design dimensions and visible composed text',{skip:origin?false:'set LOLLY_EXPORT_TEST_URL',timeout:180000},async()=>{
  const story=createTextStory('story','Office élan 😀\nExact source and line endings.',index=>`p${index}`);story.frameIds=['text'];story.defaultStyle='body';story.spans=[{start:0,end:6,character:{underline:true,color:'#993366'}}];
  const doc:TextDocumentV1={version:1,stories:[story],styles:[{id:'body',kind:'paragraph',name:'Body',paragraph:{character:{font:'font',size:36,weight:500,color:'#223344'}}}],fonts:[{id:'font',family:'SUSE',sha256:createHash('sha256').update(readFileSync('shells/web/public/fonts/SUSE[wght].ttf')).digest('hex'),faceIndex:0,source:{kind:'bundled',path:'/fonts/SUSE[wght].ttf'}}]};
  const boxes=[{id:'text',kind:'text',text:'',textStory:'story',textFrame:JSON.stringify({mode:'fixed',inset:{top:0,right:0,bottom:0,left:0},columns:{count:1,gutter:0,balance:false},verticalAlign:'top'}),x:40,y:45,w:560,h:240,start:0,dur:1}];
  const browser=await getBrowser(),context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),diagnose=journeyDiagnostics(context,'design-text-export');page.setDefaultTimeout(30000);
  await page.addLocatorHandler(page.getByRole('dialog',{name:'Save this render to Assets?',exact:true}),async dialog=>{await dialog.getByRole('button',{name:'Cancel',exact:true}).click();});
  await context.addInitScript(()=>{Object.defineProperty(window,'showSaveFilePicker',{value:undefined});});
  try{
    await page.goto(`${origin}/design?${new URLSearchParams({boxes:JSON.stringify(boxes),textDocument:JSON.stringify(doc),background:'#ffffff',width:'640',height:'360',c2pa:'0',imprint:'0',fps:'12',seconds:'1'})}`);await page.locator('svg[data-text-frame="text"]').waitFor();
    const glyphs=await page.locator('svg[data-text-frame="text"] path[data-text-start]').evaluateAll(paths=>paths.map(path=>path.getAttribute('d')!).filter(Boolean));assert.ok(glyphs.length>15);
    await page.locator('[data-topbar="export"]').click();
    await page.locator('[data-action="format"]').selectOption('scorm',{force:true});
    await page.locator('[data-action="download"]').click();
    await page.locator('[data-course-title]').fill('Composed text course');
    await page.locator('[data-course-rendition]').selectOption('slides');
    await page.locator('[data-course-create]').click();
    await page.getByRole('heading',{name:'Course editor',exact:true}).waitFor();
    await page.getByRole('button',{name:'Export course',exact:true}).click();
    const delivery=page.getByRole('dialog',{name:'Export course',exact:true});
    await delivery.locator('[data-delivery-target]').selectOption('scorm12');
    await delivery.getByRole('button',{name:'Review course',exact:true}).click();
    await delivery.getByRole('button',{name:'Check and prepare package',exact:true}).click();
    const save=delivery.getByRole('button',{name:'Save version and download ZIP',exact:true});await save.waitFor({timeout:120000});
    const [download]=await Promise.all([page.waitForEvent('download',{timeout:90000}),save.click()]);assert.equal(await download.failure(),null);
    const bytes=readFileSync((await download.path())!);const archive=unzipSync(bytes);const slide=Object.keys(archive).find(name=>name.endsWith('.png'))!;const metadata=await sharp(archive[slide]).metadata();assert.equal(metadata.width,640);assert.equal(metadata.height,360);const {data}=await sharp(archive[slide]).flatten({background:'#ffffff'}).removeAlpha().raw().toBuffer({resolveWithObject:true});let ink=0;for(let i=0;i<data.length;i+=3)if(Math.min(data[i]!,data[i+1]!,data[i+2]!)<235)ink++;assert.ok(ink>5000&&ink<15000);console.log('SCORM RESULT',bytes.length,download.suggestedFilename(),metadata.width,metadata.height,'ink',ink);
  }catch(error){await diagnose(error);throw error;}finally{await context.close();await closeBrowser();}
});