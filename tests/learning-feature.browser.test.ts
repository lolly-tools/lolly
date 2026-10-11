// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { shellSettled } from './helpers/shell-settled.ts';

const origin = process.env.LOLLY_HISTORY_TEST_URL || process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'Set LOLLY_HISTORY_TEST_URL or LOLLY_EXPORT_TEST_URL (serve the web shell locally)';
if (origin) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));

test('Training and courses starts off, gates Projects and deep links, and preserves opt-in work', { skip, timeout: 120_000 }, async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  try {
    await page.goto(`${origin}/#/p`, { waitUntil: 'networkidle' }); await shellSettled(page);
    assert.equal(await page.getByRole('link', { name: 'Create learning module', exact: true }).count(), 0);
    await page.evaluate(async () => {
      const path = '/src/lib/host-ref.ts'; const host = (await import(path)).getHostRef();
      const profile = await host.profile.get();
      await host.profile.set({ ...profile, folders: [{ id: 'course-feature-test', name: 'Course flag project', items: [] }] });
    });
    await page.reload({ waitUntil: 'networkidle' }); await shellSettled(page);
    const folder = page.locator('.folder-tile[data-ref="course-feature-test"]');
    await folder.click({ button: 'right' });
    assert.equal(await page.getByRole('menuitem', { name: 'Export course', exact: true }).count(), 0);
    await page.keyboard.press('Escape');
    await folder.locator('[data-select]').click();
    assert.equal(await page.locator('[data-bulk="course"]:visible').count(), 0);
    await page.goto(`${origin}/#/p/course-feature-test`, { waitUntil: 'networkidle' }); await shellSettled(page);
    assert.equal(await page.locator('[data-course-folder]').count(), 0);
    await page.goto(`${origin}/#/learning`, { waitUntil: 'networkidle' }); await shellSettled(page);
    await page.getByText('Turn on Training and courses in Settings to use this feature.', { exact: true }).waitFor();
    assert.equal(await page.locator('.learning-author').count(), 0);
    const before = await page.evaluate(async () => { const path = '/src/lib/host-ref.ts'; return (await import(path)).getHostRef().state.list(); });
    assert.equal(before.filter((entry: { slot: string }) => entry.slot.startsWith('__learning__:')).length, 0);
    await page.getByRole('link', { name: 'Feature flags', exact: true }).click();
    const toggle = page.locator('[data-flag="training-courses"]');
    await toggle.waitFor({ state: 'attached' }); assert.equal(await toggle.isChecked(), false);
    await page.locator('label[for="ff-training-courses"]').click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('lolly:featureFlags') || '{}')['training-courses'] === true);
    await page.goto(`${origin}/#/p/course-feature-test`, { waitUntil: 'networkidle' }); await shellSettled(page);
    await page.locator('[data-course-folder]').waitFor();
    await page.getByRole('link', { name: 'Create learning module', exact: true }).click();
    await page.getByRole('heading', { name: 'Course editor', exact: true }).waitFor();
    await page.getByText('Saved on this device', { exact: true }).waitFor();
    const address = page.url();
    const saved = await page.evaluate(async () => { const path = '/src/lib/host-ref.ts'; const host = (await import(path)).getHostRef(); const slot = new URLSearchParams(location.hash.split('?')[1]).get('slot'); return { slot, data: await host.state.load(slot) }; });
    assert.ok(saved.slot?.startsWith('__learning__:'));
    await page.goto(`${origin}/#/settings?focus=feature-flags-section`, { waitUntil: 'networkidle' }); await shellSettled(page);
    await page.locator('label[for="ff-training-courses"]').click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('lolly:featureFlags') || '{}')['training-courses'] === false);
    await page.goto(address, { waitUntil: 'networkidle' }); await shellSettled(page);
    await page.getByText('Turn on Training and courses in Settings to use this feature.', { exact: true }).waitFor();
    assert.equal(await page.locator('.learning-author').count(), 0);
    const after = await page.evaluate(async slot => { const path = '/src/lib/host-ref.ts'; return (await import(path)).getHostRef().state.load(slot); }, saved.slot);
    assert.deepEqual(after, saved.data);
  } finally { await browser.close(); }
});
