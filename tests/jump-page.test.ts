// SPDX-License-Identifier: MPL-2.0
/**
 * Jump Page (community/jump) - link-list contract.
 *
 * The tool is a landing page whose whole state rides in the share link, so what
 * matters is that typed addresses become working anchors: bare domains get a
 * scheme, labels fall back to the bare host, blank rows vanish, and the list
 * caps at ten. One case drives the compact hand-typed URL form end to end
 * (`?l=Label,suse.com~...`) through the real parser, since "type a link list
 * straight into the address bar" is part of the point.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/jump-page.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { parseUrlState } from '../engine/src/url-mode.ts';
import { baseHost } from './helpers/host.ts';

const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const SKIP = !existsSync(COMMUNITY) && 'community pack not mounted (clone without submodules)';
const tool: any = SKIP ? null : await loadTool('jump',
  (path: string) => readFile(join(COMMUNITY, path), 'utf8'));

async function mount(values: Record<string, any>) {
  const rt = await createRuntime(tool, baseHost(), values);
  return { rt, svg: rt.getHydrated() as string, error: rt.getHydratedText('{{error}}') };
}

test('bare domains get a scheme, labels fall back to the host, blanks vanish', { skip: SKIP }, async () => {
  const { svg, error } = await mount({
    links: [
      { label: 'SUSE', url: 'suse.com' },
      { label: '', url: 'https://www.lolly.tools/gallery' },
      { label: 'Ignored', url: '' },
      { label: 'Mail', url: 'mailto:hello@example.com' },
    ],
  });
  assert.equal(error, '');
  assert.ok(svg.includes('href="https://suse.com"'), 'bare domain gained https://');
  assert.ok(svg.includes('>lolly.tools</span>'), 'empty label falls back to the bare host (no www.)');
  assert.ok(svg.includes('href="mailto:hello@example.com"'), 'mailto keeps its own scheme');
  assert.ok(!svg.includes('Ignored'), 'a row with no address leaves no trace');
});

test('the list caps at ten links', { skip: SKIP }, async () => {
  const links = Array.from({ length: 14 }, (_, i) => ({ label: `L${i}`, url: `https://example.com/${i}` }));
  const { svg } = await mount({ links });
  assert.ok(svg.includes('>L9<'), 'the tenth link renders');
  assert.ok(!svg.includes('>L10<'), 'the eleventh does not');
});

test('no usable links renders the hint, not an empty page', { skip: SKIP }, async () => {
  const { svg, error } = await mount({ links: [] });
  assert.match(error, /add a link/i);
  assert.ok(svg.includes('Add a link to build the page.'));
});

test('the compact hand-typed URL form drives the page through the real parser', { skip: SKIP }, async () => {
  const state = parseUrlState('l=SUSE,suse.com~,docs.suse.com&style=cards', tool.manifest);
  const { svg, error } = await mount(state.values);
  assert.equal(error, '');
  assert.ok(svg.includes('jp-cards'));
  assert.ok(svg.includes('href="https://suse.com"'));
  assert.ok(svg.includes('>docs.suse.com</span>'), 'second row: label omitted, host stands in');
});

test('every example hydrates into a real page', { skip: SKIP }, async () => {
  for (const ex of tool.manifest.examples ?? []) {
    const got = await mount(ex.values);
    assert.deepEqual(got.rt.hookErrors, [], `${ex.label}: hooks errored`);
    assert.equal(got.error, '', `${ex.label}: ${got.error}`);
    assert.ok(got.svg.includes('jp-link'), `${ex.label}: no links rendered`);
  }
});
