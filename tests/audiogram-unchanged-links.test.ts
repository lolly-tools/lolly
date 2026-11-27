// SPDX-License-Identifier: MPL-2.0
//
// Audiogram took over Voice Recorder's work (the coaching inputs `targetLevel` and
// `showTips`). An Audiogram link made before that must draw what it drew, so a change
// to what an old link hydrates to fails here.
//
// What is pinned is the card's MARKUP: everything between the stylesheet and the
// script, which holds each value a link carries (the words, the colours, the still,
// the packed analysis, the captions). Audiogram 2.10.0 changed the other two parts,
// the same way for every link: the stylesheet sizes the type in the card's own unit,
// and the script learned the title entrance. So the digests were taken again, with
// this same file, from the tree before 2.10.0, and they match that tree's markup byte
// for byte. The stylesheet change was checked as pictures instead: the square card
// exports the same pixels as before.
//
// The two coaching inputs steer the recording control in the shell and nothing on the
// card, and Title motion left at None adds nothing: the last two tests state both.
//
// Run with:
//   node --import ./tests/css-stub.mjs --test tests/audiogram-unchanged-links.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { parseUrlState } from '../engine/src/url-mode.ts';
import { baseHost } from './helpers/host.ts';

const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const SKIP = !existsSync(join(COMMUNITY, 'audiogram', 'tool.json')) && 'community pack not mounted';

/** Links as a person shared them before the merge: none holds a coaching value. */
const LINKS: Record<string, string> = {
  defaults: '',
  podcast: 'title=Slow+is+smooth&subtitle=Build+Notes+%C2%B7+Ep.+41&style=bars',
  wave: 'title=Morning+briefing&style=wave&layout=center&size=wide&beat=false',
  colours: 'title=Field+notes&style=ring&layout=overlay-center&size=story&accent=%2330ba78&ink=%23ffffff&bg=%230c322c&start=2.5',
  captions: 'title=In+her+own+words&style=mirror&captions=true&transcript=1%0A00%3A00%3A00%2C200+--%3E+00%3A00%3A03%2C400%0AWe+started+with+one+question.%0A',
};

/** The markup's digest, taken on origin/main at 0967f65aad (Audiogram 2.9.0). */
const WANT: Record<string, string> = {
  defaults: '20740551b5e7578e9754e0009073bb7a0e14565c4ae9cbf1b676a6d3e0318395',
  podcast: '1f11e0a626858aeac0229e39eb1bdbc3a9527be49c62be4bd264fee43857eaa0',
  wave: 'a9c8ab85ef63b8ca8f48e9de7d48327559c942d82195cbd29c60e3f886ee67c6',
  colours: 'f97f8559f3fdc9e879418c780d2cb83b99fc451c95e6735e5b1e81572e11a6ba',
  captions: 'fb29a2407ea673bce46f22c5cedc6fdb0ce1499907c9c6ded2e9a5d8fd615e00',
};

/** The card between its stylesheet and its script. */
function markup(hydrated: string): string {
  const from = hydrated.indexOf('</style>');
  const to = hydrated.indexOf('<script>');
  assert.ok(from > 0 && to > from, 'the card is a stylesheet, markup and a script, in that order');
  return hydrated.slice(from, to);
}

async function hydrate(query: string, extra: Record<string, unknown> = {}): Promise<string> {
  const tool = await loadTool('audiogram', (p) => readFile(join(COMMUNITY, p), 'utf8'));
  const { values } = parseUrlState(query, tool.manifest as never);
  const runtime = await createRuntime(tool as never, baseHost(), { ...values, ...extra } as never);
  return runtime.getHydrated();
}

const digest = (text: string): string => createHash('sha256').update(text).digest('hex');

for (const [name, query] of Object.entries(LINKS)) {
  test(`an Audiogram link from before the merge draws the same card: ${name}`, { skip: SKIP }, async () => {
    const got = digest(markup(await hydrate(query)));
    assert.equal(got, WANT[name]);
  });
}

test('the coaching inputs change nothing on the card', { skip: SKIP }, async () => {
  const plain = await hydrate(LINKS.podcast!);
  const coached = await hydrate(LINKS.podcast!, { targetLevel: 'loud', showTips: false });
  assert.equal(coached, plain);
});

test('Title motion left at None changes nothing on the card', { skip: SKIP }, async () => {
  for (const query of Object.values(LINKS)) {
    const plain = await hydrate(query);
    assert.equal(await hydrate(query, { titleMotion: 'none' }), plain);
    assert.equal(/data-ag-entrance|data-ag-in=|class="ag-w"/.test(markup(plain)), false);
  }
});
