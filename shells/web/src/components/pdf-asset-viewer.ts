// SPDX-License-Identifier: MPL-2.0
/** PDF.js owns faithful page rendering and a bounded canvas buffer. */
import { AnnotationMode, getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import { EventBus, PDFViewer, PDFLinkService, PDFFindController, ScrollMode, LinkTarget } from 'pdfjs-dist/web/pdf_viewer.mjs';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'pdfjs-dist/web/pdf_viewer.css';
import { viewerButton, viewerField, viewerSelect } from './asset-viewer-controls.ts';
import { mountPdfNavigation } from './pdf-asset-navigation.ts';
import { t } from '../i18n.ts';

GlobalWorkerOptions.workerSrc = workerUrl;
export async function mountPdfAssetViewer(root: HTMLElement, bytes: Uint8Array, signal: AbortSignal): Promise<() => void> {
  root.replaceChildren();
  const toolbar = document.createElement('div'); toolbar.className = 'asset-viewer-toolbar'; toolbar.setAttribute('aria-label', t('Document controls'));
  const searchBar = document.createElement('form'); searchBar.className = 'asset-pdf-search';
  const search = document.createElement('input'); search.type = 'search'; search.className = 'field-input'; search.placeholder = t('Search document'); search.setAttribute('aria-label', search.placeholder);
  const matches = document.createElement('output'); matches.setAttribute('aria-live', 'polite'); searchBar.append(search, matches);
  const workspace = document.createElement('div'); workspace.className = 'asset-pdf-workspace';
  const rail = document.createElement('nav'); rail.className = 'asset-pdf-rail'; rail.setAttribute('aria-label', t('Document navigation')); rail.hidden = true;
  const stage = document.createElement('div'); stage.className = 'asset-pdf-stage';
  const container = document.createElement('div'); container.className = 'asset-pdf-scroll'; container.tabIndex = 0; container.setAttribute('aria-label', t('Document pages'));
  const surface = document.createElement('div'); surface.className = 'pdfViewer'; container.append(surface); stage.append(container); workspace.append(rail, stage); root.append(toolbar, searchBar, workspace);
  const eventBus = new EventBus();
  const links = new PDFLinkService({ eventBus, externalLinkTarget: LinkTarget.BLANK, externalLinkRel: 'noopener noreferrer' });
  const finder = new PDFFindController({ eventBus, linkService: links });
  const viewer = new PDFViewer({ container, viewer: surface, eventBus, linkService: links, findController: finder,
    annotationMode: AnnotationMode.ENABLE, maxCanvasPixels: 16_777_216 });
  links.setViewer(viewer);
  const page = document.createElement('input'); page.className = 'field-input'; page.type = 'number'; page.min = '1'; page.value = '1';
  const count = document.createElement('span'); count.textContent = t('Loading…');
  viewerButton('Previous page', () => { viewer.currentPageNumber = Math.max(1, viewer.currentPageNumber - 1); }, toolbar);
  viewerField('Page', page, toolbar); toolbar.append(count);
  viewerButton('Next page', () => { viewer.currentPageNumber = Math.min(viewer.pagesCount, viewer.currentPageNumber + 1); }, toolbar);
  const scale = viewerSelect([['page-fit', 'Fit page'], ['page-width', 'Fit width'], ['1', '100%'], ['1.5', '150%'], ['2', '200%'], ['3', '300%']], toolbar, 'Zoom');
  let fit = 'page-fit';
  viewerButton('Zoom out', () => { fit = ''; viewer.decreaseScale(); }, toolbar); viewerButton('Zoom in', () => { fit = ''; viewer.increaseScale(); }, toolbar);
  viewerButton('Rotate', () => { viewer.pagesRotation = (viewer.pagesRotation + 90) % 360; }, toolbar);
  const mode = viewerSelect([['continuous', 'Continuous'], ['paged', 'Paged']], toolbar, 'View');
  const toggle = viewerButton('Pages and outline', () => { rail.hidden = !rail.hidden; toggle.setAttribute('aria-expanded', String(!rail.hidden)); viewer.update(); }, toolbar); toggle.setAttribute('aria-expanded', 'false');
  const find = (again = false, previous = false) => eventBus.dispatch('find', { source: root, type: again ? 'again' : '', query: search.value,
    phraseSearch: true, caseSensitive: false, entireWord: false, highlightAll: true, findPrevious: previous, matchDiacritics: false });
  viewerButton('Previous match', () => find(true, true), searchBar); viewerButton('Next match', () => find(true), searchBar);
  search.addEventListener('input', () => find()); searchBar.addEventListener('submit', e => { e.preventDefault(); find(true); });
  page.addEventListener('change', () => { const n = Number(page.value); if (Number.isInteger(n) && n >= 1 && n <= viewer.pagesCount) viewer.currentPageNumber = n; page.value = String(viewer.currentPageNumber); });
  scale.addEventListener('change', () => { fit = scale.value.startsWith('page-') ? scale.value : ''; viewer.currentScaleValue = scale.value; });
  mode.addEventListener('change', () => { viewer.scrollMode = mode.value === 'paged' ? ScrollMode.PAGE : ScrollMode.VERTICAL; });
  eventBus.on('pagechanging', (event: { pageNumber: number }) => {
    page.value = String(event.pageNumber);
    for (const button of rail.querySelectorAll<HTMLElement>('[data-page]')) button.setAttribute('aria-current', button.dataset.page === page.value ? 'page' : 'false');
  });
  eventBus.on('updatefindmatchescount', (event: { matchesCount: { current: number; total: number } }) => { matches.textContent = `${event.matchesCount.current} / ${event.matchesCount.total}`; });
  eventBus.on('updatefindcontrolstate', (event: { state: number }) => { if (event.state === 1) matches.textContent = t('No matches'); });
  eventBus.on('pagesinit', () => { viewer.currentScaleValue = 'page-fit'; });
  root.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); e.stopPropagation(); search.focus(); }
    if (e.key === 'Escape' && search.value) { e.preventDefault(); e.stopPropagation(); search.value = ''; find(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.stopPropagation();
  }, { signal });
  const controls = [...toolbar.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input,select,button')]; controls.forEach(control => { control.disabled = true; }); root.setAttribute('aria-busy', 'true');
  const resources = new URL('lib/pdfjs-6.4.299/', new URL(import.meta.env.BASE_URL ?? '/', window.location.origin)).href;
  const task = getDocument({ data: bytes, useSystemFonts: false, enableXfa: false,
    cMapUrl: `${resources}cmaps/`, cMapPacked: true, standardFontDataUrl: `${resources}standard_fonts/`, wasmUrl: `${resources}wasm/`, iccUrl: `${resources}iccs/`,
    maxImageSize: 40_000_000, canvasMaxAreaInBytes: 64 * 1024 * 1024 });
  let navigationDispose: (() => void) | undefined;
  const dispose = () => { navigationDispose?.(); viewer.setDocument(null); links.setDocument(null); void task.destroy().catch(() => {}); };
  signal.addEventListener('abort', dispose, { once: true });
  task.onPassword = (updatePassword: (password: string) => void, reason: number) => {
    const form = document.createElement('form'); form.className = 'asset-pdf-password';
    const password = document.createElement('input'); password.type = 'password'; password.className = 'field-input'; password.autocomplete = 'off';
    viewerField(reason === 2 ? 'Incorrect password. Try again.' : 'Document password', password, form);
    const submit = viewerButton('Open document', () => {}, form); submit.type = 'submit';
    form.addEventListener('submit', e => { e.preventDefault(); const value = password.value; password.value = ''; form.remove(); updatePassword(value); });
    root.querySelector('.asset-pdf-password')?.remove(); root.prepend(form); password.focus();
  };
  try {
    const pdf = await task.promise; signal.throwIfAborted();
    if (pdf.numPages > 2000) throw new Error('This document has too many pages for an inline preview.');
    controls.forEach(control => { control.disabled = false; }); root.removeAttribute('aria-busy');
    count.textContent = `/ ${pdf.numPages}`; page.max = String(pdf.numPages);
    links.setDocument(pdf); viewer.setDocument(pdf); finder.setDocument(pdf);
    viewer.setPageLabels(await pdf.getPageLabels()); signal.throwIfAborted();
    navigationDispose = await mountPdfNavigation(rail, pdf, links, signal);
    const resize = new ResizeObserver(() => { if (!signal.aborted) { if (fit) viewer.currentScaleValue = fit; viewer.update(); } }); resize.observe(stage);
    return () => { signal.removeEventListener('abort', dispose); resize.disconnect(); dispose(); };
  } catch (error) { signal.removeEventListener('abort', dispose); dispose(); throw error; }
}
