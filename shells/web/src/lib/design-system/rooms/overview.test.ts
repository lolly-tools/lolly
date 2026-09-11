// SPDX-License-Identifier: MPL-2.0
/**
 * The Overview room - what it reads, what it shows, and where its doors go.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/rooms/overview.test.ts"
 *
 * jsdom supplies the DOM for the mount half. The host is a stub of the three
 * slices the room reads (tokens discovery, resolved swatches/doc, user assets),
 * which is also how the object-URL contract gets pinned: listLogos mints one per
 * slot for previews this room never renders, so every one must come back.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="room"></div></body></html>', {
  url: 'http://localhost/#/start',
});
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;

/** Object URLs jsdom does not mint itself - recorded so the revoke can be asserted. */
const minted: string[] = [];
const revoked: string[] = [];
(globalThis.URL as unknown as { createObjectURL: (b: unknown) => string }).createObjectURL = () => {
  const url = `blob:test/${minted.length}`;
  minted.push(url);
  return url;
};
(globalThis.URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = (u) => { revoked.push(u); };

const { readOverview, overviewHtml, mountOverviewRoom } = await import('./overview.ts');
type OverviewHost = Parameters<typeof readOverview>[0];

interface StubOpts {
  installed?: boolean;
  /** Overrides `installed`: the exact id tokens discovery answers with, so a
   *  catalog pack's own asset can be distinguished from the starter placeholder. */
  tokensId?: string;
  colors?: string[];
  /** Resolved swatches WITH their token paths - what the real bridge answers
   *  with, and what the starter split compares against. Overrides `colors`. */
  swatches?: Array<{ path: string; value: string }>;
  doc?: unknown;
  /** The document the starter tokens asset ships, for the ownership split. */
  starter?: unknown;
  fonts?: Record<string, string>;
  assets?: Array<{ id: string; type?: string; blob?: unknown; meta?: Record<string, unknown> }>;
}

function stubHost(opts: StubOpts = {}): OverviewHost {
  return {
    assets: {
      _findMetaByType: async (type: string) =>
        (type === 'tokens'
          ? { id: opts.tokensId ?? (opts.installed ? 'user/tokens/brand' : 'lolly/tokens/brand') }
          : null),
      _exportUserAssets: async () => opts.assets ?? [],
      // Only the starter asset is readable here; anything else answers null,
      // which is what a catalog that ships no starter does.
      _getBlob: async (id: string) =>
        (id === 'lolly/tokens/brand' && opts.starter !== undefined
          ? { text: async () => JSON.stringify(opts.starter) } as unknown as Blob
          : null),
    },
    tokens: {
      colors: async () => opts.swatches ?? (opts.colors ?? []).map(value => ({ value })),
      raw: async () => opts.doc ?? null,
      resolve: async (key: string) => opts.fonts?.[key] ?? '',
    },
  } as unknown as OverviewHost;
}

/** A minimal DTCG doc with a known token count. */
const DOC = {
  color: {
    brand: { primary: { $type: 'color', $value: '#ff6600' }, secondary: { $type: 'color', $value: '#0060ff' } },
  },
};

const logoAsset = (variant: string) => ({
  id: `user/logo/${variant}`,
  type: 'image',
  blob: { size: 10 },
  meta: { format: 'svg' },
});

// ── readOverview ─────────────────────────────────────────────────────────────

test('an install with no design system of its own reads as empty', async () => {
  const model = await readOverview(stubHost({ installed: false, colors: ['#ff6600'] }));
  assert.equal(model.furnished, false);
  assert.deepEqual(model.colors, []);
  assert.equal(model.colorCount, 0);
  assert.equal(model.tokenCount, 0);
});

// A catalog pack (an ingested brand, or SUSE's) is resolved by bridge/tokens.ts
// whenever there is no user install, so its palette is what every room behind
// this one paints. Reading it as empty would put "Nothing here yet" over a
// design system that demonstrably exists.
test('an unlocked catalog pack is furnished, even with nothing installed here', async () => {
  const model = await readOverview(stubHost({
    tokensId: 'acme/tokens/brand', colors: ['#0057b8', '#ffffff'], doc: DOC,
  }));
  assert.equal(model.furnished, true);
  assert.deepEqual(model.colors, ['#0057b8', '#ffffff']);
  assert.equal(model.tokenCount, 2);
});

test('no tokens asset anywhere reads as empty', async () => {
  const model = await readOverview(stubHost({ tokensId: '', colors: ['#ff6600'] }));
  assert.equal(model.furnished, false);
  assert.deepEqual(model.colors, []);
});

test('a furnished system reports its palette, type, logos and token count', async () => {
  const model = await readOverview(stubHost({
    installed: true,
    colors: ['#ff6600', '#0060ff', '#111111'],
    doc: DOC,
    fonts: { '{font.brand}': 'Outfit', '{font.display}': 'Outfit', '{font.mono}': 'Space Mono' },
    assets: [logoAsset('horizontal-primary'), logoAsset('stacked-mono'), { id: 'user/uploads/photo', type: 'image' }],
  }));
  assert.equal(model.furnished, true);
  assert.deepEqual(model.colors, ['#ff6600', '#0060ff', '#111111']);
  assert.equal(model.colorCount, 3);
  // Distinct families in role order - Outfit fills two roles and is listed once.
  assert.deepEqual(model.fonts, ['Outfit', 'Space Mono']);
  assert.equal(model.logoCount, 2);
  assert.equal(model.tokenCount, 2);
});

test('the palette strip is capped, but the count is the whole palette', async () => {
  const colors = Array.from({ length: 30 }, (_, i) => `#0000${String(i % 10)}${String(i % 10)}`);
  const model = await readOverview(stubHost({ installed: true, colors }));
  assert.equal(model.colorCount, 30);
  assert.ok(model.colors.length < 30 && model.colors.length > 0, `strip capped, got ${model.colors.length}`);
});

test('every object URL listLogos minted for its previews is handed back', async () => {
  minted.length = 0;
  revoked.length = 0;
  await readOverview(stubHost({ installed: true, assets: [logoAsset('horizontal-primary'), logoAsset('icon')] }));
  assert.equal(minted.length, 2);
  assert.deepEqual(revoked, minted);
});

// ── The starter split (plan 137 C3) ──────────────────────────────────────────
// A blank brand's 25 starter colours are copied into the user's own document by
// the first write, so from then on the palette counts colours nobody chose. The
// shipped bytes are read back and matched on path AND value.

/** Two starter colours, in the shape the starter asset ships. */
const STARTER = {
  color: {
    ramp: {
      primary: {
        1: { $type: 'color', $value: '#111111' },
        2: { $type: 'color', $value: '#222222' },
      },
    },
  },
};

test('starter colours are counted apart from the ones a person added', async () => {
  const model = await readOverview(stubHost({
    installed: true,
    starter: STARTER,
    swatches: [
      { path: 'color.ramp.primary.1', value: '#111111' },
      { path: 'color.ramp.primary.2', value: '#222222' },
      { path: 'color.custom.mine', value: '#ff6600' },
    ],
  }));
  assert.equal(model.colorCount, 3);
  assert.equal(model.starterCount, 2);
  assert.equal(model.ownColorCount, 1);
  // Own leads, the starter's rides behind it in the muted register.
  assert.match(overviewHtml(model), /1 colour(?!s)/);
  assert.match(overviewHtml(model), /· 2 starter/);
});

// The blank brand's whole inherited palette is the neutral ramp - ink and paper
// so surfaces can render at all. It lives under Tokens as "Neutrals · starter"
// (plan 182 section 12), so counting it here would put "9 starter" beside a
// room that draws none of it.
test('the scaffolding neutrals are not counted or drawn as starter colours', async () => {
  const model = await readOverview(stubHost({
    installed: true,
    starter: {
      color: { ramp: { neutral: { 1: { $type: 'color', $value: '#111111' }, 9: { $type: 'color', $value: '#fafafa' } } } },
    },
    swatches: [
      { path: 'color.ramp.neutral.1', value: '#111111' },
      { path: 'color.ramp.neutral.9', value: '#fafafa' },
      { path: 'color.custom.mine', value: '#ff6600' },
    ],
  }));
  assert.equal(model.starterCount, 0, 'ink and paper are scaffolding, not a starter palette');
  assert.deepEqual(model.starterColors, []);
  assert.deepEqual(model.colors, ['#ff6600'], 'the strip is the design system\'s own');
  const html = overviewHtml(model);
  assert.match(html, /1 colour(?!s)/);
  assert.equal(/· \d+ starter/.test(html), false, 'nothing to count for a ramp this room never shows');
  assert.equal(/ds-ov-chip is-starter/.test(html), false, 'and nothing to draw for it either');
});

test('a starter path the user has recoloured is theirs, not the starter\'s', async () => {
  const model = await readOverview(stubHost({
    installed: true,
    starter: STARTER,
    swatches: [
      { path: 'color.ramp.primary.1', value: '#00ff00' },  // same path, their colour
      { path: 'color.ramp.primary.2', value: '#222222' },
    ],
  }));
  assert.equal(model.starterCount, 1);
});

// One tile per token (plan 182 C5). A `color.semantic.*` leaf is an alias that
// re-points at a swatch, so the Colours room stopped rendering one as a tile -
// and this count has to agree with that grid, or "1 colour" here reads beside
// "2 colours" one room over.
test('a role is not a colour: re-pointing one adds nothing to the count', async () => {
  const model = await readOverview(stubHost({
    installed: true,
    starter: STARTER,
    swatches: [
      { path: 'color.ramp.primary.1', value: '#111111' },
      { path: 'color.custom.mine', value: '#ff6600' },
      // The role the person just pointed at their own colour.
      { path: 'color.semantic.primary', value: '#ff6600' },
    ],
  }));
  assert.equal(model.colorCount, 2, 'two swatches, one of them serving a role');
  assert.equal(model.starterCount, 1);
  assert.equal(model.ownColorCount, 1);
  assert.equal(model.ownership?.colors.has('color.semantic.primary'), false);
  assert.match(overviewHtml(model), /1 colour(?!s) <small/);
});

test('a catalog that ships no starter attributes nothing', async () => {
  const model = await readOverview(stubHost({
    installed: true,
    swatches: [{ path: 'color.ramp.primary.1', value: '#111111' }],
  }));
  assert.equal(model.starterCount, 0);
  assert.match(overviewHtml(model), /1 colour(?!s)/);
});

// ── Worth exporting (plans/163 F4) ───────────────────────────────────────────
// `furnished` goes true on the first write, so gating the studio's Export /
// Tokens / Versions actions on it grew three power actions one gesture in. These
// pin the harder question those actions ask instead.

/** The starter's own roles, in the shape the blank brand ships them: every slot
 *  pre-assigned, into the starter's own ramp. */
const STARTER_ROLES = {
  color: {
    semantic: {
      primary: { $value: '{color.ramp.primary.1}' },
      text: { $value: '{color.ramp.primary.2}' },
    },
  },
};
const STARTER_SWATCHES = [
  { path: 'color.ramp.primary.1', value: '#111111' },
  { path: 'color.ramp.primary.2', value: '#222222' },
];

test('one colour over the starter palette is furnished, but not worth exporting', async () => {
  const model = await readOverview(stubHost({
    installed: true, starter: STARTER, doc: STARTER_ROLES,
    swatches: [...STARTER_SWATCHES, { path: 'color.custom.mine', value: '#ff6600' }],
  }));
  assert.equal(model.furnished, true, 'a design system exists here');
  assert.equal(model.worthExporting, false,
    'the roles the starter itself assigned are not the user having wired any up');
});

test('three colours of your own are worth exporting', async () => {
  const model = await readOverview(stubHost({
    installed: true, starter: STARTER,
    swatches: [
      ...STARTER_SWATCHES,
      { path: 'color.custom.mine', value: '#ff6600' },
      { path: 'color.custom.second', value: '#0060ff' },
      { path: 'color.custom.third', value: '#111111' },
    ],
  }));
  assert.equal(model.worthExporting, true);
});

test('a generated palette is worth exporting on its own', async () => {
  const model = await readOverview(stubHost({
    installed: true, starter: STARTER,
    // A secondary ramp is what a generate adds and the starter never ships.
    swatches: [...STARTER_SWATCHES, { path: 'color.ramp.secondary.5', value: '#00aa88' }],
  }));
  assert.equal(model.worthExporting, true);
});

test('two roles pointing at colours of your own are worth exporting', async () => {
  const model = await readOverview(stubHost({
    installed: true, starter: STARTER,
    doc: {
      color: {
        semantic: {
          primary: { $value: '{color.custom.mine}' },
          text: { $value: '{color.custom.ink}' },
        },
      },
    },
    swatches: [
      ...STARTER_SWATCHES,
      { path: 'color.custom.mine', value: '#ff6600' },
      { path: 'color.custom.ink', value: '#111111' },
    ],
  }));
  assert.equal(model.worthExporting, true, 'two roles wired up, on two own colours');
});

test('the own count leads, whatever the starter\'s size', () => {
  const html = overviewHtml({
    furnished: true, colors: [], colorCount: 5, starterCount: 2,
    fonts: [], logoCount: 0, tokenCount: 0,
  });
  assert.match(html, /3 colours/, 'five in the palette, two of them the starter\'s');
  assert.match(html, /· 2 starter/);
  assert.equal(/yours/.test(html), false, 'no possessives on the material');
});

test('an unreadable tokens doc still yields the palette rather than throwing', async () => {
  const model = await readOverview(stubHost({ installed: true, colors: ['#ff6600'], doc: 'not a doc' }));
  assert.equal(model.furnished, true);
  assert.deepEqual(model.colors, ['#ff6600']);
});

// ── overviewHtml ─────────────────────────────────────────────────────────────

test('the empty state gives colour, file, face and logo equal doors, plus a way out', () => {
  const html = overviewHtml({ furnished: false, colors: [], colorCount: 0, fonts: [], logoCount: 0, tokenCount: 0 });
  // Four material-shaped doors. A complete file is no longer buried in a line
  // below the partial-resource choices, and none of them gates another.
  assert.equal([...html.matchAll(/data-ds-door="/g)].length, 4);
  assert.match(html, /data-ds-door="color-pick"/);
  assert.match(html, /data-ds-door="type-stage"/);
  assert.match(html, /data-ds-door="logos"/);
  assert.match(html, /data-ds-door="file"/);
  assert.equal(/data-ds-door="scratch"/.test(html), false, 'the old route-shaped door is gone');
  assert.match(html, /Pick a colour/);
  assert.match(html, /Bring a file/);
  assert.match(html, /\.lolly/);
  assert.match(html, /Choose a face/);
  assert.match(html, /Add a logo/);
  assert.match(html, /href="#\/"/);
  // The website door arrives with M6, gated on a transport that works - a
  // disabled third door would advertise something nobody here can use.
  assert.equal(/disabled/.test(html), false, 'no disabled door may be rendered');
  assert.equal(/website/i.test(html), false, 'the website source must not appear before M6');
});

test('the empty state names no steps and no progress', () => {
  const html = overviewHtml({ furnished: false, colors: [], colorCount: 0, fonts: [], logoCount: 0, tokenCount: 0 });
  assert.equal(/\bstep\b/i.test(html), false);
  assert.equal(/progress/i.test(html), false);
});

test('the furnished state is one door per room, with counts', () => {
  const html = overviewHtml({
    furnished: true, colors: ['#ff6600', '#0060ff'], colorCount: 7,
    fonts: ['Outfit'], logoCount: 3, tokenCount: 42,
  });
  for (const area of ['color', 'type', 'logos', 'tokens', 'catalogue']) {
    assert.match(html, new RegExp(`data-ds-goto="${area}"`), `no door into ${area}`);
  }
  assert.match(html, /7 colours/);
  assert.match(html, /3 logos/);
  assert.match(html, /42 tokens/);
  assert.match(html, /Outfit/);
  assert.equal([...html.matchAll(/class="ds-ov-chip"/g)].length, 2);
});

test('singular and plural counts both read naturally', () => {
  const html = overviewHtml({
    furnished: true, colors: ['#ff6600'], colorCount: 1, fonts: [], logoCount: 1, tokenCount: 1,
  });
  assert.match(html, /1 colour(?!s)/);
  assert.match(html, /1 logo(?!s)/);
  assert.match(html, /1 token(?!s)/);
});

// ── The cards read by ownership (plan 182 section 4.2) ───────────────────────
// Own material leads; what shipped is named underneath in the muted register.
// The three type states are the whole grammar: nothing chosen, one role chosen,
// every role chosen.

/** A model with an ownership report shaped by `faces`, everything else quiet. */
function faceModel(
  faces: Record<string, { family: string; state: string; follows?: string }>,
  extra: Partial<Parameters<typeof overviewHtml>[0] & object> = {},
): NonNullable<Parameters<typeof overviewHtml>[0]> {
  return {
    furnished: true, colors: ['#ff6600'], colorCount: 1, ownColorCount: 1,
    fonts: [], logoCount: 0, tokenCount: 12,
    ownership: {
      colors: new Map(), faces, logos: {}, radius: 'inherited',
      counts: { ownColors: 1, starterColors: 0, ownFaces: 0, logos: 0 },
    },
    ...extra,
  } as NonNullable<Parameters<typeof overviewHtml>[0]>;
}

test('TYPE: nothing of its own reads Not set, with the starter faces named', () => {
  const html = overviewHtml(faceModel({
    brand: { family: 'SUSE', state: 'inherited' },
    display: { family: 'SUSE', state: 'follows', follows: 'brand' },
    mono: { family: 'SUSE Mono', state: 'inherited' },
    italic: { family: 'SUSE', state: 'follows', follows: 'brand' },
  }));
  assert.match(html, /Not set/);
  assert.match(html, /Starter · SUSE, SUSE Mono/);
  assert.equal(/for the rest/.test(html), false, 'there is no rest when nothing was chosen');
});

test('TYPE: one own role leads, and the starter takes the rest', () => {
  const html = overviewHtml(faceModel({
    brand: { family: 'SUSE', state: 'inherited' },
    display: { family: 'Inter', state: 'own' },
    mono: { family: 'SUSE Mono', state: 'inherited' },
    italic: { family: 'Inter', state: 'follows', follows: 'brand' },
  }));
  assert.match(html, /Inter <small[^>]*>for headings/);
  assert.match(html, /Starter for the rest · SUSE, SUSE Mono/);
  // A following role repeats a decision rather than making one, so its family is
  // never listed as the starter's.
  assert.equal(/Starter for the rest · [^<]*Inter/.test(html), false);
});

test('TYPE: every role chosen says so and nothing else', () => {
  const html = overviewHtml(faceModel({
    brand: { family: 'Inter', state: 'own' },
    display: { family: 'Fraunces', state: 'own' },
    mono: { family: 'Space Mono', state: 'own' },
    italic: { family: 'Inter', state: 'own' },
  }));
  assert.match(html, /Inter <small[^>]*>for text/);
  assert.match(html, /Space Mono <small[^>]*>for code/);
  assert.equal(/Starter/.test(html), false, 'nothing is standing in');
});

test('LOGOS: an empty room says Not set and names the slots', () => {
  const html = overviewHtml(faceModel({}, { logoCount: 0 }));
  assert.match(html, /Horizontal, vertical, custom marks/);
  const withMarks = overviewHtml(faceModel({}, { logoCount: 2 }));
  assert.match(withMarks, /2 logos/);
  assert.equal(/Horizontal, vertical/.test(withMarks), false);
});

test('TOKENS: the corner radius says who set it', () => {
  assert.match(overviewHtml(faceModel({}, { radius: { value: '1rem', own: false } })),
    /Corner radius · starter 1rem/);
  assert.match(overviewHtml(faceModel({}, { radius: { value: '0.75rem', own: true } })),
    /Corner radius · 0\.75rem/);
});

test('FILES: an empty catalogue says so, and an unknown one says nothing', () => {
  assert.match(overviewHtml(faceModel({}, { fileCount: 0 })), /Nothing yet/);
  assert.equal(/Nothing yet/.test(overviewHtml(faceModel({}, { fileCount: 3 }))), false);
  assert.equal(/Nothing yet/.test(overviewHtml(faceModel({}))), false, 'an unanswerable store says nothing');
});

// `furnished` goes true on the FIRST write, whatever it was - so a system whose
// every colour, face and mark is still what shipped would otherwise show five
// cards counting other people's decisions.
test('a furnished system with nothing chosen still gets the doors', () => {
  const html = overviewHtml({
    furnished: true, colors: [], colorCount: 9, starterCount: 0, ownColorCount: 0,
    fonts: ['SUSE'], logoCount: 0, tokenCount: 30,
    ownership: {
      colors: new Map(), faces: {}, logos: {}, radius: 'inherited',
      counts: { ownColors: 0, starterColors: 9, ownFaces: 0, logos: 0 },
    },
  } as unknown as NonNullable<Parameters<typeof overviewHtml>[0]>);
  assert.match(html, /ds-ov--empty/);
  assert.match(html, /Nothing here yet/);
});

test('one own thing of any kind brings the cards back', () => {
  for (const counts of [
    { ownColors: 1, starterColors: 9, ownFaces: 0, logos: 0 },
    { ownColors: 0, starterColors: 9, ownFaces: 1, logos: 0 },
    { ownColors: 0, starterColors: 9, ownFaces: 0, logos: 1 },
  ]) {
    const html = overviewHtml({
      furnished: true, colors: [], colorCount: 9, fonts: [], logoCount: 0, tokenCount: 30,
      ownership: { colors: new Map(), faces: {}, logos: {}, radius: 'inherited', counts },
    } as unknown as NonNullable<Parameters<typeof overviewHtml>[0]>);
    assert.equal(/ds-ov--empty/.test(html), false, `${JSON.stringify(counts)} is something of its own`);
  }
  // Moving the radius adds no material, but it is still a decision.
  const moved = overviewHtml({
    furnished: true, colors: [], colorCount: 9, fonts: [], logoCount: 0, tokenCount: 30,
    ownership: {
      colors: new Map(), faces: {}, logos: {}, radius: 'own',
      counts: { ownColors: 0, starterColors: 9, ownFaces: 0, logos: 0 },
    },
  } as unknown as NonNullable<Parameters<typeof overviewHtml>[0]>);
  assert.equal(/ds-ov--empty/.test(moved), false);
});

test('a hostile family name cannot break out of the card', () => {
  const html = overviewHtml({
    furnished: true, colors: ['"><script>x()</script>'], colorCount: 1,
    fonts: ['<img src=x onerror=alert(1)>'], logoCount: 0, tokenCount: 0,
  });
  assert.equal(/<script>/.test(html), false);
  assert.equal(/<img /.test(html), false);
  assert.match(html, /&lt;img/);
});

test('COPY: the room says design system, never brand, and owns nothing', () => {
  const shown = [
    overviewHtml(null),
    overviewHtml({ furnished: false, colors: [], colorCount: 0, fonts: [], logoCount: 0, tokenCount: 0 }),
    overviewHtml({ furnished: true, colors: ['#ff6600'], colorCount: 1, fonts: ['Outfit'], logoCount: 1, tokenCount: 1 }),
  ].join('\n');
  assert.equal(/\bbrand\b/i.test(shown), false, '"brand" is not this room\'s word (plan 97 section 3)');
  assert.equal(/\byour\b/i.test(shown), false, 'no possessives on the material');
  assert.equal(shown.includes('\u2014'), false, 'no em-dashes in user-facing copy');
});

// ── mountOverviewRoom ────────────────────────────────────────────────────────

/** Let the room's async read land (several awaits deep, so turn the loop). */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 4; i++) await new Promise(resolve => setTimeout(resolve, 0));
};

function mountInto(opts: StubOpts): {
  el: HTMLElement;
  room: ReturnType<typeof mountOverviewRoom>;
  gone: string[];
  imports: number;
  paletteSubs: number;
} {
  const el = document.getElementById('room') as HTMLElement;
  el.innerHTML = '';
  el.hidden = false;
  const gone: string[] = [];
  const counts = { imports: 0, paletteSubs: 0 };
  const room = mountOverviewRoom(el, {
    host: stubHost(opts),
    editor: () => ({
      onPalette: () => { counts.paletteSubs++; return () => { counts.paletteSubs--; }; },
    } as unknown as ReturnType<Parameters<typeof mountOverviewRoom>[1]['editor']>),
    goto: (area, focus) => gone.push(`${area}:${focus ?? ''}`),
    openImport: () => { counts.imports++; },
  });
  return {
    el, room, gone,
    get imports() { return counts.imports; },
    get paletteSubs() { return counts.paletteSubs; },
  };
}

test('mount paints the empty state and its doors are wired', async () => {
  const m = mountInto({ installed: false });
  await settle();
  assert.match(m.el.innerHTML, /ds-ov--empty/);
  m.el.querySelector<HTMLElement>('[data-ds-door="file"]')!.click();
  assert.equal(m.imports, 1);
  // Each door carries the room AND the control it wants open there.
  m.el.querySelector<HTMLElement>('[data-ds-door="color-pick"]')!.click();
  m.el.querySelector<HTMLElement>('[data-ds-door="type-stage"]')!.click();
  m.el.querySelector<HTMLElement>('[data-ds-door="logos"]')!.click();
  assert.deepEqual(m.gone, ['color:pick', 'type:stage', 'logos:']);
  m.room.teardown();
});

test('mount paints the furnished state and every card opens its room', async () => {
  const m = mountInto({ installed: true, colors: ['#ff6600'], doc: DOC, assets: [logoAsset('icon')] });
  await settle();
  const cards = [...m.el.querySelectorAll<HTMLElement>('[data-ds-goto]')];
  assert.ok(cards.length >= 5, `expected a card per room, got ${cards.length}`);
  for (const card of cards) card.click();
  assert.deepEqual(m.gone, cards.map(c => `${c.dataset.dsGoto}:`), 'a card opens its room, with nothing forced open in it');
  m.room.teardown();
});

test('teardown unsubscribes from the palette feed and stops the doors', async () => {
  const m = mountInto({ installed: false });
  await settle();
  assert.equal(m.paletteSubs, 1);
  m.room.teardown();
  assert.equal(m.paletteSubs, 0);
  m.el.querySelector<HTMLElement>('[data-ds-door="file"]')?.click();
  assert.equal(m.imports, 0, 'a torn-down room must not still open the source modal');
});

test('a detached room never repaints (the view moved on mid-read)', async () => {
  const el = document.createElement('div'); // never appended - isConnected is false
  const room = mountOverviewRoom(el, {
    host: stubHost({ installed: true, colors: ['#ff6600'] }),
    editor: () => null,
    goto: () => {},
    openImport: () => {},
  });
  await settle();
  assert.match(el.innerHTML, /ds-ov-loading/, 'the resting line stands; no repaint into a detached node');
  room.teardown();
});
