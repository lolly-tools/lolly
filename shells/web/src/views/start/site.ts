// SPDX-License-Identifier: MPL-2.0
/**
 * start: site.
 *
 * Every function takes the shared `start: StartCtx` first (see context.ts). Sibling
 * calls in this file are direct; a call into another module, and every use of a
 * function as a value (an event listener), goes through `start.<module>.<fn>`. Extracted verbatim
 * from mountStart() by scripts/split-closure.ts.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { announce } from '../../a11y.ts';
import { applyChromeBrandVars } from '../../brand-vars.ts';
import { installUserTokens } from '../../bridge/tokens.ts';
import { t, tRaw, tn } from '../../i18n.ts';
import { stashPendingLogoFiles } from '../../lib/design-system/pending-files.ts';
import { SITE_MAX_URL_CHARS, normalizeSiteUrl, scanWebsite } from '../../lib/design-system/sources/website.ts';
import type { SiteScanPhase, SiteScanResult, SiteScanWarning } from '../../lib/design-system/sources/website.ts';
import { readSystemName } from '../../lib/design-system/type-compare.ts';
import { playSfx } from '../../lib/sfx.ts';
import { escape as escapeText } from '../../utils.ts';
import { LOGO_ROOM_MIME, SITE_READ_BUDGET_MS, markExtension } from './shared.ts';
import { bindOp, type StartCtx } from './context.ts';

export const siteResultEl = (start: StartCtx): HTMLElement | null =>
  start.importModal?.el.querySelector<HTMLElement>('[data-ds-site-result]') ?? null;
/** Why a scan produced nothing, in this view's words. The source module
 *  reports machine reasons precisely so the copy lives here. */
//
// t() OR tRaw() IS A DECISION HERE, not a habit. scripts/translate.ts finds
// keys by scanning source for a literal `t(` call, so a `tRaw(` string is
// English forever unless somebody hand-lists it. Every sentence whose only
// parameter is a HOSTNAME or a NUMBER therefore uses t(): those cannot carry
// an HTML-special character (a hostname comes out of `new URL().hostname`),
// so the escaping t() adds is a no-op and the string becomes translatable.
// The two that stay tRaw are the two whose parameter is free text off a
// third-party page or out of the field - escaping those would show somebody
// `O&#39;Brien` in a sentence that is written to `textContent`.
export function siteRefusalText(start: StartCtx, 
  refusal: Extract<SiteScanResult, { kind: 'refused' }>,
  typed: string
): string {
  switch (refusal.reason) {
    case 'empty-url':
      return t('Type a web address first.');
    case 'unsupported-scheme':
      return t('Only an http or https address can be read.');
    case 'credentials-in-url':
      return t('That address carries a username and password. Take them out and try again.');
    case 'url-too-long':
      return t('That address is too long (limit {n} characters).', {
        n: refusal.limit ?? SITE_MAX_URL_CHARS,
      });
    case 'unparseable-url':
      return tRaw('{value} is not a web address.', { value: typed });
    // The tile is not rendered without a transport, so this is defence in
    // depth rather than a state somebody can press their way into.
    case 'no-transport':
      return t(
        'This app cannot read a website. The desktop app can, and so can Chromium with the Lolly extension.'
      );
    case 'timeout':
      return t('{host} took too long to answer.', { host: start.siteHostName });
    case 'empty-page':
      return t('{host} answered with no page to read.', { host: start.siteHostName });
    default:
      return t('{host} could not be read.', { host: start.siteHostName });
  }
}
/**
 * A refusal put where the field is, not only where the note is.
 *
 * The sentence is announced (once, assertively) AND left in a static element
 * the field names through `aria-describedby`, with `aria-invalid` on the
 * field itself. WCAG 3.3.1 asks for the error to be identified; a live region
 * alone identifies it in TIME but not in PLACE, so somebody who tabs back to
 * the address a minute later has nothing to re-read. Same shape as the
 * Versions panel's slug field.
 */
export function siteFieldError(start: StartCtx, msg: string): void {
  const modalEl = start.importModal?.el;
  const field = modalEl?.querySelector<HTMLInputElement>('.ds-src-urlfield');
  const errEl = modalEl?.querySelector<HTMLElement>('[data-ds-site-error]');
  if (!field || !errEl) {
    start.sources.srcNote(msg, true);
    return;
  } // no stage: say it in the note
  // The progress line said "Reading suse.com…"; leaving that under a refusal
  // would be the dialog claiming two things at once.
  start.sources.srcNote('');
  errEl.textContent = msg;
  errEl.hidden = false;
  field.setAttribute('aria-invalid', 'true');
  announce(msg, { assertive: true });
}
/** Clears it. Called when the address changes and when a read succeeds - the
 *  refusal was about an address that no longer stands. */
export function clearSiteFieldError(start: StartCtx): void {
  const modalEl = start.importModal?.el;
  const errEl = modalEl?.querySelector<HTMLElement>('[data-ds-site-error]');
  if (errEl && !errEl.hidden) {
    errEl.hidden = true;
    errEl.textContent = '';
  }
  modalEl?.querySelector<HTMLInputElement>('.ds-src-urlfield')?.removeAttribute('aria-invalid');
}
/** A partial read said plainly. Each line is one FACT about what did not
 *  happen - a card that stays silent about a truncated page is claiming to
 *  have read the whole of it. */
export function siteWarningText(_start: StartCtx, warnings: readonly SiteScanWarning[]): string[] {
  const out: string[] = [];
  if (warnings.includes('html-truncated') || warnings.includes('css-truncated')) {
    out.push(t('That page is very large, so only the first part of it was read.'));
  }
  if (warnings.includes('screenshot-failed')) {
    out.push(
      t('The picture of the page could not be read, so only the colours it declares were used.')
    );
  }
  if (
    warnings.includes('logo-not-image') ||
    warnings.includes('logo-too-large') ||
    warnings.includes('assets-truncated')
  ) {
    out.push(t('Some of the marks on the page could not be used.'));
  }
  return out;
}
/** One logo candidate as a file the Logos room accepts, or null. Named after
 *  the page it came from so a mark arrives recognisable rather than as
 *  "logo.svg" - the same courtesy the PDF hand-off pays. */
export function siteMarkFile(start: StartCtx, url: string, bytes: Uint8Array, mime: string, index: number): File | null {
  const ext = markExtension(mime);
  if (!ext) return null;
  let stem = '';
  try {
    const path = new URL(url).pathname;
    stem = (path.split('/').pop() ?? '').replace(/\.[^.]+$/, '');
  } catch {
    /* an unresolvable URL simply names itself after the host */
  }
  stem = stem
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  // `hostPart`, not `host`: the view's own `host` is the bridge, and shadowing
  // it inside a helper that also uses the design system risks bugs.
  const hostPart = start.siteHostName.replace(/[^a-z0-9.-]+/gi, '-') || 'site';
  const name = stem ? `${hostPart}-${stem}.${ext}` : `${hostPart}-mark-${index + 1}.${ext}`;
  return new File([bytes as unknown as BlobPart], name, { type: mime });
}
/**
 * One page, read once, on the press of the button that named it.
 *
 * The order is the privacy posture: the address is validated before anything
 * (a refusal costs no fetch), the transport is called exactly once for that
 * one address, and everything after it is parsing on this device. The scan
 * never throws - a hostile page must cost a sentence, not the dialog.
 */
export async function scanSite(start: StartCtx, 
  field: HTMLInputElement | null,
  btn: HTMLButtonElement | null
): Promise<void> {
  const { host, siteTransport } = start;
  if (!siteTransport || btn?.getAttribute('aria-disabled') === 'true') return;
  start.reference.cancelReference();
  const revision = start.referenceRevision;
  start.importModal?.el.querySelector('[data-ds-stage="url"] [data-reference-review]')?.remove();
  const raw = field?.value ?? '';
  start.siteMarks = [];
  start.siteNameOffer = '';
  const before = siteResultEl(start);
  if (before) {
    before.hidden = true;
    before.textContent = '';
  }
  clearSiteFieldError(start);

  // Escape CANCELS, and a cancel keeps nothing. A read in flight cannot be
  // called back (the transport owns the tab or the socket), so the cancel is
  // enforced where it matters: the commit. Identity, not truthiness - the
  // same rule the PDF scan follows.
  //
  // "All sources" counts as a cancel too, and that is not a nicety. The stage
  // it leaves is `display: none`, so a result landing behind it would un-hide
  // a card inside a hidden section, announce "3 marks found" and then call
  // focus() on an element that cannot take focus - an announcement with no
  // destination. Back and Escape now mean the same thing, which is also the
  // simpler sentence to hold in your head.
  const startedIn = start.importModal;
  const stageGone = (): boolean =>
    !!startedIn?.el.querySelector<HTMLElement>('[data-ds-stage="url"]')?.hidden;
  const cancelled = (): boolean =>
    { const { shell } = start; return start.referenceRevision !== revision || field?.value !== raw || (!!startedIn && start.importModal !== startedIn) || !shell.isConnected || stageGone(); };

  // Only for the progress line and the words said about it; `scanWebsite`
  // validates the address itself and is the authority on refusing one.
  const check = normalizeSiteUrl(raw);
  start.siteHostName = check.ok ? check.siteHost : '';

  // Busy is aria-disabled, never `disabled`: disabling the button under the
  // press hands focus to the body, and on the refusal path below there would
  // be nothing to hand it back to.
  if (btn) {
    btn.setAttribute('aria-disabled', 'true');
    btn.textContent = t('Reading…');
  }
  // Re-derived from the field rather than restored from a captured string:
  // the address can be edited while a read runs (the field is live, only the
  // button is busy), and a label naming the previous host would then be
  // offering to read something the field no longer says.
  const restore = (): void => {
    if (!btn?.isConnected) return;
    btn.removeAttribute('aria-disabled');
    const now = normalizeSiteUrl(field?.value ?? '');
    btn.textContent = now.ok ? t('Read {host}', { host: now.siteHost }) : t('Read the page');
  };

  const result = await scanWebsite(
    siteTransport,
    raw,
    (phase: SiteScanPhase) => {
      // A cancelled read stops talking: `srcNote` falls back to the rail when
      // the dialog is gone, so without this the progress of a read nobody is
      // waiting for keeps posting itself onto the page behind it.
      if (cancelled()) return;
      if (phase === 'fetch') start.sources.srcNote(t('Reading {host}…', { host: start.siteHostName }));
      else if (phase === 'read') start.sources.srcNote(t('Reading the colours, type and marks…'));
      else if (phase === 'paint') start.sources.srcNote(t('Reading the colours as painted…'));
    },
    { timeoutMs: SITE_READ_BUDGET_MS, host: host as unknown as HostV1 }
  );

  // The dialog went away while the read ran: the person cancelled, so the
  // findings are dropped whole and nothing is said. A rail note reporting
  // colours somebody just cancelled out of is the confusing half of a
  // half-cancel - and the marks and the name were being discarded anyway.
  restore();
  if (cancelled()) return;

  if (result.kind === 'refused') {
    siteFieldError(start, siteRefusalText(start, result, raw));
    return;
  }

  start.siteHostName = result.siteHost || start.siteHostName;
  // A mark travels only if the Logos room would take it (an .ico favicon is
  // common and it would not), and only with bytes - a URL alone is nothing
  // this device holds.
  let listedOnly = 0;
  let refusedFormat = 0;
  result.logoCandidates.forEach((cand, i) => {
    if (!cand.bytes || !cand.mime) {
      listedOnly++;
      return;
    }
    if (!LOGO_ROOM_MIME.test(cand.mime)) {
      refusedFormat++;
      return;
    }
    const file = siteMarkFile(start, cand.url, cand.bytes, cand.mime, i);
    if (file) start.siteMarks.push(file);
  });

  // The name is a SUGGESTION and only where there is none: a page's <title>
  // is a guess about what somebody calls their design system, and overwriting
  // a name they chose with it would be the studio talking over them.
  const named = await readSystemName(host as unknown as HostV1).catch(() => null);
  if (cancelled()) return;
  if (!named && result.siteName) start.siteNameOffer = result.siteName.slice(0, 60);

  renderSiteResult(start, {
    marks: start.siteMarks.length,
    listedOnly,
    refusedFormat,
    families: result.googleFamilies,
    warnings: result.warnings,
    usedScreenshot: result.usedScreenshot,
  });
  start.reference.reviewReference(result.census, { method: 'website', label: start.siteHostName });
}
/**
 * The website stage's result card: what one page turned out to hold, and the
 * two decisions it offers without leaving the dialog.
 *
 * Same construction as the PDF card, and for the same reason: it is a status
 * message with controls in it, so its one-sentence summary is SPOKEN and then
 * focus moves into it. Focus alone announces nothing - a `tabindex="-1"` div
 * has no role and no name - so the marks, the type and the caveats would go
 * unheard behind the tray's own count.
 */
export function renderSiteResult(start: StartCtx, o: {
  marks: number;
  listedOnly: number;
  refusedFormat: number;
  families: readonly string[];
  warnings: readonly SiteScanWarning[];
  usedScreenshot: boolean;
}): void {
  const el = siteResultEl(start);
  if (!el) return; // the dialog closed while the read ran - the tray still has it
  const warnings = siteWarningText(start, o.warnings);
  const familyList = o.families.slice(0, 6).join(', ');

  el.innerHTML = `
      <p class="start-import-name">${escapeText(start.siteHostName)}<span class="start-import-source">${t('Website')}</span></p>
      ${o.usedScreenshot ? `<p class="start-import-stats">${t('The colours it is painted with were read too, not only the ones it declares.')}</p>` : ''}
      ${warnings.map((w) => `<p class="start-import-warn">${escapeText(w)}</p>`).join('')}
      ${
        /* Each plural is TWO whole t() calls, not one t() over a ternary:
            scripts/translate.ts finds literal call sites by scanning source, so
            a string spelled inside a conditional never reaches a translator
            unless somebody remembers to hand-list it in extra-keys.spa.json. */ ''
      }
      ${
        o.marks
          ? `
        <div class="start-color-actions">
          <button type="button" class="be-btn be-btn--sm ds-site-act" data-ds-site-logos>${
            o.marks === 1
              ? t('Review {n} mark in Logos', { n: o.marks })
              : t('Review {n} marks in Logos', { n: o.marks })
          }</button>
        </div>`
          : ''
      }
      ${
        o.refusedFormat
          ? `<p class="start-import-stats">${
              o.refusedFormat === 1
                ? t('{n} more mark is in a format Logos does not take (PNG, JPEG, SVG or WebP).', {
                    n: o.refusedFormat,
                  })
                : t('{n} more marks are in formats Logos does not take (PNG, JPEG, SVG or WebP).', {
                    n: o.refusedFormat,
                  })
            }</p>`
          : ''
      }
      ${
        o.listedOnly
          ? `<p class="start-import-stats">${
              o.listedOnly === 1
                ? t('The page lists {n} more mark whose file was not read.', { n: o.listedOnly })
                : t('The page lists {n} more marks whose files were not read.', { n: o.listedOnly })
            }</p>`
          : ''
      }
      ${familyList ? `<p class="start-import-stats">${t('Google Fonts on this page: {list}. Type installs them.', { list: familyList })}</p>` : ''}
      ${
        start.siteNameOffer
          ? `
        <div class="start-color-actions">
          <button type="button" class="be-btn be-btn--sm ds-site-act" data-ds-site-name>${t(
            'Use {name} as the design system name',
            { name: start.siteNameOffer }
          )}</button>
        </div>`
          : ''
      }
      ${
        !o.marks && !familyList && !start.siteNameOffer && !warnings.length
          ? `<p class="start-import-stats">${t('Review the suggested colours below before applying them.')}</p>`
          : ''
      }`;
  el.hidden = false;

  // What the card SAYS, in one line: the counts it offers a decision on, plus
  // any part of the read that did not run. Deliberately not the whole card
  // read aloud, and deliberately not the tray count - keepInTray already said
  // that through the dialog's own note line.
  const said: string[] = [...warnings];
  if (o.marks)
    said.push(tn('1 mark found', '{n} marks found', { n: o.marks }));
  if (familyList) said.push(tRaw('Type: {list}', { list: familyList }));
  if (start.siteNameOffer) said.push(tRaw('This page calls itself {name}.', { name: start.siteNameOffer }));
  if (!said.length) said.push(t('Nothing beyond the colours came out of this page.'));
  announce(said.join(' '));
  el.focus();
}
/**
 * The marks, to the Logos room - the same door the PDF stage uses, so a mark
 * arrives and is classified identically whichever source sent it. Nothing is
 * installed by this: the room queues confirm chips.
 *
 * The stash is armed HERE rather than at scan time, because it survives one
 * navigation and is drained by the room's paint: arming it for a scan nobody
 * acted on would drop chips into some later visit that were never asked for.
 */
export function sendSiteMarksToLogos(start: StartCtx): void {
  if (!start.siteMarks.length) return;
  const { sent } = stashPendingLogoFiles(start.siteMarks);
  if (!sent) {
    start.sources.srcNote(
      start.siteMarks.length === 1
        ? t('That mark is over the 4 MB limit, so it was not sent.')
        : t('Those marks are all over the 4 MB limit, so none were sent.'),
      true
    );
    return;
  }
  // Said out loud rather than into the dialog's note: the remount takes the
  // dialog with it, and the live region is body-mounted and survives it.
  if (sent < start.siteMarks.length) {
    // t(), not tRaw(): both parameters are counts, so the escaping is a no-op
    // and the sentence becomes something a translator can actually see.
    announce(
      t('{n} of {total} marks were sent. The rest are over the 4 MB limit.', {
        n: sent,
        total: start.siteMarks.length,
      })
    );
  }
  playSfx('click');
  start.pdf.sendToLogosRoom();
}
/**
 * Name the design system after the page, on one press.
 *
 * The name is the tokens asset's own label, so this is a head write with a
 * label and no change to the document: `refreshHead` first, every time, so
 * the write carries whatever the rooms have installed since this view mounted
 * rather than the snapshot it opened with.
 *
 * No checkpoint, unlike an install: nothing is replaced, the document is
 * byte-identical either side, and the way back is to type another name. It is
 * only offered where there is no name to overwrite (see the scan), so it
 * cannot take one away.
 */
export async function useSiteName(start: StartCtx, btn: HTMLButtonElement): Promise<void> {
  const { host } = start;
  const name = start.siteNameOffer;
  if (!name || btn.getAttribute('aria-disabled') === 'true') return;
  const was = btn.textContent;
  btn.setAttribute('aria-disabled', 'true');
  btn.textContent = t('Naming…');
  try {
    await start.exporting.refreshHead();
    if (!start.headDoc) throw new Error(t('There is nothing to name yet. Add a colour first.'));
    await installUserTokens(host, start.headDoc, { label: name });
    void applyChromeBrandVars(host); // bust() cleared the caches; nothing repaints by itself
  } catch (err) {
    announce(String((err as { message?: unknown })?.message ?? err), { assertive: true });
    if (!btn.isConnected) return;
    btn.textContent = t('Could not name it');
    setTimeout(() => {
      if (!btn.isConnected) return;
      btn.textContent = was;
      btn.removeAttribute('aria-disabled');
    }, 1800);
    return;
  }
  // Said before the button is touched: the name was saved whether or not the
  // dialog is still open, and a closed dialog must not swallow the sentence.
  announce(tRaw('The design system is called {name} now', { name }));
  playSfx('save');
  if (!btn.isConnected) return;
  btn.textContent = t('Named');
  btn.classList.add('is-added');
}
export function siteOps(start: StartCtx) {
  return {
    siteResultEl: bindOp(start, siteResultEl),
    siteRefusalText: bindOp(start, siteRefusalText),
    siteFieldError: bindOp(start, siteFieldError),
    clearSiteFieldError: bindOp(start, clearSiteFieldError),
    siteWarningText: bindOp(start, siteWarningText),
    siteMarkFile: bindOp(start, siteMarkFile),
    scanSite: bindOp(start, scanSite),
    renderSiteResult: bindOp(start, renderSiteResult),
    sendSiteMarksToLogos: bindOp(start, sendSiteMarksToLogos),
    useSiteName: bindOp(start, useSiteName),
  };
}
