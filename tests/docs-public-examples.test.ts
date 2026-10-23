// SPDX-License-Identifier: MPL-2.0
/**
 * Public examples run on a public clone.
 *
 * A docs example that uses a tool or catalog asset only the private SUSE pack has (or one
 * that does not exist at all) opens "Tool not found" on lolly.tools, which runs Lolly Demo,
 * and in every public clone. The public tree is community/, brands/lolly-start and
 * brands/lolly-demo, read through their profiles in profiles.json, so this answer is the
 * same in CI (no brands/suse) as on a SUSE developer's machine.
 *
 * The scan (scripts/docs-ratchets.ts) reads the places an id is unambiguous: /tool/ and /t/
 * routes (also percent-encoded inside url-shot recipes), tool fields in JSON and MCP
 * examples, `tool=` parameters, CLI invocations, "tools such as `a`, `b`" lists, "`a`
 * composes `b`", the `<id> --export=` shorthand, and catalog asset ids by namespace.
 *
 * A ratchet, not a clean gate: scripts/data/docs-ratchets/public-examples.json records the
 * ids English pages carried on 2026-10-23, including those in the docs PRs open then, and
 * only an id missing from it fails. Replace an example with a lolly-demo or lolly-start id.
 *
 * Run directly: node --test tests/docs-public-examples.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cliToolIds, cliVerbs, newExamples, publicIds, readExamplesBaseline, scanAllExamples, scanExamples, workingTree,
} from '../scripts/docs-ratchets.ts';

const ids = publicIds();
const verbs = cliVerbs();
const scan = (text: string, src = 'docs/sample.md') => scanExamples(src, text, ids, verbs).map(h => `${h.kind} ${h.id}`);

test('no English page names a private or missing tool or asset id beyond the baseline', () => {
  const fresh = newExamples(scanAllExamples(workingTree()), readExamplesBaseline());
  assert.deepEqual(
    fresh.map(h => `${h.src}:${h.line} ${h.kind} "${h.id}"`), [],
    'these examples will not run on lolly.tools or a public clone. Use a tool from community/ or an asset from brands/lolly-demo or brands/lolly-start (lolly/logo/primary, lolly/tokens/demo).',
  );
});

test('the public tree is read from the public profiles', () => {
  for (const id of ['qr-code', 'design', 'chart', 'url-shot']) assert.ok(ids.tools.has(id), id);
  for (const id of ['lolly/logo/primary', 'lolly/tokens/demo', 'lolly/tokens/brand', 'community/emoji/twemoji/color']) assert.ok(ids.assets.has(id), id);
  assert.ok(![...ids.assets].some(id => id.startsWith('suse/')), 'a SUSE asset leaked into the public set');
  assert.ok(ids.tools.size > 40 && ids.assets.size > 40, 'the public tree scan found too little to be real');
});

test('routes, links and fields name tools', () => {
  assert.deepEqual(scan('Open [Quotes](/tool/quotes) or #/tool/qr-code.'), ['tool quotes']);
  assert.deepEqual(scan('<img src="https://lolly.tools/tool/email-signature.svg?name=A">'), ['tool email-signature']);
  assert.deepEqual(scan('![x](/t/url-shot?url=%2F%23%2Ftool%2Fpose-geeko%3Fa%3D1)'), ['tool pose-geeko']);
  assert.deepEqual(scan('{ "toolId": "chart-creator" } and ?tool=d3'), ['tool chart-creator', 'tool d3']);
  // A path that merely contains /tool/ is not a route.
  assert.deepEqual(scan('See engine/src/tool/loader and /api/v1/tool/x.'), []);
});

test('CLI invocations name tools, and the CLI verbs do not', () => {
  assert.deepEqual(cliToolIds('lolly quotes --export=md', verbs), ['quotes']);
  assert.deepEqual(cliToolIds('$ pnpm --silent run cli batch --template=qr-code,chart-creator > rows.csv', verbs), ['qr-code', 'chart-creator']);
  assert.deepEqual(cliToolIds('lolly run event-name-badge --name=A && lolly describe qr-code', verbs), ['event-name-badge', 'qr-code']);
  assert.deepEqual(cliToolIds('lolly inspect card.svg; lolly --help; cd lolly && pnpm install', verbs), []);
  assert.deepEqual(scan('```sh\nLOLLY_PROFILE=lolly-demo lolly quotes\n```'), ['tool quotes']);
  assert.deepEqual(scan('Run `lolly email-signature --export=vcf`.'), ['tool email-signature']);
  // On a Work guide, `pnpm run cli` is the Work repository's own CLI.
  assert.deepEqual(scan('```sh\npnpm run cli whoami\n```', 'docs/work/install.md'), []);
  assert.deepEqual(scan('```sh\npnpm run cli whoami\n```', 'docs/cli.md'), ['tool whoami']);
});

test('prose names tools only where the sentence makes the id unambiguous', () => {
  assert.deepEqual(scan('Used by tools such as `pose-geeko`, `qr-code` and `quotes`.'), ['tool pose-geeko', 'tool quotes']);
  assert.deepEqual(scan('For example, `event-name-badge` composes `qr-code` as an SVG.'), ['tool event-name-badge']);
  assert.deepEqual(scan('| `chart-creator --export=csv`, `qr-code --export=svg` |'), ['tool chart-creator']);
  // A backticked word beside "tool" is too often an adjective (an `ffmpeg` tool, a `paged` tool).
  assert.deepEqual(scan('An `ffmpeg` tool is unavailable; the lean CLI composes `svg` children.'), []);
});

test('asset ids are read by namespace, and paths are not ids', () => {
  assert.deepEqual(scan('Pass `logo=suse/logo/primary` or suse/logo/... for the rest.'), ['asset suse/logo/primary', 'asset suse/logo/...']);
  assert.deepEqual(scan('The id lolly/logo/primarry is a typo; lolly/logo/primary is real.'), ['asset lolly/logo/primarry']);
  assert.deepEqual(scan('cd lolly/shells/web, brands/suse/catalog/x, https://github.com/suse/x/y, lolly/logo/primary.svg'), []);
  assert.deepEqual(scan('Every lolly/loops/* asset ships with Lolly Demo.'), []);
});
