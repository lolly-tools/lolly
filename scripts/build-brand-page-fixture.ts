// SPDX-License-Identifier: MPL-2.0
/**
 * A small brand page from the real generator, for Lolly Work's tests (plan 351).
 *
 * Lolly Work stores and serves a folder Lolly made, and its parser follows the format key
 * by key on purpose, so a new key or path in `brand.json` is refused there. This folder
 * holds one of everything the generator can write, at a few kilobytes: an owner-published
 * logo, an openly licensed logo, a logo held back, a font with its licence text, colour
 * roles, a skill and an example. Work's tests publish the folder and serve the result.
 *
 *   node scripts/build-brand-page-fixture.ts --out=<lolly-work>/tests/fixtures/brand-page-folder
 *
 * `tests/brand-page-work-contract.test.ts` reads the same input, so a change to the
 * format fails in this repository first and lists what to do in Work.
 */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { deriveBrandTokens } from '../engine/src/brand-derive.ts';
import { setColourRoles } from '../engine/src/colour-roles.ts';
import type { BrandPageInputV1 } from '../engine/src/brand-page.ts';
import { buildBrandPage } from '../engine/src/brand-page.ts';

const ENCODER = new TextEncoder();
const SVG = (fill: string): Uint8Array => ENCODER.encode(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="${fill}"/></svg>\n`);
const TERMS = 'Fixture marks belong to the Fixture project. Show them unaltered to refer to the project.';
const OWN_WORK = (id: string): Record<string, unknown> => ({
  works: [{
    id,
    creators: [{ name: 'Fixture project', role: 'owner' }],
    rights: [{ declaration: 'LicenseRef-Fixture-Marks', assertedBy: 'catalog', evidence: 'catalog-entry', status: 'unparsed' }],
    grants: [{ kind: 'own-work', scope: TERMS, asserted: true }],
  }],
});

/** A system with its own colour words: one read as the lead, one by name only with a description. */
function fixtureTokens(): unknown {
  const named = setColourRoles(deriveBrandTokens({ primary: '#0b6e4f' } as never), [
    { label: 'Evergreen', fills: 'primary' },
    { label: 'Signal', description: 'The small flag on a page.', value: '#c9a227' },
  ], { lift: { id: 'house', name: 'House' }, systemLabel: 'Fixture' });
  if (!named.ok) throw new Error(`the fixture's colour roles were refused: ${named.reasons.join(' ')}`);
  return named.doc;
}

/** The input behind the fixture, one of everything the format can hold. */
export function brandPageFixtureInput(): BrandPageInputV1 {
  return {
    tokens: fixtureTokens(),
    name: 'Fixture',
    id: 'fixture',
    publishedVersion: '1.0.0',
    origin: 'https://example.test/brand/fixture',
    usage: { statement: 'Ask before you change a mark.', contact: 'brand@example.test', url: 'https://example.test/brand-terms' },
    catalog: {
      assets: [
        { id: 'fixture/logo/primary', name: 'Fixture mark', type: 'vector', tags: ['logo', 'primary', 'on-light'] },
        { id: 'fixture/logo/reverse', name: 'Fixture mark, reverse', type: 'vector', tags: ['logo', 'reverse', 'on-dark'] },
        { id: 'fixture/logo/mono', name: 'Fixture mark, mono', type: 'vector', tags: ['logo', 'mono', 'on-light'] },
      ],
      logos: { onLight: 'fixture/logo/primary', onDark: 'fixture/logo/reverse' },
    },
    logos: [
      { id: 'fixture/logo/primary', name: 'Fixture mark', format: 'svg', bytes: SVG('#0b6e4f'), license: 'LicenseRef-Fixture-Marks', rights: OWN_WORK('fixture/logo/primary'), tags: ['logo'] },
      { id: 'fixture/logo/reverse', name: 'Fixture mark, reverse', format: 'svg', bytes: SVG('#ffffff'), license: 'LicenseRef-Fixture-Marks', rights: OWN_WORK('fixture/logo/reverse'), tags: ['logo'] },
      { id: 'fixture/logo/mono', name: 'Fixture mark, mono', format: 'svg', bytes: SVG('#000000'), license: 'CC0-1.0', tags: ['logo'] },
      { id: 'partner/logo/primary', name: 'A partner mark', format: 'svg', bytes: SVG('#333333'), tags: ['logo'] },
    ],
    fonts: [
      { family: 'Fixture Sans', format: 'ttf', weight: '100 900', bytes: new Uint8Array([0, 1, 0, 0]), license: 'OFL-1.1', licenceText: ENCODER.encode('The licence text of Fixture Sans.\n') },
      { family: 'Fixture Sans', format: 'woff2', style: 'italic', bytes: new Uint8Array([0x77, 0x4f, 0x46, 0x32]), license: 'OFL-1.1' },
    ],
    skills: [
      { name: 'fixture-brand', label: 'Fixture brand', audience: 'public', description: 'How the brand writes.', discipline: 'brand', files: { 'SKILL.md': '---\nname: fixture-brand\n---\nWrite plainly.\n', 'references/notes.json': '{"a":1}\n' } },
    ],
    examples: [{ id: 'poster', name: 'A poster', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>' }],
  } as unknown as BrandPageInputV1;
}

async function main(): Promise<void> {
  const flag = process.argv.find(arg => arg.startsWith('--out='));
  if (!flag) throw new Error('usage: node scripts/build-brand-page-fixture.ts --out=<dir>');
  const out = resolve(flag.slice('--out='.length));
  // Replaces an earlier fixture, and nothing else that happens to live at this path.
  if (existsSync(out) && readdirSync(out).length && !existsSync(join(out, 'brand.json'))) throw new Error(`${out} holds other files and no brand.json, so it is left alone`);
  const built = await buildBrandPage(brandPageFixtureInput());
  rmSync(out, { recursive: true, force: true });
  for (const file of built.files) {
    mkdirSync(dirname(join(out, file.path)), { recursive: true });
    writeFileSync(join(out, file.path), file.bytes);
  }
  const bytes = built.files.reduce((sum, file) => sum + file.bytes.byteLength, 0);
  console.log(`wrote ${built.files.length} files, ${bytes} bytes, engine ${built.manifest.generator.engine}, digest ${built.manifest.digest.slice(0, 12)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: Error) => { console.error(error.message); process.exit(1); });
}
