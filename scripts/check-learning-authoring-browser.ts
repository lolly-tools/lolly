// SPDX-License-Identifier: MPL-2.0
/** Exercise the lesson canvas and quiz resume in a real exported static package. */
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import { stampLearningShot } from './lib/learning-shot-credential.ts';
const arg = (name: string) =>
  process.argv.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const url = arg('url') || 'http://127.0.0.1:5173';
const engine = arg('browser') === 'webkit' ? webkit : chromium;
const output = arg('output') || 'plans/artifacts/learning-authoring';
await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'lolly-authoring-'));
const browser = await engine.launchPersistentContext(profile, {
  headless: true,
  args: engine === chromium ? webGpuLaunchArgs('software') : [],
  viewport: { width: 1440, height: 1080 },
  acceptDownloads: true,
  hasTouch: true,
});
let server: ReturnType<typeof createServer> | undefined;
let shotSvg: string | undefined;
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}/?theme=light#/learning`);
  console.log('Opened course editor');
  await page.getByLabel('Course title', { exact: true }).fill('Partner enablement essentials');
  await page.getByRole('button', { name: 'Add lesson', exact: true }).click();
  await page.getByLabel('Lesson title', { exact: true }).fill('Prepare a customer demonstration');
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  console.log('Added first text');
  let text = page.getByRole('textbox', { name: 'Lesson text', exact: true });
  await text.fill('Start with the customer outcome');
  await text.press('ControlOrMeta+a');
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  assert.equal(await text.locator('strong').innerText(), 'Start with the customer outcome');
  await page.getByRole('button', { name: 'Link', exact: true }).click();
  const linkDialog = page.getByRole('dialog', { name: 'Text link', exact: true });
  await linkDialog.getByLabel('Link address', { exact: true }).fill('javascript:alert(1)');
  await linkDialog.getByRole('button', { name: 'Save link', exact: true }).click();
  await linkDialog
    .getByText('Enter a full https://, http:// or mailto: address.', { exact: true })
    .waitFor();
  await linkDialog
    .getByLabel('Link address', { exact: true })
    .fill('https://lolly.tools/info/create/training-creators.html');
  await page.screenshot({ path: join(output, 'link-modal.png') });
  await linkDialog.getByRole('button', { name: 'Save link', exact: true }).click();
  assert.equal(
    await text.locator('a').getAttribute('href'),
    'https://lolly.tools/info/create/training-creators.html'
  );
  await page.getByLabel('Text style', { exact: true }).selectOption('2');
  assert.equal(await text.locator('h2').count(), 1);
  await text.press('ArrowRight');
  await page.waitForFunction(
    () =>
      document.querySelector<HTMLSelectElement>('[aria-label="Text style"]')?.value === 'paragraph'
  );
  await text.pressSequentially(
    'Explain the workflow, show the product, then let learners practise.'
  );
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Lesson text', exact: true })
    .last()
    .fill('Use a scenario the customer recognizes.');
  await page.getByRole('button', { name: 'Add quiz', exact: true }).click();
  console.log('Added quiz');
  let quiz = page.locator('[data-block]').last();
  await page.getByRole('button', { name: 'Export course', exact: true }).click();
  await page.getByRole('button', { name: 'Review course', exact: true }).click();
  await page
    .getByRole('button', { name: /Fix Lesson 1:.*Quiz/ })
    .first()
    .click();
  assert.equal(
    await quiz
      .getByLabel('Question', { exact: true })
      .evaluate((el) => el === document.activeElement),
    true
  );
  await quiz
    .getByLabel('Question', { exact: true })
    .fill('What should you prepare before a demonstration?');
  await quiz.getByLabel('Answer 1', { exact: true }).fill('A customer scenario');
  await quiz.getByLabel('Answer 2', { exact: true }).fill('Every feature in the product');
  await quiz.getByLabel('Question type', { exact: true }).selectOption('multiple');
  await quiz.getByLabel('Answer 2 is correct', { exact: true }).check();
  assert.equal(await quiz.locator('[data-quiz-correct]:checked').count(), 2);
  await quiz.getByLabel('Question type', { exact: true }).selectOption('true-false');
  assert.equal(await quiz.getByLabel('Answer 1', { exact: true }).inputValue(), 'True');
  await quiz.getByLabel('Answer 2 is correct', { exact: true }).check();
  await quiz.getByLabel('Question type', { exact: true }).selectOption('single');
  await quiz.getByLabel('Answer 1', { exact: true }).fill('A customer scenario');
  await quiz.getByLabel('Answer 2', { exact: true }).fill('Every feature in the product');
  await quiz.getByLabel('Answer 1 is correct', { exact: true }).check();
  await quiz.getByText('Answer explanation (optional)', { exact: true }).click();
  await quiz
    .getByLabel('Feedback after checking', { exact: true })
    .fill('A relevant scenario keeps the demonstration focused on the customer outcome.');
  await page.getByRole('heading', { name: 'Course editor', exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('[data-status]')?.textContent === 'Saved on this device'
  );
  console.log('Saved formatted content and question');
  const ids = await page
    .locator('[data-block]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-block')!));
  await page
    .locator(`[data-block="${ids[0]}"]`)
    .getByRole('button', { name: 'Insert content below', exact: true })
    .click();
  await page.getByRole('menuitem', { name: 'Text', exact: true }).click();
  await page
    .locator('[data-block]')
    .nth(1)
    .getByRole('textbox', { name: 'Lesson text', exact: true })
    .fill('An inserted explanation.');
  assert.equal(await page.locator('[data-block]').nth(2).getAttribute('data-block'), ids[1]);
  await page.locator('[data-block]').nth(1).locator('[data-block-menu]').click();
  await page.getByRole('menuitem', { name: 'Remove content', exact: true }).click();
  await page.locator(`[data-block="${ids[0]}"] [data-block-surface]`).click();
  await page
    .locator(`[data-block="${ids[1]}"] [data-block-surface]`)
    .click({ modifiers: ['Shift'] });
  assert.equal(await page.locator('[data-selected=true]').count(), 2);
  const grip = page.locator(`[data-block="${ids[0]}"] [data-block-drag]`);
  await grip.press('Space');
  await grip.press('End');
  await grip.press('Space');
  assert.deepEqual(
    await page
      .locator('[data-block]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-block'))),
    [ids[2], ids[0], ids[1]]
  );
  await page.getByRole('button', { name: 'Undo edit', exact: true }).click();
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await page.getByRole('button', { name: 'Add lesson', exact: true }).click();
  await page.getByLabel('Lesson title', { exact: true }).fill('Practise the conversation');
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Lesson text', exact: true })
    .fill('Rehearse the opening with a colleague.');
  console.log('Created second lesson');
  const lessons = await page
    .locator('[data-lesson-row]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-lesson-row')!));
  await page.locator(`[data-action=lesson][data-id="${lessons[0]}"]`).click();
  await page.locator(`[data-block="${ids[1]}"] [data-block-surface]`).click();
  await page.getByRole('button', { name: 'Move to lesson', exact: true }).click();
  await page.screenshot({ path: join(output, 'move-modal.png') });
  await page
    .getByRole('dialog', { name: 'Move content to lesson' })
    .getByRole('button', { name: 'Move content', exact: true })
    .click();
  assert.equal(
    await page.getByLabel('Lesson title', { exact: true }).inputValue(),
    'Practise the conversation'
  );
  assert.equal(await page.locator(`[data-block="${ids[1]}"]`).count(), 1);
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  const held = page.locator(`[data-block="${ids[1]}"] [data-block-surface]`);
  await held.scrollIntoViewIfNeeded();
  const heldBox = (await held.boundingBox())!;
  await page.mouse.move(heldBox.x + heldBox.width / 2, heldBox.y + heldBox.height / 2);
  await page.mouse.down();
  await page.locator(`[data-block="${ids[1]}"][data-dragging=true]`).waitFor();
  const destination = (await page.locator(`[data-lesson-row="${lessons[0]}"]`).boundingBox())!;
  await page.mouse.move(
    destination.x + destination.width / 2,
    destination.y + destination.height / 2,
    { steps: 12 }
  );
  await page.locator(`[data-lesson-row="${lessons[0]}"][data-content-drop=true]`).waitFor();
  await page.mouse.up();
  await page.waitForFunction(
    (id) =>
      document.querySelector('[data-action=lesson][aria-current=true]')?.getAttribute('data-id') ===
      id,
    lessons[0]
  );
  assert.equal(await page.locator(`[data-block="${ids[1]}"]`).count(), 1);
  await page.getByRole('button', { name: 'Undo edit', exact: true }).click();
  await page.waitForFunction((id) => !document.querySelector(`[data-block="${id}"]`), ids[1]);
  if (await page.getByRole('button', { name: 'Clear selection', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  const lessonGrip = page.locator(`[data-lesson-drag="${lessons[1]}"]`);
  await lessonGrip.press('Space');
  await lessonGrip.press('Home');
  await lessonGrip.press('Space');
  assert.equal(
    await page.locator('[data-lesson-row]').first().getAttribute('data-lesson-row'),
    lessons[1]
  );
  await page.getByRole('button', { name: 'Undo edit', exact: true }).click();
  await page.locator(`[data-action=lesson][data-id="${lessons[0]}"]`).click();
  console.log('Organized content and lessons');
  await page.reload();
  text = page.getByRole('textbox', { name: 'Lesson text', exact: true }).first();
  assert.equal(await text.locator('h2').innerText(), 'Start with the customer outcome');
  assert.equal(await text.locator('strong').first().innerText(), 'Start with the customer outcome');
  quiz = page.locator(`[data-block="${ids[2]}"]`);
  assert.equal(
    await quiz.getByLabel('Question', { exact: true }).inputValue(),
    'What should you prepare before a demonstration?'
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(output, 'canvas-desktop.png'), fullPage: true });
  if (process.argv.includes('--shots')) {
    shotSvg = await page.evaluate(async () => {
      const path = '/src/bridge/export-svg-walker.ts';
      const { renderSvgFromHtml } = await import(/* @vite-ignore */ path);
      return (
        await renderSvgFromHtml(document.querySelector('.learning-author'), {
          convertPaths: true,
          rasterFallback: false,
        })
      ).text();
    });
  }
  console.log('Reloaded and captured desktop');
  for (const width of [640, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      `viewport ${width} does not overflow`
    );
    await page.screenshot({ path: join(output, `canvas-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.getByRole('button', { name: 'Preview as learner', exact: true }).click();
  const preview = page.frameLocator('iframe[title="Learner preview"]');
  await preview.getByLabel('A customer scenario', { exact: true }).check();
  await preview.getByRole('button', { name: 'Check answer', exact: true }).click();
  await preview.getByText(/^Correct\./).waitFor();
  assert.match(
    await preview.locator('.learning-quiz').evaluate((el) => getComputedStyle(el).fontFamily),
    /SUSE/
  );
  await page.screenshot({ path: join(output, 'learner-preview.png') });
  await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  assert.equal(
    await page.getByRole('button', { name: 'Undo edit', exact: true }).isEnabled(),
    false,
    'preview and quiz attempts do not create author edits'
  );
  console.log('Preview quiz answered');
  await page.getByRole('button', { name: 'Export course', exact: true }).click();
  await page.locator('[data-delivery-target]').selectOption('static');
  await page.getByRole('button', { name: 'Review course', exact: true }).click();
  await page.getByRole('button', { name: 'Check and prepare package', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save version and download ZIP', exact: true }).click();
  const download = await downloading;
  const path = join(profile, 'course.zip');
  await download.saveAs(path);
  const files = unzipSync(new Uint8Array(await readFile(path)));
  server = createServer((req, res) => {
    const file = (req.url || '/').slice(1) || 'index.html';
    const bytes = files[file];
    res.writeHead(bytes ? 200 : 404, {
      'Content-Type': file.endsWith('.css')
        ? 'text/css'
        : file.endsWith('.js')
          ? 'text/javascript'
          : file.endsWith('.woff2')
            ? 'font/woff2'
            : 'text/html',
    });
    res.end(bytes || 'Missing');
  });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const learner = await browser.newPage();
  learner.on('pageerror', (e) => errors.push(e.message));
  await learner.goto(`http://127.0.0.1:${address.port}/`);
  await learner.getByLabel('A customer scenario', { exact: true }).check();
  await learner.getByRole('button', { name: 'Check answer', exact: true }).click();
  await learner.getByText('Progress saved in this browser.', { exact: false }).waitFor();
  await learner.reload();
  await learner.getByText(/^Correct\./).waitFor();
  assert.equal(await learner.getByLabel('A customer scenario', { exact: true }).isChecked(), true);
  assert.equal(await learner.locator('progress').getAttribute('value'), '0');
  assert.deepEqual(errors, []);
  if (shotSvg)
    await writeFile(
      'docs/shots/training-course-quiz.svg',
      await stampLearningShot(new TextEncoder().encode(shotSvg), url)
    );
  console.log(
    'Learning authoring passed: formatting, questions, selection, grouped reorder, moving lessons and content, responsive canvas, branded preview, static ZIP and answer resume.'
  );
} finally {
  server?.close();
  await browser.close();
  await rm(profile, { recursive: true, force: true });
}
