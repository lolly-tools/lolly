// SPDX-License-Identifier: MPL-2.0
/// <reference path="../../shells/web/src/vendor.d.ts" />
/** Browser adapter for a local study, using the shipped music and sequence renderers. */

import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import { packWav } from '../../engine/src/wav.ts';
import { renderSequence } from '../../shells/web/src/bridge/sequence-render.ts';
import { renderLofiTunePcm } from '../../shells/web/src/lib/lofi-tune.ts';
import {
  musicStateParams,
  parseMusicState,
  trackSeconds,
} from '../../shells/web/src/lib/music-state.ts';

function base64(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 8192)
    result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(result);
}

export async function music(query: string, seconds: number) {
  const state = parseMusicState(query);
  const canonical = musicStateParams(state);
  const written = new URLSearchParams(canonical);
  for (const [key, value] of new URLSearchParams(query)) {
    if (written.get(key) !== value)
      throw new Error(`Recipe setting was not retained: ${key}=${value}`);
  }
  const pcm = await renderLofiTunePcm(
    { mood: state.mood, seed: state.seed, generator: canonical },
    { seconds, sampleRate: 48000 }
  );
  return {
    state,
    canonical,
    onceSeconds: trackSeconds(state),
    wav: base64(packWav({ channels: [pcm.left, pcm.right], sampleRate: pcm.sampleRate })),
  };
}

export function mount(html: string, css: string): void {
  document.body.innerHTML = html;
  let style = document.getElementById('study-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'study-style';
    document.head.append(style);
  }
  style.textContent = `${css}\nbody{margin:0}.artboard{margin:0!important}`;
}

export async function video(seconds: number) {
  const stage = document.querySelector<HTMLElement>('[data-sequence]');
  if (!stage) throw new Error('The authored Design document did not produce a timed artboard.');
  const blob = await renderSequence(stage, 'webm', {
    fps: 24,
    width: 960,
    height: 540,
    duration: seconds,
    durationUserSet: true,
  });
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  try {
    const picture = await input.getPrimaryVideoTrack();
    const sound = await input.getPrimaryAudioTrack();
    if (!picture || !sound) throw new Error('The output must contain both picture and audio.');
    const facts = {
      duration: await input.computeDuration(),
      width: picture.displayWidth,
      height: picture.displayHeight,
      videoCodec: picture.codec,
      audioCodec: sound.codec,
      bytes: blob.size,
    };
    if (Math.abs(facts.duration - seconds) > 0.2 || facts.width !== 960 || facts.height !== 540)
      throw new Error(`Unexpected output: ${JSON.stringify(facts)}`);
    return { facts, data: base64(new Uint8Array(await blob.arrayBuffer())) };
  } finally {
    input.dispose();
  }
}

Object.assign(window, { mediaStudy: { music, mount, video } });
declare global {
  interface Window {
    mediaStudy: { music: typeof music; mount: typeof mount; video: typeof video };
  }
}
