// SPDX-License-Identifier: MPL-2.0
/**
 * Sign with a Content Credential, end to end through the CLI. The stamp pass saves the
 * signed PDF with object streams, so its cross-reference is a stream, which the C2PA
 * embedder cannot extend: `host.c2pa.sign` saves such a PDF in the classic form first.
 * Both a source with a classic table and one with object streams must come out signed,
 * with a credential that verifies.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { verifyC2pa } from '../engine/src/c2pa-verify.ts';

async function aPdf(useObjectStreams: boolean): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const page = doc.addPage([612, 792]);
  page.drawText('Agreement', { x: 72, y: 700, font: await doc.embedFont(StandardFonts.Helvetica), size: 24 });
  return doc.save({ useObjectStreams });
}

for (const useObjectStreams of [false, true]) {
  test(`Sign adds a credential that verifies to a PDF ${useObjectStreams ? 'saved with object streams' : 'with a classic table'}`, async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lolly-sign-credential-'));
    try {
      const source = join(dir, 'agreement.pdf'), output = join(dir, 'signed.pdf');
      await writeFile(source, await aPdf(useObjectStreams));
      const run = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', 'pages', '--operation=sign', `--source=${source}`, '--signatureInk=M10,10L100,100', '--seal=true', `--output=${output}`], {
        cwd: new URL('..', import.meta.url), encoding: 'utf8', env: { ...process.env, LOLLY_STATE_DIR: join(dir, 'state') }, timeout: 120_000,
      });
      assert.equal(run.status, 0, run.stderr);
      const signed = new Uint8Array(await readFile(output));
      assert.equal((await verifyC2pa(signed)).state, 'valid');
      assert.equal((await PDFDocument.load(signed, { updateMetadata: false })).getPageCount(), 1);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
}
