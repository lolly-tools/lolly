// SPDX-License-Identifier: MPL-2.0
/**
 * Pricing Table (brands/suse/tools/pricing-table) - table-to-sheet contract.
 *
 * Loads the REAL tool from disk (manifest + template + hooks) and drives it
 * through the engine with the shared base host, so this guards the shipped
 * behaviour rather than a fixture.
 *
 * What is pinned here:
 *  - the default seed renders one card per plan column, and the featured
 *    column carries both the highlight class and its label;
 *  - the cell grammar (tick / cross / text / leading arrow marker);
 *  - highlight 0 means no featured column;
 *  - a one-column or empty table renders a friendly note and never throws;
 *  - the csv export round-trips the header and a row, quoting per RFC 4180.
 *
 * Run with: node --test tests/pricing-table.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { apcaContrast } from '../engine/src/color-tools.ts';
import { baseHost } from './helpers/host.ts';

// pricing-table ships in the (private) SUSE brand pack. Load from the SOURCE pack,
// not the gitignored tools/ profile view, so the suite is profile-independent:
// skip only when the pack itself is not mounted (public CI / lolly-start
// checkouts); with it mounted, a missing tool dir means a rename or delete and
// must fail loudly, never silently skip.
const SUSE_TOOLS = join(dirname(fileURLToPath(import.meta.url)), '..', 'brands', 'suse', 'tools');
const fetchFile = (path: string) => readFile(join(SUSE_TOOLS, path), 'utf8');

const PACK_MOUNTED = existsSync(SUSE_TOOLS);
const SKIP = !PACK_MOUNTED && 'SUSE brand pack not mounted (see profiles.json)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(SUSE_TOOLS, 'pricing-table', 'tool.json')),
    'brands/suse/tools/pricing-table/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}

const tool: any = SKIP ? null : await loadTool('pricing-table', fetchFile);

async function mount(initialState: any = {}) {
  const rt = await createRuntime(tool, baseHost(), initialState);
  return { rt, html: rt.getHydrated() as string };
}

// A wrapping export.render, like the CLI bridge: the engine hands the hydrated
// sibling-template text through opts.dataText, so the blob is the real export.
function exportHost(): any {
  const host: any = baseHost();
  host.export = {
    render: async (_n: unknown, _f: string, opts: any) =>
      new Blob([opts.dataText ?? '<no-data>'], { type: opts.dataMime ?? 'text/plain' }),
  };
  return host;
}

const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

const PKG = join(SUSE_TOOLS, 'pricing-table');
const readJson = async (p: string) => JSON.parse(await readFile(join(PKG, p), 'utf8'));

test('default seed: one card per plan column, the featured one flagged and labelled', { skip: SKIP }, async () => {
  const { rt, html } = await mount();

  // The manifest default has 4 columns: Feature + 3 plans.
  assert.equal(rt.getHydratedString('{{tierCount}}'), '3');
  assert.equal(count(html, /class="pt-tier/g), 3);
  // 8 default rows minus the price row and the Tagline row.
  assert.equal(rt.getHydratedString('{{featureCount}}'), '6');

  // highlight defaults to 2, so the SECOND plan (Team) is the featured one.
  const tiers = rt.getHydratedString('{{#each tiers}}{{name}}|{{price}}|{{tagline}}|{{highlighted}}|{{badge}};{{/each}}') as string;
  assert.equal(tiers,
    'Starter|$9 / month|For solo work|false|;'
    + 'Team|$29 / month|For growing teams|true|Most popular;'
    + 'Enterprise|Talk to us|For the whole org|false|;');

  // Exactly one tier header carries the highlight class, and it prints its label.
  assert.equal(count(html, /class="pt-tier pt-on"/g), 1);
  assert.match(html, /<span class="pt-badge">Most popular<\/span>/);
  // The Tagline row is a subtitle, never a feature row.
  assert.ok(!html.includes('>Tagline<'), 'the Tagline row must not render as a feature');

  // Every feature cell in the featured column is flagged, so the wash runs the
  // full height of the card, past its header too.
  assert.equal(count(html, /class="pt-cell pt-on/g), 6);
  // The last feature row is marked on both the label and every cell, which is
  // what rounds the bottom of each card.
  assert.equal(count(html, /class="pt-feature pt-last"/g), 1);
});

test('cell grammar: yes and no words become glyphs, everything else stays text', { skip: SKIP }, async () => {
  const { rt } = await mount({
    highlight: 0,
    data: {
      columns: ['Feature', 'A'],
      rows: [
        ['Price', '$1'],
        ['yes word', 'yes'],
        ['y word', 'Y'],
        ['true word', 'TRUE'],
        ['tick word', 'tick'],
        ['check mark', '✓'],
        ['no word', 'no'],
        ['n word', 'N'],
        ['false word', 'false'],
        ['x word', 'x'],
        ['cross word', 'cross'],
        ['dash', '-'],
        ['plain text', 'Two seats'],
        ['arrow marker', '> Named contact'],
        ['missing cell', ''],
      ],
    },
  });

  const kinds = rt.getHydratedString('{{#each rows}}{{name}}={{#each cells}}{{kind}}{{/each}};{{/each}}') as string;
  assert.equal(kinds,
    'yes word=tick;y word=tick;true word=tick;tick word=tick;check mark=tick;'
    + 'no word=cross;n word=cross;false word=cross;x word=cross;cross word=cross;dash=cross;'
    + 'plain text=text;arrow marker=text;missing cell=text;');

  const html = rt.getHydrated() as string;
  assert.equal(count(html, /aria-label="Included"/g), 5);
  assert.equal(count(html, /aria-label="Not included"/g), 6);
  // A leading ">" runs through the arrow helper, so the sheet prints a glyph.
  assert.match(html, /<span class="pt-text">→ Named contact<\/span>/);
  assert.match(html, /<span class="pt-text">Two seats<\/span>/);
  // A missing cell is empty text, never a cross.
  assert.match(html, /<span class="pt-text"><\/span>/);
});

test('a ragged row pads to empty text and never shifts a plan column', { skip: SKIP }, async () => {
  const { rt } = await mount({
    highlight: 0,
    data: {
      columns: ['Feature', 'A', 'B'],
      rows: [
        ['Price', '$1', '$2'],
        ['short', 'yes'],
      ],
    },
  });
  assert.equal(rt.getHydratedString('{{#each rows}}{{#each cells}}[{{kind}}:{{text}}]{{/each}}{{/each}}'),
    '[tick:][text:]');
});

test('highlight 0 renders no featured column', { skip: SKIP }, async () => {
  const { html, rt } = await mount({ highlight: 0 });
  // Not followed by a letter or dash, so the root's --pt-on-accent property
  // (always present) is not mistaken for the highlight class.
  assert.equal(count(html, /pt-on(?![-a-z])/g), 0, 'nothing may carry the highlight class at highlight 0');
  assert.ok(!html.includes('pt-badge'), 'no featured label without a featured column');
  assert.equal(rt.getHydratedString('{{#each tiers}}{{highlighted}}{{/each}}'), 'falsefalsefalse');
});

test('an empty button label drops the whole button row', { skip: SKIP }, async () => {
  const withCta = (await mount()).html;
  assert.equal(count(withCta, /class="pt-act/g), 3);
  assert.match(withCta, /class="pt-cta">Get started</);

  const without = (await mount({ cta: '' })).html;
  assert.equal(count(without, /class="pt-act/g), 0);
  assert.ok(!without.includes('pt-hascta'), 'the layout must know the button row is gone');
});

test('an empty or single-column table renders the note and never throws', { skip: SKIP }, async () => {
  for (const data of [
    { columns: ['Feature'], rows: [['Price']] },
    { columns: [], rows: [] },
    { columns: ['Feature', 'A'], rows: [] },
  ]) {
    const { rt, html } = await mount({ data });
    assert.match(html, /class="pt-note"/, `no friendly note for ${JSON.stringify(data)}`);
    assert.ok(!html.includes('class="pt-table"'), 'the grid must not render without usable data');
    // The heading still paints, so the canvas is never blank.
    assert.match(html, /class="pt-heading"/);
    assert.equal(rt.getHydratedString('{{tierCount}}'), '0');
    assert.ok((rt.getHydratedString('{{error}}') as string).length > 10, 'the note must say what to do');
  }
});

test('csv export round-trips the columns and rows, quoting per RFC 4180', { skip: SKIP }, async () => {
  const rt = await createRuntime(tool, exportHost(), {});
  const blob = await rt.export({}, 'csv', { embedMeta: false });
  const lines = (await blob.text()).split('\n');

  assert.equal(lines[0], 'Feature,Starter,Team,Enterprise');
  assert.equal(lines[1], 'Price,$9 / month,$29 / month,Talk to us');
  // "Email, next day" holds a comma, so RFC 4180 quoting must kick in.
  assert.equal(lines[8], 'Support,Community,"Email, next day",> Named contact');
  assert.equal(lines.filter(Boolean).length, 9, 'header plus the eight table rows');
});

// ── Seeds: every shipped starting point has to mount and paint ───────────────

test('every example, template and preset seed hydrates with no error note', { skip: SKIP }, async () => {
  const seeds: Array<[string, Record<string, unknown>]> = [];

  const manifest = await readJson('tool.json');
  for (const ex of manifest.examples) seeds.push([`example "${ex.label}"`, ex.values]);

  const dir = join(PKG, 'templates');
  const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  assert.ok(files.length >= 3, 'the tool ships at least three starting templates');
  for (const file of files) {
    const t = await readJson(join('templates', file));
    assert.equal(t.id, file.replace(/\.json$/, ''), `${file}: template id must match its basename`);
    seeds.push([`template "${t.id}"`, t.values]);
    for (const p of t.presets ?? []) {
      // A preset is a values OVERLAY on its template base, which is how the
      // shell's chooser applies it.
      seeds.push([`preset "${t.id}/${p.id}"`, { ...t.values, ...p.values }]);
    }
  }

  const declared = new Set<string>(manifest.inputs.map((i: { id: string }) => i.id));
  for (const [label, values] of seeds) {
    for (const key of Object.keys(values)) {
      assert.ok(declared.has(key), `${label} sets "${key}", which is not a declared input`);
    }
    const { rt, html } = await mount(values);
    assert.equal(rt.getHydratedString('{{error}}'), '', `${label} must not land on the error note`);
    assert.match(html, /class="pt-table"/, `${label} must render the grid`);
    assert.ok(Number(rt.getHydratedString('{{tierCount}}')) >= 2, `${label} needs at least two plans`);
    assert.ok(Number(rt.getHydratedString('{{featureCount}}')) >= 3, `${label} needs real sample content`);
    // No unresolved token alias or empty custom property may reach the markup.
    assert.ok(!html.includes('{color.'), `${label} leaked a token alias into the render`);
    assert.equal(count(html, /--pt-[a-z-]+:(;|")/g), 0, `${label} left a colour property empty`);
  }
});

// ── Defects found in review ─────────────────────────────────────────────────

test('a check mark carrying an emoji variation selector still reads as a glyph', { skip: SKIP }, async () => {
  // A tick pasted from an emoji picker or a spreadsheet arrives as the glyph
  // plus U+FE0F. Without stripping it the cell fell through to plain text.
  const { rt } = await mount({
    highlight: 0,
    data: {
      columns: ['Feature', 'A'],
      rows: [
        ['Price', '$1'],
        ['heavy tick + VS16', '✔️'],
        ['ballot tick + VS16', '☑️'],
        ['text presentation', '✔︎'],
        ['heavy multiplication', '✖️'],
        ['multiplication x', '✕'],
        ['ballot with x', '☒'],
        ['tick inside a phrase', '✔️ and more'],
      ],
    },
  });
  assert.equal(rt.getHydratedString('{{#each rows}}{{#each cells}}{{kind}} {{/each}}{{/each}}'),
    'tick tick tick cross cross cross text ');
  // Only the whole-cell match is a glyph; a selector inside a phrase is left in
  // the printed text untouched.
  assert.match(rt.getHydrated() as string, /<span class="pt-text">✔️ and more<\/span>/);
});

test('the featured badge ink is the side the engine APCA would pick', { skip: SKIP }, async () => {
  // The hook cannot import the engine, so it carries a threshold on APCA's own
  // luminance. This pins that threshold to engine/src/color-tools.ts, the
  // authority: a plain 8-bit brightness test disagreed on colours like #889988.
  const accents = ['#2563eb', '#889988', '#999955', '#00cc11', '#7799bb', '#f4d03f',
    '#111417', '#ffffff', '#808080', '#a3a3a3', '#0d7a5f', '#7c3aed'];
  for (const accent of accents) {
    const { rt } = await mount({ accent, highlight: 1 });
    const picked = rt.getHydratedString('{{onAccentColor}}') as string;
    const other = picked === '#ffffff' ? '#111417' : '#ffffff';
    assert.ok(
      Math.abs(apcaContrast(picked, accent)) >= Math.abs(apcaContrast(other, accent)),
      `on ${accent} the badge picked ${picked} (Lc ${apcaContrast(picked, accent).toFixed(1)}) `
      + `over ${other} (Lc ${apcaContrast(other, accent).toFixed(1)})`,
    );
  }
});

test('a whitespace-only button label drops the row, like an empty one', { skip: SKIP }, async () => {
  // The row used to be gated on the raw input, so "   " left three padded but
  // empty cells and told the grid layout a button row was there.
  const { html } = await mount({ cta: '   ' });
  assert.equal(count(html, /class="pt-act/g), 0, 'no button row for a blank label');
  assert.ok(!html.includes('pt-hascta'), 'the layout must not reserve room for it');
});

test('a Button row is authoritative per plan; an empty cell leaves a gap, not the global label', { skip: SKIP }, async () => {
  const { rt, html } = await mount({
    cta: 'Get started',
    highlight: 0,
    data: {
      columns: ['Feature', 'Free', 'Pro'],
      rows: [
        ['Price', '$0', '$9'],
        ['Button', '', 'Buy for $9'],   // empty = no button under Free (a gap)
        ['Link', '/signup', 'https://example.com/pro'],
        ['Seats', '1', 'yes'],
      ],
    },
  });

  // The Button/Link rows drop out of the feature list.
  assert.equal(rt.getHydratedString('{{featureCount}}'), '1');
  // Empty cell does NOT fall back to the global "Get started".
  assert.equal(rt.getHydratedString('{{#each tiers}}{{ctaLabel}}|{{href}};{{/each}}'),
    '|/signup;Buy for $9|https://example.com/pro;');

  // The button ROW still appears (Pro has a button), but Free's slot is empty -
  // no button element even though it carries a link.
  assert.equal(count(html, /class="pt-act/g), 2, 'both plans keep their slot');
  assert.equal(count(html, /class="pt-cta"/g), 1, 'only the plan with a label has a button');
  assert.match(html, /<a class="pt-cta" href="https:\/\/example\.com\/pro"[^>]*>Buy for \$9<\/a>/);
  assert.ok(html.includes('rel="noopener noreferrer"'), 'external links carry a safe rel');

  // With no Button row at all, the global label sits under every plan.
  const global = (await mount({
    cta: 'Start now', highlight: 0,
    data: { columns: ['Feature', 'A', 'B'], rows: [['Price', '$1', '$2'], ['Seats', '1', '2']] },
  })).rt;
  assert.equal(global.getHydratedString('{{#each tiers}}{{ctaLabel}};{{/each}}'), 'Start now;Start now;');
});

test('a bare domain gets https, and javascript/data links are dropped', { skip: SKIP }, async () => {
  const { rt, html } = await mount({
    cta: 'Go',
    highlight: 0,
    data: {
      columns: ['Feature', 'A', 'B', 'C'],
      rows: [
        ['Price', '$1', '$2', '$3'],
        // eslint-disable-next-line no-script-url
        ['Link', 'suse.com/pricing', 'javascript:alert(1)', 'data:text/html,x'],
        ['Seats', '1', '2', '3'],
      ],
    },
  });
  assert.equal(rt.getHydratedString('{{#each tiers}}[{{href}}]{{/each}}'),
    '[https://suse.com/pricing][][]');
  // The unsafe schemes leave a plain-text button, never an anchor.
  assert.ok(!/javascript:|data:text/.test(html), 'no unsafe scheme reaches the markup');
  assert.equal(count(html, /<a class="pt-cta"/g), 1, 'only the safe link is an anchor');
});

test('the text colour is derived from the background, not taken as an input', { skip: SKIP }, async () => {
  // `color` is no longer a declared input.
  const manifest = await readJson('tool.json');
  assert.ok(!manifest.inputs.some((i: { id: string }) => i.id === 'color'),
    'the text colour must not be a user input');

  // A light sheet gets dark ink; a dark sheet gets light ink. The property is
  // always a real hex, so the render never leaks an empty colour.
  const onLight = await mount({ background: '#ffffff' });
  const onDark = await mount({ background: '#101418' });
  const inkLight = onLight.rt.getHydratedString('{{inkColor}}') as string;
  const inkDark = onDark.rt.getHydratedString('{{inkColor}}') as string;
  assert.match(inkLight, /^#[0-9a-f]{6}$/);
  assert.match(inkDark, /^#[0-9a-f]{6}$/);
  assert.notEqual(inkLight, inkDark, 'the ink flips with the background lightness');
  // Ink and paper stay far apart in luminance (readable), whichever way round.
  assert.ok(Math.abs(apcaContrast(inkLight, '#ffffff')) > 60);
  assert.ok(Math.abs(apcaContrast(inkDark, '#101418')) > 60);
});

test('the featured plan is carried by fill and badge, never an accent border', { skip: SKIP }, async () => {
  // The one-sided / coloured accent border on a rounded card is a banned tell.
  const css = await readFile(join(PKG, 'styles.css'), 'utf8');
  // No rule paints an accent-coloured border anywhere.
  assert.ok(!/border[a-z-]*:\s*[^;]*var\(--pt-accent/.test(css),
    'the accent colour must never be used as a border');
  // The highlight is a background wash, and the featured cells all carry it.
  const { html } = await mount({ highlight: 1 });
  assert.ok(/\.pt-on[^{]*{[^}]*background:\s*var\(--pt-tint/.test(css.replace(/\s+/g, ' ')),
    'the featured wash is a tint fill');
  assert.ok(count(html, /class="pt-cell pt-on/g) >= 1);
});

test('the grid layout rules the first feature row, not the plan headers', { skip: SKIP }, async () => {
  // The header rule is the first feature row's own top border. Drawing it under
  // the plan headers stacked two lines and skipped the label column, which has
  // no header cell.
  const { html } = await mount({ layout: 'grid' });
  assert.equal(count(html, /class="pt-feature pt-first"/g), 1);
  assert.equal(count(html, /class="pt-cell(?: pt-on)? pt-first"/g), 3, 'one first-row cell per plan');
  const css = await readFile(join(PKG, 'styles.css'), 'utf8');
  assert.ok(!/\.pt-grid[^{]*\.pt-(tier|act)\s*{[^}]*border-bottom:\s*[1-9]/.test(css),
    'the plan headers must not draw their own bottom rule');

  // One feature row means the same row is both first and last.
  const single = (await mount({
    layout: 'grid',
    data: { columns: ['Feature', 'A'], rows: [['Price', '$1'], ['Only feature', 'yes']] },
  })).html;
  assert.match(single, /class="pt-feature pt-first pt-last"/);
});

test('the template reads only ids and extras the tool actually supplies', { skip: SKIP }, async () => {
  const manifest = await readJson('tool.json');
  const template = await readFile(join(PKG, 'template.html'), 'utf8');
  const { rt } = await mount();

  // Every root-scope {{name}} / {{#if name}} outside an #each block.
  const roots = new Set<string>();
  let depth = 0;
  for (const m of template.matchAll(/{{\s*(\/)?(?:#(if|unless|each)\s+)?([a-zA-Z_][\w.]*)/g)) {
    const close = m[1];
    const helper = m[2];
    const name = m[3] ?? '';
    if (close) { depth--; continue; }
    if (depth === 0 && !['default', 'arrow', 'asset', 'upper', 'lower', 'eq'].includes(name)) roots.add(name);
    if (helper) depth++;
  }
  assert.ok(roots.size >= 6, 'the scan found the root references');

  const supplied = new Set<string>(manifest.inputs.map((i: { id: string }) => i.id));
  for (const key of ['error', 'ctaText', 'hasButtons', 'gridCols', 'tiers', 'rows',
    'inkColor', 'paperColor', 'accentColor', 'onAccentColor',
    'cardColor', 'edgeColor', 'mutedColor', 'tintColor']) supplied.add(key);
  for (const name of roots) {
    assert.ok(supplied.has(name), `template reads {{${name}}}, which no input or hook extra supplies`);
    // `error` is the one reference that is deliberately empty on a good table.
    if (name === 'error') continue;
    assert.notEqual(rt.getHydratedString(`{{${name}}}`), '',
      `{{${name}}} hydrates empty on the default seed`);
  }
});

test('the render never depends on script, a network fetch or a bare colour', { skip: SKIP }, async () => {
  const template = await readFile(join(PKG, 'template.html'), 'utf8');
  const css = await readFile(join(PKG, 'styles.css'), 'utf8');
  const { html } = await mount();

  assert.ok(!/<script|on[a-z]+\s*=/i.test(template), 'the sheet must render with no script');
  for (const [what, src] of [['template', template], ['styles', css], ['render', html]] as const) {
    assert.ok(!/https?:\/\/|@import|url\(/i.test(src), `${what} must not reach off-device`);
  }
  // Every glyph carries its own stroke colour, so the DOM-to-SVG walker keeps it.
  for (const svg of html.match(/<svg[^>]*>/g) ?? []) assert.match(svg, /stroke="#[0-9a-f]{6}"/);
  // Every colour in the stylesheet is a custom property with a literal fallback.
  for (const decl of css.match(/var\(--pt-[a-z-]+[^)]*\)/g) ?? []) {
    assert.match(decl, /var\(--pt-[a-z-]+,\s*(#[0-9a-f]{3,8}|rgba?\()/,
      `${decl} has no literal fallback for a brand with no tokens`);
  }
});
