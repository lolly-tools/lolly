import { chromium } from 'playwright';
const b = await chromium.launch();
for (const [label, vp, mob] of [['phone',{width:390,height:844},true],['desktop',{width:1440,height:900},false]]) {
  const ctx = await b.newContext({ viewport:vp, deviceScaleFactor:2, isMobile:mob, hasTouch:mob });
  const pg = await ctx.newPage();
  await pg.goto('http://localhost:5173/t/sequence-studio',{waitUntil:'networkidle'}); await pg.waitForTimeout(4500);
  const snap = async (tag) => pg.evaluate((t) => {
    const m=(s)=>{const e=document.querySelector(s);const r=e?.getBoundingClientRect();return r?Math.round(r.height):0;};
    const p=document.querySelector('.tl-panel').getBoundingClientRect();
    const tr=document.querySelector('.tl-tracks').getBoundingClientRect();
    const bar=document.querySelector('.tl-bar');
    const rows=new Set([...bar.children].filter((c)=>c.getBoundingClientRect().height>0).map((c)=>Math.round(c.getBoundingClientRect().top))).size;
    return { tag: t, panel: Math.round(p.height), chrome: m('.tl-handle')+m('.tl-bar')+m('.tl-ruler'),
      tracks: Math.round(tr.height), pct: Math.round(100*tr.height/p.height), barRows: rows,
      toolBtns: document.querySelectorAll('.tl-tools .tl-btn:not([hidden])').length,
      visibleToolBtns: [...document.querySelectorAll('.tl-tools .tl-btn:not([hidden])')].filter((e)=>e.getBoundingClientRect().height>0).length,
      labels: [...document.querySelectorAll('.tl-inspector .field-label')].filter((e)=>e.getBoundingClientRect().height>0).length };
  }, tag);
  console.log(`\n=== ${label} ===`);
  console.log(' idle    ', JSON.stringify(await snap('idle')));
  const clip = pg.locator('.tl-clip').first();
  if (await clip.count()) { await clip.click({force:true}); await pg.waitForTimeout(900);
    console.log(' selected', JSON.stringify(await snap('selected'))); }
  // drag the grip to the very bottom — the old crush-to-zero case
  const h = await pg.locator('.tl-handle').first().boundingBox();
  if (h) { await pg.mouse.move(h.x+h.width/2, h.y+h.height/2); await pg.mouse.down();
    await pg.mouse.move(h.x+h.width/2, vp.height-2, {steps:12}); await pg.mouse.up(); await pg.waitForTimeout(700);
    console.log(' min drag', JSON.stringify(await snap('min'))); }
  if (mob) await pg.screenshot({path:'/tmp/tl-after.png'});
  await ctx.close();
}
await b.close();
