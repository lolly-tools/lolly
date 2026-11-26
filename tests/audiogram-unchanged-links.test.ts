// SPDX-License-Identifier: MPL-2.0
//
// Audiogram took over Voice Recorder's work (the coaching inputs `targetLevel` and
// `showTips`). An Audiogram link made before that must draw what it drew: these
// digests were taken from the tree before the two inputs were added, with this same
// file, so a change to what an old link hydrates to fails here.
//
// The two new inputs steer the recording control in the shell and nothing on the
// card, which the last test states directly.
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

/** Taken on origin/main at 1c3186fcce (Audiogram 2.8.0), before the coaching inputs. */
const WANT: Record<string, string> = {
  defaults: '8a0b3b0e43d1b4ccb15f7d13e73d00a910c5d80c77675587fec6cd002c9aa649',
  podcast: '5bcea83452bfd167e8f24feb0328d06891e49b340886f797035b8572d3395fa7',
  wave: 'ad522a41cf3b9d0beda7e331c095f5beb615c2e032313d31c275f048776b5300',
  colours: '35f0b392da9359bcc38554bedb5b4bce41912ddfa5b5f4cea60610c7e3add694',
  captions: '7d3a8a98c32e333c70b2171422959e0de591c43989da1fdc63f3a26377e272ee',
};

async function hydrate(query: string, extra: Record<string, unknown> = {}): Promise<string> {
  const tool = await loadTool('audiogram', (p) => readFile(join(COMMUNITY, p), 'utf8'));
  const { values } = parseUrlState(query, tool.manifest as never);
  const runtime = await createRuntime(tool as never, baseHost(), { ...values, ...extra } as never);
  return runtime.getHydrated();
}

const digest = (text: string): string => createHash('sha256').update(text).digest('hex');

for (const [name, query] of Object.entries(LINKS)) {
  test(`an Audiogram link from before the merge draws the same card: ${name}`, { skip: SKIP }, async () => {
    const got = digest(await hydrate(query));
    assert.equal(got, WANT[name]);
  });
}

test('the coaching inputs change nothing on the card', { skip: SKIP }, async () => {
  const plain = await hydrate(LINKS.podcast!);
  const coached = await hydrate(LINKS.podcast!, { targetLevel: 'loud', showTips: false });
  assert.equal(coached, plain);
});
