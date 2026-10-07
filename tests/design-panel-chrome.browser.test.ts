// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';
import { closeBrowser, getBrowser } from '../packages/node-shell/src/browsers.ts';
import { settleEditor } from '../packages/node-shell/src/open-session.ts';

const origin = process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'no browser origin (set LOLLY_EXPORT_TEST_URL to a local web shell)';

test('Design panels use short labels, opaque floating surfaces and redock controls only while floating', { skip, timeout: 120_000 }, async () => {
  const browser = await getBrowser();
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    const boxes = [{ id: 'one', kind: 'frame', name: 'One', x: 0, y: 0, w: 800, h: 600 }];
    await page.goto(`${origin}/t/design?boxes=${encodeURIComponent(JSON.stringify(boxes))}&w=800&h=600`);
    await settleEditor(page, 30_000);
    const inspector = page.locator('.fc-insp');
    if (!await inspector.isVisible()) await page.getByRole('button', { name: 'Inspector', exact: true }).click();
    await inspector.locator('.fc-insp-tabs').getByRole('button', { name: 'Document', exact: true }).click();
    // A row with a help tip is a <div>, not a <label>, so read the visible label
    // text from the row's label span rather than from an enclosing <label>.
    for (const [field, label] of [['documentUnit', 'Units'], ['editingRange', 'Colour'], ['projectFps', 'Frame rate']]) {
      assert.equal(await inspector.locator(`[data-doc="${field}"]`).evaluate(el => el.closest('.fc-row')?.querySelector('.fc-row-help-label > span')?.textContent), label);
    }
    assert.equal(await inspector.locator('.fc-seg[data-seg="lolly-doc-theme-0"]').getAttribute('aria-label'), 'Theme');
    assert.equal(await inspector.locator('[data-act-col="maximize"], [data-act-col="detach"]').count(), 0);
    assert.equal(await inspector.locator('[data-act-col="dock"]').isVisible(), false);

    const dragHeader = async (selector: string): Promise<void> => {
      const head = await page.locator(selector).boundingBox();
      assert.ok(head);
      await page.mouse.move(head.x + 60, head.y + head.height / 2);
      await page.mouse.down();
      await page.mouse.move(400, 200, { steps: 8 });
      await page.mouse.up();
    };
    await dragHeader('.fc-insp-headbar');
    await page.waitForSelector('.fc-insp.is-floating');
    assert.equal(await inspector.locator('[data-act-col="dock"]').isVisible(), true);
    const surfaces = await inspector.evaluate(el => {
      const root = document.documentElement;
      const original = root.getAttribute('data-theme');
      const colours: string[] = [];
      for (const theme of ['light', 'dark']) {
        root.setAttribute('data-theme', theme);
        colours.push(getComputedStyle(el).backgroundColor);
      }
      if (original == null) root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', original);
      return colours;
    });
    for (const background of surfaces) assert.match(background, /^rgb\(/, 'the floating inspector has an opaque surface in both themes');

    const grip = await inspector.locator('[data-panel-grip="se"]').boundingBox();
    assert.ok(grip);
    const before = await inspector.boundingBox();
    assert.ok(before);
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2 + 60, grip.y + grip.height / 2 - 60, { steps: 6 });
    await page.mouse.up();
    const after = await inspector.boundingBox();
    assert.ok(after && after.width > before.width && after.height < before.height, 'grips resize the panel');
    const output = process.env.LOLLY_DESIGN_TOOL_TEST_OUTPUT;
    if (output) {
      await mkdir(output, { recursive: true });
      await page.screenshot({ path: `${output}/floating-inspector.png` });
    }
    await inspector.locator('[data-act-col="dock"]').click();
    assert.equal(await inspector.locator('[data-act-col="dock"]').isVisible(), false);

    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const popup = page.locator('.export-popup');
    assert.equal(await popup.locator('.export-popup-max').count(), 0);
    assert.equal(await popup.locator('.export-popup-dock').isVisible(), false);
    await dragHeader('.export-popup-head');
    await page.waitForFunction(() => !!document.querySelector('.export-popup') && !document.querySelector('.export-popup')!.closest('.edge-dock-slot'));
    assert.equal(await popup.locator('.export-popup-dock').isVisible(), true);
    await popup.locator('.export-popup-dock').click();
    assert.equal(await popup.locator('.export-popup-dock').isVisible(), false);
  } finally {
    await context.close();
    await closeBrowser();
  }
});
