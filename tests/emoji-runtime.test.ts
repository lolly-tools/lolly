// SPDX-License-Identifier: MPL-2.0
/**
 * The runtime's emoji service (plan 252, stage B2): every mounted tool gets the
 * pass for free, an export carries the artwork's rights, and nothing ever falls
 * back to whatever emoji font the machine happens to have.
 *
 * The host double serves the REAL bundle the shared emoji pack root ships, through
 * the real Node emoji API on whichever profile this checkout resolves, so these tests
 * fail if the bundle, the asset entry or the pin stops agreeing.
 *
 * Run with: node --test tests/emoji-runtime.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { createRuntime } from '../engine/src/runtime.ts';
import { DEFAULT_EMOJI_PIN, defaultEmojiStyle } from '../engine/src/emoji-default.ts';
import { createNodeEmojiAPI } from '../packages/node-shell/src/emoji.ts';
import type { EmojiAPI } from '../packages/core/src/host-v1.ts';
import type { EmojiStyleV1 } from '../packages/core/src/emoji-v1.ts';

const GRIN = '\u{1F600}';
const PACK_ID = 'community/emoji/twemoji/color';

const xmlDom = new JSDOM('');
const parseXml = (source: string): unknown =>
  new xmlDom.window.DOMParser().parseFromString(source, 'image/svg+xml');

let emojiApi: EmojiAPI | null = null;
async function catalogEmoji(): Promise<EmojiAPI> {
  // No catalogDir, so this is the merged index: the active profile's brand entries
  // plus every shared asset root's. The pack is mounted once and reaches every brand.
  emojiApi ??= await createNodeEmojiAPI({ parseXml });
  return emojiApi;
}

/** The shared set as the index pins it, with the treatment the caller asks for. */
async function starterStyle(treatment: EmojiStyleV1['treatment'] = { mode: 'original', strengthBps: 0 }): Promise<EmojiStyleV1> {
  const sets = await (await catalogEmoji()).sets();
  const starter = sets.find((set) => set.pin.id === PACK_ID);
  assert.ok(starter, 'every profile must serve the shared Twemoji bundle');
  return { schemaVersion: 1, primary: starter.pin, fallbacks: [], metricsPolicy: 'inline-em-v1', treatment };
}

let toolSeq = 0;
// Hook factories are memoised by id@version, so every mount gets its own id.
function toolDouble(): Parameters<typeof createRuntime>[0] {
  return {
    trustClass: 'catalog',
    manifest: {
      id: `emoji-runtime-${++toolSeq}`, name: 'Emoji runtime', version: '1.0.0',
      engineVersion: '^1.0.0', status: 'official',
      render: { width: 200, height: 100, formats: ['png'] },
      inputs: [{ id: 'title', type: 'text', default: `Hello ${GRIN} world` }],
    },
    template: '<p class="line">{{title}}</p>',
    styles: null, hooksSource: null, hooksUrl: null,
    textTemplates: {}, textTemplateErrors: {},
  } as unknown as Parameters<typeof createRuntime>[0];
}

interface HostDouble {
  host: Parameters<typeof createRuntime>[1];
  /** Every export opts bag host.export.render was handed, in order. */
  renders: Record<string, unknown>[];
  logs: string[];
}

function hostDouble(emoji: EmojiAPI | undefined): HostDouble {
  const renders: Record<string, unknown>[] = [];
  const logs: string[] = [];
  const host = {
    version: '1',
    shell: 'test',
    profile: { get: async () => ({}) },
    log: (level: string, message: string) => { logs.push(`${level}:${message}`); },
    export: {
      render: async (_node: unknown, _format: string, opts: Record<string, unknown>) => {
        renders.push(opts);
        return new Blob(['x'], { type: 'image/png' });
      },
    },
    ...(emoji ? { emoji } : {}),
  };
  return { host: host as unknown as Parameters<typeof createRuntime>[1], renders, logs };
}

/** A document holding one hydrated render, plus the reads the tests make of it. */
function page(html: string) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="canvas">${html}</div></body></html>`);
  const canvas = dom.window.document.getElementById('canvas')!;
  const visible = (element: Element): string => {
    let text = '';
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === 3) text += node.textContent ?? '';
      else if (node.nodeType === 1) {
        const child = node as Element;
        if (child.classList.contains('lolly-emoji-text')) continue;
        text += visible(child);
      }
    }
    return text;
  };
  return { canvas, visibleText: () => visible(canvas) };
}

test('the pass draws the chosen set over the render, and no raw glyph is left on screen', async () => {
  const { host } = hostDouble(await catalogEmoji());
  const runtime = await createRuntime(toolDouble(), host);
  await runtime.setEmojiStyle(await starterStyle());

  const view = page(runtime.getHydrated());
  const result = await runtime.applyEmojiToDom(view.canvas);

  assert.equal(result.present, true);
  assert.deepEqual([result.replaced, result.unresolved], [1, 0]);

  const span = view.canvas.querySelector('.lolly-emoji');
  assert.ok(span, 'the cluster becomes a .lolly-emoji placement');
  assert.equal(span.getAttribute('role'), 'img');
  assert.equal(span.getAttribute('aria-label'), 'grinning face');
  assert.equal(span.getAttribute('data-emoji'), GRIN);
  assert.ok(span.querySelector('svg path'), 'the placement carries inline vector artwork');

  // The characters stay for copy, find and a screen reader; nothing draws them.
  assert.equal(view.canvas.textContent, `Hello ${GRIN} world`);
  assert.equal(view.visibleText().includes(GRIN), false);
  assert.equal(runtime.emoji.replaced, 1);
  assert.equal(runtime.emoji.present, true);
});

test('a second pass over a drawn tree changes nothing and reports the same census', async () => {
  const { host } = hostDouble(await catalogEmoji());
  const runtime = await createRuntime(toolDouble(), host);
  await runtime.setEmojiStyle(await starterStyle());

  const view = page(runtime.getHydrated());
  const first = await runtime.applyEmojiToDom(view.canvas);
  const markup = view.canvas.innerHTML;
  const second = await runtime.applyEmojiToDom(view.canvas);

  assert.equal(view.canvas.innerHTML, markup);
  assert.deepEqual([second.replaced, second.unresolved], [first.replaced, first.unresolved]);
  assert.equal(second.census.length, first.census.length);
  assert.equal(view.canvas.querySelectorAll('.lolly-emoji').length, 1);
});

test('an export records the placed artwork as a componentOf source ingredient', async () => {
  const { host, renders } = hostDouble(await catalogEmoji());
  const runtime = await createRuntime(toolDouble(), host);
  await runtime.setEmojiStyle(await starterStyle());

  const view = page(runtime.getHydrated());
  // No mount-time call on purpose: the export must draw the artwork itself.
  await runtime.export(view.canvas, 'png', {});

  assert.equal(renders.length, 1);
  const ingredients = renders[0]!.ingredients as Array<Record<string, unknown>> | undefined;
  assert.ok(ingredients, 'the export carries ingredients');
  assert.equal(ingredients.length, 1);
  const placed = ingredients[0]!;
  assert.equal(placed.credential, 'none');
  assert.equal(placed.relationship, 'componentOf');
  assert.equal(placed.format, 'image/svg+xml');
  assert.match(String(placed.title), /grinning face \(Twemoji Color 17\.0\.3\)/);
  const rights = placed.rights as Record<string, unknown>;
  assert.equal(rights.license, 'CC-BY-4.0');
  assert.match(String(rights.sourceUrl), /^https:\/\//);

  // And the same record is on hand for a shell whose bridge stamps the credential itself.
  const carried = runtime.emojiIngredients();
  assert.equal(carried.length, 1);
  assert.equal(carried[0]!.relationship, 'componentOf');
  // The export drew the artwork even though nothing mounted it first.
  assert.ok(view.canvas.querySelector('.lolly-emoji svg path'));
});

test('fresh runtimes use Fluent High Contrast on demand, including export and source credits', async () => {
  const api = await catalogEmoji();
  let manifests = 0;
  const { host } = hostDouble({ ...api, manifest: async pin => { manifests++; return api.manifest(pin); } });
  const runtime = await createRuntime(toolDouble(), host);
  assert.deepEqual(runtime.emoji.style, defaultEmojiStyle([{ pin: DEFAULT_EMOJI_PIN }]));
  assert.equal(manifests, 0, 'choosing a default does not download artwork');
  const view = page(runtime.getHydrated());
  await runtime.export(view.canvas, 'png', {});
  assert.equal(runtime.emoji.replaced, 1);
  assert.equal(runtime.emoji.unresolved, 0);
  assert.match(view.canvas.innerHTML, /fill="currentColor"/);
  assert.equal(manifests, 1);
  assert.match(runtime.emojiCredits(), /Fluent/);
  runtime.destroy();
});

test('a missing default pin never selects another installed release or set', () => {
  const changed = structuredClone(DEFAULT_EMOJI_PIN);
  changed.checksum = `sha256:${'0'.repeat(64)}`;
  assert.equal(defaultEmojiStyle([{ pin: changed }]), null);
  assert.equal(defaultEmojiStyle([]), null);
});

test('explicitly clearing the set draws the placeholder and records no ingredient', async () => {
  const { host, renders } = hostDouble(await catalogEmoji());
  const runtime = await createRuntime(toolDouble(), host);
  await runtime.setEmojiStyle(null);

  const view = page(runtime.getHydrated());
  const result = await runtime.applyEmojiToDom(view.canvas);

  assert.deepEqual([result.replaced, result.unresolved], [0, 1]);
  assert.equal(result.census.length, 0);
  const span = view.canvas.querySelector('.lolly-emoji');
  assert.ok(span);
  assert.equal(span.classList.contains('lolly-emoji--unset'), true);
  assert.match(span.getAttribute('aria-label') ?? '', /no emoji set chosen/);
  // The placeholder is the engine's own mark, never the operating system's glyph.
  assert.ok(span.querySelector('svg rect'));
  assert.equal(view.visibleText().includes(GRIN), false);

  await runtime.export(view.canvas, 'png', {});
  assert.equal(renders[0]!.ingredients, undefined);
  assert.deepEqual(runtime.emojiIngredients(), []);
});

test('a host with no sets at all leaves the characters alone', async () => {
  // The placeholder is a prompt: choose a set. On a device that holds none there
  // is no set to choose, so marking every emoji would leave a mark nobody can
  // clear. Reachable today on any profile whose catalog registers no pack.
  const empty: EmojiAPI = {
    sets: async () => [],
    manifest: async () => null,
    artwork: async () => null,
    parseXml,
  };
  const { host } = hostDouble(empty);
  const runtime = await createRuntime(toolDouble(), host);

  const view = page(runtime.getHydrated());
  const result = await runtime.applyEmojiToDom(view.canvas);

  assert.deepEqual([result.replaced, result.unresolved], [0, 0]);
  assert.equal(view.canvas.querySelector('.lolly-emoji'), null);
  assert.equal(view.canvas.textContent?.includes(GRIN), true, 'the text is exactly as the tool drew it');
  assert.deepEqual(runtime.emoji.sets, []);
});

test('setEmojiStyle re-draws the tree the pass last ran on, and tells subscribers', async () => {
  const { host } = hostDouble(await catalogEmoji());
  const runtime = await createRuntime(toolDouble(), host);
  await runtime.setEmojiStyle(null);

  const view = page(runtime.getHydrated());
  await runtime.applyEmojiToDom(view.canvas);
  assert.equal(view.canvas.querySelector('.lolly-emoji--unset') !== null, true);

  const seen: number[] = [];
  const stop = runtime.onEmojiChange((state) => { seen.push(state.replaced); });

  await runtime.setEmojiStyle(await starterStyle());
  assert.equal(view.canvas.querySelector('.lolly-emoji--unset'), null);
  assert.ok(view.canvas.querySelector('.lolly-emoji svg path'));
  assert.equal(runtime.emoji.replaced, 1);
  assert.deepEqual(seen, [1]);

  // Changing the treatment repaints the same cluster with different bytes.
  const before = view.canvas.querySelector('.lolly-emoji')!.getAttribute('data-emoji-sum');
  await runtime.setEmojiStyle(await starterStyle({
    mode: 'mono', strengthBps: 10000, recipe: 'emoji-treatment-v1',
    palette: [{ id: '{color.brand.primary}', hex: '#30ba78' }],
  }));
  const after = view.canvas.querySelector('.lolly-emoji')!.getAttribute('data-emoji-sum');
  assert.notEqual(after, before);

  // Clearing the choice goes back to the placeholder, never to a system glyph.
  await runtime.setEmojiStyle(null);
  assert.equal(view.canvas.querySelector('.lolly-emoji--unset') !== null, true);
  assert.equal(runtime.emoji.style, null);

  stop();
  const count = seen.length;
  await runtime.setEmojiStyle(await starterStyle());
  assert.equal(seen.length, count, 'unsubscribing stops the notifications');
});

test('a host with no emoji API is left alone, and reports that', async () => {
  const { host, renders } = hostDouble(undefined);
  const runtime = await createRuntime(toolDouble(), host);

  const view = page(runtime.getHydrated());
  const html = view.canvas.innerHTML;
  const result = await runtime.applyEmojiToDom(view.canvas);

  assert.equal(result.present, false);
  assert.equal(runtime.emoji.present, false);
  assert.equal(view.canvas.innerHTML, html);
  await runtime.export(view.canvas, 'png', {});
  assert.equal(renders[0]!.ingredients, undefined);
});

test('revert puts the characters back for editing', async () => {
  const { host } = hostDouble(await catalogEmoji());
  const runtime = await createRuntime(toolDouble(), host);
  await runtime.setEmojiStyle(await starterStyle());

  const view = page(runtime.getHydrated());
  await runtime.applyEmojiToDom(view.canvas);
  const reverted = await runtime.revertEmojiDom(view.canvas);

  assert.equal(reverted, 1);
  assert.equal(view.canvas.querySelector('.lolly-emoji'), null);
  assert.equal(view.canvas.textContent, `Hello ${GRIN} world`);
});

test('plain text never loads the pinned tables', async () => {
  const { host } = hostDouble(await catalogEmoji());
  const runtime = await createRuntime(toolDouble(), host);
  await runtime.setEmojiStyle(await starterStyle());

  const view = page('<p>plain latin words only</p>');
  const result = await runtime.applyEmojiToDom(view.canvas);
  assert.deepEqual([result.replaced, result.unresolved, result.census.length], [0, 0, 0]);
  assert.equal(view.canvas.innerHTML, '<p>plain latin words only</p>');
});

// ── Chrome that draws its own emoji ─────────────────────────────────────────
// The sidebar's emoji table cells and the picker grid run the same pass over
// their own elements. Two things must not happen when they do: the chrome's
// counts must not become the runtime's answer to "does this render carry emoji"
// (the Emoji section is shown on exactly those counts, so a one-cell walk could
// hide it over a canvas full of emoji), and a chrome element must not become the
// tree a later set change redraws. `track: false` is what says so.

test('an untracked pass draws artwork without becoming the render', async () => {
  const { host } = hostDouble(await catalogEmoji());
  const runtime = await createRuntime(toolDouble(), host);
  await runtime.setEmojiStyle(await starterStyle());

  const view = page(runtime.getHydrated());
  await runtime.applyEmojiToDom(view.canvas);
  assert.equal(runtime.emoji.replaced, 1);

  // A sidebar cell with no emoji in it: tracked, this zeroed the snapshot.
  const chrome = view.canvas.ownerDocument.createElement('div');
  chrome.textContent = 'Pick';
  const seen: number[] = [];
  const stop = runtime.onEmojiChange((state) => { seen.push(state.replaced); });

  const result = await runtime.applyEmojiToDom(chrome, { track: false });

  assert.deepEqual([result.present, result.replaced, result.unresolved], [true, 0, 0]);
  assert.equal(runtime.emoji.replaced, 1, 'the render is still what the snapshot describes');
  assert.equal(runtime.emoji.unresolved, 0);
  assert.equal(seen.includes(0), false, 'and no subscriber was told the render lost its emoji');
  stop();

  // The canvas is still the tree a set change redraws, not the chrome element.
  await runtime.setEmojiStyle(null);
  assert.ok(view.canvas.querySelector('.lolly-emoji--unset'), 'the canvas was redrawn');
  assert.equal(chrome.querySelector('.lolly-emoji'), null);
});

test('an untracked pass that DOES draw still leaves the snapshot alone', async () => {
  const { host } = hostDouble(await catalogEmoji());
  const runtime = await createRuntime(toolDouble(), host);
  await runtime.setEmojiStyle(await starterStyle());

  const view = page(runtime.getHydrated());
  await runtime.applyEmojiToDom(view.canvas);

  const cell = view.canvas.ownerDocument.createElement('button');
  cell.textContent = GRIN;
  const result = await runtime.applyEmojiToDom(cell, { track: false, idScope: 's0_' });

  assert.equal(result.replaced, 1, 'the cell is drawn, which is the whole point');
  assert.ok(cell.querySelector('.lolly-emoji svg path'));
  assert.equal(runtime.emoji.replaced, 1, 'but the counts still describe the canvas');
  assert.equal(runtime.emojiIngredients().length, 1, 'and the export credits one glyph, not two');
});

test('two roots in one document keep their placement ids apart', async () => {
  // Placement ids are named after a work item's place in the tree it was handed,
  // so two roots walked separately both start at the beginning. In ONE document
  // that means a sidebar cell's gradient or clip path can paint a canvas glyph.
  // Three Twemoji glyphs mint local ids; the well is one of them.
  const WELL = '\u{1F6DC}';
  const { host } = hostDouble(await catalogEmoji());
  const runtime = await createRuntime(toolDouble(), host);
  await runtime.setEmojiStyle(await starterStyle());

  const dom = new JSDOM(`<!doctype html><html><body><div id="canvas">${WELL}</div><div id="side">${WELL}</div></body></html>`);
  const canvas = dom.window.document.getElementById('canvas')!;
  const side = dom.window.document.getElementById('side')!;

  await runtime.applyEmojiToDom(canvas);
  await runtime.applyEmojiToDom(side, { track: false, idScope: 's0_' });

  const ids = [...dom.window.document.querySelectorAll('[id]')].map((element) => element.id);
  const minted = ids.filter((id) => id !== 'canvas' && id !== 'side');
  assert.ok(minted.length >= 2, `both roots must mint local ids: ${ids.join(', ')}`);
  assert.equal(new Set(minted).size, minted.length, `ids must be unique in one document: ${minted.join(', ')}`);

  // And every reference resolves inside its own root, not the other one.
  for (const root of [canvas, side]) {
    for (const node of root.querySelectorAll('[clip-path], [fill^="url("]')) {
      const reference = /url\(#([^)]+)\)/.exec(node.getAttribute('clip-path') ?? node.getAttribute('fill') ?? '')?.[1];
      if (!reference) continue;
      assert.ok(root.querySelector(`[id="${reference}"]`),
        `a reference must name an id in its own root: ${reference}`);
    }
  }
});

test('the shipped set travels into the rights record as its own declaration, and a treatment is a change', async () => {
  // The pack the profile actually mounts, not a fixture: this pins what the
  // SHIPPED Twemoji entry declares, so a re-import that changed its licence or
  // dropped its creator would fail here rather than in a delivered file.
  const { host } = hostDouble(await catalogEmoji());
  const runtime = await createRuntime(toolDouble(), host);
  await runtime.setEmojiStyle(await starterStyle());
  await runtime.applyEmojiToDom(page(runtime.getHydrated()).canvas);

  const unchanged = runtime.rights();
  assert.equal(unchanged.status, 'ready');
  assert.equal(unchanged.uses[0]!.licence, 'CC-BY-4.0');
  assert.equal(unchanged.uses[0]!.classification, 'collection-component');
  assert.match(unchanged.plan.required[0]!.credit, /Twitter, Inc\. and other contributors/);
  // Placing a glyph changes nothing about the artwork, and admitting it does:
  // the credit names the same SVG normalisation the credential records, because
  // a file that said `unchanged` while its own credential listed two
  // modifications would be two answers to one question.
  assert.match(unchanged.plan.required[0]!.credit, /changes: Canonicalized SVG syntax and inline presentation styles, Prefixed local SVG ids and paint references for placement\.$/);
  assert.doesNotMatch(unchanged.plan.required[0]!.credit, /recoloured/);

  // A brand treatment recolours the artwork. Under CC BY that needs no licence
  // decision, and the credit has to say what changed all the same.
  await runtime.setEmojiStyle(await starterStyle({
    mode: 'snap', strengthBps: 10000, recipe: 'emoji-treatment-v1',
    palette: [{ id: '{color.brand.accent}', hex: '#30ba78' }],
  }));
  const treated = runtime.rights({ audience: 'public' });
  assert.equal(treated.status, 'ready', 'CC BY has no ShareAlike step');
  assert.equal(treated.uses[0]!.classification, 'adaptation');
  assert.match(treated.plan.required[0]!.credit, /Recoloured every paint with emoji-treatment-v1 in snap mode\.$/);
});

test('reverting picker artwork preserves the canvas as the tracked render', async () => {
  const { host } = hostDouble(await catalogEmoji());
  const runtime = await createRuntime(toolDouble(), host);
  await runtime.setEmojiStyle(await starterStyle());
  const view = page(runtime.getHydrated());
  await runtime.applyEmojiToDom(view.canvas);
  const chrome = view.canvas.ownerDocument.createElement('span');
  chrome.textContent = GRIN;
  await runtime.applyEmojiToDom(chrome, { track: false, idScope: 'p' });
  await runtime.revertEmojiDom(chrome);
  await runtime.setEmojiStyle(null);
  assert.ok(view.canvas.querySelector('.lolly-emoji--unset'));
  assert.equal(chrome.textContent, GRIN);
  assert.equal(runtime.emoji.unresolved, 1);
});
