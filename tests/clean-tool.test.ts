// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import type { AudioCleanOpts, AudioCleanResult, HostV1 } from '@lolly-tools/core/host-v1';

test('Clean exposes every processing choice and exports using the selected settings', async () => {
  const tool = await loadTool('clean', path => readFile(new URL(`../community/${path}`, import.meta.url), 'utf8'));
  const calls: AudioCleanOpts[] = [];
  const host = {
    version: '1', log() {}, profile: { get: async () => ({}) },
    audio: { clean: async (_source: unknown, opts: AudioCleanOpts) => {
      calls.push(opts);
      return { bytes: new Uint8Array([1, 2]), mime: 'audio/wav', format: opts.output,
        durationAfter: 1, loudnessBefore: -30, loudnessAfter: -16, truePeakDb: -1, secondsTrimmed: 0,
        operations: ['normalised'] } as AudioCleanResult;
    } },
  } as unknown as HostV1;
  const runtime = await createRuntime(tool, host, { source: {
    __file: true, name: 'voice.wav', mime: 'audio/wav', size: 4, bytes: new Uint8Array([82, 73, 70, 70]),
  } } as never);
  const dom = new JSDOM('<!doctype html><body></body>');
  try {
    dom.window.document.body.innerHTML = runtime.getHydrated();
    const root = dom.window.document;
    for (const id of ['denoise', 'normalize', 'audioFormat', 'trimSilence']) {
      assert.ok(root.querySelector(`[data-input-id="${id}"]`), `${id} is available without a sidebar`);
    }
    await runtime.setInput('denoise', 'light');
    await runtime.setInput('normalize', 'off');
    await runtime.setInput('trimSilence', false);
    await runtime.setInput('audioFormat', 'mp3');
    dom.window.document.body.innerHTML = runtime.getHydrated();
    assert.equal(root.querySelector<HTMLSelectElement>('[data-input-id="denoise"]')?.value, 'light');
    assert.equal(root.querySelector<HTMLInputElement>('[data-input-id="trimSilence"]')?.checked, false);
    const result = await runtime.exportFile();
    assert.equal(Array.isArray(result), false);
    assert.deepEqual(calls.at(-1), { denoise: 'light', normalize: 'off', trimSilence: false, output: 'mp3', sourceName: 'voice.wav', sourceMime: 'audio/wav' });
    assert.equal((Array.isArray(result) ? result[0] : result)?.filename, 'voice-clean.mp3');
  } finally { runtime.destroy(); dom.window.close(); }
});
