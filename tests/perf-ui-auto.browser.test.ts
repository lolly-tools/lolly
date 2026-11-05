// SPDX-License-Identifier: MPL-2.0
/**
 * The automatic Performance UI switch in a real Chromium on a software adapter
 * (SwiftShader, as CI's browser lane and LOLLY_WEBGPU_TEST_ADAPTER=swiftshader give):
 * it switches at start-up and reports that once the first-visit prompt is answered (never on
 * top of it), Keep and Undo do what they say across a reload, Settings shows when and
 * why, or after an Undo offers "Allow again", and a hand choice stops the detector.
 *
 * The temporary switch for a constrained device is driven through Chromium's own CPU
 * pressure emulation (the DevTools protocol's Emulation.setPressureSourceOverrideEnabled
 * and Emulation.setPressureStateOverride): a brief spike does nothing, sustained
 * 'serious' switches on for a while, calm switches it back, Keep makes it lasting and
 * Undo stops temporary switching. Those pages first record an Undo on the weak-device
 * switch, since on SwiftShader that switch would otherwise decide at start-up, and
 * divide the temporary switch's timings by TIMESCALE so a run takes seconds.
 *
 * An automated browser never runs the detector on its own, so every page here opts in
 * with the probe key (lib/perf-ui-auto.ts PERF_UI_AUTO_PROBE_KEY). The decision maths
 * is covered with synthetic frames in shells/web/src/lib/perf-ui-auto-detect.test.ts,
 * and with synthetic pressure, battery and calm timelines in
 * shells/web/src/lib/perf-ui-auto-temporary.test.ts.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, type Browser, type BrowserContext, type CDPSession, type Page } from 'playwright';
import { shellSettled } from './helpers/shell-settled.ts';

const origin = process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'Set LOLLY_EXPORT_TEST_URL (serve the web shell locally)';
if (origin) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));

const PROBE = 'lolly:perfUiAuto:probe';
const RECORD = 'lolly:perfUiAuto';
const TIMESCALE_KEY = 'lolly:perfUiAuto:timescale';
/** The temporary switch's timings divided by 30: on after 2 s of 'serious', back after
 *  10 s of calm, and at least 20 s in each state. */
const TIMESCALE = 30;

/** A context that skips the first-run welcome and, when `probe`, opts into the detector. */
async function context(browser: Browser, probe = true): Promise<BrowserContext> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(({ probeKey, on }) => {
    if (!location.protocol.startsWith('http')) return;
    for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
    if (on) localStorage.setItem(probeKey, '1');
  }, { probeKey: PROBE, on: probe });
  return ctx;
}

async function open(page: Page, hash = '#/'): Promise<void> {
  await page.goto(`${origin}/${hash}`, { waitUntil: 'networkidle' });
  await shellSettled(page);
}

/** What the page's own WebGPU adapter says: the test only expects a switch on software.
 *  Null when there is no adapter at all: the shell then shows its WebGPU card and never
 *  boots, so nothing here could be checked. */
async function softwareAdapter(page: Page): Promise<boolean | null> {
  return page.evaluate(async () => {
    const adapter = await (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ info?: { architecture?: string; vendor?: string; isFallbackAdapter?: boolean } } | null> } }).gpu?.requestAdapter();
    if (!adapter) return null;
    const info = adapter.info;
    return info?.isFallbackAdapter === true || /swiftshader|llvmpipe|lavapipe/i.test(`${info?.vendor} ${info?.architecture}`);
  });
}
const NO_ADAPTER = 'no WebGPU adapter: run with LOLLY_WEBGPU_TEST_ADAPTER=swiftshader and --import ./tests/browser-gpu.ts';

/** The gallery's first-visit banner ("Add your details to what you make?") holds the
 *  notice back. Answer it with "Not now" when it shows; the notice may only follow. */
async function answerFirstVisitPrompt(page: Page): Promise<boolean> {
  const prompt = page.locator('.personalize-nudge:not([hidden])');
  try { await prompt.waitFor({ timeout: 15_000 }); } catch { return false; }
  assert.equal(await page.locator('.undo-toast--wrap').count(), 0, 'never stacked on the first-visit prompt');
  await page.waitForTimeout(1500);
  assert.equal(await page.locator('.undo-toast--wrap').count(), 0, 'still waiting while the prompt is up');
  await prompt.locator('.personalize-nudge-dismiss').click();
  return true;
}

/** The record's `on` part, or an empty object. */
const on = (rec: Record<string, unknown> | null): Record<string, unknown> => (rec?.on as Record<string, unknown> | undefined) ?? {};
const perfUi = (page: Page): Promise<boolean> => page.evaluate(() => document.documentElement.hasAttribute('data-perf-ui'));
const record = (page: Page): Promise<Record<string, unknown> | null> =>
  page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), RECORD);

test('a software renderer switches the Performance UI on at start-up, with Undo and Keep', { skip, timeout: 180_000 }, async t => {
  const browser = await chromium.launch();
  try {
    const ctx = await context(browser);
    const page = await ctx.newPage();
    await open(page);
    const software = await softwareAdapter(page);
    if (software === null) { t.skip(NO_ADAPTER); return; }
    if (!software) {
      // A browser with real graphics acceleration must not switch at start-up.
      await page.waitForTimeout(3000);
      assert.equal(await perfUi(page), false, 'hardware: no switch');
      assert.equal(await record(page), null);
      return;
    }
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-perf-ui'), undefined, { timeout: 60_000 });
    assert.equal(await answerFirstVisitPrompt(page), true, 'a first visit shows the personalise prompt');
    const toast = page.locator('.undo-toast--wrap');
    await toast.waitFor({ timeout: 10_000 });
    assert.match(await toast.locator('.undo-toast-msg').innerText(), /simpler, faster look because this device draws without graphics acceleration/);
    assert.deepEqual(await toast.locator('.undo-toast-btn').allInnerTexts(), ['Undo', 'Keep']);
    assert.deepEqual(await record(page).then(r => r && { kind: on(r).kind, reason: on(r).reason }), { kind: 'lasting', reason: 'software' });

    // Keep: stays on, the notice is not shown again, and the look is there before first paint.
    await toast.getByRole('button', { name: 'Keep' }).click();
    assert.equal(await toast.count(), 0);
    assert.equal(on(await record(page)).seen, true);
    // A reload: going to the same #/ again would keep the same document.
    await page.reload({ waitUntil: 'commit' });
    await page.waitForFunction(() => document.readyState !== 'loading');
    assert.equal(await perfUi(page), true, 'the pre-paint script applies the stored decision');
    await shellSettled(page);
    await page.waitForTimeout(1500);
    assert.equal(await page.locator('.undo-toast--wrap').count(), 0, 'no second notice');

    // Settings: the switch is on, with the date and the reason under the switch.
    await open(page, '#/settings?focus=feature-flags-section');
    const control = page.locator('#feature-flags [data-flag="perf-ui"]');
    await control.waitFor({ state: 'attached' });
    assert.equal(await control.isChecked(), true);
    const note = page.locator('#ff-perf-ui-auto');
    assert.match(await note.innerText(), /^Turned on automatically on .+ because this device draws without graphics acceleration\.$/);
    assert.equal(await control.getAttribute('aria-describedby'), 'ff-perf-ui-auto');
    await ctx.close();

    // Undo: off, and never automatic again on this device.
    const ctx2 = await context(browser);
    const page2 = await ctx2.newPage();
    await open(page2);
    await page2.waitForFunction(() => document.documentElement.hasAttribute('data-perf-ui'), undefined, { timeout: 60_000 });
    await answerFirstVisitPrompt(page2);
    await page2.locator('.undo-toast--wrap').waitFor({ timeout: 60_000 });
    await page2.getByRole('button', { name: 'Undo' }).click();
    assert.equal(await perfUi(page2), false);
    assert.equal(on(await record(page2)).kind, undefined);
    assert.equal(typeof ((await record(page2))?.undone as Record<string, unknown> | undefined)?.weak, 'number', 'an Undo on the weak-device switch');
    await page2.reload({ waitUntil: 'networkidle' });
    await shellSettled(page2);
    await page2.waitForTimeout(3000);
    assert.equal(await perfUi(page2), false, 'no second switch after Undo');
    assert.equal(await page2.locator('.undo-toast--wrap').count(), 0);

    // Settings says so under the switch, and "Allow again" clears it without turning the look on.
    await open(page2, '#/settings?focus=feature-flags-section');
    const line = page2.locator('#ff-perf-ui-auto');
    await line.waitFor({ state: 'attached' });
    // Chromium offers CPU pressure and battery signals, so the temporary kind still may run.
    assert.match(await line.innerText(), /^Lolly will not switch for a slow device here, because you chose Undo on .+\.$/);
    const allow = page2.getByRole('button', { name: 'Allow again' });
    await allow.click();
    assert.equal(await record(page2), null, 'the Undo is forgotten');
    assert.equal(await perfUi(page2), false, 'and the look stays off');
    assert.match(await line.innerText(), /^Automatic switching is allowed again from the next time you open Lolly\.$/);
    assert.equal(await allow.count(), 0);
    assert.equal(await page2.evaluate(() => document.activeElement?.getAttribute('data-flag')), 'perf-ui', 'focus lands on the switch');
    // The next start may switch again: on this software adapter, it does. A new start
    // means a reload, since a hash change alone keeps the same document.
    await page2.evaluate(() => { location.hash = '#/'; });
    await page2.reload({ waitUntil: 'networkidle' });
    await shellSettled(page2);
    await page2.waitForFunction(() => document.documentElement.hasAttribute('data-perf-ui'), undefined, { timeout: 60_000 });
    assert.equal(on(await record(page2)).reason, 'software');
    await ctx2.close();
  } finally { await browser.close(); }
});

test('a hand choice in Settings outranks the automatic switch', { skip, timeout: 180_000 }, async t => {
  const browser = await chromium.launch();
  try {
    // First visit without the probe: nothing automatic runs, so the person chooses first.
    const ctx = await context(browser, false);
    const page = await ctx.newPage();
    await open(page, '#/settings?focus=feature-flags-section');
    if (await softwareAdapter(page) === null) { t.skip(NO_ADAPTER); return; }
    const label = page.locator('label[for="ff-perf-ui"]');
    await label.waitFor();
    await label.click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('lolly:featureFlags') || '{}')['perf-ui'] === true);
    await label.click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('lolly:featureFlags') || '{}')['perf-ui'] === false);
    // Now opt in and start again on a software adapter: the hand choice (off) stands.
    await page.evaluate(key => localStorage.setItem(key, '1'), PROBE);
    await open(page);
    await page.waitForTimeout(4000);
    assert.equal(await perfUi(page), false);
    assert.equal(await record(page), null, 'the detector never even ran');
    assert.equal(await page.locator('.undo-toast--wrap').count(), 0);
    await ctx.close();
  } finally { await browser.close(); }
});

/** A context for the temporary switch: probe on, timings divided by TIMESCALE, and an Undo
 *  already recorded on the weak-device switch (a software adapter would decide at start-up). */
async function constrainedContext(browser: Browser): Promise<BrowserContext> {
  const ctx = await context(browser);
  await ctx.addInitScript(({ record, scaleKey, scale }) => {
    if (!location.protocol.startsWith('http')) return;
    localStorage.setItem(scaleKey, String(scale));
    if (localStorage.getItem(record) === null) localStorage.setItem(record, JSON.stringify({ v: 2, undone: { weak: Date.now() } }));
  }, { record: RECORD, scaleKey: TIMESCALE_KEY, scale: TIMESCALE });
  return ctx;
}

/** Chromium's emulated CPU pressure for this page, starting at 'nominal'. */
async function pressure(page: Page): Promise<(state: 'nominal' | 'fair' | 'serious' | 'critical') => Promise<void>> {
  const cdp: CDPSession = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setPressureSourceOverrideEnabled', { enabled: true, source: 'cpu' });
  const set = async (state: 'nominal' | 'fair' | 'serious' | 'critical'): Promise<void> => {
    await cdp.send('Emulation.setPressureStateOverride', { source: 'cpu', state });
  };
  await set('nominal');
  return set;
}

/** The probe's latest line from the temporary switch: its own summary, never stored. */
function probeLog(page: Page): () => Record<string, unknown> | null {
  let last: Record<string, unknown> | null = null;
  page.on('console', msg => {
    const text = msg.text();
    if (text.startsWith('[perf-ui-auto:temporary]')) last = JSON.parse(text.slice(text.indexOf('{')));
  });
  return () => last;
}

test('CPU pressure switches the look on for a while, and calm switches it back', { skip, timeout: 240_000 }, async t => {
  const browser = await chromium.launch();
  try {
    const ctx = await constrainedContext(browser);
    const page = await ctx.newPage();
    const set = await pressure(page);
    const summary = probeLog(page);
    await open(page);
    if (await softwareAdapter(page) === null) { t.skip(NO_ADAPTER); return; }
    await page.bringToFront(); // the browser reports pressure to a focused page only
    await answerFirstVisitPrompt(page);
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-perf-ui') === false);
    await page.waitForTimeout(1500);
    assert.equal(summary()?.now, 'calm', 'nominal reads as calm');

    // A brief spike does nothing: a quarter of the two seconds a constraint needs here.
    await set('serious');
    await page.waitForTimeout(500);
    await set('nominal');
    await page.waitForTimeout(4000);
    assert.equal(await perfUi(page), false, 'a spike never switches');
    assert.equal((await record(page))?.on, undefined);

    // Sustained 'serious' switches on, for a while, and the notice says so. Every time in
    // the state is read from the product's own record: `on.at` when it switched on and
    // `backAt` when it switched back. The test sees each change only when its next poll
    // runs, and a busy runner can hold that poll back for seconds after the switch.
    const before = Date.now();
    await set('serious');
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-perf-ui'), undefined, { timeout: 20_000 });
    const seenOn = Date.now();
    const switched = await record(page);
    assert.deepEqual({ kind: on(switched).kind, reason: on(switched).reason }, { kind: 'temporary', reason: 'pressure' });
    const onAt = on(switched).at;
    assert.equal(typeof onAt, 'number', 'the time it switched on');
    const tookMs = (onAt as number) - before;
    assert.ok(tookMs >= 2000 * 0.9, `not before the constraint has lasted (${tookMs} ms)`);
    const toast = page.locator('.undo-toast--wrap');
    await toast.waitFor({ timeout: 10_000 });
    assert.equal(await toast.locator('.undo-toast-msg').innerText(), 'Lolly switched to the simpler, faster look while this device is busy. It switches back when things calm down.');
    assert.deepEqual(await toast.locator('.undo-toast-btn').allInnerTexts(), ['Undo', 'Keep']);
    const raw = await page.evaluate(key => localStorage.getItem(key) ?? '', RECORD);
    assert.doesNotMatch(raw, /serious|critical|nominal|level/, 'only the decision and its reason are stored');

    // Settings explains the current state while it is on.
    await open(page, '#/settings?focus=feature-flags-section');
    await page.bringToFront();
    const note = page.locator('#ff-perf-ui-auto');
    await note.waitFor({ state: 'attached' });
    assert.match(await note.innerText(), /^On for now because this device is busy\. It switches back when things calm down\. Lolly will not switch for a slow device here, because you chose Undo on .+\.$/);
    assert.equal(await page.locator('#feature-flags [data-flag="perf-ui"]').isChecked(), true);

    // Calm switches it back: after ten seconds of calm here, once twenty have passed since it
    // went on. Calm cannot start before the 'nominal' reading is sent, so it counts from then.
    const calmFrom = Date.now();
    await set('nominal');
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-perf-ui'), undefined, { timeout: 60_000 });
    const seenMs = Date.now() - seenOn;
    const back = await record(page);
    assert.equal(back?.on, undefined);
    assert.equal(typeof back?.backAt, 'number', 'the time it switched back, for the next dwell');
    const backAt = back?.backAt as number;
    assert.ok(backAt - calmFrom >= 10_000 * 0.9, `not before calm has lasted (${backAt - calmFrom} ms)`);
    const sinceOn = backAt - (onAt as number);
    assert.ok(sinceOn >= 20_000 * 0.9, `not before the minimum time in the state (${sinceOn} ms by the record, ${seenMs} ms as the test saw it)`);
    assert.equal(await page.locator('#feature-flags [data-flag="perf-ui"]').isChecked(), false, 'Settings follows');
    assert.match(await note.innerText(), /^Lolly will not switch for a slow device here, because you chose Undo on .+\.$/);
    // And it stays back while calm holds.
    await page.waitForTimeout(3000);
    assert.equal(await perfUi(page), false);
    await ctx.close();
  } finally { await browser.close(); }
});

test('Keep makes a temporary switch lasting; Undo stops temporary switching on this device', { skip, timeout: 240_000 }, async t => {
  const browser = await chromium.launch();
  try {
    for (const choice of ['Keep', 'Undo'] as const) {
      const ctx = await constrainedContext(browser);
      const page = await ctx.newPage();
      const set = await pressure(page);
      await open(page);
      if (await softwareAdapter(page) === null) { t.skip(NO_ADAPTER); return; }
      await page.bringToFront();
      await answerFirstVisitPrompt(page);
      await set('serious');
      await page.waitForFunction(() => document.documentElement.hasAttribute('data-perf-ui'), undefined, { timeout: 20_000 });
      const toast = page.locator('.undo-toast--wrap');
      await toast.waitFor({ timeout: 10_000 });
      await toast.getByRole('button', { name: choice }).click();
      const after = await record(page);
      if (choice === 'Keep') {
        assert.deepEqual({ ...on(after), at: 0 }, { kind: 'lasting', reason: 'pressure', at: 0, seen: true });
        // Calm for longer than it would take to switch back: a kept look stays.
        await set('nominal');
        await page.waitForTimeout(25_000);
        assert.equal(await perfUi(page), true, 'kept: it never switches back by itself');
        await page.reload({ waitUntil: 'commit' });
        await page.waitForFunction(() => document.readyState !== 'loading');
        assert.equal(await perfUi(page), true, 'and the next start applies it before first paint');
      } else {
        assert.equal(await perfUi(page), false, 'Undo: off at once');
        assert.equal(after?.on, undefined);
        assert.equal(typeof (after?.undone as Record<string, unknown>)?.constrained, 'number');
        // Still under pressure: no second switch, in this tab or after a reload.
        await page.waitForTimeout(5000);
        assert.equal(await perfUi(page), false);
        await page.reload({ waitUntil: 'networkidle' });
        await shellSettled(page);
        await page.bringToFront();
        await set('serious');
        await page.waitForTimeout(5000);
        assert.equal(await perfUi(page), false, 'no temporary switch again on this device');
        await open(page, '#/settings?focus=feature-flags-section');
        const line = page.locator('#ff-perf-ui-auto');
        await line.waitFor({ state: 'attached' });
        assert.match(await line.innerText(), /^Automatic switching is off on this device because you chose Undo on .+\.$/);
        await page.getByRole('button', { name: 'Allow again' }).click();
        assert.equal((await record(page))?.undone, undefined, 'Allow again clears both kinds');
        assert.equal(await perfUi(page), false, 'and the look stays off');
      }
      await ctx.close();
    }
  } finally { await browser.close(); }
});

test('a hand choice outranks the temporary switch too', { skip, timeout: 180_000 }, async t => {
  const browser = await chromium.launch();
  try {
    const ctx = await constrainedContext(browser);
    const page = await ctx.newPage();
    const set = await pressure(page);
    await open(page, '#/settings?focus=feature-flags-section');
    if (await softwareAdapter(page) === null) { t.skip(NO_ADAPTER); return; }
    const label = page.locator('label[for="ff-perf-ui"]');
    await label.waitFor();
    await label.click();
    await label.click(); // on, then off: a hand choice of "off"
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('lolly:featureFlags') || '{}')['perf-ui'] === false);
    // A new start, on the gallery: a hash change alone would keep the same document.
    await page.evaluate(() => { location.hash = '#/'; });
    await page.reload({ waitUntil: 'networkidle' });
    await shellSettled(page);
    await page.bringToFront();
    await set('critical');
    await page.waitForTimeout(6000);
    assert.equal(await perfUi(page), false, 'critical pressure, and still the person\'s choice');
    assert.equal((await record(page))?.on, undefined);
    await ctx.close();
  } finally { await browser.close(); }
});
