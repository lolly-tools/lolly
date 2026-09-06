// SPDX-License-Identifier: MPL-2.0
/**
 * #/convert - a verify-like on-device file converter. Drop a supported file, pick a
 * target format, convert in the browser (no upload), download. The engine codecs do
 * the work directly (a view CAN import the engine, unlike a tool hook): fonts via
 * sfntToWoff/woffToSfnt, SVG⇄SVGZ via gzip/gunzip, and any image → the whole raster
 * matrix by rasterising to a canvas and encoding it (png/jpeg/webp/avif via the
 * browser; bmp/tiff via the engine writers; pdf via jsPDF; ico wraps a PNG).
 *
 * Deliberately NOT via host.export.render: that path DOM-serialises an on-screen tool
 * canvas and stalls on a detached node - and we already hold the pixels, so encoding
 * them is both faster and reliable. Still a follow-on (plans/84): vector→vector
 * transcoding (svg→eps/dxf), archives, catalog "Download as", provenance on the output.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { fontConversionTargets, sniffContainer } from '@lolly/engine';
import { validateConvertFiles } from '../lib/file-conversion.ts';
import { mountConvertWorkbench } from './convert-workbench.ts';
import { confirmDialog } from '../components/confirm-dialog.ts';
import { renderFileOperationHistory } from './file-operation-history.ts';
// The AV column (plan 153 WP-H): the two FREE copy paths only - a lossless container
// rewrite (transmux) and a lossless audio stream-copy (extract). Both are byte-lossless
// and never re-encode; no transcode is offered here. mediabunny rides in lazily through
// these engines, so nothing here enters the preload bundle.
import { TRANSMUX_CONTAINERS, type TransmuxTarget } from '../lib/transmux.ts';
import type { ExtractAudioHost } from '../lib/extract-audio.ts';
import { t } from '../i18n.ts';
import { escape } from '../utils.ts';   // the single shared HTML escaper (R11) - never re-fork it
import { backHomeHtml, mountBackPill } from '../components/back-pill.ts';
import { langFabHtml, attachLangMenu } from '../components/lang-menu.ts';
import { mountHomeFab } from '../components/home-fab.ts';
import { mountThemeFab } from '../components/theme-toggle.ts';
import { mountProfileFab } from '../components/profile-menu.ts';
import '../styles/parts/platform.css';   // .platform-layout / .plat-header / .plat-title / .plat-sub
import '../styles/parts/convert.css';    // async CSS chunk (lazy view - not on the landing)

import { targetsFor, detectKind, sniffOfficeZip } from '../lib/convert-codecs.ts';
export { sourceToGrid, gridToTarget } from '../lib/convert-codecs.ts';
export type { Target } from '../lib/convert-codecs.ts';

// ── AV column: lossless copy paths only (plan 153 WP-H) ──────────────────────
// Two FREE, byte-lossless copies for an uploaded video: a container rewrite
// (transmux) and an audio stream-copy (extract). Neither decodes or re-encodes, so
// this is NOT a transcoder - the UI says so. Both ride the frozen engines
// (lib/transmux.ts, lib/extract-audio.ts) unchanged.

/** MP4 leads: where several containers are legal, MP4 is the safe default. */
const TRANSMUX_ORDER: TransmuxTarget[] = ['mp4', 'mov', 'mkv', 'webm'];

/** A video's container + track codecs, enough to gate the offered targets to exactly
 *  what transmuxContainer would accept. Codecs are kept as plain strings so the
 *  decision logic below stays free of mediabunny types (and testable without it). */
export interface VideoProbe {
  /** The source's own container, so a rewrite into it can be refused (nothing to do). */
  container: TransmuxTarget | null;
  hasVideo: boolean;
  videoCodec: string | null;
  audioCodecs: string[];
}

/**
 * Which transmux targets a probed video can be rewritten into, mirroring
 * transmuxContainer's own legality EXACTLY so we never offer a target the engine would
 * refuse with null: a target that IS the source container is dropped (nothing to copy);
 * a source that has a picture must keep it, so a target that cannot carry the video
 * codec is dropped; a source with no video needs at least one audio codec the target
 * can carry. `legal` is the per-container codec test (built from mediabunny's supported
 * lists in production, injected in the test). Pure, so the option logic is provable
 * without a real media file.
 */
export function transmuxTargetsFor(
  probe: VideoProbe,
  legal: (target: TransmuxTarget, kind: 'video' | 'audio', codec: string) => boolean,
): TransmuxTarget[] {
  return TRANSMUX_ORDER.filter((target) => {
    if (target === probe.container) return false;
    if (probe.hasVideo) return probe.videoCodec != null && legal(target, 'video', probe.videoCodec);
    return probe.audioCodecs.some((codec) => legal(target, 'audio', codec));
  });
}

/** Read a video's container + track codecs through mediabunny (lazy, so it never enters
 *  the preload bundle), plus the per-target codec-legality test each output format
 *  reports for itself. Null when the file cannot be read as one of the four containers
 *  the copy engines rewrite among - the caller then offers nothing. */
async function probeVideo(bytes: Uint8Array): Promise<
  { probe: VideoProbe; legal: (t: TransmuxTarget, kind: 'video' | 'audio', codec: string) => boolean } | null
> {
  let MB: typeof import('mediabunny');
  try { MB = await import('mediabunny'); } catch { return null; }
  let input: import('mediabunny').Input | null = null;
  try {
    // The same container set transmux.ts opens with, not ALL_FORMATS.
    input = new MB.Input({ formats: [MB.MP4, MB.QTFF, MB.WEBM, MB.MATROSKA], source: new MB.BlobSource(new Blob([bytes as BlobPart])) });
    if (!(await input.canRead())) return null;
    const fmt = await input.getFormat();
    // The source's own container id - the mapping transmux.ts uses internally, replicated
    // here because it isn't exported (WebM and MKV are distinct format singletons).
    const container: TransmuxTarget | null =
      fmt === MB.MP4 ? 'mp4' : fmt === MB.QTFF ? 'mov' : fmt === MB.WEBM ? 'webm' : fmt === MB.MATROSKA ? 'mkv' : null;
    let hasVideo = false;
    let videoCodec: string | null = null;
    const audioCodecs: string[] = [];
    for (const track of await input.getTracks()) {
      if (track.isVideoTrack()) { hasVideo = true; videoCodec ??= await track.getCodec(); }
      else if (track.isAudioTrack()) { const c = await track.getCodec(); if (c) audioCodecs.push(c); }
    }
    // Each output format is the authority on the codecs it can carry, exactly as
    // transmuxContainer checks - so the offered set can never drift from what a rewrite
    // would actually accept.
    const support = new Map<TransmuxTarget, { video: Set<string>; audio: Set<string> }>();
    for (const tgt of TRANSMUX_ORDER) {
      const f: import('mediabunny').OutputFormat =
        tgt === 'mp4' ? new MB.Mp4OutputFormat()
          : tgt === 'mov' ? new MB.MovOutputFormat()
            : tgt === 'mkv' ? new MB.MkvOutputFormat()
              : new MB.WebMOutputFormat();
      support.set(tgt, { video: new Set<string>(f.getSupportedVideoCodecs()), audio: new Set<string>(f.getSupportedAudioCodecs()) });
    }
    const legal = (t: TransmuxTarget, kind: 'video' | 'audio', codec: string): boolean =>
      (kind === 'video' ? support.get(t)!.video : support.get(t)!.audio).has(codec);
    return { probe: { container, hasVideo, videoCodec, audioCodecs }, legal };
  } catch {
    return null;
  } finally {
    try { input?.dispose(); } catch { /* best-effort resource release */ }
  }
}

/** The AV column: probe the video, then offer the legal container rewrites (MP4 first)
 *  and, when it has a sound track, Extract audio. Both are on-device lossless copies. */
async function renderVideo(result: HTMLElement, bytes: Uint8Array, file: File, host: HostV1): Promise<void> {
  result.hidden = false;
  result.innerHTML = `<p class="convert-status">${t('Reading the video…')}</p>`;
  const probed = await probeVideo(bytes);
  if (!probed) {
    result.innerHTML = `<p class="convert-none">${t('No on-device conversion is available for')} <b>${escape(file.name)}</b> ${t('yet')}.</p>`;
    return;
  }
  const { probe, legal } = probed;
  const muxTargets = transmuxTargetsFor(probe, legal);
  const canExtract = probe.audioCodecs.length > 0;
  if (!muxTargets.length && !canExtract) {
    result.innerHTML = `<p class="convert-none">${t('No on-device conversion is available for')} <b>${escape(file.name)}</b> ${t('yet')}.</p>`;
    return;
  }
  const muxBtns = muxTargets.map((tt) =>
    `<button type="button" class="btn convert-target" data-mux="${tt}">${t('Container')}: ${TRANSMUX_CONTAINERS[tt].ext.toUpperCase()} (.${TRANSMUX_CONTAINERS[tt].ext})</button>`).join('');
  const extractBtn = canExtract ? `<button type="button" class="btn convert-target" data-extract>${t('Extract audio…')}</button>` : '';
  result.innerHTML = `<p class="convert-file"><b>${escape(file.name)}</b> - ${t('convert to')}:</p>
    <div class="convert-targets">${muxBtns}${extractBtn}</div>
    <p class="convert-note">${t('Container changes and audio extraction copy supported media tracks without re-encoding, on your device. Processing time depends on file size. Container metadata may change; video transcoding is not offered here.')}</p>
    <p class="convert-status" data-status></p>`;
  const status = result.querySelector<HTMLElement>('[data-status]')!;

  // Container rewrite - download the lossless copy the engine produced. No provenance
  // stamp: no convert download path stamps today, and transmux writes a fresh container
  // (see provenance_flags - whether to carry a source credential forward is a new
  // decision, not made here).
  result.querySelectorAll<HTMLButtonElement>('[data-mux]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const target = btn.dataset.mux as TransmuxTarget;
      btn.disabled = true; status.textContent = t('Converting…');
      try {
        const { describeFile, runWebFileOperation } = await import('../lib/file-operation-adapter.ts');
        const { localFileOperations } = await import('../lib/file-operation-store.ts');
        const { runSavedFileOperation } = await import('../lib/saved-file-operation.ts');
        const request = { version: 1 as const, operation: 'media.transmux', target, options: {} };
        const outcome = await runSavedFileOperation(file, request, { store: localFileOperations, describe: describeFile, execute: runWebFileOperation });
        window.dispatchEvent(new Event('lolly:file-operations-changed'));
        if (!outcome.output) throw new Error(outcome.report.findings.find(f => f.severity === 'error')?.message || t('Conversion failed.'));
        status.textContent = t('Copy saved in Recent file operations below. Review its report, then download it.');
      } catch (e) {
        status.textContent = (e as Error).message || t('Conversion failed.');
      } finally {
        btn.disabled = false;
      }
    });
  });

  // Extract audio - reuse the catalog dialog UNCHANGED (its own format picker, WP-F
  // background job, and the c2pa.edited + source-video-as-ingredient stamp). It saves a
  // derived audio asset to the catalog rather than downloading, and says so itself.
  result.querySelector<HTMLButtonElement>('[data-extract]')?.addEventListener('click', async () => {
    const { openExtractAudioDialog } = await import('../lib/extract-audio.ts');
    await openExtractAudioDialog(host as unknown as ExtractAudioHost, {
      source: new Blob([bytes as BlobPart], { type: file.type || 'video/mp4' }),
      sourceName: file.name,
    });
    status.textContent = t('Audio extraction started - it will appear in your catalog when it’s done.');
  });
}

export async function mountConvert(viewEl: HTMLElement, host: HostV1, _params = ''): Promise<void> {
  document.title = 'Convert - Lolly';
  viewEl.innerHTML = `
    ${backHomeHtml()}
    <div class="gallery-topright">${langFabHtml()}</div>
    <div class="platform-layout convert-view">
      <header class="plat-header">
        <h1 class="plat-title">${t('Convert')}</h1>
        <p class="plat-sub">${t('A better fit for wherever your file goes next. Convert, resize and check your copy - all on your device.')}</p>
      </header>
      <div class="convert-drop" data-drop tabindex="0" role="button" aria-label="${t('Drop a file to convert')}">
        <p>${t('Drop a file to get started, or a batch of images.')}</p>
        <button type="button" class="btn" data-pick>${t('Choose files…')}</button>
        <small>${t('Images, fonts, video, documents & data · up to 20 files · 128 MB per file')}</small>
        <input type="file" hidden multiple data-file accept=".ttf,.otf,.woff,.woff2,.svg,.svgz,image/*,video/*,.mp4,.mov,.mkv,.webm,.pdf,.pptx,.docx,.xlsx,.csv,.tsv,.json">
      </div>
      <div class="convert-result" data-result hidden></div>
      <section class="convert-result convert-history" data-history aria-label="${t('Recent file operations')}"></section>
    </div>`;
  // Reached as a tile OR a deep link - so it carries the full escape chrome (back
  // pill + always-home) rather than dead-ending anyone sent straight here, plus
  // the language + theme FABs in the same top-right cluster.
  mountBackPill(viewEl);
  mountHomeFab(viewEl);
  mountThemeFab(viewEl.querySelector('.gallery-topright'), host);
  mountProfileFab(viewEl.querySelector('.gallery-topright'), host);
  attachLangMenu(viewEl.querySelector<HTMLElement>('.lang-fab'), host);
  const drop = viewEl.querySelector<HTMLElement>('[data-drop]')!;
  const fileInput = viewEl.querySelector<HTMLInputElement>('[data-file]')!;
  const result = viewEl.querySelector<HTMLElement>('[data-result]')!;
  const history = viewEl.querySelector<HTMLElement>('[data-history]')!;
  const refreshHistory = (): void => { void renderFileOperationHistory(history, host); };
  window.addEventListener('lolly:file-operations-changed', refreshHistory);
  refreshHistory();
  let generation = 0;
  let cleanupWorkbench: (() => void) | undefined;
  const observer = new MutationObserver(() => {
    if (!viewEl.contains(result) || !viewEl.isConnected) { generation++; cleanupWorkbench?.(); window.removeEventListener('lolly:file-operations-changed', refreshHistory); observer.disconnect(); }
  });
  observer.observe(viewEl.parentNode ?? viewEl, { childList: true, subtree: true });

  viewEl.querySelector('[data-pick]')?.addEventListener('click', () => fileInput.click());
  drop.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('button,input')) return; fileInput.click(); });
  drop.addEventListener('keydown', (e) => { if (e.target === drop && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fileInput.click(); } });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault(); drop.classList.remove('is-over');
    const files = Array.from(e.dataTransfer?.files ?? []); if (files.length) void onFiles(files);
  });
  fileInput.addEventListener('change', () => { const files = Array.from(fileInput.files ?? []); fileInput.value = ''; if (files.length) void onFiles(files); });

  async function onFiles(files: File[]): Promise<void> {
    const current = ++generation;
    if (result.querySelector('.convert-output')) {
      const confirmed = await confirmDialog({ title: t('Start a new batch?'), message: t('Completed copies remain in Recent file operations on this device. Your originals are never changed.'), confirmLabel: t('Start new batch'), danger: false });
      if (!confirmed || current !== generation) return;
    }
    cleanupWorkbench?.(); cleanupWorkbench = undefined;
    result.hidden = false;
    result.innerHTML = `<p role="status">${t('Reading your files…')}</p>`;
    try {
      validateConvertFiles(files);
      const sources = [];
      for (const file of files) {
        const bytes = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
        if (current !== generation) return;
        let kind = detectKind(bytes, file);
        if (kind === 'unknown' && sniffContainer(bytes) === 'zip') kind = await sniffOfficeZip(new Uint8Array(await file.arrayBuffer()));
        if (current !== generation) return;
        if (kind === 'video' && files.length === 1) {
          const videoResult = document.createElement('div');
          await renderVideo(videoResult, new Uint8Array(await file.arrayBuffer()), file, host);
          if (current === generation) result.replaceChildren(videoResult);
          return;
        }
        if (files.length > 1 && !['raster', 'svg', 'svgz'].includes(kind)) throw new Error('Batch conversion currently supports images. Choose one font, video, document or data file at a time.');
        const legalFonts = fontConversionTargets(bytes);
        const targets = targetsFor(kind).filter(target => target.id !== kind && (!['ttf', 'otf', 'woff'].includes(kind) || legalFonts.includes(target.id as 'ttf' | 'otf' | 'woff')));
        if (!targets.length) throw new Error(`No on-device conversion is available for ${file.name} yet. The original has not been changed.`);
        sources.push({ bytes, file, kind, targets });
      }
      if (current !== generation) return;
      cleanupWorkbench = mountConvertWorkbench(result, sources, host);
      drop.classList.add('has-files');
    } catch (error) {
      if (current !== generation) return;
      result.innerHTML = '<p class="convert-error" role="alert"></p>';
      result.firstElementChild!.textContent = error instanceof Error ? error.message : t('Could not read that file.');
    }
  }

  // Dolphin's direct Convert verb arrives through the desktop event queue. The
  // view owns all sniffing/target selection, so consume the same File the picker
  // would have produced instead of growing a native-only converter path.
  const { takePendingConvertFile } = await import('../lib/drop-router.ts');
  const pending = takePendingConvertFile();
  if (pending) await onFiles([pending]);
}

