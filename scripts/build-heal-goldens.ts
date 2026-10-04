// SPDX-License-Identifier: MPL-2.0
/**
 * Build the healing goldens (plans/289 D4): run every case of
 * tests/helpers/heal-inputs.ts through Compositor's own C (`HealPixels.c`, MIT,
 * vendored unchanged in tests/fixtures/heal/) and write what it returns, so
 * tests/heal.test.ts can hold engine/src/heal.ts to the original.
 *
 *   node scripts/build-heal-goldens.ts           write tests/fixtures/heal/goldens.json
 *   node scripts/build-heal-goldens.ts --check   compare with the committed goldens
 *
 * Needs a C compiler (`cc`) and is run by hand; CI reads the committed file and
 * needs none. The oracle is built with `-ffp-contract=off`, because a compiler free
 * to fuse a multiply and an add rounds differently from the port, and the port is
 * held to float32 rounding at exactly the steps the C rounds.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { zlibSync } from 'fflate';
import { healCases } from '../tests/helpers/heal-inputs.ts';

const DIR = new URL('../tests/fixtures/heal/', import.meta.url).pathname;
const OUT = join(DIR, 'goldens.json');
const CFLAGS = ['-O2', '-std=c11', '-ffp-contract=off'];

const work = mkdtempSync(join(tmpdir(), 'heal-oracle-'));
try {
  const bin = join(work, 'heal-oracle');
  execFileSync('cc', [...CFLAGS, '-o', bin, join(DIR, 'harness.c'), join(DIR, 'HealPixels.c'), '-lm'], { stdio: 'inherit' });
  const cases = healCases().map((c) => {
    const head = new Uint32Array([c.width, c.height, c.mode, c.seed, Math.round(c.opacity * 1e6), 0]);
    const input = Buffer.concat([Buffer.from(head.buffer), Buffer.from(c.rgba), Buffer.from(c.coverage)]);
    const out = execFileSync(bin, [], { input, maxBuffer: 1 << 28 });
    if (out.length !== c.width * c.height * 4) throw new Error(`${c.name}: the oracle returned ${out.length} bytes`);
    return {
      name: c.name,
      sha256: createHash('sha256').update(out).digest('hex'),
      rgba: Buffer.from(zlibSync(out, { level: 9 })).toString('base64'),
    };
  });
  const doc = {
    about: 'Compositor spot_heal output for tests/helpers/heal-inputs.ts, built by scripts/build-heal-goldens.ts. rgba is zlib, base64.',
    oracle: { source: 'https://github.com/robbietilton/Compositor/blob/11d8d7a50992b24fd9a760a1c13b1c01b70aaf30/Compositor/Rendering/HealPixels.c', cflags: CFLAGS.join(' ') },
    cases,
  };
  const text = `${JSON.stringify(doc, null, 2)}\n`;
  if (process.argv.includes('--check')) {
    const was = readFileSync(OUT, 'utf8');
    if (was !== text) { console.error('heal goldens: the oracle output differs from tests/fixtures/heal/goldens.json'); process.exitCode = 1; }
    else console.log(`heal goldens: ${cases.length} cases match`);
  } else {
    writeFileSync(OUT, text);
    console.log(`heal goldens: wrote ${cases.length} cases to tests/fixtures/heal/goldens.json`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
