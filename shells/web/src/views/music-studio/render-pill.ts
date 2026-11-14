// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator's render pill (#/music): one pill, built like the tool view's
 * Export | Save pill (views/tool/stage-layout.ts, .render-pill), that reads as "Render
 * (play / download)". Play renders the whole track at full quality and plays it with the
 * big visualiser. Download opens the download's own panel in a body popover
 * (components/body-popover.ts), the way the tool view's Export opens its sheet: the file
 * type, the line that says what the download will record and the Download button, so
 * what a download writes is in view at the moment of the click (lib/tune-provenance.ts).
 * Every download carries Content Credentials and the plain description, with no switch
 * to leave them out (Andy, 2026-11-14): the note under the file type states what every
 * download records, with nothing to choose.
 * Once the track is rendered the pill's name says so, and play and download are
 * immediate.
 *
 * The options are written once, with the page, and lent to the popover while it is open:
 * the file type keeps its state, and the view reads the type from here.
 */
import { t, tRaw } from '../../i18n.ts';
import { escape as escapeHtml } from '../../utils.ts';
import { icon } from '../../lib/icons.ts';
import { segHtml } from '../../lib/seg.ts';
import { mountBodyPopover } from '../../components/body-popover.ts';
import { TUNE_DECLARATION } from '../../../../../engine/src/tune-provenance.ts';

/** The pill, and beside the pill the download's panel, hidden until Download opens the panel. */
export function renderPillHtml(): string {
  return `
    <div class="ms-render" role="group" aria-label="${escapeHtml(t('Render'))}" data-render-pill>
      <span class="ms-render-name" aria-hidden="true"><span class="ms-render-tick">${icon('check', { size: 14, strokeWidth: 2.6 })}</span><span data-render-word>${escapeHtml(t('Render'))}</span></span>
      <button type="button" class="ms-render-btn" data-render-play aria-label="${escapeHtml(t('Render and play'))}" title="${escapeHtml(t('Render the whole track at full quality, then play it with the big visualiser'))}">${icon('play', { size: 16, filled: true })}<span class="ms-render-label">${escapeHtml(t('Play'))}</span></button>
      <span class="ms-render-sep" aria-hidden="true"></span>
      <button type="button" class="ms-render-btn ms-render-get" data-download-open aria-haspopup="dialog" aria-expanded="false">${escapeHtml(t('Download'))}</button>
    </div>
    <div class="ms-render-options" data-render-options hidden>
      <div class="ms-opt">
        <span class="ms-opt-label" id="ms-format-label">${escapeHtml(t('File type'))}</span>
        ${segHtml('ms-format', [{ id: 'm4a', label: 'M4A' }, { id: 'wav', label: 'WAV' }], 'm4a', t('File type'), { attr: 'data-format', labelledBy: 'ms-format-label', extraClass: 'ms-format' })}
      </div>
      <p class="ms-opt-note" data-cred-note>${escapeHtml(tRaw('Downloads will carry Content Credentials that record: {declaration}.', { declaration: TUNE_DECLARATION }))}</p>
      <button type="button" class="btn btn--primary btn--labelled ms-opt-go" data-download>${icon('download', { size: 16 })}<span>${escapeHtml(t('Download'))}</span></button>
    </div>`;
}

export interface RenderOptions {
  /** The file type chosen for a download. */
  format(): 'm4a' | 'wav';
  isOpen(): boolean;
  /** Close the download's panel, handing focus back to Download when asked. */
  close(returnFocus?: boolean): void;
  /** Mark the pill as holding a finished render, or not. */
  showRendered(on: boolean): void;
}

/** Wire the pill's Download to its panel, which Escape, an outside click and Download again close. */
export function wireRenderPill(page: HTMLElement): RenderOptions {
  const pill = page.querySelector<HTMLElement>('[data-render-pill]');
  const more = page.querySelector<HTMLButtonElement>('[data-download-open]');
  const box = page.querySelector<HTMLElement>('[data-render-options]');
  const word = page.querySelector<HTMLElement>('[data-render-word]');
  if (!pill || !more || !box || !word) throw new Error('music generator: the render pill is missing');
  const formats = [...box.querySelectorAll<HTMLButtonElement>('[data-format]')];
  for (const b of formats) b.addEventListener('click', () => { for (const o of formats) o.setAttribute('aria-pressed', String(o === b)); });

  const popover = mountBodyPopover(more, (el) => {
    box.hidden = false;
    el.append(box);
    return formats.find(b => b.getAttribute('aria-pressed') === 'true') ?? null;
  }, {
    className: 'surface surface--floating ms-render-menu',
    role: 'dialog',
    ariaLabel: t('Download'),
    // The options go home with the popover, so their state is there for the next open.
    onClose: () => { box.hidden = true; pill.after(box); },
  });
  more.addEventListener('click', () => { if (popover.isOpen()) popover.close(true); else popover.open(); });

  return {
    format: () => (formats.find(b => b.getAttribute('aria-pressed') === 'true')?.dataset.format === 'wav' ? 'wav' : 'm4a'),
    isOpen: () => popover.isOpen(),
    close: (returnFocus = false) => popover.close(returnFocus),
    showRendered: (on) => {
      pill.classList.toggle('is-rendered', on);
      word.textContent = on ? t('Rendered') : t('Render');
      pill.setAttribute('aria-label', word.textContent);
    },
  };
}
