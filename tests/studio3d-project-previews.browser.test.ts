// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import { journeyDiagnostics } from './helpers/journey-diagnostics.ts';
import assert from 'node:assert/strict';
import { getBrowser,closeBrowser } from '../packages/node-shell/src/browsers.ts';
const origin=process.env.LOLLY_EXPORT_TEST_URL;
test('3D Studio first look is transparent and saved projects recover missing scene previews',{skip:origin?false:'set LOLLY_EXPORT_TEST_URL',timeout:180000},async()=>{
  const browser=await getBrowser({graphics:'auto'}),context=await browser.newContext({serviceWorkers:'block',viewport:{width:1400,height:1000}});
  const diagnose = journeyDiagnostics(context, 'studio3d-project-previews');
  try {
    const page=await context.newPage();page.setDefaultTimeout(90000);
    await page.goto(`${origin}/t/3d-studio?samples=8&c2pa=0&imprint=0`);
    await page.waitForSelector('[data-studio-state="ready"]',{state:'attached'});
    const first=await page.locator('[data-lolly-studio]').evaluate(el=>JSON.parse((el as HTMLElement).dataset.lollyStudio!).values);
    assert.equal(first.outputMode,'object-shadow');
    assert.equal(first.camera.azimuth,-47.13242187499999);
    await page.waitForFunction(()=>typeof (window as unknown as {__lollyCaptureThumb?:unknown}).__lollyCaptureThumb==='function',null,{polling:100});
    await page.evaluate(()=>document.querySelector<HTMLElement>('[data-action="save"]')!.click());
    await page.waitForFunction(()=>document.querySelector('[data-action="save"] [data-save-label]')?.textContent?.trim()==='Saved',null,{polling:100});
    const saved=await page.evaluate(async()=>{
      const mod='/src/bridge/index.ts',host=await (await import(mod)).createBridge();
      return (await host.state.list()).find((item:{toolId?:string;slot:string})=>item.toolId==='3d-studio'||item.slot.startsWith('3d-studio:'));
    });
    // Since plan 373 a picture is stored once and the list row carries its reference.
    assert.ok(saved?.preview?.key||saved?.thumb?.startsWith('data:image/'),'Save attaches the scene preview before reporting success');
    await page.evaluate(async()=>{
      const mod='/src/bridge/index.ts',host=await (await import(mod)).createBridge();
      const values=JSON.parse(document.querySelector<HTMLElement>('[data-lolly-studio]')!.dataset.lollyStudio!).values;
      await host.state.save('3d-studio:preview-regression',{...values,__toolId:'3d-studio',__label:'Recovered scene preview'},null);
    });
    await page.goto(`${origin}/p?tools=3d-studio`);
    const tile=page.locator('[data-open-session="3d-studio:preview-regression"]').first();
    await tile.waitFor();
    await page.waitForFunction(()=>{
      const tile=document.querySelector('[data-open-session="3d-studio:preview-regression"]')?.closest('[data-ref]');
      return !!tile?.querySelector('img[src^="data:image/"], img[src^="blob:"]');
    });
    await page.screenshot({path:'/tmp/lolly-studio-project-preview.png'});
  }catch(error){await diagnose(error);throw error;}finally{await context.close();await closeBrowser();}
});
