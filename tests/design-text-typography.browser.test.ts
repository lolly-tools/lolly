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
import { textStyleResolver } from '../engine/src/text-styles.ts';
import { journeyDiagnostics } from './helpers/journey-diagnostics.ts';
const origin=process.env.LOLLY_EXPORT_TEST_URL;
async function state(page:Page):Promise<TextDocumentV1>{return page.evaluate(()=>JSON.parse((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(input=>input.id==='textDocument')!.value as string));}
async function settle(page:Page){await page.waitForFunction(()=>{const input=document.querySelector('[data-native-text-editor]');return !!input&&input.getAttribute('aria-busy')!=='true'&&!document.querySelector('[data-text-pending="true"]');});}
test('local typography controls shape supported alternatives, preserve source and reopen authored tabs', {skip:origin?false:'set LOLLY_EXPORT_TEST_URL',timeout:150000},async()=>{
  const story=createTextStory('story','Straße Office\t12.50',i=>`p${i}`);story.frameIds=['text'];story.defaultStyle='body';
  const doc:TextDocumentV1={version:1,stories:[story],styles:[{id:'body',kind:'paragraph',name:'Body',paragraph:{character:{font:'font',size:32}}}],fonts:[{id:'font',family:'SUSE',sha256:createHash('sha256').update(readFileSync('shells/web/public/fonts/SUSE[wght].ttf')).digest('hex'),faceIndex:0,source:{kind:'bundled',path:'/fonts/SUSE[wght].ttf'}}]};
  const box={id:'text',kind:'text',text:'',textStory:'story',textFrame:JSON.stringify({mode:'fixed',inset:{top:8,right:8,bottom:8,left:8},columns:{count:1,gutter:0,balance:false},verticalAlign:'top'}),x:150,y:150,w:750,h:220};
  const browser=await getBrowser(),context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),diagnose=journeyDiagnostics(context,'design-text-typography');page.setDefaultTimeout(20000);
  try{
    await page.goto(`${origin}/design?${new URLSearchParams({boxes:JSON.stringify([box]),textDocument:JSON.stringify(doc),c2pa:'0',imprint:'0'})}`);await page.locator('svg[data-text-frame="text"]').waitFor();
    for(const id of ['navigator','inspector']){const toggle=page.locator(`[data-topbar="${id}"]`);if(await toggle.getAttribute('aria-pressed')==='true')await toggle.click();}
    await page.locator('#tool-canvas [data-box-id="text"]').click();await page.keyboard.press('Enter');await settle(page);await page.locator('[data-native-text-editor]').focus();await page.keyboard.press('ControlOrMeta+a');
    await page.locator('.fc-composed-bar').getByRole('button',{name:'More character settings',exact:true}).click();const type=page.getByRole('dialog',{name:'Character typography',exact:true});
    const weight=type.getByRole('spinbutton',{name:'Weight (wght)',exact:true});await weight.fill('700');await weight.press('Tab');await settle(page);
    let current=await state(page),character=textStyleResolver(current).character(current.stories[0]!,current.stories[0]!.paragraphs[0]!,0);assert.equal(character.axes?.wght,700);
    await type.getByLabel('Display case',{exact:true}).selectOption('upper');await settle(page);current=await state(page);assert.equal(current.stories[0]!.source,story.source);assert.equal(textStyleResolver(current).character(current.stories[0]!,current.stories[0]!.paragraphs[0]!,0).case,'upper');
    await type.getByRole('button',{name:'Preview',exact:true}).first().click();await type.locator('svg[aria-label="Alternative preview"]').waitFor();await page.screenshot({path:'/tmp/lolly-271-typography-ui.png'});await type.press('Escape');
    await page.locator('.fc-composed-bar').getByRole('button',{name:'Paragraph',exact:true}).click();const paragraph=page.getByRole('dialog',{name:'Paragraph',exact:true});await paragraph.getByText('More paragraph settings',{exact:true}).click();await paragraph.getByText('Tabs and paragraph edges',{exact:true}).click();
    await paragraph.getByRole('button', { name: 'Add tab stop', exact: true }).evaluate(button => {
      (button as HTMLButtonElement).click();
      button.closest('[role="dialog"]')!.querySelector<HTMLInputElement>('input[aria-label="Position"]')!.focus();
    });
    await settle(page);
    assert.equal(await paragraph.getByRole('spinbutton', { name: 'Position', exact: true }).evaluate(input => input === document.activeElement), true, 'finishing text layout must keep focus in the paragraph control');
    const tab=paragraph.getByRole('group',{name:'Tab stop 1',exact:true});const position=tab.getByLabel('Position',{exact:true});await position.fill('500');await position.press('Tab');await tab.getByLabel('Alignment',{exact:true}).selectOption('decimal');const leader=tab.getByLabel('Leader',{exact:true});await leader.fill('.');await leader.press('Tab');await settle(page);
    const rule=paragraph.getByRole('group',{name:'Rule after paragraph',exact:true});await rule.getByRole('checkbox').check();await settle(page);await paragraph.press('Escape');await page.locator('.fc-composed-bar').getByRole('button',{name:'Done',exact:true}).click();await page.locator('[data-native-text-editor]').waitFor({state:'detached'});
    current=await state(page);assert.deepEqual(current.stories[0]!.paragraphs[0]!.paragraph?.tabs,[{position:500,align:'decimal',leader:'.'}]);assert.equal(current.stories[0]!.paragraphs[0]!.paragraph?.ruleAfter?.enabled,true);
    assert.equal(current.stories[0]!.source, story.source, 'typing into a control must not replace the selected document text');
    await page.keyboard.press('ControlOrMeta+s');await page.getByRole('dialog',{name:'Save as',exact:true}).getByRole('button',{name:'Save',exact:true}).click();await page.locator('.dtb-save-status[data-dirty="false"]').waitFor();await page.reload();await page.locator('svg[data-text-frame="text"]').waitFor();assert.deepEqual(await state(page),current);
    await page.locator('#tool-canvas [data-box-id="text"]').click();await page.keyboard.press('Enter');await settle(page);await page.locator('[data-native-text-editor]').focus();await page.keyboard.press('ControlOrMeta+a');
    await page.locator('.fc-composed-bar').getByRole('button',{name:'Paragraph',exact:true}).click();await paragraph.getByText('Styles',{exact:true}).click();await paragraph.getByText('Create paragraph style',{exact:true}).click();
    const create=paragraph.locator('details').filter({has:page.locator('summary',{hasText:'Create paragraph style'})}).last();await create.getByLabel('New style name',{exact:true}).fill('Temporary style');await create.getByRole('button',{name:'Create from selection',exact:true}).click();await settle(page);
    assert.ok((await state(page)).styles.some(style=>style.name==='Temporary style'));
    await paragraph.getByText('Edit style definition',{exact:true}).click();const definitions=paragraph.locator('details').filter({has:page.locator('summary',{hasText:'Edit style definition'})}).last();
    const temporary=(await state(page)).styles.find(style=>style.name==='Temporary style')!;await definitions.getByLabel('Style',{exact:true}).selectOption(temporary.id);await definitions.getByLabel('Style name',{exact:true}).fill('Updated temporary style');await definitions.getByRole('button',{name:'Update style',exact:true}).click();await settle(page);
    await paragraph.press('Escape');await page.locator('[data-native-text-editor]').press('Escape');await page.locator('[data-native-text-editor]').waitFor({state:'detached'});
    const cancelled=await state(page);assert.deepEqual(cancelled.styles,current.styles);const expected=structuredClone(current.stories);expected[0]!.revision=cancelled.stories[0]!.revision;assert.deepEqual(cancelled.stories,expected);
    await page.locator('#tool-canvas [data-box-id="text"]').dblclick(); await settle(page);
    await page.locator('[data-native-text-editor]').focus(); await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.insertText('A temporary replacement'); await settle(page);
    await page.keyboard.press('ControlOrMeta+z'); await settle(page); assert.equal((await state(page)).stories[0]!.source, story.source);
    await page.keyboard.press('ControlOrMeta+Shift+z'); await settle(page); assert.equal((await state(page)).stories[0]!.source, 'A temporary replacement');
    await page.keyboard.press('Escape'); await page.locator('[data-native-text-editor]').waitFor({state:'detached'}); assert.equal((await state(page)).stories[0]!.source, story.source);

  }catch(error){await diagnose(error);throw error;}finally{await context.close();await closeBrowser();}
});
