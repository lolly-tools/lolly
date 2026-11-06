// SPDX-License-Identifier: MPL-2.0
/**
 * What a send takes from an editing copy, and who gets the way in. The gate is the
 * instance's report: a member has no capability, so a managed system stays read-only and
 * shown for them. No instance, or an older one, offers nothing.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { withRecordedBrandPage, readRecordedBrandPage } from '../../../../../engine/src/brand-page-address.ts';
import { TOKEN_EXT } from '../../../../../engine/src/token-ext.ts';
import { connectedInstanceFrom } from '../../org/brand-page-publish.ts';
import { buildInstanceEdit } from './instance-edit.ts';
import { managerActions } from './manager-actions.ts';

function tokens(): Record<string, any> {
  return {
    $description: 'Wefthouse',
    $metadata: { tokenSetOrder: ['base', 'light', 'dark', 'colourway/indigo'] },
    $themes: [
      { name: 'light', selectedTokenSets: { base: 'enabled', light: 'enabled' } },
      { name: 'dark', selectedTokenSets: { base: 'enabled', dark: 'enabled' } },
      { id: 'indigo', name: 'Indigo', group: 'colourway', selectedTokenSets: { 'colourway/indigo': 'enabled' }, $extensions: { [TOKEN_EXT]: { axis: { kind: 'colourway', canonical: true } } } },
    ],
    $extensions: { [TOKEN_EXT]: { versions: { versions: [{ slug: 'one' }] }, brandSystem: {
      schemaVersion: 1, id: 'wefthouse', label: 'Wefthouse',
      roles: [{ id: 'typeface', label: 'Typeface', resources: [{ type: 'token', path: 'font.brand' }] }],
      bindings: [], rules: [{ id: 'headline', roleIds: ['typeface'] }],
    } } },
    base: { color: { brand: { indigo: { $value: '#1b2a6b' } } }, font: { brand: { $value: 'Inter' } }, asset: { logo: { $type: 'asset', $value: 'wefthouse/logo/primary' } } },
    light: { color: { semantic: { primary: { $value: '{color.brand.indigo}' } } } },
    dark: { color: { semantic: { primary: { $value: '#8fa2ff' } } } },
    'colourway/indigo': { color: { colourway: { light: { primary: { $value: '{color.brand.indigo}' } } } } },
  };
}

test('an unchanged copy sends the mounted document, whatever a copy adds for itself', () => {
  const copy = tokens();
  // What making a copy does: its own identity, and no list of published versions.
  delete copy.$extensions[TOKEN_EXT].versions;
  copy.$extensions[TOKEN_EXT].designSystem = { id: 'copy', label: 'Copy' };
  const { doc, staysHere } = buildInstanceEdit(tokens(), copy);
  assert.deepEqual(doc, tokens());
  assert.deepEqual(staysHere, []);
});

test('colours go, and a font or a logo stays here and is named', () => {
  const copy = tokens();
  copy.base.color.brand.indigo.$value = '#223377';
  copy.base.font.brand.$value = 'Comic Sans';
  copy.base.asset.logo.$value = 'user/ds/copy/logo/primary';
  const { doc, staysHere } = buildInstanceEdit(tokens(), copy);
  assert.equal(doc.base && (doc.base as any).color.brand.indigo.$value, '#223377');
  assert.equal((doc.base as any).font.brand.$value, 'Inter', 'the mounted font');
  assert.equal((doc.base as any).asset.logo.$value, 'wefthouse/logo/primary', 'the mounted logo');
  assert.deepEqual(staysHere.sort(), ['fonts', 'logos']);
});

test('colour roles and bindings go, and the record around them stays the mounted one', () => {
  const copy = tokens();
  const system = copy.$extensions[TOKEN_EXT].brandSystem;
  system.label = 'Renamed';
  system.rules = [];
  system.roles[0].label = 'Type';
  system.roles.push({ id: 'main', label: 'Main', group: 'colourway', resources: [{ type: 'token', path: 'color.semantic.main' }] });
  system.bindings.push({ id: 'lead', roleId: 'main', consumer: { slot: 'primary' } });
  const out = buildInstanceEdit(tokens(), copy).doc as any;
  const sent = out.$extensions[TOKEN_EXT].brandSystem;
  assert.equal(sent.label, 'Wefthouse');
  assert.deepEqual(sent.rules, [{ id: 'headline', roleIds: ['typeface'] }]);
  assert.deepEqual(sent.roles.map((role: { label: string }) => role.label), ['Typeface', 'Main']);
  assert.deepEqual(sent.bindings.map((binding: { id: string }) => binding.id), ['lead']);
});

test('a system with no record can send its first roles', () => {
  const base = tokens();
  delete base.$extensions;
  const copy = tokens();
  copy.$extensions = { [TOKEN_EXT]: { brandSystem: { schemaVersion: 1, id: 'x', label: 'X', roles: [{ id: 'main', label: 'Main', group: 'colourway', resources: [] }], bindings: [], rules: [] } } };
  const sent = (buildInstanceEdit(base, copy).doc as any).$extensions[TOKEN_EXT].brandSystem;
  assert.deepEqual(sent.roles.map((role: { id: string }) => role.id), ['main']);
  assert.deepEqual(sent.rules, []);
  // And one with none to send gains nothing at all.
  assert.deepEqual(buildInstanceEdit(base, base).doc, base);
});

test('a colourway goes with its theme and its place in the order, and a light or dark note with it', () => {
  const copy = tokens();
  copy['colourway/rust'] = { color: { colourway: { light: { primary: { $value: '#a63a2a' } } } } };
  copy.$themes.push({ id: 'rust', name: 'Rust', group: 'colourway', selectedTokenSets: { 'colourway/rust': 'enabled' } });
  copy.$metadata.tokenSetOrder.push('colourway/rust');
  copy.$themes[0].$extensions = { [TOKEN_EXT]: { axis: { kind: 'mode' } } };
  const { doc } = buildInstanceEdit(tokens(), copy) as { doc: any };
  assert.ok(doc['colourway/rust']);
  assert.deepEqual(doc.$metadata.tokenSetOrder, ['base', 'light', 'dark', 'colourway/indigo', 'colourway/rust']);
  assert.deepEqual(doc.$themes.map((theme: { name: string }) => theme.name), ['light', 'dark', 'Indigo', 'Rust']);
  assert.deepEqual(doc.$themes[0].$extensions, { [TOKEN_EXT]: { axis: { kind: 'mode' } } });
  // Another change to a mode stays here.
  const other = tokens();
  other.$themes[0].selectedTokenSets = { base: 'enabled' };
  assert.deepEqual((buildInstanceEdit(tokens(), other).doc as any).$themes[0], tokens().$themes[0]);
  // Removing one takes its theme and its place.
  const fewer = tokens();
  delete fewer['colourway/indigo'];
  fewer.$themes = fewer.$themes.slice(0, 2);
  fewer.$metadata.tokenSetOrder = ['base', 'light', 'dark'];
  const gone = buildInstanceEdit(tokens(), fewer).doc as any;
  assert.equal(gone['colourway/indigo'], undefined);
  assert.deepEqual(gone.$metadata.tokenSetOrder, ['base', 'light', 'dark']);
});

test('the brand page address is the copy\'s own, set or cleared', () => {
  const page = 'https://acme.example/brand/';
  const set = buildInstanceEdit(tokens(), withRecordedBrandPage(tokens(), page) as Record<string, unknown>).doc;
  assert.equal(readRecordedBrandPage(set), page);
  const onBase = withRecordedBrandPage(tokens(), page) as Record<string, unknown>;
  const kept = buildInstanceEdit(onBase, onBase).doc;
  assert.equal(readRecordedBrandPage(kept), page, 'a copy that holds it keeps it');
  const cleared = buildInstanceEdit(onBase, tokens()).doc;
  assert.equal(readRecordedBrandPage(cleared), null, 'a copy that cleared it clears it');
});

test('a document with no sets sends its colours too', () => {
  const base = { color: { primary: { $value: '#000000' } }, font: { body: { $value: 'Inter' } } };
  const copy = { color: { primary: { $value: '#111111' } }, font: { body: { $value: 'Other' } } };
  const { doc, staysHere } = buildInstanceEdit(base, copy) as { doc: any; staysHere: string[] };
  assert.equal(doc.color.primary.$value, '#111111');
  assert.equal(doc.font.body.$value, 'Inter');
  assert.deepEqual(staysHere, ['fonts']);
});

// ── Who gets the way in ──────────────────────────────────────────────────────

const CAN_PUBLISH = { maxBundleBytes: 1, partBytes: 1, approval: false };
const CAN_EDIT = { maxDocumentBytes: 1, approval: false };

test('no capability, nothing new: a member gets neither action', () => {
  assert.deepEqual(managerActions(null), { editLabel: null, publishLabel: null }, 'no instance');
  const member = connectedInstanceFrom({ can: { 'brand.edit': false } }, true);
  assert.equal(member!.brandEdits, null);
  assert.deepEqual(managerActions(member), { editLabel: null, publishLabel: null });
  // A bit with no block, or a block with no bit, offers nothing: both have to hold.
  assert.equal(connectedInstanceFrom({ can: { 'brand.edit': true } }, true)!.brandEdits, null);
  assert.equal(connectedInstanceFrom({ brandEdits: CAN_EDIT, can: {} }, true)!.brandEdits, null);
  assert.equal(connectedInstanceFrom({ brandEdits: CAN_EDIT, can: { 'brand.edit': false } }, true)!.brandEdits, null);
});

test('a manager gets the edit, and publishing follows its own capability', () => {
  const manager = connectedInstanceFrom({ brandEdits: CAN_EDIT, brandPages: CAN_PUBLISH, can: { 'brand.edit': true } }, true);
  const actions = managerActions(manager);
  assert.match(actions.editLabel!, /^Edit for /);
  assert.equal(actions.publishLabel, 'Publish a brand page');
  const editOnly = managerActions(connectedInstanceFrom({ brandEdits: CAN_EDIT, can: { 'brand.edit': true } }, true));
  assert.ok(editOnly.editLabel);
  assert.equal(editOnly.publishLabel, null);
  const publishOnly = managerActions(connectedInstanceFrom({ brandPages: CAN_PUBLISH, can: {} }, true));
  assert.equal(publishOnly.editLabel, null);
  assert.equal(publishOnly.publishLabel, 'Publish a brand page');
});
