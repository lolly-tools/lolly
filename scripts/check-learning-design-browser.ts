// SPDX-License-Identifier: MPL-2.0
/** Audit course authoring against the shared brand, field, touch and modal contracts. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';

const arg = (key: string) =>
  process.argv.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const url = arg('url') || 'http://127.0.0.1:5173';
const engine = arg('browser') === 'webkit' ? 'webkit' : 'chromium';
const output = arg('output');
if (output) await mkdir(output, { recursive: true });
const browser = await { chromium, webkit }[engine].launch({ headless: true, args: engine === 'chromium' ? webGpuLaunchArgs('software') : [] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 950 }, hasTouch: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}/?theme=light#/learning`);
  await page
    .getByLabel('Course title', { exact: true })
    .fill('Linux essentials for new colleagues');
  await page.getByRole('button', { name: 'Add lesson', exact: true }).click();
  await page
    .getByLabel('Lesson title', { exact: true })
    .fill('Get comfortable with your workspace');
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page
    .getByLabel('Lesson text', { exact: true })
    .fill(
      'Explore your desktop and learn where to find your tools.\n\nBy the end of this lesson, you will be able to open applications and find saved files.'
    );
  await page.getByRole('heading', { name: 'Course editor', exact: true }).click();

  const footprint = async () => {
    const issues = await page.evaluate(() => {
      const problems: string[] = [];
      if (document.documentElement.scrollWidth > innerWidth + 1)
        problems.push('page overflows horizontally');
      for (const el of document.querySelectorAll<HTMLElement>(
        '.learning-ui .btn, .learning-export-steps button'
      )) {
        if (!el.getClientRects().length) continue;
        const b = el.getBoundingClientRect();
        if (b.height < 43.5 || (el.classList.contains('learning-icon-button') && b.width < 43.5))
          problems.push(`small action: ${el.textContent || el.getAttribute('aria-label')}`);
      }
      for (const el of document.querySelectorAll<HTMLInputElement>(
        '.learning-ui input:not([type=file]), .learning-ui select, .learning-ui textarea'
      )) {
        const expected =
          el.type === 'checkbox'
            ? 'field-check'
            : el.tagName === 'SELECT'
              ? 'field-select'
              : 'field-input';
        if (!el.classList.contains(expected)) problems.push(`unshared field: ${el.outerHTML}`);
        if (!el.labels?.length && !el.getAttribute('aria-label'))
          problems.push(`unlabelled field: ${el.outerHTML}`);
      }
      const dialog = document.querySelector('.learning-export');
      if (dialog) {
        const footer = dialog.querySelector('.learning-modal-footer')!.getBoundingClientRect();
        const body = dialog.querySelector('.learning-modal-body')!.getBoundingClientRect();
        if (
          dialog.scrollWidth > dialog.clientWidth + 1 ||
          footer.bottom > innerHeight + 1 ||
          footer.top < 0 ||
          body.height < 80
        )
          problems.push('export dialog loses usable body or footer');
      }
      return problems;
    });
    assert.deepEqual(issues, []);
  };
  for (const theme of ['light', 'dark', 'brand']) {
    await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
    for (const [name, width, height, scale] of [
      ['desktop', 1280, 950, 1],
      ['tablet', 834, 1194, 1],
      ['tablet-landscape', 1024, 768, 1],
      ['phone', 390, 844, 1],
      ['small-phone-large-text', 320, 568, 1.5],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.evaluate(
        (s) => document.documentElement.style.setProperty('--a11y-fs', String(s)),
        scale
      );
      await footprint();
      if (output)
        await page.screenshot({
          path: join(output, `${engine}-${theme}-${name}.png`),
          fullPage: true,
        });
      await page.getByRole('button', { name: 'Export course', exact: true }).click();
      await footprint();
      if (output && name === 'phone')
        await page.screenshot({ path: join(output, `${engine}-${theme}-export.png`) });
      await page.keyboard.press('Escape');
      assert.equal(
        await page
          .getByRole('button', { name: 'Export course', exact: true })
          .evaluate((e) => e === document.activeElement),
        true
      );
      await page.getByRole('button', { name: 'Preview as learner', exact: true }).click();
      const player = page.frameLocator('.learning-preview iframe');
      await player.getByRole('heading', { name: 'Linux essentials for new colleagues' }).waitFor();
      const playerIssues = await player.locator('body').evaluate((body) => {
        const problems: string[] = [];
        if (document.documentElement.scrollWidth > innerWidth + 1)
          problems.push('player overflows');
        const linear = (channel: number) => {
          const v = channel / 255;
          return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        };
        const lum = (c: string) => {
          const rgb = c.match(/[\d.]+/g)!.map(Number);
          return 0.2126 * linear(rgb[0]!) + 0.7152 * linear(rgb[1]!) + 0.0722 * linear(rgb[2]!);
        };
        const button = body.querySelector('button.btn--primary')!;
        const styles = getComputedStyle(button);
        const ink = lum(styles.color),
          fill = lum(styles.backgroundColor);
        if ((Math.max(ink, fill) + 0.05) / (Math.min(ink, fill) + 0.05) < 4.5)
          problems.push('primary contrast below 4.5');
        for (const action of body.querySelectorAll('button'))
          if (action.getClientRects().length && action.getBoundingClientRect().height < 44)
            problems.push('small player target');
        if (parseFloat(getComputedStyle(body).fontSize) < 16) problems.push('small reading text');
        return problems;
      });
      assert.deepEqual(playerIssues, [], `${theme} / ${name}`);
      if (output && ['phone', 'desktop', 'small-phone-large-text'].includes(name))
        await page.screenshot({ path: join(output, `${engine}-${theme}-player-${name}.png`) });
      await page.getByRole('button', { name: 'Close preview', exact: true }).click();
    }
  }

  await page.setViewportSize({ width: 1280, height: 950 });
  await page.evaluate(async () => {
    document.documentElement.style.removeProperty('--a11y-fs');
    document.documentElement.dataset.theme = 'light';
    const path = '/src/brand-vars.ts';
    const values: Record<string, unknown> = {
      'font.brand': 'Arial',
      'shape.radius': '4px',
      'space.base': '10px',
      'lolly.ui.type.ui-family': 'Arial',
      'lolly.ui.type.body': '17px',
      'lolly.ui.type.label': '14px',
      'lolly.ui.type.title': '20px',
      'lolly.ui.color.text.default': '#201330',
      'lolly.ui.color.text.muted': '#594866',
      'lolly.ui.color.surface.canvas': '#fff9f0',
      'lolly.ui.color.surface.raised': '#fff4df',
      'lolly.ui.color.surface.muted': '#f2e9db',
      'lolly.ui.color.action.primary': '#6336b5',
      'lolly.ui.color.action.on-primary': '#ffffff',
      'lolly.ui.color.selection.surface': '#eee5fb',
      'lolly.ui.color.selection.border': '#6336b5',
      'lolly.ui.color.border.default': '#8b789f',
      'lolly.ui.color.focus.ring': '#6336b5',
      'lolly.ui.radius.surface': '18px',
      'lolly.ui.radius.panel': '10px',
      'lolly.ui.space.panel': '20px',
      'lolly.ui.space.page': '28px',
      'lolly.ui.elevation.control': {
        color: '#00000033',
        offsetX: '0px',
        offsetY: '2px',
        blur: '6px',
        spread: '0px',
      },
    };
    await (await import(/* @vite-ignore */ path)).applyChromeBrandVars({
      tokens: {
        resolve: async (ref: string) => values[ref.replace(/[{}]/g, '')],
        colors: async () => [],
      },
    });
  });
  // Shared controls animate their brand colours and elevation.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  assert.deepEqual(
    await page.evaluate(() => {
      const css = (selector: string) => getComputedStyle(document.querySelector(selector)!);
      return {
        background: css('.learning-author').backgroundColor,
        raised: css('.learning-lesson').backgroundColor,
        text: css('.learning-author').color,
        font: css('.learning-author').fontSize,
        family: css('.learning-author').fontFamily.includes('Arial'),
        fieldRadius: css('.learning-field input').borderRadius,
        panelRadius: css('.learning-lesson').borderRadius,
        fieldShadow: css('.learning-field input').boxShadow.includes('6px'),
        buttonShadow: css('.learning-header .btn--primary').boxShadow.includes('6px'),
        action: css('.learning-header .btn--primary').backgroundColor,
        selection: css('.learning-lesson-tab[aria-current=true]').backgroundColor,
        space: css('.learning-lesson').paddingTop,
      };
    }),
    {
      background: 'rgb(255, 249, 240)',
      raised: 'rgb(255, 244, 223)',
      text: 'rgb(32, 19, 48)',
      font: '17px',
      family: true,
      fieldRadius: '10px',
      panelRadius: '18px',
      fieldShadow: true,
      buttonShadow: true,
      action: 'rgb(99, 54, 181)',
      selection: 'rgb(238, 229, 251)',
      space: '28px',
    }
  );
  if (output)
    await page.screenshot({ path: join(output, `${engine}-custom-brand.png`), fullPage: true });
  await page.getByRole('button', { name: 'Export course', exact: true }).click();
  assert.equal(
    await page.locator('.learning-export').evaluate((e) => getComputedStyle(e).backgroundColor),
    'rgb(255, 249, 240)'
  );
  await footprint();
  await page.keyboard.press('Escape');

  const route = new URL(page.url()).hash;
  await page.getByRole('button', { name: 'Preview as learner', exact: true }).click();
  await page
    .frameLocator('.learning-preview iframe')
    .getByRole('heading', { name: 'Linux essentials for new colleagues' })
    .waitFor();
  assert.equal(
    await page.locator('.learning-preview').evaluate((e) => getComputedStyle(e).backgroundColor),
    'rgb(255, 249, 240)'
  );
  assert.deepEqual(
    await page
      .frameLocator('.learning-preview iframe')
      .locator('body')
      .evaluate((body) => ({
        background: getComputedStyle(body).backgroundColor,
        family: getComputedStyle(body).fontFamily.includes('Arial'),
        action: getComputedStyle(body.querySelector('button.btn--primary')!).backgroundColor,
        panel: getComputedStyle(body.querySelector('.learning-reading')!).borderRadius,
      })),
    { background: 'rgb(255, 249, 240)', family: true, action: 'rgb(99, 54, 181)', panel: '18px' }
  );
  if (output) await page.screenshot({ path: join(output, `${engine}-preview.png`) });
  await page.evaluate(() => history.back());
  await page.locator('.learning-preview').waitFor({ state: 'detached' });
  assert.equal(new URL(page.url()).hash, route, 'Back closes preview without leaving the course');
  await page.waitForFunction(() => document.activeElement?.matches('[data-action=preview]'));
  assert.equal(
    await page
      .getByRole('button', { name: 'Preview as learner', exact: true })
      .evaluate((e) => e === document.activeElement),
    true
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Add lesson', exact: true }).click();
  await page.locator('.learning-lesson-tab').first().click();
  assert.equal(
    await page
      .getByLabel('Lesson title', { exact: true })
      .evaluate((e) => e === document.activeElement),
    true
  );
  await footprint();
  assert.deepEqual(errors, []);
  console.log(
    `${engine}: course design checks passed (15 author and player theme/viewport combinations, contrast, frozen brand profile tokens, shared fields, touch targets, modal Back and lesson focus).`
  );
} finally {
  await browser.close();
}
