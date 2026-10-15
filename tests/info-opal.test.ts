// SPDX-License-Identifier: MPL-2.0
/**
 * /info wears Opal, Lolly's own palette, not SUSE's.
 *
 * The static site is Lolly's own surface. Its colours come from INFO_OPAL_TOKENS in
 * docs/build.ts (one block per theme, inlined after the app's tokens) and from the
 * band tokens in the bridge, and the landing sheet it shares with the in-app reader
 * (parts/docs-landing.css) reads those names. Three things are pinned here:
 *
 *  1. No SUSE colour survives in the /info sources, comments included, so a stale
 *     note cannot keep the old name alive for the next edit to copy.
 *  2. The custom properties the sheets read are declared on both surfaces, and the
 *     retired --orange, --navy and --blue are declared and read nowhere.
 *  3. Every text and focus pair in the three Opal themes clears WCAG 2 (4.5:1 for
 *     text, 3:1 for the focus ring), and so do the band pairs.
 *
 * Reads the files as text and never imports docs/build.ts, which would build the site.
 *
 * Run directly: node --test tests/info-opal.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sliceDeclaration } from '../scripts/check-docs-nav.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

const BUILD_TS = read('docs/build.ts');
const DOCS_CSS = read('shells/web/src/styles/parts/docs.css');

const SOURCES = [
  'docs/build.ts',
  'shells/web/src/styles/parts/docs-landing.css',
  'shells/web/src/styles/parts/docs.css',
  'shells/web/src/styles/parts/docs-chrome.css',
  'shells/web/src/styles/parts/docs-components.css',
  'shells/web/src/lib/docs-landing.ts',
];

// SUSE's colours: Pine, Jungle, Persimmon, Midnight, Waterhole and Mint, as hex (with
// or without an alpha suffix), as rgba() channels and as the HSL triples the token
// slots take. They belong in SUSE's catalog only.
const SUSE_COLOURS: Array<[string, RegExp]> = [
  ['Jungle #30ba78', /#30ba78/i],
  ['Pine #0c322c', /#0c322c/i],
  ['Persimmon #fe7c3f', /#fe7c3f/i],
  ['Midnight #192072', /#192072/i],
  ['Waterhole #2453ff', /#2453ff/i],
  ['Mint #90ebcd', /#90ebcd/i],
  ['Jungle rgba(48,186,120', /rgba?\(\s*48\s*,\s*186\s*,\s*120\b/],
  ['Pine rgba(12,50,44', /rgba?\(\s*12\s*,\s*50\s*,\s*44\b/],
  ['Persimmon rgba(254,124,63', /rgba?\(\s*254\s*,\s*124\s*,\s*63\b/],
  ['Pine triple 171 62% 12%', /\b171 62% 12%/],
  ['Jungle triple 151 57% 46%', /\b151 57% 46%/],
  ['Persimmon hsl(20 99% 62%', /hsl\(\s*20 99% 62%/],
];

test('no SUSE colour is left in the /info sources', () => {
  const found: string[] = [];
  for (const rel of SOURCES) {
    const lines = read(rel).split('\n');
    lines.forEach((line, i) => {
      for (const [name, re] of SUSE_COLOURS) {
        if (re.test(line)) found.push(`${rel}:${i + 1} ${name}`);
      }
    });
  }
  assert.deepEqual(found, [], `SUSE colours belong in SUSE's catalog, not on /info:\n${found.join('\n')}`);
});

// The bridge :root that follows the Opal tokens in the static CSS.
const BRIDGE = (() => {
  // Built from parts so the needle is not a template placeholder in a plain string.
  const at = BUILD_TS.indexOf(`$${'{'}INFO_OPAL_TOKENS}`);
  assert.ok(at > 0, 'INFO_OPAL_TOKENS is not inlined into the static CSS');
  const open = BUILD_TS.indexOf(':root{', at);
  const close = BUILD_TS.indexOf('\n}', open);
  return BUILD_TS.slice(open, close);
})();

const OPAL_SOURCE = (() => {
  const decl = sliceDeclaration(BUILD_TS, 'INFO_OPAL_TOKENS');
  const m = decl.match(/`([^`]*)`/);
  assert.ok(m, 'INFO_OPAL_TOKENS is not a template string in docs/build.ts');
  return m[1] as string;
})();

// The reader's bridge block in docs.css: `.docs-content,\n.docs-landing { ... }`.
const READER_BRIDGE = (() => {
  const m = DOCS_CSS.match(/\.docs-content,\s*\.docs-landing\s*\{([^}]*)\}/);
  assert.ok(m, 'the reader bridge block is missing from docs.css');
  return m[1] as string;
})();

const declares = (block: string, name: string): boolean =>
  new RegExp(`(^|[\\s;{])${name}\\s*:`).test(block);

test('the names the sheets read are declared on both surfaces', () => {
  for (const name of ['--band-primary', '--brand-font']) {
    assert.ok(declares(BRIDGE, name), `${name} is not declared in the static bridge`);
    assert.ok(declares(READER_BRIDGE, name), `${name} is not declared in docs.css's reader bridge`);
  }
  assert.ok(declares(OPAL_SOURCE, '--warn'), '--warn is not declared in INFO_OPAL_TOKENS');
  assert.ok(declares(READER_BRIDGE, '--warn'), "--warn is not declared in docs.css's reader bridge");
});

test('--orange, --navy and --blue are declared and read nowhere', () => {
  const found: string[] = [];
  for (const rel of SOURCES) {
    read(rel).split('\n').forEach((line, i) => {
      if (/--(?:orange|navy|blue)(?![\w-])/.test(line)) found.push(`${rel}:${i + 1}`);
    });
  }
  assert.deepEqual(found, [], `retired tokens still present:\n${found.join('\n')}`);
});

// ── Contrast ─────────────────────────────────────────────────────────────────

type Rgb = [number, number, number];

function hslTriple(triple: string): Rgb {
  const m = triple.trim().match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  assert.ok(m, `not an HSL triple: "${triple}"`);
  const h = Number(m[1]) / 360;
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const hue = (p: number, q: number, t: number): number => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)];
}

const luminance = ([r, g, b]: Rgb): number => {
  const lin = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const ratio = (a: Rgb, b: Rgb): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

// Comments are dropped first: a prose note such as "--primary-foreground: that one
// flips" would otherwise read as a declaration and swallow the real declaration after
// the note.
function slots(block: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of block.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) out.set(m[1] as string, (m[2] as string).trim());
  return out;
}

const THEMES = new Map<string, Map<string, string>>();
for (const m of OPAL_SOURCE.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
  const sel = m[1] as string;
  const theme = sel.includes('"dark"') ? 'dark' : sel.includes('"brand"') ? 'brand' : 'light';
  THEMES.set(theme, slots(m[2] as string));
}

test('INFO_OPAL_TOKENS declares light, dark and brand with the same slots', () => {
  assert.deepEqual([...THEMES.keys()].sort(), ['brand', 'dark', 'light']);
  const names = (t: string): string[] => [...(THEMES.get(t) as Map<string, string>).keys()].sort();
  assert.deepEqual(names('dark'), names('light'), 'dark leaves a light slot behind');
  assert.deepEqual(names('brand'), names('light'), 'brand leaves a light slot behind');
});

const PAIRS: Array<[string, string, number]> = [
  ['--foreground', '--background', 4.5],
  ['--foreground', '--card', 4.5],
  ['--foreground', '--secondary', 4.5],
  ['--muted-foreground', '--background', 4.5],
  ['--muted-foreground', '--secondary', 4.5],
  ['--primary-foreground', '--primary', 4.5],
  ['--primary', '--background', 4.5],
  ['--ring', '--background', 3],
];

for (const theme of ['light', 'dark', 'brand']) {
  test(`Opal ${theme}: text and focus pairs clear WCAG 2`, () => {
    const t = THEMES.get(theme) as Map<string, string>;
    for (const [ink, ground, min] of PAIRS) {
      const r = ratio(hslTriple(t.get(ink) as string), hslTriple(t.get(ground) as string));
      assert.ok(r >= min, `${theme}: ${ink} on ${ground} is ${r.toFixed(2)}:1, under ${min}:1`);
    }
  });
}

test('the band pairs clear 4.5:1', () => {
  const b = slots(BRIDGE);
  const band = hslTriple(b.get('--band-dark') as string);
  for (const ink of ['--on-band-dark', '--band-accent']) {
    const r = ratio(hslTriple(b.get(ink) as string), band);
    assert.ok(r >= 4.5, `${ink} on --band-dark is ${r.toFixed(2)}:1, under 4.5:1`);
  }
});

test("the reader's landing band carries the same Opal values as the static site", () => {
  const b = slots(BRIDGE);
  // The landing's own block, not the shared `.docs-content,\n.docs-landing` bridge
  // that comes first in the file.
  const m = DOCS_CSS.match(/\n\.docs-landing\s*\{([^}]*--band-dark[^}]*)\}/);
  assert.ok(m, 'the reader landing band block is missing from docs.css');
  const r = slots(m[1] as string);
  for (const name of ['--band-dark', '--on-band-dark', '--band-accent']) {
    assert.equal(r.get(name), b.get(name), `${name} differs between the static site and the reader`);
  }
});
