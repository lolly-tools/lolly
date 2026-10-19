// SPDX-License-Identifier: MPL-2.0
/**
 * Lolly Demo's horizontal logo: the Lolly wordmark in one colour per ground. Andy's
 * brief (19 October 2026): Liquorice on light, Daylight reversed and Green Apple on
 * the brand ground. The three files are one drawing, and the logo slots in the design
 * system point the horizontal forms at the wordmark while the vertical forms keep the
 * square swirl mark.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createTokenSet } from '../engine/src/tokens.ts';

const ROOT = resolve(import.meta.dirname, '..');
const PACK = resolve(ROOT, 'brands/lolly-demo/catalog/assets');
const TOKENS = JSON.parse(readFileSync(resolve(PACK, 'lolly/tokens/demo.json'), 'utf8'));
const INDEX = JSON.parse(readFileSync(resolve(PACK, 'index.json'), 'utf8')) as { assets: Array<{ id: string; formats?: Array<{ url: string }> }> };
const BRAND: Record<string, { $value: string }> = TOKENS.base.color.brand;

const WORDMARKS = [
  { id: 'lolly/logo/horizontal', colour: 'liquorice' },
  { id: 'lolly/logo/horizontal-reverse', colour: 'daylight' },
  { id: 'lolly/logo/horizontal-on-brand', colour: 'green-apple' },
] as const;

function svgOf(id: string): string {
  const url = INDEX.assets.find(a => a.id === id)?.formats?.[0]?.url;
  assert.ok(url, `${id} is in the pack's asset index`);
  return readFileSync(resolve(PACK, url.replace('/catalog/assets/', '')), 'utf8');
}

test('the three wordmarks are one drawing, each filled with its Opal colour', () => {
  const drawings = new Set<string>();
  for (const { id, colour } of WORDMARKS) {
    const svg = svgOf(id);
    const fill = svg.match(/<path fill="(#[0-9a-f]{6})" d="([^"]+)"/);
    assert.ok(fill, `${id} is one filled path`);
    assert.equal(fill[1], BRAND[colour]?.$value.toLowerCase(), `${id} is ${colour}`);
    drawings.add(`${svg.match(/viewBox="([^"]+)"/)?.[1]} ${fill[2]}`);
  }
  assert.equal(drawings.size, 1, 'every colour draws the same wordmark');
});

test('the horizontal logo slots hold the wordmark and the vertical slots keep the mark', () => {
  const set = createTokenSet(TOKENS, { selection: { '': 'light' } });
  const slot = (variant: string): unknown => set.resolve(`asset.logo.${variant}`);
  assert.equal(slot('horizontal-primary'), 'lolly/logo/horizontal');
  assert.equal(slot('horizontal-mono'), 'lolly/logo/horizontal');
  assert.equal(slot('horizontal-primary-reverse'), 'lolly/logo/horizontal-reverse');
  assert.equal(slot('horizontal-mono-reverse'), 'lolly/logo/horizontal-reverse');
  assert.equal(slot('horizontal-on-brand'), 'lolly/logo/horizontal-on-brand', 'the Brand theme has a logo of its own');
  assert.equal(slot('vertical-primary'), 'lolly/logo/primary');
  assert.equal(slot('vertical-primary-reverse'), 'lolly/logo/reverse');
});
