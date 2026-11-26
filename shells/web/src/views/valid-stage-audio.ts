// SPDX-License-Identifier: MPL-2.0
/**
 * Verify's stage for sound: the waveform of the whole file, with the player.
 *
 * The plain preview shows an icon and the browser's player. This draws what the
 * file sounds like over time, from the shell's own audio analysis, so a reader
 * sees silence, a splice or a clipped take before pressing play. A press on the
 * waveform moves the player there. A file the platform cannot decode keeps the
 * plain preview, with a note that no waveform could be read.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { t, tRaw } from '../i18n.ts';

const BUCKETS = 240;
const MAX_BYTES = 256 * 1024 * 1024;

const clock = (seconds: number): string => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** The waveform as one SVG path: a bar per bucket, mirrored about the centre line. Pure. */
export function waveformPath(peaks: ArrayLike<number>, width = 960, height = 160): string {
  const n = peaks.length;
  if (!n) return '';
  const step = width / n, mid = height / 2, bar = Math.max(1, step * 0.6);
  let d = '';
  for (let i = 0; i < n; i++) {
    const peak = Number.isFinite(peaks[i]) ? Math.min(1, Math.max(0, peaks[i]!)) : 0;
    const half = Math.max(0.5, peak * (mid - 2));
    const x = i * step + (step - bar) / 2;
    d += `M${x.toFixed(1)} ${(mid - half).toFixed(1)}h${bar.toFixed(1)}v${(half * 2).toFixed(1)}h-${bar.toFixed(1)}z`;
  }
  return d;
}

export interface WaveformFacts { duration: number; channels: number; bpm: number | null }

/**
 * The facts line under the waveform. A tempo is stated only when the analysis
 * found one. The sample rate is left out: the analysis reports the rate the
 * platform decoded at, which is not always the rate the file was saved at.
 */
export function waveformFacts(facts: WaveformFacts): string[] {
  const out = [clock(facts.duration)];
  if (facts.channels > 0) out.push(facts.channels === 1 ? t('Mono') : facts.channels === 2 ? t('Stereo') : tRaw('{n} channels', { n: facts.channels }));
  if (facts.bpm !== null && Number.isFinite(facts.bpm)) out.push(tRaw('About {n} beats a minute', { n: Math.round(facts.bpm) }));
  return out;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The waveform as elements: the plot is a button, the facts follow. Built with the DOM, so no markup is parsed. */
export function waveformElement(doc: Document, peaks: ArrayLike<number>, facts: WaveformFacts): HTMLElement {
  const wave = doc.createElement('div');
  wave.className = 'vf-wave';
  wave.dataset.waveDuration = String(facts.duration);
  const plot = doc.createElement('button');
  plot.type = 'button';
  plot.className = 'vf-wave-plot';
  plot.dataset.waveSeek = '';
  plot.setAttribute('aria-label', t('Waveform. Press to move the player there.'));
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 960 160');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const path = doc.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', waveformPath(peaks));
  svg.append(path);
  const head = doc.createElement('span');
  head.className = 'vf-wave-head';
  head.dataset.waveHead = '';
  head.hidden = true;
  plot.append(svg, head);
  const line = doc.createElement('p');
  line.className = 'vf-wave-facts';
  for (const fact of waveformFacts(facts)) {
    const item = doc.createElement('span');
    item.textContent = fact;
    line.append(item);
  }
  wave.append(plot, line);
  return wave;
}

/** Draw the waveform into every audio preview on a stage under `root` that has none yet. */
export function mountStageAudio(root: HTMLElement, host: Pick<HostV1, 'audio'>, fileAt: (index: number) => File | undefined): void {
  if (!host.audio) return;
  for (const figure of root.querySelectorAll<HTMLElement>('[data-stage-media] .valid-preview.is-audio:not([data-wave])')) {
    figure.dataset.wave = 'pending';
    const file = fileAt(Number(figure.dataset.previewFile));
    const art = figure.querySelector<HTMLElement>('.valid-audio-art');
    if (!file || !art || file.size > MAX_BYTES) { figure.dataset.wave = 'none'; continue; }
    void file.arrayBuffer()
      .then((bytes) => host.audio!.analyse(bytes, { buckets: BUCKETS, fps: 1, bands: 1 }))
      .then((analysis) => {
        if (!figure.isConnected) return;
        art.replaceWith(waveformElement(figure.ownerDocument, analysis.peaks, analysis));
        figure.dataset.wave = 'drawn';
      })
      .catch(() => {
        figure.dataset.wave = 'none';
        if (!figure.isConnected) return;
        const note = figure.ownerDocument.createElement('p');
        note.className = 'vf-wave-facts';
        note.textContent = t('This sound could not be read for a waveform. The player may still play the file.');
        art.after(note);
      });
  }
}

/** A press on a waveform moves its player; the player moves the playhead. */
export function wireStageAudio(root: HTMLElement): void {
  root.addEventListener('click', (event) => {
    const plot = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-wave-seek]') : null;
    const audio = plot?.closest('.valid-preview')?.querySelector('audio');
    if (!plot || !audio) return;
    const box = plot.getBoundingClientRect();
    const duration = Number(plot.closest<HTMLElement>('.vf-wave')?.dataset.waveDuration) || audio.duration;
    // A keyboard press has no position, so a press from the keyboard plays or pauses.
    if ((event as MouseEvent).detail === 0 || !box.width || !Number.isFinite(duration)) { void (audio.paused ? audio.play() : Promise.resolve(audio.pause())); return; }
    audio.currentTime = Math.min(duration, Math.max(0, ((event as MouseEvent).clientX - box.left) / box.width * duration));
  });
  root.addEventListener('timeupdate', (event) => {
    const audio = event.target instanceof HTMLAudioElement ? event.target : null;
    const wave = audio?.closest('.valid-preview')?.querySelector<HTMLElement>('.vf-wave');
    const head = wave?.querySelector<HTMLElement>('[data-wave-head]');
    const duration = Number(wave?.dataset.waveDuration) || audio?.duration || 0;
    if (!audio || !head || !duration) return;
    head.hidden = false;
    head.style.insetInlineStart = `${Math.min(100, audio.currentTime / duration * 100).toFixed(2)}%`;
  }, true);
}
