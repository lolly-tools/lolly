// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import sharp from 'sharp';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { createTextStory } from '../engine/src/text-story-document.ts';
import type { TextDocumentV1 } from '@lolly-tools/core';
import type { CanvasCommitEl } from '../shells/web/src/lib/canvas-commit.ts';
import { journeyDiagnostics } from './helpers/journey-diagnostics.ts';
const origin=process.env.LOLLY_EXPORT_TEST_URL;
test('composed Design text exports settled paths across still, document and Sequence formats',{skip:origin?false:'set LOLLY_EXPORT_TEST_URL',timeout:240000},async()=>{
  const story=createTextStory('story','Office élan 😀\nExact source and line endings.',index=>`p${index}`);story.frameIds=['text'];story.defaultStyle='body';story.spans=[{start:0,end:6,character:{underline:true,color:'#993366'}}];
  const doc:TextDocumentV1={version:1,stories:[story],styles:[{id:'body',kind:'paragraph',name:'Body',paragraph:{character:{font:'font',size:36,weight:500,color:'#223344'}}}],fonts:[{id:'font',family:'SUSE',sha256:createHash('sha256').update(readFileSync('shells/web/public/fonts/SUSE[wght].ttf')).digest('hex'),faceIndex:0,source:{kind:'bundled',path:'/fonts/SUSE[wght].ttf'}}]};
  const boxes=[{id:'text',kind:'text',text:'',textStory:'story',textFrame:JSON.stringify({mode:'fixed',inset:{top:0,right:0,bottom:0,left:0},columns:{count:1,gutter:0,balance:false},verticalAlign:'top'}),x:40,y:45,w:560,h:240,start:0,dur:1}];
  const browser=await getBrowser(),context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),diagnose=journeyDiagnostics(context,'design-text-export');page.setDefaultTimeout(30000);
  await page.addLocatorHandler(page.getByRole('dialog',{name:'Save this render to Assets?',exact:true}),async dialog=>{await dialog.getByRole('button',{name:'Cancel',exact:true}).click();});
  await context.addInitScript(()=>{Object.defineProperty(window,'showSaveFilePicker',{value:undefined});});
  try{
    await page.goto(`${origin}/design?${new URLSearchParams({boxes:JSON.stringify(boxes),textDocument:JSON.stringify(doc),background:'#ffffff',width:'640',height:'360',c2pa:'0',imprint:'0',fps:'12',seconds:'1'})}`);await page.locator('#tool-canvas svg[data-text-frame="text"]').waitFor();
    const glyphs=await page.locator('svg[data-text-frame="text"] path[data-text-start]').evaluateAll(paths=>paths.map(path=>path.getAttribute('d')!).filter(Boolean));assert.ok(glyphs.length>15);
    const glyphBounds=await page.locator('#tool-canvas svg[data-text-frame="text"] path[data-text-start]').evaluateAll(paths=>paths.filter(path=>path.getAttribute('d')).map(path=>{const item=path as SVGGraphicsElement,b=item.getBBox(),root=item.closest('svg')!,m=root.getScreenCTM()!.inverse().multiply(item.getScreenCTM()!);return {x:40+m.a*b.x+m.c*b.y+m.e,y:45+m.b*b.x+m.d*b.y+m.f,width:b.width*m.a,height:b.height*m.d};}));
    const before=await page.locator('#tool-canvas').evaluate(element=>JSON.stringify((element as CanvasCommitEl).__lollyModel!().filter(input=>['boxes','textDocument'].includes(input.id)).map(input=>[input.id,input.value])));
    await page.locator('[data-topbar="export"]').click();
    for(const format of ['svg','png','pdf','pptx','penpot','webm','mp4','emf','wmf']){
      await page.locator('[data-action="format"]').selectOption(format,{force:true});
      if(await page.locator('[data-action="transparent-bg"]').isVisible())await page.locator('[data-action="transparent-bg"]').uncheck();
      const [download]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.locator('[data-action="download"]').click()]);assert.equal(await download.failure(),null);
      const bytes=readFileSync((await download.path())!);writeFileSync(`/tmp/lolly-271-composed.${format}`,bytes);assert.ok(bytes.length>1000,`${format} contains output`);
      if(format==='svg')for(const path of glyphs)assert.ok(bytes.toString().includes(path),'SVG retains settled glyph paths');
      if(format==='png'){const image=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual([image.info.width,image.info.height],[640,360]);let ink=0;for(let at=0;at<image.data.length;at+=4)if(image.data[at]!<200&&image.data[at+3]!>200)ink++;assert.ok(ink>2000,'PNG retains visible text');}
      if(format==='pdf')assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
      if(format==='pptx'){const files=unzipSync(bytes),artwork=Object.entries(files).filter(([name])=>name.startsWith('ppt/media/')&&name.endsWith('.svg')).map(([,value])=>new TextDecoder().decode(value)).join('');for(const path of glyphs)assert.ok(artwork.includes(path),'PowerPoint preserves every composed glyph path in its SVG artwork');}
      if(format==='penpot'){const files=unzipSync(bytes),paths=Object.entries(files).filter(([name])=>name.includes('/pages/')&&name.endsWith('.json')).map(([,value])=>JSON.parse(new TextDecoder().decode(value))).filter(node=>node.type==='path');assert.ok(paths.length>=glyphs.length);for(const expected of glyphBounds)assert.ok(paths.some(path=>typeof path.content==='string'&&['x','y','width','height'].every(key=>Math.abs(path[key]-expected[key as keyof typeof expected])<.02)),'Penpot retains each composed glyph at the same bounds');}
      if(format==='emf'){assert.deepEqual([bytes.readInt32LE(72),bytes.readInt32LE(76)],[640,360],'EMF retains full canvas dimensions');assert.equal(bytes.readUInt32LE(48),bytes.length);let offset=0,paths=0;while(offset<bytes.length){const kind=bytes.readUInt32LE(offset),size=bytes.readUInt32LE(offset+4);assert.ok(size>=8&&offset+size<=bytes.length);if(kind===59)paths++;offset+=size;}assert.ok(paths>glyphs.length,'EMF retains glyphs and canvas background');}
      if(format==='wmf'){assert.deepEqual([bytes.readInt16LE(6),bytes.readInt16LE(8),bytes.readInt16LE(10),bytes.readInt16LE(12)],[0,0,640,360],'WMF retains full canvas bounds');let offset=40,paths=0;while(offset<bytes.length){const size=bytes.readUInt32LE(offset)*2,kind=bytes.readUInt16LE(offset+4);assert.ok(size>=6&&offset+size<=bytes.length);if(kind===0x324||kind===0x538)paths++;offset+=size;}assert.ok(paths>glyphs.length,'WMF retains outlined artwork');}
      if(format==='webm')assert.deepEqual([...bytes.subarray(0,4)],[0x1a,0x45,0xdf,0xa3]);
      if(format==='mp4')assert.equal(bytes.subarray(4,8).toString(),'ftyp');
      console.log(`[composed export] ${format}: ${bytes.length} bytes`);
    }
    assert.equal(await page.locator('#tool-canvas').evaluate(element=>JSON.stringify((element as CanvasCommitEl).__lollyModel!().filter(input=>['boxes','textDocument'].includes(input.id)).map(input=>[input.id,input.value]))),before,'exports do not rewrite authored text or frames');
  }catch(error){await diagnose(error);throw error;}finally{await context.close();await closeBrowser();}
});
test('composed PowerPoint keeps frame order, notes, click builds and explicit dwell', {skip:origin?false:'set LOLLY_EXPORT_TEST_URL',timeout:120000},async()=>{
  const story=createTextStory('story','Composed slide',i=>`p${i}`);story.frameIds=['text'];story.defaultStyle='body';
  const doc:TextDocumentV1={version:1,stories:[story],styles:[{id:'body',kind:'paragraph',name:'Body',paragraph:{character:{font:'font',size:36}}}],fonts:[{id:'font',family:'SUSE',sha256:createHash('sha256').update(readFileSync('shells/web/public/fonts/SUSE[wght].ttf')).digest('hex'),faceIndex:0,source:{kind:'bundled',path:'/fonts/SUSE[wght].ttf'}}]};
  const boxes=[{id:'first',kind:'frame',x:0,y:0,w:640,h:360,notes:'First speaker note',slideTransition:'fade',dur:5,order:0},{id:'second',kind:'frame',x:700,y:0,w:640,h:360,notes:'Second speaker note',dur:7,order:1},{id:'text',kind:'text',frame:'first',text:'',textStory:'story',textFrame:JSON.stringify({mode:'fixed',inset:{top:0,right:0,bottom:0,left:0},columns:{count:1,gutter:0,balance:false},verticalAlign:'top'}),x:40,y:45,w:560,h:240,build:2,enter:"fade",enterMs:650},{id:'shape',kind:'box',frame:'second',x:740,y:50,w:100,h:100,bg:'#993366'}];
  const browser=await getBrowser(),context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),diagnose=journeyDiagnostics(context,'design-text-pptx');
  await context.addInitScript(()=>{Object.defineProperty(window,'showSaveFilePicker',{value:undefined});});
  try{
    await page.goto(`${origin}/design?${new URLSearchParams({boxes:JSON.stringify(boxes),textDocument:JSON.stringify(doc),background:'#ffffff',width:'1400',height:'400',autoAdvance:'1',c2pa:'0',imprint:'0'})}`);await page.locator('#tool-canvas svg[data-text-frame="text"]').waitFor();
    await page.locator('[data-topbar="export"]').click();await page.locator('[data-action="format"]').selectOption('pptx',{force:true});
    const [download]=await Promise.all([page.waitForEvent('download',{timeout:60000}),page.locator('[data-action="download"]').click()]);assert.equal(await download.failure(),null);
    const files=unzipSync(readFileSync((await download.path())!)),xml=(name:string)=>new TextDecoder().decode(files[name]);
    const first=xml('ppt/slides/slide1.xml'),second=xml('ppt/slides/slide2.xml');
    assert.match(first,/advTm="5000"/);assert.match(second,/advTm="7000"/);assert.match(second,/<p:fade/);assert.doesNotMatch(first,/<p:fade/);
    assert.match(first,/<p:timing/);assert.match(first,/nodeType="clickEffect"/);assert.match(first,/dur="650"/);assert.match(xml('ppt/notesSlides/notesSlide1.xml'),/First speaker note/);assert.match(xml('ppt/notesSlides/notesSlide2.xml'),/Second speaker note/);
    assert.ok(Object.keys(files).some(name=>name.startsWith('ppt/media/')&&name.endsWith('.svg')),'composed glyph artwork survives');
  }catch(error){await diagnose(error);throw error;}finally{await context.close();await closeBrowser();}
});
