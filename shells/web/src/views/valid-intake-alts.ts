// SPDX-License-Identifier: MPL-2.0
/**
 * /verify's two alternatives to dropping a file: "Paste text" and "Add from URL".
 *
 * The markup and the wiring of both panels, lifted out of mountValid (views/valid.ts).
 * They move as one because they are one control: the panels share a row, a set of
 * classes and the layout's `is-pasting` / `is-linking` states, and opening one closes
 * the other. mountValid lends the checks the panels end in (the pasted-text path, the
 * same-site fetch, the hand-off of a fetched file) and keeps everything else.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { icon as glyph, type IconName } from '../lib/icons.ts';
import { t, tRaw } from '../i18n.ts';
import { fetchImageUrlAsFile, AddViaUrlError } from '../lib/add-via-url.ts';
import { classifyPastedUrl } from './valid-text.ts';

/** The same glyph weight valid.ts uses for its intake buttons. */
const svgIcon = (name: IconName): string => glyph(name, { strokeWidth: 1.9 });

/** The `.valid-paste` block under the drop zone: both open buttons and both panels. */
export function intakeAltsHtml(): string {
  // "Add from URL" is a form, so Enter submits. It uses the same fetcher as the asset
  // picker and the catalogue (lib/add-via-url.ts).
  return `<div class="valid-paste">
          <div class="valid-intake-alts">
            <button type="button" class="btn valid-paste-open" data-paste-open aria-expanded="false" aria-controls="valid-paste-panel">${svgIcon('clipboard')}<span>${t('Paste text')}</span></button>
            <button type="button" class="btn valid-url-open" data-url-open aria-expanded="false" aria-controls="valid-url-panel">${svgIcon('link')}<span>${t('Add from URL…')}</span></button>
          </div>
          <div class="valid-paste-panel" id="valid-paste-panel" data-paste-panel hidden>
            <label class="valid-paste-label" for="valid-paste-text">${t('Paste the text, markup or source you want to check')}</label>
            <textarea id="valid-paste-text" class="valid-paste-text" data-paste-text rows="8" spellcheck="false" autocomplete="off"></textarea>
            <div class="valid-paste-actions">
              <button type="button" class="btn valid-paste-verify" data-paste-verify>${t('Verify this text')}</button>
              <button type="button" class="btn valid-paste-cancel" data-paste-cancel>${t('Cancel')}</button>
            </div>
            <p class="valid-paste-foot">${t('The text is checked on this device, exactly as pasted. Invisible characters matter here - a C2PA text credential is made of them - so paste rather than retype.')}</p>
          </div>
          <form class="valid-paste-panel valid-url-panel" id="valid-url-panel" data-url-panel novalidate hidden>
            <label class="valid-paste-label" for="valid-url-input">${t('File address')}</label>
            <input type="url" id="valid-url-input" class="valid-url-input field-input" data-url-input inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://">
            <div class="valid-paste-actions">
              <button type="submit" class="btn btn--primary" data-url-go>${t('Verify')}</button>
              <button type="button" class="btn" data-url-cancel>${t('Cancel')}</button>
            </div>
            <p class="valid-url-error" data-url-error role="alert" hidden></p>
            <p class="valid-paste-foot">${t("The file is downloaded, then checked on this device. In the web app, images from other sites come through Lolly's own relay.")}</p>
          </form>
        </div>`;
}

/** What mountValid lends the panels. */
export interface IntakeAltsDeps {
  /** Only `log` is used: a failed fetch is logged as a warning. */
  host: Pick<HostV1, 'log'>;
  /** `.valid-layout`: `has-results` is read here, `is-pasting` and `is-linking` are set and cleared. */
  layoutEl: HTMLElement;
  /** mountValid's handlePastedText: where "Verify this text" hands the text. */
  checkText: (text: string) => Promise<void>;
  /** mountValid's verifyFromUrl: fetch one of this site's own files, then check the bytes. */
  verifyFromUrl: (url: string, onFail: (host: string) => string) => Promise<void>;
  /** Check a file fetched from `url`. The address becomes the file's own, so a relative
   *  credential reference in it resolves against that (NoticeContext.base), as for ?src=. */
  checkFetched: (file: File, url: string) => Promise<void>;
}

export interface IntakeAlts {
  /** Open "Add from URL" (closing "Paste text"), optionally filled in with an address. */
  openUrl(prefill?: string): void;
}

/**
 * Wire both panels, the drop zone row's open buttons and the header's
 * `[data-result-paste]` / `[data-result-url]` buttons that reopen them over a report.
 */
export function wireIntakeAlts(viewEl: HTMLElement, deps: IntakeAltsDeps): IntakeAlts {
  const { host, layoutEl } = deps;

  // The visible fallback. The clipboard is NEVER read programmatically here -
  // navigator.clipboard.readText() would raise a permission prompt for a page
  // that has not been asked to read anything, and on the platforms where the
  // paste event is awkward (an iPad without a keyboard, a locked-down browser)
  // the honest answer is a plain textarea the person pastes into themselves.
  const pasteOpen = viewEl.querySelector<HTMLButtonElement>('[data-paste-open]')!;
  const pastePanel = viewEl.querySelector<HTMLElement>('[data-paste-panel]')!;
  const pasteText = viewEl.querySelector<HTMLTextAreaElement>('[data-paste-text]')!;
  const setPasteOpen = (open: boolean, restoreFocus = false): void => {
    pastePanel.hidden = !open;
    pasteOpen.setAttribute('aria-expanded', String(open));
    if (open) pasteText.focus();
    else {
      layoutEl.classList.remove('is-pasting');
      if (restoreFocus) pasteOpen.focus();
    }
  };
  pasteOpen.addEventListener('click', () => setPasteOpen(pastePanel.hidden));
  viewEl.querySelector<HTMLButtonElement>('[data-paste-cancel]')!
    .addEventListener('click', () => setPasteOpen(false, true));
  viewEl.querySelector<HTMLButtonElement>('[data-paste-verify]')!.addEventListener('click', () => {
    const text = pasteText.value;
    if (!text.trim()) { pasteText.focus(); return; }
    setPasteOpen(false);
    void deps.checkText(text);
  });
  // House rule: Esc closes the panel and hands focus back to the button that opened
  // the panel. Scoped to the panel, so it can't swallow an Esc meant for anything else.
  pastePanel.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    setPasteOpen(false, true);
  });
  viewEl.querySelector<HTMLButtonElement>('[data-result-paste]')!
    .addEventListener('click', () => {
      setUrlOpen(false);
      layoutEl.classList.add('is-pasting');
      setPasteOpen(true);
    });

  // "Add from URL" - the asset picker's fetcher (lib/add-via-url.ts): same-origin
  // and data: URLs directly, any origin directly in Tauri or a dev build, and the
  // app's own image relay on the hosted web. `anyType` because a PDF or a video
  // is as checkable as an image wherever the shell can reach the address. Only ever runs
  // on the person's own submit.
  const urlOpen = viewEl.querySelector<HTMLButtonElement>('[data-url-open]')!;
  const urlPanel = viewEl.querySelector<HTMLFormElement>('[data-url-panel]')!;
  const urlInput = viewEl.querySelector<HTMLInputElement>('[data-url-input]')!;
  const urlGo = viewEl.querySelector<HTMLButtonElement>('[data-url-go]')!;
  const urlError = viewEl.querySelector<HTMLElement>('[data-url-error]')!;
  const resultUrl = viewEl.querySelector<HTMLButtonElement>('[data-result-url]')!;
  let urlBusy = false;
  function setUrlOpen(open: boolean, restoreFocus = false): void {
    urlPanel.hidden = !open;
    urlOpen.setAttribute('aria-expanded', String(open));
    urlError.hidden = true;
    if (open) urlInput.focus();
    else {
      layoutEl.classList.remove('is-linking');
      // Results mode hides the intake row, so focus goes back to the header button.
      if (restoreFocus) (layoutEl.classList.contains('has-results') ? resultUrl : urlOpen).focus();
    }
  }
  function openUrlPanel(prefill = ''): void {
    setPasteOpen(false);
    layoutEl.classList.remove('is-pasting');
    if (layoutEl.classList.contains('has-results')) layoutEl.classList.add('is-linking');
    if (prefill) urlInput.value = prefill;
    setUrlOpen(true);
  }
  urlOpen.addEventListener('click', () => { if (urlPanel.hidden) openUrlPanel(); else setUrlOpen(false, true); });
  pasteOpen.addEventListener('click', () => setUrlOpen(false));
  resultUrl.addEventListener('click', () => openUrlPanel());
  viewEl.querySelector<HTMLButtonElement>('[data-url-cancel]')!.addEventListener('click', () => setUrlOpen(false, true));
  urlPanel.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    setUrlOpen(false, true);
  });
  urlPanel.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = urlInput.value.trim();
    if (!value) { urlInput.focus(); return; }
    if (urlBusy) return;
    // A bare `/path` is this site's own file: the ?src= path, same gate.
    const own = classifyPastedUrl(value, location.origin);
    if (own?.kind === 'same-origin') {
      urlInput.value = '';
      setUrlOpen(false);
      await deps.verifyFromUrl(own.path, () => tRaw('Could not read {src} from this site.', { src: own.path }));
      return;
    }
    if (!/^https?:\/\//i.test(value)) {
      urlError.textContent = t('Enter an address that starts with https://');
      urlError.hidden = false;
      return;
    }
    urlBusy = true;
    urlGo.disabled = true;
    urlGo.textContent = t('Fetching…');
    urlError.hidden = true;
    try {
      const file = await fetchImageUrlAsFile(value, { anyType: true });
      urlInput.value = '';
      setUrlOpen(false);
      await deps.checkFetched(file, value);
    } catch (err) {
      urlError.textContent = err instanceof AddViaUrlError
        ? err.message
        : t('That address could not be reached from this browser.');
      urlError.hidden = false;
      host.log?.('warn', 'Verify: add from URL failed', { error: String(err) });
    } finally {
      urlBusy = false;
      urlGo.disabled = false;
      urlGo.textContent = t('Verify');
    }
  });

  return { openUrl: openUrlPanel };
}
