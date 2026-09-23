// SPDX-License-Identifier: MPL-2.0
/**
 * The panel primitive's contract (plans/273).
 *
 * `styles/parts/panel.css` exists to stop the Design inspector and the tool input
 * sidebar drifting apart again. Before it, their group heads disagreed on eight
 * measured properties and nobody noticed for a year, because nothing compared
 * them. These are the rules that made the drift possible; each one is pinned here
 * so the next edit has to mean it.
 *
 * Source text only. Geometry needs a browser (scripts/capture-sidebars.ts and the
 * probes in plans/273-panel-system-evidence do that), so a green run here means
 * "the rules are still spelled the way they were agreed", not "it looks right".
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const here = import.meta.dirname;
const read = (rel: string): string => readFileSync(join(here, rel), 'utf8');
const panel = read('parts/panel.css');
const tool = read('parts/tool.css');
const inspector = read('parts/design-inspector.css');
const vocabulary = JSON.parse(read('../../../../schemas/section-vocabulary.json')) as {
  bands: Array<{ id: string; title: string; glyph: string }>;
  sections: Record<string, { band: string; glyph: string }>;
};

test('the uppercase eyebrow is SMALLER than the section name above it', () => {
  // The whole point of the type pass. --ui-type-field is --fs-2xs (10px) and
  // --ui-type-section is --fs-md (13px); a sheet that puts the eyebrow on the
  // section's token, or the section on the eyebrow's, has undone it.
  for (const [name, sheet] of [['panel.css', panel], ['tool.css', tool]] as const) {
    const eyebrowRules = [...sheet.matchAll(/text-transform:\s*uppercase/g)].length;
    assert.ok(eyebrowRules > 0, `${name} still has an uppercase mark to check`);
  }
  assert.match(panel, /\.lp-label\s*\{[^}]*font-size:\s*var\(--ui-type-field\)/su,
    'panel.css: the row eyebrow reads --ui-type-field');
  assert.match(panel, /\.lp-sec-head\s*\{[^}]*font-size:\s*var\(--ui-type-section\)/su,
    'panel.css: the section head reads --ui-type-section');
  assert.match(tool, /\.input-label\s*\{[^}]*font-size:\s*var\(--ui-type-field\)/su,
    'tool.css: the sidebar eyebrow reads the same tier as the dock eyebrow');
  assert.match(tool, /\.input-section-summary\s*\{[^}]*font-size:\s*var\(--ui-type-section\)/su,
    'tool.css: the sidebar section head reads the same tier as the dock section head');
  // Sentence case is what separates the head from the eyebrow. An `uppercase` on
  // the head is the regression this test exists for.
  const summary = /\.input-section-summary\s*\{[^}]*\}/su.exec(tool)?.[0] ?? '';
  assert.doesNotMatch(summary, /text-transform:\s*uppercase/u,
    'tool.css: a section head is a name in sentence case, not a second eyebrow');
  const head = /\.lp-sec-head\s*\{[^}]*\}/su.exec(panel)?.[0] ?? '';
  assert.doesNotMatch(head, /text-transform:\s*uppercase/u,
    'panel.css: same rule for the dock');
});

test('the caret is a grid column, so a section action cannot move it', () => {
  assert.match(panel, /\.lp-sec-head\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:[^;]*var\(--ui-size-icon-sm\)\s*;/su,
    'the head is a grid whose LAST column is the caret');
  assert.doesNotMatch(/\.lp-sec-head\s*\{[^}]*\}/su.exec(panel)?.[0] ?? '', /display:\s*flex/u,
    'a flex head is how the caret moved 72px on whichever section had an action');
});

test('density is a container query, not a panel identity', () => {
  assert.match(panel, /container-type:\s*inline-size/u);
  assert.match(panel, /@container lp \(min-width: 320px\)/u,
    'one breakpoint, on the PANEL, decides stacked against inline for both surfaces');
});

test('every control on a row takes one height', () => {
  assert.match(panel, /--ui-size-control/u);
  for (const control of ['.field-input', '.field-select', '.num-field', '.color-trigger']) {
    assert.ok(panel.includes(control), `panel.css gives ${control} the row's height`);
  }
});

test('panel.css adds no parallel geometry scale', () => {
  // Spacing is --sp-*, corners are --ui-radius-*, surfaces are the edge and
  // elevation roles. A bare px padding or a border-radius literal here is a
  // second scale starting, which is what this file exists to prevent.
  assert.doesNotMatch(panel, /border-radius:\s*\d+(?:\.\d+)?px/u,
    'corners come from var(--ui-radius-*) / var(--radius-*)');
  const padding = [...panel.matchAll(/padding(?:-inline|-block|-top|-right|-bottom|-left)?:\s*([^;]+);/g)]
    .map((m) => m[1]!.trim())
    .filter((v) => /\d+px/.test(v) && !/var\(/.test(v));
  assert.deepEqual(padding, ['2px'],
    'the only bare-px padding is the 2px segmented-control inset; everything else is --sp-*');
});

test('a CSS comment never closes itself early', () => {
  // A star followed by a slash inside a comment ends it there, and the rule after
  // it is eaten in silence. `--ui-edge-*` followed by `/--ui-elevation-*` did
  // exactly that in this file's own header and deleted the whole `.lp` block,
  // which took --lp-label and the container with it. Nothing about the page said
  // so; the label column simply stopped being a column.
  for (const [name, sheet] of [['panel.css', panel], ['tool.css', tool], ['design-inspector.css', inspector]] as const) {
    for (const [i, line] of sheet.split('\n').entries()) {
      const at = line.indexOf('*/');
      if (at < 0) continue;
      const rest = line.slice(at + 2).trim();
      assert.ok(rest === '' || rest.startsWith('/*') || !/^[a-z-]/i.test(rest),
        `${name}:${i + 1} closes a comment mid-line and leaves "${rest.slice(0, 40)}" as CSS`);
    }
  }
});

test('the section vocabulary names a real band and a real glyph for every entry', () => {
  const bands = new Set(vocabulary.bands.map((b) => b.id));
  assert.deepEqual([...bands], ['content', 'style', 'layout', 'presence', 'more'],
    'the ladder is these five, in this order');
  const icons = new Set(
    [...read('../lib/icons.ts').matchAll(/^ {2}([a-zA-Z0-9]+):/gm)].map((m) => m[1]!)
  );
  for (const [name, meta] of Object.entries(vocabulary.sections)) {
    assert.ok(bands.has(meta.band), `${name}: "${meta.band}" is not a band`);
    assert.ok(icons.has(meta.glyph), `${name}: "${meta.glyph}" is not in lib/icons.ts`);
  }
  for (const band of vocabulary.bands) {
    assert.ok(icons.has(band.glyph), `band ${band.id}: "${band.glyph}" is not in lib/icons.ts`);
  }
});

test('one word is one picture: the vocabulary never gives a name two glyphs', () => {
  // The catalogue had "Look" as paintbrush in one tool and sparkle in the next,
  // "Motion" as animate or play, "Scene" as box or image, "Logo" as seal or stamp.
  const seen = new Map<string, string>();
  for (const [name, meta] of Object.entries(vocabulary.sections)) {
    const key = name.trim().toLowerCase();
    const prior = seen.get(key);
    assert.ok(prior === undefined || prior === meta.glyph, `${name} has two glyphs`);
    seen.set(key, meta.glyph);
  }
  // And `play` means playback only, now that Present wears the speech mark.
  assert.equal(vocabulary.sections.Present?.glyph, 'speech');
  assert.equal(vocabulary.sections.Motion?.glyph, 'animate');
});

test('an option picker never gives two options the same glyph', () => {
  // `options[].icon` exists so a long picker is read by shape rather than by
  // reading sixteen words. Two options wearing one glyph give the eye nothing
  // to tell them apart, which is worse than no glyph at all: it looks like
  // information and is not. Backdrop shipped four such pairs on the first pass.
  const roots = [
    join(here, '..', '..', '..', '..', 'community'),
    join(here, '..', '..', '..', '..', 'brands'),
  ];
  const manifests: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > 3) return;
    let entries: string[] = [];
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      const full = join(dir, name);
      if (name === 'tool.json') { manifests.push(full); continue; }
      if (!name.startsWith('.') && !name.includes('.')) walk(full, depth + 1);
    }
  };
  for (const root of roots) walk(root, 0);
  assert.ok(manifests.length > 40, `found ${manifests.length} manifests to check`);

  for (const file of manifests) {
    const manifest = JSON.parse(readFileSync(file, 'utf8')) as {
      inputs?: Array<{ id?: string; options?: Array<{ value?: string; icon?: string }> }>;
    };
    for (const input of manifest.inputs ?? []) {
      const byGlyph = new Map<string, string[]>();
      for (const option of input.options ?? []) {
        if (!option.icon) continue;
        byGlyph.set(option.icon, [...(byGlyph.get(option.icon) ?? []), String(option.value)]);
      }
      for (const [glyph, values] of byGlyph) {
        assert.equal(values.length, 1,
          `${file} input "${input.id}": ${values.join(', ')} all wear "${glyph}"`);
      }
    }
  }
});
