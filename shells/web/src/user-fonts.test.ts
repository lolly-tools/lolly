// SPDX-License-Identifier: MPL-2.0
/**
 * User-fonts tests: the font.brand token merge (both doc shapes), family
 * grouping/primary detection, and the remove→promote-next-primary flow.
 * Run directly:  node --test shells/web/src/user-fonts.test.ts
 *
 * DOM-free: registerUserFonts no-ops without FontFace, and the chrome repaint
 * inside setPrimaryFont swallows the missing-document rejection - so the whole
 * flow runs against an in-memory host whose tokens.resolve reads back the
 * user tokens blob the flow itself installs (a real round-trip, not a stub of
 * the answer).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  withBrandFontToken, familyFromTokenValue, listUserFonts, removeUserFont,
  setPrimaryFont, primaryFontFamily, USER_FONT_PREFIX,
  withRadiusToken, setBrandRadius, withSpaceToken, setBrandSpace, installGoogleFont, installFontFromBytes,
} from './user-fonts.ts';
import type { UserFontsHost } from './user-fonts.ts';
import { BrandLockedError } from './bridge/tokens.ts';

// ── withBrandFontToken ────────────────────────────────────────────────────────

test('plain DTCG doc: sets font.brand, preserves siblings, clears cleanly', () => {
  const doc = { color: { x: { $type: 'color', $value: '#123456' } }, font: { $type: 'fontFamily', mono: { $value: 'SUSE Mono' } } };
  const set = withBrandFontToken(doc, 'Inter');
  assert.deepEqual((set.font as any).brand, { $type: 'fontFamily', $value: ['Inter'] });
  assert.equal((set.font as any).mono.$value, 'SUSE Mono');      // sibling kept
  assert.ok((doc.font as any).brand === undefined);              // source untouched
  const cleared = withBrandFontToken(set, null);
  assert.equal((cleared.font as any).brand, undefined);
  assert.equal((cleared.font as any).mono.$value, 'SUSE Mono');  // mono keeps the group alive
});

test('clearing the only font slot removes the group entirely', () => {
  const cleared = withBrandFontToken(withBrandFontToken({}, 'Inter'), null);
  assert.equal(cleared.font, undefined);
});

test('layered doc ($themes): the token lands in the base SET, not top-level', () => {
  const doc = {
    $themes: [{ name: 'light', selectedTokenSets: { base: 'enabled', light: 'enabled' } }],
    base: { color: { ramp: {} } },
    light: {},
  };
  const set = withBrandFontToken(doc, 'Sora');
  assert.deepEqual((set.base as any).font.brand.$value, ['Sora']);
  assert.equal((set as any).font, undefined);
});

test('radius and spacing source writes retain unrelated imported siblings', () => {
  const doc = { shape: { cornerStyle: { $type: 'string', $value: 'soft' } }, space: { content: { $type: 'dimension', $value: '2rem' } } };
  const withRadius = withRadiusToken(doc, '.5rem');
  const withSpace = withSpaceToken(withRadius, '.5rem');
  assert.equal((withSpace.shape as any).cornerStyle.$value, 'soft');
  assert.equal((withSpace.shape as any).radius.$value, '.5rem');
  assert.equal((withSpace.space as any).content.$value, '2rem');
  assert.equal((withSpace.space as any).base.$value, '.5rem');
  const cleared = withSpaceToken(withRadius, null);
  assert.equal((cleared.space as any).content.$value, '2rem');
});

// ── withRadiusToken ──────────────────────────────────────────────────────────

test('plain DTCG doc: sets shape.radius, preserves siblings, clears cleanly', () => {
  const doc = { color: { x: { $type: 'color', $value: '#123456' } } };
  const set = withRadiusToken(doc, '0.5rem');
  assert.deepEqual((set.shape as any).radius, { $type: 'dimension', $value: '0.5rem' });
  assert.equal((set.color as any).x.$value, '#123456'); // sibling kept
  assert.ok((doc as any).shape === undefined);           // source untouched
  const cleared = withRadiusToken(set, null);
  assert.equal((cleared as any).shape, undefined);
});

test('layered doc ($themes): the token lands in the base SET, not top-level', () => {
  const doc = {
    $themes: [{ name: 'light', selectedTokenSets: { base: 'enabled', light: 'enabled' } }],
    base: { color: { ramp: {} } },
    light: {},
  };
  const set = withRadiusToken(doc, '0.75rem');
  assert.equal((set.base as any).shape.radius.$value, '0.75rem');
  assert.equal((set as any).shape, undefined);
});

test('familyFromTokenValue: arrays, strings, quotes, alias residue', () => {
  assert.equal(familyFromTokenValue(['Inter', 'sans-serif']), 'Inter');
  assert.equal(familyFromTokenValue('SUSE'), 'SUSE');
  assert.equal(familyFromTokenValue("'Space Grotesk'"), 'Space Grotesk');
  assert.equal(familyFromTokenValue('{font.brand}'), '');
  assert.equal(familyFromTokenValue(undefined), '');
});

// ── In-memory host: assets store + tokens that read the stored user doc ──────

function memoryHost(): UserFontsHost & { store: Map<string, any> } {
  const store = new Map<string, any>();
  const host: UserFontsHost & { store: Map<string, any> } = {
    store,
    assets: {
      async _uploadUserAsset(record: any) { store.set(record.id, record); },
      async _deleteUserAsset(id: string) { store.delete(id); },
      async _exportUserAssets() { return [...store.values()]; },
      async _getBlob(id: string) { return store.get(id)?.blob ?? null; },
    },
    tokens: {
      // Resolve the source slots from the installed user doc -
      // the live bridge's discovery order, reduced to the slice these flows
      // exercise (both live at the doc's top level or under 'base', per
      // fontTargetOf's layered-vs-plain-DTCG resolution).
      async resolve(ref: string) {
        const blob = store.get('user/tokens/brand')?.blob;
        if (!blob) return undefined;
        const doc = JSON.parse(await blob.text());
        if (ref === '{font.brand}') return doc?.font?.brand?.$value ?? doc?.base?.font?.brand?.$value;
        if (ref === '{shape.radius}') return doc?.shape?.radius?.$value ?? doc?.base?.shape?.radius?.$value;
        if (ref === '{space.base}') return doc?.space?.base?.$value ?? doc?.base?.space?.base?.$value;
        return undefined;
      },
      bust() { /* nothing cached here */ },
    },
  };
  return host;
}

const fontRecord = (family: string, n: number, weight = '100 900') => ({
  id: `${USER_FONT_PREFIX}${family.toLowerCase().replace(/ /g, '-')}/${n}`,
  type: 'font',
  format: 'woff2',
  blob: new Blob([new Uint8Array(64)], { type: 'font/woff2' }),
  meta: { family, weight, style: 'normal', subset: n === 0 ? 'latin' : 'latin-ext' },
});

test('listUserFonts groups faces by family, sums bytes, marks the primary first', async () => {
  const host = memoryHost();
  await host.assets._uploadUserAsset(fontRecord('Inter', 0));
  await host.assets._uploadUserAsset(fontRecord('Inter', 1));
  await host.assets._uploadUserAsset(fontRecord('Space Grotesk', 0, '400'));
  await setPrimaryFont(host, 'Space Grotesk');
  const fams = await listUserFonts(host);
  assert.deepEqual(fams.map(f => f.family), ['Space Grotesk', 'Inter']); // primary sorts first
  assert.equal(fams[0]!.primary, true);
  assert.equal(fams[0]!.weights, '400');
  assert.equal(fams[1]!.primary, false);
  assert.equal(fams[1]!.assetIds.length, 2);
  assert.equal(fams[1]!.bytes, 128);
  assert.equal(fams[1]!.weights, 'variable 100–900');
});

test('setPrimaryFont installs a user tokens doc that resolves back', async () => {
  const host = memoryHost();
  await setPrimaryFont(host, 'Inter');
  assert.equal(await primaryFontFamily(host), 'Inter');
  // The write is the standard user-tokens asset - backups carry it for free.
  assert.ok(host.store.has('user/tokens/brand'));
});

test('setBrandRadius installs a user tokens doc that resolves back, and clears with null', async () => {
  const host = memoryHost();
  await setBrandRadius(host, '0.5rem');
  assert.equal(await host.tokens!.resolve('{shape.radius}'), '0.5rem');
  assert.ok(host.store.has('user/tokens/brand'));
  await setBrandRadius(host, null);
  assert.equal(await host.tokens!.resolve('{shape.radius}'), undefined);
});

test('setBrandRadius rejects a value that could smuggle CSS', async () => {
  const host = memoryHost();
  await assert.rejects(() => setBrandRadius(host, '0.5rem; background:url(//evil)'));
  assert.equal(await host.tokens!.resolve('{shape.radius}'), undefined); // never written
});

test('setBrandRadius preserves an existing font.brand token (independent slots)', async () => {
  const host = memoryHost();
  await setPrimaryFont(host, 'Inter');
  await setBrandRadius(host, '1.25rem');
  assert.equal(await primaryFontFamily(host), 'Inter');
  assert.equal(await host.tokens!.resolve('{shape.radius}'), '1.25rem');
});

test('setBrandSpace installs a source token and clears cleanly', async () => {
  const host = memoryHost();
  await setBrandSpace(host, '0.75rem');
  assert.equal(await host.tokens!.resolve('{space.base}'), '0.75rem');
  await setBrandSpace(host, null);
  assert.equal(await host.tokens!.resolve('{space.base}'), undefined);
});

test('setBrandSpace rejects a value that could smuggle CSS', async () => {
  const host = memoryHost();
  await assert.rejects(() => setBrandSpace(host, '8px; background:url(//evil)'));
  assert.equal(await host.tokens!.resolve('{space.base}'), undefined);
});

test('removing the primary family promotes the next installed one', async () => {
  const host = memoryHost();
  await host.assets._uploadUserAsset(fontRecord('Inter', 0));
  await host.assets._uploadUserAsset(fontRecord('Sora', 0, '400'));
  await setPrimaryFont(host, 'Inter');
  const [inter] = await listUserFonts(host);
  assert.equal(inter!.family, 'Inter');
  await removeUserFont(host, inter!);
  assert.equal(await primaryFontFamily(host), 'Sora');
  assert.equal((await listUserFonts(host)).length, 1);
});

// ── installGoogleFont: the neverPrimary opt-out ──────────────────────────────
// A design-file import installs fonts as a side effect and must never restyle
// the whole app via the font.brand token - even when no primary exists yet.
// The network is stubbed: a canned css2 stylesheet plus fake font bytes.

const FAKE_CSS2 = `/* latin */
@font-face {
  font-family: 'Work Sans';
  font-style: normal;
  font-weight: 100 900;
  src: url(https://fonts.gstatic.com/s/worksans/v19/fake.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}`;

async function withStubbedGoogleFonts<T>(fn: () => Promise<T>): Promise<T> {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: unknown) => {
    const url = String(input);
    if (url.startsWith('https://fonts.googleapis.com/css2')) return new Response(FAKE_CSS2, { status: 200 });
    if (url.includes('fonts.gstatic.com')) return new Response(new Uint8Array([0x77, 0x4f, 0x46, 0x32]), { status: 200 });
    throw new Error('unexpected fetch: ' + url);
  }) as typeof fetch;
  try { return await fn(); } finally { globalThis.fetch = realFetch; }
}

test('installGoogleFont with neverPrimary does NOT claim font.brand when no primary exists', async () => {
  await withStubbedGoogleFonts(async () => {
    const host = memoryHost();
    const fam = await installGoogleFont(host, 'Work Sans', { neverPrimary: true });
    assert.equal(fam.family, 'Work Sans');
    assert.ok(fam.assetIds.length >= 1, 'faces stored as user assets');
    assert.equal(await primaryFontFamily(host), '', 'font.brand stays unset');
    assert.equal(fam.primary, false);
  });
});

test('installGoogleFont without the flag keeps the only-font promotion', async () => {
  await withStubbedGoogleFonts(async () => {
    const host = memoryHost();
    await installGoogleFont(host, 'Work Sans');
    assert.equal(await primaryFontFamily(host), 'Work Sans', 'the first font becomes the primary');
  });
});

test('installGoogleFont with neverPrimary leaves an existing primary untouched', async () => {
  await withStubbedGoogleFonts(async () => {
    const host = memoryHost();
    await setPrimaryFont(host, 'Inter');
    await installGoogleFont(host, 'Work Sans', { neverPrimary: true });
    assert.equal(await primaryFontFamily(host), 'Inter');
  });
});

// ── installFontFromBytes: the second entrance into the role system ───────────
// Bytes the user already has (an upload, a face lifted out of a PDF) must land
// on exactly the rails installGoogleFont uses - same user assets, same only-font
// promotion - so a face's origin stops mattering once it's installed. The fixture
// is the real platform Outfit face, so the whole vetting chain (magic number →
// name table → OS/2) runs against a genuine sfnt rather than a shape we invented.

const OUTFIT_TTF = fileURLToPath(new URL('../public/fonts/Outfit[wght].ttf', import.meta.url));

function outfitBytes(): ArrayBuffer {
  const b = readFileSync(OUTFIT_TTF);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

/** A copy of an sfnt with OS/2 fields rewritten - the cheapest way to get a
 *  second weight of the same family, or a face that states a restriction, out of
 *  one fixture. (The table checksums go stale; nothing in this path reads them.) */
function patchOs2(src: ArrayBuffer, patch: { weight?: number; fsType?: number }): ArrayBuffer {
  const out = src.slice(0);
  const v = new DataView(out);
  const numTables = v.getUint16(4, false);
  for (let i = 0, off = 12; i < numTables && off + 16 <= out.byteLength; i++, off += 16) {
    const tag = String.fromCharCode(v.getUint8(off), v.getUint8(off + 1), v.getUint8(off + 2), v.getUint8(off + 3));
    if (tag !== 'OS/2') continue;
    const at = v.getUint32(off + 8, false);
    if (patch.weight !== undefined) v.setUint16(at + 4, patch.weight, false);  // usWeightClass
    if (patch.fsType !== undefined) v.setUint16(at + 8, patch.fsType, false);
    return out;
  }
  throw new Error('fixture has no OS/2 table - patchOs2 would silently do nothing');
}

/** Rewrite one table's 4-byte tag, which is how a reader that finds a table by
 *  tag stops finding it. Used to turn the variable fixture into a static face. */
function renameTable(src: ArrayBuffer, from: string, to: string): ArrayBuffer {
  const out = src.slice(0);
  const v = new DataView(out);
  const numTables = v.getUint16(4, false);
  for (let i = 0, off = 12; i < numTables && off + 16 <= out.byteLength; i++, off += 16) {
    const tag = String.fromCharCode(v.getUint8(off), v.getUint8(off + 1), v.getUint8(off + 2), v.getUint8(off + 3));
    if (tag !== from) continue;
    for (let c = 0; c < 4; c++) v.setUint8(off + c, to.charCodeAt(c));
    return out;
  }
  throw new Error(`fixture has no ${from} table - renameTable would silently do nothing`);
}

/** The fixture as a STATIC face of one weight: fvar hidden, so the only weight
 *  it states is OS/2's. Two of these are two different faces of one family,
 *  which is the shape the next-index rule is actually about. */
const staticOutfit = (weight: number): ArrayBuffer =>
  patchOs2(renameTable(outfitBytes(), 'fvar', 'zzzz'), { weight });

test('installFontFromBytes stores a real TTF as a user asset and claims the empty primary', async () => {
  const host = memoryHost();
  const fam = await installFontFromBytes(host, outfitBytes(), { filename: 'Outfit[wght].ttf' });

  assert.equal(fam?.family, 'Outfit');
  assert.deepEqual(fam!.assetIds, [`${USER_FONT_PREFIX}outfit/0`]);
  assert.equal(fam!.primary, true);

  const rec = host.store.get(`${USER_FONT_PREFIX}outfit/0`);
  assert.equal(rec.type, 'font');                 // the ordinary user-asset rail
  assert.equal(rec.format, 'ttf');
  assert.equal(rec.meta.family, 'Outfit');
  assert.equal(rec.meta.weight, '100 900');       // the whole fvar axis, not the default instance
  assert.equal(rec.meta.style, 'normal');
  assert.equal(rec.meta.fileName, 'Outfit[wght].ttf');
  assert.equal(rec.meta.source, 'upload');
  assert.equal(await primaryFontFamily(host), 'Outfit');
});

test('installFontFromBytes accepts a Uint8Array view and stores only that slice', async () => {
  const bytes = outfitBytes();
  const padded = new Uint8Array(bytes.byteLength + 16);
  padded.set(new Uint8Array(bytes), 8);           // the face, with junk either side
  const view = padded.subarray(8, 8 + bytes.byteLength);

  const host = memoryHost();
  const fam = await installFontFromBytes(host, view);

  assert.equal(fam?.family, 'Outfit');
  assert.equal(host.store.get(`${USER_FONT_PREFIX}outfit/0`).blob.size, bytes.byteLength);
});

test('re-dropping the same face replaces it in place, never a second index', async () => {
  const host = memoryHost();
  await installFontFromBytes(host, outfitBytes(), { filename: 'first.ttf' });
  const again = await installFontFromBytes(host, outfitBytes(), { filename: 'second.ttf' });

  assert.deepEqual(again!.assetIds, [`${USER_FONT_PREFIX}outfit/0`]);
  assert.equal([...host.store.keys()].filter(k => k.startsWith(`${USER_FONT_PREFIX}outfit/`)).length, 1);
  assert.equal(host.store.get(`${USER_FONT_PREFIX}outfit/0`).meta.fileName, 'second.ttf');
});

test('a second weight of the same family takes the next index and groups as one family', async () => {
  const host = memoryHost();
  await installFontFromBytes(host, staticOutfit(400));
  const fam = await installFontFromBytes(host, staticOutfit(700));

  assert.equal(fam?.family, 'Outfit');
  assert.deepEqual(fam!.assetIds.sort(), [`${USER_FONT_PREFIX}outfit/0`, `${USER_FONT_PREFIX}outfit/1`]);
  assert.equal(fam!.weights, '400 + 700');
  assert.equal((await listUserFonts(host)).length, 1, 'one family, two faces');
});

test('a variable face is stored as its whole axis, not as the one weight OS/2 defaults to', async () => {
  // Outfit[wght].ttf says usWeightClass 100 and carries 100 to 900. Storing it
  // as '100' registers a FontFace at Thin, which is then the primary the whole
  // app wears - with every other weight browser-synthesised from it.
  const host = memoryHost();
  const fam = await installFontFromBytes(host, outfitBytes());

  assert.equal(host.store.get(`${USER_FONT_PREFIX}outfit/0`).meta.weight, '100 900');
  assert.equal(fam!.weights, 'variable 100–900', 'the same blurb the Google path produces');

  // A static build of the same family is a DIFFERENT face, and lands beside it.
  await installFontFromBytes(host, staticOutfit(700));
  assert.equal([...host.store.keys()].filter(k => k.startsWith(`${USER_FONT_PREFIX}outfit/`)).length, 2);
});

test('an upload never overwrites a face the Google path downloaded', async () => {
  const host = memoryHost();
  // What installGoogleFont writes: one asset per SUBSET, each with the
  // unicodeRange css2 gave it - metadata an upload has no way to reproduce.
  await host.assets._uploadUserAsset({
    id: `${USER_FONT_PREFIX}outfit/0`,
    type: 'font',
    format: 'woff2',
    blob: new Blob([new Uint8Array(1024)], { type: 'font/woff2' }),
    meta: {
      name: 'Outfit (latin)', family: 'Outfit', style: 'normal', weight: '100 900',
      subset: 'latin', unicodeRange: 'U+0000-00FF', source: 'google-fonts', tags: ['font'],
    },
  });

  const fam = await installFontFromBytes(host, outfitBytes(), { filename: 'Outfit.ttf' });

  const downloaded = host.store.get(`${USER_FONT_PREFIX}outfit/0`);
  assert.equal(downloaded.meta.source, 'google-fonts', 'the downloaded face is still the downloaded face');
  assert.equal(downloaded.meta.unicodeRange, 'U+0000-00FF');
  assert.equal(downloaded.blob.size, 1024, 'its bytes were not replaced');
  assert.ok(host.store.has(`${USER_FONT_PREFIX}outfit/1`), 'the upload took the next index');
  assert.equal(fam!.assetIds.length, 2, 'both faces stand, and both belong to the family');
});

test('a restricted fsType still installs, marked device-local with its statement recorded', async () => {
  const host = memoryHost();
  const fam = await installFontFromBytes(host, patchOs2(outfitBytes(), { fsType: 0x0102 }));

  assert.equal(fam?.family, 'Outfit');
  const meta = host.store.get(`${USER_FONT_PREFIX}outfit/0`).meta;
  assert.equal(meta.embedding, 'restricted');
  assert.equal(meta.deviceLocal, true);
  assert.equal(meta.noSubsetting, true);          // bit 8 rides alongside
  assert.equal(meta.fsType, 0x0102);              // raw, so a report can audit it
});

test('an unrestricted face records its statement too, and is NOT device-local', async () => {
  const host = memoryHost();
  await installFontFromBytes(host, outfitBytes());
  const meta = host.store.get(`${USER_FONT_PREFIX}outfit/0`).meta;
  assert.equal(meta.embedding, 'installable');    // Outfit is OFL
  assert.equal(meta.deviceLocal, undefined);
});

test('a WOFF1 upload is unwrapped and STORED as an sfnt, not as wOFF', async () => {
  // woff1 is not an sfnt: parseFontMetadata cannot read its table directory and
  // bridge/font-registry.ts decompresses only woff2, so a stored wOFF would
  // install and then silently .notdef on vector export.
  const { sfntToWoff } = await import('@lolly/engine');
  const woff = sfntToWoff(new Uint8Array(outfitBytes()));
  assert.equal(String.fromCharCode(...woff.subarray(0, 4)), 'wOFF', 'guard: the fixture really is woff1');

  const host = memoryHost();
  const fam = await installFontFromBytes(host, woff, { filename: 'Outfit.woff' });

  assert.equal(fam?.family, 'Outfit');
  const rec = host.store.get(`${USER_FONT_PREFIX}outfit/0`);
  assert.equal(rec.format, 'ttf');
  const magic = new Uint8Array(await rec.blob.arrayBuffer()).subarray(0, 4);
  assert.deepEqual([...magic], [0x00, 0x01, 0x00, 0x00], 'stored bytes are a TrueType sfnt');
});

test('the size cap is applied to what gets STORED, not only to what arrived', async () => {
  // woff1 is zlib-per-table and is unwrapped on the way in, so the bytes that
  // land on the device are bigger than the bytes that were vetted - here, a
  // compressible table makes a small file expand past the 5MB cap. Without the
  // second check a 5MB cap admits a ~10MB asset, which is not a cap on storage.
  const { sfntToWoff } = await import('@lolly/engine');
  const align4 = (n: number): number => (n + 3) & ~3;
  /** The fixture plus one zero-filled table, which compresses to nothing. */
  const withJunkTable = (src: ArrayBuffer, extra: number): ArrayBuffer => {
    const v = new DataView(src);
    const n = v.getUint16(4, false);
    const dirEnd = 12 + n * 16;
    const shift = 16;                                  // one more directory entry
    const junkAt = align4(src.byteLength + shift);
    const out = new ArrayBuffer(junkAt + extra);
    const ou8 = new Uint8Array(out);
    const su8 = new Uint8Array(src);
    ou8.set(su8.subarray(0, dirEnd), 0);
    ou8.set(su8.subarray(dirEnd), dirEnd + shift);     // the body, one entry along
    const ov = new DataView(out);
    ov.setUint16(4, n + 1, false);
    for (let i = 0, off = 12; i < n; i++, off += 16) {
      ov.setUint32(off + 8, v.getUint32(off + 8, false) + shift, false);
    }
    for (let c = 0; c < 4; c++) ov.setUint8(dirEnd + c, 'JUNK'.charCodeAt(c));
    ov.setUint32(dirEnd + 8, junkAt, false);
    ov.setUint32(dirEnd + 12, extra, false);
    return out;
  };

  const fat = withJunkTable(outfitBytes(), 6 * 1024 * 1024);
  const woff = sfntToWoff(new Uint8Array(fat));
  assert.ok(woff.byteLength < 5 * 1024 * 1024, `guard: the compressed file passes the gate (${woff.byteLength})`);
  assert.ok(fat.byteLength > 5 * 1024 * 1024, 'guard: the unwrapped face does not');

  const host = memoryHost();
  assert.equal(await installFontFromBytes(host, woff, { filename: 'Fat.woff' }), null);
  assert.equal(host.store.size, 0, 'nothing was written on the way to the refusal');
});

test('bad bytes return null and write nothing, never throwing', async () => {
  const host = memoryHost();

  assert.equal(await installFontFromBytes(host, new Uint8Array([1, 2, 3, 4, 5])), null, 'junk');
  assert.equal(await installFontFromBytes(host, new Uint8Array(0)), null, 'empty');
  // Magic number says TrueType, but there is no table directory behind it.
  const truncated = new ArrayBuffer(12);
  new DataView(truncated).setUint32(0, 0x00010000, false);
  assert.equal(await installFontFromBytes(host, truncated), null, 'truncated sfnt');
  // Over validateFontFile's 5MB cap - the cap is refused, not enforced twice.
  assert.equal(await installFontFromBytes(host, new ArrayBuffer(5 * 1024 * 1024 + 1)), null, 'oversized');

  assert.equal(host.store.size, 0);
  assert.equal(await primaryFontFamily(host), '');
});

test('an upload never steals a standing primary, and makePrimary is how you ask', async () => {
  const host = memoryHost();
  await setPrimaryFont(host, 'Inter');

  await installFontFromBytes(host, outfitBytes());
  assert.equal(await primaryFontFamily(host), 'Inter', 'the only-font rule only fires when there is no font');

  const fam = await installFontFromBytes(host, outfitBytes(), { makePrimary: true });
  assert.equal(await primaryFontFamily(host), 'Outfit');
  assert.equal(fam!.primary, true);
});

test('a locked brand: the face installs, the implicit promotion does not', async () => {
  const host = memoryHost();
  host.tokens!.isLocked = async () => true;

  const fam = await installFontFromBytes(host, outfitBytes());
  assert.equal(fam?.family, 'Outfit', 'the bytes still land on-device');
  assert.ok(host.store.has(`${USER_FONT_PREFIX}outfit/0`));
  assert.equal(host.store.has('user/tokens/brand'), false, 'the shipped brand is untouched');
  assert.equal(fam!.primary, false);
});

test('a locked brand refuses an EXPLICIT makePrimary at the one chokepoint', async () => {
  const host = memoryHost();
  host.tokens!.isLocked = async () => true;

  await assert.rejects(() => installFontFromBytes(host, outfitBytes(), { makePrimary: true }), BrandLockedError);
  assert.equal(host.store.has('user/tokens/brand'), false);
});

test('removing the last family clears font.brand (back to platform default)', async () => {
  const host = memoryHost();
  await host.assets._uploadUserAsset(fontRecord('Inter', 0));
  await setPrimaryFont(host, 'Inter');
  const [inter] = await listUserFonts(host);
  await removeUserFont(host, inter!);
  assert.equal(await primaryFontFamily(host), '');
});
