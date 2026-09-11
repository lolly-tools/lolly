// SPDX-License-Identifier: MPL-2.0
/**
 * The prepared copies: one card per output in the main column, each with its own
 * download, copy, library and send actions and a before/after comparison for text.
 * The report that describes the run lives in the inspection panel (inspector.ts).
 */
import type { HostV1, PreparationSource, PreparationResult } from '@lolly-tools/core/host-v1';
import type { FileResultLibraryHost } from '../../lib/file-result-library.ts';
import { attachDeliveryResult, releaseDeliveryFor } from '../../lib/download-recovery.ts';
import { deliverFile } from '../../lib/deliver-file.ts';
import { fmtBytes } from '../../lib/format.ts';
import { icon } from '../../lib/icons.ts';
import { escape as htmlEscape } from '../../utils.ts';
import { attachPreparationDestinations } from './send.ts';
import { t } from '../../i18n.ts';

export function preparedFile(source: PreparationSource): File {
  return new File([Uint8Array.from(source.bytes).buffer], source.name, { type: source.mime || 'application/octet-stream' });
}
function preview(source: PreparationSource): string | null {
  if (source.bytes.length > 1024 * 1024 || /\.(pdf|zip|png|jpe?g|webp|docx|xlsx|mp3|wav)$/i.test(source.name)) return null;
  try { const text = new TextDecoder('utf-8', { fatal: true }).decode(source.bytes); for (const c of text) if (c.charCodeAt(0) < 9) return null; return text; } catch { return null; }
}
async function retainResult(source: PreparationSource, host: HostV1, checksum: string): Promise<void> {
  const api = host.assets as Partial<FileResultLibraryHost['assets']>;
  if (!api._uploadUserAsset) throw new Error(t('Saving to the library is unavailable in this shell. Download the result instead.'));
  const version = crypto.randomUUID();
  await api._uploadUserAsset({ id: `user/prepared/${version}`, version, type: 'data', format: source.name.split('.').pop() || 'bin',
    blob: preparedFile(source), checksum, meta: { name: source.name, tags: ['prepared'], sourceBytesRetained: false } }, { expectedVersion: null });
}
function rowsFor(text: string): number {
  return Math.max(4, Math.min(14, text.split('\n').length + 1));
}

export function renderPreparationOutputs(root: HTMLElement, result: PreparationResult, originals: PreparationSource[], host: HostV1): () => void {
  const cleanups: (() => void)[] = [];
  const changed = result.report.outputs.filter(o => o.changed).length;
  const summary = changed
    ? `${result.report.replaced} ${result.report.replaced === 1 ? t('occurrence changed or removed across') : t('occurrences changed or removed across')} ${changed} ${changed === 1 ? t('copy') : t('copies')}.`
    : t('Nothing needed changing. The copies match your originals.');
  root.innerHTML = `<header class="prep-card-head"><h2 class="prep-card-title">${t('Prepared copies')}</h2><p class="prep-card-sub">${htmlEscape(summary)} ${t('Copies stay in this view until you leave.')}</p></header>
    ${result.report.stages?.some(s => s.status === 'failed') ? `<p class="prep-alert" role="alert">${t('Some changes could not be made. The affected files were kept for review; the other copies are ready.')}</p>` : ''}
    <div class="prep-outputs"></div>`;
  const list = root.querySelector<HTMLElement>('.prep-outputs')!;
  for (const [i, output] of result.outputs.entries()) {
    const section = document.createElement('article'); section.className = 'prep-output';
    const before = preview(originals[i]!), after = preview(output), file = preparedFile(output);
    const isChanged = result.report.outputs[i]!.changed;
    const canShare = host.export.canShare?.({ mime: file.type, filename: file.name });
    section.innerHTML = `<div class="prep-output-head">
        <span class="prep-file-icon" aria-hidden="true">${icon('document')}</span>
        <div class="prep-output-title"><h3>${htmlEscape(output.name)}</h3><p class="prep-file-meta">${htmlEscape(fmtBytes(output.bytes.length))} <span class="chip ${isChanged ? 'prep-scope-status' : ''}" ${isChanged ? 'data-status="inspected"' : ''}>${isChanged ? t('Changed') : t('Unchanged')}</span></p></div>
        <div class="prep-output-actions">
          <button type="button" class="btn btn--primary btn--sm" data-download>${icon('download')}${t('Download')}</button>
          ${after !== null ? `<button type="button" class="btn btn--sm" data-copy>${icon('duplicate')}${t('Copy text')}</button>` : ''}
          <button type="button" class="btn btn--sm btn--ghost" data-library>${icon('folder')}${t('Add to library')}</button>
          ${canShare ? `<button type="button" class="btn btn--sm btn--ghost" data-send>${icon('share')}${t('Send to…')}</button>` : ''}
        </div>
      </div>
      ${after !== null
        ? `<details class="prep-compare"${isChanged && after.length < 20000 ? ' open' : ''}><summary>${t('Compare original and copy')}</summary><div class="prep-compare-grid"><label><span class="field-label">${t('Original')}</span><textarea class="field-input" readonly spellcheck="false" rows="${rowsFor(before ?? '')}">${htmlEscape(before ?? '')}</textarea></label><label><span class="field-label">${t('Copy')}</span><textarea class="field-input" readonly spellcheck="false" rows="${rowsFor(after)}">${htmlEscape(after)}</textarea></label></div></details>`
        : `<p class="prep-hint">${t('Binary content is not previewed here. Check the coverage notes and open the copy in its own viewer.')}</p>`}
      <p class="prep-status" role="status" data-status></p>`;
    const status = section.querySelector<HTMLElement>('[data-status]')!;
    const action = (selector: string, fn: () => Promise<void>): void => { section.querySelector<HTMLButtonElement>(selector)?.addEventListener('click', async event => {
      const button = event.currentTarget as HTMLButtonElement; button.disabled = true;
      try { await fn(); } catch { status.textContent = t('Could not complete this action. The result remains available; try again.'); }
      finally { button.disabled = false; }
    }); };
    action('[data-download]', async () => {
      const outcome = await deliverFile(host, file, file.name);
      attachDeliveryResult(section, status, { blob: file, filename: file.name, label: file.name }, host, outcome, { ready: t('Copy ready.'), saved: t('Copy saved.') });
    });
    cleanups.push(() => releaseDeliveryFor(section));
    action('[data-copy]', async () => { await host.clipboard.writeText(after!); status.textContent = t('Copied.'); });
    action('[data-library]', async () => { await retainResult(output, host, result.report.outputs[i]!.sha256); status.textContent = t('Result saved to your library.'); });
    action('[data-send]', async () => { await host.export.share!(file, { filename: file.name }); status.textContent = t('Share dialog closed.'); });
    attachPreparationDestinations(section, output, status);
    list.append(section);
  }
  return () => cleanups.forEach(fn => { fn(); });
}
