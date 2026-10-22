// SPDX-License-Identifier: MPL-2.0
/**
 * Turn on Training and courses for the browser context a learning check drives.
 *
 * Course authoring has been opt-in since 2026-10-11 (`LEARNING_FLAG` in
 * shells/web/src/feature-flags.ts defaults off), so on a fresh context `#/learning`
 * shows the "Turn on Training and courses in Settings" card and there is no course
 * editor to drive. This turns it on the way a person does, from the Settings toggle,
 * which writes the profile record the mirror is rebuilt from at every boot. Writing
 * the `lolly:featureFlags` mirror directly would not survive the next page load.
 * tests/learning-feature.browser.test.ts drives the same toggle.
 */
import type { Page } from 'playwright';

export async function turnOnLearning(page: Page, origin: string): Promise<void> {
  await page.goto(`${origin}/#/settings?focus=feature-flags-section`);
  const toggle = page.locator('[data-flag="training-courses"]');
  await toggle.waitFor({ state: 'attached' });
  if (!(await toggle.isChecked())) await page.locator('label[for="ff-training-courses"]').click();
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem('lolly:featureFlags') || '{}')['training-courses'] === true
  );
}
