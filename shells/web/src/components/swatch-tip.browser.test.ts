// SPDX-License-Identifier: MPL-2.0
/**
 * The swatch name chip in a real Chromium.
 *
 * color-field.test.ts pins what showSwatchTip writes, in jsdom, which has no
 * cascade to speak of. This suite mounts the real colour field over the real
 * tokens.css, color-field.css and components.css, moves the mouse onto a swatch
 * and reads the label's COMPUTED colour: in the light, dark and brand themes and
 * under High contrast, where the chip also has to stay distinct from the page.
 *
 * Self-skips by name where Playwright's Chromium is not installed (`pnpm exec
 * playwright install chromium`); a green run without it means "not exercised".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrowserType } from 'playwright';
import type { ColorSwatchOption } from './color-field.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIELD = fileURLToPath(new URL('./color-field.ts', import.meta.url));
const CSS = ['../styles/tokens.css', '../styles/parts/color-field.css', '../styles/parts/components.css']
  .map((rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')).join('\n');

async function chromiumOrSkip(): Promise<{ chromium: BrowserType } | string> {
  let chromium: BrowserType;
  try { ({ chromium } = await import('playwright')); }
  catch { return 'playwright not installed'; }
  try {
    const p = chromium.executablePath();
    if (!p || !existsSync(p)) return 'no Chromium (pnpm exec playwright install chromium)';
  } catch { return 'no Chromium (pnpm exec playwright install chromium)'; }
  return { chromium };
}
const browserOrReason = await chromiumOrSkip();

/** The real field, bundled for the page. Its CSS imports are dropped: the page
 *  loads the three sheets above itself. */
async function bundle(): Promise<string> {
  const { build } = await import('esbuild');
  const out = await build({
    stdin: {
      contents: `import { colorFieldHtml, wireColorField, setSwatches } from ${JSON.stringify(FIELD)};
                 window.__field = { colorFieldHtml, wireColorField, setSwatches };`,
      resolveDir: HERE, loader: 'ts',
    },
    bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent',
    loader: { '.css': 'empty' },
  });
  return out.outputFiles[0]!.text;
}

type FieldApi = Pick<typeof import('./color-field.ts'), 'colorFieldHtml' | 'wireColorField' | 'setSwatches'>;

/** Opal as the tool view hands it to the picker: each token's CSS face beside its
 *  hex (views/tool/setup.ts). The face is what the swatch and its chip paint. */
const OPAL: ColorSwatchOption[] = [
  { value: '#033633', wide: 'color(srgb 0.011765 0.211765 0.2)', label: 'Spearmint', group: 'Opal', ref: '{color.opal.spearmint}' },
  { value: '#09141a', wide: 'color(srgb 0.035294 0.078431 0.101961)', label: 'Liquorice', group: 'Opal', ref: '{color.opal.liquorice}' },
  { value: '#edf6e0', wide: 'color(srgb 0.929412 0.964706 0.878431)', label: 'Avocado', group: 'Opal', ref: '{color.opal.avocado}' },
  { value: '#50c369', wide: 'color(srgb 0.313725 0.764706 0.411765)', label: 'Green Apple', group: 'Opal', ref: '{color.opal.green-apple}' },
  { value: '#00000033', label: 'Shade', group: 'Opal', ref: null },
];

const WHITE = 'rgb(255, 255, 255)';
const BLACK = 'rgb(0, 0, 0)';

interface ChipProbe { color: string; shadow: string }

test('a hovered swatch shows its name in the swatch ink in every theme, on a chip that stays distinct from the page', {
  skip: typeof browserOrReason === 'string' ? browserOrReason : false,
}, async () => {
  if (typeof browserOrReason === 'string') return;
  const script = await bundle();
  const browser = await browserOrReason.chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 520, height: 560 } });
    const themes = [['light', ''], ['dark', ''], ['brand', ''], ['light', 'high'], ['dark', 'high']] as const;
    for (const [theme, contrast] of themes) {
      const where = `${theme}${contrast ? ` + ${contrast} contrast` : ''}`;
      await page.setContent(`<!doctype html><html data-theme="${theme}"${contrast ? ` data-a11y-contrast="${contrast}"` : ''}>
        <head><style>:root { --a11y-fs: 1; }\n${CSS}</style></head>
        <body style="margin:0;padding:96px 48px;background:hsl(var(--background))"><div id="host" style="width:320px"></div></body></html>`);
      await page.addScriptTag({ content: script });
      await page.evaluate((opal) => {
        const field = (window as unknown as { __field: FieldApi }).__field;
        field.setSwatches(opal);
        const host = document.getElementById('host')!;
        host.innerHTML = field.colorFieldHtml('cf', '#033633', { float: true });
        field.wireColorField(host, {});
        host.querySelector<HTMLElement>('.color-trigger')!.click();
      }, OPAL);

      // The translucent Shade sits on the popover's card surface, and so does its chip:
      // a light grey in the light themes, near black in the dark ones.
      const shadeInk = theme === 'light' ? BLACK : WHITE;
      const expected: Array<[string, string]> = [
        ['Spearmint', WHITE], ['Liquorice', WHITE], ['Avocado', BLACK], ['Green Apple', BLACK], ['Shade', shadeInk],
      ];
      for (const [name, ink] of expected) {
        await page.hover(`.color-swatch[data-name="${name}"]`);
        await page.waitForFunction((n) => {
          const tip = document.querySelector('.swatch-name-tip');
          return tip?.classList.contains('is-shown') && tip.textContent === n;
        }, name);
        const probe = await page.evaluate((): ChipProbe => {
          const cs = getComputedStyle(document.querySelector<HTMLElement>('.swatch-name-tip')!);
          return { color: cs.color, shadow: cs.boxShadow };
        });
        assert.equal(probe.color, ink, `${where}: the label "${name}" reads in ${ink === WHITE ? 'white' : 'black'}`);
        // A full ring in the label's own ink, never one edge: inset, 1px, all round.
        assert.match(probe.shadow, /inset/, `${where}: "${name}" keeps its ring (${probe.shadow})`);
        if (contrast === 'high') {
          assert.ok(probe.shadow.includes(`${ink} 0px 0px 0px 1px inset`),
            `${where}: the ring is the ink at full strength (${probe.shadow})`);
        }
      }
    }
  } finally {
    await browser.close();
  }
});
