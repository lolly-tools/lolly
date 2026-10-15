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
 *   4. the job stripe and the credential panel take the tone, not a literal.
 *
 * Run directly:  node --test shells/web/src/styles/lolly-tone-contract.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOLLY_TONE_HEX } from '../brand-vars.ts';

const STYLES_DIR = dirname(fileURLToPath(import.meta.url)); // src/styles/
const SRC_DIR = dirname(STYLES_DIR); // src/
const read = (rel: string): string => readFileSync(join(SRC_DIR, rel), 'utf8');

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
  const banned = ['--lolly-accent', '#24894e', '#64ce90', '145 58% 34%', '145 52% 60%'];
  for (const file of shellSources()) {
    const text = readFileSync(file, 'utf8').toLowerCase();
    for (const needle of banned)
      assert.ok(!text.includes(needle.toLowerCase()), `${file.slice(SRC_DIR.length + 1)} still contains ${needle}`);
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
});
