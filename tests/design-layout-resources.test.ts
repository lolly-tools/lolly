// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createTokenSet } from '../engine/src/tokens.ts';
import {
  createDesignLayoutMeasurer,
  designLayoutFontFamily,
  designLayoutFontsOf,
} from '../engine/src/design-layout-resources.ts';
import { createNodeLayout } from '../packages/node-shell/src/layout-host-node.ts';
import { createNodeTextShaper, measureTextNode } from '../packages/node-shell/src/text-measure.ts';
import type { TokensAPI } from '@lolly-tools/core/host-v1';
import type { TextMeasureFontsV1 } from '@lolly-tools/core/text-measure-v1';

const tokenDocument = (brand: unknown, extra: Record<string, unknown> = {}) => ({
  font: {
    $type: 'fontFamily',
    brand: { $value: brand },
    ...Object.fromEntries(Object.entries(extra).map(([role, value]) => [role, { $value: value }])),
  },
});
function mutableTokens(initial: unknown) {
  let document = initial;
  const api: TokensAPI = {
    get: async () => createTokenSet(document),
    resolve: async (ref) => createTokenSet(document).resolve(ref),
    colors: async () => createTokenSet(document).colors(),
    themes: async () => [],
  };
  return {
    api,
    set: (next: unknown) => {
      document = next;
    },
  };
}
const request = (font = 'sans', text = 'Active brand words') => ({
  boxes: [
    { id: 'root', kind: 'box', x: 0, y: 0, w: 1000, h: 120, layout: 'flex', layoutH: 'hug' },
    {
      id: 'label',
      kind: 'text',
      x: 0,
      y: 0,
      w: 100,
      h: 40,
      layoutOwner: 'root',
      layoutW: 'hug',
      layoutH: 'hug',
      font,
      text,
      fontSize: 32,
      weight: 400,
      pad: 0,
    },
    { id: 'follower', kind: 'box', x: 0, y: 0, w: 20, h: 20, layoutOwner: 'root' },
  ],
});
const near = (actual: unknown, expected: number) =>
  assert.ok(Math.abs(Number(actual) - expected) < 0.04, `${actual} != ${expected}`);

test('layout font roles follow current canvas family validation and display/italic fallback', () => {
  assert.equal(designLayoutFontFamily(['{missing}', '"Outfit"', 'SUSE']), 'Outfit');
  assert.equal(designLayoutFontFamily('Outfit, serif'), undefined);
  assert.equal(designLayoutFontFamily('url(font.ttf)'), undefined);
  assert.deepEqual(
    designLayoutFontsOf(
      createTokenSet(
        tokenDocument('Outfit', {
          mono: 'SUSE Mono',
          display: ['Outfit', 'SUSE'],
          italic: '{font.brand}',
        })
      )
    ),
    { brand: 'Outfit', mono: 'SUSE Mono', display: 'Outfit', italic: 'Outfit' }
  );
  assert.deepEqual(designLayoutFontsOf(), { brand: 'SUSE', mono: 'SUSE Mono' });
});

test('real HarfBuzz layout geometry changes when active brand font tokens change with unchanged authored rows', async () => {
  const tokens = mutableTokens(tokenDocument('SUSE'));
  const host = await createNodeLayout(tokens.api),
    source = request(),
    before = JSON.stringify(source);
  const first = await host.evaluate(source),
    repeat = await host.evaluate(source);
  assert.deepEqual(first.findings, []);
  assert.equal(repeat.passes, 0);
  assert.equal(repeat.solved, 0);
  const expectedFirst = await measureTextNode({
    text: source.boxes[1]!.text!,
    font: 'sans',
    width: 1e7,
    size: 32,
    weight: 400,
    pad: 0,
    fonts: { brand: 'SUSE' },
  });
  near(first.boxes[1]!.w, expectedFirst.lines[0]!.width);
  near(first.boxes[2]!.x, Number(first.boxes[1]!.w));
  tokens.set(tokenDocument(['SUSE Mono', 'SUSE']));
  const changed = await host.evaluate(source);
  assert.deepEqual(changed.findings, []);
  assert.ok(changed.passes > 0);
  const expectedChanged = await measureTextNode({
    text: source.boxes[1]!.text!,
    font: 'sans',
    width: 1e7,
    size: 32,
    weight: 400,
    pad: 0,
    fonts: { brand: 'SUSE Mono' },
  });
  near(changed.boxes[1]!.w, expectedChanged.lines[0]!.width);
  near(changed.boxes[2]!.x, Number(changed.boxes[1]!.w));
  assert.ok(Math.abs(Number(changed.boxes[1]!.w) - Number(first.boxes[1]!.w)) > 2);
  assert.equal(JSON.stringify(source), before);
});

test('intrinsic display, mono and emphasis runs use the active role faces', async () => {
  const fonts: TextMeasureFontsV1 = {
    brand: 'SUSE',
    mono: 'SUSE Mono',
    display: 'Outfit',
    italic: 'Outfit',
  };
  const tokens = mutableTokens(
    tokenDocument(fonts.brand, { mono: fonts.mono, display: fonts.display, italic: fonts.italic })
  );
  const host = await createNodeLayout(tokens.api);
  for (const [font, text] of [
    ['display', 'Display width'],
    ['mono', 'code width'],
    ['sans', '*Emphasis width*'],
  ] as const) {
    const result = await host.evaluate(request(font, text));
    assert.deepEqual(result.findings, []);
    const expected = await measureTextNode({
      text,
      font,
      width: 1e7,
      size: 32,
      weight: 400,
      pad: 0,
      fonts,
    });
    near(result.boxes[1]!.w, expected.lines[0]!.width);
  }
});

test('unavailable brand faces and missing glyphs block intrinsic layout without guessed geometry', async () => {
  const tokens = mutableTokens(tokenDocument('Uploaded Font Not Available'));
  const host = await createNodeLayout(tokens.api),
    source = request();
  const missingFace = await host.evaluate(source);
  assert.ok(
    missingFace.findings.some((finding) => /Uploaded Font Not Available/.test(finding.message))
  );
  assert.equal(missingFace.boxes, source.boxes);
  tokens.set(tokenDocument('SUSE'));
  const missingGlyph = await host.evaluate(request('sans', '日本語'));
  assert.ok(missingGlyph.findings.some((finding) => /cannot draw/.test(finding.message)));
});

test('intrinsic measurement retains small successes and retries oversized or failed requests', async () => {
  const shaper = createNodeTextShaper();
  let calls = 0;
  const measure = createDesignLayoutMeasurer(
    async (run) => {
      calls++;
      return shaper(run);
    },
    { brand: 'SUSE' },
    'fixture',
    512
  );
  const short = { text: 'x', pad: 0 },
    long = { text: 'words '.repeat(200), pad: 0 };
  await measure(short, 1e7);
  const afterShort = calls;
  await measure(short, 1e7);
  assert.equal(calls, afterShort);
  await measure(long, 1e7);
  const afterLong = calls;
  await measure(long, 1e7);
  assert.ok(calls > afterLong);
  await assert.rejects(measure({ text: '日本語' }, 1e7), /cannot draw/);
  const afterFailure = calls;
  await assert.rejects(measure({ text: '日本語' }, 1e7), /cannot draw/);
  assert.ok(calls > afterFailure);
});

const browserOrigin = process.env.LOLLY_LAYOUT_TEST_URL;
test('web intrinsic sizing follows active token changes and invalidates projections after font registry changes', {
  skip: browserOrigin ? false : 'Serve the worktree web shell and set LOLLY_LAYOUT_TEST_URL.',
  timeout: 90_000,
}, async () => {
  const { chromium } = await import('playwright'),
    browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    // A same-origin text document keeps app navigation and service workers out of the host test.
    await page.goto(`${browserOrigin}/fonts/OFL-SUSE.txt`);
    const source = request();
    const result = await page.evaluate(
      async ({ source, tokenPath }) => {
        const layoutPath = '/src/bridge/layout.ts',
          textPath = '/src/bridge/text.ts',
          registryPath = '/src/bridge/font-registry.ts';
        const [{ createWebLayout }, { createTextAPI }, { bustFontRegistry }, { createTokenSet }] =
          await Promise.all([
            import(layoutPath),
            import(textPath),
            import(registryPath),
            import(tokenPath),
          ]);
        let family = 'SUSE';
        const tokens = {
          get: async () =>
            createTokenSet({ font: { $type: 'fontFamily', brand: { $value: family } } }),
        };
        const host = await createWebLayout(createTextAPI(), tokens);
        const first = await host.evaluate(source),
          cached = await host.evaluate(source);
        family = 'SUSE Mono';
        const changed = await host.evaluate(source);
        const changedCached = await host.evaluate(source);
        bustFontRegistry();
        const registryChanged = await host.evaluate(source);
        family = 'Uploaded Font Not Available';
        const unavailable = await host.evaluate(source);
        return { first, cached, changed, changedCached, registryChanged, unavailable };
      },
      {
        source,
        tokenPath: `/@fs${fileURLToPath(new URL('../engine/src/tokens.ts', import.meta.url))}`,
      }
    );
    assert.deepEqual(result.first.findings, []);
    assert.deepEqual(result.changed.findings, []);
    assert.equal(result.cached.passes, 0);
    assert.equal(result.changedCached.passes, 0);
    assert.ok(Math.abs(Number(result.first.boxes[1]!.w) - Number(result.changed.boxes[1]!.w)) > 2);
    assert.ok(result.registryChanged.passes > 0);
    assert.deepEqual(result.registryChanged.findings, []);
    near(result.registryChanged.boxes[1]!.w, Number(result.changed.boxes[1]!.w));
    assert.ok(result.unavailable.findings.length > 0);
  } finally {
    await browser.close();
  }
});
