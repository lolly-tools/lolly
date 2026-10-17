// SPDX-License-Identifier: MPL-2.0
/**
 * Leads (plans/319 A2): the studio's pure data layer over colourways.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/leads.test.ts"
 *
 * The documents are real: a `deriveBrandTokens` system, lifted and given leads
 * through the same functions the studio calls, so the shapes cannot drift from
 * what the engine writes. Rebuild palette's carry is checked against a second
 * real derive, which is exactly what replace.ts hands to the carry.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { addColourway, createTokenSet, deriveBrandTokens, deriveColourwaySlots, colourwayAxis, readTokenAxes } from '@lolly/engine';
import type { ColourwayValues } from '@lolly/engine';
import {
  addLead, canonicalLead, carryLeads, colourwaySetsOf, duplicateLead, editContextOf, hasLeads, isColourwayKey,
  isColourwayLink, leadModes, leadRolePath, leadSelection, leadSlotPath, leadTokenSet, leadsEditable, liftLeads,
  listLeads, removeLead, renameLead, reorderLeads, resolveLead, setCanonicalLead, uniqueLeadId, uniqueLeadName, withoutLeadColours,
} from './leads.ts';
import type { LeadEdit } from './leads.ts';
import { nameColor } from '../color-namer.ts';

type Rec = Record<string, unknown>;

const single = (): Rec => deriveBrandTokens({ primary: '#0c322c', name: 'Test' }) as Rec;

const ok = (r: LeadEdit | { ok: true; doc: Rec } | { ok: false; reasons: string[] }): Rec => {
  assert.ok(r.ok, r.ok ? '' : r.reasons.join(' '));
  return r.doc;
};

/** Three leads, the studio way: lifted under its own name, two added from colours. */
function threeLeads(): Rec {
  const one = addLead(single(), { colour: '#e05a2b', name: 'Persimmon', canonical: { name: 'Pine' } });
  assert.ok(one.ok, one.ok ? '' : one.reasons.join(' '));
  const two = addLead(one.doc, { colour: '#0e7490', name: 'Waterhole' });
  assert.ok(two.ok, two.ok ? '' : two.reasons.join(' '));
  return two.doc;
}

const resolveIn = (doc: unknown, lead: string | null, mode: string, path: string): unknown =>
  leadTokenSet(doc, { lead, mode }).resolve(path);

// ── The context ─────────────────────────────────────────────────────────────

test('editContextOf: a bare mode, a context, nothing at all', () => {
  assert.deepEqual(editContextOf('dark'), { lead: null, mode: 'dark' });
  assert.deepEqual(editContextOf({ mode: 'dark' }), { lead: null, mode: 'dark' });
  assert.deepEqual(editContextOf({ lead: 'persimmon', mode: 'light' }), { lead: 'persimmon', mode: 'light' });
  assert.deepEqual(editContextOf(undefined), { lead: null, mode: 'light' });
  assert.deepEqual(editContextOf(''), { lead: null, mode: 'light' });
});

test('leadSelection: a single-lead system reads exactly as it did before leads', () => {
  const doc = single();
  assert.deepEqual(leadSelection(doc, 'light'), { theme: 'light' });
  assert.deepEqual(leadSelection(doc, { lead: 'anything', mode: 'dark' }), { theme: 'dark' });
  assert.equal(hasLeads(doc), false);
  assert.equal(resolveLead(doc, 'anything'), null);
  assert.deepEqual(listLeads(doc), []);
  assert.equal(canonicalLead(doc), null);
});

test('leadSelection: the lead is pinned over a stored colourway choice, other stored choices are kept', () => {
  const doc = threeLeads();
  const [, persimmon] = listLeads(doc).map(l => l.id);
  (doc.$metadata as Rec).activeThemeSelection = { colourway: persimmon!, density: 'roomy' };
  const canonical = leadSelection(doc, 'light');
  assert.deepEqual(canonical, { theme: 'light', selection: { colourway: listLeads(doc)[0]!.id, density: 'roomy' } });
  assert.equal(resolveIn(doc, null, 'light', 'color.semantic.primary'), resolveIn(doc, listLeads(doc)[0]!.id, 'light', 'color.semantic.primary'),
    'the studio never shows the colourway a tool route stored');
  assert.deepEqual(leadSelection(doc, { lead: 'ghost', mode: 'dark' }).selection?.colourway, listLeads(doc)[0]!.id, 'an unknown lead is the canonical one');
});

// ── Lift and add ────────────────────────────────────────────────────────────

test('liftLeads names the canonical lead after its colour, and nothing resolves differently', () => {
  const doc = single();
  const lifted = ok(liftLeads(doc));
  const lead = canonicalLead(lifted)!;
  const primary = createTokenSet(doc, { theme: 'light' }).colors().find(s => s.path === 'color.semantic.primary')!.value;
  assert.equal(lead.name, nameColor(primary));
  assert.equal(lead.id, uniqueLeadId(doc, lead.name));
  for (const mode of ['light', 'dark']) {
    for (const e of createTokenSet(doc, { theme: mode }).query()) {
      assert.deepEqual(leadTokenSet(lifted, mode).resolve(e.path), e.value, `${mode} ${e.path}`);
    }
  }
  const named = ok(liftLeads(doc, { name: 'Pine' }));
  assert.deepEqual([canonicalLead(named)!.id, canonicalLead(named)!.name], ['pine', 'Pine']);
  assert.deepEqual(ok(liftLeads(named)), named, 'a lifted system comes back unchanged');
});

test('addLead derives each mode through deriveColourwaySlots at the system\'s own ramp size', () => {
  const doc = threeLeads();
  const leads = listLeads(doc);
  assert.deepEqual(leads.map(l => [l.name, l.canonical]), [['Pine', true], ['Persimmon', false], ['Waterhole', false]]);
  const steps = createTokenSet(doc).query({ type: 'color' }).filter(t => /^color\.ramp\.primary\.\d+$/.test(t.path)).length;
  for (const mode of ['light', 'dark'] as const) {
    const want = deriveColourwaySlots('#e05a2b', { mode, steps });
    for (const role of ['primary', 'on-primary', 'secondary'] as const) {
      assert.equal(resolveIn(doc, 'persimmon', mode, `color.semantic.${role}`), want[role], `${mode} ${role}`);
    }
  }
  // The surface, text and ramps stay the system's own.
  assert.equal(resolveIn(doc, 'persimmon', 'light', 'color.semantic.surface'), resolveIn(doc, 'pine', 'light', 'color.semantic.surface'));
  assert.equal(resolveIn(doc, 'waterhole', 'dark', 'color.semantic.text'), resolveIn(doc, 'pine', 'dark', 'color.semantic.text'));
});

test('addLead picks a name and a unique id when none is given, and refuses a colour it cannot read', () => {
  const doc = threeLeads();
  const added = addLead(doc, { colour: '#e05a2b' });
  assert.ok(added.ok);
  const lead = listLeads(added.doc).at(-1)!;
  assert.equal(lead.name, nameColor('#e05a2b'));
  assert.equal(lead.id, added.id);
  const again = addLead(added.doc, { colour: '#e05a2b' });
  assert.ok(again.ok);
  assert.equal(listLeads(again.doc).at(-1)!.name, `${nameColor('#e05a2b')} 2`, 'a second lead of the same colour is numbered');
  assert.notEqual(again.id, added.id);
  const bad = addLead(doc, { colour: 'not a colour' });
  assert.equal(bad.ok, false);
  assert.equal(addLead(doc, { colour: '#123456', name: 'light' }).ok, false, 'a lead may not take a look\'s name');
});

test('uniqueLeadName and uniqueLeadId avoid every theme id and name', () => {
  const doc = threeLeads();
  assert.equal(uniqueLeadName(doc, 'Persimmon'), 'Persimmon 2');
  assert.equal(uniqueLeadName(doc, 'persimmon'), 'persimmon 2');
  assert.equal(uniqueLeadName(doc, 'Sky'), 'Sky');
  assert.equal(uniqueLeadId(doc, 'Persimmon'), 'persimmon-2');
  assert.equal(uniqueLeadId(doc, 'Light'), 'light-2');
  assert.equal(uniqueLeadId(doc, 'Crème brûlée'), 'creme-brulee');
  assert.equal(uniqueLeadId(doc, '!!!'), 'lead');
});

// ── Where a lead keeps its colours ──────────────────────────────────────────

test('lead × mode to token path, and the link a mode slot holds', () => {
  const doc = threeLeads();
  assert.deepEqual(leadRolePath(doc, 'primary', { lead: 'persimmon', mode: 'dark' }), ['colourway/persimmon', 'color', 'colourway', 'dark', 'primary']);
  assert.deepEqual(leadRolePath(doc, 'secondary', 'light'), ['colourway/pine', 'color', 'colourway', 'light', 'secondary'], 'a bare mode is the canonical lead');
  assert.equal(leadRolePath(doc, 'surface', 'light'), null, 'the surface is the look\'s own until a colourway tints it');
  assert.equal(leadRolePath(single(), 'primary', 'light'), null);

  const slot = (((doc.light as Rec).color as Rec).semantic as Rec).primary as Rec;
  assert.equal(isColourwayLink(slot.$value, 'primary'), true);
  assert.equal(isColourwayLink(slot.$value, 'secondary'), false, 'the link must name the role it fills');
  assert.equal(isColourwayLink('{color.ramp.primary.5}', 'primary'), false);
  assert.deepEqual(leadSlotPath(doc, slot.$value, 'primary', 'waterhole'), ['colourway/waterhole', 'color', 'colourway', 'light', 'primary']);
  assert.deepEqual(leadSlotPath(doc, slot.$value, 'primary', null), ['colourway/pine', 'color', 'colourway', 'light', 'primary']);
  assert.equal(leadSlotPath(doc, '{color.ramp.primary.5}', 'primary'), null);

  assert.deepEqual([...colourwaySetsOf(doc)].sort(), ['colourway/persimmon', 'colourway/pine', 'colourway/waterhole']);
  assert.equal(colourwaySetsOf(single()).size, 0);
  assert.equal(isColourwayKey('color.colourway.light.primary'), true);
  assert.equal(isColourwayKey('color.semantic.primary'), false);
  assert.deepEqual(leadModes(doc).map(m => m.id), ['light', 'dark']);
});

test('withoutLeadColours drops the canonical lead\'s own colours from a resolved list, and nothing else', () => {
  const doc = threeLeads();
  const resolved = createTokenSet(doc, { theme: 'light' }).colors();
  assert.ok(resolved.some(c => c.path.startsWith('color.colourway.')), 'the canonical set is on, so its colours are listed');
  const kept = withoutLeadColours(resolved);
  assert.deepEqual(kept.map(c => c.path), createTokenSet(single(), { theme: 'light' }).colors().map(c => c.path), 'what is left is the single-lead list');
  const plain = createTokenSet(single(), { theme: 'light' }).colors();
  assert.deepEqual(withoutLeadColours(plain), plain);
});

test('listLeads reads each lead\'s colours in each mode, canonical first', () => {
  const doc = threeLeads();
  const [pine, persimmon] = listLeads(doc);
  assert.equal(pine!.canonical, true);
  assert.equal(pine!.set, 'colourway/pine');
  assert.match(persimmon!.colours.light!.primary, /^#[0-9a-f]{6}$/i);
  assert.notEqual(persimmon!.colours.light!.primary, pine!.colours.light!.primary);
  assert.equal(persimmon!.colours.dark!['on-primary'] !== '', true);
  assert.equal('surface' in pine!.colours.light!, false, 'no surface until a colourway tints it');
});

// ── The edits ───────────────────────────────────────────────────────────────

test('duplicate, rename, reorder, set canonical and remove, through the studio\'s names', () => {
  let doc = threeLeads();
  const copy = duplicateLead(doc, 'persimmon');
  assert.ok(copy.ok);
  doc = copy.doc;
  assert.equal(copy.id, 'persimmon-2');
  assert.deepEqual(listLeads(doc).map(l => l.name), ['Pine', 'Persimmon', 'Waterhole', 'Persimmon 2']);
  doc = ok(renameLead(doc, 'persimmon-2', 'Ember'));
  assert.equal(listLeads(doc).at(-1)!.id, 'persimmon-2', 'the id is permanent');
  doc = ok(reorderLeads(doc, ['pine', 'persimmon-2', 'waterhole', 'persimmon']));
  assert.deepEqual(listLeads(doc).map(l => l.id), ['pine', 'persimmon-2', 'waterhole', 'persimmon']);
  doc = ok(setCanonicalLead(doc, 'waterhole'));
  assert.deepEqual(listLeads(doc).map(l => [l.id, l.canonical]), [['waterhole', true], ['pine', false], ['persimmon-2', false], ['persimmon', false]]);
  doc = ok(removeLead(doc, 'pine'));
  assert.deepEqual(listLeads(doc).map(l => l.id), ['waterhole', 'persimmon-2', 'persimmon']);
  assert.equal(removeLead(doc, 'waterhole').ok, false, 'the canonical lead stays until another one is canonical');
  assert.equal(duplicateLead(doc, 'ghost').ok, false);
});

test('leadsEditable: yes on one lead and on the studio\'s own leads, no on a foreign encoding', () => {
  assert.deepEqual(leadsEditable(single()), { ok: true });
  assert.deepEqual(leadsEditable(threeLeads()), { ok: true });
  const foreign = threeLeads();
  // Turn a second set on for one lead: Lolly no longer knows where that lead's colours live.
  ((foreign.$themes as Rec[]).find(t => t.id === 'persimmon')!.selectedTokenSets as Rec).base = 'enabled';
  assert.equal(leadsEditable(foreign).ok, false);
  assert.equal(leadSlotPath(foreign, '{color.colourway.light.primary}', 'primary', 'persimmon'), null, 'its colours have no single home');
});

// ── Rebuild palette ─────────────────────────────────────────────────────────

test('carryLeads: a single-lead system passes straight through', () => {
  const fresh = single();
  const carried = carryLeads(single(), fresh);
  assert.ok(carried.ok);
  assert.equal(carried.ok && carried.doc, fresh, 'the same object, untouched');
  assert.deepEqual(carried.ok && [carried.canonical, carried.kept, carried.pinned], [null, [], 0]);
});

test('carryLeads: the canonical lead is re-derived, every other lead is kept exactly', () => {
  const doc = threeLeads();
  // A window and a rotation on the leads' entries must survive.
  const persimmonEntry = (doc.$themes as Rec[]).find(t => t.id === 'persimmon')!;
  (((persimmonEntry.$extensions as Rec)['com.suse.lolly'] as Rec).axis as Rec).window = { from: '2026-12-01', to: '2026-12-31' };
  const fresh = deriveBrandTokens({ primary: '#7a1fa2', name: 'Rebuilt' }) as Rec;
  const carried = carryLeads(doc, fresh);
  assert.ok(carried.ok, carried.ok ? '' : carried.reasons.join(' '));
  if (!carried.ok) return;
  const next = carried.doc;
  assert.deepEqual(carried.canonical, { id: 'pine', name: 'Pine' });
  assert.deepEqual(carried.kept, [{ id: 'persimmon', name: 'Persimmon' }, { id: 'waterhole', name: 'Waterhole' }]);
  assert.deepEqual(listLeads(next).map(l => [l.id, l.name, l.canonical]), listLeads(doc).map(l => [l.id, l.name, l.canonical]), 'every lead, in order');
  assert.deepEqual(colourwayAxis(next)!.options.find(o => o.id === 'persimmon')!.window, { from: '2026-12-01', to: '2026-12-31' });
  assert.deepEqual(((next.$metadata as Rec).tokenSetOrder as string[]).slice(-3), ['colourway/pine', 'colourway/persimmon', 'colourway/waterhole']);
  for (const mode of ['light', 'dark']) {
    // The canonical lead is what the fresh derive says...
    for (const role of ['primary', 'on-primary', 'secondary', 'surface', 'text']) {
      assert.equal(resolveIn(next, 'pine', mode, `color.semantic.${role}`), createTokenSet(fresh, { theme: mode }).resolve(`color.semantic.${role}`), `pine ${mode} ${role}`);
    }
    // ...and every other lead draws exactly what it drew.
    for (const lead of ['persimmon', 'waterhole']) {
      for (const role of ['primary', 'on-primary', 'secondary']) {
        assert.equal(resolveIn(next, lead, mode, `color.semantic.${role}`), resolveIn(doc, lead, mode, `color.semantic.${role}`), `${lead} ${mode} ${role}`);
      }
    }
  }
  assert.equal(carried.pinned, 0, 'leads added from a colour hold literals, so nothing needed pinning');
  assert.equal(readTokenAxes(next).diagnostics.length, 0);
});

test('carryLeads: a kept lead that followed a rebuilt shade keeps the colour it had', () => {
  let doc = threeLeads();
  const copy = duplicateLead(doc, 'pine', { name: 'Pine copy' });
  assert.ok(copy.ok);
  doc = copy.doc;
  const before = ['light', 'dark'].map(mode => resolveIn(doc, 'pine-copy', mode, 'color.semantic.primary'));
  const fresh = deriveBrandTokens({ primary: '#7a1fa2', name: 'Rebuilt' }) as Rec;
  const carried = carryLeads(doc, fresh);
  assert.ok(carried.ok);
  if (!carried.ok) return;
  assert.ok(carried.pinned > 0, 'the copy linked to the old ramp');
  assert.deepEqual(['light', 'dark'].map(mode => resolveIn(carried.doc, 'pine-copy', mode, 'color.semantic.primary')), before);
  assert.notEqual(resolveIn(carried.doc, 'pine', 'light', 'color.semantic.primary'), before[0], 'the canonical lead itself was re-derived');
});

test('carryLeads: a tinted surface stays re-pointed, and the root statement of a group is kept', () => {
  const lifted = ok(liftLeads(single(), { name: 'Pine' }));
  const doc = ok(addLead(lifted, { colour: '#e05a2b', name: 'Persimmon' }));
  // A third lead with a tinted surface, through the engine's own add: that lifts
  // the surface for every lead, and Rebuild must keep it lifted.
  const values: Record<string, ColourwayValues> = {
    light: { primary: '#c2410c', 'on-primary': '#ffffff', secondary: '#7c2d12', surface: '#fff4ee' },
    dark: { primary: '#fb923c', 'on-primary': '#111111', secondary: '#fed7aa', surface: '#1c0f08' },
  };
  const tinted = ok(addColourway(doc, { id: 'ember', name: 'Ember', values }));
  tinted.$extensions = { 'com.suse.lolly': { themeAxes: { colourway: { kind: 'colourway' } } } };
  const fresh = deriveBrandTokens({ primary: '#7a1fa2', name: 'Rebuilt' }) as Rec;
  const carried = carryLeads(tinted, fresh);
  assert.ok(carried.ok, carried.ok ? '' : carried.reasons.join(' '));
  if (!carried.ok) return;
  assert.equal(resolveIn(carried.doc, 'ember', 'light', 'color.semantic.surface'), '#fff4ee');
  assert.equal(resolveIn(carried.doc, 'persimmon', 'dark', 'color.semantic.surface'), resolveIn(tinted, 'persimmon', 'dark', 'color.semantic.surface'));
  assert.deepEqual(((((carried.doc.$extensions as Rec)['com.suse.lolly'] as Rec).themeAxes as Rec).colourway), { kind: 'colourway' });
});

test('carryLeads: the colourway sets keep their order, and a stored colourway choice stays', () => {
  // Waterhole is canonical but its set comes last: the carry must not move it first.
  const doc = ok(setCanonicalLead(threeLeads(), 'waterhole'));
  (doc.$metadata as Rec).activeThemeSelection = { '': 'dark', colourway: 'persimmon' };
  (doc.$metadata as Rec).activeThemes = ['light', 'Persimmon'];
  const fresh = deriveBrandTokens({ primary: '#7a1fa2', name: 'Rebuilt' }) as Rec;
  const carried = carryLeads(doc, fresh);
  assert.ok(carried.ok, carried.ok ? '' : carried.reasons.join(' '));
  if (!carried.ok) return;
  const meta = carried.doc.$metadata as Rec;
  assert.deepEqual(carried.canonical, { id: 'waterhole', name: 'Waterhole' });
  assert.deepEqual(meta.tokenSetOrder, ['base', 'light', 'dark', 'colourway/pine', 'colourway/persimmon', 'colourway/waterhole']);
  assert.deepEqual(listLeads(carried.doc).map(l => l.id), ['waterhole', 'pine', 'persimmon'], 'the lead order is the old one');
  // Only the colourway group's stored choice travels; the look's is the derive's, as with one lead.
  assert.deepEqual(meta.activeThemeSelection, { colourway: 'persimmon' });
  assert.deepEqual(meta.activeThemes, ['Persimmon']);
  for (const mode of ['light', 'dark']) {
    assert.equal(createTokenSet(carried.doc, { theme: mode }).resolve('color.semantic.primary'), createTokenSet(doc, { theme: mode }).resolve('color.semantic.primary'),
      `an artefact that chose no colourway still draws Persimmon in ${mode}`);
  }
});

test('carryLeads refuses a design system whose colourways Lolly cannot edit', () => {
  const foreign = threeLeads();
  ((foreign.$themes as Rec[]).find(t => t.id === 'persimmon')!.selectedTokenSets as Rec).base = 'enabled';
  const carried = carryLeads(foreign, single());
  assert.equal(carried.ok, false);
});

