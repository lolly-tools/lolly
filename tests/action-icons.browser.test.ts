// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { chromium } from 'playwright';

test('Comments dock controls and dialog actions keep token-sized icons at enlarged text sizes', {
  skip: existsSync(chromium.executablePath()) ? false : 'Install Playwright Chromium.', timeout: 60_000,
}, async t => {
  const bundle = await build({
    stdin: { resolveDir: new URL('..', import.meta.url).pathname, loader: 'ts', contents: `
      import { wireCommentPanel } from './shells/web/src/views/tool-comment-panel.ts';
      import { commentIcon } from './shells/web/src/views/tool-comment-chat.ts';
      import { actionButton } from './shells/web/src/components/action-button.ts';
      const panel = document.querySelector('.collab-comments-panel'), head = panel.querySelector('header');
      const close = document.createElement('button'); close.className = 'btn'; close.textContent = 'Close comments';
      commentIcon(close, 'Close comments'); head.append(close); wireCommentPanel(panel, head, close).setOpen(true);
      const tools = document.querySelector('.collab-comment-actions');
      for (const name of ['Pin a comment', 'Comment on selection', 'Comment at canvas center', 'Resolve thread']) {
        const button = document.createElement('button'); button.className = 'btn'; button.textContent = name;
        commentIcon(button, name); tools.append(button);
      }
      document.querySelector('.modal-actions').append(actionButton('Cancel', 'close'), actionButton('Move', 'move', true));
    ` }, bundle: true, write: false, platform: 'browser', format: 'iife', loader: { '.css': 'empty' }, logLevel: 'silent',
  });
  const css = ['styles/tokens.css', 'styles/parts/base.css', 'styles/parts/buttons.css', 'styles/parts/collab.css']
    .map(file => readFileSync(new URL(`../shells/web/src/${file}`, import.meta.url), 'utf8')).join('\n');
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  await page.setContent(`<style>${css}</style><aside class="collab-comments-panel"><header class="collab-comment-head"><h2>Comments</h2></header><div class="collab-comment-actions"></div></aside><div class="modal-actions"></div>`);
  await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
  for (const scale of [1, 1.5, 2]) {
    await page.evaluate(scale => document.documentElement.style.setProperty('--a11y-fs', String(scale)), scale);
    const controls = await page.locator('button:visible').evaluateAll(buttons => buttons.map(button => {
      const icon = button.querySelector('svg')!.getBoundingClientRect(), box = button.getBoundingClientRect();
      const label = button.querySelector('.btn-label')?.getBoundingClientRect();
      return { name: button.getAttribute('aria-label'), icon: { width: icon.width, height: icon.height, x: icon.x, y: icon.y },
        box: { width: box.width, height: box.height, x: box.x, y: box.y }, label: label && { x: label.x, right: label.right } };
    }));
    assert.ok(controls.length >= 8);
    for (const control of controls) {
      assert.equal(control.icon.width, 16 * scale, control.name ?? 'action');
      assert.equal(control.icon.height, 16 * scale, control.name ?? 'action');
      assert.ok(control.icon.x >= control.box.x && control.icon.y >= control.box.y);
      assert.ok(control.icon.x + control.icon.width <= control.box.x + control.box.width, JSON.stringify(control));
      if (control.label) assert.ok(control.label.x >= control.box.x && control.label.right <= control.box.x + control.box.width);
    }
  }
});
