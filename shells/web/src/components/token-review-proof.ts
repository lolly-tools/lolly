// SPDX-License-Identifier: MPL-2.0
import type { HostV1, TokenResolveOptions } from '@lolly-tools/core/host-v1';
import type { BrandExample } from '../../../../engine/src/brand-rules.ts';
import { EXAMPLE_LABELS, EXAMPLE_TEXT } from '../lib/design-system/brand-examples.ts';
import { usageSystem } from '../lib/design-system/usage-model.ts';
import { renderBrandExample } from '../lib/design-system/example-proof.ts';
import { comparisonVisualSource } from '../lib/compare-visual-sources.ts';
import { mountVisualComparison } from './compare-visual-panel.ts';
import { escape as esc } from '../utils.ts';
import { t } from '../i18n.ts';

/** Bounded production proofs: two fixed examples, one shared comparison, no activation. */
export function mountTokenReviewProof(root: HTMLElement, host: HostV1, before: unknown, after: unknown, opts: TokenResolveOptions, current: () => boolean | Promise<boolean>, afterOpts: TokenResolveOptions = opts): () => void {
  const captured = [structuredClone(before), structuredClone(after)];
  const selections = [structuredClone(opts), structuredClone(afterOpts)];
  let generation = 0, disposed = false, abort: AbortController | undefined;
  let comparison: (() => void) | undefined;
  root.innerHTML = `<label>${t('Production example')}<select class="field-select">${Object.entries(EXAMPLE_LABELS).map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join('')}</select></label><button type="button" class="btn btn--ghost" data-proof-run>${t('Render before and after')}</button> <button type="button" class="btn btn--ghost" data-proof-cancel disabled>${t('Cancel')}</button><p role="status" aria-live="polite"></p><div data-proof-result></div>`;
  const run = root.querySelector<HTMLButtonElement>('[data-proof-run]')!, cancel = root.querySelector<HTMLButtonElement>('[data-proof-cancel]')!;
  const status = root.querySelector<HTMLElement>('[role="status"]')!, result = root.querySelector<HTMLElement>('[data-proof-result]')!;
  async function render(): Promise<void> {
    abort?.abort(); const controller = new AbortController(); abort = controller; const seq = ++generation;
    const timeout = setTimeout(() => controller.abort(), 120000);
    run.disabled = true; cancel.disabled = false;
    status.textContent = t('Rendering captured examples. The last comparison remains visible.');
    try {
      const id = root.querySelector<HTMLSelectElement>('select')!.value as BrandExample;
      const sources = [];
      // Sequential rendering keeps the fixed example queue bounded at two.
      for (let i = 0; i < captured.length; i++) {
        const source = captured[i];
        const proof = await renderBrandExample(host, source, usageSystem(source, 'Token review'), '', id, EXAMPLE_TEXT, controller.signal, false, undefined, selections[i]);
        controller.signal.throwIfAborted();
        sources.push(await comparisonVisualSource(new File([proof.blob], `${i ? 'after' : 'before'}.png`, { type: 'image/png' }), host, controller.signal, { id: `${id}-${i}`, kind: 'revision', label: i ? t('Candidate') : t('Current'), revision: proof.report.sourceSha256 ?? undefined }));
      }
      if (disposed || seq !== generation) return;
      if (!await current()) { status.textContent = t('These captured results are stale. Create a fresh review.'); return; }
      if (disposed || seq !== generation) return;
      if (!host.compare?.visual) throw new Error(t('Visual comparison is unavailable in this host.'));
      comparison?.(); comparison = mountVisualComparison(result, host.compare, { version: 1, before: sources[0]!, after: sources[1]!, options: { alignment: 'native', threshold: 0 } });
      status.textContent = t('Two selected example renders checked. Other dimension combinations and documents were not rendered.');
    } catch (error) { if (!disposed && seq === generation) status.textContent = controller.signal.aborted ? t('Example rendering cancelled or timed out.') : (error as Error).message; }
    finally { clearTimeout(timeout); if (!disposed && seq === generation) { run.disabled = false; cancel.disabled = true; } }
  }
  run.addEventListener('click', () => { void render(); }); cancel.addEventListener('click', () => abort?.abort());
  return () => { disposed = true; generation++; abort?.abort(); comparison?.(); root.replaceChildren(); };
}
