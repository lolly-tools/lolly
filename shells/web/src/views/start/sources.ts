// SPDX-License-Identifier: MPL-2.0
/**
 * start: sources.
 *
 * Every function takes the shared `start: StartCtx` first (see context.ts). Sibling
 * calls in this file are direct; a call into another module, and every use of a
 * function as a value (an event listener), goes through `start.<module>.<fn>`. Extracted verbatim
 * from mountStart() by scripts/split-closure.ts.
 */
import { mountModal } from '../../components/modal.ts';
import { updateRouteParams } from '../../lib/url-state.ts';
import { adoptionOf } from '../../lib/design-system/adoption-material.ts';
import { t } from '../../i18n.ts';
import { SITE_MAX_URL_CHARS, normalizeSiteUrl } from '../../lib/design-system/sources/website.ts';
import type { StartSource } from '../../lib/design-system/start-route.ts';
import { takePendingDesignSystemFile } from '../../lib/drop-router.ts';
import { icon } from '../../lib/icons.ts';
import type { IconName } from '../../lib/icons.ts';
import { playSfx } from '../../lib/sfx.ts';
import { escape as escapeText } from '../../utils.ts';
import { SOURCE_TILES, WEBSITE_TILE } from './shared.ts';
import type { PickerSource } from './shared.ts';
import { bindOp, type StartCtx } from './context.ts';

/** The tiles this device can actually offer. Website leads when it is there
 *  (plan 97 section 5's order) and is simply absent when it is not. */
export const sourceTiles = (start: StartCtx): ReadonlyArray<{ id: PickerSource; icon: IconName }> =>
  { const { siteReady } = start; return siteReady ? [WEBSITE_TILE, ...SOURCE_TILES] : SOURCE_TILES; };
/** The picker's own note line - one sentence about what just happened, in the
 *  dialog rather than the rail, because that is where the eye already is. */
export const srcNote = (start: StartCtx, msg: string, isError = false): void => {
  const el = start.importModal?.el.querySelector<HTMLElement>('[data-ds-source-note]');
  if (!el) {
    start.exporting.showNote(msg, isError);
    return;
  } // the dialog closed under us
  el.textContent = msg;
  el.classList.toggle('is-error', isError);
};
/** Show one stage, or the source list when `src` names no stage of its own.
 *  A pure `hidden` toggle over nodes that are already there - nothing here
 *  rebuilds markup, which is why the picker adds no raw-HTML sink. */
export function showStage(start: StartCtx, src: StartSource | null): void {
  const { siteReady } = start;
  const el = start.importModal?.el;
  if (!el) return;
  start.reference.cancelReference();
  el.querySelectorAll('[data-reference-review]').forEach(card => { card.remove(); });
  el.querySelectorAll('.has-reference-review').forEach(stage => { stage.classList.remove('has-reference-review'); });
  // `url` is a stage only where a transport answered: on a plain browser the
  // section was never rendered, so a `?source=url` link falls through to the
  // list rather than opening an empty panel (plan 97 section 9's degrade).
  const stage =
    src === 'file' || src === 'image' || src === 'pdf' || src === 'page'
      ? src
      : src === 'url' && siteReady
        ? 'url'
        : null;
  updateRouteParams({ import: '', source: stage });
  const tiles = el.querySelector<HTMLElement>('[data-ds-src-tiles]');
  const intro = el.querySelector<HTMLElement>('[data-ds-src-intro]');
  if (tiles) tiles.hidden = stage !== null;
  if (intro) intro.hidden = stage !== null;
  el.querySelectorAll<HTMLElement>('[data-ds-stage]').forEach((s) => {
    s.hidden = s.dataset.dsStage !== stage;
  });
  // Focus follows the stage: the control the person came for, or the first
  // source when they came for the list.
  const focusSel =
    stage === 'file'
      ? '.start-import-file'
      : stage === 'image'
        ? '.ds-src-imgfile'
        : stage === 'pdf'
          ? '.ds-src-pdffile'
          : stage === 'url'
            ? '.ds-src-urlfield'
            : stage === 'page'
              ? '[data-page-files]'
              : '[data-ds-source]';
  el.querySelector<HTMLElement>(focusSel)?.focus();
}
/** A tile press. Three of the four open a stage; the font tile is an ACTION -
 *  the Type room already owns installing a face, so sending someone there beats
 *  a second uploader that would have to agree with it forever. */
export function chooseSource(start: StartCtx, src: StartSource): void {
  const { editorRoot } = start;
  if (src === 'font') {
    closeImport(start);
    start.rooms.selectRoom('type', { focus: true });
    // Focus the room's own upload control. Never .click() it from here - a file
    // dialog belongs to the press the user made, not to a route.
    editorRoot?.querySelector<HTMLElement>('.fonts-upload-file')?.focus();
    return;
  }
  showStage(start, src);
}
export function openImport(start: StartCtx, source: StartSource | null = null): void {
  const { SOURCE_NAME, SOURCE_NOTE, importBtn, importPanel, siteReady } = start;
  // A named source that is an ACTION rather than a stage never opens a dialog
  // it would immediately close: `?source=font` goes straight to the Type room.
  if (source === 'font') {
    chooseSource(start, 'font');
    return;
  }
  if (start.importModal) {
    showStage(start, source);
    return;
  }
  start.adoptionReviewBase = adoptionOf(start.host)?.capture().catch(error => error instanceof Error ? error : new Error(String(error)));
  start.importModal = mountModal<void>(
    `
      <!-- A VISIBLE way out (plans/137 B3). Escape and a backdrop tap both
           dismiss already (components/modal.ts owns each), but on a phone the
           card fills the screen and neither is something you can see. -->
      <div class="start-import-head">
        <h2 class="modal-title">${t('Add from…')}</h2>
        <button type="button" class="start-import-close" data-ds-src-close
          aria-label="${escapeText(t('Close'))}">&#x2715;</button>
      </div>
      <p class="modal-msg" data-ds-src-intro>${t('Bring across what you already have. Everything is read on this device.')}</p>
      <ul class="ds-src-tiles" role="list" data-ds-src-tiles>
        ${sourceTiles(start)
          .map(
            (tile) => `
          <li>
            <button type="button" class="ds-src-tile" data-ds-source="${escapeText(tile.id)}">
              <span class="ds-src-tile-ic" aria-hidden="true">${icon(tile.icon)}</span>
              <span class="ds-src-tile-name">${escapeText(SOURCE_NAME[tile.id]())}</span>
              <span class="ds-src-tile-note">${escapeText(SOURCE_NOTE[tile.id]())}</span>
            </button>
          </li>`
          )
          .join('')}
      </ul>
      <section class="ds-src-stage" data-ds-stage="file" hidden>
        <button type="button" class="be-btn be-btn--sm ds-src-back" data-ds-src-back>${t('All sources')}</button>
        <div data-import-mount></div>
      </section>
      <section class="ds-src-stage" data-ds-stage="image" hidden>
        <button type="button" class="be-btn be-btn--sm ds-src-back" data-ds-src-back>${t('All sources')}</button>
        <label class="start-import-drop ds-src-drop" data-ds-image-drop>
          <input type="file" class="ds-src-imgfile visually-hidden" accept="image/*" aria-label="${escapeText(t('Choose an image'))}">
          <span class="ds-src-drop-ic" aria-hidden="true">${icon('image')}</span>
          <span class="be-btn start-import-btn" aria-hidden="true">${t('Choose an image…')}</span>
          <span class="start-import-drophint">${t('or drag & drop it here')}</span>
        </label>
        <p class="ds-src-stage-note">${t('Start with a logo, screenshot or photo. Preview a suggested palette before applying it.')}</p>
      </section>
      <section class="ds-src-stage" data-ds-stage="page" hidden>
        <button type="button" class="be-btn be-btn--sm ds-src-back" data-ds-src-back>${t('All sources')}</button>
        <h3>${t('Start from a saved web page')}</h3>
        <p class="ds-src-stage-note">${t('Choose one HTML page with its CSS files, or CSS on its own. Up to 20 files, 2 MB in total.')}</p>
        <label class="start-import-drop ds-src-drop" data-page-drop>
          <input class="visually-hidden" type="file" data-page-files multiple accept=".html,.htm,.css,text/html,text/css" aria-label="${escapeText(t('Choose HTML and CSS files'))}">
          <span class="ds-src-drop-ic" aria-hidden="true">${icon('document')}</span>
          <span class="be-btn start-import-btn" aria-hidden="true">${t('Choose HTML and CSS files…')}</span>
          <span class="start-import-drophint" data-page-selection aria-live="polite">${t('or drag & drop them here')}</span>
        </label>
        <details class="ds-reference-details">
          <summary>${t('Paste HTML or CSS instead')}</summary>
          <label class="field-label" for="ds-page-format">${t('Source format')}</label>
          <select class="field-select" data-page-format id="ds-page-format"><option value="html">HTML</option><option value="css">CSS</option></select>
          <label class="field-label">${t('Page source')}
            <textarea class="field-input" data-page-text rows="6" spellcheck="false" autocapitalize="off"></textarea>
          </label>
        </details>
        <p class="ds-src-stage-note">${t('Read on this device. Linked files are not fetched and page scripts do not run.')}</p>
        <button type="button" class="be-cta is-active" data-page-read>${t('Find colours and fonts')}</button>
      </section>
      <section class="ds-src-stage" data-ds-stage="pdf" hidden>
        <button type="button" class="be-btn be-btn--sm ds-src-back" data-ds-src-back>${t('All sources')}</button>
        <label class="start-import-drop ds-src-drop" data-ds-pdf-drop>
          <input type="file" class="ds-src-pdffile visually-hidden" accept="application/pdf,.pdf,.ai" aria-label="${escapeText(t('Choose a PDF'))}">
          <span class="ds-src-drop-ic" aria-hidden="true">${icon('document')}</span>
          <span class="be-btn start-import-btn" aria-hidden="true">${t('Choose a PDF…')}</span>
          <span class="start-import-drophint">${t('or drag & drop it here')}</span>
        </label>
        <p class="ds-src-stage-note">${t('Colours and typefaces land in the tray. Marks wait until you send them to Logos.')}</p>
        <!-- tabindex="-1": the scan's answer is a status message with controls in
             it, so it takes focus when it appears rather than being read whole. -->
        <div class="ds-src-pdf-result" data-ds-pdf-result tabindex="-1" hidden></div>
      </section>
      ${
        siteReady
          ? `
      <!-- The website stage exists only where a transport does (plan 97 section 9): it
           is not rendered-and-disabled, it is not rendered at all. The button is
           the consent, and the line above it names the host and the reader. -->
      <section class="ds-src-stage" data-ds-stage="url" hidden>
        <button type="button" class="be-btn be-btn--sm ds-src-back" data-ds-src-back>${t('All sources')}</button>
        <div class="ds-src-url">
          <label class="field-label" for="ds-src-url-input">${t('Web address')}</label>
          <div class="ds-src-url-row">
            <input class="field-input ds-src-urlfield" id="ds-src-url-input" type="url" inputmode="url"
              autocomplete="off" spellcheck="false" placeholder="example.com"
              maxlength="${SITE_MAX_URL_CHARS}" aria-describedby="ds-src-url-consent ds-src-url-error">
            <button type="button" class="be-cta ds-src-url-go" data-ds-site-go>${t('Read the page')}</button>
          </div>
          <p class="ds-src-url-consent" id="ds-src-url-consent" data-ds-site-consent>${t(
            'Nothing is read until you press the button.'
          )}</p>
          <!-- A refusal stays HERE, named by the field's aria-describedby, so it
               can be re-read after the one polite announcement has passed. The
               field also takes aria-invalid; see siteFieldError. -->
          <p class="ds-src-note is-error" id="ds-src-url-error" data-ds-site-error hidden></p>
        </div>
        <p class="ds-src-stage-note">${t('Preview a suggested palette before applying it. Font names and marks remain yours to review.')}</p>
        <!-- tabindex="-1": same status-message-with-controls as the PDF card. -->
        <div class="ds-src-site-result" data-ds-site-result tabindex="-1" hidden></div>
      </section>`
          : ''
      }
      <p class="ds-src-note" data-ds-source-note aria-live="polite"></p>`,
    {
      className: 'modal start-import-modal',
      ariaLabel: escapeText(t('Add from…')),
      onClose: () => {
      const { importBtn, importHome, importPanel } = start;
        start.reference.cancelReference();
        start.importModal = null;
        if (start.shell.isConnected) updateRouteParams({ import: null, source: null });
        importHome.appendChild(importPanel); // back to the holder, still wired
        importBtn?.classList.remove('is-open');
      },
    }
  );
  const modalEl = start.importModal.el;
  start.savedPage.wireSavedPage();
  modalEl.querySelector<HTMLElement>('[data-import-mount]')!.appendChild(importPanel);
  modalEl.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const src = el.closest<HTMLElement>('[data-ds-source]')?.dataset.dsSource;
    if (src) {
      chooseSource(start, src as StartSource);
      playSfx('click');
      return;
    }
    if (el.closest('[data-ds-src-close]')) {
      closeImport(start);
      playSfx('click');
      return;
    }
    if (el.closest('[data-ds-src-back]')) {
      showStage(start, null);
      playSfx('click');
      return;
    }
    // The PDF result card's two presses. Delegated for the same reason the
    // design-file card's are: the card is rebuilt by every scan.
    const fontBtn = el.closest<HTMLButtonElement>('[data-ds-pdf-font]');
    if (fontBtn) {
      void start.pdf.addPdfFont(Number(fontBtn.dataset.dsPdfFont), fontBtn);
      return;
    }
    if (el.closest('[data-ds-pdf-logos]')) {
      start.pdf.sendPdfMarksToLogos();
      return;
    }
    // The website stage's three presses. The fetch button is the consent, so
    // it is the ONLY thing on this view that starts a read.
    const goBtn = el.closest<HTMLButtonElement>('[data-ds-site-go]');
    if (goBtn) {
      void start.site.scanSite(modalEl.querySelector<HTMLInputElement>('.ds-src-urlfield'), goBtn);
      return;
    }
    if (el.closest('[data-ds-site-logos]')) {
      start.site.sendSiteMarksToLogos();
      return;
    }
    const nameBtn = el.closest<HTMLButtonElement>('[data-ds-site-name]');
    if (nameBtn) void start.site.useSiteName(nameBtn);
  });
  const imgInput = modalEl.querySelector<HTMLInputElement>('.ds-src-imgfile');
  imgInput?.addEventListener('change', async () => {
    const file = imgInput.files?.[0];
    imgInput.value = ''; // so re-picking the same file re-fires
    if (file) await start.images.scanImageFile(file, start.sources.srcNote);
  });
  const imgDrop = modalEl.querySelector<HTMLElement>('[data-ds-image-drop]');
  imgDrop?.addEventListener('dragover', (e) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    imgDrop.classList.add('is-dragover');
  });
  imgDrop?.addEventListener('dragleave', (e) => {
    if (e.relatedTarget && imgDrop.contains(e.relatedTarget as Node)) return;
    imgDrop.classList.remove('is-dragover');
  });
  imgDrop?.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    imgDrop.classList.remove('is-dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file) void start.images.scanImageFile(file, start.sources.srcNote);
  });
  // The PDF stage's own mouth, wired exactly like the image stage's: a label
  // over a hidden input for the click, and the same three drag listeners
  // (stopPropagation so the shell's drag-anywhere doesn't handle it twice).
  const pdfInput = modalEl.querySelector<HTMLInputElement>('.ds-src-pdffile');
  pdfInput?.addEventListener('change', async () => {
    const file = pdfInput.files?.[0];
    pdfInput.value = ''; // so re-picking the same file re-fires
    if (file) await start.pdf.scanPdfFile(file, start.sources.srcNote);
  });
  const pdfDrop = modalEl.querySelector<HTMLElement>('[data-ds-pdf-drop]');
  pdfDrop?.addEventListener('dragover', (e) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    pdfDrop.classList.add('is-dragover');
  });
  pdfDrop?.addEventListener('dragleave', (e) => {
    if (e.relatedTarget && pdfDrop.contains(e.relatedTarget as Node)) return;
    pdfDrop.classList.remove('is-dragover');
  });
  pdfDrop?.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    pdfDrop.classList.remove('is-dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file) void start.pdf.scanPdfFile(file, start.sources.srcNote);
  });
  // The website stage's field. Its two jobs are to keep the consent notice
  // accurate while the address is typed, and to make Return do what the button does -
  // it is a single field beside a single action, and few users reach for the
  // mouse after typing an address.
  const urlField = modalEl.querySelector<HTMLInputElement>('.ds-src-urlfield');
  if (urlField) {
    const goEl = modalEl.querySelector<HTMLButtonElement>('[data-ds-site-go]');
    const consentEl = modalEl.querySelector<HTMLElement>('[data-ds-site-consent]');
    const syncConsent = (): void => {
    const { siteTransport } = start;
      // The address is parsed, never guessed at: until it resolves to a host
      // there is no host to name, and the button says so rather than
      // promising to read something nobody has described yet.
      const check = normalizeSiteUrl(urlField.value);
      const named = check.ok ? check.siteHost : '';
      if (goEl && goEl.getAttribute('aria-disabled') !== 'true') {
        goEl.textContent = named ? t('Read {host}', { host: named }) : t('Read the page');
      }
      if (consentEl) {
        // WHO reads it is half the fact; the other half is AS WHOM. The
        // extension opens the page in the browser the person is signed into,
        // so a logged-in dashboard comes back rendered with their name in it;
        // the native fetch builds a client with no cookie store, so it gets
        // the logged-out page. Same button, materially different act, and the
        // sentence somebody consents to has to carry the difference.
        consentEl.textContent = !named
          ? t('Nothing is read until you press the button.')
          : siteTransport?.kind === 'extension'
            ? t('The extension reads {host} in a background tab, signed in as you.', {
                host: named,
              })
            : t('The app fetches {host} directly, signed in to nothing.', { host: named });
      }
    };
    urlField.addEventListener('input', () => {
      start.site.clearSiteFieldError();
      syncConsent();
    });
    urlField.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return; // Escape belongs to the dialog, untouched
      e.preventDefault();
      void start.site.scanSite(urlField, goEl);
    });
    // `?source=url&u=` - a PREFILL and nothing else. It is consumed here, once,
    // so a remount cannot re-fill a field somebody deliberately cleared, and no
    // code path turns it into a press.
    if (start.urlPrefill) {
      urlField.value = start.urlPrefill;
      start.urlPrefill = '';
    }
    syncConsent();
  }
  importBtn?.classList.add('is-open');
  showStage(start, source);
}
export const closeImport = (start: StartCtx): void => start.importModal?.close();
export function wireSources(start: StartCtx): void {
  const { importBtn, importOpen, route, shell } = start;
  importBtn?.addEventListener('click', () => {
    start.sources.openImport();
    playSfx('click');
  });
  // A file the FRONT DOOR handed over: the drop chooser's "Use as the design
  // system" (lib/drop-router.ts) stashes the dropped file and routes here, so the
  // studio opens on that file instead of asking for it a second time. One-shot
  // and cleared on read, like every other stash that router arms, and consumed on
  // mount like every other read-only arrival flag. Routed by what it IS, so the
  // PDF chooser's door and the token document's door both land where they should
  // - and the `?source=` in the URL is only the fallback for a stash that has
  // already been spent (a remount).
  const handedOver = takePendingDesignSystemFile(); start.handedOver = handedOver as StartCtx['handedOver'];
  // A link can still arrive with the importer open (`#/start?import`), which is how
  // an "add your design system" entry point elsewhere hands off. `?source=<kind>`
  // opens it on that source and is consumed here - selectRoom's replaceState
  // already dropped both from the URL. `?import=0` is the historic form for
  // "leave it shut" and stays a no-op against today's default.
  if (handedOver) void start.tokens.routeDroppedFile(handedOver);
  else if (importOpen) start.sources.openImport(route.source);

  // Dragging a file anywhere over the studio opens the importer, so the drop has
  // somewhere to land - a modal you must open first would otherwise take away the
  // drag & drop the card advertises. A drop that never reached the card is routed
  // by what it IS (see routeDroppedFile), so an image dragged onto the page is a
  // colour scan rather than a failed token parse.
  shell.addEventListener('dragover', (e) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    // A drag reports its items' TYPE (never their data), which is enough to open
    // on the stage the drop is about to need instead of flashing the wrong one.
    const dragged = e.dataTransfer.items?.[0]?.type ?? '';
    const stage: StartSource =
      dragged === 'application/pdf'
        ? 'pdf'
        : dragged.startsWith('image/') && dragged !== 'image/svg+xml'
          ? 'image'
          : 'file';
    if (!start.importModal) start.sources.openImport(stage);
  });
  shell.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    e.preventDefault();
    void start.tokens.routeDroppedFile(file);
  });
}

export function sourcesOps(start: StartCtx) {
  return {
    sourceTiles: bindOp(start, sourceTiles),
    srcNote: bindOp(start, srcNote),
    showStage: bindOp(start, showStage),
    chooseSource: bindOp(start, chooseSource),
    openImport: bindOp(start, openImport),
    closeImport: bindOp(start, closeImport),
    wireSources: bindOp(start, wireSources),
  };
}
