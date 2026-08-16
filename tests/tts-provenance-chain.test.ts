// SPDX-License-Identifier: MPL-2.0
/**
 * Contract tests for synthetic-audio provenance (EU AI Act Article 50 - plan
 * tts-stt-programme section 2): a TTS clip's record-side credential - c2pa.created
 * with digitalSourceType trainedAlgorithmicMedia and the generation recipe
 * ({ script, voice, speed, model, lang }) in the action's parameters - must
 * survive the runtime's export-time ingredient sweep on BOTH audio-asset
 * shapes: a plain asset input (the audiogram's audio pick) and an asset field
 * inside a blocks input (a sequence-studio audio box). The prepared ingredient
 * handed to host.export.render has to keep the AI source type (so the composed
 * export reads composite-AI on /verify) AND the parameters (the machine-
 * readable script - recoverable from the chained manifest bytes verbatim).
 *
 * The store here is built exactly the way the web shell's save path builds it
 * (views/script-audio.ts buildTtsCredential): a signed sidecar-style store
 * whose hash binds the whole wav byte range with no exclusions, because wav
 * has no C2PA container and nothing is embedded into the file.
 *
 * Run with: node --test tests/tts-provenance-chain.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRuntime } from '../engine/src/runtime.ts';
import { buildC2paManifest, GENERATED_SOURCE_TYPE } from '../engine/src/index.ts';
import { collectActionChain } from '../engine/src/c2pa-extract.ts';

const SCRIPT = 'Hello from Lolly, this voice is synthetic.';
const TTS_PARAMS = { script: SCRIPT, voice: 'af_heart', speed: 1, model: 'kokoro-82m-q8', lang: 'en' };

// The web shell's buildTtsCredential recipe, minus the shell (no Blob, no
// identity bridge): sign a store over fake wav bytes, whole-range hash.
async function ttsCredentialStore(): Promise<Uint8Array> {
  const wav = new TextEncoder().encode('RIFF....WAVEfmt fake-pcm-bytes');
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', wav));
  return buildC2paManifest({
    title: 'Hello from Lolly…',
    claimGenerator: 'Lolly lolly.tools',
    generatorInfo: { name: 'Lolly', version: '0.0.0-test' },
    actions: [{
      action: 'c2pa.created',
      digitalSourceType: GENERATED_SOURCE_TYPE,
      description: 'Speech synthesized on-device from a typed script',
      parameters: TTS_PARAMS,
    }],
    assetHash: { exclusions: [], hash },
    format: 'audio/wav',
    dates: { notBefore: new Date(Date.now() - 60_000), notAfter: new Date(Date.now() + 86_400_000) },
  });
}

// Unique tool ids - compiled hook factories are memoised by id@version.
let toolSeq = 0;
// The audiogram shape: one plain asset input.
function plainAssetTool(): any {
  return {
    manifest: {
      id: `tts-plain-${++toolSeq}`, name: 'TTS Plain', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 10, height: 10, formats: ['png'] },
      inputs: [{ id: 'audio', type: 'asset', assetType: 'audio' }],
    },
    template: '<b>x</b>',
  };
}
// The sequence-studio shape: the audio ref lives in an asset FIELD of a blocks input.
function blocksAssetTool(): any {
  return {
    manifest: {
      id: `tts-blocks-${++toolSeq}`, name: 'TTS Blocks', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 10, height: 10, formats: ['png'] },
      inputs: [{
        id: 'boxes', type: 'blocks', fields: [
          { id: 'kind', type: 'select', options: [{ value: 'audio' }] },
          { id: 'src', type: 'asset', assetType: 'audio' },
        ],
      }],
    },
    template: '<b>x</b>',
  };
}

// Host double: a user-sourced audio ref, the TTS store behind assets.credential
// (what the record-side credential/credentialFormat fields serve), and an
// export.render that records the opts it was handed.
function makeHost(store: Uint8Array) {
  const rendered: any[] = [];
  const host: any = {
    version: '1',
    profile: { get: async () => ({}) },
    log: () => {},
    assets: {
      get: async (id: string) => ({ id, source: 'user', type: 'audio', format: 'wav', url: 'blob:x' }),
      credential: async () => ({ store, format: 'wav' }),
    },
    export: {
      render: async (_node: unknown, _format: string, opts: any) => { rendered.push(opts); return {}; },
    },
  };
  return { host, rendered };
}

// The prepared ingredient must keep the AI mark and the recipe: source type on
// the ingredient itself (it decorates the composed export's c2pa.opened step),
// and the parameters inside the verbatim manifest bytes the chain carries.
function assertArticle50Ingredient(ing: any): void {
  assert.equal(ing.digitalSourceType, GENERATED_SOURCE_TYPE, 'trainedAlgorithmicMedia survives into the ingredient');
  assert.equal(ing.format, 'wav', 'the ingredient names its container honestly');
  assert.ok(ing.manifestBoxes.length >= 1, 'the manifest superboxes ride verbatim');
  // The script is machine-readably inside the chained bytes: the CBOR-encoded
  // actions assertion carries the utf8 text of the script string verbatim.
  const scriptBytes = new TextEncoder().encode(SCRIPT);
  const carried = ing.manifestBoxes.some((box: Uint8Array) => {
    outer: for (let i = 0; i + scriptBytes.length <= box.length; i++) {
      for (let j = 0; j < scriptBytes.length; j++) if (box[i + j] !== scriptBytes[j]) continue outer;
      return true;
    }
    return false;
  });
  assert.ok(carried, 'the exact script text is preserved inside the chained manifest bytes');
}

test('read side: a TTS store surfaces its parameters and AI source type', async () => {
  const store = await ttsCredentialStore();
  const chain = collectActionChain(store);
  const created = chain.find((s) => s.action === 'c2pa.created');
  assert.ok(created, 'the created step is readable');
  assert.equal(created!.digitalSourceType, GENERATED_SOURCE_TYPE);
  const params = created!.parameters;
  assert.ok(params instanceof Map, 'parameters decode as a CBOR map');
  assert.equal((params as Map<string, unknown>).get('script'), SCRIPT, 'the exact script is recoverable');
  assert.equal((params as Map<string, unknown>).get('model'), 'kokoro-82m-q8');
  assert.equal((params as Map<string, unknown>).get('lang'), 'en');
});

test('plain asset input (audiogram): the TTS credential chains into opts.ingredients intact', async () => {
  const store = await ttsCredentialStore();
  const { host, rendered } = makeHost(store);
  const rt = await createRuntime(plainAssetTool(), host, { audio: { id: 'user/tts/1-hello' } });
  await rt.export({} as any, 'png', {});
  assert.equal(rendered.length, 1);
  assert.equal(rendered[0].ingredients?.length, 1, 'the TTS asset is preserved as an ingredient');
  assertArticle50Ingredient(rendered[0].ingredients[0]);
});

test('blocks asset field (sequence-studio audio box): the TTS credential chains intact too', async () => {
  const store = await ttsCredentialStore();
  const { host, rendered } = makeHost(store);
  const rt = await createRuntime(blocksAssetTool(), host, {
    boxes: [{ kind: 'audio', src: { id: 'user/tts/2-hello' } }],
  });
  await rt.export({} as any, 'png', {});
  assert.equal(rendered.length, 1);
  assert.equal(rendered[0].ingredients?.length, 1, 'the block-field TTS asset is preserved as an ingredient');
  assertArticle50Ingredient(rendered[0].ingredients[0]);
});
