// SPDX-License-Identifier: MPL-2.0
/**
 * Plan 275 section 7.2 step 4: source paragraphs to Design's text subset and back.
 *
 * The oracle is what Design draws. `community/design/hooks.js` is loaded the way the
 * runtime loads it (`new Function('host', ...)`), its `richText` renders the string
 * `designTextOf` wrote, jsdom parses the HTML, and a walk of the DOM reads back each
 * character's bold, italic, underline, strike and colour. Those have to equal the
 * source runs, character by character, list marker aside. The same strings go
 * through the engine's `parseDesignText` and the hooks' own `richParse` (the parser
 * the native pptx lowering uses), and the two have to agree.
 *
 * Run with: node --test tests/design-text.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)

import {
  correctionDrops,
  designTextFromPlain,
  designTextOf,
  escapeMarkup,
  hasDesignMarkup,
  hugMarkers,
  parseDesignText,
  plainOfDesignText,
  type DesignTextRunV1,
} from '../engine/src/design-text.ts';
import { deckToMarkdown } from '../engine/src/deck-md.ts';
import type { SourceParaV1 } from '../packages/core/src/rebrand-v1.ts';

interface HooksApi {
  richText(raw: string): string;
  richParse(raw: string): Array<{ list?: string; number?: number; indent: number; runs: DesignTextRunV1[] }>;
}

const HOOKS = readFileSync(new URL('../community/design/hooks.js', import.meta.url), 'utf8');
const hooks = new Function('host', `${HOOKS}\nreturn { richText: richText, richParse: richParse };`)({}) as HooksApi;

const LABELS = JSON.parse(readFileSync(new URL('./fixtures/rebrand/formatting.labels.json', import.meta.url), 'utf8')) as {
  slides: Array<{ objects: Array<{ id: string; paras?: SourceParaV1[] }> }>;
};
const labelled = (id: string): SourceParaV1[] => {
  for (const slide of LABELS.slides) for (const object of slide.objects) if (object.id === id && object.paras) return object.paras;
  throw new Error(`no labelled paragraphs for ${id}`);
};

// ─── what Design draws, read back from its HTML ──────────────────────────────

interface DrawnChar { ch: string; bold: boolean; italic: boolean; underline: boolean; strike: boolean; color: string | null }

/** Walk Design's rendered HTML into characters with the formatting a browser would paint. */
function drawn(html: string): DrawnChar[] {
  const doc = new JSDOM(`<div id="r" style="white-space:pre-wrap">${html}</div>`).window.document;
  const out: DrawnChar[] = [];
  interface Fmt { strong: boolean; italic: boolean; underline: boolean; strike: boolean; color: string | null; weight: number | null }
  const walk = (node: Node, f: Fmt): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) {
        for (const ch of child.nodeValue ?? '') {
          const bold = f.weight !== null ? f.weight >= 600 : f.strong;
          out.push({ ch, bold, italic: f.italic, underline: f.underline, strike: f.strike, color: f.color });
        }
        continue;
      }
      const el = child as Element;
      const tag = el.tagName.toUpperCase();
      const style = (el as HTMLElement).style;
      const deco = style?.textDecoration ?? '';
      const weight = style?.fontWeight ? Number(style.fontWeight) : null;
      walk(el, {
        strong: f.strong || tag === 'STRONG',
        italic: f.italic || tag === 'EM',
        underline: f.underline || /underline/.test(deco),
        strike: f.strike || /line-through/.test(deco),
        color: style?.color ? style.color : f.color,
        // An explicit weight inside <strong> decides; <strong> inside a weight span is bold again.
        weight: tag === 'STRONG' ? null : weight ?? f.weight,
      });
    }
  };
  walk(doc.getElementById('r') as Element, { strong: false, italic: false, underline: false, strike: false, color: null, weight: null });
  return out;
}

/** The characters the source paragraphs should draw as, with the list marker Design adds. */
function expected(paras: readonly SourceParaV1[], carryColour: boolean): DrawnChar[] {
  const out: DrawnChar[] = [];
  const counters: number[] = [];
  paras.forEach((para, p) => {
    if (p > 0) out.push({ ch: '\n', bold: false, italic: false, underline: false, strike: false, color: null });
    const level = para.lvl ?? 0;
    counters.length = Math.min(counters.length, level + 1);
    let marker = '';
    if (para.bullet === 'number') {
      counters[level] = (counters[level] ?? 0) + 1;
      marker = `${counters[level]}.  `;
    } else {
      counters.length = Math.min(counters.length, level);
      if (para.bullet === 'bullet') marker = '•  ';
    }
    const indent = ' '.repeat(level * 2);
    for (const ch of `${indent}${marker}`) out.push({ ch, bold: false, italic: false, underline: false, strike: false, color: null });
    // A soft line break starts a line with no marker: one level in under a list item.
    const hang = ' '.repeat(marker ? (level + 1) * 2 : level * 2);
    const whole = para.runs.map((run) => run.text).join('');
    let at = 0;
    for (const run of para.runs) {
      for (const ch of run.text) {
        at += 1;
        if (ch === '\n') {
          out.push({ ch, bold: false, italic: false, underline: false, strike: false, color: null });
          // An empty line after a break carries no indent.
          if ((whole.slice(at).split('\n')[0] ?? '') !== '') {
            for (const sp of hang) out.push({ ch: sp, bold: false, italic: false, underline: false, strike: false, color: null });
          }
          continue;
        }
        out.push({
          ch,
          bold: run.bold === true,
          italic: run.italic === true,
          underline: run.underline === true,
          strike: run.strike === true,
          color: carryColour && run.color?.hex ? run.color.hex.toLowerCase() : null,
        });
      }
    }
  });
  return out;
}

/** jsdom reports a colour as rgb(); the source states a hex. */
function hexOfCss(css: string | null): string | null {
  if (!css) return null;
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(css);
  if (!m) return css.toLowerCase();
  return `#${[m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`;
}

/** Compare what Design draws with the source, on visible characters (formatting on a space draws nothing). */
function assertDrawsAsSource(paras: readonly SourceParaV1[], carryColour = true): void {
  const written = designTextOf(paras, { carryColour });
  const got = drawn(hooks.richText(written.text));
  const want = expected(paras, carryColour);
  assert.equal(got.map((c) => c.ch).join(''), want.map((c) => c.ch).join(''), `the words Design draws for ${JSON.stringify(written.text)}`);
  want.forEach((w, i) => {
    const g = got[i] as DrawnChar;
    if (/\s/.test(w.ch)) return;
    const where = `char ${i} ${JSON.stringify(w.ch)} of ${JSON.stringify(written.text)}`;
    assert.equal(g.bold, w.bold, `${where}: bold`);
    assert.equal(g.italic, w.italic, `${where}: italic`);
    // Design's attribute run cannot hold a brace, so a literal brace in an underlined,
    // struck or coloured run is drawn without that attribute. It is the one character
    // the grammar cannot carry, and the words stay whole.
    if (w.ch === '{' || w.ch === '}') return;
    assert.equal(g.underline, w.underline, `${where}: underline`);
    assert.equal(g.strike, w.strike, `${where}: strike`);
    if (w.color) assert.equal(hexOfCss(g.color), w.color, `${where}: colour`);
  });
}

/** Runs merged where two neighbours share every flag, so two parsers compare by what they draw. */
function merged(runs: readonly DesignTextRunV1[]): DesignTextRunV1[] {
  const out: DesignTextRunV1[] = [];
  for (const run of runs) {
    const last = out[out.length - 1];
    const same = last && JSON.stringify({ ...last, text: '' }) === JSON.stringify({ ...run, text: '' });
    if (last && same) last.text += run.text;
    else out.push({ ...run });
  }
  return out;
}

// ─── the shared helpers ──────────────────────────────────────────────────────

test('escapeMarkup escapes for each target, and hugMarkers keeps white space outside', () => {
  assert.equal(escapeMarkup('a*b_c\\d', 'gfm'), 'a\\*b_c\\\\d');
  assert.equal(escapeMarkup('a*b_c\\d', 'design'), 'a\\*b\\_c\\d');
  assert.equal(hugMarkers('  bold ', '**'), '  **bold** ');
  assert.equal(hugMarkers('   ', '**'), '   ');
});

test('deck-md on the shared helpers writes what it always wrote', () => {
  const { markdown: md } = deckToMarkdown({
    widthEmu: 9144000,
    heightEmu: 6858000,
    theme: { colors: {} },
    slides: [{ index: 0, nodes: [{ type: 'text', xEmu: 0, yEmu: 0, cxEmu: 10, cyEmu: 10, paras: [{ runs: [{ text: 'Say ' }, { text: ' 5*3 ', bold: true }, { text: 'now', italic: true }] }] }] }],
  });
  assert.match(md, /Say {2}\*\*5\\\*3\*\* \*now\*/);
});

// ─── writing the subset ──────────────────────────────────────────────────────

test('the formatting fixture body is written as bullets, numbers, levels and inline runs', () => {
  const body = designTextOf(labelled('slide2.4'));
  assert.equal(body.text, [
    '- First bullet with **bold** inside',
    '  - Nested second level',
    '1. Numbered one',
    '2. Numbered two',
    'Right aligned no bullet E=mc2 H2O caps',
    'Visit {u|lolly.tools} for more, in Georgia',
  ].join('\n'));
  assert.equal(body.plain, body.plain.replace(/[*{}|]/g, ''), 'the plain text holds no markup');
  assert.equal(body.align, 'left', 'most characters are set left');
  // The second level's en dash is a glyph Design's round bullet does not draw.
  assert.deepEqual(body.dropped, ['sizes', 'superscript', 'subscript', 'letter case', 'links', 'spacing', 'bullet glyph']);
  // On the renovated path the target master sets the sizes, the spacing and the glyph.
  assert.deepEqual(designTextOf(labelled('slide2.4'), { masterSetsType: true }).dropped, ['superscript', 'subscript', 'letter case', 'links']);

  const lists = designTextOf(labelled('slide3.4'));
  assert.equal(lists.text, [
    '- **Scope:** what the renovation changes',
    '- **Owner:** the team that holds the design system',
    '  - Second level from the master',
    '    - Third level from the master',
    '*Source: annual survey, page 12*',
    '1. Agree the scope',
    '2. Review every slide',
  ].join('\n'), 'the numbered list restarts after the plain line');

  const title = designTextOf(labelled('slide2.3'), { carryColour: true });
  assert.equal(title.text, 'Plain **Bold** *Italic* {u|Under} {s|Strike} {#c00000|Red} Small');
  assert.equal(title.align, 'center');
});

test('a run colour travels on the faithful path, and on the renovated path only when the plan maps it', () => {
  const paras: SourceParaV1[] = [{ runs: [{ text: 'Base ', color: { hex: '#111111' } }, { text: 'accent', color: { hex: '#C00000' } }, { text: ' base again', color: { hex: '#111111' } }] }];
  assert.equal(designTextOf(paras, { carryColour: true }).text, 'Base {#c00000|accent} base again');
  const unmapped = designTextOf(paras, { carryColour: false });
  assert.equal(unmapped.text, 'Base accent base again');
  assert.deepEqual(unmapped.dropped, ['colours']);
  const mapped = designTextOf(paras, { carryColour: false, mapColour: (hex) => (hex === '#c00000' ? '#30BA78' : undefined) });
  assert.equal(mapped.text, 'Base {#30ba78|accent} base again');
  assert.deepEqual(mapped.dropped, []);
});

test('Design draws the fixture paragraphs exactly as the source runs, marker aside', () => {
  for (const id of ['slide1.4', 'slide2.3', 'slide2.4', 'slide3.4']) assertDrawsAsSource(labelled(id));
});

test('literal markup characters stay text: stars, underscores, brace runs, backslashes, list-like starts', () => {
  const cases: SourceParaV1[][] = [
    [{ runs: [{ text: '- not a list, 5 * 3 * 2 and snake_case_name' }] }],
    [{ runs: [{ text: '12. twelve is a sentence here' }] }],
    [{ runs: [{ text: '• a bullet glyph typed by hand' }] }],
    [{ runs: [{ text: 'a literal {u|x} and {#fff|y} and {nope|z}' }] }],
    [{ runs: [{ text: 'bold {u|x} inside', bold: true }, { text: ' then {s|y}', underline: true }] }],
    [{ runs: [{ text: 'path C:\\*.txt and \\_x' }] }],
    [{ runs: [{ text: 'italic ', italic: true }, { text: 'bold italic', bold: true, italic: true }, { text: ' tail', italic: true }] }],
    [{ runs: [{ text: 'under a {brace} here', underline: true, strike: true }] }],
    [{ runs: [{ text: '  two leading spaces then - dash' }] }, { runs: [{ text: '*starred*' }] }],
    [{ runs: [{ text: 'first' }], bullet: 'bullet' }, { runs: [{ text: '' }], bullet: 'bullet' }, { runs: [{ text: 'third' }], bullet: 'bullet' }],
  ];
  for (const paras of cases) assertDrawsAsSource(paras);
});

test('parseDesignText reads back the runs written, and the hooks parser agrees with it', () => {
  const sources = [labelled('slide2.4'), labelled('slide3.4'), labelled('slide2.3'), [
    { runs: [{ text: 'a literal {u|x} ' }, { text: 'bold {#fff|y}', bold: true }, { text: ' under {z}', underline: true }] },
    { runs: [{ text: 'deep' }], bullet: 'number', lvl: 2 },
  ] as SourceParaV1[]];
  for (const paras of sources) {
    const written = designTextOf(paras, { carryColour: true });
    const engine = parseDesignText(written.text);
    const hooked = hooks.richParse(written.text);
    assert.equal(hooked.length, engine.length);
    engine.forEach((line, i) => {
      const other = hooked[i];
      assert.equal(other?.list, line.list, `line ${i}: list kind`);
      assert.equal(other?.indent, line.indent, `line ${i}: indent`);
      assert.deepEqual(merged(other?.runs ?? []), merged(line.runs), `line ${i}: runs`);
    });
    // The words read back are the source's words.
    assert.equal(plainOfDesignText(written.text), paras.map((p) => p.runs.map((r) => r.text).join('')).join('\n'));
  }
});

test('corrected text keeps each line in the list kind of the source paragraph at its place', () => {
  const source = labelled('slide2.4');
  const text = designTextFromPlain('First bullet, fixed\nNested, fixed\nOne\nTwo\nA *starred* note', source);
  assert.equal(text, '- First bullet, fixed\n  - Nested, fixed\n1. One\n2. Two\nA \\*starred\\* note');
  assert.equal(hasDesignMarkup('Plain words only'), false);
  assert.equal(hasDesignMarkup('- a list'), true);
});

// ─── soft breaks, touching markers, numbering (plan 275 review) ─────────────

/** A small deterministic generator, so a failing case can be read back from its seed. */
function prng(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x = (x + 0x6d2b79f5) >>> 0;
    let t = x;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Effective boldness as Design draws it: an explicit weight decides, else `**`. */
const boldOf = (run: DesignTextRunV1): boolean => (run.weight !== undefined ? run.weight >= 600 : run.bold === true);

test('neighbouring bold, italic and bold italic runs, and backslashes before them, draw as the source', () => {
  const alphabet = ['a', 'b', 'c', ' ', '*', '_', '\\', '\\', '{', '}', '|', '-', '1', '.'];
  for (let seed = 1; seed <= 400; seed += 1) {
    const rand = prng(seed);
    const runs = Array.from({ length: 2 + Math.floor(rand() * 4) }, () => {
      const len = 1 + Math.floor(rand() * 5);
      let text = '';
      for (let i = 0; i < len; i += 1) text += alphabet[Math.floor(rand() * alphabet.length)];
      const run: SourceParaV1['runs'][number] = { text };
      if (rand() < 0.5) run.bold = true;
      if (rand() < 0.5) run.italic = true;
      if (rand() < 0.15) run.underline = true;
      if (rand() < 0.1) run.strike = true;
      return run;
    });
    const paras: SourceParaV1[] = [{ runs }];
    assertDrawsAsSource(paras);
    // The engine parser reads the same flags back, character by character.
    const written = designTextOf(paras, { carryColour: true }).text;
    const flags = (list: DesignTextRunV1[]): string => list.flatMap((run) => [...run.text].map((ch) => (/\s/.test(ch) ? ' ' : `${ch}${boldOf(run) ? 'B' : ''}${run.italic ? 'I' : ''}`))).join('|');
    const want = runs.flatMap((run) => [...run.text].map((ch) => (/\s/.test(ch) ? ' ' : `${ch}${run.bold ? 'B' : ''}${run.italic ? 'I' : ''}`))).join('|');
    const line = parseDesignText(written)[0];
    assert.equal(flags(line?.runs ?? []), want, `seed ${seed}: ${JSON.stringify(written)}`);
    assert.equal(flags(hooks.richParse(written)[0]?.runs ?? []), want, `seed ${seed}, hooks parser: ${JSON.stringify(written)}`);
  }
  // The two cases the review named.
  assert.equal(designTextOf([{ runs: [{ text: 'A', italic: true }, { text: 'B', bold: true, italic: true }] }]).text, '*A*{w400|}***B***');
  assert.equal(designTextOf([{ runs: [{ text: 'C:\\' }, { text: 'bold', bold: true }] }]).text, 'C:\\{w400|}**bold**');
});

test('a soft line break stays a line break, with no marker under a list item', () => {
  const title: SourceParaV1[] = [{ runs: [{ text: 'Line one' }, { text: '\n' }, { text: 'Line two', bold: true }] }];
  const written = designTextOf(title);
  assert.equal(written.text, 'Line one\n**Line two**');
  assert.equal(written.plain, 'Line one\nLine two');
  assertDrawsAsSource(title);

  const list: SourceParaV1[] = [
    { runs: [{ text: 'First item' }, { text: '\n' }, { text: '- still the first' }], bullet: 'bullet' },
    { runs: [{ text: 'Second' }], bullet: 'number', lvl: 1 },
    { runs: [{ text: 'Third\nwraps' }], bullet: 'number', lvl: 1 },
  ];
  const lines = designTextOf(list).text.split('\n');
  assert.deepEqual(lines, ['- First item', '  {w400|-} still the first', '  1. Second', '  2. Third', '    wraps']);
  assertDrawsAsSource(list);
  const parsed = parseDesignText(lines.join('\n'));
  assert.equal(parsed[1]?.list, undefined, 'the continuation is not a new item');
  assert.equal(parsed[1]?.level, 1);
  assert.equal(parsed[4]?.list, undefined);
  assert.equal(parsed[4]?.level, 2);
});

test('a numbering Design does not draw is named, and so is a bullet glyph on the faithful path only', () => {
  const lettered: SourceParaV1[] = [{ runs: [{ text: 'one' }], bullet: 'number', numberStyle: 'alphaLcParenR' }];
  assert.deepEqual(designTextOf(lettered).dropped, ['numbering style']);
  assert.deepEqual(designTextOf(lettered, { masterSetsType: true }).dropped, ['numbering style']);
  const arrow: SourceParaV1[] = [{ runs: [{ text: 'one' }], bullet: 'bullet', bulletChar: '\u27a2' }];
  assert.deepEqual(designTextOf(arrow).dropped, ['bullet glyph']);
  assert.deepEqual(designTextOf(arrow, { masterSetsType: true }).dropped, []);
  assert.deepEqual(designTextOf([{ runs: [{ text: 'one' }], bullet: 'bullet', bulletChar: '\u2022' }]).dropped, []);
});

test('a correction maps its lines onto the source paragraphs and their soft breaks, and names what it drops', () => {
  const source: SourceParaV1[] = [
    { runs: [{ text: 'Lead:', bold: true }, { text: ' first\nsecond half' }], bullet: 'bullet' },
    { runs: [{ text: 'Next point', italic: true }], bullet: 'bullet' },
  ];
  const text = designTextFromPlain('Lead: first, fixed\nsecond half\nNext point', source);
  assert.equal(text, '- Lead: first, fixed\n  second half\n- Next point', 'the soft break stays in the first item');
  assert.deepEqual(correctionDrops(source), ['bold', 'italic']);
  assert.deepEqual(correctionDrops([{ runs: [{ text: 'plain' }] }]), []);
});
