// SPDX-License-Identifier: MPL-2.0
/** Check course editing, modal navigation and keyboard continuity in the web shell. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';

const url =
  process.argv.find((arg) => arg.startsWith('--url='))?.slice(6) || 'http://127.0.0.1:5179';
const browser = await chromium.launch({ headless: true, args: webGpuLaunchArgs('software') });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
  await page.goto(`${url}/#/learning`);
  await page.getByLabel('Course title', { exact: true }).fill('Course interaction checks');
  await page.getByRole('button', { name: 'Add lesson', exact: true }).click();
  assert.equal(
    await page
      .getByLabel('Lesson title', { exact: true })
      .evaluate((el) => el === document.activeElement),
    true
  );
  await page.getByLabel('Lesson title', { exact: true }).fill('A first lesson');
  await page.locator('.learning-lesson-options > summary').click();
  await page.getByLabel('Section (optional)', { exact: true }).fill('Getting started');
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.getByLabel('Lesson text', { exact: true }).fill('First explanation');
  await page.waitForFunction(
    () => document.querySelector('[data-status]')?.textContent === 'Saved on this device'
  );
  assert.equal(
    await page
      .getByLabel('Lesson text', { exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
    'autosave keeps the creator in the text field'
  );
  assert.equal(
    await page.evaluate(async () => {
      const path = '/src/bridge/index.ts';
      const host = await (await import(/* @vite-ignore */ path)).createBridge();
      const slot = new URLSearchParams(location.hash.split('?')[1]).get('slot');
      return (await host.state.load(slot)).__learningModule.lessons[0].blocks[0].text;
    }),
    'First explanation',
    'typing is saved without requiring a blur'
  );
  await page.getByRole('heading', { name: 'Course editor', exact: true }).click();
  assert.match(
    await page.getByLabel('Lesson text', { exact: true }).innerText(),
    /First explanation/,
    'the lesson canvas follows edits without rebuilding the editor'
  );
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  const blocks = page.locator('[data-block]');
  assert.equal(await blocks.count(), 2, 'blurring an edit must not swallow Add text');
  await blocks.last().getByLabel('Lesson text', { exact: true }).fill('Second explanation');
  const secondId = await blocks.last().getAttribute('data-block');
  await blocks.last().locator('[data-block-menu]').click();
  await page.getByRole('menuitem', { name: 'Move content up', exact: true }).click();
  assert.equal(await blocks.first().getAttribute('data-block'), secondId);
  assert.equal(
    await blocks.first().evaluate((el) => el.contains(document.activeElement)),
    true,
    'focus follows reordered content'
  );
  await blocks.first().locator('[data-block-menu]').click();
  assert.equal(
    await page.getByRole('menuitem', { name: 'Move content up', exact: true }).count(),
    0
  );
  await page.getByRole('menuitem', { name: 'Move content down', exact: true }).click();
  await page.getByLabel('Required for completion', { exact: true }).uncheck();
  assert.equal(
    await blocks.first().getByLabel('Lesson text', { exact: true }).isVisible(),
    true,
    'lesson settings preserve the visible text canvas'
  );
  await page.getByLabel('Required for completion', { exact: true }).check();
  await blocks.last().locator('[data-block-menu]').click();
  await page.getByRole('menuitem', { name: 'Remove content', exact: true }).click();
  assert.equal(await blocks.count(), 1);
  await page.getByRole('button', { name: 'Undo edit', exact: true }).click();
  await blocks.nth(1).waitFor();
  assert.equal(await blocks.count(), 2);
  assert.equal(
    await blocks.last().getByLabel('Lesson text', { exact: true }).innerText(),
    'Second explanation'
  );

  await page.locator('[data-disclosure=settings] > summary').click();
  await page.getByLabel('Learning objectives', { exact: true }).fill('Describe the workflow.');
  await page.getByRole('button', { name: 'Add lesson', exact: true }).click();
  assert.notEqual(await page.locator('[data-disclosure=settings]').getAttribute('open'), null);
  await page.getByRole('button', { name: 'Export course', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Export course', exact: true });
  assert.equal(
    await modal.locator('[data-delivery-status]').isVisible(),
    false,
    'a first export does not warn about invalidating a package that was never prepared'
  );
  const footprint = async () =>
    assert.equal(
      await modal.evaluate((el) => {
        const footer = el.querySelector('.learning-modal-footer')!.getBoundingClientRect();
        return (
          footer.bottom <= innerHeight && footer.top >= 0 && el.scrollWidth <= el.clientWidth + 1
        );
      }),
      true,
      'the dialog footer stays visible without horizontal overflow'
    );
  await modal.getByRole('button', { name: 'Review course', exact: true }).click();
  assert.equal(
    await modal.getByRole('button', { name: 'Check and prepare package', exact: true }).isEnabled(),
    false,
    'an empty lesson blocks preparation'
  );
  await modal
    .getByRole('button', { name: /^Fix Lesson/ })
    .first()
    .click();
  assert.equal(await modal.count(), 0);
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.getByLabel('Lesson text', { exact: true }).fill('A second lesson.');
  await page.getByRole('button', { name: 'Export course', exact: true }).click();
  assert.equal(
    await modal.locator('[data-delivery-step="1"]').getAttribute('aria-current'),
    'step',
    'return from a fix preserves Review'
  );
  await modal.locator('[data-delivery-step="0"]').click();
  await modal.getByLabel('Delivery format').selectOption('static');
  await modal.getByLabel('Website or LMS name (optional)').fill('Partner portal');
  await modal.getByLabel('Upload limit (MB, optional)').fill('20');
  await modal.getByRole('button', { name: 'Review course', exact: true }).click();
  await modal.getByRole('button', { name: 'Check and prepare package', exact: true }).click();
  await modal
    .getByRole('button', { name: 'Save version and download ZIP', exact: true })
    .waitFor({ state: 'visible' });
  await modal.getByLabel('Version notes').fill('Initial partner course.');
  await modal.locator('[data-delivery-step="0"]').click();
  assert.equal(
    await modal.getByLabel('Website or LMS name (optional)').inputValue(),
    'Partner portal'
  );
  await modal.getByLabel('Upload limit (MB, optional)').fill('25');
  await modal.getByRole('button', { name: 'Review course', exact: true }).click();
  assert.equal(
    await modal.locator('[data-delivery-step="2"]').isEnabled(),
    false,
    'destination edits invalidate prepared bytes'
  );
  await modal.getByRole('button', { name: 'Check and prepare package', exact: true }).click();
  await modal.getByLabel('Version notes').waitFor();
  assert.equal(await modal.getByLabel('Version notes').inputValue(), 'Initial partner course.');
  await footprint();
  await page.setViewportSize({ width: 390, height: 844 });
  await footprint();
  await page.keyboard.press('Escape');
  assert.equal(await modal.count(), 0);
  assert.equal(
    await page
      .getByRole('button', { name: 'Export course', exact: true })
      .evaluate((el) => el === document.activeElement),
    true
  );
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    true
  );

  await page.setViewportSize({ width: 1280, height: 950 });
  await page.evaluate(async () => {
    const bridgePath = '/src/bridge/index.ts',
      entryPath = '/src/lib/learning-entry.ts';
    const host = await (await import(/* @vite-ignore */ bridgePath)).createBridge();
    const refs: string[] = [];
    for (let i = 0; i < 8; i++) {
      const slot = `course-ui-source-${i}`;
      await host.state.save(slot, {
        __toolId: 'qr-code',
        __label: `Guide ${i + 1}`,
        url: `https://example.test/${i}`,
      });
      refs.push(slot);
    }
    await host.state.save('course-ui-unavailable', {
      __toolId: 'strip-data',
      __label: 'Unfinished recording',
    });
    await (await import(/* @vite-ignore */ entryPath)).startLearningCourse(host, {
      title: 'Partner onboarding',
      sessionRefs: [...refs, 'course-ui-unavailable'],
    });
  });
  const selection = page.getByRole('dialog', { name: 'Review course content', exact: true });
  assert.equal(
    await selection
      .getByRole('button', { name: 'Create course from selection', exact: true })
      .isEnabled(),
    false
  );
  await selection.getByRole('button', { name: 'Exclude unavailable items' }).click();
  assert.equal(
    await selection
      .getByRole('button', { name: 'Create course from selection', exact: true })
      .isEnabled(),
    true
  );
  await selection.getByLabel('Find content').fill('Guide 3');
  assert.equal(await selection.locator('[data-candidate]:visible').count(), 1);
  assert.equal(
    await selection.getByRole('button', { name: 'Move up', exact: true }).isEnabled(),
    false,
    'filtered lists do not reorder hidden content'
  );
  await selection.getByLabel('Find content').fill('');
  const candidate = selection.locator('[data-candidate]').nth(2);
  const candidateId = await candidate.getAttribute('data-candidate');
  await candidate.getByRole('button', { name: 'Move up', exact: true }).click();
  assert.equal(
    await selection.locator('[data-candidate]').nth(1).getAttribute('data-candidate'),
    candidateId
  );
  assert.equal(
    await selection
      .locator('[data-candidate]')
      .nth(1)
      .evaluate((el) => el.contains(document.activeElement)),
    true
  );
  await selection.getByRole('button', { name: 'Clear selection' }).click();
  assert.equal(
    await selection
      .getByRole('button', { name: 'Create course from selection', exact: true })
      .isEnabled(),
    false
  );
  await selection.getByRole('button', { name: 'Select all', exact: true }).click();
  await selection.getByRole('button', { name: 'Exclude unavailable items' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await selection.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), true);
  await selection
    .getByRole('button', { name: 'Create course from selection', exact: true })
    .click();
  await selection.waitFor({ state: 'hidden' });
  await page.getByLabel('Course title', { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel('Course title', { exact: true }).inputValue(),
    'Partner onboarding'
  );
  assert.equal(
    await page.getByRole('dialog').count(),
    0,
    'the author edits an assembled course before exporting'
  );
  assert.equal(await page.locator('.learning-lesson-list > li').count(), 8);
  const slot = new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('slot');
  await page.getByLabel('Course title', { exact: true }).fill('Updated partner onboarding');
  await page.evaluate(() => {
    window.location.hash = '#/p';
  });
  await page.locator('.projects').waitFor();
  assert.equal(
    await page.evaluate(async (slot) => {
      const path = '/src/bridge/index.ts';
      const host = await (await import(/* @vite-ignore */ path)).createBridge();
      return (await host.state.load(slot)).__learningModule.title;
    }, slot),
    'Updated partner onboarding',
    'leaving the route flushes a pending typing save'
  );
  console.log(
    'Course UI checks passed: editing, focus, reordering, undo, validation, destination changes, search and phone layout.'
  );
} finally {
  await browser.close();
}
