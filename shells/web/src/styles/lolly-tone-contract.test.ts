// SPDX-License-Identifier: MPL-2.0
/**
 * Lolly's tone DRIFT GUARD.
 *
 * Lolly's own colour for its mark and its "Made with Lolly" badge is one token,
 * `--lolly-tone` (styles/tokens.css): Spearmint on light, Green Apple on dark and
 * brand. brand-vars.ts holds the same two colours as LOLLY_TONE_HEX for the mark
 * that takes a guest brand's hue. Before the token, the tone was restated as
 * `--lolly-accent` in three sheets, and two of them handed the brand theme (a
 * dark ground) the light-theme green. These tests read the sources as text, no DOM:
 *
 *   1. tokens.css declares the token for light and for dark plus brand, with the
 *      values brand-vars.ts exports;
 *   2. the badge, the Design rail mark and the Ask button read
 *      var(--lolly-mark, var(--lolly-tone)) and carry no theme-scoped copy;
 *   3. the old greens and the `--lolly-accent` name are gone from the shell;
 *   4. the job stripe and the credential panel take the tone, not a literal;
 *   5. the shutter, its flash, the theme colour, the no-script page and the
 *      confetti fallback are Opal, not SUSE or a fifth green.
 *
 * Run directly:  node --test shells/web/src/styles/lolly-tone-contract.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contrastRatio } from '@lolly/engine';
import { LOLLY_TONE_HEX } from '../brand-vars.ts';

const STYLES_DIR = dirname(fileURLToPath(import.meta.url)); // src/styles/
const SRC_DIR = dirname(STYLES_DIR); // src/
const read = (rel: string): string => readFileSync(join(SRC_DIR, rel), 'utf8');
const WEB_DIR = dirname(SRC_DIR); // shells/web/
const REPO_DIR = dirname(dirname(WEB_DIR)); // repository root
const readWeb = (rel: string): string => readFileSync(join(WEB_DIR, rel), 'utf8');

/** Every shell source file the colour could hide in (tests excluded: they name the old values to ban them). */
function shellSources(dir = SRC_DIR, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'vendor') continue;
      shellSources(p, out);
    } else if (/\.(ts|css|html)$/.test(e.name) && !/\.test\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

/** The body of the first rule whose selector list is exactly `selector`. */
function ruleBody(css: string, selector: string): string | null {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) return null;
  const open = css.indexOf('{', at);
  return css.slice(open + 1, css.indexOf('}', open));
}

const READ = 'var(--lolly-mark, var(--lolly-tone))';

test('tokens.css declares --lolly-tone for light and for dark plus brand, matching LOLLY_TONE_HEX', () => {
  // Comments hold prose with braces; strip them before reading rule bodies.
  const bare = read('styles/tokens.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const toneIn = (body: string): string | undefined => body.match(/--lolly-tone:\s*(#[0-9a-fA-F]{6})\s*;/)?.[1];
  const rootBlocks = [...bare.matchAll(/:root\s*\{([^}]*)\}/g)].map((m) => m[1]!);
  const lightTone = rootBlocks.map(toneIn).find(Boolean);
  assert.ok(lightTone, 'a :root block declares --lolly-tone');
  assert.equal(lightTone.toLowerCase(), LOLLY_TONE_HEX.light);
  // The selector list is exactly dark plus brand: brand is a dark ground in every
  // construction, so it must never fall to the light tone.
  const darkBlocks = [...bare.matchAll(/\[data-theme="dark"\],\n\[data-theme="brand"\]\s*\{([^}]*)\}/g)].map((m) => m[1]!);
  const darkTone = darkBlocks.map(toneIn).find(Boolean);
  assert.ok(darkTone, 'a block whose selector list is exactly [data-theme="dark"],\\n[data-theme="brand"] declares --lolly-tone');
  assert.equal(darkTone.toLowerCase(), LOLLY_TONE_HEX.dark);
  const brandOnly = [...bare.matchAll(/(?<![,\n])\[data-theme="brand"\]\s*\{([^}]*)\}/g)].filter((m) => /--lolly-tone/.test(m[1]!));
  assert.equal(brandOnly.length, 0, 'no brand-only block overrides the tone');
});

test('the badge, the Design rail mark and the Ask swirl read the token and keep no theme-scoped copy', () => {
  const badge = read('styles/parts/asset-shared.css');
  const rail = read('styles/parts/editor.css');
  const ask = read('styles/parts/ask.css');
  assert.ok(ruleBody(badge, '.lolly-badge')?.includes(`color: ${READ}`), '.lolly-badge colour');
  const railRule = ruleBody(rail, '.fc-toolbar .fc-btn.fc-btn-lolly');
  assert.ok(railRule?.includes(`--lolly-swirl: ${READ}`), 'the rail swirl');
  assert.ok(railRule?.includes(`color: ${READ}`), 'the rail mark colour');
  assert.ok(ruleBody(ask, '.ask-send')?.includes(`--lolly-swirl: ${READ}`), 'the Ask swirl');
  // A theme-scoped copy of the tone would put the light green back on the brand theme.
  for (const [name, css] of [['asset-shared.css', badge], ['editor.css', rail], ['ask.css', ask]] as const)
    assert.ok(!/--lolly-tone\s*:/.test(css), `${name} must not redeclare --lolly-tone`);
  assert.ok(!/\[data-theme="[a-z]+"\]\s*\.lolly-badge\s*\{/.test(badge), 'no theme-scoped .lolly-badge override');
  assert.ok(!/\[data-theme="dark"\]\s*\.fc-toolbar\s*\.fc-btn\.fc-btn-lolly\s*\{/.test(rail), 'no theme-scoped rail override');
  assert.ok(!/\)\s*\.ask-send\s*\{/.test(ask), 'no theme-group override of .ask-send');
});

test('--lolly-accent and the old Lolly greens are gone from the shell', () => {
  const banned = ['--lolly-accent', '#24894e', '#64ce90', '145 58% 34%', '145 52% 60%', '#11734b', '#159f66', '#37c684'];
  for (const file of [...shellSources(), join(WEB_DIR, 'index.html')]) {
    const text = readFileSync(file, 'utf8').toLowerCase();
    for (const needle of banned)
      assert.ok(!text.includes(needle.toLowerCase()), `${file.slice(WEB_DIR.length + 1)} still contains ${needle}`);
  }
});

test('the job stripe falls back to the tone and the credential panel washes the tone, not a literal green', () => {
  const tokens = read('styles/tokens.css');
  assert.match(tokens, /--job-candy-a:\s*var\(--brand-primary,\s*var\(--lolly-tone\)\);/);
  const panel = ruleBody(read('styles/parts/assets.css'), '.cat-cred-lolly') ?? '';
  assert.ok(panel.includes(`color-mix(in srgb, ${READ} 6%, transparent)`), 'a 6% wash of the tone');
  assert.ok(panel.includes(`color-mix(in srgb, ${READ} 32%, transparent)`), 'a 32% border of the tone');
  // Andy's rule: full wash and full border, never a one-sided rail on a radiused element.
  assert.ok(/border-radius:/.test(panel) && !/border-(left|right|top|bottom)\s*:/.test(panel), 'no single-edge border');
  // The brand theme's mid-dark cards take a 4% wash so the large badge holds 4.5:1
  // under a guest hue; only the wash changes, never the tone.
  const brandPanel = ruleBody(read('styles/parts/assets.css'), '[data-theme="brand"] .cat-cred-lolly') ?? '';
  assert.equal(brandPanel.replace(/\s+/g, ' ').trim(), `background: color-mix(in srgb, ${READ} 4%, transparent);`);
});

test('the export shutter and its flash use Lolly colours: Bunyapine for the mark, the tone for the flash fallback', () => {
  assert.match(read('lib/shutter.ts'), /const LOLLY_GREEN = '#008657';/);
  const flash = ruleBody(read('styles/parts/tool.css'), '.export-shutter__flash') ?? '';
  assert.ok(flash.includes('background: var(--brand-primary, var(--lolly-tone));'), 'the flash falls back to the tone');
});

test('the theme colour is Spearmint everywhere and the build-time swap still matches the meta tag', () => {
  const meta = '<meta name="theme-color" content="#033633" />';
  assert.ok(readWeb('index.html').includes(meta), 'index.html theme-color');
  // brandChrome() swaps this exact string for non-SUSE builds: if the two drift apart
  // every non-SUSE build keeps the static colour.
  assert.match(readWeb('vite.config.js'), new RegExp(`\\.replace\\('${meta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
  assert.equal(JSON.parse(readWeb('public/manifest.webmanifest')).theme_color, '#033633');
  for (const script of ['scripts/build-tool-og.ts', 'scripts/build-view-og.ts'])
    assert.ok(readFileSync(join(REPO_DIR, script), 'utf8').includes('name="theme-color" content="#033633"'), `${script} theme-color`);
});

test('the no-script page is Opal: no Pine, no --pine names, and no opacity eating the quiet text contrast', () => {
  const html = readWeb('index.html');
  const style = html.slice(html.indexOf('<noscript>'), html.indexOf('</noscript>'));
  assert.ok(style.includes('.nojs'), 'found the no-script style block');
  for (const needle of ['#0c322c', '12, 50, 44', '12,50,44', '--pine'])
    assert.ok(!style.includes(needle), `the no-script style still contains ${needle}`);
  assert.ok(style.includes('--accent-text:'), 'the badge text has its own property');
  assert.ok(!/\.nojs-formats-label[^}]*opacity/.test(style), 'the formats label carries its quiet in --ink-soft');
  assert.ok(!/\.nojs-note\s*\{[^}]*opacity/.test(style), 'the note carries its quiet in --ink-soft');
});

test('the confetti fallback is the Opal chart order first and every pair reads at 4.5:1', () => {
  const src = read('lib/particles.ts');
  const block = src.slice(src.indexOf('const FALLBACK_CHIP_COLORS'));
  const pairs = [...block.slice(0, block.indexOf('];')).matchAll(/\[\s*'(#[0-9a-fA-F]{6})',\s*'(#[0-9a-fA-F]{6})'\s*\]/g)].map((m) => [m[1]!.toLowerCase(), m[2]!.toLowerCase()] as const);
  // Green Apple, Reef, Honey, Donut, Banksia, Olive, Outback, Bark.
  assert.deepEqual(pairs.slice(0, 8).map((p) => p[0]), ['#50c369', '#25c2c2', '#fac044', '#f39dbd', '#ee9138', '#818e44', '#c55123', '#734f31']);
  assert.ok(pairs.length >= 8, 'the pairs parsed');
  for (const [fill, ink] of pairs) assert.ok(contrastRatio(fill, ink) >= 4.5, `${ink} on ${fill} is ${contrastRatio(fill, ink).toFixed(2)}:1`);
  assert.ok(!/SUSE set/.test(src), 'the comments no longer call the fallback the SUSE set');
});
