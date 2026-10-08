// SPDX-License-Identifier: MPL-2.0
/** Exercise authoring and exported learning content against a running web shell. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';
import { strFromU8, unzipSync } from 'fflate';
import { stampLearningShot } from './lib/learning-shot-credential.ts';

const url = process.argv.find((a) => a.startsWith('--url='))?.slice(6) || 'http://127.0.0.1:5173';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ headless: true, args: webGpuLaunchArgs('software') });
const temp = await mkdtemp(join(tmpdir(), 'lolly-learning-'));
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 950 },
    acceptDownloads: true,
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}/#/learning`);
  await page.getByLabel('Course title', { exact: true }).fill('Linux onboarding');
  await page.getByRole('button', { name: 'Add lesson', exact: true }).click();
  await page.getByLabel('Lesson title', { exact: true }).fill('Prepare your environment');
  await page.getByText('Lesson options', { exact: false }).first().click();
  await page.getByLabel('Section (optional)').fill('Getting started');
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page
    .getByLabel('Lesson text', { exact: true })
    .fill('Open a terminal and run uname. Read the system name before continuing.');
  await page.getByRole('button', { name: 'Add content', exact: true }).click();
  await page
    .locator('.asset-picker-dialog input[type=file]')
    .first()
    .setInputFiles({
      name: 'terminal.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZ8AAAAASUVORK5CYII=',
        'base64'
      ),
    });
  await page.getByText('1 item added', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  assert.equal(await page.locator('.learning-source-preview img').count(), 1);
  if (
    !(await page
      .locator('.learning-content-options')
      .first()
      .evaluate((el) => (el as HTMLDetailsElement).open))
  )
    await page.locator('.learning-content-options > summary').first().click();
  await page
    .getByLabel('Description or equivalent explanation')
    .fill('A terminal window. Use the written instructions above to complete this step.');
  await page.locator('[data-resource]').setInputFiles({
    name: 'commands.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('uname\nwhoami\n'),
  });
  await page.getByRole('button', { name: 'Preview as learner' }).click();
  const player = page.frameLocator('iframe[title="Learner preview"]');
  await player.getByRole('button', { name: 'Complete lesson', exact: true }).waitFor();
  await player.getByRole('button', { name: 'Complete lesson', exact: true }).click();
  await player.getByRole('button', { name: 'Finish', exact: true }).click();
  assert.match(await player.getByRole('status').innerText(), /Module completed/);
  await page.getByRole('button', { name: 'Close preview' }).click();
  const save = async (action: () => Promise<unknown>, name: string) => {
    const downloading = page.waitForEvent('download');
    await action();
    const download = await downloading;
    const file = join(temp, name);
    await download.saveAs(file);
    return new Uint8Array(await readFile(file));
  };
  await page.getByRole('button', { name: 'Export course', exact: true }).click();
  await page.getByRole('button', { name: 'Review course', exact: true }).click();
  await page.getByRole('button', { name: 'Check and prepare package', exact: true }).click();
  await page.getByRole('button', { name: 'Save version and download ZIP', exact: true }).waitFor();
  const first = await save(
    () => page.getByRole('button', { name: 'Save version and download ZIP', exact: true }).click(),
    'first.zip'
  );
  assert.equal(
    await page.locator('.learning-export .background-delivery').count(),
    0,
    'delivery recovery is local to this export'
  );
  await page.locator('.learning-download-help > summary').click();
  const recoveryCopy = await save(
    () =>
      page
        .locator('.learning-download-help .download-recovery')
        .getByRole('button', { name: /^Download .* again$/ })
        .click(),
    'recovery.zip'
  );
  assert.deepEqual(recoveryCopy, first, 'Download help retries the exact stored bytes');
  await page.locator('.learning-download-help > summary').click();
  const contents = unzipSync(first);
  assert.ok(contents['imsmanifest.xml']);
  const content = JSON.parse(strFromU8(contents['content.json']!));
  assert.equal(
    content.lessons.flatMap((l: { blocks: Array<{ files?: unknown[] }> }) =>
      l.blocks.flatMap((b) => b.files || [])
    ).length,
    2
  );
  assert.ok(content.presentation.fonts.length >= 2, 'brand fonts travel with the course');
  for (const font of content.presentation.fonts)
    assert.equal(contents[font.file.path]!.length, font.file.size);
  assert.ok(content.presentation.licenses.length, 'shipped font licence travels with its bytes');
  assert.match(strFromU8(contents['player.css']!), /@font-face/);
  assert.ok(!strFromU8(contents['content.json']!).includes('blob:'));
  await page.reload();
  await page.evaluate(() =>
    document.documentElement.style.setProperty('--ui-color-action-primary', '#6336b5')
  );
  await page.locator('[data-disclosure=versions] > summary').click();
  const repeated = await save(
    () => page.getByRole('button', { name: 'Download SCORM 1.2 ZIP', exact: true }).click(),
    'repeat.zip'
  );
  assert.deepEqual(repeated, first);
  await page
    .getByLabel('Lesson text', { exact: true })
    .fill('The next draft has different teaching content.');
  await page.getByRole('button', { name: 'Export this version for another destination' }).click();
  await page.locator('[data-delivery-target]').selectOption('scorm2004');
  await page.getByRole('button', { name: 'Review course', exact: true }).click();
  await page.getByRole('button', { name: 'Check and prepare package', exact: true }).click();
  const variant = await save(
    () => page.getByRole('button', { name: 'Save version and download ZIP', exact: true }).click(),
    'variant.zip'
  );
  const variantFiles = unzipSync(variant);
  assert.deepEqual(variantFiles['content.json'], contents['content.json']);
  assert.deepEqual(
    variantFiles['player.css'],
    contents['player.css'],
    'a saved version retains its presentation after the active profile changes'
  );
  assert.match(strFromU8(variantFiles['imsmanifest.xml']!), /2004 4th Edition/);
  await page.locator('[data-delivery-close]').click();
  await page.getByRole('link', { name: 'Projects', exact: true }).click();
  await page.getByText('Linux onboarding', { exact: true }).first().click();
  await page.getByLabel('Course title').waitFor();
  assert.equal(await page.getByLabel('Course title').inputValue(), 'Linux onboarding');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    'authoring must fit a phone viewport'
  );
  if (shots) {
    await page.setViewportSize({ width: 1280, height: 950 });
    await page
      .getByLabel('Lesson text')
      .fill('Open a terminal and run uname. Read the system name before continuing.');
    await page.getByRole('heading', { name: 'Course editor', exact: true }).click();
    const svg = await page.evaluate(async () => {
      document
        .querySelectorAll<HTMLDetailsElement>('.learning-author details')
        .forEach((details) => {
          details.open = details === document.querySelector('.learning-content-list details');
        });
      window.scrollTo(0, 0);
      const path = '/src/bridge/export-svg-walker.ts';
      const { renderSvgFromHtml } = await import(/* @vite-ignore */ path);
      return (
        await renderSvgFromHtml(document.querySelector('.learning-author'), {
          convertPaths: true,
          rasterFallback: false,
        })
      ).text();
    });
    // Every committed shot carries Content Credentials, and tests/docs-shot-credentials.ts
    // holds the whole corpus to it. This baseline is written here rather than by the
    // shots pipeline, so it is stamped here too.
    await writeFile(
      'docs/shots/training-module-outline.svg',
      await stampLearningShot(new TextEncoder().encode(svg), url)
    );
  }
  // Run the downloaded player against a browser LMS double, with all network access blocked.
  const learner = await browser.newPage();
  await learner.route('**/*', (route) => route.abort());
  await learner.setContent('<div id="learning-player"></div>');
  await learner.evaluate(() => {
    const values: Record<string, string> = { 'cmi.core.lesson_mode': 'normal' };
    Object.assign(window, {
      testLmsValues: values,
      API: {
        LMSInitialize: () => 'true',
        LMSGetValue: (k: string) => values[k] || '',
        LMSSetValue: (k: string, v: string) => {
          values[k] = v;
          return 'true';
        },
        LMSGetLastError: () => '0',
        LMSCommit: () => 'true',
        LMSFinish: () => 'true',
      },
    });
  });
  await learner.addScriptTag({ content: strFromU8(contents['player.js']!) });
  await learner.getByRole('button', { name: 'Complete lesson', exact: true }).click();
  await learner.getByRole('button', { name: 'Finish', exact: true }).click();
  assert.match(await learner.getByRole('status').innerText(), /Module completed/);
  assert.equal(content.lessons.length, 1);
  assert.deepEqual(errors, []);
  console.log(
    'Learning browser checks passed: picker, resources, preview, completion, immutable downloads, target variants, reopening, phone layout and standalone player.'
  );
} finally {
  await browser.close();
  await rm(temp, { recursive: true, force: true });
}
