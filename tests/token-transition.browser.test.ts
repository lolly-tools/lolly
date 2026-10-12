// SPDX-License-Identifier: MPL-2.0
/** Enter links use real picker, render, theme, history and persistence paths. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import type { Locator, Page } from 'playwright';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { settleEditor } from '../packages/node-shell/src/open-session.ts';
import type { CanvasCommitEl } from '../shells/web/src/lib/canvas-commit.ts';
import type { HostV1, TokenSet } from '../engine/src/bridge/host-v1.ts';

const origin = process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'set LOLLY_EXPORT_TEST_URL';
const linear = 'cubic-bezier(0,0,1,1)';
if (origin) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));

async function mount(page: Page, invalidTheme = true): Promise<void> {
  page.setDefaultTimeout(30_000);
  await page.route('**/catalog/assets/*/tokens/brand.json', async route => {
    const response = await route.fetch();
    const doc = await response.json();
    (doc.base ?? doc).verification = {
      duration: { $type: 'duration', $value: { value: 0.75, unit: 's' } },
      durationAlias: { $type: 'duration', $value: '{verification.duration}' },
      zero: { $type: 'duration', $value: { value: 0, unit: 'ms' } },
      curve: { $type: 'cubicBezier', $value: [0, 0, 1, 1] },
      enter: { $type: 'transition', $value: { duration: '{verification.durationAlias}', delay: '{verification.zero}', timingFunction: '{verification.curve}' } },
      delayed: { $type: 'transition', $value: { duration: { value: 600, unit: 'ms' }, delay: { value: 50, unit: 'ms' }, timingFunction: [0, 0, 1, 1] } },
      short: { $type: 'transition', $value: { duration: { value: 50, unit: 'ms' }, delay: { value: 0, unit: 'ms' }, timingFunction: [0, 0, 1, 1] } },
      badCurve: { $type: 'transition', $value: { duration: { value: 600, unit: 'ms' }, delay: { value: 0, unit: 'ms' }, timingFunction: [2, 0, 1, 1] } },
    };
    doc.dark ??= {};
    doc.dark.verification = invalidTheme
      ? { duration: { $type: 'duration', $value: { value: 1200, unit: 'ms' } }, curve: { $type: 'cubicBezier', $value: [2, 0, 1, 1] } }
      : { duration: { $type: 'duration', $value: { value: 1200, unit: 'ms' } }, zero: { $type: 'duration', $value: { value: 50, unit: 'ms' } } };
    await route.fulfill({ response, json: doc });
  });
  const boxes = [
    { id: 'a', kind: 'box', x: 100, y: 100, w: 240, h: 100, rot: 0, bg: '#777777', start: 0, dur: 4, enter: 'rise', enterMs: 400, enterEase: '', exit: 'fade', exitMs: 600, exitEase: 'ease-in', build: '', lane: '' },
    { id: 'b', kind: 'box', x: 420, y: 100, w: 100, h: 100, rot: 0, bg: '#666666', enter: 'rise', enterMs: 500, enterEase: 'ease-out' },
    { id: 'frame', kind: 'frame', x: 0, y: 0, w: 720, h: 540, rot: 0, bg: '#ffffff' },
  ];
  await page.goto(`${origin}/t/design?${new URLSearchParams({ boxes: JSON.stringify(boxes), _sel: 'a', c2pa: '0', imprint: '0' })}`);
  await page.waitForFunction(() => !!(document.getElementById('tool-canvas') as CanvasCommitEl)?.__lollyModel);
  await page.waitForFunction(() => !!(window as unknown as { lolly?: { ui?: unknown } }).lolly?.ui);
  await page.locator('dialog.view-loading[open]').waitFor({ state: 'hidden' });
  await select(page, ['a']);
}

async function select(page: Page, ids: string[]): Promise<void> {
  await page.evaluate(selection => (window as unknown as { lolly: { ui: { apply(value: unknown): void } } }).lolly.ui.apply({ v: 1, sel: selection }), ids);
  await settleEditor(page, 30_000);
}

async function motion(page: Page): Promise<Locator> {
  if (await page.locator('[data-topbar="inspector"]').getAttribute('aria-pressed') !== 'true') {
    const desktop = page.locator('[data-topbar="inspector"]');
    if (await desktop.isVisible()) await desktop.click();
    else await page.getByRole('button', { name: 'Inspect', exact: true }).click();
  }
  await page.locator('.fc-insp-tabs').getByRole('button', { name: 'Selection', exact: true }).click();
  const head = page.locator('[data-head="motion"]');
  if (await head.getAttribute('aria-expanded') !== 'true') await head.click();
  const slot = page.locator('[data-token-section="motion"]');
  if (!await slot.locator('details').evaluate(el => (el as HTMLDetailsElement).open)) await slot.locator('summary').click();
  return slot;
}

async function row(page: Page, id = 'a'): Promise<Record<string, unknown>> {
  return page.evaluate(key => ((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(input => input.id === 'boxes')!.value as Array<Record<string, unknown>>).find(value => value.id === key)!, id);
}

async function values(page: Page, ms: number, ease = linear): Promise<void> {
  await page.waitForFunction(({ ms, ease }) => {
    const value = ((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(input => input.id === 'boxes')!.value as Array<Record<string, unknown>>).find(value => value.id === 'a');
    return value?.enterMs === ms && value?.enterEase === ease;
  }, { ms, ease });
}

async function customState(page: Page, duration: boolean, easing: boolean): Promise<void> {
  await page.waitForFunction(({ duration, easing }) => {
    const value = ((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(input => input.id === 'boxes')!.value as Array<Record<string, unknown>>).find(value => value.id === 'a');
    const links = JSON.parse(String(value?.tokenLinks || '{}'));
    return !!links.enterMs && !!links.enterEase && !!links.enterMs.custom === duration && !!links.enterEase.custom === easing;
  }, { duration, easing });
}

async function holdFinalTokenRead(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const path = '/src/lib/host-ref.ts';
    const { getHostRef } = await import(path);
    const api = (getHostRef() as HostV1).tokens!;
    const original = api.get;
    const state = { started: false, finished: false, release: () => {} };
    let calls = 0;
    api.get = options => {
      if (++calls !== 2) return original.call(api, options);
      api.get = original;
      state.started = true;
      return new Promise<TokenSet>((resolve, reject) => { state.release = () => { original.call(api, options).then(resolve, reject); }; }).finally(() => { state.finished = true; });
    };
    (window as unknown as { __transitionRead: typeof state }).__transitionRead = state;
  });
}

async function releaseTokenRead(page: Page): Promise<void> {
  await page.evaluate(() => (window as unknown as { __transitionRead: { release(): void } }).__transitionRead.release());
  await page.waitForFunction(() => (window as unknown as { __transitionRead: { finished: boolean } }).__transitionRead.finished);
  await settleEditor(page, 30_000);
}

async function link(page: Page, path = 'verification.enter'): Promise<Locator> {
  const slot = await motion(page);
  await slot.locator('[data-design-token-property]').selectOption('__transition');
  await slot.locator('[data-token-choose]').click();
  await slot.locator('[data-token-options] select').selectOption(path);
  await slot.locator('[data-token-link]').click();
  await values(page, 750);
  return slot;
}

async function theme(page: Page, name: string): Promise<void> {
  await page.locator('.fc-insp-tabs').getByRole('button', { name: 'Document', exact: true }).click();
  await page.locator('.fc-seg[data-seg="lolly-doc-theme-0"] .fc-seg-btn', { hasText: name }).click();
  await settleEditor(page, 30_000);
}

test('Enter transition links refuse incompatible candidates and render, undo, restore and reopen together', { skip, timeout: 180_000 }, async () => {
  const browser = await getBrowser({ graphics: 'auto' });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
  try {
    const page = await context.newPage();
    await mount(page);
    const before = await row(page);
    const slot = await motion(page);
    await slot.locator('[data-design-token-property]').selectOption('__transition');
    await slot.locator('[data-token-choose]').click();
    const chooser = slot.locator('[data-token-options] select');
    for (const [path, reason] of [['verification.delayed', /cannot apply a delay.*zero delay/i], ['verification.short', /outside this field range/i], ['verification.badCurve', /four finite controls.*x controls/i]] as const) {
      await chooser.selectOption(path);
      assert.equal(await slot.locator('[data-token-link]').isDisabled(), true);
      assert.match(await slot.locator('[data-token-message]').innerText(), reason);
      assert.match(await chooser.locator(`option[value="${path}"]`).innerText(), /Incompatible/);
      assert.equal((await row(page)).enterMs, 400);
    }
    await chooser.selectOption('verification.enter');
    assert.equal(await slot.locator('[data-token-link]').isDisabled(), false);
    assert.equal((await row(page)).enterMs, 400, 'choosing does not apply');
    await slot.locator('[data-token-link]').click();
    await values(page, 750);
    const linked = await row(page);
    const links = JSON.parse(String(linked.tokenLinks));
    assert.equal(links.enterMs.adapter, 'transition.duration-ms');
    assert.equal(links.enterEase.adapter, 'transition.timingFunction');
    for (const key of ['start', 'dur', 'enter', 'exit', 'exitMs', 'exitEase', 'build', 'lane']) assert.equal(linked[key], before[key], key);
    const element = page.locator('#tool-canvas [data-box-id="a"]').first();
    assert.equal(await element.getAttribute('data-t-enter-ms'), '750');
    assert.equal(await element.getAttribute('data-t-enter-ease'), linear);
    const bundled = await build({ stdin: { contents: `import { applySequenceTime, restoreSequenceTime } from './shells/web/src/bridge/sequence-dom.ts';
      globalThis.__tokenTransitionPose = (curve) => {
        const root = document.getElementById('tool-canvas'), box = root.querySelector('[data-box-id="a"]');
        const original = box.getAttribute('data-t-enter-ease');
        if (curve === null) box.removeAttribute('data-t-enter-ease'); else box.setAttribute('data-t-enter-ease', curve);
        try { applySequenceTime(root, 187.5); return { transform: box.style.transform, opacity: box.style.opacity }; }
        finally { restoreSequenceTime(root); if (original === null) box.removeAttribute('data-t-enter-ease'); else box.setAttribute('data-t-enter-ease', original); }
      };`, resolveDir: resolve(import.meta.dirname, '..'), loader: 'ts' }, bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022', logLevel: 'silent' });
    await page.addScriptTag({ content: bundled.outputFiles[0]!.text });
    const poses = await page.evaluate(curve => {
      const sample = (window as unknown as { __tokenTransitionPose(curve: string | null): { transform: string; opacity: string } }).__tokenTransitionPose;
      return { linked: sample(curve), linear: sample('linear'), bare: sample(null) };
    }, linear);
    assert.equal(poses.linked.transform, poses.linear.transform);
    assert.notEqual(poses.linked.transform, poses.bare.transform);
    assert.equal(poses.linked.opacity, poses.bare.opacity, 'easing governs geometry only');
    await page.locator('[data-topbar="undo"]').click();
    await values(page, 400, '');
    await page.locator('[data-topbar="redo"]').click();
    await values(page, 750);
    await slot.locator('[data-token-custom]').click();
    await customState(page, true, true);
    const custom = JSON.parse(String((await row(page)).tokenLinks));
    assert.ok(custom.enterMs.custom && custom.enterEase.custom);
    await slot.locator('[data-token-restore]').click();
    await customState(page, false, false);
    await values(page, 750);
    const restored = JSON.parse(String((await row(page)).tokenLinks));
    assert.ok(!restored.enterMs.custom && !restored.enterEase.custom);
    await page.locator('[data-topbar="undo"]').click();
    await customState(page, true, true);
    assert.ok(JSON.parse(String((await row(page)).tokenLinks)).enterMs.custom);
    await page.locator('[data-topbar="redo"]').click();
    await customState(page, false, false);
    await settleEditor(page, 30_000);
    const saved = page.url();
    await page.goto(saved);
    await page.waitForFunction(() => !!(document.getElementById('tool-canvas') as CanvasCommitEl)?.__lollyModel);
    await page.locator('dialog.view-loading[open]').waitFor({ state: 'hidden' });
    await values(page, 750);
    assert.equal(JSON.parse(String((await row(page)).tokenLinks)).enterMs.ref, '{verification.enter}');
  } finally { await context.close(); await closeBrowser(); }
});

test('invalid transition theme updates keep both caches and preserve a custom duration', { skip, timeout: 180_000 }, async () => {
  const browser = await getBrowser({ graphics: 'auto' });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
  try {
    const page = await context.newPage();
    await mount(page);
    await link(page);
    await theme(page, 'Dark');
    await values(page, 750);
    const held = JSON.parse(String((await row(page)).tokenLinks));
    assert.equal(held.enterMs.status, 'incompatible');
    assert.equal(held.enterEase.status, 'incompatible');
    assert.match(held.enterMs.reason, /four finite controls/);
    assert.equal(held.enterMs.reason, held.enterEase.reason);
    await theme(page, 'Light');
    const slot = await motion(page);
    const duration = page.locator('input[data-nf="f:enterMs"]');
    await duration.fill('0.9');
    await duration.press('Enter');
    await values(page, 900);
    assert.ok(JSON.parse(String((await row(page)).tokenLinks)).enterMs.custom);
    await theme(page, 'Dark');
    await values(page, 900);
    const customHeld = JSON.parse(String((await row(page)).tokenLinks));
    assert.ok(customHeld.enterMs.custom);
    assert.equal(customHeld.enterEase.status, 'incompatible');
    await theme(page, 'Light');
    await values(page, 900);
    await motion(page);
    await slot.locator('[data-design-token-property]').selectOption('__transition');
    await slot.locator('[data-token-restore]').click();
    await values(page, 750);
    await page.locator('[data-topbar="undo"]').click();
    await values(page, 900);
    const links = JSON.parse(String((await row(page)).tokenLinks));
    assert.ok(links.enterMs.custom);
    assert.ok(!links.enterEase.custom);
  } finally { await context.close(); await closeBrowser(); }
});

test('phone transition controls reject delayed refresh and cancel captured frame or multiple selections', { skip, timeout: 180_000 }, async () => {
  const browser = await getBrowser({ graphics: 'auto' });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await mount(page, false);
    await page.evaluate(() => {
      Object.assign(document.documentElement.dataset, { theme: 'dark', a11yText: 'large', a11yContrast: 'high', a11yMotion: 'reduce' });
      document.documentElement.dir = 'rtl';
    });
    const slot = await motion(page);
    await slot.locator('[data-design-token-property]').selectOption('__transition');
    await slot.locator('[data-token-choose]').click();
    await slot.locator('[data-token-options] select').selectOption('verification.enter');
    const button = slot.locator('[data-token-link]');
    assert.ok((await button.boundingBox())!.height >= 44);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (process.env.LOLLY_TRANSITION_EVIDENCE) await page.screenshot({ path: process.env.LOLLY_TRANSITION_EVIDENCE, fullPage: true });
    await button.focus();
    await page.keyboard.press('Enter');
    await values(page, 750);
    await theme(page, 'Dark');
    await values(page, 750);
    const held = JSON.parse(String((await row(page)).tokenLinks));
    assert.equal(held.enterMs.status, 'incompatible');
    assert.equal(held.enterEase.status, 'incompatible');
    assert.match(held.enterMs.reason, /cannot apply a delay.*zero delay/);
    await theme(page, 'Light');
    await motion(page);
    await slot.locator('[data-token-choose]').click();
    await slot.locator('[data-token-options] select').selectOption('verification.enter');
    await holdFinalTokenRead(page);
    await slot.locator('[data-token-link]').click();
    await page.waitForFunction(() => (window as unknown as { __transitionRead: { started: boolean } }).__transitionRead.started);
    await select(page, ['b']);
    await releaseTokenRead(page);
    assert.equal((await row(page, 'b')).enterMs, 500);
    assert.equal(await slot.locator('[data-token-link]').isVisible(), false);
    await select(page, ['frame']);
    assert.equal(await slot.locator('option[value="__transition"]').count(), 0);
    await select(page, ['a', 'b']);
    const multi = page.locator('[data-token-section="motion"]');
    assert.equal(await multi.locator('option[value="__transition"]').count(), 0);
    await values(page, 750);
    assert.equal((await row(page, 'b')).enterMs, 500);
  } finally { await context.close(); await closeBrowser(); }
});

test('closing a floating or phone inspector cancels pending Restore across selection changes and permits reopening', { skip, timeout: 180_000 }, async () => {
  const browser = await getBrowser({ graphics: 'auto' });
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width, height: width === 390 ? 844 : 1000 }, hasTouch: width === 390 });
      try {
        await context.addInitScript(() => {
          if (location.protocol === 'http:') localStorage.setItem('lolly:designInspectorFloat', JSON.stringify({ mode: 'floating' }));
        });
        const page = await context.newPage();
        await mount(page);
        const slot = await link(page);
        const duration = page.locator('input[data-nf="f:enterMs"]');
        await duration.fill('0.9');
        await duration.press('Enter');
        await values(page, 900);
        await customState(page, true, false);
        await motion(page);
        await slot.locator('[data-design-token-property]').selectOption('__transition');
        const beforeA = await row(page);
        const beforeB = await row(page, 'b');
        const inspector = page.locator('.fc-insp');
        assert.equal(await inspector.evaluate(el => el.classList.contains('is-compact-sheet')), width === 390);
        if (width === 1440) assert.equal(await inspector.evaluate(el => el.classList.contains('is-floating')), true);
        const captured = await inspector.elementHandle();
        assert.ok(captured);
        await holdFinalTokenRead(page);
        await slot.locator('[data-token-restore]').click();
        await page.waitForFunction(() => (window as unknown as { __transitionRead: { started: boolean } }).__transitionRead.started);
        await page.getByRole('button', { name: 'Hide inspector', exact: true }).click();
        assert.equal(await captured.evaluate(el => !el.isConnected || (el as HTMLElement).hidden), true);
        await select(page, ['b']);
        await releaseTokenRead(page);
        assert.deepEqual(await row(page), beforeA, `${width}: original layer and cached link metadata stay unchanged`);
        assert.deepEqual(await row(page, 'b'), beforeB, `${width}: new selection receives no stale write`);
        const reopened = await motion(page);
        await reopened.locator('[data-design-token-property]').selectOption('__transition');
        await reopened.locator('[data-token-choose]').click();
        await reopened.locator('[data-token-options] select').selectOption('verification.enter');
        assert.equal(await reopened.locator('[data-token-link]').isEnabled(), true);
        await reopened.locator('[data-token-link]').click();
        await page.waitForFunction(curve => {
          const value = ((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(input => input.id === 'boxes')!.value as Array<Record<string, unknown>>).find(value => value.id === 'b');
          return value?.enterMs === 750 && value?.enterEase === curve;
        }, linear);
        const restored = JSON.parse(String((await row(page, 'b')).tokenLinks));
        assert.equal(restored.enterMs.adapter, 'transition.duration-ms');
        assert.equal(restored.enterEase.adapter, 'transition.timingFunction');
        assert.ok(!restored.enterMs.custom && !restored.enterEase.custom);
        assert.deepEqual(await row(page), beforeA, `${width}: reopened controls apply only to the new layer`);
      } finally { await context.close(); }
    }
  } finally { await closeBrowser(); }
});
