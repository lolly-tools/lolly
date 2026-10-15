// SPDX-License-Identifier: MPL-2.0
/**
 * Selection transforms in a real Chromium (plan 311): the grab zones round a selection,
 * the cursors they show and hold, the small-object handles, Scale mode, a layout
 * container under Scale, the large touch zones and their wash, two-finger gestures, the
 * shortcut sheet and the rail. jsdom has no CSS hit areas, cursors, pointer capture or
 * touch, so these run against a served shell with real mouse events (page.mouse) and
 * real touch points through CDP (Input.dispatchTouchEvent).
 *
 * Every drag reads the authored rows back from the canvas model, and every committed
 * transform is undone with one Ctrl/Cmd+Z, which must restore the rows exactly. The
 * checks that judge a look (the handles in each theme, the rail, the sheet) save a
 * screenshot to LOLLY_DESIGN_SHOT_DIR, or the OS temp folder.
 */
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';
import type { Browser, BrowserContext, CDPSession, Page } from 'playwright';
import type { CanvasCommitEl } from '../shells/web/src/lib/canvas-commit.ts';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';
import { shellSettled } from './helpers/shell-settled.ts';

const origin = process.env.LOLLY_DESIGN_TEST_URL ?? process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'Serve the web shell and set LOLLY_DESIGN_TEST_URL (or LOLLY_EXPORT_TEST_URL).';
const opts = { skip, timeout: 180_000 } as const;

type Row = Record<string, unknown>;
interface Box { x: number; y: number; w: number; h: number }
interface Pt { x: number; y: number }
interface OpenOpts {
  width?: number;
  height?: number;
  colorScheme?: 'light' | 'dark';
  reducedMotion?: 'reduce' | 'no-preference';
  hasTouch?: boolean;
  sel?: string;
  lang?: string;
}

/** The artboard is 880 x 720 so a 1280 x 800 stage shows it near 0.77, which puts a
 *  30 px box under the 25 screen px small-object rule and an 8 px box under 10. */
const CANVAS = { width: '880', height: '720' };

async function launch(): Promise<Browser> {
  return chromium.launch({ headless: true, args: webGpuLaunchArgs('software') });
}

async function open(browser: Browser, rows: Row[], o: OpenOpts = {}): Promise<{ ctx: BrowserContext; page: Page; errors: string[] }> {
  const ctx = await browser.newContext({
    viewport: { width: o.width ?? 1280, height: o.height ?? 800 },
    colorScheme: o.colorScheme ?? 'light',
    reducedMotion: o.reducedMotion ?? 'no-preference',
    hasTouch: o.hasTouch ?? false,
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const params = new URLSearchParams({
    boxes: JSON.stringify(rows), c2pa: '0', imprint: '0', ...CANVAS,
    ...(o.sel ? { _sel: o.sel } : {}), ...(o.lang ? { lang: o.lang } : {}),
  });
  await page.goto(`${origin}/t/design?${params}`, { waitUntil: 'networkidle' });
  await shellSettled(page);
  const first = rows.find((r) => r.kind !== 'frame');
  await page.locator(`#tool-canvas [data-box-id="${String(first?.id)}"]`).waitFor();
  return { ctx, page, errors };
}

async function boxes(page: Page): Promise<Row[]> {
  return page.evaluate(() => {
    const model = (document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!();
    return structuredClone(model.find((input) => input.id === 'boxes')!.value as Row[]);
  });
}
async function row(page: Page, id: string): Promise<Row> {
  const found = (await boxes(page)).find((r) => r.id === id);
  assert.ok(found, `row ${id} exists`);
  return found;
}
const num = (r: Row, f: string): number => Number(r[f] ?? 0);
function near(actual: number, expected: number, tol: number, what: string): void {
  assert.ok(Math.abs(actual - expected) <= tol, `${what}: ${actual} is within ${tol} of ${expected}`);
}

async function rect(page: Page, id: string): Promise<Box> {
  return page.locator(`#tool-canvas [data-box-id="${id}"]`).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
}
/** Screen px per native px of the artboard. */
async function stageScale(page: Page): Promise<number> {
  return page.evaluate((w) => document.getElementById('tool-canvas')!.getBoundingClientRect().width / w, Number(CANVAS.width));
}
async function frames(page: Page, n = 2): Promise<void> {
  await page.evaluate((n) => new Promise<void>((resolve) => {
    let left = n;
    const step = (): void => { if (--left <= 0) resolve(); else requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), n);
}

/** Select a row the way a person does, and leave keyboard focus on the canvas: pick
 *  its navigator row, then click the box itself without travel. */
async function pick(page: Page, id: string): Promise<void> {
  await page.locator(`.fc-nav-layer[data-id="${id}"]`).click();
  const r = await rect(page, id);
  await page.mouse.click(r.x + r.w / 2, r.y + r.h / 2);
  await frames(page);
}
async function pickMany(page: Page, ids: string[]): Promise<void> {
  await pick(page, ids[0]!);
  for (const id of ids.slice(1)) {
    const r = await rect(page, id);
    await page.keyboard.down('Shift');
    await page.mouse.click(r.x + r.w / 2, r.y + r.h / 2);
    await page.keyboard.up('Shift');
  }
  await frames(page);
}
async function undoTo(page: Page, before: Row[]): Promise<void> {
  await page.keyboard.press('ControlOrMeta+z');
  await page.waitForFunction((want) => {
    const model = (document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!();
    return JSON.stringify(model.find((input) => input.id === 'boxes')!.value) === want;
  }, JSON.stringify(before));
}

interface CursorState { attr: string | null; scale: boolean; held: boolean; under: string; underCursor: string; wash: string | null }
async function cursorAt(page: Page, x: number, y: number): Promise<CursorState> {
  return page.evaluate(([x, y]) => {
    const stage = document.querySelector<HTMLElement>('.tool-stage')!;
    const el = document.elementFromPoint(x!, y!);
    return {
      attr: stage.dataset.fcCursor ?? null,
      scale: stage.hasAttribute('data-fc-cursor-scale'),
      held: stage.hasAttribute('data-fc-cursor-held'),
      under: el ? String(el.getAttribute('class') ?? el.tagName) : '',
      underCursor: el ? getComputedStyle(el).cursor : '',
      wash: document.querySelector('.fc-zone')?.getAttribute('data-zone') ?? null,
    };
  }, [x, y]);
}
async function hover(page: Page, p: Pt): Promise<CursorState> {
  await page.mouse.move(p.x, p.y);
  await frames(page);
  return cursorAt(page, p.x, p.y);
}

/** Press at `p`, travel `d` in steps, and release, with the cursor and label read at
 *  three quarters of the way. */
async function drag(page: Page, p: Pt, d: Pt, mods: string[] = []): Promise<CursorState & { label: string | null }> {
  await page.mouse.move(p.x, p.y);
  await frames(page, 1);
  for (const m of mods) await page.keyboard.down(m);
  await page.mouse.down();
  await page.mouse.move(p.x + d.x / 2, p.y + d.y / 2, { steps: 4 });
  const q = { x: p.x + d.x * 0.75, y: p.y + d.y * 0.75 };
  await page.mouse.move(q.x, q.y, { steps: 2 });
  await frames(page, 1);
  const mid = await cursorAt(page, q.x, q.y);
  const label = await page.evaluate(() => {
    const l = document.querySelector<HTMLElement>('.fc-xform-label');
    return l?.getClientRects().length ? l.textContent : null;
  });
  await page.mouse.move(p.x + d.x, p.y + d.y, { steps: 4 });
  await page.mouse.up();
  for (const m of mods) await page.keyboard.up(m);
  await frames(page);
  return { ...mid, label };
}

// ── Touch through CDP ────────────────────────────────────────────────────────

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
/** Where a check keeps its screenshot: LOLLY_DESIGN_SHOT_DIR when set, else the OS temp folder. */
const shotPath = (name: string): string => join(process.env.LOLLY_DESIGN_SHOT_DIR ?? tmpdir(), `design-transform-${name}.png`);
type TouchType = 'touchStart' | 'touchMove' | 'touchEnd';
async function touch(client: CDPSession, type: TouchType, points: Array<Pt & { id: number }>): Promise<void> {
  await client.send('Input.dispatchTouchEvent', { type, touchPoints: points });
}
async function touchDrag(client: CDPSession, p: Pt, d: Pt, steps = 8): Promise<void> {
  await touch(client, 'touchStart', [{ ...p, id: 1 }]);
  await sleep(30);
  for (let i = 1; i <= steps; i++) {
    await touch(client, 'touchMove', [{ x: p.x + (d.x * i) / steps, y: p.y + (d.y * i) / steps, id: 1 }]);
    await sleep(16);
  }
  await touch(client, 'touchEnd', []);
  await sleep(150);
}
/** Two fingers: `a` touches down, `b` touches down 40 ms later, and each travels by its own delta. */
async function pinch(client: CDPSession, a: Pt, b: Pt, da: Pt, db: Pt, steps = 10): Promise<void> {
  await touch(client, 'touchStart', [{ ...a, id: 1 }]);
  await sleep(40);
  await touch(client, 'touchStart', [{ ...a, id: 1 }, { ...b, id: 2 }]);
  await sleep(30);
  for (let i = 1; i <= steps; i++) {
    const f = i / steps;
    await touch(client, 'touchMove', [
      { x: a.x + da.x * f, y: a.y + da.y * f, id: 1 },
      { x: b.x + db.x * f, y: b.y + db.y * f, id: 2 },
    ]);
    await sleep(16);
  }
  await touch(client, 'touchEnd', [{ x: a.x + da.x, y: a.y + da.y, id: 1 }]);
  await sleep(30);
  await touch(client, 'touchEnd', []);
  await sleep(200);
}

// ── Mouse zones ──────────────────────────────────────────────────────────────

test('mouse zones on a 200x120 box: strips on both sides of the outline, corners, rotate zones and a held cursor', opts, async () => {
  const browser = await launch();
  try {
    const { page, errors } = await open(browser, [{ id: 'big', kind: 'box', x: 100, y: 100, w: 200, h: 120, bg: '#88c4a0' }]);
    const s = await stageScale(page);
    await pick(page, 'big');
    const r = await rect(page, 'big');
    const L = r.x, T = r.y, R = r.x + r.w, B = r.y + r.h;
    const cases: Array<{ name: string; at: Pt; d: Pt; cursor: string | null; check: (b: Row) => void }> = [
      { name: 'east strip outside', at: { x: R + 3, y: T + 22 }, d: { x: 40, y: 0 }, cursor: 'ew-resize',
        check: (b) => { near(num(b, 'w'), 200 + 40 / s, 2, 'width'); assert.equal(num(b, 'x'), 100); assert.equal(num(b, 'h'), 120); } },
      { name: 'east strip inside', at: { x: R - 3, y: T + 22 }, d: { x: 40, y: 0 }, cursor: 'ew-resize',
        check: (b) => { near(num(b, 'w'), 200 + 40 / s, 2, 'width'); assert.equal(num(b, 'h'), 120); } },
      { name: 'north strip outside', at: { x: L + 40, y: T - 3 }, d: { x: 0, y: -30 }, cursor: 'ns-resize',
        check: (b) => { near(num(b, 'h'), 120 + 30 / s, 2, 'height'); near(num(b, 'y'), 100 - 30 / s, 2, 'top'); assert.equal(num(b, 'w'), 200); } },
      { name: 'north-west corner zone', at: { x: L + 8, y: T + 8 }, d: { x: -20, y: -20 }, cursor: 'nwse-resize',
        check: (b) => { near(num(b, 'w'), 200 + 20 / s, 2, 'width'); near(num(b, 'h'), 120 + 20 / s, 2, 'height'); } },
      { name: 'north-east rotate zone', at: { x: R + 12, y: T - 12 }, d: { x: 30, y: 40 }, cursor: 'rotate-ne',
        check: (b) => { assert.ok(Math.abs(num(b, 'rot')) > 5, `turned by ${num(b, 'rot')}`); assert.equal(num(b, 'w'), 200); } },
      { name: 'interior', at: { x: (L + R) / 2 + 20, y: (T + B) / 2 + 10 }, d: { x: 30, y: 20 }, cursor: null,
        check: (b) => { assert.notEqual(num(b, 'x'), 100); assert.equal(num(b, 'w'), 200); assert.equal(num(b, 'h'), 120); } },
    ];
    for (const c of cases) {
      await pick(page, 'big');
      const before = await boxes(page);
      const over = await hover(page, c.at);
      assert.equal(over.attr, c.cursor, `${c.name}: hover cursor`);
      if (c.cursor) {
        assert.doesNotMatch(over.under, /fc-handle/, `${c.name}: the zone is geometry, not a handle element`);
        assert.ok(over.underCursor.includes(c.cursor.startsWith('rotate') ? 'url(' : c.cursor), `${c.name}: the element under the pointer shows ${c.cursor}, got ${over.underCursor}`);
      }
      const mid = await drag(page, c.at, c.d);
      if (c.cursor) {
        assert.equal(mid.attr, c.cursor, `${c.name}: the drag holds its cursor`);
        assert.equal(mid.held, true, `${c.name}: the held flag is set during the drag`);
        assert.ok(mid.underCursor.includes(c.cursor.startsWith('rotate') ? 'url(' : c.cursor), `${c.name}: held cursor ${mid.underCursor}`);
      }
      if (c.cursor && !c.cursor.startsWith('rotate')) assert.match(mid.label ?? '', /^\d+×\d+$/, `${c.name}: the size label shows during the drag`);
      c.check(await row(page, 'big'));
      assert.equal((await cursorAt(page, 0, 0)).held, false, `${c.name}: the held cursor ends with the drag`);
      await undoTo(page, before);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('over a background shape a press just outside a corner resizes the selected box, as the corner handle always did', opts, async () => {
  const browser = await launch();
  try {
    const { page, errors } = await open(browser, [
      { id: 'bg', kind: 'box', x: 0, y: 0, w: 880, h: 720, bg: '#e8e8e8' },
      { id: 'big', kind: 'box', x: 100, y: 100, w: 200, h: 120, bg: '#88c4a0' },
    ]);
    const s = await stageScale(page);
    await pick(page, 'big');
    const r = await rect(page, 'big');
    // 9 screen px out on the se diagonal: past the 12 px handle square, over the background.
    const at = { x: r.x + r.w + 9, y: r.y + r.h + 9 };
    const over = await hover(page, at);
    assert.equal(over.attr, 'nwse-resize', 'the corner cursor shows over the background');
    const before = await boxes(page);
    await drag(page, at, { x: 30, y: 30 });
    const b = await row(page, 'big');
    near(num(b, 'w'), 200 + 30 / s, 2, 'the corner resized the width');
    near(num(b, 'h'), 120 + 30 / s, 2, 'and the height');
    assert.deepEqual(await row(page, 'bg'), before.find((x) => x.id === 'bg'), 'the background stayed');
    await undoTo(page, before);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('a turned box: zone cursors follow the turn and an edge strip drags its own axis', opts, async () => {
  const browser = await launch();
  try {
    const { page, errors } = await open(browser, [{ id: 'rot', kind: 'box', x: 300, y: 250, w: 200, h: 120, rot: 30, bg: '#d0b040' }]);
    const s = await stageScale(page);
    await pick(page, 'rot');
    const a = await rect(page, 'rot');
    const c = { x: a.x + a.w / 2, y: a.y + a.h / 2 }, hw = (200 * s) / 2, hh = (120 * s) / 2, th = Math.PI / 6;
    const at = (lx: number, ly: number): Pt => ({ x: c.x + lx * Math.cos(th) - ly * Math.sin(th), y: c.y + lx * Math.sin(th) + ly * Math.cos(th) });
    const dir = (lx: number, ly: number, k: number): Pt => ({ x: (lx * Math.cos(th) - ly * Math.sin(th)) * k, y: (lx * Math.sin(th) + ly * Math.cos(th)) * k });
    const handles = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll<HTMLElement>('.fc-chrome .fc-handle[data-fc-dir]')]
      .map((h) => [h.className.match(/fc-h-(\w+)/)?.[1], h.dataset.fcDir])));
    assert.deepEqual([handles.n, handles.e, handles.ne, handles.nw], ['nesw-resize', 'nwse-resize', 'ew-resize', 'ns-resize'], 'handle cursors turn with the box');
    assert.equal((await hover(page, at(hw + 3, -20))).attr, 'nwse-resize', 'east strip on a 30 degree turn');
    assert.equal((await hover(page, at(-30, -hh - 3))).attr, 'nesw-resize', 'north strip on a 30 degree turn');
    assert.equal((await hover(page, at(hw + 14, -hh - 14))).attr, 'rotate-ne', 'rotate zone past the turned corner');
    const before = await boxes(page);
    await drag(page, at(hw - 3, 20), dir(1, 0, 40));
    const b = await row(page, 'rot');
    near(num(b, 'w'), 200 + 40 / s, 2, 'width along the turned axis');
    assert.equal(num(b, 'h'), 120);
    assert.equal(num(b, 'rot'), 30);
    await undoTo(page, before);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('small objects: handles stand off or drop, strips sit outside, the inside moves, and the rotate handle clears the s handle', opts, async () => {
  const browser = await launch();
  try {
    const { page, errors } = await open(browser, [
      { id: 'sq', kind: 'box', x: 400, y: 100, w: 30, h: 30, bg: '#c49088' },
      { id: 'tiny', kind: 'box', x: 600, y: 100, w: 8, h: 8, bg: '#4060c0' },
      { id: 'rule', kind: 'box', x: 100, y: 400, w: 400, h: 2, bg: '#202020' },
      { id: 'big', kind: 'box', x: 100, y: 100, w: 200, h: 120, bg: '#88c4a0' },
      { id: 'txt', kind: 'text', x: 100, y: 520, w: 300, h: 80, text: 'Hello', fontSize: 40, fg: '#111111' },
    ]);
    const s = await stageScale(page);
    const shown = (): Promise<Record<string, boolean>> => page.evaluate(() => Object.fromEntries([...document.querySelectorAll<HTMLElement>('.fc-chrome .fc-handle')]
      .map((h) => [h.className.match(/fc-h-(\w+)/)?.[1], getComputedStyle(h).display !== 'none' && !h.hidden])));
    const outward = (): Promise<string[]> => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.fc-chrome .fc-handle[data-outward]')]
      .map((h) => h.className.match(/fc-h-(\w+)/)?.[1] ?? ''));

    // 30 x 30 native is about 23 screen px: no edge midpoints, corners stood off.
    await pick(page, 'sq');
    let vis = await shown();
    assert.deepEqual(['n', 'e', 's', 'w'].map((h) => vis[h]), [false, false, false, false], 'a small box hides its edge midpoints');
    assert.deepEqual((await outward()).sort(), ['ne', 'nw', 'se', 'sw'], 'its corners stand off the outline');
    let r = await rect(page, 'sq');
    let before = await boxes(page);
    assert.equal((await hover(page, { x: r.x + r.w + 4, y: r.y + r.h / 2 })).attr, 'ew-resize', 'a strip sits outside a small box');
    await drag(page, { x: r.x + r.w + 4, y: r.y + r.h / 2 }, { x: 20, y: 0 });
    near(num(await row(page, 'sq'), 'w'), 30 + 20 / s, 2, 'small box width');
    await undoTo(page, before);
    await pick(page, 'sq');
    await drag(page, { x: r.x + r.w / 2, y: r.y + r.h / 2 }, { x: 25, y: 15 });
    assert.equal(num(await row(page, 'sq'), 'w'), 30, 'the inside of a small box moves it');
    assert.notEqual(num(await row(page, 'sq'), 'x'), 400);
    await undoTo(page, before);

    // 8 x 8 native is about 6 screen px: corners drop, the four midpoints stand off.
    await pick(page, 'tiny');
    vis = await shown();
    assert.deepEqual(['nw', 'ne', 'se', 'sw'].map((h) => vis[h]), [false, false, false, false], 'a tiny box drops its corners');
    assert.deepEqual((await outward()).sort(), ['e', 'n', 's', 'w'], 'its midpoints stand off the outline');
    r = await rect(page, 'tiny');
    before = await boxes(page);
    await drag(page, { x: r.x + r.w / 2, y: r.y + r.h / 2 }, { x: 25, y: 15 });
    assert.equal(num(await row(page, 'tiny'), 'w'), 8, 'a tiny box moves from its middle');
    assert.notEqual(num(await row(page, 'tiny'), 'x'), 600);
    await undoTo(page, before);

    // A 400 x 2 rule: the line itself moves, the strip above resizes its thickness.
    await pick(page, 'rule');
    r = await rect(page, 'rule');
    before = await boxes(page);
    await drag(page, { x: r.x + r.w / 3, y: r.y + r.h / 2 }, { x: 20, y: 30 });
    assert.equal(num(await row(page, 'rule'), 'h'), 2, 'pressing on the rule moves the rule');
    assert.notEqual(num(await row(page, 'rule'), 'y'), 400);
    await undoTo(page, before);
    await pick(page, 'rule');
    assert.equal((await hover(page, { x: r.x + r.w / 3, y: r.y + r.h / 2 - 8 })).attr, 'ns-resize');
    await drag(page, { x: r.x + r.w / 3, y: r.y + r.h / 2 - 8 }, { x: 0, y: -20 });
    near(num(await row(page, 'rule'), 'h'), 2 + 20 / s, 2, 'rule thickness');
    await undoTo(page, before);

    // The rotate handle hangs clear of the s handle on every size.
    for (const id of ['big', 'sq', 'tiny', 'rule', 'txt']) {
      await pick(page, id);
      const gap = await page.evaluate(() => {
        const sh = document.querySelector<HTMLElement>('.fc-chrome .fc-h-s')!;
        const rot = document.querySelector<HTMLElement>('.fc-chrome .fc-h-rotate')!;
        const rr = rot.getBoundingClientRect(), sr = sh.getBoundingClientRect();
        const x = rr.x + rr.width / 2;
        const seen: string[] = [];
        for (let y = Math.floor(rr.y) - 40; y <= rr.bottom; y++) {
          const el = document.elementFromPoint(x, y);
          const name = el?.classList.contains('fc-h-rotate') ? 'rotate' : el?.classList.contains('fc-h-s') ? 's' : 'other';
          if (seen[seen.length - 1] !== name) seen.push(name);
        }
        return { seen: seen.join(','), sShown: getComputedStyle(sh).display !== 'none', sBottom: sr.bottom, rotTop: rr.top };
      });
      assert.match(gap.seen, /rotate/, `${id}: the rotate handle takes a press`);
      assert.doesNotMatch(gap.seen, /s,rotate/, `${id}: no point passes straight from the s handle to the rotate handle (${gap.seen})`);
      if (gap.sShown) assert.ok(gap.rotTop > gap.sBottom, `${id}: the rotate handle sits below the s handle`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('a multi-selection: eight handles, an edge strip resizes the set on one axis, Alt works from the centre', opts, async () => {
  const browser = await launch();
  try {
    const { page, errors } = await open(browser, [
      { id: 'big', kind: 'box', x: 100, y: 100, w: 200, h: 120, bg: '#88c4a0' },
      { id: 'sq', kind: 'box', x: 400, y: 100, w: 30, h: 30, bg: '#c49088' },
      { id: 'rule', kind: 'box', x: 100, y: 400, w: 400, h: 2, bg: '#202020' },
    ]);
    const ids = ['big', 'sq', 'rule'];
    await pickMany(page, ids);
    const hp = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll<HTMLElement>('.fc-chrome .fc-handle')]
      .filter((h) => getComputedStyle(h).display !== 'none')
      .map((h) => { const r = h.getBoundingClientRect(); return [h.className.match(/fc-h-(\w+)/)?.[1], { x: r.x + r.width / 2, y: r.y + r.height / 2 }]; })));
    assert.deepEqual(Object.keys(hp).sort(), ['e', 'n', 'ne', 'nw', 'rotate', 's', 'se', 'sw', 'w'], 'a set gets edge handles as well as corners');
    const T = hp.nw!.y, R = hp.se!.x;
    const before = await boxes(page);
    assert.equal((await hover(page, { x: R + 3, y: T + 40 })).attr, 'ew-resize');
    await drag(page, { x: R + 3, y: T + 40 }, { x: 40, y: 0 });
    const after = await boxes(page);
    const sx = (id: string): number => num(after.find((b) => b.id === id)!, 'w') / num(before.find((b) => b.id === id)!, 'w');
    near(sx('big'), sx('rule'), 0.02, 'every member widens by the same factor');
    assert.ok(sx('big') > 1.05, 'the set widened');
    assert.equal(num(after.find((b) => b.id === 'big')!, 'h'), 120, 'an east strip leaves the height alone');
    assert.equal(num(after.find((b) => b.id === 'big')!, 'x'), 100, 'the west edge holds still');
    await undoTo(page, before);
    await pickMany(page, ids);
    await drag(page, { x: R + 3, y: T + 40 }, { x: 40, y: 0 }, ['Alt']);
    assert.ok(num(await row(page, 'big'), 'x') < 100, 'with Alt the west edge moves out as well');
    await undoTo(page, before);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

// ── Scale mode ───────────────────────────────────────────────────────────────

test('Scale mode: K, a Scale drag scales the text size, one undo step, the popover, and Escape', opts, async () => {
  const browser = await launch();
  try {
    const { page, errors } = await open(browser, [
      { id: 'txt', kind: 'text', x: 100, y: 300, w: 300, h: 80, text: 'Hello scale', fontSize: 40, fg: '#111111', strokeW: 2, stroke: '#ff0000', pad: 10, tracking: 2 },
      { id: 'big', kind: 'box', x: 100, y: 100, w: 200, h: 120, bg: '#88c4a0', shape: 'rounded', radius: 12, strokeW: 4, stroke: '#000000', shadow: 'box', shadowX: 4, shadowY: 6, shadowBlur: 10 },
    ]);
    // Scale shares the pointer's rail slot, which shows the Scale icon while Scale is on.
    const state = (): Promise<{ pressed: string | null; scale: boolean }> => page.evaluate(() => ({
      pressed: document.querySelector('.fc-btn-pointer')?.getAttribute('data-variant') === 'scale' ? 'true' : 'false',
      scale: !!document.querySelector('.fc-chrome')?.hasAttribute('data-scale'),
    }));
    await pick(page, 'txt');
    assert.deepEqual(await state(), { pressed: 'false', scale: false });
    await page.keyboard.press('k');
    await frames(page);
    assert.deepEqual(await state(), { pressed: 'true', scale: true }, 'K turns Scale mode on');
    let r = await rect(page, 'txt');
    const corner = await hover(page, { x: r.x + r.w - 7, y: r.y + r.h - 7 });
    assert.equal(corner.attr, 'nwse-resize');
    assert.equal(corner.scale, true, 'a zone in Scale mode shows the scale cursor');
    assert.match(corner.underCursor, /url\(/, 'the scale cursor is the drawn double arrow');

    let before = await boxes(page);
    const mid = await drag(page, { x: r.x + r.w, y: r.y + r.h }, { x: r.w * 0.5, y: r.h * 0.5 });
    assert.match(mid.label ?? '', /^Scale \d+%$/, 'the label reads Scale NN% during the drag');
    assert.match(mid.underCursor, /url\(/, 'the drag holds the scale cursor');
    let t = await row(page, 'txt');
    const k = num(t, 'w') / 300;
    near(k, 1.5, 0.03, 'scale factor');
    near(num(t, 'fontSize'), 40 * k, 0.6, 'font size scales');
    near(num(t, 'strokeW'), 2 * k, 0.2, 'stroke scales');
    near(num(t, 'pad'), 10 * k, 0.2, 'padding scales');
    near(num(t, 'tracking'), 2 * k, 0.2, 'tracking scales');
    await undoTo(page, before);

    // An edge drag in Scale mode is uniform from that axis.
    await pick(page, 'txt');
    r = await rect(page, 'txt');
    await drag(page, { x: r.x + r.w + 3, y: r.y + 10 }, { x: 60, y: 0 });
    t = await row(page, 'txt');
    assert.ok(num(t, 'h') > 80 && num(t, 'fontSize') > 40, 'an edge in Scale mode scales both axes and the text');
    await undoTo(page, before);

    // A box keeps its radius, stroke and shadow in proportion.
    await pick(page, 'big');
    const br = await rect(page, 'big');
    await drag(page, { x: br.x + br.w, y: br.y + br.h }, { x: br.w * 0.5, y: br.h * 0.5 });
    const b = await row(page, 'big');
    const kb = num(b, 'w') / 200;
    near(num(b, 'radius'), 12 * kb, 0.3, 'radius');
    near(num(b, 'strokeW'), 4 * kb, 0.3, 'stroke');
    near(num(b, 'shadowBlur'), 10 * kb, 0.3, 'shadow blur');
    await undoTo(page, before);

    // The Scale popover from the object bar's readout: 50 % about the centre.
    await pick(page, 'txt');
    await page.locator('[data-cx-readout]').click();
    const panel = page.locator('.fc-scale-panel');
    await panel.waitFor();
    assert.equal(await panel.getAttribute('role'), 'dialog');
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Scale (%)', 'focus starts in the percentage field');
    // W and H follow the percentage, and the percentage follows either of them.
    assert.deepEqual([await panel.getByLabel('Width').inputValue(), await panel.getByLabel('Height').inputValue()], ['300', '80'], 'W and H start at the size');
    await panel.getByLabel('Width').fill('450');
    assert.deepEqual([await panel.getByLabel('Scale (%)').inputValue(), await panel.getByLabel('Height').inputValue()], ['150', '120'], 'a width sets the factor');
    await panel.getByLabel('Scale (%)').fill('50');
    assert.equal(await panel.getByLabel('Width').inputValue(), '150', 'and the percentage drives the width');
    await panel.getByRole('button', { name: 'Centre' }).click();
    before = await boxes(page);
    await panel.getByRole('button', { name: 'Apply' }).click();
    await panel.waitFor({ state: 'detached' });
    t = await row(page, 'txt');
    assert.deepEqual([num(t, 'x'), num(t, 'y'), num(t, 'w'), num(t, 'h'), num(t, 'fontSize')], [175, 320, 150, 40, 20], 'the popover scales about the centre');
    assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-cx-readout')), true, 'focus returns to the readout');
    await undoTo(page, before);

    // Escape leaves Scale mode before it deselects.
    await pick(page, 'txt');
    await page.keyboard.press('Escape');
    await frames(page);
    assert.equal((await state()).pressed, 'false', 'the first Escape leaves Scale mode');
    assert.ok(await page.locator('.fc-chrome .fc-handle').count() > 0, 'and keeps the selection');
    await page.keyboard.press('k');
    await page.keyboard.press('v');
    await frames(page);
    assert.equal((await state()).pressed, 'false', 'V returns to the plain pointer');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Scale on a flex layout container scales its children, spacing and text and keeps its layout', opts, async () => {
  const browser = await launch();
  try {
    const rows: Row[] = [
      { id: 'root', kind: 'frame', x: 60, y: 60, w: 400, h: 220, layout: 'flex', layoutDirection: 'row', layoutGapX: 12, layoutPadLeft: 10, layoutPadTop: 10, bg: '#eeeeee' },
      { id: 'a', kind: 'box', x: 0, y: 0, w: 80, h: 70, layoutOwner: 'root', frame: '', layoutOrder: 0, bg: '#c0d6fd', shape: 'rounded', radius: 10, strokeW: 2, stroke: '#333333' },
      { id: 'b', kind: 'box', x: 0, y: 0, w: 80, h: 70, layoutOwner: 'root', frame: '', layoutOrder: 1, layoutW: 'fill', bg: '#aceac3' },
      { id: 't', kind: 'text', x: 0, y: 0, w: 120, h: 50, layoutOwner: 'root', frame: '', layoutOrder: 2, text: 'Flow', fontSize: 30, fg: '#111111' },
      { id: 'abs', kind: 'box', x: 300, y: 150, w: 40, h: 40, layoutOwner: 'root', frame: '', layoutAbsolute: true, layoutX: 300, layoutY: 150, bg: '#f0a0a0' },
    ];
    const { page, errors } = await open(browser, rows, { sel: 'root' });
    const handle = async (name: string): Promise<Pt> => page.locator(`.fc-chrome .fc-h-${name}`).evaluate((h) => {
      const r = h.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    const sw = await handle('sw');
    await page.mouse.click(sw.x + 20, sw.y - 10); // an empty spot inside the container
    await frames(page);
    await page.keyboard.press('k');
    await frames(page);
    assert.equal(await page.locator('.fc-chrome[data-scale]').count(), 1, 'Scale mode is on for the container');
    const nw = await handle('nw'), se = await handle('se');
    const before = await boxes(page);
    await drag(page, se, { x: (se.x - nw.x) * 0.5, y: (se.y - nw.y) * 0.5 });
    const after = await boxes(page);
    const get = (id: string): Row => after.find((b) => b.id === id)!;
    const k = num(get('root'), 'w') / 400;
    near(k, 1.5, 0.02, 'container scale');
    near(num(get('root'), 'h'), 220 * k, 1, 'container height');
    near(num(get('root'), 'layoutGapX'), 12 * k, 0.2, 'gap');
    near(num(get('root'), 'layoutPadLeft'), 10 * k, 0.2, 'padding');
    near(num(get('a'), 'w'), 80 * k, 1, 'fixed child width');
    near(num(get('a'), 'radius'), 10 * k, 0.2, 'child radius');
    assert.equal(num(get('b'), 'w'), 80, 'a fill axis is left to the layout');
    near(num(get('b'), 'h'), 70 * k, 1, 'the fixed axis of a fill child scales');
    near(num(get('t'), 'fontSize'), 30 * k, 0.3, 'child text size');
    near(num(get('abs'), 'layoutX'), 300 * k, 0.5, 'absolute child offset');
    // The child's place is whole px and its offset tenths of a px, as a move writes them.
    for (const f of ['x', 'y']) assert.ok(Number.isInteger(num(get('abs'), f)), `the absolute child's ${f} is whole px (${num(get('abs'), f)})`);
    for (const f of ['layoutX', 'layoutY']) {
      const v = num(get('abs'), f);
      assert.equal(Math.round(v * 10) / 10, v, `the absolute child's ${f} is in tenths of a px (${v})`);
    }
    assert.deepEqual(['a', 'b', 't'].map((id) => get(id).layoutOrder), [0, 1, 2], 'flow order holds');
    assert.deepEqual(after.map((b) => b.id), before.map((b) => b.id), 'row order holds');
    await page.waitForFunction(() => (document.querySelector('#tool-canvas [data-box-id="a"]') as HTMLElement).style.width === '120px');
    await undoTo(page, before);
    await page.waitForFunction(() => (document.querySelector('#tool-canvas [data-box-id="b"]') as HTMLElement).style.left === '102px');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

// ── Touch ────────────────────────────────────────────────────────────────────

test('touch: large zones inside the rect, the wash on a held press, narrow zones outside a small box, and a movable middle', opts, async () => {
  const browser = await launch();
  try {
    const { page, errors } = await open(browser, [
      { id: 'big', kind: 'box', x: 100, y: 100, w: 200, h: 120, bg: '#88c4a0' },
      { id: 'sq', kind: 'box', x: 450, y: 100, w: 30, h: 30, bg: '#c49088' },
      { id: 'tiny', kind: 'box', x: 650, y: 100, w: 8, h: 8, bg: '#4060c0' },
    ], { hasTouch: true });
    const client = await page.context().newCDPSession(page);
    const s = await stageScale(page);
    const wash = (): Promise<{ zone: string | null; grab: boolean }> => page.evaluate(() => ({
      zone: document.querySelector('.fc-zone')?.getAttribute('data-zone') ?? null,
      grab: !!document.querySelector('.fc-chrome')?.hasAttribute('data-grab'),
    }));
    const cases: Array<{ id: string; name: string; at: (r: Box) => Pt; d: Pt; zone: string | null; check: (b: Row) => void }> = [
      { id: 'big', name: 'corner zone 18 px inside', at: (r) => ({ x: r.x + r.w - 18, y: r.y + r.h - 10 }), d: { x: 40, y: 30 }, zone: 'corner-se',
        check: (b) => { near(num(b, 'w'), 200 + 40 / s, 2, 'width'); near(num(b, 'h'), 120 + 30 / s, 2, 'height'); } },
      { id: 'big', name: 'side zone 20 px inside', at: (r) => ({ x: r.x + r.w - 20, y: r.y + r.h / 2 }), d: { x: 40, y: 0 }, zone: 'edge-e',
        check: (b) => { near(num(b, 'w'), 200 + 40 / s, 2, 'width'); assert.equal(num(b, 'h'), 120); } },
      { id: 'big', name: 'middle', at: (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 }), d: { x: 40, y: 30 }, zone: null,
        check: (b) => { assert.notEqual(num(b, 'x'), 100); assert.equal(num(b, 'w'), 200); } },
      { id: 'sq', name: 'narrow zone 15 px outside', at: (r) => ({ x: r.x + r.w + 15, y: r.y + r.h / 2 }), d: { x: 30, y: 0 }, zone: 'edge-e',
        check: (b) => { near(num(b, 'w'), 30 + 30 / s, 2, 'width'); } },
      { id: 'sq', name: 'middle of a small box', at: (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 }), d: { x: 30, y: 20 }, zone: null,
        check: (b) => { assert.notEqual(num(b, 'x'), 450); assert.equal(num(b, 'w'), 30); } },
      { id: 'tiny', name: 'middle of a tiny box', at: (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 }), d: { x: 30, y: 20 }, zone: null,
        check: (b) => { assert.notEqual(num(b, 'x'), 650); assert.equal(num(b, 'w'), 8); } },
    ];
    for (const c of cases) {
      await pick(page, c.id);
      const r = await rect(page, c.id);
      const p = c.at(r);
      await touch(client, 'touchStart', [{ ...p, id: 1 }]);
      await sleep(60);
      const held = await wash();
      await touch(client, 'touchEnd', []);
      await sleep(120);
      assert.equal(held.zone, c.zone, `${c.id} ${c.name}: the held finger washes its zone`);
      assert.equal(held.grab, true, `${c.id} ${c.name}: a finger lays the chrome out for large zones`);
      await pick(page, c.id);
      const before = await boxes(page);
      await touchDrag(client, p, c.d);
      c.check(await row(page, c.id));
      assert.equal((await wash()).zone, null, `${c.id} ${c.name}: the wash is gone after the drag`);
      await undoTo(page, before);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('two fingers on the selection: a pinch scales it in one undo step, a twist turns it, and Scale mode scales the text', opts, async () => {
  const browser = await launch();
  try {
    const { page, errors } = await open(browser, [
      { id: 'big', kind: 'box', x: 100, y: 100, w: 200, h: 120, bg: '#88c4a0' },
      { id: 'other', kind: 'box', x: 550, y: 300, w: 200, h: 120, bg: '#d0b040' },
      { id: 'txt', kind: 'text', x: 100, y: 450, w: 300, h: 80, text: 'Pinch', fontSize: 40, fg: '#111111' },
    ], { hasTouch: true });
    const client = await page.context().newCDPSession(page);
    const centre = async (id: string): Promise<Pt> => { const r = await rect(page, id); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; };

    await pick(page, 'big');
    let c = await centre('big');
    const before = await boxes(page);
    await pinch(client, { x: c.x - 30, y: c.y }, { x: c.x + 30, y: c.y }, { x: -30, y: 0 }, { x: 30, y: 0 });
    let b = await row(page, 'big');
    near(num(b, 'w'), 400, 3, 'pinch width');
    near(num(b, 'h'), 240, 3, 'pinch height');
    await undoTo(page, before);

    // The twist engages once the fingers have left the two-finger tap's 14 px, and turns from there.
    await pick(page, 'big');
    const turn = (70 * Math.PI) / 180, arm = 35;
    await pinch(client, { x: c.x - arm, y: c.y }, { x: c.x + arm, y: c.y },
      { x: arm - arm * Math.cos(turn), y: -arm * Math.sin(turn) }, { x: arm * Math.cos(turn) - arm, y: arm * Math.sin(turn) });
    b = await row(page, 'big');
    assert.ok(num(b, 'rot') > 25, `a twist turns the selection (${num(b, 'rot')})`);
    near(num(b, 'w'), 200, 3, 'a twist keeps the size');
    await undoTo(page, before);

    // A two-finger tap whose second finger rolls 2 px opens the context menu and changes nothing.
    await pick(page, 'big');
    await touch(client, 'touchStart', [{ x: c.x - 20, y: c.y, id: 1 }]);
    await sleep(20);
    await touch(client, 'touchStart', [{ x: c.x - 20, y: c.y, id: 1 }, { x: c.x + 20, y: c.y, id: 2 }]);
    await sleep(30);
    await touch(client, 'touchMove', [{ x: c.x - 20, y: c.y, id: 1 }, { x: c.x + 22, y: c.y, id: 2 }]);
    await sleep(40);
    await touch(client, 'touchEnd', [{ x: c.x + 22, y: c.y, id: 2 }]);
    await touch(client, 'touchEnd', []);
    await sleep(200);
    assert.ok(await page.locator('.fc-context-menu').count() > 0, 'the tap opened the menu');
    assert.deepEqual(await boxes(page), before, 'and changed no row');
    await page.keyboard.press('Escape');
    await page.locator('.fc-context-menu').waitFor({ state: 'detached' });

    // Scale mode: a pinch scales the text size with the box.
    await pick(page, 'txt');
    await page.keyboard.press('k');
    c = await centre('txt');
    await pinch(client, { x: c.x - 30, y: c.y }, { x: c.x + 30, y: c.y }, { x: -15, y: 0 }, { x: 15, y: 0 });
    const t = await row(page, 'txt');
    near(num(t, 'fontSize'), 60, 1, 'pinch in Scale mode scales the text');
    await undoTo(page, before);
    await page.keyboard.press('k');

    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('two fingers off the selection zoom the view and change no row', opts, async () => {
  const browser = await launch();
  try {
    for (const where of ['empty canvas', 'an unselected box'] as const) {
      const { ctx, page, errors } = await open(browser, [
        { id: 'big', kind: 'box', x: 100, y: 100, w: 200, h: 120, bg: '#88c4a0' },
        { id: 'other', kind: 'box', x: 550, y: 300, w: 200, h: 120, bg: '#d0b040' },
      ], { hasTouch: true });
      const client = await ctx.newCDPSession(page);
      const canvasWidth = (): Promise<number> => page.evaluate(() => document.getElementById('tool-canvas')!.getBoundingClientRect().width);
      await pick(page, 'big');
      const big = await rect(page, 'big'), other = await rect(page, 'other');
      const at = where === 'empty canvas'
        ? { x: big.x + big.w / 2, y: big.y + big.h + 150 }
        : { x: other.x + other.w / 2, y: other.y + other.h / 2 };
      const w0 = await canvasWidth();
      const before = await boxes(page);
      await pinch(client, { x: at.x - 25, y: at.y }, { x: at.x + 25, y: at.y }, { x: -30, y: 0 }, { x: 30, y: 0 });
      assert.ok(await canvasWidth() > w0 * 1.2, `a pinch on ${where} zooms the view`);
      assert.deepEqual(await boxes(page), before, `a pinch on ${where} changes no row`);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    // The first finger on a small selected box, the second far off on the empty artboard:
    // the pair zooms the view and the box keeps its size.
    const { ctx, page, errors } = await open(browser, [
      { id: 'dot', kind: 'box', x: 300, y: 300, w: 40, h: 40, bg: '#88c4a0' },
      { id: 'other', kind: 'box', x: 650, y: 550, w: 100, h: 100, bg: '#d0b040' },
    ], { hasTouch: true });
    const client = await ctx.newCDPSession(page);
    const canvasWidth = (): Promise<number> => page.evaluate(() => document.getElementById('tool-canvas')!.getBoundingClientRect().width);
    await pick(page, 'dot');
    const dot = await rect(page, 'dot');
    const w0 = await canvasWidth();
    const before = await boxes(page);
    const a = { x: dot.x + dot.w / 2, y: dot.y + dot.h / 2 };
    await pinch(client, a, { x: a.x + 200, y: a.y + 120 }, { x: -20, y: -12 }, { x: 40, y: 24 });
    assert.ok(await canvasWidth() > w0 * 1.1, 'a pinch with one finger far off the small box zooms the view');
    assert.deepEqual(await boxes(page), before, 'and changes no row');
    assert.deepEqual(errors, []);
    await ctx.close();
  } finally { await browser.close(); }
});

// ── Large grab areas, motion and themes ─────────────────────────────────────

test('Large grab areas for a mouse: the menu toggle, the hover wash, reduced motion and dark mode', opts, async () => {
  const browser = await launch();
  try {
    for (const [scheme, motion] of [['light', 'no-preference'], ['light', 'reduce'], ['dark', 'no-preference']] as const) {
      const { ctx, page, errors } = await open(browser, [{ id: 'big', kind: 'box', x: 100, y: 100, w: 200, h: 120, bg: '#88c4a0' }], { colorScheme: scheme, reducedMotion: motion });
      await page.locator('.fc-btn-lolly').click();
      const item = page.getByRole('menuitemcheckbox', { name: 'Large grab areas' });
      assert.equal(await item.getAttribute('aria-checked'), 'false');
      await item.click();
      assert.equal(await page.evaluate(() => localStorage.getItem('lolly-design-large-grab-areas')), 'true');
      await page.keyboard.press('Escape');
      const s = await stageScale(page);
      await pick(page, 'big');
      const r = await rect(page, 'big');
      await page.mouse.move(r.x + r.w - 15, r.y + r.h - 10);
      await page.locator('.fc-zone').waitFor();
      const w = await page.evaluate(() => {
        const z = document.querySelector('.fc-zone')!;
        return { zone: z.getAttribute('data-zone'), animation: getComputedStyle(z).animationName, fill: getComputedStyle(z.querySelector('polygon')!).fill,
          grab: !!document.querySelector('.fc-chrome')?.hasAttribute('data-grab'), primary: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() };
      });
      assert.equal(w.zone, 'corner-se', `${scheme}/${motion}: the hovered large corner is washed`);
      assert.equal(w.grab, true, `${scheme}/${motion}: the handles let the press through`);
      assert.equal(w.animation, motion === 'reduce' ? 'none' : 'fc-zone-in', `${scheme}/${motion}: the wash fades in unless motion is reduced`);
      assert.match(w.fill, /^rgba\(\d+, \d+, \d+, 0\.16\)$/, `${scheme}/${motion}: a translucent wash in the accent (${w.fill})`);
      const before = await boxes(page);
      const mid = await drag(page, { x: r.x + r.w - 20, y: r.y + r.h / 2 }, { x: 40, y: 0 });
      assert.equal(mid.attr, 'ew-resize');
      assert.equal(mid.wash, null, `${scheme}/${motion}: no wash during the drag`);
      near(num(await row(page, 'big'), 'w'), 200 + 40 / s, 2, 'a mouse drag in a large side zone');
      await undoTo(page, before);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  } finally { await browser.close(); }
});

// ── Shortcut sheet and rail ─────────────────────────────────────────────────

test('the shortcut sheet lists the Transform group at desktop and phone widths, in English and German, with no sideways scroll', opts, async () => {
  const browser = await launch();
  try {
    for (const lang of ['en', 'de'] as const) {
      for (const [width, height] of [[1280, 800], [390, 844]] as const) {
        const { ctx, page, errors } = await open(browser, [{ id: 'big', kind: 'box', x: 100, y: 100, w: 200, h: 120, bg: '#88c4a0' }], { width, height, lang });
        // A phone width has no navigator, so the canvas takes focus from a click on the box.
        const r = await rect(page, 'big');
        await page.mouse.click(r.x + r.w / 2, r.y + r.h / 2);
        await page.keyboard.press('Shift+?');
        const tag = `${lang} ${width}px`;
        // The Transform group is the fourth group in every language.
        const group = page.locator('.fc-shortcuts-group').nth(3);
        await group.waitFor();
        assert.equal(await group.locator('tr').count(), 11, `${tag}: eleven Transform rows`);
        if (lang === 'en') assert.match(await group.innerText(), /K\s+Scale mode/, `${tag}: K is listed`);
        const fit = await page.evaluate(() => {
          const g = document.querySelector('.fc-shortcuts-groups')!, d = document.querySelector('.fc-shortcuts-modal')!;
          const keys = [...document.querySelectorAll<HTMLElement>('.fc-shortcuts-group')].map((s) => s.querySelector<HTMLElement>('.fc-shortcuts-keys')!.getBoundingClientRect().width);
          return { grid: [g.clientWidth, g.scrollWidth], dialog: [d.clientWidth, d.scrollWidth, d.scrollLeft], keys };
        });
        assert.equal(fit.grid[1], fit.grid[0], `${tag}: the groups fit their column (${fit.grid})`);
        const [clientW, scrollW, scrolled] = fit.dialog;
        assert.ok(scrollW! <= clientW! && scrolled === 0, `${tag}: the dialog opens unscrolled and never scrolls sideways (${fit.dialog})`);
        // The gesture rows wrap, so the Transform key column is no wider than the widest elsewhere.
        assert.ok(fit.keys[3]! <= Math.max(...fit.keys.filter((_, i) => i !== 3)) + 1, `${tag}: the Transform key column stays narrow (${fit.keys.map(Math.round)})`);
        await page.screenshot({ path: shotPath(`shortcuts-${lang}-${width}`) });
        assert.deepEqual(errors, []);
        await ctx.close();
      }
    }
  } finally { await browser.close(); }
});

test('Scale shares the pointer\'s rail slot: the rail keeps its ten buttons and whole rows, the slot\'s menu and the Lolly menu turn Scale on, at 1280 px, the 680 px docs-shot width and a phone', opts, async () => {
  const browser = await launch();
  try {
    for (const [width, height, navOpen] of [[1280, 800, false], [680, 425, true], [680, 850, false], [844, 390, false]] as const) {
      const tag = `${width}x${height}${navOpen ? ' navigator open' : ''}`;
      const { ctx, page, errors } = await open(browser, [{ id: 'big', kind: 'box', x: 100, y: 100, w: 200, h: 120, bg: '#88c4a0' }], { width, height });
      if (navOpen) {
        await page.getByRole('button', { name: 'Show navigator' }).click();
        await page.waitForFunction(() => !document.querySelector('.fc-nav')?.classList.contains('is-collapsed'));
      }
      const rail = await page.evaluate(() => {
        const btns = [...document.querySelectorAll<HTMLElement>('.fc-toolbar .fc-btn')].filter((b) => b.offsetParent);
        const rows = new Map<number, number>();
        for (const b of btns) { const y = Math.round(b.getBoundingClientRect().y); rows.set(y, (rows.get(y) ?? 0) + 1); }
        const reach = btns.map((b) => {
          const r = b.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return { name: b.getAttribute('aria-label') ?? b.className, swatch: b.classList.contains('fc-color-btn'), ok: !!hit && (hit === b || b.contains(hit)) };
        });
        return { count: btns.length, own: !!document.querySelector('.fc-btn-scale'), rows: [...rows.values()], reach };
      });
      assert.equal(rail.own, false, `${tag}: no Scale button of its own`);
      assert.equal(rail.count, 10, `${tag}: the rail has the ten buttons it had before Scale`);
      if (navOpen) assert.deepEqual(rail.rows, [5, 5], `${tag}: the navigator's tool grid fills two whole rows`);
      // A short window never reached the colour swatch at the foot of the rail; every tool above it takes a press.
      assert.deepEqual(rail.reach.filter((b) => !b.ok && !(height < 550 && b.swatch)).map((b) => b.name), [], `${tag}: every rail button takes a press`);
      // The slot's menu: a right-click offers the pointer and Scale.
      const slot = page.locator('.fc-btn-pointer');
      await slot.click({ button: 'right' });
      const rows = page.locator('.fc-popover [role="menuitemradio"]');
      assert.deepEqual(await rows.allTextContents(), ['Pointer - select and move (V)', 'Scale (K) - text, strokes and effects resize with the object'], `${tag}: the slot offers both tools`);
      assert.deepEqual(await rows.evaluateAll((els) => els.map((e) => e.getAttribute('aria-checked'))), ['true', 'false']);
      await page.screenshot({ path: shotPath(`rail-${width}x${height}-menu`) });
      await page.locator('.fc-popover [data-pop="scale"]').click();
      assert.equal(await slot.getAttribute('data-variant'), 'scale', `${tag}: the slot shows Scale`);
      assert.equal(await slot.getAttribute('aria-pressed'), 'true', `${tag}: and stays pressed`);
      assert.match(await slot.getAttribute('aria-label') ?? '', /^Scale \(K\)/);
      const glyphs = (): Promise<string[]> => slot.evaluate((b) => ['.fc-slot-pointer', '.fc-slot-scale'].map((c) => getComputedStyle(b.querySelector(c)!).display));
      assert.deepEqual(await glyphs(), ['none', 'inline'], `${tag}: the slot draws the Scale glyph`);
      await page.screenshot({ path: shotPath(`rail-${width}x${height}-scale-on`) });
      await slot.click();
      assert.equal(await slot.getAttribute('data-variant'), 'scale', `${tag}: a click on the Scale slot keeps Scale`);
      await page.keyboard.press('v');
      assert.equal(await slot.getAttribute('data-variant'), 'pointer', `${tag}: V returns the slot to the pointer`);
      assert.deepEqual(await glyphs(), ['inline', 'none'], `${tag}: and its glyph`);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    // A phone shows no rail and no object bar: the Lolly menu, behind More, has the Scale mode row.
    const { ctx, page, errors } = await open(browser, [{ id: 'big', kind: 'box', x: 100, y: 100, w: 200, h: 120, bg: '#88c4a0' }], { width: 390, height: 844, hasTouch: true });
    assert.equal(await page.locator('.fc-toolbar .fc-btn').filter({ visible: true }).count(), 0, 'a phone has no rail');
    const r = await rect(page, 'big');
    await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
    await page.getByRole('button', { name: 'More', exact: true }).tap();
    const row = page.getByRole('menuitemcheckbox', { name: 'Scale mode' });
    assert.equal(await row.getAttribute('aria-checked'), 'false');
    await row.tap();
    await frames(page);
    assert.equal(await page.locator('.fc-chrome[data-scale]').count(), 1, 'the row turns Scale on: the handles show the mode');
    await page.screenshot({ path: shotPath('phone-scale-on') });
    assert.deepEqual(errors, []);
    await ctx.close();
  } finally { await browser.close(); }
});

// ── Scale handles in every theme ────────────────────────────────────────────

test('Scale handles look unlike Resize handles in light, dark and high contrast', opts, async () => {
  const browser = await launch();
  try {
    for (const [scheme, high] of [['light', false], ['dark', false], ['light', true], ['dark', true]] as const) {
      const tag = `${scheme}${high ? ' high contrast' : ''}`;
      const { ctx, page, errors } = await open(browser, [{ id: 'big', kind: 'box', x: 100, y: 100, w: 200, h: 120, bg: '#88c4a0' }], { colorScheme: scheme });
      if (high) await page.evaluate(() => document.documentElement.setAttribute('data-a11y-contrast', 'high'));
      await pick(page, 'big');
      const look = (): Promise<{ bg: string; border: string; dot: string | null }> => page.evaluate(() => {
        const h = document.querySelector<HTMLElement>('.fc-chrome .fc-h-se')!;
        const dot = getComputedStyle(h, '::before');
        return { bg: getComputedStyle(h).backgroundColor, border: getComputedStyle(h).borderTopColor, dot: dot.content === 'none' ? null : dot.backgroundColor };
      });
      const r = await rect(page, 'big');
      const clip = { x: r.x - 30, y: r.y - 30, width: r.w + 60, height: r.h + 80 };
      const resize = await look();
      await page.screenshot({ path: shotPath(`handles-${scheme}${high ? '-hc' : ''}-resize`), clip });
      await page.keyboard.press('k');
      await frames(page);
      const scale = await look();
      await page.screenshot({ path: shotPath(`handles-${scheme}${high ? '-hc' : ''}-scale`), clip });
      assert.equal(resize.dot, null, `${tag}: a Resize handle is a plain square`);
      assert.ok(scale.dot, `${tag}: a Scale handle carries a dot`);
      assert.notEqual(scale.dot, scale.bg, `${tag}: the dot shows on its fill (${scale.dot} on ${scale.bg})`);
      assert.notEqual(scale.border, scale.bg, `${tag}: the keyline shows on the fill`);
      assert.ok(scale.bg !== resize.bg || scale.border !== resize.border, `${tag}: the colours change too (${JSON.stringify({ resize, scale })})`);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  } finally { await browser.close(); }
});

// ── Right to left, and a rule over a card ───────────────────────────────────

test('in Arabic the Scale popover\'s anchor grid keeps its physical corners and translated names', opts, async () => {
  const browser = await launch();
  try {
    const { page, errors } = await open(browser, [{ id: 'big', kind: 'box', x: 100, y: 100, w: 200, h: 120, bg: '#88c4a0' }], { lang: 'ar' });
    assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl');
    await pick(page, 'big');
    await page.keyboard.press('k');
    await page.locator('[data-cx-readout]').click();
    const grid = page.locator('.fc-scale-panel .fc-posgrid');
    await grid.waitFor();
    const cells = await grid.evaluate((g) => Object.fromEntries([...g.querySelectorAll<HTMLElement>('[data-anchor]')].map((c) => {
      const r = c.getBoundingClientRect();
      return [c.dataset.anchor!, { x: Math.round(r.x), y: Math.round(r.y), label: c.getAttribute('aria-label') }];
    })));
    assert.ok(cells.nw!.x < cells.ne!.x && cells.sw!.x < cells.se!.x, `the top left cell is on the left (${JSON.stringify(cells)})`);
    assert.ok(cells.nw!.y < cells.sw!.y);
    assert.equal(cells.nw!.label, 'أعلى اليسار', 'and is named top left');
    assert.notEqual(await grid.getAttribute('aria-label'), 'Anchor', 'the group is named in Arabic');
    await page.screenshot({ path: shotPath('scale-popover-ar') });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('a press just beside a selected rule on a card drags the rule, and a click there selects the card', opts, async () => {
  const browser = await launch();
  try {
    const { page, errors } = await open(browser, [
      { id: 'card', kind: 'box', x: 50, y: 50, w: 780, h: 600, bg: '#e8e0d0' },
      { id: 'rule', kind: 'box', x: 100, y: 400, w: 400, h: 2, bg: '#202020' },
    ], { sel: 'rule' });
    const s = await stageScale(page);
    // A 2 px rule keeps the handles at its ends; its corners are hidden.
    await page.locator('.fc-chrome .fc-h-e').waitFor();
    const r = await rect(page, 'rule');
    const before = await boxes(page);
    // 3 screen px below the rule, midway along: over the card, inside the rule's band.
    await drag(page, { x: r.x + r.w / 2, y: r.y + r.h + 3 }, { x: 40, y: 30 });
    const moved = await row(page, 'rule');
    near(num(moved, 'x'), 100 + 40 / s, 2, 'the rule moves');
    near(num(moved, 'y'), 400 + 30 / s, 2, 'the rule moves down');
    assert.deepEqual(await row(page, 'card'), before.find((b) => b.id === 'card'), 'the card stays');
    await undoTo(page, before);
    const selected = (): Promise<string[]> => page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.fc-nav-layer[aria-selected="true"]')].map((r) => r.dataset.id ?? ''));
    assert.deepEqual(await selected(), ['rule'], 'the rule is still the selection');
    const r2 = await rect(page, 'rule');
    await page.mouse.click(r2.x + r2.w / 2, r2.y + r2.h + 3);
    await frames(page);
    assert.deepEqual(await selected(), ['card'], 'a click in the band selects the card under the pointer');
    assert.deepEqual(await boxes(page), before, 'and changes no row');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
