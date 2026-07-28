// SPDX-License-Identifier: MPL-2.0
/**
 * email-signature inlined-logo credential guard.
 *
 * The signature's `html` output — the one people actually paste — has no
 * container that can hold a C2PA manifest (embedding is container-gated; see
 * engine C2PA_FORMATS). So the inlined wordmark PNG is the ONLY place provenance
 * can live on the pasted path, and it gets there by `npm run sign:signature-logos`
 * signing the masters in place and syncing their base64 into hooks.js.
 *
 * That arrangement is silently breakable: re-export a logo by hand, paste fresh
 * base64 into hooks.js, and the credential is gone with nothing to notice. These
 * tests are the guard — they assert the inlined bytes ARE the signed masters and
 * that the credential still verifies against the root the app pins.
 *
 * The tool ships in the private SUSE pack, so the suite skips when the pack is not
 * mounted (public CI / lolly-start checkouts). With the pack mounted, a missing
 * tool dir FAILS loudly rather than skipping — the color-block.test.ts precedent.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { verifyC2pa, extractC2paStore } from '../engine/src/index.ts';
import { pemToDer } from '../engine/src/x509.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOOL = join(ROOT, 'brands', 'suse', 'tools', 'email-signature');

const PACK_MOUNTED = existsSync(join(ROOT, 'brands', 'suse', 'tools'));
const SKIP_SUSE = !PACK_MOUNTED && 'SUSE brand pack not mounted (see profiles.json)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(TOOL, 'hooks.js')),
    'brands/suse/tools/email-signature/hooks.js is missing — pack is mounted, so the tool was renamed or deleted');
}

// The trust anchor the deployed app pins (shells/web/src/ca-root.ts) — the same
// one views/valid.ts hands verifyC2pa, so "trusted" here means trusted there.
function pinnedAnchor(): Uint8Array[] {
  const src = readFileSync(join(ROOT, 'shells/web/src/ca-root.ts'), 'utf8');
  const m = src.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
  return m ? [pemToDer(m[0])] : [];
}

const LOGOS = [
  { varName: 'LOGO_STANDARD', master: 'suse.png' },
  { varName: 'LOGO_GREY', master: 'suse-grey.png' },
];

/** The bytes hooks.js actually inlines for one logo. */
function inlinedBytes(varName: string): Uint8Array {
  const src = readFileSync(join(TOOL, 'hooks.js'), 'utf8');
  const m = new RegExp(`var\\s+${varName}\\s*=\\s*'data:image/png;base64,([A-Za-z0-9+/=]+)'`).exec(src);
  assert.ok(m, `hooks.js no longer declares ${varName} as a base64 PNG data URI`);
  return new Uint8Array(Buffer.from(m![1]!, 'base64'));
}

for (const { varName, master } of LOGOS) {
  test(`email-signature: inlined ${varName} is byte-identical to its signed master`, { skip: SKIP_SUSE }, () => {
    const inlined = inlinedBytes(varName);
    const onDisk = new Uint8Array(readFileSync(join(TOOL, master)));
    assert.deepEqual(inlined, onDisk,
      `${varName} has drifted from ${master} — re-run \`npm run sign:signature-logos\` rather than pasting base64 by hand`);
  });

  test(`email-signature: inlined ${varName} carries Content Credentials`, { skip: SKIP_SUSE }, () => {
    const store = extractC2paStore(inlinedBytes(varName));
    assert.ok(store, `${varName} has no C2PA manifest — a hand re-export dropped the credential`);
  });

  test(`email-signature: ${varName}'s credential verifies as SUSE, delivered by Lolly`, { skip: SKIP_SUSE }, async () => {
    const report = await verifyC2pa(inlinedBytes(varName), { trustAnchors: pinnedAnchor() });
    assert.equal(report.found, true);
    assert.equal(report.state, 'valid', 'credential does not verify — the bytes changed after signing');
    // Identity: authored by SUSE, signed+delivered under Lolly's CA identity. We
    // hold no SUSE-issued certificate, so "signed as SUSE" can only ever mean this.
    assert.equal(report.author?.name, 'SUSE', 'the CreativeWork author must record SUSE');
    assert.equal(report.delivered, true, 'the claim must be c2pa.published (delivered), never created');
    assert.equal(report.trusted, true,
      'credential does not chain to the CA root the app pins — sign with the CA tier, not --self');
    assert.deepEqual((report.checks ?? []).filter(c => !c.ok), [], 'every validation check must pass');
  });
}

test('email-signature: the wordmark is exactly 2x its display box', { skip: SKIP_SUSE }, () => {
  // The template renders width="102" height="19"; anything above 2x makes a
  // sizing-stripped client blow the footer apart (see the hooks.js header).
  const src = readFileSync(join(TOOL, 'template.html'), 'utf8');
  const m = /<img[^>]*alt="SUSE"[^>]*>/.exec(src);
  assert.ok(m, 'the footer no longer has an <img alt="SUSE">');
  const w = /\bwidth="(\d+)"/.exec(m![0]);
  const h = /\bheight="(\d+)"/.exec(m![0]);
  assert.ok(w && h, 'the wordmark must carry BOTH width and height ATTRIBUTES — some clients drop inline CSS');
  assert.match(m![0], /style="[^"]*\bwidth:\s*(\d+)px/, 'and matching inline CSS — other clients drop the attributes');

  for (const { varName } of LOGOS) {
    // IHDR: width/height are the two big-endian uint32s at byte 16.
    const png = inlinedBytes(varName);
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    assert.equal(view.getUint32(16), Number(w![1]) * 2, `${varName} pixel width must be 2x the display width`);
    assert.equal(view.getUint32(20), Number(h![1]) * 2, `${varName} pixel height must be 2x the display height`);
  }
});
