// SPDX-License-Identifier: MPL-2.0
/** LOLLY_DESIGN_TOOL_TEST_URL=http://127.0.0.1:5173 node --test tests/design-tool.browser.test.ts */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
const origin = process.env.LOLLY_DESIGN_TOOL_TEST_URL;
const output = process.env.LOLLY_DESIGN_TOOL_TEST_OUTPUT || '/tmp/lolly-design-tool-261';
const skip = origin ? false : 'Serve the web shell and set LOLLY_DESIGN_TOOL_TEST_URL.';
const browserType = process.env.LOLLY_DESIGN_TOOL_TEST_BROWSER === 'webkit' ? webkit : chromium;

test('designer UI produces one portable tool; clean reader exports offline and pins revisions', {skip,timeout:180_000}, async () => {
  await mkdir(output, {recursive:true});
  const browser = await browserType.launch({headless:true});
  try {
    const author = await browser.newPage({viewport:{width:1440,height:1000}});
    author.setDefaultTimeout(15_000);
    const errors: string[] = []; author.on('pageerror', err => errors.push(err.message));
    const boxes = [{id:'title',name:'Welcome title',kind:'text',text:'Welcome to the team',font:'sans',fontSize:72,fg:'#003d31',x:120,y:160,w:1250,h:180},{id:'subtitle',name:'Subtitle',kind:'text',text:'Your design, your rules',font:'sans',fontSize:40,fg:'#245b4f',x:120,y:380,w:1000,h:100}];
    await author.goto(`${origin}/t/design?boxes=${encodeURIComponent(JSON.stringify(boxes))}`);
    await author.getByRole('button',{name:'File menu',exact:true}).click();
    await author.getByText('Share with rules',{exact:true}).click();
    for (const id of ['title','subtitle']) {
      await author.locator(`#tool-canvas [data-box-id="${id}"]`).click();
      await author.getByRole('button',{name:'Make editable',exact:true}).click();
    }
    assert.equal(await author.locator('.dr-input').count(),2);
    const grab = author.locator('.dr-input [data-reorder-handle]').first();
    await grab.click({delay:100});
    assert.match(await author.locator('.dr-input-title').first().innerText(),/Welcome title/);
    const handle = await grab.boundingBox(); const destination = await author.locator('.dr-input').last().boundingBox();
    await author.mouse.move(handle!.x + handle!.width/2,handle!.y + handle!.height/2);
    await author.mouse.down(); await author.mouse.move(handle!.x + handle!.width/2,destination!.y + destination!.height - 2,{steps:12}); await author.mouse.up();
    assert.match(await author.locator('.dr-input-title').first().innerText(),/Subtitle/);
    await author.locator('.dr-input [data-reorder-handle]').last().focus();
    await author.keyboard.press('Space'); await author.keyboard.press('ArrowUp'); await author.keyboard.press('Space');
    const first = author.locator('.dr-input').first();
    await first.locator('[data-reorder-handle]').focus(); await author.keyboard.press('Space'); await author.keyboard.press('ArrowDown'); await author.keyboard.press('Space');
    assert.match(await author.locator('.dr-input-title').first().innerText(),/Subtitle/);
    const title = author.locator('.dr-input').filter({has:author.locator('[data-rule="label"][value="Welcome title"]')});
    if (!await title.evaluate(el => (el as HTMLDetailsElement).open)) await title.locator('summary').first().click();
    await title.locator('.dr-advanced > summary').click();
    await title.getByRole('button',{name:'Build text from first and last name'}).click();
    await author.getByRole('button',{name:'Done',exact:true}).click();
    for (const [name,value] of [['First name','Sam'],['Last name','Rivera']]) {
      const row = author.locator('.dr-input').filter({has:author.locator(`[data-rule="label"][value="${name}"]`)});
      if (!await row.evaluate(el => (el as HTMLDetailsElement).open)) await row.locator('summary').first().click();
      await row.locator('[data-rule="default"]').fill(value!); await row.locator('[data-rule="default"]').press('Tab');
    }
    await author.getByText('Tool setup', {exact:true}).click();
    await author.locator('[data-presentation]').selectOption('on-canvas');
    await author.screenshot({path:`${output}/author-rules.png`});
    if (process.env.LOLLY_DESIGN_TOOL_SHOTS) {
      const svg = await author.evaluate(async () => {
        const path = '/src/bridge/export-svg-walker.ts'; const bridge = '/src/bridge/index.ts'; const shared = '/src/bridge/export-shared.ts';
        const [{renderSvgFromHtml},{createBridge},{setExportHost}] = await Promise.all([import(path),import(bridge),import(shared)]); setExportHost(await createBridge());
        return (await renderSvgFromHtml(document.querySelector('.dr-panel')!,{format:'svg',convertPaths:true,embedMeta:false})).text();
      });
      await writeFile('docs/shots/design-rules-inputs.svg',svg);
    }
    await author.locator('.dr-toolbar [data-mode="preview"]').click();
    await author.locator('#design-rules-preview-canvas').getByText('Sam Rivera',{exact:true}).waitFor();
    await author.getByRole('button',{name:'Edit inputs',exact:true}).click();
    assert.equal(await author.locator('.dr-preview-controls [data-input-id="firstname"]').count(),1);
    await author.locator('.dr-preview-controls [data-input-id="firstname"]').fill('Taylor');
    await author.locator('#design-rules-preview-canvas').getByText('Taylor Rivera',{exact:true}).waitFor();
    await author.locator('.dr-toolbar [data-mode="rules"]').click();
    await author.locator('.dr-toolbar [data-mode="design"]').click();
    assert.equal(await author.locator('.dr-toolbar').isVisible(),true);
    await author.locator('.dr-toolbar [data-mode="preview"]').click();
    await author.locator('#design-rules-preview-canvas').getByText('Taylor Rivera',{exact:true}).waitFor();
    await author.locator('.dr-toolbar [data-mode="preview"]').focus();
    await author.keyboard.press('ControlOrMeta+z');
    await author.locator('#design-rules-preview-canvas').getByText('Sam Rivera',{exact:true}).waitFor();
    await author.keyboard.press('ControlOrMeta+Shift+z');
    await author.locator('#design-rules-preview-canvas').getByText('Taylor Rivera',{exact:true}).waitFor();
    await author.locator('.dr-samples > summary').click();
    await author.getByRole('button',{name:'Reset samples',exact:true}).click();
    await author.locator('#design-rules-preview-canvas').getByText('Sam Rivera',{exact:true}).waitFor();
    await author.locator('.dr-samples > summary').click();
    await author.screenshot({path:`${output}/author-preview.png`});
    await author.locator('.dr-toolbar [data-share]').click();
    await author.locator('[data-name]').fill('Welcome card');
    const downloading = author.waitForEvent('download').catch(async error => {console.error(await author.locator('.dr-share').innerText()); throw error;});
    await author.getByRole('button',{name:'Download .lolly',exact:true}).click();
    const download = await downloading; await download.saveAs(`${output}/welcome.lolly`);
    await author.getByRole('button',{name:'Try downloaded file',exact:true}).waitFor();
    assert.match(await author.locator('[data-package-details]').innerText(),/v1.0.0/);
    const againPromise=author.waitForEvent('download');
    await author.getByRole('button',{name:'Download again',exact:true}).click();
    const again=await againPromise;await again.saveAs(`${output}/welcome-again.lolly`);
    assert.deepEqual(await readFile(`${output}/welcome-again.lolly`),await readFile(`${output}/welcome.lolly`));
    await author.screenshot({path:`${output}/author-share.png`});
    await author.getByRole('button',{name:'Try downloaded file',exact:true}).click();
    const trial=author.getByRole('dialog',{name:'Try downloaded tool',exact:true});
    await trial.locator('.lolly-locked-design').getByText('Sam Rivera',{exact:true}).waitFor();
    await trial.getByRole('button',{name:'Edit inputs',exact:true}).click();
    await trial.locator('[data-input-id="firstname"]').fill('Jordan');
    await trial.locator('.lolly-locked-design').getByText('Jordan Rivera',{exact:true}).waitFor();
    await trial.getByRole('button',{name:'Back to master',exact:true}).click();
    await author.locator('#design-rules-preview-canvas').getByText('Sam Rivera',{exact:true}).waitFor();
    assert.equal(errors.length,0);
    const context = await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
    const reader = await context.newPage(); reader.on('pageerror', err => errors.push(err.message));
    await reader.goto(`${origin}/`);
    const bytes = [...await readFile(`${output}/welcome.lolly`)];
    await reader.evaluate(async bytes => {
      const path = '/src/lib/drop-router.ts'; const bridgePath = '/src/bridge/index.ts';
      const {openLollyFile} = await import(path); const {createBridge} = await import(bridgePath);
      Reflect.set(window,'rulesImport',openLollyFile(new File([new Uint8Array(bytes)],'welcome.lolly'),await createBridge()));
    }, bytes);
    await reader.getByRole('button',{name:'Trust & install',exact:true}).click();
    await reader.locator('.lolly-locked-design').waitFor();
    assert.equal(await reader.locator('.fc-overlay').count(),0);
    await reader.getByRole('button',{name:'Edit inputs',exact:true}).click();
    await reader.locator('[data-input-id="firstname"]').fill('');
    await reader.keyboard.insertText('A'.repeat(201));
    assert.equal(await reader.locator('[data-input-id="firstname"]').inputValue(),'A'.repeat(201));
    await reader.locator('[data-input-id="firstname"][aria-invalid="true"]').waitFor({timeout:10_000});
    await reader.locator('[data-input-id="lastname"]').fill('Lee');
    await reader.locator('.lolly-locked-design').getByText('Lee',{exact:true}).waitFor();
    assert.equal(await reader.locator('[data-input-id="firstname"]').inputValue(),'A'.repeat(201));
    assert.equal(await reader.locator('[data-input-id="firstname"]').getAttribute('aria-invalid'),'true');
    await reader.locator('[data-input-id="lastname"]').fill('Rivera');
    await reader.locator('[data-input-id="firstname"]').fill('Alex');
    await reader.locator('.lolly-locked-design').getByText('Alex Rivera',{exact:true}).waitFor();
    const fixedAppearance = await reader.evaluate(() => {
      const node = document.querySelector('.lolly-locked-design .lolly-box-text')!;
      const before = getComputedStyle(node); const expected = [before.fontFamily,before.color,before.fontSize];
      const root = document.documentElement; const original = root.getAttribute('style');
      root.style.setProperty('--font-brand','serif'); root.style.setProperty('--primary','0 100% 50%');
      const after = getComputedStyle(node); const actual = [after.fontFamily,after.color,after.fontSize];
      if (original === null) root.removeAttribute('style'); else root.setAttribute('style',original);
      return {expected,actual};
    });
    assert.deepEqual(fixedAppearance.actual,fixedAppearance.expected);
    await reader.keyboard.press('Escape');
    assert.equal(await reader.getByRole('button',{name:'Edit inputs',exact:true}).getAttribute('aria-expanded'),'false');
    await reader.getByRole('button',{name:'Edit inputs',exact:true}).click();
    await reader.screenshot({path:`${output}/reader-desktop.png`});
    await reader.setViewportSize({width:640,height:900}); await reader.waitForTimeout(350);
    await reader.screenshot({path:`${output}/reader-mobile.png`});
    await reader.setViewportSize({width:390,height:844}); await reader.waitForTimeout(150);
    await reader.getByRole('button',{name:'Preview',exact:true}).click();
    assert.equal(await reader.getByRole('button',{name:'Edit inputs',exact:true}).getAttribute('aria-expanded'),'false');
    await reader.getByRole('button',{name:'Edit inputs',exact:true}).click();
    await reader.screenshot({path:`${output}/reader-phone.png`});
    assert.ok(await reader.evaluate(() => document.documentElement.scrollWidth <= innerWidth),'reader fits the phone viewport');
    const prepared = await reader.evaluate(async () => {
      const loader = '/src/bridge/tool-loader.ts'; const bridge = '/src/bridge/index.ts'; const mounts = '/src/lib/mount-runtime.ts'; const installer = '/src/lib/installed-tools.ts'; const bundles = '/src/lib/tool-bundle.ts';
      const [{getTool},{createBridge},{createToolRuntime},installed,{resolveToolBundle}] = await Promise.all([import(loader),import(bridge),import(mounts),import(installer),import(bundles)]);
      const meta = (await installed.installedToolMetas())[0]; const original = await getTool(meta.id,meta.artifactDigest); const host = await createBridge();
      const bundle = await resolveToolBundle(meta.id,original.manifest);
      const files = {...bundle.files}; const changed = {...JSON.parse(new TextDecoder().decode(files['tool.json'])),version:'1.0.1',name:'New revision'};
      files['tool.json'] = new TextEncoder().encode(JSON.stringify(changed));
      const next = await installed.installTool({manifest:changed,files,trust:'custom'});
      const pinned = await getTool(meta.id,meta.artifactDigest); const current = await getTool(meta.id).catch((e: {message:string;issues:unknown}) => { throw new Error(`${e.message}: ${JSON.stringify(e.issues)}`); });
      const reShared = await resolveToolBundle(meta.id,pinned.manifest);
      const conflict = await installed.installTool({manifest:changed,files:{...files,'README.txt':new TextEncoder().encode('changed')},trust:'custom'}).then(() => false,() => true);
      const runtime = await createToolRuntime(original,host,{firstname:'Alex',lastname:'Rivera'});
      Reflect.set(window,'renderRules',async () => {
        const canvas = document.querySelector<HTMLElement>('#tool-canvas')!;
        canvas.innerHTML = runtime.getHydrated(); canvas.style.width = '1920px'; canvas.style.height = '1080px';
        const results = [];
        try {
          for (const format of ['png','svg','pdf']) {
            try { const blob = await runtime.export(canvas,format,{width:1920,height:1080,embedMeta:false,watermark:false,c2pa:false,imprint:false}); results.push({format,size:blob.size,head:[...new Uint8Array(await blob.slice(0,32).arrayBuffer())]}); }
            catch (error) { throw new Error(`${format}: ${(error as Error).stack || String(error)}`); }
          }
          return results;
        } finally { /* The receiving tool stays mounted across the offline edit. */ }
      });
      return {old: pinned.manifest.version,current:current.manifest.version,different:meta.artifactDigest!==next.artifactDigest,reshared:JSON.parse(new TextDecoder().decode(reShared.files['tool.json'])).version,conflict};
    });
    assert.deepEqual(prepared,{old:'1.0.0',current:'1.0.1',different:true,reshared:'1.0.0',conflict:true});
    const live = await reader.evaluate(() => Reflect.get(window,'renderRules')());
    assert.deepEqual(live.map((r: {format:string}) => r.format),['png','svg','pdf']);
    for (const result of live) assert.ok(result.size > 500,`${result.format} has rendered content`);
    // WebKit's offline emulation also rejects in-memory Blob reads. Deny every
    // HTTP request there while leaving local bytes readable, as on a real device.
    if (browserType === webkit) await context.route(/^https?:/,route => route.abort('internetdisconnected'));
    else await context.setOffline(true);
    const offline = await reader.evaluate(() => Reflect.get(window,'renderRules')());
    for (const result of offline) assert.ok(result.size > 500, `${result.format} exports offline`);
    // The existing stage resize observer also emits this notification on QR Code
    // in WebKit at phone widths. Keep it visible without masking application errors.
    const resizeNotice = 'ResizeObserver loop completed with undelivered notifications.';
    const expectedResize: string[] = browserType === webkit ? errors.filter(message => message === resizeNotice) : [];
    if (expectedResize.length) console.warn(`WebKit: ${expectedResize.length} existing stage resize notification(s); layout and exports checked.`);
    assert.deepEqual(errors.filter(message => !expectedResize.includes(message)),[]);
    await context.close();
  } finally { await browser.close(); }
});

test('two authored artboards keep text and embedded images through the strict worker', {skip,timeout:90_000}, async () => {
  const browser = await browserType.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const image = {id:'user/fixture-image',source:'user',type:'raster',format:'png',url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6OBoAAAAASUVORK5CYII=',meta:{baked:true}};
    const boxes = [{id:'left',kind:'frame',name:'Landscape',x:0,y:0,w:800,h:400,bg:'#ffffff'}, {id:'right',kind:'frame',name:'Portrait',x:1000,y:0,w:400,h:600,bg:'#ffffff'}, {id:'name-left',kind:'text',name:'Name',frame:'left',x:40,y:40,w:650,h:100,text:'Sam',font:'sans',fontSize:40,fg:'#003d31'}, {id:'name-right',kind:'text',name:'Name',frame:'right',x:1040,y:40,w:320,h:100,text:'Sam',font:'sans',fontSize:40,fg:'#003d31'}, {id:'image',kind:'image',frame:'left',x:50,y:160,w:150,h:150,image}];
    await page.goto(`${origin}/t/design?boxes=${encodeURIComponent(JSON.stringify(boxes))}`);
    await page.getByRole('button',{name:'File menu',exact:true}).click(); await page.getByText('Share with rules',{exact:true}).click();
    await page.getByRole('button',{name:'Add layout choice',exact:true}).click();
    await page.locator('.dr-input > summary').first().click();
    await page.getByRole('button',{name:'Edit options',exact:true}).click();
    await page.getByRole('button',{name:'Add preview thumbnail',exact:true}).click();
    await page.locator('.dr-rule-editor .dr-option-thumb').waitFor({timeout:20_000}).catch(async error=>{console.error(await page.locator('.dr-rule-editor').innerText());throw error;});
    await page.screenshot({path:`${output}/choice-editor.png`});
    await page.getByRole('button',{name:'Done',exact:true}).click();
    await page.locator('[data-share]').click();await page.getByRole('button',{name:'Check file',exact:true}).click();
    await page.getByText(/Layout checks passed.*The file is ready/).waitFor();
    await page.getByRole('button',{name:'Back',exact:true}).click();

    const outcome = await page.evaluate(async ({source,loaderPath}) => {
      const draftPath = '/src/lib/design-tool-draft.ts'; const compilePath = '/src/lib/design-tool-compile.ts'; const bridgePath = '/src/bridge/index.ts'; const runtimePath = '/src/lib/mount-runtime.ts'; const preflightPath = '/src/lib/design-tool-preflight.ts';
      const [{designVariants,newDesignToolDraft,makeDesignInput,addArtboardChoice},{prepareDesignTool},{createBridge},{loadTool},{createToolRuntime},{preflightDesignTool}] = await Promise.all([import(draftPath),import(compilePath),import(bridgePath),import(loaderPath),import(runtimePath),import(preflightPath)]);
      const d = newDesignToolDraft(designVariants(source,800,400,'#ffffff'),'Two layouts');
      const name = makeDesignInput(d,'name-left','text'); name.targets.push({variantId:'right',layerId:'name-right',property:'text'});
      makeDesignInput(d,'image','image'); addArtboardChoice(d);
      const host = await createBridge(); const compiled = await prepareDesignTool(d,document.querySelector('#tool-canvas')!,host);
      await preflightDesignTool(compiled,host);
      const tool = await loadTool(d.id,async (path:string) => String(compiled.files[path.slice(d.id.length+1)] || ''),{trustClass:'sideloaded-consented'});
      const runtime = await createToolRuntime(tool,host,{[name.input.id]:'Reader'});
      try {
        const left = runtime.getHydrated(); const dropped = runtime.droppedAssets;
        await runtime.setInput('layout','right'); const right = runtime.getHydrated();
        await runtime.setInput('layout','left');
        return {leftImage:left.includes('data:image/png;base64,'),leftName:left.includes('Reader'),rightName:right.includes('Reader'),rightSize:right.includes('data-design-width="400" data-design-height="600"'),dropped,errors:runtime.hookErrors,embedded:tool.manifest.inputs.find((i:{type:string}) => i.type === 'asset').default.meta.baked};
      } finally { runtime.destroy(); }
    }, {source:boxes,loaderPath:`/@fs${resolve('engine/src/loader.ts')}`});
    assert.deepEqual(outcome,{leftImage:true,leftName:true,rightName:true,rightSize:true,dropped:[],errors:[],embedded:true});
  } finally { await browser.close(); }
});

test('PDF and PDF-compatible AI preserve source names and expose editable content', {skip,timeout:90_000}, async () => {
  const doc = await PDFDocument.create();
  const face = await doc.embedFont(StandardFonts.Helvetica);
  for (const [width,height] of [[600,300],[300,600]]) {
    const page = doc.addPage([width!,height!]);
    page.drawText('Sam Rivera',{x:30,y:height!-70,size:24,font:face,color:rgb(0,0.24,0.2)});
    page.drawRectangle({x:30,y:30,width:100,height:100,color:rgb(0.2,0.8,0.5)});
  }
  const bytes = [...await doc.save()];
  const browser = await browserType.launch({headless:true});
  try {
    const page = await browser.newPage(); await page.goto(`${origin}/t/design`);
    await page.getByRole('button',{name:'File menu',exact:true}).waitFor();
    const parsed = await page.evaluate(async bytes => {
      const path = '/src/views/design-import.ts'; const bridge = '/src/bridge/index.ts';
      const {parseDesignArtboards} = await import(path); const {createBridge} = await import(bridge); const host = await createBridge();
      const results = [];
      for (const name of ['source.pdf','source.ai']) {
        const imported = await parseDesignArtboards(new File([new Uint8Array(bytes)],name),{host,map:{fonts:{preserveSource:true}}});
        results.push({pages:imported.frames.length,text:imported.frames.flatMap((f: {boxes:Array<{text?:string;font?:string}>}) => f.boxes.filter(b => b.text).map(b => ({text:b.text,font:b.font}))),sizes:imported.frames.map((f: {width:number;height:number}) => [f.width,f.height])});
      }
      return results;
    },bytes);
    assert.equal(parsed.length,2);
    assert.deepEqual(parsed[0],parsed[1]);
    assert.equal(parsed[0]!.pages,2);
    assert.ok(parsed[0]!.text.some((b: {text:string;font:string}) => b.text.includes('Sam Rivera') && /helvetica/i.test(b.font)),JSON.stringify(parsed));
    assert.deepEqual(parsed[0]!.sizes,[[600,300],[300,600]]);
    await page.evaluate(async bytes=>{const path='/src/views/design-rules-pages.ts';const {chooseRulesPages}=await import(path);Reflect.set(window,'pickedRulesPages',chooseRulesPages(new File([new Uint8Array(bytes)],'Canva course.pdf')));},bytes);
    await page.getByRole('dialog',{name:'Choose tool artboards'}).waitFor();
    await page.getByRole('checkbox',{name:'Page 1',exact:true}).uncheck();
    await page.locator('.dr-page-card img[src]').first().waitFor();
    await page.getByRole('button',{name:'Import selected artboards',exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>Reflect.get(window,'pickedRulesPages')),[1]);

  } finally { await browser.close(); }
});

test('Rules selection, Preview gestures and fitted text obey authored bounds', {skip,timeout:90_000}, async()=>{
  const browser=await browserType.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15_000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('about:blank');
    const image=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;const g=canvas.getContext('2d')!;g.fillStyle='#078565';g.fillRect(0,0,256,128);g.fillStyle='#fff';g.fillRect(0,0,128,64);return {id:'user/rules-gesture',source:'user',meta:{baked:true},type:'raster',format:'png',url:canvas.toDataURL(),width:256,height:128};});
    const boxes=[{id:'photo',kind:'image',name:'Photo',image,x:80,y:200,w:400,h:240,imageFraming:{x:40,y:30,zoom:120}},{id:'title',kind:'text',name:'Title',text:'Hello',font:'sans',fontSize:48,x:560,y:200,w:600,h:120},{id:'copy',kind:'text',name:'Copy',text:'Hello',font:'sans',fontSize:48,x:560,y:370,w:300,h:100},{id:'outline',kind:'box',name:'Outlined artwork',bg:'#333333',x:1400,y:200,w:100,h:100}];
    await page.goto(`${origin}/t/design?boxes=${encodeURIComponent(JSON.stringify(boxes))}`);
    await page.getByRole('button',{name:'File menu',exact:true}).click();await page.getByText('Share with rules',{exact:true}).click();
    await page.locator('#tool-canvas [data-box-id="outline"]').click();assert.equal(await page.getByRole('button',{name:'Make editable',exact:true}).isDisabled(),true);
    await page.getByRole('button',{name:'Replace selected artwork with text',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();
    const board=await page.locator('#tool-canvas').boundingBox();await page.mouse.move(board!.x+20,board!.y+20);await page.mouse.down();await page.mouse.move(board!.x+board!.width*.7,board!.y+board!.height*.55,{steps:12});await page.mouse.up();
    assert.equal(await page.locator('#tool-canvas .dr-selected').count(),3);
    await page.locator('#tool-canvas [data-box-id="photo"]').click();await page.getByRole('button',{name:'Make editable',exact:true}).click();
    const photo=page.locator('.dr-input[data-field="photo"]');await photo.locator('.dr-advanced > summary').click();await photo.getByRole('button',{name:'Add image positioning',exact:true}).click();
    const position=page.locator('.dr-input[data-field="photoFraming"]');await position.locator('summary').first().click();await position.locator('.dr-advanced > summary').click();
    for(const [key,value] of [['x:min','20'],['x:max','70'],['y:min','10'],['y:max','60'],['zoom:max','180']]) {const control=position.locator(`[data-rule="vector:${key}"]`);await control.fill(value!);await control.press('Tab');}
    await page.locator('#tool-canvas [data-box-id="title"]').click();await page.getByRole('button',{name:'Make editable',exact:true}).click();
    const title=page.locator('.dr-input[data-field="title"]');await title.locator('.dr-advanced > summary').click();
    await page.locator('#tool-canvas [data-box-id="copy"]').click();await title.getByRole('button',{name:'Link selected objects to this input',exact:true}).click();
    assert.equal(await title.locator('[data-act="unlink"]').count(),2);
    await title.locator('[data-rule="fit"]').selectOption('shrink');await title.locator('[data-rule="min"]').fill('16');await title.locator('[data-rule="min"]').press('Tab');
    await title.locator('[data-rule="target:1:min"]').fill('16');await title.locator('[data-rule="target:1:min"]').press('Tab');await title.locator('[data-rule="sharedSize"]').check();
    await page.locator('.dr-toolbar [data-mode="preview"]').click();await page.locator('#design-rules-preview-canvas [data-framing="photoFraming"]').waitFor();
    const frame=page.locator('#design-rules-preview-canvas [data-framing="photoFraming"]');const geometry=await frame.evaluate(el=>[(el as HTMLElement).style.left,(el as HTMLElement).style.top,el.clientWidth,el.clientHeight]);
    await frame.click();const overlay=page.locator('.dr-preview .framing-layer');await overlay.waitFor({state:'visible'});
    assert.equal(await overlay.getByRole('button',{name:'Rotate image',exact:true}).isVisible(),false);assert.equal(await overlay.getByRole('button',{name:'Use as a new image',exact:true}).isVisible(),false);
    const rect=await overlay.boundingBox();await page.mouse.move(rect!.x+rect!.width/2,rect!.y+rect!.height/2);await page.mouse.down();await page.mouse.move(rect!.x+800,rect!.y+400,{steps:10});await page.mouse.up();
    const x=page.locator('.dr-preview-controls [data-input-id="photoFraming"] [data-vec-field="x"]');const y=page.locator('.dr-preview-controls [data-input-id="photoFraming"] [data-vec-field="y"]');
    const read=async()=>[Number(await x.inputValue()),Number(await y.inputValue())];
    await page.waitForFunction(()=>document.querySelector<HTMLInputElement>('.dr-preview-controls [data-input-id="photoFraming"] [data-vec-field="x"]')?.value!=='40');
    const values=await read();assert.ok(values[0]!>=20&&values[0]!<=70);assert.ok(values[1]!>=10&&values[1]!<=60);assert.notDeepEqual(values,[40,30]);
    assert.deepEqual(await frame.evaluate(el=>[(el as HTMLElement).style.left,(el as HTMLElement).style.top,el.clientWidth,el.clientHeight]),geometry);
    await overlay.getByRole('button',{name:'Reset',exact:true}).click();await page.waitForFunction(()=>document.querySelector<HTMLInputElement>('.dr-preview-controls [data-input-id="photoFraming"] [data-vec-field="x"]')?.value==='40');
    assert.deepEqual(await read(),[40,30]);
    await overlay.focus();await page.keyboard.press('Escape');assert.equal(await page.locator('.dr-preview').isVisible(),true);
    await page.locator('.dr-preview-controls [data-input-id="title"]').fill('A longer shared heading');
    await page.waitForFunction(()=>[...document.querySelectorAll<HTMLElement>('#design-rules-preview-canvas [data-fit-group="title"]')].every(el=>!!el.dataset.effectiveSize));
    const fitted=await page.locator('#design-rules-preview-canvas [data-fit-group="title"]').evaluateAll(els=>els.map(el=>Number((el as HTMLElement).dataset.effectiveSize)));
    assert.equal(fitted.length,2);assert.equal(fitted[0],fitted[1]);assert.ok(fitted[0]!<48&&fitted[0]!>=16);
    const limits=await page.evaluate(async()=>{const path='/src/lib/text-layout-check.ts';const {checkTextLayout}=await import(path);const root=document.querySelector('#design-rules-preview-canvas')!;const image=root.querySelector<HTMLElement>('[data-design-layer="photo"]')!;image.dataset.imageMinWidth='512';const bridge='/src/bridge/index.ts';const {createBridge}=await import(bridge);const check=await checkTextLayout(root,(await createBridge()).text);delete image.dataset.imageMinWidth;return check;});
    assert.ok(limits.issues.some((issue:string)=>issue.includes('512')));
    await page.screenshot({path:`${output}/author-gestures.png`});
    await page.locator('.dr-toolbar [data-mode="rules"]').click();await title.locator('[data-act="unlink"]').last().click();assert.equal(await title.locator('[data-act="unlink"]').count(),1);
    const cancelled=page.locator('[data-share]');await cancelled.click();await page.getByRole('button',{name:'Check file',exact:true}).click();await page.getByRole('button',{name:'Back',exact:true}).click();assert.equal(await page.getByRole('dialog',{name:'Share tool'}).count(),0);
    await page.getByText('Tool setup',{exact:true}).click();
    await page.getByRole('button',{name:'Find content',exact:true}).click();await page.getByRole('searchbox').fill('Copy');await page.getByRole('button',{name:/Artboard · Copy/}).click();assert.equal(await page.locator('#tool-canvas [data-box-id="copy"]').evaluate(el=>el.classList.contains('dr-selected')),true);
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});

test('an awaited file chooser imports Rules into the destination and remounts the Design vanity route', {skip,timeout:90_000}, async()=>{
  const doc=await PDFDocument.create();const face=await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([600,300]).drawText('A complete course heading',{x:30,y:220,size:24,font:face});
  const bytes=[...await doc.save()];const browser=await browserType.launch({headless:true});
  try {
    const page=await browser.newPage();page.setDefaultTimeout(15_000);
    await page.goto(`${origin}/t/qr-code?url=https%3A%2F%2Flolly.tools`);
    await page.locator('#tool-canvas svg').first().waitFor();
    for(let pass=0;pass<2;pass++) {
      const previousToolbar = pass ? await page.locator('.dr-toolbar').elementHandle() : null;
      await page.evaluate(async bytes=>{
        const router='/src/lib/drop-router.ts', bridge='/src/bridge/index.ts';
        const {openDropChooser}=await import(router);const {createBridge}=await import(bridge);
        void openDropChooser([new File([new Uint8Array(bytes)],'Course.pdf',{type:'application/pdf'})],await createBridge());
      },bytes);
      await page.getByRole('button',{name:/Share with rules/}).click();
      if (previousToolbar) await page.waitForFunction(el => !el.isConnected, previousToolbar);
      await page.locator('.dr-toolbar [data-mode="rules"]').waitFor({timeout:60_000});
      const heading=page.locator('#tool-canvas .lolly-box-text').getByText('A complete course heading',{exact:true});
      await heading.waitFor();
      assert.equal(new URL(page.url()).pathname,'/design');
      assert.equal(await page.locator('.dr-toolbar').count(),1);
      assert.equal(await page.locator('#tool-canvas').count(),1);
      await heading.click();await page.getByRole('button',{name:'Make editable',exact:true}).click();
      assert.equal(await page.locator('.dr-input').count(),1);
      if(pass===0) {
        await page.getByText('Tool setup',{exact:true}).click();
        await page.getByRole('button',{name:'Compare with source',exact:true}).click();
        const comparison=page.getByRole('dialog',{name:'Compare source and Design'});
        for(const width of [640,390]) {
          await page.setViewportSize({width,height:900});
          await comparison.locator('.dr-compare-page > img').waitFor();
          await page.waitForFunction(()=>[...document.querySelectorAll('.dr-compare-page')].every(pane=>{
            const child=pane.firstElementChild;if(!child)return false;
            const box=child.getBoundingClientRect();return box.width<=pane.clientWidth+1&&box.height<=pane.clientHeight+1;
          }));
          const widths=await comparison.locator('.dr-compare-page').evaluateAll(panes=>panes.map(pane=>pane.firstElementChild!.getBoundingClientRect().width));
          assert.ok(Math.abs(widths[0]!-widths[1]!)<1,'comparison keeps both pages at the same fitted scale');
        }
        await comparison.getByRole('button',{name:'Done',exact:true}).click();
        await page.setViewportSize({width:1280,height:720});
      }
    }
  } finally {await browser.close();}
});
