// SPDX-License-Identifier: MPL-2.0
/**
 * Quote (community/quote-card): layouts, source lines, design-system colours and motion.
 *
 * Loads the real tool from disk and drives it through the engine, so this guards what
 * ships. What needs a real browser (fit, the SVG file, the Design timeline, the video
 * export) is in tests/quote-card.browser.test.ts.
 *
 * Run with: node --test tests/quote-card.test.ts
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import type { InputValue } from '../engine/src/inputs.ts';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { parseUrlState, RESERVED } from '../engine/src/url-mode.ts';
import { analyseIsolation } from '../scripts/tool-isolation.ts';
import { baseHost } from './helpers/host.ts';

const root = new URL('../community/', import.meta.url);
const read = (path: string): Promise<string> => readFile(new URL(path, root), 'utf8');
const tool = await loadTool('quote-card', read);
const template = await read('quote-card/template.html');
const hooksSource = await read('quote-card/hooks.js');

async function hydrate(values: Record<string, InputValue>, host = baseHost()): Promise<string> {
  const runtime = await createRuntime(tool, host, values);
  const html = runtime.getHydrated();
  runtime.destroy();
  return html;
}

/** What the template prints once the parts a browser ignores are gone. */
function normal(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s*data-canvas-input="[^"]*"/g, '')
    .replace(/<span>([^<]*)<\/span>/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/> </g, '><')
    .trim();
}

test('Motion none is byte-identical to the same inputs without the field', async () => {
  const inputs = { quote: 'Say less.', name: 'Ada', role: 'Editor', layout: 'type', ground: 'ink' };
  assert.equal(await hydrate({ ...inputs, motion: 'none' }), await hydrate(inputs));
  for (const layout of ['beside', 'centred', 'glyph', 'pull', 'citation', 'portrait', 'marker']) {
    assert.equal(await hydrate({ ...inputs, layout, motion: 'none' }), await hydrate({ ...inputs, layout }), layout);
  }
  const link = parseUrlState('quote=Say+less.&layout=type&motion=none', tool.manifest).values;
  const without = parseUrlState('quote=Say+less.&layout=type', tool.manifest).values;
  assert.equal(await hydrate(link), await hydrate(without), 'and the same through a link');
});

test('an old link draws the markup it always drew', async () => {
  // The template as it shipped, for the inputs a link could carry then.
  const was = (ground: string, layout: string, q: string, name: string, role: string, photo: string): string =>
    `<div class="qc qc-${ground} qc-${layout}${photo ? ' qc-has-photo' : ''}">`
    + (photo ? `<div class="qc-photo"><img src="${photo}" alt=""></div>` : '')
    + '<div class="qc-words"><svg class="qc-mark" viewBox="0 0 48 36" aria-hidden="true"><path d="M0 36V20C0 9 7 2 19 0l2 6c-7 2-10 6-10 11h9v19H0Zm27 0V20C27 9 34 2 46 0l2 6c-7 2-10 6-10 11h9v19H27Z"/></svg>'
    + `<p class="qc-quote">${q}</p>`
    + (name ? `<p class="qc-name">${name}</p>` : '')
    + (role ? `<p class="qc-role">${role}</p>` : '')
    + '</div></div>';
  // What this version adds and a browser draws the same: reading direction, and marks
  // for the script to find. A link never asked for any of them.
  const added = (html: string): string => normal(html)
    .replace(/ dir="auto"/g, '')
    .replace(/ data-qc-(?:gfx|meta)=""/g, '')
    .replace(/ data-qc-(?:gfx|meta)(?=[ >])/g, '');
  const cases: Array<[string, string, string, string, string, string]> = [
    ['lead', 'beside', 'The best tools disappear.', 'Maya', 'Head of Product', 'asset:lolly/demo/sample-portrait'],
    ['ink', 'centred', 'Words only.', 'Maya', '', ''],
    ['paper', 'beside', 'No picture here.', '', 'Editor', ''],
  ];
  for (const [ground, layout, quote, name, role, photo] of cases) {
    const link = new URLSearchParams({ quote, name, role, ground, layout, ...(photo ? { headshot: 'lolly/demo/sample-portrait' } : {}) });
    const state = parseUrlState(link.toString(), tool.manifest);
    const html = await hydrate(state.values);
    assert.equal(added(html), was(ground, layout, quote, name, role, photo), `${ground} ${layout}`);
  }
  const manifest = JSON.parse(await read('quote-card/tool.json'));
  const options = manifest.inputs.find((i: { id: string }) => i.id === 'layout').options.map((o: { value: string }) => o.value);
  assert.deepEqual(options.slice(0, 2), ['beside', 'centred'], 'the old values keep their place and their meaning');
  const grounds = manifest.inputs.find((i: { id: string }) => i.id === 'ground').options.map((o: { value: string }) => o.value);
  assert.deepEqual(grounds, ['lead', 'ink', 'paper']);
  assert.equal(manifest.id, 'quote-card');
  assert.equal(manifest.engineVersion, '^1.0.0', 'nothing here raises the engine floor');
});

test('every input travels in a link and none takes a reserved name', () => {
  const manifest = tool.manifest;
  for (const input of manifest.inputs) assert.ok(!RESERVED.has(input.id), `${input.id} is not reserved`);
  const state = parseUrlState('quote=Q&phrase=P&source=S&publication=J&date=1843&link=https%3A%2F%2Fexample.com&motion=word&layout=citation', manifest);
  assert.equal(state.values.phrase, 'P');
  assert.equal(state.values.source, 'S');
  assert.equal(state.values.publication, 'J');
  assert.equal(state.values.date, '1843');
  assert.equal(state.values.link, 'https://example.com');
  assert.equal(state.values.motion, 'word');
});

test('nothing the person typed reaches the page unescaped', async () => {
  const evil = '<img src=x onerror=alert(1)>"&';
  for (const layout of ['type', 'citation', 'marker']) {
    const html = normal(await hydrate({ quote: `Before ${evil} after`, phrase: evil, name: evil, role: evil, source: evil, publication: evil, date: evil, link: `https://x.test/${evil}`, layout, motion: 'word' }));
    assert.doesNotMatch(html, /<img src=x/, layout);
    assert.match(html, /&lt;img/, layout);
  }
});

test('an empty field leaves no gap and no stray punctuation', async () => {
  const words = (html: string): string => normal(html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const ref = async (values: Record<string, InputValue>): Promise<string> => {
    const html = await hydrate({ quote: 'Q', layout: 'citation', ...values });
    const m = /<p class="qc-ref"[^>]*>([\s\S]*?)<\/p>/.exec(html);
    return m ? words(m[1]!) : '';
  };
  assert.equal(await ref({ name: '', role: '' }), '', 'nothing typed, no reference');
  assert.doesNotMatch(normal(await hydrate({ quote: 'Q', layout: 'citation', name: '', role: '' })), /qc-rule/, 'and no rule waiting for one');
  assert.equal(await ref({ name: 'Ada', role: '' }), 'Ada.');
  assert.equal(await ref({ name: 'Ada', role: 'Editor' }), 'Ada, Editor.');
  assert.equal(await ref({ name: '', role: '', source: 'A Work' }), 'A Work.');
  assert.equal(await ref({ name: '', role: '', publication: 'Nature', date: '1843' }), 'Nature, 1843.');
  assert.equal(await ref({ name: '', role: '', date: '1843' }), '1843.');
  assert.equal(await ref({ name: 'Ada', role: '', source: 'Why?', publication: 'Nature', date: '' }), 'Ada. Why? Nature.', 'a mark already there is not doubled');
  const plain = normal(await hydrate({ quote: 'Q', layout: 'type', name: '', role: '' }));
  for (const part of ['qc-name', 'qc-role', 'qc-source', 'qc-link']) assert.doesNotMatch(plain, new RegExp(`class="${part}`), part);
  const beside = await hydrate({ quote: 'Q', layout: 'pull', name: '', role: '', source: 'A Work', date: '1843' });
  assert.equal(words(/<p class="qc-source"[^>]*>([\s\S]*?)<\/p>/.exec(beside)![1]!), 'A Work, 1843');
  assert.doesNotMatch(normal(await hydrate({ quote: 'Q', layout: 'pull', name: '', role: '', date: '' })), /qc-source/);
});

test('the phrase marks what was typed, and never a guess', async () => {
  const marker = (quote: string, phrase: string): Promise<string> => hydrate({ quote, phrase, layout: 'marker' });
  const marked = (html: string): string => [...html.matchAll(/class="qc-w qc-hl"[^>]*>(?:<span class="qc-hlbg"[^>]*><\/span>)?([^<]*)</g)].map(m => m[1]).join(' ');
  assert.equal(marked(await marker('The best tools disappear.', 'best tools')), 'best tools');
  assert.equal(marked(await marker('The best tools disappear.', 'BEST TOOLS')), 'best tools', 'ignoring case');
  assert.equal(marked(await marker('The best tools disappear.', 'worst')), '', 'not in the quote, so nothing');
  assert.equal(marked(await marker('The best tools disappear.', '')), '');
  assert.equal(marked(await marker('The best tools disappear, so.', 'disappear')), 'disappear,', 'a mark stays with its word, so it never sits half under the edge');
  assert.equal(marked(await marker('Disappearing acts', 'appear')), 'Disappearing', 'a word is not cut in two');
  assert.equal(marked(await marker('工具无形，让作品说话。', '无形')), '无 形，', 'a closing mark stays with the character before');
  assert.doesNotMatch(normal(await hydrate({ quote: 'Plain words', phrase: 'Plain', layout: 'type' })), /qc-hl/, 'other layouts strengthen it instead');
  assert.match(await hydrate({ quote: 'Plain words', phrase: 'Plain', layout: 'type' }), /<span class="qc-em">Plain<\/span>/);
});

test('motion splits by word, keeps a reading order and holds punctuation to its character', async () => {
  const units = (html: string): string[] => [...html.matchAll(/class="qc-w(?: [^"]*)?"[^>]*>([^<]*)</g)].map(m => m[1]!);
  assert.deepEqual(units(await hydrate({ quote: 'Say less now', layout: 'type', motion: 'word' })), ['Say', 'less', 'now']);
  assert.deepEqual(units(await hydrate({ quote: 'Say less now', layout: 'type', motion: 'draw' })), [], 'a block entrance needs no units');
  assert.deepEqual(units(await hydrate({ quote: 'Say less now', layout: 'type' })), [], 'nor does a still');
  assert.deepEqual(units(await hydrate({ quote: 'كلمة واحدة', layout: 'type', motion: 'word' })), ['كلمة', 'واحدة'], 'Arabic moves by word, kept joined');
  assert.deepEqual(units(await hydrate({ quote: 'هذا Lolly Tools هنا', layout: 'type', motion: 'word' })), [], 'mixed directions stay inline, because order matters more');
  assert.deepEqual(units(await hydrate({ quote: '道具は「作品」、語る。', layout: 'type', motion: 'word' })),
    ['道', '具', 'は', '「作', '品」、', '語', 'る。'], 'no line starts or ends on the wrong mark');
  const html = await hydrate({ quote: 'Say less', layout: 'type', motion: 'word' });
  assert.match(html, /role="text" aria-label="Say less"/, 'the whole sentence is still read aloud');
  assert.match(html, /<span class="qc-w" aria-hidden="true">Say<\/span> <span class="qc-w"/, 'with a real space between units');
});

test('a long quote deals faster, and the clip holds long enough to read twice', async () => {
  const data = (html: string) => JSON.parse(/class="qc-motion-data">([\s\S]*?)<\/script>/.exec(html)![1]!);
  const short = data(await hydrate({ quote: 'Say less.', layout: 'type', motion: 'word' }));
  assert.equal(short.staggerMs, 80);
  assert.equal(short.holdMs, 2000, 'never under two seconds');
  const many = Array.from({ length: 120 }, (_, i) => `w${i}`).join(' ');
  const long = data(await hydrate({ quote: many, layout: 'type', motion: 'word' }));
  assert.ok(long.staggerMs * 120 <= 5000, 'an entrance stays an entrance');
  assert.equal(long.holdMs, 12000, 'and the hold is capped');
});

// ── Motion plan ─────────────────────────────────────────────────────────────

const motionSource = template.slice(template.indexOf('// qc-motion-start'), template.indexOf('// qc-motion-end'));
const motion: any = vm.createContext({ Math });
vm.runInContext(motionSource, motion);
const PLAN = { unitMs: 400, blockMs: 700, staggerMs: 80, ease: 'cubic-bezier(0.05,0.7,0.1,1)', holdMs: 2000 };

test('one thing moves at a time, and the graphic, the quote and the name keep their order', () => {
  for (const name of ['word', 'line', 'sweep', 'draw']) {
    const plan = motion.qcPlan({ ...PLAN, motion: name }, { gfx: 1, units: 6, lines: 2, marks: 2, meta: 2 });
    assert.equal(plan.gfx.at, 0, name);
    const quote = plan.unit ?? plan.mark ?? plan.block;
    assert.ok(quote.at > 0, `${name}: the quote starts after the graphic`);
    assert.ok(plan.meta.at > quote.at, `${name}: the name follows the quote`);
    assert.ok(plan.end > plan.meta.at, name);
  }
  assert.equal(motion.qcPlan({ ...PLAN, motion: 'word' }, { gfx: 0, units: 3, lines: 1, marks: 0, meta: 0 }).unit.at, 0, 'nothing to wait for');
  assert.ok(motion.qcPlan({ ...PLAN, motion: 'sweep' }, { gfx: 0, units: 0, lines: 0, marks: 0, meta: 0 }).block, 'a sweep with no phrase fades the words in');
  assert.ok(motion.qcPlan({ ...PLAN, motion: 'word' }, { gfx: 0, units: 0, lines: 0, marks: 0, meta: 0 }).block, 'mixed directions fade the block in');
});

test('the plan is a pure function, so a frame is the same wherever it is drawn', () => {
  const a = motion.qcPlan({ ...PLAN, motion: 'line' }, { gfx: 1, units: 8, lines: 3, marks: 0, meta: 1 });
  const b = motion.qcPlan({ ...PLAN, motion: 'line' }, { gfx: 1, units: 8, lines: 3, marks: 0, meta: 1 });
  assert.deepEqual({ ...a }, { ...b });
  assert.doesNotMatch(motionSource, /Date|performance|random/i, 'no clock and no dice in the plan');
  assert.equal(motion.qcSpec('rise', false, 400, PLAN.ease, 80), 'qc-rise 400ms cubic-bezier(0.05,0.7,0.1,1) 80ms');
  assert.equal(motion.qcSpec('wipe', true, 700, PLAN.ease, 0), 'qc-wipe-rtl 700ms linear 0ms', 'a wipe keeps an even pace, against the reading direction');
});

test('the export clock declares a still pose, and the preview respects reduced motion', () => {
  assert.match(template, /__lollyFrameRender\.stillPose = true/);
  assert.match(template, /if \(!\(clipSec > 0\)\) \{ settle\(\);/, 'a still is the page at rest');
  assert.match(template, /prefers-reduced-motion: reduce/);
  assert.match(template, /data-a11y-motion/);
  const css = motionSource + (template.match(/<style[\s\S]*?<\/style>/) ?? [''])[0];
  assert.doesNotMatch(css, /prefers-reduced-motion/, 'an export never reads the preference');
});

test('durations and the curve come from the design system where it names them', async () => {
  const data = (html: string) => JSON.parse(/class="qc-motion-data">([\s\S]*?)<\/script>/.exec(html)![1]!);
  const tokens = {
    resolve: async (ref: string) => ({
      '{motion.duration.medium}': { value: 250, unit: 'ms' },
      '{motion.duration.long}': '0.9s',
      '{motion.curve.emphasised}': [0.2, 0, 0, 1],
    } as Record<string, unknown>)[ref] ?? null,
    colors: async () => [],
    get: async () => ({}),
  };
  const named = data(await hydrate({ quote: 'Say less.', layout: 'type', motion: 'word' }, baseHost({ tokens })));
  assert.equal(named.unitMs, 250);
  assert.equal(named.blockMs, 900);
  assert.equal(named.ease, 'cubic-bezier(0.2,0,0,1)');
  const silent = data(await hydrate({ quote: 'Say less.', layout: 'type', motion: 'word' }));
  assert.equal(silent.unitMs, 400, 'a system that names no motion keeps the built-in timing');
  assert.equal(silent.ease, 'cubic-bezier(0.05,0.7,0.1,1)');
});

// ── Colours ─────────────────────────────────────────────────────────────────

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const contrast = (a: string, b: string): number => {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const demo = JSON.parse(await readFile(new URL('../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json', import.meta.url), 'utf8'));
const start = JSON.parse(await readFile(new URL('../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url), 'utf8'));

function hostFor(doc: unknown, selection: Record<string, string>) {
  const set = createTokenSet(doc, { selection } as never);
  return baseHost({ tokens: { resolve: async (ref: string) => set.resolve(ref), get: async () => set, colors: async () => [] } });
}

const SYSTEMS: Array<[string, unknown, Record<string, string>]> = [
  ['Lolly Start light', start, { '': 'light' }],
  ['Lolly Start dark', start, { '': 'dark' }],
  ...['spearmint', 'morning', 'spring', 'beach', 'afternoon', 'midnight'].flatMap((colourway): Array<[string, unknown, Record<string, string>]> => [
    [`Lolly Demo ${colourway} light`, demo, { '': 'light', colourway }],
    [`Lolly Demo ${colourway} dark`, demo, { '': 'dark', colourway }],
  ]),
];

test('every colour comes from the design system and is measured against its own ground', async () => {
  for (const [name, doc, selection] of SYSTEMS) {
    const set = createTokenSet(doc, { selection } as never);
    const slot = (s: string): string => String(set.resolve(`{color.semantic.${s}}`));
    const host = hostFor(doc, selection);
    const grounds = { lead: slot('primary'), ink: slot('text'), paper: slot('surface') };
    for (const [ground, g] of Object.entries(grounds)) {
      const html = await hydrate({ quote: 'Say less now', phrase: 'less', layout: 'marker', ground }, host);
      const style = /class="qc [^"]*" style="([^"]+)"/.exec(html)?.[1];
      assert.ok(style, `${name} ${ground}: the design system was read`);
      const vars = Object.fromEntries(style.split(';').map(p => p.split(':')) as [string, string][]);
      const known = new Set(Object.values(grounds).concat(slot('on-primary'), slot('secondary')).map(c => c.toLowerCase()));
      for (const key of ['--qc-deco', '--qc-band', '--qc-em', '--qc-hl-bg', '--qc-hl-ink']) {
        assert.ok(known.has(vars[key]!.toLowerCase()), `${name} ${ground}: ${key} ${vars[key]} is one of the system's colours`);
      }
      const label = `${name} on ${ground}`;
      assert.ok(contrast(vars['--qc-deco']!, g) >= 2.9, `${label}: the decoration shows, ${contrast(vars['--qc-deco']!, g).toFixed(2)}:1`);
      assert.ok(contrast(vars['--qc-em']!, g) >= 4.4, `${label}: an emphasised word reads, ${contrast(vars['--qc-em']!, g).toFixed(2)}:1`);
      assert.ok(contrast(vars['--qc-hl-ink']!, vars['--qc-hl-bg']!) >= 4.4, `${label}: words on the marker read, ${contrast(vars['--qc-hl-ink']!, vars['--qc-hl-bg']!).toFixed(2)}:1`);
    }
  }
});

test('the words themselves never use the lead colour on the surface', async () => {
  const css = await read('quote-card/styles.css');
  const paper = /^\.qc \{[\s\S]*?^\}/m.exec(css)![0];
  assert.match(paper, /--qc-ink: var\(--brand-text/, 'on paper the words are the text colour');
  assert.doesNotMatch(css, /[^-]color:\s*var\(--brand-primary/, 'no rule colours text with the lead');
  assert.doesNotMatch(css, /font-weight:\s*(?:[1-3]00|[6-9]00|bold)/, 'Design text keeps to 400 and 500');
  assert.doesNotMatch(css, /font-family:(?!\s*var\()/, 'brand fonts only');
});

test('a colourway switch redraws the card the way a fresh mount in that colourway does', async () => {
  const LEADS: Record<string, string> = { spearmint: '#033633', spring: '#da1889' };
  const tokens = {
    resolve: async (ref: string, opts: { selection?: Record<string, string> } = {}) => ({
      '{color.semantic.primary}': LEADS[opts.selection?.colourway ?? 'spearmint'],
      '{color.semantic.on-primary}': '#ffffff',
      '{color.semantic.secondary}': '#008657',
      '{color.semantic.surface}': '#ffffff',
      '{color.semantic.text}': '#09141a',
    } as Record<string, string | undefined>)[ref] ?? '',
    colors: async () => [],
    get: async () => ({}),
  };
  const values = { quote: 'Q', layout: 'pull', ground: 'paper' };
  const live = await createRuntime(tool, baseHost({ tokens }), values);
  assert.match(live.getHydrated(), /--qc-deco:#033633/);
  await live.setTokenSelection({ colourway: 'spring' });
  assert.match(live.getHydrated(), /--qc-deco:#da1889/);
  const fresh = await createRuntime(tool, baseHost({ tokens }), values, { tokenSelection: { colourway: 'spring' } });
  assert.equal(live.getHydrated(), fresh.getHydrated());
  live.destroy();
  fresh.destroy();
});

test('the hooks touch nothing a Worker lacks', () => {
  const { clean, realmBound } = analyseIsolation(hooksSource);
  assert.ok(clean, JSON.stringify(realmBound));
  assert.equal(tool.manifest.isolate, true);
  assert.doesNotMatch(hooksSource, /\bhost\.(?!tokens\b)/, 'the only host API it reads is tokens, guarded, so requires stays empty');
});
