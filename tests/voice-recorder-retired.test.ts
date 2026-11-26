// SPDX-License-Identifier: MPL-2.0
//
// Voice Recorder is retired into Audiogram. Its id is a permanent contract, so the
// tool still loads and draws its card for an old link or a saved session, while its
// manifest points at Audiogram. Audiogram holds what Voice Recorder was for: a
// microphone take, level coaching choices and the sound as a file.
//
// Run with:
//   node --import ./tests/css-stub.mjs --test tests/voice-recorder-retired.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { parseUrlState } from '../engine/src/url-mode.ts';
import { baseHost } from './helpers/host.ts';

const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const SKIP = !existsSync(join(COMMUNITY, 'voice-recorder', 'tool.json')) && 'community pack not mounted';
const load = (id: string) => loadTool(id, (p) => readFile(join(COMMUNITY, p), 'utf8'));
const AUDIO_FORMATS = ['wav', 'mp3', 'm4a', 'opus'];

interface Manifest {
  deprecated?: boolean; replacedBy?: string; listed?: boolean; featured?: unknown;
  render: { formats: string[]; capture?: string };
  hooks?: Record<string, boolean>;
  inputs: Array<{ id: string; type: string; assetType?: string; default?: unknown; options?: Array<{ value: string }> }>;
}

test('Voice Recorder is retired into Audiogram and no longer offered', { skip: SKIP }, async () => {
  const manifest = (await load('voice-recorder')).manifest as unknown as Manifest;
  assert.equal(manifest.deprecated, true);
  assert.equal(manifest.replacedBy, 'audiogram');
  assert.equal(manifest.listed, false);
  assert.equal(manifest.featured, undefined, 'an unlisted tool holds no featured tile');
});

test('an old Voice Recorder link still opens and draws its card', { skip: SKIP }, async () => {
  const tool = await load('voice-recorder');
  const { values } = parseUrlState('title=Standup+notes&theme=light&targetLevel=soft&showTips=false', tool.manifest as never);
  const runtime = await createRuntime(tool as never, baseHost(), values as never);
  const html = runtime.getHydrated();
  assert.match(html, /class="vr" data-theme="light"/);
  assert.match(html, /Standup notes/);
  assert.equal(runtime.hasLevelHook, true, 'the card still draws its own level meter');
});

test('Audiogram records from the microphone and takes the coaching choices', { skip: SKIP }, async () => {
  const voice = (await load('voice-recorder')).manifest as unknown as Manifest;
  const audiogram = (await load('audiogram')).manifest as unknown as Manifest;
  assert.equal(audiogram.render.capture, 'audio');
  for (const id of ['targetLevel', 'showTips']) {
    const was = voice.inputs.find((i) => i.id === id)!;
    const now = audiogram.inputs.find((i) => i.id === id);
    assert.ok(now, `Audiogram has ${id}`);
    assert.equal(now.type, was.type);
    assert.deepEqual(now.default, was.default);
    assert.deepEqual(now.options?.map((o) => o.value), was.options?.map((o) => o.value));
  }
  assert.equal(audiogram.hooks?.onLevel, undefined, 'the shell draws the levels, so the card is not redrawn per sample');
});

// The export sheet saves sound for a tool from one of two places: an audio asset input
// (views/tool-actions/wiring.ts, `hasToolAudioInput`) or a stage that supplies its own
// mix (bridge/export.ts, `lollyAudioSource`). Voice Recorder has neither, so its four
// audio format ids had no sound to save and the take left only through the Save MP3
// and Save native buttons. Audiogram keeps the take as its Audio input, which is the
// source those four formats read (tests/audiogram-audio-export.test.ts).
test('the take reaches the four audio formats in Audiogram, which it never did in Voice Recorder', { skip: SKIP }, async () => {
  const voice = await load('voice-recorder');
  const audiogram = await load('audiogram');
  const audioInput = (m: Manifest) => m.inputs.some((i) => i.type === 'asset' && i.assetType === 'audio');
  const voiceManifest = voice.manifest as unknown as Manifest;
  const audiogramManifest = audiogram.manifest as unknown as Manifest;
  for (const format of AUDIO_FORMATS) {
    assert.ok(voiceManifest.render.formats.includes(format));
    assert.ok(audiogramManifest.render.formats.includes(format));
  }
  assert.equal(audioInput(voiceManifest), false);
  assert.ok(!(voice as unknown as { template: string }).template.includes('data-audio-source'));
  assert.equal(audioInput(audiogramManifest), true);
});
