// SPDX-License-Identifier: MPL-2.0
/**
 * The walker under a RUNNING transform animation (plans/104 section 9, P3.1 failure 2).
 *
 * The neutralise-and-recurse branches set `el.style.transform = 'none'` and walk the
 * element again. A running CSS transition or animation on `transform` outranks every
 * declaration in every origin (CSS Cascade 5 section 6.1), inline `!important` included, so
 * that assignment did nothing and the recursive call took the same branch again, and
 * again: the app's own gallery walked to 34 455 `<g>` in chains 2 136 deep, and an
 * INFINITE animation had no termination argument at all.
 *
 * Only a browser can be the oracle for this suite. jsdom has no cascade, no animation
 * timeline, no `getAnimations()` and no layout, so every mechanism under test - 
 * "does an animation outrank an inline style", "does cancelling it let the inline
 * style through", "how many groups came out" - is precisely what it cannot model.
 *
 * The bounds asserted below are deliberately generous multiples of the measured
 * numbers: this file exists to catch an EXPLOSION (three orders of magnitude), not to
 * pin an exact group count that legitimate walker changes may move.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXPORT_MODULE = fileURLToPath(new URL('./export.ts', import.meta.url));

async function chromiumOrSkip(): Promise<{ chromium: any } | string> {
  let chromium: any;
  try { ({ chromium } = await import('playwright')); }
  catch { return 'playwright not installed'; }
  try {
    const p = chromium.executablePath();
    if (!p || !existsSync(p)) return 'no Chromium (pnpm exec playwright install chromium)';
  } catch { return 'no Chromium (pnpm exec playwright install chromium)'; }
  return { chromium };
}

const browser = await chromiumOrSkip();
const SKIP = typeof browser === 'string' ? browser : false;

let bundleCache: string | null = null;
async function bundle(): Promise<string> {
  if (bundleCache) return bundleCache;
  const { build } = await import('esbuild');
  const out = await build({
    stdin: {
      contents: `import { renderSvgFromHtml } from ${JSON.stringify(EXPORT_MODULE)};
                 window.__render = renderSvgFromHtml;`,
      resolveDir: HERE, loader: 'ts',
    },
    bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent',
    // export.ts reaches a CSS side-effect import through a lazy chain (the durable
    // probe in format-support.ts); esbuild has no output path here, so drop the sheets.
    loader: { ".css": "empty" },
  });
  bundleCache = out.outputFiles[0]!.text;
  return bundleCache;
}

type Shot = {
  svg: string;
  /** `<g>` elements in the output. The explosion's unit. */
  groups: number;
  /** Deepest `<g>` nesting. The explosion was 2 136 identical levels. */
  depth: number;
  /** Wrapper transforms emitted (`rotate(`/`matrix(` on a group). */
  rotates: number;
  /** The element's inline `transform` after the walk - the restore check. */
  inlineAfter: string;
  /** Is the element still moving 120 ms after the export finished? */
  stillMoving: boolean;
  ms: number;
};

/**
 * Load `markup`, run `prep` in the page (trigger the transition, start the clock),
 * walk `#root`, and report what came out.
 */
async function shoot(markup: string, prep: string, watch = '#target'): Promise<Shot> {
  const { chromium } = browser as { chromium: any };
  const b = await chromium.launch();
  try {
    const page = await b.newPage({ viewport: { width: 800, height: 600 } });
    await page.setContent(`<!doctype html><body style="margin:0">${markup}</body>`);
    await page.addScriptTag({ content: await bundle() });
    return await page.evaluate(async ([prepSrc, watchSel]: string[]) => {
      // eslint-disable-next-line no-new-func
      await new Function(`return (async () => { ${prepSrc} })()`)();
      const el = document.querySelector(watchSel!) as HTMLElement | null;
      const t0 = performance.now();
      const blob = await (window as any).__render(document.getElementById('root'),
        { convertPaths: false, rasterFallback: false });
      const ms = performance.now() - t0;
      const svg: string = await blob.text();

      let depth = 0, cur = 0;
      for (const m of svg.matchAll(/<(\/?)g[\s>]/g)) { cur += m[1] ? -1 : 1; if (cur > depth) depth = cur; }

      // Motion after the fact: two samples of the computed transform, a few frames
      // apart. A page whose animations were cancelled and not replayed is frozen.
      const sample = (): string => (el ? getComputedStyle(el).transform : 'none');
      const a = sample();
      await new Promise((r) => setTimeout(r, 120));
      const b2 = sample();

      return {
        svg,
        groups: (svg.match(/<g[\s>]/g) ?? []).length,
        depth,
        rotates: (svg.match(/ transform="(rotate|matrix)\(/g) ?? []).length,
        inlineAfter: el ? el.style.transform : '',
        stillMoving: a !== b2,
        ms,
      };
    }, [prep, watch]);
  } finally { await b.close(); }
}

/** One rotated card inside a small page. `#target` is the transformed element. */
const PAGE = (targetStyle: string, extraCss = '') => `
  <style>
    #root { width: 400px; height: 240px; background: #fff; position: relative; }
    #target { position: absolute; left: 60px; top: 40px; width: 160px; height: 100px;
              background: #2a6; ${targetStyle} }
    #target .line { height: 12px; margin: 8px; background: #fff; }
    ${extraCss}
  </style>
  <div id="root">
    <div id="target"><div class="line"></div><div class="line"></div></div>
  </div>`;

// ── the reference: no animation anywhere ────────────────────────────────────────
test('a statically rotated element: one wrapper group, shallow tree (the baseline)',
  { skip: SKIP }, async () => {
    const s = await shoot(PAGE('transform: rotate(18deg);'), '');
    assert.equal(s.rotates, 1, s.svg.slice(0, 300));
    assert.ok(s.groups < 20, `baseline groups=${s.groups}`);
    assert.ok(s.depth < 8, `baseline depth=${s.depth}`);
  });

// ── failure 2, case A: a running CSS TRANSITION ────────────────────────────────
test('a RUNNING transform transition walks once, not once per attempt',
  { skip: SKIP }, async () => {
    const markup = PAGE(
      // Both ends of the transition are well away from identity, so the element is
      // genuinely rotated at EVERY instant of it - a 0deg → Ndeg tween spends its
      // first frames indistinguishable from no transform at all, and would take the
      // AABB path for reasons that have nothing to do with what is under test.
      'transform: rotate(30deg); transition: transform 60s linear;',
      '#target.go { transform: rotate(70deg); }',
    );
    // Start a 60-second transition and let it get properly under way, so the walk
    // happens mid-flight - the exact state that used to re-enter forever.
    const prep = `
      const el = document.getElementById('target');
      el.classList.add('go');
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((r) => setTimeout(r, 60));
      if (el.getAnimations().length !== 1) throw new Error('no transition is running');
      if (getComputedStyle(el).transform === 'none') throw new Error('transform did not take');`;
    const s = await shoot(markup, prep);

    // The failure mode, killed: bounded groups and a shallow tree. (Measured before
    // the fix on the same fixture: the walk did not finish at all.)
    assert.ok(s.groups < 40, `groups=${s.groups} - the re-entry is back`);
    assert.ok(s.depth < 8, `depth=${s.depth} - nested wrapper chain is back`);
    // And the shot is CORRECT, not merely bounded: the element is still emitted as a
    // real vector rotation of its untransformed subtree, exactly once.
    assert.equal(s.rotates, 1, s.svg.slice(0, 400));
    // The page is left as it was found: no inline transform of ours, still animating.
    assert.equal(s.inlineAfter, '', 'the inline neutralise must not survive the walk');
    assert.ok(s.stillMoving, 'the transition must be replayed, not left cancelled');
  });

// ── failure 2, case A′: a transform transition that is merely DECLARED ──────────
test('an element that only DECLARES a transform transition explodes too - and must not',
  { skip: SKIP }, async () => {
    // The gallery's actual shape, and the counter-intuitive half of the bug: nothing
    // is animating here. The walker's own `transform: none` write is the style change
    // that STARTS a transition, and that transition then outranks the write. So an
    // idle, never-hovered tile re-entered exactly like a moving one.
    const markup = PAGE('transform: rotate(25deg); transition: transform 60s linear;');
    const s = await shoot(markup, '');
    assert.ok(s.groups < 40, `groups=${s.groups}`);
    assert.ok(s.depth < 8, `depth=${s.depth}`);
    assert.equal(s.rotates, 1, s.svg.slice(0, 400));
    // …and the walk must not LEAVE one running either: restoring the pose and the
    // `transition-property` in one style change would start the 60-second tween the
    // suppression exists to prevent, on a page that was perfectly still.
    assert.equal(s.stillMoving, false, 'the export must not start a transition of its own');
    assert.equal(s.inlineAfter, '');
  });

// ── failure 2, case B: an INFINITE animation (the unbounded-recursion risk) ─────
test('an INFINITE transform animation terminates, and the page keeps spinning',
  { skip: SKIP }, async () => {
    const markup = PAGE(
      'animation: spin 4s linear infinite;',
      '@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }',
    );
    const prep = `
      const el = document.getElementById('target');
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((r) => setTimeout(r, 80));
      if (!el.getAnimations().some((a) => a.playState === 'running')) throw new Error('not spinning');`;
    const s = await shoot(markup, prep);

    // Termination is the assertion; the test timing out IS the failure. The bounds
    // below then say it terminated for the right reason rather than by luck.
    assert.ok(s.groups < 40, `groups=${s.groups}`);
    assert.ok(s.depth < 8, `depth=${s.depth}`);
    assert.ok(s.rotates >= 1, 'the frozen pose is still emitted as a vector rotation');
    assert.ok(s.ms < 20_000, `the walk took ${Math.round(s.ms)} ms`);
    assert.equal(s.inlineAfter, '');
    assert.ok(s.stillMoving, 'cancelling is for the duration of the shot only');
  });

// ── the un-neutralisable case: fall through, do not recurse ────────────────────
test('a transform an author `!important` rule owns falls to the AABB path, bounded',
  { skip: SKIP }, async () => {
    // Author `!important` outranks an inline declaration of normal importance, so the
    // neutralise cannot win here either - and a STRONGER inline style is not the fix
    // (an animation would outrank that too). The element is walked from its
    // transformed bounding box instead: one element, one group, no wrapper.
    const markup = PAGE('transform: rotate(25deg) !important;');
    const s = await shoot(markup, '');
    assert.ok(s.groups < 40, `groups=${s.groups}`);
    assert.ok(s.depth < 8, `depth=${s.depth}`);
    assert.equal(s.rotates, 0, 'no wrapper is emitted when the subtree could not be un-rotated');
    assert.equal(s.inlineAfter, '', 'and nothing of ours is left on the element');
  });

// ── the floor: a page with no animation is untouched by any of this ────────────
test('no transform animation anywhere: the same DOM exports the same bytes twice',
  { skip: SKIP }, async () => {
    const { chromium } = browser as { chromium: any };
    const b = await chromium.launch();
    try {
      const page = await b.newPage({ viewport: { width: 800, height: 600 } });
      await page.setContent(`<!doctype html><body style="margin:0">${PAGE('transform: rotate(18deg) scale(1.2);')}</body>`);
      await page.addScriptTag({ content: await bundle() });
      const [a, b2] = await page.evaluate(async () => {
        const one = async (): Promise<string> => (await (window as any).__render(
          document.getElementById('root'), { convertPaths: false, rasterFallback: false })).text();
        return [await one(), await one()];
      });
      assert.equal(a, b2, 'the guard must be invisible to a document that never animates');
    } finally { await b.close(); }
  });
