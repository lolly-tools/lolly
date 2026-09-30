// SPDX-License-Identifier: MPL-2.0
/** File and paste controls for the browser's local reference path. */
import { t } from '../../i18n.ts';
import { readPageFiles, PAGE_MAX_BYTES, type PageText, type extractSavedPage } from '../../lib/design-system/sources/saved-page.ts';
import { bindOp, type StartCtx } from './context.ts';

function errorText(code: string): string {
  switch (code) {
    case 'size': return t('Use HTML and CSS totalling 2 MB or less.');
    case 'count': return t('Choose up to 20 HTML and CSS files.');
    case 'format': return t('Choose an HTML file and its CSS files, or CSS files on their own.');
    case 'pages': return t('Choose one HTML page at a time, along with its CSS files.');
    case 'empty': return t('Choose files or paste HTML or CSS first.');
    default: return t('Could not read this page. Try a screenshot instead.');
  }
}

export function wireSavedPage(start: StartCtx): void {
  const stage = start.importModal?.el.querySelector<HTMLElement>('[data-ds-stage="page"]');
  if (!stage) return;
  const files = stage.querySelector<HTMLInputElement>('[data-page-files]')!;
  const drop = stage.querySelector<HTMLElement>('[data-page-drop]')!;
  const selection = stage.querySelector<HTMLElement>('[data-page-selection]')!;
  let selected: File[] = [];
  const text = stage.querySelector<HTMLTextAreaElement>('[data-page-text]')!;
  const format = stage.querySelector<HTMLSelectElement>('[data-page-format]')!;
  const go = stage.querySelector<HTMLButtonElement>('[data-page-read]')!;
  const pasted = stage.querySelector<HTMLDetailsElement>('details')!;
  const reset = (): void => {
    start.reference.cancelReference();
    stage.querySelector('[data-reference-review]')?.remove();
    stage.classList.remove('has-reference-review');
    start.sources.srcNote('');
  };
  const choose = (next: File[]): void => {
    selected = next;
    selection.textContent = next.length ? next.map(file => file.name).join(', ') : t('or drag & drop them here');
    text.value = ''; pasted.open = false; reset();
  };
  files.addEventListener('change', () => choose(Array.from(files.files ?? [])));
  drop.addEventListener('dragover', event => {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault(); event.stopPropagation(); drop.classList.add('is-dragover');
  });
  drop.addEventListener('dragleave', event => {
    if (!event.relatedTarget || !drop.contains(event.relatedTarget as Node)) drop.classList.remove('is-dragover');
  });
  drop.addEventListener('drop', event => {
    event.preventDefault(); event.stopPropagation(); drop.classList.remove('is-dragover');
    files.value = ''; choose(Array.from(event.dataTransfer?.files ?? []));
  });
  text.addEventListener('input', () => { files.value = ''; selected = []; selection.textContent = t('or drag & drop them here'); reset(); });
  format.addEventListener('change', reset);
  go.addEventListener('click', async () => {
    if (go.getAttribute('aria-disabled') === 'true') return;
    reset();
    const revision = start.referenceRevision;
    const current = (): boolean => start.referenceRevision === revision && stage.isConnected && !stage.hidden;
    go.setAttribute('aria-disabled', 'true');
    stage.setAttribute('aria-busy', 'true');
    start.sources.srcNote(t('Finding colours and fonts…'));
    let worker: Worker | undefined;
    try {
      let parts: PageText[];
      const isPaste = !selected.length;
      if (isPaste) {
        if (text.value.length > PAGE_MAX_BYTES) throw new Error('size');
        parts = [{ name: format.value === 'css' ? 'pasted.css' : 'pasted.html', text: text.value }];
      } else parts = await readPageFiles(selected);
      if (!current()) return;
      worker = new Worker(new URL('../../lib/design-system/sources/saved-page-worker.ts', import.meta.url), { type: 'module' });
      const result = await new Promise<Awaited<ReturnType<typeof extractSavedPage>>>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 15000);
        const finish = (): void => { clearTimeout(timer); };
        start.referenceCancel = () => { finish(); worker?.terminate(); reject(new Error('cancelled')); };
        worker!.onmessage = event => {
          finish();
          if (event.data.error) reject(new Error(event.data.error)); else resolve(event.data.result);
        };
        worker!.onerror = () => { finish(); reject(new Error('read')); };
        worker!.postMessage(parts);
      });
      if (!current()) return;
      start.reference.reviewReference(result.census, {
        method: isPaste ? 'paste' : 'files', label: isPaste ? t('Pasted web page') : result.census.source.label,
        sha256: result.sha256, files: result.files,
      });
    } catch (error) {
      if (current()) start.sources.srcNote(errorText(error instanceof Error ? error.message : 'read'), true);
    } finally {
      worker?.terminate();
      if (start.referenceRevision === revision) start.referenceCancel = undefined;
      go.removeAttribute('aria-disabled');
      stage.removeAttribute('aria-busy');
    }
  });
}

export function savedPageOps(start: StartCtx) {
  return { wireSavedPage: bindOp(start, wireSavedPage) };
}
