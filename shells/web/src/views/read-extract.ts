// SPDX-License-Identifier: MPL-2.0
/**
 * Read and extract (#/extract, plan 203 rank 10): the words, tables and pictures of
 * a PowerPoint deck, a PDF or a Photoshop file, page by page, on this device.
 *
 * The file is read once into a content inventory (lib/read-extract-source.ts, the
 * same readers `lolly read` uses), and every change to the page range, the
 * character budget or the confidence floor projects that inventory again with the
 * engine's `readExtract`, so nothing is read twice. Each block says where its
 * words came from: written in the file, the text layer a scan carries, or text
 * recognition on this device, with the model that read it and how sure it was.
 * The source wording is shown as it is.
 *
 * A page that is a picture of its text is offered "Read the text": the model is
 * asked for in place (lib/model-offer.ts), then the pages are read as one heavy job
 * whose toast owns progress and cancel, and the file is read again with the
 * recogniser. The budget works like the CLI's: the extract stops before the block
 * that would pass it and "Continue" reads on from there.
 *
 * Nothing leaves the device and nothing the file carries is run: macros, scripts
 * and embedded files are reported in the notes, never opened.
 */

import '../styles/parts/read-extract.css'; // async CSS chunk (lazy view)
import type { ExtractBlockV1, ReadExtractV1 } from '@lolly-tools/core';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { extractMarkdown, extractPlainText, readExtract, ReadExtractError } from '../../../../engine/src/read-extract.ts';
import { escape as escapeHtml } from '../utils.ts';
import { icon } from '../lib/icons.ts';
import { announce } from '../a11y.ts';
import { t, tRaw } from '../i18n.ts';
import { armViewEnter } from '../view-enter.ts';
import { langFabHtml, attachLangMenu } from '../components/lang-menu.ts';
import { backHomeHtml, mountBackPill } from '../components/back-pill.ts';
import { mountHomeFab } from '../components/home-fab.ts';
import { mountThemeFab } from '../components/theme-toggle.ts';
import { mountProfileFab } from '../components/profile-menu.ts';
import type { JobHandle } from '../lib/jobs.ts';
import { OCR_DEFAULT_MODEL } from '../lib/ocr-models.ts';
import {
  hostRecogniser, readExtractSource, ReadExtractSourceError, READ_EXTRACT_MAX_BYTES, READ_EXTRACT_MAX_PICTURE_PIXELS,
  type ExtractPicturePixelsV1, type ExtractRecogniserV1, type ReadExtractSourceResultV1,
} from '../lib/read-extract-source.ts';

/** The bounds the person set, as typed. */
export interface ExtractControls {
  pages: string;
  maxChars: string;
  minConfidence: string;
}

/** A confidence as a whole percentage. */
const percent = (n: number): string => `${Math.round(n * 100)}%`;

/** Where a block's words came from, in words, with the model and confidence for a recognised block. */
export function originLine(block: ExtractBlockV1): string {
  if (block.origin === 'recognized' && block.recognition) {
    const model = block.recognition.modelVersion ? `${block.recognition.model} ${block.recognition.modelVersion}` : block.recognition.model;
    return tRaw('Read by text recognition ({model}), confidence {confidence}, lowest line {lowest}', {
      model, confidence: percent(block.recognition.confidence), lowest: percent(block.recognition.minConfidence),
    });
  }
  if (block.origin === 'text-layer') return tRaw('From the text layer the scan carries');
  if (block.origin === 'authored') return tRaw('Written in the file');
  return '';
}

/** What the person's bounds ask `readExtract` for. Blank fields ask for nothing. */
export function extractOptions(controls: ExtractControls, from?: string): Parameters<typeof readExtract>[1] {
  const opts: NonNullable<Parameters<typeof readExtract>[1]> = {};
  if (controls.pages.trim()) opts.pages = controls.pages.trim();
  if (controls.maxChars.trim()) opts.maxChars = Number(controls.maxChars.trim());
  if (controls.minConfidence) opts.minConfidence = Number(controls.minConfidence);
  if (from) opts.from = from;
  return opts;
}

function blockHtml(block: ExtractBlockV1, pictureUrl: (ref: string) => string | null): string {
  const origin = originLine(block);
  const meta = origin ? `<p class="rx-meta">${escapeHtml(origin)}${block.partial ? ` · ${escapeHtml(t('Cut short by the budget'))}` : ''}</p>` : '';
  if (block.kind === 'table' && block.rows) {
    const rows = block.rows.map((row, r) => `<tr>${row.map((cell) => (r === 0 ? `<th scope="col">${escapeHtml(cell)}</th>` : `<td>${escapeHtml(cell)}</td>`)).join('')}</tr>`).join('');
    return `<div class="rx-block rx-block--table"><table class="rx-table">${rows}</table></div>`;
  }
  if (block.kind === 'picture' && block.picture) {
    const url = pictureUrl(block.picture.ref);
    const caption = block.text ? escapeHtml(block.text) : escapeHtml(t('The file gives this picture no description.'));
    return `<figure class="rx-block rx-block--picture">${url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(block.text)}" loading="lazy">` : ''}<figcaption>${caption}</figcaption></figure>`;
  }
  if (block.kind === 'notes') {
    return `<aside class="rx-block rx-block--notes"><h4>${escapeHtml(t('Speaker notes'))}</h4><p class="rx-text">${escapeHtml(block.text)}</p></aside>`;
  }
  if (block.kind === 'chart') {
    return `<div class="rx-block rx-block--chart"><pre class="rx-text">${escapeHtml(block.text)}</pre></div>`;
  }
  const role = block.role === 'title' ? ' rx-block--title' : '';
  return `<div class="rx-block rx-block--text${role}" data-origin="${escapeHtml(block.origin ?? 'authored')}"><p class="rx-text">${escapeHtml(block.text)}</p>${meta}</div>`;
}

/** The extract as page sections. `pictureUrl` gives an object URL for a held picture, or null. */
export function renderExtractHtml(extract: ReadExtractV1, pictureUrl: (ref: string) => string | null): string {
  const pages = extract.pages.map((page) => {
    const blocks = extract.blocks.filter((b) => b.page === page.number);
    let chip = '';
    if (page.scanned) {
      const read = page.read === 'recognized' ? t('a scan, read by text recognition')
        : page.read === 'text-layer' ? t('a scan with its own text layer')
          : t('a scan whose words were not read');
      chip = ` <span class="rx-chip" data-read="${escapeHtml(page.read ?? 'not-read')}">${escapeHtml(read)}</span>`;
    }
    const body = blocks.length ? blocks.map((b) => blockHtml(b, pictureUrl)).join('') : `<p class="rx-empty">${escapeHtml(t('Nothing on this page in this extract.'))}</p>`;
    return `<section class="rx-page" aria-label="${escapeHtml(tRaw('Page {n}', { n: page.number }))}"><h3 class="rx-page-title">${escapeHtml(tRaw('Page {n}', { n: page.number }))}${chip}</h3>${body}</section>`;
  });
  return pages.join('');
}

/** Decode a held picture with the browser's own decoder, through a canvas. Null when it cannot. */
async function decodeWithCanvas(bytes: Uint8Array, mime: string): Promise<ExtractPicturePixelsV1 | null> {
  if (typeof createImageBitmap !== 'function') return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: mime }));
  } catch {
    return null;
  }
  try {
    const { width, height } = bitmap;
    if (width * height > READ_EXTRACT_MAX_PICTURE_PIXELS) return null;
    if (typeof OffscreenCanvas === 'function') {
      const context = new OffscreenCanvas(width, height).getContext('2d');
      if (!context) return null;
      context.drawImage(bitmap, 0, 0);
      return context.getImageData(0, 0, width, height);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, width, height);
  } catch {
    return null;
  } finally {
    bitmap.close();
  }
}

const stem = (name: string): string => name.replace(/\.[^.]+$/, '') || 'extract';

/** A reader error in the person's words. */
function readFailure(err: unknown): string {
  if (err instanceof ReadExtractSourceError) {
    if (err.code === 'unsupported') return t('Read and extract takes a PowerPoint deck (.pptx), a PDF or a Photoshop file (.psd).');
    if (err.code === 'too-large') return t('This file is larger than Read and extract takes on this device.');
    if (err.code === 'empty') return t('This file is empty.');
    return t('This file could not be read. It may be damaged or encrypted.');
  }
  return t('This file could not be read.');
}

export async function mountReadExtract(viewEl: HTMLElement, host: HostV1, _params?: string): Promise<void> {
  viewEl.innerHTML = `
    ${backHomeHtml()}
    <div class="gallery-topright">${langFabHtml()}</div>
    <div class="platform-layout rx-layout">
      <header class="plat-header">
        <h1 class="plat-title">${t('Read and extract')}</h1>
        <div class="plat-header-text">
          <p class="plat-sub">${t('Get the words, tables and pictures out of a PowerPoint deck, a PDF or a Photoshop file, page by page, on this device. Words read from a scan say which model read them and how sure it was. Nothing is uploaded, and macros or scripts in the file are never run.')}</p>
        </div>
      </header>
      <div class="rx-drop" data-drop tabindex="0" role="button" aria-label="${escapeHtml(t('Choose or drop a file to read'))}">
        <input type="file" accept=".pptx,.pptm,.pdf,.psd,application/pdf" hidden>
        <span class="rx-drop-icon" aria-hidden="true">${icon('transcript', { size: 32 })}</span>
        <strong>${t('Drop a file here')}</strong>
        <span>${t('pptx · pdf · psd · nothing leaves your device')}</span>
      </div>
      <div class="rx-status" data-status role="status" aria-live="polite"></div>
      <div class="rx-out" data-out hidden>
        <form class="rx-controls" data-controls>
          <label>${t('Pages')}<input name="pages" type="text" placeholder="${escapeHtml(t('All, or 1-3, 7'))}" autocomplete="off"></label>
          <label>${t('Character budget')}<input name="maxChars" type="number" min="1" step="1" placeholder="${escapeHtml(t('No limit'))}"></label>
          <label>${t('Recognised text')}<select name="minConfidence">
            <option value="">${t('Keep all')}</option>
            <option value="0.5">${t('Leave out under 50%')}</option>
            <option value="0.7">${t('Leave out under 70%')}</option>
            <option value="0.9">${t('Leave out under 90%')}</option>
          </select></label>
        </form>
        <div class="rx-scan" data-scan hidden></div>
        <div class="rx-actions">
          <button type="button" class="btn" data-act="copy">${icon('clipboard', { size: 16 })} ${t('Copy text')}</button>
          <button type="button" class="btn" data-act="txt">${icon('download', { size: 16 })} ${t('Text')}</button>
          <button type="button" class="btn" data-act="md">${icon('download', { size: 16 })} ${t('Markdown')}</button>
          <button type="button" class="btn" data-act="json">${icon('download', { size: 16 })} ${t('JSON')}</button>
        </div>
        <div class="rx-pages" data-pages></div>
        <div class="rx-more" data-more hidden></div>
        <ul class="rx-notes-list" data-warnings hidden></ul>
      </div>
    </div>`;
  armViewEnter(viewEl, '.tools-home, .plat-header, .rx-drop');
  mountBackPill(viewEl);
  mountHomeFab(viewEl);
  mountThemeFab(viewEl.querySelector('.gallery-topright'), host);
  mountProfileFab(viewEl.querySelector('.gallery-topright'), host);
  attachLangMenu(viewEl.querySelector<HTMLElement>('.lang-fab'), host);

  const drop = viewEl.querySelector<HTMLElement>('[data-drop]')!;
  const input = drop.querySelector<HTMLInputElement>('input[type="file"]')!;
  const status = viewEl.querySelector<HTMLElement>('[data-status]')!;
  const out = viewEl.querySelector<HTMLElement>('[data-out]')!;
  const form = viewEl.querySelector<HTMLFormElement>('[data-controls]')!;
  const scanBox = viewEl.querySelector<HTMLElement>('[data-scan]')!;
  const pagesEl = viewEl.querySelector<HTMLElement>('[data-pages]')!;
  const moreEl = viewEl.querySelector<HTMLElement>('[data-more]')!;
  const warningsEl = viewEl.querySelector<HTMLUListElement>('[data-warnings]')!;

  let file: { name: string; bytes: Uint8Array } | null = null;
  let source: ReadExtractSourceResultV1 | null = null;
  let extract: ReadExtractV1 | null = null;
  /** The block "Continue" reads on from, after the budget stopped the extract. */
  let from: string | undefined;
  let urls = new Map<string, string>();
  let generation = 0;
  let active = true;

  const releaseUrls = (): void => {
    for (const url of urls.values()) URL.revokeObjectURL(url);
    urls = new Map();
  };
  (viewEl as HTMLElement & { _cleanup?: () => void })._cleanup = () => { active = false; releaseUrls(); };

  const pictureUrl = (ref: string): string | null => {
    const known = urls.get(ref);
    if (known) return known;
    const held = source?.media.get(ref);
    if (!held || !/^image\/(?:png|jpeg|gif|webp|svg\+xml)$/i.test(held.mime)) return null;
    const url = URL.createObjectURL(new Blob([held.bytes as BlobPart], { type: held.mime }));
    urls.set(ref, url);
    return url;
  };

  const controls = (): ExtractControls => {
    const data = new FormData(form);
    return { pages: String(data.get('pages') ?? ''), maxChars: String(data.get('maxChars') ?? ''), minConfidence: String(data.get('minConfidence') ?? '') };
  };

  const setStatus = (text: string, tone: '' | 'error' = ''): void => {
    status.textContent = text;
    status.dataset.tone = tone;
  };

  function renderScanOffer(): void {
    const scanned = source?.scanned;
    const unread = scanned ? scanned.pages.filter((n) => !scanned.recognised.includes(n)) : [];
    let can = false;
    try { can = host.ocr?.isAvailable() === true; } catch { can = false; }
    if (!unread.length || !can) { scanBox.hidden = true; scanBox.innerHTML = ''; return; }
    scanBox.hidden = false;
    scanBox.innerHTML = `<p>${escapeHtml(unread.length === 1 ? t('One page is a picture of its text.') : tRaw('{n} pages are pictures of their text.', { n: unread.length }))}</p>
      <button type="button" class="btn" data-act="ocr">${escapeHtml(t('Read the text on this device'))}</button>`;
  }

  function render(): void {
    if (!source) return;
    releaseUrls();
    try {
      extract = readExtract(source.inventory, extractOptions(controls(), from));
    } catch (err) {
      extract = null;
      pagesEl.innerHTML = '';
      moreEl.hidden = true;
      setStatus(err instanceof ReadExtractError ? err.message : t('These settings could not be applied.'), 'error');
      return;
    }
    const name = source.inventory.source.name;
    setStatus(tRaw('{name}: {blocks} blocks, {chars} characters, from {pages} of {total} pages.', {
      name, blocks: extract.blocks.length, chars: extract.chars, pages: extract.request.pages.length, total: extract.source.pages,
    }));
    pagesEl.innerHTML = renderExtractHtml(extract, pictureUrl);
    moreEl.hidden = !extract.next;
    moreEl.innerHTML = !extract.next ? '' : `<p>${escapeHtml(tRaw('The budget stopped the extract before block {next}.', { next: extract.next ?? '' }))}</p><button type="button" class="btn" data-act="continue">${escapeHtml(t('Continue'))}</button>`;
    const notes = extract.warnings.filter((w) => w.code !== 'budget-reached');
    warningsEl.hidden = notes.length === 0;
    warningsEl.innerHTML = notes.map((w) => `<li>${escapeHtml(w.message)}</li>`).join('');
    renderScanOffer();
    announce(t('The extract is ready.'));
  }

  async function load(next: { name: string; bytes: Uint8Array }, withOcr = false): Promise<void> {
    const mine = ++generation;
    setStatus(withOcr ? t('Reading the text in the scanned pages…') : t('Reading the file…'));
    const controller = new AbortController();
    let job: JobHandle | null = null;
    try {
      let recognizers: Map<string, { version?: string; languages?: readonly string[] }> | undefined;
      let recogniser: ExtractRecogniserV1 | null = null;
      if (withOcr && host.ocr) {
        const { startJob } = await import('../lib/jobs.ts');
        job = startJob({ title: t('Reading scanned pages'), cancel: () => controller.abort() });
        await job.started;
        if (job.cancelled) return;
        recognizers = new Map(host.ocr.models().map((m) => [m.id, { version: m.version, languages: m.languages }]));
        recogniser = hostRecogniser(host.ocr, OCR_DEFAULT_MODEL, controller.signal);
      }
      const handle = job;
      const read = await readExtractSource(next, {
        parseXml: (xml) => new DOMParser().parseFromString(xml, 'application/xml'),
        pdfReaders: async () => (await import('./pdf-import.ts')).rebrandPdfReaders(),
        psdDecode: async () => (await import('../bridge/adobe-psd.ts')).readPsdPortable,
        recogniser,
        decodePicture: decodeWithCanvas,
        ...(recognizers ? { recognizers } : {}),
        signal: controller.signal,
        onProgress: (phase, done, total) => {
          if (phase === 'recognise') handle?.progress(done, total, tRaw('Reading page {i} of {n}…', { i: Math.min(done + 1, total), n: total }));
        },
      });
      job?.finish();
      if (!active || mine !== generation) return;
      file = next;
      source = read;
      from = undefined;
      out.hidden = false;
      render();
    } catch (err) {
      if (job?.cancelled || controller.signal.aborted) { setStatus(t('Reading was cancelled.')); return; }
      job?.fail(err);
      if (!active || mine !== generation) return;
      // A full heavy queue is reported as that, not as a file that would not read.
      setStatus((err as Error | null)?.name === 'JobQueueFullError' ? t('Too many jobs are waiting. Wait for one to finish and try again.') : readFailure(err), 'error');
    } finally {
      job?.settle();
    }
  }

  async function readScans(): Promise<void> {
    if (!file) return;
    const { ensureModel } = await import('../lib/model-offer.ts');
    if (!(await ensureModel('ocr', { reason: t('Reading text in scanned pages') }))) return;
    await load(file, true);
  }

  const pick = (chosen: File | undefined): void => {
    if (!chosen) return;
    // Refused before the bytes are read into memory.
    if (chosen.size > READ_EXTRACT_MAX_BYTES) { setStatus(readFailure(new ReadExtractSourceError('too-large', 'too large')), 'error'); return; }
    void chosen.arrayBuffer().then((buf) => load({ name: chosen.name, bytes: new Uint8Array(buf) }));
  };
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  input.addEventListener('change', () => { pick(input.files?.[0]); input.value = ''; });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); pick(e.dataTransfer?.files?.[0]); });
  form.addEventListener('input', () => { from = undefined; render(); });
  form.addEventListener('submit', (e) => e.preventDefault());

  const save = (text: string, ext: string, mime: string): void => {
    void host.export.download(new Blob([text], { type: `${mime};charset=utf-8` }), `${stem(source?.inventory.source.name ?? 'extract')}.${ext}`);
  };
  out.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'ocr') { void readScans(); return; }
    if (!act || !extract) return;
    if (act === 'copy') void host.clipboard.writeText(extractPlainText(extract)).then(() => announce(t('Copied.')));
    else if (act === 'txt') save(extractPlainText(extract), 'txt', 'text/plain');
    else if (act === 'md') save(extractMarkdown(extract), 'md', 'text/markdown');
    else if (act === 'json') save(`${JSON.stringify(extract, null, 2)}\n`, 'json', 'application/json');
    else if (act === 'continue' && extract.next) { from = extract.next; render(); }
  });
}
