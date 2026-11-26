// SPDX-License-Identifier: MPL-2.0
/**
 * Plan 352 R6: the colour roles the shipped design systems declare.
 *
 * Lolly Demo declares its own words with each role's id equal to the slot it fills, so a
 * role is that slot and no slot becomes an alias. The declaration added the record, a
 * derived on-colour for each role with its links, and for a slot that did not vary by
 * colourway a copy of each look's colour in every colourway. No colour a tool reads moved.
 *
 * Lolly Start declares none. Every new design system starts from it, and the studio
 * shows the default words (Primary, Secondary, Surface, Text) for a system that declares
 * none without writing anything.
 *
 * `fixtures/colour-roles/lolly-demo-no-roles.json` is Lolly Demo as it was on 2026-11-06,
 * before it declared roles. The proofs run on that frozen copy, so a later change to
 * Lolly Demo's colours leaves them standing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  BINDABLE_COLOUR_SLOTS, danglingColourAliases, readColourRoles, setColourRoles, type ColourRoleSpec,
} from '../engine/src/colour-roles.ts';
import { colourRoleThemeAccents } from '../engine/src/colour-role-portable.ts';
import { themeSlotsFromColors } from '../engine/src/rebrand-design-system.ts';
import { TOKEN_EXT } from '../engine/src/token-ext.ts';
import { axisOfKind, modeAxis, readTokenAxes } from '../engine/src/token-axes.ts';
import { createTokenSet } from '../engine/src/tokens.ts';

type Rec = Record<string, unknown>;
const ROOT = new URL('..', import.meta.url);
const path = (rel: string): string => new URL(rel, ROOT).pathname;
const load = (rel: string): Rec => JSON.parse(readFileSync(path(rel), 'utf8')) as Rec;

const DEMO = 'brands/lolly-demo/catalog/assets/lolly/tokens/demo.json';
const OPAL = 'brands/lolly-demo/catalog/assets/lolly/tokens/opal.json';
const START = 'brands/lolly-start/catalog/assets/lolly/tokens/brand.json';
const FROZEN = 'tests/fixtures/colour-roles/lolly-demo-no-roles.json';

/** Lolly Demo's words, in its order, with the slot each one is. Approved by Andy on 2026-11-06. */
const DEMO_WORDS: Array<[label: string, slot: string]> = [
  ['Lead', 'primary'], ['Partner', 'secondary'], ['Paper', 'surface'], ['Ink', 'text'],
];

/** Every look and colourway pairing a document offers. */
function selections(doc: Rec): Array<Record<string, string>> {
  const axes = readTokenAxes(doc).axes;
  const mode = modeAxis(axes);
  const colourways = axisOfKind(axes, 'colourway');
  const out: Array<Record<string, string>> = [];
  for (const look of mode?.options ?? [{ id: '' }]) for (const option of colourways?.options ?? [{ id: '' }]) {
    out.push({ ...(look.id && mode ? { [mode.group]: look.id } : {}), ...(option.id && colourways ? { [colourways.group]: option.id } : {}) });
  }
  return out;
}

/** The shipped words as `setColourRoles` specs, read from the shipped file. */
function shippedSpecs(): ColourRoleSpec[] {
  return readColourRoles(load(DEMO)).roles.filter(role => role.declared)
    .map(role => ({ id: role.id, label: role.label, ...(role.description ? { description: role.description } : {}) }));
}

test('Lolly Demo declares its own words, in its order, each one the slot it fills', () => {
  const reading = readColourRoles(load(DEMO));
  assert.equal(reading.state, 'declared');
  assert.equal(reading.record, 'readable');
  assert.deepEqual(reading.issues, []);
  const declared = reading.roles.filter(role => role.declared);
  assert.deepEqual(declared.map(role => [role.label, role.id]), DEMO_WORDS);
  for (const role of declared) {
    assert.ok((BINDABLE_COLOUR_SLOTS as readonly string[]).includes(role.id), `${role.label} is a slot, so no slot becomes an alias`);
    assert.deepEqual(role.slots, [role.id]);
    assert.ok(role.description, `${role.label} says what it is for`);
  }
  for (const slot of reading.slots) assert.equal(slot.written, true, `${slot.slot} draws what the record says`);
  assert.deepEqual(danglingColourAliases(load(DEMO)), []);
});

test('the former id lolly/tokens/opal reads the same document as lolly/tokens/demo', () => {
  assert.equal(readFileSync(path(OPAL), 'utf8'), readFileSync(path(DEMO), 'utf8'));
});

test('Lolly Start declares no colour roles, so a system made from it starts with none', () => {
  const doc = load(START);
  assert.equal(readColourRoles(doc).state, 'default');
  assert.equal('$extensions' in doc, false, 'the starter carries no brand record at all');
});

test('the frozen copy is Lolly Demo before its words, so the proofs below are about that change', () => {
  const frozen = load(FROZEN);
  assert.equal(readColourRoles(frozen).state, 'default');
  const vendor = (frozen.$extensions as Rec)[TOKEN_EXT] as Rec;
  assert.deepEqual((vendor.brandSystem as Rec).roles, []);
});

test('declaring Lolly Demo\'s words moves no colour a tool reads, in any look or colourway', () => {
  const frozen = load(FROZEN);
  const edit = setColourRoles(frozen, shippedSpecs());
  assert.ok(edit.ok && edit.changed);
  assert.deepEqual(readColourRoles(edit.doc).issues, []);
  for (const selection of selections(frozen)) {
    const was = createTokenSet(frozen, { selection });
    const now = createTokenSet(edit.doc, { selection });
    for (const entry of was.query()) assert.deepEqual(now.resolve(entry.path), was.resolve(entry.path), `${entry.path} in ${JSON.stringify(selection)}`);
    const added = now.colors().filter(swatch => !was.colors().some(old => old.path === swatch.path)).map(swatch => swatch.path);
    for (const added1 of added) assert.match(added1, /^color\.(semantic\.on-|colourway\.)/, `${added1} is a derived on-colour or a colourway copy`);
    assert.deepEqual(now.colors().filter(swatch => !added.includes(swatch.path)), was.colors());
  }
});

test('a PowerPoint theme takes the same colours: the words fill no accent the theme did not already have', () => {
  const frozen = load(FROZEN);
  const edit = setColourRoles(frozen, shippedSpecs());
  assert.ok(edit.ok);
  const accents = colourRoleThemeAccents(edit.doc);
  assert.ok(accents.length > 0, 'a system with colour roles states its accents');
  for (const selection of selections(frozen)) {
    const colours: Record<string, string> = Object.fromEntries(createTokenSet(edit.doc, { selection }).colors().map(swatch => [swatch.path, String(swatch.value)]));
    assert.deepEqual(themeSlotsFromColors(colours, accents), themeSlotsFromColors(colours), JSON.stringify(selection));
  }
});

test('a real render is byte-identical before and after the words, in every look and colourway tried', { timeout: 300_000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-shipped-roles-'));
  try {
    const frozen = load(FROZEN);
    const edit = setColourRoles(frozen, shippedSpecs());
    assert.ok(edit.ok);
    const before = join(dir, 'before.json');
    const after = join(dir, 'after.json');
    writeFileSync(before, JSON.stringify(frozen));
    writeFileSync(after, JSON.stringify(edit.doc));
    // Every slot, by reference and by variable, and the on-colour of the lead.
    const slots = ['primary', 'on-primary', 'secondary', 'surface', 'text', 'muted', 'edge'];
    const boxes = JSON.stringify([
      { id: 'f', kind: 'frame', x: 0, y: 0, w: 700, h: 200, shape: 'rect', bg: '{color.semantic.surface}', clipChildren: true },
      ...slots.map((slot, i) => ({ id: `r${i}`, kind: 'box', frame: 'f', x: i * 100, y: 0, w: 100, h: 100, shape: 'rect', bg: `{color.semantic.${slot}}` })),
      ...slots.map((slot, i) => ({ id: `v${i}`, kind: 'box', frame: 'f', x: i * 100, y: 100, w: 100, h: 100, shape: 'rect', bg: `var(--brand-${slot}, #abcdef)` })),
    ]);
    const render = (file: string, themes: string): Buffer => {
      const run = spawnSync(process.execPath, [
        'shells/cli/bin/lolly.ts', 'design', `--boxes=${boxes}`, `--file=${file}`, '--export=svg', '--s=1', '--c2pa=off', `--_themes=${themes}`,
      ], { cwd: ROOT, timeout: 120_000, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, LOLLY_PROFILE: 'lolly-start' } });
      assert.equal(run.status, 0, String(run.stderr));
      return run.stdout;
    };
    for (const themes of ['{"colourway":"spearmint","":"light"}', '{"colourway":"morning","":"dark"}', '{"colourway":"beach","":"light"}', '{"colourway":"midnight","":"dark"}']) {
      const was = render(before, themes);
      assert.ok(was.length > 0);
      assert.ok(render(after, themes).equals(was), `the same bytes in ${themes}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('every mounted shipped design system that declares colour roles reads cleanly', () => {
  const packs = ['brands/lolly-demo', 'brands/lolly-start', 'brands/suse'].filter(dir => existsSync(path(`${dir}/catalog/assets/index.json`)));
  let declaring = 0;
  for (const dir of packs) {
    const index = load(`${dir}/catalog/assets/index.json`) as { assets: Array<{ type?: string; deprecated?: boolean; formats?: Array<{ url?: string }> }> };
    for (const asset of index.assets.filter(a => a.type === 'tokens' && !a.deprecated)) {
      const url = asset.formats?.[0]?.url ?? '';
      const doc = load(`${dir}/catalog/${url.replace(/^\/catalog\//, '')}`);
      const reading = readColourRoles(doc);
      if (reading.state !== 'declared') continue;
      declaring += 1;
      assert.deepEqual(reading.issues, [], `${url} reads with no issues`);
      assert.deepEqual(danglingColourAliases(doc), [], `${url} leaves nothing pointing at nothing`);
      for (const slot of reading.slots) assert.equal(slot.written, true, `${url}: ${slot.slot} draws what the record says`);
    }
  }
  assert.ok(declaring >= 1, 'Lolly Demo at least');
});
