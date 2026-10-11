// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser,closeBrowser } from '../packages/node-shell/src/browsers.ts';
const origin=process.env.LOLLY_EXPORT_TEST_URL;
test('new tools default to Fluent High Contrast and explicit tool links retain their own choice',{skip:origin?false:'set LOLLY_EXPORT_TEST_URL',timeout:90000},async()=>{
  const browser=await getBrowser({graphics:'auto'}),context=await browser.newContext({serviceWorkers:'block'});
  try {
    const page=await context.newPage();page.setDefaultTimeout(30000);
    const visit=async(emoji?:string)=>{
      const params=new URLSearchParams({text:'Hello \u{1f600}',...(emoji?{emoji}:{}),c2pa:'0',imprint:'0'});
      await page.goto(`${origin}/t/work-avatar?${params}`);
    };
    await visit();
    await page.waitForFunction(()=>document.querySelector<HTMLSelectElement>('[data-emoji-set]')?.value==='community/emoji/fluent/high-contrast@2026.8.24');
    await page.waitForSelector('.wa-text [data-lolly-emoji-svg] svg [fill="currentColor"]',{state:'attached'});
    const saved=new URL(page.url()).searchParams;
    assert.equal(JSON.parse(saved.get('emojistyle')!).primary.id,'community/emoji/fluent/high-contrast');
    await visit('twemoji/color@17.0.3');
    await page.waitForFunction(()=>document.querySelector<HTMLSelectElement>('[data-emoji-set]')?.value==='community/emoji/twemoji/color@17.0.3');
    await page.waitForSelector('.wa-text [data-lolly-emoji-svg] svg path',{state:'attached'});
    assert.equal(await page.locator('.wa-text [data-lolly-emoji-svg] svg [fill="currentColor"]').count(),0);
    await visit('none');
    await page.waitForFunction(()=>document.querySelector<HTMLSelectElement>('[data-emoji-set]')?.value==='');
    assert.equal(new URL(page.url()).searchParams.get('emoji'),'none');
  }finally{await context.close();await closeBrowser();}
});
test('tool previews draw curved emoji, timed captions and geometry from selected artwork',{skip:origin?false:'set LOLLY_EXPORT_TEST_URL',timeout:180000},async()=>{
  const browser=await getBrowser({graphics:'auto'}),context=await browser.newContext({serviceWorkers:'block',viewport:{width:1200,height:900}});
  try {
    const page=await context.newPage();page.setDefaultTimeout(45000);
    const visit=async(id:string,params:Record<string,string>)=>page.goto(`${origin}/t/${id}?${new URLSearchParams({...params,emoji:'twemoji/color@17.0.3',c2pa:'0',imprint:'0'})}`);
    await visit('work-avatar',{text:'Hello 😀 ❤️'});
    // The async emoji pass can rebuild the artwork between separate DOM reads.
    const preview=await page.waitForFunction(()=>{
      const art=document.querySelectorAll('.wa-text [data-lolly-emoji-svg] > g svg').length;
      return art===2?{art,issues:document.querySelectorAll('.wa-text [data-emoji-layout-issue]').length}:false;
    });
    assert.deepEqual(await preview.jsonValue(),{art:2,issues:0});
    const tip=page.getByRole('button',{name:'Got it',exact:true});if(await tip.isVisible())await tip.click();
    await page.locator('.wa-root').screenshot({path:'/tmp/lolly-work-avatar-emoji-verified.png'});
    await visit('audiogram',{transcript:'1\n00:00:00,000 --> 00:00:02,000\nHello 😀\n\n2\n00:00:02,000 --> 00:00:04,000\nBye ❤️',captions:'true'});
    await page.waitForSelector('.ag-caption-run .lolly-emoji',{state:'attached'});
    const cues=await page.evaluate(()=>{
      const clock=document.getElementById('ag-clock') as HTMLCanvasElement&{__lollyFrameRender:(p:number,span:number)=>void};
      clock.__lollyFrameRender(.75,4);
      return [...document.querySelectorAll<HTMLElement>('.ag-caption-run')].map(el=>({shown:el.style.display!=='none',art:el.querySelectorAll('.lolly-emoji').length}));
    });
    assert.deepEqual(cues,[{shown:false,art:1},{shown:true,art:1}]);
    await visit('growth',{seedShape:'text',text:'😀',grown:'false',steps:'0'});
    await page.waitForSelector('.gr-loops path');
    await page.waitForFunction(()=>!document.querySelector('.gr-note')?.textContent);
    const first=await page.locator('.gr-loops').innerHTML();
    await page.evaluate(()=> (window as unknown as {__lollySetInput:(id:string,value:string)=>void}).__lollySetInput('text','❤️'));
    await page.waitForFunction(first=>document.querySelector('.gr-loops')?.innerHTML!==first,first);
    assert.equal(await page.locator('.gr-note').count(),0);
    await visit('synth',{scene:'swarm',text:'😀',particles:'300'});
    await page.waitForFunction(()=>{
      const raw=document.querySelector('#synth-state')?.textContent; if(!raw)return false;
      return JSON.parse(raw).targets?.count>0;
    });
  }finally{await context.close();await closeBrowser();}
});
