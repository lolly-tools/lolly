// SPDX-License-Identifier: MPL-2.0
/**
 * The sample deck Rebrand offers a first-time user, and that the Rebrand docs
 * screenshots open (`shells/web/public/samples/rebrand/harbourside-night-market.pptx`,
 * built by scripts/build-rebrand-sample.ts).
 *
 * Three things are pinned. The committed file is exactly what the builder makes, so
 * the sample is reproducible rather than a found object. The engine reads it the way
 * it reads a dropped deck, with every slide present. And its content stays what the
 * docs describe: nine slides, the mark and footer on the layouts, a photo, a table.
 *
 * Run with: node --test tests/rebrand-sample.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)

import { readPptx } from '../engine/src/pptx-read.ts';
import { inflatePptx } from '../packages/node-shell/src/pptx.ts';
import { buildRebrandSample, SAMPLE_DECK_PATH } from '../scripts/build-rebrand-sample.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const committed = new Uint8Array(readFileSync(path.join(ROOT, SAMPLE_DECK_PATH)));

const win = new JSDOM('').window;
const domParser = new win.DOMParser();
const parseXml = (xml: string): Document => domParser.parseFromString(xml, 'application/xml') as unknown as Document;

test('the committed sample deck is exactly what the builder makes', () => {
  const rebuilt = buildRebrandSample();
  assert.equal(rebuilt.length, committed.length, 'run `pnpm run build:rebrand-sample` and commit the result');
  assert.ok(Buffer.from(rebuilt).equals(Buffer.from(committed)), 'run `pnpm run build:rebrand-sample` and commit the result');
});

test('the sample deck reads as nine slides, with the text the docs describe', async () => {
  const deck = readPptx(await inflatePptx(committed), parseXml);
  assert.equal(deck.slides.length, 9);
  const text = JSON.stringify(deck.slides);
  for (const phrase of ['Harbourside Night Market', 'Three things that worked', 'Visitors per night, by month', 'Lanterns on the pier', 'Stallholders by category', 'Next season', 'Thank you']) {
    assert.ok(text.includes(phrase), `slide text lost: ${phrase}`);
  }
});

test('the sample stays small enough to fetch on first use', () => {
  assert.ok(committed.length < 200_000, `sample deck is ${committed.length} bytes`);
});
