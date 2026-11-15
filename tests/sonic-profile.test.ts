// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { brandContext, contextTokens } from '../engine/src/brand-context.ts';
import { applyPinnedAssets, collectAssetTokens } from '../engine/src/design-version.ts';
import {
  readSonicProfile,
  readSonicRecipe,
  resolveSonicRecipe,
  sonicProfileDigest,
  sonicProfileOf,
  withSonicProfile,
} from '../engine/src/sonic-profile.ts';
import { TOKEN_EXT } from '../engine/src/token-ext.ts';
import {
  checkSonicMusic,
  sonicMusicAdapter,
  sonicMusicFromLink,
  starterSonicProfile,
} from '../shells/web/src/lib/sonic-music.ts';

const fixture = () => starterSonicProfile('studio-sound', 'Studio sound');

test('full music links retain advanced choices and discard local navigation fields', () => {
  const params = sonicMusicFromLink(
    'https://example.test/#/music?style=warm&seed=7&drop.lead=metal&tag=off&mix.fx=0&lock=genre&slot=__music__:12'
  );
  const parsed = new URLSearchParams(params);
  assert.equal(parsed.get('drop.lead'), 'metal');
  assert.equal(parsed.get('tag'), 'off');
  assert.equal(parsed.has('slot'), false);
  assert.equal(parsed.has('lock'), false);
  assert.throws(() => sonicMusicFromLink('#/music?style=unknown&seed=7'), /supported settings/);
});

test('legacy systems are unchanged and sound survives the existing context envelope', () => {
  const doc = {
    colour: { $type: 'color', $value: '#000000' },
    $extensions: { other: { retained: true }, [TOKEN_EXT]: { privateField: 'retained' } },
  };
  assert.equal(sonicProfileOf(doc).state, 'absent');
  const next = withSonicProfile(doc, fixture());
  assert.deepEqual(contextTokens(JSON.parse(JSON.stringify(brandContext(next)))), next);
  assert.equal(sonicProfileOf(doc).state, 'absent');
  assert.deepEqual(sonicProfileOf(next).profile, fixture());
  assert.deepEqual(next.$extensions && (next.$extensions as Record<string, unknown>).other, {
    retained: true,
  });
  const copy = sonicProfileOf(next).profile!;
  copy.label = 'Changed';
  assert.equal(sonicProfileOf(next).profile?.label, 'Studio sound');
});

test('unsupported versions and broken references cannot be silently overwritten', () => {
  const profile = fixture();
  assert.equal(readSonicProfile({ ...profile, schemaVersion: 2 }), null);
  assert.equal(readSonicProfile({ ...profile, defaultContext: 'missing' }), null);
  assert.equal(
    readSonicProfile({ ...profile, contexts: [profile.contexts[0], profile.contexts[0]] }),
    null
  );
  assert.equal(readSonicProfile({ ...profile, review: { state: 'reviewed' } }), null);
  const next = { $extensions: { [TOKEN_EXT]: { sonicProfile: { schemaVersion: 2 } } } };
  assert.equal(sonicProfileOf(next).state, 'unsupported');
  assert.throws(() => withSonicProfile(next, profile), /compatible editor/);
});

test('selection has explicit precedence, required conflicts stop, and retries keep the same composition', async () => {
  const profile = fixture();
  const request = { documentContext: 'play', campaignContext: 'demonstrate', seed: 919 };
  const a = await resolveSonicRecipe(profile, request, sonicMusicAdapter);
  const b = await resolveSonicRecipe(profile, request, sonicMusicAdapter);
  assert.deepEqual(a, b);
  assert.equal(a.recipe?.contextId, 'play');
  assert.equal(a.recipe?.selection, 'document');
  assert.equal(new URLSearchParams(a.recipe!.music.parameters).get('seed'), '919');
  assert.equal(
    (
      await resolveSonicRecipe(
        profile,
        { seed: 919, campaignContext: 'demonstrate' },
        sonicMusicAdapter
      )
    ).recipe?.selection,
    'campaign'
  );
  assert.equal(
    (await resolveSonicRecipe(profile, { seed: 919 }, sonicMusicAdapter)).recipe?.contextId,
    'explain'
  );
  assert.equal(
    (
      await resolveSonicRecipe(
        profile,
        { ...request, requiredContext: 'explain' },
        sonicMusicAdapter
      )
    ).recipe,
    null
  );
  assert.equal((await resolveSonicRecipe(profile, { seed: -1 }, sonicMusicAdapter)).recipe, null);
  assert.equal(
    (
      await resolveSonicRecipe(
        profile,
        { seed: 919, documentContext: 'missing' },
        sonicMusicAdapter
      )
    ).recipe,
    null
  );
});

test('unsupported requirements and adapter settings never fall back to a successful brand result', async () => {
  const profile = fixture();
  const context = profile.contexts[0]!;
  context.requirements.push({
    id: 'motif',
    kind: 'motif-transform',
    label: 'Keep our melody',
    requirement: 'required',
  });
  assert.equal((await resolveSonicRecipe(profile, { seed: 8 }, sonicMusicAdapter)).recipe, null);
  context.requirements[0]!.requirement = 'advisory';
  assert.ok((await resolveSonicRecipe(profile, { seed: 8 }, sonicMusicAdapter)).recipe);
  context.music.adapter = 'unavailable';
  assert.equal((await resolveSonicRecipe(profile, { seed: 8 }, sonicMusicAdapter)).recipe, null);
  for (const query of [
    'style=polka&seed=8',
    'style=warm&seed=8&bpm=999',
    'style=warm&seed=8&unknown=1',
    'style=warm&seed=8&seed=9',
    'style=warm&seed=8&lead=soft',
    'style=warm&seed=8&quiet=imaginary',
  ])
    assert.ok(checkSonicMusic(query).length, query);
  assert.deepEqual(
    checkSonicMusic('style=warm&seed=0&bars=64&drums=1&texture=0.30&transpose=0&mix.lead=1'),
    []
  );
});

test('retained recipes keep their profile and verify its digest without upgrading review', async () => {
  const profile = fixture();
  const { recipe } = await resolveSonicRecipe(profile, { seed: 3 }, sonicMusicAdapter);
  assert.ok(recipe);
  assert.equal(recipe.profile.review.state, 'draft');
  profile.identity.character = 'Different';
  assert.notEqual(await sonicProfileDigest(profile), recipe.profileSha256);
  const restored = await readSonicRecipe(JSON.parse(JSON.stringify(recipe)), sonicMusicAdapter);
  assert.deepEqual(restored, recipe);
  assert.equal(await readSonicRecipe({ ...recipe, profile }, sonicMusicAdapter), null);
  assert.equal(
    await readSonicRecipe(
      { ...recipe, music: { ...recipe.music, parameters: 'style=warm&seed=9' } },
      sonicMusicAdapter
    ),
    null
  );
});

test('signature and reference audio use the existing asset packaging and version pinning path', () => {
  const profile = fixture();
  profile.contexts[0]!.signature.resource = { type: 'asset', id: 'user/audio/signature' };
  profile.contexts[0]!.examples.push({
    label: 'Reference',
    note: 'Listen to the ending',
    resource: { type: 'asset', id: 'user/audio/reference' },
  });
  const doc = withSonicProfile({}, profile);
  assert.deepEqual(
    collectAssetTokens(doc).map((a) => a.id),
    ['user/audio/signature', 'user/audio/reference']
  );
  const pinned = applyPinnedAssets(doc, [
    {
      id: 'user/audio/signature',
      version: '1',
      sha256: 'known',
      frozenId: 'user/frozen/signature',
    },
  ]);
  assert.equal(
    sonicProfileOf(pinned).profile?.contexts[0]?.signature.resource?.id,
    'user/frozen/signature'
  );
  assert.equal(
    sonicProfileOf(doc).profile?.contexts[0]?.signature.resource?.id,
    'user/audio/signature'
  );
});
