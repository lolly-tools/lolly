// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boxesToPenpotDoc, buildPenpotEntries, penpotTokensJson } from '../../../../engine/src/penpot-file.ts';
import { listLollyUiTokens, lollyUiOverride, lollyUiTokenDocument, removeLollyUiOverride, setLollyUiOverride, withLollyUiTokens } from './lolly-ui-tokens.ts';

test('the app document preserves its semantic references over the foundation scale', () => {
  const doc = lollyUiTokenDocument() as any;
  assert.equal(doc.lolly.ui.radius.control.$value, '{lolly.foundation.radius.sm}');
  assert.equal(doc.lolly.ui.radius.card.$value, '20px');
  assert.equal(doc.lolly.ui.elevation.floating.$value, '{lolly.foundation.elevation.3}');
  assert.equal(doc.lolly.ui.elevation.overlay.$value, '{lolly.foundation.elevation.5}');
  assert.equal(doc.lolly.ui.edge.default.$value, '{lolly.foundation.edge.default}');
  assert.equal(doc.lolly.ui.effect.bevel.$value, '{lolly.foundation.bevel.default}');
  assert.equal(doc.lolly.foundation.space['4'].$value, '8px');
});

test('the Start studio can show every UI role without adding any of them to a brand', () => {
  const tokens = listLollyUiTokens();
  assert.equal(tokens.length, 52);
  assert.equal(tokens.find(t => t.path.join('.') === 'color.text.default')?.type, 'color');
  assert.equal(tokens.find(t => t.path.join('.') === 'color.selection.surface')?.type, 'color');
  assert.equal(tokens.find(t => t.path.join('.') === 'elevation.overlay')?.type, 'shadow');
  const brand: Record<string, unknown> = { brand: { accent: { $type: 'color', $value: '#123456' } } };
  assert.equal(lollyUiOverride(brand, ['radius', 'control']), null);
  assert.equal('lolly' in brand, false);
});

test('saving and resetting one UI role changes only that owned leaf', () => {
  const brand: Record<string, unknown> = { brand: { accent: { $type: 'color', $value: '#123456' } } };
  setLollyUiOverride(brand, ['radius', 'control'], 'borderRadius', '12px');
  assert.equal((lollyUiOverride(brand, ['radius', 'control']) as any).$value, '12px');
  assert.equal((brand as any).lolly.ui.radius.control.$type, 'borderRadius');
  assert.equal(removeLollyUiOverride(brand, ['radius', 'control']), true);
  assert.equal(lollyUiOverride(brand, ['radius', 'control']), null);
  assert.equal('lolly' in brand, false);
});

test('a Tokens Studio brand keeps its own set and enables the Lolly app set in every theme', () => {
  const brand = {
    $metadata: { tokenSetOrder: ['brand'], activeSets: ['brand'] },
    $themes: [{ name: 'Light', selectedTokenSets: { brand: 'enabled' } }],
    brand: { color: { $type: 'color', primary: { $value: '#30ba78' } } },
  };
  const merged = withLollyUiTokens(brand) as any;
  assert.deepEqual(merged.$metadata.tokenSetOrder, ['brand', 'lolly']);
  assert.deepEqual(merged.$metadata.activeSets, ['brand', 'lolly']);
  assert.equal(merged.$themes[0].selectedTokenSets.lolly, 'enabled');
  assert.equal(merged.brand.color.primary.$value, '#30ba78');
  const penpot = penpotTokensJson(merged) as any;
  assert.ok(penpot.brand);
  assert.ok(penpot.lolly);
  assert.equal(penpot.lolly.ui.radius.control.$value, '{lolly.foundation.radius.sm}');
});

test('a plain DTCG brand remains a plain document with the reserved Lolly namespace added', () => {
  const merged = withLollyUiTokens({ brand: { accent: { $type: 'color', $value: '#123456' } } }) as any;
  assert.equal(merged.brand.accent.$value, '#123456');
  assert.equal(merged.lolly.ui.space.panel.$value, '{lolly.foundation.space.7}');
  assert.equal('$metadata' in merged, false);
});

test('an app-token override overlays the exported fallback tree without mutating the active design system', () => {
  const brand = {
    lolly: {
      ui: {
        radius: { control: { $type: 'borderRadius', $value: '12px', $description: 'Acme control radius' } },
        elevation: { overlay: { $type: 'shadow', $value: '{lolly.foundation.elevation.4}' } },
      },
    },
  };
  const merged = withLollyUiTokens(brand) as any;
  assert.equal(merged.lolly.ui.radius.control.$value, '12px');
  assert.equal(merged.lolly.ui.radius.control.$description, 'Acme control radius');
  assert.equal(merged.lolly.ui.elevation.overlay.$value, '{lolly.foundation.elevation.4}');
  // Stock leaves outside the custom subtree remain available to Penpot.
  assert.equal(merged.lolly.ui.radius.panel.$value, '1rem');
  assert.equal((brand as any).lolly.ui.radius.control.$value, '12px');
  assert.equal((brand as any).lolly.ui.radius.panel, undefined);
});

test('a real Penpot archive keeps Lolly semantic aliases and active UI overrides intact', () => {
  const tokens = withLollyUiTokens({
    $metadata: { tokenSetOrder: ['brand'], activeSets: ['brand'] },
    $themes: [{ name: 'Light', selectedTokenSets: { brand: 'enabled' } }],
    brand: { accent: { $type: 'color', $value: '#123456' } },
    lolly: { ui: { radius: { control: { $type: 'borderRadius', $value: '12px' } } } },
  });
  const doc = boxesToPenpotDoc([], { name: 'Lolly UI contract', canvas: { w: 640, h: 360 }, tokens });
  const build = buildPenpotEntries(doc, {
    uuid: (() => { let n = 0; return () => `00000000-0000-4000-8000-${(++n).toString().padStart(12, '0')}`; })(),
    now: () => '2026-09-04T12:00:00.000Z',
  });
  const entry = build.entries[`files/${build.fileId}/tokens.json`];
  if (typeof entry !== 'string') assert.fail('tokens.json must be a text archive entry');
  const exported = JSON.parse(entry) as any;
  assert.deepEqual(exported.$metadata.tokenSetOrder, ['brand', 'lolly']);
  assert.deepEqual(exported.$metadata.activeSets, ['brand', 'lolly']);
  assert.equal(exported.$themes[0].selectedTokenSets.lolly, 'enabled');
  assert.equal(exported.lolly.ui.radius.control.$value, '12px');
  assert.equal(exported.lolly.ui.radius.panel.$value, '1rem');
  assert.equal(exported.lolly.ui.elevation.floating.$value, '{lolly.foundation.elevation.3}');
  assert.equal(exported.lolly.foundation.space['4'].$value, '8px');
});
