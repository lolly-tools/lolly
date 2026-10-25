// SPDX-License-Identifier: MPL-2.0
/**
 * The web shell's brand skill model (plan 323): which skills belong to the active
 * design system, the links Share hands an agent, the brief rows, the coverage groups,
 * the one-file copy and the details sheet's rows. Read against the real lolly-demo
 * catalog entries so the bridge-to-index mapping is checked on shipped data.
 *
 * Run: node --import ./tests/css-stub.mjs --test shells/web/src/lib/design-system/brand-skills.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import {
  activeSkillsOf, agentBrandSkillLinks, briefSkillAssets, groupCoverage, readBrandSkillFiles, skillAsOneFile,
  skillBelongsTo, skillDetailRows, skillIndexEntryOfRef, skillSteward,
} from './brand-skills.ts';
import type { ActiveRecord } from './active.ts';

const ROOT = new URL('../../../../../', import.meta.url);
const index = JSON.parse(readFileSync(new URL('brands/lolly-demo/catalog/assets/index.json', ROOT), 'utf8')) as { assets?: unknown[] } | unknown[];
type Entry = { id: string; type: string; name: string; version: string; license?: string; meta?: Record<string, unknown>; formats: Array<{ format: string; url: string; size?: number; checksum?: string }> };
const entries = ((Array.isArray(index) ? index : index.assets) as Entry[]).filter(a => a.type === 'skill');

/** A catalog entry as the web asset bridge hands it out (bridge/assets.ts catalogMetadataRef). */
function refOf(entry: Entry, over: Partial<AssetRef> = {}): AssetRef {
  const primary = entry.formats[0]!;
  return {
    source: 'library', id: entry.id, type: entry.type, format: primary.format, url: primary.url, version: entry.version,
    meta: { ...entry.meta, name: entry.name, ...(entry.license ? { license: entry.license } : {}), size: primary.size, originalChecksum: primary.checksum },
    ...over,
  } as AssetRef;
}

const refs = entries.map(e => refOf(e));
const record = (source: ActiveRecord['source'], id = 'shipped'): ActiveRecord => ({ id, label: 'Lolly Demo', headId: 'lolly/tokens/demo', locked: false, source });

test('the lolly-demo catalog ships three skills, and each maps to the same index row the engine builds', () => {
  assert.deepEqual(entries.map(e => e.id).sort(), ['lolly/skill/brand', 'lolly/skill/motion', 'lolly/skill/photography']);
  const brand = skillIndexEntryOfRef(refs.find(r => r.id === 'lolly/skill/brand')!)!;
  assert.equal(brand.name, 'lolly-demo-brand');
  assert.equal(brand.label, 'Lolly Demo brand standards');
  assert.equal(brand.discipline, 'brand');
  assert.equal(brand.audience, 'public');
  assert.equal(brand.skillRevision, '1.0');
  assert.equal(brand.version, '1.0.0');
  assert.ok(brand.size && brand.size > 0, 'the size comes from the format entry');
  assert.match(brand.checksum ?? '', /^sha256-/);
  assert.equal(skillIndexEntryOfRef({ ...refs[0]!, type: 'text' } as AssetRef), null, 'a text asset is not a skill');
  assert.equal(skillIndexEntryOfRef({ ...refs[0]!, meta: { name: 'x' } } as AssetRef), null, 'a skill with no usable record is left out');
});

test('a catalog skill belongs to the catalog system and the systems that stand on it, never to an unrelated local one', () => {
  const catalog = { id: 'lolly/skill/brand', source: 'library' as const };
  assert.equal(skillBelongsTo(catalog, null), true, 'no registry: the catalog is the only system');
  assert.equal(skillBelongsTo(catalog, record({ kind: 'shipped' })), true);
  assert.equal(skillBelongsTo(catalog, record({ kind: 'local', from: 'shipped' }, 'default')), true, 'the person\'s edit of the shipped system');
  assert.equal(skillBelongsTo(catalog, record({ kind: 'hosted', instance: 'https://brand.example', packUrl: null, signature: 'verified' }, 'acme')), true);
  assert.equal(skillBelongsTo(catalog, record({ kind: 'file', signature: 'unsigned', instance: 'https://brand.example' }, 'acme')), true);
  assert.equal(skillBelongsTo(catalog, record({ kind: 'file', signature: 'unsigned' }, 'acme')), false, 'a pack with no instance has no catalog of its own here');
  assert.equal(skillBelongsTo(catalog, record({ kind: 'local' }, 'acme')), false);
  assert.equal(skillBelongsTo(catalog, record({ kind: 'local', from: 'app', companion: { tokens: 'lolly/tokens/start', label: 'Starter' } }, 'starter')), false);
  // A skill stored on this device belongs to the system whose namespace holds the skill.
  assert.equal(skillBelongsTo({ id: 'user/ds/acme/skill/voice', source: 'user' }, record({ kind: 'local' }, 'acme')), true);
  assert.equal(skillBelongsTo({ id: 'user/ds/other/skill/voice', source: 'user' }, record({ kind: 'local' }, 'acme')), false);
  assert.equal(skillBelongsTo({ id: 'user/ds/acme/skill/voice', source: 'user' }, null), false);
});

test('the active list puts the overall brand skill first and keeps only usable, owned skills', () => {
  const list = activeSkillsOf([...refs].reverse(), record({ kind: 'shipped' }));
  assert.deepEqual(list.map(s => s.ref.id), ['lolly/skill/brand', 'lolly/skill/motion', 'lolly/skill/photography']);
  assert.equal(list[0]!.license, 'CC0-1.0');
  assert.equal(list[0]!.url, '/catalog/assets/lolly/skills/brand/SKILL.md');
  assert.deepEqual(activeSkillsOf(refs, record({ kind: 'local' }, 'acme')), [], 'an unrelated system lists none of them');
  const rows = briefSkillAssets(list);
  assert.equal(rows.length, 3);
  assert.equal(rows[0]!.type, 'skill');
  assert.equal(rows[0]!.skill?.name, 'lolly-demo-brand', 'each brief row carries its index row');
});

test('Share lists the brand skill always and the rest by appliesTo, public catalog skills only, as instance URLs', () => {
  const list = activeSkillsOf(refs, null);
  const href = 'https://lolly.example/#/t/darkroom';
  const darkroom = agentBrandSkillLinks(list, { tool: 'darkroom' }, href);
  assert.deepEqual(darkroom.map(s => s.name), ['lolly-demo-brand', 'lolly-demo-photography']);
  assert.equal(darkroom[0]!.url, 'https://lolly.example/catalog/assets/lolly/skills/brand/SKILL.md');
  assert.equal(darkroom[0]!.revision, '1.0');
  assert.deepEqual(agentBrandSkillLinks(list, { tool: 'qr-code' }, href).map(s => s.name), ['lolly-demo-brand'], 'a QR code gets the overall skill only');
  assert.deepEqual(agentBrandSkillLinks(list, { tool: 'design' }, href).map(s => s.name), ['lolly-demo-brand', 'lolly-demo-motion']);
  // An internal skill never appears, and neither does one held on this device.
  const internal = list.map(s => s.ref.id === 'lolly/skill/brand' ? { ...s, entry: { ...s.entry, audience: 'internal' as const } } : s);
  assert.deepEqual(agentBrandSkillLinks(internal, { tool: 'darkroom' }, href).map(s => s.name), ['lolly-demo-photography']);
  const local = list.map(s => s.ref.id === 'lolly/skill/brand' ? { ...s, ref: { ...s.ref, id: 'user/ds/acme/skill/brand', source: 'user' as const }, url: 'blob:x' } : s);
  assert.deepEqual(agentBrandSkillLinks(local, { tool: 'qr-code' }, href), []);
});

test('reading a catalog skill goes through the asset bridge, references by their url', async () => {
  const list = activeSkillsOf(refs, null);
  const skill = { ...list[0]!, meta: { ...list[0]!.meta, files: [{ path: 'references/palette.md', url: '/catalog/assets/lolly/skills/brand/references/palette.md', checksum: 'sha256-x', size: 5 }] } };
  const got: string[] = [];
  const host = {
    assets: {
      query: async () => refs,
      get: async (id: string) => { got.push(id); return { ...refs[0]!, url: 'blob:cached' } as AssetRef; },
      bytes: async (target: AssetRef | string) => new TextEncoder().encode(`bytes of ${typeof target === 'string' ? target : target.url}`),
    },
  };
  const fetched: string[] = [];
  const files = await readBrandSkillFiles(host, skill, (async (url: string) => { fetched.push(url); return new Response('# Palette'); }) as unknown as typeof fetch);
  assert.deepEqual(got, ['lolly/skill/brand']);
  assert.equal(new TextDecoder().decode(files['SKILL.md']), 'bytes of blob:cached', 'the cached core-tier bytes, not a fresh fetch');
  assert.deepEqual(fetched, ['/catalog/assets/lolly/skills/brand/references/palette.md']);
  assert.equal(new TextDecoder().decode(files['references/palette.md']), '# Palette');
});

test('before the core prefetch finishes, SKILL.md comes from its catalog path; a missing file is refused', async () => {
  const skill = activeSkillsOf(refs, null)[0]!;
  const uncached = { assets: { query: async () => refs, get: async (id: string): Promise<AssetRef> => { throw new Error(`Asset not cached: ${id} (tier: core)`); } } };
  const fetched: string[] = [];
  const files = await readBrandSkillFiles(uncached, skill, (async (url: string) => { fetched.push(url); return new Response('# From the catalog'); }) as unknown as typeof fetch);
  assert.deepEqual(fetched, ['/catalog/assets/lolly/skills/brand/SKILL.md']);
  assert.equal(new TextDecoder().decode(files['SKILL.md']), '# From the catalog');
  await assert.rejects(readBrandSkillFiles(uncached, skill, (async () => new Response('nope', { status: 404 })) as unknown as typeof fetch), /could not be read/);
});

test('coverage groups follow the room: checks, conflicts, agreements, guidance', () => {
  const row = (status: string) => ({ status, kind: 'rule', section: '', line: 1, text: status, detail: '' }) as never;
  const grouped = groupCoverage({ rows: [row('checked'), row('conflict'), row('not-in-tokens'), row('agree'), row('guidance-only')] });
  assert.equal(grouped.checked.length, 1);
  assert.equal(grouped.conflicts.length, 2, 'a value missing from the tokens is a conflict to resolve');
  assert.equal(grouped.agree.length, 1);
  assert.equal(grouped.guidance.length, 1);
});

test('coverage rows quoting the same line merge, and a quoted line loses its Markdown marks', async () => {
  const { coverageLineText, mergeCoverageRows } = await import('./brand-skills.ts');
  const font = (detail: string) => ({ status: 'agree', kind: 'font', section: 'Type', line: 25, text: '- **Outfit** sets headings. SUSE sets body text.', detail }) as never;
  const merged = mergeCoverageRows([font('Outfit is a declared font family.'), font('SUSE is a declared font family.'), font('SUSE is a declared font family.')]);
  assert.equal(merged.length, 1);
  assert.equal((merged[0] as { detail: string }).detail, 'Outfit is a declared font family. SUSE is a declared font family.');
  assert.equal(coverageLineText('- **Outfit** sets `headings`.'), 'Outfit sets headings.');
  assert.equal(coverageLineText('12. Keep it short'), 'Keep it short');
  assert.equal(coverageLineText('| Element | Font style and weight | Leading |'), 'Element · Font style and weight · Leading');
  assert.equal(groupCoverage({ rows: [font('a'), font('b')] }).agree.length, 1);
});

test('one file is SKILL.md with each reference under a heading of its path', () => {
  const text = skillAsOneFile({ 'SKILL.md': '---\nname: a\n---\n# A\n', 'references/b.md': '# B\n', 'lolly.json': '{}', 'references/a.csv': new TextEncoder().encode('x,y') });
  assert.equal(text, '---\nname: a\n---\n# A\n\n## references/a.csv\n\nx,y\n\n## references/b.md\n\n# B\n');
  assert.ok(!text.includes('lolly.json'), 'the companion is for tools, not for the chat window');
});

test('the details sheet rows escape catalog text and link to the room', () => {
  const brand = refs.find(r => r.id === 'lolly/skill/brand')!;
  const html = skillDetailRows(brand);
  assert.match(html, /Discipline<\/dt><dd>Brand/);
  assert.match(html, /Status<\/dt><dd>Draft/);
  assert.match(html, /Revision<\/dt><dd>1\.0/);
  assert.match(html, /Maintained by Lolly/);
  assert.match(html, /href="#\/start\?area=skills&amp;skill=lolly%2Fskill%2Fbrand"/);
  const hostile = { ...brand, meta: { ...brand.meta, skill: { ...(brand.meta!.skill as object), owner: '<img src=x onerror=alert(1)>', maintainer: undefined } } } as AssetRef;
  assert.ok(!skillDetailRows(hostile).includes('<img'), 'an owner name is text, never markup');
  assert.equal(skillDetailRows({ ...brand, type: 'text' } as AssetRef), '');
  assert.equal(skillSteward({ generated: true }), 'Generated by Lolly');
  assert.equal(skillSteward({ owner: 'SUSE Brand team' }), 'Owned by SUSE Brand team');
});
