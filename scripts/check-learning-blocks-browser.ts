// SPDX-License-Identifier: MPL-2.0
/** Pointer, touch, selection and keyboard block editing; incomplete learner previews. */
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const arg = (key: string) =>
  process.argv.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const url = arg('url') || 'http://localhost:5173';
const engine = arg('browser') === 'webkit' ? 'webkit' : 'chromium';
// A regular profile supports WebKit's IndexedDB Blob storage; its private
// automation context does not. The isolated profile is deleted after this check.
const profile = await mkdtemp(join(tmpdir(), 'learning-blocks-'));
const browser = await { chromium, webkit }[engine].launchPersistentContext(profile, {
  headless: true,
  args: engine === 'chromium' ? webGpuLaunchArgs('software') : [],
  viewport: { width: 1280, height: 1200 },
  hasTouch: true,
});
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}/?theme=light#/learning`);
  await page.getByRole('button', { name: 'Add lesson', exact: true }).click();
  // Draft preview is useful before a course is ready for export.
  await page.getByRole('button', { name: 'Preview as learner', exact: true }).click();
  const player = page.frameLocator('iframe[title="Learner preview"]');
  await player.getByText('This lesson is still empty.', { exact: false }).waitFor();
  assert.equal(
    await player.locator('body').evaluate((el) => getComputedStyle(el).fontFamily.includes('SUSE')),
    true
  );
  assert.equal(
    await player.locator('body').evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check('16px SUSE');
    }),
    true
  );
  await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  for (const text of ['First', 'Second', 'Third', 'Fourth']) {
    await page.getByRole('button', { name: 'Add text', exact: true }).click();
    await page.locator('[data-block]').last().getByLabel('Lesson text', { exact: true }).fill(text);
  }
  const cards = page.locator('[data-block]');
  const ids = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-block')));
  const order = () => cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-block')));
  const grip = (id: string | null) => page.locator(`[data-block="${id}"] [data-block-drag]`);
  const beforeLast = async () => {
    await cards.last().scrollIntoViewIfNeeded();
    const box = (await cards.last().boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height - 8 };
  };
  assert.equal(
    await page.locator('[data-block-selection]').isVisible(),
    false,
    'editing does not select content'
  );
  const textField = cards.nth(1).getByLabel('Lesson text', { exact: true });
  await textField.click();
  assert.equal(
    await textField.evaluate((el) => el === document.activeElement),
    true,
    'the first click places the caret'
  );
  assert.equal(await page.locator('[data-block-selection]').isVisible(), false);
  await cards.first().getByRole('checkbox').check();
  await cards.nth(1).getByRole('checkbox').check();
  assert.equal(await page.locator('[data-block][data-selected=true]').count(), 2);
  await grip(ids[0]!).scrollIntoViewIfNeeded();
  const start = (await grip(ids[0]!).boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  const end = await beforeLast();
  await page.mouse.move(end.x, end.y, { steps: 14 });
  await page.locator('.learning-drop-marker').waitFor();
  await page.mouse.up();
  await page.waitForFunction(
    (id) => document.querySelector('[data-block]')?.getAttribute('data-block') === id,
    ids[2]
  );
  assert.deepEqual(
    await order(),
    [ids[2], ids[3], ids[0], ids[1]],
    'drag moves selected blocks in their original order'
  );
  await page.getByRole('button', { name: 'Undo edit', exact: true }).click();
  await page.waitForFunction(
    (id) => document.querySelector('[data-block]')?.getAttribute('data-block') === id,
    ids[0]
  );
  assert.deepEqual(await order(), ids, 'a grouped move is one undo step');
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await grip(ids[3]!).focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('Home');
  await page.keyboard.press('Escape');
  assert.deepEqual(await order(), ids, 'Escape leaves the model unchanged');
  await page.keyboard.press('Space');
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    (id) => document.querySelector('[data-block]')?.getAttribute('data-block') === id,
    ids[3]
  );
  assert.deepEqual(await order(), [ids[3], ids[0], ids[1], ids[2]]);
  assert.equal(await grip(ids[3]!).evaluate((e) => e === document.activeElement), true);
  await page.getByRole('button', { name: 'Duplicate selected', exact: true }).click();
  assert.equal(await cards.count(), 5);
  assert.equal(await page.locator('[data-block][data-selected=true]').count(), 1);
  await page.getByRole('button', { name: 'Remove selected', exact: true }).click();
  assert.equal(await cards.count(), 4);
  await page.waitForFunction(
    () => document.querySelector('[data-status]')?.textContent === 'Saved on this device'
  );
  await page.reload();
  await cards.first().waitFor();
  assert.deepEqual(
    await order(),
    [ids[3], ids[0], ids[1], ids[2]],
    'reordering survives reopening'
  );
  // Chromium provides native touch dispatch; WebKit also verifies the compact keyboard layout.
  await page.setViewportSize({ width: 390, height: 844 });
  await grip(ids[3]!).scrollIntoViewIfNeeded();
  const touchStart = (await page.locator(`[data-block="${ids[3]}"] [data-block-surface]`).boundingBox())!;
  const secondBox = (await cards.nth(1).boundingBox())!;
  const x = touchStart.x + touchStart.width / 2,
    y = touchStart.y + touchStart.height / 2;
  if (engine === 'chromium') {
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await page.locator(`[data-block="${ids[3]}"][data-dragging=true]`).waitFor();
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: Math.min(810, secondBox.y + secondBox.height - 5) }],
    });
    await page.waitForFunction(() => {
      const card = document.querySelectorAll('[data-block]')[1]!;
      const b = card.getBoundingClientRect();
      return b.y + b.height / 2 < 780;
    });
    const target = (await cards.nth(1).boundingBox())!;
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: Math.min(810, target.y + target.height - 5) }],
    });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
  } else {
    await grip(ids[3]!).focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
  }
  await page.waitForFunction(
    (id) => document.querySelector('[data-block]')?.getAttribute('data-block') === id,
    ids[0]
  );
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    true
  );
  // An installed profile face is stored as an asset, rather than a CSS URL.
  await page.evaluate(async () => {
    const bridgePath = '/src/bridge/index.ts';
    const fontsPath = '/src/lib/register-user-fonts.ts';
    const host = await (await import(/* @vite-ignore */ bridgePath)).createBridge();
    const blob = new Blob([await (await fetch('/fonts/SUSE[wght].woff2')).arrayBuffer()], {
      type: 'font/woff2',
    });
    const id = 'user/fonts/learning-audit';
    await host.assets._uploadUserAsset({
      id,
      type: 'font',
      format: 'woff2',
      blob,
      meta: { family: 'Course Audit Font' },
    });
    const face = new FontFace('Course Audit Font', await blob.arrayBuffer(), { weight: '100 900' });
    await face.load();
    document.fonts.add(face);
    (await import(/* @vite-ignore */ fontsPath)).REGISTERED.set(id, face);
    document.documentElement.style.setProperty(
      '--ui-type-ui-family',
      '"Course Audit Font", sans-serif'
    );
  });
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.getByRole('button', { name: 'Preview as learner', exact: true }).click();
  await player.getByText('This text block is empty.', { exact: false }).waitFor();
  assert.equal(
    await player.locator('body').evaluate(async (body) => {
      await document.fonts.ready;
      return (
        getComputedStyle(body).fontFamily.includes('Course Audit Font') &&
        document.fonts.check('16px "Course Audit Font"')
      );
    }),
    true,
    'installed brand fonts also render inside the portable preview'
  );

  assert.equal(
    await player
      .locator('body')
      .evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    true
  );
  await player.getByRole('button', { name: 'Complete lesson', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.locator('.learning-preview').waitFor({ state: 'detached' });
  assert.deepEqual(errors, []);
  console.log(
    `${engine}: content selection, grouped drag, ${engine === 'chromium' ? 'native touch and autoscroll, ' : ''}keyboard drop/cancel, undo, persistence and incomplete preview passed.`
  );
} finally {
  await browser.close();
  await rm(profile, { recursive: true, force: true });
}
