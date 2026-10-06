// SPDX-License-Identifier: MPL-2.0
/**
 * The Design scene fixtures (plan 265 milestone 3, lane T0).
 *
 * Two documents live in `tests/fixtures/design/scene`, written by `generate.ts` in
 * that folder, and the other lanes of this milestone build against them. This suite
 * is what keeps them honest:
 *
 * 1. They still describe the documents the plan asks for: a still artboard with a
 *    text box, an image box and one 3D box, and a sequence-lane document whose 3D
 *    box runs from 0.5 s for 3 s.
 * 2. Every readable string still matches a rebuild from the two shipped manifests, so
 *    a field appended to `community/design/tool.json` or a changed 3D Studio default
 *    is reported here instead of moving a fixture silently.
 * 3. The scene queries are the contract form (defaults omitted, user ids kept), and
 *    they agree with the engine's own `designSceneEncode` wherever lane A's module is
 *    already in the tree.
 * 4. The `?z=` form opens back to exactly the readable query, and the readable query
 *    parses back to the same rows.
 * 5. The boxes read cleanly through `inspectDesignV1`, whether or not `3d` is a known
 *    Design layer kind yet: lane A is what adds the kind, and both worlds are
 *    asserted so this suite never has to be edited for that change.
 *
 * Run with: node --test tests/design-scene-fixtures.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DESIGN_LAYER_KINDS, inspectDesignV1 } from '../packages/core/src/design-v1.ts';
import { parseUrlState } from '../engine/src/url-mode.ts';
import { expandQuery, packQuery } from '../engine/src/url-pack.ts';
import type { InputManifest } from '../engine/src/inputs.ts';
import {
  buildDesignSceneFixtures, designSceneFixturePath, sceneQuery, studioManifest,
} from './fixtures/design/scene/generate.ts';
import {
  designSceneAssetUrls, designSceneDocumentHtml, designSceneFixtures, designSceneLane,
  designSceneStill, sceneMarkers, serveDesignSceneAssets,
} from './helpers/design-scene.ts';

const REGENERATE = 'run `node tests/fixtures/design/scene/generate.ts` and commit what it writes';

interface Row { [key: string]: unknown }

function rows(fixtureId: string): Row[] {
  return designSceneFixtures.find((f) => f.id === fixtureId)!.boxes as Row[];
}

function sceneRows(fixtureId: string): Row[] {
  return rows(fixtureId).filter((r) => r.kind === '3d');
}

// -- the files themselves ------------------------------------------------------

test('both fixture files load and hold the documents the milestone asks for', () => {
  assert.deepEqual(designSceneFixtures.map((f) => f.id), ['still', 'lane']);
  for (const fixture of designSceneFixtures) {
    assert.ok(existsSync(designSceneFixturePath(fixture.id)), `${fixture.id}.json is on disk`);
    assert.ok(Array.isArray(fixture.boxes) && fixture.boxes.length >= 4, `${fixture.id}: four rows or more`);
    const ids = fixture.boxes.map((b) => (b as Row).id);
    assert.equal(new Set(ids).size, ids.length, `${fixture.id}: every row id is its own`);
    assert.equal(fixture.boxes.filter((b) => (b as Row).kind === 'frame').length, 1, `${fixture.id}: one artboard`);
    assert.ok(fixture.query.length > 0 && fixture.packed.startsWith('z='), `${fixture.id}: both query forms`);
  }

  // The still document: a text box, an image box with a catalog asset, one 3D box.
  const still = rows('still').map((r) => r.kind);
  assert.deepEqual(still, ['frame', 'text', 'image', '3d']);
  assert.deepEqual(designSceneStill.assetIds, ['lolly/logo/primary']);

  // The lane document: everything timed, and no video box, because the public brand
  // catalog holds no video asset. A music bed stands in as the second timed source.
  const lane = rows('lane').map((r) => r.kind);
  assert.deepEqual(lane, ['frame', 'text', '3d', 'audio']);
  for (const row of rows('lane').slice(1)) {
    assert.equal(row.lane, 'seq', `${String(row.id)} is on the sequence lane`);
  }
  assert.equal(designSceneLane.assetIds.length, 1, 'one asset id: the procedural music bed');
});

test('a 3D box is an ordinary row plus one scene field', () => {
  // The row shape every later lane reads. A scene box carries no `image`: its
  // picture comes from the studio, and `scene` is the only field the kind adds.
  const hero = sceneRows('still')[0]!;
  assert.deepEqual(Object.keys(hero).sort(), ['frame', 'h', 'id', 'kind', 'name', 'order', 'scene', 'w', 'x', 'y']);
  assert.equal(hero.kind, '3d');
  assert.equal(hero.w, 640);
  assert.equal(hero.h, 640);
  assert.equal(hero.image, undefined);
  assert.equal(hero.scene, designSceneStill.scenes[0]!.scene);

  const badge = sceneRows('lane')[0]!;
  assert.equal(badge.start, 0.5, 'the badge starts half a second in');
  assert.equal(badge.dur, 3, 'and runs for three seconds');
  assert.equal(badge.lane, 'seq');
  assert.equal(badge.scene, designSceneLane.scenes[0]!.scene);
});

// -- the scene grammar ---------------------------------------------------------

test('each scene is the contract form: the studio query with defaults left out', () => {
  for (const fixture of designSceneFixtures) {
    assert.equal(fixture.scenes.length, 1, `${fixture.id}: one scene entry`);
    for (const entry of fixture.scenes) {
      assert.equal(entry.scene, sceneQuery(entry.values), `${fixture.id}: ${REGENERATE}`);
      assert.equal(entry.sceneFull, sceneQuery(entry.values, { full: true }), `${fixture.id}: ${REGENERATE}`);
      // The full form is the authored values; the canonical one is a subset of it,
      // because dropping a default can only remove keys.
      const full = new URLSearchParams(entry.sceneFull);
      for (const [key, value] of new URLSearchParams(entry.scene)) {
        assert.equal(full.get(key), value, `${fixture.id}: ${key} reads the same in both forms`);
      }
      // Both forms open to the same values, since what the canonical one leaves out
      // is exactly what the manifest fills back in.
      const studio = studioManifest();
      const fromScene = parseUrlState(entry.scene, studio).values;
      const fromFull = parseUrlState(entry.sceneFull, studio).values;
      for (const [key, value] of Object.entries(fromScene)) {
        assert.deepEqual(fromFull[key], value, `${fixture.id}: ${key} survives the canonical form`);
      }
    }
  }
});

test("the engine's own scene encoder agrees with the fixtures", async (t) => {
  // engine/src/design-scene.ts is lane A's. While it is absent this reports as a skip
  // rather than a failure, so lane T0 stands on its own.
  const modulePath = join(import.meta.dirname, '..', 'engine', 'src', 'design-scene.ts');
  if (!existsSync(modulePath)) {
    t.skip('engine/src/design-scene.ts is not in the tree yet (lane A)');
    return;
  }
  const { designSceneEncode, designSceneDecode } = await import('../engine/src/design-scene.ts');
  const studio = studioManifest();
  for (const fixture of designSceneFixtures) {
    for (const entry of fixture.scenes) {
      assert.equal(
        designSceneEncode(entry.values, studio), entry.scene,
        `${fixture.id}: designSceneEncode and the fixture must produce the same bytes`,
      );
      const decoded = designSceneDecode(entry.scene, studio);
      for (const [key, value] of Object.entries(entry.values)) {
        assert.equal(String(decoded[key]), String(value), `${fixture.id}: ${key} comes back from the scene`);
      }
      assert.equal(designSceneEncode(decoded, studio), entry.scene, `${fixture.id}: encode of decode is the same string`);
    }
  }
});

// -- the two query forms -------------------------------------------------------

test('the packed form opens back to the readable query, byte for byte', async () => {
  for (const fixture of designSceneFixtures) {
    assert.equal(await expandQuery(fixture.packed), fixture.query, `${fixture.id}: z= opens to the readable query`);
    const minted = await packQuery(fixture.query);
    assert.ok(minted, `${fixture.id}: the query can be packed`);
    assert.equal(await expandQuery(`z=${minted}`), fixture.query, `${fixture.id}: a newly packed query reads back`);
  }
});

test('the readable query parses back to the same rows, scene field included', () => {
  const design = JSON.parse(
    readFileSync(join(import.meta.dirname, '..', 'community', 'design', 'tool.json'), 'utf8'),
  ) as InputManifest;
  const declared = (design.inputs ?? []).find((i) => i.id === 'boxes')?.fields?.some((f) => f.id === 'scene');
  for (const fixture of designSceneFixtures) {
    assert.equal(
      fixture.sceneFieldFromManifest, declared === true,
      `${fixture.id}: the file records where the scene field came from - ${REGENERATE}`,
    );
    const parsed = parseUrlState(fixture.query, design).values.boxes as Row[];
    assert.equal(parsed.length, fixture.boxes.length, `${fixture.id}: every row survives the query`);
    for (const [index, row] of fixture.boxes.entries()) {
      assert.equal(parsed[index]!.id, (row as Row).id, `${fixture.id}: row ${index} keeps its id`);
      assert.equal(parsed[index]!.kind, (row as Row).kind, `${fixture.id}: row ${index} keeps its kind`);
    }
    if (!declared) continue; // the scene field is not in the wire format yet (lane A)
    for (const entry of fixture.scenes) {
      const row = parsed.find((r) => r.id === entry.boxId)!;
      assert.equal(row.scene, entry.scene, `${fixture.id}: ${entry.boxId} carries its scene through the query`);
    }
  }
});

test('the fixtures match a rebuild from the two shipped manifests', async () => {
  const rebuilt = await buildDesignSceneFixtures();
  assert.deepEqual(
    rebuilt.map((f) => f.id), designSceneFixtures.map((f) => f.id),
    `the fixture set changed - ${REGENERATE}`,
  );
  for (const [index, fixture] of designSceneFixtures.entries()) {
    const { packed: rebuiltPacked, ...rebuiltDocument } = rebuilt[index]!;
    const { packed: savedPacked, ...savedDocument } = fixture;
    assert.deepEqual(rebuiltDocument, savedDocument, `${fixture.id}.json is stale - ${REGENERATE}`);
    assert.equal(await expandQuery(rebuiltPacked), await expandQuery(savedPacked), `${fixture.id}: both codecs read the same document`);
  }
});

// -- the portable read model ---------------------------------------------------

test('the documents read cleanly through inspectDesignV1', () => {
  // Lane A is what appends '3d' to DESIGN_LAYER_KINDS. Both worlds are asserted, so
  // this test reports a real break either way and needs no edit for that change:
  // before the kind is known, the 3D rows and only the 3D rows raise kind-unknown.
  const known = (DESIGN_LAYER_KINDS as readonly string[]).includes('3d');
  for (const fixture of designSceneFixtures) {
    const inspection = inspectDesignV1(fixture.boxes);
    const sceneIds = fixture.scenes.map((s) => s.boxId);
    assert.equal(inspection.summary.artboards, 1, `${fixture.id}: one artboard`);
    assert.equal(inspection.layers.length, fixture.boxes.length, `${fixture.id}: every row is a layer`);
    const unknown = inspection.findings.filter((f) => f.id === 'design.layer.kind-unknown');
    const others = inspection.findings.filter((f) => f.id !== 'design.layer.kind-unknown');
    assert.deepEqual(others, [], `${fixture.id}: nothing else to report`);
    if (known) {
      assert.deepEqual(unknown, [], `${fixture.id}: '3d' is a known kind now`);
      assert.equal(inspection.valid, true, `${fixture.id}: the document is valid`);
      for (const id of sceneIds) {
        assert.equal(inspection.layers.find((l) => l.id === id)!.kind, '3d', `${fixture.id}: ${id} reads as a 3D layer`);
      }
    } else {
      assert.deepEqual(
        unknown.map((f) => f.layerId), sceneIds,
        `${fixture.id}: only the 3D rows are unknown while lane A is outstanding`,
      );
    }
  }
  // The lane document is the timed one: its three children are clips.
  const lane = inspectDesignV1(designSceneLane.boxes);
  assert.equal(lane.summary.timedLayers, 3, 'three timed clips on the lane');
  assert.equal(lane.summary.duration, 4, 'the document runs four seconds');
});

// -- the fixture server --------------------------------------------------------

test('the fixture routes serve the catalog assets the documents name', async () => {
  const urls = designSceneAssetUrls();
  assert.equal(urls['lolly/logo/primary'], '/catalog/assets/lolly/logo/primary.svg');
  assert.equal(urls['zzfxm:20260807'], undefined, 'the procedural music bed has no file behind it');

  const routes = serveDesignSceneAssets();
  const route = routes['/catalog/*'];
  assert.equal(typeof route, 'function', 'the catalog prefix route is registered');
  const bytes = await (route as (path: string) => Promise<Uint8Array | string>)(urls['lolly/logo/primary']!);
  assert.ok(bytes.length > 1000, 'the logo file comes back from the blank starter catalog');
  await assert.rejects(
    async () => (route as (path: string) => Promise<Uint8Array | string>)('/catalog/assets/nope.svg'),
    'a missing file is a refusal, which the harness answers as a 404',
  );

  // Additive: a key the caller set is the one kept.
  assert.equal(serveDesignSceneAssets({ '/catalog/*': 'mine' })['/catalog/*'], 'mine');
});

// -- the rendered document -----------------------------------------------------

test('the document renders through the engine, markers included once the hook writes them', async (t) => {
  let html: string;
  try {
    html = await designSceneDocumentHtml(designSceneStill);
  } catch (err) {
    // The shipped Design manifest belongs to lane A. While it does not load, this
    // reports as a skip naming the reason rather than a failure in a file T0 owns.
    t.skip(`the design tool did not load: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  assert.match(html, /data-box-id="hero"/, 'the 3D box is painted like any other box');
  assert.match(html, /data-box-id="logo"/, 'so is the image box');

  const markers = sceneMarkers(html);
  if (!markers.length) {
    // Lane A adds the marker branch to community/design/hooks.js. Until then the box
    // paints as a plain rectangle, which is what the rest of this test just checked.
    t.diagnostic('no [data-lolly-scene] marker yet (lane A)');
    return;
  }
  assert.equal(markers.length, 1, 'one marker for the one 3D box');
  assert.deepEqual(markers[0], {
    boxId: 'hero',
    scene: designSceneStill.scenes[0]!.scene,
    state: 'poster',
  });
  assert.match(html, /class="lolly-box-img lolly-box-scene"/, 'the marker carries both classes');

  // The lane document has its own marker, on the timed box.
  const laneMarkers = sceneMarkers(await designSceneDocumentHtml(designSceneLane));
  assert.deepEqual(laneMarkers.map((m) => m.boxId), ['badge']);
  assert.equal(laneMarkers[0]!.scene, designSceneLane.scenes[0]!.scene);
});
