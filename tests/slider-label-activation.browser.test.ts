// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';

const origin = process.env.LOLLY_EXPORT_TEST_URL;

test('slider gestures never activate help or token actions through a wrapping label', {
  skip: origin ? false : 'set LOLLY_EXPORT_TEST_URL', timeout: 60000,
}, async () => {
  const browser = await getBrowser();
  try {
    const page = await browser.newPage({ hasTouch: true, viewport: { width: 800, height: 900 } });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    // Keep the app bootstrap from racing the isolated fixture.
    await page.route(new URL(origin!).href, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
    await page.goto(origin!);
    // A small mounted fixture uses the production slider, help and token-action
    // wiring. Real browser input is essential: jsdom does not forward label clicks.
    await page.setContent(`<style>
      .input-row { display:block; position:relative; margin:30px; width:300px; }
      .input-label { display:flex; gap:12px; }
      .custom-slider { height:30px; width:300px; touch-action:none; }
      .cs-track { height:12px; width:300px; background:#ccc; }
      .help-tip-pop[hidden] { display:none; }
    </style><main id="fixture"></main>`);
    await page.addScriptTag({ type: 'module', content: `
      import { customSliderHtml, mountCustomSlider, upgradeRangeInput } from '/src/components/custom-slider.ts';
      import { helpTip, wireHelpTips, linkHelpDescriptions } from '/src/components/help-tip.ts';
      import { mountRulesEntrypoints } from '/src/lib/rules-entrypoints.ts';
      const scope = document.querySelector('#fixture');
      const ids = ['helpFirst', 'actionsFirst', 'unlinked', 'upgraded', 'native'];
      for (const id of ids) {
        const help = helpTip('Description for ' + id);
        const control = id === 'native' ? '<input data-input-id="native">'
          : id === 'upgraded' ? '<input type="range" class="field-range" data-input-id="upgraded" min="0" max="100" value="50">'
          : customSliderHtml({ min:0, max:100, step:1, value:50, attrs:'data-input-id="' + id + '"' });
        scope.insertAdjacentHTML('beforeend', '<label class="input-row" data-row="' + id + '"><span class="input-label"><span class="input-label-text">' + id + '</span>' + help.button + '</span>' + control + help.pop + '</label>');
      }
      const model = ids.map(id => ({id, label:id, type:'number', value:50}));
      mountRulesEntrypoints({manifest:{id:'slider-regression',name:'Slider regression',inputs:model},getModel:()=>model}, scope, ()=>({}), {tokens:{get:async()=>({query:()=>[]})}});
      const actionsRow = scope.querySelector('[data-row="actionsFirst"] .input-label');
      actionsRow.prepend(actionsRow.querySelector('.input-rule-actions'));
      for (const el of scope.querySelectorAll('.custom-slider')) mountCustomSlider(el);
      linkHelpDescriptions(scope);
      upgradeRangeInput(scope.querySelector('input[type="range"]'));
      // Also exercise the click guard on a wrapping label before label linking.
      scope.querySelector('[data-row="unlinked"]').removeAttribute('for');
      wireHelpTips(scope);
      scope.dataset.ready = 'true';
    ` });
    await page.waitForSelector('#fixture[data-ready="true"]').catch(error => { throw new Error(errors.join('\n') || String(error)); });
    assert.deepEqual(errors, []);
    for (const id of ['helpFirst', 'actionsFirst', 'unlinked', 'upgraded']) {
      const row = page.locator(`[data-row="${id}"]`);
      const slider = row.getByRole('slider', { name: id, exact: true });
      assert.equal(await slider.getAttribute('aria-describedby'), await row.locator('.help-tip-pop').getAttribute('id'));
      const track = (await row.locator('.cs-track').boundingBox())!;
      const y = track.y + track.height / 2;
      await page.mouse.click(track.x + track.width * .2, y);
      assert.equal(await slider.getAttribute('aria-valuenow'), '20');
      await page.mouse.move(track.x + track.width * .2, y);
      await page.mouse.down();
      await page.mouse.move(track.x + track.width * .8, y, { steps: 8 });
      await page.mouse.move(track.x + track.width * .4, y, { steps: 8 });
      await page.mouse.up();
      assert.equal(await slider.getAttribute('aria-valuenow'), '40');
      assert.equal(await row.locator('.help-tip-btn').getAttribute('aria-expanded'), 'false');
      assert.equal(await row.locator('.input-rule-actions').getAttribute('aria-expanded'), 'false');
      assert.equal(await page.locator('.input-rule-menu').count(), 0);
      if (id !== 'unlinked') {
        await row.locator('.input-label-text').click();
        // Captions focus the visible slider, including upgraded ranges.
        assert.equal(await slider.evaluate(el => el === document.activeElement), true);
      }
      const touch = await page.context().newCDPSession(page);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: track.x + track.width * .4, y }] });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: track.x + track.width * .7, y }] });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: track.x + track.width * .3, y }] });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await touch.detach();
      assert.equal(await slider.getAttribute('aria-valuenow'), '30');
      assert.equal(await row.locator('.help-tip-btn').getAttribute('aria-expanded'), 'false');
      assert.equal(await row.locator('.input-rule-actions').getAttribute('aria-expanded'), 'false');
      await slider.focus();
      await slider.press('ArrowRight');
      assert.equal(await slider.getAttribute('aria-valuenow'), '31');
      await row.locator('.help-tip-btn').click();
      assert.equal(await row.locator('.help-tip-btn').getAttribute('aria-expanded'), 'true');
      await page.keyboard.press('Escape');
      await row.locator('.input-rule-actions').click();
      await page.locator('.input-rule-menu [data-token-choose]').waitFor();
      await page.locator('.input-rule-menu [data-token-choose]').click();
      await page.locator('.input-rule-menu [data-token-options]:not([hidden])').waitFor();
      await page.keyboard.press('Escape');
      await page.locator('.input-rule-menu').waitFor({ state: 'detached' });
      await row.locator('.input-rule-actions').focus();
      await page.keyboard.press('Enter');
      await page.locator('.input-rule-menu').waitFor();
      await page.keyboard.press('Escape');
      await page.locator('.input-rule-menu').waitFor({ state: 'detached' });
    }
    await page.locator('[data-row="native"] .input-label-text').click();
    assert.equal(await page.locator('[data-row="native"] input').evaluate(el => el === document.activeElement), true);
  } finally { await closeBrowser(); }
});
