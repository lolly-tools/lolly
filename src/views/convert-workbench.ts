// SPDX-License-Identifier: MPL-2.0
/** File-first conversion UI. Codec work stays in the shared converter adapter. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { allocateFileName, type FileOperationReportV1 } from '@lolly-tools/core/file-v1';
import { imageDimensions, sniffAnimatedRaster, storeZip } from '@lolly/engine';
import { DEFAULT_IMAGE_OPTIONS, conversionFindings, resizedDimensions, type ImageConversionOptions } from '../lib/file-conversion.ts';
import { fmtBytes } from '../lib/format.ts';
import { escape as escapeHtml } from '../utils.ts';
import { t } from '../i18n.ts';
import { requestSaveAsNext, saveFilePickerSupported } from '../bridge/export-save-picker.ts';
import type { Target } from './convert.ts';
import { fileBatchReportV1, type FileOperationRequestV1 } from '@lolly-tools/core/file-operation-v1';
import { runWebFileOperation, describeFile } from '../lib/file-operation-adapter.ts';
import { localFileOperations } from '../lib/file-operation-store.ts';
import { runSavedFileOperation } from '../lib/saved-file-operation.ts';
import { attachFileResultActions } from './file-result-actions.ts';

export interface ConvertSource { file: File; bytes: Uint8Array; kind: string; targets: Target[] }
interface Completed { blob: Blob; name: string; report: FileOperationReportV1; operationId: string }

export function mountConvertWorkbench(root: HTMLElement, sources: ConvertSource[], host: HostV1): () => void {
  const first = sources[0]!;
  const imageSource = sources.every(s => ['raster', 'svg', 'svgz'].includes(s.kind));
  const targets = first.targets.filter(target => sources.every(s => s.targets.some(t => t.id === target.id)));
  const urls = new Set<string>();
  let active = true, running = false;
  let completed: Completed[] = [];
  let controller = new AbortController();
  const reports: FileOperationReportV1[] = [];
  const urlFor = (blob: Blob): string => { const url = URL.createObjectURL(blob); urls.add(url); return url; };
  const cleanup = (): void => { active = false; controller.abort(); for (const url of urls) URL.revokeObjectURL(url); urls.clear(); completed = []; };
  if (!targets.length) {
    root.innerHTML = `<p>${t('These files do not share a supported conversion. Choose a single file or a batch of images.')}</p>`;
    return cleanup;
  }
  // Refuse destructive animation flattening before the user invests in settings.
  if (sources.some(s => s.kind === 'raster' && sniffAnimatedRaster(s.bytes, { name: s.file.name, mime: s.file.type }))) {
    root.innerHTML = `<p role="status">${t('This selection contains an animated image. Still-image conversion would lose its animation. Choose still images; the originals have not been changed.')}</p>`;
    return cleanup;
  }
  const dimensions = imageSource ? imageDimensions(first.bytes, first.file.type) : null;
  if (dimensions) resizedDimensions(dimensions.w, dimensions.h);
  const sourcePreview = imageSource && first.kind !== 'svgz'
    ? `<img src="${urlFor(first.file)}" alt="${t('Original file preview')}">`
    : `<span class="convert-file-icon" aria-hidden="true">${escapeHtml(first.kind.toUpperCase())}</span>`;
  const defaultTarget = imageSource ? targets.find(t => t.id === 'png') ?? targets[0]! : targets[0]!;
  root.innerHTML = `
    <div class="convert-workbench">
      <section class="convert-source" aria-label="${t('Original file')}">
        <div class="convert-preview">${sourcePreview}</div>
        <p class="convert-eyebrow">${t('Original · unchanged')}</p>
        <h2 class="convert-name">${escapeHtml(first.file.name)}</h2>
        <p class="convert-facts">${fmtBytes(first.file.size)}${dimensions ? ` · ${dimensions.w} × ${dimensions.h} px` : ''}${sources.length > 1 ? ` · ${sources.length} ${t('files selected')}` : ''}</p>
        ${sources.length > 1 ? `<details class="convert-file-list"><summary>${t('See selected files')}</summary><ul>${sources.map(s => `<li>${escapeHtml(s.file.name)} <span>${fmtBytes(s.file.size)}</span></li>`).join('')}</ul></details>` : ''}
      </section>
      <section class="convert-settings" aria-label="${t('Conversion settings')}">
        <p class="convert-eyebrow">${t('Make a useful copy')}</p>
        <h2>${t('What do you need?')}</h2>
        ${imageSource ? `<div class="convert-presets" role="group" aria-label="${t('Quick presets')}">
          <button type="button" class="btn" data-preset="png"><strong>${t('Keep detail')}</strong><span>${t('PNG · original size')}</span></button>
          <button type="button" class="btn" data-preset="webp"><strong>${t('Smaller for the web')}</strong><span>${t('WebP · up to 1920 px')}</span></button>
          <button type="button" class="btn" data-preset="jpeg"><strong>${t('Easy to share')}</strong><span>${t('JPEG · up to 2400 px')}</span></button>
        </div>` : ''}
        <label class="convert-field">${t('Output format')}<select data-format>${targets.map(target => `<option value="${target.id}" ${target === defaultTarget ? 'selected' : ''}>${target.label}</option>`).join('')}</select></label>
        ${imageSource ? `<details class="convert-advanced"><summary>${t('Size, quality & background')}</summary>
          <div class="convert-options">
            <label class="convert-field">${t('Longest edge (px)')}<input data-edge type="number" min="0" max="16384" step="1" value="0"><small>${t('0 keeps the original size. Never enlarged; proportions stay the same.')}</small></label>
            <label class="convert-field">${t('Quality')} <span data-quality-value>92%</span><input data-quality type="range" min="10" max="100" value="92"><small data-quality-note></small></label>
            <label class="convert-field">${t('Target file size (KB)')}<input data-target-bytes type="number" min="0" max="131072" step="1" value="0"><small>${t('0 means no target. Quality may be lowered to fit; unreachable targets fail without changing your original.')}</small></label>
            <label class="convert-field" data-background-field>${t('Transparency background')}<input data-background type="color" value="#ffffff"><small>${t('Used for JPEG only. Other image formats keep transparency where supported.')}</small></label>
          </div>
        </details>` : ''}
        <div class="convert-notes" data-notes></div>
        <div class="convert-actions"><button class="btn btn--primary" type="button" data-convert>${sources.length > 1 ? t('Convert files') : t('Create copy')}</button><button class="btn" type="button" data-stop hidden>${t('Cancel operation')}</button></div>
        <p class="convert-status" role="status" aria-live="polite" data-status>${t('On this device. Your original files are never overwritten.')}</p>
      </section>
    </div>
    <section class="convert-completed" data-completed hidden aria-label="${t('Converted files')}">
      <div class="convert-completed-heading"><div><p class="convert-eyebrow">${t('Ready to use')}</p><h2>${t('Your converted files')}</h2></div><button type="button" class="btn" data-zip hidden>${t('Download all as ZIP')}</button></div>
      <p class="convert-retention">${t('Completed copies are saved in Recent file operations on this device, including after a reload. Originals are not retained.')}</p>
      <button class="btn" type="button" data-batch-report>${t('Download batch report')}</button>
      <div data-outputs></div>
    </section>`;
  const format = root.querySelector<HTMLSelectElement>('[data-format]')!;
  const edge = root.querySelector<HTMLInputElement>('[data-edge]');
  const quality = root.querySelector<HTMLInputElement>('[data-quality]');
  const background = root.querySelector<HTMLInputElement>('[data-background]');
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  const button = root.querySelector<HTMLButtonElement>('[data-convert]')!;
  const stopButton = root.querySelector<HTMLButtonElement>('[data-stop]')!;
  const outputList = root.querySelector<HTMLElement>('[data-outputs]')!;
  const zipButton = root.querySelector<HTMLButtonElement>('[data-zip]')!;
  const setStatus = (value: string): void => { if (active) status.textContent = value; };
  const showNotes = (): void => {
    root.querySelector<HTMLElement>('[data-notes]')!.innerHTML = conversionFindings(first.kind, format.value).map(f => `<p>${escapeHtml(t(f.message))}</p>`).join('');
    const lossy = ['jpeg', 'webp', 'avif'].includes(format.value);
    if (quality) quality.disabled = !lossy;
    const note = root.querySelector<HTMLElement>('[data-quality-note]');
    if (note) note.textContent = lossy ? t('Higher keeps more detail. File size depends on the image.') : t('This format does not use the quality slider.');
    if (background) background.disabled = format.value !== 'jpeg';
    root.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(b => {
      const id = b.dataset.preset;
      const presetEdge = id === 'webp' ? 1920 : id === 'jpeg' ? 2400 : 0;
      const presetQuality = id === 'webp' ? 82 : 92;
      b.setAttribute('aria-pressed', String(id === format.value && Number(edge?.value || 0) === presetEdge && (id === 'png' || Number(quality?.value) === presetQuality)));
    });
  };
  format.addEventListener('change', showNotes);
  quality?.addEventListener('input', () => { root.querySelector('[data-quality-value]')!.textContent = `${quality.value}%`; showNotes(); });
  edge?.addEventListener('input', showNotes);
  root.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(preset => { preset.addEventListener('click', () => {
    format.value = preset.dataset.preset!;
    if (edge) edge.value = format.value === 'webp' ? '1920' : format.value === 'jpeg' ? '2400' : '0';
    if (quality) { quality.value = format.value === 'webp' ? '82' : '92'; quality.dispatchEvent(new Event('input')); }
    showNotes();
  }); });
  showNotes();
  stopButton.addEventListener('click', () => { controller.abort(); stopButton.disabled = true; setStatus(t('Cancelling. Background image encoding stops immediately; other codecs stop at their next safe boundary. Completed files remain available.')); });

  function appendOutput(item: Completed): void {
    root.querySelector<HTMLElement>('[data-completed]')!.hidden = false;
    const facts = item.report.outputs[0]!;
    const input = item.report.inputs[0]!;
    const delta = input.size ? Math.round((1 - facts.size / input.size) * 100) : 0;
    const card = document.createElement('article'); card.className = 'convert-output';
    const preview = /^image\/(png|jpeg|webp|avif|svg\+xml)$/.test(item.blob.type) && facts.format !== 'svgz';
    card.innerHTML = `${preview ? `<div class="convert-output-preview"><img src="${urlFor(item.blob)}" alt="${t('Converted file preview')}"></div>` : ''}
      <div class="convert-output-info"><h3>${escapeHtml(item.name)}</h3><p>${fmtBytes(item.blob.size)}${facts.width ? ` · ${facts.width} × ${facts.height} px` : ''} · ${delta >= 0 ? `${delta}% ${t('smaller')}` : `${-delta}% ${t('larger')}`}</p>
      <div class="convert-actions"><button class="btn btn--primary" type="button" data-download>${t('Download')}</button>${saveFilePickerSupported() ? `<button class="btn" type="button" data-save>${t('Save as…')}</button>` : ''}<button class="btn" type="button" data-report>${t('Download report')}</button><button class="btn" type="button" data-share hidden>${t('Share…')}</button></div>
      <details class="convert-receipt"><summary>${t('What changed?')}</summary><ul>${item.report.changes.map(change => `<li>${escapeHtml(change)}</li>`).join('')}</ul><p>${t('Source and output SHA-256 hashes are included in the JSON report.')}</p><code>${escapeHtml(facts.sha256 ?? '')}</code></details></div>`;
    const deliver = async (saveAs = false): Promise<void> => {
      try { if (saveAs) requestSaveAsNext(); await host.export.download(item.blob, item.name); setStatus(t('File handed to your device’s save/download flow.')); }
      catch (error) { setStatus(error instanceof Error ? error.message : t('Could not save that file. Try again.')); }
    };
    card.querySelector('[data-download]')!.addEventListener('click', () => { void deliver(); });
    card.querySelector('[data-save]')?.addEventListener('click', () => { void deliver(true); });
    card.querySelector('[data-report]')!.addEventListener('click', () => {
      void host.export.download(new Blob([JSON.stringify(item.report, null, 2)], { type: 'application/json' }), `${item.name}.report.json`).catch(error => setStatus(String(error)));
    });
    const share = card.querySelector<HTMLButtonElement>('[data-share]')!;
    const shareFile = new File([item.blob], item.name, { type: item.blob.type });
    if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [shareFile] })) {
      share.hidden = false;
      share.addEventListener('click', () => {
        // No asynchronous conversion before this call: preserve the mobile user gesture.
        void navigator.share({ files: [shareFile] }).catch(error => { if (error?.name !== 'AbortError') setStatus(t('Sharing failed. You can still download the file.')); });
      });
    }
    attachFileResultActions(card.querySelector<HTMLElement>('.convert-output-info')!, item.operationId, facts, host, setStatus);
    outputList.append(card);
    zipButton.hidden = completed.length < 2;
  }

  button.addEventListener('click', async () => {
    if (running) return;
    if (reports.length + sources.length > 200) { setStatus(t('This report has reached 200 operations. Download it, then choose files again to start a new report.')); return; }
    const options: ImageConversionOptions = { ...DEFAULT_IMAGE_OPTIONS, maxEdge: Number(edge?.value || 0), quality: Number(quality?.value || 92) / 100, background: background?.value || '#ffffff', targetBytes: Number(root.querySelector<HTMLInputElement>('[data-target-bytes]')?.value || 0) * 1024 };
    try { resizedDimensions(1, 1, options.maxEdge); } catch (e) { setStatus((e as Error).message); return; }
    // Keep prior results: a failed experiment must not discard a successful copy.
    const reserved = new Set(completed.map(item => item.name.normalize('NFC').toLowerCase()));
    const target = targets.find(target => target.id === format.value)!;
    running = true; controller = new AbortController();
    const controls = Array.from(root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('.convert-settings input, .convert-settings select, .convert-settings button'));
    controls.forEach(control => { control.disabled = true; });
    stopButton.hidden = false; stopButton.disabled = false;
    let succeeded = 0, failed = 0, cancelled = 0;
    const request: FileOperationRequestV1 = { version: 1, operation: 'convert', target: target.id, options: { ...options } };
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let batchWarning = '';
    try {
      const store = await localFileOperations();
      // Persist ALL selected members before hashing, reserving or encoding any file.
      const batch = await store.batches.create(sources.map(source => ({ file: source.file,
        outputName: allocateFileName(`${source.file.name.replace(/\.[^.]+$/, '') || 'converted'}.${target.ext}`, reserved),
      })), request);
      heartbeat = setInterval(() => { void store.batches.heartbeat(batch.id).catch(() => {}); }, 30_000);
      for (let i = 0; i < sources.length; i++) {
        const source = sources[i]!;
        if (!controller.signal.aborted) {
          setStatus(`${t('Converting')} ${i + 1}/${sources.length}: ${source.file.name}`);
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        }
        const member = batch.members[i]!;
        const name = member.outputName;
        const link = { batchId: batch.id, operationId: member.operationId };
        const outcome = await runSavedFileOperation(source.file, request, {
          store: async () => store, describe: describeFile, execute: runWebFileOperation,
        }, controller.signal, name, link);
        try { await store.batches.complete(link, outcome.report); }
        catch (error) { batchWarning = `${t('The batch summary could not be saved:')} ${String(error)}. ${t('Download the report below. Saved individual results are still available.')}`; }
        // Exactly one report per selected file, including unread, unstarted members.
        // Success is recorded only AFTER persistence, never on encoder success alone.
        reports.push(outcome.report);
        window.dispatchEvent(new Event('lolly:file-operations-changed'));
        if (outcome.report.state === 'cancelled') cancelled++;
        else if (!outcome.output) failed++;
        else {
          succeeded++;
          if (active) {
            const item = { blob: outcome.output, name: outcome.output.name, report: outcome.report, operationId: member.operationId };
            completed.push(item); appendOutput(item);
          }
        }
        if (active && !outcome.output && outcome.report.state !== 'cancelled') {
          const issue = document.createElement('p'); issue.className = 'convert-error'; issue.setAttribute('role', 'alert');
          issue.textContent = `${source.file.name}: ${outcome.report.findings.find(f => f.severity === 'error')?.message || t('Conversion failed.')} ${t('Original unchanged.')}`;
          outputList.append(issue);
        }
      }
      if (active) root.querySelector<HTMLElement>('[data-completed]')!.hidden = false;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t('Could not start the batch. No files were changed.'));
      return;
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      running = false;
      if (active) { controls.forEach(control => { control.disabled = false; }); showNotes(); stopButton.hidden = true; }
    }
    if (!active) return;
    setStatus(`${succeeded} ${t('ready')}${failed ? ` · ${failed} ${t('failed')}` : ''}${cancelled ? ` · ${cancelled} ${t('cancelled')}` : ''}. ${batchWarning || t('Review your copies below, then download or share.')}`);
    if (succeeded) root.querySelector<HTMLElement>('[data-completed]')?.scrollIntoView({ behavior: 'auto', block: 'nearest' });
  });
  root.querySelector('[data-batch-report]')!.addEventListener('click', () => { void host.export.download(new Blob([JSON.stringify(fileBatchReportV1(reports), null, 2)], { type: 'application/json' }), 'conversion-batch.report.json').catch(error => setStatus(String(error))); });
  zipButton.addEventListener('click', async () => {
    zipButton.disabled = true;
    try {
      if (completed.reduce((total, item) => total + item.blob.size, 0) > 128 * 1024 * 1024) throw new Error(t('This ZIP exceeds the 128 MB in-memory packaging limit. Download files individually.'));
      const entries = [];
      for (const item of completed) entries.push({ name: item.name, bytes: new Uint8Array(await item.blob.arrayBuffer()) });
      await host.export.download(new Blob([storeZip(entries) as BlobPart], { type: 'application/zip' }), 'converted-files.zip');
    } catch (error) { setStatus(error instanceof Error ? error.message : t('Could not create the ZIP. Download files individually.')); }
    finally { if (active) zipButton.disabled = false; }
  });
  return cleanup;
}
