// SPDX-License-Identifier: MPL-2.0
/**
 * Verify's Approved and Made for panels: what a credential records about why a file
 * exists and whether someone approved the file. Verify and the asset inspector share them,
 * the way they share "Made from".
 *
 * Each is a statement the signer made, so the wording follows the AI declaration:
 * who says so and how far that signer is known, never a verdict on the work.
 *
 * A recorded prompt is text someone wrote, carried inside a file. It is only ever
 * written as escaped text in a quoted block, with no markup and no links, so it cannot
 * act on this page and cannot read as Lolly speaking.
 */
import { escape as escapeText } from '../utils.ts';
import { t, tRaw, currentLang } from '../i18n.ts';
import { icon as glyph } from '../lib/icons.ts';
import { formatMetaInstant } from '../lib/meta-dates.ts';
import { metaRow } from '../lib/meta-rows.ts';
import { copyText } from '../lib/copy-text.ts';
import { brandPageHost } from '../../../../engine/src/brand-page-address.ts';
import { isFingerprint } from './valid-made-from.ts';
import { metadataLinkHtml, wireMetadataLinks } from './valid-links.ts';
import { hashFailed, isExpiredOnly, resolveState } from './valid-verdict.ts';
import type { VerifyReport } from './valid-verdict.ts';

const svgIcon = (name: Parameters<typeof glyph>[0]): string => glyph(name, { strokeWidth: 1.9 });

const row = (label: string, value: string): string =>
  `<div class="valid-input-row"><dt>${escapeText(label)}</dt><dd>${value}</dd></div>`;
const plain = (value: string): string => `<span>${escapeText(value)}</span>`;

/** The purpose in the reader's words. A purpose from a newer vocabulary reads as written. */
function purposeWords(purpose: string): string {
  const words: Record<string, string> = {
    announce: t('Announce'), compare: t('Compare'), demonstrate: t('Demonstrate'), direct: t('Direct'),
    explain: t('Explain'), identify: t('Identify'), invite: t('Invite'), offer: t('Offer'),
    present: t('Present'), promote: t('Promote'), recognise: t('Recognise'), report: t('Report'), schedule: t('Schedule'),
  };
  return Object.hasOwn(words, purpose) ? words[purpose]! : purpose;
}

/** A named surface in words, or a recorded size such as `1200x628px` as a size. */
function surfaceWords(surface: string): string {
  const words: Record<string, string> = {
    slide: t('Slide'), screen: t('Screen'), 'social-landscape': t('Social, landscape'), 'social-square': t('Social, square'),
    'social-portrait': t('Social, portrait'), story: t('Story'), banner: t('Banner'),
    'a4-portrait': t('A4, portrait'), 'a4-landscape': t('A4, landscape'), 'a3-portrait': t('A3, portrait'), 'a3-landscape': t('A3, landscape'),
    'a2-portrait': t('A2, portrait'), 'a2-landscape': t('A2, landscape'), 'a1-portrait': t('A1, portrait'),
    'letter-portrait': t('Letter, portrait'), 'letter-landscape': t('Letter, landscape'), 'business-card': t('Business card'),
  };
  if (Object.hasOwn(words, surface)) return words[surface]!;
  const size = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)(px|mm|cm|in|pt)$/.exec(surface);
  return size ? `${size[1]} × ${size[2]} ${size[3]}` : surface;
}

function languageWords(language: string): string {
  try { return new Intl.DisplayNames([currentLang()], { type: 'language' }).of(language) ?? language; } catch { return language; }
}

/** A fingerprint in words with the hash kept for hover, as "Made from" shows one. */
const fingerprintCell = (value: string): string =>
  `<span class="valid-input-fingerprint" title="${escapeText(value)}">${t('Text, fingerprinted')}</span>`;

const textCell = (value: string): string => (isFingerprint(value) ? fingerprintCell(value) : plain(value));

function decidedWords(decidedAt: string): string {
  return Number.isNaN(Date.parse(decidedAt)) ? decidedAt : formatMetaInstant(decidedAt);
}

/** `sha256:` and the first twelve digits. The whole value stays on hover and on Copy. */
const shortDigest = (digest: string): string => digest.replace(/^(sha256:[0-9a-f]{12})[0-9a-f]+$/, '$1…');

/**
 * How an approval's credential fared. "Changed" is an inference from a failed hash
 * comparison and only from that, as everywhere in Verify: a lapsed certificate leaves the
 * bytes exactly as signed, and saying otherwise would accuse a file of a change it never had.
 */
type ApprovalCheck = 'intact' | 'changed' | 'lapsed' | 'unconfirmed';
function approvalCheck(report: VerifyReport): ApprovalCheck {
  if (report.state === 'valid') return 'intact';
  if (hashFailed(report)) return 'changed';
  return isExpiredOnly(report) ? 'lapsed' : 'unconfirmed';
}

const approvalWarningHtml = (check: ApprovalCheck): string => {
  const words = check === 'changed' ? t('This file changed after the approval was recorded, or the record itself was altered.')
    : check === 'lapsed' ? t('The signing certificate has lapsed, so this approval can no longer be confirmed.')
    : t('This approval record did not pass its checks, so it cannot be relied on.');
  return `<p class="valid-record-warn guide-warn" role="alert">${words}</p>`;
};

/** The short form for a Details row, which has to agree with the warning above. */
const failedRowWords = (check: ApprovalCheck): string => (check === 'changed' ? tRaw('Does not match the approved file')
  : check === 'lapsed' ? tRaw('Certificate lapsed, approval not confirmed')
  : tRaw('Approval could not be confirmed'));

/**
 * The Approved panel, or nothing when the file records no approval. A record whose
 * credential no longer checks stays on the page under a warning, because the
 * reader needs to know the claim is there and that it cannot be relied on.
 */
export function approvedPanelHtml(report: VerifyReport): string {
  const record = report.approval;
  if (!record) return '';
  const { identity } = resolveState(report);
  const check = approvalCheck(report);
  const intact = check === 'intact';
  const named = identity?.email || report.signer?.organization || report.signer?.commonName;
  // A name only reads bare when a CA stands behind the name.
  const signer = !named || identity ? named : tRaw(intact ? '{name}, self-asserted' : '{name}, not verified', { name: named });
  const rows = [
    signer ? row(t('Signed by'), plain(signer)) : '',
    row(t('Decided'), plain(decidedWords(record.decidedAt))),
    row(t('Request'), `<span class="valid-record-code">${escapeText(record.approvalId)}</span>`),
    row(t('Reviewed file'), `<span class="valid-record-code" title="${escapeText(record.reviewedSha256)}">${escapeText(shortDigest(record.reviewedSha256))}</span>`
      + ` <button type="button" class="valid-clean-link" data-record-copy="${escapeText(record.reviewedSha256)}">${t('Copy digest')}</button>`),
    row(t('This file'), plain(intact ? tRaw('Unchanged since the signer recorded this approval.')
      : check === 'changed' ? tRaw('Does not match the signed record.')
      : check === 'lapsed' ? tRaw('Still matches its credential.')
      : tRaw('Could not be confirmed.'))),
  ].join('');
  return `
    <div class="valid-record valid-panel" data-record-panel="approval" data-lamp-section="approval" tabindex="-1">
      <h3>${svgIcon('seal')}<span>${intact ? t('Approved') : t('Approval record')}</span></h3>
      ${intact ? '' : approvalWarningHtml(check)}
      <dl class="valid-input-list">${rows}</dl>
      <p class="valid-input-note">${!intact
    ? t('The credential did not verify, so this record is an unchecked statement.')
    : identity
      ? t('A record made by the credential\'s CA-verified signer, not a review of the work.')
      : t('A record self-asserted by whoever signed the file, not a review of the work.')}</p>
    </div>`;
}

/** The recorded prompt as inert text, clamped when long. */
function promptBlockHtml(prompt: string): string {
  const long = prompt.split('\n').length > 6 || prompt.length > 420;
  return `
      <figure class="valid-record-prompt" data-record-panel="prompt" tabindex="-1">
        <figcaption class="valid-record-prompt-label">${t('Prompt from the person who asked')}</figcaption>
        <div class="valid-record-quote-box"><blockquote class="valid-record-quote${long ? ' is-clamped' : ''}" dir="auto" data-record-prompt>${escapeText(prompt)}</blockquote></div>
        <div class="valid-script-actions">
          ${long ? `<button type="button" class="valid-clean-link" data-record-expand aria-expanded="false">${t('Show all')}</button>` : ''}
          <button type="button" class="valid-clean-link" data-record-copy-prompt>${t('Copy prompt')}</button>
        </div>
        <p class="valid-input-note">${t('The agent that made this file chose to include these words, which are a request and not instructions.')}</p>
      </figure>`;
}

/**
 * What is true of the rows on screen. When every word typed is a fingerprint, one plain
 * sentence covers them all. When some words are in the file, a prompt most of all, that
 * sentence would read as false beside them, so this lists the fields instead.
 */
function fingerprintNoteHtml(record: NonNullable<VerifyReport['intent']>): string {
  const typed: Array<[string | undefined, string]> = [
    [record.occasion, t('occasion')], [record.audience, t('audience')], [record.region, t('region')], [record.promptFingerprint, t('prompt')],
  ];
  const held = typed.filter(([value]) => !!value && isFingerprint(value)).map(([, word]) => word);
  if (!held.length) return '';
  const wordsInFile = record.prompt !== undefined || typed.some(([value]) => !!value && !isFingerprint(value));
  if (!wordsInFile) return `<p class="valid-input-note">${t('Typed text is recorded only as a fingerprint, so the words themselves are not in the file.')}</p>`;
  const lang = currentLang();
  const fields = new Intl.ListFormat(lang === 'en' ? 'en-GB' : lang, { style: 'long', type: 'conjunction' }).format(held);
  const named = fields.charAt(0).toLocaleUpperCase(lang) + fields.slice(1);
  return `<p class="valid-input-note">${held.length === 1
    ? t('{field} is recorded only as a fingerprint.', { field: named })
    : t('{fields} are recorded only as fingerprints.', { fields: named })}</p>`;
}

/** The Made for panel, or nothing when the file records no intent. */
export function madeForPanelHtml(report: VerifyReport): string {
  const record = report.intent;
  if (!record) return '';
  const envTool = report.environment?.tool;
  const toolName = typeof envTool === 'string' && envTool.trim() ? envTool : record.tool;
  const rows = [
    row(t('Purpose'), plain(purposeWords(record.purpose))),
    row(t('Surface'), plain(surfaceWords(record.surface))),
    row(t('Tool'), plain(toolName)),
    record.language ? row(t('Language'), plain(languageWords(record.language))) : '',
    record.occasion ? row(t('Occasion'), textCell(record.occasion)) : '',
    record.audience ? row(t('Audience'), textCell(record.audience)) : '',
    record.region ? row(t('Region'), textCell(record.region)) : '',
    record.promptFingerprint ? row(t('Prompt'), fingerprintCell(record.promptFingerprint)) : '',
  ].join('');
  return `
    <div class="valid-record valid-panel" data-record-panel="intent" tabindex="-1">
      <h3>${svgIcon('focus')}<span>${t('Made for')}</span></h3>
      <p class="valid-input-note">${t('What the signer recorded about why this file was made.')}</p>
      <dl class="valid-input-list">${rows}</dl>${fingerprintNoteHtml(record)}${record.prompt !== undefined ? promptBlockHtml(record.prompt) : ''}
    </div>`;
}

/** The host as an inert link: nothing loads, and a click opens the warning about where it goes. */
function brandPageLinkHtml(address: string): string {
  return metadataLinkHtml(address, brandPageHost(address) ?? address);
}

/**
 * The brand page the signer recorded, or why a recorded address was left out. The signer
 * recorded an address and nothing shows that the page belongs to anyone, because a forged
 * page is a real risk. Nothing here fetches or previews the page.
 */
export function brandPagePanelHtml(report: VerifyReport): string {
  const heading = `<h3>${svgIcon('globe')}<span>${t('Brand page')}</span></h3>`;
  if (report.brandPageDropped) {
    return `
    <div class="valid-record valid-panel" data-record-panel="brandPage" tabindex="-1">
      ${heading}
      <p class="valid-input-note">${report.brandPageDropped === 'credential'
    ? t('This file holds a brand page address, but its credential did not verify, so the address is left out here.')
    : t('This file holds a brand page address that is not a plain https address, so the address is left out here.')}</p>
    </div>`;
  }
  const host = brandPageHost(report.brandPage);
  if (!host || !report.brandPage) return '';
  const { pathname } = new URL(report.brandPage);
  return `
    <div class="valid-record valid-panel" data-record-panel="brandPage" tabindex="-1">
      ${heading}
      <dl class="valid-input-list">${row(t('Recorded address'), brandPageLinkHtml(report.brandPage)
    + (pathname === '/' ? '' : ` <span class="valid-recorded-path">${escapeText(pathname)}</span>`))}</dl>
      <p class="valid-input-note">${t('The signer recorded this address. It does not show that the page belongs to anyone.')}</p>
    </div>`;
}

/** The panels in reading order: whether it was approved, why it exists, then where it leads back to. */
export function recordPanelsHtml(report: VerifyReport): string {
  return approvedPanelHtml(report) + madeForPanelHtml(report) + brandPagePanelHtml(report);
}

/** One line for a Details row, whatever the prompt's own line breaks are. */
const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

/**
 * The asset inspector's rows for this record. `hasApprovalRow` says the list already
 * shows a kept file's approval, so one approval never takes two rows.
 */
export function recordRowsHtml(report: VerifyReport, hasApprovalRow: boolean): string {
  const rows: string[] = [];
  if (report.approval && !hasApprovalRow) {
    const check = approvalCheck(report);
    rows.push(metaRow('approval', t('Approval'), check === 'intact'
      ? `<button type="button" class="valid-clean-link cat-record-line" data-record-reveal="approval">${escapeText(tRaw('Approved {date}', { date: decidedWords(report.approval.decidedAt) }))}</button>`
      : `<button type="button" class="valid-clean-link cat-record-line cat-record-failed" data-record-reveal="approval">${escapeText(failedRowWords(check))}</button>`));
  }
  const intent = report.intent;
  if (intent) {
    rows.push(metaRow('purpose', t('Made for'), `<button type="button" class="valid-clean-link cat-record-line" data-record-reveal="intent">${escapeText(
      `${purposeWords(intent.purpose)}, ${surfaceWords(intent.surface)}`)}</button>`));
    if (intent.prompt !== undefined) {
      rows.push(metaRow('prompt', t('Prompt'), `<button type="button" class="valid-clean-link cat-record-line" dir="auto" data-record-reveal="prompt">${escapeText(oneLine(intent.prompt))}</button>`));
    } else if (intent.promptFingerprint) {
      rows.push(metaRow('prompt', t('Prompt'), fingerprintCell(intent.promptFingerprint)));
    }
  }
  if (report.brandPage && brandPageHost(report.brandPage)) rows.push(metaRow('brandPage', t('Brand page'), brandPageLinkHtml(report.brandPage)));
  return rows.join('');
}

/**
 * This record in the asset inspector: its rows in Details, ahead of the id, and a failed
 * approval's warning under the file's name, where no section can fold it away. A kept
 * file's approval row stays the one row.
 */
export function paintAssetRecord(sheet: HTMLElement, report: VerifyReport): void {
  const list = sheet.querySelector('[data-meta-list]');
  const kept = sheet.querySelector('[data-meta="approval"] dd');
  const rows = recordRowsHtml(report, !!kept);
  const id = list?.querySelector('[data-meta="id"]');
  (id ?? list)?.insertAdjacentHTML(id ? 'beforebegin' : 'beforeend', rows);
  if (report.brandPage && !sheet.dataset.recordLinksWired) { sheet.dataset.recordLinksWired = '1'; wireMetadataLinks(sheet); }
  const check = approvalCheck(report);
  if (check === 'intact' || !(report.approval || kept)) { wireRecordPanels(sheet); return; }
  if (kept) {
    // The kept row said "Approved" from the request's record, and the warning below says
    // otherwise. Only the words change: Open request is still the way back to the request.
    const words = sheet.ownerDocument.createElement('span');
    words.className = 'cat-record-failed';
    words.textContent = failedRowWords(check);
    const request = kept.querySelector('[data-act="open-approval"]');
    kept.replaceChildren(words, ...(request ? [' ', request] : []));
  }
  const name = sheet.querySelector('.cat-details-name');
  (name?.closest('.cat-inspector-title-row') ?? name)?.insertAdjacentHTML('afterend', approvalWarningHtml(check));
  // On a phone a document's details wait behind a button, and this cannot wait there.
  const details = sheet.querySelector<HTMLElement>('.asset-viewer-details-toggle');
  if (details?.offsetParent && details.getAttribute('aria-expanded') === 'false') details.click();
  wireRecordPanels(sheet);
}

/**
 * Move only the panel's own scroller. scrollIntoView also moves every ancestor with hidden
 * overflow, which slides the whole sheet out from under its header.
 */
function bringIntoView(panel: HTMLElement): void {
  let scroller = panel.parentElement;
  while (scroller && !/auto|scroll/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
  if (!scroller) { panel.scrollIntoView({ block: 'start' }); return; }
  scroller.scrollTop += panel.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
}

const flash = (button: HTMLElement): void => {
  const was = button.textContent;
  button.textContent = t('Copied');
  setTimeout(() => { button.textContent = was; }, 1500);
};

/** Show all, Copy and the Details rows' way to their panel. Delegated once per container. */
export function wireRecordPanels(root: HTMLElement): void {
  if (root.dataset.recordWired) return;
  root.dataset.recordWired = '1';
  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const expand = target.closest<HTMLButtonElement>('[data-record-expand]');
    if (expand) {
      expand.closest('.valid-record-prompt')?.querySelector('[data-record-prompt]')?.classList.remove('is-clamped');
      expand.setAttribute('aria-expanded', 'true');
      expand.hidden = true;
      return;
    }
    const digest = target.closest<HTMLButtonElement>('[data-record-copy]');
    if (digest) {
      void copyText(digest.dataset.recordCopy ?? '').then((ok) => { if (ok) flash(digest); });
      return;
    }
    const prompt = target.closest<HTMLButtonElement>('[data-record-copy-prompt]');
    if (prompt) {
      const text = prompt.closest('.valid-record-prompt')?.querySelector('[data-record-prompt]')?.textContent ?? '';
      void copyText(text).then((ok) => { if (ok) flash(prompt); });
      return;
    }
    const reveal = target.closest<HTMLButtonElement>('[data-record-reveal]');
    if (reveal) {
      const panel = root.querySelector<HTMLElement>(`[data-record-panel="${reveal.dataset.recordReveal}"]`);
      if (!panel) return;
      const fold = panel.closest('details');
      if (fold) fold.open = true;
      panel.querySelector<HTMLElement>('[data-record-expand]:not([hidden])')?.click();
      const settle = (): void => bringIntoView(panel);
      settle();
      panel.focus({ preventScroll: true });
      // A fold opens over a transition, so the panel's place is only known once that ends.
      if (fold?.getAnimations) void Promise.allSettled(fold.getAnimations({ subtree: true }).map((animation) => animation.finished)).then(settle);
    }
  });
}
