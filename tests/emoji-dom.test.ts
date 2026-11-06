// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { applyEmojiToDom, revertEmojiDom, emojiTextTrigger } from '../engine/src/emoji-dom.ts';
import type { EmojiDomElement } from '../engine/src/emoji-dom.ts';
import type { EmojiTextIO } from '../engine/src/emoji-inline.ts';
import { emojiSourceIngredients } from '../engine/src/emoji-rights.ts';
import { fixture, fixtureRoot, style } from './helpers/emoji-fixtures.ts';
import { parseEmojiXml } from './helpers/emoji-xml.ts';

const GRIN = '\u{1F600}';

function loader(directory: string): EmojiTextIO {
  return {
    loadArtwork: async (_pin, asset) => new Uint8Array(await readFile(new URL(`${directory}/${asset.url}`, fixtureRoot))),
    parseXml: parseEmojiXml,
  };
}

function page(body: string): { root: EmojiDomElement; element: Element; html: () => string } {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root">${body}</div></body></html>`);
  const element = dom.window.document.getElementById('root')!;
  return { root: element as unknown as EmojiDomElement, element, html: () => element.innerHTML };
}

/** Every character that is on screen: text outside the clipped copy-and-search span. */
function visibleText(element: Element): string {
  let text = '';
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === 3) text += node.textContent ?? '';
    else if (node.nodeType === 1) {
      const child = node as Element;
      if (child.classList.contains('lolly-emoji-text')) continue;
      text += visibleText(child);
    }
  }
  return text;
}

test('the trigger is a cheap pre-check, not the decision', () => {
  assert.equal(emojiTextTrigger('plain words'), false);
  assert.equal(emojiTextTrigger(`a ${GRIN}`), true);
  assert.equal(emojiTextTrigger('7️⃣'), true);
  assert.equal(emojiTextTrigger('a‍b'), true);
  // A BMP character in the emoji ranges triggers; segmentEmojiText still calls it text.
  assert.equal(emojiTextTrigger('© 2026'), true);
});

test('the trigger says yes to every emoji in the pinned table', async () => {
  // The runtime now asks this before it loads a pack, so a miss here is a glyph that
  // stays the machine's own, on every surface.
  const { readFile } = await import('node:fs/promises');
  const data = JSON.parse(await readFile(new URL('../engine/src/emoji-data/17.0.json', import.meta.url), 'utf8')) as { entries: { key: string; aliases?: string[] }[] };
  const text = (key: string): string => key.split('-').map(hex => String.fromCodePoint(Number.parseInt(hex, 16))).join('');
  const missed: string[] = [];
  let checked = 0;
  for (const entry of data.entries) for (const key of [entry.key, ...(entry.aliases ?? [])]) {
    checked++;
    if (!emojiTextTrigger(text(key))) missed.push(key);
  }
  assert.equal(checked, 3953 + 1272, 'the whole table: every canonical entry and every qualification alias');
  assert.deepEqual(missed, []);
});

test('the trigger says no to ordinary text in any language', () => {
  // A set is a download. None of these is worth one.
  for (const sample of ['Caf\u00e9 cr\u00e8me', 'fa\u00e7ade \u2014 na\u00efve', '\u201cquoted\u201d \u2018text\u2019\u2026', '\u65e5\u672c\u8a9e\u306e\u6587\u7ae0', '\u041f\u0440\u0438\u0432\u0435\u0442', '\u0645\u0631\u062d\u0628\u0627', '\u20ac 10 \u00b0C \u00b1 2', '1 + 2 = 3 # * ok']) {
    assert.equal(emojiTextTrigger(sample), false, sample);
  }
});

test('a text node becomes artwork, and the characters it stood for survive', async () => {
  const input = await fixture('twemoji');
  const view = page(`<p>Hello ${GRIN} world</p>`);
  const result = await applyEmojiToDom(view.root, style(input.lock.pin), [input.pack], loader('twemoji'));

  assert.deepEqual([result.replaced, result.unresolved], [1, 0]);
  assert.equal(view.element.textContent, `Hello ${GRIN} world`);
  assert.equal(visibleText(view.element), 'Hello  world');

  const span = view.element.querySelector('.lolly-emoji')!;
  assert.equal(span.getAttribute('role'), 'img');
  assert.equal(span.getAttribute('aria-label'), 'grinning face');
  assert.equal(span.getAttribute('data-emoji'), GRIN);
  assert.equal(span.getAttribute('data-emoji-key'), '1f600');
  assert.equal(span.getAttribute('data-emoji-at'), '6');
  assert.match(span.getAttribute('style') ?? '', /width:1em;height:1em;vertical-align:-0\.15em/);
  const svg = span.querySelector('svg')!;
  assert.equal(svg.getAttribute('aria-hidden'), 'true');
  assert.ok(svg.querySelector('path'), 'the pinned vector artwork is in the tree');
  assert.equal(span.querySelector('.lolly-emoji-text')!.textContent, GRIN);

  // One census entry, ready for the rights writer.
  assert.equal(result.census.length, 1);
  assert.deepEqual(result.census[0]!.occurrences, [{ start: 6, end: 8 }]);
  const ingredients = emojiSourceIngredients(result.census);
  assert.equal(ingredients[0]!.relationship, 'componentOf');
  assert.equal(ingredients[0]!.title, 'grinning face (Twemoji Color 17.0.3)');
  assert.equal(ingredients[0]!.rights!.usedHash, result.census[0]!.canonicalChecksum);
  assert.equal(ingredients[0]!.hash!.length, 32);
});

test('markup, control values and existing vectors are left alone', async () => {
  const input = await fixture('twemoji');
  const view = page(
    `<script>var a = "${GRIN}";</script><style>/* ${GRIN} */</style>`
    + `<textarea>${GRIN}</textarea><select><option>${GRIN}</option></select>`
    + `<svg viewBox="0 0 8 8"><text>${GRIN}</text></svg><p>${GRIN}</p>`,
  );
  const result = await applyEmojiToDom(view.root, style(input.lock.pin), [input.pack], loader('twemoji'));

  assert.deepEqual([result.replaced, result.unresolved], [1, 0]);
  assert.equal(view.element.querySelectorAll('.lolly-emoji').length, 1);
  assert.equal(view.element.querySelector('p')!.querySelector('.lolly-emoji') !== null, true);
  for (const selector of ['script', 'style', 'textarea', 'option', 'svg text']) {
    assert.equal(view.element.querySelector(selector)!.textContent!.includes(GRIN), true, `${selector} keeps its own text`);
    assert.equal(view.element.querySelector(selector)!.querySelector('.lolly-emoji'), null, `${selector} is not rewritten`);
  }
});

test('the host decides what it is editing, and the pass leaves it alone', async () => {
  const input = await fixture('twemoji');
  const view = page(`<div contenteditable="true">${GRIN}</div><div class="busy">${GRIN}</div><p>${GRIN}</p>`);
  const asked: string[] = [];
  const result = await applyEmojiToDom(view.root, style(input.lock.pin), [input.pack], loader('twemoji'), {
    skip: element => {
      asked.push(element.getAttribute('class') || element.nodeName);
      return (element.getAttribute('class') ?? '') === 'busy';
    },
  });

  assert.equal(result.replaced, 1);
  assert.equal(view.element.querySelector('p .lolly-emoji') !== null, true);
  assert.equal(view.element.querySelector('[contenteditable] .lolly-emoji'), null);
  assert.equal(view.element.querySelector('.busy .lolly-emoji'), null);
  // The element being edited is skipped on its own attribute, so it never even
  // reaches the host's predicate: the root, the busy box and the paragraph do.
  assert.deepEqual(asked, ['DIV', 'busy', 'P']);
});

test('two copies of one glyph never share a gradient or clip path', async () => {
  const input = await fixture('noto');
  const view = page(`<p>${GRIN}${GRIN}</p>`);
  const result = await applyEmojiToDom(view.root, style(input.lock.pin), [input.pack], loader('noto'));
  assert.equal(result.replaced, 2);

  const svgs = Array.from(view.element.querySelectorAll('.lolly-emoji svg'));
  assert.equal(svgs.length, 2);
  const ids = svgs.map(svg => Array.from(svg.querySelectorAll('[id]')).map(node => node.getAttribute('id')!));
  assert.ok(ids[0]!.length > 0, 'this fixture really does carry local ids');
  assert.deepEqual(ids[0]!.filter(id => ids[1]!.includes(id)), [], 'no id appears in both placements');
  assert.equal(result.census.length, 1, 'one artwork, whatever it was placed as');
  assert.equal(result.census[0]!.occurrences.length, 2);
});

test('running the pass again changes nothing and reports the same result', async () => {
  const input = await fixture('twemoji');
  const view = page(`<p>a ${GRIN} b</p><p>${GRIN}</p>`);
  const chosen = style(input.lock.pin);
  const first = await applyEmojiToDom(view.root, chosen, [input.pack], loader('twemoji'));
  const markup = view.html();
  const second = await applyEmojiToDom(view.root, chosen, [input.pack], loader('twemoji'));

  assert.equal(view.html(), markup, 'the tree is untouched the second time');
  assert.deepEqual(second, first);
  assert.equal(second.replaced, 2);
  assert.equal(second.census.length, 1);
  assert.deepEqual(second.census[0]!.occurrences, [{ start: 2, end: 4 }, { start: 0, end: 2 }]);
});

test('reverting gives back exactly the text that was there', async () => {
  const input = await fixture('twemoji');
  const before = `<p>Hello ${GRIN} world</p><p>${GRIN}${GRIN}</p>`;
  const view = page(before);
  await applyEmojiToDom(view.root, style(input.lock.pin), [input.pack], loader('twemoji'));
  assert.notEqual(view.html(), before);

  const reverted = revertEmojiDom(view.root);
  assert.equal(reverted, 3);
  assert.equal(view.html(), before);
  assert.equal(revertEmojiDom(view.root), 0, 'a reverted tree has nothing left to revert');
});

test('a node the segmenter refuses draws placeholders, never the system glyph', async () => {
  const input = await fixture('twemoji');
  const view = page(`<p id="broken"></p><p>${GRIN}</p>`);
  // A lone surrogate cannot be written as markup, so it goes in as character data.
  view.element.querySelector('#broken')!.textContent = `\uD800${GRIN}`;

  const result = await applyEmojiToDom(view.root, style(input.lock.pin), [input.pack], loader('twemoji'));
  assert.equal(result.replaced, 1, 'the sound paragraph is still drawn');
  const broken = view.element.querySelector('#broken')!;
  const mark = broken.querySelector('.lolly-emoji')!;
  assert.ok(mark.classList.contains('lolly-emoji--unset'), 'the refused run is drawn as the placeholder');
  assert.equal(mark.getAttribute('data-emoji-why'), 'unreadable-text');
  assert.equal(broken.textContent, `\uD800${GRIN}`, 'and the characters are still there to copy');
  assert.equal(broken.innerHTML.includes(`>${GRIN}<`), true, 'the raw glyph survives only inside the hidden text span');
});

test('a run longer than the segmenter accepts is cut, not refused', async () => {
  const input = await fixture('twemoji');
  const view = page('<p id="long"></p>');
  const filler = 'a'.repeat(70_000);
  view.element.querySelector('#long')!.textContent = `${filler}${GRIN}`;

  const result = await applyEmojiToDom(view.root, style(input.lock.pin), [input.pack], loader('twemoji'));
  assert.equal(result.replaced, 1, 'the emoji at the end of a long paste is still drawn');
  const long = view.element.querySelector('#long')!;
  assert.equal(long.querySelectorAll('.lolly-emoji').length, 1);
  // The only places the characters may still appear are the hidden copy span and
  // the data attributes that name the cluster a placement stands for.
  const stripped = long.innerHTML
    .replace(/<span class="lolly-emoji-text"[^>]*>[^<]*<\/span>/g, '')
    .replace(/ (?:data-emoji|aria-label)="[^"]*"/g, '');
  assert.equal(stripped.includes(GRIN), false, 'no raw emoji code point is left in the drawn markup');
});

test('the same document drawn twice gives byte-identical markup', async () => {
  const input = await fixture('noto');
  const view = page(`<p>one ${GRIN}</p><p>two ${GRIN}</p>`);
  await applyEmojiToDom(view.root, style(input.lock.pin), [input.pack], loader('noto'));
  const first = view.html();

  // A repaint reverts and redraws; a second pass over the same tree must mint the
  // same placement ids, or an export after ten edits would differ from a first one.
  revertEmojiDom(view.root);
  await applyEmojiToDom(view.root, style(input.lock.pin), [input.pack], loader('noto'));
  assert.equal(view.html(), first, 'the second paint is identical to the first');

  const fresh = page(`<p>one ${GRIN}</p><p>two ${GRIN}</p>`);
  await applyEmojiToDom(fresh.root, style(input.lock.pin), [input.pack], loader('noto'));
  assert.equal(fresh.html(), first, 'and a fresh document draws the same bytes again');
});

test('a carriage return in the text survives the pass and the revert', async () => {
  const input = await fixture('twemoji');
  const view = page('<p id="crlf"></p>');
  const text = `line1\r\nline2\rline3 ${GRIN} end`;
  view.element.querySelector('#crlf')!.textContent = text;

  await applyEmojiToDom(view.root, style(input.lock.pin), [input.pack], loader('twemoji'));
  assert.equal(view.element.querySelector('#crlf')!.textContent, text, 'the pass changed no character');
  revertEmojiDom(view.root);
  assert.equal(view.element.querySelector('#crlf')!.textContent, text, 'and neither did the revert');
});

test('text inside an svg root is left alone, a stated gap rather than a silent one', async () => {
  const input = await fixture('twemoji');
  const view = page(`<svg viewBox="0 0 10 10"><text>Hi ${GRIN}</text></svg>`);
  const result = await applyEmojiToDom(view.root, style(input.lock.pin), [input.pack], loader('twemoji'));

  // Pinned so the limitation cannot drift either way without a decision: SVG text
  // has no nested-picture geometry, so the pass skips the subtree whole and
  // engine/emoji.md says so. Changing this means changing that page too.
  assert.deepEqual([result.replaced, result.unresolved], [0, 0]);
  assert.equal(view.element.querySelector('.lolly-emoji'), null);
  assert.equal(view.element.querySelector('text')!.textContent, `Hi ${GRIN}`);
});

test('with no set chosen every cluster is a neutral placeholder, never the system glyph', async () => {
  const input = await fixture('twemoji');
  const view = page(`<p>Hi ${GRIN}</p>`);
  const result = await applyEmojiToDom(view.root, null, [input.pack], loader('twemoji'));

  assert.deepEqual([result.replaced, result.unresolved], [0, 1]);
  assert.deepEqual(result.census, []);
  const span = view.element.querySelector('.lolly-emoji')!;
  assert.ok(span.classList.contains('lolly-emoji--unset'));
  assert.equal(span.getAttribute('aria-label'), `${GRIN} (no emoji set chosen)`);
  assert.equal(span.getAttribute('data-emoji-why'), 'selection-required');
  assert.equal(span.querySelector('svg circle') !== null, true, 'the placeholder is drawn');
  assert.equal(span.querySelector('svg path'), null, 'no pack artwork was placed');
  // The glyph survives for copy and search, and is nowhere on screen.
  assert.equal(view.element.textContent, `Hi ${GRIN}`);
  assert.equal(visibleText(view.element).includes(GRIN), false);

  // Choosing a set later upgrades the placeholder in place.
  const chosen = await applyEmojiToDom(view.root, style(input.lock.pin), [input.pack], loader('twemoji'));
  assert.deepEqual([chosen.replaced, chosen.unresolved], [1, 0]);
  assert.equal(view.element.querySelectorAll('.lolly-emoji').length, 1);
  assert.equal(view.element.querySelector('.lolly-emoji--unset'), null);
  assert.deepEqual(chosen.census[0]!.occurrences, [{ start: 3, end: 5 }]);
  assert.equal(view.element.textContent, `Hi ${GRIN}`);
});
