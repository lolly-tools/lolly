// SPDX-License-Identifier: MPL-2.0
/** Course review regressions across a long outline, sources, picker and guided repairs. */
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const arg = (name: string) =>
  process.argv.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const engine = arg('browser') === 'webkit' ? 'webkit' : 'chromium';
const url = arg('url') || 'http://127.0.0.1:5173';
const output = arg('output');
if (output) await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'learning-review-'));
const browser = await { chromium, webkit }[engine].launchPersistentContext(profile, {
  headless: true,
  args: engine === 'chromium' ? webGpuLaunchArgs('software') : [],
  viewport: { width: 1280, height: 950 },
});
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}/?theme=light#/learning`);
  await page.getByLabel('Course title', { exact: true }).waitFor();
  await page.evaluate(async () => {
    const bridgePath = '/src/bridge/index.ts',
      foldersPath = '/src/folders.ts';
    const host = await (await import(/* @vite-ignore */ bridgePath)).createBridge();
    const store = (await import(/* @vite-ignore */ foldersPath)).createFolderStore(host);
    const folder = await store.create('Partner enablement');
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="240"><rect width="480" height="240" fill="#142f2a"/><text x="32" y="76" fill="white" font-size="24">A guided product tour</text><rect x="32" y="108" width="180" height="80" rx="8" fill="#90ebcd"/><path d="M244 148h160m-20-20 20 20-20 20" fill="none" stroke="white" stroke-width="4"/></svg>';
    const asset = {
      source: 'user',
      id: 'user/course-review-image',
      type: 'vector',
      format: 'svg',
      url: '',
      meta: { name: 'Product tour.svg' },
    };
    await host.assets._uploadUserAsset({
      ...asset,
      blob: new Blob([svg], { type: 'image/svg+xml' }),
    });
    await store.addItem(folder.id, { type: 'image', ref: asset.id });
    await host.state.save(
      'course-review-qr',
      {
        __toolId: 'qr-code',
        __toolVersion: '1.0.0',
        __label: 'Course feedback link',
        url: 'https://lolly.tools',
      },
      svg
    );
    await store.addItem(folder.id, { type: 'session', ref: 'course-review-qr' });
    const slot = new URLSearchParams(location.hash.split('?')[1]).get('slot');
    const data = await host.state.load(slot);
    const module = data.__learningModule;
    module.projectId = folder.id;
    module.title = 'Partner enablement essentials';
    module.lessons = Array.from({ length: 12 }, (_, i) => ({
      id: `lesson-${i + 1}`,
      title: i === 0 ? 'Welcome and outcomes' : `Practice ${i + 1}`,
      required: true,
      blocks: [
        {
          id: `text-${i + 1}`,
          kind: 'text',
          text:
            i === 11
              ? ''
              : 'Explain the product, show the workflow, then practise with a customer scenario.',
        },
      ],
    }));
    module.lessons[0].blocks.push({
      id: 'tour',
      kind: 'image',
      description:
        'The product tour starts with a demonstration and ends with a practice activity.',
      source: { kind: 'asset', asset },
    });
    module.lessons[0].blocks.push({
      id: 'feedback',
      kind: 'image',
      description: 'Follow the feedback link after completing the course.',
      source: {
        kind: 'session',
        slot: 'course-review-qr',
        toolId: 'qr-code',
        values: { url: 'https://lolly.tools' },
        capturedAt: new Date().toISOString(),
      },
    });
    await host.state.save(slot, data);
  });
  await page.reload();
  await page.getByLabel('Course title', { exact: true }).waitFor();
  assert.equal(await page.locator('.learning-lesson-tab').count(), 12);
  const image = page.locator('[data-block=tour]');
  await image.locator('img').waitFor();
  await page.waitForFunction(
    () => document.querySelector<HTMLImageElement>('[data-block=tour] img')?.naturalWidth === 480
  );
  assert.equal(await page.locator('[data-block-selection]').isVisible(), false);
  assert.match(
    await page.locator('[data-block=feedback] figcaption').innerText(),
    /Course feedback link/
  );
  assert.equal(
    await page.locator('[data-block=feedback] img').count(),
    1,
    'saved thumbnail is reused without rendering the tool'
  );
  await page.evaluate(() => (document.documentElement.dataset.a11yPreviews = 'hidden'));
  assert.equal(await image.locator('img').isVisible(), false);
  await page.evaluate(() => delete document.documentElement.dataset.a11yPreviews);
  assert.equal(
    await page.locator('[data-block=feedback] .learning-content-options').getAttribute('open'),
    null,
    'source settings stay folded beside the visible preview'
  );
  await image.locator('[data-block-menu]').click();
  await page.keyboard.press('End');
  assert.equal(
    await page
      .getByRole('menuitem', { name: 'Remove content' })
      .evaluate((el) => el === document.activeElement),
    true
  );
  await page.keyboard.press('Escape');
  assert.equal(await image.locator('[data-block-menu]').getAttribute('aria-expanded'), 'false');
  await page.getByRole('button', { name: 'Export course', exact: true }).click();
  await page.getByRole('button', { name: 'Review course', exact: true }).click();
  const fix = page.getByRole('button', {
    name: 'Fix Lesson 12: Practice 12 / Content 1: Text',
    exact: true,
  });
  await fix.click();
  const lessonText = page.getByLabel('Lesson text', { exact: true });
  assert.equal(
    await lessonText.evaluate((el) => el === document.activeElement),
    true,
    'repair opens and focuses the affected field'
  );
  await lessonText.fill('Practise the demonstration and describe the next step.');
  await page.getByRole('button', { name: 'Export course', exact: true }).click();
  assert.equal(await page.locator('[data-delivery-step="1"]').getAttribute('aria-current'), 'step');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '1. Welcome and outcomes', exact: true }).click();
  for (const width of [1280, 640, 390]) {
    await page.setViewportSize({ width, height: 950 });
    await page.evaluate(() => window.scrollTo(0, 0));
    if (output)
      await page.screenshot({ path: join(output, `${engine}-mixed-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Add content', exact: true }).click();
    const picker = page.getByRole('dialog', {
      name: 'Add content to Welcome and outcomes',
      exact: true,
    });
    await picker
      .locator('[data-pane=projects] [data-asset-id="user/course-review-image"]')
      .first()
      .waitFor();
    assert.equal(
      await picker
        .getByRole('tab', { name: 'Projects', exact: true })
        .getAttribute('aria-selected'),
      'true'
    );
    await picker.getByRole('button', { name: /Course feedback link/ }).waitFor();
    assert.equal(await picker.locator('[data-collection-count]').innerText(), '0 items added');
    await picker
      .locator('[data-pane=projects] [data-asset-id="user/course-review-image"]')
      .first()
      .click();
    await picker.getByText('1 item added', { exact: true }).waitFor();
    assert.equal(await picker.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), true);
    const search = picker.getByRole('searchbox');
    assert.ok(
      (await search.boundingBox())!.width > 150,
      'search stays usable beside a long lesson title'
    );
    await picker.getByRole('button', { name: 'Create or edit', exact: true }).click();
    await page.keyboard.press('Escape');
    assert.equal(await picker.isVisible(), true, 'Escape closes the nested menu before the picker');
    if (output) await page.screenshot({ path: join(output, `${engine}-picker-${width}.png`) });
    await picker.getByRole('button', { name: 'Done', exact: true }).click();
  }
  const courseHash = new URL(page.url()).hash;
  await page.evaluate(() => (location.hash = '#/p'));
  await page.locator('.learning-author').waitFor({ state: 'detached' });
  await page.evaluate((hash) => (location.hash = hash), courseHash);
  await page.locator('.learning-author').waitFor();
  const help = page.getByRole('button', { name: 'More info', exact: true });
  await help.click();
  await page.keyboard.press('Escape');
  assert.equal(await help.getAttribute('aria-expanded'), 'false');
  await help.click();
  await page.getByRole('heading', { name: 'Course editor', exact: true }).click();
  assert.equal(
    await help.getAttribute('aria-expanded'),
    'false',
    'outside dismissal is restored after reopening the course'
  );
  assert.deepEqual(errors, []);
  console.log(
    `${engine}: 12-lesson outline, source thumbnails, keyboard actions, guided repairs, project picker and multi-add passed at desktop, 640px and phone widths.`
  );
} finally {
  await browser.close();
  await rm(profile, { recursive: true, force: true });
}
