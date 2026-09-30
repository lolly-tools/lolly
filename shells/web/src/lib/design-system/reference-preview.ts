// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { carryUserFontTokens, type UserFontsHost } from '../../user-fonts.ts';
import { latestPreview } from '../latest-preview.ts';
import { t, tRaw } from '../../i18n.ts';

/** Owns the rendered image and its URL for one import review. */
export function mountReferencePreview(el: HTMLElement, host: HostV1 & UserFontsHost) {
  const figure = document.createElement('figure');
  figure.className = 'ds-reference-proof';
  const img = document.createElement('img');
  img.alt = t('Poster rendered with the suggested palette and current font');
  img.hidden = true;
  const status = document.createElement('p');
  status.className = 'ds-reference-proof-status';
  status.setAttribute('role', 'status');
  figure.append(img, status);
  el.append(figure);
  const font = document.createElement('p');
  font.className = 'ds-src-stage-note';
  const stack = getComputedStyle(document.documentElement).getPropertyValue('--font-brand').trim();
  font.textContent = tRaw('Current font: {name}. Uses the available face and its fallback stack; glyph coverage is unchecked.', { name: stack.split(',')[0]?.replace(/["']/g, '').trim() || t('System font') });
  el.append(font);
  let url: string | undefined;
  let report: Record<string, unknown> | null = null;
  const clear = (): void => { if (url) URL.revokeObjectURL(url); url = undefined; img.removeAttribute('src'); img.hidden = true; };
  const work = latestPreview(async (input: { doc: Record<string, unknown>; theme: string }, signal) => {
    const doc = await carryUserFontTokens(host, input.doc);
    signal.throwIfAborted();
    const { renderReferencePoster } = await import('./reference-proof.ts');
    return renderReferencePoster(host, doc, input.theme, signal);
  }, {
    pending() { report = null; clear(); figure.setAttribute('aria-busy', 'true'); status.textContent = t('Rendering your poster preview…'); status.hidden = false; },
    ready(result) {
      const { blob: _blob, ...metadata } = result;
      report = metadata;
      url = URL.createObjectURL(result.blob); img.src = url; img.hidden = false;
      figure.removeAttribute('aria-busy'); status.hidden = true;
    },
    failed() { figure.removeAttribute('aria-busy'); status.hidden = false; status.textContent = t('Poster preview unavailable. You can still review the colours below.'); },
  });
  return { update: work.update, report: () => report ? structuredClone(report) : null, dispose(): void { work.dispose(); clear(); figure.remove(); font.remove(); } };
}
