// SPDX-License-Identifier: MPL-2.0
/**
 * The PLATFORM default typeface - SUSE (UI/body) + SUSE Mono (code), shell-served
 * from shells/web/public/fonts/ so they resolve on EVERY profile.
 *
 * Why this file exists, and why it is at the repo root rather than beside
 * font-registry.ts: the sibling golden suite
 * (shells/web/src/bridge/text-outline-golden.test.ts) is the deep coverage of the
 * text→outline seam, but every one of its 26 cases reads a font out of
 * `catalog/fonts/` - a gitignored profile VIEW - and therefore SKIPS wholesale on
 * the `lolly-start` profile and in any public CI run that never mounted
 * brands/suse. That is correct for a brand-pack-specific golden, but it left the
 * DEFAULT face with no coverage at all on the default profile. Everything here is
 * deliberately catalog-free, so it runs everywhere.
 *
 * The three properties pinned, all of which fail SILENTLY in production:
 *
 *  1. LICENCE. The shipped binaries must still say OFL 1.1 in name ID 13, and the
 *     licence text must still sit beside them. Read out of the actual font bytes,
 *     not out of documentation - this is the standing version of the manual check
 *     made when SUSE replaced Outfit as the default on 2026-08-10, so that a
 *     future font-file refresh cannot quietly ship non-OFL bytes in an OSS pack.
 *
 *  2. BOTH SLANTS. `PLATFORM_FACES` must declare a real italic for the default
 *     family, and every `staticUrl` in it must name a file that is on disk. A
 *     missing or mistyped entry does not throw: `pickFaces` is strict about slant,
 *     so the run simply keeps its `<text>` element and the export still "succeeds"
 * - shipping a font-dependent SVG to someone who does not have the font. That
 *     is exactly the bug the swap away from (upright-only) Outfit fixed: before it,
 *     every italic run under the neutral profile fell back to `<text>`, which is
 *     what the docs-shot pipeline was reporting as
 *     "N <text> node(s) - a font did not outline".
 *
 *  3. IT ACTUALLY OUTLINES. Real HarfBuzz WASM shaping real bytes off disk,
 *     through the web shell's own `createTextAPI` - the same path
 *     shells/web/src/bridge/export.ts uses on SVG/PDF export. Asserting the file
 *     merely exists would not catch a truncated or wrong-format download.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createTextAPI } from '../shells/web/src/bridge/text.ts';
import { PLATFORM_FACES } from '../shells/web/src/bridge/font-registry.ts';

const REPO_ROOT_URL = new URL('../', import.meta.url);
const repoPath = (rel: string): string => fileURLToPath(new URL(rel, REPO_ROOT_URL));

/** A `staticUrl` from PLATFORM_FACES ("/fonts/x.ttf") → its path in the web shell. */
const shellFontPath = (staticUrl: string): string =>
  repoPath(`shells/web/public${staticUrl}`);

// The family tokens.css sets as `--font-brand`, and the one this file is about.
const DEFAULT_FAMILY = 'suse';

// ── 1. Licence, read out of the shipped bytes ────────────────────────────────

/** Minimal sfnt `name` table reader - enough for the licence IDs. Deliberately
 *  standalone rather than reusing shells/web/src/lib/font-utils.ts: this test is
 *  the independent check ON that kind of parsing, so it must not inherit its
 *  assumptions. */
function nameRecords(bytes: Buffer): Map<number, string> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const numTables = dv.getUint16(4);
  let nameOff = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (String.fromCharCode(bytes[rec]!, bytes[rec + 1]!, bytes[rec + 2]!, bytes[rec + 3]!) === 'name') {
      nameOff = dv.getUint32(rec + 8);
    }
  }
  assert.notEqual(nameOff, -1, 'font has no name table');
  const count = dv.getUint16(nameOff + 2);
  const strOff = nameOff + dv.getUint16(nameOff + 4);
  const out = new Map<number, string>();
  for (let i = 0; i < count; i++) {
    const r = nameOff + 6 + i * 12;
    const platformId = dv.getUint16(r);
    const nameId = dv.getUint16(r + 6);
    const len = dv.getUint16(r + 8);
    const off = dv.getUint16(r + 10);
    const raw = bytes.subarray(strOff + off, strOff + off + len);
    // platform 3 (Windows) and 0 (Unicode) are UTF-16BE; 1 (Mac) is single-byte.
    const decoded = platformId === 1 ? raw.toString('latin1') : Buffer.from(raw).swap16().toString('utf16le');
    if (!out.has(nameId)) out.set(nameId, decoded);
  }
  return out;
}

test('the shipped platform faces still declare the SIL OFL in their own bytes', () => {
  const faces = Object.values(PLATFORM_FACES).flat();
  assert.ok(faces.length > 0, 'PLATFORM_FACES is empty');
  for (const face of faces) {
    const path = shellFontPath(face.staticUrl);
    const names = nameRecords(readFileSync(path));
    const licence = names.get(13) ?? '';
    assert.match(
      licence,
      /SIL Open Font License, Version 1\.1/,
      `${face.staticUrl} name ID 13 must state the OFL 1.1 — a platform face ships in the OSS pack. Got: ${JSON.stringify(licence)}`,
    );
    // OFL section 3: a Reserved Font Name would forbid shipping the file under its own
    // family name, which is exactly what fonts.css and tokens.css do. Verified
    // absent for SUSE on 2026-08-10; this catches a refreshed binary that adds one.
    const copyright = names.get(0) ?? '';
    assert.doesNotMatch(
      copyright,
      /Reserved Font Name/i,
      `${face.staticUrl} declares a Reserved Font Name (${JSON.stringify(copyright)}) — it can no longer ship under its own family name`,
    );
  }
});

test('an OFL licence file sits beside the shipped platform binaries', () => {
  // The OFL's own redistribution condition, and what brands/lolly-start/README.md
  // claims is met. One licence file per distinct copyright holder is enough; the
  // check is that the directory is not left with binaries and no licence.
  const dir = 'shells/web/public/fonts';
  for (const family of Object.keys(PLATFORM_FACES)) {
    const candidates = [`OFL-${family.toUpperCase()}.txt`, `OFL-${family[0]!.toUpperCase()}${family.slice(1)}.txt`];
    assert.ok(
      candidates.some((c) => existsSync(repoPath(`${dir}/${c}`))),
      `no OFL text beside the ${family} binaries — tried ${candidates.join(', ')} in ${dir}/`,
    );
  }
});

// ── 2. Both slants, and the files behind them ────────────────────────────────

test('every PLATFORM_FACES entry points at a file that is actually on disk', () => {
  for (const [family, faces] of Object.entries(PLATFORM_FACES)) {
    for (const face of faces) {
      assert.ok(face.staticUrl.startsWith('/fonts/'),
        `${family}: a platform face must be shell-served from /fonts/ (profile-independent), got ${face.staticUrl}`);
      assert.ok(existsSync(shellFontPath(face.staticUrl)),
        `${family}: ${face.staticUrl} is registered but missing from shells/web/public/fonts/ — resolveVectorFont would fall through and the run would keep its <text> element`);
    }
  }
});

test('the DEFAULT family registers a real italic, not just an upright', () => {
  // The regression this exists to catch: Outfit is upright-only, so before
  // 2026-08-10 an italic run had no face to shape with and silently stayed <text>.
  // buildRegistry also skips @font-face discovery for any family already backed by
  // bytes here, so a half-registered family SHADOWS the italic woff2 fonts.css
  // declares - dropping the entry below is strictly worse than having none.
  const faces = PLATFORM_FACES[DEFAULT_FAMILY];
  assert.ok(faces, `PLATFORM_FACES has no "${DEFAULT_FAMILY}" entry — tokens.css sets it as --font-brand`);
  const styles = faces.map((f) => f.style).sort();
  assert.deepEqual(styles, ['italic', 'normal'],
    `the default family must register both slants (see the "Add slants in pairs or not at all" note in font-registry.ts), got ${JSON.stringify(styles)}`);
});

test('the default face is the one the stylesheets actually ask for', () => {
  // Keeps the registry and the CSS from drifting apart: the registry can only
  // outline a family the page is really rendering in.
  const tokens = readFileSync(repoPath('shells/web/src/styles/tokens.css'), 'utf8');
  const brandVar = /--font-brand:\s*'([^']+)'/.exec(tokens);
  assert.ok(brandVar, 'tokens.css declares no --font-brand');
  assert.equal(brandVar[1]!.toLowerCase(), DEFAULT_FAMILY,
    `tokens.css --font-brand is '${brandVar[1]}' but PLATFORM_FACES is keyed on '${DEFAULT_FAMILY}'`);

  // The shell copy must be listed BEFORE the brand catalog in every SUSE @font-face:
  // /catalog/fonts/ does not exist on a pack that ships no fonts, and a dev/dist
  // server answers the miss with an HTML SPA fallback rather than a 404.
  const fonts = readFileSync(repoPath('shells/web/src/styles/fonts.css'), 'utf8');
  for (const block of fonts.split('@font-face').slice(1)) {
    if (!/font-family:\s*'SUSE'/.test(block)) continue;
    const shell = block.indexOf('/fonts/SUSE');
    const catalog = block.indexOf('/catalog/fonts/');
    assert.notEqual(shell, -1, `a SUSE @font-face has no shell-served src:\n${block.slice(0, 300)}`);
    if (catalog !== -1) {
      assert.ok(shell < catalog,
        `a SUSE @font-face lists the brand catalog before the shell copy — it would 404/SPA-fallback on a pack with no fonts:\n${block.slice(0, 300)}`);
    }
  }
});

// ── 3. The bytes really do outline ───────────────────────────────────────────

// Transport-only stub, mirroring text-outline-golden.test.ts: serves toPath's
// internal fetch(fontUrl) from disk. HarfBuzz, the font parsing and the path math
// are all real.
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: RequestInfo | URL) => {
  const bytes = readFileSync(shellFontPath(String(url)));
  return {
    ok: true,
    status: 200,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  } as unknown as Response;
}) as typeof fetch;
after(() => { globalThis.fetch = realFetch; });

const api = createTextAPI();

// Mixed-case with ascenders, descenders and a ligature pair - enough that a
// wrong/truncated file shows up as .notdef rather than shaping by luck.
const SAMPLE = 'Handgloves fi 0123';

test('every platform face shapes real outlines with no .notdef', async () => {
  for (const [family, faces] of Object.entries(PLATFORM_FACES)) {
    for (const face of faces) {
      const out = await api.toPath({ text: SAMPLE, fontUrl: face.staticUrl, fontSize: 48 });
      assert.equal(out.notdef, 0,
        `${family} ${face.style} (${face.staticUrl}) left ${out.notdef} .notdef glyph(s) on basic latin — the caller would keep <text>`);
      assert.ok(out.d.length > 0, `${family} ${face.style} produced an empty path for ${JSON.stringify(SAMPLE)}`);
      assert.ok(out.advanceWidth > 0, `${family} ${face.style} produced a zero advance width`);
    }
  }
});

test('the default italic outlines, and is genuinely a different face from the upright', async () => {
  // The whole point of the 2026-08-10 swap. If these two ever come back equal, the
  // italic entry is pointing at the upright file and italic text would export
  // silently UN-SLANTED - worse than the <text> fallback, because it looks fine.
  const faces = PLATFORM_FACES[DEFAULT_FAMILY]!;
  const upright = faces.find((f) => f.style === 'normal')!;
  const italic = faces.find((f) => f.style === 'italic')!;

  const [u, i] = await Promise.all([
    api.toPath({ text: SAMPLE, fontUrl: upright.staticUrl, fontSize: 48 }),
    api.toPath({ text: SAMPLE, fontUrl: italic.staticUrl, fontSize: 48 }),
  ]);
  assert.equal(i.notdef, 0, 'the default italic face left .notdef glyphs on basic latin');
  assert.notEqual(i.d, u.d, 'the italic and upright platform faces produced identical outlines — the italic entry is pointing at the upright file');
});
