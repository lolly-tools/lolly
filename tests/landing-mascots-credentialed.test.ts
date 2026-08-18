// SPDX-License-Identifier: MPL-2.0
//
// Every animal mascot on the /info landing page MUST carry its genAI Content Credential.
// The whole point of replacing the illustrated mascots with AI-generated, Lolly-edited
// images was that a site arguing "AI should declare itself, provenance on by default"
// demonstrates the chain in its own artwork - each animal is a live, verifiable example.
// If a re-encode, an optimiser, or a careless overwrite ever strips the C2PA, the imprint
// glyph silently vanishes from that mascot and the argument quietly breaks. This fails the
// build instead, which is Andy's standing rule: never lose synthetic-content provenance.
//
// Reads the COMMITTED served bytes (shells/web/public/info/mascots), the same file the
// landing's credential line reads at build time and the browser fetches at runtime.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractC2paStore } from '../engine/src/index.ts';
import { collectActionChain } from '../engine/src/c2pa-extract.ts';

const GENERATED = 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia';
const COMPOSITE = 'http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia';
const MASCOT_DIR = resolve(import.meta.dirname, '../shells/web/public/info/mascots');

// The animals that replaced the illustrated mascots (2026-08). Named explicitly so a
// mascot going MISSING is a failure too, not just a silent shrink of the glob.
// quokka.webp is on the landing too but its credential declares digitalCreation, not
// genAI, so it stays out of this genAI-only list on purpose (2026-08-18).
const MASCOTS = [
  'echidna.webp', 'koala.webp', 'kookaburra.webp', 'magpie.webp',
  'quoll.webp', 'ringtail-possum.webp', 'wedge-tailed-eagle.webp',
];

test('every landing mascot file still exists', () => {
  for (const m of MASCOTS) {
    assert.ok(existsSync(resolve(MASCOT_DIR, m)), `mascot ${m} is missing from ${MASCOT_DIR}`);
  }
});

for (const m of MASCOTS) {
  test(`landing mascot ${m} carries its genAI Content Credential`, () => {
    const bytes = new Uint8Array(readFileSync(resolve(MASCOT_DIR, m)));
    const ex = extractC2paStore(bytes);
    assert.ok(ex, `${m}: no C2PA store found — the credential was stripped (re-encode / optimiser?)`);
    const chain = collectActionChain(ex.store);
    assert.ok(chain.length > 0, `${m}: C2PA present but no action chain — the Lolly journey was lost`);
    const isGenAi = chain.some((s) => s.digitalSourceType === GENERATED || s.digitalSourceType === COMPOSITE);
    assert.ok(isGenAi, `${m}: credential present but the genAI flag (trainedAlgorithmicMedia) is gone — it would read as human-made`);
  });
}

test('no illustrated mascot (koala/quoll/quokka .png) was left behind', () => {
  // The originals were superseded by the credentialed webp/png set; a stray .png would
  // ship an undeclared stock image on the very site that argues against exactly that.
  const stray = readdirSync(MASCOT_DIR).filter((f) => /^(koala|quoll|quokka)\.png$/.test(f));
  assert.deepEqual(stray, [], `superseded illustrated mascots still present: ${stray.join(', ')}`);
});
