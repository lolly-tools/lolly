// SPDX-License-Identifier: MPL-2.0
/** The required gate exercises the installed browser engine without optional skips. */
import { chromium, firefox, webkit } from 'playwright';
export function launchGeometryBrowser() {
  const engine = process.env.LOLLY_GEOMETRY_BROWSER ?? 'chromium';
  if (engine === 'firefox') return firefox.launch({ headless: true, args: process.env.LOLLY_GEOMETRY_FIREFOX_OVERRIDE ? ['--override', process.env.LOLLY_GEOMETRY_FIREFOX_OVERRIDE] : [] });
  if (engine === 'webkit') return webkit.launch({ headless: true });
  if (engine !== 'chromium') throw Error(`Unsupported geometry browser: ${engine}`);
  return chromium.launch({ headless: true, channel: process.env.LOLLY_BROWSER_CHANNEL ?? (process.env.LOLLY_GEOMETRY_BROWSER ? undefined : 'chrome') });
}
